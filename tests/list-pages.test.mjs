// v3.100.0: Compass Results in the Saved row pattern, and both pages on the
// packet's shared header and filter bar (screens 07 and 08).
// Run: node tests/support/build-render-bundle.mjs && node --test tests/
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://compass.test/', pretendToBeVisual: true });
globalThis.window = dom.window;
for (const k of Object.getOwnPropertyNames(dom.window)) {
  if (k in globalThis) continue;
  try { Object.defineProperty(globalThis, k, { value: dom.window[k], configurable: true, writable: true }); } catch { /* read-only */ }
}
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let React, client, server, act, App, h;
before(async () => {
  React = (await import('react')).default;
  client = await import('react-dom/client');
  server = await import('react-dom/server');
  act = React.act;
  h = (...a) => React.createElement(...a);
  App = await import('./.build/app.bundle.mjs');
});
const fixture = (f) => new JSDOM(JSON.parse(readFileSync(new URL('./fixtures/design-screens.json', import.meta.url), 'utf8'))[f]).window.document;
const sc = (v) => ({ AWAKE: v, AWARE: v, REFLECTIVE: v, ATTENTIVE: v, COGENT: v, SENTIENT: v, VISIONARY: v, INTENTIONAL: v });
const RESULTS = [
  { id: 'r1', brandName: 'MKB', industry: 'energy', businessModel: 'b2b', totalScore: 40, maturityLevel: 'Establishing', rubricVersion: '2.10', savedAt: '2026-01-10T12:00:00Z', scores: { ...sc(40), challenge: { count: 2, netDelta: 3 } }, assessorName: 'Paul Newton' },
  { id: 'r2', brandName: 'Patagonia', industry: 'retail', businessModel: 'b2c', totalScore: 80, maturityLevel: 'Leading', rubricVersion: '2.10', savedAt: '2026-06-02T12:00:00Z', scores: sc(80), isManual: true },
  { id: 'r3', brandName: 'Nouryon', industry: 'manufacturing', businessModel: 'b2b', totalScore: 48, maturityLevel: 'Establishing', rubricVersion: '2.9', savedAt: '2026-03-05T12:00:00Z', scores: sc(48) },
];
const resultsDoc = (props = {}) => new JSDOM(server.renderToStaticMarkup(h(App.CompassResultsPage, { results: RESULTS, onUpdateResults() {}, profile: { is_admin: true }, user: {}, onRetry() {}, ...props }))).window.document;

const SAVED = [{ project: { brandName: 'MKB', industry: 'energy', date: '2026-08-31T12:00:00Z' }, assessments: {}, scores: { AWAKE: { score: 40 } } },
  { project: { brandName: 'Nouryon', industry: 'manufacturing', date: '2026-07-01T12:00:00Z' }, assessments: {}, scores: null }];
const savedDoc = (props = {}) => new JSDOM(server.renderToStaticMarkup(h(App.SavedAssessmentsPage, { assessments: SAVED, onLoad() {}, onDelete() {}, onImport() {}, onExport() {}, onShare() {}, onRescore() {}, profile: { is_admin: true }, onRetry() {}, ...props }))).window.document;

const headShape = (doc) => {
  const row = doc.querySelector('.dc-head-row');
  return [row.className, row.querySelector('.dc-page-head > h1').className, !!row.querySelector('.dc-head-actions')];
};

test('both pages share the packet header, with no Back button', () => {
  for (const [doc, file, title] of [[resultsDoc(), '07-compass-results.html', 'Compass Results'], [savedDoc(), '08-saved-assessments.html', 'Saved Assessments']]) {
    assert.deepEqual(headShape(doc), headShape(fixture(file)));
    assert.equal(doc.querySelector('.dc-page-head h1').textContent, title);
    assert.ok(![...doc.querySelectorAll('button')].some(b => /back/i.test(b.textContent)), `${title}: no Back button`);
    assert.equal(doc.querySelectorAll('.card').length, 0);
  }
});

test('both pages use the labelled filter bar, and both can sort', () => {
  for (const doc of [resultsDoc(), savedDoc()]) {
    const bar = doc.querySelector('.dc-filterbar');
    assert.ok(bar.querySelector('.dc-field.is-search input.dc-input[type="search"]'));
    [...bar.querySelectorAll('input, select')].forEach(el => assert.ok(bar.querySelector(`label[for="${el.id}"]`), `${el.id} is labelled`));
    assert.ok([...bar.querySelectorAll('label')].some(l => l.textContent === 'Sort'));
    assert.equal(bar.querySelectorAll('svg.lucide').length, 0, 'no icons in the filters');
  }
});

test('Results: one Saved-style row per brand, meta line carrying band, sector label, model, framework and date', () => {
  const doc = resultsDoc();
  const rows = [...doc.querySelectorAll('ul.dc-results > li.dc-listrow.dc-result-row')];
  assert.equal(rows.length, 3);
  const mkb = rows.find(r => r.querySelector('.dc-listrow-t').textContent === 'MKB');
  assert.equal(mkb.querySelector('.dc-pill').getAttribute('data-band'), 'establishing');
  const meta = mkb.querySelector('.dc-result-meta').textContent;
  for (const bit of ['Energy & Utilities', 'B2B', 'v2.10', 'assessed Jan 10, 2026', 'Challenged ×2 (+3)']) assert.ok(meta.includes(bit), bit);
  assert.ok(rows.find(r => r.textContent.includes('Patagonia')).textContent.includes('Manual'));
  const score = mkb.querySelector('.dc-result-score');
  assert.equal(score.textContent, '40');
  assert.equal(score.getAttribute('style'), null, 'the score is ink, not coloured by band');
  assert.equal(mkb.querySelector('button').textContent, 'Details');
  assert.equal(doc.querySelectorAll('ul.dc-results svg.lucide').length, 0, 'no icons in the rows');
});

