// Caller checks shared by every endpoint (v3.100.1).
//
// Vercel does not serve files in api/ whose names start with an underscore,
// so this module is importable by the handlers but is not itself a route.
//
// Before this, none of the endpoints checked who was calling: /api/claude
// relayed any prompt on the Anthropic key, and /api/delete-user deleted any
// account for anyone who posted an id. Every request now has to carry the
// caller's Supabase session token, which is verified with Supabase itself.

const supabaseBase = () => (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
const serviceKey = () => process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const header = (req, name) => {
  const h = req.headers || {};
  return h[name] || h[name.toLowerCase()] || h[name.charAt(0).toUpperCase() + name.slice(1)] || '';
};

// The signed-in user behind the request's bearer token, or null.
export async function verifyUser(req, fetchImpl = fetch) {
  const m = /^Bearer\s+(.+)$/i.exec(header(req, 'authorization'));
  const base = supabaseBase();
  const key = serviceKey();
  if (!m || !base || !key) return null;
  try {
    const r = await fetchImpl(`${base}/auth/v1/user`, { headers: { apikey: key, Authorization: `Bearer ${m[1]}` } });
    if (!r.ok) return null;
    const user = await r.json();
    return user && user.id ? user : null;
  } catch {
    return null;
  }
}

// Whether a user's profile carries the admin flag. Read with the service key,
// so a caller cannot answer this about themselves.
export async function isAdmin(userId, fetchImpl = fetch) {
  const base = supabaseBase();
  const key = serviceKey();
  if (!userId || !base || !key) return false;
  try {
    const r = await fetchImpl(`${base}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}&select=is_admin`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });
    if (!r.ok) return false;
    const rows = await r.json();
    return Array.isArray(rows) && rows[0]?.is_admin === true;
  } catch {
    return false;
  }
}

// Whether the request is Vercel's scheduled run. With CRON_SECRET set, Vercel
// sends it as a bearer token and that is the only thing accepted. Without it,
// the cron user agent is accepted so the weekly refreshes keep running, but
// that header can be forged: set CRON_SECRET in Vercel.
export function isCron(req) {
  const secret = process.env.CRON_SECRET;
  if (secret) return header(req, 'authorization') === `Bearer ${secret}`;
  return /vercel-cron/i.test(header(req, 'user-agent'));
}

// Guard for a handler. Returns the caller, or sends 401/403 and returns null.
// Preflight requests pass, so the handlers' own OPTIONS replies still work.
export async function requireUser(req, res, { admin = false, allowCron = false, fetchImpl = fetch } = {}) {
  if (req.method === 'OPTIONS') return { preflight: true };
  if (allowCron && isCron(req)) return { cron: true };
  const user = await verifyUser(req, fetchImpl);
  if (!user) {
    res.status(401).json({ error: 'Sign in required.' });
    return null;
  }
  if (admin && !(await isAdmin(user.id, fetchImpl))) {
    res.status(403).json({ error: 'Admins only.' });
    return null;
  }
  return user;
}
