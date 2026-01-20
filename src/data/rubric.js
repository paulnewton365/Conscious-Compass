// Brand Consciousness Assessment Framework v2.3 - Complete Rubric Data

export const MATURITY_STAGES = [
  { id: 'pre-foundational', name: 'Pre-Foundational', min: 0, max: 25, color: '#6b7280' },
  { id: 'foundational', name: 'Foundational', min: 26, max: 39, color: '#ef4444' },
  { id: 'establishing', name: 'Establishing', min: 40, max: 55, color: '#f59e0b' },
  { id: 'differentiating', name: 'Differentiating', min: 56, max: 69, color: '#8b5cf6' },
  { id: 'leading', name: 'Leading', min: 70, max: 84, color: '#3b82f6' },
  { id: 'transforming', name: 'Transforming', min: 85, max: 100, color: '#10b981' },
];

export const BUSINESS_MODELS = [
  { id: 'b2c', name: 'B2C Consumer', weights: { AWAKE: 0.85, AWARE: 1.15, REFLECTIVE: 1.05, ATTENTIVE: 1.1, COGENT: 0.9, SENTIENT: 1.2, VISIONARY: 1.0, INTENTIONAL: 1.0 }},
  { id: 'b2b', name: 'B2B Enterprise', weights: { AWAKE: 1.15, AWARE: 1.05, REFLECTIVE: 1.0, ATTENTIVE: 1.1, COGENT: 1.25, SENTIENT: 0.8, VISIONARY: 1.0, INTENTIONAL: 1.2 }},
  { id: 'services', name: 'Professional Services', weights: { AWAKE: 1.3, AWARE: 1.0, REFLECTIVE: 1.15, ATTENTIVE: 1.0, COGENT: 1.0, SENTIENT: 0.8, VISIONARY: 1.1, INTENTIONAL: 1.2 }},
  { id: 'saas', name: 'SaaS/Technology', weights: { AWAKE: 1.1, AWARE: 1.0, REFLECTIVE: 1.0, ATTENTIVE: 1.15, COGENT: 1.2, SENTIENT: 0.9, VISIONARY: 1.25, INTENTIONAL: 1.0 }},
  { id: 'b2b2c', name: 'B2B2C Platform', weights: { AWAKE: 1.0, AWARE: 1.15, REFLECTIVE: 1.05, ATTENTIVE: 1.1, COGENT: 1.1, SENTIENT: 1.0, VISIONARY: 1.2, INTENTIONAL: 1.0 }},
];

