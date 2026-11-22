// Family tasks (0054) and push subscriptions (0055).
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

const P = { family: ["family", "{}"], couple2: ["couple", "{}"], couple: ["couple", "{}"], bm: ["wedding_party", "{best_man}"], moh: ["wedding_party", "{maid_of_honour}"], groomsman: ["wedding_party", "{groomsman}"], bridesmaid: ["wedding_party", "{bridesmaid}"] };
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



const fam = (sql, p) => tryQ("family", sql, p);
let r = await fam(`insert into tasks (title) values ('Book the band') returning id`);
check("family can add a main task", !r.error && r.rows?.length === 1);
r = await fam(`update tasks set status = 'done' where title = 'Book the band' returning id`);
check("family can tick a main task", r.rows?.length === 1);
r = await fam(`delete from tasks where title = 'Book the band' returning id`);
check("family cannot delete a task", !r.rows || r.rows.length === 0);
r = await fam(`insert into tasks (title, visible_tag) values ('x', 'groomsman') returning id`);
check("family cannot add to a stag board", !!r.error || (r.rows?.length ?? 0) === 0);

r = await tryQ("bm", `insert into push_subscriptions (endpoint, p256dh, auth) values ('https://push.example/a', 'k', 'a') returning id`);
check("someone can register their own device", !r.error && r.rows?.length === 1);
r = await tryQ("groomsman", `select count(*)::int n from push_subscriptions`);
check("others cannot see it", r.rows?.[0]?.n === 0);
r = await tryQ("groomsman", `update push_subscriptions set prefs = '{"x": false}' returning id`);
check("others cannot change it", !r.rows || r.rows.length === 0);
r = await tryQ("bm", `update push_subscriptions set prefs = '{"winner_chosen": false}' returning id`);
check("you can change your own preferences", r.rows?.length === 1);

console.log(failures ? failures + " FAILED" : "All passed");
process.exit(failures ? 1 : 0);
