// v3.99.0: the four assessment steps rebuilt to the packet (screens 02-05).
// Run: node tests/support/build-render-bundle.mjs && node --test tests/
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://compass.test/', pretendToBeVisual: true });
globalThis.window = dom.window;
for (const k of Object.getOwnPropertyNames(dom.window)) {
  if (k in globalThis) continue;
  try { Object.defineProperty(globalThis, k, { value: dom.window[k], configurable: true, writable: true }); } catch { /* read-only */ }
}
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
globalThis.fetch = window.fetch = async () => ({ ok: false, status: 404, json: async () => ({}) });

let React, client, server, act, App, h;
before(async () => {
  React = (await import('react')).default;
  client = await import('react-dom/client');
  server = await import('react-dom/server');
  act = React.act;
  h = (...a) => React.createElement(...a);
  App = await import('./.build/app.bundle.mjs');
});

const project = { brandName: 'MKB', websiteUrl: 'https://www.mkb.com', industry: 'energy', businessModel: 'b2b' };
const base = (extra = {}) => ({ assessmentData: {}, setAssessmentData() {}, apiKey: 'k', project, onPrev() {}, onNext() {}, onClearScores() {}, ...extra });
const PAGES = [
  ['WebsiteAssessment', 2, 'Website', 'Website assessment', 'Social', '02-website-assessment.html'],
  ['SocialMediaAssessment', 3, 'Social', 'Social media assessment', 'AI Reputation', '03-social-assessment.html'],
  ['AIReputationPage', 4, 'AI Reputation', 'AI reputation assessment', 'Earned Media', '04-ai-reputation-assessment.html'],
  ['EarnedMediaAssessment', 5, 'Earned Media', 'Earned media assessment', 'the report', '05-earned-media-assessment.html'],
];
const render = (name, extra) => new JSDOM(server.renderToStaticMarkup(h(App[name], base(extra)))).window.document;
const fixture = (f) => new JSDOM(JSON.parse(readFileSync(new URL('./fixtures/design-screens.json', import.meta.url), 'utf8'))[f]).window.document;

for (const [name, step, label, title, next, file] of PAGES) {
  test(`${label}: the packet shell, head, rail and footer`, () => {
    const doc = render(name, { onSaveExit() {} });
    const page = doc.querySelector('.dc-page.is-form');
    assert.ok(page, 'the form page');
    assert.equal(page.querySelector('.dc-page-head .dc-kicker.is-accent').textContent, `Step ${step} of 6 · ${label}`);
    assert.equal(page.querySelector('.dc-page-head h1.dc-display').textContent, title);
    assert.ok(page.querySelector('.dc-alert.is-warn.dc-mobile-only .dc-alert-x'), 'the dismissible mobile notice');
    const design = fixture(file);
    const shape = (d) => [...d.querySelector('.dc-assess').children].map(c => c.className);
    assert.deepEqual(shape(doc), shape(design), 'form column beside the rail, as in the packet');
    const rail = page.querySelector('aside.dc-assess-rail');
    assert.ok(rail.querySelector('.dc-progress-head strong').textContent.endsWith(`of ${rail.querySelectorAll('.dc-checklist li').length}`));
    const railBtns = [...rail.querySelectorAll('.dc-rail-actions button')].map(b => b.textContent);
    assert.deepEqual(railBtns, [`Continue to ${next} →`, 'Save and exit']);
    const foot = page.querySelector('.dc-assess-foot');
    assert.equal(foot.querySelector('.btn-secondary').textContent, '← Back');
    assert.equal(foot.querySelector('.btn-primary').hasAttribute('disabled'), true, 'nothing done yet');
    assert.match(foot.querySelector('[data-field="blocker"]').textContent, /^Still needed: /, 'the reason sits beside Continue');
    assert.ok(page.querySelectorAll('.dc-panel-dark').length <= 1, 'at most one dark panel');
    assert.equal(page.querySelectorAll('svg.lucide').length, 0, 'no icons');
    assert.equal(page.querySelectorAll('.card, [class*="bg-["], [class*="text-["]').length, 0, 'no legacy classes');
  });
}

test('without Save and exit wired, the rail offers Continue only', () => {
  const doc = render('EarnedMediaAssessment');
  assert.deepEqual([...doc.querySelectorAll('.dc-rail-actions button')].map(b => b.textContent), ['Continue to the report →']);
});

