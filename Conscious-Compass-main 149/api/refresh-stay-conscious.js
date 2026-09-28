// Vercel Cron Job — runs every Sunday at 22:00 UTC
// Calls Claude with web search, saves results to Supabase stay_conscious_cache table
// Schedule defined in vercel.json: "0 22 * * 0"

const STAY_CONSCIOUS_PROMPT = `You are a brand intelligence analyst advising consultants who use the Conscious Compass framework to evaluate brands based purely on publicly available signals — what audiences, prospects, and partners actually encounter. The framework measures eight attributes: Awake (narrative leadership), Aware (audience understanding), Reflective (authenticity), Attentive (experience quality), Cogent (strategic intelligence), Sentient (emotional resonance), Visionary (purpose), and Intentional (credibility).

Generate exactly 6 "Stay Conscious" intelligence items that brand assessors should be aware of right now. These should be emerging trends, platform changes, new signals, shifting standards, or evolving best practices that affect how a brand is publicly experienced or how it should be rigorously assessed. Be specific and current. Avoid generic marketing platitudes. Write with conviction.

Cover a spread across these categories — use each at most once: AI Visibility, Digital Experience, Brand Strategy, Earned Media, Social Signals, Assessment Practice.

Return ONLY valid JSON — no preamble, no explanation, no markdown fences:
{"items":[{"headline":"...","category":"...","insight":"...","whyItMatters":"..."}]}

Each item:
- headline: punchy, specific, max 12 words
- category: exactly one of: AI Visibility | Digital Experience | Brand Strategy | Earned Media | Social Signals | Assessment Practice
- insight: 2-3 sentences. What is actually happening, with specifics where possible.
- whyItMatters: 1-2 sentences. Why this matters specifically for assessing or building conscious brands from public signals.`;

export default async function handler(req, res) {
  // Vercel cron jobs call with GET; also allow POST for manual triggering
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const supabaseUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!anthropicKey || !supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Missing environment variables: ANTHROPIC_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY' });
  }

  try {
    // Call Claude with web search
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
        tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 5 }],
        messages: [{ role: 'user', content: STAY_CONSCIOUS_PROMPT }],
      }),
    });

    if (!claudeRes.ok) {
      const err = await claudeRes.json().catch(() => ({}));
      throw new Error(err.error?.message || `Claude API error ${claudeRes.status}`);
    }

    const data = await claudeRes.json();
    const text = (data.content?.filter(b => b.type === 'text').map(b => b.text).join('\n') || '').trim();
    const clean = text.replace(/```json[\s\S]*?```/g, m => m.slice(7, -3)).replace(/```/g, '').trim();
    const jsonMatch = clean.match(/\{[\s\S]*"items"[\s\S]*\}/);
    const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : clean);

    if (!parsed?.items?.length) {
      throw new Error('No items in Claude response');
    }

    // Upsert into Supabase — single row (id=1), overwrite previous week
    const upsertRes = await fetch(`${supabaseUrl}/rest/v1/stay_conscious_cache`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Prefer': 'resolution=merge-duplicates',
      },
      body: JSON.stringify({
        id: 1,
        items: parsed.items,
        refreshed_at: new Date().toISOString(),
      }),
    });

    if (!upsertRes.ok) {
      const err = await upsertRes.json().catch(() => ({}));
      throw new Error(err.message || `Supabase upsert error ${upsertRes.status}`);
    }

    return res.status(200).json({
      success: true,
      itemCount: parsed.items.length,
      refreshedAt: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Stay Conscious refresh failed:', error);
    return res.status(500).json({ error: error.message });
  }
}
