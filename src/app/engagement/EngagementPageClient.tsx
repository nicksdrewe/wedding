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
  addEngagementPhoto,
  removeEngagementPhoto,
  updateEngagementPhoto,
  updateEngagementPhotoCaption,
} from "@/lib/engagement/actions";

const EASE = [0.22, 1, 0.36, 1] as [number, number, number, number];
const FADE_UP = { hidden: { opacity: 0, y: 14 }, visible: { opacity: 1, y: 0 } };

const VENUE_NAME = "The Black Lion";
const VENUE_ADDRESS = "The Black Lion, Hammersmith, London";
const PARTY_DATE = "24 October 2026";
const PARTY_TIME = "7pm";

// Hoisted to module scope rather than an inline array literal in the JSX
// below — GlowEffect now memoises its animation target on this array's
// VALUES (see glow-effect.tsx), but keeping the reference itself stable
// too means React never even has a reason to consider it "changed" on
// re-render, belt and suspenders against the glow restarting/stuttering
// every time this form's state changes (typing, choosing attending, etc).
const RSVP_GLOW_COLORS = ["#4c6b52", "#7c9482", "#f4f1ec", "#232520"];

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

// Spotlight-border wrapper for this page's light, cream-backed cards —
// same "p-[2px] gap with a mouse-tracking Spotlight glow inside it"
// structure as ScrollFlowerHero's RSVP/sign-in popovers, just tuned down
// for a light card sitting on a light (cream) page rather than a glass
// panel over a dark photo: a quieter ink-tinted gap and semi-transparent
// botanical-green gradient stops (rather than those popovers' fully
// opaque ones) so the rim reads as a soft glow, not a bright halo.
// The self-contained radial-gradient with hex baked directly in is
// required here, not the from-*/via-*/to-* utilities — this project's
// Tailwind build never wires up --tw-gradient-stops from those bare
// colour-stop utilities alone (confirmed multiple times elsewhere in
// this codebase), which is what Spotlight's own base classes rely on.
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

// A caption that stays hidden until its photo is hovered, then follows the
// cursor — via the vendored Cursor component, which hides the real OS
// cursor and shows this pill in its place. Styled in this site's palette
// (ink pill, cream text) rather than the reference demo's neon green. On
// touch devices no hover ever fires, so the pill simply never appears.
//
// Rendered ONCE here at the gallery level (see GallerySection), not one
// instance per photo nested inside each polaroid card — every polaroid is
// rotated (either via `style={{ transform: rotate(...) }}` on
// RealPolaroidCard, or via the InView wrapper's own `rotate` motion
// variant for placeholders), and any ancestor with a CSS transform becomes
// the containing block for a `position: fixed` descendant instead of the
// viewport (standard, spec'd CSS behaviour). A follower pill nested inside
// a rotated card was therefore positioning itself against that rotated
// box's own (rotated) coordinate space while still receiving raw,
// unrotated viewport mouse coordinates — a real, reported bug ("doesn't
// align with where the mouse actually is"), worse the more a given card
// was rotated. One shared instance living outside every rotated card,
// driven by onMouseEnter/onMouseLeave from whichever photo is currently
// hovered (see RealPolaroidCard/PlaceholderPolaroidCard), sidesteps the
// whole problem — no rotated ancestor ever sits between it and the true
// viewport.
//
// This is a small bespoke follower rather than the vendored Cursor
// component: Cursor's `attachToParent` modes don't fit a single shared
// instance tracking many separate hover targets — `attachToParent={true}`
// needs to be a literal DOM child of the hovered element (which is exactly
// the rotated nesting we're trying to get out of), and
// `attachToParent={false}` sets `document.body.style.cursor = 'none'` for
// the whole page with no cleanup to undo it, permanently hiding the real
// cursor site-wide the moment this mounts. Springing our own motion values
// off raw mousemove coordinates avoids both.
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
// follow, which is exactly the "glitches a tiny bit" report (the pill
// jumping to the tap point and sticking, or briefly appearing on scroll).
// Gating the hover handlers on this rather than a screen-width check,
// since a touch device isn't reliably identified by viewport size (a
// large tablet, a touch laptop) and this is evaluated per-event rather
// than at render time, so there's no server/client markup to keep in sync
// (see the CSS-only `[@media(hover:none)]` static caption below, which
// takes the opposite, no-JS approach for the same reason).
function isHoverCapable() {
  return typeof window !== "undefined" && window.matchMedia("(hover: hover) and (pointer: fine)").matches;
}

