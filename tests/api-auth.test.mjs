// v3.100.1: every endpoint checks its caller; the browser attaches the token.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';

const API = new URL('../api/', import.meta.url);
const handlers = readdirSync(API).filter(f => f.endsWith('.js') && !f.startsWith('_'));

function mockRes() {
  const r = { code: 200, body: null };
  r.status = (c) => { r.code = c; return r; };
  r.json = (b) => { r.body = b; return r; };
  r.send = (b) => { r.body = b; return r; };
  r.end = () => r;
  r.setHeader = () => r;
  return r;
}
// Supabase answers: a valid token maps to a user; the admin flag comes from profiles.
function supabaseFetch({ user = null, admin = false, upstream = [] } = {}) {
  return async (url, opts = {}) => {
    upstream.push(String(url));
    if (String(url).includes('/auth/v1/user')) {
      const ok = user && opts.headers?.Authorization === 'Bearer good-token';
      return { ok, status: ok ? 200 : 401, json: async () => (ok ? user : {}) };
    }
    if (String(url).includes('/rest/v1/profiles')) return { ok: true, status: 200, json: async () => [{ is_admin: admin }] };
    return { ok: true, status: 200, json: async () => ({ content: [{ type: 'text', text: 'x' }] }), text: async () => '' };
  };
}

beforeEach(() => {
  process.env.SUPABASE_URL = 'https://sb.test';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service';
  process.env.ANTHROPIC_API_KEY = 'anthropic';
  delete process.env.CRON_SECRET;
});

test('every endpoint imports the caller check and calls it first', () => {
  assert.ok(handlers.length >= 13);   // 13 since insights-analysis went with the Insights tab (v3.117.0)
  for (const f of handlers) {
    const src = readFileSync(new URL(f, API), 'utf8');
    assert.match(src, /import \{ requireUser(, requireStaff)?(, isAdmin)? \} from '\.\/_auth\.js';/, f);
    const body = src.slice(src.indexOf('export default async function handler'));
    const statements = body.split('\n').slice(1).filter(l => l.trim() && !l.trim().startsWith('//'));
    // The one documented branch (v3.120.0): the reader issue, which sends only
    // publicIssue() and since v4.3.0 checks for a staff account first.
    const first = f === 'stay-conscious-newsletter.js' && statements[0].includes('if (isPublicRequest(req)) return sendPublicIssue(req, res);') ? statements[1] : statements[0];
    if (f === 'stay-conscious-newsletter.js') {
      const send = src.slice(src.indexOf('async function sendPublicIssue(req, res) {'));
      assert.match(send.split('\n')[1], /if \(!\(await requireStaff\(req, res\)\)\) return;/, 'the reader issue checks for staff before anything else');
    }
    assert.match(first, /requireUser\(req, res/, `${f}: the check runs before anything else`);
  }
});

for (const f of handlers) {
  test(`${f}: a request with no session gets 401 and never reaches upstream`, async () => {
    const upstream = [];
    globalThis.fetch = supabaseFetch({ upstream });
    const { default: handler } = await import(new URL(f, API).href);
    const res = mockRes();
    await handler({ method: 'POST', headers: {}, body: { userId: 'u2', prompt: 'hi' }, query: {} }, res);
    assert.equal(res.code, 401);
    assert.deepEqual(upstream, [], 'nothing was called on the caller\'s behalf');
  });
}

test('delete-user: a signed-in non-admin gets 403 and nothing is deleted', async () => {
  const upstream = [];
  globalThis.fetch = supabaseFetch({ user: { id: 'u1' }, admin: false, upstream });
  const { default: handler } = await import(new URL('delete-user.js', API).href);
  const res = mockRes();
  await handler({ method: 'POST', headers: { authorization: 'Bearer good-token' }, body: { userId: 'u2' } }, res);
  assert.equal(res.code, 403);
  assert.ok(!upstream.some(u => u.includes('/admin/users/')), 'no delete call');
});

test('delete-user: an admin can delete another user, but not themselves', async () => {
  const upstream = [];
  globalThis.fetch = supabaseFetch({ user: { id: 'admin-1' }, admin: true, upstream });
  const { default: handler } = await import(new URL('delete-user.js', API).href);
  const self = mockRes();
  await handler({ method: 'POST', headers: { authorization: 'Bearer good-token' }, body: { userId: 'admin-1' } }, self);
  assert.equal(self.code, 400);
  const other = mockRes();
  await handler({ method: 'POST', headers: { authorization: 'Bearer good-token' }, body: { userId: 'u2' } }, other);
  assert.equal(other.code, 200);
  assert.ok(upstream.some(u => u.endsWith('/auth/v1/admin/users/u2')));
});

test('a forged token is refused', async () => {
  globalThis.fetch = supabaseFetch({ user: { id: 'u1' } });
  const { default: handler } = await import(new URL('claude.js', API).href);
  const res = mockRes();
  await handler({ method: 'POST', headers: { authorization: 'Bearer forged' }, body: { prompt: 'hi' } }, res);
  assert.equal(res.code, 401);
});

test('a signed-in user reaches the Claude proxy', async () => {
  const upstream = [];
  globalThis.fetch = supabaseFetch({ user: { id: 'u1' }, upstream });
  const { default: handler } = await import(new URL('claude.js', API).href);
  const res = mockRes();
  await handler({ method: 'POST', headers: { authorization: 'Bearer good-token' }, body: { prompt: 'hi', max_tokens: 10 } }, res);
  assert.notEqual(res.code, 401);
  assert.ok(upstream.some(u => u.includes('api.anthropic.com')));
});

test('cron: with CRON_SECRET set, only the secret gets in; a forged cron user agent does not', async () => {
  const { isCron } = await import(new URL('_auth.js', API).href);
  process.env.CRON_SECRET = 's3cret';
  assert.equal(isCron({ headers: { authorization: 'Bearer s3cret' } }), true);
  assert.equal(isCron({ headers: { 'user-agent': 'vercel-cron/1.0' } }), false);
  delete process.env.CRON_SECRET;
  assert.equal(isCron({ headers: { 'user-agent': 'vercel-cron/1.0' } }), true, 'fallback until the secret is set');
});

test('the browser attaches the session token to /api/ calls only', async () => {
  const { withSessionToken } = await import('../src/lib/apiAuth.js').catch(async () => {
    // the module imports the Supabase client; test the wrapper logic from source instead
    const src = readFileSync(new URL('../src/lib/apiAuth.js', import.meta.url), 'utf8');
    const body = src.slice(src.indexOf('export function withSessionToken'), src.indexOf('export function installApiAuth'));
    return { withSessionToken: new Function(`${body.replace('export ', '')}; return withSessionToken;`)() };
  });
  const seen = [];
  const f = withSessionToken(async (input, init) => { seen.push([input, init?.headers?.get?.('Authorization') || null]); return {}; }, async () => 'tok');
  await f('/api/claude', { method: 'POST', headers: { 'Content-Type': 'application/json' } });
  await f('https://example.com/x');
  await f('/version.json');
  assert.deepEqual(seen, [['/api/claude', 'Bearer tok'], ['https://example.com/x', null], ['/version.json', null]]);
});

test('no browser path to Anthropic, and no key kept in the browser', () => {
  const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
  assert.ok(!app.includes('VITE_ANTHROPIC_API_KEY'), 'no key baked into the bundle');
  assert.ok(!app.includes("fetch('https://api.anthropic.com"), 'no direct browser call');
  assert.ok(!app.includes('anthropic-dangerous-direct-browser-access'));
  assert.ok(!app.includes("localStorage.setItem('conscious-compass-apikey'"), 'the key is not stored');
  assert.ok(app.includes("localStorage.removeItem('conscious-compass-apikey')"), 'old copies are cleared');
  const main = readFileSync(new URL('../src/main.jsx', import.meta.url), 'utf8');
  assert.ok(main.includes('installApiAuth()'));
});

// ── v3.101.0 cleanup ─────────────────────────────────────────

test('export libraries load on demand, not with the app', () => {
  const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
  for (const lib of ['docx', 'jspdf', 'html2canvas']) {
    assert.ok(!new RegExp(`^import .* from '${lib}';`, 'm').test(app), `${lib} is not a static import`);
    assert.ok(app.includes(`await import('${lib}')`), `${lib} is imported where it is used`);
  }
});

test('the dead modules stay gone', () => {
  const src = readdirSync(new URL('../src/lib/', import.meta.url));
  for (const f of ['api.js', 'deckExport.js', 'deckCharts.js']) assert.ok(!src.includes(f), f);
  const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
  for (const gone of ['const generatePdf', 'handleEmailShare', 'extractEarnedMedia', 'handleInstagramImageUpload']) assert.ok(!app.includes(gone), gone);
});

test('one section heading serves both reports, declared once', () => {
  const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
  assert.equal((app.match(/function SectionHeading\(/g) || []).length, 1);
  assert.ok(!app.includes('const SectionHead ='), 'no heading component declared inside a report');
});

// ── v3.101.1 page gutter ─────────────────────────────────────

test('pages keep their side gutter where dc-wrap and dc-page share an element', () => {
  const css = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8');
  const page = css.indexOf('.dc-page { padding: var(--cc-s-16) 0 var(--cc-s-24);');
  const fix = css.indexOf('.dc-wrap.dc-page { padding-left: var(--cc-gutter, 48px); padding-right: var(--cc-gutter, 48px); }');
  assert.ok(page > 0 && fix > page, 'the gutter is restored after the shorthand that zeroed it');
});

test('tiles go two per row on a phone, outside the layer where the four-column rule lives', () => {
  const css = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8');
  const four = css.indexOf('.dc-tiles { grid-template-columns: repeat(4, minmax(0, 1fr)); }');
  const phone = css.indexOf('.dc-tiles, .dc-tiles.is-scores, .dc-tiles.is-scores.is-4, .dc-tiles.is-8 { grid-template-columns: repeat(2, minmax(0, 1fr)); }');
  assert.ok(four > 0 && phone > four);
  let depth = 0;
  for (const ch of css.slice(0, phone)) { if (ch === '{') depth++; if (ch === '}') depth--; }
  assert.equal(depth, 1, 'inside the phone media query only, not the components layer');
});

// ── v3.102.0 Word export: embedded fonts ─────────────────────

test('font obfuscation round-trips byte for byte, and only the first 32 bytes change', async () => {
  const { obfuscateFont } = await import('../src/lib/docxFonts.js');
  const orig = new Uint8Array(readFileSync(new URL('../public/report/HankenGrotesk-Bold.ttf', import.meta.url)));
  const key = 'C7D5F06E-C683-13B7-0E5B-516D54AACE71';
  const ob = obfuscateFont(orig, key);
  assert.notDeepEqual(ob.slice(0, 32), orig.slice(0, 32));
  assert.deepEqual(ob.slice(32), orig.slice(32));
  assert.deepEqual(obfuscateFont(ob, key), orig, 'applying it twice restores the font');
});

test('the Word file carries Hanken Grotesk regular and bold, and Newsreader regular and italic', async () => {
  const { Document, Packer, Paragraph, TextRun } = await import('docx');
  const JSZip = (await import('jszip')).default;
  const { embedReportFonts } = await import('../src/lib/docxFonts.js');
  const doc = new Document({ background: { color: 'FBFAF7' }, sections: [{ children: [new Paragraph({ children: [new TextRun({ text: 'x', font: 'Hanken Grotesk' })] })] }] });
  const fetchImpl = async (url) => { const b = readFileSync(new URL(`../public${url}`, import.meta.url)); return { ok: true, arrayBuffer: async () => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) }; };
  const out = await embedReportFonts(await Packer.toBlob(doc), { JSZip, fetchImpl });
  const zip = await JSZip.loadAsync(await out.arrayBuffer());
  const table = await zip.file('word/fontTable.xml').async('string');
  assert.match(table, /<w:font w:name="Hanken Grotesk">.*<w:embedRegular r:id="(\w+)".*<w:embedBold r:id="(\w+)"/);
  assert.match(table, /<w:font w:name="Newsreader">.*<w:embedRegular r:id="\w+".*<w:embedItalic r:id="\w+"/);
  const rels = await zip.file('word/_rels/fontTable.xml.rels').async('string');
  for (const id of table.match(/r:id="(\w+)"/g).map(m => m.slice(6, -1))) assert.ok(rels.includes(`Id="${id}"`), `${id} is related`);
  assert.equal(Object.keys(zip.files).filter(f => f.endsWith('.odttf')).length, 4);
  const settings = await zip.file('word/settings.xml').async('string');
  assert.ok(settings.indexOf('<w:displayBackgroundShape/>') < settings.indexOf('<w:embedTrueTypeFonts/>'), 'schema order');
  assert.match(await zip.file('[Content_Types].xml').async('string'), /Extension="odttf"/);
});

test('a font that will not load leaves the export working, just without embedding', async () => {
  const { Document, Packer, Paragraph } = await import('docx');
  const JSZip = (await import('jszip')).default;
  const { embedReportFonts } = await import('../src/lib/docxFonts.js');
  const blob = await Packer.toBlob(new Document({ sections: [{ children: [new Paragraph('x')] }] }));
  const warn = console.warn; console.warn = () => {};
  const out = await embedReportFonts(blob, { JSZip, fetchImpl: async () => ({ ok: false, status: 404 }) });
  console.warn = warn;
  assert.equal(out, blob, 'the original file comes back');
});

test('the report export uses the template type and palette, and embeds the fonts', () => {
  const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
  const gen = app.slice(app.indexOf('const generateDocx = async'), app.indexOf('const generateDocx = async') + 60000);
  assert.ok(!gen.includes("font: 'Inter'"), 'no Inter left');
  assert.ok(gen.includes("const SANS = 'Hanken Grotesk', SERIF = 'Newsreader';"));
  assert.ok(gen.includes("background: { color: 'FBFAF7' }"), 'paper ground');
  assert.ok(gen.includes('embedReportFonts(await Packer.toBlob(doc)'), 'fonts embedded before saving');
  for (const old of ["'1A1A1A'", "'E53935'", "'059669'", "'E0DED9'"]) assert.ok(!gen.includes(old), `old colour ${old} gone`);
});

test('the public newsletter issue: no sign-in, allowlisted sections only, no story opportunities, no assessed brand names', async () => {
  const mod = await import('../api/stay-conscious-newsletter.js');
  const nl = { issueNumber: 30, weekOf: 'October 4, 2026', secretField: 'SENTINEL_FIELD',
    leadStory: { category: 'AI Visibility', headline: 'H', insight: 'I', whyItMatters: 'W', internal: 'SENTINEL_LEAD' },
    intelligenceItems: [{ category: 'c', headline: 'h', insight: 'i', whyItMatters: 'w' }],
    landscapeAnalysis: { brandCount: 52, sectorCount: 11, averageScore: 50, headline: 'Brands skipped the conviction.', summary: 'Most brands built the infrastructure.\n\nAcme Water leads the water sector.', insights: 'ACME WATER is the outlier.\n\nSentient lags everywhere.' },
    storyOpportunities: [{ headline: 'SENTINEL_STORY', body: 'Acme Water' }] };
  const out = mod.publicIssue(nl, ['Acme Water', 'MKB']);
  const json = JSON.stringify(out);
  for (const t of ['SENTINEL_FIELD', 'SENTINEL_LEAD', 'SENTINEL_STORY', 'storyOpportunities', 'Acme Water', 'ACME WATER']) assert.ok(!json.includes(t), t);
  assert.equal(out.landscapeAnalysis.summary, 'Most brands built the infrastructure.');
  assert.equal(out.landscapeAnalysis.insights, 'Sentient lags everywhere.');
  assert.equal(out.landscapeAnalysis.averageScore, 50);
  assert.equal(out.leadStory.headline, 'H');
  // the handler: GET ?public=1 needs a staff session (v4.3.0), and with no brand list nothing is sent
  const calls = [];
  process.env.SUPABASE_URL = 'https://db'; process.env.SUPABASE_SERVICE_ROLE_KEY = 'k';
  const staff = { id: 'u1', email: 'Paul.Newton@antennagroup.com', email_confirmed_at: '2026-01-01' };
  globalThis.fetch = async (url) => { calls.push(String(url)); if (String(url).includes('/auth/v1/user')) return { ok: true, json: async () => staff }; return String(url).includes('compass_results')
    ? { ok: true, json: async () => [{ brand_name: 'Acme Water' }] }
    : { ok: true, json: async () => [{ newsletter: nl, refreshed_at: '2026-10-04T23:30:00Z' }] }; };
  const res = { statusCode: 0, body: null, headers: {}, setHeader(k, v) { this.headers[k] = v; }, status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; } };
  await mod.default({ method: 'GET', query: { public: '1' }, headers: { authorization: 'Bearer t' } }, res);
  assert.equal(res.statusCode, 200);
  assert.ok(!JSON.stringify(res.body).includes('SENTINEL_STORY') && !JSON.stringify(res.body).includes('Acme Water'));
  assert.ok(calls.some(u => u.includes('/auth/v1/user')), 'the session is checked');
  assert.equal(res.headers['Cache-Control'], 'private, no-store', 'never kept by a shared cache');
  globalThis.fetch = async (url) => (String(url).includes('/auth/v1/user') ? { ok: true, json: async () => staff } : String(url).includes('compass_results') ? { ok: false, status: 500, json: async () => ({}) } : { ok: true, json: async () => [{ newsletter: nl }] });
  const res2 = { ...res, statusCode: 0, body: null };
  await mod.default({ method: 'GET', query: { public: '1' }, headers: { authorization: 'Bearer t' } }, res2);
  assert.equal(res2.statusCode, 502, 'without the brand list the issue is withheld, not sent unchecked');
});

