// Test stand-in for src/lib/supabase.js. Records teaser calls so tests can
// assert on what the UI asked the database to do.
export const calls = [];
export const state = { teasers: [], saveResult: null };
const ok = (data) => ({ data, error: null });
export const supabase = { auth: { onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }), getSession: async () => ({ data: { session: null } }) } };
const noop = async () => ok(null);
export const signUp = noop, signIn = noop, signOut = noop, getCurrentUser = noop, getProfile = noop,
  deleteCompassResult = noop,
  fetchSavedAssessments = async () => ok([]), deleteAssessment = noop,
  fetchAllProfiles = async () => ok([]), updateProfile = noop, approveUser = noop, revokeUser = noop,
  makeAdmin = noop, removeAdmin = noop, setReadonly = noop, deleteUser = noop,
  encryptPayload = noop, decryptPayload = noop, createClientReport = noop, resetClientReportPassword = noop,
  fetchClientReport = noop, listClientReports = async () => ok([]), revokeClientReport = noop;
// Like the real API: the reply is a snapshot taken when the query runs, and
// replies can arrive late. Tests push delays (ms) onto fetchTeasersDelays.
state.fetchTeasersDelays = [];
export const fetchTeasers = async () => {
  calls.push(['fetchTeasers']);
  const snapshot = JSON.parse(JSON.stringify(state.teasers));
  const delay = state.fetchTeasersDelays.shift() || 0;
  if (delay) await new Promise(r => setTimeout(r, delay));
  return ok(snapshot);
};
export const fetchTeaser = async (id) => { calls.push(['fetchTeaser', id]); return ok(JSON.parse(JSON.stringify(state.teasers.find(t => t.id === id)))); };
// Saves persist into state.teasers, like the real table, so a later
// fetchTeasers sees them. Tests that need a canned reply set saveResult.
export const saveTeaser = async (t) => {
  calls.push(['saveTeaser', t]);
  if (state.saveResult) return state.saveResult;
  const row = { ...t, id: t.id || `new-${state.teasers.length + 1}`, updated_at: new Date().toISOString() };
  const i = state.teasers.findIndex(x => x.id === row.id);
  if (i >= 0) state.teasers[i] = { ...state.teasers[i], ...row }; else state.teasers.push(row);
  return ok({ ...row });
};
export const deleteTeaser = async (id) => { calls.push(['deleteTeaser', id]); return { error: null }; };

// Full-assessment writers. A teaser must never call these.
export const saveCompassResult = async (r) => { calls.push(['saveCompassResult', r]); return ok(r); };
export const saveAssessment = async (a) => { calls.push(['saveAssessment', a]); return ok(a); };

// Campaigns
state.campaigns = [];
state.campaignScores = [];
export const fetchCampaigns = async () => { calls.push(['fetchCampaigns']); return ok(state.campaigns); };
export const createCampaign = async (c) => {
  calls.push(['createCampaign', c]);
  if (state.campaigns.some(x => x.name.trim().toLowerCase() === c.name.trim().toLowerCase())) return { data: null, error: { message: 'A campaign with that name already exists.' } };
  const row = { id: `c-${state.campaigns.length + 1}`, name: c.name.trim(), cso_audience: !!c.cso_audience };
  state.campaigns.push(row);
  return ok(row);
};
export const renameCampaign = async (id, name) => { calls.push(['renameCampaign', id, name]); return ok({ id, name }); };
export const deleteCampaign = async (id) => { calls.push(['deleteCampaign', id]); return { error: null }; };
export const fetchCampaignScores = async (id) => { calls.push(['fetchCampaignScores', id]); return ok(state.campaignScores); };

// Full results, as raw compass_results rows. Read by the teaser baseline only.
state.compassRows = [];
export const fetchCompassResults = async () => { calls.push(['fetchCompassResults']); return ok(state.compassRows.map(r => ({ ...r }))); };
export const setCampaignAudience = async (id, cso) => {
  calls.push(['setCampaignAudience', id, cso]);
  const c = state.campaigns.find(x => x.id === id); if (c) c.cso_audience = !!cso;
  return ok(c);
};
