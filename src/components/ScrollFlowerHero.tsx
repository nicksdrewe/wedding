"use client";

import Link from "next/link";
import { ChevronDown, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import {
  MorphingPopover,
  MorphingPopoverContent,
  MorphingPopoverTrigger,
} from "@/components/motion-primitives/morphing-popover";
import { Spotlight } from "@/components/motion-primitives/spotlight";
import { SignInFields } from "@/components/SignInFields";

// Off for the engagement-only launch — the wedding date isn't set yet (see
// the "Summer 2028" placeholder below), so wedding RSVP has nothing real
// to collect against. Flip back to true once a real date is set.
const WEDDING_RSVP_ENABLED = false;

const FRAME_COUNT = 129;
const FRAME_SRC = (i: number) => `/hero-frames/frame-${String(i + 1).padStart(4, "0")}.jpg`;
// How much scroll distance the sequence gets to play out over, in viewport
// heights. Longer = slower/more deliberate scrub per frame.
const PIN_DISTANCE_VH = 340;

// The frame-index tween's duration is set explicitly to FRAME_COUNT - 1, so
// 1 timeline "time unit" = exactly 1 frame — every position below is a
// literal, checkable frame number.
//
// Intro build, entirely scroll-scrubbed (reversible — scroll up and it
// un-builds in the same order): the centred prompt is the only thing
// visible at rest, then as scrolling starts Nick and Ellie converge in
// from opposite sides together (not staggered — reads as "coming
// together", not a list), then the eyebrow line, then the date — before
// the whole assembled block rolls away and the CTA takes over.
const PROMPT_FADE_SPAN = 5;
const NAMES_IN_FRAME = 4;
const NAMES_IN_SPAN = 11;
const EYEBROW_IN_FRAME = 14;
const EYEBROW_IN_SPAN = 8;
const DATE_IN_FRAME = 21;
const DATE_IN_SPAN = 8;
const HEADLINE_EXIT_FRAME = 39;
const HEADLINE_EXIT_SPAN = 20;
// Starts once the headline's own roll-away is essentially finished
// (39 + 20 = 59) rather than 12 frames into it — the two were briefly
// overlapping mid-scroll, reading as the CTA flipping down onto still-
// visible headline text instead of a clean handoff.
const CTA_ENTER_FRAME = 57;
const CTA_ENTER_SPAN = 26;
const FOOTER_FRAME = 108;
const FOOTER_SPAN = 18;

const SCROLL_HINT_URGENT_MS = 10_000;

// fade + rise + sharpen-from-blur — the one reveal "shape" used for the
// eyebrow and date, so they read as one consistent motion language even
// though each is its own tween on its own frame window.
const REVEAL_FROM = { opacity: 0, y: 16, filter: "blur(10px)" };
const REVEAL_TO_BASE = { opacity: 1, y: 0, filter: "blur(0px)", ease: "power2.out" };

// Nick and Ellie use the same fade/blur language but converge horizontally
// from opposite edges instead of rising, so the two names visibly close
// the gap toward each other rather than each just fading in place.
const NAME_CONVERGE_DISTANCE = 64;
const NAME_FROM_LEFT = { opacity: 0, x: -NAME_CONVERGE_DISTANCE, filter: "blur(10px)" };
const NAME_FROM_RIGHT = { opacity: 0, x: NAME_CONVERGE_DISTANCE, filter: "blur(10px)" };
const NAME_TO = { opacity: 1, x: 0, filter: "blur(0px)", duration: NAMES_IN_SPAN, ease: "power2.out" };

export type HeroCta =
  | { kind: "guest" }
  | { kind: "signed-in"; label: string; href: string }
  | { kind: "no-profile" };

function ctaCopy(cta: HeroCta, landingCta: LandingCta | null) {
  switch (cta.kind) {
    case "guest":
      return {
        // Every piece of this reads from whichever event is flagged as
        // the landing CTA (see app/page.tsx and 0017/0019's migrations)
        // when one exists and the wedding RSVP isn't live yet — a couple
        // managing a hen do, stag do, or anything else through the
        // events system needs the heading/body here to actually match
        // what the button below says, not stay fixed to whatever
        // engagement-party wording was hardcoded when this shipped.
        // Falls back to that original copy if no event currently has the
        // flag on, so the page never renders truly empty.
        eyebrow:
          (WEDDING_RSVP_ENABLED ? null : landingCta?.eyebrow) ?? "You're invited",
        heading:
          WEDDING_RSVP_ENABLED
            ? "Let us know you're coming"
            : (landingCta?.heading ?? "Join us for the engagement party"),
        body: WEDDING_RSVP_ENABLED
          ? "RSVP to celebrate with us."
          : (landingCta?.body ??
              "The wedding date is still to come — for now, let us know you'll be there to celebrate the engagement."),
        primary: { href: "/rsvp", label: "RSVP" },
        secondary: { href: "/login", label: "Sign in" },
      };
    case "signed-in":
      return {
        eyebrow: "Welcome back",
        heading: "Jump back into planning",
        body: "Pick up right where you left off.",
        primary: { href: cta.href, label: cta.label },
        secondary: { href: "/logout", label: "Sign out" },
      };
    case "no-profile":
      return {
        eyebrow: "You're signed in",
        heading: "Almost there",
        body: "We haven't added you to the guest list yet — give Nick or Ellie a nudge.",
        primary: { href: "/no-access", label: "Continue" },
        secondary: { href: "/logout", label: "Sign out" },
      };
  }
}

export type LandingCta = {
  href: string;
  label: string;
  eyebrow: string | null;
  heading: string | null;
  body: string | null;
};

export function ScrollFlowerHero({
  cta,
  landingCta,
}: {
  cta: HeroCta;
  // Whichever event is flagged as the front door (see 0017_events_system.sql
  // and app/page.tsx) — null when no event currently has that flag on,
  // in which case the primary CTA button simply doesn't render.
  landingCta: LandingCta | null;
}) {
  const copy = ctaCopy(cta, landingCta);

  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ctaRef = useRef<HTMLDivElement>(null);
  const headlineRef = useRef<HTMLDivElement>(null);
  const nickRef = useRef<HTMLSpanElement>(null);
  const ellieRef = useRef<HTMLSpanElement>(null);
  const eyebrowRef = useRef<HTMLParagraphElement>(null);
  const dateRef = useRef<HTMLParagraphElement>(null);
  const promptRef = useRef<HTMLDivElement>(null);
  const promptInnerRef = useRef<HTMLDivElement>(null);
  const footerRef = useRef<HTMLParagraphElement>(null);
  const spotlightRef = useRef<HTMLDivElement>(null);

  const imagesRef = useRef<HTMLImageElement[]>([]);
  const drawnFrameRef = useRef(-1);
  const frameStateRef = useRef({ frame: 0 });

  const [loadedCount, setLoadedCount] = useState(0);
  const [ready, setReady] = useState(false);
  const [hintUrgent, setHintUrgent] = useState(false);

  // Preload every frame before any scroll-jacking is enabled — scrubbing
  // onto an undrawn frame would flash blank/broken. ~6MB across 129 frames
  // is a deliberate ceiling: heavy enough to look sharp, light enough to
  // still clear on patchy venue wifi during the wedding week.
  useEffect(() => {
    let cancelled = false;
    const images: HTMLImageElement[] = [];
    let loaded = 0;

    for (let i = 0; i < FRAME_COUNT; i++) {
      const img = new Image();
      img.src = FRAME_SRC(i);
      img.onload = img.onerror = () => {
        loaded += 1;
        if (!cancelled) setLoadedCount(loaded);
        if (!cancelled && loaded === FRAME_COUNT) setReady(true);
      };
      images.push(img);
    }
    imagesRef.current = images;

    return () => {
      cancelled = true;
    };
  }, []);

  // Most people don't instinctively scroll a hero that looks "finished" on
  // first paint. If nothing's happened in 10s, the hint grows and pulses
  // harder to make the affordance unmissable. No need to track/cancel this
  // against later scrolling: once scrubbing starts, the scroll-tied fade
  // below takes the whole prompt to opacity 0 regardless of this state.
  useEffect(() => {
    const t = setTimeout(() => setHintUrgent(true), SCROLL_HINT_URGENT_MS);
    return () => clearTimeout(t);
  }, []);

  // A soft key light that trails the cursor — like a studio softbox always
  // aimed at whatever point the mouse is over, gently lifting text and
  // buttons it passes across. Desktop-with-a-mouse only (a touch device has
  // no hover point to light), and skipped entirely under reduced-motion.
  useEffect(() => {
    const el = spotlightRef.current;
    if (!el) return;
    if (!window.matchMedia("(pointer: fine)").matches) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let targetX = window.innerWidth / 2;
    let targetY = window.innerHeight / 2;
    let currentX = targetX;
    let currentY = targetY;
    let raf = 0;
    let revealed = false;

    function onPointerMove(e: PointerEvent) {
      targetX = e.clientX;
      targetY = e.clientY;
      if (!revealed && el) {
        revealed = true;
        el.style.opacity = "1";
      }
    }

    function tick() {
      // Heavily damped trailing follow (8% per frame) rather than snapping
      // straight to the cursor — a real light rig drifts, it doesn't jump.
      currentX += (targetX - currentX) * 0.08;
      currentY += (targetY - currentY) * 0.08;
      if (el) {
        el.style.setProperty("--spot-x", `${currentX}px`);
        el.style.setProperty("--spot-y", `${currentY}px`);
      }
      raf = requestAnimationFrame(tick);
    }

    window.addEventListener("pointermove", onPointerMove);
    raf = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      cancelAnimationFrame(raf);
    };
  }, []);

  // Draw whichever frame is closest to the current scrub position, filling
  // the canvas cover-style (crop to fill, never letterbox) so the flower
  // stays large and centred at any viewport size, including mobile.
  function drawFrame(index: number) {
    const canvas = canvasRef.current;
    const img = imagesRef.current[index];
    if (!canvas || !img || !img.complete || img.naturalWidth === 0) return;
    if (drawnFrameRef.current === index) return;
    drawnFrameRef.current = index;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cssW = canvas.clientWidth;
    const cssH = canvas.clientHeight;
    if (canvas.width !== cssW * dpr || canvas.height !== cssH * dpr) {
      canvas.width = cssW * dpr;
      canvas.height = cssH * dpr;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);

    const imgRatio = img.naturalWidth / img.naturalHeight;
    const boxRatio = cssW / cssH;
    let drawW: number, drawH: number, dx: number, dy: number;
    if (imgRatio > boxRatio) {
      drawH = cssH;
      drawW = drawH * imgRatio;
      dx = (cssW - drawW) / 2;
      dy = 0;
    } else {
      drawW = cssW;
      drawH = drawW / imgRatio;
      dx = 0;
      dy = (cssH - drawH) / 2;
    }
    ctx.drawImage(img, dx, dy, drawW, drawH);
  }

  // Redraw the current frame on resize (orientation change, devtools, etc.)
  // without touching scroll position.
  useEffect(() => {
    if (!ready) return;
    function onResize() {
      drawnFrameRef.current = -1;
      drawFrame(Math.round(frameStateRef.current.frame));
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [ready]);

  useEffect(() => {
    if (!ready || !wrapRef.current) return;

    gsap.registerPlugin(ScrollTrigger);
    // A mobile browser's address bar collapsing as the visitor scrolls
    // fires a genuine window resize event a few seconds into the session
    // — ScrollTrigger's default behavior is to fully refresh (recompute
    // the pin spacer, re-measure the trigger) on any resize, which
    // reflows this whole pinned section including the CTA row. If a
    // popover (RSVP/hub-login — see MorphingPopover) happens to be open
    // at that moment, its Framer Motion layoutId-tracked position gets
    // pulled out from under it by that reflow — it doesn't visually
    // recover until closed and reopened against the now-settled layout.
    // This is documented, common enough on mobile that GSAP ships a flag
    // specifically for it, rather than something to fix by hand here.
    ScrollTrigger.config({ ignoreMobileResize: true });
    drawFrame(0);

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: wrapRef.current,
          start: "top top",
          // A function (re-evaluated on refresh), not a "+=340%" string:
          // ScrollTrigger resolves "%" end-values against the trigger
          // element's own measured height, not the viewport — for an
          // h-screen trigger those happen to be equal at rest, but
          // resolving it explicitly in pixels here avoids relying on that
          // coincidence, and stays correct if the trigger's own height
          // ever changes.
          end: () => `+=${window.innerHeight * (PIN_DISTANCE_VH / 100)}`,
          pin: true,
          scrub: 0.4, // slight smoothing lag so rapid scroll input doesn't stutter
          anticipatePin: 1,
          invalidateOnRefresh: true,
        },
      });

      // Explicit duration = FRAME_COUNT - 1 makes every other position in
      // this timeline a literal frame number (see constants above) instead
      // of a fraction guessed against an implicit default duration.
      tl.to(frameStateRef.current, {
        frame: FRAME_COUNT - 1,
        duration: FRAME_COUNT - 1,
        ease: "none",
        onUpdate: () => drawFrame(Math.round(frameStateRef.current.frame)),
      });

      // The centred prompt is the only thing on screen at rest; it fades
      // the instant scrubbing starts to hand off to the name build-in.
      tl.to(promptRef.current, { opacity: 0, y: -12, duration: PROMPT_FADE_SPAN, ease: "power1.out" }, 0);

      // Nick and Ellie converge from opposite sides at the same frame —
      // reads as the two of them coming together, not a staggered list —
      // then the framing copy above and below them. Each its own
      // scroll-scrubbed reveal, so scrolling back up un-builds them in
      // reverse.
      tl.fromTo(nickRef.current, NAME_FROM_LEFT, NAME_TO, NAMES_IN_FRAME);
      tl.fromTo(ellieRef.current, NAME_FROM_RIGHT, NAME_TO, NAMES_IN_FRAME);
      tl.fromTo(eyebrowRef.current, REVEAL_FROM, { ...REVEAL_TO_BASE, duration: EYEBROW_IN_SPAN }, EYEBROW_IN_FRAME);
      tl.fromTo(dateRef.current, REVEAL_FROM, { ...REVEAL_TO_BASE, duration: DATE_IN_SPAN }, DATE_IN_FRAME);

      // Once fully assembled, the whole block rolls up and away right as
      // the petals visibly start separating — rotateX + a bottom
      // transform-origin reads as rolling away rather than just fading.
      tl.to(
        headlineRef.current,
        { opacity: 0, y: -60, rotateX: -70, duration: HEADLINE_EXIT_SPAN, ease: "power2.in" },
        HEADLINE_EXIT_FRAME
      );

      // The RSVP/sign-in call to action rolls in from the same rest
      // position the headline left, settling well before the sequence
      // finishes so it's fully readable, not still animating, by the end.
      tl.fromTo(
        ctaRef.current,
        { opacity: 0, y: 60, rotateX: 70 },
        { opacity: 1, y: 0, rotateX: 0, duration: CTA_ENTER_SPAN, ease: "power2.out" },
        CTA_ENTER_FRAME
      );

      // Domain credit stays essentially invisible until the sequence is
      // nearly done, then eases up to a still-subtle presence at rest.
      tl.fromTo(
        footerRef.current,
        { opacity: 0 },
        { opacity: 1, duration: FOOTER_SPAN, ease: "power1.out" },
        FOOTER_FRAME
      );
    }, wrapRef);

    // ScrollTrigger's own automatic post-creation refresh can land before
    // this component's layout has actually settled (React mounts async,
    // well after the one-time window 'load' event ScrollTrigger normally
    // listens for) — its computed .end stays unset until something calls
    // refresh() again. Do that explicitly rather than rely on timing.
    ScrollTrigger.refresh();

    return () => ctx.revert();
  }, [ready]);

  return (
    <div ref={wrapRef} className="relative">
      <section className="relative flex h-screen items-center justify-center overflow-hidden bg-ink">
        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />

        {/* One flat, page-wide wash — not a box behind any one piece of
            text — plus the existing edge vignette for cinematic depth.
            Alpha chosen from actual WCAG math (see commit message) against
            the lightest plausible frame background, paired with every text
            size below qualifying for the "large text" 3:1 AA threshold
            rather than the stricter 4.5:1 normal-text one. */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-ink/48" />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse at 50% 42%, rgba(23,20,15,0) 30%, rgba(23,20,15,0.4) 100%)",
          }}
        />

        {!ready && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-ink">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-cream/25 border-t-cream" />
            <p className="font-serif text-xs tracking-[0.2em] text-cream/70 uppercase">
              {Math.round((loadedCount / FRAME_COUNT) * 100)}%
            </p>
          </div>
        )}

        {/* Prompt, headline and CTA all share the exact same centred
            position, stacked in one perspective container and driven
            entirely by the scrubbed timeline above — no independent
            mount-triggered animation, so scrolling up un-builds everything
            in reverse. */}
        <div className="absolute inset-0" style={{ perspective: 1000 }}>
          <div
            ref={promptRef}
            className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center"
          >
            <div
              ref={promptInnerRef}
              className="flex flex-col items-center gap-3"
              style={{
                // Gentle continuous float from the moment it's ready, not
                // just once the 10s escalation kicks in — otherwise the
                // hint reads as static/frozen for the first 10 seconds,
                // which is exactly the window most likely to lose someone
                // who doesn't think to scroll.
                animation: ready
                  ? hintUrgent
                    ? "attentionPulse 1.3s ease-in-out infinite"
                    : "bob 3.2s ease-in-out infinite"
                  : undefined,
              }}
            >
              <span
                aria-hidden="true"
                className={`rounded-full bg-accent-soft ${hintUrgent ? "h-5 w-5" : "h-3.5 w-3.5"}`}
                style={{
                  boxShadow: "0 0 20px 7px rgba(124,148,130,0.8)",
                  animation: ready ? "glowPulse 2.6s ease-in-out infinite" : undefined,
                }}
              />
              <p
                className={`font-serif font-bold tracking-[0.24em] text-white uppercase ${
                  hintUrgent ? "text-2xl" : "text-xl"
                }`}
                style={{ textShadow: "0 2px 16px rgba(0,0,0,0.7), 0 1px 3px rgba(0,0,0,0.9)" }}
              >
                Scroll to explore
              </p>
              <ChevronDown
                aria-hidden="true"
                className={`text-white ${hintUrgent ? "h-9 w-9" : "h-7 w-7"}`}
                style={{ filter: "drop-shadow(0 2px 10px rgba(0,0,0,0.7))" }}
                strokeWidth={2.5}
              />
            </div>
          </div>

          <div
            ref={headlineRef}
            className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center"
            style={{ transformOrigin: "50% 100%" }}
          >
            <p
              ref={eyebrowRef}
              // Static opacity-0, matching ctaRef/footerRef below —
              // GSAP's tl.fromTo() for this element (REVEAL_FROM, also
              // opacity:0) only actually sets that starting value once the
              // effect below runs, which is gated on `ready` (every hero
              // frame finished preloading). Without a static default too,
              // this rendered fully visible, in its final position, for
              // that whole window — directly on top of the equally
              // unhidden prompt below, since both containers are dead
              // centred. That's the "everything stacks in the centre
              // before settling" flash.
              className="font-serif text-xl font-bold tracking-[0.28em] text-white uppercase opacity-0"
              style={{ textShadow: "0 2px 14px rgba(0,0,0,0.65), 0 1px 3px rgba(0,0,0,0.85)" }}
            >
              We&rsquo;re getting married
            </p>
            <h1 className="mt-5 font-hero text-[15vw] leading-[0.94] font-semibold tracking-[-0.01em] text-white sm:text-[110px] lg:text-[148px]">
              <span
                ref={nickRef}
                className="inline-block opacity-0"
                style={{ textShadow: "0 2px 24px rgba(0,0,0,0.7), 0 1px 3px rgba(0,0,0,0.9)" }}
              >
                Nick
              </span>{" "}
              <span
                ref={ellieRef}
                className="inline-block opacity-0"
                style={{ textShadow: "0 2px 24px rgba(0,0,0,0.7), 0 1px 3px rgba(0,0,0,0.9)" }}
              >
                &amp; Ellie
              </span>
            </h1>
            <p
              ref={dateRef}
              className="mt-5 font-reading text-2xl text-cream italic opacity-0 md:text-[28px]"
              style={{ textShadow: "0 1px 14px rgba(0,0,0,0.6)" }}
            >
              Summer 2028
            </p>
          </div>

          <div
            ref={ctaRef}
            className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center opacity-0"
            style={{ transformOrigin: "50% 0%" }}
          >
            <p
              className="font-serif text-xl font-bold tracking-[0.28em] text-white uppercase"
              style={{ textShadow: "0 2px 14px rgba(0,0,0,0.65), 0 1px 3px rgba(0,0,0,0.85)" }}
            >
              {copy.eyebrow}
            </p>
            <h2
              className="mt-4 font-hero text-[38px] leading-[1.05] font-semibold tracking-[-0.01em] text-white sm:text-[50px]"
              style={{ textShadow: "0 2px 20px rgba(0,0,0,0.65), 0 1px 3px rgba(0,0,0,0.85)" }}
            >
              {copy.heading}
            </h2>
            <p
              className="mt-4 max-w-md font-reading text-2xl text-cream italic"
              style={{ textShadow: "0 1px 14px rgba(0,0,0,0.6)" }}
            >
              {copy.body}
            </p>
            <div className="mt-8 flex flex-col items-center gap-4">
              <div className="flex flex-wrap justify-center gap-4">
                {cta.kind === "guest" ? (
                  <>
                    {/* Deliberately NOT wrapped in a "relative z-10" div:
                        each MorphingPopoverContent is already position:fixed
                        with its own z-40, meant to compare against the
                        page's real top-level stacking context. Wrapping a
                        trigger in its own positioned+z-indexed div traps its
                        whole popover (including that z-40) inside a small
                        sibling stacking context instead — whichever trigger
                        is later in the DOM then paints its entire popover
                        over the other's, in full, regardless of the z-40.
                        That was the "sign in sits in front of RSVP" bug. */}
                    {WEDDING_RSVP_ENABLED && <RsvpMorphingButton />}
                    {/* Whichever event is flagged as the front door (see
                        app/page.tsx and 0017_events_system.sql) — an open
                        RSVP anyone can fill in, not gated by an account at
                        all, so it leads with the same prominence the
                        wedding RSVP itself gets once that's live. No event
                        currently flagged just means this doesn't render. */}
                    {landingCta && (
                      <PrimaryButton href={landingCta.href}>{landingCta.label}</PrimaryButton>
                    )}
                  </>
                ) : (
                  <>
                    <PrimaryButton href={copy.primary.href}>{copy.primary.label}</PrimaryButton>
                    <GlassButton href={copy.secondary.href}>{copy.secondary.label}</GlassButton>
                  </>
                )}
              </div>
              {/* Hub login lives here — a small, muted, secondary line under
                  the engagement CTA rather than a same-weight button beside
                  it, and never mentioned in the heading/body copy above.
                  Most visitors right now are engagement-party respondents
                  with no account at all; the hub is for the couple/family
                  who already know it exists. */}
              {cta.kind === "guest" && <HubLoginTrigger />}
            </div>
          </div>
        </div>

        {/* Site credit lives here, not as a separate page footer — no white
            bar under a full-bleed graphic. Understated until the sequence
            settles at rest, where it reads as a quiet signature. */}
        <p
          ref={footerRef}
          className="absolute bottom-5 left-1/2 z-10 -translate-x-1/2 text-center font-serif text-xs tracking-[0.2em] text-cream/50 uppercase opacity-0"
          style={{ textShadow: "0 1px 8px rgba(0,0,0,0.5)" }}
        >
          weddingsweddings.co.uk
        </p>

        {/* Cursor-trailing key light — a soft-light blend so it reads as
            studio lighting catching whatever it passes over (text, button
            faces, the photo itself) rather than a flat highlight sitting on
            top. Last in the DOM so it blends against everything beneath it.
            Placed after the overlay/vignette on purpose: it needs to light
            the wash too, not just the content stacked above it. */}
        <div
          ref={spotlightRef}
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-20 opacity-0 transition-opacity duration-700 ease-out"
          style={{
            background:
              "radial-gradient(circle 34vw at var(--spot-x, 50%) var(--spot-y, 50%), rgba(255,244,224,0.16) 0%, rgba(255,244,224,0.06) 45%, transparent 72%)",
            mixBlendMode: "soft-light",
          }}
        />
      </section>
    </div>
  );
}

