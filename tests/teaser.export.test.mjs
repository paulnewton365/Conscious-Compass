// Campaign scores download. Run with the rest: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import { JSDOM } from 'jsdom';
import { readFileSync } from 'node:fs';
import {
  buildCampaignRows, campaignSummary, buildCampaignWorkbook, bandStyle,
  sheetName, exportFilename, EXPORT_COLUMNS,
} from '../src/lib/teaserExport.js';
import { ATTRIBUTES } from '../src/data/rubric.js';

const scoresFor = (base) => Object.fromEntries(ATTRIBUTES.map((a, i) => [a.id, { score: base + i, confidence: 'medium', rationale: 'SENTINEL_RATIONALE' }]));
const teaser = (name, overall, extra = {}) => ({
  id: name, brand_name: name, website_url: `https://${name.toLowerCase()}.com`,
  // Fields the export must ignore even if a caller passes a full record.
  context: 'SENTINEL_CONTEXT', created_by_name: 'SENTINEL_AUTHOR',
  evidence: { sources: { social: { text: 'SENTINEL_EVIDENCE' } } },
  result: overall === null ? null : {
    overall, stage: 'Establishing',
    lensScores: { credibility: overall + 1, trust: overall - 1, reputation: overall + 2, authenticity: overall - 2 },
    scores: { ...scoresFor(overall - 3), headline: `${name} headline`, summary: 'SENTINEL_SUMMARY', trustFindings: [{ text: 'SENTINEL_FINDING' }] },
    lowConfidenceCount: 1, thinRecord: false, scoredAt: '2026-09-18T12:00:00Z',
    history: [{ overall: 1, scoredAt: 'SENTINEL_HISTORY' }],
  },
  ...extra,
});

test('rows: scored brands highest first, unscored last and alphabetical, none dropped', () => {
  const rows = buildCampaignRows([teaser('Mid', 55), teaser('Zed', null), teaser('Top', 72), teaser('Abe', null), teaser('Low', 30)]);
  assert.deepEqual(rows.map(r => r.brand), ['Top', 'Mid', 'Low', 'Abe', 'Zed']);
  assert.equal(rows[3].stage, 'Not scored');
  assert.equal(rows[3].overall, null);
});

test('rows copy stored scores exactly; nothing is recalculated', () => {
  const t = teaser('Acme', 61);
  const [row] = buildCampaignRows([t]);
  assert.equal(row.overall, 61);
  for (const k of ['credibility', 'trust', 'reputation', 'authenticity']) assert.equal(row[k], t.result.lensScores[k]);
  ATTRIBUTES.forEach(a => assert.equal(row[a.id], t.result.scores[a.id].score));
  assert.equal(row.headline, 'Acme headline');
});

test('summary counts brands and averages scored brands only', () => {
  const s = campaignSummary(buildCampaignRows([teaser('A', 60), teaser('B', 71), teaser('C', null)]));
  assert.deepEqual(s, { brands: 3, scored: 2, averageOverall: 66, outdated: 2 }, 'fixtures carry no version, so both count as earlier method');
  assert.equal(campaignSummary([]).averageOverall, null);
});

test('colour bands match the app exactly at every boundary', () => {
  const [green, orange, red, empty] = [bandStyle(70), bandStyle(45), bandStyle(44), bandStyle(null)];
  assert.equal(bandStyle(100), green); assert.equal(bandStyle(70), green);
  assert.equal(bandStyle(69), orange); assert.equal(bandStyle(45), orange);
  assert.equal(bandStyle(44), red); assert.equal(bandStyle(0), red);
  assert.equal(new Set([green, orange, red, empty]).size, 4);
  assert.equal(bandStyle(undefined), empty);
});

test('columns cover everything asked for, in order', () => {
  const labels = EXPORT_COLUMNS.map(c => c.label);
  assert.deepEqual(labels.slice(0, 4), ['Brand', 'Website', 'Overall', 'Stage']);
  const c = labels.indexOf('Credibility');
  assert.deepEqual(labels.slice(c, c + 4), ['Credibility', 'Trust', 'Reputation', 'Authenticity']);
  ATTRIBUTES.forEach(a => assert.ok(labels.includes(a.name), a.name));
  for (const l of ['Headline', 'Scored', 'Limited evidence', 'Scoring method']) assert.ok(labels.includes(l));
  assert.ok(!labels.includes('Thin public record'));
});

