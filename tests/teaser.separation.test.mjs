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
  for (const fn of ['function TeaserPage', 'function TeaserReport', 'function TeaserClientView', 'function TeaserProgress']) assert.ok(teaserBlock.includes(fn), fn);
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
  const uses = [...app.matchAll(/scorecard[A-Za-z]*\(|exportTeaser(Pack|ReportPdf)\(|downloadPack\(/g)].map(m => m.index);
  const start = app.indexOf('// TEASER (v3.29)');
  const end = app.indexOf('function AppContent() {');
  assert.ok(uses.length >= 3, `expected the pack and scorecard helpers, found ${uses.length}`);
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

// ── Company stage on the full assessment too (v3.58) ──

test('the full assessment takes a company stage and carries its rules into scoring', () => {
  // The field exists on setup and on a new project.
  assert.match(app, /data-field="company-stage"/);
  assert.match(app, /companyStage: ''/);
  // The stage rules go into the scoring prompt, not just the export.
  const scoring = app.slice(app.indexOf('const prompt = `You are scoring'), app.indexOf('ASSESSMENT DATA:'));
  assert.ok(scoring.includes('stagePromptBlock(project.companyStage)'), 'stage rules reach the scoring prompt');
  // Converting a teaser carries its stage across rather than asking twice.
  const convert = app.slice(app.indexOf('const handleConvertTeaser = async'), app.indexOf('\n  };\n', app.indexOf('const handleConvertTeaser = async')));
  assert.ok(convert.includes('companyStage: record.stage'), 'the teaser stage carries into the full assessment');
});

test('one stage framework, shared by both', async () => {
  const stages = await import('../src/data/stages.js');
  assert.equal(stages.STAGES.length, 6);
  assert.deepEqual(stages.STAGES.map(s => s.id), ['startup', 'scaleup', 'leader', 'multinational', 'conglomerate', 'global']);
  const startup = stages.stagePromptBlock('startup');
  assert.match(startup, /Glassdoor/);
  assert.match(startup, /NEITHER FOR NOR AGAINST/);
  assert.equal(stages.stagePromptBlock(''), '', 'no stage set means no stage guidance');
  // The teaser and the full assessment call the same builder.
  const teaser = readFileSync(new URL('../src/lib/teaser.js', import.meta.url), 'utf8');
  assert.ok(teaser.includes('stagePromptBlock'));
});

// ── UI system migration (v3.61) ──

test('the app runs on the new tokens, with the old names aliased rather than left dangling', () => {
  const css = read('src/index.css');
  assert.ok(css.includes('--cc-paper: #FBFAF7'), 'new tokens present');
  assert.ok(css.includes('--cc-rust: #D9442A'), 'rust is the screen accent');
  // every old Antenna variable now resolves to a new token
  for (const name of ['--antenna-paper', '--antenna-ink', '--antenna-body', '--antenna-muted', '--antenna-faint', '--antenna-rule', '--antenna-lime', '--antenna-error']) {
    assert.ok(new RegExp(name + ':\\s*var\\(--cc-').test(css), `${name} aliased`);
  }
});

test('the retired palette is gone from the app', () => {
  const retired = ['#0B0B0B', '#4A4840', '#68655B', '#B3B0A8', '#DCDAD3', '#F2F0EA', '#DEE42F', '#E4E2DC', '#B23A3A'];
  retired.forEach(hex => {
    const uses = (app.match(new RegExp(hex, 'gi')) || []).length;
    assert.equal(uses, 0, `${hex} still used ${uses} times`);
  });
});

test('fonts are self-hosted, so the app loads no external stylesheet', () => {
  const css = read('src/index.css');
  assert.ok(!css.includes('fonts.googleapis.com'), 'no Google Fonts import');
  assert.ok(css.includes("@font-face"), 'faces declared locally');
  ['newsreader-400.woff2', 'hanken-400.woff2', 'hanken-500.woff2', 'hanken-600.woff2', 'hanken-700.woff2']
    .forEach(f => assert.ok(css.includes(f), f));
  assert.ok(!/fontFamily: 'Inter/.test(app), 'no on-screen Inter left');
});

test('the print artefacts keep their own palette and are untouched by the restyle', () => {
  const card = read('src/lib/cardVector.js');
  const slide = read('src/lib/slideVector.js');
  assert.ok(card.includes('#D9E021'), 'the card keeps lime');
  assert.ok(slide.includes('D9E021'), 'the slide keeps lime');
  const report = read('src/lib/teaserReport.js');
  assert.ok(report.includes('#D9442A') && report.includes('#FBFAF7'), 'the read is unchanged');
});

test('a CSS comment can never swallow the token block again', () => {
  const css = read('src/index.css');
  // "dc-*/btn-*" inside a comment ends it early and drops everything after,
  // which is exactly how the tokens went missing in v3.61.
  const comments = [...css.matchAll(/\/\*[\s\S]*?\*\//g)].map(m => m[0]);
  comments.forEach(c => {
    const body = c.slice(2, -2);
    assert.ok(!body.includes('*/'), `comment closes early: ${c.slice(0, 60)}`);
  });
  // and the tokens are still declared after all of them
  // the screens are 1440 wide with 80px padding, so content runs to 1280
  assert.match(css, /--cc-page-max:\s*1440px/);
  assert.match(css, /--cc-gutter:\s*80px/);
});

test('the visible furniture is styled by the new system, not left on the old rules', () => {
  const css = read('src/index.css');
  const cut = css.indexOf('Compass UI system (handoff v1');
  assert.ok(cut > 0, 'the new system is present');
  const newRules = css.slice(cut);
  // page titles, rows and score numerals: the things on every screen
  ['dc-h2', 'dc-pagehead', 'dc-standfirst', 'dc-listrow', 'dc-listrow-t', 'dc-results-row',
    'dc-stat-n', 'dc-stat-l', 'dc-ledger-row', 'dc-attr-card', 'dc-tab-on', 'dc-rec-row']
    .forEach(c => assert.ok(newRules.includes(`.${c}`), `${c} still on the old rules`));
  // the serif carries titles and scores
  assert.match(newRules, /\.dc-h2\s*\{[^}]*--cc-serif/);
  assert.match(newRules, /\.dc-stat-n[^{]*\{[^}]*--cc-serif/);
});

test('layout tokens carry literal fallbacks, so a missing token cannot collapse the page', () => {
  const css = read('src/index.css');
  assert.match(css, /max-width: var\(--cc-page-max, 1280px\)/);
  assert.match(css, /padding: 0 var\(--cc-gutter, 48px\)/);  // the fallbacks stay conservative
});

test('headings that set their own type still use the serif, not a stray weight', () => {
  // These bypass the stylesheet, so the serif has to be stated inline.
  const inline = [...app.matchAll(/fontSize: 'clamp\([^']+\)', fontWeight: (\d+)/g)].map(m => m[1]);
  const heavy = inline.filter(w => Number(w) >= 700);
  assert.deepEqual(heavy, [], 'a display heading is still set in heavy sans');
  assert.ok((app.match(/fontFamily: 'var\(--cc-serif\)'/g) || []).length >= 6, 'display headings carry the serif');
});

test('no stray palette outside the system', () => {
  assert.ok(!app.includes('bg-blue-50'), 'the sharing tip used a default blue');
});

test('the charts are on the new palette, on screen and in the export', () => {
  // the old neon lime and olive are gone from every chart
  ['#E2E65A', '#E8FF00', '#6B6B00', '#efede9'].forEach(hex =>
    assert.ok(!app.toUpperCase().includes(hex.toUpperCase()), `${hex} still in a chart`));
  const radar = app.slice(app.indexOf('function SpiderChart'), app.indexOf('function SpiderChart') + 5000);
  assert.match(radar, /fill="#D9442A" fillOpacity="0\.14"/, 'the polygon is rust at the report opacity');
  assert.match(radar, /stroke="#DEDAD2"/, 'rings are hairlines');
  // and the chart drawn for the exported report matches the screen one
  assert.ok(app.includes('fill="#D9442A" fill-opacity="0.14"'), 'exported radar matches');
});

test('the strength highlight sits under the words rather than through them', () => {
  assert.ok(!app.includes("inset 0 -.5em 0 #D9442A"), 'a solid bar at half height reads as a strikethrough');
  assert.match(app, /inset 0 -\.32em 0 rgba\(217, 68, 42, \.22\)/);
});

test('no default framework colours are left in the app', () => {
  ['#F59E0B', '#D97706', '#6366F1', '#E53935', '#059669'].forEach(hex =>
    assert.ok(!app.toUpperCase().includes(hex), `${hex} is a framework default, not a token`));
});

test('the shell and form rules match the screen examples', () => {
  const css = read('src/index.css');
  assert.match(css, /\.dc-header \{[^}]*height: 64px/);
  assert.match(css, /\.dc-nav-active \{[^}]*border-bottom: 2px solid var\(--cc-rust-text/);
  assert.match(css, /--cc-gutter: 80px/, 'the screens use 80px page padding');
  // fields: 44px, hairline, 2px radius, everywhere rather than per screen
  assert.match(css, /\.dc-page select \{ height: 44px; \}/);
  assert.match(css, /border: 1px solid var\(--cc-faint, #8A8E95\)/);
});

test('the designer\'s type rules are not overridden by later blocks', () => {
  const css = read('src/index.css');
  const start = css.indexOf('Compass UI system (handoff v1');
  const mine = css.indexOf('Phase two: classes still carrying');
  const designer = css.slice(start, mine);
  const later = css.slice(mine);
  const theirs = new Set([...designer.matchAll(/\.(dc-[a-z0-9-]+|btn-[a-z0-9-]+)\s*[,{]/g)].map(m => m[1]));
  const redefined = [...new Set([...later.matchAll(/\.(dc-[a-z0-9-]+|btn-[a-z0-9-]+)\s*[,{]/g)].map(m => m[1]))].filter(c => theirs.has(c));
  // Only layout may be re-stated; type and weight belong to the handoff.
  assert.deepEqual(redefined.sort(), ['dc-listrow', 'dc-page', 'dc-wrap'],
    `later blocks redefine ${redefined.join(', ')}; type rules must come from the handoff`);
  // the standfirst is their 19px lead, not a small caps label
  assert.ok(!later.includes('.dc-standfirst {'), 'standfirst left to the handoff');
  assert.match(designer, /\.dc-standfirst, \.dc-lead \{ font-size: var\(--cc-fs-lead\)/);
});

test('numerals are set in the serif at regular weight, never heavy sans', () => {
  assert.ok(!/text-\[(3[0-9]|[4-9][0-9]|1[0-9]{2})px\] font-bold/.test(app), 'a large numeral is still heavy sans');
  const css = read('src/index.css');
  assert.match(css, /\.dc-numeral \{[\s\S]*?--cc-serif/);
});
