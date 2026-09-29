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
