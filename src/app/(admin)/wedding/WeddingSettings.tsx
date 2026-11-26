"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Moon, Sun, Check } from "lucide-react";
import { PALETTES, SECTIONS, type WeddingTheme } from "@/lib/wedding/theme";
import { saveGateCodes, saveTheme, saveWeddingDetails } from "@/lib/wedding/actions";
import { ROOT_DOMAIN } from "@/lib/wedding/host";

const SECTION_LABEL: Record<(typeof SECTIONS)[number], string> = {
  planning: "Planning",
  people: "People",
  money: "Money",
  diary: "Diary",
  comms: "Comms",
  party: "Party",
};

export function WeddingSettings(props: {
  slug: string;
  partnerOne: string;
  partnerTwo: string;
  dateLabel: string;
  weddingDate: string;
  theme: WeddingTheme;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ where: string; text: string; ok: boolean } | null>(null);

  const [p1, setP1] = useState(props.partnerOne);
  const [p2, setP2] = useState(props.partnerTwo);
  const [dateLabel, setDateLabel] = useState(props.dateLabel);
  const [weddingDate, setWeddingDate] = useState(props.weddingDate);

  const [palette, setPalette] = useState(props.theme.palette ?? "garden");
  const [mode, setMode] = useState<"light" | "dark">(props.theme.mode === "dark" ? "dark" : "light");
  const [accent, setAccent] = useState<string | null>(props.theme.accent ?? null);

  const [codes, setCodes] = useState("");

  const done = (where: string, error: string | null, okText: string) => {
    setMsg({ where, text: error ?? okText, ok: !error });
    if (!error) router.refresh();
  };

  const note = (where: string) =>
    msg?.where === where ? (
      <p className={`mt-3 font-reading text-[13px] ${msg.ok ? "text-sec" : "text-alert"}`}>{msg.text}</p>
    ) : null;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-1 pb-16">
      {/* Names and date */}
      <section className="surface surface-raised p-6">
        <h2 className="font-title text-[22px]">Names and date</h2>
        <p className="mt-1 font-reading text-[13px] text-ink-soft">
          Shown everywhere: the front page, the menu, emails and the phone app. Your address is{" "}
          <span className="font-ui text-ink">{props.slug}.{ROOT_DOMAIN}</span>.
        </p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5">
            <span className="font-ui text-[12px] font-semibold tracking-[0.06em] text-ink-soft uppercase">First name</span>
            <input className="field" value={p1} onChange={(e) => setP1(e.target.value)} maxLength={40} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="font-ui text-[12px] font-semibold tracking-[0.06em] text-ink-soft uppercase">Second name</span>
            <input className="field" value={p2} onChange={(e) => setP2(e.target.value)} maxLength={40} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="font-ui text-[12px] font-semibold tracking-[0.06em] text-ink-soft uppercase">Wedding date</span>
            <input className="field" type="date" value={weddingDate} onChange={(e) => setWeddingDate(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="font-ui text-[12px] font-semibold tracking-[0.06em] text-ink-soft uppercase">Or say it in words</span>
            <input className="field" placeholder="Summer 2028" value={dateLabel} onChange={(e) => setDateLabel(e.target.value)} maxLength={40} />
          </label>
        </div>
        <p className="mt-3 font-reading text-[13px] text-ink-soft">
          Shown as <span className="font-title text-ink">{p1 || "…"} &amp; {p2 || "…"}</span>
          {dateLabel || weddingDate ? <> · {dateLabel || weddingDate}</> : null}
        </p>
        <button
          type="button"
          className="btn btn-sec mt-5"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await saveWeddingDetails({ partnerOne: p1, partnerTwo: p2, dateLabel, weddingDate });
              done("details", r.error, "Saved.");
            })
          }
        >
          Save names and date
        </button>
        {note("details")}
      </section>

      {/* Look */}
      <section className="surface surface-raised p-6">
        <h2 className="font-title text-[22px]">Colours</h2>
        <p className="mt-1 font-reading text-[13px] text-ink-soft">
          Each part of the site has its own colour (planning, people, money and so on), used for its glows, buttons and
          flowers. Pick the set that feels like you.
        </p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {PALETTES.map((p) => {
            const on = palette === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setPalette(p.id)}
                aria-pressed={on}
                className={`relative rounded-[18px] border p-4 text-left transition ${
                  on ? "border-[var(--sec)] shadow-[0_0_0_3px_var(--sec-tint)]" : "border-ink/10 hover:border-ink/25"
                }`}
                style={{ background: p.base.paper }}
              >
                <div className="flex items-center justify-between">
                  <span className="font-title text-[17px]" style={{ color: p.base.forest }}>
                    {p.name}
                  </span>
                  {on && <Check className="h-4 w-4 text-sec" strokeWidth={2.5} aria-hidden="true" />}
                </div>
                <div className="mt-3 flex gap-1.5">
                  {SECTIONS.map((s) => (
                    <span
                      key={s}
                      title={SECTION_LABEL[s]}
                      className="h-6 flex-1 rounded-full"
                      style={{ background: p.sections[s] }}
                    />
                  ))}
                </div>
                <div className="mt-2 flex gap-1.5">
                  <span className="h-3 flex-1 rounded-full border border-black/5" style={{ background: p.base.cream }} />
                  <span className="h-3 flex-1 rounded-full" style={{ background: p.base.forest }} />
                </div>
                <p className="mt-2 font-reading text-[12px]" style={{ color: p.base.forest, opacity: 0.75 }}>
                  {p.blurb}
                </p>
              </button>
            );
          })}
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <span className="font-ui text-[12px] font-semibold tracking-[0.06em] text-ink-soft uppercase">Mode</span>
          <div className="inline-flex rounded-full border border-ink/15 p-1">
            {(["light", "dark"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                aria-pressed={mode === m}
                className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 font-ui text-[13px] transition ${
                  mode === m ? "bg-sec text-white" : "text-ink-soft hover:text-ink"
                }`}
              >
                {m === "light" ? <Sun className="h-3.5 w-3.5" aria-hidden="true" /> : <Moon className="h-3.5 w-3.5" aria-hidden="true" />}
                {m === "light" ? "Day" : "Night garden"}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <span className="font-ui text-[12px] font-semibold tracking-[0.06em] text-ink-soft uppercase">Main colour</span>
          <input
            type="color"
            value={accent ?? PALETTES.find((p) => p.id === palette)!.sections.planning}
            onChange={(e) => setAccent(e.target.value)}
            className="h-9 w-14 cursor-pointer rounded-lg border border-ink/15 bg-paper"
            aria-label="Main colour"
          />
          {accent && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAccent(null)}>
              Use the palette&rsquo;s own
            </button>
          )}
          <span className="font-reading text-[12px] text-ink-soft">Optional: replaces the planning colour, the one most pages use.</span>
        </div>

        <button
          type="button"
          className="btn btn-sec mt-6"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await saveTheme({ palette, mode, accent });
              done("theme", r.error, "Saved. The whole site now uses these colours.");
            })
          }
        >
          Save colours
        </button>
        {note("theme")}
      </section>

      {/* Access code */}
      <section className="surface surface-raised p-6">
        <h2 className="font-title text-[22px]">Front page access code</h2>
        <p className="mt-1 font-reading text-[13px] text-ink-soft">
          Guests type this to open your front page (put it on your invitations). Separate several with commas. Leave it
          empty and save to remove the code altogether. For privacy the current codes aren&rsquo;t shown here.
        </p>
        <input
          className="field mt-4 w-full"
          placeholder="e.g. JS2029"
          value={codes}
          onChange={(e) => setCodes(e.target.value)}
          maxLength={200}
        />
        <button
          type="button"
          className="btn btn-quiet mt-4"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await saveGateCodes(codes);
              done("codes", r.error, codes.trim() ? "Saved. Guests now use the new code." : "Saved. Your front page no longer asks for a code.");
            })
          }
        >
          Save access code
        </button>
        {note("codes")}
      </section>
    </div>
  );
}