test('Results: newest first by default, and the Sort select reorders', async () => {
  assert.deepEqual([...resultsDoc().querySelectorAll('.dc-listrow-t')].map(t => t.textContent), ['Patagonia', 'Nouryon', 'MKB']);
  const container = document.createElement('div'); document.body.appendChild(container);
  const root = client.createRoot(container);
  await act(async () => { root.render(h(App.CompassResultsPage, { results: RESULTS, onUpdateResults() {}, profile: { is_admin: true }, user: {}, onRetry() {} })); });
  const sort = container.querySelector('#res-sort');
  const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set;
  await act(async () => { setter.call(sort, 'score-asc'); sort.dispatchEvent(new window.Event('change', { bubbles: true })); });
  assert.deepEqual([...container.querySelectorAll('.dc-listrow-t')].map(t => t.textContent), ['MKB', 'Nouryon', 'Patagonia']);
  // Details opens the attribute breakdown in the row
  const btn = [...container.querySelectorAll('.dc-result-row button')][0];
  await act(async () => { btn.click(); });
  const detail = container.querySelector('.dc-result-detail');
  assert.equal(detail.querySelectorAll('.dc-result-attrs > div').length, 8);
  assert.ok(detail.textContent.includes('Assessor: Paul Newton'));
  assert.ok(detail.querySelector('.dc-link-btn.is-danger'), 'admins can delete');
  assert.equal(container.querySelector('.dc-result-row button[aria-expanded="true"]').textContent, 'Hide');
  await act(async () => root.unmount());
});

test('Results: the model filter offers only models the results carry', () => {
  const opts = [...resultsDoc().querySelectorAll('#res-model option')].map(o => o.textContent);
  assert.deepEqual(opts, ['All models', 'B2B', 'B2C']);
  assert.ok(!opts.includes('Both'), 'the old "Both" matched nothing');
  const ind = [...resultsDoc().querySelectorAll('#res-ind option')].map(o => o.textContent);
  assert.ok(ind.includes('Energy & Utilities'), 'industries show their labels, not their keys');
});

test('Results: Add manual entry opens the shared dialog, with every field labelled', async () => {
  const container = document.createElement('div'); document.body.appendChild(container);
  const root = client.createRoot(container);
  await act(async () => { root.render(h(App.CompassResultsPage, { results: RESULTS, onUpdateResults() {}, profile: { is_admin: true }, user: {}, onRetry() {} })); });
  await act(async () => { [...container.querySelectorAll('button')].find(b => b.textContent === 'Add manual entry').click(); });
  const panel = document.querySelector('.dc-dialog[role="dialog"]');
  assert.ok(panel, 'the shared dialog');
  assert.equal(panel.querySelector('h2').textContent, 'Add manual entry');
  for (const id of ['man-brand', 'man-model', 'man-ind', 'man-total']) assert.ok(panel.querySelector(`label[for="${id}"]`), id);
  assert.equal(panel.querySelectorAll('.dc-man-attrs input[type="number"]').length, 8);
  assert.equal(document.querySelector('.bg-black\\/60'), null, 'the old overlay is gone');
  await act(async () => root.unmount());
});

test('Results: non-admins see no manual entry and no delete', () => {
  const doc = resultsDoc({ profile: { is_admin: false } });
  assert.ok(![...doc.querySelectorAll('button')].some(b => b.textContent === 'Add manual entry'));
});

test('Saved: the count sits above the list, and dates read in US English', () => {
  const doc = savedDoc();
  assert.equal(doc.querySelector('.dc-head-row.is-baseline .dc-count').textContent, '2 assessments');
  const meta = doc.querySelector('.dc-listrow-m').textContent;
  assert.ok(meta.includes('saved Aug 31, 2026'), meta);
  assert.ok(!doc.body.textContent.includes('assessments saved'), 'the trailing count is gone');
  assert.equal([...doc.querySelectorAll('.dc-head-actions button')].map(b => b.textContent).join('|'), 'Import JSON|Client links');
});

test('Saved: read-only users get no import or client links', () => {
  const doc = savedDoc({ profile: { is_readonly: true } });
  assert.equal(doc.querySelector('.dc-head-actions'), null);
});

// ── Earned creative on the report: recommendations only (v3.110.0) ──

const ecoScores = (evidence, extra = {}) => ({
  AWAKE: { score: 38 }, SENTIENT: { score: 42 }, AWARE: { score: 45 }, VISIONARY: { score: 70 }, COGENT: { score: 60 },
  ATTENTIVE: { score: 60 }, INTENTIONAL: { score: 62 }, REFLECTIVE: { score: 40 }, earnedCreativeEvidence: evidence, ...extra });
