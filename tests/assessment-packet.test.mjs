// v3.99.0: the four assessment steps rebuilt to the packet (screens 02-05).
// Run: node tests/support/build-render-bundle.mjs && node --test tests/
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
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

test('the draft autosave no longer restarts its clock on every change', () => {
  const src = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
  const at = src.indexOf("localStorage.setItem('conscious-compass-draft'");
  const block = src.slice(at - 900, at + 500);
  assert.ok(block.includes('draftRef.current'), 'reads the latest state from a ref');
  assert.match(block, /\}, 30000\);\s*return \(\) => clearInterval\(autoSaveInterval\);\s*\}, \[\]\);/, 'the timer is set once');
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
