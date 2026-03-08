import React, { useState, useEffect, useRef, useMemo } from 'react';
import { ATTRIBUTES, BUSINESS_MODELS, getMaturityStage, MATURITY_STAGES, SERVICE_RECOMMENDATIONS, FRAMEWORK_VERSION } from './data/rubric';
import { getAllRecommendations, formatBudget, getForceIncludeServicesFromAIReputation } from './data/serviceMapping';
import { Compass, ArrowRight, ArrowLeft, Globe, Users, Bot, Newspaper, BarChart3, FileText, Play, Check, Loader2, ChevronDown, Download, Save, Plus, Trash2, X, Upload, Image, ExternalLink, Share2, Copy, LogOut, Shield, UserCheck, UserX, TrendingUp, TrendingDown, Star, Lightbulb, Sparkles, AlertCircle, Target, Search, Filter, Hash } from 'lucide-react';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableCell, TableRow, WidthType, BorderStyle, AlignmentType, ShadingType } from 'docx';
import { saveAs } from 'file-saver';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { 
  supabase, 
  signUp, 
  signIn, 
  signOut, 
  getProfile,
  fetchCompassResults,
  saveCompassResult,
  deleteCompassResult,
  fetchSavedAssessments,
  saveAssessment,
  deleteAssessment,
  fetchAllProfiles,
  approveUser,
  revokeUser,
  makeAdmin,
  removeAdmin,
  setReadonly
} from './lib/supabase';

// Use 'PROXY' to route through serverless function (secure, API key on server)
// Or set VITE_ANTHROPIC_API_KEY for local development with direct API calls
const DEFAULT_API_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY || 'PROXY';

// Error Boundary for graceful error handling in production
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Application error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#FAF9F7] flex items-center justify-center p-8">
          <div className="max-w-md text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-8 h-8 text-red-600" />
            </div>
            <h1 className="text-2xl font-bold text-[#1A1A1A] mb-2">Something went wrong</h1>
            <p className="text-[#666666] mb-6">An unexpected error occurred. Please refresh the page to try again.</p>
            <button 
              onClick={() => window.location.reload()} 
              className="btn-primary"
            >
              Refresh Page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// Auth Page Component (Login/Signup)
function AuthPage({ onAuthSuccess }) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    if (isLogin) {
      const { data, error } = await signIn(email, password);
      if (error) {
        setError(error.message);
      } else if (data.user) {
        const { data: profile } = await getProfile(data.user.id);
        if (profile && !profile.is_approved) {
          setError('Your account is pending approval. Please contact an administrator.');
          await signOut();
        } else {
          onAuthSuccess(data.user, profile);
        }
      }
    } else {
      const { data, error } = await signUp(email, password, fullName);
      if (error) {
        setError(error.message);
      } else {
        setMessage('Account created! Please wait for an administrator to approve your access.');
        setIsLogin(true);
      }
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#E8E6E1] flex items-center justify-center p-4 md:p-8">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <img src="https://ktuyiikwhspwmzvyczit.supabase.co/storage/v1/object/public/assets/brand/antenna-new-logo.svg" alt="Antenna Group" className="h-8" style={{ filter: 'brightness(0)' }} />
            <div className="h-6 w-px bg-[#1A1A1A]" />
            <span className="text-lg font-semibold text-[#1A1A1A]">Conscious Compass</span>
          </div>
          <p className="text-[#666666]">{isLogin ? 'Sign in to access the assessment tool' : 'Create an account to get started'}</p>
        </div>
        
        <form onSubmit={handleSubmit} className="card p-6">
          {!isLogin && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-[#1A1A1A] mb-2">Full Name</label>
              <input 
                type="text" 
                value={fullName} 
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Your name"
                className="w-full px-4 py-3 border border-[#D9D6D0] rounded-lg bg-white"
                required={!isLogin}
              />
            </div>
          )}
          
          <div className="mb-4">
            <label className="block text-sm font-medium text-[#1A1A1A] mb-2">Email</label>
            <input 
              type="email" 
              value={email} 
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              className="w-full px-4 py-3 border border-[#D9D6D0] rounded-lg bg-white"
              required
            />
          </div>
          
          <div className="mb-4">
            <label className="block text-sm font-medium text-[#1A1A1A] mb-2">Password</label>
            <input 
              type="password" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)}
              placeholder={isLogin ? "Enter password" : "Create password (min 6 chars)"}
              className="w-full px-4 py-3 border border-[#D9D6D0] rounded-lg bg-white"
              required
              minLength={6}
            />
          </div>
          
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}
          
          {message && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
              {message}
            </div>
          )}
          
          <button type="submit" disabled={loading} className="btn-primary btn-arrow w-full">
            {loading ? (
              <><Loader2 className="w-4 h-4 animate-spin inline mr-2" /> {isLogin ? 'Signing in...' : 'Creating account...'}</>
            ) : (
              isLogin ? 'Sign In' : 'Create Account'
            )}
          </button>
          
          <div className="mt-4 text-center">
            <button 
              type="button"
              onClick={() => { setIsLogin(!isLogin); setError(''); setMessage(''); }}
              className="text-sm text-[#E53935] hover:underline"
            >
              {isLogin ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
            </button>
          </div>
        </form>
        
        <p className="text-center text-xs text-[#9CA3AF] mt-6">
          Antenna Group | Brand Consciousness Assessment
        </p>
      </div>
    </div>
  );
}

// Admin User Management Page
function AdminPage({ currentUser, onBack }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    setLoading(true);
    const { data } = await fetchAllProfiles();
    if (data) setUsers(data);
    setLoading(false);
  };

  const handleApprove = async (userId) => {
    await approveUser(userId);
    loadUsers();
  };

  const handleRevoke = async (userId) => {
    if (confirm('Revoke access for this user?')) {
      await revokeUser(userId);
      loadUsers();
    }
  };

  const handleToggleAdmin = async (userId, isCurrentlyAdmin) => {
    if (userId === currentUser.id) {
      alert("You can't change your own admin status");
      return;
    }
    if (isCurrentlyAdmin) {
      await removeAdmin(userId);
    } else {
      await makeAdmin(userId);
    }
    loadUsers();
  };

  const handleToggleReadonly = async (userId, isCurrentlyReadonly) => {
    if (userId === currentUser.id) {
      alert("You can't change your own access level");
      return;
    }
    await setReadonly(userId, !isCurrentlyReadonly);
    loadUsers();
  };

  return (
    <div className="min-h-screen bg-[#F5F4F0]">
      <div className="max-w-4xl mx-auto p-4 md:p-8">
        <div className="flex items-center gap-4 mb-8">
          <button onClick={onBack} className="btn-secondary flex items-center gap-2">
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
          <div>
            <h1 className="text-2xl font-bold text-[#1A1A1A]">User Management</h1>
            <p className="text-sm text-[#666666]">Approve users and manage access</p>
          </div>
        </div>

        {loading ? (
          <div className="card p-12 text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-[#E53935]" />
            <p className="mt-4 text-[#666666]">Loading users...</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Pending Users */}
            {users.filter(u => !u.is_approved).length > 0 && (
              <div className="card p-6">
                <h2 className="text-lg font-semibold text-[#1A1A1A] mb-4 flex items-center gap-2">
                  <UserCheck className="w-5 h-5 text-yellow-600" />
                  Pending Approval ({users.filter(u => !u.is_approved).length})
                </h2>
                <div className="space-y-3">
                  {users.filter(u => !u.is_approved).map(user => (
                    <div key={user.id} className="flex items-center justify-between p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <div>
                        <div className="font-medium text-[#1A1A1A]">{user.full_name || 'No name'}</div>
                        <div className="text-sm text-[#666666]">{user.email}</div>
                        <div className="text-xs text-[#9CA3AF]">Signed up {new Date(user.created_at).toLocaleDateString()}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={async () => {
                            await approveUser(user.id);
                            await setReadonly(user.id, true);
                            loadUsers();
                          }}
                          className="btn-secondary text-sm px-4 py-2"
                        >
                          Approve (Read-only)
                        </button>
                        <button 
                          onClick={() => handleApprove(user.id)}
                          className="btn-primary text-sm px-4 py-2"
                        >
                          Approve (Full)
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Approved Users */}
            <div className="card p-6">
              <h2 className="text-lg font-semibold text-[#1A1A1A] mb-4 flex items-center gap-2">
                <Users className="w-5 h-5 text-green-600" />
                Active Users ({users.filter(u => u.is_approved).length})
              </h2>
              <div className="space-y-3">
                {users.filter(u => u.is_approved).map(user => (
                  <div key={user.id} className="flex items-center justify-between p-4 bg-white border border-[#D9D6D0] rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-medium ${user.is_admin ? 'bg-[#E53935]' : user.is_readonly ? 'bg-[#9CA3AF]' : 'bg-[#059669]'}`}>
                        {(user.full_name || user.email || '?')[0].toUpperCase()}
                      </div>
                      <div>
                        <div className="font-medium text-[#1A1A1A] flex items-center gap-2">
                          {user.full_name || 'No name'}
                          {user.is_admin && (
                            <span className="text-xs px-2 py-0.5 bg-[#E53935] text-white rounded-full">Admin</span>
                          )}
                          {user.is_readonly && !user.is_admin && (
                            <span className="text-xs px-2 py-0.5 bg-[#9CA3AF] text-white rounded-full">Read-only</span>
                          )}
                          {!user.is_admin && !user.is_readonly && (
                            <span className="text-xs px-2 py-0.5 bg-[#059669] text-white rounded-full">Full Access</span>
                          )}
                          {user.id === currentUser.id && (
                            <span className="text-xs text-[#666666]">(you)</span>
                          )}
                        </div>
                        <div className="text-sm text-[#666666]">{user.email}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {!user.is_admin && (
                        <button 
                          onClick={() => handleToggleReadonly(user.id, user.is_readonly)}
                          className={`text-sm px-3 py-1.5 rounded border transition-colors ${
                            user.is_readonly 
                              ? 'border-[#059669] text-[#059669] hover:bg-[#059669]/10' 
                              : 'border-[#9CA3AF] text-[#9CA3AF] hover:bg-[#9CA3AF]/10'
                          }`}
                          disabled={user.id === currentUser.id}
                          title={user.is_readonly ? 'Grant full access' : 'Set to read-only'}
                        >
                          {user.is_readonly ? 'Grant Full Access' : 'Set Read-only'}
                        </button>
                      )}
                      <button 
                        onClick={() => handleToggleAdmin(user.id, user.is_admin)}
                        className={`text-sm px-3 py-1.5 rounded border transition-colors ${
                          user.is_admin 
                            ? 'border-[#E53935] text-[#E53935] hover:bg-[#E53935]/10' 
                            : 'border-[#D9D6D0] text-[#666666] hover:border-[#1A1A1A]'
                        }`}
                        disabled={user.id === currentUser.id}
                        title={user.id === currentUser.id ? "Can't change your own admin status" : ""}
                      >
                        <Shield className="w-4 h-4 inline mr-1" />
                        {user.is_admin ? 'Remove Admin' : 'Make Admin'}
                      </button>
                      <button 
                        onClick={() => handleRevoke(user.id)}
                        className="text-sm px-3 py-1.5 rounded border border-red-200 text-red-600 hover:bg-red-50 transition-colors"
                        disabled={user.id === currentUser.id}
                      >
                        <UserX className="w-4 h-4 inline mr-1" />
                        Revoke
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
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
function compressImage(dataUrl, maxSizeMB = 3.5) {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        
        // More aggressive initial scaling - 1400px max dimension
        const maxDimension = 1400;
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
        
        // Start with moderate quality
        let quality = 0.75;
        let result = canvas.toDataURL('image/jpeg', quality);
        const maxBytes = maxSizeMB * 1024 * 1024;
        
        // Reduce quality if still too big
        while (result.length * 0.75 > maxBytes && quality > 0.3) {
          quality -= 0.1;
          result = canvas.toDataURL('image/jpeg', quality);
        }
        
        // If still too big, progressively reduce dimensions
        let dimensionScale = 0.8;
        while (result.length * 0.75 > maxBytes && dimensionScale > 0.3) {
          canvas.width = Math.round(width * dimensionScale);
          canvas.height = Math.round(height * dimensionScale);
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          result = canvas.toDataURL('image/jpeg', 0.6);
          dimensionScale -= 0.1;
        }
        
        // Final safety - if somehow still too big, go very small
        if (result.length * 0.75 > maxBytes) {
          canvas.width = Math.round(width * 0.25);
          canvas.height = Math.round(height * 0.25);
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          result = canvas.toDataURL('image/jpeg', 0.5);
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

async function callClaude(prompt, apiKey, primaryImage = null, additionalImages = [], temperature = 0) {
  // Add standard instructions for consistency
  const enhancedPrompt = `${prompt}

IMPORTANT FORMATTING RULES:
- Base all assessments on specific, observable evidence. Cite concrete examples.
- Be consistent and repeatable in your analysis approach.
- Do NOT use em-dashes (—) anywhere in your response. Use commas, semicolons, colons, or separate sentences instead.
- Do NOT use en-dashes (–) for ranges. Use "to" instead (e.g., "50 to 60" not "50–60").`;

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
  
  content.push({ type: 'text', text: enhancedPrompt });
  
  // Use serverless function (secure) or direct API call (local dev with client key)
  const useProxy = !apiKey || apiKey === 'PROXY';
  
  let result;
  
  if (useProxy) {
    // Production: Use Vercel serverless function (API key stored server-side)
    const response = await fetch('/api/claude', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 6000,
        temperature: 0,
        messages: [{ role: 'user', content }]
      })
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || `API error: ${response.status}`);
    }
    const data = await response.json();
    result = data.content[0].text;
  } else {
    // Local development: Direct API call with client-provided key
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 6000,
        temperature: 0,
        messages: [{ role: 'user', content }]
      })
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error?.message || `API error: ${response.status}`);
    }
    const data = await response.json();
    result = data.content[0].text;
  }
  
  // Post-process to remove any em-dashes or en-dashes that slipped through
  result = result.replace(/—/g, ', ').replace(/–/g, ' to ');
  
  return result;
}

// Spider Chart Component
function SpiderChart({ scores, size = 400, animate = true }) {
  const [animatedScores, setAnimatedScores] = useState({});
  const [animationProgress, setAnimationProgress] = useState(0);
  
  const padding = 70; // Padding for labels
  const viewBoxSize = size + padding * 2;
  const center = viewBoxSize / 2;
  const radius = size * 0.40; // Larger radius for bigger chart
  const attrs = ATTRIBUTES;
  const angleStep = (2 * Math.PI) / attrs.length;
  
  // Animation effect
  useEffect(() => {
    if (!animate || !scores) {
      setAnimatedScores(scores || {});
      setAnimationProgress(1);
      return;
    }
    
    const duration = 3000; // 3 seconds
    const startTime = Date.now();
    
    const animationFrame = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Ease-out cubic for smooth deceleration
      const eased = 1 - Math.pow(1 - progress, 3);
      
      setAnimationProgress(eased);
      
      // Interpolate each score
      const interpolated = {};
      attrs.forEach(attr => {
        const targetScore = scores[attr.id]?.score || 0;
        interpolated[attr.id] = {
          ...scores[attr.id],
          score: Math.round(targetScore * eased)
        };
      });
      setAnimatedScores(interpolated);
      
      if (progress < 1) {
        requestAnimationFrame(animationFrame);
      }
    };
    
    requestAnimationFrame(animationFrame);
  }, [scores, animate]);
  
  // Use animated scores for rendering
  const displayScores = animate ? animatedScores : scores;
  
  // Calculate overall score
  const overall = displayScores ? Math.round(
    Object.entries(displayScores)
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
  
  const dataPoints = attrs.map((attr, i) => getPoint(i, displayScores[attr.id]?.score || 0));
  const pathD = dataPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ') + ' Z';

  return (
    <svg viewBox={`0 0 ${viewBoxSize} ${viewBoxSize}`} className="spider-chart mx-auto" style={{ overflow: 'visible', width: size, height: size }}>
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
        const labelRadius = radius + 35;
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
            {displayScores[attr.id]?.score || 0}
          </text>
        );
      })}
    </svg>
  );
}

// Mini Spider Chart — used in Results expanded rows (no labels, no animation)
function MiniSpiderChart({ scores, size = 120 }) {
  const padding = 16;
  const viewBoxSize = size + padding * 2;
  const center = viewBoxSize / 2;
  const radius = size * 0.38;
  const attrs = ATTRIBUTES;
  const angleStep = (2 * Math.PI) / attrs.length;

  const getPoint = (index, value) => {
    const angle = angleStep * index - Math.PI / 2;
    const r = (value / 100) * radius;
    return { x: center + r * Math.cos(angle), y: center + r * Math.sin(angle) };
  };

  const gridLevels = [33, 67, 100];
  const dataPoints = attrs.map((attr, i) => getPoint(i, scores?.[attr.id] || 0));
  const pathD = dataPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ') + ' Z';

  return (
    <svg viewBox={`0 0 ${viewBoxSize} ${viewBoxSize}`} style={{ width: size, height: size, overflow: 'visible' }}>
      {gridLevels.map(level => {
        const pts = attrs.map((_, i) => {
          const angle = angleStep * i - Math.PI / 2;
          const r = (level / 100) * radius;
          return `${center + r * Math.cos(angle)},${center + r * Math.sin(angle)}`;
        });
        return <polygon key={level} points={pts.join(' ')} fill="none" stroke="#D9D6D0" strokeWidth="0.5" />;
      })}
      {attrs.map((_, i) => {
        const angle = angleStep * i - Math.PI / 2;
        return <line key={i} x1={center} y1={center} x2={center + radius * Math.cos(angle)} y2={center + radius * Math.sin(angle)} stroke="#D9D6D0" strokeWidth="0.5" />;
      })}
      <path d={pathD} fill="rgba(158, 157, 36, 0.35)" stroke="#9E9D24" strokeWidth="1.5" />
      {dataPoints.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="2.5" fill="#9E9D24" />
      ))}
    </svg>
  );
}

// Comparison Spider Chart — multi-brand overlapping radar, max 4 brands
const COMPARISON_COLORS = ['#E53935', '#1976D2', '#F57C00', '#388E3C'];

function ComparisonSpiderChart({ brands, size = 320, industryAvg = null }) {
  const padding = 55;
  const viewBoxSize = size + padding * 2;
  const center = viewBoxSize / 2;
  const radius = size * 0.40;
  const attrs = ATTRIBUTES;
  const angleStep = (2 * Math.PI) / attrs.length;

  const getPoint = (index, value) => {
    const angle = angleStep * index - Math.PI / 2;
    const r = (value / 100) * radius;
    return { x: center + r * Math.cos(angle), y: center + r * Math.sin(angle) };
  };

  const gridLevels = [20, 40, 60, 80, 100];

  return (
    <div>
      <svg viewBox={`0 0 ${viewBoxSize} ${viewBoxSize}`} style={{ width: '100%', maxWidth: size + 'px', overflow: 'visible' }} className="mx-auto">
        {/* Grid polygons */}
        {gridLevels.map(level => {
          const pts = attrs.map((_, i) => {
            const angle = angleStep * i - Math.PI / 2;
            const r = (level / 100) * radius;
            return `${center + r * Math.cos(angle)},${center + r * Math.sin(angle)}`;
          });
          return <polygon key={level} points={pts.join(' ')} fill="none" stroke={level === 100 ? '#C0BDB8' : '#D9D6D0'} strokeWidth={level === 100 ? 1.5 : 1} />;
        })}
        {/* Grid value labels */}
        {[20, 40, 60, 80].map(level => (
          <text key={`lbl-${level}`} x={center} y={center - (level / 100) * radius - 4} textAnchor="middle" style={{ fontSize: '8px', fill: '#9CA3AF' }}>{level}</text>
        ))}
        {/* Axis lines */}
        {attrs.map((_, i) => {
          const angle = angleStep * i - Math.PI / 2;
          return <line key={i} x1={center} y1={center} x2={center + radius * Math.cos(angle)} y2={center + radius * Math.sin(angle)} stroke="#D9D6D0" strokeWidth="1" />;
        })}
        {/* Industry average overlay (dashed) */}
        {industryAvg && (() => {
          const pts = attrs.map((attr, i) => getPoint(i, industryAvg[attr.id] || 0));
          const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ') + ' Z';
          return <path d={d} fill="none" stroke="#9CA3AF" strokeWidth="1.5" strokeDasharray="4 3" />;
        })()}
        {/* Brand polygons */}
        {brands.map((brand, bi) => {
          const color = COMPARISON_COLORS[bi % COMPARISON_COLORS.length];
          const pts = attrs.map((attr, i) => getPoint(i, brand.scores?.[attr.id] || 0));
          const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ') + ' Z';
          return <path key={brand.id || bi} d={d} fill={color + '25'} stroke={color} strokeWidth="2" />;
        })}
        {/* Attribute labels */}
        {attrs.map((attr, i) => {
          const angle = angleStep * i - Math.PI / 2;
          const labelR = radius + 30;
          const x = center + labelR * Math.cos(angle);
          const y = center + labelR * Math.sin(angle);
          return (
            <text key={attr.id} x={x} y={y} textAnchor="middle" dominantBaseline="middle" style={{ fontSize: '11px', fontWeight: '600', fill: '#1A1A1A' }}>
              {attr.name}
            </text>
          );
        })}
      </svg>
      {/* Legend */}
      <div className="flex flex-wrap justify-center gap-3 mt-3">
        {brands.map((brand, bi) => (
          <div key={brand.id || bi} className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: COMPARISON_COLORS[bi % COMPARISON_COLORS.length] }} />
            <span className="text-xs font-medium text-[#1A1A1A]">{brand.brandName}</span>
            <span className="text-xs text-[#666666]">({brand.totalScore})</span>
          </div>
        ))}
        {industryAvg && (
          <div className="flex items-center gap-1.5">
            <div className="w-5 h-0.5 bg-[#9CA3AF] border-t border-dashed" style={{ borderTop: '2px dashed #9CA3AF' }} />
            <span className="text-xs text-[#9CA3AF]">Industry avg</span>
          </div>
        )}
      </div>
    </div>
  );
}

