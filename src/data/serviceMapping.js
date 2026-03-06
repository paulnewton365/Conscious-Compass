// =============================================================================
// ANTENNA GROUP SERVICE MAPPING FOR CONSCIOUS COMPASS
// =============================================================================
// This file maps Compass attributes to recommended services.
// Edit this file to update service recommendations as offerings evolve.
// Last updated: 2026-02-19
// =============================================================================

// SCORE THRESHOLDS (when to recommend services)
export const THRESHOLDS = {
  CRITICAL: 40,    // Below this = high priority recommendations
  MODERATE: 55,    // Below this = recommended  
  OPPORTUNITY: 70, // Below this = opportunity to strengthen
};

// =============================================================================
// SERVICE CATALOG
// =============================================================================
// Add/edit services here. Each service needs a unique key.

export const SERVICES = {
  // -------------------------------------------------------------------------
  // BRAND STRATEGY & EXPRESSION
  // -------------------------------------------------------------------------
  brandStrategy: {
    name: 'Brand Strategy',
    category: 'Brand Strategy & Expression',
    bundle: 'Brand Strategy',
    includes: [
      'Brand Research (Compass)',
      'Stakeholder Interviews (IDIs)',
      'Rapid Discovery (Landscape & Audience)',
      'Brand Positioning',
      'Brand House Development',
      'Brand Workshop',
      'Authentic Foundation (Why, What, How)',
    ],
    budget: { low: 15000, high: 20000 },
    weeks: { low: 2, high: 4 },
    type: 'fixed_fee',
  },

  brandExpression: {
    name: 'Brand Expression',
    category: 'Brand Strategy & Expression',
    bundle: 'Brand Expression',
    includes: [
      'Tone of Voice',
      'Manifesto',
      'Visual Identity System',
      'Logo/Wordmark Development',
      'Brand Deck Asset Production',
    ],
    budget: { low: 25000, high: 30000 },
    weeks: { low: 3, high: 7 },
    type: 'fixed_fee',
  },

  brandAssets: {
    name: 'Brand Assets & Guidelines',
    category: 'Brand Strategy & Expression',
    bundle: 'Brand Assets',
    includes: ['Social Lock-ups', 'Brand Guidelines'],
    budget: { low: 10000, high: 15000 },
    weeks: { low: 1, high: 2 },
    type: 'fixed_fee',
  },

  brandArchitecture: {
    name: 'Brand Architecture',
    category: 'Brand Strategy & Expression',
    bundle: 'Brand Architecture',
    includes: [
      'Brand Hierarchy Audit',
      'Architecture Strategy (Single Brand, House of Brands, Endorsed, Sub-brand)',
      'Naming Conventions & Nomenclature',
      'Visual Relationship System',
      'Brand Portfolio Mapping',
      'Migration & Implementation Roadmap',
    ],
    budget: { low: 20000, high: 35000 },
    weeks: { low: 4, high: 8 },
    type: 'fixed_fee',
  },

  // -------------------------------------------------------------------------
  // WEBSITE & DIGITAL
  // -------------------------------------------------------------------------
  websiteFull: {
    name: 'Website Strategy & Development',
    category: 'Website & App Development',
    bundle: 'Standard Website Offering',
    includes: [
      'Website Strategy & Planning',
      'Website Design & UX',
      'Website Development',
      'CMS Implementation',
      'Performance Assurance',
    ],
    budget: { low: 40000, high: 140000 },
    weeks: { low: 8, high: 20 },
    type: 'fixed_fee',
  },

  websiteRefresh: {
    name: 'Website Refresh',
    category: 'Website & App Development',
    includes: ['Design refresh on existing CMS'],
    budget: { low: 20000, high: 30000 },
    weeks: { low: 5, high: 8 },
    type: 'fixed_fee',
    note: 'For styling updates on existing CMS',
  },

  // -------------------------------------------------------------------------
  // PUBLIC RELATIONS & MEDIA
  // -------------------------------------------------------------------------
  prRetainer: {
    name: 'Public Relations Retainer',
    category: 'Public Relations & Media Outreach',
    bundle: 'Standard PR',
    includes: [
      'Media Relations',
      'Narrative & Media Messaging',
      'Media Monitoring',
      'Earned Media Strategy',
    ],
    budget: { low: 180000, high: 360000 },
    weeks: { low: 52, high: 52 },
    type: 'retainer',
    note: 'Annual retainer ($15K-$30K/month)',
  },

  crisisComms: {
    name: 'Crisis Communications',
    category: 'Public Relations & Media Outreach',
    bundle: 'Crises Comms',
    includes: ['Crises Plan Development', 'Crisis Communications'],
    budget: { low: 15000, high: 40000 },
    weeks: { low: 1, high: 6 },
    type: 'retainer',
  },

  // -------------------------------------------------------------------------
  // EXECUTIVE VISIBILITY & THOUGHT LEADERSHIP
  // -------------------------------------------------------------------------
  execVisibility: {
    name: 'Executive Visibility',
    category: 'Executive Visibility & Thought Leadership',
    bundle: 'Executive Visibility',
    includes: [
      'Executive Positioning Strategy',
      'Thought Leadership Content',
      'Byline & Op-Ed Development',
    ],
    budget: { low: 60000, high: 180000 },
    weeks: { low: 52, high: 52 },
    type: 'retainer',
    note: 'Annual retainer ($5K-$15K/month per executive)',
  },

  speakingPodcast: {
    name: 'Speaking & Podcast Strategy',
    category: 'Executive Visibility & Thought Leadership',
    includes: [
      'Speaking Opportunity Strategy',
      'Podcast Guest Strategy',
      'Awards Strategy',
    ],
    budget: { low: 15000, high: 40000 },
    weeks: { low: 4, high: 12 },
    type: 'fixed_fee',
  },

  // -------------------------------------------------------------------------
  // INFLUENCER MARKETING
  // -------------------------------------------------------------------------
  influencer: {
    name: 'Influencer Marketing',
    category: 'Influencer Marketing',
    bundle: 'Influencer Retainer',
    includes: [
      'Influencer Strategy',
      'Creator Identification & Vetting',
      'Influencer Campaign Management',
      'Ambassador Programs',
      'UGC Programs',
    ],
    budget: { low: 30000, high: 100000 },
    weeks: { low: 52, high: 52 },
    type: 'retainer',
    note: 'Annual retainer, excludes creator fees',
  },

  // -------------------------------------------------------------------------
  // CREATIVE PRODUCTION
  // -------------------------------------------------------------------------
  creativeRetainer: {
    name: 'Creative Production Retainer',
    category: 'Ongoing Creative Production',
    bundle: 'Creative Retainer',
    includes: [
      'Graphic Design',
      'Video Production',
      'Animation & Motion Graphics',
      'Photography',
      'Copywriting',
      'Social Media Content',
      'Campaign Asset Creation',
    ],
    budget: { low: 24000, high: 80000 },
    weeks: { low: 52, high: 52 },
    type: 'tm',
    note: 'Annual minimum commitment',
  },

  creativeCampaigns: {
    name: 'Creative Campaigns',
    category: 'Creative Campaigns & Innovation',
    bundle: 'Creative Campaigns',
    includes: [
      'Creative Platform Development',
      'Big Idea Generation',
      'Experiential Concepts',
    ],
    budget: { low: 18000, high: 30000 },
    weeks: { low: 2, high: 7 },
    type: 'fixed_fee',
  },

  // -------------------------------------------------------------------------
  // MARKETING STRATEGY
  // -------------------------------------------------------------------------
  marketingStrategy: {
    name: 'Marketing Strategy Development',
    category: 'Integrated Marketing Strategy',
    includes: ['Marketing Strategy Development'],
    budget: { low: 10000, high: 25000 },
    weeks: { low: 1, high: 4 },
    type: 'fixed_fee',
  },

  audienceResearch: {
    name: 'Audience Research & Segmentation',
    category: 'Integrated Marketing Strategy',
    includes: [
      'Audience Research & Segmentation',
      'Primary audience research',
      'Customer Journey Mapping',
    ],
    budget: { low: 7000, high: 35000 },
    weeks: { low: 1, high: 6 },
    type: 'fixed_fee',
  },

  competitiveResearch: {
    name: 'Market & Competitive Research',
    category: 'Integrated Marketing Strategy',
    includes: ['Market & Competitive Research'],
    budget: { low: 2000, high: 30000 },
    weeks: { low: 1, high: 2 },
    type: 'fixed_fee',
  },

  // -------------------------------------------------------------------------
  // SEO & GEO
  // -------------------------------------------------------------------------
  seoStrategy: {
    name: 'SEO Strategy',
    category: 'Search Engine Optimization',
    bundle: 'SEO Strategy',
    includes: [
      'SEO Strategy & Audit',
      'Technical SEO',
      'Critical SEO Assessment',
      'Content SEO Strategy',
    ],
    budget: { low: 20000, high: 35000 },
    weeks: { low: 4, high: 8 },
    type: 'fixed_fee',
    note: '6-month minimum recommended',
  },

  seoExecution: {
    name: 'SEO Execution',
    category: 'Search Engine Optimization',
    bundle: 'SEO Execution',
    includes: ['On-Page Optimization', 'Link Building', 'Local SEO'],
    budget: { low: 24000, high: 60000 },
    weeks: { low: 4, high: 12 },
    type: 'fixed_fee',
  },

  geoStrategy: {
    name: 'Generative Engine Optimization (GEO)',
    category: 'Generative Engine Optimization',
    bundle: 'GEO Strategy',
    includes: [
      'GEO Strategy & Audit',
      'Reddit Optimization',
      'Wikipedia Optimization',
      'Earned Strategy for GEO',
    ],
    budget: { low: 10000, high: 50000 },
    weeks: { low: 1, high: 6 },
    type: 'fixed_fee',
    note: 'Often bundled with SEO',
  },

  // -------------------------------------------------------------------------
  // SOCIAL MEDIA
  // -------------------------------------------------------------------------
  socialStrategy: {
    name: 'Social Media Strategy',
    category: 'Social Media',
    bundle: 'Social Media Strategy',
    includes: ['Social Media Strategy', 'Channel Planning'],
    budget: { low: 15000, high: 25000 },
    weeks: { low: 2, high: 6 },
    type: 'retainer',
  },

  socialExecution: {
    name: 'Social Media Execution',
    category: 'Social Media',
    bundle: 'Social Execution',
    includes: [
      'Channel Set Up',
      'Community Management',
      'Social creative',
      'Social Media Reporting',
    ],
    budget: { low: 10000, high: 20000 },
    weeks: { low: 1, high: 3 },
    type: 'retainer',
  },

  // -------------------------------------------------------------------------
  // PAID MEDIA
  // -------------------------------------------------------------------------
  paidStrategy: {
    name: 'Paid Media Strategy',
    category: 'Paid Media',
    bundle: 'Paid Media Strategy',
    includes: ['Paid Strategy'],
    budget: { low: 10000, high: 30000 },
    weeks: { low: 2, high: 6 },
    type: 'fixed_fee',
    note: 'Excludes media spend',
  },

  paidExecution: {
    name: 'Paid Media Execution',
    category: 'Paid Media',
    bundle: 'Paid Media Execution',
    includes: [
      'Campaign Setup & Management',
      'Audience Development & Targeting',
      'Ad Creative Development',
      'Paid Media Reporting',
    ],
    budget: { low: 10000, high: 100000 },
    weeks: { low: 4, high: 52 },
    type: 'fixed_fee',
  },

  // -------------------------------------------------------------------------
  // MEASUREMENT & ANALYTICS
  // -------------------------------------------------------------------------
  measurementStrategy: {
    name: 'Integrated Measurement Strategy',
    category: 'Measurement & Analytics',
    bundle: 'Integrated Measurement Strategy',
    includes: [
      'Analytics Strategy & Measurement Framework',
      'Integrated Dashboard Development',
      'Attribution Modeling',
      'Marketing ROI Framework',
      'KPI Development',
    ],
    budget: { low: 10000, high: 20000 },
    weeks: { low: 2, high: 4 },
    type: 'fixed_fee',
  },

  // -------------------------------------------------------------------------
  // CONTENT
  // -------------------------------------------------------------------------
  contentStrategy: {
    name: 'Content Strategy',
    category: 'Content Ideation & Production',
    bundle: 'Content Strategy',
    includes: ['Content Strategy', 'Content Calendar Development'],
    budget: { low: 15000, high: 30000 },
    weeks: { low: 2, high: 4 },
    type: 'fixed_fee',
  },

  contentProduction: {
    name: 'Content Production',
    category: 'Content Ideation & Production',
    bundle: 'Content Production',
    includes: [
      'Blog & Article Writing',
      'Podcast Production',
      'Video Content Series',
      'Thought Leadership Content',
    ],
    budget: { low: 3500, high: 8000 },
    weeks: { low: 1, high: 2 },
    type: 'fixed_fee',
    note: 'Per piece, T&M ongoing',
  },

  // -------------------------------------------------------------------------
  // TRAINING
  // -------------------------------------------------------------------------
  commsTraining: {
    name: 'Communications Training',
    category: 'Communications Training',
    bundle: 'Communications Training',
    includes: [
      'Media & Spokesperson Training',
      'Presentation Training',
      'Crisis Communications Training',
      'Brand Training',
    ],
    budget: { low: 20000, high: 50000 },
    weeks: { low: 2, high: 4 },
    type: 'fixed_fee',
    note: 'Per session or program',
  },

  // -------------------------------------------------------------------------
  // IMPACT & PURPOSE
  // -------------------------------------------------------------------------
  impactReporting: {
    name: 'Impact Reporting',
    category: 'Impact & Purpose Communications',
    bundle: 'Impact Reporting',
    includes: ['Impact Report Writing & Design'],
    budget: { low: 40000, high: 80000 },
    weeks: { low: 4, high: 12 },
    type: 'fixed_fee',
  },

  impactComms: {
    name: 'Impact Communications',
    category: 'Impact & Purpose Communications',
    bundle: 'Impact Communications',
    includes: [
      'Sustainability Communications Messaging',
      'Purpose Discovery Workshop',
    ],
    budget: { low: 15000, high: 20000 },
    weeks: { low: 3, high: 5 },
    type: 'fixed_fee',
  },

  // -------------------------------------------------------------------------
  // GO-TO-MARKET
  // -------------------------------------------------------------------------
  gtmStrategy: {
    name: 'Go-to-Market Strategy',
    category: 'Go-to-Market Strategy',
    bundle: 'GTM Strategy',
    includes: [
      'Go-to-Market Strategy',
      'Launch Planning',
      'Market Entry Strategy',
      'Channel Strategy',
      'Sales Enablement',
    ],
    budget: { low: 10000, high: 30000 },
    weeks: { low: 1, high: 3 },
    type: 'fixed_fee',
  },

  // -------------------------------------------------------------------------
  // EVENTS
  // -------------------------------------------------------------------------
  events: {
    name: 'Event Strategy & Production',
    category: 'Event Planning & Production',
    bundle: 'Event Strategy',
    includes: ['Event Strategy', 'Event Production', 'Event Marketing'],
    budget: { low: 10000, high: 100000 },
    weeks: { low: 4, high: 12 },
    type: 'fixed_fee',
    note: 'Excludes venue and vendor costs',
  },
};

