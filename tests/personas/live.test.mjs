// Per-persona smoke test against the REAL project and the local dev server.
// For one real account of each kind (family, plain wedding party, best man,
// maid of honour, groomsman, bridesmaid, guest) it opens a short-lived
// session, loads every main page, and compares where each persona lands with
// what the access rules say they should see — then signs the session out and
// restores the person's "last signed in" time. Read-only: it only loads pages.
//
// Run deliberately (it briefly opens real sessions for real people):
//   npm run dev     # in another terminal
//   node tests/personas/live.test.mjs
import fs from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../../", import.meta.url)).split("\\").join("/").replace(new RegExp("/$"), "");
const require = createRequire(`${ROOT}/package.json`);
const { createClient } = require("@supabase/supabase-js");
const { createServerClient } = require("@supabase/ssr");

const env = {};
for (const l of fs.readFileSync(`${ROOT}/.env.local`, "utf8").split(/\r?\n/)) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].replace(/^"|"$/g, "");
}
const URL_ = env.NEXT_PUBLIC_SUPABASE_URL, ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const BASE = "http://localhost:3000";
const admin = createClient(URL_, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const OK = "200", NO = "-> /no-access";
// path -> expected outcome per persona. "any" = report what happens, don't judge.
const PAGES = ["/guests", "/budget", "/access", "/comms", "/errors", "/categories", "/categories/venue", "/project", "/project/ideas", "/project/expenses", "/project/groomsmen", "/project/bridesmaids", "/diary", "/account"];
const EXPECT = {
  family:     { "/guests": OK, "/budget": OK, "/access": NO, "/comms": NO, "/errors": NO, "/categories": OK, "/categories/venue": OK, "/project": OK, "/project/ideas": OK, "/project/expenses": "any", "/project/groomsmen": NO, "/project/bridesmaids": NO, "/diary": OK, "/account": "any" },
  plain:      { "/guests": NO, "/budget": NO, "/access": NO, "/comms": NO, "/errors": NO, "/categories": NO, "/categories/venue": NO, "/project": NO, "/project/ideas": NO, "/project/expenses": NO, "/project/groomsmen": NO, "/project/bridesmaids": NO, "/diary": OK, "/account": OK },
  bestman:    { "/guests": NO, "/budget": NO, "/access": NO, "/comms": NO, "/errors": NO, "/categories": OK, "/categories/venue": OK, "/project": OK, "/project/ideas": OK, "/project/expenses": "any", "/project/groomsmen": OK, "/project/bridesmaids": NO, "/diary": OK, "/account": "any" },
  maidofhonour: { "/guests": NO, "/budget": NO, "/access": NO, "/comms": NO, "/errors": NO, "/categories": OK, "/categories/venue": OK, "/project": OK, "/project/ideas": OK, "/project/expenses": "any", "/project/groomsmen": NO, "/project/bridesmaids": OK, "/diary": OK, "/account": "any" },
  groomsman:  { "/guests": NO, "/budget": NO, "/access": NO, "/comms": NO, "/errors": NO, "/categories": NO, "/categories/venue": NO, "/project": NO, "/project/ideas": NO, "/project/expenses": NO, "/project/groomsmen": OK, "/project/bridesmaids": NO, "/diary": OK, "/account": OK },
  bridesmaid: { "/guests": NO, "/budget": NO, "/access": NO, "/comms": NO, "/errors": NO, "/categories": NO, "/categories/venue": NO, "/project": NO, "/project/ideas": NO, "/project/expenses": NO, "/project/groomsmen": NO, "/project/bridesmaids": OK, "/diary": OK, "/account": OK },
  guest:      { "/guests": NO, "/budget": NO, "/access": NO, "/comms": NO, "/errors": NO, "/categories": NO, "/categories/venue": NO, "/project": NO, "/project/ideas": NO, "/project/expenses": NO, "/project/groomsmen": NO, "/project/bridesmaids": NO, "/diary": OK, "/account": OK },
};
const HOME = { family: "/categories", plain: "/account", bestman: "/project", maidofhonour: "/project", groomsman: "/account", bridesmaid: "/account", guest: "/account" };

const { data: contacts } = await admin.from("contacts").select("id, full_name, email, role, tags").is("parent_contact_id", null).not("email", "is", null);
const users = (await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })).data.users;
const accountOf = (c) => users.find((u) => u.email?.toLowerCase() === c.email.toLowerCase());
const hasTag = (c, t) => (c.tags ?? []).includes(t);
const pick = (pred) => contacts.find((c) => pred(c) && accountOf(c));
const PERSONAS = {
  family: pick((c) => c.role === "family"),
  plain: pick((c) => c.role === "wedding_party" && (c.tags ?? []).length === 0),
  bestman: pick((c) => hasTag(c, "best_man")),
  maidofhonour: pick((c) => hasTag(c, "maid_of_honour")),
  groomsman: pick((c) => c.role === "wedding_party" && hasTag(c, "groomsman") && !hasTag(c, "best_man")),
  bridesmaid: pick((c) => c.role === "wedding_party" && hasTag(c, "bridesmaid") && !hasTag(c, "maid_of_honour")),
  guest: pick((c) => c.role === "guest"),
};

