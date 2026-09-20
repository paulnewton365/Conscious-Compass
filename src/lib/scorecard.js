// ─────────────────────────────────────────────────────────────
// TEASER SCORECARD (v3.37) — teasers only
//
// Two deliverables from a scored teaser, both ported from the Antenna Group
// templates in the Claude Design handoff, markup and inline styles unchanged:
//
//   1. Print card. Two pages, 5.25 x 7.25in with 0.125in bleed on all sides
//      (5 x 7in trim). Page 1 is the brand front, page 2 the shared back.
//   2. Pitch slide. 1920 x 1080, written as a .pptx that Google Slides opens.
//
// Only the brand name, hero image, sector, baseline and scores change between
// brands. Fonts follow the templates: Archivo / Archivo Expanded / Space Mono
// on the card, Inter on the slide.
//
// The QR code is a fixed asset rather than the template's live call to
// api.qrserver.com: a cross-origin image taints the canvas the PDF is drawn
// from, which would break the export. Same destination, same 1000px source.
// ─────────────────────────────────────────────────────────────

const A = {
  // Pre-whitened: the templates whiten the dark logo with a CSS filter, and
  // html2canvas ignores filters, so the logo came out dark on dark.
  antennaLogo: '/scorecard/antenna-logo-white.png',
  antennaA: '/scorecard/antenna-a.png',
  howl: '/scorecard/howl-logo.svg',
  qr: '/scorecard/qr-lets-chat.png',
};

const IMAGE_TIMEOUT_MS = 8000;

export const TRIM = { w: 5, h: 7 };           // inches
export const BLEED = 0.125;                    // inches on every side
export const SLIDE = { w: 1920, h: 1080 };     // px

const esc = (v) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const num = (v) => (Number.isFinite(Number(v)) ? String(Math.round(Number(v))) : '—');

// Type scales from the templates, driven by the length of the brand name.
export const cardNameSize = (brand) => { const n = String(brand || '').length; return n > 24 ? '13px' : n > 16 ? '17px' : n > 9 ? '25px' : '34px'; };
export const slideNameSize = (brand) => { const n = String(brand || '').length; return n > 24 ? '40px' : n > 16 ? '54px' : n > 9 ? '66px' : '84px'; };

// What a teaser has to have before a scorecard can be made.
export function scorecardReady(record, baseline) {
  const missing = [];
  if (!record?.result) missing.push('a score');
  if (!record?.hero_image) missing.push('a brand image');
  if (!Number.isFinite(Number(baseline?.avgScore))) missing.push('a sector baseline');
  return { ready: missing.length === 0, missing };
}

export function scorecardData(record, baseline, sectorName) {
  const r = record?.result || {};
  return {
    brand: record?.brand_name || '',
    sector: sectorName || baseline?.sectorName || '',
    baseline: baseline?.avgScore,
    overall: r.overall,
    credibility: r.lensScores?.credibility,
    trust: r.lensScores?.trust,
    reputation: r.lensScores?.reputation,
    authenticity: r.lensScores?.authenticity,
    img: record?.hero_image || '',
  };
}

// ── Card, page 1 (front) ──────────────────────────────────────

