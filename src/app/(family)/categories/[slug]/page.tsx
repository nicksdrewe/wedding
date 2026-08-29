import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/roles";
import { OptionsBoard } from "@/components/options/OptionsBoard";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { CostForm } from "./CostForm";
import { ContactForm } from "./ContactForm";
import { DateForm } from "./DateForm";
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
              <li
                key={c.id}
                className="rounded-[8px] border border-ink/8 bg-cream/50 px-3 py-2 font-reading text-[13px] text-ink"
              >
                <span className="font-serif font-semibold">{c.name}</span>
                {c.role ? ` — ${c.role}` : ""}
                {c.phone ? ` · ${c.phone}` : ""}
                {c.email ? ` · ${c.email}` : ""}
              </li>
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
              <li
                key={d.id}
                className="rounded-[8px] border border-ink/8 bg-cream/50 px-3 py-2 font-reading text-[13px] text-ink"
              >
                {d.entry_date} — {d.title}
              </li>
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
