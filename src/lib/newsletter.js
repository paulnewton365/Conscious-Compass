// Newsletter helpers for the Stay Conscious page (v4.1.2, v4.2.0).

// Admin note on the earned creative search (v4.1.2). Null when the issue has
// three fresh examples, or when it predates the saved status.
export function ecStatusNote(ec) {
  const st = ec?.status;
  if (!st) return null;
  const n = ec.items?.length || 0;
  if (n >= 3 && !ec.carriedFrom) return null;
  const why = [...new Set(st.reasons || [])].join('; ');
  const ran = `${st.searches} search${st.searches === 1 ? '' : 'es'}, ${st.candidates} candidate${st.candidates === 1 ? '' : 's'}, ${st.passed} passed the article check`;
  if (ec.carriedFrom) return `Earned creative: nothing new passed this week (${ran}${why ? `; ${why}` : ''}), so the examples from issue ${ec.carriedFrom} are shown again.`;
  if (!n) return `Earned creative: no section this issue (${ran}${why ? `; ${why}` : ''}). Force refresh tries again.`;
  return `Earned creative: ${n} of 3 found (${ran}${why ? `; ${why}` : ''}).`;
}

// When the next issue goes live, in the reader's own time zone (v4.2.0).
// Since v4.7.0 the Sunday run writes a draft and the issue publishes on
// Monday at 12:00 UTC (vercel.json): 8 AM in New York in summer, 7 AM in winter.
export const nextIssueAt = (now = new Date()) => {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 12, 0));
  d.setUTCDate(d.getUTCDate() + ((8 - d.getUTCDay()) % 7));
  if (d <= now) d.setUTCDate(d.getUTCDate() + 7);
  return d;
};

// How alike two headlines are (v4.5.0; shared since v4.7.0): the share of the
// smaller headline's meaningful words found in the other. 1 is the same story.
const STOP = new Set('a an and are as at be by for from has have how in into is it its new now of on or that the their this to was what when why will with your you brands brand'.split(' '));
const words = (t) => new Set(String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').split(/[^a-z0-9]+/).filter(w => w.length > 2 && !STOP.has(w)));
// Share of the smaller headline's words found in the other: 1 is the same story.
export function headlineOverlap(a, b) {
  const x = words(a); const y = words(b);
  if (!x.size || !y.size) return 0;
  let shared = 0;
  x.forEach(w => { if (y.has(w)) shared += 1; });
  return shared / Math.min(x.size, y.size);
}

// The house images (v3.116.0, one per edition since v3.122.0; shared since
// v4.7.2 with the Teams card). Black and white, in public/newsletter.
// focus is where the subject sits, in %, for object-position.
export const NEWSLETTER_HOUSE_IMAGES = [
  { src: '/newsletter/house-1.jpg', focus: [50, 36] },
  { src: '/newsletter/house-2.jpg', focus: [34, 51] },
  { src: '/newsletter/house-3.jpg', focus: [54, 38] },
  { src: '/newsletter/house-4.jpg', focus: [47, 54] },
  { src: '/newsletter/house-5.jpg', focus: [45, 48] },
  { src: '/newsletter/house-6.jpg', focus: [50, 50] },
  { src: '/newsletter/house-7.jpg', focus: [55, 48] },
  { src: '/newsletter/house-8.jpg', focus: [50, 42] },
  // Added in v4.9.0.
  { src: '/newsletter/house-9.jpg', focus: [18, 50] },
  { src: '/newsletter/house-10.jpg', focus: [55, 45] },
  { src: '/newsletter/house-11.jpg', focus: [19, 45] },
  { src: '/newsletter/house-12.jpg', focus: [12, 50] },
  { src: '/newsletter/house-13.jpg', focus: [4, 40] },
  { src: '/newsletter/house-14.jpg', focus: [20, 50] },
  { src: '/newsletter/house-15.jpg', focus: [0, 45] },
  { src: '/newsletter/house-16.jpg', focus: [6, 40] },
  { src: '/newsletter/house-17.jpg', focus: [0, 40] },
  { src: '/newsletter/house-18.jpg', focus: [30, 45] },
  { src: '/newsletter/house-19.jpg', focus: [16, 45] },
  { src: '/newsletter/house-20.jpg', focus: [50, 45] },
  { src: '/newsletter/house-21.jpg', focus: [50, 50] },
  { src: '/newsletter/house-22.jpg', focus: [80, 65] },
  { src: '/newsletter/house-23.jpg', focus: [38, 58] },
];
// Each issue keeps the house image it was drafted with (v4.9.0). A new issue
// takes the next image by issue number across the whole list, and saves it as
// houseImage. Issues from before v4.9.0 saved none: they keep the eight-image
// rotation they were published under, so none of them changes.
const LEGACY_HOUSE_COUNT = 8;
const byIssue = (issueNumber, count) => {
  const n = Math.floor(Number(issueNumber));
  return Number.isFinite(n) && n > 0 ? (n - 1) % count : 0;
};
export const houseImageIndex = (issueNumber) => byIssue(issueNumber, NEWSLETTER_HOUSE_IMAGES.length);
export const isHouseImage = (src) => typeof src === 'string' && NEWSLETTER_HOUSE_IMAGES.some(h => h.src === src);
// The image an issue shows: the one it saved, or the pre-v4.9.0 rotation.
export function houseImageFor(issue) {
  const saved = issue?.houseImage;
  if (isHouseImage(saved)) return NEWSLETTER_HOUSE_IMAGES.find(h => h.src === saved);
  return NEWSLETTER_HOUSE_IMAGES[byIssue(issue?.issueNumber, LEGACY_HOUSE_COUNT)];
}
// The image for an issue being drafted. A revision of an issue (the live one,
// or a draft already waiting) keeps that issue's image; a new issue gets the
// next one by number.
export function houseImageForDraft(issueNumber, existing = []) {
  const same = existing.find(x => x && Number(x.issueNumber) === Number(issueNumber));
  return same ? houseImageFor(same).src : NEWSLETTER_HOUSE_IMAGES[houseImageIndex(issueNumber)].src;
}

// No em dashes anywhere in the newsletter (v4.9.0). The prompts already ask
// for none, but a model can still use one, and issues from before this release
// may hold some. An em dash, and an en dash used as one (with spaces around
// it), becomes a comma; a pair around an aside reads as a pair of commas. An
// en dash inside a range (2019\u20132024) is left alone. Line breaks are kept.
export const noDashes = (t) => String(t ?? '')
  .replace(/[ \t]*(\u2014|[ \t]\u2013)[ \t]*(?=\n|$)/g, '')
  .replace(/[ \t]*\u2014[ \t]*/g, ', ')
  .replace(/[ \t]+\u2013[ \t]+/g, ', ')
  .replace(/,[ \t]*([,.;:!?)])/g, '$1')
  .replace(/(^|\n)[ \t]*,[ \t]*/g, '$1');
// The same, through a whole issue. Links and image paths are left as they are.
const KEEP = new Set(['url', 'src', 'houseImage']);
export function withoutDashes(v, key = '') {
  if (typeof v === 'string') return KEEP.has(key) ? v : noDashes(v);
  if (Array.isArray(v)) return v.map(x => withoutDashes(x));
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, withoutDashes(x, k)]));
  return v;
}
