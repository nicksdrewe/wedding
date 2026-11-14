"use client";

import { useState } from "react";
import { normalizeTags, parseTagInput, ROLE_TAG_VALUES, ROLE_TAGS, tagLabel } from "@/lib/tags";

// One-tap toggles for the four tags that carry access meaning, plus a free
// text box for any other label. Submits a single comma-separated "tags"
// field, exactly what updateContact already expects, so the server action is
// unchanged; the action normalises it again regardless.
export function TagPicker({ defaultTags }: { defaultTags: string[] }) {
  const initial = normalizeTags(defaultTags);
  const [roleTags, setRoleTags] = useState<string[]>(initial.filter((t) => ROLE_TAG_VALUES.includes(t)));
  const [other, setOther] = useState(
    initial
      .filter((t) => !ROLE_TAG_VALUES.includes(t))
      .map(tagLabel)
      .join(", ")
  );

  function toggle(value: string) {
    setRoleTags((cur) => (cur.includes(value) ? cur.filter((t) => t !== value) : [...cur, value]));
  }

  const combined = [...roleTags, ...parseTagInput(other)].join(",");

  return (
    <div className="flex flex-col gap-2">
      <input type="hidden" name="tags" value={combined} />
      <div className="flex flex-wrap gap-1.5">
        {ROLE_TAGS.map((t) => {
          const on = roleTags.includes(t.value);
          return (
            <button
              key={t.value}
              type="button"
              onClick={() => toggle(t.value)}
              aria-pressed={on}
              className={`rounded-full border px-3 py-1.5 font-serif text-xs transition-colors ${
                on
                  ? "border-accent bg-accent text-cream"
                  : "border-ink/20 bg-cream text-ink-soft hover:border-ink/40"
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>
      <input
        value={other}
        onChange={(e) => setOther(e.target.value)}
        placeholder="Other tags, comma separated"
        className="rounded-full border border-ink/20 bg-cream px-4 py-2 text-sm outline-none transition-colors duration-150 focus:border-accent"
      />
    </div>
  );
}