export function cardFrontHtml(d) {
  return `<div style="width:100%;height:100%;background:#171B26;box-sizing:border-box;display:flex;flex-direction:column;overflow:hidden;padding:0.2in 0.22in 0.18in;">
  <div style="display:flex;align-items:center;justify-content:space-between;gap:0.1in;border-bottom:1px solid #2A3040;padding-bottom:0.09in;">
    <div style="font-family:'Archivo Expanded','Archivo',sans-serif;font-weight:800;font-size:10px;letter-spacing:0.22em;text-transform:uppercase;white-space:nowrap;"><span style="color:#F2F5F0;">The</span> <span style="color:#D9E021;">Conscious</span> <span style="color:#F2F5F0;">Compass</span></div>
  </div>
  <div style="margin-top:0.16in;">
    <div style="display:flex;align-items:stretch;gap:0;">
      <div style="font-family:'Archivo Expanded','Archivo',sans-serif;font-weight:900;font-size:${cardNameSize(d.brand)};letter-spacing:0.01em;text-transform:uppercase;line-height:1;color:#F2F5F0;white-space:nowrap;">${esc(d.brand)}</div>
      <div style="flex:1;min-width:0.3in;align-self:stretch;background:linear-gradient(90deg,rgba(245,239,213,0) 0%,#F5EFD5 25%,#F0DA1E 60%,#E04A26 100%);margin-left:0.1in;"></div>
    </div>
  </div>
  <div style="margin-top:0.14in;position:relative;flex:1;min-height:0;border:1.5px solid #3A4152;background:#0F121A;">
    <img src="${esc(d.img)}" alt="${esc(d.brand)} homepage" style="width:100%;height:100%;object-fit:cover;display:block;">
    <div style="position:absolute;right:0;bottom:0.62in;background:rgba(15,18,26,0.88);color:#F2F5F0;display:flex;align-items:center;gap:0.08in;padding:0.05in 0.14in;pointer-events:none;">
      <div style="font-family:'Space Mono',monospace;font-size:7.5px;letter-spacing:0.12em;text-transform:uppercase;color:#AEBFCB;">Industry average</div>
      <div style="font-family:'Archivo Expanded','Archivo',sans-serif;font-weight:900;font-size:15px;line-height:1;">${num(d.baseline)}</div>
    </div>
    <div style="position:absolute;right:0;bottom:0;background:#D9E021;color:#171B26;display:flex;align-items:center;gap:0.1in;padding:0.09in 0.14in;pointer-events:none;">
      <div style="font-family:'Space Mono',monospace;font-size:8px;letter-spacing:0.14em;text-transform:uppercase;line-height:1.3;">Compass<br>Score</div>
      <div style="display:flex;align-items:baseline;gap:2px;">
        <div style="font-family:'Archivo Expanded','Archivo',sans-serif;font-weight:900;font-size:34px;line-height:1;">${num(d.overall)}</div>
        <div style="font-family:'Archivo',sans-serif;font-weight:400;font-size:12px;line-height:1;">/100</div>
      </div>
    </div>
  </div>
  <div style="margin-top:0.16in;display:grid;grid-template-columns:repeat(4,1fr);gap:0.08in;">
    ${[['credibility', 'Credibility'], ['trust', 'Trust'], ['reputation', 'Reputation'], ['authenticity', 'Authenticity']].map(([k, label]) => `<div style="border:1px solid #3A4152;background:#1D2230;padding:0.08in 0 0.09in;text-align:center;">
      <div style="font-family:'Archivo Expanded','Archivo',sans-serif;font-weight:900;font-size:26px;line-height:1;color:#F2F5F0;">${num(d[k])}</div>
      <div style="font-family:'Archivo Expanded','Archivo',sans-serif;font-weight:700;font-size:7px;letter-spacing:0.12em;text-transform:uppercase;color:#AEBFCB;margin-top:5px;">${label}</div>
    </div>`).join('\n    ')}
  </div>
  <div style="margin-top:0.12in;font-family:'Archivo Expanded','Archivo',sans-serif;font-weight:700;font-size:8.5px;letter-spacing:0.18em;color:#7E8BA0;text-transform:uppercase;">Measured by the Conscious Compass Teaser Assessment</div>
  <div style="margin-top:0.14in;display:flex;align-items:stretch;">
    <div style="flex:1;background:#D9E021;color:#171B26;display:flex;align-items:center;gap:0.16in;padding:0.13in 0.18in;">
      <img src="${A.qr}" alt="QR code" style="width:0.72in;height:0.72in;display:block;flex-shrink:0;image-rendering:pixelated;">
      <div>
        <div style="font-family:'Archivo Expanded','Archivo',sans-serif;font-weight:900;font-size:21px;line-height:1.02;text-transform:uppercase;">Are you<br>conscious?</div>
        <div style="font-family:'Archivo',sans-serif;font-weight:700;font-size:12.5px;line-height:1.3;margin-top:5px;white-space:nowrap;">Scan to find out → antennagroup.com</div>
      </div>
      <img src="${A.antennaA}" alt="Antenna" style="height:0.34in;width:auto;display:block;flex-shrink:0;margin-left:auto;">
    </div>
  </div>
</div>`;
}