test('Website: the checklist names every required item; screenshots stay required because the analysis runs on them', () => {
  const doc = render('WebsiteAssessment');
  const items = [...doc.querySelectorAll('.dc-checklist li')].map(li => li.textContent);
  assert.deepEqual(items, ['Auto-assess', 'SEO check', 'Screenshots', 'Pages listed', 'Content', 'Analysis']);
  assert.equal(doc.querySelector('[data-field="blocker"]').textContent, 'Still needed: auto-assess');
  const tiles = [...doc.querySelectorAll('.dc-tiles.is-scores .dc-tile input.dc-stat-n[type="number"]')];
  assert.equal(tiles.length, 4, 'four editable PageSpeed numerals');
});

test('Website: a PageSpeed score reads by word as well as colour', () => {
  const doc = render('WebsiteAssessment', { assessmentData: { techAudit: { scores: { performance: '95', accessibility: '61', bestPractices: '30', seo: '' }, metrics: {} } } });
  const status = [...doc.querySelectorAll('.dc-tile-status')].map(s => [s.className, s.textContent]);
  assert.deepEqual(status, [['dc-tile-status is-good', 'Good'], ['dc-tile-status is-warn', 'Needs work'], ['dc-tile-status is-poor', 'Poor'], ['dc-tile-status', '']]);
});

test('Social: health check and campaign are optional in the rail; the no-presence note comes first when ticked', () => {
  const doc = render('SocialMediaAssessment');
  const optional = [...doc.querySelectorAll('.dc-checklist li')].filter(li => li.querySelector('em')).map(li => li.querySelector('span').textContent);
  assert.deepEqual(optional, ['Health check', 'Campaign']);
  assert.equal(doc.querySelector('[data-field="blocker"]').textContent, 'Still needed: channels');
  assert.ok(doc.querySelector('.dc-acc-list .dc-acc-h[aria-expanded]'), 'channels are one accordion list');
  assert.ok(doc.querySelector('.dc-acc-list.is-secondary [data-channel="reputation"]'));
  const ticked = render('SocialMediaAssessment', { assessmentData: { noSocialPresence: true } });
  assert.equal(ticked.querySelector('[data-field="blocker"]').textContent, 'Still needed: what you checked, for no social presence');
});

test('Social: correcting an auto-checked panel keeps focus while typing', async () => {
  let data = { linkedinAuto: 'Auto text' };
  const container = document.createElement('div'); document.body.appendChild(container);
  const root = client.createRoot(container);
  const Harness = () => {
    const [d, setD] = React.useState(data);
    return h(App.SocialMediaAssessment, base({ assessmentData: d, setAssessmentData: (u) => setD(prev => ({ ...prev, ...u })) }));
  };
  await act(async () => { root.render(h(Harness)); });
  const li = [...container.querySelectorAll('.dc-acc-h')].find(b => b.textContent.includes('LinkedIn'));
  if (li.getAttribute('aria-expanded') === 'false') await act(async () => { li.click(); });
  const correct = [...container.querySelectorAll('.dc-autopanel .dc-link-btn')].find(b => b.textContent === 'Correct');
  await act(async () => { correct.click(); });
  const box = container.querySelector('.dc-autopanel textarea');
  box.focus();
  const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
  await act(async () => { setter.call(box, 'Auto text, corrected'); box.dispatchEvent(new window.Event('input', { bubbles: true })); });
  assert.equal(document.activeElement, container.querySelector('.dc-autopanel textarea'), 'the field did not remount');
  assert.equal(document.activeElement, box, 'same element, still focused');
  await act(async () => root.unmount());
});

test('AI reputation: each engine shows its own status and the block counts them; any three unlock the synthesis', () => {
  const doc = render('AIReputationPage', { assessmentData: { claudeManual: 'x', chatgptManual: 'y' } });
  const engines = [...doc.querySelectorAll('.dc-engine')];
  assert.ok(engines.length >= 4);
  const pasted = engines.filter(e => e.querySelector('.dc-status').textContent === 'Pasted').length;
  assert.equal(doc.querySelector('[data-field="engine-count"]').textContent, `${pasted} of ${engines.length} pasted`);
  engines.forEach(e => assert.equal(e.querySelector('a').className, 'btn-secondary btn-sm', 'one neutral button per engine'));
  assert.match(doc.querySelector('[data-field="blocker"]').textContent, /^Still needed: \d more AI engine response/);
  const optional = [...doc.querySelectorAll('.dc-checklist li em')].map(em => em.parentElement.querySelector('span').textContent);
  assert.deepEqual(optional, ['Wikipedia', 'Reddit']);
});

