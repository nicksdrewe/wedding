import Link from "next/link";
import { ArrowLeft, ImageOff } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { InView } from "@/components/motion-primitives/in-view";
import { toDriveImageUrl } from "@/lib/google/image-url";

const EASE = [0.22, 1, 0.36, 1] as [number, number, number, number];

// Ideas with no tags land here instead of being dropped — kept out of the
// visible tag list (filtered below) and rendered last, labelled "Untagged".
const UNTAGGED = "__untagged__";

type IdeaImage = { image_url: string; sort_order: number };

type BoardIdea = {
  id: string;
  title: string;
  body: string | null;
  tags: string[];
  images: IdeaImage[];
};

export default async function IdeaBoardPage() {
  const supabase = await createClient();

  // Same source query as /project (tier: "wedding_party", RLS-gated), just
  // extended with tags + the one-to-many idea_board_images child rows
  // (0010) needed to render this as an image board instead of a text list.
  const { data } = await supabase
    .from("idea_boards")
    .select("id, title, body, tags, created_at, idea_board_images(image_url, sort_order)")
    .eq("tier", "wedding_party")
    .order("created_at", { ascending: false })
    .order("sort_order", { ascending: true, referencedTable: "idea_board_images" });

  const ideas: BoardIdea[] = (data ?? []).map((row) => ({
    id: row.id,
    title: row.title,
    body: row.body,
    tags: (row.tags ?? []) as string[],
    images: (row.idea_board_images ?? []) as IdeaImage[],
  }));

  // Group by tag — an idea with several tags reasonably shows up in each
  // of those sections, since it belongs to all of them at once.
  const sections = new Map<string, BoardIdea[]>();
  for (const idea of ideas) {
    const tags = idea.tags.length > 0 ? idea.tags : [UNTAGGED];
    for (const tag of tags) {
      if (!sections.has(tag)) sections.set(tag, []);
      sections.get(tag)!.push(idea);
    }
  }

  const orderedTags = [...sections.keys()]
    .filter((t) => t !== UNTAGGED)
    .sort((a, b) => a.localeCompare(b));
  if (sections.has(UNTAGGED)) orderedTags.push(UNTAGGED);

  return (
    <div>
      <Link
        href="/project"
        className="inline-flex items-center gap-1.5 font-serif text-xs tracking-wide text-ink-soft transition-colors hover:text-accent"
      >
        <ArrowLeft className="h-3 w-3" strokeWidth={2.5} aria-hidden="true" />
        Back to Project
      </Link>

      <div className="mt-4">
        <PageHeader
          eyebrow="Planning"
          title="Idea Board"
          description="Every idea the wedding party has dropped in, grouped by tag — a private Pinterest, just for us."
        />
      </div>

      {orderedTags.length === 0 ? (
        <EmptyState
          className="mt-4"
          title="No ideas yet"
          hint="Add ideas from the Project page and they'll show up here."
        />
      ) : (
        orderedTags.map((tag, i) => (
          <TagSection key={tag} tag={tag} ideas={sections.get(tag)!} sectionIndex={i} />
        ))
      )}
    </div>
  );
}

function TagSection({
  tag,
  ideas,
  sectionIndex,
}: {
  tag: string;
  ideas: BoardIdea[];
  sectionIndex: number;
}) {
  const label = tag === UNTAGGED ? "Untagged" : tag;

  return (
    <section className={sectionIndex === 0 ? "mt-10" : "mt-14"}>
      <div className="flex items-center gap-3">
        <h2 className="font-serif text-[13px] font-semibold tracking-[0.16em] text-ink uppercase">
          {label}
        </h2>
        <div className="h-px flex-1 bg-ink/10" />
        <span className="font-reading text-xs text-ink-soft/60 italic">
          {ideas.length} {ideas.length === 1 ? "idea" : "ideas"}
        </span>
      </div>

      <div className="mt-5 columns-2 gap-4 sm:columns-3 lg:columns-4">
        {ideas.map((idea, i) => (
          <InView
            key={`${tag}-${idea.id}`}
            as="div"
            once
            viewOptions={{ margin: "-60px" }}
            variants={{ hidden: { opacity: 0, y: 22 }, visible: { opacity: 1, y: 0 } }}
            transition={{ duration: 0.5, delay: Math.min(i, 8) * 0.05, ease: EASE }}
            className="mb-4 break-inside-avoid"
          >
            <IdeaTile idea={idea} />
          </InView>
        ))}
      </div>
    </section>
  );
}

// Text-over-image pin: the idea's title (and the start of its body) sits in
// a bottom scrim over the cover image, Pinterest-style, rather than as a
// caption below it. An idea can hold several images (0010's
// idea_board_images), but only the first (by sort_order) is used as the
// pin here — a "+N" badge hints at the rest without turning one idea into
// several competing tiles in the grid.
function IdeaTile({ idea }: { idea: BoardIdea }) {
  const cover = idea.images[0];
  const extra = idea.images.length - 1;

  if (!cover) {
    return (
      <div className="flex aspect-[4/5] flex-col justify-between gap-6 rounded-[10px] border border-dashed border-ink/15 bg-white/50 p-5">
        <ImageOff className="h-5 w-5 text-ink-soft/40" strokeWidth={1.5} aria-hidden="true" />
        <div>
          <p className="font-serif text-sm font-semibold text-ink">{idea.title}</p>
          {idea.body && (
            <p className="mt-1.5 font-reading text-[12px] text-ink-soft line-clamp-4">
              {idea.body}
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="group relative overflow-hidden rounded-[10px] bg-cream-deep shadow-[0_10px_26px_rgba(35,37,32,0.14)] ring-1 ring-ink/5">
      {/* Arbitrary hosts (Drive-served images) — same reasoning as
          OptionCard/EngagementPageClient: next/image needs a per-domain
          remotePatterns allowlist, which doesn't fit "any URL pasted in". */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={toDriveImageUrl(cover.image_url)}
        alt={idea.title}
        className="block h-auto w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
      />
      {extra > 0 && (
        <span className="absolute top-2.5 right-2.5 rounded-full bg-ink/70 px-2 py-0.5 font-serif text-[10px] tracking-wide text-cream">
          +{extra}
        </span>
      )}
      {/* Literal rgba() gradient, not a theme-token utility — arbitrary
          gradient utilities don't reliably compile in this project. */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 px-4 pt-14 pb-4"
        style={{
          background:
            "linear-gradient(to top, rgba(35,37,32,0.92) 0%, rgba(35,37,32,0.6) 48%, rgba(35,37,32,0) 100%)",
        }}
      >
        <p className="font-serif text-[13px] font-semibold text-cream">{idea.title}</p>
        {idea.body && (
          <p className="mt-1 font-reading text-[11.5px] text-cream/85 line-clamp-2">
            {idea.body}
          </p>
        )}
      </div>
    </div>
  );
}
