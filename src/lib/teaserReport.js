// ─────────────────────────────────────────────────────────────
// INDICATIVE READ, THE FIVE-PAGE REPORT (v3.58)
//
// Built to the "Compass Read v2" design handoff: US Letter, 816 x 1056 CSS px
// at 96dpi, drawn as vector straight into the PDF. Page 1 summary, pages 2 and
// 3 the eight attributes, page 4 evidence and the opportunity, page 5 the
// levers, open questions and method.
//
// Coordinates here are the design's own px. jsPDF is created in px units, so
// a px is a px; font sizes convert to points (px * 0.75).
// ─────────────────────────────────────────────────────────────

import { ATTRIBUTES } from '../data/rubric.js';

// Visible space between an evidence item and the rule after it, and the rule
// and the next item, on page 4.
const EVIDENCE_GAP = 12;

export const PAGE = { w: 816, h: 1056, padX: 60, padTop: 52, padBottom: 40 };

const C = {
  paper: '#FBFAF7',
  ink: '#15171A',
  body: '#2E3238',
  muted: '#5B6068',
  faint: '#8A8E95',
  rule: '#DEDAD2',
  track: '#E7E3DB',
  separator: '#C9C4BA',
  accent: '#D9442A',
  accentText: '#C23B22',
  accentOnDark: '#F06A4E',
  positive: '#2F6B55',
  panelRule: '#33363B',
  panelLabel: '#B9BCC1',
};

// Font ids registered with jsPDF, and the files they come from.
export const REPORT_FONTS = [
  { file: 'Newsreader-Regular.ttf', name: 'Newsreader', style: 'normal', url: '/report/Newsreader-Regular.ttf' },
  { file: 'Newsreader-Italic.ttf', name: 'Newsreader', style: 'italic', url: '/report/Newsreader-Italic.ttf' },
  { file: 'HankenGrotesk-Regular.ttf', name: 'Hanken', style: 'normal', url: '/report/HankenGrotesk-Regular.ttf' },
  { file: 'HankenGrotesk-SemiBold.ttf', name: 'HankenSemi', style: 'normal', url: '/report/HankenGrotesk-SemiBold.ttf' },
  { file: 'HankenGrotesk-Bold.ttf', name: 'HankenBold', style: 'normal', url: '/report/HankenGrotesk-Bold.ttf' },
];

const pt = (px) => px * 0.75;

// ── Drawing helpers ───────────────────────────────────────────