const G1_FAIL = { verifiedTruths: [{ name: 'Grid pilot data set', description: 'Published 2025', source: 'Utility Dive' }, { name: 'Patent US1234567', description: 'Storage control', source: 'USPTO' }], redFlags: [], causeTerritory: null };

test('the report shows the recommendation and HOWL, with no inputs anywhere', async () => {
  const eco = await import('../src/lib/eco.js');
  const data = eco.ecoFromReport(ecoScores(G1_FAIL), { brand: 'MKB', companyStage: 'scaleup', stageName: 'Differentiating' });
  const doc = new JSDOM(server.renderToStaticMarkup(h(App.EcoBlocks, { blocks: data.blocks }))).window.document;
  assert.equal(doc.querySelectorAll('input, select, textarea, fieldset').length, 0, 'no form controls');
  assert.equal(doc.querySelector('.dc-eco-ladder li.is-ready b').textContent, 'Foundations', 'REFLECTIVE 40 fails G1: it starts at Foundations');
  assert.equal(doc.querySelector('.dc-eco-howl img').getAttribute('src'), '/howl-logo.svg');
  const src = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
  assert.ok(src.includes('Rescore this report to generate its earned creative opportunity.'), 'older reports are told to rescore, not given a form');
});

test('the client payload sends the blocks only, and nothing while the gate is pending', () => {
  const pending = App.makeClientPayload({ project: { brandName: 'MKB', industry: 'energy' }, scores: ecoScores(undefined), benchmark: null });
  assert.equal(pending.eco, null);
  const ready = App.makeClientPayload({ project: { brandName: 'MKB', industry: 'energy' }, scores: ecoScores(G1_FAIL, { eco: { override: { outcome: 'Moment-driven', reason: 'secret reason' }, claimsPct: 90, glassdoor: 4, announcementPct: 70 } }), benchmark: null });
  assert.deepEqual(Object.keys(ready.eco), ['blocks']);
  const json = JSON.stringify(ready);
  for (const leak of ['secret reason', 'claimsPct', 'glassdoor', 'announcementPct']) assert.ok(!json.includes(leak), leak);
});

test('the Teaser read carries the lite view: verdict, definition, HOWL standard opener, gate needs the full assessment', async () => {
  const logic = await import('../src/lib/teaser.js');
  const rubric = await import('../src/data/rubric.js');
  const o = { headline: 'H', summary: 'S', fullAssessmentWouldResolve: ['Q'], trustFindings: [], campaignCoherence: { level: 1 } };
  rubric.ATTRIBUTES.forEach((a, i) => { o[a.id] = { score: [35, 40, 50, 80, 70, 70, 70, 72][i], confidence: 'medium', rationale: 'r' }; });
  const result = logic.finaliseTeaser(logic.parseTeaserScoring(JSON.stringify(o)));
  const record = { id: 't', campaign_id: 'c', brand_name: 'Acme', website_url: 'https://acme.com', industry: 'energy', business_model: 'b2b', result, evidence: { sources: {} } };
  const doc = new JSDOM(server.renderToStaticMarkup(h(App.TeaserReport, { record, busy: false, progress: null, error: null, campaigns: [], baseline: null, onBack() {}, onRescore() {}, onRefresh() {}, onConvert() {}, onDelete() {} }))).window.document;
  const lite = doc.querySelector('[data-field="eco-lite"]');
  assert.ok(lite, 'in the Teaser read');
  assert.ok(lite.textContent.includes('Most brands have more to say than the world has heard. HOWL exists to change that.'));
  assert.ok(lite.textContent.includes('set by the full assessment'));
  assert.equal(lite.querySelectorAll('.dc-eco-ladder li').length, 4);
  assert.equal(lite.querySelector('.dc-eco-ladder li.is-ready'), null, 'no starting step without the gate');
  assert.equal(lite.querySelector('h2').textContent, 'Earned creative opportunity');
});

// ── Report section 08, benchmark comparison (packet 14, v3.106.0) ──

const BM = {
  scope: 'industry', cohortLabel: 'Energy & Utilities', count: 26, avgScore: 48, rank: 17, percentile: 3,
  scoreRange: { min: 21, max: 80 },
  attrAvgs: { AWAKE: 44, AWARE: 46, REFLECTIVE: 49, ATTENTIVE: 52, COGENT: 47, SENTIENT: 45, VISIONARY: 53, INTENTIONAL: 50 },
  attrRanges: { AWAKE: { min: 12, max: 72 }, AWARE: { min: 15, max: 70 }, REFLECTIVE: { min: 20, max: 74 }, ATTENTIVE: { min: 28, max: 80 }, COGENT: { min: 14, max: 76 }, SENTIENT: { min: 10, max: 71 }, VISIONARY: { min: 22, max: 79 }, INTENTIONAL: { min: 18, max: 77 } },
};
const MKB = Object.fromEntries(Object.entries({ AWAKE: 21, AWARE: 31, REFLECTIVE: 47, ATTENTIVE: 62, COGENT: 25, SENTIENT: 33, VISIONARY: 58, INTENTIONAL: 43 }).map(([k, v]) => [k, { score: v }]));
const bmDoc = (benchmark, overall = 40) => new JSDOM(server.renderToStaticMarkup(h(App.ReportBenchmarkSection, { project: { brandName: 'MKB' }, scores: MKB, overall, benchmark }))).window.document;

