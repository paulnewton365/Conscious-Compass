// Teaser scorecard: print card and pitch slide, against the Antenna templates.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import JSZip from 'jszip';
import { jsPDF } from 'jspdf';
import {
  cardFrontHtml, cardBackHtml, slideHtml, cardNameSize, slideNameSize,
  scorecardReady, scorecardData, buildSlidePptx, exportScorecardPdf, cardFilename, TRIM, BLEED, SLIDE,
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

test('card front and back reuse the template styles exactly, bar the declared changes', () => {
  const template = styles(tpl('card.dc.html'));
  // Declared deviations, and nothing else:
  //  1. no border-radius: the card is bled and trimmed square
  //  2. the template's <image-slot> becomes a plain <img> with cover fit
  const DEVIATIONS = [
    'width:100%;height:100%;background:#171B26;box-sizing:border-box;display:flex;flex-direction:column;overflow:hidden;padding:0.2in 0.22in 0.18in;',
    'width:100%;height:100%;background:#171B26;box-sizing:border-box;display:flex;flex-direction:column;overflow:hidden;padding:0.3in 0.3in 0;',
    'width:100%;height:100%;object-fit:cover;display:block;',
    "font-size:19px;font-weight:400;line-height:1.5;margin-top:0.2in;display:flex;flex-direction:column;gap:0.14in;text-wrap:pretty;color:#F2F5F0;font-family:'Archivo',sans-serif;",
  ];
  const unmatched = [...styles(cardFrontHtml(D)), ...styles(cardBackHtml())]
    .filter(s => !template.includes(s) && !DEVIATIONS.includes(s));
  assert.deepEqual(unmatched, [], 'styles not found in the template');
});

test('slide reuses the template styles exactly, bar the declared change', () => {
  const template = styles(tpl('slide.dc.html'));
  // Declared deviation: the template's frame is sized by its runtime wrapper,
  // so the exported frame carries 1920x1080 itself. Everything else matches.
  const DEVIATION = "width:1920px;height:1080px;background:#171B26;display:flex;flex-direction:column;padding:52px 72px 86px;box-sizing:border-box;overflow:hidden;font-family:'Inter',sans-serif;color:#F2F5F0;";
  const unmatched = styles(slideHtml(D)).filter(s => !template.includes(s) && s !== DEVIATION);
  assert.deepEqual(unmatched, [], 'styles not found in the template');
});

test('the card keeps Archivo and the slide keeps Inter, as the templates do', () => {
  const card = cardFrontHtml(D) + cardBackHtml();
  assert.ok(card.includes("'Archivo Expanded'") && card.includes("'Space Mono'"));
  assert.ok(!card.includes('Inter'));
  const slide = slideHtml(D);
  assert.ok(slide.includes("'Inter',sans-serif"));
  assert.ok(!slide.includes('Archivo') && !slide.includes('Space Mono'));
});

test('brand data lands in both, and nothing is left as a template placeholder', () => {
  for (const html of [cardFrontHtml(D), slideHtml(D)]) {
    assert.ok(!/\{\{|\}\}|sc-if|sc-for|image-slot/.test(html), 'unresolved template syntax');
    assert.ok(html.includes('Acme &amp; Sons'), 'brand name escaped');
    for (const v of ['51', '65', '69', '66', '62']) assert.ok(html.includes(`>${v}<`), v);
    ['Credibility', 'Trust', 'Reputation', 'Authenticity'].forEach(l => assert.ok(html.includes(l)));
    assert.ok(html.includes('data:image/jpeg;base64,AAAA'), 'hero image');
  }
  assert.ok(cardFrontHtml(D).includes('Measured by the Conscious Compass Teaser Assessment'));
  assert.ok(slideHtml(D).includes('Indicative scores measured by the Conscious Compass Teaser Assessment'));
  assert.ok(cardBackHtml().includes('Consequential brands are'));
});

test('missing scores show as a dash rather than NaN or zero', () => {
  const html = slideHtml({ ...D, overall: null, baseline: undefined, credibility: 'x' });
  assert.ok(html.includes('>—<'));
  assert.ok(!/NaN|undefined|null/.test(html));
});

test('nothing loads from another origin, or the PDF canvas would be blocked', () => {
  const html = cardFrontHtml(D) + cardBackHtml() + slideHtml(D);
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

test('card PDF is two pages at 5.25 x 7.25in, the 5 x 7 trim plus bleed', async () => {
  const calls = [];
  const html2canvas = async (node) => { calls.push(node.style.width + ' x ' + node.style.height); return stubCanvas(); };
  global.document = new JSDOM('<!doctype html><body></body>').window.document;
  const { pdf, filename } = await exportScorecardPdf(D, { html2canvas, jsPDF, scale: 1, save: false });
  assert.equal(pdf.internal.getNumberOfPages(), 2);
  const size = pdf.internal.pageSize;
  assert.equal(Math.round(size.getWidth() * 1000) / 1000, TRIM.w + BLEED * 2);
  assert.equal(Math.round(size.getHeight() * 1000) / 1000, TRIM.h + BLEED * 2);
  assert.deepEqual(calls, ['5.25in x 7.25in', '5.25in x 7.25in']);
  assert.equal(filename, 'Acme-Sons-Compass-Card-5x7-bleed.pdf');
  delete global.document;
});

// ── Slide as PowerPoint ──

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
