"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Calendar, Camera, Check, Loader2, MapPin, X } from "lucide-react";
import { Botanical } from "@/components/Botanical";
import { InView } from "@/components/motion-primitives/in-view";
import { TextEffect } from "@/components/motion-primitives/text-effect";
import {
  Disclosure,
  DisclosureContent,
} from "@/components/motion-primitives/disclosure";
import { Spotlight } from "@/components/motion-primitives/spotlight";
import { GlowEffect } from "@/components/motion-primitives/glow-effect";
import { AnimatePresence, motion, useMotionValue, useSpring } from "motion/react";
import { ImageUpload } from "@/components/ImageUpload";
import { toDriveImageUrl } from "@/lib/google/image-url";
import { cn } from "@/lib/utils";
import {
  addEventPhoto,
  removeEventPhoto,
  updateEventPhoto,
  updateEventPhotoCaption,
} from "@/lib/events/photos";

const EASE = [0.22, 1, 0.36, 1] as [number, number, number, number];
const FADE_UP = { hidden: { opacity: 0, y: 14 }, visible: { opacity: 1, y: 0 } };

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// Deterministic, not toLocaleDateString/toLocaleTimeString — this
// component renders on the server for the initial paint same as any
// other client component, and locale-dependent formatting APIs can
// resolve differently between Node's ICU data and the browser's,
// producing a hydration mismatch. A fixed format sidesteps that
// entirely, and matches what the hardcoded engagement-party copy this
// generalizes always looked like anyway ("24 October 2026, 7pm").
function formatEventDateTime(startsAt: string) {
  const d = new Date(startsAt);
  const date = `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
  let hours = d.getHours();
  const minutes = d.getMinutes();
  const ampm = hours >= 12 ? "pm" : "am";
  hours = hours % 12 || 12;
  const time = minutes === 0 ? `${hours}${ampm}` : `${hours}:${String(minutes).padStart(2, "0")}${ampm}`;
  return { date, time };
}

export type EventConfig = {
  id: string;
  slug: string;
  name: string;
  starts_at: string | null;
  location: string | null;
  show_header: boolean;
  header_eyebrow: string | null;
  header_title: string | null;
  header_body: string | null;
  show_photo_board: boolean;
  show_details: boolean;
  details_eyebrow: string | null;
  details_title: string | null;
  venue_name: string | null;
  venue_body: string | null;
  show_map: boolean;
  show_rsvp_form: boolean;
  rsvp_enabled: boolean;
};

// Hoisted to module scope rather than an inline array literal in the JSX
// below — GlowEffect memoises its animation target on this array's
// VALUES (see glow-effect.tsx), but keeping the reference itself stable
// too means React never even has a reason to consider it "changed" on
// re-render, belt and suspenders against the glow restarting/stuttering
// every time this form's state changes (typing, choosing attending, etc).
const RSVP_GLOW_COLORS = ["#4c6b52", "#7c9482", "#f4f1ec", "#232520"];

export type EventPhoto = {
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

// Spotlight-border wrapper for this page's light, cream-backed cards —
// same "p-[2px] gap with a mouse-tracking Spotlight glow inside it"
// structure as ScrollFlowerHero's RSVP/sign-in popovers, just tuned down
// for a light card sitting on a light (cream) page rather than a glass
// panel over a dark photo: a quieter ink-tinted gap and semi-transparent
// botanical-green gradient stops (rather than those popovers' fully
// opaque ones) so the rim reads as a soft glow, not a bright halo.
function SpotlightCard({
  wrapperClassName,
  children,
}: {
  wrapperClassName?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("relative overflow-hidden rounded-[28px] bg-ink/8 p-[2px]", wrapperClassName)}>
      <Spotlight
        className="bg-[radial-gradient(circle,#4c6b524d,#7c94824d_45%,transparent_78%)] blur-2xl"
        size={220}
      />
      {children}
    </div>
  );
}

// Placeholder colour washes shown only when there are no real photos yet
// and the visitor isn't the couple (who get an "add the first one"
// prompt instead) — keeps the section from looking broken/empty before
// any photos exist.
const PLACEHOLDER_PHOTOS = [
  { id: "p1", caption: "A moment to remember", rotate: -3, aspect: "aspect-[4/5]", from: "#dfe4d7", to: "#9fb29f" },
  { id: "p2", caption: "First toast", rotate: 2, aspect: "aspect-square", from: "#ece7dc", to: "#c9bd9e" },
  { id: "p3", caption: "Just the two of us", rotate: -2, aspect: "aspect-[5/4]", from: "#c9d6c6", to: "#4c6b52" },
  { id: "p4", caption: "Together", rotate: 3, aspect: "aspect-[3/4]", from: "#f4f1ec", to: "#cfc2a3" },
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

// A caption that stays hidden until its photo is hovered, then follows
// the cursor — via a small bespoke follower (see the reasoning captured
// in git history for EngagementPageClient, which this generalizes):
// every polaroid is rotated, and any ancestor with a CSS transform
// becomes the containing block for a position:fixed descendant instead
// of the viewport, so this is rendered ONCE here at the gallery level,
// outside every rotated card, driven by onMouseEnter/onMouseLeave.
function HoverCaption({ caption }: { caption: string | null }) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const springX = useSpring(x, { stiffness: 420, damping: 32 });
  const springY = useSpring(y, { stiffness: 420, damping: 32 });

  useEffect(() => {
    if (!caption) return;
    const handleMove = (e: MouseEvent) => {
      x.set(e.clientX);
      y.set(e.clientY);
    };
    window.addEventListener("mousemove", handleMove);
    return () => window.removeEventListener("mousemove", handleMove);
  }, [caption, x, y]);

  return (
    <motion.div
      className="pointer-events-none fixed top-0 left-0 z-50"
      style={{ x: springX, y: springY }}
    >
      <AnimatePresence>
        {caption && (
          <motion.div
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.85 }}
            transition={{ type: "spring", stiffness: 420, damping: 32 }}
            className="translate-x-4 translate-y-4 rounded-full bg-ink/90 px-3.5 py-1.5 font-reading text-[11px] whitespace-nowrap text-cream shadow-[0_6px_16px_rgba(35,37,32,0.35)]"
          >
            {caption}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// The cursor-follow caption pill only makes sense on a real mouse — on
// touch, "hover" is simulated from a tap with no continuous movement to
// follow. Gated on this rather than a screen-width check, since a touch
// device isn't reliably identified by viewport size, and this is
// evaluated per-event rather than at render time, so there's no server/
// client markup to keep in sync (see the CSS-only `[@media(hover:none)]`
// static caption below, which takes the opposite, no-JS approach for the
// same reason).
function isHoverCapable() {
  return typeof window !== "undefined" && window.matchMedia("(hover: hover) and (pointer: fine)").matches;
}

function RealPolaroidCard({
  photo,
  rotate,
  aspect,
  isCouple,
  slug,
  onHoverCaption,
}: {
  photo: EventPhoto;
  rotate: number;
  aspect: string;
  isCouple: boolean;
  slug: string;
  onHoverCaption: (caption: string | null) => void;
}) {
  const [removing, setRemoving] = useState(false);
  const [, startTransition] = useTransition();

  function handleRemove() {
    setRemoving(true);
    startTransition(async () => {
      await removeEventPhoto(photo.id, slug);
      setRemoving(false);
    });
  }

  function handleReplaced(url: string) {
    startTransition(async () => {
      await updateEventPhoto(photo.id, slug, url);
    });
  }

  const [editingCaption, setEditingCaption] = useState(false);
  const [captionDraft, setCaptionDraft] = useState(photo.caption ?? "");
  const [captionPending, startCaptionTransition] = useTransition();

  function saveCaption() {
    setEditingCaption(false);
    if (captionDraft === (photo.caption ?? "")) return;
    startCaptionTransition(async () => {
      await updateEventPhotoCaption(photo.id, slug, captionDraft);
    });
  }

  const image = (
    // eslint-disable-next-line @next/next/no-img-element -- Drive-hosted, arbitrary host
    <img
      src={toDriveImageUrl(photo.image_url)}
      alt={photo.caption ?? "Event photo"}
      loading="lazy"
      className="h-full w-full object-cover"
    />
  );

  return (
    <div
      className="group relative rounded-[4px] border border-ink/5 bg-white p-3 pb-7 shadow-[0_14px_30px_rgba(35,37,32,0.14)]"
      style={{ transform: `rotate(${rotate}deg)` }}
    >
      <div
        className={`relative w-full transform-gpu overflow-hidden rounded-[2px] ${aspect}`}
        onMouseEnter={() => !isCouple && photo.caption && isHoverCapable() && onHoverCaption(photo.caption)}
        onMouseLeave={() => !isCouple && onHoverCaption(null)}
      >
        {isCouple ? (
          // The X button below is a sibling of this label, not nested
          // inside it — clicking it removes the photo without also
          // opening the file picker the label wraps.
          <ImageUpload onUploaded={handleReplaced} className="h-full w-full">
            <div className="relative h-full w-full">
              {image}
              <div className="absolute inset-0 flex items-center justify-center bg-ink/0 opacity-0 transition-[opacity,background-color] duration-150 group-hover:bg-ink/35 group-hover:opacity-100">
                <span className="rounded-full bg-cream/95 px-3 py-1 font-serif text-[11px] tracking-wide text-ink uppercase">
                  Click to replace
                </span>
              </div>
            </div>
          </ImageUpload>
        ) : (
          image
        )}
        {isCouple && (
          <button
            type="button"
            onClick={handleRemove}
            disabled={removing}
            aria-label="Remove photo"
            className="absolute top-1.5 right-1.5 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-ink/70 text-cream transition-opacity [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:disabled:opacity-100"
          >
            {removing ? <Loader2 className="h-3 w-3 animate-spin" strokeWidth={2.5} /> : <X className="h-3 w-3" strokeWidth={2.5} />}
          </button>
        )}
      </div>
      {isCouple ? (
        editingCaption ? (
          <input
            type="text"
            autoFocus
            value={captionDraft}
            onChange={(e) => setCaptionDraft(e.target.value)}
            onBlur={saveCaption}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                saveCaption();
              }
              if (e.key === "Escape") {
                setCaptionDraft(photo.caption ?? "");
                setEditingCaption(false);
              }
            }}
            placeholder="Add a caption…"
            maxLength={200}
            className="mt-3 w-full rounded-full border border-ink/15 bg-cream px-3 py-1 text-center font-reading text-xs text-ink outline-none focus:border-accent"
          />
        ) : (
          <button
            type="button"
            onClick={() => setEditingCaption(true)}
            className="mt-3 block w-full text-center font-reading text-xs text-ink-soft italic underline decoration-ink-soft/30 decoration-dotted underline-offset-4 hover:decoration-accent"
          >
            {captionPending ? "Saving…" : photo.caption || "Add a caption…"}
          </button>
        )
      ) : (
        photo.caption && (
          <p className="mt-3 hidden text-center font-reading text-xs text-ink-soft italic [@media(hover:none)]:block">
            {photo.caption}
          </p>
        )
      )}
    </div>
  );
}

function PlaceholderPolaroidCard({
  photo,
  isCouple,
  onUploaded,
  onHoverCaption,
}: {
  photo: (typeof PLACEHOLDER_PHOTOS)[number];
  isCouple: boolean;
  onUploaded: (url: string) => void;
  onHoverCaption: (caption: string | null) => void;
}) {
  const wash = (
    <div
      className="flex h-full w-full items-center justify-center"
      style={{ background: `linear-gradient(135deg, ${photo.from}, ${photo.to})` }}
    >
      <Camera className="h-6 w-6 text-ink/25" strokeWidth={1.5} aria-hidden="true" />
      {isCouple && (
        <span className="absolute bottom-2 rounded-full bg-white/90 px-2.5 py-1 font-serif text-[10px] tracking-wide text-ink-soft uppercase">
          Click to add a photo
        </span>
      )}
    </div>
  );

  return (
    <div className="rounded-[4px] border border-ink/5 bg-white p-3 pb-7 shadow-[0_14px_30px_rgba(35,37,32,0.14)]">
      <div
        className={`relative w-full transform-gpu overflow-hidden rounded-[2px] ${photo.aspect}`}
        onMouseEnter={() => isHoverCapable() && onHoverCaption(photo.caption)}
        onMouseLeave={() => onHoverCaption(null)}
      >
        {isCouple ? (
          <ImageUpload onUploaded={onUploaded} className="h-full w-full">
            {wash}
          </ImageUpload>
        ) : (
          wash
        )}
      </div>
      {!isCouple && (
        <p className="mt-3 hidden text-center font-reading text-xs text-ink-soft italic [@media(hover:none)]:block">
          {photo.caption}
        </p>
      )}
    </div>
  );
}

function HeroSection({ event }: { event: EventConfig }) {
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

      {event.header_eyebrow && (
        <InView
          as="p"
          once
          variants={FADE_UP}
          transition={{ duration: 0.6, ease: EASE }}
          className="relative z-10 font-serif text-xs tracking-[0.3em] text-ink-soft uppercase"
        >
          {event.header_eyebrow}
        </InView>
      )}

      {event.header_title && (
        <TextEffect
          as="h1"
          per="word"
          preset="fade-in-blur"
          delay={0.15}
          className="relative z-10 mt-4 font-hero text-[13vw] leading-[0.96] font-semibold tracking-tight text-ink sm:text-[58px] lg:text-[72px]"
        >
          {event.header_title}
        </TextEffect>
      )}

      {event.header_body && (
        <InView
          as="p"
          once
          variants={{ hidden: { opacity: 0, y: 14, filter: "blur(6px)" }, visible: { opacity: 1, y: 0, filter: "blur(0px)" } }}
          transition={{ duration: 0.7, delay: 0.55, ease: EASE }}
          className="relative z-10 mt-6 max-w-md text-center font-reading text-[17px] text-ink-soft italic"
        >
          {event.header_body}
        </InView>
      )}
    </section>
  );
}

function GallerySection({
  photos,
  isCouple,
  eventId,
  slug,
}: {
  photos: EventPhoto[];
  isCouple: boolean;
  eventId: string;
  slug: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const [hoveredCaption, setHoveredCaption] = useState<string | null>(null);

  function handleUploaded(url: string) {
    setError(null);
    startTransition(async () => {
      const result = await addEventPhoto(eventId, slug, url);
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

      <div className="mt-8 grid grid-cols-2 gap-5 sm:grid-cols-3">
        {hasRealPhotos
          ? photos.map((photo, i) => (
              <InView
                key={photo.id}
                as="div"
                once
                viewOptions={{ margin: "-80px" }}
                variants={{ hidden: { opacity: 0, y: 30 }, visible: { opacity: 1, y: 0 } }}
                transition={{ duration: 0.6, delay: Math.min(i, 8) * 0.07, ease: EASE }}
              >
                <RealPolaroidCard
                  photo={photo}
                  isCouple={isCouple}
                  slug={slug}
                  rotate={LAYOUT_CYCLE[i % LAYOUT_CYCLE.length].rotate}
                  aspect={LAYOUT_CYCLE[i % LAYOUT_CYCLE.length].aspect}
                  onHoverCaption={setHoveredCaption}
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
              >
                <PlaceholderPolaroidCard
                  photo={photo}
                  isCouple={isCouple}
                  onUploaded={handleUploaded}
                  onHoverCaption={setHoveredCaption}
                />
              </InView>
            ))}
      </div>

      <HoverCaption caption={hoveredCaption} />
    </section>
  );
}

function DetailsSection({ event }: { event: EventConfig }) {
  const mapQuery = event.location ? encodeURIComponent(event.location) : "";
  const { date, time } = event.starts_at ? formatEventDateTime(event.starts_at) : { date: null, time: null };
  const showInfo = event.show_details;
  const showMap = event.show_map && !!event.location;

  if (!showInfo && !showMap) return null;

  return (
    <section className="relative w-full max-w-5xl px-6 py-16">
      {event.details_eyebrow && (
        <InView as="p" once variants={FADE_UP} transition={{ duration: 0.6, ease: EASE }} className="text-center font-serif text-xs tracking-[0.3em] text-ink-soft uppercase">
          {event.details_eyebrow}
        </InView>
      )}
      {event.details_title && (
        <InView as="h2" once variants={FADE_UP} transition={{ duration: 0.6, delay: 0.1, ease: EASE }} className="mt-3 text-center font-display text-[30px] tracking-tight">
          {event.details_title}
        </InView>
      )}

      <div
        className={`mt-10 grid gap-6 md:items-stretch ${
          showInfo && showMap ? "md:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]" : ""
        }`}
      >
        {showInfo && (
          <InView
            as="div"
            once
            variants={{ hidden: { opacity: 0, x: -16 }, visible: { opacity: 1, x: 0 } }}
            transition={{ duration: 0.6, ease: EASE }}
            className="h-full"
          >
            <SpotlightCard wrapperClassName="h-full">
              <div className="relative flex h-full flex-col justify-center gap-5 rounded-[26px] bg-white p-8">
                {date && (
                  <div>
                    <p className="flex items-center gap-2 font-serif text-xs tracking-[0.2em] text-ink-soft/70 uppercase">
                      <Calendar className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" /> Date &amp; time
                    </p>
                    <p className="mt-1.5 font-display text-xl text-ink">
                      {date}
                      {time && `, ${time}`}
                    </p>
                  </div>
                )}
                {date && event.venue_name && <div className="h-px w-full bg-ink/10" />}
                {event.venue_name && (
                  <div>
                    <p className="flex items-center gap-2 font-serif text-xs tracking-[0.2em] text-ink-soft/70 uppercase">
                      <MapPin className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" /> Venue
                    </p>
                    <p className="mt-1.5 font-display text-xl text-ink">{event.venue_name}</p>
                  </div>
                )}
                {event.venue_body && (
                  <p className="font-reading text-sm text-ink-soft">{event.venue_body}</p>
                )}
              </div>
            </SpotlightCard>
          </InView>
        )}

        {showMap && (
          <InView
            as="div"
            once
            variants={{ hidden: { opacity: 0, x: 16 }, visible: { opacity: 1, x: 0 } }}
            transition={{ duration: 0.6, delay: 0.1, ease: EASE }}
            className="h-full"
          >
            <SpotlightCard wrapperClassName="h-full min-h-[320px]">
              <div className="relative h-full min-h-[316px] overflow-hidden rounded-[26px] shadow-[0_18px_50px_rgba(35,37,32,0.14)]">
                <iframe
                  src={`https://www.google.com/maps?q=${mapQuery}&output=embed`}
                  className="absolute inset-0 h-full w-full border-0"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  title={`Map to ${event.venue_name ?? event.location}`}
                />
                <div aria-hidden="true" className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-white/15" />
              </div>
            </SpotlightCard>
          </InView>
        )}
      </div>
    </section>
  );
}

