// Teaser components, rendered from the real App.jsx via an esbuild bundle.
// Run: node tests/support/build-render-bundle.mjs && node --test tests/
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://compass.test/', pretendToBeVisual: true });
// Expose every browser global jsdom provides that Node lacks (HTMLAnchorElement,
// Blob, URL helpers and so on), rather than a hand-picked list that goes stale.
globalThis.window = dom.window;
for (const k of Object.getOwnPropertyNames(dom.window)) {
  if (k in globalThis) continue;
  try { Object.defineProperty(globalThis, k, { value: dom.window[k], configurable: true, writable: true }); } catch { /* read-only */ }
}
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
globalThis.confirm = () => true;
globalThis.alert = () => {};
dom.window.confirm = () => true;

let App, React, server, client, act, stub, logic;
const LONG = 'Substantive evidence text about the brand that is comfortably longer than forty characters.';

before(async () => {
  React = (await import('react')).default;
  server = await import('react-dom/server');
  client = await import('react-dom/client');
  act = React.act;
  App = await import('./.build/app.bundle.mjs');
  stub = await import('./support/supabase.stub.mjs');
  logic = await import('../src/lib/teaser.js');
});

const h = (...a) => React.createElement(...a);

async function makeRecord({ thin = false } = {}) {
  const { ATTRIBUTES } = await import('../src/data/rubric.js');
  const o = {
    headline: 'Acme is credible in trade press and invisible elsewhere.',
    summary: 'Verdict first.',
    fullAssessmentWouldResolve: ['Does the research travel beyond trade press?'],
    trustFindings: [{ text: 'Trade press cites Acme research', tags: ['credibility'], supports: true }],
    campaignCoherence: { level: 2, levelName: 'Themed', confidence: 'medium', verdict: 'x' },
  };
  ATTRIBUTES.forEach((a, i) => { o[a.id] = { score: 40 + i * 3, confidence: thin && i < 3 ? 'low' : 'medium', rationale: `Rationale for ${a.id}` }; });
  const result = logic.finaliseTeaser(logic.parseTeaserScoring(JSON.stringify(o)));
  result.history = [{ overall: 11, scoredAt: '2026-01-01T00:00:00Z' }];
  return {
    id: 't1', brand_name: 'Acme', website_url: 'https://acme.com', business_model: 'b2b', industry: 'energy',
    context: 'SENTINEL_CONTEXT confidential brief', created_by: 'SENTINEL_UID', created_by_name: 'SENTINEL_AUTHOR',
    evidence: {
      gatheredAt: '2026-09-18T12:00:00Z',
      sources: {
        website: { status: 'ok', pages: [{ url: 'https://acme.com', chars: 90, text: 'SENTINEL_EVIDENCE ' + LONG }] },
        social: { status: 'failed', error: 'SENTINEL_ERROR' },
        aiPerception: { status: 'ok', text: LONG }, thirdParty: { status: 'ok', text: LONG }, earned: { status: 'ok', text: LONG },
      },
    },
    result,
  };
}

const SENTINELS = ['SENTINEL_CONTEXT', 'SENTINEL_EVIDENCE', 'SENTINEL_AUTHOR', 'SENTINEL_ERROR', 'SENTINEL_UID'];

// ── Prospect-facing view ──

test('client view shows every attribute, all four lenses, the overall and confidence', async () => {
  const rec = await makeRecord();
  const html = server.renderToStaticMarkup(h(App.TeaserClientView, { payload: logic.makeTeaserClientPayload(rec) }));
  for (const name of ['Awake', 'Aware', 'Reflective', 'Attentive', 'Cogent', 'Sentient', 'Visionary', 'Intentional']) assert.ok(html.includes(name), name);
  for (const lens of ['Credibility', 'Trust', 'Reputation', 'Authenticity']) assert.ok(html.includes(lens), lens);
  assert.ok(html.includes(`>${rec.result.overall}<`), 'overall shown');
  assert.ok(html.includes('medium confidence'));
  assert.ok(html.includes('Indicative Compass read'));
  assert.ok(html.includes('What a full assessment would settle'));
  assert.ok(!html.includes('Limited evidence in this read'));
});

test('thin-record banner appears only when the record is flagged', async () => {
  const rec = await makeRecord({ thin: true });
  assert.equal(rec.result.thinRecord, true);
  const html = server.renderToStaticMarkup(h(App.TeaserClientView, { payload: logic.makeTeaserClientPayload(rec) }));
  assert.ok(html.includes('Limited evidence in this read'));
  assert.ok(!/so will a prospect/.test(html), 'never blames the brand for the narrowness of the read');
});

test('internal report: context and sources show internally, never inside the client view', async () => {
  const rec = await makeRecord();
  const html = server.renderToStaticMarkup(h(App.TeaserReport, { record: rec, busy: false, progress: null, error: null, onBack() {}, onRescore() {}, onRefresh() {}, onConvert() {}, onDelete() {} }));
  const doc = new JSDOM(html).window.document;
  const clientView = doc.querySelector('[data-teaser-client-view]');
  assert.ok(clientView, 'client view rendered');
  SENTINELS.forEach(s => assert.ok(!clientView.innerHTML.includes(s), `${s} inside client view`));
  // Prove the check has teeth: the context really is on the page, just not in the client region.
  assert.ok(html.includes('SENTINEL_CONTEXT'), 'context visible to the admin in the internal strip');
  assert.ok(html.includes('not shown to the prospect'));
  assert.ok(html.includes('Social: failed'));
  assert.ok(html.includes('Previous scores: 11'));
});

test('unscored teaser shows no client view and offers Score', async () => {
  const rec = { ...(await makeRecord()), result: null };
  const html = server.renderToStaticMarkup(h(App.TeaserReport, { record: rec, busy: false, progress: null, error: null, onBack() {}, onRescore() {}, onRefresh() {}, onConvert() {}, onDelete() {} }));
  assert.ok(!html.includes('data-teaser-client-view'));
  assert.ok(html.includes('has not been scored yet'));
  assert.ok(/<\/svg>\s*Score<\/button>/.test(html) || html.includes('> Score</button>') || html.includes('Score</button>'));
});

// ── PDF ──

test('PDF writes scores and lenses from the payload and nothing internal', async () => {
  const rec = await makeRecord();
  const payload = logic.makeTeaserClientPayload(rec);
  const { pdf, filename } = await App.exportTeaserPdf(payload, null, { download: false });
  // jsPDF writes uncompressed content streams by default, so every string
  // drawn on the page appears in the raw output as (text) Tj.
  const raw = pdf.output();
  const written = [...raw.matchAll(/\((.*?)\) Tj/g)].map(m => m[1]);
  const all = written.join('\n');
  assert.ok(written.length > 20, 'content stream was read');
  const savedName = filename;
  SENTINELS.forEach(s => assert.ok(!all.includes(s), `${s} in PDF`));
  assert.equal(savedName, 'Acme-Compass-Teaser.pdf');
  assert.ok(written.includes(String(payload.overall)));
  for (const k of ['credibility', 'trust', 'reputation', 'authenticity']) assert.ok(written.includes(String(payload.lensScores[k])), k);
  assert.ok(all.includes('Awake') && all.includes('Intentional'));
  assert.ok(!/—/.test(all), 'no em dashes in the PDF');
});

// ── Admin gating ──

