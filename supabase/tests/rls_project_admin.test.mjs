// Stag / hen project RLS test (0034): replay every migration, seed two project
// boards, and check what admins, members, outsiders and the couple can do.
// Pass a migration number to stop early (e.g. `0033`) to confirm the checks
// really fail without 0034.
import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const MIG = fileURLToPath(new URL("../migrations/", import.meta.url));
const LAST = process.argv[2] ?? "9999";
const db = new PGlite();
let failures = 0;

await db.exec(`
  create role anon nologin;
  create role authenticated nologin;
  create schema auth;
  create table auth.users (id uuid primary key default gen_random_uuid(), email text, raw_user_meta_data jsonb default '{}');
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  $$;
  grant usage on schema auth to anon, authenticated;
  grant usage on schema public to anon, authenticated;
  alter default privileges in schema public grant all on tables to anon, authenticated;
  alter default privileges in schema public grant execute on functions to anon, authenticated;
`);

const files = fs.readdirSync(MIG).filter((f) => f.endsWith(".sql")).sort();
for (const f of files) {
  if (f.slice(0, 4) > LAST) break;
  try {
    await db.exec(fs.readFileSync(path.join(MIG, f), "utf8"));
  } catch (e) {
    console.log("MIGRATION FAILED:", f, "\n ", e.message);
    process.exit(1);
  }
}
console.log(`-- applied migrations up to ${LAST}`);
const has34 = LAST >= "0034";

const P = {
  couple: ["couple", "{}"],
  family: ["family", "{}"],
  bm: ["wedding_party", "{best_man}"],
  moh: ["wedding_party", "{maid_of_honour}"],
  groomsman: ["wedding_party", "{groomsman}"],
  groomsman2: ["wedding_party", "{groomsman}"],
  bridesmaid: ["wedding_party", "{bridesmaid}"],
  plain: ["wedding_party", "{}"],
  guest: ["guest", "{}"],
};
const uid = {};
for (const [name, [role, tags]] of Object.entries(P)) {
  await db.query(`insert into contacts (full_name, email, role, tags) values ($1, $2, $3, $4)`, [name, `${name}@test.local`, role, tags]);
  uid[name] = (await db.query(`insert into auth.users (email) values ($1) returning id`, [`${name}@test.local`])).rows[0].id;
}

const G = (n) => `00000000-0000-0000-0000-0000000a000${n}`;
const O = (n) => `00000000-0000-0000-0000-0000000b000${n}`;
const I = (n) => `00000000-0000-0000-0000-0000000e000${n}`;
const T = (n) => `00000000-0000-0000-0000-0000000f000${n}`;
await db.exec(`
  insert into option_groups (id, category_page_id, title, visible_tag) values
    ('${G(4)}', null, 'Stag do', 'groomsman'), ('${G(5)}', null, 'Hen do', 'bridesmaid');
  insert into page_options (id, option_group_id, name) values
    ('${O(4)}', '${G(4)}', 'Stag villa'), ('${O(5)}', '${G(5)}', 'Hen spa');
  update page_option_costs set predicted_cost_min = 100, predicted_cost_max = 200;
  insert into idea_boards (id, tier, visible_tag, title, created_by) values
    ('${I(1)}', 'wedding_party', 'groomsman', 'Go-karting', '${uid.groomsman}'),
    ('${I(2)}', 'wedding_party', 'groomsman', 'Paintball', '${uid.bm}'),
    ('${I(3)}', 'wedding_party', 'bridesmaid', 'Spa day', '${uid.bridesmaid}'),
    ('${I(4)}', 'wedding_party', null, 'Main board idea', '${uid.couple}');
  insert into idea_board_images (idea_board_id, image_url) values
    ('${I(1)}', 'kart.jpg'), ('${I(2)}', 'paint.jpg'), ('${I(3)}', 'spa.jpg'), ('${I(4)}', 'main.jpg');
  insert into tasks (id, title, visible_tag) values
    ('${T(1)}', 'Book stag flights', 'groomsman'), ('${T(2)}', 'Book hen brunch', 'bridesmaid');
`);
if (has34) {
  await db.exec(`
    insert into project_budget_items (visible_tag, name, predicted_cost) values
      ('groomsman', 'Stag flights', 900), ('bridesmaid', 'Hen brunch', 300);
  `);
}