function makeDraw(pdf, fontsReady) {
  const font = (family) => {
    if (!fontsReady) { pdf.setFont('helvetica', family === 'display-italic' ? 'italic' : family === 'ui' ? 'normal' : 'bold'); return; }
    if (family === 'display') pdf.setFont('Newsreader', 'normal');
    else if (family === 'display-italic') pdf.setFont('Newsreader', 'italic');
    else if (family === 'ui') pdf.setFont('Hanken', 'normal');
    else if (family === 'ui-semi') pdf.setFont('HankenSemi', 'normal');
    else pdf.setFont('HankenBold', 'normal');
  };

  const set = ({ family = 'ui', size = 13, color = C.body, spacing = 0 }) => {
    font(family);
    pdf.setFontSize(pt(size));
    pdf.setTextColor(color);
    pdf.setCharSpace(spacing ? pt(spacing) : 0);
  };

  // A single line. Returns the width drawn.
  const text = (str, x, y, opts = {}) => {
    set(opts);
    const s = String(str ?? '');
    const align = opts.align || 'left';
    const w = pdf.getTextWidth(s);
    pdf.text(s, align === 'right' ? x - w : align === 'center' ? x - w / 2 : x, y);
    pdf.setCharSpace(0);
    return w;
  };

  const width = (str, opts = {}) => { set(opts); const w = pdf.getTextWidth(String(str ?? '')); pdf.setCharSpace(0); return w; };

  // Wrapped copy. Returns the y after the last line.
  const paragraph = (str, x, y, maxW, opts = {}) => {
    set(opts);
    const lh = opts.lineHeight || 1.6;
    const lines = pdf.splitTextToSize(String(str ?? ''), maxW);
    lines.forEach((line, i) => pdf.text(line, x, y + i * opts.size * lh));
    pdf.setCharSpace(0);
    return y + (lines.length ? (lines.length - 1) * opts.size * lh : 0);
  };

  const paragraphHeight = (str, maxW, opts = {}) => {
    set(opts);
    const lines = pdf.splitTextToSize(String(str ?? ''), maxW);
    pdf.setCharSpace(0);
    return lines.length * opts.size * (opts.lineHeight || 1.6);
  };

  const rule = (x, y, w, color = C.rule, thickness = 1) => {
    pdf.setFillColor(color);
    pdf.rect(x, y, w, thickness, 'F');
  };

  const box = (x, y, w, h, color, radius = 0) => {
    pdf.setFillColor(color);
    if (radius) pdf.roundedRect(x, y, w, h, radius, radius, 'F');
    else pdf.rect(x, y, w, h, 'F');
  };

  // Score bar: track plus fill.
  const bar = (x, y, w, score, { height = 3, fill = C.ink, radius = 0 } = {}) => {
    box(x, y, w, height, C.track, radius);
    const pct = Math.max(0, Math.min(100, Number(score) || 0)) / 100;
    if (pct > 0) box(x, y, w * pct, height, fill, radius);
  };

  // Three dots: one filled for low, two for medium, three for high.
  const confidence = (x, y, level) => {
    const filled = level === 'high' ? 3 : level === 'medium' ? 2 : 1;
    for (let i = 0; i < 3; i++) {
      pdf.setFillColor(i < filled ? C.ink : C.rule);
      pdf.circle(x + i * 10 + 3.5, y, 3.5, 'F');
    }
    text(`${level || 'low'} confidence`.toUpperCase(), x + 30 + 8, y + 3.5,
      { family: 'ui-semi', size: 11, color: C.muted, spacing: 1.1 });
  };

  return { pdf, text, width, paragraph, paragraphHeight, rule, box, bar, confidence, set };
}

// ── Radar ─────────────────────────────────────────────────────
// Eight axes clockwise from twelve o'clock, rings at 25/50/75/100.

export function radarPoints(scores, cx, cy, r) {
  return scores.map((s, i) => {
    const angle = (-90 + 45 * i) * (Math.PI / 180);
    const dist = (Math.max(0, Math.min(100, Number(s) || 0)) / 100) * r;
    return [cx + dist * Math.cos(angle), cy + dist * Math.sin(angle)];
  });
}

