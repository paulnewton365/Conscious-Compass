// ─────────────────────────────────────────────────────────────
// BENCHMARK COMPARISON: view model for report section 08 (v3.106.0).
//
// The benchmark group leaves the assessed brand out, so it is never compared
// with itself. Rank and percentile are therefore stated over n = the group
// plus the brand: the stored rank is the brand's place in that set (1 to n),
// and the percentile is round((n - rank) / (n - 1) x 100), clamped to 0-100,
// so first place is the 100th. Both are worked out here from what is saved,
// so reports saved before this change read correctly too. Before, the total
// shown left the brand out ("27th of 26") and the percentile was taken over
// the others only ("0th").
// ─────────────────────────────────────────────────────────────

import { ATTRIBUTES } from '../data/rubric.js';

const MINUS = '\u2212';
export const signed = (v) => (v > 0 ? `+${v}` : v < 0 ? `${MINUS}${Math.abs(v)}` : '0');
const clamp = (v, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));

export function ordinal(n) {
  if (n == null || !Number.isFinite(Number(n))) return '';
  const v = Math.abs(Math.round(Number(n)));
  const last2 = v % 100;
  if (last2 >= 11 && last2 <= 13) return `${v}th`;
  return `${v}${({ 1: 'st', 2: 'nd', 3: 'rd' })[v % 10] || 'th'}`;
}

export function benchmarkPosition(benchmark) {
  const others = Number(benchmark?.count);
  if (!Number.isFinite(others) || others < 1) return null;
  const n = others + 1;
  const raw = Number(benchmark.rank);
  const rank = Number.isFinite(raw) ? Math.max(1, Math.min(n, Math.round(raw))) : null;
  const percentile = rank ? Math.round(clamp(((n - rank) / (n - 1)) * 100)) : null;
  return { others, n, rank, percentile };
}

// Words that say what the group is: a sector, or all assessed brands when the
// sector had too few (cohort-aware wording).
export function cohortWords(benchmark) {
  const sector = benchmark?.scope === 'industry';
  return sector
    ? { avg: 'Sector avg', avgLong: 'sector average', rank: 'Rank in sector', group: `${benchmark.cohortLabel} brands`, rangeLong: 'sector range' }
    : { avg: 'Avg', avgLong: 'average across all assessed brands', rank: 'Rank among all brands', group: 'assessed brands', rangeLong: 'range across all assessed brands' };
}

// Radar geometry, as the export draws it: 480 x 400, centre (240, 200),
// radius 140, eight spokes clockwise from the top.
const CX = 240, CY = 200, R = 140;
const pt = (i, v) => {
  const a = (Math.PI * 2 * i) / ATTRIBUTES.length - Math.PI / 2;
  return [CX + Math.cos(a) * R * (v / 100), CY + Math.sin(a) * R * (v / 100)];
};
const pts = (vals) => vals.map((v, i) => pt(i, clamp(Number(v) || 0)).map(x => x.toFixed(1)).join(',')).join(' ');
export function radarGeometry(brandScores, avgScores) {
  const grid = [25, 50, 75, 100].map(level => pts(ATTRIBUTES.map(() => level)));
  const spokes = ATTRIBUTES.map((a, i) => {
    const [x2, y2] = pt(i, 100);
    const [lx, ly] = pt(i, 112);
    const anchor = Math.abs(lx - CX) < 1 ? 'middle' : lx > CX ? 'start' : 'end';
    return { id: a.id, name: a.name, x2: x2.toFixed(1), y2: y2.toFixed(1), lx: lx.toFixed(1), ly: ly.toFixed(1), anchor };
  });
  return {
    viewBox: '0 0 480 400', cx: CX, cy: CY, grid, spokes,
    subject: pts(ATTRIBUTES.map(a => brandScores[a.id])),
    bench: pts(ATTRIBUTES.map(a => avgScores[a.id])),
  };
}

// Everything section 08 draws, from the saved benchmark and the scores.
export function benchmarkView(benchmark, scores, overall, brand) {
  if (!benchmark) return null;
  const words = cohortWords(benchmark);
  const pos = benchmarkPosition(benchmark);
  const avg = Number(benchmark.avgScore);
  const range = benchmark.scoreRange && Number.isFinite(benchmark.scoreRange.min) && Number.isFinite(benchmark.scoreRange.max)
    ? benchmark.scoreRange : null;   // older saved reports: no band, never invented
  const brandScores = Object.fromEntries(ATTRIBUTES.map(a => [a.id, Number(scores?.[a.id]?.score) || 0]));
  const avgs = benchmark.attrAvgs || {};
  const rows = ATTRIBUTES.map(a => {
    const v = brandScores[a.id];
    const av = Number(avgs[a.id]);
    const rg = benchmark.attrRanges?.[a.id];
    const hasAvg = Number.isFinite(av);
    return {
      id: a.id, name: a.name, score: v,
      avg: hasAvg ? av : null,
      range: rg && Number.isFinite(rg.min) && Number.isFinite(rg.max) ? { left: rg.min, width: Math.max(0, rg.max - rg.min), min: rg.min, max: rg.max } : null,
      delta: hasAvg ? signed(v - av) : '',
      label: `${a.name}: ${brand} ${v}${hasAvg ? `, ${words.avgLong} ${av}` : ''}${rg ? `, ${words.rangeLong} ${rg.min} to ${rg.max}` : ''}`,
    };
  });
  return {
    words, pos, brand, overall, avg,
    range: range ? { left: range.min, width: Math.max(0, range.max - range.min), min: range.min, max: range.max } : null,
    vsAvg: Number.isFinite(avg) ? signed(overall - avg) : null,
    scaleLabel: `${brand} ${overall}${Number.isFinite(avg) ? `, ${words.avgLong} ${avg}` : ''}${range ? `, ${words.rangeLong} ${range.min} to ${range.max}` : ''}`,
    rows,
    radar: radarGeometry(brandScores, avgs),
  };
}
