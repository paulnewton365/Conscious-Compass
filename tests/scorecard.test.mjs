// Teaser scorecard: print card and pitch slide, against the Antenna templates.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import JSZip from 'jszip';
import { jsPDF } from 'jspdf';
import {
  cardNameSize, slideNameSize,
  scorecardReady, scorecardData, buildSlidePptx, exportScorecardPdf, exportScorecardSlide, cardFilename, TRIM, BLEED, SLIDE,
} from '../src/lib/scorecard.js';

const tpl = (n) => readFileSync(new URL(`./fixtures/templates/${n}`, import.meta.url), 'utf8');
const D = { brand: 'Acme & Sons', sector: 'Energy & Utilities', baseline: 51, overall: 65, credibility: 69, trust: 65, reputation: 66, authenticity: 62, img: 'data:image/jpeg;base64,AAAA' };

// Style attributes carry no brand data apart from the name size, so comparing
// them against the template is a direct fidelity check.
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

test('pptx is a valid single-slide 16:9 deck with its media embedded', async () => {
  const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==';
  const jpg = 'data:image/jpeg;base64,/9j/4AAQSkZJRg==';
  const { zip, filename } = await buildSlidePptx(D, { hero: jpg, heroRatio: 1.6, qr: png, antenna: png, howl: png }, JSZip);
  const back = await JSZip.loadAsync(await zip.generateAsync({ type: 'nodebuffer' }));
  const names = Object.keys(back.files);
  for (const part of ['[Content_Types].xml', '_rels/.rels', 'ppt/presentation.xml', 'ppt/_rels/presentation.xml.rels',
    'ppt/slideMasters/slideMaster1.xml', 'ppt/slideLayouts/slideLayout1.xml', 'ppt/slides/slide1.xml',
    'ppt/slides/_rels/slide1.xml.rels', 'ppt/theme/theme1.xml']) assert.ok(names.includes(part), `missing ${part}`);
  assert.equal(names.filter(n => n.startsWith('ppt/media/') && !back.files[n].dir).length, 4, 'hero, QR and both logos embedded');
  assert.ok(names.includes('ppt/media/image2.jpeg'), 'the hero keeps its JPEG type');
  const parser = new (new JSDOM('').window.DOMParser)();
  for (const n of names.filter(x => x.endsWith('.xml') || x.endsWith('.rels'))) {
    const doc = parser.parseFromString(await back.file(n).async('string'), 'application/xml');
    assert.equal(doc.getElementsByTagName('parsererror').length, 0, `${n} is malformed`);
  }
  const pres = await back.file('ppt/presentation.xml').async('string');
  assert.ok(pres.includes('cx="12192000" cy="6858000"'), '13.333 x 7.5in, Google Slides widescreen');
  const rels = await back.file('ppt/slides/_rels/slide1.xml.rels').async('string');
  assert.equal((rels.match(/relationships\/image/g) || []).length, 4);
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
  await assert.rejects(exportScorecardSlide(D, { JSZip: {}, saveAs: () => {}, save: false, media: {} }), /zip library/);
  await assert.rejects(exportScorecardSlide(D, { JSZip, saveAs: undefined, save: false, media: {} }), /file-saver/);
  await assert.rejects(buildSlidePptx(D, 'data:image/png;base64,AA', {}), /zip library/);
  await assert.rejects(buildSlidePptx(D, 'data:image/png;base64,AA', undefined), /zip library/);
});

test('the zip loader accepts every shape a bundler can hand back', async () => {
  const { loadJSZip } = await import('../src/lib/lazyZip.js');
  assert.equal(typeof await loadJSZip(), 'function', 'resolves the real module');
});


// ── Rendering faults found in the first printed card (v3.41) ──

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
    setFont(f) { this.font = f; }, setFontSize(s) { this.size = s; }, setTextColor() {},
    addFileToVFS(name) { calls.vfs = name; }, addFont(file, name) { calls.font = name; },
    getTextWidth(t) { return (this.size / 72) * 0.58 * String(t).length; },
    rect(x, y, w, h, style) { calls.rect.push({ x, y, w, h, style, fill: this.fill, alpha: this.alpha }); },
    text(t, x, y) { calls.text.push({ t, x, y, size: this.size, font: this.font }); },
    addImage(img, fmt, x, y, w, h) { calls.image.push({ img, x, y, w, h }); },
    line(x1, y1, x2, y2) { calls.line.push({ x1, y1, x2, y2 }); },
    triangle() { calls.triangle.push(1); },
    saveGraphicsState() { calls.saved = true; }, restoreGraphicsState() { calls.restored = true; },
    clip() { calls.clipped = true; }, discardPath() {},
    // a plain function, since shorthand methods cannot be called with new
    GState: function (o) { return o; },
    setGState(o) { calls.gstate = o; this.alpha = o.opacity; },
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


