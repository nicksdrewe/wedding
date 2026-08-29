import { createClient } from "@/lib/supabase/server";
import { AddOptionForm } from "./AddOptionForm";
import { OptionsGrid } from "./OptionsGrid";

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
    .select("id, name, predicted_cost, actual_cost, option_date, contact_name, contact_phone, contact_email, is_winner")
    .eq("option_group_id", groupId)
    .order("created_at");

  return (
    <div className="mt-3">
      <OptionsGrid
        groupId={groupId}
        categoryPageId={categoryPageId}
        revalidate={revalidate}
        options={options ?? []}
      />
      <AddOptionForm groupId={groupId} revalidate={revalidate} />
    </div>
  );
}
