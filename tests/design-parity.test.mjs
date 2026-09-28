// Every screen is measured against the design export: what share of the
// design's classes our markup actually renders. Header classes are excluded,
// since the page components do not render the header.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { existsSync } from 'node:fs';

const EXPORT = process.env.DESIGN_EXPORT || '/home/claude/ui5/export';
const HEADER = new Set(['dc-header', 'dc-wordmark', 'dc-nav-links', 'dc-menu-btn', 'btn-sm', 'btn-secondary']);

const dom = new JSDOM('<!doctype html><body></body>', { url: 'https://x.test/' });
globalThis.window = dom.window; globalThis.document = dom.window.document;
for (const k of ['HTMLElement', 'HTMLAnchorElement', 'HTMLCanvasElement', 'HTMLImageElement', 'Image', 'Node', 'Element', 'SVGElement', 'CSS', 'getComputedStyle', 'requestAnimationFrame', 'cancelAnimationFrame', 'MutationObserver', 'Blob', 'FileReader', 'URL', 'localStorage']) {
  if (!(k in globalThis) && k in dom.window) globalThis[k] = dom.window[k];
}
globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
globalThis.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
globalThis.fetch = async () => ({ ok: true, json: async () => ({}), text: async () => '' });

const skip = !existsSync(`${EXPORT}/screens/12-welcome.html`);

test('Welcome renders the design\'s own markup', { skip: skip && 'design export not present' }, async () => {
  const React = (await import('react')).default;
  const server = await import('react-dom/server');
  const App = await import('./.build/app.bundle.mjs');
  const { compare, designFile } = await import('./support/dom-diff.mjs');
  const html = server.renderToStaticMarkup(React.createElement(App.WelcomePage, { onStart() {} }));
  const r = compare(html, designFile('12-welcome.html'));
  const missing = r.missing.filter(c => !HEADER.has(c));
  assert.deepEqual(missing, [], `the design uses these and we do not render them: ${missing.join(', ')}`);
  // and the structure, not just the class list
  ['dc-hero', 'dc-badge', 'dc-steps3', 'dc-version'].forEach(c => assert.ok(html.includes(c), c));
  assert.ok(html.includes('dc-display is-hero'), 'the hero takes the display serif');
});