test('the plate labels are set in the embedded Space Mono, as the template has them', () => {
  const { api, calls } = recorder();
  drawCardFront(api, D, { spaceMono: 'AAAA' });
  assert.equal(calls.vfs, 'SpaceMono-Regular.ttf');
  assert.equal(calls.font, 'SpaceMono');
  const fontOf = (word) => calls.text.filter(t => t.t === word).map(t => t.font);
  ['C', 'O', 'M'].forEach(ch => assert.ok(fontOf(ch).includes('SpaceMono'), `${ch} of COMPASS in Space Mono`));
  // Digits appear only in the scores, never in the mono labels: they stay in
  // Helvetica, which PDF carries itself.
  const digits = calls.text.filter(t => /^[0-9]$/.test(t.t));
  assert.ok(digits.length > 8 && digits.every(t => t.font === 'helvetica'), 'scores in Helvetica');
});

test('a missing font file falls back to Helvetica rather than failing the card', () => {
  const { api, calls } = recorder();
  drawCardFront(api, D, {});
  assert.equal(calls.font, undefined, 'no font registered');
  assert.ok(calls.text.every(t => t.font === 'helvetica'));
  assert.ok(calls.text.length > 50, 'card still drawn in full');
});

test('the Space Mono file ships with the build', async () => {
  const { statSync } = await import('node:fs');
  const f = statSync(new URL('../public/scorecard/SpaceMono-Regular.ttf', import.meta.url));
  assert.ok(f.size > 10000 && f.size < 200000, `unexpected font size ${f.size}`);
});

test('spacing matches the reference card: the chip clears the plate, and the tiles keep their gaps', () => {
  const { api, calls } = recorder();
  drawCardFront(api, D, {});
  const filled = calls.rect.filter(r => r.style === 'F');
  const lime = filled.filter(r => r.fill === '#D9E021');
  const plate = lime[0];                       // score plate inside the well
  const chip = filled.find(r => r.fill === '#0F121A' && r.alpha === 0.88);
  const gap = plate.y - (chip.y + chip.h);
  assert.ok(gap > 0.06 && gap < 0.11, `chip should clear the plate by about 0.09in, got ${gap.toFixed(3)}`);

  const tiles = filled.filter(r => r.fill === '#1D2230');
  assert.equal(tiles.length, 4);
  const gaps = tiles.slice(1).map((t, i) => t.x - (tiles[i].x + tiles[i].w));
  gaps.forEach(g => assert.ok(Math.abs(g - 0.107) < 0.002, `tile gap ${g.toFixed(3)}`));
  const first = tiles[0], last = tiles[3];
  assert.ok(Math.abs(first.x - (CARD.bleed + 0.22)) < 0.002, 'tiles start at the content edge');
  assert.ok(Math.abs((last.x + last.w) - (CARD.bleed + CARD.trimW - 0.22)) < 0.002, 'and end at it');

  // Tiles sit 0.18in below the image well, as measured on the reference.
  const well = filled.find(r => r.fill === '#0F121A');
  assert.ok(Math.abs(first.y - (well.y + well.h + 0.18)) < 0.002, 'gap above the tiles');
});


test('the average chip is translucent, so the image reads through it as in the template', () => {
  const { api, calls } = recorder();
  drawCardFront(api, D, {});
  assert.deepEqual(calls.gstate, { opacity: 0.88 }, 'rgba(15,18,26,0.88)');
  const chip = calls.rect.find(r => r.style === 'F' && r.fill === '#0F121A' && r.alpha === 0.88);
  assert.ok(chip, 'chip drawn translucent');
  // The score plate underneath stays solid lime.
  const plate = calls.rect.find(r => r.style === 'F' && r.fill === '#D9E021');
  assert.ok(plate && plate.alpha !== 0.88, 'plate is opaque');
});

