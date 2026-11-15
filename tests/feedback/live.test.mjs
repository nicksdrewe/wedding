// Live check of votes and comments against the REAL Supabase project and the
// local dev server (`npm run dev`). As the best man, through the real access
// rules: vote, comment, load the pages, then remove every test row. Needs
// migration 0037. Only run deliberately — it briefly opens a real session for
// the best man and puts his "last signed in" time back afterwards.
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

let failures = 0;
function check(label, got, want) {
  const ok = typeof want === "function" ? want(got) : got === want;
  if (!ok) failures++;
  console.log(`${ok ? "  ok  " : "  FAIL"} ${label}: ${JSON.stringify(got)}${ok || typeof want === "function" ? "" : `  (wanted ${JSON.stringify(want)})`}`);
}
const MARK = `[test ${Date.now()}]`;

const { data: bm } = await admin.from("contacts").select("id, full_name, email").contains("tags", ["best_man"]).is("parent_contact_id", null).single();
const { data: groomsman } = await admin.from("contacts").select("id, email").contains("tags", ["groomsman"]).is("parent_contact_id", null).limit(1).single();
const users = (await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })).data.users;
const userOf = (email) => users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
const bmUser = userOf(bm.email);
const bmBefore = bmUser.last_sign_in_at ?? null;

const { data: venueOption } = await admin.from("page_options").select("id, name, option_groups!inner(category_page_id)").not("option_groups.category_page_id", "is", null).limit(1).single();
const { data: stagGroup } = await admin.from("option_groups").select("id").eq("visible_tag", "groomsman").limit(1).maybeSingle();
console.log(`best man: ${bm.full_name} | venue option: ${venueOption.name}`);

