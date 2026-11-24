// Parametric line-art botanical generator: seeded, so each placement differs
// and none repeat. Drawn in the same language as the WW logo's bouquet: one
// even line, rounded ends, outlined almond leaves, loose uneven five-petal
// blooms with a dot centre, and the odd closed bud. Kept light and quiet; the
// sway is applied by whoever places it (see .canopy__stems, .backdrop__stem).

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
export type BotanicalShape = { d: string; width: number };
export type BotanicalDot = { x: number; y: number; r: number };
export type BotanicalGraph = {
  viewBox: string;
  /** open lines: stems */
  strokes: BotanicalStroke[];
  /** closed outlines with a faint fill: leaves, blooms, buds */
  shapes: BotanicalShape[];
  /** bloom centres */
  dots: BotanicalDot[];
};

type P = [number, number];
const f = (n: number) => Math.round(n * 100) / 100;

// A smooth closed curve through points (Catmull-Rom as cubic Béziers).
function closedCurve(pts: P[]) {
  const n = pts.length;
  let d = `M ${f(pts[0][0])} ${f(pts[0][1])}`;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
    const c1: P = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2: P = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C ${f(c1[0])} ${f(c1[1])} ${f(c2[0])} ${f(c2[1])} ${f(p2[0])} ${f(p2[1])}`;
  }
  return d + " Z";
}

// Loose bloom: rounded petal lobes of uneven size around a centre.
function bloom(cx: number, cy: number, R: number, rand: () => number) {
  const k = rand() > 0.75 ? 6 : 5;
  const step = (Math.PI * 2) / k;
  const start = rand() * step;
  const pts: P[] = [];
  for (let i = 0; i < k; i++) {
    const a = start + i * step + (rand() - 0.5) * step * 0.18;
    const r = R * (0.82 + rand() * 0.26);
    const notch = R * (0.42 + rand() * 0.12);
    pts.push([cx + Math.cos(a - step * 0.28) * r * 0.92, cy + Math.sin(a - step * 0.28) * r * 0.92]);
    pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
    pts.push([cx + Math.cos(a + step * 0.28) * r * 0.92, cy + Math.sin(a + step * 0.28) * r * 0.92]);
    pts.push([cx + Math.cos(a + step / 2) * notch, cy + Math.sin(a + step / 2) * notch]);
  }
  return closedCurve(pts);
}

// Closed bud: a small teardrop pointing along the stem.
function bud(cx: number, cy: number, R: number, ang: number) {
  const ux = Math.cos(ang), uy = Math.sin(ang), nx = -uy, ny = ux;
  const L = R * 1.35, W = R * 0.62;
  const tip: P = [cx + ux * L * 0.6, cy + uy * L * 0.6];
  const base: P = [cx - ux * L * 0.4, cy - uy * L * 0.4];
  return closedCurve([
    tip,
    [cx + nx * W, cy + ny * W],
    base,
    [cx - nx * W, cy - ny * W],
  ]);
}

// Almond leaf from a point on the stem, like the logo's: one fuller side.
function leaf(x: number, y: number, len: number, ang: number) {
  const ux = Math.cos(ang), uy = Math.sin(ang), nx = -uy, ny = ux;
  const tx = x + ux * len, ty = y + uy * len;
  const mx = (x + tx) / 2, my = (y + ty) / 2;
  const w = len * 0.42;
  return `M ${f(x)} ${f(y)} Q ${f(mx + nx * w)} ${f(my + ny * w)} ${f(tx)} ${f(ty)} Q ${f(mx - nx * w * 0.45)} ${f(my - ny * w * 0.45)} ${f(x)} ${f(y)} Z`;
}

export function generateBotanical({
  seed = 1,
  stems = 3,
  width = 160,
  height = 280,
  spread = 40,
}: BotanicalOptions = {}): BotanicalGraph {
  const rand = rng(seed * 97 + 13);
  const strokes: BotanicalStroke[] = [];
  const shapes: BotanicalShape[] = [];
  const dots: BotanicalDot[] = [];
  const baseX = width / 2;
  // Bloom size follows the drawing's size, within sensible limits.
  const R0 = Math.max(2.6, Math.min(13, Math.min(width, height) * 0.085));

  for (let i = 0; i < stems; i++) {
    const dir = i - (stems - 1) / 2;
    const len = height * (0.55 + rand() * 0.38);
    const sway = dir * spread * (0.4 + rand() * 0.6) + (rand() - 0.5) * 10;
    const R = R0 * (0.8 + rand() * 0.35);
    const x0 = baseX, y0 = height;
    const x1 = baseX + sway * 0.4, y1 = height - len * 0.5;
    // keep the head inside the drawing
    const x2 = Math.max(R + 2, Math.min(width - R - 2, baseX + sway));
    const y2 = Math.max(R + 2, height - len);
    const w = 1.05 + rand() * 0.45;

    // stem stops at the edge of its flower
    const dx = x2 - x1, dy = y2 - y1, dl = Math.hypot(dx, dy) || 1;
    const isBloom = rand() > 0.3;
    const gap = isBloom ? R * 0.55 : R * 0.45;
    const ex = x2 - (dx / dl) * gap, ey = y2 - (dy / dl) * gap;
    strokes.push({ d: `M ${f(x0)} ${f(y0)} Q ${f(x1)} ${f(y1)} ${f(ex)} ${f(ey)}`, width: w });

    // one or two leaves, alternating sides
    const leafCount = 1 + (rand() > 0.45 ? 1 : 0);
    for (let j = 0; j < leafCount; j++) {
      const t = 0.32 + j * 0.24 + rand() * 0.08;
      // point on the quadratic stem
      const lx = (1 - t) * (1 - t) * x0 + 2 * (1 - t) * t * x1 + t * t * ex;
      const ly = (1 - t) * (1 - t) * y0 + 2 * (1 - t) * t * y1 + t * t * ey;
      const side = (j + i) % 2 === 0 ? 1 : -1;
      const ang = -Math.PI / 2 + side * (0.75 + rand() * 0.35) + dir * 0.12;
      shapes.push({ d: leaf(lx, ly, R * (1.7 + rand() * 0.6), ang), width: w * 0.85 });
    }

    if (isBloom) {
      shapes.push({ d: bloom(x2, y2, R, rand), width: w * 0.85 });
      dots.push({ x: f(x2), y: f(y2), r: f(Math.max(0.7, R * 0.17)) });
    } else {
      shapes.push({ d: bud(x2, y2, R * 0.8, Math.atan2(dy, dx)), width: w * 0.85 });
    }
  }

  return { viewBox: `0 0 ${width} ${height}`, strokes, shapes, dots };
}