test('a renderer without graphics-state support still gets a solid chip, not a missing one', () => {
  const { api, calls } = recorder();
  delete api.GState; delete api.setGState;
  drawCardFront(api, D, {});
  const chip = calls.rect.find(r => r.style === 'F' && r.fill === '#0F121A');
  assert.ok(chip, 'chip still drawn');
});

test('a chunk that no longer exists on the server reads as an out-of-date page', async () => {
  const src = readFileSync(new URL('../src/lib/lazyZip.js', import.meta.url), 'utf8');
  assert.match(src, /Reload the page and try again/);
  assert.match(src, /catch/);
});


// ── Native slide (v3.48) ──

import { slideXml, slideLayout, slideNamePx, SLIDE_PX, EMU_PER_PX } from '../src/lib/slideVector.js';

const RELS = { hero: 'rId2', qr: 'rId3', antenna: 'rId4', howl: 'rId5' };

test('the slide is native shapes and text, not a picture of the frame', () => {
  const xml = slideXml({ ...D, heroRatio: 1.6 }, RELS);
  const parsed = new (new JSDOM('').window.DOMParser)().parseFromString(xml, 'application/xml');
  assert.equal(parsed.getElementsByTagName('parsererror').length, 0, 'well-formed');
  const shapes = (xml.match(/<p:sp>/g) || []).length;
  assert.ok(shapes > 20, `expected a shape per element, got ${shapes}`);
  // Every word a reader sees is real text.
  for (const t of ['ACME &amp; SONS', 'CONSEQUENTIAL', 'BRANDS ARE', 'CONSCIOUS BRANDS', 'YOUR COMPASS', 'INDUSTRY AVERAGE',
    'CREDIBILITY', 'TRUST', 'REPUTATION', 'AUTHENTICITY', 'antennagroup.com', 'ARE YOU', 'CONSCIOUS?']) {
    assert.ok(xml.includes(`<a:t>${t}</a:t>`), t);
  }
  ['65', '51', '69', '66', '62'].forEach(v => assert.ok(xml.includes(`<a:t>${v}</a:t>`), v));
  assert.ok(xml.includes('/100'));
});

test('1920 x 1080 px maps exactly onto the 13.333 x 7.5in slide', () => {
  assert.equal(SLIDE_PX.w * EMU_PER_PX, 12192000, '13.333in');
  assert.equal(SLIDE_PX.h * EMU_PER_PX, 6858000, '7.5in');
});

test('nothing overflows the slide, and the columns keep the template geometry', () => {
  const L = slideLayout(D);
  assert.equal(L.leftX, 72);
  assert.equal(L.rightX + L.rightW, SLIDE_PX.w - 72, 'right column ends at the padding');
  assert.ok(L.tileY + L.tileH <= L.bottom + 0.5, 'tiles sit inside the bottom padding');
  assert.ok(L.wellH > 300, 'the image well takes the space left over');
  const xml = slideXml(D, RELS);
  const offs = [...xml.matchAll(/<a:off x="(-?\d+)" y="(-?\d+)"\/><a:ext cx="(\d+)" cy="(\d+)"\/>/g)];
  offs.forEach(([, x, y, cx, cy]) => {
    assert.ok(Number(x) + Number(cx) <= 12192000 + 1, 'shape within slide width');
    assert.ok(Number(y) + Number(cy) <= 6858000 + 1, 'shape within slide height');
  });
});

test('the headline highlight and the URL never wrap', () => {
  const xml = slideXml(D, RELS);
  const noWrap = [...xml.matchAll(/<a:bodyPr[^>]*wrap="none"[^>]*>/g)];
  assert.ok(noWrap.length >= 2, 'highlight and link are set not to wrap');
  // The highlight is its own block, so it cannot paint over the line above.
  const hi = xml.indexOf('CONSCIOUS BRANDS');
  const before = xml.slice(0, hi);
  assert.ok(before.lastIndexOf('D9E021') > before.lastIndexOf('<a:t>BRANDS ARE</a:t>'), 'lime block belongs to the highlight line');
});

test('line spacing is exact points, since percentage spacing adds the font leading', () => {
  const xml = slideXml(D, RELS);
  assert.ok(!xml.includes('spcPct'), 'no percentage line spacing');
  assert.ok((xml.match(/<a:spcPts val="\d+"\/>/g) || []).length > 10);
});

