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

// Deleting a wedding (settings > delete): every row of that wedding goes, in
// every table, and nothing of any other wedding is touched.
const A = (await db.query(`select id from weddings where slug = 'nickellie'`)).rows[0].id;
await db.exec(`insert into signup_codes (code) values ('T1')`);
const B = (await db.query(`select fn_create_wedding('jonsarah', 'Jon', 'Sarah', null, 'jon@t.local', 'Jon', null, 'T1') as id`)).rows[0].id;
await db.query(`select fn_set_examples($1, true)`, [B]);
await db.query(`select fn_set_examples($1, true)`, [A]);
await db.query(`select set_config('app.wedding_id', $1, false)`, [B]);
await db.exec(`
  insert into contacts (full_name, email, role) values ('Guest One', 'g1@t.local', 'guest');
  insert into events (name, slug, rsvp_enabled) values ('Wedding', 'wedding', true);
  insert into rsvps (contact_id, event_id, attending) select c.id, e.id, true from contacts c, events e where c.email = 'g1@t.local' and e.slug = 'wedding';
  insert into inbound_emails (from_email, to_email, subject) values ('g1@t.local', 'jonsarah@reply', 'Hi');
  insert into wedding_secrets (wedding_id, gate_codes) values (current_wedding_id(), '{ABC}');
`);

const tables = (await db.query(`select table_name from information_schema.columns where table_schema = 'public' and column_name = 'wedding_id' and table_name in (select tablename from pg_tables where schemaname = 'public')`)).rows.map((r) => r.table_name);
const countIn = async (w) => {
  let n = 0;
  for (const t of tables) n += (await db.query(`select count(*)::int n from ${t} where wedding_id = $1`, [w])).rows[0].n;
  return n;
};
const beforeA = await countIn(A);
check("the wedding to delete has data in many tables", (await countIn(B)) > 40);

await db.query(`delete from weddings where id = $1`, [B]);
check("deleting the wedding removes every row it owned, in every table", (await countIn(B)) === 0);
check("the wedding itself is gone", (await db.query(`select count(*)::int n from weddings where id = $1`, [B])).rows[0].n === 0);
check("the other wedding is untouched", (await countIn(A)) === beforeA);
check("the address is free again", (await db.query(`select fn_slug_available('jonsarah') ok`)).rows[0].ok === true);

console.log(failures ? `\n${failures} CHECK(S) FAILED` : "\nALL CHECKS PASSED");
process.exit(failures ? 1 : 0);
