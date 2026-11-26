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

export async function POST(request: Request) {
  const raw = await request.text();
  if (!verifyWebhook(raw, request.headers, process.env.RESEND_WEBHOOK_SECRET)) return NextResponse.json({ error: "bad signature" }, { status: 401 });

  let event: { type?: string; data?: Received };
  try {
    event = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "bad body" }, { status: 400 });
  }
  if (event.type !== "email.received" || !event.data) return NextResponse.json({ ignored: true });

  const d = event.data;
  const providerId = d.email_id ?? d.id ?? null;
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
