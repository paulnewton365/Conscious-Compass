// Vercel Cron — runs every Sunday at 23:30 UTC
// Reads stay_conscious_cache, landscape_analysis_cache, insights_analysis_cache,
// picks a lead story, composes the newsletter object, writes to stay_conscious_newsletter.
// Schedule in vercel.json: "30 23 * * 0"
// Also accepts POST for admin force refresh.

import { requireUser } from './_auth.js';
import { glossaryForPrompt, titleCaseAttributes } from '../src/data/attributeGlossary.js';
import { ATTRIBUTES } from '../src/data/rubric.js';
import { headlineOverlap, houseImageFor, houseImageForDraft, withoutDashes, noDashes, newsletterDocument, newsletterDocxName, nextIssueAt } from '../src/lib/newsletter.js';
// Each brand's latest save only (v3.109.0): every save is kept as a row for
// history, but a brand must count once in portfolio figures.
const latestPerBrand = (rows) => {
  const m = new Map();
  (rows || []).forEach(r => {
    const k = String(r.brand_name || '').trim().toLowerCase();
    if (!k) return;
    const cur = m.get(k);
    if (!cur || String(r.created_at || '') > String(cur.created_at || '')) m.set(k, r);
  });
  return [...m.values()];
};

// ── Prospect pulse and Spotlight (v4.6.0) ─────────────────────
// Prospect pulse: the teasers run so far this month, in figures only. No
// brand is named and nothing here feeds the benchmarks, which still count
// full assessments only. Spotlight: the attribute brands are weakest on,
// and one thing a brand can do about it, written from the rubric.
const SECTOR_NAMES = {
  technology: 'Technology & Software', healthcare: 'Healthcare & Life Sciences', finance: 'Financial Services',
  energy: 'Energy & Utilities', manufacturing: 'Manufacturing & Industrial', retail: 'Retail & Consumer Goods',
  food: 'Food & Beverage', media: 'Media & Entertainment', telecom: 'Telecommunications', professional: 'Professional Services',
  realestate: 'Real Estate & Construction', mobility: 'Mobility & Automotive', transportation: 'Transportation & Logistics',
  hospitality: 'Hospitality & Travel', education: 'Education', nonprofit: 'Nonprofit & Government',
};
export const PULSE_MIN = 3;   // fewer teasers than this and the averages would mislead
const scoreOf = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : (v && Number.isFinite(Number(v.score)) ? Number(v.score) : null));
const mean = (xs) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null);
export const monthStart = (now = new Date()) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
const monthName = (now = new Date()) => now.toLocaleDateString('en-US', { month: 'long', timeZone: 'UTC' });
// Per-attribute averages over a set of score maps.
export function attributeAverages(scoreMaps = []) {
  const out = {};
  ATTRIBUTES.forEach(a => {
    const xs = scoreMaps.map(m => scoreOf(m?.[a.id])).filter(x => x !== null);
    out[a.id] = { avg: mean(xs), n: xs.length, belowFifty: xs.filter(x => x < 50).length };
  });
  return out;
}

export function prospectPulse(teasers = [], fullRows = [], now = new Date()) {
  const scored = teasers.filter(t => Number.isFinite(Number(t?.result?.overall)) && t?.result?.scores);
  if (scored.length < PULSE_MIN) return null;
  const tAvg = attributeAverages(scored.map(t => t.result.scores));
  const fAvg = attributeAverages(fullRows.map(r => r.scores));
  const ranked = ATTRIBUTES.filter(a => tAvg[a.id].avg !== null).sort((x, y) => tAvg[x.id].avg - tAvg[y.id].avg);
  const sectors = Object.entries(scored.reduce((m, t) => { const k = t.industry || 'other'; m[k] = (m[k] || 0) + 1; return m; }, {}))
    .filter(([k]) => k !== 'other').sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0])).slice(0, 3)
    .map(([k, n]) => ({ name: SECTOR_NAMES[k] || k, count: n }));
  const fullTotals = fullRows.map(r => Number(r.total_score)).filter(Number.isFinite);
  const pick = (a) => (a ? { id: a.id, name: a.name, avg: tAvg[a.id].avg, fullAvg: fAvg[a.id].avg } : null);
  return {
    month: monthName(now),
    count: scored.length,
    sectors,
    averageScore: mean(scored.map(t => Number(t.result.overall))),
    fullAverage: mean(fullTotals),
    weakest: pick(ranked[0]),
    strongest: pick(ranked[ranked.length - 1]),
  };
}

// The attribute to spotlight: lowest average across full assessments (never
// teasers), skipping any spotlighted in the last few issues so it moves on.
export function pickSpotlightAttribute(fullRows = [], recent = []) {
  const f = attributeAverages(fullRows.map(r => r.scores));
  const ranked = ATTRIBUTES.filter(a => f[a.id].avg !== null).sort((x, y) => f[x.id].avg - f[y.id].avg);
  const choice = ranked.find(a => !recent.includes(a.id)) || ranked[0];
  if (!choice) return null;
  return { attribute: choice, figures: { avg: f[choice.id].avg, brands: f[choice.id].n, belowFifty: f[choice.id].belowFifty } };
}

export const spotlightFigures = (pick) => new Set(['100', '50', String(pick?.figures?.avg), String(pick?.figures?.brands), String(pick?.figures?.belowFifty)].filter(x => x !== 'undefined' && x !== 'null'));
export function spotlightPrompt(pick, { strict = false } = {}) {
  const a = pick.attribute;
  const sig = a.signals || {};
  return `You are writing the Spotlight for Stay Conscious, Antenna Group's brand intelligence newsletter for its own staff. It focuses on ONE thing a brand can do to raise one attribute of the Conscious Compass, which scores brands out of 100 from what is publicly visible about them.

This week's attribute: ${a.name} (${a.fullName}). ${a.question}
What it measures: ${a.description}
Strong signals: ${(sig.strong || []).join('; ')}
Weak signals: ${(sig.weak || []).join('; ')}
Across ${pick.figures.brands} brands we have assessed, ${a.name} averages ${pick.figures.avg}, and ${pick.figures.belowFifty} score below 50.

Choose the single most useful action: concrete, publicly visible, something any brand could start this month, and drawn from the strong signals above. Not a list of tips.

Return JSON only:
{"headline":"Max 9 words, naming the action","action":"One or two sentences: the one thing to do.","why":"One or two sentences: why it lifts ${a.name}, in terms of what people can see.","steps":["Three short first steps, each under 15 words"]}

Name no brand or company. Use no figure except these, which come from our own scores: ${figureListForPrompt(spotlightFigures(pick))}. No statistics from anywhere else.${strict ? ' Your last answer used a figure that is not on that list. Use none of them, or only those listed.' : ''} Plain words, US English, no em dashes or en dashes, no jargon without saying what it means.`;
}

export function parseSpotlight(text, pick) {
  const m = String(text || '').match(/\{[\s\S]*\}/);
  if (!m || !pick) return null;
  let j; try { j = JSON.parse(m[0]); } catch { return null; }
  const t = (v, n) => noDashes(v || '').replace(/\s+/g, ' ').trim().slice(0, n);
  const out = { attribute: pick.attribute.id, name: pick.attribute.name, headline: t(j.headline, 120), action: t(j.action, 400), why: t(j.why, 400),
    steps: (Array.isArray(j.steps) ? j.steps : []).map(x => t(x, 160)).filter(Boolean).slice(0, 3), figures: pick.figures };
  return out.headline && out.action ? out : null;
}

// ── Choosing the lead (v4.8.0) ───────────────────────────────
// Stories arrive ranked by significance. The lead is the first that is not a
// follow-up and whose topic has not led recently; failing that, the first
// fresh story; failing that, the first story.
export function pickLead(items = [], recentLeadCategories = []) {
  const recent = new Set(recentLeadCategories.map(c => String(c || '').toLowerCase()));
  const fresh = items.filter(i => !i.followUp);
  return fresh.find(i => !recent.has(String(i.category || '').toLowerCase())) || fresh[0] || items[0];
}

// ── Talking point (v4.7.0) ───────────────────────────────────
// One line an account lead can use with a client this week, drawn from this
// issue's stories, so reading turns into using.
export function talkingPointPrompt(stories = [], { strict = false } = {}) {
  return `You are writing the Talking point for Stay Conscious, Antenna Group's weekly brand newsletter for its staff. Account leads use it in client conversations.

From this week's stories below, choose the one a client is most likely to ask about, and write the single point an account lead should make about it.

${stories.map((st, i) => `${i + 1}. [${st.category || ''}] ${st.headline}\n${String(st.insight || '').slice(0, 500)}`).join('\n\n')}

Return JSON only:
{"topic":"What the client might ask about, 2 to 5 words, lower case except names and acronyms, e.g. AI search or green claims on packaging","point":"The point to make, one or two sentences, under 40 words, in plain words a client would understand, with a figure from the story if it has one.","story":"The exact headline of the story it draws on"}

Name no client. Use only facts and figures that appear in the story you choose.${strict ? ' Your last answer used a figure that is not in that story. Use only its figures, or none.' : ''} US English, no em dashes or en dashes.`;
}
export function parseTalkingPoint(text, stories = []) {
  const m = String(text || '').match(/\{[\s\S]*\}/);
  if (!m) return null;
  let j; try { j = JSON.parse(m[0]); } catch { return null; }
  const t = (v, n) => noDashes(v || '').replace(/\s+/g, ' ').trim().slice(0, n);
  const topic = t(j.topic, 60).replace(/[.?!]+$/, '');
  const point = t(j.point, 300);
  const story = stories.find(st => st.headline === t(j.story, 300)) ? t(j.story, 300) : '';
  return topic && point ? { topic, point, story } : null;
}

// ── Landscape insights, for any reader (v4.1.0) ────────────────
// The issue is public, so the landscape text is written for someone who has
// never seen the Compass: each attribute is explained in plain words where it
// is first named, and no brand is named (a paragraph naming an assessed brand
// is dropped from the public issue, which used to leave half a story).
// ── A different landscape each week (v4.6.0) ─────────────────
// The portfolio analysis barely changes week to week and the rewrite was
// deterministic, so the section read the same every issue. It now sees the
// last three landscape sections, what actually moved since last week
// (computed in code), and a focus that rotates by issue; and a rewrite that
// still reads like a recent one is done again once.
export const LANDSCAPE_LENSES = [
  'The widest gap between two attributes: which pair pulls furthest apart across the portfolio, and what that says about how brands show up.',
  'Sector contrast: the sector furthest above the portfolio and the one furthest below, and what separates them.',
  'Maturity: how brands spread across the maturity bands, and what holds the middle back from the top.',
  'The weakest attribute: what it costs brands to be low on it, and what the brands scoring well on it do differently.',
  'The strongest attribute: whether that strength is earned in public or only claimed, and where it stops short.',
  'Consistency: where brands are most uneven across their eight attributes, and why uneven brands read as less credible.',
];
export const landscapeLens = (issueNumber) => LANDSCAPE_LENSES[(Math.max(1, Number(issueNumber) || 1) - 1) % LANDSCAPE_LENSES.length];

