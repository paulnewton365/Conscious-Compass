// ─────────────────────────────────────────────────────────────
// SCORING CONSENSUS (framework 2.12, v3.112.0)
//
// Language models are not perfectly repeatable even at temperature 0, so a
// brand scored twice can land a few points apart. The scoring pass now runs
// SCORING_RUNS times in parallel on the same evidence and combines them here:
//   - each attribute takes the median of the runs' scores
//   - ordinal judgments take the median too: the campaign coherence level,
//     each footprint channel level, each sustainability principle level
//   - the earned creative lift needs a majority: more than half the runs
//     must find at least one activation
//   - written findings come from the representative run, the one whose
//     scores sit closest to the medians, so the text matches the numbers
// The spread between runs is kept as a consistency measure; an attribute
// whose runs disagree by more than SPREAD_FLAG points is flagged for review.
// All arithmetic is in code; the model never combines its own runs.
// ─────────────────────────────────────────────────────────────

export const SCORING_RUNS = 3;
export const SPREAD_FLAG = 10;
// Early finish (v3.113.0): when the first two passes back agree within this
// many points on every attribute, and on the campaign coherence level and the
// earned creative call, the third is not waited for.
export const EARLY_AGREE = 3;
export const ATTRIBUTE_IDS = ['AWAKE', 'AWARE', 'REFLECTIVE', 'ATTENTIVE', 'COGENT', 'SENTIENT', 'VISIONARY', 'INTENTIONAL'];

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : Number.isFinite(Number(v)) && v !== null && v !== '' ? Number(v) : null);

export function median(values) {
  const v = values.map(num).filter(x => x !== null).sort((a, b) => a - b);
  if (!v.length) return null;
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : Math.round((v[m - 1] + v[m]) / 2);
}

// One run's raw text to its JSON, or null if it has no attribute scores.
export function parseScoringRun(text) {
  if (typeof text !== 'string') return null;
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[0]);
    return ATTRIBUTE_IDS.some(id => typeof parsed?.[id]?.score === 'number') ? parsed : null;
  } catch {
    return null;
  }
}

const TENET_ORDER = ['buried', 'surfacing', 'breaking'];

export function combineRuns(runs) {
  const valid = (runs || []).filter(Boolean);
  if (!valid.length) return null;

  const medians = Object.fromEntries(ATTRIBUTE_IDS.map(id => [id, median(valid.map(r => r?.[id]?.score))]));
  // The representative run: closest to the medians overall.
  const distance = (r) => ATTRIBUTE_IDS.reduce((d, id) => d + (medians[id] === null || num(r?.[id]?.score) === null ? 0 : Math.abs(num(r[id].score) - medians[id])), 0);
  const rep = [...valid].sort((a, b) => distance(a) - distance(b))[0];
  const combined = JSON.parse(JSON.stringify(rep));

  const spread = {};
  ATTRIBUTE_IDS.forEach(id => {
    const scores = valid.map(r => num(r?.[id]?.score)).filter(x => x !== null);
    if (!scores.length || !combined[id]) return;
    combined[id].score = medians[id];
    combined[id].runScores = scores;
    spread[id] = Math.max(...scores) - Math.min(...scores);
  });

  // Campaign coherence level: the median level.
  const levels = valid.map(r => num(r?.campaignCoherence?.level)).filter(x => x !== null);
  if (levels.length && combined.campaignCoherence) combined.campaignCoherence.level = median(levels);

  // Footprint: the median level per channel.
  if (combined.footprint?.channels) {
    Object.keys(combined.footprint.channels).forEach(ch => {
      const m = median(valid.map(r => r?.footprint?.channels?.[ch]?.level));
      if (m !== null) combined.footprint.channels[ch] = { ...combined.footprint.channels[ch], level: m };
    });
  }

  // Sustainability principles: the median level per principle.
  const tenets = combined.sustainabilityNarrative?.tenets;
  if (tenets && typeof tenets === 'object') {
    Object.keys(tenets).forEach(t => {
      const idx = valid.map(r => TENET_ORDER.indexOf(r?.sustainabilityNarrative?.tenets?.[t]?.level)).filter(i => i >= 0);
      const m = median(idx);
      if (m !== null && tenets[t]) tenets[t] = { ...tenets[t], level: TENET_ORDER[m] };
    });
  }

  // Earned creative lift: a majority of runs must find an activation.
  const found = valid.filter(r => Array.isArray(r?.earnedCreative?.activations) && r.earnedCreative.activations.length > 0);
  const majority = found.length * 2 > valid.length;
  if (majority) {
    const list = rep?.earnedCreative?.activations?.length ? rep.earnedCreative.activations : found[0].earnedCreative.activations;
    combined.earnedCreative = { ...(combined.earnedCreative || {}), activations: list };
  } else {
    combined.earnedCreative = { ...(combined.earnedCreative || {}), activations: [] };
  }

  combined.consensus = {
    method: `median of ${valid.length}`,
    runs: valid.length,
    requested: (runs || []).length,
    spread,
    flagged: ATTRIBUTE_IDS.filter(id => (spread[id] ?? 0) > SPREAD_FLAG),
    activationVotes: `${found.length} of ${valid.length}`,
  };
  return combined;
}

