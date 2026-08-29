"use client";

import { useState, useTransition } from "react";
import { Calendar, Camera, Check, Loader2, MapPin, X } from "lucide-react";
import { Botanical } from "@/components/Botanical";
import { InView } from "@/components/motion-primitives/in-view";
import { TextEffect } from "@/components/motion-primitives/text-effect";
import {
  Disclosure,
  DisclosureContent,
} from "@/components/motion-primitives/disclosure";
import { ImageUpload } from "@/components/ImageUpload";
import { addEngagementPhoto, removeEngagementPhoto } from "@/lib/engagement/actions";

const EASE = [0.22, 1, 0.36, 1] as [number, number, number, number];
const FADE_UP = { hidden: { opacity: 0, y: 14 }, visible: { opacity: 1, y: 0 } };

const VENUE_NAME = "The Black Lion";
const VENUE_ADDRESS = "The Black Lion, Hammersmith, London";
const PARTY_DATE = "24 October 2026";

export type EngagementPhoto = {
  id: string;
  image_url: string;
  caption: string | null;
};

// A quiet rule between sections, echoing the divider already used between
// stacked RSVP events on /rsvp/[token] — one shared visual "full stop" so
// the page reads as a sequence of considered moments, not stacked boxes.
function SectionDivider({ seed }: { seed: number }) {
  return (
    <div className="my-2 flex w-full max-w-lg items-center gap-3 px-6 text-ink/20">
      <div className="h-px flex-1 bg-ink/10" />
      <Botanical seed={seed} stems={1} width={40} height={24} spread={6} strokeOpacity={0.6} fillOpacity={0.3} />
      <div className="h-px flex-1 bg-ink/10" />
    </div>
  );
}

// Placeholder colour washes shown only when there are no real photos yet
// and the visitor isn't the couple (who get an "add the first one"
// prompt instead) — keeps the section from looking broken/empty before
// any photos exist.
const PLACEHOLDER_PHOTOS = [
  { id: "p1", caption: "The proposal", rotate: -3, aspect: "aspect-[4/5]", from: "#dfe4d7", to: "#9fb29f" },
  { id: "p2", caption: "First toast", rotate: 2, aspect: "aspect-square", from: "#ece7dc", to: "#c9bd9e" },
  { id: "p3", caption: "Just the two of us", rotate: -2, aspect: "aspect-[5/4]", from: "#c9d6c6", to: "#4c6b52" },
  { id: "p4", caption: "The ring", rotate: 3, aspect: "aspect-[3/4]", from: "#f4f1ec", to: "#cfc2a3" },
  { id: "p5", caption: "With family", rotate: -1, aspect: "aspect-square", from: "#d8ded2", to: "#7c9482" },
  { id: "p6", caption: "More to come", rotate: 2, aspect: "aspect-[4/5]", from: "#ece7dc", to: "#dfd6bd" },
];
// Cycled through for real photos, which don't carry their own rotate/
// aspect — a handful of varied combinations keeps the masonry grid from
// looking too uniform regardless of how many real photos get added.
const LAYOUT_CYCLE = [
  { rotate: -3, aspect: "aspect-[4/5]" },
  { rotate: 2, aspect: "aspect-square" },
  { rotate: -2, aspect: "aspect-[5/4]" },
  { rotate: 3, aspect: "aspect-[3/4]" },
  { rotate: -1, aspect: "aspect-square" },
  { rotate: 2, aspect: "aspect-[4/5]" },
];

function RealPolaroidCard({
  photo,
  rotate,
  aspect,
  isCouple,
}: {
  photo: EngagementPhoto;
  rotate: number;
  aspect: string;
  isCouple: boolean;
}) {
  const [removing, setRemoving] = useState(false);
  const [, startTransition] = useTransition();

  function handleRemove() {
    setRemoving(true);
    startTransition(async () => {
      await removeEngagementPhoto(photo.id);
      setRemoving(false);
    });
  }

  return (
    <div
      className="group relative rounded-[4px] border border-ink/5 bg-white p-3 pb-7 shadow-[0_14px_30px_rgba(35,37,32,0.14)]"
      style={{ transform: `rotate(${rotate}deg)` }}
    >
      <div className={`relative w-full overflow-hidden rounded-[2px] ${aspect}`}>
        {/* eslint-disable-next-line @next/next/no-img-element -- Drive-hosted, arbitrary host */}
        <img src={photo.image_url} alt={photo.caption ?? "Engagement photo"} className="h-full w-full object-cover" />
        {isCouple && (
          <button
            type="button"
            onClick={handleRemove}
            disabled={removing}
            aria-label="Remove photo"
            className="absolute top-1.5 right-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-ink/70 text-cream opacity-0 transition-opacity group-hover:opacity-100 disabled:opacity-100"
          >
            {removing ? <Loader2 className="h-3 w-3 animate-spin" strokeWidth={2.5} /> : <X className="h-3 w-3" strokeWidth={2.5} />}
          </button>
        )}
      </div>
      {photo.caption && (
        <p className="mt-3 text-center font-reading text-xs text-ink-soft italic">{photo.caption}</p>
      )}
    </div>
  );
}