// The figures the landscape is compared on from week to week.
export function landscapeSnapshot(fullRows = []) {
  const totals = fullRows.map(r => Number(r.total_score)).filter(Number.isFinite);
  const avgs = attributeAverages(fullRows.map(r => r.scores));
  return { brandCount: totals.length, averageScore: totals.length ? Math.round(totals.reduce((a, b) => a + b, 0) / totals.length) : null,
    attributes: Object.fromEntries(ATTRIBUTES.map(a => [a.id, avgs[a.id].avg])) };
}
export function landscapeChanges(now, prev) {
  if (!now || !prev) return [];
  const out = [];
  if (now.brandCount !== prev.brandCount && Number.isFinite(prev.brandCount)) out.push(`Brands assessed: ${prev.brandCount} last week, ${now.brandCount} now.`);
  if (Number.isFinite(now.averageScore) && Number.isFinite(prev.averageScore) && now.averageScore !== prev.averageScore) out.push(`Average score: ${prev.averageScore} last week, ${now.averageScore} now.`);
  ATTRIBUTES.forEach(a => {
    const x = prev.attributes?.[a.id]; const y = now.attributes?.[a.id];
    if (Number.isFinite(x) && Number.isFinite(y) && Math.abs(y - x) >= 1) out.push(`${a.name} average: ${x} last week, ${y} now.`);
  });
  return out;
}
const wordSet = (t) => new Set(String(t || '').toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length > 3));
// Jaccard overlap of the words in two texts: 1 is the same text.
export function textOverlap(a, b) {
  const x = wordSet(a); const y = wordSet(b);
  if (!x.size || !y.size) return 0;
  let shared = 0; x.forEach(w => { if (y.has(w)) shared += 1; });
  return shared / (x.size + y.size - shared);
}
export const tooSimilarLandscape = (next, recent = []) => recent.some(r =>
  (next.headline && r.headline && headlineOverlap(next.headline, r.headline) >= 0.6) || textOverlap(next.summary, r.summary) >= 0.5);

export function landscapePrompt(analysis, { recent = [], lens = '', changes = [], retry = false, figures = '', strict = false } = {}) {
  const history = recent.length ? `

RECENT LANDSCAPE SECTIONS, newest first. Do not repeat them: no reused headline, no reused opening, no paragraph that says the same thing. A theme may come back only from a new angle or with new figures.
${recent.map((r, i) => `${i + 1}. HEADLINE: ${r.headline || '(none)'}\n${String(r.summary || '').slice(0, 900)}`).join('\n\n')}` : '';
  const moved = changes.length ? `

WHAT CHANGED SINCE LAST WEEK (computed from the scores; lead with the most telling of these):
${changes.map(c => `- ${c}`).join('\n')}` : `

Nothing material changed in the figures since last week, so do not report change. Use this week's focus to say something new.`;
  const focus = lens ? `

THIS WEEK'S FOCUS for paragraph 2: ${lens}` : '';
  const again = retry ? `

Your last draft was too close to a recent section. Start from a different finding and use different words.` : '';
  // The figures it may use, all computed from the scores (v4.10.0).
  const allowed = figures ? `

FIGURES YOU MAY USE (computed from the scores): ${figures}. Use no other number. If the analysis states a figure that is not on this list, it is out of date: leave it out.${strict ? ' Your last draft used a number that is not on this list.' : ''}` : '';
  return landscapePromptBase(analysis, history + moved + focus + again + allowed);
}

function landscapePromptBase(analysis, extra = '') {
  return `You are writing the landscape section of Stay Conscious, Antenna Group's weekly brand newsletter for its staff. Readers are colleagues across Antenna Group, many of whom have never used the Conscious Compass. Read this analysis and do two things:

1. Write a single headline (max 10 words) capturing the most striking finding. Output it on one line starting with exactly "HEADLINE: "

2. Rewrite the analysis as exactly two short paragraphs separated by a blank line:
   - Paragraph 1: the big picture. What the scores say about how brands across sectors are showing up, and the pattern that is emerging. Say once, plainly, that the Conscious Compass scores brands out of 100 on eight attributes from what is publicly visible about them.
   - Paragraph 2: the attributes. Which are strongest and weakest, where sectors differ most, and what that means for a brand. Name no more than three attributes.

Every time you name an attribute for the first time, explain it in a few plain words in the same sentence, for example "Sentient, how much a brand moves people, averages 42". Write attribute names in title case (Sentient, not SENTIENT). Use only these meanings:
${glossaryForPrompt()}

Never name an individual brand or company; sectors are fine.${extra} Every figure must come from the analysis. Keep the two paragraphs consistent with each other and with the headline, and use one term for each idea throughout (say "score" every time, never "rating" or "grade").

Use plain prose. No bullet points. No headers. No em dashes. Max 230 words across both paragraphs. Short sentences, plain words, lead with the point. No jargon such as "signals", "infrastructure" or "touchpoints" without saying what it means. No throat-clearing, no rule-of-three lists, no "not just X but Y", no motivational closers. US English.

ANALYSIS:
${analysis}`;
}

// ── Earned creative in the news (v3.124.0) ─────────────────────
// Recent earned creative work by other brands or agencies that is catching
// headlines, found by web search. Every example must carry a link that the
// search itself returned: the model cannot invent a source, because an item
// whose link is not among the search results is dropped. Fewer real examples
// beat a full section of unverifiable ones.
// v4.0.2: six candidates over the last three months, because each must pass
// the article check and three asked-for examples were leaving one standing.
// A top-up search names the brands already tried so it finds new ones.
// How far back each search looks (v4.10.0). Three examples is the aim, and
// there are hundreds of strong ones, so when recent work does not yield three
// that pass the checks, the search looks further back for work that cut through.
export const EARNED_CREATIVE_WINDOWS = [
  'Prefer work from the last 30 days; if there is not enough, go back up to three months, but nothing older.',
  'Look back up to twelve months. Choose work that clearly cut through: widely covered, awarded, or still talked about.',
  'Look back up to three years. Choose standout work that clearly cut through: widely covered, awarded at Cannes Lions or a similar show, or still cited as a benchmark.',
];
export function earnedCreativePrompt({ count = 6, exclude = [], window = 0 } = {}) {
  const skip = exclude.length ? `\n\nDo not include work by these brands, already covered: ${exclude.join(', ')}.` : '';
  const w = Math.min(Math.max(0, window), EARNED_CREATIVE_WINDOWS.length - 1);
  return `Find ${count} ${w ? 'examples of earned creative that cut through' : 'recent examples of earned creative that are catching headlines'}. ${EARNED_CREATIVE_WINDOWS[w]} Earned creative is an idea designed to be talked about rather than paid to be seen: a brand DID something in the world (a stunt, an installation, a product intervention, a data release, a public act, a partnership) and journalists, creators or the public carried it. Not paid ads, not sponsorships, not press releases on their own.

Prefer work by brands with a purpose, climate, energy, health or social angle, but any strong example will do. Search the trade and business press (for example Adweek, Ad Age, The Drum, Campaign, Fast Company, Marketing Week, Business Insider, Muse by Clio, LBBOnline). One example per brand.${skip}

For each example, use only facts from the pages your searches returned. The link must be the article you read about it.

Return JSON only, no prose before or after, most recent first:
{"examples":[{"brand":"The brand behind the work","agency":"The agency, or empty if none is named","title":"Name of the work, or a plain description","what":"What they did. Two short sentences, under 45 words.","coverage":"What coverage it generated: who carried it and how widely, from the article. One sentence, under 30 words.","outlet":"The publication of the link","published":"YYYY-MM-DD the article was published, or empty if unknown","url":"https://..."}]}

The url must be the article about THIS piece of work: a page that names the brand and the work itself. Never use a link about a different campaign by the same brand. If you cannot find such an article for an example, leave that example out.

US English. No em dashes or en dashes.`;
}
export const EARNED_CREATIVE_PROMPT = earnedCreativePrompt();
export const EARNED_CREATIVE_TARGET = 3;

export const normUrl = (u) => {
  try {
    const x = new URL(String(u).trim());
    if (x.protocol !== 'https:' && x.protocol !== 'http:') return null;
    [...x.searchParams.keys()].filter(k => /^utm_|^ref$|^fbclid$|^gclid$/i.test(k)).forEach(k => x.searchParams.delete(k));
    x.hash = '';
    return `${x.protocol}//${x.host.replace(/^www\./, '')}${x.pathname.replace(/\/+$/, '')}${x.search}`.toLowerCase();
  } catch { return null; }
};

// The links the web search actually returned, from result blocks and
// citations, with the headline the search gave each (v4.0.1).
export function searchedResults(content = []) {
  const found = new Map();
  const add = (url, title) => { const n = normUrl(url); if (n) found.set(n, [found.get(n), title].filter(Boolean).join(' ')); };
  (content || []).forEach(b => {
    if (b?.type === 'web_search_tool_result' && Array.isArray(b.content)) b.content.forEach(r => add(r?.url, r?.title));
    if (b?.type === 'text' && Array.isArray(b.citations)) b.citations.forEach(c => add(c?.url, [c?.title, c?.cited_text].filter(Boolean).join(' ')));
  });
  return found;
}
export const searchedUrls = (content = []) => new Set(searchedResults(content).keys());

const tidy = (v) => noDashes(v).replace(/\s+/g, ' ').trim();
const cleanText = (v, n) => tidy(v).slice(0, n);
// Longer text is cut at the last whole sentence that fits, never mid-sentence
// (v4.0.1: descriptions were being cut off mid-word).
export function wholeSentences(v, n) {
  const t = tidy(v);
  if (t.length <= n) return t;
  const head = t.slice(0, n);
  const end = Math.max(head.lastIndexOf('. '), head.lastIndexOf('! '), head.lastIndexOf('? '));
  if (end > 0) return head.slice(0, end + 1);
  // One sentence longer than the limit: cut at a word and say so.
  return `${head.slice(0, head.lastIndexOf(' ')).replace(/[,;:]$/, '')}\u2026`;
}