test('earned creative in the news: only examples whose link the web search returned, cleaned, at most three (v3.124.0)', async () => {
  const mod = await import('../api/refresh-stay-conscious-newsletter.js');
  const ex = (brand, url, extra = {}) => ({ brand, agency: 'Agency', title: `${brand} work`, what: 'They did a thing — publicly.', coverage: 'Carried by the trade press.', outlet: 'Adweek', url, ...extra });
  const data = { content: [
    { type: 'server_tool_use', name: 'web_search' },
    { type: 'web_search_tool_result', content: [
      { type: 'web_search_result', url: 'https://www.adweek.com/brand/real-one/?utm_source=feed' },
      { type: 'web_search_result', url: 'https://www.thedrum.com/news/real-two' },
      { type: 'web_search_result', url: 'http://insecure.example.com/real-three' },
    ] },
    { type: 'text', text: 'Here you go: ' + JSON.stringify({ examples: [
      ex('Real One', 'https://adweek.com/brand/real-one'),
      ex('Invented', 'https://made-up.example.com/never-searched'),
      ex('Real Two', 'https://www.thedrum.com/news/real-two#top'),
      ex('Insecure', 'http://insecure.example.com/real-three'),
      ex('Real One', 'https://adweek.com/brand/real-one'),
      ex('', 'https://www.thedrum.com/news/real-two'),
    ] }) },
  ] };
  const items = mod.earnedCreativeFromResponse(data);
  assert.deepEqual(items.map(i => i.brand), ['Real One', 'Real Two'], 'invented, non-https, duplicate and unnamed examples are dropped');
  assert.equal(items[0].what, 'They did a thing, publicly.', 'no em dashes');
  assert.deepEqual(mod.earnedCreativeFromResponse({ content: [{ type: 'text', text: 'no json' }] }), []);
  assert.ok(mod.EARNED_CREATIVE_PROMPT.includes('use only facts from the pages your searches returned'));
  const pub = await import('../api/stay-conscious-newsletter.js');
  const out = pub.publicIssue({ issueNumber: 1, earnedCreative: { items: [...items, { brand: 'Bad', url: 'javascript:alert(1)' }], generatedAt: 'x' } }, []);
  assert.deepEqual(out.earnedCreative.items.map(i => i.brand), ['Real One', 'Real Two'], 'the public issue carries the section, https links only');
});

test('the weekly refreshes: a signed-in non-admin gets 403 and nothing runs; the scheduled run still gets in (v3.124.2)', async () => {
  const jobs = ['refresh-stay-conscious-newsletter.js', 'refresh-stay-conscious.js', 'refresh-landscape-analysis.js', 'refresh-insights-analysis.js'];
  for (const f of jobs) {
    const src = readFileSync(new URL(f, API), 'utf8');
    assert.ok(src.includes('requireUser(req, res, { admin: true, allowCron: true })'), `${f} requires an admin or the schedule`);
    const upstream = [];
    globalThis.fetch = supabaseFetch({ user: { id: 'u1' }, admin: false, upstream });
    const { default: handler } = await import(new URL(f, API).href);
    const res = mockRes();
    await handler({ method: 'POST', headers: { authorization: 'Bearer good-token' }, query: {} }, res);
    assert.equal(res.code, 403, `${f}: non-admin refused`);
    assert.ok(!upstream.some(u => u.includes('api.anthropic.com') || u.includes('stay_conscious') || u.includes('_cache')), `${f}: nothing read, generated or written`);
  }
  const { requireUser } = await import(new URL('_auth.js', API).href);
  process.env.CRON_SECRET = 's3cret';
  const ok = await requireUser({ headers: { authorization: 'Bearer s3cret' } }, mockRes(), { admin: true, allowCron: true });
  assert.deepEqual(ok, { cron: true }, 'the Sunday schedule needs no admin');
  delete process.env.CRON_SECRET;
});

test('v4.0 sweep: citations that split the JSON mid-string still parse; two-letter brand names are caught publicly', async () => {
  const mod = await import('../api/refresh-stay-conscious-newsletter.js');
  const url = 'https://www.adweek.com/brand/real-one';
  const data = { content: [
    { type: 'web_search_tool_result', content: [{ type: 'web_search_result', url }] },
    { type: 'text', text: '{"examples":[{"brand":"Real One","what":"They planted ' },
    { type: 'text', text: 'a forest', citations: [{ url }] },
    { type: 'text', text: ' overnight.","url":"' + url + '"}]}' },
  ] };
  const items = mod.earnedCreativeFromResponse(data);
  assert.equal(items.length, 1);
  assert.equal(items[0].what, 'They planted a forest overnight.');
  const pub = await import('../api/stay-conscious-newsletter.js');
  const out = pub.publicIssue({ landscapeAnalysis: { summary: 'BP leads the sector.\n\nMost brands lag.', insights: '' } }, ['BP']);
  assert.equal(out.landscapeAnalysis.summary, 'Most brands lag.');
  const sb = readFileSync(new URL('../src/lib/supabase.js', import.meta.url), 'utf8');
  assert.ok(sb.includes("error.code === '23505'") && sb.includes('drop index if exists public.saved_assessments_brand_name_key'), 'the old one-per-brand rule is named, with its fix');
  const setup = readFileSync(new URL('../docs/SUPABASE_SETUP.sql', import.meta.url), 'utf8');
  assert.ok(setup.includes('drop index if exists public.saved_assessments_brand_name_key;') && !/create unique index if not exists saved_assessments_brand_name_key/.test(setup));
});

test('v4.0.1: an example is kept only if its article names the brand and the work, and descriptions end on a whole sentence', async () => {
  const mod = await import('../api/refresh-stay-conscious-newsletter.js');
  const item = { brand: 'The Ordinary', title: 'The Markup Marche', url: 'https://www.inc.com/x/free-bus', searchTitle: "The Ordinary's latest marketing stunt: a free bus for Brooklynites" };
  const page = (t) => async () => ({ ok: true, text: async () => `<html><body>${'filler '.repeat(120)}${t}</body></html>` });
  assert.equal(await mod.verifyExample(item, { fetchImpl: page('The Ordinary launched a free bus in Brooklyn.') }), false, 'same brand, different campaign: dropped');
  assert.equal(await mod.verifyExample(item, { fetchImpl: page('The Ordinary opened the Markup March\u00e9, a fake grocery store.') }), true, 'accents folded');
  assert.equal(await mod.verifyExample(item, { fetchImpl: async () => ({ ok: false }) }), false, 'blocked page: the headline must pass instead');
  assert.equal(await mod.verifyExample({ ...item, searchTitle: 'The Ordinary opens The Markup Marche pop-ups' }, { fetchImpl: async () => { throw new Error('timeout'); } }), true);
  assert.equal(mod.wholeSentences('One two three. Four five six seven eight nine ten eleven twelve thirteen.', 40), 'One two three.');
  assert.equal(mod.wholeSentences('Short enough.', 40), 'Short enough.');
  assert.ok(mod.EARNED_CREATIVE_PROMPT.includes('Never use a link about a different campaign by the same brand.'));
});

