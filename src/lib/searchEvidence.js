// ─────────────────────────────────────────────────────────────
// SEARCH EVIDENCE (v4.16.0, framework 2.14)
//
// Five measured Google signals, gathered once through SerpApi, stored with
// the assessment and read by every scoring pass:
//
//   1. AI Overview citations  does Google's AI answer cite the brand on its
//                             niche questions (from the audience harvest)
//   2. Brand search page      how much of page one the brand owns, the
//                             knowledge panel, and name clashes
//   3. Autocomplete           what Google suggests after the brand name
//   4. Google News            coverage in the last 90 days
//   5. Niche ranking          does the brand rank on its niche searches
//                             (from the audience harvest, no extra searches)
//
// Teasers get 2 and 3 only.
//
// Integrity rules this module enforces:
// - Code measures, the model judges. Every count here is computed in code.
//   Where a label needs judgment (owned or a namesake, outlet tier, angle),
//   one model call labels and code counts the labels.
// - The brand's own domain is always owned, whatever the label says.
// - Missing is not a problem. No Overview, no news, no ranking are gaps.
//   A name clash is an observed problem for findability and brand
//   protection, never for trust. A concern term about this brand is a low
//   flag on its own, raised only when other evidence confirms it.
// - Each piece of evidence counts once: where a signal overlaps a readout,
//   the number corrects the readout rather than adding to it.
// - A namesake's results, suggestions and articles never count against the
//   brand.
// - A failed signal is marked unavailable and scoring carries on.
// - Nothing here reaches a client directly. Findings reach clients only
//   through the score rationales and trust lens the model writes.
// ─────────────────────────────────────────────────────────────

import { serpCall, NotConfiguredError, marketsFor } from './audienceQuestions.js';

export const SEARCH_VERSION = '1.0';

// Searches per run, for the budget and the tests.
export const AIO_FOLLOWUPS_MAX = 5;
export const searchesPerMarket = (mode) => (mode === 'teaser' ? 2 : 3);

// ── Autocomplete word lists (approved November 3, 2026) ───────
// In code, not the prompt, so the sort is the same every run.
export const AUTOCOMPLETE_GROUPS = {
  concern: ['lawsuit', 'lawsuits', 'scam', 'scams', 'complaint', 'complaints', 'layoff', 'layoffs', 'recall', 'recalls', 'fraud', 'greenwashing', 'bankrupt', 'bankruptcy'],
  evaluation: ['review', 'reviews', 'vs', 'versus', 'alternative', 'alternatives', 'pricing', 'price', 'prices', 'cost', 'worth it', 'legit', 'comparison'],
  engagement: ['careers', 'career', 'jobs', 'job', 'login', 'log in', 'app', 'stock', 'investor', 'investors', 'investor relations', 'customer service', 'contact', 'phone number'],
};

const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();

// The group for one suggestion: the words after the brand name are matched
// against the lists, whole words or phrases only.
export function classifySuggestion(text, brand) {
  const t = ` ${norm(text)} `;
  const rest = ` ${norm(String(text || '').replace(new RegExp(String(brand || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'), ''))} `;
  const hay = rest.trim() ? rest : t;
  for (const group of ['concern', 'evaluation', 'engagement']) {
    if (AUTOCOMPLETE_GROUPS[group].some(w => hay.includes(` ${w} `))) return group;
  }
  return 'other';
}

// ── Domains ───────────────────────────────────────────────────

export const domainOf = (url) => {
  try { return new URL(/^https?:/i.test(url) ? url : `https://${url}`).hostname.replace(/^www\./, '').toLowerCase(); } catch { return ''; }
};
// The same site, allowing subdomains either way: shop.acme.com is acme.com.
export const sameSite = (a, b) => !!a && !!b && (a === b || a.endsWith(`.${b}`) || b.endsWith(`.${a}`));

// ── Signals 1 and 5: from the audience harvest ────────────────

