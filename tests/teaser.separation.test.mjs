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

// v3.31: the teaser may READ full results for the sector baseline, through
// fetchCompassResults and the shared mapping and benchmark engine. It must
// never write, and never touch saved assessments or the full-report state.
const WRITES = ['saved_assessments', 'saveCompassResult', 'saveAssessment', 'deleteCompassResult', 'fetchSavedAssessments', 'savedAssessments', 'setScores', 'setAssessments', 'setCompassResults'];
const BASELINE_READS = ['fetchCompassResults', 'formatCompassResult', 'teaserSectorBaseline'];

test('teaser UI never writes full results or touches saved assessments', () => {
  WRITES.forEach(term => assert.ok(!teaserBlock.includes(term), `teaser UI references ${term}`));
  assert.ok(!teaserBlock.includes('compass_results'), 'no direct table access');
});

test('the only full-result read in the teaser UI is the sector baseline', () => {
  const reads = [...teaserBlock.matchAll(/fetchCompassResults\(\)/g)].length;
  assert.equal(reads, 2, 'one read when a teaser opens, one per export');
  // Every place the fetched rows go is the shared mapping, then the baseline.
  assert.ok(!/compassResults/.test(teaserBlock), 'teaser never uses the app-wide results state');
  assert.ok(teaserBlock.includes('.map(formatCompassResult)'));
  BASELINE_READS.forEach(t => assert.ok(teaserBlock.includes(t), t));
});

const fnSrc = (name) => {
  const start = app.indexOf(`function ${name}(`);
  assert.ok(start >= 0, name);
  return app.slice(start, app.indexOf('\n}\n', start));
};

