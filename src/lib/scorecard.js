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

import { drawCardFront, CARD } from './cardVector.js';
import { slideXml, SLIDE_PX } from './slideVector.js';

const A = {
  // Pre-whitened: the templates whiten the dark logo with a CSS filter, and
  // html2canvas ignores filters, so the logo came out dark on dark.
  antennaLogo: '/scorecard/antenna-logo-white.png',
  antennaA: '/scorecard/antenna-a.png',
  howl: '/scorecard/howl-logo.png',
  qr: '/scorecard/qr-lets-chat.png',
  // Space Mono, embedded into the PDF for the two plate labels.
  spaceMono: '/scorecard/SpaceMono-Regular.ttf',
};

const IMAGE_TIMEOUT_MS = 8000;

export const TRIM = { w: 5, h: 7 };           // inches
export const BLEED = 0.125;                    // inches on every side
export const SLIDE = { w: 1920, h: 1080 };     // px


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

// ── Rendering ─────────────────────────────────────────────────

// Kept for reference while the card was rendered from HTML; nothing loads
// fonts at export time now.
export const cardFilename = (brand, kind) => `${String(brand || 'brand').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'brand'}-Compass-${kind}`;

// The back page is identical for every brand, so a fixed artwork export beats
// re-rendering HTML. Drop a 5.25 x 7.25in image (1575 x 2175px at 300dpi) at
// public/scorecard/card-back.png and it is used instead; without it, the HTML
// back page below is rendered as before.
export const BACK_ARTWORK = '/scorecard/card-back.png';

// Font bytes as base64 for jsPDF's virtual file system. A failure here just
// falls back to Helvetica rather than stopping the card.
export async function loadFontBase64(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const bytes = new Uint8Array(await res.arrayBuffer());
    let bin = '';
    for (let i = 0; i < bytes.length; i += 8192) bin += String.fromCharCode(...bytes.subarray(i, i + 8192));
    return btoa(bin);
  } catch {
    return null;
  }
}

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

export async function exportScorecardPdf(d, { jsPDF, save = true, backArtwork = BACK_ARTWORK, assets = null }) {
  if (typeof jsPDF !== 'function') throw new Error('The PDF library (jsPDF) did not load. Reload the page and try again.');
  const w = TRIM.w + BLEED * 2, h = TRIM.h + BLEED * 2;
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'in', format: [w, h] });

  // Page 1 is drawn as vector art: sharp at any size, and free of the web
  // font and renderer differences that HTML rendering brought with it.
  const art = assets || await loadFrontAssets(d);
  drawCardFront(pdf, d, art);

  // Page 2 never changes, so it comes from fixed artwork.
  pdf.addPage([w, h], 'portrait');
  const back = backArtwork ? await loadImage(backArtwork) : null;
  if (back) {
    pdf.addImage(back, 'PNG', 0, 0, w, h);
  } else {
    throw new Error('The card back artwork (public/scorecard/card-back.png) is missing from this build, so the card was not created.');
  }

  const filename = `${cardFilename(d.brand, 'Card')}-5x7-bleed.pdf`;
  if (save) pdf.save(filename);
  return { pdf, filename };
}

// Images the front needs, with their aspect ratios.
export async function loadFrontAssets(d) {
  const [qr, antennaA, hero, spaceMono] = await Promise.all([
    loadImage(A.qr), loadImage(A.antennaA), d.img ? loadImage(d.img) : Promise.resolve(null), loadFontBase64(A.spaceMono),
  ]);
  return {
    qr, antennaA, spaceMono,
    antennaARatio: antennaA ? antennaA.naturalWidth / antennaA.naturalHeight : 1,
    hero,
    heroRatio: hero ? hero.naturalWidth / hero.naturalHeight : 1.6,
  };
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
<Default Extension="jpeg" ContentType="image/jpeg"/>
<Default Extension="jpg" ContentType="image/jpeg"/>
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

const dataUrlToBase64 = (u) => String(u).split(',')[1] || '';

// Assembles the .pptx. Images are embedded as media parts and referenced by
// the slide's shapes, so everything on the slide stays editable text.
export async function buildSlidePptx(d, media, JSZip) {
  if (typeof JSZip !== 'function') throw new Error('The zip library could not be loaded, so the slide could not be built. Reload the page and try again.');
  const zip = new JSZip();
  Object.entries(PPTX_PARTS).forEach(([path, xml]) => zip.file(path, xml));

  // media: { hero, qr, antenna, howl } as data URLs, plus heroRatio.
  const rels = {};
  const relXml = ['<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>'];
  let n = 1;
  for (const key of ['hero', 'qr', 'antenna', 'howl']) {
    const url = media?.[key];
    if (!url) continue;
    const ext = /^data:image\/jpe?g/.test(url) ? 'jpeg' : 'png';
    const id = `rId${++n}`;
    rels[key] = id;
    zip.file(`ppt/media/image${n}.${ext}`, dataUrlToBase64(url), { base64: true });
    relXml.push(`<Relationship Id="${id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image${n}.${ext}"/>`);
  }
  zip.file('ppt/slides/_rels/slide1.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
${relXml.join('\n')}
</Relationships>`);
  zip.file('ppt/slides/slide1.xml', slideXml({ ...d, heroRatio: media?.heroRatio }, rels));
  return { zip, filename: `${cardFilename(d.brand, 'Slide')}.pptx` };
}

export async function exportScorecardSlide(d, { JSZip, saveAs, save = true, media = null }) {
  if (typeof saveAs !== 'function') throw new Error('The download helper (file-saver) did not load. Reload the page and try again.');
  const assets = media || await loadSlideMedia(d);
  const { zip, filename } = await buildSlidePptx(d, assets, JSZip);
  const blob = await zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' });
  if (save) saveAs(blob, filename);
  return { blob, filename };
}

// The slide's images, as data URLs the .pptx can embed.
export async function loadSlideMedia(d) {
  const [qr, antenna, howl] = await Promise.all([fetchDataUrl(A.qr), fetchDataUrl(A.antennaLogo), fetchDataUrl(A.howl)]);
  let heroRatio = 1.6;
  if (d.img) {
    const img = await loadImage(d.img);
    if (img && img.naturalWidth) heroRatio = img.naturalWidth / img.naturalHeight;
  }
  return { hero: d.img || null, qr, antenna, howl, heroRatio };
}

export async function fetchDataUrl(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = () => resolve(null);
      r.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}
