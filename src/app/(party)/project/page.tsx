import { createClient } from "@/lib/supabase/server";
import { OptionGroupPanel } from "@/components/options/OptionGroupPanel";
import { IdeaForm } from "./IdeaForm";
import { TaskForm } from "./TaskForm";
import { TaskRow } from "./TaskRow";
import { NewOptionGroupForm } from "./NewOptionGroupForm";
import { ProjectTabs } from "./ProjectTabs";

export default async function ProjectPage() {
  const supabase = await createClient();

  const [{ data: ideas }, { data: tasks }, { data: contacts }, { data: optionGroups }] = await Promise.all([
    supabase
      .from("idea_boards")
      .select("id, title, body, created_at")
      .eq("tier", "wedding_party")
      .order("created_at", { ascending: false }),
    supabase
      .from("tasks")
      .select("id, title, notes, status, due_date, contacts(full_name)")
      .order("status")
      .order("due_date", { ascending: true, nullsFirst: false }),
    supabase
      .from("contacts")
      .select("id, full_name")
      .in("role", ["couple", "wedding_party"])
      .order("full_name"),
    supabase
      .from("option_groups")
      .select("id, title")
      .is("category_page_id", null)
      .order("created_at", { ascending: false }),
  ]);

  return (
    <div>
      <h1 className="font-display text-[34px] tracking-tight">Project Management</h1>
      <p className="mt-2 font-reading text-[15px] text-ink-soft">
        Ideas, plans, and who&rsquo;s doing what — plus expense splitting.
      </p>

      <ProjectTabs active="project" />

      <div className="mt-9 grid grid-cols-1 gap-10 md:grid-cols-2">
        <section>
          <h2 className="font-serif text-[15px] font-semibold tracking-wide">Idea board</h2>
          <IdeaForm />
          <ul className="mt-4 flex flex-col gap-2.5">
            {(ideas ?? []).map((idea) => (
              <li
                key={idea.id}
                className="rounded-[10px] border border-ink/10 bg-white p-4"
              >
                <p className="font-serif text-sm font-semibold">{idea.title}</p>
                {idea.body && (
                  <p className="mt-1.5 font-reading text-[13px] text-ink-soft">{idea.body}</p>
                )}
              </li>
            ))}
            {(!ideas || ideas.length === 0) && (
              <p className="font-reading text-sm text-ink-soft">
                No ideas yet — add the first one.
              </p>
            )}
          </ul>
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
                  ownerName={owner?.full_name ?? null}
                />
              );
            })}
            {(!tasks || tasks.length === 0) && (
              <p className="font-reading text-sm text-ink-soft">No tasks yet.</p>
            )}
          </ul>
        </section>
      </div>

      <section className="mt-12">
        <h2 className="font-serif text-[15px] font-semibold tracking-wide">Compare options</h2>
        <p className="mt-2 font-reading text-sm text-ink-soft italic">
          For stag/hen venues, activities — anything worth comparing before
          deciding.
        </p>
        <NewOptionGroupForm />

        <div className="mt-5 flex flex-col gap-7">
          {(optionGroups ?? []).map((g) => (
            <div key={g.id}>
              <h3 className="font-serif text-sm font-semibold">{g.title}</h3>
              <OptionGroupPanel groupId={g.id} categoryPageId={null} revalidate="/project" />
            </div>
          ))}
          {(!optionGroups || optionGroups.length === 0) && (
            <p className="font-reading text-sm text-ink-soft">
              Nothing being compared yet — start a comparison above.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