// Does a page, or a search headline, name both the brand and the work? A link
// about another campaign by the same brand names the brand but not the work.
const fold = (v) => String(v || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const STOP = new Set(['the', 'and', 'for', 'with', 'from', 'that', 'this', 'into', 'your', 'their', 'campaign', 'stunt', 'brand']);
export function namesTheWork(text, { brand, title }, { loose = false } = {}) {
  const t = fold(text);
  const b = fold(brand).replace(/^the\s+/, '').trim();
  if (!b || !t.includes(b)) return false;
  const terms = [...new Set(fold(title).split(/[^a-z0-9]+/).filter(w => w.length >= 4 && !STOP.has(w)))];
  if (!terms.length) return true;
  const hits = terms.filter(w => t.includes(w)).length;
  // A headline is short, so one word of the work's name is enough (v4.0.2);
  // a full article still has to name most of it.
  if (loose) return hits >= 1;
  return terms.length <= 2 ? hits === terms.length : hits >= Math.ceil((terms.length * 2) / 3);
}

// Opens the article and checks it; if the page cannot be read (paywall, block,
// timeout), the search headline has to pass the same check instead.
export async function verifyExample(item, { fetchImpl = fetch, timeoutMs = 8000 } = {}) {
  try {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), timeoutMs);
    const r = await fetchImpl(item.url, { signal: ctl.signal, redirect: 'follow', headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ConsciousCompass/4.0; +https://conscious-compass.vercel.app)', Accept: 'text/html' } });
    clearTimeout(timer);
    if (r.ok) {
      const html = await r.text();
      const text = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ');
      if (text.length > 500) return namesTheWork(text, item);
    }
  } catch { /* fall back to the search headline */ }
  // The headline plus the link's own words: slugs usually name the work.
  let slug = '';
  try { slug = decodeURIComponent(new URL(item.url).pathname).replace(/[-_/.]+/g, ' '); } catch { /* no slug */ }
  return namesTheWork(`${item.searchTitle || ''} ${slug}`, item, { loose: true });
}

export function earnedCreativeFromResponse(data, { max = 8 } = {}) {
  const content = Array.isArray(data?.content) ? data.content : [];
  // Joined as written: with search on, citations split the reply into text
  // blocks, sometimes mid-string, and an added newline breaks the JSON.
  const text = content.filter(b => b.type === 'text').map(b => b.text).join('');
  // The answer is the last {"examples": ...} object; anything the model wrote
  // between searches comes before it (v4.1.2).
  const starts = [...text.matchAll(/\{\s*"examples"/g)];
  const from = starts.length ? starts[starts.length - 1].index : text.indexOf('{');
  const to = text.lastIndexOf('}');
  const match = from >= 0 && to > from ? [text.slice(from, to + 1)] : null;
  if (!match) return [];
  let parsed;
  try { parsed = JSON.parse(match[0]); } catch { return []; }
  const results = searchedResults(content);
  const seen = new Set();
  return (Array.isArray(parsed?.examples) ? parsed.examples : [])
    .map(e => ({
      brand: cleanText(e?.brand, 80), agency: cleanText(e?.agency, 80), title: cleanText(e?.title, 140),
      what: wholeSentences(e?.what, 420), coverage: wholeSentences(e?.coverage, 300), outlet: cleanText(e?.outlet, 80),
      published: /^\d{4}-\d{2}-\d{2}$/.test(String(e?.published || '').trim()) ? String(e.published).trim() : '',
      url: String(e?.url || '').trim(),
      searchTitle: results.get(normUrl(e?.url)) || '',
    }))
    .filter(e => e.brand && e.what && e.url.startsWith('https://') && results.has(normUrl(e.url)))
    .filter(e => { const k = e.brand.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; })
    .slice(0, max);
}

// Most recent first; undated examples keep their place after the dated ones.
export const byRecency = (items) => items
  .map((e, i) => ({ e, i }))
  .sort((a, b) => (b.e.published || '').localeCompare(a.e.published || '') || a.i - b.i)
  .map(({ e }) => e);

// One search. With many searches the API can pause the turn (stop_reason
// "pause_turn") before the model has written its answer; the turn is then
// resumed, up to three times, instead of being read as "nothing found"
// (v4.1.2: this emptied the section for several issues). Returns the
// candidates and, when there are none, why.
async function searchEarnedCreative(anthropicKey, exclude, fetchImpl, deadline = Infinity, window = 0) {
  const prompt = earnedCreativePrompt({ exclude, window });
  let content = [];
  let stop = '';
  for (let turn = 0; turn < 4; turn++) {
    const messages = [{ role: 'user', content: prompt }];
    if (content.length) messages.push({ role: 'assistant', content });
    const r = await fetchImpl('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': anthropicKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6', max_tokens: 6000, temperature: 0,
        tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 8 }],
        messages,
      }),
    });
    if (!r.ok) return { candidates: [], reason: `search request failed (${r.status})` };
    const data = await r.json();
    content = content.concat(Array.isArray(data?.content) ? data.content : []);
    stop = data?.stop_reason || '';
    if (stop !== 'pause_turn' || Date.now() > deadline) break;   // never resume past the deadline: the job has five minutes in all
  }
  const candidates = earnedCreativeFromResponse({ content });
  if (candidates.length) return { candidates };
  return { candidates: [], reason: stop === 'max_tokens' ? 'the answer ran out of room' : stop === 'pause_turn' ? 'the search did not finish' : 'no usable examples in the answer' };
}

// Up to two searches: the second runs if fewer than three examples pass (or
// the first failed, which retries it)
// the article check, and skips every brand already tried (v4.0.2). Always
// returns a result with a status, which stays internal (the public issue
// carries only the items), so an empty section can be explained (v4.1.2).
// featured: brands shown in recent issues, left out so examples do not repeat
// week to week (v4.5.0). The carry-over below may still show last week's when
// nothing new is found, and says so.
export async function fetchEarnedCreative(anthropicKey, { fetchImpl = fetch, verify = verifyExample, factCheck = factCheckExample, rounds = EARNED_CREATIVE_WINDOWS.length, budgetMs = 120000, deadlineMs = 200000, featured = [] } = {}) {
  const started = Date.now();
  const deadline = started + deadlineMs;
  const kept = [];
  const tried = new Set(featured.map(b => String(b || '').trim().toLowerCase()).filter(Boolean));
  const status = { searches: 0, candidates: 0, passed: 0, reasons: [], factCheck: [] };
  try {
    for (let round = 0; round < rounds && kept.length < EARNED_CREATIVE_TARGET; round++) {
      if (round > 0 && Date.now() - started > budgetMs) break;   // leave time for the rest of the issue
      status.searches += 1;
      // Each round looks further back (v4.10.0).
      const found = await searchEarnedCreative(anthropicKey, [...tried], fetchImpl, deadline, round);
      if (found.reason) status.reasons.push(found.reason);
      const candidates = found.candidates.filter(e => !tried.has(e.brand.toLowerCase()));
      if (!candidates.length) continue;
      candidates.forEach(e => tried.add(e.brand.toLowerCase()));
      status.candidates += candidates.length;
      // Each link is opened and must name the brand and the work (v4.0.1).
      const checks = await Promise.all(candidates.map(e => Promise.resolve(verify(e)).catch(() => false)));
      // Then what it says is checked against the article (v4.10.0).
      const passed = candidates.filter((_, i) => checks[i]);
      const facts = await Promise.all(passed.map(e => Promise.resolve(factCheck(e, { anthropicKey, fetchImpl, deadline }))
        .catch(() => ({ item: null, report: { brand: e.brand, outcome: 'dropped', reason: 'the check could not run', removed: [] } }))));
      facts.forEach(f => { status.factCheck.push(f.report); if (f.item) kept.push(f.item); });
    }
  } catch (err) {
    status.reasons.push(`error: ${String(err?.message || err).slice(0, 120)}`);
  }
  status.passed = kept.length;
  if (status.candidates && !kept.length) status.reasons.push('no example passed the article check and the fact check');
  const items = byRecency(kept).slice(0, EARNED_CREATIVE_TARGET).map((e) => { const out = { ...e, verified: true }; delete out.searchTitle; return out; });
  return { items, generatedAt: new Date().toISOString(), status };
}

// When a run finds nothing, the last issue's checked examples stay up rather
// than the section vanishing; they are marked as carried over (v4.1.2).
// Only examples that passed the article check are carried.
// Carried examples are dropped once they were found more than four weeks ago.
export function withCarryOver(fresh, previous, previousIssue = null, now = Date.now()) {
  if (fresh?.items?.length) return fresh;
  const kept = (previous?.items || []).filter(e => e && e.verified === true && e.factChecked === true && typeof e.url === 'string');   // fact-checked ones only (v4.10.0)
  const foundAt = previous?.foundAt || previous?.generatedAt || '';
  const age = now - Date.parse(foundAt);
  if (!kept.length || !(age <= 28 * 24 * 3600 * 1000)) return fresh;
  return { ...fresh, items: kept, foundAt, carriedFrom: previous?.carriedFrom || previousIssue || null };
}

// ── Fact check (v4.10.0) ─────────────────────────────────────
// Staff repeat what the newsletter says to clients, so every factual claim
// must be one its cited page actually makes. Until now a story only had to
// cite a page the search returned; nothing checked that the page said what
// the story said. Now each source page is opened and every sentence is
// checked against it, by Claude reading only that page (never its own
// knowledge), then again in code: a "supported" verdict must quote the page,
// the quote must be found on the page, and every figure in the sentence must
// appear on the page. Sentences that fail are removed. A story whose headline
// fails, or with nothing left to say, is dropped. When the check cannot run
// (no readable page, an API error, no time left), the claims count as
// unsupported: nothing unchecked reaches readers.
const ENTITY = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', rsquo: "'", lsquo: "'", rdquo: '"', ldquo: '"', ndash: '–', mdash: '—', hellip: '…', pound: '£', euro: '€' };
export const htmlToText = (html) => String(html || '')
  .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<noscript[\s\S]*?<\/noscript>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => (e[0] === '#' ? String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : Number(e.slice(1))) : (ENTITY[e.toLowerCase()] ?? m)))
  .replace(/\s+/g, ' ').trim();
