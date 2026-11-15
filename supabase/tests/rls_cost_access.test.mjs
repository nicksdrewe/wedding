// Cost-access RLS test: replay 0001-0030, seed realistic data using the OLD
// cost columns, apply 0031, check every persona; then apply 0032 and re-check.
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

await migrate("0001", "0030");

// ---------------------------------------------------------------- seed
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
  await db.query(`insert into contacts (full_name, email, role, tags) values ($1, $2, $3, $4)`, [
    name, `${name}@test.local`, role, tags,
  ]);
  const r = await db.query(`insert into auth.users (email) values ($1) returning id`, [`${name}@test.local`]);
  uid[name] = r.rows[0].id;
}
const prof = await db.query(`select p.role, c.full_name from profiles p join contacts c on c.id = p.contact_id order by 2`);
console.log("profiles:", prof.rows.map((r) => `${r.full_name}=${r.role}`).join(" "));

await db.exec(`
  insert into category_pages (id, slug, title) values
    ('00000000-0000-0000-0000-00000000c001', 'venue', 'Venue'),
    ('00000000-0000-0000-0000-00000000c002', 'suits', 'Suits');
  insert into page_registry (page_key, parent_page_key, label, default_min_role) values
    ('categories:venue', 'categories', 'Venue', 'family'),
    ('categories:suits', 'categories', 'Suits', 'family')
  on conflict do nothing;
  insert into option_groups (id, category_page_id, title, visible_tag) values
    ('00000000-0000-0000-0000-0000000a0001', '00000000-0000-0000-0000-00000000c001', 'Venue', null),
    ('00000000-0000-0000-0000-0000000a0002', '00000000-0000-0000-0000-00000000c002', 'Suits', null),
    ('00000000-0000-0000-0000-0000000a0003', null, 'Standalone', null),
    ('00000000-0000-0000-0000-0000000a0004', null, 'Stag do', 'groomsman'),
    ('00000000-0000-0000-0000-0000000a0005', null, 'Hen do', 'bridesmaid');
  insert into page_options (id, option_group_id, name, predicted_cost_min, predicted_cost_max, actual_cost, currency) values
    ('00000000-0000-0000-0000-0000000b0001', '00000000-0000-0000-0000-0000000a0001', 'Chateau', 20000, 25000, null, 'EUR'),
    ('00000000-0000-0000-0000-0000000b0002', '00000000-0000-0000-0000-0000000a0002', 'Tailor', 900, 1200, 1000, 'GBP'),
    ('00000000-0000-0000-0000-0000000b0003', '00000000-0000-0000-0000-0000000a0003', 'Band', 500, 800, null, 'GBP'),
    ('00000000-0000-0000-0000-0000000b0004', '00000000-0000-0000-0000-0000000a0004', 'Stag villa', 3000, 4000, null, 'GBP'),
    ('00000000-0000-0000-0000-0000000b0005', '00000000-0000-0000-0000-0000000a0005', 'Hen spa', 1500, 2000, null, 'GBP');
  insert into option_cost_items (id, page_option_id, name, kind, amount) values
    ('00000000-0000-0000-0000-0000000d0001', '00000000-0000-0000-0000-0000000b0001', 'Food', 'cost', 5000),
    ('00000000-0000-0000-0000-0000000d0004', '00000000-0000-0000-0000-0000000b0004', 'Boat', 'cost', 600);
  insert into category_costs (category_page_id, predicted_cost_min, predicted_cost_max, currency) values
    ('00000000-0000-0000-0000-00000000c001', 25000, 30000, 'EUR'),
    ('00000000-0000-0000-0000-00000000c002', 900, 1200, 'GBP');
  insert into cost_item_links (source_cost_item_id, linked_category_page_id) values
    ('00000000-0000-0000-0000-0000000d0001', '00000000-0000-0000-0000-00000000c002');
`);

await migrate("0031", "0031");

// The couple opts best man in to SUITS prices only (what Roles & Access does).
await db.exec(`
  insert into page_permissions (page_key, principal_type, principal_value, page_access, data_access, edit_access, cost_access)
  values ('categories:suits', 'tag', 'best_man', true, true, true, true);
`);

