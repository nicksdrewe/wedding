import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/roles";
import { getEffectivePermission } from "@/lib/permissions/actions";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { loadCategoryTree } from "@/lib/categories/load";
import { moveTargetsFor, toCardData } from "@/lib/categories/card";
import type { CategoryNode } from "@/lib/categories/tree";
import { NewCategoryForm } from "./NewCategoryForm";
import { CategoryCard } from "./CategoryCard";

export default async function CategoriesPage() {
  const profile = await getCurrentProfile();
  const permission = await getEffectivePermission("categories", profile);
  if (!permission.pageAccess) redirect("/no-access");
  // Creating, renaming, moving and deleting whole categories is the couple's
  // alone (category_pages' write policies) — NOT edit_access, which best man /
  // maid of honour also hold and which only covers a category's contents.
  const isCouple = profile?.role === "couple";

  // Every category this person can see, as a tree, with costs already rolled
  // up from options (lib/categories). Prices a viewer may not see are simply
  // absent.
  const { roots } = await loadCategoryTree(profile);

  // Categories with something inside get their own family tree; ones on
  // their own sit together in a grid underneath.
  const families = roots.filter((r) => r.children.length > 0);
  const singles = roots.filter((r) => r.children.length === 0);

  const card = (node: CategoryNode) => (
    <CategoryCard category={toCardData(node)} isCouple={isCouple} moveTargets={isCouple ? moveTargetsFor(roots, node) : []} />
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
    <div>
      <PageHeader
        eyebrow="Planning"
        title="Categories"
        infoText="Everything with a cost, a contact or a date. Categories can sit inside each other; each one's cost is worked out from its options and everything inside it."
      />

      {isCouple && <NewCategoryForm />}

      {roots.length === 0 ? (
        <EmptyState
          className="mt-8"
          title="No categories yet"
          hint={isCouple ? "Add your first one above." : "Categories shared with you will appear here."}
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
    </div>
  );
}
