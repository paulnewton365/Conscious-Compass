// Search evidence (v4.16.0, framework 2.14): five measured Google signals,
// gathered once, read by every scoring pass, never sent to a client raw.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as se from '../src/lib/searchEvidence.js';
import * as aq from '../src/lib/audienceQuestions.js';
import * as teaser from '../src/lib/teaser.js';
import { serpUrl, shapeResponse, pickAiOverview, pickOrganic, pickNews } from '../api/audience-questions.js';

const NOW = new Date();
const daysAgo = (d) => new Date(NOW.getTime() - d * 86400000).toISOString();
const INPUT = { brandName: 'Artera', websiteUrl: 'https://artera.ai', businessModel: 'b2b', industry: 'health', industryName: 'Healthcare', stage: 'scaleup' };

// A fake SerpApi behind the endpoint. Counts every search it is asked for.
function fakeSerp({ log = [], aioToken = false, notConfigured = false, failNews = false } = {}) {
  return async (url) => {
    const u = new URL(url, 'https://compass.test');
    const p = Object.fromEntries(u.searchParams);
    if (p.ping) return { ok: !notConfigured, status: notConfigured ? 503 : 200, json: async () => (notConfigured ? { notConfigured: true } : { configured: true }) };
    log.push(p);
    const ok = (body) => ({ ok: true, status: 200, json: async () => body });
    if (p.mode === 'aio') return ok({ aiOverview: { present: true, token: null, sources: [{ domain: 'artera.ai', title: 'Artera' }, { domain: 'healthline.com', title: 'x' }] } });
    if (p.mode === 'autocomplete') return ok({ suggestions: ['artera reviews', 'artera lawsuit', 'artera io careers', 'artera careers'] });
    if (p.mode === 'news') {
      if (failNews) return { ok: false, status: 502, json: async () => ({ error: 'SerpApi said HTTP 500.' }) };
      return ok({ news: [
        { title: 'Artera raises $40M for patient messaging', source: 'Fierce Healthcare', publishedAt: daysAgo(5) },
        { title: 'Artera raises $40M for patient messaging', source: 'Yahoo Finance', publishedAt: daysAgo(5) },
        { title: 'Artera named in KLAS report', source: 'HIT Consultant', publishedAt: daysAgo(6) },
        { title: 'Artera.io launches decentralised identity tool', source: 'CoinDesk', publishedAt: daysAgo(20) },
        { title: 'Patient comms vendors to watch', source: 'Modern Healthcare', publishedAt: daysAgo(70) },
        { title: 'Old story', source: 'STAT', publishedAt: daysAgo(200) },
      ] });
    }
    if (p.token) return ok({ questions: [{ question: `${p.token} follow-up?` }] });
    if (p.q === 'Artera') {
      return ok({
        questions: [],
        organic: [
          { position: 1, domain: 'artera.io', title: 'Artera.io identity', sitelinks: true },
          { position: 2, domain: 'artera.ai', title: 'Artera patient communications', sitelinks: true },
          { position: 3, domain: 'linkedin.com', title: 'Artera | LinkedIn' },
          { position: 4, domain: 'fiercehealthcare.com', title: 'Artera raises' },
          { position: 5, domain: 'artera.io', title: 'Artera.io docs' },
        ],
        aiOverview: { present: false, token: null, sources: [] },
        knowledgeGraph: { present: true, title: 'Artera', type: 'Software company', description: 'Patient communications', website: 'https://artera.ai' },
      });
    }
    // Niche searches: questions, page one and an AI Overview.
    const i = Number(String(p.q).slice(-1)) || 0;
    return ok({
      questions: Array.from({ length: 4 }, (_, k) => ({ question: `${p.q} question ${k}?`, token: `${p.q}-t${k}` })),
      organic: [{ position: 1, domain: 'healthline.com' }, { position: 2, domain: i % 2 ? 'artera.ai' : 'klasresearch.com' }, { position: 3, domain: 'weave.com' }],
      aiOverview: i === 1 ? { present: true, token: null, sources: [{ domain: 'artera.ai' }, { domain: 'healthline.com' }] }
        : i === 2 ? { present: true, token: aioToken ? 'tok' : null, sources: [] }
        : { present: false, token: null, sources: [] },
    });
  };
}