// ---------------------------------------------------------------- helpers
async function as(name, fn) {
  return db.transaction(async (tx) => {
    await tx.query(`select set_config('request.jwt.claim.sub', $1, true)`, [name ? uid[name] : ""]);
    await tx.exec(`set local role authenticated`);
    const out = await fn(tx);
    await tx.rollback();
    return out;
  });
}
const names = async (tx, sql) => (await tx.query(sql)).rows.map((r) => r.n).sort().join(",");
const Q = {
  optionRows: `select name as n from page_options`,
  optionCosts: `select po.name as n from page_option_costs c join page_options po on po.id = c.page_option_id`,
  // cost rows fetched WITHOUT joining page_options, so a hidden option row can't mask a leaked cost row
  rawCostCount: `select count(*)::text as n from page_option_costs`,
  // by id suffix, not by joining category_pages (which non-family can't read yet and would mask the result)
  categoryCosts: `select case right(category_page_id::text, 1) when '1' then 'venue' else 'suits' end as n from category_costs`,
  rawCategoryCostCount: `select count(*)::text as n from category_costs`,
  items: `select name as n from option_cost_items`,
  links: `select count(*)::text as n from cost_item_links`,
};
function check(label, got, want) {
  const ok = got === want;
  if (!ok) failures++;
  console.log(`${ok ? "  ok  " : "  FAIL"} ${label}: ${JSON.stringify(got)}${ok ? "" : `  (wanted ${JSON.stringify(want)})`}`);
}
async function matrix(stage) {
  console.log(`\n== ${stage}`);
  const want = {
    //            optionCosts                              rawCost categoryCosts   rawCat items        links
    couple:    ["Band,Chateau,Hen spa,Stag villa,Tailor", "5",    "suits,venue",  "2",   "Boat,Food", "1"],
    family:    ["Band,Chateau,Tailor",                    "3",    "suits,venue",  "2",   "Food",      "1"],
    bm:        ["Stag villa",                             "1",    "suits",        "1",   "Boat",      "0"],
    moh:       ["Hen spa",                                "1",    "",             "0",   "",          "0"],
    groomsman: ["",                                       "0",    "",             "0",   "",          "0"],
    plain:     ["",                                       "0",    "",             "0",   "",          "0"],
    guest:     ["",                                       "0",    "",             "0",   "",          "0"],
    [""]:      ["",                                       "0",    "",             "0",   "",          "0"],
  };
  for (const [who, w] of Object.entries(want)) {
    const got = await as(who || null, async (tx) => [
      await names(tx, Q.optionCosts),
      await names(tx, Q.rawCostCount),
      await names(tx, Q.categoryCosts),
      await names(tx, Q.rawCategoryCostCount),
      await names(tx, Q.items),
      await names(tx, Q.links),
    ]);
    check(`${(who || "anonymous").padEnd(9)} sees`, got.join(" | "), w.join(" | "));
  }
}

await matrix("after 0031 (old columns still present)");

console.log("\n== option ROWS stay visible where prices are hidden");
check("groomsman option rows", await as("groomsman", (tx) => names(tx, Q.optionRows)), "Band,Stag villa");
check("bm option rows", await as("bm", (tx) => names(tx, Q.optionRows)), "Band,Stag villa");

console.log("\n== writes");
const upd = (id) => `update page_option_costs set actual_cost = 1 where page_option_id = '00000000-0000-0000-0000-0000000b000${id}' returning 1`;
const count = async (tx, sql) => String((await tx.query(sql)).rows.length);
check("bm edits stag villa price (allowed)", await as("bm", (tx) => count(tx, upd(4))), "1");
check("bm edits standalone Band price (hidden -> refused)", await as("bm", (tx) => count(tx, upd(3))), "0");
check("bm edits venue price (refused)", await as("bm", (tx) => count(tx, upd(1))), "0");
check("bm edits suits price (sees it, but can't manage category options yet)", await as("bm", (tx) => count(tx, upd(2))), "0");
check("groomsman edits stag villa price (refused)", await as("groomsman", (tx) => count(tx, upd(4))), "0");
check("moh edits stag villa price (refused)", await as("moh", (tx) => count(tx, upd(4))), "0");
check("family edits venue price (refused: read-only)", await as("family", (tx) => count(tx, upd(1))), "0");
check("couple edits venue price", await as("couple", (tx) => count(tx, upd(1))), "1");
for (const who of ["bm", "family", "guest"]) {
  const r = await as(who, async (tx) => {
    try {
      await tx.query(`insert into page_option_costs (page_option_id) values ('00000000-0000-0000-0000-0000000b0001')`);
      return "inserted";
    } catch (e) { return "refused"; }
  });
  check(`${who} cannot insert a cost row`, r, "refused");
  const d = await as(who, (tx) => count(tx, `delete from page_option_costs returning 1`));
  check(`${who} cannot delete cost rows`, d, "0");
}
check("groomsman adds a cost line to stag villa (refused)", await as("groomsman", async (tx) => {
  try { await tx.query(`insert into option_cost_items (page_option_id, name, kind, amount) values ('00000000-0000-0000-0000-0000000b0004','x','cost',1)`); return "inserted"; } catch { return "refused"; }
}), "refused");
check("bm adds a cost line to stag villa (allowed)", await as("bm", async (tx) => {
  try { await tx.query(`insert into option_cost_items (page_option_id, name, kind, amount) values ('00000000-0000-0000-0000-0000000b0004','x','cost',1)`); return "inserted"; } catch { return "refused"; }
}), "inserted");
check("bm adds a cost line to venue (refused)", await as("bm", async (tx) => {
  try { await tx.query(`insert into option_cost_items (page_option_id, name, kind, amount) values ('00000000-0000-0000-0000-0000000b0001','x','cost',1)`); return "inserted"; } catch { return "refused"; }
}), "refused");