test('the step bar shows the save state only once a draft has been saved', () => {
  const steps = [{ id: 'setup', name: 'Setup' }, { id: 'website', name: 'Website' }, { id: 'social', name: 'Social' }, { id: 'ai', name: 'AI Rep' }, { id: 'earned', name: 'Earned Media' }, { id: 'report', name: 'Report' }];
  const none = new JSDOM(server.renderToStaticMarkup(h(App.ProgressSteps, { currentStep: 2, steps }))).window.document;
  assert.equal(none.querySelector('.dc-save-state'), null, 'left out until the first save');
  const saved = new JSDOM(server.renderToStaticMarkup(h(App.ProgressSteps, { currentStep: 2, steps, savedAt: new Date('2026-09-28T17:08:00') }))).window.document;
  const el = saved.querySelector('.dc-steps .dc-wrap > .dc-save-state');
  assert.equal(el.getAttribute('aria-live'), 'polite');
  assert.match(el.textContent, /^Draft saved \d{1,2}:\d{2}\s?[AP]M$/);
});

test('one draft saver: per user, on every change, without screenshots; the stray 30-second copy is gone (v3.103.0)', () => {
  const src = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
  assert.equal((src.match(/localStorage\.setItem\(key, JSON\.stringify\(draft\)\)/g) || []).length, 1, 'the per-user saver');
  assert.ok(!src.includes("localStorage.setItem('conscious-compass-draft'"), 'the key nothing read is no longer written');
  assert.ok(src.includes("localStorage.removeItem('conscious-compass-draft')"), 'and old copies are cleared');
  assert.ok(!src.includes('autoSaveInterval'));
});

// ── Save and exit, then reopen (v3.99.1) ─────────────────────

test('a loaded assessment opens on the step it was saved from', () => {
  assert.equal(App.resumeStepFor({ scores: { AWAKE: { score: 50 } }, project: { resumeStep: 3 } }), 6, 'scored opens on the report');
  assert.equal(App.resumeStepFor({ scores: null, project: { resumeStep: 3 } }), 3);
  assert.equal(App.resumeStepFor({ scores: null, project: { resumeStep: 5 } }), 5);
  assert.equal(App.resumeStepFor({ scores: null, project: {} }), 1, 'older saves open on Setup, not Welcome');
  for (const bad of [0, 6, 9, '2x', null]) assert.equal(App.resumeStepFor({ scores: null, project: { resumeStep: bad } }), 1, `rejects ${bad}`);
});

test('Save and exit records the step; the report Save does not', () => {
  const src = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
  assert.ok(src.includes('await handleSave({ quiet: true, resumeStep: currentStep })'));
  assert.ok(src.includes('...(resumeStep != null ? { resumeStep } : {})'));
  assert.ok(src.includes('setCurrentStep(resumeStepFor(data));'));
});

test('a reopened, analysed step is not blocked by the screenshots saving stripped', () => {
  const done = { status: 'complete', content: 'Analysis.', autoAssessContent: 'a', seoAssessment: 's', pagesReviewed: 'Home', websiteContent: 'Copy', images: [] };
  const web = render('WebsiteAssessment', { assessmentData: done });
  const shots = [...web.querySelectorAll('.dc-checklist li')].find(li => li.textContent === 'Screenshots');
  assert.equal(shots.className, 'is-done');
  assert.equal(web.querySelector('.dc-assess-foot .btn-primary').hasAttribute('disabled'), false, 'Continue is open');
  assert.ok(web.querySelector('[data-field="shots-not-kept"]'), 'says why no screenshots show');
  // before any analysis, screenshots are still required
  const fresh = render('WebsiteAssessment', { assessmentData: { ...done, status: 'pending' } });
  assert.notEqual([...fresh.querySelectorAll('.dc-checklist li')].find(li => li.textContent === 'Screenshots').className, 'is-done');
  assert.equal(fresh.querySelector('[data-field="shots-not-kept"]'), null);
});

