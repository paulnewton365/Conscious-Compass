// v3.97.2: the shared Dialog, the four dialogs rebuilt on it, the honest
// scoring screen, and the .card stop-gap.
// Run: node tests/support/build-render-bundle.mjs && node --test tests/
import { test, before, after } from 'node:test';
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

// Scoring starts intervals that outlive the component; track and clear them so
// the test process can exit.
const timers = new Set();
const realSet = globalThis.setInterval, realClear = globalThis.clearInterval;
globalThis.setInterval = (...a) => { const id = realSet(...a); timers.add(id); return id; };
globalThis.clearInterval = (id) => { timers.delete(id); return realClear(id); };
window.setInterval = globalThis.setInterval; window.clearInterval = globalThis.clearInterval;
after(() => { timers.forEach(id => realClear(id)); });

let React, client, act, App, h, rubric;
before(async () => {
  React = (await import('react')).default;
  client = await import('react-dom/client');
  act = React.act;
  h = (...a) => React.createElement(...a);
  App = await import('./.build/app.bundle.mjs');
  rubric = await import('../src/data/rubric.js');
});

async function mount(el) {
  const container = document.createElement('div'); document.body.appendChild(container);
  const root = client.createRoot(container);
  await act(async () => { root.render(el); });
  return { container, root, unmount: async () => { await act(async () => root.unmount()); container.remove(); } };
}
const key = (el, k, opts = {}) => el.dispatchEvent(new window.KeyboardEvent('keydown', { key: k, bubbles: true, ...opts }));

// ── Dialog ───────────────────────────────────────────────────

test('the dialog is a labelled modal that takes focus and gives it back', async () => {
  const opener = document.createElement('button'); opener.textContent = 'Open'; document.body.appendChild(opener); opener.focus();
  let closed = 0;
  const m = await mount(h(App.Dialog, { title: 'Language', subtitle: 'Wording only.', onClose: () => { closed++; } },
    h('input', { id: 'a' }), h('button', { id: 'b' }, 'Go')));
  const panel = document.querySelector('.dc-dialog');
  assert.equal(panel.getAttribute('role'), 'dialog');
  assert.equal(panel.getAttribute('aria-modal'), 'true');
  assert.equal(document.getElementById(panel.getAttribute('aria-labelledby')).textContent, 'Language');
  assert.equal(panel.parentElement.className, 'dc-dialog-backdrop');
  assert.equal(panel.parentElement.parentElement, document.body, 'portalled to the body');
  assert.equal(document.activeElement, panel, 'focus moves into the dialog');
  assert.equal(document.body.style.overflow, 'hidden', 'the page behind stops scrolling');
  await act(async () => { key(panel, 'Escape'); });
  assert.equal(closed, 1, 'Escape closes');
  await m.unmount();
  assert.equal(document.activeElement, opener, 'focus returns to the opener');
  assert.equal(document.body.style.overflow, '');
  opener.remove();
});

test('Tab stays inside the dialog', async () => {
  const m = await mount(h(App.Dialog, { title: 'T', onClose() {} }, h('input', { id: 'first-field' }), h('button', { id: 'last' }, 'Go')));
  const panel = document.querySelector('.dc-dialog');
  const close = panel.querySelector('.dc-dialog-x');
  const last = document.getElementById('last');
  last.focus();
  await act(async () => { key(panel, 'Tab'); });
  assert.equal(document.activeElement, close, 'forward from the last wraps to the first');
  await act(async () => { key(panel, 'Tab', { shiftKey: true }); });
  assert.equal(document.activeElement, last, 'back from the first wraps to the last');
  await m.unmount();
});

test('a busy dialog cannot be closed by Escape, the backdrop or a close button', async () => {
  let closed = 0;
  const m = await mount(h(App.Dialog, { title: 'T', busy: true, onClose: () => { closed++; } }, h('p', null, 'Working')));
  const panel = document.querySelector('.dc-dialog');
  assert.equal(panel.querySelector('.dc-dialog-x'), null);
  await act(async () => { key(panel, 'Escape'); });
  await act(async () => { panel.parentElement.dispatchEvent(new window.MouseEvent('mousedown', { bubbles: true })); });
  assert.equal(closed, 0);
  await m.unmount();
});

