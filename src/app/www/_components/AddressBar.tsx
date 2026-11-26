"use client";

import { useEffect, useState } from "react";
import { PALETTES } from "@/lib/wedding/theme";

// The hero picture: a phone-sized wedding site whose address and names change,
// one couple after another, each in a different palette.
const COUPLES = [
  { one: "Jon", two: "Sarah", date: "Saturday 12 June 2027", palette: "garden" },
  { one: "Priya", two: "Sam", date: "Summer 2027", palette: "blush" },
  { one: "Ellis", two: "Morgan", date: "4 September 2027", palette: "coastal" },
  { one: "Aoife", two: "Tom", date: "Autumn 2027", palette: "golden" },
  { one: "Kemi", two: "Dan", date: "Spring 2028", palette: "lavender" },
];

const slugOf = (c: (typeof COUPLES)[number]) => `${c.one}${c.two}`.toLowerCase();

export function AddressBar() {
  const [i, setI] = useState(0);
  const [typed, setTyped] = useState(slugOf(COUPLES[0]).length);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let n = 0;
    let t: ReturnType<typeof setTimeout>;
    const next = () => {
      n = (n + 1) % COUPLES.length;
      setI(n);
      setTyped(0);
      const full = slugOf(COUPLES[n]).length;
      let k = 0;
      const type = () => {
        k++;
        setTyped(k);
        if (k < full) t = setTimeout(type, 70);
        else t = setTimeout(next, 3200);
      };
      t = setTimeout(type, 250);
    };
    t = setTimeout(next, 3400);
    return () => clearTimeout(t);
  }, []);

  const c = COUPLES[i];
  const p = PALETTES.find((x) => x.id === c.palette) ?? PALETTES[0];
  const slug = slugOf(c);

  return (
    <div
      className="ww-device"
      style={
        {
          "--d-cream": p.base.cream,
          "--d-paper": p.base.paper,
          "--d-ink": p.base.forest,
          "--d-a": p.sections.planning,
          "--d-b": p.sections.people,
          "--d-c": p.sections.money,
        } as React.CSSProperties
      }
      aria-label="Example: a couple's wedding site at their own address"
      role="img"
    >
      <div className="ww-device-bar">
        <span className="ww-lock" aria-hidden="true" />
        <span className="ww-url">
          <b>{slug.slice(0, typed)}</b>
          <span className="ww-caret" aria-hidden="true" />
          .weddingsweddings.co.uk
        </span>
      </div>
      <div className="ww-device-body" key={i}>
        <p className="ww-d-date">{c.date}</p>
        <p className="ww-d-names">
          {c.one}
          <span>&amp;</span>
          {c.two}
        </p>
        <span className="ww-d-btn">RSVP</span>
        <div className="ww-d-cards">
          <span style={{ background: "var(--d-a)" }}>Planning</span>
          <span style={{ background: "var(--d-b)" }}>Guests</span>
          <span style={{ background: "var(--d-c)" }}>Budget</span>
        </div>
        <div className="ww-d-lines">
          <i />
          <i />
          <i />
        </div>
      </div>
    </div>
  );
}
