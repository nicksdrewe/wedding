import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { slugFromInboxAddress } from "@/lib/email/sender";
import { notifyProfiles } from "@/lib/push/send";
import { verifyWebhook } from "@/lib/email/webhook";

// Resend calls this when an email arrives at <slug>@WEDDING_INBOX_DOMAIN
// (event "email.received"). It is filed in that wedding's inbox, matched to a
// guest by their address, and the couple get a notification.
//
// Public, so every request must carry Resend's signature (Svix scheme, secret
// RESEND_WEBHOOK_SECRET). Anything unsigned, stale or for an unknown wedding is
// dropped. Answers 200 for anything it chooses to ignore, so Resend doesn't retry.

export const runtime = "nodejs";

type Received = {
  email_id?: string;
  id?: string;
  from?: string;
  to?: string[] | string;
  subject?: string;
  text?: string | null;
  html?: string | null;
  attachments?: unknown[];
};

// The webhook carries the envelope; the body is fetched from Resend.
async function fetchBody(id: string): Promise<Pick<Received, "text" | "html"> | null> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;
  try {
    const res = await fetch(`https://api.resend.com/emails/receiving/${encodeURIComponent(id)}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) return null;
    const j = (await res.json()) as Received;
    return { text: j.text ?? null, html: j.html ?? null };
  } catch {
    return null;
  }
}

function parseFrom(from: string) {
  const m = from.match(/^\s*"?([^"<]*)"?\s*<([^>]+)>\s*$/);
  return m ? { name: m[1].trim() || null, email: m[2].trim().toLowerCase() } : { name: null, email: from.trim().toLowerCase() };
}

// A readable plain-text body when only HTML came through.
function textFromHtml(html: string) {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|tr|h\d)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

type CampaignEvent = { type?: string; data?: { to?: string[] | string; tags?: Record<string, string> | { name: string; value: string }[]; click?: { link?: string } } };
const CAMPAIGN_KINDS: Record<string, string> = {
  "email.delivered": "delivered",
  "email.opened": "opened",
  "email.clicked": "clicked",
  "email.bounced": "bounced",
  "email.complained": "complained",
};

async function recordCampaignEvent(event: CampaignEvent): Promise<boolean> {
  const kind = CAMPAIGN_KINDS[event.type ?? ""];
  if (!kind || !event.data) return false;
  const tags = event.data.tags;
  const campaign = Array.isArray(tags) ? tags.find((t) => t.name === "campaign")?.value : tags?.campaign;
  if (!campaign || !/^[0-9a-f-]{36}$/i.test(campaign)) return true; // someone else's email: nothing to record
  const to = Array.isArray(event.data.to) ? event.data.to[0] : event.data.to;
  if (!to) return true;
  const admin = createAdminClient();
  await admin.from("platform_campaign_events").insert({ campaign_id: campaign, email: to.toLowerCase(), kind, link: event.data.click?.link ?? null });
  // a complaint is a firm "stop"
  if (kind === "complained") await admin.from("platform_unsubscribes").upsert({ email: to.toLowerCase() });
  return true;
}

export async function POST(request: Request) {
  const raw = await request.text();
  if (!verifyWebhook(raw, request.headers, process.env.RESEND_WEBHOOK_SECRET)) return NextResponse.json({ error: "bad signature" }, { status: 401 });

  let event: { type?: string; data?: Received };
  try {
    event = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "bad body" }, { status: 400 });
  }
  // Delivery reports for the owner's newsletters (tagged campaign=<id>).
  const tracked = await recordCampaignEvent(event as CampaignEvent);
  if (tracked) return NextResponse.json({ tracked: true });

  if (event.type !== "email.received" || !event.data) return NextResponse.json({ ignored: true });

  const d = event.data;
  const providerId = d.email_id ?? d.id ?? null;

  // Site addresses that simply forward somewhere (e.g. privacy@ to whoever
  // handles privacy requests). EMAIL_FORWARDS = "privacy@domain=someone@example.com,…",
  // kept in the hosting settings so personal addresses stay out of the code.
  const forwards = new Map(
    (process.env.EMAIL_FORWARDS ?? "")
      .split(",")
      .map((pair) => pair.split("=").map((x) => x.trim().toLowerCase()))
      .filter((p) => p.length === 2 && p[0].includes("@") && p[1].includes("@")) as [string, string][]
  );
  const toList = (Array.isArray(d.to) ? d.to : d.to ? [d.to] : []).map((t) => parseFrom(t).email);
  const forwardFrom = toList.find((t) => forwards.has(t));
  if (forwardFrom && d.from) {
    const body = (providerId ? await fetchBody(providerId) : null) ?? { text: d.text ?? null, html: d.html ?? null };
    const sender = parseFrom(d.from);
    const note = `Sent to ${forwardFrom} by ${sender.name ? `${sender.name} <${sender.email}>` : sender.email}. Reply to answer them directly.`;
    const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const html =
      `<p style="font-family:Arial,sans-serif;font-size:12px;color:#5b5a52;border-bottom:1px solid #ddd;padding-bottom:8px">${esc(note)}` +
      (Array.isArray(d.attachments) && d.attachments.length ? ` (${d.attachments.length} attachment(s) not forwarded: see the inbox in Resend.)` : "") +
      `</p>` +
      (body.html ?? `<pre style="white-space:pre-wrap;font-family:inherit">${esc(body.text ?? "")}</pre>`);
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: `"${(sender.name ?? sender.email).replace(/["\r\n]/g, "")} via Weddings Weddings" <${forwardFrom}>`,
        to: forwards.get(forwardFrom),
        reply_to: sender.email,
        subject: `[${forwardFrom.split("@")[0]}] ${d.subject ?? "(no subject)"}`,
        html,
        text: `${note}\n\n${body.text ?? (body.html ? textFromHtml(body.html) : "")}`,
      }),
    });
    if (!res.ok) return NextResponse.json({ error: "forward failed" }, { status: 502 });
    return NextResponse.json({ forwarded: true });
  }

  const recipients = (Array.isArray(d.to) ? d.to : d.to ? [d.to] : []).map((t) => ({ to: t, slug: slugFromInboxAddress(t) }));
  const target = recipients.find((r) => r.slug);
  if (!target?.slug || !d.from) return NextResponse.json({ ignored: true });

  const admin = createAdminClient();
  const { data: wedding } = await admin.from("weddings").select("id, status").eq("slug", target.slug).maybeSingle();
  if (!wedding || wedding.status !== "active") return NextResponse.json({ ignored: true });

  const body = (providerId ? await fetchBody(providerId) : null) ?? { text: d.text ?? null, html: d.html ?? null };
  const from = parseFrom(d.from);
  const scoped = createAdminClient(wedding.id);

  const escaped = from.email.replace(/[%_\\*]/g, "\\$&");
  const { data: contact } = await scoped
    .from("contacts")
    .select("id, full_name")
    .eq("wedding_id", wedding.id)
    .ilike("email", escaped)
    .limit(1)
    .maybeSingle();

  const html = body.html?.slice(0, 500_000) ?? null;
  const { error } = await scoped.from("inbound_emails").upsert(
    {
      wedding_id: wedding.id,
      provider_id: providerId,
      from_email: from.email.slice(0, 320),
      from_name: (from.name ?? contact?.full_name ?? null)?.slice(0, 200) ?? null,
      contact_id: contact?.id ?? null,
      to_email: target.to.slice(0, 320),
      subject: (d.subject ?? "").slice(0, 500),
      body_text: (body.text ?? (html ? textFromHtml(html) : "")).slice(0, 100_000),
      body_html: html,
      attachment_count: Array.isArray(d.attachments) ? d.attachments.length : 0,
    },
    { onConflict: "wedding_id,provider_id", ignoreDuplicates: true }
  );
  if (error) return NextResponse.json({ error: "could not file" }, { status: 500 });

  // Tell the couple.
  const { data: couple } = await scoped
    .from("contacts")
    .select("user_id")
    .eq("wedding_id", wedding.id)
    .eq("role", "couple")
    .not("user_id", "is", null);
  const who = contact?.full_name ?? from.name ?? from.email;
  await notifyProfiles(
    (couple ?? []).map((c) => c.user_id as string),
    "guest_reply",
    { title: `Email from ${who}`, body: d.subject || "(no subject)", url: "/comms?tab=inbox" }
  );

  return NextResponse.json({ ok: true });
}
