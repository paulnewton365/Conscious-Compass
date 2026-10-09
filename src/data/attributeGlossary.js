// ─────────────────────────────────────────────────────────────
// THE ATTRIBUTES IN PLAIN WORDS (v4.1.0)
//
// One line per attribute for readers who have never seen the Compass: the
// public newsletter explains each attribute where it is named, and lists the
// ones an issue mentions. Used by the newsletter refresh (in its prompt) and
// by the newsletter page. No imports, so the API can load it too.
// ─────────────────────────────────────────────────────────────

export const ATTRIBUTE_GLOSSARY = [
  { id: 'AWAKE', name: 'Awake', plain: 'whether a brand leads the conversation in its industry rather than following it' },
  { id: 'AWARE', name: 'Aware', plain: 'how well a brand understands its audiences and earns their trust' },
  { id: 'REFLECTIVE', name: 'Reflective', plain: 'whether what a brand says about itself matches what it does' },
  { id: 'ATTENTIVE', name: 'Attentive', plain: 'the quality and consistency of every experience a brand offers, from its website to its service' },
  { id: 'COGENT', name: 'Cogent', plain: 'how smart and evidence-based its marketing is, including how easily people and AI search find it' },
  { id: 'SENTIENT', name: 'Sentient', plain: 'how much a brand moves people and stands out creatively' },
  { id: 'VISIONARY', name: 'Visionary', plain: 'whether a brand stands for a purpose beyond profit and points to a better future' },
  { id: 'INTENTIONAL', name: 'Intentional', plain: 'whether a brand has the credibility and presence to be taken seriously' },
];

// An attribute is named when it is capitalized (Sentient) or in capitals
// (SENTIENT); "aware" as an ordinary word is not a mention.
const mentionRe = (a) => new RegExp(`(^|[^A-Za-z])(${a.name}|${a.id})(?=$|[^A-Za-z])`);

// The attributes a text names, in the order it first names them.
export function attributesMentioned(...texts) {
  const t = texts.filter(Boolean).join('\n');
  return ATTRIBUTE_GLOSSARY
    .map(a => ({ ...a, at: t.search(mentionRe(a)) }))
    .filter(a => a.at >= 0)
    .sort((a, b) => a.at - b.at)
    .map(a => ({ id: a.id, name: a.name, plain: a.plain }));
}

// SENTIENT → Sentient, so the attributes read as names, not codes.
export function titleCaseAttributes(text) {
  let out = String(text ?? '');
  ATTRIBUTE_GLOSSARY.forEach(a => { out = out.replace(new RegExp(`(^|[^A-Za-z])${a.id}(?=$|[^A-Za-z])`, 'g'), `$1${a.name}`); });
  return out;
}

// The glossary as prompt lines.
export const glossaryForPrompt = () => ATTRIBUTE_GLOSSARY.map(a => `- ${a.name}: ${a.plain}`).join('\n');
