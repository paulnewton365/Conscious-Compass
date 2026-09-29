// ECO module v1.0: the build packet's fixtures (Part 7) and acceptance checks (Part 8).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as eco from '../src/lib/eco.js';

const near = (a, b, msg) => assert.ok(Math.abs(a - b) < 0.005 + 1e-9, `${msg}: ${a} vs ${b}`);
const A = (o) => ({ AWAKE: o[0], SENTIENT: o[1], AWARE: o[2], VISIONARY: o[3], COGENT: o[4], ATTENTIVE: o[5], INTENTIONAL: o[6], REFLECTIVE: o[7] });
const E = (a) => Object.fromEntries(a.map((v, i) => [`E${i + 1}`, v]));
const Cx = (...ids) => Object.fromEntries(ids.map(i => [i, true]));
const truths = (n) => Array.from({ length: n }, (_, i) => ({ name: `Truth ${i + 1}`, description: `Verified proof point ${i + 1}` }));
const all4 = { riskAppetite: true, spokesperson: true, approval: true, followThrough: true };

const T = {
  T1: { attrs: A([35, 40, 50, 80, 70, 70, 70, 72]), evidence: E([80, 60, 70, 70, 100]), context: Cx('C1', 'C4'), maturityStage: 3,
    gateInputs: { claimsPct: 90, flags: [], glassdoor: 4.0, causeTerritory: null, verifiedTruths: truths(3), checklist: all4 } },
  T2: { attrs: A([40, 45, 55, 75, 65, 65, 55, 65]), evidence: E([70, 50, 60, 40, 60]), context: Cx('C1'), maturityStage: 4,
    gateInputs: { claimsPct: 85, flags: [], glassdoor: 3.5, causeTerritory: null, verifiedTruths: truths(2), checklist: { riskAppetite: true, spokesperson: true, approval: true, followThrough: false } } },
  T3: { attrs: A([38, 42, 45, 70, 60, 60, 62, 40]), evidence: E([75, 70, 65, 70, 100]), context: Cx('C3'), maturityStage: 3,
    gateInputs: { claimsPct: 70, flags: [], glassdoor: 3.9, causeTerritory: null, verifiedTruths: truths(2), checklist: all4 } },
  T4: { attrs: A([35, 40, 40, 45, 40, 45, 50, 60]), evidence: E([80, 80, 80, 0, 100]), context: Cx('C2'), maturityStage: 2,
    gateInputs: { claimsPct: 80, flags: [], glassdoor: 3.8, causeTerritory: null, verifiedTruths: truths(1), checklist: { riskAppetite: true, spokesperson: true, approval: true, followThrough: false } } },
  T5: { attrs: A([78, 74, 72, 76, 70, 75, 72, 78]), evidence: E([30, 10, 30, 40, 20]), context: {}, maturityStage: 5,
    gateInputs: { claimsPct: 95, flags: [], glassdoor: 4.2, causeTerritory: null, verifiedTruths: truths(3), checklist: all4 } },
  T6: { attrs: A([40, 45, 50, 72, 65, 65, 60, 68]), evidence: E([70, 60, null, 70, 100]), context: Cx('C4', 'C5'), maturityStage: 4, stakeholder: 'regulators and utilities',
    gateInputs: { claimsPct: 88, flags: [], glassdoor: 3.9, causeTerritory: { name: 'Grid decarbonization', link: 'direct' }, verifiedTruths: truths(2), checklist: all4 } },
  T7: { attrs: A([30, 45, 50, 72, 35, 40, 40, 62]), evidence: E([null, 90, 70, 70, null]), context: Cx('C1', 'C2'), maturityStage: 1, profile: 'Startup',
    gateInputs: { claimsPct: 80, flags: [], glassdoor: null, causeTerritory: null, verifiedTruths: truths(2), checklist: { founder: true, riskAppetite: true, approval: true, deliveryPlan: false } } },
};
const run = (f, extra = {}) => eco.runEco({ ...f, ...extra });

