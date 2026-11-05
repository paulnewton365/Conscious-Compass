// The media audit through Perplexity (v4.20.0): replaces the pasted coverage
// on the earned media step; the paste box stays, optional.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as api from '../api/media-audit.js';
import * as ma from '../src/lib/mediaAudit.js';
import * as q from '../src/lib/assessmentQuality.js';

const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const vercel = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
const NOW = new Date('2026-11-04T12:00:00Z');

const AUDIT = {
  summary: 'Quaise had its largest media cycle to date.',
  announcements: [{ date: '2026-08-27', title: '$180M Series B final close', source: 'Quaise press release' }],
  metrics: { totalItems: 40, positive: 38, neutral: 2, negative: 0, mixed: 0, announcementLed: 34, independent: 6 },
  shareOfVoice: { peersChosenBy: 'agency', brandShare: 31, rank: 2, peers: [{ name: 'Fervo Energy', items: 49, share: 38 }, { name: 'Zanskar', items: 12, share: 9 }], note: '' },
  sentiment: 'Near-universally positive.',
  narrative: "The company's framing carried through intact.",
  topOutlets: ['ThinkGeoEnergy', 'Canary Media'],
  findings: ['Coverage is announcement-driven — 85% of items.'],
  items: [
    { date: '2026-08-27', outlet: 'ThinkGeoEnergy', title: 'Quaise raises $180M', url: 'https://www.thinkgeoenergy.com/q', origin: 'announcement', sentiment: 'positive', note: '' },
    { date: '2026-03-03', outlet: 'Canary Media', title: 'Quaise looks to advance', url: 'not a url', origin: 'made-up', sentiment: 'glowing', note: '' },
  ],
  limitations: ['Paywalled coverage is undercounted.'],
};

test('the request: high effort, in the background, the last six months, a strict schema', () => {
  const r = api.buildRequest({ brand: 'Quaise Energy', url: 'quaise.com', industry: 'Clean energy', peers: ['Fervo Energy', 'Zanskar'] }, NOW);
  assert.equal(r.effort, 'high');
  assert.equal(r.background, true);
  assert.equal(r.tools[0].type, 'web_search');
  assert.equal(r.tools[0].filters.search_after_date_filter, '05/06/2026');
  assert.equal(r.response_format.type, 'json_schema');
  assert.equal(r.response_format.json_schema.strict, true);
  // Strict mode: every object lists all its fields as required and allows no others.
  const walk = (s) => {
    if (s.type === 'object') { assert.equal(s.additionalProperties, false); assert.deepEqual([...s.required].sort(), Object.keys(s.properties).sort()); Object.values(s.properties).forEach(walk); }
    if (s.type === 'array') walk(s.items);
  };
  walk(api.AUDIT_SCHEMA);
  assert.match(r.input, /from 2026-05-06 to 2026-11-04 \(the last six months\)/);
  assert.match(r.input, /these peers, named by the agency: Fervo Energy, Zanskar/);
  assert.match(r.input, /Set peersChosenBy to "agency"/);
  assert.match(r.input, /announcement-led \(company, wire, announcement and contributed together\) and independent/);
  assert.ok(!/—/.test(r.input));
  // No peers named: Perplexity picks them and says so.
  const open = api.buildRequest({ brand: 'Quaise Energy' }, NOW);
  assert.match(open.input, /the four to six closest peers you identify/);
  assert.match(open.input, /Set peersChosenBy to "perplexity"/);
});

