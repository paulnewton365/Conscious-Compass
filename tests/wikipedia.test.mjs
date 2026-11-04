// Wikipedia, verified (v4.19.0, framework 2.17). A brand with a Wikipedia
// page was told to "develop verifiable presence on Wikipedia": the report
// picked recommendations by score alone, nothing checked Wikipedia itself,
// and the AI search service check read only one of two Wikipedia fields.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { checkWikipedia, pickPage, officialSites } from '../api/wikipedia.js';
import * as wk from '../src/lib/wikipediaCheck.js';
import { SERVICE_RECOMMENDATIONS } from '../src/data/rubric.js';
import { getForceIncludeServicesFromAIReputation } from '../src/data/serviceMapping.js';
import * as teaser from '../src/lib/teaser.js';

const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');

// A fake Wikipedia and Wikidata. `pages` maps a title to its data.
function fakeWiki({ pages = {}, search = Object.keys(pages), log = [] } = {}) {
  return async (url, opts) => {
    log.push({ url: String(url), headers: opts?.headers });
    const u = new URL(url);
    const p = Object.fromEntries(u.searchParams);
    const ok = (b) => ({ ok: true, status: 200, json: async () => b });
    if (u.hostname === 'www.wikidata.org') {
      const entities = {};
      p.ids.split('|').forEach(id => {
        const page = Object.values(pages).find(x => x.qid === id);
        entities[id] = { claims: page?.site ? { P856: [{ mainsnak: { datavalue: { value: page.site } } }] } : {} };
      });
      return ok({ entities });
    }
    if (p.list === 'search') return ok({ query: { search: search.map(title => ({ title })) } });
    if (p.prop === 'extlinks') return ok({ query: { pages: [{ title: p.titles, extlinks: Array.from({ length: pages[p.titles]?.links || 0 }, (_, i) => ({ url: `https://x${i}.com` })) }] } });
    const titles = p.titles.split('|');
    return ok({ query: { pages: titles.map(t => pages[t] ? {
      title: t, fullurl: `https://en.wikipedia.org/wiki/${t.replace(/ /g, '_')}`, length: pages[t].length || 3000, extract: pages[t].extract || '',
      pageprops: { ...(pages[t].qid ? { wikibase_item: pages[t].qid } : {}), ...(pages[t].disambig ? { disambiguation: '' } : {}) },
    } : { title: t, missing: true }) } });
  };
}

// ── The check ──

test('a page is confirmed as the brand when Wikidata lists the brand’s own website', async () => {
  const log = [];
  const fetchImpl = fakeWiki({ log, pages: {
    'Artera (company)': { qid: 'Q1', site: 'https://www.artera.io', length: 20000, links: 40 },
    'Artera Inc.': { qid: 'Q2', site: 'https://artera.ai', length: 6000, links: 8, extract: 'Artera is a patient communications company.' },
  } });
  const r = await checkWikipedia({ brand: 'Artera', url: 'https://www.artera.ai', fetchImpl });
  assert.equal(r.found, true);
  assert.equal(r.page.title, 'Artera Inc.', 'the namesake with the bigger page is not chosen');
  assert.equal(r.page.match, 'confirmed');
  assert.equal(r.page.externalLinks, 8);
  assert.deepEqual(r.others.map(o => o.title), ['Artera (company)']);
  assert.ok(log.every(l => /ConsciousCompass/.test(l.headers?.['User-Agent'])), 'identifies itself to Wikimedia');
  assert.ok(!log.some(l => /antennagroup\.com\/?$|@/.test(l.url)), 'no personal details in requests');
});

test('only namesakes, or nothing at all, is no page; a disambiguation page never counts', async () => {
  const namesake = await checkWikipedia({ brand: 'Artera', url: 'artera.ai', fetchImpl: fakeWiki({ pages: { 'Artera (band)': { qid: 'Q9', site: 'https://arteraband.com' }, Artera: { disambig: true, qid: 'Q8' } } }) });
  assert.equal(namesake.found, false);
  assert.deepEqual(namesake.others.map(o => o.title), ['Artera (band)']);
  const none = await checkWikipedia({ brand: 'Tiny Startup', url: 'tinystartup.com', fetchImpl: fakeWiki({ pages: {} }) });
  assert.equal(none.found, false);
});

