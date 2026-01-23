import React, { useState, useCallback } from 'react';
import { Upload, FileText, CheckCircle, AlertTriangle, AlertCircle, Loader2, ChevronDown, ChevronRight, Key, Eye, EyeOff, ArrowUpRight, Copy, Check, ArrowRight, Download, Sparkles, PenTool, Search, MessageSquare, Lightbulb, Target, Users, ChevronLeft } from 'lucide-react';

// ============================================================================
// SERVICE TRIGGER MAPPINGS
// ============================================================================
const SERVICE_TRIGGERS = [
  {
    id: 'awareness',
    triggers: ['need awareness', 'brand awareness', 'nobody knows us', 'increase visibility', 'get our name out', 'build awareness'],
    category: 'Awareness & Reach',
    services: [
      'Performance Marketing (Paid Media)',
      'SEO Strategy & Implementation',
      'Measurement & Analytics Framework',
      'Thought Leadership Program',
      'Executive Visibility Campaign',
      'Media Outreach & Relations'
    ],
    description: 'Build awareness through paid and earned channels'
  },
  {
    id: 'reputation',
    triggers: ['problem with reputation', 'reputation issue', 'reputation management', 'negative perception', 'trust issues', 'credibility problem', 'people don\'t believe us', 'not credible'],
    category: 'Reputation & Trust',
    services: [
      'Brand Compass Assessment',
      'GEO (Generative Engine Optimization)',
      'Wikipedia Optimization',
      'Reddit & Community Optimization',
      'Media Messaging Development',
      'Media Outreach & Relations',
      'Impact Communications Training',
      'Impact Report Design & Writing',
      'Purpose Discovery Workshop',
      'Theory of Change Development'
    ],
    description: 'Address reputation challenges and build credibility'
  },
  {
    id: 'influence',
    triggers: ['greater influence', 'visibility in our sector', 'industry influence', 'thought leader', 'landscape visibility', 'sector leadership', 'policy influence'],
    category: 'Influence & Authority',
    services: [
      'Original Research & Studies',
      'Strategic Media Relations',
      'Content Ecosystem Development',
      'Convening & Events Strategy',
      'Policy Communications',
      'Strategic Partnerships',
      'Awards Program Strategy',
      'Influencer Marketing'
    ],
    description: 'Establish authority and influence in your sector'
  },
  {
    id: 'audience',
    triggers: ['struggling to reach', 'identify our audiences', 'audience identification', 'who are our customers', 'target audience', 'reach the right people', 'look at our reputation'],
    category: 'Audience Strategy',
    services: [
      'Reputation Strategy',
      'Content Marketing & Storytelling',
      'Creative Platform Development',
      'Community Management',
      'Sustainability & Impact Communications',
      'Brand Consistency Audit',
      'Connections Plan',
      'Influencer Marketing'
    ],
    description: 'Identify and connect with your target audiences'
  },
  {
    id: 'brand',
    triggers: ['not found our voice', 'brand is uninspiring', 'brand is confused', 'badly structured', 'marketing is disjointed', 'don\'t know who we are', 'look and feel is stale', 'more differentiated', 'no clear foundation', 'brand identity', 'rebrand', 'brand refresh'],
    category: 'Brand & Identity',
    services: [
      'Rapid Discovery Workshop',
      'Brand Strategy Development',
      'Brand Hierarchy & Architecture',
      'Visual Identity System',
      'Brand Guidelines',
      'Website Refresh or Rebuild'
    ],
    description: 'Define or refresh your brand foundation'
  },
  {
    id: 'messaging',
    triggers: ['coherent message for media', 'don\'t know what stories to tell', 'media messaging', 'pr messaging', 'press messaging', 'journalist outreach', 'earned media'],
    category: 'PR & Media Messaging',
    services: [
      'Earned Media/PR Messaging',
      'Key Message Development',
      'Spokesperson Training',
      'Media Kit Development',
      'Press Release Strategy'
    ],
    description: 'Develop compelling media narratives'
  },
  {
    id: 'content',
    triggers: ['issues with our content', 'content is poor', 'content is bad', 'content is awful', 'not consistent', 'lacks coherent theme', 'content quality', 'content problems', 'content inconsistent'],
    category: 'Content & Quality',
    services: [
      'Content Strategy & Planning',
      'Integrated Campaign Development',
      'Style Guide Creation',
      'QA & Proofreading Services',
      'Digital Asset Management',
      'Project Management',
      'Channel Optimization',
      'Content Training',
      'Website Content Refresh'
    ],
    description: 'Improve content quality and consistency'
  },
  {
    id: 'leads',
    triggers: ['need leads', 'need conversions', 'content to work better', 'content not targeted', 'problem with conversion', 'problem with targeting', 'problem with engagement', 'extend our reach', 'target new audiences', 'lead generation', 'demand gen'],
    category: 'Performance & Conversion',
    services: [
      'Audience Research & Segmentation',
      'Analytics Infrastructure',
      'Customer Journey Mapping',
      'Strategic Planning',
      'Media Strategy',
      'SEO Optimization',
      'Marketing Automation',
      'A/B Testing Program',
      'Attribution Modeling',
      'Website UX & Design Refresh'
    ],
    description: 'Drive leads, conversions, and engagement'
  },
  {
    id: 'creative',
    triggers: ['marketing is uninspiring', 'creative is ineffective', 'engagement is low', 'cut through the noise', 'breakthrough ideas', 'inspire our audiences', 'campaigns are dull', 'campaigns are safe', 'innovation leader', 'make technical interesting', 'inspire action', 'stunts'],
    category: 'Creative & Innovation',
    services: [
      'Creative Strategy',
      'Big Ideas & Concept Development',
      'Storytelling Framework',
      'Copywriting Excellence',
      'Visual & Design Innovation',
      'Video Production',
      'Experiential Design',
      'Website Experience Redesign'
    ],
    description: 'Create breakthrough creative work'
  },
  {
    id: 'impact',
    triggers: ['don\'t believe us', 'not credible', 'service makes the world better', 'product makes lives better', 'impact story', 'sustainability story', 'esg communications', 'purpose driven'],
    category: 'Impact & Purpose',
    services: [
      'Impact Communications Training',
      'Impact Report Design & Writing',
      'Purpose Discovery Workshop',
      'Vision Development',
      'Theory of Change',
      'Impact Measurement Framework',
      'Creative Content Creation',
      'Manifesto Writing'
    ],
    description: 'Communicate your impact and purpose'
  },
  {
    id: 'leadership',
    triggers: ['leadership is invisible', 'credibility problem', 'inspiring leaders', 'audiences don\'t know them', 'communications is timid', 'lacks confidence', 'ceo needs visibility', 'executive visibility', 'ceo profile', 'leadership profile', 'apologetic'],
    category: 'Executive & Leadership',
    services: [
      'Executive Positioning Strategy',
      'Media Training',
      'Executive Social Media',
      'Media Relations',
      'Bylines & Op-Eds',
      'Analyst Relations',
      'Messaging Architecture',
      'Awards Strategy',
      'Speaking Strategy',
      'Crisis Preparedness'
    ],
    description: 'Elevate leadership visibility and credibility'
  }
];

// ============================================================================
// ENGAGEMENT TYPES FOR DRAFTING
// ============================================================================
const DRAFT_ENGAGEMENT_TYPES = [
  { value: 'fixed_fee', label: 'Fixed Fee', description: 'Set price for defined deliverables' },
  { value: 'tm_cap', label: 'Time & Materials with Cap', description: 'Hourly billing with maximum budget' },
  { value: 'tm', label: 'Time & Materials', description: 'Hourly billing without cap' },
  { value: 'retainer', label: 'Retainer', description: 'Ongoing monthly engagement' }
];