// ── Card, page 2 (shared back, identical for every brand) ─────

export function cardBackHtml() {
  return `<div style="width:100%;height:100%;background:#171B26;box-sizing:border-box;display:flex;flex-direction:column;overflow:hidden;padding:0.3in 0.3in 0;">
  <div style="border-bottom:1px solid #2A3040;padding-bottom:0.12in;font-family:'Archivo Expanded','Archivo',sans-serif;font-weight:800;font-size:10px;letter-spacing:0.22em;text-transform:uppercase;white-space:nowrap;"><span style="color:#F2F5F0;">The</span> <span style="color:#D9E021;">Conscious</span> <span style="color:#F2F5F0;">Compass</span></div>
  <h1 style="font-family:'Archivo Expanded','Archivo',sans-serif;font-weight:900;font-size:35px;line-height:1.08;margin:0.18in 0 0;text-transform:uppercase;color:#F2F5F0;">Consequential brands are<br><span style="display:inline-block;background:#D9E021;color:#171B26;padding:0 0.04in;">conscious brands</span></h1>
  <div style="font-size:19px;font-weight:400;line-height:1.5;margin-top:0.2in;display:flex;flex-direction:column;gap:0.14in;text-wrap:pretty;color:#F2F5F0;font-family:'Archivo',sans-serif;">
    <p style="margin:0 0 0.06in;font-size:24px;font-weight:800;line-height:1.3;">How you show up means something.</p>
    <p style="margin:0;">Antenna Group’s proprietary brand diagnostic assesses how well brands with purpose meet the world.</p>
    <p style="margin:0;">It scores your credibility, trust, reputation, and influence, and pinpoints the marketing opportunities that will sharpen your impact.</p>
    <p style="margin:0.06in 0 0;">Reach out to learn more.</p>
  </div>
  <div style="display:flex;align-items:center;gap:0.12in;margin-top:0.22in;">
    <div style="font-family:'Archivo Expanded','Archivo',sans-serif;font-weight:800;font-size:24px;color:#D9E021;white-space:nowrap;">antennagroup.com</div>
    <div style="flex:1;height:0.09in;background:linear-gradient(90deg,rgba(240,218,30,0) 0%,#F0DA1E 30%,#E04A26 100%);"></div>
  </div>
  <div style="flex:1;"></div>
  <div style="display:flex;align-items:center;justify-content:space-between;gap:0.25in;border-top:1.5px solid #3A4152;margin-top:0.14in;padding:0.14in 0 0.18in;">
    <img src="${A.antennaLogo}" alt="Antenna Group" style="height:0.36in;width:auto;display:block;">
    <img src="${A.howl}" alt="Howl" style="height:0.44in;width:auto;display:block;">
  </div>
</div>`;
}

// ── Slide (1920 x 1080) ───────────────────────────────────────

