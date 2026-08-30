import type { Metadata, Viewport } from "next";
import { Archivo, Source_Serif_4, Manrope } from "next/font/google";
import "./globals.css";

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
  weight: ["500", "600"],
});

export const metadata: Metadata = {
  title: "Nick & Ellie — Summer 2028",
  description: "Nick & Ellie's wedding hub",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  themeColor: "#f4f1ec",
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

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${ui.variable} ${display.variable} ${reading.variable} ${hero.variable} antialiased`}
    >
      {/* No h-full on <html>/<body>: that pins <html> to exactly one
          viewport tall while content (like the scroll-scrubbed landing
          hero, ~4.5 viewports) grows past it on <body> — the browser still
          scrolls correctly either way, but it left GSAP's ScrollTrigger
          reading the wrong element's scrollTop and stuck at 0. min-h-screen
          keeps the flex-col layout filling short pages without capping tall
          ones. */}
      <body className="min-h-screen flex flex-col bg-cream text-ink font-serif">
        {children}
      </body>
    </html>
  );
}