export function measureAio(serps, brandDomain) {
  const searched = (serps || []).length;
  const shown = (serps || []).filter(s => s.aiOverview?.present);
  const withSources = shown.filter(s => s.aiOverview.sources?.length);
  const citing = withSources.filter(s => s.aiOverview.sources.some(src => sameSite(src.domain, brandDomain)));
  const counts = {};
  withSources.forEach(s => {
    new Set(s.aiOverview.sources.map(src => src.domain).filter(d => !sameSite(d, brandDomain))).forEach(d => { counts[d] = (counts[d] || 0) + 1; });
  });
  const topCited = Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 3).map(([domain, n]) => ({ domain, overviews: n }));
  return {
    searched,
    shown: shown.length,
    readable: withSources.length,
    citingBrand: citing.length,
    citedOn: citing.map(s => s.query),
    topCited,
  };
}

export function measureRanking(serps, brandDomain) {
  const rows = (serps || []).map(s => {
    const hit = (s.organic || []).find(o => sameSite(o.domain, brandDomain));
    return { query: s.query, position: hit ? hit.position : null, top3: (s.organic || []).slice(0, 3).map(o => o.domain) };
  });
  const ranked = rows.filter(r => r.position);
  const counts = {};
  rows.forEach(r => new Set(r.top3.filter(d => !sameSite(d, brandDomain))).forEach(d => { counts[d] = (counts[d] || 0) + 1; }));
  return {
    searched: rows.length,
    onPageOne: ranked.length,
    averagePosition: ranked.length ? Math.round((ranked.reduce((t, r) => t + r.position, 0) / ranked.length) * 10) / 10 : null,
    rows,
    topRankers: Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 3).map(([domain, n]) => ({ domain, searches: n })),
  };
}

// AI Overviews Google loads lazily come back as a token; fetch up to five.
async function fillAiOverviews(serps, fetchImpl) {
  let searches = 0;
  const pending = (serps || []).filter(s => s.aiOverview?.present && !s.aiOverview.sources?.length && s.aiOverview.token).slice(0, AIO_FOLLOWUPS_MAX);
  await Promise.allSettled(pending.map(async s => {
    searches += 1;
    const body = await serpCall({ mode: 'aio', token: s.aiOverview.token }, fetchImpl);
    if (body.aiOverview?.sources?.length) s.aiOverview = { ...body.aiOverview, present: true, token: null };
  }));
  // Tokens are short-lived and never worth storing.
  (serps || []).forEach(s => { if (s.aiOverview) s.aiOverview = { ...s.aiOverview, token: null }; });
  return searches;
}

// ── Signals 2, 3 and 4: the brand searches ────────────────────

async function brandSearches(input, markets, mode, fetchImpl) {
  const brand = String(input.brandName || '').trim();
  const out = {};
  let searches = 0;
  const failures = [];
  await Promise.all(markets.map(async gl => {
    const one = async (key, params) => {
      searches += 1;
      try { return await serpCall({ ...params, gl }, fetchImpl); } catch (e) {
        if (e?.notConfigured) throw e;
        failures.push({ market: gl, signal: key, error: String(e?.message || e) });
        return null;
      }
    };
    const [page, auto, news] = await Promise.all([
      one('brandPage', { q: brand }),
      one('autocomplete', { mode: 'autocomplete', q: brand }),
      mode === 'teaser' ? Promise.resolve(null) : one('news', { mode: 'news', q: brand }),
    ]);
    out[gl] = {
      brandPage: page ? { organic: page.organic || [], knowledgeGraph: page.knowledgeGraph || { present: false } } : null,
      autocomplete: auto ? auto.suggestions || [] : null,
      news: news ? news.news || [] : null,
    };
  }));
  return { raw: out, searches, failures };
}

// ── Labels: one model call, code counts ───────────────────────

