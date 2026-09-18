// Teaser results must stay separate from full assessment results.
// Structural checks on the source, so a future edit that crosses the line
// fails here before it can reach Results, Compare, Landscape or benchmarks.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const read = (p) => readFileSync(path.join(root, p), 'utf8');
const app = read('src/App.jsx');
const FULL = ['compass_results', 'saved_assessments', 'saveCompassResult', 'saveAssessment', 'fetchCompassResults', 'fetchSavedAssessments', 'compassResults', 'savedAssessments', 'buildBenchmarkSnapshot', 'setScores', 'setAssessments'];

const teaserBlock = app.slice(app.indexOf('// TEASER (v3.29)'), app.indexOf('function AppContent() {'));

test('the teaser block exists and is the whole teaser UI', () => {
  assert.ok(teaserBlock.length > 5000);
  for (const fn of ['function TeaserPage', 'function TeaserReport', 'function TeaserClientView', 'async function exportTeaserPdf']) assert.ok(teaserBlock.includes(fn), fn);
});

test('teaser UI never reads or writes full assessment results', () => {
  FULL.forEach(term => assert.ok(!teaserBlock.includes(term), `teaser UI references ${term}`));
});

test('teaser pipeline has no database access at all', () => {
  const lib = read('src/lib/teaser.js');
  assert.ok(!/supabase/i.test(lib));
  FULL.forEach(term => assert.ok(!lib.includes(term), `teaser pipeline references ${term}`));
});

test('teaser database functions touch only teaser_assessments', () => {
  const sb = read('src/lib/supabase.js');
  for (const fn of ['fetchTeasers', 'fetchTeaser', 'saveTeaser', 'deleteTeaser']) {
    const start = sb.indexOf(`export const ${fn} =`);
    const body = sb.slice(start, sb.indexOf('\n};', start));
    const tables = [...body.matchAll(/\.from\('([^']+)'\)/g)].map(m => m[1]);
    assert.ok(tables.length > 0, `${fn} queries a table`);
    assert.deepEqual([...new Set(tables)], ['teaser_assessments'], `${fn} touches ${tables}`);
  }
});

test('no full-result function touches teaser_assessments', () => {
  const sb = read('src/lib/supabase.js');
  const fullFns = ['fetchCompassResults', 'saveCompassResult', 'deleteCompassResult', 'fetchSavedAssessments', 'saveAssessment', 'deleteAssessment'];
  for (const fn of fullFns) {
    const start = sb.indexOf(`export const ${fn} =`);
    const body = sb.slice(start, sb.indexOf('\n};', start));
    assert.ok(start >= 0 && body.length > 20, `${fn} found`);
    assert.ok(!body.includes('teaser'), `${fn} references teasers`);
  }
});

test('server jobs behind Landscape, Insights and Stay Conscious never read teasers', () => {
  for (const f of readdirSync(path.join(root, 'api'))) {
    assert.ok(!read(`api/${f}`).includes('teaser'), `api/${f} references teasers`);
  }
});

test('full results are written only from the known full-assessment sites', () => {
  const writes = [...app.matchAll(/await (saveCompassResult|saveAssessment)\(/g)].map(m => m.index);
  assert.equal(writes.length, 4, 'manual result entry, save (assessment + result), rescore');
  const start = app.indexOf('// TEASER (v3.29)');
  const end = app.indexOf('function AppContent() {');
  writes.forEach(i => assert.ok(i < start || i > end, 'a full-result write sits inside the teaser block'));
});

test('converting a teaser starts a clean full assessment: no teaser scores carried, nothing saved to full results', () => {
  const start = app.indexOf('const handleConvertTeaser = async');
  const body = app.slice(start, app.indexOf('\n  };\n', start));
  assert.ok(body.includes('setScores(null)'), 'scores reset');
  assert.ok(!/record\.result/.test(body), 'teaser result never read during conversion');
  assert.ok(!/saveCompassResult|saveAssessment\(/.test(body), 'conversion writes no full result');
  assert.ok(body.includes("saveTeaser({ ...record, converted_at"), 'only the teaser row is stamped');
});

test('the teaser table is not in the benchmark, results or saved queries', () => {
  const sb = read('src/lib/supabase.js');
  const benchmarkish = sb.slice(0, sb.indexOf('// Teaser assessments'));
  assert.ok(!benchmarkish.includes('teaser_assessments'));
});
