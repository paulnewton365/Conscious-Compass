// Report section 05, campaign coherence, rebuilt to the design packet (v3.96).
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
globalThis.ResizeObserver ||= class { observe() {} unobserve() {} disconnect() {} };
globalThis.IntersectionObserver ||= class { observe() {} unobserve() {} disconnect() {} };
window.IntersectionObserver ||= globalThis.IntersectionObserver;
window.scrollTo = () => {};

let React, server, client, act, App, view, rubric, h;
before(async () => {
  React = (await import('react')).default;
  server = await import('react-dom/server');
  client = await import('react-dom/client');
  act = React.act;
  h = (...a) => React.createElement(...a);
  App = await import('./.build/app.bundle.mjs');
  view = await import('../src/lib/campaignCoherence.js');
  rubric = await import('../src/data/rubric.js');
});

// The packet's MKB sample, as the scoring pass would return it.
const MKB = {
  level: 1, levelName: 'Themed', confidence: 'medium',
  verdict: 'MKB runs well-produced campaigns that look alike, but each one argues something different, so none of them builds on the last.',
  rationale: 'The same visual system and sign-off appear across paid social, email and the website, but the message changes with each campaign.',
  toNextLevel: 'Choose one idea for the next launch and carry it, not only the look, into every channel that launch touches.',
  campaigns: [
    { name: "Built for What's Next", channels: ['Paid social', 'Website'], idea: 'MKB helps growing firms plan past the next quarter.', evidence: 'A spring campaign of six LinkedIn ads and a landing page.' },
    { name: 'Year-End Readiness', channels: ['Email', 'Website', 'Events'], idea: 'A checklist that takes the stress out of closing the year.', evidence: 'A four-email series, a downloadable guide and one webinar.' },
    { name: 'People of MKB', channels: ['Social'], idea: 'The team behind the work.', evidence: 'Monthly staff profiles on Instagram and LinkedIn.' },
  ],
};
const at = (level, extra = {}) => ({ ...MKB, level, ...extra });
const render = (props) => {
  const html = server.renderToStaticMarkup(h('section', { className: 'dc-section' }, h(App.CampaignCoherencePanel, props)));
  return new JSDOM(html).window.document.querySelector('section');
};

// ── View model ───────────────────────────────────────────────

test('names and definitions come from the rubric ladder the brand was scored against', () => {
  for (const rung of rubric.CAMPAIGN_LADDER) {
    const v = view.campaignCoherenceView(at(rung.level));
    assert.equal(v.name, rung.name);
    assert.equal(v.definition, rung.summary);
  }
});

test('the scale states follow the level: reached below, current at, nothing above', () => {
  const states = (l) => view.campaignCoherenceView(at(l)).scale.map(s => s.state);
  assert.deepEqual(states(1), ['current', null, null, null, null]);
  assert.deepEqual(states(3), ['reached', 'reached', 'current', null, null]);
  assert.deepEqual(states(5), ['reached', 'reached', 'reached', 'reached', 'current']);
  assert.deepEqual(states(0), [null, null, null, null, null], 'level 0 sits below the first step');
});

test('level 0 reads as below level 1, and asks for level 1 next', () => {
  const v = view.campaignCoherenceView(at(0));
  assert.equal(v.kicker, 'Below level 1');
  assert.equal(v.name, 'Ad hoc');
  assert.ok(v.notes.some(n => n.label === 'To reach level 1'));
});

test('level 5 drops the "To reach" column, even if the model wrote one', () => {
  const v = view.campaignCoherenceView(at(5));
  assert.deepEqual(v.notes.map(n => n.label), ['Why this level', 'Confidence']);
});

test('the confidence basis is counted from the campaigns returned, never model text', () => {
  assert.equal(view.campaignCoherenceView(MKB).notes.at(-1).text, 'Medium. Based on 3 campaigns found across 5 channels.');
  const one = view.campaignCoherenceView(at(1, { confidence: 'HIGH', campaigns: [{ name: 'A', channels: ['Web', 'web '] }] }));
  assert.equal(one.notes.at(-1).text, 'High. Based on 1 campaign found across 1 channel.', 'channels are counted once each');
  const none = view.campaignCoherenceView(at(0, { confidence: 'low', campaigns: [] }));
  assert.equal(none.notes.at(-1).text, 'Low. No campaigns found in the sources reviewed.');
  assert.ok(!view.campaignCoherenceView(at(2, { confidence: '' })).notes.some(n => n.label === 'Confidence'));
});

test('an unscored or level-less object yields nothing to render', () => {
  for (const c of [null, undefined, {}, { level: null }, { level: '' }, { level: 'x' }]) {
    assert.equal(view.campaignCoherenceView(c), null);
  }
  assert.equal(view.campaignCoherenceView({ level: 9 }).level, 5, 'out-of-range levels clamp');
});

