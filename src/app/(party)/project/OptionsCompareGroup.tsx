"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ChevronDown, ImageIcon } from "lucide-react";
import { toDriveImageUrl } from "@/lib/google/image-url";
import { markOptionWinner } from "@/lib/options/actions";
import { AddOptionForm } from "@/components/options/AddOptionForm";
import { CostRange } from "@/components/CostRange";
import type { Currency } from "@/lib/currency/convert";
import { deleteOptionGroup, updateOptionGroupTitle } from "./actions";
import { Feedback } from "@/components/feedback/Feedback";
import type { FeedbackData } from "@/lib/feedback/types";

// The skimmed cross-category comparison row. Unlike OptionsGrid (the full
// card board on category pages, complete with confirm dialog + contact/date
// detail), this is deliberately title-plus-cost only — description and
// images live on the categories board now (0006_option_details.sql). This
// is the "which one wins" surface, not the "what does it look like" one.

export type CompareOption = {
  id: string;
  name: string;
  predicted_cost_min: number | null;
  predicted_cost_max: number | null;
  actual_cost: number | null;
  currency: Currency;
  // RLS withheld this option's prices from the viewer (lib/options/costs.ts).
  costs_hidden: boolean;
  is_winner: boolean;
  // First picture of the option, if it has one.
  coverImageUrl?: string | null;
  // Votes and comments (0037) — filled in by the page.
  feedback?: FeedbackData;
};

export type CompareGroup = {
  id: string;
  title: string;
  categoryTitle: string | null;
  categorySlug: string | null;
  options: CompareOption[];
  // Whether the viewer may see prices on the board this (standalone) group
  // belongs to — decides if its add-option form offers cost inputs.
  showCosts: boolean;
  // Choosing the winner of a CATEGORY comparison is couple-only (it rewrites
  // that category's live cost/date/contact — enforced by a trigger in
  // 0033_party_planner_access.sql); standalone comparisons stay open to
  // whoever can edit the board.
  canPickWinner: boolean;
  // Renaming or deleting a standalone comparison: on a stag/hen board that
  // is the project admin's (0034); on the main board, whoever can edit it.
  canManageGroup: boolean;
  // The page this comparison is shown on, so a vote or comment refreshes it.
  revalidate: string;
  // May remove other people's comments on this comparison's options: the
  // couple, or the stag/hen board's admin (enforced by the database too).
  canModerateFeedback: boolean;
  // False for a plain guest — they see counts only.
  canInteractFeedback: boolean;
};

