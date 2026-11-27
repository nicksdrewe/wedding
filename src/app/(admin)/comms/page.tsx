import { redirect } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/roles";
import Link from "next/link";
import { CommsComposer, type CommsContact } from "./CommsComposer";
import { Inbox, type InboundItem } from "./Inbox";
import { getCurrentWedding } from "@/lib/wedding/current";
import { weddingReplyTo } from "@/lib/email/sender";

export default async function CommsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const tab = (await searchParams).tab === "inbox" ? "inbox" : "send";
  // The (admin) layout now admits couple OR family (see 0028), but comms
  // must stay couple-only — this explicit check is the defense-in-depth
  // backstop for that, independent of the shared layout guard.
  const profile = await getCurrentProfile();
  if (profile?.role !== "couple") redirect("/no-access");

  const supabase = await createClient();

  const [{ data: contacts }, { data: rsvpEvents }, { data: messages }, { data: inbound }, wedding] = await Promise.all([
    supabase
      .from("contacts")
      .select("id, full_name, email, role, tags, rsvp_status, rsvps(event_id, attending)")
      .order("full_name"),
    // Every event with an open RSVP that's worth filtering an audience
    // by — the couple-managed set from the events system (see
    // 0017_events_system.sql), not a fixed "engagement"/"wedding" pair.
    supabase.from("events").select("id, name").eq("rsvp_enabled", true).order("starts_at", { nullsFirst: false }),
    supabase
      .from("comms_messages")
      .select("id, subject, created_at, comms_recipients(contact_id, email, status, sent_at, error)")
      .order("created_at", { ascending: false }),
    // Guests' replies (0059). Missing table before that runs: just empty.
    supabase
      .from("inbound_emails")
      .select("id, from_email, from_name, contact_id, subject, body_text, received_at, read_at, replied_at, attachment_count")
      .order("received_at", { ascending: false })
      .limit(200),
    getCurrentWedding(),
  ]);

  const events = rsvpEvents ?? [];
  const nameByContactId = new Map((contacts ?? []).map((c) => [c.id, c.full_name]));

  function rsvpStatusFor(rsvps: { event_id: string; attending: boolean | null }[] | null, eventId: string) {
    const rsvp = rsvps?.find((r) => r.event_id === eventId);
    if (!rsvp || rsvp.attending === null) return "pending";
    return rsvp.attending ? "attending" : "declined";
  }

  // Only guests with an email on file can ever actually be sent anything
  // — filtered out here rather than left for the send step to discover
  // one at a time, so the audience picker only ever shows people this
  // could really reach.
  const commsContacts: CommsContact[] = (contacts ?? [])
    .filter((c) => !!c.email)
    .map((c) => ({
      id: c.id,
      full_name: c.full_name,
      email: c.email as string,
      role: c.role,
      tags: c.tags ?? [],
      eventStatuses: Object.fromEntries(events.map((e) => [e.id, rsvpStatusFor(c.rsvps, e.id)])),
    }));

  const history = (messages ?? []).map((m) => {
    const recipients = m.comms_recipients ?? [];
    return {
      id: m.id,
      subject: m.subject,
      createdAt: m.created_at,
      total: recipients.length,
      sent: recipients.filter((r) => r.status === "sent").length,
      failed: recipients.filter((r) => r.status === "failed").length,
      recipients: recipients.map((r) => ({
        name: nameByContactId.get(r.contact_id) ?? r.email,
        email: r.email,
        status: r.status,
        sentAt: r.sent_at,
        error: r.error,
      })),
    };
  });

  const inbox: InboundItem[] = (inbound ?? []).map((m) => ({
    id: m.id,
    fromName: m.from_name,
    fromEmail: m.from_email,
    guestName: m.contact_id ? nameByContactId.get(m.contact_id) ?? null : null,
    subject: m.subject,
    body: m.body_text,
    receivedAt: m.received_at,
    read: !!m.read_at,
    repliedAt: m.replied_at,
    attachments: m.attachment_count,
  }));
  const unread = inbox.filter((m) => !m.read).length;
  const inboxAddress = weddingReplyTo(wedding)?.match(/<([^>]+)>/)?.[1] ?? null;
  const tabClass = (on: boolean) =>
    `inline-flex items-center gap-2 rounded-full px-4 py-2 text-[13px] font-semibold transition ${
      on ? "bg-forest text-cream" : "text-ink-soft hover:text-ink"
    }`;

  return (
    <div>
      <PageHeader
        eyebrow="Household"
        title="Guest Communications"
        infoText="Compose a message once, pick who it's for, and send — every send is logged so you always know who's already heard what."
      />

      <nav className="mt-6 inline-flex rounded-full border border-ink/10 bg-paper p-1" aria-label="Messages">
        <Link href="/comms" className={tabClass(tab === "send")} aria-current={tab === "send" ? "page" : undefined}>
          Send
        </Link>
        <Link href="/comms?tab=inbox" className={tabClass(tab === "inbox")} aria-current={tab === "inbox" ? "page" : undefined}>
          Inbox
          {unread > 0 && (
            <span className={`rounded-full px-1.5 text-[11px] tabular-nums ${tab === "inbox" ? "bg-cream text-forest" : "bg-sec text-cream"}`}>
              {unread}
            </span>
          )}
        </Link>
      </nav>

      {tab === "inbox" ? (
        <Inbox items={inbox} address={inboxAddress} />
      ) : commsContacts.length > 0 ? (
        <CommsComposer contacts={commsContacts} events={events} history={history} />
      ) : (
        <EmptyState
          className="mt-10"
          title="No guests with an email yet"
          hint="Add an email address to a guest on the guest list before you can message them."
        />
      )}
    </div>
  );
}
