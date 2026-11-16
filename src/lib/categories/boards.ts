// The stag and hen boards run the same planning system as the main wedding
// (categories nested inside categories, options, costs, votes), kept private to
// their board (0047_board_categories.sql). Pure and client-safe.

export type BoardKey = "groomsman" | "bridesmaid";

export type BoardConfig = {
  key: BoardKey;
  label: string; // "Groomsmen"
  // The board's own page, and where its plans live under it.
  pagePath: string;
  plansPath: string;
  // The access rules page for the board, which its categories inherit.
  pageKey: string;
  // The tag that makes someone the board's admin (as well as the couple).
  adminTag: string;
  noun: string; // "stag" / "hen", for copy
};

export const BOARDS: Record<BoardKey, BoardConfig> = {
  groomsman: {
    key: "groomsman",
    label: "Groomsmen",
    pagePath: "/project/groomsmen",
    plansPath: "/project/groomsmen/plans",
    pageKey: "project:groomsmen",
    adminTag: "best_man",
    noun: "stag",
  },
  bridesmaid: {
    key: "bridesmaid",
    label: "Bridesmaids",
    pagePath: "/project/bridesmaids",
    plansPath: "/project/bridesmaids/plans",
    pageKey: "project:bridesmaids",
    adminTag: "maid_of_honour",
    noun: "hen",
  },
};

export function parseBoard(raw: unknown): BoardKey | null {
  return raw === "groomsman" || raw === "bridesmaid" ? raw : null;
}

// Where a category's page lives, given which board (if any) it is on.
export function categoryHref(board: BoardKey | null, slug?: string): string {
  const base = board ? BOARDS[board].plansPath : "/categories";
  return slug ? `${base}/${slug}` : base;
}
