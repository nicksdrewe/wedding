import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";

export type TimelineTier = "milestone" | "standard" | "minor";

function formatDate(date: string) {
  const dateOnly = date.length === 10;
  return new Date(dateOnly ? `${date}T12:00:00Z` : date).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: dateOnly ? "UTC" : "Europe/London",
  });
}

export function TimelineItem({
  id,
  date,
  dateLabel,
  title,
  excerpt,
  tier,
  icon,
  href,
  chips,
  side,
  index = 99,
  highlight = false,
  children,
}: {
  id: string;
  date: string;
  dateLabel?: string;
  title: string;
  excerpt?: string | null;
  tier: TimelineTier;
  icon?: ReactNode;
  href?: string;
  chips?: ReactNode;
  side: "left" | "right" | "center";
  index?: number;
  highlight?: boolean;
  children?: ReactNode;
}) {
  const dateText = dateLabel ?? formatDate(date);
  const animate = index < 8;
  const style = animate ? ({ "--i": index } as CSSProperties) : undefined;
  const titleNode = href ? (
    <Link href={href} className="tl-link">
      {title}
    </Link>
  ) : (
    title
  );

  if (tier === "minor") {
    return (
      <li id={`entry-${id}`} className={`tl-item${animate ? " rise" : ""}`} data-tier="minor" data-side={side} style={style}>
        <span className="tl-node" aria-hidden="true" />
        <div className={`tl-minor${highlight ? " tl-hl" : ""}`}>
          <p className="tl-minor-line">
            <span className="tl-minor-icon" aria-hidden="true">
              {icon}
            </span>
            <span className="tl-minor-date">{dateText}</span>
            <span className="tl-minor-title">{titleNode}</span>
            {excerpt ? <span className="tl-minor-excerpt"> · {excerpt}</span> : null}
          </p>
          {chips ? <div className="tl-chips">{chips}</div> : null}
          {children}
        </div>
      </li>
    );
  }

  const milestone = tier === "milestone";
  return (
    <li id={`entry-${id}`} className={`tl-item${animate ? " rise" : ""}`} data-tier={tier} data-side={side} style={style}>
      <span className="tl-node" aria-hidden="true">
        {icon}
      </span>
      <div className={`tl-card surface ${milestone ? "surface-tint" : ""}${highlight ? " tl-hl" : ""}`}>
        <h3 className={`tl-title font-title ${milestone ? "tl-title-lg" : ""}`}>{titleNode}</h3>
        <p className="tl-date">{dateText}</p>
        {excerpt ? <p className="tl-excerpt">{excerpt}</p> : null}
        {chips ? <div className="tl-chips">{chips}</div> : null}
        {children}
      </div>
    </li>
  );
}
