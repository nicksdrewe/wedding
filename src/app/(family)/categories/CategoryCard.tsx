"use client";

import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { deleteCategoryPage, updateCategoryPage } from "./actions";

type CategoryPage = {
  id: string;
  slug: string;
  title: string;
  predictedCost: number | string;
  actualCost: number | string;
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
        className="flex flex-col gap-2 rounded-[10px] border border-ink/10 bg-white p-5"
      >
        <input type="hidden" name="id" value={category.id} />
        <input
          name="title"
          required
          defaultValue={category.title}
          autoFocus
          className="rounded-full border border-ink/20 bg-cream px-4 py-2 text-sm outline-none transition-colors focus:border-accent"
        />
        <div className="mt-1 flex items-center gap-2">
          <button
            type="submit"
            disabled={pending}
            className="rounded-full bg-ink px-5 py-2 font-serif text-xs text-cream transition-colors hover:bg-ink-soft disabled:opacity-60"
          >
            {pending ? "Saving…" : "Save"}
          </button>
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="rounded-full border border-ink/20 px-5 py-2 font-serif text-xs text-ink-soft transition-colors hover:border-ink/40"
          >
            Cancel
          </button>
        </div>
        {error && <p className="font-reading text-xs text-alert">{error}</p>}
      </form>
    );
  }

  return (
    <div className="group relative rounded-[10px] border border-ink/10 bg-white transition-colors duration-150 hover:border-accent/40 hover:bg-accent/[0.03]">
      <Link href={`/categories/${category.slug}`} className="block p-5">
        <h2 className="font-serif text-[15px] font-semibold text-ink transition-colors duration-150 group-hover:text-accent">
          {category.title}
        </h2>
        <p className="mt-1.5 font-reading text-[13px] text-ink-soft">
          Predicted £{category.predictedCost ?? "—"} · Actual £{category.actualCost ?? "—"}
        </p>
      </Link>
      {isCouple && (
        <div className="absolute top-3 right-3 flex shrink-0 gap-2 transition-opacity [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100">
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="rounded-full bg-white/90 px-2 py-1 font-serif text-[11px] tracking-[0.06em] text-ink-soft uppercase shadow-sm hover:text-accent"
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
