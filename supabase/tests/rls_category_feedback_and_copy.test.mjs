// Votes/comments on categories (0049) and the stag -> hen copy (0050).
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
const copyFile = files.find((f) => f.startsWith("0050"));
// 0050 was a one-off copy that ran on the live site before the multi-wedding
// change (0056), so it is tested against the database as it was then.
for (const f of files.filter((f) => f !== copyFile && f < "0056")) {
  try { await db.exec(fs.readFileSync(path.join(MIG, f), "utf8")); }
  catch (e) { console.log("MIGRATION FAILED:", f, e.message); process.exit(1); }
}

const P = { couple: ["couple", "{}"], bm: ["wedding_party", "{best_man}"], moh: ["wedding_party", "{maid_of_honour}"], groomsman: ["wedding_party", "{groomsman}"], bridesmaid: ["wedding_party", "{bridesmaid}"] };
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

// Feedback on a category
let r = await tryQ("groomsman", `insert into reactions (target_type, target_id, value) values ('category', $1, 1) returning id`, [C(2)]);
check("groomsman can vote on a stag category", !r.error && r.rows?.length === 1);
r = await tryQ("groomsman", `insert into comments (target_type, target_id, body) values ('category', $1, 'Love Porto') returning id`, [C(2)]);
check("groomsman can comment on a stag category", !r.error && r.rows?.length === 1);
r = await tryQ("bridesmaid", `select count(*)::int n from comments where target_type='category' and target_id=$1`, [C(2)]);
check("bridesmaid cannot see stag category comments", r.rows?.[0]?.n === 0);
r = await tryQ("bridesmaid", `insert into reactions (target_type, target_id, value) values ('category', $1, 1) returning id`, [C(2)]);
check("bridesmaid cannot vote on a stag category", !!r.error);
const cid = (await db.query(`select id from comments where target_type='category' limit 1`)).rows[0].id;
r = await tryQ("bm", `delete from comments where id=$1 returning id`, [cid]);
check("best man can moderate comments on the stag board", r.rows?.length === 1);
r = await tryQ("moh", `delete from comments where id=$1 returning id`, [cid]);
check("maid of honour cannot moderate the stag board", !r.rows || r.rows.length === 0);

// Copy
await db.exec(fs.readFileSync(path.join(MIG, copyFile), "utf8"));
const cats = (await db.query(`select title, slug, parent_id, option_kind, latitude, board_tag from category_pages where board_tag='bridesmaid' order by title`)).rows;
check("three categories copied to the bridesmaid board", cats.length === 3);
check("Stag renamed Hen", cats.some((c) => c.title === "Hen") && cats.some((c) => c.slug === "hen"));
check("pin and kind carried over", cats.some((c) => c.latitude === 41.15) && cats.some((c) => c.option_kind === "stay"));
const copied = (await db.query(`select po.name, po.is_winner, po.nights, c.actual_cost, (select count(*)::int from page_option_images i where i.page_option_id=po.id) imgs, (select count(*)::int from option_cost_items i where i.page_option_id=po.id) items
  from page_options po join option_groups g on g.id=po.option_group_id join category_pages cp on cp.id=g.category_page_id join page_option_costs c on c.page_option_id=po.id where cp.board_tag='bridesmaid'`)).rows;
check("option copied with price, winner, image and cost line", copied.length === 1 && Number(copied[0].actual_cost) === 350 && copied[0].is_winner && copied[0].imgs === 1 && copied[0].items === 1);
check("original untouched", (await db.query(`select count(*)::int n from category_pages where board_tag='groomsman'`)).rows[0].n === 3 && (await db.query(`select count(*)::int n from page_options`)).rows[0].n === 2);
await db.exec(fs.readFileSync(path.join(MIG, copyFile), "utf8"));
check("running it twice copies nothing more", (await db.query(`select count(*)::int n from category_pages where board_tag='bridesmaid'`)).rows[0].n === 3);

console.log(failures ? `\n${failures} FAILED` : "\nAll passed");
process.exit(failures ? 1 : 0);
