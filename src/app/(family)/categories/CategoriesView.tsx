import { EmptyState } from "@/components/EmptyState";
import { OptionsMapLoader } from "@/components/options/OptionsMapLoader";
import { placePins } from "@/lib/categories/map";
import { moveTargetsFor, toCardData } from "@/lib/categories/card";
import type { CategoryNode } from "@/lib/categories/tree";
import type { BoardKey } from "@/lib/categories/boards";
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
}: {
  roots: CategoryNode[];
  // May create, rename, move and delete categories here: the couple on the
  // main wedding, and the board's admin (best man / maid of honour) on a board.
  canManage: boolean;
  basePath: string;
  board?: BoardKey | null;
  emptyHint?: string;
}) {
  const placePinList = placePins(roots, basePath);

  // Categories with something inside get their own family tree; ones on
  // their own sit together in a grid underneath.
  const families = roots.filter((r) => r.children.length > 0);
  const singles = roots.filter((r) => r.children.length === 0);

  const card = (node: CategoryNode) => (
    <CategoryCard
      category={toCardData(node)}
      isCouple={canManage}
      moveTargets={canManage ? moveTargetsFor(roots, node) : []}
      basePath={basePath}
    />
  );

  // How far a branch has been decided (drives the glowing route).
  const lit = (n: CategoryNode) => (n.decisions === 0 ? "none" : n.decided === n.decisions ? "true" : n.decided > 0 ? "partial" : "none");

  const branch = (node: CategoryNode) => (
    <li key={node.id} data-lit={lit(node)}>
      <div className={`cat-node ${node.children.length > 0 ? "cat-node--parent" : ""}`}>{card(node)}</div>
      {node.children.length > 0 && <ul>{node.children.map(branch)}</ul>}
    </li>
  );

  return (
    <>
      {placePinList.length > 0 && (
        <div className="mt-6">
          <p className="mb-2 font-serif text-[11px] font-medium tracking-[0.08em] text-ink-soft/70 uppercase">On the map</p>
          <OptionsMapLoader options={placePinList} />
        </div>
      )}

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
