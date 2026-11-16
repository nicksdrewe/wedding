// Nested categories (0042), organising comms (0043) and the Big Day (0044).
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
  plain: ["wedding_party", "{}"],
  guest: ["guest", "{}"],
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
  insert into category_pages (id, slug, title, parent_id) values
    ('${C(1)}', 'catering', 'Catering', null),
    ('${C(2)}', 'food', 'Food', '${C(1)}'),
    ('${C(3)}', 'breakfast', 'Breakfast', '${C(2)}'),
    ('${C(4)}', 'venue', 'Venue', null);
  insert into page_registry (page_key, parent_page_key, label, default_min_role) values
    ('categories:catering', 'categories', 'Catering', 'family'), ('categories:breakfast', 'categories', 'Breakfast', 'family')
  on conflict do nothing;
  insert into option_groups (id, category_page_id, title, visible_tag) values
    ('${G(1)}', '${C(3)}', 'Breakfast', null), ('${G(2)}', '${C(4)}', 'Venue', null), ('${G(3)}', null, 'Stag do', 'groomsman');
  insert into page_options (id, option_group_id, name) values
    ('${O(1)}', '${G(1)}', 'Boulangerie'), ('${O(2)}', '${G(2)}', 'Chateau'), ('${O(3)}', '${G(3)}', 'Stag villa');
  update page_option_costs set predicted_cost_min = 100, predicted_cost_max = 200;
  -- family: no access to Catering at all (should cascade two levels down)
  insert into page_permissions (page_key, principal_type, principal_value, page_access, data_access, edit_access, cost_access)
    values ('categories:catering', 'role', 'family', false, false, false, false);
  -- best man: prices on Catering (cascades), but explicitly not on Breakfast
  insert into page_permissions (page_key, principal_type, principal_value, page_access, data_access, edit_access, cost_access)
    values ('categories:catering', 'tag', 'best_man', true, true, true, true),
           ('categories:breakfast', 'tag', 'best_man', true, true, true, false);
  insert into org_comms (subject, created_by, category_page_id) values ('About the venue', '${uid.couple}', '${C(4)}');
  insert into org_comms (subject, created_by, page_option_id) values ('Stag villa email', '${uid.couple}', '${O(3)}');
  insert into org_comms (subject, created_by, page_option_id) values ('Croissant order', '${uid.couple}', '${O(1)}');
  insert into org_comms (subject, created_by) values ('General note', '${uid.couple}');
  update big_day_settings set start_date = '2028-07-07', end_date = '2028-07-10';
  insert into big_day_items (title, day, visible_to_guests) values ('Ceremony', '2028-07-08', true), ('Boys cycle', '2028-07-08', false);
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

console.log("== nested categories: access cascades down the tree");
check("couple sees all 4 categories", await as("couple", count(`select 1 from category_pages`)), "4");
check("family sees only Venue (Catering switched off cascades to Food and Breakfast)", await as("family", count(`select 1 from category_pages`)), "1");
check("best man sees all 4", await as("bm", count(`select 1 from category_pages`)), "4");
check("groomsman sees none", await as("groomsman", count(`select 1 from category_pages`)), "0");
check("best man sees Venue option price? no rule = no", await as("bm", count(`select 1 from page_option_costs where page_option_id = '${O(2)}'`)), "0");
check("best man: Breakfast price hidden by its own rule", await as("bm", count(`select 1 from page_option_costs where page_option_id = '${O(1)}'`)), "0");
check("family cannot read the Breakfast option", await as("family", count(`select 1 from page_options where id = '${O(1)}'`)), "0");
check("best man can add an option two levels down (edit cascades)", await as("bm", attempt(`insert into page_options (option_group_id, name) values ('${G(1)}', 'Cafe') returning 1`)), "done");
check("a category cannot be put under its own grandchild", await as("couple", attempt(`update category_pages set parent_id = '${C(3)}' where id = '${C(1)}' returning 1`)), "refused");
check("best man cannot move a category", await as("bm", attempt(`update category_pages set parent_id = null where id = '${C(2)}' returning 1`)), "no-op");
check("couple can move a category", await as("couple", attempt(`update category_pages set parent_id = '${C(4)}' where id = '${C(2)}' returning 1`)), "done");

