// Brand Consciousness Assessment Framework v2.3

export const MATURITY_STAGES = [
  { id: 'pre-foundational', name: 'Pre-Foundational', min: 0, max: 25, color: '#9E9E9E', description: 'Requires fundamental development across most attributes' },
  { id: 'foundational', name: 'Foundational', min: 26, max: 39, color: '#E53935', description: 'Building basic presence with significant gaps' },
  { id: 'establishing', name: 'Establishing', min: 40, max: 55, color: '#BF360C', description: 'Creating consistency with room for growth' },
  { id: 'differentiating', name: 'Differentiating', min: 56, max: 69, color: '#8D6E63', description: 'Standing out intentionally from competitors' },
  { id: 'leading', name: 'Leading', min: 70, max: 84, color: '#5D4037', description: 'Shaping industry narratives and standards' },
  { id: 'transforming', name: 'Transforming', min: 85, max: 100, color: '#9E9D24', description: 'Redefining category expectations' },
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
    fullName: 'Influence & Narrative Leadership',
    description: 'Brands should influence and shape broader narratives through thought leadership, coalition building, and externally validated contributions to industry discourse.',
    color: '#E53935',
  },
  {
    id: 'AWARE',
    name: 'Aware',
    fullName: 'Trust Building & Audience Understanding',
    description: 'Demonstrate deep audience understanding and systematically build trust through reflection, effectiveness, reliability, honesty, and conscience.',
    color: '#BF360C',
  },
  {
    id: 'REFLECTIVE',
    name: 'Reflective',
    fullName: 'Authenticity & Reputation Management',
    description: 'Brand authenticity is the external expression of internal culture, mission, and purpose—what you do, how you think, and why you exist.',
    color: '#8D6E63',
  },
  {
    id: 'ATTENTIVE',
    name: 'Attentive',
    fullName: 'Experience Quality & Excellence',
    description: 'Quality extends beyond error-free copy to optimal UX, intuitive IA, substantiated claims, authentic expression, and consistent execution.',
    color: '#5D4037',
  },
  {
    id: 'COGENT',
    name: 'Cogent',
    fullName: 'Strategic Intelligence & Data-Driven Marketing',
    description: 'Evidence of insights driving marketing through segmentation, strategy, data capture, SEO, nurture, channel coordination, and AI representation.',
    color: '#455A64',
  },
  {
    id: 'SENTIENT',
    name: 'Sentient',
    fullName: 'Creative Differentiation & Emotional Connection',
    description: 'Provide a "reason to care" through creativity that captures attention, inspires action, and creates authentic differentiation from industry norms.',
    color: '#333333',
  },
  {
    id: 'VISIONARY',
    name: 'Visionary',
    fullName: 'Future Vision & Audience Benefit',
    description: 'Present a plausible, believable, inspiring vision that audiences understand, which solves their problems and paints benefit clearly.',
    color: '#9E9D24',
  },
  {
    id: 'INTENTIONAL',
    name: 'Intentional',
    fullName: 'Credibility & Organizational Confidence',
    description: 'Demonstrate credibility through confident language, reputable leadership, cited expertise, and professional presentation.',
    color: '#1A1A1A',
  },
];