test('08: rank counts the brand within the set, and the percentile follows the packet formula', async () => {
  const bv = await import('../src/lib/benchmarkView.js');
  assert.deepEqual(bv.benchmarkPosition({ count: 26, rank: 27 }), { others: 26, n: 27, rank: 27, percentile: 0 }, 'never "27th of 26"');
  assert.equal(bv.benchmarkPosition({ count: 26, rank: 1 }).percentile, 100, 'first place is the 100th');
  assert.equal(bv.benchmarkPosition({ count: 26, rank: 17 }).percentile, Math.round((27 - 17) / 26 * 100));
  assert.equal(bv.benchmarkPosition({ count: 26, rank: 40 }).rank, 27, 'clamped to n');
  assert.equal(bv.signed(-8), '\u22128', 'a true minus sign');
});

test('08: the section matches the packet element for element', () => {
  const ours = bmDoc(BM).querySelector('.dc-bm');
  const design = new JSDOM(JSON.parse(readFileSync(new URL('./fixtures/design-screens.json', import.meta.url), 'utf8'))['08-benchmark-section.html']).window.document.querySelector('.dc-bm');
  const sig = (el) => [...el.querySelectorAll('*')].map(e => `${e.tagName.toLowerCase()}.${[...(e.classList || [])].sort().join('.')}`);
  assert.deepEqual(sig(ours), sig(design));
});

test('08: values, marks and wording', () => {
  const doc = bmDoc(BM);
  assert.equal(doc.querySelector('[data-value="vs-avg"]').textContent, '\u22128');
  assert.equal(doc.querySelector('[data-value="rank"]').textContent, '17th');
  assert.equal(doc.querySelector('[data-value="rank-n"]').textContent, '27', 'n includes the brand');
  assert.equal(doc.querySelector('.dc-bm-overall .dc-meta').textContent, 'Where MKB sits against 26 other Energy & Utilities brands.');
  assert.equal(doc.querySelector('[data-value="percentile"]').textContent, '38th', 'recomputed, not the stored figure');
  const track = doc.querySelector('.dc-bm-scale-track');
  assert.equal(track.querySelector('.range').getAttribute('style'), 'left:21%;width:59%');
  assert.equal(track.querySelector('.avg').textContent, 'Sector avg 48');
  assert.equal(track.querySelector('.subj-l').textContent, 'MKB 40');
  const awake = doc.querySelector('.dc-bm-row');
  assert.equal(awake.querySelector('.dc-bm-d').textContent, '\u221223');
  assert.equal(awake.querySelector('.dc-bm-track').getAttribute('aria-label'), 'Awake: MKB 21, sector average 44, sector range 12 to 72');
  const styled = [...doc.querySelectorAll('[style]')].map(e => e.getAttribute('style'));
  assert.ok(styled.every(st => /^(left:[\d.]+%)(;width:[\d.]+%)?$/.test(st)), 'positions are the only inline styles');
  assert.equal(doc.querySelectorAll('[class*="text-["], .card').length, 0, 'no legacy classes, no red scores');
  assert.ok(doc.querySelector('.dc-radar polygon.s-bench') && doc.querySelector('.dc-radar polygon.s-subject'));
});

test('08: older saved reports have no overall band, and nothing is invented', () => {
  const { scoreRange, ...old } = BM;
  assert.ok(scoreRange);
  const doc = bmDoc(old);
  assert.equal(doc.querySelector('.dc-bm-scale-track .range'), null);
  assert.ok(!doc.querySelector('.dc-bm-scale').getAttribute('aria-label').includes('range'));
});

test('08: an all-brands group is never called a sector', () => {
  const doc = bmDoc({ ...BM, scope: 'all', cohortLabel: 'All assessed brands' });
  assert.equal(doc.querySelector('.dc-bm-scale-track .avg').textContent, 'Avg 48');
  assert.equal(doc.querySelectorAll('.dc-bm-stats .dc-meta')[1].textContent, 'Rank among all brands');
  assert.ok(!doc.body.textContent.includes('Sector'), 'no sector wording anywhere');
});

test('08: with no benchmark, the empty-state alert', () => {
  const doc = bmDoc(null);
  assert.equal(doc.querySelector('.dc-alert strong').textContent, 'Nothing to compare yet');
  assert.equal(doc.querySelector('.dc-bm'), null);
});

test('08: new snapshots save the overall range', () => {
  const src = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
  assert.ok(src.includes('scoreRange: { min: Math.min(...cohort.map(b => b.totalScore)), max: Math.max(...cohort.map(b => b.totalScore)) },'));
  assert.ok(!/Rank: \$\{ordinal\(benchmark\.rank\)\} of \$\{benchmark\.count\}/.test(src), 'the plain-text copy uses the corrected rank too');
});

// ── Scroll motion for the three reports (v3.108.0) ───────────

