// ─────────────────────────────────────────────────────────────
// PITCH SLIDE, BUILT AS NATIVE POWERPOINT SHAPES (v3.48)
//
// The slide used to be an HTML frame screenshotted into a picture. That cost
// fidelity (web fonts fell back, the highlighted headline painted over the
// line above) and left nothing editable. It is now real shapes and real text:
// it opens in Google Slides with every word selectable, and the layout is
// computed here rather than by a browser.
//
// Geometry is the slide template's own CSS. The frame is 1920 x 1080 CSS px
// on a 13.333 x 7.5in slide, so 144px = 1in exactly: 1px = 0.5pt = 6350 EMU.
// ─────────────────────────────────────────────────────────────

export const EMU_PER_PX = 6350;
export const SLIDE_PX = { w: 1920, h: 1080 };
const emu = (px) => Math.round(px * EMU_PER_PX);
const sz = (px) => Math.round(px * 50);            // font size in 1/100 pt
const spc = (em, px) => Math.round(em * px * 50);  // letter spacing in 1/100 pt

const C = {
  ground: '171B26', panel: '1D2230', keyline: '3A4152', well: '0F121A',
  lime: 'D9E021', ink: 'F2F5F0', muted: 'AEBFCB', dim: '7E8BA0',
  gradFrom: 'F5EFD5', gradMid: 'F0DA1E', gradTo: 'E04A26',
};

const esc = (v) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const num = (v) => (Number.isFinite(Number(v)) ? String(Math.round(Number(v))) : '\u2014');

export const slideNamePx = (brand) => { const n = String(brand || '').length; return n > 24 ? 40 : n > 16 ? 54 : n > 9 ? 66 : 84; };

// ── XML helpers ───────────────────────────────────────────────

let uid = 1;
const nv = (name) => `<p:nvSpPr><p:cNvPr id="${++uid}" name="${esc(name)}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>`;
const solidFill = (color, alpha = null) => `<a:solidFill><a:srgbClr val="${color}">${alpha !== null ? `<a:alpha val="${Math.round(alpha * 100000)}"/>` : ''}</a:srgbClr></a:solidFill>`;
const xfrm = (x, y, w, h) => `<a:xfrm><a:off x="${emu(x)}" y="${emu(y)}"/><a:ext cx="${emu(w)}" cy="${emu(h)}"/></a:xfrm>`;

// A run of text. `color`, `size` in px, optional bold, tracking and font.
const run = (text, { size, color = C.ink, bold = true, tracking = 0, font = 'Inter' }) =>
  `<a:r><a:rPr lang="en-US" sz="${sz(size)}" b="${bold ? 1 : 0}" dirty="0"${tracking ? ` spc="${spc(tracking, size)}"` : ''}>` +
  `<a:solidFill><a:srgbClr val="${color}"/></a:solidFill><a:latin typeface="${font}"/><a:cs typeface="${font}"/></a:rPr>` +
  `<a:t>${esc(text)}</a:t></a:r>`;

// A paragraph. `lineHeight` is a multiple, `align` l|ctr|r, `space` px before.
// `lineHeight` is a multiple of the font size, applied as exact points:
// spcPct would add the font's own leading on top and run the text tall.
const para = (runs, { lineHeight = 1, align = 'l', spaceBefore = 0, size = 26 } = {}) =>
  `<a:p><a:pPr algn="${align}">` +
  `<a:lnSpc><a:spcPts val="${Math.round(lineHeight * size * 50)}"/></a:lnSpc>` +
  (spaceBefore ? `<a:spcBef><a:spcPts val="${Math.round(spaceBefore * 50)}"/></a:spcBef>` : '') +
  `</a:pPr>${runs}</a:p>`;

// A text box with no fill, insets zeroed so px positions land where intended.
const textBox = (name, x, y, w, h, paras, { anchor = 't', wrap = 'square' } = {}) =>
  `<p:sp>${nv(name)}<p:spPr>${xfrm(x, y, w, h)}<a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/></p:spPr>` +
  `<p:txBody><a:bodyPr lIns="0" tIns="0" rIns="0" bIns="0" anchor="${anchor}" wrap="${wrap}"><a:noAutofit/></a:bodyPr><a:lstStyle/>${paras}</p:txBody></p:sp>`;

