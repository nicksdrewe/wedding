import { createClient } from "@/lib/supabase/server";
import { loadFeedback } from "@/lib/feedback/load";
import type { FeedbackData } from "@/lib/feedback/types";
import { flattenTree, type CategoryNode } from "./tree";

// Votes and comments on the categories themselves (0049), for a whole tree in
// two queries. Empty (not an error) before the migration is run.
export async function loadCategoryFeedback(
  roots: CategoryNode[],
  myProfileId: string | null
): Promise<Record<string, FeedbackData>> {
  const supabase = await createClient();
  return loadFeedback(supabase, "category", flattenTree(roots).map((n) => n.id), myProfileId);
}
