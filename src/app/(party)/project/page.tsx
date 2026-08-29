import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { OptionGroupPanel } from "@/components/options/OptionGroupPanel";
import { IdeaForm } from "./IdeaForm";
import { TaskForm } from "./TaskForm";
import { TaskRow } from "./TaskRow";
import { NewOptionGroupForm } from "./NewOptionGroupForm";

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
      <h1 className="font-script text-4xl">Project Management</h1>
      <p className="mt-2 font-serif text-ink-soft">
        Ideas, plans, and who&rsquo;s doing what — plus{" "}
        <Link href="/project/expenses" className="underline">
          expense splitting
        </Link>
        .
      </p>

      <div className="mt-10 grid grid-cols-1 gap-10 md:grid-cols-2">
        <section>
          <h2 className="font-serif text-lg font-semibold">Idea board</h2>
          <IdeaForm />
          <ul className="mt-4 flex flex-col gap-3">
            {(ideas ?? []).map((idea) => (
              <li
                key={idea.id}
                className="rounded-2xl border border-ink/10 bg-cream-deep/50 p-4"
              >
                <p className="font-serif font-semibold">{idea.title}</p>
                {idea.body && (
                  <p className="mt-1 font-serif text-sm text-ink-soft">{idea.body}</p>
                )}
              </li>
            ))}
            {(!ideas || ideas.length === 0) && (
              <p className="font-serif text-sm text-ink-soft">
                No ideas yet — add the first one.
              </p>
            )}
          </ul>
        </section>

        <section>
          <h2 className="font-serif text-lg font-semibold">Tasks</h2>
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
              <p className="font-serif text-sm text-ink-soft">No tasks yet.</p>
            )}
          </ul>
        </section>
      </div>

      <section className="mt-10">
        <h2 className="font-serif text-lg font-semibold">
          Compare options
        </h2>
        <p className="mt-1 font-serif text-sm text-ink-soft">
          For stag/hen venues, activities — anything worth comparing before
          deciding.
        </p>
        <NewOptionGroupForm />

        <div className="mt-4 flex flex-col gap-6">
          {(optionGroups ?? []).map((g) => (
            <div key={g.id} className="rounded-2xl border border-ink/10 p-4">
              <h3 className="font-serif font-semibold">{g.title}</h3>
              <OptionGroupPanel groupId={g.id} categoryPageId={null} revalidate="/project" />
            </div>
          ))}
          {(!optionGroups || optionGroups.length === 0) && (
            <p className="font-serif text-sm text-ink-soft">
              Nothing being compared yet — start a comparison above.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
