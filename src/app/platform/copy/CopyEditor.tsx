"use client";

import { useMemo, useState, useTransition } from "react";
import { saveCopy } from "@/lib/platform/actions";

type Field = { key: string; group: string; label: string; value: string; long?: boolean; current: string };

export function CopyEditor({ fields }: { fields: Field[] }) {
  const [values, setValues] = useState(() => Object.fromEntries(fields.map((f) => [f.key, f.current])));
  const [base, setBase] = useState(values);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const groups = useMemo(() => [...new Set(fields.map((f) => f.group))], [fields]);
  const dirty = fields.filter((f) => values[f.key] !== base[f.key]).map((f) => f.key);

  return (
    <div className="pc-cards">
      {groups.map((g, gi) => (
        <section key={g} className="pc-card w6" style={{ animationDelay: `${gi * 40}ms` }}>
          <h2>{g}</h2>
          <div className="pc-stack" style={{ marginTop: 12 }}>
            {fields
              .filter((f) => f.group === g)
              .map((f) => {
                const changed = values[f.key] !== base[f.key];
                const edited = values[f.key] !== f.value;
                const Tag = f.long ? "textarea" : "input";
                return (
                  <label key={f.key} className="pc-field">
                    <span className="pc-row" style={{ justifyContent: "space-between" }}>
                      {f.label}
                      {edited && (
                        <button type="button" className="pc-btn small" onClick={() => setValues((v) => ({ ...v, [f.key]: f.value }))}>
                          Original
                        </button>
                      )}
                    </span>
                    <Tag
                      className={`${f.long ? "pc-textarea" : "pc-input"} ${changed ? "is-changed" : ""}`}
                      value={values[f.key]}
                      onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                    />
                  </label>
                );
              })}
          </div>
        </section>
      ))}
      <div
        className="pc-card"
        style={{ position: "sticky", bottom: 16, zIndex: 5, display: "flex", gap: 12, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", backdropFilter: "blur(10px)", background: "var(--pc-glass)" }}
      >
        <span className="pc-muted" aria-live="polite">
          {msg ? msg.text : dirty.length ? `${dirty.length} unsaved change${dirty.length === 1 ? "" : "s"}` : "Everything's saved."}
        </span>
        <div className="pc-row">
          <button className="pc-btn" disabled={!dirty.length || pending} onClick={() => setValues(base)}>
            Undo changes
          </button>
          <button
            className="pc-btn primary"
            disabled={!dirty.length || pending}
            onClick={() =>
              start(async () => {
                const r = await saveCopy(Object.fromEntries(dirty.map((k) => [k, values[k]])));
                if (r.ok) {
                  setBase(values);
                  setMsg({ ok: true, text: r.message ?? "Saved." });
                } else setMsg({ ok: false, text: r.error });
              })
            }
          >
            {pending ? "Saving…" : "Save and publish"}
          </button>
        </div>
      </div>
    </div>
  );
}
