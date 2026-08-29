// Standardised empty-list placeholder (Design Spec §3) — a dashed-border
// card instead of each page hand-rolling its own stray sentence. Used
// across categories (grid), budget (line items), project (options), diary
// (entries) and guests (table) with the same shape and swapped copy.
export type EmptyStateProps = {
  title: string;
  hint?: string;
  className?: string;
};

export function EmptyState({ title, hint, className }: EmptyStateProps) {
  return (
    <div
      className={[
        "rounded-[10px] border border-dashed border-ink/15 bg-white/40 px-6 py-10 text-center",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <p className="font-reading text-[15px] text-ink-soft">{title}</p>
      {hint && <p className="mt-1 font-serif text-[13px] text-ink-soft/70">{hint}</p>}
    </div>
  );
}
