// Brand Consciousness Assessment Framework v2.9

export const FRAMEWORK_VERSION = '2.9';

export const MATURITY_STAGES = [
  { id: 'pre-foundational', name: 'Pre-Foundational', min: 0, max: 25, color: '#94A3B8', description: 'Requires fundamental development across most attributes. Significant gaps exist in basic brand presence and identity. The brand is largely invisible or incoherent to its audiences.' },
  { id: 'foundational', name: 'Foundational', min: 26, max: 39, color: '#F59E0B', description: 'Building basic presence with significant gaps. Some brand elements are in place, but execution is inconsistent and many fundamentals are missing.' },
  { id: 'establishing', name: 'Establishing', min: 40, max: 55, color: '#D97706', description: 'Creating consistency with room for growth. Brand identity is forming, and intentional choices are beginning to emerge. The brand is functional but not yet distinctive.' },
  { id: 'differentiating', name: 'Differentiating', min: 56, max: 69, color: '#059669', description: 'Standing out intentionally from competitors. Clear identity exists with distinctive positioning and purposeful execution. The brand is noticed and remembered.' },
  { id: 'leading', name: 'Leading', min: 70, max: 84, color: '#0D9488', description: 'Shaping industry narratives and standards. The brand sets agendas, and others look to it as an example. It influences its category actively.' },
  { id: 'transforming', name: 'Transforming', min: 85, max: 100, color: '#6366F1', description: 'Redefining category expectations. This is category-defining excellence that changes what audiences expect from all brands in the space.' },
];

export const BUSINESS_MODELS = [
  { id: 'b2b', name: 'B2B', weights: { AWAKE: 1.15, AWARE: 1.05, REFLECTIVE: 1.0, ATTENTIVE: 1.1, COGENT: 1.25, SENTIENT: 0.8, VISIONARY: 1.0, INTENTIONAL: 1.2 }},
  { id: 'b2c', name: 'B2C', weights: { AWAKE: 0.85, AWARE: 1.15, REFLECTIVE: 1.05, ATTENTIVE: 1.1, COGENT: 0.9, SENTIENT: 1.2, VISIONARY: 1.0, INTENTIONAL: 1.0 }},
  { id: 'b2b2c', name: 'B2B2C', weights: { AWAKE: 1.0, AWARE: 1.15, REFLECTIVE: 1.05, ATTENTIVE: 1.1, COGENT: 1.1, SENTIENT: 1.0, VISIONARY: 1.2, INTENTIONAL: 1.0 }},
];