function motionWindow({ reduced = false, io = true, height = 800 } = {}) {
  const d = new JSDOM('<!doctype html><html><body></body></html>', { pretendToBeVisual: true });
  const win = d.window;
  win.matchMedia = (q) => ({ matches: reduced && q.includes('reduce') });
  Object.defineProperty(win, 'innerHeight', { value: height, configurable: true });
  const observed = [];
  if (io) {
    win.IntersectionObserver = class {
      constructor(cb) { this.cb = cb; }
      observe(el) { observed.push({ el, obs: this }); }
      unobserve() {}
      disconnect() {}
    };
  }
  return { win, doc: win.document, observed };
}
function reportRoot(doc, tops) {
  const root = doc.createElement('div'); root.className = 'dc-wrap dc-page';
  const ids = ['glance', 'footprint', 'campaign-coherence', 'trust-lens', 'benchmark'];
  ids.forEach((id, i) => {
    const s = doc.createElement('section'); s.id = id; s.className = 'dc-section';
    s.getBoundingClientRect = () => ({ top: tops[i], bottom: tops[i] + 400 });
    root.appendChild(s);
  });
  doc.body.appendChild(root);
  return root;
}

test('motion: sections are tagged draw or fade; campaign coherence only fades (v3.111.0: the trust lens draws its scale markers)', async () => {
  const sm = await import('../src/lib/scrollMotion.js');
  const { win, doc, observed } = motionWindow();
  const root = reportRoot(doc, [0, 900, 1400, 1900, 2400]);
  sm.startScrollMotion(root, win);
  const kind = (id) => doc.getElementById(id).getAttribute('data-reveal');
  assert.deepEqual(['glance', 'footprint', 'campaign-coherence', 'trust-lens', 'benchmark'].map(kind), ['draw', 'draw', 'fade', 'draw', 'draw']);
  assert.ok(root.classList.contains('dc-motion'));
  assert.ok(doc.getElementById('glance').classList.contains('is-revealed'), 'on screen at load: shown at once, no flash');
  assert.ok(!doc.getElementById('benchmark').classList.contains('is-revealed'), 'below the fold waits');
  assert.equal(observed.length, 4, 'only off-screen sections are watched');
  const b = observed.find(o => o.el.id === 'benchmark');
  b.obs.cb([{ isIntersecting: true, target: b.el }]);
  assert.ok(doc.getElementById('benchmark').classList.contains('is-revealed'), 'revealed once it enters');
});

test('motion: reduced motion or no observer means no motion at all', async () => {
  const sm = await import('../src/lib/scrollMotion.js');
  for (const opts of [{ reduced: true }, { io: false }]) {
    const { win, doc } = motionWindow(opts);
    const root = reportRoot(doc, [0, 900, 1400, 1900, 2400]);
    sm.startScrollMotion(root, win);
    assert.ok(!root.classList.contains('dc-motion'), JSON.stringify(opts));
  }
});

test('motion: sections that appear later are picked up; the export sees everything finished', async () => {
  const sm = await import('../src/lib/scrollMotion.js');
  const { win, doc, observed } = motionWindow();
  const root = reportRoot(doc, [0, 900, 1400, 1900, 2400]);
  sm.startScrollMotion(root, win);
  const late = doc.createElement('section'); late.id = 'earned-creative';
  late.getBoundingClientRect = () => ({ top: 3000, bottom: 3400 });
  root.appendChild(late);
  assert.equal(sm.retagSections(root, win), 1);
  assert.equal(late.getAttribute('data-reveal'), 'draw');
  assert.ok(observed.some(o => o.el === late));
  // Word export: everything revealed and motion switched off at once
  const saved = globalThis.document; globalThis.document = doc;
  sm.revealAll(doc);
  globalThis.document = saved;
  assert.ok(!root.classList.contains('dc-motion'));
  assert.ok([...root.querySelectorAll('[data-reveal]')].every(el => el.classList.contains('is-revealed')));
});

test('motion: wired into the three reports, guarded for print and reduced motion, never counting numbers', () => {
  const src = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
  assert.ok(src.includes('<div className="dc-wrap dc-page" ref={motionRef}>'), 'full report');
  assert.ok(src.includes('<div className="dc-wrap dc-page pt-8" ref={motionRef}>'), 'client report');
  assert.ok(src.includes('data-teaser-client-view="true" ref={motionRef}'), 'teaser read');
  assert.ok(src.includes('revealAll();   // the finished state'), 'the export forces the finished state first');
  assert.ok(!src.includes('animate-fade-in'), 'the dead class is gone');
  assert.ok(!src.includes('function Reveal('), 'the unused component is gone');
  const css = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8');
  assert.ok(css.includes('@media print, (prefers-reduced-motion: reduce) {'));
  assert.ok(!/data-reveal="fade"\][^{]*\{[^}]*scale/.test(css), 'fade-only sections never draw their data');
});

// ── Saving from the full report (v3.108.1) ───────────────────