// =============================================================================
// ATTRIBUTE → SERVICE MAPPING
// =============================================================================
// This is the key configuration that maps each Compass attribute to services.
// 
// Format for each attribute:
//   serviceKey: The key from SERVICES above
//   priority: 1 = highest priority, 2 = secondary, 3 = supporting
//   reason: Why this service helps (shown to user)
//   when: Conditions when this is especially relevant
//
// Edit the arrays below to change which services are recommended for each attribute.

export const ATTRIBUTE_MAPPINGS = {
  // ---------------------------------------------------------------------------
  // AWAKE - Influence & Narrative Leadership
  // "How well do you shape narratives and lead industry discourse?"
  // ---------------------------------------------------------------------------
  AWAKE: [
    {
      serviceKey: 'execVisibility',
      priority: 1,
      reason: 'Executive visibility and thought leadership directly builds industry influence',
      when: 'Always recommend when AWAKE < 55',
    },
    {
      serviceKey: 'prRetainer',
      priority: 1,
      reason: 'PR and media relations amplify voice and establish authority in industry conversations',
      when: 'Always recommend when AWAKE < 50',
    },
    {
      serviceKey: 'speakingPodcast',
      priority: 2,
      reason: 'Speaking engagements and awards build external validation',
      when: 'When looking to build thought leadership platform',
    },
    {
      serviceKey: 'influencer',
      priority: 2,
      reason: 'Influencer partnerships extend reach and third-party credibility',
      when: 'B2C or B2B2C brands seeking audience amplification',
    },
    {
      serviceKey: 'contentStrategy',
      priority: 2,
      reason: 'Consistent thought leadership content builds authority over time',
      when: 'When content gaps identified',
    },
    {
      serviceKey: 'contentProduction',
      priority: 3,
      reason: 'Ongoing content production sustains narrative leadership',
      when: 'Supporting service for ongoing engagement',
    },
  ],

  // ---------------------------------------------------------------------------
  // AWARE - Trust Building & Audience Understanding
  // "Do you understand audiences and build trust?"
  // ---------------------------------------------------------------------------
  AWARE: [
    {
      serviceKey: 'audienceResearch',
      priority: 1,
      reason: 'Deep audience research is foundational to understanding and connecting with target audiences',
      when: 'Always recommend when AWARE < 50',
    },
    {
      serviceKey: 'socialStrategy',
      priority: 1,
      reason: 'Social media is the primary channel for two-way audience engagement and trust building',
      when: 'When social presence is weak or inconsistent',
    },
    {
      serviceKey: 'socialExecution',
      priority: 2,
      reason: 'Community management builds ongoing trust through responsive engagement',
      when: 'When social strategy is in place but execution is lacking',
    },
    {
      serviceKey: 'geoStrategy',
      priority: 1,
      reason: 'GEO ensures brand appears accurately in AI search and community platforms like Reddit',
      when: 'When AI reputation shows gaps, inaccuracies, or community trust is an issue',
    },
    {
      serviceKey: 'marketingStrategy',
      priority: 2,
      reason: 'Strategic marketing planning ensures audience-centric approach across touchpoints',
      when: 'When marketing lacks audience focus',
    },
    {
      serviceKey: 'impactComms',
      priority: 3,
      reason: 'Purpose-driven communications build emotional trust and shared values',
      when: 'When brand purpose is unclear or not communicated',
    },
  ],

  // ---------------------------------------------------------------------------
  // REFLECTIVE - Authenticity & Reputation Management
  // "Do you have an authentic brand?"
  // ---------------------------------------------------------------------------
  REFLECTIVE: [
    {
      serviceKey: 'brandStrategy',
      priority: 1,
      reason: 'Brand strategy defines authentic foundation - the why, what, and how that drives everything',
      when: 'Always recommend when REFLECTIVE < 50',
    },
    {
      serviceKey: 'brandExpression',
      priority: 1,
      reason: 'Visual identity and tone of voice externalize internal brand truth consistently',
      when: 'When brand strategy is defined but expression is weak',
    },
    {
      serviceKey: 'brandArchitecture',
      priority: 1,
      reason: 'Clear brand hierarchy (single brand, house of brands, endorsed, sub-brand) eliminates confusion and builds coherent identity',
      when: 'When brand/product hierarchy is unclear, inconsistent, or confusing across touchpoints',
    },
    {
      serviceKey: 'crisisComms',
      priority: 2,
      reason: 'Crisis preparedness protects brand authenticity when challenges arise',
      when: 'When Glassdoor reviews show issues or reputation vulnerabilities exist',
    },
    {
      serviceKey: 'commsTraining',
      priority: 2,
      reason: 'Training ensures spokespeople authentically represent the brand',
      when: 'When executives need to represent brand externally',
    },
    {
      serviceKey: 'brandAssets',
      priority: 3,
      reason: 'Consistent brand assets ensure authentic expression across all touchpoints',
      when: 'When brand expression is defined but assets are lacking',
    },
    {
      serviceKey: 'impactReporting',
      priority: 3,
      reason: 'Impact reporting demonstrates authentic commitment to stated values',
      when: 'When sustainability/purpose claims need substantiation',
    },
  ],

  // ---------------------------------------------------------------------------
  // ATTENTIVE - Experience Quality & Excellence
  // "Do you deliver exceptional, consistent experiences?"
  // ---------------------------------------------------------------------------
  ATTENTIVE: [
    {
      serviceKey: 'websiteFull',
      priority: 1,
      reason: 'Website is often the primary brand experience - UX, design, and performance directly impact quality',
      when: 'When website shows UX issues or accessibility compliance is low',
    },
    {
      serviceKey: 'websiteRefresh',
      priority: 2,
      reason: 'A design refresh can address visual quality issues without full rebuild',
      when: 'When website is functional but visually dated, or budget is constrained',
    },
    {
      serviceKey: 'creativeRetainer',
      priority: 2,
      reason: 'Ongoing creative production ensures consistent quality across all brand materials',
      when: 'When quality inconsistency identified across touchpoints',
    },
    {
      serviceKey: 'measurementStrategy',
      priority: 2,
      reason: 'Measurement frameworks identify and track experience quality metrics',
      when: 'When quality issues exist but root causes unclear',
    },
    {
      serviceKey: 'brandAssets',
      priority: 3,
      reason: 'Brand guidelines ensure quality standards are maintained',
      when: 'When brand lacks documented standards',
    },
  ],

  // ---------------------------------------------------------------------------
  // COGENT - Strategic Intelligence & Data-Driven Marketing
  // "Is your marketing driven by strategic insights and data?"
  // ---------------------------------------------------------------------------
  COGENT: [
    {
      serviceKey: 'seoStrategy',
      priority: 1,
      reason: 'SEO strategy ensures findability and demonstrates data-driven approach to visibility',
      when: 'Always recommend when COGENT < 55 or SEO assessment shows gaps',
    },
    {
      serviceKey: 'measurementStrategy',
      priority: 1,
      reason: 'Measurement frameworks are foundational to data-driven marketing',
      when: 'When marketing lacks clear metrics or attribution',
    },
    {
      serviceKey: 'seoExecution',
      priority: 2,
      reason: 'SEO execution implements strategy for sustained findability',
      when: 'When SEO strategy is defined but execution is lacking',
    },
    {
      serviceKey: 'geoStrategy',
      priority: 1,
      reason: 'GEO ensures brand is accurately represented in AI-powered search and LLM outputs',
      when: 'When AI reputation shows brand is misrepresented, unknown, or inaccurately described',
    },
    {
      serviceKey: 'marketingStrategy',
      priority: 2,
      reason: 'Strategic marketing planning ensures data informs channel and audience decisions',
      when: 'When marketing approach lacks strategic foundation',
    },
    {
      serviceKey: 'paidStrategy',
      priority: 3,
      reason: 'Paid media strategy leverages data for targeted reach and optimization',
      when: 'When seeking to amplify reach with measurable ROI',
    },
    {
      serviceKey: 'competitiveResearch',
      priority: 3,
      reason: 'Competitive intelligence informs strategic positioning and differentiation',
      when: 'When competitive landscape is unclear',
    },
  ],

  // ---------------------------------------------------------------------------
  // SENTIENT - Creative Differentiation & Emotional Connection
  // "How well do you create emotional connections that inspire action?"
  // ---------------------------------------------------------------------------
  SENTIENT: [
    {
      serviceKey: 'creativeCampaigns',
      priority: 1,
      reason: 'Big idea development creates breakthrough creative that drives emotional connection',
      when: 'Always recommend when SENTIENT < 55 or brand feels generic',
    },
    {
      serviceKey: 'brandExpression',
      priority: 1,
      reason: 'Visual identity and manifesto create distinctive emotional resonance',
      when: 'When brand lacks distinctive creative expression',
    },
    {
      serviceKey: 'creativeRetainer',
      priority: 2,
      reason: 'Ongoing creative production maintains emotional engagement across touchpoints',
      when: 'When creative quality is inconsistent',
    },
    {
      serviceKey: 'contentStrategy',
      priority: 2,
      reason: 'Content strategy ensures storytelling creates sustained emotional connection',
      when: 'When content lacks emotional resonance',
    },
    {
      serviceKey: 'contentProduction',
      priority: 3,
      reason: 'Quality content production brings emotional stories to life',
      when: 'When strategy exists but production quality is lacking',
    },
    {
      serviceKey: 'events',
      priority: 3,
      reason: 'Experiential events create memorable emotional brand experiences',
      when: 'When seeking high-impact emotional touchpoints',
    },
  ],

  // ---------------------------------------------------------------------------
  // VISIONARY - Purpose & Aspiration
  // "Do you express a clear, compelling vision for the future?"
  // ---------------------------------------------------------------------------
  VISIONARY: [
    {
      serviceKey: 'brandStrategy',
      priority: 1,
      reason: 'Brand positioning and purpose work defines the aspirational vision',
      when: 'Always recommend when VISIONARY < 55 or brand purpose is unclear',
    },
    {
      serviceKey: 'impactComms',
      priority: 1,
      reason: 'Purpose discovery and sustainability communications articulate visionary commitments',
      when: 'When brand lacks clear purpose narrative',
    },
    {
      serviceKey: 'execVisibility',
      priority: 2,
      reason: 'Executive thought leadership communicates visionary perspectives to market',
      when: 'When vision exists but lacks external amplification',
    },
    {
      serviceKey: 'contentStrategy',
      priority: 2,
      reason: 'Content strategy ensures visionary narrative is consistently communicated',
      when: 'When vision exists but content doesn\'t reflect it',
    },
    {
      serviceKey: 'gtmStrategy',
      priority: 3,
      reason: 'Go-to-market strategy translates vision into market action',
      when: 'When launching new products/services or entering new markets',
    },
    {
      serviceKey: 'impactReporting',
      priority: 3,
      reason: 'Impact reporting demonstrates progress toward visionary goals',
      when: 'When stakeholders need evidence of purpose in action',
    },
  ],

  // ---------------------------------------------------------------------------
  // INTENTIONAL - Professionalism & Strategic Positioning
  // "Do you show up with substance, confidence, and leadership?"
  // ---------------------------------------------------------------------------
  INTENTIONAL: [
    {
      serviceKey: 'brandStrategy',
      priority: 1,
      reason: 'Strategic brand positioning demonstrates intentional market approach',
      when: 'Always recommend when INTENTIONAL < 50 or positioning is unclear',
    },
    {
      serviceKey: 'brandAssets',
      priority: 1,
      reason: 'Brand guidelines ensure professional, consistent execution everywhere',
      when: 'When brand lacks documented standards or WIPO protection is missing',
    },
    {
      serviceKey: 'brandArchitecture',
      priority: 1,
      reason: 'Defined brand architecture demonstrates strategic sophistication and professional brand management',
      when: 'When brand/product/sub-brand relationships are confusing or inconsistently presented',
    },
    {
      serviceKey: 'websiteFull',
      priority: 2,
      reason: 'Professional website signals intentional, serious market presence',
      when: 'When website appears unprofessional or dated',
    },
    {
      serviceKey: 'commsTraining',
      priority: 2,
      reason: 'Training ensures intentional, professional brand representation',
      when: 'When spokespeople need to represent brand at high-profile moments',
    },
    {
      serviceKey: 'measurementStrategy',
      priority: 2,
      reason: 'Measurement demonstrates intentional, accountable approach to marketing',
      when: 'When marketing investment lacks clear ROI framework',
    },
    {
      serviceKey: 'gtmStrategy',
      priority: 3,
      reason: 'Go-to-market planning shows intentional approach to market entry',
      when: 'When launching or expanding',
    },
  ],
};