test('Social: the same holds for its screenshots', () => {
  const soc = render('SocialMediaAssessment', { assessmentData: { status: 'complete', content: 'Analysis.', socialImages: [] } });
  const shot = [...soc.querySelectorAll('.dc-checklist li')].find(li => li.querySelector('span').textContent === 'Screenshot');
  assert.equal(shot.className, 'is-done');
  assert.ok(soc.querySelector('[data-field="shots-not-kept"]'));
});


// ── Draft notice (packet 13, v3.103.0) ───────────────────────

const draft = (step, extra = {}) => ({ project: { brandName: 'MKB' }, assessments: {}, currentStep: step, savedAt: '2026-09-29T08:55:00Z', ...extra });

test('the draft notice follows the packet: rust kicker, brand in Newsreader, sentence-case meta', () => {
  const doc = new JSDOM(server.renderToStaticMarkup(h(App.WelcomePage, { onStart() {}, draft: draft(3) }))).window.document;
  const n = doc.querySelector('.dc-page > section.dc-draft:first-child');
  assert.ok(n, 'first thing on the page, before the hero');
  assert.equal(n.nextElementSibling.className, 'dc-hero');
  assert.equal(n.getAttribute('role'), 'status');
  assert.equal(n.querySelector('.dc-kicker.is-accent').textContent, 'Unsaved assessment');
  assert.equal(n.querySelector('h2.dc-draft-name').textContent, 'MKB');
  const meta = n.querySelector('.dc-meta').textContent;
  assert.match(meta, /^Step 3 of 5 · Last saved [A-Z][a-z]{2} \d{1,2}, 2026, \d{1,2}:\d{2}\s?[AP]M$/);
  assert.ok(!meta.includes('\u2014'), 'no em dash');
  assert.equal(n.querySelector('time').getAttribute('datetime'), '2026-09-29T08:55:00.000Z');
  assert.deepEqual([...n.querySelectorAll('.dc-head-actions button')].map(b => [b.className, b.textContent]), [['btn-primary', 'Resume assessment'], ['btn-secondary', 'Discard']]);
});

test('the step is clamped: the report stage reads 5 of 5, never 6 of 5', () => {
  const doc = new JSDOM(server.renderToStaticMarkup(h(App.WelcomePage, { onStart() {}, draft: draft(6) }))).window.document;
  assert.match(doc.querySelector('.dc-draft .dc-meta').textContent, /^Step 5 of 5/);
});

test('no draft, no notice: nothing rendered, not an empty box', () => {
  const doc = new JSDOM(server.renderToStaticMarkup(h(App.WelcomePage, { onStart() {} }))).window.document;
  assert.equal(doc.querySelector('.dc-draft'), null);
});

test('Discard asks first, then removes the draft and moves focus to Start new assessment', async () => {
  let discarded = 0, resumed = 0;
  const container = document.createElement('div'); document.body.appendChild(container);
  const root = client.createRoot(container);
  const Harness = () => {
    const [d, setD] = React.useState(draft(2));
    return h(App.WelcomePage, { onStart() {}, draft: d, onResume: () => { resumed++; }, onDiscard: () => { discarded++; setD(null); } });
  };
  await act(async () => { root.render(h(Harness)); });
  const btn = (t) => [...container.querySelectorAll('button')].find(b => b.textContent === t);
  await act(async () => { btn('Discard').click(); });
  assert.equal(discarded, 0, 'not yet');
  assert.ok(container.textContent.includes('Discard this draft?'));
  await act(async () => { btn('Cancel').click(); });
  assert.ok(btn('Resume assessment'), 'Cancel restores the buttons');
  await act(async () => { btn('Discard').click(); });
  await act(async () => { btn('Discard').click(); await new Promise(r => setTimeout(r, 5)); });
  assert.equal(discarded, 1);
  assert.equal(container.querySelector('.dc-draft'), null, 'the notice is gone');
  assert.equal(document.activeElement?.textContent, 'Start new assessment');
  await act(async () => root.unmount());
});

// ── Stay Conscious as a newspaper (packet 13, 09b) ───────────

const ITEM = (n) => ({ category: `Topic ${n}`, headline: `Headline ${n}`, insight: `Insight ${n}.`, whyItMatters: `Why ${n}.` });
const ISSUE = (items = 5, avg = 51) => ({ issueNumber: 29, weekOf: 'September 27, 2026',
  leadStory: { category: 'AI Visibility', headline: 'AI Engines Cite Third Parties', insight: 'First paragraph.\n\nSecond paragraph.', whyItMatters: 'Because.' },
  intelligenceItems: Array.from({ length: items }, (_, i) => ITEM(i + 1)),
  landscapeAnalysis: { brandCount: 58, sectorCount: 11, averageScore: avg, headline: 'Brands know where they are going.', summary: 'One.\n\nTwo.' },
  storyOpportunities: [{ headline: 'Opp one', body: 'Body one.' }, { headline: 'Opp two', body: 'Body two.' }] });

