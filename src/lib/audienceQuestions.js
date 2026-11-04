// ─────────────────────────────────────────────────────────────
// AUDIENCE QUESTIONS (v4.15.0)
//
// What the brand's audience is actually asking, and the content that would
// answer it. A recommendation layer: it never changes a score, so the
// framework version does not move.
//
// The method:
//   1. The model reads the brand's homepage, names its niche (v4.15.2), then
//      names 4 or 5 subtopics of that niche, each as a plain search a buyer
//      would type. Niche searches, not brand searches: the point is what the
//      audience asks, not what it asks about this brand.
//   2. Google's "People also ask" questions are harvested for each subtopic
//      through SerpApi, then the strongest of them are expanded one level to
//      pull the next questions in the chain.
//   3. The model checks those questions against the brand's pages and writes
//      content ideas for the gaps. Every idea must cite questions from the
//      harvest by id. An idea citing none is dropped in code: no idea exists
//      without real demand behind it.
//
// Integrity rules this module enforces:
// - Questions come from Google only. The model never writes a question.
// - Fewer real questions means fewer ideas, never invented ones.
// - Teasers read two or three pages, so a teaser's gaps are "likely" gaps.
// - Only the whitelisted client payload reaches a client or prospect: the
//   subtopic queries, answer snippets, search counts and errors stay inside.
// ─────────────────────────────────────────────────────────────

import { ATTRIBUTES } from '../data/rubric.js';
import { stagePromptBlock } from '../data/stages.js';
import { sectorPromptBlock } from '../data/sectorProfiles.js';
import { loadJSZip } from './lazyZip.js';

export const AQ_VERSION = '1.0';

// Results are geo-dependent. US by default; the endpoint accepts others.
export const AQ_LOCATION = { gl: 'us', hl: 'en', label: 'United States' };

// Searches per run, held to these caps so a month of runs fits the plan.
// Teaser: 4 subtopics + 4 expansions = 8. Full: 5 + 10 = 15.
export const AQ_MODES = {
  teaser: { subtopics: 4, expandPer: 1, minIdeas: 5, maxIdeas: 5, maxQuestions: 30 },
  full:   { subtopics: 5, expandPer: 2, minIdeas: 5, maxIdeas: 10, maxQuestions: 45 },
};
export const searchBudget = (mode) => {
  const m = AQ_MODES[mode] || AQ_MODES.full;
  return m.subtopics * (1 + m.expandPer);
};

export const GAPS = ['missing', 'thin', 'answered'];
export const GAP_LABEL = {
  full:   { missing: 'Not on the site', thin: 'Touched on, not answered', answered: 'Answered, could go further' },
  teaser: { missing: 'Not on main pages', thin: 'Touched on, not answered', answered: 'Answered, could go further' },
};
// Where the questions come from, said so nobody reads "Google People" as a
// thing: People also ask is the box of related questions in Google results.
export const aqSource = (location = AQ_LOCATION.label) => `Source: the \u201cPeople also ask\u201d questions in Google search, ${location}`;

export const FORMATS = ['Short video', 'Carousel', 'Article', 'Explainer', 'FAQ page', 'Data post', 'Thread', 'Webinar', 'Guide', 'Case study'];

export const AQ_COPY = {
  title: "What this brand's audience is asking",
  // Before a run, when there is no niche yet.
  intro: 'The questions people are asking Google about this brand\u2019s niche, and the content that would answer them.',
  notConfigured: 'Audience questions need the SerpApi key. Add SERPAPI_API_KEY in Vercel and redeploy.',
  none: 'Google returned too few questions about this niche to build ideas on. Nothing has been invented to fill the gap.',
};

