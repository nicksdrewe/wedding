// Live end-to-end test of view-as against the local dev server and the real
// Supabase project. Signs in as Nick locally, views as the best man, checks
// what he can see, exits, and proves only the borrowed session was closed.
// Leaves no sessions behind and restores both "last signed in" timestamps.
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
const anonClient = () => createClient(URL_, ANON, { auth: { persistSession: false, autoRefreshToken: false } });

let failures = 0;
function check(label, got, want) {
  const ok = typeof want === "function" ? want(got) : got === want;
  if (!ok) failures++;
  console.log(`${ok ? "  ok  " : "  FAIL"} ${label}: ${JSON.stringify(got)}${ok || typeof want === "function" ? "" : `  (wanted ${JSON.stringify(want)})`}`);
}

// ---- cookie jar ----
class Jar {
  constructor() { this.map = new Map(); }
  header() { return [...this.map].map(([k, v]) => `${k}=${v}`).join("; "); }
  apply(res) {
    for (const sc of res.headers.getSetCookie?.() ?? []) {
      const [pair, ...attrs] = sc.split(";");
      const eq = pair.indexOf("=");
      const name = pair.slice(0, eq).trim(), value = pair.slice(eq + 1);
      const gone = value === "" || attrs.some((a) => /^\s*max-age=0\s*$/i.test(a) || /expires=thu, 01 jan 1970/i.test(a));
      if (gone) this.map.delete(name); else this.map.set(name, value);
    }
  }
  names() { return [...this.map.keys()].sort(); }
}
async function go(jar, path, init = {}) {
  const res = await fetch(BASE + path, { redirect: "manual", ...init, headers: { cookie: jar.header(), ...(init.headers ?? {}) } });
  jar.apply(res);
  const loc = res.headers.get("location");
  return { status: res.status, to: loc ? new URL(loc, BASE).pathname : null, text: res.status === 200 ? await res.text() : "" };
}
const short = (r) => `${r.status}${r.to ? " -> " + r.to : ""}`;
async function whoIs(jar) {
  const c = createServerClient(URL_, ANON, { cookies: { getAll: () => [...jar.map].map(([name, value]) => ({ name, value: decodeURIComponent(value) })), setAll: () => {} } });
  const { data } = await c.auth.getUser();
  return data.user?.email ?? null;
}
async function mintSession(email) {
  const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  if (error) throw new Error("generateLink: " + error.message);
  const c = anonClient();
  const v = await c.auth.verifyOtp({ token_hash: data.properties.hashed_token, type: "magiclink" });
  if (v.error) throw new Error("verifyOtp: " + v.error.message);
  return { client: c, session: v.data.session };
}
async function lastSignIn(email) {
  const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const u = data.users.find((x) => x.email?.toLowerCase() === email);
  return { id: u.id, at: u.last_sign_in_at ?? null };
}

const NICK = "nicksdrewe@gmail.com";
const { data: bmContact } = await admin.from("contacts").select("id, full_name, email").contains("tags", ["best_man"]).is("parent_contact_id", null).single();
const BM = bmContact.email.toLowerCase();
console.log(`admin: ${NICK}   viewing as: ${bmContact.full_name}`);

const probe = await admin.rpc("fn_admin_restore_last_sign_in", { p_user_id: "00000000-0000-0000-0000-000000000000", p_last_sign_in_at: null });
check("0036 is in place", probe.error ? probe.error.message : "yes", "yes");

const nickBefore = await lastSignIn(NICK);
const bmBefore = await lastSignIn(BM);
const auditBefore = (await admin.from("admin_audit").select("id", { count: "exact", head: true }).like("action", "viewas.%")).count ?? 0;

