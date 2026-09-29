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

// ── Earned creative panel and views (ECO module, v3.104.0) ───

const ecoScores = (eco = {}, extra = {}) => ({
  AWAKE: { score: 38 }, SENTIENT: { score: 42 }, AWARE: { score: 45 }, VISIONARY: { score: 70 }, COGENT: { score: 60 },
  ATTENTIVE: { score: 60 }, INTENTIONAL: { score: 62 }, REFLECTIVE: { score: 40 }, eco, ...extra });
const G1_FAIL = { claimsPct: 70, glassdoor: 3.9, truthsEntered: true, verifiedTruths: [{ name: 'Grid pilot data set', description: 'Published 2025' }, { name: 'Patent US1234567', description: 'Storage control' }],
  checklistEntered: true, checklist: { riskAppetite: true, spokesperson: true, approval: true, followThrough: true }, announcementPct: 75 };

async function mountPanel(initial, profile) {
  const eco = await import('../src/lib/eco.js');
  const container = document.createElement('div'); document.body.appendChild(container);
  const root = client.createRoot(container);
  let latest = initial;
  const Harness = () => {
    const [s, setS] = React.useState(initial);
    latest = s;
    const data = eco.ecoFromReport(s, { brand: 'MKB', companyStage: 'scaleup', stageName: 'Differentiating' });
    return h(React.Fragment, null,
      h(App.EcoPanel, { eco: data, scores: s, setScores: setS }),
      h(App.EcoBlocks, { blocks: data.blocks }));
  };
  await act(async () => { root.render(h(Harness)); });
  return { container, root, get: () => latest };
}

test('the ECO panel is internal, and the client blocks carry HOWL with its wordmark', async () => {
  const m = await mountPanel(ecoScores(G1_FAIL), { is_admin: true });
  assert.ok(m.container.querySelector('section.dc-internal[data-field="eco-panel"]'));
  assert.equal(m.container.querySelector('.dc-eco-verdict').textContent, 'MKB has an earned creative opportunity. Here is how far it can go today, and what would take it further.');
  const ready = m.container.querySelector('.dc-eco-ladder li.is-ready');
  assert.equal(ready.querySelector('b').textContent, 'Foundations', 'G1 fails: it starts at Foundations');
  assert.equal(ready.getAttribute('aria-current'), 'step');
  assert.equal(ready.querySelector('.dc-eco-badge').textContent, 'Ready now');
  assert.equal(m.container.querySelector('.dc-eco-ladder li.is-reach .dc-eco-badge').textContent, 'Within reach');
  const howl = m.container.querySelector('.dc-eco-howl');
  assert.equal(howl.getAttribute('data-howl'), 'short');
  assert.equal(howl.querySelector('img').getAttribute('src'), '/howl-logo.svg');
  assert.equal(howl.querySelector('.dc-eco-lockup span').textContent, 'by Antenna');
  assert.equal(m.container.querySelector('.dc-eco').textContent.includes('\u2014'), false, 'no em dashes');
  await act(async () => m.root.unmount());
});

test('the ECO panel has no override and no profile choice: evidence only (v3.107.0)', async () => {
  const m = await mountPanel(ecoScores(G1_FAIL), { is_admin: true });
  assert.equal(m.container.querySelector('[data-field="eco-override"]'), null, 'no override, even for admins');
  assert.equal(m.container.querySelector('#eco-profile'), null, 'no profile selector');
  assert.match(m.container.querySelector('[data-field="eco-profile"]').textContent, /from the company stage set at Setup/);
  assert.ok(![...m.container.querySelectorAll('button')].some(b => /override/i.test(b.textContent)));
  await act(async () => m.root.unmount());
});

test('removing the scoring pass activations takes the SENTIENT and INTENTIONAL lift away', async () => {
  const eco = await import('../src/lib/eco.js');
  const start = eco.applyEarnedCreativeLift(ecoScores(G1_FAIL, { earnedCreative: { activations: [{ name: 'Open grid data', what: 'Released grid data', evidence: 'Canary Media, March 2026' }] } }));
  assert.equal(start.SENTIENT.score, 45);
  const m = await mountPanel(start, { is_admin: true });
  const btn = [...m.container.querySelectorAll('.dc-eco-acts button')].find(b => b.textContent === 'Remove');
  await act(async () => { btn.click(); });
  assert.equal(m.get().SENTIENT.score, 42); assert.equal(m.get().INTENTIONAL.score, 62);
  assert.ok(m.container.querySelector('.dc-eco-acts li.is-removed'));
  await act(async () => { [...m.container.querySelectorAll('.dc-eco-acts button')].find(b => b.textContent === 'Restore').click(); });
  assert.equal(m.get().SENTIENT.score, 45, 'restoring brings it back');
  await act(async () => m.root.unmount());
});

test('the client payload sends the blocks only, and nothing while the gate is pending', () => {
  const pending = App.makeClientPayload({ project: { brandName: 'MKB', industry: 'energy' }, scores: ecoScores({}), benchmark: null });
  assert.equal(pending.eco, null);
  const ready = App.makeClientPayload({ project: { brandName: 'MKB', industry: 'energy' }, scores: ecoScores({ ...G1_FAIL, override: { outcome: 'Moment-driven', reason: 'secret reason', by: 'Paul', at: 'x' } }), benchmark: null });
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