test('without a Wikidata website, a matching title that names the brand’s domain is likely', () => {
  const { chosen } = pickPage([{ title: 'Acme Solar', extract: 'Acme Solar (acmesolar.com) installs panels.', wikidata: null }], {}, 'Acme Solar', 'acmesolar.com');
  assert.equal(chosen.match, 'likely');
  assert.equal(pickPage([{ title: 'Acme Solar', extract: 'A company.', wikidata: null }], {}, 'Acme Solar', 'acmesolar.com').chosen, null, 'a title alone is not enough');
  assert.deepEqual(officialSites({ entities: { Q1: { claims: { P856: [{ mainsnak: { datavalue: { value: 'https://a.com' } } }] } } } }), { Q1: ['https://a.com'] });
});

test('endpoint: signed-in callers only, and both brand and website are required', async () => {
  const { default: handler } = await import('../api/wikipedia.js');
  process.env.SUPABASE_URL = 'https://sb.test';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service';
  const res = () => { const r = { code: 200, body: null }; r.status = (c) => { r.code = c; return r; }; r.json = (b) => { r.body = b; return r; }; r.end = () => r; r.setHeader = () => r; return r; };
  const auth = async (url) => (String(url).includes('/auth/v1/user') ? { ok: true, json: async () => ({ id: 'u1' }) } : { ok: false, json: async () => ({}) });
  const missing = res();
  await handler({ method: 'GET', headers: { authorization: 'Bearer t' }, query: { brand: 'Artera' } }, missing, { fetchImpl: auth });
  assert.equal(missing.code, 400);
});

// ── What it means ──

test('substantive, thin or none, from the check; from the fields when there is no check', () => {
  const page = (externalLinks, length) => ({ status: 'ok', found: true, page: { externalLinks, length } });
  assert.equal(wk.wikipediaState(page(40, 3000)), 'substantive');
  assert.equal(wk.wikipediaState(page(2, 12000)), 'substantive');
  assert.equal(wk.wikipediaState(page(5, 4000)), 'thin');
  assert.equal(wk.wikipediaState({ status: 'ok', found: false }), 'none');
  // No check: read both steps' fields, not one.
  assert.equal(wk.wikipediaState(null, { aiReputation: { wikipediaContent: 'https://en.wikipedia.org/wiki/Artera' } }), 'exists');
  assert.equal(wk.wikipediaState(null, { social: { wikipediaContent: '[Knowledge Graph] Wikipedia: https://en.wikipedia.org/wiki/X' } }), 'exists');
  assert.equal(wk.wikipediaState(null, { social: { wikipediaContent: 'No Wikipedia page found.' } }), 'none');
  assert.equal(wk.wikipediaState(null, {}), 'unknown');
  assert.equal(wk.wikipediaState({ status: 'failed' }, { aiReputation: { wikipediaContent: 'https://en.wikipedia.org/wiki/A' } }), 'exists', 'a failed check falls back to the fields');
});

test('a brand with a page is never told to develop one', () => {
  const rec = SERVICE_RECOMMENDATIONS.INTENTIONAL.find(r => r.title === wk.WIKIPEDIA_SERVICE);
  assert.ok(rec, 'the service sits under Intentional');
  assert.ok(!SERVICE_RECOMMENDATIONS.REFLECTIVE.some(r => r.title === wk.WIKIPEDIA_SERVICE), 'and no longer under Reflective');
  assert.equal(wk.gateRecommendation(rec, { wikipedia: 'substantive' }), null, 'left out');
  for (const state of ['thin', 'exists']) {
    const g = wk.gateRecommendation(rec, { wikipedia: state });
    assert.equal(g.title, 'Wikipedia & Knowledge Panel Strengthening');
    assert.ok(!/Develop verifiable presence/.test(g.description) && /existing Wikipedia page/.test(g.description));
  }
  assert.ok(/Confirm whether the brand has a Wikipedia page/.test(wk.gateRecommendation(rec, { wikipedia: 'unknown' }).description));
  assert.equal(wk.gateRecommendation(rec, { wikipedia: 'none' }), rec, 'no page: the original is right');
  const other = SERVICE_RECOMMENDATIONS.AWAKE[0];
  assert.equal(wk.gateRecommendation(other, { wikipedia: 'substantive' }), other, 'other services pass through');
  // Both places the report builds recommendations apply the gate.
  assert.equal(app.split('const rec = gateRecommendation(attrRecs[recIndex], { wikipedia: WIKI_STATE });').length - 1, 2);
});