export const ATTRIBUTES = [
  {
    id: 'AWAKE',
    name: 'Awake',
    fullName: 'Narrative Leadership & Industry Influence',
    question: 'How well do you shape narratives and lead industry discourse?',
    description: 'Awake brands do not merely participate in industry conversations; they define them. They introduce frameworks, coin terms, and set agendas that others follow. Evidence includes: leadership visible in industry conversations, proactive thought leadership, media seeking them out as a source, Wikipedia presence with external citations, and consistent narrative across earned, owned, and shared media.',
    color: '#E11D48',
    signals: {
      strong: ['Original research/thought leadership cited by third parties', 'Media requests for expert commentary on breaking news', 'Keynote speaking at flagship industry events', 'Competitors referencing or responding to their positions', 'Industry awards for thought leadership'],
      moderate: ['Regular bylines in industry publications', 'Podcast guest appearances', 'LinkedIn articles with meaningful engagement', 'Conference panel presentations', 'Quoted in industry roundups'],
      weak: ['Blog posts without external pickup', 'Social posts about industry topics without engagement', 'Press releases without earned coverage', 'No evidence of external validation'],
    },
  },
  {
    id: 'AWARE',
    name: 'Aware',
    fullName: 'Audience Understanding & Trust Building',
    question: 'Do you understand your audiences and build trust?',
    description: 'Aware brands demonstrate deep knowledge of their audiences through evidence of listening, segmentation, and responsive engagement. Trust is built systematically through transparency, reliability, and genuine dialogue. Evidence includes: content demonstrating deep audience understanding, language mirroring how customers speak, presence on platforms where audience lives, community engagement that is conversational not broadcast, and visible trust signals.',
    color: '#F97316',
    signals: {
      strong: ['Active community with visible two-way dialogue', 'Customer advisory boards or feedback panels', 'Content addressing specific persona pain points by name', 'Testimonials citing trust, reliability, or understanding', 'Responsive social engagement within hours', 'Evidence of listening informing product or content'],
      moderate: ['Segmented content for different audiences', 'Customer success stories with quotes', 'Social listening evidence', 'Newsletter with personalisation', 'FAQ addressing real customer questions'],
      weak: ['Generic messaging for all audiences', 'One-way broadcast communication only', 'No visible feedback mechanisms', 'Testimonials without specifics', 'Slow or no social response'],
    },
  },
  {
    id: 'REFLECTIVE',
    name: 'Reflective',
    fullName: 'Brand Authenticity & Self-Awareness',
    question: 'Do you have an authentic brand?',
    description: 'Reflective brands exhibit alignment between what they claim and what they demonstrate. Their external brand expression reflects genuine internal culture, mission, and values. Evidence includes: consistent brand expression across every touchpoint, clear brand strategy (mission, vision, purpose, promise, values, personality), tone of voice consistent regardless of channel, clear brand architecture (single brand, house of brands, endorsed, or sub-brand structure), and Glassdoor reviews that align with external brand promises.',
    color: '#FBBF24',
    signals: {
      strong: ['Employee advocacy programs with authentic participation', 'Leadership publicly visible and aligned with brand values', 'Third-party validation of cultural claims', 'Consistent tone and visual identity across all channels', 'Transparent acknowledgment of challenges or evolution', 'Clear brand architecture with logical hierarchy between brands, sub-brands, and products'],
      moderate: ['Brand guidelines being followed consistently', 'Some employee social presence', 'Culture referenced in marketing with some evidence', 'Visual consistency across main channels', 'Brand architecture present but not consistently applied'],
      weak: ['Disconnect between marketing claims and Glassdoor reviews', 'Inconsistent visual identity across channels', 'Leadership invisible or misaligned with brand positioning', 'No evidence of genuine internal culture', 'Confusing brand/product hierarchy with unclear relationships between entities'],
    },
  },
  {
    id: 'ATTENTIVE',
    name: 'Attentive',
    fullName: 'Experience Quality & Consistency',
    question: 'Are you delivering exceptional experiences at every touchpoint?',
    description: 'Attentive brands deliver quality that signals competence and care. Every touchpoint demonstrates attention to detail, accessibility, and user experience that respects audience time and needs. Evidence includes: website that is fast, accessible, and well-designed, attention to detail in every piece of content, mobile experience as good as desktop, and WCAG 2.1 AA accessibility compliance.',
    color: '#34D399',
    signals: {
      strong: ['PageSpeed scores above 90 across all pages', 'WCAG 2.1 AA compliance verified', 'Zero broken links or missing images', 'Mobile-first design executed flawlessly', 'Content formatting optimised for scannability', 'Forms and CTAs that work perfectly'],
      moderate: ['PageSpeed scores 70-89', 'Most accessibility basics in place', 'Generally consistent experience', 'Some mobile optimisation', 'Occasional minor errors'],
      weak: ['Slow load times affecting user experience', 'Accessibility barriers present', 'Broken functionality or links', 'Inconsistent quality across pages', 'Obvious errors or amateur execution'],
    },
  },
  {
    id: 'COGENT',
    name: 'Cogent',
    fullName: 'Strategic Intelligence & Data-Driven Marketing',
    question: 'Are you investing in sophisticated, insight-driven marketing?',
    description: 'Cogent brands demonstrate sophisticated, evidence-based marketing strategy. They understand how people find them, measure what works, and make decisions grounded in data rather than intuition. Evidence includes: strong SEO fundamentals, data-informed content strategy, measurement culture, case studies with actual metrics, and clear targeting in paid media.',
    color: '#22D3EE',
    signals: {
      strong: ['Ranking for strategic keywords with clear intent alignment', 'Sophisticated tracking and attribution in place', 'Case studies with specific metrics and outcomes', 'Evidence of A/B testing and optimisation', 'Paid media with clear audience targeting', 'AI search and GEO optimised for reputation and description', 'Channel choices show evidence of deliberate audience and budget logic'],
      moderate: ['Basic SEO fundamentals in place', 'AI accuracy without verified reputation signals', 'Some analytics implementation', 'General results referenced in marketing', 'Some paid media presence', 'Content addresses search intent partially'],
      weak: ['No apparent SEO strategy', 'Analytics either missing or unused', 'No measurement of marketing effectiveness', 'Paid media absent or poorly targeted', 'Content created without data input'],
    },
  },
  {
    id: 'SENTIENT',
    name: 'Sentient',
    fullName: 'Emotional Resonance & Creative Distinction',
    question: 'Do you create emotional impact that inspires connection and action?',
    description: 'Sentient brands create genuine emotional connection through creative excellence that moves audiences. They develop distinctive creative approaches that capture attention and inspire action through feeling, not just information. Evidence includes: creative work that makes you feel something, distinctive visual and verbal identity, storytelling that connects human to human, and brand personality that is genuine and ownable.',
    color: '#818CF8',
    signals: {
      strong: ['Distinctive creative identity recognisable without logo', 'Emotional storytelling that drives sharing', 'Community passion and advocacy visible', 'Content that audiences seek out', 'Creative that breaks category conventions', 'Craft holds at the same high standard in every channel it appears in'],
      moderate: ['Some distinctive creative elements', 'Occasional emotional resonance', 'Competent but not memorable execution', 'Content that is consumed but not shared', 'Brand personality present but not ownable', 'Craft varies noticeably between channels'],
      weak: ['Generic stock imagery and corporate copy', 'No emotional resonance in content', 'Forgettable creative execution', 'Interchangeable with competitors', 'No evidence of audience passion', 'Execution quality collapses outside the primary channel'],
    },
  },
  {
    id: 'VISIONARY',
    name: 'Visionary',
    fullName: 'Purpose & Meaningful Direction',
    question: 'Do you stand for something meaningful and point toward a better future?',
    description: 'Visionary brands articulate purpose beyond profit and demonstrate commitment to meaningful outcomes. They connect their work to broader benefit for customers, communities, or society. Evidence includes: clear articulation of purpose, vision that extends beyond quarterly targets, willingness to take positions on relevant issues, and content that inspires not just informs.',
    color: '#A78BFA',
    signals: {
      strong: ['Purpose statement that drives visible decisions', 'Impact measured and reported transparently', 'Positions taken on relevant issues', 'Stakeholder benefit articulated broadly', 'Vision referenced consistently across channels', 'Evidence of purpose informing strategy'],
      moderate: ['Purpose mentioned but not central', 'Some social responsibility evidence', 'Vision present but vague', 'Occasional forward-thinking content', 'Mission statement exists but feels generic'],
      weak: ['No discernible purpose beyond profit', 'No vision for the future articulated', 'Purely transactional positioning', 'No evidence of broader benefit consideration', 'Mission absent or clearly lip service'],
    },
  },
  {
    id: 'INTENTIONAL',
    name: 'Intentional',
    fullName: 'Credibility & Professional Presence',
    question: 'Do you have the substance and presence to be taken seriously?',
    description: 'Intentional brands project credibility through substantive positioning and professional execution. They signal competence, reliability, and market seriousness through visible evidence of capability. Evidence includes: trademark protection (WIPO registration), consistent brand assets, professional presentation in every context, credentials and certifications prominently displayed, clear brand architecture strategy, and client logos that signal trust.',
    color: '#64748B',
    signals: {
      strong: ['Registered trademarks protecting brand assets', 'Executive visibility and industry recognition', 'Awards and certifications prominently displayed', 'Client logos and case studies with names', 'Consistent professional presentation everywhere', 'Third-party credibility signals abundant', 'Clear brand architecture (single brand, house of brands, endorsed, or sub-brand) consistently applied'],
      moderate: ['Some credentials visible', 'Generally professional presentation', 'Basic brand consistency', 'Some client references', 'Occasional credibility signals', 'Brand architecture exists but applied inconsistently'],
      weak: ['No trademark protection', 'Amateur or inconsistent presentation', 'No visible credentials or recognition', 'No client evidence', 'Credibility gaps undermine positioning', 'Confusing brand hierarchy undermining professional credibility'],
    },
  },
];

