"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email/resend";
import { weddingFrom, weddingReplyTo } from "@/lib/email/sender";
import { getCurrentWedding } from "@/lib/wedding/current";

// Couple-only reads/writes, enforced by RLS (see 0015_comms.sql) — same
// session-aware-client pattern as guests/actions.ts.

const createMessageSchema = z.object({
  subject: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(20000),
  bodyType: z.enum(["text", "html"]),
});

export async function createMessage(subject: string, body: string, bodyType: "text" | "html") {
  const parsed = createMessageSchema.parse({ subject, body, bodyType });
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("comms_messages")
    .insert({
      subject: parsed.subject,
      body: parsed.body,
      body_type: parsed.bodyType,
      created_by: user?.id ?? null,
    })
    .select("id")
    .single();

  if (error || !data) return { messageId: null, error: error?.message ?? "Couldn't create message." };
  return { messageId: data.id as string, error: null };
}

function firstName(fullName: string) {
  return fullName.trim().split(/\s+/)[0] ?? fullName;
}

// {{name}} is the only template token, deliberately — this isn't meant to
// become a templating language, just enough to personalize a greeting
// without every send reading like a form letter.
function renderBody(template: string, contactName: string) {
  return template.replaceAll("{{name}}", firstName(contactName));
}

function toHtml(text: string) {
  // Plain-text compose box, not a rich editor — escape first so a stray
  // "<" in someone's note can't break the markup, then turn line breaks
  // into real paragraph/break structure so the sent email isn't one
  // run-on line.
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  const paragraphs = escaped
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 16px;">${p.replace(/\n/g, "<br />")}</p>`)
    .join("");
  return `<div style="font-family:Georgia,serif;font-size:15px;line-height:1.6;color:#232520;max-width:560px;">${paragraphs}</div>`;
}

// Sends to exactly one recipient and records the outcome — called once
// per contact from the client's own send loop (see lib/email/resend.ts
// for why this isn't a single action looping over the whole audience).
// Idempotent-ish: re-sending to a contact who already has a row for this
// message updates that row rather than creating a duplicate, so retrying
// a failed send from the UI doesn't fork the history.
export async function sendToRecipient(messageId: string, contactId: string) {
  const parsed = z.object({ messageId: z.string().uuid(), contactId: z.string().uuid() }).parse({
    messageId,
    contactId,
  });

  const supabase = await createClient();

  const [{ data: message, error: messageError }, { data: contact, error: contactError }] = await Promise.all([
    supabase.from("comms_messages").select("subject, body, body_type").eq("id", parsed.messageId).maybeSingle(),
    supabase.from("contacts").select("full_name, email").eq("id", parsed.contactId).maybeSingle(),
  ]);

  if (messageError || !message) return { error: "Message not found." };
  if (contactError || !contact) return { error: "Guest not found." };
  if (!contact.email) return { error: "No email on file for this guest." };

  const rendered = renderBody(message.body, contact.full_name);
  // "html" bodies (e.g. pasted from an external builder like Stripo) are
  // sent through as-is — they already carry their own markup/structure,
  // so running them through toHtml()'s escape-and-paragraph-wrap step
  // would both break their layout and show the couple's own tags as
  // literal text in the recipient's inbox.
  const html = message.body_type === "html" ? rendered : toHtml(rendered);
  // From the couple, at their own address; replies come back to their inbox.
  const wedding = await getCurrentWedding();
  const { error: sendError } = await sendEmail({
    to: contact.email,
    subject: message.subject,
    html,
    from: weddingFrom(wedding),
    replyTo: weddingReplyTo(wedding),
  });

  const { error: upsertError } = await supabase.from("comms_recipients").upsert(
    {
      message_id: parsed.messageId,
      contact_id: parsed.contactId,
      email: contact.email,
      status: sendError ? "failed" : "sent",
      error: sendError,
      sent_at: sendError ? null : new Date().toISOString(),
    },
    { onConflict: "message_id,contact_id" }
  );

  revalidatePath("/comms");

  if (sendError) return { error: sendError };
  if (upsertError) return { error: upsertError.message };
  return { error: null };
}

// Removes a message and its full send log (comms_recipients cascades via
// its FK — see 0015_comms.sql) — for clearing out a test send, or a
// message that's no longer relevant. Doesn't touch the emails already
// delivered to inboxes, only this app's own record of having sent them.
export async function deleteMessage(messageId: string) {
  const parsed = z.string().uuid().parse(messageId);
  const supabase = await createClient();

  const { error } = await supabase.from("comms_messages").delete().eq("id", parsed);

  revalidatePath("/comms");
  return { error: error?.message ?? null };
}

// ── the inbox: guests' replies (see 0059_wedding_inbox.sql) ──────────────────

export async function markInboundRead(id: string, read: boolean) {
  const parsed = z.string().uuid().parse(id);
  const supabase = await createClient();
  const { error } = await supabase
    .from("inbound_emails")
    .update({ read_at: read ? new Date().toISOString() : null })
    .eq("id", parsed);
  revalidatePath("/comms");
  return { error: error?.message ?? null };
}

export async function deleteInbound(id: string) {
  const parsed = z.string().uuid().parse(id);
  const supabase = await createClient();
  const { error } = await supabase.from("inbound_emails").delete().eq("id", parsed);
  revalidatePath("/comms");
  return { error: error?.message ?? null };
}

// Answer a reply from the site: it goes from the couple's address, so the
// guest's next answer comes back here too.
export async function replyToInbound(id: string, body: string) {
  const parsed = z
    .object({ id: z.string().uuid(), body: z.string().trim().min(1, "Write a reply first.").max(20000) })
    .safeParse({ id, body });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { data: mail } = await supabase
    .from("inbound_emails")
    .select("from_email, subject, body_text, received_at, from_name")
    .eq("id", parsed.data.id)
    .maybeSingle();
  if (!mail) return { error: "That email has gone." };

  const subject = /^re:/i.test(mail.subject) ? mail.subject : `Re: ${mail.subject || "your email"}`;
  const quoted = (mail.body_text as string)
    .split("\n")
    .slice(0, 60)
    .map((l) => `> ${l}`)
    .join("\n");
  const when = new Date(mail.received_at as string).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
  const html =
    toHtml(parsed.data.body) +
    `<div style="font-family:Georgia,serif;font-size:13px;color:#5b5a52;max-width:560px;border-left:2px solid #ddd;padding-left:12px;margin-top:8px;white-space:pre-wrap;">On ${when}, ${(mail.from_name ?? mail.from_email)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")} wrote:\n${quoted.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>`;

  const wedding = await getCurrentWedding();
  const { error } = await sendEmail({
    to: mail.from_email as string,
    subject,
    html,
    from: weddingFrom(wedding),
    replyTo: weddingReplyTo(wedding),
  });
  if (error) return { error };

  const now = new Date().toISOString();
  await supabase.from("inbound_emails").update({ replied_at: now, read_at: now }).eq("id", parsed.data.id);
  revalidatePath("/comms");
  return { error: null };
}
