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
