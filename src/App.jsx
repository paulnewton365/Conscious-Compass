import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  Upload, FileText, CheckCircle, AlertTriangle, AlertCircle, Loader2,
  ChevronDown, ChevronRight, Key, Eye, EyeOff, Copy, Check,
  ArrowRight, Download, Sparkles, PenTool, Search, MessageSquare,
  Lightbulb, Target, Users, DollarSign, Save, FolderOpen,
  Building2, Globe, TrendingUp, FileQuestion, Send, RotateCcw, X,
  Plus, Edit3, Trash2, ChevronLeft, Star, Clock, Archive, ArrowUpRight,
  RefreshCw, ChevronUp, Layers, BookOpen, ShieldCheck, Zap,
  LogOut, UserCog, UserPlus, Shield, Lock, User, ToggleLeft, ToggleRight,
  ClipboardList, TableProperties, Filter, ExternalLink, Award, BadgeCheck, XCircle
} from 'lucide-react';
import {
  Document, Packer, Paragraph, TextRun, Header, Footer,
  AlignmentType, HeadingLevel, BorderStyle, LevelFormat, PageNumber
} from 'docx';
import { saveAs } from 'file-saver';
import { supabase } from './lib/supabase.js';

const APP_VERSION = '3.12.0';
const MODEL = 'claude-sonnet-4-5-20250929';

// ============================================================================
// PIPELINE CONFIG
// ============================================================================
const PIPELINE_STAGES = [
  { id: 'research', number: 1, label: 'Research', Icon: Search, description: 'Company discovery & intake questions' },
  { id: 'brief', number: 2, label: 'Return Brief', Icon: FileText, description: 'Transcript analysis & client brief' },
  { id: 'proposal', number: 3, label: 'Proposal', Icon: Sparkles, description: 'Service selection & proposal' },
  { id: 'sow', number: 4, label: 'SOW', Icon: PenTool, description: 'Statement of Work generation' },
  { id: 'handover', number: 5, label: 'Handover', Icon: ClipboardList, description: 'Sales to delivery handover doc' },
];

