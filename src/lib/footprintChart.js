// ─────────────────────────────────────────────────────────────
// BRAND FOOTPRINT: view model and chart geometry for report section 04.
//
// Everything the section draws is derived here from the scoring pass's
// footprint object, so the chart, the table and the sentences cannot
// disagree, and the geometry can be tested against the design export's
// own coordinates.
//
// Geometry is the export's (notes/04-brand-footprint.md). Channel angles are
// fixed, market on the right and brand on the left, so any two footprints
// can be read against each other.
// ─────────────────────────────────────────────────────────────

import { FOOTPRINT_CHANNELS, FOOTPRINT_VOICE, summariseFootprint, getPresenceLevel } from '../data/rubric.js';

export const C = { x: 340, y: 290 };
export const R = 205;
export const CORE_R = 62;
export const VIEWBOX = '-70 5 880 580';
export const CONSCIOUS_AT = 7;

// Degrees clockwise from north. Keyed by the rubric's channel ids.
export const ANGLES = {
  earned: 0, analyst: 40, thirdParty: 80, podcast: 120, ai: 160,
  paid: 220, owned: 270, social: 320,
};

// Group arcs and their labels are fixed in the export, at radius 263.
export const GROUPS = [
  { d: 'M317.1,28.0 A263,263 0 0 1 408.1,544.0', label: 'MARKET GENERATES →', x: '432.0', y: '37.2', anchor: 'start' },
  { d: 'M228.9,528.4 A263,263 0 0 1 228.9,51.6', label: '← BRAND CONTROLS', x: '248.0', y: '542.8', anchor: 'end' },
];

const f1 = (n) => n.toFixed(1);

export function nodeGeometry(id, score) {
  const a = ANGLES[id] * Math.PI / 180;
  const r = score ? 12 + score * 3.2 : 11;
  const d = [Math.sin(a), -Math.cos(a)];
  const L = R + r + 14;
  const lx = C.x + d[0] * L;
  const anchor = lx > C.x + 1 ? 'start' : lx < C.x - 1 ? 'end' : 'middle';
  // A label on the vertical axis sits directly above (or below) its node, so
  // the side-label baseline offset would crowd the circle. The export lifts
  // the north label 8 units clear of it; mirror that for the south.
  const dy = anchor === 'middle' ? (d[1] < 0 ? -4 : 12) : 4;
  return {
    cx: C.x + d[0] * R, cy: C.y + d[1] * R, r,
    spoke: {
      x1: C.x + d[0] * CORE_R, y1: C.y + d[1] * CORE_R,
      x2: C.x + d[0] * (R - r), y2: C.y + d[1] * (R - r),
    },
    label: { x: lx, y: C.y + d[1] * L + dy, anchor },
  };
}

export function linkPath(a, b) {
  const mx = (a.cx + b.cx) / 2, my = (a.cy + b.cy) / 2;
  const qx = mx + 0.45 * (C.x - mx), qy = my + 0.45 * (C.y - my);
  return `M${f1(a.cx)},${f1(a.cy)} Q${f1(qx)},${f1(qy)} ${f1(b.cx)},${f1(b.cy)}`;
}

// The brand name over two lines, broken at the space closest to the middle.
// Past 14 characters on the longer line the face steps down so the name
// stays inside the 124-unit core.
export function coreLines(name) {
  const clean = String(name || '').trim().replace(/\s+/g, ' ') || 'Brand';
  const words = clean.split(' ');
  let lines;
  if (words.length === 1) {
    lines = [clean];
  } else {
    const mid = clean.length / 2;
    let best = -1, bestDist = Infinity;
    for (let i = 0; i < clean.length; i++) {
      if (clean[i] === ' ' && Math.abs(i - mid) < bestDist) { best = i; bestDist = Math.abs(i - mid); }
    }
    lines = [clean.slice(0, best), clean.slice(best + 1)];
  }
  const longest = Math.max(...lines.map(l => l.length));
  const size = longest > 18 ? 'is-longer' : longest > 14 ? 'is-long' : '';
  const ys = lines.length === 1 ? [290] : [282, 302];
  return lines.map((text, i) => ({ text, y: ys[i], size }));
}