// A filled rectangle, optionally with a border and its own text.
const rect = (name, x, y, w, h, fill, { line = null, lineW = 1, alpha = null, paras = '', anchor = 'ctr', insets = 0, wrap = 'square' } = {}) =>
  `<p:sp>${nv(name)}<p:spPr>${xfrm(x, y, w, h)}<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>` +
  (fill ? solidFill(fill, alpha) : '<a:noFill/>') +
  (line ? `<a:ln w="${emu(lineW)}"><a:solidFill><a:srgbClr val="${line}"/></a:solidFill></a:ln>` : '<a:ln><a:noFill/></a:ln>') +
  `</p:spPr><p:txBody><a:bodyPr lIns="${emu(insets)}" tIns="0" rIns="${emu(insets)}" bIns="0" anchor="${anchor}" wrap="${wrap}"><a:noAutofit/></a:bodyPr><a:lstStyle/>${paras || '<a:p/>'}</p:txBody></p:sp>`;

// The three-stop bar, as a gradient fill rather than a strip of slivers.
const gradientBar = (name, x, y, w, h) =>
  `<p:sp>${nv(name)}<p:spPr>${xfrm(x, y, w, h)}<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>` +
  `<a:gradFill flip="none" rotWithShape="1"><a:gsLst>` +
  `<a:gs pos="0"><a:srgbClr val="${C.gradFrom}"><a:alpha val="0"/></a:srgbClr></a:gs>` +
  `<a:gs pos="25000"><a:srgbClr val="${C.gradFrom}"/></a:gs>` +
  `<a:gs pos="60000"><a:srgbClr val="${C.gradMid}"/></a:gs>` +
  `<a:gs pos="100000"><a:srgbClr val="${C.gradTo}"/></a:gs>` +
  `</a:gsLst><a:lin ang="0" scaled="0"/></a:gradFill><a:ln><a:noFill/></a:ln></p:spPr>` +
  `<p:txBody><a:bodyPr/><a:lstStyle/><a:p/></p:txBody></p:sp>`;

// A picture, cropped to fill its frame the way object-fit: cover does.
const picture = (name, rId, x, y, w, h, ratio) => {
  const frame = w / h;
  let l = 0, t = 0;
  if (ratio > frame) { const keep = frame / ratio; l = (1 - keep) / 2; }
  else if (ratio < frame) { const keep = ratio / frame; t = (1 - keep) / 2; }
  const pct = (v) => Math.round(v * 100000);
  return `<p:pic><p:nvPicPr><p:cNvPr id="${++uid}" name="${esc(name)}"/><p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr/></p:nvPicPr>` +
    `<p:blipFill><a:blip r:embed="${rId}"/><a:srcRect l="${pct(l)}" r="${pct(l)}" t="${pct(t)}" b="${pct(t)}"/><a:stretch><a:fillRect/></a:stretch></p:blipFill>` +
    `<p:spPr>${xfrm(x, y, w, h)}<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic>`;
};

// ── Layout ────────────────────────────────────────────────────
// Every number here is the template's own CSS value in px.

export function slideLayout(d) {
  const PAD_X = 72, PAD_TOP = 52, PAD_BOTTOM = 86;
  const contentW = SLIDE_PX.w - PAD_X * 2;
  const headerH = 46, headerGap = 22, gridTop = PAD_TOP + headerH + headerGap + 28;
  const colGap = 56;
  const leftW = Math.round((contentW - colGap) * 1.15 / 2);
  const rightW = contentW - colGap - leftW;
  const leftX = PAD_X, rightX = PAD_X + leftW + colGap;
  const bottom = SLIDE_PX.h - PAD_BOTTOM;

  const namePx = slideNamePx(d.brand);
  const nameY = gridTop;
  const wellY = nameY + namePx + 26;
  const tileH = 18 + 54 + 12 + Math.round(14 * 1.2) + 20;
  const footH = Math.round(15 * 1.2);
  const wellH = bottom - wellY - 22 - footH - 14 - tileH;
  const tileGap = 16;
  const tileW = (leftW - tileGap * 3) / 4;

  return {
    PAD_X, PAD_TOP, bottom, leftX, leftW, rightX, rightW, gridTop,
    namePx, nameY, wellY, wellH, footY: wellY + wellH + 22, footH,
    tileY: wellY + wellH + 22 + footH + 14, tileH, tileW, tileGap,
    plateH: 20 * 2 + 76, chipH: 12 * 2 + 32, chipAbove: 122,
    qrBlockH: 26 * 2 + 126,
  };
}

// ── Slide ─────────────────────────────────────────────────────