test('Save shows Saving, ignores a second click, then shows Saved', async () => {
  const { ATTRIBUTES } = await import('../src/data/rubric.js');
  window.scrollTo = () => {};
  globalThis.fetch = window.fetch = () => new Promise(() => {});
  const scores = {};
  ATTRIBUTES.forEach((a, i) => { scores[a.id] = { score: 40 + i, findings: 'f', impact: 'i' }; });
  let calls = 0, finish;
  const onSave = (opts) => { calls++; assert.equal(opts.quiet, true, 'no success alert: the button says it'); return new Promise(r => { finish = r; }); };
  const container = document.createElement('div'); document.body.appendChild(container);
  const root = client.createRoot(container);
  await act(async () => { root.render(h(App.ReportPage, { project: { brandName: 'MKB', websiteUrl: 'https://mkb.com', industry: 'energy', businessModel: 'b2b', date: '2026-09-28' }, setProject() {}, scores, setScores() {}, assessments: {}, setAssessments() {}, apiKey: 'PROXY', onSave, onPrev() {}, profile: { is_admin: true }, compassResults: [] })); });
  const btn = () => container.querySelector('[data-field="save"]');
  assert.equal(btn().textContent, 'Save');
  await act(async () => { btn().click(); });
  assert.equal(btn().textContent, 'Saving\u2026');
  assert.equal(btn().disabled, true);
  await act(async () => { btn().click(); });
  assert.equal(calls, 1, 'a second click while saving does nothing');
  await act(async () => { finish(true); await Promise.resolve(); });
  assert.equal(btn().textContent, 'Saved');
  await act(async () => root.unmount());
});

test('the save handler: one at a time, results failures surfaced, a refresh hiccup is not a failed save', () => {
  const src = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
  const at = src.indexOf('  const handleSave = async ({ quiet = false, resumeStep = null } = {}) => {');
  const fn = src.slice(at - 200, src.indexOf('\n  };\n', at));
  assert.ok(fn.includes('if (savingRef.current) return false;') && fn.includes('savingRef.current = false;'), 'one save at a time, released in finally');
  assert.ok(fn.includes('const { error: resultError } = await saveCompassResult(resultData);'), 'the results error is read');
  assert.ok(fn.includes("try { await loadDataFromSupabase(); } catch (e) { console.warn('Saved, but the lists did not refresh:', e); }"), 'refresh failure does not fail the save');
});

// ── Saved page dates follow the last save (v3.108.2) ─────────

test('Saved shows and sorts by the last save, so a rescored report saved again moves up with a new date', () => {
  const rows = [
    { id: 'a', project: { brandName: 'Alpha', industry: 'energy', date: '2026-01-10T12:00:00Z' }, assessments: {}, scores: null, savedAt: '2026-01-10T12:00:00Z', updatedAt: '2026-09-28T15:00:00Z' },
    { id: 'b', project: { brandName: 'Beta', industry: 'energy', date: '2026-06-01T12:00:00Z' }, assessments: {}, scores: null, savedAt: '2026-06-01T12:00:00Z', updatedAt: '2026-06-01T12:00:00Z' },
  ];
  const doc = new JSDOM(server.renderToStaticMarkup(h(App.SavedAssessmentsPage, { assessments: rows, onLoad() {}, onDelete() {}, onImport() {}, onExport() {}, onShare() {}, onRescore() {}, profile: { is_admin: true }, onRetry() {} }))).window.document;
  const names = [...doc.querySelectorAll('.dc-listrow-t')].map(t => t.textContent);
  assert.deepEqual(names, ['Alpha', 'Beta'], 'Alpha was saved most recently, though started first');
  assert.ok(doc.querySelector('.dc-listrow-m').textContent.includes('saved Sep 28, 2026'), 'the date is the last save, not the start date');
});

test('the Saved list carries each row\'s last-updated time', () => {
  const src = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
  assert.ok(src.includes('updatedAt: a.updated_at || a.created_at,'));
  const lib = readFileSync(new URL('../src/lib/supabase.js', import.meta.url), 'utf8');
  const save = lib.slice(lib.indexOf('export const saveAssessment'), lib.indexOf('export const deleteAssessment'));
  assert.ok(save.includes('updated_at: new Date().toISOString(),'), 'every save stamps updated_at');
});

// ── One results row per brand, history under Details (v3.109.0) ──

const SAVES = [
  { id: 'm1', brandName: 'MKB', industry: 'energy', businessModel: 'b2b', totalScore: 40, maturityLevel: 'Establishing', rubricVersion: '2.10', savedAt: '2026-03-01T12:00:00Z', createdAt: '2026-03-01T12:00:00Z', scores: {}, assessorName: 'Paul Newton' },
  { id: 'm2', brandName: 'MKB', industry: 'energy', businessModel: 'b2b', totalScore: 44, maturityLevel: 'Establishing', rubricVersion: '2.10', savedAt: '2026-06-01T12:00:00Z', createdAt: '2026-06-01T12:00:00Z', scores: {}, assessorName: 'Paul Newton' },
  { id: 'm3', brandName: 'mkb ', industry: 'energy', businessModel: 'b2b', totalScore: 48, maturityLevel: 'Establishing', rubricVersion: '2.11', savedAt: '2026-09-28T12:00:00Z', createdAt: '2026-09-28T12:00:00Z', scores: {}, assessorName: 'Paul Newton' },
  { id: 'b1', brandName: 'Beta', industry: 'energy', businessModel: 'b2b', totalScore: 60, maturityLevel: 'Differentiating', rubricVersion: '2.11', savedAt: '2026-07-01T12:00:00Z', createdAt: '2026-07-01T12:00:00Z', scores: {} },
];