// ============================================================================
// REVIEW ENGAGEMENT TYPES (existing)
// ============================================================================
const REVIEW_ENGAGEMENT_TYPES = [
  { value: 'branding', label: 'Branding', description: 'Brand strategy, identity, guidelines' },
  { value: 'website', label: 'Website', description: 'Web design, development, CMS' },
  { value: 'pr_comms', label: 'PR / Communications', description: 'Media relations, thought leadership' },
  { value: 'creative_retainer', label: 'Creative Retainer', description: 'Ongoing creative support' },
  { value: 'integrated', label: 'Integrated', description: 'Multi-service campaigns' }
];

// ============================================================================
// ASSESSMENT FRAMEWORK (for review flow)
// ============================================================================
const ASSESSMENT_FRAMEWORK = `
# SOW Assessment Framework

## Reference Standards by Engagement Type
- Branding: Switch Energy Alliance SOW (R1000)
- Website: Echogen SOW  
- Integrated: DER Coalition SOW (R9278)
- Creative Retainers: Integrated Creative & Strategic Support Retainer
- PR/Comms: TerraPower UK PR Support SOW

## Part 1: Universal Requirements (Apply to ALL SOWs)

### 1.1 Document Structure and Numbering
- Must use decimal numbering (5.1, 5.1.1, 5.1.1.1) NOT bullet points
- Every deliverable, activity, output, assumption must have unique reference number

### 1.2 Completion Criteria
- Every deliverable must have explicit completion trigger
- Acceptable: approval-based, output-based, time-based, gate-based
- Must have stage gates requiring approval before subsequent phases

### 1.3 Controlled Language - RED FLAGS TO IDENTIFY
Search for and flag these phrases. When replacing, prefer "UP TO" language (e.g., "up to 4 hours per month") rather than exact quantification. This provides flexibility while still setting boundaries.

- "ad hoc" → replace with bounded support (e.g., "up to 4 hours per month of support")
- "ongoing" → add term limits or define cadence (e.g., "for up to 12 months")
- "as and when" → specify triggers or quantities with caps
- "as needed" → define scope boundaries with maximums
- "various" → enumerate specific items with counts
- "regular" → specify frequency (e.g., "weekly" or "up to 2 times per week")
- "continuous" → define iterations or rounds (e.g., "up to 2 rounds of revisions")
- "flexible" → add parameters with upper bounds
- "unlimited" → NEVER use, always specify cap with "up to"
- "best efforts" → define measurable success criteria
- "reasonable" → quantify with "up to" bounds where possible
- "mutually agreed" without default → specify default window (e.g., "up to 5 business days")

### 1.4 Deliverable Structure
Each deliverable MUST include:
- Activities: What Agency will DO (active voice: "Agency will...")
- Outputs: What Agency will PRODUCE (use "1x" notation with quantities)
- Assumptions: Conditions that must be true for scope/fee to hold

### 1.5 Objectives and Value Articulation
- Must state business outcomes, NOT just activities
- Good: "Establish brand hierarchy and align stakeholders"
- Bad: "Conduct brand workshop"

## Part 2: Client Responsibilities (MUST be present)

### 2.1 Consolidated Feedback Requirement
MUST include language: "Client agrees to consolidate all internal feedback before submission to Agency. Feedback must represent unified organizational direction; Agency is not responsible for reconciling conflicting stakeholder input."

### 2.2 Approval Windows
MUST specify: "Client commits to providing feedback within [X] business days of deliverable submission. Deliverables not rejected within this window shall be deemed approved."

### 2.3 Change Control
MUST include: "Any change to scope, timeline, or budget requires mutual written agreement via change order. Agency may decline changes that compromise quality or timeline."

### 2.4 Stakeholder Protection
Include default language: "Agency will interface with a maximum of [X] client stakeholders for feedback purposes. Additional stakeholders require scope adjustment."

## Part 3: Master Assumptions (MUST appear somewhere)

### 3.1 Scope Boundaries
- Explicit statement of what is NOT included
- "This SOW does not include..." section

### 3.2 Revision/Iteration Limits
MUST specify rounds: "Up to [X] rounds of revisions included. Additional rounds at prevailing rates."

### 3.3 Response Time Expectations
Client response times must be defined for:
- Feedback on deliverables
- Approval of materials
- Provision of required inputs

### 3.4 Pause/Termination Ladder
Include provision: "If Client delays exceed [X] business days, Agency reserves right to [pause work / adjust timeline / invoice for work completed]."

## Part 4: Service-Line Specific Requirements

### 4.1 Branding Projects
- Brand architecture/hierarchy explicitly addressed
- Stakeholder alignment sessions defined
- Asset formats and file deliverables listed
- Guidelines scope (what's covered, what's not)

### 4.2 Website Projects
- Technical requirements (CMS, hosting, etc.)
- Content responsibility clearly assigned
- Browser/device compatibility defined
- Post-launch support period specified
- Training deliverables included

### 4.3 PR/Communications
- Media target list scope defined
- Pitch quantities or cadence specified
- Reporting frequency and metrics defined
- Spokesperson preparation included

### 4.4 Creative Retainers
- Monthly hour allocation clearly stated
- Rollover policy defined
- Utilization reporting specified
- Rate card for overage included

### 4.5 Integrated/Multi-Service
- Workstream dependencies mapped
- Cross-functional coordination specified
- Integrated timeline with milestones
- Single point of accountability identified
`;

// ============================================================================
// COMPONENTS
// ============================================================================

// Antenna Group Logo
function AntennaLogo({ className = "h-8" }) {
  return (
    <img 
      src="https://ktuyiikwhspwmzvyczit.supabase.co/storage/v1/object/public/assets/brand/antenna-new-logo.svg" 
      alt="Antenna Group" 
      className={className}
    />
  );
}

