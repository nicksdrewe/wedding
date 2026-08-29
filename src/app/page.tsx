import { ScrollFlowerHero, type HeroCta } from "@/components/ScrollFlowerHero";
import { SiteGate } from "@/components/SiteGate";
import { getAuthState, HOME_FOR_ROLE } from "@/lib/auth/roles";

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

  return (
    <main className="relative">
      <SiteGate>
        <ScrollFlowerHero cta={cta} />
      </SiteGate>
    </main>
  );
}
