import { Botanical } from "@/components/Botanical";

// Standardised empty-list placeholder — a quiet sunken panel with a single
// stem, instead of each page hand-rolling its own stray sentence. Used across
// categories, budget, project, diary and guests with swapped copy.
export type EmptyStateProps = {
  title: string;
  hint?: string;
  className?: string;
};

export function EmptyState({ title, hint, className }: EmptyStateProps) {
  return (
    <div className={["surface surface-sunken flex flex-col items-center px-6 py-10 text-center", className].filter(Boolean).join(" ")}>
      <Botanical seed={title.length + 3} stems={2} width={56} height={72} spread={14} color="var(--sec)" strokeOpacity={0.5} fillOpacity={0.22} />
      <p className="mt-3 font-reading text-[16px] text-ink">{title}</p>
      {hint && <p className="mt-1 font-serif text-[13px] text-ink-soft">{hint}</p>}
    </div>
  );
}
