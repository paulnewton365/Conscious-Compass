// Sustainability narrative thesis and framework 2.10.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  THESIS_STATEMENT, THESIS_TENETS, parseThesis, progressVoiceVerdict, thesisPromptBlock,
  THESIS_SCHEMA, thesisTextRows, PROGRESS_LEVELS, VOICE_LEVELS,
} from '../src/data/thesis.js';
import { ATTRIBUTES, FRAMEWORK_VERSION } from '../src/data/rubric.js';

const full = (over = {}) => ({
  present: true, summary: 'S', progress: 'strong', voice: 'quiet',
  tenets: Object.fromEntries(THESIS_TENETS.map(t => [t.id, { level: 'surfacing', reason: `why ${t.id}` }])),
  ...over,
});

test('six tenets, each with a name and a test', () => {
  assert.deepEqual(THESIS_TENETS.map(t => t.id), ['inside', 'engine', 'identity', 'personality', 'scars', 'voice']);
  THESIS_TENETS.forEach(t => assert.ok(t.name && t.test.endsWith('?')));
});

test('the thesis statement is carried verbatim into the prompt', () => {
  const p = thesisPromptBlock();
  assert.ok(p.includes(THESIS_STATEMENT));
  assert.ok(THESIS_STATEMENT.startsWith('Sustainability is getting buried.'));
  assert.ok(THESIS_STATEMENT.endsWith('the customers, partners, and markets they are trying to move.'));
  THESIS_TENETS.forEach(t => assert.ok(p.includes(t.name)));
  assert.match(p, /never changes them/);
  assert.ok(!p.includes('calibration rules above'), 'full assessment prompt is not calibrated');
  assert.ok(thesisPromptBlock({ calibrated: true }).includes('evidence this pass could not reach counts neither for nor against'));
  THESIS_TENETS.forEach(t => assert.ok(THESIS_SCHEMA.includes(`"${t.id}"`)));
});

test('verdict is decided in code from progress and voice, for all nine combinations', () => {
  const seen = new Set();
  for (const p of PROGRESS_LEVELS) for (const v of VOICE_LEVELS) {
    const r = progressVoiceVerdict(p, v);
    assert.ok(r.label && r.meaning, `${p}/${v}`);
    seen.add(r.label);
  }
  assert.equal(progressVoiceVerdict('strong', 'quiet').label, 'Whispering', 'the thesis case');
  assert.equal(progressVoiceVerdict('limited', 'loud').label, 'Overclaiming');
  assert.equal(progressVoiceVerdict('strong', 'loud').label, 'Breaking through');
  assert.equal(progressVoiceVerdict('huge', 'quiet'), null);
  assert.ok(seen.size >= 7);
});

test('parse keeps valid ratings, drops malformed ones, and ignores a model-supplied verdict', () => {
  const r = parseThesis(full({ verdict: { label: 'Genius' }, tenets: { ...full().tenets, scars: { level: 'amazing', reason: 'x' }, engine: null } }));
  assert.equal(r.verdict.label, 'Whispering');
  assert.equal(r.tenets.scars, null);
  assert.equal(r.tenets.engine, null);
  assert.equal(r.tenets.inside.level, 'surfacing');
  assert.equal(parseThesis(full({ progress: 'lots' })).verdict, null, 'no verdict without valid ratings');
  assert.equal(parseThesis(null), null);
  assert.equal(parseThesis('text'), null);
});

test('no sustainability narrative is a finding, stated plainly', () => {
  const r = parseThesis({ present: false, summary: 'Nothing observable.' });
  assert.equal(r.present, false);
  assert.deepEqual(r.tenets, {});
  const rows = thesisTextRows(r);
  assert.equal(rows.summary, 'Nothing observable.');
  assert.deepEqual(rows.tenets, []);
});

test('text rows list all six tenets in order, unrated ones marked', () => {
  const rows = thesisTextRows(parseThesis(full({ tenets: { inside: { level: 'breaking', reason: 'r' } } })));
  assert.equal(rows.tenets.length, 6);
  assert.equal(rows.tenets[0].level, 'Breaking through');
  assert.equal(rows.tenets[1].level, 'Not rated');
  assert.match(rows.verdict, /^Whispering: /);
});

// ── Framework 2.10 ──

const orig = (id) => {
  const src = readFileSync(new URL('./fixtures/rubric-2.9-counts.json', import.meta.url), 'utf8');
  return JSON.parse(src)[id];
};

test('framework is 2.10 and stays on benchmark major version 2', () => {
  assert.equal(FRAMEWORK_VERSION, '2.10');
  const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
  assert.match(app, /const BENCHMARK_RUBRIC_MAJOR = '2';/);
  assert.equal(FRAMEWORK_VERSION.split('.')[0], '2', 'existing 2.x full assessments stay comparable');
  assert.ok(!/parseFloat\([^)]*[Vv]ersion/.test(app), 'no numeric version compare: 2.10 would read as 2.1');
});

test('thesis signals added to six attributes; Attentive and Cogent untouched', () => {
  const thesisish = (arr) => arr.filter(x => /ustainab/.test(x)).length;
  for (const a of ATTRIBUTES) {
    const before = orig(a.id);
    const addedStrong = a.signals.strong.length - before.strong;
    const addedWeak = a.signals.weak.length - before.weak;
    if (['ATTENTIVE', 'COGENT'].includes(a.id)) {
      assert.equal(addedStrong + addedWeak, 0, `${a.id} changed`);
    } else {
      assert.ok(addedStrong >= 1 && addedWeak >= 1, `${a.id} has thesis signals`);
      assert.ok(thesisish(a.signals.strong) >= 1 || a.id === 'REFLECTIVE', `${a.id} names sustainability`);
    }
    assert.equal(a.signals.moderate.length, before.moderate, `${a.id} moderate untouched`);
  }
});