async function as(name, fn) {
  return db.transaction(async (tx) => {
    await tx.query(`select set_config('request.jwt.claim.sub', $1, true)`, [name ? uid[name] : ""]);
    await tx.exec(`set local role authenticated`);
    const out = await fn(tx);
    await tx.rollback();
    return out;
  });
}
const list = async (tx, sql) => (await tx.query(sql)).rows.map((r) => r.n).sort().join(",");
const tryRun = async (tx, sql) => {
  try {
    await tx.exec("savepoint s");
    const r = await tx.query(sql);
    return r.rows.length > 0 ? "done" : "no-op";
  } catch {
    await tx.exec("rollback to savepoint s");
    return "refused";
  }
};
function check(label, got, want) {
  const ok = got === want;
  if (!ok) failures++;
  console.log(`${ok ? "  ok  " : "  FAIL"} ${label}: ${JSON.stringify(got)}${ok ? "" : `  (wanted ${JSON.stringify(want)})`}`);
}

const READS = {
  ideas: `select title as n from idea_boards`,
  ideaPhotos: `select image_url as n from idea_board_images`,
  tasks: `select title as n from tasks`,
  comparisons: `select title as n from option_groups`,
  options: `select name as n from page_options`,
  prices: `select po.name as n from page_option_costs c join page_options po on po.id = c.page_option_id`,
  budget: has34 ? `select name as n from project_budget_items` : `select '' as n where false`,
};
const wantReads = {
  couple:     { ideas: "Go-karting,Main board idea,Paintball,Spa day", ideaPhotos: "kart.jpg,main.jpg,paint.jpg,spa.jpg", tasks: "Book hen brunch,Book stag flights", comparisons: "Hen do,Stag do", options: "Hen spa,Stag villa", prices: "Hen spa,Stag villa", budget: "Hen brunch,Stag flights" },
  bm:         { ideas: "Go-karting,Main board idea,Paintball", ideaPhotos: "kart.jpg,main.jpg,paint.jpg", tasks: "Book stag flights", comparisons: "Stag do", options: "Stag villa", prices: "Stag villa", budget: "Stag flights" },
  moh:        { ideas: "Main board idea,Spa day", ideaPhotos: "main.jpg,spa.jpg", tasks: "Book hen brunch", comparisons: "Hen do", options: "Hen spa", prices: "Hen spa", budget: "Hen brunch" },
  groomsman:  { ideas: "Go-karting,Main board idea,Paintball", ideaPhotos: "kart.jpg,main.jpg,paint.jpg", tasks: "Book stag flights", comparisons: "Stag do", options: "Stag villa", prices: "", budget: "" },
  bridesmaid: { ideas: "Main board idea,Spa day", ideaPhotos: "main.jpg,spa.jpg", tasks: "Book hen brunch", comparisons: "Hen do", options: "Hen spa", prices: "", budget: "" },
  plain:      { ideas: "Main board idea", ideaPhotos: "main.jpg", tasks: "", comparisons: "", options: "", prices: "", budget: "" },
  family:     { ideas: "Main board idea", ideaPhotos: "main.jpg", tasks: "", comparisons: "", options: "", prices: "", budget: "" },
  guest:      { ideas: "", ideaPhotos: "", tasks: "", comparisons: "", options: "", prices: "", budget: "" },
};
console.log("\n== reads");
for (const [who, want] of Object.entries(wantReads)) {
  const got = await as(who, async (tx) => {
    const out = {};
    for (const [k, sql] of Object.entries(READS)) out[k] = await list(tx, sql);
    return out;
  });
  for (const k of Object.keys(READS)) check(`${who.padEnd(10)} ${k.padEnd(11)}`, got[k], want[k]);
}

