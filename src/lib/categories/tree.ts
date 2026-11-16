// Nested categories: the tree and the money roll-up. Pure and client-safe.
//
// Nothing about a category's cost is typed in. It is worked out:
//   * A category's OWN figure comes from its options. Before a winner is
//     chosen it is a range: cheapest option -> dearest option. Once a winner
//     is chosen it is that option's real figures.
//   * A category's TOTAL is its own figure plus the totals of every category
//     nested inside it (siblings add up: Food = breakfast + lunch + dinner).
// Everything is in GBP by the time it gets here (the loader converts), so
// figures can be added across currencies.

export type Range = { min: number; max: number; actual: number | null };

export type OptionFigure = {
  id: string;
  name: string;
  isWinner: boolean;
  // Total for the option (base + extra cost lines - income), in GBP. Null
  // where nothing has been entered. costsHidden = the viewer may not see it.
  min: number | null;
  max: number | null;
  actual: number | null;
  costsHidden: boolean;
};

export type CategoryInput = {
  id: string;
  slug: string;
  title: string;
  parentId: string | null;
  sortOrder: number;
  // Whether this viewer may see prices here at all.
  costAccess: boolean;
  options: OptionFigure[];
  // A figure typed in before costs became automatic. Only used while the
  // category has no priced options of its own, so nothing already entered
  // disappears.
  legacy: Range | null;
};

export type CategoryNode = CategoryInput & {
  children: CategoryNode[];
  depth: number;
  // This category's own options only.
  own: Range | null;
  // Own + everything beneath.
  total: Range | null;
  winners: string[];
  // Some prices beneath (or here) are hidden from this viewer, so `total`
  // may understate.
  partial: boolean;
  // Counting this category and everything beneath: how many have options to
  // decide between, and how many of those have a winner.
  decisions: number;
  decided: number;
};

function add(a: Range | null, b: Range | null): Range | null {
  if (!a) return b;
  if (!b) return a;
  return {
    min: a.min + b.min,
    max: a.max + b.max,
    actual: a.actual == null && b.actual == null ? null : (a.actual ?? 0) + (b.actual ?? 0),
  };
}

export function ownRange(options: OptionFigure[], legacy: Range | null): Range | null {
  const priced = options
    .filter((o) => !o.costsHidden)
    .map((o) => {
      const lo = o.min ?? o.max ?? o.actual;
      const hi = o.max ?? o.min ?? o.actual;
      return lo == null || hi == null ? null : { o, lo, hi };
    })
    .filter((x): x is { o: OptionFigure; lo: number; hi: number } => x !== null);

  const winners = priced.filter((p) => p.o.isWinner);
  if (winners.length > 0) {
    const actuals = winners.filter((w) => w.o.actual != null);
    return {
      min: winners.reduce((s, w) => s + w.lo, 0),
      max: winners.reduce((s, w) => s + w.hi, 0),
      actual: actuals.length ? actuals.reduce((s, w) => s + (w.o.actual ?? 0), 0) : null,
    };
  }
  if (priced.length > 0) {
    return {
      min: Math.min(...priced.map((p) => p.lo)),
      max: Math.max(...priced.map((p) => p.hi)),
      actual: null,
    };
  }
  return legacy;
}

export function buildCategoryTree(inputs: CategoryInput[]): CategoryNode[] {
  const byId = new Map<string, CategoryNode>();
  for (const c of inputs) {
    byId.set(c.id, {
      ...c,
      children: [],
      depth: 0,
      own: null,
      total: null,
      winners: [],
      partial: false,
      decisions: 0,
      decided: 0,
    });
  }
  const roots: CategoryNode[] = [];
  for (const node of byId.values()) {
    // A parent the viewer can't see (or a broken link) leaves the child at
    // the top rather than hiding it.
    const parent = node.parentId ? byId.get(node.parentId) : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }
  const order = (a: CategoryNode, b: CategoryNode) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title);

  const visit = (node: CategoryNode, depth: number, seen: Set<string>) => {
    node.depth = depth;
    node.children.sort(order);
    if (seen.has(node.id)) {
      node.children = [];
      return;
    }
    seen.add(node.id);
    for (const child of node.children) visit(child, depth + 1, seen);

    node.winners = node.options.filter((o) => o.isWinner).map((o) => o.name);
    const hiddenHere = !node.costAccess || node.options.some((o) => o.costsHidden);
    node.own = node.costAccess ? ownRange(node.options, node.legacy) : null;
    node.total = node.children.reduce<Range | null>((sum, c) => add(sum, c.total), node.own);
    node.partial = hiddenHere || node.children.some((c) => c.partial);
    const hasDecision = node.options.length > 0;
    node.decisions = (hasDecision ? 1 : 0) + node.children.reduce((s, c) => s + c.decisions, 0);
    node.decided = (hasDecision && node.winners.length > 0 ? 1 : 0) + node.children.reduce((s, c) => s + c.decided, 0);
  };
  roots.sort(order);
  const seen = new Set<string>();
  for (const root of roots) visit(root, 0, seen);
  return roots;
}

export function flattenTree(roots: CategoryNode[]): CategoryNode[] {
  const out: CategoryNode[] = [];
  const walk = (n: CategoryNode) => {
    out.push(n);
    n.children.forEach(walk);
  };
  roots.forEach(walk);
  return out;
}

export function findNode(roots: CategoryNode[], id: string): CategoryNode | null {
  return flattenTree(roots).find((n) => n.id === id) ?? null;
}

// Root-first list of a category's ancestors (not including itself).
export function ancestorsOf(roots: CategoryNode[], id: string): CategoryNode[] {
  const all = flattenTree(roots);
  const byId = new Map(all.map((n) => [n.id, n]));
  const chain: CategoryNode[] = [];
  let cursor = byId.get(id)?.parentId ?? null;
  while (cursor && byId.has(cursor) && chain.length < 12) {
    const node = byId.get(cursor)!;
    chain.unshift(node);
    cursor = node.parentId;
  }
  return chain;
}

// Ids of a category and everything beneath it (the places it can't be moved to).
export function subtreeIds(node: CategoryNode): string[] {
  return flattenTree([node]).map((n) => n.id);
}
