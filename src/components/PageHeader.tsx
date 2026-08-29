// Shared "eyebrow + title + description" block every signed-in page opens
// with (Design Spec §2). The eyebrow is the section grouping — "Planning"
// for Categories/Budget/Project, "Household" for Guests, "Us" for Diary —
// it's what turns five disconnected pages into one system, so callers
// should treat it as a small fixed vocabulary rather than free text.
// Description is optional: omit it on pages where it would just pad things
// out rather than adding information.
export type PageHeaderProps = {
  eyebrow: string;
  title: string;
  description?: string;
};

export function PageHeader({ eyebrow, title, description }: PageHeaderProps) {
  return (
    <div className="mb-8">
      <p className="font-serif text-[11px] font-medium tracking-[0.14em] text-accent uppercase">
        {eyebrow}
      </p>
      <h1 className="mt-1.5 font-display text-[34px] tracking-tight">{title}</h1>
      {description && (
        <p className="mt-2 max-w-prose font-reading text-[15px] text-ink-soft">
          {description}
        </p>
      )}
    </div>
  );
}
