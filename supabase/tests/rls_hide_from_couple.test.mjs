// Hiding plans, tasks and ideas from the couple (0052).
import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const MIG = fileURLToPath(new URL("../migrations/", import.meta.url));
const db = new PGlite();
let failures = 0;
const check = (name, ok) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
  if (!ok) failures++;
};

await db.exec(`
  create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
  create schema auth;
  create table auth.users (id uuid primary key default gen_random_uuid(), email text, raw_user_meta_data jsonb default '{}', last_sign_in_at timestamptz);
  create table auth.sessions (id uuid primary key default gen_random_uuid(), user_id uuid not null);
  create table auth.refresh_tokens (id bigserial primary key, user_id varchar, session_id uuid);
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth to anon, authenticated, service_role;
  grant usage on schema public to anon, authenticated, service_role;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
`);
const files = fs.readdirSync(MIG).filter((f) => f.endsWith(".sql")).sort();
for (const f of files) {
  try { await db.exec(fs.readFileSync(path.join(MIG, f), "utf8")); }
  catch (e) { console.log("MIGRATION FAILED:", f, e.message); process.exit(1); }
}

const P = { couple2: ["couple", "{}"], couple: ["couple", "{}"], bm: ["wedding_party", "{best_man}"], moh: ["wedding_party", "{maid_of_honour}"], groomsman: ["wedding_party", "{groomsman}"], bridesmaid: ["wedding_party", "{bridesmaid}"] };
const uid = {};
for (const [n, [role, tags]] of Object.entries(P)) {
  await db.query(`insert into contacts (full_name, email, role, tags) values ($1,$2,$3,$4)`, [n, `${n}@t.local`, role, tags]);
  uid[n] = (await db.query(`insert into auth.users (email) values ($1) returning id`, [`${n}@t.local`])).rows[0].id;
}
const C = (n) => `00000000-0000-0000-0000-00000000c00${n}`;
const G = (n) => `00000000-0000-0000-0000-0000000a000${n}`;
const O = (n) => `00000000-0000-0000-0000-0000000b000${n}`;
await db.exec(`
  insert into category_pages (id, slug, title, board_tag) values ('${C(1)}', 'stag', 'Stag', 'groomsman');
  insert into category_pages (id, slug, title, parent_id, latitude, longitude) values ('${C(2)}', 'porto', 'Porto', '${C(1)}', 41.15, -8.61);
  insert into category_pages (id, slug, title, parent_id, option_kind) values ('${C(3)}', 'porto-stay', 'Accommodation', '${C(2)}', 'stay');
  insert into option_groups (id, category_page_id, title) values ('${G(1)}', '${C(3)}', 'Accommodation') on conflict do nothing;
`);
const grp = (await db.query(`select id from option_groups where category_page_id='${C(3)}'`)).rows[0].id;
await db.exec(`
  insert into page_options (id, option_group_id, name, is_winner, nights) values ('${O(1)}', '${grp}', 'Villa', true, 3);
  update page_option_costs set predicted_cost_min=300, predicted_cost_max=400, actual_cost=350 where page_option_id='${O(1)}';
  insert into page_option_images (page_option_id, image_url, sort_order) values ('${O(1)}', 'http://x/y.jpg', 0);
  insert into option_cost_items (page_option_id, name, kind, amount) values ('${O(1)}', 'Taxi', 'cost', 40);
`);

async function as(name, fn) {
  return db.transaction(async (tx) => {
    await tx.query(`select set_config('request.jwt.claim.sub', $1, true)`, [uid[name]]);
    await tx.exec(`set local role authenticated`);
    return fn(tx);
  });
}
const tryQ = async (name, sql, params) => { try { return await as(name, (tx) => tx.query(sql, params)); } catch (e) { return { error: e.message }; } };


await db.exec(`
  insert into tasks (title, visible_tag) values ('Book strippers', 'groomsman'), ('Shared task', 'groomsman');
  insert into idea_boards (title, tier, visible_tag) values ('Secret idea', 'wedding_party', 'groomsman');
`);
const bm = (sql, p) => tryQ("bm", sql, p);
const cp = (sql, p) => tryQ("couple", sql, p);

let r = await cp(`update category_pages set hidden_from_couple = true where id = $1 returning id`, [C(1)]);
check("couple cannot hide things", !!r.error || (r.rows?.length ?? 0) === 0);
r = await tryQ("groomsman", `update category_pages set hidden_from_couple = true where id = $1 returning id`, [C(1)]);
check("a plain groomsman cannot hide things", !!r.error || (r.rows?.length ?? 0) === 0);
r = await bm(`update category_pages set hidden_from_couple = true where id = $1 returning id`, [C(1)]);
check("best man can hide Stag", !r.error && r.rows?.length === 1);

r = await cp(`select title from category_pages order by title`);
check("couple still sees the name Stag", r.rows?.some((x) => x.title === "Stag"));
check("couple cannot see Porto or Accommodation", !r.rows?.some((x) => x.title === "Porto" || x.title === "Accommodation"));
r = await cp(`select count(*)::int n from page_options`);
check("couple cannot see options inside", r.rows?.[0]?.n === 0);
r = await cp(`select count(*)::int n from page_option_costs`);
check("couple cannot see prices inside", r.rows?.[0]?.n === 0);
r = await cp(`update category_pages set title = 'Mine' where id = $1 returning id`, [C(1)]);
check("couple cannot rename or edit a hidden plan", !r.rows || r.rows.length === 0);
r = await cp(`delete from category_pages where id = $1 returning id`, [C(1)]);
check("couple cannot delete a hidden plan", !r.rows || r.rows.length === 0);
r = await bm(`select count(*)::int n from category_pages`);
check("best man still sees everything", r.rows?.[0]?.n === 3);
r = await tryQ("groomsman", `select count(*)::int n from page_options`);
check("groomsmen still see the options", r.rows?.[0]?.n === 1);

r = await bm(`update tasks set hidden_from_couple = true where title = 'Book strippers' returning id`);
check("best man can hide a task", r.rows?.length === 1);
r = await cp(`select title from tasks`);
check("couple cannot see the hidden task but sees the other", r.rows?.length === 1 && r.rows[0].title === "Shared task");
r = await bm(`update idea_boards set hidden_from_couple = true returning id`);
check("best man can hide an idea", r.rows?.length === 1);
r = await cp(`select count(*)::int n from idea_boards`);
check("couple cannot see the hidden idea", r.rows?.[0]?.n === 0);

r = await bm(`update category_pages set hidden_from_couple = false where id = $1 returning id`, [C(1)]);
check("best man can unhide", r.rows?.length === 1);
r = await cp(`select count(*)::int n from category_pages`);
check("couple sees everything again", r.rows?.[0]?.n === 3);

console.log(failures ? failures + " FAILED" : "All passed");
process.exit(failures ? 1 : 0);