function PlaceholderPolaroidCard({ photo }: { photo: (typeof PLACEHOLDER_PHOTOS)[number] }) {
  return (
    <div className="rounded-[4px] border border-ink/5 bg-white p-3 pb-7 shadow-[0_14px_30px_rgba(35,37,32,0.14)]">
      <div className={`relative w-full overflow-hidden rounded-[2px] ${photo.aspect}`}>
        <div
          className="flex h-full w-full items-center justify-center"
          style={{ background: `linear-gradient(135deg, ${photo.from}, ${photo.to})` }}
        >
          <Camera className="h-6 w-6 text-ink/25" strokeWidth={1.5} aria-hidden="true" />
        </div>
      </div>
      <p className="mt-3 text-center font-reading text-xs text-ink-soft italic">{photo.caption}</p>
    </div>
  );
}

function HeroSection() {
  return (
    <section className="relative flex w-full flex-col items-center overflow-hidden px-6 pt-20 pb-16 text-center">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background: "radial-gradient(ellipse 70% 55% at 50% 0%, #e6e0cf 0%, #f4f1ec 60%, #f4f1ec 100%)",
        }}
      />
      <Botanical
        seed={11}
        stems={2}
        width={140}
        height={210}
        spread={30}
        strokeOpacity={0.7}
        fillOpacity={0.35}
        className="pointer-events-none absolute -top-4 -right-6"
      />
      <Botanical
        seed={4}
        stems={2}
        width={110}
        height={170}
        spread={26}
        strokeOpacity={0.5}
        fillOpacity={0.28}
        className="pointer-events-none absolute -bottom-4 -left-8 rotate-[18deg]"
      />

      <InView
        as="p"
        once
        variants={FADE_UP}
        transition={{ duration: 0.6, ease: EASE }}
        className="relative z-10 font-serif text-xs tracking-[0.3em] text-ink-soft uppercase"
      >
        Nick &amp; Ellie
      </InView>

      <TextEffect
        as="h1"
        per="word"
        preset="fade-in-blur"
        delay={0.15}
        className="relative z-10 mt-4 font-hero text-[13vw] leading-[0.96] font-semibold tracking-tight text-ink sm:text-[58px] lg:text-[72px]"
      >
        {"Let’s celebrate early"}
      </TextEffect>

      <InView
        as="p"
        once
        variants={{ hidden: { opacity: 0, y: 14, filter: "blur(6px)" }, visible: { opacity: 1, y: 0, filter: "blur(0px)" } }}
        transition={{ duration: 0.7, delay: 0.55, ease: EASE }}
        className="relative z-10 mt-6 max-w-md text-center font-reading text-[17px] text-ink-soft italic"
      >
        Before the wedding itself, we&rsquo;d love to celebrate the
        engagement with anyone who can make it — no formal invite needed,
        just let us know you&rsquo;re coming.
      </InView>
    </section>
  );
}

function GallerySection({ photos, isCouple }: { photos: EngagementPhoto[]; isCouple: boolean }) {
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function handleUploaded(url: string) {
    setError(null);
    startTransition(async () => {
      const result = await addEngagementPhoto(url);
      if (result.error) setError(result.error);
    });
  }

  const hasRealPhotos = photos.length > 0;

  return (
    <section className="relative w-full max-w-5xl px-6 py-16">
      <InView as="p" once variants={FADE_UP} transition={{ duration: 0.6, ease: EASE }} className="text-center font-serif text-xs tracking-[0.3em] text-ink-soft uppercase">
        A few moments
      </InView>
      <InView as="h2" once variants={FADE_UP} transition={{ duration: 0.6, delay: 0.1, ease: EASE }} className="mt-3 text-center font-display text-[30px] tracking-tight">
        The story so far
      </InView>
      {!hasRealPhotos && (
        <InView
          as="p"
          once
          variants={FADE_UP}
          transition={{ duration: 0.6, delay: 0.18, ease: EASE }}
          className="mx-auto mt-3 max-w-md text-center font-reading text-[15px] text-ink-soft italic"
        >
          Real photos are on their way — for now, here&rsquo;s where
          they&rsquo;ll live.
        </InView>
      )}

      {isCouple && (
        <div className="mt-8 flex flex-col items-center gap-1.5">
          <ImageUpload onUploaded={handleUploaded} label="Add a photo" />
          {error && <p className="font-reading text-xs text-alert">{error}</p>}
        </div>
      )}

      <div className="mt-8 columns-2 gap-5 sm:columns-3">
        {hasRealPhotos
          ? photos.map((photo, i) => (
              <InView
                key={photo.id}
                as="div"
                once
                viewOptions={{ margin: "-80px" }}
                variants={{ hidden: { opacity: 0, y: 30 }, visible: { opacity: 1, y: 0 } }}
                transition={{ duration: 0.6, delay: Math.min(i, 8) * 0.07, ease: EASE }}
                className="mb-5 break-inside-avoid"
              >
                <RealPolaroidCard
                  photo={photo}
                  isCouple={isCouple}
                  rotate={LAYOUT_CYCLE[i % LAYOUT_CYCLE.length].rotate}
                  aspect={LAYOUT_CYCLE[i % LAYOUT_CYCLE.length].aspect}
                />
              </InView>
            ))
          : PLACEHOLDER_PHOTOS.map((photo, i) => (
              <InView
                key={photo.id}
                as="div"
                once
                viewOptions={{ margin: "-80px" }}
                variants={{
                  hidden: { opacity: 0, y: 30, rotate: 0 },
                  visible: { opacity: 1, y: 0, rotate: photo.rotate },
                }}
                transition={{ duration: 0.6, delay: i * 0.07, ease: EASE }}
                className="mb-5 break-inside-avoid"
              >
                <PlaceholderPolaroidCard photo={photo} />
              </InView>
            ))}
      </div>
    </section>
  );
}