const isBrand = (id) => FOOTPRINT_VOICE.brand.includes(id);
const listJoin = (arr) => arr.length < 3 ? arr.join(' and ') : `${arr.slice(0, -1).join(', ')} and ${arr[arr.length - 1]}`;

// Links that point at real channels, one per unordered pair, strongest kept.
export function cleanLinks(links) {
  if (!Array.isArray(links)) return [];
  const byPair = new Map();
  links.forEach(l => {
    if (!l || !(l.from in ANGLES) || !(l.to in ANGLES) || l.from === l.to) return;
    const key = [l.from, l.to].sort().join('|');
    const full = l.strength === 'strong';
    const prev = byPair.get(key);
    if (!prev || (full && !prev.full)) {
      byPair.set(key, { from: l.from, to: l.to, full, note: typeof l.note === 'string' ? l.note.trim() : '' });
    }
  });
  return [...byPair.values()];
}

// The corroboration sentence. Returns parts so the component can bold the
// full pairs without building HTML from strings.
export function corroboration(links, nameOf) {
  if (!links.length) return { empty: 'No channels corroborate each other yet.' };
  const full = links.filter(l => l.full).map(l => `${nameOf(l.from)} ↔ ${nameOf(l.to)}`);
  const partBySource = new Map();
  links.filter(l => !l.full).forEach(l => {
    if (!partBySource.has(l.from)) partBySource.set(l.from, []);
    partBySource.get(l.from).push(nameOf(l.to));
  });
  const partial = [...partBySource.entries()].map(([from, tos]) => `${nameOf(from)} partly echoes ${listJoin(tos)}.`);
  return { full, partial };
}

export function footprintView(footprint, brandName) {
  const summary = summariseFootprint(footprint);
  if (!summary) return null;
  const nameOf = (id) => FOOTPRINT_CHANNELS.find(c => c.id === id)?.name || id;

  const nodes = summary.rows.map(r => {
    const g = nodeGeometry(r.id, r.level);
    const kind = r.level === 0 ? 'is-absent' : isBrand(r.id) ? 'is-brand' : 'is-market';
    return { id: r.id, name: r.name, level: r.level, kind, ...g };
  }).sort((a, b) => ANGLES[a.id] - ANGLES[b.id]);
  const byId = Object.fromEntries(nodes.map(n => [n.id, n]));

  const links = cleanLinks(footprint.links);
  const drawnLinks = links.map(l => ({ ...l, d: linkPath(byId[l.from], byId[l.to]) }));

  const evidenceOf = (r) => {
    const e = typeof r.evidence === 'string' ? r.evidence.trim() : '';
    return r.level > 0 && e && !/^no evidence found\.?$/i.test(e) ? e : '';
  };

  const rows = [...summary.rows]
    .sort((a, b) => (b.level - a.level) || a.name.localeCompare(b.name))
    .map(r => ({
      id: r.id,
      name: r.name,
      level: r.level,
      kind: r.level === 0 ? 'is-absent' : isBrand(r.id) ? 'is-brand' : 'is-market',
      driver: isBrand(r.id) ? 'Brand' : 'Market',
      band: getPresenceLevel(r.level).name,
      evidence: evidenceOf(r),
      segments: Array.from({ length: 10 }, (_, k) => [k < r.level ? 'on' : '', k === CONSCIOUS_AT - 1 ? 't' : ''].filter(Boolean).join(' ')),
    }));

  const brand = String(brandName || '').trim() || 'the brand';
  return {
    conscious: summary.channelsConscious,
    present: summary.channelsPresent,
    total: summary.channelCount,
    title: `Brand footprint: eight channels around ${brand}. Scores are listed in the table beside the chart.`,
    core: coreLines(brandName),
    nodes,
    links: drawnLinks,
    rows,
    corroboration: corroboration(links, nameOf),
    linkNotes: links.map(l => l.note).filter(Boolean),
  };
}
