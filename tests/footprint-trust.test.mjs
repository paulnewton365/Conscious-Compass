// Report sections 04 Brand footprint and 06 Trust and credibility, rebuilt to
// the design packet (v3.97). Run: node tests/support/build-render-bundle.mjs && node --test tests/
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
globalThis.ResizeObserver ||= class { observe() {} unobserve() {} disconnect() {} };
globalThis.IntersectionObserver ||= class { observe() {} unobserve() {} disconnect() {} };
window.IntersectionObserver ||= globalThis.IntersectionObserver;
window.scrollTo = () => {};

let React, server, client, act, App, fpLib, tlLib, rubric, h;
before(async () => {
  React = (await import('react')).default;
  server = await import('react-dom/server');
  client = await import('react-dom/client');
  act = React.act;
  h = (...a) => React.createElement(...a);
  App = await import('./.build/app.bundle.mjs');
  fpLib = await import('../src/lib/footprintChart.js');
  tlLib = await import('../src/lib/trustLensView.js');
  rubric = await import('../src/data/rubric.js');
});

const design = (file, id) => new JSDOM(readFileSync(new URL(`./fixtures/design/${file}`, import.meta.url), 'utf8'))
  .window.document.querySelector(`section#${id}`);
const inSection = (el, id) => {
  const html = server.renderToStaticMarkup(h('section', { className: 'dc-section', id }, el));
  return new JSDOM(html).window.document.querySelector('section');
};
// tag and classes for every element in order, the toggle excluded
const sig = (root, skip = () => false) => [...root.querySelectorAll('*')]
  .filter(el => !el.closest('.dc-sec-toggle') && !skip(el))
  .map(el => `${el.tagName.toLowerCase()}.${[...el.classList].sort().join('.')}`);

// ── Brand footprint ──────────────────────────────────────────

// The packet's Smart Electric Power Alliance sample, as the scoring pass returns it.
const lv = (level, evidence = '') => ({ level, evidence, sentiment: null });
const SEPA = () => ({
  channels: { earned: lv(5), analyst: lv(3), thirdParty: lv(2), podcast: lv(3), ai: lv(5), paid: lv(0), owned: lv(5), social: lv(4) },
  links: [
    { from: 'earned', to: 'owned', strength: 'strong' },
    { from: 'owned', to: 'ai', strength: 'strong' },
    { from: 'earned', to: 'analyst', strength: 'weak' },
    { from: 'earned', to: 'social', strength: 'weak' },
  ],
});
const fp = (footprint = SEPA(), brandName = 'Smart Electric Power Alliance') =>
  inSection(h(App.FootprintMap, { footprint, brandName }), 'footprint');

test('the chart is the design\'s SVG, coordinate for coordinate', () => {
  const norm = (svg) => [...svg.querySelectorAll('*')].map(el =>
    `${el.tagName.toLowerCase()} ${[...el.attributes].map(a => `${a.name}=${a.value}`).sort().join(' ')} ${el.children.length ? '' : el.textContent}`);
  const ours = fp().querySelector('svg.dc-fp-chart');
  const theirs = design('16-brand-footprint.html', 'footprint').querySelector('svg.dc-fp-chart');
  assert.equal(ours.getAttribute('viewBox'), theirs.getAttribute('viewBox'));
  assert.deepEqual(norm(ours), norm(theirs));
});

test('the section matches the design export element for element', () => {
  assert.deepEqual(sig(fp()), sig(design('16-brand-footprint.html', 'footprint')));
});

test('the counts, table order and bars come from the data', () => {
  const s = fp();
  assert.deepEqual([...s.querySelectorAll('.dc-fp-stats .dc-stat-n')].map(n => n.textContent), ['0of 8', '7of 8']);
  const rows = [...s.querySelectorAll('.dc-fp-table tbody tr')];
  assert.deepEqual(rows.map(r => r.cells[0].textContent),
    ['AI / LLM answers', 'Earned media', 'Owned channels', 'Social', 'Analyst coverage', 'Podcasts / video', 'Third-party discussion', 'Paid'],
    'highest first, ties alphabetical');
  assert.equal(rows.at(-1).className, 'is-absent');
  assert.deepEqual(rows.map(r => r.cells[4].textContent).slice(3, 5), ['Deliberate', 'Present'], 'the rubric band names');
  const seg = rows[3].querySelector('.dc-fp-seg');
  assert.equal(seg.getAttribute('aria-label'), '4 of 10');
  assert.equal(seg.querySelectorAll('i.on').length, 4);
  assert.ok(seg.children[6].classList.contains('t'), 'the conscious tick on the 7th segment');
});