function RealPolaroidCard({
  photo,
  rotate,
  aspect,
  isCouple,
  onHoverCaption,
}: {
  photo: EngagementPhoto;
  rotate: number;
  aspect: string;
  isCouple: boolean;
  onHoverCaption: (caption: string | null) => void;
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

  function handleReplaced(url: string) {
    startTransition(async () => {
      await updateEngagementPhoto(photo.id, url);
    });
  }

  const [editingCaption, setEditingCaption] = useState(false);
  const [captionDraft, setCaptionDraft] = useState(photo.caption ?? "");
  const [captionPending, startCaptionTransition] = useTransition();

  function saveCaption() {
    setEditingCaption(false);
    if (captionDraft === (photo.caption ?? "")) return;
    startCaptionTransition(async () => {
      await updateEngagementPhotoCaption(photo.id, captionDraft);
    });
  }

  const image = (
    // eslint-disable-next-line @next/next/no-img-element -- Drive-hosted, arbitrary host
    <img
      src={toDriveImageUrl(photo.image_url)}
      alt={photo.caption ?? "Engagement photo"}
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
          // Hidden by default (the cursor-follow pill handles it on a real
          // mouse) and shown only on devices with no hover capability — see
          // isHoverCapable above for why this is a pure CSS media query
          // rather than a JS touch check.
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
  const [hoveredCaption, setHoveredCaption] = useState<string | null>(null);

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

      {/* A CSS Grid, not a columns-based masonry — the previous
          `columns-2 sm:columns-3` layout is a well-known source of real
          mobile Safari rendering bugs (reflow when async content settles,
          inconsistent break-inside-avoid support), and kept producing
          live "images out of alignment on mobile" reports even after the
          actual image-loading failures behind the first report were
          fixed. Trades true masonry's tight vertical packing (a shorter
          card next to a taller one in the same row leaves visible
          whitespace below it) for layout that's simply correct and
          reflow-free on every browser, which matters more on a page real
          guests are actively using. */}
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

      {/* Single shared instance, rendered here rather than inside each
          polaroid card — see the comment on HoverCaption above. */}
      <HoverCaption caption={hoveredCaption} />
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
          className="h-full"
        >
          <SpotlightCard wrapperClassName="h-full">
            <div className="relative flex h-full flex-col justify-center gap-5 rounded-[26px] bg-white p-8">
              <div>
                <p className="flex items-center gap-2 font-serif text-xs tracking-[0.2em] text-ink-soft/70 uppercase">
                  <Calendar className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" /> Date &amp; time
                </p>
                <p className="mt-1.5 font-display text-xl text-ink">{PARTY_DATE}, {PARTY_TIME}</p>
              </div>
              <div className="h-px w-full bg-ink/10" />
              <div>
                <p className="flex items-center gap-2 font-serif text-xs tracking-[0.2em] text-ink-soft/70 uppercase">
                  <MapPin className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" /> Venue
                </p>
                <p className="mt-1.5 font-display text-xl text-ink">{VENUE_NAME}, Hammersmith</p>
              </div>
              <p className="font-reading text-sm text-ink-soft">
                This one&rsquo;s drinks and catching up rather than a sit-down
                meal — come fed! RSVP below and we&rsquo;ll see you there.
              </p>
            </div>
          </SpotlightCard>
        </InView>

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
                title={`Map to ${VENUE_NAME}, Hammersmith`}
              />
              {/* No label overlay here — Google's own embed already places a
                  "The Black Lion" pin/label on the map itself now that it
                  points at a real, resolvable venue, and a second label of
                  ours sitting on top of it just duplicated and overlapped it.
                  The venue name is already stated in the text card beside
                  this one. */}
              <div aria-hidden="true" className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-white/15" />
            </div>
          </SpotlightCard>
        </InView>
      </div>
    </section>
  );
}

type OtherAttendee = { id: number; name: string };

// One row of the "bringing others" list. The first row (index 0) is
// already visible the instant the surrounding Disclosure opens (see the
// "Bringing others" checkbox below), so it doesn't need its own reveal.
// Every row after that is appended live while the user types — see
// updateOtherName — so it mounts closed and flips itself open a frame
// later, giving it the same smooth Disclosure grow-in the first field
// gets from its parent, rather than popping in already-expanded.
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
  const [bringingOthers, setBringingOthers] = useState(false);
  const [others, setOthers] = useState<OtherAttendee[]>([{ id: 0, name: "" }]);
  const nextOtherId = useRef(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  // Classic "always show one empty trailing input": once the last field in
  // the list has text in it, grow the list by one more empty field below
  // it. This can keep going indefinitely — there's no cap in the UI.
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
    // Never send the dangling empty trailing field (or any other blank
    // entry) to the server — only real names.
    const otherNames =
      attending && bringingOthers
        ? others.map((o) => o.name.trim()).filter((name) => name.length > 0)
        : [];
    const res = await fetch("/api/engagement-rsvp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fullName,
        email,
        attending,
        others: otherNames,
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

                {/* GlowEffect (vendored from motion-primitives) sits behind
                    the button as an absolutely-positioned, pointer-events-
                    none layer — the button itself needs `relative` so it
                    paints above it, since an absolutely-positioned sibling
                    earlier in the DOM otherwise paints over a plain static
                    one regardless of source order. Botanical greens and warm
                    cream/ink rather than the reference's rainbow, soft blur
                    and a small scale bleed so it reads as a quiet halo, not
                    a spotlight. */}
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
    </main>
  );
}
