import { useState, useEffect } from 'react';
import { ATTRIBUTES, BUSINESS_MODELS, getMaturityStage, SERVICE_RECOMMENDATIONS } from './data/rubric';
import { Compass, ArrowRight, ArrowLeft, Globe, Users, Bot, Newspaper, BarChart3, FileText, Play, Check, Loader2, ChevronDown, ChevronUp, Download, RefreshCw, Save, Plus, Trash2, X } from 'lucide-react';
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx';
import { saveAs } from 'file-saver';

// Pre-loaded API Key
const DEFAULT_API_KEY = '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';

// API Client
async function callClaude(prompt, apiKey) {
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
      messages: [{ role: 'user', content: prompt }]
    })
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `API error: ${response.status}`);
  }
  const data = await response.json();
  return data.content[0].text;
}

// Header
function Header({ onNewAssessment, onLoadAssessment, hasSavedAssessments }) {
  return (
    <header className="bg-[#1A1F2E] text-white py-5 px-6">
      <div className="max-w-6xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-4">
          <img src="https://ktuyiikwhspwmzvyczit.supabase.co/storage/v1/object/public/assets/brand/antenna-new-logo.svg" alt="Antenna Group" className="h-8" />
          <div className="h-6 w-px bg-gray-600" />
          <span className="text-lg font-semibold" style={{ fontFamily: 'Source Serif 4, serif' }}>Conscious Compass</span>
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
        <h1 className="text-5xl md:text-6xl font-semibold text-[#1A1F2E] mb-6 leading-tight" style={{ fontFamily: 'Source Serif 4, serif' }}>
          Consequential brands are conscious brands.
        </h1>
        <p className="text-xl text-[#4A4E5A] mb-8 leading-relaxed max-w-2xl mx-auto">
          They don't just show up, they stand out. They don't follow trends; they shape narratives. 
          The Conscious Compass explores your brand's impact across 8 essential attributes.
        </p>
        <button onClick={onStart} className="btn-primary inline-flex items-center gap-3 text-lg">
          Start Assessment <ArrowRight className="w-5 h-5" />
        </button>
        <p className="mt-6 text-sm text-[#6B7280]">
          Complete assessment in approximately 20-30 minutes
        </p>
      </div>
    </div>
  );
}

