import { useState, useEffect, useRef } from 'react';
import { ATTRIBUTES, BUSINESS_MODELS, getMaturityStage, MATURITY_STAGES, SERVICE_RECOMMENDATIONS } from './data/rubric';
import { Compass, ArrowRight, ArrowLeft, Globe, Users, Bot, Newspaper, BarChart3, FileText, Play, Check, Loader2, ChevronDown, Download, Save, Plus, Trash2, X, Upload, Image, ExternalLink } from 'lucide-react';
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx';
import { saveAs } from 'file-saver';

const DEFAULT_API_KEY = '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';

async function callClaude(prompt, apiKey, imageBase64 = null) {
  const content = [];
  
  if (imageBase64) {
    // Extract base64 data and media type from data URL
    const matches = imageBase64.match(/^data:([^;]+);base64,(.+)$/);
    if (matches) {
      content.push({
        type: 'image',
        source: {
          type: 'base64',
          media_type: matches[1],
          data: matches[2]
        }
      });
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
    <header className="bg-[#1A1F2E] text-white py-5 px-6">
      <div className="max-w-6xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-4">
          <img src="https://ktuyiikwhspwmzvyczit.supabase.co/storage/v1/object/public/assets/brand/antenna-new-logo.svg" alt="Antenna Group" className="h-8" />
          <div className="h-6 w-px bg-gray-600" />
          <span className="text-lg font-semibold">Conscious Compass</span>
        </div>
        <div className="flex items-center gap-3">
          {hasSavedAssessments && (
            <button onClick={onLoadAssessment} className="flex items-center gap-2 text-sm text-gray-300 hover:text-white transition-colors">
              <FileText className="w-4 h-4" /> Load Saved
            </button>
          )}
          <button onClick={onNewAssessment} className="flex items-center gap-2 text-sm bg-white/10 hover:bg-white/20 px-4 py-2 rounded-lg transition-colors">
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
    <div className="min-h-[calc(100vh-80px)] flex items-center justify-center p-8">
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
function WebsiteAssessment({ assessmentData, setAssessmentData, apiKey, project, onPrev, onNext }) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [imagePreview, setImagePreview] = useState(assessmentData.homepageImage || null);
  const fileInputRef = useRef(null);

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
        setAssessmentData({ ...assessmentData, homepageImage: reader.result });
      };
      reader.readAsDataURL(file);
    }
  };

  const runAnalysis = async () => {
    setIsProcessing(true);
    setError(null);
    try {
      const prompt = imagePreview 
        ? `You are analyzing ${project.brandName}'s website (${project.websiteUrl}) based on the homepage screenshot provided.

Examine the screenshot carefully and provide a comprehensive website assessment covering:

1. **Brand Strategy & Identity** - Based on what you see, how clear is the brand positioning? What's the value proposition? How does the visual identity support the brand?

2. **Messaging & Storytelling** - What's the headline/hero messaging? Is there emotional resonance? Is the narrative compelling?

3. **User Experience** - How does the navigation appear? Is the layout intuitive? What's the visual hierarchy?

4. **Content Quality** - What can you assess about content quality from visible text? Is it benefit-focused or feature-focused?

5. **Visual Design** - How professional and distinctive is the design? Color palette, typography, imagery quality, use of whitespace?

6. **Accessibility Indicators** - Any visible accessibility concerns? Text contrast, font sizes, clear CTAs?

7. **AI Readability** - Based on visible structure, how well could AI systems understand this brand?

Write in flowing prose with specific observations from the screenshot. End with 3-5 key strengths and 3-5 priority improvements.`
        : `Provide a website assessment framework for ${project.brandName} (${project.websiteUrl}).

Since no screenshot was provided, outline what should be evaluated:

1. **Brand Strategy & Identity** - Clarity of positioning, value proposition, differentiation
2. **Messaging & Storytelling** - Headline effectiveness, emotional resonance, narrative flow
3. **User Experience** - Navigation, information architecture, visual hierarchy
4. **Content Quality** - Originality, substance, benefit focus
5. **Visual Design** - Professionalism, distinctiveness, brand consistency
6. **Accessibility** - WCAG compliance, mobile responsiveness
7. **AI Readability** - Structured data, semantic HTML, crawlability

Note: For a complete assessment, please upload a homepage screenshot. This allows detailed visual analysis.`;

      const result = await callClaude(prompt, apiKey, imagePreview);
      setAssessmentData({ ...assessmentData, status: 'complete', content: result });
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
          <p className="text-[#4A4E5A]">Analyzing {project.brandName}'s website presence</p>
        </div>
      </div>

      {/* Homepage Screenshot Upload */}
      <div className="card p-6 mb-6">
        <h3 className="font-semibold text-[#1A1F2E] mb-3 flex items-center gap-2">
          <Image className="w-5 h-5" /> Homepage Screenshot <span className="text-[#E85D3B]">*</span>
        </h3>
        <p className="text-sm text-[#6B7280] mb-4">Upload a full-page screenshot of the homepage. This is required for visual analysis — Claude will analyze what it sees in the image.</p>
        
        <input type="file" ref={fileInputRef} onChange={handleImageUpload} accept="image/*" className="hidden" />
        
        {imagePreview ? (
          <div className="relative">
            <img src={imagePreview} alt="Homepage screenshot" className="w-full max-h-64 object-cover rounded-lg border border-[#E8E4DE]" />
            <button onClick={() => { setImagePreview(null); setAssessmentData({ ...assessmentData, homepageImage: null }); }}
              className="absolute top-2 right-2 bg-white rounded-full p-1 shadow-lg hover:bg-gray-100">
              <X className="w-4 h-4" />
            </button>
            <div className="absolute bottom-2 left-2 bg-green-500 text-white text-xs px-2 py-1 rounded">
              ✓ Screenshot ready for analysis
            </div>
          </div>
        ) : (
          <button onClick={() => fileInputRef.current?.click()}
            className="w-full h-32 border-2 border-dashed border-[#E85D3B] rounded-lg flex flex-col items-center justify-center gap-2 hover:border-[#E85D3B] hover:bg-[#E85D3B]/5 transition-colors">
            <Upload className="w-6 h-6 text-[#E85D3B]" />
            <span className="text-sm text-[#E85D3B] font-medium">Click to upload homepage screenshot</span>
            <span className="text-xs text-[#6B7280]">PNG, JPG up to 10MB</span>
          </button>
        )}
      </div>

      {!isComplete && (
        <button onClick={runAnalysis} disabled={isProcessing || !imagePreview} className="btn-primary flex items-center gap-2 mb-6">
          {isProcessing ? <><Loader2 className="w-4 h-4 animate-spin" /> Analyzing Screenshot...</> : <><Play className="w-4 h-4" /> {imagePreview ? 'Analyze Screenshot' : 'Upload Screenshot First'}</>}
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

      {/* Assessor Observations */}
      <div className="card p-6 mb-8">
        <h3 className="font-semibold text-[#1A1F2E] mb-3">Assessor Observations</h3>
        <textarea value={assessmentData.observations || ''} onChange={(e) => setAssessmentData({ ...assessmentData, observations: e.target.value })}
          placeholder="Add your own observations about the website..." className="w-full h-32 px-4 py-3 border border-[#E8E4DE] rounded-lg bg-white resize-none" />
      </div>

      <div className="flex items-center justify-between pt-6 border-t border-[#E8E4DE]">
        <button onClick={onPrev} className="btn-secondary flex items-center gap-2"><ArrowLeft className="w-4 h-4" /> Back</button>
        <button onClick={onNext} disabled={!isComplete} className="btn-primary flex items-center gap-2">Continue <ArrowRight className="w-4 h-4" /></button>
      </div>
    </div>
  );
}

// Social Media Assessment with LinkedIn/X/YouTube paste fields
function SocialMediaAssessment({ assessmentData, setAssessmentData, apiKey, project, onPrev, onNext }) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [inputs, setInputs] = useState({
    linkedinAbout: assessmentData.linkedinAbout || '',
    linkedinPosts: assessmentData.linkedinPosts || '',
    linkedinArticles: assessmentData.linkedinArticles || '',
    xContent: assessmentData.xContent || '',
    youtubeContent: assessmentData.youtubeContent || '',
    hasYouTube: assessmentData.hasYouTube ?? true,
  });

  const updateInput = (key, value) => {
    setInputs(prev => ({ ...prev, [key]: value }));
    setAssessmentData({ ...assessmentData, [key]: value });
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

=== YOUTUBE DATA ===
${inputs.hasYouTube ? (inputs.youtubeContent || '[User indicated they have YouTube but no content provided]') : '[Brand does not have a YouTube channel]'}

Based on the content provided above, deliver a comprehensive social media assessment:

1. **LinkedIn Presence** - Analyze the About section messaging, post content quality, engagement rates (benchmark: 2-4% is good), thought leadership positioning, and content mix

2. **X/Twitter Presence** - Evaluate voice/tone, content strategy, engagement levels, and brand consistency

3. **YouTube Presence** - ${inputs.hasYouTube ? 'Assess channel content strategy, video topics, and recommendations for improvement' : 'The brand does not have YouTube - provide recommendation on whether they should based on their industry and audience'}

4. **Cross-Platform Consistency** - Is the brand voice and messaging consistent across platforms?

5. **Executive Presence** - Any evidence of leadership visibility on social?

6. **Content Strategy Gaps** - What's missing? What opportunities exist?

7. **AI/Search Visibility** - How does their social presence impact discoverability?

Write in flowing prose with specific observations from the content provided. End with key strengths and priority improvements.`;

      const result = await callClaude(prompt, apiKey);
      setAssessmentData({ ...assessmentData, status: 'complete', content: result, ...inputs });
    } catch (err) {
      setError(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const isComplete = assessmentData.status === 'complete';
  const hasMinimumContent = inputs.linkedinAbout || inputs.linkedinPosts || inputs.xContent || inputs.youtubeContent;

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

      {/* LinkedIn Inputs */}
      <div className="card p-6 mb-6">
        <h3 className="font-semibold text-[#1A1F2E] mb-4 flex items-center gap-2">
          <ExternalLink className="w-5 h-5" /> LinkedIn Content
        </h3>
        <p className="text-sm text-[#6B7280] mb-4">
          Visit the company's LinkedIn page and copy/paste the following:
        </p>
        
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
              placeholder="List any LinkedIn articles: titles, brief summary, engagement..." className="w-full h-24 px-4 py-3 border border-[#E8E4DE] rounded-lg bg-white resize-none text-sm" />
          </div>
        </div>
      </div>

      {/* X (Twitter) Input */}
      <div className="card p-6 mb-6">
        <h3 className="font-semibold text-[#1A1F2E] mb-4 flex items-center gap-2">
          <ExternalLink className="w-5 h-5" /> X (Twitter) Content
        </h3>
        <p className="text-sm text-[#6B7280] mb-4">
          Visit their X profile and copy/paste their bio and recent tweets:
        </p>
        <textarea value={inputs.xContent} onChange={(e) => updateInput('xContent', e.target.value)}
          placeholder="Paste their X bio, follower count, and 5-10 recent tweets with engagement metrics..." className="w-full h-32 px-4 py-3 border border-[#E8E4DE] rounded-lg bg-white resize-none text-sm" />
      </div>

      {/* YouTube Input */}
      <div className="card p-6 mb-6">
        <h3 className="font-semibold text-[#1A1F2E] mb-4 flex items-center gap-2">
          <ExternalLink className="w-5 h-5" /> YouTube Content
        </h3>
        
        <div className="mb-4">
          <label className="flex items-center gap-3 cursor-pointer">
            <input 
              type="checkbox" 
              checked={inputs.hasYouTube} 
              onChange={(e) => updateInput('hasYouTube', e.target.checked)}
              className="w-5 h-5 rounded border-gray-300 text-[#E85D3B] focus:ring-[#E85D3B]"
            />
            <span className="text-sm text-[#1A1F2E]">This brand has a YouTube channel</span>
          </label>
        </div>

        {inputs.hasYouTube && (
          <>
            <p className="text-sm text-[#6B7280] mb-4">
              Visit their YouTube channel and describe what you see:
            </p>
            <textarea value={inputs.youtubeContent} onChange={(e) => updateInput('youtubeContent', e.target.value)}
              placeholder="Describe: subscriber count, number of videos, recent video titles and view counts, content themes, posting frequency..." className="w-full h-32 px-4 py-3 border border-[#E8E4DE] rounded-lg bg-white resize-none text-sm" />
          </>
        )}
        
        {!inputs.hasYouTube && (
          <p className="text-sm text-[#6B7280] italic">The assessment will include a recommendation on whether they should have a YouTube presence.</p>
        )}
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

      {/* Assessor Observations */}
      <div className="card p-6 mb-8">
        <h3 className="font-semibold text-[#1A1F2E] mb-3">Assessor Observations</h3>
        <textarea value={assessmentData.observations || ''} onChange={(e) => setAssessmentData({ ...assessmentData, observations: e.target.value })}
          placeholder="Add your own observations..." className="w-full h-32 px-4 py-3 border border-[#E8E4DE] rounded-lg bg-white resize-none" />
      </div>

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

      <div className="card p-6 mb-8">
        <h3 className="font-semibold text-[#1A1F2E] mb-3">Assessor Observations</h3>
        <textarea value={assessmentData.observations || ''} onChange={(e) => setAssessmentData({ ...assessmentData, observations: e.target.value })}
          placeholder="Add your own observations..." className="w-full h-32 px-4 py-3 border border-[#E8E4DE] rounded-lg bg-white resize-none" />
      </div>

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

Please also search for any additional earned media coverage for ${project.brandName} from the last 3 months including:
- News articles and press mentions
- Trade publication coverage
- Analyst reports and mentions
- Podcast appearances
- Awards and recognition
- Industry event mentions

Provide a comprehensive earned media assessment:
1. Coverage Volume & Quality - How much coverage? What tier publications?
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

      <div className="card p-6 mb-8">
        <h3 className="font-semibold text-[#1A1F2E] mb-3">Assessor Observations</h3>
        <textarea value={assessmentData.observations || ''} onChange={(e) => setAssessmentData({ ...assessmentData, observations: e.target.value })}
          placeholder="Add your own observations..." className="w-full h-32 px-4 py-3 border border-[#E8E4DE] rounded-lg bg-white resize-none" />
      </div>

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

  const overall = scores ? Math.round(Object.values(scores).reduce((a, v) => a + v.score, 0) / 8) : 0;
  const stage = getMaturityStage(overall);

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

  const generateDocx = async () => {
    setIsGenerating(true);
    try {
      const doc = new Document({
        styles: { default: { document: { run: { font: 'Arial', size: 24 } } } },
        sections: [{
          properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } },
          children: [
            new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(`${project.brandName} — Conscious Compass Assessment`)] }),
            new Paragraph({ children: [new TextRun({ text: `Assessment Date: ${project.date || new Date().toLocaleDateString()}`, italics: true })] }),
            new Paragraph({ children: [new TextRun({ text: `Overall Score: ${overall}/100 — ${stage.name}`, bold: true })] }),
            new Paragraph({ children: [new TextRun('')] }),
            new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun('Executive Summary')] }),
            new Paragraph({ children: [new TextRun(`${project.brandName} achieved an overall Brand Consciousness Score of ${overall}/100, placing them in the ${stage.name} maturity stage. ${stage.description}.`)] }),
            new Paragraph({ children: [new TextRun('')] }),
            new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun('Attribute Scores')] }),
            ...ATTRIBUTES.flatMap(attr => [
              new Paragraph({ children: [new TextRun({ text: `${attr.name} — ${attr.fullName}: ${scores[attr.id]?.score || 0}/100`, bold: true })] }),
              new Paragraph({ children: [new TextRun(scores[attr.id]?.summary || attr.description)] }),
              new Paragraph({ children: [new TextRun('')] }),
            ]),
            new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun('Integrated Marketing Recommendations')] }),
            new Paragraph({ children: [new TextRun({ text: 'Based on your assessment, here are 12 priority recommendations to enhance your brand consciousness:', italics: true })] }),
            new Paragraph({ children: [new TextRun('')] }),
            ...recommendations.map((r, i) => new Paragraph({ children: [new TextRun(`${i + 1}. [${r.attr}] ${r.rec}`)] })),
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
          <p className="text-[#6B7280]">Conscious Compass Assessment Report</p>
        </div>
        <div className="flex gap-3">
          <button onClick={onSave} className="btn-secondary flex items-center gap-2"><Save className="w-4 h-4" /> Save</button>
          <button onClick={generateDocx} disabled={isGenerating} className="btn-primary flex items-center gap-2">
            {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} Download DOCX
          </button>
        </div>
      </div>

      {/* Spider Chart */}
      <div className="card p-6 mb-8">
        <h3 className="text-lg font-semibold text-[#1A1F2E] mb-4 text-center">Brand Consciousness Profile</h3>
        <SpiderChart scores={scores} size={450} />
      </div>

      {/* Maturity Continuum */}
      <MaturityContinuum score={overall} />

      {/* Attributes */}
      <h3 className="text-xl font-semibold text-[#1A1F2E] mt-8 mb-4">Attribute Analysis</h3>
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
      <h3 className="text-xl font-semibold text-[#1A1F2E] mb-4">Integrated Marketing Recommendations</h3>
      <p className="text-[#6B7280] mb-4">Based on your assessment, here are 12 priority recommendations to enhance your brand consciousness:</p>
      <div className="card p-6 mb-8">
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
  const [currentStep, setCurrentStep] = useState(0);
  const [apiKey, setApiKey] = useState(DEFAULT_API_KEY);
  const [project, setProject] = useState({
    brandName: '', websiteUrl: '', linkedinUrl: '', xUrl: '', 
    businessModel: 'b2b', date: new Date().toISOString().split('T')[0]
  });
  const [assessments, setAssessments] = useState({
    website: { status: 'pending', content: '', observations: '', homepageImage: null },
    social: { status: 'pending', content: '', observations: '', linkedinAbout: '', linkedinPosts: '', linkedinArticles: '', xContent: '', youtubeContent: '', hasYouTube: true },
    aiReputation: { status: 'pending', content: '', observations: '', responses: {} },
    earnedMedia: { status: 'pending', content: '', observations: '', coveragePaste: '' },
  });
  const [scores, setScores] = useState(null);
  const [showSavedModal, setShowSavedModal] = useState(false);
  const [savedAssessments, setSavedAssessments] = useState([]);

  useEffect(() => {
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
      setProject({ brandName: '', websiteUrl: '', linkedinUrl: '', xUrl: '', businessModel: 'b2b', date: new Date().toISOString().split('T')[0] });
      setAssessments({
        website: { status: 'pending', content: '', observations: '', homepageImage: null },
        social: { status: 'pending', content: '', observations: '', linkedinAbout: '', linkedinPosts: '', linkedinArticles: '', xContent: '', youtubeContent: '', hasYouTube: true },
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
