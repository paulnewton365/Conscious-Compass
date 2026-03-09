// Vercel Serverless Function - Deletes a user from Supabase Auth
// Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Vercel environment variables
// Deleting from auth.users cascades to profiles table via FK relationship

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    return res.status(500).json({ error: 'SUPABASE_URL not configured in Vercel environment variables.' });
  }

  if (!serviceRoleKey) {
    return res.status(500).json({ error: 'SUPABASE_SERVICE_ROLE_KEY not configured in Vercel environment variables.' });
  }

  const { userId } = req.body;
  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }

  // Strip trailing slash from URL
  const baseUrl = supabaseUrl.replace(/\/$/, '');

  try {
    // Use Supabase Management API to delete auth user
    // Works with both old service_role JWT and new sb_secret_ key formats
    const response = await fetch(`${baseUrl}/auth/v1/admin/users/${userId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'apikey': serviceRoleKey,
        'Authorization': `Bearer ${serviceRoleKey}`,
      },
    });

    // 204 No Content = success for DELETE
    if (response.status === 204 || response.ok) {
      return res.status(200).json({ success: true });
    }

    const errorBody = await response.json().catch(() => ({}));
    return res.status(response.status).json({
      error: errorBody.message || errorBody.error_description || `Supabase returned ${response.status}`,
    });

  } catch (error) {
    console.error('Delete user error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
