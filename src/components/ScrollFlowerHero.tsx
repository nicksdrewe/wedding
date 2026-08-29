"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { TextEffect } from "@/components/motion-primitives/text-effect";

const FRAME_COUNT = 129;
const FRAME_SRC = (i: number) => `/hero-frames/frame-${String(i + 1).padStart(4, "0")}.jpg`;
// How much scroll distance the sequence gets to play out over, in viewport
// heights. Longer = slower/more deliberate scrub per frame.
const PIN_DISTANCE_VH = 340;

export type HeroCta =
  | { kind: "guest" }
  | { kind: "signed-in"; label: string; href: string }
  | { kind: "no-profile" };

function ctaCopy(cta: HeroCta) {
  switch (cta.kind) {
    case "guest":
      return {
        eyebrow: "You're invited",
        heading: "Let us know you're coming",
        body: "RSVP to celebrate with us, or sign in to the hub to see the full details.",
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

export function ScrollFlowerHero({ cta }: { cta: HeroCta }) {
  const copy = ctaCopy(cta);

  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ctaRef = useRef<HTMLDivElement>(null);
  const headlineRef = useRef<HTMLDivElement>(null);
  const promptRef = useRef<HTMLDivElement>(null);
  const footerRef = useRef<HTMLParagraphElement>(null);

  const imagesRef = useRef<HTMLImageElement[]>([]);
  const drawnFrameRef = useRef(-1);
  const frameStateRef = useRef({ frame: 0 });

  const [loadedCount, setLoadedCount] = useState(0);
  const [ready, setReady] = useState(false);

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

      tl.to(frameStateRef.current, {
        frame: FRAME_COUNT - 1,
        ease: "none",
        onUpdate: () => drawFrame(Math.round(frameStateRef.current.frame)),
      });

      // Scroll prompt: present at rest, fades as soon as scrubbing starts.
      tl.to(promptRef.current, { opacity: 0, y: -12, duration: 0.08, ease: "power1.out" }, 0);

      // Headline rolls up and away right as the petals visibly start
      // separating (around the sequence's midpoint) — rotateX + a bottom
      // transform-origin reads as rolling away rather than just fading.
      tl.to(
        headlineRef.current,
        { opacity: 0, y: -60, rotateX: -70, duration: 0.16, ease: "power2.in" },
        0.46
      );

      // The RSVP/sign-in call to action rolls in from the same rest
      // position the headline left, settling well before the sequence
      // finishes so it's fully readable, not still animating, by the end.
      tl.fromTo(
        ctaRef.current,
        { opacity: 0, y: 60, rotateX: 70 },
        { opacity: 1, y: 0, rotateX: 0, duration: 0.2, ease: "power2.out" },
        0.52
      );

      // Domain credit stays essentially invisible until the sequence is
      // nearly done, then eases up to a still-subtle presence at rest.
      tl.fromTo(
        footerRef.current,
        { opacity: 0 },
        { opacity: 1, duration: 0.16, ease: "power1.out" },
        0.86
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

        {/* soft vignette so overlaid text stays legible on any frame */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse at 50% 42%, rgba(23,20,15,0) 30%, rgba(23,20,15,0.55) 100%)",
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

        {/* Headline and CTA share the exact same centred position, stacked
            and cross-faded via GSAP, so the roll-away/roll-in reads as one
            continuous swap rather than two independently placed blocks. */}
        <div className="absolute inset-0" style={{ perspective: 1000 }}>
          <div
            ref={headlineRef}
            className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center"
            style={{ transformOrigin: "50% 100%" }}
          >
            <p className="font-serif text-[13px] font-medium tracking-[0.32em] text-cream/85 uppercase">
              We&rsquo;re getting married
            </p>
            <TextEffect
              as="h1"
              per="char"
              preset="fade-in-blur"
              speedReveal={2.2}
              delay={0.15}
              className="mt-5 font-hero text-[15vw] leading-[0.94] font-semibold tracking-[-0.01em] text-cream sm:text-[110px] lg:text-[148px]"
              style={{ textShadow: "0 2px 40px rgba(0,0,0,0.35)" }}
            >
              Nick & Ellie
            </TextEffect>
            <p className="mt-5 font-reading text-2xl text-cream/85 italic md:text-[26px]">
              28 November 2026
            </p>
          </div>

          <div
            ref={ctaRef}
            className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center opacity-0"
            style={{ transformOrigin: "50% 0%" }}
          >
            <p className="font-serif text-[13px] font-medium tracking-[0.32em] text-cream/85 uppercase">
              {copy.eyebrow}
            </p>
            <h2 className="mt-4 font-hero text-[42px] leading-[1.05] font-semibold tracking-[-0.01em] text-cream sm:text-[52px]">
              {copy.heading}
            </h2>
            <p className="mt-4 max-w-md font-reading text-lg text-cream/85 italic">
              {copy.body}
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-4">
              <PrimaryButton href={copy.primary.href}>{copy.primary.label}</PrimaryButton>
              <GlassButton href={copy.secondary.href}>{copy.secondary.label}</GlassButton>
            </div>
          </div>
        </div>

        <div
          ref={promptRef}
          className="absolute bottom-10 left-1/2 z-10 flex -translate-x-1/2 flex-col items-center gap-2"
          style={{ animation: ready ? "bob 2.6s ease-in-out infinite" : undefined }}
        >
          <span
            aria-hidden="true"
            className="h-2.5 w-2.5 rounded-full bg-accent-soft"
            style={{
              boxShadow: "0 0 14px 4px rgba(124,148,130,0.65)",
              animation: ready ? "glowPulse 2.6s ease-in-out infinite" : undefined,
            }}
          />
          <p className="font-serif text-[11px] tracking-[0.2em] text-cream/70 uppercase">
            Scroll
          </p>
        </div>

        {/* Site credit lives here, not as a separate page footer — no white
            bar under a full-bleed graphic. Understated until the sequence
            settles at rest, where it reads as a quiet signature. */}
        <p
          ref={footerRef}
          className="absolute bottom-5 left-1/2 z-10 -translate-x-1/2 text-center font-serif text-[10px] tracking-[0.2em] text-cream/35 uppercase opacity-0"
        >
          weddingsweddings.co.uk
        </p>
      </section>
    </div>
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
      className="inline-block rounded-full border border-white/60 bg-white/20 px-10 py-4 font-serif text-sm font-medium text-cream shadow-[0_8px_24px_rgba(0,0,0,0.18),inset_0_1px_0_rgba(255,255,255,0.35)] backdrop-blur-md transition-[transform,box-shadow,background] duration-300 ease-[cubic-bezier(.22,1,.36,1)] hover:-translate-y-0.5 hover:scale-[1.02] hover:bg-white/30"
    >
      {children}
    </Link>
  );
}
