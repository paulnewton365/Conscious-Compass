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
      h(App.EcoPanel, { eco: data, scores: s, setScores: setS, isAdmin: profile.is_admin, userName: 'Paul Newton', companyStage: 'scaleup' }),
      h(App.EcoBlocks, { blocks: data.blocks }));
  };
  await act(async () => { root.render(h(Harness)); });
  return { container, root, get: () => latest };
}

test('the ECO panel is internal, and the client blocks carry HOWL with its wordmark', async () => {
  const m = await mountPanel(ecoScores(G1_FAIL), { is_admin: true });
  assert.ok(m.container.querySelector('section.dc-internal[data-field="eco-panel"]'));
  const verdict = m.container.querySelector('.dc-eco-verdict').textContent;
  assert.equal(verdict, 'Earned creative could close a real gap for your brand, once the foundations are in place.', 'G1 fails: Build substance first');
  const howl = m.container.querySelector('.dc-eco-howl');
  assert.equal(howl.getAttribute('data-howl'), 'short');
  assert.equal(howl.querySelector('img').getAttribute('src'), '/howl-logo.svg');
  assert.equal(howl.querySelector('.dc-eco-lockup span').textContent, 'by Antenna');
  assert.equal(m.container.querySelector('.dc-eco').textContent.includes('\u2014'), false, 'no em dashes');
  await act(async () => m.root.unmount());
});

test('overrides: admin-only, need a reason, store who and when, and cannot recommend past a failed G1', async () => {
  const noAdmin = await mountPanel(ecoScores(G1_FAIL), { is_admin: false });
  assert.equal(noAdmin.container.querySelector('[data-field="eco-override"]'), null, 'not for non-admins');
  await act(async () => noAdmin.root.unmount());

  const m = await mountPanel(ecoScores(G1_FAIL), { is_admin: true });
  const set = async (sel, v) => {
    const el = m.container.querySelector(sel);
    const proto = el.tagName === 'SELECT' ? window.HTMLSelectElement.prototype : window.HTMLInputElement.prototype;
    await act(async () => { Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, v); el.dispatchEvent(new window.Event(el.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true })); });
  };
  const apply = () => [...m.container.querySelectorAll('button')].find(b => b.textContent === 'Apply override');
  await set('#eco-oo', 'Recommend'); await set('#eco-or', 'Client insists.');
  await act(async () => { apply().click(); });
  assert.match(m.container.querySelector('[data-field="eco-override"] .dc-error').textContent, /G1 Proof threshold failed/);
  assert.equal(m.get().eco.override, undefined, 'nothing stored');
  await set('#eco-oo', 'Moment-driven'); await set('#eco-or', '');
  await act(async () => { apply().click(); });
  assert.match(m.container.querySelector('[data-field="eco-override"] .dc-error').textContent, /needs a reason/);
  await set('#eco-or', 'A launch moment in Q1.');
  await act(async () => { apply().click(); });
  const o = m.get().eco.override;
  assert.equal(o.outcome, 'Moment-driven'); assert.equal(o.reason, 'A launch moment in Q1.'); assert.equal(o.by, 'Paul Newton'); assert.ok(o.at);
  assert.equal(m.container.querySelector('.dc-eco-verdict').textContent, 'Your brand is ready for earned creative when the right moment arrives.');
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
  assert.ok(lite.textContent.includes('Appropriateness: requires full assessment.'));
});
