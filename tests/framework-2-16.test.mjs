// Framework 2.16 (v4.18.0): search evidence gathered when setup is completed
// and fed into the website, AI reputation and earned media analyses. The AI
// reputation step's model-written Search snapshot and Google News are
// replaced by the measured data.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import * as se from '../src/lib/searchEvidence.js';
import * as rubric from '../src/data/rubric.js';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://compass.test/', pretendToBeVisual: true });
globalThis.window = dom.window;
for (const k of Object.getOwnPropertyNames(dom.window)) {
  if (k in globalThis) continue;
  try { Object.defineProperty(globalThis, k, { value: dom.window[k], configurable: true, writable: true }); } catch { /* read-only */ }
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let App, React, server, client;
before(async () => {
  React = (await import('react')).default;
  server = await import('react-dom/server');
  client = await import('react-dom/client');
  App = await import('./.build/app.bundle.mjs');
});
const h = (...a) => React.createElement(...a);
const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');

const d = (n) => new Date(Date.now() - n * 864e5).toISOString();
const EVIDENCE = {
  status: 'ok', markets: ['us'], gatheredAt: '2026-11-04T05:00:00.000Z', searches: 8, failures: [], labelStatus: 'ok',
  aio: se.measureAio([{ query: 'a', aiOverview: { present: true, sources: [{ domain: 'artera.ai' }] } }], 'artera.ai'),
  ranking: se.measureRanking([{ query: 'patient messaging', organic: [{ position: 3, domain: 'artera.ai' }] }], 'artera.ai'),
  byMarket: { us: {
    brandPage: se.measureBrandPage({ organic: [{ position: 1, domain: 'artera.io' }, { position: 2, domain: 'artera.ai' }], knowledgeGraph: { present: false } }, { P: { Pus0: 'other' } }, 'us', 'artera.ai'),
    autocomplete: se.measureAutocomplete(['artera reviews'], {}, 'us', 'Artera'),
    news: se.measureNews([{ title: 'Artera raises', source: 'Fierce Healthcare', publishedAt: d(5) }], {}, 'us'),
  } },
};
const SEARCH = { evidence: EVIDENCE, audience: { searches: 15 }, gatheredAt: '2026-11-04T05:00:00.000Z', inputsKey: 'artera|https://artera.ai|scaleup' };
const PROJECT = { brandName: 'Artera', websiteUrl: 'https://artera.ai', companyStage: 'scaleup', industry: 'health', businessModel: 'b2b' };

test('framework 2.16', () => {
  assert.equal(rubric.FRAMEWORK_VERSION, '2.16');
});

// ── Each step gets its own signals ──

test('each step’s analysis carries only its own signals', () => {
  const web = se.stepSearchBlock(EVIDENCE, 'website');
  assert.ok(web.includes('Niche ranking') && !web.includes('Google News') && !web.includes('Autocomplete') && !web.includes('AI Overviews'));
  const ai = se.stepSearchBlock(EVIDENCE, 'aiReputation');
  assert.ok(ai.includes('AI Overviews') && ai.includes('Brand search page') && ai.includes('Autocomplete') && !ai.includes('Google News') && !ai.includes('Niche ranking'));
  const em = se.stepSearchBlock(EVIDENCE, 'earnedMedia');
  assert.ok(em.includes('Google News') && !em.includes('Niche ranking') && !em.includes('Brand search page'));
  assert.equal(se.stepSearchBlock(EVIDENCE, 'social'), '', 'social reads none of the five');
  assert.equal(se.stepSearchBlock({ status: 'failed' }, 'website'), '', 'nothing when unavailable');
  assert.ok(em.includes('never state a different number'));
  // Wired into the right prompts.
  const n = (needle) => app.split(needle).length - 1;
  assert.equal(n("stepSearchBlock(search?.evidence, 'website')}"), 2, 'SEO visibility and the full website analysis');
  assert.equal(n("stepSearchBlock(search?.evidence, 'earnedMedia')}"), 2, 'auto-assess and the full earned media analysis');
  assert.ok(app.includes("searchUsedAt: stepSearchBlock(search?.evidence, 'website') ? search.gatheredAt : null"));
  assert.ok(app.includes("searchUsedAt: stepSearchBlock(search?.evidence, 'earnedMedia') ? search.gatheredAt : null"));
});

// ── When it is gathered ──

test('gathered when setup is completed, once at a time; scoring waits for it rather than starting another', () => {
  assert.ok(app.includes('onNext={() => { startSearchGather(); setCurrentStep(2); }}'));
  assert.ok(app.includes('if (searchRun.current) return searchRun.current;'), 'never twice at once');
  assert.ok(app.includes('onEnsureSearch={() => startSearchGather()}'));
  assert.ok(app.includes("if (assessments.search || searchRun.current || searchStatus?.state === 'unavailable') return;"), 'a step entered without evidence gathers it, a missing key is not retried on every step');
  assert.ok(app.includes('if (a?.search && !force) return Promise.resolve(a.search);'), 'stored evidence is reused; only Refresh gathers again');
});

test('evidence goes out of date when the brand, website or stage changes, and nothing re-gathers on its own', () => {
  assert.equal(App.searchInputsKey(PROJECT), 'artera|https://artera.ai|scaleup');
  assert.equal(App.isSearchStale(SEARCH, PROJECT), false);
  assert.equal(App.isSearchStale(SEARCH, { ...PROJECT, companyStage: 'leader' }), true);
  assert.equal(App.isSearchStale(SEARCH, { ...PROJECT, websiteUrl: 'artera.ai' }), false, 'the same address written differently');
  assert.equal(App.isSearchStale(SEARCH, { ...PROJECT, industry: 'energy' }), false, 'sector does not change what was searched');
  const html = server.renderToStaticMarkup(h(App.StepSearchPanel, { search: SEARCH, status: { state: 'ready' }, stale: true, signals: se.STEP_SIGNALS.website, onRefresh: () => {} }));
  assert.ok(html.includes('step-search-stale') && html.includes('step-search-refresh'));
});

test('the step panel shows that step’s facts, and says plainly when Google search is gathering or unavailable', () => {
  const ready = server.renderToStaticMarkup(h(App.StepSearchPanel, { search: SEARCH, status: { state: 'ready' }, signals: se.STEP_SIGNALS.earnedMedia, onRefresh: () => {} }));
  assert.ok(ready.includes('Google News: 1 articles') && !ready.includes('Niche ranking'));
  assert.ok(!ready.includes('step-search-refresh'), 'no refresh offered when current');
  const gathering = server.renderToStaticMarkup(h(App.StepSearchPanel, { search: null, status: { state: 'gathering' }, signals: se.STEP_SIGNALS.website }));
  assert.ok(gathering.includes('runs while you work'));
  const off = server.renderToStaticMarkup(h(App.StepSearchPanel, { search: null, status: { state: 'unavailable', reason: 'notConfigured' }, signals: se.STEP_SIGNALS.website, onRefresh: () => {} }));
  assert.ok(off.includes('SERPAPI_API_KEY') && off.includes('step-search-refresh'));
  assert.ok(!/\bBears on\b/.test(ready), 'people see facts, not the guidance written for the model');
});

// ── AI reputation: measured replaces model-written ──

async function mountAi(assessmentData, search = SEARCH) {
  const saved = [];
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = client.createRoot(container);
  await React.act(async () => {
    root.render(h(App.AIReputationPage, {
      assessmentData, setAssessmentData: (x) => saved.push(x), apiKey: 'k', project: PROJECT,
      onPrev() {}, onNext() {}, onClearScores() {}, search, searchStatus: { state: 'ready' }, searchStale: false, onRefreshSearch() {},
    }));
  });
  await React.act(async () => { await new Promise(r => setTimeout(r, 0)); });
  return { container, saved, root };
}

test('the model-written Search snapshot and Google News are replaced by the measured data', async () => {
  const { container, saved, root } = await mountAi({ searchSnapshotContent: '[Auto-fetched: Search Snapshot, synthesised from top results, not the literal Google AI Overview] old summary', googleNewsContent: '' });
  const snap = saved.find(x => x.searchSnapshotContent)?.searchSnapshotContent;
  const news = saved.find(x => x.googleNewsContent)?.googleNewsContent;
  assert.ok(se.isMeasuredText(snap) && snap.includes('Brand search page') && snap.includes('AI Overviews') && !snap.includes('old summary'));
  assert.ok(se.isMeasuredText(news) && news.includes('Google News'));
  assert.ok(container.textContent.includes('Measured from Google: page one, knowledge panel, AI Overview citations and autocomplete'));
  assert.ok(container.textContent.includes('filled into Search snapshot and Google News below'));
  await React.act(async () => root.unmount());
});

test('an assessor’s own text is never overwritten', async () => {
  const mine = 'Pasted by the assessor from a client call.';
  const { saved, root } = await mountAi({ searchSnapshotContent: mine, googleNewsContent: mine });
  assert.ok(!saved.some(x => 'searchSnapshotContent' in x || 'googleNewsContent' in x));
  await React.act(async () => root.unmount());
});

test('without Google search, the step works as before', async () => {
  const { saved, container, root } = await mountAi({ searchSnapshotContent: '', googleNewsContent: '' }, null);
  assert.equal(saved.length, 0);
  assert.ok(container.textContent.includes('Synthesised from top results while Google search is unavailable'));
  assert.ok(app.includes('const fetchSearchSnapshot = () => (measuredSnapshot ? ') && app.includes(': fetchSearchSnapshotSummary());'), 'the web-searched summary is the fallback');
  await React.act(async () => root.unmount());
});

test('the analysis reads measured fields as measured facts, and records that it did', () => {
  assert.ok(app.includes("isMeasuredText(searchSnapshotContent) && search?.evidence ? `GOOGLE SEARCH PAGE, AI OVERVIEWS AND AUTOCOMPLETE, ${stepSearchBlock(search.evidence, 'aiSnapshot')}"));
  assert.ok(app.includes("isMeasuredText(googleNewsContent) && search?.evidence ? `GOOGLE NEWS, ${stepSearchBlock(search.evidence, 'aiNews')}"));
  assert.ok(app.includes('searchUsedAt: (isMeasuredText(searchSnapshotContent) || isMeasuredText(googleNewsContent)) && search?.evidence ? search.gatheredAt : null,'));
});

// ── Scoring ──

test('scoring names only the readouts actually written from this evidence', () => {
  const block = se.searchPromptBlock(EVIDENCE, { reflected: ['website', 'earned media'] });
  assert.ok(block.includes('The website and earned media readouts were written from these same numbers'));
  assert.ok(se.searchPromptBlock(EVIDENCE, { reflected: ['website'] }).includes('The website readout was written from these same numbers, so it already reflects them.'));
  assert.ok(!se.searchPromptBlock(EVIDENCE).includes('written from these same numbers'), 'gathered only at scoring: nothing claimed');
  assert.ok(app.includes("filter(([, d]) => d?.searchUsedAt && d.searchUsedAt === scoringInputs.search.gatheredAt)"), 'a readout written from older evidence does not count');
  assert.ok(se.searchPromptBlock(EVIDENCE).includes('COUNT EACH PIECE OF EVIDENCE ONCE'), 'the backstop stays');
});