// Two runs agree when every attribute is within EARLY_AGREE points and the
// discrete calls that move scores (campaign coherence level, whether earned
// creative was found) are the same.
export function runsAgree(a, b) {
  if (!a || !b) return false;
  const scoresClose = ATTRIBUTE_IDS.every(id => {
    const x = num(a?.[id]?.score), y = num(b?.[id]?.score);
    return x !== null && y !== null && Math.abs(x - y) <= EARLY_AGREE;
  });
  const level = (r) => num(r?.campaignCoherence?.level);
  const found = (r) => Array.isArray(r?.earnedCreative?.activations) && r.earnedCreative.activations.length > 0;
  return scoresClose && level(a) === level(b) && found(a) === found(b);
}

// Starts every pass at once and collects them as they finish. Each starter
// returns a promise of { text, usage }. With earlyFinish, once the first two
// readable passes agree the rest are not waited for (they are marked
// skipped). Otherwise, or when they disagree, every pass is waited for.
// Records each pass's time and output length, so speed is measured, not guessed.
export function gatherRuns(starters, { earlyFinish = true, now = () => Date.now() } = {}) {
  const t0 = now();
  const runs = starters.map(() => null);
  const timings = starters.map(() => ({ status: 'pending', ms: null, outputTokens: null }));
  const errors = [];
  let pending = starters.length;
  let done = false;
  return new Promise(resolve => {
    const finish = (early) => {
      if (done) return;
      done = true;
      timings.forEach(t => { if (t.status === 'pending') t.status = 'skipped'; });
      resolve({ runs: [...runs], timings: timings.map(t => ({ ...t })), early, errors, wallMs: now() - t0 });
    };
    if (!starters.length) return finish(false);
    starters.forEach((start, i) => {
      Promise.resolve()
        .then(start)
        .then(({ text, usage } = {}) => {
          if (done) return;
          runs[i] = parseScoringRun(text);
          timings[i] = { status: runs[i] ? 'used' : 'unreadable', ms: now() - t0, outputTokens: num(usage?.output_tokens) };
        }, (err) => {
          if (done) return;
          errors.push(err);
          timings[i] = { status: 'failed', ms: now() - t0, outputTokens: null };
        })
        .then(() => {
          if (done) return;
          pending -= 1;
          const valid = runs.filter(Boolean);
          if (earlyFinish && pending > 0 && valid.length === 2 && runsAgree(valid[0], valid[1])) return finish(true);
          if (pending === 0) finish(false);
        });
    });
  });
}

