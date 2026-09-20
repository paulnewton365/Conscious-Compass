// ─────────────────────────────────────────────────────────────
// SUSTAINABILITY NARRATIVE THESIS (framework 2.10)
//
// Antenna Group's point of view, turned into six tenets the Compass can test
// against public evidence. One source for the teaser and the full assessment:
// the tenets, the rating scales, the prompt text, the parser and the verdict.
//
// The read sits alongside the eight attribute scores and never changes them.
// Its thesis signals are also written into the rubric (see rubric.js), which
// is where they move scores.
// ─────────────────────────────────────────────────────────────

export const THESIS_NAME = 'Sustainability narrative';

export const THESIS_STATEMENT = `Sustainability is getting buried. People still care, but the narrative has gone numb: the word now signals obligation, complexity, and compromise, and the most future-defining force in business has been flattened into corporate wallpaper. Kept outside the brand, in the separately housed ESG report, the vanity URL, and the Earth Day post, it turns performative, built to protect when it needs to inspire. Consumers reject that empty, personality-free version of it. Sustainability is the engine of progress, not the brake. It breaks through when it stops being framed as a sacrifice, a scold, or a side note and starts sharpening what a brand stands for and strengthening what it creates. That means tying it to identity, so people see themselves in the future being built and want to choose it. It also means showing the scars alongside the vision. Audiences have finely tuned BS detectors, and trust is earned through consistent truth at every touchpoint, including where progress is hardest and what is still unknown. Impact leaders have set the targets, built the programs, and made real progress. The job now is to stop whispering and make that progress matter to the customers, partners, and markets they are trying to move.`;

export const THESIS_TENETS = [
  { id: 'inside', name: 'Inside the brand, not beside it',
    test: 'Is sustainability part of the brand story (homepage, product, campaigns), or housed apart in an ESG report, a vanity URL or calendar-moment posts?' },
  { id: 'engine', name: 'Engine, not brake',
    test: 'Is it framed as progress, advantage and innovation, or as sacrifice, compliance, obligation or a scold?' },
  { id: 'identity', name: 'Tied to identity',
    test: 'Does it sharpen what the brand stands for and makes, so customers see themselves in the future being built?' },
  { id: 'personality', name: 'Personality, not wallpaper',
    test: 'Is it told with a distinctive voice and creative, or with the generic leaves, globes and "our journey" language any peer could use?' },
  { id: 'scars', name: 'Scars alongside the vision',
    test: 'Does it show candour about missed targets, the hardest areas, trade-offs and open questions, and tell the same truth in reporting and in marketing?' },
  { id: 'voice', name: 'Stop whispering',
    test: 'Is real progress made to matter to customers, partners and markets, or left in reports where only investors and regulators look?' },
];

export const THESIS_LEVELS = [
  { id: 'buried', label: 'Buried' },
  { id: 'surfacing', label: 'Surfacing' },
  { id: 'breaking', label: 'Breaking through' },
];

export const PROGRESS_LEVELS = ['limited', 'moderate', 'strong'];
export const VOICE_LEVELS = ['quiet', 'audible', 'loud'];

// Progress against voice, decided in code from the two ratings so the verdict
// is consistent across every brand. Rows: progress. Columns: voice.
const VERDICTS = {
  strong:   { quiet: ['Whispering', 'Real progress, told too quietly to move anyone.'],
              audible: ['Getting heard', 'Real progress, starting to reach the people it should move.'],
              loud: ['Breaking through', 'Real progress, told with the confidence it has earned.'] },
  moderate: { quiet: ['Quiet progress', 'Progress under way and largely untold.'],
              audible: ['In step', 'What is said matches what has been done.'],
              loud: ['Running ahead', 'The story is louder than the progress behind it.'] },
  limited:  { quiet: ['Early', 'Little progress in evidence and little said about it.'],
              audible: ['Running ahead', 'The story is louder than the progress behind it.'],
              loud: ['Overclaiming', 'Loud claims with little visible progress behind them. A trust risk.'] },
};

