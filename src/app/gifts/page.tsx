import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { GiftAmbience } from "@/components/gifts/GiftAmbience";
import { BankDetails } from "@/components/gifts/BankDetails";
import { WEDDING_FUND, hasBankDetails } from "@/lib/gifts/config";

export const metadata: Metadata = {
  title: "Gifts — Nick & Ellie",
  description: "A note on gifts, and how to contribute to Nick & Ellie's wedding fund.",
};

export default function GiftsPage() {
  const fund = WEDDING_FUND;
  const bankReady = hasBankDetails(fund);

  return (
    <main className="relative min-h-screen overflow-hidden bg-ink text-cream">
      <GiftAmbience />

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-2xl flex-col px-6 pt-8 pb-16 sm:pt-10">
        <Link
          href="/"
          className="inline-flex w-fit items-center gap-2 font-serif text-xs font-medium tracking-[0.2em] text-cream/60 uppercase transition-colors hover:text-cream"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={2} />
          Back
        </Link>

        <header className="mt-14 text-center sm:mt-20" style={{ animation: "fadeUp 1.1s cubic-bezier(.22,1,.36,1) both" }}>
          <p className="font-serif text-xs font-bold tracking-[0.3em] text-accent-soft uppercase">
            A note on gifts
          </p>
          <h1 className="mt-5 font-hero text-[40px] leading-[1.04] font-semibold tracking-[-0.01em] text-white text-balance sm:text-[60px]">
            We already have a home.
          </h1>
          <p className="mx-auto mt-6 max-w-lg font-reading text-xl leading-relaxed text-cream/85 italic text-pretty sm:text-2xl">
            We&rsquo;re lucky enough to already have our home together, so there&rsquo;s nothing
            on a list we&rsquo;d ask you for. Having you with us is the real gift.
          </p>
        </header>

        <section
          className="mt-14 sm:mt-16"
          style={{ animation: "fadeUp 1.1s cubic-bezier(.22,1,.36,1) 0.25s both" }}
        >
          <div
            className="rounded-[28px] border border-cream/12 bg-gradient-to-b from-cream/[0.09] to-cream/[0.04] p-7 backdrop-blur-xl sm:p-10"
            style={{ animation: "softBreathe 7s ease-in-out infinite" }}
          >
            <p className="font-serif text-xs font-bold tracking-[0.28em] text-cream/60 uppercase">
              The wedding fund
            </p>
            <p className="mt-4 font-reading text-lg leading-relaxed text-cream/90 text-pretty">
              If you feel strongly that you&rsquo;d like to give us something, a contribution to
              our wedding fund would be very much appreciated. It helps us plan and pay for our
              dream wedding &mdash; and means the world to us.
            </p>

            {fund.payLink && (
              <a
                href={fund.payLink.href}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-7 inline-block w-full rounded-full bg-cream px-8 py-4 text-center font-serif text-sm font-semibold text-ink shadow-[0_10px_30px_rgba(76,107,82,0.35)] transition-transform duration-300 hover:-translate-y-0.5 sm:w-auto"
              >
                {fund.payLink.label}
              </a>
            )}

            {bankReady ? (
              <BankDetails
                accountName={fund.accountName!}
                sortCode={fund.sortCode!}
                accountNumber={fund.accountNumber!}
                reference={fund.reference}
                hasPayLink={Boolean(fund.payLink)}
              />
            ) : (
              !fund.payLink && (
                <p className="mt-7 rounded-2xl border border-dashed border-cream/20 px-5 py-4 text-center font-reading text-base text-cream/70 italic">
                  The details for contributing will appear here very soon.
                </p>
              )
            )}
          </div>

          <p className="mt-10 text-center font-reading text-lg text-cream/75 italic">
            With love, Nick &amp; Ellie
          </p>
        </section>
      </div>
    </main>
  );
}
