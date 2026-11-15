import type { createClient } from "@/lib/supabase/server";
import { EMPTY_FEEDBACK, type FeedbackData, type FeedbackTargetType } from "./types";

type Supabase = Awaited<ReturnType<typeof createClient>>;

// Loads votes and comments for a whole page's worth of items in two queries
// (not one per card). What comes back is already limited to what the viewer
// may see — the database withholds feedback on items they can't see — so
// nothing here filters by visibility. If the tables aren't there yet (the
// migration hasn't been run) or a query fails, every item simply shows no
// feedback and the page still renders.
export async function loadFeedback(
  supabase: Supabase,
  targetType: FeedbackTargetType,
  ids: string[],
  myProfileId: string | null
): Promise<Record<string, FeedbackData>> {
  const out: Record<string, FeedbackData> = {};
  const unique = [...new Set(ids)];
  for (const id of unique) out[id] = { ...EMPTY_FEEDBACK, upNames: [], downNames: [], comments: [] };
  if (unique.length === 0) return out;

  const [reactions, comments] = await Promise.all([
    supabase.from("reactions").select("target_id, profile_id, author_name, value").eq("target_type", targetType).in("target_id", unique),
    supabase
      .from("comments")
      .select("id, target_id, profile_id, author_name, body, created_at, edited_at")
      .eq("target_type", targetType)
      .in("target_id", unique)
      .order("created_at", { ascending: true }),
  ]);

  for (const r of reactions.data ?? []) {
    const slot = out[r.target_id];
    if (!slot) continue;
    const name = r.author_name ?? "Someone";
    if (r.value === 1) {
      slot.up += 1;
      slot.upNames.push(name);
    } else if (r.value === -1) {
      slot.down += 1;
      slot.downNames.push(name);
    }
    if (myProfileId && r.profile_id === myProfileId) slot.myVote = r.value === 1 ? 1 : -1;
  }

  for (const c of comments.data ?? []) {
    out[c.target_id]?.comments.push({
      id: c.id,
      authorName: c.author_name ?? "Someone",
      body: c.body,
      createdAt: c.created_at,
      editedAt: c.edited_at,
      mine: !!myProfileId && c.profile_id === myProfileId,
    });
  }

  return out;
}