test('a click on the backdrop closes it; a click inside does not', async () => {
  let closed = 0;
  const m = await mount(h(App.Dialog, { title: 'T', onClose: () => { closed++; } }, h('p', { id: 'inside' }, 'x')));
  await act(async () => { document.getElementById('inside').dispatchEvent(new window.MouseEvent('mousedown', { bubbles: true })); });
  assert.equal(closed, 0);
  await act(async () => { document.querySelector('.dc-dialog-backdrop').dispatchEvent(new window.MouseEvent('mousedown', { bubbles: true })); });
  assert.equal(closed, 1);
  await m.unmount();
});

// ── The four dialogs ─────────────────────────────────────────

test('Challenge, Language and Client link all render on the shared dialog, with labelled fields', async () => {
  const cases = [
    [App.ChallengeModal, { brandName: 'MKB', onClose() {}, onSubmit() {}, busy: false }, 'Challenge the assessment', 5],
    [App.LanguageModal, { brandName: 'MKB', onClose() {}, onApply() {}, onRevert() {}, busy: false, existing: null, canRevert: false }, 'Language', 1],
    [App.ClientLinkModal, { brandName: 'MKB', buildPayload: () => ({}), onClose() {}, profile: { full_name: 'Paul Newton' } }, 'Client link', 3],
  ];
  for (const [C, props, title, fields] of cases) {
    const m = await mount(h(C, props));
    const panel = document.querySelector('.dc-dialog');
    assert.ok(panel, `${title} uses the shared dialog`);
    assert.equal(panel.querySelector('h2.dc-h').textContent, title);
    assert.equal(document.querySelector('.card'), null, `${title} no longer uses the unstyled .card`);
    assert.ok(panel.querySelector('.dc-alert'), `${title} explains itself in an alert`);
    const controls = [...panel.querySelectorAll('textarea, input:not([type="range"])')].filter(el => el.id);
    assert.ok(controls.length >= fields, `${title} has its fields`);
    controls.forEach(el => assert.ok(panel.querySelector(`label[for="${el.id}"]`), `${title}: ${el.id} has a label`));
    assert.ok(panel.querySelector('.dc-dialog-foot .btn-primary'));
    await m.unmount();
  }
});

test('the challenge shows its real progress while it runs', async () => {
  const m = await mount(h(App.ChallengeModal, { brandName: 'MKB', onClose() {}, onSubmit() {}, busy: true, stage: 'Revising the website readout...', progress: 40 }));
  const status = document.querySelector('.dc-dialog-status');
  assert.equal(status.getAttribute('role'), 'status');
  assert.equal(status.querySelector('.dc-bar > i').style.width, '40%');
  assert.ok(status.textContent.includes('Revising the website readout...'));
  await m.unmount();
});

test('the Client link dialog names every section the client view renders', () => {
  const src = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
  const start = src.indexOf('function ClientReportView(');
  const view = src.slice(start, src.indexOf('\nfunction ', start + 10));
  const heads = [...view.matchAll(/<SectionHeading order=\{clientSections\} label="([^"]+)"/g)].map(m => m[1].toLowerCase());
  assert.ok(heads.length >= 8, 'found the client view sections');
  const named = App.CLIENT_REPORT_SECTIONS.join(' | ');
  heads.forEach(hd => assert.ok(named.includes(hd), `the dialog names "${hd}"`));
});

// ── Scoring screen ───────────────────────────────────────────

const project = { brandName: 'MKB', websiteUrl: 'https://mkb.com', industry: 'energy', businessModel: 'b2b', date: '2026-09-28' };
const READOUTS = { website: { content: 'Site readout.' }, social: { content: 'Social readout.' },
  aiReputation: { content: 'AI readout.' }, earnedMedia: { content: 'Earned readout.' } };
const reportProps = (apiKey) => ({ project, setProject() {}, scores: null, setScores() {}, assessments: READOUTS, setAssessments() {},
  apiKey, onSave() {}, onPrev() {}, profile: { role: 'admin' }, compassResults: [] });

