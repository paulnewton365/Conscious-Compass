// Framework 2.15 (v4.17.0): every piece of evidence scored against the
// attribute whose rubric signals it measures, each thing scored once, the
// evidence of promises kept, the earned creative lift and the Reputation lens.
// Saved reports keep their numbers until rescored.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as rubric from '../src/data/rubric.js';
import * as eco from '../src/lib/eco.js';
import * as teaser from '../src/lib/teaser.js';

const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const teaserSrc = readFileSync(new URL('../src/lib/teaser.js', import.meta.url), 'utf8');
const A = (id) => rubric.ATTRIBUTES.find(a => a.id === id);
const signalsOf = (id) => [...A(id).signals.strong, ...A(id).signals.moderate, ...A(id).signals.weak];

test('framework 2.15, teaser method 2.7', () => {
  assert.equal(rubric.FRAMEWORK_VERSION, '2.15');
  assert.equal(teaser.TEASER_VERSION, '2.7');
});

// ── Routing ──

test('the same evidence goes to the same attributes in full scoring and teasers', () => {
  // Glassdoor: REFLECTIVE only, as the rubric's weak signal says.
  assert.ok(app.includes('- Glassdoor impacts REFLECTIVE.'));
  assert.ok(teaserSrc.includes('- Glassdoor weighs on REFLECTIVE.'));
  assert.ok(!teaserSrc.includes('Glassdoor and reputation flags weigh on REFLECTIVE and INTENTIONAL'));
  // Reputation flags: REFLECTIVE and AWARE everywhere; INTENTIONAL only for a credential; never AWAKE.
  assert.ok(app.includes('Reputation flags (controversy, litigation, regulatory action): must be reflected in REFLECTIVE (conduct against claims) + AWARE (trust)'));
  assert.ok(app.includes('must be weighted against REFLECTIVE (conduct against claims) and AWARE (trust); against INTENTIONAL only where a flag undermines a credential'));
  assert.ok(teaserSrc.includes('Reputation flags (controversy, litigation, regulatory action) weigh on REFLECTIVE and AWARE, and on INTENTIONAL only where a flag undermines a credential.'));
  assert.ok(!app.includes('weighted against REFLECTIVE, INTENTIONAL, and AWAKE'));
});

test('routes that contradicted the rubric are gone', () => {
  assert.ok(app.includes('- Reddit perception: REFLECTIVE + AWARE.'));
  assert.ok(!app.includes('Reddit perception: REFLECTIVE + COGENT') && !app.includes('critical signal for COGENT'));
  assert.ok(app.includes('Wikipedia absence/thin = gap in INTENTIONAL (third-party notability).'));
  assert.ok(teaserSrc.includes('Wikipedia absence or thinness is a gap in INTENTIONAL.'));
  assert.ok(!/Wikipedia[^\n]{0,60}COGENT/.test(app + teaserSrc), 'Wikipedia never routes to COGENT');
  assert.ok(app.includes('- AI engine convergence = strong discoverability (COGENT). Vagueness/divergence = penalise COGENT.'));
  // Social absence: a gap in AWARE, SENTIENT and AWAKE; a deliberate choice is COGENT's.
  assert.ok(app.includes('credit it in COGENT, whose rubric rewards deliberate channel choices'));
  assert.ok(!app.includes('reflect that in INTENTIONAL rather than excusing the gap'));
  assert.ok(A('COGENT').signals.strong.some(s => /deliberate audience and budget logic/.test(s)), 'the rubric signal behind it');
  // Wikipedia lives in INTENTIONAL's description, not AWAKE's.
  assert.ok(!/Wikipedia/.test(A('AWAKE').description) && /Wikipedia/.test(A('INTENTIONAL').description));
});

// ── Each thing scored once ──

test('visual identity and brand architecture are scored in Intentional only', () => {
  for (const a of rubric.ATTRIBUTES) {
    const s = signalsOf(a.id).join(' | ');
    if (a.id === 'INTENTIONAL') {
      assert.match(s, /visual identity/i);
      assert.match(s, /architecture/i);
    } else {
      assert.ok(!/visual identity|visual consistency/i.test(s), `${a.id} scores visual identity`);
      assert.ok(!/architecture|hierarchy/i.test(s), `${a.id} scores brand architecture`);
    }
  }
  // Reflective keeps consistency of message and values: its own angle.
  assert.ok(A('REFLECTIVE').signals.strong.includes('Consistent tone, messaging and values across all channels'));
  assert.match(A('REFLECTIVE').description, /Visual identity and brand architecture are scored in Intentional, not here\./);
  // The digital estate rule splits the same way.
  assert.ok(app.includes('- INTENTIONAL: A different visual identity across properties undermines professional presence. Score visual inconsistency here, not in REFLECTIVE.'));
  assert.ok(!app.includes('(different visual identity, tone, or messaging across properties) is direct evidence of brand inauthenticity'));
});

// ── Promises kept ──

