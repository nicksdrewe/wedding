// Planner-access RLS test: replay 0001-0032, seed, apply 0033 onwards, check every persona's
// reads and writes on category/option/contact/date/cost tables.
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
  create role service_role nologin bypassrls; -- exists on Supabase; later migrations grant to it
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
async function migrate(from, to) {
  for (const f of files) {
    const n = f.slice(0, 4);
    if (n < from || n > to) continue;
    try {
      await db.exec(fs.readFileSync(path.join(MIG, f), "utf8"));
    } catch (e) {
      console.log("MIGRATION FAILED:", f, "\n ", e.message);
      process.exit(1);
    }
  }
  console.log(`-- applied ${from}..${to}`);
}

await migrate("0001", "0032");

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

const C1 = "00000000-0000-0000-0000-00000000c001", C2 = "00000000-0000-0000-0000-00000000c002";
const G = (n) => `00000000-0000-0000-0000-0000000a000${n}`;
const O = (n) => `00000000-0000-0000-0000-0000000b00${String(n).padStart(2, "0")}`;
await db.exec(`
  insert into category_pages (id, slug, title) values ('${C1}', 'venue', 'Venue'), ('${C2}', 'suits', 'Suits');
  insert into page_registry (page_key, parent_page_key, label, default_min_role) values
    ('categories:venue', 'categories', 'Venue', 'family'), ('categories:suits', 'categories', 'Suits', 'family')
  on conflict do nothing;
  insert into option_groups (id, category_page_id, title, visible_tag) values
    ('${G(1)}', '${C1}', 'Venue', null), ('${G(2)}', '${C2}', 'Suits', null),
    ('${G(3)}', null, 'Standalone', null), ('${G(4)}', null, 'Stag do', 'groomsman'), ('${G(5)}', null, 'Hen do', 'bridesmaid');
  insert into page_options (id, option_group_id, name) values
    ('${O(1)}', '${G(1)}', 'Chateau'), ('${O(2)}', '${G(2)}', 'Tailor'), ('${O(3)}', '${G(3)}', 'Band'),
    ('${O(4)}', '${G(4)}', 'Stag villa'), ('${O(5)}', '${G(5)}', 'Hen spa');
  update page_option_costs set predicted_cost_min = 100, predicted_cost_max = 200;
  insert into page_option_images (page_option_id, image_url, sort_order)
    select id, name || '.jpg', 0 from page_options;
  insert into category_costs (category_page_id, predicted_cost_min, predicted_cost_max) values ('${C1}', 1, 2), ('${C2}', 3, 4);
  insert into category_contacts (category_page_id, name) values ('${C1}', 'Venue manager'), ('${C2}', 'Tailor Tom');
  insert into diary_entries (title, entry_date, source, category_page_id) values
    ('Venue deposit', '2027-01-01', 'category_page', '${C1}'), ('Suit fitting', '2027-02-01', 'category_page', '${C2}'),
    ('Free note', '2027-03-01', 'manual', null);
  -- the couple opts best man in to SUITS prices only
  insert into page_permissions (page_key, principal_type, principal_value, page_access, data_access, edit_access, cost_access)
    values ('categories:suits', 'tag', 'best_man', true, true, true, true);
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
const list = async (tx, sql) => (await tx.query(sql)).rows.map((r) => r.n).sort().join(",");
function check(label, got, want) {
  const ok = got === want;
  if (!ok) failures++;
  console.log(`${ok ? "  ok  " : "  FAIL"} ${label}: ${JSON.stringify(got)}${ok ? "" : `  (wanted ${JSON.stringify(want)})`}`);
}
const READS = {
  categories: `select slug as n from category_pages`,
  options: `select name as n from page_options`,
  images: `select image_url as n from page_option_images`,
  contacts: `select name as n from category_contacts`,
  dates: `select title as n from diary_entries`,
  optionPrices: `select po.name as n from page_option_costs c join page_options po on po.id = c.page_option_id`,
  rawPriceRows: `select count(*)::text as n from page_option_costs`,
  categoryTotals: `select case category_page_id when '${C1}' then 'venue' else 'suits' end as n from category_costs`,
};
async function readMatrix(title, want) {
  console.log(`\n== ${title}`);
  for (const [who, w] of Object.entries(want)) {
    const got = await as(who === "anonymous" ? null : who, async (tx) => {
      const out = {};
      for (const [k, sql] of Object.entries(READS)) out[k] = await list(tx, sql);
      return out;
    });
    for (const k of Object.keys(READS)) check(`${who.padEnd(9)} ${k.padEnd(14)}`, got[k], w[k]);
  }
}
const none = { categories: "", options: "", images: "", contacts: "", dates: "", optionPrices: "", rawPriceRows: "0", categoryTotals: "" };

if (LAST >= "0033") await migrate("0033", LAST);
// From 0034 a plain groomsman can no longer pick the stag winner (project admins only).
const memberPicksWinner = LAST >= "0034" ? "no-op" : "done";

await readMatrix("reads after 0033", {
  couple: { categories: "suits,venue", options: "Band,Chateau,Hen spa,Stag villa,Tailor", images: "Band.jpg,Chateau.jpg,Hen spa.jpg,Stag villa.jpg,Tailor.jpg", contacts: "Tailor Tom,Venue manager", dates: "Free note,Suit fitting,Venue deposit", optionPrices: "Band,Chateau,Hen spa,Stag villa,Tailor", rawPriceRows: "5", categoryTotals: "suits,venue" },
  family: { categories: "suits,venue", options: "Band,Chateau,Tailor", images: "Band.jpg,Chateau.jpg,Tailor.jpg", contacts: "Tailor Tom,Venue manager", dates: "Free note,Suit fitting,Venue deposit", optionPrices: "Band,Chateau,Tailor", rawPriceRows: "3", categoryTotals: "suits,venue" },
  bm: { categories: "suits,venue", options: "Band,Chateau,Stag villa,Tailor", images: "Band.jpg,Chateau.jpg,Stag villa.jpg,Tailor.jpg", contacts: "Tailor Tom,Venue manager", dates: "Free note,Suit fitting,Venue deposit", optionPrices: "Stag villa,Tailor", rawPriceRows: "2", categoryTotals: "suits" },
  moh: { categories: "suits,venue", options: "Band,Chateau,Hen spa,Tailor", images: "Band.jpg,Chateau.jpg,Hen spa.jpg,Tailor.jpg", contacts: "Tailor Tom,Venue manager", dates: "Free note,Suit fitting,Venue deposit", optionPrices: "Hen spa", rawPriceRows: "1", categoryTotals: "" },
  groomsman: { ...none, options: "Stag villa", images: "Stag villa.jpg" },
  plain: none,
  guest: none,
  anonymous: none,
});

console.log("\n== writes");
const tryRun = async (tx, sql) => {
  try {
    await tx.exec("savepoint s");
    const r = await tx.query(sql);
    return r.rows.length > 0 || (r.affectedRows ?? 0) > 0 ? "done" : "no-op";
  } catch (e) {
    await tx.exec("rollback to savepoint s");
    return "refused";
  }
};
const W = {
  addOptionVenue: `insert into page_options (option_group_id, name) values ('${G(1)}', 'New venue') returning 1`,
  editOptionVenue: `update page_options set description = 'x' where id = '${O(1)}' returning 1`,
  deleteOptionVenue: `delete from page_options where id = '${O(1)}' returning 1`,
  winnerVenue: `update page_options set is_winner = true where id = '${O(1)}' returning 1`,
  addPhotoVenue: `insert into page_option_images (page_option_id, image_url, sort_order) values ('${O(1)}', 'n.jpg', 1) returning 1`,
  removePhotoVenue: `delete from page_option_images where page_option_id = '${O(1)}' returning 1`,
  addContactVenue: `insert into category_contacts (category_page_id, name) values ('${C1}', 'N') returning 1`,
  editContactVenue: `update category_contacts set phone = '1' where category_page_id = '${C1}' returning 1`,
  deleteContactVenue: `delete from category_contacts where category_page_id = '${C1}' returning 1`,
  addDateVenue: `insert into diary_entries (title, entry_date, source, category_page_id) values ('d', '2027-05-05', 'category_page', '${C1}') returning 1`,
  deleteDateVenue: `delete from diary_entries where category_page_id = '${C1}' returning 1`,
  addFreeDiary: `insert into diary_entries (title, entry_date, source) values ('d', '2027-05-05', 'manual') returning 1`,
  renameCategory: `update category_pages set title = 'X' where id = '${C1}' returning 1`,
  deleteCategory: `delete from category_pages where id = '${C1}' returning 1`,
  createCategory: `insert into category_pages (slug, title) values ('new', 'New') returning 1`,
  priceVenueOption: `update page_option_costs set actual_cost = 9 where page_option_id = '${O(1)}' returning 1`,
  priceSuitsOption: `update page_option_costs set actual_cost = 9 where page_option_id = '${O(2)}' returning 1`,
  totalVenue: `update category_costs set actual_cost = 9 where category_page_id = '${C1}' returning 1`,
  totalSuits: `update category_costs set actual_cost = 9 where category_page_id = '${C2}' returning 1`,
  addOptionStandalone: `insert into page_options (option_group_id, name) values ('${G(3)}', 'S') returning 1`,
  deleteOptionStandalone: `delete from page_options where id = '${O(3)}' returning 1`,
  addOptionStag: `insert into page_options (option_group_id, name) values ('${G(4)}', 'S') returning 1`,
  addOptionHen: `insert into page_options (option_group_id, name) values ('${G(5)}', 'S') returning 1`,
  winnerStag: `update page_options set is_winner = true where id = '${O(4)}' returning 1`,
};
const D = "done", R = "refused", N = "no-op";
const wantWrites = {
  //            addOpt editOpt delOpt winV addPh rmPh addCon editCon delCon addDate delDate freeD rename delCat newCat priceV priceS totV totS addStd delStd addStag addHen winStag
  couple:    [D, D, D, D, D, D, D, D, D, D, D, D, D, D, D, D, D, D, D, D, D, D, D, D],
  family:    [R, N, N, N, R, N, R, N, N, R, N, R, N, N, R, N, N, N, N, R, N, R, R, N],
  bm:        [D, D, N, R, D, D, D, D, N, D, N, R, N, N, R, N, D, N, D, D, D, D, R, D],
  moh:       [D, D, N, R, D, D, D, D, N, D, N, R, N, N, R, N, N, N, N, D, D, R, D, N],
  groomsman: [R, N, N, N, R, N, R, N, N, R, N, R, N, N, R, N, N, N, N, R, N, D, R, memberPicksWinner],
  plain:     [R, N, N, N, R, N, R, N, N, R, N, R, N, N, R, N, N, N, N, R, N, R, R, N],
  guest:     [R, N, N, N, R, N, R, N, N, R, N, R, N, N, R, N, N, N, N, R, N, R, R, N],
};
const keys = Object.keys(W);
for (const [who, want] of Object.entries(wantWrites)) {
  const got = [];
  for (const k of keys) got.push(await as(who, (tx) => tryRun(tx, W[k])));
  const bad = keys.filter((k, i) => got[i] !== want[i]).map((k) => `${k}: got ${got[keys.indexOf(k)]}, wanted ${want[keys.indexOf(k)]}`);
  if (bad.length) { failures += bad.length; console.log(`  FAIL ${who}:\n        ` + bad.join("\n        ")); }
  else console.log(`  ok   ${who.padEnd(9)} all ${keys.length} write checks as expected`);
}

console.log("\n== the couple's switches in Roles & Access take real effect");
await db.exec(`insert into page_permissions (page_key, principal_type, principal_value, page_access, data_access, edit_access, cost_access)
  values ('categories:venue', 'tag', 'best_man', false, false, false, false)`);
check("venue hidden from best man: categories", await as("bm", (tx) => list(tx, READS.categories)), "suits");
check("venue hidden from best man: options", await as("bm", (tx) => list(tx, READS.options)), "Band,Stag villa,Tailor");
check("venue hidden from best man: contacts", await as("bm", (tx) => list(tx, READS.contacts)), "Tailor Tom");
check("venue hidden from best man: dates", await as("bm", (tx) => list(tx, READS.dates)), "Free note,Suit fitting");
check("venue hidden from best man: add option", await as("bm", (tx) => tryRun(tx, W.addOptionVenue)), R);
check("maid of honour unaffected", await as("moh", (tx) => list(tx, READS.categories)), "suits,venue");
await db.exec(`delete from page_permissions where page_key = 'categories:venue' and principal_value = 'best_man'`);

await db.exec(`update page_permissions set edit_access = false where page_key = 'categories:suits' and principal_value = 'best_man'`);
check("edit off on suits: best man still reads", await as("bm", (tx) => list(tx, READS.options)), "Band,Chateau,Stag villa,Tailor");
check("edit off on suits: best man can't edit option", await as("bm", (tx) => tryRun(tx, `update page_options set description='x' where id='${O(2)}' returning 1`)), N);
check("edit off on suits: best man can't change its price either", await as("bm", (tx) => tryRun(tx, W.priceSuitsOption)), N);
await db.exec(`update page_permissions set edit_access = true where page_key = 'categories:suits' and principal_value = 'best_man'`);

await db.exec(`insert into page_permissions (page_key, principal_type, principal_value, page_access, data_access, edit_access, cost_access)
  values ('categories:venue', 'role', 'family', true, true, true, true)`);
check("couple ticks Can edit for family on venue: family adds an option", await as("family", (tx) => tryRun(tx, W.addOptionVenue)), D);
check("...but family still can't on suits", await as("family", (tx) => tryRun(tx, `insert into page_options (option_group_id, name) values ('${G(2)}', 'x') returning 1`)), R);
check("...and still can't pick the winner", await as("family", (tx) => tryRun(tx, W.winnerVenue)), R);
await db.exec(`update page_permissions set page_access = false where page_key = 'categories:venue' and principal_type = 'role' and principal_value = 'family'`);
check("couple unticks Page access for family on venue: hidden", await as("family", (tx) => list(tx, READS.categories)), "suits");
await db.exec(`delete from page_permissions where page_key = 'categories:venue' and principal_type = 'role'`);

console.log("\n== tags stored un-normalised still work end to end");
await db.exec(`update contacts set tags = '{"Best Man"}' where full_name = 'bm'`);
check("bm tagged 'Best Man' sees stag board + categories", await as("bm", (tx) => list(tx, READS.options)), "Band,Chateau,Stag villa,Tailor");
await db.exec(`update contacts set tags = '{best_man}' where full_name = 'bm'`);

console.log("\n== demotion takes effect immediately");
await db.exec(`update contacts set tags = '{}' where full_name = 'bm'`);
check("bm with tag removed sees no categories", await as("bm", (tx) => list(tx, READS.categories)), "");
check("bm with tag removed sees no options", await as("bm", (tx) => list(tx, READS.options)), "");

console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