// =============================================================================
// HELPER FUNCTIONS (don't edit unless you know what you're doing)
// =============================================================================

/**
 * Get service recommendations for an attribute based on score
 */
export function getRecommendationsForAttribute(attributeId, score) {
  const mappings = ATTRIBUTE_MAPPINGS[attributeId];
  if (!mappings) return [];

  // Determine what level of recommendations to include
  let maxPriority;
  if (score < THRESHOLDS.CRITICAL) {
    maxPriority = 3; // Include all
  } else if (score < THRESHOLDS.MODERATE) {
    maxPriority = 2; // Priority 1 and 2
  } else if (score < THRESHOLDS.OPPORTUNITY) {
    maxPriority = 1; // Priority 1 only
  } else {
    return []; // Score is good, no recommendations
  }

  return mappings
    .filter(m => m.priority <= maxPriority)
    .map(m => ({
      ...m,
      service: SERVICES[m.serviceKey],
      priorityLevel: score < THRESHOLDS.CRITICAL ? 'critical' : 
                     score < THRESHOLDS.MODERATE ? 'moderate' : 'opportunity',
    }))
    .sort((a, b) => a.priority - b.priority);
}

/**
 * Get all recommendations across all attributes, deduplicated
 * Ensures diversity: max 4 services from any single attribute in the top 6
 * @param {Object} scores - The scores object with attribute scores
 * @param {Object} options - Optional configuration
 * @param {Array} options.forceIncludeServices - Service keys to force into top 6 (e.g., for GEO when AI issues detected)
 */
