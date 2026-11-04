// Google "People also ask" questions through SerpApi (v4.15.0).
//
// GET ?q=<search>&gl=us&hl=en   questions Google shows for a search
// GET ?token=<next_page_token>   the next questions in one question's chain
// GET ?ping=1                    is the key set (no search used)
// GET ?check=1                   admins: is the key set, and searches left
//
// The key lives in SERPAPI_API_KEY and never reaches the browser. Without it
// every call answers 503 with notConfigured, which the app shows as a setup
// note rather than a failure. Callers must be signed in (api/_auth.js).

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

export function serpUrl(query, key) {
  const gl = /^[a-z]{2}$/i.test(query.gl || '') ? query.gl.toLowerCase() : 'us';
  const hl = /^[a-z]{2}$/i.test(query.hl || '') ? query.hl.toLowerCase() : 'en';
  if (query.token) {
    return `${SERP}/search.json?${new URLSearchParams({ engine: 'google_related_questions', next_page_token: clip(query.token, 2000), api_key: key })}`;
  }
  return `${SERP}/search.json?${new URLSearchParams({ engine: 'google', q: clip(query.q, 200), gl, hl, api_key: key })}`;
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
      if (/hasn't returned any results|no results/i.test(String(body.error || ''))) return res.status(200).json({ questions: [] });
      const out = r.status === 401 ? 'SerpApi rejected the key. Check SERPAPI_API_KEY in Vercel.'
        : r.status === 429 ? 'SerpApi is out of searches for this month, or rate limited. Check the plan.'
        : body.error || `SerpApi said HTTP ${r.status}.`;
      return res.status(502).json({ error: out });
    }
    return res.status(200).json({ questions: pickQuestions(body) });
  } catch (err) {
    if (err.name === 'AbortError') return res.status(504).json({ error: 'SerpApi took too long to answer.' });
    console.error('audience-questions error:', err);
    return res.status(500).json({ error: err.message || 'Question search failed.' });
  } finally {
    clearTimeout(timeout);
  }
}
