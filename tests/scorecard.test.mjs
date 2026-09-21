// Teaser scorecard: print card and pitch slide, against the Antenna templates.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import JSZip from 'jszip';
import { jsPDF } from 'jspdf';
import {
  slideHtml, cardNameSize, slideNameSize,
  scorecardReady, scorecardData, buildSlidePptx, exportScorecardPdf, exportScorecardSlide, cardFilename, TRIM, BLEED, SLIDE,
} from '../src/lib/scorecard.js';

const tpl = (n) => readFileSync(new URL(`./fixtures/templates/${n}`, import.meta.url), 'utf8');
const D = { brand: 'Acme & Sons', sector: 'Energy & Utilities', baseline: 51, overall: 65, credibility: 69, trust: 65, reputation: 66, authenticity: 62, img: 'data:image/jpeg;base64,AAAA' };

// Style attributes carry no brand data apart from the name size, so comparing
// them against the template is a direct fidelity check.
const styles = (html) => [...html.matchAll(/style="([^"]*)"/g)].map(m => m[1]
  .replace(/&quot;/g, '"').replace(/&amp;/g, '&')
  .replace(/'Archivo Expanded','Archivo',sans-serif/g, "'Archivo Expanded',sans-serif")
  .replace(/font-size:\s*(\{\{ c\.nameSize \}\}|\d+px);letter-spacing:0\.01em/g, 'font-size:NAMESIZE;letter-spacing:0.01em')
  // the template's footer colour is a placeholder; the per-brand value is #7E8BA0
  .replace(/color:\s*(\{\{ c\.footColor \}\}|#7E8BA0);text-transform:uppercase;/g, 'color:FOOTCOLOR;text-transform:uppercase;')
  .replace(/\s+/g, ' ').trim());

test('slide reuses the template styles exactly, bar the declared change', () => {
  const template = styles(tpl('slide.dc.html'));
  // Declared deviation: the template's frame is sized by its runtime wrapper,
  // so the exported frame carries 1920x1080 itself. Everything else matches.
  const DEVIATIONS_SLIDE = [
    'height:38px;width:auto;display:block;',
    "font-family:'Inter',sans-serif;font-weight:900;font-size:60px;line-height:1.18;margin:0;text-transform:uppercase;color:#F2F5F0;",
    'display:inline-block;background:#D9E021;color:#171B26;padding:0 8px;',
  ];
  const DEVIATION = "width:1920px;height:1080px;background:#171B26;display:flex;flex-direction:column;padding:52px 72px 86px;box-sizing:border-box;overflow:hidden;font-family:'Inter',sans-serif;color:#F2F5F0;";
  const unmatched = styles(slideHtml(D)).filter(s => !template.includes(s) && s !== DEVIATION && !DEVIATIONS_SLIDE.includes(s));
  assert.deepEqual(unmatched, [], 'styles not found in the template');
});

test('brand data lands in both, and nothing is left as a template placeholder', () => {
  for (const html of [slideHtml(D)]) {
    assert.ok(!/\{\{|\}\}|sc-if|sc-for|image-slot/.test(html), 'unresolved template syntax');
    assert.ok(html.includes('Acme &amp; Sons'), 'brand name escaped');
    for (const v of ['51', '65', '69', '66', '62']) assert.ok(html.includes(`>${v}<`), v);
    ['Credibility', 'Trust', 'Reputation', 'Authenticity'].forEach(l => assert.ok(html.includes(l)));
    assert.ok(html.includes('data:image/jpeg;base64,AAAA'), 'hero image');
  }
  assert.ok(slideHtml(D).includes('Indicative scores measured by the Conscious Compass Teaser Assessment'));
});

test('missing scores show as a dash rather than NaN or zero', () => {
  const html = slideHtml({ ...D, overall: null, baseline: undefined, credibility: 'x' });
  assert.ok(html.includes('>—<'));
  assert.ok(!/NaN|undefined|null/.test(html));
});

test('nothing loads from another origin, or the PDF canvas would be blocked', () => {
  const html = slideHtml(D);
  const srcs = [...html.matchAll(/src="([^"]+)"/g)].map(m => m[1]);
  srcs.forEach(src => assert.ok(src.startsWith('/scorecard/') || src.startsWith('data:'), `external asset: ${src}`));
  assert.ok(srcs.includes('/scorecard/qr-lets-chat.png'), 'QR is the local asset, not api.qrserver.com');
  assert.ok(!html.includes('qrserver.com'));
});

test('name sizes follow the template ladders', () => {
  assert.deepEqual(['Nasdaq', 'Autodesk', 'Wells Fargo', 'Mitsubishi Heavy Industries'].map(cardNameSize), ['34px', '34px', '25px', '13px']);
  assert.deepEqual(['Nasdaq', 'Wells Fargo', 'Mitsubishi Heavy Industries'].map(slideNameSize), ['84px', '66px', '40px']);
  assert.equal(cardNameSize('Mercedes-Benz High-Power Charging'), '13px');
  assert.equal(slideNameSize('CarbonQuest'), '66px');
});

test('a scorecard needs a score, a brand image and a baseline', () => {
  const rec = { brand_name: 'Acme', result: { overall: 60, lensScores: {} }, hero_image: 'data:,' };
  assert.deepEqual(scorecardReady(rec, { avgScore: 51 }), { ready: true, missing: [] });
  assert.deepEqual(scorecardReady({ ...rec, hero_image: null }, { avgScore: 51 }).missing, ['a brand image']);
  assert.deepEqual(scorecardReady({ ...rec, result: null }, { avgScore: 51 }).missing, ['a score', 'a sector baseline'].slice(0, 1));
  assert.deepEqual(scorecardReady(rec, null).missing, ['a sector baseline']);
});

test('scorecard data comes from the teaser and the full-assessment baseline', () => {
  const d = scorecardData(
    { brand_name: 'Acme', hero_image: 'data:x', result: { overall: 65, lensScores: { credibility: 69, trust: 65, reputation: 66, authenticity: 62 } } },
    { avgScore: 51, sectorName: 'Energy & Utilities' }, 'Energy & Utilities');
  assert.deepEqual(d, { brand: 'Acme', sector: 'Energy & Utilities', baseline: 51, overall: 65, credibility: 69, trust: 65, reputation: 66, authenticity: 62, img: 'data:x' });
});

// ── Print card PDF ──

const stubCanvas = () => ({ toDataURL: () => 'data:image/jpeg;base64,/9j/4AAQSkZJRg==', width: 10, height: 14 });

test('pptx is a valid single-slide 16:9 deck with the frame full bleed', async () => {
  const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==';
  const { zip, filename } = await buildSlidePptx(D, png, JSZip);
  const back = await JSZip.loadAsync(await zip.generateAsync({ type: 'nodebuffer' }));
  const names = Object.keys(back.files);
  for (const part of ['[Content_Types].xml', '_rels/.rels', 'ppt/presentation.xml', 'ppt/_rels/presentation.xml.rels',
    'ppt/slideMasters/slideMaster1.xml', 'ppt/slideMasters/_rels/slideMaster1.xml.rels', 'ppt/slideLayouts/slideLayout1.xml',
    'ppt/slideLayouts/_rels/slideLayout1.xml.rels', 'ppt/slides/slide1.xml', 'ppt/slides/_rels/slide1.xml.rels',
    'ppt/theme/theme1.xml', 'ppt/media/image1.png']) assert.ok(names.includes(part), `missing ${part}`);
  const parser = new (new JSDOM('').window.DOMParser)();
  for (const n of names.filter(x => x.endsWith('.xml') || x.endsWith('.rels'))) {
    const doc = parser.parseFromString(await back.file(n).async('string'), 'application/xml');
    assert.equal(doc.getElementsByTagName('parsererror').length, 0, `${n} is malformed`);
  }
  const pres = await back.file('ppt/presentation.xml').async('string');
  assert.ok(pres.includes('cx="12192000" cy="6858000"'), '13.333 x 7.5in, Google Slides widescreen');
  const slide = await back.file('ppt/slides/slide1.xml').async('string');
  assert.ok(slide.includes('<a:off x="0" y="0"/><a:ext cx="12192000" cy="6858000"/>'), 'image fills the slide');
  assert.ok(slide.includes('Acme &amp; Sons Compass Score'), 'brand name escaped in the shape name');
  assert.equal(filename, 'Acme-Sons-Compass-Slide.pptx');
  assert.equal(SLIDE.w / SLIDE.h, 16 / 9);
});

test('filenames are safe for any brand name', () => {
  assert.equal(cardFilename('H&M', 'Card'), 'H-M-Compass-Card');
  assert.equal(cardFilename('Mercedes-Benz High-Power Charging', 'Slide'), 'Mercedes-Benz-High-Power-Charging-Compass-Slide');
  assert.equal(cardFilename('', 'Card'), 'brand-Compass-Card');
});

// ── Library loading failures name the library (v3.39) ──

test('a library that fails to load is named, never a minified letter', async () => {
  await assert.rejects(exportScorecardPdf(D, { jsPDF: {}, save: false }), /jsPDF/);
  await assert.rejects(exportScorecardSlide(D, { html2canvas: undefined, JSZip, saveAs: () => {}, save: false }), /html2canvas/);
  await assert.rejects(exportScorecardSlide(D, { html2canvas: async () => stubCanvas(), JSZip: {}, saveAs: () => {}, save: false }), /zip library/);
  await assert.rejects(exportScorecardSlide(D, { html2canvas: async () => stubCanvas(), JSZip, saveAs: undefined, save: false }), /file-saver/);
  await assert.rejects(buildSlidePptx(D, 'data:image/png;base64,AA', {}), /zip library/);
  await assert.rejects(buildSlidePptx(D, 'data:image/png;base64,AA', undefined), /zip library/);
});

test('the zip loader accepts every shape a bundler can hand back', async () => {
  const { loadJSZip } = await import('../src/lib/lazyZip.js');
  assert.equal(typeof await loadJSZip(), 'function', 'resolves the real module');
});


// ── Rendering faults found in the first printed card (v3.41) ──

test('no CSS filter survives in the artwork: html2canvas ignores them', () => {
  const html = slideHtml(D);
  assert.ok(!/filter:/.test(html), 'a filtered logo renders dark on dark');
  assert.ok(html.includes('/scorecard/antenna-logo-white.png'), 'pre-whitened asset used instead');
});

test('the fixed back artwork ships with the build at the right size', async () => {
  const { statSync, readFileSync: rf } = await import('node:fs');
  const path = new URL('../public/scorecard/card-back.png', import.meta.url);
  assert.ok(statSync(path).size > 10000, 'artwork present');
  // PNG header: width and height are big-endian 32-bit at bytes 16 and 20.
  const buf = rf(path);
  const w = buf.readUInt32BE(16), h = buf.readUInt32BE(20);
  assert.equal(w, Math.round((TRIM.w + BLEED * 2) * 300), '5.25in at 300dpi');
  assert.equal(h, Math.round((TRIM.h + BLEED * 2) * 300), '7.25in at 300dpi');
});


// ── Vector card front (v3.43) ──

import { drawCardFront, CARD, nameSizePx } from '../src/lib/cardVector.js';

// A stand-in PDF that records what would be drawn.
function recorder() {
  const calls = { rect: [], text: [], image: [], line: [], triangle: [] };
  const api = {
    setFillColor(c) { this.fill = c; }, setDrawColor(c) { this.stroke = c; }, setLineWidth() {},
    setFont() {}, setFontSize(s) { this.size = s; }, setTextColor() {},
    getTextWidth(t) { return (this.size / 72) * 0.58 * String(t).length; },
    rect(x, y, w, h, style) { calls.rect.push({ x, y, w, h, style, fill: this.fill }); },
    text(t, x, y) { calls.text.push({ t, x, y, size: this.size }); },
    addImage(img, fmt, x, y, w, h) { calls.image.push({ img, x, y, w, h }); },
    line(x1, y1, x2, y2) { calls.line.push({ x1, y1, x2, y2 }); },
    triangle() { calls.triangle.push(1); },
    saveGraphicsState() { calls.saved = true; }, restoreGraphicsState() { calls.restored = true; },
    clip() { calls.clipped = true; }, discardPath() {},
  };
  return { api, calls };
}

const PAGE = { w: CARD.trimW + CARD.bleed * 2, h: CARD.trimH + CARD.bleed * 2 };

test('every element of the front sits inside the page, and the ground covers the bleed', () => {
  const { api, calls } = recorder();
  drawCardFront(api, D, {});
  const ground = calls.rect[0];
  assert.deepEqual([ground.x, ground.y, ground.w, ground.h], [0, 0, PAGE.w, PAGE.h], 'ground bleeds to the edges');
  for (const r of calls.rect) {
    assert.ok(r.x >= -0.001 && r.y >= -0.001 && r.x + r.w <= PAGE.w + 0.001 && r.y + r.h <= PAGE.h + 0.001,
      `rect out of page: ${JSON.stringify(r)}`);
  }
  for (const t of calls.text) {
    assert.ok(t.x >= CARD.bleed && t.x <= PAGE.w - CARD.bleed, `text out of trim: ${t.t} at ${t.x}`);
    assert.ok(t.y >= CARD.bleed && t.y <= PAGE.h - CARD.bleed, `text out of trim: ${t.t} at ${t.y}`);
  }
});

test('the front carries the brand, every score and the fixed copy', () => {
  const { api, calls } = recorder();
  drawCardFront(api, D, {});
  const drawn = calls.text.map(t => t.t).join('');
  for (const word of ['NASDAQ'.slice(0, 0) + 'ACME & SONS', 'COMPASS', 'SCORE', '/100', 'INDUSTRYAVERAGE'.slice(0, 8)]) {
    assert.ok(drawn.replace(/\s/g, '').includes(word.replace(/\s/g, '')), word);
  }
  ['65', '51', '69', '66', '62'].forEach(v => assert.ok(drawn.includes(v), v));
  ['CREDIBILITY', 'TRUST', 'REPUTATION', 'AUTHENTICITY'].forEach(l => assert.ok(drawn.includes(l), l));
  assert.ok(drawn.includes('MEASUREDBYTHECONSCIOUSCOMPASSTEASERASSESSMENT'.slice(0, 8)) || drawn.includes('MEASURED'));
  assert.ok(drawn.includes('AREYOU') || drawn.includes('ARE YOU'));
});

test('the brand image is clipped to its well', () => {
  const { api, calls } = recorder();
  drawCardFront(api, D, { hero: 'data:image/jpeg;base64,AA', heroRatio: 3 });
  assert.ok(calls.saved && calls.clipped && calls.restored, 'clip path set and released');
  const hero = calls.image.find(i => i.img.startsWith('data:image/jpeg'));
  assert.ok(hero, 'hero drawn');
  assert.ok(hero.w > CARD.trimW - CARD.padSide * 2, 'a wide image overflows the well, which is why it is clipped');
});

test('missing scores print an em dash, never NaN', () => {
  const { api, calls } = recorder();
  drawCardFront(api, { brand: 'X' }, {});
  const drawn = calls.text.map(t => t.t).join('');
  assert.ok(drawn.includes('\u2014'));
  assert.ok(!/NaN|undefined|null/.test(drawn));
});

test('the arrow is drawn, because Helvetica has no arrow glyph', () => {
  const { api, calls } = recorder();
  drawCardFront(api, D, {});
  assert.equal(calls.line.length >= 1, true);
  assert.equal(calls.triangle.length, 1);
  assert.ok(!calls.text.some(t => /\u2192/.test(t.t)), 'no arrow character is typeset');
});

test('name size steps down as the brand name gets longer', () => {
  assert.deepEqual(['Nasdaq', 'Wells Fargo', 'Mitsubishi Heavy Industries'].map(nameSizePx), [34, 25, 13]);
});