console.log("\n== writes on the STAG board");
const W = {
  addIdea: (who) => `insert into idea_boards (tier, visible_tag, title, created_by) values ('wedding_party', 'groomsman', 'New', '${uid[who]}') returning 1`,
  editOwnIdea: () => `update idea_boards set body = 'x' where id = '${I(1)}' returning 1`,           // groomsman's
  editBmIdea: () => `update idea_boards set body = 'x' where id = '${I(2)}' returning 1`,            // best man's
  deleteGroomsmanIdea: () => `delete from idea_boards where id = '${I(1)}' returning 1`,
  addPhotoToGroomsmanIdea: () => `insert into idea_board_images (idea_board_id, image_url) values ('${I(1)}', 'n.jpg') returning 1`,
  addPhotoToBmIdea: () => `insert into idea_board_images (idea_board_id, image_url) values ('${I(2)}', 'n.jpg') returning 1`,
  addTask: () => `insert into tasks (title, visible_tag) values ('t', 'groomsman') returning 1`,
  tickTask: () => `update tasks set status = 'done' where id = '${T(1)}' returning 1`,
  deleteTask: () => `delete from tasks where id = '${T(1)}' returning 1`,
  startComparison: () => `insert into option_groups (category_page_id, title, visible_tag) values (null, 'c', 'groomsman') returning 1`,
  renameComparison: () => `update option_groups set title = 'x' where id = '${G(4)}' returning 1`,
  deleteComparison: () => `delete from option_groups where id = '${G(4)}' returning 1`,
  addOption: () => `insert into page_options (option_group_id, name) values ('${G(4)}', 'o') returning 1`,
  editOption: () => `update page_options set description = 'x' where id = '${O(4)}' returning 1`,
  pickWinner: () => `update page_options set is_winner = true where id = '${O(4)}' returning 1`,
  deleteOption: () => `delete from page_options where id = '${O(4)}' returning 1`,
  addOptionPhoto: () => `insert into page_option_images (page_option_id, image_url, sort_order) values ('${O(4)}', 'p.jpg', 0) returning 1`,
  setPrice: () => `update page_option_costs set actual_cost = 5 where page_option_id = '${O(4)}' returning 1`,
  addBudgetLine: () => `insert into project_budget_items (visible_tag, name, predicted_cost) values ('groomsman', 'b', 1) returning 1`,
  editBudgetLine: () => `update project_budget_items set actual_cost = 1 where visible_tag = 'groomsman' returning 1`,
  deleteBudgetLine: () => `delete from project_budget_items where visible_tag = 'groomsman' returning 1`,
};
const D = "done", R = "refused", N = "no-op";
const keys = Object.keys(W);
const wantWrites = {
  //           addIdea editOwn editBm delGI photoGI photoBm addTask tick delTask startC renC delC addOpt editOpt win delOpt optPhoto price addB editB delB
  couple:     [D, D, D, D, D, D, D, D, D, D, D, D, D, D, D, D, D, D, D, D, D],
  bm:         [D, D, D, D, D, D, D, D, D, D, D, D, D, D, D, D, D, D, D, D, D],
  groomsman:  [D, D, N, D, D, R, D, D, N, R, N, N, D, N, N, N, R, N, R, N, N],
  groomsman2: [D, N, N, N, R, R, D, D, N, R, N, N, D, N, N, N, R, N, R, N, N],
  moh:        [R, N, N, N, R, R, R, N, N, R, N, N, R, N, N, N, R, N, R, N, N],
  bridesmaid: [R, N, N, N, R, R, R, N, N, R, N, N, R, N, N, N, R, N, R, N, N],
  plain:      [R, N, N, N, R, R, R, N, N, R, N, N, R, N, N, N, R, N, R, N, N],
  family:     [R, N, N, N, R, R, R, N, N, R, N, N, R, N, N, N, R, N, R, N, N],
  guest:      [R, N, N, N, R, R, R, N, N, R, N, N, R, N, N, N, R, N, R, N, N],
};
for (const [who, want] of Object.entries(wantWrites)) {
  const got = [];
  for (const k of keys) {
    if (!has34 && k.includes("Budget")) { got.push(want[keys.indexOf(k)]); continue; }
    got.push(await as(who, (tx) => tryRun(tx, W[k](who))));
  }
  const bad = keys.filter((k, i) => got[i] !== want[i]).map((k) => `${k}: got ${got[keys.indexOf(k)]}, wanted ${want[keys.indexOf(k)]}`);
  if (bad.length) { failures += bad.length; console.log(`  FAIL ${who}:\n        ` + bad.join("\n        ")); }
  else console.log(`  ok   ${who.padEnd(10)} all ${keys.length} write checks as expected`);
}

