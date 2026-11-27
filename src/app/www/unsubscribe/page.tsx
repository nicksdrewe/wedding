import type { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkUnsubscribe } from "@/lib/platform/newsletter";
import { LegalPage } from "../_components/LegalPage";

export const metadata: Metadata = { title: "Stop the newsletter", robots: { index: false } };
export const dynamic = "force-dynamic";

async function unsubscribe(formData: FormData) {
  "use server";
  const e = String(formData.get("e") ?? "").toLowerCase();
  const s = String(formData.get("s") ?? "");
  if (e && checkUnsubscribe(e, s)) await createAdminClient().from("platform_unsubscribes").upsert({ email: e });
}

export default async function UnsubscribePage({ searchParams }: { searchParams: Promise<{ e?: string; s?: string }> }) {
  const { e = "", s = "" } = await searchParams;
  const valid = !!e && checkUnsubscribe(e.toLowerCase(), s);
  let done = false;
  if (valid) {
    const { data } = await createAdminClient().from("platform_unsubscribes").select("email").eq("email", e.toLowerCase()).maybeSingle();
    done = !!data;
  }
  return (
    <LegalPage
      kicker="Newsletter"
      title={done ? "You're unsubscribed" : "Stop the newsletter?"}
      intro={
        !valid
          ? "This link isn't complete. Use the link at the bottom of the newsletter itself, or email us and we'll take you off."
          : done
            ? `${e} won't get the newsletter again. Your wedding site carries on exactly as before.`
            : `We'll stop sending the newsletter to ${e}. Your wedding site, and its own emails, aren't affected.`
      }
    >
      {valid && !done && (
        <form action={unsubscribe}>
          <input type="hidden" name="e" value={e} />
          <input type="hidden" name="s" value={s} />
          <button type="submit" className="ww-btn ww-btn-primary">
            Unsubscribe
          </button>
        </form>
      )}
    </LegalPage>
  );
}
