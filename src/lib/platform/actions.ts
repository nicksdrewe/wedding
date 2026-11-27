"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePlatformAdmin } from "./auth";
import { COPY_FIELDS } from "@/lib/commercial/copy";
import { newsletterHtml, unsubscribeUrl } from "./newsletter";
import { loadPlatformStats } from "./stats";
import { SITE_NAME } from "@/lib/commercial/pricing";

// Everything the owner's console changes. Each action checks the owner first;
// only then is the service role used.

type Result = { ok: true; message?: string } | { ok: false; error: string };

async function owner() {
  const u = await requirePlatformAdmin();
  if (!u) throw new Error("Not allowed");
  return u;
}

// ── site words ────────────────────────────────────────────────────────────
export async function saveCopy(values: Record<string, string>): Promise<Result> {
  await owner();
  const admin = createAdminClient();
  const known = new Map(COPY_FIELDS.map((f) => [f.key, f.value]));
  const upserts: { key: string; value: string; updated_at: string }[] = [];
  const resets: string[] = [];
  for (const [key, raw] of Object.entries(values)) {
    if (!known.has(key)) continue;
    const value = raw.trim();
    if (!value || value === known.get(key)) resets.push(key);
    else upserts.push({ key, value, updated_at: new Date().toISOString() });
  }
  if (upserts.length) {
    const { error } = await admin.from("site_copy").upsert(upserts);
    if (error) return { ok: false, error: error.message };
  }
  if (resets.length) {
    const { error } = await admin.from("site_copy").delete().in("key", resets);
    if (error) return { ok: false, error: error.message };
  }
  revalidatePath("/www", "layout");
  revalidatePath("/", "layout");
  return { ok: true, message: `Saved ${upserts.length} change${upserts.length === 1 ? "" : "s"}${resets.length ? `, ${resets.length} back to the original` : ""}.` };
}

// ── newsletters ───────────────────────────────────────────────────────────
export async function saveCampaign(input: { id?: string; subject: string; body: string }): Promise<Result & { id?: string }> {
  await owner();
  const subject = input.subject.trim();
  const body = input.body.trim();
  if (!subject || !body) return { ok: false, error: "It needs a subject and something to say." };
  const admin = createAdminClient();
  if (input.id) {
    const { error } = await admin.from("platform_campaigns").update({ subject, body }).eq("id", input.id).eq("status", "draft");
    if (error) return { ok: false, error: error.message };
    revalidatePath("/platform/newsletters");
    return { ok: true, id: input.id, message: "Draft saved." };
  }
  const { data, error } = await admin.from("platform_campaigns").insert({ subject, body }).select("id").single();
  if (error) return { ok: false, error: error.message };
  revalidatePath("/platform/newsletters");
  return { ok: true, id: data.id, message: "Draft saved." };
}

export async function deleteCampaign(id: string): Promise<Result> {
  await owner();
  const { error } = await createAdminClient().from("platform_campaigns").delete().eq("id", id).eq("status", "draft");
  if (error) return { ok: false, error: error.message };
  revalidatePath("/platform/newsletters");
  return { ok: true };
}

/** Couples on every wedding, less anyone who's unsubscribed. */
async function audience() {
  const admin = createAdminClient();
  const [{ data: contacts }, { data: unsubs }] = await Promise.all([
    admin.from("contacts").select("email, role").eq("role", "couple").not("email", "is", null),
    admin.from("platform_unsubscribes").select("email"),
  ]);
  const out = new Set((contacts ?? []).map((c) => (c.email as string).trim().toLowerCase()).filter((e) => e.includes("@")));
  for (const u of unsubs ?? []) out.delete((u.email as string).toLowerCase());
  return [...out];
}

export async function audienceSize(): Promise<number> {
  await owner();
  return (await audience()).length;
}

function sender() {
  const from = process.env.RESEND_FROM_EMAIL;
  if (!from) return null;
  const address = from.match(/<([^>]+)>/)?.[1] ?? from.trim();
  return `"${SITE_NAME}" <${address}>`;
}

async function resendBatch(emails: object[]) {
  const res = await fetch("https://api.resend.com/emails/batch", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(emails),
  });
  if (!res.ok) {
    const b = await res.json().catch(() => null);
    throw new Error(b?.message ?? `Resend returned ${res.status}`);
  }
}

