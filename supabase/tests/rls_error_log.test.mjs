// Error log (0039): only the couple can read or clear it; nobody can write
// through the app's database access; the server (service role) can.
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
  create role service_role nologin bypassrls;
  create schema auth;
  create table auth.users (id uuid primary key default gen_random_uuid(), email text, raw_user_meta_data jsonb default '{}', last_sign_in_at timestamptz);
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
for (const f of fs.readdirSync(MIG).filter((f) => f.endsWith(".sql")).sort()) {
  if (f.slice(0, 4) > LAST) break;
  try {
    await db.exec(fs.readFileSync(path.join(MIG, f), "utf8"));
  } catch (e) {
    console.log("MIGRATION FAILED:", f, "\n ", e.message);
    process.exit(1);
  }
}

const P = { couple: "couple", family: "family", bm: "wedding_party", guest: "guest" };
const uid = {};
for (const [name, role] of Object.entries(P)) {
  await db.query(`insert into contacts (full_name, email, role) values ($1, $2, $3)`, [name, `${name}@test.local`, role]);
  uid[name] = (await db.query(`insert into auth.users (email) values ($1) returning id`, [`${name}@test.local`])).rows[0].id;
}
await db.exec(`insert into error_log (route, message, digest) values ('/categories/[slug]', 'boom', 'abc123'), ('/guests', 'bang', null)`);

async function as(role, name, fn) {
  return db.transaction(async (tx) => {
    await tx.query(`select set_config('request.jwt.claim.sub', $1, true)`, [name ? uid[name] : ""]);
    await tx.exec(`set local role ${role}`);
    const out = await fn(tx);
    await tx.rollback();
    return out;
  });
}
const attempt = async (tx, sql) => {
  try {
    await tx.exec("savepoint s");
    const r = await tx.query(sql);
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
const INSERT = `insert into error_log (route, message) values ('/x', 'forged') returning 1`;

console.log("== error log");
for (const [who, n] of [["couple", "2"], ["family", "0"], ["bm", "0"], ["guest", "0"], [null, "0"]]) {
  check(`${(who ?? "anonymous").padEnd(9)} can read it`, await as("authenticated", who, async (tx) => String((await tx.query(`select 1 from error_log`)).rows.length)), n);
}
for (const who of ["couple", "family", "bm", "guest"]) {
  check(`${who.padEnd(9)} cannot write a line`, await as("authenticated", who, (tx) => attempt(tx, INSERT)), "refused");
}
check("anonymous cannot write a line", await as("anon", null, (tx) => attempt(tx, INSERT)), "refused");
check("couple cannot edit a line", await as("authenticated", "couple", (tx) => attempt(tx, `update error_log set message = 'x' returning 1`)), "no-op");
check("family cannot clear it", await as("authenticated", "family", (tx) => attempt(tx, `delete from error_log returning 1`)), "no-op");
check("couple can clear it", await as("authenticated", "couple", (tx) => attempt(tx, `delete from error_log returning 1`)), "done");
check("the server can write a line", await as("service_role", null, (tx) => attempt(tx, INSERT)), "done");

console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