// The readable text of a page, or '' when it cannot be read.
export async function pageText(url, { fetchImpl = fetch, timeoutMs = 8000 } = {}) {
  try {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), timeoutMs);
    const r = await fetchImpl(url, { signal: ctl.signal, redirect: 'follow', headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ConsciousCompass/4.0; +https://conscious-compass.vercel.app)', Accept: 'text/html' } });
    clearTimeout(timer);
    if (!r.ok) return '';
    const text = htmlToText(await r.text());
    return text.length > 500 ? text.slice(0, 60000) : '';
  } catch { return ''; }
}
// Sentences, keeping paragraphs: [[s, s], [s]]. Abbreviations and decimals
// do not end a sentence.
export const paragraphsOf = (t) => String(t || '').split(/\n\s*\n/).map(p => p.replace(/\s+/g, ' ').trim()).filter(Boolean)
  .map(p => p.split(/(?<!\b(?:U\.S|U\.K|E\.U|Inc|Corp|Co|Ltd|Mr|Ms|Mrs|Dr|St|vs|e\.g|i\.e|No)\.)(?<=[.!?]["'”’)\]]?)\s+(?=["'“‘(]?[A-Z0-9])/).map(s => s.trim()).filter(Boolean));
const NUM_WORD = { two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90, hundred: 100 };
const normNum = (n) => String(parseFloat(String(n).replace(/,/g, '')));
// The figures in a text, as plain numbers: "1,200" and "1200" are the same.
export const numbersIn = (t) => [...new Set((String(t || '').match(/\d[\d,]*(?:\.\d+)?/g) || []).map(normNum).filter(n => n !== 'NaN'))];
export function figuresIn(t) {
  const out = new Set(numbersIn(t));
  (String(t || '').toLowerCase().match(/\b[a-z]+\b/g) || []).forEach(w => { if (NUM_WORD[w]) out.add(String(NUM_WORD[w])); });
  return out;
}
// Figures in a text that are not in the allowed set.
export const unsupportedNumbers = (text, allowed) => { const ok = new Set([...allowed].map(normNum)); return numbersIn(text).filter(n => !ok.has(n)); };
const words = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[‘’]/g, "'").replace(/[^a-z0-9'%$.]+/g, ' ').replace(/(\D)\.|\.(\D|$)/g, '$1 $2').replace(/\s+/g, ' ').trim();
// Is the quote on the page? Exactly, after tidying, or nearly every word of it
// in order (pages split text with markup the tidy-up cannot always undo).
export function quoteFound(quote, evidence) {
  const q = words(quote); const e = words(evidence);
  if (q.split(' ').length < 4) return false;   // two or three words prove nothing
  if (e.includes(q)) return true;
  const qs = q.split(' ').filter(w => w.length > 2);
  if (qs.length < 3) return false;
  let at = 0; let hits = 0;
  for (const w of qs) { const i = e.indexOf(` ${w}`, at); if (i >= 0) { hits += 1; at = i + w.length; } }
  return hits / qs.length >= 0.85;
}
export function factCheckPrompt(statements, evidence) {
  return `You are the fact checker for Stay Conscious, a newsletter whose readers repeat what it says to clients. Check each numbered statement against the EVIDENCE below and nothing else. Do not use your own knowledge, even if you are sure.

Verdicts:
- "supported": every fact, name, figure, date and claim in the statement is stated in the evidence. Wording may differ; meaning may not. A figure that differs at all is not supported.
- "opinion": allowed only for statements marked [view]. It interprets the facts, says why they matter or what to do, and states no fact, name, figure or claim about the world that the evidence does not.
- "unsupported": anything else, including statements that are partly supported, or that go further than the evidence.

For each "supported" verdict, copy the words from the evidence that support it, exactly as they appear, 4 to 30 words.

Return JSON only:
{"verdicts":[{"n":1,"verdict":"supported","quote":"..."}]}

STATEMENTS
${statements.map((s, i) => `${i + 1}. [${s.kind}] ${s.text}`).join('\n')}

EVIDENCE
${evidence.map((e, i) => `[Source ${i + 1}] ${e.label}\n${e.text.slice(0, 14000)}`).join('\n\n')}`;
}
export function parseVerdicts(text, count) {
  const m = String(text || '').match(/\{[\s\S]*\}/);
  let j = null; try { j = m ? JSON.parse(m[0]) : null; } catch { j = null; }
  const list = Array.isArray(j?.verdicts) ? j.verdicts : [];
  return Array.from({ length: count }, (_, i) => {
    const v = list.find(x => Number(x?.n) === i + 1) || {};
    return { verdict: ['supported', 'opinion', 'unsupported'].includes(v.verdict) ? v.verdict : 'unsupported', quote: String(v.quote || '') };
  });
}
// Claude reads; code decides. Returns { ok, reason } for each statement.
// context: our own earlier coverage, which a follow-up may refer to. It is
// read alongside a real source, never instead of one.
export async function checkStatements(statements, evidence, { anthropicKey, fetchImpl = fetch, deadline = Infinity, context = [] } = {}) {
  const fail = (reason) => statements.map(() => ({ ok: false, reason }));
  const readable = evidence.filter(e => e.text && e.text.length >= 200);
  if (!readable.length) return fail('its source page could not be read');
  const sources = [...readable, ...context.filter(c => c.text)];
  if (Date.now() > deadline) return fail('there was no time left to check it');
  let verdicts;
  try {
    const r = await fetchImpl('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': anthropicKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 2500, temperature: 0, messages: [{ role: 'user', content: factCheckPrompt(statements, sources) }] }),
    });
    if (!r.ok) return fail('the check could not run');
    const d = await r.json();
    verdicts = parseVerdicts((d.content || []).filter(b => b.type === 'text').map(b => b.text).join(''), statements.length);
  } catch { return fail('the check could not run'); }
  const all = sources.map(e => e.text).join(' \n ');
  const allowed = figuresIn(all);
  return statements.map((s, i) => {
    const v = verdicts[i];
    const bad = unsupportedNumbers(s.text, allowed);
    if (v.verdict === 'supported') {
      if (!quoteFound(v.quote, all)) return { ok: false, reason: 'the checker could not point to it in the source' };
      if (bad.length) return { ok: false, reason: `the figure ${bad.join(', ')} is not in the source` };
      return { ok: true };
    }
    if (v.verdict === 'opinion' && s.kind === 'view') return bad.length ? { ok: false, reason: `the figure ${bad.join(', ')} is not in the source` } : { ok: true };
    return { ok: false, reason: 'the source does not say this' };
  });
}
const hostOf = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; } };
// The evidence for a set of links: each page's text, or what the search
// returned about it when the page cannot be read (paywalls, blocks).
async function evidenceFor(links, { found = new Map(), fetchImpl = fetch } = {}) {
  return Promise.all(links.map(async (l) => {
    const text = await pageText(l.url, { fetchImpl });
    return { label: `${l.outlet || hostOf(l.url)} ${l.url}`, text: text || String(found.get(normUrl(l.url)) || l.searchTitle || '') };
  }));
}
// One story: the headline must be supported, the insight keeps its supported
// sentences (at least one), "why it matters" keeps supported sentences and
// opinion that adds no new facts.
export async function factCheckStory(item, { anthropicKey, fetchImpl = fetch, found, deadline } = {}) {
  const headline = String(item?.headline || '');
  if (!Array.isArray(item?.sources) || !item.sources.length) return { item: null, report: { headline, outcome: 'dropped', reason: 'it had no source the search returned', removed: [] } };
  const evidence = await evidenceFor(item.sources, { found, fetchImpl });
  const context = item.followUp?.headline ? [{ label: `Our earlier coverage, Stay Conscious Issue ${item.followUp.issueNumber ?? ''}`, text: `Stay Conscious reported: ${item.followUp.headline}.` }] : [];
  const ins = paragraphsOf(item.insight);
  const why = paragraphsOf(item.whyItMatters);
  const statements = [{ kind: 'headline', field: 'headline', text: headline },
    ...ins.flatMap((p, pi) => p.map((text, si) => ({ kind: 'fact', field: 'insight', pi, si, text }))),
    ...why.flatMap((p, pi) => p.map((text, si) => ({ kind: 'view', field: 'whyItMatters', pi, si, text })))];
  const results = await checkStatements(statements, evidence, { anthropicKey, fetchImpl, deadline, context });
  const removed = statements.map((s, i) => ({ s, r: results[i] })).filter(x => !x.r.ok).map(x => ({ field: x.s.field, text: x.s.text, reason: x.r.reason }));
  const keep = (field, paras) => paras.map((p, pi) => p.filter((_, si) => results[statements.findIndex(s => s.field === field && s.pi === pi && s.si === si)].ok).join(' ')).filter(Boolean).join('\n\n');
  if (!results[0].ok) return { item: null, report: { headline, outcome: 'dropped', reason: `its headline could not be confirmed: ${results[0].reason}`, removed } };
  const insight = keep('insight', ins);
  if (!insight) return { item: null, report: { headline, outcome: 'dropped', reason: 'nothing in it could be confirmed by its source', removed } };
  return { item: { ...item, insight, whyItMatters: keep('whyItMatters', why), checked: true }, report: { headline, outcome: 'kept', removed } };
}
export async function factCheckStories(items = [], opts = {}) {
  const checked = await Promise.all(items.map(it => factCheckStory(it, opts)));
  return { items: checked.map(c => c.item).filter(Boolean), reports: checked.map(c => c.report) };
}
// One earned creative example: "what" keeps its supported sentences (at least
// one, or the example goes); an unsupported "coverage" line is removed.
export async function factCheckExample(e, { anthropicKey, fetchImpl = fetch, deadline } = {}) {
  const evidence = await evidenceFor([e], { fetchImpl });
  const what = paragraphsOf(e.what).flat();
  const cov = paragraphsOf(e.coverage).flat();
  const statements = [...what.map(text => ({ kind: 'fact', field: 'what', text })), ...cov.map(text => ({ kind: 'fact', field: 'coverage', text }))];
  if (!statements.length) return { item: null, report: { brand: e.brand, outcome: 'dropped', reason: 'it said nothing to check', removed: [] } };
  const results = await checkStatements(statements, evidence, { anthropicKey, fetchImpl, deadline });
  const removed = statements.map((s, i) => ({ s, r: results[i] })).filter(x => !x.r.ok).map(x => ({ field: x.s.field, text: x.s.text, reason: x.r.reason }));
  const kept = (field) => statements.filter((s, i) => s.field === field && results[i].ok).map(s => s.text).join(' ');
  if (!kept('what')) return { item: null, report: { brand: e.brand, outcome: 'dropped', reason: 'what it did could not be confirmed by the article', removed } };
  return { item: { ...e, what: kept('what'), coverage: kept('coverage'), factChecked: true }, report: { brand: e.brand, outcome: 'kept', removed } };
}

