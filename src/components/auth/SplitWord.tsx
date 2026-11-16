// One big word whose letters tumble in, then something lands after it: a
// bouncing dot, three dots dropped out of time ("dots"), or an exclamation
// mark ("bang"). Give it a `key` of the word so it replays when it changes.
export function SplitWord({ word, end = "dot" }: { word: string; end?: "dot" | "dots" | "bang" }) {
  const chars = Array.from(end === "bang" ? `${word}!` : word);
  const mid = (chars.length - 1) / 2;
  const DOTS = [
    { "--dt": "1.9s", "--dd": "0s" },
    { "--dt": "2.6s", "--dd": "0.5s" },
    { "--dt": "3.3s", "--dd": "1.1s" },
  ];
  return (
    <h1 className="split-word" aria-label={end === "bang" ? `${word}!` : end === "dots" ? `${word}...` : word}>
      {chars.map((c, i) => (
        <span
          key={i}
          aria-hidden="true"
          className={`split-word__char ${end === "bang" && i === chars.length - 1 ? "split-word__bang" : ""}`}
          style={{ "--i": i, "--k": (i - mid) / Math.max(mid, 1) } as React.CSSProperties}
        >
          {c === " " ? "\u00a0" : c}
        </span>
      ))}
      {end === "dot" && <span className="split-word__dot" aria-hidden="true" />}
      {end === "dots" &&
        DOTS.map((d, i) => <span key={i} className="split-word__dot" aria-hidden="true" style={d as React.CSSProperties} />)}
    </h1>
  );
}
