// ─────────────────────────────────────────────────────────────
// DOM DIFF: our rendered page against the design export.
//
// The restyle kept drifting because the app's markup was being styled rather
// than rebuilt, and nothing checked the difference. This renders a component
// to static HTML and compares its class usage and nesting against the
// matching file in the design export.
//
//   node tests/support/dom-diff.mjs <screen-file> [--verbose]
//
// It reports, in order: classes the design uses that we never render, classes
// we render that the design does not have, and where counts differ enough to
// mean a different structure.
// ─────────────────────────────────────────────────────────────

import { readFileSync, existsSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const EXPORT_DIR = process.env.DESIGN_EXPORT || '/home/claude/ui5/export';

export function classCounts(html) {
  const doc = new JSDOM(html).window.document;
  const counts = new Map();
  doc.querySelectorAll('[class]').forEach(el => {
    el.getAttribute('class').split(/\s+/).filter(Boolean).forEach(c => {
      if (!c.startsWith('dc-') && !c.startsWith('btn-') && !c.startsWith('is-')) return;
      counts.set(c, (counts.get(c) || 0) + 1);
    });
  });
  return counts;
}

// A rough shape of the document: the class path of every element that carries
// a dc- class, so a moved block shows up as well as a missing one.
export function shape(html) {
  const doc = new JSDOM(html).window.document;
  const paths = [];
  const walk = (el, trail) => {
    const own = (el.getAttribute?.('class') || '').split(/\s+/).filter(c => c.startsWith('dc-'));
    const here = own.length ? [...trail, own[0]] : trail;
    if (own.length) paths.push(here.join(' > '));
    [...el.children].forEach(child => walk(child, here));
  };
  [...doc.body.children].forEach(el => walk(el, []));
  return paths;
}

export function compare(ourHtml, designHtml) {
  const ours = classCounts(ourHtml);
  const theirs = classCounts(designHtml);
  const missing = [...theirs.keys()].filter(c => !ours.has(c)).sort();
  const extra = [...ours.keys()].filter(c => !theirs.has(c)).sort();
  const countDiff = [...theirs.entries()]
    .filter(([c, n]) => ours.has(c) && Math.abs(ours.get(c) - n) > Math.max(1, n * 0.5))
    .map(([c, n]) => ({ class: c, design: n, ours: ours.get(c) }));
  const ourShape = new Set(shape(ourHtml));
  const theirShape = shape(designHtml);
  const misplaced = [...new Set(theirShape.filter(p => !ourShape.has(p)))];
  return { missing, extra, countDiff, misplaced, theirTotal: theirs.size, ourTotal: ours.size };
}

export function designFile(name) {
  const path = `${EXPORT_DIR}/screens/${name}`;
  if (!existsSync(path)) throw new Error(`No such screen in the export: ${name}`);
  return readFileSync(path, 'utf8');
}

export function report(name, ourHtml, { verbose = false } = {}) {
  const r = compare(ourHtml, designFile(name));
  const pct = Math.round(((r.theirTotal - r.missing.length) / r.theirTotal) * 100);
  const lines = [
    `${name}: ${pct}% of the design's classes are rendered (${r.theirTotal - r.missing.length}/${r.theirTotal})`,
  ];
  if (r.missing.length) lines.push(`  not rendered (${r.missing.length}): ${r.missing.slice(0, verbose ? 999 : 18).join(', ')}`);
  if (r.extra.length) lines.push(`  ours only (${r.extra.length}): ${r.extra.slice(0, verbose ? 999 : 12).join(', ')}`);
  if (r.countDiff.length) lines.push(`  count differs: ${r.countDiff.slice(0, 8).map(d => `${d.class} ${d.ours}/${d.design}`).join(', ')}`);
  if (verbose && r.misplaced.length) lines.push(`  nesting differs (${r.misplaced.length}):\n    ${r.misplaced.slice(0, 20).join('\n    ')}`);
  return { text: lines.join('\n'), ...r, pct };
}
