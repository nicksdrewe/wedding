import { createClient } from "@/lib/supabase/server";
import { loadFeedback } from "@/lib/feedback/load";
import type { FeedbackData } from "@/lib/feedback/types";
import { flattenTree, type CategoryNode } from "./tree";

// Votes and comments on every option in a tree (and on the categories that
// invite them, 0049/0051), keyed by id, in four queries. Empty (not an error)
// before the migrations are run.
export async function loadCategoryFeedback(
  roots: CategoryNode[],
  myProfileId: string | null
): Promise<Record<string, FeedbackData>> {
  const supabase = await createClient();
  const nodes = flattenTree(roots);
  const [cats, opts] = await Promise.all([
    loadFeedback(supabase, "category", nodes.map((n) => n.id), myProfileId),
    loadFeedback(supabase, "page_option", nodes.flatMap((n) => n.options.map((o) => o.id)), myProfileId),
  ]);
  return { ...cats, ...opts };
}