async function mountIssue(issue, props = {}) {
  globalThis.fetch = window.fetch = async () => ({ ok: true, json: async () => ({ newsletter: issue, refreshedAt: '2026-09-27T19:30:00Z' }) });
  const container = document.createElement('div'); document.body.appendChild(container);
  const root = client.createRoot(container);
  await act(async () => { root.render(h(App.StayConsciousPage, { onBack() {}, isAdmin: false, ...props })); });
  for (let i = 0; i < 5; i++) await act(async () => { await new Promise(r => setTimeout(r, 0)); });
  return { container, root };
}

test('the issue takes the packet structure: tools, masthead, front page, sections, footer', async () => {
  const { container, root } = await mountIssue(ISSUE());
  const page = container.querySelector('.dc-page.dc-np');
  const design = new JSDOM(JSON.parse(readFileSync(new URL('./fixtures/design-screens.json', import.meta.url), 'utf8'))['09b-stay-conscious-newspaper.html']).window.document.querySelector('.dc-np');
  const top = (el) => [...el.children].map(c => c.className);
  assert.deepEqual(top(page), top(design));
  assert.equal(page.querySelector('.dc-np-lead .dc-kicker').textContent, 'AI Visibility · Lead story');
  assert.equal(page.querySelectorAll('.dc-np-lead .dc-np-text.is-cols p').length, 2, 'paragraphs flow in the columns');
  const fill = page.querySelectorAll('.dc-np-lead figure');
  assert.equal(fill.length, 1, 'no story image: the house image fills the column, and no placeholder');
  assert.equal(fill[0].dataset.field, 'lead-fill');
  assert.equal(fill[0].getAttribute('aria-hidden'), 'true', 'decorative');
  assert.equal(fill[0].dataset.edition, '5', 'issue 29 takes the fifth of eight images (v3.122.0)');
  assert.equal(page.querySelector('.dc-np-lead .slot'), null);
  assert.equal(page.querySelector('[data-value="average"]').textContent, '51');
  assert.match(page.querySelector('.dc-np-figure .dc-meta').textContent, /^Average score out of 100 · Based on 58 brands across 11 sectors$/);
  assert.deepEqual([...page.querySelectorAll('.dc-np-opp .dc-np-ord')].map(o => o.textContent), ['1', '2']);
  assert.equal(page.querySelectorAll('[style*="color"], [class*="text-["], .card, svg.lucide').length, 0, 'no chips, legacy classes or icons');
  assert.equal(page.querySelector('.dc-np-dateline time').getAttribute('datetime'), '2026-09-27T19:30:00.000Z');
  await act(async () => root.unmount());
});

test('the house image moves on one with each edition and wraps after eight (v3.122.0; one file each since v3.123.0)', async () => {
  for (const [issue, want] of [[1, '1'], [2, '2'], [8, '8'], [9, '1'], [30, '6'], [undefined, '1']]) {
    const nl = ISSUE(); nl.issueNumber = issue;
    const { container, root } = await mountIssue(nl);
    assert.equal(container.querySelector('[data-field="lead-fill"]').dataset.edition, want, `issue ${issue}`);
    assert.equal(container.querySelector('[data-field="lead-fill"] img').getAttribute('src'), `/newsletter/house-${want}.jpg`);
    await act(async () => root.unmount());
  }
  const src = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
  for (let i = 1; i <= 8; i++) assert.ok(src.includes(`src: '/newsletter/house-${i}.jpg'`), `image ${i} is listed`);
  // The folder is uploaded to the repo once and left out of build ZIPs (v3.123.0),
  // so it is only checked where it exists.
  if (existsSync(new URL('../public/newsletter/', import.meta.url))) {
    for (let i = 1; i <= 8; i++) assert.ok(existsSync(new URL(`../public/newsletter/house-${i}.jpg`, import.meta.url)), `house-${i}.jpg`);
  }
});

