// Google search data through SerpApi (v4.15.0, search evidence v4.16.0).
//
// GET ?q=<search>&gl=us&hl=en       a Google search: People also ask questions,
//                                   page one organic results, the AI Overview
//                                   (or its token) and the knowledge panel
// GET ?token=<next_page_token>      the next questions in one question's chain
// GET ?mode=aio&token=<page_token>  an AI Overview Google loaded lazily
// GET ?mode=autocomplete&q=<brand>  Google's suggestions after the brand name
// GET ?mode=news&q=<brand>          Google News results, last 90 days
// GET ?ping=1                       is the key set (no search used)
// GET ?check=1                      admins: is the key set, and searches left
//
// The key lives in SERPAPI_API_KEY and never reaches the browser. Without it
// every call answers 503 with notConfigured, which the app shows as a setup
// note rather than a failure. Callers must be signed in (api/_auth.js).
// Every response is trimmed to what the app reads.

import { requireUser } from './_auth.js';

const SERP = 'https://serpapi.com';

// Only what the app uses. SerpApi returns far more per question.
export function pickQuestions(body) {
  const list = Array.isArray(body?.related_questions) ? body.related_questions : [];
  return list
    .filter(q => q && typeof q.question === 'string' && q.question.trim())
    .map(q => ({
      question: q.question.trim().slice(0, 200),
      snippet: String(q.snippet || (Array.isArray(q.list) ? q.list.join(' ') : '') || '').slice(0, 300),
      source: String(q.source?.name || q.displayed_link || q.title || '').slice(0, 80),
      link: String(q.link || '').slice(0, 300),
      token: q.next_page_token || null,
    }));
}

const clip = (v, n) => String(v || '').trim().slice(0, n);

const hostOf = (url) => { try { return new URL(url).hostname.replace(/^www\./, '').toLowerCase(); } catch { return ''; } };

// Page one organic results: position, domain, title, and whether Google shows
// the result's key pages under it (sitelinks).
export function pickOrganic(body) {
  return (Array.isArray(body?.organic_results) ? body.organic_results : []).slice(0, 10).map(o => ({
    position: Number(o.position) || null,
    domain: hostOf(o.link),
    link: clip(o.link, 300),
    title: clip(o.title, 160),
    snippet: clip(o.snippet, 200),
    sitelinks: !!(o.sitelinks && (o.sitelinks.inline?.length || o.sitelinks.expanded?.length || o.sitelinks.list?.length)),
  })).filter(o => o.domain);
}

// The AI Overview: its cited sources, or the token to fetch it with.
export function pickAiOverview(body) {
  const a = body?.ai_overview;
  if (!a) return { present: false, token: null, sources: [] };
  const refs = Array.isArray(a.references) ? a.references : [];
  return {
    present: true,
    token: refs.length ? null : (a.page_token || null),
    sources: refs.slice(0, 20).map(r => ({ domain: hostOf(r.link), title: clip(r.title, 160), source: clip(r.source, 80) })).filter(r => r.domain),
  };
}

export function pickKnowledgeGraph(body) {
  const k = body?.knowledge_graph;
  if (!k || !k.title) return { present: false };
  return { present: true, title: clip(k.title, 120), type: clip(k.type, 80), description: clip(k.description, 300), website: clip(k.website, 200) };
}

export const pickSuggestions = (body) => (Array.isArray(body?.suggestions) ? body.suggestions : [])
  .map(s => clip(s?.value, 120)).filter(Boolean).slice(0, 10);

export function pickNews(body) {
  return (Array.isArray(body?.news_results) ? body.news_results : []).slice(0, 100).map(n => ({
    title: clip(n.title, 200),
    link: clip(n.link, 300),
    source: clip(typeof n.source === 'object' ? n.source?.name : n.source, 80),
    publishedAt: clip(n.published_at || n.iso_date, 40),
    date: clip(n.date, 40),
  })).filter(n => n.title);
}

const usDate = (d) => `${d.getUTCMonth() + 1}/${d.getUTCDate()}/${d.getUTCFullYear()}`;

