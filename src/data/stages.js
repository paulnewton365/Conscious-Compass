// ─────────────────────────────────────────────────────────────
// COMPANY STAGE (v3.56)
//
// The rubric assumes evidence that only exists at scale: Glassdoor reviews,
// employee advocacy, analyst recognition, a Wikipedia entry, share of voice
// against incumbents, published impact reporting, candour about litigation.
// A twelve-person startup has none of that, and scoring its absence as a flaw
// tells a founder nothing true.
//
// Stage is set per brand and carries three things into the read: what is fair
// to expect, what is not yet expected (and so counts neither for nor against),
// and what to judge instead. It also steers which services are worth naming.
//
// The stage descriptions are Antenna Group's own.
// ─────────────────────────────────────────────────────────────

export const STAGES = [
  {
    id: 'startup',
    name: 'Startup',
    subtitle: 'The Experiment',
    what: 'A small, nimble group of founders working on an unproven hypothesis.',
    reality: 'The company has a Minimum Viable Product but no definitive market proof. It operates in survival mode, relying on grit and early funding to find a repeatable business model.',
    indicator: 'The team is hunting for Product-Market Fit.',
    notExpected: [
      'Glassdoor reviews or measurable employee sentiment',
      'Employee advocacy programs',
      'Analyst recognition, industry awards or a Wikipedia entry',
      'Share of voice against established competitors',
      'Sustained earned coverage across a year',
      'Published impact or ESG reporting',
      'Public candour about litigation or controversy',
    ],
    instead: [
      'Founder visibility: who they are, what they have built before, whether they are findable and credible',
      'Named early customers, pilots, design partners or investors as proof the hypothesis is landing',
      'A findable, consistent entity: one name, a working site, Crunchbase and LinkedIn that agree',
      'Clarity of the problem being solved, expressed so a non-expert grasps it in one read',
      'Candour about what is unproven and what the product cannot do yet, which is this stage\u2019s version of showing the scars',
    ],
    services: 'Services that establish the basics: positioning clarity, founder and category narrative, a site that explains the problem, early proof points and credibility infrastructure. Programs that assume a communications function, an executive bench or a content engine are premature here.',
  },
  {
    id: 'scaleup',
    name: 'Scaleup',
    subtitle: 'The Growth Engine',
    what: 'A validated business that has found its target audience and is actively pouring fuel on the fire.',
    reality: 'The chaos of early survival is replaced by aggressive hiring, structured marketing and department creation. The company is building a repeatable sales machine, not just selling a product.',
    indicator: 'Customer acquisition and revenue are scaling faster than expenses.',
    notExpected: [
      'A Wikipedia entry or established knowledge panel',
      'Deep analyst relationships or category-defining share of voice',
      'A long record of published impact reporting',
      'Broad public commentary or controversy history',
    ],
    instead: [
      'Whether the story holds together as headcount and channels multiply, or has started to fragment',
      'Early employee signals: hiring pages, careers content, the first Glassdoor reviews where they exist',
      'Repeatable earned coverage and customer proof rather than one-off launches',
      'Measurement and conversion infrastructure keeping pace with the spend',
      'Whether growth messaging has outrun what the product actually delivers',
    ],
    services: 'Services that make growth repeatable and coherent: messaging architecture, demand and conversion infrastructure, structured media relations, employer brand as hiring accelerates, and consistency across the channels now in play.',
  },
  {
    id: 'leader',
    name: 'Market Leader',
    subtitle: 'The Regional or National Champion',
    what: 'A dominant, household name within its primary domestic market or specific industry niche.',
    reality: 'The company has beaten most local competitors. It has strong domestic brand recognition, stable margins and a structured corporate hierarchy.',
    indicator: 'It is the go-to option that competitors try to copy.',
    notExpected: [
      'Multi-market or multi-language presence',
      'Global share of voice',
    ],
    instead: [
      'Whether leadership in the category is claimed or demonstrated by third parties',
      'Depth of employee and customer sentiment now that both are measurable',
      'Whether the brand still says anything distinctive, or has settled into category-standard language',
      'How it handles scrutiny: awards, rankings, reviews, and the harder questions of its category',
    ],
    services: 'Services that defend and sharpen a strong position: narrative leadership, original research, executive visibility, employer brand, and the consistency work that keeps a large organisation on message.',
  },
  {
    id: 'multinational',
    name: 'Multinational',
    subtitle: 'The Borderless Enterprise',
    what: 'A complex corporate entity operating offices, supply chains and factories across multiple countries.',
    reality: 'The company adapts its core offering to different cultures, laws and currencies. Regional executives make decisions and the structure is bureaucratic by necessity.',
    indicator: 'A significant share of revenue comes from foreign markets.',
    notExpected: [],
    instead: [
      'Whether one brand is recognisable across markets or has fractured into regional dialects',
      'Local relevance against global consistency, and which is winning',
      'Supply chain, labour and environmental scrutiny, and how openly it is handled',
      'Whether published reporting and marketing tell the same story',
    ],
    services: 'Services that hold a large, distributed brand together: governance and architecture, market-level activation within a single system, reputation and issues readiness, and impact communication that stands up to scrutiny.',
  },
  {
    id: 'conglomerate',
    name: 'Conglomerate',
    subtitle: 'The Ecosystem',
    what: 'A corporate umbrella owning a diverse portfolio of brands, subsidiaries and spin-offs.',
    reality: 'Growth comes from acquisition and investment across industries as much as from organic expansion.',
    indicator: 'It operates as a portfolio of multiple brands, not a single product line.',
    notExpected: [],
    instead: [
      'Whether the parent stands for anything, or is only a holding structure behind its brands',
      'How clearly the architecture reads: what the parent endorses, owns or merely holds',
      'Whether acquired brands inherit or dilute the parent\u2019s standards',
      'Whether commitments made at parent level are visible in the operating companies',
    ],
    services: 'Services that resolve portfolio questions: brand architecture, parent narrative and endorsement strategy, integration of acquired brands, and reporting that ties the portfolio to its commitments.',
  },
  {
    id: 'global',
    name: 'Global Brand',
    subtitle: 'The Cultural Icon',
    what: 'A universal household name whose identity transcends its products and is recognised instantly worldwide.',
    reality: 'The brand name itself represents a lifestyle, status or emotional connection, with a cultural and economic footprint to match.',
    indicator: 'True omnipresence and emotional equity worldwide.',
    notExpected: [],
    instead: [
      'Whether cultural meaning is still being earned or is being lived off',
      'How scrutiny at this scale is met: activism, regulation, litigation, and what is said plainly',
      'Whether the brand leads the conversation in its category or defends its position in it',
      'Consistency of meaning across every market, product and touchpoint',
    ],
    services: 'Services at the level of cultural leadership: narrative and category definition, reputation resilience, purpose that survives scrutiny, and consistency across an enormous surface area.',
  },
];

export const findStage = (id) => STAGES.find(s => s.id === id) || null;
export const STAGE_IDS = STAGES.map(s => s.id);

// The block the scoring pass reads. Absent stage means no stage guidance at
// all rather than a guessed one.
export function stagePromptBlock(stageId) {
  const s = findStage(stageId);
  if (!s) return '';
  return `COMPANY STAGE: ${s.name.toUpperCase()} (${s.subtitle}).
${s.what} ${s.reality} Key indicator: ${s.indicator}

How stage governs this read:
${s.notExpected.length ? `- A company at this stage would not normally have: ${s.notExpected.join('; ')}. Their absence counts NEITHER FOR NOR AGAINST. Do not describe them as gaps, and do not recommend fixing them.` : '- A company at this stage is expected to show the full range of evidence the rubric describes, so absence here is a genuine finding.'}
- Judge instead:
${s.instead.map(i => `  - ${i}`).join('\n')}
- Hold the same scoring anchors. Stage changes which evidence is fair to look for, never the standard applied to the evidence you find.
- Services: ${s.services}`;
}
