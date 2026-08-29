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
    >
      {g.strokes.map((s, i) => (
        <path
          key={`s${i}`}
          d={s.d}
          stroke={color}
          strokeWidth={s.width}
          fill="none"
          strokeLinecap="round"
          opacity={strokeOpacity}
        />
      ))}
      {g.leaves.map((l, i) => (
        <ellipse
          key={`l${i}`}
          cx={l.x}
          cy={l.y}
          rx={l.rx}
          ry={l.ry}
          transform={`rotate(${l.angle} ${l.x} ${l.y})`}
          fill={color}
          opacity={fillOpacity}
        />
      ))}
    </svg>
  );
}
