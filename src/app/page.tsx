import { ScrollFlowerHero, type HeroCta } from "@/components/ScrollFlowerHero";
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
      <ScrollFlowerHero cta={cta} />
      <p className="bg-cream py-8 text-center font-serif text-[11px] tracking-[0.15em] text-ink-soft/80 uppercase">
        weddingsweddings.co.uk
      </p>
    </main>
  );
}
