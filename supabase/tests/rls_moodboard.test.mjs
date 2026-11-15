// Moodboard contributor rules (0038): replay every migration, then check who
// can read and add to the main moodboard and the stag/hen boards, who can
// edit and delete, and that authorship can't be faked. Pass a migration
// number to stop early (e.g. `0037`) to confirm the checks fail without 0038.
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
  create role service_role nologin bypassrls;
  create schema auth;
  create table auth.users (id uuid primary key default gen_random_uuid(), email text, raw_user_meta_data jsonb default '{}', last_sign_in_at timestamptz);
  create table auth.sessions (id uuid primary key default gen_random_uuid(), user_id uuid not null);
  create table auth.refresh_tokens (id bigserial primary key, user_id varchar, session_id uuid);
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  $$;
  grant usage on schema auth to anon, authenticated, service_role;
  grant usage on schema public to anon, authenticated, service_role;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
`);
for (const f of fs.readdirSync(MIG).filter((f) => f.endsWith(".sql")).sort()) {
  if (f.slice(0, 4) > LAST) break;
  try {
    await db.exec(fs.readFileSync(path.join(MIG, f), "utf8"));
  } catch (e) {
    console.log("MIGRATION FAILED:", f, "\n ", e.message);
    process.exit(1);
  }
}
console.log(`-- applied migrations up to ${LAST}`);

const P = {
  couple: ["couple", "{}"],
  family: ["family", "{}"],
  bm: ["wedding_party", "{best_man}"],
  moh: ["wedding_party", "{maid_of_honour}"],
  groomsman: ["wedding_party", "{groomsman}"],
  bridesmaid: ["wedding_party", "{bridesmaid}"],
  plain: ["wedding_party", "{}"],
  guest: ["guest", "{}"],
};
const uid = {};
for (const [name, [role, tags]] of Object.entries(P)) {
  await db.query(`insert into contacts (full_name, email, role, tags) values ($1, $2, $3, $4)`, [name, `${name}@test.local`, role, tags]);
  uid[name] = (await db.query(`insert into auth.users (email) values ($1) returning id`, [`${name}@test.local`])).rows[0].id;
}
const id = (n) => `00000000-0000-0000-0000-0000000000${String(n).padStart(2, "0")}`;
await db.exec(`
  insert into idea_boards (id, tier, visible_tag, title, created_by) values
    ('${id(1)}', 'wedding_party', null, 'Main idea', '${uid.couple}'),
    ('${id(2)}', 'wedding_party', 'groomsman', 'Stag idea', '${uid.groomsman}'),
    ('${id(3)}', 'wedding_party', 'bridesmaid', 'Hen idea', '${uid.bridesmaid}'),
    ('${id(4)}', 'wedding_party', null, 'Family idea', '${uid.family}');
  insert into idea_board_images (idea_board_id, image_url) values ('${id(1)}', 'main.jpg'), ('${id(2)}', 'stag.jpg'), ('${id(3)}', 'hen.jpg');
