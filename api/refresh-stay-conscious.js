// Vercel Cron Job — runs every Sunday at 22:00 UTC
// Calls Claude with web search, saves results to Supabase stay_conscious_cache table
// Schedule defined in vercel.json: "0 22 * * 0"

import { requireUser } from './_auth.js';
export const STAY_CONSCIOUS_PROMPT = `You are a brand intelligence analyst advising consultants who use the Conscious Compass framework to evaluate brands based purely on publicly available signals — what audiences, prospects, and partners actually encounter. The framework measures eight attributes: Awake (narrative leadership), Aware (audience understanding), Reflective (authenticity), Attentive (experience quality), Cogent (strategic intelligence), Sentient (emotional resonance), Visionary (purpose), and Intentional (credibility).

Generate exactly 6 "Stay Conscious" intelligence items that brand assessors should be aware of right now. These should be emerging trends, platform changes, new signals, shifting standards, or evolving best practices that affect how a brand is publicly experienced or how it should be rigorously assessed. Be specific and current. Avoid generic marketing platitudes. Write with conviction.

Cover a spread across these categories — use each at most once: AI Visibility, Digital Experience, Brand Strategy, Earned Media, Social Signals, Assessment Practice.

Return ONLY valid JSON — no preamble, no explanation, no markdown fences:
{"items":[{"headline":"...","category":"...","insight":"...","whyItMatters":"..."}]}

Each item:
- headline: punchy, specific, max 12 words
- category: exactly one of: AI Visibility | Digital Experience | Brand Strategy | Earned Media | Social Signals | Assessment Practice
- insight: 2-3 sentences. What is actually happening, with specifics where possible.
- whyItMatters: 1-2 sentences. Why this matters specifically for assessing or building conscious brands from public signals.`;

