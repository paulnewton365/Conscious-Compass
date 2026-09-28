// ─────────────────────────────────────────────────────────────
// SECTOR PROFILES (v3.56)
//
// The rubric was built around climate, clean energy and B2B technology, and
// reads every brand as though it were one. A real estate firm working well
// looks nothing like a cleantech brand working well: different audiences,
// different proof, different channels. Scoring them by the same expectations
// marks down a firm that is doing its job properly.
//
// A profile changes interpretation, not arithmetic. Attribute weights and the
// overall calculation are untouched, so scores stay comparable and sector
// baselines keep their meaning.
// ─────────────────────────────────────────────────────────────

export const SECTOR_PROFILES = {
  realestate: {
    name: 'Real Estate & Construction',
    audience: 'Brokers and agents, tenants and buyers, investors and lenders, municipalities and planning authorities, and the trades who deliver the work.',
    strong: [
      'Assets and projects presented properly: project and property pages with specifications, delivery status, tenancy and location detail',
      'A track record that is visible and verifiable: completed projects, square footage, occupancy, years in the market, repeat clients',
      'Named people with local standing, since this sector transacts on relationships rather than brand campaigns',
      'Credibility through delivery: on-time completion, certifications relevant to the asset class, planning approvals, awards from the built environment',
      'Local and trade press, broker networks, and the industry bodies that matter in the market',
    ],
    weakIndicators: [
      'Consumer social reach, viral creative and follower counts, which rarely drive value here',
      'National or mainstream press for a firm operating in one metro area',
      'High-volume thought leadership, where a single well-argued market view carries further',
      'Absence of a content engine, which is not a flaw for a firm whose pipeline runs on relationships',
    ],
    tone: 'Precise and business-like. Restraint reads as professionalism in this sector, not as an absence of brand. Do not mark a firm down for declining to sound like a consumer brand; mark it down when its work is hard to verify, its people are invisible, or its claims outrun its delivered projects.',
    sustainability: 'Sustainability shows up as building performance and certification (LEED, BREEAM, Passive House, embodied carbon), retrofit and resilience work, and tenant or community outcomes. Judge it there, not by campaign language.',
  },
  energy: {
    name: 'Energy & Utilities',
    audience: 'Commercial and industrial buyers, utilities and grid operators, investors, regulators and policymakers, project developers, and increasingly the communities that host the infrastructure.',
    strong: [
      'Technical credibility: performance data, pilots, third-party validation, peer-reviewed or independently verified results',
      'A visible project pipeline and deployments, with partners and offtakers named',
      'A clear position in the policy and regulatory conversation, since this market is shaped by it',
      'Plain explanation of the technology and the economics for a non-specialist buyer',
      'Trade and specialist press, analyst coverage, and the conferences where this category is judged',
    ],
    weakIndicators: [
      'Consumer-style brand activity, which is rarely how this category is bought',
      'Volume of social posting over the quality of technical and policy argument',
    ],
    tone: 'Evidence-led. Claims about performance, cost and carbon should be specific and attributable. Treat unverifiable superlatives as a credibility problem, and treat clear, sourced technical argument as strength.',
    sustainability: 'Sustainability is the product here, so the thesis tenets bite hardest: judge whether the impact case is specific and evidenced rather than assumed, and whether hard parts (intermittency, siting, supply chain, unit economics) are addressed openly.',
  },
};

// Sectors without a written profile get the shape of the question rather than
// a borrowed profile, so they are not read as though they were cleantech.
export const DEFAULT_SECTOR_GUIDANCE = `No written profile exists for this sector yet. Before scoring, state to yourself how this sector actually operates: who buys, what counts as proof, which channels carry weight, and what a well-run brand in it looks like. Judge against that, not against the conventions of climate, energy or B2B technology brands. Do not mark a brand down for lacking activity its sector does not use.`;

export const findSectorProfile = (industryId) => SECTOR_PROFILES[industryId] || null;

export function sectorPromptBlock(industryId, industryName) {
  const p = findSectorProfile(industryId);
  if (!p) return `SECTOR: ${industryName || 'not specified'}.\n${DEFAULT_SECTOR_GUIDANCE}`;
  return `SECTOR: ${p.name}.
Audience: ${p.audience}
What strong looks like here:
${p.strong.map(x => `  - ${x}`).join('\n')}
Weak indicators in this sector, which must not be treated as gaps:
${p.weakIndicators.map(x => `  - ${x}`).join('\n')}
Tone: ${p.tone}
Sustainability in this sector: ${p.sustainability}
This changes how evidence is read, never the scoring anchors themselves.`;
}
