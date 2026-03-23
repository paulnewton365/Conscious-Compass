// Vercel Cron — runs every Sunday at 23:30 UTC
// Reads stay_conscious_cache, landscape_analysis_cache, insights_analysis_cache,
// picks a lead story, composes the newsletter object, writes to stay_conscious_newsletter.
// Schedule in vercel.json: "30 23 * * 0"
// Also accepts POST for admin force refresh.

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const supabaseUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Missing environment variables' });
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

    const newsletter = {
      issueNumber,
      weekOf: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
      leadStory: {
        category: leadItem.category,
        headline: leadItem.headline,
        insight: leadItem.insight,
        whyItMatters: leadItem.whyItMatters,
      },
      intelligenceItems: supportingItems,
      landscapeAnalysis: landscapeAnalysis
        ? {
            headline: landscapeAnalysis.headline || '',
            summary: landscapeAnalysis.summary || '',
            insights: landscapeAnalysis.insights || '',
            brandCount: landscapeAnalysis.brandCount || null,
            sectorCount: landscapeAnalysis.sectorCount || null,
          }
        : null,
      storyOpportunities: storyOpportunities || null,
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
