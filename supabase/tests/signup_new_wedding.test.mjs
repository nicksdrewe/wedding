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

// Signing up a new wedding (0058): codes, addresses, and the new wedding ends
// up with its own pages and its couple, sealed off from the first wedding.
const A = (await db.query(`select id from weddings where slug = 'nickellie'`)).rows[0].id;
const pagesA = (await db.query(`select count(*)::int as n from page_registry where wedding_id = $1`, [A])).rows[0].n;
const create = async (slug, code, email = "jon@t.local", user = null) => {
  try {
    const r = await db.query(`select fn_create_wedding($1, 'Jon', 'Sarah', 'Spring 2029', $2, 'Jon Smith', $3, $4) as id`, [slug, email, user, code]);
    return { id: r.rows[0].id };
  } catch (e) {
    return { error: e.message };
  }
};
const asRole = async (role, sql, params) =>
  db.transaction(async (tx) => {
    await tx.exec(`set local role ${role}`);
    return tx.query(sql, params);
  }).catch((e) => ({ error: e.message, rows: [] }));

console.log("== addresses");
const avail = async (s) => (await asRole("anon", `select fn_slug_available($1) as ok`, [s])).rows[0]?.ok;
check("a free address is available (asked by anyone)", (await avail("jonsarah")) === true);
check("a taken address is not", (await avail("nickellie")) === false);
check("a reserved address is not", (await avail("www")) === false);
check("a badly formed address is not", (await avail("Jon_Sarah")) === false);

console.log("== codes");
check("the public can't check codes", !!(await asRole("anon", `select fn_check_signup_code('ALPHA2026')`)).error);
check("the public can't read codes", !!(await asRole("anon", `select * from signup_codes`)).error || (await asRole("anon", `select * from signup_codes`)).rows.length === 0);
check("the public can't create weddings", !!(await asRole("anon", `select fn_create_wedding('x1x', 'a', 'b', null, 'a@b.c', null, null, 'ALPHA2026')`)).error);
check("a wrong code makes no wedding", !!(await create("jonsarah", "NOPE")).error);
await db.exec(`insert into signup_codes (code, discount_percent) values ('HALF', 50)`);
check("a part-discount code isn't enough without payment", !!(await create("jonsarah", "HALF")).error);
await db.exec(`insert into signup_codes (code, max_uses) values ('ONCE', 1)`);

console.log("== making a wedding");
const made = await create("jonsarah", " alpha2026 ");
check("the alpha code makes a wedding (any case, spaces ignored)", !!made.id);
const B = made.id;
const w = (await db.query(`select * from weddings where id = $1`, [B])).rows[0];
check("names, display name and date are stored", w.display_name === "Jon & Sarah" && w.date_label === "Spring 2029" && w.signup_code === "ALPHA2026");
check("it gets its own copy of the pages", (await db.query(`select count(*)::int as n from page_registry where wedding_id = $1`, [B])).rows[0].n === pagesA && pagesA > 0);
const couple = (await db.query(`select role, email, full_name from contacts where wedding_id = $1`, [B])).rows;
check("the couple is on its guest list, and no one else", couple.length === 1 && couple[0].role === "couple" && couple[0].full_name === "Jon Smith");
check("nothing from the first wedding came with it", (await db.query(`select count(*)::int as n from contacts where wedding_id = $1 and email <> 'jon@t.local'`, [B])).rows[0].n === 0);
check("the code use is counted", (await db.query(`select uses from signup_codes where code = 'ALPHA2026'`)).rows[0].uses === 1);
check("the same address can't be taken twice", !!(await create("jonsarah", "ALPHA2026")).error);
check("a failed signup doesn't use up the code", (await db.query(`select uses from signup_codes where code = 'ALPHA2026'`)).rows[0].uses === 1);

console.log("== limited codes, and an existing login");
const u = (await db.query(`insert into auth.users (email) values ('amy@t.local') returning id`)).rows[0].id;
const m2 = await create("amyben", "ONCE", "Amy@t.local", u);
check("a single-use code works once", !!m2.id);
check("…and not twice", !!(await create("amyben2", "ONCE")).error);
const link = (await db.query(`select user_id from contacts where wedding_id = $1`, [m2.id])).rows[0];
check("an existing login is linked to the new wedding as the couple", link.user_id === u);
await db.transaction(async (tx) => {
  await tx.query(`select set_config('request.jwt.claim.sub', $1, true)`, [u]);
  await tx.query(`select set_config('app.wedding_id', $1, true)`, [m2.id]);
  await tx.exec(`set local role authenticated`);
  check("they are the couple there", (await tx.query(`select auth_role() as r`)).rows[0].r === "couple");
  await tx.query(`select set_config('app.wedding_id', $1, true)`, [A]);
  check("…and have no role at the first wedding", (await tx.query(`select auth_role() as r`)).rows[0].r == null);
});

console.log(failures ? `\n${failures} CHECK(S) FAILED` : "\nALL CHECKS PASSED");
process.exit(failures ? 1 : 0);
