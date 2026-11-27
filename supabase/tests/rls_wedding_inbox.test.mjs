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

// The wedding inbox (0059): replies are filed per wedding, only the couple
// reads them, and nobody but the server can file one.
const A = (await db.query(`select id from weddings where slug = 'nickellie'`)).rows[0].id;
const B = (await db.query(`insert into weddings (slug, partner_one, partner_two, display_name) values ('jonsarah','Jon','Sarah','Jon & Sarah') returning id`)).rows[0].id;
const uid = {};
async function person(name, w, role) {
  await db.query(`select set_config('app.wedding_id', $1, false)`, [w]);
  await db.query(`insert into contacts (full_name, email, role) values ($1, $2, $3)`, [name, `${name}@t.local`, role]);
  uid[name] = (await db.query(`insert into auth.users (email) values ($1) returning id`, [`${name}@t.local`])).rows[0].id;
}
await person("coupleA", A, "couple");
await person("guestA", A, "guest");
await person("coupleB", B, "couple");
await db.query(`insert into inbound_emails (wedding_id, from_email, to_email, subject) values ($1, 'aunt@x.com', 'nickellie@w', 'Re: Save the date'), ($2, 'pal@x.com', 'jonsarah@w', 'Re: Coaches')`, [A, B]);

const as = (name, w, sql) =>
  db.transaction(async (tx) => {
    await tx.query(`select set_config('request.jwt.claim.sub', $1, true)`, [uid[name]]);
    await tx.query(`select set_config('app.wedding_id', $1, true)`, [w]);
    await tx.exec(`set local role authenticated`);
    return tx.query(sql);
  }).catch((e) => ({ error: e.message, rows: [] }));

let r = await as("coupleA", A, `select subject from inbound_emails`);
check("the couple reads their own wedding's replies", r.rows.length === 1 && r.rows[0].subject === "Re: Save the date");
r = await as("coupleB", B, `select subject from inbound_emails`);
check("the other couple sees only theirs", r.rows.length === 1 && r.rows[0].subject === "Re: Coaches");
r = await as("coupleB", A, `select subject from inbound_emails`);
check("a couple can't read another wedding's inbox", r.rows.length === 0);
r = await as("guestA", A, `select subject from inbound_emails`);
check("guests can't read the inbox", r.rows.length === 0);
r = await as("coupleA", A, `insert into inbound_emails (from_email, to_email) values ('fake@x.com', 'nickellie@w') returning id`);
check("nobody signed in can file a reply", !!r.error);
r = await as("coupleA", A, `update inbound_emails set read_at = now() returning id`);
check("the couple can mark replies read", r.rows.length === 1);
r = await as("guestA", A, `delete from inbound_emails returning id`);
check("guests can't delete replies", r.rows.length === 0);
r = await as("coupleA", A, `delete from inbound_emails returning id`);
check("the couple can clear a reply", r.rows.length === 1);
check("…and only their own", (await db.query(`select count(*)::int n from inbound_emails where wedding_id = $1`, [B])).rows[0].n === 1);

console.log(failures ? `\n${failures} CHECK(S) FAILED` : "\nALL CHECKS PASSED");
process.exit(failures ? 1 : 0);
