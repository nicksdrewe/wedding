import type { BoardKey } from "./boards";
import { parseBoard } from "./boards";

// Every category's id / slug / parent / board, read with whatever client the
// caller has. The board column (0047) is read in its own query so that
// nothing breaks in the gap before that migration has been run: without it
// every category is simply on the main wedding.

type Rows = PromiseLike<{ data: unknown; error: unknown }>;
type Client = {
  from: (table: string) => { select: (cols: string) => Rows };
};

export type CategoryRow = { id: string; slug: string; parent_id: string | null; board_tag: BoardKey | null };

export async function fetchCategoryRows(client: Client): Promise<CategoryRow[]> {
  const base = (await client.from("category_pages").select("id, slug, parent_id")).data as
    | { id: string; slug: string; parent_id: string | null }[]
    | null;
  const boards = await client.from("category_pages").select("id, board_tag");
  const boardById = new Map<string, BoardKey | null>();
  if (!boards.error) {
    for (const r of (boards.data ?? []) as { id: string; board_tag: string | null }[]) boardById.set(r.id, parseBoard(r.board_tag));
  }
  return (base ?? []).map((r) => ({ ...r, board_tag: boardById.get(r.id) ?? null }));
}