// Maturity Continuum Visual
function MaturityContinuum({ score }) {
  const stage = getMaturityStage(score);
  const [isVisible, setIsVisible] = useState(false);
  const [animatedScore, setAnimatedScore] = useState(0);
  const containerRef = useRef(null);
  
  // Scroll-triggered animation
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !isVisible) {
          setIsVisible(true);
        }
      },
      { threshold: 0.3 }
    );
    
    if (containerRef.current) {
      observer.observe(containerRef.current);
    }
    
    return () => observer.disconnect();
  }, [isVisible]);
  
  // Animate score counting up
  useEffect(() => {
    if (isVisible) {
      const duration = 1500;
      const steps = 60;
      const increment = score / steps;
      let current = 0;
      
      const timer = setInterval(() => {
        current += increment;
        if (current >= score) {
          setAnimatedScore(score);
          clearInterval(timer);
        } else {
          setAnimatedScore(Math.round(current));
        }
      }, duration / steps);
      
      return () => clearInterval(timer);
    }
  }, [isVisible, score]);
  
  const progressWidth = isVisible ? score : 0;
  
  return (
    <div ref={containerRef} className="card p-6 overflow-hidden">
      <h3 className="text-lg font-semibold text-[#1A1A1A] mb-6">Brand Consciousness Maturity</h3>
      
      {/* Progress Track */}
      <div className="relative mb-4">
        {/* Background track with stage colors */}
        <div className="h-3 rounded-full overflow-hidden flex">
          {MATURITY_STAGES.map(s => (
            <div 
              key={s.id} 
              className="h-full"
              style={{ 
                width: `${s.max - s.min + 1}%`,
                backgroundColor: s.color,
                opacity: 0.25
              }} 
            />
          ))}
        </div>
        
        {/* Animated progress fill */}
        <div 
          className="absolute top-0 left-0 h-3 rounded-full transition-all ease-out"
          style={{ 
            width: `${progressWidth}%`,
            background: `linear-gradient(90deg, ${MATURITY_STAGES.map(s => s.color).join(', ')})`,
            backgroundSize: '100vw 100%',
            transitionDuration: '1.5s'
          }}
        />
        
        {/* Score marker */}
        <div 
          className="absolute top-0 h-3 transition-all ease-out"
          style={{ 
            left: `${progressWidth}%`,
            transitionDuration: '1.5s'
          }}
        >
          <div 
            className="absolute -top-1 -right-1 w-5 h-5 rounded-full border-3 border-white shadow-lg"
            style={{ backgroundColor: stage.color }}
          />
        </div>
      </div>
      
      {/* Score display */}
      <div className="flex justify-between items-center mb-6">
        <div className="text-sm text-[#666666]">Progress</div>
        <div className="flex items-baseline gap-1">
          <span className="text-3xl font-bold" style={{ color: stage.color }}>{animatedScore}</span>
          <span className="text-lg text-[#999999]">/100</span>
        </div>
      </div>
      
      {/* Stage milestones */}
      <div className="relative mb-6">
        <div className="flex justify-between">
          {MATURITY_STAGES.map((s, i) => {
            const isReached = score >= s.min;
            const isCurrent = stage.id === s.id;
            return (
              <div 
                key={s.id} 
                className={`flex flex-col items-center transition-all duration-500 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
                style={{ transitionDelay: `${i * 100 + 500}ms`, width: `${100/6}%` }}
              >
                <div 
                  className={`w-4 h-4 rounded-full border-2 mb-2 transition-all duration-300 ${isReached ? 'scale-110' : 'scale-100'}`}
                  style={{ 
                    backgroundColor: isReached ? s.color : 'transparent',
                    borderColor: s.color
                  }}
                />
                <span className={`text-xs text-center leading-tight ${isCurrent ? 'font-bold text-[#1A1A1A]' : 'text-[#666666]'}`}>
                  {s.name}
                </span>
              </div>
            );
          })}
        </div>
      </div>
      
      {/* Current stage card */}
      <div 
        className={`rounded-xl p-5 text-center transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
        style={{ 
          backgroundColor: `${stage.color}15`,
          borderLeft: `4px solid ${stage.color}`,
          transitionDelay: '800ms'
        }}
      >
        <div className="text-xl font-bold mb-1" style={{ color: stage.color }}>{stage.name}</div>
        <p className="text-sm text-[#333333] mb-3">{stage.description}</p>
        
        {/* Progress to next stage */}
        {score < 100 && (
          <div className="text-xs text-[#666666]">
            <span className="font-medium" style={{ color: stage.color }}>{Math.min(100, MATURITY_STAGES.find(s => s.min > score)?.min || 100) - score} points</span> to next level
          </div>
        )}
      </div>
    </div>
  );
}

// Header
function Header({ onNewAssessment, onSavedAssessments, onCompassResults, onComparison, onStayConscious, activePage, lastAutoSave, user, profile, onLogout, onAdmin }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const isReadonly = profile?.is_readonly && !profile?.is_admin;

  const navBtnClass = (page) =>
    `flex items-center gap-2 text-sm px-3 py-1.5 rounded-lg transition-colors ${
      activePage === page
        ? 'bg-[#1A1A1A] text-white font-medium'
        : 'text-[#333333] hover:text-[#1A1A1A] hover:bg-[#D9D6D0]'
    }`;

  const mobileNavBtnClass = (page) =>
    `w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
      activePage === page
        ? 'bg-[#1A1A1A] text-white font-medium'
        : 'text-[#333333] hover:bg-[#F0EEEA]'
    }`;
  
  return (
    <header className="bg-[#E8E6E1] border-b border-[#D9D6D0] py-4 md:py-5 px-4 md:px-6">
      <div className="max-w-6xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-2 md:gap-4">
          <img src="https://ktuyiikwhspwmzvyczit.supabase.co/storage/v1/object/public/assets/brand/antenna-new-logo.svg" alt="Antenna Group" className="h-6 md:h-8" style={{ filter: 'brightness(0)' }} />
          <div className="hidden md:block h-6 w-px bg-[#1A1A1A]" />
          <span className="hidden md:block text-lg font-semibold text-[#1A1A1A]">Conscious Compass</span>
        </div>
        
        {/* Desktop Navigation */}
        <div className="hidden md:flex items-center gap-1">
          {lastAutoSave && (
            <span className="text-xs text-[#9CA3AF] mr-3">
              Auto-saved {lastAutoSave.toLocaleTimeString()}
            </span>
          )}
          <button onClick={onStayConscious} className={navBtnClass('stay-conscious')}>
            <Sparkles className="w-4 h-4" /> Stay Conscious
          </button>
          <button onClick={onComparison} className={navBtnClass('compare')}>
            <Users className="w-4 h-4" /> Compare
          </button>
          <button onClick={onCompassResults} className={navBtnClass('results')}>
            <BarChart3 className="w-4 h-4" /> Results
          </button>
          <button onClick={onSavedAssessments} className={navBtnClass('saved')}>
            <FileText className="w-4 h-4" /> Saved
          </button>
          {!isReadonly && (
            <button onClick={onNewAssessment} className="flex items-center gap-2 text-sm bg-[#E53935] text-white hover:bg-[#C62828] px-4 py-1.5 rounded-lg transition-colors ml-1">
              <Plus className="w-4 h-4" /> New
            </button>
          )}
          
          {/* User Menu */}
          <div className="ml-2 pl-3 border-l border-[#D9D6D0] flex items-center gap-3">
            {profile?.is_admin && (
              <button onClick={onAdmin} className="flex items-center gap-1.5 text-sm text-[#E53935] hover:text-[#C62828] transition-colors font-medium">
                <Shield className="w-4 h-4" /> Admin
              </button>
            )}
            {isReadonly && (
              <span className="text-xs px-2 py-0.5 bg-[#9CA3AF] text-white rounded-full">Read-only</span>
            )}
            <span className="text-xs text-[#666666] max-w-[120px] truncate" title={user?.email}>
              {profile?.full_name || user?.email?.split('@')[0]}
            </span>
            <button onClick={onLogout} className="flex items-center gap-1 text-sm text-[#666666] hover:text-[#E53935] transition-colors" title="Sign out">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
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
        <div className="md:hidden mt-4 pt-4 border-t border-[#D9D6D0] space-y-1">
          {lastAutoSave && (
            <div className="text-xs text-[#9CA3AF] px-2 pb-2">
              Auto-saved {lastAutoSave.toLocaleTimeString()}
            </div>
          )}
          {isReadonly && (
            <div className="px-4 py-2">
              <span className="text-xs px-2 py-0.5 bg-[#9CA3AF] text-white rounded-full">Read-only Access</span>
            </div>
          )}
          <button onClick={() => { onStayConscious(); setMobileMenuOpen(false); }} className={mobileNavBtnClass('stay-conscious')}>
            <Sparkles className="w-5 h-5" /> Stay Conscious
          </button>
          <button onClick={() => { onComparison(); setMobileMenuOpen(false); }} className={mobileNavBtnClass('compare')}>
            <Users className="w-5 h-5" /> Compare Brands
          </button>
          <button onClick={() => { onCompassResults(); setMobileMenuOpen(false); }} className={mobileNavBtnClass('results')}>
            <BarChart3 className="w-5 h-5" /> Results Grid
          </button>
          <button onClick={() => { onSavedAssessments(); setMobileMenuOpen(false); }} className={mobileNavBtnClass('saved')}>
            <FileText className="w-5 h-5" /> Saved Assessments
          </button>
          {!isReadonly && (
            <button onClick={() => { onNewAssessment(); setMobileMenuOpen(false); }} className="w-full flex items-center gap-3 px-4 py-3 bg-[#E53935] text-white rounded-lg transition-colors">
              <Plus className="w-5 h-5" /> New Assessment
            </button>
          )}
          
          {/* Mobile User Controls */}
          <div className="pt-2 mt-2 border-t border-[#D9D6D0]">
            <div className="px-4 py-2 text-sm text-[#666666]">
              Signed in as <span className="font-medium">{profile?.full_name || user?.email}</span>
            </div>
            {profile?.is_admin && (
              <button onClick={() => { onAdmin(); setMobileMenuOpen(false); }} className="w-full flex items-center gap-3 px-4 py-3 text-[#E53935] hover:bg-[#F0EEEA] rounded-lg transition-colors">
                <Shield className="w-5 h-5" /> User Management
              </button>
            )}
            <button onClick={onLogout} className="w-full flex items-center gap-3 px-4 py-3 text-[#666666] hover:bg-[#F0EEEA] rounded-lg transition-colors">
              <LogOut className="w-5 h-5" /> Sign Out
            </button>
          </div>
        </div>
      )}
    </header>
  );
}

// Completion Indicator for Assessment Pages
function CompletionIndicator({ items }) {
  const completed = items.filter(i => i.done).length;
  const total = items.length;
  const percentage = Math.round((completed / total) * 100);
  
  return (
    <div className="bg-white border border-[#E8E6E1] rounded-lg p-3 mb-6">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-[#666666] uppercase tracking-wide">Progress</span>
        <span className="text-xs font-medium text-[#1A1A1A]">{completed}/{total} complete</span>
      </div>
      <div className="h-1.5 bg-[#E8E6E1] rounded-full overflow-hidden mb-3">
        <div 
          className="h-full bg-[#E53935] rounded-full transition-all duration-300"
          style={{ width: `${percentage}%` }}
        />
      </div>
      <div className="flex flex-wrap gap-2">
        {items.map((item, i) => (
          <span 
            key={i}
            className={`text-xs px-2 py-1 rounded-full flex items-center gap-1 ${
              item.done 
                ? 'bg-[#E53935]/10 text-[#E53935]' 
                : 'bg-[#F0EEEA] text-[#999999]'
            }`}
          >
            {item.done ? <Check className="w-3 h-3" /> : <span className="w-3 h-3 rounded-full border border-current" />}
            {item.label}
          </span>
        ))}
      </div>
    </div>
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
  const [animate, setAnimate] = useState(false);
  
  useEffect(() => {
    // Trigger animation after mount
    const timer = setTimeout(() => setAnimate(true), 100);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="min-h-[calc(100vh-80px)] flex items-center justify-center p-8 relative overflow-hidden">
      <div className="max-w-3xl text-center">
        {/* Headline - appears first */}
        <h1 
          className={`text-5xl md:text-6xl font-bold text-[#1A1A1A] mb-6 leading-tight transition-all duration-1000 ease-out ${
            animate 
              ? 'opacity-100 translate-y-0' 
              : 'opacity-0 translate-y-8'
          }`}
        >
          <span className="block">Consequential brands</span>
          <span className="block">are conscious brands.</span>
        </h1>
        
        {/* Subtitle - appears second */}
        <p 
          className={`text-xl text-[#333333] mb-8 leading-relaxed max-w-2xl mx-auto transition-all duration-1000 ease-out ${
            animate 
              ? 'opacity-100 translate-y-0 delay-300' 
              : 'opacity-0 translate-y-6'
          }`}
          style={{ transitionDelay: animate ? '300ms' : '0ms' }}
        >
          They don't just show up, they stand out. They don't follow trends; they shape narratives. 
          The Conscious Compass explores your brand's impact across 8 essential attributes.
        </p>
        
        {/* Button - appears third */}
        <div 
          className={`transition-all duration-700 ease-out ${
            animate 
              ? 'opacity-100 translate-y-0' 
              : 'opacity-0 translate-y-4'
          }`}
          style={{ transitionDelay: animate ? '600ms' : '0ms' }}
        >
          <button onClick={onStart} className="btn-primary btn-arrow text-lg px-8 py-4">
            Start Assessment
          </button>
        </div>
      </div>
      
      {/* Fully Conscious Badge */}
      <div 
        className={`absolute bottom-8 left-8 transition-all duration-1000 ease-out ${
          animate 
            ? 'opacity-100 translate-y-0' 
            : 'opacity-0 translate-y-12'
        }`}
        style={{ transitionDelay: animate ? '800ms' : '0ms' }}
      >
        <img 
          src="/fully-conscious-badge.png" 
          alt="Fully Conscious" 
          className="w-28 md:w-32 lg:w-40 drop-shadow-lg hover:scale-105 transition-transform duration-300"
        />
      </div>
      
      <div className="absolute bottom-4 right-4 text-xs text-[#9CA3AF]">
        Version 2.13.0
      </div>
    </div>
  );
}

// Read-Only Welcome Page - for users with read-only access
function ReadOnlyWelcomePage({ onCompassResults, onComparison, onSavedAssessments }) {
  const [animate, setAnimate] = useState(false);
  
  useEffect(() => {
    const timer = setTimeout(() => setAnimate(true), 100);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="min-h-[calc(100vh-80px)] flex items-center justify-center p-8 relative overflow-hidden">
      <div className="max-w-3xl text-center">
        {/* Headline */}
        <h1 
          className={`text-5xl md:text-6xl font-bold text-[#1A1A1A] mb-6 leading-tight transition-all duration-1000 ease-out ${
            animate ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
          }`}
        >
          <span className="block">Welcome to the</span>
          <span className="block">Conscious Compass.</span>
        </h1>
        
        {/* Subtitle */}
        <p 
          className={`text-xl text-[#333333] mb-4 leading-relaxed max-w-2xl mx-auto transition-all duration-1000 ease-out ${
            animate ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
          }`}
          style={{ transitionDelay: animate ? '300ms' : '0ms' }}
        >
          You have read-only access to view brand assessments, compare results, and explore saved reports.
        </p>
        
        <p 
          className={`text-sm text-[#666666] mb-8 transition-all duration-1000 ease-out ${
            animate ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
          }`}
          style={{ transitionDelay: animate ? '400ms' : '0ms' }}
        >
          Contact an administrator if you need full access to run new assessments.
        </p>
        
        {/* Navigation buttons */}
        <div 
          className={`flex flex-col sm:flex-row gap-4 justify-center transition-all duration-700 ease-out ${
            animate ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}
          style={{ transitionDelay: animate ? '600ms' : '0ms' }}
        >
          <button onClick={onCompassResults} className="btn-primary flex items-center justify-center gap-2 text-lg px-8 py-4">
            <BarChart3 className="w-5 h-5" /> View Results
          </button>
          <button onClick={onComparison} className="btn-secondary flex items-center justify-center gap-2 text-lg px-8 py-4">
            <Users className="w-5 h-5" /> Compare Brands
          </button>
          <button onClick={onSavedAssessments} className="btn-secondary flex items-center justify-center gap-2 text-lg px-8 py-4">
            <FileText className="w-5 h-5" /> Saved Assessments
          </button>
        </div>
      </div>
      
      {/* Fully Conscious Badge */}
      <div 
        className={`absolute bottom-8 left-8 transition-all duration-1000 ease-out ${
          animate 
            ? 'opacity-100 translate-y-0' 
            : 'opacity-0 translate-y-12'
        }`}
        style={{ transitionDelay: animate ? '800ms' : '0ms' }}
      >
        <img 
          src="/fully-conscious-badge.png" 
          alt="Fully Conscious" 
          className="w-28 md:w-32 lg:w-40 drop-shadow-lg hover:scale-105 transition-transform duration-300"
        />
      </div>
      
      <div className="absolute bottom-4 right-4 text-xs text-[#9CA3AF]">
        Version 2.12.73 | Read-only Access
      </div>
    </div>
  );
}

// Setup Page
function SetupPage({ project, setProject, apiKey, setApiKey, onNext, onBack }) {
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

        {/* Only show API key field if no default is configured */}
        {!DEFAULT_API_KEY && (
          <div className="pt-4 border-t border-[#D9D6D0]">
            <label className="block text-sm font-medium text-[#1A1A1A] mb-2">Claude API Key *</label>
            <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-ant-..." className="w-full px-4 py-3 border border-[#D9D6D0] rounded-lg bg-white font-mono text-sm" />
            <p className="text-xs text-[#666666] mt-2">Get your API key from <a href="https://console.anthropic.com" target="_blank" rel="noopener noreferrer" className="text-[#E53935] hover:underline">console.anthropic.com</a></p>
          </div>
        )}
        {DEFAULT_API_KEY && (
          <div className="pt-4 border-t border-[#D9D6D0]">
            <div className="flex items-center gap-2 text-sm text-[#059669]">
              <Check className="w-4 h-4" />
              <span>API key configured</span>
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between mt-10">
        <button onClick={onBack} className="btn-secondary flex items-center gap-2"><ArrowLeft className="w-4 h-4" /> Back</button>
        <button onClick={onNext} disabled={!canProceed} className="btn-primary flex items-center gap-2">
          Continue <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// Technical Performance Audit Component (Manual Entry + Auto-Fetch)
function TechnicalAuditSection({ websiteUrl, assessmentData, setAssessmentData }) {
  const [techAudit, setTechAudit] = useState(assessmentData.techAudit || {
    scores: { performance: '', accessibility: '', bestPractices: '', seo: '' },
    metrics: {}
  });
  const [isFetching, setIsFetching] = useState(false);
  const [fetchError, setFetchError] = useState(null);

  // Helper function to get color based on PageSpeed score
  const getScoreColor = (score) => {
    if (score === '' || score === undefined || score === null) return '#666666';
    const num = parseInt(score);
    if (num >= 90) return '#059669'; // Green - Good
    if (num >= 50) return '#D97706'; // Amber - Needs Improvement
    return '#DC2626'; // Red - Poor
  };

  // Helper function to get label based on PageSpeed score
  const getScoreLabel = (score) => {
    if (score === '' || score === undefined || score === null) return '';
    const num = parseInt(score);
    if (num >= 90) return 'Good';
    if (num >= 50) return 'Needs Work';
    return 'Poor';
  };

  const updateScore = (field, value) => {
    const numValue = value === '' ? '' : Math.min(100, Math.max(0, parseInt(value) || 0));
    const updated = {
      ...techAudit,
      scores: { ...techAudit.scores, [field]: numValue },
      fetchedAt: new Date().toISOString(),
    };
    setTechAudit(updated);
    
    // Only save to assessment if at least one score is entered
    const hasScores = Object.values(updated.scores).some(s => s !== '' && s !== undefined);
    setAssessmentData({ ...assessmentData, techAudit: hasScores ? updated : null });
  };

  const fetchPageSpeedScores = async () => {
    if (!websiteUrl) return;
    
    setIsFetching(true);
    setFetchError(null);
    
    try {
      const url = websiteUrl.startsWith('http') ? websiteUrl : 'https://' + websiteUrl;
      
      // Use server-side proxy to avoid CORS issues
      const response = await fetch(`/api/pagespeed?url=${encodeURIComponent(url)}`);
      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error);
      }
      
      if (data.scores) {
        const updated = {
          scores: data.scores,
          metrics: {},
          fetchedAt: data.fetchedAt || new Date().toISOString(),
        };
        
        setTechAudit(updated);
        setAssessmentData({ ...assessmentData, techAudit: updated });
      } else {
        throw new Error('Could not analyze this website');
      }
    } catch (err) {
      let errorMsg = err.message || 'Failed to fetch PageSpeed scores';
      if (errorMsg.includes('Failed to fetch') || errorMsg.includes('NetworkError')) {
        errorMsg = 'Network error - check your connection and try again';
      } else if (errorMsg.includes('quota') || errorMsg.includes('limit') || errorMsg.includes('RESOURCE_EXHAUSTED')) {
        errorMsg = 'API rate limit reached - please wait a minute and try again';
      }
      setFetchError(errorMsg);
    } finally {
      setIsFetching(false);
    }
  };
  // Generate PageSpeed URL for the website (desktop analysis)
  const pageSpeedUrl = websiteUrl 
    ? `https://pagespeed.web.dev/analysis?url=${encodeURIComponent(websiteUrl.startsWith('http') ? websiteUrl : 'https://' + websiteUrl)}&form_factor=desktop`
    : null;

  const hasAnyScore = Object.values(techAudit.scores).some(s => s !== '' && s !== undefined);

  return (
    <div className="card p-5 mb-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-medium text-[#1A1A1A]">Technical Performance Audit</h3>
          <p className="text-xs text-[#666666]">PageSpeed scores impact ATTENTIVE & COGENT</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={fetchPageSpeedScores}
            disabled={isFetching || !websiteUrl}
            className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1"
          >
            {isFetching ? <><Loader2 className="w-3 h-3 animate-spin" /> Fetching...</> : <><Sparkles className="w-3 h-3" /> Auto-Fetch</>}
          </button>
          {pageSpeedUrl && (
            <a 
              href={pageSpeedUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1"
            >
              <ExternalLink className="w-3 h-3" /> Manual
            </a>
          )}
        </div>
      </div>

      {fetchError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 text-xs text-red-700">
          {fetchError} — Try the Manual button instead.
        </div>
      )}

      {!fetchError && (
        <div className="bg-[#F0EEEA] rounded-lg p-3 mb-4">
          <p className="text-xs text-[#666666]">
            Click "Auto-Fetch" to get scores automatically, or "Manual" to verify on Google PageSpeed.
          </p>
        </div>
      )}

      {/* Score Input Grid */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { key: 'performance', label: 'Performance' },
          { key: 'accessibility', label: 'Accessibility' },
          { key: 'bestPractices', label: 'Best Practices' },
          { key: 'seo', label: 'SEO' },
        ].map((item) => (
          <div key={item.key} className="text-center">
            <input
              type="number"
              min="0"
              max="100"
              value={techAudit.scores[item.key] ?? ''}
              onChange={(e) => updateScore(item.key, e.target.value)}
              placeholder="-"
              className="w-full text-center text-2xl font-bold py-2 border border-[#D9D6D0] rounded-lg bg-white focus:ring-2 focus:ring-[#E53935] focus:border-transparent"
              style={{ color: getScoreColor(techAudit.scores[item.key]) }}
            />
            <div className="text-xs text-[#666666] mt-1">{item.label}</div>
            <div 
              className="text-[10px] font-medium"
              style={{ color: getScoreColor(techAudit.scores[item.key]) }}
            >
              {getScoreLabel(techAudit.scores[item.key])}
            </div>
          </div>
        ))}
      </div>

      {hasAnyScore && (
        <div className="mt-3 pt-3 border-t border-[#E8E6E1] flex items-center gap-2">
          <Check className="w-4 h-4 text-[#059669]" />
          <span className="text-xs text-[#666666]">Scores will be included in assessment</span>
        </div>
      )}
    </div>
  );
}

// Website Assessment with Image Upload
// Website Assessment with Multiple Image Upload (up to 4)
function WebsiteAssessment({ assessmentData, setAssessmentData, apiKey, project, onPrev, onNext, onClearScores }) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [isCompressing, setIsCompressing] = useState(false);
  const [isAutoAssessing, setIsAutoAssessing] = useState(false);
  const [error, setError] = useState(null);
  const [images, setImages] = useState(assessmentData.images || []);
  const [pagesReviewed, setPagesReviewed] = useState(assessmentData.pagesReviewed || '');
  const [websiteContent, setWebsiteContent] = useState(assessmentData.websiteContent || '');
  const [credentialsContent, setCredentialsContent] = useState(assessmentData.credentialsContent || '');
  const fileInputRef = useRef(null);
  
  // SEO Visibility State (simplified)
  const [seoAssessment, setSeoAssessment] = useState(assessmentData.seoAssessment || '');
  const [isAssessingSeo, setIsAssessingSeo] = useState(false);
  const [isAssessingCredentials, setIsAssessingCredentials] = useState(false);

  const industryName = INDUSTRIES.find(i => i.id === project.industry)?.name || 'their industry';

  // Auto-assess credentials and recognition
  const runCredentialsAssess = async () => {
    setIsAssessingCredentials(true);
    setError(null);
    try {
      const prompt = `Search for awards, certifications, memberships, speaking engagements, and industry recognition for ${project.brandName} (${project.websiteUrl}).

Look for:
1. Industry awards (e.g., Inc. 5000, Deloitte Fast 500, industry-specific awards)
2. Certifications (e.g., ISO, SOC 2, B Corp, industry certifications)
3. Professional memberships (e.g., trade associations, councils, chambers)
4. Speaking engagements (e.g., conference keynotes, panel appearances, TEDx)
5. Media recognition (e.g., Forbes lists, analyst mentions, "best of" rankings)
6. Client logos or notable partnerships visible on their website
7. Case study awards or recognition
8. Executive thought leadership recognition (e.g., Forbes Council, industry advisory boards)

Search both their website and external sources. Report ONLY what you find with evidence. If you cannot find recognition in a category, say "None found" for that category.

Format your response as a concise bulleted list grouped by category. Include dates/years where available.`;

      const result = await callClaude(prompt, apiKey);
      setCredentialsContent(result);
      setAssessmentData({ ...assessmentData, credentialsContent: result });
    } catch (e) { 
      setError('Failed to search credentials: ' + e.message); 
    }
    finally { setIsAssessingCredentials(false); }
  };

  // Auto-assess website
  const runAutoAssess = async () => {
    setIsAutoAssessing(true);
    setError(null);
    try {
      const prompt = `You are a senior brand strategist and UX analyst with deep expertise in digital brand presence, content strategy, and audience experience design. Your task is to conduct a comprehensive website assessment for ${project.brandName}, operating in the ${industryName} sector. The website URL is ${project.websiteUrl}.

Begin by thoroughly reviewing the website, including its pages, navigation, content, imagery, and overall design, before making any evaluations. Every finding must be grounded in direct observation from the website itself. Do not speculate, infer from industry norms, or assume capabilities or intentions that are not evidenced by what is actually present on the site.

Step 1: Audience & Intent Identification
Before scoring any dimension, identify who this website is actually built for based solely on its content, language, navigation structure, and calls to action. Name the distinct audience segments the site appears to be addressing. This audience identification will serve as the evaluative lens for all subsequent dimensions.

Step 2: Primary Message, Mission & Vision
Based exclusively on the language, headlines, copy, and content present on the site, extract and articulate: the brand's primary message (what it leads with), its apparent mission (what it exists to do), and its vision (where it is pointing). If any of these are ambiguous, absent, or contradictory across pages, flag this as a finding rather than filling the gap with assumption.

Step 3: Dimensional Assessment
Evaluate the website across each of the following dimensions. For each, provide a qualitative assessment grounded in specific observations, a performance score from 1 to 10 with clear rationale, and 1 to 2 actionable recommendations.

1. Information Architecture
Assess the logic, clarity, and depth of the site's navigational structure. Does the hierarchy reflect the priorities of the audiences identified in Step 1? Are key sections easy to locate? Is there evidence of user journeys being intentionally designed, or does the structure feel arbitrary or internally driven?

2. Design System
Evaluate the consistency and coherence of the visual design language, including typography, color palette, spacing, component design, and iconography. Is a defined design system being applied consistently across pages, or are there visible inconsistencies that undermine professionalism and brand cohesion?

3. Layout & Composition
Assess how individual pages are structured visually. Does the layout guide attention effectively? Is hierarchy established through scale, contrast, and spacing? Does the composition reflect intentional design decisions or a templated, generic approach?

4. Content Strategy & Quality
Evaluate the depth, clarity, relevance, and voice of written content across the site. Is the content tailored to the audiences identified, or does it read as generic? Is it specific and substantive, or does it rely on vague, buzzword-heavy language? Assess whether content earns credibility or merely claims it.

5. User Experience (UX)
Assess the overall ease and quality of interacting with the site. Consider page load indicators, interactive elements, form design, mobile responsiveness signals, error handling, and accessibility cues where observable. Does the site remove friction or introduce it?

6. Data Visualization
Evaluate the use of charts, graphs, infographics, statistics, and other data presentations where present. Are they clear, accurate, and purposeful? Do they reinforce key messages or feel decorative? If data visualization is absent where it would clearly serve the audience, note this as a gap.

7. Use of Imagery
Assess the quality, relevance, and strategic use of photography, illustration, and visual media. Does imagery reflect the brand's identity and resonate with its identified audiences, or does it rely on generic stock photography? Is there a coherent visual narrative, or is imagery applied inconsistently?

8. Audience Optimization
Synthesize observations from all prior dimensions to render a verdict on how well the site serves the audiences identified in Step 1. Does the site demonstrate a genuine understanding of those audiences, their needs, language, and decision-making context, or does it prioritize internal messaging over external relevance?

Step 4: Brand Consciousness Attribute Mapping
Based on your website observations, provide specific evidence relevant to each of these 8 brand consciousness attributes:

AWAKE (Narrative Leadership): Does the website show evidence of thought leadership, original perspectives, or industry-shaping content? Are there research reports, frameworks, or positions that establish narrative authority?

AWARE (Audience Understanding): Does the site demonstrate deep knowledge of its audiences? Are there feedback mechanisms, community elements, or content that shows genuine listening and trust-building?

REFLECTIVE (Brand Authenticity): Is there alignment between brand claims and demonstrated evidence? Are employees, culture, and leadership visible? Does the site feel authentic or corporate?

ATTENTIVE (Experience Excellence): Is the experience consistent, polished, and error-free? Does quality extend across all pages and elements? Are there accessibility considerations?

COGENT (Strategic Intelligence): Is there evidence of data-driven thinking? SEO optimization? Structured content? Conversion paths? Measurement infrastructure?

SENTIENT (Emotional Connection): Does the site create emotional resonance? Is the creative distinctive? Does it inspire action beyond rational consideration?

VISIONARY (Meaningful Purpose): Is there a clear purpose beyond profit? Does the brand point toward something meaningful? Are stakeholder benefits articulated?

INTENTIONAL (Substance & Confidence): Does the site project confidence through decisive positioning? Is leadership visible? Are claims substantiated? Is professionalism consistent?

Step 5: Brand Strength Assessment
Drawing on everything observed across the site, including message clarity, design quality, content credibility, audience alignment, and overall execution, provide a holistic assessment of brand strength as expressed through this digital presence. Is the brand coming across as confident, differentiated, and credible? Or does the site reveal gaps between what the brand claims and what it actually demonstrates? Be specific about where brand strength is evident and where it breaks down.

Tone instruction: Be direct and critical where the evidence warrants it. Do not soften findings out of diplomacy. If the site has weak content, inconsistent design, or fails its audiences, name it plainly and explain the consequence. Every assessment must be evidence-based; cite specific pages, sections, copy, or design elements to support your conclusions. Where something cannot be observed directly, do not comment on it.

Conclude with an Overall Website Brand Score (1 to 10), a 2 to 3 sentence executive summary of the site's brand effectiveness, and the single most important improvement priority that would have the greatest impact on brand strength and audience experience.`;

      const result = await callClaude(prompt, apiKey);
      setAssessmentData({ ...assessmentData, autoAssessContent: result });
    } catch (err) {
      setError(err.message);
    } finally {
      setIsAutoAssessing(false);
    }
  };

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
${credentialsContent ? `RECOGNITION & CREDENTIALS: ${credentialsContent}\n` : ''}

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
          // Always compress to ensure we stay under 5MB API limit
          compressImage(dataUrl, 3.5).then(resolve).catch(() => resolve(dataUrl));
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

${credentialsContent ? `RECOGNITION & CREDENTIALS OBSERVED:\n${credentialsContent}\n` : ''}

SCREENSHOTS PROVIDED: ${images.length} image(s) showing key pages

${assessmentData.observations ? `ASSESSOR OBSERVATIONS:\n${assessmentData.observations}` : ''}

${assessmentData.autoAssessContent ? `AUTO-ASSESS WEBSITE ANALYSIS (previously generated - integrate these findings):\n${assessmentData.autoAssessContent}\n` : ''}

${seoAssessment ? `SEO VISIBILITY ASSESSMENT (previously generated):\n${seoAssessment}\n` : ''}

${assessmentData.techAudit && (assessmentData.techAudit.scores.performance !== '' || assessmentData.techAudit.scores.accessibility !== '') ? `TECHNICAL PERFORMANCE AUDIT (PageSpeed):
- Performance: ${assessmentData.techAudit.scores.performance !== '' ? assessmentData.techAudit.scores.performance + '/100' : 'N/A'}
- Accessibility: ${assessmentData.techAudit.scores.accessibility !== '' ? assessmentData.techAudit.scores.accessibility + '/100' : 'N/A'}
- Best Practices: ${assessmentData.techAudit.scores.bestPractices !== '' ? assessmentData.techAudit.scores.bestPractices + '/100' : 'N/A'}
- Technical SEO: ${assessmentData.techAudit.scores.seo !== '' ? assessmentData.techAudit.scores.seo + '/100' : 'N/A'}
` : ''}

Based on the screenshots and content provided, deliver a comprehensive website assessment covering:

1. BRAND STRATEGY AND POSITIONING
   - How clear and differentiated is the brand positioning?
   - What is the core value proposition? Is it immediately apparent?
   - How well does the visual identity support and reinforce the brand?
   - Is there a consistent brand voice across pages?
   - CRITICAL: Compare brand presentation across screenshots - is the brand identity cohesive?

2. BRAND ARCHITECTURE & HIERARCHY
   - Identify the brand architecture model used:
     * SINGLE BRAND: One unified brand identity across all offerings
     * HOUSE OF BRANDS: Multiple distinct brands with little connection to parent
     * ENDORSED STRUCTURE: Sub-brands endorsed by master brand (e.g., "X by Company")
     * SUB-BRAND STRUCTURE: Extensions clearly tied to master brand (e.g., "Company X")
     * UNCLEAR/INCONSISTENT: No discernible structure or confusing hierarchy
   - How clearly is the relationship between parent brand, sub-brands, and products communicated?
   - Are naming conventions consistent and logical?
   - Is there visual hierarchy that clarifies brand/product relationships?
   - Does the architecture support or confuse audience understanding?
   - CRITICAL: Note any confusion between what is the brand vs. products vs. services vs. sub-brands

3. MESSAGING AND STORYTELLING
   - Analyze the headline/hero messaging effectiveness
   - Is there a compelling narrative arc across the site?
   - Does the content create emotional resonance?
   - How well does the messaging speak to the target audience?

4. CONTENT QUALITY AND CONSISTENCY
   - Evaluate the quality and depth of written content
   - Is content benefit-focused or feature-focused?
   - Is there consistency in tone, style, and messaging across pages?
   - Are there content gaps or areas that need strengthening?

5. INFORMATION ARCHITECTURE
   - How logical and intuitive is the site structure?
   - Is content organized in a way that matches user mental models?
   - Are related pages properly linked and grouped?
   - How easy is it to find key information (pricing, contact, services)?
   - Is there clear hierarchy from primary to secondary to tertiary content?

6. USER INTERFACE (UI) DESIGN & VISUAL CONSISTENCY
   - How professional, modern, and polished is the interface?
   - CRITICAL: Evaluate design consistency across all screenshots - are colors, fonts, spacing, and visual treatments consistent page-to-page?
   - Are interactive elements (buttons, forms, links) styled consistently throughout?
   - Is there appropriate use of whitespace and visual breathing room?
   - How effective is the typography hierarchy (headings, body, captions)?
   - Are images and media high quality and purposeful?
   - Is the design responsive and mobile-friendly (if visible)?
   - Note any inconsistencies in: color palette, button styles, heading treatments, spacing patterns, or visual language

7. USER EXPERIENCE (UX) AND NAVIGATION
   - How intuitive is the navigation structure?
   - Is the visual hierarchy clear and effective?
   - Are calls-to-action prominent, compelling, and well-placed?
   - How well does the site guide users toward conversion?
   - Are there any friction points or confusing elements?

8. ACCESSIBILITY (WCAG 2.1 Level AA Compliance)
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

9. SEO & SEARCH VISIBILITY
   - Based on visible content structure, how well-optimized is this site for search?
   - Are key brand messages and value propositions likely to rank for relevant keywords?
   - Is content structured for discoverability (headings, meta-likely content)?
   - How well could AI systems understand and represent this brand?
${seoAssessment ? `   - INTEGRATE the SEO Visibility Assessment findings above into your analysis
   - Reference the target keywords identified and assess if the website content supports ranking for them
   - Consider the brand searchability assessment in your evaluation` : '   - Note: No SEO visibility assessment was run - provide general observations only'}

Write in flowing prose with specific observations. Be concrete about what you see in the screenshots. Compare elements across different pages to identify consistency or inconsistency.

End with:
- BRAND ARCHITECTURE TYPE: Identify which model (Single Brand, House of Brands, Endorsed, Sub-brand, or Unclear) with brief explanation
- DESIGN CONSISTENCY RATING (1-10): Rate overall visual consistency across pages with brief explanation
${seoAssessment ? '- SEO READINESS RATING (1-10): Based on the SEO assessment, rate how well the site is positioned for search visibility' : ''}
- 3-5 KEY STRENGTHS (what the website does well)
- 3-5 PRIORITY IMPROVEMENTS (specific, actionable recommendations including brand architecture if unclear)`;

      const result = await callClaude(prompt, apiKey, images[0], images.slice(1));
      setAssessmentData({ 
        ...assessmentData, 
        status: 'complete', 
        content: result, 
        images, 
        pagesReviewed, 
        websiteContent,
        credentialsContent,
        seoAssessment // Preserve SEO assessment
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const isComplete = assessmentData.status === 'complete';

  // Completion tracking
  const completionItems = [
    { label: 'Auto-Assess', done: !!assessmentData.autoAssessContent },
    { label: 'SEO Check', done: !!seoAssessment },
    { label: 'Screenshots', done: images.length > 0 },
    { label: 'Pages Listed', done: !!pagesReviewed },
    { label: 'Analysis', done: isComplete },
  ];

  // Required checks before proceeding - ALL items mandatory
  const canProceed = isComplete && !!assessmentData.autoAssessContent && !!seoAssessment && images.length > 0 && !!pagesReviewed;
  const [proceedError, setProceedError] = useState(null);

  const handleProceed = () => {
    if (!assessmentData.autoAssessContent) {
      setProceedError('Please complete the Auto-Assess Website check before proceeding.');
      return;
    }
    if (!seoAssessment) {
      setProceedError('Please complete the SEO Visibility Assessment before proceeding.');
      return;
    }
    if (images.length === 0) {
      setProceedError('Please upload at least one screenshot of the website before proceeding.');
      return;
    }
    if (!pagesReviewed) {
      setProceedError('Please list the pages you reviewed before proceeding.');
      return;
    }
    if (!isComplete) {
      setProceedError('Please run the Website Analysis before proceeding.');
      return;
    }
    setProceedError(null);
    onNext();
  };

  return (
    <div className="max-w-4xl mx-auto p-8 animate-fade-in">
      <div className="flex items-start gap-4 mb-6">
        <div className="w-12 h-12 bg-[#E53935]/10 rounded-xl flex items-center justify-center">
          <Globe className="w-6 h-6 text-[#E53935]" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-[#1A1A1A]">Website Assessment</h2>
          <p className="text-sm text-[#666666]">{project.brandName} · {project.websiteUrl}</p>
        </div>
      </div>

      <CompletionIndicator items={completionItems} />

      {/* Auto-Assess Website */}
      <div className="card p-5 mb-4 border-l-4 border-[#E53935]">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className="text-sm font-medium text-[#1A1A1A] mb-1 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#E53935]" />
              Auto-Assess Website
            </h3>
            <p className="text-xs text-[#666666]">
              AI-powered comprehensive analysis across 8 dimensions: Information Architecture, Design System, Layout, Content Strategy, UX, Data Visualization, Imagery, and Audience Optimization.
            </p>
          </div>
          <button 
            onClick={runAutoAssess} 
            disabled={isAutoAssessing} 
            className="btn-secondary text-sm py-2 px-4 flex items-center gap-2 flex-shrink-0"
          >
            {isAutoAssessing ? <><Loader2 className="w-4 h-4 animate-spin" /> Assessing...</> : <><Bot className="w-4 h-4" /> Auto-Assess</>}
          </button>
        </div>
        
        {assessmentData.autoAssessContent && (
          <div className="mt-4">
            <div className="flex items-center gap-2 mb-2">
              <Check className="w-4 h-4 text-[#10B981]" />
              <span className="text-sm font-medium text-[#1A1A1A]">Website Assessment Complete</span>
            </div>
            <div className="bg-[#F0EEEA] rounded-lg p-4 max-h-80 overflow-y-auto">
              <pre className="text-sm text-[#333333] whitespace-pre-wrap font-sans">{assessmentData.autoAssessContent}</pre>
            </div>
          </div>
        )}
      </div>

      {/* Pages Reviewed */}
      <div className="card p-5 mb-4">
        <h3 className="text-sm font-medium text-[#1A1A1A] mb-2">Pages Reviewed</h3>
        <p className="text-sm text-[#666666] mb-3">List the pages you reviewed (e.g., Homepage, About, Services, Contact, Blog)</p>
        <input 
          type="text" 
          value={pagesReviewed} 
          onChange={(e) => { setPagesReviewed(e.target.value); setAssessmentData({ ...assessmentData, pagesReviewed: e.target.value }); }}
          placeholder="e.g., Homepage, About Us, Services, Case Studies, Contact"
          className="w-full px-4 py-3 border border-[#D9D6D0] rounded-lg bg-white"
        />
      </div>

      {/* Recognition & Credentials */}
      <div className="card p-5 mb-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium text-[#1A1A1A]">Recognition & Credentials (Optional)</h3>
          <button 
            onClick={runCredentialsAssess} 
            disabled={isAssessingCredentials || !project.brandName}
            className="px-3 py-1.5 bg-[#8B5CF6] text-white text-xs font-medium rounded-lg hover:bg-[#7C3AED] transition-colors flex items-center gap-1.5 disabled:opacity-50"
          >
            {isAssessingCredentials ? (
              <><Loader2 className="w-3 h-3 animate-spin" /> Searching...</>
            ) : (
              <><Sparkles className="w-3 h-3" /> Auto-Search</>
            )}
          </button>
        </div>
        <p className="text-sm text-[#666666] mb-3">Awards, certifications, memberships, speaking engagements, or industry recognition.</p>
        <textarea 
          value={credentialsContent} 
          onChange={(e) => { setCredentialsContent(e.target.value); setAssessmentData({ ...assessmentData, credentialsContent: e.target.value }); }}
          placeholder="e.g., Inc. 5000 2024, ISO 27001 certified, Forbes Council member, keynote at SXSW 2025, Gartner Cool Vendor..."
          className={`w-full h-24 px-4 py-3 border border-[#D9D6D0] rounded-lg bg-white resize-none ${credentialsContent ? 'bg-[#F0EEEA]' : ''}`}
        />
        {credentialsContent && (
          <p className="text-xs text-[#059669] mt-1">✓ Recognition data captured</p>
        )}
      </div>

      {/* Screenshots */}
      <div className="card p-5 mb-4">
        <h3 className="text-sm font-medium text-[#1A1A1A] mb-2 flex items-center gap-2">
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
      <div className="card p-5 mb-4">
        <h3 className="text-sm font-medium text-[#1A1A1A] mb-2">Website Content (Optional)</h3>
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
          className="w-full h-28 px-4 py-3 border border-[#D9D6D0] rounded-lg bg-white resize-none text-sm"
        />
      </div>

      {/* SEO Visibility Assessment */}
      <div className="card p-5 mb-4">
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
                Regenerate Analysis
              </button>
            </div>
            <div className="bg-[#F0EEEA] rounded-lg p-4 max-h-64 overflow-y-auto">
              <pre className="text-sm text-[#333333] whitespace-pre-wrap font-sans">{seoAssessment}</pre>
            </div>
          </div>
        )}
      </div>

      {/* Technical Performance Audit */}
      <TechnicalAuditSection 
        websiteUrl={project.websiteUrl} 
        assessmentData={assessmentData}
        setAssessmentData={setAssessmentData}
      />

      {/* Assessor Observations */}
      <div className="card p-5 mb-4">
        <h3 className="text-sm font-medium text-[#1A1A1A] mb-2">Assessor Observations</h3>
        <p className="text-sm text-[#666666] mb-3">Your observations on brand alignment, storytelling, consistency issues, or other concerns.</p>
        <textarea value={assessmentData.observations || ''} onChange={(e) => setAssessmentData({ ...assessmentData, observations: e.target.value })}
          placeholder="Add your observations about:
- Brand alignment issues
- Storytelling strengths/weaknesses  
- Consistency across pages
- Navigation or UX concerns
- Content gaps
- Competitive positioning..." className="w-full h-20 px-3 py-2 border border-[#D9D6D0] rounded-lg bg-white resize-none" />
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
        <div className="card p-5 mb-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-[#1A1A1A] flex items-center gap-2">
              <Check className="w-5 h-5 text-[#E53935]" /> Analysis Complete
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

      {proceedError && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4 text-amber-800 text-sm flex items-center gap-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          {proceedError}
        </div>
      )}

      <div className="flex items-center justify-between pt-6 border-t border-[#D9D6D0]">
        <button onClick={onPrev} className="btn-secondary flex items-center gap-2"><ArrowLeft className="w-4 h-4" /> Back</button>
        <button onClick={handleProceed} disabled={!canProceed} className="btn-primary flex items-center gap-2">Continue <ArrowRight className="w-4 h-4" /></button>
      </div>
    </div>
  );
}

// Social Media Assessment with all platforms and image uploads
function SocialMediaAssessment({ assessmentData, setAssessmentData, apiKey, project, onPrev, onNext, onClearScores }) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [isCompressing, setIsCompressing] = useState(false);
  const [isAutoChecking, setIsAutoChecking] = useState(false);
  const [isSearchingWipo, setIsSearchingWipo] = useState(false);
  const [error, setError] = useState(null);
  const [socialHealthCheck, setSocialHealthCheck] = useState(assessmentData.socialHealthCheck || '');
  const [inputs, setInputs] = useState({
    linkedinUrl: assessmentData.linkedinUrl || '',
    linkedinAbout: assessmentData.linkedinAbout || '',
    linkedinPosts: assessmentData.linkedinPosts || '',
    linkedinArticles: assessmentData.linkedinArticles || '',
    linkedinFollowers: assessmentData.linkedinFollowers || '',
    employeeAdvocacy: assessmentData.employeeAdvocacy || '',
    awardsRecognition: assessmentData.awardsRecognition || '',
    xUrl: assessmentData.xUrl || '',
    xContent: assessmentData.xContent || '',
    instagramContent: assessmentData.instagramContent || '',
    youtubeContent: assessmentData.youtubeContent || '',
    hasYouTube: assessmentData.hasYouTube ?? true,
    redditAnswersContent: assessmentData.redditAnswersContent || '',
    wikipediaContent: assessmentData.wikipediaContent || '',
    glassdoorContent: assessmentData.glassdoorContent || '',
    wipoContent: assessmentData.wipoContent || '',
    hashtagContent: assessmentData.hashtagContent || '',
    paidMediaContent: assessmentData.paidMediaContent || '',
  });
  const [images, setImages] = useState(assessmentData.socialImages || []);
  const [instagramImages, setInstagramImages] = useState(assessmentData.instagramImages || []);
  const fileInputRef = useRef(null);
  const instagramFileInputRef = useRef(null);

  const updateInput = (key, value) => {
    setInputs(prev => ({ ...prev, [key]: value }));
    setAssessmentData({ ...assessmentData, [key]: value });
  };

  // Social Media Health Check - comprehensive brand presence analysis
  const runAutoCheck = async () => {
    setIsAutoChecking(true);
    setError(null);
    try {
      const industryName = INDUSTRIES.find(i => i.id === project.industry)?.name || 'Unknown';
      
      const prompt = `Conduct a comprehensive Social Media Health Check for ${project.brandName}.

Website: ${project.websiteUrl}
Industry: ${industryName}

Search the web for current information about this brand's social media presence and provide a detailed health assessment covering:

1. CHANNEL PRESENCE AUDIT
For each major platform (LinkedIn, X/Twitter, Instagram, Facebook, YouTube, TikTok), determine:
- Does the brand have an official/verified presence?
- Channel URL if found
- Approximate follower/subscriber count
- Mark as "Not Found" if no presence detected

2. POSTING ACTIVITY & CONSISTENCY
- How frequently is the brand posting on each active channel?
- When was the most recent post on each platform?
- Is posting regular and consistent or sporadic?
- Are there any abandoned/dormant accounts?

3. ENGAGEMENT HEALTH
- What engagement levels are visible? (likes, comments, shares relative to follower count)
- Are they responding to comments and mentions?
- Is there genuine community interaction or one-way broadcasting?
- Benchmark: 1-3% engagement rate is average, 3-6% is good, 6%+ is excellent

4. CONTENT QUALITY & BRAND CONSISTENCY
- Is visual branding consistent across platforms?
- Is the brand voice/tone consistent?
- What content themes dominate?
- Is content original or mostly reshared?

5. THIRD-PARTY COVERAGE & MENTIONS
- Are others talking about the brand on social media?
- What is the sentiment of mentions? (positive/neutral/negative)
- Any notable influencers or media outlets mentioning them?
- User-generated content presence?

6. REPUTATION & TRUST SIGNALS
- What do reviews, comments, and discussions reveal about brand perception?
- Any visible complaints, controversies, or PR issues?
- Employee advocacy signals (employees sharing brand content)?
- Trust indicators (verified accounts, response rates, transparency)?

7. COMPETITIVE VISIBILITY
- How does their social presence compare to typical brands in ${industryName}?
- Are they visible in industry conversations?
- Share of voice assessment

8. AI SEARCH VISIBILITY
- How is this brand represented in AI search results?
- Is brand information accurate and favorable in AI summaries?

FORMAT YOUR RESPONSE AS:
Start with a 2-3 sentence EXECUTIVE SUMMARY of overall social media health.

Then provide findings for each section above with specific evidence.

End with:
- OVERALL HEALTH SCORE: X/10
- TOP 3 STRENGTHS
- TOP 3 PRIORITY IMPROVEMENTS

Be direct and evidence-based. If information is limited or not found, say so clearly.`;

      const response = await fetch('/api/claude', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          useWebSearch: true
        })
      });

      if (!response.ok) throw new Error('Health check failed');
      const data = await response.json();
      const result = data.content?.[0]?.text || data.text || '';
      
      // Store the health check result
      setSocialHealthCheck(result);
      setAssessmentData({ ...assessmentData, socialHealthCheck: result });

      // Also fetch YouTube data from API for enhanced accuracy
      try {
        const ytResponse = await fetch(`/api/youtube?query=${encodeURIComponent(project.brandName)}&website=${encodeURIComponent(project.websiteUrl || '')}`);
        const ytData = await ytResponse.json();
        
        if (!ytData.error && !inputs.youtubeContent?.includes('[API Data]')) {
          let ytStats = '[API Data]\n\n';
          
          if (ytData.hasBrandedChannel && ytData.brandedChannel) {
            const ch = ytData.brandedChannel;
            const stats = ytData.brandedChannelStats;
            ytStats += `═══ OFFICIAL CHANNEL FOUND ═══
Channel: ${ch.channelTitle}
URL: ${ch.channelUrl || ch.customUrl}
Subscribers: ${stats?.subscriberCount?.toLocaleString() || 'Hidden'} (${ytData.summary?.subscriberTier})
Videos: ${stats?.videoCount?.toLocaleString() || 0}
Total Views: ${stats?.viewCount?.toLocaleString() || 0}
Created: ${ch.publishedAt ? new Date(ch.publishedAt).toLocaleDateString() : 'Unknown'}
`;
          } else {
            ytStats += `═══ NO OFFICIAL CHANNEL FOUND ═══
No YouTube channel matching "${project.brandName}" was identified.
`;
          }
          
          ytStats += `\n═══ THIRD-PARTY COVERAGE (${ytData.summary?.thirdPartyCoverage || 'Unknown'}) ═══\n`;
          
          if (ytData.thirdPartyCoverage && ytData.thirdPartyCoverage.length > 0) {
            ytData.thirdPartyCoverage.forEach((video, i) => {
              ytStats += `\n${i + 1}. "${video.title}"
   Channel: ${video.channelTitle}
   URL: ${video.videoUrl}\n`;
            });
          } else {
            ytStats += `No third-party videos found.\n`;
          }
          updateInput('youtubeContent', ytStats);
        }

        // Knowledge Graph API - check entity status
        const kgResponse = await fetch(`/api/knowledge-graph?query=${encodeURIComponent(project.brandName)}`);
        const kgData = await kgResponse.json();
        if (kgData.found && kgData.bestMatch && !inputs.wikipediaContent?.includes('[Knowledge Graph]')) {
          const kgInfo = `[Knowledge Graph] Entity Status: ${kgData.knowledgeGraphSignal}
${kgData.bestMatch.name ? `Name: ${kgData.bestMatch.name}` : ''}
${kgData.bestMatch.type?.length ? `Type: ${kgData.bestMatch.type.join(', ')}` : ''}
${kgData.bestMatch.description ? `Description: ${kgData.bestMatch.description}` : ''}
${kgData.bestMatch.url ? `Wikipedia: ${kgData.bestMatch.url}` : ''}`;
          
          const existingWiki = inputs.wikipediaContent || '';
          updateInput('wikipediaContent', `${kgInfo}\n\n${existingWiki}`);
        }
      } catch (apiErr) {
        console.log('Google API enhancement failed (non-critical):', apiErr.message);
      }

    } catch (err) {
      setError('Health check failed: ' + err.message);
    } finally {
      setIsAutoChecking(false);
    }
  };

  // WIPO Trademark Auto-Search using Claude web search
  const runWipoSearch = async () => {
    setIsSearchingWipo(true);
    setError(null);
    try {
      const response = await fetch('/api/claude', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: `Search for trademark registrations for "${project.brandName}".

Look for:
1. WIPO Global Brand Database registrations (branddb.wipo.int)
2. USPTO trademark registrations (for US)
3. EUIPO trademark registrations (for EU)
4. Any other national trademark registrations

For each registration found, note:
- Registration number
- Jurisdictions/countries covered
- Nice classification(s)
- Status (registered, pending, expired)
- Owner name

Also check for:
- Any similar/conflicting marks
- Name disputes or opposition proceedings
- Protection coverage gaps

Format as a concise summary. If no trademark registrations are found, state that clearly.`,
          useWebSearch: true
        })
      });

      if (!response.ok) throw new Error('Search failed');
      const data = await response.json();
      const result = data.content?.[0]?.text || data.text || '';
      
      if (result) {
        updateInput('wipoContent', `[Auto-searched] ${result}`);
      }
    } catch (err) {
      setError('WIPO search failed - please search manually');
    } finally {
      setIsSearchingWipo(false);
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
          // Always compress to ensure we stay under 5MB API limit
          compressImage(dataUrl, 3.5).then(resolve).catch(() => resolve(dataUrl));
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
          // Always compress to ensure we stay under 5MB API limit
          compressImage(dataUrl, 3.5).then(resolve).catch(() => resolve(dataUrl));
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

Employee Advocacy:
${inputs.employeeAdvocacy || '[Not assessed - look for evidence of employees sharing brand content]'}

Awards & Recognition:
${inputs.awardsRecognition || '[Not provided - note any awards, certifications, or industry recognition visible]'}

=== X (TWITTER) DATA ===
${inputs.xContent || '[Not provided]'}

=== INSTAGRAM DATA ===
${inputs.instagramContent || '[Not provided]'}
${instagramImages.length > 0 ? `\n${instagramImages.length} Instagram screenshot(s) provided for visual reference.` : ''}

=== YOUTUBE DATA ===
${inputs.hasYouTube ? (inputs.youtubeContent || '[User indicated they have YouTube but no content provided]') : '[Brand does not have a YouTube channel]'}
${inputs.youtubeContent?.includes('[API Data]') ? '\nNote: YouTube data above includes verified API data (subscriber count, video count, views, third-party coverage).' : ''}

=== REDDIT ANSWERS (AI Search Visibility) ===
${inputs.redditAnswersContent || '[Not checked - Reddit Answers shows how AI perceives brand reputation]'}

=== WIKIPEDIA & KNOWLEDGE GRAPH ===
${inputs.wikipediaContent || '[Not provided - please note if ' + project.brandName + ' has a Wikipedia page]'}
${inputs.wikipediaContent?.includes('[Knowledge Graph]') ? '\nNote: Knowledge Graph data above shows Google entity recognition status.' : ''}

=== GLASSDOOR (Employer Reputation) ===
${inputs.glassdoorContent || '[Not reviewed - Glassdoor reviews impact brand self-awareness and Reflective score]'}

=== WIPO TRADEMARK STATUS ===
${inputs.wipoContent || '[Not checked - Trademark registration impacts brand professionalism and Intentional score]'}

=== HASHTAG STRATEGY & EFFECTIVENESS ===
${inputs.hashtagContent || '[Not assessed - Check branded hashtag usage across platforms]'}

=== PAID MEDIA PRESENCE ===
${inputs.paidMediaContent || '[Not checked - Review Meta Ad Library, Google Ads Transparency, LinkedIn Ad Library for active campaigns]'}

${images.length > 0 ? `\n${images.length} screenshot(s) of social media pages have been provided for visual reference.` : ''}

${assessmentData.observations ? `\nASSESSOR OBSERVATIONS TO CONSIDER:\n${assessmentData.observations}` : ''}

Based on the content provided above, deliver a comprehensive social media and reputation assessment:

1. LinkedIn Presence: Analyze the About section messaging, post content quality, engagement rates (benchmark: 2-4% is good), thought leadership positioning, content mix, and employee advocacy signals

2. X/Twitter Presence: Evaluate voice/tone, content strategy, engagement levels, and brand consistency

3. Instagram Presence: Assess visual brand consistency, content themes, engagement, and audience connection

4. YouTube Presence: ${inputs.hasYouTube ? 'Assess channel content strategy, subscriber tier, video count, third-party coverage, and recommendations for improvement. If API data is provided, use the verified metrics.' : 'The brand does not have YouTube - provide recommendation on whether they should based on their industry and audience'}

5. Reddit Answers (AI Search): Analyze how Reddit's AI summarizes the brand. This indicates how AI search engines perceive brand reputation, credibility, and trust. This is a critical signal for COGENT scoring.

6. Wikipedia & Knowledge Graph: Does the brand have a Wikipedia page? Is it recognized as a Google Knowledge Graph entity? How does this impact their credibility and AI search visibility?

7. Glassdoor & Employer Reputation: Analyze employee reviews, ratings, and sentiment. How self-aware is the brand about its culture and reputation?

8. Trademark Protection (WIPO): Is the brand name properly protected? Are there any conflicts or risks?

9. Hashtag Strategy: Evaluate branded hashtag usage and effectiveness across platforms. Is there a clear hashtag strategy? Are customers adopting branded hashtags? How does this impact discoverability?

10. Paid Media Presence: Based on ad library findings, assess paid media investment signals. What creative themes dominate? Is messaging consistent with organic content? Does ad volume suggest serious market investment (COGENT, INTENTIONAL)? Is creative distinctive or generic (SENTIENT)?

11. Cross-Platform Consistency: Is the brand voice and messaging consistent across platforms?

12. AI/Search Visibility: How does their social presence impact discoverability in AI search engines? Consider YouTube third-party coverage, Knowledge Graph status, and Reddit Answers perception.

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

  // Accordion state
  const [expanded, setExpanded] = useState({ linkedin: true, x: false, instagram: false, other: false, hashtag: false, paidMedia: false, reputation: false });
  const toggleSection = (section) => setExpanded(prev => ({ ...prev, [section]: !prev[section] }));

  // Status badges for auto-check
  const autoCheckStatus = {
    youtube: !!inputs.youtubeContent?.includes('[API Data]') || !!inputs.youtubeContent?.includes('[Auto-searched]'),
    glassdoor: !!inputs.glassdoorContent?.includes('[Auto-searched]'),
  };
  const autoCheckCount = Object.values(autoCheckStatus).filter(Boolean).length;

  // Completion tracking
  const completionItems = [
    { label: 'Screenshots', done: images.length > 0 },
    { label: 'Health Check', done: !!socialHealthCheck },
    { label: 'LinkedIn', done: !!(inputs.linkedinAbout || inputs.linkedinPosts) },
    { label: 'X/Twitter', done: !!inputs.xContent },
    { label: 'WIPO', done: !!inputs.wipoContent },
    { label: 'Analysis', done: isComplete },
  ];

  // Required checks before proceeding
  const canProceed = isComplete && !!inputs.wipoContent && !!(inputs.linkedinAbout || inputs.linkedinPosts) && !!inputs.xContent && images.length > 0;
  const [proceedError, setProceedError] = useState(null);

  const handleProceed = () => {
    if (images.length === 0) {
      setProceedError('Please upload at least one screenshot of social media profiles before proceeding.');
      return;
    }
    if (!(inputs.linkedinAbout || inputs.linkedinPosts)) {
      setProceedError('Please add LinkedIn information before proceeding.');
      return;
    }
    if (!inputs.xContent) {
      setProceedError('Please add X/Twitter information before proceeding.');
      return;
    }
    if (!inputs.wipoContent) {
      setProceedError('Please check WIPO trademark registration before proceeding.');
      return;
    }
    if (!isComplete) {
      setProceedError('Please run the Social Media Analysis before proceeding.');
      return;
    }
    setProceedError(null);
    onNext();
  };

  // Accordion Header Component
  const AccordionHeader = ({ title, icon: Icon, isOpen, onClick, badge, hasContent }) => (
    <button 
      onClick={onClick}
      className={`w-full flex items-center justify-between p-4 rounded-lg transition-colors ${isOpen ? 'bg-[#F0EEEA]' : 'bg-white hover:bg-[#F8F7F5]'} border border-[#E8E6E1]`}
    >
      <div className="flex items-center gap-3">
        <Icon className="w-5 h-5 text-[#666666]" />
        <span className="font-medium text-[#1A1A1A]">{title}</span>
        {badge && <span className="text-xs px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full">{badge}</span>}
        {hasContent && <Check className="w-4 h-4 text-[#059669]" />}
      </div>
      <ChevronDown className={`w-5 h-5 text-[#666666] transition-transform ${isOpen ? 'rotate-180' : ''}`} />
    </button>
  );

  return (
    <div className="max-w-4xl mx-auto p-8 animate-fade-in">
      <div className="flex items-start gap-4 mb-6">
        <div className="w-12 h-12 bg-[#8B5CF6]/10 rounded-xl flex items-center justify-center">
          <Users className="w-6 h-6 text-[#8B5CF6]" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-[#1A1A1A]">Social Media Assessment</h2>
          <p className="text-sm text-[#666666]">{project.brandName}'s social presence</p>
        </div>
      </div>

      <CompletionIndicator items={completionItems} />

      {/* Social Media Health Check Section */}
      <div className="card p-4 mb-4 border-l-4 border-[#8B5CF6]">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-medium text-[#1A1A1A] flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#8B5CF6]" />
              Social Media Health Check
            </h3>
            <p className="text-xs text-[#666666]">AI-powered analysis: presence, engagement, reputation, sentiment, trust signals</p>
          </div>
          <button 
            onClick={runAutoCheck} 
            disabled={isAutoChecking}
            className="btn-primary text-sm py-2 px-4 flex items-center gap-2"
          >
            {isAutoChecking ? <><Loader2 className="w-4 h-4 animate-spin" /> Analyzing...</> : <><Bot className="w-4 h-4" /> Run Health Check</>}
          </button>
        </div>
        
        {socialHealthCheck && (
          <div className="mt-3 border-t border-[#E8E6E1] pt-3">
            <div className="flex items-center gap-2 mb-2">
              <Check className="w-4 h-4 text-[#059669]" />
              <span className="text-sm font-medium text-[#1A1A1A]">Health Check Complete</span>
            </div>
            <div className="bg-[#F0EEEA] rounded-lg p-4 max-h-80 overflow-y-auto">
              <pre className="text-sm text-[#333333] whitespace-pre-wrap font-sans">{socialHealthCheck}</pre>
            </div>
          </div>
        )}
      </div>

      {/* Screenshots - Matching Website Style */}
      <div className="card p-5 mb-4">
        <h3 className="text-sm font-medium text-[#1A1A1A] mb-2 flex items-center gap-2">
          <Image className="w-5 h-5" /> Social Media Screenshots (up to 4) <span className="text-red-500">*</span>
        </h3>
        <p className="text-sm text-[#666666] mb-4">Upload screenshots of key social profiles for visual analysis. Required to proceed.</p>
        
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

      {/* LinkedIn Section - Expanded by default */}
      <div className="mb-3">
        <AccordionHeader 
          title="LinkedIn" 
          icon={ExternalLink} 
          isOpen={expanded.linkedin} 
          onClick={() => toggleSection('linkedin')}
          hasContent={!!(inputs.linkedinAbout || inputs.linkedinPosts)}
        />
        {expanded.linkedin && (
          <div className="border border-t-0 border-[#E8E6E1] rounded-b-lg p-4 bg-white space-y-3">
            <div className="flex gap-2">
              <input type="url" value={inputs.linkedinUrl} onChange={(e) => updateInput('linkedinUrl', e.target.value)}
                placeholder="https://linkedin.com/company/..." className="flex-1 px-3 py-2 border border-[#D9D6D0] rounded-lg bg-white text-sm" />
              {inputs.linkedinUrl && (
                <a href={inputs.linkedinUrl} target="_blank" rel="noopener noreferrer" className="px-3 py-2 bg-[#0A66C2] text-white rounded-lg text-xs hover:bg-[#004182] flex items-center gap-1">
                  <ExternalLink className="w-3 h-3" /> Open
                </a>
              )}
            </div>
            <div>
              <label className="text-xs font-medium text-[#666666] mb-1 block">Follower Count</label>
              <input type="text" value={inputs.linkedinFollowers} onChange={(e) => updateInput('linkedinFollowers', e.target.value)}
                placeholder="e.g., 15,432 followers" className="w-full px-3 py-2 border border-[#D9D6D0] rounded-lg bg-white text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium text-[#666666] mb-1 block">Company Profile & About Section</label>
              <textarea value={inputs.linkedinAbout} onChange={(e) => updateInput('linkedinAbout', e.target.value)}
                placeholder="Paste the company description from the 'About' tab: overview, mission, employee count, specialties..." className="w-full h-20 px-3 py-2 border border-[#D9D6D0] rounded-lg bg-white resize-none text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium text-[#666666] mb-1 block">Recent Posts & Engagement</label>
              <textarea value={inputs.linkedinPosts} onChange={(e) => updateInput('linkedinPosts', e.target.value)}
                placeholder="Paste 5-10 recent posts with engagement: post text, likes, comments, reposts. Include any notable articles." className="w-full h-20 px-3 py-2 border border-[#D9D6D0] rounded-lg bg-white resize-none text-sm" />
            </div>
          </div>
        )}
      </div>

      {/* X/Twitter Section */}
      <div className="mb-3">
        <AccordionHeader 
          title="X (Twitter)" 
          icon={ExternalLink} 
          isOpen={expanded.x} 
          onClick={() => toggleSection('x')}
          hasContent={!!inputs.xContent}
        />
        {expanded.x && (
          <div className="border border-t-0 border-[#E8E6E1] rounded-b-lg p-4 bg-white space-y-3">
            <div className="flex gap-2">
              <input type="url" value={inputs.xUrl} onChange={(e) => updateInput('xUrl', e.target.value)}
                placeholder="https://x.com/..." className="flex-1 px-3 py-2 border border-[#D9D6D0] rounded-lg bg-white text-sm" />
              {inputs.xUrl && (
                <a href={inputs.xUrl} target="_blank" rel="noopener noreferrer" className="px-3 py-2 bg-[#1A1A1A] text-white rounded-lg text-xs hover:bg-[#333] flex items-center gap-1">
                  <ExternalLink className="w-3 h-3" /> Open
                </a>
              )}
            </div>
            <textarea value={inputs.xContent} onChange={(e) => updateInput('xContent', e.target.value)}
              placeholder="Bio, follower count, 5-10 recent tweets with engagement..." className="w-full h-24 px-3 py-2 border border-[#D9D6D0] rounded-lg bg-white resize-none text-sm" />
          </div>
        )}
      </div>

      {/* Instagram Section */}
      <div className="mb-3">
        <AccordionHeader 
          title="Instagram" 
          icon={Image} 
          isOpen={expanded.instagram} 
          onClick={() => toggleSection('instagram')}
          hasContent={!!inputs.instagramContent}
        />
        {expanded.instagram && (
          <div className="border border-t-0 border-[#E8E6E1] rounded-b-lg p-4 bg-white">
            <textarea value={inputs.instagramContent} onChange={(e) => updateInput('instagramContent', e.target.value)}
              placeholder="Bio, follower count, content themes (lifestyle, product, behind-scenes), posting frequency, engagement patterns, visual consistency..." className="w-full h-24 px-3 py-2 border border-[#D9D6D0] rounded-lg bg-white resize-none text-sm" />
          </div>
        )}
      </div>

      {/* Other Platforms (YouTube) */}
      <div className="mb-3">
        <AccordionHeader 
          title="Other Platforms" 
          icon={Globe} 
          isOpen={expanded.other} 
          onClick={() => toggleSection('other')}
          hasContent={!!inputs.youtubeContent}
        />
        {expanded.other && (
          <div className="border border-t-0 border-[#E8E6E1] rounded-b-lg p-4 bg-white space-y-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-medium text-[#666666]">YouTube</label>
                <div className="flex items-center gap-2">
                  {autoCheckStatus.youtube && <span className="text-[10px] text-[#059669]">Auto-searched ✓</span>}
                  <a href={`https://www.youtube.com/results?search_query=${encodeURIComponent(project.brandName)}`} target="_blank" rel="noopener noreferrer" 
                     className="px-2 py-0.5 bg-red-100 text-red-700 text-[10px] font-medium rounded hover:bg-red-200 transition-colors flex items-center gap-1">
                    Verify <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                </div>
              </div>
              <textarea value={inputs.youtubeContent} onChange={(e) => updateInput('youtubeContent', e.target.value)}
                placeholder="Channel exists? Content themes, posting frequency, engagement quality... (verify metrics at YouTube)" className="w-full h-16 px-3 py-2 border border-[#D9D6D0] rounded-lg bg-white resize-none text-sm" />
            </div>
          </div>
        )}
      </div>

      {/* Reputation Section (Glassdoor, WIPO) */}
      <div className="mb-4">
        <AccordionHeader 
          title="Reputation & Trust Signals" 
          icon={Shield} 
          isOpen={expanded.reputation} 
          onClick={() => toggleSection('reputation')}
          badge="Score Impact"
          hasContent={!!(inputs.glassdoorContent || inputs.wipoContent)}
        />
        {expanded.reputation && (
          <div className="border border-t-0 border-[#E8E6E1] rounded-b-lg p-4 bg-white space-y-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-medium text-[#666666]">Glassdoor <span className="text-purple-600">(→ Reflective)</span></label>
                <div className="flex items-center gap-2">
                  {autoCheckStatus.glassdoor && <span className="text-[10px] text-[#059669]">Auto-searched ✓</span>}
                  <a href="https://www.glassdoor.com/Search/results.htm" target="_blank" rel="noopener noreferrer" 
                     className="px-2 py-0.5 bg-purple-100 text-purple-700 text-[10px] font-medium rounded hover:bg-purple-200 transition-colors flex items-center gap-1">
                    Verify <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                </div>
              </div>
              <textarea value={inputs.glassdoorContent} onChange={(e) => updateInput('glassdoorContent', e.target.value)}
                placeholder="Rating (out of 5), CEO approval %, # of reviews, culture themes, pros/cons patterns..." className="w-full h-16 px-3 py-2 border border-[#D9D6D0] rounded-lg bg-white resize-none text-sm" />
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-medium text-blue-800">WIPO Trademark <span className="font-normal">(→ Intentional)</span></label>
                <div className="flex gap-2">
                  <button
                    onClick={runWipoSearch}
                    disabled={isSearchingWipo || !project.brandName}
                    className="px-3 py-1 bg-[#8B5CF6] text-white text-xs font-medium rounded-lg hover:bg-[#7C3AED] transition-colors flex items-center gap-1 disabled:opacity-50"
                  >
                    {isSearchingWipo ? <><Loader2 className="w-3 h-3 animate-spin" /> Searching...</> : <><Sparkles className="w-3 h-3" /> Auto-Search</>}
                  </button>
                  <a href="https://branddb.wipo.int/en/similarname" target="_blank" rel="noopener noreferrer" 
                     className="px-3 py-1 bg-[#0067B9] text-white text-xs font-medium rounded-lg hover:bg-[#005299] transition-colors flex items-center gap-1">
                    Manual <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
              {inputs.wipoContent?.includes('[Auto-searched]') && (
                <p className="text-xs text-green-600 mb-2">✓ Trademark data auto-searched</p>
              )}
              <textarea value={inputs.wipoContent} onChange={(e) => updateInput('wipoContent', e.target.value)}
                placeholder={`Trademark status for ${project.brandName}: registrations found, jurisdictions covered, any similar/conflicting marks, protection status...`}
                className={`w-full h-20 px-3 py-2 border border-blue-300 rounded-lg bg-white resize-none text-sm ${inputs.wipoContent ? 'bg-blue-50' : ''}`} />
            </div>
          </div>
        )}
      </div>

      {/* Hashtag Effectiveness Check */}
      <div className="mb-3">
        <AccordionHeader 
          title="Hashtag Effectiveness" 
          icon={Hash} 
          isOpen={expanded.hashtag} 
          onClick={() => toggleSection('hashtag')}
          hasContent={!!inputs.hashtagContent}
        />
        {expanded.hashtag && (
          <div className="border border-t-0 border-[#E8E6E1] rounded-b-lg p-4 bg-white space-y-3">
            <p className="text-xs text-[#666666] mb-2">
              Check how effectively the brand uses hashtags across platforms to increase discoverability and engagement.
            </p>
            <div className="grid grid-cols-2 gap-2 mb-3">
              <a href={`https://www.instagram.com/explore/tags/${project.brandName?.toLowerCase().replace(/\s+/g, '')}/`} target="_blank" rel="noopener noreferrer" 
                 className="px-2 py-1.5 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xs font-medium rounded-lg hover:opacity-90 transition-opacity flex items-center justify-center gap-1">
                <span>Instagram #</span> <ExternalLink className="w-3 h-3" />
              </a>
              <a href={`https://www.tiktok.com/tag/${project.brandName?.toLowerCase().replace(/\s+/g, '')}`} target="_blank" rel="noopener noreferrer" 
                 className="px-2 py-1.5 bg-black text-white text-xs font-medium rounded-lg hover:bg-gray-800 transition-colors flex items-center justify-center gap-1">
                <span>TikTok #</span> <ExternalLink className="w-3 h-3" />
              </a>
              <a href={`https://www.linkedin.com/search/results/content/?keywords=%23${project.brandName?.toLowerCase().replace(/\s+/g, '')}`} target="_blank" rel="noopener noreferrer" 
                 className="px-2 py-1.5 bg-[#0A66C2] text-white text-xs font-medium rounded-lg hover:bg-[#004182] transition-colors flex items-center justify-center gap-1">
                <span>LinkedIn #</span> <ExternalLink className="w-3 h-3" />
              </a>
              <a href={`https://twitter.com/search?q=%23${project.brandName?.toLowerCase().replace(/\s+/g, '')}&src=typed_query`} target="_blank" rel="noopener noreferrer" 
                 className="px-2 py-1.5 bg-[#1A1A1A] text-white text-xs font-medium rounded-lg hover:bg-[#333] transition-colors flex items-center justify-center gap-1">
                <span>X/Twitter #</span> <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <textarea value={inputs.hashtagContent} onChange={(e) => updateInput('hashtagContent', e.target.value)}
              placeholder={`Document hashtag usage and effectiveness:

• Branded hashtag: Do they have one? (#${project.brandName?.replace(/\s+/g, '') || 'BrandName'})
• Usage volume: How many posts use their branded hashtag on each platform?
• Campaign hashtags: Any specific campaign or product hashtags?
• Industry hashtags: Are they using relevant industry hashtags effectively?
• User adoption: Are customers/followers using the branded hashtag?
• Consistency: Same hashtag strategy across all platforms?
• N/A if no hashtag strategy observed...`} 
              className="w-full h-32 px-3 py-2 border border-[#D9D6D0] rounded-lg bg-white resize-none text-sm" />
          </div>
        )}
      </div>

      {/* Paid Media Presence */}
      <div className="mb-4">
        <AccordionHeader 
          title="Paid Media Presence" 
          icon={Target} 
          isOpen={expanded.paidMedia} 
          onClick={() => toggleSection('paidMedia')}
          hasContent={!!inputs.paidMediaContent}
        />
        {expanded.paidMedia && (
          <div className="border border-t-0 border-[#E8E6E1] rounded-b-lg p-4 bg-white space-y-3">
            <p className="text-xs text-[#666666] mb-2">
              {project.businessModel === 'b2b'
                ? 'For B2B, LinkedIn Ads and Google Search are typically most important. Check Meta and TikTok for awareness campaigns if relevant.'
                : project.businessModel === 'b2c'
                ? 'Check all consumer platforms - Meta (FB/IG), TikTok, Google, and YouTube are typically high priority.'
                : 'Check both B2B channels (LinkedIn, Google Search) and consumer channels (Meta, TikTok) for hybrid brands.'}
            </p>
            <div className="grid grid-cols-2 gap-2 mb-3">
              <a href={`https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=ALL&q="${encodeURIComponent(project.brandName)}"&search_type=keyword_exact_phrase`} target="_blank" rel="noopener noreferrer" 
                 className="px-2 py-1.5 bg-[#1877F2] text-white text-xs font-medium rounded-lg hover:bg-[#166FE5] transition-colors flex items-center justify-center gap-1">
                <span>Meta Ad Library</span> <ExternalLink className="w-3 h-3" />
              </a>
              <a href={`https://adstransparency.google.com/?region=anywhere&text="${encodeURIComponent(project.brandName)}"`} target="_blank" rel="noopener noreferrer" 
                 className="px-2 py-1.5 bg-[#4285F4] text-white text-xs font-medium rounded-lg hover:bg-[#3367D6] transition-colors flex items-center justify-center gap-1">
                <span>Google Ads</span> <ExternalLink className="w-3 h-3" />
              </a>
              <a href={`https://www.linkedin.com/ad-library/search?accountOwner="${encodeURIComponent(project.brandName)}"`} target="_blank" rel="noopener noreferrer" 
                 className={`px-2 py-1.5 text-white text-xs font-medium rounded-lg transition-colors flex items-center justify-center gap-1 ${project.businessModel === 'b2b' ? 'bg-[#0A66C2] hover:bg-[#004182] ring-2 ring-[#0A66C2] ring-offset-1' : 'bg-[#0A66C2] hover:bg-[#004182]'}`}>
                <span>LinkedIn Ads{project.businessModel === 'b2b' ? ' ★' : ''}</span> <ExternalLink className="w-3 h-3" />
              </a>
              <a href={`https://library.tiktok.com/ads?region=all&adv_name="${encodeURIComponent(project.brandName)}"`} target="_blank" rel="noopener noreferrer" 
                 className={`px-2 py-1.5 text-white text-xs font-medium rounded-lg transition-colors flex items-center justify-center gap-1 ${project.businessModel === 'b2b' ? 'bg-gray-400 hover:bg-gray-500' : project.businessModel === 'b2c' ? 'bg-black hover:bg-gray-800 ring-2 ring-black ring-offset-1' : 'bg-black hover:bg-gray-800'}`}>
                <span>TikTok Ads{project.businessModel === 'b2b' ? ' (optional)' : project.businessModel === 'b2c' ? ' ★' : ''}</span> <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <textarea value={inputs.paidMediaContent} onChange={(e) => updateInput('paidMediaContent', e.target.value)}
              placeholder={project.businessModel === 'b2b'
                ? `Document paid media presence from ad libraries:

• LinkedIn (PRIORITY): Sponsored content? InMail campaigns? Lead gen ads?
• Google Ads: Search ads for key terms? Display/remarketing?
• Meta (FB/IG): Brand awareness campaigns? Retargeting?
• Trade publication sponsorships or programmatic placements?
• Conference/webinar sponsorships advertised?
• Messaging: What pain points or solutions are they promoting?
• N/A if no paid media found...`
                : `Document paid media presence from ad libraries:

• Meta (FB/IG): Active ads? How many? Creative themes? Target signals?
• TikTok: Video ads? Spark ads? Creative quality?
• Google Ads: Search/display/YouTube ads running? Volume?
• Creative quality: Distinctive or generic? Consistent with brand?
• Messaging: What value props are they paying to promote?
• Sponsorships: Podcast, event, or sports sponsorships visible?
• N/A if no paid media found...`} 
              className="w-full h-32 px-3 py-2 border border-[#D9D6D0] rounded-lg bg-white resize-none text-sm" />
          </div>
        )}
      </div>

      {/* Observations - Simplified */}
      <div className="card p-4 mb-4">
        <h3 className="text-sm font-medium text-[#1A1A1A] mb-2">Assessor Notes</h3>
        <textarea value={assessmentData.observations || ''} onChange={(e) => setAssessmentData({ ...assessmentData, observations: e.target.value })}
          placeholder="Your observations about their social presence..." className="w-full h-16 px-3 py-2 border border-[#D9D6D0] rounded-lg bg-white resize-none text-sm" />
      </div>

      {/* Analysis Button & Results */}
      {!isComplete && (
        <button onClick={runAnalysis} disabled={isProcessing || !hasMinimumContent} className="btn-primary flex items-center gap-2 mb-4">
          {isProcessing ? <><Loader2 className="w-4 h-4 animate-spin" /> Analyzing...</> : <><Play className="w-4 h-4" /> Run Social Analysis</>}
        </button>
      )}

      {error && <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 text-red-700 text-sm">{error}</div>}

      {isComplete && (
        <div className="card p-5 mb-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-[#1A1A1A] flex items-center gap-2">
              <Check className="w-5 h-5 text-[#8B5CF6]" /> Analysis Complete
            </h3>
            <button 
              onClick={() => { runAnalysis(); if (onClearScores) onClearScores(); }} 
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

      {proceedError && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4 text-amber-800 text-sm flex items-center gap-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          {proceedError}
        </div>
      )}

      <div className="flex items-center justify-between pt-4 border-t border-[#D9D6D0]">
        <button onClick={onPrev} className="btn-secondary flex items-center gap-2"><ArrowLeft className="w-4 h-4" /> Back</button>
        <button onClick={handleProceed} disabled={!canProceed} className="btn-primary flex items-center gap-2">Continue <ArrowRight className="w-4 h-4" /></button>
      </div>
    </div>
  );
}

// AI Reputation Page
function AIReputationPage({ assessmentData, setAssessmentData, apiKey, project, onPrev, onNext, onClearScores }) {
  const [manualInput, setManualInput] = useState({
    claude: assessmentData.claudeManual || '',
    gemini: assessmentData.geminiManual || '',
    chatgpt: assessmentData.chatgptManual || '',
    perplexity: assessmentData.perplexityManual || '',
    copilot: assessmentData.copilotManual || '',
  });
  const [isProcessing, setIsProcessing] = useState({});
  const [error, setError] = useState(null);
  const [reputationFlags, setReputationFlags] = useState(assessmentData.reputationFlags || '');
  const [wikipediaContent, setWikipediaContent] = useState(assessmentData.wikipediaContent || '');
  const [redditContent, setRedditContent] = useState(assessmentData.redditAnswersContent || '');

  const industryName = INDUSTRIES.find(i => i.id === project.industry)?.name || 'their industry';

  // Helper: copy text to clipboard
  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta); ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
  };

  // Comprehensive AI Brand Perception Prompt
  const aiPerceptionPrompt = `You are simulating what a potential customer, partner, or investor would discover when researching a brand online. Please search for and gather current information about this brand to provide a comprehensive assessment.

The brand is ${project.brandName}, operating in the ${industryName} sector.

Research this brand thoroughly and answer each section below based on what you find. If information on any point is limited or unavailable online, say so directly — identifying gaps in a brand's digital presence is valuable insight.

1. Brand Understanding
What does this brand do? Describe its core offering, the problem it solves, and the market it operates in. How clearly does the brand communicate what it actually is?

2. Purpose & Mission
What does this brand exist to do beyond its commercial function? Is there a stated or clearly implied mission, cause, or reason for being that goes beyond making money? What purpose statements or values content can you find?

3. How They Work
What can you discover about how this brand operates — its model, method, approach, or process? This might include how it delivers its product or service, how it goes to market, how it treats clients or customers, or what makes its way of working distinctive.

4. Personality & Voice
Based on their website, social media, content, and any coverage you find, how would you characterise this brand's personality? How does it express itself — its tone, style, and manner of engagement? Be specific about what sources informed this impression.

5. Values
What values does this brand appear to hold or actively promote? Are these values demonstrated through observable actions and decisions, or do they appear to exist primarily as stated claims? Where you find evidence of values in action, describe it.

6. Reputation
What is this brand's reputation based on what you can find online? Consider reviews, testimonials, press coverage, social media sentiment, employee reviews (Glassdoor), and industry commentary. Is the reputation broadly consistent, or are there tensions or contradictions? Report what you find — positive, negative, or mixed.

7. Authenticity
Based on everything you've found, does this brand come across as authentic — meaning that its stated identity, values, and purpose appear to be consistent with how it actually behaves and is perceived externally? Where you see alignment, describe it. Where you see gaps between claim and reality, name them plainly.

8. Credibility
How credible is this brand in its field? Is it regarded as knowledgeable, trustworthy, and authoritative? Look for credibility signals — awards, certifications, client logos, case studies, thought leadership, media coverage, peer recognition, track record — and describe what you find.

9. Digital Presence & Findability
How easy was it to find information about this brand? Is their digital footprint strong or weak? Are they present across multiple channels (website, LinkedIn, news, reviews) or hard to research? This reflects what a prospect would experience when doing due diligence.

Conclude with a Summary Brand Impression — a candid 3–4 sentence synthesis of how this brand appears to someone researching them online: what they stand for, how they are regarded, and any gaps or concerns a prospect might notice. Then provide an AI Discoverability Score from 1–10 reflecting how well-represented and clearly understood this brand is in online search, with a brief rationale for the score.`;

  const redditPrompt = `What do people on Reddit actually think of ${project.brandName}? I want honest community perception, not their marketing. Specifically: What do they do? Are they credible — do actions match messaging? What's their reputation and reach across Reddit communities? Are their values seen as genuine or performative? And what's the perception of their environmental and social impact — positive, negative, or indifferent?`;

  // AI engines config
  const engines = [
    { key: 'claude',      name: 'Claude',             brand: 'Anthropic',       url: 'https://claude.ai/new',          color: '#8B5CF6', hover: '#7C3AED' },
    { key: 'chatgpt',     name: 'ChatGPT',            brand: 'OpenAI',          url: 'https://chatgpt.com/',           color: '#10A37F', hover: '#0D8A6A' },
    { key: 'gemini',      name: 'Gemini',             brand: 'Google',          url: 'https://gemini.google.com/app',  color: '#4285F4', hover: '#3367D6' },
    { key: 'perplexity',  name: 'Perplexity',         brand: 'Perplexity AI',   url: 'https://www.perplexity.ai/',     color: '#20B2AA', hover: '#178C84' },
    { key: 'copilot',     name: 'Copilot',            brand: 'Microsoft',       url: 'https://copilot.microsoft.com/', color: '#0078D4', hover: '#005A9E' },
  ];

  const filledCount = engines.filter(e => !!manualInput[e.key]).length;
  const canSynthesize = filledCount >= 3;
  const isComplete = assessmentData.status === 'complete';

  const generateSynthesis = async () => {
    setIsProcessing(p => ({ ...p, synthesis: true }));
    setError(null);
    try {
      const engineSections = engines
        .filter(e => manualInput[e.key])
        .map(e => `${e.name.toUpperCase()}: ${manualInput[e.key]}`)
        .join('\n\n');

      const prompt = `Analyze these AI system responses about ${project.brandName}:

${engineSections}

${reputationFlags ? `REPUTATION FLAGS IDENTIFIED:\n${reputationFlags}\n` : ''}
${wikipediaContent ? `WIKIPEDIA PRESENCE:\n${wikipediaContent}\n` : ''}
${redditContent ? `REDDIT COMMUNITY PERCEPTION:\n${redditContent}\n` : ''}
${assessmentData.observations ? `ASSESSOR OBSERVATIONS:\n${assessmentData.observations}` : ''}

Provide a comprehensive AI reputation assessment:
1. Convergence — Where do the AI systems agree? (likely accurate signals)
2. Divergence — Where do they differ, and what might explain it?
3. Sentiment — Overall tone and brand framing across systems
4. Gaps — What can't any AI answer about this brand? What's absent?
5. Recommendations — Specific steps to improve AI representation and discoverability

Write in flowing prose.`;

      const result = await callClaude(prompt, apiKey);
      setAssessmentData({
        ...assessmentData,
        status: 'complete',
        content: result,
        claudeManual: manualInput.claude,
        geminiManual: manualInput.gemini,
        chatgptManual: manualInput.chatgpt,
        perplexityManual: manualInput.perplexity,
        copilotManual: manualInput.copilot,
        reputationFlags,
        wikipediaContent,
        redditAnswersContent: redditContent,
      });
    } catch (e) { setError(e.message); }
    finally { setIsProcessing(p => ({ ...p, synthesis: false })); }
  };

  const completionItems = [
    ...engines.map(e => ({ label: e.name, done: !!manualInput[e.key] })),
    { label: 'Wikipedia', done: !!wikipediaContent },
    { label: 'Reddit', done: !!redditContent },
    { label: 'Synthesis', done: isComplete },
  ];

  const canProceed = isComplete && canSynthesize;
  const [proceedError, setProceedError] = useState(null);

  const handleProceed = () => {
    if (filledCount < 3) {
      setProceedError('Please run the prompt in at least 3 AI engines before proceeding.');
      return;
    }
    if (!isComplete) {
      setProceedError('Please generate the AI Reputation Synthesis before proceeding.');
      return;
    }
    setProceedError(null);
    onNext();
  };

  return (
    <div className="max-w-4xl mx-auto p-8 animate-fade-in">
      <div className="flex items-start gap-4 mb-6">
        <div className="w-12 h-12 bg-[#3B82F6]/10 rounded-xl flex items-center justify-center">
          <Bot className="w-6 h-6 text-[#3B82F6]" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-[#1A1A1A]">AI Reputation Assessment</h2>
          <p className="text-sm text-[#666666]">What prospects discover when researching {project.brandName}</p>
        </div>
      </div>

      <CompletionIndicator items={completionItems} />

      {/* Reputation Triggers */}
      <div className="card p-4 mb-4 border-l-4 border-[#F59E0B]">
        <div className="flex items-start gap-3 mb-3">
          <AlertCircle className="w-4 h-4 text-[#F59E0B] mt-0.5 flex-shrink-0" />
          <div>
            <h3 className="text-sm font-medium text-[#1A1A1A] mb-0.5">Reputation Triggers — check before running AI queries</h3>
            <p className="text-xs text-[#666666]">Search for anything charged in the brand's public record that AI models may surface. Note flags here so you can account for them when reading AI responses.</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 mb-3">
          {[
            { label: 'Google News', url: `https://news.google.com/search?q=${encodeURIComponent(project.brandName)}` },
            { label: 'Google Search', url: `https://www.google.com/search?q=${encodeURIComponent('"' + project.brandName + '" controversy OR lawsuit OR scandal OR criticism')}` },
            { label: 'Trustpilot', url: `https://www.trustpilot.com/search?query=${encodeURIComponent(project.brandName)}` },
          ].map(link => (
            <a key={link.label} href={link.url} target="_blank" rel="noopener noreferrer"
               className="px-3 py-1.5 bg-[#FEF3C7] text-[#92400E] text-xs font-medium rounded-lg hover:bg-[#FDE68A] transition-colors flex items-center gap-1">
              {link.label} <ExternalLink className="w-3 h-3" />
            </a>
          ))}
        </div>
        <textarea
          value={reputationFlags}
          onChange={(e) => { setReputationFlags(e.target.value); setAssessmentData({ ...assessmentData, reputationFlags: e.target.value }); }}
          placeholder={`Note any legal issues, negative press, social controversies, or leadership concerns found for ${project.brandName}. These become context when interpreting AI responses.`}
          className="w-full h-16 px-3 py-2 border border-[#FDE68A] rounded-lg bg-[#FFFBEB] resize-none text-sm"
        />
      </div>

      {/* AI Brand Perception Prompt */}
      <div className="card p-4 mb-4 border-l-4 border-[#3B82F6]">
        <div className="flex items-start justify-between mb-2">
          <div>
            <h3 className="text-sm font-medium text-[#1A1A1A] mb-0.5">AI Brand Research Prompt</h3>
            <p className="text-xs text-[#666666]">Copy this prompt and run it in each AI engine below. Paste each response back.</p>
          </div>
        </div>
        <div className="bg-[#F8F7F5] rounded-lg p-3 max-h-32 overflow-y-auto mb-2">
          <pre className="text-xs text-[#333333] whitespace-pre-wrap font-sans leading-relaxed">{aiPerceptionPrompt.substring(0, 400)}...</pre>
        </div>
        <p className="text-xs text-[#999999]">Customised for <strong>{project.brandName}</strong> · {industryName}</p>
      </div>

      {error && <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 text-red-700 text-sm">{error}</div>}

      {/* AI Engine Cards — uniform pattern */}
      <div className="space-y-3 mb-4">
        {engines.map(engine => (
          <div key={engine.key} className={`card p-4 ${manualInput[engine.key] ? 'bg-[#F0EEEA]' : ''}`}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${manualInput[engine.key] ? 'bg-[#E53935] text-white' : 'bg-[#F0EEEA]'}`}>
                  {manualInput[engine.key] ? <Check className="w-5 h-5" /> : <Bot className="w-5 h-5 text-gray-400" />}
                </div>
                <div>
                  <h4 className="font-medium">{engine.name}</h4>
                  <p className="text-sm text-[#666666]">{engine.brand}</p>
                </div>
              </div>
              <a
                href={engine.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => copyToClipboard(aiPerceptionPrompt)}
                className="px-3 py-1.5 text-white text-xs font-medium rounded-lg transition-colors flex items-center gap-1"
                style={{ backgroundColor: engine.color }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = engine.hover}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = engine.color}
              >
                <Copy className="w-3 h-3" /> Copy & Open {engine.name} <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <textarea
              value={manualInput[engine.key]}
              onChange={(e) => {
                const val = e.target.value;
                setManualInput(m => ({ ...m, [engine.key]: val }));
                setAssessmentData({ ...assessmentData, [`${engine.key}Manual`]: val });
              }}
              placeholder={`Paste ${engine.name}'s response here...`}
              className={`w-full h-24 px-3 py-2 border border-[#D9D6D0] rounded-lg text-sm ${manualInput[engine.key] ? 'bg-[#F0EEEA]' : 'bg-white'}`}
            />
          </div>
        ))}
      </div>

      {/* AI Training Sources */}
      <div className="card p-4 mb-4 border-l-4 border-[#6366F1]">
        <h3 className="text-sm font-medium text-[#1A1A1A] mb-1">AI Training Sources</h3>
        <p className="text-xs text-[#666666] mb-3">Wikipedia and Reddit shape how AI models understand and describe a brand. Check both and record what you find.</p>
        <div className="space-y-3">
          {/* Wikipedia */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-[#666666]">Wikipedia</label>
              <a href={`https://en.wikipedia.org/wiki/Special:Search?search=${encodeURIComponent(project.brandName)}`} target="_blank" rel="noopener noreferrer"
                 className="px-2 py-0.5 bg-gray-100 text-gray-700 text-[10px] font-medium rounded hover:bg-gray-200 transition-colors flex items-center gap-1">
                Search Wikipedia <ExternalLink className="w-2.5 h-2.5" />
              </a>
            </div>
            <textarea
              value={wikipediaContent}
              onChange={(e) => { setWikipediaContent(e.target.value); setAssessmentData({ ...assessmentData, wikipediaContent: e.target.value }); }}
              placeholder={`Does ${project.brandName} have a Wikipedia page? Record what it says — or note its absence.`}
              className="w-full h-16 px-3 py-2 border border-[#D9D6D0] rounded-lg bg-white resize-none text-sm"
            />
          </div>
          {/* Reddit Answers */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-orange-800">Reddit Answers <span className="text-[#666666] font-normal">(AI search visibility)</span></label>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => copyToClipboard(redditPrompt)}
                  className="px-2 py-0.5 bg-orange-100 text-orange-700 text-[10px] font-medium rounded hover:bg-orange-200 transition-colors flex items-center gap-1"
                >
                  <Copy className="w-2.5 h-2.5" /> Copy prompt
                </button>
                <a href="https://www.reddit.com/answers/" target="_blank" rel="noopener noreferrer"
                   className="px-2 py-0.5 bg-[#FF4500] text-white text-[10px] font-medium rounded hover:bg-[#E03D00] transition-colors flex items-center gap-1">
                  Open Reddit Answers <ExternalLink className="w-2.5 h-2.5" />
                </a>
              </div>
            </div>
            <textarea
              value={redditContent}
              onChange={(e) => { setRedditContent(e.target.value); setAssessmentData({ ...assessmentData, redditAnswersContent: e.target.value }); }}
              placeholder={`Paste Reddit Answers response about ${project.brandName}'s reputation and community perception...`}
              className="w-full h-24 px-3 py-2 border border-orange-200 rounded-lg bg-orange-50 resize-none text-sm"
            />
          </div>
        </div>
      </div>

      {/* Assessor Observations */}
      <div className="card p-5 mb-4">
        <h3 className="text-sm font-medium text-[#1A1A1A] mb-2">Assessor Observations</h3>
        <p className="text-sm text-[#666666] mb-3">Your observations will be included in the synthesis.</p>
        <textarea value={assessmentData.observations || ''} onChange={(e) => setAssessmentData({ ...assessmentData, observations: e.target.value })}
          placeholder="Note discrepancies between engines, anything surprising, or gaps you observed..." className="w-full h-20 px-3 py-2 border border-[#D9D6D0] rounded-lg bg-white resize-none" />
      </div>

      {canSynthesize && !isComplete && (
        <button onClick={generateSynthesis} disabled={isProcessing.synthesis} className="btn-primary flex items-center gap-2 mb-6">
          {isProcessing.synthesis ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating...</> : <><Play className="w-4 h-4" /> Generate Synthesis ({filledCount} engines)</>}
        </button>
      )}

      {isComplete && (
        <div className="card p-5 mb-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-[#1A1A1A] flex items-center gap-2">
              <Check className="w-5 h-5 text-[#3B82F6]" /> Synthesis Complete
            </h3>
            <button
              onClick={() => { generateSynthesis(); if (onClearScores) onClearScores(); }}
              disabled={isProcessing.synthesis}
              className="btn-secondary text-sm py-2 px-4 flex items-center gap-2"
            >
              {isProcessing.synthesis ? <><Loader2 className="w-4 h-4 animate-spin" /> Regenerating...</> : <><Play className="w-4 h-4" /> Regenerate Analysis</>}
            </button>
          </div>
          <div className="bg-[#F0EEEA] rounded-lg p-4 max-h-64 overflow-y-auto text-sm text-[#333333]">{assessmentData.content}</div>
        </div>
      )}

      {proceedError && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4 text-amber-800 text-sm flex items-center gap-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          {proceedError}
        </div>
      )}

      <div className="flex items-center justify-between pt-6 border-t border-[#D9D6D0]">
        <button onClick={onPrev} className="btn-secondary flex items-center gap-2"><ArrowLeft className="w-4 h-4" /> Back</button>
        <button onClick={handleProceed} disabled={!canProceed} className="btn-primary flex items-center gap-2">Continue <ArrowRight className="w-4 h-4" /></button>
      </div>
    </div>
  );
}


// Earned Media Assessment with paste field
function EarnedMediaAssessment({ assessmentData, setAssessmentData, apiKey, project, onPrev, onNext, onClearScores }) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [isAutoAssessing, setIsAutoAssessing] = useState(false);
  const [error, setError] = useState(null);
  const [coveragePaste, setCoveragePaste] = useState(assessmentData.coveragePaste || '');

  const industryName = INDUSTRIES.find(i => i.id === project.industry)?.name || 'their industry';

  // Auto-assess earned media performance
  const runAutoAssess = async () => {
    setIsAutoAssessing(true);
    setError(null);
    try {
      const prompt = `You are a senior brand intelligence analyst specializing in earned media evaluation. Your task is to conduct a comprehensive earned media performance assessment for ${project.brandName}, operating in the ${industryName} sector.

Using any available information about this brand's media presence, including news articles, press mentions, analyst commentary, podcast appearances, awards, influencer coverage, and third-party reviews, evaluate performance across the following dimensions:

1. Coverage Quality
Assess the caliber and credibility of outlets and sources covering the brand. Are mentions appearing in authoritative, respected publications or primarily low-tier aggregators? Is coverage substantive (featured stories, interviews, deep analysis) or superficial (brief mentions, press release reposts)?

2. Reach & Amplification
Estimate the breadth and scale of earned media exposure. Which channels are generating the most coverage: digital news, print, broadcast, podcasts, social amplification of press? Is coverage geographically and demographically reaching the markets that matter for this brand?

3. Sentiment Analysis
Characterize the overall tone of coverage as positive, neutral, or negative. Identify recurring positive themes and any persistent negative narratives or reputational risks surfacing in third-party coverage.

4. Share of Voice
Compare the brand's earned media presence against its primary competitors. Is the brand driving the conversation in its category, keeping pace, or being outpaced? Where does the brand appear to be winning or losing mindshare?

5. Message Consistency
Evaluate whether earned media coverage accurately and consistently reflects the brand's intended positioning, values, and key messages. Are journalists, analysts, and influencers echoing the brand's narrative, or is a different story taking hold externally?

6. Industry Influence & Thought Leadership
Assess the degree to which the brand is shaping broader industry conversation. Is the brand cited as a reference point, a category innovator, or a thought leader? Are executives, spokespeople, or brand content being quoted, referenced, or credited in industry discourse?

7. Audience Relevance
Based on your knowledge of the brand's likely customer base and market positioning, evaluate how well earned media coverage is reaching and resonating with the audiences that matter most. Are the outlets, creators, and voices generating coverage trusted and consumed by the right people? Is coverage appearing in the channels where those audiences are most active?

For each dimension, provide: a qualitative assessment, a performance score from 1 to 10 with rationale, specific examples or evidence where possible, and 1 to 2 actionable recommendations to improve performance.

8. Brand Consciousness Attribute Mapping
Based on your earned media observations, provide specific evidence relevant to each of these 8 brand consciousness attributes:

AWAKE (Narrative Leadership): Is the brand shaping industry discourse or just participating? Are they cited as thought leaders? Do competitors respond to their positions? Are they keynoting major events?

AWARE (Audience Understanding): Does coverage indicate the brand understands its audiences? Are they building trust systematically? Is there evidence of community engagement or customer advocacy in media?

REFLECTIVE (Brand Authenticity): Does external coverage align with brand claims? Are there authenticity signals (employee advocacy, leadership visibility) or red flags (disconnect between claims and reality)?

ATTENTIVE (Experience Excellence): Does coverage mention quality, consistency, or attention to detail? Are there complaints about experience or praise for excellence?

COGENT (Strategic Intelligence): Is there evidence of data-driven approaches in coverage? Are they cited for research, insights, or strategic thinking?

SENTIENT (Emotional Connection): Does coverage indicate emotional resonance with audiences? Are there passionate advocates or community enthusiasm visible in media?

VISIONARY (Meaningful Purpose): Does coverage reference purpose, mission, or meaningful impact beyond profit? Are they associated with positive change or societal benefit?

INTENTIONAL (Substance & Confidence): Does the brand show up with authority in coverage? Are executives visible and quotable? Is positioning clear and confident?

Tone instruction: Be direct and critical where the evidence warrants it. Do not soften assessments out of diplomacy. If coverage is thin, sentiment is problematic, or the brand is losing share of voice to competitors, say so clearly and explain why it matters. Honest diagnosis is more valuable than a favorable framing.

Conclude with an Overall Earned Media Health Score (1 to 10), a 2 to 3 sentence executive summary of the brand's earned media standing, and the single most important strategic priority for earned media improvement in the next 90 days.`;

      const result = await callClaude(prompt, apiKey);
      setAssessmentData({ ...assessmentData, autoAssessContent: result });
    } catch (err) {
      setError(err.message);
    } finally {
      setIsAutoAssessing(false);
    }
  };

  const runAnalysis = async () => {
    setIsProcessing(true);
    setError(null);
    try {
      const prompt = `Analyze earned media coverage for ${project.brandName}.

USER-PROVIDED COVERAGE (last 3 months):
${coveragePaste || 'No coverage provided by user'}

${assessmentData.observations ? `ASSESSOR OBSERVATIONS TO CONSIDER:\n${assessmentData.observations}` : ''}

${assessmentData.autoAssessContent ? `AUTO-ASSESS EARNED MEDIA ANALYSIS (previously generated - integrate these findings):\n${assessmentData.autoAssessContent}\n` : ''}

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

  // Completion tracking
  const completionItems = [
    { label: 'Auto-Assess', done: !!assessmentData.autoAssessContent },
    { label: 'Coverage Added', done: !!coveragePaste },
    { label: 'Analysis', done: isComplete },
  ];

  // Required checks before proceeding - ALL items mandatory
  const canProceed = isComplete && !!assessmentData.autoAssessContent && !!coveragePaste;
  const [proceedError, setProceedError] = useState(null);

  const handleProceed = () => {
    if (!assessmentData.autoAssessContent) {
      setProceedError('Please complete the Auto-Assess Earned Media Performance check before proceeding.');
      return;
    }
    if (!coveragePaste) {
      setProceedError('Please add media coverage information before proceeding.');
      return;
    }
    if (!isComplete) {
      setProceedError('Please run the Earned Media Analysis before proceeding.');
      return;
    }
    setProceedError(null);
    onNext();
  };

  return (
    <div className="max-w-4xl mx-auto p-8 animate-fade-in">
      <div className="flex items-start gap-4 mb-6">
        <div className="w-12 h-12 bg-[#10B981]/10 rounded-xl flex items-center justify-center">
          <Newspaper className="w-6 h-6 text-[#10B981]" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-[#1A1A1A]">Earned Media Assessment</h2>
          <p className="text-sm text-[#666666]">{project.brandName}'s press coverage</p>
        </div>
      </div>

      <CompletionIndicator items={completionItems} />

      {/* Coverage Paste Field */}
      <div className="card p-5 mb-4">
        <h3 className="text-sm font-medium text-[#1A1A1A] mb-2">Media Coverage (Last 3 Months)</h3>
        <p className="text-sm text-[#666666] mb-4">
          Paste any press coverage, news articles, mentions, or media clips from the last 3 months.
        </p>
        <textarea 
          value={coveragePaste} 
          onChange={(e) => setCoveragePaste(e.target.value)}
          placeholder="Paste media coverage here...

Example:
- TechCrunch (Jan 15, 2026): 'Company X Raises $50M' - Featured as lead story
- Forbes (Jan 8, 2026): CEO quoted on industry trends
- Industry Podcast (Dec 20, 2025): 30-min interview with CTO
- SXSW 2025: Keynote presentation on AI trends
- Gartner Cool Vendor 2025: Named in category report
- Inc. 5000 (2025): Ranked #234 fastest growing
..."
          className="w-full h-28 px-3 py-2 border border-[#D9D6D0] rounded-lg bg-white resize-none text-sm"
        />
        <p className="text-xs text-[#666666] mt-2">
          Include: news articles, podcast appearances, conference keynotes, analyst mentions, awards announcements, industry rankings
        </p>
      </div>

      {/* Auto-Assess Earned Media Performance */}
      <div className="card p-5 mb-4 border-l-4 border-[#10B981]">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className="text-sm font-medium text-[#1A1A1A] mb-1 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#10B981]" />
              Auto-Assess Earned Media Performance
            </h3>
            <p className="text-xs text-[#666666]">
              AI-powered comprehensive analysis across 7 dimensions: Coverage Quality, Reach, Sentiment, Share of Voice, Message Consistency, Thought Leadership, and Audience Relevance.
            </p>
          </div>
          <button 
            onClick={runAutoAssess} 
            disabled={isAutoAssessing} 
            className="btn-secondary text-sm py-2 px-4 flex items-center gap-2 flex-shrink-0"
          >
            {isAutoAssessing ? <><Loader2 className="w-4 h-4 animate-spin" /> Assessing...</> : <><Bot className="w-4 h-4" /> Auto-Assess</>}
          </button>
        </div>
        
        {assessmentData.autoAssessContent && (
          <div className="mt-4">
            <div className="flex items-center gap-2 mb-2">
              <Check className="w-4 h-4 text-[#10B981]" />
              <span className="text-sm font-medium text-[#1A1A1A]">Performance Assessment Complete</span>
            </div>
            <div className="bg-[#F0EEEA] rounded-lg p-4 max-h-80 overflow-y-auto">
              <pre className="text-sm text-[#333333] whitespace-pre-wrap font-sans">{assessmentData.autoAssessContent}</pre>
            </div>
          </div>
        )}
      </div>

      {/* Assessor Observations - before analysis button */}
      <div className="card p-5 mb-4">
        <h3 className="text-sm font-medium text-[#1A1A1A] mb-2">Assessor Observations</h3>
        <p className="text-sm text-[#666666] mb-3">Your observations will be included in the analysis and final report.</p>
        <textarea value={assessmentData.observations || ''} onChange={(e) => setAssessmentData({ ...assessmentData, observations: e.target.value })}
          placeholder="Add your own observations about their media presence, PR strategy, coverage quality..." className="w-full h-20 px-3 py-2 border border-[#D9D6D0] rounded-lg bg-white resize-none" />
      </div>

      {!isComplete && (
        <button onClick={runAnalysis} disabled={isProcessing} className="btn-primary flex items-center gap-2 mb-6">
          {isProcessing ? <><Loader2 className="w-4 h-4 animate-spin" /> Analyzing...</> : <><Play className="w-4 h-4" /> Run Earned Media Analysis</>}
        </button>
      )}

      {error && <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 text-red-700">{error}</div>}

      {isComplete && (
        <div className="card p-5 mb-4">
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

      {proceedError && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4 text-amber-800 text-sm flex items-center gap-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          {proceedError}
        </div>
      )}

      <div className="flex items-center justify-between pt-6 border-t border-[#D9D6D0]">
        <button onClick={onPrev} className="btn-secondary flex items-center gap-2"><ArrowLeft className="w-4 h-4" /> Back</button>
        <button onClick={handleProceed} disabled={!canProceed} className="btn-primary flex items-center gap-2">Continue <ArrowRight className="w-4 h-4" /></button>
      </div>
    </div>
  );
}
// Report Page
function ReportPage({ project, scores, setScores, assessments, apiKey, onSave, onPrev, profile }) {
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
    justification: false,
    evaluated: false,
    readouts: false,
    readoutWebsite: false,
    readoutSocial: false,
    readoutAI: false,
    readoutEarned: false,
  });
  const [animatedScore, setAnimatedScore] = useState(0);
  const chartRef = useRef(null);
  
  const isReadonly = profile?.is_readonly && !profile?.is_admin;

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
      { progress: 10, stage: 'Absorbing website data...' },
      { progress: 25, stage: 'Absorbing social media data...' },
      { progress: 40, stage: 'Absorbing AI reputation data...' },
      { progress: 55, stage: 'Absorbing earned media data...' },
      { progress: 70, stage: 'Scoring performance across 8 attributes...' },
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
      const prompt = `You are scoring ${project.brandName} against the Conscious Compass Framework v${FRAMEWORK_VERSION}.

ASSESSMENT DATA COLLECTED:

WEBSITE ASSESSMENT:
${assessments.website.content}
${assessments.website.observations ? `Assessor Notes: ${assessments.website.observations}` : ''}
Pages Reviewed: ${assessments.website.pagesReviewed || 'Not specified'}
Additional Content: ${assessments.website.websiteContent || 'None'}
Recognition & Credentials: ${assessments.website.credentialsContent || 'None noted'}

SEO VISIBILITY ASSESSMENT:
${assessments.website.seoAssessment || 'SEO visibility not assessed'}

TECHNICAL PERFORMANCE AUDIT:
${assessments.website.techAudit && (assessments.website.techAudit.scores.performance !== '' || assessments.website.techAudit.scores.accessibility !== '' || assessments.website.techAudit.scores.bestPractices !== '' || assessments.website.techAudit.scores.seo !== '') ? `
Performance Score: ${assessments.website.techAudit.scores.performance !== '' ? assessments.website.techAudit.scores.performance + '/100' : 'Not provided'}
Accessibility Score: ${assessments.website.techAudit.scores.accessibility !== '' ? assessments.website.techAudit.scores.accessibility + '/100' : 'Not provided'}
Best Practices Score: ${assessments.website.techAudit.scores.bestPractices !== '' ? assessments.website.techAudit.scores.bestPractices + '/100' : 'Not provided'}
Technical SEO Score: ${assessments.website.techAudit.scores.seo !== '' ? assessments.website.techAudit.scores.seo + '/100' : 'Not provided'}
` : 'Technical audit not completed'}

SOCIAL MEDIA ASSESSMENT:
${assessments.social.content}
${assessments.social.observations ? `Assessor Notes: ${assessments.social.observations}` : ''}
Employee Advocacy: ${assessments.social.employeeAdvocacy || 'Not assessed'}
Awards & Recognition: ${assessments.social.awardsRecognition || 'Not noted'}
Hashtag Strategy: ${assessments.social.hashtagContent || 'Not assessed'}
Paid Media Presence: ${assessments.social.paidMediaContent || 'Not checked'}
Glassdoor: ${assessments.social.glassdoorContent || 'Not reviewed'}
WIPO Trademark: ${assessments.social.wipoContent || 'Not checked'}
YouTube API Data: ${assessments.social.youtubeContent?.includes('[API Data]') ? 'Verified metrics included' : 'Manual entry only'}
Knowledge Graph Status: ${assessments.social.wikipediaContent?.includes('[Knowledge Graph]') ? 'Entity data included' : 'Manual entry only'}

AI REPUTATION ASSESSMENT:
${assessments.aiReputation.content}
${assessments.aiReputation.observations ? `Assessor Notes: ${assessments.aiReputation.observations}` : ''}

EARNED MEDIA ASSESSMENT:
${assessments.earnedMedia.content}
${assessments.earnedMedia.observations ? `Assessor Notes: ${assessments.earnedMedia.observations}` : ''}

SCORING RUBRIC v2.7 - Score each attribute 0-100 by answering these fundamental questions:

${ATTRIBUTES.map(a => `${a.id} (${a.fullName})
FUNDAMENTAL QUESTION: ${a.question}
${a.description}
STRONG SIGNALS (70-100): ${a.signals.strong.join('; ')}
MODERATE SIGNALS (40-69): ${a.signals.moderate.join('; ')}
WEAK SIGNALS (0-39): ${a.signals.weak.join('; ')}`).join('\n\n')}

SCORE RANGE DEFINITIONS (use these anchors for consistency):
- 0-25 (Pre-Foundational): Cannot answer the fundamental question positively. Significant gaps, minimal evidence.
- 26-39 (Foundational): Weak answer to fundamental question. Basic presence but major improvements needed.
- 40-55 (Establishing): Partial answer to fundamental question. Moderate capability with clear room for growth.
- 56-69 (Differentiating): Good answer to fundamental question. Above average, showing intentional effort.
- 70-84 (Leading): Strong answer to fundamental question. Industry-competitive performance.
- 85-100 (Transforming): Exceptional answer to fundamental question. Category-defining excellence.

CRITICAL SCORING REQUIREMENTS:
1. ANSWER THE QUESTION: Each score must directly answer the attribute's fundamental question with evidence
2. EVIDENCE-BASED: Every score MUST be justified by specific, observable evidence from the assessment data
3. CITE SOURCES: Reference the exact source of evidence (e.g., "Website About page states...", "LinkedIn post from [date]...", "Forbes article mentioned...")
4. SIGNAL MATCHING: Compare observed evidence against the strong/moderate/weak signals for each attribute
5. RECENCY MATTERS: Weight recent evidence (last 3 months) more heavily than older content
6. CONFIDENCE LEVEL: Indicate confidence based on quantity and quality of evidence available
7. IDENTIFY GAPS: List specific missing elements that would improve the score
8. CONSISTENCY: The same evidence patterns should always produce the same score range (plus or minus 3 points)

EVIDENCE STRENGTH GUIDELINES:
- Tier 1 (Strong): Major publications, verified awards, clear data/metrics, official certifications
- Tier 2 (Moderate): Industry publications, social proof, consistent messaging across channels
- Tier 3 (Weak): Self-reported claims without verification, outdated content, single instances

SCORING CONSIDERATIONS:

WEIGHTED SCORING FOR TECHNICAL AUDIT DATA:
When Technical Performance Audit data is available, use this weighted approach for ATTENTIVE:
- 70% qualitative assessment (design, content quality, UX, brand consistency from screenshots)
- 30% technical metrics (Performance score, Accessibility score, Core Web Vitals)
Calculate: ATTENTIVE = (qualitative_score × 0.7) + (avg_technical_score × 0.3)

For COGENT, technical SEO contributes ~20% of the score:
- 80% qualitative assessment (messaging clarity, data-driven signals, content strategy)
- 20% technical SEO score from PageSpeed audit
Calculate: COGENT = (qualitative_score × 0.8) + (technical_seo_score × 0.2)

If Technical Audit was not run, score based on qualitative assessment alone but note reduced confidence.

OTHER SCORING FACTORS:
- Glassdoor reviews impact REFLECTIVE score (brand self-awareness and reputation)
- WIPO trademark registration impacts INTENTIONAL score (brand protection and professionalism)
- Core Web Vitals (LCP, CLS, TBT) indicate user experience quality - factor into the technical portion of ATTENTIVE
- YouTube API data (if available) provides verified metrics: subscriber tier, video count, third-party coverage impacts AWAKE (influence) and AWARE (audience reach)
- Knowledge Graph entity status impacts COGENT (AI search visibility) and INTENTIONAL (brand credibility)
- Reddit Answers perception directly impacts COGENT score (how AI systems perceive and describe the brand)
- Influencer partnerships impact multiple scores: strategic thought leader partnerships boost AWAKE, audience-aligned creators boost AWARE, creative quality impacts SENTIENT
- Paid media presence signals investment and intentionality: ad volume and consistency impact INTENTIONAL, creative quality impacts SENTIENT, targeting sophistication impacts COGENT and AWARE

BUSINESS MODEL WEIGHTING (${project.businessModel.toUpperCase()}):
${project.businessModel === 'b2b' ? `
B2B SCORING ADJUSTMENTS:
- LinkedIn is the PRIMARY social platform - weight LinkedIn presence and engagement 3x more than other social channels
- TikTok presence should be MINIMALLY weighted (unless targeting younger B2B buyers like startup founders)
- Instagram is secondary - useful for employer brand and culture, but not a primary lead channel
- Influencer partnerships should focus on INDUSTRY EXPERTS and THOUGHT LEADERS, not consumer influencers
- Earned media in TRADE PUBLICATIONS and INDUSTRY PRESS matters more than mainstream media
- Long-form content (whitepapers, case studies, webinars) signals stronger than short-form social content
- Employee advocacy on LinkedIn is a strong signal for REFLECTIVE and AWARE
- YouTube third-party coverage by industry channels signals strong thought leadership (AWAKE)
- Knowledge Graph entity recognition signals established credibility (INTENTIONAL, COGENT)
- Conference speaking and podcast appearances weight heavily for AWAKE
- Client logos and case studies are critical for INTENTIONAL and COGENT
` : project.businessModel === 'b2c' ? `
B2C SCORING ADJUSTMENTS:
- Weight ALL consumer social platforms (Instagram, TikTok, YouTube, X) according to target audience demographics
- TikTok is HIGHLY RELEVANT for brands targeting audiences under 40
- Influencer partnerships with CONSUMER CREATORS are highly relevant signals
- Paid media across Meta, TikTok, and Google indicates market investment
- User-generated content and community engagement are strong signals
- Consumer reviews and sentiment across platforms matter greatly
- Mainstream media coverage may matter more than trade press
- Instagram visual brand consistency is critical for SENTIENT
- YouTube subscriber tier and third-party coverage indicates audience reach (AWARE)
` : `
B2B2C / HYBRID SCORING ADJUSTMENTS:
- Weight LinkedIn heavily for B2B relationships but also assess consumer channels
- Both trade press AND mainstream media coverage matter
- Influencer strategy should show DUAL APPROACH: industry experts + consumer creators
- TikTok relevance depends on whether consumer audience skews younger
- Employee advocacy matters for B2B credibility
- Consumer reviews and B2B testimonials both contribute to REFLECTIVE
- Website should serve BOTH audiences - look for clear audience pathways
`}

CHANNEL RELEVANCE BY BUSINESS MODEL:
| Channel | B2B Weight | B2C Weight | B2B2C Weight |
| LinkedIn | Critical (5x) | Secondary (1x) | Important (3x) |
| TikTok | Low (0.5x) | High for <40 (3x) | Moderate (1.5x) |
| Instagram | Low (1x) | High (3x) | Moderate (2x) |
| YouTube | Moderate (2x) | High (3x) | High (2.5x) |
| X/Twitter | Moderate (2x) | Moderate (2x) | Moderate (2x) |
| Trade Press | Critical (3x) | Low (0.5x) | Moderate (2x) |
| Mainstream Media | Low (1x) | High (3x) | Moderate (2x) |
| Reddit Answers | High (3x) | High (3x) | High (3x) |
| Industry Events | High (3x) | Low (0.5x) | Moderate (2x) |
| Consumer Reviews | Low (0.5x) | Critical (3x) | Moderate (2x) |

Apply these weights when evaluating evidence. Missing presence on LOW-weight channels should not significantly penalize scores.

SERVICE AREAS TO REFERENCE IN RECOMMENDATIONS:
- AWAKE: Executive Visibility, PR & Media Relations, Thought Leadership Content
- AWARE: Audience Research, Social Media Strategy, Community Management, Influencer & Creator Strategy, GEO
- REFLECTIVE: Brand Strategy, Brand Expression, Crisis Communications, Brand Training
- ATTENTIVE: Website Strategy & Development, Creative Production, Brand Guidelines
- COGENT: SEO Strategy, Measurement & Analytics, Paid Media Strategy, GEO, Marketing Strategy
- SENTIENT: Creative Campaigns, Brand Expression, Content Strategy, Events
- VISIONARY: Brand Strategy, Impact Communications, Executive Visibility
- INTENTIONAL: Brand Strategy, Brand Assets & Guidelines, Website Development, Communications Training

Return the JSON scores in this exact format:
{
  "headline": "A single pithy sentence (max 20 words) that captures the brand's current state and primary opportunity. Be specific, not generic. E.g., 'Strong thought leadership undermined by inconsistent visual identity and weak digital infrastructure.'",
  "conclusion": "A 2-3 sentence insight-based conclusion that signposts the specific opportunity for this brand. Reference actual findings. Avoid generic language like 'well positioned' or 'strong foundation'. Instead, name the specific transformation available. E.g., 'Brand X has built genuine industry authority through executive visibility, but this influence dissipates at the website. Converting thought leadership credibility into a cohesive digital experience would unlock significant pipeline growth.'",
  "justification": "Under 175 words explaining why the overall score is what it is. Call out any notably high or low scores with specific evidence. This helps users defend the assessment. E.g., 'The 42 overall reflects solid awareness foundations offset by execution gaps. AWAKE scored highest (68) due to Forbes coverage and active LinkedIn thought leadership. SENTIENT scored lowest (28) because visual identity is inconsistent across channels and creative work lacks distinctive personality. The REFLECTIVE score (35) was impacted by 2.8 Glassdoor rating showing culture-brand misalignment.'",
  "AWAKE": {
    "score": 45,
    "confidence": "medium",
    "findings": "Specific observations with cited evidence. E.g., 'Forbes coverage (Jan 2026) demonstrates tier-1 media presence. LinkedIn shows 3 thought leadership articles in past quarter.'",
    "evidence": [
      {"source": "Forbes article", "type": "earned_media", "strength": "strong", "detail": "CEO quoted on industry trends"},
      {"source": "LinkedIn articles", "type": "thought_leadership", "strength": "moderate", "detail": "3 articles published in Q4"}
    ],
    "gaps": ["No podcast appearances found", "Limited speaking engagement visibility", "No Wikipedia presence"],
    "opportunity": "Consider Executive Visibility and PR services to build industry influence and narrative leadership."
  },
  "AWARE": {
    "score": 52,
    "confidence": "high",
    "findings": "Evidence-based observations about audience understanding and trust signals.",
    "evidence": [{"source": "...", "type": "...", "strength": "...", "detail": "..."}],
    "gaps": ["List specific missing elements"],
    "opportunity": "Audience Research and Social Media Strategy would strengthen audience connection."
  },
  "REFLECTIVE": {
    "score": 38,
    "confidence": "medium",
    "findings": "Evidence-based observations about brand consistency and reputation.",
    "evidence": [{"source": "...", "type": "...", "strength": "...", "detail": "..."}],
    "gaps": ["List specific missing elements"],
    "opportunity": "Brand Strategy services would establish authentic brand foundation."
  },
  "ATTENTIVE": {
    "score": 55,
    "confidence": "high",
    "findings": "Evidence-based observations about quality, UX, and accessibility (estimate WCAG 2.1 AA compliance).",
    "evidence": [{"source": "...", "type": "...", "strength": "...", "detail": "..."}],
    "gaps": ["List specific missing elements"],
    "opportunity": "Website Strategy & Development would improve experience quality."
  },
  "COGENT": {
    "score": 42,
    "confidence": "medium",
    "findings": "Evidence-based observations about SEO, data-driven approach, and strategic intelligence.",
    "evidence": [{"source": "...", "type": "...", "strength": "...", "detail": "..."}],
    "gaps": ["List specific missing elements"],
    "opportunity": "SEO Strategy and Integrated Measurement would strengthen data-driven marketing."
  },
  "SENTIENT": {
    "score": 35,
    "confidence": "medium",
    "findings": "Evidence-based observations about emotional resonance and creative differentiation.",
    "evidence": [{"source": "...", "type": "...", "strength": "...", "detail": "..."}],
    "gaps": ["List specific missing elements"],
    "opportunity": "Creative Campaigns would create stronger emotional connections."
  },
  "VISIONARY": {
    "score": 48,
    "confidence": "medium",
    "findings": "Evidence-based observations about purpose, vision, and forward-thinking positioning.",
    "evidence": [{"source": "...", "type": "...", "strength": "...", "detail": "..."}],
    "gaps": ["List specific missing elements"],
    "opportunity": "Brand Strategy and Impact Communications would clarify purpose and vision."
  },
  "INTENTIONAL": {
    "score": 50,
    "confidence": "high",
    "findings": "Evidence-based observations about credibility, professionalism, and intentional positioning.",
    "evidence": [{"source": "...", "type": "...", "strength": "...", "detail": "..."}],
    "gaps": ["List specific missing elements"],
    "opportunity": "Brand Assets & Guidelines would ensure professional market presence."
  }
}`;

      const result = await callClaude(prompt, apiKey, null, [], 0);
      clearInterval(progressInterval);
      setScoringProgress(100);
      setScoringStage('Complete!');
      const match = result.match(/\{[\s\S]*\}/);
      if (match) {
        try {
          const parsed = JSON.parse(match[0]);
          // Validate parsed data has expected structure
          const hasAtLeastOneScore = ATTRIBUTES.some(attr => 
            parsed[attr.id] && typeof parsed[attr.id].score === 'number'
          );
          if (hasAtLeastOneScore) {
            setScores(parsed);
          } else {
            setScoringError('AI response was missing score data. Please try again.');
            console.error('Parsed but missing scores:', parsed);
          }
        } catch (parseErr) {
          setScoringError('Failed to parse AI response. Please try again.');
          console.error('JSON parse error:', parseErr, 'Raw match:', match[0].substring(0, 500));
        }
      } else {
        setScoringError('AI response did not contain valid scoring data. Please try again.');
        console.error('No JSON match found in result:', result.substring(0, 500));
      }
    } catch (e) { 
      clearInterval(progressInterval);
      setScoringError(e.message); 
    }
    finally { setIsScoring(false); }
  };

  // Calculate scores early for hooks (before any returns)
  const validScoreEntries = scores ? Object.entries(scores)
    .filter(([key, val]) => val && typeof val.score === 'number') : [];
  
  const calculatedOverall = validScoreEntries.length > 0 
    ? Math.round(validScoreEntries.reduce((a, [, v]) => a + v.score, 0) / 8)
    : 0;

  // Animate score counting up on page load - must be before any returns
  useEffect(() => {
    if (calculatedOverall > 0) {
      const duration = 3000; // 3 seconds to match spider chart
      const steps = 60;
      const increment = calculatedOverall / steps;
      let current = 0;
      
      const timer = setInterval(() => {
        current += increment;
        if (current >= calculatedOverall) {
          setAnimatedScore(calculatedOverall);
          clearInterval(timer);
        } else {
          setAnimatedScore(Math.round(current));
        }
      }, duration / steps);
      
      return () => clearInterval(timer);
    }
  }, [calculatedOverall]);

  // Validate scores has actual data
  const hasValidScores = scores && Object.keys(scores).length > 0 && 
    ATTRIBUTES.some(attr => scores[attr.id]?.score !== undefined);

  // If no scores yet, show scoring prompt
  if (!hasValidScores) {
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
            <div className="max-w-lg mx-auto">
              <Loader2 className="w-16 h-16 text-[#E53935] mx-auto mb-6 animate-spin" />
              <h3 className="text-xl font-semibold text-[#1A1A1A] mb-2">Generating Report...</h3>
              <p className="text-[#666666] mb-6">{scoringStage}</p>
              
              {/* Progress bar */}
              <div className="w-full bg-[#E8E6E1] rounded-full h-3 mb-2">
                <div 
                  className="bg-[#E53935] h-3 rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${scoringProgress}%` }}
                />
              </div>
              <p className="text-sm text-[#666666] mb-8">{scoringProgress}% complete</p>
              
              {/* Progress steps - centered */}
              <div className="space-y-3">
                {/* Data Collection */}
                <div className="flex items-center justify-center gap-6 text-sm">
                  <div className={`flex items-center gap-2 ${scoringProgress >= 25 ? 'text-[#E53935]' : 'text-[#999999]'}`}>
                    {scoringProgress >= 25 ? <Check className="w-4 h-4" /> : <div className="w-4 h-4 rounded-full border-2 border-current" />}
                    <span>Website</span>
                  </div>
                  <div className={`flex items-center gap-2 ${scoringProgress >= 40 ? 'text-[#E53935]' : 'text-[#999999]'}`}>
                    {scoringProgress >= 40 ? <Check className="w-4 h-4" /> : <div className="w-4 h-4 rounded-full border-2 border-current" />}
                    <span>Social</span>
                  </div>
                  <div className={`flex items-center gap-2 ${scoringProgress >= 55 ? 'text-[#E53935]' : 'text-[#999999]'}`}>
                    {scoringProgress >= 55 ? <Check className="w-4 h-4" /> : <div className="w-4 h-4 rounded-full border-2 border-current" />}
                    <span>AI Rep</span>
                  </div>
                  <div className={`flex items-center gap-2 ${scoringProgress >= 70 ? 'text-[#E53935]' : 'text-[#999999]'}`}>
                    {scoringProgress >= 70 ? <Check className="w-4 h-4" /> : <div className="w-4 h-4 rounded-full border-2 border-current" />}
                    <span>Earned</span>
                  </div>
                </div>
                
                {/* Processing */}
                <div className="flex items-center justify-center gap-6 text-sm">
                  <div className={`flex items-center gap-2 ${scoringProgress >= 85 ? 'text-[#E53935]' : 'text-[#999999]'}`}>
                    {scoringProgress >= 85 ? <Check className="w-4 h-4" /> : <div className="w-4 h-4 rounded-full border-2 border-current" />}
                    <span>Scoring</span>
                  </div>
                  <div className={`flex items-center gap-2 ${scoringProgress >= 95 ? 'text-[#E53935]' : 'text-[#999999]'}`}>
                    {scoringProgress >= 95 ? <Check className="w-4 h-4" /> : <div className="w-4 h-4 rounded-full border-2 border-current" />}
                    <span>Recommendations</span>
                  </div>
                </div>
              </div>
            </div>
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
            <ArrowLeft className="w-4 h-4" /> {isReadonly ? 'Back' : 'Back to Earned Media'}
          </button>
        </div>
      </div>
    );
  }

  // Validate scores before render
  
  const overall = calculatedOverall;
  
  // Safety check - if overall is 0 or NaN, show error
  if (!overall || isNaN(overall)) {
    return (
      <div className="max-w-4xl mx-auto p-8">
        <div className="card p-6 text-center">
          <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-[#1A1A1A] mb-2">Report Generation Issue</h3>
          <p className="text-[#666666] mb-4">The scoring data appears to be incomplete or invalid. Please try generating the report again.</p>
          <button onClick={() => setScores(null)} className="btn-primary">
            Try Again
          </button>
          <details className="mt-4 text-left text-xs text-[#999999]">
            <summary className="cursor-pointer">Debug Info</summary>
            <pre className="mt-2 p-2 bg-[#F0EEEA] rounded overflow-auto max-h-40">
              {JSON.stringify(scores, null, 2)}
            </pre>
          </details>
        </div>
      </div>
    );
  }
  
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
  if (assessments.social?.redditAnswersContent) evaluatedInputs.push('Reddit Answers AI search visibility check');
  if (assessments.social?.redditAnswersContent) evaluatedInputs.push('Reddit Answers AI search visibility');
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

  // Copy Report Text to clipboard
  const copyReportText = () => {
    const divider = '═'.repeat(60);
    const subDivider = '─'.repeat(40);
    
    // Build attribute scores text
    const attrScoresText = ATTRIBUTES.map(attr => {
      const score = scores[attr.id]?.score || 0;
      return `  ${attr.name}: ${score}/100`;
    }).join('\n');
    
    // Build strengths and opportunities
    const strengths = sortedAttrs.slice(-3).reverse().map(a => `  • ${a.name} (${a.score}/100)`).join('\n');
    const opportunities = sortedAttrs.slice(0, 3).map(a => `  • ${a.name} (${a.score}/100)`).join('\n');
    
    // Build recommendations text
    const recsText = recommendations.slice(0, 6).map((rec, i) => 
      `  ${i + 1}. ${rec.title}\n     ${rec.description}\n     Benefit: ${rec.impact}`
    ).join('\n\n');

    let reportText = `
${divider}
CONSCIOUS COMPASS ASSESSMENT REPORT
${divider}

Brand: ${project.brandName}
Industry: ${industryName}
Website: ${project.websiteUrl}
Business Model: ${project.businessModel.toUpperCase()}
Date: ${new Date().toLocaleDateString()}

${divider}
OVERALL SCORE: ${overall}/100
Maturity Stage: ${stage.name}
${divider}

${subDivider}
ATTRIBUTE SCORES
${subDivider}
${attrScoresText}

${subDivider}
KEY STRENGTHS
${subDivider}
${strengths}

${subDivider}
GROWTH OPPORTUNITIES
${subDivider}
${opportunities}

${subDivider}
TOP RECOMMENDATIONS
${subDivider}
${recsText}

${divider}
ASSESSMENT READOUTS
${divider}
`;

    // Add Website Assessment
    if (assessments.website?.autoAssessContent || assessments.website?.seoAssessment || assessments.website?.content) {
      reportText += `
${subDivider}
WEBSITE ASSESSMENT
${subDivider}
`;
      if (assessments.website?.autoAssessContent) {
        reportText += `
[Auto-Assess Analysis]
${assessments.website.autoAssessContent}
`;
      }
      if (assessments.website?.seoAssessment) {
        reportText += `
[SEO Visibility Assessment]
${assessments.website.seoAssessment}
`;
      }
      if (assessments.website?.content) {
        reportText += `
[Full Website Analysis]
${assessments.website.content}
`;
      }
    }

    // Add Social Media Assessment
    if (assessments.social?.redditAnswersContent || assessments.social?.content) {
      reportText += `
${subDivider}
SOCIAL MEDIA ASSESSMENT
${subDivider}
`;
      if (assessments.social?.redditAnswersContent) {
        reportText += `
[Reddit Answers - AI Search Visibility]
${assessments.social.redditAnswersContent}
`;
      }
      if (assessments.social?.content) {
        reportText += `
[Full Social Media Analysis]
${assessments.social.content}
`;
      }
    }

    // Add AI Reputation Assessment
    if (assessments.aiReputation?.claudeManual || assessments.aiReputation?.geminiManual || assessments.aiReputation?.chatgptManual || assessments.aiReputation?.content) {
      reportText += `
${subDivider}
AI REPUTATION ASSESSMENT
${subDivider}
`;
      if (assessments.aiReputation?.claudeManual) {
        reportText += `
[Claude Response]
${assessments.aiReputation.claudeManual}
`;
      }
      if (assessments.aiReputation?.geminiManual) {
        reportText += `
[Gemini Response]
${assessments.aiReputation.geminiManual}
`;
      }
      if (assessments.aiReputation?.chatgptManual) {
        reportText += `
[ChatGPT Response]
${assessments.aiReputation.chatgptManual}
`;
      }
      if (assessments.aiReputation?.content) {
        reportText += `
[AI Reputation Synthesis]
${assessments.aiReputation.content}
`;
      }
    }

    // Add Earned Media Assessment
    if (assessments.earnedMedia?.autoAssessContent || assessments.earnedMedia?.content) {
      reportText += `
${subDivider}
EARNED MEDIA ASSESSMENT
${subDivider}
`;
      if (assessments.earnedMedia?.autoAssessContent) {
        reportText += `
[Auto-Assess Earned Media Performance]
${assessments.earnedMedia.autoAssessContent}
`;
      }
      if (assessments.earnedMedia?.content) {
        reportText += `
[Full Earned Media Analysis]
${assessments.earnedMedia.content}
`;
      }
    }

    reportText += `
${divider}
METHODOLOGY
${divider}
${websiteEvalDescription} Social media presence was analyzed across LinkedIn, X, Instagram, YouTube, Reddit, and Wikipedia for brand consistency and engagement. AI reputation was assessed by querying Claude, Gemini, and ChatGPT to understand how AI systems perceive and represent the brand. Earned media coverage from the past 3 months was reviewed for sentiment, message penetration, and share of voice.

Generated by Conscious Compass | Antenna Group Brand Consciousness Framework v${FRAMEWORK_VERSION}
`;

    navigator.clipboard.writeText(reportText.trim()).then(() => {
      alert('Report copied to clipboard!');
    }).catch(() => {
      // Fallback for browsers that don't support clipboard API
      const textArea = document.createElement('textarea');
      textArea.value = reportText.trim();
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      alert('Report copied to clipboard!');
    });
  };

  const generatePdf = async () => {
    setIsGeneratingPdf(true);
    try {
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 20;
      const contentWidth = pageWidth - (margin * 2);
      let y = margin;

      // Simple helper to add text and handle page breaks
      const checkPage = () => {
        if (y > pageHeight - 25) {
          pdf.addPage();
          y = margin;
        }
      };

      const addParagraph = (text, size = 10) => {
        const lines = pdf.splitTextToSize(text, contentWidth);
        pdf.setFontSize(size);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(0, 0, 0);
        lines.forEach(line => {
          checkPage();
          pdf.text(line, margin, y);
          y += size * 0.45;
        });
        y += 3;
      };

      const addSection = (title) => {
        y += 8;
        checkPage();
        pdf.setFontSize(14);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(229, 57, 53);
        pdf.text(title, margin, y);
        y += 8;
      };

      // ========== TITLE ==========
      pdf.setFontSize(24);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(0, 0, 0);
      pdf.text(project.brandName, margin, y);
      y += 10;

      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(100, 100, 100);
      pdf.text('Conscious Compass Assessment Report', margin, y);
      y += 6;

      pdf.setFontSize(10);
      pdf.text(`${project.date || new Date().toLocaleDateString()} | ${industryName} | ${project.businessModel.toUpperCase()}`, margin, y);
      y += 12;

      // ========== OVERALL SCORE ==========
      pdf.setFontSize(18);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(229, 57, 53);
      pdf.text(`Overall Score: ${overall}/100`, margin, y);
      y += 8;

      pdf.setFontSize(14);
      pdf.setTextColor(0, 0, 0);
      pdf.text(`Maturity Stage: ${stage.name}`, margin, y);
      y += 6;

      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(100, 100, 100);
      pdf.text(stage.description, margin, y);
      y += 8;

      pdf.setTextColor(5, 150, 105);
      pdf.text(`Strengths: ${sortedAttrs.slice(-2).map(a => a.name).join(', ')}`, margin, y);
      y += 5;
      pdf.setTextColor(220, 38, 38);
      pdf.text(`Opportunities: ${sortedAttrs.slice(0, 2).map(a => a.name).join(', ')}`, margin, y);
      y += 8;
      
      // Headline
      if (scores.headline) {
        pdf.setFontSize(11);
        pdf.setFont('helvetica', 'italic');
        pdf.setTextColor(51, 51, 51);
        const headlineLines = pdf.splitTextToSize(`"${scores.headline}"`, contentWidth);
        headlineLines.forEach(line => {
          pdf.text(line, margin, y);
          y += 5;
        });
        y += 4;
      }

      // ========== SPIDER CHART IMAGE ==========
      if (chartRef.current) {
        try {
          const canvas = await html2canvas(chartRef.current, {
            scale: 2,
            backgroundColor: '#ffffff',
            logging: false,
          });
          const imgData = canvas.toDataURL('image/png');
          const imgWidth = 160;
          const imgHeight = (canvas.height * imgWidth) / canvas.width;
          
          // Center the chart
          const imgX = (pageWidth - imgWidth) / 2;
          pdf.addImage(imgData, 'PNG', imgX, y, imgWidth, imgHeight);
          y += imgHeight + 8;
        } catch (err) {
          console.warn('Could not capture chart:', err);
          y += 5;
        }
      }

      // ========== ATTRIBUTE SCORES LIST ==========
      addSection('ATTRIBUTE SCORES');
      
      ATTRIBUTES.forEach(attr => {
        const score = scores[attr.id]?.score || 0;
        pdf.setFontSize(11);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(0, 0, 0);
        pdf.text(`${attr.name}: ${score}/100`, margin, y);
        y += 6;
      });

      // ========== EXECUTIVE SUMMARY ==========
      addSection('EXECUTIVE SUMMARY');
      addParagraph(`${project.brandName} achieved an overall Brand Consciousness Score of ${overall}/100, placing them in the "${stage.name}" maturity stage. The assessment evaluated the brand across 8 key consciousness attributes. Key strengths emerged in ${sortedAttrs.slice(-2).map(a => a.name).join(' and ')}, while opportunities for growth were identified in ${sortedAttrs.slice(0, 2).map(a => a.name).join(' and ')}.`);

      // ========== ATTRIBUTE ANALYSIS ==========
      addSection('ATTRIBUTE ANALYSIS');

      ATTRIBUTES.forEach(attr => {
        const score = scores[attr.id]?.score || 0;
        const findings = scores[attr.id]?.findings || scores[attr.id]?.summary || attr.description;
        const opportunity = scores[attr.id]?.opportunity;

        checkPage();

        // Attribute name and score
        pdf.setFontSize(12);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(0, 0, 0);
        pdf.text(`${attr.name}: ${score}/100`, margin, y);
        y += 6;

        // Findings
        if (findings) {
          const lines = pdf.splitTextToSize(findings, contentWidth);
          pdf.setFontSize(9);
          pdf.setFont('helvetica', 'normal');
          pdf.setTextColor(50, 50, 50);
          lines.forEach(line => {
            checkPage();
            pdf.text(line, margin, y);
            y += 4;
          });
        }

        // Opportunity
        if (opportunity) {
          y += 2;
          const oppLines = pdf.splitTextToSize('Opportunity: ' + opportunity, contentWidth);
          pdf.setFontSize(9);
          pdf.setFont('helvetica', 'italic');
          pdf.setTextColor(5, 150, 105);
          oppLines.forEach(line => {
            checkPage();
            pdf.text(line, margin, y);
            y += 4;
          });
        }

        y += 8;
      });

      // ========== RECOMMENDATIONS ==========
      addSection('TOP RECOMMENDATIONS');

      recommendations.slice(0, 6).forEach((r, i) => {
        checkPage();

        pdf.setFontSize(11);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(0, 0, 0);
        pdf.text(`${i + 1}. ${r.title}`, margin, y);
        y += 6;

        const descLines = pdf.splitTextToSize(r.description, contentWidth);
        pdf.setFontSize(9);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(50, 50, 50);
        descLines.forEach(line => {
          checkPage();
          pdf.text(line, margin, y);
          y += 4;
        });

        // Add benefit
        const benefitLines = pdf.splitTextToSize(`Benefit: ${r.impact}`, contentWidth);
        pdf.setFontSize(9);
        pdf.setFont('helvetica', 'italic');
        pdf.setTextColor(229, 57, 53); // Red accent
        benefitLines.forEach(line => {
          checkPage();
          pdf.text(line, margin, y);
          y += 4;
        });

        pdf.setFontSize(8);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(100, 100, 100);
        pdf.text(`Impacts: ${r.attributes.join(', ')}`, margin, y);
        y += 8;
      });

      // ========== RECOMMENDED ANTENNA GROUP SERVICES ==========
      const forceInclude = getForceIncludeServicesFromAIReputation(assessments?.aiReputation?.content, assessments);
      const serviceRecs = getAllRecommendations(scores, { forceIncludeServices: forceInclude });
      const topServices = serviceRecs.slice(0, 6);
      
      if (topServices.length > 0) {
        addSection('RECOMMENDED ANTENNA GROUP SERVICES');
        
        pdf.setFontSize(9);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(100, 100, 100);
        pdf.text('Based on the assessment, these services would have the greatest impact:', margin, y);
        y += 8;

        topServices.forEach((rec, i) => {
          checkPage();
          const attr = ATTRIBUTES.find(a => a.id === rec.attributeId);

          pdf.setFontSize(11);
          pdf.setFont('helvetica', 'bold');
          pdf.setTextColor(0, 0, 0);
          pdf.text(`${i + 1}. ${rec.service.name}`, margin, y);
          y += 5;

          pdf.setFontSize(8);
          pdf.setFont('helvetica', 'normal');
          pdf.setTextColor(100, 100, 100);
          pdf.text(`${rec.service.category} | Improves ${attr?.name || 'brand'} | ${formatBudget(rec.service)}`, margin, y);
          y += 5;

          const rationaleLines = pdf.splitTextToSize(rec.rationale, contentWidth);
          pdf.setFontSize(9);
          pdf.setTextColor(50, 50, 50);
          rationaleLines.forEach(line => {
            checkPage();
            pdf.text(line, margin, y);
            y += 4;
          });
          y += 4;
        });
      }

      // ========== CONCLUSIONS ==========
      addSection('CONCLUSIONS');
      const conclusionText = scores.conclusion || `${project.brandName} has demonstrated ${overall >= 60 ? 'strong potential' : 'a foundation'} for building an impactful, conscious brand presence. By focusing on the recommendations outlined above, particularly strengthening ${sortedAttrs[0].name} and ${sortedAttrs[1].name} capabilities, the brand can elevate its market position and create deeper connections with its audience.`;
      addParagraph(conclusionText);
      
      // ========== SCORE JUSTIFICATION ==========
      if (scores.justification) {
        addSection('SCORE JUSTIFICATION');
        addParagraph(scores.justification);
      }

      // ========== METHODOLOGY ==========
      addSection('METHODOLOGY');
      addParagraph(`This assessment was conducted using Antenna Group's Brand Consciousness Framework v${FRAMEWORK_VERSION}, evaluating ${project.brandName} across four key dimensions: website presence, social media footprint, AI reputation, and earned media coverage. The business model (${project.businessModel.toUpperCase()}) and industry context (${industryName}) were applied to weight attribute importance appropriately.`);

      // ========== FOOTER ==========
      const pageCount = pdf.internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        pdf.setPage(i);
        pdf.setFontSize(8);
        pdf.setTextColor(150, 150, 150);
        pdf.text(`Conscious Compass by Antenna Group | Page ${i} of ${pageCount}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
      }

      pdf.save(`${project.brandName.replace(/\s+/g, '_')}_Conscious_Compass_Report.pdf`);
    } catch (e) {
      console.error('PDF generation error:', e);
    } finally {
      setIsGeneratingPdf(false);
    }
  };


  const generateDocx = async () => {
    console.log('generateDocx called');
    setIsGenerating(true);
    try {
      console.log('Starting DOCX generation...');
      // Color helper - convert hex to DOCX color format (without #)
      const hexColor = (hex) => hex.replace('#', '');
      
      // Get service recommendations (with AI reputation-based force-includes)
      const forceIncludeDocx = getForceIncludeServicesFromAIReputation(assessments?.aiReputation?.content, assessments);
      const serviceRecs = getAllRecommendations(scores, { forceIncludeServices: forceIncludeDocx });
      const topServices = serviceRecs.slice(0, 6);
      
      // Build website evaluation description
      const websiteEvalDescription = assessments.website?.pagesReviewed
        ? `Website analysis covered ${assessments.website.pagesReviewed}, examining brand positioning, messaging and storytelling, information architecture, UI design, user experience, accessibility, and AI search readability.`
        : 'Website analysis examined brand positioning, messaging, design, and user experience.';
      
      const doc = new Document({
        styles: {
          default: {
            document: { run: { font: 'Inter', size: 22 } },
            heading1: { run: { font: 'Inter', size: 48, bold: true, color: '1A1A1A' } },
            heading2: { run: { font: 'Inter', size: 28, bold: true, color: 'E53935' } },
          }
        },
        sections: [{
          properties: { 
            page: { 
              size: { width: 12240, height: 15840 }, 
              margin: { top: 1080, right: 1080, bottom: 1080, left: 1080 } 
            } 
          },
          children: [
            // ========== TITLE SECTION ==========
            new Paragraph({ 
              spacing: { after: 100 },
              children: [
                new TextRun({ text: project.brandName.toUpperCase(), bold: true, size: 56 }),
                new TextRun({ text: ' BRAND', size: 56, color: '666666' }),
              ] 
            }),
            new Paragraph({ 
              spacing: { after: 100 },
              children: [new TextRun({ text: 'COMPASS ASSESSMENT', size: 40, bold: true })] 
            }),
            new Paragraph({ 
              spacing: { after: 600 },
              children: [new TextRun({ text: `Assessment Date: ${project.date || new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`, size: 22, color: '666666' })] 
            }),
            
            // ========== EXECUTIVE SUMMARY ==========
            new Paragraph({ 
              heading: HeadingLevel.HEADING_2, 
              spacing: { after: 200 },
              children: [new TextRun({ text: 'EXECUTIVE SUMMARY', color: '1A1A1A', size: 32 })] 
            }),
            new Paragraph({ 
              spacing: { after: 200 },
              children: [new TextRun({ 
                text: scores.conclusion || `${project.brandName} has demonstrated ${overall >= 60 ? 'strong potential' : 'a foundation'} for building an impactful, conscious brand presence. By focusing on the recommendations outlined below, particularly strengthening ${sortedAttrs[0].name} and ${sortedAttrs[1].name} capabilities, the brand can elevate its market position and create deeper connections with its audience. The journey toward greater brand consciousness is ongoing, and with strategic focus, ${project.brandName} is well positioned to become a more consequential presence in its industry.`, 
                size: 22 
              })] 
            }),
            new Paragraph({ 
              spacing: { after: 400 },
              children: [new TextRun({ text: 'Assessment Inputs:', bold: true, size: 22 })] 
            }),
            new Paragraph({ 
              spacing: { after: 200 },
              children: [new TextRun({ 
                text: `This assessment was conducted using Antenna Group's Brand Consciousness Framework v${FRAMEWORK_VERSION}, evaluating ${project.brandName} across four key dimensions.`, 
                size: 20 
              })] 
            }),
            new Paragraph({ 
              spacing: { after: 100 },
              children: [
                new TextRun({ text: 'Website analysis ', bold: true, size: 20 }),
                new TextRun({ text: `covered ${assessments.website?.pagesReviewed || 'key pages'}, examining brand positioning, messaging and storytelling, information architecture, UI design, user experience, accessibility, and AI search readability.`, size: 20 }),
              ] 
            }),
            new Paragraph({ 
              spacing: { after: 100 },
              children: [
                new TextRun({ text: 'Social media presence ', bold: true, size: 20 }),
                new TextRun({ text: 'was analyzed across LinkedIn, X, Instagram, YouTube, Reddit, and Wikipedia for brand consistency and engagement.', size: 20 }),
              ] 
            }),
            new Paragraph({ 
              spacing: { after: 100 },
              children: [
                new TextRun({ text: 'AI reputation ', bold: true, size: 20 }),
                new TextRun({ text: 'was assessed by querying Claude, Gemini, and ChatGPT to understand how AI systems perceive and represent the brand.', size: 20 }),
              ] 
            }),
            new Paragraph({ 
              spacing: { after: 600 },
              children: [
                new TextRun({ text: 'Earned media ', bold: true, size: 20 }),
                new TextRun({ text: `coverage from the past 3 months was reviewed for sentiment, message penetration, and share of voice. The business model (${project.businessModel.toUpperCase()}) and industry context (${industryName}) were applied to weight attribute importance appropriately.`, size: 20 }),
              ] 
            }),
            
            // ========== SCORE SUMMARY ==========
            new Paragraph({ 
              heading: HeadingLevel.HEADING_2, 
              spacing: { after: 300 },
              children: [new TextRun({ text: 'SCORE SUMMARY', color: '1A1A1A', size: 32 })] 
            }),
            new Paragraph({ 
              spacing: { after: 200 },
              children: [
                new TextRun({ text: `${project.brandName} demonstrates strength in `, size: 22 }),
                new TextRun({ text: sortedAttrs.slice(-2).map(a => a.name).join(' and '), size: 22, color: '059669' }),
                new TextRun({ text: ', with opportunities to grow in ', size: 22 }),
                new TextRun({ text: sortedAttrs.slice(0, 2).map(a => a.name).join(' and '), size: 22, color: 'E53935' }),
                new TextRun({ text: '.', size: 22 }),
              ] 
            }),
            // Headline quote if available
            ...(scores.headline ? [new Paragraph({ 
              spacing: { after: 400 },
              children: [new TextRun({ text: `"${scores.headline}"`, size: 22, italics: true, color: '333333' })]
            })] : []),
            // Attribute scores list
            ...ATTRIBUTES.map(attr => {
              const score = scores[attr.id]?.score || 0;
              return new Paragraph({ 
                spacing: { after: 50 },
                children: [
                  new TextRun({ text: `${attr.name}: `, bold: true, size: 22 }),
                  new TextRun({ text: `${score}`, size: 22, color: hexColor(attr.color) }),
                ] 
              });
            }),
            new Paragraph({ children: [new TextRun('')] }),
            
            // ========== BRAND CONSCIOUSNESS MATURITY ==========
            new Paragraph({ 
              spacing: { before: 200, after: 100 },
              children: [new TextRun({ text: 'Brand Consciousness Maturity', bold: true, size: 24 })] 
            }),
            new Paragraph({ 
              spacing: { after: 100 },
              children: [
                new TextRun({ text: `Overall Score: `, size: 22 }),
                new TextRun({ text: `${overall}/100`, bold: true, size: 28, color: hexColor(stage.color) }),
              ] 
            }),
            new Paragraph({ 
              spacing: { after: 100 },
              children: [
                new TextRun({ text: `Stage: `, size: 22 }),
                new TextRun({ text: stage.name, bold: true, size: 22 }),
              ] 
            }),
            new Paragraph({ 
              spacing: { after: 100 },
              children: [new TextRun({ text: stage.description, size: 20, italics: true, color: '666666' })] 
            }),
            new Paragraph({ 
              spacing: { after: 400 },
              children: [new TextRun({ text: `${Math.min(100, MATURITY_STAGES.find(s => s.min > overall)?.min || 100) - overall} points to next level`, size: 20, color: '059669' })] 
            }),
            
            // ========== ATTRIBUTE ANALYSIS ==========
            new Paragraph({ 
              heading: HeadingLevel.HEADING_2, 
              pageBreakBefore: true,
              spacing: { after: 300 },
              children: [new TextRun({ text: 'ATTRIBUTE ANALYSIS', color: '1A1A1A', size: 32 })] 
            }),
            ...ATTRIBUTES.flatMap(attr => {
              const score = scores[attr.id]?.score || 0;
              const findings = scores[attr.id]?.findings || scores[attr.id]?.summary || attr.description;
              const opportunity = scores[attr.id]?.opportunity;
              return [
                // Score and attribute name
                new Paragraph({ 
                  spacing: { before: 300, after: 50 },
                  children: [
                    new TextRun({ text: `${score} `, bold: true, size: 32, color: hexColor(attr.color) }),
                    new TextRun({ text: attr.name.toUpperCase(), bold: true, size: 28 }),
                  ] 
                }),
                // Full name subtitle
                new Paragraph({ 
                  spacing: { after: 100 },
                  children: [new TextRun({ text: attr.fullName, bold: true, size: 20, color: '666666' })] 
                }),
                // Findings paragraph
                new Paragraph({ 
                  spacing: { after: 100 },
                  children: [new TextRun({ text: findings, size: 20 })] 
                }),
                // Opportunity arrow (if available)
                ...(opportunity ? [new Paragraph({ 
                  spacing: { after: 200 },
                  children: [new TextRun({ text: `→ ${opportunity}`, size: 20, color: 'E53935' })] 
                })] : []),
              ];
            }),
            
            // ========== TOP RECOMMENDATIONS ==========
            new Paragraph({ 
              heading: HeadingLevel.HEADING_2, 
              pageBreakBefore: true,
              spacing: { after: 300 },
              children: [new TextRun({ text: 'TOP RECOMMENDATIONS', color: '1A1A1A', size: 32 })] 
            }),
            ...recommendations.slice(0, 12).flatMap((r, i) => [
              // Recommendation title with number
              new Paragraph({ 
                spacing: { before: 200, after: 100 },
                children: [
                  new TextRun({ text: `${i + 1} `, bold: true, size: 24 }),
                  new TextRun({ text: r.title, bold: true, size: 24 }),
                ] 
              }),
              // Description bullet
              new Paragraph({ 
                spacing: { after: 50 },
                bullet: { level: 0 },
                children: [new TextRun({ text: r.description, size: 20 })] 
              }),
              // Benefit bullet
              new Paragraph({ 
                spacing: { after: 50 },
                bullet: { level: 0 },
                children: [
                  new TextRun({ text: 'Benefit: ', bold: true, size: 20 }),
                  new TextRun({ text: r.impact, size: 20 }),
                ] 
              }),
              // Impacts bullet
              new Paragraph({ 
                spacing: { after: 150 },
                bullet: { level: 0 },
                children: [
                  new TextRun({ text: 'IMPACTS: ', bold: true, size: 20 }),
                  new TextRun({ text: r.attributes.join(', '), size: 20 }),
                ] 
              }),
            ]),
            
            // ========== RECOMMENDED ANTENNA GROUP SERVICES ==========
            new Paragraph({ 
              heading: HeadingLevel.HEADING_2, 
              pageBreakBefore: true,
              spacing: { after: 200 },
              children: [new TextRun({ text: 'RECOMMENDED ANTENNA GROUP SERVICES', color: '1A1A1A', size: 32 })] 
            }),
            new Paragraph({ 
              spacing: { after: 300 },
              children: [new TextRun({ text: 'Based on the lowest scoring attributes, these services would have the greatest impact on improving brand consciousness:', size: 20 })] 
            }),
            ...topServices.flatMap((rec) => {
              const attr = ATTRIBUTES.find(a => a.id === rec.attributeId);
              const attrScore = scores[rec.attributeId]?.score || 0;
              const budgetStr = rec.service.budget 
                ? `$${(rec.service.budget.low / 1000).toFixed(0)}K - $${(rec.service.budget.high / 1000).toFixed(0)}K`
                : 'Contact for pricing';
              const weeksStr = rec.service.weeks 
                ? `${rec.service.weeks.low}-${rec.service.weeks.high} weeks`
                : '';
              
              return [
                // Service name
                new Paragraph({ 
                  spacing: { before: 200, after: 50 },
                  children: [new TextRun({ text: rec.service.name, bold: true, size: 24 })] 
                }),
                // What it includes (if available)
                ...(rec.service.includes && rec.service.includes.length > 0 ? [new Paragraph({ 
                  spacing: { after: 50 },
                  bullet: { level: 0 },
                  children: [new TextRun({ text: rec.service.includes.slice(0, 3).join(', ') + (rec.service.includes.length > 3 ? '...' : ''), size: 20, color: '666666' })] 
                })] : []),
                // Recommended: Improves X (currently Y)
                new Paragraph({ 
                  spacing: { after: 50 },
                  bullet: { level: 0 },
                  children: [
                    new TextRun({ text: 'Recommended: ', size: 20 }),
                    new TextRun({ text: `Improves ${attr?.name || 'multiple attributes'} (currently ${attrScore})`, size: 20 }),
                  ] 
                }),
                // Budget
                new Paragraph({ 
                  spacing: { after: 150 },
                  bullet: { level: 0 },
                  children: [new TextRun({ text: budgetStr, size: 20 })] 
                }),
              ];
            }),
            
            // ========== CONCLUSIONS ==========
            new Paragraph({ 
              heading: HeadingLevel.HEADING_2, 
              pageBreakBefore: true,
              spacing: { after: 200 },
              children: [new TextRun({ text: 'CONCLUSIONS', color: '1A1A1A', size: 32 })] 
            }),
            new Paragraph({ 
              spacing: { after: 400 },
              children: [new TextRun({ 
                text: scores.conclusion || `${project.brandName} has demonstrated ${overall >= 60 ? 'strong potential' : 'a foundation'} for building an impactful, conscious brand presence. By focusing on the recommendations outlined above, particularly strengthening ${sortedAttrs[0].name} and ${sortedAttrs[1].name} capabilities, the brand can elevate its market position and create deeper connections with its audience.`, 
                size: 22 
              })] 
            }),
            
            // ========== WHAT WE EVALUATED ==========
            new Paragraph({ 
              heading: HeadingLevel.HEADING_2, 
              spacing: { before: 400, after: 200 },
              children: [new TextRun({ text: 'WHAT WE EVALUATED', color: '1A1A1A', size: 32 })] 
            }),
            new Paragraph({ 
              spacing: { after: 400 },
              children: [new TextRun({ 
                text: `This assessment was conducted using Antenna Group's Brand Consciousness Framework v${FRAMEWORK_VERSION}, evaluating ${project.brandName} across four key dimensions. ${websiteEvalDescription} Social media presence was analyzed across LinkedIn, X, Instagram, YouTube, Reddit, and Wikipedia for brand consistency and engagement. AI reputation was assessed by querying Claude, Gemini, and ChatGPT to understand how AI systems perceive and represent the brand. Earned media coverage from the past 3 months was reviewed for sentiment, message penetration, and share of voice. The business model (${project.businessModel.toUpperCase()}) and industry context (${industryName}) were applied to weight attribute importance appropriately.`, 
                size: 20 
              })] 
            }),
            
            // ========== SCORE JUSTIFICATION ==========
            ...(scores.justification ? [
              new Paragraph({ 
                heading: HeadingLevel.HEADING_2, 
                spacing: { before: 400, after: 200 },
                children: [new TextRun({ text: 'SCORE JUSTIFICATION', color: '1A1A1A', size: 32 })] 
              }),
              new Paragraph({ 
                spacing: { after: 400 },
                children: [new TextRun({ text: scores.justification, size: 20 })] 
              }),
            ] : []),
            
            // ========== FOOTER ==========
            new Paragraph({ 
              spacing: { before: 600 },
              alignment: AlignmentType.CENTER,
              children: [new TextRun({ text: `© Antenna Group | Conscious Compass Assessment | Brand Consciousness Framework v${FRAMEWORK_VERSION}`, size: 16, color: '999999' })] 
            }),
          ]
        }]
      });

      const blob = await Packer.toBlob(doc);
      saveAs(blob, `${project.brandName.replace(/\s+/g, '_')}_Conscious_Compass_Report.docx`);
    } catch (e) { 
      console.error('DOCX generation error:', e);
      alert('Error generating DOCX: ' + e.message);
    }
    finally { setIsGenerating(false); }
  };

  return (
    <div className="max-w-5xl mx-auto p-8 animate-fade-in">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          {isReadonly && (
            <button onClick={onPrev} className="btn-secondary flex items-center gap-2">
              <ArrowLeft className="w-4 h-4" /> Back
            </button>
          )}
          <div>
            <h2 className="text-3xl font-bold text-[#1A1A1A]">{project.brandName}</h2>
            <p className="text-[#666666]">Conscious Compass Assessment Report | {industryName}</p>
          </div>
        </div>
        {!isReadonly ? (
          <div className="flex gap-3">
            <button onClick={copyReportText} className="btn-secondary flex items-center gap-2"><Copy className="w-4 h-4" /> Copy Report</button>
            <button onClick={onSave} className="btn-secondary flex items-center gap-2"><Save className="w-4 h-4" /> Save</button>
            {/* PDF export temporarily disabled - redesign in progress
            <button onClick={generatePdf} disabled={isGeneratingPdf} className="btn-primary flex items-center gap-2">
              {isGeneratingPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} PDF
            </button>
            */}
            <button onClick={generateDocx} disabled={isGenerating} className="btn-primary flex items-center gap-2">
              {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} DOCX
            </button>
          </div>
        ) : (
          <span className="text-sm text-[#666666] bg-[#F0EEEA] px-3 py-1.5 rounded-full">Viewing Report</span>
        )}
      </div>

      {/* Hero Section - Score & Chart Side by Side */}
      <div className="card p-6 mb-6">
        <div className="grid md:grid-cols-2 gap-8 items-start">
          {/* Left: Score & Summary */}
          <div>
            <div className="flex items-start gap-4 mb-4">
              <div className="text-center">
                <div className="w-20 h-20 rounded-2xl flex items-center justify-center text-white text-3xl font-bold" style={{ backgroundColor: stage.color }}>
                  {animatedScore}
                </div>
                <div className="text-xs text-[#666666] mt-1">out of 100</div>
              </div>
              <div className="flex-1">
                <div className="text-lg font-bold text-[#1A1A1A] mb-1">{stage.name}</div>
                <p className="text-sm text-[#666666] leading-relaxed">{stage.description}</p>
              </div>
            </div>
            <div className="border-t border-[#E8E6E1] pt-4">
              {scores.headline && (
                <p className="text-base font-medium text-[#1A1A1A] mb-3 italic">
                  "{scores.headline}"
                </p>
              )}
              <p className="text-sm text-[#333333] leading-relaxed">
                <strong>{project.brandName}</strong> demonstrates strength in <span className="text-[#059669] font-medium">{sortedAttrs.slice(-2).map(a => a.name).join(' and ')}</span>, with opportunities to grow in <span className="text-[#E53935] font-medium">{sortedAttrs.slice(0, 2).map(a => a.name).join(' and ')}</span>.
              </p>
            </div>
          </div>
          
          {/* Right: Spider Chart */}
          <div className="flex justify-center overflow-visible">
            <div ref={chartRef}>
              <SpiderChart scores={scores} size={420} />
            </div>
          </div>
        </div>
      </div>

      {/* Score Grid - Compact */}
      <div className="grid grid-cols-4 md:grid-cols-8 gap-2 mb-6">
        {ATTRIBUTES.map(attr => (
          <div key={attr.id} className="card p-3 text-center">
            <div className="text-xl font-bold" style={{ color: attr.color }}>{scores[attr.id]?.score || 0}</div>
            <div className="text-[10px] text-[#666666] uppercase tracking-wide">{attr.name}</div>
          </div>
        ))}
      </div>

      {/* Maturity Continuum */}
      <MaturityContinuum score={overall} />

      {/* Attribute Analysis - Collapsible */}
      <div className="mt-6 mb-6">
        <button 
          onClick={() => toggleSection('attributes')} 
          className="w-full flex items-center justify-between text-base font-semibold text-[#1A1A1A] mb-3 hover:text-[#E53935] transition-colors"
        >
          <span>ATTRIBUTE ANALYSIS</span>
          <ChevronDown className={`w-5 h-5 transition-transform ${expandedSections.attributes ? 'rotate-180' : ''}`} />
        </button>
        {expandedSections.attributes && (
          <div className="grid md:grid-cols-2 gap-3 animate-fade-in">
            {ATTRIBUTES.map(attr => (
              <div key={attr.id} className="card p-4 border-l-4" style={{ borderLeftColor: attr.color }}>
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-2xl font-bold" style={{ color: attr.color }}>{scores[attr.id]?.score || 0}</span>
                  <div>
                    <h4 className="font-semibold text-[#1A1A1A] text-sm">{attr.name}</h4>
                    <p className="text-xs text-[#666666]">{attr.fullName}</p>
                  </div>
                </div>
                <p className="text-xs text-[#333333] leading-relaxed">{scores[attr.id]?.findings || scores[attr.id]?.summary || attr.description}</p>
                {scores[attr.id]?.opportunity && (
                  <p className="text-xs text-[#E53935] mt-2 italic">→ {scores[attr.id].opportunity}</p>
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
          className="w-full flex items-center justify-between text-base font-semibold text-[#1A1A1A] mb-3 hover:text-[#E53935] transition-colors"
        >
          <span>RECOMMENDATIONS</span>
          <ChevronDown className={`w-5 h-5 transition-transform ${expandedSections.recommendations ? 'rotate-180' : ''}`} />
        </button>
        {expandedSections.recommendations && (
          <div className="animate-fade-in">
            <div className="grid md:grid-cols-2 gap-3">
              {recommendations.slice(0, 6).map((r, i) => (
                <div key={i} className="card p-4">
                  <div className="flex gap-3 mb-2">
                    <div className="w-6 h-6 rounded-full bg-[#E53935] text-white flex items-center justify-center font-bold text-xs flex-shrink-0">{i + 1}</div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-[#1A1A1A] text-sm">{r.title}</h4>
                    </div>
                  </div>
                  <p className="text-xs text-[#666666] leading-relaxed mb-2">{r.description}</p>
                  <div className="bg-[#F0EEEA] rounded-lg p-2 mb-2">
                    <p className="text-xs text-[#333333] leading-relaxed"><span className="font-medium text-[#E53935]">Benefit:</span> {r.impact}</p>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {r.attributes.slice(0, 3).map((attr, j) => (
                      <span key={j} className="text-[10px] px-1.5 py-0.5 bg-[#E53935]/10 text-[#E53935] rounded-full">{attr}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            {recommendations.length > 6 && (
              <details className="mt-3">
                <summary className="text-sm text-[#E53935] cursor-pointer hover:underline">View {recommendations.length - 6} more recommendations</summary>
                <div className="grid md:grid-cols-2 gap-3 mt-3">
                  {recommendations.slice(6).map((r, i) => (
                    <div key={i + 6} className="card p-4">
                      <div className="flex gap-3 mb-2">
                        <div className="w-6 h-6 rounded-full bg-[#E53935]/20 text-[#E53935] flex items-center justify-center font-bold text-xs flex-shrink-0">{i + 7}</div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-[#1A1A1A] text-sm">{r.title}</h4>
                        </div>
                      </div>
                      <p className="text-xs text-[#666666] leading-relaxed mb-2">{r.description}</p>
                      <div className="bg-[#F0EEEA] rounded-lg p-2 mb-2">
                        <p className="text-xs text-[#333333] leading-relaxed"><span className="font-medium text-[#E53935]">Benefit:</span> {r.impact}</p>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {r.attributes.slice(0, 3).map((attr, j) => (
                          <span key={j} className="text-[10px] px-1.5 py-0.5 bg-[#E53935]/10 text-[#E53935] rounded-full">{attr}</span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </details>
            )}
          </div>
        )}
      </div>

      {/* Antenna Group Services - Collapsible */}
      {(() => {
        const forceIncludeUI = getForceIncludeServicesFromAIReputation(assessments?.aiReputation?.content, assessments);
        const serviceRecs = getAllRecommendations(scores, { forceIncludeServices: forceIncludeUI });
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
              {scores.conclusion || `${project.brandName} has demonstrated ${overall >= 60 ? 'strong potential' : 'a foundation'} for building an impactful, conscious brand presence. By focusing on the recommendations outlined above, particularly strengthening ${sortedAttrs[0].name} and ${sortedAttrs[1].name} capabilities, the brand can elevate its market position and create deeper connections with its audience.`}
            </p>
          </div>
        )}
      </div>

      {/* Justification - Collapsible */}
      {scores.justification && (
        <div className="mb-6">
          <button 
            onClick={() => toggleSection('justification')} 
            className="w-full flex items-center justify-between text-lg font-semibold text-[#1A1A1A] mb-4 hover:text-[#E53935] transition-colors"
          >
            <span>SCORE JUSTIFICATION</span>
            <ChevronDown className={`w-5 h-5 transition-transform ${expandedSections.justification ? 'rotate-180' : ''}`} />
          </button>
          {expandedSections.justification && (
            <div className="card p-4 md:p-6 animate-fade-in bg-[#FAFAF9]">
              <p className="text-sm text-[#333333] leading-relaxed">
                {scores.justification}
              </p>
            </div>
          )}
        </div>
      )}

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
              This assessment was conducted using Antenna Group's Brand Consciousness Framework v{FRAMEWORK_VERSION}, evaluating {project.brandName} across four key dimensions. {websiteEvalDescription} Social media presence was analyzed across LinkedIn, X, Instagram, YouTube, Reddit, and Wikipedia for brand consistency and engagement. AI reputation was assessed by querying Claude, Gemini, and ChatGPT to understand how AI systems perceive and represent the brand. Earned media coverage from the past 3 months was reviewed for sentiment, message penetration, and share of voice. The business model ({project.businessModel.toUpperCase()}) and industry context ({industryName}) were applied to weight attribute importance appropriately.
            </p>
          </div>
        )}
      </div>

      {/* Assessment Readouts - Collapsible */}
      <div className="mb-8">
        <button 
          onClick={() => toggleSection('readouts')} 
          className="w-full flex items-center justify-between text-lg font-semibold text-[#1A1A1A] mb-4 hover:text-[#E53935] transition-colors"
        >
          <span>ASSESSMENT READOUTS</span>
          <ChevronDown className={`w-5 h-5 transition-transform ${expandedSections.readouts ? 'rotate-180' : ''}`} />
        </button>
        {expandedSections.readouts && (
          <div className="space-y-3 animate-fade-in">
            {/* Website Assessment Readout */}
            <div className="card overflow-hidden">
              <button 
                onClick={() => toggleSection('readoutWebsite')} 
                className="w-full flex items-center justify-between p-4 hover:bg-[#F8F7F5] transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-[#E53935]/10 rounded-lg flex items-center justify-center">
                    <Globe className="w-5 h-5 text-[#E53935]" />
                  </div>
                  <div className="text-left">
                    <h4 className="font-medium text-[#1A1A1A]">Website Assessment</h4>
                    <p className="text-xs text-[#666666]">Auto-assess, SEO visibility, and full analysis</p>
                  </div>
                </div>
                <ChevronDown className={`w-5 h-5 text-[#666666] transition-transform ${expandedSections.readoutWebsite ? 'rotate-180' : ''}`} />
              </button>
              {expandedSections.readoutWebsite && (
                <div className="border-t border-[#E8E6E1] p-4 space-y-4 bg-[#FAFAF9]">
                  {assessments.website?.autoAssessContent && (
                    <div>
                      <h5 className="text-sm font-medium text-[#E53935] mb-2">Auto-Assess Analysis</h5>
                      <div className="bg-white rounded-lg p-4 max-h-64 overflow-y-auto">
                        <pre className="text-sm text-[#333333] whitespace-pre-wrap font-sans">{assessments.website.autoAssessContent}</pre>
                      </div>
                    </div>
                  )}
                  {assessments.website?.seoAssessment && (
                    <div>
                      <h5 className="text-sm font-medium text-[#E53935] mb-2">SEO Visibility Assessment</h5>
                      <div className="bg-white rounded-lg p-4 max-h-64 overflow-y-auto">
                        <pre className="text-sm text-[#333333] whitespace-pre-wrap font-sans">{assessments.website.seoAssessment}</pre>
                      </div>
                    </div>
                  )}
                  {assessments.website?.content && (
                    <div>
                      <h5 className="text-sm font-medium text-[#E53935] mb-2">Full Website Analysis</h5>
                      <div className="bg-white rounded-lg p-4 max-h-64 overflow-y-auto">
                        <pre className="text-sm text-[#333333] whitespace-pre-wrap font-sans">{assessments.website.content}</pre>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Social Media Assessment Readout */}
            <div className="card overflow-hidden">
              <button 
                onClick={() => toggleSection('readoutSocial')} 
                className="w-full flex items-center justify-between p-4 hover:bg-[#F8F7F5] transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-[#8B5CF6]/10 rounded-lg flex items-center justify-center">
                    <Users className="w-5 h-5 text-[#8B5CF6]" />
                  </div>
                  <div className="text-left">
                    <h4 className="font-medium text-[#1A1A1A]">Social Media Assessment</h4>
                    <p className="text-xs text-[#666666]">Platform analysis and Reddit Answers AI visibility</p>
                  </div>
                </div>
                <ChevronDown className={`w-5 h-5 text-[#666666] transition-transform ${expandedSections.readoutSocial ? 'rotate-180' : ''}`} />
              </button>
              {expandedSections.readoutSocial && (
                <div className="border-t border-[#E8E6E1] p-4 space-y-4 bg-[#FAFAF9]">
                  {assessments.social?.redditAnswersContent && (
                    <div>
                      <h5 className="text-sm font-medium text-[#8B5CF6] mb-2">Reddit Answers (AI Search Visibility)</h5>
                      <div className="bg-white rounded-lg p-4 max-h-64 overflow-y-auto">
                        <pre className="text-sm text-[#333333] whitespace-pre-wrap font-sans">{assessments.social.redditAnswersContent}</pre>
                      </div>
                    </div>
                  )}
                  {assessments.social?.content && (
                    <div>
                      <h5 className="text-sm font-medium text-[#8B5CF6] mb-2">Full Social Media Analysis</h5>
                      <div className="bg-white rounded-lg p-4 max-h-64 overflow-y-auto">
                        <pre className="text-sm text-[#333333] whitespace-pre-wrap font-sans">{assessments.social.content}</pre>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* AI Reputation Assessment Readout */}
            <div className="card overflow-hidden">
              <button 
                onClick={() => toggleSection('readoutAI')} 
                className="w-full flex items-center justify-between p-4 hover:bg-[#F8F7F5] transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-[#3B82F6]/10 rounded-lg flex items-center justify-center">
                    <Bot className="w-5 h-5 text-[#3B82F6]" />
                  </div>
                  <div className="text-left">
                    <h4 className="font-medium text-[#1A1A1A]">AI Reputation Assessment</h4>
                    <p className="text-xs text-[#666666]">Claude, Gemini, ChatGPT perception synthesis</p>
                  </div>
                </div>
                <ChevronDown className={`w-5 h-5 text-[#666666] transition-transform ${expandedSections.readoutAI ? 'rotate-180' : ''}`} />
              </button>
              {expandedSections.readoutAI && (
                <div className="border-t border-[#E8E6E1] p-4 space-y-4 bg-[#FAFAF9]">
                  {assessments.aiReputation?.claudeManual && (
                    <div>
                      <h5 className="text-sm font-medium text-[#3B82F6] mb-2">Claude Response</h5>
                      <div className="bg-white rounded-lg p-4 max-h-48 overflow-y-auto">
                        <pre className="text-sm text-[#333333] whitespace-pre-wrap font-sans">{assessments.aiReputation.claudeManual}</pre>
                      </div>
                    </div>
                  )}
                  {assessments.aiReputation?.geminiManual && (
                    <div>
                      <h5 className="text-sm font-medium text-[#3B82F6] mb-2">Gemini Response</h5>
                      <div className="bg-white rounded-lg p-4 max-h-48 overflow-y-auto">
                        <pre className="text-sm text-[#333333] whitespace-pre-wrap font-sans">{assessments.aiReputation.geminiManual}</pre>
                      </div>
                    </div>
                  )}
                  {assessments.aiReputation?.chatgptManual && (
                    <div>
                      <h5 className="text-sm font-medium text-[#3B82F6] mb-2">ChatGPT Response</h5>
                      <div className="bg-white rounded-lg p-4 max-h-48 overflow-y-auto">
                        <pre className="text-sm text-[#333333] whitespace-pre-wrap font-sans">{assessments.aiReputation.chatgptManual}</pre>
                      </div>
                    </div>
                  )}
                  {assessments.aiReputation?.content && (
                    <div>
                      <h5 className="text-sm font-medium text-[#3B82F6] mb-2">AI Reputation Synthesis</h5>
                      <div className="bg-white rounded-lg p-4 max-h-64 overflow-y-auto">
                        <pre className="text-sm text-[#333333] whitespace-pre-wrap font-sans">{assessments.aiReputation.content}</pre>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Earned Media Assessment Readout */}
            <div className="card overflow-hidden">
              <button 
                onClick={() => toggleSection('readoutEarned')} 
                className="w-full flex items-center justify-between p-4 hover:bg-[#F8F7F5] transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-[#10B981]/10 rounded-lg flex items-center justify-center">
                    <Newspaper className="w-5 h-5 text-[#10B981]" />
                  </div>
                  <div className="text-left">
                    <h4 className="font-medium text-[#1A1A1A]">Earned Media Assessment</h4>
                    <p className="text-xs text-[#666666]">Auto-assess performance and coverage analysis</p>
                  </div>
                </div>
                <ChevronDown className={`w-5 h-5 text-[#666666] transition-transform ${expandedSections.readoutEarned ? 'rotate-180' : ''}`} />
              </button>
              {expandedSections.readoutEarned && (
                <div className="border-t border-[#E8E6E1] p-4 space-y-4 bg-[#FAFAF9]">
                  {assessments.earnedMedia?.autoAssessContent && (
                    <div>
                      <h5 className="text-sm font-medium text-[#10B981] mb-2">Auto-Assess Earned Media Performance</h5>
                      <div className="bg-white rounded-lg p-4 max-h-64 overflow-y-auto">
                        <pre className="text-sm text-[#333333] whitespace-pre-wrap font-sans">{assessments.earnedMedia.autoAssessContent}</pre>
                      </div>
                    </div>
                  )}
                  {assessments.earnedMedia?.content && (
                    <div>
                      <h5 className="text-sm font-medium text-[#10B981] mb-2">Full Earned Media Analysis</h5>
                      <div className="bg-white rounded-lg p-4 max-h-64 overflow-y-auto">
                        <pre className="text-sm text-[#333333] whitespace-pre-wrap font-sans">{assessments.earnedMedia.content}</pre>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
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
function CompassResultsPage({ results, onDelete, onBack, onAddManual, onUpdateResults, profile, user }) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [expandedRows, setExpandedRows] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterIndustry, setFilterIndustry] = useState('all');
  const [filterMaturity, setFilterMaturity] = useState('all');
  const [filterBusinessModel, setFilterBusinessModel] = useState('all');
  const [manualEntry, setManualEntry] = useState({
    brandName: '',
    businessModel: 'b2b',
    industry: 'other',
    totalScore: 50,
    scores: { AWAKE: 50, AWARE: 50, REFLECTIVE: 50, ATTENTIVE: 50, COGENT: 50, SENTIENT: 50, VISIONARY: 50, INTENTIONAL: 50 },
  });

  // Filter results based on search and filters
  const filteredResults = useMemo(() => {
    return results.filter(r => {
      // Search filter
      if (searchTerm && !r.brandName?.toLowerCase().includes(searchTerm.toLowerCase())) {
        return false;
      }
      // Industry filter
      if (filterIndustry !== 'all' && r.industry !== filterIndustry) {
        return false;
      }
      // Maturity filter
      if (filterMaturity !== 'all' && r.maturityLevel !== filterMaturity) {
        return false;
      }
      // Business model filter
      if (filterBusinessModel !== 'all' && r.businessModel !== filterBusinessModel) {
        return false;
      }
      return true;
    });
  }, [results, searchTerm, filterIndustry, filterMaturity, filterBusinessModel]);

  // Get unique values for filter dropdowns
  const uniqueIndustries = useMemo(() => {
    const industries = [...new Set(results.map(r => r.industry).filter(Boolean))];
    return industries.sort();
  }, [results]);

  const uniqueMaturityLevels = useMemo(() => {
    const levels = [...new Set(results.map(r => r.maturityLevel).filter(Boolean))];
    return MATURITY_STAGES.filter(s => levels.includes(s.name)).map(s => s.name);
  }, [results]);

  const clearFilters = () => {
    setSearchTerm('');
    setFilterIndustry('all');
    setFilterMaturity('all');
    setFilterBusinessModel('all');
  };

  const hasActiveFilters = searchTerm || filterIndustry !== 'all' || filterMaturity !== 'all' || filterBusinessModel !== 'all';

  const toggleRow = (id) => {
    setExpandedRows(prev => prev.includes(id) ? prev.filter(r => r !== id) : [...prev, id]);
  };

  const industries = INDUSTRIES;

  const handleExportCSV = () => {
    if (results.length === 0) {
      alert('No results to export');
      return;
    }
    
    const headers = ['Brand Name', 'Business Model', 'Industry', 'Total Score', 'Maturity Level', 
      'AWAKE', 'AWARE', 'REFLECTIVE', 'ATTENTIVE', 'COGENT', 'SENTIENT', 'VISIONARY', 'INTENTIONAL',
      'Assessor', 'Date', 'Rubric Version', 'Manual Entry'];
    
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
      r.assessorName || 'Paul Newton',
      r.savedAt ? new Date(r.savedAt).toLocaleDateString() : '',
      r.rubricVersion || '2.3',
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

  const handleAddManual = async () => {
    if (!manualEntry.brandName.trim()) {
      alert('Please enter a brand name');
      return;
    }
    
    const stage = getMaturityStage(manualEntry.totalScore);
    
    const newResult = {
      brandName: manualEntry.brandName,
      businessModel: manualEntry.businessModel,
      industry: manualEntry.industry,
      totalScore: manualEntry.totalScore,
      maturityLevel: stage.name,
      scores: { ...manualEntry.scores },
      servicesRecommended: [],
      isManual: true,
      assessorName: profile?.full_name || user?.email?.split('@')[0] || 'Unknown',
      rubricVersion: FRAMEWORK_VERSION,
    };
    
    // Save to Supabase
    await saveCompassResult(newResult);
    
    // Reload results will be handled by parent
    onUpdateResults(null); // Signal to reload
    setShowAddModal(false);
    setManualEntry({
      brandName: '',
      businessModel: 'b2b',
      industry: 'other',
      totalScore: 50,
      scores: { AWAKE: 50, AWARE: 50, REFLECTIVE: 50, ATTENTIVE: 50, COGENT: 50, SENTIENT: 50, VISIONARY: 50, INTENTIONAL: 50 },
    });
  };

  const handleDelete = async (id) => {
    if (confirm('Delete this result?')) {
      await deleteCompassResult(id);
      onUpdateResults(null); // Signal to reload
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F4F0]">
      <div className="max-w-7xl mx-auto p-4 md:p-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 md:mb-8 gap-4">
          <div className="flex items-center gap-4">
            <button onClick={onBack} className="btn-secondary flex items-center gap-2">
              <ArrowLeft className="w-4 h-4" /> Back
            </button>
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-[#1A1A1A]">Compass Results</h1>
              <span className="text-sm text-[#666666]">{results.length} assessments</span>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {profile?.is_admin && (
              <button onClick={() => setShowAddModal(true)} className="btn-secondary flex items-center gap-2">
                <Plus className="w-4 h-4" /> Add Manual Entry
              </button>
            )}
            <button onClick={handleExportCSV} disabled={results.length === 0} className="btn-primary flex items-center gap-2">
              <Download className="w-4 h-4" /> Export CSV
            </button>
          </div>
        </div>

        {/* Search and Filters */}
        {results.length > 0 && (
          <div className="card p-4 mb-6">
            <div className="flex flex-wrap items-center gap-3">
              {/* Search */}
              <div className="relative flex-1 min-w-[200px]">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#999999]" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search brands..."
                  className="w-full pl-9 pr-4 py-2 border border-[#D9D6D0] rounded-lg bg-white text-sm"
                />
              </div>

              {/* Industry Filter */}
              <select
                value={filterIndustry}
                onChange={(e) => setFilterIndustry(e.target.value)}
                className="px-3 py-2 border border-[#D9D6D0] rounded-lg bg-white text-sm"
              >
                <option value="all">All Industries</option>
                {uniqueIndustries.map(ind => (
                  <option key={ind} value={ind}>{ind}</option>
                ))}
              </select>

              {/* Maturity Filter */}
              <select
                value={filterMaturity}
                onChange={(e) => setFilterMaturity(e.target.value)}
                className="px-3 py-2 border border-[#D9D6D0] rounded-lg bg-white text-sm"
              >
                <option value="all">All Maturity Levels</option>
                {uniqueMaturityLevels.map(level => (
                  <option key={level} value={level}>{level}</option>
                ))}
              </select>

              {/* Business Model Filter */}
              <select
                value={filterBusinessModel}
                onChange={(e) => setFilterBusinessModel(e.target.value)}
                className="px-3 py-2 border border-[#D9D6D0] rounded-lg bg-white text-sm"
              >
                <option value="all">All Models</option>
                <option value="b2b">B2B</option>
                <option value="b2c">B2C</option>
                <option value="both">Both</option>
              </select>

              {/* Clear Filters */}
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="px-3 py-2 text-sm text-[#E53935] hover:bg-[#E53935]/10 rounded-lg transition-colors flex items-center gap-1"
                >
                  <X className="w-4 h-4" /> Clear
                </button>
              )}
            </div>

            {/* Results count */}
            {hasActiveFilters && (
              <div className="mt-3 text-sm text-[#666666]">
                Showing {filteredResults.length} of {results.length} results
              </div>
            )}
          </div>
        )}

        {results.length === 0 ? (
          <div className="card p-12 text-center">
            <BarChart3 className="w-16 h-16 text-[#D9D6D0] mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-[#1A1A1A] mb-2">No Results Yet</h3>
            <p className="text-[#666666] mb-4">Complete and save assessments to see them here{profile?.is_admin ? ', or add manual entries' : ''}.</p>
            {profile?.is_admin && (
              <button onClick={() => setShowAddModal(true)} className="btn-primary">
                Add Manual Entry
              </button>
            )}
          </div>
        ) : filteredResults.length === 0 ? (
          <div className="card p-12 text-center">
            <Search className="w-16 h-16 text-[#D9D6D0] mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-[#1A1A1A] mb-2">No Matching Results</h3>
            <p className="text-[#666666] mb-4">Try adjusting your search or filters.</p>
            <button onClick={clearFilters} className="btn-secondary">
              Clear Filters
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredResults.map((r, i) => {
              const stage = MATURITY_STAGES.find(s => s.name === r.maturityLevel) || MATURITY_STAGES[0];
              const isExpanded = expandedRows.includes(r.id || i);
              const assessmentDate = r.savedAt ? new Date(r.savedAt) : null;
              return (
                <div key={r.id || i} className="card overflow-hidden">
                  {/* Main Row */}
                  <div 
                    className="flex items-center gap-4 p-4 cursor-pointer hover:bg-[#F8F7F5] transition-colors"
                    onClick={() => toggleRow(r.id || i)}
                  >
                    {/* Brand & Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-[#1A1A1A] truncate">{r.brandName}</span>
                        {r.isManual && (
                          <span className="text-[10px] px-1.5 py-0.5 bg-yellow-100 text-yellow-700 rounded">Manual</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-[#666666] mt-0.5">
                        <span>{r.businessModel?.toUpperCase()}</span>
                        <span>•</span>
                        <span className="truncate">{r.industry}</span>
                        <span>•</span>
                        <span>v{r.rubricVersion || '2.3'}</span>
                      </div>
                    </div>
                    
                    {/* Date Badge */}
                    {assessmentDate && (
                      <div className="text-center px-2">
                        <div className="text-xs font-medium text-[#666666]">
                          {assessmentDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </div>
                        <div className="text-[10px] text-[#999999]">
                          {assessmentDate.getFullYear()}
                        </div>
                      </div>
                    )}
                    
                    {/* Score Badge */}
                    <div className="flex items-center gap-3">
                      <div className="text-center">
                        <div className="text-2xl font-bold" style={{ color: stage.color }}>{r.totalScore}</div>
                        <div className="text-[10px] px-2 py-0.5 rounded-full" style={{ backgroundColor: `${stage.color}15`, color: stage.color }}>
                          {r.maturityLevel}
                        </div>
                      </div>
                    </div>
                    
                    {/* Expand Icon */}
                    <ChevronDown className={`w-4 h-4 text-[#666666] transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                  </div>
                  
                  {/* Expanded Details */}
                  {isExpanded && (
                    <div className="border-t border-[#E8E6E1] bg-[#F8F7F5] p-4 animate-fade-in">
                      <div className="flex flex-col md:flex-row gap-4 mb-4">
                        {/* Mini Spider Chart */}
                        <div className="flex-shrink-0 flex justify-center md:justify-start">
                          <MiniSpiderChart scores={r.scores} size={120} />
                        </div>
                        {/* Attribute Scores Grid */}
                        <div className="flex-1">
                          <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                            {ATTRIBUTES.map(attr => (
                              <div key={attr.id} className="text-center p-2 bg-white rounded-lg">
                                <div className="text-lg font-bold" style={{ color: attr.color }}>{r.scores?.[attr.id] || 0}</div>
                                <div className="text-[10px] text-[#666666] truncate">{attr.name}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                      
                      {/* Meta Info */}
                      <div className="flex flex-wrap items-center gap-4 text-xs text-[#666666]">
                        <span><strong>Assessor:</strong> {r.assessorName || 'Unknown'}</span>
                        <span><strong>Full Date:</strong> {r.savedAt ? new Date(r.savedAt).toLocaleString() : '-'}</span>
                        {profile?.is_admin && (
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleDelete(r.id); }} 
                            className="text-red-500 hover:text-red-700 flex items-center gap-1 ml-auto"
                          >
                            <Trash2 className="w-3.5 h-3.5" /> Delete
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
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

// Portfolio Insights View Component
function InsightsView({ results, industryBenchmarks, industries }) {
  const [aiInsights, setAiInsights] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Calculate portfolio-wide statistics
  const portfolioStats = useMemo(() => {
    if (results.length === 0) return null;
    
    const totalBrands = results.length;
    const avgScore = Math.round(results.reduce((sum, r) => sum + r.totalScore, 0) / totalBrands);
    
    // Distribution by maturity
    const maturityDistribution = {};
    results.forEach(r => {
      const stage = r.maturityLevel || 'Unknown';
      maturityDistribution[stage] = (maturityDistribution[stage] || 0) + 1;
    });
    
    // Attribute averages
    const attrAverages = {};
    ATTRIBUTES.forEach(attr => {
      const sum = results.reduce((s, r) => s + (r.scores?.[attr.id] || 0), 0);
      attrAverages[attr.id] = Math.round(sum / totalBrands);
    });
    
    // Find strongest and weakest attributes
    const sortedAttrs = Object.entries(attrAverages).sort((a, b) => b[1] - a[1]);
    const strongestAttr = sortedAttrs[0];
    const weakestAttr = sortedAttrs[sortedAttrs.length - 1];
    
    // Top and bottom performers
    const sortedBrands = [...results].sort((a, b) => b.totalScore - a.totalScore);
    const topPerformers = sortedBrands.slice(0, 3);
    const bottomPerformers = sortedBrands.slice(-3).reverse();
    
    // Industry breakdown
    const industryBreakdown = {};
    results.forEach(r => {
      const ind = r.industry || 'other';
      if (!industryBreakdown[ind]) {
        industryBreakdown[ind] = { count: 0, totalScore: 0 };
      }
      industryBreakdown[ind].count++;
      industryBreakdown[ind].totalScore += r.totalScore;
    });
    Object.keys(industryBreakdown).forEach(ind => {
      industryBreakdown[ind].avgScore = Math.round(industryBreakdown[ind].totalScore / industryBreakdown[ind].count);
    });
    
    // Score distribution (for histogram)
    const scoreDistribution = [
      { range: '0-25', label: 'Pre-Foundational', count: results.filter(r => r.totalScore <= 25).length, color: '#94A3B8' },
      { range: '26-39', label: 'Foundational', count: results.filter(r => r.totalScore > 25 && r.totalScore <= 39).length, color: '#F59E0B' },
      { range: '40-55', label: 'Establishing', count: results.filter(r => r.totalScore > 39 && r.totalScore <= 55).length, color: '#D97706' },
      { range: '56-69', label: 'Differentiating', count: results.filter(r => r.totalScore > 55 && r.totalScore <= 69).length, color: '#059669' },
      { range: '70-84', label: 'Leading', count: results.filter(r => r.totalScore > 69 && r.totalScore <= 84).length, color: '#0D9488' },
      { range: '85-100', label: 'Transforming', count: results.filter(r => r.totalScore > 84).length, color: '#6366F1' },
    ];
    
    return {
      totalBrands,
      avgScore,
      maturityDistribution,
      attrAverages,
      strongestAttr,
      weakestAttr,
      topPerformers,
      bottomPerformers,
      industryBreakdown,
      scoreDistribution,
    };
  }, [results]);

  const generateInsights = async () => {
    const apiKey = localStorage.getItem('conscious-compass-apikey');
    if (!apiKey) {
      setError('Please add your API key in the Setup page to generate AI insights.');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    // Build sector-specific data
    const sectorData = {};
    results.forEach(r => {
      const sector = r.industry || 'other';
      if (!sectorData[sector]) {
        sectorData[sector] = { brands: [], scores: [], attrTotals: {} };
        ATTRIBUTES.forEach(a => sectorData[sector].attrTotals[a.id] = 0);
      }
      sectorData[sector].brands.push(r.brandName);
      sectorData[sector].scores.push(r.totalScore);
      ATTRIBUTES.forEach(a => {
        sectorData[sector].attrTotals[a.id] += (r.scores?.[a.id] || 0);
      });
    });
    
    const sectorSummaries = Object.entries(sectorData).map(([sector, data]) => {
      const avgScore = Math.round(data.scores.reduce((a, b) => a + b, 0) / data.scores.length);
      const attrAvgs = {};
      ATTRIBUTES.forEach(a => {
        attrAvgs[a.id] = Math.round(data.attrTotals[a.id] / data.brands.length);
      });
      const sortedAttrs = Object.entries(attrAvgs).sort((a, b) => b[1] - a[1]);
      return {
        sector,
        brandCount: data.brands.length,
        avgScore,
        strongestAttr: sortedAttrs[0],
        weakestAttr: sortedAttrs[sortedAttrs.length - 1],
        brands: data.brands,
      };
    });
    
    try {
      const prompt = `You are analyzing Brand Consciousness assessment data to identify thought leadership opportunities and storytelling angles. Brand Consciousness is a framework with 8 attributes that transform fragmented marketing into synchronized strategy for "consequential brands" in the Age of Adoption.

THE 8 ATTRIBUTES OF BRAND CONSCIOUSNESS:
- AWAKE: Influence & Narrative Leadership - shaping industry conversations through thought leadership
- AWARE: Trust Building & Audience Understanding - building authentic connections through listening
- REFLECTIVE: Authenticity & Reputation Management - grounded in clear brand strategy
- ATTENTIVE: Experience Quality & Excellence - prioritizing quality at every touchpoint
- COGENT: Strategic Intelligence & Data-Driven Marketing - transforming data into measurable action
- SENTIENT: Creative Differentiation & Emotional Connection - forging emotional resonance
- VISIONARY: Future Vision & Audience Benefit - inspiring perspectives that shape industry
- INTENTIONAL: Credibility & Organizational Confidence - confident, substantive interactions

PORTFOLIO DATA (${results.length} brands assessed):
- Overall Average Score: ${portfolioStats.avgScore}/100
- Maturity Distribution: ${JSON.stringify(portfolioStats.maturityDistribution)}

ATTRIBUTE AVERAGES ACROSS ALL BRANDS:
${Object.entries(portfolioStats.attrAverages).map(([k, v]) => `- ${k}: ${v}/100`).join('\n')}

SECTOR-BY-SECTOR BREAKDOWN:
${sectorSummaries.map(s => `
${s.sector.toUpperCase()} (${s.brandCount} brand${s.brandCount > 1 ? 's' : ''}):
  - Average Score: ${s.avgScore}
  - Strongest: ${s.strongestAttr[0]} (${s.strongestAttr[1]})
  - Weakest: ${s.weakestAttr[0]} (${s.weakestAttr[1]})
  - Brands: ${s.brands.join(', ')}`).join('\n')}

TOP PERFORMERS:
${portfolioStats.topPerformers.map(b => `- ${b.brandName} (${b.industry}): ${b.totalScore} - ${b.maturityLevel}`).join('\n')}

BRANDS WITH GROWTH POTENTIAL:
${portfolioStats.bottomPerformers.map(b => `- ${b.brandName} (${b.industry}): ${b.totalScore} - ${b.maturityLevel}`).join('\n')}

Based on this data, provide thought leadership insights in this JSON format:
{
  "narrativeHeadline": "A compelling headline that captures the main story this data tells (max 12 words)",
  "executiveSummary": "2-3 sentences describing the overall state of brand consciousness across these sectors - what's the big picture story?",
  "sectorStories": [
    {
      "sector": "sector name",
      "narrative": "2-3 sentences telling the story of this sector - where are brands excelling, where are they struggling, what does this mean for the industry?",
      "consciousnessGap": "Which consciousness attribute represents the biggest opportunity and why?",
      "thoughtLeadershipAngle": "A specific thought leadership theme or article topic that could resonate with this sector"
    }
  ],
  "crossSectorPatterns": [
    {
      "pattern": "Name of the pattern observed",
      "insight": "2 sentences explaining this pattern across multiple sectors and its implications"
    }
  ],
  "consciousnessOpportunities": [
    {
      "attribute": "ATTRIBUTE_NAME",
      "observation": "What the data shows about this attribute across the portfolio",
      "whyItMatters": "Why this matters in the Age of Adoption / for consequential brands"
    }
  ],
  "thoughtLeadershipThemes": [
    "Theme 1: A potential article or POV topic based on the data",
    "Theme 2: Another angle for thought leadership content",
    "Theme 3: A third perspective worth exploring"
  ]
}`;

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 2500,
          temperature: 0,
          messages: [{ role: 'user', content: prompt }],
        }),
      });

      if (!response.ok) throw new Error('API request failed');
      
      const data = await response.json();
      const text = data.content[0].text;
      
      // Parse JSON from response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        setAiInsights(JSON.parse(jsonMatch[0]));
      }
    } catch (err) {
      setError('Failed to generate insights. Please try again.');
      console.error(err);
    }
    
    setLoading(false);
  };

  if (!portfolioStats) {
    return (
      <div className="card p-12 text-center">
        <TrendingUp className="w-16 h-16 text-[#D9D6D0] mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-[#1A1A1A] mb-2">No Data for Insights</h3>
        <p className="text-[#666666]">Add some brand assessments to see portfolio insights.</p>
      </div>
    );
  }

  const maxCount = Math.max(...portfolioStats.scoreDistribution.map(d => d.count), 1);

  return (
    <div className="space-y-6">
      {/* Portfolio Overview Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card p-5 text-center">
          <div className="text-4xl font-bold text-[#1A1A1A] mb-1">{portfolioStats.totalBrands}</div>
          <div className="text-sm text-[#666666]">Brands Assessed</div>
        </div>
        <div className="card p-5 text-center">
          <div className="text-4xl font-bold mb-1" style={{ color: getMaturityStage(portfolioStats.avgScore).color }}>
            {portfolioStats.avgScore}
          </div>
          <div className="text-sm text-[#666666]">Portfolio Average</div>
        </div>
        <div className="card p-5 text-center">
          <div className="text-lg font-bold text-[#059669] mb-1 flex items-center justify-center gap-1">
            <TrendingUp className="w-5 h-5" />
            {ATTRIBUTES.find(a => a.id === portfolioStats.strongestAttr[0])?.name}
          </div>
          <div className="text-sm text-[#666666]">Strongest Area ({portfolioStats.strongestAttr[1]})</div>
        </div>
        <div className="card p-5 text-center">
          <div className="text-lg font-bold text-[#F59E0B] mb-1 flex items-center justify-center gap-1">
            <TrendingDown className="w-5 h-5" />
            {ATTRIBUTES.find(a => a.id === portfolioStats.weakestAttr[0])?.name}
          </div>
          <div className="text-sm text-[#666666]">Growth Opportunity ({portfolioStats.weakestAttr[1]})</div>
        </div>
      </div>

      {/* Score Distribution Visualization */}
      <div className="card p-6">
        <h3 className="text-sm font-medium text-[#1A1A1A] mb-3">Portfolio Maturity Distribution</h3>
        <div className="flex items-end gap-3 mb-4" style={{ height: '160px' }}>
          {portfolioStats.scoreDistribution.map((bucket, idx) => {
            const barHeight = bucket.count > 0 ? Math.max((bucket.count / maxCount) * 140, 16) : 8;
            return (
              <div key={idx} className="flex-1 flex flex-col items-center justify-end h-full">
                <div className="text-sm font-medium text-[#1A1A1A] mb-2">{bucket.count}</div>
                <div 
                  className="w-full rounded-t-lg transition-all duration-500"
                  style={{ 
                    backgroundColor: bucket.color,
                    height: `${barHeight}px`,
                    opacity: bucket.count > 0 ? 1 : 0.3
                  }}
                />
              </div>
            );
          })}
        </div>
        <div className="flex gap-3">
          {portfolioStats.scoreDistribution.map((bucket, idx) => (
            <div key={idx} className="flex-1 text-center">
              <div className="text-xs text-[#666666]">{bucket.label}</div>
              <div className="text-[10px] text-[#999999]">{bucket.range}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Attribute Radar / Bar Chart */}
      <div className="card p-6">
        <h3 className="text-sm font-medium text-[#1A1A1A] mb-3">Attribute Performance Overview</h3>
        <div className="space-y-3">
          {ATTRIBUTES.map(attr => {
            const score = portfolioStats.attrAverages[attr.id];
            return (
              <div key={attr.id} className="flex items-center gap-3">
                <div className="w-24 text-sm text-[#666666] flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: attr.color }} />
                  {attr.name}
                </div>
                <div className="flex-1 h-6 bg-[#F0EEEA] rounded-full overflow-hidden">
                  <div 
                    className="h-full rounded-full transition-all duration-700 flex items-center justify-end pr-2"
                    style={{ 
                      width: `${score}%`, 
                      backgroundColor: attr.color,
                    }}
                  >
                    <span className="text-xs font-medium text-white">{score}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Top & Bottom Performers */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="card p-6">
          <h3 className="text-sm font-medium text-[#1A1A1A] mb-3 flex items-center gap-2">
            <Star className="w-5 h-5 text-[#F59E0B]" /> Top Performers
          </h3>
          <div className="space-y-3">
            {portfolioStats.topPerformers.map((brand, idx) => (
              <div key={brand.id || idx} className="flex items-center justify-between p-3 bg-[#F0EEEA] rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#059669] text-white flex items-center justify-center font-bold text-sm">
                    {idx + 1}
                  </div>
                  <div>
                    <div className="font-medium text-[#1A1A1A]">{brand.brandName}</div>
                    <div className="text-xs text-[#666666]">{brand.maturityLevel}</div>
                  </div>
                </div>
                <div className="text-xl font-bold" style={{ color: getMaturityStage(brand.totalScore).color }}>
                  {brand.totalScore}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card p-6">
          <h3 className="text-sm font-medium text-[#1A1A1A] mb-3 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-[#F59E0B]" /> Growth Opportunities
          </h3>
          <div className="space-y-3">
            {portfolioStats.bottomPerformers.map((brand, idx) => (
              <div key={brand.id || idx} className="flex items-center justify-between p-3 bg-[#F0EEEA] rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#F59E0B] text-white flex items-center justify-center">
                    <TrendingUp className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-medium text-[#1A1A1A]">{brand.brandName}</div>
                    <div className="text-xs text-[#666666]">{brand.maturityLevel}</div>
                  </div>
                </div>
                <div className="text-xl font-bold" style={{ color: getMaturityStage(brand.totalScore).color }}>
                  {brand.totalScore}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* AI Insights Section */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-[#1A1A1A] flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-[#6366F1]" /> AI-Powered Insights
          </h3>
          <button
            onClick={generateInsights}
            disabled={loading}
            className="btn-primary flex items-center gap-2 text-sm"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {loading ? 'Analyzing...' : aiInsights ? 'Refresh Insights' : 'Generate Insights'}
          </button>
        </div>

        {error && (
          <div className="p-4 bg-red-50 text-red-700 rounded-lg mb-4">
            {error}
          </div>
        )}

        {!aiInsights && !loading && !error && (
          <div className="text-center py-8 text-[#666666]">
            <Sparkles className="w-12 h-12 mx-auto mb-3 text-[#D9D6D0]" />
            <p>Click "Generate Insights" to get AI-powered analysis of your portfolio trends,<br/>opportunities, and strategic recommendations.</p>
          </div>
        )}

        {aiInsights && (
          <div className="space-y-6">
            {/* Narrative Headline & Summary */}
            <div className="p-5 bg-gradient-to-r from-[#6366F1]/10 to-[#A78BFA]/10 rounded-xl border border-[#6366F1]/20">
              <h4 className="text-xl font-bold text-[#1A1A1A] mb-2">{aiInsights.narrativeHeadline}</h4>
              <p className="text-[#666666]">{aiInsights.executiveSummary}</p>
            </div>

            {/* Sector Stories */}
            {aiInsights.sectorStories?.length > 0 && (
              <div>
                <h4 className="font-semibold text-[#1A1A1A] mb-4 flex items-center gap-2">
                  <Globe className="w-5 h-5 text-[#059669]" /> Sector Stories
                </h4>
                <div className="space-y-4">
                  {aiInsights.sectorStories.map((story, idx) => (
                    <div key={idx} className="card p-5 border-l-4 border-[#059669]">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-sm font-bold text-[#059669] uppercase tracking-wide">{story.sector}</span>
                      </div>
                      <p className="text-sm text-[#1A1A1A] mb-3">{story.narrative}</p>
                      <div className="grid md:grid-cols-2 gap-3 text-xs">
                        <div className="p-3 bg-[#F0EEEA] rounded-lg">
                          <div className="font-medium text-[#666666] mb-1">Consciousness Gap</div>
                          <div className="text-[#1A1A1A]">{story.consciousnessGap}</div>
                        </div>
                        <div className="p-3 bg-[#E8FF00]/20 rounded-lg">
                          <div className="font-medium text-[#666666] mb-1">💡 Thought Leadership Angle</div>
                          <div className="text-[#1A1A1A] font-medium">{story.thoughtLeadershipAngle}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Cross-Sector Patterns */}
            {aiInsights.crossSectorPatterns?.length > 0 && (
              <div>
                <h4 className="font-semibold text-[#1A1A1A] mb-4 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-[#6366F1]" /> Cross-Sector Patterns
                </h4>
                <div className="grid md:grid-cols-2 gap-4">
                  {aiInsights.crossSectorPatterns.map((pattern, idx) => (
                    <div key={idx} className="p-4 bg-[#6366F1]/5 rounded-lg border border-[#6366F1]/20">
                      <div className="font-medium text-[#6366F1] text-sm mb-2">{pattern.pattern}</div>
                      <div className="text-xs text-[#666666]">{pattern.insight}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Consciousness Opportunities */}
            {aiInsights.consciousnessOpportunities?.length > 0 && (
              <div>
                <h4 className="font-semibold text-[#1A1A1A] mb-4 flex items-center gap-2">
                  <Compass className="w-5 h-5 text-[#F59E0B]" /> Consciousness Opportunities
                </h4>
                <div className="space-y-3">
                  {aiInsights.consciousnessOpportunities.map((opp, idx) => {
                    const attr = ATTRIBUTES.find(a => a.id === opp.attribute);
                    return (
                      <div key={idx} className="flex gap-4 p-4 bg-white rounded-lg border border-[#E8E6E1]">
                        <div 
                          className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 text-white font-bold"
                          style={{ backgroundColor: attr?.color || '#666' }}
                        >
                          {opp.attribute?.substring(0, 3)}
                        </div>
                        <div className="flex-1">
                          <div className="font-medium text-[#1A1A1A] text-sm">{attr?.name || opp.attribute}</div>
                          <div className="text-xs text-[#666666] mt-1">{opp.observation}</div>
                          <div className="text-xs text-[#059669] mt-2 font-medium">↳ {opp.whyItMatters}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Thought Leadership Themes */}
            {aiInsights.thoughtLeadershipThemes?.length > 0 && (
              <div className="p-5 bg-[#1A1A1A] rounded-xl text-white">
                <h4 className="font-semibold mb-4 flex items-center gap-2">
                  <Lightbulb className="w-5 h-5 text-[#E8FF00]" /> Thought Leadership Themes
                </h4>
                <div className="space-y-3">
                  {aiInsights.thoughtLeadershipThemes.map((theme, idx) => (
                    <div key={idx} className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-[#E8FF00] text-[#1A1A1A] flex items-center justify-center flex-shrink-0 text-sm font-bold">
                        {idx + 1}
                      </div>
                      <div className="text-sm text-[#E8E6E1]">{theme}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
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
  const [chartType, setChartType] = useState('radar'); // 'radar' or 'bars'
  const [showIndustryAvg, setShowIndustryAvg] = useState(false);
  const maxComparison = 6;
  const maxRadar = 4;

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
          <button
            onClick={() => setViewMode('insights')}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              viewMode === 'insights' 
                ? 'bg-[#1A1A1A] text-white' 
                : 'bg-white border border-[#D9D6D0] text-[#666666] hover:border-[#1A1A1A]'
            }`}
          >
            ✨ Insights
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
                  <h3 className="text-sm font-medium text-[#1A1A1A] mb-3">Industry Average Scores</h3>
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
                  <h3 className="text-sm font-medium text-[#1A1A1A] mb-3">Attribute Comparison by Industry</h3>
                  
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
        ) : viewMode === 'insights' ? (
          /* AI Insights View */
          <InsightsView results={results} industryBenchmarks={industryBenchmarks} industries={industries} />
        ) : (
          /* Brand Comparison View */
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Brand Selection with Filters */}
            <div className="lg:col-span-1 space-y-4">
              {/* Filters */}
              <div className="card p-4">
                <h3 className="text-sm font-medium text-[#1A1A1A] mb-2">Filters</h3>
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
                <h3 className="text-sm font-medium text-[#1A1A1A] mb-3">
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
                  <div className="card p-4 md:p-6">
                    <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                      <h3 className="text-sm font-medium text-[#1A1A1A]">Overall Scores</h3>
                      {/* Chart type toggle — only show if ≤ maxRadar brands */}
                      {selectedBrands.length <= maxRadar && (
                        <div className="flex gap-1 text-xs">
                          <button
                            onClick={() => setChartType('radar')}
                            className={`px-3 py-1.5 rounded-lg transition-colors ${chartType === 'radar' ? 'bg-[#1A1A1A] text-white' : 'bg-[#F0EEEA] text-[#666666] hover:bg-[#E8E6E1]'}`}
                          >
                            Radar
                          </button>
                          <button
                            onClick={() => setChartType('bars')}
                            className={`px-3 py-1.5 rounded-lg transition-colors ${chartType === 'bars' ? 'bg-[#1A1A1A] text-white' : 'bg-[#F0EEEA] text-[#666666] hover:bg-[#E8E6E1]'}`}
                          >
                            Bars
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-wrap justify-center gap-4 mb-4">
                      {selectedBrands.map((brand, bi) => {
                        const stage = MATURITY_STAGES.find(s => s.name === brand.maturityLevel) || MATURITY_STAGES[0];
                        const color = selectedBrands.length <= maxRadar ? COMPARISON_COLORS[bi] : stage.color;
                        return (
                          <div key={brand.id} className="text-center">
                            <div 
                              className="w-14 h-14 md:w-18 md:h-18 rounded-full flex items-center justify-center mx-auto mb-2 text-white font-bold text-lg md:text-xl border-4"
                              style={{ backgroundColor: color, borderColor: color + '60', width: '64px', height: '64px' }}
                            >
                              {brand.totalScore}
                            </div>
                            <div className="font-medium text-xs text-[#1A1A1A] truncate max-w-[80px]">{brand.brandName}</div>
                            <div className="text-[10px] text-[#666666]">{brand.maturityLevel}</div>
                          </div>
                        );
                      })}
                      <div className="text-center border-l-2 border-[#D9D6D0] pl-4">
                        <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-2 text-white font-bold text-xl bg-[#1A1A1A]">
                          {Math.round(selectedBrands.reduce((sum, b) => sum + b.totalScore, 0) / selectedBrands.length)}
                        </div>
                        <div className="font-medium text-xs text-[#1A1A1A]">AVG</div>
                        <div className="text-[10px] text-[#666666]">{selectedBrands.length} brands</div>
                      </div>
                    </div>
                  </div>

                  {/* Radar Chart (when ≤ maxRadar brands selected and chartType is radar) */}
                  {selectedBrands.length <= maxRadar && chartType === 'radar' && (() => {
                    // Build industry average if available and toggle is on
                    const commonIndustry = selectedBrands.length >= 2 && selectedBrands.every(b => b.industry === selectedBrands[0].industry)
                      ? selectedBrands[0].industry : null;
                    const indBrands = commonIndustry ? results.filter(r => r.industry === commonIndustry) : [];
                    const indAvg = (showIndustryAvg && indBrands.length > 0) ? (() => {
                      const avg = {};
                      ATTRIBUTES.forEach(a => { avg[a.id] = Math.round(indBrands.reduce((sum, b) => sum + (b.scores?.[a.id] || 0), 0) / indBrands.length); });
                      return avg;
                    })() : null;

                    return (
                      <div className="card p-4 md:p-6">
                        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                          <h3 className="text-sm font-medium text-[#1A1A1A]">Radar Comparison</h3>
                          {commonIndustry && (
                            <button
                              onClick={() => setShowIndustryAvg(!showIndustryAvg)}
                              className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${showIndustryAvg ? 'bg-[#F0EEEA] border-[#9CA3AF] text-[#666666]' : 'border-[#D9D6D0] text-[#999999] hover:border-[#999999]'}`}
                            >
                              {showIndustryAvg ? '✓ ' : ''}Industry avg overlay
                            </button>
                          )}
                        </div>
                        <ComparisonSpiderChart brands={selectedBrands} size={300} industryAvg={indAvg} />
                      </div>
                    );
                  })()}

                  {/* Bar chart view (always shown when chartType === 'bars', or when > maxRadar brands) */}
                  {(chartType === 'bars' || selectedBrands.length > maxRadar) && (
                    <div className="card p-4 md:p-6">
                      <h3 className="text-sm font-medium text-[#1A1A1A] mb-3">Attribute Comparison</h3>
                      <div className="overflow-x-auto">
                        <div style={{ minWidth: `${Math.max(400, selectedBrands.length * 80 + 120)}px` }}>
                          {/* Brand labels header */}
                          <div className="flex items-center gap-2 mb-3 text-xs text-[#666666]">
                            <div className="w-24 flex-shrink-0"></div>
                            <div className="flex-1 flex gap-1">
                              {selectedBrands.map((brand, bi) => (
                                <div key={brand.id} className="flex-1 truncate text-center font-medium" style={{ color: selectedBrands.length <= maxRadar ? COMPARISON_COLORS[bi] : '#1A1A1A' }}>{brand.brandName}</div>
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
                                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: attr.color }} />
                                    <span className="text-xs font-medium text-[#1A1A1A] truncate">{attr.name}</span>
                                  </div>
                                  <div className="flex-1 flex gap-1">
                                    {selectedBrands.map((brand) => {
                                      const score = brand.scores?.[attr.id] || 0;
                                      return (
                                        <div key={brand.id} className="flex-1 relative">
                                          <div className="h-5 bg-[#E8E6E1] rounded overflow-hidden">
                                            <div className="h-full rounded transition-all duration-500" style={{ width: `${score}%`, backgroundColor: attr.color }} />
                                          </div>
                                          <div className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white mix-blend-difference">{score}</div>
                                        </div>
                                      );
                                    })}
                                    <div className="flex-1 relative">
                                      <div className="h-5 bg-[#E8E6E1] rounded overflow-hidden">
                                        <div className="h-full rounded transition-all duration-500 bg-[#1A1A1A]" style={{ width: `${avgScore}%` }} />
                                      </div>
                                      <div className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white mix-blend-difference">{avgScore}</div>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Consciousness Profile */}
                  <div className="card p-4 md:p-6">
                    <h3 className="text-sm font-medium text-[#1A1A1A] mb-4">Consciousness Profiles</h3>
                    <div className="space-y-4">
                      {selectedBrands.map((brand, bi) => {
                        const color = selectedBrands.length <= maxRadar ? COMPARISON_COLORS[bi] : '#1A1A1A';
                        const attrScores = ATTRIBUTES.map(a => ({ ...a, score: brand.scores?.[a.id] || 0 }));
                        const strongest = attrScores.reduce((a, b) => a.score > b.score ? a : b);
                        const weakest = attrScores.reduce((a, b) => a.score < b.score ? a : b);
                        // Most differentiated = highest gap vs group average
                        const mostDiff = attrScores.reduce((best, a) => {
                          const groupAvg = selectedBrands.reduce((sum, b2) => sum + (b2.scores?.[a.id] || 0), 0) / selectedBrands.length;
                          const diff = a.score - groupAvg;
                          return diff > best.diff ? { ...a, diff } : best;
                        }, { diff: -Infinity, name: '-', score: 0 });
                        return (
                          <div key={brand.id} className="flex items-start gap-3 p-3 rounded-lg bg-[#F8F7F5]">
                            <div className="w-2 h-12 rounded-full flex-shrink-0 mt-1" style={{ backgroundColor: color }} />
                            <div className="flex-1 min-w-0">
                              <div className="font-semibold text-sm text-[#1A1A1A] mb-2">{brand.brandName}</div>
                              <div className="grid grid-cols-3 gap-2 text-xs">
                                <div>
                                  <div className="text-[#9CA3AF] mb-0.5">Strongest</div>
                                  <div className="font-medium text-[#059669]">{strongest.name} <span className="text-[#9CA3AF]">({strongest.score})</span></div>
                                </div>
                                <div>
                                  <div className="text-[#9CA3AF] mb-0.5">Weakest</div>
                                  <div className="font-medium text-[#E53935]">{weakest.name} <span className="text-[#9CA3AF]">({weakest.score})</span></div>
                                </div>
                                <div>
                                  <div className="text-[#9CA3AF] mb-0.5">Most distinct</div>
                                  <div className="font-medium text-[#1976D2]">{mostDiff.name} <span className="text-[#9CA3AF]">(+{Math.round(mostDiff.diff)})</span></div>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Head-to-Head (only when exactly 2 brands) */}
                  {selectedBrands.length === 2 && (() => {
                    const [a, b] = selectedBrands;
                    const aWins = ATTRIBUTES.filter(attr => (a.scores?.[attr.id] || 0) > (b.scores?.[attr.id] || 0));
                    const bWins = ATTRIBUTES.filter(attr => (b.scores?.[attr.id] || 0) > (a.scores?.[attr.id] || 0));
                    const tied = ATTRIBUTES.filter(attr => (a.scores?.[attr.id] || 0) === (b.scores?.[attr.id] || 0));
                    return (
                      <div className="card p-4 md:p-6">
                        <h3 className="text-sm font-medium text-[#1A1A1A] mb-4">Head to Head</h3>
                        <div className="grid grid-cols-3 gap-3 text-center mb-4">
                          <div className="bg-[#F0EEEA] rounded-lg p-3">
                            <div className="text-2xl font-bold" style={{ color: COMPARISON_COLORS[0] }}>{aWins.length}</div>
                            <div className="text-xs text-[#666666] mt-1 truncate">{a.brandName} leads</div>
                          </div>
                          <div className="bg-[#F0EEEA] rounded-lg p-3">
                            <div className="text-2xl font-bold text-[#9CA3AF]">{tied.length}</div>
                            <div className="text-xs text-[#666666] mt-1">Tied</div>
                          </div>
                          <div className="bg-[#F0EEEA] rounded-lg p-3">
                            <div className="text-2xl font-bold" style={{ color: COMPARISON_COLORS[1] }}>{bWins.length}</div>
                            <div className="text-xs text-[#666666] mt-1 truncate">{b.brandName} leads</div>
                          </div>
                        </div>
                        <div className="space-y-2">
                          {ATTRIBUTES.map(attr => {
                            const aScore = a.scores?.[attr.id] || 0;
                            const bScore = b.scores?.[attr.id] || 0;
                            const diff = aScore - bScore;
                            const winner = diff > 0 ? 0 : diff < 0 ? 1 : null;
                            return (
                              <div key={attr.id} className="flex items-center gap-2 text-xs">
                                <div className="flex-1 text-right">
                                  <span className={`font-bold ${winner === 0 ? 'text-[#E53935]' : 'text-[#9CA3AF]'}`}>{aScore}</span>
                                </div>
                                <div className="w-20 text-center flex-shrink-0">
                                  <div className="flex items-center gap-1 justify-center">
                                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: attr.color }} />
                                    <span className="text-[#666666]">{attr.name}</span>
                                  </div>
                                </div>
                                <div className="flex-1">
                                  <span className={`font-bold ${winner === 1 ? 'text-[#1976D2]' : 'text-[#9CA3AF]'}`}>{bScore}</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Quick Insights */}
                  <div className="card p-4 md:p-6">
                    <h3 className="text-sm font-medium text-[#1A1A1A] mb-3">Quick Insights</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                      <div className="bg-[#F0EEEA] rounded-lg p-3">
                        <div className="font-medium text-[#1A1A1A] mb-1 text-xs">Highest Overall Score</div>
                        <div className="text-[#E53935] font-bold text-sm">
                          {selectedBrands.reduce((a, b) => a.totalScore > b.totalScore ? a : b).brandName}
                          <span className="text-[#666666] font-normal ml-2 text-xs">({selectedBrands.reduce((a, b) => a.totalScore > b.totalScore ? a : b).totalScore})</span>
                        </div>
                      </div>
                      <div className="bg-[#F0EEEA] rounded-lg p-3">
                        <div className="font-medium text-[#1A1A1A] mb-1 text-xs">Largest Attribute Gap</div>
                        {(() => {
                          let maxGap = 0, gapAttr = ATTRIBUTES[0];
                          ATTRIBUTES.forEach(attr => {
                            const scores = selectedBrands.map(b => b.scores?.[attr.id] || 0);
                            const gap = Math.max(...scores) - Math.min(...scores);
                            if (gap > maxGap) { maxGap = gap; gapAttr = attr; }
                          });
                          return <div className="text-[#E53935] font-bold text-sm">{gapAttr.name} <span className="text-[#666666] font-normal text-xs">({maxGap} pts spread)</span></div>;
                        })()}
                      </div>
                      <div className="bg-[#F0EEEA] rounded-lg p-3">
                        <div className="font-medium text-[#1A1A1A] mb-1 text-xs">Collective Strength</div>
                        {(() => {
                          let maxAvg = 0, strongAttr = ATTRIBUTES[0];
                          ATTRIBUTES.forEach(attr => {
                            const avg = selectedBrands.reduce((sum, b) => sum + (b.scores?.[attr.id] || 0), 0) / selectedBrands.length;
                            if (avg > maxAvg) { maxAvg = avg; strongAttr = attr; }
                          });
                          return <div className="text-[#059669] font-bold text-sm">{strongAttr.name} <span className="text-[#666666] font-normal text-xs">({Math.round(maxAvg)} avg)</span></div>;
                        })()}
                      </div>
                      <div className="bg-[#F0EEEA] rounded-lg p-3">
                        <div className="font-medium text-[#1A1A1A] mb-1 text-xs">Collective Weakness</div>
                        {(() => {
                          let minAvg = 100, weakAttr = ATTRIBUTES[0];
                          ATTRIBUTES.forEach(attr => {
                            const avg = selectedBrands.reduce((sum, b) => sum + (b.scores?.[attr.id] || 0), 0) / selectedBrands.length;
                            if (avg < minAvg) { minAvg = avg; weakAttr = attr; }
                          });
                          return <div className="text-[#F57C00] font-bold text-sm">{weakAttr.name} <span className="text-[#666666] font-normal text-xs">({Math.round(minAvg)} avg)</span></div>;
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
                      assessment.instagramContent, assessment.youtubeContent, assessment.redditAnswersContent,
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
function SavedAssessmentsPage({ assessments, onLoad, onDelete, onBack, onImport, onExport, onShare, onRescore, profile }) {
  const fileInputRef = useRef(null);
  const isReadonly = profile?.is_readonly && !profile?.is_admin;

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
    <div className="max-w-3xl mx-auto p-4 md:p-8 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
        <div>
          <h2 className="text-xl md:text-2xl font-bold text-[#1A1A1A]">Saved Assessments</h2>
          <p className="text-sm text-[#666666]">Your assessments are stored securely in the cloud</p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          {!isReadonly && (
            <>
              <input type="file" ref={fileInputRef} onChange={handleFileImport} accept=".json" className="hidden" />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium border border-[#D9D6D0] bg-white text-[#444444] hover:border-[#1A1A1A] hover:bg-[#F0EEEA] rounded transition-colors"
              >
                <Upload className="w-4 h-4" /> Import
              </button>
            </>
          )}
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium border border-[#D9D6D0] bg-white text-[#444444] hover:border-[#1A1A1A] hover:bg-[#F0EEEA] rounded transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
        </div>
      </div>

      {/* Info tip */}
      <div className="bg-[#F0F7FF] border border-[#BFDBFE] rounded-lg px-4 py-3 mb-5">
        <p className="text-xs text-[#1E40AF]">
          <strong>Sharing tip:</strong> Use the <strong>Share</strong> button to copy a link others can view, or <strong>Export</strong> to download a JSON backup.
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
        <div className="space-y-2">
          {assessments.map((a, i) => {
            const overallScore = a.scores ? Math.round(
              Object.entries(a.scores)
                .filter(([key, val]) => val && typeof val.score === 'number')
                .reduce((sum, [, v]) => sum + v.score, 0) / 8
            ) : null;
            const maturity = overallScore !== null ? getMaturityStage(overallScore) : null;
            const industryName = a.project.industry && a.project.industry !== 'other'
              ? INDUSTRIES.find(ind => ind.id === a.project.industry)?.name || a.project.industry
              : null;
            return (
              <div key={i} className="card px-4 py-3 hover:shadow-md transition-shadow">
                <div className="flex items-center gap-3">
                  {/* Score badge */}
                  {overallScore !== null && (
                    <div className="w-11 h-11 rounded-lg flex-shrink-0 flex items-center justify-center"
                      style={{ backgroundColor: (maturity?.color || '#E53935') + '18' }}>
                      <span className="text-base font-bold" style={{ color: maturity?.color || '#E53935' }}>{overallScore}</span>
                    </div>
                  )}

                  {/* Brand info */}
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-[#1A1A1A] text-sm leading-tight truncate">{a.project.brandName}</h4>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
                      <span className="text-xs text-[#9CA3AF] whitespace-nowrap">{a.project.date || '—'}</span>
                      {industryName && (
                        <span className="text-xs text-[#9CA3AF]">·</span>
                      )}
                      {industryName && (
                        <span className="text-xs text-[#666666] truncate max-w-[140px]">{industryName}</span>
                      )}
                      {maturity && (
                        <span className="text-xs text-[#9CA3AF]">·</span>
                      )}
                      {maturity && (
                        <span className="text-xs font-medium" style={{ color: maturity.color }}>{maturity.name}</span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {!isReadonly && (
                      <>
                        <button
                          onClick={() => onShare(a)}
                          title="Share link"
                          className="w-8 h-8 flex items-center justify-center text-[#9CA3AF] hover:text-[#E53935] hover:bg-[#E53935]/8 rounded transition-colors"
                        >
                          <Share2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => onExport(a)}
                          title="Export JSON"
                          className="w-8 h-8 flex items-center justify-center text-[#9CA3AF] hover:text-[#1A1A1A] hover:bg-[#F0EEEA] rounded transition-colors"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => onRescore(a)}
                          title="Regenerate scores using current rubric"
                          className="px-3 py-1.5 text-xs font-medium border border-[#D9D6D0] text-[#444444] hover:border-[#1A1A1A] hover:bg-[#F0EEEA] rounded transition-colors whitespace-nowrap"
                        >
                          Rescore
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => onLoad(a)}
                      className="px-4 py-1.5 text-xs font-semibold bg-[#1A1A1A] text-white hover:bg-[#333333] rounded transition-colors whitespace-nowrap"
                    >
                      Load
                    </button>
                    {!isReadonly && (
                      <button
                        onClick={() => onDelete(i)}
                        title="Delete"
                        className="w-8 h-8 flex items-center justify-center text-[#D9D6D0] hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p className="text-center text-sm text-[#9CA3AF] mt-8">
        {assessments.length} assessment{assessments.length !== 1 ? 's' : ''} saved
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
          <p className="text-[#333333] mb-4">{stage.description}</p>
          {scores.headline && (
            <p className="text-lg italic text-[#1A1A1A] border-t border-[#E8E6E1] pt-4 mt-4">
              "{scores.headline}"
            </p>
          )}
        </div>

        {/* Spider Chart */}
        <div className="card p-6 mb-8">
          <h3 className="text-lg font-semibold text-[#1A1A1A] mb-4 text-center">Brand Consciousness Profile</h3>
          <SpiderChart scores={scores} size={450} animate={false} />
        </div>

        {/* Executive Summary */}
        <div className="card p-5 mb-4">
          <h3 className="text-lg font-semibold text-[#1A1A1A] mb-4">EXECUTIVE SUMMARY</h3>
          <p className="text-[#333333] leading-relaxed">
            {project.brandName} achieved an overall Brand Consciousness Score of <strong>{overall}/100</strong>, placing them in the "<strong>{stage.name}</strong>" maturity stage. The assessment evaluated the brand across 8 key consciousness attributes. Key strengths emerged in {sortedAttrs.slice(-2).map(a => a.name).join(' and ')}, while opportunities for growth were identified in {sortedAttrs.slice(0, 2).map(a => a.name).join(' and ')}.
          </p>
        </div>

        {/* Score Summary */}
        <div className="card p-5 mb-4">
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
        <div className="card p-5 mb-4">
          <h3 className="text-lg font-semibold text-[#1A1A1A] mb-4">MATURITY STAGE CONTEXT</h3>
          <p className="text-[#333333] leading-relaxed">
            With a score of {overall}/100, {project.brandName} is positioned in the "{stage.name}" stage of brand consciousness maturity. {stage.description}. Brands at this stage typically demonstrate {overall < 40 ? 'foundational elements but significant room for strategic development across multiple dimensions' : overall < 60 ? 'solid fundamentals with clear opportunities to elevate their market presence and differentiation' : overall < 80 ? 'strong brand awareness with potential to become true industry thought leaders' : 'exceptional consciousness and should focus on maintaining their position while innovating'}. The path forward involves targeted investment in the lowest-scoring attributes.
          </p>
        </div>

        {/* Signal Conflicts */}
        {(() => {
          const s = (id) => scores[id]?.score || 0;
          const conflicts = [];

          // Awake vs Intentional: narrative leadership without credibility infrastructure
          if (s('AWAKE') >= 60 && s('INTENTIONAL') < 45) {
            conflicts.push({
              title: 'Narrative leadership without credibility infrastructure',
              attributes: ['Awake', 'Intentional'],
              scores: [s('AWAKE'), s('INTENTIONAL')],
              tension: `${project.brandName} scores well for shaping narratives (${s('AWAKE')}) but lacks the credibility infrastructure — trademarks, awards, executive visibility, client evidence — to sustain that authority (${s('INTENTIONAL')}). Audiences encounter a brand that sounds like a leader but cannot prove it. The gap erodes trust at the moment of consideration.`,
              signal: 'High ambition, thin proof.',
            });
          }

          // Reflective vs Aware: authentic internally but disconnected from audiences
          if (s('REFLECTIVE') >= 60 && s('AWARE') < 45) {
            conflicts.push({
              title: 'Internal authenticity disconnected from audience understanding',
              attributes: ['Reflective', 'Aware'],
              scores: [s('REFLECTIVE'), s('AWARE')],
              tension: `The brand demonstrates authentic self-expression (${s('REFLECTIVE')}) but shows limited evidence of genuinely understanding its audiences (${s('AWARE')}). Authenticity without audience insight becomes self-indulgence. The brand says what it believes, not necessarily what its audiences need to hear.`,
              signal: 'Inward-facing brand, outward-facing blind spot.',
            });
          }

          // Cogent vs Attentive: data-driven thinking but poor experience delivery
          if (s('COGENT') >= 60 && s('ATTENTIVE') < 45) {
            conflicts.push({
              title: 'Strategic intelligence undermined by poor experience delivery',
              attributes: ['Cogent', 'Attentive'],
              scores: [s('COGENT'), s('ATTENTIVE')],
              tension: `${project.brandName} shows evidence of data-driven marketing thinking (${s('COGENT')}) but the experience audiences actually encounter falls short (${s('ATTENTIVE')}). Smart strategy means nothing if the touchpoints fail. Audiences judge the brand by what they experience, not what its marketers intended.`,
              signal: 'Good thinking, poor execution.',
            });
          }

          // Visionary vs Reflective: purpose claims without authentic expression
          if (s('VISIONARY') >= 60 && s('REFLECTIVE') < 45) {
            conflicts.push({
              title: 'Purpose claims not backed by authentic expression',
              attributes: ['Visionary', 'Reflective'],
              scores: [s('VISIONARY'), s('REFLECTIVE')],
              tension: `The brand articulates meaningful purpose (${s('VISIONARY')}) but external signals suggest a disconnect between stated values and observable behaviour (${s('REFLECTIVE')}). Purpose without authenticity reads as marketing. Audiences are increasingly skilled at identifying the gap.`,
              signal: 'Aspirational positioning, unconvincing reality.',
            });
          }

          // Sentient vs Cogent: emotional resonance without strategic grounding
          if (s('SENTIENT') >= 65 && s('COGENT') < 45) {
            conflicts.push({
              title: 'Emotional resonance without strategic intelligence',
              attributes: ['Sentient', 'Cogent'],
              scores: [s('SENTIENT'), s('COGENT')],
              tension: `The brand creates emotional connection and distinctive creative (${s('SENTIENT')}) but appears to lack the data-driven strategic infrastructure behind it (${s('COGENT')}). Creative that isn't grounded in audience insight and measurement is hard to sustain and harder to scale. Without evidence of what's working, the energy dissipates.`,
              signal: 'Inspired execution, unclear direction.',
            });
          }

          // Awake vs Aware: thought leadership without audience connection
          if (s('AWAKE') >= 65 && s('AWARE') < 45) {
            conflicts.push({
              title: 'Thought leadership broadcast into a vacuum',
              attributes: ['Awake', 'Aware'],
              scores: [s('AWAKE'), s('AWARE')],
              tension: `${project.brandName} produces thought leadership and shapes industry discourse (${s('AWAKE')}) but shows limited evidence of two-way audience engagement (${s('AWARE')}). Leadership without listening becomes broadcasting. The brand talks at its audience rather than with them.`,
              signal: 'Loud voice, limited conversation.',
            });
          }

          // Attentive vs Sentient: polished experience but no emotional resonance  
          if (s('ATTENTIVE') >= 65 && s('SENTIENT') < 40) {
            conflicts.push({
              title: 'Polished execution with no emotional impact',
              attributes: ['Attentive', 'Sentient'],
              scores: [s('ATTENTIVE'), s('SENTIENT')],
              tension: `The brand delivers technically consistent, well-executed touchpoints (${s('ATTENTIVE')}) but fails to create genuine emotional connection or memorable creative distinction (${s('SENTIENT')}). Competence without resonance is forgettable. Audiences find nothing to feel or remember.`,
              signal: 'Professional, but unmemorable.',
            });
          }

          // Intentional vs Visionary: credible and present but no meaningful direction
          if (s('INTENTIONAL') >= 65 && s('VISIONARY') < 40) {
            conflicts.push({
              title: 'Established presence with no sense of direction',
              attributes: ['Intentional', 'Visionary'],
              scores: [s('INTENTIONAL'), s('VISIONARY')],
              tension: `${project.brandName} projects credibility and professional substance (${s('INTENTIONAL')}) but offers audiences no compelling sense of where it is headed or why it exists beyond commercial purpose (${s('VISIONARY')}). Credibility tells people what to trust. Purpose tells them why it matters. Without the latter, the brand competes on features and price alone.`,
              signal: 'Respected, but not inspiring.',
            });
          }

          if (conflicts.length === 0) return null;

          return (
            <div className="card p-5 mb-4 border-l-4 border-[#F59E0B]">
              <div className="flex items-center gap-2 mb-4">
                <AlertCircle className="w-5 h-5 text-[#F59E0B] flex-shrink-0" />
                <h3 className="text-lg font-semibold text-[#1A1A1A]">SIGNAL CONFLICTS</h3>
              </div>
              <p className="text-sm text-[#666666] mb-4">These tensions between attribute scores indicate where the brand's performance tells contradictory stories. Each represents a diagnostic insight, not just a gap.</p>
              <div className="space-y-4">
                {conflicts.map((c, i) => (
                  <div key={i} className="bg-[#FFFBEB] border border-[#FDE68A] rounded-lg p-4">
                    <div className="flex items-start justify-between mb-2 gap-3">
                      <h4 className="font-semibold text-[#92400E] text-sm leading-snug">{c.title}</h4>
                      <div className="flex gap-1.5 flex-shrink-0">
                        {c.attributes.map((attr, ai) => (
                          <span key={attr} className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#FEF3C7] text-[#92400E]">
                            {attr} {c.scores[ai]}
                          </span>
                        ))}
                      </div>
                    </div>
                    <p className="text-sm text-[#78350F] leading-relaxed mb-2">{c.tension}</p>
                    <p className="text-xs font-semibold text-[#B45309] italic">{c.signal}</p>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

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

        {/* Antenna Group Services */}
        {(() => {
          const forceInclude = report.assessmentSummary?.forceIncludeServices || [];
          const serviceRecs = getAllRecommendations(scores, { forceIncludeServices: forceInclude });
          const topServices = serviceRecs.slice(0, 6);
          if (topServices.length === 0) return null;
          
          return (
            <>
              <h3 className="text-xl font-semibold text-[#1A1A1A] mb-4">RECOMMENDED ANTENNA GROUP SERVICES</h3>
              <p className="text-[#666666] mb-4">Based on the lowest scoring attributes, these services would have the greatest impact on improving brand consciousness:</p>
              <div className="grid md:grid-cols-2 gap-4 mb-8">
                {topServices.map((rec, i) => {
                  const attr = ATTRIBUTES.find(a => a.id === rec.attributeId);
                  const attrScore = scores[rec.attributeId]?.score || 0;
                  const budgetStr = rec.service.budget 
                    ? `$${(rec.service.budget.low / 1000).toFixed(0)}K - $${(rec.service.budget.high / 1000).toFixed(0)}K`
                    : 'Contact for pricing';
                  
                  return (
                    <div key={i} className="card p-4 border-l-4" style={{ borderLeftColor: attr?.color || '#E53935' }}>
                      <h4 className="font-semibold text-[#1A1A1A] mb-2">{rec.service.name}</h4>
                      <p className="text-xs text-[#666666] mb-2">{rec.service.category}</p>
                      <p className="text-sm text-[#333333] mb-2">
                        Improves <span style={{ color: attr?.color }}>{attr?.name}</span> (currently {attrScore})
                      </p>
                      <p className="text-sm font-medium text-[#059669]">{budgetStr}</p>
                    </div>
                  );
                })}
              </div>
            </>
          );
        })()}

        {/* Conclusions */}
        <div className="card p-5 mb-4">
          <h3 className="text-lg font-semibold text-[#1A1A1A] mb-4">CONCLUSIONS</h3>
          <p className="text-[#333333] leading-relaxed">
            {scores.conclusion || `${project.brandName} has demonstrated ${overall >= 60 ? 'strong potential' : 'a foundation'} for building an impactful, conscious brand presence. By focusing on the recommendations outlined above, particularly strengthening ${sortedAttrs[0].name} and ${sortedAttrs[1].name} capabilities, the brand can elevate its market position and create deeper connections with its audience.`}
          </p>
        </div>

        {/* What We Evaluated */}
        <div className="card p-5 mb-4">
          <h3 className="text-lg font-semibold text-[#1A1A1A] mb-4">WHAT WE EVALUATED</h3>
          <p className="text-[#333333] leading-relaxed mb-4">
            This assessment was conducted using Antenna Group's Brand Consciousness Framework v{FRAMEWORK_VERSION}, evaluating {project.brandName} across four key dimensions: website presence, social media footprint, AI reputation, and earned media coverage. The business model ({project.businessModel?.toUpperCase() || 'B2B'}) and industry context ({industryName}) were applied to weight attribute importance appropriately.
          </p>
          {report.assessmentSummary && (
            <div className="grid md:grid-cols-2 gap-4 text-sm">
              <div className="bg-[#F0EEEA] p-3 rounded-lg">
                <h4 className="font-semibold text-[#1A1A1A] mb-2">Website Analysis</h4>
                <p className="text-[#666666]">
                  {report.assessmentSummary.pagesReviewed || 'Key pages reviewed'}
                </p>
              </div>
              <div className="bg-[#F0EEEA] p-3 rounded-lg">
                <h4 className="font-semibold text-[#1A1A1A] mb-2">Social Media</h4>
                <p className="text-[#666666]">
                  {[
                    report.assessmentSummary.hasLinkedIn && 'LinkedIn',
                    report.assessmentSummary.hasX && 'X/Twitter',
                    report.assessmentSummary.hasInstagram && 'Instagram',
                    report.assessmentSummary.hasYouTube && 'YouTube',
                    report.assessmentSummary.hasWikipedia && 'Wikipedia',
                    report.assessmentSummary.hasRedditAnswers && 'Reddit Answers',
                  ].filter(Boolean).join(', ') || 'Social platforms reviewed'}
                </p>
              </div>
              <div className="bg-[#F0EEEA] p-3 rounded-lg">
                <h4 className="font-semibold text-[#1A1A1A] mb-2">AI Reputation</h4>
                <p className="text-[#666666]">
                  {[
                    report.assessmentSummary.hasClaudeAI && 'Claude',
                    report.assessmentSummary.hasGeminiAI && 'Gemini',
                    report.assessmentSummary.hasChatGPT && 'ChatGPT',
                  ].filter(Boolean).join(', ') || 'AI platforms queried'}
                </p>
              </div>
              <div className="bg-[#F0EEEA] p-3 rounded-lg">
                <h4 className="font-semibold text-[#1A1A1A] mb-2">Earned Media</h4>
                <p className="text-[#666666]">
                  {report.assessmentSummary.hasEarnedMedia ? 'Coverage from past 3 months reviewed' : 'Media coverage analyzed'}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Score Justification */}
        {scores.justification && (
          <div className="card p-5 mb-4 bg-[#FAFAF9]">
            <h3 className="text-lg font-semibold text-[#1A1A1A] mb-4">SCORE JUSTIFICATION</h3>
            <p className="text-sm text-[#333333] leading-relaxed">
              {scores.justification}
            </p>
          </div>
        )}

        {/* Footer */}
        <div className="text-center pt-8 border-t border-[#D9D6D0]">
          <p className="text-sm text-[#9CA3AF]">
            This report was generated using Antenna Group's Brand Consciousness Framework v{FRAMEWORK_VERSION}
          </p>
          <p className="text-xs text-[#9CA3AF] mt-2">
            Shared on {report.sharedAt ? new Date(report.sharedAt).toLocaleDateString() : 'Unknown date'}
          </p>
        </div>
      </div>
    </div>
  );
}

// Stay Conscious Page — brand intelligence feed powered by Claude
const STAY_CONSCIOUS_CATEGORIES = ['AI Visibility', 'Digital Experience', 'Brand Strategy', 'Earned Media', 'Social Signals', 'Assessment Practice'];

const CATEGORY_META = {
  'AI Visibility':      { color: '#6366F1', bg: '#6366F115' },
  'Digital Experience': { color: '#0EA5E9', bg: '#0EA5E915' },
  'Brand Strategy':     { color: '#E53935', bg: '#E5393515' },
  'Earned Media':       { color: '#F59E0B', bg: '#F59E0B15' },
  'Social Signals':     { color: '#10B981', bg: '#10B98115' },
  'Assessment Practice':{ color: '#8B5CF6', bg: '#8B5CF615' },
};

const STAY_CONSCIOUS_PROMPT = `You are a brand intelligence analyst advising consultants who use the Conscious Compass framework to evaluate brands based purely on publicly available signals — what audiences, prospects, and partners actually encounter. The framework measures eight attributes: Awake (narrative leadership), Aware (audience understanding), Reflective (authenticity), Attentive (experience quality), Cogent (strategic intelligence), Sentient (emotional resonance), Visionary (purpose), and Intentional (credibility).

Generate exactly 6 "Stay Conscious" intelligence items that brand assessors should be aware of right now. These should be emerging trends, platform changes, new signals, shifting standards, or evolving best practices that affect how a brand is publicly experienced or how it should be rigorously assessed. Be specific and current. Avoid generic marketing platitudes. Write with conviction.

Cover a spread across these categories — use each at most once: AI Visibility, Digital Experience, Brand Strategy, Earned Media, Social Signals, Assessment Practice.

Return ONLY valid JSON — no preamble, no explanation, no markdown fences:
{"items":[{"headline":"...","category":"...","insight":"...","whyItMatters":"..."}]}

Each item:
- headline: punchy, specific, max 12 words
- category: exactly one of: AI Visibility | Digital Experience | Brand Strategy | Earned Media | Social Signals | Assessment Practice
- insight: 2-3 sentences. What is actually happening, with specifics where possible.
- whyItMatters: 1-2 sentences. Why this matters specifically for assessing or building conscious brands from public signals.`;

function StayConsciousPage({ apiKey, onBack }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastRefreshed, setLastRefreshed] = useState(null);
  const [activeCategory, setActiveCategory] = useState('All');
  const [hasFetched, setHasFetched] = useState(false);

  const fetchInsights = async () => {
    setLoading(true);
    setError(null);
    try {
      const key = apiKey && apiKey !== 'PROXY' ? apiKey : null;
      const headers = { 'Content-Type': 'application/json' };
      let response;
      if (key) {
        response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: { ...headers, 'x-api-key': key, 'anthropic-version': '2023-06-01' },
          body: JSON.stringify({
            model: 'claude-sonnet-4-6',
            max_tokens: 2000,
            messages: [{ role: 'user', content: STAY_CONSCIOUS_PROMPT }]
          })
        });
      } else {
        response = await fetch('/api/claude', {
          method: 'POST',
          headers,
          body: JSON.stringify({ prompt: STAY_CONSCIOUS_PROMPT })
        });
      }
      if (!response.ok) throw new Error('Request failed');
      const data = await response.json();
      const text = (data.content?.[0]?.text || data.text || '').trim();
      const clean = text.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(clean);
      if (parsed?.items?.length) {
        setItems(parsed.items);
        setLastRefreshed(new Date());
        setHasFetched(true);
      } else {
        throw new Error('Unexpected response format');
      }
    } catch (err) {
      setError('Could not load insights. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  // Auto-fetch on first load
  useEffect(() => {
    if (!hasFetched) fetchInsights();
  }, []);

  const filteredItems = activeCategory === 'All' ? items : items.filter(i => i.category === activeCategory);

  return (
    <div className="min-h-screen bg-[#F5F4F0]">
      <div className="max-w-5xl mx-auto p-4 md:p-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
          <div className="flex items-start gap-4">
            <button onClick={onBack} className="btn-secondary flex items-center gap-2 flex-shrink-0">
              <ArrowLeft className="w-4 h-4" /> Back
            </button>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Sparkles className="w-5 h-5 text-[#6366F1]" />
                <h1 className="text-xl md:text-2xl font-bold text-[#1A1A1A]">Stay Conscious</h1>
              </div>
              <p className="text-sm text-[#666666]">Brand intelligence for assessors. What's shifting, why it matters.</p>
              {lastRefreshed && (
                <p className="text-xs text-[#9CA3AF] mt-0.5">Last refreshed {lastRefreshed.toLocaleTimeString()}</p>
              )}
            </div>
          </div>
          <button
            onClick={fetchInsights}
            disabled={loading}
            className="btn-secondary flex items-center gap-2 self-start sm:self-auto flex-shrink-0"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {loading ? 'Loading...' : 'Refresh'}
          </button>
        </div>

        {/* Category filter */}
        {items.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-6">
            {['All', ...STAY_CONSCIOUS_CATEGORIES].map(cat => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
                  activeCategory === cat
                    ? 'bg-[#1A1A1A] text-white'
                    : 'bg-white border border-[#D9D6D0] text-[#666666] hover:border-[#1A1A1A]'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        )}

        {/* Loading state */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="w-12 h-12 rounded-full bg-[#6366F1]/10 flex items-center justify-center">
              <Loader2 className="w-6 h-6 text-[#6366F1] animate-spin" />
            </div>
            <p className="text-sm text-[#666666]">Gathering brand intelligence...</p>
          </div>
        )}

        {/* Error state */}
        {error && !loading && (
          <div className="card p-8 text-center">
            <AlertCircle className="w-10 h-10 text-[#E53935] mx-auto mb-3" />
            <p className="text-[#666666] mb-4">{error}</p>
            <button onClick={fetchInsights} className="btn-primary">Try Again</button>
          </div>
        )}

        {/* Items grid */}
        {!loading && filteredItems.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredItems.map((item, i) => {
              const meta = CATEGORY_META[item.category] || CATEGORY_META['Brand Strategy'];
              return (
                <div key={i} className="card p-5 hover:shadow-md transition-shadow flex flex-col gap-3">
                  {/* Category badge */}
                  <div className="flex items-center justify-between">
                    <span
                      className="text-[10px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full"
                      style={{ backgroundColor: meta.bg, color: meta.color }}
                    >
                      {item.category}
                    </span>
                    <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: meta.color }} />
                  </div>
                  {/* Headline */}
                  <h3 className="font-semibold text-[#1A1A1A] leading-snug">{item.headline}</h3>
                  {/* Insight */}
                  <p className="text-sm text-[#444444] leading-relaxed">{item.insight}</p>
                  {/* Why it matters */}
                  <div className="border-t border-[#E8E6E1] pt-3 mt-auto">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-[#9CA3AF] mb-1">Why it matters for assessment</div>
                    <p className="text-xs text-[#666666] leading-relaxed">{item.whyItMatters}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Empty (fetched but no items) */}
        {!loading && hasFetched && items.length === 0 && !error && (
          <div className="card p-12 text-center">
            <Sparkles className="w-10 h-10 text-[#D9D6D0] mx-auto mb-3" />
            <p className="text-[#666666]">No insights loaded. Try refreshing.</p>
          </div>
        )}

        <p className="text-center text-xs text-[#9CA3AF] mt-8">
          Insights generated by Claude. Always apply your own professional judgement.
        </p>
      </div>
    </div>
  );
}

// Main App
function AppContent() {
  const [authLoading, setAuthLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [showAdminPage, setShowAdminPage] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('conscious-compass-apikey') || DEFAULT_API_KEY);
  const [project, setProject] = useState({
    brandName: '', websiteUrl: '', 
    businessModel: 'b2b', industry: 'other', date: new Date().toISOString().split('T')[0]
  });
  const [assessments, setAssessments] = useState({
    website: { status: 'pending', content: '', observations: '', images: [], pagesReviewed: '', websiteContent: '', credentialsContent: '', seoAssessment: '', techAudit: null },
    social: { status: 'pending', content: '', observations: '', socialHealthCheck: '', linkedinUrl: '', linkedinAbout: '', linkedinPosts: '', linkedinArticles: '', linkedinFollowers: '', employeeAdvocacy: '', awardsRecognition: '', hashtagContent: '', paidMediaContent: '', xUrl: '', xContent: '', instagramContent: '', youtubeContent: '', hasYouTube: true, redditAnswersContent: '', wikipediaContent: '', glassdoorContent: '', wipoContent: '', socialImages: [], instagramImages: [] },
    aiReputation: { status: 'pending', content: '', observations: '', responses: {} },
    earnedMedia: { status: 'pending', content: '', observations: '', coveragePaste: '' },
  });
  const [scores, setScores] = useState(null);
  const [showSavedPage, setShowSavedPage] = useState(false);
  const [showResultsPage, setShowResultsPage] = useState(false);
  const [showComparisonPage, setShowComparisonPage] = useState(false);
  const [showStayConsciousPage, setShowStayConsciousPage] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [savedAssessments, setSavedAssessments] = useState([]);
  const [compassResults, setCompassResults] = useState([]);
  const [sharedReport, setSharedReport] = useState(null);
  const [lastAutoSave, setLastAutoSave] = useState(null);

  // Check for existing session on mount
  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const { data: profileData } = await getProfile(session.user.id);
        if (profileData?.is_approved) {
          setUser(session.user);
          setProfile(profileData);
          loadDataFromSupabase();
        }
      }
      setAuthLoading(false);
    };
    checkSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT') {
        setUser(null);
        setProfile(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const loadDataFromSupabase = async () => {
    try {
      const { data: resultsData } = await fetchCompassResults();
      if (resultsData) {
        const formattedResults = resultsData.map(r => ({
          id: r.id,
          brandName: r.brand_name,
          businessModel: r.business_model,
          industry: r.industry,
          totalScore: r.total_score,
          maturityLevel: r.maturity_level,
          scores: r.scores,
          servicesRecommended: r.services_recommended || [],
          savedAt: r.created_at,
          isManual: r.is_manual,
          assessorName: r.assessor_name,
          rubricVersion: r.rubric_version || '2.4',
        }));
        setCompassResults(formattedResults);
      }

      const { data: assessmentsData } = await fetchSavedAssessments();
      if (assessmentsData) {
        const formattedAssessments = assessmentsData.map(a => ({
          id: a.id,
          project: a.project,
          assessments: a.assessments,
          scores: a.scores,
          savedAt: a.created_at,
        }));
        setSavedAssessments(formattedAssessments);
      }
    } catch (err) {
      console.error('Error loading data:', err);
    }

    if (!localStorage.getItem('conscious-compass-onboarded')) {
      setShowOnboarding(true);
    }

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
  };

  const handleAuthSuccess = async (authUser, authProfile) => {
    setUser(authUser);
    setProfile(authProfile);
    await loadDataFromSupabase();
  };

  const handleLogout = async () => {
    await signOut();
    setUser(null);
    setProfile(null);
    setCompassResults([]);
    setSavedAssessments([]);
  };

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
        website: { status: 'pending', content: '', observations: '', images: [], pagesReviewed: '', websiteContent: '', credentialsContent: '', seoAssessment: '', techAudit: null },
        social: { status: 'pending', content: '', observations: '', socialHealthCheck: '', linkedinUrl: '', linkedinAbout: '', linkedinPosts: '', linkedinArticles: '', linkedinFollowers: '', employeeAdvocacy: '', awardsRecognition: '', hashtagContent: '', paidMediaContent: '', xUrl: '', xContent: '', instagramContent: '', youtubeContent: '', hasYouTube: true, redditAnswersContent: '', wikipediaContent: '', glassdoorContent: '', wipoContent: '', socialImages: [], instagramImages: [] },
        aiReputation: { status: 'pending', content: '', observations: '', responses: {} },
        earnedMedia: { status: 'pending', content: '', observations: '', coveragePaste: '' },
      });
      setScores(null);
    }
  };

  const handleSave = async () => {
    if (!project.brandName) {
      alert('Please enter a brand name before saving.');
      return;
    }
    try {
      // Create a copy of assessments without large image data
      const assessmentsToSave = {
        ...assessments,
        website: { ...assessments.website, images: [] },
        social: { ...assessments.social, socialImages: [], instagramImages: [] },
      };
      
      // Save to Supabase - saved assessments
      const { error: saveError } = await saveAssessment({
        project,
        assessments: assessmentsToSave,
        scores,
      });
      
      if (saveError) throw saveError;

      // Also save to compass results (summary only)
      if (scores) {
        const overall = Math.round(
          Object.entries(scores)
            .filter(([key, val]) => val && typeof val.score === 'number')
            .reduce((a, [, v]) => a + v.score, 0) / 8
        );
        const stage = getMaturityStage(overall);
        const forceIncludeSave = getForceIncludeServicesFromAIReputation(assessments?.aiReputation?.content, assessments);
        const serviceRecs = getAllRecommendations(scores, { forceIncludeServices: forceIncludeSave });
        
        const resultData = {
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
          isManual: false,
          assessorName: profile?.full_name || user?.email?.split('@')[0] || 'Unknown',
          rubricVersion: FRAMEWORK_VERSION,
        };
        
        await saveCompassResult(resultData);
      }

      // Reload data from Supabase
      await loadDataFromSupabase();
      
      alert('Assessment saved!');
    } catch (e) {
      console.error('Save failed:', e);
      alert('Save failed: ' + (e.message || 'Unknown error'));
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

  const handleDelete = async (assessment) => {
    if (confirm(`Delete assessment for "${assessment.project?.brandName || 'this brand'}"?`)) {
      if (assessment.id) {
        await deleteAssessment(assessment.id);
        await loadDataFromSupabase();
      }
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

  const handleImport = async (data) => {
    if (!data.project || !data.assessments) {
      alert('Invalid file format');
      return;
    }
    
    await saveAssessment({
      project: data.project,
      assessments: data.assessments,
      scores: data.scores,
    });
    
    await loadDataFromSupabase();
    alert(`Assessment for "${data.project.brandName}" imported successfully!`);
  };

  const handleShare = (assessment) => {
    // Check if AI reputation synthesis indicates GEO should be recommended
    const aiRepSynthesis = assessment.assessments?.aiReputation?.content || '';
    const forceIncludeServices = getForceIncludeServicesFromAIReputation(aiRepSynthesis, assessment.assessments);
    
    // Include essential assessment summary data (excluding large images)
    const shareData = {
      project: assessment.project,
      scores: assessment.scores,
      assessmentSummary: {
        pagesReviewed: assessment.assessments?.website?.pagesReviewed || '',
        websiteUrl: assessment.assessments?.website?.websiteUrl || assessment.project?.websiteUrl || '',
        hasLinkedIn: !!assessment.assessments?.social?.linkedinContent,
        hasX: !!assessment.assessments?.social?.xContent,
        hasInstagram: !!assessment.assessments?.social?.instagramBio,
        hasYouTube: !!assessment.assessments?.social?.youtubeContent,
        hasWikipedia: !!assessment.assessments?.social?.wikipediaContent,
        hasRedditAnswers: !!assessment.assessments?.social?.redditAnswersContent,
        hasClaudeAI: !!assessment.assessments?.aiReputation?.claudeManual,
        hasGeminiAI: !!assessment.assessments?.aiReputation?.geminiManual,
        hasChatGPT: !!assessment.assessments?.aiReputation?.chatgptManual,
        hasEarnedMedia: !!assessment.assessments?.earnedMedia?.earnedMediaAnalysis,
        forceIncludeServices: forceIncludeServices, // Services to force-include based on AI reputation issues
      },
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

  // Show loading while checking auth
  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#E8E6E1] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-[#E53935]" />
          <p className="mt-4 text-[#666666]">Loading...</p>
        </div>
      </div>
    );
  }

  // Show shared report if accessed via share link (BEFORE auth check - allows public viewing)
  if (sharedReport) {
    return <SharedReportView report={sharedReport} onClose={() => {
      setSharedReport(null);
      window.history.replaceState({}, '', window.location.pathname);
    }} />;
  }

  // Show auth page if not logged in
  if (!user || !profile) {
    return <AuthPage onAuthSuccess={handleAuthSuccess} />;
  }

  // Show admin page
  if (showAdminPage) {
    return <AdminPage currentUser={user} onBack={() => setShowAdminPage(false)} />;
  }

  // Show Stay Conscious page
  if (showStayConsciousPage) {
    return (
      <div className="min-h-screen bg-[#E8E6E1]">
        <Header 
          onNewAssessment={handleNewAssessment}
          onSavedAssessments={() => { setShowStayConsciousPage(false); setShowSavedPage(true); }}
          onCompassResults={() => { setShowStayConsciousPage(false); setShowResultsPage(true); }}
          onComparison={() => { setShowStayConsciousPage(false); setShowComparisonPage(true); }}
          onStayConscious={() => setShowStayConsciousPage(false)}
          activePage="stay-conscious"
          lastAutoSave={lastAutoSave}
          user={user}
          profile={profile}
          onLogout={handleLogout}
          onAdmin={() => setShowAdminPage(true)}
        />
        <StayConsciousPage apiKey={apiKey} onBack={() => setShowStayConsciousPage(false)} />
      </div>
    );
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
          onStayConscious={() => { setShowComparisonPage(false); setShowStayConsciousPage(true); }}
          activePage="compare"
          lastAutoSave={lastAutoSave}
          user={user}
          profile={profile}
          onLogout={handleLogout}
          onAdmin={() => setShowAdminPage(true)}
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
          onStayConscious={() => { setShowResultsPage(false); setShowStayConsciousPage(true); }}
          activePage="results"
          lastAutoSave={lastAutoSave}
          user={user}
          profile={profile}
          onLogout={handleLogout}
          onAdmin={() => setShowAdminPage(true)}
        />
        <CompassResultsPage 
          results={compassResults}
          onBack={() => setShowResultsPage(false)}
          onUpdateResults={async (val) => { if (val === null) await loadDataFromSupabase(); else setCompassResults(val); }}
          profile={profile}
          user={user}
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
          onStayConscious={() => { setShowSavedPage(false); setShowStayConsciousPage(true); }}
          activePage="saved"
          lastAutoSave={lastAutoSave}
          user={user}
          profile={profile}
          onLogout={handleLogout}
          onAdmin={() => setShowAdminPage(true)}
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
          profile={profile}
        />
      </div>
    );
  }

  // Check if user is read-only (not admin)
  const isReadonly = profile?.is_readonly && !profile?.is_admin;

  return (
    <div className="min-h-screen bg-[#E8E6E1]">
      {/* Onboarding Tour */}
      {showOnboarding && !isReadonly && (
        <OnboardingTour onComplete={() => setShowOnboarding(false)} />
      )}
      
      <Header 
        onNewAssessment={handleNewAssessment} 
        onSavedAssessments={() => setShowSavedPage(true)}
        onCompassResults={() => setShowResultsPage(true)}
        onComparison={() => setShowComparisonPage(true)}
        onStayConscious={() => setShowStayConsciousPage(true)}
        activePage={null}
        lastAutoSave={lastAutoSave}
        user={user}
        profile={profile}
        onLogout={handleLogout}
        onAdmin={() => setShowAdminPage(true)}
      />
      
      {/* Read-only users see simplified welcome page, unless they've loaded a report */}
      {isReadonly ? (
        currentStep === 6 && scores ? (
          <ReportPage project={project} scores={scores} setScores={setScores} assessments={assessments} apiKey={apiKey} onSave={handleSave} onPrev={() => setCurrentStep(0)} profile={profile} />
        ) : (
          <ReadOnlyWelcomePage 
            onCompassResults={() => setShowResultsPage(true)}
            onComparison={() => setShowComparisonPage(true)}
            onSavedAssessments={() => setShowSavedPage(true)}
          />
        )
      ) : (
        <>
          {currentStep > 0 && currentStep < 7 && <ProgressSteps currentStep={currentStep} steps={steps} assessments={assessments} />}

          {currentStep === 0 && <WelcomePage onStart={() => setCurrentStep(1)} />}
          {currentStep === 1 && <SetupPage project={project} setProject={setProject} apiKey={apiKey} setApiKey={setApiKey} onNext={() => setCurrentStep(2)} onBack={() => setCurrentStep(0)} />}
          {currentStep === 2 && <WebsiteAssessment assessmentData={assessments.website} setAssessmentData={(d) => updateAssessment('website', d)} apiKey={apiKey} project={project} onPrev={() => setCurrentStep(1)} onNext={() => setCurrentStep(3)} onClearScores={() => setScores(null)} />}
          {currentStep === 3 && <SocialMediaAssessment assessmentData={assessments.social} setAssessmentData={(d) => updateAssessment('social', d)} apiKey={apiKey} project={project} onPrev={() => setCurrentStep(2)} onNext={() => setCurrentStep(4)} onClearScores={() => setScores(null)} />}
          {currentStep === 4 && <AIReputationPage assessmentData={assessments.aiReputation} setAssessmentData={(d) => updateAssessment('aiReputation', d)} apiKey={apiKey} project={project} onPrev={() => setCurrentStep(3)} onNext={() => setCurrentStep(5)} onClearScores={() => setScores(null)} />}
          {currentStep === 5 && <EarnedMediaAssessment assessmentData={assessments.earnedMedia} setAssessmentData={(d) => updateAssessment('earnedMedia', d)} apiKey={apiKey} project={project} onPrev={() => setCurrentStep(4)} onNext={() => setCurrentStep(6)} onClearScores={() => setScores(null)} />}
          {currentStep === 6 && <ReportPage project={project} scores={scores} setScores={setScores} assessments={assessments} apiKey={apiKey} onSave={handleSave} onPrev={() => setCurrentStep(5)} profile={profile} />}
        </>
      )}
    </div>
  );
}


// App wrapped with ErrorBoundary for production error handling
export default function App() {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
}
