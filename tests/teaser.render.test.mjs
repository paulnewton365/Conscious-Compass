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
  assert.ok(!html.includes('Thin public record'));
});

test('thin-record banner appears only when the record is flagged', async () => {
  const rec = await makeRecord({ thin: true });
  assert.equal(rec.result.thinRecord, true);
  const html = server.renderToStaticMarkup(h(App.TeaserClientView, { payload: logic.makeTeaserClientPayload(rec) }));
  assert.ok(html.includes('Thin public record'));
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
  assert.ok(container.textContent.includes('Brand name is required.'));
  assert.equal(log.length, 0);
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
  assert.deepEqual(names.filter(n => !['fetchTeasers', 'fetchCampaigns', 'fetchTeaser', 'saveTeaser', 'deleteTeaser'].includes(n)), [], `unexpected calls: ${names}`);
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