test('v4.0.2: six candidates over three months, a top-up search for new brands, and a gentler headline check', async () => {
  const mod = await import('../api/refresh-stay-conscious-newsletter.js');
  assert.ok(mod.EARNED_CREATIVE_PROMPT.startsWith('Find 6 recent examples'));
  assert.ok(mod.EARNED_CREATIVE_PROMPT.includes('go back up to three months'));
  assert.ok(mod.EARNED_CREATIVE_PROMPT.includes('Never use a link about a different campaign by the same brand.'));
  assert.ok(mod.earnedCreativePrompt({ exclude: ['Nike', 'Lego'] }).includes('already covered: Nike, Lego.'));

  // Blocked page: one word of the work in the headline, or in the link's slug, is enough.
  const blocked = { fetchImpl: async () => ({ ok: false }) };
  const item = { brand: 'The Ordinary', title: 'The Markup Marche', url: 'https://www.inc.com/x/free-bus', searchTitle: "The Ordinary's latest marketing stunt" };
  assert.equal(await mod.verifyExample({ ...item, searchTitle: 'The Ordinary opens a Marche in Soho' }, blocked), true, 'headline names part of the work');
  assert.equal(await mod.verifyExample({ ...item, url: 'https://www.adweek.com/brand/the-ordinary-markup-marche/' }, blocked), true, 'slug names the work');
  assert.equal(await mod.verifyExample(item, blocked), false, 'brand alone is still not enough');
  // A readable article still has to name most of the work.
  const page = (t) => async () => ({ ok: true, text: async () => `<html><body>${'filler '.repeat(120)}${t}</body></html>` });
  assert.equal(await mod.verifyExample({ brand: 'Lego', title: 'Rebuild the Reef Tour', url: 'https://x.com/a' }, { fetchImpl: page('Lego opened a reef shop.') }), false);

  // Two rounds: the second excludes brands already tried and tops up to three, newest first.
  const prompts = [];
  const reply = (examples) => ({ ok: true, json: async () => ({ content: [
    { type: 'web_search_tool_result', content: examples.map(e => ({ type: 'web_search_result', url: e.url, title: e.title })) },
    { type: 'text', text: JSON.stringify({ examples }) },
  ] }) });
  const ex = (brand, published) => ({ brand, title: `${brand} work`, what: 'They did a thing.', url: `https://adweek.com/${brand.toLowerCase()}`, published });
  const rounds = [
    [ex('A', '2026-09-01'), ex('B', '2026-10-01'), ex('C', '2026-08-01')],
    [ex('A', '2026-09-01'), ex('D', '2026-07-15'), ex('E', '')],
  ];
  const fetchImpl = async (_u, init) => { prompts.push(JSON.parse(init.body).messages[0].content); return reply(rounds[prompts.length - 1]); };
  const pass = new Set(['A', 'D', 'E']);
  const factCheck = async (e) => ({ item: { ...e, factChecked: true }, report: { brand: e.brand, outcome: 'kept', removed: [] } });   // checked in its own test
  const out = await mod.fetchEarnedCreative('k', { fetchImpl, verify: async (e) => pass.has(e.brand), factCheck });
  assert.equal(prompts.length, 2, 'a second search ran because only one passed');
  assert.ok(prompts[1].includes('Look back up to twelve months'), 'v4.10.0: the second search looks further back');
  assert.ok(prompts[1].includes('already covered: a, b, c'), 'the top-up skips brands already tried');
  assert.deepEqual(out.items.map(i => i.brand), ['A', 'D', 'E'], 'three kept, most recent first, undated last');
  assert.ok(!('searchTitle' in out.items[0]));

  // Three pass in the first round: no second search.
  prompts.length = 0;
  const one = await mod.fetchEarnedCreative('k', { fetchImpl, verify: async () => true, factCheck });
  assert.equal(prompts.length, 1);
  assert.deepEqual(one.items.map(i => i.brand), ['B', 'A', 'C']);
  // Nothing found at all: the section is left out.
  assert.deepEqual((await mod.fetchEarnedCreative('k', { fetchImpl: async () => ({ ok: false }) })).items, []);

  const pub = await import('../api/stay-conscious-newsletter.js');
  const issue = pub.publicIssue({ earnedCreative: { items: [{ brand: 'A', what: 'x', url: 'https://a.com', published: '2026-09-01' }, { brand: 'B', what: 'x', url: 'https://b.com', published: '<b>' }] } }, []);
  assert.deepEqual(issue.earnedCreative.items.map(i => i.published), ['2026-09-01', ''], 'only a plain date goes out publicly');
  const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
  assert.ok(app.includes('ecMonth(e.published)'), 'the newsletter shows the month');
});

test('v4.1.0: the public landscape explains the attributes it names, in title case, for readers new to the Compass', async () => {
  const g = await import('../src/data/attributeGlossary.js');
  assert.equal(g.ATTRIBUTE_GLOSSARY.length, 8);
  assert.ok(g.ATTRIBUTE_GLOSSARY.every(a => !/[—–]/.test(a.plain)), 'no em dashes');
  assert.deepEqual(g.attributesMentioned('SENTIENT averages 42, below Attentive.', 'Brands are aware of it. AWAKE lags.').map(a => a.id), ['SENTIENT', 'ATTENTIVE', 'AWAKE'], 'first-mention order; "aware" as a word is not Aware');
  assert.equal(g.titleCaseAttributes('ATTENTIVE, VISIONARY and INTENTIONAL lead; SENTIENTS stays.'), 'Attentive, Visionary and Intentional lead; SENTIENTS stays.');

  const mod = await import('../api/refresh-stay-conscious-newsletter.js');
  const p = mod.landscapePrompt('ANALYSIS TEXT');
  assert.ok(p.includes('Readers are colleagues across Antenna Group, many of whom have never used the Conscious Compass.'), 'staff only since v4.3.0');
  assert.ok(p.includes('explain it in a few plain words in the same sentence'));
  assert.ok(p.includes('Never name an individual brand or company'));
  assert.ok(g.ATTRIBUTE_GLOSSARY.every(a => p.includes(`- ${a.name}: ${a.plain}`)), 'the prompt carries every meaning');
  assert.ok(p.endsWith('ANALYSIS TEXT'));

  const pub = await import('../api/stay-conscious-newsletter.js');
  const out = pub.publicIssue({ leadStory: { headline: 'x', insight: 'For AWAKE assessments', whyItMatters: 'REFLECTIVE matters' }, landscapeAnalysis: { headline: 'SENTIENT lags', summary: 'ATTENTIVE leads.\n\nAcme Corp lags on AWAKE.' } }, ['Acme Corp']);
  assert.equal(out.landscapeAnalysis.headline, 'Sentient lags');
  assert.equal(out.landscapeAnalysis.summary, 'Attentive leads.', 'title case, and brand paragraphs still dropped');
  assert.equal(out.leadStory.whyItMatters, 'Reflective matters');

  const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
  assert.ok(app.includes('publicView && la?.summary && landscapeTerms.length > 0') && app.includes("{landscapeKey('is-beside')}") && app.includes("{landscapeKey('is-stacked')}"), 'the key shows on the public page only, under the photo or after the text when stacked');
  assert.ok(app.includes("const whyLabel = 'Why it matters';"), 'v4.8.0: one label, for leaders');
  assert.ok(app.includes("'Average Conscious Compass score out of 100'"));
});

test('v4.1.2: a paused search is resumed, the reason for a short section is saved, and checked examples carry over', async () => {
  const mod = await import('../api/refresh-stay-conscious-newsletter.js');
  const url = (b) => `https://adweek.com/${b.toLowerCase()}`;
  const ex = (brand) => ({ brand, title: `${brand} work`, what: 'They did a thing.', url: url(brand) });
  // The first reply pauses after searching, with no answer; the resumed turn answers.
  const bodies = [];
  const replies = [
    { stop_reason: 'pause_turn', content: [{ type: 'text', text: 'Searching {first} ' }, { type: 'web_search_tool_result', content: ['A', 'B', 'C'].map(b => ({ type: 'web_search_result', url: url(b) })) }] },
    { stop_reason: 'end_turn', content: [{ type: 'text', text: JSON.stringify({ examples: [ex('A'), ex('B'), ex('C')] }) }] },
  ];
  const fetchImpl = async (_u, init) => { bodies.push(JSON.parse(init.body)); return { ok: true, json: async () => replies[bodies.length - 1] }; };
  const factCheck = async (e) => ({ item: { ...e, factChecked: true }, report: { brand: e.brand, outcome: 'kept', removed: [] } });
  const out = await mod.fetchEarnedCreative('k', { fetchImpl, verify: async () => true, factCheck });
  assert.equal(bodies.length, 2, 'the paused turn was resumed');
  assert.equal(bodies[1].messages[1].role, 'assistant', 'resumed with the paused content');
  assert.deepEqual(out.items.map(i => i.brand), ['A', 'B', 'C'], 'links from the paused turn count as searched');
  assert.ok(out.items.every(i => i.verified === true));
  assert.deepEqual(out.status, { searches: 1, candidates: 3, passed: 3, reasons: [], factCheck: ['A', 'B', 'C'].map(brand => ({ brand, outcome: 'kept', removed: [] })) });

  // A failed request: no items, and the reason is saved.
  const failed = await mod.fetchEarnedCreative('k', { fetchImpl: async () => ({ ok: false, status: 429 }) });
  assert.deepEqual(failed.items, []);
  assert.ok(failed.status.reasons.includes('search request failed (429)'));

  // Nothing new: last issue's checked examples stay up for four weeks, never unchecked ones.
  const now = Date.parse('2026-10-09T12:00:00Z');
  const prev = { items: [{ ...ex('A'), verified: true, factChecked: true }, { ...ex('Old'), url: url('old') }, { ...ex('Unchecked'), url: url('unchecked'), verified: true }], generatedAt: '2026-10-04T23:30:00Z' };
  const carried = mod.withCarryOver(failed, prev, 34, now);
  assert.deepEqual(carried.items.map(i => i.brand), ['A'], 'v4.10.0: only fact-checked examples carry over');
  assert.equal(carried.carriedFrom, 34);
  assert.equal(mod.withCarryOver(failed, { ...prev, generatedAt: '2026-08-01T00:00:00Z' }, 34, now), failed, 'too old: not carried');
  assert.equal(mod.withCarryOver(out, prev, 34, now), out, 'fresh examples win');

  // The status never reaches the public issue.
  const pub = await import('../api/stay-conscious-newsletter.js');
  const issue = pub.publicIssue({ earnedCreative: carried }, []);
  assert.deepEqual(Object.keys(issue.earnedCreative), ['items']);
  assert.ok(!('verified' in issue.earnedCreative.items[0]));

  const { ecStatusNote } = await import('../src/lib/newsletter.js');
  assert.equal(ecStatusNote(out), null, 'three fresh: no note');
  assert.match(ecStatusNote(failed), /no section this issue \(3 searches, 0 candidates, 0 passed the article check; search request failed \(429\)\)/);
  assert.match(ecStatusNote(carried), /examples from issue 34 are shown again/);
  assert.equal(ecStatusNote({ items: [] }), null, 'older issues have no status');
});

test('v4.2.0: the Sunday run keeps the issue it replaces; past issues can be listed and read, publicly through the same filter', async () => {
  const mod = await import('../api/refresh-stay-conscious-newsletter.js');
  const calls = [];
  const fetchImpl = async (url, init) => { calls.push({ url, init }); return { ok: true }; };
  const row = { newsletter: { issueNumber: 37, weekOf: 'October 9, 2026' }, refreshed_at: '2026-10-09T18:45:00Z' };
  assert.equal(await mod.archiveIssue(row, { supabaseUrl: 'https://db', supabaseKey: 'k', fetchImpl }), true);
  assert.ok(calls[0].url.endsWith('/rest/v1/stay_conscious_newsletter_archive?on_conflict=refreshed_at'));
  assert.match(calls[0].init.headers.Prefer, /resolution=ignore-duplicates/, 'a retried run never copies twice');
  assert.deepEqual(JSON.parse(calls[0].init.body), { issue_number: 37, newsletter: row.newsletter, refreshed_at: row.refreshed_at });
  assert.equal(await mod.archiveIssue(null, { supabaseUrl: 'https://db', supabaseKey: 'k', fetchImpl }), null, 'nothing live: nothing kept');
  assert.equal(await mod.archiveIssue(row, { supabaseUrl: 'https://db', supabaseKey: 'k', fetchImpl: async () => { throw new Error('down'); } }), false, 'a failed copy never throws');

  const src = readFileSync(new URL('refresh-stay-conscious-newsletter.js', API), 'utf8');
  // v4.7.0: the week's issue is archived when the weekly draft is published,
  // just before the live issue is overwritten; revisions archive nothing.
  assert.ok(src.includes('const archived = meta.weekly ? await archiveIssue(liveRow, { supabaseUrl, supabaseKey }) : null;'), 'only a weekly issue archives the one it replaces');
  assert.ok(src.indexOf('archiveIssue(liveRow') < src.indexOf('await writeIssueRow(LIVE_ID, published);'), 'archived before it is overwritten');

  const pub = await import('../api/stay-conscious-newsletter.js');
  assert.equal(pub.archiveId({ query: { issue: '12' } }), 12);
  assert.equal(pub.archiveId({ query: { issue: '12; drop table' } }), null, 'only a plain number reaches the query');
  assert.equal(pub.wantsArchiveList({ query: { archive: 'list' } }), true);
  assert.deepEqual(pub.archiveListRow({ id: 3, issue_number: 37, refreshed_at: 'x', week_of: 'October 9, 2026', headline: 'SENTIENT lags' }),
    { id: 3, issueNumber: 37, weekOf: 'October 9, 2026', refreshedAt: 'x', headline: 'Sentient lags', image: null, houseImage: null });

  // A public request for a past issue reads the archive and still goes through publicIssue().
  const seen = [];
  globalThis.fetch = async (url) => {
    seen.push(String(url));
    if (String(url).includes('/auth/v1/user')) return { ok: true, json: async () => ({ id: 'u1', email: 'a@antennagroup.com', email_confirmed_at: 'x' }) };
    if (String(url).includes('compass_results')) return { ok: true, json: async () => [{ brand_name: 'Acme' }] };
    return { ok: true, json: async () => [{ newsletter: { issueNumber: 30, storyOpportunities: [{ headline: 'internal' }], landscapeAnalysis: { summary: 'Acme leads.\n\nBrands lag.' } }, refreshed_at: 'x' }] };
  };
  process.env.SUPABASE_URL = 'https://db'; process.env.SUPABASE_SERVICE_ROLE_KEY = 'k';
  const res = mockRes();
  await pub.default({ method: 'GET', query: { public: '1', issue: '3' }, headers: { authorization: 'Bearer t' } }, res);
  assert.equal(res.code, 200);
  assert.ok(seen.some(u => u.includes('stay_conscious_newsletter_archive?') && u.includes('id=eq.3')));
  assert.equal(res.body.newsletter.issueNumber, 30);
  assert.ok(!('storyOpportunities' in res.body.newsletter), 'internal sections stay out');
  assert.equal(res.body.newsletter.landscapeAnalysis.summary, 'Brands lag.', 'brand names stay out');
  assert.equal(res.body.archived, true);

  const { nextIssueAt } = await import('../src/lib/newsletter.js');
  // v4.7.0: issues publish on Monday at 12:00 UTC, after review
  assert.equal(nextIssueAt(new Date('2026-10-09T22:41:00Z')).toISOString(), '2026-10-12T12:00:00.000Z', 'Friday: this Monday, 12:00 UTC');
  assert.equal(nextIssueAt(new Date('2026-10-12T11:59:00Z')).toISOString(), '2026-10-12T12:00:00.000Z', 'Monday morning before it publishes: today');
  assert.equal(nextIssueAt(new Date('2026-10-12T12:30:00Z')).toISOString(), '2026-10-19T12:00:00.000Z', 'just after: next week');

  const sql = readFileSync(new URL('../docs/SUPABASE_SETUP.sql', import.meta.url), 'utf8');
  assert.ok(sql.includes('create table if not exists public.stay_conscious_newsletter_archive') && sql.includes('refreshed_at timestamptz not null unique'));
  assert.ok(sql.includes('alter table public.stay_conscious_newsletter_archive enable row level security;'));
});