test('Teaser nav appears for admins only', () => {
  const props = (profile, onTeaser = () => {}) => ({ onNewAssessment() {}, onGoHome() {}, onSavedAssessments() {}, onCompassResults() {}, onComparison() {}, onStayConscious() {}, onTeaser, activePage: null, user: { email: 'a@b.c' }, profile, onLogout() {}, onAdmin() {} });
  const count = (html) => (html.match(/Teaser<\/button>/g) || []).length;
  assert.equal(count(server.renderToStaticMarkup(h(App.Header, props({ is_admin: true })))), 1);
  assert.equal(count(server.renderToStaticMarkup(h(App.Header, props({ is_admin: false })))), 0);
  assert.equal(count(server.renderToStaticMarkup(h(App.Header, props({ is_admin: false, is_readonly: true })))), 0);
  assert.equal(count(server.renderToStaticMarkup(h(App.Header, props({ is_admin: true }, null)))), 0);
});

// ── Live flow ──

function mountPage(props = {}) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = client.createRoot(container);
  return { container, root, props: { user: { id: 'u1', email: 'paul@antenna' }, profile: { is_admin: true, full_name: 'Paul Newton' }, apiKey: 'PROXY', onConvert: () => true, ...props } };
}
const flush = () => new Promise(r => setTimeout(r, 0));
const click = async (el) => { await act(async () => { el.dispatchEvent(new window.MouseEvent('click', { bubbles: true })); }); };
const selectValue = async (el, value) => {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set;
  await act(async () => { setter.call(el, value); el.dispatchEvent(new window.Event('change', { bubbles: true })); });
};
const typeInto = async (el, value) => {
  const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'value').set;
  await act(async () => { setter.call(el, value); el.dispatchEvent(new window.Event('input', { bubbles: true })); });
};

function installFetch(scoringText) {
  const log = [];
  globalThis.fetch = window.fetch = async (url, opts = {}) => {
    const body = opts.body ? JSON.parse(opts.body) : null;
    log.push({ url, body });
    const res = (status, json) => ({ ok: status < 400, status, json: async () => json });
    if (url.startsWith('/api/scrape')) return url.includes(encodeURIComponent('https://acme.com') + '&') ? res(200, { text: 'Acme home. ' + LONG }) : res(404, { error: 'no' });
    if (url.startsWith('/api/knowledge-graph')) return res(200, { found: false });
    if (url.startsWith('/version.json')) return globalThis.__liveVersion ? res(200, { version: globalThis.__liveVersion }) : res(404, {});
    if (url === '/api/claude') {
      if (body.useWebSearch) return res(200, { content: [{ type: 'server_tool_use' }, { type: 'text', text: LONG }] });
      return res(200, { content: [{ type: 'text', text: scoringText }], stop_reason: 'end_turn' });
    }
    return res(404, {});
  };
  return log;
}

async function scoringJson(dropAttr = null) {
  const { ATTRIBUTES } = await import('../src/data/rubric.js');
  const o = { headline: 'H', summary: 'S', fullAssessmentWouldResolve: ['Q'], trustFindings: [], campaignCoherence: { level: 1, confidence: 'low' } };
  ATTRIBUTES.forEach(a => { if (a.id !== dropAttr) o[a.id] = { score: 50, confidence: 'medium', rationale: 'r' }; });
  return JSON.stringify(o);
}

test('empty form is rejected before any network call', async () => {
  stub.state.teasers = []; stub.calls.length = 0;
  const log = installFetch('{}');
  const { container, root, props } = mountPage();
  await act(async () => { root.render(h(App.TeaserPage, props)); }); await act(flush);
  const run = [...container.querySelectorAll('button')].find(b => b.textContent.includes('Run teaser'));
  await click(run);
  assert.ok(container.textContent.includes('Choose a campaign.'));
  assert.ok(container.textContent.includes('Choose a sector.'));
  assert.ok(container.textContent.includes('Brand name is required.'));
  assert.equal(log.filter(l => !l.url.startsWith('/version.json')).length, 0, 'no gathering or scoring; the version check on open is expected');
  await act(async () => root.unmount());
});

test('full run: evidence saved before scoring, then scored result saved and shown, with web search used for evidence only', async () => {
  stub.state.teasers = []; stub.calls.length = 0; stub.state.saveResult = null;
  const log = installFetch(await scoringJson());
  stub.state.campaigns = [{ id: 'c-1', name: 'SENTINEL_CAMPAIGN Climate Week' }];
  const { container, root, props } = mountPage();
  await act(async () => { root.render(h(App.TeaserPage, props)); }); await act(flush);
  await selectValue(container.querySelector('[data-field="campaign"]'), 'c-1');
  await typeInto(container.querySelector('[data-field="brand"]'), 'Acme');
  await typeInto(container.querySelector('[data-field="url"]'), 'acme.com');
  await selectValue(container.querySelector('[data-field="industry"]'), 'energy');
  await typeInto(container.querySelector('textarea'), 'SENTINEL_CONTEXT brief');
  const run = [...container.querySelectorAll('button')].find(b => b.textContent.includes('Run teaser'));
  await click(run);
  for (let i = 0; i < 20; i++) await act(flush);

  const saves = stub.calls.filter(c => c[0] === 'saveTeaser').map(c => c[1]);
  assert.equal(saves.length, 2, 'one save for evidence, one for the result');
  assert.equal(saves[0].result, null);
  assert.ok(saves[0].evidence.sources.website.status === 'ok');
  assert.equal(saves[0].website_url, 'https://acme.com');
  assert.equal(saves[0].context, 'SENTINEL_CONTEXT brief');
  assert.equal(saves[0].created_by, 'u1');
  assert.equal(saves[0].created_by_name, 'Paul Newton');
  assert.equal(saves[0].campaign_id, 'c-1', 'teaser saved into the chosen campaign');
  assert.equal(saves[0].industry, 'energy');
  const expected = logic.finaliseTeaser(logic.parseTeaserScoring(await scoringJson()));
  assert.equal(saves[1].result.overall, expected.overall, 'saved overall is the code-computed overall');
  assert.deepEqual(saves[1].result.lensScores, expected.lensScores);
  assert.deepEqual(saves[1].result.history, []);
  const fullWrites = stub.calls.filter(c => ['saveCompassResult', 'saveAssessment'].includes(c[0]));
  assert.equal(fullWrites.length, 0, 'a teaser run must never write to full assessment results');

  const claudeCalls = log.filter(l => l.url === '/api/claude');
  assert.equal(claudeCalls.filter(c => c.body.useWebSearch).length, 4, 'four web-searched evidence calls');
  assert.equal(claudeCalls.filter(c => !c.body.useWebSearch).length, 1, 'one scoring call, without web search');
  const scoringPrompt = claudeCalls.find(c => !c.body.useWebSearch).body.messages[0].content.at(-1).text;
  assert.ok(scoringPrompt.includes('Do NOT use em-dashes'), 'house formatting rules applied to the scoring call');
  assert.ok(container.querySelector('[data-teaser-client-view]'), 'report is shown after the run');
  assert.ok(!container.querySelector('[data-teaser-client-view]').innerHTML.includes('SENTINEL_CONTEXT'));
  assert.ok(!container.querySelector('[data-teaser-client-view]').innerHTML.includes('SENTINEL_CAMPAIGN'), 'campaign name is internal');
  assert.ok(container.innerHTML.includes('SENTINEL_CAMPAIGN'), 'campaign shown to the admin in the internal strip');
  await act(async () => root.unmount());
});

