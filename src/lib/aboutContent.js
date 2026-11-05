// Finding a brand's about content (v4.20.2, teaser method 2.9).
//
// The teaser used to guess four addresses (/about, /about-us, /company,
// /who-we-are). A brand whose story lives at /our-story, /mission, /team or on
// the homepage got its guesses back as error pages, and the scoring read
// "the /about URL returns a 404" as a broken navigation link and marked
// ATTENTIVE down. Nothing on the site linked to /about: we invented it.
//
// Now the homepage is read with its links, and the pages followed are the
// ones the site itself links to, chosen by what the link says and where it
// points. Guessed addresses are a last resort when no links come back, and an
// error page is never kept as evidence. Shared by api/scrape.js and teaser.js.

// Link text and paths that lead to about content, strongest first.
const ABOUT_TERMS = [
  [/\babout(\s+us)?\b/, 10], [/\bwho\s+we\s+are\b/, 10], [/\bour\s+story\b/, 9], [/\bour\s+company\b/, 8],
  [/\bcompany\b/, 6], [/\bmission\b/, 7], [/\bpurpose\b/, 7], [/\bvision\b/, 5], [/\bvalues\b/, 5],
  [/\bour\s+approach\b/, 5], [/\bhistory\b/, 5], [/\bwhy\s+us\b/, 5], [/\bleadership\b/, 5],
  [/\b(our\s+)?team\b/, 4], [/\bimpact\b/, 3], [/\bsustainability\b/, 2],
];
const PATH_TERMS = [
  [/\/(about|about-us|aboutus|who-we-are|our-story|company|our-company)(\/|$)/, 10],
  [/\/(mission|purpose|vision|values|history|story|leadership|team|our-team|approach|why-us)(\/|$)/, 6],
  [/\/(impact|sustainability)(\/|$)/, 2],
];
// Never about content, however the link is worded.
const SKIP = /\/(blog|news|press|media|events?|careers?|jobs|contact|login|log-in|sign-?in|sign-?up|account|cart|checkout|privacy|terms|legal|cookies?|search|tag|category|author|wp-|feed)(\/|$)|\.(pdf|jpe?g|png|gif|svg|zip|docx?|xlsx?)$/i;

const hostKey = (h) => String(h || '').toLowerCase().replace(/^www\./, '');

