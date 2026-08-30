import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/roles";
import { OptionsBoard } from "@/components/options/OptionsBoard";
import { OptionsMapLoader } from "@/components/options/OptionsMapLoader";
import type { MapOption } from "@/components/options/OptionsMap";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { CostForm } from "./CostForm";
import { ContactForm } from "./ContactForm";
import { ContactRow } from "./ContactRow";
import { DateForm } from "./DateForm";
import { DateRow } from "./DateRow";
import { StartOptionsModeButton } from "./StartOptionsModeButton";

export default async function CategoryDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const profile = await getCurrentProfile();
  const supabase = await createClient();

  const { data: page } = await supabase
    .from("category_pages")
    .select("id, slug, title")
    .eq("slug", slug)
    .maybeSingle();

  if (!page) notFound();

  const { data: optionGroup } = await supabase
    .from("option_groups")
    .select("id")
    .eq("category_page_id", page.id)
    .maybeSingle();

  // Pin-map data: only the fields OptionsMap needs, for whichever options on
  // this board have coordinates set. Deliberately a lighter-weight query
  // than OptionsBoard's own fetch (no description/web_link/contact fields)
  // since this only ever feeds map markers, not the board itself.
  const mapOptions: MapOption[] = optionGroup
    ? ((
        await supabase
          .from("page_options")
          .select(
            "id, name, predicted_cost, latitude, longitude, page_option_images(image_url, sort_order)"
          )
          .eq("option_group_id", optionGroup.id)
          .order("sort_order", { referencedTable: "page_option_images", ascending: true })
      ).data ?? []
      ).map((o) => ({
        id: o.id,
        name: o.name,
        predicted_cost: o.predicted_cost,
        latitude: o.latitude,
        longitude: o.longitude,
        coverImageUrl: o.page_option_images?.[0]?.image_url ?? null,
      }))
    : [];
  const hasPinnedOptions = mapOptions.some((o) => o.latitude != null && o.longitude != null);

  const [{ data: cost }, { data: contacts }, { data: dates }] = await Promise.all([
    supabase
      .from("category_costs")
      .select("predicted_cost, actual_cost")
      .eq("category_page_id", page.id)
      .maybeSingle(),
    supabase
      .from("category_contacts")
      .select("id, name, role, phone, email")
      .eq("category_page_id", page.id)
      .order("name"),
    supabase
      .from("diary_entries")
      .select("id, title, entry_date")
      .eq("category_page_id", page.id)
      .order("entry_date"),
  ]);

  const isCouple = profile?.role === "couple";

  return (
    <div className="max-w-3xl">
      <PageHeader eyebrow="Planning" title={page.title} />

      <section className="rounded-[10px] border border-ink/10 bg-white p-6">
        <div className="flex items-center justify-between gap-4">
          <h2 className="font-serif text-[15px] font-semibold">Options</h2>
          {isCouple && !optionGroup && (
            <StartOptionsModeButton
              categoryPageId={page.id}
              title={page.title}
              revalidate={`/categories/${page.slug}`}
            />
          )}
        </div>
        {optionGroup ? (
          <>
            <p className="mt-1.5 font-reading text-[13px] text-ink-soft">
              Every option on one board — open a card to see its full
              detail and mark it as the winner once you&rsquo;ve decided.
            </p>
            {hasPinnedOptions && (
              <div className="mt-4">
                <p className="mb-2 font-serif text-[11px] font-medium tracking-[0.08em] text-ink-soft/70 uppercase">
                  On the map
                </p>
                <OptionsMapLoader options={mapOptions} />
              </div>
            )}
            <div className="mt-4">
              <OptionsBoard
                groupId={optionGroup.id}
                revalidate={`/categories/${page.slug}`}
                isCouple={isCouple}
              />
            </div>
          </>
        ) : (
          <p className="mt-1.5 font-reading text-[13px] text-ink-soft">
            Not comparing options right now — the fields below are the live
            values for this category.
          </p>
        )}
      </section>

      <section className="mt-6 rounded-[10px] border border-ink/10 bg-white p-6">
        <h2 className="font-serif text-[15px] font-semibold">Costs</h2>
        {isCouple ? (
          <div className="mt-2">
            <CostForm
              categoryPageId={page.id}
              predictedCost={cost?.predicted_cost ?? ""}
              actualCost={cost?.actual_cost ?? ""}
            />
          </div>
        ) : (
          <p className="mt-2 font-reading text-[15px] text-ink-soft">
            Predicted £{cost?.predicted_cost ?? "—"} · Actual £
            {cost?.actual_cost ?? "—"}
          </p>
        )}
      </section>

      <section className="mt-6 rounded-[10px] border border-ink/10 bg-white p-6">
        <h2 className="font-serif text-[15px] font-semibold">Key contacts</h2>
        {contacts && contacts.length > 0 ? (
          <ul className="mt-3 flex flex-col gap-2">
            {contacts.map((c) => (
              <ContactRow key={c.id} contact={c} categoryPageId={page.id} isCouple={isCouple} />
            ))}
          </ul>
        ) : (
          <EmptyState className="mt-3" title="No contacts yet" />
        )}
        {isCouple && <ContactForm categoryPageId={page.id} />}
      </section>

      <section className="mt-6 rounded-[10px] border border-ink/10 bg-white p-6">
        <h2 className="font-serif text-[15px] font-semibold">Key dates</h2>
        {dates && dates.length > 0 ? (
          <ul className="mt-3 flex flex-col gap-2">
            {dates.map((d) => (
              <DateRow key={d.id} entry={d} categoryPageId={page.id} isCouple={isCouple} />
            ))}
          </ul>
        ) : (
          <EmptyState className="mt-3" title="No dates logged yet" />
        )}
        {isCouple && <DateForm categoryPageId={page.id} />}
      </section>
    </div>
  );
}