export function slideHtml(d) {
  const tile = (v, label) => `<div style="border:1px solid #3A4152;background:#1D2230;padding:18px 0 20px;text-align:center;">
        <div style="font-family:'Inter',sans-serif;font-weight:900;font-size:54px;line-height:1;color:#F2F5F0;">${num(v)}</div>
        <div style="font-family:'Inter',sans-serif;font-weight:700;font-size:14px;letter-spacing:0.12em;text-transform:uppercase;color:#AEBFCB;margin-top:12px;">${label}</div>
      </div>`;
  return `<div style="width:1920px;height:1080px;background:#171B26;display:flex;flex-direction:column;padding:52px 72px 86px;box-sizing:border-box;overflow:hidden;font-family:'Inter',sans-serif;color:#F2F5F0;">
  <div style="display:flex;align-items:center;gap:32px;padding-bottom:22px;">
    <div style="font-family:'Inter',sans-serif;font-weight:800;font-size:27px;letter-spacing:0.14em;white-space:nowrap;"><span style="color:#F2F5F0;">The</span> <span style="color:#D9E021;">conscious</span> <span style="color:#F2F5F0;">compass</span></div>
    <div style="flex:1;"></div>
    <div style="display:flex;align-items:center;gap:28px;">
      <img src="${A.antennaLogo}" alt="Antenna Group" style="height:38px;width:auto;display:block;">
      <img src="${A.howl}" alt="Howl" style="height:46px;width:auto;display:block;">
    </div>
  </div>
  <div style="flex:1;min-height:0;display:grid;grid-template-columns:1.15fr 0.85fr;gap:56px;padding-top:28px;">
    <div style="min-width:0;display:flex;flex-direction:column;">
      <div style="display:flex;align-items:stretch;gap:24px;">
        <div style="font-family:'Inter',sans-serif;font-weight:900;font-size:${slideNameSize(d.brand)};letter-spacing:0.01em;text-transform:uppercase;line-height:1;color:#F2F5F0;white-space:nowrap;">${esc(d.brand)}</div>
      </div>
      <div style="margin-top:26px;position:relative;flex:1;min-height:0;border:3px solid #3A4152;background:#0F121A;overflow:hidden;">
        <img src="${esc(d.img)}" alt="${esc(d.brand)} homepage" style="width:100%;height:100%;object-fit:cover;display:block;">
        <div style="position:absolute;right:0;bottom:122px;background:rgba(15,18,26,0.88);display:flex;align-items:center;gap:16px;padding:12px 28px;">
          <div style="font-family:'Inter',sans-serif;font-size:15px;letter-spacing:0.12em;text-transform:uppercase;color:#AEBFCB;">Industry average</div>
          <div style="font-family:'Inter',sans-serif;font-weight:900;font-size:32px;line-height:1;color:#F2F5F0;">${num(d.baseline)}</div>
        </div>
        <div style="position:absolute;right:0;bottom:0;background:#D9E021;color:#171B26;display:flex;align-items:center;gap:22px;padding:20px 28px;">
          <div style="font-family:'Inter',sans-serif;font-size:16px;letter-spacing:0.14em;text-transform:uppercase;line-height:1.3;">Your Compass<br>Score</div>
          <div style="display:flex;align-items:baseline;gap:4px;">
            <div style="font-family:'Inter',sans-serif;font-weight:900;font-size:76px;line-height:1;">${num(d.overall)}</div>
            <div style="font-family:'Inter',sans-serif;font-weight:400;font-size:26px;line-height:1;">/100</div>
          </div>
        </div>
      </div>
      <div style="margin-top:22px;font-family:'Inter',sans-serif;font-weight:700;font-size:15px;letter-spacing:0.18em;color:#7E8BA0;text-transform:uppercase;">Indicative scores measured by the Conscious Compass Teaser Assessment</div>
      <div style="margin-top:14px;display:grid;grid-template-columns:repeat(4,1fr);gap:16px;">
        ${tile(d.credibility, 'Credibility')}
        ${tile(d.trust, 'Trust')}
        ${tile(d.reputation, 'Reputation')}
        ${tile(d.authenticity, 'Authenticity')}
      </div>
    </div>
    <div style="min-width:0;display:flex;flex-direction:column;">
      <h1 style="font-family:'Inter',sans-serif;font-weight:900;font-size:60px;line-height:1.18;margin:0;text-transform:uppercase;color:#F2F5F0;">Consequential brands are<br><span style="display:inline-block;background:#D9E021;color:#171B26;padding:0 8px;">conscious brands</span></h1>
      <div style="font-size:26px;font-weight:400;line-height:1.26;margin-top:18px;display:flex;flex-direction:column;gap:12px;text-wrap:pretty;color:#F2F5F0;">
        <p style="margin:0;font-size:34px;font-weight:800;line-height:1.2;">How you show up means something.</p>
        <p style="margin:0;">Antenna Group’s proprietary brand diagnostic assesses how well brands with purpose meet the world.</p>
        <p style="margin:0;">It scores your credibility, trust, reputation, and influence, and pinpoints the marketing opportunities that will sharpen your impact.</p>
        <p style="margin:0;margin-top:8px;border-top:1px solid #3A4152;padding-top:12px;font-size:23.4px;">The scores shown here come from our teaser assessment.<br>Contact us for a deeper dive into your brand.</p>
      </div>
      <div style="display:flex;align-items:center;gap:20px;margin-top:20px;">
        <span style="font-family:'Inter',sans-serif;font-weight:800;font-size:36px;color:#D9E021;white-space:nowrap;text-decoration:none;">antennagroup.com</span>
        <div style="flex:1;height:10px;background:linear-gradient(90deg,rgba(240,218,30,0) 0%,#F0DA1E 30%,#E04A26 100%);"></div>
      </div>
      <div style="flex:1;min-height:24px;"></div>
      <div style="background:#D9E021;color:#171B26;display:flex;align-items:center;gap:28px;padding:26px 30px;">
        <img src="${A.qr}" alt="QR code" style="width:126px;height:126px;display:block;flex-shrink:0;image-rendering:pixelated;">
        <div>
          <div style="font-family:'Inter',sans-serif;font-weight:900;font-size:36px;line-height:1.02;text-transform:uppercase;">Are you<br>conscious?</div>
          <div style="font-family:'Inter',sans-serif;font-weight:700;font-size:21px;line-height:1.3;margin-top:10px;">Scan to find out → antennagroup.com</div>
        </div>
      </div>
    </div>
  </div>
</div>`;
}

