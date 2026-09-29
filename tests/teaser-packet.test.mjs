// v3.98.0: teaser screens 19-21 rebuilt to the packet.
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
globalThis.confirm = window.confirm = () => true;
globalThis.fetch = window.fetch = async () => ({ ok: false, status: 404, json: async () => ({}) });

let React, client, server, act, App, stub, logic, rubric, h;
before(async () => {
  React = (await import('react')).default;
  client = await import('react-dom/client');
  server = await import('react-dom/server');
  act = React.act;
  h = (...a) => React.createElement(...a);
  App = await import('./.build/app.bundle.mjs');
  stub = await import('./support/supabase.stub.mjs');
  logic = await import('../src/lib/teaser.js');
  rubric = await import('../src/data/rubric.js');
});
const flush = () => new Promise(r => setTimeout(r, 0));
const fixture = (f) => new JSDOM(readFileSync(new URL(`./fixtures/design/${f}`, import.meta.url), 'utf8')).window.document;

function scored(base) {
  const o = { headline: 'Acme is credible in trade press and invisible elsewhere.', summary: 'Verdict first.', fullAssessmentWouldResolve: ['Q'], trustFindings: [], campaignCoherence: { level: 1, confidence: 'low' } };
  rubric.ATTRIBUTES.forEach((a, i) => { o[a.id] = { score: base + (i % 3), confidence: 'medium', rationale: 'r' }; });
  return logic.finaliseTeaser(logic.parseTeaserScoring(JSON.stringify(o)));
}
async function mountList(teasers, campaigns) {
  stub.state.teasers = teasers; stub.state.campaigns = campaigns; stub.state.compassRows = []; stub.calls.length = 0;
  const container = document.createElement('div'); document.body.appendChild(container);
  const root = client.createRoot(container);
  await act(async () => { root.render(h(App.TeaserPage, { user: { id: 'u1' }, profile: { is_admin: true, full_name: 'Paul Newton' }, apiKey: 'PROXY', onConvert: () => true })); });
  for (let i = 0; i < 5; i++) await act(flush);
  return { container, root };
}
const T = (id, campaign, result, extra = {}) => ({ id, campaign_id: campaign, brand_name: id.toUpperCase(), website_url: `https://${id}.com`, industry: 'energy', business_model: 'b2b', created_by_name: 'Paul Newton', updated_at: '2026-09-26T12:00:00Z', result, ...extra });
const reportProps = (record) => ({ record, busy: false, progress: null, error: null, campaigns: [{ id: 'c-1', name: 'One' }], baseline: null, onBack() {}, onRescore() {}, onRefresh() {}, onConvert() {}, onDelete() {} });

test('19: campaign groups and rows take the packet structure', async () => {
  const { container, root } = await mountList(
    [T('sepa', 'c-1', scored(56), { converted_at: '2026-09-26T12:00:00Z' }), T('mkb', 'c-1', scored(43)), T('north', 'c-1', null), T('lone', null, scored(35))],
    [{ id: 'c-1', name: 'Climate Week NYC 2026', cso_audience: true }, { id: 'c-2', name: 'Empty', cso_audience: false }]);
  const group = container.querySelector('section.dc-camp[data-campaign="c-1"]');
  const design = fixture('19-teaser-list.html').querySelector('section.dc-camp[data-campaign="c-1"]');
  const shape = (el) => [...el.querySelectorAll('header *')].map(e => `${e.tagName.toLowerCase()}.${[...e.classList].sort().join('.')}`);
  assert.deepEqual(shape(group), shape(design), 'the campaign head matches the packet');
  const rows = [...group.querySelectorAll('ul.dc-camp-list > li > a.dc-tz-row')];
  assert.equal(rows.length, 3);
  const row = rows[0];
  assert.deepEqual([...row.children].map(c => c.className), ['dc-tz-score', 'dc-tz-who', 'dc-tz-lenses', 'dc-tz-status']);
  const overall = Number(row.querySelector('.dc-stat-n').textContent);
  assert.equal(row.querySelector('.dc-pill').textContent, rubric.getMaturityStage(overall).name, 'the band comes from the rubric');
  assert.deepEqual([...row.querySelectorAll('.dc-tz-lenses dt')].map(d => d.textContent), ['CRD', 'TRS', 'REP', 'AUT']);
  assert.equal(row.querySelector('.dc-tz-status').textContent, 'Converted');
  const unscored = rows.find(r => r.classList.contains('is-unscored'));
  assert.equal(unscored.querySelector('.dc-stat-n').textContent, '—');
  assert.equal(unscored.querySelector('.dc-tz-status').textContent, 'Not scored');
  assert.equal(group.querySelector('.dc-toggle').getAttribute('aria-pressed'), 'true');
  assert.equal(container.querySelector('[data-campaign="c-2"] .dc-toggle').getAttribute('aria-pressed'), 'false');
  assert.equal(container.querySelector('[data-campaign="unassigned"] .dc-camp-actions'), null, 'Unassigned has no actions');
  assert.equal(container.querySelectorAll('[data-campaign="c-1"] button.btn-primary').length, 0, 'Download scores is secondary');
  assert.equal(container.querySelectorAll('svg.lucide').length, 0, 'no icons');
  await act(async () => root.unmount());
});

