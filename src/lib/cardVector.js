// ─────────────────────────────────────────────────────────────
// CARD FRONT, DRAWN AS VECTOR (v3.43)
//
// The front is drawn straight into the PDF rather than rendered from HTML.
// Rendering HTML to a canvas cost us sharpness and, worse, fidelity: web
// fonts loaded differently run to run, CSS filters were ignored and inline
// highlight boxes painted over the line above.
//
// The geometry below is the template's own CSS, converted from px and inches
// at 96px/in. Type is Helvetica, which is what the reference PDF actually
// used (its "Archivo Expanded" never resolved) and which is built into PDF,
// so it needs no font loading and cannot fall back to something else.
// ─────────────────────────────────────────────────────────────

const PX = 1 / 96;                       // CSS px in inches
const C = {
  ground: '#171B26',
  panel: '#1D2230',
  keyline: '#3A4152',
  headRule: '#2A3040',
  imageWell: '#0F121A',
  lime: '#D9E021',
  ink: '#F2F5F0',
  muted: '#AEBFCB',
  dim: '#7E8BA0',
  chip: '#0F121A',                       // drawn at 88% opacity, as the template has it
  gradFrom: '#F5EFD5',
  gradMid: '#F0DA1E',
  gradTo: '#E04A26',
};

export const CARD = {
  trimW: 5, trimH: 7, bleed: 0.125,
  padTop: 0.2, padSide: 0.22, padBottom: 0.18,
};

// Text with letter-spacing, drawn by hand so spacing matches the template's
// em values exactly rather than a viewer's approximation.
function tracked(pdf, text, x, y, { size, spacing = 0, color = C.ink, bold = true, align = 'left', font = 'helvetica' }) {
  pdf.setFont(font, font === 'helvetica' ? (bold ? 'bold' : 'normal') : 'normal');
  pdf.setFontSize(size);
  pdf.setTextColor(color);
  const chars = [...String(text)];
  const width = chars.reduce((t, ch) => t + pdf.getTextWidth(ch) + spacing, 0) - (chars.length ? spacing : 0);
  let cx = align === 'right' ? x - width : align === 'center' ? x - width / 2 : x;
  chars.forEach(ch => { pdf.text(ch, cx, y); cx += pdf.getTextWidth(ch) + spacing; });
  return width;
}

const trackedWidth = (pdf, text, { size, spacing = 0, bold = true, font = 'helvetica' }) => {
  pdf.setFont(font, font === 'helvetica' ? (bold ? 'bold' : 'normal') : 'normal');
  pdf.setFontSize(size);
  const chars = [...String(text)];
  return chars.reduce((t, ch) => t + pdf.getTextWidth(ch) + spacing, 0) - (chars.length ? spacing : 0);
};

// "THE CONSCIOUS COMPASS", with the middle word in lime.
function eyebrow(pdf, x, y, size, spacing) {
  let cx = x;
  [['THE ', C.ink], ['CONSCIOUS ', C.lime], ['COMPASS', C.ink]].forEach(([word, color]) => {
    cx += tracked(pdf, word, cx, y, { size, spacing, color }) + spacing;
  });
}

// The template's three-stop bar, fading in from the card ground.
function gradientBar(pdf, x, y, w, h) {
  const steps = 160;
  const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
  const hex = ([r, g, b]) => `#${[r, g, b].map(v => v.toString(16).padStart(2, '0')).join('')}`;
  const ground = [23, 27, 38], from = [245, 239, 213], mid = [240, 218, 30], to = [224, 74, 38];
  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1);
    const c = t <= 0.25 ? mix(ground, from, t / 0.25)
      : t <= 0.6 ? mix(from, mid, (t - 0.25) / 0.35)
        : mix(mid, to, (t - 0.6) / 0.4);
    pdf.setFillColor(hex(c));
    pdf.rect(x + (w * i) / steps, y, w / steps + 0.004, h, 'F');
  }
}