`);

async function as(name, fn) {
  return db.transaction(async (tx) => {
    await tx.query(`select set_config('request.jwt.claim.sub', $1, true)`, [name ? uid[name] : ""]);
    await tx.exec(`set local role authenticated`);
    const out = await fn(tx);
    await tx.rollback();
    return out;
  });
}
const attempt = async (tx, sql, params = []) => {
  try {
    await tx.exec("savepoint s");
    const r = await tx.query(sql, params);
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
const list = async (tx, sql) => (await tx.query(sql)).rows.map((r) => r.n).sort().join(",");

console.log("\n== who can READ the boards");
const wantRead = {
  couple: ["Family idea,Hen idea,Main idea,Stag idea", "hen.jpg,main.jpg,stag.jpg"],
  family: ["Family idea,Main idea", "main.jpg"],
  bm: ["Family idea,Main idea,Stag idea", "main.jpg,stag.jpg"],
  moh: ["Family idea,Hen idea,Main idea", "hen.jpg,main.jpg"],
  groomsman: ["Stag idea", "stag.jpg"],
  bridesmaid: ["Hen idea", "hen.jpg"],
  plain: ["", ""],
  guest: ["", ""],
};
for (const [who, [ideas, imgs]] of Object.entries(wantRead)) {
  check(`${who.padEnd(10)} ideas`, await as(who, (tx) => list(tx, `select title as n from idea_boards`)), ideas);
  check(`${who.padEnd(10)} photos`, await as(who, (tx) => list(tx, `select image_url as n from idea_board_images`)), imgs);
}

console.log("\n== who can ADD");
const main = (who) => `insert into idea_boards (tier, title) values ('wedding_party', 'New main idea') returning 1`;
const stag = `insert into idea_boards (tier, visible_tag, title) values ('wedding_party', 'groomsman', 'New stag idea') returning 1`;
const hen = `insert into idea_boards (tier, visible_tag, title) values ('wedding_party', 'bridesmaid', 'New hen idea') returning 1`;
const D = "done", R = "refused";
const wantAdd = {
  //            main stag hen
  couple:     [D, D, D],
  family:     [D, R, R],
  bm:         [D, D, R],
  moh:        [D, R, D],
  groomsman:  [R, D, R],
  bridesmaid: [R, R, D],
  plain:      [R, R, R],
  guest:      [R, R, R],
};
for (const [who, [m, s, h]] of Object.entries(wantAdd)) {
  check(`${who.padEnd(10)} main board`, await as(who, (tx) => attempt(tx, main(who))), m);
  check(`${who.padEnd(10)} stag board`, await as(who, (tx) => attempt(tx, stag)), s);
  check(`${who.padEnd(10)} hen board`, await as(who, (tx) => attempt(tx, hen)), h);
}

console.log("\n== authorship");
check("posting 'as' someone else records you", await as("family", async (tx) => {
  await tx.query(`insert into idea_boards (id, tier, title, created_by) values ('${id(50)}', 'wedding_party', 'Spoof', $1)`, [uid.couple]);
  const r = (await tx.query(`select created_by from idea_boards where id = '${id(50)}'`)).rows[0];
  return r.created_by === uid.family ? "self" : "OTHER";
}), "self");
check("a missing author is filled in", await as("bm", async (tx) => {
  await tx.query(`insert into idea_boards (id, tier, title) values ('${id(51)}', 'wedding_party', 'No author')`);
  return (await tx.query(`select created_by from idea_boards where id = '${id(51)}'`)).rows[0].created_by === uid.bm ? "self" : "OTHER";
}), "self");

console.log("\n== editing and removing");
check("family edits their own idea", await as("family", (tx) => attempt(tx, `update idea_boards set body = 'x' where id = '${id(4)}' returning 1`)), D);
check("family adds a photo to their own idea", await as("family", (tx) => attempt(tx, `insert into idea_board_images (idea_board_id, image_url) values ('${id(4)}', 'f.jpg') returning 1`)), D);
check("family deletes their own idea", await as("family", (tx) => attempt(tx, `delete from idea_boards where id = '${id(4)}' returning 1`)), D);
check("family can't edit the couple's idea", await as("family", (tx) => attempt(tx, `update idea_boards set body = 'x' where id = '${id(1)}' returning 1`)), "no-op");
check("family can't delete the couple's idea", await as("family", (tx) => attempt(tx, `delete from idea_boards where id = '${id(1)}' returning 1`)), "no-op");
check("best man can't edit the family's idea", await as("bm", (tx) => attempt(tx, `update idea_boards set body = 'x' where id = '${id(4)}' returning 1`)), "no-op");
check("couple can remove any main-board idea", await as("couple", (tx) => attempt(tx, `delete from idea_boards where id = '${id(4)}' returning 1`)), D);
check("best man (admin) can edit a stag idea he didn't write", await as("bm", (tx) => attempt(tx, `update idea_boards set body = 'x' where id = '${id(2)}' returning 1`)), D);
check("a groomsman can edit only his own stag idea", await as("groomsman", (tx) => attempt(tx, `update idea_boards set body = 'x' where id = '${id(2)}' returning 1`)), D);
check("…not the maid of honour's board", await as("moh", (tx) => attempt(tx, `update idea_boards set body = 'x' where id = '${id(2)}' returning 1`)), "no-op");

console.log("\n== votes and comments follow the new visibility");
await db.exec(`insert into comments (target_type, target_id, profile_id, body) values ('idea', '${id(1)}', '${uid.couple}', 'hi')`);
check("plain wedding party can't read comments on the main board", await as("plain", async (tx) => String((await tx.query(`select 1 from comments`)).rows.length)), "0");
check("family can", await as("family", async (tx) => String((await tx.query(`select 1 from comments`)).rows.length)), "1");
check("plain wedding party can't vote on a main-board idea", await as("plain", (tx) => attempt(tx, `insert into reactions (target_type, target_id, value) values ('idea', '${id(1)}', 1) returning 1`)), R);
check("family can vote on one", await as("family", (tx) => attempt(tx, `insert into reactions (target_type, target_id, value) values ('idea', '${id(1)}', 1) returning 1`)), D);

console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