test('the AI search service check reads Wikipedia from either step, or the verified check', () => {
  const base = { aiReputation: { content: 'x', wikipediaContent: 'https://en.wikipedia.org/wiki/Artera' }, social: { redditAnswersContent: 'Plenty of discussion of the brand on Reddit.', wikipediaContent: '' } };
  assert.ok(!getForceIncludeServicesFromAIReputation('', base).includes('geoStrategy'), 'a page recorded on the AI reputation step is not missing');
  assert.ok(getForceIncludeServicesFromAIReputation('', { ...base, aiReputation: { content: 'x' }, wikipediaCheck: { status: 'ok', found: false } }).includes('geoStrategy'));
  assert.ok(!getForceIncludeServicesFromAIReputation('', { ...base, aiReputation: { content: 'x' }, wikipediaCheck: { status: 'ok', found: true, page: { externalLinks: 30 } } }).includes('geoStrategy'));
});

// ── Where it is read ──

test('scoring and the steps read the verified result, which takes precedence', () => {
  const found = { status: 'ok', found: true, checkedAt: '2026-11-04T15:00:00Z', page: { title: 'Artera Inc.', url: 'https://en.wikipedia.org/wiki/Artera_Inc.', length: 6000, externalLinks: 8, match: 'confirmed' } };
  const line = wk.wikipediaPromptLine(found);
  assert.ok(line.includes('takes precedence') && line.includes('never describe the brand as absent from Wikipedia') && line.includes('INTENTIONAL'));
  assert.ok(wk.wikipediaPromptLine({ status: 'ok', found: false, checkedAt: '2026-11-04T15:00:00Z', others: [] }).includes('not a problem'));
  assert.ok(wk.isVerifiedText(wk.wikipediaFieldText(found)));
  assert.ok(app.includes("${scoringInputs.wikipediaCheck?.status === 'ok' ? `\\n${wikipediaPromptLine(scoringInputs.wikipediaCheck)}\\n` : ''}"));
  assert.ok(app.includes("${wikipediaCheck?.status === 'ok' ? `${wikipediaPromptLine(wikipediaCheck)}\\n` : ''}"), 'social step');
  assert.ok(app.includes('if (verifiedWiki && (replaceable(wikipediaContent) || isVerifiedText(wikipediaContent)) && wikipediaContent !== verifiedWiki) {'), 'AI reputation field, never over an assessor’s own text');
  assert.ok(app.includes('hasWikipedia: [\'substantive\', \'thin\', \'exists\'].includes(wikipediaState('));
});

test('teasers read the verified result too', () => {
  const prompt = teaser.buildTeaserScoringPrompt({ brandName: 'Artera', websiteUrl: 'https://artera.ai', businessModel: 'b2b' }, { sources: { wikipedia: { status: 'ok', found: true, checkedAt: '2026-11-04T15:00:00Z', page: { title: 'Artera Inc.', url: 'u', length: 20000, externalLinks: 30, match: 'confirmed' } } } });
  assert.ok(prompt.includes('WIKIPEDIA (verified against Wikipedia and Wikidata'));
  assert.ok(app.includes('      checkWikipedia: true,'));
  assert.equal(teaser.TEASER_VERSION, '2.8');
});

test('the social step saves its Knowledge Graph and YouTube results', () => {
  assert.ok(!app.includes('setAssessmentData(prev => ({ ...prev, youtubeAuto'), 'an updater the setter cannot store');
  assert.ok(app.includes('setAssessmentData({ youtubeAuto: ytStats });'));
  assert.ok(!app.includes("setAssessmentData(prev => ({ ...prev, wikipediaContent: prev.wikipediaContent?.includes('[Knowledge Graph]')"));
});
