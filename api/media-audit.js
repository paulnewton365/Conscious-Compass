// Media audit through Perplexity (v4.20.0).
//
// POST { brand, url, industry, peers[] }   starts a background research run, returns { id }
// GET  ?id=<run id>                       the run's status; when complete, the audit
// GET  ?ping=1                            whether PERPLEXITY_API_KEY is set
//
// The earned media step used to ask the assessor to paste three months of
// coverage. This runs that research instead: Perplexity's Agent API searches
// the last six months of coverage (v4.20.1; 90 days in v4.20.0), lists every item with its link, classifies
// each as announcement-led or independent, rates sentiment, and estimates
// share of voice against peers. It runs in the background (a deep research
// run can take several minutes, longer than a function may run), and the
// browser polls for the result.
//
// The key lives in PERPLEXITY_API_KEY and never reaches the browser. Callers
// must be signed in (api/_auth.js).

import { requireUser } from './_auth.js';
import { websiteAuditPrompt, socialAuditPrompt, WEB_AUDIT_SCHEMA } from '../src/lib/perplexityAudits.js';

const PPLX = 'https://api.perplexity.ai';
// Six months: long enough to see whether coverage holds up between
// announcements, not only around them.
export const WINDOW_DAYS = 182;
export const EFFORT = 'high';

const clip = (s, n) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
const usDate = (d) => `${String(d.getUTCMonth() + 1).padStart(2, '0')}/${String(d.getUTCDate()).padStart(2, '0')}/${d.getUTCFullYear()}`;
const isoDate = (d) => d.toISOString().slice(0, 10);

const ORIGINS = ['company', 'wire', 'announcement', 'contributed', 'independent'];
const SENTIMENTS = ['positive', 'neutral', 'negative', 'mixed'];

// Structured output: every field required, nothing extra (strict mode).
const str = { type: 'string' };
const num = { type: 'number' };
const obj = (properties) => ({ type: 'object', additionalProperties: false, required: Object.keys(properties), properties });
export const AUDIT_SCHEMA = obj({
  summary: str,
  announcements: { type: 'array', items: obj({ date: str, title: str, source: str }) },
  metrics: obj({
    totalItems: num,
    positive: num, neutral: num, negative: num, mixed: num,
    announcementLed: num, independent: num,
  }),
  shareOfVoice: obj({
    peersChosenBy: { type: 'string', enum: ['agency', 'perplexity'] },
    brandShare: num,
    rank: num,
    peers: { type: 'array', items: obj({ name: str, items: num, share: num }) },
    note: str,
  }),
  sentiment: str,
  narrative: str,
  topOutlets: { type: 'array', items: str },
  findings: { type: 'array', items: str },
  items: {
    type: 'array',
    items: obj({
      date: str, outlet: str, title: str, url: str,
      origin: { type: 'string', enum: ORIGINS },
      sentiment: { type: 'string', enum: SENTIMENTS },
      note: str,
    }),
  },
  limitations: { type: 'array', items: str },
});

export function buildPrompt({ brand, url, industry, peers = [] }, now = new Date()) {
  const from = new Date(now.getTime() - WINDOW_DAYS * 86400000);
  const peerList = (peers || []).map(p => clip(p, 80)).filter(Boolean).slice(0, 8);
  return `Build a media audit for ${clip(brand, 120)}${url ? ` (${clip(url, 200)})` : ''}${industry ? `, a company in ${clip(industry, 80)}` : ''}, covering its media coverage from ${isoDate(from)} to ${isoDate(now)} (the last six months).

1. Identify the brand's main announcements in the window (funding, launches, awards, partnerships, contracts, hires, results), from its own newsroom and press releases, with dates. If there were none, say so.
2. Find every distinct coverage item about the brand in the window. Search wire services, business media, trade and specialist press, regional press, newsletters, podcasts and industry association sites. Count each syndicated copy of a release as its own item, because each is a separate audience touchpoint, and note that it carries the company's text. List up to 80 items, each with the real URL you found it at. Never list an item you did not find.
3. Classify every item by origin:
   - company: the brand's own release, newsroom post or owned social
   - wire: a wire release or a syndicated copy of one
   - announcement: written by a journalist, but pegged to the brand's own announcement and drawing on its release
   - contributed: a byline, op-ed or explainer written by someone at the company
   - independent: initiated on the outlet's own editorial judgment, not pegged to a brand announcement (features, trend pieces, analysis, round-ups, comment sought from the brand)
   Rate each item's sentiment toward the brand: positive, neutral, negative or mixed. Neutral transactional reporting is neutral, not positive.
4. Count the items: total, by sentiment, announcement-led (company, wire, announcement and contributed together) and independent.
5. Estimate share of voice: count distinct coverage items in the same window, with the same method, for ${peerList.length ? `these peers, named by the agency: ${peerList.join(', ')}` : 'the four to six closest peers you identify in the same category, and name them'}. Give the brand's share of all items across the brand and its peers (0 to 100), its rank, and each peer's count and share. Set peersChosenBy to "${peerList.length ? 'agency' : 'perplexity'}".
6. Describe the sentiment across outlets, and the narrative that dominated: whether the brand's own framing carried through intact into downstream coverage, and who challenged it if anyone did. Say how coverage was spread across the six months: whether it held up between announcements or clustered around them and went quiet.
7. Give three to six findings a brand strategist would act on, and the main limitations of the method (for example paywalled or poorly indexed coverage that search undercounts).

Be honest. If coverage is thin, mostly syndicated, or absent between announcements, say so plainly. Figures are estimates from web search, not a media monitoring database. Write in US English and do not use em dashes.`;
}