export function buildLabelPrompt(input, raw) {
  const lines = [];
  Object.entries(raw).forEach(([gl, r]) => {
    if (r.brandPage) {
      lines.push(`PAGE ONE FOR "${input.brandName}" (${gl.toUpperCase()}):`);
      r.brandPage.organic.forEach((o, i) => lines.push(`P${gl}${i} | ${o.domain} | ${o.title} | ${o.snippet}`));
      if (r.brandPage.knowledgeGraph?.present) lines.push(`KG${gl} | ${r.brandPage.knowledgeGraph.title} | ${r.brandPage.knowledgeGraph.type} | ${r.brandPage.knowledgeGraph.description} | ${r.brandPage.knowledgeGraph.website}`);
    }
    if (r.autocomplete?.length) {
      lines.push(`AUTOCOMPLETE (${gl.toUpperCase()}):`);
      r.autocomplete.forEach((a, i) => lines.push(`A${gl}${i} | ${a}`));
    }
    if (r.news?.length) {
      lines.push(`NEWS (${gl.toUpperCase()}):`);
      r.news.slice(0, 60).forEach((n, i) => lines.push(`N${gl}${i} | ${n.source} | ${n.title}`));
    }
  });
  return `The brand is ${input.brandName} (${input.websiteUrl})${input.industryName ? `, in ${input.industryName}` : ''}. Label the Google results below. Do not count or score anything: code does that.

For each P item, label who the result is about:
- "owned": the brand's own site or its official social accounts
- "earned": a third party writing about THIS brand (news, reviews, Wikipedia, directories, industry sites)
- "other": a different company, product, person or thing with the same or a similar name, or nothing to do with the brand
For each KG item: "brand" if the knowledge panel describes this brand, "other" if it describes something else.
For each A item: "brand" if the suggestion is about this brand, "other" if it is about a namesake.
For each N item: "about" true only if the article is about this brand. If it is, "tier": national, business, trade, local or syndicated, and "angle": announcement (the brand's own news: launch, funding, hire, partnership, results), feature, opinion or mention.

${lines.join('\n')}

Return valid JSON only, no prose, no fences. Use the ids exactly:
{ "P": { "Pus0": "owned" }, "KG": { "KGus": "brand" }, "A": { "Aus0": "brand" }, "N": { "Nus0": { "about": true, "tier": "trade", "angle": "announcement" } } }`;
}

export function parseLabels(raw) {
  const text = String(raw || '').replace(/```json|```/g, '');
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) throw new Error('The labelling pass returned no JSON.');
  const p = JSON.parse(m[0]);
  return { P: p.P || {}, KG: p.KG || {}, A: p.A || {}, N: p.N || {} };
}

const TIERS = ['national', 'business', 'trade', 'local', 'syndicated'];
const ANGLES = ['announcement', 'feature', 'opinion', 'mention'];

// ── Measures ──────────────────────────────────────────────────

export function measureBrandPage(page, labels, gl, brandDomain) {
  if (!page) return null;
  const organic = page.organic.map((o, i) => {
    const label = sameSite(o.domain, brandDomain) ? 'owned' : (['owned', 'earned', 'other'].includes(labels.P?.[`P${gl}${i}`]) ? labels.P[`P${gl}${i}`] : 'unlabelled');
    return { position: o.position, domain: o.domain, title: o.title, label, sitelinks: o.sitelinks };
  });
  const count = (l) => organic.filter(o => o.label === l).length;
  const top = organic[0] || null;
  const kg = page.knowledgeGraph || { present: false };
  const otherEntity = count('other');
  return {
    results: organic.length,
    owned: count('owned'),
    earned: count('earned'),
    otherEntity,
    topIsBrand: !!top && top.label === 'owned',
    sitelinks: !!top && top.label === 'owned' && !!top.sitelinks,
    knowledgePanel: kg.present ? (labels.KG?.[`KG${gl}`] === 'other' ? 'other' : 'brand') : 'none',
    // A clash: a namesake takes the top result, or two or more of page one,
    // or the knowledge panel describes someone else.
    nameClash: (!!top && top.label === 'other') || otherEntity >= 2 || (kg.present && labels.KG?.[`KG${gl}`] === 'other'),
    organic,
  };
}

export function measureAutocomplete(list, labels, gl, brand) {
  if (!list) return null;
  const suggestions = list.map((value, i) => ({
    value,
    group: classifySuggestion(value, brand),
    aboutBrand: labels.A?.[`A${gl}${i}`] !== 'other',
  }));
  return {
    suggestions,
    // Only a concern term about this brand is an observed problem.
    concern: suggestions.filter(s => s.group === 'concern' && s.aboutBrand).map(s => s.value),
    namesakeConcern: suggestions.filter(s => s.group === 'concern' && !s.aboutBrand).map(s => s.value),
    evaluation: suggestions.filter(s => s.group === 'evaluation' && s.aboutBrand).length,
    engagement: suggestions.filter(s => s.group === 'engagement' && s.aboutBrand).length,
  };
}

const dayMs = 86400000;
const normTitle = (t) => norm(t).split(' ').slice(0, 12).join(' ');

