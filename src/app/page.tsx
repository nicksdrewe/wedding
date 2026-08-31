import { ScrollFlowerHero, type HeroCta } from "@/components/ScrollFlowerHero";
import { SiteGate } from "@/components/SiteGate";
import { getAuthState, HOME_FOR_ROLE } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";

// Reads the session so a signed-in visitor is never shown the anonymous
// call-to-action — previously this page looked identical either way, which
// made a successful sign-in indistinguishable from a failed one.
export const dynamic = "force-dynamic";

export default async function LandingPage() {
  const state = await getAuthState();

  const cta: HeroCta =
    state.status === "ok"
      ? {
          kind: "signed-in",
          label: "Enter the planning hub",
          href: HOME_FOR_ROLE[state.profile.role],
        }
      : state.status === "no-profile"
      ? { kind: "no-profile" }
      : { kind: "guest" };

  // Whichever event (if any) is flagged as the front door on the events
  // system (see 0017_events_system.sql) — the couple's own toggle,
  // previously a hardcoded "RSVP to the engagement party" / /engagement
  // link baked into the hero itself. No event flagged just means no
  // primary CTA renders; the hub-login link still does.
  const supabase = await createClient();
  const { data: landingEvent } = await supabase
    .from("events")
    .select("slug, landing_cta_copy, landing_cta_eyebrow, landing_cta_heading, landing_cta_body")
    .eq("is_landing_cta", true)
    .not("slug", "is", null)
    .maybeSingle();

  return (
    <main className="relative">
      <SiteGate>
        <ScrollFlowerHero
          cta={cta}
          landingCta={
            landingEvent
              ? {
                  href: `/events/${landingEvent.slug}`,
                  label: landingEvent.landing_cta_copy ?? "RSVP",
                  eyebrow: landingEvent.landing_cta_eyebrow,
                  heading: landingEvent.landing_cta_heading,
                  body: landingEvent.landing_cta_body,
                }
              : null
          }
        />
      </SiteGate>
    </main>
  );
}