function drawRadar(d, attrs, cx, cy, r) {
  const { pdf } = d;
  // Rings
  [25, 50, 75, 100].forEach(pct => {
    const pts = radarPoints(new Array(8).fill(pct), cx, cy, r);
    pdf.setDrawColor(C.rule);
    pdf.setLineWidth(1);
    pts.forEach((p, i) => {
      const q = pts[(i + 1) % pts.length];
      pdf.line(p[0], p[1], q[0], q[1]);
    });
  });
  // Axes
  const outer = radarPoints(new Array(8).fill(100), cx, cy, r);
  outer.forEach(p => pdf.line(cx, cy, p[0], p[1]));

  // Data polygon
  const pts = radarPoints(attrs.map(a => a.score), cx, cy, r);
  pdf.setFillColor(C.accent);
  pdf.setDrawColor(C.accent);
  pdf.setLineWidth(1.5);
  pdf.setLineJoin('round');
  if (typeof pdf.saveGraphicsState === 'function' && typeof pdf.GState === 'function') {
    pdf.saveGraphicsState();
    pdf.setGState(new pdf.GState({ opacity: 0.14 }));
    pdf.lines(pts.slice(1).map((p, i) => [p[0] - pts[i][0], p[1] - pts[i][1]]).concat([[pts[0][0] - pts[7][0], pts[0][1] - pts[7][1]]]), pts[0][0], pts[0][1], [1, 1], 'F', true);
    pdf.restoreGraphicsState();
  }
  pts.forEach((p, i) => {
    const q = pts[(i + 1) % pts.length];
    pdf.line(p[0], p[1], q[0], q[1]);
  });

  // Labels, pushed out from the centre, with the top score in accent.
  const top = attrs.reduce((best, a) => (a.score > best.score ? a : best), attrs[0]);
  attrs.forEach((a, i) => {
    const angle = (-90 + 45 * i) * (Math.PI / 180);
    const lx = cx + Math.cos(angle) * (r + 26);
    // the label below the chart sits closer, so it clears the rule under it
    const ly = cy + Math.sin(angle) * (r + (Math.sin(angle) > 0.9 ? 14 : 20)) + 3;
    const align = Math.abs(Math.cos(angle)) < 0.2 ? 'center' : Math.cos(angle) > 0 ? 'left' : 'right';
    const label = a.name.toUpperCase();
    const w = d.width(label, { family: 'ui-semi', size: 10, spacing: 0.8 });
    const numW = d.width(` ${a.score}`, { family: 'ui-semi', size: 10, spacing: 0.8 });
    const startX = align === 'left' ? lx : align === 'right' ? lx - (w + numW) : lx - (w + numW) / 2;
    d.text(label, startX, ly, { family: 'ui-semi', size: 10, color: C.muted, spacing: 0.8 });
    d.text(` ${a.score}`, startX + w, ly, { family: 'ui-semi', size: 10, color: a.key === top.key ? C.accent : C.ink, spacing: 0.8 });
  });
}

// ── Page furniture ────────────────────────────────────────────

function pageShell(d, data, pageNo, total) {
  const { padX, padTop, w, h, padBottom } = { ...PAGE, w: PAGE.w, h: PAGE.h };
  d.box(0, 0, w, h, C.paper);

  // Running header
  const leftLabel = pageNo === 1 ? 'ANTENNA GROUP' : String(data.brand.name || '').toUpperCase();
  let x = padX;
  x += d.text(leftLabel, x, padTop + 10, { family: 'ui-semi', size: 11, color: C.ink, spacing: 1.5 });
  x += 10;
  d.pdf.setFillColor(C.accent);
  d.pdf.circle(x + 3, padTop + 6.5, 3, 'F');
  x += 16;
  d.text('CONSCIOUS COMPASS', x, padTop + 10, { family: 'ui-semi', size: 11, color: C.muted, spacing: 1.5 });
  d.text(`Indicative read \u00B7 ${data.date}`, w - padX, padTop + 10, { family: 'ui', size: 11, color: C.muted, align: 'right' });
  d.rule(padX, padTop + 24, w - padX * 2, C.ink);

  // Footer
  const footY = h - padBottom - 6;
  d.rule(padX, footY - 20, 0, C.rule, 0);
  d.text('ANTENNA GROUP \u00B7 CONSCIOUS COMPASS \u00B7 INDICATIVE READ', padX, footY, { family: 'ui-semi', size: 10.5, color: C.faint, spacing: 1 });
  d.text(`0${pageNo} / 0${total}`, w - padX, footY, { family: 'ui-semi', size: 10.5, color: C.faint, spacing: 1, align: 'right' });

  return { top: padTop + 24, left: padX, right: w - padX, width: w - padX * 2, bottom: footY - 26 };
}

const eyebrow = (d, str, x, y, color = C.muted) =>
  d.text(String(str).toUpperCase(), x, y, { family: 'ui-semi', size: 11, color, spacing: 1.5 });

// ── Pages ─────────────────────────────────────────────────────

