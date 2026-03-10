// GET /api/stay-conscious — returns cached Stay Conscious items from Supabase
// Cache is refreshed weekly by /api/refresh-stay-conscious (Vercel cron)

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
    const response = await fetch(`${supabaseUrl}/rest/v1/stay_conscious_cache?select=*&order=refreshed_at.desc&limit=1`, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
      },
    });

    if (!response.ok) {
      return res.status(response.status).json({ error: `Supabase error ${response.status}` });
    }

    const rows = await response.json();
    if (!rows || rows.length === 0) {
      return res.status(200).json({ items: [], refreshedAt: null });
    }

    return res.status(200).json({
      items: rows[0].items || [],
      refreshedAt: rows[0].refreshed_at,
    });

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
