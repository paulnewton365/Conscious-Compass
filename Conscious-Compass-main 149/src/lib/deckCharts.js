// ─────────────────────────────────────────────────────────────
// Chart builders for the readout deck.
//
// These are standalone SVG string builders rather than React components on
// purpose. The deck must be generatable without the report being rendered on
// screen, so nothing here may depend on the DOM being in a particular state.
// Rasterisation happens through a canvas, the same route the DOCX export uses.
// ─────────────────────────────────────────────────────────────

import { ATTRIBUTES, MATURITY_STAGES, CAMPAIGN_LADDER } from '../data/rubric';

// Charts render on the dark deck ground, not in white boxes. A white chart
// rectangle on a near-black slide reads as a hole punched in the page.
export const PAPER = '#0D0D0F';   // must match deckExport PAPER
export const INK = '#FFFFFF';     // primary chart text
export const RED = '#E53935';
export const MUTE = '#A0A0A0';    // secondary chart text on dark
export const LINE = '#3A3A40';    // gridlines on dark
export const LIME = '#D6E039';

// ── Contrast safety ──────────────────────────────────────────
// The attribute palette is tuned for coloured dots and fills on screen, not
// for text. Seven of the eight attribute colours fail WCAG AA as text on a
// light background (Reflective yellow sits at 1.67:1, effectively invisible).
// Rather than hand-pick replacements, which would break the moment the
// palette changes, text colours are adjusted toward the readable direction
// until they pass. Shape fills are left vivid, since fills do not need to
// meet a text contrast bar.
const hexToRgb = (h) => {
  const x = String(h).replace('#', '');
  return [0, 2, 4].map(i => parseInt(x.substr(i, 2), 16));
};
const rgbToHex = (r, g, b) => '#' + [r, g, b]
  .map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');

