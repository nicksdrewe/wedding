import Link from "next/link";
import { Images } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/roles";
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
  const isCouple = profile?.role === "couple";

  const [{ data: ideas }, { data: tasks }, { data: contacts }, { data: optionGroups }] = await Promise.all([
    supabase
      .from("idea_boards")
      .select("id, title, body, tags, created_at, created_by, idea_board_images(id, image_url, sort_order)")
      .eq("tier", "wedding_party")
      .order("created_at", { ascending: false })
      .order("sort_order", { referencedTable: "idea_board_images", ascending: true }),
    supabase
      .from("tasks")
      .select("id, title, notes, status, due_date, owner_contact_id, contacts(full_name)")
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
        "id, title, category_page_id, category_pages(title, slug), page_options(id, name, predicted_cost_min, predicted_cost_max, actual_cost, currency, is_winner)"
      )
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
      <PageHeader
        eyebrow="Planning"
        title="Project Management"
        description="Ideas, plans, and who's doing what — plus expense splitting."
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
          <IdeaForm />
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
          <TaskForm contacts={contacts ?? []} />
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
          Every comparison running, across every category plus stag/hen
          extras — skimmed to title and cost so you can pick fast.
        </p>
        <NewOptionGroupForm />

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