// ── Rendering ─────────────────────────────────────────────────

// The templates' own Google Fonts requests. Loaded on demand so the rest of
// the app never pays for them.
const FONT_HREFS = [
  'https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600;700;800;900&family=Space+Mono:wght@400;700&display=swap',
  // Archivo Expanded is the width axis of Archivo; requested both ways so the
  // card keeps its expanded headline whichever the font service serves.
  'https://fonts.googleapis.com/css2?family=Archivo+Expanded:wght@600;700;800;900&display=swap',
  'https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@125,400..900&display=swap',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap',
];

export async function loadScorecardFonts(doc = document) {
  FONT_HREFS.forEach(href => {
    if (doc.querySelector(`link[href="${href}"]`)) return;
    const l = doc.createElement('link');
    l.rel = 'stylesheet'; l.href = href;
    doc.head.appendChild(l);
  });
  try { await doc.fonts.ready; } catch { /* fonts API unavailable */ }
}

// Renders a fragment offscreen at a fixed size and returns a canvas.
export async function renderToCanvas(html, { width, height, scale = 1, html2canvas }) {
  if (typeof html2canvas !== 'function') throw new Error('The page-rendering library (html2canvas) did not load. Reload the page and try again.');
  const host = document.createElement('div');
  host.setAttribute('data-scorecard-render', 'true');
  host.style.cssText = `position:fixed;left:-20000px;top:0;width:${width};height:${height};overflow:hidden;background:#171B26;`;
  host.innerHTML = html;
  document.body.appendChild(host);
  try {
    // Images must be decoded before the canvas is drawn, or they come out
    // blank. Each gets a deadline: a stalled image draws as a gap, it never
    // leaves the export hanging with a spinner.
    await Promise.all([...host.querySelectorAll('img')].map(img => (img.complete && img.naturalWidth ? Promise.resolve() : new Promise(res => {
      const done = () => { clearTimeout(timer); res(); };
      const timer = setTimeout(done, IMAGE_TIMEOUT_MS);
      img.onload = done; img.onerror = done;
    }))));
    return await html2canvas(host, { scale, backgroundColor: '#171B26', logging: false, useCORS: true, width: host.offsetWidth, height: host.offsetHeight });
  } finally {
    host.remove();
  }
}

export const cardFilename = (brand, kind) => `${String(brand || 'brand').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'brand'}-Compass-${kind}`;

