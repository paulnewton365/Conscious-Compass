// Assessment quality record (v4.19.0): Adequate by default, Thorough for
// checking, correcting and taking time, Thin only for accepting AND racing.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as q from '../src/lib/assessmentQuality.js';

const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const tracker = readFileSync(new URL('../src/lib/qualityTracker.js', import.meta.url), 'utf8');
const supa = readFileSync(new URL('../src/lib/supabase.js', import.meta.url), 'utf8');
const MIN = 60000;

const OBS = 'The homepage leads with the product, not the purpose. The careers page contradicts the values page on flexible working.';
const fullInputs = () => ({
  website: { status: 'complete', content: 'Model analysis of the website.', observations: OBS, autoAssessContent: 'x', seoAssessment: 'x', pagesReviewed: 'x', websiteContent: 'x' },
  social: { status: 'complete', content: 'Model analysis of social.', observations: OBS, socialHealthCheck: 'x', linkedinAuto: 'x', xAuto: 'x', glassdoorAuto: 'x', campaignAuto: 'x', wipoContent: 'x' },
  aiReputation: { status: 'complete', content: 'Model synthesis.', observations: OBS, claudeManual: 'x', chatgptManual: 'x', geminiManual: 'x', perplexityManual: 'x', copilotManual: 'x', wikipediaContent: 'x', redditAnswersContent: 'x', trustpilotContent: 'x', searchSnapshotContent: 'x', googleNewsContent: 'x' },
  earnedMedia: { status: 'complete', content: 'Model analysis of coverage.', observations: OBS, autoAssessContent: 'x', coveragePaste: 'x' },
});

function record({ minutes = { website: 45, social: 35, aiReputation: 50, earnedMedia: 30 }, opened = true, edited = true, autoPerStep = 2 } = {}) {
  const rec = q.newQualityRecord({ name: 'Sam Assessor' });
  q.QUALITY_STEPS.forEach(s => {
    q.addActiveTime(rec, s.id, minutes[s.id] * MIN, 'Sam Assessor');
    for (let i = 0; i < autoPerStep; i++) q.noteField(rec, s.id, `${s.id}-${i}`, { label: `${s.label} field ${i + 1}`, auto: true, opened, edited: edited && i === 0 });
  });
  return rec;
}

test('older assessments are not recorded, not judged', () => {
  const j = q.judgeQuality(null, fullInputs());
  assert.equal(j.label, 'unrecorded');
  assert.equal(q.QUALITY_LABELS.unrecorded.name, 'Not recorded');
});

test('checking, correcting and taking time is Thorough', () => {
  const j = q.judgeQuality(record(), fullInputs());
  assert.equal(j.label, 'thorough', j.reasons.join(' '));
  assert.equal(j.totalMinutes, 160);
  assert.ok(j.reasons.every(r => /[.]$/.test(r)), 'reasons are sentences');
});

test('Adequate is the default: a good assessment that misses one Thorough test', () => {
  const short = record({ minutes: { website: 45, social: 35, aiReputation: 50, earnedMedia: 15 } });
  const j = q.judgeQuality(short, fullInputs());
  assert.equal(j.label, 'adequate');
  assert.match(j.reasons.join(' '), /Earned media under its minimum time/);
  // Corrections not made, but time taken: still Adequate, never Thin.
  const unedited = q.judgeQuality(record({ edited: false }), fullInputs());
  assert.equal(unedited.label, 'adequate');
});

test('Thin needs accepting AND racing, never one alone', () => {
  const fast = { website: 10, social: 8, aiReputation: 12, earnedMedia: 5 };
  // Accepting and racing.
  const thin = q.judgeQuality(record({ minutes: fast, opened: false, edited: false }), fullInputs());
  assert.equal(thin.label, 'thin');
  assert.match(thin.reasons.join(' '), /never opened/);
  assert.match(thin.reasons.join(' '), /Nothing auto-filled was corrected/);
  assert.match(thin.reasons.join(' '), /35 minutes of active time, under the 75/);
  // Racing but checking and correcting: not Thin.
  assert.notEqual(q.judgeQuality(record({ minutes: fast }), fullInputs()).label, 'thin');
  // Accepting but taking time: not Thin.
  assert.notEqual(q.judgeQuality(record({ opened: false, edited: false }), fullInputs()).label, 'thin');
});

