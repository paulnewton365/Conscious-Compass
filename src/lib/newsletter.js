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
export const NEWSLETTER_HOUSE_IMAGES = [
  { src: '/newsletter/house-1.jpg', focus: [50, 36] },
  { src: '/newsletter/house-2.jpg', focus: [34, 51] },
  { src: '/newsletter/house-3.jpg', focus: [54, 38] },
  { src: '/newsletter/house-4.jpg', focus: [47, 54] },
  { src: '/newsletter/house-5.jpg', focus: [45, 48] },
  { src: '/newsletter/house-6.jpg', focus: [50, 50] },
  { src: '/newsletter/house-7.jpg', focus: [55, 48] },
  { src: '/newsletter/house-8.jpg', focus: [50, 42] },
];
export const houseImageIndex = (issueNumber) => {
  const n = Math.floor(Number(issueNumber));
  return Number.isFinite(n) && n > 0 ? (n - 1) % NEWSLETTER_HOUSE_IMAGES.length : 0;
};
