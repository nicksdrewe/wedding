import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Check } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/roles";
import { getEffectivePermission } from "@/lib/permissions/actions";
import { OptionsBoard } from "@/components/options/OptionsBoard";
import { OptionsMapLoader } from "@/components/options/OptionsMapLoader";
import type { MapOption } from "@/components/options/OptionsMap";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { formatCostRange, formatCurrency } from "@/lib/currency/format";
import { loadCategoryTree } from "@/lib/categories/load";
import { ancestorsOf, findNode } from "@/lib/categories/tree";
import { moveTargetsFor, toCardData } from "@/lib/categories/card";
import { CategoryCard } from "../CategoryCard";
import { NewCategoryForm } from "../NewCategoryForm";
import { getLinkedCostItemsForCategory } from "@/lib/costs/links";
import { OPTION_COSTS_EMBED, readOptionCosts } from "@/lib/options/costs";
import { LinkedCostItems } from "./LinkedCostItems";
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

  const permission = await getEffectivePermission(`categories:${page.slug}`, profile);
  if (!permission.pageAccess) redirect("/no-access");

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
            `id, name, latitude, longitude, page_option_images(image_url, sort_order), ${OPTION_COSTS_EMBED}`
          )
          .eq("option_group_id", optionGroup.id)
          .order("sort_order", { referencedTable: "page_option_images", ascending: true })
      ).data ?? []
      ).map((o) => {
        const costs = readOptionCosts(o);
        return {
        id: o.id,
        name: o.name,
        predicted_cost_min: costs.predicted_cost_min,
        predicted_cost_max: costs.predicted_cost_max,
        currency: costs.currency,
        costs_hidden: costs.costs_hidden,
        latitude: o.latitude,
        longitude: o.longitude,
        coverImageUrl: o.page_option_images?.[0]?.image_url ?? null,
        };
      })
    : [];
  const hasPinnedOptions = mapOptions.some((o) => o.latitude != null && o.longitude != null);

  const [{ data: contacts }, { data: dates }, linkedCostItems, { roots }] = await Promise.all([
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
    getLinkedCostItemsForCategory(page.id),
    // The whole tree, with costs rolled up — this page shows its own slice.
    loadCategoryTree(profile),
  ]);
  const node = findNode(roots, page.id);
  const trail = ancestorsOf(roots, page.id);
  const children = node?.children ?? [];
  // Options are decided at the lowest level. A category that only groups
  // others doesn't offer its own board unless it already has options.
  const showOptions = children.length === 0 || (node?.options.length ?? 0) > 0;

  // Edit UI on this page is now driven by the resolved edit_access for
  // this exact category page (couple always true; family true/false per
  // 0028's seeded permissions — currently false everywhere on categories)
  // rather than a hardcoded role check, reusing the same permission
  // lookup already made above for the pageAccess guard.
  const isCouple = permission.editAccess;
  // Since 0033 "Can edit" is real for best man / maid of honour (and anyone
  // else the couple ticks it for): they add and edit options, photos,
  // contacts and dates. Deleting those, choosing the winner, and starting or
  // removing the board itself stay with the couple — RLS enforces the same
  // split, these flags just keep the buttons honest.
  const isRealCouple = profile?.role === "couple";
  // Prices are their own permission (0031_cost_access.sql): someone can see
  // this category's options, dates and contacts with every cost left out.
  // RLS already withholds the numbers; this just keeps the empty sections
  // from rendering. Whoever can both see the prices and edit the category may
  // set its headline cost (matches category_costs' write policies).
  const canSeeCosts = permission.costAccess;

  return (
    <div className="mx-auto max-w-3xl">
      <nav aria-label="Where this sits" className="mb-1 flex flex-wrap items-center gap-x-1.5 font-serif text-xs text-ink-soft">
        <Link href="/categories" className="inline-flex min-h-11 items-center hover:text-sec">
          Categories
        </Link>
        {trail.map((a) => (
          <span key={a.id} className="inline-flex items-center gap-1.5">
            <span aria-hidden="true">/</span>
            <Link href={`/categories/${a.slug}`} className="inline-flex min-h-11 items-center hover:text-sec">
              {a.title}
            </Link>
          </span>
        ))}
      </nav>

      <PageHeader eyebrow={trail.length > 0 ? trail[trail.length - 1].title : "Planning"} title={page.title} />

      {node && children.length === 0 && node.winners.length > 0 && permission.dataAccess && (
        <div className="route" data-lit="true" aria-label={`Chosen: ${node.winners.join(", ")}`}>
          <span className="route__node">{page.title}</span>
          <span className="route__line" aria-hidden="true" />
          <span className="route__node route__node--chosen">
            <Check className="h-4 w-4" strokeWidth={3} aria-hidden="true" />
            {node.winners.join(" + ")}
          </span>
        </div>
      )}

      {canSeeCosts && node?.total && (
        <section className="surface surface-tint mb-6 p-6">
          <p className="stat__label">{node.winners.length > 0 && children.length === 0 ? "Cost" : "Predicted cost"}</p>
          <p className="stat__value">{formatCostRange(node.total.min, node.total.max, "GBP")}</p>
          {node.total.actual != null && (
            <p className="mt-1.5 font-serif text-[13px] font-semibold text-accent">
              {formatCurrency(node.total.actual, "GBP")} actual so far
            </p>
          )}
          <p className="mt-2 font-reading text-[13px] text-ink-soft">
            {children.length > 0
              ? "Added up from everything inside this category."
              : node.winners.length > 0
                ? `From the chosen option: ${node.winners.join(", ")}.`
                : node.options.length > 0
                  ? "From the cheapest option to the dearest. It narrows once a winner is chosen."
                  : "Entered before costs became automatic. Add options to replace it."}
            {node.partial && " Some prices are hidden from your account, so this may be incomplete."}
          </p>
        </section>
      )}

      {(children.length > 0 || isRealCouple) && (
        <section className="mb-6">
          <div className="section-head">
            <h2 className="section-head__title">Inside {page.title}</h2>
            <span className="section-head__rule" />
          </div>
          {children.length > 0 ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {children.map((c) => (
                <CategoryCard key={c.id} category={toCardData(c)} isCouple={isRealCouple} moveTargets={isRealCouple ? moveTargetsFor(roots, c) : []} />
              ))}
            </div>
          ) : (
            <p className="font-reading text-[13px] text-ink-soft">
              Nothing inside yet. Split this category into parts (for Catering: Food, Drink) and each part gets its own options.
            </p>
          )}
          {isRealCouple && <NewCategoryForm parentId={page.id} label={`New category inside ${page.title}`} />}
        </section>
      )}

      {showOptions && (
      <section className="surface p-6">
        <div className="flex items-center justify-between gap-4">
          <h2 className="font-serif text-[15px] font-semibold">Options</h2>
          {isRealCouple && !optionGroup && (
            <StartOptionsModeButton
              categoryPageId={page.id}
              title={page.title}
              revalidate={`/categories/${page.slug}`}
            />
          )}
        </div>
        {optionGroup && !permission.dataAccess ? (
          <p className="mt-1.5 font-reading text-[13px] text-ink-soft">
            Itemized options aren&rsquo;t shown for your account.
          </p>
        ) : optionGroup ? (
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
                categoryPageId={page.id}
                revalidate={`/categories/${page.slug}`}
                isCouple={isCouple}
                isRealCouple={isRealCouple}
                costAccess={canSeeCosts}
                showCommsLink
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
      )}


      {canSeeCosts && linkedCostItems.length > 0 && (
        <section className="surface mt-6 p-6">
          <h2 className="font-serif text-[15px] font-semibold">Linked costs</h2>
          <p className="mt-1.5 font-reading text-[13px] text-ink-soft">
            Cost items logged under another category, also shown here.
          </p>
          <LinkedCostItems items={linkedCostItems} isCouple={isRealCouple} />
        </section>
      )}

      <section className="surface mt-6 p-6">
        <h2 className="font-serif text-[15px] font-semibold">Key contacts</h2>
        {contacts && contacts.length > 0 ? (
          <ul className="mt-3 flex flex-col gap-2">
            {contacts.map((c) => (
              <ContactRow key={c.id} contact={c} categoryPageId={page.id} isCouple={isCouple} canDelete={isRealCouple} />
            ))}
          </ul>
        ) : (
          <EmptyState className="mt-3" title="No contacts yet" />
        )}
        {isCouple && <ContactForm categoryPageId={page.id} />}
      </section>

      <section className="surface mt-6 p-6">
        <h2 className="font-serif text-[15px] font-semibold">Key dates</h2>
        {dates && dates.length > 0 ? (
          <ul className="mt-3 flex flex-col gap-2">
            {dates.map((d) => (
              <DateRow key={d.id} entry={d} categoryPageId={page.id} isCouple={isCouple} canDelete={isRealCouple} />
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