// ─────────────────────────────────────────────────────────────
// CAMPAIGN COHERENCE (v2.9)
//
// Division of labour, deliberately enforced to avoid double scoring:
//
//   BASE ATTRIBUTE SCORES judge how good the work is. SENTIENT reads
//   creative quality, craft, distinctiveness and how well execution holds
//   together across channels. COGENT reads strategic intelligence,
//   targeting and measurement.
//
//   THE CAMPAIGN MODIFIER judges only whether an idea is holding the work
//   together: is there a strategic premise and a creative idea threading
//   the tactics, and how far does it travel. It says nothing about craft.
//
// Residual overlap is unavoidable, since a level 4 or 5 campaign almost
// always implies high craft. The modifier values below are deliberately
// hedged (reduced by roughly a third from first calibration) to absorb it.
// ─────────────────────────────────────────────────────────────

export const CAMPAIGN_LADDER = [
  {
    level: 0,
    name: 'Ad hoc',
    summary: 'Activity exists. No connective tissue.',
    description: 'Marketing output is a stream of unrelated posts, pages and announcements. Nothing recurs, nothing references anything else, and no organising thought is visible.',
    signals: [
      'Posts and pages have no shared subject, device or look',
      'No named campaign or recurring property anywhere',
      'Channels behave as separate, unconnected feeds',
      'Output is reactive: product news, events, holidays',
    ],
  },
  {
    level: 1,
    name: 'Themed',
    summary: 'A recurring topic or content series. No idea.',
    description: 'There is a subject the brand keeps returning to, or a repeating content format. It is a theme, not a campaign. Nothing has been built on top of it.',
    signals: [
      'A recurring content series or topic with a consistent title',
      'Repetition of subject matter without a creative device',
      'No cross-channel expression of the theme',
      'No call to action tied to the theme',
    ],
  },
  {
    level: 2,
    name: 'Packaged',
    summary: 'A name and a look, living in one or two channels.',
    description: 'A recognisable campaign exists. It has been named and given a visual treatment, but it is confined to where it launched and does not adapt to other channels.',
    signals: [
      'A named campaign with its own lockup, key visual or hashtag',
      'Present in one or two channels only',
      'Landing page or hub exists but is not connected onward',
      'Runs once for a defined burst, then stops',
    ],
  },
  {
    level: 3,
    name: 'Integrated',
    summary: 'One idea expressed natively across owned, paid, earned and social.',
    description: 'A strategic premise and a creative idea are visibly threading the tactics. The idea is adapted to each channel rather than copy-pasted into it, and the pieces reference one another.',
    signals: [
      'The same idea appears in website, social, paid and earned, adapted each time',
      'A consistent creative device travels across channels',
      'Paid creative and organic content share the premise',
      'Clear call to action running through the whole campaign',
      'Earned coverage picks up the campaign framing, not just the news',
    ],
  },
  {
    level: 4,
    name: 'Platform',
    summary: 'The idea recurs and sustains. Ownable device that travels across time.',
    description: 'The campaign has become a property the brand owns and returns to. It survives beyond a single burst, gains new expressions, and is recognisable as the brand\'s territory.',
    signals: [
      'The campaign has run in multiple waves or across multiple years',
      'The device is ownable and would be recognised without the logo',
      'New chapters or extensions have been built on the original idea',
      'Partners, sponsors or spokespeople have been recruited into it',
      'The idea shapes the brand\'s wider communications, not just the campaign',
    ],
  },
  {
    level: 5,
    name: 'Consequential',
    summary: 'The idea produces visible influence.',
    description: 'The campaign is not only coherent and sustained, it has moved something outside the brand. Audiences participate, competitors respond, and the language or terms of the category shift.',
    signals: [
      'Earned conversation at scale that the brand did not pay for',
      'Visible audience participation or user generated content using the idea',
      'Competitors imitating the device, format or framing',
      'Category language or terminology shifting toward the campaign',
      'Effectiveness awards or independently published outcomes',
      'Third parties citing the campaign as a reference point',
    ],
  },
];