// Plain-text timing line for the admin views, e.g.
// "Finished in 74s. Passes: 71s (5,820 tokens out), 74s (6,010 tokens out), skipped."
const secs = (ms) => `${Math.round(ms / 1000)}s`;
export function timingSummary(timing) {
  if (!timing || !Array.isArray(timing.passes) || !timing.passes.length) return '';
  const pass = (p) => {
    if (p.status === 'skipped') return 'skipped';
    if (p.status === 'failed') return `failed at ${secs(p.ms)}`;
    const out = p.outputTokens != null ? ` (${p.outputTokens.toLocaleString('en-US')} tokens out)` : '';
    return `${secs(p.ms)}${out}${p.status === 'unreadable' ? ' unreadable' : ''}`;
  };
  const head = `Finished in ${secs(timing.wallMs)}${timing.early ? `, early: the first two passes agreed within ${EARLY_AGREE} points` : ''}.`;
  return `${head} Passes: ${timing.passes.map(pass).join(', ')}.`;
}

// For the consistency check: per attribute min, median, max and spread across
// several runs, plus the overall score and the discrete judgments.
export function consistencyStats(runs) {
  const valid = (runs || []).filter(Boolean);
  const rows = ATTRIBUTE_IDS.map(id => {
    const s = valid.map(r => num(r?.[id]?.score)).filter(x => x !== null);
    return { id, scores: s, min: s.length ? Math.min(...s) : null, median: median(s), max: s.length ? Math.max(...s) : null, spread: s.length ? Math.max(...s) - Math.min(...s) : null };
  });
  const overalls = valid.map(r => Math.round(ATTRIBUTE_IDS.reduce((t, id) => t + (num(r?.[id]?.score) || 0), 0) / ATTRIBUTE_IDS.length));
  return {
    runs: valid.length,
    rows,
    overall: { scores: overalls, min: overalls.length ? Math.min(...overalls) : null, median: median(overalls), max: overalls.length ? Math.max(...overalls) : null },
    campaignLevels: valid.map(r => num(r?.campaignCoherence?.level)),
    activationRuns: valid.filter(r => (r?.earnedCreative?.activations || []).length > 0).length,
    widest: rows.filter(r => r.spread !== null).sort((a, b) => b.spread - a.spread)[0] || null,
  };
}

// ─────────────────────────────────────────────────────────────
// LIVE PROGRESS (v3.114.0)
//
// The scoring passes now stream: the model's answer arrives as it is written,
// so progress is read from the text itself rather than guessed from a clock.
// The model writes the report in a fixed order (the schema order), so the
// section it is on is a real stage, and an attribute counts as scored the
// moment its score has been written. Scores shown on the waiting screen are
// never the numbers: only which attributes each pass has reached.
// ─────────────────────────────────────────────────────────────

// Reads Anthropic's server-sent events. feed() takes text chunks as they
// arrive; onText gets the full answer so far after each piece.
export function createStreamParser(onText = () => {}) {
  let buffer = '';
  let text = '';
  let stopReason = null;
  let usage = null;
  let error = null;
  const handle = (block) => {
    const data = block.split('\n').filter(l => l.startsWith('data:')).map(l => l.slice(5).trim()).join('');
    if (!data) return;
    let evt;
    try { evt = JSON.parse(data); } catch { return; }
    if (evt.type === 'content_block_delta' && evt.delta?.type === 'text_delta') {
      text += evt.delta.text || '';
      onText(text);
    } else if (evt.type === 'message_start') {
      usage = { ...(evt.message?.usage || {}) };
    } else if (evt.type === 'message_delta') {
      stopReason = evt.delta?.stop_reason ?? stopReason;
      usage = { ...(usage || {}), ...(evt.usage || {}) };
    } else if (evt.type === 'error') {
      error = evt.error?.message || 'The scoring stream failed.';
    }
  };
  return {
    feed(chunk) {
      buffer += String(chunk || '').replace(/\r\n/g, '\n');
      let at;
      while ((at = buffer.indexOf('\n\n')) >= 0) {
        handle(buffer.slice(0, at));
        buffer = buffer.slice(at + 2);
      }
    },
    result() {
      if (buffer.trim()) { handle(buffer); buffer = ''; }
      return { text, stopReason, usage, error };
    },
  };
}