let failures = 0;
const report = [];
for (const [name, contact] of Object.entries(PERSONAS)) {
  if (!contact) {
    console.log(`\n(${name}: no account to test with — skipped)`);
    continue;
  }
  const user = accountOf(contact);
  const before = user.last_sign_in_at ?? null;
  const link = await admin.auth.admin.generateLink({ type: "magiclink", email: contact.email });
  const client = createClient(URL_, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
  const v = await client.auth.verifyOtp({ token_hash: link.data.properties.hashed_token, type: "magiclink" });
  try {
    if (v.error) throw new Error(v.error.message);
    const jar = new Map();
    const w = createServerClient(URL_, ANON, { cookies: { getAll: () => [], setAll: (l) => l.forEach(({ name: n, value }) => jar.set(n, encodeURIComponent(value))) } });
    await w.auth.setSession({ access_token: v.data.session.access_token, refresh_token: v.data.session.refresh_token });
    const cookie = [...jar].map(([k, x]) => `${k}=${x}`).join("; ");
    const get = async (path) => {
      const res = await fetch(BASE + path, { headers: { cookie }, redirect: "manual" });
      const loc = res.headers.get("location");
      const to = loc ? new URL(loc, BASE).pathname : null;
      return res.status === 200 ? "200" : to ? `-> ${to}` : String(res.status);
    };

    console.log(`\n== ${name} (${contact.full_name}, ${contact.role}${(contact.tags ?? []).length ? ", " + contact.tags.join("/") : ""})`);
    const home = await get("/hub");
    const wantHome = `-> ${HOME[name]}`;
    const homeOk = home === wantHome;
    if (!homeOk) failures++;
    console.log(`${homeOk ? "  ok  " : "  FAIL"} signs in to: ${home}${homeOk ? "" : `  (wanted ${wantHome})`}`);
    for (const path of PAGES) {
      const got = await get(path);
      const want = EXPECT[name][path];
      if (want === "any") {
        console.log(`  note  ${path.padEnd(22)} ${got}  (not judged)`);
        continue;
      }
      // Someone who can't see a category at all gets "not found" on its page
      // (the lookup itself is refused) rather than a "no access" screen —
      // equally closed, and it doesn't reveal the page exists.
      const accepted = want === NO && path === "/categories/venue" ? [NO, "404"] : [want];
      const ok = accepted.includes(got);
      if (!ok) failures++;
      console.log(`${ok ? "  ok  " : "  FAIL"} ${path.padEnd(22)} ${got}${ok ? "" : `  (wanted ${accepted.join(" or ")})`}`);
      report.push({ name, path, got, ok });
    }
    const errorPages = report.filter((r) => r.name === name && /^5\d\d$/.test(r.got));
    if (errorPages.length) {
      failures += errorPages.length;
      console.log(`  FAIL ${errorPages.length} page(s) crashed for ${name}`);
    }
  } finally {
    await client.auth.signOut({ scope: "local" }).catch(() => {});
    await admin.rpc("fn_admin_restore_last_sign_in", { p_user_id: user.id, p_last_sign_in_at: before });
  }
}

console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
