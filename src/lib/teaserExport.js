// ─────────────────────────────────────────────────────────────
// CAMPAIGN SCORES EXPORT (v3.30)
//
// Top-line teaser scores for every brand in one campaign, as a styled .xlsx.
// Written directly as SpreadsheetML inside a zip, so there is no spreadsheet
// library. JSZip is loaded on demand when a download is requested: the Word
// export library bundles its own private copy, so a static import here would
// add a second copy to every page load for a button only admins use.
//
// Built by whitelist from the stored result: no context, no evidence, no
// author and no campaign internals beyond its name. Scores are copied, never
// recalculated, so the file matches the app exactly.
// ─────────────────────────────────────────────────────────────

import { ATTRIBUTES } from '../data/rubric.js';
import { TEASER_VERSION, isCurrentMethod } from './teaser.js';

const LENSES = [['credibility', 'Credibility'], ['trust', 'Trust'], ['reputation', 'Reputation'], ['authenticity', 'Authenticity']];

export const EXPORT_COLUMNS = [
  { key: 'brand', label: 'Brand', width: 26 },
  { key: 'website', label: 'Website', width: 30 },
  { key: 'overall', label: 'Overall', width: 10, score: true },
  { key: 'stage', label: 'Stage', width: 17 },
  { key: 'sector', label: 'Sector', width: 22 },
  { key: 'baseline', label: 'Sector baseline', width: 11, score: true },
  { key: 'vsBaseline', label: 'Vs baseline', width: 10, signed: true },
  { key: 'baselineBrands', label: 'Brands in baseline', width: 11 },
  { key: 'baselineBasis', label: 'Baseline basis', width: 34 },
  ...LENSES.map(([key, label]) => ({ key, label, width: 13, score: true })),
  ...ATTRIBUTES.map(a => ({ key: a.id, label: a.name, width: 12, score: true })),
  { key: 'lowConfidence', label: 'Low-confidence attributes', width: 14 },
  { key: 'thinRecord', label: 'Limited evidence', width: 11 },
  { key: 'headline', label: 'Headline', width: 60, wrap: true },
  { key: 'scored', label: 'Scored', width: 14 },
  { key: 'method', label: 'Scoring method', width: 22 },
];

// Baseline columns for one teaser, from a teaserSectorBaseline() result.
// Absent or unavailable baselines leave the columns blank and say why.
function baselineCells(b, overall) {
  if (!b) return { sector: '', baseline: null, vsBaseline: null, baselineBrands: null, baselineBasis: '' };
  if (!b.available) return { sector: '', baseline: null, vsBaseline: null, baselineBrands: null, baselineBasis: 'Unavailable: no comparable full assessments' };
  return {
    sector: b.sectorName,
    baseline: b.avgScore,
    vsBaseline: overall === null ? null : overall - b.avgScore,
    baselineBrands: b.count,
    baselineBasis: b.basis,
  };
}

