// Vercel Cron — runs every Sunday at 23:30 UTC
// Reads stay_conscious_cache, landscape_analysis_cache, insights_analysis_cache,
// picks a lead story, composes the newsletter object, writes to stay_conscious_newsletter.
// Schedule in vercel.json: "30 23 * * 0"
// Also accepts POST for admin force refresh.

import { requireUser } from './_auth.js';
import { glossaryForPrompt, titleCaseAttributes } from '../src/data/attributeGlossary.js';
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

// ── Landscape insights, for any reader (v4.1.0) ────────────────
// The issue is public, so the landscape text is written for someone who has
// never seen the Compass: each attribute is explained in plain words where it
// is first named, and no brand is named (a paragraph naming an assessed brand
// is dropped from the public issue, which used to leave half a story).
export function landscapePrompt(analysis) {
  return `You are writing the landscape section of Stay Conscious, Antenna Group's public brand newsletter. Readers are marketers and business leaders who have never seen the Conscious Compass. Read this analysis and do two things:

1. Write a single headline (max 10 words) capturing the most striking finding. Output it on one line starting with exactly "HEADLINE: "

2. Rewrite the analysis as exactly two short paragraphs separated by a blank line:
   - Paragraph 1: the big picture. What the scores say about how brands across sectors are showing up, and the pattern that is emerging. Say once, plainly, that the Conscious Compass scores brands out of 100 on eight attributes from what is publicly visible about them.
   - Paragraph 2: the attributes. Which are strongest and weakest, where sectors differ most, and what that means for a brand. Name no more than three attributes.

Every time you name an attribute for the first time, explain it in a few plain words in the same sentence, for example "Sentient, how much a brand moves people, averages 42". Write attribute names in title case (Sentient, not SENTIENT). Use only these meanings:
${glossaryForPrompt()}

Never name an individual brand or company; sectors are fine. Every figure must come from the analysis. Keep the two paragraphs consistent with each other and with the headline, and use one term for each idea throughout (say "score" every time, never "rating" or "grade").

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
export function earnedCreativePrompt({ count = 6, exclude = [] } = {}) {
  const skip = exclude.length ? `\n\nDo not include work by these brands, already covered: ${exclude.join(', ')}.` : '';
  return `Find ${count} recent examples of earned creative that are catching headlines. Prefer work from the last 30 days; if there is not enough, go back up to three months, but nothing older. Earned creative is an idea designed to be talked about rather than paid to be seen: a brand DID something in the world (a stunt, an installation, a product intervention, a data release, a public act, a partnership) and journalists, creators or the public carried it. Not paid ads, not sponsorships, not press releases on their own.

Prefer work by brands with a purpose, climate, energy, health or social angle, but any strong example will do. Search the trade and business press (for example Adweek, Ad Age, The Drum, Campaign, Fast Company, Marketing Week, Business Insider, Muse by Clio, LBBOnline). One example per brand.${skip}

For each example, use only facts from the pages your searches returned. The link must be the article you read about it.

Return JSON only, no prose before or after, most recent first:
{"examples":[{"brand":"The brand behind the work","agency":"The agency, or empty if none is named","title":"Name of the work, or a plain description","what":"What they did. Two short sentences, under 45 words.","coverage":"What coverage it generated: who carried it and how widely, from the article. One sentence, under 30 words.","outlet":"The publication of the link","published":"YYYY-MM-DD the article was published, or empty if unknown","url":"https://..."}]}

The url must be the article about THIS piece of work: a page that names the brand and the work itself. Never use a link about a different campaign by the same brand. If you cannot find such an article for an example, leave that example out.

US English. No em dashes or en dashes.`;
}
export const EARNED_CREATIVE_PROMPT = earnedCreativePrompt();
export const EARNED_CREATIVE_TARGET = 3;

const normUrl = (u) => {
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

const tidy = (v) => String(v ?? '').replace(/\s*[—–]\s*/g, ', ').replace(/\s+/g, ' ').trim();
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
async function searchEarnedCreative(anthropicKey, exclude, fetchImpl, deadline = Infinity) {
  const prompt = earnedCreativePrompt({ exclude });
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
export async function fetchEarnedCreative(anthropicKey, { fetchImpl = fetch, verify = verifyExample, rounds = 2, budgetMs = 120000, deadlineMs = 200000 } = {}) {
  const started = Date.now();
  const deadline = started + deadlineMs;
  const kept = [];
  const tried = new Set();
  const status = { searches: 0, candidates: 0, passed: 0, reasons: [] };
  try {
    for (let round = 0; round < rounds && kept.length < EARNED_CREATIVE_TARGET; round++) {
      if (round > 0 && Date.now() - started > budgetMs) break;   // leave time for the rest of the issue
      status.searches += 1;
      const found = await searchEarnedCreative(anthropicKey, [...tried], fetchImpl, deadline);
      if (found.reason) status.reasons.push(found.reason);
      const candidates = found.candidates.filter(e => !tried.has(e.brand.toLowerCase()));
      if (!candidates.length) continue;
      candidates.forEach(e => tried.add(e.brand.toLowerCase()));
      status.candidates += candidates.length;
      // Each link is opened and must name the brand and the work (v4.0.1).
      const checks = await Promise.all(candidates.map(e => Promise.resolve(verify(e)).catch(() => false)));
      candidates.forEach((e, i) => { if (checks[i]) kept.push(e); });
    }
  } catch (err) {
    status.reasons.push(`error: ${String(err?.message || err).slice(0, 120)}`);
  }
  status.passed = kept.length;
  if (status.candidates && !kept.length) status.reasons.push('no example passed the article check');
  const items = byRecency(kept).slice(0, EARNED_CREATIVE_TARGET).map((e) => { const out = { ...e, verified: true }; delete out.searchTitle; return out; });
  return { items, generatedAt: new Date().toISOString(), status };
}

// When a run finds nothing, the last issue's checked examples stay up rather
// than the section vanishing; they are marked as carried over (v4.1.2).
// Only examples that passed the article check are carried.
// Carried examples are dropped once they were found more than four weeks ago.
export function withCarryOver(fresh, previous, previousIssue = null, now = Date.now()) {
  if (fresh?.items?.length) return fresh;
  const kept = (previous?.items || []).filter(e => e && e.verified === true && typeof e.url === 'string');
  const foundAt = previous?.foundAt || previous?.generatedAt || '';
  const age = now - Date.parse(foundAt);
  if (!kept.length || !(age <= 28 * 24 * 3600 * 1000)) return fresh;
  return { ...fresh, items: kept, foundAt, carriedFrom: previous?.carriedFrom || previousIssue || null };
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

  const fetchTable = async (table) => {
    const r = await fetch(
      `${supabaseUrl}/rest/v1/${table}?select=*&order=refreshed_at.desc&limit=1`,
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

  try {
    // Pull all three caches in parallel
    const [scRow, laRow, iaRow] = await Promise.all([
      fetchTable('stay_conscious_cache'),
      fetchTable('landscape_analysis_cache'),
      fetchTable('insights_analysis_cache'),
    ]);

    if (!scRow?.items?.length) {
      return res.status(200).json({ success: false, error: 'Stay Conscious cache is empty — run other refreshes first.' });
    }

    const intelligenceItems = scRow.items;
    const landscapeAnalysis = laRow?.analysis || null;
    const storyOpportunities = iaRow?.stories || null;

    // Pick lead story — prefer AI Visibility or Brand Strategy items, otherwise first
    const leadPriority = ['AI Visibility', 'Brand Strategy', 'Digital Experience'];
    const leadItem = intelligenceItems.find(i => leadPriority.includes(i.category)) || intelligenceItems[0];
    const supportingItems = intelligenceItems.filter(i => i !== leadItem);

    // Increment issue number from previous cache entry, starting at 1.
    // Cap: if prevIssue is suspiciously large (>52, i.e. from old epoch calc), reset to 0.
    const prevRow = await fetchTable('stay_conscious_newsletter');
    const rawPrev = prevRow?.newsletter?.issueNumber || 0;
    const prevIssue = rawPrev > 52 ? 0 : rawPrev;
    const issueNumber = prevIssue + 1;

    // Generate landscape headline + two-paragraph summary directly here,
    // regardless of what the cache contains. This is more reliable than
    // depending on the landscape refresh prompt having run correctly.
    let landscapeForNewsletter = null;
    if (landscapeAnalysis?.summary) {
      const combinedText = [landscapeAnalysis.summary, landscapeAnalysis.insights].filter(Boolean).join('\n\n');
      const headlinePrompt = landscapePrompt(combinedText);

      const hlRes = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': anthropicKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 600, temperature: 0, messages: [{ role: 'user', content: headlinePrompt }] }),
      });

      let headline = '';
      let twoParaSummary = combinedText;

      if (hlRes.ok) {
        const hlData = await hlRes.json();
        const hlText = (hlData.content?.filter(b => b.type === 'text').map(b => b.text).join('\n') || '').trim();
        const hlMatch = hlText.match(/^HEADLINE:\s*(.+)$/m);
        if (hlMatch) headline = hlMatch[1].replace(/^["'*#\s]+|["'*#\s]+$/g, '').trim();
        // Everything after the HEADLINE: line is the two-paragraph summary
        twoParaSummary = hlText.replace(/^HEADLINE:.*$/m, '').trim();
      }

      landscapeForNewsletter = {
        headline: titleCaseAttributes(headline),
        summary: titleCaseAttributes(twoParaSummary),
        brandCount: landscapeAnalysis.brandCount || null,
        sectorCount: landscapeAnalysis.sectorCount || null,
        averageScore: Number.isFinite(landscapeAnalysis.averageScore) ? landscapeAnalysis.averageScore : await portfolioAverage(),
      };
    }

    const newsletter = {
      issueNumber,
      weekOf: new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),   // US English (v3.103.0)
      leadStory: {
        category: leadItem.category,
        headline: leadItem.headline,
        insight: leadItem.insight,
        whyItMatters: leadItem.whyItMatters,
      },
      intelligenceItems: supportingItems,
      landscapeAnalysis: landscapeForNewsletter,
      storyOpportunities: storyOpportunities || null,
      // Earned creative in the news (v3.124.0); null when none could be sourced.
      earnedCreative: withCarryOver(await fetchEarnedCreative(anthropicKey), prevRow?.newsletter?.earnedCreative, prevRow?.newsletter?.issueNumber || null),
    };

    // The Sunday run keeps the issue it replaces (v4.2.0): whatever was live
    // at the end of the week, including any Force refresh, is copied to the
    // archive first. Force refreshes archive nothing. A failed copy never
    // stops the new issue, and the same issue is never copied twice.
    let archived = null;
    if (caller.cron) archived = await archiveIssue(prevRow, { supabaseUrl, supabaseKey });

    // Upsert into Supabase (single row, id=1)
    const upsertRes = await fetch(`${supabaseUrl}/rest/v1/stay_conscious_newsletter`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        Prefer: 'resolution=merge-duplicates',
      },
      body: JSON.stringify({
        id: 1,
        newsletter,
        refreshed_at: new Date().toISOString(),
      }),
    });

    if (!upsertRes.ok) {
      const err = await upsertRes.json().catch(() => ({}));
      throw new Error(err.message || `Supabase upsert error ${upsertRes.status}`);
    }

    return res.status(200).json({
      success: true,
      issueNumber,
      ...(caller.cron ? { archived } : {}),
      refreshedAt: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Newsletter refresh failed:', error);
    return res.status(500).json({ error: error.message });
  }
}