// ── Rendered panel ───────────────────────────────────────────

test('the panel matches the design export element for element', () => {
  const design = new JSDOM(readFileSync(new URL('./fixtures/design/14-campaign-coherence.html', import.meta.url), 'utf8'))
    .window.document.querySelector('section#campaign-coherence');
  const ours = render({ coherence: MKB });
  // tag, classes and aria-current for every element, in order
  const sig = (root) => [...root.querySelectorAll('*')]
    .filter(el => !el.closest('.dc-sec-toggle'))
    .map(el => `${el.tagName.toLowerCase()}.${[...el.classList].sort().join('.')}${el.getAttribute('aria-current') ? '[current]' : ''}`);
  assert.deepEqual(sig(ours), sig(design));
  // the data-bound text lands where the design puts it
  assert.equal(ours.querySelector('.dc-cc-level .dc-kicker').textContent, 'Level 1 of 5');
  assert.equal(ours.querySelector('.dc-cc-verdict').textContent, MKB.verdict);
  assert.equal(ours.querySelector('.dc-cc-scale').getAttribute('aria-label'), 'Campaign coherence: level 1 of 5, Themed');
  assert.equal(ours.querySelector('.dc-cc-head .dc-meta').textContent, '3 campaigns');
  assert.deepEqual([...ours.querySelectorAll('.dc-cc-notes .dc-kicker')].map(k => k.textContent), ['Why this level', 'To reach level 2', 'Confidence']);
  assert.equal(ours.querySelectorAll('.dc-cc-card').length, 3);
  assert.equal(ours.querySelector('.dc-cc-idea .dc-kicker').textContent, 'Idea');
});

test('level 3 marks two steps reached and one current, with aria-current on it', () => {
  const s = render({ coherence: at(3) });
  const lis = [...s.querySelectorAll('.dc-cc-scale li')];
  assert.deepEqual(lis.map(li => li.className), ['is-reached', 'is-reached', 'is-current', '', '']);
  assert.equal(s.querySelectorAll('[aria-current="step"]').length, 1);
  assert.equal(lis[2].getAttribute('aria-current'), 'step');
});

test('level 0 renders no current step', () => {
  const s = render({ coherence: at(0) });
  assert.equal(s.querySelectorAll('.is-current, .is-reached, [aria-current]').length, 0);
  assert.equal(s.querySelector('.dc-cc-level .dc-kicker').textContent, 'Below level 1');
});

test('zero campaigns keeps the head and says so', () => {
  const s = render({ coherence: at(1, { campaigns: [] }) });
  assert.equal(s.querySelector('.dc-cc-head .dc-meta').textContent, '0 campaigns');
  assert.equal(s.querySelector('.dc-cc-campaigns'), null);
  assert.equal(s.querySelector('.dc-stack > p.dc-meta').textContent, 'No campaigns found in the sources reviewed.');
});

test('unscored shows the alert in place of everything, with a working Regenerate', async () => {
  let clicked = 0;
  const container = document.createElement('div'); document.body.appendChild(container);
  const root = client.createRoot(container);
  await act(async () => { root.render(h(App.CampaignCoherencePanel, { coherence: null, onRegenerate: () => { clicked++; } })); });
  const alert = container.querySelector('.dc-alert[data-cc-panel="missing"]');
  assert.ok(alert);
  assert.equal(alert.querySelector('strong').textContent, 'Not scored yet');
  assert.equal(container.querySelector('.dc-cc, .dc-cc-scale'), null);
  await act(async () => { alert.querySelector('button').click(); });
  assert.equal(clicked, 1);
  await act(async () => root.unmount());
});