export function OptionsCompareGroup({ group }: { group: CompareGroup }) {
  const [isPending, startTransition] = useTransition();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState(false);
  const [groupPending, startGroupTransition] = useTransition();
  // Collapsed by default: the page lists every comparison running, so the
  // closed row has to say enough (how many options, who is winning) to skip it.
  const [open, setOpen] = useState(false);
  const winner = group.options.find((o) => o.is_winner) ?? null;
  const thumbs = group.options.filter((o) => o.coverImageUrl).slice(0, 3);

  // Only a standalone comparison's own title/existence is editable here —
  // a category-linked group (Venue, Flowers...) lives on that category's
  // board and is that agent's surface, not this one's.
  const isStandalone = !group.categoryTitle && group.canManageGroup;

  function pick(optionId: string) {
    setError(null);
    setPendingId(optionId);
    startTransition(async () => {
      const { error } = await markOptionWinner(optionId);
      setPendingId(null);
      if (error) setError(error);
    });
  }

  function handleDeleteGroup() {
    if (
      !window.confirm(
        "Delete this whole comparison? Every option logged in it will be deleted too. This can not be undone."
      )
    )
      return;
    setError(null);
    startGroupTransition(async () => {
      const result = await deleteOptionGroup(group.id);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div className="surface overflow-hidden">
      <div className="group flex items-center justify-between gap-3 bg-sec-tint/60 px-3 py-2 sm:px-4">
        {editingTitle ? (
          <form
            action={(formData) =>
              startGroupTransition(async () => {
                setError(null);
                const result = await updateOptionGroupTitle(formData);
                if (result?.error) {
                  setError(result.error);
                  return;
                }
                setEditingTitle(false);
              })
            }
            className="flex flex-1 items-center gap-2"
          >
            <input type="hidden" name="id" value={group.id} />
            <input
              name="title"
              required
              defaultValue={group.title}
              className="field flex-1"
            />
            <button
              type="submit"
              disabled={groupPending}
              className="btn btn-sm btn-primary"
            >
              {groupPending ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={() => setEditingTitle(false)}
              className="btn btn-sm btn-quiet"
            >
              Cancel
            </button>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            className="flex min-h-12 min-w-0 flex-1 items-center gap-3 text-left"
          >
            <ChevronDown className={`h-5 w-5 shrink-0 text-sec transition-transform duration-200 ${open ? "rotate-180" : ""}`} strokeWidth={2} />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-title text-[18px] leading-tight tracking-tight">{group.title}</span>
              <span className="block truncate font-serif text-[12px] text-ink-soft">
                {group.options.length} {group.options.length === 1 ? "option" : "options"}
                {winner && <> · <span className="font-semibold text-accent">Winner: {winner.name}</span></>}
              </span>
            </span>
            {!open && thumbs.length > 0 && (
              <span className="hidden shrink-0 -space-x-2 sm:flex" aria-hidden="true">
                {thumbs.map((o) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={o.id} src={toDriveImageUrl(o.coverImageUrl!)} alt="" className="h-9 w-9 rounded-full border-2 border-paper object-cover" />
                ))}
              </span>
            )}
          </button>
        )}
        {!editingTitle && (
          <div className="flex shrink-0 items-center gap-3">
            {isStandalone && (
              <div className="flex gap-2 transition-opacity [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100">
                <button
                  type="button"
                  onClick={() => setEditingTitle(true)}
                  className="font-serif text-[11px] tracking-[0.06em] text-ink-soft uppercase hover:text-sec"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={handleDeleteGroup}
                  disabled={groupPending}
                  className="font-serif text-[11px] tracking-[0.06em] text-alert/80 uppercase hover:text-alert"
                >
                  Delete
                </button>
              </div>
            )}
            {group.categoryTitle ? (
              <Link
                href={`/categories/${group.categorySlug}`}
                className="shrink-0 font-serif text-[11px] tracking-[0.06em] text-accent uppercase transition hover:underline"
              >
                {group.categoryTitle} →
              </Link>
            ) : (
              <span className="chip shrink-0 !text-[10px] tracking-[0.06em] uppercase">Standalone</span>
            )}
          </div>
        )}
      </div>

      {error && (
        <p className="border-t border-alert/20 bg-alert/5 px-5 py-2 font-reading text-[13px] text-alert">
          {error}
        </p>
      )}

      {open && (
        <div className="rise">
      {group.options.length === 0 ? (
        <p className="px-5 py-4 font-reading text-[13px] text-ink-soft">
          No options logged yet.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[420px] text-left font-serif text-[13px]">
            <tbody>
              {group.options.map((o) => (
                <tr key={o.id} className="border-t border-ink/8">
                  <td className="px-4 py-3 align-middle">
                    <div className="flex items-center gap-3">
                      {o.coverImageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={toDriveImageUrl(o.coverImageUrl)} alt="" loading="lazy" className="h-14 w-14 shrink-0 rounded-[12px] object-cover shadow-[var(--shadow-1)]" />
                      ) : (
                        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[12px] bg-sec-tint text-sec/60" aria-hidden="true">
                          <ImageIcon className="h-5 w-5" strokeWidth={1.75} />
                        </span>
                      )}
                      <div className="min-w-0">
                        <span className="font-semibold">{o.name}</span>
                        {o.is_winner && <span className="chip ml-2 !bg-accent !text-cream !text-[10px] tracking-wide uppercase">Winner</span>}
                      </div>
                    </div>
                    <Feedback
                      targetType="page_option"
                      targetId={o.id}
                      data={o.feedback}
                      canInteract={group.canInteractFeedback}
                      canModerate={group.canModerateFeedback}
                      revalidate={group.revalidate}
                      className="mt-2 font-normal"
                    />
                  </td>
                  <td className="px-4 py-3 align-middle font-reading text-ink-soft tabular-nums">
                    {!o.costs_hidden && (
                      <CostRange
                        predictedMin={o.predicted_cost_min}
                        predictedMax={o.predicted_cost_max}
                        actual={o.actual_cost}
                        currency={o.currency}
                      />
                    )}
                  </td>
                  <td className="px-4 py-3 text-right align-middle">
                    {!o.is_winner && group.canPickWinner && (
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => pick(o.id)}
                        className="btn btn-sm btn-quiet"
                      >
                        {pendingId === o.id ? "Marking…" : "Mark as winner"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Category-linked groups get their add-option form on the category
          board (the full detail view); standalone groups (stag/hen...) have
          no such page, so this stays their only way to log an option. */}
      {!group.categoryTitle && (
        <div className="border-t border-ink/8 px-4 py-4">
          <AddOptionForm groupId={group.id} revalidate="/project" showCosts={group.showCosts} />
        </div>
      )}
        </div>
      )}
    </div>
  );
}