test('a tie is broken alphabetically, not by data order', () => {
  const f = SEPA(); f.channels.social = lv(5);
  const names = [...fp(f).querySelectorAll('.dc-fp-table tbody tr')].slice(0, 4).map(r => r.cells[0].textContent);
  assert.deepEqual(names, ['AI / LLM answers', 'Earned media', 'Owned channels', 'Social']);
});

test('the corroboration sentence names the pairs, and says so when there are none', () => {
  const note = fp().querySelector('.dc-fp-note.is-body');
  assert.equal(note.textContent, 'Earned media ↔ Owned channels and Owned channels ↔ AI / LLM answers say the same thing. Earned media partly echoes Analyst coverage and Social.');
  assert.equal(note.querySelectorAll('b').length, 2);
  const none = SEPA(); none.links = [];
  assert.equal(fp(none).querySelector('.dc-fp-note.is-body').textContent, 'No channels corroborate each other yet.');
  assert.equal(fp(none).querySelectorAll('path.link').length, 0);
});

test('bad or duplicate links are dropped, keeping the stronger of a pair', () => {
  const links = fpLib.cleanLinks([
    { from: 'earned', to: 'owned', strength: 'weak' }, { from: 'owned', to: 'earned', strength: 'strong' },
    { from: 'earned', to: 'nowhere', strength: 'strong' }, { from: 'ai', to: 'ai', strength: 'strong' }, null,
  ]);
  assert.equal(links.length, 1);
  assert.equal(links[0].full, true);
});

test('the evidence behind each channel and each link stays on the page', () => {
  const f = SEPA();
  f.channels.owned.evidence = 'Research library, weekly newsletter';
  f.channels.paid.evidence = 'No evidence found';
  f.channels.social.evidence = 'No evidence found';
  f.links[0].note = 'Grid report framing carried into coverage.';
  const s = fp(f);
  const ev = [...s.querySelectorAll('.dc-fp-ev')].map(e => e.textContent);
  assert.deepEqual(ev, ['Research library, weekly newsletter'], 'the placeholder is not shown as evidence');
  assert.equal(s.querySelector('.dc-fp-ev').closest('td').firstChild.className, 'dc-fp-key is-brand');
  const notes = [...s.querySelectorAll('.dc-fp-note:not(.is-body)')].map(p => p.textContent);
  assert.ok(notes.includes('What connects them: Grid report framing carried into coverage.'));
});

test('the brand name splits nearest the middle and steps down when long', () => {
  assert.deepEqual(fpLib.coreLines('Smart Electric Power Alliance').map(l => [l.text, l.y, l.size]),
    [['Smart Electric', 282, ''], ['Power Alliance', 302, '']]);
  assert.deepEqual(fpLib.coreLines('Acme').map(l => [l.text, l.y]), [['Acme', 290]]);
  assert.equal(fpLib.coreLines('International Business Machines').at(-1).size, 'is-long');
  assert.equal(fpLib.coreLines('The Extraordinarily Long Named Renewable Cooperative').at(-1).size, 'is-longer');
  const core = fp(SEPA(), 'International Business Machines').querySelectorAll('text.core-l.is-long');
  assert.equal(core.length, 2);
});

test('the footprint carries no inline styles, animation or retired palette', () => {
  const html = fp().outerHTML;
  assert.ok(!/style=/.test(html), 'no inline styles');
  const src = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
  for (const gone of ['FP_INK', 'FP_LIME', 'FP_PAPER', 'dc-fpmap', 'dc-fp-line', 'Hover a channel']) assert.ok(!src.includes(gone), gone);
});

// ── Trust and credibility ────────────────────────────────────

const scoresWith = (vals) => {
  const s = {};
  rubric.ATTRIBUTES.forEach((a, i) => { s[a.id] = { score: vals[i], findings: 'f' }; });
  return s;
};
const SCORES = () => scoresWith([38, 44, 41, 36, 35, 33, 30, 32]);
const FINDINGS = [
  { text: 'Trade press cites its grid research.', tags: ['credibility', 'reputation'], supports: true },
  { text: 'Customer reviews flag slow support.', tags: ['trust'], supports: false },
];
const tl = (props = {}) => inSection(h(App.TrustLensPanel, { scores: SCORES(), findings: [], overall: 40, ...props }), 'trust-lens');

