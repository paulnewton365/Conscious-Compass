// v3.100.0: Compass Results in the Saved row pattern, and both pages on the
// packet's shared header and filter bar (screens 07 and 08).
// Run: node tests/support/build-render-bundle.mjs && node --test tests/
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
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

// ── How earned creative could help (ECO v2.0, v3.115.0) ──

const ecoScores = (extra = {}) => ({
  AWAKE: { score: 38 }, SENTIENT: { score: 42 }, AWARE: { score: 45 }, VISIONARY: { score: 70 }, COGENT: { score: 60 },
  ATTENTIVE: { score: 60 }, INTENTIONAL: { score: 62 }, REFLECTIVE: { score: 40 }, ...extra });
const WRITTEN_ECO = { opening: 'Earned creative would get MKB talked about.', opportunities: [{ attribute: 'AWAKE', truth: 'Open grid data, Utility Dive', idea: 'Map the outages the data prevented.', change: 'Puts MKB in the heat wave story.' }], sortFirst: ['SENTINEL_RISK rate case, PUC docket'] };

test('the full report shows the opportunities, the internal list and HOWL, with no form controls', async () => {
  const eco = await import('../src/lib/eco.js');
  const section = eco.buildEcoSection(ecoScores({ earnedCreativeOpportunity: WRITTEN_ECO }), { brand: 'MKB' });
  const doc = new JSDOM(server.renderToStaticMarkup(h(App.EcoSection, { section, internal: true }))).window.document;
  assert.equal(doc.querySelectorAll('input, select, textarea, fieldset').length, 0, 'no form controls');
  assert.equal(doc.querySelector('.dc-eco-opps li[data-attr="AWAKE"] .dc-kicker').textContent, 'Lifts Awake');
  assert.ok(doc.querySelector('.dc-eco-truth').textContent.includes('Open grid data'));
  assert.ok(doc.querySelector('[data-block="sort-first"]').textContent.includes('SENTINEL_RISK'));
  assert.equal(doc.querySelector('.dc-eco-howl img').getAttribute('src'), '/howl-logo.svg');
  assert.equal(doc.querySelector('.dc-eco-lockup span').textContent, 'by Antenna');
  const older = eco.buildEcoSection(ecoScores(), { brand: 'MKB' });
  const doc2 = new JSDOM(server.renderToStaticMarkup(h(App.EcoSection, { section: older, internal: true }))).window.document;
  assert.equal(doc2.querySelectorAll('.dc-eco-opps > li').length, 3, 'an older report still gets the section');
  assert.ok(doc2.querySelector('[data-field="eco-rescore"]'), 'with a note that a rescore grounds it in evidence');
});

test('the client link carries the section and HOWL, never the sort-first list', () => {
  const payload = App.makeClientPayload({ project: { brandName: 'MKB', industry: 'energy' }, scores: ecoScores({ earnedCreativeOpportunity: WRITTEN_ECO }), benchmark: null });
  assert.deepEqual(Object.keys(payload.eco).sort(), ['howl', 'opening', 'opportunities']);
  const json = JSON.stringify(payload);
  assert.ok(!json.includes('SENTINEL_RISK') && !json.includes('sortFirst'));
  const html = server.renderToStaticMarkup(h(App.ClientReportView, { payload }));
  const doc = new JSDOM(html).window.document;
  const sec = doc.querySelector('#earned-creative');
  assert.ok(sec, 'the client view shows it');
  assert.equal(sec.querySelector('.dc-eco-howl img').getAttribute('src'), '/howl-logo.svg');
  assert.equal(sec.querySelector('[data-block="sort-first"]'), null);
  assert.equal(sec.querySelector('[data-field="eco-rescore"]'), null);
});

