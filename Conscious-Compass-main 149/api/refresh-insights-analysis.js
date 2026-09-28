// Vercel Cron Job — runs every Sunday at 23:00 UTC
// Queries compass_results, computes portfolio + sector stats,
// calls Claude for story opportunities, saves to insights_analysis_cache
// Schedule defined in vercel.json: "0 23 * * 0"

const ATTRIBUTES = [
  { id: 'AWAKE',      name: 'Awake' },
  { id: 'AWARE',      name: 'Aware' },
  { id: 'REFLECTIVE', name: 'Reflective' },
  { id: 'ATTENTIVE',  name: 'Attentive' },
  { id: 'COGENT',     name: 'Cogent' },
  { id: 'SENTIENT',   name: 'Sentient' },
  { id: 'VISIONARY',  name: 'Visionary' },
  { id: 'INTENTIONAL',name: 'Intentional' },
];

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const supabaseUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!anthropicKey || !supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Missing environment variables' });
  }

  try {
    // 1. Fetch all compass_results
    const resultsRes = await fetch(
      `${supabaseUrl}/rest/v1/compass_results?select=brand_name,industry,business_model,total_score,maturity_level,scores,created_at`,
      {
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
        },
      }
    );

    if (!resultsRes.ok) throw new Error(`Failed to fetch results: ${resultsRes.status}`);
    const results = await resultsRes.json();

    if (!results || results.length === 0) {
      return res.status(200).json({ success: false, error: 'No assessment data available yet.' });
    }

    // 2. Portfolio-wide stats
    const totalBrands = results.length;
    const avgScore = Math.round(results.reduce((sum, r) => sum + (r.total_score || 0), 0) / totalBrands);

    const attrAverages = {};
    ATTRIBUTES.forEach(attr => {
      attrAverages[attr.id] = Math.round(
        results.reduce((sum, r) => sum + (r.scores?.[attr.id] || 0), 0) / totalBrands
      );
    });
    const sortedAttrs = Object.entries(attrAverages).sort((a, b) => b[1] - a[1]);
    const strongestAttr = sortedAttrs[0];
    const weakestAttr = sortedAttrs[sortedAttrs.length - 1];

    // 3. Sector summaries with full attribute matrix
    const sectorData = {};
    results.forEach(r => {
      const sector = r.industry || 'other';
      if (!sectorData[sector]) {
        sectorData[sector] = { brands: [], scores: [], attrTotals: {} };
        ATTRIBUTES.forEach(a => { sectorData[sector].attrTotals[a.id] = 0; });
      }
      sectorData[sector].brands.push(r.brand_name);
      sectorData[sector].scores.push(r.total_score || 0);
      ATTRIBUTES.forEach(a => {
        sectorData[sector].attrTotals[a.id] += (r.scores?.[a.id] || 0);
      });
    });

    const sectorSummaries = Object.entries(sectorData).map(([sector, data]) => {
      const sAvg = Math.round(data.scores.reduce((a, b) => a + b, 0) / data.scores.length);
      const attrAvgs = {};
      ATTRIBUTES.forEach(a => {
        attrAvgs[a.id] = Math.round(data.attrTotals[a.id] / data.brands.length);
      });
      const sorted = Object.entries(attrAvgs).sort((a, b) => b[1] - a[1]);
      return {
        sector,
        brandCount: data.brands.length,
        avgScore: sAvg,
        attrAvgs,
        strongestAttr: sorted[0],
        weakestAttr: sorted[sorted.length - 1],
        brands: data.brands,
      };
    });

    // 4. Cross-sector spread
    const crossSectorSpread = ATTRIBUTES.map(attr => {
      const vals = sectorSummaries.map(s => s.attrAvgs[attr.id]);
      const min = Math.min(...vals);
      const max = Math.max(...vals);
      const mean = attrAverages[attr.id] || 0;
      return { attr: attr.id, min, max, spread: max - min, mean };
    }).sort((a, b) => b.spread - a.spread);

    // 5. Build prompt
    const prompt = `You are a brand strategist at Antenna Group, a brand strategy agency. You have just run Brand Consciousness assessments on the following brands and you are identifying thought leadership storytelling opportunities — the kinds of stories Antenna Group could write, speak about, or publish based on what the data reveals.

Brand Consciousness is a proprietary framework with 8 attributes:
AWAKE (Narrative Leadership), AWARE (Audience Understanding), REFLECTIVE (Authenticity), ATTENTIVE (Experience Quality), COGENT (Strategic Intelligence), SENTIENT (Emotional Connection), VISIONARY (Future Vision), INTENTIONAL (Organisational Credibility).

PORTFOLIO OVERVIEW (${totalBrands} brands across ${sectorSummaries.length} sectors):
Portfolio average: ${avgScore}/100
Strongest attribute across all brands: ${strongestAttr[0]} (avg ${strongestAttr[1]})
Weakest attribute across all brands: ${weakestAttr[0]} (avg ${weakestAttr[1]})

Overall attribute averages (all brands):
${Object.entries(attrAverages).map(([k, v]) => `  ${k}: ${v}`).join('\n')}

FULL SECTOR ATTRIBUTE MATRIX:
${sectorSummaries.map(s => {
  const row = ATTRIBUTES.map(a => `${a.name.slice(0,3).toUpperCase()}:${s.attrAvgs[a.id]}`).join('  ');
  return `  ${s.sector} (${s.brandCount}b, avg ${s.avgScore}): ${row}`;
}).join('\n')}

CROSS-SECTOR ATTRIBUTE SPREAD (ranked by divergence — highest spread first):
High spread = some sectors lead while others lag significantly. Prime storytelling territory.
Low spread = universal pattern across the portfolio.
${crossSectorSpread.map(c => `  ${c.attr}: spread ${c.spread}pts (low ${c.min} → high ${c.max}, mean ${c.mean})`).join('\n')}

BRANDS ASSESSED:
${results.map(r => `${r.brand_name} (${r.industry || 'unspecified'}, ${r.business_model || ''}, score: ${r.total_score})`).join('\n')}

Based on this data — particularly the full sector attribute matrix, the cross-sector spread, and where sectors diverge or converge on specific attributes — identify 3 to 5 thought leadership stories Antenna Group could tell. Each story should be grounded in a specific pattern, tension, or insight from the data. Prioritise stories that emerge from cross-sector attribute comparisons, unexpected gaps, or attributes with high spread. These should be publishable angles: blog posts, talks, LinkedIn articles, or POV pieces.

For each story write:
- A punchy headline (max 12 words)
- A 2-3 sentence summary of what the story argues and why the data supports it

Return ONLY valid JSON — no preamble, no explanation, no markdown fences:
{"stories":[{"headline":"...","body":"..."}]}`;

    // 6. Call Claude
    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 2000,
        temperature: 0,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!claudeRes.ok) {
      const err = await claudeRes.json().catch(() => ({}));
      throw new Error(err.error?.message || `Claude API error ${claudeRes.status}`);
    }

    const claudeData = await claudeRes.json();
    const text = (claudeData.content?.filter(b => b.type === 'text').map(b => b.text).join('\n') || '').trim();
    const clean = text.replace(/```json[\s\S]*?```/g, m => m.slice(7, -3)).replace(/```/g, '').trim();
    const jsonMatch = clean.match(/\{[\s\S]*"stories"[\s\S]*\}/);
    const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : clean);

    if (!parsed?.stories?.length) throw new Error('No stories in Claude response');

    // 7. Upsert into Supabase cache
    const upsertRes = await fetch(`${supabaseUrl}/rest/v1/insights_analysis_cache`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        Prefer: 'resolution=merge-duplicates',
      },
      body: JSON.stringify({
        id: 1,
        stories: parsed.stories,
        refreshed_at: new Date().toISOString(),
      }),
    });

    if (!upsertRes.ok) {
      const err = await upsertRes.json().catch(() => ({}));
      throw new Error(err.message || `Supabase upsert error ${upsertRes.status}`);
    }

    return res.status(200).json({
      success: true,
      storyCount: parsed.stories.length,
      refreshedAt: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Insights analysis refresh failed:', error);
    return res.status(500).json({ error: error.message });
  }
}