async function unpack(campaign, teasers) {
  const { zip, filename, rows } = await buildCampaignWorkbook(campaign, teasers, new Date('2026-09-18T12:00:00Z'));
  const buf = await zip.generateAsync({ type: 'nodebuffer' });
  const back = await JSZip.loadAsync(buf);
  const files = {};
  for (const name of Object.keys(back.files)) if (!back.files[name].dir) files[name] = await back.file(name).async('string');
  return { files, filename, rows };
}

test('workbook has every required part and every XML part is well formed', async () => {
  const { files } = await unpack('Climate Week', [teaser('Acme', 61), teaser('Nope', null)]);
  for (const part of ['[Content_Types].xml', '_rels/.rels', 'xl/workbook.xml', 'xl/_rels/workbook.xml.rels', 'xl/styles.xml', 'xl/worksheets/sheet1.xml', 'xl/worksheets/sheet2.xml']) {
    assert.ok(files[part], `${part} present`);
    const doc = new JSDOM('').window.DOMParser;
    const parsed = new doc().parseFromString(files[part], 'application/xml');
    assert.equal(parsed.getElementsByTagName('parsererror').length, 0, `${part} is well-formed XML`);
  }
});

test('workbook carries no internal fields, even when handed full records', async () => {
  const { files } = await unpack('Climate Week', [teaser('Acme', 61), teaser('Beta', 40)]);
  const all = Object.values(files).join('\n');
  for (const s of ['SENTINEL_CONTEXT', 'SENTINEL_AUTHOR', 'SENTINEL_EVIDENCE', 'SENTINEL_SUMMARY', 'SENTINEL_FINDING', 'SENTINEL_HISTORY', 'SENTINEL_RATIONALE']) {
    assert.ok(!all.includes(s), `${s} leaked into the download`);
  }
});

test('hostile text is escaped and control characters stripped, so Excel can open the file', async () => {
  const nasty = teaser('Acme <b> & "Sons" \u0007', 61);
  nasty.result.scores.headline = 'Growth </t></is></c><c> & more\u0001\u001F';
  const { files } = await unpack('A & B <Q4>', [nasty]);
  const sheet = files['xl/worksheets/sheet1.xml'];
  assert.ok(sheet.includes('Acme &lt;b&gt; &amp; &quot;Sons&quot;'));
  assert.ok(sheet.includes('Growth &lt;/t&gt;&lt;/is&gt;&lt;/c&gt;&lt;c&gt; &amp; more'));
  assert.ok(!/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(sheet));
  const parsed = new (new JSDOM('').window.DOMParser)().parseFromString(sheet, 'application/xml');
  assert.equal(parsed.getElementsByTagName('parsererror').length, 0);
});

test('numbers are written as numbers so Excel can sort and average them', async () => {
  const { files } = await unpack('C', [teaser('Acme', 61)]);
  assert.match(files['xl/worksheets/sheet1.xml'], /<c r="C5" s="\d+"><v>61<\/v><\/c>/);
});

test('sheet names and filenames are made safe for Excel and file systems', () => {
  assert.equal(sheetName('Climate Week: NYC [2026] / Q4'), 'Climate Week NYC 2026 Q4');
  assert.ok(sheetName('x'.repeat(50)).length <= 31);
  assert.equal(sheetName(''), 'Scores');
  assert.equal(exportFilename('Climate Week: NYC / Q4', new Date('2026-09-18T12:00:00Z')), 'Climate-Week-NYC-Q4-Teaser-Scores-2026-09-18.xlsx');
});

test('an empty campaign still produces a valid workbook', async () => {
  const { files, rows } = await unpack('Empty', []);
  assert.equal(rows.length, 0);
  assert.ok(files['xl/worksheets/sheet1.xml'].includes('0 brands'));
});

test('JSZip is loaded on demand, not imported at the top of the module', () => {
  const src = readFileSync(new URL('../src/lib/teaserExport.js', import.meta.url), 'utf8');
  assert.ok(!/^import .*jszip/m.test(src), 'static import would add a second JSZip to the main bundle');
  assert.ok(src.includes("await import('jszip')"));
});

// ── Sector baseline columns (v3.31) ──

const sectorBaseline = { available: true, scope: 'industry', sectorName: 'Energy & Utilities', avgScore: 58, count: 12, basis: 'Sector' };