// The report's sections in the order the schema asks for them, with each
// one's typical share of the answer (the attributes are about half).
export const SCORING_SECTIONS = [
  { key: 'headline', group: 'trust', weight: 0.01 },
  { key: 'conclusion', group: 'trust', weight: 0.02 },
  { key: 'justification', group: 'trust', weight: 0.04 },
  { key: 'trustFindings', group: 'trust', weight: 0.06 },
  { key: 'sustainabilityNarrative', group: 'principles', weight: 0.07 },
  { key: 'footprint', group: 'footprint', weight: 0.08 },
  { key: 'earnedCreative', group: 'coherence', weight: 0.03 },
  { key: 'campaignCoherence', group: 'coherence', weight: 0.11 },
  ...ATTRIBUTE_IDS.map(id => ({ key: id, group: 'attributes', weight: 0.064 })),
  // Written last, once the attributes are scored (v3.115.0).
  { key: 'earnedCreativeOpportunity', group: 'earned', weight: 0.08 },
];

// The rows of the waiting screen's stage list (packet 18 layout), now real.
export const SCORING_STAGES = [
  { id: 'trust', name: 'Trust lens', detail: 'Credibility, trust, reputation and authenticity', doing: 'Checking trust and credibility' },
  { id: 'principles', name: 'Six principles', detail: 'How sustainability shows up, against the thesis', doing: 'Reading the six principles' },
  { id: 'footprint', name: 'Footprint', detail: 'Where the brand shows up, and where it does not', doing: 'Mapping the footprint' },
  { id: 'coherence', name: 'Campaign coherence', detail: 'Campaigns and earned activations found across channels', doing: 'Judging campaign coherence' },
  { id: 'attributes', name: 'Eight attributes', detail: 'Score, findings and actions for each', doing: 'Scoring the attributes' },
  { id: 'earned', name: 'Earned creative', detail: 'How earned creative could help this brand', doing: 'Finding where earned creative would help' },
];

// Characters in a typical full answer: only used to pace the bar within the
// section the model is writing. Section boundaries are read, not estimated.
export const EXPECTED_CHARS = 21000;

const keyAt = (text, key) => {
  const m = new RegExp(`"${key}"\\s*:`).exec(text);
  return m ? m.index : -1;
};

// One pass's progress from its answer so far.
export function readPassProgress(text = '') {
  const t = String(text || '');
  const found = SCORING_SECTIONS.map(s => ({ ...s, at: keyAt(t, s.key) })).filter(s => s.at >= 0).sort((a, b) => a.at - b.at);
  const scored = ATTRIBUTE_IDS.filter(id => new RegExp(`"${id}"\\s*:\\s*\\{\\s*"score"\\s*:\\s*\\d`).test(t));
  if (!found.length) return { progress: 0, section: null, group: null, scored, doneGroups: [] };
  const current = found[found.length - 1];
  const before = found.slice(0, -1).reduce((sum, s) => sum + s.weight, 0);
  const within = Math.min(current.weight * 0.9, (t.length - current.at) / EXPECTED_CHARS);
  const progress = Math.min(0.98, before + within);
  // A stage is done once the model has moved past it, including one it skipped.
  const order = SCORING_STAGES.map(g => g.id);
  const at = order.indexOf(current.group);
  const doneGroups = order.filter((g, i) => g !== current.group && (i < at || found.some(s => s.group === g)));
  return { progress, section: current.key, group: current.group, scored, doneGroups };
}

