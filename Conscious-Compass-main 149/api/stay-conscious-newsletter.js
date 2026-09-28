// GET /api/stay-conscious-newsletter
// Returns the composed weekly newsletter from Supabase cache.
// Cache is written by /api/refresh-stay-conscious-newsletter every Sunday at 23:30 UTC.

export default async function handler(req, res) {
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
