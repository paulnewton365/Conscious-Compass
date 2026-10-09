// ECO v2.0 (v3.115.0): how earned creative could help every brand, plus the
// earned-creative-in-use score lift (framework 2.11), which is unchanged.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as eco from '../src/lib/eco.js';

const scored = (over = {}) => Object.fromEntries(Object.entries({ AWAKE: 35, SENTIENT: 40, AWARE: 50, VISIONARY: 80, COGENT: 70, ATTENTIVE: 70, INTENTIONAL: 70, REFLECTIVE: 72, ...over }).map(([k, v]) => [k, { score: v }]));

const attrs = (o = {}) => ({ AWAKE: 38, SENTIENT: 42, AWARE: 45, VISIONARY: 70, COGENT: 60, ATTENTIVE: 60, INTENTIONAL: 62, REFLECTIVE: 40, ...o });
const asScores = (a, extra = {}) => ({ ...Object.fromEntries(Object.entries(a).map(([k, v]) => [k, { score: v }])), ...extra });
const WRITTEN = {
  opening: 'Earned creative would get MKB talked about for the grid data it already holds.',
  opportunities: [
    { attribute: 'sentient', truth: 'Five years of open grid data, Utility Dive, March 2026', idea: 'Turn the data into a public map of the outages it helped prevent \u2014 street by street.', change: 'Gives people a reason to care.' },
    { attribute: 'AWAKE', truth: '', idea: 'Answer the heat wave debate with a live demonstration.', change: '' },
    { attribute: 'AWAKE', idea: 'A duplicate, dropped.' },
    { attribute: 'INTENTIONAL', idea: 'Not a lever, dropped.' },
  ],
  sortFirst: ['A pending rate case, PUC docket 24-118: settle the messaging first.'],
};

test('every brand gets the section; without written opportunities it builds from the scores, lowest first', () => {
  const s = eco.buildEcoSection(asScores(attrs()), { brand: 'MKB' });
  assert.equal(s.source, 'scores');
  assert.deepEqual(s.opportunities.map(o => o.attribute), ['AWAKE', 'SENTIENT', 'AWARE']);
  assert.equal(s.opening, 'Earned creative would help MKB most on Awake, Sentient and Aware, its lowest scores among the attributes attention can move.');
  assert.equal(s.opportunities[0].idea, eco.LEVERS.AWAKE.starter);
  assert.equal(s.opportunities[0].change, eco.LEVERS.AWAKE.lifts);
  assert.deepEqual(s.sortFirst, []);
  const strong = eco.buildEcoSection(asScores(attrs({ AWAKE: 90, SENTIENT: 88, AWARE: 92, VISIONARY: 85, COGENT: 86 })), { brand: 'MKB' });
  assert.equal(strong.opportunities.length, 3, 'a strong brand still gets it');
  assert.equal(eco.pickLevers({ AWAKE: 50, SENTIENT: 50, AWARE: 50 }).map(l => l.id).join(), 'AWAKE,SENTIENT,AWARE', 'ties break in lever order');
});

test('written opportunities are cleaned: levers only, one each, sorted by score, no em dashes; sort-first stays internal', () => {
  const scores = asScores(attrs(), { earnedCreativeOpportunity: eco.parseOpportunity(WRITTEN) });
  const s = eco.buildEcoSection(scores, { brand: 'MKB' });
  assert.equal(s.source, 'evidence');
  assert.deepEqual(s.opportunities.map(o => o.attribute), ['AWAKE', 'SENTIENT'], 'lowest score first; duplicates and non-levers dropped');
  assert.equal(s.opportunities[0].change, eco.LEVERS.AWAKE.lifts, 'an empty change falls back to the lever copy');
  assert.ok(!/[\u2014\u2013]/.test(JSON.stringify(s)), 'no em or en dashes survive');
  assert.equal(s.sortFirst.length, 1);
  const client = eco.clientEcoSection(scores, 'MKB');
  assert.ok(!JSON.stringify(client).includes('rate case'), 'the sort-first list never reaches a client');
  assert.deepEqual(Object.keys(client).sort(), ['howl', 'opening', 'opportunities']);
  assert.equal(eco.parseOpportunity({ opening: 'x', opportunities: [] }), null, 'nothing usable is null, so the scores version shows');
});

test('HOWL closes the section everywhere, with its logo', () => {
  for (const s of [eco.buildEcoSection(asScores(attrs()), { brand: 'MKB' }), eco.clientEcoSection(asScores(attrs()), 'MKB'), eco.buildTeaserEco(attrs(), 'Acme')]) {
    assert.equal(s.howl.logo, '/howl-logo.svg');
    assert.equal(s.howl.opener, 'Most brands have more to say than the world has heard. HOWL exists to change that.');
  }
});

test('the teaser version names the attribute each opportunity would lift, from the teaser scores alone', () => {
  const t = eco.buildTeaserEco(attrs(), 'Acme');
  assert.deepEqual(t.opportunities.map(o => [o.attribute, o.change]), ['AWAKE', 'SENTIENT', 'AWARE'].map(id => [id, eco.LEVERS[id].lifts]));
  assert.ok(t.opportunities.every(o => !o.idea && !o.truth));
  assert.equal(eco.buildTeaserEco({}, 'Acme'), null);
});

test('the readiness machinery is gone', () => {
  for (const gone of ['evaluateGate', 'computeNeed', 'ECO_LADDER', 'runEco', 'buildLiteSection', 'ecoFromReport', 'parseObservedEvidence']) assert.equal(eco[gone], undefined, gone);
  const copy = JSON.stringify([eco.ECO_COPY, eco.LEVERS]);
  assert.ok(!copy.includes('\u2014') && !copy.includes('\u2013'), 'no em or en dashes in the copy');
});

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

test('the scoring pass writes the opportunities last, after the attributes, and they are cleaned on the way in', () => {
  const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
  const schemaAt = app.indexOf('"INTENTIONAL":{ "score": 0-100');
  assert.ok(app.indexOf('"earnedCreativeOpportunity": {', schemaAt) > schemaAt, 'after the attributes');
  assert.ok(!app.includes('"earnedCreativeEvidence": {'), 'the evidence block is gone');
  assert.ok(app.includes('adjusted.earnedCreativeOpportunity = parseOpportunity(parsed.earnedCreativeOpportunity);'));
  assert.ok(app.includes('Never invent one.'));
});