test('a lead story with its own image shows that, not the house image', async () => {
  const issue = ISSUE(); issue.leadStory.image = { src: 'https://example.com/story.jpg', alt: 'Story', caption: 'Caption' };
  const { container, root } = await mountIssue(issue);
  const figs = [...container.querySelectorAll('.dc-np-lead figure')];
  assert.equal(figs.length, 1);
  assert.equal(figs[0].querySelector('img').getAttribute('src'), 'https://example.com/story.jpg');
  assert.equal(container.querySelector('[data-field="lead-fill"]'), null);
  await act(async () => root.unmount());
});

test('brand intelligence rows follow the agreed layout for 3, 4 and 5+ stories', async () => {
  for (const [n, want] of [[3, ['is-3:3']], [4, ['is-2:2', 'is-2:2']], [5, ['is-2:2', 'is-3:3']], [8, ['is-2:2', 'is-3:3', 'is-3:3']], [2, ['is-2:2']]]) {
    const { container, root } = await mountIssue(ISSUE(n));
    const rows = [...container.querySelectorAll('.dc-np-sec .dc-np-grid')].map(g => `${g.classList[1]}:${g.children.length}`);
    assert.deepEqual(rows, want, `${n} stories`);
    await act(async () => root.unmount());
  }
});

test('without a stored average the numeral is left out, never invented', async () => {
  const issue = ISSUE(5); delete issue.landscapeAnalysis.averageScore;
  const { container, root } = await mountIssue(issue);
  assert.equal(container.querySelector('[data-value="average"]'), null);
  assert.match(container.querySelector('.dc-np-figure .dc-meta').textContent, /^Based on 58 brands/);
  await act(async () => root.unmount());
});

test('Share link copies the current issue and says so; Force refresh is admin-only and asks first', async () => {
  let copied = null;
  Object.defineProperty(globalThis.navigator, 'clipboard', { value: { writeText: async (t) => { copied = t; } }, configurable: true });
  const { container, root } = await mountIssue(ISSUE(), { isAdmin: false });
  const btn = (t) => [...container.querySelectorAll('.dc-np-tools button')].find(b => b.textContent === t);
  assert.equal(btn('Force refresh'), undefined, 'not for non-admins');
  await act(async () => { btn('Share link').click(); await new Promise(r => setTimeout(r, 0)); });
  assert.match(copied, /\/newsletter$/, 'the public link, which needs no sign-in (v3.120.0)');
  assert.ok(btn('Link copied'), 'the label confirms it');
  await act(async () => root.unmount());
  let posted = 0;
  const admin = await mountIssue(ISSUE(), { isAdmin: true });
  const f = globalThis.fetch;
  globalThis.fetch = window.fetch = async (url, o) => { if (o?.method === 'POST') posted++; return f(url, o); };
  window.confirm = () => false;
  await act(async () => { [...admin.container.querySelectorAll('button')].find(b => b.textContent === 'Force refresh').click(); });
  assert.equal(posted, 0, 'declining the confirmation runs nothing');
  await act(async () => admin.root.unmount());
});

test('the weekly jobs store the portfolio average and date the issue in US English', () => {
  const la = readFileSync(new URL('../api/refresh-landscape-analysis.js', import.meta.url), 'utf8');
  assert.ok(la.includes('averageScore: overallScore,'));
  const nl = readFileSync(new URL('../api/refresh-stay-conscious-newsletter.js', import.meta.url), 'utf8');
  assert.ok(nl.includes('averageScore: Number.isFinite(landscapeAnalysis.averageScore) ? landscapeAnalysis.averageScore : await portfolioAverage()'));
  assert.ok(nl.includes("compass_results?select=brand_name,total_score,created_at"), 'the fallback averages full assessments, latest save per brand');
  assert.ok(!nl.includes("'en-GB'") && nl.includes("toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })"));
});

test('the newsletter Word export uses the newspaper system and embeds the fonts', () => {
  const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
  const at = app.indexOf("const handleExportDocx = async () => {\n    if (!newsletter) return;");
  const gen = app.slice(at, app.indexOf('\n  };\n', at));
  assert.ok(!gen.includes("'Inter'") && !gen.includes('E8FF00') && !gen.includes('catColor'), 'old font, lime and category colours gone');
  assert.ok(gen.includes("const SANS = 'Hanken Grotesk', SERIF = 'Newsreader';"));
  assert.ok(gen.includes('BorderStyle.DOUBLE'), 'double rules under the dateline and section heads');
  assert.ok(gen.includes('embedReportFonts(await Packer.toBlob(doc)'));
});

