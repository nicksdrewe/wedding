"use client";

import { useState } from "react";
import { SECTION_LABEL, type SectionKey } from "@/lib/design/sections";

// Style-guide only: flips the whole shell between the parts of the site so
// each bloom colour can be seen on the real backdrop, header and components.
export function SectionSwitcher() {
  const [current, setCurrent] = useState<SectionKey>("planning");
  return (
    <div className="flex flex-wrap gap-2">
      {(Object.keys(SECTION_LABEL) as SectionKey[]).map((key) => (
        <button
          key={key}
          type="button"
          aria-pressed={current === key}
          onClick={() => {
            setCurrent(key);
            document.querySelector<HTMLElement>("[data-shell]")?.setAttribute("data-section", key);
          }}
          className={`btn btn-sm ${current === key ? "btn-sec" : "btn-quiet"}`}
        >
          {SECTION_LABEL[key]}
        </button>
      ))}
    </div>
  );
}
