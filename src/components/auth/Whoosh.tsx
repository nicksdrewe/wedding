// The way in. "cinematic" sweeps bands of the site colours across the screen
// before the page opens (first time in); "quick" is just a soft fade (every
// sign-in after that).
const BANDS = ["#1d2a21", "#4c6b52", "#a8475a", "#9cc4a4", "#86641a", "#f4f1ec"];

export function Whoosh({ mode }: { mode: "cinematic" | "quick" }) {
  return (
    <div className={`whoosh ${mode === "quick" ? "whoosh--quick" : ""}`} aria-hidden="true">
      {mode === "cinematic" &&
        BANDS.map((c, n) => <span key={n} className="whoosh__bar" style={{ "--n": n, "--c": c } as React.CSSProperties} />)}
      <span className="whoosh__cover" />
    </div>
  );
}
