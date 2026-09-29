// Attach the signed-in user's session token to every call to the app's own
// /api/ endpoints (v3.100.1). The endpoints now refuse requests without one
// (api/_auth.js). Wrapping fetch once covers every call site, including the
// teaser's injected fetch and the Supabase helper's delete call, so none of
// them can be missed. Calls to other hosts pass through untouched.

import { supabase } from './supabase';

export function withSessionToken(fetchImpl, getToken) {
  return async (input, init = {}) => {
    const url = typeof input === 'string' ? input : (input && input.url) || '';
    if (!/^\/api\//.test(url)) return fetchImpl(input, init);
    const token = await getToken();
    if (!token) return fetchImpl(input, init);
    const headers = new Headers(init.headers || (typeof input === 'string' ? undefined : input.headers));
    if (!headers.has('Authorization')) headers.set('Authorization', `Bearer ${token}`);
    return fetchImpl(input, { ...init, headers });
  };
}

export function installApiAuth() {
  if (typeof window === 'undefined' || window.__ccApiAuth) return;
  const original = window.fetch.bind(window);
  window.fetch = withSessionToken(original, async () => {
    try {
      const { data } = await supabase.auth.getSession();
      return data?.session?.access_token || null;
    } catch {
      return null;
    }
  });
  window.__ccApiAuth = true;
}