test('the baseline helpers are pure: no network, no writes, no state', () => {
  for (const fn of ['formatCompassResult', 'teaserSectorBaseline', 'buildBenchmarkSnapshot']) {
    const body = fnSrc(fn);
    for (const bad of ['fetch(', 'await ', 'supabase', 'localStorage', '.push(', '.splice(']) {
      assert.ok(!body.includes(bad), `${fn} contains ${bad}`);
    }
    // Calls such as saveX( or setX( would be writes; field names like savedAt are not.
    assert.ok(!/\b(save|set|delete|insert|update)[A-Z]\w*\(/.test(body), `${fn} calls a writer`);
  }
});

test('the full app and the teaser map full results through one shared function', () => {
  assert.ok(app.includes('resultsData.map(formatCompassResult)'));
  assert.equal([...app.matchAll(/brandName: r\.brand_name/g)].length, 1, 'no second copy of the mapping');
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

// ── Campaigns (v3.30) ──

const fnBody = (src, name) => {
  const start = src.indexOf(`export const ${name} =`);
  assert.ok(start >= 0, `${name} exists`);
  return src.slice(start, src.indexOf('\n};', start));
};

test('campaign functions touch only teaser_campaigns', () => {
  const sb = read('src/lib/supabase.js');
  for (const fn of ['fetchCampaigns', 'createCampaign', 'renameCampaign', 'deleteCampaign']) {
    const tables = [...fnBody(sb, fn).matchAll(/\.from\('([^']+)'\)/g)].map(m => m[1]);
    assert.deepEqual([...new Set(tables)], ['teaser_campaigns'], `${fn} touches ${tables}`);
  }
});

test('the campaign download reads teasers only, and never selects context, evidence or author', () => {
  const body = fnBody(read('src/lib/supabase.js'), 'fetchCampaignScores');
  const tables = [...body.matchAll(/\.from\('([^']+)'\)/g)].map(m => m[1]);
  assert.deepEqual(tables, ['teaser_assessments']);
  const select = body.match(/\.select\('([^']+)'\)/)[1];
  assert.ok(select.split(/,\s*/).includes('industry'), 'industry needed for the baseline');
  for (const col of ['context', 'evidence', 'created_by', '*']) assert.ok(!select.split(/,\s*/).includes(col), `download selects ${col}`);
});

test('the export module has no database access and no full-result references', () => {
  const src = read('src/lib/teaserExport.js');
  assert.ok(!/supabase/i.test(src));
  FULL.forEach(term => assert.ok(!src.includes(term), `export references ${term}`));
});

test('converting a teaser does not carry its campaign into the full assessment', () => {
  const start = app.indexOf('const handleConvertTeaser = async');
  const body = app.slice(start, app.indexOf('\n  };\n', start));
  // "campaignContent"/"campaignAuto" are the full assessment's own fields for a
  // brand's marketing campaigns; the Antenna campaign is campaign_id.
  assert.ok(!/campaign_id|record\.campaign|teaser_campaigns/.test(body), 'teaser campaign referenced during conversion');
  assert.ok(/saveTeaser\(\{ \.\.\.record, converted_at/.test(body), 'only the teaser row is updated');
});

test('campaign names never reach the prospect-facing payload', () => {
  const lib = read('src/lib/teaser.js');
  const start = lib.indexOf('export function makeTeaserClientPayload');
  assert.ok(!/campaign/i.test(lib.slice(start)));
});


// ── No campaign modifier in teasers (v3.32) ──

test('the teaser pipeline never imports or applies the campaign modifier', () => {
  const lib = read('src/lib/teaser.js');
  for (const t of ['applyCampaignModifiers', 'getCampaignModifier', 'CAMPAIGN_MODIFIERS', 'CAMPAIGN_LADDER']) {
    assert.ok(!lib.includes(t), `teaser.js references ${t}`);
  }
  assert.ok(!teaserBlock.includes('applyCampaignModifiers'));
});

test('no teaser copy blames the brand for the narrowness of the read', () => {
  for (const src of [teaserBlock, read('src/lib/teaserExport.js'), read('src/lib/teaser.js')]) {
    assert.ok(!/so will a prospect/i.test(src));
    assert.ok(!/Thin public record/.test(src));
  }
});


test('the baseline is fed only from compass_results, never from teaser data', () => {
  const calls = [...teaserBlock.matchAll(/teaserSectorBaseline\(([^,]+),/g)].map(m => m[1].trim());
  assert.ok(calls.length >= 2);
  // Both call sites pass a pool built from fetchCompassResults via formatCompassResult.
  calls.forEach(arg => assert.ok(['pool', 'benchPool'].includes(arg), `baseline fed from ${arg}`));
  assert.match(teaserBlock, /const pool = \(full\.data \|\| \[\]\)\.map\(formatCompassResult\)/);
  assert.match(teaserBlock, /setBenchPool\(\(data \|\| \[\]\)\.map\(formatCompassResult\)\)/);
  const fetchBody = read('src/lib/supabase.js').match(/export const fetchCompassResults = async \(\) => \{[\s\S]*?\n\};/)[0];
  assert.deepEqual([...fetchBody.matchAll(/\.from\('([^']+)'\)/g)].map(m => m[1]), ['compass_results']);
});

// ── Scorecards are teasers only (v3.38) ──

test('the scorecard is built and offered only inside the teaser', () => {
  const src = read('src/lib/scorecard.js');
  assert.ok(!/supabase/i.test(src));
  WRITES.forEach(t => assert.ok(!src.includes(t), `scorecard references ${t}`));
  // Every use of the scorecard in the app sits in the teaser block.
  const uses = [...app.matchAll(/scorecard[A-Za-z]*\(|exportScorecard[A-Za-z]*\(|makeScorecard\(/g)].map(m => m.index);
  const start = app.indexOf('// TEASER (v3.29)');
  const end = app.indexOf('function AppContent() {');
  assert.ok(uses.length >= 4);
  uses.forEach(i => assert.ok(i > start && i < end, 'scorecard used outside the teaser block'));
  // And the full report's own exports know nothing about it.
  const reportPage = app.slice(app.indexOf('function ReportPage('), app.indexOf('function ReportGlanceSection('));
  assert.ok(!/scorecard|hero_image/i.test(reportPage), 'full report references the scorecard');
});

test('the scorecard reads a teaser record, never a full assessment', () => {
  const src = read('src/lib/scorecard.js');
  assert.ok(src.includes('record?.result') && src.includes('record?.hero_image'));
  assert.ok(!src.includes('compass_results') && !src.includes('saved_assessments'));
});

// ── Shadowed browser globals (v3.40) ──
// App.jsx imports icons whose names collide with browser constructors
// (Image, Search, Filter, Type, Star...). Constructing one of those gives a
// minified "X is not a constructor" at runtime, which is unreadable. Any
// browser constructor that shares a name with an import must be reached
// through window.

test('no icon-shadowed name is ever used as a constructor', () => {
  const icons = app.match(/import \{([^}]+)\} from 'lucide-react'/)[1]
    .split(',').map(s => s.trim()).filter(Boolean);
  assert.ok(icons.includes('Image'), 'Image is one of them');
  const offenders = [];
  for (const name of icons) {
    const re = new RegExp('(\\w+\\.)?\\bnew\\s+' + name + '\\s*\\(', 'g');
    for (const m of app.matchAll(re)) if (!m[1]) offenders.push('new ' + name + '() near index ' + m.index);
  }
  assert.deepEqual(offenders, [], 'use window.<Name> instead');
});

test('the hero image reader uses the browser constructor', () => {
  const start = app.indexOf('async function readHeroImage');
  const body = app.slice(start, app.indexOf('\n}\n', start));
  assert.ok(body.includes('new window.Image()'));
  assert.ok(!/new Image\(\)/.test(body));
});
