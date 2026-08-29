"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { markOptionWinner } from "@/lib/options/actions";
import { AddOptionForm } from "@/components/options/AddOptionForm";

// The skimmed cross-category comparison row. Unlike OptionsGrid (the full
// card board on category pages, complete with confirm dialog + contact/date
// detail), this is deliberately title-plus-cost only — description and
// images live on the categories board now (0006_option_details.sql). This
// is the "which one wins" surface, not the "what does it look like" one.

export type CompareOption = {
  id: string;
  name: string;
  predicted_cost: number | null;
  actual_cost: number | null;
  is_winner: boolean;
};

export type CompareGroup = {
  id: string;
  title: string;
  categoryTitle: string | null;
  categorySlug: string | null;
  options: CompareOption[];
};

export function OptionsCompareGroup({ group }: { group: CompareGroup }) {
  const [isPending, startTransition] = useTransition();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function pick(optionId: string) {
    setError(null);
    setPendingId(optionId);
    startTransition(async () => {
      const { error } = await markOptionWinner(optionId);
      setPendingId(null);
      if (error) setError(error);
    });
  }

  return (
    <div className="overflow-hidden rounded-[10px] border border-ink/10 bg-white">
      <div className="flex items-center justify-between gap-3 bg-cream-deep px-5 py-3">
        <h3 className="font-serif text-sm font-semibold">{group.title}</h3>
        {group.categoryTitle ? (
          <Link
            href={`/categories/${group.categorySlug}`}
            className="shrink-0 font-serif text-[11px] tracking-[0.06em] text-accent uppercase transition hover:underline"
          >
            {group.categoryTitle} →
          </Link>
        ) : (
          <span className="shrink-0 rounded-full bg-white px-2 py-0.5 font-serif text-[10px] tracking-[0.06em] text-ink-soft/70 uppercase">
            Standalone
          </span>
        )}
      </div>

      {error && (
        <p className="border-t border-alert/20 bg-alert/5 px-5 py-2 font-reading text-[13px] text-alert">
          {error}
        </p>
      )}

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
                  <td className="px-5 py-3 align-middle">
                    <span className="font-semibold">{o.name}</span>
                    {o.is_winner && (
                      <span className="ml-2 rounded-full bg-accent px-2 py-0.5 font-serif text-[10px] tracking-wide text-cream uppercase">
                        Winner
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3 align-middle font-reading text-ink-soft tabular-nums">
                    £{o.predicted_cost ?? "—"}
                    {o.actual_cost != null ? ` · £${o.actual_cost} actual` : ""}
                  </td>
                  <td className="px-5 py-3 text-right align-middle">
                    {!o.is_winner && (
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => pick(o.id)}
                        className="rounded-full border border-ink/20 px-4 py-1.5 font-serif text-xs text-ink-soft transition hover:border-ink/40 disabled:opacity-60"
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
        <div className="border-t border-ink/8 px-5 py-4">
          <AddOptionForm groupId={group.id} revalidate="/project" />
        </div>
      )}
    </div>
  );
}