// ── The public issue (v3.120.0) ──────────────────────────────

test('the public issue renders without the internal tools or story opportunities', async () => {
  const issue = ISSUE(5);
  delete issue.storyOpportunities;   // the server never sends them publicly
  let asked = null;
  globalThis.fetch = window.fetch = async (url) => { asked = String(url); return { ok: true, json: async () => ({ newsletter: issue, refreshedAt: '2026-09-27T19:30:00Z', public: true }) }; };
  const container = document.createElement('div'); document.body.appendChild(container);
  const root = client.createRoot(container);
  await act(async () => { root.render(h(App.StayConsciousPage, { onBack() {}, isAdmin: true, publicView: true })); });
  for (let i = 0; i < 5; i++) await act(async () => { await new Promise(r => setTimeout(r, 0)); });
  assert.equal(asked, '/api/stay-conscious-newsletter?public=1');
  const labels = [...container.querySelectorAll('button')].map(b => b.textContent);
  assert.deepEqual(labels, ['Share link'], 'no Back, DOCX, Copy or Force refresh, even for an admin');
  assert.ok(container.querySelector('.dc-np-brand img'), 'the Antenna mark instead');
  assert.ok(container.textContent.includes('Brand intelligence from Antenna Group'));
  assert.ok(container.querySelector('.dc-np-lead') && container.querySelector('[data-value="average"]'));
  await act(async () => root.unmount());
});

test('earned creative in the news: the reminder, sourced examples with links and coverage, then the Antenna offer with HOWL (v3.124.0)', async () => {
  const issue = ISSUE(3);
  issue.earnedCreative = { items: [
    { brand: 'Real One', agency: 'Agency A', title: 'The Big Act', what: 'They did a thing.', coverage: 'Covered by 40 outlets.', outlet: 'Adweek', url: 'https://www.adweek.com/brand/real-one' },
    { brand: 'Real Two', agency: '', title: '', what: 'Another thing.', coverage: '', outlet: '', url: 'https://www.thedrum.com/news/real-two' },
  ] };
  for (const publicView of [false, true]) {
    globalThis.fetch = window.fetch = async () => ({ ok: true, json: async () => ({ newsletter: issue, refreshedAt: '2026-09-27T19:30:00Z' }) });
    const container = document.createElement('div'); document.body.appendChild(container);
    const root = client.createRoot(container);
    await act(async () => { root.render(h(App.StayConsciousPage, { onBack() {}, isAdmin: false, publicView })); });
    for (let i = 0; i < 5; i++) await act(async () => { await new Promise(r => setTimeout(r, 0)); });
    const sec = container.querySelector('[data-field="earned-creative-news"]');
    assert.ok(sec, `shown (public ${publicView})`);
    assert.equal(sec.querySelector('h2').textContent, 'Earned creative in the news');
    assert.ok(sec.querySelector('.dc-np-ec-lead').textContent.startsWith('Earned creative is an idea designed to be talked about'), 'leads with the reminder');
    const items = sec.querySelectorAll('.dc-np-item');
    assert.equal(items.length, 2);
    assert.equal(items[0].querySelector('[data-value="brand"]').textContent, 'Real One \u00b7 Agency A');
    const a = items[0].querySelector('a.dc-np-source');
    assert.equal(a.getAttribute('href'), 'https://www.adweek.com/brand/real-one');
    assert.equal(a.getAttribute('rel'), 'noopener noreferrer');
    assert.ok(a.textContent.includes('Read it in Adweek'));
    assert.ok(items[0].textContent.includes('Covered by 40 outlets.'));
    assert.equal(items[1].querySelector('h3').textContent, 'Real Two', 'no title falls back to the brand');
    const offer = sec.querySelector('.dc-np-ec-offer');
    assert.ok(offer.textContent.includes('Antenna Group creates work like this through HOWL'));
    assert.equal(offer.querySelector('img').getAttribute('src'), '/howl-logo.svg');
    assert.equal(offer.querySelector('a').getAttribute('href'), 'https://www.howlagency.com/', 'the HOWL site (v3.124.1)');
    assert.equal(offer.querySelector('a').textContent, 'howlagency.com');
    await act(async () => root.unmount());
  }
});