test('the result: the audit, the pages it read, the cost; failures say so', () => {
  const body = {
    status: 'completed', usage: { cost: { total_cost: 0.42 } },
    output: [
      { type: 'search_results', results: [{ url: 'https://a.com/1', title: 'A' }, { url: 'https://a.com/1', title: 'dup' }] },
      { type: 'message', content: [{ type: 'output_text', text: JSON.stringify(AUDIT), annotations: [{ type: 'url_citation', url: 'https://b.com', title: 'B' }] }] },
    ],
  };
  const out = api.shapeResult(body);
  assert.equal(out.status, 'completed');
  assert.equal(out.audit.metrics.totalItems, 40);
  assert.deepEqual(out.sources.map(x => x.url), ['https://a.com/1', 'https://b.com']);
  assert.equal(out.cost, 0.42);
  assert.deepEqual(api.shapeResult({ status: 'in_progress' }), { status: 'in_progress', error: null });
  assert.equal(api.shapeResult({ status: 'failed', error: { message: 'boom' } }).error, 'boom');
  assert.equal(api.shapeResult({ status: 'completed', output_text: 'not json' }).status, 'failed');
});

test('the endpoint: signed in, key required, starts a run and polls it', async () => {
  const { default: handler } = await import('../api/media-audit.js');
  process.env.SUPABASE_URL = 'https://sb.test';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service';
  const res = () => { const r = { code: 200, body: null }; r.status = (c) => { r.code = c; return r; }; r.json = (b) => { r.body = b; return r; }; r.end = () => r; r.setHeader = () => r; return r; };
  const calls = [];
  const fetchImpl = async (url, opts = {}) => {
    calls.push([String(url), opts.method || 'GET']);
    if (String(url).includes('/auth/v1/user')) return { ok: true, json: async () => ({ id: 'u1' }) };
    if (String(url).endsWith('/v1/agent')) return { ok: true, status: 200, json: async () => ({ id: 'resp_123', status: 'queued' }) };
    if (String(url).includes('/v1/responses/resp_123')) return { ok: true, status: 200, json: async () => ({ status: 'completed', output_text: JSON.stringify(AUDIT) }) };
    return { ok: false, status: 404, json: async () => ({}) };
  };
  delete process.env.PERPLEXITY_API_KEY;
  const none = res();
  await handler({ method: 'GET', headers: { authorization: 'Bearer t' }, query: { ping: '1' } }, none, { fetchImpl });
  assert.equal(none.code, 503);
  assert.equal(none.body.notConfigured, true);
  process.env.PERPLEXITY_API_KEY = 'pplx';
  const start = res();
  await handler({ method: 'POST', headers: { authorization: 'Bearer t' }, body: { brand: 'Quaise Energy', peers: [] } }, start, { fetchImpl });
  assert.deepEqual(start.body, { id: 'resp_123', status: 'queued' });
  const poll = res();
  await handler({ method: 'GET', headers: { authorization: 'Bearer t' }, query: { id: 'resp_123' } }, poll, { fetchImpl });
  assert.equal(poll.body.status, 'completed');
  assert.equal(poll.body.audit.shareOfVoice.brandShare, 31);
  const anon = res();
  await handler({ method: 'POST', headers: {}, body: { brand: 'x' } }, anon, { fetchImpl });
  assert.equal(anon.code, 401);
  assert.equal(vercel.functions['api/media-audit.js'].maxDuration, 60);
});

test('peers come from the competitors named in Setup', () => {
  assert.deepEqual(ma.peersFromContext('Goals: lead the category.\nKey competitors: Fervo Energy, Zanskar and XGS Energy.\nLive issues: none'), ['Fervo Energy', 'Zanskar', 'XGS Energy']);
  assert.deepEqual(ma.peersFromContext('Competitors - Eavor; Sage Geosystems'), ['Eavor', 'Sage Geosystems']);
  assert.deepEqual(ma.peersFromContext('Key competitors: [names]'), []);
  assert.deepEqual(ma.peersFromContext('competitor-led messaging is a risk'), []);
  assert.deepEqual(ma.peersFromContext(''), []);
});

