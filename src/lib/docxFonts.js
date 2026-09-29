// Embed the report's fonts in a generated Word file (v3.102.0).
//
// Hanken Grotesk and Newsreader are not installed on most machines, so without
// them Word substitutes its defaults and the report stops looking like the
// template. The docx library can embed only a regular face per font, and the
// report also sets Hanken Grotesk in bold and Newsreader in italic, so the
// fonts are added here, after the library has written the file: each face as
// an obfuscated .odttf part, related from the font table, with the setting that
// tells Word to use embedded fonts. Obfuscation follows ECMA-376 (the first 32
// bytes XORed with the reversed GUID key), the same as the library's own.

export const REPORT_FONTS = [
  { name: 'Hanken Grotesk', family: 'swiss', faces: { Regular: '/report/HankenGrotesk-Regular.ttf', Bold: '/report/HankenGrotesk-Bold.ttf' } },
  { name: 'Newsreader', family: 'roman', faces: { Regular: '/report/Newsreader-Regular.ttf', Italic: '/report/Newsreader-Italic.ttf' } },
];

const FONT_REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/font';
const ODTTF = 'application/vnd.openxmlformats-officedocument.obfuscatedFont';

export function newFontKey(rand = Math.random) {
  const hex = () => Math.floor(rand() * 16).toString(16).toUpperCase();
  const part = (n) => Array.from({ length: n }, hex).join('');
  return `${part(8)}-${part(4)}-${part(4)}-${part(4)}-${part(12)}`;
}

export function obfuscateFont(bytes, fontKey) {
  const guid = fontKey.replace(/-/g, '');
  if (guid.length !== 32) throw new Error(`Bad font key: ${fontKey}`);
  const key = guid.match(/../g).map(h => parseInt(h, 16)).reverse();
  const out = new Uint8Array(bytes);
  for (let i = 0; i < 32 && i < out.length; i++) out[i] ^= key[i % 16];
  return out;
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

// Returns a new Blob with the fonts embedded. On any failure (a font file that
// will not load, an unexpected package) the original is returned, so the export
// never fails over fonts.
export async function embedReportFonts(blob, { JSZip, fetchImpl = fetch, fonts = REPORT_FONTS, keyFn = newFontKey } = {}) {
  try {
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    const loaded = await Promise.all(fonts.map(async (f) => ({
      ...f,
      files: await Promise.all(Object.entries(f.faces).map(async ([face, url]) => {
        const r = await fetchImpl(url);
        if (!r.ok) throw new Error(`${url}: ${r.status}`);
        return { face, bytes: new Uint8Array(await r.arrayBuffer()) };
      })),
    })));

    // font table: drop any entry the library wrote for these names, add ours
    const tablePath = 'word/fontTable.xml';
    let table = await zip.file(tablePath)?.async('string');
    if (!table) throw new Error('no font table');
    if (!/xmlns:r=/.test(table)) table = table.replace('<w:fonts ', '<w:fonts xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ');
    for (const f of loaded) table = table.replace(new RegExp(`<w:font w:name="${f.name}">[\\s\\S]*?</w:font>`, 'g'), '');
    const relsPath = 'word/_rels/fontTable.xml.rels';
    let rels = (await zip.file(relsPath)?.async('string')) ||
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>';
    // the library writes an empty relationships file as a self-closing tag
    rels = rels.replace(/<Relationships([^>]*)\/>/, '<Relationships$1></Relationships>');
    let n = 0;
    const entries = loaded.map((f) => {
      const embeds = f.files.map(({ face, bytes }) => {
        n += 1;
        const id = `rIdCcFont${n}`;
        const key = keyFn();
        const part = `fonts/cc-font-${n}.odttf`;
        zip.file(`word/${part}`, obfuscateFont(bytes, key));
        rels = rels.replace('</Relationships>', `<Relationship Id="${id}" Type="${FONT_REL}" Target="${part}"/></Relationships>`);
        return `<w:embed${face} r:id="${id}" w:fontKey="{${key}}"/>`;
      }).join('');
      return `<w:font w:name="${esc(f.name)}"><w:charset w:val="00"/><w:family w:val="${f.family}"/><w:pitch w:val="variable"/>${embeds}</w:font>`;
    }).join('');
    table = /<\/w:fonts>/.test(table) ? table.replace('</w:fonts>', `${entries}</w:fonts>`) : table.replace(/<w:fonts([^>]*)\/>/, `<w:fonts$1>${entries}</w:fonts>`);
    zip.file(tablePath, table);
    zip.file(relsPath, rels);

    // content type for the font parts
    let types = await zip.file('[Content_Types].xml').async('string');
    if (!/Extension="odttf"/.test(types)) types = types.replace('</Types>', `<Default Extension="odttf" ContentType="${ODTTF}"/></Types>`);
    zip.file('[Content_Types].xml', types);

    // tell Word to use them, and to show the page colour
    let settings = await zip.file('word/settings.xml').async('string');
    // Schema order: displayBackgroundShape comes before embedTrueTypeFonts, and
    // both come before everything the library writes (evenAndOddHeaders, compat).
    // The library may already have written displayBackgroundShape, so take both
    // out and put them back in order.
    settings = settings.replace(/<w:displayBackgroundShape\/>|<w:embedTrueTypeFonts\/>/g, '');
    settings = settings.replace(/(<w:settings[^>]*>)/, '$1<w:displayBackgroundShape/><w:embedTrueTypeFonts/>');
    zip.file('word/settings.xml', settings);

    const out = await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
    return new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
  } catch (e) {
    console.warn('Font embedding skipped:', e?.message || e);
    return blob;
  }
}
