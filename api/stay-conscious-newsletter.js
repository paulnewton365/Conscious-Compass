// GET /api/stay-conscious-newsletter
// Returns the composed weekly newsletter from Supabase cache.
// Cache is written by /api/refresh-stay-conscious-newsletter every Sunday at 23:30 UTC.

// Public issue (v3.120.0): GET ?public=1 needs no sign-in and returns only the
// sections safe to publish, by allowlist: the lead story, the brand
// intelligence items and the landscape figures. Story opportunities are
// internal (they are built from the list of assessed brands) and never leave.
// Landscape text that names an assessed brand is dropped as well.

import { requireUser } from './_auth.js';

const str = (v, n = 4000) => (typeof v === 'string' ? v.slice(0, n) : '');
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function publicIssue(newsletter, brandNames = []) {
  if (!newsletter || typeof newsletter !== 'object') return null;
  const names = [...new Set(brandNames.map(n => String(n || '').trim()).filter(n => n.length >= 2))];   // BP, GE, 3M count too
  const named = names.length ? new RegExp(`(^|[^\\p{L}\\p{N}])(${names.map(escapeRe).join('|')})(?=$|[^\\p{L}\\p{N}])`, 'iu') : null;
  const mentions = (t) => !!(named && named.test(t));
  const keepParas = (t) => str(t).split(/\n\s*\n/).filter(p => p.trim() && !mentions(p)).join('\n\n');
  const item = (x) => (x && typeof x === 'object' ? {
    category: str(x.category, 80), headline: str(x.headline, 300), insight: str(x.insight), whyItMatters: str(x.whyItMatters),
    ...(x.image && typeof x.image.src === 'string' && /^https:\/\//.test(x.image.src) ? { image: { src: x.image.src, alt: str(x.image.alt, 300), caption: str(x.image.caption, 300) } } : {}),
  } : null);
  const la = newsletter.landscapeAnalysis;
  return {
    issueNumber: num(newsletter.issueNumber),
    weekOf: str(newsletter.weekOf, 60),
    leadStory: item(newsletter.leadStory),
    intelligenceItems: Array.isArray(newsletter.intelligenceItems) ? newsletter.intelligenceItems.map(item).filter(Boolean) : [],
    // Earned creative in the news (v3.124.0): other brands' public work, with
    // its source link. Only https links, and only the listed fields.
    earnedCreative: Array.isArray(newsletter.earnedCreative?.items) ? {
      items: newsletter.earnedCreative.items
        .filter(e => e && typeof e.url === 'string' && /^https:\/\//.test(e.url))
        .map(e => ({ brand: str(e.brand, 80), agency: str(e.agency, 80), title: str(e.title, 140), what: str(e.what, 600), coverage: str(e.coverage, 300), outlet: str(e.outlet, 80), url: e.url.slice(0, 600) }))
        .slice(0, 3),
    } : null,
    landscapeAnalysis: la && typeof la === 'object' ? {
      brandCount: num(la.brandCount), sectorCount: num(la.sectorCount), averageScore: num(la.averageScore),
      headline: mentions(str(la.headline)) ? '' : str(la.headline, 300),
      summary: keepParas(la.summary),
      insights: keepParas(la.insights),
    } : null,
  };
}

const isPublicRequest = (req) => req.method === 'GET' && String(req.query?.public ?? new URL(req.url || '/', 'http://x').searchParams.get('public')) === '1';

async function sendPublicIssue(req, res) {
  const supabaseUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) return res.status(500).json({ error: 'Server environment variables not configured' });
  const headers = { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` };
  try {
    // Every assessed brand name, page by page: one request stops at the
    // server's row cap, and an unchecked name could slip through.
    const allNames = async () => {
      const out = [];
      for (let from = 0; from < 100000; from += 1000) {
        const r = await fetch(`${supabaseUrl}/rest/v1/compass_results?select=brand_name&order=id`, { headers: { ...headers, Range: `${from}-${from + 999}` } });
        if (!r.ok) return null;
        const page = await r.json();
        out.push(...page.map(x => x.brand_name));
        if (page.length < 1000) return out;
      }
      return out;
    };
    const [issueRes, names] = await Promise.all([
      fetch(`${supabaseUrl}/rest/v1/stay_conscious_newsletter?select=newsletter,refreshed_at&order=refreshed_at.desc&limit=1`, { headers }),
      allNames(),
    ]);
    // Without the brand list the landscape text cannot be checked, so none is sent.
    if (!issueRes.ok || !names) return res.status(502).json({ error: 'The issue could not be loaded.' });
    const rows = await issueRes.json();
    res.setHeader('Cache-Control', 'public, s-maxage=900, stale-while-revalidate=3600');
    return res.status(200).json({ newsletter: publicIssue(rows?.[0]?.newsletter, names), refreshedAt: rows?.[0]?.refreshed_at || null, public: true });
  } catch {
    return res.status(500).json({ error: 'The issue could not be loaded.' });
  }
}

export default async function handler(req, res) {
  // The public issue is the one exception to sign-in, and sends only publicIssue().
  if (isPublicRequest(req)) return sendPublicIssue(req, res);
  // Callers must be signed in (v3.100.1); see api/_auth.js.
  if (!(await requireUser(req, res))) return;
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const supabaseUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Server environment variables not configured' });
  }

  try {
    const response = await fetch(
      `${supabaseUrl}/rest/v1/stay_conscious_newsletter?select=*&order=refreshed_at.desc&limit=1`,
      {
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
        },
      }
    );

    if (!response.ok) {
      return res.status(response.status).json({ error: `Supabase error ${response.status}` });
    }

    const rows = await response.json();
    if (!rows || rows.length === 0) {
      return res.status(200).json({ newsletter: null, refreshedAt: null });
    }

    return res.status(200).json({
      newsletter: rows[0].newsletter || null,
      refreshedAt: rows[0].refreshed_at,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