test('T1 clear Recommend', () => {
  const r = run(T.T1);
  near(r.scores.visibility, 39.75, 'V'); near(r.scores.substance, 73.5, 'S'); near(r.scores.deficit, 60.25, 'D');
  near(r.scores.gap, 84.375, 'G'); near(r.scores.evidence, 76, 'E'); assert.equal(r.scores.context, 50); near(r.needRating, 70.03, 'Need');
  assert.equal(r.needBand, 'High');
  assert.deepEqual(r.primaryTriggers, ['VISIONARY', 'COGENT', 'AWAKE']);
  assert.ok(Object.values(r.gate.criteria).every(c => c.result === 'Pass')); assert.equal(r.gate.result, 'Pass');
  assert.equal(r.outcome, 'Recommend'); assert.equal(r.ambitionLevel, 'B');
  assert.deepEqual(r.howlIntro, { length: 'full', opener: 'standard' });
});

test('T2 Recommend with conditions', () => {
  const r = run(T.T2);
  near(r.scores.visibility, 44.75, 'V'); near(r.scores.substance, 66.5, 'S'); near(r.needRating, 52.03, 'Need');
  assert.equal(r.needBand, 'High'); assert.deepEqual(r.primaryTriggers, ['VISIONARY', 'COGENT', 'AWAKE']);
  assert.equal(r.gate.criteria.G2.result, 'Conditional'); assert.equal(r.gate.criteria.G5.result, 'Conditional');
  assert.equal(r.gate.result, 'Conditional'); assert.equal(r.outcome, 'Recommend with conditions'); assert.equal(r.ambitionLevel, 'B');
  assert.deepEqual(r.howlIntro, { length: 'full', opener: 'standard' });
  const blocks = eco.buildReportSection(r, { brand: 'Acme', gateInputs: T.T2.gateInputs, evidence: T.T2.evidence });
  // v3.105.0: shown as a ladder. Ready at Partnered; Bold opens once the two conditions are met.
  const ladder = blocks.find(b => b.id === 'ladder');
  assert.equal(ladder.ready, 'partnered');
  assert.equal(ladder.steps.find(s => s.state === 'reach').unlock, 'Bold opens once the steps below are done.');
  assert.equal(blocks.find(b => b.id === 'conditions').items.length, 2);
});

test('T3 Build substance first (G1 fail)', () => {
  const r = run(T.T3);
  near(r.needRating, 57.79, 'Need'); assert.equal(r.needBand, 'High');
  assert.equal(r.gate.criteria.G1.result, 'Fail'); assert.equal(r.gate.result, 'Not yet');
  assert.equal(r.outcome, 'Build substance first'); assert.equal(r.ambitionLevel, null);
  assert.deepEqual(r.routedServices, ['REFLECTIVE authenticity and reputation services; claims substantiation']);
  assert.equal(r.howlIntro.length, 'short');
});

test('T4 substance floor triggered', () => {
  const r = run(T.T4);
  near(r.scores.substance, 44.75, 'S'); near(r.uncappedNeed, 43.73, 'uncapped'); near(r.needRating, 43.73, 'Need');
  assert.equal(r.substanceFloorApplied, true); assert.equal(r.needBand, 'Low');
  assert.equal(r.gate.criteria.G4.result, 'Conditional'); assert.equal(r.gate.criteria.G5.result, 'Conditional'); assert.equal(r.gate.result, 'Conditional');
  assert.equal(r.outcome, 'Moment-driven'); assert.equal(r.ambitionLevel, 'A'); assert.equal(r.howlIntro.length, 'short');
  const ids = eco.buildReportSection(r, { brand: 'Acme', gateInputs: T.T4.gateInputs }).map(b => b.id);
  assert.ok(ids.includes('conditions'), 'block 6 shows for Moment-driven with a Conditional gate');
});

test('T5 Moment-driven, strong scores everywhere', () => {
  const r = run(T.T5);
  near(r.needRating, 13.74, 'Need'); assert.equal(r.needBand, 'Low'); assert.deepEqual(r.primaryTriggers, []);
  assert.equal(r.gate.result, 'Pass'); assert.equal(r.outcome, 'Moment-driven'); assert.equal(r.ambitionLevel, 'C'); assert.equal(r.howlIntro.length, 'short');
});

