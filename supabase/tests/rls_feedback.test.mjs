// Votes and comments RLS test (0037): replay every migration, seed items on
// a category, the main board and both stag/hen boards, then check who can
// see, vote, comment, edit and delete. Pass a migration number to stop early
// (e.g. `0036`) to confirm the checks fail without 0037.
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
console.log(`-- applied migrations up to ${LAST}`);

const P = {
  couple: ["couple", "{}"],
  family: ["family", "{}"],
  bm: ["wedding_party", "{best_man}"],
  moh: ["wedding_party", "{maid_of_honour}"],
  groomsman: ["wedding_party", "{groomsman}"],
  bridesmaid: ["wedding_party", "{bridesmaid}"],
  plain: ["wedding_party", "{}"],
  guest: ["guest", "{}"],
};
const uid = {};
for (const [name, [role, tags]] of Object.entries(P)) {
  await db.query(`insert into contacts (full_name, email, role, tags) values ($1, $2, $3, $4)`, [`${name} person`, `${name}@test.local`, role, tags]);
  uid[name] = (await db.query(`insert into auth.users (email) values ($1) returning id`, [`${name}@test.local`])).rows[0].id;
}

const id = (n) => `00000000-0000-0000-0000-0000000000${String(n).padStart(2, "0")}`;
const T = {
  venueOption: ["page_option", id(11)],
  stagOption: ["page_option", id(12)],
  stagIdea: ["idea", id(21)],
  henIdea: ["idea", id(22)],
  guestIdea: ["idea", id(23)],
  stagTask: ["task", id(31)],
};
await db.exec(`
  insert into category_pages (id, slug, title) values ('${id(1)}', 'venue', 'Venue');
  insert into page_registry (page_key, parent_page_key, label, default_min_role) values ('categories:venue', 'categories', 'Venue', 'family') on conflict do nothing;
  insert into option_groups (id, category_page_id, title, visible_tag) values ('${id(2)}', '${id(1)}', 'Venue', null), ('${id(3)}', null, 'Stag do', 'groomsman');
  insert into page_options (id, option_group_id, name) values ('${id(11)}', '${id(2)}', 'Chateau'), ('${id(12)}', '${id(3)}', 'Stag villa');
  insert into idea_boards (id, tier, visible_tag, title) values
    ('${id(21)}', 'wedding_party', 'groomsman', 'Go-karting'),
    ('${id(22)}', 'wedding_party', 'bridesmaid', 'Spa day'),
    ('${id(23)}', 'guest', null, 'Song requests');
  insert into tasks (id, title, visible_tag) values ('${id(31)}', 'Book flights', 'groomsman');
`);