// Shared by the Link-based PrimaryButton and the button-based RSVP
// popover trigger below, so the two look identical regardless of which
// element they actually render as.
const PRIMARY_BUTTON_CLASS =
  "group relative inline-block overflow-hidden rounded-full bg-gradient-to-br from-[#2b2e28] to-[#1b1d19] px-10 py-4 font-serif text-sm font-medium text-cream shadow-[0_10px_30px_rgba(76,107,82,0.35),inset_0_1px_0_rgba(255,255,255,0.15)] transition-[transform,box-shadow] duration-300 ease-[cubic-bezier(.22,1,.36,1)] hover:-translate-y-0.5 hover:scale-[1.02] hover:shadow-[0_16px_40px_rgba(76,107,82,0.45),inset_0_1px_0_rgba(255,255,255,0.2)]";

function ButtonShineLabel({ children }: { children: React.ReactNode }) {
  return (
    <>
      <span className="relative z-10">{children}</span>
      <span
        aria-hidden="true"
        className="pointer-events-none absolute top-0 left-0 h-full w-2/5 bg-gradient-to-r from-transparent via-white/35 to-transparent"
        style={{ animation: "shine 4.5s ease-in-out infinite" }}
      />
    </>
  );
}

function PrimaryButton({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className={PRIMARY_BUTTON_CLASS}>
      <ButtonShineLabel>{children}</ButtonShineLabel>
    </Link>
  );
}