export function serpUrl(query, key) {
  const gl = /^[a-z]{2}$/i.test(query.gl || '') ? query.gl.toLowerCase() : 'us';
  const hl = /^[a-z]{2}$/i.test(query.hl || '') ? query.hl.toLowerCase() : 'en';
  if (query.mode === 'aio') {
    return `${SERP}/search.json?${new URLSearchParams({ engine: 'google_ai_overview', page_token: clip(query.token, 4000), api_key: key })}`;
  }
  if (query.token) {
    return `${SERP}/search.json?${new URLSearchParams({ engine: 'google_related_questions', next_page_token: clip(query.token, 2000), api_key: key })}`;
  }
  if (query.mode === 'autocomplete') {
    return `${SERP}/search.json?${new URLSearchParams({ engine: 'google_autocomplete', q: `${clip(query.q, 120)} `, gl, hl, api_key: key })}`;
  }
  if (query.mode === 'news') {
    // The last 90 days, up to 100 articles in one search. Dates are checked
    // again in code from published_at, so a looser filter upstream is safe.
    const now = new Date();
    const from = new Date(now.getTime() - 90 * 86400000);
    return `${SERP}/search.json?${new URLSearchParams({ engine: 'google', tbm: 'nws', q: `"${clip(query.q, 120).replace(/"/g, '')}"`, gl, hl, num: '100', tbs: `cdr:1,cd_min:${usDate(from)},cd_max:${usDate(now)}`, api_key: key })}`;
  }
  return `${SERP}/search.json?${new URLSearchParams({ engine: 'google', q: clip(query.q, 200), gl, hl, api_key: key })}`;
}

// What each mode sends back.
export function shapeResponse(query, body) {
  if (query.mode === 'aio') return { aiOverview: pickAiOverview({ ai_overview: body?.ai_overview || body }) };
  if (query.token) return { questions: pickQuestions(body) };
  if (query.mode === 'autocomplete') return { suggestions: pickSuggestions(body) };
  if (query.mode === 'news') return { news: pickNews(body) };
  return { questions: pickQuestions(body), organic: pickOrganic(body), aiOverview: pickAiOverview(body), knowledgeGraph: pickKnowledgeGraph(body) };
}

export default async function handler(req, res, { fetchImpl = fetch } = {}) {
  const user = await requireUser(req, res, { admin: req.query?.check === '1', fetchImpl });
  if (!user) return;
  res.setHeader('Cache-Control', 'private, no-store');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const key = process.env.SERPAPI_API_KEY;
  if (!key) return res.status(503).json({ notConfigured: true, error: 'SERPAPI_API_KEY is not set in Vercel.' });

  const { q, token, check, ping } = req.query || {};
  // Lets a run stop before it spends a model call when the key is missing.
  if (ping === '1') return res.status(200).json({ configured: true });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25000);
  try {
    if (check === '1') {
      // The account endpoint is free: it does not use a search.
      const r = await fetchImpl(`${SERP}/account.json?${new URLSearchParams({ api_key: key })}`, { signal: controller.signal });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) return res.status(502).json({ configured: true, ok: false, error: body.error || `SerpApi said HTTP ${r.status}. Check the key.` });
      return res.status(200).json({
        configured: true,
        ok: true,
        plan: body.plan_name || null,
        searchesPerMonth: body.searches_per_month ?? null,
        searchesLeft: body.total_searches_left ?? body.plan_searches_left ?? null,
        usedThisMonth: body.this_month_usage ?? null,
      });
    }

    if (!String(q || '').trim() && !String(token || '').trim()) return res.status(400).json({ error: 'A search (q) or a question token is required.' });

    const r = await fetchImpl(serpUrl(req.query, key), { signal: controller.signal });
    const body = await r.json().catch(() => ({}));
    if (!r.ok || body.error) {
      // SerpApi reports "no results" as an error; that is an empty answer, not a failure.
      if (/hasn't returned any results|no results/i.test(String(body.error || ''))) return res.status(200).json(shapeResponse(req.query, {}));
      const out = r.status === 401 ? 'SerpApi rejected the key. Check SERPAPI_API_KEY in Vercel.'
        : r.status === 429 ? 'SerpApi is out of searches for this month, or rate limited. Check the plan.'
        : body.error || `SerpApi said HTTP ${r.status}.`;
      return res.status(502).json({ error: out });
    }
    return res.status(200).json(shapeResponse(req.query, body));
  } catch (err) {
    if (err.name === 'AbortError') return res.status(504).json({ error: 'SerpApi took too long to answer.' });
    console.error('audience-questions error:', err);
    return res.status(500).json({ error: err.message || 'Question search failed.' });
  } finally {
    clearTimeout(timeout);
  }
}
