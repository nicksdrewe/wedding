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

const A = (await db.query(`select id from weddings where slug = 'nickellie'`)).rows[0].id;
const B = (await db.query(
  `insert into weddings (slug, partner_one, partner_two, display_name) values ('jonsarah', 'Jon', 'Sarah', 'Jon & Sarah') returning id`
)).rows[0].id;
await db.query(`select fn_seed_wedding($1, $2)`, [B, A]);

const inWedding = (w) => db.query(`select set_config('app.wedding_id', $1, false)`, [w]);

// People. "shared" is a guest at A and the couple at B: one login, two roles.
const uid = {};
async function person(name, wedding, role, tags = "{}") {
  await inWedding(wedding);
  await db.query(`insert into contacts (full_name, email, role, tags) values ($1, $2, $3, $4)`, [name, `${name}@t.local`, role, tags]);
}
await person("coupleA", A, "couple");
await person("coupleB", B, "couple");
await person("shared", A, "guest");
await person("shared", B, "couple");
await person("bmA", A, "wedding_party", "{best_man}");
for (const n of ["coupleA", "coupleB", "shared", "bmA"]) {
  uid[n] = (await db.query(`insert into auth.users (email) values ($1) returning id`, [`${n}@t.local`])).rows[0].id;
}

async function as(name, wedding, fn) {
  return db.transaction(async (tx) => {
    await tx.query(`select set_config('request.jwt.claim.sub', $1, true)`, [uid[name]]);
    await tx.query(`select set_config('app.wedding_id', $1, true)`, [wedding]);
    await tx.exec(`set local role authenticated`);
    return fn(tx);
  });
}
const q = async (name, wedding, sql, params) => {
  try { return await as(name, wedding, (tx) => tx.query(sql, params)); } catch (e) { return { error: e.message, rows: [] }; }
};
const val = async (name, wedding, sql, params) => (await q(name, wedding, sql, params)).rows?.[0] ?? null;

// Data in each wedding, including a category with the SAME slug in both.
await inWedding(A);
await db.exec(`insert into category_pages (slug, title) values ('venue', 'Venue A'); insert into tasks (title) values ('Task A');`);
await inWedding(B);
await db.exec(`insert into category_pages (slug, title) values ('venue', 'Venue B'); insert into tasks (title) values ('Task B');`);

console.log("== the same login has a different role in each wedding");
check("shared is a guest at A", (await val("shared", A, `select auth_role() as r`))?.r === "guest");
check("shared is the couple at B", (await val("shared", B, `select auth_role() as r`))?.r === "couple");
check("coupleA has no role at B", (await val("coupleA", B, `select auth_role() as r`))?.r == null);
check("profiles answers per wedding (A)", (await val("shared", A, `select role from profiles where id = auth.uid()`))?.role === "guest");
check("profiles answers per wedding (B)", (await val("shared", B, `select role from profiles where id = auth.uid()`))?.role === "couple");

console.log("== nothing crosses between weddings");
let r = await q("coupleA", A, `select title from tasks order by title`);
check("coupleA sees only A's tasks", r.rows.map((x) => x.title).join() === "Task A");
r = await q("coupleB", B, `select title from tasks order by title`);
check("coupleB sees only B's tasks", r.rows.map((x) => x.title).join() === "Task B");
r = await q("coupleA", A, `select full_name from contacts order by full_name`);
check("coupleA's guest list has no one from B", !r.rows.some((x) => x.full_name === "coupleB"));
r = await q("coupleB", A, `select count(*)::int as n from tasks`);
check("coupleB pointed at A sees nothing (not a member)", (r.rows?.[0]?.n ?? 0) === 0);
r = await q("coupleA", A, `update tasks set title = 'hacked' where title = 'Task B' returning id`);
check("coupleA cannot change B's task", (r.rows?.length ?? 0) === 0);
r = await q("coupleA", A, `insert into tasks (title, wedding_id) values ('sneaky', $1) returning id`, [B]);
check("coupleA cannot write a row into B", !!r.error);
r = await q("coupleA", A, `insert into tasks (title) values ('A2') returning wedding_id`);
check("new rows land in the current wedding by default", r.rows?.[0]?.wedding_id === A);

console.log("== look-ups by name stay inside the wedding");
r = await q("coupleA", A, `select title from category_pages where slug = 'venue'`);
check("same slug in two weddings: A sees its own", r.rows.length === 1 && r.rows[0].title === "Venue A");
r = await q("coupleB", B, `select title from category_pages where slug = 'venue'`);
check("same slug in two weddings: B sees its own", r.rows.length === 1 && r.rows[0].title === "Venue B");
r = await q("shared", B, `select count(*)::int as n from page_registry`);
check("the new wedding got its own page list", (r.rows?.[0]?.n ?? 0) > 0);
// A permission set in A only: the best man loses the planning page at A; B is untouched.
// (setup runs as a superuser, which ignores row security, so say which wedding)
const PB = `select principal_value, page_access from page_permissions where page_key = 'project' and wedding_id = '${B}' order by principal_value`;
await inWedding(B);
const before = JSON.stringify((await db.query(PB)).rows);
await inWedding(A);
await db.exec(`update page_permissions set page_access = false where page_key = 'project' and wedding_id = '${A}'`);
check("A's own permission applies at A", (await val("bmA", A, `select fn_resolve_permission('project', 'page') as p`))?.p === false);
await inWedding(B);
check("B's copy of that permission is unchanged", JSON.stringify((await db.query(PB)).rows) === before);
check("Big Day settings are per wedding", (await db.query(`select count(*)::int as n from big_day_settings where wedding_id in ($1, $2)`, [A, B])).rows[0].n === 2);

console.log("== logins link to the guest list in every wedding");
await inWedding(A);
await db.exec(`insert into contacts (full_name, email, role) values ('late', 'late@t.local', 'family')`);
await inWedding(B);
await db.exec(`insert into contacts (full_name, email, role) values ('late', 'late@t.local', 'guest')`);
uid.late = (await db.query(`insert into auth.users (email) values ('late@t.local') returning id`)).rows[0].id;
check("a new login is family at A", (await val("late", A, `select auth_role() as r`))?.r === "family");
check("…and a guest at B", (await val("late", B, `select auth_role() as r`))?.r === "guest");
await inWedding(B);
await db.exec(`insert into contacts (full_name, email, role) values ('Ed', 'coupleA@t.local', 'wedding_party')`);
check("a guest-list entry added later links to the existing login", (await val("coupleA", B, `select auth_role() as r`))?.r === "wedding_party");

console.log("== weddings themselves");
r = await q("coupleA", A, `select slug from weddings order by slug`);
check("anyone can read the wedding list (for addresses)", r.rows.length === 2);
r = await q("coupleA", A, `update weddings set display_name = 'Hacked' where slug = 'jonsarah' returning id`);
check("a couple cannot edit someone else's wedding", (r.rows?.length ?? 0) === 0);
r = await q("shared", B, `update weddings set display_name = 'Jon and Sarah' where slug = 'jonsarah' returning id`);
check("the couple can edit their own wedding", (r.rows?.length ?? 0) === 1);

console.log(failures ? `\n${failures} CHECK(S) FAILED` : "\nALL CHECKS PASSED");
process.exit(failures ? 1 : 0);
