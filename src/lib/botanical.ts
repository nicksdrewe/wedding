// Parametric line-art botanical generator — seeded, varies by placement and
// context. Replaces the earlier single static SVG: the same algorithm
// produces a dense ceremonial spray or a single quiet stem for an
// operational card, and no two placements repeat.

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export type BotanicalOptions = {
  seed?: number;
  stems?: number;
  width?: number;
  height?: number;
  spread?: number;
};

export type BotanicalStroke = { d: string; width: number };
export type BotanicalLeaf = { x: number; y: number; rx: number; ry: number; angle: number };
export type BotanicalGraph = {
  viewBox: string;
  strokes: BotanicalStroke[];
  leaves: BotanicalLeaf[];
};

export function generateBotanical({
  seed = 1,
  stems = 3,
  width = 160,
  height = 280,
  spread = 40,
}: BotanicalOptions = {}): BotanicalGraph {
  const rand = rng(seed * 97 + 13);
  const strokes: BotanicalStroke[] = [];
  const leaves: BotanicalLeaf[] = [];
  const baseX = width / 2;

  for (let i = 0; i < stems; i++) {
    const dir = i - (stems - 1) / 2;
    const len = height * (0.55 + rand() * 0.4);
    const sway = dir * spread * (0.4 + rand() * 0.6) + (rand() - 0.5) * 10;
    const x0 = baseX,
      y0 = height;
    const x1 = baseX + sway * 0.4,
      y1 = height - len * 0.5;
    const x2 = baseX + sway,
      y2 = height - len;
    const w = 1.1 + rand() * 0.7;
    strokes.push({ d: `M ${x0} ${y0} Q ${x1} ${y1} ${x2} ${y2}`, width: w });

    const leafCount = 2 + Math.floor(rand() * 3);
    for (let j = 0; j < leafCount; j++) {
      const t = (j + 1) / (leafCount + 1);
      const lx = x0 + (x2 - x0) * t + (rand() - 0.5) * 6;
      const ly = y0 + (y2 - y0) * t;
      leaves.push({
        x: lx,
        y: ly,
        rx: 5 + rand() * 4,
        ry: 2.4 + rand() * 2,
        angle: dir * 30 + rand() * 24 - 12,
      });
    }
    if (rand() > 0.4) {
      leaves.push({ x: x2, y: y2, rx: 3.2 + rand() * 1.6, ry: 3.2 + rand() * 1.6, angle: 0 });
    }
  }

  return { viewBox: `0 0 ${width} ${height}`, strokes, leaves };
}
