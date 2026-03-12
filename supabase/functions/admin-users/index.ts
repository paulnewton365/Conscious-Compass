// supabase/functions/admin-users/index.ts
//
// Handles all admin user operations that require the service role key:
//   - create:          create a new auth user + profile
//   - update-password: change a user's password
//   - delete:          permanently delete a user from auth + profiles
//
// Deploy with:  supabase functions deploy admin-users
// ============================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { action, ...payload } = await req.json();

    // ---- Verify the caller is authenticated and is an admin ----
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return json({ error: 'Missing authorization header' }, 401);
    }

    // Caller client (uses their JWT — respects RLS)
    const callerClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user: caller }, error: authError } = await callerClient.auth.getUser();
    if (authError || !caller) return json({ error: 'Unauthorized' }, 401);

    const { data: callerProfile } = await callerClient
      .from('profiles')
      .select('role')
      .eq('id', caller.id)
      .single();

    if (callerProfile?.role !== 'admin') return json({ error: 'Admin access required' }, 403);

    // ---- Service role client (bypasses RLS) ----
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // ---- Route actions ----
    if (action === 'create') {
      const { email, password, name, role } = payload;
      if (!email || !password || !name || !role) return json({ error: 'email, password, name and role are required' }, 400);

      const { data, error } = await admin.auth.admin.createUser({
        email: email.toLowerCase().trim(),
        password,
        email_confirm: true,
      });

      if (error) return json({ error: error.message }, 400);

      const { error: profileError } = await admin.from('profiles').insert({
        id: data.user.id,
        name: name.trim(),
        email: email.toLowerCase().trim(),
        role,
        active: true,
      });

      if (profileError) {
        // Roll back auth user if profile insert fails
        await admin.auth.admin.deleteUser(data.user.id);
        return json({ error: profileError.message }, 400);
      }

      return json({ success: true, userId: data.user.id });
    }

    if (action === 'update-password') {
      const { userId, password } = payload;
      if (!userId || !password) return json({ error: 'userId and password are required' }, 400);

      const { error } = await admin.auth.admin.updateUserById(userId, { password });
      if (error) return json({ error: error.message }, 400);
      return json({ success: true });
    }

    if (action === 'delete') {
      const { userId } = payload;
      if (!userId) return json({ error: 'userId is required' }, 400);

      // Delete from auth.users — profile is cascade deleted via FK
      const { error } = await admin.auth.admin.deleteUser(userId);
      if (error) return json({ error: error.message }, 400);
      return json({ success: true });
    }

    return json({ error: `Unknown action: ${action}` }, 400);

  } catch (err) {
    return json({ error: err.message }, 500);
  }
});

function json(body: object, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