export function getAllRecommendations(scores, options = {}) {
  const { forceIncludeServices = [] } = options;
  const allRecs = [];
  const seenServices = new Set();

  // Process attributes in order of lowest score first
  const sortedAttrs = Object.entries(scores)
    .filter(([key, val]) => val && typeof val.score === 'number')
    .sort((a, b) => a[1].score - b[1].score);

  for (const [attrId, attrData] of sortedAttrs) {
    const recs = getRecommendationsForAttribute(attrId, attrData.score);
    for (const rec of recs) {
      if (!seenServices.has(rec.serviceKey)) {
        seenServices.add(rec.serviceKey);
        allRecs.push({
          ...rec,
          attributeId: attrId,
          attributeScore: attrData.score,
        });
      }
    }
  }

  // Find force-include services that aren't already in recommendations
  // Add them from COGENT attribute mapping if they exist
  for (const serviceKey of forceIncludeServices) {
    if (!seenServices.has(serviceKey)) {
      const service = SERVICES[serviceKey];
      if (service) {
        // Find which attribute this service is mapped to (prefer COGENT for GEO)
        const cogentScore = scores.COGENT?.score || 50;
        allRecs.unshift({
          serviceKey,
          service,
          priority: 1,
          reason: 'AI reputation assessment identified issues requiring this service',
          when: 'AI reputation shows gaps or inaccuracies',
          attributeId: 'COGENT',
          attributeScore: cogentScore,
          priorityLevel: 'critical',
          forceIncluded: true,
        });
        seenServices.add(serviceKey);
      }
    }
  }

  // Ensure diversity in top 6: max 4 from any single attribute
  const diverseTop6 = [];
  const attrCounts = {};
  const MAX_PER_ATTR = 4;
  
  // First, add any force-included services
  for (const rec of allRecs) {
    if (rec.forceIncluded && diverseTop6.length < 6) {
      diverseTop6.push(rec);
      attrCounts[rec.attributeId] = (attrCounts[rec.attributeId] || 0) + 1;
    }
  }
  
  // Then fill remaining slots with diversity constraint
  for (const rec of allRecs) {
    if (diverseTop6.length >= 6) break;
    if (rec.forceIncluded) continue; // Already added
    
    const count = attrCounts[rec.attributeId] || 0;
    if (count < MAX_PER_ATTR) {
      diverseTop6.push(rec);
      attrCounts[rec.attributeId] = count + 1;
    }
  }
  
  // If we couldn't fill 6, add remaining recs that were skipped
  if (diverseTop6.length < 6) {
    for (const rec of allRecs) {
      if (diverseTop6.length >= 6) break;
      if (!diverseTop6.includes(rec)) {
        diverseTop6.push(rec);
      }
    }
  }
  
  // Return diversified top 6 plus remaining recs
  const remaining = allRecs.filter(r => !diverseTop6.includes(r));
  return [...diverseTop6, ...remaining];
}