// Spotlight (vendored from motion-primitives) only lights up once it's seen
// a real mouseenter/mousemove over its parent — by design, so it reads as
// reactive rather than static. But a click that opens one of these panels
// doesn't itself count as "entering" it (the cursor was already there when
// the listener got attached), so without a nudge the glow would silently
// never appear unless the visitor happened to wiggle the mouse afterward.
// Fires one synthetic mousemove at the panel's centre shortly after it
// mounts, so the rim is visibly lit as soon as the panel settles, with real
// cursor movement taking over from there. The delay covers Spotlight's own
// two-effect mount chain (it re-renders once to learn its parent before
// attaching listeners) — well under either panel's own 450ms open
// transition, so it reads as part of the same reveal.
function useSpotlightReveal(open: boolean, ref: React.RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => {
      const el = ref.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      el.dispatchEvent(new MouseEvent("mouseenter", { clientX: cx, clientY: cy }));
      el.dispatchEvent(new MouseEvent("mousemove", { clientX: cx, clientY: cy }));
    }, 120);
    return () => clearTimeout(t);
  }, [open, ref]);
}

// The generic /rsvp page just tells an un-linked visitor "this isn't your
// link yet, ask Nick or Ellie" — not enough content to justify a full page
// navigation. Instead the RSVP button morphs in place into that same
// message, expanding from the button itself via the shared layoutId
// between trigger and content (see morphing-popover.tsx).
function RsvpMorphingButton() {
  const [open, setOpen] = useState(false);
  const spotlightWrapRef = useRef<HTMLDivElement>(null);
  useSpotlightReveal(open, spotlightWrapRef);

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.div
            key="rsvp-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-30 bg-ink/70 backdrop-blur-sm"
          />
        )}
      </AnimatePresence>
      <MorphingPopover
        open={open}
        onOpenChange={setOpen}
        variants={{
          initial: { opacity: 0, filter: "blur(10px)" },
          animate: { opacity: 1, filter: "blur(0px)" },
          exit: { opacity: 0, filter: "blur(10px)" },
        }}
        transition={{ type: "spring", bounce: 0.12, duration: 0.45 }}
      >
        <MorphingPopoverTrigger asChild>
          <button type="button" className={PRIMARY_BUTTON_CLASS}>
            <ButtonShineLabel>RSVP</ButtonShineLabel>
          </button>
        </MorphingPopoverTrigger>
        <MorphingPopoverContent
          // Positioning/sizing only — fixed and centred over the hero's own
          // text, not relative to the trigger's DOM parent, so it reads as
          // taking over the whole scene rather than a small dropdown near
          // the button. The actual glass surface lives in the two divs
          // below: the library's own default bg/border/padding are
          // stripped here so they don't show through underneath it.
          // The library's default classes include a dark: variant
          // (dark:bg-zinc-700) that a plain `bg-transparent` doesn't
          // cancel — this site's dev/system dark mode was leaking that
          // grey fill through. Neutralised explicitly below.
          className="fixed top-1/2 left-1/2 z-40 w-[min(90vw,26rem)] -translate-x-1/2 -translate-y-1/2 rounded-[28px] border-none bg-transparent p-0 text-cream shadow-[0_30px_90px_rgba(0,0,0,0.6)] dark:border-none dark:bg-transparent dark:text-cream"
        >
          {/* Spotlight-border: a slim gap around the glass panel, tinted
              just enough to read as a hairline, with the mouse-tracking
              Spotlight glow (from motion-primitives) sitting in that gap
              so it shows as a soft glowing rim rather than a highlight
              sitting on top of the content. 2px rather than a true 1px
              hairline — visible enough to register as a rim through the
              blur without reading as a thick outline. */}
          <div ref={spotlightWrapRef} className="relative overflow-hidden rounded-[28px] bg-cream/10 p-[2px]">
            {/* A self-contained arbitrary radial-gradient, not the
                from/via/to colour-stop utilities — confirmed by direct
                inspection that this project's Tailwind build never
                populates the --tw-gradient-stops variable from those
                utilities alone (v4 seems to need a direction utility such
                as bg-linear or bg-radial present to wire that variable up
                at all), which is what the vendored Spotlight component's
                own base classes rely on. Baking the colours directly into
                the gradient function sidesteps that variable entirely;
                twMerge still correctly lets this override the base
                component's own background image value, since both are
                recognised as the same conflict group. */}
            <Spotlight
              className="bg-[radial-gradient(circle,#7c9482,#f4f1ec_45%,transparent_78%)] blur-3xl"
              size={260}
            />
            <div className="relative h-full w-full rounded-[26px] bg-gradient-to-b from-[#232520]/55 via-[#232520]/72 to-[#232520]/85 p-8 text-center text-cream shadow-[inset_0_1px_0_rgba(255,255,255,0.14)] backdrop-blur-2xl">
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="absolute top-4 right-4 text-cream/50 transition-colors hover:text-cream"
              >
                <X className="h-5 w-5" strokeWidth={2} />
              </button>
              <p className="font-serif text-xs font-bold tracking-[0.28em] text-cream/70 uppercase">
                You&rsquo;re invited
              </p>
              <h3 className="mt-3 font-hero text-2xl font-semibold text-white">
                Check your invitation
              </h3>
              <p className="mt-4 font-reading text-base text-cream/85 italic">
                Your invitation email contains a personal RSVP link — follow
                that to respond. Can&rsquo;t find it? Let Nick or Ellie know
                and they&rsquo;ll resend it.
              </p>
            </div>
          </div>
        </MorphingPopoverContent>
      </MorphingPopover>
    </>
  );
}