// Figures in the sections written from our own data (v4.10.0): every number
// must be one the code computed. A section that fails is written again once,
// told which figures it may use, and left out if it still fails.
export function landscapeFigures(rows = []) {
  const out = new Set(['100', '8']);
  [0, 25, 26, 39, 40, 55, 56, 69, 70, 84, 85].forEach(n => out.add(String(n)));   // the maturity bands
  if (!rows.length) return out;
  const avg = (xs) => Math.round(xs.reduce((a, b) => a + b, 0) / xs.length);
  const grouped = {};
  rows.forEach(r => { (grouped[r.industry || 'other'] ||= []).push(r); });
  const sectors = Object.values(grouped);
  [rows.length, sectors.length, avg(rows.map(r => r.total_score || 0))].forEach(n => out.add(String(n)));
  const overall = {};
  ATTRIBUTES.forEach(a => { overall[a.id] = avg(rows.map(r => r.scores?.[a.id] || 0)); out.add(String(overall[a.id])); });
  const secAvgs = sectors.map(bs => {
    out.add(String(bs.length)); out.add(String(avg(bs.map(b => b.total_score || 0))));
    const m = {}; ATTRIBUTES.forEach(a => { m[a.id] = avg(bs.map(b => b.scores?.[a.id] || 0)); out.add(String(m[a.id])); });
    return m;
  });
  ATTRIBUTES.forEach(a => {
    const vals = secAvgs.map(m => m[a.id]);
    const min = Math.min(...vals); const max = Math.max(...vals);
    const sd = Math.round(Math.sqrt(vals.reduce((s, v) => s + (v - overall[a.id]) ** 2, 0) / vals.length));
    [min, max, max - min, sd].forEach(n => out.add(String(n)));
    // Gaps between any two attributes' portfolio averages, which the focus asks about.
    ATTRIBUTES.forEach(b => out.add(String(Math.abs(overall[a.id] - overall[b.id]))));
  });
  return out;
}
export const figureListForPrompt = (allowed) => [...allowed].map(Number).sort((a, b) => a - b).join(', ');

// Which stories may go in the issue (v4.10.0): only those the Sunday job
// fact-checked, with that run's report when it is there. However few pass,
// the issue goes out with them; an unchecked story never does.
export function storyCheckState(scRow, reportRow) {
  const all = Array.isArray(scRow?.items) ? scRow.items : [];
  const items = all.filter(i => i && i.checked === true);
  const report = reportRow && scRow && reportRow.refreshed_at === scRow.refreshed_at && Array.isArray(reportRow.items) ? (reportRow.items[0] || null) : null;
  return { items, report, unchecked: all.length - items.length };
}

// ── A copy of every published issue in Smartsheet (v4.11.0) ────────────────
// Supabase stays the record the app reads; Smartsheet gets one row per issue,
// with its key fields and the issue as a Word file (the same file as the
// page's DOCX button). The copy never blocks or fails a publish: without
// SMARTSHEET_API_TOKEN and SMARTSHEET_SHEET_ID it is skipped, and any error
// is reported back and left for the next publish or the backfill to repair.
// Rows are found by issue number, so a mid-week revision updates its row and
// re-running the backfill never duplicates one. Columns are matched by title,
// so they can be reordered or widened in Smartsheet freely.
export const SMARTSHEET_API = 'https://api.smartsheet.com/2.0';
export const SMARTSHEET_COLUMNS = [
  { title: 'Issue', type: 'TEXT_NUMBER', primary: true },
  { title: 'Week of', type: 'TEXT_NUMBER' },
  { title: 'Published', type: 'DATE' },
  { title: 'Lead topic', type: 'TEXT_NUMBER' },
  { title: 'Lead headline', type: 'TEXT_NUMBER' },
  { title: 'Other stories', type: 'TEXT_NUMBER' },
  { title: 'Talking point', type: 'TEXT_NUMBER' },
  { title: 'Earned creative', type: 'TEXT_NUMBER' },
  { title: 'Sources', type: 'TEXT_NUMBER' },
  { title: 'Edition link', type: 'TEXT_NUMBER' },
  { title: 'Fact check', type: 'TEXT_NUMBER' },
];
const CELL_MAX = 4000;   // Smartsheet's limit per cell
const capCell = (v) => { const t = String(v ?? ''); return t.length > CELL_MAX ? `${t.slice(0, CELL_MAX - 1)}…` : t; };
// A one-line summary of the fact check, for the internal column.
export function factCheckSummary(check) {
  if (!check) return '';
  const stories = check.stories || []; const ec = check.earnedCreative || []; const figs = check.figures || [];
  const removed = [...stories, ...ec].reduce((n, r) => n + (r.outcome === 'kept' ? (r.removed?.length || 0) : 0), 0);
  const parts = [`${check.passed ?? stories.filter(s => s.outcome === 'kept').length} of ${stories.length} stories passed`, `${removed} ${removed === 1 ? 'sentence' : 'sentences'} removed`];
  const left = stories.filter(s => s.outcome !== 'kept').map(s => s.headline).filter(Boolean);
  if (left.length) parts.push(`Left out: ${left.join('; ')}`);
  if (ec.length) parts.push(`Earned creative: ${ec.filter(e => e.outcome === 'kept').length} of ${ec.length} kept`);
  figs.filter(f => f.outcome !== 'kept').forEach(f => parts.push(`${f.section}: ${f.outcome === 'dropped' ? 'left out' : f.outcome}`));
  return `${parts.join('. ')}.`;
}
// The row's values, by column title. undefined means "leave as it is".
export function smartsheetValues(nl, { publishedAt, link, check } = {}) {
  const items = Array.isArray(nl?.intelligenceItems) ? nl.intelligenceItems : [];
  const stories = [nl?.leadStory, ...items].filter(Boolean);
  const sources = [...new Set(stories.flatMap(s => (s.sources || []).map(x => x?.url)).concat((nl?.earnedCreative?.items || []).map(e => e?.url)).filter(u => typeof u === 'string' && /^https:\/\//.test(u)))];
  const tp = nl?.talkingPoint;
  return {
    'Issue': Number(nl?.issueNumber) || null,
    'Week of': nl?.weekOf || '',
    'Published': publishedAt ? new Date(publishedAt).toLocaleDateString('en-CA', { timeZone: 'America/New_York' }) : undefined,   // YYYY-MM-DD
    'Lead topic': nl?.leadStory?.category || '',
    'Lead headline': nl?.leadStory?.headline || '',
    'Other stories': items.map(i => `${i.headline}${i.category ? ` (${i.category})` : ''}`).join('\n'),
    'Talking point': tp?.point ? `If a client asks about ${tp.topic}: ${tp.point}` : '',
    'Earned creative': (nl?.earnedCreative?.items || []).map(e => `${e.brand}${e.title ? `: ${e.title}` : ''}`).join('\n'),
    'Sources': sources.join('\n'),
    'Edition link': link,
    'Fact check': check === undefined ? undefined : factCheckSummary(check),
  };
}
const ssFetch = (token, fetchImpl) => async (path, init = {}) => {
  const r = await fetchImpl(`${SMARTSHEET_API}${path}`, { ...init, headers: { Authorization: `Bearer ${token}`, ...(init.headers || {}) } });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`Smartsheet ${r.status}${body?.message ? `: ${body.message}` : ''}`);
  return body;
};
// The Word file for an issue, built by the shared builder, with the report
// fonts embedded as the page does.
export async function issueDocxBytes(nl, { refreshedAt = null, fetchImpl = fetch } = {}) {
  const docx = await import('docx');
  const { default: JSZip } = await import('jszip');
  const { embedReportFonts } = await import('../src/lib/docxFonts.js');
  const fmtDate = (d) => { const x = new Date(d); return `${x.toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'America/New_York' })} at ${x.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: 'America/New_York' })}`; };
  const doc = newsletterDocument(docx, nl, { refreshedAt, nextUpdate: nextIssueAt(refreshedAt ? new Date(refreshedAt) : new Date()), fmtDate });
  const blob = await docx.Packer.toBlob(doc);
  const withFonts = await embedReportFonts(blob, { JSZip, fetchImpl: (u) => fetchImpl(`${SITE_URL()}${u}`) });
  return new Uint8Array(await withFonts.arrayBuffer());
}
// Adds or updates the issue's row and attaches its Word file. Never throws.
export async function syncIssueToSmartsheet(nl, { publishedAt, link, check, attach = true, token = process.env.SMARTSHEET_API_TOKEN, sheetId = process.env.SMARTSHEET_SHEET_ID, fetchImpl = fetch, sheet = null } = {}) {
  if (!token || !sheetId) return { ok: false, skipped: true, reason: 'Smartsheet is not set up (SMARTSHEET_API_TOKEN and SMARTSHEET_SHEET_ID).' };
  const issue = Number(nl?.issueNumber);
  if (!issue) return { ok: false, reason: 'the issue has no number' };
  const ss = ssFetch(token, fetchImpl);
  try {
    const s = sheet || await ss(`/sheets/${sheetId}`);
    const col = Object.fromEntries((s.columns || []).map(c => [c.title, c.id]));
    if (!col.Issue) return { ok: false, reason: 'the sheet has no Issue column' };
    const existing = (s.rows || []).find(r => (r.cells || []).some(c => c.columnId === col.Issue && Number(c.value) === issue));
    const values = smartsheetValues(nl, { publishedAt, link, check });
    const cells = Object.entries(values).filter(([t, v]) => v !== undefined && col[t]).map(([t, v]) => ({ columnId: col[t], value: typeof v === 'number' ? v : capCell(v) }));
    let rowId;
    if (existing) {
      await ss(`/sheets/${sheetId}/rows`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify([{ id: existing.id, cells }]) });
      rowId = existing.id;
    } else {
      const added = await ss(`/sheets/${sheetId}/rows`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify([{ toTop: true, cells }]) });
      rowId = (Array.isArray(added?.result) ? added.result[0] : added?.result)?.id;
    }
    if (!attach || !rowId) return { ok: true, rowId, added: !existing, attached: false };
    const name = newsletterDocxName(nl);
    const bytes = await issueDocxBytes(nl, { refreshedAt: publishedAt, fetchImpl });
    const upload = { method: 'POST', headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'Content-Disposition': `attachment; filename="${encodeURIComponent(name)}"`, 'Content-Length': String(bytes.length) }, body: bytes };
    // A revision of the issue is a new version of the same file, not a second file.
    const listed = existing ? await ss(`/sheets/${sheetId}/rows/${rowId}/attachments`) : { data: [] };
    const same = (listed.data || []).find(a => a.name === name);
    await ss(same ? `/sheets/${sheetId}/attachments/${same.id}/versions` : `/sheets/${sheetId}/rows/${rowId}/attachments`, upload);
    return { ok: true, rowId, added: !existing, attached: true };
  } catch (e) {
    return { ok: false, reason: String(e?.message || e).slice(0, 200) };
  }
}

// ── Draft, review, publish (v4.7.0) ──────────────────────────
// The Sunday run writes a draft (row 2) instead of going live; the live issue
// stays in row 1. Admins can preview, edit the text, hold or publish it, and
// the Monday run publishes it unless it is held. Publishing a weekly draft
// archives the issue it replaces, so the archive keeps one edition a week.
// A Force refresh writes a draft too: a revision of the current issue (same
// number, nothing archived) unless a weekly draft is waiting, which it
// replaces as that week's issue.
export const LIVE_ID = 1;
export const DRAFT_ID = 2;
export const SITE_URL = () => (process.env.PUBLIC_SITE_URL || 'https://conscious-compass.vercel.app').replace(/\/$/, '');

