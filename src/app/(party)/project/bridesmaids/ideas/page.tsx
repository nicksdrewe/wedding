import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentContactTags, getCurrentProfile } from "@/lib/auth/roles";
import { getEffectivePermission } from "@/lib/permissions/actions";
import { PageHeader } from "@/components/PageHeader";
import { IdeaBoardWall, loadBoardIdeas } from "../../ideas/IdeaBoardWall";
import { GenderedIdeaForm } from "../GenderedIdeaForm";

// The bridesmaids board's own idea wall (the main board's lives at
// /project/ideas). Same access rule as the bridesmaids page itself: page and
// edit access come from "project:bridesmaids"; the database only returns this
// board's ideas.
export default async function BridesmaidsIdeasPage() {
  const profile = await getCurrentProfile();
  const permission = await getEffectivePermission("project:bridesmaids", profile);
  if (!permission.pageAccess) redirect("/no-access");

  const supabase = await createClient();
  const myTags = await getCurrentContactTags(profile);
  const isAdmin = profile?.role === "couple" || myTags.includes("maid_of_honour");
  const ideas = await loadBoardIdeas(supabase, "bridesmaid", profile?.id ?? null);

  return (
    <div>
      <Link
        href="/project/bridesmaids"
        className="inline-flex min-h-11 items-center gap-1.5 font-serif text-xs tracking-wide text-ink-soft transition-colors hover:text-sec"
      >
        <ArrowLeft className="h-3 w-3" strokeWidth={2.5} aria-hidden="true" />
        Back to Bridesmaids
      </Link>

      <PageHeader eyebrow="Planning" title="Bridesmaids ideas" infoText="Every idea dropped in for the bridesmaids, grouped by tag." />

      {permission.editAccess && (
        <section className="surface surface-raised max-w-xl p-5">
          <h2 className="font-title text-[20px] tracking-tight">Add to the board</h2>
          <GenderedIdeaForm visibleTag="bridesmaid" />
        </section>
      )}

      <IdeaBoardWall canEditIdea={(i) => permission.editAccess && (isAdmin || i.createdBy === profile?.id)} ideas={ideas} canContribute={permission.editAccess} canModerate={isAdmin} canHide={isAdmin && profile?.role !== "couple"} revalidate="/project/bridesmaids/ideas" />
    </div>
  );
}