// Name type ladder, as the template sets it.
export const nameSizePx = (brand) => { const n = String(brand || '').length; return n > 24 ? 13 : n > 16 ? 17 : n > 9 ? 25 : 34; };

// Everything the front needs that is not text: QR, the Antenna "a", and the
// brand's own image. Each may be an HTMLImageElement or a data URL.
export function drawCardFront(pdf, d, assets = {}) {
  // Space Mono is embedded for the two plate labels, exactly as the template
  // sets them. Everything else is Helvetica, which PDF carries itself.
  let mono = 'helvetica';
  if (assets.spaceMono) {
    try {
      pdf.addFileToVFS('SpaceMono-Regular.ttf', assets.spaceMono);
      pdf.addFont('SpaceMono-Regular.ttf', 'SpaceMono', 'normal');
      mono = 'SpaceMono';
    } catch { mono = 'helvetica'; }
  }
  const { bleed } = CARD;
  const L = bleed + CARD.padSide;
  const R = bleed + CARD.trimW - CARD.padSide;
  const W = R - L;
  const top = bleed + CARD.padTop;
  const bottom = bleed + CARD.trimH - CARD.padBottom;

  // Ground, edge to edge including the bleed.
  pdf.setFillColor(C.ground);
  pdf.rect(0, 0, CARD.trimW + bleed * 2, CARD.trimH + bleed * 2, 'F');

  // Header: eyebrow, then the rule under it.
  const eyeSize = 10 * PX * 72;                    // px -> pt
  eyebrow(pdf, L, top + 10 * PX * 0.78, eyeSize, 0.22 * 10 * PX);
  const ruleY = top + 10 * PX * 1.2 + 0.09;
  pdf.setFillColor(C.headRule);
  pdf.rect(L, ruleY, W, 1 * PX, 'F');

  // Brand name and the gradient bar beside it.
  const namePx = nameSizePx(d.brand);
  const nameTop = ruleY + 0.16;
  const nameH = namePx * PX;
  tracked(pdf, String(d.brand || '').toUpperCase(), L, nameTop + nameH * 0.79, { size: namePx * PX * 72, spacing: 0.01 * namePx * PX });
  const nameW = trackedWidth(pdf, String(d.brand || '').toUpperCase(), { size: namePx * PX * 72, spacing: 0.01 * namePx * PX });
  const barX = L + nameW + 0.1;
  gradientBar(pdf, barX, nameTop, Math.max(0.3, R - barX), nameH);

  // Fixed blocks below, so the image well can take the space that is left.
  // Gaps measured from the reference card rather than taken from the CSS,
  // which the browser resolved slightly differently.
  const TILE_GAP = 0.107;          // between the four tiles
  const TILES_TOP_GAP = 0.18;      // image well to tiles
  const CHIP_ABOVE_WELL = 0.62;    // chip's bottom above the well bottom
  const limeH = 0.72 + 0.13 * 2;
  const footH = 8.5 * PX * 1.2;
  const tileH = 0.08 + 26 * PX + 5 * PX + 7 * PX * 1.2 + 0.09;
  const imageTop = nameTop + nameH + 0.14;
  const imageBottom = bottom - limeH - 0.14 - footH - 0.12 - tileH - TILES_TOP_GAP;
  const imageH = imageBottom - imageTop;

  // Image well: border, ground, then the brand image cropped to fill (the
  // template's object-fit: cover).
  pdf.setFillColor(C.imageWell);
  pdf.rect(L, imageTop, W, imageH, 'F');
  if (assets.hero) {
    const ratio = assets.heroRatio || 1.6;
    const wellRatio = W / imageH;
    let dw = W, dh = imageH, dx = L, dy = imageTop;
    if (ratio > wellRatio) { dw = imageH * ratio; dx = L - (dw - W) / 2; }
    else { dh = W / ratio; dy = imageTop - (dh - imageH) / 2; }
    // Clip to the well so a wider image cannot spill over the card. The path
    // must be added with a null style, then clipped, then discarded.
    pdf.saveGraphicsState();
    pdf.rect(L, imageTop, W, imageH, null);
    pdf.clip(); pdf.discardPath();
    pdf.addImage(assets.hero, 'JPEG', dx, dy, dw, dh);
    pdf.restoreGraphicsState();
  }
  pdf.setDrawColor(C.keyline);
  pdf.setLineWidth(1.5 * PX);
  pdf.rect(L, imageTop, W, imageH, 'S');

  // Score plate, bottom right inside the well, and the average chip above it.
  const plateH = 0.09 * 2 + 34 * PX;
  const plateY = imageTop + imageH - plateH;
  const scoreSize = 34 * PX * 72;
  const labelSize = 8 * PX * 72;
  const scoreW = trackedWidth(pdf, String(d.overall ?? '—'), { size: scoreSize });
  const suffixW = trackedWidth(pdf, '/100', { size: 12 * PX * 72, bold: false });
  const labelW = Math.max(trackedWidth(pdf, 'COMPASS', { size: labelSize, spacing: 0.14 * 8 * PX, font: mono }),
    trackedWidth(pdf, 'SCORE', { size: labelSize, spacing: 0.14 * 8 * PX, font: mono }));
  const plateW = 0.14 * 2 + labelW + 0.1 + scoreW + 2 * PX + suffixW;
  const plateX = L + W - plateW;
  pdf.setFillColor(C.lime);
  pdf.rect(plateX, plateY, plateW, plateH, 'F');
  const labelMid = plateY + plateH / 2;
  tracked(pdf, 'COMPASS', plateX + 0.14, labelMid - 0.004, { size: labelSize, spacing: 0.14 * 8 * PX, color: C.ground, font: mono });
  tracked(pdf, 'SCORE', plateX + 0.14, labelMid + 8 * PX * 1.3 - 0.004, { size: labelSize, spacing: 0.14 * 8 * PX, color: C.ground, font: mono });
  const scoreBaseline = plateY + plateH / 2 + 34 * PX * 0.36;
  tracked(pdf, String(d.overall ?? '—'), plateX + 0.14 + labelW + 0.1, scoreBaseline, { size: scoreSize, color: C.ground });
  tracked(pdf, '/100', plateX + 0.14 + labelW + 0.1 + scoreW + 2 * PX, scoreBaseline, { size: 12 * PX * 72, color: C.ground, bold: false });

  const chipH = 0.05 * 2 + 15 * PX;
  // The template pins the chip 0.62in above the bottom of the well, which
  // leaves a gap above the score plate rather than stacking the two.
  const chipY = imageTop + imageH - CHIP_ABOVE_WELL - chipH;
  const avgLabelSize = 7.5 * PX * 72;
  const avgW = trackedWidth(pdf, String(d.baseline ?? '—'), { size: 15 * PX * 72 });
  const avgLabelW = trackedWidth(pdf, 'INDUSTRY AVERAGE', { size: avgLabelSize, spacing: 0.12 * 7.5 * PX, font: mono });
  const chipW = 0.14 * 2 + avgLabelW + 0.08 + avgW;
  const chipX = L + W - chipW;
  // The template's chip is rgba(15,18,26,0.88): the image reads through it.
  // Drawn with real PDF transparency, with a solid fill as the fallback if a
  // renderer has no graphics-state support.
  const chipAlpha = 0.88;
  let alphaSet = false;
  if (typeof pdf.GState === 'function' && typeof pdf.setGState === 'function') {
    try {
      pdf.saveGraphicsState();
      pdf.setGState(new pdf.GState({ opacity: chipAlpha }));
      alphaSet = true;
    } catch { alphaSet = false; }
  }
  pdf.setFillColor(C.chip);
  pdf.rect(chipX, chipY, chipW, chipH, 'F');
  if (alphaSet) pdf.restoreGraphicsState();
  const chipBaseline = chipY + chipH / 2 + 15 * PX * 0.33;
  tracked(pdf, 'INDUSTRY AVERAGE', chipX + 0.14, chipY + chipH / 2 + 7.5 * PX * 0.35, { size: avgLabelSize, spacing: 0.12 * 7.5 * PX, color: C.muted, font: mono });
  tracked(pdf, String(d.baseline ?? '—'), chipX + 0.14 + avgLabelW + 0.08, chipBaseline, { size: 15 * PX * 72, color: C.ink });

  // Four attribute tiles.
  const tileTop = imageTop + imageH + TILES_TOP_GAP;
  const gap = TILE_GAP;
  const tileW = (W - gap * 3) / 4;
  [['credibility', 'CREDIBILITY'], ['trust', 'TRUST'], ['reputation', 'REPUTATION'], ['authenticity', 'AUTHENTICITY']]
    .forEach(([key, label], i) => {
      const x = L + i * (tileW + gap);
      pdf.setFillColor(C.panel);
      pdf.rect(x, tileTop, tileW, tileH, 'F');
      pdf.setDrawColor(C.keyline);
      pdf.setLineWidth(1 * PX);
      pdf.rect(x, tileTop, tileW, tileH, 'S');
      tracked(pdf, String(d[key] ?? '—'), x + tileW / 2, tileTop + 0.08 + 26 * PX * 0.78, { size: 26 * PX * 72, align: 'center' });
      tracked(pdf, label, x + tileW / 2, tileTop + 0.08 + 26 * PX + 5 * PX + 7 * PX * 0.9,
        { size: 7 * PX * 72, spacing: 0.12 * 7 * PX, color: C.muted, align: 'center' });
    });

  // Footer line.
  const footY = tileTop + tileH + 0.12 + 8.5 * PX * 0.9;
  tracked(pdf, 'MEASURED BY THE CONSCIOUS COMPASS TEASER ASSESSMENT', L, footY,
    { size: 8.5 * PX * 72, spacing: 0.18 * 8.5 * PX, color: C.dim });

  // Lime call to action.
  const limeY = bottom - limeH;
  pdf.setFillColor(C.lime);
  pdf.rect(L, limeY, W, limeH, 'F');
  if (assets.qr) pdf.addImage(assets.qr, 'PNG', L + 0.18, limeY + 0.13, 0.72, 0.72);
  const textX = L + 0.18 + 0.72 + 0.16;
  const headSize = 21 * PX * 72;
  tracked(pdf, 'ARE YOU', textX, limeY + 0.13 + 21 * PX * 0.8, { size: headSize, color: C.ground });
  tracked(pdf, 'CONSCIOUS?', textX, limeY + 0.13 + 21 * PX * 0.8 + 21 * PX * 1.02, { size: headSize, color: C.ground });
  const subY = limeY + 0.13 + 21 * PX * 1.02 * 2 + 5 * PX + 12.5 * PX * 0.8;
  const leadW = tracked(pdf, 'Scan to find out ', textX, subY, { size: 12.5 * PX * 72, color: C.ground });
  // Helvetica carries no arrow glyph, so the template's arrow is drawn.
  const aX = textX + leadW + 0.02, aY = subY - 12.5 * PX * 0.28, aW = 0.1;
  pdf.setDrawColor(C.ground); pdf.setLineWidth(1.4 * PX);
  pdf.line(aX, aY, aX + aW, aY);
  pdf.setFillColor(C.ground);
  pdf.triangle(aX + aW, aY, aX + aW - 0.035, aY - 0.028, aX + aW - 0.035, aY + 0.028, 'F');
  tracked(pdf, ' antennagroup.com', aX + aW + 0.02, subY, { size: 12.5 * PX * 72, color: C.ground });
  if (assets.antennaA) pdf.addImage(assets.antennaA, 'PNG', L + W - 0.18 - 0.34 * (assets.antennaARatio || 1), limeY + limeH / 2 - 0.17, 0.34 * (assets.antennaARatio || 1), 0.34);

  return pdf;
}