test('a failed scoring pass keeps the gathered evidence and says so', async () => {
  stub.state.teasers = []; stub.calls.length = 0;
  installFetch(await scoringJson('VISIONARY'));
  stub.state.campaigns = [{ id: 'c-1', name: 'SENTINEL_CAMPAIGN Climate Week' }];
  const { container, root, props } = mountPage();
  await act(async () => { root.render(h(App.TeaserPage, props)); }); await act(flush);
  await selectValue(container.querySelector('[data-field="campaign"]'), 'c-1');
  await typeInto(container.querySelector('[data-field="brand"]'), 'Acme');
  await typeInto(container.querySelector('[data-field="url"]'), 'acme.com');
  await selectValue(container.querySelector('[data-field="industry"]'), 'energy');
  await click([...container.querySelectorAll('button')].find(b => b.textContent.includes('Run teaser')));
  for (let i = 0; i < 20; i++) await act(flush);
  const saves = stub.calls.filter(c => c[0] === 'saveTeaser');
  assert.equal(saves.length, 1, 'evidence saved, no result saved');
  assert.equal(stub.calls.filter(c => ['saveCompassResult', 'saveAssessment'].includes(c[0])).length, 0);
  assert.ok(container.textContent.includes('did not score VISIONARY'));
  assert.ok(container.textContent.includes('has not been scored yet'), 'the saved evidence is open and can be scored');
  await act(async () => root.unmount());
});

test('rescore and delete touch only the teaser table', async () => {
  const rec = { ...(await makeRecord()), campaign_id: 'c-1' };
  stub.state.teasers = [rec]; stub.state.campaigns = [{ id: 'c-1', name: 'Pitches' }]; stub.calls.length = 0; stub.state.saveResult = null;
  installFetch(await scoringJson());
  const { container, root, props } = mountPage();
  await act(async () => { root.render(h(App.TeaserPage, props)); }); await act(flush);
  await click([...container.querySelectorAll('button')].find(b => b.textContent.includes('Acme')));
  await act(flush);
  await click([...container.querySelectorAll('button')].find(b => b.textContent.trim() === 'Rescore'));
  for (let i = 0; i < 10; i++) await act(flush);
  const rescoreSave = stub.calls.filter(c => c[0] === 'saveTeaser').at(-1)[1];
  assert.equal(rescoreSave.result.history.at(-1).overall, rec.result.overall, 'previous teaser score kept in teaser history');
  await click([...container.querySelectorAll('button')].find(b => b.title === 'Delete teaser'));
  await act(flush);
  const names = stub.calls.map(c => c[0]);
  assert.ok(names.includes('deleteTeaser'));
  assert.deepEqual(names.filter(n => !['fetchTeasers', 'fetchCampaigns', 'fetchTeaser', 'saveTeaser', 'deleteTeaser', 'fetchCompassResults'].includes(n)), [], `unexpected calls: ${names}`);
  await act(async () => root.unmount());
});

// ── Campaigns ──

async function mountWith({ campaigns = [], teasers = [] } = {}) {
  stub.state.campaigns = campaigns.map(c => ({ ...c }));
  stub.state.teasers = teasers;
  stub.calls.length = 0;
  const m = mountPage();
  await act(async () => { m.root.render(h(App.TeaserPage, m.props)); }); await act(flush);
  return m;
}
const btn = (container, pred) => [...container.querySelectorAll('button')].find(pred);

test('a campaign can be created inline and is selected for the next teaser; duplicates are refused', async () => {
  const { container, root } = await mountWith({ campaigns: [{ id: 'c-1', name: 'Climate Week' }] });
  await selectValue(container.querySelector('[data-field="campaign"]'), '__new');
  await typeInto(container.querySelector('[data-field="new-campaign"]'), '  climate week ');
  await click(btn(container, b => b.textContent === 'Create'));
  assert.ok(container.textContent.includes('already exists'), 'case and spacing do not make a new campaign');
  await typeInto(container.querySelector('[data-field="new-campaign"]'), 'Q4 Energy pitches');
  await click(btn(container, b => b.textContent === 'Create'));
  await act(flush);
  const select = container.querySelector('[data-field="campaign"]');
  assert.ok(select, 'back to the picker');
  assert.equal(select.value, 'c-2', 'new campaign selected');
  await act(async () => root.unmount());
});

test('teasers are grouped by campaign with counts and averages; legacy teasers sit in Unassigned', async () => {
  const a = { ...(await makeRecord()), id: 'a', brand_name: 'Alpha', campaign_id: 'c-1' };
  const b = { ...(await makeRecord()), id: 'b', brand_name: 'Bravo', campaign_id: 'c-1', result: null };
  const legacy = { ...(await makeRecord()), id: 'l', brand_name: 'Legacy', campaign_id: null };
  const { container, root } = await mountWith({ campaigns: [{ id: 'c-1', name: 'Climate Week' }, { id: 'c-2', name: 'Empty one' }], teasers: [a, b, legacy] });
  const g1 = container.querySelector('[data-campaign="c-1"]');
  assert.ok(g1.textContent.includes('Alpha') && g1.textContent.includes('Bravo'));
  assert.ok(!g1.textContent.includes('Legacy'));
  assert.ok(g1.textContent.includes('2 brands'));
  assert.ok(g1.textContent.includes(`average ${a.result.overall}`), 'average uses scored brands only');
  assert.ok(g1.textContent.includes('1 not scored'));
  assert.ok(container.querySelector('[data-campaign="c-2"]').textContent.includes('No teasers in this campaign yet'));
  const un = container.querySelector('[data-campaign="unassigned"]');
  assert.ok(un && un.textContent.includes('Legacy'));
  await selectValue(container.querySelector('[data-field="filter"]'), 'c-2');
  assert.ok(!container.querySelector('[data-campaign="c-1"]'), 'filter hides other campaigns');
  assert.ok(!container.querySelector('[data-campaign="unassigned"]'));
  await act(async () => root.unmount());
});

test('a campaign with teasers cannot be deleted; an empty one can', async () => {
  const a = { ...(await makeRecord()), id: 'a', campaign_id: 'c-1' };
  const { container, root } = await mountWith({ campaigns: [{ id: 'c-1', name: 'Full' }, { id: 'c-2', name: 'Empty' }], teasers: [a] });
  const del = (id) => container.querySelector(`[data-campaign="${id}"]`).querySelector('button[title*="elete"], button[title*="empty"]');
  await click(del('c-1'));
  assert.equal(stub.calls.filter(c => c[0] === 'deleteCampaign').length, 0, 'never asked the database to delete a non-empty campaign');
  assert.ok(container.textContent.includes('still has 1 teaser'));
  await click(del('c-2'));
  assert.deepEqual(stub.calls.filter(c => c[0] === 'deleteCampaign').map(c => c[1]), ['c-2']);
  await act(async () => root.unmount());
});

