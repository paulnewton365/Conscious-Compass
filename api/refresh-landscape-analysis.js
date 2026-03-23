// Vercel Cron Job — runs every Sunday at 22:30 UTC
// Queries compass_results from Supabase, computes sector/attribute aggregations,
// calls Claude for analysis, saves to landscape_analysis_cache
// Schedule defined in vercel.json: "30 22 * * 0"
// Also accepts POST for admin-triggered force refresh

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

const MATURITY_LABEL = (score) => {
  if (score >= 85) return 'Transforming';
  if (score >= 70) return 'Leading';
  if (score >= 56) return 'Differentiating';
  if (score >= 40) return 'Establishing';
  if (score >= 26) return 'Foundational';
  return 'Pre-Foundational';
};

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
    // 1. Fetch all compass_results from Supabase
    const resultsRes = await fetch(
      `${supabaseUrl}/rest/v1/compass_results?select=brand_name,industry,business_model,total_score,scores,maturity_level,created_at`,
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

    // 2. Compute sector aggregations
    const grouped = {};
    results.forEach(r => {
      const key = r.industry || 'other';
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(r);
    });

    const sectors = Object.entries(grouped).map(([key, brands]) => {
      const attrAvgs = {};
      ATTRIBUTES.forEach(attr => {
        attrAvgs[attr.id] = Math.round(
          brands.reduce((sum, b) => sum + (b.scores?.[attr.id] || 0), 0) / brands.length
        );
      });
      const avgScore = Math.round(brands.reduce((sum, b) => sum + (b.total_score || 0), 0) / brands.length);
      return { key, name: key, count: brands.length, avgScore, attrAvgs };
    }).sort((a, b) => b.avgScore - a.avgScore);

    // 3. Overall averages
    const overallAvg = {};
    ATTRIBUTES.forEach(attr => {
      overallAvg[attr.id] = Math.round(
        results.reduce((sum, r) => sum + (r.scores?.[attr.id] || 0), 0) / results.length
      );
    });
    const overallScore = Math.round(results.reduce((sum, r) => sum + (r.total_score || 0), 0) / results.length);

    // 4. Cross-sector attribute spread
    const spreadData = ATTRIBUTES.map(attr => {
      const vals = sectors.map(s => s.attrAvgs[attr.id] || 0);
      const min = Math.min(...vals);
      const max = Math.max(...vals);
      const mean = overallAvg[attr.id] || 0;
      const spread = max - min;
      const variance = vals.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / vals.length;
      const stdev = Math.round(Math.sqrt(variance));
      return { attr: attr.id, min, max, mean, spread, stdev };
    }).sort((a, b) => b.spread - a.spread);

    // 5. Build prompt
    const prompt = `You are a senior brand strategist at Antenna Group analysing Brand Consciousness assessment data across multiple sectors. Your job is to interpret what the data is telling us — not to give generic advice, but to read the actual numbers and surface what is genuinely interesting, surprising, or strategically significant.

Brand Consciousness has 8 attributes:
AWAKE (Narrative Leadership), AWARE (Audience Understanding), REFLECTIVE (Authenticity), ATTENTIVE (Experience Quality), COGENT (Strategic Intelligence), SENTIENT (Emotional Connection), VISIONARY (Future Vision), INTENTIONAL (Organisational Credibility).

Maturity stages: 0–25 Pre-Foundational, 26–39 Foundational, 40–55 Establishing, 56–69 Differentiating, 70–84 Leading, 85–100 Transforming.

LANDSCAPE OVERVIEW:
${results.length} brands assessed across ${sectors.length} sectors.
Overall average score: ${overallScore}/100 (${MATURITY_LABEL(overallScore)})

SECTOR AVERAGES (sorted highest to lowest):
${sectors.map(s => `  ${s.name} (${s.count}b): ${s.avgScore}`).join('\n')}

FULL SECTOR × ATTRIBUTE MATRIX:
${sectors.map(s => {
  const row = ATTRIBUTES.map(a => `${a.name.slice(0,3).toUpperCase()}:${s.attrAvgs[a.id]}`).join('  ');
  return `  ${s.name}: ${row}`;
}).join('\n')}

ATTRIBUTE SPREAD ACROSS SECTORS (sorted by divergence — highest spread first):
High spread = sectors diverge significantly. Low spread = universal pattern.
${spreadData.map(c => `  ${c.attr}: spread ${c.spread}pts | min ${c.min} → max ${c.max} | mean ${c.mean} | stdev ${c.stdev}`).join('\n')}

OVERALL ATTRIBUTE AVERAGES (all brands):
${ATTRIBUTES.map(a => `  ${a.id}: ${overallAvg[a.id]}`).join('\n')}

Write a structured analysis. Use plain prose — no bullet points, no markdown headers, no em dashes. Write directly and confidently. Output the sections in exactly this order with exactly these labels on their own line:

LANDSCAPE HEADLINE
A single punchy headline (max 10 words) capturing the single most striking thing about this landscape — the dominant tension, gap, or pattern.

LANDSCAPE SUMMARY
Summarise the overall picture in 2–3 sentences. What maturity level does this landscape represent? Is there a dominant pattern?

SECTOR ANALYSIS
For each sector, one short paragraph describing where it is strong, where it is weak, and what the attribute pattern reveals. Reference specific scores where notable.

KEY INSIGHTS
3–4 insights. Each: a short punchy heading followed by 1–2 sentences. Focus on attributes with high spread, universal gaps, unexpected strengths or contradictions, and what the clustering or spread tells us about maturity across the landscape.`;

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

    // 7. Parse sections
    const extractSection = (label, nextLabel) => {
      const start = text.indexOf(label);
      if (start === -1) return '';
      const end = nextLabel ? text.indexOf(nextLabel, start + label.length) : text.length;
      return text.slice(start + label.length, end === -1 ? text.length : end).trim();
    };

    const analysis = {
      headline: extractSection('LANDSCAPE HEADLINE', 'LANDSCAPE SUMMARY').replace(/^["'*#\s]+|["'*#\s]+$/g, '').trim(),
      summary: extractSection('LANDSCAPE SUMMARY', 'SECTOR ANALYSIS'),
      sectorAnalysis: extractSection('SECTOR ANALYSIS', 'KEY INSIGHTS'),
      insights: extractSection('KEY INSIGHTS', null),
      brandCount: results.length,
      sectorCount: sectors.length,
    };

    // 8. Upsert into Supabase cache (single row, id=1)
    const upsertRes = await fetch(`${supabaseUrl}/rest/v1/landscape_analysis_cache`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        Prefer: 'resolution=merge-duplicates',
      },
      body: JSON.stringify({
        id: 1,
        analysis,
        refreshed_at: new Date().toISOString(),
      }),
    });

    if (!upsertRes.ok) {
      const err = await upsertRes.json().catch(() => ({}));
      throw new Error(err.message || `Supabase upsert error ${upsertRes.status}`);
    }

    return res.status(200).json({
      success: true,
      refreshedAt: new Date().toISOString(),
      brandCount: results.length,
      sectorCount: sectors.length,
    });

  } catch (error) {
    console.error('Landscape analysis refresh failed:', error);
    return res.status(500).json({ error: error.message });
  }
}