test('T6 B2B energy, no social data, cause territory', () => {
  const r = run(T.T6);
  near(r.scores.evidence, 75, 'E over four indicators'); near(r.needRating, 58.61, 'Need'); assert.equal(r.needBand, 'High');
  assert.deepEqual(r.primaryTriggers, ['VISIONARY', 'COGENT', 'AWAKE']);
  assert.equal(r.gate.result, 'Pass'); assert.equal(r.outcome, 'Recommend'); assert.equal(r.ambitionLevel, 'C');
  assert.deepEqual(r.howlIntro, { length: 'full', opener: 'sustainability' });
  const ben = eco.buildReportSection(r, { brand: 'GridCo', gateInputs: T.T6.gateInputs, stakeholder: T.T6.stakeholder, context: T.T6.context }).find(b => b.id === 'benefits').items;
  assert.ok(ben.some(b => b.trigger === 'Cause'), 'cause add-on');
  assert.ok(ben.find(b => b.trigger === 'Cause').text.includes('regulators and utilities care about'), 'stakeholder language');
});

test('T7 startup the standard profile would shut out, and the contrast check', () => {
  const r = run(T.T7);
  near(r.scores.substance, 49.95, 'S'); assert.equal(r.substanceFloorApplied, false, 'VISIONARY 72 clears the floor');
  near(r.needRating, 50.16, 'Need'); assert.equal(r.needBand, 'High');
  assert.deepEqual(r.primaryTriggers, ['VISIONARY', 'AWAKE', 'SENTIENT']);
  assert.equal(r.gate.criteria.G2.result, 'Pass'); assert.equal(r.gate.criteria.G2.limitedEvidence, true);
  assert.equal(r.gate.criteria.G5.result, 'Conditional'); assert.equal(r.gate.result, 'Conditional');
  assert.equal(r.outcome, 'Recommend with conditions'); assert.equal(r.ambitionLevel, 'A');
  assert.deepEqual(r.howlIntro, { length: 'full', opener: 'startup' }); assert.equal(r.analystReviewRequired, false);
  const std = run({ ...T.T7, profile: 'Standard', gateInputs: { ...T.T7.gateInputs, checklist: { riskAppetite: true, spokesperson: false, approval: true, followThrough: false } } });
  assert.equal(std.needRating, 49); assert.equal(std.substanceFloorApplied, true); assert.equal(std.needBand, 'Low');
  assert.equal(std.gate.criteria.G5.result, 'Fail'); assert.equal(std.gate.result, 'Not yet'); assert.equal(std.outcome, 'Not a current priority');
});



// ── Acceptance checks ────────────────────────────────────────

test('missing inputs are excluded and re-averaged, never zero or maximum', () => {
  const none = eco.runEco({ ...T.T1, evidence: {} });
  const withE = run(T.T1);
  assert.equal(none.scores.evidence, null);
  near(none.needRating, (0.40 * none.scores.deficit + 0.35 * none.scores.gap + 0.10 * none.scores.context) / 0.85, 'weights re-normalised');
  assert.notEqual(none.needRating, withE.needRating);
});

test('a criterion with no inputs is Pending, and the outcome waits for the analyst', () => {
  const r = eco.runEco({ attrs: T.T1.attrs, maturityStage: 3 });
  assert.equal(r.gate.criteria.G4.result, 'Pending'); assert.equal(r.gate.result, 'Pending');
  assert.equal(r.outcome, null); assert.equal(r.analystReviewRequired, true);
});

test('stage 1 standard brands convert a Recommend to Build substance first (Resolution 1)', () => {
  const r = run({ ...T.T1, maturityStage: 1 });
  assert.equal(r.outcome, 'Build substance first');
  assert.deepEqual(r.routedServices, ['REFLECTIVE claims substantiation; proof-point development']);
});

test('the app maps six maturity stages onto five, and startup from the company stage', () => {
  assert.deepEqual(['Pre-Foundational', 'Foundational', 'Establishing', 'Differentiating', 'Leading', 'Transforming'].map(eco.ecoStageFor), [1, 1, 2, 3, 4, 5]);
  assert.equal(eco.ecoProfileFor('startup'), 'Startup'); assert.equal(eco.ecoProfileFor('scaleup'), 'Standard');
  assert.equal(eco.ecoProfileFor('scaleup', 'Startup'), 'Standard', 'no analyst choice: the company stage decides');
});

test('the lite view uses D and G only and marks the gate as needing the full assessment', () => {
  const { eco: r, blocks } = eco.buildLiteSection(T.T1.attrs, 'Acme');
  near(r.needRating, (0.533 * r.scores.deficit + 0.467 * r.scores.gap) / 1.0, 'lite need');
  assert.equal(r.gate.result, 'Requires full assessment');
  assert.equal(blocks.find(b => b.id === 'size').size, 'Significant');
  const lad = blocks.find(b => b.id === 'ladder');
  assert.equal(lad.ready, null); assert.ok(lad.steps.every(s => s.state === 'later'), 'no starting step without the gate');
  assert.match(lad.note, /set by the full assessment/);
  assert.equal(blocks.find(b => b.id === 'howl').text, eco.ECO_CONFIG.copy.howlOpeners.standard);
});

