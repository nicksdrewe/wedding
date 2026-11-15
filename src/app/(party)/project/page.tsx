import { redirect } from "next/navigation";
import Link from "next/link";
import { Images } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentContactTags, getCurrentProfile } from "@/lib/auth/roles";
import { getEffectivePermission } from "@/lib/permissions/actions";
import { OPTION_COSTS_EMBED, readOptionCosts } from "@/lib/options/costs";
import { loadFeedback } from "@/lib/feedback/load";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { IdeaForm } from "./IdeaForm";
import { IdeaCard } from "./IdeaCard";
import { TaskForm } from "./TaskForm";
import { TaskRow } from "./TaskRow";
import { NewOptionGroupForm } from "./NewOptionGroupForm";
import { ProjectTabs } from "./ProjectTabs";
import { OptionsCompareGroup, type CompareGroup } from "./OptionsCompareGroup";

export default async function ProjectPage() {
  const supabase = await createClient();
  const profile = await getCurrentProfile();
  // The (party) layout now admits couple, wedding_party, AND family — this
  // page_access check is what actually blocks a PLAIN wedding_party member
  // (page_access=false on "project" per 0028's seeded permissions) while
  // still letting best_man/maid_of_honour and family through.
  const permission = await getEffectivePermission("project", profile);
  if (!permission.pageAccess) redirect("/no-access");
  const isCouple = profile?.role === "couple";
  // IdeaForm/TaskForm/NewOptionGroupForm are creation forms — family gets
  // read-only boards here (edit_access=false on "project" for family, per
  // 0028), so their visibility follows edit_access rather than "anyone who
  // reached this page can post".
  const canEdit = permission.editAccess;

  const [{ data: ideas }, { data: tasks }, { data: contacts }, { data: optionGroups }] = await Promise.all([
    supabase
      .from("idea_boards")
      .select("id, title, body, tags, created_at, created_by, idea_board_images(id, image_url, sort_order)")
      .eq("tier", "wedding_party")
      // Stag/hen ideas and tasks live on their own boards — without these
      // filters they also appeared here for anyone able to see them.
      .is("visible_tag", null)
      .order("created_at", { ascending: false })
      .order("sort_order", { referencedTable: "idea_board_images", ascending: true }),
    supabase
      .from("tasks")
      .select("id, title, notes, status, due_date, owner_contact_id, contacts(full_name)")
      .is("visible_tag", null)
      .order("status")
      .order("due_date", { ascending: true, nullsFirst: false }),
    supabase
      .from("contacts")
      .select("id, full_name")
      .in("role", ["couple", "wedding_party"])
      .order("full_name"),
    // Every comparison running anywhere — category-linked (Venue, Flowers...)
    // and standalone (stag/hen...) alike — skimmed to title + cost here.
    // Full detail (description, images) lives on the category board; this
    // is the fast pick-a-winner surface across all of them at once.
    supabase
      .from("option_groups")
      .select(
        `id, title, category_page_id, visible_tag, category_pages(title, slug), page_options(id, name, is_winner, ${OPTION_COSTS_EMBED})`
      )
      .order("created_at", { ascending: false })
      .order("created_at", { ascending: true, referencedTable: "page_options" }),
  ]);

  // A standalone comparison's prices follow the board it belongs to: the
  // groomsmen/bridesmaids board for a tagged group, otherwise this page.
  // (Category-linked groups add options on their own category page.)
  const [groomsmenPermission, bridesmaidsPermission] = await Promise.all([
    getEffectivePermission("project:groomsmen", profile),
    getEffectivePermission("project:bridesmaids", profile),
  ]);
  // Who runs a comparison shown here: a stag/hen one belongs to that
  // project's admin (0034); an untagged standalone one to whoever can edit
  // this page; a category one's winner is the couple's alone.
  const myTags = await getCurrentContactTags(profile);
  const isAdminForTag = (visibleTag: string | null) =>
    isCouple ||
    (visibleTag === "groomsman" && myTags.includes("best_man")) ||
    (visibleTag === "bridesmaid" && myTags.includes("maid_of_honour"));
  const canManageStandalone = (visibleTag: string | null) => (visibleTag ? isAdminForTag(visibleTag) : canEdit);

  const costAccessForTag = (visibleTag: string | null) =>
    visibleTag === "groomsman"
      ? groomsmenPermission.costAccess
      : visibleTag === "bridesmaid"
        ? bridesmaidsPermission.costAccess
        : permission.costAccess;

  // Votes and comments for everything shown on this page, in a handful of
  // queries. The database only returns feedback the viewer may see.
  const optionIds = (optionGroups ?? []).flatMap((g) =>
    (Array.isArray(g.page_options) ? g.page_options : g.page_options ? [g.page_options] : []).map((o) => o.id)
  );
  const [ideaFeedback, taskFeedback, optionFeedback] = await Promise.all([
    loadFeedback(supabase, "idea", (ideas ?? []).map((i) => i.id), profile?.id ?? null),
    loadFeedback(supabase, "task", (tasks ?? []).map((t) => t.id), profile?.id ?? null),
    loadFeedback(supabase, "page_option", optionIds, profile?.id ?? null),
  ]);
  const feedbackPath = "/project";

  const compareGroups: CompareGroup[] = (optionGroups ?? []).map((g) => {
    const category = Array.isArray(g.category_pages) ? g.category_pages[0] : g.category_pages;
    const rawOptions = Array.isArray(g.page_options) ? g.page_options : g.page_options ? [g.page_options] : [];
    const options = rawOptions.map((o) => ({
      id: o.id,
      name: o.name,
      is_winner: o.is_winner,
      feedback: optionFeedback[o.id],
      ...readOptionCosts(o),
    }));
    return {
      id: g.id,
      title: g.title,
      categoryTitle: category?.title ?? null,
      categorySlug: category?.slug ?? null,
      options,
      showCosts: costAccessForTag(g.visible_tag ?? null),
      canPickWinner: category ? isCouple : canManageStandalone(g.visible_tag ?? null),
      canManageGroup: !category && canManageStandalone(g.visible_tag ?? null),
      revalidate: feedbackPath,
      // The couple anywhere; a stag/hen comparison's admin on their own (the
      // database enforces the same rule).
      canModerateFeedback: isCouple || (!!g.visible_tag && isAdminForTag(g.visible_tag)),
      canInteractFeedback: true,
    };
  });

  return (
    <div>
      <PageHeader
        eyebrow="Planning"
        title="Project Management"
        infoText="Ideas, plans, and who's doing what — plus expense splitting."
      />

      <ProjectTabs active="project" />

      <div className="mt-9 grid grid-cols-1 gap-10 md:grid-cols-2">
        <section>
          <Link
            href="/project/ideas"
            className="group inline-flex items-center gap-1.5 font-serif text-[15px] font-semibold tracking-wide transition-colors hover:text-accent"
          >
            Idea board
            <Images className="h-3.5 w-3.5 text-ink-soft/50 transition-colors group-hover:text-accent" strokeWidth={2} aria-hidden="true" />
          </Link>
          {canEdit && <IdeaForm />}
          <ul className="mt-4 flex flex-col gap-2.5">
            {(ideas ?? []).map((idea) => (
              <IdeaCard
                key={idea.id}
                id={idea.id}
                title={idea.title}
                body={idea.body}
                tags={idea.tags ?? []}
                images={idea.idea_board_images ?? []}
                canEdit={isCouple || idea.created_by === profile?.id}
                feedback={ideaFeedback[idea.id]}
                canModerate={isCouple}
                revalidate={feedbackPath}
              />
            ))}
          </ul>
          {(!ideas || ideas.length === 0) && (
            <EmptyState
              className="mt-4"
              title="No ideas yet"
              hint="Add the first one above."
            />
          )}
        </section>

        <section>
          <h2 className="font-serif text-[15px] font-semibold tracking-wide">Tasks</h2>
          {canEdit && <TaskForm contacts={contacts ?? []} />}
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
                  feedback={taskFeedback[t.id]}
                  canModerate={isCouple}
                  revalidate={feedbackPath}
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
          Every comparison running, across every category plus stag/hen
          extras — skimmed to title and cost so you can pick fast.
        </p>
        {canEdit && <NewOptionGroupForm />}

        <div className="mt-5 flex flex-col gap-5">
          {compareGroups.map((g) => (
            <OptionsCompareGroup key={g.id} group={g} />
          ))}
          {compareGroups.length === 0 && (
            <EmptyState
              className="mt-2"
              title="Nothing being compared yet"
              hint="Start a comparison above, or from a category page."
            />
          )}
        </div>
      </section>
    </div>
  );
}
