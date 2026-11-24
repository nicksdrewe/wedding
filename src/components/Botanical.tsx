import { generateBotanical, type BotanicalOptions } from "@/lib/botanical";

export function Botanical({
  seed = 1,
  stems = 3,
  width = 160,
  height = 280,
  spread = 40,
  color = "var(--color-accent)",
  strokeOpacity = 0.85,
  fillOpacity = 0.45,
  className,
  style,
}: BotanicalOptions & {
  color?: string;
  strokeOpacity?: number;
  fillOpacity?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  const g = generateBotanical({ seed, stems, width, height, spread });

  return (
    <svg
      viewBox={g.viewBox}
      width={width}
      height={height}
      className={className}
      style={style}
      aria-hidden="true"
      overflow="visible"
    >
      <g fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round" opacity={strokeOpacity}>
        {g.strokes.map((s, i) => (
          <path key={`s${i}`} d={s.d} strokeWidth={s.width} />
        ))}
      </g>
      {/* leaves, blooms and buds: a whisper of fill inside a clean outline */}
      <g fill={color} fillOpacity={fillOpacity * 0.5}>
        {g.shapes.map((s, i) => (
          <path key={`f${i}`} d={s.d} />
        ))}
      </g>
      <g fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round" opacity={strokeOpacity}>
        {g.shapes.map((s, i) => (
          <path key={`o${i}`} d={s.d} strokeWidth={s.width} />
        ))}
      </g>
      <g fill={color} opacity={strokeOpacity}>
        {g.dots.map((d, i) => (
          <circle key={`d${i}`} cx={d.x} cy={d.y} r={d.r} />
        ))}
      </g>
    </svg>
  );
}