// ── No repeats (v4.5.0) ───────────────────────────────────────
// Each week's stories are written knowing what earlier issues covered: the
// live issue and recent archived editions. A story may come back only if it
// has moved on or there is a new angle on it, and then it says so: it names
// the earlier story (followUp.ref) and what is new, and the issue links to the
// earlier edition. A story that looks like an earlier one but is not marked
// as a follow-up is replaced, or dropped, in code; the rule does not rely on
// the model remembering it.
const STOP = new Set('a an and are as at be by for from has have how in into is it its new now of on or that the their this to was what when why will with your you brands brand'.split(' '));
const words = (t) => new Set(String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').split(/[^a-z0-9]+/).filter(w => w.length > 2 && !STOP.has(w)));
// Share of the smaller headline's words found in the other: 1 is the same story.
export function headlineOverlap(a, b) {
  const x = words(a); const y = words(b);
  if (!x.size || !y.size) return 0;
  let shared = 0;
  x.forEach(w => { if (y.has(w)) shared += 1; });
  return shared / Math.min(x.size, y.size);
}
export const REPEAT_THRESHOLD = 0.6;
const firstSentence = (t, n = 160) => { const v = String(t || '').replace(/\s+/g, ' ').trim(); const m = v.match(/^.+?[.!?](\s|$)/); return (m ? m[0] : v).trim().slice(0, n); };

// Past stories, newest edition first, one entry per headline. Each edition is
// identified by when it was published, which is how the archive keys it.
export function pastStories(editions = [], max = 60) {
  const out = []; const seen = new Set();
  editions.forEach(ed => {
    const stories = [ed?.lead, ...(Array.isArray(ed?.items) ? ed.items : [])].filter(x => x && x.headline);
    stories.forEach(st => {
      const k = String(st.headline).toLowerCase().trim();
      if (seen.has(k) || out.length >= max) return;
      seen.add(k);
      out.push({ ref: `P${out.length + 1}`, issueNumber: Number(ed.issueNumber) || null, editionAt: ed.editionAt || null,
        headline: String(st.headline).slice(0, 200), category: String(st.category || ''), gist: firstSentence(st.insight) });
    });
  });
  return out;
}

export function historyPromptBlock(past = []) {
  if (!past.length) return '';
  return `

ALREADY COVERED in recent issues (ref, issue, headline, gist):
${past.map(p => `- ${p.ref} | Issue ${p.issueNumber ?? '?'} | ${p.headline} | ${p.gist}`).join('\n')}

Do not repeat any of these. Each item must be a story readers have not had from us. You may return to one of them only if it has materially moved on (new data, a new development, a ruling or launch, a reversal) or you have a genuinely new perspective on it. When you do, add to that item "followUp":{"ref":"P3","whatsNew":"One sentence on what has changed or the new angle."}, and open its insight by acknowledging the earlier coverage in plain words (for example "Two weeks ago we reported X. Since then, Y."). Never present a past story as new.`;
}

// Keeps a followUp only when it names a real past story; finds items that
// repeat a past story without saying so.
export function checkAgainstHistory(items = [], past = []) {
  const byRef = new Map(past.map(p => [p.ref, p]));
  const checked = items.map(it => {
    const ref = String(it?.followUp?.ref || '').trim();
    const p = byRef.get(ref);
    const out = { ...it };
    delete out.followUp;
    if (p) out.followUp = { issueNumber: p.issueNumber, editionAt: p.editionAt, headline: p.headline, whatsNew: String(it.followUp.whatsNew || '').trim().slice(0, 300) };
    return out;
  });
  const repeats = checked
    .map((it, i) => ({ i, match: it.followUp ? null : past.find(p => headlineOverlap(it.headline, p.headline) >= REPEAT_THRESHOLD) }))
    .filter(r => r.match);
  return { items: checked, repeats };
}

const parseItems = (data) => {
  const text = (data.content?.filter(b => b.type === 'text').map(b => b.text).join('\n') || '').trim();
  const clean = text.replace(/```json[\s\S]*?```/g, m => m.slice(7, -3)).replace(/```/g, '').trim();
  const jsonMatch = clean.match(/\{[\s\S]*"items"[\s\S]*\}/);
  const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : clean);
  return Array.isArray(parsed?.items) ? parsed.items : [];
};

// Reads the live issue and the last six months of archived editions. Either
// may be missing (no issue yet, archive table not created): then less history.
async function loadEditions(supabaseUrl, supabaseKey, fetchImpl = fetch) {
  const headers = { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` };
  const get = async (url) => { try { const r = await fetchImpl(url, { headers }); return r.ok ? await r.json() : []; } catch { return []; } };
  const [live, archived] = await Promise.all([
    get(`${supabaseUrl}/rest/v1/stay_conscious_newsletter?select=refreshed_at,issue_number:newsletter->issueNumber,lead:newsletter->leadStory,items:newsletter->intelligenceItems&order=refreshed_at.desc&limit=1`),
    get(`${supabaseUrl}/rest/v1/stay_conscious_newsletter_archive?select=refreshed_at,issue_number,lead:newsletter->leadStory,items:newsletter->intelligenceItems&order=refreshed_at.desc&limit=26`),
  ]);
  return [...(live || []), ...(archived || [])]
    .filter(r => r && r.refreshed_at)
    .filter((r, i, all) => all.findIndex(x => x.refreshed_at === r.refreshed_at) === i)
    .map(r => ({ issueNumber: r.issue_number, editionAt: r.refreshed_at, lead: r.lead, items: r.items }));
}

export default async function handler(req, res) {
  // Callers must be signed in (v3.100.1); see api/_auth.js.
  if (!(await requireUser(req, res, { admin: true, allowCron: true }))) return;   // admins or the scheduled run only (v3.124.2)
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
    const ask = async (prompt) => {
      const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': anthropicKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 2500,
          tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 5 }],
          messages: [{ role: 'user', content: prompt }],
        }),
      });
      if (!claudeRes.ok) {
        const err = await claudeRes.json().catch(() => ({}));
        throw new Error(err.error?.message || `Claude API error ${claudeRes.status}`);
      }
      return parseItems(await claudeRes.json());
    };

    // What earlier issues covered (v4.5.0).
    const past = pastStories(await loadEditions(supabaseUrl, supabaseKey));
    const history = historyPromptBlock(past);
    let { items, repeats } = checkAgainstHistory(await ask(STAY_CONSCIOUS_PROMPT + history), past);
    if (!items.length) throw new Error('No items in Claude response');

    // Stories that repeat an earlier one without saying so are replaced once,
    // in the same categories; any still repeating are left out.
    let replaced = 0;
    if (repeats.length) {
      const swap = await ask(`${STAY_CONSCIOUS_PROMPT}${history}

Write exactly ${repeats.length} replacement item(s), for these categories: ${repeats.map(r => items[r.i].category).join(', ')}. These were rejected because they repeat earlier coverage: ${repeats.map(r => `"${items[r.i].headline}" (same as ${r.match.ref})`).join('; ')}. Also avoid this week's other stories: ${items.filter((_, i) => !repeats.some(r => r.i === i)).map(it => `"${it.headline}"`).join('; ')}.`).catch(() => []);
      const fresh = checkAgainstHistory(swap, past);
      const usable = fresh.items.filter((_, i) => !fresh.repeats.some(r => r.i === i));
      const repeatIdx = new Set(repeats.map(r => r.i));
      const kept = items.filter((_, i) => !repeatIdx.has(i));
      replaced = Math.min(usable.length, repeats.length);
      items = [...kept, ...usable.slice(0, repeats.length)];
    }
    if (!items.length) throw new Error('Every story repeated earlier coverage');
    const parsed = { items };

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
      history: { pastStories: past.length, followUps: parsed.items.filter(i => i.followUp).length, repeatsReplaced: replaced, repeatsDropped: repeats.length - replaced },
      refreshedAt: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Stay Conscious refresh failed:', error);
    return res.status(500).json({ error: error.message });
  }
}