/**
 * Analyze AI reputation synthesis text to determine if GEO should be force-included
 * Returns array of service keys to force-include
 */
export function getForceIncludeServicesFromAIReputation(aiReputationSynthesis) {
  if (!aiReputationSynthesis) return [];
  
  const forceInclude = [];
  const text = aiReputationSynthesis.toLowerCase();
  
  // Keywords that indicate GEO should be recommended
  const geoTriggerKeywords = [
    'wikipedia absence',
    'wikipedia gap',
    'no wikipedia',
    'lacks wikipedia',
    'missing wikipedia',
    'reddit',
    'name confusion',
    'disambiguation',
    'ai discoverability',
    'digital presence gap',
    'digital presence weak',
    'knowledge panel',
    'ai systems cannot',
    'ai systems struggle',
    'misrepresented',
    'inaccurately described',
    'ai representation',
    'search result prominence',
    'ai training data',
  ];
  
  const hasGeoTrigger = geoTriggerKeywords.some(keyword => text.includes(keyword));
  
  if (hasGeoTrigger) {
    forceInclude.push('geoStrategy');
  }
  
  return forceInclude;
}

/**
 * Format budget for display
 */
export function formatBudget(service) {
  if (!service?.budget) return 'Contact for pricing';
  const { low, high } = service.budget;
  const fmt = n => n >= 1000 ? `$${(n / 1000).toFixed(0)}K` : `$${n}`;
  return `${fmt(low)} - ${fmt(high)}`;
}

/**
 * Format term for display
 */
export function formatTerm(service) {
  if (!service?.weeks) return '';
  const { low, high } = service.weeks;
  if (low === 52 && high === 52) return 'Annual';
  if (low === high) return `${low} weeks`;
  return `${low}-${high} weeks`;
}
