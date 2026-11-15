// Exercises the view-as guard (middleware) and exit route on the local dev
// server using hand-made cookies. No sign-in involved: the borrowed-session
// cookies here are fakes, which is fine — the guard decides before any
// session is looked at.
import fs from "node:fs";

import { fileURLToPath } from "node:url";
const ROOT = fileURLToPath(new URL("../../", import.meta.url)).split("\\").join("/").replace(new RegExp("/$"), "");
for (const l of fs.readFileSync(`${ROOT}/.env.local`, "utf8").split(/\r?\n/)) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
}
const { signViewAs, verifyViewAs } = await import(new URL("../../src/lib/view-as/cookie.ts", import.meta.url).href);

const BASE = "http://localhost:3000";
const ref = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname.split(".")[0];
const SB = `sb-${ref}-auth-token`;
let failures = 0;
function check(label, got, want) {
  const ok = got === want;
  if (!ok) failures++;
  console.log(`${ok ? "  ok  " : "  FAIL"} ${label}: ${JSON.stringify(got)}${ok ? "" : `  (wanted ${JSON.stringify(want)})`}`);
}

const now = Math.floor(Date.now() / 1000);
const payload = (exp) => ({
  actorId: "11111111-1111-1111-1111-111111111111",
  targetUserId: "22222222-2222-2222-2222-222222222222",
  targetContactId: "33333333-3333-3333-3333-333333333333",
  targetName: "Test Person",
  exp,
});
const valid = await signViewAs(payload(now + 600));
const expired = await signViewAs(payload(now - 5));
const tampered = (() => {
  // Swap the body for one naming a different actor, keep the old signature.
  const forged = Buffer.from(JSON.stringify({ ...payload(now + 600), actorId: "99999999-9999-9999-9999-999999999999" })).toString("base64url");
  return `${forged}.${valid.split(".")[1]}`;
})();

console.log("== signing");
check("valid marker verifies", (await verifyViewAs(valid))?.targetName, "Test Person");
check("expired marker rejected", await verifyViewAs(expired), null);
check("tampered marker rejected", await verifyViewAs(tampered), null);
check("garbage rejected", await verifyViewAs("not-a-marker"), null);
check("empty rejected", await verifyViewAs(undefined), null);

const STASH = `va-admin.${SB}=parked-couple-session`;
const LIVE = `${SB}=borrowed-session`;
async function hit(path, { method = "GET", cookies = [] } = {}) {
  const res = await fetch(BASE + path, { method, redirect: "manual", headers: { cookie: cookies.join("; ") } });
  const loc = res.headers.get("location");
  return { status: res.status, to: loc ? new URL(loc, BASE).pathname : null, setCookie: res.headers.getSetCookie?.() ?? [], body: res.status === 403 ? await res.text() : "" };
}
const short = (r) => `${r.status}${r.to ? " -> " + r.to : ""}`;

console.log("\n== guard: active view-as (valid marker + parked session)");
const active = [`va=${valid}`, STASH, LIVE];
check("reading a page carries on to normal handling", short(await hit("/guests", { cookies: active })), "307 -> /login"); // fake session => treated as signed out, i.e. the guard let it through
check("POST to a page (server action) is refused", (await hit("/guests", { method: "POST", cookies: active })).status, 403);
check("POST to an API route is refused", (await hit("/api/upload", { method: "POST", cookies: active })).status, 403);
check("PUT is refused", (await hit("/api/upload", { method: "PUT", cookies: active })).status, 403);
check("DELETE is refused", (await hit("/guests", { method: "DELETE", cookies: active })).status, 403);
check("starting a second view-as is refused", (await hit("/api/view-as/start", { method: "POST", cookies: active })).status, 403);
check("refusal explains itself", /read-only/.test((await hit("/guests", { method: "POST", cookies: active })).body), true);
check("signing out is sent to the exit route instead", short(await hit("/logout", { cookies: active })), "303 -> /api/view-as/stop");

console.log("\n== guard: anything untrustworthy ends the view-as");
check("expired marker + parked session", short(await hit("/guests", { cookies: [`va=${expired}`, STASH, LIVE] })), "303 -> /api/view-as/stop");
check("tampered marker + parked session", short(await hit("/guests", { cookies: [`va=${tampered}`, STASH, LIVE] })), "303 -> /api/view-as/stop");
check("no marker + parked session", short(await hit("/guests", { cookies: [STASH, LIVE] })), "303 -> /api/view-as/stop");
check("valid marker but no parked session", short(await hit("/guests", { cookies: [`va=${valid}`, LIVE] })), "303 -> /api/view-as/stop");
check("expired + a POST is also ended, not processed", short(await hit("/guests", { method: "POST", cookies: [`va=${expired}`, STASH, LIVE] })), "303 -> /api/view-as/stop");
check("public page while expired is ended too", short(await hit("/", { cookies: [`va=${expired}`, STASH, LIVE] })), "303 -> /api/view-as/stop");

console.log("\n== guard: stays out of the way otherwise");
check("no view-as cookies: page behaves as before", short(await hit("/guests")), "307 -> /login");
check("no view-as cookies: public page still loads", (await hit("/gifts")).status, 200);
check("no view-as cookies: start needs a real session", short(await hit("/api/view-as/start", { method: "POST" })), "307 -> /login");

console.log("\n== exit route");
const cookieNames = (r, pred) => r.setCookie.map((c) => c.split(";")[0]).filter(pred);
let r = await hit("/api/view-as/stop", { cookies: active });
check("active: goes back to the guest list", short(r), "303 -> /guests");
check("active: couple's parked session is put back", cookieNames(r, (c) => c === `${SB}=parked-couple-session`).length, 1);
check("active: borrowed session value is NOT kept", cookieNames(r, (c) => c.includes("borrowed-session")).length, 0);
const cleared = (r, name) => r.setCookie.some((c) => c.startsWith(`${name}=;`) || (c.startsWith(`${name}=`) && /max-age=0|expires=thu, 01 jan 1970/i.test(c)));
check("active: marker cleared", cleared(r, "va"), true);
check("active: banner cookie cleared", cleared(r, "va-ui"), true);
check("active: parked copy cleared", cleared(r, `va-admin.${SB}`), true);

r = await hit("/api/view-as/stop", { cookies: [`va=${expired}`, STASH, LIVE] });
check("expired: still restores the couple's session", cookieNames(r, (c) => c === `${SB}=parked-couple-session`).length, 1);
check("expired: goes back to the guest list", short(r), "303 -> /guests");

r = await hit("/api/view-as/stop", { cookies: [`va=${valid}`, LIVE] });
check("marker but nothing parked: borrowed session dropped, sent to sign in", short(r), "303 -> /login");
check("marker but nothing parked: no session cookie left behind", cookieNames(r, (c) => c.startsWith(SB) && !c.endsWith("=")).length, 0);

r = await hit("/api/view-as/stop");
check("nothing to end: harmless redirect", short(r), "303 -> /hub");
check("nothing to end: does not touch a normal session", cookieNames(r, (c) => c.startsWith(SB)).length, 0);

r = await hit("/api/view-as/stop", { cookies: [`va-admin.evil-cookie=attacker-value`, `va=${valid}`] });
check("a parked cookie with a non-session name is never restored", cookieNames(r, (c) => c.startsWith("evil-cookie")).length, 0);

console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