test('every brand gets the opportunity ladder; the step it starts on follows the outcome (v3.105.0)', () => {
  const sec = (f, extra) => eco.buildReportSection(run(f, extra), { brand: 'Acme', gateInputs: f.gateInputs, evidence: f.evidence });
  const ladder = (bl) => bl.find(b => b.id === 'ladder').steps.map(s => `${s.name}:${s.state}`).join(' ');
  const t1 = sec(T.T1);
  assert.deepEqual(t1.map(b => b.id), ['headline', 'size', 'ladder', 'why', 'definition', 'benefits', 'appropriate', 'conditions', 'rawMaterial', 'howl', 'next']);
  assert.equal(ladder(t1), 'Foundations:done Evidence-led:done Partnered:ready Bold:reach');
  assert.ok(t1.find(b => b.id === 'conditions').items.includes('Bold opens at the Leading stage.'));
  const t3 = sec(T.T3);
  assert.equal(ladder(t3), 'Foundations:ready Evidence-led:reach Partnered:later Bold:later', 'G1 fails: starts at Foundations');
  assert.equal(t3.find(b => b.id === 'howl').length, 'short');
  assert.ok(!t3.some(b => b.id === 'appropriate'), 'no credibility claim before the proof');
  const t5 = sec(T.T5);
  assert.equal(ladder(t5), 'Foundations:done Evidence-led:done Partnered:done Bold:ready');
  assert.equal(t5.find(b => b.id === 'size').size, 'Targeted');
  assert.equal(t5.find(b => b.id === 'howl').length, 'full', 'HOWL scaled to the step, not the size');
  // A brand the packet called "Not a current priority" still sees its opportunity.
  const np = eco.runEco({ ...T.T7, profile: 'Standard', gateInputs: { ...T.T7.gateInputs, checklist: { riskAppetite: true, approval: true } } });
  assert.equal(np.outcome, 'Not a current priority');
  const npb = eco.buildReportSection(np, { brand: 'Acme', gateInputs: T.T7.gateInputs });
  assert.equal(npb[0].text, 'Acme has an earned creative opportunity. Here is how far it can go today, and what would take it further.');
  assert.equal(npb.find(b => b.id === 'ladder').ready, 'foundations');
  assert.ok(npb.some(b => b.id === 'howl'), 'HOWL for every brand');
  for (const f of [T.T1, T.T3, T.T5]) assert.ok(!JSON.stringify(sec(f)).includes('not a priority'), 'nothing reads as optional');
});

test('ladder examples come from the brand\'s own material, and differ step to step', () => {
  const r = run(T.T6);
  const steps = eco.buildReportSection(r, { brand: 'GridCo', gateInputs: T.T6.gateInputs }).find(b => b.id === 'ladder').steps;
  assert.equal(steps[1].example, 'A public release of Truth 1, in a form journalists and peers can use.');
  assert.equal(steps[2].example, 'A program co-created with a credible partner in Grid decarbonization, built on Truth 2.');
  const bare = eco.buildReportSection(run(T.T5, { gateInputs: { ...T.T5.gateInputs } }), { brand: 'X' }).find(b => b.id === 'ladder').steps;
  assert.equal(bare[0].example, 'Document two proof points a journalist could verify independently.', 'generic when there is no material');
});

test('no em dashes anywhere in the module copy', () => {
  const src = readFileSync(new URL('../src/lib/eco.js', import.meta.url), 'utf8');
  assert.ok(!src.includes('\u2014'));
});

// ── Stage 2: the lift, the report helper, and the wiring ─────

const scored = (over = {}) => Object.fromEntries(Object.entries({ AWAKE: 35, SENTIENT: 40, AWARE: 50, VISIONARY: 80, COGENT: 70, ATTENTIVE: 70, INTENTIONAL: 70, REFLECTIVE: 72, ...over }).map(([k, v]) => [k, { score: v }]));

