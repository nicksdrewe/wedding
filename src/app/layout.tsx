import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Parisienne } from "next/font/google";
import "./globals.css";

// Placeholder pairing — swap once the couple approves fonts (see build brief §8).
const serif = Cormorant_Garamond({
  variable: "--font-serif",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const script = Parisienne({
  variable: "--font-script",
  subsets: ["latin"],
  weight: ["400"],
});

export const metadata: Metadata = {
  title: "Nick & Ellie — 28.11.26",
  description: "Nick & Ellie's wedding hub",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  themeColor: "#faf6ef",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${serif.variable} ${script.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-cream text-ink font-serif">
        {children}
      </body>
    </html>
  );
}
