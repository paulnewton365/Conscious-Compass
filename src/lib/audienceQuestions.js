// ─────────────────────────────────────────────────────────────
// AUDIENCE QUESTIONS (v4.15.0)
//
// What the brand's audience is actually asking, and the content that would
// answer it. A recommendation layer: it never changes a score, so the
// framework version does not move.
//
// The method:
//   1. The model reads the brand's own pages and names 4 or 5 subtopics of
//      its category, each as a plain search a buyer would type. Category
//      searches, not brand searches: the point is demand, not reputation.
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
  full:   { missing: 'Not answered', thin: 'Answered thinly', answered: 'Answered, could go further' },
  teaser: { missing: 'Likely gap', thin: 'Likely thin', answered: 'Answered, could go further' },
};
export const FORMATS = ['Short video', 'Carousel', 'Article', 'Explainer', 'FAQ page', 'Data post', 'Thread', 'Webinar', 'Guide', 'Case study'];

export const AQ_COPY = {
  title: 'What your audience is asking',
  intro: 'Real questions people search in this category, from Google’s People also ask, checked against what the brand publishes. Each idea answers questions that are actually being asked.',
  teaserIntro: 'Real questions people search in this category, from Google’s People also ask. This read checked the brand’s main pages only, so the gaps are likely gaps. A full assessment checks the whole site.',
  notConfigured: 'Audience questions need the SerpApi key. Add SERPAPI_API_KEY in Vercel and redeploy.',
  none: 'Google returned too few questions for this category to build ideas on. Nothing has been invented to fill the gap.',
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

export function buildSubtopicPrompt(input, siteText, mode = 'full') {
  const n = (AQ_MODES[mode] || AQ_MODES.full).subtopics;
  return `${brandLine(input)}

Read the brand's pages and decide what it actually sells or does, and to whom. Then name ${n} subtopics of its category that its buyers research before they buy.

For each subtopic, write the plain search a buyer would type into Google. Rules:
- Category searches, never the brand's name or a competitor's name. We want what the market asks, not what it asks about this brand.
- Short and natural, 2 to 6 words, the way a person types: "heat pump installation cost", "what is community solar", "office leasing for startups".
- Spread across the buying journey: what it is, whether it is worth it, how to choose, cost, and the doubts people have.
- Specific to this brand's actual offer and audience. A B2B grid software company's buyers search differently from homeowners.

${pagesBlock(siteText)}

Return valid JSON only, no prose, no fences:
{ "category": "the category in under 8 words", "subtopics": [ { "name": "under 5 words", "query": "the search" } ] }`;
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
  return { category: clean(parsed.category, 80), subtopics };
}

// ── Step 2: harvest ───────────────────────────────────────────

export class NotConfiguredError extends Error {
  constructor() { super(AQ_COPY.notConfigured); this.notConfigured = true; }
}

async function searchQuestions(params, fetchImpl) {
  const qs = new URLSearchParams({ gl: AQ_LOCATION.gl, hl: AQ_LOCATION.hl, ...params });
  const r = await fetchImpl(`/api/audience-questions?${qs}`);
  const body = await r.json().catch(() => ({}));
  if (body.notConfigured) throw new NotConfiguredError();
  if (!r.ok) throw new Error(body.error || `Question search failed (HTTP ${r.status}).`);
  return Array.isArray(body.questions) ? body.questions : [];
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

  const first = await Promise.allSettled(subtopics.map(s => { searches += 1; return searchQuestions({ q: s.query }, fetchImpl); }));
  if (first.some(r => r.status === 'rejected' && r.reason?.notConfigured)) throw new NotConfiguredError();

  const toExpand = [];
  first.forEach((res, i) => {
    const sub = subtopics[i].name;
    if (res.status !== 'fulfilled') { failures.push({ query: subtopics[i].query, error: String(res.reason?.message || res.reason) }); return; }
    const added = res.value.map(q => add(q, sub, 0)).filter(Boolean);
    added.filter(q => q.token).slice(0, m.expandPer).forEach(q => toExpand.push({ token: q.token, sub }));
  });

  const second = await Promise.allSettled(toExpand.map(x => { searches += 1; return searchQuestions({ token: x.token }, fetchImpl); }));
  second.forEach((res, i) => {
    if (res.status !== 'fulfilled') { failures.push({ query: 'expansion', error: String(res.reason?.message || res.reason) }); return; }
    res.value.forEach(q => add(q, toExpand[i].sub, 1));
  });

  return { questions, searches, failures };
}

// ── Step 3: ideas ─────────────────────────────────────────────

export function buildIdeasPrompt(input, harvest, siteText, mode = 'full') {
  const m = AQ_MODES[mode] || AQ_MODES.full;
  const range = m.minIdeas === m.maxIdeas ? `exactly ${m.maxIdeas}` : `between ${m.minIdeas} and ${m.maxIdeas}`;
  return `${brandLine(input)}

Below are real questions people search in this brand's category, harvested from Google's "People also ask", each with an id. Check them against the brand's pages, then write content ideas that would answer the questions the brand is not answering.

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

// callModel(prompt) → Promise<string>, a plain (no search) model call.
// Never throws: a failure is a record with status 'failed' or
// 'notConfigured', so it can never stop the assessment around it.
export async function runAudienceQuestions(input, { siteText = '', mode = 'full', fetchImpl, callModel }) {
  const started = Date.now();
  const base = { version: AQ_VERSION, mode, location: AQ_LOCATION.label, gatheredAt: new Date().toISOString() };
  try {
    const m = AQ_MODES[mode] || AQ_MODES.full;
    // Free check first, so a missing key costs no model call.
    const ping = await fetchImpl('/api/audience-questions?ping=1');
    const pb = await ping.json().catch(() => ({}));
    if (pb.notConfigured) throw new NotConfiguredError();
    if (!ping.ok) throw new Error(pb.error || `Question search is unavailable (HTTP ${ping.status}).`);
    const { category, subtopics } = parseSubtopics(await callModel(buildSubtopicPrompt(input, siteText, mode)), input.brandName, m.subtopics);
    const harvest = await harvestQuestions(subtopics, { fetchImpl, mode });
    const out = { ...base, category, subtopics, questions: harvest.questions, searches: harvest.searches, failures: harvest.failures };
    // Under five real questions there is nothing honest to build on.
    if (harvest.questions.length < 5) return { ...out, status: 'thin', ideas: [], ms: Date.now() - started };
    const ideas = parseIdeas(await callModel(buildIdeasPrompt(input, harvest, siteText, mode)), harvest, mode);
    return { ...out, status: ideas.length ? 'ok' : 'thin', ideas, ms: Date.now() - started };
  } catch (err) {
    return { ...base, status: err?.notConfigured ? 'notConfigured' : 'failed', error: String(err?.message || err), ideas: [], questions: [], ms: Date.now() - started };
  }
}

// ── Views ─────────────────────────────────────────────────────

// The section as the app shows it. Internal adds the subtopic searches, the
// questions not used, and the run's own numbers.
export function audienceView(record, { audience = 'internal' } = {}) {
  if (!record || !Array.isArray(record.ideas)) return null;
  const mode = record.mode === 'teaser' ? 'teaser' : 'full';
  const byId = Object.fromEntries((record.questions || []).map(q => [q.id, q]));
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
    category: record.category || '',
    location: record.location || AQ_LOCATION.label,
    gatheredAt: record.gatheredAt,
    intro: mode === 'teaser' ? AQ_COPY.teaserIntro : AQ_COPY.intro,
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
    category: v.category,
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
    `<row r="1" ht="24" customHeight="1">${cell('A1', `${brand}: what the audience is asking`, S.title)}</row>`,
    `<row r="2">${cell('A2', `Exported ${date}. ${rows.length} content idea${rows.length === 1 ? '' : 's'} from ${(record?.questions || []).length} questions on Google People also ask (${record?.location || AQ_LOCATION.label}), gathered ${record?.gatheredAt ? new Date(record.gatheredAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : 'on an unknown date'}.${record?.mode === 'teaser' ? ' A teaser read checks the main pages only, so gaps are likely gaps.' : ''}`, S.sub)}</row>`,
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