test('Results: one row per brand, the latest save, with the count of saves', () => {
  const doc = new JSDOM(server.renderToStaticMarkup(h(App.CompassResultsPage, { results: SAVES, onUpdateResults() {}, profile: { is_admin: true }, user: {}, onRetry() {} }))).window.document;
  const rows = [...doc.querySelectorAll('.dc-result-row')];
  assert.equal(rows.length, 2, 'MKB once, Beta once');
  const mkb = rows.find(r => /mkb/i.test(r.querySelector('.dc-listrow-t').textContent));
  assert.equal(mkb.querySelector('.dc-result-score').textContent, '48', 'the latest save');
  assert.match(mkb.querySelector('.dc-result-meta').textContent, /3 saves/);
  assert.equal(doc.querySelector('.dc-page-head .dc-count').textContent, '2 brands · 4 saves');
});

test('Results: Details lists the earlier saves, newest first, with the change to the next', async () => {
  const container = document.createElement('div'); document.body.appendChild(container);
  const root = client.createRoot(container);
  await act(async () => { root.render(h(App.CompassResultsPage, { results: SAVES, onUpdateResults() {}, profile: { is_admin: true }, user: {}, onRetry() {} })); });
  const mkb = [...container.querySelectorAll('.dc-result-row')].find(r => /mkb/i.test(r.textContent));
  await act(async () => { mkb.querySelector('button').click(); });
  const hist = mkb.querySelectorAll('[data-field="history"] li');
  assert.equal(hist.length, 2);
  assert.equal(hist[0].querySelector('.dc-result-history-n').textContent, '44');
  assert.match(hist[0].textContent, /Jun 1, 2026/);
  assert.match(hist[0].textContent, /\+4 to the next save/);
  assert.equal(hist[1].querySelector('.dc-result-history-n').textContent, '40');
  assert.ok([...mkb.querySelectorAll('button')].some(b => b.textContent === 'Delete latest save'));
  await act(async () => root.unmount());
});

test('comparisons count each brand once: benchmarks, Compare, Teaser baselines and the server jobs', async () => {
  const bv = await import('../src/lib/benchmarkView.js');
  const latest = bv.latestPerBrand(SAVES);
  assert.deepEqual(latest.map(r => r.id).sort(), ['b1', 'm3']);
  const src = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
  assert.ok(src.includes('benchmarkSnapshot = buildBenchmarkSnapshot(latestResults, {'), 'Save freezes a latest-only benchmark');
  assert.equal((src.match(/compassResults=\{latestResults\}/g) || []).length, 2, 'both report mounts');
  assert.ok(src.includes('<ComparisonPage \n          results={latestResults}'), 'Compare');
  for (const f of ['refresh-landscape-analysis', 'refresh-insights-analysis']) {
    const api = readFileSync(new URL(`../api/${f}.js`, import.meta.url), 'utf8');
    assert.ok(api.includes('const results = latestPerBrand(await resultsRes.json());'), f);
  }
});

test('clicking the brand name or the row opens its details; clicks inside the panel do not close it', async () => {
  const container = document.createElement('div'); document.body.appendChild(container);
  const root = client.createRoot(container);
  await act(async () => { root.render(h(App.CompassResultsPage, { results: SAVES, onUpdateResults() {}, profile: { is_admin: true }, user: {}, onRetry() {} })); });
  const row = () => [...container.querySelectorAll('.dc-result-row')].find(r => /mkb/i.test(r.textContent));
  await act(async () => { row().querySelector('.dc-listrow-t').click(); });
  assert.ok(row().querySelector('[data-field="history"]'), 'the brand name opens it');
  assert.equal(row().querySelector('button[aria-expanded]').textContent, 'Hide');
  await act(async () => { row().querySelector('.dc-result-history li').click(); });
  assert.ok(row().querySelector('[data-field="history"]'), 'a click inside the panel leaves it open');
  await act(async () => { row().querySelector('.dc-result-meta').click(); });
  assert.equal(row().querySelector('.dc-result-detail'), null, 'a click on the row closes it');
  await act(async () => { row().querySelector('button[aria-expanded]').click(); });
  assert.ok(row().querySelector('.dc-result-detail'), 'the Details button still works, once, without the row toggling it back');
  await act(async () => root.unmount());
});

test('the Teaser read has more air between and within sections (v3.109.2)', () => {
  const css = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8');
  const at = css.indexOf('/* More air in the Teaser read (v3.109.2)');
  const block = css.slice(at, at + 800);
  assert.ok(block.includes('.dc-teaser { gap: var(--cc-s-24); }'));
  assert.ok(block.includes('.dc-tz-sec { gap: var(--cc-s-8); padding-top: var(--cc-s-12); }'));
  assert.ok(at > css.indexOf('.dc-tz-sec { display: flex;'), 'after the base rule, so it wins');
});

test('sustainability principles: Breaking through is counted, styled and set at the report sizes (v3.110.1)', () => {
  const src = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
  assert.ok(src.includes("<span><b>{count('breaking')}</b>breaking through</span>"));
  assert.ok(!src.includes("count('evident')"), 'the level that never occurs is no longer counted');
  const thesis = readFileSync(new URL('../src/data/thesis.js', import.meta.url), 'utf8');
  assert.ok(thesis.includes("{ id: 'breaking', label: 'Breaking through' }"), 'the data calls it breaking');
  const css = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8');
  assert.ok(css.includes('.dc-status-chip.is-evident, .dc-status-chip.is-breaking {'));
  assert.ok(css.includes('.dc-principles-strip i.is-evident, .dc-principles-strip i.is-breaking {'));
  // v3.110.2: names in the serif at 22px, like the report's other list headings
  assert.ok(/\.dc-principle h3 \{[^}]*22px\/1\.25 var\(--cc-serif\)/.test(css) && /\.dc-principle p \{[^}]*var\(--cc-fs-body\)/.test(css));
});