export function measureNews(list, labels, gl, now = new Date()) {
  if (!list) return null;
  const labelled = list.map((n, i) => ({ ...n, l: labels.N?.[`N${gl}${i}`] }));
  // Unlabelled articles (beyond the first 60, or a failed labelling pass)
  // count as about the brand only when the labelling pass did not run at all.
  const anyLabels = labelled.some(n => n.l);
  const recent = labelled
    .map(n => ({ ...n, t: Date.parse(n.publishedAt) }))
    .filter(n => Number.isFinite(n.t) && n.t <= now.getTime() && now.getTime() - n.t <= 90 * dayMs)
    .filter(n => (anyLabels ? n.l?.about === true : true));
  // Wire pickups: the same headline on several sites counts once.
  const seen = new Set();
  const items = recent.sort((a, b) => b.t - a.t).filter(n => { const k = normTitle(n.title); if (seen.has(k)) return false; seen.add(k); return true; });
  const byMonth = [0, 0, 0];
  items.forEach(n => { const m = Math.min(2, Math.floor((now.getTime() - n.t) / (30 * dayMs))); byMonth[m] += 1; });
  const outlets = {};
  items.forEach(n => { if (n.source) outlets[n.source] = (outlets[n.source] || 0) + 1; });
  const clustered = items.filter(n => items.some(o => o !== n && Math.abs(o.t - n.t) <= 3 * dayMs)).length;
  const tally = (key, allowed) => {
    const out = {};
    items.forEach(n => { const v = n.l?.[key]; if (allowed.includes(v)) out[v] = (out[v] || 0) + 1; });
    return out;
  };
  return {
    articles: items.length,
    // Most recent month first.
    byMonth,
    outlets: Object.keys(outlets).length,
    topOutlets: Object.entries(outlets).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 5).map(([name, n]) => ({ name, articles: n })),
    clusteredShare: items.length ? Math.round((clustered / items.length) * 100) : null,
    tiers: tally('tier', TIERS),
    angles: tally('angle', ANGLES),
    excludedNamesake: anyLabels ? labelled.filter(n => n.l && n.l.about === false).length : 0,
    items: items.slice(0, 25).map(n => ({ title: n.title, source: n.source, publishedAt: n.publishedAt, tier: n.l?.tier || null, angle: n.l?.angle || null })),
  };
}

// ── The run ───────────────────────────────────────────────────

// input: brandName, websiteUrl, industryName, stage.
// harvest: the audience harvest with its serps and markets, or null.
// Never throws: every signal carries its own status.
export async function gatherSearchEvidence(input, { mode = 'full', harvest = null, fetchImpl, callModel }) {
  const started = Date.now();
  const brandDomain = domainOf(input.websiteUrl);
  const markets = marketsFor(input.stage, harvest?.markets?.filter(m => m !== 'us') || []);
  const base = { version: SEARCH_VERSION, mode, gatheredAt: new Date().toISOString(), brandDomain, markets };
  try {
    const ping = await fetchImpl('/api/audience-questions?ping=1');
    const pb = await ping.json().catch(() => ({}));
    if (pb.notConfigured) throw new NotConfiguredError();
    if (!ping.ok) throw new Error(pb.error || `Google search is unavailable (HTTP ${ping.status}).`);

    let searches = 0;
    const failures = [];
    let aio = null;
    let ranking = null;
    if (mode !== 'teaser') {
      const serps = (harvest?.serps || []).map(s => ({ ...s, aiOverview: { ...(s.aiOverview || {}) } }));
      if (serps.length) {
        searches += await fillAiOverviews(serps, fetchImpl).catch(() => 0);
        aio = measureAio(serps, brandDomain);
        ranking = measureRanking(serps, brandDomain);
      }
    }
    const b = await brandSearches(input, markets, mode, fetchImpl);
    searches += b.searches;
    failures.push(...b.failures);

    let labels = { P: {}, KG: {}, A: {}, N: {} };
    let labelStatus = 'ok';
    try { labels = parseLabels(await callModel(buildLabelPrompt(input, b.raw))); } catch (e) { labelStatus = `failed: ${String(e?.message || e)}`; }

    const byMarket = {};
    markets.forEach(gl => {
      const r = b.raw[gl] || {};
      byMarket[gl] = {
        brandPage: measureBrandPage(r.brandPage, labels, gl, brandDomain),
        autocomplete: measureAutocomplete(r.autocomplete, labels, gl, input.brandName),
        news: mode === 'teaser' ? null : measureNews(r.news, labels, gl),
      };
    });
    return {
      ...base,
      status: 'ok',
      aio: mode === 'teaser' ? null : aio,
      ranking: mode === 'teaser' ? null : ranking,
      byMarket,
      labelStatus,
      searches,
      failures,
      ms: Date.now() - started,
    };
  } catch (err) {
    return { ...base, status: err?.notConfigured ? 'notConfigured' : 'failed', error: String(err?.message || err), byMarket: {}, searches: 0, failures: [], ms: Date.now() - started };
  }
}