// Setup Page with extended fields
function SetupPage({ project, setProject, apiKey, setApiKey, onNext }) {
  const canProceed = project.brandName && project.websiteUrl;

  return (
    <div className="max-w-2xl mx-auto p-8 animate-fade-in">
      <h2 className="text-3xl font-semibold text-[#1A1F2E] mb-2" style={{ fontFamily: 'Source Serif 4, serif' }}>Brand Details</h2>
      <p className="text-[#4A4E5A] mb-8">Tell us about the brand you're assessing.</p>

      <div className="space-y-6">
        {/* Brand Name */}
        <div>
          <label className="block text-sm font-medium text-[#1A1F2E] mb-2">Brand Name *</label>
          <input
            type="text"
            value={project.brandName}
            onChange={(e) => setProject({ ...project, brandName: e.target.value })}
            placeholder="e.g., Antenna Group"
            className="w-full px-4 py-3 border border-[#E8E4DE] rounded-lg bg-white"
          />
        </div>

        {/* Website */}
        <div>
          <label className="block text-sm font-medium text-[#1A1F2E] mb-2">Website URL *</label>
          <input
            type="url"
            value={project.websiteUrl}
            onChange={(e) => setProject({ ...project, websiteUrl: e.target.value })}
            placeholder="https://www.example.com"
            className="w-full px-4 py-3 border border-[#E8E4DE] rounded-lg bg-white"
          />
        </div>

        {/* Social Links */}
        <div className="grid md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-[#1A1F2E] mb-2">LinkedIn URL</label>
            <input
              type="url"
              value={project.linkedinUrl}
              onChange={(e) => setProject({ ...project, linkedinUrl: e.target.value })}
              placeholder="linkedin.com/company/..."
              className="w-full px-4 py-3 border border-[#E8E4DE] rounded-lg bg-white text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#1A1F2E] mb-2">X (Twitter) URL</label>
            <input
              type="url"
              value={project.xUrl}
              onChange={(e) => setProject({ ...project, xUrl: e.target.value })}
              placeholder="x.com/..."
              className="w-full px-4 py-3 border border-[#E8E4DE] rounded-lg bg-white text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#1A1F2E] mb-2">Facebook URL</label>
            <input
              type="url"
              value={project.facebookUrl}
              onChange={(e) => setProject({ ...project, facebookUrl: e.target.value })}
              placeholder="facebook.com/..."
              className="w-full px-4 py-3 border border-[#E8E4DE] rounded-lg bg-white text-sm"
            />
          </div>
        </div>

        {/* Business Model */}
        <div>
          <label className="block text-sm font-medium text-[#1A1F2E] mb-2">Business Model</label>
          <select
            value={project.businessModel}
            onChange={(e) => setProject({ ...project, businessModel: e.target.value })}
            className="w-full px-4 py-3 border border-[#E8E4DE] rounded-lg bg-white"
          >
            {BUSINESS_MODELS.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>

        {/* API Key */}
        <div className="pt-4 border-t border-[#E8E4DE]">
          <label className="block text-sm font-medium text-[#1A1F2E] mb-2">Claude API Key</label>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="sk-ant-..."
            className="w-full px-4 py-3 border border-[#E8E4DE] rounded-lg bg-white font-mono text-sm"
          />
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

// Assessment Step with observations field
function AssessmentStep({ title, description, icon: Icon, steps, assessmentData, setAssessmentData, apiKey, project, onPrev, onNext }) {
  const [currentSubStep, setCurrentSubStep] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [expanded, setExpanded] = useState({});

  const isComplete = assessmentData.status === 'complete';

  const runStep = async (index) => {
    const step = steps[index];
    setIsProcessing(true);
    setError(null);

    try {
      const prompt = typeof step.prompt === 'function' ? step.prompt(project, assessmentData.steps) : step.prompt;
      const result = await callClaude(prompt, apiKey);
      
      const newSteps = { ...assessmentData.steps, [step.id]: result };
      setAssessmentData({ ...assessmentData, steps: newSteps });
      setExpanded({ ...expanded, [step.id]: true });
      
      if (index === steps.length - 1) {
        setAssessmentData({ ...assessmentData, steps: newSteps, status: 'complete', content: result });
      }
      setCurrentSubStep(index + 1);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const runAll = async () => {
    for (let i = Object.keys(assessmentData.steps || {}).length; i < steps.length; i++) {
      await runStep(i);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-8 animate-fade-in">
      <div className="flex items-start gap-4 mb-8">
        <div className="w-14 h-14 bg-[#E85D3B]/10 rounded-xl flex items-center justify-center">
          <Icon className="w-7 h-7 text-[#E85D3B]" />
        </div>
        <div>
          <h2 className="text-2xl font-semibold text-[#1A1F2E]" style={{ fontFamily: 'Source Serif 4, serif' }}>{title}</h2>
          <p className="text-[#4A4E5A]">{description}</p>
        </div>
      </div>

      {!isComplete && !isProcessing && (
        <button onClick={runAll} className="btn-primary flex items-center gap-2 mb-6">
          <Play className="w-4 h-4" /> Run Complete Analysis
        </button>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 text-red-700">
          <p className="font-medium">Error</p>
          <p className="text-sm">{error}</p>
          <button onClick={() => runStep(Object.keys(assessmentData.steps || {}).length)} className="text-sm text-red-600 hover:underline mt-2 flex items-center gap-1">
            <RefreshCw className="w-3 h-3" /> Retry
          </button>
        </div>
      )}

      <div className="space-y-3 mb-8">
        {steps.map((step, index) => {
          const isDone = assessmentData.steps?.[step.id];
          const isCurrent = index === Object.keys(assessmentData.steps || {}).length;
          
          return (
            <div key={step.id} className={`card transition-all ${isDone ? 'bg-[#F5F3F0] border-[#E85D3B]/30' : isCurrent ? 'border-[#E85D3B] shadow-md' : ''}`}>
              <div className="p-4 flex items-center gap-4 cursor-pointer" onClick={() => isDone && setExpanded({ ...expanded, [step.id]: !expanded[step.id] })}>
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  isDone ? 'bg-[#E85D3B] text-white' : isCurrent && isProcessing ? 'bg-[#E85D3B]/10' : isCurrent ? 'bg-[#E85D3B]/10 text-[#E85D3B]' : 'bg-[#F5F3F0] text-gray-400'
                }`}>
                  {isDone ? <Check className="w-5 h-5" /> : isCurrent && isProcessing ? <Loader2 className="w-5 h-5 animate-spin text-[#E85D3B]" /> : index + 1}
                </div>
                <div className="flex-1">
                  <h4 className="font-medium text-[#1A1F2E]">{step.name}</h4>
                  <p className="text-sm text-[#6B7280]">{step.description}</p>
                </div>
                {isDone && <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${expanded[step.id] ? 'rotate-180' : ''}`} />}
              </div>
              {isDone && expanded[step.id] && (
                <div className="px-4 pb-4">
                  <div className="bg-white rounded-lg p-4 max-h-72 overflow-y-auto border border-[#E8E4DE]">
                    <pre className="text-sm text-[#4A4E5A] whitespace-pre-wrap font-sans">{assessmentData.steps[step.id]}</pre>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Assessor Observations */}
      <div className="card p-6 mb-8">
        <h3 className="font-semibold text-[#1A1F2E] mb-3">Assessor Observations</h3>
        <p className="text-sm text-[#6B7280] mb-3">Add your own direct observations from reviewing this area.</p>
        <textarea
          value={assessmentData.observations || ''}
          onChange={(e) => setAssessmentData({ ...assessmentData, observations: e.target.value })}
          placeholder="Enter your observations here..."
          className="w-full h-32 px-4 py-3 border border-[#E8E4DE] rounded-lg bg-white resize-none"
        />
      </div>

      {isComplete && (
        <div className="bg-[#E85D3B]/5 border border-[#E85D3B]/20 rounded-xl p-6 text-center mb-8">
          <Check className="w-12 h-12 text-[#E85D3B] mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-[#1A1F2E] mb-1">Assessment Complete</h3>
          <p className="text-[#4A4E5A]">Ready to proceed to the next step.</p>
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
  const [manualInput, setManualInput] = useState({ gemini: '', chatgpt: '' });
  const [isProcessing, setIsProcessing] = useState({});
  const [error, setError] = useState(null);

  const standardQuery = `Please describe ${project.brandName}, what they do, why they do it and how they do it, and provide an overview of their reputation and credibility. Do they have any red flags or are there any risks working with them?`;

  const queryClaude = async () => {
    setIsProcessing(p => ({ ...p, claude: true }));
    try {
      const result = await callClaude(standardQuery, apiKey);
      const newResponses = { ...responses, claude: result };
      setResponses(newResponses);
      setAssessmentData({ ...assessmentData, responses: newResponses });
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

Provide a comprehensive AI reputation assessment covering:
1. Where all three converge (likely accurate)
2. Where they diverge (discrepancies)
3. Overall sentiment
4. Structural vulnerabilities
5. Recommendations to improve AI representation

Write in flowing prose.`;

      const result = await callClaude(prompt, apiKey);
      setAssessmentData({ 
        ...assessmentData, 
        status: 'complete', 
        content: result, 
        responses: { ...responses, ...manualInput }
      });
    } catch (e) { setError(e.message); }
    finally { setIsProcessing(p => ({ ...p, synthesis: false })); }
  };

  return (
    <div className="max-w-4xl mx-auto p-8 animate-fade-in">
      <div className="flex items-start gap-4 mb-8">
        <div className="w-14 h-14 bg-[#8B5CF6]/10 rounded-xl flex items-center justify-center">
          <Bot className="w-7 h-7 text-[#8B5CF6]" />
        </div>
        <div>
          <h2 className="text-2xl font-semibold text-[#1A1F2E]" style={{ fontFamily: 'Source Serif 4, serif' }}>AI Reputation Assessment</h2>
          <p className="text-[#4A4E5A]">How does {project.brandName} appear across AI search engines?</p>
        </div>
      </div>

      <div className="bg-[#F5F3F0] rounded-lg p-4 mb-6">
        <p className="text-sm text-[#6B7280] mb-2">Standard query sent to all AI systems:</p>
        <p className="text-[#1A1F2E] italic">"{standardQuery}"</p>
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
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${responses.claude ? 'bg-[#E85D3B] text-white' : 'bg-[#F5F3F0]'}`}>
              {isProcessing.claude ? <Loader2 className="w-5 h-5 animate-spin" /> : responses.claude ? <Check className="w-5 h-5" /> : <Bot className="w-5 h-5 text-gray-400" />}
            </div>
            <div className="flex-1">
              <h4 className="font-medium">Claude (Anthropic)</h4>
              <p className="text-sm text-[#6B7280]">{responses.claude ? 'Response received' : 'Awaiting query'}</p>
            </div>
          </div>
          {responses.claude && <div className="mt-3 bg-white rounded-lg p-3 max-h-40 overflow-y-auto text-sm text-[#4A4E5A] border border-[#E8E4DE]">{responses.claude}</div>}
        </div>

        {/* Gemini */}
        <div className={`card p-4 ${responses.gemini || manualInput.gemini ? 'bg-[#F5F3F0]' : ''}`}>
          <div className="flex items-center gap-3 mb-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${responses.gemini || manualInput.gemini ? 'bg-[#E85D3B] text-white' : 'bg-[#F5F3F0]'}`}>
              {(responses.gemini || manualInput.gemini) ? <Check className="w-5 h-5" /> : <Bot className="w-5 h-5 text-gray-400" />}
            </div>
            <div className="flex-1">
              <h4 className="font-medium">Gemini (Google)</h4>
              <p className="text-sm text-[#6B7280]">Paste response from gemini.google.com</p>
            </div>
          </div>
          <textarea
            value={manualInput.gemini}
            onChange={(e) => setManualInput(m => ({ ...m, gemini: e.target.value }))}
            placeholder="Paste Gemini's response here..."
            className="w-full h-24 px-3 py-2 border border-[#E8E4DE] rounded-lg text-sm bg-white"
          />
        </div>

        {/* ChatGPT */}
        <div className={`card p-4 ${responses.chatgpt || manualInput.chatgpt ? 'bg-[#F5F3F0]' : ''}`}>
          <div className="flex items-center gap-3 mb-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${responses.chatgpt || manualInput.chatgpt ? 'bg-[#E85D3B] text-white' : 'bg-[#F5F3F0]'}`}>
              {(responses.chatgpt || manualInput.chatgpt) ? <Check className="w-5 h-5" /> : <Bot className="w-5 h-5 text-gray-400" />}
            </div>
            <div className="flex-1">
              <h4 className="font-medium">ChatGPT (OpenAI)</h4>
              <p className="text-sm text-[#6B7280]">Paste response from chatgpt.com</p>
            </div>
          </div>
          <textarea
            value={manualInput.chatgpt}
            onChange={(e) => setManualInput(m => ({ ...m, chatgpt: e.target.value }))}
            placeholder="Paste ChatGPT's response here..."
            className="w-full h-24 px-3 py-2 border border-[#E8E4DE] rounded-lg text-sm bg-white"
          />
        </div>
      </div>

      {hasAllResponses && !isComplete && (
        <button onClick={generateSynthesis} disabled={isProcessing.synthesis} className="btn-primary flex items-center gap-2 w-full justify-center mb-6">
          {isProcessing.synthesis ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating...</> : <><Play className="w-4 h-4" /> Generate Synthesis</>}
        </button>
      )}

      {isComplete && (
        <div className="bg-[#8B5CF6]/5 border border-[#8B5CF6]/20 rounded-xl p-4 mb-6">
          <h4 className="font-medium text-[#1A1F2E] mb-2 flex items-center gap-2"><Check className="w-5 h-5 text-[#8B5CF6]" /> Synthesis Complete</h4>
          <div className="bg-white rounded-lg p-4 max-h-64 overflow-y-auto text-sm text-[#4A4E5A] border border-[#E8E4DE]">{assessmentData.content}</div>
        </div>
      )}

      {/* Assessor Observations */}
      <div className="card p-6 mb-8">
        <h3 className="font-semibold text-[#1A1F2E] mb-3">Assessor Observations</h3>
        <textarea
          value={assessmentData.observations || ''}
          onChange={(e) => setAssessmentData({ ...assessmentData, observations: e.target.value })}
          placeholder="Enter your observations here..."
          className="w-full h-32 px-4 py-3 border border-[#E8E4DE] rounded-lg bg-white resize-none"
        />
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
      const prompt = `You are scoring ${project.brandName} against the Conscious Compass Framework.

ASSESSMENT DATA:
Website: ${assessments.website.content}
${assessments.website.observations ? `Assessor Observations: ${assessments.website.observations}` : ''}

Social Media: ${assessments.social.content}
${assessments.social.observations ? `Assessor Observations: ${assessments.social.observations}` : ''}

AI Reputation: ${assessments.aiReputation.content}
${assessments.aiReputation.observations ? `Assessor Observations: ${assessments.aiReputation.observations}` : ''}

Earned Media: ${assessments.earnedMedia.content}
${assessments.earnedMedia.observations ? `Assessor Observations: ${assessments.earnedMedia.observations}` : ''}

Score each of these 8 attributes from 0-100:
${ATTRIBUTES.map(a => `${a.id} (${a.fullName}): ${a.description}`).join('\n')}

Return ONLY valid JSON in this exact format:
{"AWAKE":{"score":45,"summary":"2-3 sentence explanation"},"AWARE":{"score":52,"summary":"..."},"REFLECTIVE":{"score":38,"summary":"..."},"ATTENTIVE":{"score":55,"summary":"..."},"COGENT":{"score":42,"summary":"..."},"SENTIENT":{"score":35,"summary":"..."},"VISIONARY":{"score":48,"summary":"..."},"INTENTIONAL":{"score":50,"summary":"..."}}`;

      const result = await callClaude(prompt, apiKey);
      const match = result.match(/\{[\s\S]*\}/);
      if (match) {
        const parsed = JSON.parse(match[0]);
        setScores(parsed);
      }
    } catch (e) { setError(e.message); }
    finally { setIsProcessing(false); }
  };

  const overall = scores ? Math.round(Object.values(scores).reduce((a, v) => a + v.score, 0) / 8) : 0;
  const stage = getMaturityStage(overall);

  return (
    <div className="max-w-4xl mx-auto p-8 animate-fade-in">
      <div className="flex items-start gap-4 mb-8">
        <div className="w-14 h-14 bg-[#3B82F6]/10 rounded-xl flex items-center justify-center">
          <BarChart3 className="w-7 h-7 text-[#3B82F6]" />
        </div>
        <div>
          <h2 className="text-2xl font-semibold text-[#1A1F2E]" style={{ fontFamily: 'Source Serif 4, serif' }}>Scoring & Analysis</h2>
          <p className="text-[#4A4E5A]">AI-generated scores based on the four assessment documents.</p>
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
          <div className="card p-8 mb-8 text-center">
            <div className="text-6xl font-bold mb-2" style={{ color: stage.color, fontFamily: 'Source Serif 4, serif' }}>{overall}</div>
            <div className="text-xl font-semibold mb-1" style={{ color: stage.color }}>{stage.name}</div>
            <p className="text-[#6B7280] text-sm">{stage.description}</p>
          </div>

          <div className="grid md:grid-cols-2 gap-4 mb-8">
            {ATTRIBUTES.map(attr => (
              <div key={attr.id} className="card p-5">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <span className="text-sm font-medium text-[#6B7280]">{attr.name}</span>
                    <h4 className="font-semibold text-[#1A1F2E]">{attr.fullName}</h4>
                  </div>
                  <span className="text-2xl font-bold" style={{ color: attr.color }}>{scores[attr.id]?.score || 0}</span>
                </div>
                <div className="h-2 bg-[#F5F3F0] rounded-full overflow-hidden mb-3">
                  <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${scores[attr.id]?.score || 0}%`, backgroundColor: attr.color }} />
                </div>
                <p className="text-sm text-[#4A4E5A]">{scores[attr.id]?.summary || attr.description}</p>
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

// Report Page with visible assessment
function ReportPage({ project, scores, assessments, onSave, onPrev }) {
  const [isGenerating, setIsGenerating] = useState(false);

  const overall = scores ? Math.round(Object.values(scores).reduce((a, v) => a + v.score, 0) / 8) : 0;
  const stage = getMaturityStage(overall);

  // Get recommendations for lowest scoring attributes
  const sortedAttrs = ATTRIBUTES.map(a => ({ ...a, score: scores[a.id]?.score || 0 })).sort((a, b) => a.score - b.score);
  const recommendations = sortedAttrs.slice(0, 3).flatMap(attr => 
    (SERVICE_RECOMMENDATIONS[attr.id] || []).slice(0, 3).map(rec => ({ attr: attr.name, rec }))
  );

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
            new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun('Priority Recommendations')] }),
            ...recommendations.map((r, i) => new Paragraph({ children: [new TextRun(`${i + 1}. ${r.attr}: ${r.rec}`)] })),
          ]
        }]
      });

      const buffer = await Packer.toBuffer(doc);
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
      saveAs(blob, `${project.brandName.replace(/\s+/g, '_')}_Conscious_Compass_Report.docx`);
    } catch (e) {
      console.error(e);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto p-8 animate-fade-in">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-3xl font-semibold text-[#1A1F2E]" style={{ fontFamily: 'Source Serif 4, serif' }}>{project.brandName}</h2>
          <p className="text-[#6B7280]">Conscious Compass Assessment Report</p>
        </div>
        <div className="flex gap-3">
          <button onClick={onSave} className="btn-secondary flex items-center gap-2">
            <Save className="w-4 h-4" /> Save Assessment
          </button>
          <button onClick={generateDocx} disabled={isGenerating} className="btn-primary flex items-center gap-2">
            {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} Download DOCX
          </button>
        </div>
      </div>

      {/* Overall Score */}
      <div className="card p-8 mb-8 text-center">
        <div className="text-7xl font-bold mb-2" style={{ color: stage.color, fontFamily: 'Source Serif 4, serif' }}>{overall}</div>
        <div className="text-2xl font-semibold mb-2" style={{ color: stage.color }}>{stage.name}</div>
        <p className="text-[#6B7280] max-w-lg mx-auto">{stage.description}</p>
      </div>

      {/* Attribute Breakdown */}
      <h3 className="text-xl font-semibold text-[#1A1F2E] mb-4" style={{ fontFamily: 'Source Serif 4, serif' }}>Attribute Scores</h3>
      <div className="grid md:grid-cols-2 gap-4 mb-8">
        {ATTRIBUTES.map(attr => (
          <div key={attr.id} className="card p-5">
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="inline-block px-2 py-1 rounded text-xs font-semibold text-white mb-2" style={{ backgroundColor: attr.color }}>{attr.name}</div>
                <h4 className="font-semibold text-[#1A1F2E]">{attr.fullName}</h4>
              </div>
              <span className="text-3xl font-bold" style={{ color: attr.color }}>{scores[attr.id]?.score || 0}</span>
            </div>
            <p className="text-sm text-[#4A4E5A] mb-3">{scores[attr.id]?.summary || attr.description}</p>
            <div className="h-2 bg-[#F5F3F0] rounded-full overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${scores[attr.id]?.score || 0}%`, backgroundColor: attr.color }} />
            </div>
          </div>
        ))}
      </div>

      {/* Recommendations */}
      <h3 className="text-xl font-semibold text-[#1A1F2E] mb-4" style={{ fontFamily: 'Source Serif 4, serif' }}>Priority Recommendations</h3>
      <div className="card p-6 mb-8">
        <div className="space-y-3">
          {recommendations.map((r, i) => (
            <div key={i} className="flex items-start gap-4 py-3 border-b border-[#E8E4DE] last:border-0">
              <div className="w-8 h-8 rounded-full bg-[#E85D3B] text-white flex items-center justify-center font-semibold text-sm">{i + 1}</div>
              <div>
                <span className="text-sm font-medium text-[#E85D3B]">{r.attr}</span>
                <p className="text-[#1A1F2E]">{r.rec}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-start pt-6 border-t border-[#E8E4DE]">
        <button onClick={onPrev} className="btn-secondary flex items-center gap-2"><ArrowLeft className="w-4 h-4" /> Back to Scoring</button>
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
    brandName: '', websiteUrl: '', linkedinUrl: '', xUrl: '', facebookUrl: '', businessModel: 'b2b', date: new Date().toISOString().split('T')[0]
  });
  const [assessments, setAssessments] = useState({
    website: { status: 'pending', content: '', steps: {}, observations: '' },
    social: { status: 'pending', content: '', steps: {}, observations: '' },
    aiReputation: { status: 'pending', content: '', responses: {}, observations: '' },
    earnedMedia: { status: 'pending', content: '', steps: {}, observations: '' },
  });
  const [scores, setScores] = useState(null);
  const [showSavedModal, setShowSavedModal] = useState(false);
  const [savedAssessments, setSavedAssessments] = useState([]);

  useEffect(() => {
    const saved = JSON.parse(localStorage.getItem('conscious-compass-saved') || '[]');
    setSavedAssessments(saved);
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

  const websiteSteps = [
    { id: 'initial', name: 'Brand Review', description: 'Strategy, identity, messaging', prompt: (p) => `Review ${p.brandName} website at ${p.websiteUrl}. Evaluate brand strategy, identity, messaging, storytelling, UX, information architecture. Be thorough and specific.` },
    { id: 'content', name: 'Content Analysis', description: 'Hierarchy, journeys, segmentation', prompt: (p) => `Analyze ${p.brandName} content hierarchy: audience segments, user journeys, benefit visibility, culture leverage.` },
    { id: 'visual', name: 'Visual Assessment', description: 'Design, differentiation', prompt: (p) => `Assess ${p.brandName} visual brand: differentiation, stock/AI content, emotional connection, typography, color.` },
    { id: 'accessibility', name: 'Accessibility', description: 'WCAG, AI indexability', prompt: (p) => `Audit ${p.brandName} accessibility: text as images, alt text, heading hierarchy, WCAG compliance, AI indexability.` },
    { id: 'synthesis', name: 'Synthesis', description: 'Issues, opportunities, recommendations', prompt: (p, steps) => `Based on:\n${Object.values(steps).join('\n\n')}\n\nProduce website assessment for ${p.brandName}: issues, opportunities, prioritized recommendations. Flowing prose.` },
  ];

  const socialSteps = [
    { id: 'linkedin', name: 'LinkedIn', description: 'Company presence, engagement', prompt: (p) => `Evaluate ${p.brandName} LinkedIn${p.linkedinUrl ? ` at ${p.linkedinUrl}` : ''}: followers, engagement (2-4% benchmark), content types, thought leadership.` },
    { id: 'other', name: 'Other Platforms', description: 'X, Facebook, YouTube', prompt: (p) => `Assess ${p.brandName} on X${p.xUrl ? ` (${p.xUrl})` : ''}, Facebook${p.facebookUrl ? ` (${p.facebookUrl})` : ''}, and YouTube. What's their presence and activity?` },
    { id: 'aivis', name: 'AI Visibility', description: 'Reddit, Wikipedia', prompt: (p) => `Check ${p.brandName} on Reddit, Wikipedia. Explain significance for AI search visibility.` },
    { id: 'synthesis', name: 'Synthesis', description: 'Complete assessment', prompt: (p, steps) => `Based on:\n${Object.values(steps).join('\n\n')}\n\nProduce social media assessment for ${p.brandName}. Flowing prose.` },
  ];

  const earnedSteps = [
    { id: 'search', name: 'Coverage Search', description: 'Find earned media', prompt: (p) => `Search for ${p.brandName} earned media: news, trade publications, analyst coverage, podcasts, awards.` },
    { id: 'analysis', name: 'Analysis', description: 'Sentiment, credibility', prompt: (p) => `Analyze ${p.brandName} earned media: sentiment, credibility, audience benefit, brand alignment.` },
    { id: 'strategy', name: 'PR Strategy', description: 'Recommendations', prompt: (p) => `Recommend PR strategy for ${p.brandName}: awareness, reputation building, credibility establishment.` },
    { id: 'synthesis', name: 'Synthesis', description: 'Complete assessment', prompt: (p, steps) => `Based on:\n${Object.values(steps).join('\n\n')}\n\nProduce earned media assessment for ${p.brandName}. Flowing prose.` },
  ];

  const handleNewAssessment = () => {
    if (confirm('Start a new assessment? Current progress will be lost unless saved.')) {
      setCurrentStep(0);
      setProject({ brandName: '', websiteUrl: '', linkedinUrl: '', xUrl: '', facebookUrl: '', businessModel: 'b2b', date: new Date().toISOString().split('T')[0] });
      setAssessments({
        website: { status: 'pending', content: '', steps: {}, observations: '' },
        social: { status: 'pending', content: '', steps: {}, observations: '' },
        aiReputation: { status: 'pending', content: '', responses: {}, observations: '' },
        earnedMedia: { status: 'pending', content: '', steps: {}, observations: '' },
      });
      setScores(null);
    }
  };

  const handleSave = () => {
    const saved = JSON.parse(localStorage.getItem('conscious-compass-saved') || '[]');
    const data = { project, assessments, scores, savedAt: new Date().toISOString() };
    const existingIndex = saved.findIndex(s => s.project.brandName === project.brandName);
    if (existingIndex >= 0) {
      saved[existingIndex] = data;
    } else {
      saved.push(data);
    }
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

  const updateAssessment = (key, data) => {
    setAssessments(prev => ({ ...prev, [key]: { ...prev[key], ...data } }));
  };

  return (
    <div className="min-h-screen bg-[#FAF8F5]">
      <Header 
        onNewAssessment={handleNewAssessment} 
        onLoadAssessment={() => setShowSavedModal(true)}
        hasSavedAssessments={savedAssessments.length > 0}
      />
      
      {currentStep > 0 && <ProgressSteps currentStep={currentStep} steps={steps} />}

      {currentStep === 0 && <WelcomePage onStart={() => setCurrentStep(1)} />}
      {currentStep === 1 && <SetupPage project={project} setProject={setProject} apiKey={apiKey} setApiKey={setApiKey} onNext={() => setCurrentStep(2)} />}
      {currentStep === 2 && <AssessmentStep title="Website Assessment" description={`Analyzing ${project.brandName}'s website`} icon={Globe} steps={websiteSteps} assessmentData={assessments.website} setAssessmentData={(d) => updateAssessment('website', d)} apiKey={apiKey} project={project} onPrev={() => setCurrentStep(1)} onNext={() => setCurrentStep(3)} />}
      {currentStep === 3 && <AssessmentStep title="Social Media Assessment" description={`Evaluating ${project.brandName}'s social presence`} icon={Users} steps={socialSteps} assessmentData={assessments.social} setAssessmentData={(d) => updateAssessment('social', d)} apiKey={apiKey} project={project} onPrev={() => setCurrentStep(2)} onNext={() => setCurrentStep(4)} />}
      {currentStep === 4 && <AIReputationPage assessmentData={assessments.aiReputation} setAssessmentData={(d) => updateAssessment('aiReputation', d)} apiKey={apiKey} project={project} onPrev={() => setCurrentStep(3)} onNext={() => setCurrentStep(5)} />}
      {currentStep === 5 && <AssessmentStep title="Earned Media Assessment" description={`Analyzing ${project.brandName}'s press coverage`} icon={Newspaper} steps={earnedSteps} assessmentData={assessments.earnedMedia} setAssessmentData={(d) => updateAssessment('earnedMedia', d)} apiKey={apiKey} project={project} onPrev={() => setCurrentStep(4)} onNext={() => setCurrentStep(6)} />}
      {currentStep === 6 && <ScoringPage scores={scores} setScores={setScores} assessments={assessments} apiKey={apiKey} project={project} onPrev={() => setCurrentStep(5)} onNext={() => setCurrentStep(7)} />}
      {currentStep === 7 && <ReportPage project={project} scores={scores} assessments={assessments} onSave={handleSave} onPrev={() => setCurrentStep(6)} />}

      {showSavedModal && <SavedAssessmentsModal onClose={() => setShowSavedModal(false)} onLoad={handleLoad} assessments={savedAssessments} />}
    </div>
  );
}