test('the audit is clamped, and shown as text the assessor can correct', () => {
  const a = ma.normalizeAudit(AUDIT);
  assert.equal(a.items[1].url, '', 'no made-up links');
  assert.equal(a.items[1].origin, 'announcement');
  assert.equal(a.items[1].sentiment, 'neutral');
  assert.ok(!/—/.test(a.findings[0]), 'no em dashes');
  const text = ma.mediaAuditText(AUDIT, { ranAt: '2026-11-04T17:00:00Z' });
  assert.ok(text.startsWith(ma.MEDIA_AUDIT_PREFIX));
  assert.ok(q.isAutoText(text), 'the quality record counts it as auto-filled');
  assert.match(text, /Announcement-led versus independent: 34 announcement-led to 6 independent \(5\.7 to 1\); 85% announcement-led\./);
  assert.match(text, /Share of voice: 31%, rank 2 of 3 \(peers named in Setup: Fervo Energy 38%, Zanskar 9%\)/);
  assert.match(text, /ThinkGeoEnergy \| Quaise raises \$180M \| Announcement-led coverage \| positive \| https:\/\/www\.thinkgeoenergy\.com\/q/);
  assert.equal(ma.ratioLine({ announcementLed: 0, independent: 0 }), 'No coverage items found.');
});

test('scoring reads the key figures once, as estimates', () => {
  const block = ma.mediaAuditPromptBlock(AUDIT);
  assert.match(block, /estimates/);
  assert.match(block, /count it once/);
  assert.match(block, /six months/);
  assert.match(block, /Google News counts the last 90 days/);
  assert.ok(app.includes('${scoringInputs.earnedMedia.mediaAudit?.audit ? `${mediaAuditPromptBlock(scoringInputs.earnedMedia.mediaAudit.audit)}'));
});

test('a run is polled to the end, survives a dropped connection, and gives up after 15 minutes', async () => {
  let n = 0;
  const fetchImpl = async () => { n++; if (n === 1) throw new Error('offline'); if (n === 2) return { ok: true, json: async () => ({ status: 'in_progress' }) }; return { ok: true, json: async () => ({ status: 'completed', audit: AUDIT }) }; };
  const done = await ma.waitForMediaAudit('resp_1', { fetchImpl, sleep: async () => {} });
  assert.equal(done.status, 'completed');
  assert.equal(done.audit.metrics.independent, 6);
  const slow = await ma.waitForMediaAudit('resp_2', { startedAt: Date.now() - 16 * 60000, fetchImpl: async () => ({ ok: true, json: async () => ({ status: 'in_progress' }) }), sleep: async () => {} });
  assert.match(slow.error, /15 minutes/);
  const stopped = await ma.waitForMediaAudit('resp_3', { shouldStop: () => true });
  assert.equal(stopped.status, 'stopped');
});

test('the earned media step: audit required, paste optional, both feed the analysis', () => {
  assert.ok(!app.includes('Paste any press coverage, news articles, mentions, or media clips from the last 3 months.'));
  assert.ok(app.includes('<AssessBlock title="Additional coverage" labelFor="em-coverage" tag="Optional"'));
  assert.ok(app.includes("{ label: 'Media audit', done: hasCoverage },"));
  assert.ok(app.includes("const canProceed = isComplete && !!assessmentData.autoAssessContent && hasCoverage;"));
  assert.ok(app.includes('MEDIA AUDIT (Perplexity web research over the last six months; figures are estimates, and the assessor may have corrected them):'));
  assert.ok(app.includes('ADDITIONAL COVERAGE PROVIDED BY THE ASSESSOR (coverage search may not reach):'));
  assert.ok(app.includes('Treat the media audit\'s coverage list, the Google News counts (last 90 days) and anything you find yourself as one body of coverage: count each item once. Use the audit\'s longer window to judge whether coverage holds up between announcements.'));
  // The auto-assess prompt is unchanged.
  assert.ok(app.includes('Your task is to conduct a comprehensive earned media performance assessment for ${project.brandName}'));
  // A run started before the step was left is picked up again.
  assert.ok(app.includes('setAssessmentData({ mediaAuditRun: { id: start.id, startedAt } });'));
  assert.ok(app.includes('const run = assessmentData.mediaAuditRun;'));
  // The internal readout shows it; the quality record counts it as a source.
  assert.ok(app.includes('Media Audit (Perplexity)'));
  assert.deepEqual(q.stepSources('earnedMedia').map(([name]) => name), ['Auto-assess', 'Media audit']);
});
