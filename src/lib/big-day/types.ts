// Plain, serialisable shapes shared by the Big Day page and its board.

export const BIG_DAY_COLOURS = ["moss", "rose", "gold", "dusk", "lagoon", "plum", "ink"] as const;
export type BigDayColour = (typeof BIG_DAY_COLOURS)[number];

export const COLOUR_LABELS: Record<BigDayColour, string> = {
  moss: "Moss",
  rose: "Rose",
  gold: "Gold",
  dusk: "Dusk",
  lagoon: "Lagoon",
  plum: "Plum",
  ink: "Ink",
};

export type BigDayCost = {
  min: number | null;
  max: number | null;
  actual: number | null;
  currency: "GBP" | "EUR";
};

export type BigDayItem = {
  id: string;
  title: string;
  notes: string | null;
  day: string; // YYYY-MM-DD
  startTime: string | null; // HH:MM
  endTime: string | null; // HH:MM
  colour: BigDayColour;
  image: string | null; // already resolved: own image, else option cover, else idea image
  pageOptionId: string | null;
  ideaId: string | null;
  visibleToGuests: boolean;
  cost: BigDayCost | null; // null when there is no linked option or prices are hidden from this viewer
};

export type BigDaySource = {
  kind: "option" | "idea";
  id: string;
  title: string;
  subtitle: string | null;
  image: string | null;
  cost: BigDayCost | null;
};

export type BigDaySettings = {
  startDate: string | null;
  endDate: string | null;
  published: boolean;
};
