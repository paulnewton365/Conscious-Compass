// Assessment quality record (v4.19.0).
//
// While an assessor works through the four evidence steps, the app keeps a
// small record of how they worked: active time on each step, which auto-filled
// fields they opened, which they corrected, and whether they explained a step
// where nothing needed correcting. From that record and the saved inputs it
// gives one of three judgements:
//
//   Adequate   the default. Most assessments are adequate.
//   Thorough   the assessor checked, corrected and took their time.
//   Thin       the assessor accepted the auto-filled content, corrected
//              nothing AND raced through. Both, never one alone.
//
// The record lives in assessments.quality (JSONB, no schema change). Nothing
// here is shown to a client: the client link carries only the assessor's
// name and the date. Thin is a flag for an admin to look at, never a block.

export const QUALITY_STEPS = [
  { id: 'website', label: 'Website', min: 40 },
  { id: 'social', label: 'Social', min: 30 },
  { id: 'aiReputation', label: 'AI reputation', min: 45 },
  { id: 'earnedMedia', label: 'Earned media', min: 25 },
];

// A step with no social presence declared has little to check.
export const NO_SOCIAL_MIN = 10;

export const THOROUGH = { totalMinutes: 150, sourcesShare: 0.9, stepsChecked: 3 };
export const THIN = { unopenedAuto: 3, totalMinutes: 75, stepShare: 0.5 };

// Focus, input, a click or a scroll within this window counts as active time.
export const ACTIVE_WINDOW_MS = 2 * 60 * 1000;
// A reason for "nothing needed correcting" has to say something.
export const NA_REASON_MIN = 12;
// Observations this close to the model's own analysis are not the assessor's.
export const SIMILAR_LIMIT = 0.5;

export const QUALITY_LABELS = {
  thorough: { name: 'Thorough', tone: 'good', color: '#2F6B55' },
  adequate: { name: 'Adequate', tone: 'mid', color: '#B7791F' },
  thin: { name: 'Thin', tone: 'bad', color: '#C23B22' },
  unrecorded: { name: 'Not recorded', tone: 'none', color: '#8A8E95' },
};

// Text the app itself writes into a field before anyone types: measured
// search evidence, the verified Wikipedia check, a teaser's scraped homepage,
// the Perplexity media audit.
export const AUTO_PREFIXES = ['[Measured: Google search through SerpApi', '[Verified: Wikipedia and Wikidata', '[Scraped from ', '[Media audit: Perplexity web research', '[Perplexity audit:'];
export const isAutoText = (v) => AUTO_PREFIXES.some(p => String(v || '').startsWith(p));

// The evidence sources each step is expected to hold.
const filled = (data, keys) => keys.some(k => String(data?.[k] ?? '').trim());
export function stepSources(stepId, data = {}) {
  if (stepId === 'website') return [
    ['Auto-assess', ['autoAssessContent']],
    ['Search visibility check', ['seoAssessment']],
    ['Pages reviewed', ['pagesReviewed']],
    ['Website content', ['websiteContent']],
    ['Perplexity website audit', ['perplexityContent']],
  ];
  if (stepId === 'social') return data.noSocialPresence ? [
    ['No social presence note', ['noSocialNote']],
    ['WIPO', ['wipoContent']],
  ] : [
    ['Health check', ['socialHealthCheck']],
    ['LinkedIn', ['linkedinAuto', 'linkedinAbout', 'linkedinPosts']],
    ['Other platforms', ['xAuto', 'instagramAuto', 'youtubeAuto', 'otherPlatformsAuto', 'xContent', 'instagramContent', 'youtubeContent']],
    ['Glassdoor', ['glassdoorAuto', 'glassdoorContent']],
    ['Campaigns', ['campaignAuto', 'campaignContent']],
    ['WIPO', ['wipoContent']],
    ['Perplexity social audit', ['perplexityContent']],
  ];
  if (stepId === 'aiReputation') return [
    ['Claude', ['claudeManual']], ['ChatGPT', ['chatgptManual']], ['Gemini', ['geminiManual']],
    ['Perplexity', ['perplexityManual']], ['Copilot', ['copilotManual']],
    ['Wikipedia', ['wikipediaContent']], ['Reddit', ['redditAnswersContent']],
    ['Trustpilot', ['trustpilotContent']], ['Google search', ['searchSnapshotContent']],
    ['Google News', ['googleNewsContent']],
  ];
  if (stepId === 'earnedMedia') return [
    ['Auto-assess', ['autoAssessContent']],
    ['Media audit', ['mediaAuditContent', 'coveragePaste']],
  ];
  return [];
}

