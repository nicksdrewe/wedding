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
  title: "Nick & Ellie — 28.11.26",
  description: "Nick & Ellie's wedding hub",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  themeColor: "#f4f1ec",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${ui.variable} ${display.variable} ${reading.variable} ${hero.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-cream text-ink font-serif">
        {children}
      </body>
    </html>
  );
}
