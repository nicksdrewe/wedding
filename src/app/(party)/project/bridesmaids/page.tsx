import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/roles";
import { getEffectivePermission } from "@/lib/permissions/actions";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { IdeaCard } from "../IdeaCard";
import { TaskRow } from "../TaskRow";
import { OptionsCompareGroup, type CompareGroup } from "../OptionsCompareGroup";
import { GenderedIdeaForm } from "./GenderedIdeaForm";
import { GenderedTaskForm } from "./GenderedTaskForm";
import { GenderedOptionGroupForm } from "./GenderedOptionGroupForm";

// Near-duplicate of ../page.tsx (Project Management), scoped to
// visible_tag='bridesmaid' instead of tier='wedding_party' — see
// 0028_gendered_pages_and_family_access.sql. Ideas/tasks/standalone option
// groups all gained a nullable visible_tag column there; RLS grants access
// to a tagged row via fn_has_visible_tag, which also cross-grants
// maid_of_honour onto this page. Page-level visibility (this guard) and
// edit gating both come from page_permissions via getEffectivePermission,
// seeded for page_key 'project:bridesmaids' in 0027.

export default async function BridesmaidsProjectPage() {
  const supabase = await createClient();
  const profile = await getCurrentProfile();
  const isCouple = profile?.role === "couple";

  const permission = await getEffectivePermission("project:bridesmaids", profile);
  if (!permission.pageAccess) redirect("/no-access");

  const [{ data: ideas }, { data: tasks }, { data: contacts }, { data: optionGroups }] = await Promise.all([
    supabase
      .from("idea_boards")
      .select("id, title, body, tags, created_at, created_by, idea_board_images(id, image_url, sort_order)")
      .eq("visible_tag", "bridesmaid")
      .order("created_at", { ascending: false })
      .order("sort_order", { referencedTable: "idea_board_images", ascending: true }),
    supabase
      .from("tasks")
      .select("id, title, notes, status, due_date, owner_contact_id, contacts(full_name)")
      .eq("visible_tag", "bridesmaid")
      .order("status")
      .order("due_date", { ascending: true, nullsFirst: false }),
    supabase
      .from("contacts")
      .select("id, full_name")
      .in("role", ["couple", "wedding_party"])
      .order("full_name"),
    supabase
      .from("option_groups")
      .select(
        "id, title, category_page_id, category_pages(title, slug), page_options(id, name, predicted_cost_min, predicted_cost_max, actual_cost, currency, is_winner)"
      )
      .eq("visible_tag", "bridesmaid")
      .is("category_page_id", null)
      .order("created_at", { ascending: false })
      .order("created_at", { ascending: true, referencedTable: "page_options" }),
  ]);

  const compareGroups: CompareGroup[] = (optionGroups ?? []).map((g) => {
    const category = Array.isArray(g.category_pages) ? g.category_pages[0] : g.category_pages;
    const options = Array.isArray(g.page_options) ? g.page_options : g.page_options ? [g.page_options] : [];
    return {
      id: g.id,
      title: g.title,
      categoryTitle: category?.title ?? null,
      categorySlug: category?.slug ?? null,
      options,
    };
  });

  return (
    <div>
      <Link
        href="/project"
        className="inline-flex items-center gap-1.5 font-serif text-xs tracking-wide text-ink-soft transition hover:text-accent"
      >
        <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
        Project
      </Link>

      <PageHeader
        eyebrow="Planning"
        title="Bridesmaids"
        infoText="Ideas, plans, and comparisons just for the bridesmaids."
      />

      <div className="mt-9 grid grid-cols-1 gap-10 md:grid-cols-2">
        <section>
          <h2 className="font-serif text-[15px] font-semibold tracking-wide">Idea board</h2>
          {permission.editAccess && <GenderedIdeaForm visibleTag="bridesmaid" />}
          <ul className="mt-4 flex flex-col gap-2.5">
            {(ideas ?? []).map((idea) => (
              <IdeaCard
                key={idea.id}
                id={idea.id}
                title={idea.title}
                body={idea.body}
                tags={idea.tags ?? []}
                images={idea.idea_board_images ?? []}
                canEdit={permission.editAccess && (isCouple || idea.created_by === profile?.id)}
              />
            ))}
          </ul>
          {(!ideas || ideas.length === 0) && (
            <EmptyState
              className="mt-4"
              title="No ideas yet"
              hint={permission.editAccess ? "Add the first one above." : undefined}
            />
          )}
        </section>

        <section>
          <h2 className="font-serif text-[15px] font-semibold tracking-wide">Tasks</h2>
          {permission.editAccess && <GenderedTaskForm visibleTag="bridesmaid" contacts={contacts ?? []} />}
          <ul className="mt-4 flex flex-col gap-2">
            {(tasks ?? []).map((t) => {
              const owner = Array.isArray(t.contacts) ? t.contacts[0] : t.contacts;
              return (
                <TaskRow
                  key={t.id}
                  id={t.id}
                  title={t.title}
                  done={t.status === "done"}
                  dueDate={t.due_date}
                  ownerContactId={t.owner_contact_id}
                  ownerName={owner?.full_name ?? null}
                  contacts={contacts ?? []}
                />
              );
            })}
          </ul>
          {(!tasks || tasks.length === 0) && (
            <EmptyState className="mt-4" title="No tasks yet" />
          )}
        </section>
      </div>

      <section className="mt-12">
        <h2 className="font-serif text-[15px] font-semibold tracking-wide">Compare options</h2>
        <p className="mt-2 font-reading text-sm text-ink-soft italic">
          Comparisons started here — hen do venue, outfits, and anything
          else just for the bridesmaids.
        </p>
        {permission.editAccess && <GenderedOptionGroupForm visibleTag="bridesmaid" />}

        <div className="mt-5 flex flex-col gap-5">
          {compareGroups.map((g) => (
            <OptionsCompareGroup key={g.id} group={g} />
          ))}
          {compareGroups.length === 0 && (
            <EmptyState
              className="mt-2"
              title="Nothing being compared yet"
              hint={permission.editAccess ? "Start a comparison above." : undefined}
            />
          )}
        </div>
      </section>
    </div>
  );
}
