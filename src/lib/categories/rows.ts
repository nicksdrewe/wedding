import type { BoardKey } from "./boards";
import { parseBoard } from "./boards";

// Every category's id / slug / parent / board and the small per-category
// settings that arrived in later migrations, read with whatever client the
// caller has, in ONE query when everything exists. Columns that a migration
// hasn't added yet are dropped one group at a time (newest first) so nothing
// breaks in the gap before it is run.

type Result = PromiseLike<{ data: unknown; error: unknown }>;
type Query = Result & { eq: (col: string, v: string) => Result };
type Client = { from: (table: string) => { select: (cols: string) => Query } };

export type CategoryRow = {
  id: string;
  slug: string;
  parent_id: string | null;
  board_tag: BoardKey | null;
  option_kind: string | null;
  latitude: number | null;
  longitude: number | null;
  feedback_enabled: boolean;
  hidden_from_couple: boolean;
};

// In the order the migrations added them.
const OPTIONAL_GROUPS = ["option_kind", "board_tag", "latitude, longitude", "feedback_enabled", "hidden_from_couple"];

// weddingId: required when client is the admin client (it ignores row security).
// (client is typed loosely on purpose: matching it against the full Supabase
// client type is too deep for TypeScript.)
export async function fetchCategoryRows(anyClient: unknown, weddingId?: string | null): Promise<CategoryRow[]> {
  const client = anyClient as Client;
  for (let n = OPTIONAL_GROUPS.length; n >= 0; n--) {
    const cols = ["id", "slug", "parent_id", ...OPTIONAL_GROUPS.slice(0, n)].join(", ");
    const q = client.from("category_pages").select(cols);
    const res = await (weddingId ? q.eq("wedding_id", weddingId) : q);
    if (res.error) continue;
    return ((res.data ?? []) as unknown as Record<string, unknown>[]).map((r) => ({
      id: r.id as string,
      slug: r.slug as string,
      parent_id: (r.parent_id as string | null) ?? null,
      board_tag: parseBoard((r.board_tag as string | null | undefined) ?? null),
      option_kind: (r.option_kind as string | null | undefined) ?? null,
      latitude: (r.latitude as number | null | undefined) ?? null,
      longitude: (r.longitude as number | null | undefined) ?? null,
      feedback_enabled: (r.feedback_enabled as boolean | undefined) !== false,
      hidden_from_couple: (r.hidden_from_couple as boolean | undefined) === true,
    }));
  }
  return [];
}
