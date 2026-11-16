"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, EyeOff, FolderTree } from "lucide-react";
import { Feedback } from "@/components/feedback/Feedback";
import { HideToggle } from "@/components/ui/HideToggle";
import type { FeedbackData } from "@/lib/feedback/types";
import { clearOptionWinner, markOptionWinner } from "@/lib/options/actions";
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
  // Its own map pin (0048), if set; hasPin = it shows on a map at all (own or from its options).
  latitude?: number | null;
  longitude?: number | null;
  hasPin?: boolean;
  // Hidden from the couple by the best man / maid of honour (0052).
  hidden?: boolean;
  hiddenFromMe?: boolean;
  // Whether it invites votes and comments (0051).
  feedbackEnabled?: boolean;
  // False when this viewer isn't allowed to see this category's prices.
  showCost: boolean;
  total: { min: number; max: number; actual: number | null } | null;
  // Some prices beneath are hidden from this viewer.
  partial: boolean;
  childCount: number;
  optionCount: number;
  winners: string[];
  // This category's own options, when it holds any directly (used on boards).
  options?: {
    id: string;
    name: string;
    isWinner: boolean;
    coverImageUrl: string | null;
    costsHidden: boolean;
    figure: number | null;
    max: number | null;
  }[];
  decisions: number;
  decided: number;
};

// Votes and comments on the category itself (boards), and whether the viewer
// may pick winners right from the tree.
export type CardBoardTools = {
  feedback: FeedbackData | undefined;
  canInteract: boolean;
  canModerate: boolean;
  revalidate: string;
  canChoose: boolean;
  // Best man / maid of honour only: may hide a parent plan from the couple.
  canHide?: boolean;
  // Votes and comments on options (keyed by option id).
  feedbackMap?: Record<string, FeedbackData>;
};

export type MoveTarget = { id: string; label: string };

const DELETE_CONFIRM =
  "Delete this category? This also permanently removes every category inside it, plus their options, contacts and dates. This can not be undone.";

export function CategoryCard({
  category,
  isCouple,
  moveTargets = [],
  basePath = "/categories",
  board,
}: {
  // Set on a stag/hen board: options and winners shown in the card, votes and
  // comments under it, and no map fields.
  board?: CardBoardTools;
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
  const [showAll, setShowAll] = useState(false);
  const router = useRouter();

  function choose(optionId: string, winner: boolean) {
    setError(null);
    startTransition(async () => {
      const result = winner ? await clearOptionWinner(optionId) : await markOptionWinner(optionId);
      if (result?.error) setError(result.error);
      else router.refresh();
    });
  }

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
        {board && (
          <label className="flex items-center gap-2 font-reading text-[13px] text-ink">
            <input type="hidden" name="feedbackPresent" value="1" />
            <input type="checkbox" name="feedbackEnabled" defaultChecked={category.feedbackEnabled !== false} />
            Allow votes and comments on this
          </label>
        )}
        <div>
          <span className="field-label">Place on the map (optional)</span>
          <div className="flex gap-2">
            <input name="latitude" type="number" step="any" min={-90} max={90} defaultValue={category.latitude ?? ""} placeholder="Latitude" className="field" />
            <input name="longitude" type="number" step="any" min={-180} max={180} defaultValue={category.longitude ?? ""} placeholder="Longitude" className="field" />
          </div>
          <p className="mt-1 font-reading text-[11px] text-ink-soft">
            For a place, like Porto. The page above it then shows it on a map with its cost. Leave blank for anything that is not a place.
          </p>
        </div>
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

  if (category.hiddenFromMe) {
    return (
      <div className="surface h-full p-4 text-left">
        <span className="font-title text-[20px] leading-tight tracking-tight text-ink">{category.title}</span>
        <span className="mt-2 flex items-center gap-1.5 font-serif text-[12px] text-ink-soft">
          <EyeOff className="h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden="true" />A surprise, kept hidden from you
        </span>
      </div>
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

      {board && (category.options?.length ?? 0) > 0 && (
        <div className="border-t border-ink/8 px-3 py-2">
          {(() => {
            const opts = category.options ?? [];
            const winner = opts.find((o) => o.isWinner);
            const list = winner && !showAll ? [winner] : opts;
            return (
              <>
                <div className="flex flex-col gap-1.5">
                  {list.map((o) => (
                    <div key={o.id} data-lit={o.isWinner ? "true" : undefined} className={`rounded-lg p-1.5 ${o.isWinner ? "bg-accent/10 ring-1 ring-accent/40" : ""}`}>
                    <div className="flex items-center gap-2">
                      {o.coverImageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={o.coverImageUrl} alt="" className={`${o.isWinner ? "h-14 w-14" : "h-8 w-8"} shrink-0 rounded-md object-cover`} />
                      ) : null}
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1 font-serif text-[12px] font-semibold text-ink">
                          {o.isWinner && <Check className="h-3.5 w-3.5 shrink-0 text-accent" strokeWidth={3} aria-hidden="true" />}
                          <span className="truncate">{o.name}</span>
                        </span>
                        {category.showCost && !o.costsHidden && o.figure != null && (
                          <span className="block font-serif text-[11px] tabular-nums text-ink-soft">
                            {o.isWinner ? `${formatCurrency(o.figure, "GBP")} locked in` : formatCostRange(o.figure, o.max ?? o.figure, "GBP")}
                          </span>
                        )}
                      </span>
                      {board.canChoose && (
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => choose(o.id, o.isWinner)}
                          className="shrink-0 font-serif text-[10px] tracking-[0.06em] text-sec uppercase hover:text-ink disabled:opacity-60"
                        >
                          {o.isWinner ? "Remove" : "Choose"}
                        </button>
                      )}
                    </div>
                    <Feedback
                      targetType="page_option"
                      targetId={o.id}
                      data={board.feedbackMap?.[o.id]}
                      canInteract={board.canInteract}
                      canModerate={board.canModerate}
                      revalidate={board.revalidate}
                      className="mt-1"
                    />
                    </div>
                  ))}
                </div>
                {winner && opts.length > 1 && (
                  <button type="button" onClick={() => setShowAll((v) => !v)} className="mt-1 font-serif text-[10px] tracking-[0.06em] text-ink-soft uppercase hover:text-sec">
                    {showAll ? "Hide others" : `${opts.length - 1} other ${opts.length === 2 ? "option" : "options"}`}
                  </button>
                )}
              </>
            );
          })()}
        </div>
      )}

      {board?.canHide && category.childCount > 0 && (
        <div className="border-t border-ink/8 px-3 py-0.5">
          <HideToggle kind="category" id={category.id} hidden={category.hidden === true} revalidate={board.revalidate} />
        </div>
      )}

      {board && category.feedbackEnabled !== false && (
        <div className="border-t border-ink/8 px-3 py-2">
          <Feedback
            targetType="category"
            targetId={category.id}
            data={board.feedback}
            canInteract={board.canInteract}
            canModerate={board.canModerate}
            revalidate={board.revalidate}
          />
        </div>
      )}

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