function pageSummary(d, data) {
  const a = pageShell(d, data, 1, 5);
  let y = a.top + 28;

  // Brand block
  eyebrow(d, 'Brand under review', a.left, y + 10);
  d.text(data.brand.name, a.left, y + 66, { family: 'display', size: 68, color: C.ink });
  if (data.brand.url) {
    const host = String(data.brand.url).replace(/^https?:\/\//, '').replace(/\/$/, '');
    d.text(`${host} \u2197`, a.right, y + 66, { family: 'ui', size: 13, color: C.muted, align: 'right' });
  }
  y += 88;

  // Score row
  d.rule(a.left, y, a.width);
  const rowTop = y + 28;
  const half = a.width / 2;
  eyebrow(d, 'Overall score', a.left, rowTop + 8);
  const band = String(data.overall.band || '').toUpperCase();
  if (band) {
    const bw = d.width(band, { family: 'ui-semi', size: 11, spacing: 1.3 }) + 18;
    d.box(a.left + d.width('OVERALL SCORE', { family: 'ui-semi', size: 11, spacing: 1.5 }) + 14, rowTop - 5, bw, 20, C.ink, 2);
    d.text(band, a.left + d.width('OVERALL SCORE', { family: 'ui-semi', size: 11, spacing: 1.5 }) + 23, rowTop + 8, { family: 'ui-semi', size: 11, color: C.paper, spacing: 1.3 });
  }
  d.text(String(data.overall.score), a.left, rowTop + 122, { family: 'display', size: 132, color: C.ink });
  const numW = d.width(String(data.overall.score), { family: 'display', size: 132 });
  d.text('/ 100', a.left + numW + 12, rowTop + 122, { family: 'ui', size: 16, color: C.muted });
  d.bar(a.left, rowTop + 148, half - 28, data.overall.score, { height: 6, fill: C.accent, radius: 3 });
  ['0', '50', '100'].forEach((t, i) => {
    const bw = half - 28;
    d.text(t, a.left + (bw * i) / 2, rowTop + 168, { family: 'ui', size: 10, color: C.faint, align: i === 0 ? 'left' : i === 1 ? 'center' : 'right' });
  });
  d.rule(a.left + half, y, 1, C.rule);
  d.pdf.setFillColor(C.rule);
  d.pdf.rect(a.left + half, y, 1, 200, 'F');

  // Radar, right cell
  drawRadar(d, data.attributes, a.left + half + half / 2, rowTop + 74, 70);

  y = y + 200;
  d.rule(a.left, y, a.width);

  // Pillars
  const cellW = a.width / 4;
  data.pillars.forEach((p, i) => {
    const x = a.left + i * cellW + (i === 0 ? 0 : 18);
    eyebrow(d, p.name, x, y + 30);
    d.text(String(p.score), x, y + 76, { family: 'display', size: 44, color: C.ink });
    d.bar(x, y + 92, cellW - 36, p.score);
    if (i > 0) { d.pdf.setFillColor(C.rule); d.pdf.rect(a.left + i * cellW, y, 1, 110, 'F'); }
  });
  y += 110;
  d.rule(a.left, y, a.width);

  // Optional caveat
  if (data.limitedEvidence) {
    d.text('!', a.left, y + 28, { family: 'ui-bold', size: 13, color: C.accent });
    const lead = 'Limited evidence in this read. ';
    const lw = d.width(lead, { family: 'ui-bold', size: 12.5 });
    d.text(lead, a.left + 24, y + 28, { family: 'ui-bold', size: 12.5, color: C.ink });
    d.paragraph(data.limitedEvidenceNote || 'Several scores rest on the limited evidence a quick read can reach. A full assessment would firm them up.',
      a.left + 24 + lw, y + 28, a.width - 24 - lw, { family: 'ui', size: 12.5, color: C.muted, lineHeight: 1.5 });
    y += 46;
    d.rule(a.left, y, a.width);
    y += 20;
  } else {
    y += 28;
  }

  // Headline and narrative
  const headH = d.paragraphHeight(data.headline, a.width, { family: 'display', size: 26, lineHeight: 1.2 });
  d.paragraph(data.headline, a.left, y + 20, a.width, { family: 'display', size: 26, color: C.ink, lineHeight: 1.2 });
  y += 20 + headH + 4;
  d.paragraph(data.narrative, a.left, y + 12, a.width, { family: 'ui', size: 15, color: C.body, lineHeight: 1.6 });
}

function pageAttributes(d, data, pageNo, from, to) {
  const a = pageShell(d, data, pageNo, 5);
  let y = a.top + 36;
  d.text('The eight attributes', a.left, y + 34, { family: 'display', size: 40, color: C.ink });
  eyebrow(d, `${from + 1}\u2013${to} of 8`, a.right - d.width(`${from + 1}\u2013${to} OF 8`, { family: 'ui-semi', size: 11, spacing: 1.5 }), y + 34);
  y += 48;

  const set = data.attributes.slice(from, to);
  const topScore = Math.max(...set.map(s => s.score));
  const rowPad = 24;
  set.forEach(attr => {
    d.rule(a.left, y, a.width);
    const isTop = attr.score === topScore;
    d.text(String(attr.score), a.left, y + rowPad + 38, { family: 'display', size: 52, color: isTop ? C.accent : C.ink });
    d.bar(a.left, y + rowPad + 52, 88, attr.score, { fill: isTop ? C.accent : C.ink });

    const cx = a.left + 112;
    const cw = a.width - 112;
    const nameW = d.text(attr.name, cx, y + rowPad + 16, { family: 'ui-bold', size: 19, color: C.ink });
    d.text(attr.subtitle, cx + nameW + 10, y + rowPad + 16, { family: 'ui', size: 14, color: C.muted });
    d.confidence(a.right - 118, y + rowPad + 11, attr.confidence);
    const h = d.paragraphHeight(attr.rationale, cw, { family: 'ui', size: 15, lineHeight: 1.6 });
    d.paragraph(attr.rationale, cx, y + rowPad + 40, cw, { family: 'ui', size: 15, color: C.body, lineHeight: 1.6 });
    y += rowPad * 2 + Math.max(60, h + 26);
  });
}

function pageEvidence(d, data) {
  const a = pageShell(d, data, 4, 5);
  let y = a.top + 28;
  eyebrow(d, 'Trust, credibility, reputation and authenticity', a.left, y + 10);
  d.text('The evidence', a.left, y + 52, { family: 'display', size: 40, color: C.ink });
  y += 84;

  const colW = (a.width - 28) / 2;
  const supporting = data.evidence.filter(e => e.polarity === '+');
  const against = data.evidence.filter(e => e.polarity !== '+');

  let deepest = y;
  [[supporting, '+ Supporting', C.positive, a.left], [against, '\u2013 Weighing against', C.accentText, a.left + colW + 28]]
    .forEach(([items, title, color, x]) => {
      d.text(title.toUpperCase(), x, y, { family: 'ui-bold', size: 11, color, spacing: 1.5 });
      d.rule(x, y + 8, colW, color === C.positive ? C.positive : C.accent, 2);
      let cy = y + 28;
      items.forEach((item, i) => {
        const h = d.paragraphHeight(item.claim, colW, { family: 'ui', size: 13.5, lineHeight: 1.5 });
        d.paragraph(item.claim, x, cy, colW, { family: 'ui', size: 13.5, color: C.body, lineHeight: 1.5 });
        cy += h;
        const meta = [item.source, (item.tags || []).join(', ').toUpperCase()].filter(Boolean).join('  \u00B7  ');
        if (meta) {
          const mh = d.paragraphHeight(meta, colW, { family: 'ui', size: 10.5, lineHeight: 1.4 });
          d.paragraph(meta, x, cy + 4, colW, { family: 'ui', size: 10.5, color: C.muted, lineHeight: 1.4 });
          cy += mh + 4;
        }
        // y is a baseline, so the next claim needs its cap height clear of
        // the rule as well as the gap. Equal visible space either side of
        // the rule (v3.115.0: the rule sat on the next claim's letters).
        cy += 2;
        if (i < items.length - 1) { d.rule(x, cy, colW); cy += EVIDENCE_GAP + Math.round(13.5 * 0.75); }
      });
      deepest = Math.max(deepest, cy);
    });
  y = deepest;

  // The opportunity, sized to its copy and pinned above the footer.
  if (data.opportunity) {
    const oppW = a.width - 170;
    let size = 19;
    let h = d.paragraphHeight(data.opportunity, oppW, { family: 'display', size, lineHeight: 1.5 });
    // Long copy steps down rather than running off the page.
    while (h > 210 && size > 14) {
      size -= 1;
      h = d.paragraphHeight(data.opportunity, oppW, { family: 'display', size, lineHeight: 1.5 });
    }
    const oppY = Math.max(y + 24, a.bottom - h - 44);
    d.rule(a.left, oppY, a.width, C.ink);
    d.text('The opportunity'.toUpperCase(), a.left, oppY + 30, { family: 'ui-bold', size: 11, color: C.accentText, spacing: 1.5 });
    d.paragraph(data.opportunity, a.left + 170, oppY + 30, oppW, { family: 'display', size, color: C.ink, lineHeight: 1.5 });
  }
}

function pageLevers(d, data) {
  const a = pageShell(d, data, 5, 5);
  let y = a.top + 22;
  d.text('Where marketing would move this score', a.left, y + 34, { family: 'display', size: 40, color: C.ink });
  y += 52;

  data.levers.forEach((lever, i) => {
    d.text(String(i + 1).padStart(2, '0'), a.left, y + 30, { family: 'display', size: 34, color: C.accent });
    const cx = a.left + 76;
    const cw = a.width - 76;
    d.text(lever.title, cx, y + 26, { family: 'ui-bold', size: 19, color: C.ink });
    let tagX = a.right;
    [...(lever.attributes || [])].reverse().forEach(tag => {
      const tw = d.width(tag.toUpperCase(), { family: 'ui-semi', size: 10.5, spacing: 0.8 }) + 14;
      d.pdf.setDrawColor(C.separator);
      d.pdf.setLineWidth(1);
      d.pdf.roundedRect(tagX - tw, y + 12, tw, 18, 2, 2, 'S');
      d.text(tag.toUpperCase(), tagX - tw + 7, y + 25, { family: 'ui-semi', size: 10.5, color: C.ink, spacing: 0.8 });
      tagX -= tw + 6;
    });
    let ly = y + 46;
    if (lever.gap) {
      const h = d.paragraphHeight(lever.gap, cw, { family: 'ui', size: 14.5, lineHeight: 1.5 });
      d.paragraph(lever.gap, cx, ly, cw, { family: 'ui', size: 14.5, color: C.body, lineHeight: 1.5 });
      ly += h + 2;
    }
    if (lever.why) {
      const h = d.paragraphHeight(lever.why, cw, { family: 'display-italic', size: 15, lineHeight: 1.4 });
      d.paragraph(lever.why, cx, ly + 4, cw, { family: 'display-italic', size: 15, color: C.muted, lineHeight: 1.4 });
      ly += h + 4;
    }
    y = ly + 14;
    if (i < data.levers.length - 1) { d.rule(a.left, y, a.width); y += 14; }
  });

  // Open questions, on ink
  const questions = (data.questions || []).slice(0, 3);
  if (questions.length) {
    const colWidth = (a.width - 48 - 36) / questions.length;
    const tallest = Math.max(...questions.map(q => d.paragraphHeight(q, colWidth, { family: 'ui', size: 13, lineHeight: 1.5 })));
    const panelH = Math.round(80 + tallest + 18);
    const panelY = Math.min(y + 10, a.bottom - panelH - 96);
    d.box(a.left, panelY, a.width, panelH, C.ink, 2);
    eyebrow(d, 'What a full assessment would settle', a.left + 24, panelY + 30, C.panelLabel);
    const colW = colWidth;
    questions.forEach((q, i) => {
      const x = a.left + 24 + i * (colW + 18);
      d.text(`0${i + 1}`, x, panelY + 60, { family: 'display', size: 18, color: C.accentOnDark });
      d.paragraph(q, x, panelY + 80, colW, { family: 'ui', size: 13, color: C.paper, lineHeight: 1.5 });
      if (i < questions.length - 1) { d.pdf.setFillColor(C.panelRule); d.pdf.rect(x + colW + 9, panelY + 44, 1, panelH - 62, 'F'); }
    });
    y = panelY + panelH + 18;
  }

  if (data.method) {
    eyebrow(d, 'Method', a.left, y + 12);
    d.paragraph(data.method, a.left, y + 30, a.width, { family: 'ui', size: 11.5, color: C.muted, lineHeight: 1.5 });
  }
}

// ── Entry point ───────────────────────────────────────────────

export function drawTeaserReport(pdf, data, { fontsReady = false } = {}) {
  const d = makeDraw(pdf, fontsReady);
  pageSummary(d, data);
  pdf.addPage([PAGE.w, PAGE.h], 'portrait');
  pageAttributes(d, data, 2, 0, 4);
  pdf.addPage([PAGE.w, PAGE.h], 'portrait');
  pageAttributes(d, data, 3, 4, 8);
  pdf.addPage([PAGE.w, PAGE.h], 'portrait');
  pageEvidence(d, data);
  pdf.addPage([PAGE.w, PAGE.h], 'portrait');
  pageLevers(d, data);
  return pdf;
}

// The client payload, shaped for the template.
export function reportData(payload) {
  const attrs = ATTRIBUTES.map(a => ({
    key: a.id.toLowerCase(),
    name: a.name,
    subtitle: a.fullName,
    score: payload.scores?.[a.id]?.score ?? 0,
    confidence: payload.scores?.[a.id]?.confidence || 'low',
    rationale: payload.scores?.[a.id]?.rationale || '',
  }));
  return {
    brand: { name: payload.brandName, url: payload.websiteUrl },
    date: payload.scoredAt ? new Date(payload.scoredAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : '',
    framework: `Conscious Compass v${payload.frameworkVersion}`,
    overall: { score: payload.overall, band: payload.stage },
    pillars: [
      { name: 'Credibility', score: payload.lensScores?.credibility },
      { name: 'Trust', score: payload.lensScores?.trust },
      { name: 'Reputation', score: payload.lensScores?.reputation },
      { name: 'Authenticity', score: payload.lensScores?.authenticity },
    ],
    limitedEvidence: !!payload.thinRecord,
    headline: payload.headline,
    narrative: payload.summary,
    attributes: attrs,
    evidence: (payload.scores?.trustFindings || []).map(f => ({
      polarity: f.supports ? '+' : '-',
      claim: f.kind === 'gap' ? `${f.text} (not found)` : f.text,
      source: '',
      tags: f.tags || [],
    })),
    opportunity: payload.opportunity || '',
    levers: (payload.services || []).map(s => ({ title: s.title, attributes: s.attributes || [], gap: s.why, why: s.impact })),
    questions: payload.fullAssessmentWouldResolve || [],
    method: `An indicative read against the Conscious Compass framework v${payload.frameworkVersion}, built from publicly observable evidence gathered in a single automated pass: the brand's website, a social scan, an AI perception read, review and search signals, and an earned media scan. Scores use the Compass rubric, judged on the evidence this read can reach. The full assessment adds five AI engines, verified channel data, technical and paid media audits, and expert review.`,
  };
}