test('type sweep: the three reports stay on one scale (v3.110.2)', () => {
  const src = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8');
  const card = src.slice(src.indexOf('{sc.findings || sc.summary || attr.description}') - 200, src.indexOf('{sc.findings || sc.summary || attr.description}'));
  assert.ok(card.includes('className="dc-attr-body"'), 'attribute card prose uses the body class, not old 13px text');
  assert.ok(css.includes('.dc-attr-body, .dc-attr-p { margin: 0; font-size: var(--cc-fs-body);'), 'card prose at body size in all three reports');
  assert.ok(/\.dc-kicker-sm \{ font-size: var\(--cc-fs-meta\)/.test(css), 'notes like "Sector average" at the note size');
  assert.ok(css.includes('.dc-eco-verdict { font: var(--cc-w-regular) var(--cc-fs-card)/1.3 var(--cc-serif);'), 'every section opening line at one size');
  assert.ok(/\.dc-maturity-marker span \{[^}]*var\(--cc-w-semi\)/.test(css), 'one bold weight');
  const client = src.slice(src.indexOf('function ClientReportView('), src.indexOf('function ClientReportView(') + 30000);
  assert.ok(client.includes('<div className="dc-maturity" aria-label='), 'the client maturity scale is the full report\'s');
  assert.ok(!src.includes('function PositionBands('), 'the older strip is gone');
});

// ── Scores count up, markers slide (v3.111.0) ────────────────

test('motion: scores count up from 0 to their value, once, and finishing jumps straight to it', async () => {
  const sm = await import('../src/lib/scrollMotion.js');
  const { win, doc, observed } = motionWindow();
  const root = reportRoot(doc, [0, 900, 1400, 1900, 2400]);
  const bm = doc.getElementById('benchmark');
  bm.innerHTML = '<div class="dc-stat-n">59</div><span class="dc-bm-v">42</span><span class="dc-stat-n">17th</span>';
  sm.startScrollMotion(root, win);
  assert.equal(bm.querySelector('.dc-stat-n').textContent, '59', 'untouched until it is drawn: print and export see the value');
  const o = observed.find(x => x.el.id === 'benchmark');
  o.obs.cb([{ isIntersecting: true, target: o.el }]);
  assert.ok(bm.classList.contains('is-drawn'));
  assert.equal(bm.querySelector('.dc-stat-n').textContent, '0', 'counting starts from 0');
  assert.equal(bm.querySelector('.dc-stat-n').getAttribute('aria-label'), '59', 'screen readers get the value, not the count');
  assert.equal(bm.querySelectorAll('.dc-stat-n')[1].textContent, '17th', 'only plain scores count, not ranks');
  await new Promise(r => setTimeout(r, 1100));
  assert.equal(bm.querySelector('.dc-stat-n').textContent, '59');
  assert.equal(bm.querySelector('.dc-bm-v').textContent, '42');
  assert.equal(bm.querySelector('.dc-stat-n').hasAttribute('aria-label'), false);
});

test('motion: printing or exporting mid-count shows the final values', async () => {
  const sm = await import('../src/lib/scrollMotion.js');
  const { win, doc, observed } = motionWindow();
  const root = reportRoot(doc, [0, 900, 1400, 1900, 2400]);
  const bm = doc.getElementById('benchmark');
  bm.innerHTML = '<div class="dc-stat-n">59</div>';
  sm.startScrollMotion(root, win);
  const o = observed.find(x => x.el.id === 'benchmark');
  o.obs.cb([{ isIntersecting: true, target: o.el }]);
  await new Promise(r => setTimeout(r, 120));
  assert.notEqual(bm.querySelector('.dc-stat-n').textContent, '59', 'mid-count');
  sm.revealAll(doc);
  await new Promise(r => setTimeout(r, 60));
  assert.equal(bm.querySelector('.dc-stat-n').textContent, '59', 'and it stays at the final value');
  assert.ok(root.classList.contains('dc-motion-done'));
});

test('motion: every scale marker slides from 0; setup holds transitions off', () => {
  const css = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8');
  for (const sel of ['.dc-bm-track .subj', '.dc-bm-scale-track .subj', '.dc-maturity-marker span', '.dc-scale-track > i']) {
    assert.ok(css.includes(`:not(.is-drawn) ${sel}`), `${sel} starts at 0`);
  }
  assert.ok(css.includes('.dc-motion.dc-motion-init [data-reveal], .dc-motion.dc-motion-init [data-reveal] * { transition: none !important; }'));
  const src = readFileSync(new URL('../src/lib/scrollMotion.js', import.meta.url), 'utf8');
  assert.ok(src.includes("win.addEventListener?.('beforeprint', onPrint);"), 'printing finishes everything first');
});
