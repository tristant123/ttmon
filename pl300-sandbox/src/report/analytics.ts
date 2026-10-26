// Analytics features: forecasting (exponential smoothing with optional seasonality), anomaly detection,
// k-means clustering, and the statistics behind "Analyze › Explain the increase / decrease".

/** Detect a seasonal period from autocorrelation (2…n/2), or 0 when none stands out. */
export function detectSeason(ys: number[]): number {
  const n = ys.length; if (n < 8) return 0;
  const mean = ys.reduce((a, b) => a + b, 0) / n;
  const den = ys.reduce((a, y) => a + (y - mean) ** 2, 0) || 1;
  let best = 0, bestR = 0.3;
  for (let lag = 2; lag <= Math.floor(n / 2); lag++) {
    let num = 0; for (let i = lag; i < n; i++) num += (ys[i] - mean) * (ys[i - lag] - mean);
    const r = num / den;
    if (r > bestR) { bestR = r; best = lag; }
  }
  return best;
}

/** Holt-Winters (additive) forecast with a confidence band. */
export function forecast(ys: number[], horizon: number, opts: { season?: number; confidence?: number } = {}) {
  const n = ys.length;
  if (n < 3) return { point: [] as number[], lower: [] as number[], upper: [] as number[], season: 0 };
  const m = opts.season === undefined ? detectSeason(ys) : opts.season;
  const useSeason = m >= 2 && n >= 2 * m;
  const alpha = 0.4, beta = 0.1, gamma = 0.3;
  let level = ys[0], trend = n > 1 ? ys[1] - ys[0] : 0;
  const seas: number[] = new Array(Math.max(m, 1)).fill(0);
  if (useSeason) {
    const first = ys.slice(0, m).reduce((a, b) => a + b, 0) / m;
    for (let i = 0; i < m; i++) seas[i] = ys[i] - first;
    level = first; trend = (ys.slice(m, 2 * m).reduce((a, b) => a + b, 0) / m - first) / m;
  }
  const resid: number[] = [];
  for (let t = 1; t < n; t++) {
    const s = useSeason ? seas[t % m] : 0;
    const fit = level + trend + s;
    resid.push(ys[t] - fit);
    const prevLevel = level;
    level = alpha * (ys[t] - s) + (1 - alpha) * (level + trend);
    trend = beta * (level - prevLevel) + (1 - beta) * trend;
    if (useSeason) seas[t % m] = gamma * (ys[t] - level) + (1 - gamma) * s;
  }
  const sd = Math.sqrt(resid.reduce((a, r) => a + r * r, 0) / Math.max(1, resid.length - 1));
  const z = { 0.75: 1.15, 0.8: 1.28, 0.85: 1.44, 0.9: 1.645, 0.95: 1.96, 0.99: 2.576 }[opts.confidence ?? 0.95] ?? 1.96;
  const point: number[] = [], lower: number[] = [], upper: number[] = [];
  for (let h = 1; h <= horizon; h++) {
    const p = level + h * trend + (useSeason ? seas[(n - 1 + h) % m] : 0);
    const w = z * sd * Math.sqrt(h);
    point.push(p); lower.push(p - w); upper.push(p + w);
  }
  return { point, lower, upper, season: useSeason ? m : 0 };
}

/** Points that fall outside the expected range (rolling median ± k·MAD); sensitivity 0–100. */
export function anomalies(ys: (number | null)[], sensitivity = 70) {
  const k = 1.5 + (100 - sensitivity) / 100 * 4.5;
  const out: { i: number; expected: number; low: number; high: number }[] = [];
  const vals = ys.map(y => (y === null ? NaN : y));
  const win = Math.max(3, Math.min(12, Math.floor(vals.length / 4)));
  const ranges = vals.map((_, i) => {
    const w = vals.slice(Math.max(0, i - win), Math.min(vals.length, i + win + 1)).filter((x, j, a) => !Number.isNaN(x) && a !== undefined);
    const others = w.length > 2 ? w : vals.filter(x => !Number.isNaN(x));
    const sorted = [...others].sort((a, b) => a - b); const med = sorted[Math.floor(sorted.length / 2)] ?? 0;
    const mad = [...others.map(x => Math.abs(x - med))].sort((a, b) => a - b)[Math.floor(others.length / 2)] || (Math.abs(med) * 0.05) || 1;
    return { expected: med, low: med - k * 1.4826 * mad, high: med + k * 1.4826 * mad };
  });
  vals.forEach((y, i) => { if (!Number.isNaN(y) && (y < ranges[i].low || y > ranges[i].high)) out.push({ i, ...ranges[i] }); });
  return { anomalies: out, ranges };
}

/** k-means on standardized 2-D points; k = 0 picks k by the elbow method. */
export function kmeans(points: [number, number][], k = 0): number[] {
  const n = points.length; if (!n) return [];
  const mx = points.reduce((a, p) => a + p[0], 0) / n, my = points.reduce((a, p) => a + p[1], 0) / n;
  const sx = Math.sqrt(points.reduce((a, p) => a + (p[0] - mx) ** 2, 0) / n) || 1, sy = Math.sqrt(points.reduce((a, p) => a + (p[1] - my) ** 2, 0) / n) || 1;
  const z = points.map(p => [(p[0] - mx) / sx, (p[1] - my) / sy]);
  const run = (kk: number) => {
    // deterministic init: spread along the sorted first coordinate
    const order = z.map((p, i) => i).sort((a, b) => z[a][0] + z[a][1] - z[b][0] - z[b][1]);
    let cent = Array.from({ length: kk }, (_, j) => [...z[order[Math.floor((j + 0.5) * n / kk)]]]);
    let asg = new Array(n).fill(0);
    for (let it = 0; it < 50; it++) {
      const na = z.map(p => { let b = 0, bd = Infinity; cent.forEach((c, j) => { const d = (p[0] - c[0]) ** 2 + (p[1] - c[1]) ** 2; if (d < bd) { bd = d; b = j; } }); return b; });
      const same = na.every((x, i) => x === asg[i]); asg = na;
      cent = cent.map((c, j) => { const m = z.filter((_, i) => asg[i] === j); return m.length ? [m.reduce((a, p) => a + p[0], 0) / m.length, m.reduce((a, p) => a + p[1], 0) / m.length] : c; });
      if (same && it > 0) break;
    }
    const sse = z.reduce((a, p, i) => a + (p[0] - cent[asg[i]][0]) ** 2 + (p[1] - cent[asg[i]][1]) ** 2, 0);
    return { asg, sse };
  };
  if (k > 0) return run(Math.min(k, n)).asg;
  const maxK = Math.min(8, n);
  const res = Array.from({ length: maxK }, (_, i) => run(i + 1));
  let best = Math.min(3, maxK) - 1;
  for (let i = 1; i < maxK - 1; i++) { const gain1 = res[i - 1].sse - res[i].sse, gain2 = res[i].sse - res[i + 1].sse; if (gain1 > 0 && gain2 < gain1 * 0.35) { best = i; break; } }
  return res[best].asg;
}

/** Rank how each category contributed to the change between two values. */
export function contributions(before: Map<string, number>, after: Map<string, number>) {
  const keys = new Set([...before.keys(), ...after.keys()]);
  return [...keys].map(k => ({ key: k, before: before.get(k) ?? 0, after: after.get(k) ?? 0, delta: (after.get(k) ?? 0) - (before.get(k) ?? 0) })).sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
}
