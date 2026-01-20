import { useState, useEffect, useRef } from 'react';
import { ATTRIBUTES, BUSINESS_MODELS, getMaturityStage, MATURITY_STAGES, SERVICE_RECOMMENDATIONS } from './data/rubric';
import { Compass, ArrowRight, ArrowLeft, Globe, Users, Bot, Newspaper, BarChart3, FileText, Play, Check, Loader2, ChevronDown, Download, Save, Plus, Trash2, X, Upload, Image, ExternalLink, Lock } from 'lucide-react';
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx';
import { saveAs } from 'file-saver';
import { jsPDF } from 'jspdf';

const DEFAULT_API_KEY = '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';

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
    <div className="min-h-screen bg-[#FAF8F5] flex items-center justify-center p-8">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-[#E85D3B]/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Lock className="w-8 h-8 text-[#E85D3B]" />
          </div>
          <h1 className="text-2xl font-bold text-[#1A1F2E] mb-2">Conscious Compass</h1>
          <p className="text-[#6B7280]">Enter password to access the assessment tool</p>
        </div>
        
        <form onSubmit={handleSubmit} className="card p-6">
          <div className="mb-4">
            <label className="block text-sm font-medium text-[#1A1F2E] mb-2">Password</label>
            <input 
              type="password" 
              value={password} 
              onChange={(e) => { setPassword(e.target.value); setError(false); }}
              placeholder="Enter password"
              className={`w-full px-4 py-3 border rounded-lg bg-white ${error ? 'border-red-500' : 'border-[#E8E4DE]'}`}
              autoFocus
            />
            {error && <p className="text-red-500 text-sm mt-2">Incorrect password</p>}
          </div>
          <button type="submit" className="btn-primary w-full">
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

async function callClaude(prompt, apiKey, primaryImage = null, additionalImages = []) {
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
  const center = size / 2;
  const radius = size * 0.38;
  const attrs = ATTRIBUTES;
  const angleStep = (2 * Math.PI) / attrs.length;
  
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
    <svg viewBox={`0 0 ${size} ${size}`} className="spider-chart w-full max-w-md mx-auto">
      {/* Grid circles */}
      {gridLevels.map(level => {
        const r = (level / 100) * radius;
        return (
          <circle key={level} cx={center} cy={center} r={r} fill="none" stroke="#E8E4DE" strokeWidth="1" />
        );
      })}
      
      {/* Axis lines */}
      {attrs.map((_, i) => {
        const angle = angleStep * i - Math.PI / 2;
        const x2 = center + radius * Math.cos(angle);
        const y2 = center + radius * Math.sin(angle);
        return <line key={i} x1={center} y1={center} x2={x2} y2={y2} stroke="#E8E4DE" strokeWidth="1" />;
      })}
      
      {/* Data polygon */}
      <path d={pathD} fill="rgba(232, 93, 59, 0.2)" stroke="#E85D3B" strokeWidth="2.5" />
      
      {/* Data points */}
      {dataPoints.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="6" fill="#E85D3B" stroke="white" strokeWidth="2" />
      ))}
      
      {/* Labels */}
      {attrs.map((attr, i) => {
        const angle = angleStep * i - Math.PI / 2;
        const labelRadius = radius + 35;
        const x = center + labelRadius * Math.cos(angle);
        const y = center + labelRadius * Math.sin(angle);
        return (
          <text key={attr.id} x={x} y={y} textAnchor="middle" dominantBaseline="middle" 
                className="text-xs font-medium fill-[#1A1F2E]">
            {attr.name}
          </text>
        );
      })}
      
      {/* Score labels */}
      {attrs.map((attr, i) => {
        const point = dataPoints[i];
        return (
          <text key={`score-${attr.id}`} x={point.x} y={point.y - 14} textAnchor="middle" 
                className="text-xs font-bold fill-[#E85D3B]">
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
      <h3 className="text-lg font-semibold text-[#1A1F2E] mb-4">Brand Consciousness Maturity</h3>
      
      {/* Scale */}
      <div className="relative mb-8">
        <div className="h-4 rounded-full maturity-scale" />
        
        {/* Marker */}
        <div 
          className="absolute top-0 transform -translate-x-1/2 transition-all duration-1000"
          style={{ left: `${percentage}%` }}
        >
          <div className="w-0 h-0 border-l-8 border-r-8 border-b-8 border-l-transparent border-r-transparent border-b-[#1A1F2E] -mt-2" />
          <div className="absolute top-6 left-1/2 transform -translate-x-1/2 bg-[#1A1F2E] text-white px-3 py-1 rounded-lg text-sm font-bold whitespace-nowrap">
            {score}/100
          </div>
        </div>
      </div>
      
      {/* Stage Labels */}
      <div className="flex justify-between text-xs text-[#6B7280] mb-4">
        {MATURITY_STAGES.map(s => (
          <div key={s.id} className="text-center" style={{ width: `${(s.max - s.min + 1)}%` }}>
            <div className="w-2 h-2 rounded-full mx-auto mb-1" style={{ backgroundColor: s.color }} />
            <span className={stage.id === s.id ? 'font-bold text-[#1A1F2E]' : ''}>{s.name}</span>
          </div>
        ))}
      </div>
      
      {/* Current Stage Description */}
      <div className="bg-[#F5F3F0] rounded-lg p-4 text-center">
        <div className="text-2xl font-bold mb-1" style={{ color: stage.color }}>{stage.name}</div>
        <p className="text-sm text-[#4A4E5A]">{stage.description}</p>
      </div>
    </div>
  );
}

// Header
function Header({ onNewAssessment, onLoadAssessment, hasSavedAssessments }) {
  return (
    <header className="bg-[#FAF8F5] border-b border-[#E8E4DE] py-5 px-6">
      <div className="max-w-6xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-4">
          <img src="https://ktuyiikwhspwmzvyczit.supabase.co/storage/v1/object/public/assets/brand/antenna-new-logo.svg" alt="Antenna Group" className="h-8" style={{ filter: 'brightness(0)' }} />
          <div className="h-6 w-px bg-[#1A1F2E]" />
          <span className="text-lg font-semibold text-[#1A1F2E]">Conscious Compass</span>
        </div>
        <div className="flex items-center gap-3">
          {hasSavedAssessments && (
            <button onClick={onLoadAssessment} className="flex items-center gap-2 text-sm text-[#4A4E5A] hover:text-[#1A1F2E] transition-colors">
              <FileText className="w-4 h-4" /> Load Saved
            </button>
          )}
          <button onClick={onNewAssessment} className="flex items-center gap-2 text-sm bg-[#1A1F2E] text-white hover:bg-[#2D3142] px-4 py-2 rounded-lg transition-colors">
            <Plus className="w-4 h-4" /> New Assessment
          </button>
        </div>
      </div>
    </header>
  );
}

// Progress Steps
function ProgressSteps({ currentStep, steps }) {
  return (
    <div className="bg-white border-b border-[#E8E4DE] py-4 px-6">
      <div className="max-w-6xl mx-auto flex items-center justify-center gap-2">
        {steps.map((step, i) => (
          <div key={step.id} className="flex items-center">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all ${
              i < currentStep ? 'bg-[#E85D3B] text-white' : i === currentStep ? 'bg-[#E85D3B]/10 text-[#E85D3B] ring-2 ring-[#E85D3B]' : 'bg-[#F5F3F0] text-gray-400'
            }`}>
              {i < currentStep ? <Check className="w-4 h-4" /> : i + 1}
            </div>
            {i < steps.length - 1 && <div className={`w-8 h-0.5 mx-1 ${i < currentStep ? 'bg-[#E85D3B]' : 'bg-[#E8E4DE]'}`} />}
          </div>
        ))}
      </div>
    </div>
  );
}

// Welcome Page
function WelcomePage({ onStart }) {
  return (
    <div className="min-h-[calc(100vh-80px)] flex items-center justify-center p-8 relative">
      <div className="max-w-3xl text-center animate-fade-in">
        <h1 className="text-5xl md:text-6xl font-bold text-[#1A1F2E] mb-6 leading-tight">
          Consequential brands are conscious brands.
        </h1>
        <p className="text-xl text-[#4A4E5A] mb-8 leading-relaxed max-w-2xl mx-auto">
          They don't just show up, they stand out. They don't follow trends; they shape narratives. 
          The Conscious Compass explores your brand's impact across 8 essential attributes.
        </p>
        <button onClick={onStart} className="btn-primary inline-flex items-center gap-3 text-lg">
          Start Assessment <ArrowRight className="w-5 h-5" />
        </button>
      </div>
      <div className="absolute bottom-4 right-4 text-xs text-[#9CA3AF]">
        Version 2.3.1
      </div>
    </div>
  );
}

// Setup Page
function SetupPage({ project, setProject, apiKey, setApiKey, onNext }) {
  const canProceed = project.brandName && project.websiteUrl;

  return (
    <div className="max-w-2xl mx-auto p-8 animate-fade-in">
      <h2 className="text-3xl font-bold text-[#1A1F2E] mb-2">Brand Details</h2>
      <p className="text-[#4A4E5A] mb-8">Tell us about the brand you're assessing.</p>

      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-[#1A1F2E] mb-2">Brand Name *</label>
          <input type="text" value={project.brandName} onChange={(e) => setProject({ ...project, brandName: e.target.value })}
            placeholder="e.g., Antenna Group" className="w-full px-4 py-3 border border-[#E8E4DE] rounded-lg bg-white" />
        </div>

        <div>
          <label className="block text-sm font-medium text-[#1A1F2E] mb-2">Website URL *</label>
          <input type="url" value={project.websiteUrl} onChange={(e) => setProject({ ...project, websiteUrl: e.target.value })}
            placeholder="https://www.example.com" className="w-full px-4 py-3 border border-[#E8E4DE] rounded-lg bg-white" />
        </div>

        <div>
          <label className="block text-sm font-medium text-[#1A1F2E] mb-2">LinkedIn Company URL</label>
          <input type="url" value={project.linkedinUrl} onChange={(e) => setProject({ ...project, linkedinUrl: e.target.value })}
            placeholder="linkedin.com/company/... (for reference)" className="w-full px-4 py-3 border border-[#E8E4DE] rounded-lg bg-white text-sm" />
          <p className="text-xs text-[#6B7280] mt-1">You'll paste content from this page in the Social Media step</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-[#1A1F2E] mb-2">X (Twitter) URL</label>
          <input type="url" value={project.xUrl} onChange={(e) => setProject({ ...project, xUrl: e.target.value })}
            placeholder="x.com/... (for reference)" className="w-full px-4 py-3 border border-[#E8E4DE] rounded-lg bg-white text-sm" />
          <p className="text-xs text-[#6B7280] mt-1">You'll paste content from this page in the Social Media step</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-[#1A1F2E] mb-2">Business Model</label>
          <select value={project.businessModel} onChange={(e) => setProject({ ...project, businessModel: e.target.value })}
            className="w-full px-4 py-3 border border-[#E8E4DE] rounded-lg bg-white">
            {BUSINESS_MODELS.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-[#1A1F2E] mb-2">Industry</label>
          <select value={project.industry || 'other'} onChange={(e) => setProject({ ...project, industry: e.target.value })}
            className="w-full px-4 py-3 border border-[#E8E4DE] rounded-lg bg-white">
            {INDUSTRIES.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
          </select>
          <p className="text-xs text-[#6B7280] mt-1">Used for industry context in the assessment</p>
        </div>

        <div className="pt-4 border-t border-[#E8E4DE]">
          <label className="block text-sm font-medium text-[#1A1F2E] mb-2">Claude API Key</label>
          <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)}
            placeholder="sk-ant-..." className="w-full px-4 py-3 border border-[#E8E4DE] rounded-lg bg-white font-mono text-sm" />
          <p className="text-xs text-[#6B7280] mt-2">Pre-configured for Antenna Group assessments</p>
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
function WebsiteAssessment({ assessmentData, setAssessmentData, apiKey, project, onPrev, onNext }) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [isCompressing, setIsCompressing] = useState(false);
  const [error, setError] = useState(null);
  const [images, setImages] = useState(assessmentData.images || []);
  const [pagesReviewed, setPagesReviewed] = useState(assessmentData.pagesReviewed || '');
  const [websiteContent, setWebsiteContent] = useState(assessmentData.websiteContent || '');
  const fileInputRef = useRef(null);

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

Based on the screenshots and content provided, deliver a comprehensive website assessment covering:

1. BRAND STRATEGY AND POSITIONING
   - How clear and differentiated is the brand positioning?
   - What is the core value proposition? Is it immediately apparent?
   - How well does the visual identity support and reinforce the brand?
   - Is there a consistent brand voice across pages?

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

5. USER INTERFACE (UI) DESIGN
   - How professional, modern, and polished is the interface?
   - Are interactive elements (buttons, forms, links) clearly identifiable?
   - Is there appropriate use of whitespace and visual breathing room?
   - How effective is the typography hierarchy (headings, body, captions)?
   - Are images and media high quality and purposeful?
   - Is the design responsive and mobile-friendly (if visible)?

6. USER EXPERIENCE (UX) AND NAVIGATION
   - How intuitive is the navigation structure?
   - Is the visual hierarchy clear and effective?
   - Are calls-to-action prominent, compelling, and well-placed?
   - How well does the site guide users toward conversion?
   - Are there any friction points or confusing elements?

7. ACCESSIBILITY
   - Is there sufficient color contrast between text and backgrounds?
   - Are fonts legible and appropriately sized?
   - Do images appear to have alt text considerations?
   - Are interactive elements large enough for easy clicking/tapping?
   - Is the content structure logical for screen readers (proper heading hierarchy)?
   - Are there any obvious accessibility barriers (text over busy images, low contrast buttons)?

8. AI AND SEARCH READABILITY
   - Based on visible structure, how well could AI systems understand this brand?
   - Is content structured for discoverability?
   - Are key brand messages likely to be picked up by AI search engines?

Write in flowing prose with specific observations. Be concrete about what you see in the screenshots.

End with:
- 3-5 KEY STRENGTHS (what the website does well)
- 3-5 PRIORITY IMPROVEMENTS (specific, actionable recommendations)`;

      const result = await callClaude(prompt, apiKey, images[0], images.slice(1));
      setAssessmentData({ 
        ...assessmentData, 
        status: 'complete', 
        content: result, 
        images, 
        pagesReviewed, 
        websiteContent 
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
        <div className="w-14 h-14 bg-[#E85D3B]/10 rounded-xl flex items-center justify-center">
          <Globe className="w-7 h-7 text-[#E85D3B]" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-[#1A1F2E]">Website Assessment</h2>
          <p className="text-[#4A4E5A]">Analyzing {project.brandName}'s website: {project.websiteUrl}</p>
        </div>
      </div>

      {/* Pages Reviewed */}
      <div className="card p-6 mb-6">
        <h3 className="font-semibold text-[#1A1F2E] mb-3">Pages Reviewed</h3>
        <p className="text-sm text-[#6B7280] mb-3">List the pages you reviewed (e.g., Homepage, About, Services, Contact, Blog)</p>
        <input 
          type="text" 
          value={pagesReviewed} 
          onChange={(e) => { setPagesReviewed(e.target.value); setAssessmentData({ ...assessmentData, pagesReviewed: e.target.value }); }}
          placeholder="e.g., Homepage, About Us, Services, Case Studies, Contact"
          className="w-full px-4 py-3 border border-[#E8E4DE] rounded-lg bg-white"
        />
      </div>

      {/* Screenshots */}
      <div className="card p-6 mb-6">
        <h3 className="font-semibold text-[#1A1F2E] mb-3 flex items-center gap-2">
          <Image className="w-5 h-5" /> Website Screenshots (up to 4)
        </h3>
        <p className="text-sm text-[#6B7280] mb-4">Upload screenshots of homepage and key subpages for visual analysis.</p>
        
        <input type="file" ref={fileInputRef} onChange={handleImageUpload} accept="image/*" multiple className="hidden" />
        
        <div className="grid grid-cols-2 gap-4 mb-4">
          {images.map((img, index) => (
            <div key={index} className="relative">
              <img src={img} alt={`Screenshot ${index + 1}`} className="w-full h-40 object-cover rounded-lg border border-[#E8E4DE]" />
              <button onClick={() => removeImage(index)}
                className="absolute top-2 right-2 bg-white rounded-full p-1 shadow-lg hover:bg-gray-100">
                <X className="w-4 h-4" />
              </button>
              <div className="absolute bottom-2 left-2 bg-[#1A1F2E] text-white text-xs px-2 py-1 rounded">
                {index + 1}
              </div>
            </div>
          ))}
          
          {images.length < 4 && (
            <button onClick={() => fileInputRef.current?.click()}
              className="h-40 border-2 border-dashed border-[#E85D3B] rounded-lg flex flex-col items-center justify-center gap-2 hover:bg-[#E85D3B]/5 transition-colors">
              {isCompressing ? (
                <><Loader2 className="w-6 h-6 text-[#E85D3B] animate-spin" /><span className="text-sm text-[#E85D3B]">Compressing...</span></>
              ) : (
                <><Upload className="w-6 h-6 text-[#E85D3B]" /><span className="text-sm text-[#E85D3B] font-medium">Add Screenshot</span><span className="text-xs text-[#6B7280]">{4 - images.length} remaining</span></>
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
        <h3 className="font-semibold text-[#1A1F2E] mb-3">Website Content (Optional)</h3>
        <p className="text-sm text-[#6B7280] mb-3">Paste key content from the website: headlines, taglines, about text, value propositions, etc.</p>
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
          className="w-full h-40 px-4 py-3 border border-[#E8E4DE] rounded-lg bg-white resize-none text-sm"
        />
      </div>

      {/* Assessor Observations */}
      <div className="card p-6 mb-6">
        <h3 className="font-semibold text-[#1A1F2E] mb-3">Assessor Observations</h3>
        <p className="text-sm text-[#6B7280] mb-3">Your observations on brand alignment, storytelling, consistency issues, or other concerns.</p>
        <textarea value={assessmentData.observations || ''} onChange={(e) => setAssessmentData({ ...assessmentData, observations: e.target.value })}
          placeholder="Add your observations about:
- Brand alignment issues
- Storytelling strengths/weaknesses  
- Consistency across pages
- Navigation or UX concerns
- Content gaps
- Competitive positioning..." className="w-full h-32 px-4 py-3 border border-[#E8E4DE] rounded-lg bg-white resize-none" />
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
          <h3 className="font-semibold text-[#1A1F2E] mb-3 flex items-center gap-2">
            <Check className="w-5 h-5 text-[#E85D3B]" /> Analysis Complete
          </h3>
          <div className="bg-[#F5F3F0] rounded-lg p-4 max-h-96 overflow-y-auto">
            <pre className="text-sm text-[#4A4E5A] whitespace-pre-wrap font-sans">{assessmentData.content}</pre>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between pt-6 border-t border-[#E8E4DE]">
        <button onClick={onPrev} className="btn-secondary flex items-center gap-2"><ArrowLeft className="w-4 h-4" /> Back</button>
        <button onClick={onNext} disabled={!isComplete} className="btn-primary flex items-center gap-2">Continue <ArrowRight className="w-4 h-4" /></button>
      </div>
    </div>
  );
}

// Social Media Assessment with all platforms and image uploads
function SocialMediaAssessment({ assessmentData, setAssessmentData, apiKey, project, onPrev, onNext }) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [isCompressing, setIsCompressing] = useState(false);
  const [error, setError] = useState(null);
  const [inputs, setInputs] = useState({
    linkedinAbout: assessmentData.linkedinAbout || '',
    linkedinPosts: assessmentData.linkedinPosts || '',
    linkedinArticles: assessmentData.linkedinArticles || '',
    xContent: assessmentData.xContent || '',
    instagramContent: assessmentData.instagramContent || '',
    youtubeContent: assessmentData.youtubeContent || '',
    hasYouTube: assessmentData.hasYouTube ?? true,
    redditContent: assessmentData.redditContent || '',
    wikipediaContent: assessmentData.wikipediaContent || '',
  });
  const [images, setImages] = useState(assessmentData.socialImages || []);
  const fileInputRef = useRef(null);

  const updateInput = (key, value) => {
    setInputs(prev => ({ ...prev, [key]: value }));
    setAssessmentData({ ...assessmentData, [key]: value });
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
      const prompt = `Analyze ${project.brandName}'s social media presence based on the content provided below.

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

=== YOUTUBE DATA ===
${inputs.hasYouTube ? (inputs.youtubeContent || '[User indicated they have YouTube but no content provided]') : '[Brand does not have a YouTube channel]'}

=== REDDIT PRESENCE ===
${inputs.redditContent || '[Not provided - please note any Reddit mentions or discussions about ' + project.brandName + ']'}

=== WIKIPEDIA PRESENCE ===
${inputs.wikipediaContent || '[Not provided - please note if ' + project.brandName + ' has a Wikipedia page]'}

${images.length > 0 ? `\n${images.length} screenshot(s) of social media pages have been provided for visual reference.` : ''}

${assessmentData.observations ? `\nASSESSOR OBSERVATIONS TO CONSIDER:\n${assessmentData.observations}` : ''}

Based on the content provided above, deliver a comprehensive social media assessment:

1. LinkedIn Presence: Analyze the About section messaging, post content quality, engagement rates (benchmark: 2-4% is good), thought leadership positioning, and content mix

2. X/Twitter Presence: Evaluate voice/tone, content strategy, engagement levels, and brand consistency

3. Instagram Presence: Assess visual brand consistency, content themes, engagement, and audience connection

4. YouTube Presence: ${inputs.hasYouTube ? 'Assess channel content strategy, video topics, and recommendations for improvement' : 'The brand does not have YouTube - provide recommendation on whether they should based on their industry and audience'}

5. Reddit Presence: What subreddits mention this brand? What is the sentiment? How does user-generated content affect their reputation?

6. Wikipedia Presence: Does the brand have a Wikipedia page? How does this impact their credibility and AI search visibility?

7. Cross-Platform Consistency: Is the brand voice and messaging consistent across platforms?

8. AI/Search Visibility: How does their social presence impact discoverability in AI search engines?

Write in flowing prose with specific observations from the content provided. End with key strengths and priority improvements.`;

      const result = await callClaude(prompt, apiKey, images[0], images.slice(1));
      setAssessmentData({ ...assessmentData, status: 'complete', content: result, ...inputs, socialImages: images });
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
          <h2 className="text-2xl font-bold text-[#1A1F2E]">Social Media Assessment</h2>
          <p className="text-[#4A4E5A]">Evaluating {project.brandName}'s social presence</p>
        </div>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
        <p className="text-sm text-amber-800">
          <strong>Note:</strong> Copy and paste content directly from each platform. Claude cannot visit URLs directly.
        </p>
      </div>

      {/* Screenshot Upload */}
      <div className="card p-6 mb-6">
        <h3 className="font-semibold text-[#1A1F2E] mb-3">Social Media Screenshots (up to 4)</h3>
        <p className="text-sm text-[#6B7280] mb-4">Upload screenshots from social profiles for visual analysis.</p>
        
        <input type="file" ref={fileInputRef} onChange={handleImageUpload} accept="image/*" multiple className="hidden" />
        
        <div className="grid grid-cols-4 gap-3 mb-4">
          {images.map((img, index) => (
            <div key={index} className="relative">
              <img src={img} alt={`Screenshot ${index + 1}`} className="w-full h-24 object-cover rounded-lg border border-[#E8E4DE]" />
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
        <h3 className="font-semibold text-[#1A1F2E] mb-4 flex items-center gap-2">
          <ExternalLink className="w-5 h-5" /> LinkedIn Content
        </h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#1A1F2E] mb-2">About Section</label>
            <textarea value={inputs.linkedinAbout} onChange={(e) => updateInput('linkedinAbout', e.target.value)}
              placeholder="Go to their LinkedIn 'About' tab and paste the company description here..." className="w-full h-24 px-4 py-3 border border-[#E8E4DE] rounded-lg bg-white resize-none text-sm" />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-[#1A1F2E] mb-2">Recent Posts (include engagement metrics)</label>
            <textarea value={inputs.linkedinPosts} onChange={(e) => updateInput('linkedinPosts', e.target.value)}
              placeholder="Copy 5-10 recent posts. Include the post text and engagement (e.g., '245 likes, 32 comments, 15 reposts')..." className="w-full h-32 px-4 py-3 border border-[#E8E4DE] rounded-lg bg-white resize-none text-sm" />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-[#1A1F2E] mb-2">Articles (if any)</label>
            <textarea value={inputs.linkedinArticles} onChange={(e) => updateInput('linkedinArticles', e.target.value)}
              placeholder="List any LinkedIn articles: titles, brief summary, engagement..." className="w-full h-20 px-4 py-3 border border-[#E8E4DE] rounded-lg bg-white resize-none text-sm" />
          </div>
        </div>
      </div>

      {/* X (Twitter) Input */}
      <div className="card p-6 mb-6">
        <h3 className="font-semibold text-[#1A1F2E] mb-4 flex items-center gap-2">
          <ExternalLink className="w-5 h-5" /> X (Twitter) Content
        </h3>
        <textarea value={inputs.xContent} onChange={(e) => updateInput('xContent', e.target.value)}
          placeholder="Paste their X bio, follower count, and 5-10 recent tweets with engagement metrics..." className="w-full h-28 px-4 py-3 border border-[#E8E4DE] rounded-lg bg-white resize-none text-sm" />
      </div>

      {/* Instagram Input */}
      <div className="card p-6 mb-6">
        <h3 className="font-semibold text-[#1A1F2E] mb-4 flex items-center gap-2">
          <ExternalLink className="w-5 h-5" /> Instagram Content
        </h3>
        <textarea value={inputs.instagramContent} onChange={(e) => updateInput('instagramContent', e.target.value)}
          placeholder="Paste their Instagram bio, follower count, describe recent posts (types of content, engagement levels, visual themes)..." className="w-full h-28 px-4 py-3 border border-[#E8E4DE] rounded-lg bg-white resize-none text-sm" />
      </div>

      {/* YouTube Input */}
      <div className="card p-6 mb-6">
        <h3 className="font-semibold text-[#1A1F2E] mb-4 flex items-center gap-2">
          <ExternalLink className="w-5 h-5" /> YouTube Content
        </h3>
        
        <div className="mb-4">
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={inputs.hasYouTube} onChange={(e) => updateInput('hasYouTube', e.target.checked)}
              className="w-5 h-5 rounded border-gray-300 text-[#E85D3B] focus:ring-[#E85D3B]" />
            <span className="text-sm text-[#1A1F2E]">This brand has a YouTube channel</span>
          </label>
        </div>

        {inputs.hasYouTube && (
          <textarea value={inputs.youtubeContent} onChange={(e) => updateInput('youtubeContent', e.target.value)}
            placeholder="Describe: subscriber count, number of videos, recent video titles and view counts, content themes, posting frequency..." className="w-full h-28 px-4 py-3 border border-[#E8E4DE] rounded-lg bg-white resize-none text-sm" />
        )}
      </div>

      {/* Reddit and Wikipedia */}
      <div className="card p-6 mb-6">
        <h3 className="font-semibold text-[#1A1F2E] mb-4 flex items-center gap-2">
          <ExternalLink className="w-5 h-5" /> Reddit and Wikipedia Presence
        </h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#1A1F2E] mb-2">Reddit Mentions</label>
            <textarea value={inputs.redditContent} onChange={(e) => updateInput('redditContent', e.target.value)}
              placeholder="Search Reddit for the brand name. Note any subreddits where they're discussed, sentiment of discussions, any notable threads..." className="w-full h-24 px-4 py-3 border border-[#E8E4DE] rounded-lg bg-white resize-none text-sm" />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-[#1A1F2E] mb-2">Wikipedia Page</label>
            <textarea value={inputs.wikipediaContent} onChange={(e) => updateInput('wikipediaContent', e.target.value)}
              placeholder="Does this brand have a Wikipedia page? If yes, paste key details or describe its completeness. If no, note that." className="w-full h-20 px-4 py-3 border border-[#E8E4DE] rounded-lg bg-white resize-none text-sm" />
          </div>
        </div>
      </div>

      {/* Assessor Observations */}
      <div className="card p-6 mb-6">
        <h3 className="font-semibold text-[#1A1F2E] mb-3">Assessor Observations</h3>
        <p className="text-sm text-[#6B7280] mb-3">Your observations will be included in the analysis and final report.</p>
        <textarea value={assessmentData.observations || ''} onChange={(e) => setAssessmentData({ ...assessmentData, observations: e.target.value })}
          placeholder="Add your own observations about their social media presence..." className="w-full h-32 px-4 py-3 border border-[#E8E4DE] rounded-lg bg-white resize-none" />
      </div>

      {!isComplete && (
        <button onClick={runAnalysis} disabled={isProcessing || !hasMinimumContent} className="btn-primary flex items-center gap-2 mb-6">
          {isProcessing ? <><Loader2 className="w-4 h-4 animate-spin" /> Analyzing...</> : <><Play className="w-4 h-4" /> {hasMinimumContent ? 'Run Social Analysis' : 'Add Content First'}</>}
        </button>
      )}

      {error && <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 text-red-700">{error}</div>}

      {isComplete && (
        <div className="card p-6 mb-6">
          <h3 className="font-semibold text-[#1A1F2E] mb-3 flex items-center gap-2">
            <Check className="w-5 h-5 text-[#8B5CF6]" /> Analysis Complete
          </h3>
          <div className="bg-[#F5F3F0] rounded-lg p-4 max-h-96 overflow-y-auto">
            <pre className="text-sm text-[#4A4E5A] whitespace-pre-wrap font-sans">{assessmentData.content}</pre>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between pt-6 border-t border-[#E8E4DE]">
        <button onClick={onPrev} className="btn-secondary flex items-center gap-2"><ArrowLeft className="w-4 h-4" /> Back</button>
        <button onClick={onNext} disabled={!isComplete} className="btn-primary flex items-center gap-2">Continue <ArrowRight className="w-4 h-4" /></button>
      </div>
    </div>
  );
}

// AI Reputation Page
function AIReputationPage({ assessmentData, setAssessmentData, apiKey, project, onPrev, onNext }) {
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

  const hasAllResponses = responses.claude && (responses.gemini || manualInput.gemini) && (responses.chatgpt || manualInput.chatgpt);
  const isComplete = assessmentData.status === 'complete';

  const generateSynthesis = async () => {
    setIsProcessing(p => ({ ...p, synthesis: true }));
    try {
      const prompt = `Analyze these AI system responses about ${project.brandName}:

CLAUDE: ${responses.claude}
GEMINI: ${responses.gemini || manualInput.gemini}
CHATGPT: ${responses.chatgpt || manualInput.chatgpt}

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
          <h2 className="text-2xl font-bold text-[#1A1F2E]">AI Reputation Assessment</h2>
          <p className="text-[#4A4E5A]">How does {project.brandName} appear across AI systems?</p>
        </div>
      </div>

      <div className="bg-[#F5F3F0] rounded-lg p-4 mb-6">
        <p className="text-sm text-[#6B7280] mb-2">Query each AI system with:</p>
        <p className="text-[#1A1F2E] italic text-sm">"{standardQuery}"</p>
      </div>

      {!responses.claude && (
        <button onClick={queryClaude} disabled={isProcessing.claude} className="btn-primary flex items-center gap-2 mb-6">
          {isProcessing.claude ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />} Query Claude
        </button>
      )}

      {error && <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 text-red-700 text-sm">{error}</div>}

      <div className="space-y-4 mb-6">
        {/* Claude */}
        <div className={`card p-4 ${responses.claude ? 'bg-[#F5F3F0]' : ''}`}>
          <div className="flex items-center gap-3 mb-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${responses.claude ? 'bg-[#E85D3B] text-white' : 'bg-[#F5F3F0]'}`}>
              {isProcessing.claude ? <Loader2 className="w-5 h-5 animate-spin" /> : responses.claude ? <Check className="w-5 h-5" /> : <Bot className="w-5 h-5 text-gray-400" />}
            </div>
            <div>
              <h4 className="font-medium">Claude (Anthropic)</h4>
              <p className="text-sm text-[#6B7280]">{responses.claude ? 'Response received' : 'Click button above to query'}</p>
            </div>
          </div>
          {responses.claude && <div className="bg-white rounded-lg p-3 max-h-40 overflow-y-auto text-sm text-[#4A4E5A] border border-[#E8E4DE]">{responses.claude}</div>}
        </div>

        {/* Gemini */}
        <div className={`card p-4 ${manualInput.gemini ? 'bg-[#F5F3F0]' : ''}`}>
          <div className="flex items-center gap-3 mb-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${manualInput.gemini ? 'bg-[#E85D3B] text-white' : 'bg-[#F5F3F0]'}`}>
              {manualInput.gemini ? <Check className="w-5 h-5" /> : <Bot className="w-5 h-5 text-gray-400" />}
            </div>
            <div>
              <h4 className="font-medium">Gemini (Google)</h4>
              <p className="text-sm text-[#6B7280]">Paste response from gemini.google.com</p>
            </div>
          </div>
          <textarea value={manualInput.gemini} onChange={(e) => setManualInput(m => ({ ...m, gemini: e.target.value }))}
            placeholder="Paste Gemini's response here..." className="w-full h-24 px-3 py-2 border border-[#E8E4DE] rounded-lg text-sm bg-white" />
        </div>

        {/* ChatGPT */}
        <div className={`card p-4 ${manualInput.chatgpt ? 'bg-[#F5F3F0]' : ''}`}>
          <div className="flex items-center gap-3 mb-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${manualInput.chatgpt ? 'bg-[#E85D3B] text-white' : 'bg-[#F5F3F0]'}`}>
              {manualInput.chatgpt ? <Check className="w-5 h-5" /> : <Bot className="w-5 h-5 text-gray-400" />}
            </div>
            <div>
              <h4 className="font-medium">ChatGPT (OpenAI)</h4>
              <p className="text-sm text-[#6B7280]">Paste response from chatgpt.com</p>
            </div>
          </div>
          <textarea value={manualInput.chatgpt} onChange={(e) => setManualInput(m => ({ ...m, chatgpt: e.target.value }))}
            placeholder="Paste ChatGPT's response here..." className="w-full h-24 px-3 py-2 border border-[#E8E4DE] rounded-lg text-sm bg-white" />
        </div>
      </div>

      {/* Assessor Observations - moved before synthesis */}
      <div className="card p-6 mb-6">
        <h3 className="font-semibold text-[#1A1F2E] mb-3">Assessor Observations</h3>
        <p className="text-sm text-[#6B7280] mb-3">Your observations will be included in the synthesis and final report.</p>
        <textarea value={assessmentData.observations || ''} onChange={(e) => setAssessmentData({ ...assessmentData, observations: e.target.value })}
          placeholder="Add your own observations about the AI responses, discrepancies noticed, concerns, etc..." className="w-full h-32 px-4 py-3 border border-[#E8E4DE] rounded-lg bg-white resize-none" />
      </div>

      {hasAllResponses && !isComplete && (
        <button onClick={generateSynthesis} disabled={isProcessing.synthesis} className="btn-primary flex items-center gap-2 w-full justify-center mb-6">
          {isProcessing.synthesis ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating...</> : <><Play className="w-4 h-4" /> Generate Synthesis</>}
        </button>
      )}

      {isComplete && (
        <div className="card p-6 mb-6">
          <h3 className="font-semibold text-[#1A1F2E] mb-3 flex items-center gap-2">
            <Check className="w-5 h-5 text-[#3B82F6]" /> Synthesis Complete
          </h3>
          <div className="bg-[#F5F3F0] rounded-lg p-4 max-h-64 overflow-y-auto text-sm text-[#4A4E5A]">{assessmentData.content}</div>
        </div>
      )}

      <div className="flex items-center justify-between pt-6 border-t border-[#E8E4DE]">
        <button onClick={onPrev} className="btn-secondary flex items-center gap-2"><ArrowLeft className="w-4 h-4" /> Back</button>
        <button onClick={onNext} disabled={!isComplete} className="btn-primary flex items-center gap-2">Continue <ArrowRight className="w-4 h-4" /></button>
      </div>
    </div>
  );
}

// Earned Media Assessment with paste field
function EarnedMediaAssessment({ assessmentData, setAssessmentData, apiKey, project, onPrev, onNext }) {
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
          <h2 className="text-2xl font-bold text-[#1A1F2E]">Earned Media Assessment</h2>
          <p className="text-[#4A4E5A]">Analyzing {project.brandName}'s press coverage</p>
        </div>
      </div>

      {/* Coverage Paste Field */}
      <div className="card p-6 mb-6">
        <h3 className="font-semibold text-[#1A1F2E] mb-3">Media Coverage (Last 3 Months)</h3>
        <p className="text-sm text-[#6B7280] mb-4">
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
          className="w-full h-48 px-4 py-3 border border-[#E8E4DE] rounded-lg bg-white resize-none text-sm"
        />
      </div>

      {/* Assessor Observations - before analysis button */}
      <div className="card p-6 mb-6">
        <h3 className="font-semibold text-[#1A1F2E] mb-3">Assessor Observations</h3>
        <p className="text-sm text-[#6B7280] mb-3">Your observations will be included in the analysis and final report.</p>
        <textarea value={assessmentData.observations || ''} onChange={(e) => setAssessmentData({ ...assessmentData, observations: e.target.value })}
          placeholder="Add your own observations about their media presence, PR strategy, coverage quality..." className="w-full h-32 px-4 py-3 border border-[#E8E4DE] rounded-lg bg-white resize-none" />
      </div>

      {!isComplete && (
        <button onClick={runAnalysis} disabled={isProcessing} className="btn-primary flex items-center gap-2 mb-6">
          {isProcessing ? <><Loader2 className="w-4 h-4 animate-spin" /> Analyzing...</> : <><Play className="w-4 h-4" /> Run Earned Media Analysis</>}
        </button>
      )}

      {error && <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 text-red-700">{error}</div>}

      {isComplete && (
        <div className="card p-6 mb-6">
          <h3 className="font-semibold text-[#1A1F2E] mb-3 flex items-center gap-2">
            <Check className="w-5 h-5 text-[#10B981]" /> Analysis Complete
          </h3>
          <div className="bg-[#F5F3F0] rounded-lg p-4 max-h-96 overflow-y-auto">
            <pre className="text-sm text-[#4A4E5A] whitespace-pre-wrap font-sans">{assessmentData.content}</pre>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between pt-6 border-t border-[#E8E4DE]">
        <button onClick={onPrev} className="btn-secondary flex items-center gap-2"><ArrowLeft className="w-4 h-4" /> Back</button>
        <button onClick={onNext} disabled={!isComplete} className="btn-primary flex items-center gap-2">Continue <ArrowRight className="w-4 h-4" /></button>
      </div>
    </div>
  );
}

// Scoring Page
function ScoringPage({ scores, setScores, assessments, apiKey, project, onPrev, onNext }) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);

  const runScoring = async () => {
    setIsProcessing(true);
    setError(null);
    try {
      const prompt = `Score ${project.brandName} against the Conscious Compass Framework.

ASSESSMENT DATA:
Website: ${assessments.website.content}
${assessments.website.observations ? `Assessor Notes: ${assessments.website.observations}` : ''}

Social Media: ${assessments.social.content}
${assessments.social.observations ? `Assessor Notes: ${assessments.social.observations}` : ''}

AI Reputation: ${assessments.aiReputation.content}
${assessments.aiReputation.observations ? `Assessor Notes: ${assessments.aiReputation.observations}` : ''}

Earned Media: ${assessments.earnedMedia.content}
${assessments.earnedMedia.observations ? `Assessor Notes: ${assessments.earnedMedia.observations}` : ''}

Score each attribute 0-100:
${ATTRIBUTES.map(a => `${a.id} (${a.fullName}): ${a.description}`).join('\n')}

Return ONLY valid JSON:
{"AWAKE":{"score":45,"summary":"2-3 sentence explanation"},"AWARE":{"score":52,"summary":"..."},"REFLECTIVE":{"score":38,"summary":"..."},"ATTENTIVE":{"score":55,"summary":"..."},"COGENT":{"score":42,"summary":"..."},"SENTIENT":{"score":35,"summary":"..."},"VISIONARY":{"score":48,"summary":"..."},"INTENTIONAL":{"score":50,"summary":"..."}}`;

      const result = await callClaude(prompt, apiKey);
      const match = result.match(/\{[\s\S]*\}/);
      if (match) setScores(JSON.parse(match[0]));
    } catch (e) { setError(e.message); }
    finally { setIsProcessing(false); }
  };

  const overall = scores ? Math.round(Object.values(scores).reduce((a, v) => a + v.score, 0) / 8) : 0;

  return (
    <div className="max-w-5xl mx-auto p-8 animate-fade-in">
      <div className="flex items-start gap-4 mb-8">
        <div className="w-14 h-14 bg-[#6366F1]/10 rounded-xl flex items-center justify-center">
          <BarChart3 className="w-7 h-7 text-[#6366F1]" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-[#1A1F2E]">Scoring & Analysis</h2>
          <p className="text-[#4A4E5A]">AI-generated scores based on the four assessments.</p>
        </div>
      </div>

      {!scores && (
        <button onClick={runScoring} disabled={isProcessing} className="btn-primary flex items-center gap-2 mb-6">
          {isProcessing ? <><Loader2 className="w-4 h-4 animate-spin" /> Analyzing...</> : <><Play className="w-4 h-4" /> Generate Scores</>}
        </button>
      )}

      {error && <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 text-red-700">{error}</div>}

      {scores && (
        <>
          {/* Spider Chart */}
          <div className="card p-6 mb-8">
            <h3 className="text-lg font-semibold text-[#1A1F2E] mb-4 text-center">Attribute Scores</h3>
            <SpiderChart scores={scores} />
          </div>

          {/* Maturity Continuum */}
          <MaturityContinuum score={overall} />

          {/* Attribute Cards */}
          <h3 className="text-lg font-semibold text-[#1A1F2E] mt-8 mb-4">Detailed Breakdown</h3>
          <div className="grid md:grid-cols-2 gap-4 mb-8">
            {ATTRIBUTES.map(attr => (
              <div key={attr.id} className="card p-5">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="inline-block px-2 py-1 rounded text-xs font-semibold text-white mb-1" style={{ backgroundColor: attr.color }}>{attr.name}</div>
                    <h4 className="font-semibold text-[#1A1F2E] text-sm">{attr.fullName}</h4>
                  </div>
                  <span className="text-2xl font-bold" style={{ color: attr.color }}>{scores[attr.id]?.score || 0}</span>
                </div>
                <div className="h-2 bg-[#F5F3F0] rounded-full overflow-hidden mb-3">
                  <div className="h-full rounded-full" style={{ width: `${scores[attr.id]?.score || 0}%`, backgroundColor: attr.color }} />
                </div>
                <p className="text-xs text-[#4A4E5A]">{scores[attr.id]?.summary}</p>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="flex items-center justify-between pt-6 border-t border-[#E8E4DE]">
        <button onClick={onPrev} className="btn-secondary flex items-center gap-2"><ArrowLeft className="w-4 h-4" /> Back</button>
        <button onClick={onNext} disabled={!scores} className="btn-primary flex items-center gap-2">View Report <ArrowRight className="w-4 h-4" /></button>
      </div>
    </div>
  );
}

// Report Page
function ReportPage({ project, scores, assessments, onSave, onPrev }) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  const overall = scores ? Math.round(Object.values(scores).reduce((a, v) => a + v.score, 0) / 8) : 0;
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
      recommendations.push({ attr: attr.name, attrId: attr.id, rec: attrRecs[recIndex], score: attr.score });
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
        addText(text, 14, true, [232, 93, 59]);
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
      pdf.setFillColor(232, 93, 59);
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
      if (allObservations.length > 0) {
        addText(`Assessor observations: ${allObservations.join(' ')}`, 9, false, [107, 114, 128]);
      }
      addSpace(5);

      // Score Summary
      addHeading('SCORE SUMMARY');
      ATTRIBUTES.forEach(attr => {
        const score = scores[attr.id]?.score || 0;
        addText(`${attr.name} (${attr.fullName}): ${score}/100`, 10, false);
      });
      addSpace(5);

      // Attribute Analysis
      addHeading('ATTRIBUTE ANALYSIS');
      ATTRIBUTES.forEach(attr => {
        addText(`${attr.name}: ${scores[attr.id]?.score || 0}/100`, 11, true);
        addText(scores[attr.id]?.summary || attr.description, 9);
        addSpace(3);
      });

      // Maturity Stage Context
      addHeading('MATURITY STAGE CONTEXT');
      addText(`With a score of ${overall}/100, ${project.brandName} is positioned in the "${stage.name}" stage of brand consciousness maturity. ${stage.description}. Brands at this stage typically demonstrate ${overall < 40 ? 'foundational elements but significant room for strategic development' : overall < 60 ? 'solid fundamentals with clear opportunities to elevate their market presence' : overall < 80 ? 'strong brand awareness with potential to become industry thought leaders' : 'exceptional consciousness and should focus on maintaining their position'}. The path forward involves targeted investment in the lowest-scoring attributes.`);
      addSpace(5);

      // Recommendations
      addHeading('INTEGRATED MARKETING RECOMMENDATIONS');
      recommendations.forEach((r, i) => {
        addText(`${i + 1}. [${r.attr}] ${r.rec}`, 9);
      });
      addSpace(5);

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
            allObservations.length > 0 ? new Paragraph({ children: [new TextRun({ text: `\n\nAssessor observations highlight: ${allObservations.join(' ')}`, italics: true })] }) : new Paragraph({ children: [] }),
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
              new Paragraph({ children: [new TextRun(scores[attr.id]?.summary || attr.description)] }),
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
            ...recommendations.map((r, i) => new Paragraph({ children: [new TextRun(`${i + 1}. [${r.attr}] ${r.rec}`)] })),
            new Paragraph({ children: [new TextRun('')] }),
            
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
          <h2 className="text-3xl font-bold text-[#1A1F2E]">{project.brandName}</h2>
          <p className="text-[#6B7280]">Conscious Compass Assessment Report | {industryName}</p>
        </div>
        <div className="flex gap-3">
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
        <h3 className="text-lg font-semibold text-[#1A1F2E] mb-4">EXECUTIVE SUMMARY</h3>
        <p className="text-[#4A4E5A] leading-relaxed">
          {project.brandName} achieved an overall Brand Consciousness Score of <strong>{overall}/100</strong>, placing them in the "<strong>{stage.name}</strong>" maturity stage. The assessment evaluated the brand across 8 key consciousness attributes. Key strengths emerged in {sortedAttrs.slice(-2).map(a => a.name).join(' and ')}, while opportunities for growth were identified in {sortedAttrs.slice(0, 2).map(a => a.name).join(' and ')}.
        </p>
        {allObservations.length > 0 && (
          <p className="text-[#6B7280] italic mt-3">Assessor observations: {allObservations.join(' ')}</p>
        )}
      </div>

      {/* Spider Chart */}
      <div className="card p-6 mb-6">
        <h3 className="text-lg font-semibold text-[#1A1F2E] mb-4 text-center">Brand Consciousness Profile</h3>
        <SpiderChart scores={scores} size={450} />
      </div>

      {/* Score Summary */}
      <div className="card p-6 mb-6">
        <h3 className="text-lg font-semibold text-[#1A1F2E] mb-4">SCORE SUMMARY</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {ATTRIBUTES.map(attr => (
            <div key={attr.id} className="text-center p-3 bg-[#F5F3F0] rounded-lg">
              <div className="text-2xl font-bold" style={{ color: attr.color }}>{scores[attr.id]?.score || 0}</div>
              <div className="text-sm text-[#4A4E5A]">{attr.name}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Maturity Continuum */}
      <MaturityContinuum score={overall} />

      {/* Maturity Stage Context */}
      <div className="card p-6 mb-6">
        <h3 className="text-lg font-semibold text-[#1A1F2E] mb-4">MATURITY STAGE CONTEXT</h3>
        <p className="text-[#4A4E5A] leading-relaxed">
          With a score of {overall}/100, {project.brandName} is positioned in the "{stage.name}" stage of brand consciousness maturity. {stage.description}. Brands at this stage typically demonstrate {overall < 40 ? 'foundational elements but significant room for strategic development across multiple dimensions' : overall < 60 ? 'solid fundamentals with clear opportunities to elevate their market presence and differentiation' : overall < 80 ? 'strong brand awareness with potential to become true industry thought leaders' : 'exceptional consciousness and should focus on maintaining their position while innovating'}. The path forward involves targeted investment in the lowest-scoring attributes.
        </p>
      </div>

      {/* Attribute Analysis */}
      <h3 className="text-xl font-semibold text-[#1A1F2E] mt-8 mb-4">ATTRIBUTE ANALYSIS</h3>
      <div className="space-y-4 mb-8">
        {ATTRIBUTES.map(attr => (
          <div key={attr.id} className="card p-5">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-lg flex items-center justify-center text-white font-bold text-lg" style={{ backgroundColor: attr.color }}>
                  {scores[attr.id]?.score || 0}
                </div>
                <div>
                  <h4 className="font-bold text-[#1A1F2E]">{attr.name}</h4>
                  <p className="text-sm text-[#6B7280]">{attr.fullName}</p>
                </div>
              </div>
            </div>
            <p className="text-sm text-[#4A4E5A]">{scores[attr.id]?.summary || attr.description}</p>
          </div>
        ))}
      </div>

      {/* Recommendations */}
      <h3 className="text-xl font-semibold text-[#1A1F2E] mb-4">INTEGRATED MARKETING RECOMMENDATIONS</h3>
      <p className="text-[#6B7280] mb-4">Based on the assessment, here are 12 priority recommendations to enhance brand consciousness:</p>
      <div className="card p-6 mb-6">
        <div className="grid md:grid-cols-2 gap-4">
          {recommendations.map((r, i) => (
            <div key={i} className="flex items-start gap-3 p-3 bg-[#F5F3F0] rounded-lg">
              <div className="w-7 h-7 rounded-full bg-[#E85D3B] text-white flex items-center justify-center font-semibold text-xs flex-shrink-0">{i + 1}</div>
              <div>
                <span className="text-xs font-semibold text-[#E85D3B] uppercase tracking-wide">{r.attr}</span>
                <p className="text-sm text-[#1A1F2E]">{r.rec}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Conclusions */}
      <div className="card p-6 mb-6">
        <h3 className="text-lg font-semibold text-[#1A1F2E] mb-4">CONCLUSIONS</h3>
        <p className="text-[#4A4E5A] leading-relaxed">
          {project.brandName} has demonstrated {overall >= 60 ? 'strong potential' : 'a foundation'} for building an impactful, conscious brand presence. By focusing on the recommendations outlined above, particularly strengthening {sortedAttrs[0].name} and {sortedAttrs[1].name} capabilities, the brand can elevate its market position and create deeper connections with its audience. The journey toward greater brand consciousness is ongoing, and with strategic focus, {project.brandName} is well positioned to become a more consequential presence in its industry.
        </p>
      </div>

      {/* What We Evaluated */}
      <div className="card p-6 mb-8">
        <h3 className="text-lg font-semibold text-[#1A1F2E] mb-4">WHAT WE EVALUATED</h3>
        <p className="text-[#4A4E5A] leading-relaxed">
          This assessment was conducted using Antenna Group's Brand Consciousness Framework v2.3, evaluating {project.brandName} across four key dimensions. {websiteEvalDescription} Social media presence was analyzed across LinkedIn, X, Instagram, YouTube, Reddit, and Wikipedia for brand consistency and engagement. AI reputation was assessed by querying Claude, Gemini, and ChatGPT to understand how AI systems perceive and represent the brand. Earned media coverage from the past 3 months was reviewed for sentiment, message penetration, and share of voice. The business model ({project.businessModel.toUpperCase()}) and industry context ({industryName}) were applied to weight attribute importance appropriately.
        </p>
      </div>

      <div className="flex items-center justify-start pt-6 border-t border-[#E8E4DE]">
        <button onClick={onPrev} className="btn-secondary flex items-center gap-2"><ArrowLeft className="w-4 h-4" /> Back</button>
      </div>
    </div>
  );
}

// Saved Assessments Modal
function SavedAssessmentsModal({ onClose, onLoad, assessments }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-lg w-full max-h-[80vh] overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-[#E8E4DE]">
          <h3 className="text-lg font-semibold">Saved Assessments</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-4 overflow-y-auto max-h-96">
          {assessments.length === 0 ? (
            <p className="text-[#6B7280] text-center py-8">No saved assessments</p>
          ) : (
            <div className="space-y-3">
              {assessments.map((a, i) => (
                <div key={i} className="flex items-center justify-between p-4 bg-[#F5F3F0] rounded-lg">
                  <div>
                    <h4 className="font-medium text-[#1A1F2E]">{a.project.brandName}</h4>
                    <p className="text-sm text-[#6B7280]">{a.project.date || 'No date'}</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => onLoad(a)} className="btn-primary text-sm py-2 px-4">Load</button>
                    <button onClick={() => {
                      const saved = JSON.parse(localStorage.getItem('conscious-compass-saved') || '[]');
                      saved.splice(i, 1);
                      localStorage.setItem('conscious-compass-saved', JSON.stringify(saved));
                      window.location.reload();
                    }} className="text-red-500 hover:text-red-700 p-2"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Main App
export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [apiKey, setApiKey] = useState(DEFAULT_API_KEY);
  const [project, setProject] = useState({
    brandName: '', websiteUrl: '', linkedinUrl: '', xUrl: '', 
    businessModel: 'b2b', industry: 'other', date: new Date().toISOString().split('T')[0]
  });
  const [assessments, setAssessments] = useState({
    website: { status: 'pending', content: '', observations: '', images: [], pagesReviewed: '', websiteContent: '' },
    social: { status: 'pending', content: '', observations: '', linkedinAbout: '', linkedinPosts: '', linkedinArticles: '', xContent: '', instagramContent: '', youtubeContent: '', hasYouTube: true, redditContent: '', wikipediaContent: '', socialImages: [] },
    aiReputation: { status: 'pending', content: '', observations: '', responses: {} },
    earnedMedia: { status: 'pending', content: '', observations: '', coveragePaste: '' },
  });
  const [scores, setScores] = useState(null);
  const [showSavedModal, setShowSavedModal] = useState(false);
  const [savedAssessments, setSavedAssessments] = useState([]);

  useEffect(() => {
    // Check if already authenticated
    if (localStorage.getItem('conscious-compass-auth') === 'true') {
      setIsAuthenticated(true);
    }
    setSavedAssessments(JSON.parse(localStorage.getItem('conscious-compass-saved') || '[]'));
  }, []);

  const steps = [
    { id: 'setup', name: 'Setup' },
    { id: 'website', name: 'Website' },
    { id: 'social', name: 'Social' },
    { id: 'ai', name: 'AI Rep' },
    { id: 'earned', name: 'Earned' },
    { id: 'scoring', name: 'Scoring' },
    { id: 'report', name: 'Report' },
  ];

  const handleNewAssessment = () => {
    if (confirm('Start a new assessment? Current progress will be lost unless saved.')) {
      setCurrentStep(0);
      setProject({ brandName: '', websiteUrl: '', linkedinUrl: '', xUrl: '', businessModel: 'b2b', industry: 'other', date: new Date().toISOString().split('T')[0] });
      setAssessments({
        website: { status: 'pending', content: '', observations: '', images: [], pagesReviewed: '', websiteContent: '' },
        social: { status: 'pending', content: '', observations: '', linkedinAbout: '', linkedinPosts: '', linkedinArticles: '', xContent: '', instagramContent: '', youtubeContent: '', hasYouTube: true, redditContent: '', wikipediaContent: '', socialImages: [] },
        aiReputation: { status: 'pending', content: '', observations: '', responses: {} },
        earnedMedia: { status: 'pending', content: '', observations: '', coveragePaste: '' },
      });
      setScores(null);
    }
  };

  const handleSave = () => {
    const saved = JSON.parse(localStorage.getItem('conscious-compass-saved') || '[]');
    const data = { project, assessments, scores, savedAt: new Date().toISOString() };
    const idx = saved.findIndex(s => s.project.brandName === project.brandName);
    if (idx >= 0) saved[idx] = data; else saved.push(data);
    localStorage.setItem('conscious-compass-saved', JSON.stringify(saved));
    setSavedAssessments(saved);
    alert('Assessment saved!');
  };

  const handleLoad = (data) => {
    setProject(data.project);
    setAssessments(data.assessments);
    setScores(data.scores);
    setCurrentStep(data.scores ? 6 : 0);
    setShowSavedModal(false);
  };

  const updateAssessment = (key, data) => setAssessments(prev => ({ ...prev, [key]: { ...prev[key], ...data } }));

  // Show password gate if not authenticated
  if (!isAuthenticated) {
    return <PasswordGate onSuccess={() => setIsAuthenticated(true)} />;
  }

  return (
    <div className="min-h-screen bg-[#FAF8F5]">
      <Header onNewAssessment={handleNewAssessment} onLoadAssessment={() => setShowSavedModal(true)} hasSavedAssessments={savedAssessments.length > 0} />
      {currentStep > 0 && <ProgressSteps currentStep={currentStep} steps={steps} />}

      {currentStep === 0 && <WelcomePage onStart={() => setCurrentStep(1)} />}
      {currentStep === 1 && <SetupPage project={project} setProject={setProject} apiKey={apiKey} setApiKey={setApiKey} onNext={() => setCurrentStep(2)} />}
      {currentStep === 2 && <WebsiteAssessment assessmentData={assessments.website} setAssessmentData={(d) => updateAssessment('website', d)} apiKey={apiKey} project={project} onPrev={() => setCurrentStep(1)} onNext={() => setCurrentStep(3)} />}
      {currentStep === 3 && <SocialMediaAssessment assessmentData={assessments.social} setAssessmentData={(d) => updateAssessment('social', d)} apiKey={apiKey} project={project} onPrev={() => setCurrentStep(2)} onNext={() => setCurrentStep(4)} />}
      {currentStep === 4 && <AIReputationPage assessmentData={assessments.aiReputation} setAssessmentData={(d) => updateAssessment('aiReputation', d)} apiKey={apiKey} project={project} onPrev={() => setCurrentStep(3)} onNext={() => setCurrentStep(5)} />}
      {currentStep === 5 && <EarnedMediaAssessment assessmentData={assessments.earnedMedia} setAssessmentData={(d) => updateAssessment('earnedMedia', d)} apiKey={apiKey} project={project} onPrev={() => setCurrentStep(4)} onNext={() => setCurrentStep(6)} />}
      {currentStep === 6 && <ScoringPage scores={scores} setScores={setScores} assessments={assessments} apiKey={apiKey} project={project} onPrev={() => setCurrentStep(5)} onNext={() => setCurrentStep(7)} />}
      {currentStep === 7 && <ReportPage project={project} scores={scores} assessments={assessments} onSave={handleSave} onPrev={() => setCurrentStep(6)} />}

      {showSavedModal && <SavedAssessmentsModal onClose={() => setShowSavedModal(false)} onLoad={handleLoad} assessments={savedAssessments} />}
    </div>
  );
}