test('v4.2.1: one Archive button opens past issues newest first, each with its lead image or house image, date and headline', async () => {
  const pub = await import('../api/stay-conscious-newsletter.js');
  assert.equal(pub.archiveListRow({ id: 1, image: 'https://cdn/x.jpg' }).image, 'https://cdn/x.jpg');
  assert.equal(pub.archiveListRow({ id: 1, image: 'javascript:alert(1)' }).image, null, 'https only');
  const src = readFileSync(new URL('stay-conscious-newsletter.js', API), 'utf8');
  assert.ok(src.includes('image:newsletter->leadStory->image->>src'));
  const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
  assert.ok(app.includes("{showArchive ? 'Back to issue' : 'Archive'}"), 'one button at the top');
  assert.ok(app.includes("localeCompare(String(x.refreshedAt || ''))"), 'newest first by publish date');
  assert.ok(app.includes('<ArchiveThumb image={p.image} issue={p} />'));
  assert.ok(!app.includes('data-field="past-issues"'), 'the list at the foot of the issue is gone');
});


test('v4.3.0: the newsletter is staff only: a confirmed antennagroup.com account, checked on the server', async () => {
  const auth = await import('../api/_auth.js');
  const ok = (u) => auth.isStaffUser(u);
  assert.equal(ok({ email: 'paul.newton@antennagroup.com', email_confirmed_at: 'x' }), true);
  assert.equal(ok({ email: 'Someone@AntennaGroup.com', confirmed_at: 'x' }), true, 'case does not matter');
  assert.equal(ok({ email: 'someone@antennagroup.com' }), false, 'an unconfirmed address is not enough');
  assert.equal(ok({ email: 'someone@gmail.com', email_confirmed_at: 'x' }), false);
  assert.equal(ok({ email: 'someone@antennagroup.com.evil.io', email_confirmed_at: 'x' }), false, 'look-alike domains fail');
  assert.equal(ok({ email: 'antennagroup.com@evil.io', email_confirmed_at: 'x' }), false);
  assert.equal(ok(null), false);

  process.env.SUPABASE_URL = 'https://db'; process.env.SUPABASE_SERVICE_ROLE_KEY = 'k';
  const pub = await import('../api/stay-conscious-newsletter.js');
  const reached = [];
  const run = async (user, headers) => {
    globalThis.fetch = async (url) => { reached.push(String(url)); return String(url).includes('/auth/v1/user') ? (user ? { ok: true, json: async () => user } : { ok: false, json: async () => ({}) }) : { ok: true, json: async () => [] }; };
    const res = { statusCode: 0, body: null, headers: {}, setHeader(k, v) { this.headers[k] = v; }, status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; } };
    await pub.default({ method: 'GET', query: { public: '1' }, headers }, res);
    return res;
  };
  reached.length = 0;
  const anon = await run(null, {});
  assert.equal(anon.statusCode, 401); assert.equal(anon.body.signIn, true);
  assert.ok(!reached.some(u => u.includes('stay_conscious_newsletter') || u.includes('compass_results')), 'nothing read for a stranger');
  const outsider = await run({ id: 'u2', email: 'x@gmail.com', email_confirmed_at: 'x' }, { authorization: 'Bearer t' });
  assert.equal(outsider.statusCode, 403); assert.equal(outsider.body.staffOnly, true);
  assert.equal(outsider.headers['Cache-Control'], 'private, no-store');
  const list = await (async () => {
    globalThis.fetch = async (url) => (String(url).includes('/auth/v1/user') ? { ok: false, json: async () => ({}) } : { ok: true, json: async () => [] });
    const res = { statusCode: 0, body: null, headers: {}, setHeader(k, v) { this.headers[k] = v; }, status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; } };
    await pub.default({ method: 'GET', query: { public: '1', archive: 'list' }, headers: {} }, res);
    return res;
  })();
  assert.equal(list.statusCode, 401, 'the archive is staff only too');

  const sb = readFileSync(new URL('../src/lib/supabase.js', import.meta.url), 'utf8');
  assert.ok(sb.includes("provider: 'google'") && sb.includes("hd: 'antennagroup.com'"));
  const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
  assert.ok(app.includes('data-field="staff-gate"') && app.includes("res.status === 401 ? 'signin' : res.status === 403 ? 'staff' : null"));
});

test('v4.3.1: staff sign in with their Compass email and password; the session is shared with the Compass and kept', async () => {
  const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
  assert.ok(app.includes('className="dc-np-gate-form" onSubmit={submitGate}'), 'an email and password form');
  assert.ok(app.includes("const { data, error: err } = await signIn(email, gateForm.password);"), 'the Compass sign-in, so the session is the same one');
  assert.ok(app.includes("if (!isStaffEmail(email)) { setGateError('Use your antennagroup.com email address.'); return; }"), 'other domains stop before any request');
  assert.ok(!app.includes('signInWithGoogleStaff('), 'no Google button until Google is set up');
  const sb = readFileSync(new URL('../src/lib/supabase.js', import.meta.url), 'utf8');
  assert.ok(!/persistSession:\s*false/.test(sb), 'sessions are kept in the browser (the Supabase default)');
});

test('v4.3.2: two ways in, Sign in for Compass users and registered staff, Register for staff without an account', async () => {
  const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
  assert.ok(app.includes("[['signin', 'Sign in'], ['signup', 'Register']]") && app.includes('role="tablist"'));
  assert.ok(app.includes('Compass users: sign in with your Compass email and password, no registration needed.'));
  assert.ok(app.includes('<strong>First time here and not a Compass user?</strong> You need to') && app.includes(">register</button> first."), 'first-time staff are told to register, with a link to the Register tab (v4.3.3)');
  assert.ok(app.includes('This account is for the newsletter only and does not open the Compass.'));
  assert.ok(app.includes("signUp(email, gateForm.password, gateForm.name.trim(), { newsletter_only: true }, `${window.location.origin}${NEWSLETTER_PUBLIC_PATH}`)"), 'registrations are marked newsletter only, and the confirmation link returns to the newsletter');
  assert.ok(app.includes('data.user.identities.length === 0'), 'an address that already has an account is sent to Sign in');
  const sb = readFileSync(new URL('../src/lib/supabase.js', import.meta.url), 'utf8');
  assert.ok(sb.includes('data: { full_name: fullName, ...extra }'));
});

test('v4.4.0: forgotten passwords, on the Compass sign-in and the newsletter', async () => {
  const sb = readFileSync(new URL('../src/lib/supabase.js', import.meta.url), 'utf8');
  assert.ok(sb.includes("supabase.auth.resetPasswordForEmail(String(email || '').trim(), { redirectTo })"), 'Supabase sends the reset email');
  assert.ok(sb.includes("supabase.auth.updateUser({ password })"), 'the new password is saved to the account');
  assert.ok(sb.indexOf("event === 'PASSWORD_RECOVERY'") > sb.indexOf('export const supabase = createClient('), 'the reset visit is heard as the client is created, before any page');
  assert.ok(sb.includes("new URLSearchParams(window.location.search).get(RESET_PARAM) === '1'") && sb.includes('type=recovery'), 'and the address is checked too');
  const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
  assert.ok(app.includes('Forgot password?'), 'the Compass sign-in offers it');
  assert.ok(app.includes('<ForgotPasswordForm landingPath="/" initialEmail={email}'), 'Compass links land on the Compass');
  assert.ok(app.includes('<ForgotPasswordForm landingPath={NEWSLETTER_PUBLIC_PATH} initialEmail={gateForm.email} staffOnly'), 'newsletter links land on the newsletter, staff addresses only');
  assert.ok(app.includes("if (recovering) {\n    return <RecoveryScreen"), 'back from a link, the Compass asks for a new password before anything else');
  assert.ok(app.indexOf('if (recovering) {\n    return <RecoveryScreen') < app.indexOf('// Show loading while checking auth'), 'even before the app opens');
  assert.ok(app.includes('If there is an account for <strong>'), 'the request never says whether an account exists');
  assert.ok(app.includes("if (pw.length < 8) { setError('Use at least 8 characters.'); return; }") && app.includes("if (pw !== again) { setError('The two passwords do not match.'); return; }"));
});

test('v4.4.0: the copy tells the Compass sign-in and the newsletter sign-in apart', async () => {
  const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
  assert.ok(app.includes("isLogin ? 'For Conscious Compass users' : 'Request access to the Conscious Compass'"), 'the Compass sign-in says who it is for');
  assert.ok(app.includes('Looking for the Stay Conscious newsletter? Any Antenna Group colleague can read it.'), 'and points staff to the newsletter');
  assert.ok(app.includes('Only want the Stay Conscious newsletter?') && app.includes('Register on the newsletter page</a> instead. No approval is needed.'), 'Compass sign-up says the newsletter needs no approval');
  assert.ok(app.includes('Everyone else: sign in with the account you registered for the newsletter.'));
  assert.ok(app.includes('Compass users do not need to register.'));
  assert.ok(app.includes('If you also use the Conscious Compass, this is your Compass password too.'), 'a newsletter reset says it changes the Compass password as well');
  assert.ok(app.includes('audience="newsletter"'));
});

