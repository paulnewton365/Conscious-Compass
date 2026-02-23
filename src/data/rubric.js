// Brand Consciousness Assessment Framework v2.6

export const MATURITY_STAGES = [
  { id: 'pre-foundational', name: 'Pre-Foundational', min: 0, max: 25, color: '#94A3B8', description: 'Requires fundamental development across most attributes' },
  { id: 'foundational', name: 'Foundational', min: 26, max: 39, color: '#F59E0B', description: 'Building basic presence with significant gaps' },
  { id: 'establishing', name: 'Establishing', min: 40, max: 55, color: '#D97706', description: 'Creating consistency with room for growth' },
  { id: 'differentiating', name: 'Differentiating', min: 56, max: 69, color: '#059669', description: 'Standing out intentionally from competitors' },
  { id: 'leading', name: 'Leading', min: 70, max: 84, color: '#0D9488', description: 'Shaping industry narratives and standards' },
  { id: 'transforming', name: 'Transforming', min: 85, max: 100, color: '#6366F1', description: 'Redefining category expectations' },
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
    description: 'Awake brands do not merely participate in industry conversations; they define them. They introduce frameworks, coin terms, and set agendas that others follow. Evidence includes: original research cited by others, media seeking their commentary first, competitors responding to their positions, and industry recognition for thought leadership.',
    color: '#E11D48',
    signals: {
      strong: ['Original research cited by third parties', 'Media requests for expert commentary on breaking news', 'Keynote speaking at flagship industry events', 'Competitors referencing or responding to their positions', 'Wikipedia presence with external citations', 'Industry awards for thought leadership'],
      moderate: ['Regular bylines in industry publications', 'Podcast guest appearances', 'LinkedIn articles with meaningful engagement', 'Conference panel presentations', 'Quoted in industry roundups'],
      weak: ['Blog posts without external pickup', 'Social posts about industry topics without engagement', 'Press releases without earned coverage', 'No evidence of external validation'],
    },
  },
  {
    id: 'AWARE',
    name: 'Aware',
    fullName: 'Audience Understanding & Trust Building',
    question: 'Do you understand your audiences and build trust?',
    description: 'Aware brands demonstrate deep knowledge of their audiences through evidence of listening, segmentation, and responsive engagement. Trust is built systematically through transparency, reliability, and genuine dialogue. Evidence includes: visible feedback mechanisms, active community engagement, personalized content journeys, and testimonials that cite specific trust factors.',
    color: '#F97316',
    signals: {
      strong: ['Active community with visible two-way dialogue', 'Customer advisory boards or feedback panels', 'Content addressing specific persona pain points by name', 'Testimonials citing trust, reliability, or understanding', 'Responsive social engagement within hours', 'Evidence of listening informing product or content'],
      moderate: ['Segmented content for different audiences', 'Customer success stories with quotes', 'Social listening evidence', 'Newsletter with personalization', 'FAQ addressing real customer questions'],
      weak: ['Generic messaging for all audiences', 'One-way broadcast communication only', 'No visible feedback mechanisms', 'Testimonials without specifics', 'Slow or no social response'],
    },
  },
  {
    id: 'REFLECTIVE',
    name: 'Reflective',
    fullName: 'Brand Authenticity & Self-Awareness',
    question: 'Do you have an authentic brand?',
    description: 'Reflective brands exhibit alignment between what they claim and what they demonstrate. Their external brand expression reflects genuine internal culture, mission, and values. Evidence includes: employee advocacy, leadership visibility, consistent voice across channels, acknowledgment of limitations or evolution, and third-party validation of claims.',
    color: '#FBBF24',
    signals: {
      strong: ['Employee advocacy visible on social media', 'Leadership authentically engaged with content', 'Culture visible through behind-the-scenes content', 'Claims substantiated by third-party validation', 'Transparent about challenges, pivots, or evolution', 'Glassdoor sentiment aligns with external brand'],
      moderate: ['Consistent brand voice across channels', 'Mission and values clearly articulated', 'Team photos and bios on website', 'Case studies with real outcomes and client names', 'About page with authentic founding story'],
      weak: ['Disconnect between claims and observable evidence', 'Generic corporate language without personality', 'No human faces or voices in content', 'Unsubstantiated superlatives', 'Hidden leadership team'],
    },
  },
  {
    id: 'ATTENTIVE',
    name: 'Attentive',
    fullName: 'Experience Excellence & Consistency',
    question: 'Do you deliver exceptional, consistent experiences?',
    description: 'Attentive brands prioritize quality at every touchpoint, from website performance to content accuracy to visual polish. Consistency spans channels and persists over time. Evidence includes: fast load times, accessibility compliance, error-free content, intuitive navigation, and coherent experience whether on website, social, email, or in-person.',
    color: '#34D399',
    signals: {
      strong: ['PageSpeed Performance scores 90+', 'WCAG 2.1 AA accessibility compliance', 'Zero grammatical, spelling, or factual errors', 'Consistent visual system across all channels', 'Mobile-first responsive design', 'Core Web Vitals all green'],
      moderate: ['Functional UX with minor friction points', 'Generally consistent branding across channels', 'Responsive design working on mobile', 'Clear navigation structure', 'Content generally accurate and current'],
      weak: ['Slow page load times (3+ seconds)', 'Broken links or 404 errors', 'Inconsistent visuals between channels', 'Accessibility failures (no alt text, poor contrast)', 'Outdated content or copyright dates', 'Grammar or spelling errors'],
    },
  },
  {
    id: 'COGENT',
    name: 'Cogent',
    fullName: 'Strategic Intelligence & Data-Driven Marketing',
    question: 'Is your marketing driven by strategic insights and data?',
    description: 'Cogent brands show evidence that data and insights drive decisions rather than assumptions or intuition. Their content structure, targeting, and optimization reveal strategic thinking. Evidence includes: clear SEO strategy, structured data implementation, conversion optimization signals, measurement frameworks, and AI search readiness.',
    color: '#22D3EE',
    signals: {
      strong: ['Structured data and schema markup implemented', 'Clear conversion paths with strategic CTAs', 'Evidence of A/B testing or optimization', 'Analytics-informed content strategy', 'AI search optimization (featured snippets, knowledge panels)', 'Lead scoring or nurture sequences visible'],
      moderate: ['Basic SEO implementation (meta titles, descriptions)', 'Lead capture mechanisms on site', 'Content organized by audience or journey stage', 'Regular content updates suggesting performance review', 'UTM tracking in campaigns'],
      weak: ['No clear SEO strategy visible', 'Missing or duplicate meta descriptions', 'No conversion optimization', 'Content without apparent strategic purpose', 'Invisible to AI search assistants', 'No evidence of measurement'],
    },
  },
  {
    id: 'SENTIENT',
    name: 'Sentient',
    fullName: 'Emotional Connection & Creative Differentiation',
    question: 'How well do you create emotional connections that inspire action?',
    description: 'Sentient brands move beyond rational benefits to create genuine emotional resonance. Their creative work captures attention and inspires action through distinctive voice, compelling narratives, and memorable experiences. Evidence includes: emotional storytelling, distinctive visual identity, community passion and advocacy, and creative that breaks category conventions.',
    color: '#818CF8',
    signals: {
      strong: ['Distinctive creative that breaks category norms', 'Emotional storytelling with human narratives', 'Passionate community advocacy and sharing', 'Memorable campaigns, taglines, or visual elements', 'Creative awards or industry recognition', 'User-generated content showing brand love'],
      moderate: ['Consistent brand personality in voice', 'Some emotional appeal in messaging', 'Visual differentiation from key competitors', 'Engaging social content with reactions', 'Brand guidelines ensuring creative consistency'],
      weak: ['Purely rational, feature-focused messaging', 'Generic stock imagery throughout', 'Forgettable creative that blends with competitors', 'No distinctive voice or personality', 'No evidence of emotional response or sharing'],
    },
  },
  {
    id: 'VISIONARY',
    name: 'Visionary',
    fullName: 'Meaningful Purpose & Future Vision',
    question: 'Do you point toward something meaningful?',
    description: 'Visionary brands articulate a future worth believing in. They connect their work to larger human benefits and societal progress, not just business outcomes. Their vision is specific, believable, and inspiring. Evidence includes: clear purpose beyond profit, impact metrics and reporting, stakeholder benefit articulation, and forward-looking thought leadership.',
    color: '#A78BFA',
    signals: {
      strong: ['Clear purpose tied to societal or human benefit', 'Impact metrics with progress reporting', 'Vision referenced by industry as aspirational', 'Stakeholder benefits clearly articulated (not just shareholders)', 'Sustainability, DEI, or responsibility commitments with evidence', 'Long-term thinking visible in strategy'],
      moderate: ['Mission statement with meaningful intent beyond profit', 'Some evidence of purpose-driven decisions', 'Future-focused content and positioning', 'Customer success tied to larger life outcomes', 'Values that extend beyond business performance'],
      weak: ['No articulated purpose or mission', 'Vision limited to market share or revenue goals', 'Inward-focused success metrics only', 'No connection to broader human benefit', 'Short-term thinking dominates messaging'],
    },
  },
  {
    id: 'INTENTIONAL',
    name: 'Intentional',
    fullName: 'Substance, Confidence & Market Leadership',
    question: 'Do you show up with substance, confidence, and leadership?',
    description: 'Intentional brands project earned confidence through substantive positioning. They make clear choices, stake positions, and demonstrate category leadership rather than hedging or following. Evidence includes: decisive messaging without qualifiers, executive visibility and accessibility, industry credentials and certifications, professional polish, and willingness to lead conversations.',
    color: '#64748B',
    signals: {
      strong: ['Clear market position stated without hedging', 'Executive visibility and thought leadership', 'Industry credentials, certifications, or patents', 'Category leadership claims backed by evidence', 'Professional presentation across all touchpoints', 'Decisive language ("We believe" not "We think maybe")'],
      moderate: ['Consistent professional standards maintained', 'Some executive or team visibility', 'Clear value proposition articulated', 'Trademark and brand protection in place', 'Confident tone in key messaging'],
      weak: ['Vague or uncommitted positioning', 'Hidden or anonymous leadership team', 'Unsubstantiated or hedged claims', 'Inconsistent professionalism across touchpoints', 'Following competitors rather than leading', 'Apologetic or uncertain language'],
    },
  },
];

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
