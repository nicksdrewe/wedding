import { Botanical } from "@/components/Botanical";
import { InfoTooltip } from "@/components/InfoTooltip";

// The "canopy": the dark garden band every signed-in page opens with (see
// docs/design-system.md). It carries the eyebrow (a small fixed vocabulary —
// "Planning", "Household", "Us" — that groups pages into one system), the
// title, an optional info bubble, and optional actions on the right. Its glow
// takes the colour of whichever part of the site you're in (data-section on
// the shell), and each page's stems are grown from its own title so no two
// headers are identical.
export type PageHeaderProps = {
  eyebrow: string;
  title: string;
  infoText?: string;
  /** Buttons/links shown on the right of the band. They sit on a dark
   *  background — use the `btn btn-on-dark` classes. */
  actions?: React.ReactNode;
  /** Extra content drawn inside the band, under the title (e.g. a group chart). */
  children?: React.ReactNode;
};

function seedFrom(text: string) {
  let h = 7;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) % 9973;
  return h + 1;
}

export function PageHeader({ eyebrow, title, infoText, actions, children }: PageHeaderProps) {
  const seed = seedFrom(title);
  return (
    <header className="canopy mb-8">
      <div className="canopy__stems">
        <Botanical seed={seed} stems={2} width={90} height={150} spread={18} color="var(--color-cream)" strokeOpacity={0.3} fillOpacity={0.14} className="hidden sm:block" />
        <Botanical seed={seed + 3} stems={3} width={150} height={230} spread={34} color="var(--sec-glow)" strokeOpacity={0.6} fillOpacity={0.3} />
        <Botanical seed={seed + 8} stems={2} width={80} height={120} spread={16} color="var(--color-cream)" strokeOpacity={0.18} fillOpacity={0.08} />
      </div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="canopy__eyebrow">{eyebrow}</p>
          <div className="flex items-center gap-2.5">
            <h1 className="canopy__title">{title}</h1>
            {infoText && <InfoTooltip text={infoText} className="mt-3 !text-cream/60 hover:!text-cream" />}
          </div>
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children}
    </header>
  );
}
