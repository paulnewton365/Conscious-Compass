// About content is found by following the site's own links, not by guessing
// /about (v4.20.2, teaser method 2.9).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as ac from '../src/lib/aboutContent.js';
import { gatherWebsite, buildTeaserScoringPrompt, TEASER_VERSION } from '../src/lib/teaser.js';

const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const scrapeSrc = readFileSync(new URL('../api/scrape.js', import.meta.url), 'utf8');
const LONG = 'Substantive evidence text about the brand that is comfortably longer than forty characters.';

test('links come from the reader summary and from markdown in the page', () => {
  const links = ac.extractLinks({
    links: { 'Our Story': 'https://acme.com/our-story', Contact: 'https://acme.com/contact' },
    content: 'Welcome. [Mission](https://acme.com/mission "Mission") and ![logo](https://acme.com/l.png) [Our Story](https://acme.com/our-story/)',
  });
  assert.deepEqual(links.map(l => l.url), ['https://acme.com/our-story', 'https://acme.com/contact', 'https://acme.com/mission']);
  assert.deepEqual(ac.extractLinks({ links: [{ text: 'About', url: 'https://a.com/about' }] }), [{ text: 'About', url: 'https://a.com/about' }]);
});

test('the about page is chosen by what the link says and where it points, on the brand\'s own site', () => {
  const links = [
    { text: 'Blog', url: 'https://acme.com/blog' },
    { text: 'Who we are', url: 'https://www.acme.com/company-overview' },
    { text: 'Our Story', url: 'https://acme.com/our-story' },
    { text: 'About', url: 'https://other.com/about' },
    { text: 'Careers', url: 'https://acme.com/careers' },
    { text: 'Jane Doe', url: 'https://acme.com/team/leadership/jane-doe' },
    { text: 'Privacy', url: 'https://acme.com/privacy' },
    { text: 'Home', url: 'https://acme.com/' },
  ];
  const picked = ac.pickAboutLinks(links, 'https://acme.com');
  // Link text and address agreeing ranks first; other brands, blog, careers,
  // privacy, deep pages and the homepage are never picked.
  assert.deepEqual(picked.map(p => p.url), ['https://acme.com/our-story', 'https://www.acme.com/company-overview']);
  // No about-like link at all: nothing is invented.
  assert.deepEqual(ac.pickAboutLinks([{ text: 'Shop', url: 'https://acme.com/shop' }], 'https://acme.com'), []);
});

test('an error page is recognised, a real page is not', () => {
  assert.equal(ac.looksNotFound({ warning: 'Target URL returned error 404: Not Found' }), true);
  assert.equal(ac.looksNotFound({ title: 'Page not found | Acme' }), true);
  assert.equal(ac.looksNotFound({ text: 'Oops! The page you are looking for could not be found. Go back home.' }), true);
  assert.equal(ac.looksNotFound({ title: 'About Acme', text: `Our story began in 2010. ${LONG}` }), false);
  // A long page that mentions "not found" deep in its text is still a page.
  assert.equal(ac.looksNotFound({ title: 'Help', text: `${'Real content. '.repeat(300)} Error 404 explained.` }), false);
});

const mockFetch = (pages) => async (url) => {
  const u = new URL(url, 'https://app.test');
  const target = u.searchParams.get('url');
  const page = pages[target];
  if (!page) return { ok: false, json: async () => ({ error: 'HTTP 404' }) };
  return { ok: true, json: async () => page };
};

test('the teaser follows the site\'s own link to its story, and never guesses /about when links exist', async () => {
  const seen = [];
  const pages = {
    'https://acme.com': { text: `Acme home. ${LONG}`, links: [{ text: 'Our Story', url: 'https://acme.com/our-story' }, { text: 'Blog', url: 'https://acme.com/blog' }] },
    'https://acme.com/our-story': { text: `Founded in 2010 to fix the grid. ${LONG}`, links: [] },
  };
  const fetchImpl = async (url) => { seen.push(new URL(url, 'https://app.test').searchParams.get('url')); return mockFetch(pages)(url); };
  const w = await gatherWebsite({ websiteUrl: 'acme.com' }, fetchImpl);
  assert.deepEqual(w.pages.map(p => p.url), ['https://acme.com', 'https://acme.com/our-story']);
  assert.ok(!seen.includes('https://acme.com/about'), 'no guessed address was requested');
  assert.deepEqual(w.about, { found: 'page', url: 'https://acme.com/our-story', via: 'navigation', linkText: 'Our Story' });
  assert.ok(!('links' in w.pages[0]), 'link lists are not stored with the evidence');
});

test('guessed addresses only without links, and an error page is never kept', async () => {
  const pages = {
    'https://acme.com': { text: `Acme home.\n\nWho we are\n\nWe build batteries. ${LONG}` },
    'https://acme.com/about': { text: 'Page not found. The page you are looking for could not be found.', notFound: true },
  };
  const w = await gatherWebsite({ websiteUrl: 'acme.com' }, mockFetch(pages));
  assert.deepEqual(w.pages.map(p => p.url), ['https://acme.com']);
  assert.equal(w.about.found, 'homepage', 'the story on the homepage counts');
  assert.equal(w.about.via, 'guessed');
});

test('the scoring is told how pages were chosen and not to read a missing address as a broken link', () => {
  const prompt = buildTeaserScoringPrompt({ brandName: 'Acme', websiteUrl: 'acme.com', businessModel: 'b2b' }, { sources: { website: { status: 'ok', pages: [{ url: 'https://acme.com', text: LONG }], about: { found: 'none', url: 'https://acme.com', via: 'navigation', linkText: null } } } });
  assert.match(prompt, /ABOUT CONTENT: not found among the pages read; it may sit under a name or page this pass did not reach\./);
  assert.match(prompt, /by following the links the site itself shows, not by guessing addresses/);
  assert.match(prompt, /Do not infer a broken link, a missing page or a functional failure from an address that is not listed here\./);
  assert.equal(TEASER_VERSION, '2.9');
  // The full assessment's website auto-assess carries the same rule.
  assert.ok(app.includes('Never report an address you guessed, such as /about, as a broken link or a missing page'));
  // The scraper returns links and flags error pages.
  assert.ok(scrapeSrc.includes("'X-With-Links-Summary': 'true'"));
  assert.ok(scrapeSrc.includes('notFound: looksNotFound({ warning: data.warning, title: data.title, text: plain }),'));
});
