import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/roles";
import { OptionGroupPanel } from "@/components/options/OptionGroupPanel";
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
      <h1 className="font-display text-4xl">{page.title}</h1>

      <section className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="font-serif text-lg font-semibold">Options</h2>
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
            <p className="mt-1 font-serif text-sm text-ink-soft">
              Compare alternatives below — selecting one updates the cost,
              key dates, and contacts for this category.
            </p>
            <OptionGroupPanel
              groupId={optionGroup.id}
              categoryPageId={page.id}
              revalidate={`/categories/${page.slug}`}
            />
          </>
        ) : (
          <p className="mt-1 font-serif text-sm text-ink-soft">
            Not comparing options right now — the fields below are the live
            values for this category.
          </p>
        )}
      </section>

      <section className="mt-8">
        <h2 className="font-serif text-lg font-semibold">Costs</h2>
        {isCouple ? (
          <CostForm
            categoryPageId={page.id}
            predictedCost={cost?.predicted_cost ?? ""}
            actualCost={cost?.actual_cost ?? ""}
          />
        ) : (
          <p className="mt-2 font-serif text-ink-soft">
            Predicted: £{cost?.predicted_cost ?? "—"} · Actual: £
            {cost?.actual_cost ?? "—"}
          </p>
        )}
      </section>

      <section className="mt-8">
        <h2 className="font-serif text-lg font-semibold">Key contacts</h2>
        <ul className="mt-2 flex flex-col gap-2">
          {(contacts ?? []).map((c) => (
            <li key={c.id} className="font-serif text-sm">
              <span className="font-semibold">{c.name}</span>
              {c.role ? ` — ${c.role}` : ""}
              {c.phone ? ` · ${c.phone}` : ""}
              {c.email ? ` · ${c.email}` : ""}
            </li>
          ))}
          {(!contacts || contacts.length === 0) && (
            <p className="font-serif text-sm text-ink-soft">No contacts yet.</p>
          )}
        </ul>
        {isCouple && <ContactForm categoryPageId={page.id} />}
      </section>

      <section className="mt-8">
        <h2 className="font-serif text-lg font-semibold">Key dates</h2>
        <ul className="mt-2 flex flex-col gap-2">
          {(dates ?? []).map((d) => (
            <li key={d.id} className="font-serif text-sm">
              {d.entry_date} — {d.title}
            </li>
          ))}
          {(!dates || dates.length === 0) && (
            <p className="font-serif text-sm text-ink-soft">No dates logged yet.</p>
          )}
        </ul>
        {isCouple && <DateForm categoryPageId={page.id} />}
      </section>
    </div>
  );
}