function DetailsSection() {
  const mapQuery = encodeURIComponent(VENUE_ADDRESS);

  return (
    <section className="relative w-full max-w-5xl px-6 py-16">
      <InView as="p" once variants={FADE_UP} transition={{ duration: 0.6, ease: EASE }} className="text-center font-serif text-xs tracking-[0.3em] text-ink-soft uppercase">
        When &amp; where
      </InView>
      <InView as="h2" once variants={FADE_UP} transition={{ duration: 0.6, delay: 0.1, ease: EASE }} className="mt-3 text-center font-display text-[30px] tracking-tight">
        Join us at {VENUE_NAME}
      </InView>

      <div className="mt-10 grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] md:items-stretch">
        <InView
          as="div"
          once
          variants={{ hidden: { opacity: 0, x: -16 }, visible: { opacity: 1, x: 0 } }}
          transition={{ duration: 0.6, ease: EASE }}
          className="flex flex-col justify-center gap-5 rounded-[28px] border border-ink/10 bg-white p-8"
        >
          <div>
            <p className="flex items-center gap-2 font-serif text-xs tracking-[0.2em] text-ink-soft/70 uppercase">
              <Calendar className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" /> Date
            </p>
            <p className="mt-1.5 font-display text-xl text-ink">{PARTY_DATE}</p>
          </div>
          <div className="h-px w-full bg-ink/10" />
          <div>
            <p className="flex items-center gap-2 font-serif text-xs tracking-[0.2em] text-ink-soft/70 uppercase">
              <MapPin className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" /> Venue
            </p>
            <p className="mt-1.5 font-display text-xl text-ink">{VENUE_NAME}, Hammersmith</p>
          </div>
          <p className="font-reading text-sm text-ink-soft">
            We&rsquo;ll share exact timing closer to the date — RSVP now and
            we&rsquo;ll keep you posted.
          </p>
        </InView>

        <InView
          as="div"
          once
          variants={{ hidden: { opacity: 0, x: 16 }, visible: { opacity: 1, x: 0 } }}
          transition={{ duration: 0.6, delay: 0.1, ease: EASE }}
          className="relative min-h-[320px] overflow-hidden rounded-[28px] border border-ink/10 shadow-[0_18px_50px_rgba(35,37,32,0.14)]"
        >
          <iframe
            src={`https://www.google.com/maps?q=${mapQuery}&output=embed`}
            className="absolute inset-0 h-full w-full border-0"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            title={`Map to ${VENUE_NAME}, Hammersmith`}
          />
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-white/15" />
          <div className="absolute top-4 left-4 flex items-center gap-2 rounded-full bg-cream/95 px-4 py-2 shadow-[0_8px_20px_rgba(0,0,0,0.18)]">
            <MapPin className="h-3.5 w-3.5 text-accent" strokeWidth={2} aria-hidden="true" />
            <span className="font-serif text-[11px] tracking-[0.16em] text-ink-soft uppercase">
              {VENUE_NAME}, Hammersmith
            </span>
          </div>
        </InView>
      </div>
    </section>
  );
}

