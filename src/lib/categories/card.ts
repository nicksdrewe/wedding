import { flattenTree, subtreeIds, type CategoryNode } from "./tree";

// Tree node -> the plain data a CategoryCard takes (client component), plus
// the list of places the couple could move it to.

export function toCardData(node: CategoryNode) {
  return {
    id: node.id,
    slug: node.slug,
    title: node.title,
    parentId: node.parentId,
    optionKind: node.optionKind ?? null,
    showCost: node.costAccess,
    total: node.total,
    partial: node.partial,
    childCount: node.children.length,
    optionCount: node.options.length,
    winners: node.winners,
    decisions: node.decisions,
    decided: node.decided,
  };
}

// Every category except this one and what's inside it, labelled with its
// depth so the select reads as a tree.
export function moveTargetsFor(roots: CategoryNode[], node: CategoryNode) {
  const blocked = new Set(subtreeIds(node));
  return flattenTree(roots)
    .filter((n) => !blocked.has(n.id))
    .map((n) => ({ id: n.id, label: `${"— ".repeat(n.depth)}${n.title}` }));
}