test('before scoring, the report step is a dc page with one clear action', async () => {
  globalThis.fetch = () => new Promise(() => {});
  const m = await mount(h(App.ReportPage, reportProps('')));
  const page = m.container.querySelector('[data-screen="scoring"]');
  assert.ok(page.classList.contains('dc-page'));
  assert.equal(page.querySelector('.dc-page-head .dc-kicker').textContent, 'Step 6 of 6 · Report');
  assert.equal(page.querySelector('h1.dc-display').textContent, 'Generate the report');
  assert.equal(page.querySelector('.card'), null);
  const go = [...page.querySelectorAll('button')].find(b => b.textContent === 'Generate the report');
  assert.ok(go);
  await act(async () => { go.click(); });
  const err = page.querySelector('.dc-alert.is-error');
  assert.ok(err && err.textContent.includes('API key is required'), 'errors show as a dc alert');
  await m.unmount();
});

test('while scoring, the screen shows real elapsed time, the packet 18 stage list, three pass tracks and what is going in', async () => {
  globalThis.fetch = () => new Promise(() => {});   // the scoring call never returns here
  const m = await mount(h(App.ReportPage, reportProps('sk-test')));
  const go = [...m.container.querySelectorAll('button')].find(b => b.textContent === 'Generate the report');
  await act(async () => { go.click(); });
  await act(async () => { await new Promise(r => setTimeout(r, 450)); });   // one live tick
  const page = m.container.querySelector('[data-screen="scoring"]');
  const sc = page.querySelector('.dc-scoring');
  assert.equal(sc.querySelector('.dc-page-head h1.dc-display').textContent, 'Reading the evidence.');
  assert.equal(sc.querySelector('.dc-page-head .dc-kicker').textContent, 'Scoring · MKB');
  const prog = sc.querySelector('.dc-scoring-progress');
  assert.equal(prog.getAttribute('role'), 'status');
  assert.match(prog.querySelector('.dc-scoring-count').textContent, /^0:0\d\s*elapsed$/, 'real elapsed time');
  assert.equal(prog.querySelector('.dc-lens-bar').getAttribute('aria-hidden'), 'true');
  const stages = [...page.querySelectorAll('.dc-passes > li')].map(li => li.querySelector('b').textContent);
  assert.deepEqual(stages, ['Trust lens', 'Six principles', 'Footprint', 'Campaign coherence', 'Eight attributes', 'Earned creative']);
  assert.equal(page.querySelectorAll('.dc-scoring-tracks > li').length, 3, 'one track per pass');
  assert.equal(page.querySelectorAll('.dc-rollcall > li').length, 8, 'the roll call names all eight');
  assert.equal(page.querySelectorAll('.dc-rollcall li.is-scored').length, 0, 'nothing is marked scored before a pass reaches it');
  const going = [...page.querySelectorAll('.dc-scoring-inputs > li b')].map(b => b.textContent);
  assert.deepEqual(going, ['Website', 'Social', 'AI reputation', 'Earned media']);
  const text = page.textContent;
  assert.ok(!/% complete/.test(text), 'no percentage');
  for (const claim of ['Absorbing', '12 articles', 'You can leave this page']) assert.ok(!text.includes(claim), `no invented claim: ${claim}`);
  assert.ok(text.includes('Leave this page open until it finishes'));
  await m.unmount();
});

