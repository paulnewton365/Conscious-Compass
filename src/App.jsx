import { useState, useEffect, useRef } from 'react';
import { ATTRIBUTES, BUSINESS_MODELS, getMaturityStage, MATURITY_STAGES, SERVICE_RECOMMENDATIONS } from './data/rubric';
import { getAllRecommendations, formatBudget } from './data/serviceMapping';
import { Compass, ArrowRight, ArrowLeft, Globe, Users, Bot, Newspaper, BarChart3, FileText, Play, Check, Loader2, ChevronDown, Download, Save, Plus, Trash2, X, Upload, Image, ExternalLink, Lock, Share2, Link, Copy } from 'lucide-react';
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx';
import { saveAs } from 'file-saver';
import { jsPDF } from 'jspdf';

const DEFAULT_API_KEY = '';

const APP_PASSWORD = 'paulisbuildingthis';

// Password Gate Component
function PasswordGate({ onSuccess }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (password === APP_PASSWORD) {
      localStorage.setItem('conscious-compass-auth', 'true');
      onSuccess();
    } else {
      setError(true);
      setPassword('');
    }
  };

  return (
    <div className="min-h-screen bg-[#E8E6E1] flex items-center justify-center p-8">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-[#E53935]/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Lock className="w-8 h-8 text-[#E53935]" />
          </div>
          <h1 className="text-2xl font-bold text-[#1A1A1A] mb-2">Conscious Compass</h1>
          <p className="text-[#666666]">Enter password to access the assessment tool</p>
        </div>
        
        <form onSubmit={handleSubmit} className="card p-6">
          <div className="mb-4">
            <label className="block text-sm font-medium text-[#1A1A1A] mb-2">Password</label>
            <input 
              type="password" 
              value={password} 
              onChange={(e) => { setPassword(e.target.value); setError(false); }}
              placeholder="Enter password"
              className={`w-full px-4 py-3 border rounded-lg bg-white ${error ? 'border-red-500' : 'border-[#D9D6D0]'}`}
              autoFocus
            />
            {error && <p className="text-red-500 text-sm mt-2">Incorrect password</p>}
          </div>
          <button type="submit" className="btn-primary btn-arrow w-full">
            Access Tool
          </button>
        </form>
        
        <p className="text-center text-xs text-[#9CA3AF] mt-6">
          Antenna Group | Brand Consciousness Assessment
        </p>
      </div>
    </div>
  );
}

const INDUSTRIES = [
  { id: 'technology', name: 'Technology & Software' },
  { id: 'healthcare', name: 'Healthcare & Life Sciences' },
  { id: 'finance', name: 'Financial Services' },
  { id: 'energy', name: 'Energy & Utilities' },
  { id: 'manufacturing', name: 'Manufacturing & Industrial' },
  { id: 'retail', name: 'Retail & Consumer Goods' },
  { id: 'media', name: 'Media & Entertainment' },
  { id: 'telecom', name: 'Telecommunications' },
  { id: 'professional', name: 'Professional Services' },
  { id: 'realestate', name: 'Real Estate & Construction' },
  { id: 'mobility', name: 'Mobility & Automotive' },
  { id: 'transportation', name: 'Transportation & Logistics' },
  { id: 'hospitality', name: 'Hospitality & Travel' },
  { id: 'education', name: 'Education' },
  { id: 'nonprofit', name: 'Nonprofit & Government' },
  { id: 'other', name: 'Other' },
];

// Compress image to max size for Claude API (5MB limit, we target 4MB)
function compressImage(dataUrl, maxSizeMB = 4) {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        
        // Scale down large images first
        const maxDimension = 1800;
        if (width > maxDimension || height > maxDimension) {
          const scale = maxDimension / Math.max(width, height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }
        
        canvas.width = width;
        canvas.height = height;
        
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        
        // Convert to JPEG with quality reduction
        let quality = 0.85;
        let result = canvas.toDataURL('image/jpeg', quality);
        const maxBytes = maxSizeMB * 1024 * 1024;
        
        // Reduce quality if still too big
        while (result.length * 0.75 > maxBytes && quality > 0.4) {
          quality -= 0.1;
          result = canvas.toDataURL('image/jpeg', quality);
        }
        
        // If still too big, reduce dimensions more
        if (result.length * 0.75 > maxBytes) {
          const smallerScale = 0.7;
          canvas.width = Math.round(width * smallerScale);
          canvas.height = Math.round(height * smallerScale);
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          result = canvas.toDataURL('image/jpeg', 0.7);
        }
        
        resolve(result);
      } catch (err) {
        reject(err);
      }
    };
    
    img.onerror = () => {
      reject(new Error('Failed to load image'));
    };
    
    img.src = dataUrl;
  });
}

async function callClaude(prompt, apiKey, primaryImage = null, additionalImages = [], temperature = 1) {
  const content = [];
  
  // Add primary image if provided
  if (primaryImage) {
    const matches = primaryImage.match(/^data:([^;]+);base64,(.+)$/);
    if (matches) {
      content.push({
        type: 'image',
        source: { type: 'base64', media_type: matches[1], data: matches[2] }
      });
    }
  }
  
  // Add additional images
  if (additionalImages && additionalImages.length > 0) {
    for (const img of additionalImages) {
      const matches = img.match(/^data:([^;]+);base64,(.+)$/);
      if (matches) {
        content.push({
          type: 'image',
          source: { type: 'base64', media_type: matches[1], data: matches[2] }
        });
      }
    }
  }
  
  content.push({ type: 'text', text: prompt });
  
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
      max_tokens: 6000,
      temperature: temperature,
      messages: [{ role: 'user', content }]
    })
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `API error: ${response.status}`);
  }
  const data = await response.json();
  return data.content[0].text;
}

// Spider Chart Component
function SpiderChart({ scores, size = 400 }) {
  const padding = 80; // Extra padding for labels
  const viewBoxSize = size + padding * 2;
  const center = viewBoxSize / 2;
  const radius = size * 0.35; // Slightly smaller to give more room
  const attrs = ATTRIBUTES;
  const angleStep = (2 * Math.PI) / attrs.length;
  
  // Calculate overall score (filter to only include attribute scores, not justification)
  const overall = scores ? Math.round(
    Object.entries(scores)
      .filter(([key, val]) => val && typeof val.score === 'number')
      .reduce((a, [, v]) => a + v.score, 0) / 8
  ) : 0;
  
  const getPoint = (index, value) => {
    const angle = angleStep * index - Math.PI / 2;
    const r = (value / 100) * radius;
    return {
      x: center + r * Math.cos(angle),
      y: center + r * Math.sin(angle)
    };
  };

  const gridLevels = [20, 40, 60, 80, 100];
  
  const dataPoints = attrs.map((attr, i) => getPoint(i, scores[attr.id]?.score || 0));
  const pathD = dataPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ') + ' Z';

  return (
    <svg viewBox={`0 0 ${viewBoxSize} ${viewBoxSize}`} className="spider-chart w-full max-w-lg mx-auto" style={{ overflow: 'visible' }}>
      {/* Grid circles */}
      {gridLevels.map(level => {
        const r = (level / 100) * radius;
        return (
          <circle key={level} cx={center} cy={center} r={r} fill="none" stroke="#D9D6D0" strokeWidth="1" />
        );
      })}
      
      {/* Axis lines */}
      {attrs.map((_, i) => {
        const angle = angleStep * i - Math.PI / 2;
        const x2 = center + radius * Math.cos(angle);
        const y2 = center + radius * Math.sin(angle);
        return <line key={i} x1={center} y1={center} x2={x2} y2={y2} stroke="#D9D6D0" strokeWidth="1" />;
      })}
      
      {/* Data polygon */}
      <path d={pathD} fill="rgba(158, 157, 36, 0.35)" stroke="#9E9D24" strokeWidth="2.5" />
      
      {/* Data points */}
      {dataPoints.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="6" fill="#9E9D24" stroke="white" strokeWidth="2" />
      ))}
      
      {/* Center score circle */}
      <circle cx={center} cy={center} r="45" fill="#9E9D24" />
      <text x={center} y={center + 2} textAnchor="middle" dominantBaseline="middle" 
            className="font-bold fill-white" style={{ fontSize: '32px' }}>
        {overall}
      </text>
      
      {/* Labels */}
      {attrs.map((attr, i) => {
        const angle = angleStep * i - Math.PI / 2;
        const labelRadius = radius + 40;
        const x = center + labelRadius * Math.cos(angle);
        const y = center + labelRadius * Math.sin(angle);
        return (
          <text key={attr.id} x={x} y={y} textAnchor="middle" dominantBaseline="middle" 
                className="text-xs font-medium fill-[#1A1A1A]">
            {attr.name}
          </text>
        );
      })}
      
      {/* Score labels */}
      {attrs.map((attr, i) => {
        const point = dataPoints[i];
        return (
          <text key={`score-${attr.id}`} x={point.x} y={point.y - 14} textAnchor="middle" 
                className="text-xs font-bold fill-[#9E9D24]">
            {scores[attr.id]?.score || 0}
          </text>
        );
      })}
    </svg>
  );
}

// Maturity Continuum Visual
function MaturityContinuum({ score }) {
  const stage = getMaturityStage(score);
  const percentage = score;
  
  return (
    <div className="card p-6">
      <h3 className="text-lg font-semibold text-[#1A1A1A] mb-4">Brand Consciousness Maturity</h3>
      
      {/* Scale */}
      <div className="relative mb-16">
        <div className="h-4 rounded-full maturity-scale" />
        
        {/* Marker */}
        <div 
          className="absolute top-0 transform -translate-x-1/2 transition-all duration-1000"
          style={{ left: `${percentage}%` }}
        >
          <div className="w-0 h-0 border-l-8 border-r-8 border-b-8 border-l-transparent border-r-transparent border-b-[#1A1A1A] -mt-2" />
          <div className="absolute top-6 left-1/2 transform -translate-x-1/2 bg-[#1A1A1A] text-white px-3 py-1 rounded-lg text-sm font-bold whitespace-nowrap">
            {score}/100
          </div>
        </div>
      </div>
      
      {/* Stage Labels */}
      <div className="flex justify-between text-xs text-[#666666] mb-4">
        {MATURITY_STAGES.map(s => (
          <div key={s.id} className="text-center" style={{ width: `${(s.max - s.min + 1)}%` }}>
            <div className="w-2 h-2 rounded-full mx-auto mb-1" style={{ backgroundColor: s.color }} />
            <span className={stage.id === s.id ? 'font-bold text-[#1A1A1A]' : ''}>{s.name}</span>
          </div>
        ))}
      </div>
      
      {/* Current Stage Description */}
      <div className="bg-[#F0EEEA] rounded-lg p-4 text-center">
        <div className="text-2xl font-bold mb-1" style={{ color: stage.color }}>{stage.name}</div>
        <p className="text-sm text-[#333333]">{stage.description}</p>
      </div>
    </div>
  );
}

// Header
function Header({ onNewAssessment, onSavedAssessments, onCompassResults, onComparison, lastAutoSave }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  return (
    <header className="bg-[#E8E6E1] border-b border-[#D9D6D0] py-4 md:py-5 px-4 md:px-6">
      <div className="max-w-6xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-2 md:gap-4">
          <img src="https://ktuyiikwhspwmzvyczit.supabase.co/storage/v1/object/public/assets/brand/antenna-new-logo.svg" alt="Antenna Group" className="h-6 md:h-8" style={{ filter: 'brightness(0)' }} />
          <div className="hidden md:block h-6 w-px bg-[#1A1A1A]" />
          <span className="hidden md:block text-lg font-semibold text-[#1A1A1A]">Conscious Compass</span>
        </div>
        
        {/* Desktop Navigation */}
        <div className="hidden md:flex items-center gap-3">
          {lastAutoSave && (
            <span className="text-xs text-[#9CA3AF] mr-2">
              Auto-saved {lastAutoSave.toLocaleTimeString()}
            </span>
          )}
          <button onClick={onComparison} className="flex items-center gap-2 text-sm text-[#333333] hover:text-[#1A1A1A] transition-colors">
            <Users className="w-4 h-4" /> Compare
          </button>
          <button onClick={onCompassResults} className="flex items-center gap-2 text-sm text-[#333333] hover:text-[#1A1A1A] transition-colors">
            <BarChart3 className="w-4 h-4" /> Results
          </button>
          <button onClick={onSavedAssessments} className="flex items-center gap-2 text-sm text-[#333333] hover:text-[#1A1A1A] transition-colors">
            <FileText className="w-4 h-4" /> Saved
          </button>
          <button onClick={onNewAssessment} className="flex items-center gap-2 text-sm bg-[#1A1A1A] text-white hover:bg-[#333333] px-4 py-2 rounded-lg transition-colors">
            <Plus className="w-4 h-4" /> New
          </button>
        </div>

        {/* Mobile Menu Button */}
        <button 
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="md:hidden p-2 text-[#1A1A1A]"
        >
          {mobileMenuOpen ? <X className="w-6 h-6" /> : <ChevronDown className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden mt-4 pt-4 border-t border-[#D9D6D0] space-y-2">
          {lastAutoSave && (
            <div className="text-xs text-[#9CA3AF] px-2 pb-2">
              Auto-saved {lastAutoSave.toLocaleTimeString()}
            </div>
          )}
          <button onClick={() => { onComparison(); setMobileMenuOpen(false); }} className="w-full flex items-center gap-3 px-4 py-3 text-[#333333] hover:bg-[#F0EEEA] rounded-lg transition-colors">
            <Users className="w-5 h-5" /> Compare Brands
          </button>
          <button onClick={() => { onCompassResults(); setMobileMenuOpen(false); }} className="w-full flex items-center gap-3 px-4 py-3 text-[#333333] hover:bg-[#F0EEEA] rounded-lg transition-colors">
            <BarChart3 className="w-5 h-5" /> Results Grid
          </button>
          <button onClick={() => { onSavedAssessments(); setMobileMenuOpen(false); }} className="w-full flex items-center gap-3 px-4 py-3 text-[#333333] hover:bg-[#F0EEEA] rounded-lg transition-colors">
            <FileText className="w-5 h-5" /> Saved Assessments
          </button>
          <button onClick={() => { onNewAssessment(); setMobileMenuOpen(false); }} className="w-full flex items-center gap-3 px-4 py-3 bg-[#1A1A1A] text-white rounded-lg transition-colors">
            <Plus className="w-5 h-5" /> New Assessment
          </button>
        </div>
      )}
    </header>
  );
}