console.log("\n== un-normalised tag still resolves; deny wins across tags");
await db.exec(`update contacts set tags = '{"Best Man"}' where full_name = 'bm'`);
check("bm with tag 'Best Man' still resolves cost rules (suits total)", await as("bm", (tx) => names(tx, Q.categoryCosts)), "suits");
await db.exec(`update contacts set tags = '{best_man,groomsman}' where full_name = 'bm'`);
check("bm also tagged groomsman (groomsman rule denies costs)", await as("bm", (tx) => names(tx, Q.optionCosts)), "");
await db.exec(`update contacts set tags = '{best_man}' where full_name = 'bm'`);

console.log("\n== temporary mirror trigger (old app still writing old columns)");
await db.exec(`update page_options set actual_cost = 777 where id = '00000000-0000-0000-0000-0000000b0003'`);
check("old-column write mirrored", (await db.query(`select actual_cost::text as n from page_option_costs where page_option_id = '00000000-0000-0000-0000-0000000b0003'`)).rows[0].n, "777.00");
await db.exec(`insert into page_options (id, option_group_id, name, predicted_cost_min, currency) values ('00000000-0000-0000-0000-0000000b0009', '00000000-0000-0000-0000-0000000a0003', 'Temp', 42, 'EUR')`);
check("old-style insert creates cost row", (await db.query(`select predicted_cost_min::text || currency as n from page_option_costs where page_option_id = '00000000-0000-0000-0000-0000000b0009'`)).rows[0]?.n, "42.00EUR");
await db.exec(`delete from page_options where id = '00000000-0000-0000-0000-0000000b0009'`);
check("cost row cascades with its option", (await db.query(`select count(*)::text as n from page_option_costs where page_option_id = '00000000-0000-0000-0000-0000000b0009'`)).rows[0].n, "0");
await db.exec(`update page_options set actual_cost = null where id = '00000000-0000-0000-0000-0000000b0003'`);

console.log("\n== preview of step 3: if best man could read category option rows, would prices leak?");
await db.exec(`create policy "TEST step3 preview" on page_options for select using (auth.uid() is not null)`);
check("bm option rows (all visible now)", await as("bm", (tx) => names(tx, Q.optionRows)), "Band,Chateau,Hen spa,Stag villa,Tailor");
check("bm prices (stag villa + suits he was opted into; no venue, no hen, no band)", await as("bm", (tx) => names(tx, Q.optionCosts)), "Stag villa,Tailor");
check("guest prices (still none)", await as("guest", (tx) => names(tx, Q.optionCosts)), "");
check("groomsman prices (still none)", await as("groomsman", (tx) => names(tx, Q.optionCosts)), "");
let oldColLeak;
try {
  oldColLeak = await as("bm", (tx) => names(tx, `select name || ':' || coalesce(predicted_cost_min::text,'null') as n from page_options where name = 'Chateau'`));
} catch (e) { oldColLeak = "column gone"; }
console.log(`  note  before 0032, bm reading the OLD column on Chateau gets: ${oldColLeak}  <- why 0032 must precede step 3`);
await db.exec(`drop policy "TEST step3 preview" on page_options`);

await migrate("0032", "0032");
await matrix("after 0032 (old columns dropped)");

console.log("\n== after 0032");
const cols = (await db.query(`select column_name as n from information_schema.columns where table_name = 'page_options' and column_name in ('predicted_cost_min','predicted_cost_max','actual_cost','currency')`)).rows.length;
check("old price columns remaining on page_options", String(cols), "0");
check("couple adds an option -> empty cost row appears", await as("couple", async (tx) => {
  await tx.query(`insert into page_options (id, option_group_id, name) values ('00000000-0000-0000-0000-0000000b0010', '00000000-0000-0000-0000-0000000a0001', 'New')`);
  return String((await tx.query(`select 1 from page_option_costs where page_option_id = '00000000-0000-0000-0000-0000000b0010'`)).rows.length);
}), "1");
check("plain wedding party adds a standalone option (no price access) -> succeeds, cost row made for them unseen", await as("plain", async (tx) => {
  await tx.query(`insert into page_options (id, option_group_id, name) values ('00000000-0000-0000-0000-0000000b0011', '00000000-0000-0000-0000-0000000a0003', 'Idea')`);
  return String((await tx.query(`select 1 from page_option_costs where page_option_id = '00000000-0000-0000-0000-0000000b0011'`)).rows.length);
}), "0");

console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
