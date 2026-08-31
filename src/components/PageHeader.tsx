import { InfoTooltip } from "@/components/InfoTooltip";

// Shared "eyebrow + title" block every signed-in page opens with (Design
// Spec §2). The eyebrow is the section grouping — "Planning" for
// Categories/Budget/Project, "Household" for Guests, "Us" for Diary —
// it's what turns five disconnected pages into one system, so callers
// should treat it as a small fixed vocabulary rather than free text.
// Explanatory copy that used to sit as an always-visible paragraph under
// the title now collapses behind a small info icon (infoText) — declutters
// the page while staying one click away.
export type PageHeaderProps = {
  eyebrow: string;
  title: string;
  infoText?: string;
};

export function PageHeader({ eyebrow, title, infoText }: PageHeaderProps) {
  return (
    <div className="mb-8">
      <p className="font-serif text-[11px] font-medium tracking-[0.14em] text-accent uppercase">
        {eyebrow}
      </p>
      <div className="mt-1.5 flex items-center gap-2">
        <h1 className="font-display text-[34px] tracking-tight">{title}</h1>
        {infoText && <InfoTooltip text={infoText} />}
      </div>
    </div>
  );
}