test('one step under half its minimum counts as racing', () => {
  const rec = record({ minutes: { website: 60, social: 60, aiReputation: 20, earnedMedia: 30 }, opened: false, edited: false });
  const j = q.judgeQuality(rec, fullInputs());
  assert.equal(j.label, 'thin');
  assert.match(j.reasons.join(' '), /AI reputation took 20 minutes, under half its 45-minute minimum/);
});

test('saying why nothing needed correcting counts as a check', () => {
  const rec = record({ edited: false });
  q.QUALITY_STEPS.forEach(s => q.setNotApplicable(rec, s.id, 'Checked every claim against the site; all stand.', 'Sam Assessor'));
  assert.equal(q.judgeQuality(rec, fullInputs()).label, 'thorough');
  // Too short a reason does not count.
  const rec2 = record({ edited: false });
  q.QUALITY_STEPS.forEach(s => q.setNotApplicable(rec2, s.id, 'fine'));
  assert.equal(q.judgeQuality(rec2, fullInputs()).label, 'adequate');
});

test('own observations: two sentences, not the model\'s words', () => {
  assert.equal(q.ownObservations({ observations: 'Looks fine.' }).reason, 'short');
  const model = 'The brand leads with a clear purpose statement and backs it with three named client results on the homepage.';
  assert.equal(q.ownObservations({ content: model, observations: `${model} It also leads with a clear purpose statement and backs it with named results.` }).reason, 'copied');
  assert.equal(q.ownObservations({ content: model, observations: OBS }).ok, true);
  const inputs = fullInputs();
  inputs.social.observations = '';
  const j = q.judgeQuality(record(), inputs);
  assert.equal(j.label, 'adequate');
  assert.match(j.reasons.join(' '), /own observations missing or too close to the model's on Social/);
});

test('sources: 90% or more for Thorough', () => {
  const inputs = fullInputs();
  ['trustpilotContent', 'googleNewsContent', 'redditAnswersContent'].forEach(k => { inputs.aiReputation[k] = ''; });
  const j = q.judgeQuality(record(), inputs);
  assert.equal(j.label, 'adequate');
  assert.match(j.reasons.join(' '), /19 of 22 sources in/);
  // No social presence declared: fewer sources and a lower minimum.
  const ns = fullInputs();
  ns.social = { ...ns.social, noSocialPresence: true, noSocialNote: 'No accounts found on any network.' };
  const s = q.stepSummary(record(), q.QUALITY_STEPS[1], ns);
  assert.equal(s.min, q.NO_SOCIAL_MIN);
  assert.deepEqual([s.sources.have, s.sources.total], [2, 2]);
});

test('work started before the record existed is judged Adequate', () => {
  const rec = q.newQualityRecord({ name: 'Sam', partial: true });
  const j = q.judgeQuality(rec, fullInputs());
  assert.equal(j.label, 'adequate');
  assert.match(j.reasons[0], /part way through/);
});

test('contributors are listed by time', () => {
  const rec = record();
  q.addActiveTime(rec, 'social', 12 * MIN, 'Alex Helper');
  const j = q.judgeQuality(rec, fullInputs());
  assert.equal(j.contributors[0].name, 'Sam Assessor');
  assert.deepEqual(j.contributors[1], { name: 'Alex Helper', minutes: 12 });
  assert.equal(rec.assessor, 'Sam Assessor', 'the first to work on it is the assessor');
});

test('the live checklist shows what was done, not the judgement', () => {
  const rec = record({ minutes: { website: 12, social: 0, aiReputation: 0, earnedMedia: 0 }, opened: false, edited: false });
  const items = q.stepChecklist(rec, 'website', fullInputs());
  assert.deepEqual(items.map(i => i.id), ['time', 'opened', 'checked', 'own', 'sources']);
  assert.equal(items[0].detail, '12 of 40 minutes');
  assert.equal(items[0].done, false);
  assert.equal(items[1].detail, '0 of 2');
  assert.ok(!items.some(i => /Thin|Thorough|Adequate/.test(`${i.label} ${i.detail}`)));
});

test('admin review: Thin waits for review, resolved stays resolved, more work after reopens it', () => {
  const fast = { website: 10, social: 8, aiReputation: 12, earnedMedia: 5 };
  const rec = record({ minutes: fast, opened: false, edited: false });
  assert.equal(q.needsReview(rec, fullInputs()), true);
  rec.review = { by: 'Admin', at: new Date(Date.now() + 1000).toISOString(), note: 'Spoke to Sam.' };
  assert.equal(q.needsReview(rec, fullInputs()), false);
  rec.updatedAt = new Date(Date.now() + 5000).toISOString();
  assert.equal(q.needsReview(rec, fullInputs()), true);
  // Work that lifts it out of Thin takes it off the list.
  const lifted = record();
  assert.equal(q.needsReview(lifted, fullInputs()), false);
});

test('the client sees the name and date only', () => {
  assert.deepEqual(q.clientAssessedBy(record(), null, '2026-11-04'), { name: 'Sam Assessor', date: '2026-11-04' });
  assert.equal(q.clientAssessedBy(null, null), null);
  assert.ok(app.includes("assessedBy: assessedBy?.name ? { name: String(assessedBy.name), date: assessedBy.date || null } : null,"));
  assert.ok(app.includes('`Assessed by ${payload.assessedBy.name}, Antenna Group'));
  // The payload builder never reads the judgement.
  const payloadFn = app.slice(app.indexOf('function makeClientPayload('), app.indexOf('function ClientLinkModal('));
  assert.ok(!/judgeQuality|quality\.|QUALITY_LABELS/.test(payloadFn));
});

test('wiring: tracker on the four steps, record saved with its judgement, block on the report, admin and saved list', () => {
  assert.ok(app.includes("const QUALITY_STEP_BY_PAGE = { 2: 'website', 3: 'social', 4: 'aiReputation', 5: 'earnedMedia' };"));
  assert.ok(app.includes('<div data-quality-step={qualityStepId || undefined}>'));
  assert.ok(app.includes('{quality?.stepId && <QualityStepBox store={quality.store} stepId={quality.stepId} />}'));
  assert.ok(app.includes("assessmentsToSave.quality = { ...quality, judgement: { label: judgeQuality(quality, assessments).label, at: new Date().toISOString() } };"));
  assert.ok(app.includes('<AssessmentRecordBlock record={assessments.quality || null} assessments={assessments}'));
  assert.ok(app.includes('<AssessmentQualityAdmin currentUser={currentUser}'));
  assert.ok(app.includes('<option value="thin">Thin only</option>'));
  assert.ok(app.includes('Nothing here needed correcting'));
  // No hard stop: nothing in the steps or the report checks the label to block.
  assert.ok(!/label === 'thin'[^\n]*(disabled|return false|canProceed)/.test(app));
  // Active time: two minutes of focus, input, click, key or scroll.
  assert.equal(q.ACTIVE_WINDOW_MS, 120000);
  ['focusin', 'input', 'pointerdown', 'keydown', 'scroll'].forEach(ev => assert.ok(tracker.includes(`'${ev}'`), ev));
  assert.ok(tracker.includes('setTimeout(flush, 0);'), 'the record is not written into an assessment that replaced it');
  // Review is written into the JSON, no new column.
  assert.ok(supa.includes("assessments.quality = { ...(assessments.quality || {}), review };"));
});

test('auto-filled markers match the app\'s own prefixes', async () => {
  const { MEASURED_PREFIX } = await import('../src/lib/searchEvidence.js');
  const { VERIFIED_PREFIX } = await import('../src/lib/wikipediaCheck.js');
  assert.ok(q.isAutoText(`${MEASURED_PREFIX} ...]`));
  assert.ok(q.isAutoText(`${VERIFIED_PREFIX} ...]`));
  assert.ok(q.isAutoText('[Scraped from https://x.com during the teaser]'));
  assert.ok(!q.isAutoText('My own notes'));
});
