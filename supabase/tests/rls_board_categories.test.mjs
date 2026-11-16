// Stag and hen boards with nested categories (0047): who sees and does what.
import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const MIG = fileURLToPath(new URL("../migrations/", import.meta.url));
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
  try {
    await db.exec(fs.readFileSync(path.join(MIG, f), "utf8"));
  } catch (e) {
    console.log("MIGRATION FAILED:", f, "\n ", e.message);
    process.exit(1);
  }
}

const P = {
  couple: ["couple", "{}"],
  family: ["family", "{}"],
  bm: ["wedding_party", "{best_man}"],
  moh: ["wedding_party", "{maid_of_honour}"],
  groomsman: ["wedding_party", "{groomsman}"],
  bridesmaid: ["wedding_party", "{bridesmaid}"],
  plain: ["wedding_party", "{}"],
};
const uid = {};
for (const [name, [role, tags]] of Object.entries(P)) {
  await db.query(`insert into contacts (full_name, email, role, tags) values ($1, $2, $3, $4)`, [name, `${name}@test.local`, role, tags]);
  uid[name] = (await db.query(`insert into auth.users (email) values ($1) returning id`, [`${name}@test.local`])).rows[0].id;
}

const C = (n) => `00000000-0000-0000-0000-00000000c00${n}`;
const G = (n) => `00000000-0000-0000-0000-0000000a000${n}`;
const O = (n) => `00000000-0000-0000-0000-0000000b000${n}`;
await db.exec(`
  insert into category_pages (id, slug, title, board_tag) values ('${C(1)}', 'stag', 'Stag do', 'groomsman');
  insert into category_pages (id, slug, title, parent_id) values ('${C(2)}', 'stag-stay', 'Accommodation', '${C(1)}');
  insert into category_pages (id, slug, title, board_tag) values ('${C(3)}', 'hen', 'Hen do', 'bridesmaid');
  insert into category_pages (id, slug, title) values ('${C(4)}', 'venue', 'Venue');
  insert into option_groups (id, category_page_id, title) values ('${G(1)}', '${C(2)}', 'Accommodation'), ('${G(2)}', '${C(3)}', 'Hen do'), ('${G(3)}', '${C(4)}', 'Venue');
  insert into page_options (id, option_group_id, name) values ('${O(1)}', '${G(1)}', 'Villa'), ('${O(2)}', '${G(2)}', 'Spa'), ('${O(3)}', '${G(3)}', 'Chateau');
  update page_option_costs set predicted_cost_min = 100, predicted_cost_max = 200;
  insert into page_registry (page_key, parent_page_key, label, default_min_role) values
    ('categories:venue', 'categories', 'Venue', 'family') on conflict do nothing;
  insert into page_permissions (page_key, principal_type, principal_value, page_access, data_access, edit_access, cost_access)
    values ('categories:venue', 'role', 'family', true, true, false, true) on conflict do nothing;
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
const count = (sql) => async (tx) => String((await tx.query(sql)).rows.length);
const attempt = (sql) => async (tx) => {
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
const stagIds = `('${C(1)}','${C(2)}')`;

console.log("== inheritance (setup, as the server)");
check("child of a board category is on the same board", (await db.query(`select board_tag from category_pages where id = '${C(2)}'`)).rows[0].board_tag, "groomsman");
check("its options comparison carries the board tag", (await db.query(`select visible_tag from option_groups where id = '${G(1)}'`)).rows[0].visible_tag, "groomsman");

console.log("== who sees the stag categories");
for (const [who, n] of [["couple", "2"], ["bm", "2"], ["groomsman", "2"], ["moh", "0"], ["bridesmaid", "0"], ["family", "0"], ["plain", "0"]]) {
  check(`${who.padEnd(10)} sees them`, await as(who, count(`select 1 from category_pages where id in ${stagIds}`)), n);
}
check("bridesmaid sees the hen categories", await as("bridesmaid", count(`select 1 from category_pages where id = '${C(3)}'`)), "1");
check("groomsman does not see the hen categories", await as("groomsman", count(`select 1 from category_pages where id = '${C(3)}'`)), "0");
check("family still sees the main Venue", await as("family", count(`select 1 from category_pages where id = '${C(4)}'`)), "1");
check("groomsman does not see the main Venue", await as("groomsman", count(`select 1 from category_pages where id = '${C(4)}'`)), "0");

console.log("== options on a board category");
check("groomsman reads the option", await as("groomsman", count(`select 1 from page_options where id = '${O(1)}'`)), "1");
check("bridesmaid cannot read it", await as("bridesmaid", count(`select 1 from page_options where id = '${O(1)}'`)), "0");
check("groomsman can add an option", await as("groomsman", attempt(`insert into page_options (option_group_id, name) values ('${G(1)}', 'Hotel') returning 1`)), "done");
check("bridesmaid cannot add one to the stag board", await as("bridesmaid", attempt(`insert into page_options (option_group_id, name) values ('${G(1)}', 'Hotel') returning 1`)), "refused");
check("groomsman can edit an option", await as("groomsman", attempt(`update page_options set name = 'Villa 2' where id = '${O(1)}' returning 1`)), "done");
check("groomsman cannot choose the winner", await as("groomsman", attempt(`update page_options set is_winner = true where id = '${O(1)}' returning 1`)), "refused");
check("best man can choose the winner", await as("bm", attempt(`update page_options set is_winner = true where id = '${O(1)}' returning 1`)), "done");
check("maid of honour cannot choose the stag winner", await as("moh", attempt(`update page_options set is_winner = true where id = '${O(1)}' returning 1`)), "no-op");
check("groomsman cannot delete an option", await as("groomsman", attempt(`delete from page_options where id = '${O(1)}' returning 1`)), "no-op");
check("best man can delete an option", await as("bm", attempt(`delete from page_options where id = '${O(1)}' returning 1`)), "done");
check("best man cannot choose a MAIN category winner", await as("bm", attempt(`update page_options set is_winner = true where id = '${O(3)}' returning 1`)), "refused");

console.log("== prices");
check("best man sees the stag option's price", await as("bm", count(`select 1 from page_option_costs where page_option_id = '${O(1)}'`)), "1");
check("couple sees it", await as("couple", count(`select 1 from page_option_costs where page_option_id = '${O(1)}'`)), "1");

console.log("== managing board categories");
check("best man can add a stag category", await as("bm", attempt(`insert into category_pages (slug, title, board_tag) values ('stag-flights', 'Flights', 'groomsman') returning 1`)), "done");
check("best man can add one inside another", await as("bm", attempt(`insert into category_pages (slug, title, parent_id) values ('stag-activities', 'Activities', '${C(1)}') returning board_tag`)), "done");
check("the one inside inherits the board", await as("bm", async (tx) => (await tx.query(`insert into category_pages (slug, title, parent_id) values ('stag-x', 'X', '${C(1)}') returning board_tag`)).rows[0].board_tag), "groomsman");
check("groomsman cannot add a category", await as("groomsman", attempt(`insert into category_pages (slug, title, board_tag) values ('stag-y', 'Y', 'groomsman') returning 1`)), "refused");
check("best man cannot add a MAIN category", await as("bm", attempt(`insert into category_pages (slug, title) values ('main-z', 'Z') returning 1`)), "refused");
check("best man cannot add a HEN category", await as("bm", attempt(`insert into category_pages (slug, title, board_tag) values ('hen-q', 'Q', 'bridesmaid') returning 1`)), "refused");
check("best man can rename a stag category", await as("bm", attempt(`update category_pages set title = 'Stag!' where id = '${C(1)}' returning 1`)), "done");
check("best man cannot rename a hen category", await as("bm", attempt(`update category_pages set title = 'x' where id = '${C(3)}' returning 1`)), "no-op");
check("best man cannot move a stag category into the main tree", await as("bm", attempt(`update category_pages set parent_id = '${C(4)}' where id = '${C(2)}' returning 1`)), "refused");
check("best man cannot hand a stag category to the hens", await as("bm", attempt(`update category_pages set board_tag = 'bridesmaid' where id = '${C(1)}' returning 1`)), "refused");
check("groomsman cannot rename", await as("groomsman", attempt(`update category_pages set title = 'x' where id = '${C(1)}' returning 1`)), "no-op");
check("best man can delete a stag category", await as("bm", attempt(`delete from category_pages where id = '${C(2)}' returning 1`)), "done");
check("groomsman cannot delete one", await as("groomsman", attempt(`delete from category_pages where id = '${C(2)}' returning 1`)), "no-op");
check("maid of honour can manage the hen board", await as("moh", attempt(`insert into category_pages (slug, title, board_tag) values ('hen-w', 'W', 'bridesmaid') returning 1`)), "done");
check("couple can move a stag category to the hens (children follow)", await as("couple", async (tx) => {
  await tx.query(`update category_pages set board_tag = 'bridesmaid' where id = '${C(1)}'`);
  return (await tx.query(`select board_tag from category_pages where id = '${C(2)}'`)).rows[0].board_tag + "/" +
    (await tx.query(`select visible_tag from option_groups where id = '${G(1)}'`)).rows[0].visible_tag;
}), "bridesmaid/bridesmaid");

console.log("== contacts and dates on a board category");
check("groomsman can add a contact", await as("groomsman", attempt(`insert into category_contacts (category_page_id, name) values ('${C(2)}', 'Villa owner') returning 1`)), "done");
check("bridesmaid cannot", await as("bridesmaid", attempt(`insert into category_contacts (category_page_id, name) values ('${C(2)}', 'x') returning 1`)), "refused");
check("groomsman can add a date", await as("groomsman", attempt(`insert into diary_entries (title, entry_date, source, category_page_id) values ('Flights', '2028-05-01', 'category_page', '${C(2)}') returning 1`)), "done");
check("best man can delete a stag contact", await as("bm", async (tx) => { await tx.query(`insert into category_contacts (category_page_id, name) values ('${C(2)}', 'k')`); return attempt(`delete from category_contacts where name = 'k' returning 1`)(tx); }), "done");
check("family cannot see stag dates", await as("family", count(`select 1 from diary_entries where category_page_id = '${C(2)}'`)), "0");

console.log("== main categories unchanged");
check("family cannot edit the main Venue", await as("family", attempt(`insert into page_options (option_group_id, name) values ('${G(3)}', 'x') returning 1`)), "refused");
check("best man cannot delete a main option", await as("bm", attempt(`delete from page_options where id = '${O(3)}' returning 1`)), "no-op");

console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
