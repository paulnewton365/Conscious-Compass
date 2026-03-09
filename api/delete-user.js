// Vercel Serverless Function - Deletes a user from Supabase Auth
// Requires SUPABASE_SERVICE_ROLE_KEY (server-side only, never exposed to browser)
// Deleting from auth.users cascades to profiles table via FK relationship

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceRoleKey) {
    return res.status(500).json({ error: 'Service role key not configured on server' });
  }

  const { userId } = req.body;
  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }

  try {
    // Use Supabase Admin API to delete auth user — cascades to profiles row
    const response = await fetch(`${supabaseUrl}/auth/v1/admin/users/${userId}`, {
      method: 'DELETE',
      headers: {
        'apikey': serviceRoleKey,
        'Authorization': `Bearer ${serviceRoleKey}`,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      return res.status(response.status).json({ 
        error: error.message || `Supabase error: ${response.status}` 
      });
    }

    return res.status(200).json({ success: true });

  } catch (error) {
    console.error('Delete user error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
