import { createClient } from "@/lib/supabase/server";
import { AddOptionForm } from "./AddOptionForm";
import { OptionsGrid } from "./OptionsGrid";
import { OPTION_COSTS_EMBED, readOptionCosts } from "@/lib/options/costs";

export async function OptionGroupPanel({
  groupId,
  categoryPageId,
  revalidate,
}: {
  groupId: string;
  categoryPageId: string | null;
  revalidate: string;
}) {
  const supabase = await createClient();
  const { data: options } = await supabase
    .from("page_options")
    .select(
      `id, name, option_date, contact_name, contact_phone, contact_email, is_winner, ${OPTION_COSTS_EMBED}`
    )
    .eq("option_group_id", groupId)
    .order("created_at");

  return (
    <div className="mt-3">
      <OptionsGrid
        groupId={groupId}
        categoryPageId={categoryPageId}
        revalidate={revalidate}
        options={(options ?? []).map((o) => ({
          id: o.id,
          name: o.name,
          option_date: o.option_date,
          contact_name: o.contact_name,
          contact_phone: o.contact_phone,
          contact_email: o.contact_email,
          is_winner: o.is_winner,
          ...readOptionCosts(o),
        }))}
      />
      <AddOptionForm groupId={groupId} revalidate={revalidate} />
    </div>
  );
}
