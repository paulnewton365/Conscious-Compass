// ─────────────────────────────────────────────────────────────
// READOUT DECK EXPORT
//
// 19 slides. Slides 1 to 5, 13 and 19 are boilerplate; everything else is
// built from the assessment. Slide 1 carries the brand name and date.
//
// Editorial content for the synthesis slides (8, 14 to 18) comes from a
// separate Readout Builder pass rather than the scoring prompt, so deck copy
// can be regenerated without rescoring the brand. If that content is missing
// the deck still builds, degrading to evidence pulled straight from the
// assessments rather than failing.
// ─────────────────────────────────────────────────────────────

import pptxgen from 'pptxgenjs';
import { ATTRIBUTES, getMaturityStage, MATURITY_STAGES, CAMPAIGN_LADDER, getCampaignLevel } from '../data/rubric';
import { buildRadarSvg, buildMaturitySvg, buildSpreadSvg, buildLadderSvg, svgToPng, readableFlat } from './deckCharts';

// The Antenna template is a DARK deck end to end: near-black slides, white
// headings, lime accents. Everything below is built for that surface. Charts
// render on the same dark ground rather than sitting in white boxes.
const PAPER = '0D0D0F';        // slide background
const CARD  = '26262A';        // raised panel
const WHITE = 'FFFFFF';
const BODY_TXT = 'D8D8D8';     // body copy on dark
const DIM   = '9A9A9A';        // captions and footers
const LIME  = 'D6E039';        // accent: kickers, lead-ins, stat figures
const RED   = 'E53935';
const LINE  = '3A3A40';
const GREEN = '5BD99B';        // deltas, lifted for a dark ground
const INK   = PAPER;           // retained so existing references stay valid

// Every dynamic colour is resolved against the surface it lands on, so a
// palette change can never reintroduce dark-on-dark.
const BG_SLIDE = '#0D0D0F', BG_CARD = '#26262A';
const onSlide = (c) => readableFlat(c, BG_SLIDE);
const onCard  = (c) => readableFlat(c, BG_CARD);
const onDark  = (c) => readableFlat(c, BG_SLIDE);
// Antenna sets everything in Inter. One family, weight does the work.
const HEAD = 'Inter', BODY = 'Inter';