test('the lens section matches the design export element for element', () => {
  assert.deepEqual(sig(tl()), sig(design('15-trust-lens.html', 'trust-lens')));
});

test('reach and weight columns follow the notes', () => {
  const s = tl();
  const reach = [...s.querySelectorAll('.dc-reach .dc-weight')];
  assert.deepEqual(reach.map(b => b.querySelector('.dc-weight-ab').textContent), ['AWK', 'AWR', 'RFL', 'ATN', 'COG', 'SNT', 'VIS', 'INT']);
  const awr = reach[1];
  assert.ok(awr.classList.contains('is-full'));
  assert.equal(awr.querySelector('i').style.height, '100%');
  assert.equal(awr.getAttribute('aria-label'), 'Aware: feeds 4 of 4 lenses');
  assert.equal(reach[6].querySelector('.dc-weight-v').textContent, '1/4');
  assert.equal(s.querySelector('.dc-reach .dc-strong').textContent, 'Aware, Cogent and Intentional feed every lens.');

  const cred = s.querySelectorAll('.dc-lens:not(.dc-reach)')[0];
  assert.equal(cred.querySelector('.dc-h.is-card').textContent, 'Credibility');
  assert.equal(cred.querySelector('.dc-kicker').textContent, 'Led by Intentional, 35%');
  const cols = [...cred.querySelectorAll('.dc-weight')];
  assert.equal(cols[7].querySelector('i').style.height, '87.5%', '35 of a 40% ceiling');
  assert.equal(cols[7].getAttribute('aria-label'), 'Intentional: 35% weight');
  assert.ok(cols[2].classList.contains('is-zero'));
  assert.equal(cols[2].querySelector('.dc-weight-v').textContent, '0');
  const found = s.querySelector('.dc-lens.is-foundation.dc-panel-dark');
  assert.equal(found.querySelector('.dc-h.is-card').textContent, 'Authenticity');
  assert.equal(found.firstElementChild.textContent, 'Foundation');
});

test('the scale window sizes itself to the scores, and 25 to 50 is what the design sample produces', () => {
  assert.deepEqual(tlLib.scaleWindow([34, 38, 36, 41, 40]), { lo: 25, hi: 50, mid: 38 });
  const strong = tlLib.scaleWindow([72, 78, 75, 81, 77]);
  assert.ok(strong.lo >= 60 && strong.hi <= 90, 'a strong brand is not pinned to the edge of 25 to 50');
  const tight = tlLib.scaleWindow([50, 51, 52, 50, 51]);
  assert.equal(tight.hi - tight.lo, 20, 'never narrower than 20 points');
});

test('the scale marks the lens score and the Compass overall inside the window', () => {
  const v = tlLib.trustLensView(SCORES(), [], 40);
  const { lo, hi } = tlLib.scaleWindow([...v.rows, v.foundation].map(r => r.score).concat([40]));
  const s = tl();
  const scale = s.querySelector('.dc-lens:not(.dc-reach) .dc-scale');
  const at = (x) => `${Math.round(((x - lo) / (hi - lo)) * 10000) / 100}%`;
  assert.equal(scale.querySelector('b').style.left, at(40));
  assert.equal(scale.querySelector('i').style.left, at(v.rows[0].score));
  assert.deepEqual([...scale.querySelectorAll('.dc-scale-ticks span')].map(t => t.textContent), [lo, Math.round((lo + hi) / 2), hi].map(String));
  assert.equal(scale.querySelector('.dc-meta').textContent, `${lo}–${hi} scale · tick = Compass overall 40`);
  assert.equal(scale.getAttribute('aria-label'), `Credibility ${v.rows[0].score} on a ${lo} to ${hi} scale; Compass overall 40`);
});