test('a teaser can be moved to another campaign from its report', async () => {
  const a = { ...(await makeRecord()), id: 'a', brand_name: 'Alpha', campaign_id: 'c-1' };
  const { container, root } = await mountWith({ campaigns: [{ id: 'c-1', name: 'One' }, { id: 'c-2', name: 'Two' }], teasers: [a] });
  await click(btn(container, b => b.textContent.includes('Alpha')));
  await act(flush);
  await selectValue(container.querySelector('[data-field="move-campaign"]'), 'c-2');
  await act(flush);
  const save = stub.calls.filter(c => c[0] === 'saveTeaser').at(-1)[1];
  assert.equal(save.campaign_id, 'c-2');
  assert.equal(save.result.overall, a.result.overall, 'moving never touches the scores');
  await act(async () => root.unmount());
});

test('Download scores fetches only that campaign and saves a real xlsx', async () => {
  const a = { ...(await makeRecord()), id: 'a', brand_name: 'Alpha', campaign_id: 'c-1' };
  stub.state.campaignScores = [{ id: 'a', brand_name: 'Alpha', website_url: 'https://alpha.com', result: a.result }];
  const saved = [];
  window.URL.createObjectURL = globalThis.URL.createObjectURL = (blob) => { saved.push(blob); return 'blob:test'; };
  window.URL.revokeObjectURL = globalThis.URL.revokeObjectURL = () => {};
  // file-saver triggers the download by dispatching a click on an <a download>.
  const origDispatch = window.HTMLAnchorElement.prototype.dispatchEvent;
  window.HTMLAnchorElement.prototype.dispatchEvent = function (ev) { if (ev.type === 'click' && this.download) { saved.push(this.download); return true; } return origDispatch.call(this, ev); };
  // It also schedules a 40 second URL cleanup; run it now so the suite does not wait.
  const origTimeout = globalThis.setTimeout;
  globalThis.setTimeout = window.setTimeout = (fn, ms, ...rest) => origTimeout(fn, ms > 5000 ? 0 : ms, ...rest);
  const { container, root } = await mountWith({ campaigns: [{ id: 'c-1', name: 'Climate Week' }], teasers: [a] });
  await click(btn(container.querySelector('[data-campaign="c-1"]'), b => b.textContent.includes('Download scores')));
  for (let i = 0; i < 10; i++) await act(flush);
  assert.deepEqual(stub.calls.filter(c => c[0] === 'fetchCampaignScores').map(c => c[1]), ['c-1']);
  const blob = saved.find(x => x && typeof x === 'object');
  const name = saved.find(x => typeof x === 'string');
  assert.ok(blob, 'a file was produced');
  assert.match(name, /^Climate-Week-Teaser-Scores-\d{4}-\d{2}-\d{2}\.xlsx$/);
  const JSZip = (await import('jszip')).default;
  const zip = await JSZip.loadAsync(Buffer.from(await blob.arrayBuffer()));
  const sheet = await zip.file('xl/worksheets/sheet1.xml').async('string');
  assert.ok(sheet.includes('Alpha'));
  assert.ok(!container.textContent.includes('Download failed'));
  globalThis.setTimeout = window.setTimeout = origTimeout;
  window.HTMLAnchorElement.prototype.dispatchEvent = origDispatch;
  await act(async () => root.unmount());
});


// ── Sector baseline (v3.31) ──

const fullRow = (brand, industry, total, version = '2.9') => ({ id: brand, brand_name: brand, industry, total_score: total, scores: { AWAKE: total }, rubric_version: version, created_at: '2026-06-01T00:00:00Z' });

test('report view shows a live sector baseline from full results, excluding the brand itself', async () => {
  const rec = { ...(await makeRecord()), id: 'a', brand_name: 'Acme', industry: 'energy', campaign_id: 'c-1' };
  stub.state.compassRows = [
    fullRow('E1', 'energy', 50), fullRow('E2', 'energy', 60), fullRow('E3', 'energy', 70), fullRow('E4', 'energy', 40), fullRow('E5', 'energy', 80),
    fullRow('Acme', 'energy', 10),          // the brand's own full assessment: excluded
    fullRow('Old', 'energy', 5, '1.0'),     // old framework: excluded
    fullRow('T1', 'technology', 90),
  ];
  const { container, root } = await mountWith({ campaigns: [{ id: 'c-1', name: 'One' }], teasers: [rec] });
  await click(btn(container, b => b.textContent.includes('Acme')));
  await act(flush);
  const text = container.querySelector('[data-field="baseline"]').textContent;
  assert.match(text, /from full assessments:\s*60/, 'average of the five eligible energy brands');
  assert.ok(text.includes('Energy & Utilities') && text.includes('5 full assessments'));
  const diff = rec.result.overall - 60;
  assert.ok(text.includes(`this teaser ${diff > 0 ? '+' : ''}${diff}`));
  assert.ok(!container.querySelector('[data-teaser-client-view]').textContent.includes('Sector baseline'), 'baseline stays out of the prospect view');
  assert.equal(stub.calls.filter(c => ['saveCompassResult', 'saveAssessment'].includes(c[0])).length, 0);
  await act(async () => root.unmount());
});

test('a thin sector falls back to all brands and says so; Other means no sector', async () => {
  stub.state.compassRows = [fullRow('E1', 'energy', 50), fullRow('T1', 'technology', 70), fullRow('T2', 'technology', 90)];
  const thin = { ...(await makeRecord()), id: 'a', brand_name: 'Acme', industry: 'energy', campaign_id: 'c-1' };
  let m = await mountWith({ campaigns: [{ id: 'c-1', name: 'One' }], teasers: [thin] });
  await click(btn(m.container, b => b.textContent.includes('Acme'))); await act(flush);
  let text = m.container.querySelector('[data-field="baseline"]').textContent;
  assert.ok(text.includes('70') && text.includes('All full assessments (fewer than 5 in sector)') && text.includes('3 full assessments'), text);
  await act(async () => m.root.unmount());
  const other = { ...thin, industry: 'other' };
  m = await mountWith({ campaigns: [{ id: 'c-1', name: 'One' }], teasers: [other] });
  await click(btn(m.container, b => b.textContent.includes('Acme'))); await act(flush);
  text = m.container.querySelector('[data-field="baseline"]').textContent;
  assert.ok(text.includes('All full assessments (no sector)'), text);
  await act(async () => m.root.unmount());
});

test('no full assessments at all reads as unavailable, not as a zero baseline', async () => {
  stub.state.compassRows = [];
  const rec = { ...(await makeRecord()), id: 'a', brand_name: 'Acme', industry: 'energy', campaign_id: 'c-1' };
  const { container, root } = await mountWith({ campaigns: [{ id: 'c-1', name: 'One' }], teasers: [rec] });
  await click(btn(container, b => b.textContent.includes('Acme'))); await act(flush);
  assert.ok(container.querySelector('[data-field="baseline"]').textContent.includes('unavailable'));
  await act(async () => root.unmount());
});

