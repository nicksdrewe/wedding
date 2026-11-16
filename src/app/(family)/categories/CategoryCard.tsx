"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Check, FolderTree } from "lucide-react";
import { formatCostRange, formatCurrency } from "@/lib/currency/format";
import { OPTION_KINDS } from "@/lib/options/kinds";
import { createCategoryPage, deleteCategoryPage, moveCategoryPage, updateCategoryPage } from "./actions";

// One category in the tree. Its cost is never typed in — it arrives already
// worked out from its options and everything nested inside it
// (lib/categories/tree.ts), in pounds.
export type CategoryCardData = {
  id: string;
  slug: string;
  title: string;
  parentId: string | null;
  // What kind of options it holds (0046): decides which boxes the option forms show.
  optionKind?: string | null;
  // False when this viewer isn't allowed to see this category's prices.
  showCost: boolean;
  total: { min: number; max: number; actual: number | null } | null;
  // Some prices beneath are hidden from this viewer.
  partial: boolean;
  childCount: number;
  optionCount: number;
  winners: string[];
  decisions: number;
  decided: number;
};

export type MoveTarget = { id: string; label: string };

const DELETE_CONFIRM =
  "Delete this category? This also permanently removes every category inside it, plus their options, contacts and dates. This can not be undone.";

export function CategoryCard({
  category,
  isCouple,
  moveTargets = [],
  basePath = "/categories",
}: {
  // Where category pages live: /categories, or a board's own plans path.
  basePath?: string;
  category: CategoryCardData;
  isCouple: boolean;
  // Where this category could be moved to (everything except itself and
  // what's inside it). Only used by the couple's edit form.
  moveTargets?: MoveTarget[];
}) {
  const [mode, setMode] = useState<"view" | "edit" | "add">("view");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleDelete() {
    if (!window.confirm(DELETE_CONFIRM)) return;
    setError(null);
    startTransition(async () => {
      const result = await deleteCategoryPage(category.id);
      if (result?.error) setError(result.error);
    });
  }

  if (mode === "edit") {
    return (
      <form
        action={(formData) =>
          startTransition(async () => {
            setError(null);
            const renamed = await updateCategoryPage(formData);
            if (renamed?.error) {
              setError(renamed.error);
              return;
            }
            const nextParent = (formData.get("parentId") as string) || null;
            if (nextParent !== category.parentId) {
              const moved = await moveCategoryPage(formData);
              if (moved?.error) {
                setError(moved.error);
                return;
              }
            }
            setMode("view");
          })
        }
        className="surface surface-raised flex flex-col gap-3 p-4 text-left"
      >
        <input type="hidden" name="id" value={category.id} />
        <label>
          <span className="field-label">Name</span>
          <input name="title" required defaultValue={category.title} autoFocus className="field" />
        </label>
        <label>
          <span className="field-label">Sits inside</span>
          <select name="parentId" defaultValue={category.parentId ?? ""} className="field">
            <option value="">Nothing (top level)</option>
            {moveTargets.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="field-label">Kind of options</span>
          <select name="optionKind" defaultValue={category.optionKind ?? "general"} className="field">
            {OPTION_KINDS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label} ({k.hint})
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-center gap-2">
          <button type="submit" disabled={pending} className="btn btn-sec btn-sm">
            {pending ? "Saving…" : "Save"}
          </button>
          <button type="button" onClick={() => setMode("view")} className="btn btn-quiet btn-sm">
            Cancel
          </button>
        </div>
        {error && <p className="font-reading text-xs text-alert">{error}</p>}
      </form>
    );
  }

  const { total } = category;
  const allDecided = category.decisions > 0 && category.decided === category.decisions;
  const status =
    category.childCount > 0
      ? category.decisions > 0
        ? `${category.decided} of ${category.decisions} decided`
        : `${category.childCount} inside`
      : category.winners.length > 0
        ? `Chosen: ${category.winners.join(", ")}`
        : category.optionCount > 0
          ? `${category.optionCount} ${category.optionCount === 1 ? "option" : "options"} to choose from`
          : "No options yet";

  return (
    <div className="surface surface-lift group h-full text-left">
      <Link href={`${basePath}/${category.slug}`} className="block p-4 pb-3">
        <span className="flex items-start gap-2">
          {category.childCount > 0 && <FolderTree className="mt-1 h-4 w-4 shrink-0 text-sec" strokeWidth={2} aria-hidden="true" />}
          <span className="font-title text-[20px] leading-tight tracking-tight text-ink transition-colors duration-150 group-hover:text-sec">
            {category.title}
          </span>
        </span>
        {category.showCost && total && (
          <span className="mt-1.5 block font-serif text-[14px] font-semibold tabular-nums text-ink">
            {formatCostRange(total.min, total.max, "GBP")}
            {category.partial && <span className="font-normal text-ink-soft"> +</span>}
          </span>
        )}
        {category.showCost && total?.actual != null && (
          <span className="block font-serif text-[12px] tabular-nums text-accent">
            {formatCurrency(total.actual, "GBP")} actual so far
          </span>
        )}
        <span className="mt-2 flex items-center gap-1.5 font-serif text-[12px] text-ink-soft">
          {(allDecided || (category.childCount === 0 && category.winners.length > 0)) && (
            <Check className="h-3.5 w-3.5 shrink-0 text-accent" strokeWidth={3} aria-hidden="true" />
          )}
          <span className="line-clamp-2">{status}</span>
        </span>
        {category.childCount > 0 && category.decisions > 0 && (
          <span className="cat-progress mt-2 block" aria-hidden="true">
            <span style={{ width: `${Math.round((category.decided / category.decisions) * 100)}%` }} />
          </span>
        )}
      </Link>

      {isCouple && mode === "view" && (
        <div className="flex gap-3 border-t border-ink/8 px-4 py-1.5 transition-opacity [@media(hover:hover)]:opacity-60 [@media(hover:hover)]:group-hover:opacity-100">
          <button type="button" onClick={() => setMode("add")} className="min-h-9 font-serif text-[11px] tracking-[0.06em] text-sec uppercase">
            + Inside
          </button>
          <button type="button" onClick={() => setMode("edit")} className="min-h-9 font-serif text-[11px] tracking-[0.06em] text-ink-soft uppercase hover:text-sec">
            Edit
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={pending}
            className="ml-auto min-h-9 font-serif text-[11px] tracking-[0.06em] text-alert/80 uppercase hover:text-alert disabled:opacity-60"
          >
            {pending ? "Deleting…" : "Delete"}
          </button>
        </div>
      )}

      {isCouple && mode === "add" && (
        <form
          action={(formData) =>
            startTransition(async () => {
              setError(null);
              const result = await createCategoryPage(formData);
              if (result?.error) {
                setError(result.error);
                return;
              }
              setMode("view");
            })
          }
          className="flex flex-col gap-2 border-t border-ink/8 p-3"
        >
          <input type="hidden" name="parentId" value={category.id} />
          <label>
            <span className="field-label">New category inside {category.title}</span>
            <input name="title" required autoFocus placeholder="e.g. Friday breakfast" className="field" />
          </label>
          <div className="flex gap-2">
            <button type="submit" disabled={pending} className="btn btn-sec btn-sm">
              {pending ? "Adding…" : "Add"}
            </button>
            <button type="button" onClick={() => setMode("view")} className="btn btn-quiet btn-sm">
              Cancel
            </button>
          </div>
        </form>
      )}
      {error && <p className="px-4 pb-3 font-reading text-xs text-alert">{error}</p>}
    </div>
  );
}
