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
  assert.deepEqual(s, { brands: 3, scored: 2, averageOverall: 66 });
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
  assert.deepEqual(labels.slice(0, 8), ['Brand', 'Website', 'Overall', 'Stage', 'Credibility', 'Trust', 'Reputation', 'Authenticity']);
  ATTRIBUTES.forEach(a => assert.ok(labels.includes(a.name), a.name));
  for (const l of ['Headline', 'Scored', 'Thin public record']) assert.ok(labels.includes(l));
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