// The text an admin may change in a draft, and nothing else.
const EDITABLE = [
  /^leadStory\.(headline|insight|whyItMatters)$/,
  /^intelligenceItems\.\d{1,2}\.(headline|insight|whyItMatters)$/,
  /^talkingPoint\.(topic|point)$/,
  /^spotlight\.(headline|action|why)$/,
  /^landscapeAnalysis\.(headline|summary)$/,
];
export function applyDraftEdits(newsletter, edits = []) {
  const out = JSON.parse(JSON.stringify(newsletter || {}));
  const removeItems = [];
  (Array.isArray(edits) ? edits : []).forEach(e => {
    const path = String(e?.path || '');
    // A story can be taken out of the draft altogether.
    const rm = /^intelligenceItems\.(\d{1,2})$/.exec(path);
    if (rm && e.value === null) { removeItems.push(Number(rm[1])); return; }
    if (!EDITABLE.some(r => r.test(path)) || typeof e.value !== 'string') return;
    const keys = path.split('.');
    let node = out;
    for (let i = 0; i < keys.length - 1; i++) { node = node?.[keys[i]]; if (!node || typeof node !== 'object') return; }
    node[keys[keys.length - 1]] = noDashes(e.value).slice(0, 4000);
  });
  if (removeItems.length && Array.isArray(out.intelligenceItems)) out.intelligenceItems = out.intelligenceItems.filter((_, i) => !removeItems.includes(i));
  return out;
}
export const stripDraft = (nl) => { const out = { ...(nl || {}) }; delete out._draft; return out; };

// The note posted to Slack or Teams when an issue goes live, or when a draft
// is ready for review. Slack incoming webhooks take text; anything else is
// treated as a Teams Workflows webhook, which takes an Adaptive Card.
// A note is a masthead, an optional image, labelled sections and one link.
// v4.7.2: laid out like the issue (masthead, dateline, photo, then each
// section under a red label, divided by rules). Teams cards cannot carry the
// newsletter's fonts, so the type is Teams' own. Slack gets the same order.
// Sections: { label, heading?, text?, strong? }.
export function channelPayload(url, { title, badge = null, masthead = null, mastheadImage = null, dateline = '', image = null, sections = [], link, linkLabel, moreLinks = [] }) {
  // The main button, then any others, such as the archive (v4.7.3).
  const buttons = [{ label: linkLabel, url: link }, ...moreLinks.filter(l => l && l.url && l.label)];
  let isSlack = false;
  try { isSlack = /(^|\.)slack\.com$/.test(new URL(url).hostname); } catch { /* not a url */ }
  if (isSlack) {
    const text = [`*${title}*`, ...sections.map(s => [s.label ? `*${s.label}*` : null, s.heading, s.text].filter(Boolean).join('\n')), buttons.map(b => `<${b.url}|${b.label}>`).join('  ·  ')].join('\n\n');
    return { text, blocks: [
      ...(badge ? [{ type: 'image', image_url: badge.url, alt_text: badge.alt || 'Fully Conscious' }] : []),
      { type: 'header', text: { type: 'plain_text', text: masthead || title } },
      ...(dateline ? [{ type: 'context', elements: [{ type: 'mrkdwn', text: dateline }] }] : []),
      ...(image ? [{ type: 'image', image_url: image.url, alt_text: image.alt || 'Stay Conscious' }] : []),
      ...sections.flatMap(s => [{ type: 'divider' }, { type: 'section', text: { type: 'mrkdwn', text: [s.label ? `*${s.label}*` : null, s.heading ? `*${s.heading}*` : null, s.text].filter(Boolean).join('\n') } }]),
      { type: 'actions', elements: buttons.map(b => ({ type: 'button', text: { type: 'plain_text', text: b.label }, url: b.url })) },
    ] };
  }
  // The Fully Conscious badge from the Compass home page sits above the
  // masthead (v4.7.3).
  // v4.7.5: the badge and the wordmark are sized as a share of the card's
  // width, not in pixels, so they shrink on a phone instead of being cut off.
  // A weighted column beside an empty one sets the share.
  const share = (image, weight, rest, spacing) => ({ type: 'ColumnSet', spacing, columns: [
    { type: 'Column', width: weight, verticalContentAlignment: 'Center', items: [image] },
    { type: 'Column', width: rest, items: [{ type: 'TextBlock', text: ' ', size: 'Small' }] },
  ] });
  const head = masthead ? [
    ...(badge ? [share({ type: 'Image', url: badge.url, altText: badge.alt || 'Fully Conscious', size: 'Stretch' }, 1, 4, 'None')] : []),
    // The wordmark in Inter Bold, as on the page (v4.7.4): card text tops out
    // at ExtraLarge and Bolder, which is lighter and smaller than the masthead.
    mastheadImage
      ? share({ type: 'Image', url: mastheadImage.url, altText: masthead, size: 'Stretch' }, 2, 1, badge ? 'Medium' : 'None')
      : { type: 'TextBlock', text: masthead, weight: 'Bolder', size: 'ExtraLarge', wrap: true, spacing: badge ? 'Small' : 'None' },
    ...(dateline ? [{ type: 'TextBlock', text: dateline, size: 'Small', isSubtle: true, weight: 'Bolder', spacing: 'None', wrap: true }] : []),
  ] : [{ type: 'TextBlock', text: title, weight: 'Bolder', size: 'Large', wrap: true }];
  return { type: 'message', summary: title, attachments: [{ contentType: 'application/vnd.microsoft.card.adaptive', content: {
    $schema: 'http://adaptivecards.io/schemas/adaptive-card.json', type: 'AdaptiveCard', version: '1.4',
    msteams: { width: 'Full' },
    body: [
      ...head,
      // Cropped to a wide band, as on the page, rather than shown full height.
      ...(image ? [{ type: 'Container', separator: true, spacing: 'Medium', minHeight: '190px', bleed: false,
        backgroundImage: { url: image.url, fillMode: 'Cover', horizontalAlignment: 'Center', verticalAlignment: 'Center' },
        items: [{ type: 'TextBlock', text: ' ', size: 'Small' }] }] : []),
      ...sections.map((s, i) => ({ type: 'Container', separator: true, spacing: i === 0 && !image ? 'Medium' : 'Large', items: [
        ...(s.label ? [{ type: 'TextBlock', text: s.label.toUpperCase(), size: 'Small', weight: 'Bolder', color: 'Attention', wrap: true }] : []),
        ...(s.heading ? [{ type: 'TextBlock', text: s.heading, size: 'Large', weight: 'Bolder', wrap: true, spacing: 'Small' }] : []),
        ...(s.text ? [{ type: 'TextBlock', text: s.text, wrap: true, spacing: 'Small', ...(s.strong ? { weight: 'Bolder' } : {}) }] : []),
      ] })),
    ],
    actions: buttons.map(b => ({ type: 'Action.OpenUrl', title: b.label, url: b.url })),
  } }] };
}
const leadSentence = (t) => { const v = String(t || '').split(/\n\s*\n/)[0].replace(/\s+/g, ' ').trim(); const m = v.match(/^.+?[.!?](\s|$)/); return (m ? m[0] : v).trim().slice(0, 300); };
// The issue's picture: the lead story's own image, or that week's house photo,
// the one the page shows.
export function issueImage(nl) {
  const own = nl?.leadStory?.image?.src;
  if (typeof own === 'string' && /^https:\/\//.test(own)) return { url: own, alt: nl.leadStory.image.alt || '' };
  return { url: `${SITE_URL()}${houseImageFor(nl).src}`, alt: 'Stay Conscious' };
}
export function publishedNote(nl) {
  const tp = nl?.talkingPoint;
  const sections = [
    nl?.leadStory?.headline ? { label: `${nl.leadStory.category ? `${nl.leadStory.category} · ` : ''}Lead story`, heading: nl.leadStory.headline, text: leadSentence(nl.leadStory.insight) } : null,
    tp?.point ? { label: 'Talking point of the week', heading: `If a client asks about ${tp.topic}`, text: tp.point } : null,
  ].filter(Boolean);
  return {
    title: `Stay Conscious, Issue ${nl?.issueNumber ?? ''} is out`,
    badge: { url: `${SITE_URL()}/fully-conscious-badge.png`, alt: 'Fully Conscious' },
    masthead: 'Stay Conscious',
    mastheadImage: { url: `${SITE_URL()}/newsletter/stay-conscious-wordmark.png` },
    dateline: [`ISSUE ${nl?.issueNumber ?? ''}`, nl?.weekOf ? `WEEK OF ${String(nl.weekOf).toUpperCase()}` : null].filter(Boolean).join('  ·  '),
    image: issueImage(nl),
    sections, link: `${SITE_URL()}/newsletter`, linkLabel: 'Read the issue',
    moreLinks: [{ label: 'Past issues', url: `${SITE_URL()}/newsletter?view=archive` }],
  };
}
export async function postToChannel(url, note, fetchImpl = fetch) {
  if (!url) return null;
  try {
    const r = await fetchImpl(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(channelPayload(url, note)) });
    return r.ok;
  } catch { return false; }
}