test('the Teaser read names the attribute each opportunity would lift, then HOWL with its logo', async () => {
  const logic = await import('../src/lib/teaser.js');
  const rubric = await import('../src/data/rubric.js');
  const o = { headline: 'H', summary: 'S', fullAssessmentWouldResolve: ['Q'], trustFindings: [], campaignCoherence: { level: 1 } };
  rubric.ATTRIBUTES.forEach((a, i) => { o[a.id] = { score: [35, 40, 50, 80, 70, 70, 70, 72][i], confidence: 'medium', rationale: 'r' }; });
  const result = logic.finaliseTeaser(logic.parseTeaserScoring(JSON.stringify(o)));
  const record = { id: 't', campaign_id: 'c', brand_name: 'Acme', website_url: 'https://acme.com', industry: 'energy', business_model: 'b2b', result, evidence: { sources: {} } };
  const doc = new JSDOM(server.renderToStaticMarkup(h(App.TeaserReport, { record, busy: false, progress: null, error: null, campaigns: [], baseline: null, onBack() {}, onRescore() {}, onRefresh() {}, onConvert() {}, onDelete() {} }))).window.document;
  const lite = doc.querySelector('[data-field="eco-lite"]');
  assert.ok(lite, 'in the Teaser read');
  assert.equal(lite.querySelector('h2').textContent, 'How earned creative could help');
  assert.ok(lite.querySelector('.dc-eco-verdict').textContent.startsWith('Earned creative would help Acme most on'));
  assert.equal(lite.querySelectorAll('.dc-eco-opps > li').length, 3);
  assert.equal(lite.querySelector('.dc-eco-idea'), null, 'no idea starters in the teaser');
  assert.equal(lite.querySelector('.dc-eco-howl img').getAttribute('src'), '/howl-logo.svg');
  assert.equal(lite.querySelector('.dc-eco-ladder'), null, 'the ladder is gone');
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
  const at = src.indexOf('  const handleSave = async ({ quiet = false, resumeStep = null, scoresOverride = null, newRun = false, projectPatch = null } = {}) => {');
  assert.ok(at > 0);
  const fn = src.slice(at - 200, src.indexOf('\n  };\n', at));
  assert.ok(fn.includes('if (savingRef.current) return false;') && fn.includes('savingRef.current = false;'), 'one save at a time, released in finally');
  assert.ok(fn.includes('const { data: resultRow, error: resultError } = resultId'), 'the results error is read');
  assert.ok(fn.includes('if (resultError) {'), 'and surfaced');
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

test('Food & Beverage is an industry, beside Retail (v3.111.1)', () => {
  const src = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
  const list = src.slice(src.indexOf('const INDUSTRIES = ['), src.indexOf('];', src.indexOf('const INDUSTRIES = [')));
  assert.ok(list.includes("{ id: 'food', name: 'Food & Beverage' }"));
  assert.ok(list.indexOf("id: 'food'") > list.indexOf("id: 'retail'") && list.indexOf("id: 'food'") < list.indexOf("id: 'media'"));
  assert.equal((list.match(/id: 'food'/g) || []).length, 1);
});

// ── The summary names the right strengths (v3.111.2) ─────────

const SEPA = { AWAKE: 48, AWARE: 42, REFLECTIVE: 38, ATTENTIVE: 35, COGENT: 45, SENTIENT: 29, VISIONARY: 62, INTENTIONAL: 54 };

test('summary picks: strengths are the two highest, growth the two lowest', async () => {
  const { ATTRIBUTES } = await import('../src/data/rubric.js');
  const sorted = ATTRIBUTES.map(a => ({ ...a, score: SEPA[a.id] })).sort((a, b) => a.score - b.score);
  assert.deepEqual(App.summaryPicks(sorted), { strengths: ['Visionary', 'Intentional'], growth: ['Sentient', 'Attentive'] });
});

test('the full report and the client report both say it the right way round', async () => {
  const { ATTRIBUTES } = await import('../src/data/rubric.js');
  const scores = Object.fromEntries(ATTRIBUTES.map(a => [a.id, { score: SEPA[a.id], findings: 'f', impact: 'i' }]));
  const project = { brandName: 'Smart Electric Power Alliance', websiteUrl: 'https://sepapower.org', industry: 'energy', businessModel: 'b2b', date: '2026-09-28' };
  window.scrollTo = () => {};
  globalThis.fetch = window.fetch = () => new Promise(() => {});
  const container = document.createElement('div'); document.body.appendChild(container);
  const root = client.createRoot(container);
  await act(async () => { root.render(h(App.ReportPage, { project, setProject() {}, scores, setScores() {}, assessments: {}, setAssessments() {}, apiKey: 'PROXY', onSave() {}, onPrev() {}, profile: { is_admin: true }, compassResults: [] })); });
  const want = 'Smart Electric Power Alliance demonstrates strength in Visionary and Intentional, with opportunities to grow in Sentient and Attentive.';
  const norm = (t) => t.replace(/\s+/g, ' ').trim();
  assert.ok(norm(container.textContent).includes(want), 'full report');
  await act(async () => root.unmount());
  const payload = App.makeClientPayload({ project, scores, benchmark: null });
  const doc = new JSDOM(server.renderToStaticMarkup(h(App.ClientReportView, { payload }))).window.document;
  assert.ok(norm(doc.body.textContent).includes(want), 'client report');
});

test('every summary sentence (screen, plain text, Word) takes its picks from one place', () => {
  const src = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
  assert.ok(!/demonstrates strength in \$\{sortedAttrs\.slice/.test(src), 'plain text');
  assert.ok(!/text: sortedAttrs\.slice\(-?\d/.test(src), 'Word export');
  assert.ok(src.includes('const { strengths, growth } = summaryPicks(sortedAttrs);'), 'screen and client link');
});

// ── Consistent scoring: median of three passes (framework 2.12, v3.112.0) ──

const run = (scores, extra = {}) => ({
  ...Object.fromEntries(Object.entries(scores).map(([k, v]) => [k, { score: v, findings: `findings at ${v}` }])),
  campaignCoherence: { level: 2 }, earnedCreative: { activations: [] },
  footprint: { channels: { earned: { level: 5 } } },
  sustainabilityNarrative: { tenets: { inside: { level: 'buried' } } }, ...extra });
const base8 = { AWAKE: 48, AWARE: 42, REFLECTIVE: 38, ATTENTIVE: 35, COGENT: 45, SENTIENT: 29, VISIONARY: 62, INTENTIONAL: 54 };
const shift = (d) => Object.fromEntries(Object.entries(base8).map(([k, v]) => [k, v + d]));

test('consensus: each attribute is the median of the runs, and the text comes from the run closest to it', async () => {
  const c = await import('../src/lib/consensus.js');
  const combined = c.combineRuns([run(shift(-4)), run(base8), run(shift(6))]);
  for (const [k, v] of Object.entries(base8)) assert.equal(combined[k].score, v, k);
  assert.equal(combined.AWAKE.findings, 'findings at 48', 'text from the representative run');
  assert.deepEqual(combined.AWAKE.runScores, [44, 48, 54]);
  assert.equal(combined.consensus.spread.AWAKE, 10);
  assert.deepEqual(combined.consensus.flagged, [], 'a spread of 10 is not flagged; over 10 is');
  assert.equal(combined.consensus.method, 'median of 3');
});

test('consensus: ordinal judgments take the median; the earned creative lift needs a majority', async () => {
  const c = await import('../src/lib/consensus.js');
  const act = { activations: [{ name: 'Open grid data' }] };
  const r1 = run(base8, { campaignCoherence: { level: 1 }, earnedCreative: act, footprint: { channels: { earned: { level: 3 } } }, sustainabilityNarrative: { tenets: { inside: { level: 'breaking' } } } });
  const r2 = run(base8, { campaignCoherence: { level: 3 }, footprint: { channels: { earned: { level: 5 } } }, sustainabilityNarrative: { tenets: { inside: { level: 'surfacing' } } } });
  const r3 = run(base8, { campaignCoherence: { level: 2 }, footprint: { channels: { earned: { level: 4 } } }, sustainabilityNarrative: { tenets: { inside: { level: 'buried' } } } });
  const one = c.combineRuns([r1, r2, r3]);
  assert.equal(one.campaignCoherence.level, 2);
  assert.equal(one.footprint.channels.earned.level, 4);
  assert.equal(one.sustainabilityNarrative.tenets.inside.level, 'surfacing');
  assert.deepEqual(one.earnedCreative.activations, [], 'found in 1 of 3: no lift');
  const two = c.combineRuns([r1, { ...r2, earnedCreative: act }, r3]);
  assert.equal(two.earnedCreative.activations.length, 1, 'found in 2 of 3: the lift applies');
  assert.equal(two.consensus.activationVotes, '2 of 3');
});

test('consensus: a failed run is left out; no runs at all is an error, not a guess', async () => {
  const c = await import('../src/lib/consensus.js');
  const combined = c.combineRuns([run(base8), null, run(shift(2))]);
  assert.equal(combined.consensus.runs, 2); assert.equal(combined.consensus.requested, 3);
  assert.equal(combined.AWAKE.score, 49, 'median of two is their rounded mean');
  assert.equal(c.combineRuns([null, null, null]), null);
  assert.equal(c.parseScoringRun('no json here'), null);
  assert.equal(c.parseScoringRun('{"AWAKE": {"findings": "no score"}}'), null);
  assert.ok(c.parseScoringRun('text {"AWAKE": {"score": 40}} text'));
});

test('consistency stats: per attribute min, median, max and spread, and the overall range', async () => {
  const c = await import('../src/lib/consensus.js');
  const st = c.consistencyStats([run(shift(-2)), run(base8), run(shift(3)), null, run(shift(1))]);
  assert.equal(st.runs, 4);
  const awake = st.rows.find(r => r.id === 'AWAKE');
  assert.deepEqual([awake.min, awake.median, awake.max, awake.spread], [46, 49, 51, 5]);
  assert.equal(st.overall.min, 42); assert.equal(st.overall.max, 47);
});

test('scoring runs three passes in parallel and combines them in code; the check runs five and saves nothing', () => {
  const src = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
  assert.ok(src.includes('const gathered = await gatherRuns(Array.from({ length: runsWanted }, (_, i) => () => startPass(i)), { earlyFinish: !consistencyCheck });'), 'all passes start at once; the check never finishes early');
  assert.ok(src.includes('callClaude(prompt, apiKey, null, [], 0, true, 12000, meta)'));
  assert.ok(src.includes('const combined = combineRuns(runs);'));
  // v3.118.0: the check keeps its result with the report; the scores themselves never change
  assert.ok(src.includes("const check = { ...consistencyStats(runs), failed: runs.filter(r => !r).length, requested: runsWanted, timing, at: new Date().toISOString() };"));
  assert.ok(src.includes("const withCheck = { ...scores, consistencyCheck: check };"), 'only the check is added');
  const branch = src.slice(src.indexOf('if (consistencyCheck) {\n        const check'), src.indexOf('const combined = combineRuns(runs);'));
  assert.ok(branch.includes('return;') && !branch.includes('applyCampaignModifiers'), 'it returns before any scoring is applied');
  assert.ok(src.includes('await runScoring({ consistencyCheck: 5 });'));
  const lib = readFileSync(new URL('../src/lib/consensus.js', import.meta.url), 'utf8');
  assert.ok(lib.includes('export const SCORING_RUNS = 3;'));
});

// ── Early finish and pass timing (v3.113.0) ──

// A controllable pass: resolves when told to, with the given scores.
const deferred = () => { let res, rej; const p = new Promise((a, b) => { res = a; rej = b; }); return { p, res, rej }; };
const textOf = (r) => ({ text: JSON.stringify(r), usage: { output_tokens: 5000 } });

test('early finish: two passes that agree are used without waiting for the third', async () => {
  const c = await import('../src/lib/consensus.js');
  const d = [deferred(), deferred(), deferred()];
  let clock = 0;
  const pending = c.gatherRuns(d.map(x => () => x.p), { now: () => clock });
  clock = 60000; d[1].res(textOf(run(base8)));
  await new Promise(r => setTimeout(r, 0));
  clock = 70000; d[0].res(textOf(run(shift(3))));
  const g = await pending;
  assert.equal(g.early, true);
  assert.equal(g.wallMs, 70000);
  assert.deepEqual(g.timings.map(t => t.status), ['used', 'used', 'skipped']);
  assert.equal(g.timings[1].outputTokens, 5000);
  const combined = c.combineRuns(g.runs);
  assert.equal(combined.consensus.runs, 2);
  assert.equal(combined.AWAKE.score, 50, 'median of two is their rounded mean');
  d[2].res(textOf(run(shift(20))));
});

test('early finish: passes that disagree, on a score or a discrete call, wait for the third', async () => {
  const c = await import('../src/lib/consensus.js');
  assert.equal(c.EARLY_AGREE, 3);
  assert.equal(c.runsAgree(run(base8), run(shift(3))), true);
  assert.equal(c.runsAgree(run(base8), run(shift(4))), false, 'four points apart');
  assert.equal(c.runsAgree(run(base8), run(base8, { campaignCoherence: { level: 3 } })), false, 'coherence level moves scores');
  assert.equal(c.runsAgree(run(base8), run(base8, { earnedCreative: { activations: [{ name: 'x' }] } })), false, 'earned creative moves scores');
  const d = [deferred(), deferred(), deferred()];
  const pending = c.gatherRuns(d.map(x => () => x.p));
  d[0].res(textOf(run(base8))); d[1].res(textOf(run(shift(8))));
  await new Promise(r => setTimeout(r, 0));
  let settled = false; pending.then(() => { settled = true; });
  await new Promise(r => setTimeout(r, 0));
  assert.equal(settled, false, 'still waiting for the third');
  d[2].res(textOf(run(shift(2))));
  const g = await pending;
  assert.equal(g.early, false);
  assert.equal(c.combineRuns(g.runs).AWAKE.score, 50, 'the median of three');
});

test('early finish: a failed pass never counts as agreement, and the check waits for every pass', async () => {
  const c = await import('../src/lib/consensus.js');
  const d = [deferred(), deferred(), deferred()];
  const pending = c.gatherRuns(d.map(x => () => x.p));
  d[0].rej(new Error('overloaded')); d[1].res(textOf(run(base8)));
  await new Promise(r => setTimeout(r, 0));
  d[2].res(textOf(run(shift(1))));
  const g = await pending;
  assert.equal(g.early, false);
  assert.deepEqual(g.timings.map(t => t.status), ['failed', 'used', 'used']);
  assert.equal(g.errors[0].message, 'overloaded');
  const five = [0, 0, 0, 0, 0].map(() => () => Promise.resolve(textOf(run(base8))));
  const all = await c.gatherRuns(five, { earlyFinish: false });
  assert.deepEqual(all.timings.map(t => t.status), ['used', 'used', 'used', 'used', 'used']);
});

test('timing summary reads plainly, and timings stay out of the client payload', async () => {
  const c = await import('../src/lib/consensus.js');
  const line = c.timingSummary({ early: true, wallMs: 74200, passes: [{ status: 'used', ms: 71000, outputTokens: 5820 }, { status: 'used', ms: 74200, outputTokens: 6010 }, { status: 'skipped' }] });
  assert.equal(line, 'Finished in 74s, early: the first two passes agreed within 3 points. Passes: 71s (5,820 tokens out), 74s (6,010 tokens out), skipped.');
  assert.ok(!/\u2014/.test(line));
  assert.equal(c.timingSummary(null), '');
  const { ATTRIBUTES } = await import('../src/data/rubric.js');
  const scores = Object.fromEntries(ATTRIBUTES.map(a => [a.id, { score: 50, findings: 'f', impact: 'i', runScores: [48, 52] }]));
  scores.consensus = { method: 'median of 2', timing: { early: true, wallMs: 1, passes: [] } };
  const payload = App.makeClientPayload({ project: { brandName: 'Acme', industry: 'energy' }, scores, benchmark: null });
  const json = JSON.stringify(payload);
  assert.ok(!json.includes('consensus') && !json.includes('runScores') && !json.includes('wallMs'));
});

test('the full scoring schema no longer asks for gaps; confidence stays', () => {
  const src = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
  const schema = src.slice(src.indexOf('"AWAKE":      { "score": 0-100'), src.indexOf('"INTENTIONAL":{ "score": 0-100') + 200);
  assert.ok(schema.length > 200);
  assert.ok(!schema.includes('"gaps"'));
  assert.ok(schema.includes('"confidence": "low|medium|high"'));
});

// ── Live progress from streamed passes (v3.114.0) ──

const sse = (evts) => evts.map(e => `event: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`).join('');

test('stream parser: rebuilds the answer from deltas split anywhere, with usage and stop reason', async () => {
  const c = await import('../src/lib/consensus.js');
  const seen = [];
  const p = c.createStreamParser(t => seen.push(t));
  const raw = sse([
    { type: 'message_start', message: { usage: { input_tokens: 9000, output_tokens: 1 } } },
    { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } },
    { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: '{"AWAKE": ' } },
    { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: '{"score": 51}}' } },
    { type: 'message_delta', delta: { stop_reason: 'end_turn' }, usage: { output_tokens: 4800 } },
    { type: 'message_stop' },
  ]);
  for (let i = 0; i < raw.length; i += 7) p.feed(raw.slice(i, i + 7));   // arbitrary chunk boundaries
  const out = p.result();
  assert.equal(out.text, '{"AWAKE": {"score": 51}}');
  assert.equal(out.stopReason, 'end_turn');
  assert.equal(out.usage.output_tokens, 4800);
  assert.equal(out.usage.input_tokens, 9000);
  assert.equal(seen.at(-1), out.text);
  const e = c.createStreamParser(); e.feed(sse([{ type: 'error', error: { type: 'overloaded_error', message: 'Overloaded' } }]));
  assert.equal(e.result().error, 'Overloaded');
});

test('pass progress is read from what the model has written: section, stage and attributes reached', async () => {
  const c = await import('../src/lib/consensus.js');
  assert.deepEqual(c.readPassProgress('').scored, []);
  assert.equal(c.readPassProgress('').progress, 0);
  const mid = c.readPassProgress('{"headline": "h", "trustFindings": [], "sustainabilityNarrative": {}, "footprint": {"verdict": "v"');
  assert.equal(mid.group, 'footprint');
  assert.deepEqual(mid.doneGroups, ['trust', 'principles']);
  const late = c.readPassProgress('{"headline": "h", "campaignCoherence": {}, "AWAKE": { "score": 55, "findings": "x" }, "AWARE": {"score":4');
  assert.deepEqual(late.scored, ['AWAKE', 'AWARE']);
  assert.ok(late.doneGroups.includes('footprint'), 'a stage the model moved past counts as done even if it skipped it');
  assert.ok(!late.doneGroups.includes('earned'), 'earned creative is written last');
  assert.ok(late.progress > mid.progress && late.progress < 0.98);
  assert.equal(c.readPassProgress('"findings": "AWAKE is strong"').scored.length, 0, 'an attribute named in prose is not a score');
});

test('the bar follows the pass that sets the pace, and the stage list follows it too', async () => {
  const c = await import('../src/lib/consensus.js');
  const p = (status, progress, group = 'attributes', doneGroups = []) => ({ status, progress, group, doneGroups });
  assert.equal(c.overallProgress([p('running', 0.6), p('running', 0.4), p('running', 0.2)]), 0.4, 'second fastest until two are done');
  assert.equal(c.overallProgress([p('done', 1), p('done', 1), p('running', 0.5)]), 0.5, 'then the one still running');
  assert.equal(c.overallProgress([p('failed', 0), p('running', 0.7), p('running', 0.3)]), 0.3, 'a failed pass is ignored');
  assert.equal(c.overallProgress([p('done', 1), p('done', 1), p('skipped', 0.6)]), 1);
  const st = c.stageStates([p('running', 0.5, 'attributes', ['trust', 'principles', 'footprint', 'coherence']), p('running', 0.4, 'coherence', ['trust', 'principles', 'footprint']), p('running', 0.1, 'trust')]);
  assert.deepEqual(st.map(s => s.state), ['done', 'done', 'done', 'current', 'waiting', 'waiting'], 'from the second-fastest pass');
});

test('the outcome line says how the passes ended, and the recap tallies the readouts honestly', async () => {
  const c = await import('../src/lib/consensus.js');
  assert.equal(c.outcomeLine({ early: true, timings: [{ status: 'used' }, { status: 'used' }, { status: 'skipped' }] }), 'The first two passes agreed within 3 points, so the third was not needed.');
  assert.equal(c.outcomeLine({ early: false, timings: [{ status: 'used' }, { status: 'used' }, { status: 'used' }] }), 'The passes differed, so the Compass kept the middle score of the three.');
  assert.equal(c.outcomeLine({ early: false, timings: [{ status: 'failed' }, { status: 'used' }, { status: 'used' }] }), 'One pass did not return. The other two were combined.');
  const rows = c.evidenceRecap({
    website: { content: 'site', techAudit: { scores: {} } },
    social: { noSocialPresence: true },
    aiReputation: { claudeManual: 'a', geminiManual: 'b', wikipediaContent: 'w' },
    earnedMedia: {},
  }, { websiteUrl: 'https://www.mkb.com/about', additionalProperties: [{ url: 'https://shop.mkb.com' }] });
  assert.deepEqual(rows.map(r => r.detail), ['mkb.com \u00b7 2 properties \u00b7 technical audit', 'No social presence, confirmed', '2 of 5 AI engines \u00b7 Wikipedia', 'Not completed']);
  assert.equal(rows[3].missing, true);
  for (const r of rows) assert.ok(!/\u2014/.test(r.detail));
});

test('scoring streams through the proxy, and only when asked; the check does not stream', () => {
  const api = readFileSync(new URL('../api/claude.js', import.meta.url), 'utf8');
  assert.ok(api.includes('const streaming = !!stream && !useWebSearch;'));
  assert.ok(api.includes("res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');"));
  assert.ok(api.includes('await requireUser(req, res)'), 'streaming sits behind the same sign-in check');
  const src = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
  assert.ok(src.includes("...(meta?.onText ? { stream: true } : {})"));
  assert.ok(src.includes("const meta = consistencyCheck ? {} : { onText: (text) => { live[i].text = text; } };"));
  assert.ok(src.includes('await new Promise(r => setTimeout(r, OUTCOME_HOLD_MS));'));
});

test('teaser read page 4: the rule between evidence items clears the next claim', () => {
  const src = readFileSync(new URL('../src/lib/teaserReport.js', import.meta.url), 'utf8');
  assert.ok(src.includes('cy += EVIDENCE_GAP + Math.round(13.5 * 0.75);'), 'the gap below a rule includes the claim cap height, since y is a baseline');
  assert.ok(!src.includes('if (i < items.length - 1) { d.rule(x, cy, colW); cy += 10; }'));
});

test('QA v3.117.0: the step bar marks the page you are on, and no escape code reaches the screen', async () => {
  const src = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
  assert.ok(src.includes('<ProgressSteps currentStep={currentStep - 1} steps={steps}'), 'Website (page 2) is step index 1');
  const steps = ['Setup', 'Website', 'Social', 'AI Rep', 'Earned', 'Report'].map((n, i) => ({ id: String(i), name: n }));
  const doc = new JSDOM(server.renderToStaticMarkup(h(App.ProgressSteps, { currentStep: 2 - 1, steps }))).window.document;
  assert.equal(doc.querySelector('li[aria-current="step"] b').textContent, 'Website');
  assert.ok(doc.querySelector('.dc-steps-compact strong').textContent.startsWith('Step 2 of 6'));
  const { ATTRIBUTES } = await import('../src/data/rubric.js');
  const scores = { headline: 'A headline.', ...Object.fromEntries(ATTRIBUTES.map(a => [a.id, { score: 50, findings: 'f', impact: 'i' }])) };
  const payload = App.makeClientPayload({ project: { brandName: 'Acme', industry: 'energy' }, scores, benchmark: null });
  const html = server.renderToStaticMarkup(h(App.ClientReportView, { payload }));
  assert.ok(!/\\u[0-9a-f]{4}/i.test(html), 'no literal \\uXXXX in the client view');
  assert.ok(html.includes('0\u201325') && html.includes('\u201cA headline.\u201d'));
  assert.ok(!src.includes('<span>{st.min}\\u2013{st.max}</span>'));
});

test('Insights tab is gone from Compare; its weekly job stays for the newsletter', () => {
  const src = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
  assert.ok(!src.includes('function InsightsView(') && !src.includes("setViewMode('insights')"));
  assert.ok(!existsSync(new URL('../api/insights-analysis.js', import.meta.url)));
  assert.ok(existsSync(new URL('../api/refresh-insights-analysis.js', import.meta.url)), 'feeds the newsletter story opportunities');
});

test('Saved: one row per brand, latest first; clicking the brand shows its earlier assessments (v3.118.0)', async () => {
  const row = (id, brand, at) => ({ id, project: { brandName: brand, industry: 'energy' }, assessments: {}, scores: null, savedAt: at, updatedAt: at });
  const rows = [row('a1', 'Alpha', '2026-03-01T12:00:00Z'), row('b1', 'Beta', '2026-05-01T12:00:00Z'), row('a2', 'Alpha', '2026-09-01T12:00:00Z'), row('a3', 'alpha ', '2026-01-01T12:00:00Z')];
  const container = document.createElement('div'); document.body.appendChild(container);
  const root = client.createRoot(container);
  await act(async () => { root.render(h(App.SavedAssessmentsPage, { assessments: rows, onLoad() {}, onDelete() {}, onImport() {}, onExport() {}, onShare() {}, onRescore() {}, profile: { is_admin: true }, onRetry() {} })); });
  const heads = () => [...container.querySelectorAll('.dc-saved-group > .dc-listrow:not(.is-history)')];
  assert.equal(heads().length, 2, 'two brands');
  assert.equal(heads()[0].querySelector('.dc-listrow-m').textContent.includes('saved Sep 1, 2026'), true, 'Alpha shows its latest');
  assert.ok(heads()[0].textContent.includes('2 earlier assessments'));
  assert.equal(container.querySelectorAll('.dc-listrow.is-history').length, 0, 'closed by default');
  const toggle = container.querySelector('.dc-listrow-toggle');
  assert.equal(toggle.getAttribute('aria-expanded'), 'false');
  await act(async () => { toggle.click(); });
  const older = [...container.querySelectorAll('.dc-listrow.is-history .dc-listrow-m')].map(m => m.textContent);
  assert.equal(older.length, 2);
  assert.ok(older[0].includes('Mar 1, 2026') && older[1].includes('Jan 1, 2026'), 'newest first');
  await act(async () => root.unmount());
});

test('saving goes by record id, and every scoring run is saved as it finishes (v3.118.0)', () => {
  const sb = readFileSync(new URL('../src/lib/supabase.js', import.meta.url), 'utf8');
  const save = sb.slice(sb.indexOf('export const saveAssessment'), sb.indexOf('export const deleteAssessment'));
  assert.ok(!save.includes(".eq('brand_name'"), 'no longer matched by brand name');
  assert.ok(save.includes(".eq('id', id)") && save.includes('.insert(assessmentData)'));
  const src = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
  assert.ok(src.includes('const autoSaved = await onSave({ quiet: true, scoresOverride: finalScores, newRun: true });'), 'saved on generation');
  assert.ok(src.includes('}, { id: project.savedId || null });'), 'a rescore updates its own record; a new assessment has no id');
  assert.ok(src.includes("setProject({ ...data.project, savedId: data.id || data.project?.savedId || null });"), 'a loaded report remembers its record');
  assert.ok(src.includes('if (newRun) delete projectToSave.resultId;'), 'one Results history entry per scoring run');
  assert.ok(src.includes(': await saveCompassResult(resultData);') && src.includes('? await updateCompassResult(resultId, resultData)'), 'a later save updates that entry');
});

test('the radar shows the overall score at its centre (v3.118.0)', () => {
  const src = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
  assert.ok(src.includes('<SpiderChart scores={scores} total={overall} />'));
  assert.ok(src.includes('<g data-field="radar-total">'));
});

test('the sector lens reads real estate, health and energy brands by their own type, in full scoring too (framework 2.13)', async () => {
  const sp = await import('../src/data/sectorProfiles.js');
  for (const id of ['realestate', 'healthcare', 'energy']) {
    const block = sp.sectorPromptBlock(id, 'x');
    assert.ok(block.includes('Brand types in this sector differ'), `${id} names its brand types`);
    assert.ok(block.includes('Weak indicators in this sector, which must not be treated as gaps'), id);
    assert.ok(!/[\u2014\u2013]/.test(block), `${id}: no em dashes`);
  }
  assert.ok(sp.sectorPromptBlock('healthcare').includes('regulatory restraint'));
  assert.ok(sp.sectorPromptBlock('media', 'Media').includes('No written profile exists'), 'other sectors keep the general guidance');
  const src = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
  const prompt = src.slice(src.indexOf('const prompt = `You are scoring ${project.brandName} against the Conscious Compass Framework'));
  assert.ok(prompt.slice(0, 600).includes('${sectorPromptBlock(project.industry,'), 'the full scoring prompt carries the lens');
});

test('the full report: Word export without forced page breaks, in the teaser read system, and the pack image stays internal (v3.119.0)', () => {
  const src = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
  const docx = src.slice(src.indexOf('const generateDocx = async'), src.indexOf('// ── Assessment Pack (v3.119.0)'));
  assert.ok(!docx.includes('pageBreakBefore') && !docx.includes(', true),'), 'no forced page breaks');
  for (const part of ["eyebrow('Brand under review')", "secHead('Trust, credibility, reputation and authenticity', 'The evidence')", "secHead('Earned creative', 'How earned creative could help')", 'headers: { default: new DocxHeader', 'clientEcoSection(scores, project.brandName)'])
    assert.ok(docx.includes(part), part);
  assert.ok(!docx.includes('#F59E0B') && !docx.includes('s.color'), 'the rainbow stage colors are gone from the maturity bar');
  const payload = App.makeClientPayload({ project: { brandName: 'Acme', industry: 'energy', heroImage: 'data:image/jpeg;base64,SENTINEL_IMG', savedId: 'SENTINEL_ID' }, scores: { headline: 'H', consistencyCheck: { at: 'SENTINEL_CHECK' } }, benchmark: null });
  const json = JSON.stringify(payload);
  ['SENTINEL_IMG', 'SENTINEL_ID', 'SENTINEL_CHECK'].forEach(t => assert.ok(!json.includes(t), t));
  assert.ok(src.includes('const { heroImage: _img, savedId: _sid, resultId: _rid, ...shareProject } = assessment.project || {};'), 'the share link drops them too');
});

test('the score adjustment is internal only: never in the Word file or a client view (v3.120.0)', () => {
  const src = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
  const docx = src.slice(src.indexOf('const generateDocx = async'), src.indexOf('// ── Assessment Pack (v3.119.0)'));
  assert.ok(!docx.includes("h3('Score adjustment')") && !/th\('Campaign'/.test(docx), 'gone from the Word file');
  assert.ok(src.includes('{showInternal && campaignAffected.length > 0 && campaignStage && ('), 'the panel needs showInternal');
});

test('Compare: the page head is one row of text buttons, as on Results and Saved (v3.121.0)', () => {
  const doc = new JSDOM(server.renderToStaticMarkup(h(App.ComparisonPage, { results: RESULTS, profile: { is_admin: true }, copyDeepLink() {}, onRetry() {} }))).window.document;
  const head = doc.querySelector('[data-field="compare-head"]');
  assert.ok(head.classList.contains('dc-head-row'));
  assert.equal(head.querySelector('h1.dc-display').textContent, 'Compare');
  const actions = head.querySelector('.dc-head-actions');
  assert.deepEqual([...actions.querySelectorAll('button')].map(b => b.textContent), ['Share link', 'Export comparison']);
  assert.equal(actions.querySelectorAll('svg').length, 0, 'text buttons, no icons');
  assert.equal(doc.querySelector('.dc-btns'), null, 'the unstyled class is gone');
});

test('Check consistency is for admins only', async () => {
  const { ATTRIBUTES } = await import('../src/data/rubric.js');
  const scores = Object.fromEntries(ATTRIBUTES.map(a => [a.id, { score: 50, findings: 'f' }]));
  window.scrollTo = () => {};
  globalThis.fetch = window.fetch = () => new Promise(() => {});
  const project = { brandName: 'MKB', websiteUrl: 'https://mkb.com', industry: 'energy', businessModel: 'b2b', date: '2026-09-28' };
  for (const [isAdmin, want] of [[true, 1], [false, 0]]) {
    const container = document.createElement('div'); document.body.appendChild(container);
    const root = client.createRoot(container);
    await act(async () => { root.render(h(App.ReportPage, { project, setProject() {}, scores, setScores() {}, assessments: {}, setAssessments() {}, apiKey: 'PROXY', onSave() {}, onPrev() {}, profile: { is_admin: isAdmin }, compassResults: [] })); });
    assert.equal(container.querySelectorAll('[data-field="consistency"]').length, want, `admin ${isAdmin}`);
    await act(async () => root.unmount());
  }
});

test('every model call uses the one pinned model ID', () => {
  // From the 4.6 generation, a dateless ID such as claude-sonnet-4-6 is a fixed
  // snapshot: Anthropic ships an updated model under a new ID, never behind an
  // existing one. So scores cannot drift from a silent model change.
  const files = ['../src/App.jsx', ...readdirSync(new URL('../api/', import.meta.url)).filter(f => f.endsWith('.js')).map(f => `../api/${f}`)];
  const ids = new Set();
  for (const f of files) for (const m of readFileSync(new URL(f, import.meta.url), 'utf8').matchAll(/['"`](claude-[a-z]+-[0-9][a-z0-9-]*)['"`]/g)) ids.add(m[1]);
  assert.deepEqual([...ids], ['claude-sonnet-4-6']);
});