// Level 5 is judged on publicly observable evidence only, in line with the
// public data principle. Client reported ROI, internal lift data and media
// plans are out of scope. An effective campaign with quiet, unpublished
// results will correctly cap at level 4.
export const CAMPAIGN_EVIDENCE_RULE = 'Judge campaign influence on publicly observable evidence only: earned pickup, third-party citation, visible audience participation, competitor response, effectiveness awards, and results the brand has itself published. Never infer impact from internal or client-reported data.';

export const CAMPAIGN_MODIFIER_ATTRIBUTES = {
  primary: ['COGENT', 'SENTIENT'],
  secondary: ['AWAKE', 'AWARE', 'REFLECTIVE', 'INTENTIONAL'],
};

export const CAMPAIGN_MODIFIERS = {
  0: { primary: -4, secondary: -2 },
  1: { primary: -3, secondary: -1 },
  2: { primary: -1, secondary: 0 },
  3: { primary: 2, secondary: 1 },
  4: { primary: 3, secondary: 2 },
  5: { primary: 5, secondary: 3 },
};

export function getCampaignLevel(level) {
  const n = Number.isFinite(Number(level)) ? Math.round(Number(level)) : 0;
  return CAMPAIGN_LADDER.find(l => l.level === n) || CAMPAIGN_LADDER[0];
}

