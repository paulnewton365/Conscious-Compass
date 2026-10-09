// ─────────────────────────────────────────────────────────────
// EARNED CREATIVE: HOW IT COULD HELP (ECO v2.0, v3.115.0)
//
// Every brand gets this section. It shows how earned creative could help the
// brand, not whether the brand is ready for it: the readiness machinery of
// v1.0 (Need Rating, Appropriateness Gate, outcome routing, the four-step
// ladder, the opportunity size) is gone.
//
// The section has four parts:
//   opening        one sentence on what earned creative would do for the brand
//   opportunities  two or three, each naming the attribute it would lift, the
//                  brand truth it builds on, an idea starter and what it changes
//   sortFirst      real risks from the evidence to fix first (internal only)
//   HOWL           Antenna's earned creative sub-brand, with its logo, always
//
// After a rescore the scoring pass writes the opening and opportunities from
// the brand's own evidence (scores.earnedCreativeOpportunity). A report scored
// before that, and the Teaser read, get a version built from the scores alone:
// the attributes earned creative can move, lowest first, with fixed copy.
//
// Separate from this section, and unchanged: the +3 lift to SENTIENT and
// INTENTIONAL when the scoring pass finds earned creative already in use
// (framework 2.11), applied in code.
// ─────────────────────────────────────────────────────────────

export const ECO_VERSION = '2.0';

// The score lift for earned creative in use (framework 2.11).
export const USAGE_LIFT = { attributes: ['SENTIENT', 'INTENTIONAL'], points: 3, cap: 100 };

// The attributes earned creative can move, in tie order, with what it does
// for each and an idea starter for when there is no evidence to build on.
export const LEVER_ORDER = ['AWAKE', 'SENTIENT', 'AWARE', 'VISIONARY', 'COGENT'];
export const LEVERS = {
  AWAKE: {
    lifts: 'Puts the brand inside the conversations its category is having, where it is now missing.',
    starter: 'Respond to a live moment in the category with an act only this brand could credibly make.',
  },
  SENTIENT: {
    lifts: 'Gives people a reason to feel something about the brand, not just know about it.',
    starter: 'Tell a human story from inside the business where people already are, not on owned channels.',
  },
  AWARE: {
    lifts: 'Shows the brand is listening, and turns what its audience cares about into something visible.',
    starter: 'Build an idea on what the audience is already saying, and put the audience in it.',
  },
  VISIONARY: {
    lifts: 'Turns a stated point of view into something people can see, share and argue about.',
    starter: 'Stage a public demonstration of the future the brand says it is building.',
  },
  COGENT: {
    lifts: 'Creates the third-party coverage and citations that search and AI engines draw on.',
    starter: 'Release original data or a useful tool that journalists and creators will cite.',
  },
};

export const ECO_COPY = {
  title: 'How earned creative could help',
  definition: "Earned creative is an idea designed to be talked about rather than paid to be seen. Instead of announcing something, the brand does something: a visible action, a data release, a product intervention or a partnership that connects its work to a human truth people already care about. When the idea is strong, journalists, creators and communities carry it, and their voices give the brand a credibility its own channels can't.",
  howlOpener: 'Most brands have more to say than the world has heard. HOWL exists to change that.',
  howlBody: "HOWL is Antenna Group's sub-brand for bold earned creative. We give brands edge, not echo: ideas built on what you actually do, designed to create a head snap that makes journalists, creators and communities want to talk about you.",
  scoresOnly: "Built from the scores alone. Rescore to ground these in the brand's own evidence.",
};