test('baseline columns sit after Stage, in order', () => {
  const labels = EXPORT_COLUMNS.map(c => c.label);
  assert.deepEqual(labels.slice(3, 9), ['Stage', 'Sector', 'Sector baseline', 'Vs baseline', 'Brands in baseline', 'Baseline basis']);
});

test('baseline row values: difference is overall minus baseline; unscored brands still get their baseline', () => {
  const rows = buildCampaignRows([teaser('Acme', 61), teaser('Later', null)], { Acme: sectorBaseline, Later: sectorBaseline });
  assert.deepEqual([rows[0].sector, rows[0].baseline, rows[0].vsBaseline, rows[0].baselineBrands, rows[0].baselineBasis], ['Energy & Utilities', 58, 3, 12, 'Sector']);
  assert.equal(rows[1].baseline, 58);
  assert.equal(rows[1].vsBaseline, null, 'no difference without a score');
});

test('fallback and unavailable baselines are labelled, never shown as a sector figure or a zero', () => {
  const fallback = { ...sectorBaseline, scope: 'all', avgScore: 55, count: 40, basis: 'All brands (fewer than 5 in sector)' };
  const [f] = buildCampaignRows([teaser('Acme', 61)], { Acme: fallback });
  assert.equal(f.baselineBasis, 'All brands (fewer than 5 in sector)');
  const [u] = buildCampaignRows([teaser('Acme', 61)], { Acme: { available: false, reason: 'x' } });
  assert.equal(u.baseline, null);
  assert.match(u.baselineBasis, /Unavailable/);
  const [none] = buildCampaignRows([teaser('Acme', 61)]);
  assert.equal(none.baseline, null);
});

test('Vs baseline is written as a signed number; baseline carries score colours', async () => {
  const { zip } = await buildCampaignWorkbook('C', [teaser('Up', 61), teaser('Down', 40)], new Date('2026-09-18T12:00:00Z'), { Up: sectorBaseline, Down: sectorBaseline });
  const files = {};
  for (const n of ['xl/styles.xml', 'xl/worksheets/sheet1.xml']) files[n] = await zip.file(n).async('string');
  assert.ok(files['xl/styles.xml'].includes('formatCode="+0;-0;0"'));
  const sheet = files['xl/worksheets/sheet1.xml'];
  const cellStyle = (ref) => sheet.match(new RegExp(`<c r="${ref}" s="(\\d+)"`))[1];
  assert.match(sheet, /<c r="G5" s="11"><v>3<\/v><\/c>/, 'Up: 61 vs 58 is +3');
  assert.match(sheet, /<c r="G6" s="11"><v>-18<\/v><\/c>/, 'Down: 40 vs 58 is -18');
  assert.equal(cellStyle('F5'), String(bandStyle(58)), 'baseline banded like any score');
  assert.ok(sheet.includes('Sector baselines calculated from full assessments on this date'));
  const parsed = new (new JSDOM('').window.DOMParser)().parseFromString(files['xl/styles.xml'], 'application/xml');
  assert.equal(parsed.getElementsByTagName('parsererror').length, 0);
});


// ── Scoring method (v3.32) ──

test('each row states its scoring method, and the sheet warns when a campaign mixes methods', async () => {
  const current = teaser('Now', 60); current.result.teaserVersion = '2.0';
  const earlier = teaser('Then', 55); earlier.result.teaserVersion = '1.0';
  const rows = buildCampaignRows([current, earlier, teaser('Pending', null)]);
  assert.equal(rows.find(r => r.brand === 'Now').method, 'Calibrated v2.0');
  assert.equal(rows.find(r => r.brand === 'Then').method, 'Earlier v1.0, rescore');
  assert.equal(rows.find(r => r.brand === 'Pending').method, '');
  const mixed = await buildCampaignWorkbook('C', [current, earlier]);
  assert.ok((await mixed.zip.file('xl/worksheets/sheet1.xml').async('string')).includes('1 brand was scored with the earlier method; rescore before comparing'));
  const clean = await buildCampaignWorkbook('C', [current]);
  assert.ok(!(await clean.zip.file('xl/worksheets/sheet1.xml').async('string')).includes('earlier method'));
  assert.ok((await clean.zip.file('xl/worksheets/sheet2.xml').async('string')).includes('no campaign modifier'));
});
