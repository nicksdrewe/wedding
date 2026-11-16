import { EmptyState } from "@/components/EmptyState";
import { moveTargetsFor, toCardData } from "@/lib/categories/card";
import type { CategoryNode } from "@/lib/categories/tree";
import type { BoardKey } from "@/lib/categories/boards";
import type { FeedbackData } from "@/lib/feedback/types";
import { NewCategoryForm } from "./NewCategoryForm";
import { CategoryCard } from "./CategoryCard";

// The family tree of categories (and the grid of ones standing alone), shared
// by the main Categories page and each stag/hen board's own plans page. Its
// connectors light up where decisions have been made (the skill-tree route).
export function CategoriesView({
  roots,
  canManage,
  basePath,
  board = null,
  emptyHint,
  feedback,
  interact,
}: {
  roots: CategoryNode[];
  // May create, rename, move and delete categories here: the couple on the
  // main wedding, and the board's admin (best man / maid of honour) on a board.
  canManage: boolean;
  basePath: string;
  board?: BoardKey | null;
  emptyHint?: string;
  // Board plans: votes and comments on each category, and who may take part.
  feedback?: Record<string, FeedbackData>;
  interact?: { canInteract: boolean; canModerate: boolean; revalidate: string; canHide?: boolean };
}) {
  // Categories with something inside get their own family tree; ones on
  // their own sit together in a grid underneath.
  // A plan hidden from you keeps its tail, so it joins the trees.
  const families = roots.filter((r) => r.children.length > 0 || r.hiddenFromMe);
  const singles = roots.filter((r) => r.children.length === 0 && !r.hiddenFromMe);

  const card = (node: CategoryNode) => (
    <CategoryCard
      category={toCardData(node)}
      isCouple={canManage}
      moveTargets={canManage ? moveTargetsFor(roots, node) : []}
      basePath={basePath}
      board={
        interact
          ? { feedback: feedback?.[node.id], canInteract: interact.canInteract, canModerate: interact.canModerate, revalidate: interact.revalidate, canChoose: canManage, canHide: interact.canHide, feedbackMap: feedback }
          : undefined
      }
    />
  );

  // How far a branch has been decided (drives the glowing route).
  const lit = (n: CategoryNode) => (n.decisions === 0 ? "none" : n.decided === n.decisions ? "true" : n.decided > 0 ? "partial" : "none");

  const branch = (node: CategoryNode) => (
    <li key={node.id} data-lit={lit(node)}>
      <div className={`cat-node ${node.children.length > 0 ? "cat-node--parent" : ""}`}>{card(node)}</div>
      {node.children.length > 0 && <ul>{node.children.map(branch)}</ul>}
      {node.hiddenFromMe && <div className="cat-hidden-line" aria-hidden="true" />}
    </li>
  );

  return (
    <>
      {canManage && <NewCategoryForm boardTag={board ?? undefined} label={board ? "New plan" : "New category"} />}

      {roots.length === 0 ? (
        <EmptyState
          className="mt-8"
          title={board ? "No plans yet" : "No categories yet"}
          hint={canManage ? (emptyHint ?? "Add your first one above.") : "Nothing has been shared with you here yet."}
        />
      ) : (
        <>
          {families.map((root, i) => (
            <section key={root.id} className="rise mt-8" style={{ "--i": Math.min(i, 6) } as React.CSSProperties}>
              <div className="cat-tree">
                <ul>{branch(root)}</ul>
              </div>
            </section>
          ))}

          {singles.length > 0 && (
            <section className="mt-10">
              {families.length > 0 && (
                <div className="section-head">
                  <h2 className="section-head__title">On their own</h2>
                  <span className="section-head__rule" />
                </div>
              )}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                {singles.map((node, i) => (
                  <div key={node.id} className="rise" data-lit={lit(node)} style={{ "--i": Math.min(i, 8) } as React.CSSProperties}>
                    <div className="cat-node">{card(node)}</div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </>
  );
}