export function sourceCoverage(stepId, data = {}) {
  const list = stepSources(stepId, data);
  const have = list.filter(([, keys]) => filled(data, keys)).map(([n]) => n);
  const missing = list.filter(([, keys]) => !filled(data, keys)).map(([n]) => n);
  return { have: have.length, total: list.length, missing };
}

// ── Text checks ──

export function sentenceCount(text) {
  const t = String(text || '').replace(/\s+/g, ' ').trim();
  if (!t) return 0;
  // Bullet lines count as sentences: many assessors write notes as a list.
  const parts = t.split(/(?<=[.!?])\s+|\s+[-•*]\s+/).map(s => s.trim()).filter(s => s.split(' ').length >= 3);
  return parts.length;
}

const words = (t) => String(t || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
// Share of the observation's four-word runs that appear in the model's text.
export function similarTo(a, b) {
  const wa = words(a), wb = words(b);
  if (wa.length < 4 || wb.length < 4) return 0;
  const grams = (w) => { const s = new Set(); for (let i = 0; i + 3 < w.length; i++) s.add(w.slice(i, i + 4).join(' ')); return s; };
  const ga = grams(wa), gb = grams(wb);
  let hit = 0; ga.forEach(g => { if (gb.has(g)) hit++; });
  return ga.size ? hit / ga.size : 0;
}

export function ownObservations(data = {}) {
  const obs = String(data.observations || '').trim();
  if (!obs) return { ok: false, reason: 'none' };
  if (sentenceCount(obs) < 2) return { ok: false, reason: 'short' };
  const model = [data.content, data.autoAssessContent].filter(Boolean).join('\n');
  if (similarTo(obs, model) >= SIMILAR_LIMIT) return { ok: false, reason: 'copied' };
  return { ok: true, reason: null };
}

// ── The record ──

export function newQualityRecord({ name = null, partial = false, now = new Date() } = {}) {
  return { v: 1, startedAt: now.toISOString(), updatedAt: now.toISOString(), assessor: name || null, partial: !!partial, steps: {}, by: {}, note: '', review: null };
}

export function stepRecord(rec, stepId) {
  if (!rec.steps[stepId]) rec.steps[stepId] = { activeMs: 0, fields: {}, na: null };
  return rec.steps[stepId];
}

// The record is held in a ref while a step is open, so these change it in place.
export function addActiveTime(rec, stepId, ms, name = null) {
  if (!rec || !stepId || !(ms > 0)) return rec;
  stepRecord(rec, stepId).activeMs += ms;
  if (name) rec.by[name] = (rec.by[name] || 0) + ms;
  if (!rec.assessor && name) rec.assessor = name;
  rec.updatedAt = new Date().toISOString();
  return rec;
}

export function noteField(rec, stepId, key, patch = {}) {
  if (!rec || !stepId || !key) return rec;
  const f = stepRecord(rec, stepId).fields;
  const cur = f[key] || { label: patch.label || key, auto: false, opened: false, edited: false };
  // Flags only ever turn on: a field once auto-filled stays auto-filled.
  f[key] = {
    label: patch.label || cur.label,
    auto: cur.auto || !!patch.auto,
    opened: cur.opened || !!patch.opened,
    edited: cur.edited || !!patch.edited,
  };
  rec.updatedAt = new Date().toISOString();
  return rec;
}

export function setNotApplicable(rec, stepId, reason, name = null) {
  const r = String(reason || '').trim();
  stepRecord(rec, stepId).na = r ? { reason: r, by: name, at: new Date().toISOString() } : null;
  rec.updatedAt = new Date().toISOString();
  return rec;
}

const mins = (ms) => Math.round((ms || 0) / 60000);

export function stepSummary(rec, step, assessments = {}) {
  const data = assessments?.[step.id] || {};
  const sr = rec?.steps?.[step.id] || { activeMs: 0, fields: {}, na: null };
  const fields = Object.values(sr.fields || {});
  const auto = fields.filter(f => f.auto);
  const unopened = auto.filter(f => !f.opened && !f.edited);
  const edited = auto.filter(f => f.edited).length;
  const naOk = !!(sr.na?.reason && sr.na.reason.length >= NA_REASON_MIN);
  const min = step.id === 'social' && data.noSocialPresence ? NO_SOCIAL_MIN : step.min;
  return {
    id: step.id, label: step.label, min,
    minutes: mins(sr.activeMs), activeMs: sr.activeMs || 0,
    auto: auto.length, opened: auto.length - unopened.length, unopened: unopened.map(f => f.label),
    edited, na: naOk ? sr.na.reason : null, checked: edited > 0 || naOk,
    own: ownObservations(data),
    sources: sourceCoverage(step.id, data),
  };
}

const listNames = (a) => (a.length < 2 ? a.join('') : `${a.slice(0, -1).join(', ')} and ${a[a.length - 1]}`);
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export function judgeQuality(rec, assessments = {}) {
  if (!rec || !rec.v) return { label: 'unrecorded', reasons: ['This assessment was made before the quality record existed.'], steps: [], totalMinutes: 0, contributors: [] };
  const steps = QUALITY_STEPS.map(s => stepSummary(rec, s, assessments));
  const totalMs = steps.reduce((a, s) => a + s.activeMs, 0);
  const totalMinutes = mins(totalMs);
  const contributors = Object.entries(rec.by || {}).sort((a, b) => b[1] - a[1]).map(([name, ms]) => ({ name, minutes: mins(ms) }));
  const base = { steps, totalMinutes, contributors };

  if (rec.partial) {
    return { ...base, label: 'adequate', reasons: ['Recording began part way through this assessment, so it is judged Adequate.'] };
  }

  const autoTotal = steps.reduce((a, s) => a + s.auto, 0);
  const unopened = steps.flatMap(s => s.unopened);
  const editedAny = steps.some(s => s.edited > 0 || s.na);
  const checkedSteps = steps.filter(s => s.checked).length;
  const ownAll = steps.every(s => s.own.ok);
  const src = steps.reduce((a, s) => ({ have: a.have + s.sources.have, total: a.total + s.sources.total }), { have: 0, total: 0 });
  const srcShare = src.total ? src.have / src.total : 1;
  const shortSteps = steps.filter(s => s.minutes < s.min);
  const rushedSteps = steps.filter(s => s.activeMs < s.min * 60000 * THIN.stepShare);

  // Thin: accepting AND racing.
  const accepting = unopened.length >= THIN.unopenedAuto || (autoTotal > 0 && !editedAny);
  const racing = totalMinutes < THIN.totalMinutes || rushedSteps.length > 0;
  if (accepting && racing) {
    const reasons = [];
    if (unopened.length >= THIN.unopenedAuto) reasons.push(`${plural(unopened.length, 'auto-filled field')} ${unopened.length === 1 ? 'was' : 'were'} never opened: ${listNames(unopened.slice(0, 6))}${unopened.length > 6 ? ' and others' : ''}.`);
    if (autoTotal > 0 && !editedAny) reasons.push('Nothing auto-filled was corrected, and no step says why nothing needed correcting.');
    if (totalMinutes < THIN.totalMinutes) reasons.push(`The four steps took ${plural(totalMinutes, 'minute')} of active time, under the ${THIN.totalMinutes} expected at the least.`);
    rushedSteps.forEach(s => reasons.push(`${s.label} took ${plural(s.minutes, 'minute')}, under half its ${s.min}-minute minimum.`));
    return { ...base, label: 'thin', reasons };
  }

  // Thorough: every condition.
  const gaps = [];
  if (unopened.length) gaps.push(`${plural(unopened.length, 'auto-filled field')} not opened`);
  if (checkedSteps < THOROUGH.stepsChecked) gaps.push(`corrections or a reason given on ${checkedSteps} of 4 steps, not ${THOROUGH.stepsChecked}`);
  if (!ownAll) gaps.push(`own observations missing or too close to the model's on ${listNames(steps.filter(s => !s.own.ok).map(s => s.label))}`);
  if (srcShare < THOROUGH.sourcesShare) gaps.push(`${src.have} of ${src.total} sources in`);
  if (totalMinutes < THOROUGH.totalMinutes) gaps.push(`${plural(totalMinutes, 'minute')} of active time, not ${THOROUGH.totalMinutes}`);
  if (shortSteps.length) gaps.push(`${listNames(shortSteps.map(s => s.label))} under ${shortSteps.length === 1 ? 'its' : 'their'} minimum time`);

  if (!gaps.length) {
    return {
      ...base, label: 'thorough',
      reasons: [
        autoTotal ? `Every auto-filled field was opened, and corrections or a reason were given on ${checkedSteps} of 4 steps.` : `Corrections or a reason were given on ${checkedSteps} of 4 steps.`,
        `Own observations on every step, with ${src.have} of ${src.total} sources in.`,
        `${plural(totalMinutes, 'minute')} of active time, with every step at or over its minimum.`,
      ],
    };
  }
  return { ...base, label: 'adequate', reasons: ['Adequate is the default.', `Not yet Thorough: ${gaps.join('; ')}.`] };
}

// The live checklist on a step. No judgement label: just what has been done.
export function stepChecklist(rec, stepId, assessments = {}) {
  const step = QUALITY_STEPS.find(s => s.id === stepId);
  if (!step) return [];
  const s = stepSummary(rec, step, assessments);
  return [
    { id: 'time', label: 'Time on this step', detail: `${s.minutes} of ${s.min} minutes`, done: s.minutes >= s.min },
    { id: 'opened', label: 'Auto-filled content opened', detail: s.auto ? `${s.opened} of ${s.auto}` : 'None so far', done: s.auto === s.opened },
    { id: 'checked', label: 'Corrected, or said why not', detail: s.edited ? `${plural(s.edited, 'correction')}` : s.na ? 'Reason given' : 'Not yet', done: s.checked },
    { id: 'own', label: 'Your own observations', detail: s.own.ok ? 'In your words' : s.own.reason === 'copied' ? 'Too close to the analysis' : s.own.reason === 'short' ? 'Two sentences or more' : 'Not yet', done: s.own.ok },
    { id: 'sources', label: 'Sources in', detail: `${s.sources.have} of ${s.sources.total}`, done: s.sources.total ? s.sources.have / s.sources.total >= THOROUGH.sourcesShare : true },
  ];
}

// For the admin list: is this one flagged and waiting for review?
export function needsReview(rec, assessments) {
  const j = judgeQuality(rec, assessments);
  if (j.label !== 'thin') return false;
  const r = rec?.review;
  // Resolved stays resolved unless the record changed after it.
  return !(r?.at && (!rec.updatedAt || rec.updatedAt <= r.at));
}

// The only part of the record a client sees.
export function clientAssessedBy(rec, fallbackName = null, date = null) {
  const name = rec?.assessor || fallbackName || null;
  if (!name) return null;
  return { name: String(name), date: date || rec?.updatedAt || null };
}