// ── The scoring block ─────────────────────────────────────────

export const MARKET_NAME = { us: 'United States', gb: 'United Kingdom', ca: 'Canada', au: 'Australia', de: 'Germany', fr: 'France', jp: 'Japan', in: 'India' };
export const marketName = (gl) => MARKET_NAME[gl] || gl.toUpperCase();
const listOf = (a) => (a.length < 2 ? a.join('') : `${a.slice(0, -1).join(', ')} and ${a[a.length - 1]}`);

// Which attributes each signal informs (v4.16.1), from the rubric:
//   AI Overview  COGENT "AI search and GEO optimized"; AWAKE "cited by third parties"
//   Ranking      COGENT "ranking for strategic keywords with clear intent"
//   Brand page   INTENTIONAL "third-party credibility signals", "trademark
//                protection"; COGENT findability
//   Autocomplete concern terms only: AWARE "build trust"; REFLECTIVE claims
//                against reality. Other terms count neither way.
//   News         AWAKE "media seeking them out", "press releases without
//                earned coverage"; INTENTIONAL "industry recognition"
export const BEARS = {
  aio: ['COGENT', 'AWAKE'],
  ranking: ['COGENT'],
  brandPage: ['INTENTIONAL', 'COGENT'],
  autocomplete: ['AWARE', 'REFLECTIVE'],
  news: ['AWAKE', 'INTENTIONAL'],
};

