import Link from "next/link";
import { Botanical } from "@/components/Botanical";
import { TextEffect } from "@/components/motion-primitives/text-effect";
import { getAuthState, HOME_FOR_ROLE } from "@/lib/auth/roles";

const WEDDING_DATE = "28 November 2026";

// Reads the session so a signed-in visitor is never shown the anonymous
// call-to-action — previously this page looked identical either way, which
// made a successful sign-in indistinguishable from a failed one.
export const dynamic = "force-dynamic";

export default async function LandingPage() {
  const state = await getAuthState();

  return (
    <main className="relative flex min-h-screen flex-col overflow-hidden bg-gradient-to-b from-[#f6f3ed] to-[#f0ece3]">
      {/* ambient drifting glow — pure CSS, no JS animation loop */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-[10%] -left-[8%] h-[46vw] max-h-[560px] w-[46vw] max-w-[560px] rounded-full blur-[10px]"
        style={{
          background:
            "radial-gradient(circle at 40% 40%, rgba(76,107,82,0.28), rgba(76,107,82,0) 70%)",
          animation: "drift1 16s ease-in-out infinite",
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-[10%] -bottom-[12%] h-[50vw] max-h-[600px] w-[50vw] max-w-[600px] rounded-full blur-[10px]"
        style={{
          background:
            "radial-gradient(circle at 60% 60%, rgba(181,101,74,0.16), rgba(181,101,74,0) 70%)",
          animation: "drift2 18s ease-in-out infinite",
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-1/3 left-1/2 h-[36vw] max-h-[420px] w-[36vw] max-w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-[6px]"
        style={{
          background: "radial-gradient(circle, rgba(255,255,255,0.5), rgba(255,255,255,0) 72%)",
          animation: "glowPulse 9s ease-in-out infinite",
        }}
      />

      <Botanical
        seed={4}
        stems={4}
        width={170}
        height={300}
        spread={48}
        strokeOpacity={0.9}
        fillOpacity={0.9}
        className="pointer-events-none absolute -top-8 -left-8 drop-shadow-[0_8px_18px_rgba(76,107,82,0.18)]"
        style={{ animation: "bob 10s ease-in-out infinite" }}
      />
      <Botanical
        seed={11}
        stems={3}
        width={160}
        height={270}
        spread={40}
        strokeOpacity={0.9}
        fillOpacity={0.9}
        className="pointer-events-none absolute -right-8 -bottom-8 drop-shadow-[0_8px_18px_rgba(76,107,82,0.18)]"
        style={{ animation: "bobRev 11s ease-in-out infinite" }}
      />

      <section
        className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 text-center"
        style={{ animation: "fadeUp 900ms cubic-bezier(0.22,1,0.36,1) both" }}
      >
        <p className="font-serif text-[13px] font-medium tracking-[0.32em] text-ink-soft uppercase">
          We&rsquo;re getting married
        </p>
        <TextEffect
          as="h1"
          per="char"
          preset="fade-in-blur"
          speedReveal={2.2}
          delay={0.15}
          className="mt-5 font-hero text-[15vw] leading-[0.94] font-semibold tracking-[-0.01em] text-ink sm:text-[110px] lg:text-[148px]"
          style={{
            textShadow: "0 2px 40px rgba(76,107,82,0.22), 0 1px 0 rgba(255,255,255,0.6)",
          }}
        >
          Nick & Ellie
        </TextEffect>
        <p className="mt-5 font-reading text-2xl text-ink-soft italic md:text-[26px]">
          {WEDDING_DATE}
        </p>

        {state.status === "ok" ? (
          <>
            <p className="mt-12 font-serif text-ink-soft">
              Signed in
              {state.profile.full_name ? ` as ${state.profile.full_name}` : ""}.
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-4">
              <PrimaryButton href={HOME_FOR_ROLE[state.profile.role]}>
                Enter the planning hub
              </PrimaryButton>
              <GlassButton href="/logout">Sign out</GlassButton>
            </div>
          </>
        ) : state.status === "no-profile" ? (
          <div className="mt-12 flex flex-wrap justify-center gap-4">
            <PrimaryButton href="/no-access">You&rsquo;re signed in</PrimaryButton>
            <GlassButton href="/logout">Sign out</GlassButton>
          </div>
        ) : (
          <div className="mt-12 flex flex-wrap justify-center gap-4">
            <PrimaryButton href="/rsvp">RSVP</PrimaryButton>
            <GlassButton href="/login">Sign in</GlassButton>
          </div>
        )}
      </section>

      <p className="relative z-10 pb-8 text-center font-serif text-[11px] tracking-[0.15em] text-ink-soft/80 uppercase">
        weddingsweddings.co.uk
      </p>
    </main>
  );
}

function PrimaryButton({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="group relative inline-block overflow-hidden rounded-full bg-gradient-to-br from-[#2b2e28] to-[#1b1d19] px-10 py-4 font-serif text-sm font-medium text-cream shadow-[0_10px_30px_rgba(76,107,82,0.35),inset_0_1px_0_rgba(255,255,255,0.15)] transition-[transform,box-shadow] duration-300 ease-[cubic-bezier(.22,1,.36,1)] hover:-translate-y-0.5 hover:scale-[1.02] hover:shadow-[0_16px_40px_rgba(76,107,82,0.45),inset_0_1px_0_rgba(255,255,255,0.2)]"
    >
      <span className="relative z-10">{children}</span>
      <span
        aria-hidden="true"
        className="pointer-events-none absolute top-0 left-0 h-full w-2/5 bg-gradient-to-r from-transparent via-white/35 to-transparent"
        style={{ animation: "shine 4.5s ease-in-out infinite" }}
      />
    </Link>
  );
}

function GlassButton({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-block rounded-full border border-white/60 bg-white/35 px-10 py-4 font-serif text-sm font-medium text-ink shadow-[0_8px_24px_rgba(35,37,32,0.08),inset_0_1px_0_rgba(255,255,255,0.7)] backdrop-blur-md transition-[transform,box-shadow,background] duration-300 ease-[cubic-bezier(.22,1,.36,1)] hover:-translate-y-0.5 hover:scale-[1.02] hover:bg-white/55 hover:shadow-[0_12px_30px_rgba(35,37,32,0.12),inset_0_1px_0_rgba(255,255,255,0.8)]"
    >
      {children}
    </Link>
  );
}