export const SERVICE_RECOMMENDATIONS = {
  AWAKE: [
    { title: 'Original Research & Data', description: 'Commission proprietary studies and reports that generate unique insights for industry distribution.', impact: 'Original research positions the brand as a primary source of industry knowledge, earning media coverage and backlinks that strengthen authority.', attributes: ['Awake', 'Cogent'] },
    { title: 'Strategic Media Relations', description: 'Build relationships with tier-one journalists and secure executive commentary on breaking industry news.', impact: 'Media presence amplifies thought leadership and creates third-party validation that audiences trust more than owned content.', attributes: ['Awake', 'Intentional'] },
    { title: 'Thought Leadership Content', description: 'Develop executive bylines, white papers, and opinion pieces that stake out distinctive industry positions.', impact: 'Thought leadership content creates narrative ownership, helping the brand shape how industry topics are discussed and understood.', attributes: ['Awake', 'Visionary'] },
  ],
  AWARE: [
    { title: 'Reputation Strategy', description: 'Audit current brand perception and develop systematic approach to building trust through consistent proof points.', impact: 'Reputation strategy ensures every touchpoint reinforces trust, creating compound credibility that competitors cannot quickly replicate.', attributes: ['Aware', 'Reflective'] },
    { title: 'Content Marketing Program', description: 'Create audience-centric content that addresses real pain points and demonstrates deep understanding of customer challenges.', impact: 'Content marketing builds trust through value delivery, establishing the brand as a helpful resource before any sales conversation.', attributes: ['Aware', 'Sentient'] },
    { title: 'Social Media Management', description: 'Implement strategic social presence with consistent engagement, community building, and authentic brand voice.', impact: 'Social media creates ongoing dialogue that humanizes the brand and provides real-time signals of audience needs and sentiment.', attributes: ['Aware', 'Attentive'] },
  ],
  REFLECTIVE: [
    { title: 'Brand Narrative Codification', description: 'Document the brand story, voice, and messaging architecture in a comprehensive playbook for all stakeholders.', impact: 'A codified narrative ensures consistency across all communications, preventing fragmented messaging that confuses audiences.', attributes: ['Reflective', 'Attentive'] },
    { title: 'Digital Authority Building', description: 'Implement structured data, optimize knowledge panels, and build citations across authoritative sources.', impact: 'Digital authority signals help AI systems and search engines accurately represent the brand in answers and results.', attributes: ['Reflective', 'Cogent'] },
    { title: 'Wikipedia & Knowledge Panel Strategy', description: 'Develop credible presence on Wikipedia and optimize Google Knowledge Panel with accurate, cited information.', impact: 'Wikipedia and knowledge panels are primary sources for AI training data, directly shaping how AI systems describe the brand.', attributes: ['Reflective', 'Awake'] },
  ],
  ATTENTIVE: [
    { title: 'Content Quality Framework', description: 'Establish editorial standards, style guides, and QA processes that ensure excellence across all content.', impact: 'Quality frameworks prevent brand-damaging errors and create professional consistency that builds credibility over time.', attributes: ['Attentive', 'Intentional'] },
    { title: 'UX/UI Optimization', description: 'Audit and improve user experience across all digital properties, ensuring intuitive navigation and clear conversion paths.', impact: 'Superior UX demonstrates respect for audience time and creates competitive advantage through friction-free experiences.', attributes: ['Attentive', 'Aware'] },
    { title: 'Information Architecture Redesign', description: 'Restructure content organization to match user mental models and improve findability of key information.', impact: 'Clear IA helps users self-serve effectively, reducing frustration and improving perception of brand competence.', attributes: ['Attentive', 'Cogent'] },
  ],
  COGENT: [
    { title: 'Audience Research & Segmentation', description: 'Conduct primary research to deeply understand audience segments, their journeys, and decision drivers.', impact: 'Data-driven audience understanding enables precise targeting and messaging that resonates with specific needs.', attributes: ['Cogent', 'Aware'] },
    { title: 'Analytics & Attribution Infrastructure', description: 'Implement comprehensive tracking to measure content performance, journey effectiveness, and marketing ROI.', impact: 'Measurement infrastructure enables continuous optimization and provides evidence for marketing investment decisions.', attributes: ['Cogent', 'Attentive'] },
    { title: 'SEO & AI Search Strategy', description: 'Optimize content structure and authority signals for both traditional search and emerging AI search interfaces.', impact: 'Search visibility determines whether audiences can find the brand at moments of need, directly impacting opportunity pipeline.', attributes: ['Cogent', 'Reflective'] },
  ],
  SENTIENT: [
    { title: 'Creative Strategy & Big Ideas', description: 'Develop breakthrough creative concepts that differentiate the brand and capture audience attention in crowded markets.', impact: 'Distinctive creativity cuts through noise and creates memorable impressions that generic competitors cannot match.', attributes: ['Sentient', 'Visionary'] },
    { title: 'Brand Storytelling & Emotional Narrative', description: 'Reframe brand messaging to lead with emotional benefit and human stories rather than product specifications.', impact: 'Emotional storytelling creates connection that specifications cannot, making the brand memorable and preferred.', attributes: ['Sentient', 'Reflective'] },
    { title: 'Visual Identity & Design System', description: 'Develop distinctive visual language including photography style, illustration approach, and design elements.', impact: 'Visual differentiation creates instant recognition and signals brand values before a single word is read.', attributes: ['Sentient', 'Attentive'] },
  ],
  VISIONARY: [
    { title: 'Purpose & Vision Development', description: 'Articulate an inspiring future vision that gives audiences a compelling reason to engage with the brand.', impact: 'Purpose gives the brand meaning beyond products, attracting talent, partners, and customers who share values.', attributes: ['Visionary', 'Sentient'] },
    { title: 'Impact Communications', description: 'Develop metrics and narratives that demonstrate tangible positive outcomes from brand engagement.', impact: 'Impact evidence transforms claims into proof, building credibility with increasingly skeptical audiences.', attributes: ['Visionary', 'Intentional'] },
    { title: 'Leadership Narrative Development', description: 'Craft compelling executive stories that connect personal journey to brand mission and industry transformation.', impact: 'Leadership narratives humanize the brand and provide authentic proof points for organizational values.', attributes: ['Visionary', 'Awake'] },
  ],
  INTENTIONAL: [
    { title: 'Executive Positioning Program', description: 'Build executives into recognized industry voices through strategic visibility, speaking, and media presence.', impact: 'Executive visibility creates trust through human connection and provides authoritative spokespeople for the brand.', attributes: ['Intentional', 'Awake'] },
    { title: 'Corporate Credibility Building', description: 'Systematically build proof points through certifications, partnerships, and third-party validation.', impact: 'External credibility signals reduce perceived risk and accelerate trust-building with skeptical audiences.', attributes: ['Intentional', 'Reflective'] },
    { title: 'Professional Presentation Standards', description: 'Ensure all materials reflect organizational competence through polished design and error-free content.', impact: 'Professional presentation signals attention to detail, suggesting similar care in products and services.', attributes: ['Intentional', 'Attentive'] },
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