// The pass that sets the pace: until two passes are done the screen waits on
// the second fastest (two that agree finish the job); after that, on the last
// one still running. Failed passes are ignored.
export function pacingIndex(passes = []) {
  const live = passes.map((p, i) => ({ ...p, i })).filter(p => p.status !== 'failed' && p.status !== 'skipped');
  if (!live.length) return -1;
  const done = live.filter(p => p.status === 'done').length;
  const ranked = [...live].sort((a, b) => (b.status === 'done' ? 1 : b.progress || 0) - (a.status === 'done' ? 1 : a.progress || 0));
  return done < 2 ? ranked[Math.min(1, ranked.length - 1)].i : ranked[ranked.length - 1].i;
}

export function overallProgress(passes = []) {
  const i = pacingIndex(passes);
  if (i < 0) return 0;
  const p = passes[i];
  return p.status === 'done' ? 1 : Math.min(0.98, p.progress || 0);
}

// Each stage's state for the list: done, current or waiting, from the pace pass.
export function stageStates(passes = []) {
  const i = pacingIndex(passes);
  const p = i >= 0 ? passes[i] : null;
  return SCORING_STAGES.map(s => {
    if (p?.status === 'done' || p?.doneGroups?.includes(s.id)) return { ...s, state: 'done' };
    if (p?.group === s.id) return { ...s, state: 'current' };
    return { ...s, state: 'waiting' };
  });
}

// How the passes ended, in a sentence, once they have.
export function outcomeLine({ early, timings = [] } = {}) {
  const used = timings.filter(t => t.status === 'used').length;
  const failed = timings.filter(t => t.status === 'failed' || t.status === 'unreadable').length;
  if (early) return `The first two passes agreed within ${EARLY_AGREE} points, so the third was not needed.`;
  if (used >= 3) return 'The passes differed, so the Compass kept the middle score of the three.';
  if (used === 2 && failed) return 'One pass did not return. The other two were combined.';
  if (used === 1) return 'Only one pass returned, so its scores stand alone.';
  return '';
}

// What is going in: a plain tally of the four readouts already gathered.
export function evidenceRecap(assessments = {}, project = {}) {
  const has = (v) => typeof v === 'string' ? v.trim().length > 0 : !!v;
  const w = assessments.website || {};
  const s = assessments.social || {};
  const ai = assessments.aiReputation || {};
  const e = assessments.earnedMedia || {};
  const host = (() => { try { return new URL(project.websiteUrl).hostname.replace(/^www\./, ''); } catch { return null; } })();
  const props = (project.additionalProperties || []).filter(p => p?.url).length;
  const website = has(w.content) ? [host, props ? `${props + 1} properties` : null, w.techAudit ? 'technical audit' : null, has(w.seoAssessment) ? 'SEO read' : null].filter(Boolean) : [];
  const social = s.noSocialPresence ? ['No social presence, confirmed'] : has(s.content) ? ['Channel readout', s.youtubeContent?.includes('[API Data]') ? 'YouTube metrics' : null, has(s.glassdoorAuto) || has(s.glassdoorContent) ? 'Glassdoor' : null, has(s.awardsRecognition) ? 'awards' : null].filter(Boolean) : [];
  const engines = ['claudeManual', 'geminiManual', 'chatgptManual', 'perplexityManual', 'copilotManual'].filter(k => has(ai[k])).length;
  const aiSources = [['wikipediaContent', 'Wikipedia'], ['redditAnswersContent', 'Reddit'], ['googleNewsContent', 'Google News'], ['trustpilotContent', 'Trustpilot'], ['searchSnapshotContent', 'search results']].filter(([k]) => has(ai[k])).map(([, n]) => n);
  const aiParts = [engines ? `${engines} of 5 AI engines` : null, ...aiSources, !engines && !aiSources.length && has(ai.content) ? 'Synthesis' : null].filter(Boolean);
  const earned = has(e.content) ? ['Coverage readout'] : [];
  const row = (name, parts) => ({ name, detail: parts.length ? parts.join(' · ') : 'Not completed', missing: !parts.length });
  return [row('Website', website), row('Social', social), row('AI reputation', aiParts), row('Earned media', earned)];
}
