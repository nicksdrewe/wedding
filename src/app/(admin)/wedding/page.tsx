import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/roles";
import { getCurrentWedding } from "@/lib/wedding/current";
import { PageHeader } from "@/components/PageHeader";
import { SettingsTabs } from "@/components/SettingsTabs";
import { WeddingSettings } from "./WeddingSettings";
import type { WeddingTheme } from "@/lib/wedding/theme";

export default async function WeddingSettingsPage() {
  const profile = await getCurrentProfile();
  if (profile?.role !== "couple") redirect("/no-access");
  const wedding = await getCurrentWedding();
  if (!wedding) redirect("/no-access");

  return (
    <div>
      <SettingsTabs className="mb-4" />
      <PageHeader
        eyebrow="Settings"
        title="Your wedding"
        infoText="Your names and date as they appear across the site, its colours, and the code guests use to open the front page."
      />
      <WeddingSettings
        slug={wedding.slug}
        partnerOne={wedding.partner_one}
        partnerTwo={wedding.partner_two}
        dateLabel={wedding.date_label ?? ""}
        weddingDate={wedding.wedding_date ?? ""}
        theme={(wedding.theme ?? {}) as WeddingTheme}
      />
    </div>
  );
}
