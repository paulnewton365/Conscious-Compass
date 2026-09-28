// Vercel Serverless Function - Fetches auth.users data including last_sign_in_at

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const supabaseUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    return res.status(500).json({ error: 'SUPABASE_URL not set', loginMap: {} });
  }
  if (!serviceRoleKey) {
    return res.status(500).json({ error: 'SUPABASE_SERVICE_ROLE_KEY not set', loginMap: {} });
  }

  try {
    const response = await fetch(`${supabaseUrl}/auth/v1/admin/users?per_page=1000`, {
      headers: {
        'apikey': serviceRoleKey,
        'Authorization': `Bearer ${serviceRoleKey}`,
      },
    });

    const body = await response.json().catch(() => null);

    if (!response.ok) {
      return res.status(response.status).json({ 
        error: body?.message || `Supabase returned ${response.status}`,
        loginMap: {}
      });
    }

    const loginMap = {};
    (body?.users || []).forEach(u => {
      loginMap[u.id] = u.last_sign_in_at || null;
    });

    return res.status(200).json({ loginMap });

  } catch (error) {
    return res.status(500).json({ error: error.message, loginMap: {} });
  }
}