const SUBTOPICS = (markets = []) => JSON.stringify({ niche: 'patient communication software for health systems', subtopics: [1, 2, 3, 4, 5].map(i => ({ name: `Topic ${i}`, query: `patient messaging topic ${i}` })), markets });
const LABELS = JSON.stringify({
  P: { Pus0: 'other', Pus1: 'owned', Pus2: 'owned', Pus3: 'earned', Pus4: 'other' },
  KG: { KGus: 'brand' },
  A: { Aus0: 'brand', Aus1: 'brand', Aus2: 'other', Aus3: 'brand' },
  N: { Nus0: { about: true, tier: 'trade', angle: 'announcement' }, Nus1: { about: true, tier: 'syndicated', angle: 'announcement' }, Nus2: { about: true, tier: 'trade', angle: 'mention' }, Nus3: { about: false }, Nus4: { about: true, tier: 'trade', angle: 'feature' }, Nus5: { about: true, tier: 'national', angle: 'feature' } },
});
const model = (calls = [], markets = []) => async (prompt) => {
  calls.push(prompt);
  if (prompt.includes('Label the Google results')) return LABELS;
  if (prompt.includes('name its niche')) return SUBTOPICS(markets);
  return '{"ideas":[]}';
};

async function fullRun(opts = {}, input = INPUT, markets = []) {
  const log = [];
  const fetchImpl = fakeSerp({ log, ...opts });
  const callModel = model([], markets);
  const harvest = await aq.harvestAudience(input, { siteText: 'Artera patient messaging.', mode: 'full', fetchImpl, callModel });
  const evidence = await se.gatherSearchEvidence(input, { mode: 'full', harvest, fetchImpl, callModel });
  return { harvest, evidence, log };
}

// ── Measures ──

test('every measure is computed in code from the fixtures', async () => {
  const { evidence: e } = await fullRun({ aioToken: true });
  assert.equal(e.status, 'ok');
  const us = e.byMarket.us;
  assert.deepEqual([us.brandPage.owned, us.brandPage.earned, us.brandPage.otherEntity], [2, 1, 2]);
  assert.equal(us.brandPage.topIsBrand, false);
  assert.equal(us.brandPage.nameClash, true, 'artera.io takes the top result: the Artera case');
  assert.equal(us.brandPage.knowledgePanel, 'brand');
  assert.equal(e.aio.shown, 2);
  assert.equal(e.aio.citingBrand, 2, 'the lazily loaded Overview was fetched and cites the brand');
  assert.deepEqual(e.aio.topCited[0], { domain: 'healthline.com', overviews: 2 });
  assert.equal(e.ranking.searched, 5);
  assert.equal(e.ranking.onPageOne, 3, 'odd-numbered niche searches rank artera.ai');
  assert.equal(e.ranking.averagePosition, 2);
  const n = us.news;
  assert.equal(n.articles, 3, 'the wire pickup counts once, the namesake and the 200-day-old story are out');
  assert.equal(n.excludedNamesake, 1);
  assert.deepEqual(n.byMonth, [2, 0, 1]);
  assert.equal(n.clusteredShare, 67);
  assert.deepEqual(n.angles, { announcement: 1, mention: 1, feature: 1 });
});

test('the brand’s own domain is always owned, whatever the label says', () => {
  const page = { organic: [{ position: 1, domain: 'shop.artera.ai', title: 't' }], knowledgeGraph: { present: false } };
  const m = se.measureBrandPage(page, { P: { Pus0: 'other' } }, 'us', 'artera.ai');
  assert.equal(m.owned, 1);
  assert.equal(m.nameClash, false);
});