// One row per teaser. Scored brands first, highest overall first; unscored
// brands follow alphabetically so the list is complete. `baselines` maps a
// teaser id to its sector baseline, calculated at export time.
export function buildCampaignRows(teasers, baselines = {}) {
  const rows = (teasers || []).map(t => {
    const r = t.result;
    if (!r) {
      return { brand: t.brand_name, website: t.website_url, overall: null, stage: 'Not scored', scoredAt: null,
        ...baselineCells(baselines[t.id], null),
        ...Object.fromEntries(LENSES.map(([k]) => [k, null])), ...Object.fromEntries(ATTRIBUTES.map(a => [a.id, null])),
        lowConfidence: null, thinRecord: '', headline: '', scored: '', method: '' };
    }
    return {
      brand: t.brand_name,
      website: t.website_url,
      overall: r.overall,
      stage: r.stage || '',
      ...baselineCells(baselines[t.id], r.overall),
      ...Object.fromEntries(LENSES.map(([k]) => [k, r.lensScores?.[k] ?? null])),
      ...Object.fromEntries(ATTRIBUTES.map(a => [a.id, r.scores?.[a.id]?.score ?? null])),
      lowConfidence: r.lowConfidenceCount ?? null,
      thinRecord: r.thinRecord ? 'Yes' : 'No',
      headline: r.scores?.headline || '',
      scored: r.scoredAt ? new Date(r.scoredAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '',
      scoredAt: r.scoredAt || null,
      method: isCurrentMethod(r) ? `Calibrated v${TEASER_VERSION}` : `Earlier v${r.teaserVersion || '1.0'}, rescore`,
    };
  });
  const scored = rows.filter(r => r.overall !== null).sort((a, b) => b.overall - a.overall || a.brand.localeCompare(b.brand));
  const unscored = rows.filter(r => r.overall === null).sort((a, b) => a.brand.localeCompare(b.brand));
  return [...scored, ...unscored];
}

export function campaignSummary(rows) {
  const scored = rows.filter(r => r.overall !== null);
  const avg = scored.length ? Math.round(scored.reduce((t, r) => t + r.overall, 0) / scored.length) : null;
  const outdated = scored.filter(r => r.method && !r.method.startsWith('Calibrated')).length;
  return { brands: rows.length, scored: scored.length, averageOverall: avg, outdated };
}

// ── SpreadsheetML ─────────────────────────────────────────────

// Control characters are illegal in XML 1.0 and make Excel refuse the file,
// so strip them before escaping.
const esc = (v) => String(v ?? '')
  // eslint-disable-next-line no-control-regex
  .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const colName = (i) => { let n = i + 1, s = ''; while (n) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; };

// Style indexes into cellXfs below.
const S = { title: 1, sub: 2, header: 3, text: 4, green: 5, orange: 6, red: 7, wrap: 8, muted: 9, empty: 10, signed: 11 };

// Same bands as the app: green 70+, orange 45 to 69, red under 45.
export const bandStyle = (n) => (n === null || n === undefined ? S.empty : n >= 70 ? S.green : n >= 45 ? S.orange : S.red);

const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="1"><numFmt numFmtId="164" formatCode="+0;-0;0"/></numFmts>
<fonts count="7">
<font><sz val="10"/><name val="Arial"/></font>
<font><b/><sz val="16"/><color rgb="FF0B0B0B"/><name val="Arial"/></font>
<font><sz val="10"/><color rgb="FF68655B"/><name val="Arial"/></font>
<font><b/><sz val="10"/><color rgb="FFFFFFFF"/><name val="Arial"/></font>
<font><b/><sz val="10"/><color rgb="FF0F7A4F"/><name val="Arial"/></font>
<font><b/><sz val="10"/><color rgb="FFC2680C"/><name val="Arial"/></font>
<font><b/><sz val="10"/><color rgb="FFD42528"/><name val="Arial"/></font>
</fonts>
<fills count="7">
<fill><patternFill patternType="none"/></fill>
<fill><patternFill patternType="gray125"/></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FF0B0B0B"/><bgColor indexed="64"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFDCEFE5"/><bgColor indexed="64"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFF8E6D2"/><bgColor indexed="64"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFF9DADA"/><bgColor indexed="64"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFF2F0EA"/><bgColor indexed="64"/></patternFill></fill>
</fills>
<borders count="2">
<border><left/><right/><top/><bottom/><diagonal/></border>
<border><left/><right/><top/><bottom style="thin"><color rgb="FFDCDAD3"/></bottom><diagonal/></border>
</borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="12">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="0" fontId="3" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>
<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment vertical="top"/></xf>
<xf numFmtId="0" fontId="4" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="top"/></xf>
<xf numFmtId="0" fontId="5" fillId="4" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="top"/></xf>
<xf numFmtId="0" fontId="6" fillId="5" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="top"/></xf>
<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
<xf numFmtId="0" fontId="2" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment vertical="top"/></xf>
<xf numFmtId="0" fontId="2" fillId="6" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="top"/></xf>
<xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="top"/></xf>
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;

const cell = (ref, value, style) => {
  if (value === null || value === undefined || value === '') return `<c r="${ref}" s="${style}"/>`;
  if (typeof value === 'number' && Number.isFinite(value)) return `<c r="${ref}" s="${style}"><v>${value}</v></c>`;
  return `<c r="${ref}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${esc(value)}</t></is></c>`;
};

function scoresSheet(campaignName, rows, exportedAt) {
  const sum = campaignSummary(rows);
  const date = exportedAt.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const HEADER_ROW = 4;
  const lastCol = colName(EXPORT_COLUMNS.length - 1);
  const xml = [];
  xml.push(`<row r="1" ht="24" customHeight="1">${cell('A1', `${campaignName}: teaser scores`, S.title)}</row>`);
  xml.push(`<row r="2">${cell('A2', `Exported ${date}. ${sum.brands} brand${sum.brands === 1 ? '' : 's'}, ${sum.scored} scored${sum.averageOverall !== null ? `, average overall ${sum.averageOverall}` : ''}. Sector baselines calculated from full assessments on this date.${sum.outdated ? ` ${sum.outdated} brand${sum.outdated === 1 ? ' was' : 's were'} scored with the earlier method; rescore before comparing.` : ''} Indicative reads; see Notes.`, S.sub)}</row>`);
  xml.push(`<row r="${HEADER_ROW}" ht="42" customHeight="1">${EXPORT_COLUMNS.map((c, i) => cell(`${colName(i)}${HEADER_ROW}`, c.label, S.header)).join('')}</row>`);
  rows.forEach((row, ri) => {
    const r = HEADER_ROW + 1 + ri;
    const cells = EXPORT_COLUMNS.map((c, ci) => {
      const ref = `${colName(ci)}${r}`;
      const v = row[c.key];
      if (c.score) return cell(ref, v, bandStyle(v));
      if (c.signed) return cell(ref, v, S.signed);
      if (c.key === 'stage' && row.overall === null) return cell(ref, v, S.muted);
      return cell(ref, v, c.wrap ? S.wrap : S.text);
    });
    xml.push(`<row r="${r}">${cells.join('')}</row>`);
  });
  const lastRow = HEADER_ROW + Math.max(rows.length, 1);
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>
<sheetViews><sheetView workbookViewId="0" showGridLines="0"><pane xSplit="1" ySplit="${HEADER_ROW}" topLeftCell="B${HEADER_ROW + 1}" activePane="bottomRight" state="frozen"/></sheetView></sheetViews>
<sheetFormatPr defaultRowHeight="15"/>
<cols>${EXPORT_COLUMNS.map((c, i) => `<col min="${i + 1}" max="${i + 1}" width="${c.width}" customWidth="1"/>`).join('')}</cols>
<sheetData>${xml.join('')}</sheetData>
${rows.length ? `<autoFilter ref="A${HEADER_ROW}:${lastCol}${lastRow}"/>` : ''}
<pageSetup orientation="landscape" fitToWidth="1" fitToHeight="0"/>
</worksheet>`;
}

const NOTES = [
  'About these scores',
  'Each row is an indicative Conscious Compass read, built from publicly observable evidence gathered in a single automated pass: website, social, AI perception, review and search signals, and earned media.',
  'Scores use the same rubric and the same calculations as the full Conscious Compass assessment. The full assessment goes much deeper and can move these numbers.',
  'Overall is the average of the eight attribute scores. Credibility, Trust, Reputation and Authenticity are fixed weightings of the attribute scores, not separate judgments.',
  'Sector baseline is the average overall score of full Conscious Compass assessments in the brand\'s sector, recalculated on the export date so every row uses the same figures. The brand\'s own full assessment, if it has one, is never counted in its baseline. Only assessments on the current framework are included.',
  'Where a sector has fewer than 5 full assessments, the baseline falls back to the average across all assessed brands, and Baseline basis says so. Vs baseline is the brand\'s overall minus the baseline.',
  'Teaser scores are indicative and baselines come from full assessments, so read Vs baseline as a directional signal, not a like-for-like ranking.',
  'Colour bands: green 70 and above, orange 45 to 69, red below 45.',
  'Scores are calibrated to the evidence a quick read can reach. Each attribute is judged on the signals the teaser could observe; signals it could not see count neither for nor against. Nothing is added to scores after the fact, and there is no campaign modifier.',
  'Low-confidence attributes counts scores resting on thin evidence. Limited evidence is flagged when three or more attributes are low confidence.',
  'Scoring method shows which version scored each brand. Brands marked Earlier were scored before calibration; rescore them before comparing rows.',
  'Not scored means evidence was gathered but the teaser has not been scored yet.',
];

function notesSheet() {
  const rows = NOTES.map((t, i) => `<row r="${i * 2 + 1}">${cell(`A${i * 2 + 1}`, t, i === 0 ? S.title : S.wrap)}</row>`).join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<sheetViews><sheetView workbookViewId="0" showGridLines="0"/></sheetViews>
<cols><col min="1" max="1" width="110" customWidth="1"/></cols>
<sheetData>${rows}</sheetData>
</worksheet>`;
}

// Excel sheet names: max 31 chars, none of []:*?/\
export const sheetName = (s) => (String(s || 'Scores').replace(/[[\]:*?/\\]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 31) || 'Scores');

export const exportFilename = (campaignName, date = new Date()) => {
  const safe = String(campaignName || 'Campaign').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'Campaign';
  return `${safe}-Teaser-Scores-${date.toISOString().slice(0, 10)}.xlsx`;
};

// Resolves to a JSZip instance; the caller chooses blob (browser) or buffer (tests).
export async function buildCampaignWorkbook(campaignName, teasers, exportedAt = new Date(), baselines = {}) {
  const { default: JSZip } = await import('jszip');
  const rows = buildCampaignRows(teasers, baselines);
  const zip = new JSZip();
  zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
<Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`);
  zip.file('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`);
  zip.file('xl/workbook.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets><sheet name="${esc(sheetName(campaignName))}" sheetId="1" r:id="rId1"/><sheet name="Notes" sheetId="2" r:id="rId2"/></sheets>
${rows.length ? `<definedNames><definedName name="_xlnm._FilterDatabase" localSheetId="0" hidden="1">'${esc(sheetName(campaignName)).replace(/'/g, "''")}'!$A$4:$${colName(EXPORT_COLUMNS.length - 1)}$${4 + rows.length}</definedName></definedNames>` : ''}
</workbook>`);
  zip.file('xl/_rels/workbook.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/>
<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`);
  zip.file('xl/styles.xml', STYLES);
  zip.file('xl/worksheets/sheet1.xml', scoresSheet(campaignName, rows, exportedAt));
  zip.file('xl/worksheets/sheet2.xml', notesSheet());
  return { zip, rows, filename: exportFilename(campaignName, exportedAt) };
}
