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
    assert.match(src, /import \{ requireUser(, requireStaff)? \} from '\.\/_auth\.js';/, f);
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
  const out = await mod.fetchEarnedCreative('k', { fetchImpl, verify: async (e) => pass.has(e.brand) });
  assert.equal(prompts.length, 2, 'a second search ran because only one passed');
  assert.ok(prompts[1].includes('already covered: a, b, c'), 'the top-up skips brands already tried');
  assert.deepEqual(out.items.map(i => i.brand), ['A', 'D', 'E'], 'three kept, most recent first, undated last');
  assert.ok(!('searchTitle' in out.items[0]));

  // Three pass in the first round: no second search.
  prompts.length = 0;
  const one = await mod.fetchEarnedCreative('k', { fetchImpl, verify: async () => true });
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
  assert.ok(p.includes('Readers are marketers and business leaders who have never seen the Conscious Compass'));
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
  assert.ok(app.includes("publicView ? 'Why it matters for brands' : 'Why it matters for assessment'"));
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
  const out = await mod.fetchEarnedCreative('k', { fetchImpl, verify: async () => true });
  assert.equal(bodies.length, 2, 'the paused turn was resumed');
  assert.equal(bodies[1].messages[1].role, 'assistant', 'resumed with the paused content');
  assert.deepEqual(out.items.map(i => i.brand), ['A', 'B', 'C'], 'links from the paused turn count as searched');
  assert.ok(out.items.every(i => i.verified === true));
  assert.deepEqual(out.status, { searches: 1, candidates: 3, passed: 3, reasons: [] });

  // A failed request: no items, and the reason is saved.
  const failed = await mod.fetchEarnedCreative('k', { fetchImpl: async () => ({ ok: false, status: 429 }) });
  assert.deepEqual(failed.items, []);
  assert.ok(failed.status.reasons.includes('search request failed (429)'));

  // Nothing new: last issue's checked examples stay up for four weeks, never unchecked ones.
  const now = Date.parse('2026-10-09T12:00:00Z');
  const prev = { items: [{ ...ex('A'), verified: true }, { ...ex('Old'), url: url('old') }], generatedAt: '2026-10-04T23:30:00Z' };
  const carried = mod.withCarryOver(failed, prev, 34, now);
  assert.deepEqual(carried.items.map(i => i.brand), ['A']);
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
  assert.match(ecStatusNote(failed), /no section this issue \(2 searches, 0 candidates, 0 passed the article check; search request failed \(429\)\)/);
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
  assert.ok(src.includes('if (caller.cron) archived = await archiveIssue(prevRow'), 'only the scheduled run archives');
  assert.ok(src.indexOf('archiveIssue(prevRow') < src.indexOf('// Upsert into Supabase (single row, id=1)'), 'archived before it is overwritten');

  const pub = await import('../api/stay-conscious-newsletter.js');
  assert.equal(pub.archiveId({ query: { issue: '12' } }), 12);
  assert.equal(pub.archiveId({ query: { issue: '12; drop table' } }), null, 'only a plain number reaches the query');
  assert.equal(pub.wantsArchiveList({ query: { archive: 'list' } }), true);
  assert.deepEqual(pub.archiveListRow({ id: 3, issue_number: 37, refreshed_at: 'x', week_of: 'October 9, 2026', headline: 'SENTIENT lags' }),
    { id: 3, issueNumber: 37, weekOf: 'October 9, 2026', refreshedAt: 'x', headline: 'Sentient lags', image: null });

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
  assert.equal(nextIssueAt(new Date('2026-10-09T22:41:00Z')).toISOString(), '2026-10-11T23:30:00.000Z', 'Friday: this Sunday, 23:30 UTC');
  assert.equal(nextIssueAt(new Date('2026-10-11T23:45:00Z')).toISOString(), '2026-10-18T23:30:00.000Z', 'just after the run: next week');

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
  assert.ok(app.includes('<ArchiveThumb image={p.image} issueNumber={p.issueNumber} />'));
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