console.log("== organising comms");
check("couple reads all 4", await as("couple", count(`select 1 from org_comms`)), "4");
check("family reads venue + general (not stag, not catering)", await as("family", count(`select 1 from org_comms`)), "2");
check("best man reads all 4 (stag admin, catering allowed)", await as("bm", count(`select 1 from org_comms`)), "4");
check("maid of honour reads 3 (not the stag one)", await as("moh", count(`select 1 from org_comms`)), "3");
check("groomsman reads none", await as("groomsman", count(`select 1 from org_comms`)), "0");
check("plain wedding party reads none", await as("plain", count(`select 1 from org_comms`)), "0");
check("guest reads none", await as("guest", count(`select 1 from org_comms`)), "0");
check("family can add a note", await as("family", attempt(`insert into org_comms (subject) values ('Called florist') returning 1`)), "done");
check("family cannot add as someone else", await as("family", attempt(`insert into org_comms (subject, created_by) values ('x', '${uid.couple}') returning 1`)), "refused");
check("groomsman cannot add", await as("groomsman", attempt(`insert into org_comms (subject) values ('x') returning 1`)), "refused");
check("family cannot tag the stag option", await as("family", attempt(`insert into org_comms (subject, page_option_id) values ('x', '${O(3)}') returning 1`)), "refused");
check("family cannot delete the couple's entry", await as("family", attempt(`delete from org_comms where subject = 'General note' returning 1`)), "no-op");
check("couple can delete any entry", await as("couple", attempt(`delete from org_comms where subject = 'General note' returning 1`)), "done");
check("stag entry keeps its board tag", await as("couple", async (tx) => (await tx.query(`select board_tag from org_comms where subject = 'Stag villa email'`)).rows[0].board_tag), "groomsman");
check("nobody can hand-clear the board tag", await as("couple", async (tx) => (await tx.query(`update org_comms set board_tag = null where subject = 'Stag villa email' returning board_tag`)).rows[0].board_tag), "groomsman");
check("option tag fills in its category", await as("couple", async (tx) => (await tx.query(`select category_page_id from org_comms where subject = 'Croissant order'`)).rows[0].category_page_id), C(3));

console.log("== big day");
for (const [who, n] of [["couple", "2"], ["family", "2"], ["bm", "2"], ["groomsman", "2"], ["plain", "2"], ["guest", "0"]]) {
  check(`${who} sees items (unpublished)`, await as(who, count(`select 1 from big_day_items`)), n);
}
check("family can add an item", await as("family", attempt(`insert into big_day_items (title, day) values ('Lunch', '2028-07-08') returning 1`)), "done");
check("groomsman cannot add an item", await as("groomsman", attempt(`insert into big_day_items (title, day) values ('x', '2028-07-08') returning 1`)), "refused");
check("plain cannot edit an item", await as("plain", attempt(`update big_day_items set title = 'x' returning 1`)), "no-op");
check("best man can change the dates", await as("bm", attempt(`update big_day_settings set end_date = '2028-07-11' returning 1`)), "done");
check("best man cannot publish", await as("bm", attempt(`update big_day_settings set published = true returning 1`)), "refused");
check("guest cannot change settings", await as("guest", attempt(`update big_day_settings set end_date = '2028-07-11' returning 1`)), "no-op");
check("couple can publish", await as("couple", attempt(`update big_day_settings set published = true returning 1`)), "done");
await db.exec(`update big_day_settings set published = true`);
check("guest sees only the ticked item once published", await as("guest", count(`select 1 from big_day_items`)), "1");
check("signed-out sees nothing", await as(null, count(`select 1 from big_day_items`)), "0");

console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
