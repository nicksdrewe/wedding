import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentContactTags, getCurrentProfile } from "@/lib/auth/roles";
import { getEffectivePermission } from "@/lib/permissions/actions";
import { OPTION_COSTS_EMBED, readOptionCosts } from "@/lib/options/costs";
import { loadFeedback } from "@/lib/feedback/load";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { OPTION_COVER_EMBED, coverImageOf } from "@/lib/options/cover";
import { IdeaPortal, portalThumbs } from "@/components/ui/IdeaPortal";
import { TaskBoard } from "../TaskBoard";
import { TASK_SELECT, toBoardTask } from "@/lib/tasks/priority";
import { OptionsCompareGroup, type CompareGroup } from "../OptionsCompareGroup";
import { ProjectBudget, type ChosenOption } from "../ProjectBudget";
import { GenderedOptionGroupForm } from "./GenderedOptionGroupForm";

// Near-duplicate of ../page.tsx (Project Management), scoped to
// visible_tag='groomsman' instead of tier='wedding_party' — see
// 0028_gendered_pages_and_family_access.sql. Ideas/tasks/standalone option
// groups all gained a nullable visible_tag column there; RLS grants access
// to a tagged row via fn_has_visible_tag, which also cross-grants best_man
// onto this page. Page-level visibility (this guard) and edit gating both
// come from page_permissions via getEffectivePermission, seeded for
// page_key 'project:groomsmen' in 0027.

export default async function GroomsmenProjectPage() {
  const supabase = await createClient();
  const profile = await getCurrentProfile();
  const isCouple = profile?.role === "couple";

  const permission = await getEffectivePermission("project:groomsmen", profile);
  if (!permission.pageAccess) redirect("/no-access");

  // This board is a managed project (0034_project_admins_and_budgets.sql):
  // the best man — and the couple — administer it; everyone else on it
  // contributes. RLS enforces the same split; isAdmin only decides which
  // controls are worth showing.
  const myTags = await getCurrentContactTags(profile);
  const isAdmin = isCouple || myTags.includes("best_man");

  const [{ data: ideas }, { data: tasks }, { data: contacts }, { data: optionGroups }] = await Promise.all([
    supabase
      .from("idea_boards")
      .select("id, title, body, tags, created_at, created_by, idea_board_images(id, image_url, sort_order)")
      .eq("visible_tag", "groomsman")
      .order("created_at", { ascending: false })
      .order("sort_order", { referencedTable: "idea_board_images", ascending: true }),
    supabase
      .from("tasks")
      .select(TASK_SELECT)
      .eq("visible_tag", "groomsman")
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
        `id, title, category_page_id, category_pages(title, slug), page_options(id, name, is_winner, ${OPTION_COVER_EMBED}, ${OPTION_COSTS_EMBED})`
      )
      .eq("visible_tag", "groomsman")
      .is("category_page_id", null)
      .order("created_at", { ascending: false })
      .order("created_at", { ascending: true, referencedTable: "page_options" }),
  ]);

  // Votes and comments for every idea, task and comparison option on this
  // board, in a handful of queries (not one per card). The database only
  // returns feedback the viewer may see.
  const optionIds = (optionGroups ?? []).flatMap((g) =>
    (Array.isArray(g.page_options) ? g.page_options : g.page_options ? [g.page_options] : []).map((o) => o.id)
  );
  const [taskFeedback, optionFeedback] = await Promise.all([
    loadFeedback(supabase, "task", (tasks ?? []).map((t) => t.id), profile?.id ?? null),
    loadFeedback(supabase, "page_option", optionIds, profile?.id ?? null),
  ]);
  const feedbackPath = "/project/groomsmen";

  const compareGroups: CompareGroup[] = (optionGroups ?? []).map((g) => {
    const category = Array.isArray(g.category_pages) ? g.category_pages[0] : g.category_pages;
    const rawOptions = Array.isArray(g.page_options) ? g.page_options : g.page_options ? [g.page_options] : [];
    const options = rawOptions.map((o) => ({
      id: o.id,
      name: o.name,
      is_winner: o.is_winner,
      feedback: optionFeedback[o.id],
      coverImageUrl: coverImageOf(o),
      ...readOptionCosts(o),
    }));
    return {
      id: g.id,
      title: g.title,
      categoryTitle: category?.title ?? null,
      categorySlug: category?.slug ?? null,
      options,
      showCosts: permission.costAccess,
      canPickWinner: isAdmin,
      canManageGroup: isAdmin,
      revalidate: feedbackPath,
      canModerateFeedback: isAdmin,
      canInteractFeedback: true,
    };
  });

  // Winners with a visible price feed the project budget below.
  const chosen: ChosenOption[] = compareGroups.flatMap((g) =>
    g.options
      .filter((o) => o.is_winner && !o.costs_hidden)
      .map((o) => ({
        id: o.id,
        name: o.name,
        comparison: g.title,
        predicted_cost_min: o.predicted_cost_min,
        predicted_cost_max: o.predicted_cost_max,
        actual_cost: o.actual_cost,
        currency: o.currency,
      }))
  );

  return (
    <div>
      <Link
        href="/project"
        className="inline-flex items-center gap-1.5 font-serif text-xs tracking-wide text-ink-soft transition hover:text-sec"
      >
        <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
        Project
      </Link>

      <PageHeader
        eyebrow="Planning"
        title="Groomsmen"
        infoText="Ideas, plans, and comparisons just for the groomsmen."
      />

      <div className="flex flex-col gap-8">
        <IdeaPortal
          href="/project/groomsmen/ideas"
          title="Groomsmen ideas"
          count={(ideas ?? []).length}
          thumbs={portalThumbs((ideas ?? []).map((i) => ({ images: i.idea_board_images ?? [] })))}
          blurb="Stag plans, outfits, anything the lads have found."
        />

        <TaskBoard
          tasks={(tasks ?? []).map(toBoardTask)}
          contacts={contacts ?? []} visibleTag="groomsman"
          canAdd={permission.editAccess}
          canDelete={isAdmin}
          feedback={taskFeedback}
          canModerate={isAdmin}
          revalidate={feedbackPath}
        />
      </div>

      <section className="mt-12">
        <div className="section-head"><h2 className="section-head__title">Compare options</h2><span className="section-head__rule" /></div>
        <p className="mt-2 font-reading text-sm text-ink-soft italic">
          Comparisons started here — stag do venue, outfits, and anything
          else just for the groomsmen.
        </p>
        {permission.editAccess && isAdmin && <GenderedOptionGroupForm visibleTag="groomsman" />}

        <div className="mt-5 flex flex-col gap-5">
          {compareGroups.map((g) => (
            <OptionsCompareGroup key={g.id} group={g} showCommsLink={isAdmin} />
          ))}
          {compareGroups.length === 0 && (
            <EmptyState
              className="mt-2"
              title="Nothing being compared yet"
              hint={permission.editAccess && isAdmin ? "Start a comparison above." : undefined}
            />
          )}
        </div>
      </section>

      {permission.costAccess && (
        <ProjectBudget visibleTag="groomsman" chosen={chosen} canManage={isAdmin} />
      )}
    </div>
  );
}