// The facts, one per signal, each with the guidance the scoring model reads.
// People see the fact; the model reads both. Empty when there is nothing
// usable, so the prompt says so rather than implying absence.
export function searchFactLines(rec) {
  if (!rec || rec.status !== 'ok') return [];
  const lines = [];
  // `bears` is the attributes each signal informs, checked against the
  // rubric's own signal lists (v4.16.1); the guide names them for the model.
  const add = (signal, fact, guide) => lines.push({ signal, fact, guide, bears: BEARS[signal] });
  if (rec.aio) {
    const a = rec.aio;
    if (!a.shown) add('aio', `AI Overviews: none appeared on ${a.searched} niche searches.`, 'Unknown, not a gap.');
    else add('aio', `AI Overviews: shown on ${a.shown} of ${a.searched} niche searches; the brand is cited in ${a.citingBrand} of the ${a.readable} that could be read.${a.topCited.length ? ` Most cited instead: ${a.topCited.map(t => `${t.domain} (${t.overviews})`).join(', ')}.` : ''}`,
      'Bears on COGENT (AI search and GEO) and AWAKE (cited by third parties as the authority); the sites cited instead show who leads the conversation, context for AWAKE. Not cited is a gap, not a problem.');
  }
  if (rec.ranking) {
    const r = rec.ranking;
    add('ranking', `Niche ranking: the brand is on page one for ${r.onPageOne} of ${r.searched} niche searches${r.averagePosition ? `, average position ${r.averagePosition}` : ''}.${r.topRankers.length ? ` Ranking most instead: ${r.topRankers.map(t => `${t.domain} (${t.searches})`).join(', ')}.` : ''}`,
      'Bears on COGENT (ranking for strategic searches with clear intent). Not ranking is a gap; read it against stage and sector.');
  }
  Object.entries(rec.byMarket || {}).forEach(([gl, m]) => {
    const where = Object.keys(rec.byMarket).length > 1 ? ` (${marketName(gl)})` : '';
    if (m.brandPage) {
      const p = m.brandPage;
      add('brandPage', `Brand search page${where}: of ${p.results} page one results, ${p.owned} owned, ${p.earned} earned, ${p.otherEntity} about a different entity. Top result is ${p.topIsBrand ? 'the brand' : 'not the brand'}${p.sitelinks ? ', with sitelinks' : ''}. Knowledge panel: ${p.knowledgePanel === 'none' ? 'none' : p.knowledgePanel === 'brand' ? 'describes the brand' : 'describes a different entity'}.${p.nameClash ? ' Name clash: results about a different entity crowd the brand\u2019s own.' : ''}`,
        `${p.nameClash ? 'NAME CLASH: an observed problem, moderate, for INTENTIONAL (brand protection) and COGENT (findability). It is not evidence of misconduct: in the four lenses it bears on credibility, never trust. ' : ''}Bears on INTENTIONAL (third-party credibility, professional presence) and COGENT (findability). No panel or sitelinks is a gap, scaled by stage.`);
    }
    if (m.autocomplete) {
      const a = m.autocomplete;
      if (!a.suggestions.length) add('autocomplete', `Autocomplete${where}: no suggestions after the brand name.`, 'Common for smaller brands; counts neither way.');
      else add('autocomplete', `Autocomplete${where}: ${a.suggestions.map(x => `"${x.value}"`).join(', ')}.${a.concern.length ? ` Concern terms about this brand: ${a.concern.map(c => `"${c}"`).join(', ')}.` : ' No concern terms about this brand.'}${a.namesakeConcern.length ? ` Concern terms about a namesake: ${a.namesakeConcern.map(c => `"${c}"`).join(', ')}.` : ''}`,
        `${a.concern.length ? `CONCERN TERMS ABOUT THIS BRAND: ${a.concern.map(c => `"${c}"`).join(', ')}. Autocomplete shows what people search for, not what is true. On its own each term is a LOW severity flag for AWARE (trust) and REFLECTIVE (claims against reality). Raise it to moderate or high only where the news, reviews or readouts confirm the issue, and name that evidence. ` : ''}${a.namesakeConcern.length ? 'Terms about a namesake are not held against the brand. ' : ''}Other suggestions (reviews, pricing, careers and similar) show search interest only and count neither way.`);
    }
    if (m.news) {
      const n = m.news;
      if (!n.articles) add('news', `Google News${where}: no articles about the brand in the last 90 days.`, 'A gap, scaled by stage; not a problem.');
      else add('news', `Google News${where}: ${n.articles} articles about the brand in the last 90 days (by month, most recent first: ${n.byMonth.join(', ')}) from ${n.outlets} outlets. Top outlets: ${n.topOutlets.map(o => `${o.name} (${o.articles})`).join(', ')}. ${n.clusteredShare}% fall within three days of another article.${Object.keys(n.tiers).length ? ` Tiers: ${Object.entries(n.tiers).map(([k, v]) => `${k} ${v}`).join(', ')}.` : ''}${Object.keys(n.angles).length ? ` Angles: ${Object.entries(n.angles).map(([k, v]) => `${k} ${v}`).join(', ')}.` : ''}`,
        'Bears on AWAKE (media coverage earned, not announced) and INTENTIONAL (industry recognition, third-party credibility). Hostile coverage named in the headlines is an observed problem for REFLECTIVE and AWARE.');
    }
  });
  return lines;
}

export function searchPromptBlock(rec, { label = 'SEARCH EVIDENCE' } = {}) {
  if (!rec) return '';
  if (rec.status !== 'ok') return `${label}: UNAVAILABLE in this assessment. Treat these signals as unknown, not absent.`;
  const lines = searchFactLines(rec);
  if (!lines.length) return '';
  const date = rec.gatheredAt ? new Date(rec.gatheredAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : '';
  return `${label} (measured from Google through SerpApi${date ? `, ${date}` : ''}; ${listOf(rec.markets.map(marketName))}):
These numbers were counted in code. Never state a different number. They sharpen the readouts above; they do not override them or outweigh them.
COUNT EACH PIECE OF EVIDENCE ONCE. Google News covers the same ground as the earned media readout, and the brand search page the same ground as the AI reputation search snapshot and knowledge graph. Where they overlap, use the measured number to correct the readout, then judge the coverage once. Never credit or penalize the same coverage twice.
A signal not listed was not available and is unknown.
${lines.map(l => `- ${l.fact} ${l.guide}`).join('\n')}`;
}