const relLum = (hex) => {
  const c = hexToRgb(hex).map(v => v / 255)
    .map(v => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};

export const contrastRatio = (a, b) => {
  const l1 = relLum(a), l2 = relLum(b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
};

/**
 * Returns the nearest version of `color` that reads cleanly on `bg`.
 * Darkens against light backgrounds, lightens against dark ones, preserving
 * hue so the attribute stays recognisable.
 */
export function readable(color, bg = PAPER, target = 4.5) {
  if (!color) return color;
  let hex = color.startsWith('#') ? color : `#${color}`;
  if (contrastRatio(hex, bg) >= target) return hex;

  const bgIsDark = relLum(bg) < 0.5;
  let [r, g, b] = hexToRgb(hex);

  for (let i = 0; i < 24; i++) {
    // 12% step toward white on dark backgrounds, toward black on light ones
    if (bgIsDark) { r += (255 - r) * 0.12; g += (255 - g) * 0.12; b += (255 - b) * 0.12; }
    else { r *= 0.88; g *= 0.88; b *= 0.88; }
    hex = rgbToHex(r, g, b);
    if (contrastRatio(hex, bg) >= target) return hex;
  }
  return bgIsDark ? '#FFFFFF' : '#1A1A1A';
}

/** Same, but returns the bare hex pptxgenjs expects (no leading #). */
export const readableFlat = (color, bg, target) => readable(color, bg, target).replace('#', '');

const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Renders an SVG string to a base64 PNG at the given pixel size. */
export function svgToPng(svgStr, w, h) {
  return new Promise((resolve, reject) => {
    const blob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const im = new Image();
    im.onload = () => {
      try {
        const c = document.createElement('canvas');
        // 2x for retina-quality output in PowerPoint
        c.width = w * 2; c.height = h * 2;
        const ctx = c.getContext('2d');
        ctx.scale(2, 2);
        ctx.drawImage(im, 0, 0, w, h);
        URL.revokeObjectURL(url);
        resolve(c.toDataURL('image/png'));
      } catch (e) { URL.revokeObjectURL(url); reject(e); }
    };
    im.onerror = (e) => { URL.revokeObjectURL(url); reject(e); };
    im.src = url;
  });
}

// ── Octagon radar ────────────────────────────────────────────
// overlay = optional map of attributeId -> number, drawn as a dashed outline.
export function buildRadarSvg(scores, { overlay = null, size = 620, labelBrand = '', labelOverlay = '' } = {}) {
  const pad = 92;
  const box = size + pad * 2;
  const cx = box / 2, cy = box / 2;
  const R = size * 0.40;
  const n = ATTRIBUTES.length;
  const step = (2 * Math.PI) / n;
  const pt = (i, v) => {
    const a = i * step - Math.PI / 2;
    const r = (Math.max(0, Math.min(100, v)) / 100) * R;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  };

  const rings = [25, 50, 75, 100].map(pct => {
    const d = ATTRIBUTES.map((_, i) => {
      const a = i * step - Math.PI / 2;
      const r = (pct / 100) * R;
      return `${i ? 'L' : 'M'}${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`;
    }).join(' ') + ' Z';
    return `<path d="${d}" fill="none" stroke="${LINE}" stroke-width="1.2"/>`;
  }).join('');

  const spokes = ATTRIBUTES.map((_, i) => {
    const a = i * step - Math.PI / 2;
    return `<line x1="${cx}" y1="${cy}" x2="${(cx + R * Math.cos(a)).toFixed(1)}" y2="${(cy + R * Math.sin(a)).toFixed(1)}" stroke="${LINE}" stroke-width="1"/>`;
  }).join('');

  const poly = (vals, stroke, fill, dash) => {
    const d = vals.map((v, i) => { const [x, y] = pt(i, v); return `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`; }).join(' ') + ' Z';
    return `<path d="${d}" fill="${fill}" stroke="${stroke}" stroke-width="3"${dash ? ` stroke-dasharray="7 5"` : ''} stroke-linejoin="round"/>`;
  };

  const brandVals = ATTRIBUTES.map(a => scores?.[a.id]?.score ?? scores?.[a.id] ?? 0);
  const overlayVals = overlay ? ATTRIBUTES.map(a => overlay?.[a.id] ?? 0) : null;

  const dots = ATTRIBUTES.map((a, i) => {
    const [x, y] = pt(i, brandVals[i]);
    return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="8" fill="${a.color}" stroke="${PAPER}" stroke-width="3"/>`;
  }).join('');

  const labels = ATTRIBUTES.map((a, i) => {
    const ang = i * step - Math.PI / 2;
    const lr = R + 40;
    const x = cx + lr * Math.cos(ang), y = cy + lr * Math.sin(ang);
    const anchor = Math.abs(Math.cos(ang)) < 0.25 ? 'middle' : (Math.cos(ang) > 0 ? 'start' : 'end');
    const v = brandVals[i];
    return `<text x="${x.toFixed(1)}" y="${(y - 4).toFixed(1)}" text-anchor="${anchor}" font-family="Arial, Helvetica, sans-serif" font-size="19" font-weight="700" fill="${INK}">${esc(a.name)}</text>
<text x="${x.toFixed(1)}" y="${(y + 18).toFixed(1)}" text-anchor="${anchor}" font-family="Arial, Helvetica, sans-serif" font-size="18" font-weight="700" fill="${readable(a.color, PAPER)}">${v}</text>`;
  }).join('');

  const legend = overlayVals ? `
<g transform="translate(${cx - 150}, ${box - 26})">
  <line x1="0" y1="0" x2="30" y2="0" stroke="${RED}" stroke-width="3"/>
  <text x="38" y="5" font-family="Arial, Helvetica, sans-serif" font-size="17" fill="${INK}">${esc(labelBrand)}</text>
  <line x1="170" y1="0" x2="200" y2="0" stroke="${MUTE}" stroke-width="3" stroke-dasharray="7 5"/>
  <text x="208" y="5" font-family="Arial, Helvetica, sans-serif" font-size="17" fill="${MUTE}">${esc(labelOverlay)}</text>
</g>` : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${box}" height="${box}" viewBox="0 0 ${box} ${box}">
<rect width="${box}" height="${box}" fill="${PAPER}"/>
${rings}${spokes}
${overlayVals ? poly(overlayVals, MUTE, 'rgba(107,107,107,0.07)', true) : ''}
${poly(brandVals, RED, 'rgba(229,57,53,0.14)', false)}
${dots}${labels}${legend}
</svg>`;
}

// ── Maturity continuum with sector marker ────────────────────
export function buildMaturitySvg(score, sectorAvg, brandName) {
  const W = 1180, H = 230, m = 46;
  const trackW = W - m * 2, trackY = 104;
  const x = (v) => m + (Math.max(0, Math.min(100, v)) / 100) * trackW;

  const bands = MATURITY_STAGES.map(s => {
    const x1 = x(s.min), x2 = x(s.max);
    return `<rect x="${x1.toFixed(1)}" y="${trackY}" width="${(x2 - x1).toFixed(1)}" height="20" fill="${s.color}" opacity="0.32" rx="3"/>`;
  }).join('');

  // Band names alternate rows so long adjacent labels never collide.
  const bandLabels = MATURITY_STAGES.map((s, i) => {
    const cxx = (x(s.min) + x(s.max)) / 2;
    return `<text x="${cxx.toFixed(1)}" y="${trackY + (i % 2 ? 58 : 40)}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="15" fill="${MUTE}">${esc(s.name)}</text>`;
  }).join('');

  const stage = MATURITY_STAGES.find(s => score >= s.min && score <= s.max) || MATURITY_STAGES[0];
  const bx = x(score), sx = x(sectorAvg);

  // Pill is sized to its text, then clamped inside the canvas, so a long brand
  // name can neither overflow the shape nor run off the edge of the slide.
  const label = `${String(brandName || '').slice(0, 20)} ${score}`;
  const pillW = Math.min(Math.max(label.length * 12.5 + 34, 150), 420);
  const pillX = Math.max(6, Math.min(bx - pillW / 2, W - pillW - 6));

  // Sector marker labels BELOW the track, brand ABOVE it. They cannot collide.
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<rect width="${W}" height="${H}" fill="${PAPER}"/>
${bands}${bandLabels}
<g>
  <line x1="${sx.toFixed(1)}" y1="${trackY - 4}" x2="${sx.toFixed(1)}" y2="${trackY + 24}" stroke="#D6E039" stroke-width="4"/>
  <text x="${sx.toFixed(1)}" y="${trackY + 92}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="20" font-weight="700" fill="#D6E039">Sector average ${sectorAvg}</text>
  <line x1="${sx.toFixed(1)}" y1="${trackY + 62}" x2="${sx.toFixed(1)}" y2="${trackY + 74}" stroke="#D6E039" stroke-width="2"/>
</g>
<g>
  <rect x="${pillX.toFixed(1)}" y="16" width="${pillW.toFixed(1)}" height="46" rx="10" fill="${stage.color}"/>
  <text x="${(pillX + pillW / 2).toFixed(1)}" y="46" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="700" fill="${INK}">${esc(label)}</text>
  <line x1="${bx.toFixed(1)}" y1="62" x2="${bx.toFixed(1)}" y2="${trackY + 4}" stroke="${stage.color}" stroke-width="4"/>
  <circle cx="${bx.toFixed(1)}" cy="${trackY + 10}" r="12" fill="${stage.color}" stroke="${PAPER}" stroke-width="4"/>
</g>
${[0, 25, 50, 75, 100].map(v => `<text x="${x(v).toFixed(1)}" y="${trackY - 14}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="14" fill="#8A8A90">${v}</text>`).join('')}
</svg>`;
}

// ── Attribute benchmark spread ───────────────────────────────
export function buildSpreadSvg(scores, benchmark, brandName) {
  const W = 1240, rowH = 62, top = 30;
  const H = top + ATTRIBUTES.length * rowH + 74;
  const labelW = 210, numW = 150;
  const trackX = labelW + 20, trackW = W - labelW - numW - 50;
  const x = (v) => trackX + (Math.max(0, Math.min(100, v)) / 100) * trackW;

  const rows = ATTRIBUTES.map((a, i) => {
    const y = top + i * rowH + rowH / 2;
    const b = scores?.[a.id]?.score ?? 0;
    const avg = benchmark?.attrAvgs?.[a.id] ?? 0;
    const rng = benchmark?.attrRanges?.[a.id] || { min: avg, max: avg };
    const d = b - avg;
    return `
<text x="${labelW}" y="${y + 7}" text-anchor="end" font-family="Arial, Helvetica, sans-serif" font-size="21" font-weight="700" fill="${INK}">${esc(a.name)}</text>
<line x1="${trackX}" y1="${y}" x2="${trackX + trackW}" y2="${y}" stroke="#2A2A30" stroke-width="2"/>
<rect x="${x(rng.min).toFixed(1)}" y="${y - 6}" width="${Math.max(x(rng.max) - x(rng.min), 3).toFixed(1)}" height="12" rx="6" fill="${a.color}" opacity="0.28"/>
<line x1="${x(avg).toFixed(1)}" y1="${y - 15}" x2="${x(avg).toFixed(1)}" y2="${y + 15}" stroke="${MUTE}" stroke-width="3.5"/>
<circle cx="${x(b).toFixed(1)}" cy="${y}" r="12" fill="${a.color}" stroke="${PAPER}" stroke-width="3.5"/>
<text x="${W - numW + 62}" y="${y + 8}" text-anchor="end" font-family="Arial, Helvetica, sans-serif" font-size="23" font-weight="700" fill="${readable(a.color, PAPER)}">${b}</text>
<text x="${W - 12}" y="${y + 8}" text-anchor="end" font-family="Arial, Helvetica, sans-serif" font-size="19" font-weight="700" fill="${d > 0 ? readable('#5BD99B', PAPER) : d < 0 ? readable(RED, PAPER) : MUTE}">${d > 0 ? '+' : ''}${d}</text>`;
  }).join('');

  const axisY = top + ATTRIBUTES.length * rowH + 12;
  const axis = [0, 25, 50, 75, 100].map(v =>
    `<text x="${x(v).toFixed(1)}" y="${axisY}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="15" fill="#8A8A90">${v}</text>`).join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<rect width="${W}" height="${H}" fill="${PAPER}"/>
${rows}${axis}
<g transform="translate(${trackX}, ${axisY + 38})">
  <circle cx="8" cy="-6" r="9" fill="${INK}" stroke="${PAPER}" stroke-width="3"/>
  <text x="26" y="0" font-family="Arial, Helvetica, sans-serif" font-size="17" fill="${INK}">${esc(brandName).slice(0, 30)}</text>
  <line x1="${Math.min(26 + esc(brandName).slice(0, 30).length * 9.2 + 40, trackW - 260)}" y1="-16" x2="${Math.min(26 + esc(brandName).slice(0, 30).length * 9.2 + 40, trackW - 260)}" y2="4" stroke="${MUTE}" stroke-width="3.5"/>
  <text x="${Math.min(26 + esc(brandName).slice(0, 30).length * 9.2 + 54, trackW - 246)}" y="0" font-family="Arial, Helvetica, sans-serif" font-size="17" fill="${MUTE}">${esc(benchmark?.cohortLabel || 'Sector')} average</text>
</g>
</svg>`;
}

// ── Campaign coherence ladder ────────────────────────────────
// Five rungs. Level 0 is the absence of a campaign, not a rung.
export function buildLadderSvg(level) {
  const rungs = CAMPAIGN_LADDER.filter(l => l.level > 0);
  const W = 1180, H = 168, gap = 16;
  const w = (W - gap * (rungs.length - 1)) / rungs.length;
  const lvl = Number.isFinite(Number(level)) ? Number(level) : 0;

  const bars = rungs.map((l, i) => {
    const x = i * (w + gap);
    const on = lvl >= l.level;
    return `
<text x="${(x + w / 2).toFixed(1)}" y="30" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="18" font-weight="700" fill="${on ? RED : '#C4C4C4'}">${l.level}</text>
<rect x="${x.toFixed(1)}" y="48" width="${w.toFixed(1)}" height="26" rx="13" fill="${on ? RED : '#E4E1DC'}"/>
<text x="${(x + w / 2).toFixed(1)}" y="108" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="21" font-weight="${l.level === lvl ? '700' : '400'}" fill="${l.level === lvl ? INK : '#9A9A9A'}">${esc(l.name)}</text>`;
  }).join('');

  const none = lvl === 0
    ? `<text x="${W / 2}" y="148" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="19" font-weight="700" fill="${RED}">No campaign detected. The brand sits below the first rung.</text>`
    : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<rect width="${W}" height="${H}" fill="${PAPER}"/>${bars}${none}
</svg>`;
}
