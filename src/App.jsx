import { useState } from 'react';
import { useStore } from './stores/useStore';
import { callClaude, callOpenAI, callGemini } from './lib/api';
import { ATTRIBUTES, BUSINESS_MODELS, getMaturityStage, SERVICE_RECOMMENDATIONS } from './data/rubric';
import { Compass, ArrowRight, ArrowLeft, Globe, Users, Bot, Newspaper, BarChart3, FileText, Play, Check, Loader2, ChevronDown, ChevronUp, Key, Building2, Download, RefreshCw } from 'lucide-react';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, BorderStyle, WidthType, AlignmentType } from 'docx';
import { saveAs } from 'file-saver';

const STEPS = [
  { id: 'setup', name: 'Project Setup', icon: Building2 },
  { id: 'website', name: 'Website', icon: Globe },
  { id: 'social', name: 'Social Media', icon: Users },
  { id: 'ai', name: 'AI Reputation', icon: Bot },
  { id: 'earned', name: 'Earned Media', icon: Newspaper },
  { id: 'scoring', name: 'Scoring', icon: BarChart3 },
  { id: 'report', name: 'Report', icon: FileText },
];

// Header Component
function Header() {
  const { currentStep } = useStore();
  return (
    <header className="bg-gradient-to-r from-slate-900 to-slate-800 text-white py-4 px-6 sticky top-0 z-50">
      <div className="max-w-6xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-teal-400 to-teal-600 rounded-xl flex items-center justify-center shadow-lg shadow-teal-500/20">
            <Compass className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-semibold text-lg" style={{ fontFamily: 'Fraunces, serif' }}>Conscious Compass</h1>
            <p className="text-xs text-slate-400">by Antenna Group</p>
          </div>
        </div>
        <div className="hidden md:flex items-center gap-1">
          {STEPS.map((step, i) => (
            <div key={step.id} className="flex items-center">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium transition-all ${
                i < currentStep ? 'bg-teal-500 text-white' : i === currentStep ? 'bg-teal-500/20 text-teal-400 ring-2 ring-teal-500' : 'bg-slate-700 text-slate-500'
              }`}>
                {i < currentStep ? <Check className="w-4 h-4" /> : i + 1}
              </div>
              {i < STEPS.length - 1 && <div className={`w-6 h-0.5 mx-1 ${i < currentStep ? 'bg-teal-500' : 'bg-slate-700'}`} />}
            </div>
          ))}
        </div>
      </div>
    </header>
  );
}

// Welcome Page
function WelcomePage({ onStart }) {
  return (
    <div className="min-h-[calc(100vh-72px)] flex items-center justify-center p-6">
      <div className="max-w-2xl text-center animate-fade-in">
        <div className="inline-flex items-center gap-2 bg-teal-50 text-teal-700 px-4 py-2 rounded-full text-sm font-medium mb-6">
          <span className="w-2 h-2 bg-teal-500 rounded-full animate-pulse" />
          Brand Consciousness Framework v2.3
        </div>
        <h1 className="text-5xl font-bold text-slate-900 mb-4 leading-tight" style={{ fontFamily: 'Fraunces, serif' }}>
          Measure Your Brand's
          <span className="block bg-gradient-to-r from-teal-600 to-blue-600 bg-clip-text text-transparent">Conscious Marketing</span>
        </h1>
        <p className="text-xl text-slate-600 mb-8">
          Comprehensive assessment across 8 attributes, 46 questions, generating a scored report with prioritized recommendations.
        </p>
        <button onClick={onStart} className="btn-primary inline-flex items-center gap-2 text-lg">
          Start Assessment <ArrowRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}

// Project Setup Page
function SetupPage({ onNext }) {
  const { apiKeys, setApiKeys, project, setProject } = useStore();
  const [showKeys, setShowKeys] = useState(false);
  
  const canProceed = apiKeys.anthropic && project.brandName && project.websiteUrl;

  return (
    <div className="max-w-2xl mx-auto p-6 animate-fade-in">
      <h2 className="text-3xl font-bold text-slate-900 mb-2" style={{ fontFamily: 'Fraunces, serif' }}>Project Setup</h2>
      <p className="text-slate-600 mb-8">Configure your assessment with brand details and API credentials.</p>

      <div className="space-y-6">
        {/* API Keys */}
        <div className="card p-6">
          <button onClick={() => setShowKeys(!showKeys)} className="flex items-center gap-3 w-full text-left">
            <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
              <Key className="w-5 h-5 text-amber-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-slate-900">API Keys</h3>
              <p className="text-sm text-slate-500">Required for AI-powered analysis</p>
            </div>
            <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform ${showKeys ? 'rotate-180' : ''}`} />
          </button>
          {showKeys && (
            <div className="mt-4 pt-4 border-t border-slate-100 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Anthropic API Key *</label>
                <input
                  type="password"
                  value={apiKeys.anthropic}
                  onChange={(e) => setApiKeys({ anthropic: e.target.value })}
                  placeholder="sk-ant-..."
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">OpenAI API Key <span className="text-slate-400">(optional)</span></label>
                <input
                  type="password"
                  value={apiKeys.openai}
                  onChange={(e) => setApiKeys({ openai: e.target.value })}
                  placeholder="sk-..."
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Google Gemini Key <span className="text-slate-400">(optional)</span></label>
                <input
                  type="password"
                  value={apiKeys.gemini}
                  onChange={(e) => setApiKeys({ gemini: e.target.value })}
                  placeholder="AI..."
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
                />
              </div>
            </div>
          )}
        </div>

        {/* Brand Details */}
        <div className="card p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Building2 className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900">Brand Details</h3>
              <p className="text-sm text-slate-500">Information about the brand being assessed</p>
            </div>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Brand Name *</label>
              <input
                type="text"
                value={project.brandName}
                onChange={(e) => setProject({ brandName: e.target.value })}
                placeholder="e.g., LiNova Energy"
                className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Website URL *</label>
              <input
                type="url"
                value={project.websiteUrl}
                onChange={(e) => setProject({ websiteUrl: e.target.value })}
                placeholder="https://www.example.com"
                className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">LinkedIn Company URL</label>
              <input
                type="url"
                value={project.linkedinUrl}
                onChange={(e) => setProject({ linkedinUrl: e.target.value })}
                placeholder="https://www.linkedin.com/company/..."
                className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Business Model</label>
              <select
                value={project.businessModel}
                onChange={(e) => setProject({ businessModel: e.target.value })}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
              >
                {BUSINESS_MODELS.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end mt-8">
        <button onClick={onNext} disabled={!canProceed} className="btn-primary flex items-center gap-2">
          Continue <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// Generic Assessment Step Component
function AssessmentStep({ title, description, icon: Icon, steps, assessmentKey, onComplete, prevStep, nextStep }) {
  const { apiKeys, project, assessments, updateAssessment } = useStore();
  const [currentSubStep, setCurrentSubStep] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [expanded, setExpanded] = useState({});

  const assessment = assessments[assessmentKey];
  const isComplete = assessment.status === 'complete';

  const runStep = async (index) => {
    const step = steps[index];
    setIsProcessing(true);
    setError(null);

    try {
      const prompt = typeof step.prompt === 'function' ? step.prompt(project, assessment.steps) : step.prompt;
      const result = await callClaude(prompt, apiKeys.anthropic, { maxTokens: 6000 });
      
      const newSteps = { ...assessment.steps, [step.id]: result };
      updateAssessment(assessmentKey, { steps: newSteps });
      setExpanded({ ...expanded, [step.id]: true });
      
      if (index === steps.length - 1) {
        updateAssessment(assessmentKey, { status: 'complete', content: result });
      }
      setCurrentSubStep(index + 1);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const runAll = async () => {
    for (let i = Object.keys(assessment.steps).length; i < steps.length; i++) {
      await runStep(i);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 animate-fade-in">
      <div className="flex items-start gap-4 mb-8">
        <div className="w-14 h-14 bg-gradient-to-br from-teal-100 to-blue-100 rounded-xl flex items-center justify-center">
          <Icon className="w-7 h-7 text-teal-700" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-slate-900" style={{ fontFamily: 'Fraunces, serif' }}>{title}</h2>
          <p className="text-slate-600">{description}</p>
        </div>
      </div>

      {!isComplete && !isProcessing && (
        <div className="flex gap-3 mb-6">
          <button onClick={runAll} className="btn-primary flex items-center gap-2">
            <Play className="w-4 h-4" /> Run Complete Analysis
          </button>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 text-red-700">
          <p className="font-medium">Error</p>
          <p className="text-sm">{error}</p>
          <button onClick={() => runStep(Object.keys(assessment.steps).length)} className="text-sm text-red-600 hover:underline mt-2 flex items-center gap-1">
            <RefreshCw className="w-3 h-3" /> Retry
          </button>
        </div>
      )}

      <div className="space-y-3">
        {steps.map((step, index) => {
          const isDone = !!assessment.steps[step.id];
          const isCurrent = index === Object.keys(assessment.steps).length;
          
          return (
            <div key={step.id} className={`card transition-all ${isDone ? 'bg-teal-50/50 border-teal-200' : isCurrent ? 'border-teal-500 shadow-md' : ''}`}>
              <div className="p-4 flex items-center gap-4 cursor-pointer" onClick={() => isDone && setExpanded({ ...expanded, [step.id]: !expanded[step.id] })}>
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  isDone ? 'bg-teal-500 text-white' : isCurrent && isProcessing ? 'bg-teal-100' : isCurrent ? 'bg-teal-100 text-teal-700' : 'bg-slate-100 text-slate-400'
                }`}>
                  {isDone ? <Check className="w-5 h-5" /> : isCurrent && isProcessing ? <Loader2 className="w-5 h-5 animate-spin text-teal-600" /> : index + 1}
                </div>
                <div className="flex-1">
                  <h4 className="font-medium text-slate-900">{step.name}</h4>
                  <p className="text-sm text-slate-500">{step.description}</p>
                </div>
                {isDone && <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform ${expanded[step.id] ? 'rotate-180' : ''}`} />}
              </div>
              {isDone && expanded[step.id] && (
                <div className="px-4 pb-4">
                  <div className="bg-slate-50 rounded-lg p-4 max-h-72 overflow-y-auto">
                    <pre className="text-sm text-slate-700 whitespace-pre-wrap font-sans">{assessment.steps[step.id]}</pre>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {isComplete && (
        <div className="bg-teal-50 border border-teal-200 rounded-xl p-6 text-center mt-6">
          <Check className="w-12 h-12 text-teal-500 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-teal-900 mb-1">Assessment Complete</h3>
          <p className="text-teal-700">Ready to proceed to the next step.</p>
        </div>
      )}

      <div className="flex items-center justify-between mt-8 pt-6 border-t border-slate-200">
        <button onClick={prevStep} className="btn-secondary flex items-center gap-2">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <button onClick={nextStep} disabled={!isComplete} className="btn-primary flex items-center gap-2">
          Continue <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// AI Reputation Page (Special handling for multi-engine)
function AIReputationPage({ prevStep, nextStep }) {
  const { apiKeys, project, assessments, updateAssessment } = useStore();
  const [responses, setResponses] = useState({ claude: '', gemini: '', chatgpt: '' });
  const [manualInput, setManualInput] = useState({ gemini: '', chatgpt: '' });
  const [isProcessing, setIsProcessing] = useState({});
  const [synthesis, setSynthesis] = useState('');
  const [error, setError] = useState(null);

  const standardQuery = `Please describe ${project.brandName}, what they do, why they do it and how they do it, and provide an overview of their reputation and credibility. Do they have any red flags or are there any risks working with them?`;

  const queryClaude = async () => {
    setIsProcessing(p => ({ ...p, claude: true }));
    try {
      const result = await callClaude(standardQuery, apiKeys.anthropic);
      setResponses(r => ({ ...r, claude: result }));
    } catch (e) { setError(e.message); }
    finally { setIsProcessing(p => ({ ...p, claude: false })); }
  };

  const queryGemini = async () => {
    if (!apiKeys.gemini) return;
    setIsProcessing(p => ({ ...p, gemini: true }));
    try {
      const result = await callGemini(standardQuery, apiKeys.gemini);
      setResponses(r => ({ ...r, gemini: result }));
    } catch (e) { setError(e.message); }
    finally { setIsProcessing(p => ({ ...p, gemini: false })); }
  };

  const queryOpenAI = async () => {
    if (!apiKeys.openai) return;
    setIsProcessing(p => ({ ...p, chatgpt: true }));
    try {
      const result = await callOpenAI(standardQuery, apiKeys.openai);
      setResponses(r => ({ ...r, chatgpt: result }));
    } catch (e) { setError(e.message); }
    finally { setIsProcessing(p => ({ ...p, chatgpt: false })); }
  };

  const runAll = async () => {
    await queryClaude();
    if (apiKeys.gemini) await queryGemini();
    if (apiKeys.openai) await queryOpenAI();
  };

  const hasAllResponses = responses.claude && (responses.gemini || manualInput.gemini) && (responses.chatgpt || manualInput.chatgpt);
  
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
4. Structural vulnerabilities (what none could answer)
5. Recommendations to improve AI representation

Write in flowing prose, no formatting.`;

      const result = await callClaude(prompt, apiKeys.anthropic, { maxTokens: 6000 });
      setSynthesis(result);
      updateAssessment('aiReputation', { status: 'complete', content: result, responses: { ...responses, ...manualInput } });
    } catch (e) { setError(e.message); }
    finally { setIsProcessing(p => ({ ...p, synthesis: false })); }
  };

  const isComplete = assessments.aiReputation.status === 'complete';

  return (
    <div className="max-w-4xl mx-auto p-6 animate-fade-in">
      <div className="flex items-start gap-4 mb-8">
        <div className="w-14 h-14 bg-gradient-to-br from-purple-100 to-blue-100 rounded-xl flex items-center justify-center">
          <Bot className="w-7 h-7 text-purple-700" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-slate-900" style={{ fontFamily: 'Fraunces, serif' }}>AI Reputation Assessment</h2>
          <p className="text-slate-600">Query Claude, Gemini, and ChatGPT to analyze how {project.brandName} appears across AI systems.</p>
        </div>
      </div>

      <div className="bg-slate-50 rounded-lg p-4 mb-6">
        <p className="text-sm text-slate-500 mb-2">Standard query:</p>
        <p className="text-slate-700 italic">"{standardQuery}"</p>
      </div>

      {!responses.claude && (
        <button onClick={runAll} className="btn-primary flex items-center gap-2 mb-6">
          <Play className="w-4 h-4" /> Query All AI Systems
        </button>
      )}

      {error && <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 text-red-700 text-sm">{error}</div>}

      <div className="space-y-4 mb-6">
        {/* Claude */}
        <div className={`card p-4 ${responses.claude ? 'bg-teal-50/50 border-teal-200' : ''}`}>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${responses.claude ? 'bg-teal-500 text-white' : 'bg-slate-100'}`}>
              {isProcessing.claude ? <Loader2 className="w-5 h-5 animate-spin" /> : responses.claude ? <Check className="w-5 h-5" /> : <Bot className="w-5 h-5 text-slate-400" />}
            </div>
            <div className="flex-1">
              <h4 className="font-medium">Claude (Anthropic)</h4>
              <p className="text-sm text-slate-500">{responses.claude ? 'Response received' : 'Awaiting query'}</p>
            </div>
            {!responses.claude && !isProcessing.claude && <button onClick={queryClaude} className="text-teal-600 text-sm font-medium">Query</button>}
          </div>
          {responses.claude && <div className="mt-3 bg-white rounded-lg p-3 max-h-40 overflow-y-auto text-sm text-slate-700">{responses.claude}</div>}
        </div>

        {/* Gemini */}
        <div className={`card p-4 ${responses.gemini || manualInput.gemini ? 'bg-teal-50/50 border-teal-200' : ''}`}>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${responses.gemini || manualInput.gemini ? 'bg-teal-500 text-white' : 'bg-slate-100'}`}>
              {isProcessing.gemini ? <Loader2 className="w-5 h-5 animate-spin" /> : (responses.gemini || manualInput.gemini) ? <Check className="w-5 h-5" /> : <Bot className="w-5 h-5 text-slate-400" />}
            </div>
            <div className="flex-1">
              <h4 className="font-medium">Gemini (Google)</h4>
              <p className="text-sm text-slate-500">{apiKeys.gemini ? 'API key provided' : 'Manual entry'}</p>
            </div>
            {apiKeys.gemini && !responses.gemini && !isProcessing.gemini && <button onClick={queryGemini} className="text-teal-600 text-sm font-medium">Query</button>}
          </div>
          {!apiKeys.gemini && !responses.gemini && (
            <textarea value={manualInput.gemini} onChange={(e) => setManualInput(m => ({ ...m, gemini: e.target.value }))} placeholder="Paste Gemini response..." className="mt-3 w-full h-24 px-3 py-2 border border-slate-200 rounded-lg text-sm" />
          )}
          {(responses.gemini || manualInput.gemini) && <div className="mt-3 bg-white rounded-lg p-3 max-h-40 overflow-y-auto text-sm text-slate-700">{responses.gemini || manualInput.gemini}</div>}
        </div>

        {/* ChatGPT */}
        <div className={`card p-4 ${responses.chatgpt || manualInput.chatgpt ? 'bg-teal-50/50 border-teal-200' : ''}`}>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${responses.chatgpt || manualInput.chatgpt ? 'bg-teal-500 text-white' : 'bg-slate-100'}`}>
              {isProcessing.chatgpt ? <Loader2 className="w-5 h-5 animate-spin" /> : (responses.chatgpt || manualInput.chatgpt) ? <Check className="w-5 h-5" /> : <Bot className="w-5 h-5 text-slate-400" />}
            </div>
            <div className="flex-1">
              <h4 className="font-medium">ChatGPT (OpenAI)</h4>
              <p className="text-sm text-slate-500">{apiKeys.openai ? 'API key provided' : 'Manual entry'}</p>
            </div>
            {apiKeys.openai && !responses.chatgpt && !isProcessing.chatgpt && <button onClick={queryOpenAI} className="text-teal-600 text-sm font-medium">Query</button>}
          </div>
          {!apiKeys.openai && !responses.chatgpt && (
            <textarea value={manualInput.chatgpt} onChange={(e) => setManualInput(m => ({ ...m, chatgpt: e.target.value }))} placeholder="Paste ChatGPT response..." className="mt-3 w-full h-24 px-3 py-2 border border-slate-200 rounded-lg text-sm" />
          )}
          {(responses.chatgpt || manualInput.chatgpt) && <div className="mt-3 bg-white rounded-lg p-3 max-h-40 overflow-y-auto text-sm text-slate-700">{responses.chatgpt || manualInput.chatgpt}</div>}
        </div>
      </div>

      {hasAllResponses && !synthesis && (
        <button onClick={generateSynthesis} disabled={isProcessing.synthesis} className="btn-primary flex items-center gap-2 w-full justify-center mb-6">
          {isProcessing.synthesis ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating...</> : <><Play className="w-4 h-4" /> Generate Synthesis</>}
        </button>
      )}

      {synthesis && (
        <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 mb-6">
          <h4 className="font-medium text-purple-900 mb-2 flex items-center gap-2"><Check className="w-5 h-5" /> Synthesis Complete</h4>
          <div className="bg-white rounded-lg p-4 max-h-64 overflow-y-auto text-sm text-slate-700">{synthesis}</div>
        </div>
      )}

      <div className="flex items-center justify-between pt-6 border-t border-slate-200">
        <button onClick={prevStep} className="btn-secondary flex items-center gap-2"><ArrowLeft className="w-4 h-4" /> Back</button>
        <button onClick={nextStep} disabled={!isComplete} className="btn-primary flex items-center gap-2">Continue <ArrowRight className="w-4 h-4" /></button>
      </div>
    </div>
  );
}

// Scoring Page
function ScoringPage({ prevStep, nextStep }) {
  const { apiKeys, project, assessments, scores, setScores } = useStore();
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);

  const runScoring = async () => {
    setIsProcessing(true);
    setError(null);
    try {
      const prompt = `You are scoring a brand against the Conscious Compass Framework. Score each attribute 0-100.

ASSESSMENTS:
Website: ${assessments.website.content}
Social: ${assessments.social.content}
AI Reputation: ${assessments.aiReputation.content}
Earned Media: ${assessments.earnedMedia.content}

Score these 8 attributes for ${project.brandName}:
${ATTRIBUTES.map(a => `${a.id}: ${a.name}`).join('\n')}

Return ONLY valid JSON:
{"AWAKE":45,"AWARE":52,"REFLECTIVE":38,"ATTENTIVE":55,"COGENT":42,"SENTIENT":35,"VISIONARY":48,"INTENTIONAL":50,"summaries":{"AWAKE":"Brief explanation","AWARE":"Brief explanation"...}}`;

      const result = await callClaude(prompt, apiKeys.anthropic);
      const match = result.match(/\{[\s\S]*\}/);
      if (match) {
        const parsed = JSON.parse(match[0]);
        setScores(parsed);
      }
    } catch (e) { setError(e.message); }
    finally { setIsProcessing(false); }
  };

  const overall = scores ? Math.round(Object.entries(scores).filter(([k]) => k !== 'summaries').reduce((a, [, v]) => a + v, 0) / 8) : 0;
  const stage = getMaturityStage(overall);

  return (
    <div className="max-w-4xl mx-auto p-6 animate-fade-in">
      <div className="flex items-start gap-4 mb-8">
        <div className="w-14 h-14 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-xl flex items-center justify-center">
          <BarChart3 className="w-7 h-7 text-blue-700" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-slate-900" style={{ fontFamily: 'Fraunces, serif' }}>Scoring & Review</h2>
          <p className="text-slate-600">AI-generated scores based on the four assessment documents.</p>
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
          <div className="card p-6 mb-6 text-center">
            <div className="text-6xl font-bold mb-2" style={{ color: stage.color, fontFamily: 'Fraunces, serif' }}>{overall}</div>
            <div className="text-lg font-medium" style={{ color: stage.color }}>{stage.name}</div>
            <p className="text-slate-500 text-sm mt-1">Overall Score</p>
          </div>

          <div className="grid md:grid-cols-2 gap-4 mb-6">
            {ATTRIBUTES.map(attr => (
              <div key={attr.id} className="card p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-slate-900">{attr.name}</span>
                  <span className="text-lg font-bold" style={{ color: attr.color }}>{scores[attr.id]}</span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${scores[attr.id]}%`, backgroundColor: attr.color }} />
                </div>
                {scores.summaries?.[attr.id] && <p className="text-sm text-slate-600 mt-2">{scores.summaries[attr.id]}</p>}
              </div>
            ))}
          </div>
        </>
      )}

      <div className="flex items-center justify-between pt-6 border-t border-slate-200">
        <button onClick={prevStep} className="btn-secondary flex items-center gap-2"><ArrowLeft className="w-4 h-4" /> Back</button>
        <button onClick={nextStep} disabled={!scores} className="btn-primary flex items-center gap-2">Generate Report <ArrowRight className="w-4 h-4" /></button>
      </div>
    </div>
  );
}

// Report Page
function ReportPage({ prevStep }) {
  const { project, scores, assessments } = useStore();
  const [isGenerating, setIsGenerating] = useState(false);

  const overall = scores ? Math.round(Object.entries(scores).filter(([k]) => k !== 'summaries').reduce((a, [, v]) => a + v, 0) / 8) : 0;
  const stage = getMaturityStage(overall);

  const generateDocx = async () => {
    setIsGenerating(true);
    try {
      const doc = new Document({
        styles: {
          default: { document: { run: { font: 'Arial', size: 24 } } },
          paragraphStyles: [
            { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', run: { size: 36, bold: true }, paragraph: { spacing: { before: 240, after: 120 } } },
            { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', run: { size: 28, bold: true }, paragraph: { spacing: { before: 200, after: 80 } } },
          ]
        },
        sections: [{
          properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } },
          children: [
            new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(`${project.brandName} Brand Consciousness Assessment`)] }),
            new Paragraph({ children: [new TextRun({ text: `Assessment Date: ${project.date}`, italics: true })] }),
            new Paragraph({ children: [new TextRun('')] }),
            new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun('Executive Summary')] }),
            new Paragraph({ children: [new TextRun(`${project.brandName} achieved an overall score of ${overall}/100, placing them in the ${stage.name} maturity stage. This assessment evaluated the brand across eight core attributes of conscious marketing effectiveness.`)] }),
            new Paragraph({ children: [new TextRun('')] }),
            new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun('Attribute Scores')] }),
            ...ATTRIBUTES.flatMap(attr => [
              new Paragraph({ children: [new TextRun({ text: `${attr.name}: ${scores[attr.id]}/100`, bold: true })] }),
              new Paragraph({ children: [new TextRun(scores.summaries?.[attr.id] || attr.description)] }),
              new Paragraph({ children: [new TextRun('')] }),
            ]),
            new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun('Recommendations')] }),
            ...ATTRIBUTES.filter(a => scores[a.id] < 50).slice(0, 3).flatMap(attr => 
              SERVICE_RECOMMENDATIONS[attr.id].slice(0, 3).map(rec => 
                new Paragraph({ children: [new TextRun(`• ${attr.name}: ${rec}`)] })
              )
            ),
          ]
        }]
      });

      const buffer = await Packer.toBuffer(doc);
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
      saveAs(blob, `${project.brandName.replace(/\s+/g, '_')}_Assessment_Report.docx`);
    } catch (e) {
      console.error(e);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 animate-fade-in">
      <div className="flex items-start gap-4 mb-8">
        <div className="w-14 h-14 bg-gradient-to-br from-emerald-100 to-teal-100 rounded-xl flex items-center justify-center">
          <FileText className="w-7 h-7 text-emerald-700" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-slate-900" style={{ fontFamily: 'Fraunces, serif' }}>Assessment Report</h2>
          <p className="text-slate-600">Download the complete assessment report for {project.brandName}.</p>
        </div>
      </div>

      <div className="card p-8 text-center mb-6">
        <div className="w-24 h-24 bg-gradient-to-br from-teal-500 to-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4">
          <span className="text-3xl font-bold text-white" style={{ fontFamily: 'Fraunces, serif' }}>{overall}</span>
        </div>
        <h3 className="text-xl font-bold text-slate-900 mb-1">{project.brandName}</h3>
        <p className="text-lg font-medium" style={{ color: stage.color }}>{stage.name} Stage</p>
        <p className="text-slate-500 text-sm mt-2">Assessment complete. Download your report below.</p>
      </div>

      <button onClick={generateDocx} disabled={isGenerating} className="btn-primary flex items-center gap-2 w-full justify-center text-lg py-4">
        {isGenerating ? <><Loader2 className="w-5 h-5 animate-spin" /> Generating...</> : <><Download className="w-5 h-5" /> Download DOCX Report</>}
      </button>

      <div className="flex items-center justify-start mt-8 pt-6 border-t border-slate-200">
        <button onClick={prevStep} className="btn-secondary flex items-center gap-2"><ArrowLeft className="w-4 h-4" /> Back to Scoring</button>
      </div>
    </div>
  );
}

// Main App
export default function App() {
  const { currentStep, setCurrentStep, project } = useStore();

  const websiteSteps = [
    { id: 'initial', name: 'Brand Review', description: 'Strategy, identity, messaging, UX', prompt: (p) => `Review ${p.brandName} website at ${p.websiteUrl}. Evaluate brand strategy, identity, messaging, storytelling, UX, IA, navigation. Be thorough.` },
    { id: 'content', name: 'Content Hierarchy', description: 'Structure, journeys, segmentation', prompt: (p) => `Analyze ${p.brandName} content hierarchy: audience segments, user journeys, benefit visibility, culture leverage.` },
    { id: 'visual', name: 'Visual Assessment', description: 'Differentiation, authenticity', prompt: (p) => `Assess ${p.brandName} visual brand: differentiation, stock/AI content, emotional connection, color, typography.` },
    { id: 'accessibility', name: 'Accessibility Audit', description: 'WCAG, screen reader, AI indexability', prompt: (p) => `Audit ${p.brandName} accessibility: text as images, alt text, heading hierarchy, WCAG 2.1 compliance.` },
    { id: 'synthesis', name: 'Final Synthesis', description: 'Issues, opportunities, recommendations', prompt: (p, steps) => `Based on analysis:\n${Object.values(steps).join('\n\n')}\n\nProduce comprehensive website assessment for ${p.brandName}: issues, opportunities, prioritized recommendations. Flowing prose, no formatting.` },
  ];

  const socialSteps = [
    { id: 'linkedin', name: 'LinkedIn Analysis', description: 'Company page, followers, engagement', prompt: (p) => `Evaluate ${p.brandName} LinkedIn presence${p.linkedinUrl ? ` at ${p.linkedinUrl}` : ''}. Assess consistency, followers, engagement (benchmark 2-4%), content types, thought leadership, executive activity.` },
    { id: 'platforms', name: 'Platform Strategy', description: 'Recommended platforms', prompt: (p) => `What social platforms should ${p.brandName} prioritize? Consider target audiences, resources, platform fit.` },
    { id: 'youtube', name: 'YouTube Assessment', description: 'Video presence', prompt: (p) => `Check ${p.brandName} YouTube presence: company channel, content, executive interviews, thought leadership.` },
    { id: 'aivis', name: 'Reddit/Wikipedia/AI Visibility', description: 'Community and AI search', prompt: (p) => `Assess ${p.brandName} on Reddit, Wikipedia. Explain significance for AI search and reputation.` },
    { id: 'synthesis', name: 'Final Synthesis', description: 'Complete assessment', prompt: (p, steps) => `Based on:\n${Object.values(steps).join('\n\n')}\n\nProduce social media assessment for ${p.brandName}: issues, opportunities, recommendations. Flowing prose.` },
  ];

  const earnedSteps = [
    { id: 'search', name: 'Coverage Search', description: 'Find earned media', prompt: (p) => `Search for ${p.brandName} earned media: news, trade publications, analyst coverage, podcasts, awards.` },
    { id: 'analysis', name: 'Coverage Analysis', description: 'Sentiment, credibility, alignment', prompt: (p) => `Analyze ${p.brandName} earned media: sentiment, credibility support, audience benefit storytelling, alignment with brand.` },
    { id: 'strategy', name: 'PR Strategy', description: 'Awareness, reputation, credibility', prompt: (p) => `Recommend PR strategy for ${p.brandName}: awareness (publications, podcasts), reputation (thought leadership, conferences), credibility (validation, case studies).` },
    { id: 'synthesis', name: 'Final Synthesis', description: 'Complete assessment', prompt: (p, steps) => `Based on:\n${Object.values(steps).join('\n\n')}\n\nProduce earned media assessment for ${p.brandName}: current landscape, sentiment, recommendations for AI visibility. Flowing prose.` },
  ];

  const goTo = (step) => setCurrentStep(step);

  if (currentStep === 0) return <><Header /><WelcomePage onStart={() => goTo(1)} /></>;
  if (currentStep === 1) return <><Header /><SetupPage onNext={() => goTo(2)} /></>;
  if (currentStep === 2) return <><Header /><AssessmentStep title="Website Assessment" description={`Analyzing ${project.brandName}'s website`} icon={Globe} steps={websiteSteps} assessmentKey="website" prevStep={() => goTo(1)} nextStep={() => goTo(3)} /></>;
  if (currentStep === 3) return <><Header /><AssessmentStep title="Social Media Assessment" description={`Evaluating ${project.brandName}'s social presence`} icon={Users} steps={socialSteps} assessmentKey="social" prevStep={() => goTo(2)} nextStep={() => goTo(4)} /></>;
  if (currentStep === 4) return <><Header /><AIReputationPage prevStep={() => goTo(3)} nextStep={() => goTo(5)} /></>;
  if (currentStep === 5) return <><Header /><AssessmentStep title="Earned Media Assessment" description={`Analyzing ${project.brandName}'s press coverage`} icon={Newspaper} steps={earnedSteps} assessmentKey="earnedMedia" prevStep={() => goTo(4)} nextStep={() => goTo(6)} /></>;
  if (currentStep === 6) return <><Header /><ScoringPage prevStep={() => goTo(5)} nextStep={() => goTo(7)} /></>;
  if (currentStep === 7) return <><Header /><ReportPage prevStep={() => goTo(6)} /></>;

  return <><Header /><WelcomePage onStart={() => goTo(1)} /></>;
}