test('v4.5.0: stories do not repeat earlier issues unless they have moved on, and then they say so and link back', async () => {
  const sc = await import('../api/refresh-stay-conscious.js');
  // Repeat detection
  assert.ok(sc.headlineOverlap('Third-Party Mentions Now Outrank Your Own Site With AI Engines', 'Third-party mentions outrank owned sites in AI engines') >= sc.REPEAT_THRESHOLD);
  assert.ok(sc.headlineOverlap('API Errors Are the New Broken Window for Brand Experience', 'Monolithic Brand Voice Is Breaking Across Platform Contexts') < sc.REPEAT_THRESHOLD);
  // History from the live issue and archived editions, newest first, one entry per headline
  const editions = [
    { issueNumber: 37, editionAt: '2026-10-11T23:30:00Z', lead: { headline: 'Third-Party Mentions Now Outrank Your Own Site With AI Engines', category: 'AI Visibility', insight: 'Off-site signals now predict citation. More follows.' }, items: [{ headline: 'API Errors Are the New Broken Window', category: 'Digital Experience', insight: 'Errors rose.' }] },
    { issueNumber: 36, editionAt: '2026-10-04T23:30:00Z', lead: { headline: 'API Errors Are the New Broken Window', insight: 'dup' }, items: [] },
  ];
  const past = sc.pastStories(editions);
  assert.deepEqual(past.map(p => [p.ref, p.issueNumber]), [['P1', 37], ['P2', 37]], 'the same headline counts once');
  assert.equal(past[0].gist, 'Off-site signals now predict citation.');
  const block = sc.historyPromptBlock(past);
  assert.ok(block.includes('- P1 | Issue 37 | Third-Party Mentions Now Outrank Your Own Site With AI Engines'));
  assert.ok(block.includes('Do not repeat any of these.') && block.includes('"followUp":{"ref":"P3","whatsNew"') && block.includes('Never present a past story as new.'));
  assert.equal(sc.historyPromptBlock([]), '', 'no history, no block');

  // A real follow-up is kept and resolved; an unmarked repeat is caught; a bad ref is dropped
  const { items, repeats } = sc.checkAgainstHistory([
    { headline: 'Third-party mentions outrank owned sites in AI engines', category: 'AI Visibility' },
    { headline: 'AI Engines Now Weigh Reddit Above Press', category: 'AI Visibility', followUp: { ref: 'P1', whatsNew: 'New data from Muck Rack.' } },
    { headline: 'A Brand New Story About Packaging', category: 'Brand Strategy', followUp: { ref: 'P99', whatsNew: 'x' } },
  ], past);
  assert.deepEqual(repeats.map(r => [r.i, r.match.ref]), [[0, 'P1']]);
  assert.deepEqual(items[1].followUp, { issueNumber: 37, editionAt: '2026-10-11T23:30:00Z', headline: 'Third-Party Mentions Now Outrank Your Own Site With AI Engines', whatsNew: 'New data from Muck Rack.' });
  assert.ok(!('followUp' in items[2]), 'a follow-up to a story we never ran is dropped');

  // The job: an unmarked repeat is replaced once, in its category
  process.env.ANTHROPIC_API_KEY = 'k'; process.env.SUPABASE_URL = 'https://db'; process.env.SUPABASE_SERVICE_ROLE_KEY = 's'; process.env.CRON_SECRET = 'cron';
  const prompts = []; const saved = {}; const checks = [];
  // v4.10.0: each story cites a page the search returned, and is fact-checked against it.
  const SRC = 'https://adweek.com/story';
  const QUOTE = 'Packaging claims face new scrutiny from regulators across Europe this autumn, the report says';
  const reply = (its) => ({ ok: true, json: async () => ({ content: [
    { type: 'web_search_tool_result', content: [{ type: 'web_search_result', url: SRC, title: 'Story' }] },
    { type: 'text', text: JSON.stringify({ items: its.map(it => ({ ...it, sources: [{ url: SRC, outlet: 'Adweek', title: 'Story' }] })) }) }] }) });
  globalThis.fetch = async (url, init = {}) => {
    const u = String(url);
    if (u === SRC) return { ok: true, text: async () => `<p>${QUOTE}. ${'More reporting follows here. '.repeat(30)}</p>` };
    if (u.includes('api.anthropic.com')) {
      const content = JSON.parse(init.body).messages[0].content;
      if (content.startsWith('You are the fact checker')) {
        checks.push(content);
        const n = (content.match(/^\d+\. \[/gm) || []).length;
        return { ok: true, json: async () => ({ content: [{ type: 'text', text: JSON.stringify({ verdicts: Array.from({ length: n }, (_, i) => ({ n: i + 1, verdict: 'supported', quote: QUOTE })) }) }] }) };
      }
      prompts.push(content);
      return prompts.length === 1
        ? reply([{ headline: 'Third-party mentions outrank owned sites in AI engines', category: 'AI Visibility', insight: 'i', whyItMatters: 'w' }, { headline: 'Packaging Claims Face New Scrutiny', category: 'Brand Strategy', insight: 'i', whyItMatters: 'w' }])
        : reply([{ headline: 'Answer Engines Start Citing Podcasts', category: 'AI Visibility', insight: 'i', whyItMatters: 'w' }]);
    }
    if (u.includes('stay_conscious_newsletter_archive')) return { ok: true, json: async () => [{ refreshed_at: '2026-10-04T23:30:00Z', issue_number: 36, lead: { headline: 'Old Archived Story About Carbon Labels' }, items: [] }] };
    if (u.includes('stay_conscious_newsletter?')) return { ok: true, json: async () => [{ refreshed_at: editions[0].editionAt, issue_number: 37, lead: editions[0].lead, items: editions[0].items }] };
    if (u.includes('stay_conscious_cache')) { const b = JSON.parse(init.body); saved[b.id] = b; return { ok: true, json: async () => ({}) }; }
    return { ok: true, json: async () => [] };
  };
  const res = mockRes();
  await sc.default({ method: 'GET', headers: { authorization: 'Bearer cron' }, query: {} }, res);
  delete process.env.CRON_SECRET;
  assert.equal(res.code, 200, JSON.stringify(res.body));
  assert.ok(prompts[0].includes('ALREADY COVERED') && prompts[0].includes('Old Archived Story About Carbon Labels'), 'the brief lists the live issue and the archive');
  assert.ok(prompts[1].includes('Write exactly 1 replacement item(s), for these categories: AI Visibility') && prompts[1].includes('(same as P1)'));
  assert.deepEqual(saved[1].items.map(i => i.headline), ['Packaging Claims Face New Scrutiny', 'Answer Engines Start Citing Podcasts']);
  assert.ok(saved[1].items.every(i => i.checked === true), 'v4.10.0: every saved story was fact-checked');
  assert.equal(checks.length, 2, 'one check per story');
  assert.ok(prompts[2].includes('WIDER SEARCH') && prompts[2].includes('Write exactly 4 more item(s)'), 'fewer than six passed, so a wider search ran');
  assert.deepEqual([saved[2].items[0].passed, saved[2].refreshed_at === saved[1].refreshed_at], [2, true], 'the report sits beside the stories, with their timestamp');
  assert.deepEqual(res.body.history, { pastStories: 3, followUps: 0, repeatsReplaced: 1, repeatsDropped: 0 });

  // The newsletter: a fresh story leads; follow-ups survive the public filter
  const nlSrc = readFileSync(new URL('refresh-stay-conscious-newsletter.js', API), 'utf8');
  assert.ok(nlSrc.includes('const fresh = items.filter(i => !i.followUp);') && nlSrc.includes('...(leadItem.followUp ? { followUp: leadItem.followUp } : {})'));
  assert.ok(nlSrc.includes('fetchEarnedCreative(anthropicKey, { featured: await recentlyFeaturedBrands(prevRow) })'), 'earned creative skips recently featured brands');
  const pub = await import('../api/stay-conscious-newsletter.js');
  const out = pub.publicIssue({ leadStory: { headline: 'h', insight: 'i', followUp: { issueNumber: 37, editionAt: '2026-10-11T23:30:00Z', headline: 'Earlier', whatsNew: 'New data.', secret: 'x' } } }, []);
  assert.deepEqual(out.leadStory.followUp, { issueNumber: 37, headline: 'Earlier', whatsNew: 'New data.', editionAt: '2026-10-11T23:30:00Z' });
  const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
  assert.ok(app.includes('{followUpNote(ns.leadStory?.followUp)}') && app.includes('{followUpNote(item.followUp)}'));
  assert.ok(app.includes('onClick={() => openIssue(id)}>{label}</button>'), 'the earlier edition opens from the note');
  assert.ok(app.includes('...followUpDocx(ns.leadStory?.followUp)') && app.includes('followUpText(ns.leadStory.followUp)'), 'Word and plain-text exports carry it too');
});

test('v4.6.0: Prospect pulse (this month, figures only) and Spotlight (one thing to lift the weakest attribute)', async () => {
  const nl = await import('../api/refresh-stay-conscious-newsletter.js');
  const ids = ['AWAKE', 'AWARE', 'REFLECTIVE', 'ATTENTIVE', 'COGENT', 'SENTIENT', 'VISIONARY', 'INTENTIONAL'];
  const teaser = (industry, sentient, overall) => ({ industry, brand_name: 'SECRET PROSPECT', result: { overall, scores: Object.fromEntries(ids.map(id => [id, { score: id === 'SENTIENT' ? sentient : id === 'ATTENTIVE' ? 70 : 55 }])) } });
  const full = (sentient, total) => ({ brand_name: 'x', total_score: total, scores: Object.fromEntries(ids.map(id => [id, id === 'SENTIENT' ? sentient : id === 'VISIONARY' ? 40 : 60])) });
  const now = new Date('2026-10-22T14:00:00Z');
  assert.equal(nl.monthStart(now), '2026-10-01T00:00:00.000Z');
  assert.equal(nl.prospectPulse([teaser('energy', 30, 50), teaser('energy', 40, 52)], [], now), null, 'fewer than three teasers: no pulse');
  const pulse = nl.prospectPulse([teaser('energy', 30, 50), teaser('energy', 40, 52), teaser('realestate', 35, 54), { industry: 'energy', result: null }], [full(45, 60), full(49, 62)], now);
  assert.deepEqual(pulse, {
    month: 'October', count: 3,
    sectors: [{ name: 'Energy & Utilities', count: 2 }, { name: 'Real Estate & Construction', count: 1 }],
    averageScore: 52, fullAverage: 61,
    weakest: { id: 'SENTIENT', name: 'Sentient', avg: 35, fullAvg: 47 },
    strongest: { id: 'ATTENTIVE', name: 'Attentive', avg: 70, fullAvg: 60 },
  });
  assert.ok(!JSON.stringify(pulse).includes('SECRET PROSPECT'), 'no prospect is named');

  // Spotlight: weakest across full assessments, moving on from recent ones
  const fullRows = [full(45, 60), full(49, 62), full(52, 61)];
  assert.equal(nl.pickSpotlightAttribute(fullRows, []).attribute.id, 'VISIONARY');
  assert.equal(nl.pickSpotlightAttribute([], []), null, 'no full assessments, no spotlight: teasers never stand in');
  const next = nl.pickSpotlightAttribute(fullRows, ['VISIONARY']);
  assert.equal(next.attribute.id, 'SENTIENT', 'last issue spotlighted Visionary, so the next weakest');
  assert.deepEqual(next.figures, { avg: 49, brands: 3, belowFifty: 2 });
  const prompt = nl.spotlightPrompt(next);
  assert.ok(prompt.includes('This week\'s attribute: Sentient (Emotional Resonance & Creative Distinction)') && prompt.includes('Strong signals: Distinctive creative identity'));
  assert.ok(prompt.includes('Across 3 brands we have assessed, Sentient averages 49, and 2 score below 50.') && prompt.includes('Name no brand or company.'));
  const sp = nl.parseSpotlight('Here: {"headline":"Tell one human story","action":"Pick one customer and tell their story — properly.","why":"People feel it.","steps":["a","b","c","d"]}', next);
  assert.equal(sp.action, 'Pick one customer and tell their story, properly.', 'no em dashes');
  assert.deepEqual([sp.attribute, sp.name, sp.steps.length], ['SENTIENT', 'Sentient', 3]);
  assert.equal(nl.parseSpotlight('no json', next), null);

  const src = readFileSync(new URL('refresh-stay-conscious-newsletter.js', API), 'utf8');
  assert.ok(src.includes('teaser_assessments?select=industry,created_at,result&created_at=gte.'), 'this month\'s teasers only, without brand names');
  assert.ok(src.includes('...(await buildPulseAndSpotlight(prevRow))'));

  const pub = await import('../api/stay-conscious-newsletter.js');
  const out = pub.publicIssue({ prospectPulse: { ...pulse, extra: 'x' }, spotlight: { ...sp, secret: 'y' } }, []);
  assert.deepEqual(Object.keys(out.prospectPulse).sort(), ['averageScore', 'count', 'fullAverage', 'month', 'sectors', 'strongest', 'weakest']);
  assert.equal(out.spotlight.headline, 'Tell one human story');
  assert.ok(!('secret' in out.spotlight));
  const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
  assert.ok(app.includes('data-field="spotlight"') && app.includes('data-field="prospect-pulse"'));
  assert.ok(app.indexOf('data-field="spotlight"') < app.indexOf('data-field="prospect-pulse"') && app.indexOf('data-field="prospect-pulse"') < app.indexOf('data-field="earned-creative-news"'), 'after Brand intelligence, before earned creative');
  const pulseBlock = app.slice(app.indexOf('data-field="prospect-pulse"'), app.indexOf('data-field="earned-creative-news"'));
  assert.ok(!/earned creative|HOWL/i.test(pulseBlock), 'no earned creative in the teaser block');
});

test('v4.6.0: Landscape insights change week to week: recent sections, what moved, a rotating focus, and a second draft if it still repeats', async () => {
  const nl = await import('../api/refresh-stay-conscious-newsletter.js');
  // A different focus each issue, cycling through all six
  const lenses = [1, 2, 3, 4, 5, 6, 7].map(nl.landscapeLens);
  assert.equal(new Set(lenses.slice(0, 6)).size, 6);
  assert.equal(lenses[6], lenses[0]);
  // What moved, from the scores
  const ids = ['AWAKE', 'AWARE', 'REFLECTIVE', 'ATTENTIVE', 'COGENT', 'SENTIENT', 'VISIONARY', 'INTENTIONAL'];
  const row = (s, t) => ({ total_score: t, scores: Object.fromEntries(ids.map(id => [id, id === 'SENTIENT' ? s : 60])) });
  const prev = nl.landscapeSnapshot([row(40, 50), row(44, 52)]);
  const now = nl.landscapeSnapshot([row(40, 50), row(44, 52), row(52, 60)]);
  assert.deepEqual(nl.landscapeChanges(now, prev), ['Brands assessed: 2 last week, 3 now.', 'Average score: 51 last week, 54 now.', 'Sentient average: 42 last week, 45 now.']);
  assert.deepEqual(nl.landscapeChanges(now, null), [], 'first week: nothing to compare');
  // The prompt carries the history, the changes and the focus; the analysis stays last
  const recent = [{ headline: 'Brands built the infrastructure but skipped the conviction', summary: 'Most brands have the basics.' }];
  const p = nl.landscapePrompt('ANALYSIS TEXT', { recent, lens: nl.landscapeLens(2), changes: ['Brands assessed: 51 last week, 54 now.'] });
  assert.ok(p.includes('RECENT LANDSCAPE SECTIONS') && p.includes('HEADLINE: Brands built the infrastructure but skipped the conviction'));
  assert.ok(p.includes('- Brands assessed: 51 last week, 54 now.') && p.includes('THIS WEEK\'S FOCUS for paragraph 2: Sector contrast'));
  assert.ok(p.endsWith('ANALYSIS TEXT'));
  assert.ok(nl.landscapePrompt('A', { changes: [] }).includes('Nothing material changed in the figures since last week'));
  assert.ok(nl.landscapePrompt('A', { retry: true }).includes('Your last draft was too close to a recent section.'));
  // The repeat check
  assert.equal(nl.tooSimilarLandscape({ headline: 'Brands built the infrastructure but skipped conviction', summary: 'x' }, recent), true, 'same headline');
  assert.equal(nl.tooSimilarLandscape({ headline: 'Energy brands lead on purpose', summary: 'Most brands have the basics.' }, recent), true, 'same paragraph');
  assert.equal(nl.tooSimilarLandscape({ headline: 'Energy brands lead on purpose but go quiet', summary: 'Energy and utilities sit eight points above the rest on Visionary.' }, recent), false);
  const src = readFileSync(new URL('refresh-stay-conscious-newsletter.js', API), 'utf8');
  assert.ok(src.includes('if (draft && tooSimilarLandscape(draft, recent)) draft = (await write(true)) || draft;'), 'rewritten once if still too close');
  assert.ok(src.includes('snapshot, lens,'), 'this week\'s figures are kept for next week');
  const pub = await import('../api/stay-conscious-newsletter.js');
  const out = pub.publicIssue({ landscapeAnalysis: { headline: 'h', summary: 's', snapshot: { brandCount: 3 }, lens: 'x' } }, []);
  assert.ok(!('snapshot' in out.landscapeAnalysis) && !('lens' in out.landscapeAnalysis), 'internal fields stay internal');
});

test('v4.7.0: sources, talking point, draft and review, Monday publish, and the team channel post', async () => {
  // Sources must be pages the search returned
  const sc = await import('../api/refresh-stay-conscious.js');
  const content = [{ type: 'web_search_tool_result', content: [{ type: 'web_search_result', url: 'https://www.adweek.com/real-page/', title: 'Real page title' }] }];
  const withSrc = sc.attachSources([{ headline: 'A', sources: [{ url: 'https://adweek.com/real-page', outlet: '' }, { url: 'https://made-up.example.com/x', outlet: 'Fake' }] }, { headline: 'B' }], content);
  assert.deepEqual(withSrc[0].sources, [{ url: 'https://adweek.com/real-page', title: 'Real page title', outlet: 'adweek.com' }], 'invented links are dropped; outlet falls back to the host');
  assert.deepEqual(withSrc[1].sources, []);
  const four = [1, 2, 3, 4].map(i => ({ headline: `S${i}`, sources: [{ url: 'u' }] }));
  assert.deepEqual(sc.keepSourced([...four, { headline: 'none', sources: [] }]).items.map(i => i.headline), ['S1', 'S2', 'S3', 'S4'], 'unsourced stories go');
  assert.deepEqual(sc.keepSourced([four[0], { headline: 'none', sources: [] }]), { items: [four[0]], dropped: 1 }, 'v4.10.0: unsourced stories always go');
  assert.ok(sc.STAY_CONSCIOUS_PROMPT.includes('never invent or reconstruct a link'));

  // Talking point
  const nl = await import('../api/refresh-stay-conscious-newsletter.js');
  const stories = [{ category: 'AI Visibility', headline: 'AI cites journalism', insight: 'Half of citations.' }];
  assert.ok(nl.talkingPointPrompt(stories).includes('1. [AI Visibility] AI cites journalism'));
  assert.deepEqual(nl.parseTalkingPoint('{"topic":"AI search.","point":"Earned coverage — not ads — feeds AI answers.","story":"AI cites journalism"}', stories),
    { topic: 'AI search', point: 'Earned coverage, not ads, feeds AI answers.', story: 'AI cites journalism' });
  assert.equal(nl.parseTalkingPoint('{"topic":"x","point":"y","story":"invented"}', stories).story, '', 'a story we did not run is not named');

  // Draft edits: only the listed text, and stories can be removed
  const draft = { leadStory: { headline: 'H', insight: 'I', sources: [{ url: 'https://a' }] }, intelligenceItems: [{ headline: 'A' }, { headline: 'B' }], talkingPoint: { topic: 't', point: 'p' } };
  const edited = nl.applyDraftEdits(draft, [
    { path: 'leadStory.headline', value: 'New — headline' }, { path: 'leadStory.sources', value: 'x' }, { path: 'issueNumber', value: '99' },
    { path: 'intelligenceItems.0', value: null }, { path: 'talkingPoint.point', value: 'q' }, { path: '__proto__.polluted', value: 'x' },
  ]);
  assert.equal(edited.leadStory.headline, 'New, headline');
  assert.deepEqual(edited.leadStory.sources, [{ url: 'https://a' }], 'sources cannot be edited');
  assert.equal(edited.issueNumber, undefined);
  assert.deepEqual(edited.intelligenceItems.map(i => i.headline), ['B']);
  assert.equal(edited.talkingPoint.point, 'q');
  assert.equal({}.polluted, undefined);
  assert.equal(draft.leadStory.headline, 'H', 'the original is untouched');

  // Channel posts: Slack text, or a Teams card
  // v4.7.2: laid out like the issue, with the issue's own picture
  const note = nl.publishedNote({ issueNumber: 38, weekOf: 'October 25, 2026', leadStory: { category: 'AI Visibility', headline: 'Lead', insight: 'First sentence. Second sentence.' }, talkingPoint: { topic: 'AI search', point: 'Say this.' } });
  assert.deepEqual(note.image, { url: 'https://conscious-compass.vercel.app/newsletter/house-6.jpg', alt: 'Stay Conscious' }, 'the same house photo as the page: issue 38 is the sixth');
  assert.equal(nl.issueImage({ issueNumber: 38, leadStory: { image: { src: 'https://cdn.example.com/lead.jpg', alt: 'A' } } }).url, 'https://cdn.example.com/lead.jpg', 'a lead story image wins');
  const teams = nl.channelPayload('https://default93.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/x/triggers/manual/paths/invoke?api-version=1&sig=s', note);
  const card = teams.attachments[0].content;
  assert.equal(teams.attachments[0].contentType, 'application/vnd.microsoft.card.adaptive');
  assert.equal(teams.summary, 'Stay Conscious, Issue 38 is out', 'the notification preview');
  assert.deepEqual(card.msteams, { width: 'Full' });
  // v4.7.5: sized as a share of the card, so nothing is cut off on a phone
  const imgIn = (b) => b.columns[0].items[0];
  assert.deepEqual([card.body[0].type, imgIn(card.body[0]).url, imgIn(card.body[0]).size, card.body[0].columns.map(c => c.width)], ['ColumnSet', 'https://conscious-compass.vercel.app/fully-conscious-badge.png', 'Stretch', [1, 4]], 'the badge, a fifth of the card wide');
  assert.deepEqual([imgIn(card.body[1]).url, imgIn(card.body[1]).altText, card.body[1].columns.map(c => c.width)], ['https://conscious-compass.vercel.app/newsletter/stay-conscious-wordmark.png', 'Stay Conscious', [2, 1]], 'the wordmark, two thirds of the card wide');
  assert.ok(!JSON.stringify(card).match(/"width":"\d+px"/), 'no fixed pixel widths');
  assert.equal(card.body[2].text, 'ISSUE 38  ·  WEEK OF OCTOBER 25, 2026');
  assert.equal(nl.channelPayload('https://x.example.com/hook', { ...note, mastheadImage: null }).attachments[0].content.body[1].text, 'Stay Conscious', 'text masthead without the image');
  assert.deepEqual([card.body[3].backgroundImage, card.body[3].minHeight], [{ url: 'https://conscious-compass.vercel.app/newsletter/house-6.jpg', fillMode: 'Cover', horizontalAlignment: 'Center', verticalAlignment: 'Center' }, '190px'], 'the photo as a cropped band, as on the page');
  const sec = card.body.filter(b => b.type === 'Container' && !b.backgroundImage).map(c => c.items.map(i => i.text));
  assert.deepEqual(sec, [['AI VISIBILITY · LEAD STORY', 'Lead', 'First sentence.'], ['TALKING POINT OF THE WEEK', 'If a client asks about AI search', 'Say this.']]);
  assert.ok(card.body.filter(b => b.type === 'Container' && !b.backgroundImage).every(c => c.separator && c.items[0].color === 'Attention'), 'rules between sections, red labels');
  assert.deepEqual(card.actions, [{ type: 'Action.OpenUrl', title: 'Read the issue', url: 'https://conscious-compass.vercel.app/newsletter' },
    { type: 'Action.OpenUrl', title: 'Past issues', url: 'https://conscious-compass.vercel.app/newsletter?view=archive' }], 'and a way into the archive (v4.7.3)');
  const slack = nl.channelPayload('https://hooks.slack.com/services/x', note);
  assert.deepEqual(slack.blocks.map(b => b.type), ['image', 'header', 'context', 'image', 'divider', 'section', 'divider', 'section', 'actions']);
  assert.ok(slack.text.startsWith('*Stay Conscious, Issue 38 is out*'), 'plain fallback text for notifications');
  assert.deepEqual(slack.blocks.at(-1).elements.map(e => e.text.text), ['Read the issue', 'Past issues']);
  assert.equal(await nl.postToChannel('', note), null, 'no webhook set: nothing posted');

  // The job end to end with a fake database: Sunday writes a draft; Monday publishes, archives, posts
  process.env.ANTHROPIC_API_KEY = 'k'; process.env.SUPABASE_URL = 'https://db'; process.env.SUPABASE_SERVICE_ROLE_KEY = 's'; process.env.CRON_SECRET = 'cron';
  process.env.NEWSLETTER_WEBHOOK_URL = 'https://hooks.slack.com/services/T/B/x';
  const rows = { 1: { id: 1, newsletter: { issueNumber: 37, leadStory: { headline: 'Old' } }, refreshed_at: '2026-10-12T12:00:00Z' } };
  const calls = [];
  globalThis.fetch = async (url, init = {}) => {
    const u = String(url); const m = init.method || 'GET'; calls.push(`${m} ${u}`);
    const idm = /id=eq\.(\d)/.exec(u);
    if (u.includes('/rest/v1/stay_conscious_newsletter?') || u.endsWith('/rest/v1/stay_conscious_newsletter')) {
      if (m === 'GET') return { ok: true, json: async () => (idm && rows[idm[1]] ? [rows[idm[1]]] : []) };
      if (m === 'POST') { const b = JSON.parse(init.body); rows[b.id] = b; return { ok: true, json: async () => ({}) }; }
      if (m === 'DELETE') { delete rows[idm[1]]; return { ok: true }; }
    }
    if (u.includes('stay_conscious_newsletter_archive')) return { ok: true, json: async () => [] };
    if (u.includes('hooks.slack.com')) return { ok: true, json: async () => ({}) };
    return { ok: false, status: 404, json: async () => ({}) };
  };
  const cron = (q) => ({ method: 'GET', headers: { authorization: 'Bearer cron' }, query: q });
  // No draft yet: Monday publishes nothing
  let res = mockRes(); await nl.default(cron({ action: 'publish' }), res);
  assert.equal(res.body.published, false);
  // A held weekly draft is skipped by the schedule
  rows[2] = { id: 2, newsletter: { issueNumber: 38, houseImage: '/newsletter/house-15.jpg', leadStory: { headline: 'New' }, _draft: { weekly: true, held: true } }, refreshed_at: '2026-10-18T23:30:00Z' };
  res = mockRes(); await nl.default(cron({ action: 'publish' }), res);
  assert.deepEqual([res.body.published, res.body.reason, rows[1].newsletter.issueNumber], [false, 'The draft is held.', 37]);
  // The schedule cannot hold, edit or discard
  res = mockRes(); await nl.default(cron({ action: 'discard' }), res);
  assert.equal(res.code, 403);
  // Released: Monday publishes it, archives the old issue, clears the draft and posts
  rows[2].newsletter._draft.held = false;
  calls.length = 0;
  res = mockRes(); await nl.default(cron({ action: 'publish' }), res);
  assert.deepEqual([res.body.published, res.body.issueNumber, res.body.posted], [true, 38, true]);
  assert.equal(rows[1].newsletter.leadStory.headline, 'New');
  assert.ok(!('_draft' in rows[1].newsletter), 'review notes never reach readers');
  assert.equal(rows[1].newsletter.houseImage, '/newsletter/house-15.jpg', 'the draft\'s house image is published with it (v4.9.0)');
  assert.equal(rows[2], undefined, 'the draft is cleared');
  assert.ok(calls.some(c => c.startsWith('POST https://db/rest/v1/stay_conscious_newsletter_archive')), 'the replaced issue was archived');
  assert.ok(calls.findIndex(c => c.includes('_archive')) < calls.findIndex(c => c === 'POST https://db/rest/v1/stay_conscious_newsletter'), 'archived before it was overwritten');
  delete process.env.CRON_SECRET; delete process.env.NEWSLETTER_WEBHOOK_URL;

  const src = readFileSync(new URL('refresh-stay-conscious-newsletter.js', API), 'utf8');
  assert.ok(src.includes('await writeIssueRow(DRAFT_ID, { ...withoutDashes(newsletter), _draft: { weekly,'), 'the Sunday run writes a draft, not the live issue');
  assert.ok(src.includes('const issueNumber = weekly || !prevIssue ? prevIssue + 1 : prevIssue;'), 'a mid-week revision keeps its number');
  const vercel = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
  assert.ok(vercel.crons.some(c => c.path === '/api/refresh-stay-conscious-newsletter?action=publish' && c.schedule === '0 12 * * 1'), 'Monday 12:00 UTC');
  // Readers only ever get the live row
  const read = readFileSync(new URL('stay-conscious-newsletter.js', API), 'utf8');
  assert.ok(read.includes('stay_conscious_newsletter?select=newsletter,refreshed_at&id=eq.1&limit=1'));
  assert.ok(read.includes("if (!(await isAdmin(user.id))) return res.status(403).json({ error: 'Admins only.' });"), 'the draft is for admins only');
  assert.ok(readFileSync(new URL('refresh-stay-conscious.js', API), 'utf8').includes('&id=eq.1&limit=1`),   // the live issue, never a draft'));
});

test('v4.8.0: the brief covers conscious marketing for leaders, and the lead rotates by significance', async () => {
  const sc = await import('../api/refresh-stay-conscious.js');
  const p = sc.STAY_CONSCIOUS_PROMPT;
  for (const c of ['Earned Creative', 'Media Relations', 'Paid Media', 'Social & Influencer', 'Measurement & Attribution', 'Purpose & Sustainability', 'B2B & B2C', 'Agency & Industry', 'Trust & Reputation'])
    assert.ok(sc.STORY_CATEGORIES.includes(c) && p.includes(c), c);
  assert.ok(/At most one story about AI/.test(p) && /HOWL/.test(p) && /chief sustainability officers/.test(p) && /order of significance/.test(p));
  for (const s of ['climate tech', 'placemaking and real estate', 'data centers', 'OEMs']) assert.ok(p.includes(s), s);
  assert.ok(!/brand assessors/.test(p) && !/—/.test(p), 'not for assessors; no em dashes');

  const { pickLead } = await import('../api/refresh-stay-conscious-newsletter.js');
  const items = [
    { headline: 'A', category: 'AI & Search', followUp: { issueNumber: 3 } },
    { headline: 'B', category: 'AI & Search' },
    { headline: 'C', category: 'Paid Media' },
    { headline: 'D', category: 'Earned Creative' },
  ];
  assert.equal(pickLead(items, []).headline, 'B', 'most significant fresh story');
  assert.equal(pickLead(items, ['ai & search']).headline, 'C', 'skips a topic that led recently');
  assert.equal(pickLead(items, ['AI & Search', 'Paid Media', 'Earned Creative']).headline, 'B', 'falls back to the first fresh story');
  assert.equal(pickLead([items[0]], []).headline, 'A');
  const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
  assert.ok(!app.includes('STAY_CONSCIOUS_CATEGORIES') && !app.includes('CATEGORY_META'), 'the unused copy in the app is gone');
});

test('each issue keeps the house image it was drafted with (v4.9.0)', async () => {
  const lib = await import('../src/lib/newsletter.js');
  const nl = await import('../api/refresh-stay-conscious-newsletter.js');
  const pub = await import('../api/stay-conscious-newsletter.js');
  assert.equal(lib.NEWSLETTER_HOUSE_IMAGES.length, 23);
  // Issues from before v4.9.0 saved no image: the eight-image rotation they went out with
  for (const [n, want] of [[1, 1], [8, 8], [9, 1], [38, 6], [44, 4], [undefined, 1]]) assert.equal(lib.houseImageFor({ issueNumber: n }).src, `/newsletter/house-${want}.jpg`, `issue ${n}`);
  // A saved image wins, but only a listed one
  assert.equal(lib.houseImageFor({ issueNumber: 38, houseImage: '/newsletter/house-20.jpg' }).src, '/newsletter/house-20.jpg');
  assert.equal(lib.houseImageFor({ issueNumber: 38, houseImage: 'https://evil.example.com/x.jpg' }).src, '/newsletter/house-6.jpg');
  assert.equal(lib.houseImageFor({ issueNumber: 38, houseImage: '/newsletter/../secret.jpg' }).src, '/newsletter/house-6.jpg');
  // A new issue takes the next image by number across all 23, wrapping after 23
  for (const [n, want] of [[45, 22], [46, 23], [47, 1], [23, 23], [24, 1]]) assert.equal(lib.houseImageForDraft(n, []), `/newsletter/house-${want}.jpg`, `new issue ${n}`);
  // A redraft of a waiting draft keeps its image; a revision of the live issue keeps the live image
  assert.equal(lib.houseImageForDraft(45, [{ issueNumber: 45, houseImage: '/newsletter/house-3.jpg' }, { issueNumber: 44 }]), '/newsletter/house-3.jpg');
  assert.equal(lib.houseImageForDraft(44, [null, { issueNumber: 44 }]), '/newsletter/house-4.jpg', 'a pre-v4.9.0 live issue revised mid-week keeps its old image');
  assert.equal(lib.houseImageForDraft(45, [null, { issueNumber: 44 }]), '/newsletter/house-22.jpg', 'the next week is a new issue');
  // The draft saves it, from the waiting draft and the live issue
  const src = readFileSync(new URL('refresh-stay-conscious-newsletter.js', API), 'utf8');
  assert.ok(src.includes('houseImage: houseImageForDraft(issueNumber, [waiting?.newsletter, prevRow?.newsletter]),'));
  assert.ok(src.indexOf('const waiting = await readIssueRow(DRAFT_ID);') < src.indexOf('houseImage: houseImageForDraft('), 'the waiting draft is read first');
  // The Teams card shows the same saved image as the page
  assert.equal(nl.issueImage({ issueNumber: 45, houseImage: '/newsletter/house-22.jpg' }).url, 'https://conscious-compass.vercel.app/newsletter/house-22.jpg');
  assert.equal(nl.issueImage({ issueNumber: 38 }).url, 'https://conscious-compass.vercel.app/newsletter/house-6.jpg');
  // Readers and the archive list get it, only when it is a listed image
  assert.equal(pub.publicIssue({ issueNumber: 45, houseImage: '/newsletter/house-22.jpg' }, []).houseImage, '/newsletter/house-22.jpg');
  assert.equal(pub.publicIssue({ issueNumber: 45, houseImage: 'javascript:alert(1)' }, []).houseImage, null);
  assert.equal(pub.publicIssue({ issueNumber: 30 }, []).houseImage, null);
  assert.equal(pub.archiveListRow({ id: 9, issue_number: 45, house: '/newsletter/house-22.jpg' }).houseImage, '/newsletter/house-22.jpg');
  assert.equal(pub.archiveListRow({ id: 9, issue_number: 45, house: '/x.jpg' }).houseImage, null);
});

test('no em dashes anywhere in the newsletter, past issues included (v4.9.0)', async () => {
  const { noDashes, withoutDashes } = await import('../src/lib/newsletter.js');
  const cases = [
    ['Brands win \u2014 and fast.', 'Brands win, and fast.'],
    ['The brand \u2014 a leader \u2014 said so.', 'The brand, a leader, said so.'],
    ['Word\u2014word', 'Word, word'],
    ['Ends with one \u2014', 'Ends with one'],
    ['Line one \u2014\nLine two', 'Line one\nLine two'],
    ['\u2014 Starts with one', 'Starts with one'],
    ['Why\u2014? Because', 'Why? Because'],
    ['A spaced \u2013 en dash', 'A spaced, en dash'],
    ['A range 2019\u20132024 stays', 'A range 2019\u20132024 stays'],
    ['STAY  |  Issue', 'STAY  |  Issue'],
    ['First.\n\n\u2014 Second.', 'First.\n\nSecond.'],
  ];
  for (const [input, want] of cases) assert.equal(noDashes(input), want, input);
  assert.deepEqual(withoutDashes({ issueNumber: 45, houseImage: '/newsletter/house-22.jpg', leadStory: { headline: 'A \u2014 B', sources: [{ url: 'https://x.com/a\u2014b', title: 'T \u2014 U' }] }, intelligenceItems: [{ insight: 'X\u2014Y' }] }),
    { issueNumber: 45, houseImage: '/newsletter/house-22.jpg', leadStory: { headline: 'A, B', sources: [{ url: 'https://x.com/a\u2014b', title: 'T, U' }] }, intelligenceItems: [{ insight: 'X, Y' }] }, 'text cleaned, links and numbers untouched');

  // Readers: the public issue and the archive list, for any issue already stored with dashes
  const pub = await import('../api/stay-conscious-newsletter.js');
  const out = pub.publicIssue({ issueNumber: 30, leadStory: { category: 'Trust', headline: 'Proof \u2014 not promises', insight: 'One \u2014 two.\n\nThree.', whyItMatters: 'Because \u2014 yes.' },
    intelligenceItems: [{ headline: 'Item \u2014 one', insight: 'x' }], landscapeAnalysis: { headline: 'Gap \u2014 widening', summary: 'A \u2014 b.' },
    talkingPoint: { topic: 'AI', point: 'Say \u2014 this.', story: 's' }, earnedCreative: { items: [{ brand: 'B', what: 'Did \u2014 it', url: 'https://e.com' }] } }, []);
  assert.ok(!JSON.stringify(out).includes('\u2014'), JSON.stringify(out));
  assert.equal(out.leadStory.insight, 'One, two.\n\nThree.', 'paragraphs kept');
  assert.equal(pub.archiveListRow({ id: 1, headline: 'Old \u2014 headline' }).headline, 'Old, headline');

  // Writers: the draft, publishing, the signed-in reader, the admin preview, and the exports
  const src = readFileSync(new URL('refresh-stay-conscious-newsletter.js', API), 'utf8');
  assert.ok(src.includes('const published = withoutDashes(stripDraft(draftRow.newsletter));'), 'the live issue is cleaned as it is published');
  assert.ok(!/replace\(\/\\s\*\[\u2014\u2013\]/.test(src), 'the older cleanups use the shared rule, which keeps number ranges');
  const reader = readFileSync(new URL('stay-conscious-newsletter.js', API), 'utf8');
  assert.ok(reader.includes('draft: withoutDashes(d.newsletter)') && reader.includes('newsletter: rows[0].newsletter ? withoutDashes(rows[0].newsletter) : null'));
  const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
  assert.ok(app.includes("const clean = (t) => noDashes(t || '');") && app.includes("return clean(lines.join('\\n'));") && app.includes('`LEAD STORY: ${'), 'Word and plain-text exports');
  const nl = await import('../api/refresh-stay-conscious-newsletter.js');
  assert.equal(nl.applyDraftEdits({ leadStory: { headline: 'H' } }, [{ path: 'leadStory.headline', value: 'From 2019\u20132024 \u2014 a shift' }]).leadStory.headline, 'From 2019\u20132024, a shift', 'edits drop dashes but keep ranges');
});

test('v4.10.0: every story is checked against its source page, sentence by sentence, and code has the last word', async () => {
  const nl = await import('../api/refresh-stay-conscious-newsletter.js');
  const PAGE = 'Regulators in the EU fined three packaging makers a combined 12 million euros this month for unproven recycling claims, the commission said on Tuesday. The fines are the first under the new green claims rules.';
  const SRC = 'https://www.ft.com/content/fines';
  const page = `<html><body><article><p>${PAGE}</p>${'<p>Further unrelated reporting continues here.</p>'.repeat(20)}</article></body></html>`;
  const story = { headline: 'EU fines packaging makers over recycling claims', category: 'Purpose & Sustainability',
    insight: 'The EU fined three packaging makers 12 million euros for unproven recycling claims. Sales of recycled packaging fell 30% after the ruling.\n\nThe fines are the first under the new rules.',
    whyItMatters: 'Green claims now carry a price. Brands should check every claim before it ships. Experts expect 50 more cases next year.',
    sources: [{ url: SRC, outlet: 'Financial Times', title: 'Fines' }] };
  // The checker's replies, in statement order: 1 headline, 2-4 insight, 5-7 why it matters
  const verdicts = (list) => async (url, init) => {
    if (String(url) === SRC) return { ok: true, text: async () => page };
    return { ok: true, json: async () => ({ content: [{ type: 'text', text: JSON.stringify({ verdicts: list.map((v, i) => ({ n: i + 1, ...v })) }) }] }) };
  };
  const Q1 = 'Regulators in the EU fined three packaging makers a combined 12 million euros this month';
  const Q2 = 'The fines are the first under the new green claims rules';
  const out = await nl.factCheckStory(story, { anthropicKey: 'k', fetchImpl: verdicts([
    { verdict: 'supported', quote: Q1 },
    { verdict: 'supported', quote: Q1 },
    { verdict: 'supported', quote: 'Sales of recycled packaging fell 30 percent after the ruling, the data shows' },   // not on the page
    { verdict: 'supported', quote: Q2 },
    { verdict: 'opinion' },
    { verdict: 'opinion' },
    { verdict: 'opinion' },   // an "opinion" with a figure the page does not have
  ]) });
  assert.equal(out.report.outcome, 'kept');
  assert.equal(out.item.insight, 'The EU fined three packaging makers 12 million euros for unproven recycling claims.\n\nThe fines are the first under the new rules.', 'the unsupported sentence goes; paragraphs stay');
  assert.equal(out.item.whyItMatters, 'Green claims now carry a price. Brands should check every claim before it ships.');
  assert.equal(out.item.checked, true);
  assert.deepEqual(out.report.removed.map(r => [r.field, r.reason]), [['insight', 'the checker could not point to it in the source'], ['whyItMatters', 'the figure 50 is not in the source']]);

  // A "supported" verdict whose figure is not on the page still fails, even with a real quote
  const fig = await nl.factCheckStory({ ...story, insight: 'The EU fined three packaging makers 15 million euros.', whyItMatters: '' }, { anthropicKey: 'k', fetchImpl: verdicts([{ verdict: 'supported', quote: Q1 }, { verdict: 'supported', quote: Q1 }]) });
  assert.equal(fig.item, null, 'nothing left in the story');
  assert.equal(fig.report.removed[0].reason, 'the figure 15 is not in the source');
  // Opinion is never enough for a fact, and a headline the page does not support drops the story
  const op = await nl.factCheckStory({ ...story, insight: 'The EU fined three packaging makers.', whyItMatters: '' }, { anthropicKey: 'k', fetchImpl: verdicts([{ verdict: 'supported', quote: Q1 }, { verdict: 'opinion' }]) });
  assert.match(op.report.reason, /nothing in it could be confirmed/);
  const hl = await nl.factCheckStory(story, { anthropicKey: 'k', fetchImpl: verdicts([{ verdict: 'unsupported' }, { verdict: 'supported', quote: Q1 }]) });
  assert.equal(hl.item, null);
  assert.match(hl.report.reason, /^its headline could not be confirmed/);
  // No source, an unreadable page with nothing from the search, a failed check: dropped, never kept unchecked
  assert.equal((await nl.factCheckStory({ ...story, sources: [] }, { anthropicKey: 'k' })).report.reason, 'it had no source the search returned');
  const blocked = await nl.factCheckStory(story, { anthropicKey: 'k', fetchImpl: async () => ({ ok: false, status: 403 }) });
  assert.equal(blocked.item, null);
  assert.match(blocked.report.reason, /could not be read/);
  const down = await nl.factCheckStory(story, { anthropicKey: 'k', fetchImpl: async (u) => (String(u) === SRC ? { ok: true, text: async () => page } : { ok: false, status: 529 }) });
  assert.match(down.report.reason, /could not run/);
  const late = await nl.factCheckStory(story, { anthropicKey: 'k', fetchImpl: verdicts([]), deadline: Date.now() - 1 });
  assert.match(late.report.reason, /no time left/);
  // A paywalled page: what the search returned about it is the evidence instead
  const found = new Map([[nl.normUrl(SRC), `${PAGE} ${PAGE}`]]);
  const paywalled = await nl.factCheckStory({ ...story, insight: 'The EU fined three packaging makers 12 million euros for unproven recycling claims.', whyItMatters: '' },
    { anthropicKey: 'k', found, fetchImpl: async (u) => (String(u) === SRC ? { ok: false, status: 402 } : (await verdicts([{ verdict: 'supported', quote: Q1 }, { verdict: 'supported', quote: Q1 }])(u))) });
  assert.equal(paywalled.report.outcome, 'kept');
  // Our earlier coverage is context for a follow-up, never a source on its own
  const fu = { ...story, followUp: { issueNumber: 40, headline: 'EU proposes green claims rules' } };
  assert.equal((await nl.factCheckStory(fu, { anthropicKey: 'k', fetchImpl: async () => ({ ok: false }) })).item, null);
  let seen = '';
  await nl.factCheckStory(fu, { anthropicKey: 'k', fetchImpl: async (u, init) => { if (String(u) === SRC) return { ok: true, text: async () => page }; seen = JSON.parse(init.body).messages[0].content; return { ok: false }; } });
  assert.ok(seen.includes('Our earlier coverage, Stay Conscious Issue 40') && seen.includes('Do not use your own knowledge'), 'the checker reads only the evidence');

  // Earned creative: "what" must be confirmed by the article; an unconfirmed coverage line is removed
  const EC = 'https://adweek.com/the-work';
  const ecPage = `<p>Acme turned its billboards into working solar chargers in Lisbon, and the stunt was covered by more than 40 outlets in a week.</p>${'<p>Other news.</p>'.repeat(60)}`;
  const ecFetch = (list) => async (u) => (String(u) === EC ? { ok: true, text: async () => ecPage } : { ok: true, json: async () => ({ content: [{ type: 'text', text: JSON.stringify({ verdicts: list.map((v, i) => ({ n: i + 1, ...v })) }) }] }) });
  const ex = { brand: 'Acme', title: 'Solar billboards', what: 'Acme turned billboards into solar chargers in Lisbon.', coverage: 'It was covered by 400 outlets.', url: EC };
  const ecq = 'Acme turned its billboards into working solar chargers in Lisbon';
  const e1 = await nl.factCheckExample(ex, { anthropicKey: 'k', fetchImpl: ecFetch([{ verdict: 'supported', quote: ecq }, { verdict: 'supported', quote: 'the stunt was covered by more than 40 outlets in a week' }]) });
  assert.deepEqual([e1.item.what, e1.item.coverage, e1.item.factChecked], ['Acme turned billboards into solar chargers in Lisbon.', '', true], '400 is not 40');
  const e2 = await nl.factCheckExample(ex, { anthropicKey: 'k', fetchImpl: ecFetch([{ verdict: 'unsupported' }, { verdict: 'supported', quote: ecq }]) });
  assert.equal(e2.item, null);

  // The job: unsourced stories are always dropped, a wider search runs when fewer than six pass
  const sc = await import('../api/refresh-stay-conscious.js');
  const wp = sc.widerPrompt('', { need: 3, kept: [{ category: 'Earned Creative' }], tried: [{ headline: 'Old one' }] });
  assert.ok(wp.includes('Look across the last month') && !wp.includes('- Use any of these topics, one per item: Earned Creative,') && wp.includes('"Old one"') && wp.includes('Write exactly 3 more item(s)'));
});

test('v4.10.0: figures from our own scores are checked in code; the issue goes out with the stories that passed, and nothing is posted about a short one', async () => {
  const nl = await import('../api/refresh-stay-conscious-newsletter.js');
  const ids = ['AWAKE', 'AWARE', 'REFLECTIVE', 'ATTENTIVE', 'COGENT', 'SENTIENT', 'VISIONARY', 'INTENTIONAL'];
  const row = (industry, total, s) => ({ industry, total_score: total, scores: Object.fromEntries(ids.map((id, i) => [id, s + i])) });
  const allowed = nl.landscapeFigures([row('energy', 60, 50), row('energy', 70, 60), row('health', 41, 30)]);
  for (const n of ['3', '2', '57', '100', '8', '55', '35']) assert.ok(allowed.has(n), `computed: ${n}`);
  assert.ok(!allowed.has('93'));
  assert.deepEqual(nl.unsupportedNumbers('Average 57 across 3 brands; 93% lag.', allowed), ['93'], 'a percentage nobody computed');
  assert.deepEqual(nl.unsupportedNumbers('Average 57 across 1,200 brands.', new Set(['57', '1200'])), []);
  // The prompts say which figures may be used
  assert.ok(nl.landscapePrompt('A', { figures: '3, 57' }).includes('FIGURES YOU MAY USE (computed from the scores): 3, 57. Use no other number.'));
  const pick = { attribute: { id: 'SENTIENT', name: 'Sentient', fullName: 'Emotional Connection', question: 'q', description: 'd', signals: {} }, figures: { avg: 42, brands: 30, belowFifty: 19 } };
  assert.deepEqual([...nl.spotlightFigures(pick)].sort(), ['100', '19', '30', '42', '50']);
  assert.ok(nl.spotlightPrompt(pick).includes('Use no figure except these, which come from our own scores: 19, 30, 42, 50, 100.'));
  assert.ok(nl.spotlightPrompt(pick, { strict: true }).includes('Your last answer used a figure'));
  assert.ok(nl.talkingPointPrompt([], { strict: true }).includes('Use only facts and figures that appear in the story you choose. Your last answer used a figure'));
  const src = readFileSync(new URL('refresh-stay-conscious-newsletter.js', API), 'utf8');
  assert.ok(src.includes("figureReport.push({ section: 'Landscape', outcome, figures: first });") && src.includes("section: 'Talking point'") && src.includes("section: 'Spotlight'"));

  // Only checked stories go in, however few; the draft is never held for it
  const checked = (n) => Array.from({ length: n }, (_, i) => ({ headline: `S${i}`, checked: true }));
  const at = '2026-10-25T22:05:00Z';
  const rep = { refreshed_at: at, items: [{ passed: 5, stories: [] }] };
  const ok = nl.storyCheckState({ refreshed_at: at, items: [...checked(5), { headline: 'old, unchecked' }] }, rep);
  assert.deepEqual([ok.items.length, ok.unchecked, ok.report.passed], [5, 1, 5]);
  assert.deepEqual(Object.keys(nl.storyCheckState({ refreshed_at: at, items: checked(2) }, rep)).sort(), ['items', 'report', 'unchecked'], 'no hold');
  assert.equal(nl.storyCheckState({ refreshed_at: at, items: checked(6) }, { ...rep, refreshed_at: '2026-10-18T22:05:00Z' }).report, null, 'a report from another run does not count');
  assert.equal(nl.storyCheckState({ refreshed_at: at, items: [{ headline: 'cached before v4.10.0' }] }, null).items.length, 0, 'stories cached before the check are never used');
  assert.ok(src.includes('_draft: { weekly, held: false, check,'), 'the draft carries the report, never an automatic hold');
  assert.ok(!/on hold|no draft this week|holdReason/.test(src), 'nothing is posted about a short or failed edition');
  // The report never reaches readers: it lives in _draft, which publishing strips
  assert.equal(nl.stripDraft({ issueNumber: 1, _draft: { check: {} } })._draft, undefined);

  // Earned creative looks further back when recent work does not yield three
  assert.equal(nl.EARNED_CREATIVE_WINDOWS.length, 3);
  assert.ok(nl.earnedCreativePrompt({ window: 2 }).startsWith('Find 6 examples of earned creative that cut through. Look back up to three years.'));
  assert.ok(nl.earnedCreativePrompt().includes('nothing older'), 'the first search is still recent work');
  const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
  assert.ok(app.includes('<FactCheckReport check={draftState.meta.check} />') && !app.includes('Held by the fact check.'));
});
