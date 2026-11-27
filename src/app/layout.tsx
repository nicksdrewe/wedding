import type { Metadata, Viewport } from "next";
import { Archivo, Fraunces, Source_Serif_4, Manrope } from "next/font/google";
import "./globals.css";
import { ViewAsBanner } from "@/components/ViewAsBanner";
import { RegisterServiceWorker } from "@/components/RegisterServiceWorker";
import { NavProgress } from "@/components/NavProgress";
import { WeddingProvider } from "@/components/WeddingProvider";
import { getCurrentWedding } from "@/lib/wedding/current";
import { namesFrom, possessive } from "@/lib/wedding/names";
import { themeCss, type WeddingTheme } from "@/lib/wedding/theme";
import { Suspense } from "react";

// Grotesque carries UI, structure and numbers; serif carries reading copy.
// Never mixed within one line — see docs/design-brief.md.
const ui = Archivo({
  variable: "--font-ui",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const display = Archivo({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["700"],
});

const reading = Source_Serif_4({
  variable: "--font-reading",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
});

// Landing only — the single oversized "Nick & Ellie" moment.
const hero = Manrope({
  variable: "--font-hero",
  subsets: ["latin"],
  preload: false,
  weight: ["500", "600"],
});

// Page titles, section headings and big numbers on signed-in pages — the one
// face with character (see docs/design-system.md). Variable font, so one file.
const title = Fraunces({
  variable: "--font-title",
  subsets: ["latin"],
  style: ["normal", "italic"],
  axes: ["opsz"],
});

// Title, description and home-screen name come from the wedding this address
// belongs to.
export async function generateMetadata(): Promise<Metadata> {
  const names = namesFrom(await getCurrentWedding());
  const title = names.dateLabel ? `${names.displayName} — ${names.dateLabel}` : names.displayName;
  const short = names.partnerTwo ? `${names.partnerOne[0]} & ${names.partnerTwo[0]}` : names.displayName;
  return {
    title,
    description: `${possessive(names)} wedding hub`,
    manifest: "/api/manifest",
    // Added to a phone's home screen it opens like an app.
    appleWebApp: { capable: true, title: short, statusBarStyle: "default" },
    icons: { apple: "/icons/icon-192.png" },
  };
}

export const viewport: Viewport = {
  themeColor: "#f4f1ec",
  width: "device-width",
  initialScale: 1,
  // Without an explicit minimum, mobile Safari/Chrome let a pinch-out
  // gesture zoom BELOW the page's own 1:1 layout scale, shrinking every
  // page's content smaller and smaller with no floor — reported live on
  // real devices. Deliberately not pairing this with maximumScale/
  // userScalable:false: capping zoom-IN is a real accessibility harm for
  // low-vision visitors and isn't what was reported here.
  minimumScale: 1,
  // Without this, Chrome/Edge's "force dark mode for websites" feature can
  // auto-recolor the whole page using its own heuristics whenever the OS
  // is in dark mode — even though every color here is already explicitly
  // set. Those heuristics sometimes invert a text/background pair to
  // nearly the same resulting color, which reads as "the text is just not
  // there" regardless of what color it's actually set to. This site has
  // exactly one deliberately-designed light theme; declaring that
  // explicitly opts it out of any such browser-level recoloring.
  colorScheme: "light",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const wedding = await getCurrentWedding();
  const theme = (wedding?.theme ?? {}) as WeddingTheme;
  const css = themeCss(theme);
  return (
    <html
      data-mode={theme.mode === "dark" ? "dark" : "light"}
      lang="en"
      className={`${ui.variable} ${display.variable} ${reading.variable} ${hero.variable} ${title.variable} antialiased`}
    >
      {/* No h-full on <html>/<body>: that pins <html> to exactly one
          viewport tall while content (like the scroll-scrubbed landing
          hero, ~4.5 viewports) grows past it on <body> — the browser still
          scrolls correctly either way, but it left GSAP's ScrollTrigger
          reading the wrong element's scrollTop and stuck at 0. min-h-screen
          keeps the flex-col layout filling short pages without capping tall
          ones. */}
      <body className="min-h-screen flex flex-col bg-cream text-ink font-serif">
        {/* The couple's palette and mode (see lib/wedding/theme.ts). */}
        {css && <style dangerouslySetInnerHTML={{ __html: css }} />}
        <WeddingProvider names={namesFrom(wedding)}>{children}</WeddingProvider>
        <ViewAsBanner />
        <Suspense fallback={null}>
          <NavProgress />
        </Suspense>
        <RegisterServiceWorker />
      </body>
    </html>
  );
}