type OtherAttendee = { id: number; name: string };

// One row of the "bringing others" list. The first row (index 0) is
// already visible the instant the surrounding Disclosure opens, so it
// doesn't need its own reveal. Every row after that is appended live
// while the user types — see updateOtherName — so it mounts closed and
// flips itself open a frame later, giving it the same smooth Disclosure
// grow-in the first field gets from its parent, rather than popping in
// already-expanded.
function OtherAttendeeField({
  attendee,
  index,
  onChange,
}: {
  attendee: OtherAttendee;
  index: number;
  onChange: (id: number, value: string) => void;
}) {
  const [open, setOpen] = useState(index === 0);

  useEffect(() => {
    if (index === 0) return;
    const raf = requestAnimationFrame(() => setOpen(true));
    return () => cancelAnimationFrame(raf);
  }, [index]);

  return (
    <Disclosure open={open}>
      <DisclosureContent>
        <input
          type="text"
          placeholder={index === 0 ? "Their name" : "Another name"}
          value={attendee.name}
          onChange={(e) => onChange(attendee.id, e.target.value)}
          className="w-full rounded-full border border-ink/20 bg-white px-4.5 py-3 font-reading text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/15"
        />
      </DisclosureContent>
    </Disclosure>
  );
}

function RsvpSection({ event }: { event: EventConfig }) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [attending, setAttending] = useState<boolean | null>(null);
  const [bringingOthers, setBringingOthers] = useState(false);
  const [others, setOthers] = useState<OtherAttendee[]>([{ id: 0, name: "" }]);
  const nextOtherId = useRef(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  function updateOtherName(id: number, value: string) {
    setOthers((prev) => {
      const next = prev.map((o) => (o.id === id ? { ...o, name: value } : o));
      const last = next[next.length - 1];
      if (last.name.trim().length > 0) {
        next.push({ id: nextOtherId.current++, name: "" });
      }
      return next;
    });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (attending === null) return;
    setBusy(true);
    setError(null);
    const otherNames =
      attending && bringingOthers
        ? others.map((o) => o.name.trim()).filter((name) => name.length > 0)
        : [];
    const res = await fetch(`/api/events/${event.slug}/rsvp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fullName, email, attending, others: otherNames }),
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
              ? "Thank you for letting us know — we can't wait to celebrate with you."
              : "Thank you for letting us know, and we'll miss you."}
            {" "}If you need any further details in the meantime, please get in touch with us.
          </p>
        </div>
      ) : (
        <InView
          as="div"
          once
          variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }}
          transition={{ duration: 0.6, ease: EASE }}
        >
          <SpotlightCard>
            <form
              onSubmit={submit}
              className="relative rounded-[26px] bg-white p-8 shadow-[0_18px_50px_rgba(35,37,32,0.08)]"
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
                      checked={bringingOthers}
                      onChange={(e) => setBringingOthers(e.target.checked)}
                    />
                    Bringing others
                  </label>
                  <Disclosure open={bringingOthers}>
                    <DisclosureContent>
                      <div className="flex flex-col gap-2.5">
                        {others.map((attendee, i) => (
                          <OtherAttendeeField
                            key={attendee.id}
                            attendee={attendee}
                            index={i}
                            onChange={updateOtherName}
                          />
                        ))}
                      </div>
                    </DisclosureContent>
                  </Disclosure>
                </div>
              )}

              <div className="relative mt-6">
                <GlowEffect
                  colors={RSVP_GLOW_COLORS}
                  mode="colorShift"
                  blur="soft"
                  scale={1.04}
                  duration={4}
                  className="rounded-full"
                />
                <button
                  type="submit"
                  disabled={busy || attending === null}
                  className="relative w-full rounded-full bg-ink px-7 py-3.5 font-serif text-sm text-cream transition hover:bg-ink-soft disabled:opacity-60"
                >
                  {busy ? "Sending…" : "Send RSVP"}
                </button>
              </div>

              {error && <p className="mt-4 text-center font-reading text-sm text-alert">{error}</p>}
            </form>
          </SpotlightCard>
        </InView>
      )}
    </section>
  );
}

export function EventPageClient({
  event,
  photos,
  isCouple,
}: {
  event: EventConfig;
  photos: EventPhoto[];
  isCouple: boolean;
}) {
  const sections = [
    event.show_header && <HeroSection key="header" event={event} />,
    event.show_photo_board && (
      <GallerySection key="photos" photos={photos} isCouple={isCouple} eventId={event.id} slug={event.slug} />
    ),
    (event.show_details || event.show_map) && <DetailsSection key="details" event={event} />,
    event.show_rsvp_form && <RsvpSection key="rsvp" event={event} />,
  ].filter(Boolean);

  return (
    <main className="relative flex flex-1 flex-col items-center overflow-hidden">
      {sections.map((section, i) => (
        <span key={i} className="contents">
          {i > 0 && <SectionDivider seed={21 + i * 6} />}
          {section}
        </span>
      ))}
    </main>
  );
}
