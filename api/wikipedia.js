// Verified Wikipedia check (v4.19.0).
//
// GET ?brand=<name>&url=<website>
//
// Looks the brand up on Wikipedia itself, then confirms a page is about this
// brand rather than a namesake: the official website Wikidata records for the
// page must match the brand's own domain. A page whose title matches the brand
// and whose text names the brand's domain counts as likely. Anything else is
// listed as a candidate that is not this brand.
//
// Before this, Wikipedia presence was read from Google's Knowledge Graph link
// or from whatever an assessor pasted, and the report could recommend
// "develop a presence on Wikipedia" to a brand that already had a page.
// No key needed. Callers must be signed in (api/_auth.js).

import { requireUser } from './_auth.js';

const WP = 'https://en.wikipedia.org/w/api.php';
const WD = 'https://www.wikidata.org/w/api.php';
// Wikimedia asks automated clients to identify themselves.
const HEADERS = { 'User-Agent': 'ConsciousCompass/4 (https://antennagroup.com; brand assessment)', Accept: 'application/json' };

export const hostOf = (url) => {
  try { return new URL(/^https?:/i.test(url) ? url : `https://${url}`).hostname.replace(/^www\./, '').toLowerCase(); } catch { return ''; }
};
const sameSite = (a, b) => !!a && !!b && (a === b || a.endsWith(`.${b}`) || b.endsWith(`.${a}`));
const norm = (s) => String(s || '').toLowerCase().replace(/\(.*?\)/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

// Official websites Wikidata records (property P856), by item id.
export function officialSites(wbEntities) {
  const out = {};
  Object.entries(wbEntities?.entities || {}).forEach(([id, e]) => {
    out[id] = (e?.claims?.P856 || []).map(c => c?.mainsnak?.datavalue?.value).filter(Boolean);
  });
  return out;
}

// Which candidate page is this brand, and how sure.
export function pickPage(pages, sitesById, brand, domain) {
  const ranked = pages.map(p => {
    const sites = sitesById[p.wikidata] || [];
    const confirmed = sites.some(s => sameSite(hostOf(s), domain));
    const likely = !confirmed && norm(p.title) === norm(brand) && String(p.extract || '').toLowerCase().includes(domain);
    return { ...p, officialWebsite: sites[0] || null, match: confirmed ? 'confirmed' : likely ? 'likely' : null };
  });
  const chosen = ranked.find(p => p.match === 'confirmed') || ranked.find(p => p.match === 'likely') || null;
  return { chosen, others: ranked.filter(p => p !== chosen).map(p => ({ title: p.title, officialWebsite: p.officialWebsite })) };
}

export async function checkWikipedia({ brand, url, fetchImpl = fetch }) {
  const domain = hostOf(url);
  const get = async (base, params) => {
    const r = await fetchImpl(`${base}?${new URLSearchParams({ format: 'json', formatversion: '2', origin: '*', ...params })}`, { headers: HEADERS });
    if (!r.ok) throw new Error(`Wikipedia said HTTP ${r.status}.`);
    return r.json();
  };
  const search = await get(WP, { action: 'query', list: 'search', srsearch: brand, srlimit: '5' });
  const titles = (search?.query?.search || []).map(s => s.title).slice(0, 5);
  if (!titles.length) return { status: 'ok', found: false, domain, checkedAt: new Date().toISOString(), others: [] };

  const info = await get(WP, { action: 'query', prop: 'info|pageprops|extracts', inprop: 'url', ppprop: 'wikibase_item', exintro: '1', explaintext: '1', exlimit: 'max', redirects: '1', titles: titles.join('|') });
  const pages = (info?.query?.pages || []).filter(p => !p.missing).map(p => ({
    title: p.title, url: p.fullurl || `https://en.wikipedia.org/wiki/${encodeURIComponent(String(p.title).replace(/ /g, '_'))}`,
    length: p.length || 0, extract: String(p.extract || '').slice(0, 600), wikidata: p.pageprops?.wikibase_item || null,
    disambiguation: p.pageprops && 'disambiguation' in p.pageprops,
  })).filter(p => !p.disambiguation);
  const ids = pages.map(p => p.wikidata).filter(Boolean);
  const sites = ids.length ? officialSites(await get(WD, { action: 'wbgetentities', ids: ids.join('|'), props: 'claims' })) : {};
  const { chosen, others } = pickPage(pages, sites, brand, domain);
  if (!chosen) return { status: 'ok', found: false, domain, checkedAt: new Date().toISOString(), others };

  const links = await get(WP, { action: 'query', prop: 'extlinks', ellimit: '500', titles: chosen.title }).catch(() => null);
  const externalLinks = (links?.query?.pages?.[0]?.extlinks || []).length;
  return {
    status: 'ok', found: true, domain, checkedAt: new Date().toISOString(),
    page: { title: chosen.title, url: chosen.url, length: chosen.length, externalLinks, officialWebsite: chosen.officialWebsite, match: chosen.match, extract: chosen.extract.slice(0, 400) },
    others,
  };
}

export default async function handler(req, res, { fetchImpl = fetch } = {}) {
  const user = await requireUser(req, res, { fetchImpl });
  if (!user) return;
  res.setHeader('Cache-Control', 'private, no-store');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const brand = String(req.query?.brand || '').trim().slice(0, 120);
  const url = String(req.query?.url || '').trim().slice(0, 300);
  if (!brand || !url) return res.status(400).json({ error: 'A brand name (brand) and website (url) are required.' });
  try {
    return res.status(200).json(await checkWikipedia({ brand, url, fetchImpl }));
  } catch (err) {
    return res.status(502).json({ status: 'failed', error: err.message || 'Wikipedia could not be checked.' });
  }
}
