import type { Metadata } from "next";
import "./www.css";
import { SITE_NAME, SITE_URL } from "@/lib/commercial/pricing";

// The commercial site: weddingsweddings.co.uk itself (see middleware). Its own
// name, description and sharing card, instead of a wedding's.
const description =
  "A private wedding website with your names on it: guest list, RSVPs, planning boards, budget, messages and the day itself, in one place. One price, paid once.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: `${SITE_NAME}: your whole wedding, one website`, template: `%s · ${SITE_NAME}` },
  description,
  applicationName: SITE_NAME,
  manifest: null,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    url: SITE_URL,
    title: `${SITE_NAME}: your whole wedding, one website`,
    description,
    locale: "en_GB",
  },
  twitter: { card: "summary_large_image", title: SITE_NAME, description },
  robots: { index: true, follow: true },
  icons: { icon: "/icon.svg", apple: "/apple-icon.png" },
};

export default function CommercialLayout({ children }: { children: React.ReactNode }) {
  return <div className="ww-site">{children}</div>;
}