// Collapsible Section
function CollapsibleSection({ title, children, defaultOpen = false, icon: Icon, count, variant }) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  
  const variants = {
    critical: { header: 'bg-red-50 hover:bg-red-100', badge: 'bg-red-600 text-white', icon: 'text-red-600' },
    recommended: { header: 'bg-amber-50 hover:bg-amber-100', badge: 'bg-amber-600 text-white', icon: 'text-amber-600' },
    default: { header: 'bg-gray-50 hover:bg-gray-100', badge: 'bg-gray-900 text-white', icon: 'text-gray-900' }
  };
  
  const style = variants[variant] || variants.default;
  
  return (
    <div className="border border-gray-200 rounded-xl mb-3 overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full px-5 py-4 ${style.header} flex items-center justify-between transition-colors`}
      >
        <div className="flex items-center gap-3">
          {isOpen ? <ChevronDown className="w-4 h-4 text-gray-900" /> : <ChevronRight className="w-4 h-4 text-gray-900" />}
          {Icon && <Icon className={`w-5 h-5 ${style.icon}`} />}
          <span className="font-semibold text-gray-900">{title}</span>
          {count !== undefined && (
            <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${style.badge}`}>
              {count}
            </span>
          )}
        </div>
      </button>
      {isOpen && (
        <div className="p-5 bg-white border-t border-gray-100">
          {children}
        </div>
      )}
    </div>
  );
}

// Copy Button
function CopyButton({ text, className = "" }) {
  const [copied, setCopied] = useState(false);
  
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };
  
  return (
    <button
      onClick={handleCopy}
      className={`p-1.5 rounded-md transition-all ${
        copied 
          ? 'bg-green-600 text-white' 
          : 'bg-white/60 text-gray-500 hover:bg-white hover:text-gray-900'
      } ${className}`}
    >
      {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

// Issue Card for Review
function IssueCard({ issue, type }) {
  const styles = {
    critical: { bg: 'bg-red-50 border-red-200', icon: 'text-red-600', Icon: AlertCircle },
    recommended: { bg: 'bg-amber-50 border-amber-200', icon: 'text-amber-600', Icon: AlertTriangle },
    info: { bg: 'bg-gray-50 border-gray-200', icon: 'text-gray-900', Icon: CheckCircle }
  };
  
  const { bg, icon, Icon } = styles[type] || styles.info;

  const parseIssue = (text) => {
    const result = { section: null, currentLanguage: null, recommendation: null };
    const sectionMatch = text.match(/(?:Section|§)\s*([\d.]+)/i);
    if (sectionMatch) result.section = sectionMatch[1];
    const currentMatch = text.match(/(?:Current(?:\s+language)?|Found|Issue):\s*[""]?([^""]+)[""]?/i);
    if (currentMatch) result.currentLanguage = currentMatch[1].trim();
    const recommendedMatch = text.match(/(?:Recommended(?:\s+(?:language|replacement))?|Replace\s+with|Suggested|Should\s+be|Change\s+to):\s*[""]?([^""]+)[""]?/i);
    if (recommendedMatch) result.recommendation = recommendedMatch[1].trim();
    const arrowMatch = text.match(/[""]([^""]+)[""]\s*[→→>-]+\s*[""]([^""]+)[""]/);
    if (arrowMatch) {
      result.currentLanguage = arrowMatch[1].trim();
      result.recommendation = arrowMatch[2].trim();
    }
    return result;
  };

  const parsed = parseIssue(issue);
  const hasStructuredRecommendation = parsed.currentLanguage && parsed.recommendation;

  return (
    <div className={`p-4 rounded-xl border ${bg} mb-3`}>
      <div className="flex items-start gap-3">
        <Icon className={`w-5 h-5 mt-0.5 flex-shrink-0 ${icon}`} />
        <div className="flex-1">
          {parsed.section && (
            <span className="inline-block text-xs font-mono bg-white/60 px-2 py-0.5 rounded mb-2 text-gray-500">
              Section {parsed.section}
            </span>
          )}
          {hasStructuredRecommendation ? (
            <div className="space-y-3">
              <p className="text-sm text-gray-900 leading-relaxed">
                {issue.split(/(?:Current|Recommended|Replace|→)/i)[0].trim()}
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <div className="bg-white/50 rounded-lg p-3 border border-red-200">
                  <p className="text-xs font-semibold text-red-600 uppercase tracking-wide mb-1">Current</p>
                  <p className="text-sm text-gray-900 font-mono leading-relaxed">"{parsed.currentLanguage}"</p>
                </div>
                <div className="bg-white/50 rounded-lg p-3 border border-green-200 relative">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs font-semibold text-green-600 uppercase tracking-wide">Recommended</p>
                    <CopyButton text={parsed.recommendation} />
                  </div>
                  <p className="text-sm text-gray-900 font-mono leading-relaxed">"{parsed.recommendation}"</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-sm whitespace-pre-wrap text-gray-900 leading-relaxed">{issue}</div>
          )}
        </div>
      </div>
    </div>
  );
}

// Red Flag Card
function RedFlagCard({ flag }) {
  const parseRedFlag = (text) => {
    const arrowMatch = text.match(/[""]([^""]+)[""]\s*(?:in\s+)?(?:Section\s+)?([\d.]*)\s*[→→>-]+\s*[""]([^""]+)[""]/i);
    if (arrowMatch) {
      return { found: arrowMatch[1].trim(), section: arrowMatch[2] || null, replacement: arrowMatch[3].trim() };
    }
    const simpleArrow = text.match(/[""]([^""]+)[""]\s*[→→>-]+\s*[""]([^""]+)[""]/);
    if (simpleArrow) {
      const sectionMatch = text.match(/Section\s+([\d.]+)/i);
      return { found: simpleArrow[1].trim(), section: sectionMatch ? sectionMatch[1] : null, replacement: simpleArrow[2].trim() };
    }
    return null;
  };

  const parsed = parseRedFlag(flag);

  if (parsed) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 mb-3">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 mt-0.5 flex-shrink-0 text-amber-600" />
          <div className="flex-1">
            {parsed.section && (
              <span className="inline-block text-xs font-mono bg-white/60 px-2 py-0.5 rounded mb-2 text-gray-500">
                Section {parsed.section}
              </span>
            )}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1 bg-red-50 border border-red-200 px-3 py-1.5 rounded-lg">
                <span className="text-xs text-red-600 font-medium">Found:</span>
                <span className="text-sm font-mono text-gray-900">"{parsed.found}"</span>
              </span>
              <ArrowRight className="w-4 h-4 text-gray-400" />
              <span className="inline-flex items-center gap-1 bg-white border border-green-200 px-3 py-1.5 rounded-lg">
                <span className="text-xs text-green-600 font-medium">Replace:</span>
                <span className="text-sm font-mono text-gray-900">"{parsed.replacement}"</span>
                <CopyButton text={parsed.replacement} className="ml-1" />
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 mb-3">
      <div className="flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 mt-0.5 flex-shrink-0 text-amber-600" />
        <div className="text-sm whitespace-pre-wrap text-gray-900 leading-relaxed">{flag}</div>
      </div>
    </div>
  );
}

// API Key Input
function ApiKeyInput({ apiKey, setApiKey }) {
  const [showKey, setShowKey] = useState(false);
  
  return (
    <div className="mb-8">
      <label className="block text-sm font-semibold text-gray-900 mb-2">
        <div className="flex items-center gap-2">
          <Key className="w-4 h-4" />
          Anthropic API Key
        </div>
      </label>
      <div className="relative">
        <input
          type={showKey ? 'text' : 'password'}
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="sk-ant-api03-..."
          className="w-full px-4 py-3 pr-12 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-gray-900 outline-none transition-all text-gray-900 placeholder:text-gray-400"
        />
        <button
          type="button"
          onClick={() => setShowKey(!showKey)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-900 transition-colors"
        >
          {showKey ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
        </button>
      </div>
      <p className="mt-2 text-sm text-gray-500">
        Your API key is only used in your browser and never stored.
        Get one at <a href="https://console.anthropic.com/" target="_blank" rel="noopener noreferrer" className="text-gray-900 underline hover:no-underline">console.anthropic.com</a>
      </p>
    </div>
  );
}

// Service Selection Card
function ServiceCard({ trigger, isSelected, selectedServices, onToggleService }) {
  const [isExpanded, setIsExpanded] = useState(true);
  const selectedCount = trigger.services.filter(s => selectedServices.includes(s)).length;
  
  return (
    <div className={`border-2 rounded-xl overflow-hidden transition-all ${isSelected ? 'border-gray-900 bg-gray-50' : 'border-gray-200'}`}>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-5 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          <div className="text-left">
            <p className="font-semibold text-gray-900">{trigger.category}</p>
            <p className="text-sm text-gray-500">{trigger.description}</p>
          </div>
        </div>
        {selectedCount > 0 && (
          <span className="px-2.5 py-1 bg-gray-900 text-white text-xs rounded-full font-medium">
            {selectedCount} selected
          </span>
        )}
      </button>
      {isExpanded && (
        <div className="px-5 pb-4 border-t border-gray-100 pt-3">
          <div className="space-y-2">
            {trigger.services.map((service) => (
              <label key={service} className="flex items-center gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={selectedServices.includes(service)}
                  onChange={() => onToggleService(service)}
                  className="w-4 h-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900"
                />
                <span className="text-sm text-gray-700 group-hover:text-gray-900">{service}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// MAIN APP COMPONENT
// ============================================================================
export default function App() {
  // Navigation state
  const [currentView, setCurrentView] = useState('home'); // 'home', 'draft', 'review'
  
  // Shared state
  const [apiKey, setApiKey] = useState('');
  
  // Draft SOW state
  const [draftNotes, setDraftNotes] = useState('');
  const [draftEngagementType, setDraftEngagementType] = useState('');
  const [transcript, setTranscript] = useState('');
  const [isAnalyzingTranscript, setIsAnalyzingTranscript] = useState(false);
  const [transcriptAnalysis, setTranscriptAnalysis] = useState(null);
  const [detectedTriggers, setDetectedTriggers] = useState([]);
  const [selectedServices, setSelectedServices] = useState([]);
  const [isGeneratingDraft, setIsGeneratingDraft] = useState(false);
  const [generatedSOW, setGeneratedSOW] = useState(null);
  const [draftError, setDraftError] = useState(null);
  
  // Review SOW state
  const [file, setFile] = useState(null);
  const [fileContent, setFileContent] = useState(null);
  const [reviewEngagementType, setReviewEngagementType] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [error, setError] = useState(null);
  const [rawResponse, setRawResponse] = useState('');
  const [isDrafting, setIsDrafting] = useState(false);
  const [draftedSOW, setDraftedSOW] = useState(null);
  const [reviewDraftError, setReviewDraftError] = useState(null);

  // ============================================================================
  // DRAFT SOW FUNCTIONS
  // ============================================================================
  
  const analyzeTranscript = async () => {
    if (!apiKey || !transcript.trim()) return;
    
    setIsAnalyzingTranscript(true);
    setDraftError(null);
    setTranscriptAnalysis(null);
    setDetectedTriggers([]);
    
    try {
      // First, detect triggers locally
      const transcriptLower = transcript.toLowerCase();
      const detected = SERVICE_TRIGGERS.filter(trigger => 
        trigger.triggers.some(t => transcriptLower.includes(t.toLowerCase()))
      );
      setDetectedTriggers(detected);
      
      // Auto-select all services from detected triggers
      const autoSelectedServices = detected.flatMap(t => t.services);
      setSelectedServices([...new Set(autoSelectedServices)]);
      
      // Then use AI to extract deeper insights
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 4000,
          system: `You are an expert at analyzing client call transcripts to extract key information for Statement of Work development. Your job is to identify the core elements that will inform the SOW.`,
          messages: [{
            role: 'user',
            content: `Analyze this client call transcript and extract:

1. SUCCESS DEFINITION - What does success look like for this engagement? What outcomes is the client hoping to achieve?

2. PROBLEM STATEMENT - What specific problem(s) is the client trying to solve? What pain points did they express?

3. MANDATORIES - What explicit requirements or must-haves did the client mention? Things they specifically asked for.

4. TIMELINE - Any deadlines, milestones, or timing requirements mentioned.

5. BUDGET SIGNALS - Any budget ranges, constraints, or expectations mentioned.

6. KEY STAKEHOLDERS - Who are the decision makers and key contacts?

7. CONTEXT - Important background about the client's situation, industry, or competitive landscape.

Format your response as:

## SUCCESS DEFINITION
[Clear statement of what success looks like]

## PROBLEM STATEMENT
[The core problem(s) to solve]

## MANDATORIES
- [Explicit requirement 1]
- [Explicit requirement 2]
...

## TIMELINE
[Any timeline information]

## BUDGET SIGNALS
[Any budget information]

## KEY STAKEHOLDERS
[Stakeholder information]

## CONTEXT
[Relevant background]

TRANSCRIPT:
${transcript}`
          }]
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'API request failed');
      }
      
      const data = await response.json();
      const analysisText = data.content[0].text;
      setTranscriptAnalysis(analysisText);
      
    } catch (err) {
      setDraftError(err.message);
    } finally {
      setIsAnalyzingTranscript(false);
    }
  };
  
  const toggleService = (service) => {
    setSelectedServices(prev => 
      prev.includes(service) 
        ? prev.filter(s => s !== service)
        : [...prev, service]
    );
  };
  
  const generateSOW = async () => {
    if (!apiKey || selectedServices.length === 0) return;
    
    setIsGeneratingDraft(true);
    setDraftError(null);
    
    try {
      const engagementLabel = DRAFT_ENGAGEMENT_TYPES.find(t => t.value === draftEngagementType)?.label || 'Fixed Fee';
      
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 16000,
          system: `You are an expert at drafting professional Statements of Work for a marketing and communications agency (Antenna Group). 

Your SOWs must follow these standards:
- Use decimal numbering (1.1, 1.1.1, etc.) NOT bullet points
- Every deliverable must have explicit completion criteria
- Use "up to" language for flexibility (e.g., "up to 4 hours per month")
- Include Activities (what agency will DO), Outputs (what agency will PRODUCE with quantities), and Assumptions
- Include Client Responsibilities section with consolidated feedback requirement and approval windows
- Include clear scope boundaries and what is NOT included
- Specify revision limits (e.g., "up to 2 rounds of revisions")

${ASSESSMENT_FRAMEWORK}`,
          messages: [{
            role: 'user',
            content: `Create a professional Statement of Work based on the following:

ENGAGEMENT TYPE: ${engagementLabel}

ADDITIONAL NOTES FROM ACCOUNT TEAM:
${draftNotes || 'None provided'}

CLIENT TRANSCRIPT ANALYSIS:
${transcriptAnalysis || 'No transcript analyzed'}

SELECTED SERVICES TO INCLUDE:
${selectedServices.map(s => `- ${s}`).join('\n')}

Generate a complete, professional SOW that:
1. Addresses the success criteria and problems identified
2. Includes all selected services as properly structured deliverables
3. Has clear completion criteria for each deliverable
4. Includes Client Responsibilities section
5. Has Master Assumptions section
6. Uses proper decimal numbering throughout
7. Uses "up to" language for quantities and timeframes
8. Includes a Fee Summary section appropriate for ${engagementLabel} engagement
9. Is ready for client presentation with minimal editing

Format the SOW professionally with clear sections.`
          }]
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'API request failed');
      }
      
      const data = await response.json();
      setGeneratedSOW(data.content[0].text);
      
    } catch (err) {
      setDraftError(err.message);
    } finally {
      setIsGeneratingDraft(false);
    }
  };
  
  const downloadGeneratedSOW = () => {
    if (!generatedSOW) return;
    const blob = new Blob([generatedSOW], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `SOW_Draft_${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };
  
  const resetDraft = () => {
    setDraftNotes('');
    setDraftEngagementType('');
    setTranscript('');
    setTranscriptAnalysis(null);
    setDetectedTriggers([]);
    setSelectedServices([]);
    setGeneratedSOW(null);
    setDraftError(null);
  };

  // ============================================================================
  // REVIEW SOW FUNCTIONS
  // ============================================================================
  
  const handleFileUpload = useCallback(async (event) => {
    const uploadedFile = event.target.files[0];
    if (!uploadedFile) return;

    setFile(uploadedFile);
    setError(null);
    setAnalysis(null);

    if (uploadedFile.type === 'application/pdf') {
      const reader = new FileReader();
      reader.onload = (e) => {
        const base64 = e.target.result.split(',')[1];
        setFileContent({ type: 'pdf', data: base64 });
      };
      reader.readAsDataURL(uploadedFile);
    } else if (uploadedFile.type === 'text/plain' || uploadedFile.name.endsWith('.txt') || uploadedFile.name.endsWith('.md')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setFileContent({ type: 'text', data: e.target.result });
      };
      reader.readAsText(uploadedFile);
    } else if (uploadedFile.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || uploadedFile.name.endsWith('.docx')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const base64 = e.target.result.split(',')[1];
        setFileContent({ type: 'docx', data: base64 });
      };
      reader.readAsDataURL(uploadedFile);
    } else {
      setError('Please upload a PDF, DOCX, or text file');
      setFile(null);
    }
  }, []);

  const analyzeSOW = async () => {
    if (!apiKey || !fileContent || !reviewEngagementType) return;

    setIsAnalyzing(true);
    setError(null);
    setAnalysis(null);
    setRawResponse('');
    setDraftedSOW(null);

    try {
      const engagementLabel = REVIEW_ENGAGEMENT_TYPES.find(t => t.value === reviewEngagementType)?.label || reviewEngagementType;
      
      const promptText = `${ASSESSMENT_FRAMEWORK}

You are reviewing an SOW for a ${engagementLabel} engagement.

For each issue you find, provide SPECIFIC RECOMMENDATIONS with:
- Section reference (e.g., "Section 5.2.1")
- Current language (quote the exact text from the document)
- Recommended replacement language (ready to copy-paste)
- Brief explanation of why this change matters

Example format for each issue:
Section 3.2: Missing consolidated feedback requirement.
Current: "Client will provide feedback on deliverables."
Recommended: "Client agrees to consolidate all internal feedback before submission to Agency. Feedback must represent unified organizational direction; Agency is not responsible for reconciling conflicting stakeholder input."
[One sentence explaining why this change matters]

Structure your response as:

1. CRITICAL ISSUES - Things that MUST be fixed before issuing
(For each: section, current language, recommended replacement, explanation)

2. RECOMMENDED IMPROVEMENTS - Things that SHOULD be fixed  
(For each: section, current language, recommended replacement, explanation)

3. RED FLAGS FOUND - Every instance of problematic phrases
Format as: "[phrase found]" in Section X.X → "[recommended replacement]"
IMPORTANT: Prefer "UP TO" language (e.g., "up to 4 hours per month") rather than exact quantification. This provides flexibility while still setting clear boundaries.

4. SERVICE-LINE COMPLIANCE - Check each required element for ${engagementLabel} engagements
✓ Present: [element] - [where found]
✗ Missing: [element] - [what to add]

5. BUDGET VERIFICATION - Check fee table arithmetic, billing schedule alignment, deliverable-to-fee mapping

6. OVERALL ASSESSMENT
- Compliance score (1-10) with brief justification
- Top 3 priorities to address (be specific)
- What's working well

Be extremely specific. Quote the actual document. Provide ready-to-use replacement language.`;


      let messages = [];
      
      if (fileContent.type === 'pdf') {
        messages = [{
          role: 'user',
          content: [
            { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: fileContent.data }},
            { type: 'text', text: promptText }
          ]
        }];
      } else if (fileContent.type === 'text') {
        messages = [{
          role: 'user',
          content: `${promptText}\n\n=== SOW CONTENT START ===\n${fileContent.data}\n=== SOW CONTENT END ===`
        }];
      } else {
        messages = [{
          role: 'user',
          content: [
            { type: 'document', source: { type: 'base64', media_type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', data: fileContent.data }},
            { type: 'text', text: promptText }
          ]
        }];
      }

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 8000,
          messages
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'API request failed');
      }

      const data = await response.json();
      const responseText = data.content[0].text;
      setRawResponse(responseText);

      // Parse response into sections
      const parseSection = (text, startMarker, endMarkers) => {
        const startIdx = text.indexOf(startMarker);
        if (startIdx === -1) return [];
        
        let endIdx = text.length;
        for (const marker of endMarkers) {
          const idx = text.indexOf(marker, startIdx + startMarker.length);
          if (idx !== -1 && idx < endIdx) endIdx = idx;
        }
        
        const section = text.slice(startIdx + startMarker.length, endIdx).trim();
        return section.split(/\n(?=Section|\d+\.|•|-)/).map(s => s.trim()).filter(s => s.length > 10);
      };

      const parsedAnalysis = {
        critical: parseSection(responseText, '1. CRITICAL ISSUES', ['2. RECOMMENDED', '3. RED FLAGS']),
        recommended: parseSection(responseText, '2. RECOMMENDED IMPROVEMENTS', ['3. RED FLAGS', '4. SERVICE-LINE']),
        redFlags: parseSection(responseText, '3. RED FLAGS FOUND', ['4. SERVICE-LINE', '5. BUDGET']),
        compliance: responseText.match(/4\. SERVICE-LINE COMPLIANCE[\s\S]*?(?=5\. BUDGET|6\. OVERALL|$)/)?.[0]?.replace('4. SERVICE-LINE COMPLIANCE', '').trim(),
        budget: responseText.match(/5\. BUDGET VERIFICATION[\s\S]*?(?=6\. OVERALL|$)/)?.[0]?.replace('5. BUDGET VERIFICATION', '').trim(),
        overall: responseText.match(/6\. OVERALL ASSESSMENT[\s\S]*$/)?.[0]?.replace('6. OVERALL ASSESSMENT', '').trim()
      };

      setAnalysis(parsedAnalysis);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const generateRevisedDraft = async () => {
    if (!apiKey || !fileContent || !rawResponse) return;
    
    setIsDrafting(true);
    setReviewDraftError(null);
    
    try {
      let messages = [];
      const draftPrompt = `Based on the analysis provided, create a COMPLETE REVISED VERSION of this SOW that:

1. Applies ALL critical fixes identified
2. Incorporates ALL recommended improvements
3. Replaces ALL red flag language with the suggested alternatives (using "up to" language)
4. Adds any missing required sections (client responsibilities, assumptions, exclusions)
5. Maintains the original structure and intent while improving quality
6. Uses proper decimal numbering throughout

ANALYSIS TO APPLY:
${rawResponse}

Output the complete revised SOW text. Mark sections you've modified with [REVISED] and new sections with [NEW].`;

      if (fileContent.type === 'pdf') {
        messages = [{
          role: 'user',
          content: [
            { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: fileContent.data }},
            { type: 'text', text: draftPrompt }
          ]
        }];
      } else if (fileContent.type === 'text') {
        messages = [{
          role: 'user',
          content: `${draftPrompt}\n\n=== ORIGINAL SOW ===\n${fileContent.data}`
        }];
      } else {
        messages = [{
          role: 'user',
          content: [
            { type: 'document', source: { type: 'base64', media_type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', data: fileContent.data }},
            { type: 'text', text: draftPrompt }
          ]
        }];
      }

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 16000,
          messages
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Failed to generate draft');
      }

      const data = await response.json();
      setDraftedSOW(data.content[0].text);
    } catch (err) {
      setReviewDraftError(err.message);
    } finally {
      setIsDrafting(false);
    }
  };

  const downloadRevisedDraft = () => {
    if (!draftedSOW) return;
    const blob = new Blob([draftedSOW], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const originalName = file?.name?.replace(/\.[^/.]+$/, '') || 'SOW';
    a.download = `${originalName}_REVISED.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const resetReview = () => {
    setFile(null);
    setFileContent(null);
    setReviewEngagementType('');
    setAnalysis(null);
    setRawResponse('');
    setDraftedSOW(null);
    setError(null);
  };

  // ============================================================================
  // RENDER
  // ============================================================================
  
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <button onClick={() => setCurrentView('home')} className="hover:opacity-80 transition-opacity">
              <AntennaLogo className="h-8" />
            </button>
            <a 
              href="https://www.antennagroup.com" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-sm text-gray-500 hover:text-gray-900 transition-colors"
            >
              Back to Antenna
            </a>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-16">
        
        {/* ================================================================== */}
        {/* HOME VIEW */}
        {/* ================================================================== */}
        {currentView === 'home' && (
          <div className="text-center">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 leading-tight mb-6">
              SOW Workbench
            </h1>
            <p className="text-xl text-gray-500 max-w-2xl mx-auto leading-relaxed mb-16">
              Draft new Statements of Work from client calls or review existing SOWs against Antenna Group quality standards.
            </p>
            
            <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
              {/* Draft SOW Card */}
              <button
                onClick={() => setCurrentView('draft')}
                className="group p-8 bg-white rounded-2xl border-2 border-gray-200 hover:border-gray-900 transition-all text-left"
              >
                <div className="w-14 h-14 bg-gray-100 group-hover:bg-gray-900 rounded-xl flex items-center justify-center mb-6 transition-colors">
                  <PenTool className="w-7 h-7 text-gray-600 group-hover:text-white transition-colors" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-3">Draft a New SOW</h2>
                <p className="text-gray-500 mb-4">
                  Create a Statement of Work from scratch using client call transcripts. AI analyzes the conversation to identify services and requirements.
                </p>
                <div className="flex items-center gap-2 text-gray-900 font-semibold">
                  Get started <ArrowUpRight className="w-4 h-4" />
                </div>
              </button>
              
              {/* Review SOW Card */}
              <button
                onClick={() => setCurrentView('review')}
                className="group p-8 bg-white rounded-2xl border-2 border-gray-200 hover:border-gray-900 transition-all text-left"
              >
                <div className="w-14 h-14 bg-gray-100 group-hover:bg-gray-900 rounded-xl flex items-center justify-center mb-6 transition-colors">
                  <Search className="w-7 h-7 text-gray-600 group-hover:text-white transition-colors" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-3">Review an Existing SOW</h2>
                <p className="text-gray-500 mb-4">
                  Upload an SOW for automated quality assessment against Antenna Group standards. Get specific recommendations and generate revised drafts.
                </p>
                <div className="flex items-center gap-2 text-gray-900 font-semibold">
                  Get started <ArrowUpRight className="w-4 h-4" />
                </div>
              </button>
            </div>
          </div>
        )}

        {/* ================================================================== */}
        {/* DRAFT SOW VIEW */}
        {/* ================================================================== */}
        {currentView === 'draft' && !generatedSOW && (
          <>
            <button
              onClick={() => setCurrentView('home')}
              className="flex items-center gap-2 text-gray-500 hover:text-gray-900 mb-8 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              Back to home
            </button>
            
            <div className="mb-12">
              <h1 className="text-4xl font-bold text-gray-900 mb-4">Draft a New SOW</h1>
              <p className="text-xl text-gray-500">
                Paste a client call transcript and we'll analyze it to identify services and requirements.
              </p>
            </div>
            
            <div className="grid lg:grid-cols-2 gap-8">
              {/* Left Column - Inputs */}
              <div className="space-y-6">
                <div className="bg-white rounded-2xl border border-gray-200 p-6">
                  <ApiKeyInput apiKey={apiKey} setApiKey={setApiKey} />
                  
                  {/* Engagement Type */}
                  <div className="mb-6">
                    <label className="block text-sm font-semibold text-gray-900 mb-3">Engagement Type</label>
                    <div className="grid grid-cols-2 gap-3">
                      {DRAFT_ENGAGEMENT_TYPES.map((type) => (
                        <button
                          key={type.value}
                          onClick={() => setDraftEngagementType(type.value)}
                          className={`p-3 rounded-xl border-2 text-left transition-all ${
                            draftEngagementType === type.value
                              ? 'border-gray-900 bg-gray-50'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <p className="font-semibold text-gray-900 text-sm">{type.label}</p>
                          <p className="text-xs text-gray-500">{type.description}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  {/* Notes */}
                  <div className="mb-6">
                    <label className="block text-sm font-semibold text-gray-900 mb-2">
                      Additional Notes (optional)
                    </label>
                    <textarea
                      value={draftNotes}
                      onChange={(e) => setDraftNotes(e.target.value)}
                      placeholder="Any specific requirements, budget constraints, timeline notes, or context the AI should know..."
                      className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-gray-900 outline-none transition-all text-gray-900 placeholder:text-gray-400 min-h-[100px] resize-y"
                    />
                  </div>
                  
                  {/* Transcript */}
                  <div className="mb-6">
                    <label className="block text-sm font-semibold text-gray-900 mb-2">
                      <div className="flex items-center gap-2">
                        <MessageSquare className="w-4 h-4" />
                        Client Call Transcript
                      </div>
                    </label>
                    <textarea
                      value={transcript}
                      onChange={(e) => setTranscript(e.target.value)}
                      placeholder="Paste the transcript of your client call here. The AI will analyze it to identify what services they need and extract key requirements..."
                      className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-gray-900 outline-none transition-all text-gray-900 placeholder:text-gray-400 min-h-[200px] resize-y font-mono text-sm"
                    />
                  </div>
                  
                  {draftError && (
                    <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl">
                      <div className="flex items-start gap-3 text-red-600">
                        <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
                        <p className="text-sm">{draftError}</p>
                      </div>
                    </div>
                  )}
                  
                  <button
                    onClick={analyzeTranscript}
                    disabled={!apiKey || !transcript.trim() || isAnalyzingTranscript}
                    className={`w-full py-4 px-6 rounded-xl font-semibold text-lg transition-all flex items-center justify-center gap-3 ${
                      !apiKey || !transcript.trim() || isAnalyzingTranscript
                        ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                        : 'bg-gray-900 text-white hover:bg-gray-800'
                    }`}
                  >
                    {isAnalyzingTranscript ? (
                      <><Loader2 className="w-5 h-5 animate-spin" />Analyzing Transcript...</>
                    ) : (
                      <><Lightbulb className="w-5 h-5" />Analyze Transcript</>
                    )}
                  </button>
                </div>
              </div>
              
              {/* Right Column - Analysis Results */}
              <div className="space-y-6">
                {transcriptAnalysis && (
                  <>
                    {/* Analysis Summary */}
                    <div className="bg-white rounded-2xl border border-gray-200 p-6">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                          <Target className="w-5 h-5 text-green-600" />
                        </div>
                        <h3 className="text-lg font-bold text-gray-900">Transcript Analysis</h3>
                      </div>
                      <div className="prose prose-sm max-w-none">
                        <pre className="whitespace-pre-wrap text-sm bg-gray-50 p-4 rounded-lg overflow-auto text-gray-700 font-sans">
                          {transcriptAnalysis}
                        </pre>
                      </div>
                    </div>
                    
                    {/* Detected Service Triggers */}
                    {detectedTriggers.length > 0 && (
                      <div className="bg-white rounded-2xl border border-gray-200 p-6">
                        <div className="flex items-center gap-3 mb-4">
                          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                            <Users className="w-5 h-5 text-blue-600" />
                          </div>
                          <div>
                            <h3 className="text-lg font-bold text-gray-900">Recommended Services</h3>
                            <p className="text-sm text-gray-500">Based on client language patterns</p>
                          </div>
                        </div>
                        
                        <div className="space-y-4">
                          {detectedTriggers.map((trigger) => (
                            <ServiceCard
                              key={trigger.id}
                              trigger={trigger}
                              isSelected={trigger.services.some(s => selectedServices.includes(s))}
                              selectedServices={selectedServices}
                              onToggleService={toggleService}
                            />
                          ))}
                        </div>
                        
                        {selectedServices.length > 0 && (
                          <div className="mt-6 pt-6 border-t border-gray-200">
                            <div className="flex items-center justify-between mb-4">
                              <p className="text-sm font-semibold text-gray-900">
                                {selectedServices.length} services selected
                              </p>
                              <button
                                onClick={() => setSelectedServices([])}
                                className="text-sm text-gray-500 hover:text-gray-900"
                              >
                                Clear all
                              </button>
                            </div>
                            <button
                              onClick={generateSOW}
                              disabled={isGeneratingDraft || !draftEngagementType}
                              className={`w-full py-4 px-6 rounded-xl font-semibold text-lg transition-all flex items-center justify-center gap-3 ${
                                isGeneratingDraft || !draftEngagementType
                                  ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                  : 'bg-gray-900 text-white hover:bg-gray-800'
                              }`}
                            >
                              {isGeneratingDraft ? (
                                <><Loader2 className="w-5 h-5 animate-spin" />Generating SOW...</>
                              ) : (
                                <><Sparkles className="w-5 h-5" />Generate SOW Draft</>
                              )}
                            </button>
                            {!draftEngagementType && (
                              <p className="text-sm text-amber-600 mt-2 text-center">Please select an engagement type first</p>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                    
                    {/* All Service Categories (if no triggers detected) */}
                    {detectedTriggers.length === 0 && (
                      <div className="bg-white rounded-2xl border border-gray-200 p-6">
                        <div className="flex items-center gap-3 mb-4">
                          <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                            <AlertTriangle className="w-5 h-5 text-amber-600" />
                          </div>
                          <div>
                            <h3 className="text-lg font-bold text-gray-900">No Service Triggers Detected</h3>
                            <p className="text-sm text-gray-500">Select services manually below</p>
                          </div>
                        </div>
                        
                        <div className="space-y-4">
                          {SERVICE_TRIGGERS.map((trigger) => (
                            <ServiceCard
                              key={trigger.id}
                              trigger={trigger}
                              isSelected={trigger.services.some(s => selectedServices.includes(s))}
                              selectedServices={selectedServices}
                              onToggleService={toggleService}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
                
                {!transcriptAnalysis && (
                  <div className="bg-gray-50 rounded-2xl border border-gray-200 p-8 text-center">
                    <MessageSquare className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Paste a transcript to get started</h3>
                    <p className="text-sm text-gray-500">
                      The AI will analyze the conversation to identify client needs, problems to solve, and recommended services.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {/* Generated SOW View */}
        {currentView === 'draft' && generatedSOW && (
          <>
            <div className="flex items-start justify-between mb-8">
              <div>
                <h1 className="text-4xl font-bold text-gray-900 mb-2">SOW Draft Generated</h1>
                <p className="text-gray-500">
                  {DRAFT_ENGAGEMENT_TYPES.find(t => t.value === draftEngagementType)?.label} • {selectedServices.length} services included
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={downloadGeneratedSOW}
                  className="px-5 py-2.5 text-sm font-semibold bg-gray-900 text-white rounded-xl hover:bg-gray-800 transition-colors flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Download
                </button>
                <button
                  onClick={resetDraft}
                  className="px-5 py-2.5 text-sm font-semibold text-gray-900 border-2 border-gray-900 rounded-xl hover:bg-gray-900 hover:text-white transition-colors"
                >
                  Start Over
                </button>
              </div>
            </div>
            
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              <div className="px-6 py-4 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                <span className="font-semibold text-gray-900">Generated SOW</span>
                <CopyButton text={generatedSOW} />
              </div>
              <div className="p-6 max-h-[70vh] overflow-auto">
                <pre className="whitespace-pre-wrap text-sm text-gray-900 font-mono leading-relaxed">{generatedSOW}</pre>
              </div>
            </div>
          </>
        )}

        {/* ================================================================== */}
        {/* REVIEW SOW VIEW */}
        {/* ================================================================== */}
        {currentView === 'review' && !analysis && (
          <>
            <button
              onClick={() => setCurrentView('home')}
              className="flex items-center gap-2 text-gray-500 hover:text-gray-900 mb-8 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              Back to home
            </button>
            
            <div className="text-center mb-12">
              <h1 className="text-4xl font-bold text-gray-900 mb-4">Review an Existing SOW</h1>
              <p className="text-xl text-gray-500 max-w-2xl mx-auto">
                Upload a Statement of Work for automated quality assessment against Antenna Group standards.
              </p>
            </div>
            
            <div className="max-w-2xl mx-auto bg-white rounded-2xl border border-gray-200 p-8">
              <ApiKeyInput apiKey={apiKey} setApiKey={setApiKey} />

              {/* File Upload */}
              <div className="mb-8">
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Upload SOW Document
                </label>
                <div 
                  className={`border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer ${
                    file ? 'border-gray-900 bg-gray-50' : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
                  }`}
                >
                  <input type="file" accept=".pdf,.docx,.txt,.md" onChange={handleFileUpload} className="hidden" id="file-upload" />
                  <label htmlFor="file-upload" className="cursor-pointer">
                    {file ? (
                      <div className="flex items-center justify-center gap-4">
                        <div className="w-14 h-14 bg-gray-900 rounded-xl flex items-center justify-center">
                          <FileText className="w-7 h-7 text-white" />
                        </div>
                        <div className="text-left">
                          <p className="font-semibold text-gray-900">{file.name}</p>
                          <p className="text-sm text-gray-500">{(file.size / 1024).toFixed(1)} KB • Click to change</p>
                        </div>
                      </div>
                    ) : (
                      <>
                        <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                        <p className="text-gray-900 font-medium mb-1">Click to upload or drag and drop</p>
                        <p className="text-sm text-gray-500">PDF, DOCX, or TXT files supported</p>
                      </>
                    )}
                  </label>
                </div>
              </div>

              {/* Engagement Type */}
              <div className="mb-8">
                <label className="block text-sm font-semibold text-gray-900 mb-3">Engagement Type</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {REVIEW_ENGAGEMENT_TYPES.map((type) => (
                    <button
                      key={type.value}
                      onClick={() => setReviewEngagementType(type.value)}
                      className={`p-4 rounded-xl border-2 text-left transition-all ${
                        reviewEngagementType === type.value
                          ? 'border-gray-900 bg-gray-50'
                          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-all ${
                          reviewEngagementType === type.value ? 'border-gray-900' : 'border-gray-300'
                        }`}>
                          {reviewEngagementType === type.value && <div className="w-2.5 h-2.5 rounded-full bg-gray-900" />}
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900">{type.label}</p>
                          <p className="text-xs text-gray-500 mt-0.5">{type.description}</p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {error && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl">
                  <div className="flex items-start gap-3 text-red-600">
                    <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-semibold">Error</p>
                      <p className="text-sm">{error}</p>
                    </div>
                  </div>
                </div>
              )}

              <button
                onClick={analyzeSOW}
                disabled={!apiKey || !file || !reviewEngagementType || isAnalyzing}
                className={`w-full py-4 px-6 rounded-xl font-semibold text-lg transition-all flex items-center justify-center gap-3 ${
                  !apiKey || !file || !reviewEngagementType || isAnalyzing
                    ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    : 'bg-gray-900 text-white hover:bg-gray-800'
                }`}
              >
                {isAnalyzing ? (
                  <><Loader2 className="w-5 h-5 animate-spin" />Analyzing SOW...</>
                ) : (
                  <>Analyze SOW<ArrowUpRight className="w-5 h-5" /></>
                )}
              </button>
            </div>
          </>
        )}

        {/* Review Results View */}
        {currentView === 'review' && analysis && (
          <>
            <div className="flex items-start justify-between mb-8">
              <div>
                <h1 className="text-4xl font-bold text-gray-900 mb-2">Analysis Complete</h1>
                <p className="text-gray-500">{file?.name} • {REVIEW_ENGAGEMENT_TYPES.find(t => t.value === reviewEngagementType)?.label} Engagement</p>
              </div>
              <button onClick={resetReview} className="px-5 py-2.5 text-sm font-semibold text-gray-900 border-2 border-gray-900 rounded-xl hover:bg-gray-900 hover:text-white transition-colors">
                Review Another
              </button>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
              {analysis.critical?.length > 0 && (
                <CollapsibleSection title="Critical Issues" icon={AlertCircle} count={analysis.critical.length} defaultOpen variant="critical">
                  <p className="text-sm text-red-600 mb-4">Must be addressed before issuing to client.</p>
                  {analysis.critical.map((issue, idx) => <IssueCard key={idx} issue={issue} type="critical" />)}
                </CollapsibleSection>
              )}

              {analysis.recommended?.length > 0 && (
                <CollapsibleSection title="Recommended Improvements" icon={AlertTriangle} count={analysis.recommended.length} defaultOpen variant="recommended">
                  <p className="text-sm text-amber-600 mb-4">Would strengthen the SOW but not blocking.</p>
                  {analysis.recommended.map((issue, idx) => <IssueCard key={idx} issue={issue} type="recommended" />)}
                </CollapsibleSection>
              )}

              {analysis.redFlags?.length > 0 && (
                <CollapsibleSection title="Red Flags Found" count={analysis.redFlags.length} icon={AlertTriangle}>
                  <p className="text-sm text-gray-500 mb-4">Problematic language to replace. Click the copy button to grab the replacement text.</p>
                  {analysis.redFlags.map((flag, idx) => <RedFlagCard key={idx} flag={flag} />)}
                </CollapsibleSection>
              )}

              {analysis.compliance && (
                <CollapsibleSection title="Service-Line Compliance" icon={CheckCircle}>
                  <pre className="whitespace-pre-wrap text-sm bg-gray-50 p-4 rounded-lg overflow-auto font-mono text-gray-900">{analysis.compliance}</pre>
                </CollapsibleSection>
              )}

              {analysis.budget && (
                <CollapsibleSection title="Budget Verification">
                  <pre className="whitespace-pre-wrap text-sm bg-gray-50 p-4 rounded-lg overflow-auto font-mono text-gray-900">{analysis.budget}</pre>
                </CollapsibleSection>
              )}

              {analysis.overall && (
                <CollapsibleSection title="Overall Assessment" defaultOpen>
                  <pre className="whitespace-pre-wrap text-sm bg-gray-50 p-4 rounded-lg overflow-auto text-gray-900">{analysis.overall}</pre>
                </CollapsibleSection>
              )}

              <CollapsibleSection title="Full Analysis (Raw)">
                <pre className="whitespace-pre-wrap text-xs bg-gray-900 text-gray-100 p-4 rounded-lg overflow-auto max-h-96 font-mono">{rawResponse}</pre>
              </CollapsibleSection>
            </div>

            {/* Draft Updated SOW Section */}
            <div className="mt-8 bg-gray-900 rounded-2xl p-8 shadow-lg">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center flex-shrink-0">
                  <Sparkles className="w-6 h-6 text-gray-900" />
                </div>
                <div className="flex-1">
                  <h2 className="text-2xl font-bold text-white mb-2">Generate Revised SOW</h2>
                  <p className="text-gray-400 mb-6">
                    Create an updated draft that incorporates all critical fixes, recommended improvements, and red flag replacements from the analysis above.
                  </p>

                  {reviewDraftError && (
                    <div className="mb-4 p-4 bg-red-900/30 border border-red-500/40 rounded-xl">
                      <p className="text-red-300 text-sm">{reviewDraftError}</p>
                    </div>
                  )}

                  {!draftedSOW ? (
                    <button
                      onClick={generateRevisedDraft}
                      disabled={isDrafting}
                      className={`px-6 py-3 rounded-xl font-semibold transition-all flex items-center gap-3 ${
                        isDrafting
                          ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                          : 'bg-white text-gray-900 hover:bg-gray-100'
                      }`}
                    >
                      {isDrafting ? (
                        <><Loader2 className="w-5 h-5 animate-spin" />Generating Draft...</>
                      ) : (
                        <><Sparkles className="w-5 h-5" />Draft Updated SOW</>
                      )}
                    </button>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="inline-flex items-center gap-2 px-3 py-1.5 bg-green-900/30 border border-green-500/40 rounded-full text-green-300 text-sm font-medium">
                          <CheckCircle className="w-4 h-4" />
                          Draft Generated
                        </span>
                        <button
                          onClick={downloadRevisedDraft}
                          className="px-4 py-2 bg-white text-gray-900 rounded-lg font-semibold text-sm hover:bg-gray-100 transition-colors flex items-center gap-2"
                        >
                          <Download className="w-4 h-4" />
                          Download Draft
                        </button>
                        <button
                          onClick={generateRevisedDraft}
                          disabled={isDrafting}
                          className="px-4 py-2 bg-gray-700 text-white rounded-lg font-medium text-sm hover:bg-gray-600 transition-colors"
                        >
                          Regenerate
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {draftedSOW && (
                <div className="mt-6">
                  <div className="bg-gray-950 rounded-xl border border-gray-700 overflow-hidden">
                    <div className="px-4 py-3 bg-gray-800 border-b border-gray-700 flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-400">Revised SOW Preview</span>
                      <CopyButton text={draftedSOW} className="!bg-gray-700 !text-gray-400 hover:!bg-gray-600 hover:!text-white" />
                    </div>
                    <div className="p-4 max-h-[500px] overflow-auto">
                      <pre className="whitespace-pre-wrap text-sm text-gray-100 font-mono leading-relaxed">{draftedSOW}</pre>
                    </div>
                  </div>
                  <p className="mt-3 text-xs text-gray-500">
                    <span className="text-white">[REVISED]</span> marks modified sections • <span className="text-white">[NEW]</span> marks added sections • Review carefully before use
                  </p>
                </div>
              )}
            </div>
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-gray-900 text-white mt-20">
        <div className="max-w-6xl mx-auto px-6 py-12">
          <h3 className="text-2xl font-semibold mb-8">For conscious brands with the courage to lead</h3>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
            <div>
              <h4 className="font-semibold mb-4 text-gray-400">Our Offices</h4>
              <ul className="space-y-2 text-sm text-gray-300">
                <li>San Francisco, CA</li>
                <li>New York, NY</li>
                <li>Hackensack, NJ</li>
                <li>Washington, D.C.</li>
                <li>London, UK</li>
                <li>Prague, CZ</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4 text-gray-400">Social</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="https://www.linkedin.com/company/antenna-group" target="_blank" rel="noopener noreferrer" className="text-gray-300 hover:text-white transition-colors">LinkedIn</a></li>
                <li><a href="https://www.instagram.com/antennagroup/" target="_blank" rel="noopener noreferrer" className="text-gray-300 hover:text-white transition-colors">Instagram</a></li>
                <li><a href="https://www.facebook.com/AntennaGroup" target="_blank" rel="noopener noreferrer" className="text-gray-300 hover:text-white transition-colors">Facebook</a></li>
                <li><a href="https://x.com/antenna_group" target="_blank" rel="noopener noreferrer" className="text-gray-300 hover:text-white transition-colors">X</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4 text-gray-400">Learn</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="https://www.antennagroup.com/lets-chat" target="_blank" rel="noopener noreferrer" className="text-gray-300 hover:text-white transition-colors">Let's Chat</a></li>
                <li><a href="https://www.antennagroup.com/work" target="_blank" rel="noopener noreferrer" className="text-gray-300 hover:text-white transition-colors">Work</a></li>
                <li><a href="https://www.antennagroup.com/age-of-adoption-podcast" target="_blank" rel="noopener noreferrer" className="text-gray-300 hover:text-white transition-colors">Podcast</a></li>
                <li><a href="https://fullyconscious.com" target="_blank" rel="noopener noreferrer" className="text-gray-300 hover:text-white transition-colors">Conscious Compass</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4 text-gray-400">Legal</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="https://www.antennagroup.com/terms" target="_blank" rel="noopener noreferrer" className="text-gray-300 hover:text-white transition-colors">Terms of Use</a></li>
                <li><a href="https://www.antennagroup.com/privacy-policy" target="_blank" rel="noopener noreferrer" className="text-gray-300 hover:text-white transition-colors">Privacy Policy</a></li>
              </ul>
            </div>
          </div>
          
          <div className="pt-8 border-t border-gray-800 text-sm text-gray-400">
            © 2026 Antenna Group — All Rights Reserved
          </div>
        </div>
      </footer>
    </div>
  );
}