// Links as [{ text, url }], from Jina's links summary (an object of
// text → url, or an array) and from markdown links in the page content.
export function extractLinks({ links = null, content = '' } = {}) {
  const out = [];
  if (Array.isArray(links)) links.forEach(l => out.push({ text: String(l?.text ?? l?.title ?? l?.[0] ?? ''), url: String(l?.url ?? l?.href ?? l?.[1] ?? '') }));
  else if (links && typeof links === 'object') Object.entries(links).forEach(([text, url]) => out.push({ text, url: String(url) }));
  const md = /\[([^\]]{1,160})\]\((https?:\/\/[^)\s]+)(?:\s+"[^"]*")?\)/g;
  let m;
  const body = String(content || '').replace(/!\[[^\]]*\]\([^)]*\)/g, '');
  while ((m = md.exec(body))) out.push({ text: m[1], url: m[2] });
  const seen = new Set();
  return out
    .map(l => ({ text: l.text.replace(/!\[[^\]]*\]\([^)]*\)/g, '').replace(/[*_`#]/g, '').replace(/\s+/g, ' ').trim().slice(0, 120), url: l.url.trim() }))
    .filter(l => /^https?:\/\//i.test(l.url))
    .filter(l => { const k = l.url.replace(/#.*$/, '').replace(/\/$/, ''); if (seen.has(k)) return false; seen.add(k); return true; })
    .slice(0, 400);
}

// Markdown to plain text for the evidence: link targets and images dropped.
export function markdownToText(md) {
  return String(md || '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/[*_]{1,3}([^*_\n]+)[*_]{1,3}/g, '$1')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// An error page served in place of content: a 404 with the site's own
// branding, or a "page not found" served with a 200. Read from the reader's
// warning, the title, or the opening of a short page.
export function looksNotFound({ warning = '', title = '', text = '' } = {}) {
  if (/\b(404|410)\b|not\s+found/i.test(String(warning || ''))) return true;
  const t = String(title || '').trim();
  if (t && /\b404\b|page\s+not\s+found|not\s+found|can.?t\s+be\s+found|cannot\s+be\s+found|does\s*n.?t\s+exist|no\s+longer\s+exists|^error\b/i.test(t) && t.length < 120) return true;
  const body = String(text || '').trim();
  if (body.length < 3000 && /\b404\b|page\s+not\s+found|(page|content)\s+(you|you.re)\s+(are\s+)?looking\s+for\s+(could\s+not|can.?t|cannot|does\s*n.?t|is\s+not)|this\s+page\s+(does\s+not|doesn.?t)\s+exist|page\s+(has\s+been\s+)?(moved|removed)/i.test(body.slice(0, 600))) return true;
  return false;
}

// The site's own links most likely to lead to about content, best first.
export function pickAboutLinks(links, homeUrl, { max = 3 } = {}) {
  let home;
  try { home = new URL(homeUrl); } catch { return []; }
  const homeKey = home.pathname.replace(/\/$/, '');
  const scored = [];
  (links || []).forEach(l => {
    let u;
    try { u = new URL(l.url, home); } catch { return; }
    if (!/^https?:$/.test(u.protocol) || hostKey(u.hostname) !== hostKey(home.hostname)) return;
    const path = u.pathname.toLowerCase().replace(/\/$/, '');
    if (!path || path === homeKey.toLowerCase() || SKIP.test(path)) return;
    // Deep pages (a single team member, a blog post) are not the about page.
    if (path.split('/').filter(Boolean).length > 2) return;
    const text = String(l.text || '').toLowerCase();
    let byText = 0;
    let byPath = 0;
    ABOUT_TERMS.forEach(([re, w]) => { if (re.test(text)) byText = Math.max(byText, w); });
    PATH_TERMS.forEach(([re, w]) => { if (re.test(path)) byPath = Math.max(byPath, w); });
    // Link text and address agreeing is the surest sign.
    const score = Math.max(byText, byPath) + (byText && byPath ? 2 : 0);
    if (score > 0) scored.push({ url: `${u.origin}${u.pathname.replace(/\/$/, '')}`, text: l.text, score });
  });
  const seen = new Set();
  return scored
    .sort((a, b) => b.score - a.score || a.url.length - b.url.length)
    .filter(x => (seen.has(x.url) ? false : (seen.add(x.url), true)))
    .slice(0, max);
}

// About content on the homepage itself: a heading or section that tells the
// brand's story, as single-page sites do.
export function homepageHasAbout(text) {
  return /(^|\n)\s*(#{1,4}\s*)?(about(\s+us)?|who\s+we\s+are|our\s+story|our\s+mission|our\s+purpose|what\s+we\s+believe|why\s+we\s+exist)\s*\n/i.test(String(text || ''));
}

// What the scoring prompt is told about the about content and how pages were chosen.
export function aboutNote(about) {
  if (!about) return '';
  const where = about.found === 'page'
    ? `found at ${about.url}${about.via === 'navigation' ? `, linked from the site as "${about.linkText}"` : ''}`
    : about.found === 'homepage' ? 'found on the homepage itself'
    : 'not found among the pages read; it may sit under a name or page this pass did not reach';
  return `ABOUT CONTENT: ${where}.
How the pages were chosen: ${about.via === 'guessed' ? 'the homepage returned no links, so common addresses were tried; any that did not load or returned an error page were left out and are not evidence of anything.' : 'by following the links the site itself shows, not by guessing addresses.'}
Do not infer a broken link, a missing page or a functional failure from an address that is not listed here. About content can sit under any name (Our story, Mission, Company, Who we are) or on the homepage. Report a broken link only where the evidence shows the site itself linking to a page that fails.`;
}