// The website and social audits (v4.21.0): Antenna's own audit prompts,
// the same background run, a scorecard and a report.
export const KINDS = ['media', 'website', 'social'];
export function buildRequest(input, now = new Date()) {
  const kind = KINDS.includes(input?.kind) ? input.kind : 'media';
  if (kind !== 'media') {
    const a = { brand: clip(input.brand, 120), url: clip(input.url, 200), businessModel: input.businessModel, context: String(input.context || '').slice(0, 4000), social: input.social || {} };
    return {
      effort: EFFORT,
      background: true,
      input: kind === 'website' ? websiteAuditPrompt(a) : socialAuditPrompt(a),
      instructions: `You are a senior ${kind === 'website' ? 'brand strategist auditing a website' : 'social strategist auditing a social presence'} for a communications agency. Look at the real pages and posts before you judge. Cite what you saw; never invent an account, a figure or a quote.`,
      tools: [{ type: 'web_search' }, { type: 'fetch_url' }],
      response_format: { type: 'json_schema', json_schema: { name: `${kind}_audit`, schema: WEB_AUDIT_SCHEMA, strict: true } },
    };
  }
  const from = new Date(now.getTime() - WINDOW_DAYS * 86400000);
  return {
    effort: EFFORT,
    background: true,
    input: buildPrompt(input, now),
    instructions: 'You are a media analyst at a communications agency building an evidence-based media audit. Search thoroughly before you count. Every coverage item must come from a page you found.',
    tools: [
      { type: 'web_search', filters: { search_after_date_filter: usDate(from) } },
      { type: 'fetch_url' },
    ],
    response_format: { type: 'json_schema', json_schema: { name: 'media_audit', schema: AUDIT_SCHEMA, strict: true } },
  };
}

// The response's text and the pages it searched or cited.
export function shapeResult(body) {
  const status = body?.status || 'unknown';
  if (status !== 'completed') {
    return { status, error: status === 'failed' || status === 'cancelled' || status === 'incomplete' ? (body?.error?.message || `The research run ended as ${status}.`) : null };
  }
  const output = Array.isArray(body?.output) ? body.output : [];
  const text = body?.output_text || output
    .filter(o => o?.type === 'message')
    .flatMap(o => (o.content || []).filter(c => c?.type === 'output_text').map(c => c.text || ''))
    .join('');
  let audit = null;
  try { audit = JSON.parse(text); } catch {
    const m = /\{[\s\S]*\}/.exec(text || '');
    if (m) { try { audit = JSON.parse(m[0]); } catch { audit = null; } }
  }
  const sources = [];
  const seen = new Set();
  const add = (url, title) => { if (url && !seen.has(url)) { seen.add(url); sources.push({ url, title: clip(title, 200) }); } };
  output.forEach(o => {
    if (o?.type === 'search_results') (o.results || []).forEach(r => add(r.url, r.title));
    if (o?.type === 'message') (o.content || []).forEach(c => (c.annotations || []).forEach(a => add(a.url, a.title)));
  });
  if (!audit) return { status: 'failed', error: 'The research run finished but its audit could not be read.' };
  return {
    status: 'completed',
    audit,
    sources: sources.slice(0, 200),
    cost: body?.usage?.cost?.total_cost ?? null,
    effort: body?.effort || EFFORT,
  };
}

export default async function handler(req, res, { fetchImpl = fetch } = {}) {
  const user = await requireUser(req, res, { fetchImpl });
  if (!user) return;
  res.setHeader('Cache-Control', 'private, no-store');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const key = process.env.PERPLEXITY_API_KEY;
  if (!key) return res.status(503).json({ notConfigured: true, error: 'PERPLEXITY_API_KEY is not set in Vercel.' });
  if (req.method === 'GET' && req.query?.ping === '1') return res.status(200).json({ configured: true });

  const headers = { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Accept: 'application/json' };
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25000);
  const fail = (r, body) => (r.status === 401 ? 'Perplexity rejected the key. Check PERPLEXITY_API_KEY in Vercel.'
    : r.status === 402 ? 'The Perplexity account is out of credit. Top it up in the API settings.'
    : r.status === 429 ? 'Perplexity is rate limiting requests. Try again in a minute.'
    : body?.error?.message || body?.error || `Perplexity said HTTP ${r.status}.`);
  try {
    if (req.method === 'POST') {
      const b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
      if (!String(b.brand || '').trim()) return res.status(400).json({ error: 'A brand name is required.' });
      const r = await fetchImpl(`${PPLX}/v1/agent`, { method: 'POST', headers, body: JSON.stringify(buildRequest(b)), signal: controller.signal });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) return res.status(502).json({ error: fail(r, body) });
      // A run that finished at once (no background support) comes back whole.
      if (body?.status === 'completed') return res.status(200).json({ id: body.id || null, ...shapeResult(body) });
      if (!body?.id) return res.status(502).json({ error: 'Perplexity did not return a run id.' });
      return res.status(200).json({ id: body.id, status: body.status || 'queued' });
    }
    if (req.method === 'GET') {
      const id = String(req.query?.id || '').trim();
      if (!/^[\w-]{4,200}$/.test(id)) return res.status(400).json({ error: 'A run id is required.' });
      const r = await fetchImpl(`${PPLX}/v1/responses/${encodeURIComponent(id)}`, { headers, signal: controller.signal });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) return res.status(r.status === 404 ? 404 : 502).json({ error: r.status === 404 ? 'That research run is no longer available. Run the audit again.' : fail(r, body) });
      return res.status(200).json({ id, ...shapeResult(body) });
    }
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    if (err.name === 'AbortError') return res.status(504).json({ error: 'Perplexity took too long to answer.' });
    console.error('media-audit error:', err);
    return res.status(500).json({ error: err.message || 'Media audit failed.' });
  } finally {
    clearTimeout(timeout);
  }
}