test('baselines are recalculated at every export, so two downloads reflect the day they ran', async () => {
  const a = { ...(await makeRecord()), id: 'a', brand_name: 'Alpha', industry: 'energy', campaign_id: 'c-1' };
  stub.state.campaignScores = [{ id: 'a', brand_name: 'Alpha', website_url: 'https://alpha.com', industry: 'energy', result: a.result }];
  const blobs = [];
  window.URL.createObjectURL = globalThis.URL.createObjectURL = (blob) => { blobs.push(blob); return 'blob:test'; };
  window.URL.revokeObjectURL = globalThis.URL.revokeObjectURL = () => {};
  const origDispatch = window.HTMLAnchorElement.prototype.dispatchEvent;
  window.HTMLAnchorElement.prototype.dispatchEvent = function (ev) { return ev.type === 'click' && this.download ? true : origDispatch.call(this, ev); };
  const origTimeout = globalThis.setTimeout;
  globalThis.setTimeout = window.setTimeout = (fn, ms, ...rest) => origTimeout(fn, ms > 5000 ? 0 : ms, ...rest);
  const JSZip = (await import('jszip')).default;
  const sheetOf = async (blob) => (await JSZip.loadAsync(Buffer.from(await blob.arrayBuffer()))).file('xl/worksheets/sheet1.xml').async('string');

  stub.state.compassRows = [50, 50, 50, 50, 50].map((v, i) => fullRow(`E${i}`, 'energy', v));
  const { container, root } = await mountWith({ campaigns: [{ id: 'c-1', name: 'Climate Week' }], teasers: [a] });
  const dl = () => btn(container.querySelector('[data-campaign="c-1"]'), b => b.textContent.includes('Download scores'));
  await click(dl()); for (let i = 0; i < 10; i++) await act(flush);
  // A full assessment lands between the two downloads.
  stub.state.compassRows.push(fullRow('E5', 'energy', 110));
  await click(dl()); for (let i = 0; i < 10; i++) await act(flush);

  assert.equal(stub.calls.filter(c => c[0] === 'fetchCompassResults').length, 2, 'full results fetched fresh for each export');
  const [first, second] = [await sheetOf(blobs[0]), await sheetOf(blobs[1])];
  const baselineCell = (xml) => Number(xml.match(/<c r="F5" s="\d+"><v>(-?\d+)<\/v>/)[1]);
  assert.equal(baselineCell(first), 50);
  assert.equal(baselineCell(second), 60, 'new full assessment moves the baseline');
  assert.ok(first.includes('Energy &amp; Utilities'));
  assert.equal(stub.calls.filter(c => ['saveCompassResult', 'saveAssessment'].includes(c[0])).length, 0, 'exporting never writes full results');
  globalThis.setTimeout = window.setTimeout = origTimeout;
  window.HTMLAnchorElement.prototype.dispatchEvent = origDispatch;
  await act(async () => root.unmount());
});

test('a download fails loudly rather than exporting without baselines', async () => {
  const a = { ...(await makeRecord()), id: 'a', brand_name: 'Alpha', industry: 'energy', campaign_id: 'c-1' };
  stub.state.campaignScores = [{ id: 'a', brand_name: 'Alpha', website_url: 'https://alpha.com', industry: 'energy', result: a.result }];
  const orig = stub.state.compassRows;
  const { container, root } = await mountWith({ campaigns: [{ id: 'c-1', name: 'C' }], teasers: [a] });
  stub.state.compassRows = { map() { throw new Error('boom'); } };
  await click(btn(container.querySelector('[data-campaign="c-1"]'), b => b.textContent.includes('Download scores')));
  for (let i = 0; i < 5; i++) await act(flush);
  assert.ok(container.textContent.includes('Download failed'));
  stub.state.compassRows = orig;
  await act(async () => root.unmount());
});


// ── Scoring method (v3.32) ──

test('an earlier-method teaser is flagged in the list and report; a current one is not', async () => {
  const cur = { ...(await makeRecord()), id: 'cur', brand_name: 'Current', campaign_id: 'c-1' };
  const old = { ...(await makeRecord()), id: 'old', brand_name: 'Earlier', campaign_id: 'c-1' };
  old.result = { ...old.result, teaserVersion: '1.0' };
  const { container, root } = await mountWith({ campaigns: [{ id: 'c-1', name: 'One' }], teasers: [cur, old] });
  const rowOf = (name) => btn(container, b => b.textContent.includes(name));
  assert.ok(rowOf('Earlier').textContent.includes('Earlier method'));
  assert.ok(!rowOf('Current').textContent.includes('Earlier method'));
  await click(rowOf('Earlier')); await act(flush);
  assert.ok(container.querySelector('[data-field="method-outdated"]').textContent.includes('Rescore to apply the current method'));
  await act(async () => root.unmount());
});

test('what could not be observed is listed internally, outside the prospect view', async () => {
  const rec = { ...(await makeRecord()), id: 'a', brand_name: 'Acme', campaign_id: 'c-1' };
  rec.result = { ...rec.result, scores: { ...rec.result.scores, AWAKE: { ...rec.result.scores.AWAKE, unobserved: 'SENTINEL_UNOBSERVED analyst citations' } } };
  const { container, root } = await mountWith({ campaigns: [{ id: 'c-1', name: 'One' }], teasers: [rec] });
  await click(btn(container, b => b.textContent.includes('Acme'))); await act(flush);
  assert.ok(container.querySelector('[data-field="unobserved"]').textContent.includes('SENTINEL_UNOBSERVED'));
  assert.ok(!container.querySelector('[data-teaser-client-view]').innerHTML.includes('SENTINEL_UNOBSERVED'));
  await act(async () => root.unmount());
});


test('rescoring an earlier-method teaser clears its flag in the report and in the list', async () => {
  const old = { ...(await makeRecord()), id: 'old', brand_name: 'Earlier', campaign_id: 'c-1', updated_at: '2026-09-01T00:00:00Z' };
  old.result = { ...old.result, teaserVersion: '1.0' };
  installFetch(await scoringJson());
  const { container, root } = await mountWith({ campaigns: [{ id: 'c-1', name: 'One' }], teasers: [old] });
  const row = () => btn(container, b => b.textContent.includes('Earlier') && !b.textContent.includes('All teasers'));
  assert.ok(row().textContent.includes('Earlier method'), 'flagged before');
  await click(row()); await act(flush);
  await click(btn(container, b => b.textContent.trim() === 'Rescore'));
  for (let i = 0; i < 15; i++) await act(flush);
  assert.ok(!container.querySelector('[data-field="method-outdated"]'), 'report flag cleared');
  await click(btn(container, b => b.textContent.includes('All teasers')));
  for (let i = 0; i < 5; i++) await act(flush);
  assert.ok(!row().textContent.includes('Earlier method'), `list flag still shown: ${row().textContent}`);
  await act(async () => root.unmount());
});


// ── Out-of-date tabs (v3.33) ──