test('empty and partial responses measure cleanly', () => {
  assert.equal(se.measureBrandPage(null, {}, 'us', 'a.com'), null);
  const empty = se.measureBrandPage({ organic: [], knowledgeGraph: { present: false } }, {}, 'us', 'a.com');
  assert.deepEqual([empty.results, empty.topIsBrand, empty.nameClash, empty.knowledgePanel], [0, false, false, 'none']);
  assert.equal(se.measureNews([], {}, 'us').articles, 0);
  assert.equal(se.measureNews([], {}, 'us').clusteredShare, null);
  assert.deepEqual(se.measureAio([], 'a.com'), { searched: 0, shown: 0, readable: 0, citingBrand: 0, citedOn: [], topCited: [] });
  assert.equal(se.measureRanking([], 'a.com').averagePosition, null);
  assert.deepEqual(se.measureAutocomplete([], {}, 'us', 'X').concern, []);
});

test('the concern word list sorts the same way every run, whole words only', () => {
  const runs = Array.from({ length: 3 }, () => ['acme lawsuit', 'acme reviews', 'acme careers', 'acme scampi recipe', 'acme vs rival', 'acme solar'].map(t => se.classifySuggestion(t, 'Acme')));
  runs.forEach(r => assert.deepEqual(r, ['concern', 'evaluation', 'engagement', 'other', 'evaluation', 'other']));
  for (const w of ['lawsuit', 'scam', 'complaints', 'layoffs', 'recall', 'fraud', 'greenwashing', 'bankrupt']) assert.equal(se.classifySuggestion(`acme ${w}`, 'Acme'), 'concern', w);
});

test('a namesake never counts against the brand', async () => {
  const { evidence: e } = await fullRun();
  const a = e.byMarket.us.autocomplete;
  assert.deepEqual(a.concern, ['artera lawsuit'], 'the brand’s own concern term counts');
  const namesake = se.measureAutocomplete(['artera scam'], { A: { Aus0: 'other' } }, 'us', 'Artera');
  assert.deepEqual(namesake.concern, []);
  assert.deepEqual(namesake.namesakeConcern, ['artera scam']);
  const block = se.searchPromptBlock({ ...e, byMarket: { us: { ...e.byMarket.us, autocomplete: namesake } } });
  assert.ok(block.includes('not held against the brand'));
  assert.ok(!block.includes('CONCERN TERMS ABOUT THIS BRAND'));
});

test('absence never reads as a problem; a concern term or name clash always does', () => {
  const quiet = {
    status: 'ok', markets: ['us'], gatheredAt: NOW.toISOString(),
    aio: se.measureAio([{ query: 'q', organic: [], aiOverview: { present: true, sources: [{ domain: 'x.com' }] } }], 'a.com'),
    ranking: se.measureRanking([{ query: 'q', organic: [{ position: 1, domain: 'x.com' }] }], 'a.com'),
    byMarket: { us: {
      brandPage: se.measureBrandPage({ organic: [{ position: 1, domain: 'a.com' }], knowledgeGraph: { present: false } }, {}, 'us', 'a.com'),
      autocomplete: se.measureAutocomplete([], {}, 'us', 'A'),
      news: se.measureNews([], {}, 'us'),
    } },
  };
  const block = se.searchPromptBlock(quiet);
  assert.ok(!/CONCERN TERMS ABOUT THIS BRAND|NAME CLASH/.test(block), 'nothing found is never a problem');
  for (const s of ['Not cited is a gap, not a problem', 'Not ranking is a gap', 'counts neither way', 'A gap, scaled by stage; not a problem']) assert.ok(block.includes(s), s);
  assert.ok(block.includes('Never state a different number'));
  const loud = { ...quiet, byMarket: { us: { ...quiet.byMarket.us,
    brandPage: se.measureBrandPage({ organic: [{ position: 1, domain: 'other.io' }], knowledgeGraph: { present: false } }, { P: { Pus0: 'other' } }, 'us', 'a.com'),
    autocomplete: se.measureAutocomplete(['a fraud'], {}, 'us', 'A') } } };
  const lb = se.searchPromptBlock(loud);
  assert.ok(lb.includes('NAME CLASH: an observed problem'));
  assert.ok(lb.includes('CONCERN TERMS ABOUT THIS BRAND: "a fraud"'));
});

// ── Failure, budget, markets ──