async function session(email) {
  const link = await admin.auth.admin.generateLink({ type: "magiclink", email });
  const c = createClient(URL_, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
  const v = await c.auth.verifyOtp({ token_hash: link.data.properties.hashed_token, type: "magiclink" });
  if (v.error) throw new Error(v.error.message);
  return { client: c, session: v.data.session };
}
function cookieHeader(sess) {
  const jar = new Map();
  const w = createServerClient(URL_, ANON, { cookies: { getAll: () => [], setAll: (l) => l.forEach(({ name, value }) => jar.set(name, encodeURIComponent(value))) } });
  return w.auth.setSession({ access_token: sess.access_token, refresh_token: sess.refresh_token }).then(() => [...jar].map(([k, v]) => `${k}=${v}`).join("; "));
}

let bmSess, gmSess;
try {
  bmSess = await session(bm.email);
  const cookie = await cookieHeader(bmSess.session);
  const page = async (path, c = cookie) => {
    const res = await fetch(BASE + path, { headers: { cookie: c }, redirect: "manual" });
    return { status: res.status, html: res.status === 200 ? await res.text() : "" };
  };

  console.log("\n== pages render before any feedback exists");
  for (const p of ["/categories/venue", "/project", "/project/groomsmen", "/project/ideas"]) {
    check(`${p} loads`, (await page(p)).status, 200);
  }

  console.log("\n== vote and comment as the best man, through the real rules");
  const vote = await bmSess.client.from("reactions").upsert({ target_type: "page_option", target_id: venueOption.id, profile_id: bmUser.id, value: 1 }, { onConflict: "target_type,target_id,profile_id" }).select("author_name, value");
  check("vote saved", vote.error?.message ?? vote.data?.length, 1);
  check("name stamped by the server", vote.data?.[0]?.author_name, bm.full_name);
  const flip = await bmSess.client.from("reactions").upsert({ target_type: "page_option", target_id: venueOption.id, profile_id: bmUser.id, value: -1 }, { onConflict: "target_type,target_id,profile_id" }).select("value");
  check("changing the vote works", flip.data?.[0]?.value, -1);
  const cm = await bmSess.client.from("comments").insert({ target_type: "page_option", target_id: venueOption.id, profile_id: bmUser.id, body: `${MARK} Lovely grounds` }).select("id, author_name");
  check("comment saved", cm.error?.message ?? cm.data?.length, 1);

  console.log("\n== the venue page shows it");
  const venue = await page("/categories/venue");
  check("comment text appears (in the page data for the thread)", venue.html.includes(`${MARK} Lovely grounds`), true);
  check("author's name appears", venue.html.includes(bm.full_name), true);
  check("still no prices", !/"(?:predicted_cost_min|predicted_cost_max|actual_cost)":\s*\d|(?:€|£|&pound;|&euro;)\s?\d/.test(venue.html), true);
  check("collapsed card shows the thumbs-down + comment summary", /Thumbs down/.test(venue.html) && /Comments/.test(venue.html), true);

  console.log("\n== privacy across the two boards");
  if (stagGroup) {
    const stagOpt = await admin.from("page_options").select("id").eq("option_group_id", stagGroup.id).limit(1).maybeSingle();
    if (stagOpt.data) {
      const stagComment = await bmSess.client.from("comments").insert({ target_type: "page_option", target_id: stagOpt.data.id, profile_id: bmUser.id, body: `${MARK} stag secret` }).select("id");
      check("best man can comment on a groomsmen-board option", stagComment.error?.message ?? stagComment.data?.length, 1);
      check("…and it shows on the groomsmen page", (await page("/project/groomsmen")).html.includes(`${MARK} stag secret`), true);
      const mohContact = await admin.from("contacts").select("email").contains("tags", ["maid_of_honour"]).is("parent_contact_id", null).single();
      const mohSess = await session(mohContact.data.email);
      try {
        const mohCookie = await cookieHeader(mohSess.session);
        const seen = await mohSess.client.from("comments").select("id").like("body", `${MARK}%`);
        check("maid of honour sees the venue comment but NOT the stag one", seen.data?.length, 1);
        check("…her bridesmaids page has no trace of it", !(await page("/project/bridesmaids", mohCookie)).html.includes("stag secret"), true);
      } finally {
        await mohSess.client.auth.signOut({ scope: "local" }).catch(() => {});
        const mu = userOf(mohContact.data.email);
        await admin.rpc("fn_admin_restore_last_sign_in", { p_user_id: mu.id, p_last_sign_in_at: mu.last_sign_in_at ?? null });
      }
    }
  }

  console.log("\n== edit and delete");
  const own = await bmSess.client.from("comments").update({ body: `${MARK} Lovely grounds!` }).eq("id", cm.data[0].id).select("edited_at");
  check("edit own comment, marked as edited", !!own.data?.[0]?.edited_at, true);
  if (groomsman) {
    gmSess = await session(groomsman.email);
    const del = await gmSess.client.from("comments").delete().eq("id", cm.data[0].id).select("id");
    check("another member can't delete it", del.data?.length ?? 0, 0);
    const rmVote = await gmSess.client.from("reactions").delete().eq("profile_id", bmUser.id).select("id");
    check("…or remove his vote", rmVote.data?.length ?? 0, 0);
  }
} finally {
  // Remove every test row and session; put timestamps back.
  await admin.from("comments").delete().like("body", `${MARK}%`);
  await admin.from("reactions").delete().eq("profile_id", bmUser.id).eq("target_id", venueOption.id);
  if (bmSess) await bmSess.client.auth.signOut({ scope: "local" }).catch(() => {});
  if (gmSess) {
    await gmSess.client.auth.signOut({ scope: "local" }).catch(() => {});
    const gu = userOf(groomsman.email);
    await admin.rpc("fn_admin_restore_last_sign_in", { p_user_id: gu.id, p_last_sign_in_at: gu.last_sign_in_at ?? null });
  }
  await admin.rpc("fn_admin_restore_last_sign_in", { p_user_id: bmUser.id, p_last_sign_in_at: bmBefore });
}

const left = await admin.from("comments").select("id", { count: "exact", head: true }).like("body", `${MARK}%`);
check("test comments cleaned up", left.count, 0);
console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