test('the evidence of promises kept is scored in four attributes, strong and weak, so it reaches every lens', () => {
  const kept = {
    VISIONARY: ['Stated commitments and targets visibly met or on track', 'Vision and targets announced with no evidence of progress, or quietly dropped'],
    REFLECTIVE: ['Reviews, case studies and coverage confirm the brand delivers what it claims', 'Customers, employees or coverage report the brand not delivering what it claims'],
    AWARE: ['Customers cite reliability: the brand does what it says', 'Recurring complaints about broken promises or unmet expectations'],
    INTENTIONAL: ['Track record of delivery confirmed by third parties: launches shipped, client results, commitments honoured', 'Credentials or claims that third-party evidence contradicts'],
  };
  Object.entries(kept).forEach(([id, [strong, weak]]) => {
    assert.ok(A(id).signals.strong.includes(strong), `${id} strong`);
    assert.ok(A(id).signals.weak.includes(weak), `${id} weak`);
  });
  // Between them they lead or feed all four lenses.
  const lenses = [...rubric.TRUST_LENSES, rubric.TRUST_FOUNDATION];
  lenses.forEach(l => assert.ok(Object.keys(kept).some(id => (l.weights[id] || 0) >= 15), `${l.name} draws on promise-kept evidence`));
  // And the readouts are asked for it.
  assert.ok(app.includes('Does the site show progress against the commitments and targets it has set, or only the promises?'));
  assert.ok(app.includes('Does coverage confirm the brand has delivered on what it promised, or report commitments missed or dropped?'));
});

// ── The earned creative lift ──

test('the lift goes to Sentient and Awake from 2.15; scores from before keep Sentient and Intentional', () => {
  const s = (o = {}) => Object.fromEntries(rubric.ATTRIBUTES.map(a => [a.id, { score: 50, ...(o[a.id] || {}) }]));
  const acts = { activations: [{ name: 'Open grid data' }] };
  const now = eco.applyEarnedCreativeLift({ ...s(), earnedCreative: acts }, '2.15');
  assert.deepEqual([now.SENTIENT.score, now.AWAKE.score, now.INTENTIONAL.score], [53, 53, 50]);
  const before = eco.applyEarnedCreativeLift({ ...s(), earnedCreative: acts }, '2.14');
  assert.deepEqual([before.SENTIENT.score, before.AWAKE.score, before.INTENTIONAL.score], [53, 50, 53]);
  // INTENTIONAL is not an earned creative lever; AWAKE is.
  assert.ok(eco.LEVER_ORDER.includes('AWAKE') && !eco.LEVER_ORDER.includes('INTENTIONAL'));
  assert.deepEqual(eco.liftAttributesFor('2.10'), ['SENTIENT', 'INTENTIONAL'], '2.10 is earlier than 2.15, not later');
});

// ── The Reputation lens ──

test('Reputation draws on the attributes that hold the evidence of promises kept; Attentive carries little', () => {
  const rep = rubric.TRUST_LENSES.find(l => l.id === 'reputation').weights;
  assert.deepEqual(rep, { REFLECTIVE: 30, VISIONARY: 25, AWAKE: 15, INTENTIONAL: 15, AWARE: 10, ATTENTIVE: 5 });
  assert.equal(Object.values(rep).reduce((a, b) => a + b, 0), 100);
  // The other lenses are unchanged.
  assert.deepEqual(rubric.TRUST_LENSES.find(l => l.id === 'credibility').weights, { INTENTIONAL: 35, AWAKE: 20, COGENT: 15, AWARE: 15, SENTIENT: 10, ATTENTIVE: 5 });
  assert.deepEqual(rubric.TRUST_FOUNDATION.weights, { REFLECTIVE: 40, AWARE: 20, SENTIENT: 10, VISIONARY: 10, INTENTIONAL: 10, COGENT: 10 });
});

test('saved reports keep their Reputation number until rescored', () => {
  const sc = Object.fromEntries(rubric.ATTRIBUTES.map((a, i) => [a.id, { score: 40 + i * 5 }]));
  const rep = (s, opt) => rubric.computeTrustLenses(s, [], opt).rows.find(r => r.id === 'reputation');
  const legacy = rep(sc);
  assert.equal(legacy.weights, rubric.LEGACY_REPUTATION_WEIGHTS, 'no version: the weights it was shown with');
  assert.equal(rep({ ...sc, earnedCreative: { frameworkVersion: '2.14' } }).score, legacy.score, 'read from what scoring stamped');
  assert.notEqual(rep({ ...sc, frameworkVersion: '2.15' }).score, legacy.score, '2.15 reads the new weights');
  assert.equal(rep(sc, { frameworkVersion: '2.15' }).score, rep({ ...sc, frameworkVersion: '2.15' }).score);
  // The reach column is read with the same weights as the rows.
  const reach = (s) => rubric.computeTrustLenses(s).reach.find(r => r.id === 'VISIONARY').count;
  assert.equal(reach(sc), 1, 'before 2.15 Visionary feeds Authenticity only');
  assert.equal(reach({ ...sc, frameworkVersion: '2.15' }), 2);
  assert.equal(rubric.versionAtLeast('2.10', '2.9'), true);
  assert.equal(rubric.versionAtLeast('2.9', '2.15'), false);
  assert.equal(rubric.versionAtLeast(null, '2.15'), false);
});

test('full scoring stamps the framework on the scores, and the client view reads it', () => {
  assert.ok(app.includes('adjusted.frameworkVersion = FRAMEWORK_VERSION;'));
  assert.ok(app.includes('frameworkVersion: scores?.frameworkVersion || scores?.earnedCreative?.frameworkVersion || scores?.campaignCoherence?.frameworkVersion || null,'));
  // Teasers are scored now, so their stored lenses use the current weights.
  assert.ok(teaserSrc.includes('computeTrustLenses(scores, scores.trustFindings || [], { frameworkVersion: FRAMEWORK_VERSION })'));
});