test('a failed or unconfigured SerpApi never throws and marks the signal unavailable', async () => {
  const nc = await se.gatherSearchEvidence(INPUT, { mode: 'full', fetchImpl: fakeSerp({ notConfigured: true }), callModel: model() });
  assert.equal(nc.status, 'notConfigured');
  assert.match(se.searchPromptBlock(nc), /UNAVAILABLE.*unknown, not absent/);
  const partial = (await fullRun({ failNews: true })).evidence;
  assert.equal(partial.status, 'ok');
  assert.equal(partial.byMarket.us.news, null, 'news failed alone');
  assert.equal(partial.failures[0].signal, 'news');
  assert.ok(partial.byMarket.us.brandPage, 'the other signals stand');
  const noLabels = await se.gatherSearchEvidence(INPUT, { mode: 'teaser', fetchImpl: fakeSerp(), callModel: async () => { throw new Error('model down'); } });
  assert.equal(noLabels.status, 'ok');
  assert.match(noLabels.labelStatus, /^failed/);
  assert.equal(noLabels.byMarket.us.brandPage.owned, 1, 'the brand’s domain still counts as owned');
});

test('search budget: 24 at most for a US full assessment, 10 for a teaser, 6 more per extra market', async () => {
  const { harvest, evidence } = await fullRun({ aioToken: true });
  assert.ok(harvest.searches + evidence.searches <= 24, `${harvest.searches} + ${evidence.searches}`);
  const g = await fullRun({ aioToken: true }, { ...INPUT, stage: 'global' }, ['gb', 'de', 'fr']);
  assert.deepEqual(g.evidence.markets, ['us', 'gb', 'de'], 'two markets besides the US at most');
  assert.ok(g.harvest.searches + g.evidence.searches <= 24 + 6);
  const log = [];
  const t = await aq.runAudienceQuestions(INPUT, { mode: 'teaser', fetchImpl: fakeSerp({ log }), callModel: model(), keepSerps: true });
  const ts = await se.gatherSearchEvidence(INPUT, { mode: 'teaser', harvest: t, fetchImpl: fakeSerp({ log }), callModel: model() });
  assert.equal(log.length, 10, 'teaser: 8 for questions, brand search and autocomplete');
  assert.equal(ts.aio, null);
  assert.equal(ts.byMarket.us.news, null, 'no news on a teaser');
});

test('markets follow the stage: US only below Multinational', () => {
  assert.deepEqual(aq.marketsFor('scaleup', ['gb']), ['us']);
  assert.deepEqual(aq.marketsFor('leader', ['gb']), ['us']);
  assert.deepEqual(aq.marketsFor('multinational', ['uk', 'xx', 'us', 'de', 'fr']), ['us', 'gb', 'de']);
  assert.deepEqual(aq.marketsFor('global', []), ['us']);
  assert.ok(aq.buildSubtopicPrompt({ ...INPUT, stage: 'conglomerate' }, '', 'full').includes('"markets"'));
  assert.ok(!aq.buildSubtopicPrompt(INPUT, '', 'full').includes('"markets"'));
});

// ── Scoring and clients ──

test('full scoring: gathered once before the first run, read by every pass, never regathered on a rescore', () => {
  const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
  const run = app.slice(app.indexOf('const runScoring = async'), app.indexOf('const prompt = `You are scoring'));
  assert.ok(run.includes('if (!consistencyCheck && !scoringInputs.search) {'), 'only when none is stored');
  assert.ok(run.includes('if (search && !search.unavailable) {'), 'nothing stored when SerpApi is unreachable, so it is tried again');
  assert.ok(run.includes('const search = onEnsureSearch ? await onEnsureSearch() : await gatherSearch();'), 'scoring waits for a gather already running from setup');
  assert.ok(app.includes("${scoringInputs.search?.evidence ? searchPromptBlock(scoringInputs.search.evidence, { reflected:"));
  assert.ok(app.includes("'SEARCH EVIDENCE: not gathered for this assessment. Treat these signals as unknown, not absent.'"));
  // One prompt string feeds every pass.
  assert.ok(app.includes('return callClaude(prompt, apiKey, null, [], 0, true, 12000, meta)'));
  assert.ok(app.includes('assessmentsOverride: scoringInputs'), 'saved with the readouts');
});

