"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { TextEffect } from "@/components/motion-primitives/text-effect";

const FRAME_COUNT = 130;
const FRAME_SRC = (i: number) => `/hero-frames/ezgif-frame-${String(i + 1).padStart(3, "0")}.jpg`;
// How much scroll distance the sequence gets to play out over, in viewport
// heights. Longer = slower/more deliberate scrub per frame.
const PIN_DISTANCE_VH = 340;

export type HeroCta =
  | { kind: "guest" }
  | { kind: "signed-in"; label: string; href: string }
  | { kind: "no-profile" };

export function ScrollFlowerHero({ cta }: { cta: HeroCta }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ctaRef = useRef<HTMLDivElement>(null);
  const headlineRef = useRef<HTMLDivElement>(null);
  const promptRef = useRef<HTMLDivElement>(null);

  const imagesRef = useRef<HTMLImageElement[]>([]);
  const drawnFrameRef = useRef(-1);
  const frameStateRef = useRef({ frame: 0 });

  const [loadedCount, setLoadedCount] = useState(0);
  const [ready, setReady] = useState(false);

  // Preload every frame before any scroll-jacking is enabled — scrubbing
  // onto an undrawn frame would flash blank/broken, and 130 frames at ~18KB
  // each is light enough (~2.4MB) to just wait out rather than stream in.
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

      // Headline stays put through the first stretch of the sequence, then
      // eases back and fades as the CTAs take over near the end.
      tl.to(headlineRef.current, { opacity: 0, y: -28, duration: 0.22, ease: "power1.inOut" }, 0.62);

      // CTAs reveal smoothly approaching the final frame.
      tl.fromTo(
        ctaRef.current,
        { opacity: 0, y: 22 },
        { opacity: 1, y: 0, duration: 0.24, ease: "power2.out" },
        0.74
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

        <div ref={headlineRef} className="relative z-10 flex flex-col items-center px-6 text-center">
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

        <div
          ref={ctaRef}
          className="absolute bottom-16 left-1/2 z-10 flex -translate-x-1/2 flex-wrap justify-center gap-4 opacity-0"
        >
          {cta.kind === "guest" && (
            <>
              <PrimaryButton href="/rsvp">RSVP</PrimaryButton>
              <GlassButton href="/login">Sign in</GlassButton>
            </>
          )}
          {cta.kind === "signed-in" && (
            <>
              <PrimaryButton href={cta.href}>{cta.label}</PrimaryButton>
              <GlassButton href="/logout">Sign out</GlassButton>
            </>
          )}
          {cta.kind === "no-profile" && (
            <>
              <PrimaryButton href="/no-access">You&rsquo;re signed in</PrimaryButton>
              <GlassButton href="/logout">Sign out</GlassButton>
            </>
          )}
        </div>
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
