// What your audience is asking (v4.15.0): Google "People also ask" through
// SerpApi, ideas that must cite real questions, and a client payload built by
// whitelist. A recommendation layer: scores are never touched.
import { test, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import * as aq from '../src/lib/audienceQuestions.js';
import * as teaser from '../src/lib/teaser.js';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://compass.test/' });
globalThis.window = dom.window;
for (const k of Object.getOwnPropertyNames(dom.window)) {
  if (k in globalThis) continue;
  try { Object.defineProperty(globalThis, k, { value: dom.window[k], configurable: true, writable: true }); } catch { /* read-only */ }
}

const INPUT = { brandName: 'Acme Solar', websiteUrl: 'https://acmesolar.com', businessModel: 'b2c', industry: 'energy', industryName: 'Energy', stage: null };
const SITE = '[https://acmesolar.com]\nAcme Solar installs rooftop solar for homeowners in New Jersey.';

const SUBTOPICS = JSON.stringify({
  niche: 'rooftop solar for New Jersey homeowners.',
  subtopics: [
    { name: 'Cost', query: 'rooftop solar cost' },
    { name: 'Brand', query: 'acme solar reviews' },          // a brand search: dropped
    { name: 'Worth it', query: 'is solar worth it — nj' },
    { name: 'Cost again', query: 'Rooftop solar cost' },     // a duplicate: dropped
    { name: 'Incentives', query: 'solar tax credit 2026' },
    { name: 'Batteries', query: 'do i need a solar battery' },
    { name: 'Too many', query: 'solar panel lifespan' },
  ],
});

// A fake SerpApi behind /api/audience-questions: four questions per search,
// each with a token, one repeated across searches.
function serpFetch({ log = [], fail = null, notConfigured = false, perSearch = 4 } = {}) {
  return async (url) => {
    const u = new URL(url, 'https://compass.test');
    log.push(Object.fromEntries(u.searchParams));
    if (notConfigured) return { ok: false, status: 503, json: async () => ({ notConfigured: true, error: 'no key' }) };
    const q = u.searchParams.get('q') || `more ${u.searchParams.get('token')}`;
    if (fail && q.includes(fail)) return { ok: false, status: 502, json: async () => ({ error: 'SerpApi said HTTP 500.' }) };
    const questions = Array.from({ length: perSearch }, (_, i) => ({
      question: i === 0 ? 'How much does solar cost?' : `${q} question ${i}?`,
      snippet: `SNIPPET_SECRET for ${q}`, source: 'energy.gov', link: 'https://energy.gov/x', token: `${q}-tok-${i}`,
    }));
    return { ok: true, status: 200, json: async () => ({ questions }) };
  };
}

const ideasFor = (harvest, extra = []) => JSON.stringify({
  ideas: [
    { title: 'What rooftop solar really costs in New Jersey — line by line', questionIds: [harvest.questions[0].id, 'q999'], gap: 'missing', format: 'carousel', channel: 'Instagram', attribute: 'cogent', why: 'Cost is the first thing buyers ask.', earnedCreative: false },
    { title: 'Invented demand', questionIds: ['q404'], gap: 'missing', format: 'Article', channel: 'Site', attribute: 'AWARE', why: 'x' },
    { title: 'Already covered, go further', questionIds: [harvest.questions[1].id], gap: 'answered', format: 'Guide', channel: 'Site', attribute: 'AWARE', why: 'y' },
    { title: 'Thin answer', questionIds: [harvest.questions[2].id], gap: 'thin', format: 'nonsense', channel: 'LinkedIn', attribute: 'NOT_AN_ATTR', why: 'z', earnedCreative: true },
    ...extra,
  ],
});

// ── Subtopics ──

test('subtopics are category searches: brand searches and duplicates are dropped, dashes cleaned, capped', () => {
  const { niche, subtopics } = aq.parseSubtopics(SUBTOPICS, 'Acme Solar', 4);
  assert.equal(niche, 'rooftop solar for New Jersey homeowners', 'trailing full stop dropped');
  assert.deepEqual(subtopics.map(s => s.query), ['rooftop solar cost', 'is solar worth it, nj', 'solar tax credit 2026', 'do i need a solar battery']);
  assert.throws(() => aq.parseSubtopics('{"subtopics":[]}', 'x'), /No usable subtopics/);
  assert.throws(() => aq.parseSubtopics('no json here', 'x'), /no JSON/);
});

test('the subtopic prompt asks for category searches and never for the brand name', () => {
  const p = aq.buildSubtopicPrompt(INPUT, SITE, 'teaser');
  assert.ok(p.includes('name 4 subtopics'));
  assert.ok(p.includes("never the brand's name"));
  assert.ok(p.includes("read the brand's HOMEPAGE") && p.includes('name its niche'), 'the niche comes from the homepage');
  assert.ok(p.includes('"niche"'));
  assert.ok(p.includes('Acme Solar installs rooftop solar'));
  assert.ok(aq.buildSubtopicPrompt(INPUT, SITE, 'full').includes('name 5 subtopics'));
});

// ── Harvest ──

test('the harvest dedupes questions, expands within budget and never exceeds the search cap', async () => {
  for (const mode of ['teaser', 'full']) {
    const log = [];
    const subs = aq.parseSubtopics(SUBTOPICS, 'Acme Solar', aq.AQ_MODES[mode].subtopics).subtopics;
    const h = await aq.harvestQuestions(subs, { fetchImpl: serpFetch({ log }), mode });
    assert.ok(h.searches <= aq.searchBudget(mode), `${mode}: ${h.searches} searches`);
    assert.equal(log.length, h.searches, 'every search is counted');
    assert.equal(log.filter(p => p.token).length, subs.length * aq.AQ_MODES[mode].expandPer, 'expansions per subtopic');
    assert.ok(log.every(p => p.gl === 'us' && p.hl === 'en'), 'US English by default');
    assert.equal(h.questions.filter(q => q.question === 'How much does solar cost?').length, 1, 'a repeated question is kept once');
    assert.ok(h.questions.length <= aq.AQ_MODES[mode].maxQuestions);
    assert.deepEqual(h.questions.map(q => q.id), h.questions.map((_, i) => `q${i + 1}`));
  }
  assert.equal(aq.searchBudget('teaser'), 8);
  assert.equal(aq.searchBudget('full'), 15);
});

test('one failed search is recorded and the rest carry on; a missing key stops the run', async () => {
  const subs = aq.parseSubtopics(SUBTOPICS, 'Acme Solar', 4).subtopics;
  const h = await aq.harvestQuestions(subs, { fetchImpl: serpFetch({ fail: 'tax credit' }), mode: 'teaser' });
  assert.equal(h.failures.length, 1);
  assert.ok(h.questions.length > 5);
  await assert.rejects(aq.harvestQuestions(subs, { fetchImpl: serpFetch({ notConfigured: true }), mode: 'teaser' }), e => e.notConfigured === true);
});

// ── Ideas ──

test('ideas must cite real questions: invented ids are stripped, an idea with none is dropped', async () => {
  const subs = aq.parseSubtopics(SUBTOPICS, 'Acme Solar', 4).subtopics;
  const h = await aq.harvestQuestions(subs, { fetchImpl: serpFetch(), mode: 'teaser' });
  const ideas = aq.parseIdeas(ideasFor(h), h, 'teaser');
  assert.ok(!ideas.some(i => i.title === 'Invented demand'), 'no real question, no idea');
  assert.deepEqual(ideas[0].questionIds, [h.questions[0].id], 'q999 is not a harvested question');
  assert.deepEqual(ideas.map(i => i.gap), ['missing', 'thin', 'answered'], 'gaps first');
  assert.equal(ideas[0].format, 'Carousel');
  assert.equal(ideas[0].attribute, 'COGENT');
  assert.equal(ideas[1].format, 'Article', 'an unknown format falls back');
  assert.equal(ideas[1].attribute, null, 'an unknown attribute is dropped, never shown');
  assert.ok(!/[—–]/.test(JSON.stringify(ideas)), 'no em or en dashes');
});

test('a teaser gets at most 5 ideas, a full assessment at most 10, and fewer real ones are never padded', async () => {
  const subs = aq.parseSubtopics(SUBTOPICS, 'Acme Solar', 5).subtopics;
  const h = await aq.harvestQuestions(subs, { fetchImpl: serpFetch(), mode: 'full' });
  const many = Array.from({ length: 12 }, (_, i) => ({ title: `Idea ${i}`, questionIds: [h.questions[i + 3].id], gap: 'missing', format: 'Article', channel: 'Site', attribute: 'AWARE', why: 'w' }));
  assert.equal(aq.parseIdeas(ideasFor(h, many), h, 'teaser').length, 5);
  assert.equal(aq.parseIdeas(ideasFor(h, many), h, 'full').length, 10);
  assert.equal(aq.parseIdeas(ideasFor(h), h, 'full').length, 3, 'three real ideas stay three');
  assert.ok(aq.buildIdeasPrompt(INPUT, h, SITE, 'teaser').includes('Write exactly 5 ideas'));
  assert.ok(aq.buildIdeasPrompt(INPUT, h, SITE, 'full').includes('Write between 5 and 10 ideas'));
  assert.ok(aq.buildIdeasPrompt(INPUT, h, SITE, 'teaser').includes('do not claim the whole site lacks it'));
});

// ── The run ──

test('the run never throws: a missing key, a failure and a thin harvest each come back as a status', async () => {
  const model = (calls) => async (p) => { calls.push(p); return p.includes('People also ask') ? '{"ideas":[]}' : SUBTOPICS; };
  const calls = [];
  const nc = await aq.runAudienceQuestions(INPUT, { siteText: SITE, mode: 'teaser', fetchImpl: serpFetch({ notConfigured: true }), callModel: model(calls) });
  assert.equal(nc.status, 'notConfigured');
  assert.deepEqual(nc.ideas, []);
  assert.equal(calls.length, 0, 'a missing key is found before any model call');
  const thinCalls = [];
  const thin = await aq.runAudienceQuestions(INPUT, { siteText: SITE, mode: 'teaser', fetchImpl: serpFetch({ perSearch: 0 }), callModel: model(thinCalls) });
  assert.equal(thin.status, 'thin');
  assert.equal(thinCalls.length, 1, 'no ideas call without five real questions');
  const failed = await aq.runAudienceQuestions(INPUT, { mode: 'teaser', fetchImpl: serpFetch(), callModel: async () => { throw new Error('model down'); } });
  assert.equal(failed.status, 'failed');
  assert.equal(failed.error, 'model down');
});

async function okRecord(mode = 'teaser') {
  let harvest = null;
  const callModel = async (p) => {
    if (!p.includes('People also ask')) return SUBTOPICS;
    harvest = { questions: [...p.matchAll(/^(q\d+) \| [^|]+ \| (.+)$/gm)].map(m => ({ id: m[1], question: m[2] })) };
    return ideasFor(harvest);
  };
  return aq.runAudienceQuestions(INPUT, { siteText: SITE, mode, fetchImpl: serpFetch(), callModel });
}

test('a good run records the harvest, the ideas and its own numbers', async () => {
  const r = await okRecord('full');
  assert.equal(r.status, 'ok');
  assert.equal(r.version, aq.AQ_VERSION);
  assert.equal(r.location, 'United States');
  assert.equal(r.ideas.length, 3);
  assert.ok(r.searches <= 15 && r.questions.length > 5 && r.subtopics.length === 5);
});

// ── Client payload hygiene ──

test('the client payload carries ideas and question text only, by whitelist', async () => {
  const r = await okRecord('teaser');
  const c = aq.clientAudienceQuestions({ ...r, failures: [{ query: 'SENTINEL_FAILURE' }], error: 'SENTINEL_ERROR' });
  const json = JSON.stringify(c);
  for (const leak of ['SNIPPET_SECRET', 'energy.gov', '"subtopic"', '"query"', 'SENTINEL_FAILURE', 'SENTINEL_ERROR', '"searches"', '"questionIds"', '"subtopics"', '"unused"']) assert.ok(!json.includes(leak), leak);
  assert.deepEqual(Object.keys(c).sort(), ['gatheredAt', 'ideas', 'intro', 'location', 'mode', 'niche']);
  assert.equal(c.intro, 'The questions people are asking Google about rooftop solar for New Jersey homeowners, and the content that would answer them.');
  assert.ok(c.ideas[0].questions[0].endsWith('?'), 'the real question text travels');
  assert.equal(c.ideas[0].gapLabel, 'Not on main pages', 'a teaser says where it looked');
  assert.equal(aq.clientAudienceQuestions((await okRecord('full'))).ideas[0].gapLabel, 'Not on the site');
  assert.equal(c.ideas[1].gapLabel, 'Touched on, not answered');
  // A record from before v4.15.2 holds a capitalised category, and still reads.
  const old = aq.clientAudienceQuestions({ ...r, niche: undefined, category: 'Residential rooftop solar' });
  assert.equal(old.intro, 'The questions people are asking Google about residential rooftop solar, and the content that would answer them.');
  assert.equal(aq.nicheText({ category: 'EV charging for fleets' }), 'EV charging for fleets', 'an acronym keeps its capitals');
  assert.equal(aq.clientAudienceQuestions({ ...r, niche: '' }).intro, aq.AQ_COPY.intro);
  assert.equal(aq.clientAudienceQuestions({ ...r, ideas: [] }), null, 'nothing without ideas');
  assert.equal(aq.clientAudienceQuestions(null), null);
  const internal = aq.audienceView(r);
  assert.ok(internal.subtopics.length && internal.unused.length && internal.searches > 0, 'the internal view keeps the workings');
});

test('the teaser client payload includes the ideas and none of the harvest internals', async () => {
  const r = await okRecord('teaser');
  const { ATTRIBUTES } = await import('../src/data/rubric.js');
  const o = { headline: 'h', summary: 's' };
  ATTRIBUTES.forEach(a => { o[a.id] = { score: 50, confidence: 'medium', rationale: 'r' }; });
  const rec = { brand_name: 'Acme Solar', website_url: 'https://acmesolar.com', evidence: { sources: { audienceQuestions: r } }, result: teaser.finaliseTeaser(teaser.parseTeaserScoring(JSON.stringify(o))) };
  const p = teaser.makeTeaserClientPayload(rec);
  assert.equal(p.audienceQuestions.ideas.length, 3);
  assert.ok(!JSON.stringify(p).includes('SNIPPET_SECRET'));
  assert.equal(teaser.makeTeaserClientPayload({ ...rec, evidence: { sources: {} } }).audienceQuestions, null);
});

// ── Scores are never touched ──

test('teaser evidence: the audience source waits for the website, never counts toward scoring, never reaches the prompt', async () => {
  const pages = [];
  const fetchImpl = async (url) => {
    if (String(url).startsWith('/api/scrape')) { pages.push(url); return { ok: true, json: async () => ({ text: 'Acme Solar installs rooftop solar for homeowners, a page long enough to count.' }) }; }
    return { ok: false, json: async () => ({ error: 'nope' }) };
  };
  let sawSite = null;
  const ev = await teaser.gatherEvidence({ ...INPUT, websiteUrl: 'acmesolar.com' }, {
    fetchImpl,
    callSearch: async () => 'Search evidence text that is comfortably longer than forty characters.',
    runAudience: async (siteText) => { sawSite = siteText; return { status: 'failed', error: 'SENTINEL_AQ', ideas: [], questions: [] }; },
  });
  assert.ok(sawSite.includes('Acme Solar installs rooftop solar'), 'it reads the scraped pages');
  assert.equal(ev.sources.audienceQuestions.status, 'failed');
  assert.ok(teaser.evidenceCoverage(ev).canScore, 'a failed audience run never blocks scoring');
  assert.ok(!teaser.TEASER_SOURCES.some(s => s.id === 'audienceQuestions'));
  const prompt = teaser.buildTeaserScoringPrompt(INPUT, { sources: { ...ev.sources, audienceQuestions: await okRecord() } });
  assert.ok(!prompt.includes('SNIPPET_SECRET') && !prompt.includes('How much does solar cost') && !prompt.includes('SENTINEL_AQ'), 'the scoring prompt never sees it');
  const without = await teaser.gatherEvidence(INPUT, { fetchImpl, callSearch: async () => 'Search evidence text that is comfortably longer than forty characters.' });
  assert.equal(without.sources.audienceQuestions, undefined, 'optional: no runner, no source');
});

test('the full report keeps audience questions through a rescore, refreshes from a ref, and the framework version stands', () => {
  const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
  assert.ok(app.includes('if (scores?.audienceQuestions) adjusted.audienceQuestions = scores.audienceQuestions;'));
  assert.ok(app.includes('const latest = scoresRef.current;'), 'the run saves into the latest scores, not a stale snapshot');
  assert.ok(app.includes('if (autoSaved && !finalScores.audienceQuestions) findAudience({ search: scoringInputs.search || null });'), 'ideas come from the stored harvest straight after scoring');
  assert.ok(app.includes('audienceQuestions: clientAudienceQuestions(scores?.audienceQuestions),'), 'the client payload is whitelisted');
  const rubric = readFileSync(new URL('../src/data/rubric.js', import.meta.url), 'utf8');
  assert.match(rubric, /FRAMEWORK_VERSION = '2\.17'/, 'audience ideas never moved it; search evidence (2.14), evidence routing (2.15) and evidence in the steps (2.16) did');
});

// ── Endpoint ──

function mockRes() {
  const r = { code: 200, body: null };
  r.status = (c) => { r.code = c; return r; };
  r.json = (b) => { r.body = b; return r; };
  r.end = () => r;
  r.setHeader = () => r;
  return r;
}
const authed = { headers: { authorization: 'Bearer good' }, method: 'GET' };
function upstream({ serp = null, admin = false, log = [] } = {}) {
  return async (url) => {
    const s = String(url);
    log.push(s);
    if (s.includes('/auth/v1/user')) return { ok: true, status: 200, json: async () => ({ id: 'u1' }) };
    if (s.includes('/rest/v1/profiles')) return { ok: true, status: 200, json: async () => [{ is_admin: admin }] };
    return serp ? serp(s) : { ok: true, status: 200, json: async () => ({}) };
  };
}

beforeEach(() => {
  process.env.SUPABASE_URL = 'https://sb.test';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service';
  delete process.env.SERPAPI_API_KEY;
});

test('endpoint: without SERPAPI_API_KEY it says notConfigured and calls nothing upstream', async () => {
  const { default: handler } = await import('../api/audience-questions.js');
  const log = [];
  const res = mockRes();
  await handler({ ...authed, query: { q: 'solar cost' } }, res, { fetchImpl: upstream({ log }) });
  assert.equal(res.code, 503);
  assert.equal(res.body.notConfigured, true);
  assert.ok(!log.some(u => u.includes('serpapi')));
});

test('endpoint: ping says the key is set without a search', async () => {
  process.env.SERPAPI_API_KEY = 'SECRET_KEY';
  const { default: handler } = await import('../api/audience-questions.js');
  const log = [];
  const res = mockRes();
  await handler({ ...authed, query: { ping: '1' } }, res, { fetchImpl: upstream({ log }) });
  assert.deepEqual(res.body, { configured: true });
  assert.ok(!log.some(u => u.includes('serpapi')));
});

test('endpoint: a search returns only what the app uses, and the key never comes back', async () => {
  process.env.SERPAPI_API_KEY = 'SECRET_KEY';
  const { default: handler } = await import('../api/audience-questions.js');
  const log = [];
  const serp = async () => ({ ok: true, status: 200, json: async () => ({ related_questions: [
    { question: 'How long do solar panels last?', snippet: 'About 25 years.', source: { name: 'NREL' }, link: 'https://nrel.gov', next_page_token: 'tok', serpapi_link: 'https://serpapi.com/x?api_key=SECRET_KEY' },
    { question: '' },
  ] }) });
  const res = mockRes();
  await handler({ ...authed, query: { q: 'solar panel lifespan', gl: 'us', hl: 'en' } }, res, { fetchImpl: upstream({ serp, log }) });
  assert.equal(res.code, 200);
  assert.deepEqual(res.body.questions, [{ question: 'How long do solar panels last?', snippet: 'About 25 years.', source: 'NREL', link: 'https://nrel.gov', token: 'tok' }]);
  assert.ok(!JSON.stringify(res.body).includes('SECRET_KEY'));
  const call = log.find(u => u.includes('serpapi.com'));
  assert.ok(call.includes('engine=google&') && call.includes('gl=us') && call.includes('q=solar+panel+lifespan'));

  const res2 = mockRes();
  await handler({ ...authed, query: { token: 'tok' } }, res2, { fetchImpl: upstream({ serp, log }) });
  assert.ok(log.at(-1).includes('engine=google_related_questions') && log.at(-1).includes('next_page_token=tok'));

  const empty = mockRes();
  await handler({ ...authed, query: { q: 'x' } }, empty, { fetchImpl: upstream({ serp: async () => ({ ok: true, status: 200, json: async () => ({ error: "Google hasn't returned any results for this query." }) }) }) });
  assert.deepEqual(empty.body.questions, [], 'no results is an empty answer, not a failure');
  assert.deepEqual(empty.body.organic, []);

  const bad = mockRes();
  await handler({ ...authed, query: { q: 'x' } }, bad, { fetchImpl: upstream({ serp: async () => ({ ok: false, status: 401, json: async () => ({ error: 'Invalid API key.' }) }) }) });
  assert.equal(bad.code, 502);
  assert.match(bad.body.error, /rejected the key/);
});

test('endpoint: the connection check is admin only and reads the free account endpoint', async () => {
  process.env.SERPAPI_API_KEY = 'SECRET_KEY';
  const { default: handler } = await import('../api/audience-questions.js');
  const notAdmin = mockRes();
  await handler({ ...authed, query: { check: '1' } }, notAdmin, { fetchImpl: upstream({ admin: false }) });
  assert.equal(notAdmin.code, 403);
  const log = [];
  const ok = mockRes();
  const serp = async () => ({ ok: true, status: 200, json: async () => ({ plan_name: 'Starter', searches_per_month: 1000, total_searches_left: 992, this_month_usage: 8 }) });
  await handler({ ...authed, query: { check: '1' } }, ok, { fetchImpl: upstream({ admin: true, serp, log }) });
  assert.deepEqual(ok.body, { configured: true, ok: true, plan: 'Starter', searchesPerMonth: 1000, searchesLeft: 992, usedThisMonth: 8 });
  assert.ok(log.some(u => u.includes('serpapi.com/account.json')) && !log.some(u => u.includes('search.json')), 'no search is spent');
});

test('vercel gives the endpoint a time limit', () => {
  const v = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
  assert.equal(v.functions['api/audience-questions.js'].maxDuration, 60);
});

// ── Spreadsheet ──

test('the ideas spreadsheet has the ideas and every question, and opens as a workbook', async () => {
  const r = await okRecord('full');
  const { zip, rows, filename } = await aq.buildIdeasWorkbook('Acme Solar', r, new Date('2026-11-03T12:00:00Z'));
  assert.equal(filename, 'Acme-Solar-Audience-Questions-2026-11-03.xlsx');
  assert.equal(rows.length, 3);
  const JSZip = (await import('jszip')).default;
  const back = await JSZip.loadAsync(await zip.generateAsync({ type: 'nodebuffer' }));
  const ideas = await back.file('xl/worksheets/sheet1.xml').async('string');
  const qs = await back.file('xl/worksheets/sheet2.xml').async('string');
  assert.ok(ideas.includes('What rooftop solar really costs in New Jersey, line by line'));
  assert.ok(ideas.includes('Content idea') && ideas.includes('Questions it answers'));
  assert.equal((qs.match(/<row /g) || []).length, r.questions.length + 1);
  assert.ok(!ideas.includes('SNIPPET_SECRET'), 'answer snippets stay out of the ideas sheet');
  for (const f of ['[Content_Types].xml', 'xl/workbook.xml', 'xl/styles.xml', '_rels/.rels']) assert.ok(back.file(f), f);
});

// ── Rendering ──

let App, React, server;
before(async () => {
  React = (await import('react')).default;
  server = await import('react-dom/server');
  App = await import('./.build/app.bundle.mjs');
});
const h = (...a) => React.createElement(...a);

test('the shared section renders ideas with their real questions; internal adds the workings', async () => {
  const r = await okRecord('teaser');
  const client = server.renderToStaticMarkup(h(App.AudienceQuestionsSection, { view: aq.clientAudienceQuestions(r) }));
  assert.ok(client.includes('How much does solar cost?'));
  assert.ok(client.includes('Not on main pages'));
  assert.ok(client.includes('about rooftop solar for New Jersey homeowners'));
  assert.ok(client.includes('Earned creative potential'));
  assert.ok(!client.includes('How these were found'));
  const internal = server.renderToStaticMarkup(h(App.AudienceQuestionsSection, { view: aq.audienceView(r), internal: true }));
  assert.ok(internal.includes('How these were found') && internal.includes('rooftop solar cost'));
  const nc = server.renderToStaticMarkup(h(App.AudienceQuestionsSection, { view: aq.audienceView({ status: 'notConfigured', ideas: [], questions: [] }), internal: true }));
  assert.ok(nc.includes('SERPAPI_API_KEY'));
});

test('the client report and the teaser read show the section; a report without it shows nothing', async () => {
  const { ATTRIBUTES } = await import('../src/data/rubric.js');
  const r = await okRecord('full');
  const scores = Object.fromEntries(ATTRIBUTES.map(a => [a.id, { score: 60, findings: [], impact: '' }]));
  const with_ = App.makeClientPayload({ project: { brandName: 'Acme Solar', industry: 'energy' }, scores: { ...scores, audienceQuestions: r }, benchmark: null });
  assert.equal(with_.audienceQuestions.ideas.length, 3);
  assert.ok(!JSON.stringify(with_).includes('SNIPPET_SECRET'));
  const html = server.renderToStaticMarkup(h(App.ClientReportView, { payload: with_ }));
  assert.ok(html.includes('What this brand&#x27;s audience is asking') && html.includes('How much does solar cost?'));
  const without = App.makeClientPayload({ project: { brandName: 'Acme Solar', industry: 'energy' }, scores, benchmark: null });
  assert.equal(without.audienceQuestions, null);
  assert.ok(!server.renderToStaticMarkup(h(App.ClientReportView, { payload: without })).includes('audience is asking'));
});

// ── Exports (v4.15.1) ──

test('the teaser PDF adds a page for the ideas before the services page, and only the payload reaches it', async () => {
  const { jsPDF } = await import('jspdf');
  const { REPORT_FONTS, reportData } = await import('../src/lib/teaserReport.js');
  const { exportTeaserReportPdf } = await import('../src/lib/scorecard.js');
  const { ATTRIBUTES } = await import('../src/data/rubric.js');
  const r = await okRecord('teaser');
  const five = { ...r, ideas: [0, 1, 2, 3, 4].map(i => ({ ...r.ideas[0], title: `Idea number ${i + 1} for the read`, questionIds: [r.questions[i].id, r.questions[i + 5].id] })) };
  const payload = {
    brandName: 'Acme Solar', websiteUrl: 'https://acmesolar.com', scoredAt: '2026-11-03T10:00:00Z', overall: 52, stage: 'Establishing', frameworkVersion: '2.13',
    headline: 'h', summary: 's', opportunity: 'o', lensScores: { credibility: 50, trust: 50, reputation: 50, authenticity: 50 },
    services: [{ title: 'Content strategy', why: 'w', attributes: ['Cogent'], impact: 'i' }], fullAssessmentWouldResolve: ['Q?'],
    scores: Object.fromEntries([...ATTRIBUTES.map(a => [a.id, { score: 50, confidence: 'medium', rationale: 'r' }]), ['trustFindings', []]]),
    audienceQuestions: aq.clientAudienceQuestions(five),
  };
  const fonts = Object.fromEntries(REPORT_FONTS.map(f => [f.file, readFileSync(new URL(`../public/report/${f.file}`, import.meta.url)).toString('base64')]));
  const { pdf } = await exportTeaserReportPdf(payload, { jsPDF, save: false, fonts: {} });
  assert.equal(pdf.internal.getNumberOfPages(), 6, 'five teaser ideas fit on one added page');
  const withFonts = await exportTeaserReportPdf(payload, { jsPDF, save: false, fonts });
  assert.equal(withFonts.pdf.internal.getNumberOfPages(), 6, 'and with the real fonts');
  const raw = pdf.output();
  for (const s of ["What this brand's audience is asking", 'Idea number 5 for the read', '05 / 06', '06 / 06', 'Where marketing would move this score']) assert.ok(raw.includes(s), s);
  assert.ok(raw.indexOf("What this brand's audience is asking") < raw.indexOf('Where marketing would move this score'), 'ideas come before the services page');
  assert.ok(!raw.includes('SNIPPET_SECRET') && !raw.includes('energy.gov'), 'nothing beyond the payload');
  assert.ok(reportData(payload).method.includes("People also ask"));
  const none = await exportTeaserReportPdf({ ...payload, audienceQuestions: null }, { jsPDF, save: false, fonts: {} });
  assert.equal(none.pdf.internal.getNumberOfPages(), 5, 'no ideas, the original five pages');
  assert.ok(none.pdf.output().includes('05 / 05'));
  const long = { ...five, ideas: five.ideas.map(i => ({ ...i, why: 'A much longer reason that runs on across several lines of the page. '.repeat(4) })) };
  const tall = await exportTeaserReportPdf({ ...payload, audienceQuestions: aq.clientAudienceQuestions(long) }, { jsPDF, save: false, fonts: {} });
  assert.equal(tall.pdf.internal.getNumberOfPages(), 7, 'long copy breaks between ideas onto a second page');
  assert.ok(tall.pdf.output().includes("WHAT THIS BRAND'S AUDIENCE IS ASKING, CONTINUED"));
});

test('the Word report carries the client-safe ideas after earned creative', async () => {
  const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
  const start = app.indexOf('// ── WHAT YOUR AUDIENCE IS ASKING (v4.15.1)');
  assert.ok(start > app.indexOf("...secHead('Earned creative', 'How earned creative could help'),"), 'after earned creative');
  assert.ok(start < app.indexOf("...secHead('What to do next', 'Recommendations'),"), 'before recommendations');
  // Run the block itself against the real docx library.
  const block = app.slice(app.indexOf('...(() => {', start) + 3, app.indexOf('})(),', start) + 4);
  const docx = await import('docx');
  const { Paragraph, TextRun, BorderStyle, Document, Packer } = docx;
  const RULE = 'DEDAD2', INK = '15171A', MUTED = '5B6068', RUST = 'C23B22', SANS = 'Hanken Grotesk', SERIF = 'Newsreader';
  const hair = (color = RULE, size = 4) => ({ style: BorderStyle.SINGLE, size, color, space: 0 });
  const clean = (t) => (t || '').replace(/[—–]/g, '-');
  const body = (text) => new Paragraph({ children: [new TextRun({ text })] });
  const secHead = (e, t) => [new Paragraph({ children: [new TextRun({ text: `${e}|${t}` })] })];
  const run = (scores) => new Function('scores', 'clientAudienceQuestions', 'AQ_COPY', 'secHead', 'body', 'clean', 'hair', 'Paragraph', 'TextRun', 'BorderStyle', 'RULE', 'INK', 'MUTED', 'RUST', 'SANS', 'SERIF', 'aqSource', `return ${block};`)(
    scores, aq.clientAudienceQuestions, aq.AQ_COPY, secHead, body, clean, hair, Paragraph, TextRun, BorderStyle, RULE, INK, MUTED, RUST, SANS, SERIF, aq.aqSource);
  assert.deepEqual(run({}), [], 'nothing without ideas');
  const r = await okRecord('full');
  const paras = run({ audienceQuestions: r });
  const buf = await Packer.toBuffer(new Document({ sections: [{ children: paras }] }));
  const JSZip = (await import('jszip')).default;
  const xml = (await (await JSZip.loadAsync(buf)).file('word/document.xml').async('string')).replace(/&apos;/g, "'");
  for (const s of ["The audience|What this brand's audience is asking", 'What rooftop solar really costs in New Jersey, line by line', 'How much does solar cost?', 'NOT ON THE SITE', 'about rooftop solar for New Jersey homeowners', 'Source: the \u201cPeople also ask\u201d questions in Google search']) assert.ok(xml.includes(s), s);
  assert.ok(!xml.includes('SNIPPET_SECRET') && !xml.includes('rooftop solar cost (Cost)'), 'no internals');
});

test('the lens evidence grid applies to the lens rows only, never the Against rows inside it', () => {
  const css = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8');
  assert.ok(!/\.dc-lens-evidence li \{/.test(css), 'no unscoped rule left to catch the nested list');
  assert.ok(css.includes('.dc-lens-evidence ul:not(.dc-ev-list) > li { display: grid;'));
  assert.ok(css.includes('.dc-ev-list li > .dc-pill { justify-self: end; }'), 'the lens tag sits at the end, not stretched');
});

test('the source line names the Google feature in quotes, everywhere it appears', () => {
  assert.equal(aq.aqSource('United States'), 'Source: the “People also ask” questions in Google search, United States');
  for (const f of ['../src/App.jsx', '../src/lib/teaserReport.js', '../src/lib/audienceQuestions.js']) {
    const src = readFileSync(new URL(f, import.meta.url), 'utf8').split('\n').filter(l => !l.trim().startsWith('//')).join('\n');
    assert.ok(!/Google People also ask|Google's People also ask/.test(src), `${f} has the old wording`);
  }
});
