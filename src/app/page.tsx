import Link from "next/link";
import { BotanicalAccent } from "@/components/BotanicalAccent";
import { HeroReveal } from "@/components/HeroReveal";

const WEDDING_DATE = "28.11.26";

export default function LandingPage() {
  return (
    <main className="relative flex-1 overflow-hidden">
      <BotanicalAccent className="pointer-events-none absolute -left-10 -top-10 h-64 w-32 object-contain md:h-96 md:w-48" />
      <BotanicalAccent className="pointer-events-none absolute -right-10 bottom-0 h-64 w-32 rotate-180 object-contain md:h-96 md:w-48" />

      <HeroReveal>
        <section className="relative flex min-h-[85vh] flex-col items-center justify-center px-6 text-center">
          <p className="font-serif text-sm tracking-[0.3em] text-ink-soft uppercase">
            We&rsquo;re getting married
          </p>
          <h1 className="mt-4 font-script text-6xl leading-tight text-ink md:text-8xl">
            Nick &amp; Ellie
          </h1>
          <p className="mt-6 font-serif text-2xl tracking-wide text-ink-soft md:text-3xl">
            {WEDDING_DATE}
          </p>

          <div className="mt-10 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/rsvp"
              className="rounded-full bg-ink px-8 py-3 font-serif text-cream transition hover:bg-ink-soft"
            >
              RSVP
            </Link>
            <Link
              href="/login"
              className="rounded-full border border-ink/30 px-8 py-3 font-serif text-ink transition hover:border-ink"
            >
              Sign in
            </Link>
          </div>
        </section>
      </HeroReveal>
    </main>
  );
}