export function progressVoiceVerdict(progress, voice) {
  const v = VERDICTS[progress]?.[voice];
  return v ? { label: v[0], meaning: v[1] } : null;
}

// Prompt text shared by both scoring passes. `calibrated` adds the teaser's
// rule that unreachable evidence counts neither for nor against.
export function thesisPromptBlock({ calibrated = false } = {}) {
  return `SUSTAINABILITY NARRATIVE. Antenna Group's thesis, which this read tests:
"${THESIS_STATEMENT}"

Rate each tenet from the evidence, as "buried", "surfacing" or "breaking" (breaking through):
${THESIS_TENETS.map(t => `- ${t.id}: ${t.name}. ${t.test}`).join('\n')}

Then rate two things separately:
- "progress": how much real sustainability progress is evidenced (targets set, programs running, reported results, third-party verification): limited, moderate or strong.
- "voice": how loudly and widely that progress is told to customers, partners and markets (brand channels, earned media, leadership voice): quiet, audible or loud.

Rules for this read:
- Ground every rating in something observed. Name the source in the reason.
- If no sustainability narrative is observable at all, set "present" to false, leave the tenets out, and say so plainly in "summary". That is a finding, not an error.
- This read sits beside the eight attribute scores. It never changes them, and the attribute scores never set it.${calibrated ? '\n- The calibration rules above apply: evidence this pass could not reach counts neither for nor against a tenet.' : ''}`;
}

export const THESIS_SCHEMA = `"sustainabilityNarrative": {
    "present": true,
    "summary": "Two sentences on how sustainability shows up in this brand, against the thesis.",
    "progress": "limited|moderate|strong",
    "voice": "quiet|audible|loud",
    "tenets": {
${THESIS_TENETS.map(t => `      "${t.id}": { "level": "buried|surfacing|breaking", "reason": "Under 25 words, naming the evidence." }`).join(',\n')}
    }
  }`;

const clean = (v, n) => String(v || '').trim().slice(0, n);

// Normalises what the model returned. Anything malformed is dropped rather
// than guessed: an unrated tenet stays unrated. Returns null when the read is
// missing entirely, so the report can offer to regenerate.
export function parseThesis(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const present = raw.present !== false;
  const out = { present, summary: clean(raw.summary, 600), tenets: {}, progress: null, voice: null, verdict: null };
  if (!present) return out;
  for (const t of THESIS_TENETS) {
    const e = raw.tenets?.[t.id];
    const level = THESIS_LEVELS.some(l => l.id === e?.level) ? e.level : null;
    out.tenets[t.id] = level ? { level, reason: clean(e.reason, 240) } : null;
  }
  out.progress = PROGRESS_LEVELS.includes(raw.progress) ? raw.progress : null;
  out.voice = VOICE_LEVELS.includes(raw.voice) ? raw.voice : null;
  out.verdict = progressVoiceVerdict(out.progress, out.voice);
  return out;
}

export const levelLabel = (id) => THESIS_LEVELS.find(l => l.id === id)?.label || 'Not rated';

// Plain rows for text outputs (PDF, Word, export), so every format says the
// same thing in the same order.
export function thesisTextRows(thesis) {
  if (!thesis) return null;
  if (!thesis.present) return { summary: thesis.summary || 'No sustainability narrative observable.', verdict: null, tenets: [] };
  return {
    summary: thesis.summary,
    verdict: thesis.verdict ? `${thesis.verdict.label}: ${thesis.verdict.meaning} (progress ${thesis.progress}, voice ${thesis.voice})` : null,
    tenets: THESIS_TENETS.map(t => ({ name: t.name, level: levelLabel(thesis.tenets?.[t.id]?.level), reason: thesis.tenets?.[t.id]?.reason || '' })),
  };
}