export async function sendTest(input: { subject: string; body: string }): Promise<Result> {
  const me = await owner();
  const from = sender();
  if (!from || !process.env.RESEND_API_KEY || !me.email) return { ok: false, error: "Email sending isn't set up (RESEND_API_KEY / RESEND_FROM_EMAIL)." };
  try {
    await resendBatch([{ from, to: me.email, subject: `[Test] ${input.subject}`, html: newsletterHtml(input.body, me.email) }]);
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  return { ok: true, message: `Test sent to ${me.email}.` };
}

export async function sendCampaign(id: string): Promise<Result> {
  await owner();
  const admin = createAdminClient();
  const from = sender();
  if (!from || !process.env.RESEND_API_KEY) return { ok: false, error: "Email sending isn't set up (RESEND_API_KEY / RESEND_FROM_EMAIL)." };
  const { data: c } = await admin.from("platform_campaigns").select("*").eq("id", id).single();
  if (!c) return { ok: false, error: "Newsletter not found." };
  if (c.status === "sent") return { ok: false, error: "That one has already gone out." };
  // claim it first so a double click can't send twice
  const { data: claimed } = await admin.from("platform_campaigns").update({ status: "sent", sent_at: new Date().toISOString() }).eq("id", id).eq("status", "draft").select("id");
  if (!claimed?.length) return { ok: false, error: "That one has already gone out." };

  const to = await audience();
  let sent = 0;
  try {
    for (let i = 0; i < to.length; i += 100) {
      const chunk = to.slice(i, i + 100);
      await resendBatch(
        chunk.map((email) => ({
          from,
          to: email,
          subject: c.subject,
          html: newsletterHtml(c.body, email),
          headers: { "List-Unsubscribe": `<${unsubscribeUrl(email, true)}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
          tags: [{ name: "campaign", value: id }],
        }))
      );
      await admin.from("platform_campaign_events").insert(chunk.map((email) => ({ campaign_id: id, email, kind: "sent" })));
      sent += chunk.length;
    }
  } catch (e) {
    await admin.from("platform_campaigns").update({ recipients: sent }).eq("id", id);
    revalidatePath("/platform/newsletters");
    return { ok: false, error: `Stopped after ${sent} of ${to.length}: ${(e as Error).message}` };
  }
  await admin.from("platform_campaigns").update({ recipients: sent }).eq("id", id);
  revalidatePath("/platform/newsletters");
  return { ok: true, message: `Sent to ${sent} couple${sent === 1 ? "" : "s"}.` };
}

/** A first draft written from this month's numbers, to edit before sending. */
export async function draftFromNumbers(): Promise<{ subject: string; body: string }> {
  await owner();
  const s = await loadPlatformStats();
  const month = new Date().toLocaleDateString("en-GB", { month: "long" });
  const newWeddings = s.weeks.slice(-4).reduce((n, w) => n + w.weddings, 0);
  return {
    subject: `What's new on ${SITE_NAME} this ${month}`,
    body: [
      `Hello from ${SITE_NAME},`,
      `A quick note on what's been happening, and a couple of things you might not have found yet.`,
      `# This month in numbers`,
      [
        `- **${s.kpis.weddings}** weddings are being planned here${newWeddings ? ` (${newWeddings} started in the last four weeks)` : ""}`,
        `- **${s.kpis.actions30.toLocaleString("en-GB")}** decisions, tasks, comments and messages made in the last 30 days`,
        `- **${s.kpis.replies.toLocaleString("en-GB")}** RSVP replies collected so far`,
      ].join("\n"),
      `# Worth a look`,
      `Turn the examples switch on in your site's header to see a fully planned wedding: boards, budgets and a running order, all filled in. Turn it off and they vanish.`,
      `# Tell us what's missing`,
      `Just reply to this email. Every reply gets read, and a lot of what's on the site started as one.`,
      `Happy planning,\nThe ${SITE_NAME} team`,
    ].join("\n\n"),
  };
}

// ── social planner ────────────────────────────────────────────────────────
export async function savePost(input: { id?: string; channel: string; body: string; link?: string; image_url?: string; planned_for?: string | null; status?: string }): Promise<Result> {
  await owner();
  const row = {
    channel: ["facebook", "instagram", "both"].includes(input.channel) ? input.channel : "facebook",
    body: input.body.trim(),
    link: input.link?.trim() || null,
    image_url: input.image_url?.trim() || null,
    planned_for: input.planned_for || null,
    status: ["idea", "scheduled", "posted"].includes(input.status ?? "") ? input.status : "idea",
  };
  if (!row.body) return { ok: false, error: "Write the post first." };
  const admin = createAdminClient();
  const { error } = input.id ? await admin.from("platform_social_posts").update(row).eq("id", input.id) : await admin.from("platform_social_posts").insert(row);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/platform/marketing");
  return { ok: true };
}

export async function setPostStatus(id: string, status: "idea" | "scheduled" | "posted"): Promise<Result> {
  await owner();
  const { error } = await createAdminClient().from("platform_social_posts").update({ status }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/platform/marketing");
  return { ok: true };
}

export async function deletePost(id: string): Promise<Result> {
  await owner();
  const { error } = await createAdminClient().from("platform_social_posts").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/platform/marketing");
  return { ok: true };
}
