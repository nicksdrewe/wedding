// Two weddings in one database (0056): nothing leaks between them, one login
// can belong to both with a different role in each, and helpers that look
// things up by name stay inside the current wedding.
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
for (const f of fs.readdirSync(MIG).filter((f) => f.endsWith(".sql")).sort()) {
  try { await db.exec(fs.readFileSync(path.join(MIG, f), "utf8")); }
  catch (e) { console.log("MIGRATION FAILED:", f, e.message); process.exit(1); }
}

// Example content (0062): on fills a wedding with a made-up plan, off removes
// exactly that, and nothing real or in another wedding is touched.
const A = (await db.query(`select id from weddings where slug = 'nickellie'`)).rows[0].id;
const B = (await db.query(`insert into weddings (slug, partner_one, partner_two, display_name) values ('jonsarah','Jon','Sarah','Jon & Sarah') returning id`)).rows[0].id;
await db.query(`select fn_seed_wedding($1, $2)`, [B, A]);
await db.query(`select set_config('app.wedding_id', $1, false)`, [B]);
await db.exec(`insert into category_pages (slug, title) values ('venue', 'Our real venue'); insert into tasks (title) values ('A real task');`);
await db.query(`select set_config('app.wedding_id', $1, false)`, [A]);
await db.exec(`insert into tasks (title) values ('Nick and Ellie real task')`);

const count = async (w, sql) => (await db.query(`select count(*)::int n from ${sql} and wedding_id = $1`, [w])).rows[0].n;
const snapshot = async (w) => ({
  cats: await count(w, `category_pages where true`),
  opts: await count(w, `page_options where true`),
  tasks: await count(w, `tasks where true`),
  diary: await count(w, `diary_entries where true`),
  day: await count(w, `big_day_items where true`),
  comments: await count(w, `comments where true`),
  reg: await count(w, `page_registry where true`),
  costs: await count(w, `page_option_costs where true`),
});
const beforeB = await snapshot(B);
const beforeA = await snapshot(A);

await db.query(`select fn_set_examples($1, true)`, [B]);
const on = await snapshot(B);
check("examples add categories, options, costs, tasks, diary, the day and comments",
  on.cats - beforeB.cats === 10 && on.opts - beforeB.opts === 13 && on.costs > beforeB.costs && on.tasks - beforeB.tasks === 4 &&
  on.diary - beforeB.diary === 3 && on.day - beforeB.day === 5 && on.comments - beforeB.comments === 5);
check("winners are chosen and map pins set", (await db.query(`select count(*)::int n from page_options where wedding_id = $1 and is_winner`, [B])).rows[0].n === 4 &&
  (await db.query(`select count(*)::int n from page_options where wedding_id = $1 and latitude is not null`, [B])).rows[0].n === 5);
check("example comments keep their made-up authors", (await db.query(`select author_name from comments where wedding_id = $1 and body like 'The gardens%'`, [B])).rows[0]?.author_name === "Mum");
check("the wedding remembers the switch is on", (await db.query(`select show_examples from weddings where id = $1`, [B])).rows[0].show_examples === true);
check("another wedding is untouched", JSON.stringify(await snapshot(A)) === JSON.stringify(beforeA));

await db.query(`select fn_set_examples($1, true)`, [B]);
check("switching on twice doesn't double up", JSON.stringify(await snapshot(B)) === JSON.stringify(on));

await db.query(`select fn_set_examples($1, false)`, [B]);
check("switching off removes every example and nothing else", JSON.stringify(await snapshot(B)) === JSON.stringify(beforeB));
check("real plans survive", (await db.query(`select count(*)::int n from category_pages where wedding_id = $1 and title = 'Our real venue'`, [B])).rows[0].n === 1 &&
  (await db.query(`select count(*)::int n from tasks where wedding_id = $1 and title = 'A real task'`, [B])).rows[0].n === 1);
check("the switch is off", (await db.query(`select show_examples from weddings where id = $1`, [B])).rows[0].show_examples === false);

const denied = await db.transaction(async (tx) => { await tx.exec(`set local role authenticated`); return tx.query(`select fn_set_examples($1, true)`, [B]); }).then(() => false, () => true);
check("signed-in people can't call it directly (the server checks it's the couple)", denied);

console.log(failures ? `\n${failures} CHECK(S) FAILED` : "\nALL CHECKS PASSED");
process.exit(failures ? 1 : 0);
