import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentContactTags, getCurrentProfile } from "@/lib/auth/roles";
import { IdeaForm } from "../IdeaForm";
import { getEffectivePermission } from "@/lib/permissions/actions";
import { PageHeader } from "@/components/PageHeader";
import { IdeaBoardWall, loadBoardIdeas } from "./IdeaBoardWall";

export default async function IdeaBoardPage() {
  // Blocks a PLAIN wedding_party member specifically — the (party) layout
  // admits couple/wedding_party/family broadly, so this page_access check
  // (page_access=false on "project:ideas" for plain wedding_party, per
  // 0028) is what actually enforces the narrower rule here.
  const profile = await getCurrentProfile();
  const permission = await getEffectivePermission("project:ideas", profile);
  if (!permission.pageAccess) redirect("/no-access");

  const supabase = await createClient();

  // Couple, family, best man and maid of honour can add to this board
  // (0038_moodboard_contributors.sql).
  const myTags = await getCurrentContactTags(profile);
  const canContribute =
    profile?.role === "couple" ||
    profile?.role === "family" ||
    myTags.includes("best_man") ||
    myTags.includes("maid_of_honour");

  const ideas = await loadBoardIdeas(supabase, null, profile?.id ?? null);

  return (
    <div>
      <Link
        href="/project"
        className="inline-flex min-h-11 items-center gap-1.5 font-serif text-xs tracking-wide text-ink-soft transition-colors hover:text-sec"
      >
        <ArrowLeft className="h-3 w-3" strokeWidth={2.5} aria-hidden="true" />
        Back to Project
      </Link>

      <PageHeader
        eyebrow="Planning"
        title="Idea Board"
        infoText="Every idea the wedding party has dropped in, grouped by tag — a private Pinterest, just for us."
      />

      {canContribute && (
        <section className="surface surface-raised max-w-xl p-5">
          <h2 className="font-title text-[20px] tracking-tight">Add to the board</h2>
          <p className="mt-1 font-reading text-[13px] text-ink-soft">
            Drop in a photo, a link idea or a note — it appears here straight away.
          </p>
          <IdeaForm />
        </section>
      )}

      <IdeaBoardWall canEditIdea={(i) => profile?.role === "couple" || (canContribute && i.createdBy === profile?.id)} ideas={ideas} canContribute={canContribute} canModerate={profile?.role === "couple"} revalidate="/project/ideas" />
    </div>
  );
}