export const ATTRIBUTES = [
  {
    id: 'AWAKE',
    name: 'Influence & Narrative Leadership',
    description: 'Brands should influence and shape broader narratives through thought leadership, coalition building, and externally validated contributions.',
    color: '#0ea5e9',
    questions: [
      { id: 'Q1', text: 'How effectively does your brand influence and shape broader narratives within and beyond your sector?', weight: 14.3 },
      { id: 'Q2', text: 'How effectively does your brand publish original thought leadership that demonstrates expertise?', weight: 14.3 },
      { id: 'Q3', text: 'How clearly does your brand articulate and address key challenges facing your sector?', weight: 14.3 },
      { id: 'Q4', text: 'How actively does your brand lead or participate in industry coalitions and partnerships?', weight: 14.3 },
      { id: 'Q5', text: 'How effectively does your brand communicate commitment to broader causes and impact?', weight: 14.3 },
      { id: 'Q6', text: 'How validated is your brand\'s influence through external recognition and awards?', weight: 14.3 },
      { id: 'Q7', text: 'How consistent is your influence narrative across all channels?', weight: 14.3 },
    ]
  },
  {
    id: 'AWARE',
    name: 'Trust Building & Audience Understanding',
    description: 'Brands should demonstrate deep audience understanding and systematically build trust through reflection, effectiveness, reliability, honesty, and conscience.',
    color: '#8b5cf6',
    questions: [
      { id: 'Q1', text: 'How well does your brand demonstrate understanding of distinct audience segments?', weight: 11.1 },
      { id: 'Q2', text: 'How well does your brand personality reflect audience values? (Reflective Trust)', weight: 11.1 },
      { id: 'Q3', text: 'How effectively does your brand communicate case studies, testimonials, and expertise? (Effective Trust)', weight: 11.1 },
      { id: 'Q4', text: 'How consistent is your messaging across all channels? (Reliable Trust)', weight: 11.1 },
      { id: 'Q5', text: 'How well substantiated are all claims in brand communications? (Honest Trust)', weight: 11.1 },
      { id: 'Q6', text: 'How clearly does your brand communicate its mission and purpose? (Conscientious Trust)', weight: 11.1 },
      { id: 'Q7', text: 'How optimized are audience journeys from awareness to conversion?', weight: 11.1 },
      { id: 'Q8', text: 'How effectively does your brand integrate audience feedback?', weight: 11.1 },
      { id: 'Q9', text: 'How strategically integrated is trust-building across all communications?', weight: 11.1 },
    ]
  },
  {
    id: 'REFLECTIVE',
    name: 'Authenticity & Reputation Management',
    description: 'Brand authenticity = (What you do + How you think + Why you exist) = Who you are. External expression of internal culture.',
    color: '#f59e0b',
    questions: [
      { id: 'Q1', text: 'How clearly is brand strategy articulated across all touchpoints?', weight: 20 },
      { id: 'Q2', text: 'How authentically does external communication reflect internal culture?', weight: 20 },
      { id: 'Q3', text: 'How actively does your brand monitor and manage its reputation?', weight: 20 },
      { id: 'Q4', text: 'How authentic and differentiated is brand positioning?', weight: 20 },
      { id: 'Q5', text: 'How verifiable and honest are all brand claims?', weight: 20 },
    ]
  },
  {
    id: 'ATTENTIVE',
    name: 'Experience Quality & Excellence',
    description: 'Quality extends beyond error-free copy to optimal UX, intuitive IA, substantiated claims, authentic expression, and consistent execution.',
    color: '#10b981',
    questions: [
      { id: 'Q1', text: 'How optimized and intuitive is the user experience across owned channels?', weight: 16.7 },
      { id: 'Q2', text: 'How logical and intuitive is information organization and navigation?', weight: 16.7 },
      { id: 'Q3', text: 'How consistently error-free and high-quality is all content?', weight: 16.7 },
      { id: 'Q4', text: 'How professionally executed is visual presentation?', weight: 16.7 },
      { id: 'Q5', text: 'How accessible is content for all users, including AI systems?', weight: 16.7 },
      { id: 'Q6', text: 'How technically excellent is platform performance?', weight: 16.7 },
    ]
  },
  {
    id: 'COGENT',
    name: 'Strategic Intelligence & Data-Driven Marketing',
    description: 'Evidence of insights driving marketing through segmentation, strategy, data capture, SEO, nurture, channel coordination, and AI representation.',
    color: '#3b82f6',
    questions: [
      { id: 'Q1', text: 'How clearly does marketing demonstrate strategic insights driving decisions?', weight: 16.7 },
      { id: 'Q2', text: 'How effectively does the brand appear in search results and AI-powered searches?', weight: 16.7 },
      { id: 'Q3', text: 'How sophisticated is data capture and lead nurturing?', weight: 16.7 },
      { id: 'Q4', text: 'How well coordinated are marketing efforts across channels?', weight: 16.7 },
      { id: 'Q5', text: 'How strong is the culture of measurement and optimization?', weight: 16.7 },
      { id: 'Q6', text: 'How accurately is your brand represented in AI systems (ChatGPT, Claude, Gemini)?', weight: 16.7 },
    ]
  },
  {
    id: 'SENTIENT',
    name: 'Creative Differentiation & Emotional Connection',
    description: 'Provide a "reason to care" through creativity that captures attention, inspires action, and creates authentic differentiation.',
    color: '#ec4899',
    questions: [
      { id: 'Q1', text: 'How effectively does your brand provide emotional reasons to care beyond functional benefits?', weight: 20 },
      { id: 'Q2', text: 'How differentiated and creative is brand expression compared to industry norms?', weight: 20 },
      { id: 'Q3', text: 'How compelling and on-brand is copywriting across all channels?', weight: 20 },
      { id: 'Q4', text: 'How inspiring and authentically representative is visual design?', weight: 20 },
      { id: 'Q5', text: 'How effectively does creative execution generate engagement?', weight: 20 },
    ]
  },
  {
    id: 'VISIONARY',
    name: 'Future Vision & Audience Benefit',
    description: 'Present a plausible, believable, inspiring vision that audiences understand, which solves their problems and paints benefit clearly.',
    color: '#6366f1',
    questions: [
      { id: 'Q1', text: 'How clearly does your brand articulate a compelling vision for the future?', weight: 20 },
      { id: 'Q2', text: 'How plausible and credible is the brand\'s vision based on capabilities?', weight: 20 },
      { id: 'Q3', text: 'How clearly does the vision address specific audience problems?', weight: 20 },
      { id: 'Q4', text: 'How inspiringly does the brand paint benefits for audiences and the world?', weight: 20 },
      { id: 'Q5', text: 'How effectively does the brand demonstrate innovation and industry leadership?', weight: 20 },
    ]
  },
  {
    id: 'INTENTIONAL',
    name: 'Credibility & Organizational Confidence',
    description: 'Demonstrate credibility through confident language, reputable leadership, cited expertise, and professional presentation.',
    color: '#14b8a6',
    questions: [
      { id: 'Q1', text: 'How confident and authoritative is the brand\'s language across communications?', weight: 20 },
      { id: 'Q2', text: 'How visible, inspiring, and reputable are the brand\'s leaders?', weight: 20 },
      { id: 'Q3', text: 'How frequently is the brand\'s expertise cited by external sources?', weight: 20 },
      { id: 'Q4', text: 'How professional and legitimate does the brand appear across touchpoints?', weight: 20 },
      { id: 'Q5', text: 'How much confidence does the organization project in stability and delivery?', weight: 20 },
    ]
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
