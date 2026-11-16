import { createClient } from "@/lib/supabase/server";
import { getCurrentContactTags, getCurrentProfile } from "@/lib/auth/roles";
import { PageHeader } from "@/components/PageHeader";
import { loadBigDayItems, loadBigDaySettings, loadBigDaySources } from "@/lib/big-day/load";
import { BigDayBoard } from "./BigDayBoard";

export default async function BigDayPage() {
  const profile = await getCurrentProfile();
  const tags = await getCurrentContactTags(profile);
  const canEdit =
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
