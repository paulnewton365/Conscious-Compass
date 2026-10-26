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
  // v4.11.0: only dashes are touched. The rule used to drop any comma at the
  // start of a piece of text, which removed the ", " between source links in
  // the Word export.
  .replace(/[ \t]*(\u2014|[ \t]\u2013)[ \t]*(?=\n|$)/g, '')            // at the end of a line
  .replace(/(^|\n)[ \t]*(\u2014|\u2013[ \t])[ \t]*/g, '$1')            // at the start of a line
  .replace(/([ \t]*\u2014|[ \t]+\u2013)[ \t]*(?=[,.;:!?)])/g, '')       // before punctuation
  .replace(/[ \t]*\u2014[ \t]*/g, ', ')
  .replace(/[ \t]+\u2013[ \t]+/g, ', ');
// The same, through a whole issue. Links and image paths are left as they are.
const KEEP = new Set(['url', 'src', 'houseImage']);
export function withoutDashes(v, key = '') {
  if (typeof v === 'string') return KEEP.has(key) ? v : noDashes(v);
  if (Array.isArray(v)) return v.map(x => withoutDashes(x));
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, withoutDashes(x, k)]));
  return v;
}

// ── The issue as a Word document (v3.103.0; shared since v4.11.0) ──────────
// One builder for the DOCX button on the page and the copy the server
// attaches to the Smartsheet row when an issue is published, so both are the
// same file. docx is the 'docx' module, passed in so the page can keep
// loading it on demand. fmtDate formats a date for the dateline; the page and
// the server pass their own (the server's in New York time).
// Earned creative in the news (v3.124.0). The framing is fixed copy; the
// examples come from the weekly job, each with a link its search returned.
export const NEWSLETTER_EC_COPY = {
  title: 'Earned creative in the news',
  reminder: 'Earned creative is an idea designed to be talked about rather than paid to be seen. Instead of announcing something, a brand does something in the world, and journalists, creators and communities carry it for them. Here is who is getting it right.',
  offer: 'Antenna Group creates work like this through HOWL, our earned creative studio. Talk to us about what it could look like for your brand.',
  link: 'https://www.howlagency.com/',
  linkLabel: 'howlagency.com',
};
// A follow-up to an earlier story, as one line for the exports (v4.5.0).
export const followUpText = (f) => (f ? `Follow-up to Issue ${f.issueNumber ?? ''}${f.headline ? `, "${f.headline}"` : ''}.${f.whatsNew ? ` What's new: ${f.whatsNew}` : ''}` : '');
export const newsletterDocxName = (ns) => `Stay_Conscious_Issue_${ns?.issueNumber ?? ''}_${String(ns?.weekOf || '').replace(/[\s,]+/g, '_')}.docx`;
export function newsletterDocument(docx, ns, { refreshedAt = null, nextUpdate = null, fmtDate = (d) => String(d) } = {}) {
  const { Document, Paragraph, TextRun, BorderStyle, AlignmentType, Footer: DocxFooter, ExternalHyperlink } = docx;
  const SANS = 'Hanken Grotesk', SERIF = 'Newsreader';
  const INK = '15171A', BODY = '2E3238', MUTED = '5B6068', RUST = 'C23B22', RULE = 'DEDAD2';
  const txt = (t) => noDashes(String(t || ''));
  const paras = (t) => String(t || '').split(/\n\s*\n/).map(x => x.trim()).filter(Boolean);
  const run = (text, o = {}) => new TextRun({ text: txt(text), font: SANS, size: 20, color: BODY, ...o });
  const kicker = (text, color = MUTED, after = 80) => new Paragraph({ spacing: { after }, children: [run(text, { size: 16, bold: true, allCaps: true, characterSpacing: 16, color })] });
  const serif = (text, size, after = 120, o = {}) => new Paragraph({ spacing: { after, line: 240, lineRule: 'auto' }, keepNext: true, children: [new TextRun({ text: txt(text), font: SERIF, size, color: INK, ...o })] });
  const article = (t, size = 22, after = 140) => paras(t).map(x => new Paragraph({ spacing: { after, line: 300, lineRule: 'auto' }, children: [new TextRun({ text: txt(x), font: SERIF, size, color: BODY })] }));
  const why = (t, size = 18) => t ? [
    new Paragraph({ spacing: { before: 60, after: 40 }, border: { top: { style: BorderStyle.SINGLE, size: 4, color: RULE, space: 6 } }, children: [run('Why it matters', { size: 15, bold: true, allCaps: true, characterSpacing: 16, color: MUTED })] }),
    new Paragraph({ spacing: { after: 200 }, children: [run(t, { size })] }),
  ] : [];
  // The pages behind a story, as links (v4.7.0).
  const sourcesDocx = (list) => (Array.isArray(list) && list.length ? [new Paragraph({ spacing: { after: 200 }, children: [
    run(list.length > 1 ? 'SOURCES  ' : 'SOURCE  ', { size: 15, bold: true, characterSpacing: 16, color: MUTED }),
    ...list.flatMap((src, k) => [...(k ? [run(', ', { size: 18 })] : []), new ExternalHyperlink({ link: src.url, children: [run(src.outlet || src.title || src.url, { size: 18, color: RUST, underline: {} })] })]),
  ] })] : []);
  // A follow-up to earlier coverage (v4.5.0), under the headline.
  const followUpDocx = (f) => (f ? [new Paragraph({ spacing: { after: 140 }, border: { left: { style: BorderStyle.SINGLE, size: 12, color: RUST, space: 8 } },
    children: [run('FOLLOW-UP  ', { size: 15, bold: true, characterSpacing: 16, color: RUST }), run(followUpText(f).replace(/^Follow-up to /, 'First covered in '), { size: 18 })] })] : []);
  const sechead = (text) => new Paragraph({ spacing: { before: 480, after: 200 }, keepNext: true,
    border: { top: { style: BorderStyle.DOUBLE, size: 6, color: INK, space: 8 } },
    children: [new TextRun({ text, font: SERIF, size: 36, color: INK })] });
  const itemRule = () => new Paragraph({ spacing: { before: 120, after: 160 }, border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: RULE, space: 1 } } });
  const la = ns.landscapeAnalysis;
  const avg = la && Number.isFinite(la.averageScore) ? la.averageScore : null;

  return new Document({
    background: { color: 'FBFAF7' },
    styles: { default: { document: { run: { font: SANS, size: 20, color: BODY }, paragraph: { spacing: { line: 276, lineRule: 'auto' } } } } },
    sections: [{
      properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1080, right: 1080, bottom: 1440, left: 1080 } } },
      footers: { default: new DocxFooter({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [
        run(`Stay Conscious  |  Issue ${ns.issueNumber}  |  Week of ${ns.weekOf}  |  Antenna Group  |  Conscious Compass`, { size: 16, color: MUTED }),
      ] })] }) },
      children: [
        // Masthead: 4pt ink rule, italic tagline, the title, a ruled dateline
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 120 }, border: { top: { style: BorderStyle.SINGLE, size: 32, color: INK, space: 10 } },
          children: [new TextRun({ text: "Brand intelligence for assessors. What's shifting, why it matters.", font: SERIF, italics: true, size: 24, color: BODY })] }),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 160, line: 240, lineRule: 'auto' }, children: [new TextRun({ text: 'Stay Conscious', font: SERIF, size: 120, color: INK })] }),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 360 },
          border: { top: { style: BorderStyle.SINGLE, size: 8, color: INK, space: 6 }, bottom: { style: BorderStyle.DOUBLE, size: 6, color: INK, space: 6 } },
          children: [run([`Issue ${ns.issueNumber}`, refreshedAt ? `Updated ${fmtDate(refreshedAt)}` : null, `Next update ${fmtDate(nextUpdate)}`].filter(Boolean).join('     ·     '), { size: 17, color: MUTED })] }),

        // Lead story
        kicker(`${ns.leadStory?.category || ''} · Lead story`, RUST),
        serif(ns.leadStory?.headline, 60, 200),
        ...followUpDocx(ns.leadStory?.followUp),
        ...article(ns.leadStory?.insight, 23),
        ...why(ns.leadStory?.whyItMatters, 19),
        ...sourcesDocx(ns.leadStory?.sources),
        // Talking point (v4.7.0)
        ...(ns.talkingPoint?.point ? [
          kicker('Talking point of the week', RUST, 60),
          new Paragraph({ spacing: { after: 60 }, keepNext: true, children: [run(`If a client asks about ${ns.talkingPoint.topic}`, { bold: true, color: INK, size: 26 })] }),
          ...article(ns.talkingPoint.point, 22, 120),
          new Paragraph({ spacing: { after: 320 }, border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: RULE, space: 6 } }, children: [] }),
        ] : []),

        // Landscape insights
        ...(la?.summary ? [
          sechead('Landscape insights'),
          ...(avg !== null ? [new Paragraph({ spacing: { after: 60, line: 240, lineRule: 'auto' }, children: [new TextRun({ text: String(avg), font: SERIF, size: 96, color: INK })] })] : []),
          ...(avg !== null || la.brandCount ? [new Paragraph({ spacing: { after: 200 }, children: [run(
            [avg !== null ? 'Average score out of 100' : null, la.brandCount ? `Based on ${la.brandCount} brands across ${la.sectorCount} sectors` : null].filter(Boolean).join(' · '), { size: 17, color: MUTED })] })] : []),
          ...(la.headline ? [serif(la.headline, 40, 160)] : []),
          ...article(la.summary),
          ...article(la.insights),
        ] : []),

        // Brand intelligence
        ...(ns.intelligenceItems?.length ? [
          sechead('Brand intelligence'),
          ...ns.intelligenceItems.flatMap((item, i) => [
            ...(i > 0 ? [itemRule()] : []),
            kicker(item.category || ''),
            serif(item.headline, i < 2 ? 40 : 34, 120),
            ...followUpDocx(item.followUp),
            ...article(item.insight, 21),
            ...why(item.whyItMatters),
            ...sourcesDocx(item.sources),
          ]),
        ] : []),

        // Earned creative in the news (v3.124.0), straight after Brand intelligence (v4.13.3)
        ...(ns.earnedCreative?.items?.length ? [
          sechead(NEWSLETTER_EC_COPY.title),
          ...article(NEWSLETTER_EC_COPY.reminder, 22, 200),
          ...ns.earnedCreative.items.flatMap((e, i) => [
            ...(i > 0 ? [itemRule()] : []),
            kicker([e.brand, e.agency].filter(Boolean).join(' \u00b7 ')),
            serif(e.title || e.brand, 34, 120),
            ...article(e.what, 21),
            ...why(e.coverage ? `Coverage: ${e.coverage}` : ''),
            new Paragraph({ spacing: { after: 160 }, children: [new ExternalHyperlink({ link: e.url, children: [run(`Read it${e.outlet ? ` in ${e.outlet}` : ''}`, { size: 18, color: RUST, underline: {} })] })] }),
          ]),
          new Paragraph({ spacing: { before: 200, after: 160 }, children: [
            run(`${NEWSLETTER_EC_COPY.offer} `, { size: 20 }),
            new ExternalHyperlink({ link: NEWSLETTER_EC_COPY.link, children: [run(NEWSLETTER_EC_COPY.linkLabel, { size: 20, color: RUST, underline: {} })] }),
          ] }),
        ] : []),

        // Spotlight and Prospect pulse (v4.6.0)
        ...(ns.spotlight?.headline ? [
          sechead('Spotlight'),
          kicker(`One thing to lift ${ns.spotlight.name}`, RUST),
          serif(ns.spotlight.headline, 34, 120),
          ...article(ns.spotlight.action, 22, 140),
          ...why(ns.spotlight.why).map((x, i) => (i === 0 ? new Paragraph({ spacing: { before: 60, after: 40 }, border: { top: { style: BorderStyle.SINGLE, size: 4, color: RULE, space: 6 } }, children: [run('Why it lifts the score', { size: 15, bold: true, allCaps: true, characterSpacing: 16, color: MUTED })] }) : x)),
          ...(ns.spotlight.figures?.avg != null ? [new Paragraph({ spacing: { after: 120 }, children: [run(`Average ${ns.spotlight.name} score across ${ns.spotlight.figures.brands} brands we have assessed: ${ns.spotlight.figures.avg}.${ns.spotlight.figures.belowFifty != null ? ` ${ns.spotlight.figures.belowFifty} score below 50.` : ''}`, { size: 18, color: MUTED })] })] : []),
          ...(ns.spotlight.steps || []).map((st, i) => new Paragraph({ spacing: { after: 60 }, children: [run(`${i + 1}.  ${st}`)] })),
        ] : []),
        ...(ns.prospectPulse?.count > 0 ? [
          sechead('Prospect pulse'),
          ...article(`So far in ${ns.prospectPulse.month} we have read ${ns.prospectPulse.count} prospect brands${ns.prospectPulse.sectors?.length ? `, mostly in ${ns.prospectPulse.sectors.map(x => x.name).join(', ')}` : ''}.`, 22, 120),
          ...[
            ns.prospectPulse.averageScore != null ? `Average teaser score: ${ns.prospectPulse.averageScore}${ns.prospectPulse.fullAverage != null ? `, against ${ns.prospectPulse.fullAverage} for brands we have fully assessed` : ''}.` : null,
            ns.prospectPulse.weakest ? `Weakest attribute: ${ns.prospectPulse.weakest.name}, averaging ${ns.prospectPulse.weakest.avg}.` : null,
            ns.prospectPulse.strongest ? `Strongest attribute: ${ns.prospectPulse.strongest.name}, averaging ${ns.prospectPulse.strongest.avg}.` : null,
          ].filter(Boolean).map(t => new Paragraph({ spacing: { after: 60 }, children: [run(t)] })),
          new Paragraph({ spacing: { before: 80, after: 200 }, children: [run('Teasers are quick reads of what is publicly visible. They are kept apart from our benchmarks, which count full assessments only.', { size: 16, color: MUTED })] }),
        ] : []),

        // Story opportunities
        ...(ns.storyOpportunities?.length ? [
          sechead('Story opportunities'),
          ...ns.storyOpportunities.flatMap((st, i) => [
            ...(i > 0 ? [itemRule()] : []),
            new Paragraph({ spacing: { after: 80, line: 240, lineRule: 'auto' }, keepNext: true, children: [
              new TextRun({ text: `${i + 1}   `, font: SERIF, size: 40, color: RUST }),
              new TextRun({ text: txt(st.headline), font: SERIF, size: 32, color: INK }),
            ] }),
            ...article(st.body, 21, 120),
          ]),
        ] : []),

        new Paragraph({ spacing: { before: 480 }, border: { top: { style: BorderStyle.SINGLE, size: 4, color: RULE, space: 8 } },
          children: [run('Insights generated by Claude. Always apply your own professional judgment.', { size: 16, color: MUTED })] }),
      ],
    }],
  });
}