test('clicking a column spotlights that attribute across all five rows, and again clears it', async () => {
  const container = document.createElement('div'); document.body.appendChild(container);
  const root = client.createRoot(container);
  await act(async () => { root.render(h(App.TrustLensPanel, { scores: SCORES(), findings: [], overall: 40 })); });
  const wrap = container.querySelector('.dc-lens-intro').nextElementSibling;
  assert.equal(wrap.getAttribute('data-spot'), null, 'resting state');
  const cog = container.querySelectorAll('.dc-reach .dc-weight')[4];
  cog.focus();
  await act(async () => { cog.click(); });
  assert.equal(wrap.getAttribute('data-spot'), 'COG');
  const pressed = [...container.querySelectorAll('.dc-weight[aria-pressed="true"]')];
  assert.equal(pressed.length, 5, 'one per row');
  assert.ok(pressed.every(b => b.querySelector('.dc-weight-ab').textContent === 'COG'));
  assert.equal(document.activeElement, cog, 'the column keeps focus: nothing remounts');
  await act(async () => { cog.click(); });
  assert.equal(wrap.getAttribute('data-spot'), null);
  assert.equal(container.querySelectorAll('.dc-weight[aria-pressed="true"]').length, 0);
  await act(async () => root.unmount());
});

test('what sits behind the scores: findings, the not-captured alert, or nothing for clients', () => {
  const none = tl().querySelector('.dc-behind');
  assert.equal(none.querySelector('.dc-alert strong').textContent, 'Findings not captured');
  const some = tl({ findings: FINDINGS }).querySelector('.dc-behind');
  assert.equal(some.querySelectorAll('.dc-finding').length, 2);
  assert.equal(some.querySelector('.dc-alert'), null);
  assert.equal(some.querySelectorAll('.dc-pill').length, 3);
  assert.equal(tl({ findings: FINDINGS, showFindings: false }).querySelector('.dc-behind'), null);
});

test('the lens panel carries only data-bound inline styles, no animation', () => {
  const s = tl({ findings: FINDINGS });
  const styled = [...s.querySelectorAll('[style]')];
  assert.ok(styled.every(el => /^(height|left):\s*[\d.]+%;?$/.test(el.getAttribute('style').trim())), 'only heights and positions');
  const src = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
  assert.ok(!src.includes('useCountUp'), 'the count-up is gone');
  const css = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8');
  assert.ok(css.includes('[data-spot] .dc-weight:not([aria-pressed="true"]) { opacity: .35; }'));
});

// ── In the reports ───────────────────────────────────────────

const fullScores = () => ({ ...SCORES(), headline: 'H', footprint: SEPA(), trustFindings: FINDINGS });

test('the full report renders 04 and 06 in their sections, collapsible', async () => {
  const container = document.createElement('div'); document.body.appendChild(container);
  const root = client.createRoot(container);
  const project = { brandName: 'Smart Electric Power Alliance', websiteUrl: 'https://sepa.org', industry: 'energy', businessModel: 'b2b', date: '2026-09-28' };
  await act(async () => {
    root.render(h(App.ReportPage, { project, setProject() {}, scores: fullScores(), setScores() {}, assessments: [], setAssessments() {},
      apiKey: '', onSave() {}, onPrev() {}, profile: { role: 'admin' }, compassResults: [] }));
  });
  const fpSec = container.querySelector('section.dc-section#footprint');
  const tlSec = container.querySelector('section.dc-section#trust-lens');
  assert.equal(fpSec.querySelector('.dc-sec-n').textContent, '04');
  assert.equal(tlSec.querySelector('.dc-sec-n').textContent, '06');
  assert.ok(fpSec.querySelector('svg.dc-fp-chart') && tlSec.querySelector('.dc-behind .dc-finding'));
  assert.equal(fpSec.querySelector('.animate-fade-in'), null);
  await act(async () => { tlSec.querySelector('.dc-sec-toggle').click(); });
  const after = container.querySelector('section#trust-lens');
  assert.equal(after.querySelector('.dc-sec-toggle').getAttribute('aria-expanded'), 'false');
  assert.equal(after.querySelector('.dc-lens'), null);
  await act(async () => root.unmount());
});

test('the client report shows both sections, without the findings', () => {
  const payload = App.makeClientPayload({ project: { brandName: 'SEPA', industry: 'energy' }, scores: fullScores(), benchmark: null });
  const doc = new JSDOM(server.renderToStaticMarkup(h(App.ClientReportView, { payload }))).window.document;
  const fpSec = doc.querySelector('section.dc-section#footprint');
  const tlSec = doc.querySelector('section.dc-section#trust-lens');
  assert.ok(fpSec && fpSec.querySelector('svg.dc-fp-chart'), 'footprint');
  assert.ok(tlSec && tlSec.querySelector('.dc-lens.is-foundation'), 'trust lens');
  assert.equal(tlSec.querySelector('.dc-behind'), null, 'findings stay internal');
  assert.ok(!JSON.stringify(payload).includes('slow support'), 'and never reach the payload');
});