// Mirrors RsvpMorphingButton's structure (same morph, same spotlight-border
// panel) but the trigger itself is a small muted text link rather than a
// full button — this is the quiet, secondary path for the couple/family who
// already know the hub exists, not something an anonymous engagement-party
// respondent should read as an equally-weighted choice. Nests the same
// sign-in form used on the standalone /login page (kept as a no-JS/bookmark
// fallback) rather than re-implementing it.
function HubLoginTrigger() {
  const [open, setOpen] = useState(false);
  const spotlightWrapRef = useRef<HTMLDivElement>(null);
  useSpotlightReveal(open, spotlightWrapRef);

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.div
            key="signin-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-30 bg-ink/70 backdrop-blur-sm"
          />
        )}
      </AnimatePresence>
      <MorphingPopover
        open={open}
        onOpenChange={setOpen}
        variants={{
          initial: { opacity: 0, filter: "blur(10px)" },
          animate: { opacity: 1, filter: "blur(0px)" },
          exit: { opacity: 0, filter: "blur(10px)" },
        }}
        transition={{ type: "spring", bounce: 0.12, duration: 0.45 }}
      >
        <MorphingPopoverTrigger asChild>
          <button
            type="button"
            className="font-serif text-xs font-medium tracking-[0.08em] text-cream/55 underline decoration-cream/30 decoration-dotted underline-offset-4 transition-colors duration-200 hover:text-cream/85 hover:decoration-cream/60"
            style={{ textShadow: "0 1px 6px rgba(0,0,0,0.5)" }}
          >
            Hub login
          </button>
        </MorphingPopoverTrigger>
        <MorphingPopoverContent
          // Sized/positioned only, no height cap here — see the comment
          // below on why max-height + scrolling lives one level deeper
          // instead of on this element. See RsvpMorphingButton for why the
          // dark: variant needs neutralising explicitly too.
          className="fixed top-1/2 left-1/2 z-40 w-[min(90vw,26rem)] -translate-x-1/2 -translate-y-1/2 rounded-[28px] border-none bg-transparent p-0 text-ink shadow-[0_30px_90px_rgba(0,0,0,0.35)] dark:border-none dark:bg-transparent dark:text-ink"
        >
          <div ref={spotlightWrapRef} className="relative overflow-hidden rounded-[28px] bg-ink/10 p-[2px]">
            {/* Self-contained gradient — see RsvpMorphingButton's Spotlight
                for why the colour-stop utilities don't work here. */}
            <Spotlight
              className="bg-[radial-gradient(circle,#4c6b52,#7c9482_45%,transparent_78%)] blur-3xl"
              size={260}
            />
            {/* max-h/overflow-y-auto live here, not on MorphingPopoverContent
                itself: that element carries the shared layoutId Framer
                Motion animates between the trigger and this panel, and
                constraining ITS height mid-animation was the likely cause
                of the panel visually vanishing after opening — Framer's
                layout projection re-measuring against a height-clamped,
                scrolling box mid-transition. Clamping one level deeper
                keeps the FLIP-tracked box's own geometry simple and
                stable, while the sign-in form (taller than RSVP's message)
                still gets to scroll internally on short viewports. */}
            <div className="relative max-h-[85vh] w-full overflow-y-auto overflow-x-hidden rounded-[26px] bg-gradient-to-b from-white/45 via-[#f4f1ec]/55 to-[#ece7dc]/60 p-8 text-center text-ink shadow-[inset_0_1px_0_rgba(255,255,255,0.5)] backdrop-blur-2xl">
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="absolute top-4 right-4 text-ink/40 transition-colors hover:text-ink"
              >
                <X className="h-5 w-5" strokeWidth={2} />
              </button>
              <p className="font-serif text-xs font-bold tracking-[0.28em] text-ink-soft uppercase">
                Nick &amp; Ellie
              </p>
              <h3 className="mt-3 font-hero text-2xl font-semibold text-ink">Sign in</h3>
              <div className="mt-6">
                <SignInFields next="/hub" />
              </div>
            </div>
          </div>
        </MorphingPopoverContent>
      </MorphingPopover>
    </>
  );
}

function GlassButton({ href, children }: { href: string; children: React.ReactNode }) {
  // Opaque light pill rather than a "glass over dark photo" treatment: the
  // source frames are light grey, so near-white text on a translucent light
  // background would be low-contrast regardless of blur. Solid ink text on
  // a near-opaque cream surface holds contrast no matter what's behind it.
  return (
    <Link
      href={href}
      className="inline-block rounded-full border border-ink/10 bg-cream/95 px-10 py-4 font-serif text-sm font-medium text-ink shadow-[0_8px_24px_rgba(0,0,0,0.22)] backdrop-blur-md transition-[transform,box-shadow,background] duration-300 ease-[cubic-bezier(.22,1,.36,1)] hover:-translate-y-0.5 hover:scale-[1.02] hover:bg-cream"
    >
      {children}
    </Link>
  );
}