test('19: the new teaser form keeps Sector and Company stage, with labelled fields', async () => {
  const { container, root } = await mountList([], [{ id: 'c-1', name: 'One' }]);
  const form = container.querySelector('section.dc-block.dc-tz-form');
  for (const id of ['tz-campaign', 'tz-brand', 'tz-url', 'tz-model', 'tz-industry', 'tz-stage', 'tz-context']) {
    assert.ok(form.querySelector(`#${id}`), id);
    assert.ok(form.querySelector(`label[for="${id}"]`), `${id} is labelled`);
  }
  assert.equal(form.querySelector('.dc-form-actions .btn-primary').textContent, 'Run teaser');
  await act(async () => root.unmount());
});

test('20: the run lists every source with its real status, counts what is done, and marks failures', () => {
  const statuses = { website: 'ok', social: 'failed', aiPerception: 'running', thirdParty: 'pending', earned: 'ok' };
  const doc = new JSDOM(server.renderToStaticMarkup(h(App.TeaserProgress, { statuses, scoring: 'pending', elapsed: 48 }))).window.document;
  const sec = doc.querySelector('section.dc-block.dc-tz-run');
  assert.equal(sec.querySelector('.dc-tz-timer').textContent, '0:48');
  const lis = [...sec.querySelectorAll('ol.dc-passes > li')];
  const byId = Object.fromEntries(lis.map(li => [li.getAttribute('data-source'), li]));
  assert.equal(byId.website.className, 'is-done');
  assert.equal(byId.social.className, 'is-done is-failed');
  assert.equal(byId.social.querySelector('em').textContent, 'Failed');
  assert.equal(byId.aiPerception.className, 'is-current');
  assert.equal(byId.scoring.querySelector('em').textContent, 'Waiting');
  assert.equal(byId.sustainability, undefined, 'no sustainability row outside CSO campaigns');
  assert.equal(sec.querySelector('.dc-scoring-count .dc-stat-n').textContent, '3');
  assert.equal(sec.querySelector('.dc-scoring-count .dc-meta').textContent, `of ${lis.length} steps complete`);
  assert.equal(sec.querySelector('[role="progressbar"]').getAttribute('aria-valuenow'), '3');
  const cso = new JSDOM(server.renderToStaticMarkup(h(App.TeaserProgress, { statuses: { ...statuses, sustainability: 'running' }, scoring: 'pending', elapsed: 0 }))).window.document;
  assert.ok(cso.querySelector('[data-source="sustainability"]').textContent.includes('CSO campaigns only'));
});

test('20/21: toolbar, notice and internal panel take the packet structure, and no stage warning shows before a score', () => {
  const rec = T('acme', 'c-1', null, { stage: 'scaleup', context: 'Met at Climate Week.',
    evidence: { gatheredAt: '2026-09-26T12:00:00Z', sources: { website: { status: 'ok', pages: [{ url: 'x', text: 't' }] }, social: { status: 'failed', error: 'Not found' }, aiPerception: { status: 'ok' }, thirdParty: { status: 'ok' }, earned: { status: 'ok' } } } });
  const doc = new JSDOM(server.renderToStaticMarkup(h(App.TeaserReport, reportProps(rec)))).window.document;
  assert.ok(doc.querySelector('.dc-tz-toolbar > a.dc-tz-back'));
  assert.ok(doc.querySelector('.dc-tz-toolbar .dc-head-actions .dc-link-btn.is-danger'));
  assert.ok(doc.querySelector('.dc-alert.is-warn[data-field="scorecard-blocked"]'));
  const panel = doc.querySelector('section.dc-internal');
  assert.deepEqual([...panel.querySelectorAll('dl.dc-internal-dl > dt')].map(d => d.textContent), ['Campaign', 'Company stage', 'Evidence', 'Baseline', 'Brand image', 'Context']);
  assert.equal(panel.querySelector('.dc-src.is-failed').getAttribute('title'), 'Not found', 'failure detail stays in the tooltip');
  assert.equal(panel.querySelector('[data-field="stage-pending"]'), null, 'nothing is "scored without a stage" before any score');
  assert.ok(!doc.body.textContent.includes('Rescore to apply it'), 'no rescore prompt before a first score');
  assert.equal(doc.querySelectorAll('svg.lucide').length, 0, 'no icons');
});

test('21: once scored at a different stage, the stage warning does show', () => {
  const rec = T('acme', 'c-1', { ...scored(50), companyStage: 'startup' }, { stage: 'scaleup', evidence: { sources: {} } });
  const doc = new JSDOM(server.renderToStaticMarkup(h(App.TeaserReport, reportProps(rec)))).window.document;
  assert.ok(doc.querySelector('[data-field="stage-pending"]').textContent.includes('Scored at the Startup stage'));
});

test('21: the read keeps the self-sizing trust lens scale, not the packet\'s fixed 35 to 55', () => {
  const doc = new JSDOM(server.renderToStaticMarkup(h(App.TeaserReport, reportProps(T('acme', 'c-1', scored(72), { evidence: { sources: {} } }))))).window.document;
  const scale = doc.querySelector('#trust-lens .dc-scale');
  assert.ok(!scale.getAttribute('aria-label').includes('35 to 55'), 'a strong teaser is not pinned to the right edge');
  const left = parseFloat(scale.querySelector('.dc-scale-track > i').style.left);
  assert.ok(left > 0 && left < 100, `marker inside the scale (${left}%)`);
  assert.ok(doc.querySelector('footer.dc-method'));
  assert.equal(doc.querySelector('[data-teaser-client-view]').tagName, 'ARTICLE');
});
