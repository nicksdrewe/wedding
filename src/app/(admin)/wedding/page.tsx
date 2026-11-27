import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/roles";
import { getCurrentWedding } from "@/lib/wedding/current";
import { PageHeader } from "@/components/PageHeader";
import { SettingsTabs } from "@/components/SettingsTabs";
import { DeleteWedding } from "./DeleteWedding";
import { DriveSettings, type DriveStatus } from "./DriveSettings";
import { Suspense } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import { WeddingSettings } from "./WeddingSettings";
import type { WeddingTheme } from "@/lib/wedding/theme";

export default async function WeddingSettingsPage() {
  const profile = await getCurrentProfile();
  if (profile?.role !== "couple") redirect("/no-access");
  const wedding = await getCurrentWedding();
  if (!wedding) redirect("/no-access");

  // Where photos go: this wedding's own Drive, the original connection (first
  // wedding only), or nowhere yet.
  const { data: secrets } = await createAdminClient(wedding.id).from("wedding_secrets").select("*").eq("wedding_id", wedding.id).maybeSingle();
  const s = (secrets ?? {}) as { drive_folder_id?: string | null; drive_folder_name?: string | null; drive_account?: string | null; drive_connected_at?: string | null };
  const originalSlug = process.env.LEGACY_WEDDING_SLUG || "nickellie";
  const drive: DriveStatus = s.drive_folder_id
    ? { kind: "connected", account: s.drive_account ?? null, folderName: s.drive_folder_name ?? null, folderId: s.drive_folder_id, connectedAt: s.drive_connected_at ?? null }
    : wedding.slug === originalSlug && process.env.GOOGLE_OAUTH_REFRESH_TOKEN
      ? { kind: "original" }
      : { kind: "none" };

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
      <Suspense fallback={null}>
        <DriveSettings status={drive} />
      </Suspense>
      <DeleteWedding slug={wedding.slug} displayName={wedding.display_name} />
    </div>
  );
}
