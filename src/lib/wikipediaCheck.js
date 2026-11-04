// ─────────────────────────────────────────────────────────────
// WIKIPEDIA, VERIFIED (v4.19.0, framework 2.17)
//
// The brand is looked up on Wikipedia itself and a page is confirmed as the
// brand's own when Wikidata's official website for it matches the brand's
// domain (api/wikipedia.js). What it finds:
//   - fills the Wikipedia fields on the social and AI reputation steps when
//     they are empty or were auto-filled, never over an assessor's own text
//   - goes into scoring as a verified line, so a page is never read as absent
//   - gates the report's recommendations: a brand with a substantive page is
//     never told to "develop a presence on Wikipedia"
// Without a check (older assessments, Wikipedia unreachable), the state is
// read from what the two Wikipedia fields say, as before.
// ─────────────────────────────────────────────────────────────

// A page counts as substantive at either threshold: enough independent
// sources, or enough text. Below both, it exists but is thin.
export const SUBSTANTIVE = { externalLinks: 15, length: 10000 };
export const VERIFIED_PREFIX = '[Verified: Wikipedia and Wikidata';

export async function fetchWikipediaCheck(input, fetchImpl = fetch) {
  try {
    const r = await fetchImpl(`/api/wikipedia?${new URLSearchParams({ brand: input.brandName || '', url: input.websiteUrl || '' })}`);
    const body = await r.json().catch(() => ({}));
    if (!r.ok) return { status: 'failed', error: body.error || `HTTP ${r.status}` };
    return body;
  } catch (e) {
    return { status: 'failed', error: e?.message || 'unreachable' };
  }
}

// What the assessor's own Wikipedia fields say, when there is no check.
export function wikipediaFromFields(assessments) {
  const text = [assessments?.social?.wikipediaContent, assessments?.aiReputation?.wikipediaContent].filter(Boolean).join('\n').toLowerCase();
  if (!text.trim()) return 'unknown';
  if (/wikipedia\.org\/wiki\//.test(text) || /\bwikipedia:\s*https?:/.test(text)) return 'exists';
  if (['no wikipedia', 'does not have a wikipedia', 'no dedicated page', 'not found on wikipedia', 'absent from wikipedia', 'page does not exist', 'no article'].some(k => text.includes(k))) return 'none';
  return 'unknown';
}

// substantive | thin | none | exists (from the fields, quality unknown) | unknown
export function wikipediaState(check, assessments = null) {
  if (check?.status === 'ok') {
    if (!check.found) return 'none';
    const p = check.page || {};
    return (p.externalLinks >= SUBSTANTIVE.externalLinks || p.length >= SUBSTANTIVE.length) ? 'substantive' : 'thin';
  }
  return wikipediaFromFields(assessments);
}

const day = (iso) => (iso ? new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : '');

export function wikipediaFacts(check) {
  if (check?.status !== 'ok') return '';
  if (!check.found) {
    return `No English Wikipedia page for this brand.${check.others?.length ? ` Pages with similar names are about others: ${check.others.slice(0, 3).map(o => o.title).join('; ')}.` : ''}`;
  }
  const p = check.page;
  return `Wikipedia page: "${p.title}" (${p.url}). ${p.match === 'confirmed' ? 'Confirmed as this brand: Wikidata lists its official website as the brand’s own.' : 'Likely this brand: the title matches and the page names the brand’s website.'} About ${Math.round((p.length || 0) / 1000)}k characters, ${p.externalLinks} external sources.`;
}

// The text for a Wikipedia field on a step.
export const wikipediaFieldText = (check) => {
  const f = wikipediaFacts(check);
  return f ? `${VERIFIED_PREFIX}, ${day(check.checkedAt)}]\n${f}` : '';
};
export const isVerifiedText = (t) => String(t || '').startsWith(VERIFIED_PREFIX);

// The line the scoring prompts read.
export function wikipediaPromptLine(check) {
  const f = wikipediaFacts(check);
  if (!f) return '';
  const state = wikipediaState(check);
  const guide = state === 'none' ? 'A gap in INTENTIONAL (third-party notability), scaled by stage; not a problem.'
    : state === 'thin' ? 'A page exists: never describe the brand as absent from Wikipedia. It is thin, which is a modest gap in INTENTIONAL.'
    : 'A substantive page exists: credit it in INTENTIONAL (third-party notability). Never describe the brand as absent from Wikipedia.';
  return `WIKIPEDIA (verified against Wikipedia and Wikidata, ${day(check.checkedAt)}; this takes precedence over any other source on Wikipedia): ${f} ${guide}`;
}

// ── Recommendations ───────────────────────────────────────────
// A recommendation whose premise the evidence contradicts is changed or
// dropped. Returns the recommendation to show, or null to leave it out.
export const WIKIPEDIA_SERVICE = 'Wikipedia & Knowledge Panel Strategy';
export const WIKIPEDIA_STRENGTHEN = {
  title: 'Wikipedia & Knowledge Panel Strengthening',
  description: 'Build out the brand’s existing Wikipedia page with independent, cited sources, and align the Google Knowledge Panel with it.',
};
export const WIKIPEDIA_REVIEW = {
  title: 'Wikipedia & Knowledge Panel Review',
  description: 'Confirm whether the brand has a Wikipedia page and a Google Knowledge Panel, then establish or strengthen each with accurate, third-party cited information.',
};

export function gateRecommendation(rec, { wikipedia = 'unknown' } = {}) {
  if (!rec || rec.title !== WIKIPEDIA_SERVICE) return rec;
  if (wikipedia === 'substantive') return null;
  if (wikipedia === 'thin' || wikipedia === 'exists') return { ...rec, ...WIKIPEDIA_STRENGTHEN };
  if (wikipedia === 'unknown') return { ...rec, ...WIKIPEDIA_REVIEW };
  return rec;   // none: the original, which is right
}