test('teasers read brand search and autocomplete; a failure never blocks scoring', async () => {
  const fetchImpl = async (url) => {
    if (String(url).startsWith('/api/scrape')) return { ok: true, json: async () => ({ text: 'Artera patient messaging for health systems, long enough to count.' }) };
    return { ok: false, json: async () => ({ error: 'nope' }) };
  };
  const signals = await se.gatherSearchEvidence(INPUT, { mode: 'teaser', fetchImpl: fakeSerp(), callModel: model() });
  let sawAudience;
  const ev = await teaser.gatherEvidence(INPUT, {
    fetchImpl, callSearch: async () => 'Search evidence text comfortably longer than forty characters.',
    runAudience: async () => ({ status: 'ok', markets: ['us', 'gb'], ideas: [], questions: [] }),
    runSearch: async (a) => { sawAudience = a; return signals; },
  });
  assert.deepEqual(sawAudience.markets, ['us', 'gb'], 'search waits for the audience run and takes its markets');
  assert.ok(teaser.evidenceCoverage(ev).canScore);
  const prompt = teaser.buildTeaserScoringPrompt(INPUT, ev);
  assert.ok(prompt.includes('SEARCH EVIDENCE: BRAND SEARCH PAGE AND AUTOCOMPLETE'));
  assert.ok(prompt.includes('NAME CLASH'));
  const failed = teaser.buildTeaserScoringPrompt(INPUT, { sources: { ...ev.sources, searchSignals: { status: 'failed' } } });
  assert.ok(!failed.includes('SEARCH EVIDENCE: BRAND'), 'a failed signal is left out of the teaser prompt');
  assert.equal(teaser.TEASER_VERSION, '2.8');
});

test('clients never receive raw search evidence', async () => {
  const { evidence } = await fullRun();
  const { ATTRIBUTES } = await import('../src/data/rubric.js');
  const o = { headline: 'h', summary: 's' };
  ATTRIBUTES.forEach(a => { o[a.id] = { score: 50, confidence: 'medium', rationale: 'r' }; });
  const rec = { brand_name: 'Artera', website_url: 'https://artera.ai', evidence: { sources: { searchSignals: evidence } }, result: teaser.finaliseTeaser(teaser.parseTeaserScoring(JSON.stringify(o))) };
  const json = JSON.stringify(teaser.makeTeaserClientPayload(rec));
  for (const leak of ['searchSignals', 'artera.io', 'brandPage', 'Fierce Healthcare']) assert.ok(!json.includes(leak), leak);
  const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
  const payload = app.slice(app.indexOf('function makeClientPayload('), app.indexOf('\nfunction ', app.indexOf('function makeClientPayload(') + 10));
  assert.ok(!payload.includes('search'), 'the client payload builder never reads search evidence');
});

// ── Endpoint ──

test('endpoint: each mode builds the right SerpApi call and trims the response', () => {
  assert.match(serpUrl({ mode: 'aio', token: 'abc' }, 'K'), /engine=google_ai_overview&page_token=abc/);
  assert.match(serpUrl({ mode: 'autocomplete', q: 'Artera' }, 'K'), /engine=google_autocomplete&q=Artera\+&gl=us/);
  const news = serpUrl({ mode: 'news', q: 'Artera', gl: 'gb' }, 'K');
  assert.ok(news.includes('tbm=nws') && news.includes('q=%22Artera%22') && news.includes('gl=gb') && news.includes('num=100') && news.includes('tbs=cdr%3A1'));
  assert.deepEqual(pickAiOverview({ ai_overview: { page_token: 't' } }), { present: true, token: 't', sources: [] });
  assert.deepEqual(pickAiOverview({ ai_overview: { references: [{ link: 'https://www.artera.ai/x', title: 'A', source: 'Artera' }], page_token: 't' } }).sources, [{ domain: 'artera.ai', title: 'A', source: 'Artera' }]);
  assert.equal(pickAiOverview({}).present, false);
  assert.deepEqual(pickOrganic({ organic_results: [{ position: 1, link: 'https://www.artera.ai/', title: 'Artera', sitelinks: { inline: [{}] } }] })[0], { position: 1, domain: 'artera.ai', link: 'https://www.artera.ai/', title: 'Artera', snippet: '', sitelinks: true });
  assert.equal(pickNews({ news_results: [{ title: 'T', source: { name: 'S' }, published_at: '2026-11-01T00:00:00Z' }] })[0].source, 'S');
  const shaped = shapeResponse({ q: 'x' }, { organic_results: [], related_questions: [], api_key: 'K', search_metadata: { id: 1 } });
  assert.deepEqual(Object.keys(shaped).sort(), ['aiOverview', 'knowledgeGraph', 'organic', 'questions']);
});

