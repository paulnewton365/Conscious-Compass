// ─────────────────────────────────────────────────────────────
// CAMPAIGN COHERENCE: view model for report section 05.
//
// Turns the scoring pass's campaignCoherence object into exactly what the
// section renders, so the internal report, the client report and the legacy
// shared view all read one source and cannot drift.
//
// Level names and one-line definitions come from CAMPAIGN_LADDER, the same
// text the scoring prompt uses. The report must never define a level
// differently from the ladder the brand was scored against.
//
// Confidence basis is derived here from the campaigns actually returned.
// The model only returns low, medium or high; it does not state a basis, so
// nothing in this sentence is model-authored.
// ─────────────────────────────────────────────────────────────

import { CAMPAIGN_LADDER, getCampaignLevel } from '../data/rubric.js';

const TOP = 5;

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const clean = (v) => (typeof v === 'string' ? v.trim() : '');

export function normaliseCampaigns(list) {
  if (!Array.isArray(list)) return [];
  return list
    .filter(c => c && typeof c === 'object')
    .map(c => ({
      title: clean(c.name) || 'Unnamed campaign',
      channels: Array.isArray(c.channels) ? c.channels.map(clean).filter(Boolean) : [],
      idea: clean(c.idea),
      evidence: clean(c.evidence),
    }));
}

export function confidenceText(confidence, campaigns) {
  const c = clean(confidence).toLowerCase();
  if (!c) return '';
  const label = c.charAt(0).toUpperCase() + c.slice(1);
  const n = campaigns.length;
  if (n === 0) return `${label}. No campaigns found in the sources reviewed.`;
  const channels = new Set();
  campaigns.forEach(x => x.channels.forEach(ch => channels.add(ch.toLowerCase())));
  const m = channels.size;
  return m
    ? `${label}. Based on ${plural(n, 'campaign', 'campaigns')} found across ${plural(m, 'channel', 'channels')}.`
    : `${label}. Based on ${plural(n, 'campaign', 'campaigns')} found.`;
}

// Returns null when there is nothing scored to show. The caller renders the
// not-scored alert in that case.
export function campaignCoherenceView(coherence, { showCampaigns = true, showConfidence = true } = {}) {
  if (!coherence || typeof coherence !== 'object') return null;
  const raw = coherence.level;
  if (raw === null || raw === undefined || raw === '' || !Number.isFinite(Number(raw))) return null;
  const level = Math.max(0, Math.min(TOP, Math.round(Number(raw))));
  const rung = getCampaignLevel(level);
  const campaigns = normaliseCampaigns(coherence.campaigns);

  const notes = [];
  const rationale = clean(coherence.rationale);
  if (rationale) notes.push({ label: 'Why this level', text: rationale });
  const next = clean(coherence.toNextLevel);
  if (level < TOP && next) notes.push({ label: `To reach level ${level + 1}`, text: next });
  const conf = showConfidence ? confidenceText(coherence.confidence, campaigns) : '';
  if (conf) notes.push({ label: 'Confidence', text: conf });

  return {
    level,
    kicker: level === 0 ? 'Below level 1' : `Level ${level} of ${TOP}`,
    name: rung.name,
    definition: rung.summary,
    verdict: clean(coherence.verdict),
    scaleLabel: level === 0
      ? `Campaign coherence: below level 1, ${rung.name}`
      : `Campaign coherence: level ${level} of ${TOP}, ${rung.name}`,
    scale: CAMPAIGN_LADDER.filter(l => l.level > 0).map(l => ({
      n: l.level,
      name: l.name,
      state: l.level < level ? 'reached' : l.level === level ? 'current' : null,
    })),
    notes,
    campaigns: showCampaigns ? campaigns : null,
    countLabel: plural(campaigns.length, 'campaign', 'campaigns'),
  };
}
