// The media audit on the earned media step (v4.20.0). Runs through
// /api/media-audit (Perplexity), and turns the audit into the text the step
// shows and the blocks the analysis and scoring read.
//
// The audit replaces the "paste three months of coverage" field. Its figures
// are estimates from web search, and it is marked as automated text, so the
// quality record counts it as auto-filled: assessors are expected to open it
// and correct it. A paste box stays for coverage search cannot reach.

export const MEDIA_AUDIT_PREFIX = '[Media audit: Perplexity web research';
// Six months (v4.20.1; 90 days in v4.20.0). Matches api/media-audit.js.
export const MEDIA_AUDIT_DAYS = 182;
export const MEDIA_AUDIT_WINDOW = 'last six months';
const POLL_MS = 6000;
const MAX_WAIT_MS = 15 * 60 * 1000;

const n = (v) => (Number.isFinite(Number(v)) ? Math.max(0, Math.round(Number(v))) : 0);
const pct = (v) => (Number.isFinite(Number(v)) ? Math.max(0, Math.min(100, Math.round(Number(v)))) : 0);
const s = (v, max = 600) => String(v ?? '').replace(/[—–]/g, '-').replace(/\s+/g, ' ').trim().slice(0, max);
const ORIGINS = ['company', 'wire', 'announcement', 'contributed', 'independent'];
const SENTIMENTS = ['positive', 'neutral', 'negative', 'mixed'];
export const ORIGIN_LABELS = {
  company: 'Company release or owned post', wire: 'Wire or syndicated copy', announcement: 'Announcement-led coverage',
  contributed: 'Company-contributed', independent: 'Independent earned or feature',
};

// The peers named in Setup's context, from a line such as
// "Key competitors: Fervo Energy, Zanskar and XGS".
export function peersFromContext(text) {
  const m = /(?:key\s+)?(?:competitors?|peers?|competitive set)\s*(?::|\s-\s)\s*([^\n]+)/i.exec(String(text || ''));
  if (!m) return [];
  return m[1].replace(/\[.*?\]/g, '').split(/,|;|\/|\band\b|\s&\s/i).map(x => x.replace(/[.()]/g, '').trim()).filter(x => x.length > 1 && x.length <= 80).slice(0, 8);
}

// Clamps whatever came back into the shape the app reads.
export function normalizeAudit(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const m = raw.metrics || {};
  const items = (Array.isArray(raw.items) ? raw.items : []).map(i => ({
    date: s(i?.date, 40), outlet: s(i?.outlet, 120), title: s(i?.title, 240),
    url: /^https?:\/\//i.test(String(i?.url || '')) ? String(i.url).trim() : '',
    origin: ORIGINS.includes(i?.origin) ? i.origin : 'announcement',
    sentiment: SENTIMENTS.includes(i?.sentiment) ? i.sentiment : 'neutral',
    note: s(i?.note, 240),
  })).filter(i => i.title || i.outlet).slice(0, 80);
  const sov = raw.shareOfVoice || {};
  return {
    summary: s(raw.summary, 1500),
    announcements: (Array.isArray(raw.announcements) ? raw.announcements : []).map(a => ({ date: s(a?.date, 40), title: s(a?.title, 240), source: s(a?.source, 160) })).slice(0, 12),
    metrics: {
      totalItems: n(m.totalItems) || items.length,
      positive: n(m.positive), neutral: n(m.neutral), negative: n(m.negative), mixed: n(m.mixed),
      announcementLed: n(m.announcementLed), independent: n(m.independent),
    },
    shareOfVoice: {
      peersChosenBy: sov.peersChosenBy === 'agency' ? 'agency' : 'perplexity',
      brandShare: pct(sov.brandShare),
      rank: n(sov.rank) || null,
      peers: (Array.isArray(sov.peers) ? sov.peers : []).map(p => ({ name: s(p?.name, 80), items: n(p?.items), share: pct(p?.share) })).filter(p => p.name).slice(0, 10),
      note: s(sov.note, 400),
    },
    sentiment: s(raw.sentiment, 800),
    narrative: s(raw.narrative, 800),
    topOutlets: (Array.isArray(raw.topOutlets) ? raw.topOutlets : []).map(o => s(o, 80)).filter(Boolean).slice(0, 8),
    findings: (Array.isArray(raw.findings) ? raw.findings : []).map(f => s(f, 400)).filter(Boolean).slice(0, 6),
    items,
    limitations: (Array.isArray(raw.limitations) ? raw.limitations : []).map(f => s(f, 300)).filter(Boolean).slice(0, 4),
  };
}

const share = (a, b) => (a + b ? Math.round((a / (a + b)) * 100) : 0);
export function ratioLine(m) {
  if (!m || !(m.announcementLed + m.independent)) return 'No coverage items found.';
  const r = m.independent ? (m.announcementLed / m.independent).toFixed(1) : null;
  return `${m.announcementLed} announcement-led to ${m.independent} independent${r ? ` (${r} to 1)` : ''}; ${share(m.announcementLed, m.independent)}% announcement-led.`;
}

const dateOnly = (iso) => String(iso || '').slice(0, 10);

