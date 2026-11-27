// A wedding's look: a palette (the six section colours plus the paper and
// night tones they sit on) and light or dark mode. Garden is the original
// site, exactly; the others are alternatives a couple can pick in settings.
// Glows and tints are worked out from each section colour, so a palette only
// needs its six main colours.

export const SECTIONS = ["planning", "people", "money", "diary", "comms", "party"] as const;
export type SectionKey = (typeof SECTIONS)[number];

export type Palette = {
  id: string;
  name: string;
  blurb: string;
  base: { cream: string; creamDeep: string; paper: string; forest: string; night: string };
  sections: Record<SectionKey, string>;
};

export const PALETTES: Palette[] = [
  {
    id: "garden",
    name: "Garden",
    blurb: "Sage, dusky rose and soft gold on warm cream. The original.",
    base: { cream: "#f4f1ec", creamDeep: "#ece7dc", paper: "#fffdf9", forest: "#1d2a21", night: "#131813" },
    sections: { planning: "#4c6b52", people: "#a8475a", money: "#86641a", diary: "#4f5d94", comms: "#2b6c70", party: "#7a4f86" },
  },
  {
    id: "blush",
    name: "Blush",
    blurb: "Rose and berry on a soft pink paper, with deep wine.",
    base: { cream: "#f7f0ef", creamDeep: "#efe3e2", paper: "#fffafa", forest: "#3a2329", night: "#1f1316" },
    sections: { planning: "#a4505f", people: "#8f4a7a", money: "#9a6c34", diary: "#5f6598", comms: "#4a7880", party: "#83569a" },
  },
  {
    id: "coastal",
    name: "Coastal",
    blurb: "Sea blues and teal on a cool white, with deep navy.",
    base: { cream: "#eef3f4", creamDeep: "#e1e9eb", paper: "#fbfdfd", forest: "#16313a", night: "#0d1c22" },
    sections: { planning: "#2f6a80", people: "#a4566a", money: "#8a7028", diary: "#3f5a9a", comms: "#2a7a74", party: "#665898" },
  },
  {
    id: "golden",
    name: "Golden hour",
    blurb: "Honey, terracotta and olive on a warm parchment.",
    base: { cream: "#f6efe2", creamDeep: "#ecdfc8", paper: "#fffbf3", forest: "#3a2a17", night: "#1e160c" },
    sections: { planning: "#86621e", people: "#a8513c", money: "#66702a", diary: "#4c6690", comms: "#3c7466", party: "#864c6a" },
  },
  {
    id: "lavender",
    name: "Lavender",
    blurb: "Lilac and plum on a pale violet paper.",
    base: { cream: "#f2eff6", creamDeep: "#e6e0ee", paper: "#fdfbff", forest: "#2a2340", night: "#161226" },
    sections: { planning: "#655696", people: "#a2547a", money: "#856628", diary: "#4a669c", comms: "#357680", party: "#86499c" },
  },
];

export type WeddingTheme = { palette?: string; mode?: "light" | "dark"; accent?: string | null };

export function paletteFor(theme: WeddingTheme | null | undefined): Palette {
  return PALETTES.find((p) => p.id === theme?.palette) ?? PALETTES[0];
}

const HEX = /^#[0-9a-f]{6}$/i;

/** CSS for a wedding's theme, or "" when it is the original garden in light
 *  mode. `always` gives the full set even then (the live preview in settings
 *  needs it to override whatever is saved). */
export function themeCss(theme: WeddingTheme | null | undefined, always = false): string {
  const p = paletteFor(theme);
  const dark = theme?.mode === "dark";
  const accent = theme?.accent && HEX.test(theme.accent) ? theme.accent : null;
  if (p.id === "garden" && !dark && !accent && !always) return "";

  const sections = { ...p.sections, ...(accent ? { planning: accent } : {}) };
  const paper = dark ? "#1e2620" : p.base.paper;
  const sec = (c: string) =>
    `--sec: ${dark ? `color-mix(in srgb, ${c} 70%, #ffffff)` : c}; ` +
    `--sec-glow: color-mix(in srgb, ${c} 55%, #ffffff); ` +
    `--sec-tint: color-mix(in srgb, ${c} ${dark ? "24%" : "12%"}, ${paper});`;

  const base = dark
    ? `--color-cream: color-mix(in srgb, ${p.base.night} 88%, #2a332c); --color-cream-deep: color-mix(in srgb, ${p.base.forest} 80%, #000000); ` +
      `--color-paper: color-mix(in srgb, ${p.base.forest} 82%, #2a332c); --color-ink: #ece7dc; --color-ink-soft: #b8b2a5; ` +
      `--color-forest: ${p.base.forest}; --color-night: ${p.base.night}; color-scheme: dark;`
    : `--color-cream: ${p.base.cream}; --color-cream-deep: ${p.base.creamDeep}; --color-paper: ${p.base.paper}; ` +
      `--color-forest: ${p.base.forest}; --color-night: ${p.base.night}; --color-ink: #232520; --color-ink-soft: #5b5a52; color-scheme: light;`;

  const rules = [`:root { ${base} ${sec(sections.planning)} --color-accent: ${sections.planning}; }`];
  for (const s of SECTIONS) rules.push(`[data-section="${s}"] { ${sec(sections[s])} }`);
  return rules.join("\n");
}