const { readFileSync } = await import('node:fs');
const APP_VERSION = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8').match(/const APP_VERSION = '([^']+)'/)[1];
const TEASER_VERSION_LIVE = (await import('../src/lib/teaser.js')).TEASER_VERSION;

async function openOldTeaser() {
  const old = { ...(await makeRecord()), id: 'old', brand_name: 'Earlier', campaign_id: 'c-1' };
  old.result = { ...old.result, teaserVersion: '1.0' };
  const m = await mountWith({ campaigns: [{ id: 'c-1', name: 'One' }], teasers: [old] });
  for (let i = 0; i < 3; i++) await act(flush);
  return m;
}

test('a tab running an older build refuses to score and says why', async () => {
  const log = installFetch(await scoringJson());
  globalThis.__liveVersion = '99.0.0';
  const { container, root } = await openOldTeaser();
  assert.ok(container.querySelector('[data-field="stale-banner"]'), 'banner on the list');
  await click(btn(container, b => b.textContent.includes('Earlier') && !b.textContent.includes('All teasers'))); await act(flush);
  assert.ok(container.querySelector('[data-field="stale-banner"]'), 'banner on the report');
  stub.calls.length = 0;
  await click(btn(container, b => b.textContent.trim() === 'Rescore'));
  for (let i = 0; i < 10; i++) await act(flush);
  assert.equal(stub.calls.filter(c => c[0] === 'saveTeaser').length, 0, 'nothing saved');
  assert.equal(log.filter(l => l.url === '/api/claude').length, 0, 'no scoring call made');
  assert.ok(container.textContent.includes(`running Compass v${APP_VERSION}, but v99.0.0 is live`));
  assert.ok(container.querySelector('[data-field="method-outdated"]'), 'still honestly flagged');
  globalThis.__liveVersion = undefined;
  await act(async () => root.unmount());
});

test('an out-of-date tab cannot start a new teaser either', async () => {
  const log = installFetch(await scoringJson());
  globalThis.__liveVersion = '99.0.0';
  stub.state.campaigns = [{ id: 'c-1', name: 'One' }]; stub.state.teasers = []; stub.calls.length = 0;
  const { container, root, props } = mountPage();
  await act(async () => { root.render(h(App.TeaserPage, props)); }); await act(flush);
  await selectValue(container.querySelector('[data-field="campaign"]'), 'c-1');
  await typeInto(container.querySelector('[data-field="brand"]'), 'Acme');
  await typeInto(container.querySelector('[data-field="url"]'), 'acme.com');
  await selectValue(container.querySelector('[data-field="industry"]'), 'energy');
  await click(btn(container, b => b.textContent.includes('Run teaser')));
  for (let i = 0; i < 10; i++) await act(flush);
  assert.equal(log.filter(l => l.url === '/api/claude' || l.url.startsWith('/api/scrape')).length, 0, 'no gathering or scoring');
  assert.equal(stub.calls.filter(c => c[0] === 'saveTeaser').length, 0);
  globalThis.__liveVersion = undefined;
  await act(async () => root.unmount());
});

test('an up-to-date tab rescores, stamps the current method and clears the flag', async () => {
  installFetch(await scoringJson());
  globalThis.__liveVersion = APP_VERSION;
  const { container, root } = await openOldTeaser();
  assert.ok(!container.querySelector('[data-field="stale-banner"]'));
  await click(btn(container, b => b.textContent.includes('Earlier') && !b.textContent.includes('All teasers'))); await act(flush);
  await click(btn(container, b => b.textContent.trim() === 'Rescore'));
  for (let i = 0; i < 15; i++) await act(flush);
  const saved = stub.calls.filter(c => c[0] === 'saveTeaser').at(-1)[1];
  assert.equal(saved.result.teaserVersion, TEASER_VERSION_LIVE);
  assert.ok(!container.querySelector('[data-field="method-outdated"]'));
  assert.ok(container.querySelector('[data-field="scored-with"]').textContent.includes(`with method v${TEASER_VERSION_LIVE}`));
  await click(btn(container, b => b.textContent.includes('All teasers')));
  for (let i = 0; i < 5; i++) await act(flush);
  assert.ok(!btn(container, b => b.textContent.includes('Earlier') && !b.textContent.includes('All teasers')).textContent.includes('Earlier method'));
  globalThis.__liveVersion = undefined;
  await act(async () => root.unmount());
});

test('when the version cannot be checked, scoring is not blocked', async () => {
  installFetch(await scoringJson());
  globalThis.__liveVersion = undefined; // version.json answers 404
  const { container, root } = await openOldTeaser();
  await click(btn(container, b => b.textContent.includes('Earlier') && !b.textContent.includes('All teasers'))); await act(flush);
  await click(btn(container, b => b.textContent.trim() === 'Rescore'));
  for (let i = 0; i < 15; i++) await act(flush);
  assert.equal(stub.calls.filter(c => c[0] === 'saveTeaser').at(-1)[1].result.teaserVersion, TEASER_VERSION_LIVE);
  await act(async () => root.unmount());
});


test('teasers never move a baseline: only full assessments count, even with teasers in the same sector', async () => {
  // Five energy full assessments averaging 60, plus teasers in the same sector
  // scoring far lower. The baseline must stay at 60 in the report and export.
  stub.state.compassRows = [50, 55, 60, 65, 70].map((v, i) => fullRow(`Full${i}`, 'energy', v));
  const t = async (id, name, overall) => { const r = { ...(await makeRecord()), id, brand_name: name, industry: 'energy', campaign_id: 'c-1' }; r.result = { ...r.result, overall }; return r; };
  const teasers = [await t('a', 'Alpha', 20), await t('b', 'Bravo', 25), await t('c', 'Charlie', 30)];
  stub.state.campaignScores = teasers.map(x => ({ id: x.id, brand_name: x.brand_name, website_url: x.website_url, industry: 'energy', result: x.result }));
  const { container, root } = await mountWith({ campaigns: [{ id: 'c-1', name: 'One' }], teasers });
  await click(btn(container, b => b.textContent.includes('Alpha') && !b.textContent.includes('All teasers'))); await act(flush);
  assert.match(container.querySelector('[data-field="baseline"]').textContent, /from full assessments:\s*60/);
  assert.ok(container.querySelector('[data-field="baseline"]').textContent.includes('5 full assessments'), 'three teasers not counted');
  await act(async () => root.unmount());
});

// ── Navigation (v3.35) ──

test('the top navigation has no icons, desktop or mobile, and every control keeps a text label', async () => {
  const props = { onNewAssessment() {}, onGoHome() {}, onSavedAssessments() {}, onCompassResults() {}, onComparison() {}, onStayConscious() {}, onTeaser() {}, activePage: null, user: { email: 'a@b.c' }, profile: { is_admin: true, full_name: 'Paul' }, onLogout() {}, onAdmin() {} };
  const container = document.createElement('div'); document.body.appendChild(container);
  const root = client.createRoot(container);
  await act(async () => { root.render(h(App.Header, props)); });
  const navButtons = () => [...container.querySelectorAll('button')].filter(b => !b.querySelector('img'));
  for (const b of navButtons()) {
    assert.equal(b.querySelector('svg'), null, `icon in "${b.textContent.trim()}"`);
    assert.ok(b.textContent.trim().length > 0, 'no unlabelled controls');
  }
  const labels = navButtons().map(b => b.textContent.trim());
  for (const l of ['Stay Conscious', 'Compare', 'Results', 'Saved', 'Teaser', 'New', 'Admin', 'Sign out', 'Menu']) assert.ok(labels.includes(l), l);
  // Open the mobile menu and check it too.
  await click([...container.querySelectorAll('button')].find(b => b.textContent.trim() === 'Menu'));
  assert.ok(labels.length < navButtons().length, 'mobile menu opened');
  for (const b of navButtons()) assert.equal(b.querySelector('svg'), null, `icon in mobile "${b.textContent.trim()}"`);
  assert.ok(navButtons().some(b => b.textContent.trim() === 'Close'));
  await act(async () => root.unmount());
});

// ── CSO audience and thesis (v3.36) ──

const { THESIS_TENETS: TENETS } = await import('../src/data/thesis.js');
const thesisRead = { present: true, summary: 'Progress is real and quiet.', progress: 'strong', voice: 'quiet', verdict: { label: 'Whispering', meaning: 'Real progress, told too quietly to move anyone.' },
  tenets: Object.fromEntries(TENETS.map((t, i) => [t.id, { level: ['buried', 'surfacing', 'breaking'][i % 3], reason: `Reason ${t.id}` }])) };

test('the thesis panel renders all six tenets and the verdict; a general teaser shows none of it', async () => {
  const rec = await makeRecord();
  const withThesis = { ...rec, result: { ...rec.result, scores: { ...rec.result.scores, sustainabilityNarrative: thesisRead } } };
  const html = server.renderToStaticMarkup(h(App.TeaserClientView, { payload: logic.makeTeaserClientPayload(withThesis) }));
  assert.ok(html.includes('Sustainability narrative') && html.includes('Whispering') && html.includes('Progress strong · Voice quiet'));
  TENETS.forEach(t => assert.ok(html.includes(t.name), t.name));
  assert.ok(html.includes('Breaking through') && html.includes('Surfacing') && html.includes('Buried'));
  const plain = server.renderToStaticMarkup(h(App.TeaserClientView, { payload: logic.makeTeaserClientPayload(rec) }));
  assert.ok(!plain.includes('data-thesis-panel'));
});

test('the teaser PDF writes the thesis read for CSO teasers', async () => {
  const rec = await makeRecord();
  rec.result = { ...rec.result, scores: { ...rec.result.scores, sustainabilityNarrative: thesisRead } };
  const { pdf } = await App.exportTeaserPdf(logic.makeTeaserClientPayload(rec), null, { download: false });
  const text = [...pdf.output().matchAll(/\((.*?)\) Tj/g)].map(m => m[1]).join(' ');
  assert.ok(text.includes('SUSTAINABILITY NARRATIVE') && text.includes('Whispering'));
  assert.ok(text.includes('BREAKING THROUGH'));
});

test('a new campaign can be created for a CSO audience, and the switch on a campaign flips it', async () => {
  const { container, root } = await mountWith({ campaigns: [{ id: 'c-1', name: 'General', cso_audience: false }] });
  await selectValue(container.querySelector('[data-field="campaign"]'), '__new');
  await typeInto(container.querySelector('[data-field="new-campaign"]'), 'Impact leaders Q4');
  const box = container.querySelector('[data-field="new-campaign-cso"]');
  await act(async () => { box.click(); });
  await click(btn(container, b => b.textContent === 'Create'));
  await act(flush);
  assert.equal(stub.calls.find(c => c[0] === 'createCampaign')[1].cso_audience, true);
  assert.ok(container.querySelector('[data-field="cso-hint"]'), 'form says what CSO audience adds');
  const toggle = container.querySelector('[data-campaign="c-1"] [data-field="cso-toggle"]');
  assert.ok(toggle.textContent.includes('off'));
  await click(toggle); await act(flush);
  assert.deepEqual(stub.calls.find(c => c[0] === 'setCampaignAudience').slice(1), ['c-1', true]);
  await act(async () => root.unmount());
});

test('running a teaser in a CSO campaign adds the sustainability scan and records the audience', async () => {
  const raw = JSON.parse(await scoringJson()); raw.sustainabilityNarrative = thesisRead;
  const log = installFetch(JSON.stringify(raw));
  stub.state.campaigns = [{ id: 'c-1', name: 'Impact', cso_audience: true }]; stub.state.teasers = []; stub.calls.length = 0;
  const { container, root, props } = mountPage();
  await act(async () => { root.render(h(App.TeaserPage, props)); }); await act(flush);
  await selectValue(container.querySelector('[data-field="campaign"]'), 'c-1');
  await typeInto(container.querySelector('[data-field="brand"]'), 'Acme');
  await typeInto(container.querySelector('[data-field="url"]'), 'acme.com');
  await selectValue(container.querySelector('[data-field="industry"]'), 'energy');
  await click(btn(container, b => b.textContent.includes('Run teaser')));
  for (let i = 0; i < 20; i++) await act(flush);
  const searches = log.filter(l => l.url === '/api/claude' && l.body.useWebSearch);
  assert.equal(searches.length, 5, 'four standard scans plus sustainability');
  const saved = stub.calls.filter(c => c[0] === 'saveTeaser').at(-1)[1];
  assert.equal(saved.result.audience, 'cso');
  assert.equal(saved.evidence.sources.sustainability.status, 'ok');
  assert.ok(container.querySelector('[data-teaser-client-view] [data-thesis-panel]'), 'thesis read shown');
  await act(async () => root.unmount());
});

test('a teaser scored before its campaign went CSO says how to add the read', async () => {
  const rec = { ...(await makeRecord()), id: 'a', brand_name: 'Acme', campaign_id: 'c-1' };
  rec.result = { ...rec.result, audience: 'general' };
  const { container, root } = await mountWith({ campaigns: [{ id: 'c-1', name: 'Impact', cso_audience: true }], teasers: [rec] });
  await click(btn(container, b => b.textContent.includes('Acme') && !b.textContent.includes('All teasers'))); await act(flush);
  assert.ok(container.querySelector('[data-field="audience-mismatch"]').textContent.includes('Refresh evidence'));
  await act(async () => root.unmount());
});

// ── Full assessment: the thesis reaches the client link (v3.36) ──

test('full assessment client payload whitelists the thesis read, and the client view shows it', () => {
  const scores = { headline: 'H', sustainabilityNarrative: { ...thesisRead, rawModelText: 'SENTINEL_RAW' } };
  for (const a of ['AWAKE', 'AWARE', 'REFLECTIVE', 'ATTENTIVE', 'COGENT', 'SENTIENT', 'VISIONARY', 'INTENTIONAL']) scores[a] = { score: 60, findings: 'f', impact: 'i' };
  const payload = App.makeClientPayload({ project: { brandName: 'Acme', industry: 'energy' }, scores, benchmark: null });
  assert.ok(!JSON.stringify(payload).includes('SENTINEL_RAW'));
  assert.equal(payload.scores.sustainabilityNarrative.verdict.label, 'Whispering');
  const html = server.renderToStaticMarkup(h(App.ClientReportView, { payload }));
  assert.ok(html.includes('data-thesis-panel') && html.includes('Whispering'));
  const none = App.makeClientPayload({ project: { brandName: 'Acme', industry: 'energy' }, scores: { ...scores, sustainabilityNarrative: undefined }, benchmark: null });
  assert.ok(!server.renderToStaticMarkup(h(App.ClientReportView, { payload: none })).includes('data-thesis-panel'), 'older reports simply omit the section');
});

test('the full report offers to regenerate when an older report has no thesis read', () => {
  let clicked = false;
  const html = server.renderToStaticMarkup(h(App.ThesisPanel, { thesis: null, onRegenerate: () => { clicked = true; } }));
  assert.ok(html.includes('Regenerate report'));
  assert.equal(server.renderToStaticMarkup(h(App.ThesisPanel, { thesis: null })), '', 'client views show nothing');
  void clicked;
});

// ── Scorecard controls (v3.37) ──

test('Card and Slide are offered only when there is a score, an image and a baseline', async () => {
  const rec = { ...(await makeRecord()), id: 'a', brand_name: 'Acme', industry: 'energy', campaign_id: 'c-1' };
  stub.state.compassRows = [50, 55, 60, 65, 70].map((v, i) => fullRow(`F${i}`, 'energy', v));
  const { container, root } = await mountWith({ campaigns: [{ id: 'c-1', name: 'One' }], teasers: [rec] });
  await click(btn(container, b => b.textContent.includes('Acme') && !b.textContent.includes('All teasers'))); await act(flush);
  const card = () => container.querySelector('[data-field="make-card"]');
  const slide = () => container.querySelector('[data-field="make-slide"]');
  assert.equal(card().disabled, true, 'no brand image yet');
  assert.match(card().title, /Needs a brand image/);
  assert.ok(container.querySelector('[data-field="hero-image"]').textContent.includes('none yet'));

  // Upload one: the report saves it against the teaser.
  stub.state.teasers[0] = { ...rec, hero_image: 'data:image/jpeg;base64,AAAA' };
  const { container: c2, root: r2 } = await mountWith({ campaigns: [{ id: 'c-1', name: 'One' }], teasers: [stub.state.teasers[0]] });
  await click(btn(c2, b => b.textContent.includes('Acme') && !b.textContent.includes('All teasers'))); await act(flush);
  assert.equal(c2.querySelector('[data-field="make-card"]').disabled, false);
  assert.equal(c2.querySelector('[data-field="make-slide"]').disabled, false);
  assert.ok(c2.querySelector('[data-field="hero-image"] img'), 'thumbnail shown');
  void slide; void root;
  await act(async () => r2.unmount());
});

test('removing the brand image saves null and disables the scorecard buttons again', async () => {
  const rec = { ...(await makeRecord()), id: 'a', brand_name: 'Acme', industry: 'energy', campaign_id: 'c-1', hero_image: 'data:image/jpeg;base64,AAAA' };
  stub.state.compassRows = [50, 55, 60, 65, 70].map((v, i) => fullRow(`F${i}`, 'energy', v));
  const { container, root } = await mountWith({ campaigns: [{ id: 'c-1', name: 'One' }], teasers: [rec] });
  await click(btn(container, b => b.textContent.includes('Acme') && !b.textContent.includes('All teasers'))); await act(flush);
  await click(btn(container, b => b.textContent.trim() === 'Remove'));
  for (let i = 0; i < 5; i++) await act(flush);
  const saved = stub.calls.filter(c => c[0] === 'saveTeaser').at(-1)[1];
  assert.equal(saved.hero_image, null);
  assert.equal(container.querySelector('[data-field="make-card"]').disabled, true);
  await act(async () => root.unmount());
});

test('when a scorecard cannot be made, the report says why on the page, not just in a tooltip', async () => {
  const rec = { ...(await makeRecord()), id: 'a', brand_name: 'Acme', industry: 'energy', campaign_id: 'c-1' };
  stub.state.compassRows = [50, 55, 60, 65, 70].map((v, i) => fullRow(`F${i}`, 'energy', v));
  let m = await mountWith({ campaigns: [{ id: 'c-1', name: 'One' }], teasers: [rec] });
  await click(btn(m.container, b => b.textContent.includes('Acme') && !b.textContent.includes('All teasers'))); await act(flush);
  let note = m.container.querySelector('[data-field="scorecard-blocked"]');
  assert.ok(note && note.textContent.includes('need a brand image'), note?.textContent);
  assert.ok(note.textContent.includes('Upload one in the internal panel'));
  await act(async () => m.root.unmount());

  // No full assessments in the sector: the baseline is what is missing.
  stub.state.compassRows = [];
  m = await mountWith({ campaigns: [{ id: 'c-1', name: 'One' }], teasers: [{ ...rec, hero_image: 'data:image/jpeg;base64,AAAA' }] });
  await click(btn(m.container, b => b.textContent.includes('Acme') && !b.textContent.includes('All teasers'))); await act(flush);
  note = m.container.querySelector('[data-field="scorecard-blocked"]');
  assert.ok(note.textContent.includes('a sector baseline') && note.textContent.includes('full assessments in this sector'));
  await act(async () => m.root.unmount());

  // Everything present: no warning, buttons live.
  stub.state.compassRows = [50, 55, 60, 65, 70].map((v, i) => fullRow(`F${i}`, 'energy', v));
  m = await mountWith({ campaigns: [{ id: 'c-1', name: 'One' }], teasers: [{ ...rec, hero_image: 'data:image/jpeg;base64,AAAA' }] });
  await click(btn(m.container, b => b.textContent.includes('Acme') && !b.textContent.includes('All teasers'))); await act(flush);
  assert.equal(m.container.querySelector('[data-field="scorecard-blocked"]'), null);
  assert.equal(m.container.querySelector('[data-field="make-card"]').disabled, false);
  await act(async () => m.root.unmount());
});

test('a missing hero_image column is reported as the SQL that fixes it', async () => {
  const rec = { ...(await makeRecord()), id: 'a', brand_name: 'Acme', industry: 'energy', campaign_id: 'c-1', hero_image: 'data:image/jpeg;base64,AAAA' };
  stub.state.compassRows = [50, 55, 60, 65, 70].map((v, i) => fullRow(`F${i}`, 'energy', v));
  const { container, root } = await mountWith({ campaigns: [{ id: 'c-1', name: 'One' }], teasers: [rec] });
  await click(btn(container, b => b.textContent.includes('Acme') && !b.textContent.includes('All teasers'))); await act(flush);
  stub.state.saveResult = { data: null, error: { message: `Could not find the 'hero_image' column of 'teaser_assessments' in the schema cache` } };
  await click(btn(container, b => b.textContent.trim() === 'Remove'));
  for (let i = 0; i < 5; i++) await act(flush);
  assert.ok(container.textContent.includes('add column if not exists hero_image text'), 'names the fix');
  stub.state.saveResult = null;
  await act(async () => root.unmount());
});

test('exports refuse to start from a tab left open across a deploy', async () => {
  installFetch(await scoringJson());
  globalThis.__liveVersion = '99.0.0';
  const rec = { ...(await makeRecord()), id: 'a', brand_name: 'Acme', industry: 'energy', campaign_id: 'c-1', hero_image: 'data:image/jpeg;base64,AAAA' };
  stub.state.compassRows = [50, 55, 60, 65, 70].map((v, i) => fullRow(`F${i}`, 'energy', v));
  stub.state.campaignScores = [{ id: 'a', brand_name: 'Acme', website_url: 'https://acme.com', industry: 'energy', result: rec.result }];
  const { container, root } = await mountWith({ campaigns: [{ id: 'c-1', name: 'One' }], teasers: [rec] });
  stub.calls.length = 0;
  // campaign download
  await click(btn(container.querySelector('[data-campaign="c-1"]'), b => b.textContent.includes('Download scores')));
  for (let i = 0; i < 6; i++) await act(flush);
  assert.equal(stub.calls.filter(c => c[0] === 'fetchCampaignScores').length, 0, 'no work started');
  assert.ok(container.textContent.includes('Reload the page'));
  // slide and card
  await click(btn(container, b => b.textContent.includes('Acme') && !b.textContent.includes('All teasers'))); await act(flush);
  await click(container.querySelector('[data-field="make-slide"]'));
  for (let i = 0; i < 6; i++) await act(flush);
  assert.ok(container.textContent.includes('older version of the Compass'));
  globalThis.__liveVersion = undefined;
  await act(async () => root.unmount());
});