const NAMES = { AWAKE: 'Awake', SENTIENT: 'Sentient', AWARE: 'Aware', VISIONARY: 'Visionary', COGENT: 'Cogent' };
const clean = (v, n = 400) => String(v ?? '').replace(/\s*[—–]\s*/g, ', ').replace(/\s+/g, ' ').trim().slice(0, n);
const num = (v) => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));
const listJoin = (items) => (items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`);

// The levers with a score, lowest first (tie order breaks ties).
export function pickLevers(attrs = {}, max = 3) {
  return LEVER_ORDER
    .map((id, i) => ({ id, i, score: num(attrs[id]) }))
    .filter(l => l.score !== null)
    .sort((a, b) => a.score - b.score || a.i - b.i)
    .slice(0, max)
    .map(({ id, score }) => ({ id, score }));
}

// What the scoring pass wrote, cleaned. Null if it wrote nothing usable.
export function parseOpportunity(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const seen = new Set();
  const opportunities = (Array.isArray(raw.opportunities) ? raw.opportunities : [])
    .map(o => ({ attribute: String(o?.attribute || '').trim().toUpperCase(), truth: clean(o?.truth, 240), idea: clean(o?.idea, 260), change: clean(o?.change, 200) }))
    .filter(o => LEVER_ORDER.includes(o.attribute) && o.idea && !seen.has(o.attribute) && seen.add(o.attribute))
    .slice(0, 3);
  const sortFirst = (Array.isArray(raw.sortFirst) ? raw.sortFirst : []).map(s => clean(s, 240)).filter(Boolean).slice(0, 3);
  const opening = clean(raw.opening, 260);
  if (!opportunities.length) return null;
  return { opening, opportunities, sortFirst };
}

const howl = () => ({ opener: ECO_COPY.howlOpener, body: ECO_COPY.howlBody, logo: '/howl-logo.svg' });

const fallbackOpening = (brand, levers) =>
  `Earned creative would help ${brand} most on ${listJoin(levers.map(l => NAMES[l.id]))}, its lowest scores among the attributes attention can move.`;

// The section for a full report. audience 'client' drops the internal list.
export function buildEcoSection(scores, { brand = 'this brand', audience = 'internal' } = {}) {
  if (!scores) return null;
  const attrs = Object.fromEntries(LEVER_ORDER.map(id => [id, scores?.[id]?.score]));
  const levers = pickLevers(attrs);
  const written = parseOpportunity(scores.earnedCreativeOpportunity);
  if (!written && !levers.length) return null;
  const scoreOf = (id) => num(attrs[id]);
  const opportunities = written
    ? written.opportunities
      .map(o => ({ ...o, name: NAMES[o.attribute], score: scoreOf(o.attribute), change: o.change || LEVERS[o.attribute].lifts }))
      .sort((a, b) => (a.score ?? 101) - (b.score ?? 101))
    : levers.map(l => ({ attribute: l.id, name: NAMES[l.id], score: l.score, truth: '', idea: LEVERS[l.id].starter, change: LEVERS[l.id].lifts }));
  return {
    source: written ? 'evidence' : 'scores',
    opening: written?.opening || fallbackOpening(brand, opportunities.map(o => ({ id: o.attribute }))),
    opportunities,
    sortFirst: audience === 'internal' && written ? written.sortFirst : [],
    howl: howl(),
  };
}

// The Teaser read: the opening and the attribute each opportunity would lift,
// from the teaser scores, with no extra model call.
export function buildTeaserEco(attrs = {}, brand = 'this brand') {
  const levers = pickLevers(attrs);
  if (!levers.length) return null;
  return {
    source: 'scores',
    opening: fallbackOpening(brand, levers),
    opportunities: levers.map(l => ({ attribute: l.id, name: NAMES[l.id], score: l.score, truth: '', idea: '', change: LEVERS[l.id].lifts })),
    sortFirst: [],
    howl: howl(),
  };
}

// What the client link carries: the section without anything internal.
export function clientEcoSection(scores, brand) {
  const s = buildEcoSection(scores, { brand, audience: 'client' });
  if (!s) return null;
  return {
    opening: s.opening,
    opportunities: s.opportunities.map(({ attribute, name, score, truth, idea, change }) => ({ attribute, name, score, truth, idea, change })),
    howl: s.howl,
  };
}

// ── Earned creative in use: the score lift (framework 2.11) ──
// The scoring pass lists the activations it finds in the earned media and
// social readouts; the analyst can remove any (removed: true). The lift is
// applied in code, never by the model, and recomputed from the base and the
// campaign modifier every time, so applying it twice never double counts and
// removing every activation takes it away again.
export function parseActivations(raw) {
  const list = Array.isArray(raw?.activations) ? raw.activations : Array.isArray(raw) ? raw : [];
  return list
    .filter(a => a && typeof a === 'object' && String(a.name || '').trim())
    .map(a => ({ name: String(a.name).trim(), what: String(a.what || '').trim(), evidence: String(a.evidence || '').trim(), removed: a.removed === true }));
}

export function applyEarnedCreativeLift(scores, frameworkVersion = null) {
  if (!scores) return scores;
  const activations = parseActivations(scores.earnedCreative);
  const confirmed = activations.filter(a => !a.removed).length;
  const lift = confirmed > 0 ? USAGE_LIFT.points : 0;
  const out = { ...scores };
  USAGE_LIFT.attributes.forEach(id => {
    const e = out[id];
    if (!e || (typeof e.score !== 'number' && typeof e.baseScore !== 'number')) return;
    const base = typeof e.baseScore === 'number' ? e.baseScore : e.score;
    const withCampaign = Math.max(0, Math.min(100, base + (Number(e.campaignModifierApplied) || 0)));
    const adjusted = Math.min(USAGE_LIFT.cap, withCampaign + lift);
    out[id] = { ...e, baseScore: base, earnedCreativeLift: lift, earnedCreativeLiftApplied: adjusted - withCampaign, score: adjusted };
  });
  out.earnedCreative = { ...(scores.earnedCreative || {}), activations, confirmedCount: confirmed, liftApplied: lift > 0, ...(frameworkVersion ? { frameworkVersion } : {}) };
  return out;
}