let phone = null, nickSession = null;
try {
  // A stand-in for "the best man's own phone": an independent session of his
  // that must SURVIVE the couple viewing as him and exiting.
  phone = await mintSession(BM);

  // Nick signed in on the local site.
  nickSession = await mintSession(NICK);
  const jar = new Jar();
  const writer = createServerClient(URL_, ANON, { cookies: { getAll: () => [], setAll: (list) => list.forEach(({ name, value }) => jar.map.set(name, encodeURIComponent(value))) } });
  const set = await writer.auth.setSession({ access_token: nickSession.session.access_token, refresh_token: nickSession.session.refresh_token });
  console.log("\n== setup");
  check("session cookies are written synchronously by setSession (what start relies on)", !set.error && jar.names().some((n) => /-auth-token/.test(n)), true);
  check("local site sees Nick", await whoIs(jar), NICK);
  check("Nick reaches the guest list", (await go(jar, "/guests")).status, 200);
  const nickCookieNames = jar.names();

  console.log("\n== start view-as");
  const form = new URLSearchParams({ contactId: bmContact.id });
  const started = await go(jar, "/api/view-as/start", { method: "POST", body: form, headers: { "content-type": "application/x-www-form-urlencoded", origin: BASE } });
  check("start redirects into the site", short(started), "303 -> /hub");
  check("marker, banner and parked-session cookies are set", ["va", "va-ui"].every((n) => jar.map.has(n)) && jar.names().some((n) => n.startsWith("va-admin.")), true);
  check("banner shows his name", decodeURIComponent(decodeURIComponent(jar.map.get("va-ui") ?? "")), bmContact.full_name);
  check("the browser's session is now the best man's", await whoIs(jar), BM);
  const borrowedRefresh = (() => {
    const c = createServerClient(URL_, ANON, { cookies: { getAll: () => [...jar.map].map(([name, value]) => ({ name, value: decodeURIComponent(value) })), setAll: () => {} } });
    return c.auth.getSession().then((r) => r.data.session?.refresh_token ?? null);
  })();

  console.log("\n== what the best man sees");
  check("sign-in lands him on the project hub", short(await go(jar, "/hub")), "307 -> /project");
  check("project hub loads", (await go(jar, "/project")).status, 200);
  const cats = await go(jar, "/categories");
  check("categories list loads", cats.status, 200);
  check("…and lists the venue category", /Venue/.test(cats.text), true);
  const venue = await go(jar, "/categories/venue");
  check("venue page loads", venue.status, 200);
  check("…shows the venue options", /Chateau/.test(venue.text), true);
  // Field NAMES with null values travel in the page data ("predicted_cost_min":null);
  // what must never appear is a value, a money figure, or the cost sections.
  check("…shows NO price values, money figures or cost sections", !/"(?:predicted_cost_min|predicted_cost_max|actual_cost)":\s*\d|true total|Cost breakdown|(?:€|£|&pound;|&euro;)\s?\d/.test(venue.text), true);
  check("…offers no delete or pick-winner controls", !/Mark as winner|>Delete</.test(venue.text), true);
  check("groomsmen board loads", (await go(jar, "/project/groomsmen")).status, 200);
  check("bridesmaids board is closed to him", short(await go(jar, "/project/bridesmaids")), "307 -> /no-access");
  check("guest list is closed to him", short(await go(jar, "/guests")), "307 -> /no-access");
  check("budget is closed to him", short(await go(jar, "/budget")), "307 -> /no-access");
  check("roles & access is closed to him", short(await go(jar, "/access")), "307 -> /no-access");
  check("comms is closed to him", short(await go(jar, "/comms")), "307 -> /no-access");

  console.log("\n== read-only while viewing");
  check("an upload is refused", (await go(jar, "/api/upload", { method: "POST" })).status, 403);
  check("a server action post is refused", (await go(jar, "/project", { method: "POST", headers: { "next-action": "x" } })).status, 403);
  check("an event RSVP post is refused", (await go(jar, "/api/events/engagement-party/rsvp", { method: "POST" })).status, 403);
  check("a nested view-as is refused", (await go(jar, "/api/view-as/start", { method: "POST", body: form, headers: { origin: BASE } })).status, 403);
  check("still the best man afterwards", await whoIs(jar), BM);

  console.log("\n== exit");
  const refreshToken = await borrowedRefresh;
  const stopped = await go(jar, "/api/view-as/stop");
  check("exit returns to the guest list", short(stopped), "303 -> /guests");
  check("view-as cookies are gone", jar.names().filter((n) => n === "va" || n === "va-ui" || n.startsWith("va-admin.")).length, 0);
  check("same session cookies as before starting", JSON.stringify(jar.names()), JSON.stringify(nickCookieNames));
  check("the browser's session is Nick's again", await whoIs(jar), NICK);
  check("Nick reaches the guest list again", (await go(jar, "/guests")).status, 200);
  check("Nick can write again (no read-only block)", (await go(jar, "/api/upload", { method: "POST" })).status, (s) => s !== 403);

  console.log("\n== only the borrowed session was closed");
  const dead = await anonClient().auth.refreshSession({ refresh_token: refreshToken });
  check("the borrowed session can no longer be refreshed", !!dead.error, true);
  const alive = await phone.client.auth.refreshSession({ refresh_token: phone.session.refresh_token });
  check("his own separate session still works", !alive.error && alive.data.user?.email?.toLowerCase(), BM);
  if (!alive.error) phone.session = alive.data.session;

  console.log("\n== record keeping");
  const { data: audit } = await admin.from("admin_audit").select("action, actor_id, target_contact_id").like("action", "viewas.%").order("created_at", { ascending: false }).limit(2);
  check("start and stop were both logged", audit.map((a) => a.action).sort().join(","), "viewas.start,viewas.stop");
  check("…against Nick, about this guest", audit.every((a) => a.actor_id === nickBefore.id && a.target_contact_id === bmContact.id), true);
  const auditAfter = (await admin.from("admin_audit").select("id", { count: "exact", head: true }).like("action", "viewas.%")).count ?? 0;
  check("exactly two log lines added", auditAfter - auditBefore, 2);
} finally {
  // Clean up every session this test opened, and put timestamps back.
  if (phone) await phone.client.auth.setSession(phone.session).then(() => phone.client.auth.signOut({ scope: "local" })).catch(() => {});
  if (nickSession) await nickSession.client.auth.signOut({ scope: "local" }).catch(() => {});
  await admin.rpc("fn_admin_restore_last_sign_in", { p_user_id: bmBefore.id, p_last_sign_in_at: bmBefore.at });
  await admin.rpc("fn_admin_restore_last_sign_in", { p_user_id: nickBefore.id, p_last_sign_in_at: nickBefore.at });
}

console.log("\n== left as found");
check("best man's 'last signed in' is unchanged", (await lastSignIn(BM)).at, bmBefore.at);
check("Nick's 'last signed in' is unchanged", (await lastSignIn(NICK)).at, nickBefore.at);

console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
