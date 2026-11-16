import Link from "next/link";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentContactTags, getCurrentProfile } from "@/lib/auth/roles";
import { PageHeader } from "@/components/PageHeader";
import { loadCommTargets, loadOrgComms } from "@/lib/org-comms/loaders";
import { CommsBoard } from "./CommsBoard";
import { EntryForm } from "./EntryForm";

const uuid = z.string().uuid();

function one(v: string | string[] | undefined) {
  const s = Array.isArray(v) ? v[0] : v;
  return s && uuid.safeParse(s).success ? s : null;
}

export default async function OrganisingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/no-access");
  const tags = await getCurrentContactTags(profile);
  const allowed =
    profile.role === "couple" ||
    profile.role === "family" ||
    tags.includes("best_man") ||
    tags.includes("maid_of_honour");
  if (!allowed) redirect("/no-access");

  const params = await searchParams;
  const optionId = one(params.option);
  const categoryId = one(params.category);
  const entryId = one(params.entry);

  const supabase = await createClient();
  const { categories, options } = await loadCommTargets(supabase);

  const categoryIds = categoryId
    ? [categoryId, ...categories.filter((c) => c.parent_id === categoryId).map((c) => c.id)]
    : null;
  const entries = await loadOrgComms(supabase, { optionId, categoryIds, ensureId: entryId, categories, options });

  let filterName: string | null = null;
  if (optionId) filterName = options.find((o) => o.id === optionId)?.name ?? "this option";
  else if (categoryId) filterName = categories.find((c) => c.id === categoryId)?.title ?? "this category";

  return (
    <div>
      <PageHeader
        eyebrow="Comms"
        title="Organising comms"
        infoText="A log of the emails and updates behind the planning, so nothing gets lost."
      />

      <section className="surface surface-raised max-w-3xl p-5">
        <h2 className="font-title text-[20px] tracking-tight">Add an entry</h2>
        <p className="mt-1 mb-4 font-reading text-[13px] text-ink-soft">
          Paste in an email you received or sent, or jot down what was agreed.
        </p>
        <EntryForm categories={categories} options={options} defaults={{ optionId, categoryId }} />
      </section>

      {filterName && (
        <div className="surface surface-glass mt-6 flex flex-wrap items-center justify-between gap-3 px-4 py-2">
          <p className="font-reading text-[14px]">
            Showing entries about <strong>{filterName}</strong>
          </p>
          <Link href="/organising" className="btn btn-quiet btn-sm min-h-11">
            Show all
          </Link>
        </div>
      )}

      <CommsBoard
        key={`${optionId ?? ""}-${categoryId ?? ""}`}
        entries={entries}
        categories={categories}
        options={options}
        currentUserId={profile.id}
        isCouple={profile.role === "couple"}
        highlightId={entryId}
      />
    </div>
  );
}
