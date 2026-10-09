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
  const writes = [...app.matchAll(/await (saveCompassResult|saveAssessment|updateCompassResult)\(/g)].map(m => m.index);
  // v3.118.0: save writes the assessment by id (and once more to record new ids),
  // and the result as a new history entry or an update to the current one.
  assert.ok(writes.length >= 4 && writes.length <= 7, `${writes.length} writes`);
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
  // v3.109.0: still only compass_results, reduced to each brand's latest save
  assert.match(teaserBlock, /const pool = latestPerBrand\(\(full\.data \|\| \[\]\)\.map\(formatCompassResult\)\)/);
  assert.match(teaserBlock, /setBenchPool\(latestPerBrand\(\(data \|\| \[\]\)\.map\(formatCompassResult\)\)\)/);
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
  // the handoff's own build files run 1280 wide with 48px padding
  assert.match(css, /--cc-page-max:\s*1280px/);
  assert.match(css, /--cc-gutter:\s*48px/);
});

test('the visible furniture is styled by the new system, not left on the old rules', () => {
  const css = read('src/index.css');
  const cut = css.indexOf('app tokens + dc-');
  assert.ok(cut > 0, 'the design system is present');
  const newRules = css.slice(cut);
  // page titles, rows and score numerals: the things on every screen
  ['dc-h2', 'dc-pagehead', 'dc-standfirst', 'dc-listrow', 'dc-listrow-t', 'dc-result-row',
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
  // as pages move onto the design's markup, headings take .dc-display and
  // .dc-h rather than setting the serif inline; either is acceptable, a
  // heavy sans heading is not
  assert.ok((app.match(/className="dc-display/g) || []).length >= 3, 'headings use the display class');
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

test('the summary names strength and growth in words, not a coloured marker', () => {
  // the design sets these in bold inside .dc-summary; the old rust marker
  // under the words read as a strikethrough once the accent changed
  assert.ok(!app.includes("inset 0 -.5em 0 #D9442A"), 'no solid bar through the words');
  const glance = app.slice(app.indexOf('function ReportGlanceSection'), app.indexOf('function ReportGlanceSection') + 2500);
  assert.ok(glance.includes('className="dc-summary"'), 'the summary uses the design class');
  assert.ok(glance.includes('demonstrates strength in'), 'and states it plainly');
});

test('no default framework colours are left in the app', () => {
  ['#F59E0B', '#D97706', '#6366F1', '#E53935', '#059669'].forEach(hex =>
    assert.ok(!app.toUpperCase().includes(hex), `${hex} is a framework default, not a token`));
});

test('the shell and form rules match the screen examples', () => {
  const css = read('src/index.css');
  assert.match(css, /\.dc-header \{[^}]*height: 64px/s, 'the 64px shell comes from the design system');
  // the design marks the active nav item with aria-current, not a class
  assert.match(css, /\.dc-nav-links a\[aria-current="page"\][^}]*border-color: var\(--cc-rust-text\)/);
  assert.match(css, /--cc-gutter: 48px/, "the handoff's build files use 48px page padding");
  // fields: 44px, hairline, 2px radius, everywhere rather than per screen
  // v3.97.2: the same rule now also covers fields inside dialogs
  assert.match(css, /\.dc-page select,?[^{]*\{ height: 44px; \}/);
  assert.match(css, /border: 1px solid var\(--cc-faint\)/, 'fields take the hairline border');
});

test('the designer\'s type rules are not overridden by later blocks', () => {
  const css = read('src/index.css');
  const start = css.indexOf('app tokens + dc-');
  const mine = css.indexOf('Phase two: classes still carrying');
  const designer = css.slice(start, mine);
  const later = css.slice(mine);
  const theirs = new Set([...designer.matchAll(/\.(dc-[a-z0-9-]+|btn-[a-z0-9-]+)\s*[,{]/g)].map(m => m[1]));

  // Later blocks may re-state layout and clear pre-restyle decoration, but
  // must not set type on anything the handoff already specifies: that is how
  // the standfirst became a small-caps label.
  const offenders = [];
  const stripped = later.replace(/\/\*[\s\S]*?\*\//g, '');   // comments are not rules
  for (const m of stripped.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
    const body = m[2];
    if (!/(^|;|\s)(font|font-family|font-size|font-weight)\s*:/.test(body)) continue;
    for (const part of m[1].split(',')) {
      // only the subject of the rule counts: ".dc-page input" styles the input
      const subject = part.trim().split(/\s+|>/).filter(Boolean).pop() || '';
      [...subject.matchAll(/\.(dc-[a-z0-9-]+|btn-[a-z0-9-]+)/g)]
        .map(x => x[1]).filter(c => theirs.has(c))
        .forEach(c => offenders.push(c));
    }
  }
  assert.deepEqual([...new Set(offenders)], [],
    `later blocks set type on handoff classes: ${[...new Set(offenders)].join(' | ')}`);

  // the standfirst is their 19px lead, not a small caps label
  assert.ok(!later.includes('.dc-standfirst {'), 'standfirst left to the handoff');
  assert.match(designer, /\.dc-standfirst, \.dc-lead \{ font-size: var\(--cc-fs-lead\)/);
});

test('numerals are set in the serif at regular weight, never heavy sans', () => {
  assert.ok(!/text-\[(3[0-9]|[4-9][0-9]|1[0-9]{2})px\] font-bold/.test(app), 'a large numeral is still heavy sans');
  const css = read('src/index.css');
  assert.match(css, /\.dc-numeral \{[\s\S]*?--cc-serif/);
});

test('the results page uses the Saved row pattern, not the old grid table (v3.100.0)', () => {
  // rendered checks live in tests/list-pages.test.mjs
  const css = read('src/index.css');
  assert.ok(!css.includes('.dc-results-row {') && !css.includes('.dc-resbar {'), 'the grid-table rules are gone');
  assert.match(css, /\.dc-result-score \{[^}]*tabular-nums/, 'numbers line up');
  // the Results component alone: Insights and Landscape follow it in the file
  const results = app.slice(app.indexOf('function CompassResultsPage'), app.indexOf('function OnboardingTour'));
  assert.ok(results.includes('dc-listrow dc-result-row'), 'rows share the Saved list row');
  assert.ok(!results.includes('gridTemplateColumns'), 'no inline column grid');
});

test('the report masthead follows screen B', () => {
  const head = app.slice(app.indexOf('{/* \u2500\u2500 Masthead'), app.indexOf('01 Results at a glance'));
  assert.ok(head.includes('Compass report'), 'a rust eyebrow naming the report');
  assert.ok(head.includes('dc-kicker is-accent'), 'the eyebrow is the accent one');
  assert.ok(head.includes('scores?.headline || project.brandName'), 'the verdict is the title, with the brand as fallback');
  assert.ok(head.includes('className="dc-display"'), 'set in the display serif');
  assert.ok(head.includes('Run ') && head.includes('Framework v'), 'a provenance line under it');
  // the old treatment is gone
  assert.ok(!head.includes('Conscious Compass Assessment \u00B7'), 'the old subtitle is replaced');
  assert.ok(!head.includes("clamp(40px,6vw,88px)"), 'the hand-set hero size is gone');
});

test('the stepper follows the handoff: state in words, not colour alone', () => {
  const steps = app.slice(app.indexOf('function ProgressSteps'), app.indexOf('function ProgressSteps') + 2200);
  assert.ok(steps.includes('className="dc-steps"'), 'the handoff class');
  assert.ok(steps.includes("'Done'") && steps.includes("'In progress'") && steps.includes("'Not started'"),
    'each step names its own state');
  assert.ok(steps.includes('aria-current'), 'the current step is announced');
  assert.ok(steps.includes('dc-steps-compact') && steps.includes('dc-steps-bar'), 'the narrow-screen form');
  assert.ok(!steps.includes('Check className'), 'the tick icon is gone, as the notes ask');
  const css = read('src/index.css');
  assert.match(css, /\.dc-steps li\.is-current \{ border-color: var\(--cc-rust\)/);
});

test('the website step opens the way the handoff has it', () => {
  // v3.99.0: the head lives in the shared AssessPage frame; the rendered
  // check is in tests/assessment-packet.test.mjs
  const frame = app.slice(app.indexOf('function AssessPage('), app.indexOf('function AssessPage(') + 1400);
  assert.ok(frame.includes('dc-kicker is-accent') && frame.includes('Step {step} of 6'), 'rust kicker with the step');
  assert.ok(frame.includes('className="dc-display"'), 'the title is the display serif');
  assert.ok(frame.includes('dc-standfirst'), 'brand and site as the standfirst');
  const page = app.slice(app.indexOf('function WebsiteAssessment'), app.indexOf('function SocialMediaAssessment'));
  assert.ok(page.includes('<AssessPage step={2} name="Website"'));
  assert.ok(!page.includes('label="SEO visibility"'), 'the top score summary is removed');
});

test('no unicode escape is left sitting in JSX text, where it prints literally', () => {
  // \u00B7 inside a JS string is a middle dot; in JSX text it is six characters.
  const inText = [...app.matchAll(/>\s*[^<>{}]*\\u[0-9A-Fa-f]{4}[^<>{}]*</g)].map(m => m[0].trim());
  assert.deepEqual(inText, [], `escapes printed as text: ${inText.join(' | ')}`);
});

test('handoff v2 corrections are applied where they were called out', () => {
  const css = read('src/index.css');
  // six bands, not four, and the band is always written in the chip
  ['pre-foundational', 'foundational', 'establishing', 'differentiating', 'leading', 'transforming']
    .forEach(b => assert.ok(css.includes(`data-band="${b}"`), `${b} chip`));
  // the wordmark and the brand diamond no longer share a class
  assert.ok(css.includes('.dc-wordmark'), 'header wordmark');
  assert.ok(css.includes('.dc-brand-mark'), 'brand diamond renamed');
  assert.ok(!app.includes('className="dc-mark"'), 'nothing still uses the clashing name');

  // results: meaning no longer rests on colour
  const results = app.slice(app.indexOf('function CompassResultsPage'), app.indexOf('function ComparisonPage'));
  assert.ok(!/dc-resnum" style=\{\{ color: scoreColor/.test(results), 'the score number is ink');
  assert.ok(results.includes('dc-pill" data-band='), 'the band travels in a chip');
  assert.ok(results.includes("INDUSTRIES.find(x => x.id === id)") && results.includes('industryName(r.industry)'), 'sector shows its label, not its key');

  // saved: the off-palette tip is gone
  const saved = app.slice(app.indexOf('function SavedAssessmentsPage'), app.indexOf('function ClientReportView'));
  assert.ok(!saved.includes('#F0F7FF'), 'the blue tip box is removed');
  // v3.100.0: US English, as everywhere else ("Aug 31, 2026")
  assert.ok(!saved.includes("'en-GB'") && saved.includes("toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })"), 'dates read as Aug 31, 2026');
});

test('the design system sits in a layer, so the markup\'s own utilities still win', () => {
  const css = read('src/index.css');
  assert.ok(css.includes('@layer components'), 'system rules are layered');
  // tokens and faces stay outside the layer, where they belong
  const layerAt = css.indexOf('@layer components');
  assert.ok(css.indexOf('@font-face') < layerAt, 'faces are not layered');
  assert.ok(css.indexOf('--cc-paper:') < layerAt, 'tokens are not layered');
  // unlayered system rules beat Tailwind utilities, which is how a
  // text-white label ended up black on a black button
  assert.ok(css.indexOf('.btn-primary {') > layerAt, 'button rules are inside the layer');
});

test('the header carries the Antenna wordmark, not a text stand-in', () => {
  const header = app.slice(app.indexOf('function Header('), app.indexOf('function Header(') + 3000);
  assert.ok(header.includes('antenna-new-logo.svg'), 'the wordmark image');
  assert.ok(header.includes('alt="Antenna Group"'));
  assert.ok(!header.includes('<b>.antenna</b>'), 'the text stand-in is gone');
});

test('the report follows the design notes: neutral tags, ink tiles, one quote, a plain radar', () => {
  // recommendations: pills, not ink on a rust fill, and Benefit as a label
  const recs = app.slice(app.indexOf('const recommendations'), app.indexOf('const recommendations') + 12000);
  assert.ok(!/background: '#D9442A', padding: '4px 7px'/.test(app), 'the rust-filled tag fails contrast');
  assert.ok(app.includes('<span key={j} className="dc-pill">{attr}</span>'), 'tags are neutral pills');
  assert.ok(app.includes('<div className="dc-kicker" style={{ marginTop: 12 }}>Benefit</div>'), 'Benefit is a label');
  void recs;

  // attribute tiles: the serif numeral and a bar, no colour-by-score
  const tiles = app.slice(app.indexOf('function ReportScoreTiles'), app.indexOf('function ReportAttributeSection'));
  assert.ok(tiles.includes('dc-stat-n') && tiles.includes('dc-lens-bar'));
  assert.ok(!tiles.includes('scoreColor'), 'the number no longer carries a band meaning by colour');

  // the headline appears once, in the masthead
  assert.ok(!app.includes("borderLeft: '6px solid #D9442A', padding: '2px 0 2px 22px'"), 'the duplicate quote is gone');

  // radar: grid lines, no centre disc
  const radar = app.slice(app.indexOf('function SpiderChart'), app.indexOf('function SpiderChart') + 4000);
  assert.ok(!radar.includes('Centre score'), 'the centre disc is gone');
  assert.ok(radar.includes('Rings as grid lines only'), 'rings are lines, not alternating fills');
});

test('the report toolbar is a row of text buttons, as the export has it', () => {
  const start = app.indexOf('<header className="dc-page-head">');
  const head = app.slice(start, app.indexOf('</div>', app.indexOf('dc-head-actions', start)));
  assert.ok(head.includes('className="dc-head-actions"'), 'the export\'s action row');
  assert.ok(head.includes('className="dc-head-row is-baseline"'), 'toolbar and title share a head row');
  // text only: the icons and the size overrides are gone
  ['MessageSquareWarning', 'ExternalLink', '!text-[11px]', '!px-4'].forEach(t =>
    assert.ok(!head.includes(t), `${t} still in the toolbar`));
  // v3.118.0: Copy full report removed; Check consistency's class is a template
  // (greyed once run), so five plain secondaries remain.
  assert.equal((head.match(/className="btn-secondary"/g) || []).length, 4, 'Challenge, Language, Save, Client link');
  assert.ok(head.includes("className={`btn-secondary${checkDone ? ' is-spent' : ''}`}"), 'Check consistency greys once run');
  assert.equal((head.match(/className="btn-primary"/g) || []).length, 1, 'one primary');
});

test('section heads follow the export: rust number, serif title, text Hide', () => {
  // v3.101.0: one module-level heading serves both reports
  const head = app.slice(app.indexOf('function SectionHeading('), app.indexOf('function SectionHeading(') + 1200);
  assert.ok(head.includes('className="dc-sec-toggle"'), 'the export\'s toggle');
  assert.ok(head.includes('className="dc-sec-n"') && head.includes('className="dc-h"'), 'number and serif title');
  assert.ok(head.includes("{open ? 'Hide' : 'Show'}"), 'state in words');
  assert.ok(head.includes('aria-expanded'), 'and announced');
  assert.ok(!head.includes('ChevronDown'), 'the chevron is gone');
  assert.ok(!head.includes('uppercase'), 'the uppercase label is retired');
});

test('the eight tiles line up when they wrap, and the masthead does not double its rule', () => {
  const css = read('src/index.css');
  // position in the grid decides the divider, not the adjacent sibling
  assert.match(css, /\.dc-tile:not\(:nth-child\(4n \+ 1\)\) \{ border-left: var\(--cc-border\)/);
  assert.match(css, /\.dc-tile \+ \.dc-tile \{ border-left: 0; padding-left: 0; \}/);
  assert.match(css, /\.dc-tile:nth-child\(n \+ 5\) \{ border-top: var\(--cc-border\); \}/);
  // and the section head below carries the only rule
  assert.match(css, /\.dc-page-head \{ padding-bottom: 0; border-bottom: 0/);
});

test('maturity and the attribute cards follow the export', () => {
  const at = app.indexOf('<section className="dc-section dc-reveal">');
  const mat = app.slice(at, at + 2000);
  assert.ok(mat.includes('className="dc-maturity"') && mat.includes('dc-maturity-track'), 'the export\'s track');
  assert.ok(mat.includes('dc-maturity-marker'), 'the score marked above it');
  assert.ok(mat.includes('dc-pill" data-band='), 'the band as a chip, not a rust-edged block');
  assert.ok(!mat.includes("borderLeft: '6px solid #D9442A'"), 'the rust edge is gone');

  const cards = app.slice(app.indexOf('function ReportAttributeSection'), app.indexOf('function ReportAttributeSection') + 6000);
  assert.ok(cards.includes('className="dc-attr-grid'), 'the export\'s grid');
  assert.ok(cards.includes('<article key={attr.id} className="dc-block dc-attr-card">'), 'cards are blocks');
  assert.ok(cards.includes('<div className="dc-stat-n">'), 'serif numeral');
  assert.ok(cards.includes('<h3 className="dc-h is-card">'), 'serif name');
  assert.ok(!/color: scoreColor\(sc\.score\)/.test(cards), 'the numeral is not coloured by score');
});

test('the score adjustment sits in the grid beside the last attribute (v3.118.0)', () => {
  assert.ok(app.includes('className="dc-block dc-attr-adj" data-field="score-adjustment"'), 'a grid cell, not a full row');
  assert.ok(!app.includes('className="dc-block dc-attr-span"'));
  const panel = app.slice(app.indexOf('dc-attr-adj'), app.indexOf('dc-attr-adj') + 400);
  assert.ok(panel.includes('className="dc-h is-card"'), 'its heading uses the system');
});

test('the evidence panel is one block with findings as a list and lenses as pills', () => {
  const at = app.indexOf('className="dc-findings-grid"');
  // v3.98.0: the teaser variant's list sits between the heading and the grid
  const ev = app.slice(at - 2000, at + 900);
  assert.ok(ev.includes('<h3 className="dc-h is-card">'), 'the heading uses the system');
  assert.ok(ev.includes('className="dc-finding"'), 'findings are list items');
  assert.ok(ev.includes('<span key={t} className="dc-pill">{t}</span>'), 'lenses are pills');
  assert.ok(!ev.includes("background: CARD"), 'the stacked white cards are gone');
  // the key states what it means, in words
  assert.ok(app.includes('Supports the score') && app.includes('Works against it'));
  assert.ok(app.includes('className="dc-fp-legend"'), 'the export\'s legend');
});

test('sections sit on the page stack, not on 80px margins of their own', () => {
  assert.ok(!app.includes('marginTop: 80'), 'no section carries its own 80px margin');
  const css = read('src/index.css');
  assert.match(css, /\.dc-page > section, \.dc-page > \.dc-reveal \{ margin-top: 0; \}/);
});

test('the report toolbar keeps every action wired', () => {
  // the welcome hero uses the same class, so anchor on the report's own row
  const at = app.indexOf('dc-head-actions', app.indexOf('<header className="dc-page-head">'));
  const bar = app.slice(at, at + 2200);
  const wired = [
    ['Challenge', 'setShowChallenge(true)'],
    ['Language', 'setShowLanguage(true)'],
    ['Save', 'onClick={saveReport}'],   // v3.108.1: via saveReport, which shows Saving and Saved
    ['Client link', 'setShowClientLink(true)'],
    ['Export DOCX', 'onClick={generateDocx}'],
  ];
  assert.ok(!bar.includes('Copy full report') && !app.includes('copyReportText'), 'Copy full report is gone (v3.118.0)');
  wired.forEach(([label, handler]) => {
    assert.ok(bar.includes(label), `${label} is present`);
    assert.ok(bar.includes(handler), `${label} is wired to ${handler}`);
  });
  assert.ok(bar.includes('disabled={isGenerating}'), 'export reports its own progress');
});

// v3.97: the footprint and trust lens source-string checks above were replaced
// by rendered behaviour tests in tests/footprint-trust.test.mjs.
