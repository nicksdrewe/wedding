// Account-management database pieces (0035): the audit log and the
// sign-out-everywhere function. Replays every migration into a throwaway
// Postgres first. Pass a migration number to stop early (e.g. `0034`) to
// confirm the checks fail without 0035.
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
  create role service_role nologin bypassrls; -- as on Supabase: the server key skips row security
  create schema auth;
  create table auth.users (id uuid primary key default gen_random_uuid(), email text, raw_user_meta_data jsonb default '{}');
  -- Stand-ins for Supabase's session tables (types differ between versions:
  -- refresh_tokens.user_id is varchar there, sessions.user_id is uuid).
  create table auth.sessions (id uuid primary key default gen_random_uuid(), user_id uuid not null);
  create table auth.refresh_tokens (id bigserial primary key, user_id varchar, session_id uuid);
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  $$;
  grant usage on schema auth to anon, authenticated, service_role;
  grant usage on schema public to anon, authenticated, service_role;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
`);

const files = fs.readdirSync(MIG).filter((f) => f.endsWith(".sql")).sort();
for (const f of files) {
  if (f.slice(0, 4) > LAST) break;
  try {
    await db.exec(fs.readFileSync(path.join(MIG, f), "utf8"));
  } catch (e) {
    console.log("MIGRATION FAILED:", f, "\n ", e.message);
    process.exit(1);
  }
}
console.log(`-- applied migrations up to ${LAST}`);

const P = { couple: ["couple"], family: ["family"], bm: ["wedding_party"], guest: ["guest"] };
const uid = {};
for (const [name, [role]] of Object.entries(P)) {
  await db.query(`insert into contacts (full_name, email, role) values ($1, $2, $3)`, [name, `${name}@test.local`, role]);
  uid[name] = (await db.query(`insert into auth.users (email) values ($1) returning id`, [`${name}@test.local`])).rows[0].id;
}
const targetContact = (await db.query(`select id from contacts where full_name = 'guest'`)).rows[0].id;

async function as(role, name, fn) {
  return db.transaction(async (tx) => {
    await tx.query(`select set_config('request.jwt.claim.sub', $1, true)`, [name ? uid[name] : ""]);
    await tx.exec(`set local role ${role}`);
    const out = await fn(tx);
    await tx.rollback();
    return out;
  });
}
const attempt = async (tx, sql, params = []) => {
  try {
    await tx.exec("savepoint s");
    const r = await tx.query(sql, params);
    return r.rows.length > 0 ? "done" : "no-op";
  } catch {
    await tx.exec("rollback to savepoint s");
    return "refused";
  }
};
function check(label, got, want) {
  const ok = got === want;
  if (!ok) failures++;
  console.log(`${ok ? "  ok  " : "  FAIL"} ${label}: ${JSON.stringify(got)}${ok ? "" : `  (wanted ${JSON.stringify(want)})`}`);
}

// Seed an audit line and two people's sessions as the table owner.
await db.query(
  `insert into admin_audit (actor_id, action, target_contact_id, target_email, detail)
   values ((select id from profiles where role = 'couple'), 'account.create', $1, 'guest@test.local', '{"invited":true}')`,
  [targetContact]
);
for (const who of ["guest", "bm"]) {
  const s = (await db.query(`insert into auth.sessions (user_id) values ($1) returning id`, [uid[who]])).rows[0].id;
  await db.query(`insert into auth.refresh_tokens (user_id, session_id) values ($1, $2)`, [uid[who], s]);
}

console.log("\n== audit log");
for (const [who, want] of [["couple", "1"], ["family", "0"], ["bm", "0"], ["guest", "0"], [null, "0"]]) {
  check(`${(who ?? "anonymous").padEnd(9)} can read it`, await as("authenticated", who, async (tx) => String((await tx.query(`select 1 from admin_audit`)).rows.length)), want);
}
const WRITE = `insert into admin_audit (action, target_email) values ('forged', 'x') returning 1`;
for (const who of ["couple", "family", "bm", "guest"]) {
  check(`${who.padEnd(9)} cannot write a line`, await as("authenticated", who, (tx) => attempt(tx, WRITE)), "refused");
}
check("couple cannot edit a line", await as("authenticated", "couple", (tx) => attempt(tx, `update admin_audit set action = 'x' returning 1`)), "no-op");
check("couple cannot erase a line", await as("authenticated", "couple", (tx) => attempt(tx, `delete from admin_audit returning 1`)), "no-op");
check("the server (service role) can write a line", await as("service_role", null, (tx) => attempt(tx, WRITE)), "done");

console.log("\n== sign out everywhere");
const REVOKE = (who) => [`select fn_admin_revoke_sessions($1)`, [uid[who]]];
for (const [role, who] of [["authenticated", "couple"], ["authenticated", "guest"], ["anon", null]]) {
  check(`${(who ?? "anonymous").padEnd(9)} cannot call it`, await as(role, who, (tx) => attempt(tx, ...REVOKE("bm"))), "refused");
}
check("sessions untouched after those attempts", String((await db.query(`select count(*) from auth.sessions`)).rows[0].count), "2");
// Checked inside the same transaction as the call, because `as()` rolls back.
const afterRevoke = await as("service_role", null, async (tx) => {
  const result = await attempt(tx, ...REVOKE("guest"));
  await tx.exec("reset role"); // read the outcome as the table owner
  const count = async (table, who) => String((await tx.query(`select count(*) from auth.${table} where user_id::text = $1`, [uid[who]])).rows[0].count);
  return { result, guestSessions: await count("sessions", "guest"), guestTokens: await count("refresh_tokens", "guest"), bmSessions: await count("sessions", "bm") };
});
check("the server can call it", afterRevoke.result, "done");
check("guest's sessions removed", afterRevoke.guestSessions, "0");
check("guest's refresh tokens removed", afterRevoke.guestTokens, "0");
check("nobody else was signed out", afterRevoke.bmSessions, "1");


console.log("\n== plain sign-up still produces the right profile (what createUser relies on)");
await db.query(`insert into contacts (full_name, email, role, tags) values ('New Person', 'new@test.local', 'wedding_party', '{best_man}')`);
await db.query(`insert into auth.users (email) values ('new@test.local')`);
const prof = (await db.query(`select p.role, c.full_name from profiles p join contacts c on c.id = p.contact_id where c.email = 'new@test.local'`)).rows[0];
check("new account linked to its contact with the contact's role", `${prof?.full_name}/${prof?.role}`, "New Person/wedding_party");

console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
