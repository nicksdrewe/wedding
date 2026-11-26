"use client";

import { useState } from "react";
import { PALETTES, SECTIONS } from "@/lib/wedding/theme";

const LABELS: Record<(typeof SECTIONS)[number], string> = {
  planning: "Planning",
  people: "Guests",
  money: "Budget",
  diary: "Diary",
  comms: "Messages",
  party: "Party",
};

// Try the palettes: the little site card recolours, and day/night swaps its ground.
export function PaletteDemo() {
  const [id, setId] = useState("garden");
  const [night, setNight] = useState(false);
  const p = PALETTES.find((x) => x.id === id) ?? PALETTES[0];

  return (
    <div className="ww-palette">
      <div className="ww-swatches" role="radiogroup" aria-label="Palette">
        {PALETTES.map((x) => (
          <button
            key={x.id}
            type="button"
            role="radio"
            aria-checked={x.id === id}
            className="ww-swatch"
            onClick={() => setId(x.id)}
          >
            <span className="ww-swatch-dots" aria-hidden="true">
              {SECTIONS.slice(0, 4).map((s) => (
                <i key={s} style={{ background: x.sections[s] }} />
              ))}
            </span>
            {x.name}
          </button>
        ))}
      </div>
      <div className="ww-mode" role="radiogroup" aria-label="Day or night">
        <button type="button" role="radio" aria-checked={!night} onClick={() => setNight(false)}>
          Day garden
        </button>
        <button type="button" role="radio" aria-checked={night} onClick={() => setNight(true)}>
          Night garden
        </button>
      </div>

      <div
        className="ww-preview"
        style={
          {
            "--p-ground": night ? p.base.night : p.base.cream,
            "--p-card": night ? `color-mix(in srgb, ${p.base.forest} 70%, ${p.base.night})` : p.base.paper,
            "--p-ink": night ? p.base.cream : p.base.forest,
          } as React.CSSProperties
        }
      >
        <p className="ww-preview-names">Jon &amp; Sarah</p>
        <p className="ww-preview-blurb">{p.blurb}</p>
        <div className="ww-preview-grid">
          {SECTIONS.map((s) => (
            <span
              key={s}
              style={
                {
                  "--c": p.sections[s],
                } as React.CSSProperties
              }
            >
              <i />
              {LABELS[s]}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