console.log("\n== the HEN board mirrors it");
check("moh deletes a hen task", await as("moh", (tx) => tryRun(tx, `delete from tasks where id = '${T(2)}' returning 1`)), D);
check("moh picks the hen winner", await as("moh", (tx) => tryRun(tx, `update page_options set is_winner = true where id = '${O(5)}' returning 1`)), D);
check("bridesmaid adds a hen option", await as("bridesmaid", (tx) => tryRun(tx, `insert into page_options (option_group_id, name) values ('${G(5)}', 'o') returning 1`)), D);
check("bridesmaid can't delete a hen task", await as("bridesmaid", (tx) => tryRun(tx, `delete from tasks where id = '${T(2)}' returning 1`)), N);
check("best man can't touch the hen board", await as("bm", (tx) => tryRun(tx, `delete from tasks where id = '${T(2)}' returning 1`)), N);
if (has34) {
  check("moh edits the hen budget", await as("moh", (tx) => tryRun(tx, `update project_budget_items set actual_cost = 1 where visible_tag = 'bridesmaid' returning 1`)), D);
  check("best man can't add to the hen budget", await as("bm", (tx) => tryRun(tx, `insert into project_budget_items (visible_tag, name) values ('bridesmaid', 'x') returning 1`)), R);

  console.log("\n== the couple's 'See costs' switch on a project board");
  await db.exec(`update page_permissions set cost_access = true where page_key = 'project:groomsmen' and principal_type = 'tag' and principal_value = 'groomsman'`);
  check("groomsmen opted in: read the stag budget", await as("groomsman", (tx) => list(tx, READS.budget)), "Stag flights");
  check("groomsmen opted in: see stag prices", await as("groomsman", (tx) => list(tx, READS.prices)), "Stag villa");
  check("groomsmen opted in: still can't change the budget", await as("groomsman", (tx) => tryRun(tx, W.addBudgetLine())), R);
  check("groomsmen opted in: still can't set a price", await as("groomsman", (tx) => tryRun(tx, W.setPrice())), N);
  check("bridesmaids unaffected", await as("bridesmaid", (tx) => list(tx, READS.budget)), "");
  await db.exec(`update page_permissions set cost_access = false where page_key = 'project:groomsmen' and principal_type = 'tag' and principal_value = 'groomsman'`);

  await db.exec(`update page_permissions set cost_access = false where page_key = 'project:groomsmen' and principal_type = 'tag' and principal_value = 'best_man'`);
  check("best man with costs switched off: no stag budget", await as("bm", (tx) => list(tx, READS.budget)), "");
  check("best man with costs switched off: can't add a line", await as("bm", (tx) => tryRun(tx, W.addBudgetLine())), R);
  check("best man with costs switched off: still runs the board", await as("bm", (tx) => tryRun(tx, W.deleteTask())), D);
  await db.exec(`update page_permissions set cost_access = true where page_key = 'project:groomsmen' and principal_type = 'tag' and principal_value = 'best_man'`);
}

console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