// ── Attribute mapping and weighting, checked against the rubric (v4.16.1) ──

test('each signal informs the attributes whose rubric signals it actually measures', async () => {
  const { ATTRIBUTES } = await import('../src/data/rubric.js');
  const sig = (id) => ATTRIBUTES.find(a => a.id === id).signals;
  const all = (id) => [...sig(id).strong, ...sig(id).moderate, ...sig(id).weak].join(' | ');
  assert.deepEqual(se.BEARS, {
    aio: ['COGENT', 'AWAKE'], ranking: ['COGENT'], brandPage: ['INTENTIONAL', 'COGENT'], autocomplete: ['AWARE', 'REFLECTIVE'], news: ['AWAKE', 'INTENTIONAL'],
  });
  // The rubric's own words behind each mapping.
  assert.ok(all('COGENT').includes('AI search and GEO optimized'), 'AI Overview: COGENT');
  assert.ok(all('AWAKE').includes('cited by third parties'), 'AI Overview: AWAKE');
  assert.ok(all('COGENT').includes('Ranking for strategic keywords with clear intent alignment'), 'ranking: COGENT');
  assert.ok(all('INTENTIONAL').includes('Third-party credibility signals') && all('INTENTIONAL').includes('trademark'), 'brand page: INTENTIONAL');
  assert.ok(all('AWAKE').includes('Press releases without earned coverage') && all('INTENTIONAL').includes('industry recognition'), 'news: AWAKE and INTENTIONAL');
  assert.match(ATTRIBUTES.find(a => a.id === 'AWARE').question, /build trust/, 'concern terms: AWARE is the trust attribute');
  // ATTENTIVE is experience quality, which no search signal measures.
  assert.ok(!Object.values(se.BEARS).flat().includes('ATTENTIVE'));
  const { evidence } = await fullRun();
  const block = se.searchPromptBlock(evidence);
  assert.ok(!/ATTENTIVE/.test(block), 'never named in the guidance');
  assert.ok(se.searchFactLines(evidence).every(l => l.bears === se.BEARS[l.signal]));
});

test('weighting: a concern term is low on its own; a name clash is moderate and never a trust problem; other terms count neither way', async () => {
  const { evidence } = await fullRun();
  const block = se.searchPromptBlock(evidence);
  assert.ok(block.includes('LOW severity flag') && block.includes('only where the news, reviews or readouts confirm'));
  assert.ok(!block.includes('moderate unless other evidence confirms'), 'the old, backwards rule is gone');
  assert.ok(block.includes('NAME CLASH: an observed problem, moderate') && block.includes('bears on credibility, never trust'));
  assert.ok(block.includes('show search interest only and count neither way'));
  assert.ok(!block.includes('mild support'), 'no credit for search interest');
});

test('each piece of evidence counts once: measured numbers correct the readouts, never add to them', async () => {
  const block = se.searchPromptBlock((await fullRun()).evidence);
  assert.ok(block.includes('COUNT EACH PIECE OF EVIDENCE ONCE'));
  assert.ok(block.includes('earned media readout') && block.includes('search snapshot and knowledge graph'));
  assert.ok(block.includes('do not override them or outweigh them'));
});