test('no animation, no Tailwind and no inline styles remain in the section', () => {
  const html = render({ coherence: MKB }).outerHTML;
  assert.ok(!/style=/.test(html));
  assert.ok(!/bg-\[|text-\[|animate-/.test(html));
  const src = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
  assert.ok(!src.includes('CampaignLadder'), 'the old animated ladder is gone');
});

// ── Client report ────────────────────────────────────────────

const fullScores = () => {
  const s = { headline: 'H', campaignCoherence: { ...MKB, appliedAt: '2026-09-28T00:00:00Z', frameworkVersion: '2.10' } };
  rubric.ATTRIBUTES.forEach(a => { s[a.id] = { score: 55, findings: 'f', impact: 'i' }; });
  return s;
};

test('the client payload still carries only level, verdict, rationale and next step', () => {
  const payload = App.makeClientPayload({ project: { brandName: 'MKB', industry: 'energy' }, scores: fullScores(), benchmark: null });
  assert.deepEqual(Object.keys(payload.scores.campaignCoherence).sort(), ['level', 'rationale', 'toNextLevel', 'verdict']);
  const json = JSON.stringify(payload);
  for (const leak of ['Year-End Readiness', 'People of MKB', 'appliedAt', '"confidence":"medium"']) assert.ok(!json.includes(leak), leak);
});

test('the client view renders the shared panel without campaigns or confidence', () => {
  const payload = App.makeClientPayload({ project: { brandName: 'MKB', industry: 'energy' }, scores: fullScores(), benchmark: null });
  const doc = new JSDOM(server.renderToStaticMarkup(h(App.ClientReportView, { payload }))).window.document;
  const sec = doc.querySelector('section#campaign-coherence');
  assert.ok(sec, 'section 05 is present');
  assert.equal(sec.querySelector('.dc-cc-name').textContent, 'Themed');
  assert.equal(sec.querySelectorAll('.dc-cc-scale li.is-current').length, 1);
  assert.deepEqual([...sec.querySelectorAll('.dc-cc-notes .dc-kicker')].map(k => k.textContent), ['Why this level', 'To reach level 2']);
  assert.equal(sec.querySelector('.dc-cc-campaigns, .dc-cc-head'), null);
});

test('the client view omits the section when no level was scored', () => {
  const s = fullScores(); delete s.campaignCoherence;
  const payload = App.makeClientPayload({ project: { brandName: 'MKB', industry: 'energy' }, scores: s, benchmark: null });
  assert.ok(!server.renderToStaticMarkup(h(App.ClientReportView, { payload })).includes('campaign-coherence'));
});

// ── Full report ──────────────────────────────────────────────

async function mountReport(scores) {
  const container = document.createElement('div'); document.body.appendChild(container);
  const root = client.createRoot(container);
  const project = { brandName: 'MKB', websiteUrl: 'https://mkb.com', industry: 'energy', businessModel: 'b2b', date: '2026-09-28' };
  await act(async () => {
    root.render(h(App.ReportPage, { project, setProject() {}, scores, setScores() {}, assessments: [], setAssessments() {},
      apiKey: '', onSave() {}, onPrev() {}, profile: { role: 'admin' }, compassResults: [] }));
  });
  return { container, root };
}

test('the full report renders section 05 between footprint and trust, collapsible', async () => {
  const { container, root } = await mountReport(fullScores());
  const sec = container.querySelector('section#campaign-coherence');
  assert.ok(sec, 'the section is rendered');
  const toggle = sec.querySelector('.dc-sec-toggle');
  assert.equal(toggle.querySelector('.dc-sec-n').textContent, '05');
  assert.equal(toggle.getAttribute('aria-expanded'), 'true');
  const heads = [...container.querySelectorAll('.dc-sec-toggle .dc-h')].map(e => e.textContent);
  assert.equal(heads[heads.indexOf('Campaign coherence') + 1], 'Trust and credibility', 'trust follows it');
  assert.equal(sec.querySelectorAll('.dc-cc-card').length, 3, 'the internal report lists campaigns');
  assert.ok(sec.querySelector('.dc-cc-notes').textContent.includes('Based on 3 campaigns'));
  await act(async () => { toggle.click(); });
  // SectionHead is declared inside ReportPage, so the button remounts: re-query
  const after = container.querySelector('section#campaign-coherence');
  assert.equal(after.querySelector('.dc-sec-toggle').getAttribute('aria-expanded'), 'false');
  assert.equal(after.querySelector('.dc-cc'), null, 'hidden when collapsed');
  await act(async () => root.unmount());
});

test('the full report shows the not-scored alert, with no toggle, for an unscored report', async () => {
  const s = fullScores(); delete s.campaignCoherence;
  const { container, root } = await mountReport(s);
  const sec = container.querySelector('section#campaign-coherence');
  assert.ok(sec.querySelector('.dc-alert strong').textContent.includes('Not scored yet'));
  assert.ok(sec.querySelector('.dc-alert button'), 'Regenerate is offered');
  assert.equal(sec.querySelector('.dc-sec-toggle').getAttribute('aria-expanded'), null);
  await act(async () => root.unmount());
});

// ── Stylesheet ───────────────────────────────────────────────

test('the stylesheet carries the packet block verbatim and the new reach tone', () => {
  const css = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8');
  for (const c of ['.dc-cc {', '.dc-cc-scale li.is-current i', '.dc-cc-notes {', '.dc-cc-campaigns {', '.dc-cc-card {']) assert.ok(css.includes(c), c);
  assert.ok(css.includes('.dc-reach .dc-weight-col > i { background: var(--cc-faint); }'));
  const src = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
  assert.ok(src.includes("count === 0 ? RULE : '#8A8E95'"), 'the rendered reach columns use the faint tone');
});