// Progress Steps
function ProgressSteps({ currentStep, steps, assessments }) {
  return (
    <div className="bg-white border-b border-[#D9D6D0] py-3 md:py-4 px-4 md:px-6">
      <div className="max-w-6xl mx-auto">
        {/* Desktop Progress */}
        <div className="hidden md:flex items-center justify-center gap-2">
          {steps.map((step, i) => (
            <div key={step.id} className="flex items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all ${
                i < currentStep ? 'bg-[#E53935] text-white' : i === currentStep ? 'bg-[#E53935]/10 text-[#E53935] ring-2 ring-[#E53935]' : 'bg-[#F0EEEA] text-gray-400'
              }`}>
                {i < currentStep ? <Check className="w-4 h-4" /> : i + 1}
              </div>
              {i < steps.length - 1 && <div className={`w-8 h-0.5 mx-1 ${i < currentStep ? 'bg-[#E53935]' : 'bg-[#D9D6D0]'}`} />}
            </div>
          ))}
        </div>
        
        {/* Mobile Progress */}
        <div className="md:hidden flex items-center justify-between">
          <span className="text-sm font-medium text-[#1A1A1A]">
            Step {currentStep} of {steps.length - 1}: {steps[currentStep]?.name}
          </span>
          <div className="flex items-center gap-1">
            {steps.slice(1).map((_, i) => (
              <div 
                key={i}
                className={`w-2 h-2 rounded-full ${i < currentStep ? 'bg-[#E53935]' : i === currentStep - 1 ? 'bg-[#E53935]' : 'bg-[#D9D6D0]'}`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// Welcome Page
function WelcomePage({ onStart }) {
  return (
    <div className="min-h-[calc(100vh-80px)] flex items-center justify-center p-8 relative">
      <div className="max-w-3xl text-center animate-fade-in">
        <h1 className="text-5xl md:text-6xl font-bold text-[#1A1A1A] mb-6 leading-tight">
          Consequential brands are conscious brands.
        </h1>
        <p className="text-xl text-[#333333] mb-8 leading-relaxed max-w-2xl mx-auto">
          They don't just show up, they stand out. They don't follow trends; they shape narratives. 
          The Conscious Compass explores your brand's impact across 8 essential attributes.
        </p>
        <button onClick={onStart} className="btn-primary btn-arrow text-lg px-8 py-4">
          Start Assessment
        </button>
      </div>
      <div className="absolute bottom-4 right-4 text-xs text-[#9CA3AF]">
        Version 2.8.3
      </div>
    </div>
  );
}

// Setup Page
function SetupPage({ project, setProject, apiKey, setApiKey, onNext }) {
  const canProceed = project.brandName && project.websiteUrl && apiKey;

  return (
    <div className="max-w-2xl mx-auto p-8 animate-fade-in">
      <h2 className="text-3xl font-bold text-[#1A1A1A] mb-2">Brand Details</h2>
      <p className="text-[#333333] mb-8">Tell us about the brand you're assessing.</p>

      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-[#1A1A1A] mb-2">Brand Name *</label>
          <input type="text" value={project.brandName} onChange={(e) => setProject({ ...project, brandName: e.target.value })}
            placeholder="e.g., Antenna Group" className="w-full px-4 py-3 border border-[#D9D6D0] rounded-lg bg-white" />
        </div>

        <div>
          <label className="block text-sm font-medium text-[#1A1A1A] mb-2">Website URL *</label>
          <input type="url" value={project.websiteUrl} onChange={(e) => setProject({ ...project, websiteUrl: e.target.value })}
            placeholder="https://www.example.com" className="w-full px-4 py-3 border border-[#D9D6D0] rounded-lg bg-white" />
        </div>

        <div>
          <label className="block text-sm font-medium text-[#1A1A1A] mb-2">Business Model</label>
          <select value={project.businessModel} onChange={(e) => setProject({ ...project, businessModel: e.target.value })}
            className="w-full px-4 py-3 border border-[#D9D6D0] rounded-lg bg-white">
            {BUSINESS_MODELS.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-[#1A1A1A] mb-2">Industry</label>
          <select value={project.industry || 'other'} onChange={(e) => setProject({ ...project, industry: e.target.value })}
            className="w-full px-4 py-3 border border-[#D9D6D0] rounded-lg bg-white">
            {INDUSTRIES.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
          </select>
          <p className="text-xs text-[#666666] mt-1">Used for industry context in the assessment</p>
        </div>

        <div className="pt-4 border-t border-[#D9D6D0]">
          <label className="block text-sm font-medium text-[#1A1A1A] mb-2">Claude API Key *</label>
          <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)}
            placeholder="sk-ant-..." className="w-full px-4 py-3 border border-[#D9D6D0] rounded-lg bg-white font-mono text-sm" />
          <p className="text-xs text-[#666666] mt-2">Get your API key from <a href="https://console.anthropic.com" target="_blank" rel="noopener noreferrer" className="text-[#E53935] hover:underline">console.anthropic.com</a></p>
        </div>
      </div>

      <div className="flex justify-end mt-10">
        <button onClick={onNext} disabled={!canProceed} className="btn-primary flex items-center gap-2">
          Continue <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// Website Assessment with Image Upload
// Website Assessment with Multiple Image Upload (up to 4)
function WebsiteAssessment({ assessmentData, setAssessmentData, apiKey, project, onPrev, onNext, onClearScores }) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [isCompressing, setIsCompressing] = useState(false);
  const [error, setError] = useState(null);
  const [images, setImages] = useState(assessmentData.images || []);
  const [pagesReviewed, setPagesReviewed] = useState(assessmentData.pagesReviewed || '');
  const [websiteContent, setWebsiteContent] = useState(assessmentData.websiteContent || '');
  const fileInputRef = useRef(null);
  
  // SEO Visibility State (simplified)
  const [seoAssessment, setSeoAssessment] = useState(assessmentData.seoAssessment || '');
  const [isAssessingSeo, setIsAssessingSeo] = useState(false);

  const runSeoAssessment = async () => {
    if (!apiKey) {
      setError('API key required for SEO assessment');
      return;
    }
    setIsAssessingSeo(true);
    setError(null);
    try {
      const prompt = `You are an SEO expert assessing ${project.brandName}'s likely search visibility.

BRAND: ${project.brandName}
WEBSITE: ${project.websiteUrl}
INDUSTRY: ${INDUSTRIES.find(i => i.id === project.industry)?.name || 'Unknown'}

${websiteContent ? `WEBSITE CONTENT PROVIDED:\n${websiteContent}\n` : ''}
${pagesReviewed ? `PAGES REVIEWED: ${pagesReviewed}\n` : ''}

Provide a comprehensive SEO visibility assessment:

1. TARGET KEYWORDS (identify 5-6 keywords this brand should rank for):
   - List specific keywords based on their industry, services, and positioning
   - Include a mix of branded, service-based, and industry terms
   - Note the likely competitiveness of each keyword

2. BRAND SEARCHABILITY ASSESSMENT:
   - Is the brand name unique/distinctive or generic/common?
   - Are there likely naming conflicts with other companies?
   - Would someone searching the brand name easily find them?

3. CONTENT & TECHNICAL SEO SIGNALS:
   - Based on the website content, assess keyword optimization
   - Note content depth and topical authority signals
   - Identify any obvious SEO gaps or opportunities

4. COMPETITIVE LANDSCAPE:
   - How competitive is SEO in their industry?
   - What challenges might they face ranking for key terms?

5. SEO VISIBILITY RATING:
   Provide an estimated SEO visibility score (0-100) based on:
   - Brand name searchability (unique vs generic)
   - Content quality and depth signals
   - Industry competitiveness
   - Likely keyword ranking potential

Format: "SEO VISIBILITY SCORE: XX/100"

6. KEY RECOMMENDATIONS:
   - 2-3 specific, actionable SEO improvements

Keep the assessment concise but insightful. Focus on qualitative analysis since you cannot access live search rankings.`;

      const result = await callClaude(prompt, apiKey);
      setSeoAssessment(result);
      setAssessmentData({ ...assessmentData, seoAssessment: result });
    } catch (e) {
      setError(e.message);
    } finally {
      setIsAssessingSeo(false);
    }
  };

  const handleImageUpload = (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    
    const remainingSlots = 4 - images.length;
    const filesToProcess = files.slice(0, remainingSlots);
    
    if (filesToProcess.length === 0) {
      setError('Maximum 4 images allowed');
      return;
    }
    
    setIsCompressing(true);
    
    Promise.all(filesToProcess.map(file => {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const dataUrl = reader.result;
          const fileSizeMB = file.size / (1024 * 1024);
          
          if (fileSizeMB > 4) {
            compressImage(dataUrl, 4).then(resolve).catch(() => resolve(dataUrl));
          } else {
            resolve(dataUrl);
          }
        };
        reader.readAsDataURL(file);
      });
    })).then(newImages => {
      const updatedImages = [...images, ...newImages].slice(0, 4);
      setImages(updatedImages);
      setAssessmentData({ ...assessmentData, images: updatedImages });
      setIsCompressing(false);
    });
  };

  const removeImage = (index) => {
    const updatedImages = images.filter((_, i) => i !== index);
    setImages(updatedImages);
    setAssessmentData({ ...assessmentData, images: updatedImages });
  };

  const runAnalysis = async () => {
    setIsProcessing(true);
    setError(null);
    try {
      const prompt = `You are conducting a comprehensive website assessment for ${project.brandName}.

WEBSITE URL: ${project.websiteUrl}

PAGES REVIEWED BY ASSESSOR:
${pagesReviewed || 'Homepage and key pages (see screenshots)'}

WEBSITE CONTENT PROVIDED BY ASSESSOR:
${websiteContent || '[No additional content pasted - analyze based on screenshots]'}

SCREENSHOTS PROVIDED: ${images.length} image(s) showing key pages

${assessmentData.observations ? `ASSESSOR OBSERVATIONS:\n${assessmentData.observations}` : ''}

${seoAssessment ? `SEO VISIBILITY ASSESSMENT (previously generated):\n${seoAssessment}\n` : ''}

Based on the screenshots and content provided, deliver a comprehensive website assessment covering:

1. BRAND STRATEGY AND POSITIONING
   - How clear and differentiated is the brand positioning?
   - What is the core value proposition? Is it immediately apparent?
   - How well does the visual identity support and reinforce the brand?
   - Is there a consistent brand voice across pages?
   - CRITICAL: Compare brand presentation across screenshots - is the brand identity cohesive?

2. MESSAGING AND STORYTELLING
   - Analyze the headline/hero messaging effectiveness
   - Is there a compelling narrative arc across the site?
   - Does the content create emotional resonance?
   - How well does the messaging speak to the target audience?

3. CONTENT QUALITY AND CONSISTENCY
   - Evaluate the quality and depth of written content
   - Is content benefit-focused or feature-focused?
   - Is there consistency in tone, style, and messaging across pages?
   - Are there content gaps or areas that need strengthening?

4. INFORMATION ARCHITECTURE
   - How logical and intuitive is the site structure?
   - Is content organized in a way that matches user mental models?
   - Are related pages properly linked and grouped?
   - How easy is it to find key information (pricing, contact, services)?
   - Is there clear hierarchy from primary to secondary to tertiary content?

5. USER INTERFACE (UI) DESIGN & VISUAL CONSISTENCY
   - How professional, modern, and polished is the interface?
   - CRITICAL: Evaluate design consistency across all screenshots - are colors, fonts, spacing, and visual treatments consistent page-to-page?
   - Are interactive elements (buttons, forms, links) styled consistently throughout?
   - Is there appropriate use of whitespace and visual breathing room?
   - How effective is the typography hierarchy (headings, body, captions)?
   - Are images and media high quality and purposeful?
   - Is the design responsive and mobile-friendly (if visible)?
   - Note any inconsistencies in: color palette, button styles, heading treatments, spacing patterns, or visual language

6. USER EXPERIENCE (UX) AND NAVIGATION
   - How intuitive is the navigation structure?
   - Is the visual hierarchy clear and effective?
   - Are calls-to-action prominent, compelling, and well-placed?
   - How well does the site guide users toward conversion?
   - Are there any friction points or confusing elements?

7. ACCESSIBILITY (WCAG 2.1 Level AA Compliance)
   - Estimate the percentage of WCAG 2.1 Level AA compliance based on visible elements (0-100%)
   - Is there sufficient color contrast between text and backgrounds (4.5:1 for normal text, 3:1 for large text)?
   - Are fonts legible and appropriately sized (minimum 16px for body text)?
   - Do images appear to have alt text considerations?
   - Are interactive elements large enough for easy clicking/tapping (minimum 44x44px touch targets)?
   - Is the content structure logical for screen readers (proper heading hierarchy H1→H2→H3)?
   - Are form labels properly associated with inputs?
   - Are there any obvious accessibility barriers (text over busy images, low contrast buttons, missing skip links)?
   - Would keyboard-only navigation likely work (focus states, tab order)?
   - Provide a specific accessibility compliance percentage estimate and explain your reasoning

8. SEO & SEARCH VISIBILITY
   - Based on visible content structure, how well-optimized is this site for search?
   - Are key brand messages and value propositions likely to rank for relevant keywords?
   - Is content structured for discoverability (headings, meta-likely content)?
   - How well could AI systems understand and represent this brand?
${seoAssessment ? `   - INTEGRATE the SEO Visibility Assessment findings above into your analysis
   - Reference the target keywords identified and assess if the website content supports ranking for them
   - Consider the brand searchability assessment in your evaluation` : '   - Note: No SEO visibility assessment was run - provide general observations only'}

Write in flowing prose with specific observations. Be concrete about what you see in the screenshots. Compare elements across different pages to identify consistency or inconsistency.

End with:
- DESIGN CONSISTENCY RATING (1-10): Rate overall visual consistency across pages with brief explanation
${seoAssessment ? '- SEO READINESS RATING (1-10): Based on the SEO assessment, rate how well the site is positioned for search visibility' : ''}
- 3-5 KEY STRENGTHS (what the website does well)
- 3-5 PRIORITY IMPROVEMENTS (specific, actionable recommendations)`;

      const result = await callClaude(prompt, apiKey, images[0], images.slice(1));
      setAssessmentData({ 
        ...assessmentData, 
        status: 'complete', 
        content: result, 
        images, 
        pagesReviewed, 
        websiteContent,
        seoAssessment // Preserve SEO assessment
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const isComplete = assessmentData.status === 'complete';

  return (
    <div className="max-w-4xl mx-auto p-8 animate-fade-in">
      <div className="flex items-start gap-4 mb-8">
        <div className="w-14 h-14 bg-[#E53935]/10 rounded-xl flex items-center justify-center">
          <Globe className="w-7 h-7 text-[#E53935]" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-[#1A1A1A]">Website Assessment</h2>
          <p className="text-[#333333]">Analyzing {project.brandName}'s website: {project.websiteUrl}</p>
        </div>
      </div>

      {/* Pages Reviewed */}
      <div className="card p-6 mb-6">
        <h3 className="font-semibold text-[#1A1A1A] mb-3">Pages Reviewed</h3>
        <p className="text-sm text-[#666666] mb-3">List the pages you reviewed (e.g., Homepage, About, Services, Contact, Blog)</p>
        <input 
          type="text" 
          value={pagesReviewed} 
          onChange={(e) => { setPagesReviewed(e.target.value); setAssessmentData({ ...assessmentData, pagesReviewed: e.target.value }); }}
          placeholder="e.g., Homepage, About Us, Services, Case Studies, Contact"
          className="w-full px-4 py-3 border border-[#D9D6D0] rounded-lg bg-white"
        />
      </div>

      {/* Screenshots */}
      <div className="card p-6 mb-6">
        <h3 className="font-semibold text-[#1A1A1A] mb-3 flex items-center gap-2">
          <Image className="w-5 h-5" /> Website Screenshots (up to 4)
        </h3>
        <p className="text-sm text-[#666666] mb-4">Upload screenshots of homepage and key subpages for visual analysis.</p>
        
        <input type="file" ref={fileInputRef} onChange={handleImageUpload} accept="image/*" multiple className="hidden" />
        
        <div className="grid grid-cols-2 gap-4 mb-4">
          {images.map((img, index) => (
            <div key={index} className="relative">
              <img src={img} alt={`Screenshot ${index + 1}`} className="w-full h-40 object-cover rounded-lg border border-[#D9D6D0]" />
              <button onClick={() => removeImage(index)}
                className="absolute top-2 right-2 bg-white rounded-full p-1 shadow-lg hover:bg-gray-100">
                <X className="w-4 h-4" />
              </button>
              <div className="absolute bottom-2 left-2 bg-[#1A1A1A] text-white text-xs px-2 py-1 rounded">
                {index + 1}
              </div>
            </div>
          ))}
          
          {images.length < 4 && (
            <button onClick={() => fileInputRef.current?.click()}
              className="h-40 border-2 border-dashed border-[#E53935] rounded-lg flex flex-col items-center justify-center gap-2 hover:bg-[#E53935]/5 transition-colors">
              {isCompressing ? (
                <><Loader2 className="w-6 h-6 text-[#E53935] animate-spin" /><span className="text-sm text-[#E53935]">Compressing...</span></>
              ) : (
                <><Upload className="w-6 h-6 text-[#E53935]" /><span className="text-sm text-[#E53935] font-medium">Add Screenshot</span><span className="text-xs text-[#666666]">{4 - images.length} remaining</span></>
              )}
            </button>
          )}
        </div>
        
        {images.length > 0 && (
          <div className="text-sm text-green-600">
            {images.length} screenshot(s) ready for analysis
          </div>
        )}
      </div>

      {/* Website Content */}
      <div className="card p-6 mb-6">
        <h3 className="font-semibold text-[#1A1A1A] mb-3">Website Content (Optional)</h3>
        <p className="text-sm text-[#666666] mb-3">Paste key content from the website: headlines, taglines, about text, value propositions, etc.</p>
        <textarea 
          value={websiteContent} 
          onChange={(e) => { setWebsiteContent(e.target.value); setAssessmentData({ ...assessmentData, websiteContent: e.target.value }); }}
          placeholder="Paste key website copy here...

Example:
HOMEPAGE HEADLINE: 'Transform Your Business with AI'
TAGLINE: 'Enterprise solutions for the modern era'
ABOUT: 'Founded in 2015, we help companies...'
VALUE PROP: 'Reduce costs by 40% while improving...'
..."
          className="w-full h-40 px-4 py-3 border border-[#D9D6D0] rounded-lg bg-white resize-none text-sm"
        />
      </div>

      {/* SEO Visibility Assessment */}
      <div className="card p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold text-[#1A1A1A]">SEO Visibility Assessment</h3>
            <p className="text-sm text-[#666666]">AI-powered analysis of search visibility potential (influences COGENT score)</p>
          </div>
        </div>

        {!seoAssessment ? (
          <div>
            <p className="text-sm text-[#666666] mb-4">
              Claude will analyze {project.brandName}'s likely SEO visibility based on brand name uniqueness, 
              industry competitiveness, content signals, and identify target keywords they should rank for.
            </p>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
              <p className="text-sm text-yellow-800">
                <strong>💡 Tip:</strong> Run this before the main Website Analysis for best results. 
                SEO insights will be automatically integrated into the full assessment.
              </p>
            </div>
            <button 
              onClick={runSeoAssessment} 
              disabled={isAssessingSeo || !apiKey}
              className="btn-secondary flex items-center gap-2"
            >
              {isAssessingSeo ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Analyzing SEO Visibility...</>
              ) : (
                <><Play className="w-4 h-4" /> Auto-Assess SEO Visibility</>
              )}
            </button>
          </div>
        ) : (
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-[#1A1A1A] flex items-center gap-2">
                <Check className="w-4 h-4 text-green-600" /> SEO Assessment Complete
                <span className="text-xs text-[#666666] font-normal">(will be included in Website Analysis)</span>
              </span>
              <button 
                onClick={runSeoAssessment} 
                disabled={isAssessingSeo}
                className="text-sm text-[#E53935] hover:underline flex items-center gap-1"
              >
                {isAssessingSeo ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                Regenerate
              </button>
            </div>
            <div className="bg-[#F0EEEA] rounded-lg p-4 max-h-64 overflow-y-auto">
              <pre className="text-sm text-[#333333] whitespace-pre-wrap font-sans">{seoAssessment}</pre>
            </div>
          </div>
        )}
      </div>

      {/* Assessor Observations */}
      <div className="card p-6 mb-6">
        <h3 className="font-semibold text-[#1A1A1A] mb-3">Assessor Observations</h3>
        <p className="text-sm text-[#666666] mb-3">Your observations on brand alignment, storytelling, consistency issues, or other concerns.</p>
        <textarea value={assessmentData.observations || ''} onChange={(e) => setAssessmentData({ ...assessmentData, observations: e.target.value })}
          placeholder="Add your observations about:
- Brand alignment issues
- Storytelling strengths/weaknesses  
- Consistency across pages
- Navigation or UX concerns
- Content gaps
- Competitive positioning..." className="w-full h-32 px-4 py-3 border border-[#D9D6D0] rounded-lg bg-white resize-none" />
      </div>

      {!isComplete && (
        <button onClick={runAnalysis} disabled={isProcessing || images.length === 0 || isCompressing} className="btn-primary flex items-center gap-2 mb-6">
          {isProcessing ? <><Loader2 className="w-4 h-4 animate-spin" /> Analyzing Website...</> : 
           isCompressing ? <><Loader2 className="w-4 h-4 animate-spin" /> Compressing Images...</> :
           <><Play className="w-4 h-4" /> {images.length > 0 ? 'Run Website Analysis' : 'Upload Screenshots First'}</>}
        </button>
      )}

      {error && <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 text-red-700">{error}</div>}

      {isComplete && (
        <div className="card p-6 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-[#1A1A1A] flex items-center gap-2">
              <Check className="w-5 h-5 text-[#E53935]" /> Analysis Complete
            </h3>
            <button 
              onClick={() => {
                runAnalysis();
                if (onClearScores) onClearScores();
              }} 
              disabled={isProcessing || images.length === 0} 
              className="btn-secondary text-sm py-2 px-4 flex items-center gap-2"
            >
              {isProcessing ? <><Loader2 className="w-4 h-4 animate-spin" /> Regenerating...</> : <><Play className="w-4 h-4" /> Regenerate Analysis</>}
            </button>
          </div>
          <div className="bg-[#F0EEEA] rounded-lg p-4 max-h-96 overflow-y-auto">
            <pre className="text-sm text-[#333333] whitespace-pre-wrap font-sans">{assessmentData.content}</pre>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between pt-6 border-t border-[#D9D6D0]">
        <button onClick={onPrev} className="btn-secondary flex items-center gap-2"><ArrowLeft className="w-4 h-4" /> Back</button>
        <button onClick={onNext} disabled={!isComplete} className="btn-primary flex items-center gap-2">Continue <ArrowRight className="w-4 h-4" /></button>
      </div>
    </div>
  );
}

// Social Media Assessment with all platforms and image uploads
function SocialMediaAssessment({ assessmentData, setAssessmentData, apiKey, project, onPrev, onNext, onClearScores }) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [isCompressing, setIsCompressing] = useState(false);
  const [isAutoChecking, setIsAutoChecking] = useState(false);
  const [error, setError] = useState(null);
  const [inputs, setInputs] = useState({
    linkedinUrl: assessmentData.linkedinUrl || '',
    linkedinAbout: assessmentData.linkedinAbout || '',
    linkedinPosts: assessmentData.linkedinPosts || '',
    linkedinArticles: assessmentData.linkedinArticles || '',
    xUrl: assessmentData.xUrl || '',
    xContent: assessmentData.xContent || '',
    instagramContent: assessmentData.instagramContent || '',
    youtubeContent: assessmentData.youtubeContent || '',
    hasYouTube: assessmentData.hasYouTube ?? true,
    redditContent: assessmentData.redditContent || '',
    wikipediaContent: assessmentData.wikipediaContent || '',
    glassdoorContent: assessmentData.glassdoorContent || '',
    nextdoorContent: assessmentData.nextdoorContent || '',
    wipoContent: assessmentData.wipoContent || '',
  });
  const [images, setImages] = useState(assessmentData.socialImages || []);
  const [instagramImages, setInstagramImages] = useState(assessmentData.instagramImages || []);
  const fileInputRef = useRef(null);
  const instagramFileInputRef = useRef(null);

  const updateInput = (key, value) => {
    setInputs(prev => ({ ...prev, [key]: value }));
    setAssessmentData({ ...assessmentData, [key]: value });
  };

  // Auto-check YouTube, Wikipedia, Reddit, Glassdoor, Nextdoor, and WIPO
  const runAutoCheck = async () => {
    setIsAutoChecking(true);
    setError(null);
    try {
      const prompt = `You are researching ${project.brandName}'s presence across multiple platforms.

Website: ${project.websiteUrl}
Industry: ${INDUSTRIES.find(i => i.id === project.industry)?.name || 'Unknown'}

Based on your knowledge, provide a brief assessment for each platform. IMPORTANT: Do NOT guess or estimate specific numbers like subscriber counts, follower counts, or engagement metrics - these change constantly and any estimates would be inaccurate. Focus on qualitative observations only.

1. YOUTUBE PRESENCE:
- Does ${project.brandName} appear to have an official YouTube channel? (Yes/No/Unknown)
- If yes, what is the channel name or URL if known?
- What type of content do they publish (tutorials, thought leadership, product demos, etc.)?
- General observations about content quality and posting consistency
- DO NOT estimate subscriber counts or view counts - these must be manually verified
- If no YouTube presence, note "No known YouTube channel"

2. WIKIPEDIA PRESENCE:
- Does ${project.brandName} have a Wikipedia page?
- If yes, summarize the key information: founding, headquarters, key products/services, notable achievements
- Note the page quality (stub, well-developed, etc.)
- If no Wikipedia page, note "No Wikipedia page found"

3. REDDIT PRESENCE:
- Is ${project.brandName} discussed on Reddit?
- Are there any brand-owned subreddits?
- What is the general sentiment in discussions?
- Notable threads or mentions
- If minimal presence, note "Limited Reddit presence"

4. GLASSDOOR PRESENCE (impacts brand self-awareness/Reflective score):
- Does ${project.brandName} have a Glassdoor profile?
- General themes in reviews about company culture, leadership, work-life balance
- DO NOT guess specific ratings - these must be manually verified at glassdoor.com
- If no Glassdoor presence, note "No Glassdoor profile found"

5. NEXTDOOR PRESENCE (impacts audience connection/Aware score):
- Is ${project.brandName} active on Nextdoor or mentioned in neighborhood discussions?
- For B2B brands, this may not be applicable
- For B2C/local businesses, what is the community sentiment?
- If not applicable or no presence, note "Not applicable/No Nextdoor presence"

6. WIPO TRADEMARK STATUS (impacts brand professionalism/Intentional score):
- Does ${project.brandName} have registered trademarks via WIPO (World Intellectual Property Organization)?
- In which jurisdictions is the brand name protected?
- Are there any trademark conflicts or similar names that could cause confusion?
- If unknown, note "Trademark status requires manual verification at branddb.wipo.int"

Format your response clearly with headers for each platform. Be concise but informative. Remind the user to manually verify any specific statistics.`;

      const result = await callClaude(prompt, apiKey);
      
      // Parse the response and update the relevant fields
      const sections = result.split(/(?=\d\.\s*(?:YOUTUBE|WIKIPEDIA|REDDIT|GLASSDOOR|NEXTDOOR|WIPO))/i);
      
      let youtubeInfo = '';
      let wikiInfo = '';
      let redditInfo = '';
      let glassdoorInfo = '';
      let nextdoorInfo = '';
      let wipoInfo = '';
      
      sections.forEach(section => {
        if (section.toLowerCase().includes('youtube')) {
          youtubeInfo = section.replace(/^\d\.\s*YOUTUBE[^:]*:/i, '').trim();
        } else if (section.toLowerCase().includes('wikipedia')) {
          wikiInfo = section.replace(/^\d\.\s*WIKIPEDIA[^:]*:/i, '').trim();
        } else if (section.toLowerCase().includes('reddit')) {
          redditInfo = section.replace(/^\d\.\s*REDDIT[^:]*:/i, '').trim();
        } else if (section.toLowerCase().includes('glassdoor')) {
          glassdoorInfo = section.replace(/^\d\.\s*GLASSDOOR[^:]*:/i, '').trim();
        } else if (section.toLowerCase().includes('nextdoor')) {
          nextdoorInfo = section.replace(/^\d\.\s*NEXTDOOR[^:]*:/i, '').trim();
        } else if (section.toLowerCase().includes('wipo')) {
          wipoInfo = section.replace(/^\d\.\s*WIPO[^:]*:/i, '').trim();
        }
      });

      // Update the fields with auto-check results
      if (youtubeInfo && !inputs.youtubeContent) {
        updateInput('youtubeContent', `[Auto-checked] ${youtubeInfo}`);
      }
      if (wikiInfo && !inputs.wikipediaContent) {
        updateInput('wikipediaContent', `[Auto-checked] ${wikiInfo}`);
      }
      if (redditInfo && !inputs.redditContent) {
        updateInput('redditContent', `[Auto-checked] ${redditInfo}`);
      }
      if (glassdoorInfo && !inputs.glassdoorContent) {
        updateInput('glassdoorContent', `[Auto-checked] ${glassdoorInfo}`);
      }
      if (nextdoorInfo && !inputs.nextdoorContent) {
        updateInput('nextdoorContent', `[Auto-checked] ${nextdoorInfo}`);
      }
      if (wipoInfo && !inputs.wipoContent) {
        updateInput('wipoContent', `[Auto-checked] ${wipoInfo}`);
      }

    } catch (err) {
      setError('Auto-check failed: ' + err.message);
    } finally {
      setIsAutoChecking(false);
    }
  };

  // Instagram image upload handler
  const handleInstagramImageUpload = (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    
    const remainingSlots = 4 - instagramImages.length;
    const filesToProcess = files.slice(0, remainingSlots);
    
    if (filesToProcess.length === 0) {
      setError('Maximum 4 Instagram images allowed');
      return;
    }
    
    setIsCompressing(true);
    
    Promise.all(filesToProcess.map(file => {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const dataUrl = reader.result;
          const fileSizeMB = file.size / (1024 * 1024);
          if (fileSizeMB > 4) {
            compressImage(dataUrl, 4).then(resolve).catch(() => resolve(dataUrl));
          } else {
            resolve(dataUrl);
          }
        };
        reader.readAsDataURL(file);
      });
    })).then(newImages => {
      const updatedImages = [...instagramImages, ...newImages];
      setInstagramImages(updatedImages);
      setAssessmentData({ ...assessmentData, instagramImages: updatedImages });
      setIsCompressing(false);
    });
  };

  const removeInstagramImage = (index) => {
    const updatedImages = instagramImages.filter((_, i) => i !== index);
    setInstagramImages(updatedImages);
    setAssessmentData({ ...assessmentData, instagramImages: updatedImages });
  };

  const handleImageUpload = (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    
    const remainingSlots = 4 - images.length;
    const filesToProcess = files.slice(0, remainingSlots);
    
    if (filesToProcess.length === 0) {
      setError('Maximum 4 images allowed');
      return;
    }
    
    setIsCompressing(true);
    
    Promise.all(filesToProcess.map(file => {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const dataUrl = reader.result;
          const fileSizeMB = file.size / (1024 * 1024);
          if (fileSizeMB > 4) {
            compressImage(dataUrl, 4).then(resolve).catch(() => resolve(dataUrl));
          } else {
            resolve(dataUrl);
          }
        };
        reader.readAsDataURL(file);
      });
    })).then(newImages => {
      const updatedImages = [...images, ...newImages].slice(0, 4);
      setImages(updatedImages);
      setAssessmentData({ ...assessmentData, socialImages: updatedImages });
      setIsCompressing(false);
    });
  };

  const removeImage = (index) => {
    const updatedImages = images.filter((_, i) => i !== index);
    setImages(updatedImages);
    setAssessmentData({ ...assessmentData, socialImages: updatedImages });
  };

  const runAnalysis = async () => {
    setIsProcessing(true);
    setError(null);
    try {
      const prompt = `Analyze ${project.brandName}'s social media and reputation presence based on the content provided below.

=== LINKEDIN DATA ===
About Section:
${inputs.linkedinAbout || '[Not provided]'}

Recent Posts (with engagement metrics):
${inputs.linkedinPosts || '[Not provided]'}

Articles:
${inputs.linkedinArticles || '[Not provided]'}

=== X (TWITTER) DATA ===
${inputs.xContent || '[Not provided]'}

=== INSTAGRAM DATA ===
${inputs.instagramContent || '[Not provided]'}
${instagramImages.length > 0 ? `\n${instagramImages.length} Instagram screenshot(s) provided for visual reference.` : ''}

=== YOUTUBE DATA ===
${inputs.hasYouTube ? (inputs.youtubeContent || '[User indicated they have YouTube but no content provided]') : '[Brand does not have a YouTube channel]'}

=== REDDIT PRESENCE ===
${inputs.redditContent || '[Not provided - please note any Reddit mentions or discussions about ' + project.brandName + ']'}

=== WIKIPEDIA PRESENCE ===
${inputs.wikipediaContent || '[Not provided - please note if ' + project.brandName + ' has a Wikipedia page]'}

=== GLASSDOOR (Employer Reputation) ===
${inputs.glassdoorContent || '[Not reviewed - Glassdoor reviews impact brand self-awareness and Reflective score]'}

=== NEXTDOOR (Community Reputation) ===
${inputs.nextdoorContent || '[Not reviewed - Nextdoor presence impacts audience connection and Aware score]'}

=== WIPO TRADEMARK STATUS ===
${inputs.wipoContent || '[Not checked - Trademark registration impacts brand professionalism and Intentional score]'}

${images.length > 0 ? `\n${images.length} screenshot(s) of social media pages have been provided for visual reference.` : ''}

${assessmentData.observations ? `\nASSESSOR OBSERVATIONS TO CONSIDER:\n${assessmentData.observations}` : ''}

Based on the content provided above, deliver a comprehensive social media and reputation assessment:

1. LinkedIn Presence: Analyze the About section messaging, post content quality, engagement rates (benchmark: 2-4% is good), thought leadership positioning, and content mix

2. X/Twitter Presence: Evaluate voice/tone, content strategy, engagement levels, and brand consistency

3. Instagram Presence: Assess visual brand consistency, content themes, engagement, and audience connection

4. YouTube Presence: ${inputs.hasYouTube ? 'Assess channel content strategy, video topics, and recommendations for improvement' : 'The brand does not have YouTube - provide recommendation on whether they should based on their industry and audience'}

5. Reddit Presence: What subreddits mention this brand? What is the sentiment? How does user-generated content affect their reputation?

6. Wikipedia Presence: Does the brand have a Wikipedia page? How does this impact their credibility and AI search visibility?

7. Glassdoor & Employer Reputation: Analyze employee reviews, ratings, and sentiment. How self-aware is the brand about its culture and reputation?

8. Community Presence (Nextdoor): For B2C brands, how does the local community perceive them? What do recommendations and discussions reveal?

9. Trademark Protection (WIPO): Is the brand name properly protected? Are there any conflicts or risks?

10. Cross-Platform Consistency: Is the brand voice and messaging consistent across platforms?

11. AI/Search Visibility: How does their social presence impact discoverability in AI search engines?

Write in flowing prose with specific observations from the content provided. End with key strengths and priority improvements.`;

      const allImages = [...images, ...instagramImages];
      const result = await callClaude(prompt, apiKey, allImages[0], allImages.slice(1));
      setAssessmentData({ ...assessmentData, status: 'complete', content: result, ...inputs, socialImages: images, instagramImages });
    } catch (err) {
      setError(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const isComplete = assessmentData.status === 'complete';
  const hasMinimumContent = inputs.linkedinAbout || inputs.linkedinPosts || inputs.xContent || inputs.youtubeContent || inputs.instagramContent;

  return (
    <div className="max-w-4xl mx-auto p-8 animate-fade-in">
      <div className="flex items-start gap-4 mb-8">
        <div className="w-14 h-14 bg-[#8B5CF6]/10 rounded-xl flex items-center justify-center">
          <Users className="w-7 h-7 text-[#8B5CF6]" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-[#1A1A1A]">Social Media Assessment</h2>
          <p className="text-[#333333]">Evaluating {project.brandName}'s social presence</p>
        </div>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
        <p className="text-sm text-amber-800">
          <strong>Note:</strong> Copy and paste content directly from each platform. Claude cannot visit URLs directly.
        </p>
      </div>

      {/* Screenshot Upload */}
      <div className="card p-6 mb-6">
        <h3 className="font-semibold text-[#1A1A1A] mb-3">Social Media Screenshots (up to 4)</h3>
        <p className="text-sm text-[#666666] mb-4">Upload screenshots from social profiles for visual analysis.</p>
        
        <input type="file" ref={fileInputRef} onChange={handleImageUpload} accept="image/*" multiple className="hidden" />
        
        <div className="grid grid-cols-4 gap-3 mb-4">
          {images.map((img, index) => (
            <div key={index} className="relative">
              <img src={img} alt={`Screenshot ${index + 1}`} className="w-full h-24 object-cover rounded-lg border border-[#D9D6D0]" />
              <button onClick={() => removeImage(index)} className="absolute top-1 right-1 bg-white rounded-full p-0.5 shadow hover:bg-gray-100">
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
          {images.length < 4 && (
            <button onClick={() => fileInputRef.current?.click()}
              className="h-24 border-2 border-dashed border-[#8B5CF6] rounded-lg flex flex-col items-center justify-center gap-1 hover:bg-[#8B5CF6]/5 transition-colors">
              {isCompressing ? <Loader2 className="w-5 h-5 text-[#8B5CF6] animate-spin" /> : <><Upload className="w-5 h-5 text-[#8B5CF6]" /><span className="text-xs text-[#8B5CF6]">Add</span></>}
            </button>
          )}
        </div>
      </div>

      {/* LinkedIn Inputs */}
      <div className="card p-6 mb-6">
        <h3 className="font-semibold text-[#1A1A1A] mb-4 flex items-center gap-2">
          <ExternalLink className="w-5 h-5" /> LinkedIn Content
        </h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#1A1A1A] mb-2">LinkedIn Company URL</label>
            <div className="flex gap-2">
              <input type="url" value={inputs.linkedinUrl} onChange={(e) => updateInput('linkedinUrl', e.target.value)}
                placeholder="https://linkedin.com/company/..." className="flex-1 px-4 py-2 border border-[#D9D6D0] rounded-lg bg-white text-sm" />
              {inputs.linkedinUrl && (
                <a href={inputs.linkedinUrl} target="_blank" rel="noopener noreferrer" 
                   className="px-3 py-2 bg-[#0A66C2] text-white rounded-lg text-sm hover:bg-[#004182] transition-colors flex items-center gap-1">
                  <ExternalLink className="w-4 h-4" /> Open
                </a>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-[#1A1A1A] mb-2">About Section</label>
            <textarea value={inputs.linkedinAbout} onChange={(e) => updateInput('linkedinAbout', e.target.value)}
              placeholder="Go to their LinkedIn 'About' tab and paste the company description here..." className="w-full h-24 px-4 py-3 border border-[#D9D6D0] rounded-lg bg-white resize-none text-sm" />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-[#1A1A1A] mb-2">Recent Posts (include engagement metrics)</label>
            <textarea value={inputs.linkedinPosts} onChange={(e) => updateInput('linkedinPosts', e.target.value)}
              placeholder="Copy 5-10 recent posts. Include the post text and engagement (e.g., '245 likes, 32 comments, 15 reposts')..." className="w-full h-32 px-4 py-3 border border-[#D9D6D0] rounded-lg bg-white resize-none text-sm" />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-[#1A1A1A] mb-2">Articles (if any)</label>
            <textarea value={inputs.linkedinArticles} onChange={(e) => updateInput('linkedinArticles', e.target.value)}
              placeholder="List any LinkedIn articles: titles, brief summary, engagement..." className="w-full h-20 px-4 py-3 border border-[#D9D6D0] rounded-lg bg-white resize-none text-sm" />
          </div>
        </div>
      </div>

      {/* X (Twitter) Input */}
      <div className="card p-6 mb-6">
        <h3 className="font-semibold text-[#1A1A1A] mb-4 flex items-center gap-2">
          <ExternalLink className="w-5 h-5" /> X (Twitter) Content
        </h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#1A1A1A] mb-2">X Profile URL</label>
            <div className="flex gap-2">
              <input type="url" value={inputs.xUrl} onChange={(e) => updateInput('xUrl', e.target.value)}
                placeholder="https://x.com/..." className="flex-1 px-4 py-2 border border-[#D9D6D0] rounded-lg bg-white text-sm" />
              {inputs.xUrl && (
                <a href={inputs.xUrl} target="_blank" rel="noopener noreferrer" 
                   className="px-3 py-2 bg-[#1A1A1A] text-white rounded-lg text-sm hover:bg-[#333333] transition-colors flex items-center gap-1">
                  <ExternalLink className="w-4 h-4" /> Open
                </a>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-[#1A1A1A] mb-2">Profile & Recent Tweets</label>
            <textarea value={inputs.xContent} onChange={(e) => updateInput('xContent', e.target.value)}
              placeholder="Paste their X bio, follower count, and 5-10 recent tweets with engagement metrics..." className="w-full h-28 px-4 py-3 border border-[#D9D6D0] rounded-lg bg-white resize-none text-sm" />
          </div>
        </div>
      </div>

      {/* Instagram Input with Image Upload */}
      <div className="card p-6 mb-6">
        <h3 className="font-semibold text-[#1A1A1A] mb-4 flex items-center gap-2">
          <Image className="w-5 h-5" /> Instagram Content
        </h3>
        <textarea value={inputs.instagramContent} onChange={(e) => updateInput('instagramContent', e.target.value)}
          placeholder="Paste their Instagram bio, follower count, describe recent posts (types of content, engagement levels, visual themes)..." className="w-full h-24 px-4 py-3 border border-[#D9D6D0] rounded-lg bg-white resize-none text-sm mb-4" />
        
        <p className="text-sm text-[#666666] mb-3">Upload Instagram screenshots for visual analysis (up to 4 images)</p>
        <input type="file" ref={instagramFileInputRef} onChange={handleInstagramImageUpload} accept="image/*" multiple className="hidden" />
        
        {instagramImages.length > 0 && (
          <div className="grid grid-cols-4 gap-3 mb-4">
            {instagramImages.map((img, idx) => (
              <div key={idx} className="relative aspect-square rounded-lg overflow-hidden border border-[#D9D6D0]">
                <img src={img} alt={`Instagram ${idx + 1}`} className="w-full h-full object-cover" />
                <button onClick={() => removeInstagramImage(idx)} className="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
        
        {instagramImages.length < 4 && (
          <button onClick={() => instagramFileInputRef.current?.click()} 
            className="w-full h-20 border-2 border-dashed border-[#E53935] rounded-lg flex items-center justify-center gap-2 hover:bg-[#E53935]/5 transition-colors">
            <Upload className="w-5 h-5 text-[#E53935]" />
            <span className="text-sm text-[#E53935] font-medium">Add Instagram Screenshots ({4 - instagramImages.length} remaining)</span>
          </button>
        )}
      </div>

      {/* YouTube Input */}
      <div className="card p-6 mb-6">
        <h3 className="font-semibold text-[#1A1A1A] mb-4 flex items-center gap-2">
          <ExternalLink className="w-5 h-5" /> YouTube Content
        </h3>
        
        <div className="mb-4">
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={inputs.hasYouTube} onChange={(e) => updateInput('hasYouTube', e.target.checked)}
              className="w-5 h-5 rounded border-gray-300 text-[#E53935] focus:ring-[#E53935]" />
            <span className="text-sm text-[#1A1A1A]">This brand has a YouTube channel</span>
          </label>
        </div>

        {inputs.hasYouTube && (
          <textarea value={inputs.youtubeContent} onChange={(e) => updateInput('youtubeContent', e.target.value)}
            placeholder="Describe: subscriber count, number of videos, recent video titles and view counts, content themes, posting frequency..." className="w-full h-28 px-4 py-3 border border-[#D9D6D0] rounded-lg bg-white resize-none text-sm" />
        )}
      </div>

      {/* Reddit and Wikipedia */}
      <div className="card p-6 mb-6">
        <h3 className="font-semibold text-[#1A1A1A] mb-4 flex items-center gap-2">
          <ExternalLink className="w-5 h-5" /> Reddit and Wikipedia Presence
        </h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#1A1A1A] mb-2">Reddit Mentions</label>
            <textarea value={inputs.redditContent} onChange={(e) => updateInput('redditContent', e.target.value)}
              placeholder="Search Reddit for the brand name. Note any subreddits where they're discussed, sentiment of discussions, any notable threads..." className="w-full h-24 px-4 py-3 border border-[#D9D6D0] rounded-lg bg-white resize-none text-sm" />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-[#1A1A1A] mb-2">Wikipedia Page</label>
            <textarea value={inputs.wikipediaContent} onChange={(e) => updateInput('wikipediaContent', e.target.value)}
              placeholder="Does this brand have a Wikipedia page? If yes, paste key details or describe its completeness. If no, note that." className="w-full h-20 px-4 py-3 border border-[#D9D6D0] rounded-lg bg-white resize-none text-sm" />
          </div>
        </div>
      </div>

      {/* Glassdoor - impacts Reflective score */}
      <div className="card p-6 mb-6">
        <h3 className="font-semibold text-[#1A1A1A] mb-4 flex items-center gap-2">
          <ExternalLink className="w-5 h-5" /> Glassdoor Reviews
          <span className="text-xs px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full">Impacts Reflective Score</span>
        </h3>
        <p className="text-sm text-[#666666] mb-3">Visit <a href="https://glassdoor.com" target="_blank" rel="noopener noreferrer" className="text-[#E53935] hover:underline">glassdoor.com</a> and search for the company</p>
        <textarea value={inputs.glassdoorContent} onChange={(e) => updateInput('glassdoorContent', e.target.value)}
          placeholder="Glassdoor rating (out of 5), CEO approval, key themes from reviews (culture, leadership, work-life balance), number of reviews, pros/cons patterns..." className="w-full h-24 px-4 py-3 border border-[#D9D6D0] rounded-lg bg-white resize-none text-sm" />
      </div>

      {/* Nextdoor - impacts Aware score */}
      <div className="card p-6 mb-6">
        <h3 className="font-semibold text-[#1A1A1A] mb-4 flex items-center gap-2">
          <ExternalLink className="w-5 h-5" /> Nextdoor Presence
          <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full">Impacts Aware Score</span>
        </h3>
        <p className="text-sm text-[#666666] mb-3">Visit <a href="https://nextdoor.com" target="_blank" rel="noopener noreferrer" className="text-[#E53935] hover:underline">nextdoor.com</a> to check community presence (most relevant for B2C/local businesses)</p>
        <textarea value={inputs.nextdoorContent} onChange={(e) => updateInput('nextdoorContent', e.target.value)}
          placeholder="Is the brand active on Nextdoor? Community discussions, recommendations, local reputation, customer testimonials... (Note 'Not applicable' for pure B2B brands)" className="w-full h-20 px-4 py-3 border border-[#D9D6D0] rounded-lg bg-white resize-none text-sm" />
      </div>

      {/* WIPO Trademark - impacts Intentional score */}
      <div className="card p-6 mb-6">
        <h3 className="font-semibold text-[#1A1A1A] mb-4 flex items-center gap-2">
          <ExternalLink className="w-5 h-5" /> WIPO Trademark Search
          <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">Impacts Intentional Score</span>
        </h3>
        <p className="text-sm text-[#666666] mb-3">Visit <a href="https://branddb.wipo.int/en/similarname" target="_blank" rel="noopener noreferrer" className="text-[#E53935] hover:underline">branddb.wipo.int</a> to search for trademark registrations</p>
        <textarea value={inputs.wipoContent} onChange={(e) => updateInput('wipoContent', e.target.value)}
          placeholder="Search the brand name in WIPO's Brand Database. Note: registered trademarks, jurisdictions covered, any similar/conflicting marks, trademark status..." className="w-full h-20 px-4 py-3 border border-[#D9D6D0] rounded-lg bg-white resize-none text-sm" />
      </div>

      {/* Assessor Observations */}
      <div className="card p-6 mb-6">
        <h3 className="font-semibold text-[#1A1A1A] mb-3">Assessor Observations</h3>
        <p className="text-sm text-[#666666] mb-3">Your observations will be included in the analysis and final report.</p>
        <textarea value={assessmentData.observations || ''} onChange={(e) => setAssessmentData({ ...assessmentData, observations: e.target.value })}
          placeholder="Add your own observations about their social media presence..." className="w-full h-32 px-4 py-3 border border-[#D9D6D0] rounded-lg bg-white resize-none" />
      </div>

      {!isComplete && (
        <button onClick={runAnalysis} disabled={isProcessing || !hasMinimumContent} className="btn-primary flex items-center gap-2 mb-6">
          {isProcessing ? <><Loader2 className="w-4 h-4 animate-spin" /> Analyzing...</> : <><Play className="w-4 h-4" /> {hasMinimumContent ? 'Run Social Analysis' : 'Add Content First'}</>}
        </button>
      )}

      {error && <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 text-red-700">{error}</div>}

      {isComplete && (
        <div className="card p-6 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-[#1A1A1A] flex items-center gap-2">
              <Check className="w-5 h-5 text-[#8B5CF6]" /> Analysis Complete
            </h3>
            <button 
              onClick={() => {
                runAnalysis();
                if (onClearScores) onClearScores();
              }} 
              disabled={isProcessing || !hasMinimumContent} 
              className="btn-secondary text-sm py-2 px-4 flex items-center gap-2"
            >
              {isProcessing ? <><Loader2 className="w-4 h-4 animate-spin" /> Regenerating...</> : <><Play className="w-4 h-4" /> Regenerate Analysis</>}
            </button>
          </div>
          <div className="bg-[#F0EEEA] rounded-lg p-4 max-h-96 overflow-y-auto">
            <pre className="text-sm text-[#333333] whitespace-pre-wrap font-sans">{assessmentData.content}</pre>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between pt-6 border-t border-[#D9D6D0]">
        <button onClick={onPrev} className="btn-secondary flex items-center gap-2"><ArrowLeft className="w-4 h-4" /> Back</button>
        <button onClick={onNext} disabled={!isComplete} className="btn-primary flex items-center gap-2">Continue <ArrowRight className="w-4 h-4" /></button>
      </div>
    </div>
  );
}

// AI Reputation Page
function AIReputationPage({ assessmentData, setAssessmentData, apiKey, project, onPrev, onNext, onClearScores }) {
  const [responses, setResponses] = useState(assessmentData.responses || { claude: '', gemini: '', chatgpt: '' });
  const [manualInput, setManualInput] = useState({ gemini: assessmentData.geminiManual || '', chatgpt: assessmentData.chatgptManual || '' });
  const [isProcessing, setIsProcessing] = useState({});
  const [error, setError] = useState(null);

  const standardQuery = `Please describe ${project.brandName}, what they do, why they do it and how they do it, and provide an overview of their reputation and credibility. Do they have any red flags or are there any risks working with them?`;

  const queryClaude = async () => {
    setIsProcessing(p => ({ ...p, claude: true }));
    try {
      const result = await callClaude(standardQuery, apiKey);
      setResponses(r => ({ ...r, claude: result }));
    } catch (e) { setError(e.message); }
    finally { setIsProcessing(p => ({ ...p, claude: false })); }
  };

  const hasAllResponses = manualInput.claude && manualInput.gemini && manualInput.chatgpt;
  const isComplete = assessmentData.status === 'complete';

  const generateSynthesis = async () => {
    setIsProcessing(p => ({ ...p, synthesis: true }));
    try {
      const prompt = `Analyze these AI system responses about ${project.brandName}:

CLAUDE: ${manualInput.claude}
GEMINI: ${manualInput.gemini}
CHATGPT: ${manualInput.chatgpt}

${assessmentData.observations ? `ASSESSOR OBSERVATIONS TO CONSIDER:\n${assessmentData.observations}` : ''}

Provide a comprehensive AI reputation assessment:
1. Convergence - Where do all three agree? (likely accurate)
2. Divergence - Where do they differ? What's missing?
3. Sentiment - Overall tone across systems
4. Vulnerabilities - What can't any AI answer about this brand?
5. Recommendations - How to improve AI representation

Write in flowing prose.`;

      const result = await callClaude(prompt, apiKey);
      setAssessmentData({ 
        ...assessmentData, 
        status: 'complete', 
        content: result, 
        responses,
        claudeManual: manualInput.claude,
        geminiManual: manualInput.gemini,
        chatgptManual: manualInput.chatgpt
      });
    } catch (e) { setError(e.message); }
    finally { setIsProcessing(p => ({ ...p, synthesis: false })); }
  };

  return (
    <div className="max-w-4xl mx-auto p-8 animate-fade-in">
      <div className="flex items-start gap-4 mb-8">
        <div className="w-14 h-14 bg-[#3B82F6]/10 rounded-xl flex items-center justify-center">
          <Bot className="w-7 h-7 text-[#3B82F6]" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-[#1A1A1A]">AI Reputation Assessment</h2>
          <p className="text-[#333333]">How does {project.brandName} appear across AI systems?</p>
        </div>
      </div>

      <div className="bg-[#F0EEEA] rounded-lg p-4 mb-6">
        <p className="text-sm text-[#666666] mb-2">Query each AI system with:</p>
        <p className="text-[#1A1A1A] italic text-sm">"{standardQuery}"</p>
      </div>

      {error && <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 text-red-700 text-sm">{error}</div>}

      <div className="space-y-4 mb-6">
        {/* Claude */}
        <div className={`card p-4 ${manualInput.claude ? 'bg-[#F0EEEA]' : ''}`}>
          <div className="flex items-center gap-3 mb-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${manualInput.claude ? 'bg-[#E53935] text-white' : 'bg-[#F0EEEA]'}`}>
              {manualInput.claude ? <Check className="w-5 h-5" /> : <Bot className="w-5 h-5 text-gray-400" />}
            </div>
            <div>
              <h4 className="font-medium">Claude (Anthropic)</h4>
              <p className="text-sm text-[#666666]">Paste response from claude.ai</p>
            </div>
          </div>
          <textarea value={manualInput.claude || ''} onChange={(e) => setManualInput(m => ({ ...m, claude: e.target.value }))}
            placeholder="Paste Claude's response here..." className="w-full h-24 px-3 py-2 border border-[#D9D6D0] rounded-lg text-sm bg-white" />
        </div>

        {/* Gemini */}
        <div className={`card p-4 ${manualInput.gemini ? 'bg-[#F0EEEA]' : ''}`}>
          <div className="flex items-center gap-3 mb-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${manualInput.gemini ? 'bg-[#E53935] text-white' : 'bg-[#F0EEEA]'}`}>
              {manualInput.gemini ? <Check className="w-5 h-5" /> : <Bot className="w-5 h-5 text-gray-400" />}
            </div>
            <div>
              <h4 className="font-medium">Gemini (Google)</h4>
              <p className="text-sm text-[#666666]">Paste response from gemini.google.com</p>
            </div>
          </div>
          <textarea value={manualInput.gemini} onChange={(e) => setManualInput(m => ({ ...m, gemini: e.target.value }))}
            placeholder="Paste Gemini's response here..." className="w-full h-24 px-3 py-2 border border-[#D9D6D0] rounded-lg text-sm bg-white" />
        </div>

        {/* ChatGPT */}
        <div className={`card p-4 ${manualInput.chatgpt ? 'bg-[#F0EEEA]' : ''}`}>
          <div className="flex items-center gap-3 mb-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${manualInput.chatgpt ? 'bg-[#E53935] text-white' : 'bg-[#F0EEEA]'}`}>
              {manualInput.chatgpt ? <Check className="w-5 h-5" /> : <Bot className="w-5 h-5 text-gray-400" />}
            </div>
            <div>
              <h4 className="font-medium">ChatGPT (OpenAI)</h4>
              <p className="text-sm text-[#666666]">Paste response from chatgpt.com</p>
            </div>
          </div>
          <textarea value={manualInput.chatgpt} onChange={(e) => setManualInput(m => ({ ...m, chatgpt: e.target.value }))}
            placeholder="Paste ChatGPT's response here..." className="w-full h-24 px-3 py-2 border border-[#D9D6D0] rounded-lg text-sm bg-white" />
        </div>
      </div>

      {/* Assessor Observations - moved before synthesis */}
      <div className="card p-6 mb-6">
        <h3 className="font-semibold text-[#1A1A1A] mb-3">Assessor Observations</h3>
        <p className="text-sm text-[#666666] mb-3">Your observations will be included in the synthesis and final report.</p>
        <textarea value={assessmentData.observations || ''} onChange={(e) => setAssessmentData({ ...assessmentData, observations: e.target.value })}
          placeholder="Add your own observations about the AI responses, discrepancies noticed, concerns, etc..." className="w-full h-32 px-4 py-3 border border-[#D9D6D0] rounded-lg bg-white resize-none" />
      </div>

      {hasAllResponses && !isComplete && (
        <button onClick={generateSynthesis} disabled={isProcessing.synthesis} className="btn-primary flex items-center gap-2 w-full justify-center mb-6">
          {isProcessing.synthesis ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating...</> : <><Play className="w-4 h-4" /> Generate Synthesis</>}
        </button>
      )}

      {isComplete && (
        <div className="card p-6 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-[#1A1A1A] flex items-center gap-2">
              <Check className="w-5 h-5 text-[#3B82F6]" /> Synthesis Complete
            </h3>
            <button 
              onClick={() => {
                generateSynthesis();
                if (onClearScores) onClearScores();
              }} 
              disabled={isProcessing.synthesis} 
              className="btn-secondary text-sm py-2 px-4 flex items-center gap-2"
            >
              {isProcessing.synthesis ? <><Loader2 className="w-4 h-4 animate-spin" /> Regenerating...</> : <><Play className="w-4 h-4" /> Regenerate Synthesis</>}
            </button>
          </div>
          <div className="bg-[#F0EEEA] rounded-lg p-4 max-h-64 overflow-y-auto text-sm text-[#333333]">{assessmentData.content}</div>
        </div>
      )}

      <div className="flex items-center justify-between pt-6 border-t border-[#D9D6D0]">
        <button onClick={onPrev} className="btn-secondary flex items-center gap-2"><ArrowLeft className="w-4 h-4" /> Back</button>
        <button onClick={onNext} disabled={!isComplete} className="btn-primary flex items-center gap-2">Continue <ArrowRight className="w-4 h-4" /></button>
      </div>
    </div>
  );
}

// Earned Media Assessment with paste field
function EarnedMediaAssessment({ assessmentData, setAssessmentData, apiKey, project, onPrev, onNext, onClearScores }) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [coveragePaste, setCoveragePaste] = useState(assessmentData.coveragePaste || '');

  const runAnalysis = async () => {
    setIsProcessing(true);
    setError(null);
    try {
      const prompt = `Analyze earned media coverage for ${project.brandName}.

USER-PROVIDED COVERAGE (last 3 months):
${coveragePaste || 'No coverage provided by user'}

${assessmentData.observations ? `ASSESSOR OBSERVATIONS TO CONSIDER:\n${assessmentData.observations}` : ''}

Please also search for any additional earned media coverage for ${project.brandName} from the last 3 months including:
- News articles and press mentions
- Trade publication coverage
- Analyst reports and mentions
- Podcast appearances
- Awards and recognition
- Industry event mentions

Provide a comprehensive earned media assessment:
1. Coverage Volume and Quality - How much coverage? What tier publications?
2. Sentiment Analysis - Positive, negative, neutral breakdown
3. Message Penetration - Are key brand messages getting through?
4. Spokesperson Visibility - Who's being quoted? How effective?
5. Competitor Share of Voice - How does coverage compare to competitors?
6. AI Search Impact - How does this coverage influence AI search results?
7. PR Strategy Recommendations - Awareness, reputation, credibility building

Write in flowing prose with specific examples. End with priority recommendations.`;

      const result = await callClaude(prompt, apiKey);
      setAssessmentData({ ...assessmentData, status: 'complete', content: result, coveragePaste });
    } catch (err) {
      setError(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const isComplete = assessmentData.status === 'complete';

  return (
    <div className="max-w-4xl mx-auto p-8 animate-fade-in">
      <div className="flex items-start gap-4 mb-8">
        <div className="w-14 h-14 bg-[#10B981]/10 rounded-xl flex items-center justify-center">
          <Newspaper className="w-7 h-7 text-[#10B981]" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-[#1A1A1A]">Earned Media Assessment</h2>
          <p className="text-[#333333]">Analyzing {project.brandName}'s press coverage</p>
        </div>
      </div>

      {/* Coverage Paste Field */}
      <div className="card p-6 mb-6">
        <h3 className="font-semibold text-[#1A1A1A] mb-3">Media Coverage (Last 3 Months)</h3>
        <p className="text-sm text-[#666666] mb-4">
          Paste any press coverage, news articles, mentions, or media clips from the last 3 months. 
          Include headlines, publication names, dates, and key quotes if available.
        </p>
        <textarea 
          value={coveragePaste} 
          onChange={(e) => setCoveragePaste(e.target.value)}
          placeholder="Paste media coverage here...

Example:
- TechCrunch (Jan 15, 2026): 'Company X Raises $50M' - Featured as lead story
- Forbes (Jan 8, 2026): CEO quoted on industry trends
- Industry Podcast (Dec 20, 2025): 30-min interview with CTO
..."
          className="w-full h-48 px-4 py-3 border border-[#D9D6D0] rounded-lg bg-white resize-none text-sm"
        />
      </div>

      {/* Assessor Observations - before analysis button */}
      <div className="card p-6 mb-6">
        <h3 className="font-semibold text-[#1A1A1A] mb-3">Assessor Observations</h3>
        <p className="text-sm text-[#666666] mb-3">Your observations will be included in the analysis and final report.</p>
        <textarea value={assessmentData.observations || ''} onChange={(e) => setAssessmentData({ ...assessmentData, observations: e.target.value })}
          placeholder="Add your own observations about their media presence, PR strategy, coverage quality..." className="w-full h-32 px-4 py-3 border border-[#D9D6D0] rounded-lg bg-white resize-none" />
      </div>

      {!isComplete && (
        <button onClick={runAnalysis} disabled={isProcessing} className="btn-primary flex items-center gap-2 mb-6">
          {isProcessing ? <><Loader2 className="w-4 h-4 animate-spin" /> Analyzing...</> : <><Play className="w-4 h-4" /> Run Earned Media Analysis</>}
        </button>
      )}

      {error && <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 text-red-700">{error}</div>}

      {isComplete && (
        <div className="card p-6 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-[#1A1A1A] flex items-center gap-2">
              <Check className="w-5 h-5 text-[#10B981]" /> Analysis Complete
            </h3>
            <button 
              onClick={() => {
                runAnalysis();
                if (onClearScores) onClearScores();
              }} 
              disabled={isProcessing} 
              className="btn-secondary text-sm py-2 px-4 flex items-center gap-2"
            >
              {isProcessing ? <><Loader2 className="w-4 h-4 animate-spin" /> Regenerating...</> : <><Play className="w-4 h-4" /> Regenerate Analysis</>}
            </button>
          </div>
          <div className="bg-[#F0EEEA] rounded-lg p-4 max-h-96 overflow-y-auto">
            <pre className="text-sm text-[#333333] whitespace-pre-wrap font-sans">{assessmentData.content}</pre>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between pt-6 border-t border-[#D9D6D0]">
        <button onClick={onPrev} className="btn-secondary flex items-center gap-2"><ArrowLeft className="w-4 h-4" /> Back</button>
        <button onClick={onNext} disabled={!isComplete} className="btn-primary flex items-center gap-2">Continue <ArrowRight className="w-4 h-4" /></button>
      </div>
    </div>
  );
}
// Report Page
function ReportPage({ project, scores, setScores, assessments, apiKey, onSave, onShare, onPrev }) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [isScoring, setIsScoring] = useState(false);
  const [scoringError, setScoringError] = useState(null);
  const [scoringProgress, setScoringProgress] = useState(0);
  const [scoringStage, setScoringStage] = useState('');
  const [expandedSections, setExpandedSections] = useState({
    attributes: true,
    recommendations: true,
    services: true,
    conclusions: true,
    evaluated: false,
  });

  const toggleSection = (section) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  // Scoring logic with progress
  const runScoring = async () => {
    if (!apiKey) {
      setScoringError('API key is required. Please go back to Setup and enter your Anthropic API key.');
      return;
    }
    setIsScoring(true);
    setScoringError(null);
    setScoringProgress(0);
    
    // Simulate progress stages
    const progressStages = [
      { progress: 10, stage: 'Analyzing website assessment...' },
      { progress: 25, stage: 'Evaluating social media presence...' },
      { progress: 40, stage: 'Processing AI reputation data...' },
      { progress: 55, stage: 'Reviewing earned media coverage...' },
      { progress: 70, stage: 'Calculating attribute scores...' },
      { progress: 85, stage: 'Generating recommendations...' },
      { progress: 95, stage: 'Finalizing report...' },
    ];
    
    let stageIndex = 0;
    const progressInterval = setInterval(() => {
      if (stageIndex < progressStages.length) {
        setScoringProgress(progressStages[stageIndex].progress);
        setScoringStage(progressStages[stageIndex].stage);
        stageIndex++;
      }
    }, 800);

    try {
      const prompt = `You are scoring ${project.brandName} against the Conscious Compass Framework v2.3.

ASSESSMENT DATA COLLECTED:

WEBSITE ASSESSMENT:
${assessments.website.content}
${assessments.website.observations ? `Assessor Notes: ${assessments.website.observations}` : ''}
Pages Reviewed: ${assessments.website.pagesReviewed || 'Not specified'}
Additional Content: ${assessments.website.websiteContent || 'None'}

SEO VISIBILITY ASSESSMENT:
${assessments.website.seoAssessment || 'SEO visibility not assessed'}

SOCIAL MEDIA ASSESSMENT:
${assessments.social.content}
${assessments.social.observations ? `Assessor Notes: ${assessments.social.observations}` : ''}
Glassdoor: ${assessments.social.glassdoorContent || 'Not reviewed'}
Nextdoor: ${assessments.social.nextdoorContent || 'Not reviewed'}
WIPO Trademark: ${assessments.social.wipoContent || 'Not checked'}

AI REPUTATION ASSESSMENT:
${assessments.aiReputation.content}
${assessments.aiReputation.observations ? `Assessor Notes: ${assessments.aiReputation.observations}` : ''}

EARNED MEDIA ASSESSMENT:
${assessments.earnedMedia.content}
${assessments.earnedMedia.observations ? `Assessor Notes: ${assessments.earnedMedia.observations}` : ''}

SCORING RUBRIC v2.3 - Score each attribute 0-100 based on these criteria:
${ATTRIBUTES.map(a => `${a.id} (${a.fullName}): ${a.description}`).join('\n')}

SCORE RANGE DEFINITIONS (use these anchors for consistency):
- 0-25 (Pre-Foundational): Significant gaps, minimal evidence of the attribute
- 26-39 (Foundational): Basic presence but major improvements needed
- 40-55 (Establishing): Moderate capability with clear room for growth
- 56-69 (Differentiating): Above average, showing intentional effort
- 70-84 (Leading): Strong performance, industry-competitive
- 85-100 (Transforming): Exceptional, category-defining excellence

IMPORTANT SCORING CONSIDERATIONS:
- Website accessibility compliance should be evaluated against WCAG 2.1 Level AA and factor into ATTENTIVE score
- SEO visibility assessment should significantly impact COGENT score
- Glassdoor reviews impact REFLECTIVE score (brand self-awareness and reputation)
- Nextdoor presence impacts AWARE score (audience connection and community trust)
- WIPO trademark registration impacts INTENTIONAL score (brand protection and professionalism)
- Be precise and consistent: the same evidence should always produce the same score range

SERVICE AREAS TO REFERENCE IN RECOMMENDATIONS:
- AWAKE: Executive Visibility, PR & Media Relations, Thought Leadership Content
- AWARE: Audience Research, Social Media Strategy, Community Management, GEO
- REFLECTIVE: Brand Strategy, Brand Expression, Crisis Communications, Brand Training
- ATTENTIVE: Website Strategy & Development, Creative Production, Brand Guidelines
- COGENT: SEO Strategy, Measurement & Analytics, GEO, Marketing Strategy
- SENTIENT: Creative Campaigns, Brand Expression, Content Strategy, Events
- VISIONARY: Brand Strategy, Impact Communications, Executive Visibility
- INTENTIONAL: Brand Strategy, Brand Assets & Guidelines, Website Development, Communications Training

Return the JSON scores in this exact format:
{
  "AWAKE": {"score": 45, "findings": "Specific observations about thought leadership presence, media mentions, and industry authority.", "opportunity": "Consider Executive Visibility and PR services to build industry influence and narrative leadership."},
  "AWARE": {"score": 52, "findings": "Specific observations about audience understanding, community engagement, and trust signals.", "opportunity": "Audience Research and Social Media Strategy would strengthen audience connection and trust."},
  "REFLECTIVE": {"score": 38, "findings": "Specific observations about brand narrative consistency, self-awareness, and reputation management.", "opportunity": "Brand Strategy and Brand Expression services would establish authentic brand foundation."},
  "ATTENTIVE": {"score": 55, "findings": "Specific observations about content quality, UX, accessibility compliance (estimate WCAG 2.1 AA percentage), and attention to detail.", "opportunity": "Website Strategy & Development would improve experience quality and accessibility."},
  "COGENT": {"score": 42, "findings": "Specific observations about messaging clarity, information architecture, SEO visibility (keyword rankings, brand search quality), and data-driven approach.", "opportunity": "SEO Strategy and Integrated Measurement would strengthen data-driven marketing approach."},
  "SENTIENT": {"score": 35, "findings": "Specific observations about emotional resonance, creative execution, and brand personality.", "opportunity": "Creative Campaigns and Brand Expression would create stronger emotional connections."},
  "VISIONARY": {"score": 48, "findings": "Specific observations about purpose, future orientation, and aspirational messaging.", "opportunity": "Brand Strategy and Impact Communications would clarify purpose and vision."},
  "INTENTIONAL": {"score": 50, "findings": "Specific observations about professionalism, credibility signals, and strategic positioning.", "opportunity": "Brand Assets & Guidelines would ensure professional, intentional market presence."}
}`;

      const result = await callClaude(prompt, apiKey, null, [], 0);
      clearInterval(progressInterval);
      setScoringProgress(100);
      setScoringStage('Complete!');
      const match = result.match(/\{[\s\S]*\}/);
      if (match) setScores(JSON.parse(match[0]));
    } catch (e) { 
      clearInterval(progressInterval);
      setScoringError(e.message); 
    }
    finally { setIsScoring(false); }
  };

  // If no scores yet, show scoring prompt
  if (!scores) {
    return (
      <div className="max-w-4xl mx-auto p-4 md:p-8 animate-fade-in">
        <div className="flex items-start gap-4 mb-8">
          <div className="w-14 h-14 bg-[#E53935]/10 rounded-xl flex items-center justify-center flex-shrink-0">
            <BarChart3 className="w-7 h-7 text-[#E53935]" />
          </div>
          <div>
            <h2 className="text-xl md:text-2xl font-bold text-[#1A1A1A]">Generate Brand Report</h2>
            <p className="text-[#333333] text-sm md:text-base">Ready to analyze {project.brandName} across all eight consciousness attributes.</p>
          </div>
        </div>

        <div className="card p-6 md:p-8 text-center mb-6">
          {isScoring ? (
            <>
              <Loader2 className="w-16 h-16 text-[#E53935] mx-auto mb-4 animate-spin" />
              <h3 className="text-xl font-semibold text-[#1A1A1A] mb-2">Generating Report...</h3>
              <p className="text-[#666666] mb-4">{scoringStage}</p>
              
              {/* Progress bar */}
              <div className="w-full max-w-md mx-auto bg-[#E8E6E1] rounded-full h-3 mb-4">
                <div 
                  className="bg-[#E53935] h-3 rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${scoringProgress}%` }}
                />
              </div>
              <p className="text-sm text-[#666666]">{scoringProgress}% complete</p>
              
              {/* Progress stages */}
              <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-[#666666]">
                <div className={`flex items-center gap-1 ${scoringProgress >= 10 ? 'text-[#E53935]' : ''}`}>
                  {scoringProgress >= 25 ? <Check className="w-3 h-3" /> : <div className="w-3 h-3 rounded-full border border-current" />}
                  Website
                </div>
                <div className={`flex items-center gap-1 ${scoringProgress >= 25 ? 'text-[#E53935]' : ''}`}>
                  {scoringProgress >= 40 ? <Check className="w-3 h-3" /> : <div className="w-3 h-3 rounded-full border border-current" />}
                  Social
                </div>
                <div className={`flex items-center gap-1 ${scoringProgress >= 40 ? 'text-[#E53935]' : ''}`}>
                  {scoringProgress >= 55 ? <Check className="w-3 h-3" /> : <div className="w-3 h-3 rounded-full border border-current" />}
                  AI Rep
                </div>
                <div className={`flex items-center gap-1 ${scoringProgress >= 55 ? 'text-[#E53935]' : ''}`}>
                  {scoringProgress >= 70 ? <Check className="w-3 h-3" /> : <div className="w-3 h-3 rounded-full border border-current" />}
                  Earned
                </div>
              </div>
            </>
          ) : (
            <>
              <Compass className="w-16 h-16 text-[#E53935] mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-[#1A1A1A] mb-2">Assessment Complete</h3>
              <p className="text-[#666666] mb-6">All four assessment areas have been evaluated. Generate scores to create your comprehensive brand consciousness report.</p>
              
              <button 
                onClick={runScoring} 
                disabled={isScoring}
                className="btn-primary flex items-center gap-2 mx-auto text-lg px-8 py-3"
              >
                <Play className="w-5 h-5" /> Generate Brand Report
              </button>
            </>
          )}
          
          {scoringError && (
            <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">
              {scoringError}
            </div>
          )}
        </div>

        <div className="flex justify-between">
          <button onClick={onPrev} className="btn-secondary flex items-center gap-2">
            <ArrowLeft className="w-4 h-4" /> Back to Earned Media
          </button>
        </div>
      </div>
    );
  }

  const overall = Math.round(
    Object.entries(scores)
      .filter(([key, val]) => val && typeof val.score === 'number')
      .reduce((a, [, v]) => a + v.score, 0) / 8
  );
  const stage = getMaturityStage(overall);
  const industryName = INDUSTRIES.find(i => i.id === project.industry)?.name || 'Other';

  const sortedAttrs = ATTRIBUTES.map(a => ({ ...a, score: scores[a.id]?.score || 0 })).sort((a, b) => a.score - b.score);
  
  // Generate 12 recommendations from lowest scoring attributes
  const recommendations = [];
  let attrIndex = 0;
  let recIndex = 0;
  while (recommendations.length < 12 && attrIndex < sortedAttrs.length) {
    const attr = sortedAttrs[attrIndex];
    const attrRecs = SERVICE_RECOMMENDATIONS[attr.id] || [];
    if (recIndex < attrRecs.length) {
      const rec = attrRecs[recIndex];
      recommendations.push({ 
        attr: attr.name, 
        attrId: attr.id, 
        title: rec.title,
        description: rec.description,
        impact: rec.impact,
        attributes: rec.attributes,
        score: attr.score 
      });
      recIndex++;
    } else {
      attrIndex++;
      recIndex = 0;
    }
  }

  // Collect all assessor observations
  const allObservations = [
    assessments.website?.observations,
    assessments.social?.observations,
    assessments.aiReputation?.observations,
    assessments.earnedMedia?.observations
  ].filter(Boolean);

  // Build what we evaluated text
  const evaluatedInputs = [];
  
  // Website Assessment inputs
  if (assessments.website?.pagesReviewed) {
    evaluatedInputs.push(`Website pages (${assessments.website.pagesReviewed})`);
  } else if (assessments.website?.images?.length > 0) {
    evaluatedInputs.push('Website homepage and key pages');
  }
  if (assessments.website?.websiteContent) evaluatedInputs.push('website content and messaging');
  if (assessments.website?.images?.length > 0) evaluatedInputs.push(`${assessments.website.images.length} website screenshot(s) analyzed for brand alignment, storytelling, and visual consistency`);
  
  // Social Media inputs
  if (assessments.social?.linkedinAbout) evaluatedInputs.push('LinkedIn company profile and positioning');
  if (assessments.social?.linkedinPosts) evaluatedInputs.push('LinkedIn posts and engagement metrics');
  if (assessments.social?.xContent) evaluatedInputs.push('X (Twitter) content and voice');
  if (assessments.social?.instagramContent) evaluatedInputs.push('Instagram presence and visual brand');
  if (assessments.social?.youtubeContent) evaluatedInputs.push('YouTube channel and video content');
  if (assessments.social?.redditContent) evaluatedInputs.push('Reddit community mentions and sentiment');
  if (assessments.social?.wikipediaContent) evaluatedInputs.push('Wikipedia presence and credibility signals');
  if (assessments.social?.socialImages?.length > 0) evaluatedInputs.push(`${assessments.social.socialImages.length} social media screenshot(s)`);
  
  // AI Reputation inputs
  if (assessments.aiReputation?.responses?.claude) evaluatedInputs.push('Claude AI brand perception');
  if (assessments.aiReputation?.responses?.gemini || assessments.aiReputation?.geminiManual) evaluatedInputs.push('Gemini AI brand perception');
  if (assessments.aiReputation?.responses?.chatgpt || assessments.aiReputation?.chatgptManual) evaluatedInputs.push('ChatGPT brand perception');
  
  // Earned Media inputs
  if (assessments.earnedMedia?.coveragePaste) evaluatedInputs.push('3 months earned media coverage and press mentions');

  // Build comprehensive evaluation description
  const websiteEvalDescription = assessments.website?.pagesReviewed 
    ? `Website analysis covered ${assessments.website.pagesReviewed}, examining brand positioning, messaging and storytelling, information architecture, UI design, user experience, accessibility, and AI search readability.`
    : 'Website analysis examined homepage and key pages for brand positioning, messaging, information architecture, UI/UX design, accessibility compliance, and AI search readability.';


  const generatePdf = async () => {
    setIsGeneratingPdf(true);
    try {
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const margin = 20;
      const contentWidth = pageWidth - (margin * 2);
      let y = margin;

      const addText = (text, fontSize = 10, isBold = false, color = [26, 31, 46]) => {
        pdf.setFontSize(fontSize);
        pdf.setFont('helvetica', isBold ? 'bold' : 'normal');
        pdf.setTextColor(color[0], color[1], color[2]);
        const lines = pdf.splitTextToSize(text, contentWidth);
        lines.forEach(line => {
          if (y > 270) { pdf.addPage(); y = margin; }
          pdf.text(line, margin, y);
          y += fontSize * 0.5;
        });
        y += 2;
      };

      const addHeading = (text) => {
        y += 5;
        addText(text, 14, true, [229, 57, 53]);
        y += 2;
      };

      const addSpace = (space = 5) => { y += space; };

      // Title
      pdf.setFontSize(24);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(26, 31, 46);
      pdf.text(project.brandName, margin, y);
      y += 10;
      
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'normal');
      pdf.text('Conscious Compass Assessment Report', margin, y);
      y += 7;
      
      pdf.setFontSize(10);
      pdf.setTextColor(107, 114, 128);
      pdf.text(`Assessment Date: ${project.date || new Date().toLocaleDateString()} | Industry: ${industryName} | Model: ${project.businessModel.toUpperCase()}`, margin, y);
      y += 10;

      // Overall Score Box
      pdf.setFillColor(229, 57, 53);
      pdf.roundedRect(margin, y, 50, 20, 3, 3, 'F');
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(20);
      pdf.setFont('helvetica', 'bold');
      pdf.text(`${overall}/100`, margin + 10, y + 13);
      
      pdf.setTextColor(26, 31, 46);
      pdf.setFontSize(12);
      pdf.text(`${stage.name}`, margin + 55, y + 8);
      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(107, 114, 128);
      const stageDesc = pdf.splitTextToSize(stage.description, contentWidth - 60);
      pdf.text(stageDesc, margin + 55, y + 14);
      y += 30;

      // Executive Summary
      addHeading('EXECUTIVE SUMMARY');
      addText(`${project.brandName} achieved an overall Brand Consciousness Score of ${overall}/100, placing them in the "${stage.name}" maturity stage. The assessment evaluated the brand across 8 key consciousness attributes. Key strengths emerged in ${sortedAttrs.slice(-2).map(a => a.name).join(' and ')}, while opportunities for growth were identified in ${sortedAttrs.slice(0, 2).map(a => a.name).join(' and ')}.`);
      addSpace(5);

      // Score Summary
      addHeading('SCORE SUMMARY');
      ATTRIBUTES.forEach(attr => {
        const score = scores[attr.id]?.score || 0;
        addText(`${attr.name} (${attr.fullName}): ${score}/100`, 10, false);
      });
      addSpace(5);

      // Spider Chart
      addHeading('BRAND CONSCIOUSNESS PROFILE');
      
      // Draw spider chart
      const chartCenterX = pageWidth / 2;
      const chartCenterY = y + 45;
      const chartRadius = 35;
      const numAttrs = ATTRIBUTES.length;
      const angleStep = (2 * Math.PI) / numAttrs;
      
      // Draw grid circles
      pdf.setDrawColor(220, 220, 220);
      pdf.setLineWidth(0.3);
      [0.2, 0.4, 0.6, 0.8, 1.0].forEach(level => {
        const r = chartRadius * level;
        pdf.circle(chartCenterX, chartCenterY, r, 'S');
      });
      
      // Draw axis lines
      pdf.setDrawColor(220, 220, 220);
      ATTRIBUTES.forEach((attr, i) => {
        const angle = angleStep * i - Math.PI / 2;
        const x2 = chartCenterX + chartRadius * Math.cos(angle);
        const y2 = chartCenterY + chartRadius * Math.sin(angle);
        pdf.line(chartCenterX, chartCenterY, x2, y2);
      });
      
      // Calculate data points
      const points = ATTRIBUTES.map((attr, i) => {
        const score = scores[attr.id]?.score || 0;
        const angle = angleStep * i - Math.PI / 2;
        const r = (score / 100) * chartRadius;
        return {
          x: chartCenterX + r * Math.cos(angle),
          y: chartCenterY + r * Math.sin(angle)
        };
      });
      
      // Draw filled polygon using triangle fan (light peach fill)
      pdf.setFillColor(252, 220, 210);
      for (let i = 0; i < points.length; i++) {
        const p1 = points[i];
        const p2 = points[(i + 1) % points.length];
        pdf.triangle(chartCenterX, chartCenterY, p1.x, p1.y, p2.x, p2.y, 'F');
      }
      
      // Draw polygon outline
      pdf.setDrawColor(229, 57, 53);
      pdf.setLineWidth(1.2);
      for (let i = 0; i < points.length; i++) {
        const p1 = points[i];
        const p2 = points[(i + 1) % points.length];
        pdf.line(p1.x, p1.y, p2.x, p2.y);
      }
      
      // Draw data points
      pdf.setFillColor(229, 57, 53);
      points.forEach(p => {
        pdf.circle(p.x, p.y, 1.5, 'F');
      });
      
      // Draw labels with scores
      pdf.setFontSize(7);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(26, 31, 46);
      ATTRIBUTES.forEach((attr, i) => {
        const angle = angleStep * i - Math.PI / 2;
        const labelRadius = chartRadius + 10;
        const labelX = chartCenterX + labelRadius * Math.cos(angle);
        const labelY = chartCenterY + labelRadius * Math.sin(angle) + 1;
        const score = scores[attr.id]?.score || 0;
        pdf.text(`${attr.name} (${score})`, labelX, labelY, { align: 'center' });
      });
      
      y = chartCenterY + chartRadius + 18;
      addSpace(5);

      // Attribute Analysis
      addHeading('ATTRIBUTE ANALYSIS');
      ATTRIBUTES.forEach(attr => {
        addText(`${attr.name}: ${scores[attr.id]?.score || 0}/100`, 11, true);
        const findings = scores[attr.id]?.findings || scores[attr.id]?.summary || attr.description;
        addText(findings, 9);
        if (scores[attr.id]?.opportunity) {
          addText(scores[attr.id].opportunity, 9, false, [229, 57, 53]); // Teal color for opportunity
        }
        addSpace(3);
      });

      // Maturity Stage Context
      addHeading('MATURITY STAGE CONTEXT');
      addText(`With a score of ${overall}/100, ${project.brandName} is positioned in the "${stage.name}" stage of brand consciousness maturity. ${stage.description}. Brands at this stage typically demonstrate ${overall < 40 ? 'foundational elements but significant room for strategic development' : overall < 60 ? 'solid fundamentals with clear opportunities to elevate their market presence' : overall < 80 ? 'strong brand awareness with potential to become industry thought leaders' : 'exceptional consciousness and should focus on maintaining their position'}. The path forward involves targeted investment in the lowest-scoring attributes.`);
      addSpace(5);

      // Recommendations
      addHeading('INTEGRATED MARKETING RECOMMENDATIONS');
      recommendations.forEach((r, i) => {
        addText(`${i + 1}. ${r.title}`, 10, true);
        addText(`${r.description} ${r.impact} (${r.attributes.join(', ')})`, 9);
        addSpace(2);
      });
      addSpace(3);

      // Conclusions
      addHeading('CONCLUSIONS');
      addText(`${project.brandName} has demonstrated ${overall >= 60 ? 'strong potential' : 'a foundation'} for building an impactful, conscious brand presence. By focusing on the recommendations above, particularly strengthening ${sortedAttrs[0].name} and ${sortedAttrs[1].name} capabilities, the brand can elevate its market position. The journey toward greater brand consciousness is ongoing, and ${project.brandName} is well positioned to become a more consequential presence in the ${industryName.toLowerCase()} industry.`);
      addSpace(5);

      // What We Evaluated
      addHeading('WHAT WE EVALUATED');
      addText(`This assessment was conducted using Antenna Group's Brand Consciousness Framework v2.3, evaluating ${project.brandName} across four key dimensions. ${websiteEvalDescription} Social media presence was analyzed across LinkedIn, X, Instagram, YouTube, Reddit, and Wikipedia for brand consistency and engagement. AI reputation was assessed by querying Claude, Gemini, and ChatGPT to understand how AI systems perceive and represent the brand. Earned media coverage from the past 3 months was reviewed for sentiment, message penetration, and share of voice. The business model (${project.businessModel.toUpperCase()}) and industry context (${industryName}) were applied to weight attribute importance appropriately.`, 9);

      // Footer on each page
      const pageCount = pdf.internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        pdf.setPage(i);
        pdf.setFontSize(8);
        pdf.setTextColor(156, 163, 175);
        pdf.text(`Antenna Group | Conscious Compass Assessment | Page ${i} of ${pageCount}`, pageWidth / 2, 290, { align: 'center' });
      }

      pdf.save(`${project.brandName.replace(/\s+/g, '_')}_Conscious_Compass_Report.pdf`);
    } catch (e) { console.error(e); }
    finally { setIsGeneratingPdf(false); }
  };

  const generateDocx = async () => {
    setIsGenerating(true);
    try {
      const doc = new Document({
        styles: { default: { document: { run: { font: 'Arial', size: 24 } } } },
        sections: [{
          properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } },
          children: [
            // Title
            new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: `${project.brandName}`, bold: true })] }),
            new Paragraph({ children: [new TextRun({ text: 'Conscious Compass Assessment Report', size: 28 })] }),
            new Paragraph({ children: [new TextRun({ text: `Assessment Date: ${project.date || new Date().toLocaleDateString()} | Industry: ${industryName} | Model: ${project.businessModel.toUpperCase()}`, italics: true })] }),
            new Paragraph({ children: [new TextRun('')] }),
            
            // Executive Summary
            new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun('EXECUTIVE SUMMARY')] }),
            new Paragraph({ children: [new TextRun(`${project.brandName} achieved an overall Brand Consciousness Score of ${overall}/100, placing them in the "${stage.name}" maturity stage. The assessment evaluated the brand across 8 key consciousness attributes: Awake, Aware, Reflective, Attentive, Cogent, Sentient, Visionary, and Intentional. Key strengths emerged in ${sortedAttrs.slice(-2).map(a => a.name).join(' and ')}, while opportunities for growth were identified in ${sortedAttrs.slice(0, 2).map(a => a.name).join(' and ')}.`)] }),
            new Paragraph({ children: [new TextRun('')] }),
            
            // Score Summary
            new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun('SCORE SUMMARY')] }),
            new Paragraph({ children: [new TextRun({ text: `Overall Score: ${overall}/100`, bold: true })] }),
            new Paragraph({ children: [new TextRun('')] }),
            ...ATTRIBUTES.map(attr => new Paragraph({ children: [new TextRun(`${attr.name} (${attr.fullName}): ${scores[attr.id]?.score || 0}/100`)] })),
            new Paragraph({ children: [new TextRun('')] }),
            
            // Attribute Analysis
            new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun('ATTRIBUTE ANALYSIS')] }),
            ...ATTRIBUTES.flatMap(attr => [
              new Paragraph({ children: [new TextRun({ text: `${attr.name}: ${scores[attr.id]?.score || 0}/100`, bold: true })] }),
              new Paragraph({ children: [new TextRun(scores[attr.id]?.findings || scores[attr.id]?.summary || attr.description)] }),
              ...(scores[attr.id]?.opportunity ? [new Paragraph({ children: [new TextRun({ text: scores[attr.id].opportunity, italics: true, color: '0D9488' })] })] : []),
              new Paragraph({ children: [new TextRun('')] }),
            ]),
            
            // Maturity Stage Context
            new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun('MATURITY STAGE CONTEXT')] }),
            new Paragraph({ children: [new TextRun(`With a score of ${overall}/100, ${project.brandName} is positioned in the "${stage.name}" stage of brand consciousness maturity. ${stage.description}. Brands at this stage typically demonstrate ${overall < 40 ? 'foundational elements but significant room for strategic development across multiple dimensions' : overall < 60 ? 'solid fundamentals with clear opportunities to elevate their market presence and differentiation' : overall < 80 ? 'strong brand awareness with potential to become true industry thought leaders' : 'exceptional consciousness and should focus on maintaining their position while innovating'}. The path forward involves targeted investment in the lowest-scoring attributes to create a more balanced and powerful brand presence.`)] }),
            new Paragraph({ children: [new TextRun('')] }),
            
            // Recommendations
            new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun('INTEGRATED MARKETING RECOMMENDATIONS')] }),
            new Paragraph({ children: [new TextRun({ text: 'Based on the assessment, here are 12 priority recommendations to enhance brand consciousness:', italics: true })] }),
            new Paragraph({ children: [new TextRun('')] }),
            ...recommendations.flatMap((r, i) => [
              new Paragraph({ children: [new TextRun({ text: `${i + 1}. ${r.title}`, bold: true })] }),
              new Paragraph({ children: [new TextRun(`${r.description} ${r.impact} (${r.attributes.join(', ')})`)] }),
              new Paragraph({ children: [new TextRun('')] }),
            ]),
            
            // Conclusions
            new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun('CONCLUSIONS')] }),
            new Paragraph({ children: [new TextRun(`${project.brandName} has demonstrated ${overall >= 60 ? 'strong potential' : 'a foundation'} for building an impactful, conscious brand presence. By focusing on the recommendations outlined above, particularly strengthening ${sortedAttrs[0].name} and ${sortedAttrs[1].name} capabilities, the brand can elevate its market position and create deeper connections with its audience. The journey toward greater brand consciousness is ongoing, and with strategic focus, ${project.brandName} is well positioned to become a more consequential presence in the ${industryName.toLowerCase()} industry.`)] }),
            new Paragraph({ children: [new TextRun('')] }),
            
            // What We Evaluated
            new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun('WHAT WE EVALUATED')] }),
            new Paragraph({ children: [new TextRun(`This assessment was conducted using Antenna Group's Brand Consciousness Framework v2.3, evaluating ${project.brandName} across four key dimensions. ${websiteEvalDescription} Social media presence was analyzed across LinkedIn, X, Instagram, YouTube, Reddit, and Wikipedia for brand consistency and engagement. AI reputation was assessed by querying Claude, Gemini, and ChatGPT to understand how AI systems perceive and represent the brand. Earned media coverage from the past 3 months was reviewed for sentiment, message penetration, and share of voice. The business model (${project.businessModel.toUpperCase()}) and industry context (${industryName}) were applied to weight attribute importance appropriately.`)] }),
          ]
        }]
      });

      const buffer = await Packer.toBuffer(doc);
      saveAs(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }), 
        `${project.brandName.replace(/\s+/g, '_')}_Conscious_Compass_Report.docx`);
    } catch (e) { console.error(e); }
    finally { setIsGenerating(false); }
  };

  return (
    <div className="max-w-5xl mx-auto p-8 animate-fade-in">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-3xl font-bold text-[#1A1A1A]">{project.brandName}</h2>
          <p className="text-[#666666]">Conscious Compass Assessment Report | {industryName}</p>
        </div>
        <div className="flex gap-3">
          <button onClick={onShare} className="btn-secondary flex items-center gap-2"><Share2 className="w-4 h-4" /> Share</button>
          <button onClick={onSave} className="btn-secondary flex items-center gap-2"><Save className="w-4 h-4" /> Save</button>
          <button onClick={generatePdf} disabled={isGeneratingPdf} className="btn-secondary flex items-center gap-2">
            {isGeneratingPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} PDF
          </button>
          <button onClick={generateDocx} disabled={isGenerating} className="btn-primary flex items-center gap-2">
            {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} DOCX
          </button>
        </div>
      </div>

      {/* Executive Summary */}
      <div className="card p-6 mb-6">
        <h3 className="text-lg font-semibold text-[#1A1A1A] mb-4">EXECUTIVE SUMMARY</h3>
        <p className="text-[#333333] leading-relaxed">
          {project.brandName} achieved an overall Brand Consciousness Score of <strong>{overall}/100</strong>, placing them in the "<strong>{stage.name}</strong>" maturity stage. The assessment evaluated the brand across 8 key consciousness attributes. Key strengths emerged in {sortedAttrs.slice(-2).map(a => a.name).join(' and ')}, while opportunities for growth were identified in {sortedAttrs.slice(0, 2).map(a => a.name).join(' and ')}.
        </p>
      </div>

      {/* Spider Chart */}
      <div className="card p-6 mb-6">
        <h3 className="text-lg font-semibold text-[#1A1A1A] mb-4 text-center">Brand Consciousness Profile</h3>
        <SpiderChart scores={scores} size={450} />
      </div>

      {/* Score Summary */}
      <div className="card p-6 mb-6">
        <h3 className="text-lg font-semibold text-[#1A1A1A] mb-4">SCORE SUMMARY</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {ATTRIBUTES.map(attr => (
            <div key={attr.id} className="text-center p-3 bg-[#F0EEEA] rounded-lg">
              <div className="text-2xl font-bold" style={{ color: attr.color }}>{scores[attr.id]?.score || 0}</div>
              <div className="text-sm text-[#333333]">{attr.name}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Maturity Continuum */}
      <MaturityContinuum score={overall} />

      {/* Maturity Stage Context */}
      <div className="card p-6 mb-6">
        <h3 className="text-lg font-semibold text-[#1A1A1A] mb-4">MATURITY STAGE CONTEXT</h3>
        <p className="text-[#333333] leading-relaxed">
          With a score of {overall}/100, {project.brandName} is positioned in the "{stage.name}" stage of brand consciousness maturity. {stage.description}. Brands at this stage typically demonstrate {overall < 40 ? 'foundational elements but significant room for strategic development across multiple dimensions' : overall < 60 ? 'solid fundamentals with clear opportunities to elevate their market presence and differentiation' : overall < 80 ? 'strong brand awareness with potential to become true industry thought leaders' : 'exceptional consciousness and should focus on maintaining their position while innovating'}. The path forward involves targeted investment in the lowest-scoring attributes.
        </p>
      </div>

      {/* Attribute Analysis - Collapsible */}
      <div className="mt-8 mb-8">
        <button 
          onClick={() => toggleSection('attributes')} 
          className="w-full flex items-center justify-between text-xl font-semibold text-[#1A1A1A] mb-4 hover:text-[#E53935] transition-colors"
        >
          <span>ATTRIBUTE ANALYSIS</span>
          <ChevronDown className={`w-5 h-5 transition-transform ${expandedSections.attributes ? 'rotate-180' : ''}`} />
        </button>
        {expandedSections.attributes && (
          <div className="space-y-4 animate-fade-in">
            {ATTRIBUTES.map(attr => (
              <div key={attr.id} className="card p-4 md:p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 md:w-12 md:h-12 rounded-lg flex items-center justify-center text-white font-bold text-base md:text-lg flex-shrink-0" style={{ backgroundColor: attr.color }}>
                      {scores[attr.id]?.score || 0}
                    </div>
                    <div>
                      <h4 className="font-bold text-[#1A1A1A] text-sm md:text-base">{attr.name}</h4>
                      <p className="text-xs md:text-sm text-[#666666]">{attr.fullName}</p>
                    </div>
                  </div>
                </div>
                <p className="text-xs md:text-sm text-[#333333] mb-2">{scores[attr.id]?.findings || scores[attr.id]?.summary || attr.description}</p>
                {scores[attr.id]?.opportunity && (
                  <p className="text-xs md:text-sm text-[#E53935] italic">{scores[attr.id].opportunity}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recommendations - Collapsible */}
      <div className="mb-6">
        <button 
          onClick={() => toggleSection('recommendations')} 
          className="w-full flex items-center justify-between text-xl font-semibold text-[#1A1A1A] mb-4 hover:text-[#E53935] transition-colors"
        >
          <span>INTEGRATED MARKETING RECOMMENDATIONS</span>
          <ChevronDown className={`w-5 h-5 transition-transform ${expandedSections.recommendations ? 'rotate-180' : ''}`} />
        </button>
        {expandedSections.recommendations && (
          <div className="animate-fade-in">
            <p className="text-[#666666] mb-4 text-sm md:text-base">Based on the assessment, here are 12 priority recommendations to enhance brand consciousness:</p>
            <div className="space-y-4">
              {recommendations.map((r, i) => (
                <div key={i} className="card p-4 md:p-5">
                  <div className="flex items-start gap-3 md:gap-4">
                    <div className="w-7 h-7 md:w-8 md:h-8 rounded-full bg-[#E53935] text-white flex items-center justify-center font-bold text-xs md:text-sm flex-shrink-0">{i + 1}</div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-[#1A1A1A] mb-2 text-sm md:text-base">{r.title}</h4>
                      <p className="text-xs md:text-sm text-[#333333] leading-relaxed mb-2">
                        {r.description} {r.impact}
                      </p>
                      <div className="flex flex-wrap gap-1 md:gap-2">
                        {r.attributes.map((attr, j) => (
                          <span key={j} className="text-xs px-2 py-0.5 md:py-1 bg-[#E53935]/10 text-[#E53935] rounded-full font-medium">{attr}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Antenna Group Services - Collapsible */}
      {(() => {
        const serviceRecs = getAllRecommendations(scores);
        const topServices = serviceRecs.slice(0, 6);
        if (topServices.length === 0) return null;
        
        return (
          <div className="mb-6">
            <button 
              onClick={() => toggleSection('services')} 
              className="w-full flex items-center justify-between text-xl font-semibold text-[#1A1A1A] mb-4 hover:text-[#E53935] transition-colors"
            >
              <span>RECOMMENDED ANTENNA GROUP SERVICES</span>
              <ChevronDown className={`w-5 h-5 transition-transform ${expandedSections.services ? 'rotate-180' : ''}`} />
            </button>
            {expandedSections.services && (
              <div className="animate-fade-in">
                <p className="text-[#666666] mb-4 text-sm md:text-base">Based on the lowest scoring attributes, these services would have the greatest impact on improving brand consciousness:</p>
                <div className="grid md:grid-cols-2 gap-4">
                  {topServices.map((rec, i) => {
                    const attr = ATTRIBUTES.find(a => a.id === rec.attributeId);
                    return (
                      <div key={i} className="card p-4 md:p-5 border-l-4" style={{ borderLeftColor: attr?.color || '#E53935' }}>
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <h4 className="font-semibold text-[#1A1A1A] text-sm md:text-base">{rec.service.name}</h4>
                            <p className="text-xs text-[#666666]">{rec.service.category}</p>
                          </div>
                          <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                            rec.priorityLevel === 'critical' ? 'bg-red-100 text-red-700' :
                            rec.priorityLevel === 'moderate' ? 'bg-yellow-100 text-yellow-700' :
                            'bg-green-100 text-green-700'
                          }`}>
                            {rec.priorityLevel === 'critical' ? 'High Priority' : 
                             rec.priorityLevel === 'moderate' ? 'Recommended' : 'Opportunity'}
                          </span>
                        </div>
                        <p className="text-xs md:text-sm text-[#333333] mb-3">{rec.rationale}</p>
                        <div className="flex items-center justify-between text-xs text-[#666666]">
                          <span className="flex items-center gap-1">
                            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: attr?.color || '#E53935' }}></span>
                            Improves {attr?.name} (currently {rec.attributeScore})
                          </span>
                          <span className="font-medium">{formatBudget(rec.service)}</span>
                        </div>
                        {rec.service.note && (
                          <p className="text-xs text-[#999999] mt-2 italic">{rec.service.note}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* Conclusions - Collapsible */}
      <div className="mb-6">
        <button 
          onClick={() => toggleSection('conclusions')} 
          className="w-full flex items-center justify-between text-lg font-semibold text-[#1A1A1A] mb-4 hover:text-[#E53935] transition-colors"
        >
          <span>CONCLUSIONS</span>
          <ChevronDown className={`w-5 h-5 transition-transform ${expandedSections.conclusions ? 'rotate-180' : ''}`} />
        </button>
        {expandedSections.conclusions && (
          <div className="card p-4 md:p-6 animate-fade-in">
            <p className="text-sm md:text-base text-[#333333] leading-relaxed">
              {project.brandName} has demonstrated {overall >= 60 ? 'strong potential' : 'a foundation'} for building an impactful, conscious brand presence. By focusing on the recommendations outlined above, particularly strengthening {sortedAttrs[0].name} and {sortedAttrs[1].name} capabilities, the brand can elevate its market position and create deeper connections with its audience. The journey toward greater brand consciousness is ongoing, and with strategic focus, {project.brandName} is well positioned to become a more consequential presence in its industry.
            </p>
          </div>
        )}
      </div>

      {/* What We Evaluated - Collapsible */}
      <div className="mb-8">
        <button 
          onClick={() => toggleSection('evaluated')} 
          className="w-full flex items-center justify-between text-lg font-semibold text-[#1A1A1A] mb-4 hover:text-[#E53935] transition-colors"
        >
          <span>WHAT WE EVALUATED</span>
          <ChevronDown className={`w-5 h-5 transition-transform ${expandedSections.evaluated ? 'rotate-180' : ''}`} />
        </button>
        {expandedSections.evaluated && (
          <div className="card p-4 md:p-6 animate-fade-in">
            <p className="text-sm md:text-base text-[#333333] leading-relaxed">
              This assessment was conducted using Antenna Group's Brand Consciousness Framework v2.3, evaluating {project.brandName} across four key dimensions. {websiteEvalDescription} Social media presence was analyzed across LinkedIn, X, Instagram, YouTube, Reddit, and Wikipedia for brand consistency and engagement. AI reputation was assessed by querying Claude, Gemini, and ChatGPT to understand how AI systems perceive and represent the brand. Earned media coverage from the past 3 months was reviewed for sentiment, message penetration, and share of voice. The business model ({project.businessModel.toUpperCase()}) and industry context ({industryName}) were applied to weight attribute importance appropriately.
            </p>
          </div>
        )}
      </div>

      <div className="flex items-center justify-start pt-6 border-t border-[#D9D6D0]">
        <button onClick={onPrev} className="btn-secondary flex items-center gap-2"><ArrowLeft className="w-4 h-4" /> Back</button>
      </div>
    </div>
  );
}

// Compass Results Page - Summary grid of all assessments
function CompassResultsPage({ results, onDelete, onBack, onAddManual, onUpdateResults }) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [manualEntry, setManualEntry] = useState({
    brandName: '',
    businessModel: 'b2b',
    industry: 'other',
    totalScore: 50,
    scores: { AWAKE: 50, AWARE: 50, REFLECTIVE: 50, ATTENTIVE: 50, COGENT: 50, SENTIENT: 50, VISIONARY: 50, INTENTIONAL: 50 },
  });

  const industries = INDUSTRIES;

  const handleExportCSV = () => {
    if (results.length === 0) {
      alert('No results to export');
      return;
    }
    
    const headers = ['Brand Name', 'Business Model', 'Industry', 'Total Score', 'Maturity Level', 
      'AWAKE', 'AWARE', 'REFLECTIVE', 'ATTENTIVE', 'COGENT', 'SENTIENT', 'VISIONARY', 'INTENTIONAL',
      'Services Recommended', 'Date', 'Manual Entry'];
    
    const rows = results.map(r => [
      r.brandName,
      r.businessModel?.toUpperCase() || '',
      r.industry || '',
      r.totalScore,
      r.maturityLevel,
      r.scores?.AWAKE || 0,
      r.scores?.AWARE || 0,
      r.scores?.REFLECTIVE || 0,
      r.scores?.ATTENTIVE || 0,
      r.scores?.COGENT || 0,
      r.scores?.SENTIENT || 0,
      r.scores?.VISIONARY || 0,
      r.scores?.INTENTIONAL || 0,
      (r.servicesRecommended || []).join('; '),
      r.savedAt ? new Date(r.savedAt).toLocaleDateString() : '',
      r.isManual ? 'Yes' : 'No',
    ]);
    
    const csv = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `compass-results-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const handleAddManual = () => {
    if (!manualEntry.brandName.trim()) {
      alert('Please enter a brand name');
      return;
    }
    
    const stage = getMaturityStage(manualEntry.totalScore);
    
    const newResult = {
      id: `manual-${Date.now()}`,
      brandName: manualEntry.brandName,
      businessModel: manualEntry.businessModel,
      industry: manualEntry.industry,
      totalScore: manualEntry.totalScore,
      maturityLevel: stage.name,
      scores: { ...manualEntry.scores },
      servicesRecommended: [],
      savedAt: new Date().toISOString(),
      isManual: true,
    };
    
    const updated = [...results, newResult];
    localStorage.setItem('conscious-compass-results', JSON.stringify(updated));
    onUpdateResults(updated);
    setShowAddModal(false);
    setManualEntry({
      brandName: '',
      businessModel: 'b2b',
      industry: 'other',
      totalScore: 50,
      scores: { AWAKE: 50, AWARE: 50, REFLECTIVE: 50, ATTENTIVE: 50, COGENT: 50, SENTIENT: 50, VISIONARY: 50, INTENTIONAL: 50 },
    });
  };

  const handleDelete = (id) => {
    if (confirm('Delete this result?')) {
      const updated = results.filter(r => r.id !== id);
      localStorage.setItem('conscious-compass-results', JSON.stringify(updated));
      onUpdateResults(updated);
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F4F0]">
      <div className="max-w-7xl mx-auto p-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <button onClick={onBack} className="btn-secondary flex items-center gap-2">
              <ArrowLeft className="w-4 h-4" /> Back
            </button>
            <h1 className="text-2xl font-bold text-[#1A1A1A]">Compass Results</h1>
            <span className="text-sm text-[#666666]">{results.length} assessments</span>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => setShowAddModal(true)} className="btn-secondary flex items-center gap-2">
              <Plus className="w-4 h-4" /> Add Manual Entry
            </button>
            <button onClick={handleExportCSV} disabled={results.length === 0} className="btn-primary flex items-center gap-2">
              <Download className="w-4 h-4" /> Export CSV
            </button>
          </div>
        </div>

        {results.length === 0 ? (
          <div className="card p-12 text-center">
            <BarChart3 className="w-16 h-16 text-[#D9D6D0] mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-[#1A1A1A] mb-2">No Results Yet</h3>
            <p className="text-[#666666] mb-4">Complete and save assessments to see them here, or add manual entries.</p>
            <button onClick={() => setShowAddModal(true)} className="btn-primary">
              Add Manual Entry
            </button>
          </div>
        ) : (
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-[#F0EEEA] border-b border-[#D9D6D0]">
                  <tr>
                    <th className="text-left p-3 font-semibold text-[#1A1A1A]">Brand</th>
                    <th className="text-left p-3 font-semibold text-[#1A1A1A]">Model</th>
                    <th className="text-left p-3 font-semibold text-[#1A1A1A]">Industry</th>
                    <th className="text-center p-3 font-semibold text-[#1A1A1A]">Score</th>
                    <th className="text-left p-3 font-semibold text-[#1A1A1A]">Maturity</th>
                    {['AWK', 'AWR', 'REF', 'ATT', 'COG', 'SEN', 'VIS', 'INT'].map(attr => (
                      <th key={attr} className="text-center p-3 font-semibold text-[#1A1A1A] text-xs">{attr}</th>
                    ))}
                    <th className="text-left p-3 font-semibold text-[#1A1A1A]">Services</th>
                    <th className="text-center p-3 font-semibold text-[#1A1A1A]">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((r, i) => {
                    const stage = MATURITY_STAGES.find(s => s.name === r.maturityLevel) || MATURITY_STAGES[0];
                    return (
                      <tr key={r.id || i} className="border-b border-[#E8E6E1] hover:bg-[#F0EEEA]/50">
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-[#1A1A1A]">{r.brandName}</span>
                            {r.isManual && (
                              <span className="text-xs px-1.5 py-0.5 bg-yellow-100 text-yellow-700 rounded">Manual</span>
                            )}
                          </div>
                        </td>
                        <td className="p-3 text-[#666666]">{r.businessModel?.toUpperCase()}</td>
                        <td className="p-3 text-[#666666] text-xs">{r.industry}</td>
                        <td className="p-3 text-center">
                          <span className="font-bold text-lg" style={{ color: stage.color }}>{r.totalScore}</span>
                        </td>
                        <td className="p-3">
                          <span className="text-xs px-2 py-1 rounded-full" style={{ backgroundColor: `${stage.color}20`, color: stage.color }}>
                            {r.maturityLevel}
                          </span>
                        </td>
                        {['AWAKE', 'AWARE', 'REFLECTIVE', 'ATTENTIVE', 'COGENT', 'SENTIENT', 'VISIONARY', 'INTENTIONAL'].map(attr => (
                          <td key={attr} className="p-3 text-center text-xs text-[#666666]">
                            {r.scores?.[attr] || 0}
                          </td>
                        ))}
                        <td className="p-3 text-xs text-[#666666] max-w-[150px]">
                          {(r.servicesRecommended || []).slice(0, 2).join(', ')}
                          {(r.servicesRecommended || []).length > 2 && '...'}
                        </td>
                        <td className="p-3 text-center">
                          <button onClick={() => handleDelete(r.id)} className="text-red-500 hover:text-red-700">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Add Manual Entry Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-[#D9D6D0]">
              <h3 className="text-xl font-bold text-[#1A1A1A]">Add Manual Entry</h3>
              <button onClick={() => setShowAddModal(false)} className="text-[#666666] hover:text-[#1A1A1A]">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#1A1A1A] mb-1">Brand Name *</label>
                <input
                  type="text"
                  value={manualEntry.brandName}
                  onChange={(e) => setManualEntry({ ...manualEntry, brandName: e.target.value })}
                  placeholder="Enter brand name"
                  className="w-full px-3 py-2 border border-[#D9D6D0] rounded-lg"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[#1A1A1A] mb-1">Business Model</label>
                  <select
                    value={manualEntry.businessModel}
                    onChange={(e) => setManualEntry({ ...manualEntry, businessModel: e.target.value })}
                    className="w-full px-3 py-2 border border-[#D9D6D0] rounded-lg"
                  >
                    <option value="b2b">B2B</option>
                    <option value="b2c">B2C</option>
                    <option value="b2b2c">B2B2C</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#1A1A1A] mb-1">Industry</label>
                  <select
                    value={manualEntry.industry}
                    onChange={(e) => setManualEntry({ ...manualEntry, industry: e.target.value })}
                    className="w-full px-3 py-2 border border-[#D9D6D0] rounded-lg"
                  >
                    {industries.map(ind => (
                      <option key={ind.id} value={ind.id}>{ind.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              
              {/* Total Compass Score */}
              <div className="bg-[#F0EEEA] rounded-lg p-4">
                <label className="block text-sm font-medium text-[#1A1A1A] mb-2">Total Compass Score (0-100) *</label>
                <div className="flex items-center gap-4">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={manualEntry.totalScore}
                    onChange={(e) => setManualEntry({ ...manualEntry, totalScore: Math.min(100, Math.max(0, parseInt(e.target.value) || 0)) })}
                    className="w-24 px-3 py-2 border border-[#D9D6D0] rounded-lg text-center text-lg font-bold"
                  />
                  <span className="text-sm text-[#666666]">
                    Weighted score (not auto-calculated from attributes)
                  </span>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-[#1A1A1A] mb-3">Attribute Scores (0-100)</label>
                <div className="grid grid-cols-2 gap-3">
                  {ATTRIBUTES.map(attr => (
                    <div key={attr.id} className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full" style={{ backgroundColor: attr.color }}></span>
                      <span className="text-sm text-[#666666] w-24">{attr.name}</span>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={manualEntry.scores[attr.id]}
                        onChange={(e) => setManualEntry({
                          ...manualEntry,
                          scores: { ...manualEntry.scores, [attr.id]: parseInt(e.target.value) || 0 }
                        })}
                        className="w-20 px-2 py-1 border border-[#D9D6D0] rounded text-center"
                      />
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <p className="text-sm text-yellow-800">
                  <strong>Note:</strong> Manual entries will be flagged as such in the results grid.
                </p>
              </div>
            </div>
            <div className="p-6 border-t border-[#D9D6D0] flex justify-end gap-3">
              <button onClick={() => setShowAddModal(false)} className="btn-secondary">Cancel</button>
              <button onClick={handleAddManual} className="btn-primary">Add Entry</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Onboarding Tour Component
function OnboardingTour({ onComplete }) {
  const [step, setStep] = useState(0);
  
  const steps = [
    {
      title: "Welcome to Conscious Compass",
      description: "This tool helps you assess brands across 8 consciousness attributes to understand their market presence and identify opportunities for growth.",
      icon: Compass,
    },
    {
      title: "Four Assessment Areas",
      description: "You'll evaluate the brand's Website presence, Social Media footprint, AI Reputation across major AI systems, and Earned Media coverage.",
      icon: Globe,
    },
    {
      title: "Upload Screenshots & Data",
      description: "Capture screenshots of the brand's digital presence and paste relevant content. The AI will analyze everything to generate insights.",
      icon: Image,
    },
    {
      title: "Get Actionable Results",
      description: "Receive scores across 8 attributes, specific recommendations, and suggested services to improve brand consciousness.",
      icon: BarChart3,
    },
    {
      title: "Compare & Track Progress",
      description: "Save assessments, compare multiple brands side-by-side, and export results to track improvements over time.",
      icon: Users,
    },
  ];

  const currentStep = steps[step];
  const Icon = currentStep.icon;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-[#1A1A1A] rounded-lg max-w-lg w-full overflow-hidden animate-fade-in">
        <div className="bg-[#E8FF00] p-8 text-center">
          <Icon className="w-16 h-16 text-[#1A1A1A] mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-[#1A1A1A]">{currentStep.title}</h2>
        </div>
        
        <div className="p-6">
          <p className="text-[#E8E6E1] text-center mb-6">{currentStep.description}</p>
          
          {/* Progress dots */}
          <div className="flex justify-center gap-2 mb-6">
            {steps.map((_, i) => (
              <div 
                key={i} 
                className={`w-2 h-2 rounded-full transition-colors ${i === step ? 'bg-[#E8FF00]' : 'bg-[#666666]'}`}
              />
            ))}
          </div>
          
          <div className="flex gap-3">
            {step > 0 && (
              <button 
                onClick={() => setStep(step - 1)} 
                className="flex-1 bg-transparent border border-[#E8FF00] text-[#E8FF00] font-semibold py-3 px-6 uppercase text-sm tracking-wide hover:bg-[#E8FF00] hover:text-[#1A1A1A] transition-colors"
              >
                Back
              </button>
            )}
            {step < steps.length - 1 ? (
              <button 
                onClick={() => setStep(step + 1)} 
                className="flex-1 bg-[#E8FF00] text-[#1A1A1A] font-semibold py-3 px-6 uppercase text-sm tracking-wide hover:bg-[#D4E800] transition-colors"
              >
                Next
              </button>
            ) : (
              <button 
                onClick={() => {
                  localStorage.setItem('conscious-compass-onboarded', 'true');
                  onComplete();
                }} 
                className="flex-1 bg-[#E8FF00] text-[#1A1A1A] font-semibold py-3 px-6 uppercase text-sm tracking-wide hover:bg-[#D4E800] transition-colors"
              >
                Get Started
              </button>
            )}
          </div>
          
          {step < steps.length - 1 && (
            <button 
              onClick={() => {
                localStorage.setItem('conscious-compass-onboarded', 'true');
                onComplete();
              }}
              className="w-full text-center text-sm text-[#666666] mt-4 hover:text-[#E8FF00] transition-colors"
            >
              Skip tour
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// Brand Comparison Page
function ComparisonPage({ results, onBack }) {
  const [selectedBrands, setSelectedBrands] = useState([]);
  const [filterIndustry, setFilterIndustry] = useState('all');
  const [filterBusinessModel, setFilterBusinessModel] = useState('all');
  const [viewMode, setViewMode] = useState('brands'); // 'brands' or 'industry'
  const maxComparison = 6;

  const industries = [
    { id: 'all', name: 'All Industries' },
    ...INDUSTRIES
  ];

  const businessModels = [
    { id: 'all', name: 'All Models' },
    { id: 'b2b', name: 'B2B' },
    { id: 'b2c', name: 'B2C' },
    { id: 'b2b2c', name: 'B2B2C' },
  ];

  // Filter results
  const filteredResults = results.filter(r => {
    if (filterIndustry !== 'all' && r.industry !== filterIndustry) return false;
    if (filterBusinessModel !== 'all' && r.businessModel !== filterBusinessModel) return false;
    return true;
  });

  // Get unique industries with data
  const industriesWithData = [...new Set(results.map(r => r.industry).filter(Boolean))];

  // Calculate industry benchmarks
  const getIndustryBenchmarks = () => {
    const benchmarks = {};
    industriesWithData.forEach(industry => {
      const industryBrands = results.filter(r => r.industry === industry);
      if (industryBrands.length > 0) {
        const avgScore = Math.round(industryBrands.reduce((sum, b) => sum + b.totalScore, 0) / industryBrands.length);
        const attrAvgs = {};
        ATTRIBUTES.forEach(attr => {
          attrAvgs[attr.id] = Math.round(
            industryBrands.reduce((sum, b) => sum + (b.scores?.[attr.id] || 0), 0) / industryBrands.length
          );
        });
        benchmarks[industry] = {
          avgScore,
          attrAvgs,
          count: industryBrands.length,
          industryName: industries.find(i => i.id === industry)?.name || industry,
        };
      }
    });
    return benchmarks;
  };

  const industryBenchmarks = getIndustryBenchmarks();

  const toggleBrand = (brand) => {
    if (selectedBrands.find(b => b.id === brand.id)) {
      setSelectedBrands(selectedBrands.filter(b => b.id !== brand.id));
    } else if (selectedBrands.length < maxComparison) {
      setSelectedBrands([...selectedBrands, brand]);
    }
  };

  const selectAllInIndustry = (industry) => {
    const industryBrands = results.filter(r => r.industry === industry).slice(0, maxComparison);
    setSelectedBrands(industryBrands);
  };

  const exportComparison = () => {
    if (viewMode === 'brands' && selectedBrands.length < 2) {
      alert('Select at least 2 brands to export comparison');
      return;
    }
    
    if (viewMode === 'brands') {
      const headers = ['Attribute', ...selectedBrands.map(b => b.brandName)];
      const rows = ATTRIBUTES.map(attr => [
        attr.name,
        ...selectedBrands.map(b => b.scores?.[attr.id] || 0)
      ]);
      rows.unshift(['Overall Score', ...selectedBrands.map(b => b.totalScore)]);
      rows.push(['Maturity Level', ...selectedBrands.map(b => b.maturityLevel)]);
      
      const csv = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `brand-comparison-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
    } else {
      // Export industry benchmarks
      const benchmarkEntries = Object.entries(industryBenchmarks);
      if (benchmarkEntries.length === 0) {
        alert('No industry data to export');
        return;
      }
      const headers = ['Attribute', ...benchmarkEntries.map(([, b]) => `${b.industryName} (n=${b.count})`)];
      const rows = ATTRIBUTES.map(attr => [
        attr.name,
        ...benchmarkEntries.map(([, b]) => b.attrAvgs[attr.id])
      ]);
      rows.unshift(['Average Score', ...benchmarkEntries.map(([, b]) => b.avgScore)]);
      
      const csv = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `industry-benchmarks-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F4F0]">
      <div className="max-w-7xl mx-auto p-4 md:p-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
          <div className="flex items-center gap-4">
            <button onClick={onBack} className="btn-secondary flex items-center gap-2">
              <ArrowLeft className="w-4 h-4" /> Back
            </button>
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-[#1A1A1A]">Compare</h1>
              <p className="text-sm text-[#666666]">Compare brands or view industry benchmarks</p>
            </div>
          </div>
          <button 
            onClick={exportComparison} 
            disabled={viewMode === 'brands' ? selectedBrands.length < 2 : Object.keys(industryBenchmarks).length === 0}
            className="btn-primary flex items-center gap-2"
          >
            <Download className="w-4 h-4" /> Export {viewMode === 'brands' ? 'Comparison' : 'Benchmarks'}
          </button>
        </div>

        {/* View Mode Toggle */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setViewMode('brands')}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              viewMode === 'brands' 
                ? 'bg-[#1A1A1A] text-white' 
                : 'bg-white border border-[#D9D6D0] text-[#666666] hover:border-[#1A1A1A]'
            }`}
          >
            Compare Brands
          </button>
          <button
            onClick={() => setViewMode('industry')}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              viewMode === 'industry' 
                ? 'bg-[#1A1A1A] text-white' 
                : 'bg-white border border-[#D9D6D0] text-[#666666] hover:border-[#1A1A1A]'
            }`}
          >
            Industry Benchmarks
          </button>
        </div>

        {results.length === 0 ? (
          <div className="card p-12 text-center">
            <BarChart3 className="w-16 h-16 text-[#D9D6D0] mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-[#1A1A1A] mb-2">No Results to Compare</h3>
            <p className="text-[#666666]">Complete some assessments first to compare brands.</p>
          </div>
        ) : viewMode === 'industry' ? (
          /* Industry Benchmarks View */
          <div className="space-y-6">
            {Object.keys(industryBenchmarks).length === 0 ? (
              <div className="card p-12 text-center">
                <BarChart3 className="w-16 h-16 text-[#D9D6D0] mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-[#1A1A1A] mb-2">No Industry Data</h3>
                <p className="text-[#666666]">Add industry information to your assessments to see benchmarks.</p>
              </div>
            ) : (
              <>
                {/* Industry Overview */}
                <div className="card p-6">
                  <h3 className="font-semibold text-[#1A1A1A] mb-4">Industry Average Scores</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    {Object.entries(industryBenchmarks).map(([industry, data]) => {
                      const stage = getMaturityStage(data.avgScore);
                      return (
                        <div key={industry} className="text-center p-4 bg-[#F0EEEA] rounded-lg">
                          <div 
                            className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-2 text-white font-bold text-xl"
                            style={{ backgroundColor: stage.color }}
                          >
                            {data.avgScore}
                          </div>
                          <div className="font-medium text-sm text-[#1A1A1A]">{data.industryName}</div>
                          <div className="text-xs text-[#666666]">{data.count} brand{data.count !== 1 ? 's' : ''}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Industry Attribute Comparison */}
                <div className="card p-6">
                  <h3 className="font-semibold text-[#1A1A1A] mb-4">Attribute Comparison by Industry</h3>
                  
                  {/* Industry labels header */}
                  <div className="flex items-center gap-2 mb-4 text-xs text-[#666666]">
                    <div className="w-24 flex-shrink-0"></div>
                    <div className="flex-1 flex gap-1">
                      {Object.entries(industryBenchmarks).map(([industry, data]) => (
                        <div key={industry} className="flex-1 truncate text-center">{data.industryName}</div>
                      ))}
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    {ATTRIBUTES.map((attr) => (
                      <div key={attr.id} className="flex items-center gap-2">
                        <div className="w-24 flex-shrink-0 flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: attr.color }} />
                          <span className="text-xs font-medium text-[#1A1A1A] truncate">{attr.name}</span>
                        </div>
                        <div className="flex-1 flex gap-1">
                          {Object.entries(industryBenchmarks).map(([industry, data]) => (
                            <div key={industry} className="flex-1 relative">
                              <div className="h-4 bg-[#E8E6E1] rounded overflow-hidden">
                                <div 
                                  className="h-full rounded transition-all duration-500"
                                  style={{ width: `${data.attrAvgs[attr.id]}%`, backgroundColor: attr.color }}
                                />
                              </div>
                              <div className="absolute inset-0 flex items-center justify-center text-[10px] font-medium text-white mix-blend-difference">
                                {data.attrAvgs[attr.id]}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        ) : (
          /* Brand Comparison View */
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Brand Selection with Filters */}
            <div className="lg:col-span-1 space-y-4">
              {/* Filters */}
              <div className="card p-4">
                <h3 className="font-semibold text-[#1A1A1A] mb-3">Filters</h3>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-[#666666] mb-1 block">Industry</label>
                    <select
                      value={filterIndustry}
                      onChange={(e) => setFilterIndustry(e.target.value)}
                      className="w-full px-3 py-2 border border-[#D9D6D0] rounded text-sm"
                    >
                      {industries.map(ind => (
                        <option key={ind.id} value={ind.id}>{ind.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-[#666666] mb-1 block">Business Model</label>
                    <select
                      value={filterBusinessModel}
                      onChange={(e) => setFilterBusinessModel(e.target.value)}
                      className="w-full px-3 py-2 border border-[#D9D6D0] rounded text-sm"
                    >
                      {businessModels.map(bm => (
                        <option key={bm.id} value={bm.id}>{bm.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
                
                {/* Quick select by industry */}
                {industriesWithData.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-[#E8E6E1]">
                    <label className="text-xs text-[#666666] mb-2 block">Quick Select Industry</label>
                    <div className="flex flex-wrap gap-1">
                      {industriesWithData.slice(0, 5).map(industry => (
                        <button
                          key={industry}
                          onClick={() => selectAllInIndustry(industry)}
                          className="text-xs px-2 py-1 bg-[#F0EEEA] hover:bg-[#E8E6E1] rounded transition-colors"
                        >
                          {industries.find(i => i.id === industry)?.name || industry}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Brand List */}
              <div className="card p-4">
                <h3 className="font-semibold text-[#1A1A1A] mb-4">
                  Select Brands ({selectedBrands.length}/{maxComparison})
                  {filteredResults.length !== results.length && (
                    <span className="text-xs font-normal text-[#666666] ml-2">
                      Showing {filteredResults.length} of {results.length}
                    </span>
                  )}
                </h3>
                <div className="space-y-2 max-h-[50vh] overflow-y-auto">
                  {filteredResults.map((r) => {
                    const isSelected = selectedBrands.find(b => b.id === r.id);
                    const isDisabled = !isSelected && selectedBrands.length >= maxComparison;
                    return (
                      <button
                        key={r.id}
                        onClick={() => toggleBrand(r)}
                        disabled={isDisabled}
                        className={`w-full text-left p-3 rounded-lg border transition-colors ${
                          isSelected 
                            ? 'border-[#E53935] bg-[#E53935]/5' 
                            : isDisabled 
                              ? 'border-[#E8E6E1] bg-[#F5F4F0] opacity-50 cursor-not-allowed'
                              : 'border-[#D9D6D0] hover:border-[#E53935]/50'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="font-medium text-[#1A1A1A]">{r.brandName}</span>
                            <div className="text-xs text-[#666666]">
                              {r.industry && <span>{industries.find(i => i.id === r.industry)?.name || r.industry}</span>}
                              {r.industry && r.businessModel && <span> · </span>}
                              {r.businessModel && <span>{r.businessModel.toUpperCase()}</span>}
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="font-bold text-lg">{r.totalScore}</span>
                            <div className="text-xs text-[#666666]">{r.maturityLevel}</div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                  {filteredResults.length === 0 && (
                    <div className="text-center py-8 text-[#666666] text-sm">
                      No brands match the selected filters
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Comparison View */}
            <div className="lg:col-span-2">
              {selectedBrands.length < 2 ? (
                <div className="card p-12 text-center">
                  <Users className="w-16 h-16 text-[#D9D6D0] mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-[#1A1A1A] mb-2">Select Brands to Compare</h3>
                  <p className="text-[#666666]">Choose at least 2 brands from the list to see a comparison.</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Overall Score Comparison */}
                  <div className="card p-6">
                    <h3 className="font-semibold text-[#1A1A1A] mb-4">Overall Scores</h3>
                    <div className="flex flex-wrap justify-center gap-4">
                      {selectedBrands.map((brand) => {
                        const stage = MATURITY_STAGES.find(s => s.name === brand.maturityLevel) || MATURITY_STAGES[0];
                        return (
                          <div key={brand.id} className="text-center">
                            <div 
                              className="w-16 h-16 md:w-20 md:h-20 rounded-full flex items-center justify-center mx-auto mb-2 text-white font-bold text-xl md:text-2xl"
                              style={{ backgroundColor: stage.color }}
                            >
                              {brand.totalScore}
                            </div>
                            <div className="font-medium text-xs md:text-sm text-[#1A1A1A] truncate max-w-[100px]">{brand.brandName}</div>
                            <div className="text-xs text-[#666666]">{brand.maturityLevel}</div>
                          </div>
                        );
                      })}
                      {/* Average Score */}
                      <div className="text-center border-l-2 border-[#D9D6D0] pl-4">
                        <div 
                          className="w-16 h-16 md:w-20 md:h-20 rounded-full flex items-center justify-center mx-auto mb-2 text-white font-bold text-xl md:text-2xl bg-[#1A1A1A]"
                        >
                          {Math.round(selectedBrands.reduce((sum, b) => sum + b.totalScore, 0) / selectedBrands.length)}
                        </div>
                        <div className="font-medium text-xs md:text-sm text-[#1A1A1A]">AVERAGE</div>
                        <div className="text-xs text-[#666666]">{selectedBrands.length} brands</div>
                      </div>
                    </div>
                  </div>

                  {/* Attribute Comparison */}
                  <div className="card p-6">
                    <h3 className="font-semibold text-[#1A1A1A] mb-4">Attribute Comparison</h3>
                    
                    {/* Brand labels header */}
                    <div className="flex items-center gap-2 mb-4 text-xs text-[#666666]">
                      <div className="w-24 flex-shrink-0"></div>
                      <div className="flex-1 flex gap-1">
                        {selectedBrands.map((brand) => (
                          <div key={brand.id} className="flex-1 truncate text-center">{brand.brandName}</div>
                        ))}
                        <div className="flex-1 text-center font-medium text-[#1A1A1A]">AVG</div>
                      </div>
                    </div>
                    
                    <div className="space-y-3">
                      {ATTRIBUTES.map((attr) => {
                        const avgScore = Math.round(selectedBrands.reduce((sum, b) => sum + (b.scores?.[attr.id] || 0), 0) / selectedBrands.length);
                        return (
                          <div key={attr.id} className="flex items-center gap-2">
                            <div className="w-24 flex-shrink-0 flex items-center gap-2">
                              <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: attr.color }} />
                              <span className="text-xs font-medium text-[#1A1A1A] truncate">{attr.name}</span>
                            </div>
                            <div className="flex-1 flex gap-1">
                              {selectedBrands.map((brand) => {
                                const score = brand.scores?.[attr.id] || 0;
                                return (
                                  <div key={brand.id} className="flex-1 relative">
                                    <div className="h-4 bg-[#E8E6E1] rounded overflow-hidden">
                                      <div 
                                        className="h-full rounded transition-all duration-500"
                                        style={{ width: `${score}%`, backgroundColor: attr.color }}
                                      />
                                    </div>
                                    <div className="absolute inset-0 flex items-center justify-center text-[10px] font-medium text-white mix-blend-difference">
                                      {score}
                                    </div>
                                  </div>
                                );
                              })}
                              {/* Average bar */}
                              <div className="flex-1 relative">
                                <div className="h-4 bg-[#E8E6E1] rounded overflow-hidden">
                                  <div 
                                    className="h-full rounded transition-all duration-500 bg-[#1A1A1A]"
                                    style={{ width: `${avgScore}%` }}
                                  />
                                </div>
                                <div className="absolute inset-0 flex items-center justify-center text-[10px] font-medium text-white mix-blend-difference">
                                  {avgScore}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Quick Insights */}
                  <div className="card p-6">
                    <h3 className="font-semibold text-[#1A1A1A] mb-4">Quick Insights</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      <div className="bg-[#F0EEEA] rounded-lg p-4">
                        <div className="font-medium text-[#1A1A1A] mb-2">Highest Overall Score</div>
                        <div className="text-[#E53935] font-bold">
                          {selectedBrands.reduce((a, b) => a.totalScore > b.totalScore ? a : b).brandName}
                          <span className="text-[#666666] font-normal ml-2">
                            ({selectedBrands.reduce((a, b) => a.totalScore > b.totalScore ? a : b).totalScore})
                          </span>
                        </div>
                      </div>
                      <div className="bg-[#F0EEEA] rounded-lg p-4">
                        <div className="font-medium text-[#1A1A1A] mb-2">Largest Gap</div>
                        {(() => {
                          let maxGap = 0;
                          let gapAttr = ATTRIBUTES[0];
                          ATTRIBUTES.forEach(attr => {
                            const scores = selectedBrands.map(b => b.scores?.[attr.id] || 0);
                            const gap = Math.max(...scores) - Math.min(...scores);
                            if (gap > maxGap) {
                              maxGap = gap;
                              gapAttr = attr;
                            }
                          });
                          return (
                            <div className="text-[#E53935] font-bold">
                              {gapAttr.name}
                              <span className="text-[#666666] font-normal ml-2">({maxGap} points)</span>
                            </div>
                          );
                        })()}
                      </div>
                      <div className="bg-[#F0EEEA] rounded-lg p-4">
                        <div className="font-medium text-[#1A1A1A] mb-2">Strongest Attribute (Avg)</div>
                        {(() => {
                          let maxAvg = 0;
                          let strongAttr = ATTRIBUTES[0];
                          ATTRIBUTES.forEach(attr => {
                            const avg = selectedBrands.reduce((sum, b) => sum + (b.scores?.[attr.id] || 0), 0) / selectedBrands.length;
                            if (avg > maxAvg) {
                              maxAvg = avg;
                              strongAttr = attr;
                            }
                          });
                          return (
                            <div className="text-[#E53935] font-bold">
                              {strongAttr.name}
                              <span className="text-[#666666] font-normal ml-2">({Math.round(maxAvg)} avg)</span>
                            </div>
                          );
                        })()}
                      </div>
                      <div className="bg-[#F0EEEA] rounded-lg p-4">
                        <div className="font-medium text-[#1A1A1A] mb-2">Weakest Attribute (Avg)</div>
                        {(() => {
                          let minAvg = 100;
                          let weakAttr = ATTRIBUTES[0];
                          ATTRIBUTES.forEach(attr => {
                            const avg = selectedBrands.reduce((sum, b) => sum + (b.scores?.[attr.id] || 0), 0) / selectedBrands.length;
                            if (avg < minAvg) {
                              minAvg = avg;
                              weakAttr = attr;
                            }
                          });
                          return (
                            <div className="text-[#E53935] font-bold">
                              {weakAttr.name}
                              <span className="text-[#666666] font-normal ml-2">({Math.round(minAvg)} avg)</span>
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Assessment Status Indicator - shows completion status for each assessment area
function AssessmentStatusIndicator({ assessments }) {
  const getStatus = (assessment, type) => {
    if (type === 'website') {
      const hasContent = assessment.content || assessment.images?.length > 0;
      const hasExtra = assessment.pagesReviewed || assessment.websiteContent || assessment.seoAssessment;
      if (hasContent && hasExtra) return 'complete';
      if (hasContent || hasExtra) return 'partial';
      return 'empty';
    }
    if (type === 'social') {
      const fields = [assessment.linkedinAbout, assessment.linkedinPosts, assessment.xContent, 
                      assessment.instagramContent, assessment.youtubeContent, assessment.redditContent,
                      assessment.wikipediaContent, assessment.glassdoorContent];
      const filled = fields.filter(Boolean).length;
      if (assessment.content && filled >= 3) return 'complete';
      if (assessment.content || filled > 0) return 'partial';
      return 'empty';
    }
    if (type === 'aiReputation') {
      const hasContent = assessment.content;
      if (hasContent) return 'complete';
      return 'empty';
    }
    if (type === 'earnedMedia') {
      const hasContent = assessment.content || assessment.coveragePaste;
      if (hasContent) return 'complete';
      return 'empty';
    }
    return 'empty';
  };

  const statuses = {
    website: getStatus(assessments.website, 'website'),
    social: getStatus(assessments.social, 'social'),
    aiReputation: getStatus(assessments.aiReputation, 'aiReputation'),
    earnedMedia: getStatus(assessments.earnedMedia, 'earnedMedia'),
  };

  return (
    <div className="flex items-center gap-1">
      {Object.entries(statuses).map(([key, status]) => (
        <div 
          key={key}
          className={`w-2 h-2 rounded-full ${
            status === 'complete' ? 'bg-green-500' : 
            status === 'partial' ? 'bg-yellow-500' : 
            'bg-[#D9D6D0]'
          }`}
          title={`${key}: ${status}`}
        />
      ))}
    </div>
  );
}

// Saved Assessments Modal
// Saved Assessments Page
function SavedAssessmentsPage({ assessments, onLoad, onDelete, onBack, onImport, onExport, onShare, onRescore }) {
  const fileInputRef = useRef(null);

  const handleFileImport = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target.result);
        if (data.project && data.scores) {
          onImport(data);
        } else {
          alert('Invalid assessment file format');
        }
      } catch (err) {
        alert('Error reading file: ' + err.message);
      }
    };
    reader.readAsText(file);
    e.target.value = ''; // Reset input
  };

  return (
    <div className="max-w-4xl mx-auto p-8 animate-fade-in">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-3xl font-bold text-[#1A1A1A]">Saved Assessments</h2>
          <p className="text-[#666666]">Up to 15 assessments stored locally in your browser</p>
        </div>
        <div className="flex gap-2">
          <input type="file" ref={fileInputRef} onChange={handleFileImport} accept=".json" className="hidden" />
          <button onClick={() => fileInputRef.current?.click()} className="btn-secondary flex items-center gap-2">
            <Upload className="w-4 h-4" /> Import
          </button>
          <button onClick={onBack} className="btn-secondary flex items-center gap-2">
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
        </div>
      </div>

      {/* Info Card */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <p className="text-sm text-blue-800">
          <strong>Sharing tip:</strong> Assessments are stored in your browser only. To share with others, use the <strong>Export</strong> button to download a JSON file, or <strong>Share</strong> to copy a link they can view.
        </p>
      </div>

      {assessments.length === 0 ? (
        <div className="card p-12 text-center">
          <FileText className="w-12 h-12 text-[#D9D6D0] mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-[#1A1A1A] mb-2">No Saved Assessments</h3>
          <p className="text-[#666666] mb-4">Complete an assessment and click Save to store it here.</p>
          <p className="text-sm text-[#9CA3AF]">Or import a previously exported assessment using the Import button above.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {assessments.map((a, i) => {
            const overallScore = a.scores ? Math.round(
              Object.entries(a.scores)
                .filter(([key, val]) => val && typeof val.score === 'number')
                .reduce((sum, [, v]) => sum + v.score, 0) / 8
            ) : null;
            return (
              <div key={i} className="card p-5 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    {overallScore !== null && (
                      <div className="w-14 h-14 rounded-xl bg-[#E53935]/10 flex items-center justify-center">
                        <span className="text-xl font-bold text-[#E53935]">{overallScore}</span>
                      </div>
                    )}
                    <div>
                      <h4 className="font-semibold text-[#1A1A1A] text-lg">{a.project.brandName}</h4>
                      <div className="flex items-center gap-3 text-sm text-[#666666]">
                        <span>{a.project.date || 'No date'}</span>
                        {a.project.industry && a.project.industry !== 'other' && (
                          <>
                            <span className="w-1 h-1 rounded-full bg-[#666666]"></span>
                            <span>{INDUSTRIES.find(ind => ind.id === a.project.industry)?.name || a.project.industry}</span>
                          </>
                        )}
                        {overallScore !== null && (
                          <>
                            <span className="w-1 h-1 rounded-full bg-[#666666]"></span>
                            <span>{getMaturityStage(overallScore).name}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => onShare(a)} className="text-[#666666] hover:text-[#E53935] hover:bg-[#E53935]/10 p-2 rounded-lg transition-colors" title="Share Link">
                      <Share2 className="w-4 h-4" />
                    </button>
                    <button onClick={() => onExport(a)} className="text-[#666666] hover:text-[#1A1A1A] hover:bg-gray-100 p-2 rounded-lg transition-colors" title="Export JSON">
                      <Download className="w-4 h-4" />
                    </button>
                    <button onClick={() => onRescore(a)} className="btn-secondary text-sm py-2 px-4" title="Regenerate scores using current rubric">Rescore</button>
                    <button onClick={() => onLoad(a)} className="btn-primary text-sm py-2 px-4">Load</button>
                    <button onClick={() => onDelete(i)} className="text-red-500 hover:text-red-700 hover:bg-red-50 p-2 rounded-lg transition-colors" title="Delete">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p className="text-center text-sm text-[#9CA3AF] mt-8">
        {assessments.length}/15 assessment slots used
      </p>
    </div>
  );
}

// Shared Report View (read-only view for shared links)
function SharedReportView({ report, onClose }) {
  const { project, scores } = report;
  const overall = Math.round(
    Object.entries(scores)
      .filter(([key, val]) => val && typeof val.score === 'number')
      .reduce((a, [, v]) => a + v.score, 0) / 8
  );
  const stage = getMaturityStage(overall);
  const industryName = INDUSTRIES.find(i => i.id === project.industry)?.name || 'Other';
  const sortedAttrs = ATTRIBUTES.map(a => ({ ...a, score: scores[a.id]?.score || 0 })).sort((a, b) => a.score - b.score);

  // Generate recommendations for shared view
  const recommendations = [];
  let attrIndex = 0;
  let recIndex = 0;
  while (recommendations.length < 12 && attrIndex < sortedAttrs.length) {
    const attr = sortedAttrs[attrIndex];
    const attrRecs = SERVICE_RECOMMENDATIONS[attr.id] || [];
    if (recIndex < attrRecs.length) {
      const rec = attrRecs[recIndex];
      recommendations.push({ 
        attr: attr.name, 
        attrId: attr.id, 
        title: rec.title,
        description: rec.description,
        impact: rec.impact,
        attributes: rec.attributes,
        score: attr.score 
      });
      recIndex++;
    } else {
      attrIndex++;
      recIndex = 0;
    }
  }

  return (
    <div className="min-h-screen bg-[#E8E6E1]">
      {/* Header */}
      <header className="bg-[#E8E6E1] border-b border-[#D9D6D0] py-5 px-6">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <img src="https://ktuyiikwhspwmzvyczit.supabase.co/storage/v1/object/public/assets/brand/antenna-new-logo.svg" alt="Antenna Group" className="h-8" style={{ filter: 'brightness(0)' }} />
            <div className="h-6 w-px bg-[#1A1A1A]" />
            <span className="text-lg font-semibold text-[#1A1A1A]">Conscious Compass</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-[#666666] bg-[#F0EEEA] px-3 py-1 rounded-full">Shared Report (Read-only)</span>
            <button onClick={onClose} className="btn-secondary text-sm">
              Start New Assessment
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto p-8 animate-fade-in">
        {/* Report Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-[#1A1A1A] mb-2">Brand Consciousness Report</h1>
          <p className="text-xl text-[#333333]">{project.brandName}</p>
          <p className="text-sm text-[#666666] mt-2">{industryName} | {project.businessModel?.toUpperCase() || 'B2B'} | {project.date || 'No date'}</p>
        </div>

        {/* Overall Score */}
        <div className="card p-8 mb-8 text-center bg-gradient-to-br from-[#E53935]/5 to-[#E53935]/10">
          <div className="inline-flex items-center justify-center w-32 h-32 rounded-full bg-[#E53935] text-white mb-4">
            <span className="text-5xl font-bold">{overall}</span>
          </div>
          <h2 className="text-2xl font-bold text-[#1A1A1A] mb-2">{stage.name}</h2>
          <p className="text-[#333333]">{stage.description}</p>
        </div>

        {/* Spider Chart */}
        <div className="card p-6 mb-8">
          <h3 className="text-lg font-semibold text-[#1A1A1A] mb-4 text-center">Brand Consciousness Profile</h3>
          <SpiderChart scores={scores} size={450} />
        </div>

        {/* Executive Summary */}
        <div className="card p-6 mb-6">
          <h3 className="text-lg font-semibold text-[#1A1A1A] mb-4">EXECUTIVE SUMMARY</h3>
          <p className="text-[#333333] leading-relaxed">
            {project.brandName} achieved an overall Brand Consciousness Score of <strong>{overall}/100</strong>, placing them in the "<strong>{stage.name}</strong>" maturity stage. The assessment evaluated the brand across 8 key consciousness attributes. Key strengths emerged in {sortedAttrs.slice(-2).map(a => a.name).join(' and ')}, while opportunities for growth were identified in {sortedAttrs.slice(0, 2).map(a => a.name).join(' and ')}.
          </p>
        </div>

        {/* Score Summary */}
        <div className="card p-6 mb-6">
          <h3 className="text-lg font-semibold text-[#1A1A1A] mb-4">SCORE SUMMARY</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {ATTRIBUTES.map(attr => (
              <div key={attr.id} className="text-center p-3 bg-[#F0EEEA] rounded-lg">
                <div className="text-2xl font-bold" style={{ color: attr.color }}>{scores[attr.id]?.score || 0}</div>
                <div className="text-xs text-[#666666] mt-1">{attr.name}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Maturity Continuum */}
        <MaturityContinuum score={overall} />

        {/* Maturity Stage Context */}
        <div className="card p-6 mb-6">
          <h3 className="text-lg font-semibold text-[#1A1A1A] mb-4">MATURITY STAGE CONTEXT</h3>
          <p className="text-[#333333] leading-relaxed">
            With a score of {overall}/100, {project.brandName} is positioned in the "{stage.name}" stage of brand consciousness maturity. {stage.description}. Brands at this stage typically demonstrate {overall < 40 ? 'foundational elements but significant room for strategic development across multiple dimensions' : overall < 60 ? 'solid fundamentals with clear opportunities to elevate their market presence and differentiation' : overall < 80 ? 'strong brand awareness with potential to become true industry thought leaders' : 'exceptional consciousness and should focus on maintaining their position while innovating'}. The path forward involves targeted investment in the lowest-scoring attributes.
          </p>
        </div>

        {/* Attribute Analysis */}
        <h3 className="text-xl font-semibold text-[#1A1A1A] mt-8 mb-4">ATTRIBUTE ANALYSIS</h3>
        <div className="space-y-4 mb-8">
          {ATTRIBUTES.map(attr => (
            <div key={attr.id} className="card p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-lg flex items-center justify-center text-white font-bold text-lg" style={{ backgroundColor: attr.color }}>
                    {scores[attr.id]?.score || 0}
                  </div>
                  <div>
                    <h4 className="font-bold text-[#1A1A1A]">{attr.name}</h4>
                    <p className="text-sm text-[#666666]">{attr.fullName}</p>
                  </div>
                </div>
              </div>
              <p className="text-sm text-[#333333] mb-2">{scores[attr.id]?.findings || scores[attr.id]?.summary || attr.description}</p>
              {scores[attr.id]?.opportunity && (
                <p className="text-sm text-[#E53935] italic">{scores[attr.id].opportunity}</p>
              )}
            </div>
          ))}
        </div>

        {/* Recommendations */}
        <h3 className="text-xl font-semibold text-[#1A1A1A] mb-4">INTEGRATED MARKETING RECOMMENDATIONS</h3>
        <p className="text-[#666666] mb-4">Based on the assessment, here are 12 priority recommendations to enhance brand consciousness:</p>
        <div className="space-y-4 mb-6">
          {recommendations.map((r, i) => (
            <div key={i} className="card p-5">
              <div className="flex items-start gap-4">
                <div className="w-8 h-8 rounded-full bg-[#E53935] text-white flex items-center justify-center font-bold text-sm flex-shrink-0">{i + 1}</div>
                <div className="flex-1">
                  <h4 className="font-semibold text-[#1A1A1A] mb-2">{r.title}</h4>
                  <p className="text-sm text-[#333333] leading-relaxed mb-2">
                    {r.description} {r.impact}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {r.attributes.map((attr, j) => (
                      <span key={j} className="text-xs px-2 py-1 bg-[#E53935]/10 text-[#E53935] rounded-full font-medium">{attr}</span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Conclusions */}
        <div className="card p-6 mb-6">
          <h3 className="text-lg font-semibold text-[#1A1A1A] mb-4">CONCLUSIONS</h3>
          <p className="text-[#333333] leading-relaxed">
            {project.brandName} has demonstrated {overall >= 60 ? 'strong potential' : 'a foundation'} for building an impactful, conscious brand presence. By focusing on the recommendations outlined above, particularly strengthening {sortedAttrs[0].name} and {sortedAttrs[1].name} capabilities, the brand can elevate its market position and create deeper connections with its audience. The journey toward greater brand consciousness is ongoing, and with strategic focus, {project.brandName} is well positioned to become a more consequential presence in its industry.
          </p>
        </div>

        {/* Footer */}
        <div className="text-center pt-8 border-t border-[#D9D6D0]">
          <p className="text-sm text-[#9CA3AF]">
            This report was generated using Antenna Group's Brand Consciousness Framework v2.3
          </p>
          <p className="text-xs text-[#9CA3AF] mt-2">
            Shared on {report.sharedAt ? new Date(report.sharedAt).toLocaleDateString() : 'Unknown date'}
          </p>
        </div>
      </div>
    </div>
  );
}

// Main App
export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('conscious-compass-apikey') || DEFAULT_API_KEY);
  const [project, setProject] = useState({
    brandName: '', websiteUrl: '', 
    businessModel: 'b2b', industry: 'other', date: new Date().toISOString().split('T')[0]
  });
  const [assessments, setAssessments] = useState({
    website: { status: 'pending', content: '', observations: '', images: [], pagesReviewed: '', websiteContent: '', seoAssessment: '' },
    social: { status: 'pending', content: '', observations: '', linkedinUrl: '', linkedinAbout: '', linkedinPosts: '', linkedinArticles: '', xUrl: '', xContent: '', instagramContent: '', youtubeContent: '', hasYouTube: true, redditContent: '', wikipediaContent: '', glassdoorContent: '', nextdoorContent: '', wipoContent: '', socialImages: [], instagramImages: [] },
    aiReputation: { status: 'pending', content: '', observations: '', responses: {} },
    earnedMedia: { status: 'pending', content: '', observations: '', coveragePaste: '' },
  });
  const [scores, setScores] = useState(null);
  const [showSavedPage, setShowSavedPage] = useState(false);
  const [showResultsPage, setShowResultsPage] = useState(false);
  const [showComparisonPage, setShowComparisonPage] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(0);
  const [savedAssessments, setSavedAssessments] = useState([]);
  const [compassResults, setCompassResults] = useState([]);
  const [sharedReport, setSharedReport] = useState(null); // For viewing shared reports
  const [lastAutoSave, setLastAutoSave] = useState(null);

  // Persist API key to localStorage whenever it changes
  useEffect(() => {
    if (apiKey) {
      localStorage.setItem('conscious-compass-apikey', apiKey);
    }
  }, [apiKey]);

  // Auto-save draft every 30 seconds if there's data
  useEffect(() => {
    const autoSaveInterval = setInterval(() => {
      if (project.brandName && currentStep > 0) {
        const draft = { project, assessments, currentStep, savedAt: new Date().toISOString() };
        localStorage.setItem('conscious-compass-draft', JSON.stringify(draft));
        setLastAutoSave(new Date());
      }
    }, 30000);
    return () => clearInterval(autoSaveInterval);
  }, [project, assessments, currentStep]);

  // Load draft on mount if exists
  useEffect(() => {
    // Check if already authenticated
    if (localStorage.getItem('conscious-compass-auth') === 'true') {
      setIsAuthenticated(true);
    }
    setSavedAssessments(JSON.parse(localStorage.getItem('conscious-compass-saved') || '[]'));
    setCompassResults(JSON.parse(localStorage.getItem('conscious-compass-results') || '[]'));
    
    // Check for draft
    const draft = localStorage.getItem('conscious-compass-draft');
    if (draft) {
      const parsed = JSON.parse(draft);
      const draftAge = Date.now() - new Date(parsed.savedAt).getTime();
      // Only restore drafts less than 24 hours old
      if (draftAge < 24 * 60 * 60 * 1000 && parsed.project?.brandName) {
        if (confirm(`Resume your draft assessment for "${parsed.project.brandName}"?`)) {
          setProject(parsed.project);
          setAssessments(parsed.assessments);
          setCurrentStep(parsed.currentStep);
        } else {
          localStorage.removeItem('conscious-compass-draft');
        }
      }
    }
    
    // Check for first time user
    if (!localStorage.getItem('conscious-compass-onboarded')) {
      setShowOnboarding(true);
    }
    
    // Check for shared report in URL
    const urlParams = new URLSearchParams(window.location.search);
    const sharedData = urlParams.get('report');
    if (sharedData) {
      try {
        const decoded = JSON.parse(atob(sharedData));
        if (decoded.project && decoded.scores) {
          setSharedReport(decoded);
        }
      } catch (err) {
        console.error('Failed to parse shared report:', err);
      }
    }
  }, []);

  const steps = [
    { id: 'setup', name: 'Setup' },
    { id: 'website', name: 'Website' },
    { id: 'social', name: 'Social' },
    { id: 'ai', name: 'AI Rep' },
    { id: 'earned', name: 'Earned' },
    { id: 'report', name: 'Report' },
  ];

  const handleNewAssessment = () => {
    if (confirm('Start a new assessment? Current progress will be lost unless saved.')) {
      setCurrentStep(0);
      setShowSavedPage(false);
      setProject({ brandName: '', websiteUrl: '', businessModel: 'b2b', industry: 'other', date: new Date().toISOString().split('T')[0] });
      setAssessments({
        website: { status: 'pending', content: '', observations: '', images: [], pagesReviewed: '', websiteContent: '', seoAssessment: '' },
        social: { status: 'pending', content: '', observations: '', linkedinUrl: '', linkedinAbout: '', linkedinPosts: '', linkedinArticles: '', xUrl: '', xContent: '', instagramContent: '', youtubeContent: '', hasYouTube: true, redditContent: '', wikipediaContent: '', glassdoorContent: '', nextdoorContent: '', wipoContent: '', socialImages: [], instagramImages: [] },
        aiReputation: { status: 'pending', content: '', observations: '', responses: {} },
        earnedMedia: { status: 'pending', content: '', observations: '', coveragePaste: '' },
      });
      setScores(null);
    }
  };

  const handleSave = () => {
    if (!project.brandName) {
      alert('Please enter a brand name before saving.');
      return;
    }
    try {
      let saved = JSON.parse(localStorage.getItem('conscious-compass-saved') || '[]');
      // Create a copy of assessments without large image data to reduce storage size
      const assessmentsToSave = {
        ...assessments,
        website: { ...assessments.website, images: [] }, // Exclude website screenshots
        social: { ...assessments.social, socialImages: [], instagramImages: [] }, // Exclude social images
      };
      const data = { project, assessments: assessmentsToSave, scores, savedAt: new Date().toISOString() };
      const idx = saved.findIndex(s => s.project.brandName === project.brandName);
      if (idx >= 0) {
        saved[idx] = data;
      } else {
        // Limit to 15 assessments
        if (saved.length >= 15) {
          saved = saved.slice(-14); // Keep most recent 14 to make room for new one
        }
        saved.push(data);
      }
      localStorage.setItem('conscious-compass-saved', JSON.stringify(saved));
      setSavedAssessments(saved);
      
      // Also save to compass results (summary only)
      if (scores) {
        const overall = Math.round(
          Object.entries(scores)
            .filter(([key, val]) => val && typeof val.score === 'number')
            .reduce((a, [, v]) => a + v.score, 0) / 8
        );
        const stage = getMaturityStage(overall);
        const serviceRecs = getAllRecommendations(scores);
        
        let results = JSON.parse(localStorage.getItem('conscious-compass-results') || '[]');
        const resultData = {
          id: `${project.brandName}-${Date.now()}`,
          brandName: project.brandName,
          businessModel: project.businessModel,
          industry: project.industry,
          totalScore: overall,
          maturityLevel: stage.name,
          scores: {
            AWAKE: scores.AWAKE?.score || 0,
            AWARE: scores.AWARE?.score || 0,
            REFLECTIVE: scores.REFLECTIVE?.score || 0,
            ATTENTIVE: scores.ATTENTIVE?.score || 0,
            COGENT: scores.COGENT?.score || 0,
            SENTIENT: scores.SENTIENT?.score || 0,
            VISIONARY: scores.VISIONARY?.score || 0,
            INTENTIONAL: scores.INTENTIONAL?.score || 0,
          },
          servicesRecommended: serviceRecs.slice(0, 6).map(r => r.service?.name || '').filter(Boolean),
          savedAt: new Date().toISOString(),
          isManual: false,
        };
        
        const resultIdx = results.findIndex(r => r.brandName === project.brandName && !r.isManual);
        if (resultIdx >= 0) {
          results[resultIdx] = resultData;
        } else {
          results.push(resultData);
        }
        localStorage.setItem('conscious-compass-results', JSON.stringify(results));
        setCompassResults(results);
      }
      
      alert('Assessment saved!');
    } catch (e) {
      console.error('Save failed:', e);
      alert('Save failed: ' + (e.message || 'Storage limit may have been exceeded. Try clearing old assessments.'));
    }
  };

  const handleLoad = (data) => {
    setProject(data.project);
    setAssessments(data.assessments);
    setScores(data.scores);
    setCurrentStep(data.scores ? 6 : 0);
    setShowSavedPage(false);
  };

  const handleRescore = (data) => {
    if (!apiKey) {
      const key = prompt('Please enter your Anthropic API key to regenerate scores:');
      if (!key) {
        alert('API key is required to regenerate scores.');
        return;
      }
      setApiKey(key);
    }
    setProject(data.project);
    setAssessments(data.assessments);
    setScores(null); // Clear existing scores so user can regenerate
    setCurrentStep(6); // Go to Report page (which now handles scoring)
    setShowSavedPage(false);
  };

  const handleDelete = (index) => {
    if (confirm('Delete this saved assessment?')) {
      const saved = JSON.parse(localStorage.getItem('conscious-compass-saved') || '[]');
      saved.splice(index, 1);
      localStorage.setItem('conscious-compass-saved', JSON.stringify(saved));
      setSavedAssessments(saved);
    }
  };

  const handleExport = (assessment) => {
    const dataStr = JSON.stringify(assessment, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${assessment.project.brandName.replace(/\s+/g, '_')}_assessment.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (data) => {
    let saved = JSON.parse(localStorage.getItem('conscious-compass-saved') || '[]');
    const idx = saved.findIndex(s => s.project.brandName === data.project.brandName);
    if (idx >= 0) {
      if (confirm(`An assessment for "${data.project.brandName}" already exists. Replace it?`)) {
        saved[idx] = { ...data, savedAt: new Date().toISOString() };
      } else {
        return;
      }
    } else {
      if (saved.length >= 15) {
        saved = saved.slice(-14);
      }
      saved.push({ ...data, savedAt: new Date().toISOString() });
    }
    localStorage.setItem('conscious-compass-saved', JSON.stringify(saved));
    setSavedAssessments(saved);
    alert(`Assessment for "${data.project.brandName}" imported successfully!`);
  };

  const handleShare = (assessment) => {
    // Create a minimal shareable version (just project info and scores, no raw assessment data)
    const shareData = {
      project: assessment.project,
      scores: assessment.scores,
      sharedAt: new Date().toISOString()
    };
    const encoded = btoa(JSON.stringify(shareData));
    const shareUrl = `${window.location.origin}${window.location.pathname}?report=${encoded}`;
    
    navigator.clipboard.writeText(shareUrl).then(() => {
      alert('Share link copied to clipboard!\n\nAnyone with this link can view the assessment report (read-only).');
    }).catch(() => {
      prompt('Copy this link to share:', shareUrl);
    });
  };

  const updateAssessment = (key, data) => setAssessments(prev => ({ ...prev, [key]: { ...prev[key], ...data } }));

  // Show password gate if not authenticated
  if (!isAuthenticated) {
    return <PasswordGate onSuccess={() => setIsAuthenticated(true)} />;
  }

  // Show shared report if accessed via share link
  if (sharedReport) {
    return <SharedReportView report={sharedReport} onClose={() => {
      setSharedReport(null);
      window.history.replaceState({}, '', window.location.pathname);
    }} />;
  }

  // Show comparison page
  if (showComparisonPage) {
    return (
      <div className="min-h-screen bg-[#E8E6E1]">
        <Header 
          onNewAssessment={handleNewAssessment} 
          onSavedAssessments={() => { setShowComparisonPage(false); setShowSavedPage(true); }}
          onCompassResults={() => { setShowComparisonPage(false); setShowResultsPage(true); }}
          onComparison={() => setShowComparisonPage(false)}
          lastAutoSave={lastAutoSave}
        />
        <ComparisonPage 
          results={compassResults}
          onBack={() => setShowComparisonPage(false)}
        />
      </div>
    );
  }

  // Show compass results page
  if (showResultsPage) {
    return (
      <div className="min-h-screen bg-[#E8E6E1]">
        <Header 
          onNewAssessment={handleNewAssessment} 
          onSavedAssessments={() => { setShowResultsPage(false); setShowSavedPage(true); }}
          onCompassResults={() => setShowResultsPage(false)}
          onComparison={() => { setShowResultsPage(false); setShowComparisonPage(true); }}
          lastAutoSave={lastAutoSave}
        />
        <CompassResultsPage 
          results={compassResults}
          onBack={() => setShowResultsPage(false)}
          onUpdateResults={setCompassResults}
        />
      </div>
    );
  }

  // Show saved assessments page
  if (showSavedPage) {
    return (
      <div className="min-h-screen bg-[#E8E6E1]">
        <Header 
          onNewAssessment={handleNewAssessment} 
          onSavedAssessments={() => setShowSavedPage(false)}
          onCompassResults={() => { setShowSavedPage(false); setShowResultsPage(true); }}
          onComparison={() => { setShowSavedPage(false); setShowComparisonPage(true); }}
          lastAutoSave={lastAutoSave}
        />
        <SavedAssessmentsPage 
          assessments={savedAssessments} 
          onLoad={handleLoad} 
          onDelete={handleDelete}
          onBack={() => setShowSavedPage(false)}
          onImport={handleImport}
          onExport={handleExport}
          onShare={handleShare}
          onRescore={handleRescore}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#E8E6E1]">
      {/* Onboarding Tour */}
      {showOnboarding && (
        <OnboardingTour onComplete={() => setShowOnboarding(false)} />
      )}
      
      <Header 
        onNewAssessment={handleNewAssessment} 
        onSavedAssessments={() => setShowSavedPage(true)}
        onCompassResults={() => setShowResultsPage(true)}
        onComparison={() => setShowComparisonPage(true)}
        lastAutoSave={lastAutoSave}
      />
      {currentStep > 0 && currentStep < 7 && <ProgressSteps currentStep={currentStep} steps={steps} assessments={assessments} />}

      {currentStep === 0 && <WelcomePage onStart={() => setCurrentStep(1)} />}
      {currentStep === 1 && <SetupPage project={project} setProject={setProject} apiKey={apiKey} setApiKey={setApiKey} onNext={() => setCurrentStep(2)} />}
      {currentStep === 2 && <WebsiteAssessment assessmentData={assessments.website} setAssessmentData={(d) => updateAssessment('website', d)} apiKey={apiKey} project={project} onPrev={() => setCurrentStep(1)} onNext={() => setCurrentStep(3)} onClearScores={() => setScores(null)} />}
      {currentStep === 3 && <SocialMediaAssessment assessmentData={assessments.social} setAssessmentData={(d) => updateAssessment('social', d)} apiKey={apiKey} project={project} onPrev={() => setCurrentStep(2)} onNext={() => setCurrentStep(4)} onClearScores={() => setScores(null)} />}
      {currentStep === 4 && <AIReputationPage assessmentData={assessments.aiReputation} setAssessmentData={(d) => updateAssessment('aiReputation', d)} apiKey={apiKey} project={project} onPrev={() => setCurrentStep(3)} onNext={() => setCurrentStep(5)} onClearScores={() => setScores(null)} />}
      {currentStep === 5 && <EarnedMediaAssessment assessmentData={assessments.earnedMedia} setAssessmentData={(d) => updateAssessment('earnedMedia', d)} apiKey={apiKey} project={project} onPrev={() => setCurrentStep(4)} onNext={() => setCurrentStep(6)} onClearScores={() => setScores(null)} />}
      {currentStep === 6 && <ReportPage project={project} scores={scores} setScores={setScores} assessments={assessments} apiKey={apiKey} onSave={handleSave} onShare={() => handleShare({ project, scores, assessments })} onPrev={() => setCurrentStep(5)} />}
    </div>
  );
}
