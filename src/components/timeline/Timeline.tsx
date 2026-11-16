import type { ReactNode } from "react";
import { TimelineItem, type TimelineTier } from "./TimelineItem";

export type TimelineEntry = {
  id: string;
  // ISO date ("2026-11-16") or timestamp.
  date: string;
  title: string;
  excerpt?: string | null;
  tier: TimelineTier;
  icon?: ReactNode;
  href?: string;
  chips?: ReactNode;
  // Extra content under the excerpt (actions, expandable body...).
  children?: ReactNode;
  highlight?: boolean;
  // Replaces the date line (e.g. "Upcoming · 3 Jun 2027").
  dateLabel?: string;
};

function monthKey(date: string) {
  return date.slice(0, 7);
}

function monthLabel(date: string) {
  const d = new Date(date.length === 10 ? `${date}T12:00:00Z` : date);
  return d.toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "Europe/London" });
}

// A vertical spine with cards either side (alternating on desktop, one column
// on phones). Items are rendered in the order given; month dividers appear
// where the month changes. Pure markup, so it works in server and client
// components alike.
export function Timeline({ items, className = "" }: { items: TimelineEntry[]; className?: string }) {
  let side: "left" | "right" = "left";
  let lastMonth = "";
  const out: ReactNode[] = [];

  items.forEach((item, i) => {
    const key = monthKey(item.date);
    if (key !== lastMonth) {
      lastMonth = key;
      out.push(
        <li key={`m-${key}-${i}`} className="tl-month" aria-hidden="true">
          <span>{monthLabel(item.date)}</span>
        </li>
      );
    }
    let itemSide: "left" | "right" | "center" = "center";
    if (item.tier !== "milestone") {
      itemSide = side;
      side = side === "left" ? "right" : "left";
    }
    out.push(
      <TimelineItem key={item.id} {...item} side={itemSide} index={i}>
        {item.children}
      </TimelineItem>
    );
  });

  return <ol className={`tl ${className}`}>{out}</ol>;
}