// ── Signals: a monthly post for Antenna's blog (v4.12.0) ───────────────────
// Once a month, the news from the last four editions of Stay Conscious
// becomes a draft for antennagroup.com/signals: an eight-minute read for an
// outside audience, in Paul Newton's voice. Only the news stories are used;
// nothing internal (landscape, Spotlight, Prospect pulse, talking point,
// story opportunities, earned creative) and no client or score is named.
// The server writes and checks the draft; this module holds what the page
// and the server share: the voice, the fixed close, and the renderers.
export const SIGNALS_AUTHOR = 'Paul Newton';
// Every post is a Fully Conscious round-up (v4.13.1): the series name sits
// above the title and the fixed line below says what the series is. Fixed
// copy, like the close, so it is never rewritten or left out.
export const SIGNALS_SERIES = {
  name: 'Fully Conscious',
  about: 'Fully Conscious is a monthly overview of trends, announcements and insights from the last 30 days for conscious brands.',
};
// The close is fixed copy, so the call to action never says anything unchecked.
// The link is the Conscious Compass page on antennagroup.com (v4.13.1);
// change it here if the destination moves.
export const SIGNALS_CLOSE = {
  heading: 'How conscious is your brand?',
  text: 'Every shift in this month\'s news comes back to one question: does what you say match what people can see? It is the question I built the Conscious Compass to answer. It reads a brand the way the market does, from what is publicly visible, across eight attributes of a conscious brand, and shows where you are earning trust and where you are leaving it on the table.',
  linkLabel: 'Find out how conscious your brand is',
  link: 'https://www.antennagroup.com/conscious-compass',
};
export const SIGNALS_WORDS = { min: 1600, max: 1900, target: '1,650 to 1,850' };
// The voice, from Paul's HOWL posts, weighted to the two most recent
// ("Your inside voice", August 2026; "Read the room", July 2026), and his
// standing voice rules.
export const SIGNALS_STYLE = `VOICE: Paul Newton, EVP at Antenna Group, writing in the first person as himself. This is his column, his view, his read of the month: "I" throughout, never the company's "we", never "Antenna believes" or "our team". He may mention what he sees in his work with brands as his own experience ("I see this every week", "In my experience"). Direct, confident, a little provocative. He writes to the reader as "you" and argues a position; he does not survey a topic.

OPENING: Start on the reader's problem or a one-line verdict, never on a statistic or throat-clearing. Then put the reader's own brand in the frame: a short run of "If your brand..." or the objections they hear inside their own company, which the rest of the piece answers. Two things can be true at the same time is the kind of line he uses to turn an argument.

STRUCTURE: Four to six sections under short subheads of two to four words that read as a progression of the argument, often imperatives ("Show the stakes", "Frame the conversation"). Inside a section, a bold lead-in such as **Brand differentiation.** can introduce a point. At most one short list in the whole piece, each item starting with a verb.

SENTENCES AND PARAGRAPHS: Short paragraphs of one to four sentences, with one-line paragraphs for emphasis. Mostly short declarative sentences of 10 to 15 words, with the odd fragment for rhythm and the occasional longer sentence that stacks an argument. Verdict before evidence: make the claim, then prove it.

EVIDENCE: Every fact is specific and named: who found it, what the figure is. Cite it with a link on the words that carry it. Use two to four short direct quotes from the sources, copied exactly, to let a named source make the point for you.

QUESTIONS: Rare. Use them only to diagnose where the reader stands, never as a hook.

CLOSE: End the argument on the path forward: what a leader should do now, in plain words. Turn toward being a conscious brand: one whose purpose, proof and presence line up, and that earns trust by being seen to do what it says. Do not write a sign-off or a sales pitch; a fixed closing section follows your text.

NEVER: em dashes or en dashes; "not just X but Y"; "in today's" anything; "delve"; "landscape" as a metaphor; "navigate"; "unlock"; "game-changer"; "ever-evolving"; "it's worth noting"; rule-of-three lists for rhythm; motivational closers; rhetorical scaffolding ("Here's the thing", "Let's be clear"); exclamation marks.`;
// Phrases that read as machine-written, checked in code (v4.12.0).
export const SIGNALS_TELLS = [
  [/\bnot (just|only|merely) [^.]{1,80}?,? but\b/i, 'not just X but Y'],
  [/\bin today'?s\b/i, "in today's"], [/\bdelv(e|es|ing)\b/i, 'delve'], [/\bnavigat(e|es|ing)\b/i, 'navigate'],
  [/\bunlock(s|ing)?\b/i, 'unlock'], [/\bgame[- ]chang/i, 'game-changer'], [/\bever[- ]evolving\b/i, 'ever-evolving'],
  [/\bit'?s worth noting\b/i, "it's worth noting"], [/\bhere'?s the thing\b/i, "here's the thing"], [/\blet'?s be clear\b/i, "let's be clear"],
  [/\btapestry\b/i, 'tapestry'], [/\bseamless(ly)?\b/i, 'seamless'], [/\bin conclusion\b/i, 'in conclusion'], [/\bfast[- ]paced\b/i, 'fast-paced'],
  [/!/, 'exclamation mark'], [/[\u2014\u2013]/, 'dash'],
  // Paul's voice check (v4.12.0): the post is his, in the first person, never the company's.
  [/\b(at Antenna|Antenna (Group )?(believes|thinks|sees|knows)|our (team|clients|agency|work)|we at)\b/i, "not in Paul's voice: the company is speaking"],
];
export const signalsTells = (text) => {
  const t = String(text || '');
  const found = SIGNALS_TELLS.filter(([re]) => re.test(t)).map(([, name]) => name);
  if ((t.match(/\b(we|our|us)\b/gi) || []).length > 5) found.push('not in Paul\'s voice: "we" where it should be "I"');
  return [...new Set(found)];
};
export const wordCount = (t) => (String(t || '').replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').match(/[A-Za-z0-9À-ɏ'%$]+/g) || []).length;
// The month a draft covers, in New York time, e.g. "October 2026".
const nyParts = (d) => Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', year: 'numeric', month: 'numeric', day: 'numeric', weekday: 'short' }).formatToParts(d).map(p => [p.type, p.value]));
export const signalsMonth = (d = new Date()) => d.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'America/New_York' });
// The schedule runs every Monday; it writes on the one Monday in the last
// seven days of the month (New York time), so there is one draft a month.
export function isSignalsDay(d = new Date()) {
  const p = nyParts(d);
  const last = new Date(Date.UTC(Number(p.year), Number(p.month), 0)).getUTCDate();
  return p.weekday === 'Mon' && Number(p.day) > last - 7;
}
// The body is Markdown: "## " subheads, paragraphs, [words](https://...) links,
// **bold** lead-ins and "- " list items.
export function signalsBlocks(md) {
  const blocks = [];
  String(md || '').split(/\n\s*\n/).map(b => b.trim()).filter(Boolean).forEach(b => {
    if (/^##\s+/.test(b)) blocks.push({ type: 'h2', text: b.replace(/^##\s+/, '').trim() });
    else if (b.split('\n').every(l => /^\s*[-*]\s+/.test(l))) blocks.push({ type: 'ul', items: b.split('\n').map(l => l.replace(/^\s*[-*]\s+/, '').trim()) });
    else blocks.push({ type: 'p', text: b.replace(/\s*\n\s*/g, ' ') });
  });
  return blocks;
}
// Inline runs: text, links and bold, for every renderer.
export function signalsRuns(text) {
  const out = [];
  const re = /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)|\*\*([^*]+)\*\*/g;
  let at = 0; let m;
  while ((m = re.exec(String(text || '')))) {
    if (m.index > at) out.push({ text: text.slice(at, m.index) });
    out.push(m[1] ? { text: m[1], link: m[2] } : { text: m[3], bold: true });
    at = m.index + m[0].length;
  }
  if (at < String(text || '').length) out.push({ text: text.slice(at) });
  return out;
}
// Where the pull quotes sit: after the first paragraph of every other section.
export function signalsLayout(draft) {
  const blocks = signalsBlocks(draft?.body);
  const quotes = (draft?.pullQuotes || []).slice(0, 3);
  // Spread evenly through the body: never after the opening paragraph or the last one.
  const ps = blocks.map((b, i) => (b.type === 'p' ? i : -1)).filter(i => i >= 0);
  const pool = ps.length > 2 ? ps.slice(1, -1) : ps;
  const slots = [...new Set(quotes.map((_, k) => pool[Math.floor(((k + 0.5) * pool.length) / quotes.length)]))].filter(i => i !== undefined);
  const out = [];
  blocks.forEach((b, i) => { out.push(b); const q = slots.indexOf(i); if (q >= 0) out.push({ type: 'quote', text: quotes[q] }); });
  return out;
}
const escHtml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const htmlRuns = (t) => signalsRuns(t).map(r => (r.link ? `<a href="${escHtml(r.link)}" target="_blank" rel="noopener">${escHtml(r.text)}</a>` : r.bold ? `<strong>${escHtml(r.text)}</strong>` : escHtml(r.text))).join('');
// HTML to paste into the Webflow rich text field.
export function signalsHtml(draft) {
  const body = signalsLayout(draft).map(b => (b.type === 'h2' ? `<h2>${escHtml(b.text)}</h2>` : b.type === 'ul' ? `<ul>${b.items.map(i => `<li>${htmlRuns(i)}</li>`).join('')}</ul>` : b.type === 'quote' ? `<blockquote>${escHtml(b.text)}</blockquote>` : `<p>${htmlRuns(b.text)}</p>`)).join('\n');
  return `<p><strong>${escHtml(SIGNALS_SERIES.name)}</strong> | ${escHtml(draft?.month || '')}</p>\n<h1>${escHtml(draft?.title || '')}</h1>\n<p><em>${escHtml(draft?.dek || '')}</em></p>\n<p>${escHtml(SIGNALS_SERIES.about)}</p>\n${body}\n<h2>${escHtml(SIGNALS_CLOSE.heading)}</h2>\n<p>${escHtml(SIGNALS_CLOSE.text)}</p>\n<p><a href="${escHtml(SIGNALS_CLOSE.link)}" target="_blank" rel="noopener">${escHtml(SIGNALS_CLOSE.linkLabel)}</a></p>`;
}
export const signalsDocxName = (draft) => `Signals_${String(draft?.month || '').replace(/\s+/g, '_')}_draft.docx`;
// The draft as a Word document, in the report's type, for review and Smartsheet.
export function signalsDocument(docx, draft) {
  const { Document, Paragraph, TextRun, BorderStyle, ExternalHyperlink } = docx;
  const SANS = 'Hanken Grotesk', SERIF = 'Newsreader';
  const INK = '15171A', BODY = '2E3238', MUTED = '5B6068', RUST = 'C23B22';
  const t = (s) => noDashes(String(s || ''));
  const runs = (text, size = 22) => signalsRuns(t(text)).map(r => (r.link
    ? new ExternalHyperlink({ link: r.link, children: [new TextRun({ text: r.text, font: SERIF, size, color: RUST, underline: {} })] })
    : new TextRun({ text: r.text, font: SERIF, size, color: BODY, bold: !!r.bold })));
  const words = wordCount(draft?.body);
  const children = [
    new Paragraph({ spacing: { after: 120 }, children: [new TextRun({ text: `SIGNALS DRAFT  ·  ${t(draft?.month)}  ·  ${words} WORDS, ABOUT ${Math.max(1, Math.round(words / 220))} MIN READ`, font: SANS, size: 16, bold: true, color: MUTED, characterSpacing: 16 })] }),
    new Paragraph({ spacing: { after: 80 }, children: [new TextRun({ text: SIGNALS_SERIES.name.toUpperCase(), font: SANS, size: 18, bold: true, color: RUST, characterSpacing: 16 })] }),
    new Paragraph({ spacing: { after: 160, line: 240, lineRule: 'auto' }, children: [new TextRun({ text: t(draft?.title), font: SERIF, size: 56, color: INK })] }),
    new Paragraph({ spacing: { after: 160 }, children: [new TextRun({ text: t(draft?.dek), font: SERIF, size: 26, italics: true, color: BODY })] }),
    new Paragraph({ spacing: { after: 160 }, children: [new TextRun({ text: `By ${SIGNALS_AUTHOR}`, font: SANS, size: 18, color: MUTED })] }),
    new Paragraph({ spacing: { after: 360, line: 300, lineRule: 'auto' }, children: [new TextRun({ text: SIGNALS_SERIES.about, font: SERIF, size: 22, italics: true, color: MUTED })] }),
    ...signalsLayout(draft).flatMap(b => {
      if (b.type === 'h2') return [new Paragraph({ spacing: { before: 360, after: 160 }, keepNext: true, children: [new TextRun({ text: t(b.text), font: SERIF, size: 34, color: INK })] })];
      if (b.type === 'ul') return b.items.map(i => new Paragraph({ bullet: { level: 0 }, spacing: { after: 80 }, children: runs(i) }));
      if (b.type === 'quote') return [new Paragraph({ spacing: { before: 200, after: 240 }, indent: { left: 400 }, border: { left: { style: BorderStyle.SINGLE, size: 18, color: RUST, space: 12 } }, children: [new TextRun({ text: t(b.text), font: SERIF, size: 32, italics: true, color: INK })] })];
      return [new Paragraph({ spacing: { after: 160, line: 300, lineRule: 'auto' }, children: runs(b.text) })];
    }),
    new Paragraph({ spacing: { before: 360, after: 160 }, keepNext: true, children: [new TextRun({ text: SIGNALS_CLOSE.heading, font: SERIF, size: 34, color: INK })] }),
    new Paragraph({ spacing: { after: 120, line: 300, lineRule: 'auto' }, children: [new TextRun({ text: SIGNALS_CLOSE.text, font: SERIF, size: 22, color: BODY })] }),
    new Paragraph({ spacing: { after: 360 }, children: [new ExternalHyperlink({ link: SIGNALS_CLOSE.link, children: [new TextRun({ text: SIGNALS_CLOSE.linkLabel, font: SANS, size: 20, bold: true, color: RUST, underline: {} })] })] }),
  ];
  return new Document({
    styles: { default: { document: { run: { font: SERIF, size: 22, color: BODY } } } },
    sections: [{ properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1080, right: 1200, bottom: 1440, left: 1200 } } }, children }],
  });
}

// "1 source link", "2 source links" (v4.12.0).
export const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
export const readMinutes = (words) => plural(Math.max(1, Math.round((Number(words) || 0) / 220)), 'minute');