// The text the step shows and the assessor can correct. Starts with the
// marker the quality record reads as automated.
export function mediaAuditText(audit, { ranAt = null } = {}) {
  const a = normalizeAudit(audit);
  if (!a) return '';
  const m = a.metrics;
  const sov = a.shareOfVoice;
  const lines = [];
  lines.push(`${MEDIA_AUDIT_PREFIX}, ${MEDIA_AUDIT_WINDOW}${ranAt ? `, run ${dateOnly(ranAt)}` : ''}. Figures are estimates from search, not a monitoring database. Correct anything that is wrong.]`);
  lines.push('');
  if (a.summary) lines.push(a.summary, '');
  lines.push('KEY FIGURES');
  lines.push(`- Coverage items: ${m.totalItems}`);
  lines.push(`- Sentiment: ${m.positive} positive, ${m.neutral} neutral, ${m.mixed} mixed, ${m.negative} negative`);
  lines.push(`- Announcement-led versus independent: ${ratioLine(m)}`);
  if (sov.peers.length || sov.brandShare) {
    lines.push(`- Share of voice: ${sov.brandShare}%${sov.rank ? `, rank ${sov.rank} of ${sov.peers.length + 1}` : ''} (peers ${sov.peersChosenBy === 'agency' ? 'named in Setup' : 'chosen by Perplexity'}: ${sov.peers.map(p => `${p.name} ${p.share}%`).join(', ') || 'none found'})`);
  }
  if (a.topOutlets.length) lines.push(`- Top outlets: ${a.topOutlets.join(', ')}`);
  if (a.announcements.length) {
    lines.push('', 'ANNOUNCEMENTS IN THE WINDOW');
    a.announcements.forEach(x => lines.push(`- ${x.date}: ${x.title}${x.source ? ` (${x.source})` : ''}`));
  }
  if (a.sentiment) lines.push('', 'SENTIMENT', a.sentiment);
  if (a.narrative) lines.push('', 'NARRATIVE', a.narrative);
  if (a.findings.length) { lines.push('', 'FINDINGS'); a.findings.forEach(f => lines.push(`- ${f}`)); }
  if (a.items.length) {
    lines.push('', 'COVERAGE');
    a.items.forEach(i => lines.push(`- ${i.date} | ${i.outlet} | ${i.title} | ${ORIGIN_LABELS[i.origin]} | ${i.sentiment}${i.note ? ` | ${i.note}` : ''}${i.url ? ` | ${i.url}` : ''}`));
  }
  if (a.limitations.length) { lines.push('', 'LIMITATIONS'); a.limitations.forEach(f => lines.push(`- ${f}`)); }
  return lines.join('\n');
}

// What scoring reads: the key figures only, as estimates, counted once with
// the Google News counts and the earned media analysis.
export function mediaAuditPromptBlock(audit) {
  const a = normalizeAudit(audit);
  if (!a) return '';
  const m = a.metrics;
  const sov = a.shareOfVoice;
  return `MEDIA AUDIT (Perplexity web research over the ${MEDIA_AUDIT_WINDOW}; estimates):
- ${m.totalItems} coverage items; sentiment ${m.positive} positive, ${m.neutral} neutral, ${m.mixed} mixed, ${m.negative} negative.
- ${ratioLine(m)}
- Share of voice ${sov.brandShare}%${sov.rank ? `, rank ${sov.rank} of ${sov.peers.length + 1}` : ''} against ${sov.peers.map(p => p.name).join(', ') || 'no named peers'}.
The audit covers six months and the Google News counts the last 90 days; where they overlap, they and the earned media analysis describe the same coverage: count it once. A high announcement-led share is media relations, not media standing (AWAKE, INTENTIONAL); independent coverage that vouches for the brand is evidence for REFLECTIVE and INTENTIONAL.`;
}

// ── Running it ──

export async function startMediaAudit({ brand, url, industry, peers }, fetchImpl = fetch) {
  try {
    const r = await fetchImpl('/api/media-audit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ brand, url, industry, peers }) });
    const body = await r.json().catch(() => ({}));
    if (!r.ok) return { status: 'failed', error: body.error || `HTTP ${r.status}`, notConfigured: !!body.notConfigured };
    return body;
  } catch (e) {
    return { status: 'failed', error: e?.message || 'unreachable' };
  }
}

export async function pollMediaAudit(id, fetchImpl = fetch) {
  try {
    const r = await fetchImpl(`/api/media-audit?${new URLSearchParams({ id })}`);
    const body = await r.json().catch(() => ({}));
    if (!r.ok) return { status: 'failed', error: body.error || `HTTP ${r.status}`, gone: r.status === 404 };
    return body;
  } catch (e) {
    // A dropped connection is not a failed run: keep polling.
    return { status: 'in_progress', transient: e?.message || 'unreachable' };
  }
}

// Polls a run to the end. Never throws. shouldStop lets the caller give up.
export async function waitForMediaAudit(id, { startedAt = Date.now(), fetchImpl = fetch, sleep = (ms) => new Promise(r => setTimeout(r, ms)), shouldStop = () => false, onTick = null } = {}) {
  while (!shouldStop()) {
    const res = await pollMediaAudit(id, fetchImpl);
    if (res.status === 'completed' || res.status === 'failed' || res.status === 'cancelled' || res.status === 'incomplete') {
      return res.status === 'completed' ? { ...res, audit: normalizeAudit(res.audit) } : { status: 'failed', error: res.error || `The run ended as ${res.status}.` };
    }
    if (Date.now() - startedAt > MAX_WAIT_MS) return { status: 'failed', error: 'The media audit took longer than 15 minutes. Run it again.' };
    onTick?.(Date.now() - startedAt);
    await sleep(POLL_MS);
  }
  return { status: 'stopped' };
}