test('the earned creative lift: +3 to SENTIENT and INTENTIONAL once, capped at 100, removable', () => {
  const acts = { activations: [{ name: 'Open grid data', what: 'Released five years of grid data', evidence: 'Canary Media, March 2026' }, { name: 'Second', what: 'x', evidence: 'y' }] };
  const s = eco.applyEarnedCreativeLift({ ...scored({ INTENTIONAL: 99 }), earnedCreative: acts }, '2.11');
  assert.equal(s.SENTIENT.score, 43, 'once, however many activations');
  assert.equal(s.INTENTIONAL.score, 100, 'capped');
  assert.equal(s.INTENTIONAL.earnedCreativeLiftApplied, 1, 'records what was really applied');
  assert.equal(s.AWAKE.score, 35, 'no other attribute moves');
  assert.equal(s.earnedCreative.confirmedCount, 2);
  const again = eco.applyEarnedCreativeLift(s, '2.11');
  assert.equal(again.SENTIENT.score, 43, 'applying twice never double counts');
  const removed = eco.applyEarnedCreativeLift({ ...s, earnedCreative: { activations: s.earnedCreative.activations.map(a => ({ ...a, removed: true })) } });
  assert.equal(removed.SENTIENT.score, 40, 'removing every activation takes the lift away');
  const none = eco.applyEarnedCreativeLift({ ...scored(), earnedCreative: { activations: [] } });
  assert.equal(none.SENTIENT.score, 40);
});

test('the lift stacks on the campaign coherence modifier', () => {
  const withCampaign = { ...scored(), SENTIENT: { baseScore: 40, campaignModifierApplied: 2, score: 42 } };
  const s = eco.applyEarnedCreativeLift({ ...withCampaign, earnedCreative: { activations: [{ name: 'A' }] } });
  assert.equal(s.SENTIENT.score, 45, 'base 40 + campaign 2 + earned creative 3');
  assert.equal(s.SENTIENT.baseScore, 40);
});



test('the scoring pass lists activations, and the lift is applied in code after the campaign modifiers', () => {
  const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
  assert.ok(app.includes('"earnedCreative": {\n    "activations": ['), 'the schema asks for the list');
  assert.ok(app.includes('EARNED CREATIVE IN USE (framework 2.11)'));
  assert.ok(app.includes('Do not change any score because of this list'), 'the model never applies it');
  assert.ok(app.includes('applyEarnedCreativeLift(applyCampaignModifiers(parsed, level), FRAMEWORK_VERSION)'), 'campaign first, then the lift');
});

test('the client payload carries the ECO text blocks only', () => {
  const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
  const at = app.indexOf('function makeClientPayload(');
  const fn = app.slice(at, app.indexOf('\nfunction ', at + 10));
  assert.ok(fn.includes('return result.outcome && blocks.length ? { blocks } : null;'));
  assert.ok(!/eco: scores\??\.eco/.test(fn), 'the analyst inputs are never copied across');
});

test('two substance triggers cite different assets', () => {
  const r = run(T.T6);
  const why = eco.buildReportSection(r, { brand: 'GridCo', gateInputs: T.T6.gateInputs }).find(b => b.id === 'why').text;
  assert.ok(why.includes('including Truth 1, is not yet visible') && why.includes('including Truth 2, that could become'), why);
});


// ── v3.107.0: evidence only, no overrides ────────────────────
// The packet's T8 and T9 tested overrides. Overrides are removed: nothing an
// analyst asserts can move the verdict, and overrides saved before are ignored.
test('T8/T9 replaced: an override in the input changes nothing, accepted or not', () => {
  const plain = run(T.T5);
  const withOverride = run(T.T5, { override: { outcome: 'Recommend', reason: 'Category-first product launch creates a clear moment.' } });
  assert.equal(withOverride.outcome, plain.outcome);
  assert.equal(withOverride.ambitionLevel, plain.ambitionLevel);
  assert.equal('override' in withOverride, false);
  assert.equal(run(T.T3, { override: { outcome: 'Recommend', reason: 'x' } }).outcome, 'Build substance first');
  assert.equal(typeof eco.validateOverride, 'undefined', 'the function is gone');
});


// ── v3.110.0: recommendations from observed evidence, no inputs ──

const obsScores = (evidence, over = {}) => ({ ...Object.fromEntries(Object.entries({ AWAKE: 35, SENTIENT: 40, AWARE: 50, VISIONARY: 80, COGENT: 70, ATTENTIVE: 70, INTENTIONAL: 70, REFLECTIVE: 72, ...over }).map(([k, v]) => [k, { score: v }])), earnedCreativeEvidence: evidence });