const ordinal = (n) => {
  if (n == null || !Number.isFinite(Number(n))) return '';
  const v = Math.abs(Math.round(Number(n))), l = v % 100;
  if (l >= 11 && l <= 13) return `${v}th`;
  return `${v}${['th', 'st', 'nd', 'rd'][v % 10] || 'th'}`;
};
const clean = (s) => String(s == null ? '' : s).replace(/\*\*/g, '').replace(/[#*_`]/g, '').trim();
const stripLabel = (s, label) => clean(s).replace(new RegExp(`^${label}\\s*:?\\s*`, 'i'), '');

/**
 * Renders every chart the deck needs. Exported so the caller can start this
 * while the synthesis calls are still in flight, rather than after them.
 */
export function renderDeckCharts({ scores, benchmark, brand, industryName, overall, campaignStage }) {
  const sectorAvgMap = benchmark
    ? ATTRIBUTES.reduce((m, a) => { m[a.id] = benchmark.attrAvgs?.[a.id] ?? 0; return m; }, {})
    : null;
  const png = async (svg, w, h) => { try { return await svgToPng(svg, w, h); } catch { return null; } };
  return Promise.all([
    png(buildRadarSvg(scores, { size: 620 }), 800, 800),
    sectorAvgMap
      ? png(buildRadarSvg(scores, { size: 620, overlay: sectorAvgMap, labelBrand: brand, labelOverlay: `${industryName} avg` }), 800, 800)
      : Promise.resolve(null),
    benchmark ? png(buildMaturitySvg(overall, benchmark.avgScore, brand), 1180, 230) : Promise.resolve(null),
    benchmark ? png(buildSpreadSvg(scores, benchmark, brand), 1240, 570) : Promise.resolve(null),
    campaignStage ? png(buildLadderSvg(campaignStage.level), 1180, 168) : Promise.resolve(null),
  ]);
}

// Antenna mark, pulled from the same Supabase asset the DOCX export uses so
// there is one source of truth for the logo.
const LOGO_URL = 'https://ktuyiikwhspwmzvyczit.supabase.co/storage/v1/object/public/assets/brand/antenna-new-logo.svg';

async function fetchLogoPng() {
  try {
    const r = await fetch(LOGO_URL);
    const svg = await r.text();
    // Recolour to white so the mark reads on the dark ground
    const light = svg
      .replace(/fill="#0{3,6}"/gi, 'fill="#FFFFFF"')
      .replace(/fill="black"/gi, 'fill="#FFFFFF"')
      .replace(/#1A1A1A/gi, '#FFFFFF');
    return await svgToPng(light, 240, 68);
  } catch {
    return null;
  }
}

export async function buildReadoutDeck({ project, scores, assessments = {}, benchmark = null, deckContent = null, profile = null, charts = null }) {
  const p = new pptxgen();
  p.layout = 'LAYOUT_WIDE';                       // 13.33 x 7.5
  p.author = 'Antenna Group';
  p.company = 'Antenna Group';
  p.title = `${project.brandName} Conscious Compass`;

  const brand = project.brandName || 'Brand';
  const dateLabel = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const industryName = benchmark?.industryName || benchmark?.cohortLabel || 'sector';
  const scopeNoun = benchmark?.scope === 'industry' ? 'sector' : 'all brands';

  const overall = Math.round(
    ATTRIBUTES.reduce((t, a) => t + (scores?.[a.id]?.score || 0), 0) / ATTRIBUTES.length
  );
  const stage = getMaturityStage(overall);
  const nextStage = MATURITY_STAGES.find(s => s.min > overall);
  const pointsToNext = nextStage ? nextStage.min - overall : 0;
  const delta = benchmark ? overall - benchmark.avgScore : null;
  const above = benchmark
    ? ATTRIBUTES.filter(a => (scores?.[a.id]?.score || 0) > (benchmark.attrAvgs?.[a.id] ?? 0))
    : [];

  const campaign = scores?.campaignCoherence || null;
  const campaignStage = campaign && Number.isFinite(Number(campaign.level))
    ? getCampaignLevel(Number(campaign.level)) : null;

  // ── charts ──────────────────────────────────────────────────
  const logoPromise = fetchLogoPng();

  // Charts may have been started earlier, in parallel with the synthesis calls.
  const [radarPlain, radarVsSector, maturityImg, spreadImg, ladderImg] =
    await (charts || renderDeckCharts({ scores, benchmark, brand, industryName, overall, campaignStage }));

  const logo = await logoPromise;

  // ── shared furniture ────────────────────────────────────────
  const mark = (s) => {
    if (logo) s.addImage({ data: logo, x: 12.42, y: 0.3, w: 0.55, h: 0.16 });
  };

  const foot = (s) => {
    s.addText(`Conscious Compass  |  ${brand}  |  ${dateLabel}`,
      { x: 0.55, y: 7.02, w: 8, h: 0.3, fontSize: 9, color: DIM, fontFace: BODY, margin: 0 });
    mark(s);
  };

  const heading = (s, kicker, t) => {
    if (kicker) s.addText(kicker, { x: 0.55, y: 0.34, w: 11.5, h: 0.26, fontSize: 12,
      color: LIME, bold: true, charSpacing: 0.6, fontFace: BODY, margin: 0 });
    s.addText(t, { x: 0.55, y: 0.66, w: 12.2, h: 0.82, fontSize: 30, bold: true,
      color: WHITE, fontFace: HEAD, margin: 0, valign: 'top' });
  };

  // Square corners, no outlines. Panels are distinguished by fill alone.
  const card = (s, x, y, w, h, fill) => s.addShape(p.ShapeType.rect,
    { x, y, w, h, fill: { color: fill || CARD }, line: { width: 0 } });

  const statRow = (s, y, stats) => stats.forEach(([n, l, sub], i) => {
    const x = 0.55 + i * 4.15;
    card(s, x, y, 3.85, 1.5);
    s.addText(String(n), { x: x + 0.28, y: y + 0.14, w: 3.3, h: 0.6, fontSize: 32, bold: true, color: LIME, fontFace: HEAD, margin: 0 });
    s.addText(l, { x: x + 0.28, y: y + 0.76, w: 3.3, h: 0.28, fontSize: 12.5, bold: true, color: WHITE, fontFace: BODY, margin: 0 });
    if (sub) s.addText(sub, { x: x + 0.28, y: y + 1.03, w: 3.3, h: 0.32, fontSize: 10.5, color: DIM, fontFace: BODY, margin: 0 });
  });

  // ══ 1. TITLE ══════════════════════════════════════════════
  let s = p.addSlide();
  s.background = { color: PAPER };
  s.addText('Conscious Compass', { x: 0.9, y: 1.5, w: 11.5, h: 0.4, fontSize: 15, color: LIME,
    bold: true, charSpacing: 2.2, fontFace: BODY, margin: 0 });
  s.addText(brand, { x: 0.9, y: 2.05, w: 11.5, h: 1.5, fontSize: brand.length > 34 ? 34 : 46,
    bold: true, color: WHITE, fontFace: HEAD, margin: 0, valign: 'top' });
  if (logo) s.addImage({ data: logo, x: 0.9, y: 0.62, w: 1.05, h: 0.3 });
  s.addText('Brand consciousness assessment', { x: 0.9, y: 3.65, w: 11.5, h: 0.5, fontSize: 21,
    color: DIM, fontFace: BODY, margin: 0 });
  s.addText(dateLabel, { x: 0.9, y: 4.2, w: 11.5, h: 0.4, fontSize: 15, color: DIM, fontFace: BODY, margin: 0 });

  // ══ 2. ANTENNA GROUP (boilerplate) ════════════════════════
  s = p.addSlide();
  s.background = { color: PAPER };
  heading(s, 'INTRODUCING ANTENNA GROUP', 'A partner for conscious brands');
  [
    'We work with the world\u2019s most consequential companies across climate & energy, mobility, sustainability, health, real estate, and beyond. Big players. Bold missions. And a belief that the right story can move markets.',
    'Spanning branding, creative, communications, and performance marketing, our global team cares deeply about delivering real impact for the brands we serve. Wherever they meet the world.',
    'We exist to maximize the impact of conscious capital through marketing solutions built on actionable strategy, inspiring creative, and effective targeting of your message.',
  ].forEach((t, i) => s.addText(t, { x: 0.55, y: 1.75 + i * 1.35, w: 7.6, h: 1.2, fontSize: 14.5,
    color: BODY_TXT, fontFace: BODY, lineSpacing: 22, margin: 0 }));
  card(s, 8.7, 1.75, 4.05, 2.4, INK);
  s.addText('View our agency showreel', { x: 9.0, y: 2.15, w: 3.45, h: 0.4, fontSize: 15, bold: true, color: WHITE, fontFace: BODY, margin: 0 });
  s.addText('youtu.be/ZYX5fGq6Eo4', { x: 9.0, y: 2.62, w: 3.45, h: 0.4, fontSize: 12, color: LIME, fontFace: BODY, margin: 0,
    hyperlink: { url: 'https://youtu.be/ZYX5fGq6Eo4?si=zbgjmoNRI0ra5hik' } });
  foot(s);

  // ══ 3. CAPABILITIES (boilerplate) ═════════════════════════
  s = p.addSlide();
  s.background = { color: PAPER };
  heading(s, 'INTRODUCING OUR CAPABILITIES', 'Flexible integration. This is what we do.');
  [
    ['01', 'Strategy', 'Brand Strategy. Integrated Strategy. Messaging. Research.'],
    ['02', 'PR', 'Bylines & Media. Thought Leadership. Executive Positioning. Partnerships.'],
    ['03', 'Public Affairs', 'Policy Positioning. Policymaker Engagement. Coalition Building. Government Sales and Funding.'],
    ['04', 'Experiences', 'Brand Expression & Identity. Creative Campaigns. Content Ideation & Creation. Website UX, UI & Dev.'],
    ['05', 'Performance', 'Marketing Automation. ABM, SEO, SEM. Paid Advertising & Ops. Paid & Organic Social. Influencer Marketing.'],
    ['06', 'Delivery', 'Project Management. Production Management. Resource Management. Web Support. Operations.'],
    ['07', 'Event Production', 'Earned Activations. Experiential & Product Demos. Conferences, Awards Dinners, Speaking.'],
  ].forEach(([num, title, body], i) => {
    const x = 0.55 + (i % 4) * 3.15, y = 1.65 + Math.floor(i / 4) * 2.45;
    card(s, x, y, 2.95, 2.2);
    s.addText(num, { x: x + 0.22, y: y + 0.16, w: 1, h: 0.35, fontSize: 15, bold: true, color: LIME, fontFace: HEAD, margin: 0 });
    s.addText(title, { x: x + 0.22, y: y + 0.5, w: 2.5, h: 0.35, fontSize: 15.5, bold: true, color: BODY_TXT, fontFace: BODY, margin: 0 });
    s.addText(body, { x: x + 0.22, y: y + 0.88, w: 2.5, h: 1.2, fontSize: 10.5, color: DIM, fontFace: BODY, lineSpacing: 15, margin: 0 });
  });
  s.addText('We are a team of 100 people, with boots on the ground in the US, Canada, Czech Republic, and the UK.',
    { x: 0.55, y: 6.5, w: 12.2, h: 0.4, fontSize: 12, italic: true, color: DIM, fontFace: BODY, margin: 0 });

  // ══ 4. WHY IT MATTERS (boilerplate) ═══════════════════════
  s = p.addSlide();
  s.background = { color: PAPER };
  mark(s);
  s.addText('RESULTS', { x: 0.9, y: 1.3, w: 11, h: 0.3, fontSize: 11, color: LIME, bold: true, charSpacing: 2.2, fontFace: BODY, margin: 0 });
  s.addText('Consequential brands are conscious brands', { x: 0.9, y: 1.75, w: 11.3, h: 1.0, fontSize: 34, bold: true, color: WHITE, fontFace: HEAD, margin: 0 });
  [
    'How you show up means something. Ultimately, this is what you are judged on, so any unknown weaknesses, gaps, and inconsistencies will undermine your credibility, reputation, and potential.',
    'At Antenna Group we measure how you show up with our proprietary AI-powered brand diagnostic that scores your integrated marketing performance across website, paid media, social media, earned media, SEO, GEO, and the main LLMs.',
    'It rates your influence, credibility, trust, and reputation based on what the market can see, and it identifies specific marketing opportunities for your brand and business.',
  ].forEach((t, i) => s.addText(t, { x: 0.9, y: 3.15 + i * 1.15, w: 11.3, h: 1.0, fontSize: 14.5,
    color: BODY_TXT, fontFace: BODY, lineSpacing: 22, margin: 0 }));

  // ══ 5. THE EIGHT ATTRIBUTES (boilerplate) ═════════════════
  s = p.addSlide();
  s.background = { color: PAPER };
  heading(s, 'A CONSCIOUS BRAND', 'Action built on seeing how a brand is seen');
  const QUESTIONS = {
    AWAKE: 'Do you shape narratives and lead industry discourse?',
    AWARE: 'Do you understand your audiences and build trust?',
    REFLECTIVE: 'Is your brand clear, inspiring, and authentic?',
    ATTENTIVE: 'Do you deliver exceptional, consistent experiences?',
    COGENT: 'Are you driven by strategic insight and data?',
    SENTIENT: 'Do you create emotional connections that inspire?',
    VISIONARY: 'Does your brand point toward something meaningful?',
    INTENTIONAL: 'Do you show credible substance and confidence?',
  };
  ATTRIBUTES.forEach((a, i) => {
    const x = 0.55 + (i % 2) * 6.25, y = 1.6 + Math.floor(i / 2) * 1.16;
    s.addShape(p.ShapeType.ellipse, { x, y: y + 0.06, w: 0.34, h: 0.34, fill: { color: a.color }, line: { width: 0 } });
    s.addText(a.name.toUpperCase(), { x: x + 0.48, y, w: 5.5, h: 0.32, fontSize: 14.5, bold: true, color: WHITE, charSpacing: 0.8, fontFace: BODY, margin: 0 });
    s.addText(QUESTIONS[a.id] || a.fullName, { x: x + 0.48, y: y + 0.34, w: 5.5, h: 0.5, fontSize: 12, color: DIM, fontFace: BODY, margin: 0 });
  });
  s.addText('Influence. Consistency. Intelligence. Inspiration. Vision. Credibility. Reputation. Authenticity.',
    { x: 0.55, y: 6.5, w: 12.2, h: 0.4, fontSize: 13, italic: true, color: LIME, fontFace: BODY, margin: 0 });
  foot(s);

  // ══ 6. RESULTS AT A GLANCE ════════════════════════════════
  s = p.addSlide();
  s.background = { color: PAPER };
  const glanceQuote = clean(deckContent?.resultsQuote || scores?.headline || stage.description);
  heading(s, 'RESULTS AT A GLANCE', glanceQuote);
  if (radarPlain) s.addImage({ data: radarPlain, x: 0.35, y: 1.85, w: 4.65, h: 4.65 });

  card(s, 5.35, 1.95, 3.4, 2.5, INK);
  s.addText(String(overall), { x: 5.35, y: 2.1, w: 3.4, h: 1.25, fontSize: 70, bold: true, color: WHITE, align: 'center', fontFace: HEAD, margin: 0 });
  s.addText('out of 100', { x: 5.35, y: 3.2, w: 3.4, h: 0.3, fontSize: 12, color: DIM, align: 'center', fontFace: BODY, margin: 0 });
  s.addText(stage.name.toUpperCase(), { x: 5.35, y: 3.6, w: 3.4, h: 0.4, fontSize: 16, bold: true,
    color: onDark(stage.color), align: 'center', charSpacing: 1.4, fontFace: BODY, margin: 0 });

  [[String(pointsToNext), `points to ${nextStage ? nextStage.name : 'the ceiling'}`],
   [benchmark?.rank ? `${ordinal(benchmark.rank)}` : '—', benchmark?.rank ? `of ${benchmark.count} in ${scopeNoun}` : 'sector rank unavailable'],
   [delta != null ? `${delta > 0 ? '+' : ''}${delta}` : '—', `vs ${scopeNoun} average`]]
   .forEach(([n, l], i) => {
     const y = 1.95 + i * 0.86;
     card(s, 9.0, y, 3.75, 0.74);
     s.addText(n, { x: 9.25, y: y + 0.09, w: 1.3, h: 0.55, fontSize: 26, bold: true, color: LIME, fontFace: HEAD, margin: 0 });
     s.addText(l, { x: 10.5, y: y + 0.2, w: 2.15, h: 0.4, fontSize: 11.5, color: DIM, fontFace: BODY, margin: 0 });
   });
  s.addText(clean(scores?.justification || '').slice(0, 420),
    { x: 5.35, y: 4.7, w: 7.4, h: 1.8, fontSize: 12.5, color: BODY_TXT, fontFace: BODY, lineSpacing: 19, margin: 0 });
  foot(s);

  // ══ 7. BRAND MATURITY ═════════════════════════════════════
  s = p.addSlide();
  s.background = { color: PAPER };
  heading(s, 'BRAND MATURITY', `Maturity: ${stage.name}`);
  s.addText(clean(stage.description), { x: 0.55, y: 1.55, w: 12.2, h: 0.6, fontSize: 14, color: DIM, fontFace: BODY, lineSpacing: 21, margin: 0 });
  if (maturityImg) s.addImage({ data: maturityImg, x: 0.5, y: 2.25, w: 12.3, h: 2.4 });
  statRow(s, 4.85, [
    [benchmark ? benchmark.avgScore : '—', `${industryName} average`,
      delta != null ? `${Math.abs(delta)} points ${delta < 0 ? 'ahead of' : 'behind'} ${brand}`.slice(0, 46) : ''],
    [benchmark ? benchmark.count : '—', 'Brands compared', benchmark?.dateRange
      ? `Assessed ${new Date(benchmark.dateRange.from).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })} to ${new Date(benchmark.dateRange.to).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}` : ''],
    [above.length, `Attribute${above.length === 1 ? '' : 's'} above average`,
      above.length ? above.map(a => a.name).join(', ').slice(0, 46) : 'None above the sector average'],
  ]);
  foot(s);

  // ══ 8. THE INSIGHTS ═══════════════════════════════════════
  s = p.addSlide();
  s.background = { color: PAPER };
  heading(s, 'THE INSIGHTS', 'Attribute performance.');
  if (radarVsSector || radarPlain) s.addImage({ data: radarVsSector || radarPlain, x: 0.3, y: 1.5, w: 4.9, h: 4.9 });

  const ranked = [...ATTRIBUTES].sort((a, b) => (scores?.[b.id]?.score || 0) - (scores?.[a.id]?.score || 0));
  ranked.forEach((a, i) => {
    const x = 5.35, y = 1.62 + i * 0.6;
    s.addText(String(scores?.[a.id]?.score || 0), { x, y, w: 0.62, h: 0.44, fontSize: 21, bold: true,
      color: onSlide(a.color), align: 'right', fontFace: HEAD, margin: 0 });
    s.addText(a.name, { x: x + 0.75, y: y + 0.04, w: 1.9, h: 0.34, fontSize: 13.5, bold: true, color: BODY_TXT, fontFace: BODY, margin: 0 });
    if (benchmark) {
      const d = (scores?.[a.id]?.score || 0) - (benchmark.attrAvgs?.[a.id] ?? 0);
      s.addText(`${d > 0 ? '+' : ''}${d}`, { x: x + 2.6, y: y + 0.06, w: 0.6, h: 0.32, fontSize: 12, bold: true,
        color: d > 0 ? onSlide(GREEN) : d < 0 ? onSlide(RED) : DIM, fontFace: BODY, margin: 0 });
    }
  });

  // Lead-in sets the verdict, elaboration carries the evidence. Accepts either
  // the structured pair or a plain string from older cached content.
  const findings = (deckContent?.attributeFindings || []);
  (findings.length ? findings : deriveFindings(scores, benchmark)).slice(0, 4).forEach((f, i) => {
    const lead = typeof f === 'string' ? '' : clean(f?.lead);
    const detail = typeof f === 'string' ? clean(f) : clean(f?.detail);
    const y = 1.6 + i * 1.26;
    s.addText([
      ...(lead ? [{ text: lead + ' ', options: { bold: true, color: LIME } }] : []),
      { text: detail, options: { color: BODY_TXT } },
    ], { x: 8.7, y, w: 4.05, h: 1.18, fontSize: 10.5, fontFace: BODY,
         lineSpacing: 14.5, margin: 0, valign: 'top' });
  });
  foot(s);

  // ══ 9. BENCHMARKING ═══════════════════════════════════════
  s = p.addSlide();
  s.background = { color: PAPER };
  heading(s, 'BENCHMARKING', 'Attribute performance against benchmark');
  if (spreadImg) {
    s.addImage({ data: spreadImg, x: 0.5, y: 1.55, w: 9.4, h: 4.32 });
  } else {
    s.addText('Benchmark unavailable: no comparable assessments in the corpus.',
      { x: 0.55, y: 2.2, w: 9.2, h: 0.5, fontSize: 14, color: DIM, italic: true, fontFace: BODY, margin: 0 });
  }
  card(s, 10.1, 1.55, 2.65, 4.32);
  s.addText('Read this way', { x: 10.35, y: 1.75, w: 2.2, h: 0.32, fontSize: 13, bold: true, color: LIME, fontFace: BODY, margin: 0 });
  s.addText(clean(deckContent?.benchmarkRead || defaultBenchmarkRead(scores, benchmark, brand)),
    { x: 10.35, y: 2.15, w: 2.2, h: 3.5, fontSize: 11.5, color: BODY_TXT, fontFace: BODY,
      lineSpacing: 17, margin: 0, valign: 'top' });
  if (benchmark) s.addText(`Benchmark basis: ${benchmark.cohortLabel}, n=${benchmark.count}${benchmark.rubricVersions?.length ? `, framework v${benchmark.rubricVersions.join(', v')}` : ''}.`,
    { x: 0.55, y: 6.1, w: 9.4, h: 0.4, fontSize: 10, color: DIM, fontFace: BODY, margin: 0 });
  foot(s);

  // ══ 10. CAMPAIGN COHERENCE ════════════════════════════════
  s = p.addSlide();
  s.background = { color: PAPER };
  heading(s, 'CAMPAIGN COHERENCE', 'How campaign driven is your marketing');
  if (campaignStage) {
    s.addText(clean(campaign.verdict || campaignStage.summary),
      { x: 0.55, y: 1.55, w: 12.2, h: 0.6, fontSize: 17, bold: true, color: BODY_TXT, fontFace: BODY, lineSpacing: 24, margin: 0 });
    if (ladderImg) s.addImage({ data: ladderImg, x: 0.5, y: 2.35, w: 12.3, h: 1.75 });
    card(s, 0.55, 4.35, 5.95, 2.05);
    s.addText(campaignStage.level === 0 ? 'Why no tier' : `Why level ${campaignStage.level}`,
      { x: 0.85, y: 4.53, w: 5.35, h: 0.3, fontSize: 13, bold: true, color: LIME, fontFace: BODY, margin: 0 });
    s.addText(clean(campaign.rationale || campaignStage.description),
      { x: 0.85, y: 4.88, w: 5.35, h: 1.4, fontSize: 12, color: BODY_TXT, fontFace: BODY, lineSpacing: 17, margin: 0 });
    card(s, 6.8, 4.35, 5.95, 2.05, INK);
    s.addText(`To reach level ${Math.min(5, campaignStage.level + 1)}`,
      { x: 7.1, y: 4.53, w: 5.35, h: 0.3, fontSize: 13, bold: true, color: LIME, fontFace: BODY, margin: 0 });
    s.addText(clean(campaign.toNextLevel || ''),
      { x: 7.1, y: 4.88, w: 5.35, h: 1.4, fontSize: 12, color: BODY_TXT, fontFace: BODY, lineSpacing: 17, margin: 0 });
  } else {
    s.addText('Campaign coherence was not scored for this assessment. Regenerate the report on framework 2.9 or later to include it.',
      { x: 0.55, y: 2.0, w: 12.2, h: 0.8, fontSize: 14, color: DIM, italic: true, fontFace: BODY, margin: 0 });
  }
  foot(s);

  // ══ 11 & 12. ATTRIBUTE ANALYSIS ═══════════════════════════
  // Carries the report's own attribute writing, not a truncated stub. The
  // evidence paragraph, what is driving the score, and what would move it all
  // appear in full, which is the level of detail the readout is expected to
  // support in the room.
  [[0, 4], [4, 8]].forEach(([from, to]) => {
    const sl = p.addSlide();
    sl.background = { color: PAPER };
    heading(sl, 'ATTRIBUTE ANALYSIS', from === 0 ? 'Where the brand stands' : 'Where the brand stands, continued');

    ATTRIBUTES.slice(from, to).forEach((a, i) => {
      const x = 0.55 + i * 3.16;
      const w = 2.96;
      const sc = scores?.[a.id] || {};
      const avg = benchmark?.attrAvgs?.[a.id];
      const d = avg != null ? (sc.score || 0) - avg : null;

      card(sl, x, 1.48, w, 5.28);

      // Header block: rule, name, score, full name, sector delta
      sl.addShape(p.ShapeType.rect, { x: x + 0.2, y: 1.68, w: 0.46, h: 0.045,
        fill: { color: onCard(a.color) }, line: { width: 0 } });
      sl.addText(a.name.toUpperCase(), { x: x + 0.2, y: 1.8, w: w - 0.4, h: 0.28,
        fontSize: 12, bold: true, color: WHITE, charSpacing: 0.8, fontFace: BODY, margin: 0 });
      sl.addText(String(sc.score || 0), { x: x + 0.2, y: 2.08, w: w - 0.4, h: 0.6,
        fontSize: 36, bold: true, color: onCard(a.color), fontFace: HEAD, margin: 0 });
      sl.addText(a.fullName, { x: x + 0.2, y: 2.7, w: w - 0.4, h: 0.4,
        fontSize: 9, color: DIM, fontFace: BODY, lineSpacing: 12, margin: 0 });
      if (d != null) sl.addText(`${industryName} avg ${avg} (${d > 0 ? '+' : ''}${d})`,
        { x: x + 0.2, y: 3.08, w: w - 0.4, h: 0.26, fontSize: 9,
          bold: true, color: d > 0 ? onCard(GREEN) : onCard(RED), fontFace: BODY, margin: 0 });

      sl.addShape(p.ShapeType.rect, { x: x + 0.2, y: 3.4, w: w - 0.4, h: 0.01,
        fill: { color: LINE }, line: { width: 0 } });

      // The report's own evidence, at length
      sl.addText(clean(sc.findings || ''), { x: x + 0.2, y: 3.5, w: w - 0.4, h: 1.5,
        fontSize: 8.5, color: BODY_TXT, fontFace: BODY, lineSpacing: 11.5, margin: 0, valign: 'top' });

      sl.addText([
        { text: 'What\u2019s driving it\n', options: { bold: true, color: LIME } },
        { text: stripLabel(sc.impact || '', 'What\u2019s driving it'), options: { color: BODY_TXT } },
      ], { x: x + 0.2, y: 5.05, w: w - 0.4, h: 0.95, fontSize: 8.5, fontFace: BODY,
           lineSpacing: 11.5, margin: 0, valign: 'top' });

      sl.addText([
        { text: 'To improve\n', options: { bold: true, color: LIME } },
        { text: stripLabel(sc.actions || '', 'To improve the score'), options: { color: BODY_TXT } },
      ], { x: x + 0.2, y: 6.02, w: w - 0.4, h: 0.62, fontSize: 8.5, fontFace: BODY,
           lineSpacing: 11.5, margin: 0, valign: 'top' });
    });
    foot(sl);
  });

  // ══ 13. DEEP DIVE DIVIDER (boilerplate) ═══════════════════
  s = p.addSlide();
  s.background = { color: PAPER };
  mark(s);
  s.addText('DEEP DIVE', { x: 0.9, y: 1.3, w: 11, h: 0.3, fontSize: 11, color: LIME, bold: true, charSpacing: 2.2, fontFace: BODY, margin: 0 });
  s.addText('Let\u2019s focus on your channels', { x: 0.9, y: 1.75, w: 11.3, h: 0.9, fontSize: 34, bold: true, color: WHITE, fontFace: HEAD, margin: 0 });
  [['Website', 'How well does your primary brand showcase represent your brand and serve your audience?'],
   ['Social', 'How well does your social media build and engage your audience?'],
   ['AI Reputation', 'How accurately and positively are you showing up in AI search and AI research?'],
   ['Earned', 'How effectively is media being used to promote, protect, and influence your brand?']]
   .forEach(([t, d], i) => {
     const x = 0.9 + (i % 2) * 5.9, y = 3.3 + Math.floor(i / 2) * 1.55;
     s.addText(t, { x, y, w: 5.4, h: 0.38, fontSize: 18, bold: true, color: LIME, fontFace: BODY, margin: 0 });
     s.addText(d, { x, y: y + 0.42, w: 5.4, h: 0.85, fontSize: 12.5, color: BODY_TXT, fontFace: BODY, lineSpacing: 18, margin: 0 });
   });

  // ══ 14-17. CHANNEL SYNTHESIS ══════════════════════════════
  // Uniform shape: insights left, actions right.
  const CHANNELS = [
    ['WEBSITE', 'website', 'Substance requires a stage'],
    ['AI REPUTATION', 'aiReputation', 'Your website tells AI who you are'],
    ['EARNED MEDIA', 'earnedMedia', 'What the market says back'],
    ['SOCIAL MEDIA', 'social', 'How the brand behaves in public'],
  ];
  CHANNELS.forEach(([kicker, key, fallbackTitle]) => {
    const dc = deckContent?.channels?.[key] || {};
    const insights = (dc.insights || []).slice(0, 5);
    const actions = (dc.actions || []).slice(0, 6);
    const sl = p.addSlide();
    sl.background = { color: PAPER };
    heading(sl, kicker, clean(dc.title || fallbackTitle));

    // Standfirst: the channel verdict in one line, above the two columns.
    if (dc.standfirst) {
      sl.addText(clean(dc.standfirst), { x: 0.55, y: 1.5, w: 11.9, h: 0.52,
        fontSize: 13.5, color: WHITE, fontFace: BODY, lineSpacing: 19, margin: 0, valign: 'top' });
    }
    const top = dc.standfirst ? 2.22 : 1.68;

    sl.addText('THE INSIGHTS', { x: 0.55, y: top, w: 6.0, h: 0.28, fontSize: 11,
      bold: true, color: LIME, charSpacing: 1.4, fontFace: BODY, margin: 0 });

    if (insights.length) {
      // Rows are sized to the number of insights so the column fills the slide
      // rather than leaving a third of it empty.
      const avail = 6.55 - (top + 0.42);
      const rowH = Math.min(avail / insights.length, 1.35);
      insights.forEach((t, i) => {
        const lead = typeof t === 'string' ? '' : clean(t?.lead);
        const detail = typeof t === 'string' ? clean(t) : clean(t?.detail);
        const y = top + 0.42 + i * rowH;
        sl.addText([
          ...(lead ? [{ text: lead + ' ', options: { bold: true, color: LIME } }] : []),
          { text: detail, options: { color: BODY_TXT } },
        ], { x: 0.55, y, w: 6.0, h: rowH - 0.08, fontSize: 11, fontFace: BODY,
             lineSpacing: 15, margin: 0, valign: 'top' });
      });
    } else {
      sl.addText('No synthesis available. Generate the readout content from the report page.',
        { x: 0.55, y: top + 0.42, w: 6.0, h: 0.6, fontSize: 11, italic: true, color: DIM, fontFace: BODY, margin: 0 });
    }

    card(sl, 6.9, top - 0.1, 5.55, 6.65 - top);
    sl.addText('THE MOVE', { x: 7.2, y: top + 0.12, w: 5.0, h: 0.28, fontSize: 11,
      bold: true, color: LIME, charSpacing: 1.4, fontFace: BODY, margin: 0 });

    if (actions.length) {
      const availA = (6.65 - top) - 0.62;
      const rowA = Math.min(availA / actions.length, 1.1);
      actions.forEach((t, i) => {
        const y = top + 0.54 + i * rowA;
        sl.addText('\u2192', { x: 7.2, y, w: 0.28, h: 0.24, fontSize: 12, bold: true,
          color: LIME, fontFace: BODY, margin: 0, valign: 'top' });
        sl.addText(clean(t), { x: 7.55, y, w: 4.7, h: rowA - 0.06, fontSize: 11,
          color: BODY_TXT, fontFace: BODY, lineSpacing: 15, margin: 0, valign: 'top' });
      });
    } else {
      sl.addText('No actions available.', { x: 7.2, y: top + 0.54, w: 5.0, h: 0.5,
        fontSize: 11, italic: true, color: DIM, fontFace: BODY, margin: 0 });
    }
    foot(sl);
  });

  // ══ 18. THE BOTTOM LINE ═══════════════════════════════════
  s = p.addSlide();
  s.background = { color: PAPER };
  mark(s);
  s.addText('THE BOTTOM LINE', { x: 0.9, y: 1.4, w: 11, h: 0.3, fontSize: 11, color: LIME, bold: true, charSpacing: 2.2, fontFace: BODY, margin: 0 });
  s.addText(clean(deckContent?.bottomLine?.statement || scores?.headline || ''),
    { x: 0.9, y: 1.95, w: 11.4, h: 1.9, fontSize: 32, bold: true, color: WHITE, fontFace: HEAD, lineSpacing: 44, margin: 0, valign: 'top' });
  s.addText(clean(deckContent?.bottomLine?.support || clean(scores?.justification || '').slice(0, 260)),
    { x: 0.9, y: 4.1, w: 10.5, h: 1.2, fontSize: 15, color: BODY_TXT, fontFace: BODY, lineSpacing: 25, margin: 0 });
  s.addText(nextStage
    ? `${overall} today.  ${nextStage.min} is ${nextStage.name}.  The gap is ${pointsToNext} points.`
    : `${overall} today. The brand is at the top of the scale.`,
    { x: 0.9, y: 5.6, w: 11.4, h: 0.5, fontSize: 15, bold: true, color: LIME, fontFace: BODY, margin: 0 });

  // ══ 19. THANK YOU (boilerplate) ═══════════════════════════
  s = p.addSlide();
  s.background = { color: PAPER };
  s.addText('Conscious Compass', { x: 0.9, y: 2.4, w: 11.5, h: 0.4, fontSize: 15, color: LIME, bold: true, charSpacing: 2.2, fontFace: BODY, margin: 0 });
  s.addText('Thank you for reading', { x: 0.9, y: 2.95, w: 11.5, h: 1.0, fontSize: 42, bold: true, color: WHITE, fontFace: HEAD, margin: 0 });
  if (logo) s.addImage({ data: logo, x: 0.9, y: 0.62, w: 1.05, h: 0.3 });
  s.addText(`Brand consciousness assessment  |  ${dateLabel}`, { x: 0.9, y: 4.1, w: 11.5, h: 0.4, fontSize: 14, color: DIM, fontFace: BODY, margin: 0 });

  const safe = brand.replace(/[^a-z0-9]+/gi, '_');
  await p.writeFile({ fileName: `${safe}_Conscious_Compass_Readout.pptx` });
  return true;
}

// ── fallbacks, used when the Readout Builder has not run ─────
function deriveFindings(scores, benchmark) {
  const ranked = [...ATTRIBUTES].sort((a, b) => (scores?.[a.id]?.score || 0) - (scores?.[b.id]?.score || 0));
  const low = ranked.slice(0, 2), high = ranked[ranked.length - 1];
  const out = [];
  if (high) out.push({ lead: `${high.name} is the strongest attribute at ${scores?.[high.id]?.score || 0}.`, detail: clean(scores?.[high.id]?.impact || '').slice(0, 190) });
  low.forEach(a => out.push({ lead: `${a.name} scores ${scores?.[a.id]?.score || 0}.`, detail: clean(scores?.[a.id]?.impact || '').slice(0, 190) }));
  if (benchmark) {
    const below = ATTRIBUTES.filter(a => (scores?.[a.id]?.score || 0) < (benchmark.attrAvgs?.[a.id] ?? 0)).length;
    out.push({ lead: `${below} of ${ATTRIBUTES.length} attributes sit below the sector average.`, detail: `Benchmarked against ${benchmark.cohortLabel}, n=${benchmark.count}.` });
  }
  return out.slice(0, 4);
}

function defaultBenchmarkRead(scores, benchmark, brand) {
  if (!benchmark) return 'No comparable assessments are available for this sector yet.';
  const gaps = ATTRIBUTES
    .map(a => ({ a, d: (scores?.[a.id]?.score || 0) - (benchmark.attrAvgs?.[a.id] ?? 0) }))
    .sort((x, y) => x.d - y.d);
  const worst = gaps[0], best = gaps[gaps.length - 1];
  const below = gaps.filter(g => g.d < 0).length;
  return `${below} of ${ATTRIBUTES.length} attributes sit below the ${benchmark.cohortLabel.toLowerCase()} average.\n\n`
    + `${worst.a.name} is the widest gap at ${worst.d}. That is where the sector is pulling away from ${brand}.\n\n`
    + `${best.a.name} is the strongest relative position at ${best.d > 0 ? '+' : ''}${best.d}.`;
}