export function getCampaignModifier(level, attributeId) {
  const n = Number.isFinite(Number(level)) ? Math.round(Number(level)) : 0;
  const band = CAMPAIGN_MODIFIERS[Math.max(0, Math.min(5, n))] || CAMPAIGN_MODIFIERS[0];
  if (CAMPAIGN_MODIFIER_ATTRIBUTES.primary.includes(attributeId)) return band.primary;
  if (CAMPAIGN_MODIFIER_ATTRIBUTES.secondary.includes(attributeId)) return band.secondary;
  return 0;
}

// Applies the campaign modifier to a parsed scores object.
//
// Safe to run repeatedly: baseScore is preserved on first application and
// every subsequent run recalculates from baseScore, never from an already
// adjusted score. This matters because rescoring an existing assessment
// runs the whole pipeline again.
export function applyCampaignModifiers(scores, campaignLevel) {
  if (!scores) return scores;
  const out = { ...scores };
  const level = Number.isFinite(Number(campaignLevel)) ? Math.max(0, Math.min(5, Math.round(Number(campaignLevel)))) : null;

  ATTRIBUTES.forEach(attr => {
    const entry = out[attr.id];
    if (!entry || typeof entry.score !== 'number' && typeof entry.baseScore !== 'number') return;

    const base = typeof entry.baseScore === 'number' ? entry.baseScore : entry.score;
    if (typeof base !== 'number') return;

    if (level === null) {
      out[attr.id] = { ...entry, baseScore: base, campaignModifier: 0, score: base };
      return;
    }

    const mod = getCampaignModifier(level, attr.id);
    const adjusted = Math.max(0, Math.min(100, base + mod));

    out[attr.id] = {
      ...entry,
      baseScore: base,
      campaignModifier: mod,
      // Record what was actually applied after clamping, so the report never
      // shows an adjustment the score did not really receive.
      campaignModifierApplied: adjusted - base,
      score: adjusted,
    };
  });

  return out;
}

