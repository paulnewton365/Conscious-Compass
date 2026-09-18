// Test stand-in for src/lib/supabase.js. Records teaser calls so tests can
// assert on what the UI asked the database to do.
export const calls = [];
export const state = { teasers: [], saveResult: null };
const ok = (data) => ({ data, error: null });
export const supabase = { auth: { onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }), getSession: async () => ({ data: { session: null } }) } };
const noop = async () => ok(null);
export const signUp = noop, signIn = noop, signOut = noop, getCurrentUser = noop, getProfile = noop,
  fetchCompassResults = async () => ok([]), deleteCompassResult = noop,
  fetchSavedAssessments = async () => ok([]), deleteAssessment = noop,
  fetchAllProfiles = async () => ok([]), updateProfile = noop, approveUser = noop, revokeUser = noop,
  makeAdmin = noop, removeAdmin = noop, setReadonly = noop, deleteUser = noop,
  encryptPayload = noop, decryptPayload = noop, createClientReport = noop, resetClientReportPassword = noop,
  fetchClientReport = noop, listClientReports = async () => ok([]), revokeClientReport = noop;
export const fetchTeasers = async () => { calls.push(['fetchTeasers']); return ok(state.teasers); };
export const fetchTeaser = async (id) => { calls.push(['fetchTeaser', id]); return ok(state.teasers.find(t => t.id === id)); };
export const saveTeaser = async (t) => { calls.push(['saveTeaser', t]); return state.saveResult || ok({ id: t.id || 'new-id', ...t }); };
export const deleteTeaser = async (id) => { calls.push(['deleteTeaser', id]); return { error: null }; };

// Full-assessment writers. A teaser must never call these.
export const saveCompassResult = async (r) => { calls.push(['saveCompassResult', r]); return ok(r); };
export const saveAssessment = async (a) => { calls.push(['saveAssessment', a]); return ok(a); };