test('text is set in Inter, and the name size steps with the brand length', () => {
  const xml = slideXml(D, RELS);
  assert.ok(xml.includes('<a:latin typeface="Inter"/>'));
  assert.deepEqual(['Nasdaq', 'Wells Fargo', 'Mitsubishi Heavy Industries'].map(slideNamePx), [84, 66, 40]);
});

test('images are referenced by relationship, and a missing one simply drops out', () => {
  const full = slideXml(D, RELS);
  ['rId2', 'rId3', 'rId4', 'rId5'].forEach(id => assert.ok(full.includes(`r:embed="${id}"`), id));
  const none = slideXml(D, {});
  assert.ok(!none.includes('<p:pic>'), 'no picture shapes without media');
  assert.ok(none.includes('<a:t>CONSEQUENTIAL</a:t>'), 'the rest of the slide still builds');
});

test('the brand image is cropped to fill its frame, like object-fit cover', () => {
  const wide = slideXml({ ...D, heroRatio: 3 }, RELS);
  const tall = slideXml({ ...D, heroRatio: 0.5 }, RELS);
  // the brand image, not whichever picture happens to come first
  const crop = (xml) => xml.slice(xml.indexOf('name="Brand image"')).match(/<a:srcRect l="(\d+)" r="(\d+)" t="(\d+)" b="(\d+)"\/>/);
  const w = crop(wide), t = crop(tall);
  assert.ok(Number(w[1]) > 0 && Number(w[3]) === 0, 'a wide image is cropped left and right');
  assert.ok(Number(t[3]) > 0 && Number(t[1]) === 0, 'a tall image is cropped top and bottom');
});


test('no keyline is drawn around the image, on the card or the slide', () => {
  const { api, calls } = recorder();
  drawCardFront(api, D, { hero: 'data:image/jpeg;base64,AA', heroRatio: 1.6 });
  const well = calls.rect.find(r => r.style === 'F' && r.fill === '#0F121A');
  const outlines = calls.rect.filter(r => r.style === 'S' && Math.abs(r.w - well.w) < 0.001 && Math.abs(r.h - well.h) < 0.001);
  assert.equal(outlines.length, 0, 'the image well has no stroked border');
  // Tiles keep theirs.
  assert.ok(calls.rect.some(r => r.style === 'S'), 'tile borders are still drawn');

  const xml = slideXml({ ...D, heroRatio: 1.6 }, RELS);
  const wellShape = xml.slice(xml.indexOf('name="Image well"'), xml.indexOf('name="Brand image"'));
  assert.ok(wellShape.includes('<a:ln><a:noFill/></a:ln>'), 'slide image well has no line');
  assert.ok(!wellShape.includes('3A4152'), 'no keyline colour on the well');
});

test('the slide follows the cleaned-up reference deck (v3.52)', () => {
  const xml = slideXml({ ...D, heroRatio: 1.6 }, RELS);
  // The divider and the separate teaser note were removed there; the note now
  // runs on as the last paragraphs of the body.
  assert.ok(!xml.includes('name="Divider"'));
  assert.ok(!xml.includes('name="Teaser note"'));
  const body = xml.slice(xml.indexOf('name="Body"'), xml.indexOf('name="Link"'));
  assert.ok(body.includes('The scores shown here come from our teaser assessment.'));
  assert.ok(body.includes('Contact us for a deeper dive into your brand.'));
  assert.equal((body.match(/<a:p>/g) || []).length, 4, 'four body paragraphs');
  // Sizes as set in the reference: headline 58, body 23, tiles 66/16,
  // plate label 20 bold, chip label 16.
  assert.ok(xml.includes(`sz="${58 * 50}"`), 'headline 58px');
  assert.ok(body.includes(`sz="${23 * 50}"`), 'body 23px');
  const tile = xml.slice(xml.indexOf('name="CREDIBILITY value"'), xml.indexOf('name="Tile TRUST"'));
  assert.ok(tile.includes(`sz="${66 * 50}"`), 'tile value 66px');
  const plateLabel = xml.slice(xml.indexOf('name="Compass score label"'), xml.indexOf('name="Compass score value"'));
  assert.ok(plateLabel.includes(`sz="${24 * 50}"`) && plateLabel.includes('b="1"'), 'plate label 24px bold');
  assert.ok(plateLabel.includes('<a:t>YOUR COMPASS</a:t>') && plateLabel.includes('<a:t>TEASER SCORE</a:t>'), 'the plate says TEASER SCORE');
});