export const SERVICE_RECOMMENDATIONS = {
  AWAKE: [
    { title: 'Original Research Program', description: 'Commission proprietary studies that generate unique insights others must cite. Design research to answer questions the industry is asking.', impact: 'Original research positions the brand as a primary source, earning media coverage and backlinks while creating assets competitors cannot replicate.', attributes: ['Awake', 'Cogent'], answersQuestion: 'Establishes the brand as the source others reference, shifting from participant to leader in discourse.' },
    { title: 'Strategic Media Relations', description: 'Build journalist relationships and position executives as go-to sources for breaking industry news and trend commentary.', impact: 'Being the first call for comment creates narrative influence and third-party validation that owned content cannot achieve.', attributes: ['Awake', 'Intentional'], answersQuestion: 'Creates the media relationships that enable narrative shaping at moments of maximum industry attention.' },
    { title: 'Industry Framework Development', description: 'Create proprietary frameworks, models, or methodologies that others adopt. Name concepts the industry will use.', impact: 'When others use your terminology and frameworks, you own the conversation by default.', attributes: ['Awake', 'Visionary'], answersQuestion: 'Directly creates the terms and frameworks through which industry discourse occurs.' },
  ],
  AWARE: [
    { title: 'Audience Research & Personas', description: 'Conduct primary research to understand audience segments deeply. Document pain points, language, and decision journeys.', impact: 'Evidence-based audience understanding enables messaging that resonates because it reflects real needs, not assumptions.', attributes: ['Aware', 'Cogent'], answersQuestion: 'Builds the foundational understanding required to demonstrate genuine audience knowledge.' },
    { title: 'Community Engagement Program', description: 'Establish two-way dialogue channels. Create feedback loops, advisory panels, or community spaces where audiences shape the brand.', impact: 'Active listening builds trust faster than broadcasting and provides ongoing insight into evolving audience needs.', attributes: ['Aware', 'Reflective'], answersQuestion: 'Creates visible evidence of listening and response that builds systematic trust.' },
    { title: 'Trust Signal Development', description: 'Identify and amplify specific proof points that build trust. Surface testimonials, case studies, and evidence that addresses audience skepticism.', impact: 'Strategic trust-building compounds over time, creating credibility barriers that competitors cannot quickly overcome.', attributes: ['Aware', 'Intentional'], answersQuestion: 'Systematically builds the trust evidence audiences need to believe brand claims.' },
    { title: 'Influencer & Creator Strategy', description: 'Partner with creators and thought leaders who already have trust with target audiences. Prioritize authentic alignment over reach.', impact: 'Influencers provide borrowed trust and audience access. Strategic partnerships signal audience understanding and accelerate credibility.', attributes: ['Aware', 'Sentient'], answersQuestion: 'Reaches audiences through voices they already trust, demonstrating genuine audience understanding.' },
  ],
  REFLECTIVE: [
    { title: 'Brand Authenticity Audit', description: 'Evaluate alignment between brand claims and observable evidence. Identify gaps between what you say and what you demonstrate.', impact: 'Authenticity gaps erode trust. Identifying and closing them prevents reputation damage and builds genuine credibility.', attributes: ['Reflective', 'Aware'], answersQuestion: 'Reveals where brand expression and reality diverge, enabling authentic alignment.' },
    { title: 'Culture Visibility Program', description: 'Make internal culture visible externally through employee advocacy, behind-the-scenes content, and leadership transparency.', impact: 'Visible culture humanizes the brand and provides authentic proof points that polished marketing cannot replicate.', attributes: ['Reflective', 'Sentient'], answersQuestion: 'Demonstrates authenticity by showing the humans and culture behind the brand.' },
    { title: 'Wikipedia & Knowledge Panel Strategy', description: 'Develop verifiable presence on Wikipedia and optimize Google Knowledge Panel with accurate, third-party cited information.', impact: 'These sources train AI systems and inform first impressions. Accuracy here shapes how the world understands the brand.', attributes: ['Reflective', 'Cogent'], answersQuestion: 'Ensures external sources accurately reflect authentic brand identity.' },
  ],
  ATTENTIVE: [
    { title: 'Experience Consistency Audit', description: 'Evaluate brand experience across all touchpoints. Identify inconsistencies between website, social, email, and other channels.', impact: 'Inconsistency signals organizational dysfunction. Consistency signals competence and attention to detail.', attributes: ['Attentive', 'Reflective'], answersQuestion: 'Identifies where experience gaps undermine the promise of exceptional delivery.' },
    { title: 'Technical Performance Optimization', description: 'Achieve 90+ PageSpeed scores, WCAG 2.1 AA compliance, and green Core Web Vitals across all digital properties.', impact: 'Technical excellence is table stakes. Poor performance actively damages perception regardless of content quality.', attributes: ['Attentive', 'Cogent'], answersQuestion: 'Ensures technical foundation supports rather than undermines experience quality.' },
    { title: 'Quality Assurance Framework', description: 'Establish editorial standards, review processes, and QA checkpoints that prevent errors and ensure excellence.', impact: 'Systematic quality processes prevent brand-damaging mistakes and create sustainable excellence over time.', attributes: ['Attentive', 'Intentional'], answersQuestion: 'Creates the systems that ensure consistent exceptional delivery.' },
  ],
  COGENT: [
    { title: 'Measurement & Attribution Infrastructure', description: 'Implement comprehensive tracking to understand what works. Build dashboards that inform decisions with evidence, not intuition.', impact: 'Measurement transforms marketing from art to science, enabling continuous improvement and investment justification.', attributes: ['Cogent', 'Attentive'], answersQuestion: 'Builds the data foundation required for genuinely insight-driven marketing.' },
    { title: 'AI Search Optimization', description: 'Optimize for AI search assistants through structured data, authoritative content, and clear entity relationships.', impact: 'AI assistants increasingly mediate brand discovery. Invisibility to AI means invisibility to growing audience segments.', attributes: ['Cogent', 'Reflective'], answersQuestion: 'Ensures data-driven presence in emerging AI-mediated discovery channels.' },
    { title: 'Conversion Path Optimization', description: 'Map and optimize the paths from awareness to action. Implement testing frameworks that continuously improve performance.', impact: 'Strategic conversion optimization compounds. Small improvements create significant pipeline impact over time.', attributes: ['Cogent', 'Aware'], answersQuestion: 'Applies strategic intelligence to the moments that drive business outcomes.' },
    { title: 'Strategic Paid Media Program', description: 'Develop data-driven paid media strategy across search, social, and programmatic channels. Implement testing frameworks and attribution modeling.', impact: 'Paid media provides measurable, scalable reach. Strategic investment signals market seriousness and accelerates awareness building.', attributes: ['Cogent', 'Intentional'], answersQuestion: 'Applies data-driven marketing through measurable paid amplification of brand presence.' },
  ],
  SENTIENT: [
    { title: 'Emotional Narrative Development', description: 'Reframe brand messaging to lead with emotional benefit and human impact rather than features or specifications.', impact: 'Emotional connection creates preference that rational comparison cannot. People remember how you made them feel.', attributes: ['Sentient', 'Visionary'], answersQuestion: 'Creates the emotional resonance that moves audiences from awareness to action.' },
    { title: 'Creative Differentiation Strategy', description: 'Develop distinctive creative approach that breaks category conventions and captures attention in crowded markets.', impact: 'Distinctive creativity makes the brand memorable. Generic execution makes it forgettable regardless of message.', attributes: ['Sentient', 'Awake'], answersQuestion: 'Builds creative assets that inspire emotional response and action.' },
    { title: 'Community Passion Cultivation', description: 'Identify and activate brand advocates. Create shareable experiences that turn customers into passionate ambassadors.', impact: 'Passionate communities provide social proof and organic reach that advertising cannot buy.', attributes: ['Sentient', 'Aware'], answersQuestion: 'Transforms emotional connection into visible community advocacy.' },
  ],
  VISIONARY: [
    { title: 'Purpose Articulation & Activation', description: 'Define purpose that connects brand work to meaningful human or societal benefit. Make purpose visible in decisions and actions.', impact: 'Authentic purpose attracts talent, customers, and partners who share values, creating competitive advantage.', attributes: ['Visionary', 'Reflective'], answersQuestion: 'Articulates the meaningful future the brand points toward.' },
    { title: 'Impact Measurement & Communication', description: 'Develop metrics that demonstrate tangible positive outcomes. Report progress transparently to build credibility.', impact: 'Measured impact transforms aspirational claims into credible proof, building trust with skeptical audiences.', attributes: ['Visionary', 'Intentional'], answersQuestion: 'Provides evidence that vision creates real-world meaningful outcomes.' },
    { title: 'Stakeholder Benefit Mapping', description: 'Articulate how the brand creates value for all stakeholders: customers, employees, communities, and partners, not just shareholders.', impact: 'Broad benefit articulation signals mature, sustainable business thinking that builds diverse support.', attributes: ['Visionary', 'Aware'], answersQuestion: 'Demonstrates that meaningfulness extends beyond business metrics to human impact.' },
  ],
  INTENTIONAL: [
    { title: 'Executive Visibility Program', description: 'Build executives into recognized industry voices through strategic speaking, media presence, and thought leadership.', impact: 'Visible leadership creates trust through human connection and provides authoritative brand spokespeople.', attributes: ['Intentional', 'Awake'], answersQuestion: 'Demonstrates substance and leadership through visible executive presence.' },
    { title: 'Positioning Clarity Initiative', description: 'Sharpen market position with decisive language. Eliminate hedging and qualify only where genuinely necessary.', impact: 'Clear positioning signals confidence. Hedging signals uncertainty that makes audiences question competence.', attributes: ['Intentional', 'Sentient'], answersQuestion: 'Creates the confident, substantive positioning that signals leadership.' },
    { title: 'Credibility Infrastructure', description: 'Systematically build third-party validation through certifications, partnerships, awards, and industry recognition.', impact: 'External credibility signals reduce perceived risk and accelerate trust with skeptical audiences.', attributes: ['Intentional', 'Reflective'], answersQuestion: 'Builds the substantive proof points that justify confident positioning.' },
  ],
};

export function getMaturityStage(score) {
  return MATURITY_STAGES.find(s => score >= s.min && score <= s.max) || MATURITY_STAGES[0];
}

export function getScoreLabel(score) {
  if (score >= 90) return 'Exceptional';
  if (score >= 70) return 'Strong';
  if (score >= 50) return 'Adequate';
  if (score >= 30) return 'Weak';
  return 'Absent';
}
