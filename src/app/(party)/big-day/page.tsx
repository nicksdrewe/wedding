import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getCurrentContactTags, getCurrentProfile } from "@/lib/auth/roles";
import { getEffectivePermission } from "@/lib/permissions/actions";
import { PageHeader } from "@/components/PageHeader";
import { loadBigDayItems, loadBigDaySettings, loadBigDaySources } from "@/lib/big-day/load";
import { BigDayBoard } from "./BigDayBoard";

export default async function BigDayPage() {
  const profile = await getCurrentProfile();
  const [tags, permission] = await Promise.all([getCurrentContactTags(profile), getEffectivePermission("big-day", profile)]);
  // Roles & Access can grant or remove it (0053); the built-in groups still apply.
  if (!permission.pageAccess) redirect("/no-access");
  const canEdit =
    permission.editAccess ||
    profile?.role === "couple" ||
    profile?.role === "family" ||
    tags.includes("best_man") ||
    tags.includes("maid_of_honour");
  const isCouple = profile?.role === "couple";

  const supabase = await createClient();
  const [settings, items, sources] = await Promise.all([
    loadBigDaySettings(supabase),
    loadBigDayItems(supabase),
    canEdit ? loadBigDaySources(supabase) : Promise.resolve({ chosen: [], ideas: [] }),
  ]);

  return (
    <div>
      <PageHeader
        eyebrow="Us"
        title="The Big Day"
        infoText="The schedule for the whole celebration, day by day. Drag things in, or use the Add buttons."
      />
      <BigDayBoard
        settings={settings}
        items={items}
        chosen={sources.chosen}
        ideas={sources.ideas}
        canEdit={canEdit}
        isCouple={isCouple}
      />
    </div>
  );
}
