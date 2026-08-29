import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/roles";
import { EngagementPageClient } from "./EngagementPageClient";

// Server wrapper: fetches real photos (public read — see
// 0008_engagement_photos.sql, this page has no auth requirement of its
// own) and whether the current visitor is the couple, so the client
// component below knows whether to show upload/remove controls. Kept as a
// thin wrapper rather than converting the whole page to a server
// component, since the gallery/RSVP form/scroll reveals all need client
// state and event handlers.
export default async function EngagementPartyPage() {
  const supabase = await createClient();
  const { data: photos } = await supabase
    .from("engagement_photos")
    .select("id, image_url, caption")
    .order("sort_order");

  const profile = await getCurrentProfile();
  const isCouple = profile?.role === "couple";

  return <EngagementPageClient photos={photos ?? []} isCouple={isCouple} />;
}