test('a report scored before the evidence was recorded shows nothing until rescored', () => {
  const r = eco.ecoFromReport(obsScores(undefined), { brand: 'Acme', companyStage: 'scaleup', stageName: 'Differentiating' });
  assert.equal(r.result.gate.criteria.G4.result, 'Pending'); assert.deepEqual(r.blocks, []);
});

test('observed evidence drives the gate; proof and readiness rest on the scores', () => {
  const ev = { verifiedTruths: [{ name: 'Grid pilot data set', description: 'Published with the utility commission', source: 'Utility Dive, March 2026' }, { name: 'Patent US1234567', description: 'Storage control', source: 'USPTO' }],
    redFlags: [], causeTerritory: { name: 'Grid decarbonization', link: 'direct' } };
  const r = eco.ecoFromReport(obsScores(ev), { brand: 'GridCo', companyStage: 'leader', stageName: 'Differentiating' });
  const c = r.result.gate.criteria;
  assert.deepEqual(['G1', 'G2', 'G3', 'G4', 'G5'].map(id => c[id].result), ['Pass', 'Pass', 'Pass', 'Pass', 'Pass']);
  assert.equal(c.G1.limitedEvidence, true, 'REFLECTIVE only'); assert.equal(c.G5.limitedEvidence, true, 'INTENTIONAL only');
  assert.equal(r.result.scores.evidence, null); assert.equal(r.result.scores.context, null, 'no internal-only inputs');
  assert.ok(Math.abs(r.result.needRating - (0.40 * r.result.scores.deficit + 0.35 * r.result.scores.gap) / 0.75) < 1e-9, 'need rests on D and G');
  assert.ok(r.blocks.find(b => b.id === 'rawMaterial').items[0].startsWith('Grid pilot data set'));
  const flagged = eco.ecoFromReport(obsScores({ ...ev, redFlags: [{ label: 'Lobbying against a clean energy bill', major: true, resolved: false, source: 'InfluenceMap' }] }), { brand: 'GridCo', companyStage: 'leader', stageName: 'Differentiating' });
  assert.equal(flagged.result.gate.criteria.G2.result, 'Fail');
  assert.equal(flagged.blocks.find(b => b.id === 'ladder').ready, 'foundations', 'a major unresolved flag keeps it at Foundations');
});

test('whatever an old report carried in its inputs panel is ignored', () => {
  const ev = { verifiedTruths: [{ name: 'A' }, { name: 'B' }], redFlags: [], causeTerritory: null };
  const clean = eco.ecoFromReport(obsScores(ev), { brand: 'X', companyStage: 'leader', stageName: 'Leading' });
  const old = eco.ecoFromReport({ ...obsScores(ev), eco: { claimsPct: 10, checklistEntered: true, checklist: {}, context: { C1: true }, override: { outcome: 'Recommend', reason: 'x' }, profile: 'Startup', announcementPct: 99 } }, { brand: 'X', companyStage: 'leader', stageName: 'Leading' });
  assert.deepEqual(old.result.outcome, clean.result.outcome); assert.equal(old.profile, 'Standard'); assert.equal(old.result.needRating, clean.result.needRating);
});

test('the evidence parser keeps only named, checkable items', () => {
  const p = eco.parseObservedEvidence({ verifiedTruths: [{ name: ' X ', description: 'd' }, { name: '' }, null], redFlags: [{ label: 'Y', major: 'yes' }], causeTerritory: { name: 'Z', link: 'sideways' } });
  assert.deepEqual(p.verifiedTruths.map(t => t.name), ['X']);
  assert.equal(p.redFlags[0].major, false, 'only a true boolean counts as major');
  assert.equal(p.causeTerritory.link, 'adjacent');
  assert.equal(eco.parseObservedEvidence(null), null);
});

test('the scoring pass records the evidence, observed only', () => {
  const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
  assert.ok(app.includes('"earnedCreativeEvidence": {'));
  assert.ok(app.includes('Record only what is observed, each with where it was seen; never infer or assume.'));
  assert.ok(app.includes('adjusted.earnedCreativeEvidence = parseObservedEvidence(parsed.earnedCreativeEvidence)'));
  assert.ok(!app.includes('function EcoPanel('), 'no inputs panel');
});
