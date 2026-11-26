import type { Metadata } from "next";
import { siteBase } from "@/lib/commercial/base";
import { SiteFooter, SiteHeader } from "../_components/Chrome";
import { StartForm } from "./StartForm";

export const metadata: Metadata = {
  title: "Start your wedding site",
  description: "Choose your address, add your names, and your private wedding site is ready in a minute.",
  alternates: { canonical: "/start" },
};

export const dynamic = "force-dynamic";

export default async function StartPage() {
  const base = await siteBase();
  return (
    <>
      <SiteHeader base={base} minimal />
      <main className="ww-start">
        <div className="ww-wrap">
          <p className="ww-kicker">Start</p>
          <h1 className="ww-h2">Let&rsquo;s make your wedding site.</h1>
          <p className="ww-sub">It takes about a minute. You can change the names, date and colours later.</p>
          <StartForm />
        </div>
      </main>
      <SiteFooter base={base} />
    </>
  );
}
