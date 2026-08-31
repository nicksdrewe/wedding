import { redirect } from "next/navigation";

// The engagement party used to be a bespoke, hand-built page living
// here — it's now the first event created through the generic events
// system (see 0018_migrate_engagement_party.sql), served at
// /events/engagement-party. This redirect exists purely so the URL
// itself never breaks: it may already be shared, bookmarked, or in a
// QR code by the time this migration ships.
export default function EngagementPartyRedirect() {
  redirect("/events/engagement-party");
}
