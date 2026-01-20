// Brand Consciousness Assessment Framework v2.3

export const MATURITY_STAGES = [
  { id: 'pre-foundational', name: 'Pre-Foundational', min: 0, max: 25, color: '#6b7280', description: 'Requires fundamental development across most attributes' },
  { id: 'foundational', name: 'Foundational', min: 26, max: 39, color: '#ef4444', description: 'Building basic presence with significant gaps' },
  { id: 'establishing', name: 'Establishing', min: 40, max: 55, color: '#f59e0b', description: 'Creating consistency with room for growth' },
  { id: 'differentiating', name: 'Differentiating', min: 56, max: 69, color: '#8b5cf6', description: 'Standing out intentionally from competitors' },
  { id: 'leading', name: 'Leading', min: 70, max: 84, color: '#3b82f6', description: 'Shaping industry narratives and standards' },
  { id: 'transforming', name: 'Transforming', min: 85, max: 100, color: '#10b981', description: 'Redefining category expectations' },
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
    color: '#0EA5E9',
  },
  {
    id: 'AWARE',
    name: 'Aware',
    fullName: 'Trust Building & Audience Understanding',
    description: 'Demonstrate deep audience understanding and systematically build trust through reflection, effectiveness, reliability, honesty, and conscience.',
    color: '#8B5CF6',
  },
  {
    id: 'REFLECTIVE',
    name: 'Reflective',
    fullName: 'Authenticity & Reputation Management',
    description: 'Brand authenticity is the external expression of internal culture, mission, and purpose—what you do, how you think, and why you exist.',
    color: '#F59E0B',
  },
  {
    id: 'ATTENTIVE',
    name: 'Attentive',
    fullName: 'Experience Quality & Excellence',
    description: 'Quality extends beyond error-free copy to optimal UX, intuitive IA, substantiated claims, authentic expression, and consistent execution.',
    color: '#10B981',
  },
  {
    id: 'COGENT',
    name: 'Cogent',
    fullName: 'Strategic Intelligence & Data-Driven Marketing',
    description: 'Evidence of insights driving marketing through segmentation, strategy, data capture, SEO, nurture, channel coordination, and AI representation.',
    color: '#3B82F6',
  },
  {
    id: 'SENTIENT',
    name: 'Sentient',
    fullName: 'Creative Differentiation & Emotional Connection',
    description: 'Provide a "reason to care" through creativity that captures attention, inspires action, and creates authentic differentiation from industry norms.',
    color: '#EC4899',
  },
  {
    id: 'VISIONARY',
    name: 'Visionary',
    fullName: 'Future Vision & Audience Benefit',
    description: 'Present a plausible, believable, inspiring vision that audiences understand, which solves their problems and paints benefit clearly.',
    color: '#6366F1',
  },
  {
    id: 'INTENTIONAL',
    name: 'Intentional',
    fullName: 'Credibility & Organizational Confidence',
    description: 'Demonstrate credibility through confident language, reputable leadership, cited expertise, and professional presentation.',
    color: '#14B8A6',
  },
];

export const SERVICE_RECOMMENDATIONS = {
  AWAKE: ['Original Research & Data', 'Strategic Media Relations', 'Thought Leadership Content', 'Industry Events & Convening', 'Policy & Advocacy Communications', 'Strategic Partnerships', 'Awards Programs'],
  AWARE: ['Reputation Strategy', 'Content Marketing', 'Social Media Management', 'Purpose Communications', 'Brand Identity', 'Influencer Marketing', 'Customer Experience'],
  REFLECTIVE: ['Brand Narrative Codification', 'Digital Authority Building', 'Schema Markup', 'Wikipedia Presence', 'AI Visibility Strategy', 'Consistency Audits', 'Crisis Response'],
  ATTENTIVE: ['Content Strategy', 'Campaign Development', 'Style Guides', 'QA Processes', 'Digital Asset Management', 'MarTech Integration', 'Channel Optimization'],
  COGENT: ['Audience Research', 'Analytics Infrastructure', 'Journey Mapping', 'Strategic Planning', 'Media Planning', 'SEO Strategy', 'Marketing Automation', 'Attribution Modeling'],
  SENTIENT: ['Creative Strategy', 'Big Ideas Development', 'Brand Storytelling', 'Copywriting Excellence', 'Visual Innovation', 'Video Production', 'Experiential Design'],
  VISIONARY: ['Purpose Discovery', 'Vision Development', 'Impact Measurement', 'Investor Communications', 'Leadership Narratives', 'ESG Strategy', 'Brand Activism'],
  INTENTIONAL: ['Executive Positioning', 'Media Training', 'Executive Social Strategy', 'Byline Placement', 'Analyst Relations', 'Corporate Messaging', 'Speaking Strategy'],
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