export function EngagementPageClient({
  photos,
  isCouple,
}: {
  photos: EngagementPhoto[];
  isCouple: boolean;
}) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [attending, setAttending] = useState<boolean | null>(null);
  const [plusOne, setPlusOne] = useState(false);
  const [plusOneName, setPlusOneName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (attending === null) return;
    setBusy(true);
    setError(null);
    const res = await fetch("/api/engagement-rsvp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fullName,
        email,
        attending,
        plusOneAttending: plusOne,
        plusOneName,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(body?.error ?? "Something went wrong — try again.");
      return;
    }
    setDone(true);
  }

  return (
    <main className="relative flex flex-1 flex-col items-center overflow-hidden">
      <HeroSection />
      <SectionDivider seed={21} />
      <GallerySection photos={photos} isCouple={isCouple} />
      <SectionDivider seed={27} />
      <DetailsSection />
      <SectionDivider seed={33} />

      <section className="relative w-full max-w-lg px-6 pt-4 pb-24">
        {done ? (
          <div
            className="rounded-[28px] border border-ink/10 bg-white p-10 text-center shadow-[0_18px_50px_rgba(35,37,32,0.1)]"
            style={{ animation: "fadeUp 550ms cubic-bezier(0.22,1,0.36,1) both" }}
          >
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-accent/12">
              <Check className="h-5 w-5 text-accent" strokeWidth={2.5} aria-hidden="true" />
            </span>
            <h2 className="mt-5 font-display text-2xl">
              {attending ? "Wonderful — see you there!" : "Thanks for letting us know"}
            </h2>
            <p className="mt-3 font-reading text-ink-soft">
              {attending
                ? "We've got you down. Details on exact timing will follow closer to the date."
                : "We'll miss you, but thanks for the reply."}
            </p>
          </div>
        ) : (
          <InView
            as="div"
            once
            variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }}
            transition={{ duration: 0.6, ease: EASE }}
          >
            <form
              onSubmit={submit}
              className="rounded-[28px] border border-ink/10 bg-white p-8 shadow-[0_18px_50px_rgba(35,37,32,0.08)]"
            >
              <p className="font-serif text-xs tracking-[0.2em] text-ink-soft/70 uppercase">RSVP</p>
              <h2 className="mt-1.5 font-display text-[22px]">Let us know you&rsquo;re coming</h2>

              <div className="mt-6 flex flex-col gap-2.5">
                <input
                  type="text"
                  required
                  autoComplete="name"
                  placeholder="Your name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full rounded-full border border-ink/20 bg-white px-4.5 py-3 font-reading text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/15"
                />
                <input
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="Your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-full border border-ink/20 bg-white px-4.5 py-3 font-reading text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/15"
                />
              </div>

              <div className="mt-5 flex gap-2.5">
                <button
                  type="button"
                  onClick={() => setAttending(true)}
                  aria-pressed={attending === true}
                  className={`flex-1 rounded-full py-3 font-serif text-[13px] transition ${
                    attending === true
                      ? "bg-accent text-cream shadow-[0_6px_16px_rgba(76,107,82,0.3)]"
                      : "border border-ink/20 text-ink-soft hover:border-ink/40"
                  }`}
                >
                  Joyfully attending
                </button>
                <button
                  type="button"
                  onClick={() => setAttending(false)}
                  aria-pressed={attending === false}
                  className={`flex-1 rounded-full py-3 font-serif text-[13px] transition ${
                    attending === false
                      ? "bg-ink text-cream shadow-[0_6px_16px_rgba(35,37,32,0.25)]"
                      : "border border-ink/20 text-ink-soft hover:border-ink/40"
                  }`}
                >
                  Can&rsquo;t make it
                </button>
              </div>

              {attending && (
                <div className="mt-5 flex flex-col gap-2.5">
                  <label className="flex items-center gap-2.5 font-serif text-[13px] text-ink-soft">
                    <input
                      type="checkbox"
                      checked={plusOne}
                      onChange={(e) => setPlusOne(e.target.checked)}
                    />
                    Bringing a plus one
                  </label>
                  <Disclosure open={plusOne}>
                    <DisclosureContent>
                      <input
                        type="text"
                        placeholder="Plus one's name"
                        value={plusOneName}
                        onChange={(e) => setPlusOneName(e.target.value)}
                        className="w-full rounded-full border border-ink/20 bg-white px-4.5 py-3 font-reading text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/15"
                      />
                    </DisclosureContent>
                  </Disclosure>
                </div>
              )}

              <button
                type="submit"
                disabled={busy || attending === null}
                className="mt-6 w-full rounded-full bg-ink px-7 py-3.5 font-serif text-sm text-cream transition hover:bg-ink-soft disabled:opacity-60"
              >
                {busy ? "Sending…" : "Send RSVP"}
              </button>

              {error && <p className="mt-4 text-center font-reading text-sm text-alert">{error}</p>}
            </form>
          </InView>
        )}
      </section>
    </main>
  );
}