const PROPOSAL_STATUSES = [
  { value: 'draft', label: 'Draft', bg: 'bg-gray-100', text: 'text-gray-700', border: 'border-gray-300' },
  { value: 'client_review', label: 'Client Review', bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-300' },
  { value: 'rework', label: 'Rework Needed', bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-300' },
  { value: 'approved', label: 'Approved ✓', bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-300' },
  { value: 'evaporated', label: 'Evaporated', bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-300' },
];

// ============================================================================
// USER MANAGEMENT SYSTEM
// ============================================================================
const USER_ROLES = {
  growth: {
    label: 'Growth',
    description: 'Business development — research, briefs & proposals',
    color: 'bg-blue-100 text-blue-800 border-blue-200',
    badgeColor: 'bg-blue-600',
    allowedStages: ['research', 'brief', 'proposal'],
    canAccessSOWReview: false,
    canAccessAdmin: false,
    canCreateOpportunities: true,
  },
  pm: {
    label: 'PM',
    description: 'Full pipeline access including SOW generation',
    color: 'bg-purple-100 text-purple-800 border-purple-200',
    badgeColor: 'bg-purple-600',
    allowedStages: ['research', 'brief', 'proposal', 'sow', 'handover'],
    canAccessSOWReview: true,
    canAccessAdmin: false,
    canCreateOpportunities: true,
  },
  reviewer: {
    label: 'Reviewer',
    description: 'SOW quality review only',
    color: 'bg-amber-100 text-amber-800 border-amber-200',
    badgeColor: 'bg-amber-600',
    allowedStages: [],
    canAccessSOWReview: true,
    canAccessAdmin: false,
    canCreateOpportunities: false,
  },
  admin: {
    label: 'Admin',
    description: 'Full access + user management',
    color: 'bg-gray-900 text-white border-gray-700',
    badgeColor: 'bg-gray-900',
    allowedStages: ['research', 'brief', 'proposal', 'sow', 'handover'],
    canAccessSOWReview: true,
    canAccessAdmin: true,
    canCreateOpportunities: true,
  },
};

const PRACTICES = ['Climate', 'Real Estate', 'Health', 'PA', 'HOWL'];

// Simple counter for unique opp numbers (stored in localStorage for persistence)
const getNextOppNumber = () => {
  try {
    const next = parseInt(localStorage.getItem('ag_opp_counter') || '0', 10) + 1;
    localStorage.setItem('ag_opp_counter', String(next));
    return `OPP-${String(next).padStart(4, '0')}`;
  } catch { return `OPP-${Date.now().toString().slice(-4)}`; }
};

const createOpportunity = (companyName, companyUrl = '', industry = '', practice = '', title = '') => ({
  id: Date.now().toString(),
  oppNumber: getNextOppNumber(),
  companyName,
  title,
  companyUrl,
  industry,
  practice,
  rid: '',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  currentStage: 'research',
  // Stage 1
  researchComplete: false,
  researchSummary: '',
  intakeQuestions: [],
  // Stage 2
  transcript: '',
  briefNotes: '',
  compassAssessment: '',
  fitArchetype: '',
  briefComplete: false,
  returnBrief: '',
  transcriptAnalysis: null,
  // Stage 3
  selectedServices: [],
  selectedArchetypes: [],
  draftEngagementType: 'fixed_fee',
  draftNotes: '',
  proposalDraft: '',
  proposalStatus: 'draft',
  // Stage 4
  sowDraft: '',
  sowStatus: 'draft',
  sowNotes: '',
  // Stage 5
  handoverDraft: '',
  handoverNotes: '',
  handoverStatus: 'draft',
});

// ============================================================================
// SERVICE TRIGGERS
// ============================================================================
const SERVICE_TRIGGERS = [
  {"id": "website", "category": "Website & App Development", "description": "Build or rebuild digital platforms", "engagementType": "fixed_fee", "triggerPatterns": {"direct": ["need a new website", "website redesign", "site looks outdated", "rebuild our site", "new landing page", "mobile-friendly"], "indirect": ["high bounce rates", "site is slow", "can\\'t update the site ourselves", "CMS is difficult", "doesn\\'t reflect our brand", "can\\'t integrate with our tools"], "situational": ["recent rebrand", "merger", "new product launch", "expansion into new markets", "adding e-commerce", "company milestone"], "performance": ["low conversion rates", "cart abandonment", "poor search rankings", "low time on site", "customer complaints about UX", "website not generating leads"]}, "services": [{"name": "Website Strategy & Planning", "recommend": "always", "condition": "when website is mentioned", "pricing": {"bundle": "Standard Website Offering", "engagementType": "fixed_fee", "termLow": 8, "termHigh": 20, "budgetLow": 40000, "budgetHigh": 140000}}, {"name": "Website Design & UX", "recommend": "always", "condition": "when website is mentioned", "pricing": {"bundle": "Standard Website Offering", "engagementType": "fixed_fee"}}, {"name": "Website Development", "recommend": "always", "condition": "when website is mentioned", "pricing": {"bundle": "Standard Website Offering", "engagementType": "fixed_fee"}}, {"name": "CMS Implementation", "recommend": "always", "condition": "when website is mentioned", "pricing": {"bundle": "Standard Website Offering", "engagementType": "fixed_fee"}}, {"name": "Performance Assurance", "recommend": "always", "condition": "when website is mentioned", "pricing": {"bundle": "Standard Website Offering", "engagementType": "fixed_fee"}}, {"name": "Website Refresh", "recommend": "conditional", "condition": "Staying on existing CMS but a simple design refresh without any updates to brand or website structure. This includes enhancements to fonts, color, image selection and data visualization only. Shoudl only be offered when client is stuck on existing CMS and only needs styling updates.", "pricing": {"engagementType": "fixed_fee", "termLow": 5, "termHigh": 8, "budgetLow": 20000, "budgetHigh": 30000}}, {"name": "Mobile App Development", "recommend": "conditional", "condition": "only if standalone app is requested. Goo to recopmmend for events, campaigns or launch moments.", "pricing": {"engagementType": "fixed_fee", "termLow": 3, "termHigh": 10, "budgetLow": 10000, "budgetHigh": 60000}}, {"name": "Landing Page Development", "recommend": "conditional", "condition": "only if landing or holding page is referenced. Good for temprary websites. Single page fixed structure", "pricing": {"engagementType": "fixed_fee", "termLow": 1, "termHigh": 3, "budgetLow": 10000, "budgetHigh": 15000}}, {"name": "Website Migration", "recommend": "conditional", "condition": "only if content migration is referenced as requirement. This includes lift and ahift and the lower end and an audiit appraisel and some light refresh at the top end. Top end also reflects scale of contentvrequirements which is anticipated to be under 50 within this range. More pages will required more budget", "pricing": {"engagementType": "fixed_fee", "termLow": 1, "termHigh": 4, "budgetLow": 10000, "budgetHigh": 60000}}, {"name": "Performance Optimization and Support", "recommend": "conditional", "condition": "only if website reporting and tracking is referenced as requirement", "pricing": {"engagementType": "retainer", "termLow": 52, "termHigh": 52, "budgetLow": 24000, "budgetHigh": 30000, "note": "Annual retainer"}}]},
  {"id": "integrated_strategy", "category": "Integrated Marketing Strategy", "description": "Develop cohesive marketing plans", "engagementType": "fixed_fee", "triggerPatterns": {"direct": ["need a marketing strategy", "marketing feels disjointed", "don\\'t have a plan", "where to focus our budget", "nothing seems connected"], "indirect": ["marketing not producing results", "conflicting messages", "no customer journey", "which channels to prioritize", "marketing and sales not aligned", "budget spread too thin"], "situational": ["new fiscal year", "leadership change", "entering new market", "product launch", "competitive pressure", "organizational shift"], "performance": ["declining market share", "acquisition costs increasing", "ROI unknown", "lead quality issues", "lifetime value decreasing", "inconsistent channel performance"]}, "services": [{"name": "Integrated Marketing Strategy Development", "recommend": "conditional", "condition": "when client has specific marketing goals (awareness, reputation, credibility, visibility, perception, audience inspiration)", "pricing": {"engagementType": "fixed_fee", "termLow": 1, "termHigh": 4, "budgetLow": 10000, "budgetHigh": 25000}}, {"name": "Channel Planning & Media Mix & Connections Planning", "recommend": "conditional", "condition": "when paid and social media are discussed as requirements", "pricing": {"engagementType": "fixed_fee", "termLow": 1, "termHigh": 3, "budgetLow": 10000, "budgetHigh": 20000}}, {"name": "Primary audience research", "recommend": "conditional", "condition": "This should be delivered by a consultants and will require hard cost fees. For surveys focus groups. TO gather qualitiative insight", "pricing": {"engagementType": "fixed_fee", "termLow": 4, "termHigh": 6, "budgetLow": 25000, "budgetHigh": 35000}}, {"name": "Customer Journey Mapping", "recommend": "conditional", "condition": "when website conversion is a goal or audience segmentation issues identified", "pricing": {"engagementType": "fixed_fee", "termLow": 1, "termHigh": 2, "budgetLow": 7000, "budgetHigh": 15000}}, {"name": "Marketing Audit & Assessment (Compass)", "recommend": "conditional", "condition": "when client does not know what problem to solve or has broad goals (awareness, reputation, credibility, visibility, perception)", "pricing": {"engagementType": "fixed_fee", "termLow": 1, "termHigh": 2, "budgetLow": 3000, "budgetHigh": 4000}}, {"name": "Market & Competitive Research", "recommend": "conditional", "condition": "when client does not know competitors or requests differentiation", "pricing": {"engagementType": "fixed_fee", "termLow": 1, "termHigh": 2, "budgetLow": 2000, "budgetHigh": 30000}}, {"name": "Audience Research & Segmentation", "recommend": "conditional", "condition": "when client does not know their audience, what inspires them, or how to reach them", "pricing": {"engagementType": "fixed_fee", "termLow": 1, "termHigh": 2, "budgetLow": 2000, "budgetHigh": 5000}}]},
  {"id": "brand", "category": "Brand Strategy & Expression", "description": "Define or refresh your brand foundation", "engagementType": "fixed_fee", "triggerPatterns": {"direct": ["need to rebrand", "brand feels outdated", "need a new logo", "brand doesn\\'t reflect who we are", "need brand guidelines", "Brand stricture is confusing", "brand is inconsistent"], "indirect": ["company evolved but identity hasn't", "can't explain what makes us different", "inconsistent messaging", "employees can\\'t articulate positioning", "customer confusion", "Interelationship between brands is not clear", "premium pricing not supported by perception"], "situational": ["merger or acquisition", "spin-off", "new leadership", "expansion beyond original scope", "new markets", "negative reputation", "company milestone", "geographical exansion", "IPO"], "performance": ["brand awareness declining", "NPS dropping", "customer feedback about perception", "can\\'t command premium prices", "losing deals to stronger brands", "employee engagement declining"]}, "services": [{"name": "Brand Research (Compass)", "recommend": "always", "condition": "for all brand refresh projects", "pricing": {"bundle": "Brand Strategy", "engagementType": "fixed_fee", "termLow": 2, "termHigh": 4, "budgetLow": 15000, "budgetHigh": 20000}}, {"name": "Stakeholder Interviews (IDIs)", "recommend": "always", "condition": "for all brand projects", "pricing": {"bundle": "Brand Strategy", "engagementType": "fixed_fee"}}, {"name": "Rapid Discovery (Landscape & Audience)", "recommend": "always", "condition": "for all brand projects", "pricing": {"bundle": "Brand Strategy", "engagementType": "fixed_fee"}}, {"name": "Brand Positioning", "recommend": "always", "condition": "for all brand projects", "pricing": {"bundle": "Brand Strategy", "engagementType": "fixed_fee"}}, {"name": "Brand House Development", "recommend": "always", "condition": "for all brand projects", "pricing": {"bundle": "Brand Strategy", "engagementType": "fixed_fee"}}, {"name": "Brand Workshop", "recommend": "always", "condition": "for all brand projects", "pricing": {"bundle": "Brand Strategy", "engagementType": "fixed_fee"}}, {"name": "Authentic Foundation (Why, What, How)", "recommend": "always", "condition": "for all brand projects", "pricing": {"bundle": "Brand Strategy", "engagementType": "fixed_fee"}}, {"name": "Brand Heirachy Definition", "recommend": "conditional", "condition": "For projectd that identify a confused relationship between brand, subrands, products and partners - and geographies/languages", "pricing": {"engagementType": "fixed_fee", "termLow": 1, "termHigh": 1, "budgetLow": 3000, "budgetHigh": 5000}}, {"name": "Tone of Voice", "recommend": "always", "condition": "for all brand projects", "pricing": {"bundle": "Brand Expression", "engagementType": "fixed_fee", "termLow": 3, "termHigh": 7, "budgetLow": 25000, "budgetHigh": 30000}}, {"name": "Manifesto", "recommend": "always", "condition": "for all brand projects", "pricing": {"bundle": "Brand Expression", "engagementType": "fixed_fee"}}, {"name": "Visual Identity System", "recommend": "always", "condition": "for all brand projects", "pricing": {"bundle": "Brand Expression", "engagementType": "fixed_fee"}}, {"name": "Logo/Wordmark Development", "recommend": "always", "condition": "for all brand projects", "pricing": {"bundle": "Brand Expression", "engagementType": "fixed_fee"}}, {"name": "Brand Deck Asset Production", "recommend": "conditional", "condition": "only if requested", "pricing": {"bundle": "Brand Expression", "engagementType": "fixed_fee", "termLow": 1, "termHigh": 4, "budgetLow": 10000, "budgetHigh": 30000}}, {"name": "Social Lock-ups", "recommend": "conditional", "condition": "only if requested", "pricing": {"bundle": "Brand Assets", "engagementType": "fixed_fee", "termLow": 1, "termHigh": 2, "budgetLow": 10000, "budgetHigh": 15000}}, {"name": "Brand Guidelines", "recommend": "conditional", "condition": "only if requested", "pricing": {"bundle": "Brand Assets", "engagementType": "fixed_fee"}}]},
  {"id": "ongoing_creative_production", "category": "Ongoing Creative Production", "description": "", "engagementType": "fixed_fee", "triggerPatterns": {"direct": [], "indirect": [], "situational": [], "performance": []}, "services": [{"name": "Graphic Design", "recommend": "conditional", "condition": "only if requested in the context of undefined ongoing need for content that may include teh service name", "pricing": {"bundle": "Creative Retainer", "engagementType": "tm", "termLow": 52, "termHigh": 52, "budgetLow": 24000, "budgetHigh": 80000, "note": "Annual minimum commitment"}}, {"name": "Video Production", "recommend": "conditional", "condition": "only if requested in the context of undefined ongoing need for content that may include teh service name", "pricing": {"bundle": "Creative Retainer", "engagementType": "tm"}}, {"name": "Animation & Motion Graphics", "recommend": "conditional", "condition": "only if requested in the context of undefined ongoing need for content that may include teh service name", "pricing": {"bundle": "Creative Retainer", "engagementType": "tm"}}, {"name": "Photography", "recommend": "conditional", "condition": "only if requested in the context of undefined ongoing need for content that may include teh service name", "pricing": {"bundle": "Creative Retainer", "engagementType": "tm"}}, {"name": "Copywriting", "recommend": "conditional", "condition": "only if requested in the context of undefined ongoing need for content that may include teh service name", "pricing": {"bundle": "Creative Retainer", "engagementType": "tm"}}, {"name": "Sales Collateral", "recommend": "conditional", "condition": "only if requested in the context of undefined ongoing need for content that may include teh service name", "pricing": {"bundle": "Creative Retainer", "engagementType": "tm"}}, {"name": "Presentation Design", "recommend": "conditional", "condition": "only if requested in the context of undefined ongoing need for content that may include teh service name", "pricing": {"bundle": "Creative Retainer", "engagementType": "tm"}}, {"name": "Social Media Content", "recommend": "conditional", "condition": "only if requested in the context of undefined ongoing need for content that may include teh service name", "pricing": {"bundle": "Creative Retainer", "engagementType": "tm"}}, {"name": "Campaign Asset Creation", "recommend": "conditional", "condition": "only if requested in the context of undefined ongoing need for content that may include teh service name", "pricing": {"bundle": "Creative Retainer", "engagementType": "tm"}}, {"name": "Brand Asset Library", "recommend": "conditional", "condition": "only if requested in the context of undefined ongoing need for content that may include teh service name", "pricing": {"bundle": "Creative Retainer", "engagementType": "tm"}}, {"name": "Content Ideation", "recommend": "conditional", "condition": "only if requested in the context of undefined ongoing need for content that may include teh service name", "pricing": {"bundle": "Creative Retainer", "engagementType": "tm"}}, {"name": "Transcreation (Multi-language)", "recommend": "conditional", "condition": "only if requested in the context of undefined ongoing need for content that may include teh service name", "pricing": {"bundle": "Creative Retainer", "engagementType": "tm"}}]},
  {"id": "standalone_creative_production", "category": "Standalone Creative Production", "description": "", "engagementType": "fixed_fee", "triggerPatterns": {"direct": [], "indirect": [], "situational": [], "performance": []}, "services": [{"name": "Video Production", "recommend": "conditional", "condition": "Production cost only. Does not include ideation, treatment and scripting. If standalone, campaign or a request of scale and complexity that required conceptual creative, ideation and iteration not just production", "pricing": {"engagementType": "fixed_fee", "termLow": 2, "termHigh": 8, "budgetLow": 10000, "budgetHigh": 50000}}, {"name": "Animation & Motion Graphics", "recommend": "conditional", "condition": "Production cost only. Does not include ideation, treatment and scripting. If standalone, campaign or a request of scale and complexity that required conceptual creative, ideation and iteration not just production", "pricing": {"engagementType": "fixed_fee", "termLow": 1, "termHigh": 4, "budgetLow": 10000, "budgetHigh": 20000}}, {"name": "Photography", "recommend": "conditional", "condition": "Production cost only. Does not include ideation, treatment and scripting. If standalone, campaign or a request of scale and complexity that required conceptual creative, ideation and iteration not just production", "pricing": {"engagementType": "fixed_fee", "termLow": 1, "termHigh": 4, "budgetLow": 2000, "budgetHigh": 30000}}, {"name": "Copywriting", "recommend": "conditional", "condition": "Production cost only. Does not include ideation, treatment and scripting. If standalone, campaign or a request of scale and complexity that required conceptual creative, ideation and iteration not just production", "pricing": {"engagementType": "fixed_fee", "termLow": 1, "termHigh": 3, "budgetLow": 4000, "budgetHigh": 10000}}, {"name": "Sales Collateral", "recommend": "conditional", "condition": "Production cost only. Does not include ideation, treatment and scripting. If standalone, campaign or a request of scale and complexity that required conceptual creative, ideation and iteration not just production", "pricing": {"engagementType": "fixed_fee", "termLow": 1, "termHigh": 3, "budgetLow": 2000, "budgetHigh": 15000}}, {"name": "Presentation Design", "recommend": "conditional", "condition": "Production cost only. Does not include ideation, treatment and scripting. If standalone, campaign or a request of scale and complexity that required conceptual creative, ideation and iteration not just production", "pricing": {"engagementType": "fixed_fee", "termLow": 1, "termHigh": 3, "budgetLow": 2000, "budgetHigh": 10000}}, {"name": "Social Media Content", "recommend": "conditional", "condition": "Production cost only. Does not include ideation, treatment and scripting. If standalone, campaign or a request of scale and complexity that required conceptual creative, ideation and iteration not just production", "pricing": {"engagementType": "fixed_fee", "termLow": 1, "termHigh": 3, "budgetLow": 2000, "budgetHigh": 10000}}, {"name": "Campaign Asset Creation", "recommend": "conditional", "condition": "Production cost only. Does not include ideation, treatment and scripting. This assumes a content series as a part of a predefined campaign with a big idea, art direction and messagting strategy set If standalone, campaign or a request of scale and complexity that required conceptual creative, ideation and iteration not just production", "pricing": {"engagementType": "fixed_fee", "termLow": 1, "termHigh": 4, "budgetLow": 5000, "budgetHigh": 20000}}, {"name": "Brand Asset Library", "recommend": "conditional", "condition": "Production cost only. Does not include ideation, treatment and scripting. It assumes that a brand staretgy and exp[ression and guidlines already exist. If standalone, campaign or a request of scale and complexity that required conceptual creative, ideation and iteration not just production", "pricing": {"engagementType": "fixed_fee", "termLow": 2, "termHigh": 5, "budgetLow": 8000, "budgetHigh": 20000}}, {"name": "Content Ideation", "recommend": "conditional", "condition": "If there is no idea for a content series this covers the strategy, and conceptual ideation to recommend specific describes content for production of standalone, campaign or a request of scale and complexity that required conceptual creative, ideation and iteration not just production", "pricing": {"engagementType": "fixed_fee", "termLow": 1, "termHigh": 4, "budgetLow": 5000, "budgetHigh": 20000}}]},
  {"id": "influencer", "category": "Influencer Marketing", "description": "Leverage creator partnerships", "engagementType": "retainer", "triggerPatterns": {"direct": ["want to work with influencers", "need an influencer campaign", "reach audience through creators", "tried influencer marketing but it didn\\'t work"], "indirect": ["difficulty reaching younger audiences", "need authentic endorsements", "product requires demonstration", "brand awareness stalled", "user-generated content insufficient"], "situational": ["product launch needing buzz", "new demographic market", "brand relevance concerns", "competitors using influencers", "need authentic content at scale", "event amplification"], "performance": ["social engagement declining", "owned content not resonating", "advertising fatigue", "high CPA on paid channels", "brand trust declining"]}, "services": [{"name": "Influencer Strategy", "recommend": "always", "condition": "when influencer marketing is discussed", "pricing": {"bundle": "Influencer Retainer", "engagementType": "retainer", "termLow": 52, "termHigh": 52, "budgetLow": 30000, "budgetHigh": 100000, "note": "Annual retainer, excludes creator fees"}}, {"name": "Creator Identification & Vetting", "recommend": "always", "condition": "when influencer marketing is discussed", "pricing": {"bundle": "Influencer Retainer", "engagementType": "retainer"}}, {"name": "Influencer Campaign Management", "recommend": "always", "condition": "when influencer marketing is discussed", "pricing": {"bundle": "Influencer Retainer", "engagementType": "retainer"}}, {"name": "Ambassador Programs", "recommend": "conditional", "condition": "only if long-term creator partnerships are requested", "pricing": {"bundle": "Influencer Retainer", "engagementType": "retainer"}}, {"name": "UGC Programs", "recommend": "conditional", "condition": "only if user-generated content is requested", "pricing": {"bundle": "Influencer Retainer", "engagementType": "retainer"}}]},
  {"id": "creative_campaigns", "category": "Creative Campaigns & Innovation", "description": "Develop breakthrough campaign concepts", "engagementType": "fixed_fee", "triggerPatterns": {"direct": ["need a big idea", "need a campaign concept", "want something breakthrough", "need a creative platform", "marketing lacks unifying concept", "marketing is uninspiring", "breakthrough ideas"], "indirect": ["campaigns feel tactical", "each effort is standalone", "difficulty creating memorable work", "need to differentiate", "brand awareness plateaued", "work is boring", "looks like everyone else"], "situational": ["major launch", "brand repositioning", "new market entry", "competitive threat", "company transformation", "major anniversary", "category disruption"], "performance": ["brand recall declining", "campaign metrics mediocre", "share of voice decreasing", "advertising not breaking through", "content engagement low", "creative fatigue"]}, "services": [{"name": "Creative Platform Development", "recommend": "conditional", "condition": "when there is a request for a campaign or content series for owned, earned, paid, and/or social", "pricing": {"bundle": "Creative Campaigns", "engagementType": "fixed_fee", "termLow": 2, "termHigh": 7, "budgetLow": 18000, "budgetHigh": 30000}}, {"name": "Big Idea Generation", "recommend": "conditional", "condition": "when client wants to make a splash, generate awareness, inspire media attention, or connect with audience", "pricing": {"bundle": "Creative Campaigns", "engagementType": "fixed_fee"}}, {"name": "Experiential Concepts", "recommend": "conditional", "condition": "when big idea development, media stunt, or event production are being recommended or requested", "pricing": {"bundle": "Creative Campaigns", "engagementType": "fixed_fee"}}]},
  {"id": "pr", "category": "Public Relations & Media Outreach", "description": "Media relations, press coverage, and ongoing media engagement", "engagementType": "retainer", "triggerPatterns": {"direct": ["need PR", "want media coverage", "help with press relations", "want to be in specific publications", "need a PR agency", "want to be seen as a source", "need rapid response", "earned media", "press releases", "media outreach", "journalist relationships"], "indirect": ["important news not getting coverage", "lack of third-party credibility through media", "competitors in media more", "no journalist relationships", "story not being told in the press", "need crisis preparedness", "journalists covering competitors but not us"], "situational": ["funding announcement needing press coverage", "executive hire needing media announcement", "research release needing media amplification", "crisis situation", "merger announcement needing press strategy"], "performance": ["low share of voice in media", "minimal media mentions", "negative press coverage without response", "competitors quoted more in media", "no earned media results"]}, "services": [{"name": "Media Relations", "recommend": "always", "condition": "only when client explicitly requests PR, press coverage, earned media, media relations, journalist outreach, or press releases \u2014 NOT for general awareness or reputation goals alone", "pricing": {"bundle": "Standard PR", "engagementType": "retainer", "termLow": 52, "termHigh": 52, "budgetLow": 180000, "budgetHigh": 360000, "note": "Annual retainer ($15K-$30K/month)"}}, {"name": "Narrative & Media Messaging", "recommend": "always", "condition": "Low end: $10k \u2013 if brand work/IDI\u2019s were done and translating brand into media narrative. High end: $20k \u2013 if no brand work was done and we\u2019re building media messaging and narratives from scratch (inclusive of IDIs, workshop, etc.)", "pricing": {"bundle": "Standard PR", "engagementType": "fixed_fee", "termLow": 4, "termHigh": 6, "budgetLow": 10000, "budgetHigh": 20000}}, {"name": "Media Training", "recommend": "conditional", "condition": "only when client mentions spokesperson preparation, media interviews, or executive media readiness. Low end: $3k \u2013 if training 1 exec, virtual session\nHigh end: $10k \u2013 if training multiple execs, in-person (does not include travel)", "pricing": {"engagementType": "fixed_fee", "termLow": 2, "termHigh": 4, "budgetLow": 3000, "budgetHigh": 10000, "note": "Annual or per session"}}, {"name": "Crises Plan Development", "recommend": "conditional", "condition": "only if client mentions a crisis, reputational threat, or urgent PR support to solve a pressing and immediate reputation, credibility or perception issue. Fixed-fee project priced off crisis rates\nLow-end: $15k \u2013 if developed to prepare for an identified incident\nHigh end: $40k \u2013 if developed proactively for various scenarios, inclusive of stakeholder interviews, scenario planning, holding statements, stakeholder matrixes, crisis training, plan roll-out", "pricing": {"bundle": "Crises Comms", "engagementType": "fixed_fee", "termLow": 1, "termHigh": 6, "budgetLow": 15000, "budgetHigh": 40000}}, {"name": "Crisis Communications", "recommend": "conditional", "condition": "only if client mentions a crisis, reputational threat, or urgent PR support. most of our crisis management work is done on a drawdown basis but should be priced off our crisis flat fee rates vs. standard rate card (crisis rate is higher)", "pricing": {"bundle": "Crises Comms", "engagementType": "tm", "termLow": 1, "termHigh": 6, "budgetLow": 20000, "budgetHigh": 100000, "note": "T&M based on severity"}}, {"name": "Media Monitoring", "recommend": "always", "condition": "only when PR or earned media services are already being recommended, or client specifically requests media monitoring or share of voice tracking. Should always be bundled with Media relations and Narrative & Media Messaging", "pricing": {"bundle": "Standard PR", "engagementType": "retainer", "termLow": 52, "termHigh": 52, "budgetLow": 12000, "budgetHigh": 40000, "note": "Annual, excludes tool costs"}}, {"name": "Earned Media Strategy", "recommend": "conditional", "condition": "This outlines the strategic approach to earned media execution and the plan and is needed if one does not already exist. This is part of the Standard PR bundle and is required wherever a plan or strategy for earned media does not exist.", "pricing": {"bundle": "Standard PR", "engagementType": "fixed_fee", "termLow": 2, "termHigh": 4, "budgetLow": 10000, "budgetHigh": 25000, "note": "T&M per opportunity"}}, {"name": "Announcement Strategy", "recommend": "conditional", "condition": "Specific targeted comms support to support a corporate announcement. This includes product launch, brand launch, renami, merger, Go To Market, and a high profile leadership announcment.", "pricing": {"engagementType": "fixed_fee", "termLow": 1, "termHigh": 2, "budgetLow": 5000, "budgetHigh": 10000}}, {"name": "Earned content creation", "recommend": "conditional", "condition": "Blog posts, whitepapers, long form. Based on volume and announcement pipeline. Does not include the coordination of copmplicated releases", "pricing": {"engagementType": "retainer", "termLow": 52, "termHigh": 52, "budgetLow": 12000, "budgetHigh": 60000}}, {"name": "Onsite media liaison", "recommend": "conditional", "condition": "If the cient mentions that they need on site support from their comms team as a part of an event or a visit. This should only be recomended when requested explicitly.", "pricing": {"engagementType": "fixed_fee", "termLow": 0, "termHigh": 1, "budgetLow": 5000, "budgetHigh": 10000}}, {"name": "Events and meetings travel", "recommend": "conditional", "condition": "If travel is required this should be 5% of total Public Relations & Media Outreach", "pricing": {"engagementType": "retainer", "termLow": 0, "termHigh": 0, "budgetLow": 5000, "budgetHigh": 10000}}]},
  {"id": "executive_visibility", "category": "Executive Visibility & Thought Leadership", "description": "Elevate leadership profiles and establish authority", "engagementType": "retainer", "triggerPatterns": {"direct": ["CEO needs to be more visible", "position executives as experts", "need thought leadership content", "leaders need higher profile", "leadership is invisible", "ceo profile"], "indirect": ["competitor executives more visible", "difficulty attracting talent", "investor relations need credibility", "sales cycle requires leadership trust", "industry influence desired", "board wants more visible CEO"], "situational": ["new CEO", "IPO preparation", "fundraising", "conference schedule", "speaking pipeline", "award nominations", "acquisition", "crisis"], "performance": ["low leadership recognition", "executive content not engaging", "speaking invitations not coming", "board feedback about visibility", "LinkedIn engagement low", "not invited to speak"]}, "services": [{"name": "Executive Positioning Strategy", "recommend": "always", "condition": "for all executive visibility projects - should be receommended when a c;lient states that they are havining issues with credibility, or are struglgling to get explosure for their leadership acrross tehir industry.", "pricing": {"bundle": "Executive Visibility", "engagementType": "retainer", "termLow": 52, "termHigh": 52, "budgetLow": 60000, "budgetHigh": 180000, "note": "Annual retainer ($5K-$15K/month per executive)"}}, {"name": "Thought Leadership Content", "recommend": "always", "condition": "for all executive visibility projects", "pricing": {"bundle": "Executive Visibility", "engagementType": "retainer"}}, {"name": "Byline & Op-Ed Development", "recommend": "conditional", "condition": "only when written thought leadership is requested", "pricing": {"bundle": "Executive Visibility", "engagementType": "retainer"}}, {"name": "Speaking Opportunity Strategy", "recommend": "conditional", "condition": "only when speaking engagements are requested", "pricing": {"engagementType": "fixed_fee", "termLow": 1, "termHigh": 3, "budgetLow": 5000, "budgetHigh": 10000}}, {"name": "Onsite Media & Exec Support", "recommend": "conditional", "condition": "only When requested or speaking events are suggested.", "pricing": {"engagementType": "fixed_fee", "termLow": 1, "termHigh": 1, "budgetLow": 5000, "budgetHigh": 8000}}, {"name": "Executive Social Media Strategy", "recommend": "conditional", "condition": "only when LinkedIn or social presence for company leaders, board or advocates is requested", "pricing": {"engagementType": "fixed_fee", "termLow": 1, "termHigh": 3, "budgetLow": 5000, "budgetHigh": 10000}}, {"name": "Awards Strategy", "recommend": "conditional", "condition": "only when when recognition programs are requested", "pricing": {"engagementType": "fixed_fee", "termLow": 1, "termHigh": 1, "budgetLow": 5000, "budgetHigh": 8000}}, {"name": "Podcast Guest Strategy", "recommend": "conditional", "condition": "only when podcast appearances are requested", "pricing": {"engagementType": "fixed_fee", "termLow": 1, "termHigh": 1, "budgetLow": 5000, "budgetHigh": 8000}}]},
  {"id": "paid_media", "category": "Paid Media", "description": "Social advertising campaigns", "engagementType": "fixed_fee", "triggerPatterns": {"direct": ["need social media ads", "want paid social campaigns", "help with Facebook/Instagram/LinkedIn ads", "social ads aren\\'t working"], "indirect": ["organic reach declining", "need precise targeting", "have budget but no expertise", "campaigns underperforming", "need lead generation"], "situational": ["campaign launch", "product launch", "event promotion", "time-sensitive offers", "competitive pressure on social"], "performance": ["high CPA on social", "low conversion rates", "ad fatigue", "poor targeting results", "ROAS below benchmarks"]}, "services": [{"name": "Paid Strategy", "recommend": "always", "condition": "when paid media, acquiring new audiences or extending reach with paid dlars is discussed. This is always presented when there is not yet a strategy to execute a requested paid media campaign.", "pricing": {"bundle": "Paid Media Strategy", "engagementType": "fixed_fee", "termLow": 2, "termHigh": 6, "budgetLow": 10000, "budgetHigh": 30000, "note": "Annual retainer, excludes media spend"}}, {"name": "Campaign Setup & Management", "recommend": "conditional", "condition": "when paid media is discussed. This is always required when we are requested to do execution and not just the upfront strategy. This should be presented as a 10% of the paid spend figure quoted by prospect or client. If no paid spend is shared than use the range for this service.", "pricing": {"bundle": "Paid Media Execution", "engagementType": "fixed_fee", "termLow": 4, "termHigh": 52, "budgetLow": 10000, "budgetHigh": 100000}}, {"name": "Audience Development & Targeting", "recommend": "conditional", "condition": "When client confirms that they either dont know whoe tehir audience is or they have not done any research into where that audience can be reached.", "pricing": {"bundle": "Paid Media Execution", "engagementType": "fixed_fee", "termLow": 2, "termHigh": 4, "budgetLow": 10000, "budgetHigh": 20000}}, {"name": "Ad Creative Development", "recommend": "conditional", "condition": "Offered as a creative retainer. This is time and material and is offered with a minimum spend of $24k per year", "pricing": {"bundle": "Paid Media Execution", "engagementType": "tm", "termLow": 4, "termHigh": 52, "budgetLow": 24000, "budgetHigh": 60000}}, {"name": "Paid Media Reporting", "recommend": "always", "condition": "Offer an economy of scale if reporting for both paid media and scoal media selected. This should present costs as two thirds of teh ranges here fore each when both are selected.", "pricing": {"bundle": "Paid Media Execution", "engagementType": "fixed_fee", "termLow": 4, "termHigh": 52, "budgetLow": 8000, "budgetHigh": 60000}}]},
  {"id": "social_media", "category": "Social Media", "description": "Social media strategy, community management, and content", "engagementType": "retainer", "triggerPatterns": {"direct": ["need social media help", "social media strategy", "we need to be on social", "social channels", "community management"], "indirect": ["no social presence", "social channels inactive", "competitors active on social", "need to engage audiences online", "brand not represented on social platforms"], "situational": ["brand launch needing social presence", "campaign requiring social amplification", "new channels to set up", "social content needs"], "performance": ["low social engagement", "follower growth stalled", "social content not resonating", "no community engagement"]}, "services": [{"name": "Social Media Strategy", "recommend": "always", "condition": "when a client or prospect mentions needing social, or if they outline a need to nurture and build audience, or they dontt know what social channels to be on.", "pricing": {"bundle": "Social Media Strategy", "engagementType": "retainer", "termLow": 2, "termHigh": 6, "budgetLow": 15000, "budgetHigh": 25000, "note": "Annual retainer, excludes media spend"}}, {"name": "Channel Planning", "recommend": "always", "condition": "Always alongside the social media strategy to identify which cvhannels to use and how", "pricing": {"bundle": "Social Media Strategy", "engagementType": "retainer"}}, {"name": "Channel Set Up", "recommend": "conditional", "condition": "If they need to set up an optimimze their social channels based upon a clear brand and social strategy. Includes a little creative for profile and hero image and bio.", "pricing": {"bundle": "Social Execution", "engagementType": "fixed_fee", "termLow": 1, "termHigh": 3, "budgetLow": 10000, "budgetHigh": 20000}}, {"name": "Community Management", "recommend": "conditional", "condition": "If the client wants ongoing management of tehir socisl channels. INcludes engagement, postyinga nd montoring for dverse events.Ongoing management of social communities. This is sold as a monthly cost starting at $4k per month", "pricing": {"bundle": "Social Execution", "engagementType": "retainer", "termLow": 4, "termHigh": 52, "budgetLow": 4000, "budgetHigh": 60000}}, {"name": "Social creative", "recommend": "conditional", "condition": "For ongoing social content creation not for a specific activation or campaign. When content is needed. Offered as a creative retainer. This is time and material and is offered with a minimum spend of $24k per year", "pricing": {"bundle": "Social Execution", "engagementType": "tm", "termLow": 4, "termHigh": 52, "budgetLow": 24000, "budgetHigh": 60000}}, {"name": "Social Media Reporting", "recommend": "conditional", "condition": "Offer an economy of scale if reporting for both paid media and scoal media selected. This should present costs as two thirds of the ranges here fore each when both are selected.", "pricing": {"bundle": "Social Execution", "engagementType": "fixed_fee", "termLow": 4, "termHigh": 52, "budgetLow": 8000, "budgetHigh": 60000}}]},
  {"id": "seo", "category": "Search Engine Optimization", "description": "Improve organic search visibility", "engagementType": "fixed_fee", "triggerPatterns": {"direct": ["don\\'t rank on Google", "need SEO help", "organic traffic declining", "want to rank for keywords"], "indirect": ["website not appearing in search", "competitors outranking us", "paid search costs too high", "content not getting discovered", "technical website issues"], "situational": ["website redesign", "new content strategy", "competitive threat in search", "market expansion", "algorithm update impact"], "performance": ["declining organic traffic", "keyword rankings dropping", "low domain authority", "high reliance on paid search", "competitor visibility increasing"]}, "services": [{"name": "SEO Strategy & Audit", "recommend": "always", "condition": "for all SEO engagements or to solve problems with website visibility.", "pricing": {"bundle": "SEO Strategy", "engagementType": "fixed_fee", "termLow": 4, "termHigh": 8, "budgetLow": 20000, "budgetHigh": 35000, "note": "Annual retainer ($5K-$10K/month), 6-month minimum"}}, {"name": "Technical SEO", "recommend": "always", "condition": "for all SEO engagements", "pricing": {"bundle": "SEO Strategy", "engagementType": "fixed_fee"}}, {"name": "Critical SEO Assessment", "recommend": "conditional", "condition": "If they dont know what SEO statsus is or the problem they need to solve", "pricing": {"bundle": "SEO Strategy", "engagementType": "fixed_fee"}}, {"name": "Content SEO Strategy", "recommend": "conditional", "condition": "when content marketing is included", "pricing": {"bundle": "SEO Strategy", "engagementType": "fixed_fee"}}, {"name": "On-Page Optimization", "recommend": "conditional", "condition": "for all SEO engagements", "pricing": {"bundle": "SEO Execution", "engagementType": "fixed_fee", "termLow": 4, "termHigh": 12, "budgetLow": 24000, "budgetHigh": 60000}}, {"name": "Link Building", "recommend": "conditional", "condition": "when off-page SEO is requested", "pricing": {"bundle": "SEO Execution", "engagementType": "fixed_fee"}}, {"name": "Local SEO", "recommend": "conditional", "condition": "when local/geographic targeting is needed", "pricing": {"bundle": "SEO Execution", "engagementType": "fixed_fee"}}, {"name": "SEO Reporting", "recommend": "conditional", "condition": "for all SEO engagements", "pricing": {"bundle": "SEO Reporting", "engagementType": "retainer", "termLow": 4, "termHigh": 52, "budgetLow": 4000, "budgetHigh": 40000}}]},
  {"id": "orm", "category": "Online Reputation Management (ORM)", "description": "Online reputation management and brand perception", "engagementType": "fixed_fee", "triggerPatterns": {"direct": ["online reputation", "brand perception online", "what people see when they search us", "reputation management"], "indirect": ["negative search results", "outdated information online", "Wikipedia page needs updating", "Reddit threads about us", "AI tools saying wrong things about us"], "situational": ["reputation issue discovered", "negative coverage persisting in search", "competitive misinformation", "brand perception audit"], "performance": ["negative sentiment in search results", "inaccurate brand information online", "competitors controlling narrative", "AI-generated misinformation"]}, "services": [{"name": "GEO Strategy & Audit", "recommend": "always", "condition": "Where there is a problem or opportunity to shape or improve how a brand appears on LLM  or AI search. Recommend if client is having issues with reputation or perception.", "pricing": {"bundle": "GEO Strategy", "engagementType": "fixed_fee", "termLow": 1, "termHigh": 4, "budgetLow": 10000, "budgetHigh": 20000, "note": "Annual retainer, often bundled with SEO"}}]},
  {"id": "geo", "category": "Generative Engine Optimization (ORM)", "description": "Optimize for AI-powered search", "engagementType": "fixed_fee", "triggerPatterns": {"direct": ["need to show up in AI search", "want to be cited by ChatGPT", "optimize for AI answers"], "indirect": ["concern about AI changing search", "questions about future of organic search", "interest in emerging search", "competitors in AI content"], "situational": ["AI search feature launches", "industry AI conversations", "competitive monitoring", "future planning"], "performance": ["declining traditional search traffic", "absence from AI answers", "competitors cited in AI", "audience behavior changing"]}, "services": [{"name": "Reddit Optimization", "recommend": "conditional", "condition": "Reddit Optimization program. If the clientcrequires an improvement to Reddit channel", "pricing": {"bundle": "GEO Execution", "engagementType": "fixed_fee", "termLow": 4, "termHigh": 6, "budgetLow": 20000, "budgetHigh": 30000}}, {"name": "Wikipedia Optimization", "recommend": "conditional", "condition": "Wikipedia Optimization program. If the client requires an improvement to Wikipedia channel", "pricing": {"bundle": "GEO Execution", "engagementType": "fixed_fee", "termLow": 3, "termHigh": 4, "budgetLow": 10000, "budgetHigh": 15000}}, {"name": "Earned Strategy for GEO", "recommend": "conditional", "condition": "GEO focused Earned Strategy Enhancement. When we are doing earned and their is a request to limprove visibility, repur=tation and differentiation on LLMs and AI.", "pricing": {"bundle": "GEO Execution", "engagementType": "fixed_fee", "termLow": 2, "termHigh": 4, "budgetLow": 10000, "budgetHigh": 15000}}]},
  {"id": "integrated_measurement", "category": "Integrated Measurement & Analytics", "description": "Unified measurement across earned, social, paid channels", "engagementType": "fixed_fee", "triggerPatterns": {"direct": ["need integrated reporting", "unified dashboard", "cross-channel measurement", "integrated measurement framework"], "indirect": ["can't see how channels work together", "reporting is siloed", "no unified view of performance", "different teams report differently"], "situational": ["launching integrated campaign", "multiple agencies need unified reporting", "board wants holistic marketing view"], "performance": ["can't attribute results across channels", "no integrated performance view", "conflicting reports from different channels"]}, "services": [{"name": "Analytics Strategy & Measurement Framework", "recommend": "always", "condition": "When there is an integrated program touching any combination of earned, social, web and paid. When selected this supercedes the need for standallone reporting for paid and social", "pricing": {"bundle": "Integrated Measurement Strategy", "engagementType": "fixed_fee", "termLow": 2, "termHigh": 4, "budgetLow": 10000, "budgetHigh": 20000}}]},
  {"id": "measurement", "category": "Measurement & Analytics", "description": "Track and prove marketing ROI", "engagementType": "fixed_fee", "triggerPatterns": {"direct": ["don\\'t know if marketing is working", "need better reporting", "need to track performance", "can\\'t prove ROI"], "indirect": ["decisions without data", "tools not integrated", "leadership asking for accountability", "budget justification challenges", "unclear attribution"], "situational": ["new leadership demanding accountability", "budget review", "board reporting", "marketing technology audit", "new initiatives"], "performance": ["can\\'t report on basic metrics", "data conflicts between systems", "no baseline", "unknown customer journey", "efficiency unclear"]}, "services": [{"name": "Integrated Dashboard Development", "recommend": "conditional", "condition": "when reporting visualization is requested", "pricing": {"bundle": "Integrated Measurement Strategy", "engagementType": "fixed_fee", "termLow": 2, "termHigh": 4, "budgetLow": 10000, "budgetHigh": 20000}}, {"name": "Attribution Modeling", "recommend": "conditional", "condition": "when multi-channel attribution is needed", "pricing": {"bundle": "Integrated Measurement Strategy", "engagementType": "fixed_fee", "termLow": 1, "termHigh": 2, "budgetLow": 10000, "budgetHigh": 20000}}, {"name": "Marketing ROI Framework", "recommend": "conditional", "condition": "for all measurement engagements", "pricing": {"bundle": "Integrated Measurement Strategy", "engagementType": "fixed_fee", "termLow": 2, "termHigh": 3, "budgetLow": 10000, "budgetHigh": 20000}}, {"name": "KPI Development", "recommend": "conditional", "condition": "for all measurement engagements", "pricing": {"bundle": "Integrated Measurement Strategy", "engagementType": "fixed_fee", "termLow": 1, "termHigh": 2, "budgetLow": 10000, "budgetHigh": 20000}}, {"name": "Data Integration", "recommend": "conditional", "condition": "when multiple data sources need connecting", "pricing": {"bundle": "Integrated Measurement Strategy", "engagementType": "fixed_fee", "termLow": 2, "termHigh": 4, "budgetLow": 20000, "budgetHigh": 30000}}, {"name": "Reporting", "recommend": "always", "condition": "When there is a need to report on integrated campaign impact, and recommend optimizations, A/B tests or changes to creative and strategy.", "pricing": {"bundle": "Integrated Reporting", "engagementType": "retainer", "termLow": 52, "termHigh": 52, "budgetLow": 30000, "budgetHigh": 40000}}]},
  {"id": "gtm", "category": "Go-to-Market Strategy", "description": "Launch products and enter markets", "engagementType": "fixed_fee", "triggerPatterns": {"direct": ["launching a new product", "need a GTM strategy", "need to bring this to market", "entering a new market"], "indirect": ["uncertainty about target audience", "no launch plan", "pricing and positioning questions", "channel strategy unclear", "sales and marketing alignment needed"], "situational": ["product development completion", "service line expansion", "market expansion", "competitive response", "acquisition of new capabilities"], "performance": ["previous launches underperformed", "new product uptake slow", "market penetration below expectations", "customer acquisition challenges", "sales cycle too long"]}, "services": [{"name": "Go-to-Market Strategy", "recommend": "always", "condition": "for all GTM projects", "pricing": {"bundle": "GTM Strategy", "engagementType": "fixed_fee", "termLow": 1, "termHigh": 3, "budgetLow": 10000, "budgetHigh": 30000}}, {"name": "Launch Planning", "recommend": "always", "condition": "for all GTM projects", "pricing": {"bundle": "GTM Strategy", "engagementType": "fixed_fee"}}, {"name": "Market Entry Strategy", "recommend": "conditional", "condition": "when entering new markets", "pricing": {"bundle": "GTM Strategy", "engagementType": "fixed_fee"}}, {"name": "Channel Strategy", "recommend": "conditional", "condition": "when distribution channels need defining", "pricing": {"bundle": "GTM Strategy", "engagementType": "fixed_fee"}}, {"name": "Sales Enablement", "recommend": "conditional", "condition": "when sales team support is needed", "pricing": {"bundle": "GTM Strategy", "engagementType": "fixed_fee"}}]},
  {"id": "events", "category": "Event Planning & Production", "description": "Plan and execute events", "engagementType": "fixed_fee", "triggerPatterns": {"direct": ["have an event coming up", "need to plan a conference", "need event support"], "indirect": ["team doesn\\'t have event experience", "past events had issues", "budget requires professional management", "complex logistics", "need creative concepts"], "situational": ["annual conference", "product launch event", "customer events", "trade show", "employee events", "milestone celebrations", "investor events"], "performance": ["event feedback poor", "attendance declining", "event ROI unclear", "logistics challenges", "content quality inconsistent"]}, "services": [{"name": "Event Strategy", "recommend": "always", "condition": "for all event projects", "pricing": {"bundle": "Event Strategy", "engagementType": "fixed_fee", "termLow": 4, "termHigh": 6, "budgetLow": 10000, "budgetHigh": 20000, "note": "Excludes venue and vendor costs"}}, {"name": "Event Production", "recommend": "always", "condition": "for all event projects", "pricing": {"bundle": "Event Production", "engagementType": "fixed_fee", "termLow": 4, "termHigh": 12, "budgetLow": 15000, "budgetHigh": 100000}}, {"name": "Virtual Event Production", "recommend": "conditional", "condition": "when virtual or hybrid events are needed", "pricing": {"bundle": "Event Production", "engagementType": "fixed_fee", "termLow": 2, "termHigh": 4, "budgetLow": 15000, "budgetHigh": 30000}}, {"name": "Trade Show Management", "recommend": "conditional", "condition": "when trade show participation is involved", "pricing": {"bundle": "Event Production", "engagementType": "fixed_fee", "termLow": 2, "termHigh": 4, "budgetLow": 15000, "budgetHigh": 30000}}, {"name": "Speaker Management", "recommend": "conditional", "condition": "when speakers need coordination", "pricing": {"bundle": "Event Production", "engagementType": "fixed_fee", "termLow": 2, "termHigh": 4, "budgetLow": 5000, "budgetHigh": 15000}}, {"name": "Event Marketing", "recommend": "conditional", "condition": "when event promotion is needed", "pricing": {"bundle": "Event Marketing", "engagementType": "fixed_fee", "termLow": 2, "termHigh": 6, "budgetLow": 10000, "budgetHigh": 20000}}]},
  {"id": "training", "category": "Communications Training", "description": "Media and communications training", "engagementType": "fixed_fee", "triggerPatterns": {"direct": ["team needs media training", "need communications training", "executives need spokesperson prep", "want internal training"], "indirect": ["executives uncomfortable with media", "teams lack marketing skills", "inconsistent brand representation", "new hires need onboarding", "crisis preparedness concerns"], "situational": ["new spokesperson", "upcoming media tour", "crisis preparation", "marketing team expansion", "leadership changes", "brand launch"], "performance": ["poor media interview performance", "inconsistent external communication", "brand message dilution", "crisis response failures", "employee communications issues"]}, "services": [{"name": "Media & Spokesperson Training", "recommend": "always", "condition": "for all communications training", "pricing": {"bundle": "Communications Training", "engagementType": "fixed_fee", "termLow": 2, "termHigh": 4, "budgetLow": 20000, "budgetHigh": 50000, "note": "Per session or program"}}, {"name": "Presentation Training", "recommend": "conditional", "condition": "when presentation skills are needed", "pricing": {"bundle": "Communications Training", "engagementType": "fixed_fee"}}, {"name": "Crisis Communications Training", "recommend": "conditional", "condition": "when crisis preparedness is needed", "pricing": {"bundle": "Communications Training", "engagementType": "fixed_fee"}}, {"name": "Brand Training", "recommend": "conditional", "condition": "when brand alignment training is needed", "pricing": {"bundle": "Communications Training", "engagementType": "fixed_fee"}}]},
  {"id": "impact", "category": "Impact & Purpose Communications", "description": "Sustainability, impact, and purpose communications", "engagementType": "fixed_fee", "triggerPatterns": {"direct": ["need an annual report", "need an impact report", "need help with CSR report", "want to showcase our impact", "impact story", "sustainability story", "esg communications", "purpose driven"], "indirect": ["stakeholder expectations for transparency", "ESG reporting requirements", "investor relations needs", "employee engagement communications", "competitor reports setting higher bar", "customers want to know our values"], "situational": ["annual reporting cycle", "sustainability milestones", "stakeholder meeting", "grant reporting", "public accountability", "B Corp certification"], "performance": ["stakeholder feedback on transparency", "competitor reports more compelling", "internal data not shared", "impact not being communicated", "brand purpose scores low"]}, "services": [{"name": "Impact Report Writing & Design", "recommend": "always", "condition": "when impact/sustainability report is needed", "pricing": {"bundle": "Impact Reporting", "engagementType": "fixed_fee", "termLow": 4, "termHigh": 12, "budgetLow": 40000, "budgetHigh": 80000}}, {"name": "Sustainability Communications Messaging", "recommend": "conditional", "condition": "when sustainability messaging is needed", "pricing": {"bundle": "Impact Communications", "engagementType": "fixed_fee", "termLow": 3, "termHigh": 5, "budgetLow": 15000, "budgetHigh": 20000}}, {"name": "Purpose Discovery Workshop", "recommend": "conditional", "condition": "when purpose definition is needed", "pricing": {"bundle": "Impact Communications", "engagementType": "fixed_fee", "termLow": 1, "termHigh": 2, "budgetLow": 8000, "budgetHigh": 10000}}]},
  {"id": "content_production", "category": "Content Ideation & Production", "description": "Content strategy and creation", "engagementType": "fixed_fee", "triggerPatterns": {"direct": ["need more content", "need a content strategy", "run out of ideas", "need help producing content"], "indirect": ["content calendar empty", "publishing frequency declined", "team stretched too thin", "quality inconsistent", "topics not resonating"], "situational": ["blog launch", "newsletter launch", "podcast initiative", "video series", "campaign content", "thought leadership program"], "performance": ["content engagement declining", "audience growth stalled", "SEO content needed", "social content underperforming", "lead magnet requests"]}, "services": [{"name": "Content Strategy", "recommend": "always", "condition": "when client needs creative (designed or animated content to be produced", "pricing": {"bundle": "Content Strategy", "engagementType": "fixed_fee", "termLow": 2, "termHigh": 4, "budgetLow": 15000, "budgetHigh": 30000, "note": "Fixed Fee deliverable"}}, {"name": "Content Calendar Development", "recommend": "always", "condition": "when client needs content produced and distributed over time", "pricing": {"bundle": "Content Strategy", "engagementType": "tm", "termLow": 2, "termHigh": 4, "note": "Annual T&M based on volume"}}, {"name": "Blog & Article Writing", "recommend": "conditional", "condition": "only if requested or included in Additional Notes. For client or prospects own channels or to gues write on a partners channel when they are looking for greater visibility for leaders.", "pricing": {"bundle": "Content Production", "engagementType": "tm", "termLow": 1, "termHigh": 2, "budgetLow": 3500, "budgetHigh": 8000, "note": "T&M ongoing"}}, {"name": "Podcast Production", "recommend": "conditional", "condition": "only if requested or included in Additional Notes", "pricing": {"bundle": "Content Production", "engagementType": "tm", "termLow": 1, "termHigh": 2, "budgetLow": 3500, "budgetHigh": 10000}}, {"name": "Video Content Series", "recommend": "conditional", "condition": "only if requested or included in Additional Notes", "pricing": {"bundle": "Content Production", "engagementType": "tm", "termLow": 2, "termHigh": 4, "budgetLow": 10000, "budgetHigh": 50000}}, {"name": "Thought Leadership Content", "recommend": "conditional", "condition": "These is when client needs articles ghost written for them in teh voice of their brand or executives", "pricing": {"bundle": "Content Production", "engagementType": "tm", "termLow": 1, "termHigh": 2, "budgetLow": 6000, "budgetHigh": 10000}}, {"name": "Social Content Creation (Reactive)", "recommend": "conditional", "condition": "only if requested or social media management needed and reactive content that hacks into news stories and responds to current events and competitor activity. Sold as a retainer that includes story mining, ideation adn production. All quick production and approvals.", "pricing": {"bundle": "Reactive Content Engine", "engagementType": "tm", "termLow": 52, "termHigh": 52, "budgetLow": 60000, "budgetHigh": 120000}}]},
  {"id": "operational_support", "category": "Operational Support", "description": "Coordinate complex marketing initiatives", "engagementType": "retainer", "triggerPatterns": {"direct": ["need help managing projects", "overwhelmed with coordination", "need a PM", "need onboarding support", "need someone to manage vendors"], "indirect": ["projects always late", "over budget", "multiple agencies not coordinated", "quality control problems", "no project management"], "situational": ["complex campaign launch", "multiple initiatives", "major event", "organizational change", "agency consolidation", "first engagement"], "performance": ["missed deadlines", "budget overruns", "quality inconsistencies", "team burnout", "stakeholder dissatisfaction"]}, "services": [{"name": "Project Management", "recommend": "always", "condition": "when PM support is requested", "pricing": {"engagementType": "retainer", "termLow": 52, "termHigh": 52, "percentageOfProject": 10.0, "note": "Approximately 15% of total project fee. Not required on PR/Earned-only engagements."}}, {"name": "Marketing Operations", "recommend": "conditional", "condition": "when paid media is included and operational support is needed", "pricing": {"engagementType": "retainer", "termLow": 52, "termHigh": 52, "percentageOfPaidMedia": 10.0, "note": "~10% of paid media management fees"}}, {"name": "Cross-agency Coordination", "recommend": "conditional", "condition": "when cross agency coordimnation is requested to manage other third party vendors or agencies.", "pricing": {"engagementType": "retainer", "termLow": 52, "termHigh": 52, "budgetLow": 24000, "budgetHigh": 50000}}, {"name": "Onboarding", "recommend": "conditional", "condition": "required if first engagment to onboard to ways of working and existing platforms so we can be afective.", "pricing": {"engagementType": "fixed_fee", "termLow": 1, "termHigh": 2, "budgetLow": 5000, "budgetHigh": 15000, "note": "$5K-$10K/month, for managing other agencies, partners and third parties"}}, {"name": "Client Side Project Management", "recommend": "conditional", "condition": "If we need top offer project management support to help coordinate clients internal operation. Project Management as a service,", "pricing": {"engagementType": "retainer", "termLow": 52, "termHigh": 52, "budgetLow": 60000, "budgetHigh": 120000}}]}
];

const FIT_ARCHETYPES = {
  architect: {
    id: 'architect',
    title: 'Architect',
    emoji: '📐',
    short: 'Strategic & Systematic',
    description: 'Values systematic approaches, formal planning, and proven methodologies.',
    // Categories to boost — conditional services in these become auto-selected
    boostCategories: ['integrated_strategy', 'brand', 'executive_visibility', 'measurement', 'pr', 'training'],
    // Specific services to auto-select if the category is detected
    boostServices: [
      'Marketing Strategy Development', 'Customer Journey Mapping', 'Marketing Audit & Assessment (Compass)',
      'Brand Research (Compass)', 'Stakeholder Interviews (IDIs)', 'Brand Workshop',
      'Analytics Strategy & Measurement Framework', 'KPI Development', 'Marketing ROI Framework',
      'Executive Positioning Strategy', 'Brand Guidelines'
    ],
    sowGuidance: `CLIENT FIT ARCHETYPE: ARCHITECT
This client values strategic thinking and systematic approaches. The SOW should:
- Emphasize strategic rationale and methodology behind each recommendation
- Include detailed phasing with clear dependencies between workstreams
- Present formal review and governance structures
- Frame deliverables in terms of long-term brand and business impact
- Use language that conveys thoughtful planning: "strategic framework", "phased approach", "stakeholder alignment"
- Include robust reporting and measurement sections
- Emphasize proven methodologies and industry best practices`,
    waysOfWorking: `WAYS OF WORKING — ARCHITECT CLIENT
Governance & Process:
- Formal kickoff with comprehensive briefing and stakeholder alignment session
- Structured governance model: Steering committee reviews at phase gates, working team reviews bi-weekly
- All strategic recommendations presented in formal deck format with data rationale
- Phased work plans with clear dependencies — each phase has defined entry/exit criteria before proceeding
- Change requests require written submission and formal impact assessment before approval

Communication Cadence:
- Bi-weekly status reports with progress against milestones, budget tracking, and risk register
- Monthly strategic review meetings with senior stakeholders
- Quarterly business reviews assessing program-level impact against objectives
- All deliverables accompanied by strategic rationale documentation

Approval & Decision Flow:
- Defined approval hierarchy: day-to-day decisions via designated point of contact, strategic decisions via steering committee
- Client provides consolidated feedback representing unified organizational direction within agreed windows
- Formal sign-off required at each phase gate before subsequent work commences

Reporting & Documentation:
- Comprehensive project documentation maintained throughout engagement
- Post-phase retrospectives with lessons learned and optimization recommendations
- Final engagement report summarizing outcomes against stated objectives`,
    pricingGuidance: `PRICING APPROACH — ARCHITECT CLIENT
- Frame fees as investment in strategic foundation and long-term brand building
- Present comprehensive, all-inclusive phase pricing — Architects prefer clarity over modular á la carte
- Emphasize the value of thorough upfront strategy to prevent costly rework downstream
- Structure payments around phase gates and milestone approvals
- Include detailed assumptions section — Architects want to understand what underlies the pricing
- Where applicable, present multi-year or programmatic pricing that rewards sustained commitment
- Include rate card for additional work but position it as exception, not expectation`
  },
  visionary: {
    id: 'visionary',
    title: 'Visionary',
    emoji: '✨',
    short: 'Creative & Bold',
    description: 'Prioritizes authentic brand expression, breakthrough ideas, and bold creative risks.',
    boostCategories: ['brand', 'creative_production', 'creative_campaigns', 'influencer', 'content_ideation'],
    boostServices: [
      'Creative Platform Development', 'Big Idea Generation', 'Experiential Concepts',
      'Tone of Voice', 'Manifesto', 'Visual Identity System', 'Logo/Wordmark Development',
      'Graphic Design', 'Video Production', 'Animation & Motion Graphics',
      'Influencer Strategy', 'Content Strategy'
    ],
    sowGuidance: `CLIENT FIT ARCHETYPE: VISIONARY
This client values creative breakthrough and authentic expression. The SOW should:
- Lead with creative ambition and the opportunity for breakthrough work
- Frame services as collaborative creative partnerships, not just deliverables
- Emphasize creative exploration phases and concept development
- Lean toward creative retainers and retained creative services for ongoing inspiration
- Use language that conveys creative ambition: "breakthrough concepts", "authentic expression", "creative exploration"
- Include creative workshops and collaborative ideation sessions
- Describe revision processes as "creative refinement" rather than correction cycles
- Emphasize brand storytelling and cultural relevance`,
    waysOfWorking: `WAYS OF WORKING — VISIONARY CLIENT
Creative Partnership Model:
- Immersive kickoff: Deep-dive brand immersion session including culture, mission, aesthetic references, and creative ambitions
- Collaborative creative workshops at key moments — Agency brings provocative stimulus; Client brings brand truth
- Creative exploration phase built into every engagement before execution begins — space to ideate without constraint
- Concept presentations as storytelling moments: show the journey from insight to idea, not just final output
- Creative refinement rounds (not "revisions") — iterative evolution toward breakthrough, not correction cycles

Communication Cadence:
- Regular creative check-ins: informal, visual, collaborative — share mood boards, references, work-in-progress
- Status updates focused on creative narrative and brand journey, not just task completion
- Quarterly inspiration sessions: Agency proactively brings cultural trends, competitive creative, and breakthrough opportunities
- Open creative dialogue encouraged between sessions — this is a partnership, not a vendor relationship

Approval & Decision Flow:
- Creative direction established collaboratively at outset — shared vision document as ongoing reference
- Client empowered to make bold creative decisions quickly — minimize approval layers that dilute ideas
- Feedback framed as creative direction, not prescriptive edits: "we want it to feel more…" not "change the font to…"
- Agency retains creative recommendation authority — Client trusts Agency to push boundaries while respecting brand truth

Reporting & Documentation:
- Portfolio-style creative reviews showcasing body of work and brand evolution
- Impact measured through brand expression metrics: distinctiveness, cultural relevance, creative recognition
- End-of-engagement creative retrospective: what we built, what we learned, where the brand goes next`,
    pricingGuidance: `PRICING APPROACH — VISIONARY CLIENT
- Frame fees as investment in creative partnership and brand differentiation
- Lean toward creative retainers and T&M with minimum commitment — Visionaries need ongoing creative access, not one-off projects
- Include dedicated creative exploration / concept development budgets as line items — this isn't overhead, it's the work
- Structure retained creative services with monthly creative commitment rather than rigid deliverable counts
- Position premium pricing confidently — breakthrough creative commands premium investment
- For project work, include concept development phase pricing separately from production execution
- Build in flexibility for inspiration-driven pivots without triggering change orders for every creative evolution`
  },
  accelerator: {
    id: 'accelerator',
    title: 'Accelerator',
    emoji: '📊',
    short: 'Performance & Data-Driven',
    description: 'Demands measurable results, data-driven decisions, and performance optimization.',
    boostCategories: ['paid_media', 'social_media', 'measurement', 'integrated_measurement', 'seo', 'geo'],
    boostServices: [
      'Conversion Rate Optimization', 'On-Page Optimization', 'SEO Reporting',
      'Analytics Strategy & Measurement Framework', 'Integrated Dashboard Development', 'Attribution Modeling', 'Marketing ROI Framework', 'KPI Development',
      'Paid Strategy', 'Paid Media Reporting', 'Campaign Setup & Management',
      'SEO Strategy & Audit', 'Reporting'
    ],
    sowGuidance: `CLIENT FIT ARCHETYPE: ACCELERATOR
This client values measurable performance and data-driven optimization. The SOW should:
- Lead with KPIs, success metrics, and measurable outcomes for every service
- Include robust measurement frameworks and reporting cadences
- Emphasize performance marketing, A/B testing, and optimization cycles
- Include dashboard development and real-time performance visibility
- Use language that conveys accountability: "measurable outcomes", "KPI targets", "data-driven optimization"
- Frame creative work in terms of conversion impact and performance metrics
- Include regular performance review cadences (weekly/monthly)
- Define clear benchmarks and improvement targets within 90-day windows`,
    waysOfWorking: `WAYS OF WORKING — ACCELERATOR CLIENT
Performance-Driven Operations:
- Data-first kickoff: Establish baseline metrics, define KPIs, agree on measurement framework and attribution model before work begins
- 90-day goal cycles: All work structured around quarterly performance targets with mid-cycle optimization checkpoints
- Test-measure-optimize loop built into every workstream — no creative or strategy ships without a hypothesis and success metric
- Weekly optimization cadence: Agency reviews performance data and makes tactical adjustments within pre-approved parameters
- Continuous A/B testing protocol: systematic testing calendar for creative, messaging, audiences, and channels

Communication Cadence:
- Real-time performance dashboards with Client access — no waiting for reports to see what's working
- Weekly performance pulse: brief data-driven update on key metrics, wins, and optimization actions taken
- Monthly deep-dive performance reviews with trend analysis, test results, and next optimization priorities
- Quarterly strategic reviews connecting performance data to business outcomes and adjusting targets

Approval & Decision Flow:
- Pre-approved optimization parameters: Agency authorized to make tactical changes (bid adjustments, creative rotation, audience refinement) within defined boundaries without per-change approval
- Strategic pivots (new channels, significant budget reallocation, messaging overhaul) require Client approval with data justification
- Decisions backed by data — Agency presents options with projected performance impact; Client decides based on numbers
- Rapid approval process: 24-48 hour turnaround on optimization recommendations to maintain momentum

Reporting & Documentation:
- Automated performance dashboards updated daily/weekly
- Monthly performance reports with clear KPI tracking, trend analysis, and actionable recommendations
- Test log documenting all experiments, hypotheses, results, and learnings
- Quarterly business impact assessment connecting marketing performance to revenue and growth metrics`,
    pricingGuidance: `PRICING APPROACH — ACCELERATOR CLIENT
- Frame fees in terms of performance investment and measurable return
- Include measurement and analytics setup as a foundational line item — not optional, essential
- Structure ongoing services around optimization cycles with clear performance benchmarks
- Consider performance review cadences as part of the service value, not administrative overhead
- Present pricing with associated KPIs: "This investment targets [X] improvement in [metric] within [timeframe]"
- Include dashboard development and reporting infrastructure in the initial scope — Accelerators need visibility from day one
- For retainers, emphasize efficiency gains over time: optimization drives more value from the same investment
- Budget for systematic A/B testing — position it as essential to performance improvement, not discretionary`
  },
  entrepreneur: {
    id: 'entrepreneur',
    title: 'Entrepreneur',
    emoji: '🚀',
    short: 'Fast & Action-Oriented',
    description: 'Needs flexible, action-oriented partnerships with quick wins at entrepreneurial pace.',
    boostCategories: ['gtm', 'paid_media', 'social_media', 'creative_campaigns', 'content_ideation'],
    boostServices: [
      'Go-to-Market Strategy', 'Launch Planning', 'Channel Strategy',
      'Landing Page Development', 'On-Page Optimization',
      'Creative Platform Development', 'Campaign Asset Creation',
      'Paid Strategy', 'Audience Development & Targeting',
      'Content Strategy', 'Social Content Creation (Reactive)'
    ],
    sowGuidance: `CLIENT FIT ARCHETYPE: ENTREPRENEUR
This client values speed, flexibility, and quick wins. The SOW should:
- Emphasize fast starts with rapid hypothesis-driven strategy
- Structure work in short sprints rather than long phases
- Include A/B testing and test-and-learn approaches for creative platforms and paid media
- Prioritize quick wins that demonstrate value early
- Use language that conveys momentum: "rapid deployment", "test and learn", "sprint-based delivery"
- Build in flexibility for pivoting based on early results
- Include lightweight reporting focused on actionable insights over comprehensive analysis
- Emphasize getting to market quickly with creative assets across paid media and social`,
    waysOfWorking: `WAYS OF WORKING — ENTREPRENEUR CLIENT
Sprint-Based Partnership:
- Rapid-start kickoff: Abbreviated onboarding (1-2 sessions max) focused on immediate priorities and first sprint definition
- Work structured in 2-4 week sprints with defined deliverables, hypotheses, and success criteria per sprint
- Hypothesis-driven approach: "We believe [X] will achieve [Y] — let's test it" rather than months of upfront strategy
- Built-in pivot points at sprint boundaries — shift priorities based on what's working without formal change orders
- MVP-first mentality: Launch with good-enough creative, learn from real-world data, refine in subsequent sprints

Communication Cadence:
- Quick-touch check-ins: 15-30 minute weekly syncs focused on decisions, blockers, and next actions — no lengthy presentations
- Real-time communication channel (Slack/Teams) for day-to-day questions and quick approvals
- Sprint retrospectives: brief review of what shipped, what we learned, what's next
- Monthly strategic pulse: lightweight assessment of overall direction and priorities (not a formal review)

Approval & Decision Flow:
- Streamlined approvals: single decision-maker with authority to approve on the spot
- Async approval workflow for creative and content — share for review, approved unless feedback within 24-48 hours
- Agency empowered to make execution decisions within sprint scope without per-item approval
- Pivot decisions made quickly at sprint boundaries — no committee required
- "Good enough to ship" standard for initial launches; perfection is the enemy of progress

Reporting & Documentation:
- Lightweight sprint reports: what shipped, key metrics, learnings, next sprint priorities (1-2 pages max)
- Action-oriented dashboards showing what's working and what to do about it
- Monthly summary connecting sprint outputs to business growth metrics
- Documentation kept lean — enough to make decisions, not enough to slow things down`,
    pricingGuidance: `PRICING APPROACH — ENTREPRENEUR CLIENT
- Frame fees around speed-to-value and quick wins that demonstrate ROI early
- Structure pricing in sprint-based phases: small initial commitment that scales based on results
- Present a "Phase 1 Fast Start" with lower entry point, followed by expansion phases tied to early wins
- Lean toward T&M or retainer models that flex with changing priorities — Entrepreneurs hate paying for scope they've outgrown
- Include swap-in/swap-out provisions: trade equivalent deliverables without change orders as priorities shift
- Keep proposal modular — let client add services as they grow rather than requiring large upfront commitment
- Position pricing as investment in velocity: "Get to market in [X] weeks rather than [Y] months"
- Budget for test-and-learn: allocate portion of investment explicitly for experimentation across creative and channels`
  }
};

// ============================================================================
// PRICING UTILITIES
// ============================================================================
const getServiceName = (service) => typeof service === 'object' ? service.name : service;
const getServiceNames = (trigger) => trigger.services.map(getServiceName);
const PAID_MEDIA_CATEGORY_IDS = ['paid_media'];

const calculatePricingTotal = (selectedServices) => {
  let totalLow = 0, totalHigh = 0, paidMediaLow = 0, paidMediaHigh = 0;
  const countedBundles = new Set();
  let pmPercentageCount = 0, mktOpsPercentage = 0;
  for (const trigger of SERVICE_TRIGGERS) {
    const isPaidMedia = PAID_MEDIA_CATEGORY_IDS.includes(trigger.id);
    for (const service of trigger.services) {
      const name = getServiceName(service);
      if (!selectedServices.includes(name)) continue;
      if (!service.pricing) continue;
      const pricing = service.pricing;
      if (pricing.percentageOfProject) { pmPercentageCount++; continue; }
      if (pricing.percentageOfPaidMedia) { mktOpsPercentage = pricing.percentageOfPaidMedia; continue; }
      if (pricing.bundle && !pricing.budgetLow) { continue; }
      if (pricing.bundle) { if (countedBundles.has(pricing.bundle)) continue; countedBundles.add(pricing.bundle); }
      if (pricing.budgetLow) totalLow += pricing.budgetLow;
      if (pricing.budgetHigh) totalHigh += pricing.budgetHigh;
      if (isPaidMedia) { if (pricing.budgetLow) paidMediaLow += pricing.budgetLow; if (pricing.budgetHigh) paidMediaHigh += pricing.budgetHigh; }
    }
  }
  if (totalLow === 0 && totalHigh === 0 && pmPercentageCount === 0) return null;
  const pmLow = pmPercentageCount > 0 && totalLow > 0 ? Math.round(totalLow * 0.10) : 0;
  const pmHigh = pmPercentageCount > 0 && totalHigh > 0 ? Math.round(totalHigh * 0.10) : 0;
  const mktOpsLow = mktOpsPercentage > 0 && paidMediaLow > 0 ? Math.round(paidMediaLow * (mktOpsPercentage / 100)) : 0;
  const mktOpsHigh = mktOpsPercentage > 0 && paidMediaHigh > 0 ? Math.round(paidMediaHigh * (mktOpsPercentage / 100)) : 0;
  const grandLow = totalLow + pmLow + mktOpsLow, grandHigh = totalHigh + pmHigh + mktOpsHigh;
  const fmt = (n) => n >= 1000000 ? `$${(n/1000000).toFixed(1)}M` : n >= 1000 ? `$${(n/1000).toFixed(0)}K` : `$${n}`;
  return { low: grandLow, high: grandHigh, lowFormatted: fmt(grandLow), highFormatted: fmt(grandHigh) };
};

const formatPricingForService = (service) => {
  if (!service.pricing) return null;
  const p = service.pricing;
  if (p.percentageOfProject) return { term: null, budget: `~${p.percentageOfProject}% of project`, note: p.note };
  if (p.percentageOfPaidMedia) return { term: null, budget: `~${p.percentageOfPaidMedia}% of paid media fees`, note: p.note };
  if (p.bundle && !p.termLow) return { term: null, budget: null, note: null, bundle: p.bundle };
  const fmtC = (n) => n >= 1000 ? `$${(n/1000).toFixed(0)}K` : `$${n}`;
  const term = p.termLow && p.termHigh ? (p.termLow === p.termHigh ? (p.termLow === 52 ? 'Annual' : `${p.termLow} weeks`) : `${p.termLow}-${p.termHigh} weeks`) : null;
  const budget = p.budgetLow && p.budgetHigh ? (p.budgetLow === p.budgetHigh ? fmtC(p.budgetLow) : `${fmtC(p.budgetLow)}-${fmtC(p.budgetHigh)}`) : null;
  return { term, budget, note: p.note, bundle: p.bundle };
};

// ============================================================================
// SOW BEST PRACTICES (condensed)
// ============================================================================
const SOW_BEST_PRACTICES = `
AGENCY SOW QUALITY STANDARDS — ANTENNA GROUP
For use in all SOW generation, review, and quality assessment.

================================================================================
REQUIRED SECTIONS (every SOW must include ALL of these)
================================================================================
1. PROJECT OVERVIEW & BACKGROUND — context, business need, parties involved, high-level success
2. OBJECTIVES — specific, measurable goals aligned to client business objectives
3. SCOPE OF WORK — all tasks with quantities, frequencies, formats, methodologies
4. OUT OF SCOPE & EXCLUSIONS — explicitly list what is NOT included (critical for scope creep prevention)
5. DELIVERABLES — each with format, quantity, quality standards, and dependencies
6. ACCEPTANCE CRITERIA — objective conditions, review window, deemed acceptance on non-response
7. TIMELINE & MILESTONES — specific dates, dependencies, client review cycles built in
8. ROLES & RESPONSIBILITIES — BOTH parties explicitly; client obligations with timeframes and consequences
9. ASSUMPTIONS — conditions assumed true, with consequence if each assumption proves false
10. CHANGE MANAGEMENT PROCESS — written approval required before scope changes proceed
11. FEES & PAYMENT TERMS — fee structure, schedule, late payment provisions, rate for OOS work
12. TERMINATION PROVISIONS — notice period, payment on termination, kill fee, transition obligations

================================================================================
CRITICAL LANGUAGE RULES
================================================================================
VAGUE LANGUAGE TO REPLACE:
- "Unlimited revisions" → "up to X rounds of revisions of decreasing complexity"
- "As needed" → "up to X hours/items per [period]"
- "Reasonable" → define specifically (e.g., "within 5 business days")
- "Ongoing" → add time boundary or specify "for the term of this agreement"
- "Best efforts" → specify measurable standard
- "Standard" or "typical" → define explicitly
- "Support / assistance / management / coordination" → specify activities, frequency, limits
- "Including but not limited to" → use only to illustrate, never to expand scope
- "Until client is satisfied" → NEVER use; tie completion to objective criteria

REQUIRED LANGUAGE PATTERNS:
- Quantities: "up to X" (sets ceiling, not floor; no refund for unused capacity)
- Timeframes: "within X business days of [trigger event]"
- Responsibility: "Agency will deliver..." / "Client will provide..." (active voice, clear subject)
- Revision definition: "A round of revisions = one consolidated set of feedback from Client's designated approver"
- Deemed acceptance: "If Client does not respond within [X] business days, deliverable is deemed accepted"
- Client consequence: "If Client fails to [obligation] within [timeframe], Agency may [adjust timeline / pause work / adjust fee]"
- Feedback consolidation: "Client will consolidate all stakeholder feedback into a single submission per revision round. Multiple separate submissions count as separate rounds."

================================================================================
CONTRACT TYPE REQUIREMENTS
================================================================================
FIXED FEE:
- All deliverables listed with specs, quantities, revision limits
- All exclusions explicitly stated
- Assumptions documented with consequences for each
- Change order process required — written approval before any OOS work
- Acceptance criteria and final payment trigger defined
- Client obligations with consequences (delays may require schedule/fee adjustment)

RETAINER:
- Minimum term commitment and monthly fee clearly stated
- Services included explicitly enumerated; excluded services listed
- Monthly allocation (hours or deliverables) quantified
- Rollover policy explicit: no rollover (use it or lose it), limited rollover, or quarterly true-up
- Overage rate and pre-approval process defined
- Notification threshold when approaching allocation
- Early termination fee and notice period

TIME & MATERIALS:
- Rate schedule for all roles with billing increment specified
- Initial estimate clearly labeled as estimate (NOT cap)
- Notification thresholds (e.g., at 75% of estimate)
- Time reporting frequency and content defined
- Intended objectives and boundaries stated

T&M WITH CAP:
- All T&M requirements above, PLUS:
- Cap explicitly tied to defined scope
- Work stoppage rights when approaching cap
- Cap adjustment triggers: scope changes, assumption failures, client-caused delays
- Inclusions and exclusions from cap specified

================================================================================
SCOPE CREEP PREVENTION
================================================================================
EXCLUSIONS SECTION must address common adjacent services:
- Rush fees and expedited timelines
- Additional revision rounds beyond stated limits
- Crisis communications (if not explicitly included)
- Paid media spend (if not included)
- Event staffing / on-site support
- Travel outside defined geography
- Third-party vendor management
- Photography, video, translation, legal review
- Regulatory compliance verification

STOP WORK PROVISION pattern:
"If Client fails to make payment when due, or fails to respond to requests within [X] business days, Agency may stop work upon written notice until Client cures the failure. Stopping work does not limit Agency's right to terminate. Timeline will adjust accordingly."

CHANGE ORDER PROCESS:
- All scope additions require written approval BEFORE work proceeds
- Include impact assessment step (timeline + fee)
- No verbal authorizations; email confirmation minimum
- Reference rate schedule for additional work

================================================================================
HIGH PRIORITY FLAGS (✗ = missing critical element)
================================================================================
CRITICAL:
✗ No exclusions section
✗ No client obligations section (or obligations without timeframes/consequences)
✗ No revision limits or "unlimited revisions" language
✗ No change order process
✗ No assumptions section
✗ No acceptance criteria
✗ "Unlimited" anything in scope
✗ No termination protection / no early termination fee
✗ Payment not tied to milestones
✗ No consequences for client non-performance
✗ Scope described with vague verbs: "support", "assist", "manage" without specifics

MODERATE:
⚠ Acceptance criteria incomplete or subjective
⚠ Client review windows not specified
⚠ No deemed acceptance provision
⚠ Vague timeline (no specific dates or milestones)
⚠ Assumptions stated without consequences
⚠ Passive voice obscuring responsibility
⚠ Inconsistent or undefined terminology

SERVICE-SPECIFIC REQUIREMENTS:
PR/COMMS: specify proactive pitches/period, media list size, reporting format, reactive handling (in/out), crisis exclusion
PAID MEDIA: separate media spend from agency fees, ad account ownership, optimization frequency, reporting cadence
CREATIVE/BRANDING: concepts at each stage, revision rounds per phase, file formats, usage rights, stock imagery
INTEGRATED: boundaries between service lines, handoff points, who leads strategy vs execution, single vs separate reporting
`;


// ============================================================================
// API CALL UTILITY
// ============================================================================
const callClaude = async ({ system, userMessage, maxTokens = 4000, useWebSearch = false, fileContent = null }) => {
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY;
  const headers = {
    'Content-Type': 'application/json',
    'x-api-key': apiKey,
    'anthropic-version': '2023-06-01',
    'anthropic-dangerous-direct-browser-access': 'true'
  };
  const body = { model: MODEL, max_tokens: maxTokens };
  if (system) body.system = system;
  if (useWebSearch) body.tools = [{ type: 'web_search_20250305', name: 'web_search' }];
  
  let content;
  if (fileContent && fileContent.type !== 'text') {
    const mediaType = fileContent.type === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    content = [
      { type: 'document', source: { type: 'base64', media_type: mediaType, data: fileContent.data } },
      { type: 'text', text: userMessage }
    ];
  } else if (fileContent && fileContent.type === 'text') {
    content = `${userMessage}\n\n${fileContent.data}`;
  } else {
    content = userMessage;
  }
  
  body.messages = [{ role: 'user', content }];
  const response = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers, body: JSON.stringify(body) });
  if (!response.ok) { const e = await response.json(); throw new Error(e.error?.message || 'API error'); }
  const data = await response.json();
  return data.content.filter(b => b.type === 'text').map(b => b.text).join('\n');
};

// ============================================================================
// DOCX GENERATION
// ============================================================================
const createAntennaHeader = () => new Header({ children: [new Paragraph({ children: [new TextRun({ text: '.antenna', font: 'Arial', size: 36, bold: true }), new TextRun({ text: 'group', font: 'Arial', size: 24, color: '666666' })] })] });
const createFooter = () => new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Page ', font: 'Arial', size: 20, color: '666666' }), new TextRun({ children: [PageNumber.CURRENT], font: 'Arial', size: 20, color: '666666' })] })] });

const generateDocxFromText = async (text, title, meta = {}) => {
  const lines = text.split('\n');
  const children = [];
  
  children.push(new Paragraph({ children: [new TextRun({ text: title, bold: true, size: 48, font: 'Arial' })], spacing: { after: 300 } }));
  if (meta.client) children.push(new Paragraph({ children: [new TextRun({ text: `Prepared for: ${meta.client}`, size: 22, font: 'Arial', color: '666666' })], spacing: { after: 100 } }));
  children.push(new Paragraph({ children: [new TextRun({ text: `Date: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`, size: 22, font: 'Arial', color: '666666' })], spacing: { after: 400 } }));
  children.push(new Paragraph({ border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: 'CCCCCC' } }, spacing: { after: 400 } }));

  for (const line of lines) {
    const t = line.trim();
    if (!t) { children.push(new Paragraph({ spacing: { after: 100 } })); continue; }
    if (t.startsWith('# ')) { children.push(new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: t.replace(/^# /, ''), bold: true, size: 32, font: 'Arial' })], spacing: { before: 400, after: 200 } })); }
    else if (t.startsWith('## ')) { children.push(new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: t.replace(/^## /, ''), bold: true, size: 26, font: 'Arial' })], spacing: { before: 300, after: 150 } })); }
    else if (t.startsWith('### ')) { children.push(new Paragraph({ heading: HeadingLevel.HEADING_3, children: [new TextRun({ text: t.replace(/^### /, ''), bold: true, size: 24, font: 'Arial' })], spacing: { before: 200, after: 100 } })); }
    else if (t.startsWith('**') && t.endsWith('**')) { children.push(new Paragraph({ children: [new TextRun({ text: t.replace(/\*\*/g, ''), bold: true, size: 22, font: 'Arial' })], spacing: { after: 120 } })); }
    else if (t.startsWith('- ') || t.startsWith('• ')) { children.push(new Paragraph({ numbering: { reference: 'bullet-list', level: 0 }, children: [new TextRun({ text: t.replace(/^[-•] /, ''), size: 22, font: 'Arial' })], spacing: { after: 80 } })); }
    else { children.push(new Paragraph({ children: [new TextRun({ text: t.replace(/\*\*/g, ''), size: 22, font: 'Arial' })], spacing: { after: 150 } })); }
  }

  const doc = new Document({
    numbering: { config: [{ reference: 'bullet-list', levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.START, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] }] },
    sections: [{ properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } }, headers: { default: createAntennaHeader() }, footers: { default: createFooter() }, children }]
  });
  return doc;
};

const downloadDocx = async (text, filename, meta = {}) => {
  try {
    const doc = await generateDocxFromText(text, meta.title || filename.replace('.docx', ''), meta);
    const blob = await Packer.toBlob(doc);
    saveAs(blob, filename);
  } catch (e) {
    console.error('DOCX error:', e);
    saveAs(new Blob([text], { type: 'text/plain' }), filename.replace('.docx', '.txt'));
  }
};

// ============================================================================
// SHARED UI COMPONENTS
// ============================================================================
function AntennaLogo({ className = "h-8" }) {
  return <img src="https://ktuyiikwhspwmzvyczit.supabase.co/storage/v1/object/public/assets/brand/antenna-new-logo.svg" alt="Antenna Group" className={className} />;
}

function AntennaButton({ children, onClick, disabled, loading, loadingText, icon: Icon, className = '', variant = 'primary', size = 'default' }) {
  const sizes = { small: 'px-4 py-2 text-sm rounded-lg gap-2', default: 'px-6 py-3 text-base rounded-xl gap-3', large: 'px-8 py-4 text-lg rounded-xl gap-3' };
  const variants = { primary: 'bg-[#12161E] text-white', secondary: 'bg-white text-[#12161E] border-2 border-[#12161E]', ghost: 'bg-transparent text-[#12161E] hover:bg-[#12161E]/5' };
  return (
    <button onClick={onClick} disabled={disabled || loading} className={`group relative overflow-hidden font-semibold transition-all duration-300 flex items-center justify-center ${variants[variant]} ${sizes[size]} ${(disabled || loading) ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'} ${className}`}>
      {loading ? (<><Loader2 className="w-5 h-5 animate-spin relative z-10" /><span className="relative z-10">{loadingText || 'Loading...'}</span></>) : (
        <>
          {Icon && <Icon className="w-5 h-5 relative z-10 flex-shrink-0" />}
          <span className="relative z-10 flex-shrink-0 overflow-hidden">
            <span className="relative inline-block">
              {children}
              <span className="absolute inset-0 flex items-center justify-center transition-transform duration-300 ease-out group-hover:translate-y-full pointer-events-none" style={{ backgroundColor: '#E8FF00' }}>
                <span style={{ color: '#12161E' }}>{children}</span>
              </span>
            </span>
          </span>
          <svg className="w-5 h-5 flex-shrink-0 relative z-10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M7 17L17 7M17 7H7M17 7V17" /></svg>
        </>
      )}
    </button>
  );
}

function CopyButton({ text, className = '' }) {
  const [copied, setCopied] = useState(false);
  return (
    <button onClick={async () => { try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch (e) {} }} className={`p-1.5 rounded-md transition-all ${copied ? 'bg-green-600 text-white' : 'bg-white/60 text-gray-500 hover:bg-white hover:text-gray-900'} ${className}`}>
      {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

function CollapsibleSection({ title, children, defaultOpen = false, icon: Icon, count, variant }) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const variants = { critical: { header: 'bg-red-50 hover:bg-red-100', badge: 'bg-red-600 text-white', icon: 'text-red-600' }, recommended: { header: 'bg-amber-50 hover:bg-amber-100', badge: 'bg-amber-600 text-white', icon: 'text-amber-600' }, default: { header: 'bg-gray-50 hover:bg-gray-100', badge: 'bg-gray-900 text-white', icon: 'text-gray-900' } };
  const s = variants[variant] || variants.default;
  return (
    <div className="border border-gray-200 rounded-xl mb-3 overflow-hidden">
      <button onClick={() => setIsOpen(!isOpen)} className={`w-full px-5 py-4 ${s.header} flex items-center justify-between transition-colors`}>
        <div className="flex items-center gap-3">{isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}{Icon && <Icon className={`w-5 h-5 ${s.icon}`} />}<span className="font-semibold text-gray-900">{title}</span>{count !== undefined && <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${s.badge}`}>{count}</span>}</div>
      </button>
      {isOpen && <div className="p-5 bg-white border-t border-gray-100">{children}</div>}
    </div>
  );
}


// ============================================================================
// AUTH: LOGIN VIEW
// ============================================================================
function LoginView({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showRequest, setShowRequest] = useState(false);
  const [reqName, setReqName] = useState('');
  const [reqEmail, setReqEmail] = useState('');
  const [reqPractice, setReqPractice] = useState('');
  const [reqNote, setReqNote] = useState('');
  const [reqSent, setReqSent] = useState(false);
  const [reqLoading, setReqLoading] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) return setError('Please enter your email and password.');
    setLoading(true); setError('');
    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: email.toLowerCase().trim(),
        password,
      });
      if (authError) return setError('Invalid email or password. Please try again.');

      // Fetch profile for role/name
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', data.user.id)
        .single();

      if (profileError || !profile) return setError('Account not set up correctly. Contact your admin.');
      if (profile.active === false) {
        await supabase.auth.signOut();
        return setError('Your account is pending activation. An admin will review your request shortly.');
      }

      onLogin({ ...profile, id: data.user.id });
    } catch (e) {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleRequestAccess = async () => {
    if (!reqName.trim() || !reqEmail.trim()) return;
    setReqLoading(true);
    try {
      // Store access request in a pending_requests table (or profiles with active=false)
      // We create an auth user with a random password and mark profile as inactive/pending
      const tempPassword = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2).toUpperCase() + '!1';
      const { data, error } = await supabase.functions.invoke('admin-users', {
        body: {
          action: 'create',
          name: reqName.trim(),
          email: reqEmail.trim().toLowerCase(),
          password: tempPassword,
          role: 'growth',
          active: false,
          requestNote: reqNote.trim(),
          practice: reqPractice,
          isPendingRequest: true,
        },
      });
      if (error || data?.error) {
        setError(data?.error || error?.message || 'Could not submit request. Contact an admin directly.');
      } else {
        setReqSent(true);
      }
    } catch (e) {
      setError('Could not submit request. Please email an admin directly.');
    } finally {
      setReqLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#E8E6E1' }}>
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="text-center mb-10">
            <AntennaLogo className="h-10 mx-auto mb-8" />
            <h1 className="text-2xl font-bold text-gray-900 mb-2">SOW Workbench</h1>
            <p className="text-gray-500 text-sm">Sign in to access your pipeline</p>
          </div>

          {!showRequest ? (
            <>
              <div className="bg-white rounded-2xl border border-gray-200 p-8 shadow-sm">
                <div className="space-y-4 mb-6">
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-1.5">Email</label>
                    <input
                      type="email" value={email} onChange={e => setEmail(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleLogin()}
                      placeholder="you@antennagroup.com" autoFocus
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-gray-900 focus:border-gray-900 outline-none text-gray-900 placeholder:text-gray-400"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-1.5">Password</label>
                    <div className="relative">
                      <input
                        type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleLogin()}
                        placeholder="••••••••"
                        className="w-full px-4 py-3 pr-12 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-gray-900 focus:border-gray-900 outline-none text-gray-900 placeholder:text-gray-400"
                      />
                      <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700">
                        {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>

                {error && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-red-600 text-sm">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />{error}
                  </div>
                )}

                <AntennaButton onClick={handleLogin} loading={loading} loadingText="Signing in..." className="w-full" size="default">
                  Sign In
                </AntennaButton>
              </div>

              <p className="text-center text-sm text-gray-500 mt-6">
                Don't have access?{' '}
                <button onClick={() => setShowRequest(true)} className="font-semibold text-[#12161E] hover:underline">
                  Request credentials
                </button>
              </p>
            </>
          ) : reqSent ? (
            <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center shadow-sm">
              <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Request sent!</h3>
              <p className="text-sm text-gray-500 mb-6">An admin will review your request and activate your account. You'll be able to sign in once approved.</p>
              <button onClick={() => { setShowRequest(false); setReqSent(false); setReqName(''); setReqEmail(''); setReqNote(''); setReqPractice(''); }} className="text-sm font-semibold text-[#12161E] hover:underline">Back to Sign In</button>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-200 p-8 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-gray-900">Request Access</h3>
                <button onClick={() => setShowRequest(false)} className="text-gray-400 hover:text-gray-700"><X className="w-4 h-4" /></button>
              </div>
              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-1.5">Full Name *</label>
                  <input value={reqName} onChange={e => setReqName(e.target.value)} placeholder="Your name"
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-gray-900 outline-none text-gray-900" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-1.5">Work Email *</label>
                  <input type="email" value={reqEmail} onChange={e => setReqEmail(e.target.value)} placeholder="you@antennagroup.com"
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-gray-900 outline-none text-gray-900" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-1.5">Practice</label>
                  <select value={reqPractice} onChange={e => setReqPractice(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-gray-900 outline-none text-gray-900">
                    <option value="">Select practice...</option>
                    {PRACTICES.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-1.5">Note (optional)</label>
                  <input value={reqNote} onChange={e => setReqNote(e.target.value)} placeholder="Why you need access..."
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-gray-900 outline-none text-gray-900" />
                </div>
              </div>
              {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">{error}</div>}
              <AntennaButton onClick={handleRequestAccess} loading={reqLoading} loadingText="Sending..." disabled={!reqName.trim() || !reqEmail.trim()} className="w-full">
                Submit Request
              </AntennaButton>
              <p className="text-center text-xs text-gray-400 mt-4">An admin will review and activate your account.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// AUTH: USER MENU (header dropdown)
// ============================================================================
function UserMenu({ currentUser, onLogout, onOpenAdmin }) {
  const [open, setOpen] = useState(false);
  const roleInfo = USER_ROLES[currentUser.role] || USER_ROLES.growth;
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/60 hover:bg-white border border-gray-200 transition-all"
      >
        <div className="w-7 h-7 rounded-full bg-[#12161E] flex items-center justify-center flex-shrink-0">
          <User className="w-3.5 h-3.5 text-white" />
        </div>
        <div className="hidden sm:block text-left">
          <p className="text-xs font-semibold text-gray-900 leading-none">{currentUser.name}</p>
          <p className="text-[10px] text-gray-500 mt-0.5">{roleInfo.label}</p>
        </div>
        <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-2xl border border-gray-200 shadow-xl z-50 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
              <p className="font-semibold text-gray-900 text-sm">{currentUser.name}</p>
              <p className="text-xs text-gray-500">{currentUser.email}</p>
              <span className={`mt-1.5 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${roleInfo.color}`}>{roleInfo.label}</span>
            </div>
            {currentUser.role === 'admin' && (
              <button
                onClick={() => { setOpen(false); onOpenAdmin(); }}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <Shield className="w-4 h-4 text-gray-500" />Admin Panel
              </button>
            )}
            <button
              onClick={() => { setOpen(false); onLogout(); }}
              className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-600 hover:bg-red-50 transition-colors border-t border-gray-100"
            >
              <LogOut className="w-4 h-4" />Sign Out
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ============================================================================
// ADMIN PANEL
// ============================================================================
function AdminView({ currentUser, onClose }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newUser, setNewUser] = useState({ name: '', email: '', password: '', role: 'growth' });
  const [editingId, setEditingId] = useState(null);
  const [editUser, setEditUser] = useState({});
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [adminTab, setAdminTab] = useState('users');

  useEffect(() => { loadUsers(); }, []);

  const loadUsers = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('profiles').select('*').order('created_at');
    if (!error && data) setUsers(data);
    setLoading(false);
  };

  const activeUsers = users.filter(u => u.active !== false);
  const pendingUsers = users.filter(u => u.active === false);

  const handleActivate = async (user) => {
    const tempPw = Math.random().toString(36).slice(2) + 'Aa1!';
    setSaving(true);
    try {
      // Set a known temp password and activate
      const { data, error } = await supabase.functions.invoke('admin-users', {
        body: { action: 'update-password', userId: user.id, password: tempPw },
      });
      if (error || data?.error) return setError(data?.error || error?.message);
      const { error: updateErr } = await supabase.from('profiles')
        .update({ active: true })
        .eq('id', user.id);
      if (updateErr) return setError(updateErr.message);
      await loadUsers();
      alert(`Activated! Temp password: ${tempPw}\nShare with ${user.name} (${user.email})`);
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  };

  const handleCreate = async () => {
    setError('');
    const { name, email, password, role } = newUser;
    if (!name.trim() || !email.trim() || !password.trim()) return setError('Name, email and password are required.');
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-users', {
        body: { action: 'create', name: name.trim(), email: email.trim(), password, role },
      });
      if (error || data?.error) return setError(data?.error || error.message);
      await loadUsers();
      setNewUser({ name: '', email: '', password: '', role: 'growth' });
      setShowCreate(false);
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  };

  const handleSaveEdit = async (id) => {
    setError('');
    const { name, email, role, active, newPassword } = editUser;
    if (!name?.trim() || !email?.trim()) return setError('Name and email are required.');
    setSaving(true);
    try {
      const { error: profileErr } = await supabase.from('profiles')
        .update({ name: name.trim(), email: email.toLowerCase().trim(), role, active })
        .eq('id', id);
      if (profileErr) return setError(profileErr.message);
      if (newPassword?.trim()) {
        const { data, error: pwErr } = await supabase.functions.invoke('admin-users', {
          body: { action: 'update-password', userId: id, password: newPassword.trim() },
        });
        if (pwErr || data?.error) return setError(data?.error || pwErr.message);
      }
      await loadUsers();
      setEditingId(null);
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  };

  const handleToggleActive = async (user) => {
    if (user.id === currentUser.id) return;
    const { error } = await supabase.from('profiles').update({ active: !user.active }).eq('id', user.id);
    if (!error) setUsers(prev => prev.map(u => u.id === user.id ? { ...u, active: !u.active } : u));
  };

  const handleDelete = async (id) => {
    if (id === currentUser.id) return;
    if (!window.confirm('Permanently delete this user? This cannot be undone.')) return;
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-users', {
        body: { action: 'delete', userId: id },
      });
      if (error || data?.error) return setError(data?.error || error.message);
      setUsers(prev => prev.filter(u => u.id !== id));
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  };

  const roleOptions = Object.entries(USER_ROLES).map(([value, info]) => ({ value, label: info.label, description: info.description }));

  return (
    <div className="fixed inset-0 z-50 flex" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="absolute inset-4 bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-w-5xl mx-auto w-full">
        {/* Header */}
        <div className="flex items-center justify-between px-8 py-5 border-b border-gray-200 bg-gray-50 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-[#12161E] rounded-xl flex items-center justify-center">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Admin Panel</h2>
              <p className="text-xs text-gray-500">Manage users and access</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-200 rounded-lg transition-colors"><X className="w-5 h-5" /></button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 bg-gray-50 px-8">
          {[
            { id: 'users', label: 'Active Users', count: activeUsers.length },
            { id: 'pending', label: 'Pending Requests', count: pendingUsers.length, highlight: pendingUsers.length > 0 },
          ].map(tab => (
            <button key={tab.id} onClick={() => setAdminTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-all -mb-px ${adminTab === tab.id ? 'border-[#12161E] text-[#12161E]' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              {tab.label}
              {tab.count > 0 && (
                <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${tab.highlight ? 'bg-amber-400 text-amber-900' : 'bg-gray-200 text-gray-600'}`}>{tab.count}</span>
              )}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-8 py-6">
          {loading ? (
            <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-gray-400" /></div>
          ) : adminTab === 'pending' ? (
            <>
              <p className="text-sm text-gray-500 mb-6">These users have requested access and are waiting for activation. Review their details and activate or delete.</p>
              {pendingUsers.length === 0 ? (
                <div className="text-center py-16 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                  <CheckCircle className="w-10 h-10 text-green-300 mx-auto mb-3" />
                  <p className="text-gray-400 font-medium">No pending requests</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {pendingUsers.map(user => (
                    <div key={user.id} className="flex items-center justify-between p-5 bg-amber-50 border border-amber-200 rounded-2xl">
                      <div>
                        <p className="font-bold text-gray-900">{user.name}</p>
                        <p className="text-sm text-gray-500">{user.email}</p>
                        {user.practice && <span className="text-xs px-2 py-0.5 bg-white border border-amber-300 rounded-full text-amber-700 font-medium mt-1 inline-block">{user.practice}</span>}
                        {user.requestNote && <p className="text-xs text-gray-400 mt-1 italic">"{user.requestNote}"</p>}
                        <p className="text-xs text-gray-400 mt-1">Requested {new Date(user.created_at).toLocaleDateString()}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button onClick={() => handleActivate(user)} disabled={saving}
                          className="px-4 py-2 bg-[#12161E] text-white rounded-xl text-sm font-bold hover:bg-gray-800 disabled:opacity-50 transition-colors flex items-center gap-1.5">
                          <CheckCircle className="w-3.5 h-3.5" />Activate
                        </button>
                        <button onClick={() => handleDelete(user.id)} disabled={saving}
                          className="px-4 py-2 border border-red-200 text-red-600 rounded-xl text-sm font-medium hover:bg-red-50 disabled:opacity-50 transition-colors">
                          Decline
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <>
              {/* Stats */}
              <div className="grid grid-cols-4 gap-4 mb-8">
                {Object.entries(USER_ROLES).map(([role, info]) => {
                  const count = users.filter(u => u.role === role && u.active !== false).length;
                  return (
                    <div key={role} className="bg-white border border-gray-200 rounded-xl p-4 text-center">
                      <p className="text-2xl font-bold text-gray-900">{count}</p>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border mt-1 ${info.color}`}>{info.label}</span>
                    </div>
                  );
                })}
              </div>

              {/* Create User */}
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-900">Users ({activeUsers.length})</h3>
                <button onClick={() => setShowCreate(!showCreate)} className="flex items-center gap-2 px-4 py-2 bg-[#12161E] text-white rounded-xl text-sm font-semibold hover:bg-gray-800 transition-colors">
                  <UserPlus className="w-4 h-4" />{showCreate ? 'Cancel' : 'Add User'}
                </button>
              </div>

              {showCreate && (
                <div className="mb-6 p-6 bg-gray-50 border border-gray-200 rounded-2xl">
                  <h4 className="font-semibold text-gray-900 mb-4">New User</h4>
                  {error && <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">{error}</div>}
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div><label className="block text-xs font-semibold text-gray-700 mb-1">Full Name *</label><input value={newUser.name} onChange={e => setNewUser({ ...newUser, name: e.target.value })} placeholder="Jane Smith" className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-gray-900 outline-none" /></div>
                    <div><label className="block text-xs font-semibold text-gray-700 mb-1">Email *</label><input value={newUser.email} onChange={e => setNewUser({ ...newUser, email: e.target.value })} placeholder="jane@antennagroup.com" className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-gray-900 outline-none" /></div>
                    <div><label className="block text-xs font-semibold text-gray-700 mb-1">Password *</label><input type="text" value={newUser.password} onChange={e => setNewUser({ ...newUser, password: e.target.value })} placeholder="Temporary password" className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-gray-900 outline-none" /></div>
                    <div><label className="block text-xs font-semibold text-gray-700 mb-1">Role *</label>
                      <select value={newUser.role} onChange={e => setNewUser({ ...newUser, role: e.target.value })} className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-gray-900 outline-none bg-white">
                        {roleOptions.map(r => <option key={r.value} value={r.value}>{r.label} — {r.description}</option>)}
                      </select>
                    </div>
                  </div>
                  <button onClick={handleCreate} disabled={saving} className="px-6 py-2.5 bg-[#12161E] text-white rounded-xl text-sm font-semibold hover:bg-gray-800 disabled:opacity-50 transition-colors flex items-center gap-2">
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}Create User
                  </button>
                </div>
              )}

              {/* Role Access Guide */}
              <div className="mb-6 p-4 bg-blue-50 border border-blue-100 rounded-2xl">
                <p className="text-xs font-semibold text-blue-800 mb-2">Role Access Summary</p>
                <div className="grid grid-cols-4 gap-3">
                  {Object.entries(USER_ROLES).map(([role, info]) => (
                    <div key={role} className="text-xs text-blue-700">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full font-semibold border text-[10px] mb-1 ${info.color}`}>{info.label}</span>
                      <p className="text-gray-600 leading-snug">{info.description}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Users Table */}
              <div className="border border-gray-200 rounded-2xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left px-5 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">User</th>
                      <th className="text-left px-5 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Role</th>
                      <th className="text-left px-5 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Status</th>
                      <th className="text-left px-5 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Password</th>
                      <th className="text-right px-5 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {users.map(user => {
                      const roleInfo = USER_ROLES[user.role] || USER_ROLES.growth;
                      const isMe = user.id === currentUser.id;
                      const isEditing = editingId === user.id;
                      return (
                        <tr key={user.id} className={`${isMe ? 'bg-blue-50/40' : 'bg-white'} hover:bg-gray-50 transition-colors`}>
                          <td className="px-5 py-4">
                            {isEditing ? (
                              <div className="space-y-1.5">
                                <input value={editUser.name || ''} onChange={e => setEditUser({ ...editUser, name: e.target.value })} placeholder="Name" className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm" />
                                <input value={editUser.email || ''} onChange={e => setEditUser({ ...editUser, email: e.target.value })} placeholder="Email" className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm" />
                              </div>
                            ) : (
                              <div>
                                <p className="font-semibold text-gray-900">{user.name} {isMe && <span className="text-xs text-blue-600">(you)</span>}</p>
                                <p className="text-xs text-gray-500">{user.email}</p>
                              </div>
                            )}
                          </td>
                          <td className="px-5 py-4">
                            {isEditing ? (
                              <select value={editUser.role || user.role} onChange={e => setEditUser({ ...editUser, role: e.target.value })} className="px-2 py-1.5 border border-gray-300 rounded-lg text-sm bg-white">
                                {roleOptions.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                              </select>
                            ) : (
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${roleInfo.color}`}>{roleInfo.label}</span>
                            )}
                          </td>
                          <td className="px-5 py-4">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${user.active !== false ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                              {user.active !== false ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td className="px-5 py-4">
                            {isEditing ? (
                              <input type="text" value={editUser.newPassword || ''} onChange={e => setEditUser({ ...editUser, newPassword: e.target.value })} placeholder="New password (leave blank to keep)" className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm" />
                            ) : (
                              <span className="text-xs text-gray-400 font-mono">••••••••</span>
                            )}
                          </td>
                          <td className="px-5 py-4">
                            <div className="flex items-center justify-end gap-1">
                              {isEditing ? (
                                <>
                                  <button onClick={() => handleSaveEdit(user.id)} disabled={saving} className="px-3 py-1.5 bg-[#12161E] text-white rounded-lg text-xs font-medium hover:bg-gray-800 disabled:opacity-50 flex items-center gap-1">
                                    {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : null}Save
                                  </button>
                                  <button onClick={() => { setEditingId(null); setError(''); }} className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-xs font-medium hover:bg-gray-200">Cancel</button>
                                </>
                              ) : (
                                <>
                                  <button onClick={() => { setEditingId(user.id); setEditUser({ name: user.name, email: user.email, role: user.role, active: user.active, newPassword: '' }); setError(''); }} className="p-1.5 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors" title="Edit"><Edit3 className="w-3.5 h-3.5" /></button>
                                  {!isMe && <button onClick={() => handleToggleActive(user)} className="p-1.5 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors" title={user.active !== false ? 'Deactivate' : 'Activate'}>{user.active !== false ? <ToggleRight className="w-3.5 h-3.5 text-green-600" /> : <ToggleLeft className="w-3.5 h-3.5" />}</button>}
                                  {!isMe && <button onClick={() => handleDelete(user.id)} className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>}
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {error && !showCreate && <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">{error}</div>}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  const s = PROPOSAL_STATUSES.find(p => p.value === status) || PROPOSAL_STATUSES[0];
  return <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border ${s.bg} ${s.text} ${s.border}`}>{s.label}</span>;
}

function StageProgress({ currentStage, opportunity, onStageClick, allowedStages = [] }) {
  const stageOrder = PIPELINE_STAGES.map(s => s.id);
  const currentIdx = stageOrder.indexOf(currentStage);
  const getStageStatus = (stageId) => {
    if (allowedStages.length > 0 && !allowedStages.includes(stageId)) return 'locked';
    const idx = stageOrder.indexOf(stageId);
    if (idx < currentIdx) return 'complete';
    if (idx === currentIdx) return 'active';
    return 'upcoming';
  };
  return (
    <div className="border-b border-gray-200/80" style={{ backgroundColor: '#E8E6E1' }}>
      <div className="max-w-7xl mx-auto px-8">
        {/* Company breadcrumb */}
        <div className="flex items-center gap-2 pt-3 pb-2">
          <span className="text-xs text-gray-400">Opportunity</span>
          <ChevronRight className="w-3 h-3 text-gray-300" />
          <span className="text-xs font-bold text-[#12161E]">{opportunity?.companyName}</span>
          {opportunity?.proposalStatus && currentStage === 'proposal' && <StatusBadge status={opportunity.proposalStatus} />}
        </div>
        {/* Tab row — exactly like Compass nav */}
        <div className="flex items-center gap-1">
          {PIPELINE_STAGES.map((stage, idx) => {
            const status = getStageStatus(stage.id);
            const isClickable = status === 'complete' || status === 'active';
            return (
              <button
                key={stage.id}
                onClick={() => isClickable && onStageClick && onStageClick(stage.id)}
                disabled={!isClickable}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-t-lg border-b-2 transition-all -mb-px
                  ${status === 'active'
                    ? 'bg-white border-[#12161E] text-[#12161E]'
                    : status === 'complete'
                    ? 'border-transparent text-gray-500 hover:text-gray-700 cursor-pointer hover:border-gray-300'
                    : status === 'locked'
                    ? 'border-transparent text-gray-300 cursor-not-allowed'
                    : 'border-transparent text-gray-300 cursor-default'}`}
              >
                {status === 'complete'
                  ? <span className="w-4 h-4 rounded-full bg-green-500 flex items-center justify-center"><span className="text-white text-[9px] font-black">✓</span></span>
                  : status === 'locked'
                  ? <Lock className="w-3.5 h-3.5" />
                  : <span className={`w-5 h-5 rounded-full text-xs font-black flex items-center justify-center ${status === 'active' ? 'bg-[#E8FF00] text-[#12161E]' : 'bg-gray-200 text-gray-400'}`}>{idx + 1}</span>
                }
                {stage.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}


// ============================================================================
// STAGE 1: RESEARCH VIEW
// ============================================================================
function ResearchView({ opportunity, onUpdate }) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [companyName, setCompanyName] = useState(opportunity.companyName || '');
  const [companyUrl, setCompanyUrl] = useState(opportunity.companyUrl || '');
  const [industry, setIndustry] = useState(opportunity.industry || '');
  const [additionalContext, setAdditionalContext] = useState(opportunity.researchContext || '');

  // Save input fields explicitly — no reliance on unmount cleanup
  const saveInputs = useCallback(() => {
    onUpdate({ companyName, companyUrl, industry, researchContext: additionalContext });
  }, [companyName, companyUrl, industry, additionalContext]);

  const runResearch = async () => {
    if (!companyName.trim()) return setError('Please enter a company name.');
    setIsLoading(true); setError(null);

    // Save inputs immediately
    onUpdate({ companyName, companyUrl, industry, researchContext: additionalContext });

    const assignmentTitle = opportunity.title || 'Not specified';
    const owningPractice = opportunity.practice || 'Not specified';

    try {
      const result = await callClaude({
        useWebSearch: true,
        maxTokens: 4000,
        system: `You are a senior new business strategist at Antenna Group, an integrated PR and marketing agency specializing in Brand Strategy, Creative Strategy, Creative Production, Public Relations, Social & Influencer Marketing, and Performance Marketing.
Your job is to prepare a business development professional for an intake call with a prospective client. You MUST use web search to research the company before generating any output.

RESEARCH — search for and assess:
1. What the company does and their value proposition
2. Website: messaging clarity, design quality, brand expression
3. Earned media: coverage volume, outlet quality, recency
4. Social presence: platform activity, content quality
5. Business signals: growth indicators, recent announcements, competitive position

OUTPUT RULES — apply these to everything you write:
- Write for a smart person in a hurry
- No fluff, no filler sentences, no restating the obvious
- Every sentence must earn its place
- The entire response should fit on one printed page
- Never use em dashes (-- or the character). Use commas or plain hyphens (-) instead.`,
        userMessage: `Prepare a client snapshot and intake questions for the following prospect:

**Company Name:** ${companyName}
**Assignment Title:** ${assignmentTitle}
**Owning Practice:** ${owningPractice}
**Website:** ${companyUrl || 'Not provided — search for it'}
**Industry:** ${industry || 'Infer from research'}
${additionalContext ? `**Additional Context:** ${additionalContext}` : ''}

Search the web before responding. Make every question specific to this company. Keep the entire response tight — it should work as a single reference page.

---
## CLIENT SNAPSHOT

**Who They Are**
2–3 sentences maximum. What they do, who they serve, what makes them distinct. Written as a cold briefing.

**Website**
1–2 sentences. Honest assessment of messaging and brand expression. Be direct.

**Earned Media & PR**
1–2 sentences. Are they visible, dormant, or inconsistent? Note any notable coverage or gaps.

**Social & Digital**
1 sentence. Are they showing up meaningfully or going through the motions?

**The One Thing**
1 sentence only. The single most important thing the BD team should know walking in — a tension, gap, or opportunity that should shape the conversation.

---
## 10 INTAKE QUESTIONS

Rules for every question:
- Maximum 2 sentences. Shorter is better.
- Specific to this company — never generic
- Opens a conversation, does not close one
- Follow each question with a rationale of 10 words or fewer

**1. Business Context**
[Company-specific question about the business situation driving this conversation]
*Rationale: [10 words max]*

**2. The Real Problem**
[Company-specific question about the underlying challenge]
*Rationale: [10 words max]*

**3. Success Definition**
[Company-specific question about what a win looks like in 12 months]
*Rationale: [10 words max]*

**4. Past Agency Experience**
[Company-specific question about what's worked before and where agency relationships have broken down]
*Rationale: [10 words max]*

**5. Internal Dynamics**
[Company-specific question about who has final say and how approval works]
*Rationale: [10 words max]*

**6. Appetite for Bold Work**
[Company-specific question about whether they want safe and steady or something their competitors wouldn't do]
*Rationale: [10 words max]*

**7. Channel or Service Priority**
[Company-specific question about where they see the biggest leverage point right now]
*Rationale: [10 words max]*

**8. Investment Tolerance**
[Company-specific question about budget and how they think about marketing as investment vs cost]
*Rationale: [10 words max]*

**9. Urgency**
[Company-specific question about what's driving the timing]
*Rationale: [10 words max]*

**10. The Decision**
[Company-specific question about what would make them move forward or walk away]
*Rationale: [10 words max]*

CRITICAL: Replace each template question above with a version specific to this company based on your research. The templates show the topic area only — the actual questions must reference what you found.`
      });

      // Parse questions from ## 10 INTAKE QUESTIONS section
      const questionMatch = result.match(/## 10 INTAKE QUESTIONS([\s\S]*?)(?:$)/);
      const questionsRaw = questionMatch ? questionMatch[1] : '';
      const questions = questionsRaw
        .split('\n')
        .filter(l => /^\*\*\d+\./.test(l.trim()))
        .map(l => l.replace(/^\*\*\d+\.\s*/, '').replace(/\*\*$/, '').trim())
        .filter(Boolean);

      // Also extract rationales for richer display
      const rationaleMatches = [...questionsRaw.matchAll(/\*Rationale:\s*([^*\n]+)\*/g)];
      const rationales = rationaleMatches.map(m => m[1].trim());

      onUpdate({
        companyName, companyUrl, industry,
        researchContext: additionalContext,
        researchSummary: result,
        intakeQuestions: questions,
        intakeRationales: rationales,
        researchComplete: true,
        currentStage: 'research',
      });
    } catch (e) { setError(e.message); }
    finally { setIsLoading(false); }
  };

  const { researchSummary, intakeQuestions = [], intakeRationales = [], researchComplete } = opportunity;

  // Split snapshot from questions for display
  const snapshotText = researchSummary
    ? researchSummary.split('## 10 INTAKE QUESTIONS')[0].replace('## CLIENT SNAPSHOT', '').trim()
    : '';

  return (
    <div className="max-w-7xl mx-auto px-8 py-10">
      {/* Header */}
      <div className="mb-8">
        <div className="w-12 h-12 bg-[#12161E] rounded-xl flex items-center justify-center mb-4">
          <Search className="w-6 h-6 text-white" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-1">Company Research</h2>
        <p className="text-gray-500 text-sm">AI-powered discovery to understand the prospect, identify marketing gaps, and generate smart intake questions.</p>
      </div>

      {/* Input panel — always visible */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-6">
        <div className="grid sm:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-1.5">Company Name *</label>
            <input value={companyName} onChange={e => setCompanyName(e.target.value)} onBlur={saveInputs}
              placeholder="e.g. Cartography Capital"
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-gray-900 outline-none text-gray-900 placeholder:text-gray-400 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-1.5">Website URL</label>
            <input value={companyUrl} onChange={e => setCompanyUrl(e.target.value)} onBlur={saveInputs}
              placeholder="https://example.com"
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-gray-900 outline-none text-gray-900 placeholder:text-gray-400 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-1.5">Industry / Sector</label>
            <input value={industry} onChange={e => setIndustry(e.target.value)} onBlur={saveInputs}
              placeholder="e.g. Fintech, Healthcare, Climate Tech"
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-gray-900 outline-none text-gray-900 placeholder:text-gray-400 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-1.5">Additional Context</label>
            <input value={additionalContext} onChange={e => setAdditionalContext(e.target.value)} onBlur={saveInputs}
              placeholder="How they reached us, existing relationship, specific focus..."
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-gray-900 outline-none text-gray-900 placeholder:text-gray-400 text-sm" />
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm flex gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />{error}
          </div>
        )}

        <div className="flex items-center gap-3">
          <AntennaButton onClick={runResearch} loading={isLoading} loadingText="Researching…" icon={Search} disabled={!companyName.trim()}>
            {researchComplete ? 'Re-run Research' : 'Run Research'}
          </AntennaButton>
          {researchComplete && (
            <span className="flex items-center gap-1.5 text-xs text-green-600 font-medium">
              <CheckCircle className="w-4 h-4" />Research complete
            </span>
          )}
        </div>
      </div>

      {/* Results */}
      {researchSummary && (
        <div className="grid lg:grid-cols-2 gap-6 mb-6">

          {/* Client Snapshot */}
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden flex flex-col">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 bg-[#12161E] rounded-lg flex items-center justify-center">
                  <TrendingUp className="w-3.5 h-3.5 text-white" />
                </div>
                <span className="font-bold text-gray-900">Client Snapshot</span>
              </div>
              <CopyButton text={snapshotText} />
            </div>
            <div className="p-5 overflow-y-auto" style={{ maxHeight: '520px' }}>
              <div className="space-y-4">
                {snapshotText.split('\n\n').filter(Boolean).map((block, i) => {
                  const isBold = block.startsWith('**');
                  if (isBold) {
                    const titleMatch = block.match(/^\*\*([^*]+)\*\*/);
                    const title = titleMatch ? titleMatch[1] : '';
                    const body = block.replace(/^\*\*[^*]+\*\*\s*/, '').trim();
                    return (
                      <div key={i}>
                        <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">{title}</p>
                        <p className="text-sm text-gray-700 leading-relaxed">{body}</p>
                      </div>
                    );
                  }
                  return <p key={i} className="text-sm text-gray-600 leading-relaxed">{block}</p>;
                })}
              </div>
            </div>
          </div>

          {/* Intake Questions */}
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden flex flex-col">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 bg-[#E8FF00] rounded-lg flex items-center justify-center">
                  <FileQuestion className="w-3.5 h-3.5 text-[#12161E]" />
                </div>
                <span className="font-bold text-gray-900">Intake Questions</span>
                <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full font-medium">{intakeQuestions.length || 10}</span>
              </div>
              <CopyButton text={intakeQuestions.map((q, i) => `${i+1}. ${q}`).join('\n')} />
            </div>
            <div className="p-5 overflow-y-auto" style={{ maxHeight: '520px' }}>
              {/* Parse and display questions with rationales from raw text if structured parsing failed */}
              {intakeQuestions.length > 0 ? (
                <div className="space-y-4">
                  {intakeQuestions.map((q, i) => (
                    <div key={i} className="flex gap-3">
                      <span className="w-6 h-6 rounded-full bg-[#12161E] text-white text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{i+1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-800 leading-relaxed font-medium">{q}</p>
                        {intakeRationales[i] && (
                          <p className="text-xs text-gray-400 mt-1 italic">{intakeRationales[i]}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                // Fallback: render raw questions section as text
                <pre className="whitespace-pre-wrap text-sm text-gray-700 leading-relaxed font-sans">
                  {researchSummary.split('## 10 INTAKE QUESTIONS')[1] || ''}
                </pre>
              )}
            </div>
          </div>
        </div>
      )}

      {researchComplete && (
        <AntennaButton
          onClick={() => onUpdate({
            currentStage: 'brief',
            companyName, companyUrl, industry,
            researchContext: additionalContext,
            researchSummary: opportunity.researchSummary,
            intakeQuestions: opportunity.intakeQuestions,
            intakeRationales: opportunity.intakeRationales,
            researchComplete: true,
          })}
          icon={ArrowRight} className="w-full">
          Proceed to Return Brief →
        </AntennaButton>
      )}
    </div>
  );
}

// ============================================================================
// STAGE 2: BRIEF VIEW
// ============================================================================
function BriefView({ opportunity, onUpdate }) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [transcript, setTranscript] = useState(opportunity.transcript || '');
  const [briefNotes, setBriefNotes] = useState(opportunity.briefNotes || '');
  const [contactName, setContactName] = useState(opportunity.contactName || '');
  const [contactRole, setContactRole] = useState(opportunity.contactRole || '');
  const [callDate, setCallDate] = useState(opportunity.callDate || '');
  const [compassAssessment, setCompassAssessment] = useState(opportunity.compassAssessment || '');
  const [fitArchetypes, setFitArchetypes] = useState(opportunity.fitArchetypes || (opportunity.fitArchetype ? [opportunity.fitArchetype] : []));
  const [isEditing, setIsEditing] = useState(false);
  const [editedBrief, setEditedBrief] = useState(opportunity.returnBrief || '');
  const [showCompass, setShowCompass] = useState(!!(opportunity.compassAssessment));

  const toggleFit = (id) => {
    setFitArchetypes(prev => {
      if (prev.includes(id)) return prev.filter(a => a !== id);
      if (prev.length >= 2) return [prev[1], id]; // replace oldest with new
      return [...prev, id];
    });
  };

  // Save brief inputs explicitly on blur — no unmount cleanup needed
  const saveBriefInputs = useCallback(() => {
    onUpdate({ transcript, briefNotes, contactName, contactRole, callDate, compassAssessment, fitArchetypes });
  }, [transcript, briefNotes, contactName, contactRole, callDate, compassAssessment, fitArchetypes]);

  const generateBrief = async () => {
    if (!transcript.trim()) return setError('Please paste the call transcript.');
    setIsLoading(true); setError(null);

    // Save inputs immediately before async call
    onUpdate({ transcript, briefNotes, contactName, contactRole, callDate, compassAssessment, fitArchetypes });

    // Build FIT result string
    const fitResult = fitArchetypes.length > 0
      ? fitArchetypes.map(id => {
          const a = FIT_ARCHETYPES[id];
          if (!a) return '';
          const pct = fitArchetypes.length === 2
            ? (fitArchetypes[0] === id ? '60%' : '40%')
            : '100%';
          return `${a.title.toUpperCase()} ${pct}`;
        }).filter(Boolean).join(' / ')
      : 'Not completed';

    const compassResult = compassAssessment.trim() || 'Not completed';
    const clientLine = [
      opportunity.companyName,
      contactName && contactRole ? `${contactName}, ${contactRole}` : contactName || contactRole || null,
      callDate ? `Call date: ${callDate}` : null,
    ].filter(Boolean).join(' | ');

    try {
      const result = await callClaude({
        maxTokens: 3000,
        system: `You are a senior strategist at Antenna Group. Write a Return Brief — a short client-facing document sent after a discovery call to confirm what was heard before a proposal is written.

Its only job: make the client feel understood and give them the chance to correct anything.

RULES:
- Written to the client, not about them
- Every section: 2-3 sentences or 3 bullets maximum
- No jargon, no filler, no repetition
- If a section has no data, omit it entirely
- The whole document must be readable in 90 seconds
- Output plain text only -- no markdown, no asterisks, no hashes
- Never use em dashes (-- or the character). Use commas, colons, or plain hyphens (-) instead.`,

        userMessage: `Write a Return Brief using the information below. Omit any section where no data exists.

CLIENT: ${clientLine}

TRANSCRIPT / NOTES:
${transcript}

FIT RESULT:
${fitResult}

COMPASS RESULT:
${compassResult}

BD TEAM NOTES:
${briefNotes.trim() || 'None'}

---

Use this EXACT output format:

RETURN BRIEF

Client:          ${opportunity.companyName}
Prepared for:    ${contactName ? `${contactName}${contactRole ? `, ${contactRole}` : ''}` : '[Contact]'}
From:            Antenna Group
Date:            ${callDate || new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}

────────────────────────────────────────

WHAT WE HEARD
[2–3 sentences in the client's own language. The situation and what brought them to this conversation.]

THE PROBLEM WE'RE HERE TO SOLVE
[1–2 sentences. The real underlying challenge, not the surface ask.]

WHAT SUCCESS LOOKS LIKE
- [Outcome 1]
- [Outcome 2]
- [Outcome 3]

HOW YOU LIKE TO WORK
[Only include if FIT data was provided. Format: [Archetype name(s)] — [2 sentences on what this means practically for how we'll work together.]]

WHAT WE'VE LEARNT ABOUT YOUR BRAND
[Only include if Compass data was provided. Format:
Overall: [Maturity stage] ([Score])
The areas that matter most for this engagement: [2–3 attributes only, one line each.]]

WHAT A PROPOSAL SHOULD FOCUS ON
- [Service / priority 1] — [one line why]
- [Service / priority 2] — [one line why]
- [Service / priority 3] — [one line why]

YOUR MANDATORIES
- [Non-negotiable 1]
- [Non-negotiable 2]
- [Non-negotiable 3]

BEFORE WE GO FURTHER
[One clarifying question — the single thing that would most sharpen the proposal.]

────────────────────────────────────────
Does this reflect what we discussed? Reply with any corrections before we begin.

---INTERNAL---

TRIGGER ANALYSIS (Internal — Do Not Share)
[List which Antenna service categories were detected and why. Confirm or suggest a FIT archetype with reasoning. Note any strategic observations about this opportunity.]`,
      });

      onUpdate({ transcript, briefNotes, contactName, contactRole, callDate, compassAssessment, fitArchetypes, returnBrief: result, briefComplete: true, currentStage: 'brief' });
      setEditedBrief(result);
    } catch (e) { setError(e.message); }
    finally { setIsLoading(false); }
  };

  const handleSaveEdit = () => { onUpdate({ returnBrief: editedBrief }); setIsEditing(false); };

  // Split brief from internal analysis at the sentinel
  const briefText = opportunity.returnBrief || '';
  const internalSplit = briefText.indexOf('---INTERNAL---');
  // Also handle legacy format
  const legacySplit = briefText.indexOf('## TRIGGER ANALYSIS');
  const splitIndex = internalSplit > 0 ? internalSplit : legacySplit > 0 ? legacySplit : -1;
  const publicBrief = splitIndex > 0 ? briefText.substring(0, splitIndex).trim() : briefText;
  const internalAnalysis = splitIndex > 0 ? briefText.substring(splitIndex).replace('---INTERNAL---', '').replace('## TRIGGER ANALYSIS (Internal — Do Not Share)', '').trim() : '';

  return (
    <div className="max-w-7xl mx-auto px-8 py-10">
      <div className="grid lg:grid-cols-2 gap-8">
        {/* Left: Input */}
        <div>
          <div className="mb-6">
            <div className="w-12 h-12 bg-[#12161E] rounded-xl flex items-center justify-center mb-4">
              <MessageSquare className="w-6 h-6 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-1">Return Brief</h2>
            <p className="text-gray-500 text-sm">Paste your call transcript. We'll produce a concise client-facing brief to confirm what was heard — ready to send before the proposal.</p>
          </div>

          <div className="space-y-4 mb-6">

            {/* Contact details row */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-1.5">Contact Name <span className="text-gray-400 font-normal">(optional)</span></label>
                <input value={contactName} onChange={e => setContactName(e.target.value)} onBlur={saveBriefInputs}
                  placeholder="e.g. Sarah Chen"
                  className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-gray-900 outline-none text-gray-900 placeholder:text-gray-400 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-1.5">Role <span className="text-gray-400 font-normal">(optional)</span></label>
                <input value={contactRole} onChange={e => setContactRole(e.target.value)} onBlur={saveBriefInputs}
                  placeholder="e.g. CMO"
                  className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-gray-900 outline-none text-gray-900 placeholder:text-gray-400 text-sm" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-1.5">Call Date <span className="text-gray-400 font-normal">(optional)</span></label>
              <input type="date" value={callDate} onChange={e => setCallDate(e.target.value)} onBlur={saveBriefInputs}
                className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-gray-900 outline-none text-gray-900 text-sm" />
            </div>

            {/* FIT Archetype Selector */}
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center justify-between mb-3">
                <label className="text-sm font-bold text-gray-900">Client FIT Archetype</label>
                <span className="text-xs text-gray-400">{fitArchetypes.length}/2 selected</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {Object.values(FIT_ARCHETYPES).map(arch => {
                  const isSelected = fitArchetypes.includes(arch.id);
                  const isDisabled = !isSelected && fitArchetypes.length >= 2;
                  return (
                    <button
                      key={arch.id}
                      onClick={() => toggleFit(arch.id)}
                      className={`flex items-start gap-2.5 p-3 rounded-xl border text-left transition-all ${
                        isSelected
                          ? 'border-[#12161E] bg-[#12161E] text-white'
                          : isDisabled
                          ? 'border-gray-100 bg-gray-50 opacity-40 cursor-not-allowed'
                          : 'border-gray-200 hover:border-gray-400 bg-gray-50'
                      }`}
                    >
                      <span className="text-lg leading-none mt-0.5 flex-shrink-0">{arch.emoji}</span>
                      <div className="min-w-0">
                        <p className={`text-xs font-bold leading-tight ${isSelected ? 'text-white' : 'text-gray-900'}`}>{arch.title}</p>
                        <p className={`text-[10px] mt-0.5 leading-tight ${isSelected ? 'text-gray-300' : 'text-gray-400'}`}>{arch.short}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
              {fitArchetypes.length > 0 && (
                <p className="mt-2 text-xs text-gray-500 italic">
                  {fitArchetypes.map(id => FIT_ARCHETYPES[id]?.description).join(' · ')}
                </p>
              )}
              {fitArchetypes.length === 2 && (
                <p className="mt-1 text-xs text-amber-600 font-medium">Blended archetype — brief will reflect both working styles</p>
              )}
            </div>

            {/* Transcript */}
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-1.5">Call Transcript <span className="text-red-400">*</span></label>
              <textarea
                value={transcript}
                onChange={e => setTranscript(e.target.value)}
                onBlur={saveBriefInputs}
                placeholder="Paste the full transcript of your client discovery call here..."
                className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-gray-900 outline-none text-gray-900 placeholder:text-gray-400 min-h-[220px] resize-y font-mono text-sm"
              />
            </div>

            {/* BD Team Notes */}
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-1.5">BD Team Notes <span className="text-gray-400 font-normal">(optional)</span></label>
              <textarea
                value={briefNotes}
                onChange={e => setBriefNotes(e.target.value)}
                onBlur={saveBriefInputs}
                placeholder="Anything not in the transcript — gut reads, room dynamics, things implied but not said, relationship context, red flags..."
                className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-gray-900 outline-none text-gray-900 placeholder:text-gray-400 min-h-[80px] resize-y text-sm"
              />
            </div>

            {/* Compass Assessment — toggleable */}
            <div>
              <button
                onClick={() => setShowCompass(!showCompass)}
                className="flex items-center gap-2 text-sm font-semibold text-gray-700 hover:text-gray-900 transition-colors group"
              >
                <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${showCompass ? 'bg-[#12161E] border-[#12161E]' : 'border-gray-400 group-hover:border-gray-600'}`}>
                  {showCompass && <span className="text-white text-[9px] font-black">✓</span>}
                </div>
                Include Compass Brand Assessment
                <span className="text-xs text-gray-400 font-normal">(optional)</span>
              </button>
              {showCompass && (
                <div className="mt-2">
                  <textarea
                    value={compassAssessment}
                    onChange={e => setCompassAssessment(e.target.value)}
                    onBlur={saveBriefInputs}
                    placeholder="Paste the Compass brand assessment output here — brand positioning, perception gaps, competitive context, or any strategic brand context from the assessment..."
                    className="w-full px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl focus:ring-2 focus:ring-amber-400 outline-none text-gray-900 placeholder:text-gray-400 min-h-[120px] resize-y text-sm"
                    autoFocus
                  />
                  <p className="mt-1.5 text-xs text-amber-700">Compass context will be woven into the brief's Brand section and inform service recommendations.</p>
                </div>
              )}
            </div>
          </div>

          {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm flex gap-2"><AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />{error}</div>}

          <AntennaButton onClick={generateBrief} loading={isLoading} loadingText="Generating Brief…" icon={FileText} disabled={!transcript.trim()}>
            {opportunity.briefComplete ? 'Regenerate Brief' : 'Generate Return Brief'}
          </AntennaButton>

          {opportunity.briefComplete && (
            <p className="text-xs text-gray-500 text-center mt-3">Brief generated. Review and edit on the right before sending to the client.</p>
          )}
        </div>

        {/* Right: Output */}
        <div>
          {!opportunity.briefComplete ? (
            <div className="h-full flex flex-col items-center justify-center text-center py-20 px-8">
              <div className="w-20 h-20 bg-gray-100 rounded-2xl flex items-center justify-center mb-6">
                <FileText className="w-10 h-10 text-gray-300" />
              </div>
              <h3 className="text-lg font-semibold text-gray-400 mb-2">Return Brief will appear here</h3>
              <p className="text-sm text-gray-400">Paste your transcript and generate to produce a client-ready brief document.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* FIT badge if set */}
              {fitArchetypes.length > 0 && (
                <div className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-xl flex-wrap">
                  {fitArchetypes.map(id => FIT_ARCHETYPES[id]).filter(Boolean).map(arch => (
                    <div key={arch.id} className="flex items-center gap-1.5">
                      <span className="text-base">{arch.emoji}</span>
                      <span className="text-xs font-bold text-gray-900">{arch.title}</span>
                      <span className="text-xs text-gray-400">{arch.short}</span>
                    </div>
                  ))}
                  {fitArchetypes.length === 2 && <span className="text-xs px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full font-medium ml-auto">Blended</span>}
                  {compassAssessment && <span className="text-xs px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full font-medium">Compass included</span>}
                </div>
              )}

              {/* Brief card */}
              <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    <span className="font-semibold text-gray-900">Return Brief</span>
                    {isEditing
                      ? <span className="text-xs px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full">Editing</span>
                      : <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full">Ready to send</span>
                    }
                  </div>
                  <div className="flex items-center gap-2">
                    {!isEditing && <CopyButton text={publicBrief} />}
                    <button
                      onClick={() => { setIsEditing(!isEditing); setEditedBrief(briefText); }}
                      className={`text-xs px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 font-medium ${
                        isEditing
                          ? 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                          : 'bg-[#12161E] text-white hover:bg-gray-800'
                      }`}>
                      <Edit3 className="w-3 h-3" />{isEditing ? 'Cancel Edit' : 'Edit Brief'}
                    </button>
                    {!isEditing && (
                      <button onClick={() => downloadDocx(publicBrief, `${opportunity.companyName}_Return_Brief.docx`, { title: `Return Brief: ${opportunity.companyName}`, client: opportunity.companyName })} className="text-xs px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-1.5">
                        <Download className="w-3 h-3" />Download
                      </button>
                    )}
                  </div>
                </div>
                {isEditing ? (
                  <div className="p-5">
                    <p className="text-xs text-gray-500 mb-3">Edit the brief below. Changes are saved when you click Save — the original will be replaced.</p>
                    <textarea
                      value={editedBrief}
                      onChange={e => setEditedBrief(e.target.value)}
                      className="w-full text-sm text-gray-800 border border-gray-200 rounded-lg p-4 min-h-[480px] resize-y font-mono leading-relaxed focus:ring-2 focus:ring-gray-900 outline-none bg-gray-50"
                    />
                    <div className="mt-3 flex items-center gap-3">
                      <button onClick={handleSaveEdit} className="px-4 py-2 bg-[#12161E] text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors">Save Changes</button>
                      <button onClick={() => setIsEditing(false)} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors">Cancel</button>
                      <CopyButton text={editedBrief} />
                    </div>
                  </div>
                ) : (
                  <div className="p-6 max-h-[560px] overflow-y-auto">
                    <pre className="whitespace-pre-wrap text-sm text-gray-800 leading-relaxed font-mono">{publicBrief}</pre>
                  </div>
                )}
              </div>

              {/* Internal Analysis */}
              {internalAnalysis && (
                <CollapsibleSection title="Trigger Analysis (Internal Only)" icon={Lightbulb}>
                  <pre className="whitespace-pre-wrap text-sm text-gray-600 leading-relaxed font-sans">{internalAnalysis.replace('## TRIGGER ANALYSIS (Internal — Do Not Share)', '').trim()}</pre>
                </CollapsibleSection>
              )}

              <AntennaButton onClick={() => onUpdate({
                currentStage: 'proposal',
                transcript, briefNotes, contactName, contactRole, callDate,
                compassAssessment, fitArchetypes,
                returnBrief: opportunity.returnBrief,
                briefComplete: opportunity.briefComplete,
              })} icon={ArrowRight} className="w-full">
                Proceed to Proposal →
              </AntennaButton>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


// ============================================================================
// SERVICE SELECTION CARD (for Stage 3)
// ============================================================================
function ServiceCard({ trigger, selectedServices, onToggleService, onToggleBundle }) {
  const [isExpanded, setIsExpanded] = useState(true);
  const serviceNames = getServiceNames(trigger);
  const selectedCount = serviceNames.filter(s => selectedServices.includes(s)).length;

  const organizeServices = () => {
    const bundles = {}, standalone = [];
    for (const service of trigger.services) {
      const name = getServiceName(service);
      const bundleName = service.pricing?.bundle;
      if (bundleName) {
        if (!bundles[bundleName]) bundles[bundleName] = { name: bundleName, services: [], pricing: null };
        bundles[bundleName].services.push({ name, service });
        if (service.pricing?.budgetLow) bundles[bundleName].pricing = service.pricing;
      } else { standalone.push({ name, service }); }
    }
    return { bundles: Object.values(bundles), standalone };
  };

  const { bundles, standalone } = organizeServices();
  const isBundleSelected = (bundle) => bundle.services.every(s => selectedServices.includes(s.name));

  const formatPricing = (pricing) => {
    if (!pricing) return null;
    const fc = (n) => n >= 1000 ? `$${(n/1000).toFixed(0)}K` : `$${n}`;
    const term = pricing.termLow && pricing.termHigh ? (pricing.termLow === pricing.termHigh ? (pricing.termLow === 52 ? 'Annual' : `${pricing.termLow}w`) : `${pricing.termLow}–${pricing.termHigh}w`) : null;
    const budget = pricing.budgetLow && pricing.budgetHigh ? `${fc(pricing.budgetLow)}–${fc(pricing.budgetHigh)}` : null;
    return { term, budget };
  };

  return (
    <div className={`rounded-xl border transition-all overflow-hidden ${selectedCount > 0 ? 'border-[#12161E]' : 'border-gray-200 bg-white'}`}>
      {/* Header */}
      <button onClick={() => setIsExpanded(!isExpanded)} className="w-full px-4 py-3.5 flex items-center justify-between hover:bg-gray-50 transition-colors">
        <div className="flex items-center gap-3">
          {isExpanded ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
          <div className="text-left">
            <p className="font-bold text-[#12161E] text-sm">{trigger.category}</p>
            <p className="text-xs text-gray-400">{trigger.description}</p>
          </div>
        </div>
        {selectedCount > 0 && (
          <span className="px-2.5 py-1 bg-[#12161E] text-white text-xs rounded-full font-bold flex items-center gap-1">
            <CheckCircle className="w-3 h-3" />{selectedCount}
          </span>
        )}
      </button>

      {isExpanded && (
        <div className="px-4 pb-4 border-t border-gray-100 pt-3 space-y-2 bg-white">
          {/* Bundles */}
          {bundles.map((bundle) => {
            const bundleSelected = isBundleSelected(bundle);
            const p = formatPricing(bundle.pricing);
            return (
              <div key={bundle.name} className={`rounded-lg border p-3 transition-all ${bundleSelected ? 'border-[#12161E] bg-gray-50' : 'border-gray-100'}`}>
                <label className="flex items-start gap-3 cursor-pointer">
                  <input type="checkbox" checked={bundleSelected} onChange={() => onToggleBundle(bundle.services.map(s => s.name), !bundleSelected)}
                    className="mt-0.5 w-4 h-4 rounded border-gray-300 text-[#12161E] focus:ring-[#12161E]" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-[#12161E]">{bundle.name}</span>
                      <span className="text-xs text-gray-400">({bundle.services.length} services)</span>
                      {p?.budget && <span className="text-xs px-2 py-0.5 bg-[#E8FF00] text-[#12161E] rounded font-bold">{p.budget}</span>}
                      {p?.term && <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded">{p.term}</span>}
                    </div>
                    {bundleSelected && (
                      <div className="mt-2 grid grid-cols-2 gap-1">
                        {bundle.services.map(svc => (
                          <div key={svc.name} className="flex items-center gap-1.5 text-xs text-gray-500">
                            <Check className="w-3 h-3 text-green-500 flex-shrink-0" />
                            <span className="truncate">{svc.name}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </label>
              </div>
            );
          })}
          {/* Standalone services */}
          {standalone.map(({ name, service }) => {
            const isSelected = selectedServices.includes(name);
            const p = formatPricing(service.pricing);
            const isConditional = service.recommend === 'conditional';
            return (
              <label key={name} className={`flex items-start gap-3 cursor-pointer rounded-lg border px-3 py-2.5 transition-all ${isSelected ? 'border-[#12161E] bg-gray-50' : 'border-gray-100 hover:border-gray-300'}`}>
                <input type="checkbox" checked={isSelected} onChange={() => onToggleService(name)}
                  className="mt-0.5 w-4 h-4 rounded border-gray-300 text-[#12161E] focus:ring-[#12161E]" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-[#12161E]">{name}</span>
                    {isConditional && <span className="text-[10px] px-1.5 py-0.5 bg-amber-50 border border-amber-200 text-amber-600 rounded font-medium">Conditional</span>}
                    {p?.budget && isSelected && <span className="text-xs px-2 py-0.5 bg-[#E8FF00] text-[#12161E] rounded font-bold">{p.budget}</span>}
                    {p?.term && isSelected && <span className="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded">{p.term}</span>}
                  </div>
                </div>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}


// ============================================================================
// STAGE 3: PROPOSAL VIEW
// ============================================================================
const ENGAGEMENT_TYPES = [
  { value: 'fixed_fee', label: 'Fixed Fee', description: 'Defined deliverables, set price' },
  { value: 'retainer', label: 'Retainer', description: 'Ongoing monthly engagement' },
  { value: 'tm', label: 'Time & Materials', description: 'Hourly with minimum commitment' },
  { value: 'integrated', label: 'Integrated', description: 'Multi-phase, mixed models' },
  { value: 'tm_cap', label: 'T&M with Cap', description: 'Hourly with maximum (client request only)' },
];

function ProposalView({ opportunity, onUpdate }) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDetecting, setIsDetecting] = useState(false);
  const [error, setError] = useState(null);
  const [draftNotes, setDraftNotes] = useState(opportunity.draftNotes || '');
  const [isEditingProposal, setIsEditingProposal] = useState(false);
  const [editedProposal, setEditedProposal] = useState(opportunity.proposalDraft || '');
  const [proposalIteration, setProposalIteration] = useState('');
  const [isIterating, setIsIterating] = useState(false);
  const [activeTab, setActiveTab] = useState('services');

  // Save local state when navigating away — use onBlur not unmount cleanup
  const saveProposalInputs = useCallback(() => { onUpdate({ draftNotes }); }, [draftNotes]);

  // Debounced auto-save for draftNotes — catches navigation without blur
  useEffect(() => {
    const t = setTimeout(() => { if (draftNotes !== (opportunity.draftNotes || '')) onUpdate({ draftNotes }); }, 800);
    return () => clearTimeout(t);
  }, [draftNotes]);

  const selectedServices = opportunity.selectedServices || [];
  const selectedArchetypes = opportunity.selectedArchetypes || [];
  const draftEngagementType = opportunity.draftEngagementType || 'fixed_fee';

  const setSelectedServices = (fn) => onUpdate({ selectedServices: typeof fn === 'function' ? fn(selectedServices) : fn });
  const setSelectedArchetypes = (fn) => onUpdate({ selectedArchetypes: typeof fn === 'function' ? fn(selectedArchetypes) : fn });
  const setDraftEngagementType = (v) => onUpdate({ draftEngagementType: v });

  const toggleService = (name) => setSelectedServices(prev => prev.includes(name) ? prev.filter(s => s !== name) : [...prev, name]);
  const toggleBundle = (names, shouldSelect) => setSelectedServices(prev => shouldSelect ? [...prev, ...names.filter(n => !prev.includes(n))] : prev.filter(n => !names.includes(n)));
  const toggleArchetype = (id) => setSelectedArchetypes(prev => prev.includes(id) ? prev.filter(a => a !== id) : prev.length < 2 ? [...prev, id] : [prev[1], id]);

  const pricingTotal = calculatePricingTotal(selectedServices);

  const detectServices = async () => {
    setIsDetecting(true); setError(null);
    try {
      const context = `${opportunity.returnBrief || ''}\n\n${opportunity.transcript || ''}`.substring(0, 4000);
      const categoryList = SERVICE_TRIGGERS.map(t => `${t.id}: ${t.category} — triggers: ${(t.triggerPatterns.direct || []).concat(t.triggerPatterns.indirect || []).slice(0,4).join(', ')}`).join('\n');
      const result = await callClaude({
        maxTokens: 1500,
        system: 'You are a marketing services expert. Identify which service categories are relevant based on context. Return ONLY a JSON array of category IDs.',
        userMessage: `Based on this client context, identify relevant service categories.\n\nCONTEXT:\n${context}\n\nAVAILABLE CATEGORIES:\n${categoryList}\n\nReturn ONLY valid JSON array of category IDs that are relevant, e.g.: ["brand","pr","website"]`
      });
      const match = result.match(/\[[\s\S]*?\]/);
      if (match) {
        const detectedIds = JSON.parse(match[0]);
        const newServices = [];
        for (const trigger of SERVICE_TRIGGERS) {
          if (detectedIds.includes(trigger.id)) {
            for (const service of trigger.services) {
              const name = getServiceName(service);
              if (service.recommend === 'always' && !selectedServices.includes(name)) newServices.push(name);
            }
          }
        }
        if (newServices.length > 0) setSelectedServices(prev => [...new Set([...prev, ...newServices])]);
      }
    } catch (e) { setError('Could not auto-detect services: ' + e.message); }
    finally { setIsDetecting(false); }
  };

  const generateProposal = async () => {
    if (selectedServices.length === 0) return;
    setIsGenerating(true); setError(null);
    try {
      // Build service lines with pricing for the proposal
      const serviceLines = SERVICE_TRIGGERS.flatMap(t =>
        t.services.filter(s => selectedServices.includes(getServiceName(s))).map(s => {
          const p = formatPricingForService(s);
          const name = getServiceName(s);
          const budget = p?.budget || 'TBC';
          const term = p?.term ? `, ${p.term}` : '';
          return { name, budget, term, category: t.category };
        })
      );

      // Build the investment table with EXACT calculated numbers — no AI guessing
      const investmentTable = serviceLines.map(s => '| ' + s.name + ' | ' + s.budget + s.term + ' |').join('\n');
      const totalLine = pricingTotal
        ? '\n**Total Estimated Investment: ' + pricingTotal.lowFormatted + ' - ' + pricingTotal.highFormatted + '**'
        : '\n**Total Estimated Investment: TBC**';

      // FIT context from the Return Brief stage
      const fitArchetypes = opportunity.fitArchetypes || [];
      const fitContext = fitArchetypes.length > 0
        ? fitArchetypes.map(id => {
            const a = FIT_ARCHETYPES[id];
            return a ? a.title + ': ' + a.short + ' - ' + a.description : '';
          }).filter(Boolean).join(' / ')
        : 'Not specified';

      const compassContext = opportunity.compassAssessment?.trim()
        ? `\nCOMPASS BRAND ASSESSMENT:\n${opportunity.compassAssessment.substring(0, 600)}`
        : '';

      const returnBriefExcerpt = opportunity.returnBrief
        ? opportunity.returnBrief.split('---INTERNAL---')[0].substring(0, 2000)
        : '';

      const transcriptExcerpt = opportunity.transcript
        ? opportunity.transcript.substring(0, 1500)
        : '';

      const result = await callClaude({
        maxTokens: 6000,
        system: `You are a senior business development writer at Antenna Group, an integrated marketing and communications agency that works with conscious brands that have the courage to lead.

Your proposals are:
- Warm, direct, and confident -- never corporate or generic
- Strategic, not salesy -- you demonstrate understanding before recommending
- Specific -- you reference the client's actual situation, not generic marketing speak
- Written in first person plural ("we") on behalf of Antenna
- Built around genuine insight into what the client needs

CRITICAL FORMATTING RULES:
- Never use em dashes (-- or the character) anywhere in the document. Use commas, colons, or plain hyphens (-) instead.
- Use plain text formatting. No bold except for headers.
- The Investment section must use EXACTLY the figures provided -- do not invent or alter any numbers.`,

        userMessage: `Write a compelling proposal for this client opportunity.

CLIENT: ${opportunity.companyName}
RID: ${opportunity.rid || 'TBC'}
ENGAGEMENT TYPE: ${ENGAGEMENT_TYPES.find(t => t.value === draftEngagementType)?.label || 'Fixed Fee'}
CLIENT FIT ARCHETYPE: ${fitContext}
${compassContext}

RETURN BRIEF (what was heard from the client):
${returnBriefExcerpt || 'No return brief available'}

CALL TRANSCRIPT EXCERPT:
${transcriptExcerpt || 'No transcript available'}

SELECTED SERVICES:
${serviceLines.map(s => '- ' + s.name + ' (' + s.budget + s.term + ')').join('\n')}

ADDITIONAL NOTES: ${draftNotes || 'None'}

---

Write the proposal in this exact structure:

# Proposal: ${opportunity.companyName}
Prepared by Antenna Group | RID: ${opportunity.rid || 'TBC'} | ${new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}

## The Challenge
[1-2 paragraphs. Show you've listened. Reference what came through in the brief and transcript -- their specific situation, the gap in their current approach, what's at stake. This must feel specific to them, not generic.]

## What Success Looks Like
[3-5 bullet points: specific, tangible outcomes that will tell both parties this engagement delivered. Ground these in what the client actually said.]

## What We're Proposing

[For each service or logical service group:]

### [Service Name or Group]
What we'll do: [1-2 sentences on the work]
Why this matters for ${opportunity.companyName}: [1-2 sentences connecting to their specific situation]
What you'll get: [Key output in plain language]

## Investment

| Service | Investment Range |
|---|---|
${investmentTable}
${totalLine}

[1-2 sentences about what's included and what's not in scope at this stage.]

## How We Work Together
[2-3 sentences on Antenna's working style. Reference the client's preferred approach based on their FIT archetype if provided.]

## Next Steps
1. [Specific action for the client]
2. [Specific follow-up from Antenna]
3. [Path to SOW]

We're excited about what we can build together. Let's talk.

---
Antenna Group | www.antennagroup.com`
      });

      onUpdate({ proposalDraft: result, proposalStatus: 'draft', draftNotes });
      setEditedProposal(result);
    } catch (e) { setError(e.message); }
    finally { setIsGenerating(false); }
  };

  const iterateProposal = async () => {
    if (!proposalIteration.trim()) return;
    setIsIterating(true);
    try {
      const currentDraft = isEditingProposal ? editedProposal : opportunity.proposalDraft;
      const result = await callClaude({
        maxTokens: 6000,
        system: `You are refining a proposal for Antenna Group, an integrated marketing agency. Apply the requested changes while maintaining the professional, warm, direct Antenna voice.`,
        userMessage: `Update this proposal based on the following feedback:\n\nFEEDBACK: ${proposalIteration}\n\nCURRENT PROPOSAL:\n${currentDraft}\n\nReturn the complete updated proposal.`
      });
      onUpdate({ proposalDraft: result });
      setEditedProposal(result);
      setProposalIteration('');
    } catch (e) { setError(e.message); }
    finally { setIsIterating(false); }
  };

  const statusInfo = PROPOSAL_STATUSES.find(s => s.value === opportunity.proposalStatus) || PROPOSAL_STATUSES[0];

  return (
    <div className="max-w-7xl mx-auto px-8 py-10">
      {/* Header */}
      <div className="flex items-start justify-between mb-8 flex-wrap gap-4">
        <div>
          <div className="w-12 h-12 bg-[#12161E] rounded-xl flex items-center justify-center mb-4">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Proposal</h2>
          <p className="text-gray-500">Build the service scope, generate a proposal, and track its progress.</p>
        </div>
        {opportunity.proposalDraft && (
          <div className="flex flex-col items-end gap-2">
            <span className="text-xs text-gray-500 font-medium">Proposal Status</span>
            <select value={opportunity.proposalStatus || 'draft'} onChange={e => onUpdate({ proposalStatus: e.target.value })}
              className={`px-4 py-2 rounded-lg border-2 text-sm font-semibold cursor-pointer focus:outline-none ${statusInfo.border} ${statusInfo.bg} ${statusInfo.text}`}>
              {PROPOSAL_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
        )}
      </div>

      {/* Tabs — Compass style */}
      <div className="flex gap-1 mb-6 border-b border-gray-200 -mt-2">
        {[{ id: 'services', label: 'Select Services', icon: Layers }, { id: 'proposal', label: 'Proposal Document', icon: FileText }].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex items-center gap-2 px-5 py-2.5 text-sm font-semibold border-b-2 transition-all -mb-px ${activeTab === tab.id ? 'border-[#12161E] text-[#12161E] bg-white' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            <tab.icon className="w-4 h-4" />{tab.label}
            {tab.id === 'services' && selectedServices.length > 0 && <span className="w-5 h-5 rounded-full bg-[#E8FF00] text-[#12161E] text-[10px] font-black flex items-center justify-center">{selectedServices.length}</span>}
          </button>
        ))}
      </div>

      {activeTab === 'services' && (
        <div>
          {/* Budget Total Banner — always visible when services selected */}
          {pricingTotal && (
            <div className="flex items-center justify-between bg-[#12161E] rounded-2xl px-6 py-4 mb-6">
              <div className="flex items-center gap-3">
                <DollarSign className="w-5 h-5 text-[#E8FF00]" />
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Estimated Investment</p>
                  <p className="text-2xl font-black text-white leading-none mt-0.5">{pricingTotal.lowFormatted} <span className="text-gray-400 text-base font-normal">– {pricingTotal.highFormatted}</span></p>
                </div>
              </div>
              <div className="text-right">
                <span className="text-xs text-gray-500">{selectedServices.length} service{selectedServices.length !== 1 ? 's' : ''} selected</span>
                <p className="text-xs text-[#E8FF00] font-bold mt-0.5">estimated range</p>
              </div>
            </div>
          )}

          <div className="grid lg:grid-cols-3 gap-8">
            {/* Left: Settings — Engagement Type, RID, Notes only */}
            <div className="space-y-5">
              <div className="bg-white rounded-2xl border border-gray-200 p-5">
                <h3 className="font-bold text-gray-900 mb-4">Engagement Type</h3>
                <div className="space-y-2">
                  {ENGAGEMENT_TYPES.map(et => (
                    <label key={et.value} className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${draftEngagementType === et.value ? 'border-gray-900 bg-gray-50' : 'border-gray-200 hover:border-gray-300'}`}>
                      <input type="radio" name="engagementType" value={et.value} checked={draftEngagementType === et.value} onChange={() => setDraftEngagementType(et.value)} className="text-gray-900" />
                      <div><p className="text-sm font-semibold text-gray-900">{et.label}</p><p className="text-xs text-gray-500">{et.description}</p></div>
                    </label>
                  ))}
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-gray-200 p-5">
                <h3 className="font-bold text-gray-900 mb-1 flex items-center gap-2">
                  RID
                  <span className="text-[10px] font-bold px-1.5 py-0.5 bg-red-100 text-red-600 rounded">Required</span>
                </h3>
                <p className="text-xs text-gray-400 mb-3">Format: NB followed by up to 4 digits (e.g. NB9530). Required before generating.</p>
                <input
                  value={opportunity.rid || ''}
                  onChange={e => {
                    let val = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
                    if (!val.startsWith('NB') && val.length > 0) val = 'NB' + val.replace(/^N?B?/, '');
                    if (val.length > 6) val = val.slice(0, 6);
                    onUpdate({ rid: val });
                  }}
                  placeholder="e.g. NB9530"
                  maxLength={6}
                  className={`w-full px-3 py-2.5 font-mono text-sm border rounded-lg focus:ring-2 focus:ring-gray-900 outline-none ${
                    !opportunity.rid
                      ? 'border-amber-300 bg-amber-50'
                      : /^NB[A-Z0-9]{1,4}$/.test(opportunity.rid)
                      ? 'border-green-300 bg-green-50'
                      : 'border-red-300 bg-red-50'
                  }`}
                />
                {opportunity.rid && !/^NB[A-Z0-9]{1,4}$/.test(opportunity.rid) && (
                  <p className="mt-1.5 text-xs text-red-500">Must start with NB and be 3-6 characters total</p>
                )}
              </div>

              <div className="bg-white rounded-2xl border border-gray-200 p-5">
                <h3 className="font-bold text-gray-900 mb-3">Notes for Proposal</h3>
                <textarea value={draftNotes} onChange={e => setDraftNotes(e.target.value)} onBlur={saveProposalInputs} placeholder="Budget constraints, specific client requests, tone notes, things to emphasise or avoid..." className="w-full text-sm px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-gray-900 text-gray-700 min-h-[100px] resize-y" />
              </div>

              {/* FIT context from brief — read-only display if set */}
              {(opportunity.fitArchetypes || []).length > 0 && (
                <div className="bg-gray-50 rounded-2xl border border-gray-100 p-4">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">FIT from Return Brief</p>
                  <div className="flex flex-wrap gap-2">
                    {(opportunity.fitArchetypes || []).map(id => {
                      const a = FIT_ARCHETYPES[id];
                      return a ? (
                        <div key={id} className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white rounded-lg border border-gray-200">
                          <span>{a.emoji}</span>
                          <span className="text-xs font-bold text-gray-700">{a.title}</span>
                        </div>
                      ) : null;
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Right: Services */}
            <div className="lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-900">{selectedServices.length} Services Selected</h3>
              <div className="flex gap-2">
                <button onClick={detectServices} disabled={isDetecting || (!opportunity.returnBrief && !opportunity.transcript)} className="flex items-center gap-2 px-4 py-2 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg text-sm font-medium hover:bg-amber-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                  {isDetecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                  {isDetecting ? 'Detecting...' : 'Auto-Detect from Brief'}
                </button>
                {selectedServices.length > 0 && <button onClick={() => onUpdate({ selectedServices: [] })} className="px-4 py-2 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors">Clear All</button>}
              </div>
            </div>
            {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">{error}</div>}
            <div className="space-y-3">
              {SERVICE_TRIGGERS.map(trigger => (
                <ServiceCard key={trigger.id} trigger={trigger} selectedServices={selectedServices} onToggleService={toggleService} onToggleBundle={toggleBundle} />
              ))}
            </div>

            {selectedServices.length > 0 && (
              <div className="mt-6 space-y-2">
                {!(/^NB[A-Z0-9]{1,4}$/.test(opportunity.rid || '')) && (
                  <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-700 text-xs font-medium">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    Enter a valid RID (e.g. NB9530) in the left panel before generating.
                  </div>
                )}
                <AntennaButton onClick={() => { generateProposal(); setActiveTab('proposal'); }} loading={isGenerating} loadingText="Generating Proposal..." icon={Sparkles} disabled={!(/^NB[A-Z0-9]{1,4}$/.test(opportunity.rid || ''))} className="w-full" size="large">
                  Generate Proposal
                </AntennaButton>
              </div>
            )}
          </div>
          </div>
        </div>
      )}

      {activeTab === 'proposal' && (
        <div>
          {!opportunity.proposalDraft ? (
            <div className="text-center py-20">
              <div className="w-20 h-20 bg-gray-100 rounded-2xl flex items-center justify-center mb-6 mx-auto"><Sparkles className="w-10 h-10 text-gray-300" /></div>
              <h3 className="text-lg font-semibold text-gray-400 mb-2">No proposal generated yet</h3>
              <p className="text-sm text-gray-400 mb-6">Select services in the Services tab, then generate your proposal.</p>
              <button onClick={() => setActiveTab('services')} className="px-6 py-3 bg-[#12161E] text-white rounded-xl font-semibold hover:bg-gray-800 transition-colors">← Select Services</button>
            </div>
          ) : (
            <div className="grid lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-4">
                {/* Proposal Document */}
                <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                  <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between flex-wrap gap-3">
                    <div className="flex items-center gap-3">
                      <span className="font-semibold text-gray-900">Proposal Document</span>
                      <StatusBadge status={opportunity.proposalStatus || 'draft'} />
                      {isEditingProposal && <span className="text-xs px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full">Editing</span>}
                    </div>
                    <div className="flex items-center gap-2">
                      {!isEditingProposal && <CopyButton text={opportunity.proposalDraft} />}
                      <button
                        onClick={() => { setIsEditingProposal(!isEditingProposal); setEditedProposal(opportunity.proposalDraft); }}
                        className={`text-xs px-3 py-1.5 rounded-lg font-medium flex items-center gap-1.5 transition-colors ${
                          isEditingProposal ? 'bg-gray-200 text-gray-700 hover:bg-gray-300' : 'bg-[#12161E] text-white hover:bg-gray-800'
                        }`}>
                        <Edit3 className="w-3 h-3" />{isEditingProposal ? 'Cancel Edit' : 'Edit Proposal'}
                      </button>
                      {!isEditingProposal && (
                        <button onClick={() => downloadDocx(opportunity.proposalDraft, `${opportunity.companyName}_Proposal.docx`, { title: `Proposal: ${opportunity.companyName}`, client: opportunity.companyName })} className="text-xs px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 flex items-center gap-1.5"><Download className="w-3 h-3" />Download</button>
                      )}
                    </div>
                  </div>
                  {isEditingProposal ? (
                    <div className="p-5">
                      <p className="text-xs text-gray-500 mb-3">Edit the proposal below. Changes are saved when you click Save.</p>
                      <textarea value={editedProposal} onChange={e => setEditedProposal(e.target.value)} className="w-full text-sm text-gray-800 border border-gray-200 rounded-lg p-4 min-h-[600px] resize-y font-mono leading-relaxed focus:ring-2 focus:ring-gray-900 outline-none bg-gray-50" />
                      <div className="mt-3 flex gap-3">
                        <button onClick={() => { onUpdate({ proposalDraft: editedProposal }); setIsEditingProposal(false); }} className="px-4 py-2 bg-[#12161E] text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors">Save Changes</button>
                        <button onClick={() => setIsEditingProposal(false)} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors">Cancel</button>
                        <CopyButton text={editedProposal} />
                      </div>
                    </div>
                  ) : (
                    <div className="p-6 max-h-[700px] overflow-y-auto">
                      <pre className="whitespace-pre-wrap text-sm text-gray-800 leading-relaxed font-sans">{opportunity.proposalDraft}</pre>
                    </div>
                  )}
                </div>
              </div>

              {/* Right sidebar */}
              <div className="space-y-4">
                {/* Investment summary — matches banner total exactly */}
                {pricingTotal && (
                  <div className="rounded-2xl overflow-hidden border border-gray-200">
                    <div className="bg-[#12161E] px-5 pt-5 pb-4">
                      <div className="flex items-center gap-2 mb-2"><DollarSign className="w-3.5 h-3.5 text-[#E8FF00]" /><span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Investment Range</span></div>
                      <p className="text-2xl font-black text-white leading-none">{pricingTotal.lowFormatted}</p>
                      <p className="text-sm text-gray-400 mt-1">– {pricingTotal.highFormatted}</p>
                      <p className="text-xs text-gray-500 mt-2">{selectedServices.length} services | {ENGAGEMENT_TYPES.find(t => t.value === draftEngagementType)?.label}</p>
                    </div>
                  </div>
                )}

                {/* Iterate */}
                <div className="bg-white rounded-2xl border border-gray-200 p-5">
                  <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2"><RefreshCw className="w-4 h-4" />Refine Proposal</h3>
                  <textarea value={proposalIteration} onChange={e => setProposalIteration(e.target.value)} placeholder="Describe what to change... e.g. 'Make the investment section clearer', 'Add more about our SEO approach', 'Soften the tone'" className="w-full text-sm px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-gray-900 text-gray-700 min-h-[100px] resize-y" />
                  <button onClick={iterateProposal} disabled={isIterating || !proposalIteration.trim()} className="mt-3 w-full px-4 py-2.5 bg-[#12161E] text-white rounded-xl text-sm font-semibold hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2">
                    {isIterating ? <><Loader2 className="w-4 h-4 animate-spin" />Updating...</> : <><RefreshCw className="w-4 h-4" />Apply Changes</>}
                  </button>
                </div>

                {/* Regenerate */}
                <button onClick={() => generateProposal()} disabled={isGenerating} className="w-full px-4 py-3 border-2 border-gray-200 text-gray-700 rounded-xl text-sm font-semibold hover:border-gray-900 hover:text-gray-900 disabled:opacity-50 transition-all flex items-center justify-center gap-2">
                  {isGenerating ? <><Loader2 className="w-4 h-4 animate-spin" />Generating...</> : <><Sparkles className="w-4 h-4" />Regenerate Proposal</>}
                </button>

                {/* Status */}
                <div className="bg-white rounded-2xl border border-gray-200 p-5">
                  <h3 className="font-bold text-gray-900 mb-3">Proposal Status</h3>
                  <div className="space-y-2">
                    {PROPOSAL_STATUSES.map(s => (
                      <button key={s.value} onClick={() => onUpdate({ proposalStatus: s.value })} className={`w-full text-left px-3 py-2 rounded-lg border transition-all text-sm font-medium ${opportunity.proposalStatus === s.value ? `${s.bg} ${s.text} ${s.border} border-2` : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Proceed to SOW */}
                {opportunity.proposalStatus === 'approved' && (
                  <AntennaButton onClick={() => onUpdate({
                    currentStage: 'sow',
                    draftNotes,
                    selectedServices: opportunity.selectedServices,
                    selectedArchetypes: opportunity.selectedArchetypes,
                    draftEngagementType: opportunity.draftEngagementType,
                    proposalDraft: opportunity.proposalDraft,
                    proposalStatus: opportunity.proposalStatus,
                  })} icon={ArrowRight} className="w-full">
                    Generate SOW →
                  </AntennaButton>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}


// ============================================================================
// STAGE 4: SOW GENERATION VIEW
// ============================================================================
function SOWGenerateView({ opportunity, onUpdate }) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isIterating, setIsIterating] = useState(false);
  const [error, setError] = useState(null);
  const [sowNotes, setSOWNotes] = useState(opportunity.sowNotes || '');
  const [iterationFeedback, setIterationFeedback] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [editedSOW, setEditedSOW] = useState(opportunity.sowDraft || '');

  // Use onBlur saves, not unmount cleanup (cleanup is unreliable with React state)


  const engagementLabel = ENGAGEMENT_TYPES.find(t => t.value === opportunity.draftEngagementType)?.label || 'Fixed Fee';

  const generateSOW = async () => {
    setIsGenerating(true); setError(null);
    try {
      const servicesText = (opportunity.selectedServices || []).join(', ') || 'Services as outlined in proposal';
      const result = await callClaude({
        maxTokens: 12000,
        system: `You are a senior contracts and operations specialist at Antenna Group, an integrated marketing and communications agency. You write Statements of Work that are protective, clear, and professional. You apply the SOW best practices to produce documents that prevent scope creep, establish clear client obligations, and protect both parties.

${SOW_BEST_PRACTICES}`,
        userMessage: `Generate a complete, professional Statement of Work based on the approved proposal and brief below.

CLIENT: ${opportunity.companyName}
ENGAGEMENT TYPE: ${engagementLabel}
SELECTED SERVICES: ${servicesText}
PRICING NOTES: ${opportunity.draftNotes || 'None'}

RETURN BRIEF:
${(opportunity.returnBrief || '').substring(0, 2000)}

PROPOSAL SUMMARY:
${(opportunity.proposalDraft || '').substring(0, 3000)}

ADDITIONAL SOW NOTES: ${sowNotes || 'None'}

Generate a complete SOW that:
1. Applies all SOW best practices (exclusions, client obligations, revision limits, change order process, assumptions with consequences)
2. Uses decimal numbering (1., 1.1, 1.2, etc.)
3. Is specific to the ${engagementLabel} engagement type
4. Includes all required sections: Overview, Objectives, Scope, Out of Scope, Deliverables, Acceptance Criteria, Timeline, Roles & Responsibilities, Assumptions, Change Management, Fees & Payment Terms, Termination
5. Uses controlled language ("up to X revisions", specific timeframes, active voice with clear responsibility)
6. Includes a strong client obligations section with specific timeframes and consequences
7. Is ready to be reviewed by both parties

Use markdown formatting. This is a professional legal/business document — formal but not overly complex.`
      });
      onUpdate({ sowDraft: result, sowNotes, sowStatus: 'draft' });
      setEditedSOW(result);
    } catch (e) { setError(e.message); }
    finally { setIsGenerating(false); }
  };

  const iterateSOW = async () => {
    if (!iterationFeedback.trim()) return;
    setIsIterating(true);
    try {
      const current = isEditing ? editedSOW : opportunity.sowDraft;
      const result = await callClaude({
        maxTokens: 12000,
        system: `You are updating a Statement of Work for Antenna Group. Apply the requested changes while maintaining all SOW quality standards.`,
        userMessage: `Update this SOW based on the following feedback:\n\nFEEDBACK: ${iterationFeedback}\n\nCURRENT SOW:\n${current}\n\nReturn the complete updated SOW.`
      });
      onUpdate({ sowDraft: result });
      setEditedSOW(result);
      setIterationFeedback('');
    } catch (e) { setError(e.message); }
    finally { setIsIterating(false); }
  };

  return (
    <div className="max-w-7xl mx-auto px-8 py-10">
      <div className="mb-8">
        <div className="w-12 h-12 bg-[#12161E] rounded-xl flex items-center justify-center mb-4">
          <PenTool className="w-6 h-6 text-white" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Statement of Work</h2>
        <p className="text-gray-500">Generate a complete, protective SOW from the approved proposal and return brief.</p>
      </div>

      {opportunity.proposalStatus !== 'approved' && (
        <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-800">Proposal not yet approved</p>
            <p className="text-xs text-amber-700 mt-1">The proposal status is currently <strong>{PROPOSAL_STATUSES.find(s => s.value === opportunity.proposalStatus)?.label || 'Draft'}</strong>. You can still generate an SOW, but typically you'd wait for approval. <button onClick={() => onUpdate({ currentStage: 'proposal' })} className="underline">→ Go to Proposal</button></p>
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Left: Controls */}
        <div className="space-y-5">
          <div className="bg-white rounded-2xl border border-gray-200 p-5">
            <h3 className="font-bold text-gray-900 mb-3">SOW Parameters</h3>
            <div className="space-y-3">
              <div><p className="text-xs text-gray-500 mb-1">Client</p><p className="text-sm font-semibold text-gray-900">{opportunity.companyName}</p></div>
              <div><p className="text-xs text-gray-500 mb-1">Engagement Type</p><p className="text-sm font-semibold text-gray-900">{engagementLabel}</p></div>
              <div><p className="text-xs text-gray-500 mb-1">Services</p><p className="text-sm text-gray-700">{(opportunity.selectedServices || []).length} services selected</p></div>
            </div>
            <div className="mt-4">
              <label className="block text-xs font-semibold text-gray-900 mb-1.5">Additional SOW Notes</label>
              <textarea value={sowNotes} onChange={e => setSOWNotes(e.target.value)} onBlur={() => onUpdate({ sowNotes })} placeholder="Payment schedule preferences, specific legal requirements, special terms..." className="w-full text-sm px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-gray-900 text-gray-700 min-h-[80px] resize-y" />
            </div>
          </div>

          {error && <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm flex gap-2"><AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />{error}</div>}

          <AntennaButton onClick={generateSOW} loading={isGenerating} loadingText="Generating SOW..." icon={PenTool} disabled={false} className="w-full">
            {opportunity.sowDraft ? 'Regenerate SOW' : 'Generate SOW'}
          </AntennaButton>

          {/* Iterate */}
          {opportunity.sowDraft && (
            <div className="bg-white rounded-2xl border border-gray-200 p-5">
              <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2"><RefreshCw className="w-4 h-4" />Iterate</h3>
              <textarea value={iterationFeedback} onChange={e => setIterationFeedback(e.target.value)} placeholder="'Add stronger revision limits', 'Update payment to net 45', 'Add a stop work clause'..." className="w-full text-sm px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-gray-900 text-gray-700 min-h-[80px] resize-y" />
              <button onClick={iterateSOW} disabled={isIterating || !iterationFeedback.trim()} className="mt-3 w-full px-4 py-2.5 bg-[#12161E] text-white rounded-xl text-sm font-semibold hover:bg-gray-800 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
                {isIterating ? <><Loader2 className="w-4 h-4 animate-spin" />Updating...</> : <><RefreshCw className="w-4 h-4" />Update SOW</>}
              </button>
            </div>
          )}
        </div>

        {/* Right: SOW Document */}
        <div className="lg:col-span-2">
          {!opportunity.sowDraft ? (
            <div className="h-full flex flex-col items-center justify-center text-center py-20 px-8 bg-white rounded-2xl border border-gray-200">
              <div className="w-20 h-20 bg-gray-100 rounded-2xl flex items-center justify-center mb-6"><PenTool className="w-10 h-10 text-gray-300" /></div>
              <h3 className="text-lg font-semibold text-gray-400 mb-2">SOW will appear here</h3>
              <p className="text-sm text-gray-400">Generate your Statement of Work from the approved proposal.</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  <span className="font-semibold text-gray-900">Statement of Work</span>
                  <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full">Generated</span>
                </div>
                <div className="flex items-center gap-2">
                  <CopyButton text={isEditing ? editedSOW : opportunity.sowDraft} />
                  <button onClick={() => { setIsEditing(!isEditing); setEditedSOW(opportunity.sowDraft); }} className="text-xs px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 flex items-center gap-1.5"><Edit3 className="w-3 h-3" />{isEditing ? 'Cancel' : 'Edit'}</button>
                  <button onClick={() => downloadDocx(opportunity.sowDraft, `${opportunity.companyName}_SOW.docx`, { title: `Statement of Work: ${opportunity.companyName}`, client: opportunity.companyName })} className="text-xs px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 flex items-center gap-1.5"><Download className="w-3 h-3" />Download</button>
                </div>
              </div>
              {isEditing ? (
                <div className="p-5">
                  <textarea value={editedSOW} onChange={e => setEditedSOW(e.target.value)} className="w-full text-sm text-gray-700 border border-gray-200 rounded-lg p-3 min-h-[600px] resize-y font-mono focus:ring-2 focus:ring-gray-900 outline-none" />
                  <button onClick={() => { onUpdate({ sowDraft: editedSOW }); setIsEditing(false); }} className="mt-3 px-4 py-2 bg-[#12161E] text-white rounded-lg text-sm font-medium">Save Changes</button>
                </div>
              ) : (
                <div className="p-5 max-h-[700px] overflow-y-auto">
                  <pre className="whitespace-pre-wrap text-sm text-gray-700 leading-relaxed font-sans">{opportunity.sowDraft}</pre>
                </div>
              )}
              {/* Proceed to Handover */}
              {opportunity.sowDraft && (
                <div className="px-5 pb-5">
                  <AntennaButton onClick={() => onUpdate({
                    currentStage: 'handover',
                    sowNotes,
                    sowDraft: opportunity.sowDraft,
                    sowStatus: opportunity.sowStatus,
                  })} icon={ArrowRight} className="w-full">
                    Proceed to Sales Handover →
                  </AntennaButton>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// STAGE 5: SOW REVIEW VIEW (standalone, no opportunity required)
// ============================================================================
function SOWReviewView() {
  const [file, setFile] = useState(null);
  const [fileContent, setFileContent] = useState(null);
  const [engagementType, setEngagementType] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [rawResponse, setRawResponse] = useState('');
  const [error, setError] = useState(null);
  const [isDrafting, setIsDrafting] = useState(false);
  const [draftedSOW, setDraftedSOW] = useState(null);
  const [selectedRecs, setSelectedRecs] = useState({ critical: [], recommended: [], redFlags: [] });
  const fileInputRef = useRef(null);

  const handleFileUpload = async (uploadedFile) => {
    setFile(uploadedFile);
    setAnalysis(null);
    setDraftedSOW(null);
    setError(null);
    const ext = uploadedFile.name.split('.').pop().toLowerCase();
    if (ext === 'txt') {
      const text = await uploadedFile.text();
      setFileContent({ type: 'text', data: text });
    } else {
      const reader = new FileReader();
      reader.onload = (e) => {
        const base64 = e.target.result.split(',')[1];
        setFileContent({ type: ext === 'pdf' ? 'pdf' : 'docx', data: base64 });
      };
      reader.readAsDataURL(uploadedFile);
    }
  };

  const analyzeSOW = async () => {
    if (!fileContent) return;
    setIsAnalyzing(true); setError(null); setAnalysis(null);
    try {
      const engLabel = ENGAGEMENT_TYPES.find(t => t.value === engagementType)?.label || 'Not specified';
      const promptText = `You are a senior agency contracts specialist reviewing a Statement of Work against Antenna Group quality standards.

ENGAGEMENT TYPE: ${engLabel}

${SOW_BEST_PRACTICES}

Review this SOW and provide:

## CRITICAL ISSUES
[Issues that MUST be fixed before this SOW can be issued. Each as: Section X.X: [Current language/situation] → [Recommended fix] — Why: [brief reason]]

## RECOMMENDED IMPROVEMENTS
[Issues that should be fixed. Same format as above.]

## RED FLAGS
[Problematic phrases found: "[exact phrase]" in Section X.X → "[recommended replacement using 'up to' language"]

## STRUCTURAL COMPLIANCE
[✓ Present or ✗ Missing for each required element]

## PRICING VALIDATION
[Compare fees against standard agency rates. Flag underpriced or overpriced items.]

## BUDGET VERIFICATION
[Check arithmetic and billing schedule alignment]

## OVERALL ASSESSMENT
Compliance Score: [X/10]
Top 3 Priorities: [list]
What's working well: [brief notes]`;

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': import.meta.env.VITE_ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
        body: JSON.stringify({
          model: MODEL, max_tokens: 8000,
          messages: [{
            role: 'user',
            content: fileContent.type === 'text'
              ? `${promptText}\n\n=== SOW ===\n${fileContent.data}`
              : [{ type: 'document', source: { type: 'base64', media_type: fileContent.type === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', data: fileContent.data } }, { type: 'text', text: promptText }]
          }]
        })
      });

      if (!response.ok) { const e = await response.json(); throw new Error(e.error?.message || 'API error'); }
      const data = await response.json();
      const text = data.content[0].text;
      setRawResponse(text);

      const parseSection = (t, start, ends) => {
        const s = Array.isArray(start) ? start : [start];
        let startIdx = -1, len = 0;
        for (const m of s) { const i = t.indexOf(m); if (i !== -1 && (startIdx === -1 || i < startIdx)) { startIdx = i; len = m.length; } }
        if (startIdx === -1) return [];
        let endIdx = t.length;
        for (const m of ends) { const i = t.indexOf(m, startIdx + len); if (i !== -1 && i < endIdx) endIdx = i; }
        const section = t.slice(startIdx + len, endIdx).trim();
        return section.split(/\n\n+/).map(s => s.trim()).filter(s => s.length > 40);
      };

      setAnalysis({
        critical: parseSection(text, ['## CRITICAL ISSUES', '1. CRITICAL ISSUES'], ['## RECOMMENDED', '## RED FLAGS', '2. RECOMMENDED']),
        recommended: parseSection(text, ['## RECOMMENDED IMPROVEMENTS', '2. RECOMMENDED'], ['## RED FLAGS', '3. RED FLAGS', '## STRUCTURAL']),
        redFlags: parseSection(text, ['## RED FLAGS', '3. RED FLAGS'], ['## STRUCTURAL', '## PRICING', '4. STRUCTURAL']),
        compliance: parseSection(text, ['## STRUCTURAL COMPLIANCE', '4. STRUCTURAL'], ['## PRICING', '## BUDGET', '5. PRICING']).join('\n\n'),
        pricing: parseSection(text, ['## PRICING VALIDATION', '5. PRICING'], ['## BUDGET', '## OVERALL', '6. BUDGET']).join('\n\n'),
        budget: parseSection(text, ['## BUDGET VERIFICATION', '6. BUDGET'], ['## OVERALL', '7. OVERALL']).join('\n\n'),
        overall: parseSection(text, ['## OVERALL ASSESSMENT', '7. OVERALL'], []).join('\n\n'),
      });
      setSelectedRecs({
        critical: parseSection(text, ['## CRITICAL ISSUES', '1. CRITICAL ISSUES'], ['## RECOMMENDED', '## RED FLAGS', '2. RECOMMENDED']).map((_, i) => i),
        recommended: parseSection(text, ['## RECOMMENDED IMPROVEMENTS', '2. RECOMMENDED'], ['## RED FLAGS', '3. RED FLAGS', '## STRUCTURAL']).map((_, i) => i),
        redFlags: parseSection(text, ['## RED FLAGS', '3. RED FLAGS'], ['## STRUCTURAL', '## PRICING', '4. STRUCTURAL']).map((_, i) => i),
      });
    } catch (e) { setError(e.message); }
    finally { setIsAnalyzing(false); }
  };

  const generateRevised = async () => {
    if (!analysis) return;
    setIsDrafting(true);
    try {
      const selectedCritical = (analysis.critical || []).filter((_, i) => selectedRecs.critical.includes(i));
      const selectedRecommended = (analysis.recommended || []).filter((_, i) => selectedRecs.recommended.includes(i));
      const selectedRedFlags = (analysis.redFlags || []).filter((_, i) => selectedRecs.redFlags.includes(i));
      const draftPrompt = `Based on ONLY the selected changes below, create a COMPLETE REVISED VERSION of this SOW. Mark modified sections [REVISED] and new sections [NEW].\n\nCritical fixes:\n${selectedCritical.join('\n\n') || 'None'}\n\nRecommended improvements:\n${selectedRecommended.join('\n\n') || 'None'}\n\nRed flags to replace:\n${selectedRedFlags.join('\n') || 'None'}`;
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': import.meta.env.VITE_ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
        body: JSON.stringify({
          model: MODEL, max_tokens: 16000,
          messages: [{ role: 'user', content: fileContent.type === 'text' ? `${draftPrompt}\n\n=== ORIGINAL SOW ===\n${fileContent.data}` : [{ type: 'document', source: { type: 'base64', media_type: fileContent.type === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', data: fileContent.data } }, { type: 'text', text: draftPrompt }] }]
        })
      });
      const data = await response.json();
      setDraftedSOW(data.content[0].text);
    } catch (e) { setError(e.message); }
    finally { setIsDrafting(false); }
  };

  const toggleRec = (type, idx) => {
    setSelectedRecs(prev => {
      const current = prev[type] || [];
      return { ...prev, [type]: current.includes(idx) ? current.filter(i => i !== idx) : [...current, idx] };
    });
  };

  return (
    <div className="max-w-7xl mx-auto px-8 py-10">
      <div className="mb-8">
        <div className="w-12 h-12 bg-[#12161E] rounded-xl flex items-center justify-center mb-4">
          <ShieldCheck className="w-6 h-6 text-white" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">SOW Review</h2>
        <p className="text-gray-500">Upload any existing SOW for a quality assessment against Antenna Group best practices.</p>
        <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-lg">
          <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
          <span className="text-xs text-amber-700 font-medium">Senior reviewer tool — for experienced team members</span>
        </div>
      </div>

      {/* Upload */}
      <div className="grid lg:grid-cols-3 gap-8 mb-8">
        <div className="space-y-5">
          <div
            onClick={() => fileInputRef.current?.click()}
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFileUpload(f); }}
            className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-gray-900 transition-colors cursor-pointer group"
          >
            <Upload className="w-10 h-10 text-gray-300 group-hover:text-gray-500 mx-auto mb-4 transition-colors" />
            {file ? <p className="font-semibold text-gray-900 text-sm">{file.name}</p> : <><p className="font-semibold text-gray-900 text-sm mb-1">Upload SOW</p><p className="text-xs text-gray-500">PDF, DOCX, or TXT</p></>}
            <input ref={fileInputRef} type="file" accept=".pdf,.docx,.txt" className="hidden" onChange={e => { if (e.target.files[0]) handleFileUpload(e.target.files[0]); }} />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">Engagement Type</label>
            <select value={engagementType} onChange={e => setEngagementType(e.target.value)} className="w-full px-3 py-2.5 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 outline-none text-gray-900">
              <option value="">Not specified</option>
              {ENGAGEMENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>

          {error && <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">{error}</div>}

          <AntennaButton onClick={analyzeSOW} loading={isAnalyzing} loadingText="Analyzing..." icon={Search} disabled={!file || !fileContent} className="w-full">
            Review SOW
          </AntennaButton>
        </div>

        {/* Analysis */}
        <div className="lg:col-span-2">
          {!analysis ? (
            <div className="h-full flex flex-col items-center justify-center text-center py-20 bg-white rounded-2xl border border-gray-200">
              <ShieldCheck className="w-12 h-12 text-gray-200 mb-4" />
              <h3 className="text-lg font-semibold text-gray-400 mb-2">Upload and review a SOW</h3>
              <p className="text-sm text-gray-400">Quality assessment will appear here after analysis.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {analysis.critical?.length > 0 && (
                <CollapsibleSection title="Critical Issues" variant="critical" icon={AlertCircle} count={analysis.critical.length} defaultOpen>
                  <div className="space-y-3">
                    {analysis.critical.map((issue, i) => (
                      <label key={i} className={`flex items-start gap-3 p-3 rounded-lg border transition-all cursor-pointer ${selectedRecs.critical.includes(i) ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200 opacity-60'}`}>
                        <input type="checkbox" checked={selectedRecs.critical.includes(i)} onChange={() => toggleRec('critical', i)} className="mt-0.5 w-4 h-4 text-red-600" />
                        <p className="text-sm text-gray-800 leading-relaxed">{issue}</p>
                      </label>
                    ))}
                  </div>
                </CollapsibleSection>
              )}
              {analysis.recommended?.length > 0 && (
                <CollapsibleSection title="Recommended Improvements" variant="recommended" icon={AlertTriangle} count={analysis.recommended.length} defaultOpen>
                  <div className="space-y-3">
                    {analysis.recommended.map((issue, i) => (
                      <label key={i} className={`flex items-start gap-3 p-3 rounded-lg border transition-all cursor-pointer ${selectedRecs.recommended.includes(i) ? 'bg-amber-50 border-amber-200' : 'bg-gray-50 border-gray-200 opacity-60'}`}>
                        <input type="checkbox" checked={selectedRecs.recommended.includes(i)} onChange={() => toggleRec('recommended', i)} className="mt-0.5 w-4 h-4 text-amber-600" />
                        <p className="text-sm text-gray-800 leading-relaxed">{issue}</p>
                      </label>
                    ))}
                  </div>
                </CollapsibleSection>
              )}
              {analysis.redFlags?.length > 0 && (
                <CollapsibleSection title="Red Flag Language" icon={AlertTriangle} count={analysis.redFlags.length}>
                  <div className="space-y-2">
                    {analysis.redFlags.map((flag, i) => (
                      <label key={i} className={`flex items-start gap-3 p-3 rounded-lg border transition-all cursor-pointer ${selectedRecs.redFlags.includes(i) ? 'bg-gray-50 border-gray-200' : 'bg-white border-gray-100 opacity-60'}`}>
                        <input type="checkbox" checked={selectedRecs.redFlags.includes(i)} onChange={() => toggleRec('redFlags', i)} className="mt-0.5 w-4 h-4" />
                        <p className="text-sm text-gray-700 font-mono">{flag}</p>
                      </label>
                    ))}
                  </div>
                </CollapsibleSection>
              )}
              {analysis.compliance && <CollapsibleSection title="Structural Compliance"><pre className="whitespace-pre-wrap text-sm text-gray-700">{analysis.compliance}</pre></CollapsibleSection>}
              {analysis.pricing && <CollapsibleSection title="Pricing Validation"><pre className="whitespace-pre-wrap text-sm text-gray-700">{analysis.pricing}</pre></CollapsibleSection>}
              {analysis.overall && <CollapsibleSection title="Overall Assessment" defaultOpen><pre className="whitespace-pre-wrap text-sm text-gray-900">{analysis.overall}</pre></CollapsibleSection>}

              {/* Generate Revised */}
              <div className="mt-6 bg-[#12161E] rounded-2xl p-6">
                <h3 className="text-white font-bold text-lg mb-2 flex items-center gap-2"><Sparkles className="w-5 h-5 text-[#E8FF00]" />Generate Revised SOW</h3>
                <p className="text-gray-400 text-sm mb-4">Create an updated draft incorporating your selected recommendations.</p>
                {!draftedSOW ? (
                  <AntennaButton onClick={generateRevised} loading={isDrafting} loadingText="Generating..." icon={Sparkles} disabled={selectedRecs.critical.length === 0 && selectedRecs.recommended.length === 0 && selectedRecs.redFlags.length === 0} variant="secondary" className="bg-white hover:bg-gray-100">
                    Draft Revised SOW
                  </AntennaButton>
                ) : (
                  <div className="space-y-3">
                    <div className="flex gap-3">
                      <span className="px-3 py-1.5 bg-green-900/30 border border-green-500/40 rounded-full text-green-300 text-sm flex items-center gap-2"><CheckCircle className="w-4 h-4" />Draft Generated</span>
                      <button onClick={() => downloadDocx(draftedSOW, `${file?.name?.replace(/\.[^.]+$/, '') || 'SOW'}_REVISED.docx`, { title: 'Revised Statement of Work' })} className="flex items-center gap-2 px-4 py-1.5 bg-white text-gray-900 rounded-lg text-sm font-medium hover:bg-gray-100 transition-colors"><Download className="w-4 h-4" />Download</button>
                    </div>
                    <div className="bg-gray-900 rounded-xl p-4 max-h-96 overflow-auto">
                      <pre className="whitespace-pre-wrap text-sm text-gray-100 font-mono">{draftedSOW}</pre>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


// ============================================================================
// HANDOVER VIEW — Stage 5
// ============================================================================
function HandoverView({ opportunity, onUpdate }) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isIterating, setIsIterating] = useState(false);
  const [error, setError] = useState(null);
  const [handoverNotes, setHandoverNotes] = useState(opportunity.handoverNotes || '');
  const [feedback, setFeedback] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [editedHandover, setEditedHandover] = useState(opportunity.handoverDraft || '');

  // Use onBlur saves, not unmount cleanup


  const engagementLabel = ENGAGEMENT_TYPES.find(t => t.value === opportunity.draftEngagementType)?.label || 'Fixed Fee';

  const pricingTotal = (() => {
    try {
      const services = opportunity.selectedServices || [];
      if (!services.length) return null;
      let low = 0, high = 0;
      services.forEach(name => {
        for (const cat of SERVICE_TRIGGERS) {
          const svc = cat.services?.find(s => s.name === name);
          if (svc?.pricing) {
            low += svc.pricing.budgetLow || 0;
            high += svc.pricing.budgetHigh || 0;
            break;
          }
        }
      });
      if (!low && !high) return null;
      const fmt = (n) => n >= 1000000 ? `$${(n/1000000).toFixed(1)}M` : `$${(n/1000).toFixed(0)}K`;
      return { low, high, lowFmt: fmt(low), highFmt: fmt(high) };
    } catch { return null; }
  })();

  const generateHandover = async () => {
    setIsGenerating(true); setError(null);
    try {
      const pricing = pricingTotal ? `${pricingTotal.lowFmt} – ${pricingTotal.highFmt}` : 'See proposal for details';
      const result = await callClaude({
        maxTokens: 6000,
        system: `You are a senior business development lead at Antenna Group, an integrated marketing and communications agency. You write clear, concise internal sales handover documents that give the delivery team everything they need to hit the ground running. Your writing is confident, pithy, and free of fluff. You write in plain English — no buzzwords, no filler.`,
        userMessage: `Write a 2–3 page internal Sales Handover document for the delivery team. This is NOT a client-facing document — it is a crisp internal briefing that transfers knowledge from sales to delivery.

CLIENT: ${opportunity.companyName}
RID: ${opportunity.rid || 'TBC'}
PRACTICE: ${opportunity.practice || 'Not specified'}
ENGAGEMENT TYPE: ${engagementLabel}
SERVICES: ${(opportunity.selectedServices || []).join(', ') || 'See proposal'}
ESTIMATED INVESTMENT: ${pricing}

RETURN BRIEF (key client context):
${(opportunity.returnBrief || '').substring(0, 2000)}

PROPOSAL SUMMARY:
${(opportunity.proposalDraft || '').substring(0, 2000)}

SOW HIGHLIGHTS:
${(opportunity.sowDraft || '').substring(0, 2000)}

ADDITIONAL NOTES: ${handoverNotes || 'None'}

Write the handover document with these exact sections, in this order:

## The Assignment
One crisp paragraph: what we've been asked to do, why now, and what the client is trying to achieve. No more than 5 sentences.

## Client Background
Key facts about the company — who they are, their market position, what makes them tick. Surface anything from the brief that the delivery team needs to understand the client. 3–5 bullet points max.

## The Brief in Plain English
What problem are we actually solving? Write this as if you're telling a colleague over coffee — direct, clear, no jargon. Include the client's stated goals, any tensions or constraints, and what the client cares most about.

## Services & Scope
List the agreed services and what's included. Note any scope boundaries or explicit exclusions the team needs to respect.

## What Success Looks Like
3–5 specific, measurable outcomes the client will judge us on. Be precise — avoid generic statements like "increase brand awareness."

## Budget & Commercial
- Estimated investment range
- Engagement type (${engagementLabel})
- Key commercial terms (payment milestones, notice period, etc.) from the SOW if available
- Any budget sensitivities flagged in the brief

## Key Relationships & Stakeholders
Who are we working with? Decision-maker, day-to-day contact, internal champions, potential detractors. Note any political dynamics flagged during the sales process.

## Watch Outs
2–4 honest bullets about risks, sensitivities, or things the team should know before their first meeting. What would have been good to know on day one?

## Immediate Next Steps
3 concrete actions for the delivery team in the first two weeks.

Format: Use markdown with ## headers. Keep the whole document tight — every sentence should earn its place. This document should be readable in under 5 minutes.`
      });
      onUpdate({ handoverDraft: result, handoverNotes, handoverStatus: 'draft' });
      setEditedHandover(result);
    } catch (e) { setError(e.message); }
    finally { setIsGenerating(false); }
  };

  const iterateHandover = async () => {
    if (!feedback.trim()) return;
    setIsIterating(true);
    try {
      const current = isEditing ? editedHandover : opportunity.handoverDraft;
      const result = await callClaude({
        maxTokens: 6000,
        system: `You are updating an internal sales handover document. Apply the requested changes while keeping the document pithy, direct, and under 3 pages.`,
        userMessage: `Update this handover document based on the following feedback:\n\nFEEDBACK: ${feedback}\n\nCURRENT DOCUMENT:\n${current}\n\nReturn the complete updated document.`
      });
      onUpdate({ handoverDraft: result });
      setEditedHandover(result);
      setFeedback('');
    } catch (e) { setError(e.message); }
    finally { setIsIterating(false); }
  };

  const hasPrereqs = opportunity.proposalDraft && opportunity.sowDraft;

  return (
    <div className="max-w-7xl mx-auto px-8 py-10">
      <div className="mb-8">
        <div className="w-12 h-12 bg-[#12161E] rounded-xl flex items-center justify-center mb-4">
          <ClipboardList className="w-6 h-6 text-white" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Sales Handover</h2>
        <p className="text-gray-500">Generate the internal briefing document that transfers this opportunity from sales to delivery.</p>
      </div>

      {!hasPrereqs && (
        <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-800">Complete earlier stages first</p>
            <p className="text-xs text-amber-700 mt-1">A proposal and SOW are needed before generating the handover document.</p>
          </div>
        </div>
      )}

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-red-700 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />{error}
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Left panel */}
        <div className="space-y-5">
          {/* Summary card */}
          <div className="bg-[#12161E] rounded-2xl p-5 text-white">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Assignment Summary</p>
            <div className="space-y-3">
              <div>
                <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-0.5">Client</p>
                <p className="font-bold text-lg leading-tight">{opportunity.companyName}</p>
              </div>
              {opportunity.rid && (
                <div>
                  <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-0.5">RID</p>
                  <p className="font-mono text-[#E8FF00] font-bold">{opportunity.rid}</p>
                </div>
              )}
              {opportunity.practice && (
                <div>
                  <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-0.5">Practice</p>
                  <p className="text-sm text-gray-300">{opportunity.practice}</p>
                </div>
              )}
              <div>
                <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-0.5">Engagement</p>
                <p className="text-sm text-gray-300">{engagementLabel}</p>
              </div>
              {pricingTotal && (
                <div>
                  <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-0.5">Investment Range</p>
                  <p className="text-xl font-black text-[#E8FF00]">{pricingTotal.lowFmt}</p>
                  <p className="text-xs text-gray-500">– {pricingTotal.highFmt}</p>
                </div>
              )}
              <div>
                <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-1">Services</p>
                <div className="flex flex-wrap gap-1">
                  {(opportunity.selectedServices || []).slice(0, 6).map(s => (
                    <span key={s} className="text-[10px] px-1.5 py-0.5 bg-white/10 rounded text-gray-300">{s}</span>
                  ))}
                  {(opportunity.selectedServices || []).length > 6 && (
                    <span className="text-[10px] px-1.5 py-0.5 bg-white/10 rounded text-gray-400">+{opportunity.selectedServices.length - 6} more</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5">
            <h3 className="font-bold text-gray-900 mb-3">Notes for Handover</h3>
            <textarea
              value={handoverNotes}
              onChange={e => setHandoverNotes(e.target.value)}
              onBlur={() => onUpdate({ handoverNotes })}
              placeholder="Key context for the delivery team, relationship notes, sensitivities..."
              className="w-full text-sm px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-gray-900 text-gray-700 min-h-[100px] resize-y"
            />
          </div>

          {/* Generate */}
          {!opportunity.handoverDraft ? (
            <AntennaButton
              onClick={generateHandover}
              loading={isGenerating}
              loadingText="Generating Handover..."
              icon={ClipboardList}
              disabled={!hasPrereqs}
              size="large"
              className="w-full"
            >
              Generate Handover Doc
            </AntennaButton>
          ) : (
            <div className="space-y-3">
              <AntennaButton onClick={generateHandover} loading={isGenerating} loadingText="Regenerating..." icon={RotateCcw} size="default" className="w-full" variant="secondary">
                Regenerate
              </AntennaButton>
              <div className="bg-white rounded-2xl border border-gray-200 p-4">
                <h4 className="text-xs font-bold text-gray-700 mb-2">Iterate with Feedback</h4>
                <textarea
                  value={feedback}
                  onChange={e => setFeedback(e.target.value)}
                  placeholder="e.g. Sharpen the Watch Outs section, add more detail on budget..."
                  className="w-full text-sm px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-gray-900 text-gray-700 min-h-[70px] resize-y mb-2"
                />
                <AntennaButton onClick={iterateHandover} loading={isIterating} loadingText="Updating..." disabled={!feedback.trim()} icon={RefreshCw} size="small" className="w-full">
                  Apply Feedback
                </AntennaButton>
              </div>
            </div>
          )}
        </div>

        {/* Right: Document */}
        <div className="lg:col-span-2">
          {!opportunity.handoverDraft ? (
            <div className="flex flex-col items-center justify-center py-24 bg-white rounded-2xl border border-dashed border-gray-200">
              <ClipboardList className="w-12 h-12 text-gray-200 mb-4" />
              <h3 className="text-lg font-semibold text-gray-400 mb-2">No handover document yet</h3>
              <p className="text-sm text-gray-400 text-center max-w-xs">Add any notes in the left panel and generate the handover doc.</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-gray-900">Sales Handover Document</span>
                  <span className="text-xs px-2 py-0.5 bg-[#E8FF00] text-[#12161E] font-bold rounded">Internal</span>
                </div>
                <div className="flex items-center gap-2">
                  <CopyButton text={isEditing ? editedHandover : opportunity.handoverDraft} />
                  <button
                    onClick={() => { setIsEditing(!isEditing); setEditedHandover(opportunity.handoverDraft); }}
                    className="text-xs px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 flex items-center gap-1.5"
                  >
                    <Edit3 className="w-3 h-3" />{isEditing ? 'Cancel' : 'Edit'}
                  </button>
                  <button
                    onClick={() => downloadDocx(
                      opportunity.handoverDraft,
                      `${opportunity.companyName}_SalesHandover.docx`,
                      { title: `Sales Handover: ${opportunity.companyName}`, client: opportunity.companyName }
                    )}
                    className="text-xs px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 flex items-center gap-1.5"
                  >
                    <Download className="w-3 h-3" />Download
                  </button>
                </div>
              </div>
              {isEditing ? (
                <div className="p-5">
                  <textarea
                    value={editedHandover}
                    onChange={e => setEditedHandover(e.target.value)}
                    className="w-full text-sm text-gray-700 border border-gray-200 rounded-lg p-3 min-h-[600px] resize-y font-mono focus:ring-2 focus:ring-gray-900 outline-none"
                  />
                  <button
                    onClick={() => { onUpdate({ handoverDraft: editedHandover }); setIsEditing(false); }}
                    className="mt-3 px-4 py-2 bg-[#12161E] text-white rounded-lg text-sm font-medium"
                  >
                    Save Changes
                  </button>
                </div>
              ) : (
                <div className="p-6 max-h-[700px] overflow-y-auto">
                  <pre className="whitespace-pre-wrap text-sm text-gray-700 leading-relaxed font-sans">{opportunity.handoverDraft}</pre>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


// ============================================================================
// QUALIFICATION MODAL — Smartsheet integration
// ============================================================================
const SMARTSHEET_COLUMNS = [
  { key: 'CLIENT', label: 'Client' },
  { key: 'Assignment Title', label: 'Assignment' },
  { key: 'QUALIFIED BY', label: 'Qualified By' },
  { key: 'REQUEST TYPE', label: 'Request Type' },
  { key: 'RECOMMENDATION', label: 'Recommendation' },
  { key: 'QUALIFICATION SCORE (OUT OF 80)', label: 'Score /80' },
  { key: 'Workflow Status', label: 'Status' },
  { key: 'Owning Ecosystem', label: 'Ecosystem' },
  { key: 'CONFLICT', label: 'Conflict' },
  { key: 'Modified', label: 'Date Qualified' },
];

function QualificationModal({ onClose }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQ, setSearchQ] = useState('');
  const [filterRec, setFilterRec] = useState('');
  const [filterEco, setFilterEco] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [sortCol, setSortCol] = useState('QUALIFICATION SCORE (OUT OF 80)');
  const [sortDir, setSortDir] = useState('desc');

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true); setError('');
    try {
      const { data, error: fnError } = await supabase.functions.invoke('smartsheet-proxy', {
        body: { sheetId: '5750175070900100' },
      });
      if (fnError || data?.error) {
        setError(data?.error || fnError?.message || 'Could not load qualification data.');
      } else if (data?.rows) {
        setRows(data.rows);
      }
    } catch (e) {
      setError(e.message || 'Failed to connect to Smartsheet.');
    } finally {
      setLoading(false);
    }
  };

  const recommendations = [...new Set(rows.map(r => r['RECOMMENDATION']).filter(Boolean))];
  const ecosystems = [...new Set(rows.map(r => r['Owning Ecosystem']).filter(Boolean))];
  const statuses = [...new Set(rows.map(r => r['Workflow Status']).filter(Boolean))];

  const filtered = rows.filter(r => {
    const q = searchQ.toLowerCase();
    const matchSearch = !q ||
      (r['CLIENT'] || '').toLowerCase().includes(q) ||
      (r['Assignment Title'] || '').toLowerCase().includes(q) ||
      (r['QUALIFIED BY'] || '').toLowerCase().includes(q);
    const matchRec = !filterRec || r['RECOMMENDATION'] === filterRec;
    const matchEco = !filterEco || r['Owning Ecosystem'] === filterEco;
    const matchStatus = !filterStatus || r['Workflow Status'] === filterStatus;
    return matchSearch && matchRec && matchEco && matchStatus;
  }).sort((a, b) => {
    const av = a[sortCol] ?? '';
    const bv = b[sortCol] ?? '';
    if (typeof av === 'number' && typeof bv === 'number') {
      return sortDir === 'asc' ? av - bv : bv - av;
    }
    const as = String(av).toLowerCase();
    const bs = String(bv).toLowerCase();
    return sortDir === 'asc' ? as.localeCompare(bs) : bs.localeCompare(as);
  });

  const handleSort = (col) => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('desc'); }
  };

  const recStyle = (rec) => {
    if (!rec) return 'bg-gray-100 text-gray-500';
    const r = rec.toUpperCase();
    if (r === 'PROCEED') return 'bg-green-100 text-green-700';
    if (r === 'DECLINE') return 'bg-red-100 text-red-700';
    if (r === 'PROCEED WITH CAUTION') return 'bg-amber-100 text-amber-700';
    return 'bg-gray-100 text-gray-600';
  };

  const scoreBar = (score) => {
    if (!score && score !== 0) return null;
    const pct = Math.min(100, (score / 80) * 100);
    const color = pct >= 70 ? '#6B9E4A' : pct >= 50 ? '#E8C23D' : '#E8553D';
    return (
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
          <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
        </div>
        <span className="text-xs font-bold" style={{ color }}>{score}</span>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}>
      <div className="absolute inset-4 bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-8 py-5 border-b border-gray-200 bg-[#12161E] flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-[#E8FF00] rounded-xl flex items-center justify-center">
              <TableProperties className="w-5 h-5 text-[#12161E]" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Qualification Board</h2>
              <p className="text-xs text-gray-400">Live from Smartsheet · {rows.length} opportunities</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={loadData} disabled={loading} className="p-2 text-gray-400 hover:text-white transition-colors">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button onClick={onClose} className="p-2 text-gray-400 hover:text-white transition-colors"><X className="w-5 h-5" /></button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 px-8 py-4 border-b border-gray-100 bg-gray-50 flex-shrink-0">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <input
              value={searchQ} onChange={e => setSearchQ(e.target.value)}
              placeholder="Search client, assignment, qualifier..."
              className="w-full pl-9 pr-3 py-2 bg-white border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-gray-900 placeholder:text-gray-400"
            />
            {searchQ && <button onClick={() => setSearchQ('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400"><X className="w-3.5 h-3.5" /></button>}
          </div>
          <select value={filterRec} onChange={e => setFilterRec(e.target.value)} className="px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm outline-none text-gray-700">
            <option value="">All Recommendations</option>
            {recommendations.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
          <select value={filterEco} onChange={e => setFilterEco(e.target.value)} className="px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm outline-none text-gray-700">
            <option value="">All Ecosystems</option>
            {ecosystems.map(e => <option key={e} value={e}>{e}</option>)}
          </select>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm outline-none text-gray-700">
            <option value="">All Statuses</option>
            {statuses.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          {(searchQ || filterRec || filterEco || filterStatus) && (
            <button onClick={() => { setSearchQ(''); setFilterRec(''); setFilterEco(''); setFilterStatus(''); }} className="text-xs px-3 py-2 border border-gray-200 bg-white rounded-xl text-gray-500 hover:bg-gray-50">Clear</button>
          )}
          <span className="text-xs text-gray-400 ml-auto">{filtered.length} of {rows.length}</span>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto px-8 py-4">
          {loading ? (
            <div className="flex items-center justify-center py-24">
              <div className="text-center">
                <Loader2 className="w-8 h-8 animate-spin text-gray-400 mx-auto mb-3" />
                <p className="text-sm text-gray-400">Loading from Smartsheet...</p>
              </div>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-24">
              <AlertCircle className="w-10 h-10 text-red-300 mb-4" />
              <p className="text-sm text-red-600 font-medium mb-2">Could not load data</p>
              <p className="text-xs text-gray-400 mb-4">{error}</p>
              <button onClick={loadData} className="px-4 py-2 bg-[#12161E] text-white rounded-xl text-sm font-medium">Retry</button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-24">
              <p className="text-gray-400">No results match your filters.</p>
            </div>
          ) : (
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b-2 border-gray-200">
                  {SMARTSHEET_COLUMNS.map(col => (
                    <th key={col.key}
                      onClick={() => handleSort(col.key)}
                      className="text-left py-2.5 px-3 text-xs font-bold text-gray-500 uppercase tracking-wide cursor-pointer hover:text-gray-900 select-none whitespace-nowrap">
                      <div className="flex items-center gap-1">
                        {col.label}
                        {sortCol === col.key && (
                          <ChevronDown className={`w-3 h-3 transition-transform ${sortDir === 'asc' ? 'rotate-180' : ''}`} />
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((row, i) => (
                  <tr key={i} className="hover:bg-gray-50 transition-colors">
                    <td className="py-3 px-3 font-semibold text-gray-900 w-36 max-w-[144px]">
                      <p className="truncate" title={row['CLIENT']}>{row['CLIENT'] || '—'}</p>
                    </td>
                    <td className="py-3 px-3 text-gray-700 max-w-[180px]">
                      <p className="truncate">{row['Assignment Title'] || '—'}</p>
                    </td>
                    <td className="py-3 px-3 text-gray-500 whitespace-nowrap text-xs">{row['QUALIFIED BY'] || '—'}</td>
                    <td className="py-3 px-3 max-w-[160px]">
                      <p className="text-xs text-gray-500 line-clamp-2">{row['REQUEST TYPE'] || '—'}</p>
                    </td>
                    <td className="py-3 px-3">
                      {row['RECOMMENDATION'] ? (
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${recStyle(row['RECOMMENDATION'])}`}>
                          {row['RECOMMENDATION']}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="py-3 px-3 w-32">
                      {scoreBar(row['QUALIFICATION SCORE (OUT OF 80)'])}
                    </td>
                    <td className="py-3 px-3">
                      {row['Workflow Status'] ? (
                        <span className="text-xs px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full font-medium whitespace-nowrap">{row['Workflow Status']}</span>
                      ) : '—'}
                    </td>
                    <td className="py-3 px-3 text-xs text-gray-500 whitespace-nowrap">{row['Owning Ecosystem'] || '—'}</td>
                    <td className="py-3 px-3">
                      {row['CONFLICT'] && row['CONFLICT'].toString().toLowerCase() !== 'no' && row['CONFLICT'].toString().toLowerCase() !== 'none' ? (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-red-600">
                          <XCircle className="w-3 h-3" />Yes
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-green-600">
                          <CheckCircle className="w-3 h-3" />No
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-xs text-gray-400 whitespace-nowrap">
                      {row['Modified'] ? new Date(row['Modified']).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className="px-8 py-3 border-t border-gray-100 bg-gray-50 flex-shrink-0 flex items-center justify-between">
          <p className="text-xs text-gray-400">Data sourced live from Smartsheet. Refresh to see latest.</p>
          <a href={`https://app.smartsheet.com/sheets/5750175070900100`} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-900 transition-colors">
            Open in Smartsheet <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>
    </div>
  );
}


// ============================================================================
// HOME / DASHBOARD VIEW
// ============================================================================
function HomeView({ opportunities, onSelectOpportunity, onCreateOpportunity, onDeleteOpportunity, onOpenReview, onOpenQualification, currentUser, roleInfo }) {
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [newIndustry, setNewIndustry] = useState('');
  const [newPractice, setNewPractice] = useState('');
  const [searchQ, setSearchQ] = useState('');
  const [filterStage, setFilterStage] = useState('');
  const [filterPractice, setFilterPractice] = useState('');

  const handleCreate = () => {
    if (!newName.trim() || !newTitle.trim()) return;
    const opp = createOpportunity(newName.trim(), newUrl.trim(), newIndustry.trim(), newPractice, newTitle.trim());
    onCreateOpportunity(opp);
    setShowCreate(false);
    setNewName(''); setNewTitle(''); setNewUrl(''); setNewIndustry(''); setNewPractice('');
  };

  const getStageLabel = (opp) => PIPELINE_STAGES.find(s => s.id === opp.currentStage)?.label || 'Research';

  const getProgress = (opp) => {
    const stages = ['research', 'brief', 'proposal', 'sow', 'handover'];
    const idx = stages.indexOf(opp.currentStage);
    if (opp.currentStage === 'handover' && opp.handoverDraft) return 100;
    if (opp.currentStage === 'sow' && opp.sowDraft) return 85;
    return Math.round(((idx + 0.5) / stages.length) * 100);
  };

  const getBudgetRange = (opp) => {
    try {
      const services = opp.selectedServices || [];
      if (!services.length) return null;
      let low = 0, high = 0;
      services.forEach(name => {
        for (const cat of SERVICE_TRIGGERS) {
          const svc = cat.services?.find(s => s.name === name);
          if (svc?.pricing) { low += svc.pricing.budgetLow || 0; high += svc.pricing.budgetHigh || 0; break; }
        }
      });
      if (!low && !high) return null;
      const fmt = n => n >= 1000000 ? `$${(n/1000000).toFixed(1)}M` : `$${(n/1000).toFixed(0)}K`;
      return `${fmt(low)}–${fmt(high)}`;
    } catch { return null; }
  };

  const exportToExcel = () => {
    const rows = filtered.map(o => ({
      'Opp #': o.oppNumber || '',
      'Company': o.companyName,
      'Title': o.title || '',
      'Practice': o.practice || '',
      'RID': o.rid || '',
      'Industry': o.industry || '',
      'Stage': getStageLabel(o),
      'Progress': `${getProgress(o)}%`,
      'Budget Range': getBudgetRange(o) || '',
      'Status': PROPOSAL_STATUSES.find(s => s.value === o.proposalStatus)?.label || '',
      'Created': new Date(o.createdAt).toLocaleDateString(),
    }));
    const header = Object.keys(rows[0] || {});
    const csv = [header.join(','), ...rows.map(r => header.map(h => `"${(r[h] || '').toString().replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    saveAs(blob, `AG_Opportunities_${new Date().toISOString().slice(0,10)}.csv`);
  };

  const allActive = opportunities.filter(o => o.proposalStatus !== 'evaporated');
  const evaporated = opportunities.filter(o => o.proposalStatus === 'evaporated');

  const q = searchQ.toLowerCase().trim();
  const filtered = allActive.filter(o => {
    const matchSearch = !q ||
      o.companyName.toLowerCase().includes(q) ||
      (o.title || '').toLowerCase().includes(q) ||
      (o.rid || '').toLowerCase().includes(q) ||
      (o.oppNumber || '').toLowerCase().includes(q) ||
      (o.practice || '').toLowerCase().includes(q) ||
      (o.industry || '').toLowerCase().includes(q);
    const matchStage = !filterStage || o.currentStage === filterStage;
    const matchPractice = !filterPractice || o.practice === filterPractice;
    return matchSearch && matchStage && matchPractice;
  });

  const stagePill = (stageId) => ({
    research: { bg: '#FFF3E8', color: '#C26B1E', border: '#F5C89A' },
    brief:    { bg: '#FEF9EC', color: '#A08018', border: '#EDD98A' },
    proposal: { bg: '#EEF5E8', color: '#4A7A30', border: '#9DC87A' },
    sow:      { bg: '#E8EEF5', color: '#2A5A8A', border: '#7AAAC8' },
    handover: { bg: '#F0EBF8', color: '#6B3FA0', border: '#C3A8E8' },
  }[stageId] || { bg: '#F5F5F5', color: '#666', border: '#DDD' });

  const stageColors = ['#E8853D', '#E8C23D', '#6B9E4A', '#4A7AAC', '#9B59B6'];

  return (
    <div className="max-w-7xl mx-auto px-8 pb-16">

      {/* Hero */}
      <div className="mb-10">
        <p className="text-xs font-bold tracking-widest text-gray-400 uppercase mb-2">Antenna Group · Internal Tools</p>
        <h1 className="text-5xl lg:text-6xl font-black text-[#12161E] leading-none mb-4 tracking-tight">SOW Workbench</h1>
        <p className="text-base text-gray-500 max-w-2xl leading-relaxed mb-8">
          We diagnose before we prescribe! This tool helps you identify an opportunity and ensure that we can move fast and recommend the right services to solve our clients' problems.
        </p>
        {/* Action buttons — unified style */}
        <div className="flex flex-wrap gap-3">
          {roleInfo?.canCreateOpportunities !== false && (
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 px-5 py-3 bg-[#12161E] text-white rounded-xl font-semibold text-sm hover:bg-[#2a3040] transition-all shadow-sm"
            >
              <Plus className="w-4 h-4" />New Opportunity
            </button>
          )}
          {onOpenReview && (
            <button
              onClick={onOpenReview}
              className="flex items-center gap-2 px-5 py-3 bg-white border border-gray-200 text-gray-700 rounded-xl font-semibold text-sm hover:border-[#12161E] hover:text-[#12161E] transition-all shadow-sm"
            >
              <ShieldCheck className="w-4 h-4" />Review Existing SOW
            </button>
          )}
          <button
            onClick={onOpenQualification}
            className="flex items-center gap-2 px-5 py-3 bg-white border border-gray-200 text-gray-700 rounded-xl font-semibold text-sm hover:border-[#12161E] hover:text-[#12161E] transition-all shadow-sm"
          >
            <TableProperties className="w-4 h-4" />Check If Your Opportunity Is Qualified
          </button>
        </div>
      </div>

      {/* Pipeline stage cards — single row of 5 */}
      <div className="grid grid-cols-5 gap-3 mb-10">
        {PIPELINE_STAGES.map((stage, idx) => {
          const stageCount = allActive.filter(o => o.currentStage === stage.id).length;
          const isActive = filterStage === stage.id;
          return (
            <button key={stage.id} onClick={() => setFilterStage(isActive ? '' : stage.id)}
              className={`bg-white rounded-xl border p-5 text-left transition-all ${isActive ? 'border-[#12161E] ring-2 ring-[#12161E]/10 shadow-sm' : 'border-gray-200 hover:border-gray-400 hover:shadow-sm'}`}>
              <div className="flex items-start justify-between mb-3">
                <span className="text-xs font-bold tracking-widest text-gray-300 uppercase">{String(idx + 1).padStart(2,'0')}</span>
                {stageCount > 0 && <span className="text-2xl font-black leading-none" style={{ color: stageColors[idx] }}>{stageCount}</span>}
              </div>
              <h3 className="font-black text-[#12161E] text-base leading-tight mb-1">{stage.label}</h3>
              <p className="text-xs text-gray-400 leading-snug">{stage.description}</p>
            </button>
          );
        })}
      </div>

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-6">
          <div className="bg-white rounded-2xl border border-gray-200 p-8 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-gray-900">New Opportunity</h3>
              <button onClick={() => setShowCreate(false)} className="text-gray-400 hover:text-gray-900 transition-colors"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-1.5">Company Name <span className="text-red-400">*</span></label>
                <input value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => e.key === 'Enter' && newName.trim() && handleCreate()} placeholder="e.g. Pacific Fusion" autoFocus className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#12161E] outline-none text-gray-900 placeholder:text-gray-400 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-1.5">Assignment Title <span className="text-red-500">*</span></label>
                <input value={newTitle} onChange={e => setNewTitle(e.target.value)}
                  placeholder="e.g. Q4 Integrated Campaign"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#12161E] outline-none text-gray-900 placeholder:text-gray-400 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-1.5">Owning Practice</label>
                <select value={newPractice} onChange={e => setNewPractice(e.target.value)} className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#12161E] outline-none text-gray-900 bg-white text-sm">
                  <option value="">Select practice...</option>
                  {PRACTICES.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-1.5">Website <span className="text-gray-400 font-normal">(optional)</span></label>
                <input value={newUrl} onChange={e => setNewUrl(e.target.value)} placeholder="https://example.com" className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#12161E] outline-none text-gray-900 placeholder:text-gray-400 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-1.5">Industry <span className="text-gray-400 font-normal">(optional)</span></label>
                <input value={newIndustry} onChange={e => setNewIndustry(e.target.value)} placeholder="e.g. Climate Tech" className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#12161E] outline-none text-gray-900 placeholder:text-gray-400 text-sm" />
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowCreate(false)} className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-700 rounded-xl font-semibold text-sm hover:bg-gray-50 transition-colors">Cancel</button>
              <button onClick={handleCreate} disabled={!newName.trim() || !newTitle.trim()} className="flex-1 px-4 py-2.5 bg-[#12161E] text-white rounded-xl font-semibold text-sm disabled:opacity-40 hover:bg-[#2a3040] transition-colors flex items-center justify-center gap-2">
                <Plus className="w-4 h-4" />Create Opportunity
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Opportunities List */}
      {opportunities.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-gray-200">
          <Building2 className="w-12 h-12 text-gray-200 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-400 mb-2">No opportunities yet</h3>
          <p className="text-sm text-gray-400 mb-6">Create your first opportunity to begin the pipeline.</p>
          {roleInfo?.canCreateOpportunities !== false && (
            <button onClick={() => setShowCreate(true)} className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#12161E] text-white rounded-xl font-semibold text-sm hover:bg-[#2a3040] transition-colors">
              <Plus className="w-4 h-4" />New Opportunity
            </button>
          )}
        </div>
      ) : (
        <div>
          {/* Section title + search row */}
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-[#12161E]">Opportunities</h2>
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <span>{filtered.length} of {allActive.length}</span>
            </div>
          </div>

          {/* Search + Filter bar */}
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              <input
                value={searchQ} onChange={e => setSearchQ(e.target.value)}
                placeholder="Search company, title, RID, practice..."
                className="w-full pl-9 pr-8 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#12161E] outline-none placeholder:text-gray-400"
              />
              {searchQ && <button onClick={() => setSearchQ('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"><X className="w-3.5 h-3.5" /></button>}
            </div>
            <select value={filterPractice} onChange={e => setFilterPractice(e.target.value)} className="px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#12161E] outline-none text-gray-700">
              <option value="">All Practices</option>
              {PRACTICES.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
            {(searchQ || filterStage || filterPractice) && (
              <button onClick={() => { setSearchQ(''); setFilterStage(''); setFilterPractice(''); }} className="text-xs px-3 py-2.5 border border-gray-200 bg-white rounded-xl text-gray-500 hover:bg-gray-50 transition-colors">Clear</button>
            )}
            {filtered.length > 0 && (
              <button onClick={exportToExcel} className="ml-auto flex items-center gap-1.5 text-xs px-3 py-2.5 border border-gray-200 bg-white rounded-xl text-gray-600 hover:border-[#12161E] hover:text-[#12161E] transition-all font-medium">
                <Download className="w-3.5 h-3.5" />Export to Excel
              </button>
            )}
          </div>

          {/* Column headers */}
          <div className="grid grid-cols-12 gap-3 px-4 mb-2">
            <span className="col-span-1 text-xs font-semibold text-gray-400 uppercase tracking-wide">Opp #</span>
            <span className="col-span-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Company & Title</span>
            <span className="col-span-2 text-xs font-semibold text-gray-400 uppercase tracking-wide hidden sm:block">Practice / RID</span>
            <span className="col-span-2 text-xs font-semibold text-gray-400 uppercase tracking-wide hidden sm:block">Stage</span>
            <span className="col-span-2 text-xs font-semibold text-gray-400 uppercase tracking-wide hidden sm:block">Progress</span>
            <span className="col-span-1 text-xs font-semibold text-gray-400 uppercase tracking-wide hidden sm:block">Budget</span>
            <span className="col-span-1 text-xs font-semibold text-gray-400 uppercase tracking-wide hidden sm:block">Modified By</span>
          </div>

          {filtered.length === 0 ? (
            <div className="text-center py-10 bg-white rounded-xl border border-dashed border-gray-200">
              <p className="text-gray-400 text-sm">No opportunities match your filters.</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {filtered.map((opp) => {
                const progress = getProgress(opp);
                const budget = getBudgetRange(opp);
                const initials = opp.companyName.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase();
                const pill = stagePill(opp.currentStage);
                return (
                  <div key={opp.id} className="relative group/row">
                    <button onClick={() => onSelectOpportunity(opp)}
                      className="w-full bg-white rounded-xl border border-gray-200 hover:border-[#12161E] hover:shadow-sm transition-all p-4 text-left group grid grid-cols-12 gap-3 items-center">
                    {/* Opp # */}
                    <div className="col-span-1">
                      <span className="text-[10px] font-mono text-gray-400 group-hover:text-gray-600 transition-colors">{opp.oppNumber || '—'}</span>
                    </div>
                    {/* Company + Title */}
                    <div className="col-span-3 flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 bg-[#12161E] group-hover:bg-[#E8FF00] rounded-lg flex items-center justify-center flex-shrink-0 transition-colors">
                        <span className="text-xs font-black text-white group-hover:text-[#12161E] transition-colors">{initials}</span>
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-[#12161E] leading-tight truncate text-sm">{opp.companyName}</p>
                        {opp.title
                          ? <p className="text-xs text-gray-500 mt-0.5 truncate">{opp.title}</p>
                          : <p className="text-xs text-gray-300 mt-0.5 truncate">{opp.industry || opp.companyUrl || '—'}</p>
                        }
                      </div>
                    </div>
                    {/* Practice + RID */}
                    <div className="col-span-2 hidden sm:flex flex-col gap-0.5 min-w-0">
                      {opp.practice && <span className="text-xs font-semibold text-gray-700 truncate">{opp.practice}</span>}
                      {opp.rid && <span className="text-[10px] font-mono bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded w-fit">{opp.rid}</span>}
                      {!opp.practice && !opp.rid && <span className="text-xs text-gray-300">—</span>}
                    </div>
                    {/* Stage */}
                    <div className="col-span-2 hidden sm:block">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border"
                        style={{ backgroundColor: pill.bg, color: pill.color, borderColor: pill.border }}>
                        {getStageLabel(opp)}
                      </span>
                    </div>
                    {/* Progress */}
                    <div className="col-span-2 hidden sm:block">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: '#e5e5e5' }}>
                          <div className="h-full rounded-full transition-all" style={{
                            width: `${progress}%`,
                            background: progress < 40 ? 'linear-gradient(90deg,#888,#E8853D)' :
                                        progress < 70 ? 'linear-gradient(90deg,#E8853D,#6B9E4A)' :
                                                        'linear-gradient(90deg,#6B9E4A,#4A7AAC)'
                          }} />
                        </div>
                        <span className="text-xs font-bold text-gray-400 w-8 text-right">{progress}%</span>
                      </div>
                    </div>
                    {/* Budget + Modified By + arrow */}
                    <div className="col-span-1 hidden sm:block">
                      {budget
                        ? <span className="text-xs font-semibold text-gray-700">{budget}</span>
                        : <span className="text-xs text-gray-300">—</span>}
                    </div>
                    <div className="col-span-1 hidden sm:flex items-center justify-between gap-1">
                      <span className="text-[10px] text-gray-400 truncate" title={opp.lastModifiedBy || ''}>
                        {opp.lastModifiedBy ? opp.lastModifiedBy.split('@')[0] : '—'}
                      </span>
                      <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-[#12161E] transition-colors flex-shrink-0" />
                    </div>
                  </button>
                  {/* Admin delete button — appears on row hover */}
                  {roleInfo?.canAccessAdmin && (
                    <button
                      onClick={(e) => { e.stopPropagation(); if (window.confirm(`Delete "${opp.companyName} — ${opp.title || ''}"? This cannot be undone.`)) onDeleteOpportunity(opp.id); }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover/row:opacity-100 transition-opacity p-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-400 hover:text-red-600"
                      title="Delete opportunity"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                );
              })}
            </div>
          )}

          {evaporated.length > 0 && (
            <div className="mt-6">
              <CollapsibleSection title={`Evaporated (${evaporated.length})`} icon={Archive}>
                <div className="space-y-1.5">
                  {evaporated.map(opp => (
                    <div key={opp.id} className="relative group/row flex items-center">
                      <button onClick={() => onSelectOpportunity(opp)} className="flex-1 flex items-center justify-between p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
                        <div>
                          <span className="text-sm text-gray-500 font-medium">{opp.companyName}</span>
                          {opp.title && <span className="text-xs text-gray-400 ml-2">{opp.title}</span>}
                          {opp.oppNumber && <span className="text-[10px] font-mono text-gray-400 ml-2">{opp.oppNumber}</span>}
                        </div>
                        <ChevronRight className="w-4 h-4 text-gray-300" />
                      </button>
                      {roleInfo?.canAccessAdmin && (
                        <button
                          onClick={(e) => { e.stopPropagation(); if (window.confirm(`Delete "${opp.companyName}"? This cannot be undone.`)) onDeleteOpportunity(opp.id); }}
                          className="ml-2 p-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-400 hover:text-red-600 transition-colors flex-shrink-0"
                          title="Delete opportunity"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </CollapsibleSection>
            </div>
          )}
        </div>
      )}

      {/* Footer credit */}
      <div className="mt-16 pb-6 text-center">
        <p className="text-xs text-gray-300 tracking-wide">A Mr Newton Production</p>
        <p className="text-[10px] text-gray-400 mt-0.5">v{APP_VERSION}</p>
      </div>
    </div>
  );
}

// ============================================================================
// MAIN APP
// ============================================================================
export default function App() {
  // ---- AUTH ----
  const [currentUser, setCurrentUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [showAdmin, setShowAdmin] = useState(false);
  const [showQualification, setShowQualification] = useState(false);

  // Restore session from Supabase on mount
  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const { data: profile } = await supabase
          .from('profiles').select('*').eq('id', session.user.id).single();
        if (profile && profile.active !== false) {
          setCurrentUser({ ...profile, id: session.user.id });
        } else {
          await supabase.auth.signOut();
        }
      }
      setAuthLoading(false);
    };
    init();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        setCurrentUser(null);
        setCurrentView('home');
        setCurrentOpportunity(null);
        setOpportunities([]);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleLogin = (user) => setCurrentUser(user);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    // onAuthStateChange handles state reset above
  };

  // ---- PIPELINE ----
  const [currentView, setCurrentView] = useState('home'); // home | opportunity | sow-review
  const [currentStage, setCurrentStage] = useState('research');
  const [currentOpportunity, setCurrentOpportunity] = useState(null);

  // Opportunities — stored in Supabase opportunities table
  const [opportunities, setOpportunities] = useState([]);

  // Load user data when user changes
  useEffect(() => {
    if (!currentUser) return;
    setCurrentView('home');
    setCurrentOpportunity(null);
    setCurrentStage('research');

    supabase
      .from('opportunities')
      .select('id, data, created_at, updated_at')
      .eq('user_id', currentUser.id)
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (!error && data) {
          setOpportunities(data.map(r => {
            const opp = { ...r.data, id: r.id };
            // Backfill oppNumber for older records that don't have one
            if (!opp.oppNumber) {
              opp.oppNumber = getNextOppNumber();
              supabase.from('opportunities').update({ data: { ...r.data, oppNumber: opp.oppNumber } }).eq('id', r.id);
            }
            return opp;
          }));
        }
      });
  }, [currentUser?.id]);

  // Keep a ref in sync with currentOpportunity
  const currentOpportunityRef = useRef(null);
  useEffect(() => { currentOpportunityRef.current = currentOpportunity; }, [currentOpportunity]);

  // Keep a ref to currentUser for lastModifiedBy stamping
  const currentUserRef = useRef(null);
  useEffect(() => { currentUserRef.current = currentUser; }, [currentUser]);

  // ---- AUTO-SAVE ----
  // Single reliable save path: watches currentOpportunity state, debounces 1.2s, persists to Supabase.
  // This replaces all scattered fire-and-forget saves. Any state change automatically triggers a save.
  const [saveStatus, setSaveStatus] = useState('idle'); // 'idle' | 'saving' | 'saved' | 'error'
  const saveTimerRef = useRef(null);

  useEffect(() => {
    if (!currentOpportunity?.id) return;
    setSaveStatus('saving');
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      try {
        const { id, ...data } = currentOpportunity;
        const { error } = await supabase
          .from('opportunities')
          .update({ data })
          .eq('id', id);
        if (error) {
          console.error('[SOW Workbench] Save failed:', error.message, error);
          setSaveStatus('error');
        } else {
          setSaveStatus('saved');
        }
      } catch (err) {
        console.error('[SOW Workbench] Save exception:', err);
        setSaveStatus('error');
      }
    }, 1200);
    return () => clearTimeout(saveTimerRef.current);
  }, [currentOpportunity]);

  // updateOpportunity: updates state only. The auto-save useEffect above handles persistence.
  const updateOpportunity = useCallback((updates) => {
    const prev = currentOpportunityRef.current;
    if (!prev) return;
    const user = currentUserRef.current;
    const modifiedBy = user?.name || user?.email || 'Unknown';
    const updated = {
      ...prev,
      ...updates,
      updatedAt: new Date().toISOString(),
      lastModifiedBy: modifiedBy,
      lastModifiedAt: new Date().toISOString(),
    };
    setCurrentOpportunity(updated);
    if (updates.currentStage) setCurrentStage(updates.currentStage);
    setOpportunities(prevOpps => prevOpps.map(o => o.id === updated.id ? updated : o));
  }, []);

  const selectOpportunity = (opp, goToStage) => {
    setCurrentOpportunity(opp);
    setCurrentStage(goToStage || opp.currentStage || 'research');
    setCurrentView('opportunity');
  };

  const createOpportunityAndSelect = async (opp) => {
    if (!currentUser) return;
    // Strip any client-generated id — Supabase will assign the real UUID
    const { id: _ignored, ...oppData } = opp;
    const { data: row, error } = await supabase
      .from('opportunities')
      .insert({ user_id: currentUser.id, data: oppData })
      .select('id')
      .single();
    if (error) { console.error('Failed to create opportunity:', error.message); return; }
    const newOpp = { ...oppData, id: row.id };
    setOpportunities(prev => [newOpp, ...prev]);
    setCurrentOpportunity(newOpp);
    setCurrentStage('research');
    setCurrentView('opportunity');
  };

  const deleteOpportunity = async (id) => {
    await supabase.from('opportunities').delete().eq('id', id);
    setOpportunities(prev => prev.filter(o => o.id !== id));
    if (currentOpportunity?.id === id) { setCurrentOpportunity(null); setCurrentView('home'); }
  };

  // ---- ROLE ACCESS GUARDS ----
  const roleInfo = currentUser ? (USER_ROLES[currentUser.role] || USER_ROLES.growth) : null;

  const canAccessStage = (stageId) => roleInfo?.allowedStages.includes(stageId) ?? false;

  const renderStageView = () => {
    if (!currentOpportunity || !roleInfo) return null;
    if (!canAccessStage(currentStage)) {
      return (
        <div className="max-w-6xl mx-auto px-6 py-20 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Lock className="w-8 h-8 text-gray-400" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Access Restricted</h2>
          <p className="text-gray-500 mb-6">Your <span className="font-semibold">{roleInfo.label}</span> role doesn't include access to this stage.</p>
          <button onClick={() => { const first = roleInfo.allowedStages[0]; if (first) { setCurrentStage(first); updateOpportunity({ currentStage: first }); } else setCurrentView('home'); }} className="px-6 py-3 bg-[#12161E] text-white rounded-xl font-semibold hover:bg-gray-800 transition-colors">
            {roleInfo.allowedStages.length > 0 ? `Go to ${PIPELINE_STAGES.find(s => s.id === roleInfo.allowedStages[0])?.label}` : 'Back to Home'}
          </button>
        </div>
      );
    }
    const props = { opportunity: currentOpportunity, onUpdate: updateOpportunity };
    switch (currentStage) {
      case 'research': return <ResearchView {...props} />;
      case 'brief': return <BriefView {...props} />;
      case 'proposal': return <ProposalView {...props} />;
      case 'sow': return <SOWGenerateView {...props} />;
      case 'handover': return <HandoverView {...props} />;
      default: return <ResearchView {...props} />;
    }
  };

  // ---- NOT LOGGED IN / LOADING ----
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#E8E6E1' }}>
        <div className="text-center">
          <AntennaLogo className="h-10 mx-auto mb-6 opacity-70" />
          <Loader2 className="w-6 h-6 animate-spin text-gray-400 mx-auto" />
        </div>
      </div>
    );
  }
  if (!currentUser) return <LoginView onLogin={handleLogin} />;

  // ---- REVIEWER ONLY LAYOUT ----
  if (currentUser.role === 'reviewer') {
    return (
      <div className="min-h-screen" style={{ backgroundColor: '#E8E6E1' }}>
        <header className="border-b border-gray-200 sticky top-0 z-20" style={{ backgroundColor: '#E8E6E1' }}>
          <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
            <AntennaLogo className="h-8" />
            <UserMenu currentUser={currentUser} onLogout={handleLogout} onOpenAdmin={() => {}} />
          </div>
        </header>
        <main className="max-w-7xl mx-auto px-8 py-10">
          <div className="mb-6 flex items-center gap-3">
            <div className="px-3 py-1.5 bg-amber-100 border border-amber-200 rounded-lg flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-amber-600" />
              <span className="text-sm font-medium text-amber-800">Reviewer Access — SOW Review Only</span>
            </div>
          </div>
          <SOWReviewView />
        </main>
      </div>
    );
  }

  // ---- MAIN LAYOUT ----
  return (
    <div className="min-h-screen" style={{ backgroundColor: '#E8E6E1' }}>
      {showAdmin && <AdminView currentUser={currentUser} onClose={() => setShowAdmin(false)} />}
      {showQualification && <QualificationModal onClose={() => setShowQualification(false)} />}

      {/* Header */}
      <header className="border-b border-gray-200/80 sticky top-0 z-20" style={{ backgroundColor: '#E8E6E1' }}>
        <div className="max-w-7xl mx-auto px-8 py-0">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-3">
              <button onClick={() => setCurrentView('home')} className="hover:opacity-80 transition-opacity">
                <AntennaLogo className="h-7" />
              </button>
              <div className="h-5 w-px bg-gray-300" />
              <span className="text-sm font-semibold text-[#12161E] tracking-tight">SOW Workbench</span>
            </div>
            <div className="flex items-center gap-3">
              {currentView === 'opportunity' && currentOpportunity && (
                <button onClick={() => { setCurrentOpportunity(null); setCurrentView('home'); }} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 transition-colors">
                  <ChevronLeft className="w-4 h-4" />All Opportunities
                </button>
              )}
              {currentView === 'opportunity' && currentOpportunity && (
                <div className="flex items-center gap-1.5 text-xs">
                  {saveStatus === 'saving' && <><Loader2 className="w-3 h-3 animate-spin text-gray-400" /><span className="text-gray-400">Saving...</span></>}
                  {saveStatus === 'saved' && <><CheckCircle className="w-3 h-3 text-green-500" /><span className="text-green-600">Saved</span></>}
                  {saveStatus === 'error' && <><AlertCircle className="w-3 h-3 text-red-500" /><span className="text-red-600 font-medium">Save failed — check console</span></>}
                </div>
              )}
              {currentView === 'sow-review' && (
                <button onClick={() => setCurrentView('home')} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 transition-colors">
                  <ChevronLeft className="w-4 h-4" />Back
                </button>
              )}
              <button
                onClick={() => setShowQualification(true)}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-600 bg-white border border-gray-200 rounded-lg hover:border-[#12161E] hover:text-[#12161E] transition-all"
              >
                <TableProperties className="w-3.5 h-3.5" />Qualified?
              </button>
              <UserMenu currentUser={currentUser} onLogout={handleLogout} onOpenAdmin={() => setShowAdmin(true)} />
            </div>
          </div>
        </div>

        {/* Stage Progress Bar */}
        {currentView === 'opportunity' && currentOpportunity && (
          <StageProgress
            currentStage={currentStage}
            opportunity={currentOpportunity}
            allowedStages={roleInfo?.allowedStages || []}
            onStageClick={(stageId) => {
              if (!canAccessStage(stageId)) return;
              setCurrentStage(stageId);
              updateOpportunity({ currentStage: stageId });
            }}
          />
        )}
      </header>

      {/* Main Content */}
      <main>
        {currentView === 'home' && (
          <HomeView
            opportunities={opportunities}
            onSelectOpportunity={selectOpportunity}
            onCreateOpportunity={createOpportunityAndSelect}
            onDeleteOpportunity={deleteOpportunity}
            onOpenReview={roleInfo?.canAccessSOWReview ? () => setCurrentView('sow-review') : null}
            onOpenQualification={() => setShowQualification(true)}
            currentUser={currentUser}
            roleInfo={roleInfo}
          />
        )}
        {currentView === 'opportunity' && renderStageView()}
        {currentView === 'sow-review' && (
          roleInfo?.canAccessSOWReview
            ? <SOWReviewView />
            : <div className="max-w-xl mx-auto py-20 text-center"><Lock className="w-10 h-10 text-gray-300 mx-auto mb-4" /><p className="text-gray-500">Your role doesn't include SOW Review access.</p></div>
        )}
      </main>
    </div>
  );
}
