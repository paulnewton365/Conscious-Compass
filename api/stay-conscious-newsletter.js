// GET /api/stay-conscious-newsletter
// Returns the composed weekly newsletter from Supabase cache.
// Cache is written by /api/refresh-stay-conscious-newsletter every Sunday at 23:30 UTC.

// Public issue (v3.120.0): GET ?public=1 needs no sign-in and returns only the
// sections safe to publish, by allowlist: the lead story, the brand
// intelligence items and the landscape figures. Story opportunities are
// internal (they are built from the list of assessed brands) and never leave.
// Landscape text that names an assessed brand is dropped as well.

import { requireUser } from './_auth.js';
import { titleCaseAttributes } from '../src/data/attributeGlossary.js';

// Attribute codes read as names publicly: SENTIENT becomes Sentient (v4.1.0).
const str = (v, n = 4000) => (typeof v === 'string' ? titleCaseAttributes(v.slice(0, n)) : '');
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
        .map(e => ({ brand: str(e.brand, 80), agency: str(e.agency, 80), title: str(e.title, 140), what: str(e.what, 600), coverage: str(e.coverage, 300), outlet: str(e.outlet, 80), published: /^\d{4}-\d{2}-\d{2}$/.test(String(e.published || '')) ? e.published : '', url: e.url.slice(0, 600) }))
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

const param = (req, name) => { const v = req.query?.[name] ?? new URL(req.url || '/', 'http://x').searchParams.get(name); return v == null ? '' : String(v); };
const isPublicRequest = (req) => req.method === 'GET' && param(req, 'public') === '1';

// ── Past issues (v4.2.0) ─────────────────────────────────────
// Before each Sunday refresh writes a new issue, the issue that was live is
// copied to stay_conscious_newsletter_archive: one edition per week, as it
// stood at the end of the week. ?archive=list returns the editions, newest
// first; ?issue=<id> returns one of them in place of the current issue. Both
// work on the public link too, through the same publicIssue() filter.
export const ARCHIVE_TABLE = 'stay_conscious_newsletter_archive';
export const archiveId = (req) => (/^\d{1,9}$/.test(param(req, 'issue')) ? Number(param(req, 'issue')) : null);
export const wantsArchiveList = (req) => param(req, 'archive') === 'list';
const ARCHIVE_LIST_SELECT = 'id,issue_number,refreshed_at,week_of:newsletter->>weekOf,headline:newsletter->leadStory->>headline,image:newsletter->leadStory->image->>src';
export const archiveListRow = (r) => ({
  id: r.id, issueNumber: num(r.issue_number), weekOf: str(r.week_of, 60), refreshedAt: r.refreshed_at || null, headline: str(r.headline, 300),
  // The lead story's own image, https only; without one the page shows that edition's house image (v4.2.1).
  image: typeof r.image === 'string' && /^https:\/\//.test(r.image) ? r.image.slice(0, 600) : null,
});
// The current issue, or one archived edition.
const issueUrl = (base, id) => (id
  ? `${base}/rest/v1/${ARCHIVE_TABLE}?select=newsletter,refreshed_at&id=eq.${id}&limit=1`
  : `${base}/rest/v1/stay_conscious_newsletter?select=newsletter,refreshed_at&order=refreshed_at.desc&limit=1`);
async function sendArchiveList(res, supabaseUrl, headers, cacheable) {
  const r = await fetch(`${supabaseUrl}/rest/v1/${ARCHIVE_TABLE}?select=${ARCHIVE_LIST_SELECT}&order=refreshed_at.desc&limit=104`, { headers });
  // No table yet (the SQL has not been run): an empty list, not an error.
  if (!r.ok) return res.status(200).json({ issues: [] });
  if (cacheable) res.setHeader('Cache-Control', 'public, s-maxage=900, stale-while-revalidate=3600');
  return res.status(200).json({ issues: (await r.json()).map(archiveListRow) });
}

async function sendPublicIssue(req, res) {
  const supabaseUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) return res.status(500).json({ error: 'Server environment variables not configured' });
  const headers = { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` };
  try {
    if (wantsArchiveList(req)) return sendArchiveList(res, supabaseUrl, headers, true);
    const id = archiveId(req);
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
      fetch(issueUrl(supabaseUrl, id), { headers }),
      allNames(),
    ]);
    // Without the brand list the landscape text cannot be checked, so none is sent.
    if (!issueRes.ok || !names) return res.status(502).json({ error: 'The issue could not be loaded.' });
    const rows = await issueRes.json();
    if (id && !rows?.length) return res.status(404).json({ error: 'That issue could not be found.' });
    res.setHeader('Cache-Control', 'public, s-maxage=900, stale-while-revalidate=3600');
    return res.status(200).json({ newsletter: publicIssue(rows?.[0]?.newsletter, names), refreshedAt: rows?.[0]?.refreshed_at || null, public: true, ...(id ? { archived: true, archiveId: id } : {}) });
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

  const headers = { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` };
  try {
    if (wantsArchiveList(req)) return sendArchiveList(res, supabaseUrl, headers, false);
    const id = archiveId(req);
    const response = await fetch(issueUrl(supabaseUrl, id), { headers });

    if (!response.ok) {
      return res.status(response.status).json({ error: `Supabase error ${response.status}` });
    }

    const rows = await response.json();
    if (!rows || rows.length === 0) {
      if (id) return res.status(404).json({ error: 'That issue could not be found.' });
      return res.status(200).json({ newsletter: null, refreshedAt: null });
    }

    return res.status(200).json({
      newsletter: rows[0].newsletter || null,
      refreshedAt: rows[0].refreshed_at,
      ...(id ? { archived: true, archiveId: id } : {}),
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