const clean = (v, n = 300) => String(v ?? '').replace(/\s*[—–]\s*/g, ', ').replace(/\s+/g, ' ').trim().slice(0, n);
const normQ = (q) => String(q || '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
const ATTR_IDS = ATTRIBUTES.map(a => a.id);
const attrName = (id) => ATTRIBUTES.find(a => a.id === id)?.name || id;

const jsonFrom = (raw) => {
  const text = String(raw || '').replace(/```json|```/g, '');
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('The model returned no JSON.');
  try { return JSON.parse(match[0]); } catch { throw new Error('The model returned malformed JSON.'); }
};

const brandLine = (input) =>
  `The brand is ${input.brandName} (${input.websiteUrl}), a ${String(input.businessModel || '').toUpperCase() || 'B2B'} business${input.industryName ? ` in ${input.industryName}` : ''}.`;

const pagesBlock = (siteText, cap = 9000) => {
  const t = String(siteText || '').trim();
  if (!t) return 'BRAND PAGES: unavailable. Work from the brand line only.';
  return `BRAND PAGES (scraped text):\n${t.length > cap ? `${t.slice(0, cap)}... [truncated]` : t}`;
};

// ── Step 1: subtopics ─────────────────────────────────────────

// Stages that sell across countries are searched in more than the US
// (v4.16.0). The model names the markets from the homepage; code keeps only
// real Google country codes, at most two besides the US.
export const MULTI_MARKET_STAGES = ['multinational', 'conglomerate', 'global'];
export const GL_CODES = ['us', 'gb', 'ca', 'au', 'nz', 'ie', 'de', 'fr', 'es', 'it', 'nl', 'be', 'ch', 'at', 'se', 'no', 'dk', 'fi', 'pl', 'pt', 'cz', 'gr', 'tr', 'il', 'ae', 'sa', 'za', 'ng', 'ke', 'eg', 'in', 'sg', 'my', 'id', 'ph', 'th', 'vn', 'jp', 'kr', 'cn', 'hk', 'tw', 'mx', 'br', 'ar', 'cl', 'co', 'pe'];
export const isMultiMarket = (stage) => MULTI_MARKET_STAGES.includes(stage);
export function marketsFor(stage, suggested = []) {
  if (!isMultiMarket(stage)) return ['us'];
  const extra = [...new Set((Array.isArray(suggested) ? suggested : []).map(c => String(c || '').trim().toLowerCase()).map(c => (c === 'uk' ? 'gb' : c)))]
    .filter(c => c !== 'us' && GL_CODES.includes(c)).slice(0, 2);
  return ['us', ...extra];
}

export function buildSubtopicPrompt(input, siteText, mode = 'full') {
  const n = (AQ_MODES[mode] || AQ_MODES.full).subtopics;
  const markets = isMultiMarket(input.stage);
  return `${brandLine(input)}

First, read the brand's HOMEPAGE (the first page below) and name its niche: the specific market it serves, as its own buyers would describe it. Specific, not a broad category: "rooftop solar for New Jersey homeowners", not "renewable energy"; "grid analytics software for utilities", not "software". Write it to follow the word "about" in a sentence, in lowercase unless a word is a proper noun, under 9 words, no brand name.

Then name ${n} subtopics of that niche its buyers research before they buy.

For each subtopic, write the plain search a buyer would type into Google. Rules:
- Niche searches, never the brand's name or a competitor's name. We want what the niche's audience asks, not what it asks about this brand.
- Short and natural, 2 to 6 words, the way a person types: "heat pump installation cost", "what is community solar", "office leasing for startups".
- Spread across the buying journey: what it is, whether it is worth it, how to choose, cost, and the doubts people have.
- Specific to this brand's actual offer and audience. A B2B grid software company's buyers search differently from homeowners.

${markets ? `Also name up to two countries other than the United States where the homepage shows the brand clearly sells: country pages, local offices, prices in a local currency, a language switcher. Two-letter country codes ("gb", "de", "jp"). If the homepage shows none, return an empty list.

` : ''}${pagesBlock(siteText)}

Return valid JSON only, no prose, no fences:
{ "niche": "the niche, under 9 words", "subtopics": [ { "name": "under 5 words", "query": "the search" } ]${markets ? ', "markets": ["gb"]' : ''} }`;
}

export function parseSubtopics(raw, brandName = '', max = 5) {
  const parsed = jsonFrom(raw);
  const brand = normQ(brandName);
  const seen = new Set();
  const subtopics = (Array.isArray(parsed.subtopics) ? parsed.subtopics : [])
    .map(s => ({ name: clean(s?.name, 60), query: clean(s?.query, 120) }))
    .filter(s => s.query && s.name)
    // A brand search would measure reputation, not category demand.
    .filter(s => !brand || !normQ(s.query).includes(brand))
    .filter(s => !seen.has(normQ(s.query)) && seen.add(normQ(s.query)))
    .slice(0, max);
  if (!subtopics.length) throw new Error('No usable subtopics came back.');
  return { niche: clean(parsed.niche || parsed.category, 90).replace(/[.\s]+$/, ''), subtopics, markets: Array.isArray(parsed.markets) ? parsed.markets : [] };
}

// ── Step 2: harvest ───────────────────────────────────────────

export class NotConfiguredError extends Error {
  constructor() { super(AQ_COPY.notConfigured); this.notConfigured = true; }
}

// One call to the endpoint. Shared with search evidence (v4.16.0).
export async function serpCall(params, fetchImpl) {
  const qs = new URLSearchParams({ gl: AQ_LOCATION.gl, hl: AQ_LOCATION.hl, ...params });
  const r = await fetchImpl(`/api/audience-questions?${qs}`);
  const body = await r.json().catch(() => ({}));
  if (body.notConfigured) throw new NotConfiguredError();
  if (!r.ok) throw new Error(body.error || `Google search failed (HTTP ${r.status}).`);
  return body;
}

// Runs every subtopic search, then expands the first `expandPer` questions of
// each that carry a token. Duplicate questions are kept once, under the
// subtopic that found them first. A failed search is recorded and the rest
// carry on; a missing key stops the whole run.
export async function harvestQuestions(subtopics, { fetchImpl, mode = 'full' } = {}) {
  const m = AQ_MODES[mode] || AQ_MODES.full;
  const questions = [];
  const seen = new Set();
  const failures = [];
  let searches = 0;
  const add = (q, subtopic, depth) => {
    const text = clean(q?.question, 200);
    const key = normQ(text);
    if (!text || seen.has(key) || questions.length >= m.maxQuestions) return null;
    seen.add(key);
    const entry = { id: `q${questions.length + 1}`, question: text, subtopic, depth, snippet: clean(q?.snippet, 280), source: clean(q?.source, 80), link: String(q?.link || '').slice(0, 300) };
    questions.push(entry);
    return { ...entry, token: q?.token || null };
  };

  const first = await Promise.allSettled(subtopics.map(s => { searches += 1; return serpCall({ q: s.query }, fetchImpl); }));
  if (first.some(r => r.status === 'rejected' && r.reason?.notConfigured)) throw new NotConfiguredError();

  const toExpand = [];
  // Page one and the AI Overview of each niche search, kept for search
  // evidence (v4.16.0): niche ranking and AI Overview citations cost nothing.
  const serps = [];
  first.forEach((res, i) => {
    const sub = subtopics[i].name;
    if (res.status !== 'fulfilled') { failures.push({ query: subtopics[i].query, error: String(res.reason?.message || res.reason) }); return; }
    const body = res.value || {};
    serps.push({ query: subtopics[i].query, name: sub, organic: Array.isArray(body.organic) ? body.organic : [], aiOverview: body.aiOverview || { present: false, token: null, sources: [] } });
    const added = (Array.isArray(body.questions) ? body.questions : []).map(q => add(q, sub, 0)).filter(Boolean);
    added.filter(q => q.token).slice(0, m.expandPer).forEach(q => toExpand.push({ token: q.token, sub }));
  });

  const second = await Promise.allSettled(toExpand.map(x => { searches += 1; return serpCall({ token: x.token }, fetchImpl); }));
  second.forEach((res, i) => {
    if (res.status !== 'fulfilled') { failures.push({ query: 'expansion', error: String(res.reason?.message || res.reason) }); return; }
    (Array.isArray(res.value?.questions) ? res.value.questions : []).forEach(q => add(q, toExpand[i].sub, 1));
  });

  return { questions, searches, failures, serps };
}

// ── Step 3: ideas ─────────────────────────────────────────────

export function buildIdeasPrompt(input, harvest, siteText, mode = 'full') {
  const m = AQ_MODES[mode] || AQ_MODES.full;
  const range = m.minIdeas === m.maxIdeas ? `exactly ${m.maxIdeas}` : `between ${m.minIdeas} and ${m.maxIdeas}`;
  return `${brandLine(input)}

Below are real questions people search about this brand's niche, harvested from Google's "People also ask", each with an id. Check them against the brand's pages, then write content ideas that would answer the questions the brand is not answering.

${pagesBlock(siteText)}

QUESTIONS (id, subtopic, question):
${harvest.questions.map(q => `${q.id} | ${q.subtopic} | ${q.question}`).join('\n')}

${stagePromptBlock(input.stage)}

${sectorPromptBlock(input.industry, input.industryName)}

RULES:
- Write ${range} ideas. If the questions only support fewer real ideas, write fewer. Never pad.
- Every idea answers one to three of the questions above, cited by id in "questionIds". Group questions that one piece could answer together. Never invent a question and never cite an id that is not listed.
- "gap" is what the brand's pages show for those questions: "missing" (not addressed), "thin" (mentioned without a real answer) or "answered" (answered well). ${mode === 'teaser' ? 'Only two or three pages were read, so judge from what is there and do not claim the whole site lacks it.' : ''} Prefer missing and thin. Use "answered" only when there are not enough gaps, and then the idea takes an answer further.
- Only questions this brand has standing to answer. Skip questions about things it does not do.
- Fit the stage and the sector. A startup gets ideas a small team can make. Real estate and B2B buyers want precise, useful answers, not provocation.
- "title" is the working title of the piece, written as the audience would want to read it. Under 12 words.
- "format" is one of: ${FORMATS.join(', ')}. "channel" is where it should live first (LinkedIn, Instagram, TikTok, YouTube, the brand's site, an email newsletter, and so on), chosen for this audience.
- "attribute" is the one Compass attribute answering it would most strengthen: ${ATTR_IDS.join(', ')}.
- "why" is one sentence, under 30 words: why this audience needs this answer from this brand now.
- "earnedCreative" is true only when the answer could be staged as something people talk about, not just read: original data, a public demonstration, a stunt with a point. Most ideas are false.

Return valid JSON only, no prose, no fences:
{ "ideas": [ { "title": "", "questionIds": ["q1"], "gap": "missing|thin|answered", "format": "", "channel": "", "attribute": "", "why": "", "earnedCreative": false } ] }`;
}

const GAP_ORDER = { missing: 0, thin: 1, answered: 2 };

export function parseIdeas(raw, harvest, mode = 'full') {
  const m = AQ_MODES[mode] || AQ_MODES.full;
  const parsed = jsonFrom(raw);
  const ids = new Set(harvest.questions.map(q => q.id));
  const titles = new Set();
  return (Array.isArray(parsed.ideas) ? parsed.ideas : [])
    .map(i => ({
      title: clean(i?.title, 120),
      // Real questions only. An idea with none left is dropped below.
      questionIds: [...new Set((Array.isArray(i?.questionIds) ? i.questionIds : []).map(x => String(x).trim()).filter(x => ids.has(x)))].slice(0, 3),
      gap: GAPS.includes(i?.gap) ? i.gap : 'thin',
      format: FORMATS.find(f => f.toLowerCase() === String(i?.format || '').trim().toLowerCase()) || 'Article',
      channel: clean(i?.channel, 40),
      attribute: ATTR_IDS.includes(String(i?.attribute || '').trim().toUpperCase()) ? String(i.attribute).trim().toUpperCase() : null,
      why: clean(i?.why, 220),
      earnedCreative: i?.earnedCreative === true,
    }))
    .filter(i => i.title && i.questionIds.length)
    .filter(i => !titles.has(i.title.toLowerCase()) && titles.add(i.title.toLowerCase()))
    .sort((a, b) => GAP_ORDER[a.gap] - GAP_ORDER[b.gap])
    .slice(0, m.maxIdeas);
}

// ── The run ───────────────────────────────────────────────────

// The harvest on its own: niche, subtopics, questions, and each niche
// search's page one and AI Overview. Full assessments gather this before
// scoring (v4.16.0) and write the ideas from it afterwards.
// Never throws: a failure is a record with status 'failed' or 'notConfigured'.
export async function harvestAudience(input, { siteText = '', mode = 'full', fetchImpl, callModel }) {
  const started = Date.now();
  const base = { version: AQ_VERSION, mode, location: AQ_LOCATION.label, gatheredAt: new Date().toISOString() };
  try {
    const m = AQ_MODES[mode] || AQ_MODES.full;
    // Free check first, so a missing key costs no model call.
    const ping = await fetchImpl('/api/audience-questions?ping=1');
    const pb = await ping.json().catch(() => ({}));
    if (pb.notConfigured) throw new NotConfiguredError();
    if (!ping.ok) throw new Error(pb.error || `Question search is unavailable (HTTP ${ping.status}).`);
    const { niche, subtopics, markets } = parseSubtopics(await callModel(buildSubtopicPrompt(input, siteText, mode)), input.brandName, m.subtopics);
    const harvest = await harvestQuestions(subtopics, { fetchImpl, mode });
    return {
      ...base, niche, subtopics, markets: marketsFor(input.stage, markets),
      questions: harvest.questions, serps: harvest.serps, searches: harvest.searches, failures: harvest.failures,
      status: harvest.questions.length < 5 ? 'thin' : 'ok', ideas: [], ms: Date.now() - started,
    };
  } catch (err) {
    return { ...base, status: err?.notConfigured ? 'notConfigured' : 'failed', error: String(err?.message || err), ideas: [], questions: [], serps: [], markets: ['us'], ms: Date.now() - started };
  }
}

// The ideas from a stored harvest. No searches. The record that comes back
// is the audience questions record the reports read; the harvest's page one
// results stay with the search evidence, not here.
export async function ideasFromHarvest(input, harvested, { siteText = '', mode = 'full', callModel }) {
  const { serps: _serps, markets: _markets, ...rec } = harvested || {};
  if (!harvested || harvested.status !== 'ok') return { ...rec, ideas: [] };
  const started = Date.now();
  try {
    const ideas = parseIdeas(await callModel(buildIdeasPrompt(input, harvested, siteText, mode)), harvested, mode);
    return { ...rec, status: ideas.length ? 'ok' : 'thin', ideas, ms: (harvested.ms || 0) + Date.now() - started };
  } catch (err) {
    return { ...rec, status: 'failed', error: String(err?.message || err), ideas: [] };
  }
}

// Harvest and ideas in one go, as teasers and an on-demand run use it.
// Never throws. With keepSerps, the page one data stays on the record for
// search evidence to read.
export async function runAudienceQuestions(input, { siteText = '', mode = 'full', fetchImpl, callModel, keepSerps = false }) {
  const harvested = await harvestAudience(input, { siteText, mode, fetchImpl, callModel });
  const out = await ideasFromHarvest(input, harvested, { siteText, mode, callModel });
  return { ...out, markets: harvested.markets || ['us'], ...(keepSerps ? { serps: harvested.serps || [] } : {}) };
}

// ── Views ─────────────────────────────────────────────────────

// The niche as it reads after "about". Records from before v4.15.2 hold a
// capitalised category instead, so its first letter drops unless the start
// is an acronym or a proper noun the model wrote that way on purpose.
export function nicheText(record) {
  const n = String(record?.niche || record?.category || '').trim();
  if (!n) return '';
  return /^[A-Z][a-z]/.test(n) && !record?.niche ? n.charAt(0).toLowerCase() + n.slice(1) : n;
}

export const introFor = (niche) => (niche
  ? `The questions people are asking Google about ${niche}, and the content that would answer them.`
  : AQ_COPY.intro);

// The section as the app shows it. Internal adds the subtopic searches, the
// questions not used, and the run's own numbers.
export function audienceView(record, { audience = 'internal' } = {}) {
  if (!record || !Array.isArray(record.ideas)) return null;
  const mode = record.mode === 'teaser' ? 'teaser' : 'full';
  const byId = Object.fromEntries((record.questions || []).map(q => [q.id, q]));
  const niche = nicheText(record);
  const ideas = record.ideas.map(i => ({
    title: i.title,
    questions: i.questionIds.map(id => byId[id]?.question).filter(Boolean),
    gap: i.gap,
    gapLabel: GAP_LABEL[mode][i.gap],
    format: i.format,
    channel: i.channel,
    attribute: i.attribute ? attrName(i.attribute) : null,
    why: i.why,
    earnedCreative: !!i.earnedCreative,
  }));
  const view = {
    mode,
    status: record.status,
    niche,
    location: record.location || AQ_LOCATION.label,
    gatheredAt: record.gatheredAt,
    intro: introFor(niche),
    ideas,
  };
  if (audience !== 'internal') return view;
  const used = new Set(record.ideas.flatMap(i => i.questionIds));
  return {
    ...view,
    subtopics: record.subtopics || [],
    unused: (record.questions || []).filter(q => !used.has(q.id)).map(q => q.question),
    questionCount: (record.questions || []).length,
    searches: record.searches || 0,
    failures: record.failures || [],
    error: record.error || null,
  };
}

// What a client link or a prospect may see: the ideas and the questions they
// answer, built field by field, and nothing at all unless there are ideas.
export function clientAudienceQuestions(record) {
  const v = audienceView(record, { audience: 'client' });
  if (!v || !v.ideas.length) return null;
  return JSON.parse(JSON.stringify({
    mode: v.mode,
    niche: v.niche,
    location: v.location,
    gatheredAt: v.gatheredAt,
    intro: v.intro,
    ideas: v.ideas.map(({ title, questions, gap, gapLabel, format, channel, attribute, why, earnedCreative }) => ({ title, questions, gap, gapLabel, format, channel, attribute, why, earnedCreative })),
  }));
}

// ── Spreadsheet ───────────────────────────────────────────────
// One row per idea, then every harvested question on a second sheet, for a
// content team to pick up directly. Uses the campaign export's styles.

export const IDEA_COLUMNS = [
  { key: 'n', label: '#', width: 5 },
  { key: 'title', label: 'Content idea', width: 46, wrap: true },
  { key: 'questions', label: 'Questions it answers', width: 60, wrap: true },
  { key: 'gap', label: 'On the brand’s site', width: 20 },
  { key: 'format', label: 'Format', width: 14 },
  { key: 'channel', label: 'Channel', width: 16 },
  { key: 'attribute', label: 'Strengthens', width: 14 },
  { key: 'why', label: 'Why it matters', width: 60, wrap: true },
  { key: 'earnedCreative', label: 'Earned creative potential', width: 14 },
];

export function ideaRows(record) {
  const v = audienceView(record, { audience: 'client' });
  if (!v) return [];
  return v.ideas.map((i, n) => ({
    n: n + 1,
    title: i.title,
    questions: i.questions.join('\n'),
    gap: i.gapLabel,
    format: i.format,
    channel: i.channel,
    attribute: i.attribute || '',
    why: i.why,
    earnedCreative: i.earnedCreative ? 'Yes, talk to HOWL' : '',
  }));
}

export const ideasFilename = (brand, date = new Date()) => {
  const safe = String(brand || 'Brand').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'Brand';
  return `${safe}-Audience-Questions-${date.toISOString().slice(0, 10)}.xlsx`;
};

export async function buildIdeasWorkbook(brand, record, exportedAt = new Date()) {
  // Loaded when a download runs: a static import would close a loop through
  // teaser.js, which imports this module for the client payload.
  const { STYLES, S, cell, colName, esc } = await import('./teaserExport.js');
  const JSZip = await loadJSZip();
  const rows = ideaRows(record);
  const date = exportedAt.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const HEADER = 4;
  const ideaXml = [
    `<row r="1" ht="24" customHeight="1">${cell('A1', `What ${brand}'s audience is asking`, S.title)}</row>`,
    `<row r="2">${cell('A2', `Exported ${date}. Questions about ${nicheText(record) || 'this niche'}. ${rows.length} content idea${rows.length === 1 ? '' : 's'} from ${(record?.questions || []).length} questions in Google search\u2019s \u201cPeople also ask\u201d (${record?.location || AQ_LOCATION.label}), gathered ${record?.gatheredAt ? new Date(record.gatheredAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : 'on an unknown date'}.${record?.mode === 'teaser' ? ' A teaser checks the homepage and about page only for answers.' : ''}`, S.sub)}</row>`,
    `<row r="${HEADER}" ht="30" customHeight="1">${IDEA_COLUMNS.map((c, i) => cell(`${colName(i)}${HEADER}`, c.label, S.header)).join('')}</row>`,
    ...rows.map((row, ri) => `<row r="${HEADER + 1 + ri}">${IDEA_COLUMNS.map((c, ci) => cell(`${colName(ci)}${HEADER + 1 + ri}`, row[c.key], c.wrap ? S.wrap : S.text)).join('')}</row>`),
  ].join('');
  const qCols = [{ label: 'Question', width: 70 }, { label: 'Subtopic', width: 28 }, { label: 'Answered in Google by', width: 34 }];
  const qXml = [
    `<row r="1">${qCols.map((c, i) => cell(`${colName(i)}1`, c.label, S.header)).join('')}</row>`,
    ...(record?.questions || []).map((q, ri) => `<row r="${ri + 2}">${cell(`A${ri + 2}`, q.question, S.wrap)}${cell(`B${ri + 2}`, q.subtopic, S.text)}${cell(`C${ri + 2}`, q.source || '', S.muted)}</row>`),
  ].join('');
  const sheet = (cols, data, frozen) => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<sheetViews><sheetView workbookViewId="0" showGridLines="0"><pane ySplit="${frozen}" topLeftCell="A${frozen + 1}" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
<cols>${cols.map((c, i) => `<col min="${i + 1}" max="${i + 1}" width="${c.width}" customWidth="1"/>`).join('')}</cols>
<sheetData>${data}</sheetData>
<pageSetup orientation="landscape" fitToWidth="1" fitToHeight="0"/>
</worksheet>`;
  const zip = new JSZip();
  zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
<Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`);
  zip.file('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`);
  zip.file('xl/workbook.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets><sheet name="${esc('Content ideas')}" sheetId="1" r:id="rId1"/><sheet name="All questions" sheetId="2" r:id="rId2"/></sheets>
</workbook>`);
  zip.file('xl/_rels/workbook.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/>
<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`);
  zip.file('xl/styles.xml', STYLES);
  zip.file('xl/worksheets/sheet1.xml', sheet(IDEA_COLUMNS, ideaXml, HEADER));
  zip.file('xl/worksheets/sheet2.xml', sheet(qCols, qXml, 1));
  return { zip, rows, filename: ideasFilename(brand, exportedAt) };
}
