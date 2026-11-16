// Which part of the site a page belongs to. Each part has its own "bloom"
// colour (the --sec variables in globals.css): the backdrop light, the page
// header's glow, focus rings and section accents all follow it, so moving
// between parts of the site feels like walking into a different bed of the
// same garden. Pure and client-safe.

export type SectionKey = "planning" | "people" | "money" | "diary" | "comms" | "party";

export const SECTION_LABEL: Record<SectionKey, string> = {
  planning: "Planning",
  people: "People",
  money: "Money",
  diary: "Diary",
  comms: "Comms",
  party: "Stag & hen",
};

// Most specific first.
const RULES: [prefix: string, section: SectionKey][] = [
  ["/project/expenses", "money"],
  ["/project/groomsmen", "party"],
  ["/project/bridesmaids", "party"],
  ["/budget", "money"],
  ["/guests", "people"],
  ["/access", "people"],
  ["/errors", "people"],
  ["/comms", "comms"],
  ["/diary", "diary"],
  ["/big-day", "diary"],
];

export function sectionFor(pathname: string): SectionKey {
  for (const [prefix, section] of RULES) {
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) return section;
  }
  return "planning";
}
