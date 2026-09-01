"use client";

import { useState, useTransition } from "react";
import { Plus, X } from "lucide-react";
import { addCostItem, updateCostItem, deleteCostItem } from "@/lib/costs/items";
import { linkCostItem, unlinkCostItem } from "@/lib/costs/links";
import { formatCurrency } from "@/lib/currency/format";
import type { Currency } from "@/lib/currency/convert";

export type CostItemRow = {
  id: string;
  name: string;
  kind: "cost" | "income";
  quantity: number | null;
  rate: number | null;
  amount: number;
};

export type LinkableCategory = { id: string; title: string };
export type CostItemLinkInfo = { id: string; categoryTitle: string };

const INPUT_CLASS =
  "rounded-full border border-ink/20 bg-cream px-3 py-1.5 text-xs outline-none focus:border-accent";

function CostItemRowView({
  item,
  currency,
  revalidate,
  isCouple,
  linkableCategories,
  existingLinks,
}: {
  item: CostItemRow;
  currency: Currency;
  revalidate: string;
  isCouple: boolean;
  linkableCategories: LinkableCategory[];
  existingLinks: CostItemLinkInfo[];
}) {
  const [editing, setEditing] = useState(false);
  const [deletePending, startDeleteTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [linkCategoryId, setLinkCategoryId] = useState("");
  const [linkPending, startLinkTransition] = useTransition();
  const [unlinkingId, setUnlinkingId] = useState<string | null>(null);

  function handleDelete() {
    if (!window.confirm(`Remove "${item.name}"? This can not be undone.`)) return;
    setError(null);
    startDeleteTransition(async () => {
      const result = await deleteCostItem(item.id, revalidate);
      if (result?.error) setError(result.error);
    });
  }

  function handleLink() {
    if (!linkCategoryId) return;
    setError(null);
    const formData = new FormData();
    formData.set("sourceCostItemId", item.id);
    formData.set("targetCategoryPageId", linkCategoryId);
    startLinkTransition(async () => {
      const result = await linkCostItem(formData);
      if (result?.error) {
        setError(result.error);
        return;
      }
      setLinkCategoryId("");
    });
  }

  function handleUnlink(linkId: string) {
    setError(null);
    setUnlinkingId(linkId);
    startLinkTransition(async () => {
      const result = await unlinkCostItem(linkId);
      if (result?.error) setError(result.error);
      setUnlinkingId(null);
    });
  }

  if (editing) {
    return (
      <CostItemForm
        pageOptionId=""
        revalidate={revalidate}
        existing={item}
        onCancel={() => setEditing(false)}
        onSaved={() => setEditing(false)}
      />
    );
  }

  return (
    <div className="rounded-[8px] border border-ink/10 bg-cream-deep/30 px-3.5 py-2.5">
      {/* Name/badge/qty on their own wrapping line, amount + actions on
          their own line below — two side-by-side flex clusters that both
          also try to wrap (the previous layout) fight each other for
          space and overlap on narrow cards; stacking always, rather than
          only past a breakpoint, is what actually fixes it at any width. */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 font-serif text-[10px] tracking-[0.06em] uppercase ${
            item.kind === "income" ? "bg-accent/15 text-accent" : "bg-ink/8 text-ink-soft"
          }`}
        >
          {item.kind === "income" ? "Income" : "Cost"}
        </span>
        <span className="font-serif text-sm text-ink">{item.name}</span>
        {item.quantity != null && item.rate != null && (
          <span className="font-reading text-xs text-ink-soft/70">
            ({item.quantity} × {formatCurrency(item.rate, currency)})
          </span>
        )}
      </div>
      <div className="mt-1.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <span className={`font-reading text-sm tabular-nums ${item.kind === "income" ? "text-accent" : "text-ink"}`}>
          {item.kind === "income" ? "−" : "+"}
          {formatCurrency(item.amount, currency)}
        </span>
        {isCouple && (
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => setEditing(true)} className="font-serif text-[11px] text-ink-soft uppercase hover:text-accent">
              Edit
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={deletePending}
              className="font-serif text-[11px] text-alert/80 uppercase hover:text-alert disabled:opacity-60"
            >
              {deletePending ? "…" : "Delete"}
            </button>
          </div>
        )}
      </div>

      {isCouple && linkableCategories.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {existingLinks.map((link) => (
            <span
              key={link.id}
              className="flex items-center gap-1 rounded-full bg-white px-2.5 py-1 font-reading text-[11px] text-ink-soft"
            >
              Also in {link.categoryTitle}
              <button
                type="button"
                onClick={() => handleUnlink(link.id)}
                disabled={unlinkingId === link.id}
                aria-label={`Unlink from ${link.categoryTitle}`}
                className="text-ink-soft/60 hover:text-alert"
              >
                <X className="h-3 w-3" strokeWidth={2.5} />
              </button>
            </span>
          ))}
          <select
            value={linkCategoryId}
            onChange={(e) => setLinkCategoryId(e.target.value)}
            className="rounded-full border border-ink/15 bg-white px-2.5 py-1 font-reading text-[11px] text-ink-soft outline-none focus:border-accent"
          >
            <option value="">Also show under…</option>
            {linkableCategories
              .filter((c) => !existingLinks.some((l) => l.categoryTitle === c.title))
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
          </select>
          {linkCategoryId && (
            <button
              type="button"
              onClick={handleLink}
              disabled={linkPending}
              className="rounded-full border border-ink/20 px-2.5 py-1 font-serif text-[11px] text-ink-soft transition hover:border-ink/40 disabled:opacity-60"
            >
              Link
            </button>
          )}
        </div>
      )}

      {error && <p className="mt-1.5 font-reading text-xs text-alert">{error}</p>}
    </div>
  );
}

function CostItemForm({
  pageOptionId,
  revalidate,
  existing,
  onCancel,
  onSaved,
}: {
  pageOptionId: string;
  revalidate: string;
  existing?: CostItemRow;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  // Two entry modes: a flat amount, or quantity × rate (e.g. 40 guests ×
  // £50/night) — mutually exclusive so the form never shows a stale
  // amount alongside quantity/rate that no longer matches it.
  const [useCalculator, setUseCalculator] = useState(!!(existing?.quantity != null && existing?.rate != null));

  return (
    <form
      action={(formData) =>
        startTransition(async () => {
          setError(null);
          if (!useCalculator) {
            formData.delete("quantity");
            formData.delete("rate");
          }
          const result = existing ? await updateCostItem(formData) : await addCostItem(formData);
          if (result?.error) {
            setError(result.error);
            return;
          }
          onSaved();
        })
      }
      className="flex flex-wrap items-end gap-2 rounded-[8px] border border-accent/30 bg-white p-3"
    >
      {existing ? (
        <input type="hidden" name="id" value={existing.id} />
      ) : (
        <input type="hidden" name="pageOptionId" value={pageOptionId} />
      )}
      <input type="hidden" name="revalidate" value={revalidate} />

      <input
        name="name"
        required
        defaultValue={existing?.name ?? ""}
        placeholder="e.g. Wedding breakfast"
        className={INPUT_CLASS}
      />
      <select name="kind" defaultValue={existing?.kind ?? "cost"} className={INPUT_CLASS}>
        <option value="cost">Cost</option>
        <option value="income">Income (subtracts)</option>
      </select>

      {useCalculator ? (
        <>
          <input
            name="quantity"
            type="number"
            step="0.01"
            min={0}
            defaultValue={existing?.quantity ?? ""}
            placeholder="Quantity"
            className={`w-20 ${INPUT_CLASS}`}
          />
          <span className="text-ink-soft">×</span>
          <input
            name="rate"
            type="number"
            step="0.01"
            min={0}
            defaultValue={existing?.rate ?? ""}
            placeholder="Rate"
            className={`w-20 ${INPUT_CLASS}`}
          />
        </>
      ) : (
        <input
          name="amount"
          type="number"
          step="0.01"
          min={0}
          defaultValue={existing?.amount ?? ""}
          placeholder="Amount"
          className={`w-24 ${INPUT_CLASS}`}
        />
      )}
      <button
        type="button"
        onClick={() => setUseCalculator((v) => !v)}
        className="font-serif text-[11px] text-ink-soft underline underline-offset-2 hover:text-accent"
      >
        {useCalculator ? "Use flat amount" : "Use quantity × rate"}
      </button>

      <button
        type="submit"
        disabled={pending}
        className="rounded-full bg-ink px-4 py-1.5 font-serif text-xs text-cream transition hover:bg-ink-soft disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save"}
      </button>
      <button
        type="button"
        onClick={onCancel}
        className="rounded-full border border-ink/20 px-4 py-1.5 font-serif text-xs text-ink-soft transition hover:border-ink/40"
      >
        Cancel
      </button>
      {error && <p className="w-full font-reading text-xs text-alert">{error}</p>}
    </form>
  );
}

export function CostItemsPanel({
  pageOptionId,
  revalidate,
  isCouple,
  items,
  currency,
  linkableCategories,
  linksByItem,
}: {
  pageOptionId: string;
  revalidate: string;
  isCouple: boolean;
  items: CostItemRow[];
  currency: Currency;
  linkableCategories: LinkableCategory[];
  linksByItem: Record<string, CostItemLinkInfo[]>;
}) {
  const [adding, setAdding] = useState(false);

  return (
    <div>
      {items.length === 0 && !isCouple && (
        <p className="font-reading text-xs text-ink-soft/70 italic">No additional costs logged.</p>
      )}
      {items.length > 0 && (
        <div className="flex flex-col gap-2">
          {items.map((item) => (
            <CostItemRowView
              key={item.id}
              item={item}
              currency={currency}
              revalidate={revalidate}
              isCouple={isCouple}
              linkableCategories={linkableCategories}
              existingLinks={linksByItem[item.id] ?? []}
            />
          ))}
        </div>
      )}

      {isCouple && (
        <div className="mt-2">
          {adding ? (
            <CostItemForm pageOptionId={pageOptionId} revalidate={revalidate} onCancel={() => setAdding(false)} onSaved={() => setAdding(false)} />
          ) : (
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="flex items-center gap-1.5 font-serif text-xs text-ink-soft transition hover:text-accent"
            >
              <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
              Add a cost or income line
            </button>
          )}
        </div>
      )}
    </div>
  );
}
