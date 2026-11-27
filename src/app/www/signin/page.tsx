import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { siteBase } from "@/lib/commercial/base";
import { ROOT_DOMAIN, isValidSlug, weddingUrl } from "@/lib/wedding/host";
import { tidySlug } from "@/lib/commercial/slug";
import { SiteFooter, SiteHeader } from "../_components/Chrome";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Go to your wedding site to sign in.",
  robots: { index: false },
};

export const dynamic = "force-dynamic";

// Each wedding signs in at its own address. This just takes you there.
async function go(formData: FormData) {
  "use server";
  const slug = tidySlug(String(formData.get("slug") ?? ""));
  if (!isValidSlug(slug)) redirect(`${await siteBase()}/signin?bad=1`);
  const host = (await headers()).get("host")?.split(":")[0].replace(/^www\./, "") ?? "";
  redirect(host === ROOT_DOMAIN ? weddingUrl(slug, "/login") : `/login?wedding=${slug}`);
}

export default async function FindWedding({ searchParams }: { searchParams: Promise<{ bad?: string }> }) {
  const base = await siteBase();
  const { bad } = await searchParams;
  return (
    <>
      <SiteHeader base={base} minimal />
      <main className="ww-start">
        <div className="ww-wrap ww-narrow">
          <p className="ww-kicker">Sign in</p>
          <h1 className="ww-h2">Which wedding?</h1>
          <p className="ww-sub">Every wedding signs in at its own address. Type yours and we&rsquo;ll take you there.</p>
          <form action={go} className="ww-fieldset" style={{ marginTop: 28 }}>
            <label className="ww-label">
              Wedding address
              <span className="ww-address">
                <input name="slug" placeholder="jonsarah" autoCapitalize="none" spellCheck={false} maxLength={40} required />
                <span>.{ROOT_DOMAIN}</span>
              </span>
            </label>
            {bad && <p className="ww-note bad">That doesn&rsquo;t look like a wedding address. It&rsquo;s the part before .{ROOT_DOMAIN}.</p>}
            <button type="submit" className="ww-btn ww-btn-primary" style={{ justifySelf: "start" }}>
              Go to sign in
            </button>
          </form>
        </div>
      </main>
      <SiteFooter base={base} />
    </>
  );
}