test('end to end: streamed passes move the roll call, two that agree finish early, and the report gets their median', async () => {
  const ids = ['AWAKE', 'AWARE', 'REFLECTIVE', 'ATTENTIVE', 'COGENT', 'SENTIENT', 'VISIONARY', 'INTENTIONAL'];
  let call = 0;
  const gates = [];
  globalThis.fetch = window.fetch = async (url, init) => {
    const body = JSON.parse(init.body);
    if (!String(url).includes('/api/claude') || !body.stream) return new Promise(() => {});   // stories, other calls
    const n = call++;
    const answer = JSON.stringify({ headline: 'H', campaignCoherence: { level: 2 }, earnedCreative: { activations: [] },
      ...Object.fromEntries(ids.map(id => [id, { score: 50 + n, findings: 'f', impact: 'i', actions: 'a' }])) });
    const half = answer.indexOf('"COGENT"');
    let release;
    const gate = new Promise(r => { release = r; });
    gates.push(release);
    const enc = new TextEncoder();
    const ev = (o) => enc.encode(`event: ${o.type}\ndata: ${JSON.stringify(o)}\n\n`);
    const stream = new ReadableStream({
      async start(ctl) {
        ctl.enqueue(ev({ type: 'message_start', message: { usage: { input_tokens: 9000 } } }));
        ctl.enqueue(ev({ type: 'content_block_delta', delta: { type: 'text_delta', text: answer.slice(0, half) } }));
        if (n === 2) return;   // the third pass stalls halfway and never finishes
        await gate;
        ctl.enqueue(ev({ type: 'content_block_delta', delta: { type: 'text_delta', text: answer.slice(half) } }));
        ctl.enqueue(ev({ type: 'message_delta', delta: { stop_reason: 'end_turn' }, usage: { output_tokens: 5000 } }));
        ctl.close();
      },
    });
    return new Response(stream, { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
  };
  let saved = null;
  const props = { ...reportProps('sk-test'), setScores: (v) => { saved = typeof v === 'function' ? v(saved) : v; } };
  const m = await mount(h(App.ReportPage, props));
  const go = [...m.container.querySelectorAll('button')].find(b => b.textContent === 'Generate the report');
  await act(async () => { go.click(); });
  await act(async () => { await new Promise(r => setTimeout(r, 500)); });
  const page = () => m.container.querySelector('[data-screen="scoring"]');
  const partial = [...page().querySelectorAll('.dc-rollcall li.is-scored')].map(li => li.dataset.attr);
  assert.deepEqual(partial, ['AWAKE', 'AWARE', 'REFLECTIVE', 'ATTENTIVE'], 'halfway: the first four reached by every pass');
  assert.equal(page().querySelector('[data-stage="attributes"]').className, 'is-current');
  assert.ok(!page().textContent.match(/\b5[0-2]\b/), 'no score is shown while waiting');
  await act(async () => { gates.forEach(g => g()); await new Promise(r => setTimeout(r, 500)); });
  assert.equal(page().querySelector('.dc-scoring-tracks li[data-pass="3"] .dc-meta').textContent, 'Not needed');
  assert.match(page().querySelector('[data-field="scoring-stage"]').textContent, /first two passes agreed/);
  await act(async () => { await new Promise(r => setTimeout(r, 1500)); });
  assert.ok(saved, 'the report was set');
  assert.equal(saved.AWAKE.score, 51, 'median of 50 and 51, rounded');
  assert.equal(saved.consensus.early, true);
  assert.deepEqual(saved.consensus.timing.passes.map(p => p.status), ['used', 'used', 'skipped']);
  assert.equal(saved.consensus.timing.passes[0].outputTokens, 5000);
  await m.unmount();
});

test('the invented stage labels are gone from the code, and the clock-driven trickle with them', () => {
  const src = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
  for (const gone of ['const stageFor', 'setScoringStage', 'Absorbing website data', '% complete', 'prog + (95 - prog) * 0.045']) assert.ok(!src.includes(gone), gone);
});

// ── Stylesheet ───────────────────────────────────────────────

test('.card is styled again, inside the components layer, and dialog fields share the page field rules', () => {
  const css = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8');
  const at = css.indexOf('.card { background: var(--cc-paper)');
  assert.ok(at > 0, 'the stop-gap rule exists');
  let depth = 0;
  for (const ch of css.slice(0, at)) { if (ch === '{') depth++; if (ch === '}') depth--; }
  assert.equal(depth, 1, 'inside @layer components, so Tailwind utilities still win');
  assert.match(css, /\.dc-dialog input\[type="password"\]/);
  assert.match(css, /\.dc-dialog-backdrop \{[^}]*position: fixed/);
});