// Copies the live issue to the archive. Returns true, false (failed) or null
// (nothing live). Keyed on refreshed_at, so a retried Sunday run is a no-op.
export async function archiveIssue(row, { supabaseUrl, supabaseKey, fetchImpl = fetch }) {
  if (!row?.newsletter || !row?.refreshed_at) return null;
  try {
    const r = await fetchImpl(`${supabaseUrl}/rest/v1/stay_conscious_newsletter_archive?on_conflict=refreshed_at`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}`, Prefer: 'resolution=ignore-duplicates,return=minimal' },
      body: JSON.stringify({ issue_number: Number(row.newsletter.issueNumber) || null, newsletter: row.newsletter, refreshed_at: row.refreshed_at }),
    });
    return r.ok;
  } catch {
    return false;
  }
}

export default async function handler(req, res) {
  // Callers must be signed in (v3.100.1); see api/_auth.js.
  const caller = await requireUser(req, res, { admin: true, allowCron: true });   // admins or the scheduled run only (v3.124.2)
  if (!caller) return;
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const supabaseUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!anthropicKey || !supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Missing environment variables: ANTHROPIC_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY' });
  }

  const sbJson = { 'Content-Type': 'application/json', apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` };
  const readIssueRow = async (id) => {
    try {
      const r = await fetch(`${supabaseUrl}/rest/v1/stay_conscious_newsletter?select=*&id=eq.${id}&limit=1`, { headers: sbJson });
      return r.ok ? ((await r.json())?.[0] || null) : null;
    } catch { return null; }
  };
  const writeIssueRow = async (id, newsletter, refreshedAt = new Date().toISOString()) => {
    const r = await fetch(`${supabaseUrl}/rest/v1/stay_conscious_newsletter`, {
      method: 'POST', headers: { ...sbJson, Prefer: 'resolution=merge-duplicates' },
      body: JSON.stringify({ id, newsletter, refreshed_at: refreshedAt }),
    });
    if (!r.ok) { const err = await r.json().catch(() => ({})); throw new Error(err.message || `Supabase upsert error ${r.status}`); }
  };
  const deleteIssueRow = async (id) => fetch(`${supabaseUrl}/rest/v1/stay_conscious_newsletter?id=eq.${id}`, { method: 'DELETE', headers: sbJson }).then(r => r.ok).catch(() => false);
  // The archive id of the edition published at a given time, for its link (v4.11.0).
  const archivedEditionId = async (refreshedAt) => {
    try {
      const r = await fetch(`${supabaseUrl}/rest/v1/stay_conscious_newsletter_archive?select=id&refreshed_at=eq.${encodeURIComponent(refreshedAt)}&limit=1`, { headers: sbJson });
      return r.ok ? ((await r.json())?.[0]?.id ?? null) : null;
    } catch { return null; }
  };
  // Past issues to Smartsheet (v4.11.0): the archive, oldest first, then the
  // live issue. An issue already in the sheet with its Word file is skipped.
  const smartsheetBackfill = async ({ batch = 6 } = {}) => {
    const token = process.env.SMARTSHEET_API_TOKEN; const sheetId = process.env.SMARTSHEET_SHEET_ID;
    if (!token || !sheetId) return { success: false, error: 'Smartsheet is not set up. Add SMARTSHEET_API_TOKEN and SMARTSHEET_SHEET_ID in Vercel, then redeploy.' };
    const ss = ssFetch(token, fetch);
    let sheet;
    try { sheet = await ss(`/sheets/${sheetId}?include=attachments`); } catch (e) { return { success: false, error: String(e.message).slice(0, 200) }; }
    const col = Object.fromEntries((sheet.columns || []).map(c => [c.title, c.id]));
    const done = new Set((sheet.rows || []).filter(r => (r.attachments || []).length).map(r => Number((r.cells || []).find(c => c.columnId === col.Issue)?.value)).filter(Boolean));
    const arch = await fetch(`${supabaseUrl}/rest/v1/stay_conscious_newsletter_archive?select=id,refreshed_at,newsletter&order=refreshed_at.asc`, { headers: sbJson }).then(r => (r.ok ? r.json() : [])).catch(() => []);
    const live = await readIssueRow(LIVE_ID);
    const all = [...arch.map(r => ({ nl: r.newsletter, publishedAt: r.refreshed_at, link: `${SITE_URL()}/newsletter?issue=${r.id}` })),
      ...(live?.newsletter ? [{ nl: live.newsletter, publishedAt: live.refreshed_at, link: `${SITE_URL()}/newsletter` }] : [])]
      .filter(x => Number(x.nl?.issueNumber));
    // One row per issue: when an issue number appears twice, the latest copy wins.
    const byIssue = new Map(); all.forEach(x => byIssue.set(Number(x.nl.issueNumber), x));
    const todo = [...byIssue.values()].filter(x => !done.has(Number(x.nl.issueNumber)));
    const results = [];
    for (const x of todo.slice(0, batch)) {
      const r = await syncIssueToSmartsheet(x.nl, { publishedAt: x.publishedAt, link: x.link, token, sheetId });
      results.push({ issue: Number(x.nl.issueNumber), ok: r.ok, reason: r.reason });
    }
    return { success: results.every(r => r.ok), copied: results.filter(r => r.ok).length, failed: results.filter(r => !r.ok), remaining: Math.max(0, todo.length - results.filter(r => r.ok).length), total: byIssue.size };
  };

  // Review actions on the draft (v4.7.0). The schedule may only publish.
  const action = String(req.query?.action || req.body?.action || '').toLowerCase();
  if (action) {
    if (caller.cron && action !== 'publish') return res.status(403).json({ error: 'The schedule can only publish.' });
    try {
      // Copy past issues to Smartsheet (v4.11.0): admins, a few at a time so
      // each call stays well inside the time limit. The page repeats it until
      // nothing is left; issues already there with their file are skipped.
      if (action === 'smartsheet-backfill') {
        return res.status(200).json(await smartsheetBackfill({ batch: 6 }));
      }
      const draftRow = await readIssueRow(DRAFT_ID);
      if (!draftRow?.newsletter) return res.status(200).json({ success: true, draft: false, published: false, reason: 'There is no draft.' });
      const meta = draftRow.newsletter._draft || {};
      if (action === 'publish') {
        if (caller.cron && meta.held) return res.status(200).json({ success: true, published: false, reason: 'The draft is held.' });
        const liveRow = await readIssueRow(LIVE_ID);
        const archived = meta.weekly ? await archiveIssue(liveRow, { supabaseUrl, supabaseKey }) : null;
        const published = withoutDashes(stripDraft(draftRow.newsletter));   // no em dashes, edits included (v4.9.0)
        const publishedAt = new Date().toISOString();
        await writeIssueRow(LIVE_ID, published, publishedAt);
        await deleteIssueRow(DRAFT_ID);
        const posted = await postToChannel(process.env.NEWSLETTER_WEBHOOK_URL, publishedNote(published));
        // The Smartsheet copy (v4.11.0): this issue's row, then the replaced
        // issue's link moves to its archived edition. Never blocks the publish.
        const smartsheet = await syncIssueToSmartsheet(published, { publishedAt, link: `${SITE_URL()}/newsletter`, check: meta.check || null });
        if (archived && !smartsheet.skipped) {
          const id = await archivedEditionId(liveRow.refreshed_at);
          if (id) await syncIssueToSmartsheet(liveRow.newsletter, { link: `${SITE_URL()}/newsletter?issue=${id}`, attach: false });
        }
        return res.status(200).json({ success: true, published: true, issueNumber: published.issueNumber, archived, posted, smartsheet });
      }
      if (action === 'hold' || action === 'release') {
        await writeIssueRow(DRAFT_ID, { ...draftRow.newsletter, _draft: { ...meta, held: action === 'hold' } }, draftRow.refreshed_at);
        return res.status(200).json({ success: true, held: action === 'hold' });
      }
      if (action === 'save-draft') {
        const edited = applyDraftEdits(draftRow.newsletter, req.body?.edits);
        await writeIssueRow(DRAFT_ID, { ...edited, _draft: { ...meta, editedAt: new Date().toISOString() } }, draftRow.refreshed_at);
        return res.status(200).json({ success: true, saved: true });
      }
      if (action === 'discard') {
        await deleteIssueRow(DRAFT_ID);
        return res.status(200).json({ success: true, discarded: true });
      }
      return res.status(400).json({ error: `Unknown action: ${action}` });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  const fetchTable = async (table, id = null) => {
    const r = await fetch(
      `${supabaseUrl}/rest/v1/${table}?select=*${id ? `&id=eq.${id}` : ''}&order=refreshed_at.desc&limit=1`,
      { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } }
    );
    if (!r.ok) return null;
    const rows = await r.json();
    return rows?.[0] || null;
  };

  // Portfolio average out of 100 from full assessments (compass_results), for
  // a landscape cache written before it stored averageScore (v3.103.0). Null
  // when there is nothing to average, so the page hides the numeral rather
  // than show an invented one.
  const portfolioAverage = async () => {
    try {
      const r = await fetch(`${supabaseUrl}/rest/v1/compass_results?select=brand_name,total_score,created_at`, {
        headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` },
      });
      if (!r.ok) return null;
      const rows = latestPerBrand(await r.json()).map(x => Number(x.total_score)).filter(Number.isFinite);
      return rows.length ? Math.round(rows.reduce((a, b) => a + b, 0) / rows.length) : null;
    } catch {
      return null;
    }
  };

  const sbHeaders = { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` };
  // What the figure checks found, for the draft panel (v4.10.0).
  const figureReport = [];
  const ask = async (prompt, maxTokens, temperature = 0) => {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': anthropicKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: maxTokens, temperature, messages: [{ role: 'user', content: prompt }] }),
    });
    if (!r.ok) return null;
    const d = await r.json();
    return (d.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
  };
  const getRows = async (path) => { try { const r = await fetch(`${supabaseUrl}/rest/v1/${path}`, { headers: sbHeaders }); return r.ok ? await r.json() : []; } catch { return []; } };
  // Prospect pulse and Spotlight (v4.6.0). Either is left out on any failure.
  const buildPulseAndSpotlight = async (live) => {
    const now = new Date();
    const [teasers, fullAll, recentArch] = await Promise.all([
      getRows(`teaser_assessments?select=industry,created_at,result&created_at=gte.${encodeURIComponent(monthStart(now))}`),
      getRows('compass_results?select=brand_name,total_score,scores,created_at'),
      getRows('stay_conscious_newsletter_archive?select=sp:newsletter->spotlight->>attribute&order=refreshed_at.desc&limit=2'),
    ]);
    const fullRows = latestPerBrand(fullAll);
    const pulse = prospectPulse(teasers, fullRows, now);
    const recent = [live?.newsletter?.spotlight?.attribute, ...recentArch.map(r => r?.sp)].filter(Boolean);
    const pick = pickSpotlightAttribute(fullRows, recent);
    let spotlight = null;
    if (pick) {
      try {
        // Every figure must be one of ours (v4.10.0): written again once, then left out.
        const allowed = spotlightFigures(pick);
        const bad = (sp) => unsupportedNumbers([sp.headline, sp.action, sp.why, ...(sp.steps || [])].join(' '), allowed);
        spotlight = parseSpotlight(await ask(spotlightPrompt(pick), 700), pick);
        let outcome = spotlight ? 'kept' : 'not written';
        if (spotlight && bad(spotlight).length) {
          const first = bad(spotlight);
          spotlight = parseSpotlight(await ask(spotlightPrompt(pick, { strict: true }), 700), pick);
          outcome = spotlight && !bad(spotlight).length ? 'rewritten' : 'dropped';
          if (outcome === 'dropped') spotlight = null;
          figureReport.push({ section: 'Spotlight', outcome, figures: first });
        } else if (outcome === 'kept') figureReport.push({ section: 'Spotlight', outcome, figures: [] });
      } catch { spotlight = null; }
    }
    return { prospectPulse: pulse, spotlight };
  };

  // Every figure in the talking point must be in the story it draws on (v4.10.0).
  const writeTalkingPoint = async (stories) => {
    try {
      const bad = (tp) => {
        const st = stories.find(s => s.headline === tp.story);
        const source = (st ? [st] : stories).map(s => [s.headline, s.insight, s.whyItMatters].join(' ')).join(' ');
        return unsupportedNumbers(tp.point, figuresIn(source));
      };
      let tp = parseTalkingPoint(await ask(talkingPointPrompt(stories), 300), stories);
      if (tp && bad(tp).length) {
        const first = bad(tp);
        tp = parseTalkingPoint(await ask(talkingPointPrompt(stories, { strict: true }), 300), stories);
        const ok = tp && !bad(tp).length;
        figureReport.push({ section: 'Talking point', outcome: ok ? 'rewritten' : 'dropped', figures: first });
        return ok ? tp : null;
      }
      if (tp) figureReport.push({ section: 'Talking point', outcome: 'kept', figures: [] });
      return tp;
    } catch { return null; }
  };

  // The topics that led the live issue and the two before it (v4.8.0).
  const recentLeadCategories = async () => {
    const live = await readIssueRow(LIVE_ID);
    const arch = await getRows('stay_conscious_newsletter_archive?select=c:newsletter->leadStory->>category&order=refreshed_at.desc&limit=2');
    return [live?.newsletter?.leadStory?.category, ...arch.map(r => r?.c)].filter(Boolean);
  };

  // Brands in the earned creative section of the live issue and the last
  // eight archived editions (v4.5.0).
  const recentlyFeaturedBrands = async (live) => {
    const brands = (live?.newsletter?.earnedCreative?.items || []).map(e => e?.brand);
    try {
      const r = await fetch(`${supabaseUrl}/rest/v1/stay_conscious_newsletter_archive?select=ec:newsletter->earnedCreative->items&order=refreshed_at.desc&limit=8`,
        { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } });
      if (r.ok) (await r.json()).forEach(row => (Array.isArray(row?.ec) ? row.ec : []).forEach(e => brands.push(e?.brand)));
    } catch { /* no archive yet */ }
    return [...new Set(brands.filter(Boolean))];
  };

  try {
    // Pull all three caches in parallel
    const [scRow, reportRow, laRow, iaRow] = await Promise.all([
      fetchTable('stay_conscious_cache', 1),
      fetchTable('stay_conscious_cache', 2),   // the fact-check report (v4.10.0)
      fetchTable('landscape_analysis_cache'),
      fetchTable('insights_analysis_cache'),
    ]);

    // Only fact-checked stories go in (v4.10.0). With none, there is no draft
    // and nothing is posted; the current issue simply stays up.
    const storyCheck = storyCheckState(scRow, reportRow);
    if (!storyCheck.items.length) {
      const error = scRow?.items?.length ? 'No fact-checked stories yet, so there is no draft. The current issue stays up.' : 'The Stay Conscious cache is empty. Run the other refreshes first.';
      return res.status(200).json({ success: false, error, factCheck: storyCheck.report || null });
    }

    const intelligenceItems = storyCheck.items;
    const landscapeAnalysis = laRow?.analysis || null;
    const storyOpportunities = iaRow?.stories || null;

    // The lead (v4.8.0): the most significant fresh story (the stories come
    // ranked) whose topic has not led any of the last three issues. Follow-ups
    // to earlier coverage sit among the other stories (v4.5.0).
    const recentLeads = await recentLeadCategories();
    const leadItem = pickLead(intelligenceItems, recentLeads);
    const supportingItems = intelligenceItems.filter(i => i !== leadItem);

    // The live issue (row 1, never the draft) and any draft waiting (v4.7.0).
    // A weekly draft takes the next number; a Force refresh with no weekly
    // draft waiting is a revision of the current issue and keeps its number.
    // Cap: if prevIssue is suspiciously large (>52, i.e. from old epoch calc), reset to 0.
    const prevRow = await readIssueRow(LIVE_ID);
    const waiting = await readIssueRow(DRAFT_ID);
    const weekly = !!caller.cron || !!waiting?.newsletter?._draft?.weekly;
    const rawPrev = prevRow?.newsletter?.issueNumber || 0;
    const prevIssue = rawPrev > 52 ? 0 : rawPrev;
    const issueNumber = weekly || !prevIssue ? prevIssue + 1 : prevIssue;

    // Generate landscape headline + two-paragraph summary directly here,
    // regardless of what the cache contains. This is more reliable than
    // depending on the landscape refresh prompt having run correctly.
    let landscapeForNewsletter = null;
    if (landscapeAnalysis?.summary) {
      const combinedText = [landscapeAnalysis.summary, landscapeAnalysis.insights].filter(Boolean).join('\n\n');
      // What the last three issues said, and what moved since last week (v4.6.0).
      const recentArch = await getRows('stay_conscious_newsletter_archive?select=la:newsletter->landscapeAnalysis&order=refreshed_at.desc&limit=2');
      const recent = [prevRow?.newsletter?.landscapeAnalysis, ...recentArch.map(r => r?.la)].filter(r => r && (r.headline || r.summary)).slice(0, 3);
      const scored = latestPerBrand(await getRows('compass_results?select=brand_name,industry,total_score,scores,created_at'));
      const snapshot = landscapeSnapshot(scored);
      const changes = landscapeChanges(snapshot, prevRow?.newsletter?.landscapeAnalysis?.snapshot);
      const lens = landscapeLens(issueNumber);
      // The figures the landscape may use, all computed from the scores (v4.10.0).
      const allowed = landscapeFigures(scored);
      [snapshot.brandCount, snapshot.averageScore, ...Object.values(snapshot.attributes || {}), landscapeAnalysis.brandCount, landscapeAnalysis.sectorCount, landscapeAnalysis.averageScore]
        .filter(Number.isFinite).forEach(n => allowed.add(String(n)));
      changes.forEach(c => numbersIn(c).forEach(n => allowed.add(n)));
      const figures = figureListForPrompt(allowed);

      const write = async (retry, strict = false) => {
        const hlRes = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': anthropicKey, 'anthropic-version': '2023-06-01' },
          body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 700, temperature: 0.4, messages: [{ role: 'user', content: landscapePrompt(combinedText, { recent, lens, changes, retry, figures, strict }) }] }),
        });
        if (!hlRes.ok) return null;
        const hlData = await hlRes.json();
        const hlText = (hlData.content?.filter(b => b.type === 'text').map(b => b.text).join('\n') || '').trim();
        const hlMatch = hlText.match(/^HEADLINE:\s*(.+)$/m);
        return {
          headline: hlMatch ? hlMatch[1].replace(/^["'*#\s]+|["'*#\s]+$/g, '').trim() : '',
          // Everything after the HEADLINE: line is the two-paragraph summary
          summary: hlText.replace(/^HEADLINE:.*$/m, '').trim(),
        };
      };
      let draft = await write(false);
      if (draft && tooSimilarLandscape(draft, recent)) draft = (await write(true)) || draft;
      // Any figure the code did not compute: written again once, then left out (v4.10.0).
      const offList = (d) => unsupportedNumbers(`${d?.headline || ''} ${d?.summary || ''}`, allowed);
      let outcome = 'kept'; const first = draft ? offList(draft) : [];
      if (draft && first.length) {
        draft = await write(true, true);
        outcome = draft && !offList(draft).length ? 'rewritten' : 'dropped';
        if (outcome === 'dropped') draft = { headline: '', summary: '' };
      }
      // With no draft at all, the analysis itself, if its figures are ours.
      const fallback = !draft && !unsupportedNumbers(combinedText, allowed).length ? combinedText : '';
      if (!draft) outcome = fallback ? 'kept' : 'dropped';
      figureReport.push({ section: 'Landscape', outcome, figures: first });
      const headline = draft?.headline || '';
      const twoParaSummary = draft ? draft.summary : fallback;

      landscapeForNewsletter = {
        headline: titleCaseAttributes(headline),
        summary: titleCaseAttributes(twoParaSummary),
        snapshot, lens,   // internal: next week's comparison (v4.6.0)
        brandCount: landscapeAnalysis.brandCount || null,
        sectorCount: landscapeAnalysis.sectorCount || null,
        averageScore: Number.isFinite(landscapeAnalysis.averageScore) ? landscapeAnalysis.averageScore : await portfolioAverage(),
      };
    }

    const newsletter = {
      issueNumber,
      // Saved with the issue so it never changes later (v4.9.0).
      houseImage: houseImageForDraft(issueNumber, [waiting?.newsletter, prevRow?.newsletter]),
      weekOf: new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),   // US English (v3.103.0)
      leadStory: {
        category: leadItem.category,
        headline: leadItem.headline,
        insight: leadItem.insight,
        whyItMatters: leadItem.whyItMatters,
        ...(leadItem.followUp ? { followUp: leadItem.followUp } : {}),   // v4.5.0
        ...(Array.isArray(leadItem.sources) ? { sources: leadItem.sources } : {}),   // v4.7.0
      },
      intelligenceItems: supportingItems,
      landscapeAnalysis: landscapeForNewsletter,
      ...(await buildPulseAndSpotlight(prevRow)),   // v4.6.0
      talkingPoint: await writeTalkingPoint([leadItem, ...supportingItems]),   // v4.7.0
      storyOpportunities: storyOpportunities || null,
      // Earned creative in the news (v3.124.0); null when none could be sourced.
      earnedCreative: withCarryOver(await fetchEarnedCreative(anthropicKey, { featured: await recentlyFeaturedBrands(prevRow) }), prevRow?.newsletter?.earnedCreative, prevRow?.newsletter?.issueNumber || null),
    };

    // Written as a draft for review (v4.7.0). The issue it will replace is
    // archived when a weekly draft is published, not now (v4.2.0 rule kept:
    // one edition a week, as it stood at the end of the week).
    // No em dashes in anything the issue says (v4.9.0).
    // The fact-check report rides with the draft for the review panel; it is
    // removed on publish with the rest of _draft (v4.10.0).
    const check = {
      stories: storyCheck.report?.stories || [], passed: storyCheck.items.length,
      earnedCreative: newsletter.earnedCreative?.carriedFrom ? [] : (newsletter.earnedCreative?.status?.factCheck || []),
      figures: figureReport,
    };
    await writeIssueRow(DRAFT_ID, { ...withoutDashes(newsletter), _draft: { weekly, held: false, check, createdAt: new Date().toISOString(), by: caller.cron ? 'schedule' : (caller.email || 'admin') } });
    const reviewPosted = caller.cron ? await postToChannel(process.env.NEWSLETTER_REVIEW_WEBHOOK_URL, {
      title: `Stay Conscious, Issue ${issueNumber} is ready for review`,
      sections: [{ text: 'It publishes on Monday morning unless it is held. Review it on the newsletter page in the Compass.' }],
      link: SITE_URL(), linkLabel: 'Review the draft',
    }) : null;

    return res.status(200).json({
      success: true,
      draft: true,
      weekly,
      issueNumber,
      factCheck: { storiesPassed: check.passed, earnedCreativeKept: check.earnedCreative.filter(r => r.outcome === 'kept').length, figures: figureReport },
      reviewPosted,
      refreshedAt: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Newsletter refresh failed:', error);
    return res.status(500).json({ error: error.message });
  }
}