// Print card: bleed page with the 5 x 7in artwork centred, so trimming to 5 x 7
// leaves ink to the edge. The template's rounded corner is dropped here; on a
// bled, square-trimmed card it would cut to white wedges.
function bleedWrap(inner) {
  return `<div style="width:${TRIM.w + BLEED * 2}in;height:${TRIM.h + BLEED * 2}in;background:#171B26;box-sizing:border-box;padding:${BLEED}in;">
  <div style="width:${TRIM.w}in;height:${TRIM.h}in;overflow:hidden;">${inner}</div>
</div>`;
}

// The back page is identical for every brand, so a fixed artwork export beats
// re-rendering HTML. Drop a 5.25 x 7.25in image (1575 x 2175px at 300dpi) at
// public/scorecard/card-back.png and it is used instead; without it, the HTML
// back page below is rendered as before.
export const BACK_ARTWORK = '/scorecard/card-back.png';

export function loadImage(src) {
  if (typeof window === 'undefined' || typeof window.Image !== 'function') return Promise.resolve(null);
  return new Promise(resolve => {
    const img = new window.Image();
    const done = (ok) => resolve(ok ? img : null);
    img.onload = () => done(img.naturalWidth > 0);
    img.onerror = () => done(false);
    img.src = src;
  });
}

export async function exportScorecardPdf(d, { html2canvas, jsPDF, scale = 3, save = true, backArtwork = BACK_ARTWORK }) {
  if (typeof html2canvas !== 'function') throw new Error('The page-rendering library (html2canvas) did not load. Reload the page and try again.');
  if (typeof jsPDF !== 'function') throw new Error('The PDF library (jsPDF) did not load. Reload the page and try again.');
  await loadScorecardFonts();
  const w = TRIM.w + BLEED * 2, h = TRIM.h + BLEED * 2;
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'in', format: [w, h] });
  const front = await renderToCanvas(bleedWrap(cardFrontHtml(d)), { width: `${w}in`, height: `${h}in`, scale, html2canvas });
  pdf.addImage(front.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, w, h);

  pdf.addPage([w, h], 'portrait');
  const artwork = backArtwork ? await loadImage(backArtwork) : null;
  if (artwork) {
    pdf.addImage(artwork, 'PNG', 0, 0, w, h);
  } else {
    const back = await renderToCanvas(bleedWrap(cardBackHtml()), { width: `${w}in`, height: `${h}in`, scale, html2canvas });
    pdf.addImage(back.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, w, h);
  }
  const filename = `${cardFilename(d.brand, 'Card')}-5x7-bleed.pdf`;
  if (save) pdf.save(filename);
  return { pdf, filename };
}

// ── PowerPoint (opens in Google Slides) ───────────────────────
// One 16:9 slide holding the rendered frame edge to edge. Written directly,
// so no presentation library is added to the app.

const EMU = { w: 12192000, h: 6858000 };   // 13.333 x 7.5in at 914400 EMU/in

