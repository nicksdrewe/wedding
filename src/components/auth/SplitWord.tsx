// One big word whose letters tumble in, then a dot bounces in and lands after
// it (a nod to the "Splitting" animation). Give it a `key` of the word so it
// replays when the word changes.
export function SplitWord({ word }: { word: string }) {
  const chars = Array.from(word);
  const mid = (chars.length - 1) / 2;
  return (
    <h1 className="split-word" aria-label={word}>
      {chars.map((c, i) => (
        <span
          key={i}
          aria-hidden="true"
          className="split-word__char"
          style={{ "--i": i, "--k": (i - mid) / Math.max(mid, 1) } as React.CSSProperties}
        >
          {c === " " ? " " : c}
        </span>
      ))}
      <span className="split-word__dot" aria-hidden="true" />
    </h1>
  );
}