export function buildSlideShapes(d, rels = {}) {
  uid = 1;
  const L = slideLayout(d);
  const s = [];

  s.push(rect('Ground', 0, 0, SLIDE_PX.w, SLIDE_PX.h, C.ground));

  // Header: eyebrow left, logos right.
  s.push(textBox('Eyebrow', L.PAD_X, L.PAD_TOP + 6, 700, 40,
    para(run('The ', { size: 27, tracking: 0.14 }) + run('conscious ', { size: 27, color: C.lime, tracking: 0.14 }) + run('compass', { size: 27, tracking: 0.14 }), { size: 27, lineHeight: 1.2 })));
  if (rels.howl) s.push(picture('Howl', rels.howl, SLIDE_PX.w - L.PAD_X - 150, L.PAD_TOP, 150, 46, 900 / 269));
  if (rels.antenna) s.push(picture('Antenna Group', rels.antenna, SLIDE_PX.w - L.PAD_X - 150 - 28 - 149, L.PAD_TOP + 4, 149, 38, 784 / 200));

  // Left column: name, image well, plate, chip, footer, tiles.
  s.push(textBox('Brand', L.leftX, L.nameY, L.leftW, L.namePx * 1.1,
    para(run(String(d.brand || '').toUpperCase(), { size: L.namePx, tracking: 0.01 }), { lineHeight: 1, size: L.namePx })));

  // No keyline around the image: the grey border was dropped by request.
  s.push(rect('Image well', L.leftX, L.wellY, L.leftW, L.wellH, C.well));
  if (rels.hero) s.push(picture('Brand image', rels.hero, L.leftX, L.wellY, L.leftW, L.wellH, d.heroRatio || 1.6));

  const plateY = L.wellY + L.wellH - L.plateH;
  const chipY = L.wellY + L.wellH - L.chipAbove - L.chipH;
  const chipLabelW = 190, chipNumW = 46, chipW = 28 * 2 + chipLabelW + 16 + chipNumW;
  s.push(rect('Industry average', L.leftX + L.leftW - chipW, chipY, chipW, L.chipH, C.well, { alpha: 0.88 }));
  s.push(textBox('Industry average label', L.leftX + L.leftW - chipW + 28, chipY + 18, chipLabelW, 24,
    para(run('INDUSTRY AVERAGE', { size: 15, color: C.muted, bold: false, tracking: 0.12 }), { size: 15, lineHeight: 1.2 })));
  s.push(textBox('Industry average value', L.leftX + L.leftW - 28 - chipNumW, chipY + 10, chipNumW, 40,
    para(run(num(d.baseline), { size: 32 }), { align: 'r', size: 32, lineHeight: 1 })));

  const plateLabelW = 200, plateNumW = 190;
  const plateW = 28 * 2 + plateLabelW + 22 + plateNumW;
  s.push(rect('Compass score plate', L.leftX + L.leftW - plateW, plateY, plateW, L.plateH, C.lime));
  s.push(textBox('Compass score label', L.leftX + L.leftW - plateW + 28, plateY + 32, plateLabelW, 60,
    para(run('YOUR COMPASS', { size: 16, color: C.ground, bold: false, tracking: 0.14 }), { lineHeight: 1.3, size: 16 }) +
    para(run('SCORE', { size: 16, color: C.ground, bold: false, tracking: 0.14 }), { lineHeight: 1.3, size: 16 })));
  s.push(textBox('Compass score value', L.leftX + L.leftW - 28 - plateNumW, plateY + 18, plateNumW, 86,
    para(run(num(d.overall), { size: 76, color: C.ground }) + run('/100', { size: 26, color: C.ground, bold: false }), { align: 'r', lineHeight: 1, size: 76 })));

  s.push(textBox('Measured by', L.leftX, L.footY, L.leftW, L.footH + 6,
    para(run('INDICATIVE SCORES MEASURED BY THE CONSCIOUS COMPASS TEASER ASSESSMENT', { size: 15, color: C.dim, tracking: 0.18 }), { size: 15, lineHeight: 1.2 })));

  [['credibility', 'CREDIBILITY'], ['trust', 'TRUST'], ['reputation', 'REPUTATION'], ['authenticity', 'AUTHENTICITY']]
    .forEach(([key, label], i) => {
      const x = L.leftX + i * (L.tileW + L.tileGap);
      s.push(rect(`Tile ${label}`, x, L.tileY, L.tileW, L.tileH, C.panel, { line: C.keyline, lineW: 1 }));
      s.push(textBox(`${label} value`, x, L.tileY + 18, L.tileW, 60, para(run(num(d[key]), { size: 54 }), { align: 'ctr', lineHeight: 1, size: 54 })));
      s.push(textBox(`${label} label`, x, L.tileY + 18 + 54 + 12, L.tileW, 24, para(run(label, { size: 14, color: C.muted, tracking: 0.12 }), { align: 'ctr', size: 14, lineHeight: 1.2 })));
    });

  // Right column.
  let y = L.gridTop;
  const headSize = 60, headLine = 1.18, headStep = headSize * headLine;
  ['CONSEQUENTIAL', 'BRANDS ARE'].forEach((line, i) => {
    s.push(textBox(`Headline ${i + 1}`, L.rightX, y + i * headStep, L.rightW, headStep,
      para(run(line, { size: headSize }), { lineHeight: headLine, size: headSize })));
  });
  y += headStep * 2;
  // The highlight is a lime block behind its own line, so it can never sit
  // over the line above the way an inline background did.
  const highlightText = 'CONSCIOUS BRANDS';
  const highlightW = Math.min(L.rightW, Math.round(headSize * 0.72 * highlightText.length) + 20);
  s.push(rect('Highlight', L.rightX, y, highlightW, headStep, C.lime, {
    insets: 8, anchor: 'ctr', wrap: 'none',
    paras: para(run(highlightText, { size: headSize, color: C.ground }), { lineHeight: headLine, size: headSize }),
  }));
  y += headStep + 20;

  s.push(textBox('Lead', L.rightX, y, L.rightW, 48, para(run('How you show up means something.', { size: 34 }), { lineHeight: 1.2, size: 34 })));
  y += 34 * 1.2 + 12;
  const bodyA = 'Antenna Group\u2019s proprietary brand diagnostic assesses how well brands with purpose meet the world.';
  const bodyB = 'It scores your credibility, trust, reputation, and influence, and pinpoints the marketing opportunities that will sharpen your impact.';
  s.push(textBox('Body', L.rightX, y, L.rightW, 26 * 1.26 * 6,
    para(run(bodyA, { size: 26, bold: false }), { lineHeight: 1.26, size: 26 }) +
    para(run(bodyB, { size: 26, bold: false }), { lineHeight: 1.26, size: 26, spaceBefore: 12 })));
  y += 26 * 1.26 * 5 + 12;

  s.push(rect('Divider', L.rightX, y, L.rightW, 1, C.keyline));
  y += 13;
  s.push(textBox('Teaser note', L.rightX, y, L.rightW, 23.4 * 1.26 * 2 + 8,
    para(run('The scores shown here come from our teaser assessment.', { size: 23.4, bold: false }), { lineHeight: 1.26, size: 23.4 }) +
    para(run('Contact us for a deeper dive into your brand.', { size: 23.4, bold: false }), { lineHeight: 1.26, size: 23.4 })));
  y += 23.4 * 1.26 * 2 + 20;

  const linkW = 380;
  s.push(textBox('Link', L.rightX, y, linkW, 48, para(run('antennagroup.com', { size: 36, color: C.lime }), { lineHeight: 1.2, size: 36 }), { wrap: 'none' }));
  s.push(gradientBar('Gradient', L.rightX + linkW + 20, y + 16, L.rightW - linkW - 20, 10));

  const qrY = L.bottom - L.qrBlockH;
  s.push(rect('Call to action', L.rightX, qrY, L.rightW, L.qrBlockH, C.lime));
  if (rels.qr) s.push(picture('QR code', rels.qr, L.rightX + 30, qrY + 26, 126, 126, 1));
  s.push(textBox('CTA head', L.rightX + 30 + 126 + 28, qrY + 30, L.rightW - 30 - 126 - 28 - 30, 90,
    para(run('ARE YOU', { size: 36, color: C.ground }), { lineHeight: 1.02, size: 36 }) +
    para(run('CONSCIOUS?', { size: 36, color: C.ground }), { lineHeight: 1.02, size: 36 })));
  s.push(textBox('CTA sub', L.rightX + 30 + 126 + 28, qrY + 30 + 36 * 1.02 * 2 + 10, L.rightW - 30 - 126 - 58, 30,
    para(run('Scan to find out \u2192 antennagroup.com', { size: 21, color: C.ground }), { lineHeight: 1.3, size: 21 })));

  return s.join('\n');
}

export function slideXml(d, rels) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
<p:cSld><p:spTree>
<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
<p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${emu(SLIDE_PX.w)}" cy="${emu(SLIDE_PX.h)}"/><a:chOff x="0" y="0"/><a:chExt cx="${emu(SLIDE_PX.w)}" cy="${emu(SLIDE_PX.h)}"/></a:xfrm></p:grpSpPr>
${buildSlideShapes(d, rels)}
</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>
</p:sld>`;
}
