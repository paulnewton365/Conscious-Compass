// ─────────────────────────────────────────────────────────────
// TRUST & CREDIBILITY LENS: view model for report section 06.
//
// Wraps computeTrustLenses with exactly what the export's markup needs:
// column heights, labels, classes and the scale positions. Lens scores are
// never recomputed here; this only lays them out.
// ─────────────────────────────────────────────────────────────

import { computeTrustLenses } from '../data/rubric.js';

// The tallest weight in the rubric is 40%, so lens columns read against 40.
export const WEIGHT_CEILING = 40;

const pct = (n) => `${Math.round(n * 100) / 100}%`;
const clamp = (n) => Math.max(0, Math.min(100, n));

// The scale window holds whatever the scores actually are. A fixed window
// pinned strong brands at the right edge, so it is sized to the lens scores
// and the Compass overall, padded by 5 and never narrower than 20 points.
export function scaleWindow(scores) {
  const set = scores.filter(Number.isFinite);
  if (!set.length) return { lo: 0, hi: 100, mid: 50 };
  let lo = Math.max(0, Math.floor(Math.min(...set) / 5) * 5 - 5);
  let hi = Math.min(100, Math.ceil(Math.max(...set) / 5) * 5 + 5);
  if (hi - lo < 20) {
    const m = (hi + lo) / 2;
    lo = Math.max(0, Math.min(80, Math.round((m - 10) / 5) * 5));
    hi = lo + 20;
  }
  return { lo, hi, mid: Math.round((lo + hi) / 2) };
}

export function trustLensView(scores, findings = [], overall) {
  const data = computeTrustLenses(scores, findings);
  if (!data) return null;
  const hasOverall = Number.isFinite(overall);
  const win = scaleWindow([...data.rows, data.foundation].map(r => r.score).concat(hasOverall ? [overall] : []));
  const at = (v) => clamp(((v - win.lo) / (win.hi - win.lo)) * 100);

  const reach = data.reach.map(a => ({
    id: a.id,
    code: a.code,
    height: pct((a.count / a.total) * 100),
    value: `${a.count}/${a.total}`,
    state: a.count === a.total ? 'is-full' : a.count === 0 ? 'is-zero' : '',
    label: `${a.name}: feeds ${a.count} of ${a.total} lenses`,
  }));

  const lens = (row) => ({
    id: row.id,
    name: row.name,
    def: row.def,
    score: row.score,
    lead: `Led by ${row.leadName}, ${row.leadPct}%`,
    scale: {
      label: `${row.name} ${row.score} on a ${win.lo} to ${win.hi} scale${hasOverall ? `; Compass overall ${overall}` : ''}`,
      overallLeft: hasOverall ? pct(at(overall)) : null,
      scoreLeft: pct(at(row.score)),
      ticks: [win.lo, win.mid, win.hi],
      meta: `${win.lo}–${win.hi} scale${hasOverall ? ` · tick = Compass overall ${overall}` : ''}`,
    },
    columns: row.contributions.map(c => ({
      id: c.id,
      code: c.code,
      height: pct((c.weight / WEIGHT_CEILING) * 100),
      value: c.weight ? `${c.weight}%` : '0',
      state: c.weight ? '' : 'is-zero',
      label: `${c.name}: ${c.weight}% weight`,
    })),
  });

  return {
    reachNote: data.reachNote,
    reach,
    rows: data.rows.map(lens),
    foundation: lens(data.foundation),
    findings: Array.isArray(data.findings) ? data.findings : [],
  };
}
