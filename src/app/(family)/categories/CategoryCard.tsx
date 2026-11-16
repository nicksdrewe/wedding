"use client";

import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { CostRange } from "@/components/CostRange";
import type { Currency } from "@/lib/currency/convert";
import { deleteCategoryPage, updateCategoryPage } from "./actions";

type CategoryPage = {
  id: string;
  slug: string;
  title: string;
  predictedCostMin: number | null;
  predictedCostMax: number | null;
  actualCost: number | null;
  currency: Currency;
  // False when this viewer isn't allowed to see this category's prices.
  showCost: boolean;
};

const DELETE_CONFIRM =
  "Delete this category? This also permanently removes its options board, cost, contacts, and dates. This can not be undone.";

export function CategoryCard({
  category,
  isCouple,
}: {
  category: CategoryPage;
  isCouple: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const [deleting, startDeleteTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  function handleDelete() {
    if (!window.confirm(DELETE_CONFIRM)) return;
    setError(null);
    startDeleteTransition(async () => {
      const result = await deleteCategoryPage(category.id);
      if (result?.error) setError(result.error);
    });
  }

  if (editing) {
    return (
      <form
        ref={formRef}
        action={(formData) =>
          startTransition(async () => {
            setError(null);
            const result = await updateCategoryPage(formData);
            if (result?.error) {
              setError(result.error);
              return;
            }
            setEditing(false);
          })
        }
        className="surface flex flex-col gap-2 p-5"
      >
        <input type="hidden" name="id" value={category.id} />
        <input
          name="title"
          required
          defaultValue={category.title}
          autoFocus
          className="field w-auto"
        />
        <div className="mt-1 flex items-center gap-2">
          <button
            type="submit"
            disabled={pending}
            className="btn btn-primary btn-sm"
          >
            {pending ? "Saving…" : "Save"}
          </button>
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="btn btn-quiet btn-sm"
          >
            Cancel
          </button>
        </div>
        {error && <p className="font-reading text-xs text-alert">{error}</p>}
      </form>
    );
  }

  return (
    <div className="surface surface-lift group h-full">
      <Link href={`/categories/${category.slug}`} className="block p-5 pb-6">
        <h2 className="font-title text-[21px] leading-tight tracking-tight text-ink transition-colors duration-150 group-hover:text-sec">
          {category.title}
        </h2>
        {category.showCost && (
          <CostRange
            className="mt-1.5 block font-reading text-[13px] text-ink-soft"
            predictedMin={category.predictedCostMin}
            predictedMax={category.predictedCostMax}
            actual={category.actualCost}
            currency={category.currency}
          />
        )}
      </Link>
      {isCouple && (
        <div className="absolute top-3 right-3 flex shrink-0 gap-2 transition-opacity [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100">
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="rounded-full bg-white/90 px-2 py-1 font-serif text-[11px] tracking-[0.06em] text-ink-soft uppercase shadow-sm hover:text-sec"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="rounded-full bg-white/90 px-2 py-1 font-serif text-[11px] tracking-[0.06em] text-alert/80 uppercase shadow-sm hover:text-alert disabled:opacity-60"
          >
            {deleting ? "Deleting…" : "Delete"}
          </button>
        </div>
      )}
      {error && (
        <p className="px-5 pb-3 font-reading text-xs text-alert">{error}</p>
      )}
    </div>
  );
}