async function as(name, fn) {
  return db.transaction(async (tx) => {
    await tx.query(`select set_config('request.jwt.claim.sub', $1, true)`, [name ? uid[name] : ""]);
    await tx.exec(`set local role authenticated`);
    const out = await fn(tx);
    await tx.rollback();
    return out;
  });
}
// Runs as a persona and COMMITS (for seeding real votes/comments through RLS).
async function commitAs(name, sql, params = []) {
  return db.transaction(async (tx) => {
    await tx.query(`select set_config('request.jwt.claim.sub', $1, true)`, [uid[name]]);
    await tx.exec(`set local role authenticated`);
    return (await tx.query(sql, params)).rows;
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
const VOTE = (t, v = 1) => [`insert into reactions (target_type, target_id, value) values ($1, $2, $3) returning 1`, [...t, v]];
const COMMENT = (t, body = "Nice") => [`insert into comments (target_type, target_id, body) values ($1, $2, $3) returning 1`, [...t, body]];

console.log("\n== who can vote and comment on what");
const D = "done", R = "refused";
const matrix = {
  //            venueOption stagOption stagIdea henIdea guestIdea stagTask
  couple:     [D, D, D, D, D, D],
  family:     [D, R, R, R, D, R],
  bm:         [D, D, D, R, D, D],
  moh:        [D, R, R, D, D, R],
  groomsman:  [R, D, D, R, D, D],
  bridesmaid: [R, R, R, D, D, R],
  plain:      [R, R, R, R, D, R],
  guest:      [R, R, R, R, R, R],
};
const targets = Object.entries(T);
for (const [who, want] of Object.entries(matrix)) {
  const votes = [], comments = [];
  for (const [, t] of targets) {
    votes.push(await as(who, (tx) => attempt(tx, ...VOTE(t))));
    comments.push(await as(who, (tx) => attempt(tx, ...COMMENT(t))));
  }
  const names = targets.map(([n]) => n);
  const bad = [];
  names.forEach((n, i) => {
    if (votes[i] !== want[i]) bad.push(`vote on ${n}: got ${votes[i]}, wanted ${want[i]}`);
    if (comments[i] !== want[i]) bad.push(`comment on ${n}: got ${comments[i]}, wanted ${want[i]}`);
  });
  if (bad.length) { failures += bad.length; console.log(`  FAIL ${who}:\n        ` + bad.join("\n        ")); }
  else console.log(`  ok   ${who.padEnd(10)} votes and comments exactly where they can see the item (${want.filter((x) => x === D).length} of ${want.length})`);
}
check("signed-out visitor can't vote", await as(null, (tx) => attempt(tx, ...VOTE(T.guestIdea))), R);

// Real feedback, written through RLS as each person.
await commitAs("groomsman", ...VOTE(T.stagIdea, 1));
await commitAs("bm", ...VOTE(T.stagIdea, -1));
await commitAs("groomsman", ...COMMENT(T.stagIdea, "Love it"));
await commitAs("bm", ...COMMENT(T.stagIdea, "Too pricey"));
await commitAs("bm", ...VOTE(T.venueOption, 1));
await commitAs("family", ...COMMENT(T.venueOption, "Gorgeous"));
await commitAs("bridesmaid", ...COMMENT(T.henIdea, "Yes please"));

console.log("\n== who can read feedback");
const seen = (who, table) => as(who, async (tx) => (await tx.query(`select target_id from ${table} order by 1`)).rows.length);
const wantSeen = {
  //            reactions comments
  couple:     [3, 4],
  bm:         [3, 3], // not the hen comment
  groomsman:  [2, 2], // stag only
  moh:        [1, 2], // venue vote; venue + hen comments
  bridesmaid: [0, 1], // hen comment only
  family:     [1, 1], // venue only
  plain:      [0, 0],
  guest:      [0, 0],
};
for (const [who, [r, c]] of Object.entries(wantSeen)) {
  check(`${who.padEnd(10)} sees reactions/comments`, `${await seen(who, "reactions")}/${await seen(who, "comments")}`, `${r}/${c}`);
}

console.log("\n== votes");
check("names are stamped by the server", (await db.query(`select author_name from reactions where profile_id = $1`, [uid.groomsman])).rows[0].author_name, "groomsman person");
check("a second vote on the same item is refused", await as("groomsman", (tx) => attempt(tx, ...VOTE(T.stagIdea, -1))), R);
check("you can change your own vote", await as("groomsman", (tx) => attempt(tx, `update reactions set value = -1 where profile_id = $1 returning 1`, [uid.groomsman])), D);
check("you can't change someone else's vote", await as("groomsman", (tx) => attempt(tx, `update reactions set value = 1 where profile_id = $1 returning 1`, [uid.bm])), "no-op");
check("you can withdraw your own vote", await as("groomsman", (tx) => attempt(tx, `delete from reactions where profile_id = $1 returning 1`, [uid.groomsman])), D);
check("you can't remove someone else's vote", await as("groomsman", (tx) => attempt(tx, `delete from reactions where profile_id = $1 returning 1`, [uid.bm])), "no-op");
check("even the couple can't remove someone's vote", await as("couple", (tx) => attempt(tx, `delete from reactions where profile_id = $1 returning 1`, [uid.bm])), "no-op");
check("a vote must be +1 or -1", await as("bm", (tx) => attempt(tx, ...VOTE(T.stagTask, 5))), R);
check("voting 'as' someone else is recorded as yourself", await as("plain", async (tx) => {
  await tx.query(`insert into reactions (target_type, target_id, value, profile_id, author_name) values ('idea', $1, 1, $2, 'Forged Name')`, [T.guestIdea[1], uid.couple]);
  const r = (await tx.query(`select profile_id, author_name from reactions where target_id = $1`, [T.guestIdea[1]])).rows[0];
  return `${r.profile_id === uid.plain ? "self" : "OTHER"}/${r.author_name}`;
}), "self/plain person");
check("a vote can't be moved to another item or person", await as("bm", async (tx) => {
  await tx.query(`update reactions set target_id = $1, profile_id = $2, author_name = 'x' where profile_id = $3 and target_id = $4`, [T.henIdea[1], uid.couple, uid.bm, T.stagIdea[1]]);
  await tx.exec(`reset role`);
  const r = (await tx.query(`select target_id, profile_id, author_name from reactions where profile_id = $1 and target_type = 'idea'`, [uid.bm])).rows[0];
  return `${r.target_id === T.stagIdea[1]}/${r.author_name}`;
}), "true/bm person");

console.log("\n== comments");
const mine = (who) => [`where profile_id = $1`, [uid[who]]];
check("edit your own comment", await as("groomsman", (tx) => attempt(tx, `update comments set body = 'Love it!' ${mine("groomsman")[0]} returning 1`, mine("groomsman")[1])), D);
check("…which marks it as edited", await as("groomsman", async (tx) => {
  await tx.query(`update comments set body = 'Love it!' where profile_id = $1`, [uid.groomsman]);
  return (await tx.query(`select edited_at is not null as e from comments where profile_id = $1`, [uid.groomsman])).rows[0].e;
}), true);
check("you can't edit someone else's comment", await as("groomsman", (tx) => attempt(tx, `update comments set body = 'hacked' where profile_id = $1 returning 1`, [uid.bm])), "no-op");
check("the couple can't edit someone's words either", await as("couple", (tx) => attempt(tx, `update comments set body = 'hacked' where profile_id = $1 returning 1`, [uid.bm])), "no-op");
check("empty comment refused", await as("bm", (tx) => attempt(tx, ...COMMENT(T.stagIdea, "   "))), R);
check("over-long comment refused", await as("bm", (tx) => attempt(tx, ...COMMENT(T.stagIdea, "x".repeat(2001)))), R);
check("delete your own comment", await as("groomsman", (tx) => attempt(tx, `delete from comments where profile_id = $1 returning 1`, [uid.groomsman])), D);
check("a member can't delete another member's comment", await as("groomsman", (tx) => attempt(tx, `delete from comments where profile_id = $1 returning 1`, [uid.bm])), "no-op");
check("the best man can remove a comment on HIS board", await as("bm", (tx) => attempt(tx, `delete from comments where profile_id = $1 returning 1`, [uid.groomsman])), D);
check("…but not on the venue (not his to moderate)", await as("bm", (tx) => attempt(tx, `delete from comments where profile_id = $1 returning 1`, [uid.family])), "no-op");
check("the maid of honour can't moderate the stag board", await as("moh", (tx) => attempt(tx, `delete from comments where profile_id = $1 returning 1`, [uid.groomsman])), "no-op");
check("the maid of honour can remove a comment on the hen board", await as("moh", (tx) => attempt(tx, `delete from comments where profile_id = $1 returning 1`, [uid.bridesmaid])), D);
check("the couple can remove any comment", await as("couple", (tx) => attempt(tx, `delete from comments where profile_id in ($1, $2) returning 1`, [uid.family, uid.bridesmaid])), D);

console.log("\n== access taken away later");
await db.exec(`insert into page_permissions (page_key, principal_type, principal_value, page_access, data_access, edit_access, cost_access)
  values ('categories:venue', 'tag', 'best_man', false, false, false, false)`);
check("venue hidden from best man: his old vote is no longer readable by him", await as("bm", async (tx) => (await tx.query(`select 1 from reactions where target_id = $1`, [T.venueOption[1]])).rows.length), 0);
check("…and he can't change it", await as("bm", (tx) => attempt(tx, `update reactions set value = -1 where target_id = $1 returning 1`, [T.venueOption[1]])), "no-op");
check("…or comment there", await as("bm", (tx) => attempt(tx, ...COMMENT(T.venueOption))), R);
check("…everyone else still sees his vote", await as("family", async (tx) => (await tx.query(`select 1 from reactions where target_id = $1`, [T.venueOption[1]])).rows.length), 1);
await db.exec(`delete from page_permissions where page_key = 'categories:venue' and principal_value = 'best_man'`);

console.log("\n== tidy-up when an item is deleted");
const left = async (t) => {
  const r = await db.query(`select (select count(*) from reactions where target_type = $1 and target_id = $2) + (select count(*) from comments where target_type = $1 and target_id = $2) as n`, t);
  return Number(r.rows[0].n);
};
check("stag idea has feedback before", (await left(T.stagIdea)) > 0, true);
await db.query(`delete from idea_boards where id = $1`, [T.stagIdea[1]]);
check("deleting the idea removes its votes and comments", await left(T.stagIdea), 0);
check("venue option has feedback before", (await left(T.venueOption)) > 0, true);
await db.query(`delete from category_pages where id = $1`, [id(1)]);
check("deleting the whole category removes its options' feedback", await left(T.venueOption), 0);
check("unrelated feedback untouched", (await db.query(`select count(*)::int as n from comments where target_id = $1`, [T.henIdea[1]])).rows[0].n, 1);

console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
