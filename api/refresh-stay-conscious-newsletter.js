// Vercel Cron — runs every Sunday at 23:30 UTC
// Reads stay_conscious_cache, landscape_analysis_cache, insights_analysis_cache,
// picks a lead story, composes the newsletter object, writes to stay_conscious_newsletter.
// Schedule in vercel.json: "30 23 * * 0"
// Also accepts POST for admin force refresh.

import { requireUser } from './_auth.js';
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

// ── Earned creative in the news (v3.124.0) ─────────────────────
// Recent earned creative work by other brands or agencies that is catching
// headlines, found by web search. Every example must carry a link that the
// search itself returned: the model cannot invent a source, because an item
// whose link is not among the search results is dropped. Fewer real examples
// beat a full section of unverifiable ones.
export const EARNED_CREATIVE_PROMPT = `Find three recent examples of earned creative that are catching headlines now, from the last 60 days if possible. Earned creative is an idea designed to be talked about rather than paid to be seen: a brand DID something in the world (a stunt, an installation, a product intervention, a data release, a public act, a partnership) and journalists, creators or the public carried it. Not paid ads, not sponsorships, not press releases on their own.

Prefer work by brands with a purpose, climate, energy, health or social angle, but any strong example will do. Search the trade and business press (for example Adweek, Ad Age, The Drum, Campaign, Fast Company, Marketing Week, Business Insider).

For each example, use only facts from the pages your searches returned. The link must be the article you read about it.

Return JSON only, no prose before or after:
{"examples":[{"brand":"The brand behind the work","agency":"The agency, or empty if none is named","title":"Name of the work, or a plain description","what":"What they did, in one or two sentences.","coverage":"What coverage it generated: who carried it and how widely, from the article. One sentence.","outlet":"The publication of the link","url":"https://..."}]}

US English. No em dashes or en dashes.`;

const normUrl = (u) => {
  try {
    const x = new URL(String(u).trim());
    if (x.protocol !== 'https:' && x.protocol !== 'http:') return null;
    [...x.searchParams.keys()].filter(k => /^utm_|^ref$|^fbclid$|^gclid$/i.test(k)).forEach(k => x.searchParams.delete(k));
    x.hash = '';
    return `${x.protocol}//${x.host.replace(/^www\./, '')}${x.pathname.replace(/\/+$/, '')}${x.search}`.toLowerCase();
  } catch { return null; }
};

// The links the web search actually returned, from result blocks and citations.
export function searchedUrls(content = []) {
  const urls = new Set();
  (content || []).forEach(b => {
    if (b?.type === 'web_search_tool_result' && Array.isArray(b.content)) b.content.forEach(r => { const n = normUrl(r?.url); if (n) urls.add(n); });
    if (b?.type === 'text' && Array.isArray(b.citations)) b.citations.forEach(c => { const n = normUrl(c?.url); if (n) urls.add(n); });
  });
  return urls;
}

const cleanText = (v, n) => String(v ?? '').replace(/\s*[—–]\s*/g, ', ').replace(/\s+/g, ' ').trim().slice(0, n);

export function earnedCreativeFromResponse(data) {
  const content = Array.isArray(data?.content) ? data.content : [];
  const text = content.filter(b => b.type === 'text').map(b => b.text).join('\n');
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return [];
  let parsed;
  try { parsed = JSON.parse(match[0]); } catch { return []; }
  const allowed = searchedUrls(content);
  const seen = new Set();
  return (Array.isArray(parsed?.examples) ? parsed.examples : [])
    .map(e => ({
      brand: cleanText(e?.brand, 80), agency: cleanText(e?.agency, 80), title: cleanText(e?.title, 140),
      what: cleanText(e?.what, 400), coverage: cleanText(e?.coverage, 300), outlet: cleanText(e?.outlet, 80),
      url: String(e?.url || '').trim(),
    }))
    .filter(e => e.brand && e.what && e.url.startsWith('https://') && allowed.has(normUrl(e.url)))
    .filter(e => { const k = e.brand.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; })
    .slice(0, 3);
}

async function fetchEarnedCreative(anthropicKey) {
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': anthropicKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6', max_tokens: 3000, temperature: 0,
        tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 6 }],
        messages: [{ role: 'user', content: EARNED_CREATIVE_PROMPT }],
      }),
    });
    if (!r.ok) return null;
    const items = earnedCreativeFromResponse(await r.json());
    return items.length ? { items, generatedAt: new Date().toISOString() } : null;
  } catch {
    return null;   // the issue still goes out without the section
  }
}

export default async function handler(req, res) {
  // Callers must be signed in (v3.100.1); see api/_auth.js.
  if (!(await requireUser(req, res, { admin: true, allowCron: true }))) return;   // admins or the scheduled run only (v3.124.2)
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
      const headlinePrompt = `You are a brand strategist. Read this landscape analysis and do two things:

1. Write a single punchy headline (max 10 words) capturing the single most striking insight. Output it on one line starting with exactly "HEADLINE: "

2. Rewrite the analysis as exactly two short paragraphs separated by a blank line:
   - Paragraph 1: The big-picture industry trend — what the data says about how brands across sectors are behaving and what pattern is emerging
   - Paragraph 2: The conscious brand attributes story — which attributes are strongest, weakest, most polarising, and what that means

Use plain prose. No bullet points. No headers. No em dashes. Max 200 words total across both paragraphs. Short sentences, plain words, lead with the point. No throat-clearing, no rule-of-three lists, no "not just X but Y", no motivational closers.

ANALYSIS:
${combinedText}`;

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
        headline,
        summary: twoParaSummary,
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
      earnedCreative: await fetchEarnedCreative(anthropicKey),
    };

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
      refreshedAt: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Newsletter refresh failed:', error);
    return res.status(500).json({ error: error.message });
  }
}