const PPTX_PARTS = {
  '[Content_Types].xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Default Extension="png" ContentType="image/png"/>
<Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>
<Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/>
<Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>
<Override PartName="/ppt/slides/slide1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>
<Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>
</Types>`,
  '_rels/.rels': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>
</Relationships>`,
  'ppt/presentation.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
<p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst>
<p:sldIdLst><p:sldId id="256" r:id="rId2"/></p:sldIdLst>
<p:sldSz cx="${EMU.w}" cy="${EMU.h}"/><p:notesSz cx="${EMU.h}" cy="${EMU.w}"/>
</p:presentation>`,
  'ppt/_rels/presentation.xml.rels': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide1.xml"/>
<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="theme/theme1.xml"/>
</Relationships>`,
  'ppt/slideMasters/slideMaster1.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldMaster xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
<p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/></p:spTree></p:cSld>
<p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>
<p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst>
</p:sldMaster>`,
  'ppt/slideMasters/_rels/slideMaster1.xml.rels': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="../theme/theme1.xml"/>
</Relationships>`,
  'ppt/slideLayouts/slideLayout1.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldLayout xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" type="blank" preserve="1">
<p:cSld name="Blank"><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/></p:spTree></p:cSld>
<p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>
</p:sldLayout>`,
  'ppt/slideLayouts/_rels/slideLayout1.xml.rels': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="../slideMasters/slideMaster1.xml"/>
</Relationships>`,
  'ppt/slides/_rels/slide1.xml.rels': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image1.png"/>
</Relationships>`,
  'ppt/theme/theme1.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="Conscious Compass">
<a:themeElements>
<a:clrScheme name="Compass"><a:dk1><a:srgbClr val="171B26"/></a:dk1><a:lt1><a:srgbClr val="F2F5F0"/></a:lt1><a:dk2><a:srgbClr val="1D2230"/></a:dk2><a:lt2><a:srgbClr val="AEBFCB"/></a:lt2><a:accent1><a:srgbClr val="D9E021"/></a:accent1><a:accent2><a:srgbClr val="F0DA1E"/></a:accent2><a:accent3><a:srgbClr val="E04A26"/></a:accent3><a:accent4><a:srgbClr val="7E8BA0"/></a:accent4><a:accent5><a:srgbClr val="3A4152"/></a:accent5><a:accent6><a:srgbClr val="F5EFD5"/></a:accent6><a:hlink><a:srgbClr val="D9E021"/></a:hlink><a:folHlink><a:srgbClr val="AEBFCB"/></a:folHlink></a:clrScheme>
<a:fontScheme name="Inter"><a:majorFont><a:latin typeface="Inter"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont><a:minorFont><a:latin typeface="Inter"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont></a:fontScheme>
<a:fmtScheme name="Office"><a:fillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:fillStyleLst><a:lnStyleLst><a:ln w="6350"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln><a:ln w="12700"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln><a:ln w="19050"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln></a:lnStyleLst><a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst><a:bgFillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:bgFillStyleLst></a:fmtScheme>
</a:themeElements>
</a:theme>`,
};

const slideXml = (brand) => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
<p:cSld><p:spTree>
<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
<p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${EMU.w}" cy="${EMU.h}"/><a:chOff x="0" y="0"/><a:chExt cx="${EMU.w}" cy="${EMU.h}"/></a:xfrm></p:grpSpPr>
<p:pic>
<p:nvPicPr><p:cNvPr id="2" name="${esc(brand)} Compass Score"/><p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr/></p:nvPicPr>
<p:blipFill><a:blip r:embed="rId2"/><a:stretch><a:fillRect/></a:stretch></p:blipFill>
<p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${EMU.w}" cy="${EMU.h}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr>
</p:pic>
</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>
</p:sld>`;

const dataUrlToBase64 = (u) => String(u).split(',')[1] || '';

export async function buildSlidePptx(d, pngDataUrl, JSZip) {
  if (typeof JSZip !== 'function') throw new Error('The zip library could not be loaded, so the slide could not be built. Reload the page and try again.');
  const zip = new JSZip();
  Object.entries(PPTX_PARTS).forEach(([path, xml]) => zip.file(path, xml));
  zip.file('ppt/slides/slide1.xml', slideXml(d.brand));
  zip.file('ppt/media/image1.png', dataUrlToBase64(pngDataUrl), { base64: true });
  return { zip, filename: `${cardFilename(d.brand, 'Slide')}.pptx` };
}

export async function exportScorecardSlide(d, { html2canvas, JSZip, saveAs, scale = 1, save = true }) {
  if (typeof html2canvas !== 'function') throw new Error('The page-rendering library (html2canvas) did not load. Reload the page and try again.');
  if (typeof JSZip !== 'function') throw new Error('The zip library could not be loaded, so the slide could not be built. Reload the page and try again.');
  if (typeof saveAs !== 'function') throw new Error('The download helper (file-saver) did not load. Reload the page and try again.');
  await loadScorecardFonts();
  const canvas = await renderToCanvas(slideHtml(d), { width: `${SLIDE.w}px`, height: `${SLIDE.h}px`, scale, html2canvas });
  const { zip, filename } = await buildSlidePptx(d, canvas.toDataURL('image/png'), JSZip);
  const blob = await zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' });
  if (save) saveAs(blob, filename);
  return { blob, filename };
}
