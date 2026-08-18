import React, { useState, useEffect, useRef, useMemo } from 'react';
import { FOOTPRINT_CHANNELS, summariseFootprint, ATTRIBUTES, BUSINESS_MODELS, getMaturityStage, MATURITY_STAGES, SERVICE_RECOMMENDATIONS, FRAMEWORK_VERSION, CAMPAIGN_LADDER, CAMPAIGN_MODIFIERS, CAMPAIGN_MODIFIER_ATTRIBUTES, CAMPAIGN_EVIDENCE_RULE, getCampaignLevel, getCampaignModifier, applyCampaignModifiers } from './data/rubric';
import { getAllRecommendations, formatBudget, getForceIncludeServicesFromAIReputation } from './data/serviceMapping';
import { Compass, ArrowRight, ArrowLeft, Globe, Users, Bot, Newspaper, BarChart3, FileText, Play, Check, Loader2, ChevronDown, Download, Save, Plus, Trash2, X, Upload, Image, ExternalLink, Share2, Copy, LogOut, Shield, UserCheck, UserX, TrendingUp, TrendingDown, Star, Lightbulb, Sparkles, AlertCircle, Target, Search, Filter, Hash, RefreshCw } from 'lucide-react';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableCell, TableRow, WidthType, BorderStyle, AlignmentType, ShadingType, ImageRun, LevelFormat, Footer as DocxFooter, Header as DocxHeader, PageNumber, NumberFormat } from 'docx';
import { saveAs } from 'file-saver';
import { createPortal } from 'react-dom';
import { jsPDF } from 'jspdf';
import { createClientReport, fetchClientReport, decryptPayload, listClientReports, revokeClientReport, resetClientReportPassword } from './lib/supabase';
import html2canvas from 'html2canvas';

const APP_VERSION = '3.0.0';
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
  setReadonly,
  deleteUser
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
            <div className="w-16 h-16 bg-red-100 flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-8 h-8 text-red-600" />
            </div>
            <h1 className="dc-h2 text-[#0B0B0B] mb-2">Something went wrong</h1>
            <p className="text-[#8A877D] mb-6">An unexpected error occurred. Please refresh the page to try again.</p>
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
    <div className="min-h-screen bg-[#F2F0EA] flex items-center justify-center p-4 md:p-8">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <img src="https://ktuyiikwhspwmzvyczit.supabase.co/storage/v1/object/public/assets/brand/antenna-new-logo.svg" alt="Antenna Group" className="h-8" style={{ filter: 'brightness(0)' }} />
            <div className="h-6 w-px bg-[#0B0B0B]" />
            <span className="dc-kicker text-[#0B0B0B]">Conscious Compass</span>
          </div>
          <p className="text-[#8A877D]">{isLogin ? 'Sign in to access the assessment tool' : 'Create an account to get started'}</p>
        </div>
        
        <form onSubmit={handleSubmit} className="card p-6">
          {!isLogin && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-[#0B0B0B] mb-2">Full Name</label>
              <input 
                type="text" 
                value={fullName} 
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Your name"
                className="w-full px-4 py-3 border border-[#DCDAD3] bg-white"
                required={!isLogin}
              />
            </div>
          )}
          
          <div className="mb-4">
            <label className="block text-sm font-medium text-[#0B0B0B] mb-2">Email</label>
            <input 
              type="email" 
              value={email} 
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              className="w-full px-4 py-3 border border-[#DCDAD3] bg-white"
              required
            />
          </div>
          
          <div className="mb-4">
            <label className="block text-sm font-medium text-[#0B0B0B] mb-2">Password</label>
            <input 
              type="password" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)}
              placeholder={isLogin ? "Enter password" : "Create password (min 6 chars)"}
              className="w-full px-4 py-3 border border-[#DCDAD3] bg-white"
              required
              minLength={6}
            />
          </div>
          
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm">
              {error}
            </div>
          )}
          
          {message && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 text-sm">
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
              className="text-sm text-[#B23A3A] hover:underline"
            >
              {isLogin ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
            </button>
          </div>
        </form>
        
        <p className="text-center text-xs text-[#B3B0A8] mt-6">
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
    if (data) {
      try {
        const res = await fetch('/api/list-users');
        const json = await res.json();
        if (json.error) console.error('list-users error:', json.error);
        const loginMap = json.loginMap || {};
        setUsers(data.map(u => ({ ...u, last_login: loginMap[u.id] || null })));
      } catch (e) {
        console.error('list-users fetch failed:', e);
        setUsers(data);
      }
    }
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

  const handleDelete = async (userId, userName) => {
    if (confirm(`Permanently delete "${userName || 'this user'}"? This cannot be undone.`)) {
      // Optimistically remove from UI immediately
      setUsers(prev => prev.filter(u => u.id !== userId));
      const { error } = await deleteUser(userId);
      if (error) {
        alert(`Delete failed: ${error}`);
        loadUsers(); // Re-fetch to restore accurate state
      }
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

  const formatDate = (ts) => {
    if (!ts) return null;
    const d = new Date(ts);
    const now = new Date();
    const diffDays = Math.floor((now - d) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  return (
    <div className="min-h-screen bg-[#F2F0EA]">
      <div className="dc-wrap dc-page pt-8">
        <div className="flex items-center gap-4 mb-8">
          <button onClick={onBack} className="btn-secondary flex items-center gap-2">
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
          <div>
            <h1 className="dc-h2 text-[#0B0B0B]">User Management</h1>
            <p className="text-sm text-[#8A877D]">Approve users and manage access</p>
          </div>
        </div>

        {loading ? (
          <div className="card p-12 text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-[#B23A3A]" />
            <p className="mt-4 text-[#8A877D]">Loading users...</p>
          </div>
        ) : (
          <div className="space-y-6">

            {/* Pending Users */}
            {users.filter(u => !u.is_approved).length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-[#8A877D] uppercase tracking-wider mb-3 flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-yellow-600" />
                  Pending Approval ({users.filter(u => !u.is_approved).length})
                </h2>
                <div className="space-y-3">
                  {users.filter(u => !u.is_approved).map(user => (
                    <div key={user.id} className="bg-yellow-50 border border-yellow-200 p-5">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 bg-yellow-400 flex items-center justify-center text-white font-semibold flex-shrink-0">
                          {(user.full_name || user.email || '?')[0].toUpperCase()}
                        </div>
                        <div>
                          <div className="font-semibold text-[#0B0B0B]">{user.full_name || 'No name'}</div>
                          <div className="text-sm text-[#8A877D]">{user.email}</div>
                          <div className="text-xs text-[#B3B0A8] mt-0.5">Signed up {formatDate(user.created_at)}</div>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button onClick={async () => { await approveUser(user.id); await setReadonly(user.id, true); loadUsers(); }}
                          className="btn-secondary text-sm px-4 py-2">
                          Approve (Read-only)
                        </button>
                        <button onClick={() => handleApprove(user.id)} className="btn-primary text-sm px-4 py-2">
                          Approve (Full Access)
                        </button>
                        <button onClick={() => handleDelete(user.id, user.full_name || user.email)}
                          className="text-sm px-3 py-2 border border-red-300 text-red-600 hover:bg-red-50 transition-colors ml-auto">
                          <Trash2 className="w-4 h-4 inline mr-1" />Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Active Users */}
            <div>
              <h2 className="text-sm font-semibold text-[#8A877D] uppercase tracking-wider mb-3 flex items-center gap-2">
                <Users className="w-4 h-4 text-[#059669]" />
                Active Users ({users.filter(u => u.is_approved).length})
              </h2>
              <div className="space-y-3">
                {users.filter(u => u.is_approved).map(user => {
                  const isSelf = user.id === currentUser.id;
                  const roleColor = user.is_admin ? 'bg-[#DEE42F]' : user.is_readonly ? 'bg-[#B3B0A8]' : 'bg-[#059669]';
                  const roleLabel = user.is_admin ? 'Admin' : user.is_readonly ? 'Read-only' : 'Full Access';
                  return (
                    <div key={user.id} className="bg-white border border-[#DCDAD3] p-5">
                      {/* User info row */}
                      <div className="flex items-start gap-3 mb-4">
                        <div className={`w-10 h-10 flex items-center justify-center text-white font-semibold flex-shrink-0 ${roleColor}`}>
                          {(user.full_name || user.email || '?')[0].toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-[#0B0B0B]">{user.full_name || 'No name'}</span>
                            <span className={`text-xs px-2 py-0.5 text-white ${roleColor}`}>{roleLabel}</span>
                            {isSelf && <span className="text-xs text-[#B3B0A8]">(you)</span>}
                          </div>
                          <div className="text-sm text-[#8A877D] mt-0.5 truncate">{user.email}</div>
                          <div className="flex gap-3 mt-1">
                            <span className="text-xs text-[#B3B0A8]">
                              Joined {formatDate(user.created_at)}
                            </span>
                            {user.last_login && (
                              <span className="text-xs text-[#B3B0A8]">
                                · Last login {formatDate(user.last_login)}
                              </span>
                            )}
                            {!user.last_login && (
                              <span className="text-xs text-[#C4C1BB]">· Never logged in</span>
                            )}
                          </div>
                        </div>
                      </div>
                      {/* Actions row */}
                      {!isSelf && (
                        <div className="flex flex-wrap gap-2 pt-3 border-t border-[#E4E2DC]">
                          {!user.is_admin && (
                            <button onClick={() => handleToggleReadonly(user.id, user.is_readonly)}
                              className={`text-sm px-3 py-1.5  border transition-colors ${
                                user.is_readonly
                                  ? 'border-[#059669] text-[#059669] hover:bg-[#059669]/10'
                                  : 'border-[#9CA3AF] text-[#B3B0A8] hover:bg-[#B3B0A8]/10'
                              }`}>
                              {user.is_readonly ? 'Grant Full Access' : 'Set Read-only'}
                            </button>
                          )}
                          <button onClick={() => handleToggleAdmin(user.id, user.is_admin)}
                            className={`text-sm px-3 py-1.5  border transition-colors ${
                              user.is_admin
                                ? 'border-[#0B0B0B] text-[#B23A3A] hover:bg-[#DEE42F]/10'
                                : 'border-[#DCDAD3] text-[#8A877D] hover:border-[#0B0B0B]'
                            }`}>
                            <Shield className="w-3.5 h-3.5 inline mr-1" />
                            {user.is_admin ? 'Remove Admin' : 'Make Admin'}
                          </button>
                          <div className="flex gap-2 ml-auto">
                            <button onClick={() => handleRevoke(user.id)}
                              className="text-sm px-3 py-1.5 border border-red-200 text-red-500 hover:bg-red-50 transition-colors">
                              <UserX className="w-3.5 h-3.5 inline mr-1" />Revoke
                            </button>
                            <button onClick={() => handleDelete(user.id, user.full_name || user.email)}
                              className="text-sm px-3 py-1.5 border border-red-300 text-red-700 hover:bg-red-50 transition-colors">
                              <Trash2 className="w-3.5 h-3.5 inline mr-1" />Delete
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
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

// ─────────────────────────────────────────────────────────────
// BENCHMARK ENGINE (v2.21)
//
// Benchmarks in a client report are a SNAPSHOT, frozen at save time, never
// recalculated live. A report is a deliverable: the numbers in it must still
// be the numbers when the client opens it three months later, and shared
// reports are stored records with no access to the reader's corpus.
// ─────────────────────────────────────────────────────────────

// Minimum brands in a sector before its benchmark is shown in a client report.
// Below this the report falls back to the all-brands benchmark and says so.
// One number, deliberately easy to retune as the corpus grows.
const BENCHMARK_MIN_N = 5;

// Results scored under any 2.x rubric are treated as one continuous corpus.
// Attribute definitions have been stable across 2.x; only signals have been
// extended. Filtering to the current version alone would leave the benchmark
// empty on release day.
const BENCHMARK_RUBRIC_MAJOR = '2';

const rubricMajor = (v) => String(v || '2.3').split('.')[0];

function averageAttributes(brands) {
  const attrAvgs = {};
  ATTRIBUTES.forEach(attr => {
    attrAvgs[attr.id] = Math.round(
      brands.reduce((sum, b) => sum + (b.scores?.[attr.id] || 0), 0) / brands.length
    );
  });
  return attrAvgs;
}

function percentileOf(value, values) {
  if (!values.length) return null;
  const below = values.filter(v => v < value).length;
  const equal = values.filter(v => v === value).length;
  return Math.round(((below + equal / 2) / values.length) * 100);
}

// Rank is easier to read than a percentile on a small cohort. With 24 brands
// each one moves the percentile by about four points, so the precision the
// percentile implies is not really there.
function rankOf(value, values) {
  if (!values.length) return null;
  return values.filter(v => v > value).length + 1;
}

// 1st, 2nd, 3rd, 21st, 23rd. Not 23th.
function ordinal(n) {
  if (n == null || !Number.isFinite(Number(n))) return '';
  const v = Math.abs(Math.round(Number(n)));
  const last2 = v % 100;
  if (last2 >= 11 && last2 <= 13) return `${v}th`;
  return `${v}${['th', 'st', 'nd', 'rd'][v % 10] || 'th'}`;
}

/**
 * Builds the frozen benchmark record stored alongside a report.
 * Returns null when there is nothing meaningful to compare against.
 */
function buildBenchmarkSnapshot(results, { industry, industryName, brandName, totalScore, scores }) {
  if (!Array.isArray(results) || results.length === 0) {
    return { unavailable: true, reason: 'No assessed brands are loaded, so there is nothing to benchmark against yet.', totalCount: 0 };
  }

  const pool = results.filter(r =>
    r &&
    typeof r.totalScore === 'number' &&
    r.scores &&
    rubricMajor(r.rubricVersion) === BENCHMARK_RUBRIC_MAJOR &&
    // Never let the brand being assessed sit inside its own benchmark.
    !(r.brandName && brandName && r.brandName.trim().toLowerCase() === brandName.trim().toLowerCase())
  );

  if (pool.length === 0) {
    const sameBrand = results.filter(r => r.brandName && brandName && r.brandName.trim().toLowerCase() === brandName.trim().toLowerCase()).length;
    const wrongRubric = results.filter(r => rubricMajor(r.rubricVersion) !== BENCHMARK_RUBRIC_MAJOR).length;
    const malformed = results.filter(r => typeof r.totalScore !== 'number' || !r.scores).length;
    return {
      unavailable: true,
      reason: `No comparable assessments. Of ${results.length} loaded: ${sameBrand} are this same brand and excluded, ${wrongRubric} sit outside framework 2.x, ${malformed} are missing scores.`,
      totalCount: results.length,
    };
  }

  const sectorBrands = industry ? pool.filter(r => r.industry === industry) : [];
  const usingSector = sectorBrands.length >= BENCHMARK_MIN_N;
  const cohort = usingSector ? sectorBrands : pool;

  const versions = [...new Set(cohort.map(r => r.rubricVersion || '2.3'))].sort();
  const dates = cohort.map(r => r.createdAt || r.created_at).filter(Boolean).sort();

  const brandScores = {};
  ATTRIBUTES.forEach(attr => { brandScores[attr.id] = scores?.[attr.id]?.score || 0; });

  return {
    generatedAt: new Date().toISOString(),
    scope: usingSector ? 'industry' : 'all',
    // When we fall back, say plainly why. An unexplained benchmark is a
    // benchmark a client will challenge.
    fallbackReason: usingSector
      ? null
      : (industry
        ? `Fewer than ${BENCHMARK_MIN_N} assessed brands in ${industryName || 'this sector'}. Benchmarked against all assessed brands instead.`
        : 'No sector selected. Benchmarked against all assessed brands.'),
    cohortLabel: usingSector ? (industryName || industry) : 'All assessed brands',
    industry: industry || null,
    industryName: industryName || null,
    count: cohort.length,
    sectorCount: sectorBrands.length,
    totalCount: pool.length,
    minN: BENCHMARK_MIN_N,
    rubricVersions: versions,
    dateRange: dates.length ? { from: dates[0], to: dates[dates.length - 1] } : null,
    avgScore: Math.round(cohort.reduce((s, b) => s + b.totalScore, 0) / cohort.length),
    attrAvgs: averageAttributes(cohort),
    attrRanges: ATTRIBUTES.reduce((acc, attr) => {
      const vals = cohort.map(b => b.scores?.[attr.id] || 0);
      acc[attr.id] = { min: Math.min(...vals), max: Math.max(...vals) };
      return acc;
    }, {}),
    percentile: percentileOf(totalScore, cohort.map(b => b.totalScore)),
    rank: rankOf(totalScore, cohort.map(b => b.totalScore)),
    allBrandsAvg: Math.round(pool.reduce((s, b) => s + b.totalScore, 0) / pool.length),
    brandScores,
    brandTotal: totalScore,
  };
}

// Ordinal suffix used by the masthead and the benchmark panel.
function ordinalSuffix(n) {
  if (n == null || !Number.isFinite(Number(n))) return '';
  const v = Math.abs(Math.round(Number(n))), l = v % 100;
  if (l >= 11 && l <= 13) return `${v}th`;
  return `${v}${['th', 'st', 'nd', 'rd'][v % 10] || 'th'}`;
}

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

// Shared voice guidance applied to every prose output across the app.
// Mirrored into the server-side compositor prompts (newsletter, landscape,
// insights, brand intelligence) and the direct web-search calls.
const VOICE_GUIDANCE = `VOICE:
Write like a strategist talking, not an AI writing. Short sentences. Plain words. Lead with the verdict, then the evidence. Stop when the point is made.
Cut throat-clearing and filler: no "it's worth noting", "it's important to", "overall", "in today's landscape", "when it comes to", "plays a crucial role".
Banned constructions: the rule-of-three list, "not just X, but Y", the "It's not about X, it's about Y" pivot, "From X to Y", "Here's the thing", and tidy antithesis used for rhythm.
No motivational closers. No summary that restates what you just said.
Be willing to provoke. Where evidence supports a hard line, take it. Name the gap, the contradiction, the bluff. A pointed question is fine when it forces a decision.`;

async function callClaude(prompt, apiKey, primaryImage = null, additionalImages = [], temperature = 0, isJson = false, maxTokens = 6000) {
  // Add standard instructions for consistency
  const enhancedPrompt = `${prompt}

${VOICE_GUIDANCE}

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
        max_tokens: maxTokens,
        temperature: 0,
        messages: [{ role: 'user', content }]
      })
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || `API error: ${response.status}`);
    }
    const data = await response.json();
    const stopReason = data.stop_reason;
    result = data.content[0].text;
    if (isJson && stopReason === 'max_tokens') {
      throw new Error('Response was cut short — increase max tokens or reduce prompt size.');
    }
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
        max_tokens: maxTokens,
        temperature: 0,
        messages: [{ role: 'user', content }]
      })
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error?.message || `API error: ${response.status}`);
    }
    const data = await response.json();
    const stopReason = data.stop_reason;
    result = data.content[0].text;
    if (isJson && stopReason === 'max_tokens') {
      throw new Error('Response was cut short — increase max tokens or reduce prompt size.');
    }
  }
  
  // Post-process to remove em/en-dashes — skip for JSON responses to avoid corruption
  if (!isJson) {
    result = result.replace(/—/g, ', ').replace(/–/g, ' to ');
  }
  
  return result;
}

// Spider Chart Component
function SpiderChart({ scores, size = 400, animate = true }) {
  const [progress, setProgress] = useState(animate ? 0 : 1);

  useEffect(() => {
    if (!animate) { setProgress(1); return; }
    // Small delay so the page has painted before the animation begins
    const delay = setTimeout(() => {
      const duration = 2500;
      const start = Date.now();
      const tick = () => {
        const elapsed = Date.now() - start;
        const raw = Math.min(elapsed / duration, 1);
        // Ease-out cubic
        const eased = 1 - Math.pow(1 - raw, 3);
        setProgress(eased);
        if (raw < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }, 150);
    return () => clearTimeout(delay);
  }, [animate, scores]);

  const data = ATTRIBUTES.map(attr => ({
    name: attr.name,
    value: (scores?.[attr.id]?.score || 0) * progress,
    rawValue: scores?.[attr.id]?.score || 0,
  }));

  const overall = scores ? Math.round(
    ATTRIBUTES.filter(a => scores[a.id]?.score !== undefined)
      .reduce((sum, a) => sum + (scores[a.id]?.score || 0), 0) / 8
  ) : 0;

  const RING_PATHS = [
    "M226 169.75L186.225 186.225L169.75 226L186.225 265.775L206.113 274.012L226 282.25L265.775 265.775L282.25 226L265.775 186.225L226 169.75Z",
    "M226 113.5L146.451 146.451L113.5 226L146.451 305.549L226 338.5L305.549 305.549L338.5 226L305.549 146.451L226 113.5Z",
    "M226 57.25L106.676 106.676L57.25 226L106.676 345.324L226 394.75L345.324 345.324L394.75 226L345.324 106.676L226 57.25Z",
    "M226 1L66.901 66.901L1 226L66.901 385.099L226 451L385.099 385.099L451 226L385.099 66.901L226 1Z",
  ];

  const calculateLabelPosition = (index, total, radius) => {
    const angle = (index * 2 * Math.PI / total) - Math.PI / 2;
    const isCardinal = index % 2 === 0;
    const actualRadius = isCardinal ? 235 : radius;
    const x = 226 + actualRadius * Math.cos(angle);
    const y = 226 + actualRadius * Math.sin(angle);
    let textAnchor = "middle", dy = "0";
    if (!isCardinal) {
      if (Math.cos(angle) < 0) return { x: x + 10, y, textAnchor: "end", dy };
      if (Math.cos(angle) > 0) return { x: x - 10, y, textAnchor: "start", dy };
    }
    if (Math.abs(Math.cos(angle)) > 0.85) textAnchor = Math.cos(angle) > 0 ? "start" : "end";
    if (Math.abs(Math.sin(angle)) > 0.85) dy = Math.sin(angle) > 0 ? "1em" : "-0.5em";
    return { x, y, textAnchor, dy };
  };

  const dataPoints = data.map((item, index) => {
    const normalizedValue = (item.value / 100) * 225;
    const angle = (index * 2 * Math.PI / data.length) - Math.PI / 2;
    return {
      x: 226 + normalizedValue * Math.cos(angle),
      y: 226 + normalizedValue * Math.sin(angle),
    };
  });
  const pointsString = dataPoints.map(p => `${p.x},${p.y}`).join(' ');

  return (
    <div style={{ width: '100%', aspectRatio: '1/1', position: 'relative', backgroundColor: '#efede9' }}>
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="-100 -50 652 552" style={{ width: '100%', height: '100%' }}>

        {/* Background rings */}
        {[...RING_PATHS].reverse().map((path, i) => (
          <path key={`ring-${i}`} d={path}
            fill={i % 2 === 0 ? '#e1dfda' : '#f7f6f4'} stroke="none" />
        ))}

        {/* Data shape */}
        <polygon points={pointsString} fill="#E2E65A" stroke="#CFD32F" strokeWidth="1" />

        {/* Grid outlines */}
        <path d={RING_PATHS.join('')} stroke="#111720" strokeWidth="1.5" fill="none" />

        {/* Centre axis lines */}
        {data.map((_, i) => {
          const angle = (i * 2 * Math.PI / data.length) - Math.PI / 2;
          return (
            <line key={`axis-${i}`} x1="226" y1="226"
              x2={226 + 225 * Math.cos(angle)} y2={226 + 225 * Math.sin(angle)}
              stroke="#111720" strokeOpacity="0.1" strokeWidth="1.5" />
          );
        })}

        {/* Data point circles */}
        {dataPoints.map((point, i) => (
          <circle key={`pt-${i}`} cx={point.x} cy={point.y} r="4"
            fill="#CFD32F" stroke="white" strokeWidth="1.5"
            style={{ opacity: progress }} />
        ))}

        {/* Score values */}
        {dataPoints.map((point, i) => {
          const angle = (i * 2 * Math.PI / data.length) - Math.PI / 2;
          const offset = 18;
          return (
            <text key={`score-${i}`}
              x={point.x + offset * Math.cos(angle)}
              y={point.y + offset * Math.sin(angle)}
              textAnchor="middle" dominantBaseline="middle"
              style={{ fontSize: '13px', fontWeight: '700', fill: '#6B6B00', opacity: progress }}>
              {data[i].rawValue}
            </text>
          );
        })}

        {/* Attribute labels — always visible */}
        {data.map((item, i) => {
          const pos = calculateLabelPosition(i, data.length, 260);
          return (
            <text key={`label-${i}`} x={pos.x} y={pos.y}
              textAnchor={pos.textAnchor} dy={pos.dy}
              fill="#111720" style={{ fontSize: '15px', fontWeight: '500' }}>
              {item.name}
            </text>
          );
        })}

        {/* Centre score */}
        <circle cx="226" cy="226" r="36" fill="#CFD32F" />
        <text x="226" y="226" textAnchor="middle" dominantBaseline="middle"
          style={{ fontSize: '28px', fontWeight: '700', fill: '#111720' }}>
          {overall}
        </text>

      </svg>
    </div>
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
        return <polygon key={level} points={pts.join(' ')} fill="none" stroke="#DCDAD3" strokeWidth="0.5" />;
      })}
      {attrs.map((_, i) => {
        const angle = angleStep * i - Math.PI / 2;
        return <line key={i} x1={center} y1={center} x2={center + radius * Math.cos(angle)} y2={center + radius * Math.sin(angle)} stroke="#DCDAD3" strokeWidth="0.5" />;
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

const LANDSCAPE_SECTOR_COLORS = [
  '#E53935', '#1976D2', '#F57C00', '#388E3C',
  '#7B1FA2', '#0097A7', '#C2185B', '#5D4037',
  '#1565C0', '#2E7D32', '#E65100', '#4527A0',
];

function ComparisonSpiderChart({ brands, size = 320, industryAvg = null, avgLabel = 'Industry avg', animateOnScroll = false }) {
  // Polygons grow out from the centre when the chart scrolls into view. With
  // animation off, progress is pinned at 1, so the comparison page is unchanged.
  const [revealRef, revealed] = useReveal(0.3, 900);
  const wrapRef = revealRef;
  const progress = animateOnScroll ? revealed : 1;
  const inView = progress > 0;
  const padding = 55;
  const viewBoxSize = size + padding * 2;
  const center = viewBoxSize / 2;
  const radius = size * 0.40;
  const attrs = ATTRIBUTES;
  const angleStep = (2 * Math.PI) / attrs.length;

  const getPoint = (index, value) => {
    const angle = angleStep * index - Math.PI / 2;
    // Only the plotted values scale with progress. Grid and labels hold still.
    const r = ((value * progress) / 100) * radius;
    return { x: center + r * Math.cos(angle), y: center + r * Math.sin(angle) };
  };

  const gridLevels = [20, 40, 60, 80, 100];

  return (
    <div ref={wrapRef} style={animateOnScroll ? { transition: 'opacity 400ms ease', opacity: inView ? 1 : 0.35 } : undefined}>
      <svg viewBox={`0 0 ${viewBoxSize} ${viewBoxSize}`} style={{ width: '100%', maxWidth: size + 'px', overflow: 'visible' }} className="mx-auto">
        {/* Grid polygons */}
        {gridLevels.map(level => {
          const pts = attrs.map((_, i) => {
            const angle = angleStep * i - Math.PI / 2;
            const r = (level / 100) * radius;
            return `${center + r * Math.cos(angle)},${center + r * Math.sin(angle)}`;
          });
          return <polygon key={level} points={pts.join(' ')} fill="none" stroke={level === 100 ? '#DCDAD3' : '#DCDAD3'} strokeWidth={level === 100 ? 1.5 : 1} />;
        })}
        {/* Grid value labels */}
        {[20, 40, 60, 80].map(level => (
          <text key={`lbl-${level}`} x={center} y={center - (level / 100) * radius - 4} textAnchor="middle" style={{ fontSize: '8px', fill: '#B3B0A8' }}>{level}</text>
        ))}
        {/* Axis lines */}
        {attrs.map((_, i) => {
          const angle = angleStep * i - Math.PI / 2;
          return <line key={i} x1={center} y1={center} x2={center + radius * Math.cos(angle)} y2={center + radius * Math.sin(angle)} stroke="#DCDAD3" strokeWidth="1" />;
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
            <text key={attr.id} x={x} y={y} textAnchor="middle" dominantBaseline="middle" style={{ fontSize: '11px', fontWeight: '600', fill: '#0B0B0B' }}>
              {attr.name}
            </text>
          );
        })}
      </svg>
      {/* Legend */}
      <div className="flex flex-wrap justify-center gap-3 mt-3">
        {brands.map((brand, bi) => (
          <div key={brand.id || bi} className="flex items-center gap-1.5">
            <div className="w-3 h-3 flex-shrink-0" style={{ backgroundColor: COMPARISON_COLORS[bi % COMPARISON_COLORS.length] }} />
            <span className="text-xs font-medium text-[#0B0B0B]">{brand.brandName}</span>
            <span className="text-xs text-[#8A877D]">({brand.totalScore})</span>
          </div>
        ))}
        {industryAvg && (
          <div className="flex items-center gap-1.5">
            <div className="w-5 h-0.5 bg-[#B3B0A8] border-t border-dashed" style={{ borderTop: '2px dashed #9CA3AF' }} />
            <span className="text-xs text-[#B3B0A8]">{avgLabel}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// Maturity Continuum Visual
// Fires once when the element scrolls into view. Same pattern MaturityContinuum
// already uses, lifted out so the campaign ladder and the benchmark radar can
// share it rather than each rolling their own observer.
function useInView(threshold = 0.25) {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    // No observer support: reveal on the next tick rather than synchronously
    // inside the effect, which would trigger a cascading render.
    if (typeof IntersectionObserver === 'undefined') {
      const t = setTimeout(() => setInView(true), 0);
      return () => clearTimeout(t);
    }
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setInView(true); obs.disconnect(); }
    }, { threshold });
    obs.observe(node);
    return () => obs.disconnect();
  }, [threshold]);

  return [ref, inView];
}

// Ramps 0 to 1 once the element is in view.
//
// CSS cannot transition an SVG `d` attribute set as a React prop, so the
// radar was snapping straight to full rather than growing. Driving the value
// on requestAnimationFrame and re-rendering the geometry each frame is what
// actually produces movement.
function useReveal(threshold = 0.25, duration = 900) {
  const [ref, inView] = useInView(threshold);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!inView) return;
    if (typeof window === 'undefined' || !window.requestAnimationFrame) { setProgress(1); return; }
    let raf;
    const start = performance.now();
    // easeOutCubic
    const ease = (t) => 1 - Math.pow(1 - t, 3);
    const tick = (now) => {
      const t = Math.min((now - start) / duration, 1);
      setProgress(ease(t));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, duration]);

  return [ref, progress, inView];
}

// Campaign coherence ladder. Five rungs; level 0 is the absence of a campaign,
// not a rung. Rungs fill left to right on scroll, staggered. Shared by the
// report, the shared report and the client report so all three behave alike.
function CampaignLadder({ level }) {
  const [ref, inView] = useInView(0.4);
  const lvl = Number.isFinite(Number(level)) ? Number(level) : 0;

  return (
    <div ref={ref}>
      <div className="flex gap-1 mb-1">
        {CAMPAIGN_LADDER.filter(l => l.level > 0).map((l, i) => (
          <div key={l.level} className="flex-1 text-center">
            <div className="h-1.5 mb-1 bg-[#F2F0EA] overflow-hidden">
              <div
                className="h-full bg-[#DEE42F] origin-left"
                style={{
                  transform: `scaleX(${inView && lvl >= l.level ? 1 : 0})`,
                  transition: 'transform 520ms cubic-bezier(0.22, 1, 0.36, 1)',
                  transitionDelay: `${i * 110}ms`,
                }}
              />
            </div>
            <div
              className={`text-[9px] leading-tight ${l.level === lvl ? 'text-[#0B0B0B] font-semibold' : 'text-[#999]'}`}
              style={{
                opacity: inView ? 1 : 0,
                transition: 'opacity 400ms ease',
                transitionDelay: `${i * 110 + 120}ms`,
              }}
            >
              {l.name}
            </div>
          </div>
        ))}
      </div>
      {lvl === 0 && (
        <p className="text-[10px] text-[#B23A3A] font-semibold mb-2">
          No campaign detected. The brand sits below the first rung.
        </p>
      )}
      <div className="mb-3" />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// BRAND FOOTPRINT — mosaic and ledger
//
// Palette is deliberately its own: warm paper, electric lime, near-black ink.
// Intensity descends down the ranked rows so the eye reads the order without
// needing the numbers.
//
// Note there is no reach column. Audience reach is not publicly observable and
// inventing it would undermine everything else on the page. The ledger reports
// SIGNALS instead: the count of distinct pieces of evidence actually found.
// ─────────────────────────────────────────────────────────────
const FP_PAPER = '#FFFFFF';
const FP_INK   = '#0B0B0B';
const FP_LIME  = '#DEE42F';
const FP_EMPTY = '#E4E2DC';
const FP_MUTED = '#8A877D';
const FP_TILES = 13;

// Ranked rows step from lime through olive to ink.
const FP_RAMP = ['#DFF01F', '#D3E81C', '#BFDA18', '#A5C214', '#8AA810', '#3A3A36', '#0B0B0B', '#0B0B0B'];

function FootprintMosaic({ footprint, brandName, compact = false }) {
  const summary = summariseFootprint(footprint);
  const [ref, inView] = useInView(0.15);
  if (!summary) return null;

  // Ranked by share, but every channel is shown. An empty channel is a finding,
  // so the zeros stay on the page rather than being filtered out.
  const rows = [...summary.rows].sort((a, b) => (b.share - a.share) || (b.signals - a.signals));

  return (
    <div ref={ref} style={{ backgroundColor: FP_PAPER }} className="p-6 sm:p-8">
      {/* Masthead */}
      <div className="flex flex-wrap items-start justify-between gap-6 mb-5">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-3">
            <span className="inline-block w-2.5 h-2.5" style={{ backgroundColor: FP_LIME }} />
            <span className="text-[10px] font-bold uppercase tracking-[0.16em]" style={{ color: FP_INK }}>
              Brand Footprint
            </span>
          </div>
          <h3 className="font-bold tracking-tight leading-[0.95]"
            style={{ color: FP_INK, fontSize: compact ? '1.9rem' : '2.6rem' }}>
            Where the brand shows up.
          </h3>
        </div>
        <div className="flex gap-8 flex-shrink-0">
          <div className="text-right">
            <div className="text-[9px] font-bold uppercase tracking-[0.14em] mb-1" style={{ color: FP_MUTED }}>
              Total signals
            </div>
            <div className="font-bold tracking-tight" style={{ color: FP_INK, fontSize: compact ? '1.5rem' : '2rem' }}>
              {summary.totalSignals.toLocaleString()}
            </div>
          </div>
          <div className="text-right border-l pl-8" style={{ borderColor: FP_EMPTY }}>
            <div className="text-[9px] font-bold uppercase tracking-[0.14em] mb-1" style={{ color: FP_MUTED }}>
              Channels with evidence
            </div>
            <div className="font-bold tracking-tight" style={{ color: FP_INK, fontSize: compact ? '1.5rem' : '2rem' }}>
              {summary.channelsWithEvidence} of {summary.channelCount}
            </div>
          </div>
        </div>
      </div>

      <div style={{ height: 2, backgroundColor: FP_INK }} className="mb-4" />

      {/* Column headers */}
      <div className="grid items-end gap-4 pb-2 text-[9px] font-bold uppercase tracking-[0.14em]"
        style={{ gridTemplateColumns: '1.6fr 3fr 0.6fr 0.6fr 0.8fr', color: FP_MUTED }}>
        <div>Channel</div>
        <div className="hidden sm:block">Presence</div>
        <div className="text-right">Share</div>
        <div className="text-right">Signals</div>
        <div className="text-right">Sentiment</div>
      </div>

      {/* Ledger */}
      {rows.map((row, i) => {
        const has = row.share > 0 || row.signals > 0;
        // Scaled against the leading channel, not against 100. Otherwise a
        // brand whose best channel is 33% never fills a single row and the
        // mosaic reads as uniformly weak.
        const filled = has
          ? Math.max(1, Math.min(FP_TILES, Math.ceil((row.share / (summary.maxShare || 100)) * FP_TILES)))
          : 0;
        const tone = FP_RAMP[Math.min(i, FP_RAMP.length - 1)];
        return (
          <div key={row.id}
            className="grid items-center gap-4 py-3 border-t"
            style={{ gridTemplateColumns: '1.6fr 3fr 0.6fr 0.6fr 0.8fr', borderColor: FP_EMPTY }}>
            <div className="min-w-0">
              <div className="font-bold text-[15px] leading-tight truncate"
                style={{ color: has ? FP_INK : FP_MUTED }}>{row.name}</div>
              <div className="text-[11px] mt-0.5 truncate" style={{ color: FP_MUTED }}>
                {row.evidence || 'No evidence found'}
              </div>
            </div>

            <div className="hidden sm:flex gap-[3px]">
              {Array.from({ length: FP_TILES }).map((_, t) => (
                <div key={t} className="flex-1"
                  style={{
                    height: 26,
                    backgroundColor: t < filled ? tone : FP_EMPTY,
                    opacity: inView ? 1 : 0,
                    transform: inView ? 'scaleY(1)' : 'scaleY(0.3)',
                    transition: 'opacity 260ms ease, transform 260ms cubic-bezier(0.22, 1, 0.36, 1)',
                    transitionDelay: `${i * 60 + t * 22}ms`,
                  }} />
              ))}
            </div>

            <div className="text-right font-bold text-[17px] tabular-nums"
              style={{ color: has ? FP_INK : FP_MUTED }}>
              {has ? `${row.share}%` : '—'}
            </div>
            <div className="text-right text-[13px] tabular-nums" style={{ color: has ? FP_INK : FP_MUTED }}>
              {has ? row.signals : '—'}
            </div>
            <div className="text-right text-[13px] tabular-nums" style={{ color: has ? FP_INK : FP_MUTED }}>
              {row.sentiment == null ? '—' : `${row.sentiment > 0 ? '+' : ''}${row.sentiment}`}
            </div>
          </div>
        );
      })}

      <div style={{ height: 2, backgroundColor: FP_INK }} className="mt-4 mb-4" />

      {/* Voice split: the question the footprint exists to answer */}
      <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
        <div className="flex-1 min-w-[240px]">
          <div className="text-[9px] font-bold uppercase tracking-[0.14em] mb-2" style={{ color: FP_MUTED }}>
            Who is doing the talking
          </div>
          <div className="flex h-6 overflow-hidden">
            <div style={{
              width: `${inView ? summary.brandVoice : 0}%`, backgroundColor: FP_INK,
              transition: 'width 900ms cubic-bezier(0.22, 1, 0.36, 1)', transitionDelay: '400ms',
            }} />
            <div style={{
              width: `${inView ? summary.marketVoice : 0}%`, backgroundColor: FP_LIME,
              transition: 'width 900ms cubic-bezier(0.22, 1, 0.36, 1)', transitionDelay: '520ms',
            }} />
          </div>
          <div className="flex justify-between mt-2 text-[11px]" style={{ color: FP_INK }}>
            <span><span className="font-bold">{summary.brandVoice}%</span> the brand</span>
            <span><span className="font-bold">{summary.marketVoice}%</span> the market</span>
          </div>
        </div>
        {footprint.verdict && (
          <p className="flex-1 min-w-[240px] text-[13px] font-medium leading-snug" style={{ color: FP_INK }}>
            {footprint.verdict}
          </p>
        )}
      </div>
    </div>
  );
}

// ── Benchmark visual 1: attribute spread ─────────────────────
// Rows are the eight attributes. Each row shows the cohort range as a band,
// the cohort average as a line, and this brand's score as a filled dot.
function BenchmarkSpread({ benchmark, brandName, hideTitle = false }) {
  const [hovered, setHovered] = useState(null);
  // Rows reveal on scroll: the range band grows from its left edge and the
  // brand dot travels from the bottom of the range to its real position.
  const [revealRef, inView] = useInView(0.2);

  if (!benchmark) return null;

  return (
    <div className="bg-white border border-[#DCDAD3] p-5" ref={revealRef}>
      <div className="mb-4">
        {!hideTitle && <h3 className="font-semibold text-[#0B0B0B] text-sm">Attribute Benchmark Spread</h3>}
        <p className="text-xs text-[#8A877D] mt-1">
          {brandName} against {benchmark.cohortLabel.toLowerCase()}. The band is the range across those brands, the line is their average, the dot is {brandName}.
        </p>
      </div>

      <div className="space-y-3">
        {ATTRIBUTES.map((attr, i) => {
          const brandScore = benchmark.brandScores?.[attr.id] ?? 0;
          const avg = benchmark.attrAvgs?.[attr.id] ?? 0;
          const range = benchmark.attrRanges?.[attr.id] || { min: avg, max: avg };
          const delta = brandScore - avg;
          const isHovered = hovered === attr.id;

          return (
            <div key={attr.id}
              className={`grid items-center gap-3  px-2 py-1 -mx-2 transition-colors ${isHovered ? 'bg-[#F2F0EA]' : ''}`}
              style={{ gridTemplateColumns: '104px 1fr 56px' }}
              onMouseEnter={() => setHovered(attr.id)}
              onMouseLeave={() => setHovered(null)}
            >
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-2 h-2 flex-shrink-0" style={{ backgroundColor: attr.color }} />
                <span className="text-xs font-semibold text-[#0B0B0B] truncate">{attr.name}</span>
              </div>

              <div className="relative h-7 flex items-center" style={{ overflow: 'visible' }}>
                <div className="absolute left-0 right-0 h-0.5 bg-[#ECEAE6]" />
                {[25, 40, 56, 70, 85].map(mark => (
                  <div key={mark} className="absolute w-px h-2.5 bg-[#DCDAD3]"
                    style={{ left: `${mark}%`, transform: 'translateX(-50%)' }} />
                ))}
                {/* Cohort range */}
                <div className="absolute h-1.5 origin-left"
                  style={{
                    left: `${range.min}%`,
                    width: `${Math.max(range.max - range.min, 0.5)}%`,
                    backgroundColor: attr.color + '2E',
                    transform: `scaleX(${inView ? 1 : 0})`,
                    transition: 'transform 620ms cubic-bezier(0.22, 1, 0.36, 1)',
                    transitionDelay: `${i * 70}ms`,
                  }} />
                {/* Cohort average */}
                <div className="absolute w-0.5 h-5 z-10"
                  style={{
                    left: `${avg}%`,
                    transform: 'translateX(-50%)',
                    backgroundColor: '#CFD32F',
                    opacity: inView ? 1 : 0,
                    transition: 'opacity 400ms ease',
                    transitionDelay: `${i * 70 + 260}ms`,
                  }} />
                {/* Brand score */}
                <div className="absolute z-20"
                  style={{
                    left: `${inView ? brandScore : range.min}%`,
                    top: '50%',
                    transform: 'translate(-50%, -50%)',
                    opacity: inView ? 1 : 0,
                    transition: 'left 760ms cubic-bezier(0.22, 1, 0.36, 1), opacity 320ms ease',
                    transitionDelay: `${i * 70 + 120}ms`,
                  }}>
                  <div className="w-3 h-3 ring-2 ring-white transition-transform"
                    style={{ backgroundColor: attr.color, transform: isHovered ? 'scale(1.4)' : 'scale(1)' }} />
                </div>
              </div>

              <div className="text-right">
                <div className="text-xs font-bold tabular-nums" style={{ color: attr.color }}>{brandScore}</div>
                <div className={`text-[10px] tabular-nums font-medium ${delta > 0 ? 'text-[#059669]' : delta < 0 ? 'text-[#B23A3A]' : 'text-[#999]'}`}>
                  {delta > 0 ? `+${delta}` : delta}
                </div>
              </div>
            </div>
          );
        })}

        <div className="grid items-center gap-3 mt-1" style={{ gridTemplateColumns: '104px 1fr 56px' }}>
          <div />
          <div className="flex justify-between text-[10px] text-[#BBB] select-none">
            {['0', '25', '50', '75', '100'].map(v => <span key={v}>{v}</span>)}
          </div>
          <div />
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-[#DCDAD3] flex flex-wrap items-center gap-x-5 gap-y-2 text-[10px] text-[#8A877D]">
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 bg-[#0B0B0B] ring-2 ring-white" />
          <span>{brandName}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-0.5 h-3 bg-[#CFD32F] " />
          <span>{benchmark.scope === 'industry' ? 'Sector' : 'All brands'} average</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-6 h-1.5 bg-[#0B0B0B]/20" />
          <span>{benchmark.scope === 'industry' ? 'Sector' : 'All brands'} range</span>
        </div>
      </div>
    </div>
  );
}

// ── Benchmark visual 2: overall position bar ─────────────────
function BenchmarkPositionBar({ benchmark, brandName }) {
  if (!benchmark) return null;
  const brand = benchmark.brandTotal;
  const cohort = benchmark.avgScore;
  const all = benchmark.allBrandsAvg;
  const delta = brand - cohort;
  const isSector = benchmark.scope === 'industry';
  const scopeNoun = isSector ? 'sector' : 'all brands';

  // Markers collide when the values sit close together, which they usually do.
  // Reference labels drop to a second row when they are within 10 points of
  // each other, and the brand pill shifts its anchor near the extremes so it
  // never runs off the edge of the track.
  const refsCollide = Math.abs(cohort - all) < 10;
  const pillAnchor = brand < 12 ? 'left' : brand > 88 ? 'right' : 'center';
  const pillTransform = pillAnchor === 'left' ? 'translateX(0)' : pillAnchor === 'right' ? 'translateX(-100%)' : 'translateX(-50%)';

  return (
    <div className="bg-white border border-[#DCDAD3] p-5">
      <div className="mb-4">
        <h3 className="font-semibold text-[#0B0B0B] text-sm">Overall Position</h3>
        <p className="text-xs text-[#8A877D] mt-1">
          Where {brandName} sits against {benchmark.cohortLabel.toLowerCase()}{isSector ? ' and against every brand assessed' : ''}.
        </p>
      </div>

      <div className="relative" style={{ height: refsCollide ? 104 : 86 }}>
        {/* Brand pill, above the track */}
        <div className="absolute z-20" style={{ left: `${brand}%`, top: 0, transform: pillTransform }}>
          <div className="px-2 py-0.5 text-white text-[11px] font-bold whitespace-nowrap"
            style={{ backgroundColor: getMaturityStage(brand).color }}>
            {brandName} {brand}
          </div>
        </div>
        <div className="absolute z-20" style={{ left: `${brand}%`, top: 20, transform: 'translateX(-50%)' }}>
          <div className="w-0.5" style={{ height: 20, backgroundColor: getMaturityStage(brand).color }} />
        </div>

        {/* Track */}
        <div className="absolute left-0 right-0 h-2 bg-gradient-to-r from-[#94A3B8] via-[#D97706] to-[#6366F1] opacity-25" style={{ top: 38 }} />
        {MATURITY_STAGES.slice(1).map(st => (
          <div key={st.id} className="absolute w-px h-2 bg-[#C0BDB8]" style={{ left: `${st.min}%`, top: 38 }} />
        ))}

        {/* Sector average, first label row */}
        <div className="absolute z-10" style={{ left: `${cohort}%`, top: 34, transform: 'translateX(-50%)' }}>
          <div className="w-0.5 h-5 bg-[#CFD32F] mx-auto" />
          <div className="text-[10px] font-semibold text-[#6B6B00] whitespace-nowrap text-center mt-0.5">
            {isSector ? 'sector' : 'average'} {cohort}
          </div>
        </div>

        {/* All-brands average, dropped to a second row when it would collide */}
        {isSector && (
          <div className="absolute z-10" style={{ left: `${all}%`, top: 34, transform: 'translateX(-50%)' }}>
            <div className="w-0.5 bg-[#BBB] mx-auto" style={{ height: refsCollide ? 38 : 20 }} />
            <div className="text-[10px] text-[#999] whitespace-nowrap text-center mt-0.5">all {all}</div>
          </div>
        )}

        {/* Scale */}
        <div className="absolute left-0 right-0 flex justify-between text-[10px] text-[#BBB] select-none" style={{ bottom: 0 }}>
          {['0', '25', '50', '75', '100'].map(v => <span key={v}>{v}</span>)}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 pt-3 mt-2 border-t border-[#DCDAD3]">
        <div>
          <div className={`text-lg font-bold ${delta > 0 ? 'text-[#059669]' : delta < 0 ? 'text-[#B23A3A]' : 'text-[#0B0B0B]'}`}>
            {delta > 0 ? `+${delta}` : delta}
          </div>
          <div className="text-[10px] text-[#8A877D] leading-tight">vs {scopeNoun} average</div>
        </div>
        <div>
          <div className="text-lg font-bold text-[#0B0B0B]">
            {benchmark.rank ? `${ordinal(benchmark.rank)} of ${benchmark.count}` : `${benchmark.count}`}
          </div>
          <div className="text-[10px] text-[#8A877D] leading-tight">
            {benchmark.rank ? `rank in ${scopeNoun}` : 'brands compared'}
          </div>
        </div>
        <div>
          <div className="text-lg font-bold text-[#0B0B0B]">
            {benchmark.percentile != null ? ordinal(benchmark.percentile) : '—'}
          </div>
          <div className="text-[10px] text-[#8A877D] leading-tight">percentile</div>
        </div>
      </div>
    </div>
  );
}

// ── Benchmark provenance line ────────────────────────────────
// Always visible. n, cohort, rubric mix and date range travel with the chart
// so nobody has to ask what the benchmark is made of.
function BenchmarkProvenance({ benchmark }) {
  if (!benchmark) return null;
  const fmt = (d) => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : null;
  const from = fmt(benchmark.dateRange?.from);
  const to = fmt(benchmark.dateRange?.to);
  const span = from && to ? (from === to ? from : `${from} to ${to}`) : null;

  return (
    <div className="text-[11px] text-[#8A877D] bg-[#F2F0EA] border border-[#DCDAD3] px-3 py-2 leading-relaxed">
      <span className="font-medium text-[#0B0B0B]">Benchmark basis:</span>{' '}
      {benchmark.cohortLabel}, n={benchmark.count}
      {span ? `, assessed ${span}` : ''}
      {benchmark.rubricVersions?.length ? `, framework v${benchmark.rubricVersions.join(', v')}` : ''}.
      {benchmark.fallbackReason ? <span className="text-[#B45309]"> {benchmark.fallbackReason}</span> : ''}
    </div>
  );
}

function MaturityContinuum({ score, hideTitle = false }) {
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
      {!hideTitle && <h3 className="dc-kicker text-[#0B0B0B] mb-6">Brand Consciousness Maturity</h3>}
      
      {/* Progress Track */}
      <div className="relative mb-4">
        {/* Background track with stage colors */}
        <div className="h-3 overflow-hidden flex">
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
          className="absolute top-0 left-0 h-3 transition-all ease-out"
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
            className="absolute -top-1 -right-1 w-5 h-5 border-3 border-white "
            style={{ backgroundColor: stage.color }}
          />
        </div>
      </div>
      
      {/* Score display */}
      <div className="flex justify-between items-center mb-6">
        <div className="text-sm text-[#8A877D]">Progress</div>
        <div className="flex items-baseline gap-1">
          <span className="text-3xl font-bold" style={{ color: stage.color }}>{animatedScore}</span>
          <span className="text-lg text-[#B3B0A8]">/100</span>
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
                  className={`w-4 h-4 border-2 mb-2 transition-all duration-300 ${isReached ? 'scale-110' : 'scale-100'}`}
                  style={{ 
                    backgroundColor: isReached ? s.color : 'transparent',
                    borderColor: s.color
                  }}
                />
                <span className={`text-[10px] text-center leading-tight hidden sm:block ${isCurrent ? 'font-bold text-[#0B0B0B]' : 'text-[#8A877D]'}`}>
                  {s.name}
                </span>
              </div>
            );
          })}
        </div>
      </div>
      
      {/* Current stage card */}
      <div 
        className={`p-5 text-center transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
        style={{ 
          backgroundColor: `${stage.color}15`,
          borderLeft: `4px solid ${stage.color}`,
          transitionDelay: '800ms'
        }}
      >
        <div className="text-xl font-bold mb-1" style={{ color: stage.color }}>{stage.name}</div>
        <p className="text-sm text-[#4A4840] mb-3">{stage.description}</p>
        
        {/* Progress to next stage */}
        {score < 100 && (
          <div className="text-xs text-[#8A877D]">
            <span className="font-medium" style={{ color: stage.color }}>{Math.min(100, MATURITY_STAGES.find(s => s.min > score)?.min || 100) - score} points</span> to next level
          </div>
        )}
      </div>
    </div>
  );
}

// Header
function Header({ onNewAssessment, onGoHome, onSavedAssessments, onCompassResults, onComparison, onStayConscious, activePage, lastAutoSave, user, profile, onLogout, onAdmin }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const isReadonly = profile?.is_readonly && !profile?.is_admin;

  const navBtnClass = (page) =>
    `flex items-center gap-2 text-sm px-3 py-1.5  transition-colors ${
      activePage === page
        ? 'bg-[#0B0B0B] text-white font-medium'
        : 'text-[#4A4840] hover:text-[#0B0B0B] hover:bg-[#DCDAD3]'
    }`;

  const mobileNavBtnClass = (page) =>
    `w-full flex items-center gap-3 px-4 py-3  transition-colors ${
      activePage === page
        ? 'bg-[#0B0B0B] text-white font-medium'
        : 'text-[#4A4840] hover:bg-[#E4E2DC]'
    }`;
  
  return (
    <header className="bg-[#F2F0EA] border-b border-[#DCDAD3] py-4 md:py-5 px-4 md:px-6">
      <div className="max-w-6xl mx-auto flex items-center justify-between">
        <button onClick={onGoHome || onNewAssessment} className="flex items-center gap-2 md:gap-4 hover:opacity-75 transition-opacity">
          <img src="https://ktuyiikwhspwmzvyczit.supabase.co/storage/v1/object/public/assets/brand/antenna-new-logo.svg" alt="Antenna Group" className="h-6 md:h-8" style={{ filter: 'brightness(0)' }} />
          <div className="hidden lg:block h-6 w-px bg-[#0B0B0B]" />
          <span className="hidden lg:block dc-kicker text-[#0B0B0B]">Conscious Compass</span>
        </button>
        
        {/* Desktop Navigation */}
        <div className="hidden md:flex items-center gap-1">
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
            <button onClick={onNewAssessment} className="flex items-center gap-2 text-sm bg-[#DEE42F] text-white hover:bg-[#C62828] px-4 py-1.5 transition-colors ml-1">
              <Plus className="w-4 h-4" /> New
            </button>
          )}
          
          {/* User Menu */}
          <div className="ml-2 pl-3 border-l border-[#DCDAD3] flex items-center gap-3">
            {profile?.is_admin && (
              <button onClick={onAdmin} className="flex items-center gap-1.5 text-sm text-[#B23A3A] hover:text-[#C62828] transition-colors font-medium">
                <Shield className="w-4 h-4" /> Admin
              </button>
            )}
            {isReadonly && (
              <span className="text-xs px-2 py-0.5 bg-[#B3B0A8] text-white">Read-only</span>
            )}
            <span className="text-xs text-[#8A877D] max-w-[120px] truncate" title={user?.email}>
              {profile?.full_name || user?.email?.split('@')[0]}
            </span>
            <button onClick={onLogout} className="flex items-center gap-1 text-sm text-[#8A877D] hover:text-[#0B0B0B] transition-colors" title="Sign out">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Mobile Menu Button */}
        <button 
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="md:hidden p-2 text-[#0B0B0B]"
        >
          {mobileMenuOpen ? <X className="w-6 h-6" /> : <ChevronDown className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden mt-4 pt-4 border-t border-[#DCDAD3] space-y-1">
          {isReadonly && (
            <div className="px-4 py-2">
              <span className="text-xs px-2 py-0.5 bg-[#B3B0A8] text-white">Read-only Access</span>
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
            <button onClick={() => { onNewAssessment(); setMobileMenuOpen(false); }} className="w-full flex items-center gap-3 px-4 py-3 bg-[#DEE42F] text-white transition-colors">
              <Plus className="w-5 h-5" /> New Assessment
            </button>
          )}
          
          {/* Mobile User Controls */}
          <div className="pt-2 mt-2 border-t border-[#DCDAD3]">
            <div className="px-4 py-2 text-sm text-[#8A877D]">
              Signed in as <span className="font-medium">{profile?.full_name || user?.email}</span>
            </div>
            {profile?.is_admin && (
              <button onClick={() => { onAdmin(); setMobileMenuOpen(false); }} className="w-full flex items-center gap-3 px-4 py-3 text-[#B23A3A] hover:bg-[#E4E2DC] transition-colors">
                <Shield className="w-5 h-5" /> User Management
              </button>
            )}
            <button onClick={onLogout} className="w-full flex items-center gap-3 px-4 py-3 text-[#8A877D] hover:bg-[#E4E2DC] transition-colors">
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
    <div className="bg-white border border-[#DCDAD3] p-3 mb-6">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-[#8A877D] uppercase tracking-wide">Progress</span>
        <span className="text-xs font-medium text-[#0B0B0B]">{completed}/{total} complete</span>
      </div>
      <div className="h-1.5 bg-[#F2F0EA] overflow-hidden mb-3">
        <div 
          className="h-full bg-[#DEE42F] transition-all duration-300"
          style={{ width: `${percentage}%` }}
        />
      </div>
      <div className="flex flex-wrap gap-2">
        {items.map((item, i) => (
          <span 
            key={i}
            className={`text-xs px-2 py-1 flex items-center gap-1 ${
              item.done 
                ? 'bg-[#DEE42F]/10 text-[#B23A3A]' 
                : 'bg-[#E4E2DC] text-[#B3B0A8]'
            }`}
          >
            {item.done ? <Check className="w-3 h-3" /> : <span className="w-3 h-3 border border-current" />}
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
    <div className="bg-white border-b border-[#DCDAD3] py-3 md:py-4 px-4 md:px-6">
      <div className="max-w-6xl mx-auto">
        {/* Desktop Progress */}
        <div className="hidden md:flex items-center justify-center gap-2">
          {steps.map((step, i) => (
            <div key={step.id} className="flex items-center">
              <div className={`w-8 h-8 flex items-center justify-center text-sm font-medium transition-all ${
                i < currentStep ? 'bg-[#DEE42F] text-white' : i === currentStep ? 'bg-[#DEE42F]/10 text-[#B23A3A] ring-2 ring-[#E53935]' : 'bg-[#E4E2DC] text-gray-400'
              }`}>
                {i < currentStep ? <Check className="w-4 h-4" /> : i + 1}
              </div>
              {i < steps.length - 1 && <div className={`w-8 h-0.5 mx-1 ${i < currentStep ? 'bg-[#DEE42F]' : 'bg-[#DCDAD3]'}`} />}
            </div>
          ))}
        </div>
        
        {/* Mobile Progress */}
        <div className="md:hidden flex items-center justify-between">
          <span className="text-sm font-medium text-[#0B0B0B]">
            Step {currentStep} of {steps.length - 1}: {steps[currentStep]?.name}
          </span>
          <div className="flex items-center gap-1">
            {steps.slice(1).map((_, i) => (
              <div 
                key={i}
                className={`w-2 h-0.5 ${i < currentStep ? 'bg-[#DEE42F]' : i === currentStep - 1 ? 'bg-[#DEE42F]' : 'bg-[#DCDAD3]'}`}
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

        {/* Fully Conscious Badge — centred above headline */}
        <div
          className={`flex justify-center mb-8 transition-all duration-1000 ease-out ${
            animate ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
          }`}
        >
          <img
            src="/fully-conscious-badge.png"
            alt="Fully Conscious"
            className="w-32 md:w-40 lg:w-48 drop-shadow-lg hover:scale-105 transition-transform duration-300"
          />
        </div>

        {/* Headline */}
        <h1 
          className={`dc-display text-[#0B0B0B] mb-6 leading-tight transition-all duration-1000 ease-out ${
            animate 
              ? 'opacity-100 translate-y-0' 
              : 'opacity-0 translate-y-8'
          }`}
          style={{ transitionDelay: animate ? '200ms' : '0ms' }}
        >
          <span className="block">Consequential brands</span>
          <span className="block">are conscious brands.</span>
        </h1>
        
        {/* Subtitle */}
        <p 
          className={`text-xl text-[#4A4840] mb-8 leading-relaxed max-w-2xl mx-auto transition-all duration-1000 ease-out ${
            animate 
              ? 'opacity-100 translate-y-0' 
              : 'opacity-0 translate-y-6'
          }`}
          style={{ transitionDelay: animate ? '400ms' : '0ms' }}
        >
          They don't just show up, they stand out. They don't follow trends; they shape narratives. 
          The Conscious Compass explores your brand's impact across 8 essential attributes.
        </p>
        
        {/* Button */}
        <div 
          className={`transition-all duration-700 ease-out ${
            animate 
              ? 'opacity-100 translate-y-0' 
              : 'opacity-0 translate-y-4'
          }`}
          style={{ transitionDelay: animate ? '700ms' : '0ms' }}
        >
          <button onClick={onStart} className="btn-primary btn-arrow text-lg px-8 py-4">
            Start Assessment
          </button>
        </div>
      </div>
      
      <div className="absolute bottom-4 right-4 text-xs text-[#B3B0A8]">
        v{APP_VERSION}
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

        {/* Fully Conscious Badge — centred above headline */}
        <div
          className={`flex justify-center mb-8 transition-all duration-1000 ease-out ${
            animate ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
          }`}
        >
          <img
            src="/fully-conscious-badge.png"
            alt="Fully Conscious"
            className="w-32 md:w-40 lg:w-48 drop-shadow-lg hover:scale-105 transition-transform duration-300"
          />
        </div>

        {/* Headline */}
        <h1 
          className={`text-5xl md:text-6xl font-bold text-[#0B0B0B] mb-6 leading-tight transition-all duration-1000 ease-out ${
            animate ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
          }`}
          style={{ transitionDelay: animate ? '200ms' : '0ms' }}
        >
          <span className="block">Welcome to the</span>
          <span className="block">Conscious Compass.</span>
        </h1>
        
        {/* Subtitle */}
        <p 
          className={`text-xl text-[#4A4840] mb-4 leading-relaxed max-w-2xl mx-auto transition-all duration-1000 ease-out ${
            animate ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
          }`}
          style={{ transitionDelay: animate ? '400ms' : '0ms' }}
        >
          You have read-only access to view brand assessments, compare results, and explore saved reports.
        </p>
        
        <p 
          className={`text-sm text-[#8A877D] mb-8 transition-all duration-1000 ease-out ${
            animate ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
          }`}
          style={{ transitionDelay: animate ? '500ms' : '0ms' }}
        >
          Contact an administrator if you need full access to run new assessments.
        </p>
        
        {/* Navigation buttons */}
        <div 
          className={`flex flex-col sm:flex-row gap-4 justify-center transition-all duration-700 ease-out ${
            animate ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}
          style={{ transitionDelay: animate ? '700ms' : '0ms' }}
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
      
      <div className="absolute bottom-4 right-4 text-xs text-[#B3B0A8]">
        v{APP_VERSION} · Read-only
      </div>
    </div>
  );
}

// Mobile assessment warning banner — shown only on small screens during assessment steps
function MobileAssessmentBanner() {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;
  return (
    <div className="sm:hidden mb-5 flex items-start gap-3 bg-[#FFFBEB] border border-[#FCD34D] px-4 py-3">
      <span className="text-lg leading-none mt-0.5">💡</span>
      <p className="flex-1 text-xs text-[#92400E] leading-relaxed">
        <strong>Best on a larger screen.</strong> This assessment is designed for tablet or desktop. You can continue on mobile, but the experience will be better with more space.
      </p>
      <button onClick={() => setDismissed(true)} className="text-[#B45309] hover:text-[#92400E] flex-shrink-0 mt-0.5">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

// Setup Page
const PROPERTY_TYPES = [
  { id: 'regional',   label: 'Regional' },
  { id: 'translated', label: 'Translated' },
  { id: 'microsite',  label: 'Microsite' },
  { id: 'campaign',   label: 'Campaign' },
  { id: 'careers',    label: 'Careers' },
  { id: 'partner',    label: 'Partner' },
  { id: 'other',      label: 'Other' },
];

function AdditionalPropertiesInput({ project, setProject }) {
  const [open, setOpen] = useState(false);
  const props = project.additionalProperties || [];

  const addProperty = () => {
    setProject({ ...project, additionalProperties: [...props, { url: '', type: 'regional', language: '', label: '' }] });
    setOpen(true);
  };

  const updateProperty = (i, field, value) => {
    const updated = props.map((p, idx) => idx === i ? { ...p, [field]: value } : p);
    setProject({ ...project, additionalProperties: updated });
  };

  const removeProperty = (i) => {
    setProject({ ...project, additionalProperties: props.filter((_, idx) => idx !== i) });
  };

  return (
    <div className="border border-[#DCDAD3] overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-[#FFFFFF] hover:bg-[#F2F0EA] transition-colors text-left"
      >
        <div className="flex items-center gap-2">
          <Plus className="w-4 h-4 text-[#8A877D]" />
          <span className="text-sm font-medium text-[#0B0B0B]">Additional Properties</span>
          {props.length > 0 && (
            <span className="text-xs font-semibold px-2 py-0.5 bg-[#0B0B0B] text-white">{props.length}</span>
          )}
        </div>
        <ChevronDown className={`w-4 h-4 text-[#8A877D] transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="p-4 space-y-4 border-t border-[#DCDAD3]">
          <p className="text-xs text-[#8A877D]">
            Add regional sites, translated versions, microsites or other digital properties owned by this brand. Leave blank to assess the primary URL only.
          </p>

          {/* Primary language */}
          <div className="flex items-center gap-3 p-3 bg-[#E4E2DC] ">
            <span className="text-xs font-semibold text-[#666] w-4">✦</span>
            <div className="flex-1 text-xs text-[#444] font-medium">Primary site</div>
            <input
              type="text"
              value={project.primaryLanguage || ''}
              onChange={e => setProject({ ...project, primaryLanguage: e.target.value })}
              placeholder="Language (e.g. English)"
              className="px-2 py-1.5 text-xs border border-[#DCDAD3] bg-white w-40"
            />
          </div>

          {props.map((prop, i) => (
            <div key={i} className="p-3 bg-[#F2F0EA] space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-[#8A877D] w-4">{i + 1}</span>
                <input
                  type="url"
                  value={prop.url}
                  onChange={e => updateProperty(i, 'url', e.target.value)}
                  placeholder="https://de.example.com"
                  className="flex-1 px-3 py-2 text-sm border border-[#DCDAD3] bg-white"
                />
                <button type="button" onClick={() => removeProperty(i)} className="text-[#999] hover:text-[#0B0B0B] transition-colors flex-shrink-0">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="flex gap-2 ml-6">
                <select
                  value={prop.type}
                  onChange={e => updateProperty(i, 'type', e.target.value)}
                  className="px-2 py-1.5 text-xs border border-[#DCDAD3] bg-white flex-1"
                >
                  {PROPERTY_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                </select>
                <input
                  type="text"
                  value={prop.language}
                  onChange={e => updateProperty(i, 'language', e.target.value)}
                  placeholder="Language (e.g. German)"
                  className="px-2 py-1.5 text-xs border border-[#DCDAD3] bg-white flex-1"
                />
                <input
                  type="text"
                  value={prop.label}
                  onChange={e => updateProperty(i, 'label', e.target.value)}
                  placeholder="Label (e.g. DACH)"
                  className="px-2 py-1.5 text-xs border border-[#DCDAD3] bg-white flex-1"
                />
              </div>
            </div>
          ))}

          <button
            type="button"
            onClick={addProperty}
            className="flex items-center gap-2 text-sm text-[#0B0B0B] font-medium hover:text-[#0B0B0B] transition-colors"
          >
            <Plus className="w-4 h-4" /> Add property
          </button>
        </div>
      )}
    </div>
  );
}

function SetupPage({ project, setProject, apiKey, setApiKey, onNext, onBack }) {
  const canProceed = project.brandName && project.websiteUrl && apiKey;

  return (
    <div className="max-w-2xl mx-auto p-8 animate-fade-in">
      <MobileAssessmentBanner />
      <h2 className="dc-h2 text-[#0B0B0B] mb-2">Brand Details</h2>
      <p className="text-[#4A4840] mb-8">Tell us about the brand you're assessing.</p>

      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-[#0B0B0B] mb-2">Brand Name *</label>
          <input type="text" value={project.brandName} onChange={(e) => setProject({ ...project, brandName: e.target.value })}
            placeholder="e.g., Antenna Group" className="w-full px-4 py-3 border border-[#DCDAD3] bg-white" />
        </div>

        <div>
          <label className="block text-sm font-medium text-[#0B0B0B] mb-2">Website URL *</label>
          <input type="url" value={project.websiteUrl} onChange={(e) => setProject({ ...project, websiteUrl: e.target.value })}
            placeholder="https://www.example.com" className="w-full px-4 py-3 border border-[#DCDAD3] bg-white" />
        </div>

        <AdditionalPropertiesInput project={project} setProject={setProject} />

        <div>
          <label className="block text-sm font-medium text-[#0B0B0B] mb-2">Business Model</label>
          <select value={project.businessModel} onChange={(e) => setProject({ ...project, businessModel: e.target.value })}
            className="w-full px-4 py-3 border border-[#DCDAD3] bg-white">
            {BUSINESS_MODELS.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-[#0B0B0B] mb-2">Industry</label>
          <select value={project.industry || 'other'} onChange={(e) => setProject({ ...project, industry: e.target.value })}
            className="w-full px-4 py-3 border border-[#DCDAD3] bg-white">
            {INDUSTRIES.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
          </select>
          <p className="text-xs text-[#8A877D] mt-1">Used for industry context in the assessment</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-[#0B0B0B] mb-2">Assessor Context</label>
          <textarea
            value={project.assessorContext || ''}
            onChange={(e) => setProject({ ...project, assessorContext: e.target.value })}
            rows={5}
            placeholder={`State what the brand wants to achieve, and the report will assess its readiness to get there. For example:\n\n- Strategic goals and aspirations (repositioning, new audience, new market, launch)\n- What the client has told you about their challenges\n- Key competitors: [names]\n- Known sensitivities or live issues to be aware of\n- The purpose of this assessment (new business, existing client review, benchmark)`}
            className="w-full px-4 py-3 border border-[#DCDAD3] bg-white text-sm leading-relaxed resize-y"
            style={{ minHeight: '120px' }}
          />
          <p className="text-xs text-[#8A877D] mt-1">Optional. This is the lens for the whole report. State what the brand wants, for example to reposition, reach a new audience, or launch, and the assessment will judge how ready the brand is to get there. It is not quoted in the report, only reflected as the brand's stated ambition. Leave it blank and this lens is not applied.</p>
        </div>

        {/* Only show API key field if no default is configured */}
        {!DEFAULT_API_KEY && (
          <div className="pt-4 border-t border-[#DCDAD3]">
            <label className="block text-sm font-medium text-[#0B0B0B] mb-2">Claude API Key *</label>
            <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-ant-..." className="w-full px-4 py-3 border border-[#DCDAD3] bg-white font-mono text-sm" />
            <p className="text-xs text-[#8A877D] mt-2">Get your API key from <a href="https://console.anthropic.com" target="_blank" rel="noopener noreferrer" className="text-[#B23A3A] hover:underline">console.anthropic.com</a></p>
          </div>
        )}
        {DEFAULT_API_KEY && (
          <div className="pt-4 border-t border-[#DCDAD3]">
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
function PropertyConsistencyPanel({ project, assessmentData, setAssessmentData, apiKey }) {
  const additionalProperties = project.additionalProperties?.filter(p => p.url) || [];
  const [propertyData, setPropertyData] = useState(assessmentData.propertyData || {});
  const [isRunning, setIsRunning] = useState(false);
  const [isAnalysing, setIsAnalysing] = useState(false);
  const [error, setError] = useState(null);

  if (additionalProperties.length === 0) return null;

  // Seed primary URL scores from techAudit so we don't double-fetch
  const primaryScores = (() => {
    const t = assessmentData.techAudit?.scores || {};
    return {
      performance:   t.performance   !== '' && t.performance   != null ? Number(t.performance)   : null,
      seo:           t.seo           !== '' && t.seo           != null ? Number(t.seo)           : null,
      accessibility: t.accessibility !== '' && t.accessibility != null ? Number(t.accessibility) : null,
      fromTechAudit: true,
    };
  })();

  const allProperties = [
    { url: project.websiteUrl, type: 'primary', language: project.primaryLanguage || '', label: 'Primary' },
    ...additionalProperties,
  ];

  const runPropertyChecks = async () => {
    setIsRunning(true);
    setError(null);

    // Start with existing data + primary scores from techAudit
    const results = {
      ...propertyData,
      [project.websiteUrl]: { ...primaryScores },
    };

    // Only fetch additional properties — primary comes from TechnicalAuditSection
    for (const prop of additionalProperties) {
      if (!prop.url) continue;
      try {
        const psRes = await fetch(`/api/pagespeed?url=${encodeURIComponent(prop.url)}`);
        if (!psRes.ok) throw new Error(`PageSpeed returned ${psRes.status}`);
        const psData = await psRes.json();
        if (psData.error) throw new Error(psData.error);
        // Proxy returns pre-processed { scores: { performance, accessibility, seo, bestPractices } }
        const s = psData.scores || {};
        results[prop.url] = {
          ...results[prop.url],
          performance:   s.performance   != null ? s.performance   : null,
          seo:           s.seo           != null ? s.seo           : null,
          accessibility: s.accessibility != null ? s.accessibility : null,
          fetched: true,
        };
      } catch (e) {
        results[prop.url] = { ...results[prop.url], fetched: false, error: true, errorMsg: e.message };
        setError(`Failed to fetch scores for ${prop.url}: ${e.message}`);
      }
    }

    // Update both state and assessmentData with the same object to avoid stale closure
    setPropertyData(results);
    setAssessmentData({ ...assessmentData, propertyData: results });
    setIsRunning(false);
  };

  const runConsistencyAnalysis = async () => {
    setIsAnalysing(true);
    setError(null);

    const propSummary = allProperties.map(p => {
      const d = propertyData[p.url] || {};
      return `${p.label || p.type} (${p.url}): type=${p.type}${p.language ? ', language='+p.language : ''}, performance=${d.performance ?? 'n/a'}, seo=${d.seo ?? 'n/a'}`;
    }).join('\n');

    const prompt = `You are a senior brand strategist assessing the digital estate consistency of ${project.brandName}.

The brand has ${allProperties.length} digital properties:
${propSummary}

Primary site PageSpeed scores:
Performance: ${propertyData[project.websiteUrl]?.performance ?? 'n/a'}
SEO: ${propertyData[project.websiteUrl]?.seo ?? 'n/a'}
Accessibility: ${propertyData[project.websiteUrl]?.accessibility ?? 'n/a'}

Analyse cross-property consistency across four dimensions. Write in plain prose, no bullet points, no em dashes.

TECHNICAL CONSISTENCY
How consistent are performance, SEO, and accessibility scores across properties? Flag significant deviations.

BRAND CONSISTENCY
Based on the property types and any translated versions, what risks exist for brand, visual, and tone-of-voice inconsistency? What should the assessor look for?

MESSAGE CONSISTENCY
What risks exist for inconsistent positioning, claims, or CTA language across properties? Especially flag translated sites.

LOCALISATION QUALITY
${additionalProperties.some(p => p.type === 'translated') ? 'For translated properties: what specific checks should the assessor conduct to verify translation quality, brand voice preservation, and local SEO?' : 'No translated properties identified. Note any regional properties and what consistency checks apply.'}

End with OVERALL RISK RATING: Low / Medium / High and one sentence explaining why.`;

    try {
      const storedKey = localStorage.getItem('conscious-compass-apikey');
      const useProxy = !storedKey || storedKey === 'PROXY';
      let text = '';
      if (useProxy) {
        const res = await fetch('/api/claude', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt, max_tokens: 1200, temperature: 0 }) });
        const d = await res.json();
        text = d.text || d.content?.[0]?.text || '';
      } else {
        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': storedKey, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
          body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 1200, temperature: 0, messages: [{ role: 'user', content: prompt }] }),
        });
        const d = await res.json();
        text = d.content?.[0]?.text || '';
      }
      const updated = { ...propertyData, consistencyAnalysis: text };
      setPropertyData(updated);
      setAssessmentData({ ...assessmentData, propertyData: updated });
    } catch (e) {
      setError('Analysis failed: ' + e.message);
    }
    setIsAnalysing(false);
  };

  // Score colour helper
  const scoreColor = (s) => {
    if (s == null) return '#DCDAD3';
    if (s >= 80) return '#059669';
    if (s >= 50) return '#F59E0B';
    return '#E53935';
  };

  const riskColor = (text) => {
    if (!text) return null;
    const m = text.match(/OVERALL RISK RATING:\s*(Low|Medium|High)/i);
    if (!m) return null;
    return m[1].toLowerCase() === 'low' ? '#059669' : m[1].toLowerCase() === 'medium' ? '#F59E0B' : '#E53935';
  };

  const extractRisk = (text) => {
    const m = text?.match(/OVERALL RISK RATING:\s*(Low|Medium|High)/i);
    return m ? m[1] : null;
  };

  return (
    <div className="card p-5 mb-4 border-l-4 border-[#1976D2]">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="text-sm font-medium text-[#0B0B0B] mb-1 flex items-center gap-2">
            <Globe className="w-4 h-4 text-[#1976D2]" />
            Digital Property Consistency
            <span className="text-xs font-normal text-[#8A877D]">— {additionalProperties.length} additional {additionalProperties.length === 1 ? 'property' : 'properties'}</span>
          </h3>
          <p className="text-xs text-[#8A877D]">Compare performance, SEO and accessibility across all registered properties, then run a consistency analysis.</p>
        </div>
        {extractRisk(propertyData.consistencyAnalysis) && (
          <span className="text-xs font-bold px-3 py-1 text-white flex-shrink-0"
            style={{ backgroundColor: riskColor(propertyData.consistencyAnalysis) }}>
            {extractRisk(propertyData.consistencyAnalysis)} Risk
          </span>
        )}
      </div>

      {/* Property table */}
      <div className="overflow-x-auto mb-4">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="border-b border-[#DCDAD3]">
              <th className="text-left py-2 pr-3 font-semibold text-[#666] w-32">Property</th>
              <th className="text-left py-2 pr-3 font-semibold text-[#666]">URL</th>
              <th className="text-left py-2 pr-3 font-semibold text-[#666] w-20">Type</th>
              <th className="text-left py-2 pr-3 font-semibold text-[#666] w-20">Language</th>
              <th className="text-center py-2 px-1 font-semibold text-[#666] w-16">Perf</th>
              <th className="text-center py-2 px-1 font-semibold text-[#666] w-12">SEO</th>
              <th className="text-center py-2 px-1 font-semibold text-[#666] w-16">Access.</th>
            </tr>
          </thead>
          <tbody>
            {allProperties.map((prop, i) => {
              return (
                <tr key={i} className={i % 2 === 0 ? 'bg-[#FFFFFF]' : ''}>
                  <td className="py-2 pr-3 font-semibold text-[#0B0B0B]">{prop.label || (i === 0 ? 'Primary' : `Property ${i}`)}</td>
                  <td className="py-2 pr-3 text-[#666] max-w-[180px] truncate" title={prop.url}>{prop.url}</td>
                  <td className="py-2 pr-3">
                    <span className="px-2 py-0.5 text-[10px] font-semibold bg-[#F2F0EA] text-[#444]">
                      {PROPERTY_TYPES.find(t => t.id === prop.type)?.label || prop.type}
                    </span>
                  </td>
                  <td className="py-2 pr-3 text-[#666]">{prop.language || '—'}</td>
                  {['performance', 'seo', 'accessibility'].map(metric => {
                    const d = i === 0
                      ? primaryScores
                      : (propertyData[prop.url] || {});
                    const val = d[metric];
                    const hasError = propertyData[prop.url]?.error;
                    return (
                      <td key={metric} className="py-2 px-1 text-center">
                        {val != null ? (
                          <span className="inline-block w-10 text-center py-0.5 font-bold tabular-nums text-white text-[11px]"
                            style={{ backgroundColor: scoreColor(val) }}>
                            {val}
                          </span>
                        ) : hasError && i > 0 ? (
                          <span className="text-[#B23A3A] text-[10px]">err</span>
                        ) : i === 0 ? (
                          <span className="text-[10px] text-[#BBB]" title="Run Technical Performance Audit above">—</span>
                        ) : (
                          <span className="text-[#CCC]">—</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-[10px] text-[#999] mb-3">
        Primary site scores are read from the Technical Performance Audit above — run that first. Fetch All Scores only queries additional properties.
      </p>

      <div className="flex gap-2 flex-wrap">
        <button
          onClick={runPropertyChecks}
          disabled={isRunning}
          className="btn-secondary text-sm py-2 px-4 flex items-center gap-2"
        >
          {isRunning ? <><Loader2 className="w-4 h-4 animate-spin" /> Fetching scores...</> : <><RefreshCw className="w-4 h-4" /> Fetch All Scores</>}
        </button>
        <button
          onClick={runConsistencyAnalysis}
          disabled={isAnalysing}
          className="btn-secondary text-sm py-2 px-4 flex items-center gap-2"
        >
          {isAnalysing ? <><Loader2 className="w-4 h-4 animate-spin" /> Analysing...</> : <><Sparkles className="w-4 h-4" /> Consistency Analysis</>}
        </button>
      </div>

      {error && <p className="text-xs text-[#B23A3A] mt-2">{error}</p>}

      {propertyData.consistencyAnalysis && (
        <div className="mt-4 bg-[#E4E2DC] p-4">
          <div className="text-[10px] font-semibold text-[#666] uppercase tracking-wider mb-2">Consistency Analysis</div>
          <pre className="text-sm text-[#333] whitespace-pre-wrap font-sans leading-relaxed">{propertyData.consistencyAnalysis}</pre>
        </div>
      )}
    </div>
  );
}

function TechnicalAuditSection({ websiteUrl, assessmentData, setAssessmentData }) {
  const [techAudit, setTechAudit] = useState(assessmentData.techAudit || {
    scores: { performance: '', accessibility: '', bestPractices: '', seo: '' },
    metrics: {}
  });
  const [isFetching, setIsFetching] = useState(false);
  const [fetchError, setFetchError] = useState(null);

  // Helper function to get color based on PageSpeed score
  const getScoreColor = (score) => {
    if (score === '' || score === undefined || score === null) return '#8A877D';
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
          <h3 className="text-sm font-medium text-[#0B0B0B]">Technical Performance Audit</h3>
          <p className="text-xs text-[#8A877D]">PageSpeed scores impact ATTENTIVE & COGENT</p>
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
        <div className="bg-red-50 border border-red-200 p-3 mb-4 text-xs text-red-700">
          {fetchError} — Try the Manual button instead.
        </div>
      )}

      {!fetchError && (
        <div className="bg-[#E4E2DC] p-3 mb-4">
          <p className="text-xs text-[#8A877D]">
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
              className="w-full text-center text-2xl font-bold py-2 border border-[#DCDAD3] bg-white focus:ring-2 focus:ring-[#E53935] focus:border-transparent"
              style={{ color: getScoreColor(techAudit.scores[item.key]) }}
            />
            <div className="text-xs text-[#8A877D] mt-1">{item.label}</div>
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
        <div className="mt-3 pt-3 border-t border-[#DCDAD3] flex items-center gap-2">
          <Check className="w-4 h-4 text-[#059669]" />
          <span className="text-xs text-[#8A877D]">Scores will be included in assessment</span>
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

${(() => {
  const props = project.additionalProperties?.filter(p => p.url) || [];
  if (!props.length) return '';
  return `DIGITAL ESTATE CONTEXT:
This brand has ${props.length} additional registered ${props.length === 1 ? 'property' : 'properties'} beyond the primary site:
${props.map(p => `  - ${p.label || p.type}: ${p.url}${p.language ? ' (' + p.language + ')' : ''} [${p.type}]`).join('\n')}

When assessing brand authenticity (REFLECTIVE) and experience excellence (ATTENTIVE), consider that these additional properties exist and that inconsistency across a digital estate is a significant brand risk. Note any observations relevant to multi-property brand coherence.
`;
})()}

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
${(() => {
  const props = project.additionalProperties?.filter(p => p.url) || [];
  if (!props.length) return '';
  const allProps = [{ url: project.websiteUrl, type: 'primary', label: 'Primary' }, ...props];
  const pd = assessmentData.propertyData || {};
  const propTable = allProps.map(p => {
    const d = pd[p.url] || {};
    return `  ${p.label || p.type} (${p.url}): Perf ${d.performance ?? 'n/a'} | SEO ${d.seo ?? 'n/a'} | Access. ${d.accessibility ?? 'n/a'}`;
  }).join('\n');
  const analysis = pd.consistencyAnalysis ? `\nCONSISTENCY ANALYSIS:\n${pd.consistencyAnalysis}` : '';
  const riskMatch = pd.consistencyAnalysis?.match(/OVERALL RISK RATING:\s*(Low|Medium|High)/i);
  const risk = riskMatch ? riskMatch[1] : null;
  return `DIGITAL ESTATE — ${props.length + 1} PROPERTIES REGISTERED:
${propTable}
${risk ? `Cross-property consistency risk: ${risk}` : ''}${analysis}

SCORING INSTRUCTION — apply these findings to attribute scores:
- REFLECTIVE: Significant cross-property inconsistency (different visual identity, tone, or messaging across properties) is direct evidence of brand inauthenticity. Penalise this attribute proportionally to the severity of deviation. Translated sites with poor brand voice preservation should also reduce this score.
- ATTENTIVE: Performance score variance across properties signals inconsistent experience delivery. A brand that maintains a polished primary site but neglects regional or translated properties is failing its full audience. Factor the weakest property performance into ATTENTIVE, not just the primary.
- COGENT: A fragmented digital estate with inconsistent tech stacks or missing SEO localisation (hreflang, local schema) on translated properties indicates weak operational intelligence.
- AWARE: For translated/regional properties — does the brand demonstrate genuine understanding of those audiences, or is it simply translating primary content without adaptation?
`;
})()}

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

${images.length > 0 ? `MANDATORY: Begin your response with a section headed exactly "VISUAL ASSESSMENT". This section is required whenever screenshots are provided. Walk through the ${images.length} screenshot(s) one by one. For each, describe what is actually on screen and judge it on design consistency and brand presentation: logo usage, colour palette, typography, layout and spacing, imagery and creative quality. Then compare across screenshots and call out where the brand holds together and where it breaks. Be concrete. Do not skip this section, do not fold it into general commentary, and do not pad it if a screen is unremarkable. State plainly what you see.

` : ''}Write in flowing prose with specific observations. Be concrete about what you see in the screenshots. Compare elements across different pages to identify consistency or inconsistency.

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
      <MobileAssessmentBanner />
      <div className="flex items-start gap-4 mb-6">
        <div className="w-12 h-12 bg-[#DEE42F]/10 flex items-center justify-center">
          <Globe className="w-6 h-6 text-[#B23A3A]" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-[#0B0B0B]">Website Assessment</h2>
          <p className="text-sm text-[#8A877D]">{project.brandName} · {project.websiteUrl}</p>
        </div>
      </div>

      <CompletionIndicator items={completionItems} />

      {/* Auto-Assess Website */}
      <div className="card p-5 mb-4 border-l-4 border-[#0B0B0B]">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className="text-sm font-medium text-[#0B0B0B] mb-1 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#B23A3A]" />
              Auto-Assess Website
            </h3>
            <p className="text-xs text-[#8A877D]">
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
              <span className="text-sm font-medium text-[#0B0B0B]">Website Assessment Complete</span>
            </div>
            <div className="bg-[#E4E2DC] p-4 max-h-80 overflow-y-auto">
              <pre className="text-sm text-[#4A4840] whitespace-pre-wrap font-sans">{assessmentData.autoAssessContent}</pre>
            </div>
          </div>
        )}
      </div>

      {/* Pages Reviewed */}
      <div className="card p-5 mb-4">
        <h3 className="text-sm font-medium text-[#0B0B0B] mb-2">Pages Reviewed</h3>
        <p className="text-sm text-[#8A877D] mb-3">List the pages you reviewed (e.g., Homepage, About, Services, Contact, Blog)</p>
        <input 
          type="text" 
          value={pagesReviewed} 
          onChange={(e) => { setPagesReviewed(e.target.value); setAssessmentData({ ...assessmentData, pagesReviewed: e.target.value }); }}
          placeholder="e.g., Homepage, About Us, Services, Case Studies, Contact"
          className="w-full px-4 py-3 border border-[#DCDAD3] bg-white"
        />
      </div>

      {/* Recognition & Credentials */}
      <div className="card p-5 mb-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium text-[#0B0B0B]">Recognition & Credentials (Optional)</h3>
          <button 
            onClick={runCredentialsAssess} 
            disabled={isAssessingCredentials || !project.brandName}
            className="px-3 py-1.5 bg-[#8B5CF6] text-white text-xs font-medium hover:bg-[#7C3AED] transition-colors flex items-center gap-1.5 disabled:opacity-50"
          >
            {isAssessingCredentials ? (
              <><Loader2 className="w-3 h-3 animate-spin" /> Searching...</>
            ) : (
              <><Sparkles className="w-3 h-3" /> Auto-Search</>
            )}
          </button>
        </div>
        <p className="text-sm text-[#8A877D] mb-3">Awards, certifications, memberships, speaking engagements, or industry recognition.</p>
        <textarea 
          value={credentialsContent} 
          onChange={(e) => { setCredentialsContent(e.target.value); setAssessmentData({ ...assessmentData, credentialsContent: e.target.value }); }}
          placeholder="e.g., Inc. 5000 2024, ISO 27001 certified, Forbes Council member, keynote at SXSW 2025, Gartner Cool Vendor..."
          className={`w-full h-24 px-4 py-3 border border-[#DCDAD3]  bg-white resize-none ${credentialsContent ? 'bg-[#E4E2DC]' : ''}`}
        />
        {credentialsContent && (
          <p className="text-xs text-[#059669] mt-1">✓ Recognition data captured</p>
        )}
      </div>

      {/* Screenshots */}
      <div className="card p-5 mb-4">
        <h3 className="text-sm font-medium text-[#0B0B0B] mb-2 flex items-center gap-2">
          <Image className="w-5 h-5" /> Website Screenshots (up to 4)
        </h3>
        <p className="text-sm text-[#8A877D] mb-4">Upload screenshots of homepage and key subpages for visual analysis.</p>
        
        <input type="file" ref={fileInputRef} onChange={handleImageUpload} accept="image/*" multiple className="hidden" />
        
        <div className="grid grid-cols-2 gap-4 mb-4">
          {images.map((img, index) => (
            <div key={index} className="relative">
              <img src={img} alt={`Screenshot ${index + 1}`} className="w-full h-40 object-cover border border-[#DCDAD3]" />
              <button onClick={() => removeImage(index)}
                className="absolute top-2 right-2 bg-white p-1 hover:bg-gray-100">
                <X className="w-4 h-4" />
              </button>
              <div className="absolute bottom-2 left-2 bg-[#0B0B0B] text-white text-xs px-2 py-1 ">
                {index + 1}
              </div>
            </div>
          ))}
          
          {images.length < 4 && (
            <button onClick={() => fileInputRef.current?.click()}
              className="h-40 border-2 border-dashed border-[#0B0B0B] flex flex-col items-center justify-center gap-2 hover:bg-[#DEE42F]/5 transition-colors">
              {isCompressing ? (
                <><Loader2 className="w-6 h-6 text-[#B23A3A] animate-spin" /><span className="text-sm text-[#B23A3A]">Compressing...</span></>
              ) : (
                <><Upload className="w-6 h-6 text-[#B23A3A]" /><span className="text-sm text-[#B23A3A] font-medium">Add Screenshot</span><span className="text-xs text-[#8A877D]">{4 - images.length} remaining</span></>
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
        <h3 className="text-sm font-medium text-[#0B0B0B] mb-2">Website Content (Optional)</h3>
        <p className="text-sm text-[#8A877D] mb-3">Paste key content from the website: headlines, taglines, about text, value propositions, etc.</p>
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
          className="w-full h-28 px-4 py-3 border border-[#DCDAD3] bg-white resize-none text-sm"
        />
      </div>

      {/* SEO Visibility Assessment */}
      <div className="card p-5 mb-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold text-[#0B0B0B]">SEO Visibility Assessment</h3>
            <p className="text-sm text-[#8A877D]">AI-powered analysis of search visibility potential (influences COGENT score)</p>
          </div>
        </div>

        {!seoAssessment ? (
          <div>
            <p className="text-sm text-[#8A877D] mb-4">
              Claude will analyze {project.brandName}'s likely SEO visibility based on brand name uniqueness, 
              industry competitiveness, content signals, and identify target keywords they should rank for.
            </p>
            <div className="bg-yellow-50 border border-yellow-200 p-3 mb-4">
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
              <span className="text-sm font-medium text-[#0B0B0B] flex items-center gap-2">
                <Check className="w-4 h-4 text-green-600" /> SEO Assessment Complete
                <span className="text-xs text-[#8A877D] font-normal">(will be included in Website Analysis)</span>
              </span>
              <button 
                onClick={runSeoAssessment} 
                disabled={isAssessingSeo}
                className="text-sm text-[#B23A3A] hover:underline flex items-center gap-1"
              >
                {isAssessingSeo ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                Regenerate Analysis
              </button>
            </div>
            <div className="bg-[#E4E2DC] p-4 max-h-64 overflow-y-auto">
              <pre className="text-sm text-[#4A4840] whitespace-pre-wrap font-sans">{seoAssessment}</pre>
            </div>
          </div>
        )}
      </div>

      {/* Digital Property Consistency — only shown if additional properties registered */}
      <PropertyConsistencyPanel
        project={project}
        assessmentData={assessmentData}
        setAssessmentData={setAssessmentData}
        apiKey={apiKey}
      />

      {/* Technical Performance Audit */}
      <TechnicalAuditSection 
        websiteUrl={project.websiteUrl} 
        assessmentData={assessmentData}
        setAssessmentData={setAssessmentData}
      />

      {/* Assessor Observations */}
      <div className="card p-5 mb-4">
        <h3 className="text-sm font-medium text-[#0B0B0B] mb-2">Assessor Observations</h3>
        <p className="text-sm text-[#8A877D] mb-3">Your observations on brand alignment, storytelling, consistency issues, or other concerns.</p>
        <textarea value={assessmentData.observations || ''} onChange={(e) => setAssessmentData({ ...assessmentData, observations: e.target.value })}
          placeholder="Add your observations about:
- Brand alignment issues
- Storytelling strengths/weaknesses  
- Consistency across pages
- Navigation or UX concerns
- Content gaps
- Competitive positioning..." className="w-full h-20 px-3 py-2 border border-[#DCDAD3] bg-white resize-none" />
      </div>

      {!isComplete && (
        <button onClick={runAnalysis} disabled={isProcessing || images.length === 0 || isCompressing} className="btn-primary flex items-center gap-2 mb-6">
          {isProcessing ? <><Loader2 className="w-4 h-4 animate-spin" /> Analyzing Website...</> : 
           isCompressing ? <><Loader2 className="w-4 h-4 animate-spin" /> Compressing Images...</> :
           <><Play className="w-4 h-4" /> {images.length > 0 ? 'Run Website Analysis' : 'Upload Screenshots First'}</>}
        </button>
      )}

      {error && <div className="bg-red-50 border border-red-200 p-4 mb-6 text-red-700">{error}</div>}

      {isComplete && (
        <div className="card p-5 mb-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-[#0B0B0B] flex items-center gap-2">
              <Check className="w-5 h-5 text-[#B23A3A]" /> Analysis Complete
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
          <div className="bg-[#E4E2DC] p-4 max-h-96 overflow-y-auto">
            <pre className="text-sm text-[#4A4840] whitespace-pre-wrap font-sans">{assessmentData.content}</pre>
          </div>
        </div>
      )}

      {proceedError && (
        <div className="bg-amber-50 border border-amber-200 p-4 mb-4 text-amber-800 text-sm flex items-center gap-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          {proceedError}
        </div>
      )}

      <div className="flex items-center justify-between pt-6 border-t border-[#DCDAD3]">
        <button onClick={onPrev} className="btn-secondary flex items-center gap-2"><ArrowLeft className="w-4 h-4" /> Back</button>
        <button onClick={handleProceed} disabled={!canProceed} className="btn-primary flex items-center gap-2">Continue <ArrowRight className="w-4 h-4" /></button>
      </div>
    </div>
  );
}

// Social Media Assessment with all platforms and image uploads
// Screenshots plateau in value fast and the compress-and-upload loop is slow.
const SOCIAL_SCREENSHOT_MAX = 2;

// Which channels lead for which business model. Everything else stays
// available behind "Show all channels" rather than being removed, since an
// assessor may still need it. A B2B assessment should not open on TikTok.
const CHANNEL_RELEVANCE = {
  b2b:   { lead: ['linkedin', 'x', 'youtube'], secondary: ['instagram', 'other'] },
  b2c:   { lead: ['instagram', 'x', 'youtube'], secondary: ['linkedin', 'other'] },
  b2b2c: { lead: ['linkedin', 'instagram', 'x', 'youtube'], secondary: ['other'] },
};

function SocialMediaAssessment({ assessmentData, setAssessmentData, apiKey, project, onPrev, onNext, onClearScores }) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [isCompressing, setIsCompressing] = useState(false);
  const [isAutoChecking, setIsAutoChecking] = useState(false);
  const [isSearchingWipo, setIsSearchingWipo] = useState(false);
  const [isRunningAll, setIsRunningAll] = useState(false);
  const [runAllStage, setRunAllStage] = useState('');
  const [runAllProgress, setRunAllProgress] = useState(0);
  const [showAllChannels, setShowAllChannels] = useState(false);
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
    // Merged Campaign and Paid Signals field. The two legacy fields above are
    // still read on load so existing saved assessments keep their content.
    campaignContent: assessmentData.campaignContent
      || [assessmentData.hashtagContent, assessmentData.paidMediaContent].filter(Boolean).join('\n\n')
      || '',
    // Auto-extracted content, kept strictly separate from the manual fields
    // above so re-running the health check never overwrites typed notes.
    linkedinAuto: assessmentData.linkedinAuto || '',
    xAuto: assessmentData.xAuto || '',
    instagramAuto: assessmentData.instagramAuto || '',
    youtubeAuto: assessmentData.youtubeAuto || '',
    otherPlatformsAuto: assessmentData.otherPlatformsAuto || '',
    glassdoorAuto: assessmentData.glassdoorAuto || '',
    campaignAuto: assessmentData.campaignAuto || '',
    thirdPartyAuto: assessmentData.thirdPartyAuto || '',
  });
  const [images, setImages] = useState(assessmentData.socialImages || []);
  const [instagramImages, setInstagramImages] = useState(assessmentData.instagramImages || []);
  const fileInputRef = useRef(null);
  const instagramFileInputRef = useRef(null);

  const updateInput = (key, value) => {
    setInputs(prev => ({ ...prev, [key]: value }));
    setAssessmentData({ ...assessmentData, [key]: value });
  };

  // ── Social Media Health Check ──────────────────────────────
  // Returns structured JSON so findings land directly in the per-platform
  // fields instead of a read-only blob the assessor has to retype.
  //
  // Auto-extracted content and typed notes are kept in SEPARATE fields.
  // Re-running the check overwrites only the auto side, so a re-run can never
  // destroy something an assessor wrote.
  const runAutoCheck = async ({ silent = false } = {}) => {
    if (!silent) setIsAutoChecking(true);
    setError(null);
    try {
      const industryName = INDUSTRIES.find(i => i.id === project.industry)?.name || 'Unknown';

      const prompt = `Conduct a Social Media Health Check for ${project.brandName}.

Website: ${project.websiteUrl}
Industry: ${industryName}
Business model: ${project.businessModel?.toUpperCase() || 'Unknown'}

Search the web for current information about this brand's social presence, then return your findings.

For EVERY platform below, establish: whether an official presence exists, the URL, follower or subscriber count, posting cadence, date of most recent post, visible engagement levels relative to follower count, dominant content themes, whether content is original or reshared, and whether visual and verbal branding matches the website.

Platforms: LinkedIn, X (Twitter), Instagram, YouTube, Facebook, TikTok, Bluesky, Substack.

Also establish:
- GLASSDOOR: rating out of 5, CEO approval, review count, recurring culture themes, pros and cons patterns.
- HASHTAGS AND CAMPAIGNS: branded hashtag if any, adoption volume, campaign or product hashtags, whether customers use them, consistency across platforms.
- PAID MEDIA: what is visible in Meta Ad Library, Google Ads Transparency, LinkedIn Ad Library and TikTok Ad Library. Volume, creative themes, whether messaging matches organic content, whether creative is distinctive or generic.
- THIRD PARTY: who is talking about the brand, sentiment, notable mentions, user generated content, any visible complaints or controversies.

Engagement benchmarks: 1-3% is average, 3-6% good, 6%+ excellent.

Return ONLY valid JSON, no prose before or after, no markdown fences. Where something cannot be found, use the string "Not found" rather than inventing it. Schema:
{
  "summary": "2-3 sentences on overall social health. Direct, evidence-based.",
  "healthScore": 0-10,
  "linkedin": { "url": "", "followers": "", "cadence": "", "engagement": "", "themes": "", "brandConsistency": "", "notes": "" },
  "x": { "url": "", "followers": "", "cadence": "", "engagement": "", "themes": "", "brandConsistency": "", "notes": "" },
  "instagram": { "url": "", "followers": "", "cadence": "", "engagement": "", "themes": "", "brandConsistency": "", "notes": "" },
  "youtube": { "url": "", "followers": "", "cadence": "", "engagement": "", "themes": "", "brandConsistency": "", "notes": "" },
  "otherPlatforms": "Facebook, TikTok, Bluesky and Substack presence, one line each.",
  "glassdoor": { "rating": "", "ceoApproval": "", "reviewCount": "", "themes": "", "notes": "" },
  "campaignAndPaid": {
    "brandedHashtag": "",
    "hashtagAdoption": "",
    "campaignsObserved": "Named campaigns or recurring creative properties you can actually see, with where they appear. State plainly if none.",
    "paidMedia": "What is running, on which platforms, at what apparent volume.",
    "creativeThemes": "",
    "organicPaidConsistency": ""
  },
  "thirdParty": "Who is talking about the brand, sentiment, notable mentions, complaints or controversies.",
  "strengths": ["max 3"],
  "improvements": ["max 3"]
}`;

      const response = await fetch('/api/claude', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, useWebSearch: true })
      });

      if (!response.ok) throw new Error('Health check failed');
      const data = await response.json();
      const raw = data.content?.filter(b => b.type === 'text').map(b => b.text).join('\n') || data.text || '';

      let parsed = null;
      const match = raw.match(/\{[\s\S]*\}/);
      if (match) {
        try { parsed = JSON.parse(match[0]); } catch { parsed = null; }
      }

      // If the model did not return usable JSON, keep the prose rather than
      // losing the work entirely. The assessor still gets something to read.
      if (!parsed) {
        setSocialHealthCheck(raw);
        setAssessmentData({ ...assessmentData, socialHealthCheck: raw, socialHealthCheckStructured: null });
        if (!silent) setError('Health check returned unstructured results. The findings are shown below but could not be filed into the channel fields automatically.');
        return;
      }

      const line = (label, value) => (value && value !== 'Not found' ? `${label}: ${value}` : null);
      const platformBlock = (p) => p ? [
        line('URL', p.url),
        line('Followers', p.followers),
        line('Cadence', p.cadence),
        line('Engagement', p.engagement),
        line('Themes', p.themes),
        line('Brand consistency', p.brandConsistency),
        line('Notes', p.notes),
      ].filter(Boolean).join('\n') : '';

      const cp = parsed.campaignAndPaid || {};
      const gd = parsed.glassdoor || {};

      const autoFields = {
        linkedinAuto: platformBlock(parsed.linkedin),
        xAuto: platformBlock(parsed.x),
        instagramAuto: platformBlock(parsed.instagram),
        youtubeAuto: platformBlock(parsed.youtube),
        otherPlatformsAuto: parsed.otherPlatforms && parsed.otherPlatforms !== 'Not found' ? parsed.otherPlatforms : '',
        glassdoorAuto: [
          line('Rating', gd.rating),
          line('CEO approval', gd.ceoApproval),
          line('Reviews', gd.reviewCount),
          line('Culture themes', gd.themes),
          line('Notes', gd.notes),
        ].filter(Boolean).join('\n'),
        campaignAuto: [
          line('Campaigns observed', cp.campaignsObserved),
          line('Branded hashtag', cp.brandedHashtag),
          line('Hashtag adoption', cp.hashtagAdoption),
          line('Paid media', cp.paidMedia),
          line('Creative themes', cp.creativeThemes),
          line('Organic and paid consistency', cp.organicPaidConsistency),
        ].filter(Boolean).join('\n'),
        thirdPartyAuto: parsed.thirdParty && parsed.thirdParty !== 'Not found' ? parsed.thirdParty : '',
      };

      const readable = [
        parsed.summary,
        parsed.healthScore != null ? `\nOverall health score: ${parsed.healthScore}/10` : '',
        Array.isArray(parsed.strengths) && parsed.strengths.length ? `\nStrengths:\n${parsed.strengths.map(v => `  • ${v}`).join('\n')}` : '',
        Array.isArray(parsed.improvements) && parsed.improvements.length ? `\nPriority improvements:\n${parsed.improvements.map(v => `  • ${v}`).join('\n')}` : '',
      ].filter(Boolean).join('\n');

      setSocialHealthCheck(readable);
      setInputs(prev => ({ ...prev, ...autoFields }));
      setAssessmentData({
        ...assessmentData,
        ...autoFields,
        socialHealthCheck: readable,
        socialHealthCheckStructured: parsed,
        socialAutoFilledAt: new Date().toISOString(),
      });

      // Verified API data still wins over anything the model inferred.
      try {
        const ytResponse = await fetch(`/api/youtube?query=${encodeURIComponent(project.brandName)}&website=${encodeURIComponent(project.websiteUrl || '')}`);
        const ytData = await ytResponse.json();

        if (!ytData.error) {
          let ytStats = '[API Data]\n\n';
          if (ytData.hasBrandedChannel && ytData.brandedChannel) {
            const ch = ytData.brandedChannel;
            const st = ytData.brandedChannelStats;
            ytStats += `OFFICIAL CHANNEL FOUND
Channel: ${ch.channelTitle}
URL: ${ch.channelUrl || ch.customUrl}
Subscribers: ${st?.subscriberCount?.toLocaleString() || 'Hidden'} (${ytData.summary?.subscriberTier})
Videos: ${st?.videoCount?.toLocaleString() || 0}
Total Views: ${st?.viewCount?.toLocaleString() || 0}
Created: ${ch.publishedAt ? new Date(ch.publishedAt).toLocaleDateString() : 'Unknown'}
`;
          } else {
            ytStats += `NO OFFICIAL CHANNEL FOUND
No YouTube channel matching "${project.brandName}" was identified.
`;
          }
          ytStats += `\nTHIRD-PARTY COVERAGE (${ytData.summary?.thirdPartyCoverage || 'Unknown'})\n`;
          if (ytData.thirdPartyCoverage?.length) {
            ytData.thirdPartyCoverage.forEach((v, i) => {
              ytStats += `\n${i + 1}. "${v.title}"\n   Channel: ${v.channelTitle}\n   URL: ${v.videoUrl}\n`;
            });
          } else {
            ytStats += `No third-party videos found.\n`;
          }
          setInputs(prev => ({ ...prev, youtubeAuto: ytStats }));
          setAssessmentData(prev => ({ ...prev, youtubeAuto: ytStats }));
        }

        const kgResponse = await fetch(`/api/knowledge-graph?query=${encodeURIComponent(project.brandName)}`);
        const kgData = await kgResponse.json();
        if (kgData.found && kgData.bestMatch) {
          const kgInfo = `[Knowledge Graph] Entity Status: ${kgData.knowledgeGraphSignal}
${kgData.bestMatch.name ? `Name: ${kgData.bestMatch.name}` : ''}
${kgData.bestMatch.type?.length ? `Type: ${kgData.bestMatch.type.join(', ')}` : ''}
${kgData.bestMatch.description ? `Description: ${kgData.bestMatch.description}` : ''}
${kgData.bestMatch.url ? `Wikipedia: ${kgData.bestMatch.url}` : ''}`;
          setInputs(prev => ({ ...prev, wikipediaContent: prev.wikipediaContent?.includes('[Knowledge Graph]') ? prev.wikipediaContent : `${kgInfo}\n\n${prev.wikipediaContent || ''}`.trim() }));
          setAssessmentData(prev => ({ ...prev, wikipediaContent: prev.wikipediaContent?.includes('[Knowledge Graph]') ? prev.wikipediaContent : `${kgInfo}\n\n${prev.wikipediaContent || ''}`.trim() }));
        }
      } catch (apiErr) {
        console.log('Google API enhancement failed (non-critical):', apiErr.message);
      }

    } catch (err) {
      setError('Health check failed: ' + err.message);
      if (silent) throw err;
    } finally {
      if (!silent) setIsAutoChecking(false);
    }
  };

  // WIPO Trademark Auto-Search using Claude web search
  const runWipoSearch = async ({ silent = false } = {}) => {
    if (!silent) setIsSearchingWipo(true);
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
      if (silent) throw err;
    } finally {
      if (!silent) setIsSearchingWipo(false);
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
    
    const remainingSlots = SOCIAL_SCREENSHOT_MAX - images.length;
    const filesToProcess = files.slice(0, remainingSlots);
    
    if (filesToProcess.length === 0) {
      setError(`Maximum ${SOCIAL_SCREENSHOT_MAX} images allowed`);
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
      const updatedImages = [...images, ...newImages].slice(0, SOCIAL_SCREENSHOT_MAX);
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

  const runAnalysis = async ({ silent = false } = {}) => {
    if (!silent) setIsProcessing(true);
    setError(null);
    try {
      // Auto-extracted findings and the assessor's own notes are presented as
      // distinct layers so the model can see which is which, and so a re-run
      // of the health check never silently discards typed input.
      const merged = (auto, manual) => {
        const parts = [];
        if (auto) parts.push(`[Auto-checked]\n${auto}`);
        if (manual) parts.push(`[Assessor notes]\n${manual}`);
        return parts.length ? parts.join('\n\n') : '[Not provided]';
      };

      const prompt = `Analyze ${project.brandName}'s social media and reputation presence based on the content provided below.

=== LINKEDIN DATA ===
Channel Profile:
${inputs.linkedinAuto || '[Not auto-checked]'}

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
${merged(inputs.xAuto, inputs.xContent)}

=== INSTAGRAM DATA ===
${merged(inputs.instagramAuto, inputs.instagramContent)}
${instagramImages.length > 0 ? `\n${instagramImages.length} Instagram screenshot(s) provided for visual reference.` : ''}

=== YOUTUBE DATA ===
${inputs.hasYouTube ? merged(inputs.youtubeAuto, inputs.youtubeContent) : '[Brand does not have a YouTube channel]'}
${inputs.youtubeAuto?.includes('[API Data]') ? '\nNote: YouTube data above includes verified API data (subscriber count, video count, views, third-party coverage).' : ''}

=== OTHER PLATFORMS (Facebook, TikTok, Bluesky, Substack) ===
${inputs.otherPlatformsAuto || '[Not assessed]'}

=== REDDIT ANSWERS (AI Search Visibility) ===
${inputs.redditAnswersContent || '[Not checked - Reddit Answers shows how AI perceives brand reputation]'}

=== WIKIPEDIA & KNOWLEDGE GRAPH ===
${inputs.wikipediaContent || '[Not provided - please note if ' + project.brandName + ' has a Wikipedia page]'}
${inputs.wikipediaContent?.includes('[Knowledge Graph]') ? '\nNote: Knowledge Graph data above shows Google entity recognition status.' : ''}

=== GLASSDOOR (Employer Reputation) ===
${merged(inputs.glassdoorAuto, inputs.glassdoorContent) === '[Not provided]' ? '[Not reviewed - Glassdoor reviews impact brand self-awareness and Reflective score]' : merged(inputs.glassdoorAuto, inputs.glassdoorContent)}

=== WIPO TRADEMARK STATUS ===
${inputs.wipoContent || '[Not checked - Trademark registration impacts brand professionalism and Intentional score]'}

=== CAMPAIGN & PAID SIGNALS ===
${merged(inputs.campaignAuto, inputs.campaignContent)}

=== THIRD-PARTY CONVERSATION ===
${inputs.thirdPartyAuto || '[Not assessed]'}

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

9. Campaign & Paid Signals: Assess the campaign and paid evidence together. Is there a named campaign or recurring creative property, and does one strategic premise and creative idea thread across channels, or is this a set of isolated tactical bursts? Does paid creative carry the same idea as organic content? Does ad volume suggest serious market investment (COGENT, INTENTIONAL)? Is creative distinctive or generic (SENTIENT)? Do customers actually use the branded hashtag, or only the brand? Be specific about what is threaded and what is isolated, since this evidence drives the campaign coherence assessment in the final report.

10. Third-Party Conversation: What are others saying, with what sentiment, and does anyone outside the brand pick up its campaigns or language?

11. Cross-Platform Consistency: Is the brand voice and messaging consistent across platforms?

12. AI/Search Visibility: How does their social presence impact discoverability in AI search engines? Consider YouTube third-party coverage, Knowledge Graph status, and Reddit Answers perception.

${(images.length + instagramImages.length) > 0 ? `MANDATORY: Begin your response with a section headed exactly "VISUAL ASSESSMENT". This section is required whenever screenshots are provided. Walk through the ${images.length + instagramImages.length} social screenshot(s) one by one. For each, describe what is on screen and judge it on brand consistency and presentation: does it look like the same brand as the website and the other channels? Logo, colour, typography, layout, creative quality. Then compare across the screenshots and across platforms, and flag where the brand holds together and where it drifts. Be concrete. Do not skip this section and do not fold it into general commentary.

` : ''}Write in flowing prose with specific observations from the content provided. End with key strengths and priority improvements.`;

      const allImages = [...images, ...instagramImages];
      const result = await callClaude(prompt, apiKey, allImages[0], allImages.slice(1));
      setAssessmentData({ ...assessmentData, status: 'complete', content: result, ...inputs, socialImages: images, instagramImages });
    } catch (err) {
      setError(err.message);
      if (silent) throw err;
    } finally {
      if (!silent) setIsProcessing(false);
    }
  };

  // ── Run Everything ─────────────────────────────────────────
  // Health check, WIPO, then analysis, in sequence. The assessor reviews and
  // edits rather than sourcing and typing. Each stage is allowed to fail
  // without taking down the ones after it, since partial evidence is still
  // worth more than none.
  const runEverything = async () => {
    setIsRunningAll(true);
    setError(null);
    const failures = [];

    setRunAllStage('Checking every channel...');
    setRunAllProgress(10);
    try { await runAutoCheck({ silent: true }); } catch { failures.push('health check'); }

    setRunAllStage('Searching trademark registers...');
    setRunAllProgress(50);
    try { if (!inputs.wipoContent) await runWipoSearch({ silent: true }); } catch { failures.push('WIPO search'); }

    setRunAllStage('Writing the social assessment...');
    setRunAllProgress(75);
    try { await runAnalysis({ silent: true }); } catch { failures.push('analysis'); }

    setRunAllProgress(100);
    setRunAllStage('Done');
    if (failures.length) {
      setError(`Completed with issues. Failed: ${failures.join(', ')}. Run the remaining steps individually or fill those fields manually.`);
    }
    setTimeout(() => { setIsRunningAll(false); setRunAllProgress(0); setRunAllStage(''); }, 600);
  };

  const isComplete = assessmentData.status === 'complete';
  const hasMinimumContent = inputs.linkedinAuto || inputs.xAuto || inputs.instagramAuto || inputs.youtubeAuto
    || inputs.linkedinAbout || inputs.linkedinPosts || inputs.xContent || inputs.youtubeContent || inputs.instagramContent;

  // Channel coverage is judged against what matters for THIS business model,
  // not a fixed list. Requiring X to proceed was wrong: plenty of serious B2B
  // brands have abandoned the platform, and the old gate forced assessors to
  // type "N/A" to move on.
  const relevance = CHANNEL_RELEVANCE[project.businessModel] || CHANNEL_RELEVANCE.b2b2c;
  const channelContent = {
    linkedin: inputs.linkedinAuto || inputs.linkedinAbout || inputs.linkedinPosts,
    x: inputs.xAuto || inputs.xContent,
    instagram: inputs.instagramAuto || inputs.instagramContent,
    youtube: inputs.youtubeAuto || inputs.youtubeContent,
    other: inputs.otherPlatformsAuto,
  };
  const leadChannelsCovered = relevance.lead.filter(c => !!channelContent[c]).length;
  const REQUIRED_LEAD_CHANNELS = 2;

  // Secondary channels stay hidden until asked for, unless they already hold
  // content, in which case hiding them would hide real evidence.
  const isChannelVisible = (channel) =>
    showAllChannels || relevance.lead.includes(channel) || !!channelContent[channel];

  // Accordion state. Opens on the channel that leads for this business model.
  const [expanded, setExpanded] = useState(() => {
    const rel = CHANNEL_RELEVANCE[project.businessModel] || CHANNEL_RELEVANCE.b2b2c;
    return { linkedin: rel.lead[0] === 'linkedin', x: false, instagram: rel.lead[0] === 'instagram', other: false, campaign: false, reputation: false };
  });
  const toggleSection = (section) => setExpanded(prev => ({ ...prev, [section]: !prev[section] }));

  // Status badges for auto-check
  const autoCheckStatus = {
    youtube: !!inputs.youtubeAuto?.includes('[API Data]'),
    glassdoor: !!inputs.glassdoorAuto,
  };
  const autoCheckCount = Object.values(autoCheckStatus).filter(Boolean).length;

  // Completion tracking
  const completionItems = [
    { label: 'Health Check', done: !!socialHealthCheck },
    { label: 'Channels', done: leadChannelsCovered >= REQUIRED_LEAD_CHANNELS },
    { label: 'Screenshot', done: images.length > 0 },
    { label: 'Campaign', done: !!(inputs.campaignAuto || inputs.campaignContent) },
    { label: 'WIPO', done: !!inputs.wipoContent },
    { label: 'Analysis', done: isComplete },
  ];

  // Required checks before proceeding
  const canProceed = isComplete && !!inputs.wipoContent && leadChannelsCovered >= REQUIRED_LEAD_CHANNELS && images.length > 0;
  const [proceedError, setProceedError] = useState(null);

  const handleProceed = () => {
    if (leadChannelsCovered < REQUIRED_LEAD_CHANNELS) {
      const names = relevance.lead.map(c => ({ linkedin: 'LinkedIn', x: 'X', instagram: 'Instagram', youtube: 'YouTube', other: 'other platforms' }[c])).join(', ');
      setProceedError(`Please cover at least ${REQUIRED_LEAD_CHANNELS} of the priority channels for a ${project.businessModel?.toUpperCase()} brand (${names}). Running the health check fills most of this automatically.`);
      return;
    }
    if (images.length === 0) {
      setProceedError('Please upload at least one screenshot of social media profiles before proceeding.');
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
  // Read-only panel for auto-checked content. Sits above the notes field so it
  // is obvious which content the assessor owns and which was fetched.
  const AutoPanel = ({ content }) => content ? (
    <div className="bg-[#F0F9F4] border border-[#BBE5CC] p-3">
      <div className="flex items-center gap-1.5 mb-1.5">
        <Check className="w-3.5 h-3.5 text-[#059669]" />
        <span className="text-[10px] font-semibold text-[#059669] uppercase tracking-wider">Auto-checked</span>
      </div>
      <pre className="text-xs text-[#4A4840] whitespace-pre-wrap font-sans leading-relaxed max-h-44 overflow-y-auto">{content}</pre>
    </div>
  ) : null;

  const AccordionHeader = ({ title, icon: Icon, isOpen, onClick, badge, hasContent }) => (
    <button 
      onClick={onClick}
      className={`w-full flex items-center justify-between p-4  transition-colors ${isOpen ? 'bg-[#E4E2DC]' : 'bg-white hover:bg-[#F2F0EA]'} border border-[#DCDAD3]`}
    >
      <div className="flex items-center gap-3">
        <Icon className="w-5 h-5 text-[#8A877D]" />
        <span className="font-medium text-[#0B0B0B]">{title}</span>
        {badge && <span className="text-xs px-2 py-0.5 bg-purple-100 text-purple-700">{badge}</span>}
        {hasContent && <Check className="w-4 h-4 text-[#059669]" />}
      </div>
      <ChevronDown className={`w-5 h-5 text-[#8A877D] transition-transform ${isOpen ? 'rotate-180' : ''}`} />
    </button>
  );

  return (
    <div className="max-w-4xl mx-auto p-8 animate-fade-in">
      <MobileAssessmentBanner />
      <div className="flex items-start gap-4 mb-6">
        <div className="w-12 h-12 bg-[#8B5CF6]/10 flex items-center justify-center">
          <Users className="w-6 h-6 text-[#8B5CF6]" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-[#0B0B0B]">Social Media Assessment</h2>
          <p className="text-sm text-[#8A877D]">{project.brandName}'s social presence</p>
        </div>
      </div>

      <CompletionIndicator items={completionItems} />

      {/* Run Everything */}
      <div className="card p-4 mb-4 border-l-4 border-[#0B0B0B]">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-1">
          <div className="min-w-0">
            <h3 className="text-sm font-medium text-[#0B0B0B] flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#B23A3A]" />
              Run Everything
            </h3>
            <p className="text-xs text-[#8A877D]">Checks every channel, searches trademarks, then writes the assessment. Review and edit the results below rather than sourcing them by hand.</p>
          </div>
          <button
            onClick={runEverything}
            disabled={isRunningAll || isAutoChecking || isProcessing}
            className="btn-primary text-sm py-2 px-4 flex items-center gap-2 flex-shrink-0"
          >
            {isRunningAll ? <><Loader2 className="w-4 h-4 animate-spin" /> Running...</> : <><Play className="w-4 h-4" /> Run Everything</>}
          </button>
        </div>
        {isRunningAll && (
          <div className="mt-3">
            <div className="w-full bg-[#F2F0EA] h-2 mb-1.5">
              <div className="bg-[#DEE42F] h-2 transition-all duration-500 ease-out" style={{ width: `${runAllProgress}%` }} />
            </div>
            <p className="text-xs text-[#8A877D]">{runAllStage}</p>
          </div>
        )}
      </div>

      {/* Social Media Health Check Section */}
      <div className="card p-4 mb-4 border-l-4 border-[#8B5CF6]">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-medium text-[#0B0B0B] flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#8B5CF6]" />
              Social Media Health Check
            </h3>
            <p className="text-xs text-[#8A877D]">Fills the channel fields below. Re-running updates auto-checked content only and never overwrites your notes.</p>
          </div>
          <button 
            onClick={() => runAutoCheck()} 
            disabled={isAutoChecking || isRunningAll}
            className="btn-secondary text-sm py-2 px-4 flex items-center gap-2"
          >
            {isAutoChecking ? <><Loader2 className="w-4 h-4 animate-spin" /> Analyzing...</> : <><Bot className="w-4 h-4" /> Health Check Only</>}
          </button>
        </div>
        
        {socialHealthCheck && (
          <div className="mt-3 border-t border-[#DCDAD3] pt-3">
            <div className="flex items-center gap-2 mb-2">
              <Check className="w-4 h-4 text-[#059669]" />
              <span className="text-sm font-medium text-[#0B0B0B]">Health Check Complete</span>
            </div>
            <div className="bg-[#E4E2DC] p-4 max-h-80 overflow-y-auto">
              <pre className="text-sm text-[#4A4840] whitespace-pre-wrap font-sans">{socialHealthCheck}</pre>
            </div>
          </div>
        )}
      </div>

      {/* Screenshots - Matching Website Style */}
      <div className="card p-5 mb-4">
        <h3 className="text-sm font-medium text-[#0B0B0B] mb-2 flex items-center gap-2">
          <Image className="w-5 h-5" /> Social Media Screenshots (up to 4) <span className="text-red-500">*</span>
        </h3>
        <p className="text-sm text-[#8A877D] mb-4">Upload screenshots of key social profiles for visual analysis. Required to proceed.</p>
        
        <input type="file" ref={fileInputRef} onChange={handleImageUpload} accept="image/*" multiple className="hidden" />
        
        <div className="grid grid-cols-2 gap-4 mb-4">
          {images.map((img, index) => (
            <div key={index} className="relative">
              <img src={img} alt={`Screenshot ${index + 1}`} className="w-full h-40 object-cover border border-[#DCDAD3]" />
              <button onClick={() => removeImage(index)}
                className="absolute top-2 right-2 bg-white p-1 hover:bg-gray-100">
                <X className="w-4 h-4" />
              </button>
              <div className="absolute bottom-2 left-2 bg-[#0B0B0B] text-white text-xs px-2 py-1 ">
                {index + 1}
              </div>
            </div>
          ))}
          
          {images.length < SOCIAL_SCREENSHOT_MAX && (
            <button onClick={() => fileInputRef.current?.click()}
              className="h-40 border-2 border-dashed border-[#0B0B0B] flex flex-col items-center justify-center gap-2 hover:bg-[#DEE42F]/5 transition-colors">
              {isCompressing ? (
                <><Loader2 className="w-6 h-6 text-[#B23A3A] animate-spin" /><span className="text-sm text-[#B23A3A]">Compressing...</span></>
              ) : (
                <><Upload className="w-6 h-6 text-[#B23A3A]" /><span className="text-sm text-[#B23A3A] font-medium">Add Screenshot</span><span className="text-xs text-[#8A877D]">{SOCIAL_SCREENSHOT_MAX - images.length} remaining</span></>
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

      {/* LinkedIn Section */}
      {isChannelVisible('linkedin') && (
      <div className="mb-3">
        <AccordionHeader 
          title="LinkedIn" 
          icon={ExternalLink} 
          isOpen={expanded.linkedin} 
          onClick={() => toggleSection('linkedin')}
          badge={relevance.lead.includes('linkedin') ? 'Priority' : null}
          hasContent={!!(inputs.linkedinAuto || inputs.linkedinAbout || inputs.linkedinPosts)}
        />
        {expanded.linkedin && (
          <div className="border border-t-0 border-[#DCDAD3] -b-lg p-4 bg-white space-y-3">
            <AutoPanel content={inputs.linkedinAuto} />
            <div className="flex gap-2">
              <input type="url" value={inputs.linkedinUrl} onChange={(e) => updateInput('linkedinUrl', e.target.value)}
                placeholder="https://linkedin.com/company/..." className="flex-1 px-3 py-2 border border-[#DCDAD3] bg-white text-sm" />
              {inputs.linkedinUrl && (
                <a href={inputs.linkedinUrl} target="_blank" rel="noopener noreferrer" className="px-3 py-2 bg-[#0A66C2] text-white text-xs hover:bg-[#004182] flex items-center gap-1">
                  <ExternalLink className="w-3 h-3" /> Open
                </a>
              )}
            </div>
            <div>
              <label className="dc-kicker-sm mb-2 block">Company Profile & About Section</label>
              <textarea value={inputs.linkedinAbout} onChange={(e) => updateInput('linkedinAbout', e.target.value)}
                placeholder="Paste the company description from the 'About' tab: overview, mission, employee count, specialties..." className="w-full h-20 px-3 py-2 border border-[#DCDAD3] bg-white resize-none text-sm" />
            </div>
            <div>
              <label className="dc-kicker-sm mb-2 block">Recent Posts & Engagement</label>
              <textarea value={inputs.linkedinPosts} onChange={(e) => updateInput('linkedinPosts', e.target.value)}
                placeholder="Paste 5-10 recent posts with engagement: post text, likes, comments, reposts. Include any notable articles." className="w-full h-20 px-3 py-2 border border-[#DCDAD3] bg-white resize-none text-sm" />
            </div>
          </div>
        )}
      </div>
      )}

      {/* X/Twitter Section */}
      {isChannelVisible('x') && (
      <div className="mb-3">
        <AccordionHeader 
          title="X (Twitter)" 
          icon={ExternalLink} 
          isOpen={expanded.x} 
          onClick={() => toggleSection('x')}
          badge={relevance.lead.includes('x') ? 'Priority' : null}
          hasContent={!!(inputs.xAuto || inputs.xContent)}
        />
        {expanded.x && (
          <div className="border border-t-0 border-[#DCDAD3] -b-lg p-4 bg-white space-y-3">
            <AutoPanel content={inputs.xAuto} />
            <div className="flex gap-2">
              <input type="url" value={inputs.xUrl} onChange={(e) => updateInput('xUrl', e.target.value)}
                placeholder="https://x.com/..." className="flex-1 px-3 py-2 border border-[#DCDAD3] bg-white text-sm" />
              {inputs.xUrl && (
                <a href={inputs.xUrl} target="_blank" rel="noopener noreferrer" className="px-3 py-2 bg-[#0B0B0B] text-white text-xs hover:bg-[#333] flex items-center gap-1">
                  <ExternalLink className="w-3 h-3" /> Open
                </a>
              )}
            </div>
            <textarea value={inputs.xContent} onChange={(e) => updateInput('xContent', e.target.value)}
              placeholder="Anything the auto-check missed or got wrong..." className="w-full h-20 px-3 py-2 border border-[#DCDAD3] bg-white resize-none text-sm" />
          </div>
        )}
      </div>
      )}

      {/* Instagram Section */}
      {isChannelVisible('instagram') && (
      <div className="mb-3">
        <AccordionHeader 
          title="Instagram" 
          icon={Image} 
          isOpen={expanded.instagram} 
          onClick={() => toggleSection('instagram')}
          badge={relevance.lead.includes('instagram') ? 'Priority' : null}
          hasContent={!!(inputs.instagramAuto || inputs.instagramContent)}
        />
        {expanded.instagram && (
          <div className="border border-t-0 border-[#DCDAD3] -b-lg p-4 bg-white space-y-3">
            <AutoPanel content={inputs.instagramAuto} />
            <textarea value={inputs.instagramContent} onChange={(e) => updateInput('instagramContent', e.target.value)}
              placeholder="Anything the auto-check missed or got wrong..." className="w-full h-20 px-3 py-2 border border-[#DCDAD3] bg-white resize-none text-sm" />
          </div>
        )}
      </div>
      )}

      {/* YouTube */}
      {isChannelVisible('youtube') && (
      <div className="mb-3">
        <AccordionHeader 
          title="YouTube" 
          icon={Play} 
          isOpen={expanded.other} 
          onClick={() => toggleSection('other')}
          badge={inputs.youtubeAuto?.includes('[API Data]') ? 'Verified' : (relevance.lead.includes('youtube') ? 'Priority' : null)}
          hasContent={!!(inputs.youtubeAuto || inputs.youtubeContent)}
        />
        {expanded.other && (
          <div className="border border-t-0 border-[#DCDAD3] -b-lg p-4 bg-white space-y-3">
            <AutoPanel content={inputs.youtubeAuto} />
            <div>
              <div className="flex items-center justify-end mb-1">
                <a href={`https://www.youtube.com/results?search_query=${encodeURIComponent(project.brandName)}`} target="_blank" rel="noopener noreferrer" 
                   className="px-2 py-0.5 bg-red-100 text-red-700 text-[10px] font-medium hover:bg-red-200 transition-colors flex items-center gap-1">
                  Verify <ExternalLink className="w-2.5 h-2.5" />
                </a>
              </div>
              <textarea value={inputs.youtubeContent} onChange={(e) => updateInput('youtubeContent', e.target.value)}
                placeholder="Anything the auto-check missed or got wrong..." className="w-full h-16 px-3 py-2 border border-[#DCDAD3] bg-white resize-none text-sm" />
            </div>
          </div>
        )}
      </div>
      )}

      {/* Other platforms, auto only */}
      {inputs.otherPlatformsAuto && (
        <div className="card p-4 mb-3">
          <h3 className="text-sm font-medium text-[#0B0B0B] mb-2">Facebook, TikTok, Bluesky, Substack</h3>
          <AutoPanel content={inputs.otherPlatformsAuto} />
        </div>
      )}

      {/* Show all channels toggle */}
      {relevance.secondary.length > 0 && (
        <button
          onClick={() => setShowAllChannels(v => !v)}
          className="text-xs text-[#8A877D] hover:text-[#0B0B0B] transition-colors mb-4 flex items-center gap-1.5"
        >
          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showAllChannels ? 'rotate-180' : ''}`} />
          {showAllChannels ? 'Show priority channels only' : `Show all channels (${relevance.secondary.length} more)`}
        </button>
      )}

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
          <div className="border border-t-0 border-[#DCDAD3] -b-lg p-4 bg-white space-y-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-medium text-[#8A877D]">Glassdoor <span className="text-purple-600">(→ Reflective)</span></label>
                <a href="https://www.glassdoor.com/Search/results.htm" target="_blank" rel="noopener noreferrer" 
                   className="px-2 py-0.5 bg-purple-100 text-purple-700 text-[10px] font-medium hover:bg-purple-200 transition-colors flex items-center gap-1">
                  Verify <ExternalLink className="w-2.5 h-2.5" />
                </a>
              </div>
              {inputs.glassdoorAuto && <div className="mb-2"><AutoPanel content={inputs.glassdoorAuto} /></div>}
              <textarea value={inputs.glassdoorContent} onChange={(e) => updateInput('glassdoorContent', e.target.value)}
                placeholder="Anything the auto-check missed or got wrong..." className="w-full h-16 px-3 py-2 border border-[#DCDAD3] bg-white resize-none text-sm" />
            </div>
            <div className="bg-blue-50 border border-blue-200 p-3">
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-medium text-blue-800">WIPO Trademark <span className="font-normal">(→ Intentional)</span></label>
                <div className="flex gap-2">
                  <button
                    onClick={runWipoSearch}
                    disabled={isSearchingWipo || !project.brandName}
                    className="px-3 py-1 bg-[#8B5CF6] text-white text-xs font-medium hover:bg-[#7C3AED] transition-colors flex items-center gap-1 disabled:opacity-50"
                  >
                    {isSearchingWipo ? <><Loader2 className="w-3 h-3 animate-spin" /> Searching...</> : <><Sparkles className="w-3 h-3" /> Auto-Search</>}
                  </button>
                  <a href="https://branddb.wipo.int/en/similarname" target="_blank" rel="noopener noreferrer" 
                     className="px-3 py-1 bg-[#0067B9] text-white text-xs font-medium hover:bg-[#005299] transition-colors flex items-center gap-1">
                    Manual <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
              {inputs.wipoContent?.includes('[Auto-searched]') && (
                <p className="text-xs text-green-600 mb-2">✓ Trademark data auto-searched</p>
              )}
              <textarea value={inputs.wipoContent} onChange={(e) => updateInput('wipoContent', e.target.value)}
                placeholder={`Trademark status for ${project.brandName}: registrations found, jurisdictions covered, any similar/conflicting marks, protection status...`}
                className={`w-full h-20 px-3 py-2 border border-blue-300  bg-white resize-none text-sm ${inputs.wipoContent ? 'bg-blue-50' : ''}`} />
            </div>
          </div>
        )}
      </div>

      {/* Campaign & Paid Signals - merged from Hashtags and Paid Media */}
      <div className="mb-4">
        <AccordionHeader 
          title="Campaign & Paid Signals" 
          icon={Target} 
          isOpen={expanded.campaign} 
          onClick={() => toggleSection('campaign')}
          badge="Campaign Score"
          hasContent={!!(inputs.campaignAuto || inputs.campaignContent)}
        />
        {expanded.campaign && (
          <div className="border border-t-0 border-[#DCDAD3] -b-lg p-4 bg-white space-y-3">
            <p className="text-xs text-[#8A877D]">
              This is what drives the Campaign Coherence score. What matters is whether a strategy and a creative idea thread the activity together, not how much activity there is.
              {project.businessModel === 'b2b'
                ? ' For B2B, LinkedIn Ads and Google Search usually carry the weight.'
                : project.businessModel === 'b2c'
                ? ' For B2C, check Meta, TikTok, Google and YouTube.'
                : ' Check both B2B channels and consumer channels for hybrid brands.'}
            </p>

            <AutoPanel content={inputs.campaignAuto} />

            <div>
              <div className="text-[10px] font-semibold text-[#999] uppercase tracking-wider mb-1.5">Ad libraries</div>
              <div className="grid grid-cols-2 gap-2">
                <a href={`https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=ALL&q="${encodeURIComponent(project.brandName)}"&search_type=keyword_exact_phrase`} target="_blank" rel="noopener noreferrer" 
                   className="px-2 py-1.5 bg-[#1877F2] text-white text-xs font-medium hover:bg-[#166FE5] transition-colors flex items-center justify-center gap-1">
                  <span>Meta</span> <ExternalLink className="w-3 h-3" />
                </a>
                <a href={`https://adstransparency.google.com/?region=anywhere&text="${encodeURIComponent(project.brandName)}"`} target="_blank" rel="noopener noreferrer" 
                   className="px-2 py-1.5 bg-[#4285F4] text-white text-xs font-medium hover:bg-[#3367D6] transition-colors flex items-center justify-center gap-1">
                  <span>Google</span> <ExternalLink className="w-3 h-3" />
                </a>
                <a href={`https://www.linkedin.com/ad-library/search?accountOwner="${encodeURIComponent(project.brandName)}"`} target="_blank" rel="noopener noreferrer" 
                   className={`px-2 py-1.5 text-white text-xs font-medium  transition-colors flex items-center justify-center gap-1 ${project.businessModel === 'b2b' ? 'bg-[#0A66C2] hover:bg-[#004182] ring-2 ring-[#0A66C2] ring-offset-1' : 'bg-[#0A66C2] hover:bg-[#004182]'}`}>
                  <span>LinkedIn{project.businessModel === 'b2b' ? ' ★' : ''}</span> <ExternalLink className="w-3 h-3" />
                </a>
                <a href={`https://library.tiktok.com/ads?region=all&adv_name="${encodeURIComponent(project.brandName)}"`} target="_blank" rel="noopener noreferrer" 
                   className={`px-2 py-1.5 text-white text-xs font-medium  transition-colors flex items-center justify-center gap-1 ${project.businessModel === 'b2b' ? 'bg-gray-400 hover:bg-gray-500' : project.businessModel === 'b2c' ? 'bg-black hover:bg-gray-800 ring-2 ring-black ring-offset-1' : 'bg-black hover:bg-gray-800'}`}>
                  <span>TikTok{project.businessModel === 'b2c' ? ' ★' : ''}</span> <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>

            <div>
              <div className="text-[10px] font-semibold text-[#999] uppercase tracking-wider mb-1.5">Hashtag search</div>
              <div className="grid grid-cols-2 gap-2">
                <a href={`https://www.instagram.com/explore/tags/${project.brandName?.toLowerCase().replace(/\s+/g, '')}/`} target="_blank" rel="noopener noreferrer" 
                   className="px-2 py-1.5 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xs font-medium hover:opacity-90 transition-opacity flex items-center justify-center gap-1">
                  <span>Instagram #</span> <ExternalLink className="w-3 h-3" />
                </a>
                <a href={`https://www.linkedin.com/search/results/content/?keywords=%23${project.brandName?.toLowerCase().replace(/\s+/g, '')}`} target="_blank" rel="noopener noreferrer" 
                   className="px-2 py-1.5 bg-[#0A66C2] text-white text-xs font-medium hover:bg-[#004182] transition-colors flex items-center justify-center gap-1">
                  <span>LinkedIn #</span> <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>

            <div>
              <label className="dc-kicker-sm mb-2 block">Your notes</label>
              <textarea value={inputs.campaignContent} onChange={(e) => updateInput('campaignContent', e.target.value)}
                placeholder={`Anything the auto-check missed. Most useful:

• Named campaigns and where they run
• Whether one idea threads them together, or they are separate bursts
• Whether paid creative matches the organic work
• Whether anyone outside the brand has picked the idea up`} 
                className="w-full h-28 px-3 py-2 border border-[#DCDAD3] bg-white resize-none text-sm" />
            </div>
          </div>
        )}
      </div>

      {/* Third-party conversation, auto only */}
      {inputs.thirdPartyAuto && (
        <div className="card p-4 mb-4">
          <h3 className="text-sm font-medium text-[#0B0B0B] mb-2">Third-Party Conversation</h3>
          <AutoPanel content={inputs.thirdPartyAuto} />
        </div>
      )}

      {/* Observations - Simplified */}
      <div className="card p-4 mb-4">
        <h3 className="text-sm font-medium text-[#0B0B0B] mb-2">Assessor Notes</h3>
        <textarea value={assessmentData.observations || ''} onChange={(e) => setAssessmentData({ ...assessmentData, observations: e.target.value })}
          placeholder="Your observations about their social presence..." className="w-full h-16 px-3 py-2 border border-[#DCDAD3] bg-white resize-none text-sm" />
      </div>

      {/* Analysis Button & Results */}
      {!isComplete && (
        <button onClick={runAnalysis} disabled={isProcessing || !hasMinimumContent} className="btn-primary flex items-center gap-2 mb-4">
          {isProcessing ? <><Loader2 className="w-4 h-4 animate-spin" /> Analyzing...</> : <><Play className="w-4 h-4" /> Run Social Analysis</>}
        </button>
      )}

      {error && <div className="bg-red-50 border border-red-200 p-3 mb-4 text-red-700 text-sm">{error}</div>}

      {isComplete && (
        <div className="card p-5 mb-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-[#0B0B0B] flex items-center gap-2">
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
          <div className="bg-[#E4E2DC] p-4 max-h-96 overflow-y-auto">
            <pre className="text-sm text-[#4A4840] whitespace-pre-wrap font-sans">{assessmentData.content}</pre>
          </div>
        </div>
      )}

      {proceedError && (
        <div className="bg-amber-50 border border-amber-200 p-4 mb-4 text-amber-800 text-sm flex items-center gap-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          {proceedError}
        </div>
      )}

      <div className="flex items-center justify-between pt-4 border-t border-[#DCDAD3]">
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
  // Third-party and search signals (auto-fetched, NOT counted as AI engines)
  const [googleNewsContent, setGoogleNewsContent] = useState(assessmentData.googleNewsContent || '');
  const [trustpilotContent, setTrustpilotContent] = useState(assessmentData.trustpilotContent || '');
  const [searchSnapshotContent, setSearchSnapshotContent] = useState(assessmentData.searchSnapshotContent || '');
  const [fetching, setFetching] = useState({});

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

Name Confusion and Category Bleed
Is this brand being confused with anything else? Check for companies that share or resemble the name, competitors positioned closely enough to blur together, and unrelated sectors or entities the name drags in. Where you find confusion, name the specific entity or category and say whether it crowds out, distorts, or merely sits beside the real brand. If the brand owns its name cleanly, say so.

Conclude with a Summary Brand Impression — a candid 3–4 sentence synthesis of how this brand appears to someone researching them online: what they stand for, how they are regarded, and any gaps or concerns a prospect might notice. Then provide an AI Discoverability Score from 1–10 reflecting how well-represented and clearly understood this brand is in online search, with a brief rationale for the score.${reputationFlags ? `

IMPORTANT CONTEXT — KNOWN REPUTATION FLAGS:
The following issues have been identified in ${project.brandName}'s public record. Please address these directly in your response — particularly in sections 6 (Reputation) and 7 (Authenticity). Do not omit or minimise them:
${reputationFlags}` : ''}`;

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

  // Auto-fetch third-party / search signals via web search. These feed the
  // reputation analysis but are NOT AI engines and never count toward synthesis.
  const fetchSignal = async (key, prompt, prefix, setter) => {
    setFetching(f => ({ ...f, [key]: true }));
    setError(null);
    try {
      const response = await fetch('/api/claude', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, useWebSearch: true })
      });
      if (!response.ok) throw new Error('Fetch failed');
      const data = await response.json();
      const result = (data.content?.filter(b => b.type === 'text').map(b => b.text).join('\n')) || data.text || '';
      if (result) setter(`${prefix} ${result}`);
      else setError(`${key} returned nothing — try again or paste manually.`);
    } catch {
      setError(`${key} fetch failed — try again or paste manually.`);
    } finally {
      setFetching(f => ({ ...f, [key]: false }));
    }
  };

  const fetchGoogleNews = () => fetchSignal(
    'Google News',
    `Search Google News and recent press for "${project.brandName}" over the last 3 months. Report what third-party outlets are saying: headlines, outlets, dates, and the angle of coverage. Note sentiment and any recurring narrative. If coverage is thin or absent, say so plainly. Do not pad.`,
    '[Auto-fetched: Google News]',
    setGoogleNewsContent
  );

  const fetchTrustpilot = () => fetchSignal(
    'Trustpilot',
    `Find the Trustpilot profile for "${project.brandName}". Report the overall rating, number of reviews, and the split between positive and negative. Summarise the recurring praise and the recurring complaints in the customers' own framing. Note how the brand responds to reviews. If there is no Trustpilot presence, say so.`,
    '[Auto-fetched: Trustpilot]',
    setTrustpilotContent
  );

  const fetchSearchSnapshot = () => fetchSignal(
    'Search Snapshot',
    `Run a web search for "${project.brandName}" the way a prospect would. Synthesise what the top of the results actually surfaces: who the brand is, what dominates the first page, and whether the picture is coherent or fragmented. This is a stand-in for the Google AI Overview, a synthesised read of top search results rather than an AI engine's opinion of the brand. Report what is there, not what should be.`,
    '[Auto-fetched: Search Snapshot, synthesised from top results, not the literal Google AI Overview]',
    setSearchSnapshotContent
  );

  const generateSynthesis = async () => {
    setIsProcessing(p => ({ ...p, synthesis: true }));
    setError(null);
    try {
      const engineSections = engines
        .filter(e => manualInput[e.key])
        .map(e => `${e.name.toUpperCase()}: ${manualInput[e.key]}`)
        .join('\n\n');

      const prompt = `You are assessing how ${project.brandName} is represented across multiple AI engines and the wider public record. Review the full evidence base below, the AI engine responses together with the search, news, review, Wikipedia, and community signals, and weigh all of it. The AI engines are one input among several, not the whole picture.

AI ENGINE RESPONSES:

${engineSections}

${reputationFlags ? `REPUTATION FLAGS — CRITICAL CONTEXT:\nThe following issues were identified before running AI queries. These flags must be addressed directly in your analysis — do not omit or minimise them:\n${reputationFlags}\n` : ''}
${wikipediaContent ? `WIKIPEDIA PRESENCE:\n${wikipediaContent}\n` : ''}
${redditContent ? `REDDIT COMMUNITY PERCEPTION:\n${redditContent}\n` : ''}
${googleNewsContent ? `GOOGLE NEWS / RECENT PRESS (third-party signal, not an AI engine):\n${googleNewsContent}\n` : ''}
${trustpilotContent ? `TRUSTPILOT REVIEWS (third-party signal, not an AI engine):\n${trustpilotContent}\n` : ''}
${searchSnapshotContent ? `SEARCH SNAPSHOT (synthesised read of top search results, not an AI engine):\n${searchSnapshotContent}\n` : ''}
${assessmentData.observations ? `ASSESSOR OBSERVATIONS:\n${assessmentData.observations}` : ''}

Provide a comprehensive AI reputation assessment:
1. Convergence — Where do the sources agree? (likely accurate signals)
2. Divergence — Where do they differ, and what might explain it?
3. Sentiment — Overall tone and brand framing across the evidence
4. Gaps — What can't be answered about this brand from any source? What's absent?
5. Name Confusion — Do the sources conflate this brand with a namesake, a look-alike competitor, or an irrelevant category? Flag any answer describing the wrong entity, and say how badly it pollutes the brand's identity.
6. Owned vs Third-Party — Separate what the brand says about itself, its site and its own channels, from what others say about it: press, reviews, forums, chatter, and the search and Trustpilot signals above. Judge each description as one of: Aligned (owned and third-party tell the same story), Deviating (third-party contradicts or reframes the claim), or Missing (the brand describes itself and no third-party source corroborates it, so it exists in its own telling and nowhere else). Owned content tells the engines who the brand is. Third-party conversation tells them whether it matters. Say which one is carrying this brand, and where the gap leaves it exposed.
${reputationFlags ? `7. Reputation Risks — How do the identified flags (${reputationFlags.substring(0, 100)}...) affect surfaced perception? Are the sources acknowledging, downplaying, or ignoring these issues?\n8. Recommendations — Specific steps to improve representation and discoverability` : '7. Recommendations — Specific steps to improve representation and discoverability'}

Write in flowing prose. Refer to the AI engines collectively. Do not state or imply a specific number of them, and never write phrases like "the four AI systems" or "all four engines". Treat the search, news, review, Wikipedia, and community signals as part of the same review, not as afterthoughts. If reputation flags were provided, they must be woven throughout the analysis, not confined to a single section.`;

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
        googleNewsContent,
        trustpilotContent,
        searchSnapshotContent,
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
      <MobileAssessmentBanner />
      <div className="flex items-start gap-4 mb-6">
        <div className="w-12 h-12 bg-[#3B82F6]/10 flex items-center justify-center">
          <Bot className="w-6 h-6 text-[#3B82F6]" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-[#0B0B0B]">AI Reputation Assessment</h2>
          <p className="text-sm text-[#8A877D]">What prospects discover when researching {project.brandName}</p>
        </div>
      </div>

      <CompletionIndicator items={completionItems} />

      {/* AI Brand Perception Prompt */}
      <div className="card p-4 mb-4 border-l-4 border-[#3B82F6]">
        <div className="flex items-start justify-between mb-2">
          <div>
            <h3 className="text-sm font-medium text-[#0B0B0B] mb-0.5">AI Brand Research Prompt</h3>
            <p className="text-xs text-[#8A877D]">Copy this prompt and run it in each AI engine below. Paste each response back.</p>
          </div>
        </div>
        <div className="bg-[#F2F0EA] p-3 max-h-32 overflow-y-auto mb-2">
          <pre className="text-xs text-[#4A4840] whitespace-pre-wrap font-sans leading-relaxed">{aiPerceptionPrompt.substring(0, 400)}...</pre>
        </div>
        <p className="text-xs text-[#B3B0A8]">Customised for <strong>{project.brandName}</strong> · {industryName}</p>
      </div>

      {error && <div className="bg-red-50 border border-red-200 p-3 mb-4 text-red-700 text-sm">{error}</div>}

      {/* AI Engine Cards — uniform pattern */}
      <div className="space-y-3 mb-4">
        {engines.map(engine => (
          <div key={engine.key} className={`card p-4 ${manualInput[engine.key] ? 'bg-[#E4E2DC]' : ''}`}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 flex items-center justify-center ${manualInput[engine.key] ? 'bg-[#DEE42F] text-white' : 'bg-[#E4E2DC]'}`}>
                  {manualInput[engine.key] ? <Check className="w-5 h-5" /> : <Bot className="w-5 h-5 text-gray-400" />}
                </div>
                <div>
                  <h4 className="font-medium">{engine.name}</h4>
                  <p className="text-sm text-[#8A877D]">{engine.brand}</p>
                </div>
              </div>
              <a
                href={engine.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => copyToClipboard(aiPerceptionPrompt)}
                className="px-3 py-1.5 text-white text-xs font-medium transition-colors flex items-center gap-1"
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
              className={`w-full h-24 px-3 py-2 border border-[#DCDAD3]  text-sm ${manualInput[engine.key] ? 'bg-[#E4E2DC]' : 'bg-white'}`}
            />
          </div>
        ))}
      </div>

      {/* AI Training Sources */}
      <div className="card p-4 mb-4 border-l-4 border-[#6366F1]">
        <h3 className="text-sm font-medium text-[#0B0B0B] mb-1">AI Training Sources</h3>
        <p className="text-xs text-[#8A877D] mb-3">Wikipedia and Reddit shape how AI models understand and describe a brand. Check both and record what you find.</p>
        <div className="space-y-3">
          {/* Wikipedia */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-[#8A877D]">Wikipedia</label>
              <a href={`https://en.wikipedia.org/wiki/Special:Search?search=${encodeURIComponent(project.brandName)}`} target="_blank" rel="noopener noreferrer"
                 className="px-2 py-0.5 bg-gray-100 text-gray-700 text-[10px] font-medium hover:bg-gray-200 transition-colors flex items-center gap-1">
                Search Wikipedia <ExternalLink className="w-2.5 h-2.5" />
              </a>
            </div>
            <textarea
              value={wikipediaContent}
              onChange={(e) => { setWikipediaContent(e.target.value); setAssessmentData({ ...assessmentData, wikipediaContent: e.target.value }); }}
              placeholder={`Does ${project.brandName} have a Wikipedia page? Record what it says — or note its absence.`}
              className="w-full h-16 px-3 py-2 border border-[#DCDAD3] bg-white resize-none text-sm"
            />
          </div>
          {/* Reddit Answers */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-orange-800">Reddit Answers <span className="text-[#8A877D] font-normal">(AI search visibility)</span></label>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => copyToClipboard(redditPrompt)}
                  className="px-2 py-0.5 bg-orange-100 text-orange-700 text-[10px] font-medium hover:bg-orange-200 transition-colors flex items-center gap-1"
                >
                  <Copy className="w-2.5 h-2.5" /> Copy prompt
                </button>
                <a href="https://www.reddit.com/answers/" target="_blank" rel="noopener noreferrer"
                   className="px-2 py-0.5 bg-[#FF4500] text-white text-[10px] font-medium hover:bg-[#E03D00] transition-colors flex items-center gap-1">
                  Open Reddit Answers <ExternalLink className="w-2.5 h-2.5" />
                </a>
              </div>
            </div>
            <textarea
              value={redditContent}
              onChange={(e) => { setRedditContent(e.target.value); setAssessmentData({ ...assessmentData, redditAnswersContent: e.target.value }); }}
              placeholder={`Paste Reddit Answers response about ${project.brandName}'s reputation and community perception...`}
              className="w-full h-24 px-3 py-2 border border-orange-200 bg-orange-50 resize-none text-sm"
            />
          </div>
        </div>
      </div>

      {/* Third-Party & Search Signals (auto-fetched, NOT AI engines) */}
      <div className="card p-4 mb-4 border-l-4 border-[#0B0B0B]">
        <h3 className="text-sm font-medium text-[#0B0B0B] mb-1">Third-Party &amp; Search Signals</h3>
        <p className="text-xs text-[#8A877D] mb-3">News, reviews, and what search surfaces. These feed the reputation analysis but do not count as AI engines. Auto-fetch each, then edit if needed.</p>
        <div className="space-y-3">
          {[
            { key: 'news', label: 'Google News', value: googleNewsContent, setter: setGoogleNewsContent, field: 'googleNewsContent', run: fetchGoogleNews, placeholder: `Recent press and news coverage of ${project.brandName}...` },
            { key: 'trustpilot', label: 'Trustpilot', value: trustpilotContent, setter: setTrustpilotContent, field: 'trustpilotContent', run: fetchTrustpilot, placeholder: `Trustpilot rating, review volume, recurring praise and complaints...` },
            { key: 'search', label: 'Search Snapshot', sub: '(synthesised from top results, stands in for Google AI Overview)', value: searchSnapshotContent, setter: setSearchSnapshotContent, field: 'searchSnapshotContent', run: fetchSearchSnapshot, placeholder: `What the top of a Google search surfaces for ${project.brandName}...` },
          ].map(row => (
            <div key={row.key}>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-medium text-[#8A877D]">{row.label} {row.sub && <span className="font-normal text-[#999]">{row.sub}</span>}</label>
                <button
                  onClick={row.run}
                  disabled={!!fetching[row.label]}
                  className="px-2 py-0.5 bg-[#DEE42F] text-white text-[10px] font-medium hover:bg-[#C62828] transition-colors flex items-center gap-1 disabled:opacity-50"
                >
                  {fetching[row.label] ? <><Loader2 className="w-2.5 h-2.5 animate-spin" /> Fetching</> : <><Search className="w-2.5 h-2.5" /> Auto-fetch</>}
                </button>
              </div>
              <textarea
                value={row.value}
                onChange={(e) => { row.setter(e.target.value); setAssessmentData({ ...assessmentData, [row.field]: e.target.value }); }}
                placeholder={row.placeholder}
                className="w-full h-20 px-3 py-2 border border-[#DCDAD3] bg-white resize-none text-sm"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Assessor Observations */}
      <div className="card p-5 mb-4">
        <h3 className="text-sm font-medium text-[#0B0B0B] mb-2">Assessor Observations</h3>
        <p className="text-sm text-[#8A877D] mb-3">Your observations will be included in the synthesis.</p>
        <textarea value={assessmentData.observations || ''} onChange={(e) => setAssessmentData({ ...assessmentData, observations: e.target.value })}
          placeholder="Note discrepancies between engines, anything surprising, or gaps you observed..." className="w-full h-20 px-3 py-2 border border-[#DCDAD3] bg-white resize-none" />
      </div>

      {canSynthesize && !isComplete && (
        <button onClick={generateSynthesis} disabled={isProcessing.synthesis} className="btn-primary flex items-center gap-2 mb-6">
          {isProcessing.synthesis ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating...</> : <><Play className="w-4 h-4" /> Generate Synthesis ({filledCount} engines)</>}
        </button>
      )}

      {isComplete && (
        <div className="card p-5 mb-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-[#0B0B0B] flex items-center gap-2">
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
          <div className="bg-[#E4E2DC] p-4 max-h-64 overflow-y-auto text-sm text-[#4A4840]">{assessmentData.content}</div>
        </div>
      )}

      {proceedError && (
        <div className="bg-amber-50 border border-amber-200 p-4 mb-4 text-amber-800 text-sm flex items-center gap-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          {proceedError}
        </div>
      )}

      <div className="flex items-center justify-between pt-6 border-t border-[#DCDAD3]">
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
      <MobileAssessmentBanner />
      <div className="flex items-start gap-4 mb-6">
        <div className="w-12 h-12 bg-[#10B981]/10 flex items-center justify-center">
          <Newspaper className="w-6 h-6 text-[#10B981]" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-[#0B0B0B]">Earned Media Assessment</h2>
          <p className="text-sm text-[#8A877D]">{project.brandName}'s press coverage</p>
        </div>
      </div>

      <CompletionIndicator items={completionItems} />

      {/* Coverage Paste Field */}
      <div className="card p-5 mb-4">
        <h3 className="text-sm font-medium text-[#0B0B0B] mb-2">Media Coverage (Last 3 Months)</h3>
        <p className="text-sm text-[#8A877D] mb-4">
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
          className="w-full h-28 px-3 py-2 border border-[#DCDAD3] bg-white resize-none text-sm"
        />
        <p className="text-xs text-[#8A877D] mt-2">
          Include: news articles, podcast appearances, conference keynotes, analyst mentions, awards announcements, industry rankings
        </p>
      </div>

      {/* Auto-Assess Earned Media Performance */}
      <div className="card p-5 mb-4 border-l-4 border-[#10B981]">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className="text-sm font-medium text-[#0B0B0B] mb-1 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#10B981]" />
              Auto-Assess Earned Media Performance
            </h3>
            <p className="text-xs text-[#8A877D]">
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
              <span className="text-sm font-medium text-[#0B0B0B]">Performance Assessment Complete</span>
            </div>
            <div className="bg-[#E4E2DC] p-4 max-h-80 overflow-y-auto">
              <pre className="text-sm text-[#4A4840] whitespace-pre-wrap font-sans">{assessmentData.autoAssessContent}</pre>
            </div>
          </div>
        )}
      </div>

      {/* Assessor Observations - before analysis button */}
      <div className="card p-5 mb-4">
        <h3 className="text-sm font-medium text-[#0B0B0B] mb-2">Assessor Observations</h3>
        <p className="text-sm text-[#8A877D] mb-3">Your observations will be included in the analysis and final report.</p>
        <textarea value={assessmentData.observations || ''} onChange={(e) => setAssessmentData({ ...assessmentData, observations: e.target.value })}
          placeholder="Add your own observations about their media presence, PR strategy, coverage quality..." className="w-full h-20 px-3 py-2 border border-[#DCDAD3] bg-white resize-none" />
      </div>

      {!isComplete && (
        <button onClick={runAnalysis} disabled={isProcessing} className="btn-primary flex items-center gap-2 mb-6">
          {isProcessing ? <><Loader2 className="w-4 h-4 animate-spin" /> Analyzing...</> : <><Play className="w-4 h-4" /> Run Earned Media Analysis</>}
        </button>
      )}

      {error && <div className="bg-red-50 border border-red-200 p-4 mb-6 text-red-700">{error}</div>}

      {isComplete && (
        <div className="card p-5 mb-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-[#0B0B0B] flex items-center gap-2">
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
          <div className="bg-[#E4E2DC] p-4 max-h-96 overflow-y-auto">
            <pre className="text-sm text-[#4A4840] whitespace-pre-wrap font-sans">{assessmentData.content}</pre>
          </div>
        </div>
      )}

      {proceedError && (
        <div className="bg-amber-50 border border-amber-200 p-4 mb-4 text-amber-800 text-sm flex items-center gap-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          {proceedError}
        </div>
      )}

      <div className="flex items-center justify-between pt-6 border-t border-[#DCDAD3]">
        <button onClick={onPrev} className="btn-secondary flex items-center gap-2"><ArrowLeft className="w-4 h-4" /> Back</button>
        <button onClick={handleProceed} disabled={!canProceed} className="btn-primary flex items-center gap-2">Continue <ArrowRight className="w-4 h-4" /></button>
      </div>
    </div>
  );
}
// Report Page
function ReportPage({ project, setProject, scores, setScores, assessments, apiKey, onSave, onPrev, profile, compassResults = [], savedBenchmark = null }) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [isScoring, setIsScoring] = useState(false);
  const [scoringError, setScoringError] = useState(null);
  const [scoringProgress, setScoringProgress] = useState(0);
  const [scoringStage, setScoringStage] = useState('');
  // Top stories from Stay Conscious, shown on the generating screen to fill the wait.
  const [waitingStories, setWaitingStories] = useState([]);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/stay-conscious-newsletter');
        const data = await res.json();
        const ns = data?.newsletter;
        if (!ns || cancelled) return;
        const firstSentence = (t) => {
          const s = (t || '').split(/[.!?]/)[0].trim();
          return s ? s + '.' : '';
        };
        const items = [];
        if (ns.leadStory?.headline) {
          items.push({ headline: ns.leadStory.headline, summary: firstSentence(ns.leadStory.insight), category: ns.leadStory.category });
        }
        (ns.storyOpportunities || []).forEach(s => {
          if (s?.headline) items.push({ headline: s.headline, summary: firstSentence(s.body) });
        });
        if (!cancelled) setWaitingStories(items.slice(0, 3));
      } catch { /* waiting panel is optional, fail quietly */ }
    })();
    return () => { cancelled = true; };
  }, []);
  const [expandedSections, setExpandedSections] = useState({
    attributes: true,
    recommendations: true,
    services: true,
    conclusions: true,
    justification: false,
    footprint: true,
    campaign: true,
    benchmark: true,
    evaluated: false,
    readouts: false,
    readoutWebsite: false,
    readoutSocial: false,
    readoutAI: false,
    readoutEarned: false,
  });
  const [animatedScore, setAnimatedScore] = useState(0);
  const [showClientLink, setShowClientLink] = useState(false);
  const chartRef = useRef(null);
  const benchmarkSpreadRef = useRef(null);
  const benchmarkPositionRef = useRef(null);
  const benchmarkRadarRef = useRef(null);
  
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
    setScoringStage('Absorbing assessment data...');

    // The real work is a single long model call with no mid-call signal, so we
    // cannot measure true progress. Instead of jumping to 95% and stalling, we
    // trickle: each tick closes a fraction of the gap to a 95% ceiling, so the
    // bar keeps moving the whole time and only eases as it nears the end. On
    // completion we snap to 100%. Calibrated to feel right for a 20 to 45s call.
    const stageFor = (p) => {
      if (p < 14) return 'Absorbing website data...';
      if (p < 28) return 'Absorbing social and paid signals...';
      if (p < 42) return 'Absorbing AI reputation...';
      if (p < 56) return 'Absorbing earned media...';
      if (p < 72) return 'Scoring all 8 attributes...';
      if (p < 88) return 'Working out what is driving each score...';
      return 'Writing actions and finalizing the report...';
    };
    let prog = 0;
    const progressInterval = setInterval(() => {
      prog = prog + (95 - prog) * 0.045;
      if (prog > 94.5) prog = 94.5;
      setScoringProgress(Math.round(prog));
      setScoringStage(stageFor(prog));
    }, 350);

    try {
    // Helper: truncate long text to keep prompt lean. Returns '' for empty so template literals don't render "null".
    const cap = (text, limit = 1200) => {
      if (!text || text === 'None' || text === 'Not specified') return '';
      return text.length > limit ? text.slice(0, limit) + '... [truncated]' : text;
    };
    const field = (label, value) => {
      const v = typeof value === 'string' ? value.trim() : value;
      return v && !['Not assessed','Not checked','Not reviewed','Not noted','Not provided','None noted',''].includes(v) ? `${label}: ${v}` : null;
    };

    const prompt = `You are scoring ${project.brandName} against the Conscious Compass Framework v${FRAMEWORK_VERSION}.
${project.assessorContext ? `\nSTRATEGIC LENS — READINESS:\nThe brand has stated the following aspirations and goals:\n${project.assessorContext}\n\nWrite the whole assessment through this lens. Do not only score what the brand is today; judge how ready it is to achieve what it says it wants. If it wants to reposition, assess its readiness to reposition. If it wants to reach a new audience, assess how well set up it is to reach that audience. Carry this readiness judgement through the findings, impact, actions, and conclusion.\nDo NOT reference the assessor, "the context provided", or this instruction anywhere in the report. The only thing you may surface from it is the brand's own stated aspirations and goals, framed as the brand's ambition. Everything else appears as analysis of readiness, never as a quote.\n` : ''}

ASSESSMENT DATA:

WEBSITE:
${cap(assessments.website.content)}
${cap(assessments.website.seoAssessment, 600) ? `SEO: ${cap(assessments.website.seoAssessment, 600)}` : ''}
${assessments.website.techAudit ? `Technical: Performance ${assessments.website.techAudit.scores.performance}/100, Accessibility ${assessments.website.techAudit.scores.accessibility}/100, SEO ${assessments.website.techAudit.scores.seo}/100, Best Practices ${assessments.website.techAudit.scores.bestPractices}/100` : ''}
${[field('Pages', assessments.website.pagesReviewed), field('Credentials', cap(assessments.website.credentialsContent, 300)), field('Notes', assessments.website.observations)].filter(Boolean).join('\n')}
${(() => {
  const props = project.additionalProperties?.filter(p => p.url) || [];
  const pd = assessments.website.propertyData || {};
  if (props.length === 0) return '';
  const allProps = [
    { url: project.websiteUrl, type: 'primary', label: 'Primary' },
    ...props,
  ];
  const table = allProps.map(p => {
    const d = pd[p.url] || {};
    return `  ${p.label || p.type} (${p.url}): Perf ${d.performance ?? 'n/a'}, SEO ${d.seo ?? 'n/a'}, Access. ${d.accessibility ?? 'n/a'}`;
  }).join('\n');
  const risk = pd.consistencyAnalysis?.match(/OVERALL RISK RATING:\s*(Low|Medium|High)/i)?.[1] || 'Not assessed';
  return `\nDIGITAL ESTATE (${props.length + 1} properties — consistency risk: ${risk}):\n${table}\n${pd.consistencyAnalysis ? `Consistency analysis:\n${cap(pd.consistencyAnalysis, 800)}` : 'No consistency analysis run.'}`;
})()}

SOCIAL MEDIA:
${cap(assessments.social.content)}
${[field('Glassdoor', cap([assessments.social.glassdoorAuto, assessments.social.glassdoorContent].filter(Boolean).join('\n'), 400)), field('Employee Advocacy', cap(assessments.social.employeeAdvocacy, 300)), field('Campaign & Paid Signals', cap([assessments.social.campaignAuto, assessments.social.campaignContent, assessments.social.paidMediaContent, assessments.social.hashtagContent].filter(Boolean).join('\n'), 600)), field('Awards', cap(assessments.social.awardsRecognition, 300)), field('WIPO', assessments.social.wipoContent), field('Notes', assessments.social.observations)].filter(Boolean).join('\n')}
YouTube: ${assessments.social.youtubeContent?.includes('[API Data]') ? 'Verified metrics included' : 'Manual only'}

AI REPUTATION:
${(() => {
  const ai = assessments.aiReputation;
  const engines = [
    ['Claude', ai?.claudeManual],
    ['Gemini', ai?.geminiManual],
    ['ChatGPT', ai?.chatgptManual],
    ['Perplexity', ai?.perplexityManual],
    ['Copilot', ai?.copilotManual],
  ].filter(([, v]) => v);
  const parts = [];
  if (ai?.reputationFlags) parts.push(`FLAGS (known reputation risks — must be weighted against REFLECTIVE, INTENTIONAL, and AWAKE scores): ${cap(ai.reputationFlags, 400)}`);
  if (engines.length) parts.push(engines.map(([name, val]) => `[${name}] ${cap(val, 500)}`).join('\n\n'));
  if (ai?.wikipediaContent) parts.push(`Wikipedia: ${cap(ai.wikipediaContent, 400)}`);
  if (ai?.redditAnswersContent) parts.push(`Reddit: ${cap(ai.redditAnswersContent, 400)}`);
  if (ai?.googleNewsContent) parts.push(`Google News (third-party): ${cap(ai.googleNewsContent, 400)}`);
  if (ai?.trustpilotContent) parts.push(`Trustpilot (third-party): ${cap(ai.trustpilotContent, 400)}`);
  if (ai?.searchSnapshotContent) parts.push(`Search Snapshot (top results): ${cap(ai.searchSnapshotContent, 400)}`);
  if (ai?.content) parts.push(`Synthesis: ${cap(ai.content, 600)}`);
  if (ai?.observations) parts.push(`Notes: ${ai.observations}`);
  return parts.length ? parts.join('\n\n') : 'Not completed';
})()}

EARNED MEDIA:
${cap(assessments.earnedMedia.content)}
${field('Notes', assessments.earnedMedia.observations) || ''}

SCORING RUBRIC v2.8 — Score each attribute 0-100:

${ATTRIBUTES.map(a => `${a.id} (${a.fullName})
Q: ${a.question}
Strong (70-100): ${a.signals.strong.join('; ')}
Moderate (40-69): ${a.signals.moderate.join('; ')}
Weak (0-39): ${a.signals.weak.join('; ')}`).join('\n\n')}

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

SCORING NOTES:
- ATTENTIVE: 70% qualitative + 30% technical metrics (if available). COGENT: 80% qualitative + 20% technical SEO.
- Glassdoor impacts REFLECTIVE. WIPO impacts INTENTIONAL. Wikipedia absence/thin = gap in COGENT+INTENTIONAL.
- Reddit perception: REFLECTIVE + COGENT. Reputation flags: must be reflected in REFLECTIVE + INTENTIONAL scores.
- AI engine convergence = strong discoverability (COGENT+INTENTIONAL). Vagueness/divergence = penalise both.
- DIGITAL ESTATE: If a Digital Estate section is present, cross-property inconsistency MUST impact scoring. High risk rating: penalise REFLECTIVE (brand authenticity) and ATTENTIVE (experience consistency). Medium risk: note in findings, minor penalty. Translated sites with poor localisation quality: penalise AWARE. Tech stack fragmentation: penalise COGENT. Strong estate consistency is positive evidence for REFLECTIVE and INTENTIONAL.
- Business model: ${project.businessModel.toUpperCase()}. ${project.businessModel === 'b2b' ? 'LinkedIn 3x. Trade press over mainstream. Long-form over short-form. Low TikTok weight.' : project.businessModel === 'b2c' ? 'All consumer social weighted. TikTok relevant if <40 audience. Consumer reviews critical. Mainstream media over trade press.' : 'Weight LinkedIn for B2B, consumer channels for B2C. Both trade and mainstream press matter.'}
- Recency: weight last 3 months more heavily. Evidence tiers: major publications/verified data (strong), industry/social proof (moderate), self-reported/single instance (weak).

CAMPAIGN COHERENCE ASSESSMENT (v2.9):

Look across ALL the evidence above together, website, social, paid media, hashtags, and earned media, and determine whether this brand's marketing is held together by a strategy and a creative idea, or whether it is isolated tactical activity.

CRITICAL DIVISION OF LABOUR. Read this carefully, it prevents double counting:
- The eight attribute scores above judge HOW GOOD THE WORK IS. Score SENTIENT on creative quality, craft, distinctiveness and how well execution holds together across channels. Score COGENT on strategic intelligence, targeting and measurement. Judge the work on its merits exactly as you normally would.
- The campaign coherence level below judges ONLY WHETHER AN IDEA IS HOLDING THE WORK TOGETHER. It is about the presence, coherence and reach of a campaign idea. It says NOTHING about craft quality. A beautifully crafted set of unconnected posts is high SENTIENT and low campaign coherence. A crude but genuinely threaded campaign is the reverse.

${CAMPAIGN_EVIDENCE_RULE}

THE LADDER, assign exactly one level from 0 to 5:

${CAMPAIGN_LADDER.map(l => `LEVEL ${l.level} — ${l.name}: ${l.summary}
${l.description}
Signals: ${l.signals.join('; ')}`).join('\n\n')}

RULES:
- If no campaign activity is observable at all, that is LEVEL 0, not null.
- Judge the highest level the brand's STRONGEST campaign genuinely reaches. Do not average across campaigns.
- Name the specific campaigns you identified. If you cannot name one, say so plainly and score accordingly.
- Level 5 requires publicly observable evidence of influence. Do not infer impact from the brand's own marketing claims.
- Be sceptical. A hashtag is not a campaign. A content series is not a campaign. Most brands sit at 1 or 2.

BRAND FOOTPRINT:

Map where ${project.brandName} actually shows up across every surface a person could encounter it. This is DESCRIPTIVE ONLY. It does not change any attribute score. Do not adjust your scoring because of it.

For each of these eight channels, report what you can actually observe in the evidence above:

${FOOTPRINT_CHANNELS.map(c => `- ${c.id}: ${c.name}. ${c.hint}`).join('\n')}

RULES, and the first one matters most:
- COUNT ONLY WHAT YOU CAN SEE. "signals" is the number of distinct pieces of evidence you actually observed for that channel: named articles, named accounts, named threads, specific citations. If you observed three articles, that is 3, not an estimate of total coverage.
- NEVER estimate audience reach, impressions or total mention volume. Those are not publicly observable and a fabricated number would discredit the whole report. There is no reach field for this reason.
- A channel with no observable evidence gets share 0, signals 0 and evidence "No evidence found". Do not invent presence to fill the table. An empty channel is a finding.
- "share" is that channel's percentage of the brand's total observed footprint. Shares across all channels must sum to 100. Channels with no evidence get 0.
- "sentiment" runs -100 to 100 and is only for channels where others are speaking about the brand. Use null for owned and paid, where the brand controls the message.
- "evidence" is a short factual descriptor of what was found, max 6 words. For example "National trade, 3 tier-one titles" or "LinkedIn-led, founder account".

SERVICE AREAS TO REFERENCE IN RECOMMENDATIONS:
- AWAKE: Executive Visibility, PR & Media Relations, Thought Leadership Content
- AWARE: Audience Research, Social Media Strategy, Community Management, Influencer & Creator Strategy, GEO
- REFLECTIVE: Brand Strategy, Brand Expression, Crisis Communications, Brand Training
- ATTENTIVE: Website Strategy & Development, Creative Production, Brand Guidelines
- COGENT: SEO Strategy, Measurement & Analytics, Paid Media Strategy, GEO, Marketing Strategy
- SENTIENT: Creative Campaigns, Brand Expression, Content Strategy, Events
- VISIONARY: Brand Strategy, Impact Communications, Executive Visibility
- INTENTIONAL: Brand Strategy, Brand Assets & Guidelines, Website Development, Communications Training

Return valid JSON only — no prose before or after. For every attribute, "findings" is what you observed, "impact" is what is directly pushing the score up or down right now (name the specific strengths helping and the specific weaknesses hurting), and "actions" is the concrete, brand-specific move that would raise the score. Make impact and actions specific to THIS brand and its evidence, never generic. Schema:
{
  "headline": "Single pithy sentence (max 20 words) capturing brand state and primary opportunity. Specific, not generic.",
  "conclusion": "2-3 sentences naming the specific transformation available. Reference actual findings. No generic phrases.",
  "justification": "Under 150 words. Why the overall score is what it is. Call out notably high/low scores with evidence.",
  "footprint": {
    "verdict": "One sentence on where this brand shows up and where it does not. Direct. Max 20 words.",
    "channels": {
${FOOTPRINT_CHANNELS.map(c => `      "${c.id}": { "share": 0-100, "signals": 0, "evidence": "max 6 words, or 'No evidence found'", "sentiment": -100 to 100 or null }`).join(',\n')}
    }
  },
  "campaignCoherence": {
    "level": 0-5,
    "levelName": "Ad hoc|Themed|Packaged|Integrated|Platform|Consequential",
    "confidence": "low|medium|high",
    "verdict": "One sentence. Is this brand's marketing strategy-led or activity-led? Direct, no hedging.",
    "campaigns": [
      { "name": "Campaign name, or a plain description if unnamed", "channels": ["where it appears"], "idea": "The strategic premise and creative idea in one line, or state that none is evident.", "evidence": "What you actually observed. Under 40 words." }
    ],
    "rationale": "Why this level and not the one above or below. Reference the ladder signals. Under 70 words.",
    "toNextLevel": "The specific move that would take this brand to the next level of the ladder. Brand-specific, under 40 words."
  },
  "AWAKE":      { "score": 0-100, "confidence": "low|medium|high", "findings": "What was observed, cited evidence, under 80 words.", "impact": "What is pushing this score up or down, good and bad, specific to this brand. Under 50 words.", "gaps": ["max 3 items"], "actions": "The 1-2 concrete moves that would raise this score for this brand. Specific, not generic. Under 40 words.", "opportunity": "Relevant service area recommendation." },
  "AWARE":      { "score": 0-100, "confidence": "low|medium|high", "findings": "...", "impact": "...", "gaps": ["..."], "actions": "...", "opportunity": "..." },
  "REFLECTIVE": { "score": 0-100, "confidence": "low|medium|high", "findings": "...", "impact": "...", "gaps": ["..."], "actions": "...", "opportunity": "..." },
  "ATTENTIVE":  { "score": 0-100, "confidence": "low|medium|high", "findings": "...", "impact": "...", "gaps": ["..."], "actions": "...", "opportunity": "..." },
  "COGENT":     { "score": 0-100, "confidence": "low|medium|high", "findings": "...", "impact": "...", "gaps": ["..."], "actions": "...", "opportunity": "..." },
  "SENTIENT":   { "score": 0-100, "confidence": "low|medium|high", "findings": "...", "impact": "...", "gaps": ["..."], "actions": "...", "opportunity": "..." },
  "VISIONARY":  { "score": 0-100, "confidence": "low|medium|high", "findings": "...", "impact": "...", "gaps": ["..."], "actions": "...", "opportunity": "..." },
  "INTENTIONAL":{ "score": 0-100, "confidence": "low|medium|high", "findings": "...", "impact": "...", "gaps": ["..."], "actions": "...", "opportunity": "..." }
}`;

      const result = await callClaude(prompt, apiKey, null, [], 0, true, 12000);
      clearInterval(progressInterval);
      setScoringProgress(100);
      setScoringStage('Complete!');
      const match = result.match(/\{[\s\S]*\}/);
      if (match) {
        try {
          const parsed = JSON.parse(match[0]);
          const hasAtLeastOneScore = ATTRIBUTES.some(attr => 
            parsed[attr.id] && typeof parsed[attr.id].score === 'number'
          );
          if (hasAtLeastOneScore) {
            // The model scores the eight attributes on their own merits and
            // reports campaign coherence separately. The modifier is applied
            // here, in code, so the adjustment is deterministic, auditable and
            // identical for identical inputs. Never let the model do the maths.
            if (!parsed.campaignCoherence) {
              console.warn('Scoring pass returned no campaignCoherence object. Attribute scores stand unadjusted.');
            }
            const level = parsed.campaignCoherence?.level;
            const adjusted = applyCampaignModifiers(parsed, level);
            adjusted.campaignCoherence = {
              ...(parsed.campaignCoherence || {}),
              level: Number.isFinite(Number(level)) ? Math.max(0, Math.min(5, Math.round(Number(level)))) : null,
              appliedAt: new Date().toISOString(),
              frameworkVersion: FRAMEWORK_VERSION,
            };
            setScores(adjusted);
          } else {
            setScoringError('AI response was missing score data. Please try again.');
            console.error('Parsed but missing scores:', parsed);
          }
        } catch (parseErr) {
          setScoringError(`Failed to parse AI response: ${parseErr.message}. Please try again.`);
          console.error('JSON parse error:', parseErr.message);
          console.error('Raw match (first 800 chars):', match[0].substring(0, 800));
          console.error('Raw match (last 200 chars):', match[0].slice(-200));
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
      <div className="dc-wrap dc-page pt-8 animate-fade-in">
        <div className="flex items-start gap-4 mb-8">
          <div className="w-14 h-14 bg-[#DEE42F]/10 flex items-center justify-center flex-shrink-0">
            <BarChart3 className="w-7 h-7 text-[#B23A3A]" />
          </div>
          <div>
            <h2 className="dc-h2 text-[#0B0B0B]">Generate Brand Report</h2>
            <p className="text-[#4A4840] text-sm md:text-base">Ready to analyze {project.brandName} across all eight consciousness attributes.</p>
          </div>
        </div>

        <div className="card p-6 md:p-8 text-center mb-6">
          {isScoring ? (
            <div className="max-w-lg mx-auto">
              <Loader2 className="w-16 h-16 text-[#B23A3A] mx-auto mb-6 animate-spin" />
              <h3 className="text-xl font-semibold text-[#0B0B0B] mb-2">Generating Report...</h3>
              <p className="text-[#8A877D] mb-6">{scoringStage}</p>
              
              {/* Progress bar */}
              <div className="w-full bg-[#F2F0EA] h-3 mb-2">
                <div 
                  className="bg-[#DEE42F] h-3 transition-all duration-500 ease-out"
                  style={{ width: `${scoringProgress}%` }}
                />
              </div>
              <p className="text-sm text-[#8A877D] mb-8">{scoringProgress}% complete</p>
              
              {/* Progress steps - centered */}
              <div className="space-y-3">
                {/* Data Collection */}
                <div className="flex items-center justify-center gap-6 text-sm">
                  <div className={`flex items-center gap-2 ${scoringProgress >= 25 ? 'text-[#B23A3A]' : 'text-[#B3B0A8]'}`}>
                    {scoringProgress >= 25 ? <Check className="w-4 h-4" /> : <div className="w-4 h-4 border-2 border-current" />}
                    <span>Website</span>
                  </div>
                  <div className={`flex items-center gap-2 ${scoringProgress >= 40 ? 'text-[#B23A3A]' : 'text-[#B3B0A8]'}`}>
                    {scoringProgress >= 40 ? <Check className="w-4 h-4" /> : <div className="w-4 h-4 border-2 border-current" />}
                    <span>Social</span>
                  </div>
                  <div className={`flex items-center gap-2 ${scoringProgress >= 55 ? 'text-[#B23A3A]' : 'text-[#B3B0A8]'}`}>
                    {scoringProgress >= 55 ? <Check className="w-4 h-4" /> : <div className="w-4 h-4 border-2 border-current" />}
                    <span>AI Rep</span>
                  </div>
                  <div className={`flex items-center gap-2 ${scoringProgress >= 70 ? 'text-[#B23A3A]' : 'text-[#B3B0A8]'}`}>
                    {scoringProgress >= 70 ? <Check className="w-4 h-4" /> : <div className="w-4 h-4 border-2 border-current" />}
                    <span>Earned</span>
                  </div>
                </div>
                
                {/* Processing */}
                <div className="flex items-center justify-center gap-6 text-sm">
                  <div className={`flex items-center gap-2 ${scoringProgress >= 85 ? 'text-[#B23A3A]' : 'text-[#B3B0A8]'}`}>
                    {scoringProgress >= 85 ? <Check className="w-4 h-4" /> : <div className="w-4 h-4 border-2 border-current" />}
                    <span>Scoring</span>
                  </div>
                  <div className={`flex items-center gap-2 ${scoringProgress >= 95 ? 'text-[#B23A3A]' : 'text-[#B3B0A8]'}`}>
                    {scoringProgress >= 95 ? <Check className="w-4 h-4" /> : <div className="w-4 h-4 border-2 border-current" />}
                    <span>Recommendations</span>
                  </div>
                </div>
              </div>

              {waitingStories.length > 0 && (
                <div className="mt-8 pt-6 border-t border-[#DCDAD3]">
                  <p className="text-xs font-semibold text-[#B3B0A8] uppercase tracking-wider text-center">While you're waiting</p>
                  <p className="text-xs text-[#8A877D] mb-4 text-center">The latest from Stay Conscious</p>
                  <div className="space-y-3">
                    {waitingStories.map((s, i) => (
                      <div key={i} className="card p-3 text-left">
                        {s.category && (
                          <span className="inline-block text-[10px] font-semibold uppercase tracking-wider text-[#B23A3A] mb-1">{s.category}</span>
                        )}
                        <div className="font-semibold text-sm text-[#0B0B0B] leading-snug">{s.headline}</div>
                        {s.summary && <div className="text-xs text-[#8A877D] mt-1 leading-relaxed">{s.summary}</div>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <>
              <Compass className="w-16 h-16 text-[#B23A3A] mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-[#0B0B0B] mb-2">Assessment Complete</h3>
              <p className="text-[#8A877D] mb-6">All four assessment areas have been evaluated. Generate scores to create your comprehensive brand consciousness report.</p>
              
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
            <div className="mt-4 bg-red-50 border border-red-200 p-4 text-red-700 text-sm">
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
          <h3 className="dc-kicker text-[#0B0B0B] mb-2">Report Generation Issue</h3>
          <p className="text-[#8A877D] mb-4">The scoring data appears to be incomplete or invalid. Please try generating the report again.</p>
          <button onClick={() => setScores(null)} className="btn-primary">
            Try Again
          </button>
          <details className="mt-4 text-left text-xs text-[#B3B0A8]">
            <summary className="cursor-pointer">Debug Info</summary>
            <pre className="mt-2 p-2 bg-[#E4E2DC] overflow-auto max-h-40">
              {JSON.stringify(scores, null, 2)}
            </pre>
          </details>
        </div>
      </div>
    );
  }
  
  const stage = getMaturityStage(overall);
  const industryName = INDUSTRIES.find(i => i.id === project.industry)?.name || 'Other';

  // ── Campaign coherence ──────────────────────────────────────
  const campaign = scores?.campaignCoherence || null;
  const campaignLevel = campaign && Number.isFinite(Number(campaign.level)) ? Number(campaign.level) : null;
  const campaignStage = campaignLevel !== null ? getCampaignLevel(campaignLevel) : null;
  const campaignAdjustment = (attrId) => scores[attrId]?.campaignModifierApplied ?? scores[attrId]?.campaignModifier ?? 0;
  const campaignAffected = campaignLevel !== null
    ? ATTRIBUTES.filter(a => campaignAdjustment(a.id) !== 0)
    : [];

  // ── Benchmark ───────────────────────────────────────────────
  // A saved or shared report carries its own frozen snapshot. A live report
  // builds one now, which is then frozen when the assessment is saved.
  // A stored snapshot is discarded if the brand has since been rescored, so a
  // report never shows a comparison drawn against a score it no longer holds.
  // Computed directly rather than memoised: this sits after early returns,
  // so a hook here would break hook ordering.
  const snapshotStillValid = savedBenchmark && !savedBenchmark.unavailable && savedBenchmark.brandTotal === overall;
  const benchmarkResult = snapshotStillValid ? savedBenchmark : buildBenchmarkSnapshot(compassResults, {
    industry: project.industry,
    industryName,
    brandName: project.brandName,
    totalScore: overall,
    scores,
  });

  // A usable benchmark, or null when the engine could only report why not.
  const benchmark = benchmarkResult && !benchmarkResult.unavailable ? benchmarkResult : null;
  const benchmarkUnavailableReason = benchmarkResult?.unavailable ? benchmarkResult.reason : null;

  // Shaped for ComparisonSpiderChart, which expects a scores-like object.
  const benchmarkAvgScores = benchmark
    ? ATTRIBUTES.reduce((acc, attr) => { acc[attr.id] = benchmark.attrAvgs?.[attr.id] || 0; return acc; }, {})
    : null;

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
  if (assessments.social?.linkedinAuto || assessments.social?.linkedinAbout) evaluatedInputs.push('LinkedIn company profile and positioning');
  if (assessments.social?.linkedinPosts) evaluatedInputs.push('LinkedIn posts and engagement metrics');
  if (assessments.social?.xAuto || assessments.social?.xContent) evaluatedInputs.push('X (Twitter) content and voice');
  if (assessments.social?.instagramAuto || assessments.social?.instagramContent) evaluatedInputs.push('Instagram presence and visual brand');
  if (assessments.social?.youtubeAuto || assessments.social?.youtubeContent) evaluatedInputs.push('YouTube channel and video content');
  if (assessments.social?.otherPlatformsAuto) evaluatedInputs.push('Facebook, TikTok, Bluesky and Substack presence');
  if (assessments.social?.campaignAuto || assessments.social?.campaignContent || assessments.social?.paidMediaContent) evaluatedInputs.push('campaign activity, paid media and hashtag signals across platforms');
  if (assessments.social?.thirdPartyAuto) evaluatedInputs.push('third-party social conversation and sentiment');
  if (assessments.social?.socialImages?.length > 0) evaluatedInputs.push(`${assessments.social.socialImages.length} social media screenshot(s)`);
  
  // AI Reputation inputs
  if (assessments.aiReputation?.reputationFlags) evaluatedInputs.push('Reputation trigger search (news, controversy, reviews)');
  if (assessments.aiReputation?.claudeManual) evaluatedInputs.push('Claude AI brand perception');
  if (assessments.aiReputation?.geminiManual) evaluatedInputs.push('Gemini AI brand perception');
  if (assessments.aiReputation?.chatgptManual) evaluatedInputs.push('ChatGPT brand perception');
  if (assessments.aiReputation?.perplexityManual) evaluatedInputs.push('Perplexity AI brand perception');
  if (assessments.aiReputation?.copilotManual) evaluatedInputs.push('Microsoft Copilot brand perception');
  if (assessments.aiReputation?.wikipediaContent) evaluatedInputs.push('Wikipedia presence and AI training signal');
  if (assessments.aiReputation?.redditAnswersContent) evaluatedInputs.push('Reddit Answers AI search visibility');
  
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

${campaignStage ? `${subDivider}
CAMPAIGN COHERENCE
${subDivider}
${campaignStage.level === 0 ? 'No tier reached' : `Level ${campaignStage.level} of 5`}: ${campaignStage.name}
${campaignStage.summary}
${campaign.verdict ? `\nVerdict: ${campaign.verdict}` : ''}
${campaign.rationale ? `Why this level: ${campaign.rationale}` : ''}
${campaign.toNextLevel ? `To reach level ${Math.min(5, campaignStage.level + 1)}: ${campaign.toNextLevel}` : ''}
${Array.isArray(campaign.campaigns) && campaign.campaigns.length ? `\nCampaigns identified:\n${campaign.campaigns.map(c => `  • ${c.name}${c.channels?.length ? ` (${c.channels.join(', ')})` : ''}${c.idea ? `\n    Idea: ${c.idea}` : ''}${c.evidence ? `\n    Evidence: ${c.evidence}` : ''}`).join('\n')}` : ''}
${campaignAffected.length ? `\nScore adjustment applied:\n${campaignAffected.map(a => `  • ${a.name}: ${scores[a.id]?.baseScore} ${campaignAdjustment(a.id) > 0 ? '+' : ''}${campaignAdjustment(a.id)} = ${scores[a.id]?.score}`).join('\n')}\n(Attribute scores judge quality of work. Campaign coherence is scored separately and applied here.)` : ''}

` : ''}${benchmark ? `${subDivider}
BENCHMARK COMPARISON
${subDivider}
Benchmarked against: ${benchmark.cohortLabel} (n=${benchmark.count}${benchmark.rubricVersions?.length ? `, framework v${benchmark.rubricVersions.join(', v')}` : ''})
${benchmark.fallbackReason ? `Note: ${benchmark.fallbackReason}\n` : ''}
Overall: ${overall} vs ${benchmark.scope === 'industry' ? 'sector' : 'all brands'} average ${benchmark.avgScore} (${overall - benchmark.avgScore > 0 ? '+' : ''}${overall - benchmark.avgScore})
${benchmark.rank ? `Rank: ${ordinal(benchmark.rank)} of ${benchmark.count}` : ''}
Percentile: ${benchmark.percentile != null ? ordinal(benchmark.percentile) : 'n/a'}
All assessed brands average: ${benchmark.allBrandsAvg}

Attribute vs ${benchmark.scope === 'industry' ? 'sector' : 'all brands'} average:
${ATTRIBUTES.map(a => {
  const b = benchmark.attrAvgs?.[a.id] ?? 0;
  const s = scores[a.id]?.score || 0;
  const d = s - b;
  return `  ${a.name.padEnd(13)} ${String(s).padStart(3)}  vs ${String(b).padStart(3)}  (${d > 0 ? '+' : ''}${d})`;
}).join('\n')}

` : ''}${subDivider}
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
      // Inject property consistency data if present
      const additionalProps = project.additionalProperties?.filter(p => p.url) || [];
      const pd = assessments.website?.propertyData || {};
      if (additionalProps.length > 0 && (Object.keys(pd).length > 0 || pd.consistencyAnalysis)) {
        const allProps = [{ url: project.websiteUrl, type: 'primary', label: 'Primary' }, ...additionalProps];
        const propTable = allProps.map(p => {
          const d = pd[p.url] || {};
          return `  ${p.label || p.type} (${p.url}): Perf ${d.performance ?? 'n/a'} | SEO ${d.seo ?? 'n/a'} | Access. ${d.accessibility ?? 'n/a'}`;
        }).join('\n');
        const riskMatch = pd.consistencyAnalysis?.match(/OVERALL RISK RATING:\s*(Low|Medium|High)/i);
        reportText += `
[Digital Estate Consistency — ${additionalProps.length + 1} Properties]
${propTable}
${riskMatch ? `Consistency Risk: ${riskMatch[1]}` : ''}
${pd.consistencyAnalysis ? `\nConsistency Analysis:\n${pd.consistencyAnalysis}` : ''}

SCORING GUIDANCE FOR ATTRIBUTE SCORES:
- REFLECTIVE: Cross-property visual, tone, or message inconsistency is direct evidence of brand inauthenticity. Weight this finding in the REFLECTIVE score. Translated sites with poor brand voice preservation should reduce this score further.
- ATTENTIVE: Performance variance across properties signals inconsistent experience delivery. Use the weakest property score when assessing ATTENTIVE, not just the primary site.
- COGENT: Fragmented tech stacks or missing SEO localisation on translated/regional properties indicates weak strategic intelligence.
- AWARE: Regional/translated properties with no local adaptation (just translated content) suggest the brand does not truly understand its non-primary audiences.
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
    if (assessments.aiReputation?.content) {
      reportText += `
${subDivider}
AI REPUTATION ASSESSMENT
${subDivider}

${assessments.aiReputation.content}
`;
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
${websiteEvalDescription} Social media presence was analyzed across LinkedIn, X, Instagram, and YouTube for brand consistency and engagement. AI reputation was assessed across up to five AI engines (Claude, Gemini, ChatGPT, Perplexity, Microsoft Copilot), supplemented by Wikipedia presence, Reddit community perception, and third-party news, review, and search signals, to understand how AI systems perceive and represent the brand. Earned media coverage from the past 3 months was reviewed for sentiment, message penetration, and share of voice.

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

  // Copy proposal-ready text (structured for use in proposals)
  // Retained but no longer surfaced. The "Text For Proposal" button was removed
  // from the report header; re-add the button to bring this back.
  // eslint-disable-next-line no-unused-vars
  const copyProposalText = () => {
    const div = '─'.repeat(50);

    // Top line
    let text = `${project.brandName} — Conscious Compass Assessment\n`;
    text += `Overall Score: ${overall}/100 — ${stage.name}\n`;
    if (scores.headline) text += `"${scores.headline}"\n`;
    text += `${project.brandName} demonstrates strength in ${sortedAttrs.slice(-2).map(a => a.name).join(' and ')}, with opportunities to grow in ${sortedAttrs.slice(0, 2).map(a => a.name).join(' and ')}.\n`;

    // Attribute scores
    text += `\n${div}\nATTRIBUTE SCORES\n${div}\n`;
    ATTRIBUTES.forEach(attr => {
      text += `${attr.name}: ${scores[attr.id]?.score || 0}/100\n`;
    });

    // Brand Consciousness Maturity
    text += `\n${div}\nBRAND CONSCIOUSNESS MATURITY\n${div}\n`;
    text += `Stage: ${stage.name}\n${stage.description}\n`;
    const nextStage = MATURITY_STAGES.find(s => s.min > overall);
    if (nextStage) text += `${nextStage.min - overall} points to next level (${nextStage.name})\n`;

    // Attribute analysis
    text += `\n${div}\nATTRIBUTE ANALYSIS\n${div}\n`;
    ATTRIBUTES.forEach(attr => {
      const s = scores[attr.id];
      if (!s) return;
      text += `\n${attr.name} (${attr.fullName}) — ${s.score}/100\n`;
      if (s.findings || s.summary) text += `${s.findings || s.summary}\n`;
      if (s.impact) text += `What's driving it: ${s.impact}\n`;
      if (s.actions) text += `To improve the score: ${s.actions}\n`;
      if (s.opportunity) text += `Opportunity: ${s.opportunity}\n`;
    });

    // 12 Recommendations
    text += `\n${div}\n12 RECOMMENDATIONS\n${div}\n`;
    recommendations.slice(0, 12).forEach((rec, i) => {
      text += `\n${i + 1}. ${rec.title}\n${rec.description}\nBenefit: ${rec.impact}\n`;
    });

    // AG Services
    const forceInclude = getForceIncludeServicesFromAIReputation(assessments?.aiReputation?.content, assessments);
    const serviceRecs = getAllRecommendations(scores, { forceIncludeServices: forceInclude });
    const topServices = serviceRecs.slice(0, 6);
    if (topServices.length > 0) {
      text += `\n${div}\nRECOMMENDED ANTENNA GROUP SERVICES\n${div}\n`;
      topServices.forEach((rec, i) => {
        const attr = ATTRIBUTES.find(a => a.id === rec.attributeId);
        text += `\n${i + 1}. ${rec.service.name} (${rec.service.category})\n`;
        text += `${rec.rationale}\n`;
        text += `Improves: ${attr?.name} (currently ${rec.attributeScore}) · ${formatBudget(rec.service)}\n`;
      });
    }

    // Conclusions
    text += `\n${div}\nCONCLUSIONS\n${div}\n`;
    text += `${scores.conclusion || `${project.brandName} has demonstrated ${overall >= 60 ? 'strong potential' : 'a foundation'} for building an impactful, conscious brand presence. By focusing on the recommendations outlined above, particularly strengthening ${sortedAttrs[0].name} and ${sortedAttrs[1].name} capabilities, the brand can elevate its market position and create deeper connections with its audience.`}\n`;

    // Score Justification
    if (scores.justification) {
      text += `\n${div}\nSCORE JUSTIFICATION\n${div}\n`;
      text += `${scores.justification}\n`;
    }

    text += `\n${div}\nConscious Compass · Antenna Group · Framework v${FRAMEWORK_VERSION}\n`;

    navigator.clipboard.writeText(text.trim()).then(() => {
      alert('Proposal text copied to clipboard!');
    }).catch(() => {
      const textArea = document.createElement('textarea');
      textArea.value = text.trim();
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      alert('Proposal text copied to clipboard!');
    });
  };

  const buildClientPayload = () => makeClientPayload({ project, scores, benchmark });

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

      // ========== CAMPAIGN COHERENCE ==========
      if (campaignStage) {
        addSection('CAMPAIGN COHERENCE');
        pdf.setFontSize(12);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(0, 0, 0);
        checkPage();
        pdf.text(`${campaignStage.level === 0 ? 'No tier reached' : `Level ${campaignStage.level} of 5`}: ${campaignStage.name}`, margin, y);
        y += 7;
        addParagraph(campaignStage.summary);
        if (campaign.verdict) addParagraph(campaign.verdict);
        addParagraph(campaignStage.description);
        if (campaign.rationale) addParagraph(`Why this level: ${campaign.rationale}`);
        if (campaign.toNextLevel) addParagraph(`To reach level ${Math.min(5, campaignStage.level + 1)}: ${campaign.toNextLevel}`);

        if (Array.isArray(campaign.campaigns) && campaign.campaigns.length) {
          campaign.campaigns.forEach(c => {
            checkPage();
            pdf.setFontSize(10);
            pdf.setFont('helvetica', 'bold');
            pdf.setTextColor(0, 0, 0);
            pdf.text(`${c.name}${c.channels?.length ? ` (${c.channels.join(', ')})` : ''}`, margin, y);
            y += 5;
            if (c.idea) addParagraph(`Idea: ${c.idea}`, 9);
            if (c.evidence) addParagraph(c.evidence, 9);
          });
        }

        if (campaignAffected.length) {
          checkPage();
          pdf.setFontSize(9);
          pdf.setFont('helvetica', 'italic');
          pdf.setTextColor(100, 100, 100);
          pdf.text('Score adjustment (attribute scores judge quality of work; campaign coherence applied separately):', margin, y);
          y += 5;
          pdf.setFont('helvetica', 'normal');
          campaignAffected.forEach(a => {
            checkPage();
            const adj = campaignAdjustment(a.id);
            pdf.text(`${a.name}: ${scores[a.id]?.baseScore} ${adj > 0 ? '+' : ''}${adj} = ${scores[a.id]?.score}`, margin + 4, y);
            y += 4.5;
          });
          y += 3;
        }
      }

      // ========== BENCHMARK COMPARISON ==========
      if (benchmark) {
        addSection('BENCHMARK COMPARISON');
        addParagraph(`Benchmarked against: ${benchmark.cohortLabel} (n=${benchmark.count}${benchmark.rubricVersions?.length ? `, framework v${benchmark.rubricVersions.join(', v')}` : ''}).${benchmark.fallbackReason ? ` ${benchmark.fallbackReason}` : ''}`, 9);
        addParagraph(`${project.brandName} scores ${overall} against a ${benchmark.scope === 'industry' ? 'sector' : 'cross-industry'} average of ${benchmark.avgScore}, a difference of ${overall - benchmark.avgScore > 0 ? '+' : ''}${overall - benchmark.avgScore} points, ${benchmark.rank ? `ranking it ${ordinal(benchmark.rank)} of ${benchmark.count}` : ''}${benchmark.percentile != null ? ` in the ${ordinal(benchmark.percentile)} percentile` : ''}. The average across all assessed brands is ${benchmark.allBrandsAvg}.`);

        // Benchmark charts, captured from the live DOM the same way the radar is
        for (const [ref, gap] of [[benchmarkPositionRef, 6], [benchmarkSpreadRef, 6]]) {
          if (!ref.current) continue;
          try {
            const canvas = await html2canvas(ref.current, { scale: 2, backgroundColor: '#ffffff', logging: false });
            const imgW = contentWidth;
            const imgH = (canvas.height * imgW) / canvas.width;
            if (y + imgH > pageHeight - 20) { pdf.addPage(); y = margin; }
            pdf.addImage(canvas.toDataURL('image/png'), 'PNG', margin, y, imgW, imgH);
            y += imgH + gap;
          } catch (err) {
            console.warn('Could not capture benchmark chart:', err);
          }
        }

        // Text table as a durable fallback, and because numbers beat pictures
        checkPage();
        pdf.setFontSize(9);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(0, 0, 0);
        pdf.text('Attribute', margin, y);
        pdf.text(project.brandName.slice(0, 18), margin + 70, y);
        pdf.text(benchmark.scope === 'industry' ? 'Sector' : 'All', margin + 110, y);
        pdf.text('Diff', margin + 140, y);
        y += 5;
        pdf.setFont('helvetica', 'normal');
        ATTRIBUTES.forEach(attr => {
          checkPage();
          const s = scores[attr.id]?.score || 0;
          const b = benchmark.attrAvgs?.[attr.id] ?? 0;
          const d = s - b;
          pdf.setTextColor(0, 0, 0);
          pdf.text(attr.name, margin, y);
          pdf.text(String(s), margin + 70, y);
          pdf.text(String(b), margin + 110, y);
          if (d > 0) pdf.setTextColor(5, 150, 105); else if (d < 0) pdf.setTextColor(220, 38, 38);
          pdf.text(`${d > 0 ? '+' : ''}${d}`, margin + 140, y);
          y += 5;
        });
        pdf.setTextColor(0, 0, 0);
        y += 3;
      }

      // ========== EXECUTIVE SUMMARY ==========
      addSection('EXECUTIVE SUMMARY');
      addParagraph(`${project.brandName} achieved an overall Brand Consciousness Score of ${overall}/100, placing them in the "${stage.name}" maturity stage. The assessment evaluated the brand across 8 key consciousness attributes. Key strengths emerged in ${sortedAttrs.slice(-2).map(a => a.name).join(' and ')}, while opportunities for growth were identified in ${sortedAttrs.slice(0, 2).map(a => a.name).join(' and ')}.`);

      // ========== ATTRIBUTE ANALYSIS ==========
      addSection('ATTRIBUTE ANALYSIS');

      ATTRIBUTES.forEach(attr => {
        const score = scores[attr.id]?.score || 0;
        const findings = scores[attr.id]?.findings || scores[attr.id]?.summary || attr.description;
        const impact = scores[attr.id]?.impact;
        const actions = scores[attr.id]?.actions;
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

        // Impact
        if (impact) {
          y += 2;
          const impLines = pdf.splitTextToSize("What's driving it: " + impact, contentWidth);
          pdf.setFontSize(9);
          pdf.setFont('helvetica', 'normal');
          pdf.setTextColor(50, 50, 50);
          impLines.forEach(line => {
            checkPage();
            pdf.text(line, margin, y);
            y += 4;
          });
        }

        // Actions
        if (actions) {
          y += 2;
          const actLines = pdf.splitTextToSize('To improve the score: ' + actions, contentWidth);
          pdf.setFontSize(9);
          pdf.setFont('helvetica', 'bold');
          pdf.setTextColor(50, 50, 50);
          actLines.forEach(line => {
            checkPage();
            pdf.text(line, margin, y);
            y += 4;
          });
          pdf.setFont('helvetica', 'normal');
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
    setIsGenerating(true);
    try {
      const hexColor = (hex) => hex.replace('#', '');
      const clean = (text) => (text || '').replace(/\u2014/g, '-').replace(/\u2013/g, '-').replace(/—/g, '-').replace(/–/g, '-');

      // ── SVG → PNG base64 via canvas ────────────────────────────
      const svgToPng = (svgStr, w, h) => new Promise((res, rej) => {
        const blob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const img = new window.Image();
        img.onload = () => {
          const c = document.createElement('canvas');
          c.width = w; c.height = h;
          const ctx = c.getContext('2d');
          ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, w, h);
          ctx.drawImage(img, 0, 0, w, h);
          URL.revokeObjectURL(url);
          res(c.toDataURL('image/png').split(',')[1]);
        };
        img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('SVG render failed')); };
        img.src = url;
      });

      // ── Octagon radar SVG (matches live chart) ─────────────────
      const buildOctagonSvg = () => {
        const RING_PATHS = [
          "M226 169.75L186.225 186.225L169.75 226L186.225 265.775L206.113 274.012L226 282.25L265.775 265.775L282.25 226L265.775 186.225L226 169.75Z",
          "M226 113.5L146.451 146.451L113.5 226L146.451 305.549L226 338.5L305.549 305.549L338.5 226L305.549 146.451L226 113.5Z",
          "M226 57.25L106.676 106.676L57.25 226L106.676 345.324L226 394.75L345.324 345.324L394.75 226L345.324 106.676L226 57.25Z",
          "M226 1L66.901 66.901L1 226L66.901 385.099L226 451L385.099 385.099L451 226L385.099 66.901L226 1Z",
        ];
        // Use zero-origin viewBox so canvas renders correctly (no negative offset clipping)
        // Original viewBox is "-100 -50 652 552" — shift all coords by +100,+50
        const shift = (path) => path.replace(/(-?\d+\.?\d*),(-?\d+\.?\d*)/g, (_, x, y) => `${(+x+100).toFixed(2)},${(+y+50).toFixed(2)}`).replace(/(-?\d+\.?\d*) (-?\d+\.?\d*)/g, (_, x, y) => `${(+x+100).toFixed(2)} ${(+y+50).toFixed(2)}`);
        const shiftN = (v, isX) => (+v + (isX ? 100 : 50)).toFixed(2);

        const calcLabel = (i, total, r) => {
          const a = (i * 2 * Math.PI / total) - Math.PI / 2;
          const isCard = i % 2 === 0;
          const ar = isCard ? 235 : r;
          const x = 226 + ar * Math.cos(a), y = 226 + ar * Math.sin(a);
          let ta = 'middle', dy = 0;
          if (!isCard) {
            if (Math.cos(a) < 0) return { x: x + 10 + 100, y: y + 50, ta: 'end', dy: 0 };
            if (Math.cos(a) > 0) return { x: x - 10 + 100, y: y + 50, ta: 'start', dy: 0 };
          }
          if (Math.abs(Math.cos(a)) > 0.85) ta = Math.cos(a) > 0 ? 'start' : 'end';
          if (Math.abs(Math.sin(a)) > 0.85) dy = Math.sin(a) > 0 ? 14 : -7;
          return { x: x + 100, y: y + 50, ta, dy };
        };
        const data = ATTRIBUTES.map(attr => ({ name: attr.name, value: scores?.[attr.id]?.score || 0 }));
        const pts = data.map((item, i) => {
          const a = (i * 2 * Math.PI / data.length) - Math.PI / 2;
          const nv = (item.value / 100) * 225;
          return { x: (226 + nv * Math.cos(a) + 100).toFixed(2), y: (226 + nv * Math.sin(a) + 50).toFixed(2) };
        });
        const ptStr = pts.map(p => `${p.x},${p.y}`).join(' ');
        const rings = [...RING_PATHS].reverse().map((p, i) =>
          `<path d="${shift(p)}" fill="${i % 2 === 0 ? '#e1dfda' : '#f7f6f4'}" stroke="none"/>`).join('');
        const gridPath = RING_PATHS.map(p => shift(p)).join('');
        const grid = `<path d="${gridPath}" stroke="#111720" stroke-width="1.5" fill="none"/>`;
        const axes = data.map((_, i) => {
          const a = (i * 2 * Math.PI / data.length) - Math.PI / 2;
          const x2 = (226 + 225 * Math.cos(a) + 100).toFixed(2);
          const y2 = (226 + 225 * Math.sin(a) + 50).toFixed(2);
          return `<line x1="${(226+100).toFixed(2)}" y1="${(226+50).toFixed(2)}" x2="${x2}" y2="${y2}" stroke="#111720" stroke-opacity="0.1" stroke-width="1.5"/>`;
        }).join('');
        const dots = pts.map(p => `<circle cx="${p.x}" cy="${p.y}" r="4" fill="#CFD32F" stroke="white" stroke-width="1.5"/>`).join('');
        const scoreLabels = pts.map((pt, i) => {
          const a = (i * 2 * Math.PI / data.length) - Math.PI / 2;
          const sx = (+pt.x + 18 * Math.cos(a)).toFixed(2), sy = (+pt.y + 18 * Math.sin(a)).toFixed(2);
          return `<text x="${sx}" y="${sy}" text-anchor="middle" dominant-baseline="middle" font-family="Inter,Arial,sans-serif" font-size="12" font-weight="700" fill="#6B6B00">${data[i].value}</text>`;
        }).join('');
        const attrLabels = data.map((item, i) => {
          const p = calcLabel(i, data.length, 260);
          return `<text x="${p.x.toFixed(2)}" y="${(p.y + p.dy).toFixed(2)}" text-anchor="${p.ta}" font-family="Inter,Arial,sans-serif" font-size="14" font-weight="500" fill="#111720">${item.name}</text>`;
        }).join('');
        const cx = (226 + 100).toFixed(2), cy = (226 + 50).toFixed(2);
        const centre = `<circle cx="${cx}" cy="${cy}" r="36" fill="#CFD32F"/><text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="middle" font-family="Inter,Arial,sans-serif" font-size="26" font-weight="700" fill="#111720">${overall}</text>`;
        // viewBox starts at 0,0 — total size 652x552
        return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 652 552" width="652" height="552"><rect width="652" height="552" fill="#efede9"/>${rings}<polygon points="${ptStr}" fill="#E2E65A" stroke="#CFD32F" stroke-width="1"/>${grid}${axes}${dots}${scoreLabels}${attrLabels}${centre}</svg>`;
      };

      // ── Maturity bar SVG ───────────────────────────────────────
      const buildMaturitySvg = () => {
        const w = 800, h = 80, bh = 16, by = 10, sw = w / MATURITY_STAGES.length;
        const rects = MATURITY_STAGES.map((s, i) => {
          const x = i * sw, isCurr = s.id === stage.id;
          return `<rect x="${x}" y="${by}" width="${sw}" height="${bh}" fill="${s.color}" opacity="${isCurr ? '1' : '0.28'}" rx="2"/>
                  <text x="${x+sw/2}" y="${by+bh+18}" text-anchor="middle" font-family="Inter,Arial,sans-serif" font-size="${isCurr ? 12 : 10}" font-weight="${isCurr ? 700 : 400}" fill="${isCurr ? s.color : '#888888'}">${s.name}</text>`;
        }).join('');
        const mx = (overall / 100) * w;
        return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"><rect width="${w}" height="${h}" fill="white"/>${rects}<circle cx="${mx}" cy="${by+bh/2}" r="10" fill="${stage.color}" stroke="white" stroke-width="3"/><text x="${mx}" y="${by+bh/2+1}" text-anchor="middle" dominant-baseline="middle" font-family="Inter,Arial,sans-serif" font-size="9" font-weight="700" fill="white">${overall}</text></svg>`;
      };

      // ── Logo ───────────────────────────────────────────────────
      const fetchLogo = async () => {
        try {
          const r = await fetch('https://ktuyiikwhspwmzvyczit.supabase.co/storage/v1/object/public/assets/brand/antenna-new-logo.svg');
          return await svgToPng(await r.text(), 200, 56);
        } catch { return null; }
      };

      // ── Summarise assessment sections via Claude ───────────────
      const summariseSection = async (content, sectionName) => {
        if (!content || content.length < 200) return content;
        const prompt = `You are preparing a concise section of a brand assessment report.

Below is the full ${sectionName} assessment for a brand. Summarise it into 3-4 tight paragraphs covering:
- The key observations and findings that most affected the score
- The most significant risks or gaps identified  
- The priority recommendations

Write in plain prose. No headings, no bullet points, no em dashes. Direct and evidence-based tone. Maximum 350 words.

ASSESSMENT CONTENT:
${content.slice(0, 8000)}`;
        try {
          return await callClaude(prompt, apiKey, null, [], 0, false, 1000);
        } catch (e) {
          console.warn('Summary generation failed for', sectionName, e.message);
          return content;
        }
      };

      // ── Benchmark charts → PNG ─────────────────────────────────
      // These are HTML rather than SVG, so they are captured from the live DOM.
      // Returns null (and the section degrades to its table) if the section is
      // collapsed or capture fails, rather than failing the whole export.
      const captureNode = async (ref, width) => {
        if (!ref?.current) return null;
        try {
          const canvas = await html2canvas(ref.current, { scale: 2, backgroundColor: '#ffffff', logging: false });
          return { data: canvas.toDataURL('image/png').split(',')[1], w: width, h: Math.round((canvas.height * width) / canvas.width) };
        } catch (err) {
          console.warn('Benchmark chart capture failed:', err);
          return null;
        }
      };

      // Run summarisation and image generation in parallel
      const [logoB64, radarB64, matB64, aiSummary, earnedSummary, bmPositionImg, bmSpreadImg] = await Promise.all([
        fetchLogo(),
        svgToPng(buildOctagonSvg(), 652, 552),
        svgToPng(buildMaturitySvg(), 800, 80),
        summariseSection(assessments.aiReputation?.content || '', 'AI Reputation and Discoverability'),
        summariseSection(assessments.earnedMedia?.content || assessments.earnedMedia?.autoAssessContent || '', 'Earned Media'),
        captureNode(benchmarkPositionRef, 540),
        captureNode(benchmarkSpreadRef, 540),
      ]);

      // ── Service recommendations ────────────────────────────────
      const forceInc = getForceIncludeServicesFromAIReputation(assessments?.aiReputation?.content, assessments);
      const topRecs = recommendations.slice(0, 6);

      // ── Assessor name ──────────────────────────────────────────
      const assessorName = profile?.full_name || profile?.email || 'Antenna Group';

      // ── Inline bold/italic parser ──────────────────────────────
      const parseInline = (text, sz = 20) => {
        const parts = text.split(/(\*\*[^*]+\*\*)/);
        return parts.filter(Boolean).map(p =>
          p.startsWith('**') && p.endsWith('**')
            ? new TextRun({ text: clean(p.slice(2, -2)), bold: true, size: sz, font: 'Inter' })
            : new TextRun({ text: clean(p), size: sz, font: 'Inter' }));
      };

      // ── Markdown → Paragraph array ─────────────────────────────
      const mdParas = (md) => {
        if (!md) return [];
        const out = [];
        for (const raw of md.split('\n')) {
          const t = raw.trim();
          if (!t) continue;
          if (t.startsWith('# ') || t === '---') continue;
          if (t.startsWith('### ')) {
            out.push(new Paragraph({ spacing: { before: 120, after: 40, ...LINE_SPACING }, children: [new TextRun({ text: clean(t.slice(4)), bold: true, size: 21, font: 'Inter' })] }));
          } else if (t.startsWith('## ')) {
            out.push(new Paragraph({ spacing: { before: 160, after: 60, ...LINE_SPACING }, children: [new TextRun({ text: clean(t.slice(3)), bold: true, size: 22, font: 'Inter' })] }));
          } else if (/^[-*]\s+/.test(t)) {
            out.push(new Paragraph({ numbering: { reference: 'bullets', level: 0 }, spacing: { after: 40, ...LINE_SPACING }, children: parseInline(t.replace(/^[-*]\s+/, '')) }));
          } else if (/^\d+\.\s/.test(t)) {
            out.push(new Paragraph({ numbering: { reference: 'bullets', level: 0 }, spacing: { after: 40, ...LINE_SPACING }, children: parseInline(t.replace(/^\d+\.\s+/, '')) }));
          } else {
            out.push(new Paragraph({ spacing: { after: 80, ...LINE_SPACING }, children: parseInline(t) }));
          }
        }
        return out;
      };

      // ── Extract summary from long-form markdown ────────────────
      // Returns intro prose (before first numbered subsection) + Key Strengths + Priority Improvements
      const extractSummary = (md) => {
        if (!md) return '';
        const lines = md.split('\n');
        const intro = [], strengths = [], priority = [];
        let mode = 'intro';
        for (const line of lines) {
          const t = line.trim();
          if (/^\*\*KEY STRENGTHS?\*\*/i.test(t) || /^#+\s*KEY STRENGTHS?/i.test(t)) { mode = 'strengths'; continue; }
          // Match both "PRIORITY IMPROVEMENTS" and "Priority Recommendations"
          if (/^\*\*PRIORITY\b/i.test(t) || /^#+\s*PRIORITY\b/i.test(t)) { mode = 'priority'; continue; }
          if (/^##\s*\d+\./i.test(t) || /^##\s*SUMMARY/i.test(t) || /^##\s*RESEARCH/i.test(t)) { if (mode === 'intro') mode = 'skip'; continue; }
          if ((mode === 'skip' || mode === 'strengths') && /^---/.test(t)) continue;
          if (t.startsWith('# ') || (t.startsWith('### ') && mode === 'intro')) continue;
          if (mode === 'intro') intro.push(line);
          else if (mode === 'strengths') strengths.push(line);
          else if (mode === 'priority') priority.push(line);
        }
        const parts = [];
        const introText = intro.join('\n').trim();
        if (introText) parts.push(introText);
        if (strengths.length) parts.push('**Key Strengths**\n\n' + strengths.join('\n').trim());
        if (priority.length) parts.push('**Priority Improvements**\n\n' + priority.join('\n').trim());
        return parts.join('\n\n');
      };

      // Earned media: opening overview + priority recommendations only
      const extractEarnedMedia = (md) => {
        if (!md) return '';
        const lines = md.split('\n');
        const out = [];
        let mode = 'intro'; // intro | skip | priority
        let introParaCount = 0;

        for (const line of lines) {
          const t = line.trim();
          // Switch to priority section
          if (/^##\s*Priority/i.test(t) || /^\*\*PRIORITY\b/i.test(t)) {
            mode = 'priority';
            out.push('');
            out.push('**Priority Improvements**');
            continue;
          }
          if (mode === 'priority') { out.push(line); continue; }
          // Skip all numbered sub-sections (## 1., ## 2. etc) and Research Foundation heading
          if (/^##/.test(t)) { mode = 'skip'; continue; }
          if (t === '---') continue;
          if (t.startsWith('# ')) continue;
          // In intro mode: capture first 4 non-empty paragraphs
          if (mode === 'intro' || mode === 'skip') {
            // Switch back to intro when we enter Coverage Volume body (after Research Foundation)
            if (mode === 'skip' && t && !t.startsWith('#')) mode = 'intro';
            if (mode === 'intro') {
              if (t) { out.push(line); }
              else if (out.length > 0 && out[out.length - 1] !== '') {
                introParaCount++;
                out.push(line);
                // Stop after 3 prose paragraphs
                if (introParaCount >= 3) mode = 'skip';
              }
            }
          }
        }
        return out.join('\n').trim();
      };

      // AI Reputation: sections 1 (Convergence), 3 (Sentiment), 5 (Risks), 6 (Recommendations)
      const extractAIReputation = (md) => {
        if (!md) return '';
        const lines = md.split('\n');
        const KEEP_SECTIONS = [/^## 1\./i, /^## 3\./i, /^## 5\./i, /^## 6\./i];
        const out = [];
        let mode = 'skip';
        let currentHeading = '';

        for (const line of lines) {
          const t = line.trim();
          if (t.startsWith('# ') || t === '---') continue;
          if (/^##/.test(t)) {
            const keep = KEEP_SECTIONS.some(r => r.test(t));
            mode = keep ? 'include' : 'skip';
            if (keep) {
              // Clean heading: strip number prefix
              const heading = t.replace(/^##\s*\d+\.\s*/, '').replace(/^##\s*/, '');
              out.push('');
              out.push(`**${heading}**`);
            }
            continue;
          }
          if (mode === 'include') out.push(line);
        }
        return out.join('\n').trim();
      };

      // ── Table helpers ──────────────────────────────────────────
      const bdr = { style: BorderStyle.SINGLE, size: 4, color: 'E0DED9' };
      const bdrs = { top: bdr, bottom: bdr, left: bdr, right: bdr };
      // Always wrap runs in a Paragraph - TableCell.children must be Paragraph[], never TextRun[]
      const cell = (runs, w, fill = 'FFFFFF', align = AlignmentType.LEFT) => new TableCell({
        borders: bdrs,
        width: { size: w, type: WidthType.DXA },
        shading: { fill, type: ShadingType.CLEAR },
        margins: { top: 80, bottom: 80, left: 120, right: 120 },
        children: [new Paragraph({ alignment: align, children: Array.isArray(runs) ? runs : [runs] })],
      });

      // ── Attribute score table ──────────────────────────────────
      const attrTable = new Table({
        width: { size: 9360, type: WidthType.DXA },
        columnWidths: [4860, 1560, 2940],
        rows: [
          new TableRow({ tableHeader: true, children: [
            cell([new TextRun({ text: 'Attribute', bold: true, size: 18, font: 'Inter', color: 'FFFFFF' })], 4860, '1A1A1A'),
            cell([new TextRun({ text: 'Score', bold: true, size: 18, font: 'Inter', color: 'FFFFFF' })], 1560, '1A1A1A', AlignmentType.CENTER),
            cell([new TextRun({ text: 'Maturity', bold: true, size: 18, font: 'Inter', color: 'FFFFFF' })], 2940, '1A1A1A'),
          ]}),
          ...ATTRIBUTES.map((attr, i) => {
            const sc = scores[attr.id]?.score || 0;
            const as = getMaturityStage(sc);
            const bg = i % 2 === 0 ? 'FFFFFF' : 'F6F5F2';
            return new TableRow({ children: [
              cell([new TextRun({ text: `${attr.name} (${attr.fullName})`, size: 18, font: 'Inter' })], 4860, bg),
              cell([new TextRun({ text: `${sc}/100`, bold: true, size: 18, font: 'Inter', color: hexColor(attr.color) })], 1560, bg, AlignmentType.CENTER),
              cell([new TextRun({ text: as.name, size: 18, font: 'Inter', color: hexColor(as.color) })], 2940, bg),
            ]});
          }),
        ],
      });

      // ── Heading paragraph helper ───────────────────────────────
      const LINE_SPACING = { line: 276, lineRule: 'auto' }; // 1.15 line spacing
      const h2 = (text, pageBreak = false) => new Paragraph({
        heading: HeadingLevel.HEADING_2,
        pageBreakBefore: pageBreak,
        spacing: { before: 240, after: 80, ...LINE_SPACING },
        children: [new TextRun({ text, font: 'Inter' })],
      });
      const h3 = (text) => new Paragraph({
        heading: HeadingLevel.HEADING_3,
        spacing: { before: 160, after: 60, ...LINE_SPACING },
        children: [new TextRun({ text, font: 'Inter' })],
      });
      const body = (text, after = 80) => new Paragraph({
        spacing: { after, ...LINE_SPACING },
        children: [new TextRun({ text: clean(text), size: 20, font: 'Inter' })],
      });

      // ── Summary two-column layout (score info | radar) ─────────
      // Left: 5040 DXA (~3.5"), Right: 4320 DXA (~3")
      const websiteEvalDescriptionDocx = assessments.website?.pagesReviewed
        ? `Website analysis covered ${assessments.website.pagesReviewed}, examining brand positioning, messaging, information architecture, UI design, user experience, accessibility, and AI search readability.`
        : 'Website analysis examined brand positioning, messaging, design, and user experience.';

      const summaryLeft = [
        new Paragraph({ spacing: { after: 80, line: 276, lineRule: 'auto' }, children: [
          new TextRun({ text: `${overall}/100`, bold: true, size: 52, font: 'Inter', color: hexColor(stage.color) }),
          new TextRun({ text: `   ${stage.name}`, bold: true, size: 28, font: 'Inter', color: '333333' }),
        ]}),
        ...(scores.headline ? [new Paragraph({ spacing: { after: 100, line: 276, lineRule: 'auto' }, children: [new TextRun({ text: `"${clean(scores.headline)}"`, size: 20, font: 'Inter', italics: true, color: '444444' })] })] : []),
        new Paragraph({ spacing: { after: 100, line: 276, lineRule: 'auto' }, children: [new TextRun({ text: clean(scores.conclusion || `${project.brandName} demonstrates developing brand consciousness across eight dimensions.`), size: 20, font: 'Inter' })] }),
        new Paragraph({ spacing: { after: 80, line: 276, lineRule: 'auto' }, children: [
          new TextRun({ text: `${project.brandName} demonstrates strength in `, size: 20, font: 'Inter' }),
          new TextRun({ text: sortedAttrs.slice(-2).map(a => a.name).join(' and '), size: 20, font: 'Inter', bold: true, color: '059669' }),
          new TextRun({ text: ', with opportunities to grow in ', size: 20, font: 'Inter' }),
          new TextRun({ text: sortedAttrs.slice(0, 2).map(a => a.name).join(' and '), size: 20, font: 'Inter', bold: true, color: 'E53935' }),
          new TextRun({ text: '.', size: 20, font: 'Inter' }),
        ]}),
      ];

      const summaryTable = new Table({
        width: { size: 9360, type: WidthType.DXA },
        columnWidths: [5040, 4320],
        borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE }, insideH: { style: BorderStyle.NONE }, insideV: { style: BorderStyle.NONE } },
        rows: [new TableRow({ children: [
          new TableCell({
            width: { size: 5040, type: WidthType.DXA },
            borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
            margins: { top: 0, bottom: 0, left: 0, right: 160 },
            children: summaryLeft,
          }),
          new TableCell({
            width: { size: 4320, type: WidthType.DXA },
            borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
            margins: { top: 0, bottom: 0, left: 160, right: 0 },
            children: radarB64 ? [new Paragraph({ children: [new ImageRun({ data: radarB64, transformation: { width: 280, height: 237 }, type: 'png' })] })] : [new Paragraph({ children: [] })],
          }),
        ]})],
      });

      // ── Build document ─────────────────────────────────────────
      const doc = new Document({
        numbering: {
          config: [
            { reference: 'bullets', levels: [{ level: 0, format: LevelFormat.BULLET, text: '\u2022', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } }, run: { font: 'Inter', size: 20 } } }] },
            { reference: 'recs', levels: [{ level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } }, run: { font: 'Inter', size: 20, bold: true } } }] },
          ],
        },
        styles: {
          default: { document: { run: { font: 'Inter', size: 20 }, paragraph: { spacing: { line: 276, lineRule: 'auto' } } } },
          paragraphStyles: [
            { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
              run: { size: 52, bold: true, font: 'Inter', color: '1A1A1A' },
              paragraph: { spacing: { before: 240, after: 100 }, outlineLevel: 0 } },
            { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
              run: { size: 28, bold: true, font: 'Inter', color: '1A1A1A' },
              paragraph: { spacing: { before: 240, after: 80 }, outlineLevel: 1 } },
            { id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true,
              run: { size: 22, bold: true, font: 'Inter', color: '333333' },
              paragraph: { spacing: { before: 160, after: 60 }, outlineLevel: 2 } },
          ],
        },
        sections: [{
          properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1080, right: 1080, bottom: 1440, left: 1080 } } },
          footers: { default: new DocxFooter({ children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: `${new Date(project.date || Date.now()).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}  |  Conscious Compass Framework v${FRAMEWORK_VERSION}  |  Assessed by ${assessorName}`, size: 16, font: 'Inter', color: '999999' })],
          })] }) },
          children: [

            // ── COVER ────────────────────────────────────────────
            ...(logoB64 ? [new Paragraph({ spacing: { after: 400 }, children: [new ImageRun({ data: logoB64, transformation: { width: 150, height: 42 }, type: 'png' })] })] : [new Paragraph({ spacing: { after: 400 } })]),
            new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { before: 0, after: 60 }, children: [
              new TextRun({ text: project.brandName, bold: true, font: 'Inter', size: 56 }),
              new TextRun({ text: ' Conscious Brand Assessment', font: 'Inter', size: 40, bold: false }),
            ]}),
            new Paragraph({ spacing: { after: 320 }, children: [
              new TextRun({ text: `${new Date(project.date || Date.now()).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}  |  ${INDUSTRIES.find(i => i.id === project.industry)?.name || project.industry}  |  ${project.businessModel.toUpperCase()}`, size: 20, font: 'Inter', color: '666666' }),
            ]}),
            new Paragraph({ border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: 'D9D6D0', space: 1 } }, spacing: { after: 0 } }),

            // ── SUMMARY PANEL ─────────────────────────────────────
            h2('Summary'),
            summaryTable,

            // Attribute score table
            new Paragraph({ spacing: { before: 200, after: 120 } }),
            attrTable,

            // ── BRAND CONSCIOUSNESS MATURITY ─────────────────────
            h2('Brand Consciousness Maturity'),
            ...(matB64 ? [
              new Paragraph({ spacing: { after: 80 }, children: [new ImageRun({ data: matB64, transformation: { width: 540, height: 54 }, type: 'png' })] }),
            ] : []),
            new Paragraph({ spacing: { after: 60 }, children: [
              new TextRun({ text: `${stage.name}  (${overall}/100)`, bold: true, size: 22, font: 'Inter', color: hexColor(stage.color) }),
            ]}),
            body(clean(stage.description)),
            ...(overall < 100 ? [body(`${Math.min(100, MATURITY_STAGES.find(s => s.min > overall)?.min || 100) - overall} points to next level.`, 60)] : []),

            // ── WHAT WE EVALUATED ─────────────────────────────────
            h2('What We Evaluated'),
            body(`This assessment was conducted using Antenna Group's Brand Consciousness Framework v${FRAMEWORK_VERSION}, evaluating ${project.brandName} across four key dimensions. ${websiteEvalDescriptionDocx} Social media presence was analyzed across LinkedIn, X, Instagram, and YouTube for brand consistency and engagement. AI reputation was assessed across up to five AI engines (Claude, Gemini, ChatGPT, Perplexity, Microsoft Copilot), supplemented by Wikipedia presence, Reddit community perception, and third-party news, review, and search signals. Earned media coverage from the past 3 months was reviewed for sentiment, message penetration, and share of voice. The business model (${project.businessModel.toUpperCase()}) and industry context (${INDUSTRIES.find(i => i.id === project.industry)?.name || project.industry}) were applied to weight attribute importance appropriately.`),

            // ── ATTRIBUTE ANALYSIS ───────────────────────────────
            h2('Attribute Analysis', true),
            ...ATTRIBUTES.flatMap(attr => {
              const sc = scores[attr.id]?.score || 0;
              const as = getMaturityStage(sc);
              const findings = clean(scores[attr.id]?.findings || scores[attr.id]?.summary || attr.description);
              const imp = clean(scores[attr.id]?.impact || '');
              const act = clean(scores[attr.id]?.actions || '');
              const opp = clean(scores[attr.id]?.opportunity || '');
              return [
                new Paragraph({ spacing: { before: 240, after: 60 }, children: [
                  new TextRun({ text: `${attr.name}`, bold: true, size: 24, font: 'Inter', color: hexColor(attr.color) }),
                  new TextRun({ text: `  (${attr.fullName})`, size: 20, font: 'Inter', color: '666666' }),
                  new TextRun({ text: `  ${sc}/100 - ${as.name}`, bold: true, size: 20, font: 'Inter' }),
                ]}),
                body(findings, (imp || act || opp) ? 60 : 160),
                ...(imp ? [new Paragraph({ spacing: { after: act || opp ? 60 : 160 }, children: [
                  new TextRun({ text: "What's driving it: ", bold: true, size: 20, font: 'Inter' }),
                  new TextRun({ text: imp, size: 20, font: 'Inter' }),
                ]})] : []),
                ...(act ? [new Paragraph({ spacing: { after: opp ? 60 : 160 }, children: [
                  new TextRun({ text: 'To improve the score: ', bold: true, size: 20, font: 'Inter' }),
                  new TextRun({ text: act, size: 20, font: 'Inter' }),
                ]})] : []),
                ...(opp ? [new Paragraph({ spacing: { after: 160 }, children: [
                  new TextRun({ text: 'Opportunity: ', bold: true, size: 20, font: 'Inter' }),
                  new TextRun({ text: opp, size: 20, font: 'Inter' }),
                ]})] : []),
              ];
            }),

            // ── CAMPAIGN COHERENCE ───────────────────────────────
            ...(campaignStage ? [
              h2('Campaign Coherence', true),
              new Paragraph({ spacing: { before: 0, after: 80, ...LINE_SPACING }, children: [
                new TextRun({ text: campaignStage.level === 0 ? 'No tier reached' : `Level ${campaignStage.level} of 5`, bold: true, size: 24, font: 'Inter', color: 'E53935' }),
                new TextRun({ text: `  ${campaignStage.name}`, bold: true, size: 24, font: 'Inter' }),
              ]}),
              ...(campaign.verdict ? [new Paragraph({ spacing: { after: 100, ...LINE_SPACING }, children: [
                new TextRun({ text: clean(campaign.verdict), size: 22, font: 'Inter', italics: true, color: '333333' }),
              ]})] : []),
              body(clean(campaignStage.summary)),
              body(clean(campaignStage.description)),
              ...(campaign.rationale ? [new Paragraph({ spacing: { after: 80, ...LINE_SPACING }, children: [
                new TextRun({ text: 'Why this level: ', bold: true, size: 20, font: 'Inter' }),
                new TextRun({ text: clean(campaign.rationale), size: 20, font: 'Inter' }),
              ]})] : []),
              ...(campaign.toNextLevel ? [new Paragraph({ spacing: { after: 120, ...LINE_SPACING }, children: [
                new TextRun({ text: `To reach level ${Math.min(5, campaignStage.level + 1)}: `, bold: true, size: 20, font: 'Inter' }),
                new TextRun({ text: clean(campaign.toNextLevel), size: 20, font: 'Inter' }),
              ]})] : []),

              // Ladder reference table
              h3('The Coherence Ladder'),
              new Table({
                width: { size: 9360, type: WidthType.DXA },
                columnWidths: [780, 1800, 6780],
                rows: [
                  new TableRow({ tableHeader: true, children: [
                    cell([new TextRun({ text: 'Level', bold: true, size: 18, font: 'Inter', color: 'FFFFFF' })], 780, '1A1A1A', AlignmentType.CENTER),
                    cell([new TextRun({ text: 'Name', bold: true, size: 18, font: 'Inter', color: 'FFFFFF' })], 1800, '1A1A1A'),
                    cell([new TextRun({ text: 'Definition', bold: true, size: 18, font: 'Inter', color: 'FFFFFF' })], 6780, '1A1A1A'),
                  ]}),
                  ...CAMPAIGN_LADDER.filter(l => l.level > 0).map(l => {
                    const here = l.level === campaignStage.level;
                    const bg = here ? 'FDECEA' : (l.level % 2 === 0 ? 'FFFFFF' : 'F6F5F2');
                    return new TableRow({ children: [
                      cell([new TextRun({ text: String(l.level), bold: true, size: 18, font: 'Inter', color: here ? 'E53935' : '333333' })], 780, bg, AlignmentType.CENTER),
                      cell([new TextRun({ text: l.name, bold: here, size: 18, font: 'Inter' })], 1800, bg),
                      cell([new TextRun({ text: clean(l.summary), size: 18, font: 'Inter', color: here ? '1A1A1A' : '666666' })], 6780, bg),
                    ]});
                  }),
                ],
              }),

              // Campaigns identified
              ...(Array.isArray(campaign.campaigns) && campaign.campaigns.length ? [
                h3('Campaigns Identified'),
                ...campaign.campaigns.flatMap(c => [
                  new Paragraph({ spacing: { before: 160, after: 40, ...LINE_SPACING }, children: [
                    new TextRun({ text: clean(c.name), bold: true, size: 21, font: 'Inter' }),
                    ...(Array.isArray(c.channels) && c.channels.length ? [new TextRun({ text: `  ${c.channels.join(', ')}`, size: 18, font: 'Inter', color: '999999' })] : []),
                  ]}),
                  ...(c.idea ? [new Paragraph({ spacing: { after: 40, ...LINE_SPACING }, children: [
                    new TextRun({ text: 'Idea: ', bold: true, size: 20, font: 'Inter' }),
                    new TextRun({ text: clean(c.idea), size: 20, font: 'Inter' }),
                  ]})] : []),
                  ...(c.evidence ? [body(clean(c.evidence), 120)] : []),
                ]),
              ] : []),

              // Adjustment, stated openly
              ...(campaignAffected.length ? [
                h3('Score Adjustment'),
                body('Attribute scores judge the quality of the work. Campaign coherence is scored separately and applied here, so neither is counted twice.', 100),
                new Table({
                  width: { size: 9360, type: WidthType.DXA },
                  columnWidths: [4680, 1560, 1560, 1560],
                  rows: [
                    new TableRow({ tableHeader: true, children: [
                      cell([new TextRun({ text: 'Attribute', bold: true, size: 18, font: 'Inter', color: 'FFFFFF' })], 4680, '1A1A1A'),
                      cell([new TextRun({ text: 'Base', bold: true, size: 18, font: 'Inter', color: 'FFFFFF' })], 1560, '1A1A1A', AlignmentType.CENTER),
                      cell([new TextRun({ text: 'Campaign', bold: true, size: 18, font: 'Inter', color: 'FFFFFF' })], 1560, '1A1A1A', AlignmentType.CENTER),
                      cell([new TextRun({ text: 'Final', bold: true, size: 18, font: 'Inter', color: 'FFFFFF' })], 1560, '1A1A1A', AlignmentType.CENTER),
                    ]}),
                    ...campaignAffected.map((attr, i) => {
                      const adj = campaignAdjustment(attr.id);
                      const bg = i % 2 === 0 ? 'FFFFFF' : 'F6F5F2';
                      return new TableRow({ children: [
                        cell([new TextRun({ text: attr.name, size: 18, font: 'Inter' })], 4680, bg),
                        cell([new TextRun({ text: String(scores[attr.id]?.baseScore ?? ''), size: 18, font: 'Inter' })], 1560, bg, AlignmentType.CENTER),
                        cell([new TextRun({ text: `${adj > 0 ? '+' : ''}${adj}`, bold: true, size: 18, font: 'Inter', color: adj > 0 ? '059669' : 'E53935' })], 1560, bg, AlignmentType.CENTER),
                        cell([new TextRun({ text: String(scores[attr.id]?.score ?? ''), bold: true, size: 18, font: 'Inter' })], 1560, bg, AlignmentType.CENTER),
                      ]});
                    }),
                  ],
                }),
              ] : []),
            ] : []),

            // ── BENCHMARK COMPARISON ─────────────────────────────
            ...(benchmark ? [
              h2('Benchmark Comparison', true),
              new Paragraph({ spacing: { before: 0, after: 120, ...LINE_SPACING }, children: [
                new TextRun({ text: 'Benchmark basis: ', bold: true, size: 18, font: 'Inter', color: '666666' }),
                new TextRun({
                  text: clean(`${benchmark.cohortLabel}, n=${benchmark.count}${benchmark.rubricVersions?.length ? `, framework v${benchmark.rubricVersions.join(', v')}` : ''}.${benchmark.fallbackReason ? ` ${benchmark.fallbackReason}` : ''}`),
                  size: 18, font: 'Inter', color: '666666',
                }),
              ]}),
              body(clean(`${project.brandName} scores ${overall} against a ${benchmark.scope === 'industry' ? 'sector' : 'cross-industry'} average of ${benchmark.avgScore}, a difference of ${overall - benchmark.avgScore > 0 ? '+' : ''}${overall - benchmark.avgScore} points. ${benchmark.rank ? `That ranks it ${ordinal(benchmark.rank)} of ${benchmark.count}` : ''}${benchmark.percentile != null ? `, in the ${ordinal(benchmark.percentile)} percentile` : ''}. The average across all assessed brands is ${benchmark.allBrandsAvg}.`), 140),

              ...(bmPositionImg ? [new Paragraph({ spacing: { after: 160 }, children: [
                new ImageRun({ data: bmPositionImg.data, transformation: { width: bmPositionImg.w, height: bmPositionImg.h }, type: 'png' }),
              ]})] : []),
              ...(bmSpreadImg ? [new Paragraph({ spacing: { after: 160 }, children: [
                new ImageRun({ data: bmSpreadImg.data, transformation: { width: bmSpreadImg.w, height: bmSpreadImg.h }, type: 'png' }),
              ]})] : []),

              h3('Attribute Detail'),
              new Table({
                width: { size: 9360, type: WidthType.DXA },
                columnWidths: [4680, 1560, 1560, 1560],
                rows: [
                  new TableRow({ tableHeader: true, children: [
                    cell([new TextRun({ text: 'Attribute', bold: true, size: 18, font: 'Inter', color: 'FFFFFF' })], 4680, '1A1A1A'),
                    cell([new TextRun({ text: project.brandName.slice(0, 20), bold: true, size: 18, font: 'Inter', color: 'FFFFFF' })], 1560, '1A1A1A', AlignmentType.CENTER),
                    cell([new TextRun({ text: benchmark.scope === 'industry' ? 'Sector' : 'All brands', bold: true, size: 18, font: 'Inter', color: 'FFFFFF' })], 1560, '1A1A1A', AlignmentType.CENTER),
                    cell([new TextRun({ text: 'Diff', bold: true, size: 18, font: 'Inter', color: 'FFFFFF' })], 1560, '1A1A1A', AlignmentType.CENTER),
                  ]}),
                  ...ATTRIBUTES.map((attr, i) => {
                    const s = scores[attr.id]?.score || 0;
                    const b = benchmark.attrAvgs?.[attr.id] ?? 0;
                    const d = s - b;
                    const bg = i % 2 === 0 ? 'FFFFFF' : 'F6F5F2';
                    return new TableRow({ children: [
                      cell([new TextRun({ text: attr.name, size: 18, font: 'Inter' })], 4680, bg),
                      cell([new TextRun({ text: String(s), bold: true, size: 18, font: 'Inter', color: hexColor(attr.color) })], 1560, bg, AlignmentType.CENTER),
                      cell([new TextRun({ text: String(b), size: 18, font: 'Inter', color: '666666' })], 1560, bg, AlignmentType.CENTER),
                      cell([new TextRun({ text: `${d > 0 ? '+' : ''}${d}`, bold: true, size: 18, font: 'Inter', color: d > 0 ? '059669' : d < 0 ? 'E53935' : '666666' })], 1560, bg, AlignmentType.CENTER),
                    ]});
                  }),
                ],
              }),
            ] : []),

            // ── WEBSITE ASSESSMENT ───────────────────────────────
            h2('Website Assessment'),
            ...mdParas(extractSummary(assessments.website?.content || '')),

            // ── DIGITAL ESTATE CONSISTENCY ───────────────────────
            ...(() => {
              const props = project.additionalProperties?.filter(p => p.url) || [];
              const pd = assessments.website?.propertyData || {};
              if (props.length === 0) return [];
              const allProps = [{ url: project.websiteUrl, type: 'primary', label: 'Primary' }, ...props];
              const risk = pd.consistencyAnalysis?.match(/OVERALL RISK RATING:\s*(Low|Medium|High)/i)?.[1] || null;
              const riskHex = risk === 'Low' ? '059669' : risk === 'Medium' ? 'F59E0B' : risk === 'High' ? 'E53935' : '666666';
              return [
                h2('Digital Estate Consistency'),
                new Paragraph({ spacing: { before: 0, after: 80 }, children: [
                  new TextRun({ text: `${allProps.length} registered properties`, font: 'Inter', size: 18, color: '999999' }),
                  ...(risk ? [new TextRun({ text: `  ·  ${risk} consistency risk`, font: 'Inter', size: 18, bold: true, color: riskHex })] : []),
                ]}),
                // Property table
                new Table({
                  width: { size: 100, type: WidthType.PERCENTAGE },
                  rows: [
                    new TableRow({ children: [
                      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Property', bold: true, font: 'Inter', size: 18 })] })], shading: { type: ShadingType.SOLID, color: 'F0EEEA' } }),
                      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'URL', bold: true, font: 'Inter', size: 18 })] })], shading: { type: ShadingType.SOLID, color: 'F0EEEA' } }),
                      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Type', bold: true, font: 'Inter', size: 18 })] })], shading: { type: ShadingType.SOLID, color: 'F0EEEA' } }),
                      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Language', bold: true, font: 'Inter', size: 18 })] })], shading: { type: ShadingType.SOLID, color: 'F0EEEA' } }),
                      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Perf', bold: true, font: 'Inter', size: 18 })] })], shading: { type: ShadingType.SOLID, color: 'F0EEEA' } }),
                      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'SEO', bold: true, font: 'Inter', size: 18 })] })], shading: { type: ShadingType.SOLID, color: 'F0EEEA' } }),
                    ]}),
                    ...allProps.map(p => {
                      const d = pd[p.url] || {};
                      return new TableRow({ children: [
                        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: p.label || p.type || 'Property', font: 'Inter', size: 18 })] })] }),
                        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: p.url, font: 'Inter', size: 16, color: '666666' })] })] }),
                        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: p.type || '—', font: 'Inter', size: 18 })] })] }),
                        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: p.language || '—', font: 'Inter', size: 18 })] })] }),
                        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: d.performance != null ? String(d.performance) : '—', font: 'Inter', size: 18 })] })] }),
                        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: d.seo != null ? String(d.seo) : '—', font: 'Inter', size: 18 })] })] }),
                      ]});
                    }),
                  ],
                }),
                ...(pd.consistencyAnalysis ? [
                  new Paragraph({ spacing: { before: 160, after: 60 }, children: [new TextRun({ text: 'Consistency Analysis', bold: true, font: 'Inter', size: 20 })] }),
                  ...mdParas(clean(pd.consistencyAnalysis)),
                ] : []),
              ];
            })(),

            // ── SOCIAL MEDIA ASSESSMENT ──────────────────────────
            h2('Social Media Assessment'),
            ...mdParas(extractSummary(assessments.social?.content || '')),

            // ── AI REPUTATION ASSESSMENT ─────────────────────────
            h2('AI Reputation and Discoverability'),
            ...mdParas(clean(aiSummary)),

            // ── EARNED MEDIA ASSESSMENT ──────────────────────────
            h2('Earned Media Assessment'),
            ...mdParas(clean(earnedSummary)),

            // ── RECOMMENDATIONS ──────────────────────────────────
            h2('Recommendations'),
            body(`Across all four assessment areas, these are the highest-priority actions for moving ${project.brandName} toward the next maturity stage.`, 160),
            ...topRecs.flatMap(r => [
              new Paragraph({ numbering: { reference: 'recs', level: 0 }, spacing: { before: 160, after: 60 }, children: [new TextRun({ text: clean(r.title), bold: true, size: 22, font: 'Inter' })] }),
              body(clean(r.description), 60),
              new Paragraph({ spacing: { after: 160 }, children: [
                new TextRun({ text: 'Benefit: ', bold: true, size: 20, font: 'Inter' }),
                new TextRun({ text: clean(r.impact), size: 20, font: 'Inter', italics: true }),
              ]}),
            ]),

            // ── CONCLUSION ───────────────────────────────────────
            h2('Conclusion'),
            body(clean(scores.conclusion || `${project.brandName} has demonstrated ${overall >= 60 ? 'strong potential' : 'a foundation'} for building a more conscious brand presence. By focusing on the recommendations outlined above, the brand can elevate its market position and create deeper connections with its audience.`), 200),

          ],
        }],
      });

      const blob = await Packer.toBlob(doc);
      saveAs(blob, `${project.brandName.replace(/\s+/g, '_')}_Conscious_Brand_Assessment.docx`);
    } catch (e) {
      console.error('DOCX generation error:', e);
      alert('Error generating DOCX: ' + e.message);
    } finally { setIsGenerating(false); }
  };

  return (
    <div className="max-w-5xl mx-auto p-8 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div className="flex items-center gap-4">
          {isReadonly && (
            <button onClick={onPrev} className="btn-secondary flex items-center gap-2 flex-shrink-0">
              <ArrowLeft className="w-4 h-4" /> Back
            </button>
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-3 mb-4">
              <img src="https://ktuyiikwhspwmzvyczit.supabase.co/storage/v1/object/public/assets/brand/antenna-new-logo.svg"
                alt="Antenna Group" className="h-5" style={{ filter: 'brightness(0)' }} />
              <span className="w-px h-4 bg-[#DCDAD3]" />
              <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#0B0B0B]">The Conscious Compass</span>
            </div>
            <h2 className="font-bold text-[#0B0B0B]"
              style={{ fontSize: 'clamp(34px,5.5vw,72px)', letterSpacing: '-0.035em', lineHeight: 0.92, maxWidth: '14ch' }}>
              {project.brandName}
            </h2>
            <p className="text-sm font-semibold text-[#8A877D] mt-5" style={{ letterSpacing: '0.04em' }}>
              Conscious Compass Assessment · {industryName} · Framework v{FRAMEWORK_VERSION}
            </p>
          </div>
        </div>
        {!isReadonly ? (
          <div className="flex flex-wrap gap-2 flex-shrink-0">
            <button onClick={copyReportText} className="btn-secondary flex items-center gap-1.5 text-xs px-3 py-1.5"><Copy className="w-3.5 h-3.5" /> Copy Full Report</button>
            <button onClick={onSave} className="btn-secondary flex items-center gap-1.5 text-xs px-3 py-1.5"><Save className="w-3.5 h-3.5" /> Save</button>
            <button onClick={() => setShowClientLink(true)} className="btn-secondary flex items-center gap-1.5 text-xs px-3 py-1.5" title="Create a password-protected link for the client">
              <ExternalLink className="w-3.5 h-3.5" /> Client Link
            </button>
            <button onClick={generateDocx} disabled={isGenerating} className="btn-primary flex items-center gap-1.5 text-xs px-3 py-1.5">
              {isGenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />} DOCX
            </button>
          </div>
        ) : (
          <span className="text-sm text-[#8A877D] bg-[#E4E2DC] px-3 py-1.5 self-start">Viewing Report</span>
        )}
      </div>

      {/* Hero — display masthead, tiles rather than a boxed card */}
      <div className="mb-10">
        <div className="grid md:grid-cols-2 gap-10 items-start">
          {/* Left: Score & Summary */}
          <div>
            <div className="dc-kicker mb-3">{stage.name}</div>
            <div className="flex items-end gap-4 mb-4">
              <div className="dc-display" style={{ fontSize: 'clamp(64px, 9vw, 118px)', lineHeight: 0.82 }}>
                {animatedScore}
              </div>
              <div className="dc-kicker-sm pb-3">out of 100</div>
            </div>
            <p className="text-sm text-[#8A877D] leading-relaxed mb-5" style={{ maxWidth: '46ch' }}>{stage.description}</p>
            <div className="border-t border-[#0B0B0B] pt-5" style={{ borderTopWidth: 2 }}>
              {scores.headline && (
                <p className="dc-quote mb-4">
                  "{scores.headline}"
                </p>
              )}
              <p className="text-sm text-[#4A4840] leading-relaxed">
                <strong>{project.brandName}</strong> demonstrates strength in <span className="text-[#059669] font-medium">{sortedAttrs.slice(-2).map(a => a.name).join(' and ')}</span>, with opportunities to grow in <span className="text-[#B23A3A] font-medium">{sortedAttrs.slice(0, 2).map(a => a.name).join(' and ')}</span>.
              </p>
            </div>
          </div>
          
          {/* Right: Spider Chart */}
          <div ref={chartRef} className="w-full max-w-md mx-auto">
            <SpiderChart scores={scores} size={420} />
          </div>
        </div>
      </div>

      {/* Score tiles — separated by paper, not by borders */}
      <div className="dc-tiles grid-cols-4 md:grid-cols-8 mb-10" style={{ gridTemplateColumns: undefined }}>
        {ATTRIBUTES.map(attr => (
          <div key={attr.id} className="dc-tile" style={{ gap: 6, padding: '14px 12px' }}>
            <div className="dc-kicker-sm leading-tight break-words">{attr.name}</div>
            <div className="text-3xl font-bold tracking-tight" style={{ color: attr.color }}>{scores[attr.id]?.score || 0}</div>
          </div>
        ))}
      </div>

      {/* Maturity Continuum */}
      <MaturityContinuum score={overall} />

      {/* Attribute Analysis - Collapsible */}
      <div className="mt-6 mb-6">
        <button 
          onClick={() => toggleSection('attributes')} 
          className="dc-sec-head mb-4 hover:opacity-60 transition-opacity"
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
                  <div className="min-w-0">
                    <h4 className="font-semibold text-[#0B0B0B] text-sm">{attr.name}</h4>
                    <p className="text-xs text-[#8A877D]">{attr.fullName}</p>
                  </div>
                </div>
                {campaignAdjustment(attr.id) !== 0 && (
                  <p className="text-[10px] text-[#999] mb-2 tabular-nums">
                    {scores[attr.id]?.baseScore} base
                    <span className={campaignAdjustment(attr.id) > 0 ? ' text-[#059669]' : ' text-[#B23A3A]'}>
                      {' '}{campaignAdjustment(attr.id) > 0 ? '+' : ''}{campaignAdjustment(attr.id)}
                    </span>{' '}campaign coherence
                  </p>
                )}
                {benchmark && (
                  <p className="text-[10px] text-[#999] mb-2 tabular-nums">
                    {benchmark.cohortLabel} average {benchmark.attrAvgs?.[attr.id] ?? 0}
                    {(() => {
                      const d = (scores[attr.id]?.score || 0) - (benchmark.attrAvgs?.[attr.id] ?? 0);
                      return <span className={d > 0 ? ' text-[#059669]' : d < 0 ? ' text-[#B23A3A]' : ''}>{' '}({d > 0 ? '+' : ''}{d})</span>;
                    })()}
                  </p>
                )}
                <p className="text-xs text-[#4A4840] leading-relaxed">{scores[attr.id]?.findings || scores[attr.id]?.summary || attr.description}</p>
                {scores[attr.id]?.impact && (
                  <p className="text-xs text-[#4A4840] mt-2 leading-relaxed"><span className="font-semibold">What's driving it:</span> {scores[attr.id].impact}</p>
                )}
                {scores[attr.id]?.actions && (
                  <p className="text-xs text-[#4A4840] mt-2 leading-relaxed"><span className="font-semibold">To improve the score:</span> {scores[attr.id].actions}</p>
                )}
                {scores[attr.id]?.opportunity && (
                  <p className="text-xs text-[#B23A3A] mt-2 italic">→ {scores[attr.id].opportunity}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {showClientLink && (
        <ClientLinkModal
          brandName={project.brandName}
          buildPayload={buildClientPayload}
          onClose={() => setShowClientLink(false)}
          profile={profile}
        />
      )}

      {/* Masthead stat bar */}
      <div className="h-0.5 bg-[#0B0B0B] mt-2 mb-0" />
      <div className="grid gap-6 pt-5 pb-8" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))' }}>
        {[
          ['Overall score', <>{overall}<span className="text-[15px] font-medium text-[#8A877D]" style={{ letterSpacing: 0 }}> / 100</span></>],
          ['Maturity level', stage.name],
          ['Sector', industryName],
          ...(benchmark?.rank ? [['Rank in sector', `${ordinalSuffix(benchmark.rank)} of ${benchmark.count}`]] : []),
        ].map(([label, value], i) => (
          <div key={i}>
            <div className="text-[9px] font-bold uppercase tracking-[0.16em] text-[#8A877D] mb-1.5">{label}</div>
            <div className="font-bold text-[#0B0B0B]" style={{ fontSize: 30, letterSpacing: '-0.03em', lineHeight: 1 }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Brand Footprint - Collapsible */}
      {scores?.footprint && (
        <div className="mb-6">
          <button
            onClick={() => toggleSection('footprint')}
            className="dc-sec-head mb-4 hover:opacity-60 transition-opacity"
          >
            <span>BRAND FOOTPRINT</span>
            <ChevronDown className={`w-5 h-5 transition-transform ${expandedSections.footprint ? 'rotate-180' : ''}`} />
          </button>
          {expandedSections.footprint && (
            <div className="animate-fade-in">
              <FootprintMosaic footprint={scores.footprint} brandName={project.brandName} />
            </div>
          )}
        </div>
      )}

      {/* Campaign Coherence - Collapsible */}
      {!campaignStage && (
        <div className="mb-6">
          <div className="dc-sec-head mb-4">CAMPAIGN COHERENCE</div>
          <div className="card p-4 border-l-4 border-amber-400">
            <p className="text-sm text-[#4A4840] leading-relaxed">
              These scores were produced before campaign coherence existed, or the scoring pass did not return it.
              Regenerate the report to score campaign coherence and apply the framework {FRAMEWORK_VERSION} adjustment.
            </p>
            <button
              onClick={() => { setScores(null); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
              className="btn-secondary text-xs py-1.5 px-3 mt-3 flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Regenerate Report
            </button>
          </div>
        </div>
      )}
      {campaignStage && (
        <div className="mb-6">
          <button
            onClick={() => toggleSection('campaign')}
            className="dc-sec-head mb-4 hover:opacity-60 transition-opacity"
          >
            <span>CAMPAIGN COHERENCE</span>
            <ChevronDown className={`w-5 h-5 transition-transform ${expandedSections.campaign ? 'rotate-180' : ''}`} />
          </button>
          {expandedSections.campaign && (
            <div className="animate-fade-in space-y-3">
              <div className="card p-5">
                <div className="flex flex-wrap items-start gap-4 mb-4">
                  <div className="text-center flex-shrink-0">
                    <div className="w-16 h-16 flex items-center justify-center text-white text-2xl font-bold bg-[#0B0B0B]">
                      {campaignStage.level === 0 ? '—' : campaignStage.level}
                    </div>
                    <div className="text-[10px] text-[#8A877D] mt-1">{campaignStage.level === 0 ? 'no tier' : 'of 5'}</div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-lg font-bold text-[#0B0B0B]">{campaignStage.name}</div>
                    <p className="text-sm text-[#8A877D] leading-relaxed mb-2">{campaignStage.summary}</p>
                    {campaign.verdict && (
                      <p className="text-sm text-[#0B0B0B] font-medium leading-relaxed">{campaign.verdict}</p>
                    )}
                  </div>
                </div>

                <CampaignLadder level={campaignStage.level} />

                <p className="text-xs text-[#4A4840] leading-relaxed">{campaignStage.description}</p>

                {campaign.rationale && (
                  <p className="text-xs text-[#4A4840] mt-2 leading-relaxed">
                    <span className="font-semibold">Why this level:</span> {campaign.rationale}
                  </p>
                )}
                {campaign.toNextLevel && (
                  <p className="text-xs text-[#4A4840] mt-2 leading-relaxed">
                    <span className="font-semibold">To reach level {Math.min(5, campaignStage.level + 1)}:</span> {campaign.toNextLevel}
                  </p>
                )}
                {campaign.confidence && (
                  <p className="text-[10px] text-[#999] mt-2 uppercase tracking-wide">Confidence: {campaign.confidence}</p>
                )}
              </div>

              {/* Detected campaigns */}
              {Array.isArray(campaign.campaigns) && campaign.campaigns.length > 0 && (
                <div className="grid md:grid-cols-2 gap-3">
                  {campaign.campaigns.map((c, i) => (
                    <div key={i} className="card p-4">
                      <h4 className="font-semibold text-[#0B0B0B] text-sm mb-1">{c.name}</h4>
                      {Array.isArray(c.channels) && c.channels.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-2">
                          {c.channels.map((ch, j) => (
                            <span key={j} className="text-[10px] px-1.5 py-0.5 bg-[#E4E2DC] text-[#8A877D]">{ch}</span>
                          ))}
                        </div>
                      )}
                      {c.idea && <p className="text-xs text-[#4A4840] leading-relaxed mb-1"><span className="font-semibold">Idea:</span> {c.idea}</p>}
                      {c.evidence && <p className="text-xs text-[#8A877D] leading-relaxed">{c.evidence}</p>}
                    </div>
                  ))}
                </div>
              )}

              {/* Score adjustment, shown openly */}
              {campaignAffected.length > 0 && (
                <div className="card p-4">
                  <h4 className="text-sm font-semibold text-[#0B0B0B] mb-1">Score Adjustment</h4>
                  <p className="text-xs text-[#8A877D] mb-3 leading-relaxed">
                    Attribute scores judge the quality of the work. Campaign coherence is scored separately and applied here, so the two are never counted twice.
                    Level {campaignStage.level} adjusts {CAMPAIGN_MODIFIER_ATTRIBUTES.primary.map(id => ATTRIBUTES.find(a => a.id === id)?.name).join(' and ')} by {CAMPAIGN_MODIFIERS[campaignStage.level].primary > 0 ? '+' : ''}{CAMPAIGN_MODIFIERS[campaignStage.level].primary}, and {CAMPAIGN_MODIFIER_ATTRIBUTES.secondary.map(id => ATTRIBUTES.find(a => a.id === id)?.name).join(', ')} by {CAMPAIGN_MODIFIERS[campaignStage.level].secondary > 0 ? '+' : ''}{CAMPAIGN_MODIFIERS[campaignStage.level].secondary}.
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {campaignAffected.map(attr => {
                      const adj = campaignAdjustment(attr.id);
                      return (
                        <div key={attr.id} className="flex items-center justify-between bg-[#F2F0EA] px-2.5 py-1.5">
                          <span className="text-xs font-medium text-[#0B0B0B] truncate">{attr.name}</span>
                          <span className="text-xs tabular-nums text-[#8A877D] flex-shrink-0 ml-2">
                            {scores[attr.id]?.baseScore ?? scores[attr.id]?.score}
                            <span className={adj > 0 ? 'text-[#059669] font-semibold' : 'text-[#B23A3A] font-semibold'}> {adj > 0 ? '+' : ''}{adj} </span>
                            <span className="font-bold text-[#0B0B0B]">{scores[attr.id]?.score}</span>
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Industry Benchmark - Collapsible */}
      {benchmarkUnavailableReason && (
        <div className="mb-6">
          <div className="dc-sec-head mb-4">BENCHMARK COMPARISON</div>
          <div className="card p-4 border-l-4 border-amber-400">
            <p className="text-sm text-[#4A4840] leading-relaxed">{benchmarkUnavailableReason}</p>
          </div>
        </div>
      )}
      {benchmark && (
        <div className="mb-6">
          <button
            onClick={() => toggleSection('benchmark')}
            className="dc-sec-head mb-4 hover:opacity-60 transition-opacity"
          >
            <span>BENCHMARK COMPARISON</span>
            <ChevronDown className={`w-5 h-5 transition-transform ${expandedSections.benchmark ? 'rotate-180' : ''}`} />
          </button>
          {expandedSections.benchmark && (
            <div className="animate-fade-in space-y-3">
              <BenchmarkProvenance benchmark={benchmark} />

              <div ref={benchmarkPositionRef}>
                <BenchmarkPositionBar benchmark={benchmark} brandName={project.brandName} />
              </div>

              <div ref={benchmarkSpreadRef}>
                <BenchmarkSpread benchmark={benchmark} brandName={project.brandName} />
              </div>

              <div className="bg-white border border-[#DCDAD3] p-5" ref={benchmarkRadarRef}>
                <div className="mb-3">
                  <h3 className="font-semibold text-[#0B0B0B] text-sm">Profile Against Benchmark</h3>
                  <p className="text-xs text-[#8A877D] mt-1">
                    {project.brandName} in solid, the {benchmark.cohortLabel.toLowerCase()} average as the dashed outline.
                  </p>
                </div>
                <div className="flex justify-center">
                  <ComparisonSpiderChart
                    brands={[{ id: 'subject', brandName: project.brandName, totalScore: overall, scores: ATTRIBUTES.reduce((acc, a) => { acc[a.id] = scores[a.id]?.score || 0; return acc; }, {}) }]}
                    size={320}
                    industryAvg={benchmarkAvgScores}
                    avgLabel={`${benchmark.cohortLabel} avg`}
                    animateOnScroll
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Recommendations - Collapsible */}
      <div className="mb-6">
        <button 
          onClick={() => toggleSection('recommendations')} 
          className="dc-sec-head mb-4 hover:opacity-60 transition-opacity"
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
                    <div className="w-6 h-6 bg-[#DEE42F] text-white flex items-center justify-center font-bold text-xs flex-shrink-0">{i + 1}</div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-[#0B0B0B] text-sm">{r.title}</h4>
                    </div>
                  </div>
                  <p className="text-xs text-[#8A877D] leading-relaxed mb-2">{r.description}</p>
                  <div className="bg-[#E4E2DC] p-2 mb-2">
                    <p className="text-xs text-[#4A4840] leading-relaxed"><span className="font-medium text-[#B23A3A]">Benefit:</span> {r.impact}</p>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {r.attributes.slice(0, 3).map((attr, j) => (
                      <span key={j} className="text-[10px] px-1.5 py-0.5 bg-[#DEE42F]/10 text-[#B23A3A]">{attr}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            {recommendations.length > 6 && (
              <details className="mt-3">
                <summary className="text-sm text-[#B23A3A] cursor-pointer hover:underline">View {recommendations.length - 6} more recommendations</summary>
                <div className="grid md:grid-cols-2 gap-3 mt-3">
                  {recommendations.slice(6).map((r, i) => (
                    <div key={i + 6} className="card p-4">
                      <div className="flex gap-3 mb-2">
                        <div className="w-6 h-6 bg-[#DEE42F]/20 text-[#B23A3A] flex items-center justify-center font-bold text-xs flex-shrink-0">{i + 7}</div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-[#0B0B0B] text-sm">{r.title}</h4>
                        </div>
                      </div>
                      <p className="text-xs text-[#8A877D] leading-relaxed mb-2">{r.description}</p>
                      <div className="bg-[#E4E2DC] p-2 mb-2">
                        <p className="text-xs text-[#4A4840] leading-relaxed"><span className="font-medium text-[#B23A3A]">Benefit:</span> {r.impact}</p>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {r.attributes.slice(0, 3).map((attr, j) => (
                          <span key={j} className="text-[10px] px-1.5 py-0.5 bg-[#DEE42F]/10 text-[#B23A3A]">{attr}</span>
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
              className="w-full flex items-center justify-between text-xl font-semibold text-[#0B0B0B] mb-4 hover:text-[#0B0B0B] transition-colors"
            >
              <span>RECOMMENDED ANTENNA GROUP SERVICES</span>
              <ChevronDown className={`w-5 h-5 transition-transform ${expandedSections.services ? 'rotate-180' : ''}`} />
            </button>
            {expandedSections.services && (
              <div className="animate-fade-in">
                <p className="text-[#8A877D] mb-4 text-sm md:text-base">Based on the lowest scoring attributes, these services would have the greatest impact on improving brand consciousness:</p>
                <div className="grid md:grid-cols-2 gap-4">
                  {topServices.map((rec, i) => {
                    const attr = ATTRIBUTES.find(a => a.id === rec.attributeId);
                    return (
                      <div key={i} className="card p-4 md:p-5 border-l-4" style={{ borderLeftColor: attr?.color || '#E53935' }}>
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <h4 className="font-semibold text-[#0B0B0B] text-sm md:text-base">{rec.service.name}</h4>
                            <p className="text-xs text-[#8A877D]">{rec.service.category}</p>
                          </div>
                          <span className={`text-xs px-2 py-1 font-medium ${
                            rec.priorityLevel === 'critical' ? 'bg-red-100 text-red-700' :
                            rec.priorityLevel === 'moderate' ? 'bg-yellow-100 text-yellow-700' :
                            'bg-green-100 text-green-700'
                          }`}>
                            {rec.priorityLevel === 'critical' ? 'High Priority' : 
                             rec.priorityLevel === 'moderate' ? 'Recommended' : 'Opportunity'}
                          </span>
                        </div>
                        <p className="text-xs md:text-sm text-[#4A4840] mb-3">{rec.rationale}</p>
                        <div className="flex items-center justify-between text-xs text-[#8A877D]">
                          <span className="flex items-center gap-1">
                            <span className="w-3 h-3" style={{ backgroundColor: attr?.color || '#E53935' }}></span>
                            Improves {attr?.name} (currently {rec.attributeScore})
                          </span>
                          <span className="font-medium">{formatBudget(rec.service)}</span>
                        </div>
                        {rec.service.note && (
                          <p className="text-xs text-[#B3B0A8] mt-2 italic">{rec.service.note}</p>
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
          className="w-full flex items-center justify-between dc-kicker text-[#0B0B0B] mb-4 hover:text-[#0B0B0B] transition-colors"
        >
          <span>CONCLUSIONS</span>
          <ChevronDown className={`w-5 h-5 transition-transform ${expandedSections.conclusions ? 'rotate-180' : ''}`} />
        </button>
        {expandedSections.conclusions && (
          <div className="card p-4 md:p-6 animate-fade-in">
            <p className="text-sm md:text-base text-[#4A4840] leading-relaxed">
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
            className="w-full flex items-center justify-between dc-kicker text-[#0B0B0B] mb-4 hover:text-[#0B0B0B] transition-colors"
          >
            <span>SCORE JUSTIFICATION</span>
            <ChevronDown className={`w-5 h-5 transition-transform ${expandedSections.justification ? 'rotate-180' : ''}`} />
          </button>
          {expandedSections.justification && (
            <div className="card p-4 md:p-6 animate-fade-in bg-[#F2F0EA]">
              <p className="text-sm text-[#4A4840] leading-relaxed">
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
          className="w-full flex items-center justify-between dc-kicker text-[#0B0B0B] mb-4 hover:text-[#0B0B0B] transition-colors"
        >
          <span>WHAT WE EVALUATED</span>
          <ChevronDown className={`w-5 h-5 transition-transform ${expandedSections.evaluated ? 'rotate-180' : ''}`} />
        </button>
        {expandedSections.evaluated && (
          <div className="card p-4 md:p-6 animate-fade-in">
            <p className="text-sm md:text-base text-[#4A4840] leading-relaxed">
              This assessment was conducted using Antenna Group's Brand Consciousness Framework v{FRAMEWORK_VERSION}, evaluating {project.brandName} across four key dimensions. {websiteEvalDescription} Social media presence was analyzed across LinkedIn, X, Instagram, and YouTube for brand consistency and engagement. AI reputation was assessed across up to five AI engines (Claude, Gemini, ChatGPT, Perplexity, Microsoft Copilot), supplemented by Wikipedia presence, Reddit community perception, and third-party news, review, and search signals, to understand how AI systems perceive and represent the brand. Earned media coverage from the past 3 months was reviewed for sentiment, message penetration, and share of voice. The business model ({project.businessModel.toUpperCase()}) and industry context ({industryName}) were applied to weight attribute importance appropriately.
            </p>
          </div>
        )}
      </div>

      {/* Assessment Readouts - Collapsible */}
      <div className="mb-8">
        <button 
          onClick={() => toggleSection('readouts')} 
          className="w-full flex items-center justify-between dc-kicker text-[#0B0B0B] mb-4 hover:text-[#0B0B0B] transition-colors"
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
                className="w-full flex items-center justify-between p-4 hover:bg-[#F2F0EA] transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-[#DEE42F]/10 flex items-center justify-center">
                    <Globe className="w-5 h-5 text-[#B23A3A]" />
                  </div>
                  <div className="text-left">
                    <h4 className="font-medium text-[#0B0B0B]">Website Assessment</h4>
                    <p className="text-xs text-[#8A877D]">Auto-assess, SEO visibility, and full analysis</p>
                  </div>
                </div>
                <ChevronDown className={`w-5 h-5 text-[#8A877D] transition-transform ${expandedSections.readoutWebsite ? 'rotate-180' : ''}`} />
              </button>
              {expandedSections.readoutWebsite && (
                <div className="border-t border-[#DCDAD3] p-4 space-y-4 bg-[#F2F0EA]">
                  {assessments.website?.autoAssessContent && (
                    <div>
                      <h5 className="text-sm font-medium text-[#B23A3A] mb-2">Auto-Assess Analysis</h5>
                      <div className="bg-white p-4 max-h-64 overflow-y-auto">
                        <pre className="text-sm text-[#4A4840] whitespace-pre-wrap font-sans">{assessments.website.autoAssessContent}</pre>
                      </div>
                    </div>
                  )}
                  {assessments.website?.seoAssessment && (
                    <div>
                      <h5 className="text-sm font-medium text-[#B23A3A] mb-2">SEO Visibility Assessment</h5>
                      <div className="bg-white p-4 max-h-64 overflow-y-auto">
                        <pre className="text-sm text-[#4A4840] whitespace-pre-wrap font-sans">{assessments.website.seoAssessment}</pre>
                      </div>
                    </div>
                  )}
                  {assessments.website?.content && (
                    <div>
                      <h5 className="text-sm font-medium text-[#B23A3A] mb-2">Full Website Analysis</h5>
                      <div className="bg-white p-4 max-h-64 overflow-y-auto">
                        <pre className="text-sm text-[#4A4840] whitespace-pre-wrap font-sans">{assessments.website.content}</pre>
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
                className="w-full flex items-center justify-between p-4 hover:bg-[#F2F0EA] transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-[#8B5CF6]/10 flex items-center justify-center">
                    <Users className="w-5 h-5 text-[#8B5CF6]" />
                  </div>
                  <div className="text-left">
                    <h4 className="font-medium text-[#0B0B0B]">Social Media Assessment</h4>
                    <p className="text-xs text-[#8A877D]">Platform analysis and Reddit Answers AI visibility</p>
                  </div>
                </div>
                <ChevronDown className={`w-5 h-5 text-[#8A877D] transition-transform ${expandedSections.readoutSocial ? 'rotate-180' : ''}`} />
              </button>
              {expandedSections.readoutSocial && (
                <div className="border-t border-[#DCDAD3] p-4 space-y-4 bg-[#F2F0EA]">
                  {assessments.social?.redditAnswersContent && (
                    <div>
                      <h5 className="text-sm font-medium text-[#8B5CF6] mb-2">Reddit Answers (AI Search Visibility)</h5>
                      <div className="bg-white p-4 max-h-64 overflow-y-auto">
                        <pre className="text-sm text-[#4A4840] whitespace-pre-wrap font-sans">{assessments.social.redditAnswersContent}</pre>
                      </div>
                    </div>
                  )}
                  {assessments.social?.content && (
                    <div>
                      <h5 className="text-sm font-medium text-[#8B5CF6] mb-2">Full Social Media Analysis</h5>
                      <div className="bg-white p-4 max-h-64 overflow-y-auto">
                        <pre className="text-sm text-[#4A4840] whitespace-pre-wrap font-sans">{assessments.social.content}</pre>
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
                className="w-full flex items-center justify-between p-4 hover:bg-[#F2F0EA] transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-[#3B82F6]/10 flex items-center justify-center">
                    <Bot className="w-5 h-5 text-[#3B82F6]" />
                  </div>
                  <div className="text-left">
                    <h4 className="font-medium text-[#0B0B0B]">AI Reputation Assessment</h4>
                    <p className="text-xs text-[#8A877D]">AI engine reputation synthesis</p>
                  </div>
                </div>
                <ChevronDown className={`w-5 h-5 text-[#8A877D] transition-transform ${expandedSections.readoutAI ? 'rotate-180' : ''}`} />
              </button>
              {expandedSections.readoutAI && (
                <div className="border-t border-[#DCDAD3] p-4 bg-[#F2F0EA]">
                  {assessments.aiReputation?.content ? (
                    <div className="bg-white p-4 max-h-64 overflow-y-auto">
                      <pre className="text-sm text-[#4A4840] whitespace-pre-wrap font-sans">{assessments.aiReputation.content}</pre>
                    </div>
                  ) : (
                    <p className="text-sm text-[#8A877D]">No synthesis generated yet.</p>
                  )}
                </div>
              )}
            </div>

            {/* Earned Media Assessment Readout */}
            <div className="card overflow-hidden">
              <button 
                onClick={() => toggleSection('readoutEarned')} 
                className="w-full flex items-center justify-between p-4 hover:bg-[#F2F0EA] transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-[#10B981]/10 flex items-center justify-center">
                    <Newspaper className="w-5 h-5 text-[#10B981]" />
                  </div>
                  <div className="text-left">
                    <h4 className="font-medium text-[#0B0B0B]">Earned Media Assessment</h4>
                    <p className="text-xs text-[#8A877D]">Auto-assess performance and coverage analysis</p>
                  </div>
                </div>
                <ChevronDown className={`w-5 h-5 text-[#8A877D] transition-transform ${expandedSections.readoutEarned ? 'rotate-180' : ''}`} />
              </button>
              {expandedSections.readoutEarned && (
                <div className="border-t border-[#DCDAD3] p-4 space-y-4 bg-[#F2F0EA]">
                  {assessments.earnedMedia?.autoAssessContent && (
                    <div>
                      <h5 className="text-sm font-medium text-[#10B981] mb-2">Auto-Assess Earned Media Performance</h5>
                      <div className="bg-white p-4 max-h-64 overflow-y-auto">
                        <pre className="text-sm text-[#4A4840] whitespace-pre-wrap font-sans">{assessments.earnedMedia.autoAssessContent}</pre>
                      </div>
                    </div>
                  )}
                  {assessments.earnedMedia?.content && (
                    <div>
                      <h5 className="text-sm font-medium text-[#10B981] mb-2">Full Earned Media Analysis</h5>
                      <div className="bg-white p-4 max-h-64 overflow-y-auto">
                        <pre className="text-sm text-[#4A4840] whitespace-pre-wrap font-sans">{assessments.earnedMedia.content}</pre>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-start pt-6 border-t border-[#DCDAD3]">
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
    <div className="min-h-screen bg-[#F2F0EA]">
      <div className="dc-wrap dc-page pt-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 md:mb-8 gap-4">
          <div className="flex items-center gap-4">
            <button onClick={onBack} className="btn-secondary flex items-center gap-2">
              <ArrowLeft className="w-4 h-4" /> Back
            </button>
            <div>
              <h1 className="dc-h2 text-[#0B0B0B]">Compass Results</h1>
              <span className="text-sm text-[#8A877D]">{results.length} assessments</span>
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
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#B3B0A8]" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search brands..."
                  className="w-full pl-9 pr-4 py-2 border border-[#DCDAD3] bg-white text-sm"
                />
              </div>

              {/* Industry Filter */}
              <select
                value={filterIndustry}
                onChange={(e) => setFilterIndustry(e.target.value)}
                className="px-3 py-2 border border-[#DCDAD3] bg-white text-sm"
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
                className="px-3 py-2 border border-[#DCDAD3] bg-white text-sm"
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
                className="px-3 py-2 border border-[#DCDAD3] bg-white text-sm"
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
                  className="px-3 py-2 text-sm text-[#B23A3A] hover:bg-[#DEE42F]/10 transition-colors flex items-center gap-1"
                >
                  <X className="w-4 h-4" /> Clear
                </button>
              )}
            </div>

            {/* Results count */}
            {hasActiveFilters && (
              <div className="mt-3 text-sm text-[#8A877D]">
                Showing {filteredResults.length} of {results.length} results
              </div>
            )}
          </div>
        )}

        {results.length === 0 ? (
          <div className="card p-12 text-center">
            <BarChart3 className="w-16 h-16 text-[#DCDAD3] mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-[#0B0B0B] mb-2">No Results Yet</h3>
            <p className="text-[#8A877D] mb-4">Complete and save assessments to see them here{profile?.is_admin ? ', or add manual entries' : ''}.</p>
            {profile?.is_admin && (
              <button onClick={() => setShowAddModal(true)} className="btn-primary">
                Add Manual Entry
              </button>
            )}
          </div>
        ) : filteredResults.length === 0 ? (
          <div className="card p-12 text-center">
            <Search className="w-16 h-16 text-[#DCDAD3] mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-[#0B0B0B] mb-2">No Matching Results</h3>
            <p className="text-[#8A877D] mb-4">Try adjusting your search or filters.</p>
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
                    className="flex items-center gap-4 p-4 cursor-pointer hover:bg-[#F2F0EA] transition-colors"
                    onClick={() => toggleRow(r.id || i)}
                  >
                    {/* Brand & Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-[#0B0B0B] truncate">{r.brandName}</span>
                        {r.isManual && (
                          <span className="text-[10px] px-1.5 py-0.5 bg-yellow-100 text-yellow-700 ">Manual</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-[#8A877D] mt-0.5">
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
                        <div className="text-xs font-medium text-[#8A877D]">
                          {assessmentDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </div>
                        <div className="text-[10px] text-[#B3B0A8]">
                          {assessmentDate.getFullYear()}
                        </div>
                      </div>
                    )}
                    
                    {/* Score Badge */}
                    <div className="flex items-center gap-3">
                      <div className="text-center">
                        <div className="text-2xl font-bold" style={{ color: stage.color }}>{r.totalScore}</div>
                        <div className="text-[10px] px-2 py-0.5" style={{ backgroundColor: `${stage.color}15`, color: stage.color }}>
                          {r.maturityLevel}
                        </div>
                      </div>
                    </div>
                    
                    {/* Expand Icon */}
                    <ChevronDown className={`w-4 h-4 text-[#8A877D] transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                  </div>
                  
                  {/* Expanded Details */}
                  {isExpanded && (
                    <div className="border-t border-[#DCDAD3] bg-[#F2F0EA] p-4 animate-fade-in">
                      <div className="flex flex-col md:flex-row gap-4 mb-4">
                        {/* Mini Spider Chart */}
                        <div className="flex-shrink-0 flex justify-center md:justify-start">
                          <MiniSpiderChart scores={r.scores} size={120} />
                        </div>
                        {/* Attribute Scores Grid */}
                        <div className="flex-1">
                          <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                            {ATTRIBUTES.map(attr => (
                              <div key={attr.id} className="text-center p-2 bg-white ">
                                <div className="text-lg font-bold" style={{ color: attr.color }}>{r.scores?.[attr.id] || 0}</div>
                                <div className="text-[10px] text-[#8A877D] truncate">{attr.name}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                      
                      {/* Meta Info */}
                      <div className="flex flex-wrap items-center gap-4 text-xs text-[#8A877D]">
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
          <div className="bg-white max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-[#DCDAD3]">
              <h3 className="text-xl font-bold text-[#0B0B0B]">Add Manual Entry</h3>
              <button onClick={() => setShowAddModal(false)} className="text-[#8A877D] hover:text-[#0B0B0B]">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#0B0B0B] mb-1">Brand Name *</label>
                <input
                  type="text"
                  value={manualEntry.brandName}
                  onChange={(e) => setManualEntry({ ...manualEntry, brandName: e.target.value })}
                  placeholder="Enter brand name"
                  className="w-full px-3 py-2 border border-[#DCDAD3] "
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[#0B0B0B] mb-1">Business Model</label>
                  <select
                    value={manualEntry.businessModel}
                    onChange={(e) => setManualEntry({ ...manualEntry, businessModel: e.target.value })}
                    className="w-full px-3 py-2 border border-[#DCDAD3] "
                  >
                    <option value="b2b">B2B</option>
                    <option value="b2c">B2C</option>
                    <option value="b2b2c">B2B2C</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#0B0B0B] mb-1">Industry</label>
                  <select
                    value={manualEntry.industry}
                    onChange={(e) => setManualEntry({ ...manualEntry, industry: e.target.value })}
                    className="w-full px-3 py-2 border border-[#DCDAD3] "
                  >
                    {industries.map(ind => (
                      <option key={ind.id} value={ind.id}>{ind.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              
              {/* Total Compass Score */}
              <div className="bg-[#E4E2DC] p-4">
                <label className="block text-sm font-medium text-[#0B0B0B] mb-2">Total Compass Score (0-100) *</label>
                <div className="flex items-center gap-4">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={manualEntry.totalScore}
                    onChange={(e) => setManualEntry({ ...manualEntry, totalScore: Math.min(100, Math.max(0, parseInt(e.target.value) || 0)) })}
                    className="w-24 px-3 py-2 border border-[#DCDAD3] text-center text-lg font-bold"
                  />
                  <span className="text-sm text-[#8A877D]">
                    Weighted score (not auto-calculated from attributes)
                  </span>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-[#0B0B0B] mb-3">Attribute Scores (0-100)</label>
                <div className="grid grid-cols-2 gap-3">
                  {ATTRIBUTES.map(attr => (
                    <div key={attr.id} className="flex items-center gap-2">
                      <span className="w-3 h-3" style={{ backgroundColor: attr.color }}></span>
                      <span className="text-sm text-[#8A877D] w-24">{attr.name}</span>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={manualEntry.scores[attr.id]}
                        onChange={(e) => setManualEntry({
                          ...manualEntry,
                          scores: { ...manualEntry.scores, [attr.id]: parseInt(e.target.value) || 0 }
                        })}
                        className="w-20 px-2 py-1 border border-[#DCDAD3] text-center"
                      />
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="bg-yellow-50 border border-yellow-200 p-3">
                <p className="text-sm text-yellow-800">
                  <strong>Note:</strong> Manual entries will be flagged as such in the results grid.
                </p>
              </div>
            </div>
            <div className="p-6 border-t border-[#DCDAD3] flex justify-end gap-3">
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
      <div className="bg-[#0B0B0B] max-w-lg w-full overflow-hidden animate-fade-in">
        <div className="bg-[#DEE42F] p-8 text-center">
          <Icon className="w-16 h-16 text-[#0B0B0B] mx-auto mb-4" />
          <h2 className="dc-h2 text-[#0B0B0B]">{currentStep.title}</h2>
        </div>
        
        <div className="p-6">
          <p className="text-[#B3B0A8] text-center mb-6">{currentStep.description}</p>
          
          {/* Progress dots */}
          <div className="flex justify-center gap-2 mb-6">
            {steps.map((_, i) => (
              <div 
                key={i} 
                className={`w-2 h-2 transition-colors ${i === step ? 'bg-[#DEE42F]' : 'bg-[#666666]'}`}
              />
            ))}
          </div>
          
          <div className="flex gap-3">
            {step > 0 && (
              <button 
                onClick={() => setStep(step - 1)} 
                className="flex-1 bg-transparent border border-[#E8FF00] text-[#E8FF00] font-semibold py-3 px-6 uppercase text-sm tracking-wide hover:bg-[#DEE42F] hover:text-[#0B0B0B] transition-colors"
              >
                Back
              </button>
            )}
            {step < steps.length - 1 ? (
              <button 
                onClick={() => setStep(step + 1)} 
                className="flex-1 bg-[#DEE42F] text-[#0B0B0B] font-semibold py-3 px-6 uppercase text-sm tracking-wide hover:bg-[#D4E800] transition-colors"
              >
                Next
              </button>
            ) : (
              <button 
                onClick={() => {
                  localStorage.setItem('conscious-compass-onboarded', 'true');
                  onComplete();
                }} 
                className="flex-1 bg-[#DEE42F] text-[#0B0B0B] font-semibold py-3 px-6 uppercase text-sm tracking-wide hover:bg-[#D4E800] transition-colors"
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
              className="w-full text-center text-sm text-[#8A877D] mt-4 hover:text-[#E8FF00] transition-colors"
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
function InsightsView({ results, industryBenchmarks, industries, isAdmin = false }) {
  const [aiInsights, setAiInsights] = useState(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [refreshedAt, setRefreshedAt] = useState(null);
  
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

  const loadInsights = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/insights-analysis');
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      const data = await res.json();
      if (data.stories?.length) {
        setAiInsights(data.stories);
        setRefreshedAt(data.refreshedAt ? new Date(data.refreshedAt) : null);
      } else {
        setError(data.error || 'No stories available yet — check back after the first weekly refresh, or ask an admin to force one.');
      }
    } catch (e) {
      setError(e.message || 'Failed to load stories.');
    } finally {
      setLoading(false);
    }
  };

  const forceRefreshInsights = async () => {
    setRefreshing(true);
    setError(null);
    try {
      const res = await fetch('/api/refresh-insights-analysis', { method: 'POST' });
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      const data = await res.json();
      if (data.success) {
        await loadInsights();
      } else {
        throw new Error(data.error || 'Refresh failed');
      }
    } catch (e) {
      setError(e.message || 'Refresh failed.');
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => { loadInsights(); }, []);


  if (!portfolioStats) {
    return (
      <div className="card p-12 text-center">
        <TrendingUp className="w-16 h-16 text-[#DCDAD3] mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-[#0B0B0B] mb-2">No Data for Insights</h3>
        <p className="text-[#8A877D]">Add some brand assessments to see portfolio insights.</p>
      </div>
    );
  }

  const maxCount = Math.max(...portfolioStats.scoreDistribution.map(d => d.count), 1);

  return (
    <div className="space-y-6">
      {/* Portfolio Overview Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card p-5 text-center">
          <div className="text-4xl font-bold text-[#0B0B0B] mb-1">{portfolioStats.totalBrands}</div>
          <div className="text-sm text-[#8A877D]">Brands Assessed</div>
        </div>
        <div className="card p-5 text-center">
          <div className="text-4xl font-bold mb-1" style={{ color: getMaturityStage(portfolioStats.avgScore).color }}>
            {portfolioStats.avgScore}
          </div>
          <div className="text-sm text-[#8A877D]">Portfolio Average</div>
        </div>
        <div className="card p-5 text-center">
          <div className="text-lg font-bold text-[#059669] mb-1 flex items-center justify-center gap-1">
            <TrendingUp className="w-5 h-5" />
            {ATTRIBUTES.find(a => a.id === portfolioStats.strongestAttr[0])?.name}
          </div>
          <div className="text-sm text-[#8A877D]">Strongest Area ({portfolioStats.strongestAttr[1]})</div>
        </div>
        <div className="card p-5 text-center">
          <div className="text-lg font-bold text-[#F59E0B] mb-1 flex items-center justify-center gap-1">
            <TrendingDown className="w-5 h-5" />
            {ATTRIBUTES.find(a => a.id === portfolioStats.weakestAttr[0])?.name}
          </div>
          <div className="text-sm text-[#8A877D]">Growth Opportunity ({portfolioStats.weakestAttr[1]})</div>
        </div>
      </div>

      {/* Score Distribution Visualization */}
      <div className="card p-6">
        <h3 className="text-sm font-medium text-[#0B0B0B] mb-3">Portfolio Maturity Distribution</h3>
        <div className="flex items-end gap-3 mb-4" style={{ height: '160px' }}>
          {portfolioStats.scoreDistribution.map((bucket, idx) => {
            const barHeight = bucket.count > 0 ? Math.max((bucket.count / maxCount) * 140, 16) : 8;
            return (
              <div key={idx} className="flex-1 flex flex-col items-center justify-end h-full">
                <div className="text-sm font-medium text-[#0B0B0B] mb-2">{bucket.count}</div>
                <div 
                  className="w-full -t-lg transition-all duration-500"
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
              <div className="text-xs text-[#8A877D]">{bucket.label}</div>
              <div className="text-[10px] text-[#B3B0A8]">{bucket.range}</div>
            </div>
          ))}
        </div>
      </div>

      {/* AI Insights Section */}
      <div className="card p-6">
        <div className="flex items-start justify-between mb-4 gap-4">
          <div>
            <h3 className="font-semibold text-[#0B0B0B] flex items-center gap-2">
              <Lightbulb className="w-5 h-5 text-[#E8FF00]" style={{filter: 'drop-shadow(0 0 2px #E8FF00)'}} /> Story Opportunities
            </h3>
            <p className="text-xs text-[#8A877D] mt-1">Thought leadership angles from your assessment data. Refreshes automatically every Sunday night.</p>
            {refreshedAt && (
              <p className="text-[10px] text-[#999] mt-1">
                Last updated {refreshedAt.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })} at {refreshedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            )}
          </div>
          {isAdmin && (
            <button
              onClick={forceRefreshInsights}
              disabled={refreshing || loading}
              className="flex-shrink-0 btn-primary flex items-center gap-2 text-sm"
            >
              {refreshing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              {refreshing ? 'Refreshing…' : 'Force Refresh'}
            </button>
          )}
        </div>

        {error && (
          <div className="p-4 bg-red-50 text-red-700 mb-4 text-sm">
            {error}
          </div>
        )}

        {loading && (
          <div className="text-center py-8 text-[#8A877D]">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3 text-[#DCDAD3]" />
            <p className="text-sm">Loading story opportunities…</p>
          </div>
        )}

        {!aiInsights && !loading && !error && (
          <div className="text-center py-8 text-[#8A877D]">
            <Lightbulb className="w-12 h-12 mx-auto mb-3 text-[#DCDAD3]" />
            <p className="text-sm">No stories available yet. They will appear here after the first Sunday night refresh.</p>
            {isAdmin && <p className="text-xs text-[#999] mt-2">As an admin, you can trigger it now using Force Refresh above.</p>}
          </div>
        )}

        {aiInsights && !loading && (
          <div className="space-y-4">
            {aiInsights.map((story, idx) => (
              <div key={idx} className="p-5 bg-[#0B0B0B] ">
                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 bg-[#DEE42F] text-[#0B0B0B] flex items-center justify-center flex-shrink-0 font-bold text-sm mt-0.5">
                    {idx + 1}
                  </div>
                  <div>
                    <div className="font-semibold text-white mb-2 leading-snug">{story.headline}</div>
                    <div className="text-sm text-[#B3B0A8] leading-relaxed">{story.body}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Landscape View — macro cross-assessment consciousness map
function LandscapeView({ results, industries, isAdmin = false }) {
  const [selectedYears, setSelectedYears] = useState(['all']);
  const [highlightSector, setHighlightSector] = useState(null);
  const [pinnedSector, setPinnedSector] = useState(null);
  const [showAllAvg, setShowAllAvg] = useState(false); // true = only dashed avg outline visible
  const [animProgress, setAnimProgress] = useState(0);
  const animKey = selectedYears.join('-');

  const [hoveredDot, setHoveredDot] = useState(null); // { attrId, sectorKey, name, score, color, pct }
  const [landscapeAI, setLandscapeAI] = useState(null);
  const [landscapeAILoading, setLandscapeAILoading] = useState(false);
  const [landscapeAIRefreshing, setLandscapeAIRefreshing] = useState(false);
  const [landscapeAIError, setLandscapeAIError] = useState(null);
  const [landscapeAIRefreshedAt, setLandscapeAIRefreshedAt] = useState(null);

  // Active sector = pinned takes priority over hover
  const activeSector = pinnedSector || highlightSector;

  const handleSectorClick = (key) => {
    setShowAllAvg(false);
    setPinnedSector(prev => prev === key ? null : key);
  };

  const handleAllAvgClick = () => {
    const next = !showAllAvg;
    setShowAllAvg(next);
    if (next) { setPinnedSector(null); setHighlightSector(null); }
  };

  // Re-animate whenever year filter changes
  useEffect(() => {
    setAnimProgress(0);
    const duration = 1800;
    const start = Date.now();
    const tick = () => {
      const elapsed = Date.now() - start;
      const raw = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - raw, 3);
      setAnimProgress(eased);
      if (raw < 1) requestAnimationFrame(tick);
    };
    const id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [animKey]);

  // Extract years from results
  const years = useMemo(() => {
    const ys = [...new Set(
      results.map(r => r.savedAt ? new Date(r.savedAt).getFullYear() : null).filter(Boolean)
    )].sort((a, b) => b - a);
    return ys;
  }, [results]);

  // Filter by selected years
  const filteredResults = useMemo(() => {
    if (selectedYears.includes('all')) return results;
    return results.filter(r => {
      const y = r.savedAt ? new Date(r.savedAt).getFullYear() : null;
      return y && selectedYears.includes(y);
    });
  }, [results, selectedYears]);

  // Group by industry/sector and compute averages
  const sectors = useMemo(() => {
    const grouped = {};
    filteredResults.forEach(r => {
      const key = r.industry || 'other';
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(r);
    });
    return Object.entries(grouped)
      .map(([key, brands], idx) => {
        const attrAvgs = {};
        ATTRIBUTES.forEach(attr => {
          attrAvgs[attr.id] = Math.round(
            brands.reduce((sum, b) => sum + (b.scores?.[attr.id] || 0), 0) / brands.length
          );
        });
        const avgScore = Math.round(brands.reduce((sum, b) => sum + b.totalScore, 0) / brands.length);
        const industryName = industries.find(i => i.id === key)?.name || key;
        return {
          key, name: industryName, count: brands.length, avgScore, attrAvgs,
          color: LANDSCAPE_SECTOR_COLORS[idx % LANDSCAPE_SECTOR_COLORS.length],
        };
      })
      .sort((a, b) => b.avgScore - a.avgScore);
  }, [filteredResults, industries]);

  // Overall average across all filtered results
  const overallAvg = useMemo(() => {
    if (!filteredResults.length) return {};
    const avgs = {};
    ATTRIBUTES.forEach(attr => {
      avgs[attr.id] = Math.round(
        filteredResults.reduce((sum, b) => sum + (b.scores?.[attr.id] || 0), 0) / filteredResults.length
      );
    });
    return avgs;
  }, [filteredResults]);

  const overallScore = filteredResults.length
    ? Math.round(filteredResults.reduce((s, b) => s + b.totalScore, 0) / filteredResults.length)
    : 0;

  // Octagon geometry (matches SpiderChart exactly)
  const RING_PATHS = [
    "M226 169.75L186.225 186.225L169.75 226L186.225 265.775L206.113 274.012L226 282.25L265.775 265.775L282.25 226L265.775 186.225L226 169.75Z",
    "M226 113.5L146.451 146.451L113.5 226L146.451 305.549L226 338.5L305.549 305.549L338.5 226L305.549 146.451L226 113.5Z",
    "M226 57.25L106.676 106.676L57.25 226L106.676 345.324L226 394.75L345.324 345.324L394.75 226L345.324 106.676L226 57.25Z",
    "M226 1L66.901 66.901L1 226L66.901 385.099L226 451L385.099 385.099L451 226L385.099 66.901L226 1Z",
  ];

  const getDataPoints = (attrAvgs, progress = 1) =>
    ATTRIBUTES.map((attr, i) => {
      const val = (attrAvgs[attr.id] || 0) * progress;
      const r = (val / 100) * 225;
      const angle = (i * 2 * Math.PI / ATTRIBUTES.length) - Math.PI / 2;
      return { x: 226 + r * Math.cos(angle), y: 226 + r * Math.sin(angle) };
    });

  const getLabelPos = (i) => {
    const angle = (i * 2 * Math.PI / ATTRIBUTES.length) - Math.PI / 2;
    const isCardinal = i % 2 === 0;
    const actualRadius = isCardinal ? 235 : 260;
    const x = 226 + actualRadius * Math.cos(angle);
    const y = 226 + actualRadius * Math.sin(angle);
    let textAnchor = 'middle', dy = '0';
    if (!isCardinal) {
      if (Math.cos(angle) < 0) return { x: x + 10, y, textAnchor: 'end', dy };
      if (Math.cos(angle) > 0) return { x: x - 10, y, textAnchor: 'start', dy };
    }
    if (Math.abs(Math.cos(angle)) > 0.85) textAnchor = Math.cos(angle) > 0 ? 'start' : 'end';
    if (Math.abs(Math.sin(angle)) > 0.85) dy = Math.sin(angle) > 0 ? '1em' : '-0.5em';
    return { x, y, textAnchor, dy };
  };

  // Attribute landscape data (range + distribution per attribute)
  const attrLandscapeData = useMemo(() =>
    ATTRIBUTES.map(attr => {
      const sectorScores = sectors.map(s => ({ key: s.key, name: s.name, score: s.attrAvgs[attr.id] || 0, color: s.color }));
      const vals = sectorScores.map(s => s.score);
      return {
        attr,
        sectorScores,
        min: vals.length ? Math.min(...vals) : 0,
        max: vals.length ? Math.max(...vals) : 0,
        mean: overallAvg[attr.id] || 0,
      };
    }),
  [sectors, overallAvg]);

  const loadLandscapeAI = async () => {
    setLandscapeAILoading(true);
    setLandscapeAIError(null);
    try {
      const res = await fetch('/api/landscape-analysis');
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      const data = await res.json();
      if (data.analysis) {
        setLandscapeAI(data.analysis);
        setLandscapeAIRefreshedAt(data.refreshedAt ? new Date(data.refreshedAt) : null);
      } else {
        setLandscapeAIError(data.error || 'No analysis available yet — check back after the first weekly refresh, or ask an admin to force one.');
      }
    } catch (e) {
      setLandscapeAIError(e.message || 'Failed to load analysis.');
    } finally {
      setLandscapeAILoading(false);
    }
  };

  const forceRefreshLandscapeAI = async () => {
    setLandscapeAIRefreshing(true);
    setLandscapeAIError(null);
    try {
      const res = await fetch('/api/refresh-landscape-analysis', { method: 'POST' });
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      const data = await res.json();
      if (data.success) {
        await loadLandscapeAI();
      } else {
        throw new Error(data.error || 'Refresh failed');
      }
    } catch (e) {
      setLandscapeAIError(e.message || 'Refresh failed.');
    } finally {
      setLandscapeAIRefreshing(false);
    }
  };

  useEffect(() => { loadLandscapeAI(); }, []);


  if (!results.length) {
    return (
      <div className="card p-12 text-center">
        <div className="text-4xl mb-4">🌐</div>
        <h3 className="text-xl font-semibold text-[#0B0B0B] mb-2">No Landscape Data Yet</h3>
        <p className="text-[#8A877D]">Complete assessments across multiple sectors to see the consciousness landscape.</p>
      </div>
    );
  }

  const toggleYear = (y) => {
    if (y === 'all') { setSelectedYears(['all']); return; }
    const withoutAll = selectedYears.filter(x => x !== 'all');
    if (withoutAll.includes(y)) {
      const next = withoutAll.filter(x => x !== y);
      setSelectedYears(next.length ? next : ['all']);
    } else {
      setSelectedYears([...withoutAll, y]);
    }
  };

  return (
    <div className="space-y-6">

      {/* Controls row */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold text-[#8A877D] uppercase tracking-wide">Year:</span>
          {['all', ...years].map(y => (
            <button
              key={y}
              onClick={() => toggleYear(y)}
              className={`px-3 py-1 text-xs font-medium transition-colors ${
                (y === 'all' && selectedYears.includes('all')) || (!selectedYears.includes('all') && selectedYears.includes(y))
                  ? 'bg-[#0B0B0B] text-white'
                  : 'bg-white border border-[#DCDAD3] text-[#8A877D] hover:border-[#0B0B0B]'
              }`}
            >
              {y === 'all' ? 'All time' : y}
            </button>
          ))}
        </div>
        <div className="flex gap-4 text-xs text-[#8A877D]">
          <span><strong className="text-[#0B0B0B]">{filteredResults.length}</strong> assessments</span>
          <span><strong className="text-[#0B0B0B]">{sectors.length}</strong> sectors</span>
        </div>
      </div>

      {/* Summary tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Landscape avg', value: overallScore, color: getMaturityStage(overallScore).color },
          { label: 'Strongest sector', value: sectors[0]?.name?.split(' ')[0] || '—', sub: sectors[0]?.avgScore, color: sectors[0]?.color },
          { label: 'Needs attention', value: sectors[sectors.length - 1]?.name?.split(' ')[0] || '—', sub: sectors[sectors.length - 1]?.avgScore, color: '#999' },
          {
            label: 'Top attribute',
            value: attrLandscapeData.slice().sort((a, b) => b.mean - a.mean)[0]?.attr.name || '—',
            sub: attrLandscapeData.slice().sort((a, b) => b.mean - a.mean)[0]?.mean,
            color: '#CFD32F',
          },
        ].map((tile, i) => (
          <div key={i} className="bg-white border border-[#DCDAD3] p-4 ">
            <div className="text-[10px] font-semibold text-[#999] uppercase tracking-wide mb-1">{tile.label}</div>
            <div className="font-bold text-lg text-[#0B0B0B] truncate" style={{ color: tile.color }}>{tile.value}</div>
            {tile.sub !== undefined && <div className="text-xs text-[#8A877D]">avg {tile.sub}</div>}
          </div>
        ))}
      </div>

      {/* Hero: Landscape Octagon + Sector Legend */}
      <div className="bg-white border border-[#DCDAD3] p-6">
        <div className="mb-5">
          <h3 className="font-semibold text-[#0B0B0B]">Consciousness Landscape</h3>
          <p className="text-xs text-[#8A877D] mt-1">
            Each sector's average brand consciousness — hover a sector to isolate. Dashed yellow = cross-sector mean.
          </p>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-[480px_1fr] gap-8 items-start">

          {/* Octagon — fixed width, left aligned */}
          <div style={{ width: '100%', aspectRatio: '1/1', position: 'relative', backgroundColor: '#efede9' }}>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="-100 -50 652 552" style={{ width: '100%', height: '100%' }}>

              {/* Background rings — alternating fill, matching SpiderChart */}
              {[...RING_PATHS].reverse().map((path, i) => (
                <path key={`ring-${i}`} d={path} fill={i % 2 === 0 ? '#e1dfda' : '#f7f6f4'} stroke="none" />
              ))}

              {/* Sector polygons — drawn dimmed unless hovered */}
              {sectors.map((sector) => {
                const pts = getDataPoints(sector.attrAvgs, animProgress);
                const pStr = pts.map(p => `${p.x},${p.y}`).join(' ');
                const isHL = activeSector === sector.key;
                const isDim = (activeSector && !isHL) || showAllAvg;
                const isPinned = pinnedSector === sector.key;
                return (
                  <polygon
                    key={sector.key}
                    points={pStr}
                    fill={sector.color + (isDim ? '00' : '20')}
                    stroke={sector.color}
                    strokeWidth={isHL ? 3 : 1.5}
                    strokeOpacity={isDim ? 0 : 0.85}
                    style={{ cursor: 'pointer' }}
                    onClick={() => handleSectorClick(sector.key)}
                    onMouseEnter={() => !pinnedSector && !showAllAvg && setHighlightSector(sector.key)}
                    onMouseLeave={() => !pinnedSector && setHighlightSector(null)}
                  >
                    {isPinned && <title>Click to unpin</title>}
                  </polygon>
                );
              })}

              {/* Overall average — dashed yellow outline */}
              {(() => {
                const pts = getDataPoints(overallAvg, animProgress);
                const pStr = pts.map(p => `${p.x},${p.y}`).join(' ');
                return (
                  <polygon
                    points={pStr}
                    fill={showAllAvg ? 'rgba(207,211,47,0.12)' : 'none'}
                    stroke="#CFD32F"
                    strokeWidth={showAllAvg ? 3 : 2.5}
                    strokeDasharray="7 4"
                    opacity={showAllAvg ? 1 : (activeSector ? 0.35 : 1)}
                  />
                );
              })()}

              {/* Ring outlines */}
              {RING_PATHS.map((path, i) => (
                <path key={`outline-${i}`} d={path} stroke="#111720"
                  strokeWidth={i === 3 ? 1.5 : 0.8} fill="none"
                  strokeOpacity={i === 3 ? 0.25 : 0.12} />
              ))}

              {/* Axis spokes */}
              {ATTRIBUTES.map((_, i) => {
                const angle = (i * 2 * Math.PI / ATTRIBUTES.length) - Math.PI / 2;
                return (
                  <line key={`axis-${i}`} x1="226" y1="226"
                    x2={226 + 225 * Math.cos(angle)} y2={226 + 225 * Math.sin(angle)}
                    stroke="#111720" strokeOpacity="0.08" strokeWidth="1.5" />
                );
              })}

              {/* Ring value labels */}
              {[25, 50, 75].map((pct, i) => (
                <text key={`pctlbl-${i}`}
                  x={226} y={226 - (pct / 100) * 225 - 5}
                  textAnchor="middle"
                  style={{ fontSize: '9px', fill: '#999', fontFamily: 'Inter, sans-serif' }}>
                  {pct}
                </text>
              ))}

              {/* Attribute labels — always visible */}
              {ATTRIBUTES.map((attr, i) => {
                const pos = getLabelPos(i);
                return (
                  <text key={`lbl-${i}`} x={pos.x} y={pos.y}
                    textAnchor={pos.textAnchor} dy={pos.dy} fill="#111720"
                    style={{ fontSize: '15px', fontWeight: '500', fontFamily: 'Inter, sans-serif' }}>
                    {attr.name}
                  </text>
                );
              })}

              {/* Overall avg score labels */}
              {ATTRIBUTES.map((attr, i) => {
                const angle = (i * 2 * Math.PI / ATTRIBUTES.length) - Math.PI / 2;
                const r = ((overallAvg[attr.id] || 0) * animProgress / 100) * 225;
                const x = 226 + r * Math.cos(angle);
                const y = 226 + r * Math.sin(angle);
                return (
                  <text key={`avg-${i}`}
                    x={x + 16 * Math.cos(angle)} y={y + 16 * Math.sin(angle)}
                    textAnchor="middle" dominantBaseline="middle"
                    style={{ fontSize: '11px', fontWeight: '700', fill: '#6B6B00',
                      opacity: animProgress, fontFamily: 'Inter, sans-serif' }}>
                    {overallAvg[attr.id] || 0}
                  </text>
                );
              })}

              {/* Highlighted sector label overlay */}
              {activeSector && (() => {
                const sector = sectors.find(s => s.key === activeSector);
                if (!sector) return null;
                const isPinned = pinnedSector === activeSector;
                return (
                  <>
                    <circle cx="226" cy="226" r="40" fill={sector.color}
                      style={{ cursor: 'pointer' }} onClick={() => handleSectorClick(sector.key)} />
                    <text x="226" y="218" textAnchor="middle" dominantBaseline="middle"
                      style={{ fontSize: '22px', fontWeight: '700', fill: '#fff', fontFamily: 'Inter, sans-serif', pointerEvents: 'none' }}>
                      {sector.avgScore}
                    </text>
                    <text x="226" y="236" textAnchor="middle"
                      style={{ fontSize: '7.5px', fontWeight: '600', fill: 'rgba(255,255,255,0.8)', fontFamily: 'Inter, sans-serif', pointerEvents: 'none' }}>
                      {sector.name.slice(0, 12).toUpperCase()}
                    </text>
                    {isPinned && (
                      <text x="226" y="248" textAnchor="middle"
                        style={{ fontSize: '6.5px', fill: 'rgba(255,255,255,0.55)', fontFamily: 'Inter, sans-serif', pointerEvents: 'none' }}>
                        ● PINNED
                      </text>
                    )}
                  </>
                );
              })()}

              {/* Default centre */}
              {!activeSector && (
                <>
                  <circle cx="226" cy="226" r="38" fill="#CFD32F" />
                  <text x="226" y="219" textAnchor="middle" dominantBaseline="middle"
                    style={{ fontSize: '26px', fontWeight: '700', fill: '#111720', fontFamily: 'Inter, sans-serif' }}>
                    {overallScore}
                  </text>
                  <text x="226" y="237" textAnchor="middle"
                    style={{ fontSize: '8px', fontWeight: '500', fill: '#666', fontFamily: 'Inter, sans-serif' }}>
                    MEAN
                  </text>
                </>
              )}
            </svg>
          </div>

          {/* Sector legend */}
          <div className="space-y-1.5">
            <div className="text-[10px] font-semibold text-[#999] uppercase tracking-wider mb-3">Sectors</div>

            {/* Overall avg legend entry */}
            <div
              className={`flex items-center gap-3 px-3 py-2.5  cursor-pointer select-none transition-all ${
                showAllAvg ? 'ring-1 ring-[#DCDAD3] bg-[#FFFEF0]' : 'bg-[#FFFFFF] hover:bg-[#F2F0EA]'
              }`}
              onClick={handleAllAvgClick}
            >
              <svg width="20" height="10" className="flex-shrink-0"><line x1="0" y1="5" x2="20" y2="5" stroke="#CFD32F" strokeWidth="2.5" strokeDasharray="5 3"/></svg>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-[#0B0B0B]">All sectors avg</div>
                <div className="text-xs text-[#666]">{filteredResults.length} brands</div>
              </div>
              <span className="text-xl font-bold text-[#6B6B00] tabular-nums">{overallScore}</span>
            </div>

            {sectors.map(sector => {
              const stage = getMaturityStage(sector.avgScore);
              const isActive = activeSector === sector.key;
              const isPinned = pinnedSector === sector.key;
              return (
                <div
                  key={sector.key}
                  className={`flex items-center gap-3 px-3 py-2.5  cursor-pointer transition-all select-none ${
                    isActive ? 'ring-1 ring-[#DCDAD3]' : 'hover:bg-[#FFFFFF]'
                  }`}
                  style={{ backgroundColor: isActive ? sector.color + '15' : '' }}
                  onClick={() => handleSectorClick(sector.key)}
                  onMouseEnter={() => !pinnedSector && !showAllAvg && setHighlightSector(sector.key)}
                  onMouseLeave={() => !pinnedSector && setHighlightSector(null)}
                >
                  <div className="w-3 h-3 flex-shrink-0" style={{ backgroundColor: sector.color }} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-[#0B0B0B] leading-tight">{sector.name}</div>
                    <div className="text-xs text-[#666]">{sector.count}b{isPinned ? ' · pinned' : ''}</div>
                  </div>
                  <span className="text-xl font-bold tabular-nums" style={{ color: stage.color }}>{sector.avgScore}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Attribute Landscape — dot range chart */}
      <div className="bg-white border border-[#DCDAD3] p-6">
        <div className="mb-5">
          <h3 className="font-semibold text-[#0B0B0B]">Attribute Landscape</h3>
          <p className="text-xs text-[#8A877D] mt-1">
            Where each sector scores on every attribute — see the legend below to read the chart.
          </p>
        </div>

        <div className="space-y-3.5">
          {attrLandscapeData.map(({ attr, sectorScores, min, max, mean }) => (
            <div key={attr.id} className="grid items-center gap-3"
              style={{ gridTemplateColumns: '96px 1fr 36px' }}>
              <div className="text-xs font-semibold text-[#0B0B0B] text-right leading-tight pr-1">{attr.name}</div>
              <div className="relative h-9 flex items-center" style={{ overflow: 'visible' }}>
                {/* Background track */}
                <div className="absolute left-0 right-0 h-0.5 bg-[#ECEAE6]" />
                {/* Stage markers */}
                {[25, 40, 56, 70, 85].map(mark => (
                  <div key={mark} className="absolute w-px h-3 bg-[#DCDAD3]"
                    style={{ left: `${mark}%`, transform: 'translateX(-50%)' }} />
                ))}
                {/* Range fill */}
                {sectorScores.length > 1 && (
                  <div className="absolute h-1.5"
                    style={{ left: `${min}%`, width: `${Math.max(max - min, 0.5)}%`, backgroundColor: 'rgba(229,57,53,0.18)' }} />
                )}
                {/* Mean line */}
                <div className="absolute w-0.5 h-6 bg-[#CFD32F] z-10"
                  style={{ left: `${mean}%`, transform: 'translateX(-50%)' }} />
                {/* Sector dots */}
                {sectorScores.map((s, si) => {
                  const isHovered = hoveredDot?.attrId === attr.id && hoveredDot?.sectorKey === s.key;
                  return (
                    <div key={si}
                      className="absolute z-20"
                      style={{ left: `${s.score}%`, top: '50%', transform: 'translate(-50%, -50%)' }}
                      onMouseEnter={() => setHoveredDot({ attrId: attr.id, sectorKey: s.key, name: s.name, score: s.score, color: s.color, pct: s.score })}
                      onMouseLeave={() => setHoveredDot(null)}
                    >
                      {/* Tooltip */}
                      {isHovered && (
                        <div className="absolute z-30 pointer-events-none"
                          style={{
                            bottom: 'calc(100% + 8px)',
                            left: '50%',
                            transform: 'translateX(-50%)',
                            whiteSpace: 'nowrap',
                          }}>
                          <div className="flex items-center gap-1.5 px-2.5 py-1.5 text-white text-xs font-semibold"
                            style={{ backgroundColor: s.color }}>
                            <div className="w-1.5 h-1.5 bg-white opacity-70 flex-shrink-0" />
                            {s.name}
                            <span className="ml-1 font-bold opacity-90">{s.score}</span>
                          </div>
                          {/* Arrow */}
                          <div className="mx-auto w-0 h-0"
                            style={{
                              borderLeft: '5px solid transparent',
                              borderRight: '5px solid transparent',
                              borderTop: `5px solid ${s.color}`,
                              width: 0,
                            }} />
                        </div>
                      )}
                      {/* Dot */}
                      <div
                        className="w-3 h-3 ring-2 ring-white transition-transform"
                        style={{
                          backgroundColor: s.color,
                          cursor: 'pointer',
                          transform: isHovered ? 'scale(1.6)' : 'scale(1)',
                          boxShadow: activeSector === s.key ? `0 0 0 2px ${s.color}` : 'none',
                        }}
                      />
                    </div>
                  );
                })}
              </div>
              <div className="text-xs font-bold text-[#0B0B0B] tabular-nums">{mean}</div>
            </div>
          ))}

          {/* Scale */}
          <div className="grid items-center gap-3 mt-1" style={{ gridTemplateColumns: '96px 1fr 36px' }}>
            <div />
            <div className="flex justify-between text-[10px] text-[#BBB] select-none">
              {['0', '25', '50', '75', '100'].map(v => <span key={v}>{v}</span>)}
            </div>
            <div />
          </div>

          {/* Legend */}
          <div className="mt-5 pt-4 border-t border-[#DCDAD3]">
            <div className="text-[10px] font-semibold text-[#999] uppercase tracking-wider mb-3">How to read this chart</div>
            <div className="flex flex-col sm:flex-row gap-4">
              {/* Visual example */}
              <div className="flex-shrink-0 flex items-center" style={{ width: 220 }}>
                <svg width="220" height="44" viewBox="0 0 220 44">
                  {/* track */}
                  <line x1="10" y1="22" x2="210" y2="22" stroke="#ECEAE6" strokeWidth="2" strokeLinecap="round" />
                  {/* range bar */}
                  <rect x="60" y="18" width="100" height="8" rx="4" fill="rgba(229,57,53,0.18)" />
                  {/* mean line */}
                  <line x1="120" y1="10" x2="120" y2="34" stroke="#CFD32F" strokeWidth="2.5" strokeLinecap="round" />
                  {/* sector dot A */}
                  <circle cx="70" cy="22" r="6" fill="#E53935" stroke="white" strokeWidth="2" />
                  {/* sector dot B */}
                  <circle cx="110" cy="22" r="6" fill="#1976D2" stroke="white" strokeWidth="2" />
                  {/* sector dot C */}
                  <circle cx="155" cy="22" r="6" fill="#388E3C" stroke="white" strokeWidth="2" />
                  {/* annotations */}
                  <text x="120" y="8" textAnchor="middle" style={{ fontSize: '8px', fill: '#6B6B00', fontFamily: 'Inter, sans-serif', fontWeight: 700 }}>avg</text>
                  <text x="70" y="38" textAnchor="middle" style={{ fontSize: '7.5px', fill: '#E53935', fontFamily: 'Inter, sans-serif' }}>sector</text>
                  <text x="110" y="38" textAnchor="middle" style={{ fontSize: '7.5px', fill: '#1976D2', fontFamily: 'Inter, sans-serif' }}>sector</text>
                  <text x="155" y="38" textAnchor="middle" style={{ fontSize: '7.5px', fill: '#388E3C', fontFamily: 'Inter, sans-serif' }}>sector</text>
                </svg>
              </div>
              {/* Text explanations */}
              <div className="flex flex-col gap-2 justify-center text-xs text-[#8A877D]">
                <div className="flex items-start gap-2">
                  <div className="flex-shrink-0 mt-0.5 w-3 h-3 bg-[#DEE42F] ring-2 ring-white" style={{ minWidth: 12 }} />
                  <span><strong className="text-[#0B0B0B]">Coloured dots</strong> — each dot is one sector's average score for this attribute. Hover the octagon or cards above to match colours to sectors.</span>
                </div>
                <div className="flex items-start gap-2">
                  <div className="flex-shrink-0 mt-1" style={{ width: 12 }}>
                    <div className="w-0.5 h-4 bg-[#CFD32F] mx-auto" />
                  </div>
                  <span><strong className="text-[#0B0B0B]">Yellow line</strong> — the overall mean score across all sectors for that attribute. The number on the right is this value.</span>
                </div>
                <div className="flex items-start gap-2">
                <div className="flex-shrink-0 mt-1.5 w-7 h-2" style={{ minWidth: 28, backgroundColor: 'rgba(229,57,53,0.18)' }} />
                  <span><strong className="text-[#0B0B0B]">Light red band</strong> — spans from the lowest to highest sector score, showing how spread out performance is across sectors.</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Sector Attribute Spread — rows = sectors, tracks = attributes */}
      <div className="bg-white border border-[#DCDAD3] p-6">
        <div className="mb-5">
          <h3 className="font-semibold text-[#0B0B0B]">Sector Attribute Spread</h3>
          <p className="text-xs text-[#8A877D] mt-1">
            Each sector's score across all eight attributes. Each dot is one attribute score — yellow line = that sector's overall average.
          </p>
        </div>

        <div className="space-y-3.5">
          {sectors.map((sector) => {
            const attrScores = ATTRIBUTES.map(attr => ({
              key: attr.id,
              name: attr.name,
              score: sector.attrAvgs[attr.id] || 0,
              color: sector.color,
            }));
            const vals = attrScores.map(a => a.score);
            const sMin = Math.min(...vals);
            const sMax = Math.max(...vals);
            const sAvg = sector.avgScore;
            const isActive = activeSector === sector.key;

            return (
              <div key={sector.key}
                className={`grid items-center gap-3  px-2 py-1 -mx-2 cursor-pointer transition-colors ${
                  isActive ? 'bg-[#F2F0EA]' : 'hover:bg-[#FFFFFF]'
                }`}
                style={{ gridTemplateColumns: '140px 1fr 36px' }}
                onClick={() => handleSectorClick(sector.key)}
                onMouseEnter={() => !pinnedSector && !showAllAvg && setHighlightSector(sector.key)}
                onMouseLeave={() => !pinnedSector && setHighlightSector(null)}
              >
                {/* Sector label */}
                <div className="flex items-center gap-2 pr-1">
                  <div className="w-2 h-2 flex-shrink-0" style={{ backgroundColor: sector.color }} />
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-[#0B0B0B] truncate leading-tight">{sector.name}</div>
                    <div className="text-[10px] text-[#666]">{sector.count}b</div>
                  </div>
                </div>

                {/* Track */}
                <div className="relative h-9 flex items-center" style={{ overflow: 'visible' }}>
                  {/* Background track */}
                  <div className="absolute left-0 right-0 h-0.5 bg-[#ECEAE6]" />
                  {/* Stage markers */}
                  {[25, 40, 56, 70, 85].map(mark => (
                    <div key={mark} className="absolute w-px h-3 bg-[#DCDAD3]"
                      style={{ left: `${mark}%`, transform: 'translateX(-50%)' }} />
                  ))}
                  {/* Range fill */}
                  <div className="absolute h-1.5"
                    style={{ left: `${sMin}%`, width: `${Math.max(sMax - sMin, 0.5)}%`, backgroundColor: sector.color + '30' }} />
                  {/* Sector avg line */}
                  <div className="absolute w-0.5 h-6 z-10"
                    style={{ left: `${sAvg}%`, transform: 'translateX(-50%)', backgroundColor: sector.color }} />
                  {/* Attribute dots */}
                  {attrScores.map((a) => {
                    const isHovered = hoveredDot?.attrId === sector.key && hoveredDot?.sectorKey === a.key;
                    return (
                      <div key={a.key}
                        className="absolute z-20"
                        style={{ left: `${a.score}%`, top: '50%', transform: 'translate(-50%, -50%)' }}
                        onMouseEnter={(e) => { e.stopPropagation(); setHoveredDot({ attrId: sector.key, sectorKey: a.key, name: a.name, score: a.score, color: sector.color }); }}
                        onMouseLeave={() => setHoveredDot(null)}
                      >
                        {/* Tooltip */}
                        {isHovered && (
                          <div className="absolute z-30 pointer-events-none"
                            style={{ bottom: 'calc(100% + 8px)', left: '50%', transform: 'translateX(-50%)', whiteSpace: 'nowrap' }}>
                            <div className="flex items-center gap-1.5 px-2.5 py-1.5 text-white text-xs font-semibold"
                              style={{ backgroundColor: sector.color }}>
                              <div className="w-1.5 h-1.5 bg-white opacity-70 flex-shrink-0" />
                              {a.name}
                              <span className="ml-1 font-bold opacity-90">{a.score}</span>
                            </div>
                            <div className="mx-auto w-0 h-0"
                              style={{ borderLeft: '5px solid transparent', borderRight: '5px solid transparent', borderTop: `5px solid ${sector.color}`, width: 0 }} />
                          </div>
                        )}
                        {/* Dot */}
                        <div
                          className="w-2.5 h-2.5 ring-2 ring-white transition-transform"
                          style={{
                            backgroundColor: sector.color,
                            transform: isHovered ? 'scale(1.7)' : 'scale(1)',
                            cursor: 'pointer',
                          }}
                        />
                      </div>
                    );
                  })}
                </div>

                {/* Avg score */}
                <div className="text-xs font-bold tabular-nums" style={{ color: sector.color }}>{sAvg}</div>
              </div>
            );
          })}

          {/* Scale */}
          <div className="grid items-center gap-3 mt-1" style={{ gridTemplateColumns: '140px 1fr 36px' }}>
            <div />
            <div className="flex justify-between text-[10px] text-[#BBB] select-none">
              {['0', '25', '50', '75', '100'].map(v => <span key={v}>{v}</span>)}
            </div>
            <div />
          </div>

          {/* Legend */}
          <div className="mt-5 pt-4 border-t border-[#DCDAD3]">
            <div className="text-[10px] font-semibold text-[#999] uppercase tracking-wider mb-3">How to read this chart</div>
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-shrink-0 flex items-center" style={{ width: 220 }}>
                <svg width="220" height="44" viewBox="0 0 220 44">
                  <line x1="10" y1="22" x2="210" y2="22" stroke="#ECEAE6" strokeWidth="2" strokeLinecap="round" />
                  <rect x="50" y="18" width="110" height="8" rx="4" fill="rgba(229,57,53,0.18)" />
                  <line x1="115" y1="10" x2="115" y2="34" stroke="#E53935" strokeWidth="2.5" strokeLinecap="round" />
                  <circle cx="60" cy="22" r="5" fill="#E53935" stroke="white" strokeWidth="2" />
                  <circle cx="95" cy="22" r="5" fill="#E53935" stroke="white" strokeWidth="2" />
                  <circle cx="130" cy="22" r="5" fill="#E53935" stroke="white" strokeWidth="2" />
                  <circle cx="155" cy="22" r="5" fill="#E53935" stroke="white" strokeWidth="2" />
                  <text x="115" y="8" textAnchor="middle" style={{ fontSize: '8px', fill: '#E53935', fontFamily: 'Inter, sans-serif', fontWeight: 700 }}>avg</text>
                  <text x="60" y="38" textAnchor="middle" style={{ fontSize: '7.5px', fill: '#666', fontFamily: 'Inter, sans-serif' }}>attr</text>
                  <text x="95" y="38" textAnchor="middle" style={{ fontSize: '7.5px', fill: '#666', fontFamily: 'Inter, sans-serif' }}>attr</text>
                  <text x="130" y="38" textAnchor="middle" style={{ fontSize: '7.5px', fill: '#666', fontFamily: 'Inter, sans-serif' }}>attr</text>
                  <text x="155" y="38" textAnchor="middle" style={{ fontSize: '7.5px', fill: '#666', fontFamily: 'Inter, sans-serif' }}>attr</text>
                </svg>
              </div>
              <div className="flex flex-col gap-2 justify-center text-xs text-[#8A877D]">
                <div className="flex items-start gap-2">
                  <div className="flex-shrink-0 mt-0.5 w-2.5 h-2.5 bg-[#DEE42F] ring-2 ring-white" style={{ minWidth: 10 }} />
                  <span><strong className="text-[#0B0B0B]">Coloured dots</strong> — each dot is one attribute score for that sector. Hover to see the attribute name and score.</span>
                </div>
                <div className="flex items-start gap-2">
                  <div className="flex-shrink-0 mt-1" style={{ width: 12 }}>
                    <div className="w-0.5 h-4 mx-auto" style={{ backgroundColor: '#E53935' }} />
                  </div>
                  <span><strong className="text-[#0B0B0B]">Coloured line</strong> — the sector's overall average score across all eight attributes. The number on the right is this value.</span>
                </div>
                <div className="flex items-start gap-2">
                  <div className="flex-shrink-0 mt-1.5 w-7 h-2" style={{ minWidth: 28, backgroundColor: 'rgba(229,57,53,0.18)' }} />
                  <span><strong className="text-[#0B0B0B]">Light band</strong> — spans from the lowest to highest attribute score for that sector, showing how consistent or varied the sector is.</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Sector profile cards */}
      <div>
        <h3 className="font-semibold text-[#0B0B0B] mb-4">Sector Profiles</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {sectors.map((sector) => {
            const sorted = ATTRIBUTES
              .map(a => ({ ...a, score: sector.attrAvgs[a.id] || 0 }))
              .sort((a, b) => b.score - a.score);
            const top2 = sorted.slice(0, 2);
            const bot2 = sorted.slice(-2).reverse();
            const stage = getMaturityStage(sector.avgScore);
            return (
              <div key={sector.key}
                className={`bg-white border  p-5 transition-all cursor-pointer select-none ${
                  activeSector === sector.key ? 'border-[#0B0B0B] ' : 'border-[#DCDAD3]'
                }`}
                onClick={() => handleSectorClick(sector.key)}
                onMouseEnter={() => !pinnedSector && !showAllAvg && setHighlightSector(sector.key)}
                onMouseLeave={() => !pinnedSector && setHighlightSector(null)}
              >
                {/* Header */}
                <div className="flex items-start gap-3 mb-4">
                  <div className="w-1.5 self-stretch" style={{ backgroundColor: sector.color }} />
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-[#0B0B0B] text-sm leading-tight">{sector.name}</div>
                    <div className="text-[10px] text-[#666] mt-0.5">{sector.count} brand{sector.count !== 1 ? 's' : ''} · {stage.name}</div>
                  </div>
                  <div className="text-2xl font-bold tabular-nums" style={{ color: sector.color }}>{sector.avgScore}</div>
                </div>

                {/* 8-attribute mini grid */}
                <div className="grid grid-cols-4 gap-1 mb-4">
                  {ATTRIBUTES.map(attr => {
                    const score = sector.attrAvgs[attr.id] || 0;
                    const isTop = top2.some(t => t.id === attr.id);
                    const isBot = bot2.some(t => t.id === attr.id);
                    return (
                      <div key={attr.id}
                        className={`p-1.5 text-center ${isTop ? 'bg-[#0B0B0B]' : isBot ? 'bg-[#F2F0EA]' : 'bg-[#FFFFFF]'}`}>
                        <div className={`text-[9px] font-semibold leading-none mb-0.5 ${isTop ? 'text-[#E2E65A]' : 'text-[#999]'}`}>
                          {attr.name.slice(0, 3).toUpperCase()}
                        </div>
                        <div className={`text-sm font-bold leading-none tabular-nums ${isTop ? 'text-white' : isBot ? 'text-[#BBB]' : 'text-[#0B0B0B]'}`}>
                          {score}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Strengths / Gaps */}
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <div className="text-[10px] font-semibold text-[#999] uppercase tracking-wide mb-1.5">Strongest</div>
                    {top2.map(a => (
                      <div key={a.id} className="flex items-center justify-between">
                        <span className="text-[#0B0B0B] font-medium">{a.name}</span>
                        <span className="font-bold tabular-nums text-[#0B0B0B]">{a.score}</span>
                      </div>
                    ))}
                  </div>
                  <div>
                    <div className="text-[10px] font-semibold text-[#999] uppercase tracking-wide mb-1.5">Weakest</div>
                    {bot2.map(a => (
                      <div key={a.id} className="flex items-center justify-between">
                        <span className="text-[#999] font-medium">{a.name}</span>
                        <span className="font-bold tabular-nums text-[#999]">{a.score}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* AI Landscape Analysis */}
      <div className="bg-[#0B0B0B] p-6">
        <div className="flex items-start justify-between gap-4 mb-2">
          <div>
            <h3 className="font-semibold text-white">Landscape Analysis</h3>
            <p className="text-xs text-[#B3B0A8] mt-1">
              AI-powered read of industry averages, attribute spread, sector strengths and gaps, and what it all means.
              Refreshes automatically every Sunday night.
            </p>
            {landscapeAIRefreshedAt && (
              <p className="text-[10px] mt-1" style={{ color: '#6B7280' }}>
                Last updated {landscapeAIRefreshedAt.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })} at {landscapeAIRefreshedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            )}
          </div>
          {isAdmin && (
            <button
              onClick={forceRefreshLandscapeAI}
              disabled={landscapeAIRefreshing || landscapeAILoading}
              className="flex-shrink-0 flex items-center gap-2 px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ backgroundColor: '#E8FF00', color: '#0B0B0B' }}
            >
              {landscapeAIRefreshing ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Refreshing…</>
              ) : (
                <><RefreshCw className="w-4 h-4" /> Force Refresh</>
              )}
            </button>
          )}
        </div>

        {landscapeAIError && (
          <div className="mt-4 p-4 text-sm" style={{ backgroundColor: 'rgba(220,38,38,0.15)', border: '1px solid rgba(220,38,38,0.3)', color: '#FCA5A5' }}>
            {landscapeAIError}
          </div>
        )}

        {landscapeAILoading && (
          <div className="mt-6 text-center py-8">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3" style={{ color: '#E8FF00' }} />
            <p className="text-sm text-[#666]">Loading analysis…</p>
          </div>
        )}

        {!landscapeAI && !landscapeAILoading && !landscapeAIError && (
          <div className="mt-6 text-center py-8 border border-dashed border-[#333] ">
            <Sparkles className="w-8 h-8 text-[#444] mx-auto mb-3" />
            <p className="text-sm text-[#666]">No analysis available yet. It will appear here after the first Sunday night refresh.</p>
            {isAdmin && <p className="text-xs text-[#555] mt-2">As an admin, you can trigger it now using Force Refresh above.</p>}
          </div>
        )}

        {landscapeAI && !landscapeAILoading && (
          <div className="mt-5 space-y-4">
            <div className="p-4 " style={{ backgroundColor: 'rgba(232,255,0,0.08)', border: '1px solid rgba(232,255,0,0.2)' }}>
              <div className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: '#E8FF00' }}>Landscape Summary</div>
              {landscapeAI.headline && (
                <p className="font-bold leading-snug mb-2" style={{ color: '#FFFFFF', fontSize: '1.05rem' }}>{landscapeAI.headline}</p>
              )}
              <p className="text-sm leading-relaxed" style={{ color: '#DCDAD3' }}>{landscapeAI.summary}</p>
            </div>

            {landscapeAI.sectorAnalysis && (
              <div className="p-4 " style={{ backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div className="text-[10px] font-semibold uppercase tracking-wider mb-3" style={{ color: '#B3B0A8' }}>Sector Analysis</div>
                <div className="text-sm leading-relaxed whitespace-pre-line" style={{ color: '#D1D5DB' }}>{landscapeAI.sectorAnalysis}</div>
              </div>
            )}

            {landscapeAI.insights && (
              <div className="p-4 " style={{ backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div className="text-[10px] font-semibold uppercase tracking-wider mb-3" style={{ color: '#B3B0A8' }}>Key Insights</div>
                <div className="text-sm leading-relaxed whitespace-pre-line" style={{ color: '#D1D5DB' }}>{landscapeAI.insights}</div>
              </div>
            )}
          </div>
        )}
      </div>


    </div>
  );
}

// Brand Comparison Page
function ComparisonPage({ results, onBack, profile, initialTab = 'brands', copyDeepLink }) {
  const [selectedBrands, setSelectedBrands] = useState([]);
  const [filterIndustry, setFilterIndustry] = useState('all');
  const [filterBusinessModel, setFilterBusinessModel] = useState('all');
  const [viewMode, setViewMode] = useState(initialTab);
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
    if (selectedBrands.length < 2) {
      alert('Select at least 2 brands to export comparison');
      return;
    }
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
  };

  return (
    <div className="min-h-screen bg-[#F2F0EA]">
      <div className="dc-wrap dc-page pt-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
          <div className="flex items-center gap-4">
            <button onClick={onBack} className="btn-secondary flex items-center gap-2">
              <ArrowLeft className="w-4 h-4" /> Back
            </button>
            <div>
              <h1 className="dc-h2 text-[#0B0B0B]">Compare</h1>
              <p className="text-sm text-[#8A877D]">Compare brands or explore the consciousness landscape</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {copyDeepLink && (
              <button
                onClick={() => copyDeepLink(
                  viewMode === 'landscape' ? 'compare/landscape' :
                  viewMode === 'insights'  ? 'compare/insights' : 'compare'
                )}
                className="btn-secondary flex items-center gap-2"
                title="Copy link to this tab"
              >
                <Share2 className="w-4 h-4" /> Share Link
              </button>
            )}
            <button 
              onClick={exportComparison} 
              disabled={viewMode !== 'brands' || selectedBrands.length < 2}
              className="btn-primary flex items-center gap-2"
            >
              <Download className="w-4 h-4" /> Export Comparison
            </button>
          </div>
        </div>

        {/* View Mode Toggle */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setViewMode('brands')}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              viewMode === 'brands' 
                ? 'bg-[#0B0B0B] text-white' 
                : 'bg-white border border-[#DCDAD3] text-[#8A877D] hover:border-[#0B0B0B]'
            }`}
          >
            Compare Brands
          </button>
          <button
            onClick={() => setViewMode('landscape')}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              viewMode === 'landscape' 
                ? 'bg-[#0B0B0B] text-white' 
                : 'bg-white border border-[#DCDAD3] text-[#8A877D] hover:border-[#0B0B0B]'
            }`}
          >
            🌐 Landscape
          </button>
          <button
            onClick={() => setViewMode('insights')}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              viewMode === 'insights' 
                ? 'bg-[#0B0B0B] text-white' 
                : 'bg-white border border-[#DCDAD3] text-[#8A877D] hover:border-[#0B0B0B]'
            }`}
          >
            ✨ Insights
          </button>
        </div>

        {results.length === 0 ? (
          <div className="card p-12 text-center">
            <BarChart3 className="w-16 h-16 text-[#DCDAD3] mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-[#0B0B0B] mb-2">No Results to Compare</h3>
            <p className="text-[#8A877D]">Complete some assessments first to compare brands.</p>
          </div>
        ) : viewMode === 'insights' ? (
          /* AI Insights View */
          <InsightsView results={results} industryBenchmarks={industryBenchmarks} industries={industries} isAdmin={profile?.is_admin} />
        ) : viewMode === 'landscape' ? (
          /* Landscape View */
          <LandscapeView results={results} industries={industries} isAdmin={profile?.is_admin} />
        ) : (
          /* Brand Comparison View */
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Brand Selection with Filters */}
            <div className="lg:col-span-1 space-y-4">
              {/* Filters */}
              <div className="card p-4">
                <h3 className="text-sm font-medium text-[#0B0B0B] mb-2">Filters</h3>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-[#8A877D] mb-1 block">Industry</label>
                    <select
                      value={filterIndustry}
                      onChange={(e) => setFilterIndustry(e.target.value)}
                      className="w-full px-3 py-2 border border-[#DCDAD3] text-sm"
                    >
                      {industries.map(ind => (
                        <option key={ind.id} value={ind.id}>{ind.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-[#8A877D] mb-1 block">Business Model</label>
                    <select
                      value={filterBusinessModel}
                      onChange={(e) => setFilterBusinessModel(e.target.value)}
                      className="w-full px-3 py-2 border border-[#DCDAD3] text-sm"
                    >
                      {businessModels.map(bm => (
                        <option key={bm.id} value={bm.id}>{bm.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
                
                {/* Quick select by industry */}
                {industriesWithData.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-[#DCDAD3]">
                    <label className="text-xs text-[#8A877D] mb-2 block">Quick Select Industry</label>
                    <div className="flex flex-wrap gap-1">
                      {industriesWithData.slice(0, 5).map(industry => (
                        <button
                          key={industry}
                          onClick={() => selectAllInIndustry(industry)}
                          className="text-xs px-2 py-1 bg-[#E4E2DC] hover:bg-[#F2F0EA] transition-colors"
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
                <h3 className="text-sm font-medium text-[#0B0B0B] mb-3">
                  Select Brands ({selectedBrands.length}/{maxComparison})
                  {filteredResults.length !== results.length && (
                    <span className="text-xs font-normal text-[#8A877D] ml-2">
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
                        className={`w-full text-left p-3  border transition-colors ${
                          isSelected 
                            ? 'border-[#0B0B0B] bg-[#DEE42F]/5' 
                            : isDisabled 
                              ? 'border-[#DCDAD3] bg-[#F2F0EA] opacity-50 cursor-not-allowed'
                              : 'border-[#DCDAD3] hover:border-[#0B0B0B]/50'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="font-medium text-[#0B0B0B]">{r.brandName}</span>
                            <div className="text-xs text-[#8A877D]">
                              {r.industry && <span>{industries.find(i => i.id === r.industry)?.name || r.industry}</span>}
                              {r.industry && r.businessModel && <span> · </span>}
                              {r.businessModel && <span>{r.businessModel.toUpperCase()}</span>}
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="font-bold text-lg">{r.totalScore}</span>
                            <div className="text-xs text-[#8A877D]">{r.maturityLevel}</div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                  {filteredResults.length === 0 && (
                    <div className="text-center py-8 text-[#8A877D] text-sm">
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
                  <Users className="w-16 h-16 text-[#DCDAD3] mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-[#0B0B0B] mb-2">Select Brands to Compare</h3>
                  <p className="text-[#8A877D]">Choose at least 2 brands from the list to see a comparison.</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Overall Score Comparison */}
                  <div className="card p-4 md:p-6">
                    <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                      <h3 className="text-sm font-medium text-[#0B0B0B]">Overall Scores</h3>
                      {/* Chart type toggle — only show if ≤ maxRadar brands */}
                      {selectedBrands.length <= maxRadar && (
                        <div className="flex gap-1 text-xs">
                          <button
                            onClick={() => setChartType('radar')}
                            className={`px-3 py-1.5  transition-colors ${chartType === 'radar' ? 'bg-[#0B0B0B] text-white' : 'bg-[#E4E2DC] text-[#8A877D] hover:bg-[#F2F0EA]'}`}
                          >
                            Radar
                          </button>
                          <button
                            onClick={() => setChartType('bars')}
                            className={`px-3 py-1.5  transition-colors ${chartType === 'bars' ? 'bg-[#0B0B0B] text-white' : 'bg-[#E4E2DC] text-[#8A877D] hover:bg-[#F2F0EA]'}`}
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
                              className="w-14 h-14 md:w-18 md:h-18 flex items-center justify-center mx-auto mb-2 text-white font-bold text-lg md:text-xl border-4"
                              style={{ backgroundColor: color, borderColor: color + '60', width: '64px', height: '64px' }}
                            >
                              {brand.totalScore}
                            </div>
                            <div className="font-medium text-xs text-[#0B0B0B] truncate max-w-[80px]">{brand.brandName}</div>
                            <div className="text-[10px] text-[#8A877D]">{brand.maturityLevel}</div>
                          </div>
                        );
                      })}
                      <div className="text-center border-l-2 border-[#DCDAD3] pl-4">
                        <div className="w-16 h-16 flex items-center justify-center mx-auto mb-2 text-white font-bold text-xl bg-[#0B0B0B]">
                          {Math.round(selectedBrands.reduce((sum, b) => sum + b.totalScore, 0) / selectedBrands.length)}
                        </div>
                        <div className="font-medium text-xs text-[#0B0B0B]">AVG</div>
                        <div className="text-[10px] text-[#8A877D]">{selectedBrands.length} brands</div>
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
                          <h3 className="text-sm font-medium text-[#0B0B0B]">Radar Comparison</h3>
                          {commonIndustry && (
                            <button
                              onClick={() => setShowIndustryAvg(!showIndustryAvg)}
                              className={`text-xs px-3 py-1.5  border transition-colors ${showIndustryAvg ? 'bg-[#E4E2DC] border-[#9CA3AF] text-[#8A877D]' : 'border-[#DCDAD3] text-[#B3B0A8] hover:border-[#999999]'}`}
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
                      <h3 className="text-sm font-medium text-[#0B0B0B] mb-3">Attribute Comparison</h3>
                      <div className="overflow-x-auto">
                        <div style={{ minWidth: `${Math.max(400, selectedBrands.length * 80 + 120)}px` }}>
                          {/* Brand labels header */}
                          <div className="flex items-center gap-2 mb-3 text-xs text-[#8A877D]">
                            <div className="w-24 flex-shrink-0"></div>
                            <div className="flex-1 flex gap-1">
                              {selectedBrands.map((brand, bi) => (
                                <div key={brand.id} className="flex-1 truncate text-center font-medium" style={{ color: selectedBrands.length <= maxRadar ? COMPARISON_COLORS[bi] : '#0B0B0B' }}>{brand.brandName}</div>
                              ))}
                              <div className="flex-1 text-center font-medium text-[#0B0B0B]">AVG</div>
                            </div>
                          </div>
                          <div className="space-y-3">
                            {ATTRIBUTES.map((attr) => {
                              const avgScore = Math.round(selectedBrands.reduce((sum, b) => sum + (b.scores?.[attr.id] || 0), 0) / selectedBrands.length);
                              return (
                                <div key={attr.id} className="flex items-center gap-2">
                                  <div className="w-24 flex-shrink-0 flex items-center gap-2">
                                    <div className="w-2.5 h-2.5 flex-shrink-0" style={{ backgroundColor: attr.color }} />
                                    <span className="text-xs font-medium text-[#0B0B0B] truncate">{attr.name}</span>
                                  </div>
                                  <div className="flex-1 flex gap-1">
                                    {selectedBrands.map((brand) => {
                                      const score = brand.scores?.[attr.id] || 0;
                                      return (
                                        <div key={brand.id} className="flex-1 relative">
                                          <div className="h-5 bg-[#F2F0EA] overflow-hidden">
                                            <div className="h-full transition-all duration-500" style={{ width: `${score}%`, backgroundColor: attr.color }} />
                                          </div>
                                          <div className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white mix-blend-difference">{score}</div>
                                        </div>
                                      );
                                    })}
                                    <div className="flex-1 relative">
                                      <div className="h-5 bg-[#F2F0EA] overflow-hidden">
                                        <div className="h-full transition-all duration-500 bg-[#0B0B0B]" style={{ width: `${avgScore}%` }} />
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
                    <h3 className="text-sm font-medium text-[#0B0B0B] mb-4">Consciousness Profiles</h3>
                    <div className="space-y-4">
                      {selectedBrands.map((brand, bi) => {
                        const color = selectedBrands.length <= maxRadar ? COMPARISON_COLORS[bi] : '#0B0B0B';
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
                          <div key={brand.id} className="flex items-start gap-3 p-3 bg-[#F2F0EA]">
                            <div className="w-2 h-12 flex-shrink-0 mt-1" style={{ backgroundColor: color }} />
                            <div className="flex-1 min-w-0">
                              <div className="font-semibold text-sm text-[#0B0B0B] mb-2">{brand.brandName}</div>
                              <div className="grid grid-cols-3 gap-2 text-xs">
                                <div>
                                  <div className="text-[#B3B0A8] mb-0.5">Strongest</div>
                                  <div className="font-medium text-[#059669]">{strongest.name} <span className="text-[#B3B0A8]">({strongest.score})</span></div>
                                </div>
                                <div>
                                  <div className="text-[#B3B0A8] mb-0.5">Weakest</div>
                                  <div className="font-medium text-[#B23A3A]">{weakest.name} <span className="text-[#B3B0A8]">({weakest.score})</span></div>
                                </div>
                                <div>
                                  <div className="text-[#B3B0A8] mb-0.5">Most distinct</div>
                                  <div className="font-medium text-[#1976D2]">{mostDiff.name} <span className="text-[#B3B0A8]">(+{Math.round(mostDiff.diff)})</span></div>
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
                        <h3 className="text-sm font-medium text-[#0B0B0B] mb-4">Head to Head</h3>
                        <div className="grid grid-cols-3 gap-3 text-center mb-4">
                          <div className="bg-[#E4E2DC] p-3">
                            <div className="text-2xl font-bold" style={{ color: COMPARISON_COLORS[0] }}>{aWins.length}</div>
                            <div className="text-xs text-[#8A877D] mt-1 truncate">{a.brandName} leads</div>
                          </div>
                          <div className="bg-[#E4E2DC] p-3">
                            <div className="text-2xl font-bold text-[#B3B0A8]">{tied.length}</div>
                            <div className="text-xs text-[#8A877D] mt-1">Tied</div>
                          </div>
                          <div className="bg-[#E4E2DC] p-3">
                            <div className="text-2xl font-bold" style={{ color: COMPARISON_COLORS[1] }}>{bWins.length}</div>
                            <div className="text-xs text-[#8A877D] mt-1 truncate">{b.brandName} leads</div>
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
                                  <span className={`font-bold ${winner === 0 ? 'text-[#B23A3A]' : 'text-[#B3B0A8]'}`}>{aScore}</span>
                                </div>
                                <div className="w-20 text-center flex-shrink-0">
                                  <div className="flex items-center gap-1 justify-center">
                                    <div className="w-2 h-2" style={{ backgroundColor: attr.color }} />
                                    <span className="text-[#8A877D]">{attr.name}</span>
                                  </div>
                                </div>
                                <div className="flex-1">
                                  <span className={`font-bold ${winner === 1 ? 'text-[#1976D2]' : 'text-[#B3B0A8]'}`}>{bScore}</span>
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
                    <h3 className="text-sm font-medium text-[#0B0B0B] mb-3">Quick Insights</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                      <div className="bg-[#E4E2DC] p-3">
                        <div className="font-medium text-[#0B0B0B] mb-1 text-xs">Highest Overall Score</div>
                        <div className="text-[#B23A3A] font-bold text-sm">
                          {selectedBrands.reduce((a, b) => a.totalScore > b.totalScore ? a : b).brandName}
                          <span className="text-[#8A877D] font-normal ml-2 text-xs">({selectedBrands.reduce((a, b) => a.totalScore > b.totalScore ? a : b).totalScore})</span>
                        </div>
                      </div>
                      <div className="bg-[#E4E2DC] p-3">
                        <div className="font-medium text-[#0B0B0B] mb-1 text-xs">Largest Attribute Gap</div>
                        {(() => {
                          let maxGap = 0, gapAttr = ATTRIBUTES[0];
                          ATTRIBUTES.forEach(attr => {
                            const scores = selectedBrands.map(b => b.scores?.[attr.id] || 0);
                            const gap = Math.max(...scores) - Math.min(...scores);
                            if (gap > maxGap) { maxGap = gap; gapAttr = attr; }
                          });
                          return <div className="text-[#B23A3A] font-bold text-sm">{gapAttr.name} <span className="text-[#8A877D] font-normal text-xs">({maxGap} pts spread)</span></div>;
                        })()}
                      </div>
                      <div className="bg-[#E4E2DC] p-3">
                        <div className="font-medium text-[#0B0B0B] mb-1 text-xs">Collective Strength</div>
                        {(() => {
                          let maxAvg = 0, strongAttr = ATTRIBUTES[0];
                          ATTRIBUTES.forEach(attr => {
                            const avg = selectedBrands.reduce((sum, b) => sum + (b.scores?.[attr.id] || 0), 0) / selectedBrands.length;
                            if (avg > maxAvg) { maxAvg = avg; strongAttr = attr; }
                          });
                          return <div className="text-[#059669] font-bold text-sm">{strongAttr.name} <span className="text-[#8A877D] font-normal text-xs">({Math.round(maxAvg)} avg)</span></div>;
                        })()}
                      </div>
                      <div className="bg-[#E4E2DC] p-3">
                        <div className="font-medium text-[#0B0B0B] mb-1 text-xs">Collective Weakness</div>
                        {(() => {
                          let minAvg = 100, weakAttr = ATTRIBUTES[0];
                          ATTRIBUTES.forEach(attr => {
                            const avg = selectedBrands.reduce((sum, b) => sum + (b.scores?.[attr.id] || 0), 0) / selectedBrands.length;
                            if (avg < minAvg) { minAvg = avg; weakAttr = attr; }
                          });
                          return <div className="text-[#F57C00] font-bold text-sm">{weakAttr.name} <span className="text-[#8A877D] font-normal text-xs">({Math.round(minAvg)} avg)</span></div>;
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
          className={`w-2 h-2 ${
            status === 'complete' ? 'bg-green-500' : 
            status === 'partial' ? 'bg-yellow-500' : 
            'bg-[#DCDAD3]'
          }`}
          title={`${key}: ${status}`}
        />
      ))}
    </div>
  );
}

// Saved Assessments Page
// Active client links: who issued them, when, and the controls to reset or
// revoke. Lives on the saved page because that is where the assessments are,
// and a password reset needs the assessment to rebuild the payload from.
function ClientLinksModal({ assessments, profile, onClose }) {
  const [links, setLinks] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(null);
  const [copied, setCopied] = useState(null);
  const [resetting, setResetting] = useState(null);
  const [newPassword, setNewPassword] = useState('');

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  const load = async () => {
    const { data, error: err } = await listClientReports();
    if (err) { setError('Could not load client links. Has the migration been run?'); return; }
    setLinks(data || []);
  };
  useEffect(() => { load(); }, []);

  const urlFor = (token) => `${window.location.origin}${window.location.pathname}?client=${token}`;

  const copy = (token) => {
    navigator.clipboard.writeText(urlFor(token)).then(() => {
      setCopied(token);
      setTimeout(() => setCopied(null), 2000);
    });
  };

  const revoke = async (link) => {
    if (!window.confirm(`Revoke the client link for ${link.brand_name}? Anyone holding it will lose access immediately.`)) return;
    setBusy(link.token);
    await revokeClientReport(link.token);
    await load();
    setBusy(null);
  };

  // The payload cannot be decrypted without the old password, so a reset
  // rebuilds it from the saved assessment and re-encrypts. The token is kept,
  // so a link already sent to a client keeps working under the new password.
  const sourceFor = (link) => {
    const matches = (assessments || []).filter(
      a => (a.project?.brandName || '').trim().toLowerCase() === (link.brand_name || '').trim().toLowerCase()
    );
    return matches.sort((x, y) =>
      new Date(y.savedAt || y.created_at || 0) - new Date(x.savedAt || x.created_at || 0))[0] || null;
  };

  const doReset = async (link) => {
    if (newPassword.length < 6) { setError('Use at least 6 characters.'); return; }
    const src = sourceFor(link);
    if (!src || !src.scores) {
      setError(`No saved assessment found for ${link.brand_name}. Open the assessment and issue a new link instead.`);
      return;
    }
    setBusy(link.token);
    setError(null);
    const payload = makeClientPayload({
      project: src.project,
      scores: src.scores,
      benchmark: src.project?.benchmarkSnapshot || null,
    });
    const { error: err } = await resetClientReportPassword({ token: link.token, payload, password: newPassword });
    if (err) setError('Reset failed: ' + err.message);
    else { setResetting(null); setNewPassword(''); }
    setBusy(null);
  };

  // Portalled for the same reason as the client link modal: an ancestor with a
  // transform would otherwise become the containing block for position:fixed.
  return createPortal((
    <div className="fixed inset-0 bg-black/60 flex items-start sm:items-center justify-center p-4 overflow-y-auto z-[100]"
      onClick={onClose}>
      <div className="card p-6 max-w-2xl w-full my-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold text-[#0B0B0B]">
              Client links{links ? ` (${links.length})` : ''}
            </h3>
            <p className="text-xs text-[#8A877D] mt-0.5">
              Active password-protected reports shared with clients.
            </p>
          </div>
          <button onClick={onClose} className="text-[#999] hover:text-[#0B0B0B]">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto -mx-1 px-1">
          {error && <p className="text-xs text-[#B23A3A] mb-3">{error}</p>}
          {!links && !error && (
            <p className="text-xs text-[#8A877D] flex items-center gap-1.5 py-4">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading links...
            </p>
          )}
          {links && links.length === 0 && !error && (
            <p className="text-sm text-[#8A877D] py-6 text-center">
              No active client links. Create one from the Client Link button on a report.
            </p>
          )}

          {links && links.map(link => {
            const mine = link.created_by === profile?.id;
            const canManage = mine || profile?.is_admin;
            return (
              <div key={link.token} className="py-3 border-b border-[#DCDAD3] last:border-0">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-semibold text-sm text-[#0B0B0B]">{link.brand_name}</div>
                    <div className="text-[11px] text-[#8A877D] mt-0.5">
                      Issued by {link.created_by_name || 'unknown'}
                      {link.created_at ? ` on ${new Date(link.created_at).toLocaleDateString()}` : ''}
                      {mine ? '' : ' (not yours)'}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button onClick={() => copy(link.token)}
                      className="btn-secondary text-[11px] px-2 py-1 flex items-center gap-1">
                      {copied === link.token ? <><Check className="w-3 h-3" /> Copied</> : <><Copy className="w-3 h-3" /> Copy</>}
                    </button>
                    {canManage && (
                      <>
                        <button onClick={() => { setResetting(resetting === link.token ? null : link.token); setNewPassword(''); setError(null); }}
                          className="btn-secondary text-[11px] px-2 py-1">
                          Reset password
                        </button>
                        <button onClick={() => revoke(link)} disabled={busy === link.token}
                          className="btn-secondary text-[11px] px-2 py-1 text-[#B23A3A]">
                          {busy === link.token ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Revoke'}
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {resetting === link.token && (
                  <div className="mt-3 bg-[#F2F0EA] p-3">
                    <p className="text-[11px] text-[#8A877D] mb-2 leading-relaxed">
                      The old password cannot be recovered, so the report is rebuilt from the saved
                      assessment and re-encrypted. The URL stays the same, so any link already sent keeps working.
                      {sourceFor(link) ? '' : ` No saved assessment found for ${link.brand_name}.`}
                    </p>
                    <div className="flex gap-2">
                      <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && doReset(link)}
                        placeholder="New password"
                        className="flex-1 px-2 py-1.5 border border-[#DCDAD3] bg-white text-xs" />
                      <button onClick={() => doReset(link)} disabled={busy === link.token || !sourceFor(link)}
                        className="btn-primary text-xs px-3 py-1.5">
                        {busy === link.token ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Set'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex justify-end pt-4 mt-2 border-t border-[#DCDAD3]">
          <button onClick={onClose} className="btn-secondary text-sm px-4 py-2">Close</button>
        </div>
      </div>
    </div>
  ), document.body);
}

function SavedAssessmentsPage({ assessments, onLoad, onDelete, onBack, onImport, onExport, onShare, onRescore, profile }) {
  const fileInputRef = useRef(null);
  const isReadonly = profile?.is_readonly && !profile?.is_admin;
  const [search, setSearch] = useState('');
  const [filterStage, setFilterStage] = useState('');
  const [filterIndustry, setFilterIndustry] = useState('');
  const [sortBy, setSortBy] = useState('date-desc');

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
    e.target.value = '';
  };

  // Enrich each assessment with computed values once
  const enriched = assessments.map((a, i) => {
    const overallScore = a.scores ? Math.round(
      Object.entries(a.scores)
        .filter(([, val]) => val && typeof val.score === 'number')
        .reduce((sum, [, v]) => sum + v.score, 0) / 8
    ) : null;
    const maturity = overallScore !== null ? getMaturityStage(overallScore) : null;
    const industryName = a.project.industry && a.project.industry !== 'other'
      ? INDUSTRIES.find(ind => ind.id === a.project.industry)?.name || a.project.industry
      : null;
    return { a, i, overallScore, maturity, industryName };
  });

  // Unique industries and stages for filter dropdowns
  const usedIndustries = [...new Set(enriched.map(e => e.industryName).filter(Boolean))].sort();
  const usedStages = [...new Set(enriched.map(e => e.maturity?.name).filter(Boolean))];

  // Filter + sort
  const filtered = enriched
    .filter(({ a, maturity, industryName }) => {
      if (search && !a.project.brandName.toLowerCase().includes(search.toLowerCase())) return false;
      if (filterStage && maturity?.name !== filterStage) return false;
      if (filterIndustry && industryName !== filterIndustry) return false;
      return true;
    })
    .sort((x, y) => {
      if (sortBy === 'date-desc') return (y.a.project.date || '').localeCompare(x.a.project.date || '');
      if (sortBy === 'date-asc') return (x.a.project.date || '').localeCompare(y.a.project.date || '');
      if (sortBy === 'score-desc') return (y.overallScore || 0) - (x.overallScore || 0);
      if (sortBy === 'score-asc') return (x.overallScore || 0) - (y.overallScore || 0);
      if (sortBy === 'name') return x.a.project.brandName.localeCompare(y.a.project.brandName);
      return 0;
    });

  const hasFilters = search || filterStage || filterIndustry;
  const [showClientLinks, setShowClientLinks] = useState(false);

  return (
    <div className="dc-wrap dc-page pt-8 animate-fade-in">
      {showClientLinks && (
        <ClientLinksModal
          assessments={assessments}
          profile={profile}
          onClose={() => setShowClientLinks(false)}
        />
      )}
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
        <div>
          <h2 className="dc-h2 text-[#0B0B0B]">Saved Assessments</h2>
          <p className="text-sm text-[#8A877D]">Your assessments are stored securely in the cloud</p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          {!isReadonly && (
            <>
              <input type="file" ref={fileInputRef} onChange={handleFileImport} accept=".json" className="hidden" />
              <button onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium border border-[#DCDAD3] bg-white text-[#4A4840] hover:border-[#0B0B0B] hover:bg-[#E4E2DC] transition-colors">
                <Upload className="w-4 h-4" /> Import
              </button>
              <button onClick={() => setShowClientLinks(true)}
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium border border-[#DCDAD3] bg-white text-[#4A4840] hover:border-[#0B0B0B] hover:bg-[#E4E2DC] transition-colors">
                <ExternalLink className="w-4 h-4" /> Client Links
              </button>
            </>
          )}
          <button onClick={onBack}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium border border-[#DCDAD3] bg-white text-[#4A4840] hover:border-[#0B0B0B] hover:bg-[#E4E2DC] transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
        </div>
      </div>

      {/* Sharing tip */}
      {!isReadonly && (
        <div className="bg-[#F0F7FF] border border-[#BFDBFE] px-4 py-3 mb-5">
          <p className="text-xs text-[#1E40AF]">
            <strong>Sharing tip:</strong> Use the <strong>Share</strong> button to copy a link others can view, or <strong>Export</strong> to download a JSON backup.
          </p>
        </div>
      )}

      {assessments.length === 0 ? (
        <div className="card p-12 text-center">
          <FileText className="w-12 h-12 text-[#DCDAD3] mx-auto mb-4" />
          <h3 className="dc-kicker text-[#0B0B0B] mb-2">No Saved Assessments</h3>
          <p className="text-[#8A877D] mb-4">Complete an assessment and click Save to store it here.</p>
          <p className="text-sm text-[#B3B0A8]">Or import a previously exported assessment using the Import button above.</p>
        </div>
      ) : (
        <>
          {/* Search + filters */}
          <div className="flex flex-col sm:flex-row gap-2 mb-4">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#B3B0A8]" />
              <input
                type="text"
                placeholder="Search brands…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm border border-[#DCDAD3] bg-white focus:outline-none focus:border-[#0B0B0B] transition-colors"
              />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#B3B0A8] hover:text-[#0B0B0B]">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            {/* Stage filter */}
            {usedStages.length > 1 && (
              <select value={filterStage} onChange={e => setFilterStage(e.target.value)}
                className="px-3 py-2 text-sm border border-[#DCDAD3] bg-white focus:outline-none focus:border-[#0B0B0B] transition-colors text-[#4A4840]">
                <option value="">All stages</option>
                {usedStages.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            )}
            {/* Industry filter */}
            {usedIndustries.length > 1 && (
              <select value={filterIndustry} onChange={e => setFilterIndustry(e.target.value)}
                className="px-3 py-2 text-sm border border-[#DCDAD3] bg-white focus:outline-none focus:border-[#0B0B0B] transition-colors text-[#4A4840]">
                <option value="">All industries</option>
                {usedIndustries.map(ind => <option key={ind} value={ind}>{ind}</option>)}
              </select>
            )}
            {/* Sort */}
            <select value={sortBy} onChange={e => setSortBy(e.target.value)}
              className="px-3 py-2 text-sm border border-[#DCDAD3] bg-white focus:outline-none focus:border-[#0B0B0B] transition-colors text-[#4A4840]">
              <option value="date-desc">Newest first</option>
              <option value="date-asc">Oldest first</option>
              <option value="score-desc">Highest score</option>
              <option value="score-asc">Lowest score</option>
              <option value="name">Brand name</option>
            </select>
          </div>

          {/* Results count when filtering */}
          {hasFilters && (
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-[#8A877D]">{filtered.length} of {assessments.length} assessments</p>
              <button onClick={() => { setSearch(''); setFilterStage(''); setFilterIndustry(''); }}
                className="text-xs text-[#B23A3A] hover:underline">Clear filters</button>
            </div>
          )}

          {filtered.length === 0 ? (
            <div className="card p-8 text-center">
              <p className="text-[#8A877D]">No assessments match your filters.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map(({ a, i, overallScore, maturity, industryName }) => (
                <div key={i} className="card px-4 py-3">
                  <div className="flex items-center gap-3">
                    {/* Score badge */}
                    {overallScore !== null && (
                      <div className="w-11 h-11 flex-shrink-0 flex items-center justify-center"
                        style={{ backgroundColor: (maturity?.color || '#E53935') + '18' }}>
                        <span className="text-base font-bold" style={{ color: maturity?.color || '#E53935' }}>{overallScore}</span>
                      </div>
                    )}

                    {/* Brand info */}
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-[#0B0B0B] text-sm leading-tight">{a.project.brandName}</h4>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
                        <span className="text-xs text-[#B3B0A8] whitespace-nowrap">{a.project.date || '—'}</span>
                        {industryName && <><span className="text-xs text-[#B3B0A8]">·</span><span className="text-xs text-[#8A877D]">{industryName}</span></>}
                        {maturity && <><span className="text-xs text-[#B3B0A8]">·</span><span className="text-xs font-medium" style={{ color: maturity.color }}>{maturity.name}</span></>}
                      </div>
                    </div>

                    {/* Actions — right-aligned on desktop, visible always */}
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {!isReadonly && (
                        <>
                          <button onClick={() => onShare(a)} title="Share link"
                            className="w-8 h-8 hidden sm:flex items-center justify-center text-[#B3B0A8] hover:text-[#0B0B0B] hover:bg-[#E5393508] transition-colors">
                            <Share2 className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => onExport(a)} title="Export JSON"
                            className="w-8 h-8 hidden sm:flex items-center justify-center text-[#B3B0A8] hover:text-[#0B0B0B] hover:bg-[#E4E2DC] transition-colors">
                            <Download className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => onRescore(a)}
                            className="px-3 py-1.5 text-xs font-medium border border-[#DCDAD3] text-[#4A4840] hover:border-[#0B0B0B] hover:bg-[#E4E2DC] transition-colors whitespace-nowrap hidden sm:block">
                            Rescore
                          </button>
                        </>
                      )}
                      <button onClick={() => onLoad(a)}
                        className="px-4 py-1.5 text-xs font-semibold bg-[#0B0B0B] text-white hover:bg-[#333333] transition-colors whitespace-nowrap">
                        Load
                      </button>
                      {!isReadonly && (
                        <button onClick={() => onDelete(i)} title="Delete"
                          className="w-8 h-8 hidden sm:flex items-center justify-center text-[#DCDAD3] hover:text-red-500 hover:bg-red-50 transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Mobile-only secondary actions */}
                  {!isReadonly && (
                    <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-[#E4E2DC] sm:hidden">
                      <button onClick={() => onShare(a)} title="Share"
                        className="w-8 h-8 flex items-center justify-center text-[#B3B0A8] hover:text-[#0B0B0B] transition-colors">
                        <Share2 className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => onExport(a)} title="Export"
                        className="w-8 h-8 flex items-center justify-center text-[#B3B0A8] hover:text-[#0B0B0B] transition-colors">
                        <Download className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => onRescore(a)}
                        className="px-3 py-1.5 text-xs font-medium border border-[#DCDAD3] text-[#4A4840] hover:border-[#0B0B0B] hover:bg-[#E4E2DC] transition-colors">
                        Rescore
                      </button>
                      <button onClick={() => onDelete(i)} title="Delete"
                        className="w-8 h-8 flex items-center justify-center text-[#DCDAD3] hover:text-red-500 transition-colors ml-auto">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <p className="text-center text-sm text-[#B3B0A8] mt-8">
            {assessments.length} assessment{assessments.length !== 1 ? 's' : ''} saved
          </p>
        </>
      )}
    </div>
  );
}

// Builds the cleansed client payload. Single source of truth, used both when
// a link is created and when its password is reset, so a reset can never
// produce a different shape from the original.
//
// Only these fields ever leave the building. Assessor context, the raw channel
// assessments, recommendations and service mapping are all absent by
// construction rather than by filtering.
function makeClientPayload({ project, scores, benchmark }) {
  return {
    project: {
      brandName: project.brandName,
      industry: project.industry,
    },
    scores: ATTRIBUTES.reduce((acc, a) => {
      const sc = scores?.[a.id] || {};
      acc[a.id] = { score: sc.score, findings: sc.findings, impact: sc.impact };
      return acc;
    }, {
      headline: scores?.headline,
      campaignCoherence: scores?.campaignCoherence
        ? {
            level: scores.campaignCoherence.level,
            verdict: scores.campaignCoherence.verdict,
            rationale: scores.campaignCoherence.rationale,
            toNextLevel: scores.campaignCoherence.toNextLevel,
          }
        : null,
    }),
    benchmark: benchmark
      ? {
          cohortLabel: benchmark.cohortLabel,
          industryName: benchmark.industryName,
          attrAvgs: benchmark.attrAvgs,
          attrRanges: benchmark.attrRanges,
          scope: benchmark.scope,
          // The spread chart reads the brand's own dots from here rather than
          // from scores, so it travels with the benchmark block.
          brandScores: ATTRIBUTES.reduce((acc, a) => {
            acc[a.id] = scores?.[a.id]?.score || 0;
            return acc;
          }, {}),
        }
      : null,
    footprint: scores?.footprint || null,
    conclusion: String(scores?.conclusion || scores?.justification || '').replace(/[\u2014\u2013]/g, '-'),
    generatedAt: new Date().toISOString(),
  };
}

// Creates a gated client link. The assessor sets the password; it encrypts the
// payload in the browser and never travels to the server.
function ClientLinkModal({ brandName, buildPayload, onClose, profile }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [url, setUrl] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  const create = async () => {
    if (password.length < 6) { setError('Use at least 6 characters.'); return; }
    if (password !== confirm) { setError('The two passwords do not match.'); return; }
    setBusy(true);
    setError(null);
    try {
      const { token, error: err } = await createClientReport({
        brandName,
        payload: buildPayload(),
        password,
        createdByName: profile?.full_name || profile?.email || null,
      });
      if (err) throw err;
      setUrl(`${window.location.origin}${window.location.pathname}?client=${token}`);
    } catch (e) {
      setError('Could not create the link: ' + (e.message || 'unknown error'));
    } finally {
      setBusy(false);
    }
  };

  const copy = () => {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  // Rendered into document.body. Inside the report tree an ancestor with a
  // transform (the fade-in animations) becomes the containing block for
  // position:fixed, which is why this was landing halfway down the page
  // instead of centred in the viewport.
  return createPortal((
    <div className="fixed inset-0 bg-black/60 flex items-start sm:items-center justify-center p-4 overflow-y-auto z-[100]"
      onClick={onClose}>
      <div className="card p-6 max-w-lg w-full my-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold text-[#0B0B0B]">Client link</h3>
            <p className="text-xs text-[#8A877D] mt-0.5">
              A cleansed, password-protected report for {brandName}.
            </p>
          </div>
          <button onClick={onClose} className="text-[#999] hover:text-[#0B0B0B]">
            <X className="w-5 h-5" />
          </button>
        </div>

        {!url ? (
          <>
            <div className="bg-[#F2F0EA] p-3 mb-4">
              <p className="text-xs text-[#4A4840] leading-relaxed">
                The client sees scores, maturity, attribute analysis, campaign coherence,
                the benchmark profile and the conclusion. They do not see recommendations,
                channel assessments, or any internal notes.
              </p>
            </div>

            <label className="dc-kicker-sm mb-2 block">Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              placeholder="Set a password for the client"
              className="w-full px-3 py-2 border border-[#DCDAD3] bg-white text-sm mb-3" />

            <label className="dc-kicker-sm mb-2 block">Confirm password</label>
            <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && create()}
              placeholder="Repeat it"
              className="w-full px-3 py-2 border border-[#DCDAD3] bg-white text-sm mb-3" />

            {error && <p className="text-xs text-[#B23A3A] mb-3">{error}</p>}

            <p className="text-[11px] text-[#999] leading-relaxed mb-4">
              The report is encrypted with this password before it is stored. It cannot be
              recovered or reset, so send it to the client separately from the link.
            </p>

            <div className="flex gap-2">
              <button onClick={onClose} className="btn-secondary flex-1 text-sm py-2">Cancel</button>
              <button onClick={create} disabled={busy} className="btn-primary flex-1 text-sm py-2 flex items-center justify-center gap-2">
                {busy ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating...</> : 'Create link'}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="bg-[#F0F9F4] border border-[#BBE5CC] p-3 mb-4">
              <div className="flex items-center gap-1.5 mb-1">
                <Check className="w-3.5 h-3.5 text-[#059669]" />
                <span className="text-xs font-semibold text-[#059669]">Link created</span>
              </div>
              <p className="text-xs text-[#4A4840]">Send the password separately.</p>
            </div>
            <div className="bg-[#F2F0EA] p-3 mb-3 break-all text-xs text-[#4A4840] font-mono">
              {url}
            </div>
            <div className="flex gap-2">
              <button onClick={copy} className="btn-primary flex-1 text-sm py-2 flex items-center justify-center gap-2">
                {copied ? <><Check className="w-4 h-4" /> Copied</> : <><Copy className="w-4 h-4" /> Copy link</>}
              </button>
              <button onClick={onClose} className="btn-secondary flex-1 text-sm py-2">Done</button>
            </div>
          </>
        )}
      </div>
    </div>
  ), document.body);
}

// ─────────────────────────────────────────────────────────────
// CLIENT REPORT (gated, cleansed)
//
// Deliberately a separate component from ReportPage rather than a filtered
// version of it. The internal report is free to change without any risk of a
// new section silently appearing in front of a client. Anything a client
// should not see is not rendered here, because it is not in this file.
//
// Shows: upper panel and attribute scores, maturity, attribute analysis
// without the recommendations, campaign coherence, profile against benchmark,
// and the conclusion. Nothing else. No navigation, no export controls.
// ─────────────────────────────────────────────────────────────
function ClientReportView({ payload }) {
  const { project, scores, benchmark } = payload;

  const overall = Math.round(
    ATTRIBUTES.reduce((t, a) => t + (scores?.[a.id]?.score || 0), 0) / ATTRIBUTES.length
  );
  const stage = getMaturityStage(overall);
  const industryName = benchmark?.industryName || benchmark?.cohortLabel || '';

  const sorted = [...ATTRIBUTES].map(a => ({ ...a, score: scores?.[a.id]?.score || 0 }))
    .sort((x, y) => y.score - x.score);
  const strengths = sorted.slice(0, 2);
  const growth = sorted.slice(-2).reverse();

  const campaign = scores?.campaignCoherence || null;
  const campaignStage = campaign && Number.isFinite(Number(campaign.level))
    ? getCampaignLevel(Number(campaign.level)) : null;

  const benchmarkAvg = benchmark
    ? ATTRIBUTES.reduce((acc, a) => { acc[a.id] = benchmark.attrAvgs?.[a.id] || 0; return acc; }, {})
    : null;

  return (
    <div className="min-h-screen bg-[#F2F0EA]">
      <div className="dc-wrap dc-page pt-8">
        {/* Masthead. Client-facing view only; the internal report has no
            equivalent and should not gain one. */}
        <div className="mb-6">
          <img
            src="https://ktuyiikwhspwmzvyczit.supabase.co/storage/v1/object/public/assets/brand/antenna-new-logo.svg"
            alt="Antenna Group"
            className="h-7 sm:h-8 mb-5"
            style={{ filter: 'brightness(0)' }}
          />
          <div className="text-xs font-bold text-[#B23A3A] uppercase tracking-[0.14em] mb-2">
            Brand Facing Report
          </div>
          <h1 className="text-[clamp(34px,5vw,60px)] font-bold tracking-[-0.035em] leading-[0.94] text-[#0B0B0B]">{project.brandName}</h1>
          <p className="dc-standfirst">
            Conscious Compass Assessment{industryName ? ` | ${industryName}` : ''}
          </p>
        </div>

        {/* ── Upper panel ─────────────────────────────────────── */}
        <h3 className="dc-sec-head mb-4">RESULTS AT A GLANCE</h3>
        <div className="card p-6 mb-4">
          <div className="grid md:grid-cols-2 gap-6 items-start">
            <div>
              <div className="flex items-start gap-5">
                <div className="text-center flex-shrink-0">
                  <div className="w-20 h-20 flex items-center justify-center text-white text-4xl font-bold"
                    style={{ backgroundColor: stage.color }}>
                    {overall}
                  </div>
                  <div className="text-xs text-[#8A877D] mt-1.5">out of 100</div>
                </div>
                <div className="min-w-0">
                  <h2 className="text-xl font-bold text-[#0B0B0B]">{stage.name}</h2>
                  <p className="text-sm text-[#8A877D] leading-relaxed mt-1">{stage.description}</p>
                </div>
              </div>

              <div className="border-t border-[#DCDAD3] my-5" />

              {scores?.headline && (
                <p className="text-lg font-bold italic text-[#0B0B0B] leading-snug mb-3">
                  "{scores.headline}"
                </p>
              )}
              <p className="text-sm text-[#4A4840] leading-relaxed">
                <span className="font-semibold">{project.brandName}</span> demonstrates strength in{' '}
                <span className="text-[#059669] font-medium">{strengths.map(a => a.name).join(' and ')}</span>
                , with opportunities to grow in{' '}
                <span className="text-[#B23A3A] font-medium">{growth.map(a => a.name).join(' and ')}</span>.
              </p>
            </div>

            <div className="bg-[#E4E2DC] p-4 flex justify-center">
              <SpiderChart scores={scores} size={340} />
            </div>
          </div>
        </div>

        {/* ── Attribute scores ────────────────────────────────── */}
        <div className="dc-tiles grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 mb-10">
          {ATTRIBUTES.map(a => (
            <div key={a.id} className="dc-tile" style={{ gap: 6, padding: '14px 12px' }}>
              <div className="dc-kicker-sm leading-tight break-words">{a.name}</div>
              <div className="text-3xl font-bold tracking-tight" style={{ color: a.color }}>{scores?.[a.id]?.score || 0}</div>
            </div>
          ))}
        </div>

        {/* ── Maturity ────────────────────────────────────────── */}
        <h3 className="dc-sec-head mb-4">BRAND MATURITY</h3>
        <div className="mb-6">
          <MaturityContinuum score={overall} hideTitle />
        </div>

        {/* ── Attribute analysis, no recommendations ──────────── */}
        <h3 className="dc-sec-head mb-4">ATTRIBUTE ANALYSIS</h3>
        <div className="grid md:grid-cols-2 gap-3 mb-6">
          {ATTRIBUTES.map(a => {
            const sc = scores?.[a.id] || {};
            return (
              <div key={a.id} className="card p-5">
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-2xl font-bold" style={{ color: a.color }}>{sc.score || 0}</span>
                  <div className="min-w-0">
                    <h4 className="font-semibold text-[#0B0B0B] text-sm">{a.name}</h4>
                    <p className="text-xs text-[#8A877D]">{a.fullName}</p>
                  </div>
                </div>
                {sc.findings && (
                  <p className="text-xs text-[#4A4840] leading-relaxed mb-2">{sc.findings}</p>
                )}
                {sc.impact && (
                  <p className="text-xs text-[#4A4840] leading-relaxed">
                    <span className="font-semibold">What's driving it: </span>
                    {String(sc.impact).replace(/^What'?s driving it:?\s*/i, '')}
                  </p>
                )}
                {/* Recommendations and gaps are intentionally not rendered. */}
              </div>
            );
          })}
        </div>

        {/* ── Brand footprint ─────────────────────────────────── */}
        {payload.footprint && (
          <>
            <h3 className="dc-sec-head mb-4">BRAND FOOTPRINT</h3>
            <div className="mb-6 overflow-hidden">
              <FootprintMosaic footprint={payload.footprint} brandName={project.brandName} compact />
            </div>
          </>
        )}

        {/* ── Campaign coherence ──────────────────────────────── */}
        {campaignStage && (
          <>
            <h3 className="dc-sec-head mb-4">CAMPAIGN COHERENCE</h3>
            <div className="card p-5 mb-6">
              <div className="flex flex-wrap items-start gap-4 mb-4">
                <div className="text-center flex-shrink-0">
                  <div className="w-16 h-16 flex items-center justify-center text-white text-2xl font-bold bg-[#0B0B0B]">
                    {campaignStage.level === 0 ? '—' : campaignStage.level}
                  </div>
                  <div className="text-[10px] text-[#8A877D] mt-1">
                    {campaignStage.level === 0 ? 'no tier' : 'of 5'}
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-lg font-bold text-[#0B0B0B]">{campaignStage.name}</div>
                  <p className="text-sm text-[#8A877D] leading-relaxed mb-2">{campaignStage.summary}</p>
                  {campaign.verdict && (
                    <p className="text-sm text-[#0B0B0B] font-medium leading-relaxed">{campaign.verdict}</p>
                  )}
                </div>
              </div>

              <CampaignLadder level={campaignStage.level} />

              <p className="text-xs text-[#4A4840] leading-relaxed">{campaignStage.description}</p>
              {campaign.rationale && (
                <p className="text-xs text-[#4A4840] mt-2 leading-relaxed">
                  <span className="font-semibold">Why this level: </span>{campaign.rationale}
                </p>
              )}
              {campaign.toNextLevel && (
                <p className="text-xs text-[#4A4840] mt-2 leading-relaxed">
                  <span className="font-semibold">To reach level {Math.min(5, campaignStage.level + 1)}: </span>
                  {campaign.toNextLevel}
                </p>
              )}
            </div>
          </>
        )}

        {/* ── Profile against benchmark ───────────────────────── */}
        {benchmark && benchmarkAvg && (
          <>
          <h3 className="dc-sec-head mb-4">BENCHMARK COMPARISON</h3>
          <div className="card p-5 mb-3">
            <p className="text-xs text-[#8A877D] mb-3">
              {project.brandName} in solid, the {benchmark.cohortLabel.toLowerCase()} average as the dashed outline.
            </p>
            <div className="flex justify-center">
              <ComparisonSpiderChart
                brands={[{
                  id: 'subject',
                  brandName: project.brandName,
                  totalScore: overall,
                  scores: ATTRIBUTES.reduce((acc, a) => { acc[a.id] = scores?.[a.id]?.score || 0; return acc; }, {}),
                }]}
                size={340}
                industryAvg={benchmarkAvg}
                avgLabel={`${benchmark.cohortLabel} avg`}
                animateOnScroll
              />
            </div>
          </div>
          {/* Guarded on attrRanges because links issued before this shipped
              do not carry it. */}
          {benchmark.attrRanges && (
            <div className="mb-6">
              <BenchmarkSpread benchmark={benchmark} brandName={project.brandName} hideTitle />
            </div>
          )}
          </>
        )}

        {/* ── Conclusion ──────────────────────────────────────── */}
        {payload.conclusion && (
          <>
            <h3 className="dc-sec-head mb-4">CONCLUSIONS</h3>
            <div className="card p-6 mb-6">
              <p className="text-sm text-[#4A4840] leading-relaxed">{payload.conclusion}</p>
            </div>
          </>
        )}

        <p className="text-[11px] text-[#999] text-center py-6">
          Conscious Compass by Antenna Group. Assessed on publicly observable evidence
          {payload.generatedAt ? ` in ${new Date(payload.generatedAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}` : ''}.
        </p>
      </div>
    </div>
  );
}

// Password gate for a client link. Decryption happens in the browser, so a
// wrong password fails locally rather than being validated by a server.
function ClientReportGate({ token }) {
  const [row, setRow] = useState(null);
  const [status, setStatus] = useState('loading');
  const [password, setPassword] = useState('');
  const [payload, setPayload] = useState(null);
  const [error, setError] = useState(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    (async () => {
      const { data, error: err } = await fetchClientReport(token);
      if (err || !data) { setStatus('missing'); return; }
      setRow(data);
      setStatus('locked');
    })();
  }, [token]);

  const unlock = async () => {
    if (!password) return;
    setChecking(true);
    setError(null);
    try {
      const p = await decryptPayload({ cipher: row.cipher, salt: row.salt, iv: row.iv }, password);
      setPayload(p);
      setStatus('open');
    } catch {
      setError('That password does not open this report.');
    } finally {
      setChecking(false);
    }
  };

  if (status === 'open' && payload) return <ClientReportView payload={payload} />;

  return (
    <div className="min-h-screen bg-[#F2F0EA] flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md mb-7 text-center">
        <img
          src="https://ktuyiikwhspwmzvyczit.supabase.co/storage/v1/object/public/assets/brand/antenna-new-logo.svg"
          alt="Antenna Group"
          className="h-9 mx-auto mb-4"
          style={{ filter: 'brightness(0)' }}
        />
        <p className="text-2xl sm:dc-h2 text-[#0B0B0B] leading-tight tracking-tight">
          Consequential brands are conscious brands
        </p>
      </div>

      <div className="card p-8 max-w-md w-full">
        {status === 'loading' && (
          <div className="text-center">
            <Loader2 className="w-6 h-6 animate-spin mx-auto text-[#B23A3A]" />
            <p className="mt-3 text-sm text-[#8A877D]">Loading report...</p>
          </div>
        )}

        {status === 'missing' && (
          <div className="text-center">
            <h1 className="text-lg font-bold text-[#0B0B0B]">Report not found</h1>
            <p className="text-sm text-[#8A877D] mt-2">
              This link is no longer active. Contact the person who shared it with you.
            </p>
          </div>
        )}

        {status === 'locked' && row && (
          <>
            <h1 className="text-xl font-bold text-[#0B0B0B]">{row.brand_name}</h1>
            <p className="text-sm text-[#8A877D] mt-1 mb-5">
              Conscious Compass assessment. Enter the password you were given to view this report.
            </p>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && unlock()}
              placeholder="Password"
              autoFocus
              className="w-full px-3 py-2 border border-[#DCDAD3] bg-white text-sm mb-3"
            />
            {error && <p className="text-xs text-[#B23A3A] mb-3">{error}</p>}
            <button onClick={unlock} disabled={checking || !password}
              className="btn-primary w-full flex items-center justify-center gap-2 text-sm py-2">
              {checking ? <><Loader2 className="w-4 h-4 animate-spin" /> Opening...</> : 'View report'}
            </button>
            <p className="text-[11px] text-[#999] mt-4 leading-relaxed">
              The report is encrypted. The password is not stored anywhere and cannot be recovered.
            </p>
          </>
        )}
      </div>
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

  // A shared report is a frozen record. Campaign level and benchmark both
  // travel inside the shared payload, so the recipient sees exactly the same
  // numbers the assessor did, with no access to the live corpus.
  const sharedCampaign = scores?.campaignCoherence || null;
  const sharedCampaignStage = sharedCampaign && Number.isFinite(Number(sharedCampaign.level))
    ? getCampaignLevel(Number(sharedCampaign.level)) : null;
  const sharedBenchmark = project?.benchmarkSnapshot || null;

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
    <div className="min-h-screen bg-[#F2F0EA]">
      {/* Header */}
      <header className="bg-[#F2F0EA] border-b border-[#DCDAD3] py-5 px-6">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <img src="https://ktuyiikwhspwmzvyczit.supabase.co/storage/v1/object/public/assets/brand/antenna-new-logo.svg" alt="Antenna Group" className="h-8" style={{ filter: 'brightness(0)' }} />
            <div className="h-6 w-px bg-[#0B0B0B]" />
            <span className="dc-kicker text-[#0B0B0B]">Conscious Compass</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-[#8A877D] bg-[#E4E2DC] px-3 py-1">Shared Report (Read-only)</span>
            <button onClick={onClose} className="btn-secondary text-sm">
              Start New Assessment
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto p-8 animate-fade-in">
        {/* Report Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-[#0B0B0B] mb-2">Brand Consciousness Report</h1>
          <p className="text-xl text-[#4A4840]">{project.brandName}</p>
          <p className="text-sm text-[#8A877D] mt-2">{industryName} | {project.businessModel?.toUpperCase() || 'B2B'} | {project.date || 'No date'}</p>
        </div>

        {/* Overall Score */}
        <div className="card p-8 mb-8 text-center bg-gradient-to-br from-[#E53935]/5 to-[#E53935]/10">
          <div className="inline-flex items-center justify-center w-32 h-32 bg-[#DEE42F] text-white mb-4">
            <span className="text-5xl font-bold">{overall}</span>
          </div>
          <h2 className="dc-h2 text-[#0B0B0B] mb-2">{stage.name}</h2>
          <p className="text-[#4A4840] mb-4">{stage.description}</p>
          {scores.headline && (
            <p className="text-lg italic text-[#0B0B0B] border-t border-[#DCDAD3] pt-4 mt-4">
              "{scores.headline}"
            </p>
          )}
        </div>

        {/* Spider Chart */}
        <div className="card p-6 mb-8">
          <h3 className="dc-kicker text-[#0B0B0B] mb-4 text-center">Brand Consciousness Profile</h3>
          <SpiderChart scores={scores} size={450} animate={false} />
        </div>

        {/* Executive Summary */}
        <div className="card p-5 mb-4">
          <h3 className="dc-kicker text-[#0B0B0B] mb-4">EXECUTIVE SUMMARY</h3>
          <p className="text-[#4A4840] leading-relaxed">
            {project.brandName} achieved an overall Brand Consciousness Score of <strong>{overall}/100</strong>, placing them in the "<strong>{stage.name}</strong>" maturity stage. The assessment evaluated the brand across 8 key consciousness attributes. Key strengths emerged in {sortedAttrs.slice(-2).map(a => a.name).join(' and ')}, while opportunities for growth were identified in {sortedAttrs.slice(0, 2).map(a => a.name).join(' and ')}.
          </p>
        </div>

        {/* Score Summary */}
        <div className="card p-5 mb-4">
          <h3 className="dc-kicker text-[#0B0B0B] mb-4">SCORE SUMMARY</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {ATTRIBUTES.map(attr => (
              <div key={attr.id} className="text-center p-3 bg-[#E4E2DC] ">
                <div className="text-2xl font-bold" style={{ color: attr.color }}>{scores[attr.id]?.score || 0}</div>
                <div className="text-xs text-[#8A877D] mt-1">{attr.name}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Maturity Continuum */}
        <MaturityContinuum score={overall} />

        {/* Maturity Stage Context */}
        <div className="card p-5 mb-4">
          <h3 className="dc-kicker text-[#0B0B0B] mb-4">MATURITY STAGE CONTEXT</h3>
          <p className="text-[#4A4840] leading-relaxed">
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
                <h3 className="dc-kicker text-[#0B0B0B]">SIGNAL CONFLICTS</h3>
              </div>
              <p className="text-sm text-[#8A877D] mb-4">These tensions between attribute scores indicate where the brand's performance tells contradictory stories. Each represents a diagnostic insight, not just a gap.</p>
              <div className="space-y-4">
                {conflicts.map((c, i) => (
                  <div key={i} className="bg-[#FFFBEB] border border-[#FDE68A] p-4">
                    <div className="flex items-start justify-between mb-2 gap-3">
                      <h4 className="font-semibold text-[#92400E] text-sm leading-snug">{c.title}</h4>
                      <div className="flex gap-1.5 flex-shrink-0">
                        {c.attributes.map((attr, ai) => (
                          <span key={attr} className="text-[10px] font-bold px-2 py-0.5 bg-[#FEF3C7] text-[#92400E]">
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

        {/* Campaign Coherence */}
        {sharedCampaignStage && (
          <>
            <h3 className="text-xl font-semibold text-[#0B0B0B] mt-8 mb-4">CAMPAIGN COHERENCE</h3>
            <div className="card p-5 mb-8">
              <div className="flex flex-wrap items-start gap-4 mb-4">
                <div className="text-center flex-shrink-0">
                  <div className="w-16 h-16 flex items-center justify-center text-white text-2xl font-bold bg-[#0B0B0B]">
                    {sharedCampaignStage.level === 0 ? '—' : sharedCampaignStage.level}
                  </div>
                  <div className="text-[10px] text-[#8A877D] mt-1">{sharedCampaignStage.level === 0 ? 'no tier' : 'of 5'}</div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-lg font-bold text-[#0B0B0B]">{sharedCampaignStage.name}</div>
                  <p className="text-sm text-[#8A877D] leading-relaxed mb-2">{sharedCampaignStage.summary}</p>
                  {sharedCampaign.verdict && <p className="text-sm text-[#0B0B0B] font-medium leading-relaxed">{sharedCampaign.verdict}</p>}
                </div>
              </div>
              <CampaignLadder level={sharedCampaignStage.level} />
              <p className="text-xs text-[#4A4840] leading-relaxed">{sharedCampaignStage.description}</p>
              {sharedCampaign.rationale && <p className="text-xs text-[#4A4840] mt-2 leading-relaxed"><span className="font-semibold">Why this level:</span> {sharedCampaign.rationale}</p>}
              {sharedCampaign.toNextLevel && <p className="text-xs text-[#4A4840] mt-2 leading-relaxed"><span className="font-semibold">To reach level {Math.min(5, sharedCampaignStage.level + 1)}:</span> {sharedCampaign.toNextLevel}</p>}
              {Array.isArray(sharedCampaign.campaigns) && sharedCampaign.campaigns.length > 0 && (
                <div className="grid md:grid-cols-2 gap-3 mt-4">
                  {sharedCampaign.campaigns.map((c, i) => (
                    <div key={i} className="bg-[#F2F0EA] p-3">
                      <h4 className="font-semibold text-[#0B0B0B] text-sm mb-1">{c.name}</h4>
                      {c.idea && <p className="text-xs text-[#4A4840] leading-relaxed mb-1"><span className="font-semibold">Idea:</span> {c.idea}</p>}
                      {c.evidence && <p className="text-xs text-[#8A877D] leading-relaxed">{c.evidence}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* Benchmark */}
        {sharedBenchmark && (
          <>
            <h3 className="text-xl font-semibold text-[#0B0B0B] mt-8 mb-4">BENCHMARK COMPARISON</h3>
            <div className="space-y-3 mb-8">
              <BenchmarkProvenance benchmark={sharedBenchmark} />
              <BenchmarkPositionBar benchmark={sharedBenchmark} brandName={project.brandName} />
              <BenchmarkSpread benchmark={sharedBenchmark} brandName={project.brandName} />
            </div>
          </>
        )}

        {/* Attribute Analysis */}
        <h3 className="text-xl font-semibold text-[#0B0B0B] mt-8 mb-4">ATTRIBUTE ANALYSIS</h3>
        <div className="space-y-4 mb-8">
          {ATTRIBUTES.map(attr => (
            <div key={attr.id} className="card p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 flex items-center justify-center text-white font-bold text-lg" style={{ backgroundColor: attr.color }}>
                    {scores[attr.id]?.score || 0}
                  </div>
                  <div>
                    <h4 className="font-bold text-[#0B0B0B]">{attr.name}</h4>
                    <p className="text-sm text-[#8A877D]">{attr.fullName}</p>
                  </div>
                </div>
              </div>
              <p className="text-sm text-[#4A4840] mb-2">{scores[attr.id]?.findings || scores[attr.id]?.summary || attr.description}</p>
              {scores[attr.id]?.impact && (
                <p className="text-sm text-[#4A4840] mb-2"><span className="font-semibold">What's driving it:</span> {scores[attr.id].impact}</p>
              )}
              {scores[attr.id]?.actions && (
                <p className="text-sm text-[#4A4840] mb-2"><span className="font-semibold">To improve the score:</span> {scores[attr.id].actions}</p>
              )}
              {scores[attr.id]?.opportunity && (
                <p className="text-sm text-[#B23A3A] italic">{scores[attr.id].opportunity}</p>
              )}
            </div>
          ))}
        </div>

        {/* Recommendations */}
        <h3 className="text-xl font-semibold text-[#0B0B0B] mb-4">INTEGRATED MARKETING RECOMMENDATIONS</h3>
        <p className="text-[#8A877D] mb-4">Based on the assessment, here are 12 priority recommendations to enhance brand consciousness:</p>
        <div className="space-y-4 mb-6">
          {recommendations.map((r, i) => (
            <div key={i} className="card p-5">
              <div className="flex items-start gap-4">
                <div className="w-8 h-8 bg-[#DEE42F] text-white flex items-center justify-center font-bold text-sm flex-shrink-0">{i + 1}</div>
                <div className="flex-1">
                  <h4 className="font-semibold text-[#0B0B0B] mb-2">{r.title}</h4>
                  <p className="text-sm text-[#4A4840] leading-relaxed mb-2">
                    {r.description} {r.impact}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {r.attributes.map((attr, j) => (
                      <span key={j} className="text-xs px-2 py-1 bg-[#DEE42F]/10 text-[#B23A3A] font-medium">{attr}</span>
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
              <h3 className="text-xl font-semibold text-[#0B0B0B] mb-4">RECOMMENDED ANTENNA GROUP SERVICES</h3>
              <p className="text-[#8A877D] mb-4">Based on the lowest scoring attributes, these services would have the greatest impact on improving brand consciousness:</p>
              <div className="grid md:grid-cols-2 gap-4 mb-8">
                {topServices.map((rec, i) => {
                  const attr = ATTRIBUTES.find(a => a.id === rec.attributeId);
                  const attrScore = scores[rec.attributeId]?.score || 0;
                  const budgetStr = rec.service.budget 
                    ? `$${(rec.service.budget.low / 1000).toFixed(0)}K - $${(rec.service.budget.high / 1000).toFixed(0)}K`
                    : 'Contact for pricing';
                  
                  return (
                    <div key={i} className="card p-4 border-l-4" style={{ borderLeftColor: attr?.color || '#E53935' }}>
                      <h4 className="font-semibold text-[#0B0B0B] mb-2">{rec.service.name}</h4>
                      <p className="text-xs text-[#8A877D] mb-2">{rec.service.category}</p>
                      <p className="text-sm text-[#4A4840] mb-2">
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
          <h3 className="dc-kicker text-[#0B0B0B] mb-4">CONCLUSIONS</h3>
          <p className="text-[#4A4840] leading-relaxed">
            {scores.conclusion || `${project.brandName} has demonstrated ${overall >= 60 ? 'strong potential' : 'a foundation'} for building an impactful, conscious brand presence. By focusing on the recommendations outlined above, particularly strengthening ${sortedAttrs[0].name} and ${sortedAttrs[1].name} capabilities, the brand can elevate its market position and create deeper connections with its audience.`}
          </p>
        </div>

        {/* What We Evaluated */}
        <div className="card p-5 mb-4">
          <h3 className="dc-kicker text-[#0B0B0B] mb-4">WHAT WE EVALUATED</h3>
          <p className="text-[#4A4840] leading-relaxed mb-4">
            This assessment was conducted using Antenna Group's Brand Consciousness Framework v{FRAMEWORK_VERSION}, evaluating {project.brandName} across four key dimensions: website presence, social media footprint, AI reputation, and earned media coverage. The business model ({project.businessModel?.toUpperCase() || 'B2B'}) and industry context ({industryName}) were applied to weight attribute importance appropriately.
          </p>
          {report.assessmentSummary && (
            <div className="grid md:grid-cols-2 gap-4 text-sm">
              <div className="bg-[#E4E2DC] p-3 ">
                <h4 className="font-semibold text-[#0B0B0B] mb-2">Website Analysis</h4>
                <p className="text-[#8A877D]">
                  {report.assessmentSummary.pagesReviewed || 'Key pages reviewed'}
                </p>
              </div>
              <div className="bg-[#E4E2DC] p-3 ">
                <h4 className="font-semibold text-[#0B0B0B] mb-2">Social Media</h4>
                <p className="text-[#8A877D]">
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
              <div className="bg-[#E4E2DC] p-3 ">
                <h4 className="font-semibold text-[#0B0B0B] mb-2">AI Reputation</h4>
                <p className="text-[#8A877D]">
                  {[
                    report.assessmentSummary.hasClaudeAI && 'Claude',
                    report.assessmentSummary.hasGeminiAI && 'Gemini',
                    report.assessmentSummary.hasChatGPT && 'ChatGPT',
                  ].filter(Boolean).join(', ') || 'AI platforms queried'}
                </p>
              </div>
              <div className="bg-[#E4E2DC] p-3 ">
                <h4 className="font-semibold text-[#0B0B0B] mb-2">Earned Media</h4>
                <p className="text-[#8A877D]">
                  {report.assessmentSummary.hasEarnedMedia ? 'Coverage from past 3 months reviewed' : 'Media coverage analyzed'}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Score Justification */}
        {scores.justification && (
          <div className="card p-5 mb-4 bg-[#F2F0EA]">
            <h3 className="dc-kicker text-[#0B0B0B] mb-4">SCORE JUSTIFICATION</h3>
            <p className="text-sm text-[#4A4840] leading-relaxed">
              {scores.justification}
            </p>
          </div>
        )}

        {/* Footer */}
        <div className="text-center pt-8 border-t border-[#DCDAD3]">
          <p className="text-sm text-[#B3B0A8]">
            This report was generated using Antenna Group's Brand Consciousness Framework v{FRAMEWORK_VERSION}
          </p>
          <p className="text-xs text-[#B3B0A8] mt-2">
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

function StayConsciousPage({ onBack, isAdmin, copyDeepLink }) {
  const [newsletter, setNewsletter] = useState(null);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError]           = useState(null);
  const [refreshedAt, setRefreshedAt] = useState(null);
  const [exportingDocx, setExportingDocx] = useState(false);

  // ── Data loading ────────────────────────────────────────────────
  const loadNewsletter = async () => {
    setLoading(true); setError(null);
    try {
      const res  = await fetch('/api/stay-conscious-newsletter');
      const data = await res.json();
      if (data.newsletter) {
        setNewsletter(data.newsletter);
        setRefreshedAt(data.refreshedAt ? new Date(data.refreshedAt) : null);
      } else {
        setError(data.error || 'No newsletter available yet — check back after Sunday night.');
      }
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  const forceRefresh = async () => {
    setRefreshing(true); setError(null);
    try {
      const res  = await fetch('/api/refresh-stay-conscious-newsletter', { method: 'POST' });
      const data = await res.json();
      if (data.success) { await loadNewsletter(); }
      else { throw new Error(data.error || 'Refresh failed'); }
    } catch (e) { setError(`Refresh failed: ${e.message}`); }
    finally { setRefreshing(false); }
  };

  useEffect(() => { loadNewsletter(); }, []);

  // ── Helpers ─────────────────────────────────────────────────────
  const nextSunday = () => {
    const d = new Date();
    const daysUntil = (7 - d.getDay()) % 7 || 7;
    d.setDate(d.getDate() + daysUntil);
    d.setHours(23, 30, 0, 0);
    return d;
  };

  const fmtDate = (d) => d
    ? d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }) +
      ' at ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : null;

  const CATEGORY_COLORS = {
    'AI Visibility':       '#6366F1',
    'Digital Experience':  '#0EA5E9',
    'Brand Strategy':      '#E53935',
    'Earned Media':        '#F59E0B',
    'Social Signals':      '#10B981',
    'Assessment Practice': '#8B5CF6',
  };
  const catColor  = (cat) => CATEGORY_COLORS[cat] || '#8A877D';
  const catBg     = (cat) => (catColor(cat)) + '18';

  const clean = (t) => (t || '').replace(/[—–]/g, '-');

  // ── Plain-text format for email ─────────────────────────────────
  const buildPlainText = () => {
    if (!newsletter) return '';
    const ns = newsletter;
    const divider = '─'.repeat(60);
    const lines = [
      `STAY CONSCIOUS  |  Issue #${ns.issueNumber}  |  Week of ${ns.weekOf}`,
      `Brand intelligence from Antenna Group · Conscious Compass`,
      divider,
      '',
      `LEAD STORY — ${ns.leadStory?.category?.toUpperCase()}`,
      ns.leadStory?.headline,
      '',
      ns.leadStory?.insight,
      '',
      `Why it matters: ${ns.leadStory?.whyItMatters}`,
      '',
      divider,
      '',
      'BRAND INTELLIGENCE',
      '',
      ...(ns.intelligenceItems || []).flatMap(item => [
        `[${item.category?.toUpperCase()}]  ${item.headline}`,
        item.insight,
        `Why it matters: ${item.whyItMatters}`,
        '',
      ]),
      divider,
      '',
    ];
    if (ns.landscapeAnalysis?.summary) {
      lines.push('LANDSCAPE INSIGHTS', '');
      if (ns.landscapeAnalysis.headline) lines.push(ns.landscapeAnalysis.headline, '');
      lines.push(ns.landscapeAnalysis.summary, '');
      if (ns.landscapeAnalysis.insights) {
        lines.push(ns.landscapeAnalysis.insights, '');
      }
      lines.push(divider, '');
    }
    if (ns.storyOpportunities?.length) {
      lines.push('STORY OPPORTUNITIES', '');
      ns.storyOpportunities.forEach((s, i) => {
        lines.push(`${i + 1}. ${s.headline}`, s.body, '');
      });
      lines.push(divider, '');
    }
    lines.push(
      `Last updated: ${fmtDate(refreshedAt) || 'Unknown'}`,
      `Next update: ${fmtDate(nextSunday())}`,
      '',
      'Generated by Conscious Compass · Antenna Group',
    );
    return lines.join('\n');
  };

  const handleEmailShare = () => {
    if (!newsletter) return;
    const ns = newsletter;
    const CRLF = '%0D%0A';
    const div  = '─'.repeat(50);

    const line = (text) => encodeURIComponent(text || '').replace(/%0A/g, CRLF) + CRLF;

    let body = '';
    body += line(`STAY CONSCIOUS  |  Issue #${ns.issueNumber}  |  Week of ${ns.weekOf}`);
    body += line('Brand intelligence from Antenna Group · Conscious Compass');
    body += line(div);
    body += CRLF;
    body += line(`LEAD STORY — ${ns.leadStory?.category?.toUpperCase()}`);
    body += line(ns.leadStory?.headline);
    body += CRLF;
    body += line(ns.leadStory?.insight);
    body += CRLF;
    body += line(`Why it matters: ${ns.leadStory?.whyItMatters}`);
    body += CRLF;
    body += line(div);
    body += CRLF;
    body += line('BRAND INTELLIGENCE');
    body += CRLF;
    (ns.intelligenceItems || []).forEach(item => {
      body += line(`[${(item.category || '').toUpperCase()}]  ${item.headline}`);
      body += line(item.insight);
      body += line(`Why it matters: ${item.whyItMatters}`);
      body += CRLF;
    });
    if (ns.landscapeAnalysis?.summary) {
      body += line(div);
      body += CRLF;
      body += line('LANDSCAPE INSIGHTS');
      body += CRLF;
      const combined = [ns.landscapeAnalysis.summary, ns.landscapeAnalysis.insights].filter(Boolean).join(' ');
      const words = combined.split(/\s+/);
      body += line(words.length > 250 ? words.slice(0, 250).join(' ') + '…' : combined);
      body += CRLF;
    }
    if (ns.storyOpportunities?.length) {
      body += line(div);
      body += CRLF;
      body += line('STORY OPPORTUNITIES');
      body += CRLF;
      ns.storyOpportunities.forEach((s, i) => {
        const firstSentence = (s.body || '').split(/[.!?]/)[0].trim();
        body += line(`${i + 1}. ${s.headline}`);
        body += line(firstSentence + '.');
        body += CRLF;
      });
    }
    body += line(div);
    body += CRLF;
    body += line(`Last updated: ${fmtDate(refreshedAt) || 'Unknown'}`);
    body += line(`Next update: ${fmtDate(nextSunday())}`);
    body += CRLF;
    body += line('Generated by Conscious Compass · Antenna Group');

    const subject = encodeURIComponent(`Stay Conscious — Issue #${ns.issueNumber} | Week of ${ns.weekOf}`);
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  const handleCopyText = () => {
    navigator.clipboard.writeText(buildPlainText()).then(() => {
      alert('Newsletter text copied to clipboard.');
    });
  };

  // ── DOCX export ─────────────────────────────────────────────────
  const handleExportDocx = async () => {
    if (!newsletter) return;
    setExportingDocx(true);
    try {
      const ns = newsletter;
      const LOGO_URL = 'https://ktuyiikwhspwmzvyczit.supabase.co/storage/v1/object/public/assets/brand/antenna-new-logo.svg';

      const svgToPng = (svgStr, w, h) => new Promise((res, rej) => {
        const blob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
        const url  = URL.createObjectURL(blob);
        const img  = new window.Image();
        img.onload = () => {
          const c = document.createElement('canvas');
          c.width = w; c.height = h;
          const ctx = c.getContext('2d');
          ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, w, h);
          ctx.drawImage(img, 0, 0, w, h);
          URL.revokeObjectURL(url);
          res(c.toDataURL('image/png').split(',')[1]);
        };
        img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('SVG render failed')); };
        img.src = url;
      });

      let logoB64 = null;
      try {
        const r = await fetch(LOGO_URL);
        logoB64 = await svgToPng(await r.text(), 200, 56);
      } catch { /* logo optional */ }

      const hex  = (h) => h.replace('#', '');
      const sp   = (before = 0, after = 160) => ({ spacing: { before, after } });
      const body = (text, after = 160) => new Paragraph({ ...sp(0, after), children: [new TextRun({ text: clean(text), font: 'Inter', size: 20, color: '1A1A1A' })] });
      const h2   = (text) => new Paragraph({ heading: HeadingLevel.HEADING_2, ...sp(280, 80), children: [new TextRun({ text, font: 'Inter', bold: true, size: 28, color: '1A1A1A' })] });
      const rule = () => new Paragraph({ border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: 'D9D6D0', space: 1 } }, ...sp(0, 0) });
      const label = (text, color) => new Paragraph({ ...sp(0, 60), children: [new TextRun({ text: text.toUpperCase(), font: 'Inter', size: 16, bold: true, color: hex(color || '#8A877D') })] });

      const doc = new Document({
        styles: {
          default: { document: { run: { font: 'Inter', size: 20 }, paragraph: { spacing: { line: 276, lineRule: 'auto' } } } },
          paragraphStyles: [
            { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
              run: { size: 52, bold: true, font: 'Inter', color: '1A1A1A' },
              paragraph: { spacing: { before: 240, after: 100 }, outlineLevel: 0 } },
            { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
              run: { size: 28, bold: true, font: 'Inter', color: '1A1A1A' },
              paragraph: { spacing: { before: 240, after: 80 }, outlineLevel: 1 } },
          ],
        },
        sections: [{
          properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1080, right: 1080, bottom: 1440, left: 1080 } } },
          footers: { default: new DocxFooter({ children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({
              text: `Stay Conscious  |  Issue #${ns.issueNumber}  |  Week of ${ns.weekOf}  |  Antenna Group  |  Conscious Compass`,
              size: 16, font: 'Inter', color: '999999',
            })],
          })] }) },
          children: [
            // Cover
            ...(logoB64 ? [new Paragraph({ ...sp(0, 400), children: [new ImageRun({ data: logoB64, transformation: { width: 150, height: 42 }, type: 'png' })] })] : [new Paragraph({ ...sp(0, 400) })]),
            new Paragraph({ heading: HeadingLevel.HEADING_1, ...sp(0, 60), children: [
              new TextRun({ text: 'Stay Conscious', bold: true, font: 'Inter', size: 56, color: '1A1A1A' }),
            ]}),
            new Paragraph({ ...sp(0, 80), children: [
              new TextRun({ text: `Issue #${ns.issueNumber}  |  Week of ${ns.weekOf}`, font: 'Inter', size: 22, color: '666666' }),
            ]}),
            new Paragraph({ ...sp(0, 60), children: [
              new TextRun({ text: 'Brand intelligence from Antenna Group · Conscious Compass', font: 'Inter', size: 18, color: '999999' }),
            ]}),
            rule(),

            // Timestamps
            new Paragraph({ ...sp(120, 40), children: [
              new TextRun({ text: `Last updated: `, font: 'Inter', size: 18, bold: true, color: '666666' }),
              new TextRun({ text: fmtDate(refreshedAt) || 'Unknown', font: 'Inter', size: 18, color: '666666' }),
            ]}),
            new Paragraph({ ...sp(0, 240), children: [
              new TextRun({ text: `Next update: `, font: 'Inter', size: 18, bold: true, color: '666666' }),
              new TextRun({ text: fmtDate(nextSunday()), font: 'Inter', size: 18, color: '666666' }),
            ]}),
            rule(),

            // Lead Story
            h2('Lead Story'),
            label(ns.leadStory?.category || '', catColor(ns.leadStory?.category)),
            new Paragraph({ ...sp(0, 80), children: [
              new TextRun({ text: clean(ns.leadStory?.headline || ''), font: 'Inter', size: 26, bold: true, color: '1A1A1A' }),
            ]}),
            body(clean(ns.leadStory?.insight || ''), 80),
            new Paragraph({ ...sp(0, 200), children: [
              new TextRun({ text: 'Why it matters: ', font: 'Inter', size: 20, bold: true }),
              new TextRun({ text: clean(ns.leadStory?.whyItMatters || ''), font: 'Inter', size: 20, italics: true }),
            ]}),
            rule(),

            // Intelligence Items
            h2('Brand Intelligence'),
            ...(ns.intelligenceItems || []).flatMap(item => [
              label(item.category || '', catColor(item.category)),
              new Paragraph({ ...sp(0, 60), children: [
                new TextRun({ text: clean(item.headline || ''), font: 'Inter', size: 22, bold: true, color: '1A1A1A' }),
              ]}),
              body(clean(item.insight || ''), 60),
              new Paragraph({ ...sp(0, 160), children: [
                new TextRun({ text: 'Why it matters: ', font: 'Inter', size: 20, bold: true }),
                new TextRun({ text: clean(item.whyItMatters || ''), font: 'Inter', size: 20, italics: true }),
              ]}),
            ]),
            rule(),

            // Landscape Insights
            ...(ns.landscapeAnalysis?.summary ? [
              h2('Landscape Insights'),
              ...(ns.landscapeAnalysis.brandCount ? [new Paragraph({ ...sp(0, 80), children: [
                new TextRun({ text: `Based on ${ns.landscapeAnalysis.brandCount} brands across ${ns.landscapeAnalysis.sectorCount} sectors`, font: 'Inter', size: 18, color: '999999' }),
              ]})] : []),
              ...(ns.landscapeAnalysis.headline ? [new Paragraph({ ...sp(0, 80), children: [
                new TextRun({ text: clean(ns.landscapeAnalysis.headline), font: 'Inter', size: 26, bold: true, color: '1A1A1A' }),
              ]})] : []),
              body(clean(ns.landscapeAnalysis.summary), 80),
              ...(ns.landscapeAnalysis.insights ? [body(clean(ns.landscapeAnalysis.insights), 160)] : []),
              rule(),
            ] : []),

            // Story Opportunities
            ...(ns.storyOpportunities?.length ? [
              h2('Story Opportunities'),
              body('Thought leadership angles your data suggests right now.', 160),
              ...(ns.storyOpportunities).flatMap((s, i) => [
                new Paragraph({ ...sp(120, 60), children: [
                  new TextRun({ text: `${i + 1}.  `, font: 'Inter', size: 22, bold: true, color: 'E8FF00' }),
                  new TextRun({ text: clean(s.headline || ''), font: 'Inter', size: 22, bold: true, color: '1A1A1A' }),
                ]}),
                body(clean(s.body || ''), 160),
              ]),
            ] : []),

          ],
        }],
      });

      const blob = await Packer.toBlob(doc);
      saveAs(blob, `Stay_Conscious_Issue_${ns.issueNumber}_${ns.weekOf.replace(/\s/g, '_')}.docx`);
    } catch (e) {
      alert('DOCX error: ' + e.message);
    } finally {
      setExportingDocx(false);
    }
  };

  // ── Render ──────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#F2F0EA]">
      <div className="dc-wrap dc-page pt-8">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between mb-8 gap-4">
          <div className="flex items-start gap-4">
            <button onClick={onBack} className="btn-secondary flex items-center gap-2 flex-shrink-0">
              <ArrowLeft className="w-4 h-4" /> Back
            </button>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Sparkles className="w-5 h-5 text-[#6366F1]" />
                <h1 className="dc-h2 text-[#0B0B0B]">Stay Conscious</h1>
                {newsletter && (
                  <span className="text-xs font-medium px-2 py-0.5 bg-[#0B0B0B] text-white">
                    Issue #{newsletter.issueNumber}
                  </span>
                )}
              </div>
              <p className="text-sm text-[#8A877D]">Brand intelligence for assessors. What's shifting, why it matters.</p>
              <div className="text-xs text-[#B3B0A8] mt-0.5 space-y-0.5">
                {refreshedAt && <p>Updated {fmtDate(refreshedAt)}</p>}
                <p>Next update {fmtDate(nextSunday())}</p>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap gap-2 self-start">
            {newsletter && (
              <>
                <button
                  onClick={handleExportDocx}
                  disabled={exportingDocx}
                  className="btn-primary flex items-center gap-2 text-sm"
                >
                  {exportingDocx ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                  DOCX
                </button>
                <button
                  onClick={handleCopyText}
                  className="btn-secondary flex items-center gap-2 text-sm"
                >
                  <Copy className="w-4 h-4" /> Copy
                </button>
              </>
            )}
            {copyDeepLink && (
              <button
                onClick={copyDeepLink}
                className="btn-secondary flex items-center gap-2 text-sm"
                title="Copy link to this page"
              >
                <Share2 className="w-4 h-4" /> Share Link
              </button>
            )}
            {isAdmin && (
              <button
                onClick={forceRefresh}
                disabled={refreshing || loading}
                className="btn-secondary flex items-center gap-2 text-sm"
                title="Force refresh for all users"
              >
                {refreshing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                {refreshing ? 'Refreshing...' : 'Force Refresh'}
              </button>
            )}
          </div>
        </div>

        {/* Loading */}
        {(loading || refreshing) && (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="w-12 h-12 bg-[#6366F1]/10 flex items-center justify-center">
              <Loader2 className="w-6 h-6 text-[#6366F1] animate-spin" />
            </div>
            <p className="text-sm text-[#8A877D]">{refreshing ? 'Composing this week\'s edition...' : 'Loading newsletter...'}</p>
          </div>
        )}

        {/* Error */}
        {error && !loading && !refreshing && (
          <div className="card p-8 text-center">
            <AlertCircle className="w-10 h-10 text-[#B23A3A] mx-auto mb-3" />
            <p className="text-[#8A877D] mb-4">{error}</p>
            <button onClick={loadNewsletter} className="btn-primary">Try Again</button>
          </div>
        )}

        {/* Empty */}
        {!newsletter && !loading && !error && (
          <div className="card p-12 text-center">
            <Sparkles className="w-10 h-10 text-[#DCDAD3] mx-auto mb-3" />
            <p className="text-[#8A877D]">No newsletter available yet.</p>
            {isAdmin && <p className="text-sm text-[#B3B0A8] mt-2">Use Force Refresh to generate the first edition.</p>}
          </div>
        )}

        {/* Newsletter */}
        {newsletter && !loading && !refreshing && (
          <div className="space-y-6">

            {/* Lead Story */}
            <div className="bg-[#0B0B0B] p-6 md:p-8">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1"
                  style={{ backgroundColor: catColor(newsletter.leadStory?.category) + '30', color: catColor(newsletter.leadStory?.category) }}>
                  {newsletter.leadStory?.category}
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#555] px-2.5 py-1 bg-white/5">
                  Lead Story
                </span>
              </div>
              <h2 className="dc-h2 font-bold text-white leading-snug mb-4">
                {newsletter.leadStory?.headline}
              </h2>
              <p className="text-[#D1D5DB] leading-relaxed mb-4">{newsletter.leadStory?.insight}</p>
              <div className="border-t border-white/10 pt-4">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-[#6B7280]">Why it matters for assessment</span>
                <p className="text-sm text-[#B3B0A8] leading-relaxed mt-1">{newsletter.leadStory?.whyItMatters}</p>
              </div>
            </div>

            {/* Intelligence items */}
            {newsletter.intelligenceItems?.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-[#0B0B0B] uppercase tracking-wider mb-4">Brand Intelligence</h2>
                <div className="space-y-4">
                  {newsletter.intelligenceItems.map((item, i) => (
                    <div key={i} className="card p-5">
                      <div className="flex items-start gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-[10px] font-semibold uppercase tracking-wider px-2.5 py-1"
                              style={{ backgroundColor: catBg(item.category), color: catColor(item.category) }}>
                              {item.category}
                            </span>
                            <div className="w-1.5 h-1.5 flex-shrink-0" style={{ backgroundColor: catColor(item.category) }} />
                          </div>
                          <h3 className="font-semibold text-[#0B0B0B] leading-snug mb-2">{item.headline}</h3>
                          <p className="text-sm text-[#4A4840] leading-relaxed">{item.insight}</p>
                        </div>
                      </div>
                      <div className="border-t border-[#DCDAD3] pt-3 mt-3">
                        <div className="text-[10px] font-semibold uppercase tracking-wider text-[#B3B0A8] mb-1">Why it matters for assessment</div>
                        <p className="text-xs text-[#8A877D] leading-relaxed">{item.whyItMatters}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Landscape Insights */}
            {newsletter.landscapeAnalysis?.summary && (
              <div>
                <h2 className="text-sm font-semibold text-[#0B0B0B] uppercase tracking-wider mb-4">Landscape Insights</h2>
                <div className="bg-white border border-[#DCDAD3] p-6">
                  {newsletter.landscapeAnalysis.brandCount && (
                    <p className="text-xs text-[#999] mb-3">
                      Based on {newsletter.landscapeAnalysis.brandCount} brands across {newsletter.landscapeAnalysis.sectorCount} sectors
                    </p>
                  )}
                  {newsletter.landscapeAnalysis.headline && (
                    <h3 className="font-bold text-[#0B0B0B] text-lg leading-snug mb-3">
                      {newsletter.landscapeAnalysis.headline}
                    </h3>
                  )}
                  {(() => {
                    const text = newsletter.landscapeAnalysis.summary || '';
                    const paras = text.split(/\n\n+/).map(p => p.trim()).filter(Boolean);
                    if (paras.length >= 2) {
                      return paras.slice(0, 2).map((para, i) => (
                        <p key={i} className={`text-sm text-[#444] leading-relaxed${i === 0 ? ' mb-3' : ''}`}>{para}</p>
                      ));
                    }
                    // Fallback: single block, capped at 250 words
                    const words = text.split(/\s+/);
                    return <p className="text-sm text-[#444] leading-relaxed">{words.length > 250 ? words.slice(0, 250).join(' ') + '…' : text}</p>;
                  })()}
                </div>
              </div>
            )}

            {/* Story Opportunities */}
            {newsletter.storyOpportunities?.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-[#0B0B0B] uppercase tracking-wider mb-4">Story Opportunities</h2>
                <div className="space-y-3">
                  {newsletter.storyOpportunities.map((story, idx) => (
                    <div key={idx} className="card p-4 flex items-start gap-4">
                      <div className="w-7 h-7 bg-[#DEE42F] text-[#0B0B0B] flex items-center justify-center flex-shrink-0 font-bold text-xs mt-0.5">
                        {idx + 1}
                      </div>
                      <div>
                        <div className="font-semibold text-[#0B0B0B] leading-snug">{story.headline}</div>
                        <div className="dc-standfirst">
                          {(story.body || '').split(/[.!?]/)[0].trim()}{story.body?.match(/[.!?]/) ? '.' : ''}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Footer note */}
            <p className="text-center text-xs text-[#B3B0A8] mt-8">
              Insights generated by Claude. Always apply your own professional judgement.
            </p>
          </div>
        )}
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
    businessModel: 'b2b', industry: 'other', date: new Date().toISOString().split('T')[0], assessorContext: '',
    additionalProperties: [], primaryLanguage: ''
  });
  const [assessments, setAssessments] = useState({
    website: { status: 'pending', content: '', observations: '', images: [], pagesReviewed: '', websiteContent: '', credentialsContent: '', seoAssessment: '', techAudit: null },
    social: { status: 'pending', content: '', observations: '', socialHealthCheck: '', linkedinUrl: '', linkedinAbout: '', linkedinPosts: '', linkedinArticles: '', linkedinFollowers: '', employeeAdvocacy: '', awardsRecognition: '', hashtagContent: '', paidMediaContent: '', campaignContent: '', linkedinAuto: '', xAuto: '', instagramAuto: '', youtubeAuto: '', otherPlatformsAuto: '', glassdoorAuto: '', campaignAuto: '', thirdPartyAuto: '', xUrl: '', xContent: '', instagramContent: '', youtubeContent: '', hasYouTube: true, redditAnswersContent: '', wikipediaContent: '', glassdoorContent: '', wipoContent: '', socialImages: [], instagramImages: [] },
    aiReputation: { status: 'pending', content: '', observations: '', responses: {} },
    earnedMedia: { status: 'pending', content: '', observations: '', coveragePaste: '' },
  });
  const [scores, setScores] = useState(null);
  const [showSavedPage, setShowSavedPage] = useState(false);
  const [showResultsPage, setShowResultsPage] = useState(false);
  const [showComparisonPage, setShowComparisonPage] = useState(false);
  const [showStayConsciousPage, setShowStayConsciousPage] = useState(false);
  const [compareInitialTab, setCompareInitialTab] = useState('brands');
  // Guards against the sync effect wiping an inbound hash before the parse effect reads it on mount
  const initialHashHandled = useRef(false);

  // Hash-based deep link routing
  const HASH_ROUTES = {
    'newsletter':        () => { setShowStayConsciousPage(true); setShowComparisonPage(false); setShowResultsPage(false); setShowSavedPage(false); },
    'compare':           () => { setShowComparisonPage(true); setCompareInitialTab('brands'); setShowStayConsciousPage(false); setShowResultsPage(false); setShowSavedPage(false); },
    'compare/landscape': () => { setShowComparisonPage(true); setCompareInitialTab('landscape'); setShowStayConsciousPage(false); setShowResultsPage(false); setShowSavedPage(false); },
    'compare/insights':  () => { setShowComparisonPage(true); setCompareInitialTab('insights'); setShowStayConsciousPage(false); setShowResultsPage(false); setShowSavedPage(false); },
    'results':           () => { setShowResultsPage(true); setShowComparisonPage(false); setShowStayConsciousPage(false); setShowSavedPage(false); },
    'saved':             () => { setShowSavedPage(true); setShowComparisonPage(false); setShowResultsPage(false); setShowStayConsciousPage(false); },
  };

  const navigateTo = (route) => {
    const fn = HASH_ROUTES[route];
    if (fn) {
      fn();
      window.history.pushState(null, '', `#${route}`);
    }
  };

  const clearNav = () => {
    setShowStayConsciousPage(false);
    setShowComparisonPage(false);
    setShowResultsPage(false);
    setShowSavedPage(false);
    setCurrentStep(0);
    window.history.pushState(null, '', window.location.pathname + window.location.search);
  };

  const copyDeepLink = (hash) => {
    const url = `${window.location.origin}${window.location.pathname}#${hash}`;
    navigator.clipboard.writeText(url).then(() => {
      alert(`Link copied: ${url}`);
    });
  };

  // Sync URL hash whenever view changes
  useEffect(() => {
    // Don't run until the inbound hash has been parsed on mount, or this wipes it
    if (!initialHashHandled.current) return;
    // Don't overwrite ?report= param links
    if (new URLSearchParams(window.location.search).get('report')) return;
    let hash = '';
    if (showStayConsciousPage) hash = 'newsletter';
    else if (showComparisonPage) hash = compareInitialTab === 'landscape' ? 'compare/landscape' : compareInitialTab === 'insights' ? 'compare/insights' : 'compare';
    else if (showResultsPage) hash = 'results';
    else if (showSavedPage) hash = 'saved';
    const current = window.location.hash.replace('#', '');
    if (hash !== current) {
      window.history.replaceState(null, '', hash ? `#${hash}` : window.location.pathname + window.location.search);
    }
  }, [showStayConsciousPage, showComparisonPage, showResultsPage, showSavedPage, compareInitialTab]);

  // Parse hash on mount and on popstate
  useEffect(() => {
    const applyHash = () => {
      const hash = window.location.hash.replace('#', '');
      if (hash && HASH_ROUTES[hash]) HASH_ROUTES[hash]();
    };
    applyHash();
    initialHashHandled.current = true;
    window.addEventListener('popstate', applyHash);
    return () => window.removeEventListener('popstate', applyHash);
  }, []);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [savedAssessments, setSavedAssessments] = useState([]);
  const [compassResults, setCompassResults] = useState([]);
  const [sharedReport, setSharedReport] = useState(null);
  const [lastAutoSave, setLastAutoSave] = useState(null);
  const [draftRestoreOffer, setDraftRestoreOffer] = useState(null); // { project, assessments, scores, currentStep, savedAt }

  // Draft key scoped to user
  const getDraftKey = (userId) => `cc-draft-${userId}`;

  // Auto-save draft to localStorage whenever assessment state changes
  useEffect(() => {
    if (!user || currentStep === 0 || !project.brandName) return;
    const key = getDraftKey(user.id);
    try {
      const draft = {
        project,
        assessments: {
          ...assessments,
          website: { ...assessments.website, images: [] },
          social: { ...assessments.social, socialImages: [], instagramImages: [] },
        },
        scores,
        currentStep,
        savedAt: new Date().toISOString(),
      };
      localStorage.setItem(key, JSON.stringify(draft));
      setLastAutoSave(new Date());
    } catch (e) {
      // localStorage quota exceeded — silently ignore
    }
  }, [project, assessments, scores, currentStep, user]);

  // Check for saved draft when user logs in
  useEffect(() => {
    if (!user) return;
    const key = getDraftKey(user.id);
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return;
      const draft = JSON.parse(raw);
      // Only offer restore if there's a real brand name and it's not step 0
      if (draft.project?.brandName && draft.currentStep > 0) {
        setDraftRestoreOffer(draft);
      }
    } catch (e) {
      localStorage.removeItem(getDraftKey(user.id));
    }
  }, [user]);

  const clearDraft = () => {
    if (user) localStorage.removeItem(getDraftKey(user.id));
    setDraftRestoreOffer(null);
  };

  const restoreDraft = (draft) => {
    setProject(draft.project);
    setAssessments(draft.assessments);
    setScores(draft.scores || null);
    setCurrentStep(draft.currentStep || 1);
    setDraftRestoreOffer(null);
  };

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
          createdAt: r.created_at,
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
      clearDraft();
      setCurrentStep(0);
      setShowSavedPage(false);
      setProject({ brandName: '', websiteUrl: '', businessModel: 'b2b', industry: 'other', date: new Date().toISOString().split('T')[0], assessorContext: '', additionalProperties: [], primaryLanguage: '' });
      setAssessments({
        website: { status: 'pending', content: '', observations: '', images: [], pagesReviewed: '', websiteContent: '', credentialsContent: '', seoAssessment: '', techAudit: null },
        social: { status: 'pending', content: '', observations: '', socialHealthCheck: '', linkedinUrl: '', linkedinAbout: '', linkedinPosts: '', linkedinArticles: '', linkedinFollowers: '', employeeAdvocacy: '', awardsRecognition: '', hashtagContent: '', paidMediaContent: '', campaignContent: '', linkedinAuto: '', xAuto: '', instagramAuto: '', youtubeAuto: '', otherPlatformsAuto: '', glassdoorAuto: '', campaignAuto: '', thirdPartyAuto: '', xUrl: '', xContent: '', instagramContent: '', youtubeContent: '', hasYouTube: true, redditAnswersContent: '', wikipediaContent: '', glassdoorContent: '', wipoContent: '', socialImages: [], instagramImages: [] },
        aiReputation: { status: 'pending', content: '', observations: '', responses: {} },
        earnedMedia: { status: 'pending', content: '', observations: '', coveragePaste: '' },
      });
      setScores(null);
    }
  };

  const handleGoHome = () => {
    clearNav();
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

      // Freeze the benchmark at save time. A report is a deliverable: the
      // comparison a client reads must not silently shift as the corpus grows,
      // and a shared report has no access to the reader's results.
      let benchmarkSnapshot = null;
      if (scores) {
        const overallForBenchmark = Math.round(
          Object.entries(scores)
            .filter(([, val]) => val && typeof val.score === 'number')
            .reduce((a, [, v]) => a + v.score, 0) / 8
        );
        benchmarkSnapshot = buildBenchmarkSnapshot(compassResults, {
          industry: project.industry,
          industryName: INDUSTRIES.find(i => i.id === project.industry)?.name || null,
          brandName: project.brandName,
          totalScore: overallForBenchmark,
          scores,
        });
      }

      // Stored inside the project blob rather than a new column, so this
      // needs no Supabase migration. project is already an open JSON field.
      const projectToSave = benchmarkSnapshot
        ? { ...project, benchmarkSnapshot }
        : project;

      // Save to Supabase - saved assessments
      const { error: saveError } = await saveAssessment({
        project: projectToSave,
        assessments: assessmentsToSave,
        scores,
      });
      
      if (saveError) throw saveError;

      // Keep the in-memory report on the same frozen numbers as the saved one.
      if (benchmarkSnapshot) setProject(projectToSave);

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
          // Campaign level rides inside scores so it persists without a schema
          // change and becomes benchmarkable once enough assessments carry it.
          campaignLevel: scores.campaignCoherence?.level ?? null,
          // Channel shares only. Enough to build sector footprint averages
          // later without carrying the prose evidence into the results table.
          footprintShares: scores.footprint?.channels
            ? Object.fromEntries(FOOTPRINT_CHANNELS.map(c => [c.id, Number(scores.footprint.channels[c.id]?.share) || 0]))
            : null,
          isManual: false,
          assessorName: profile?.full_name || user?.email?.split('@')[0] || 'Unknown',
          rubricVersion: FRAMEWORK_VERSION,
        };
        
        await saveCompassResult(resultData);
      }

      // Reload data from Supabase
      await loadDataFromSupabase();
      clearDraft();
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
    // Clear every page flag, not just the saved list. If any other page flag is
    // still set, its view wins over the step flow and the rescore appears to do
    // nothing at all.
    setShowSavedPage(false);
    setShowResultsPage(false);
    setShowComparisonPage(false);
    setShowStayConsciousPage(false);
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
        hasLinkedIn: !!(assessment.assessments?.social?.linkedinAuto || assessment.assessments?.social?.linkedinAbout),
        hasX: !!(assessment.assessments?.social?.xAuto || assessment.assessments?.social?.xContent),
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
      <div className="min-h-screen bg-[#F2F0EA] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-[#B23A3A]" />
          <p className="mt-4 text-[#8A877D]">Loading...</p>
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
      <div className="min-h-screen bg-[#F2F0EA]">
        <Header 
          onNewAssessment={handleNewAssessment}
          onGoHome={handleGoHome}
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
        <StayConsciousPage
          onBack={() => setShowStayConsciousPage(false)}
          isAdmin={profile?.is_admin}
          copyDeepLink={() => copyDeepLink('newsletter')}
        />
      </div>
    );
  }

  // Show comparison page
  if (showComparisonPage) {
    return (
      <div className="min-h-screen bg-[#F2F0EA]">
        <Header 
          onNewAssessment={handleNewAssessment}
          onGoHome={handleGoHome} 
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
          profile={profile}
          initialTab={compareInitialTab}
          copyDeepLink={copyDeepLink}
        />
      </div>
    );
  }

  // Show compass results page
  if (showResultsPage) {
    return (
      <div className="min-h-screen bg-[#F2F0EA]">
        <Header 
          onNewAssessment={handleNewAssessment}
          onGoHome={handleGoHome} 
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
      <div className="min-h-screen bg-[#F2F0EA]">
        <Header 
          onNewAssessment={handleNewAssessment}
          onGoHome={handleGoHome} 
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
    <div className="min-h-screen bg-[#F2F0EA]">
      {/* Onboarding Tour */}
      {showOnboarding && !isReadonly && (
        <OnboardingTour onComplete={() => setShowOnboarding(false)} />
      )}
      
      <Header 
        onNewAssessment={handleNewAssessment}
          onGoHome={handleGoHome} 
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
          <ReportPage project={project} setProject={setProject} scores={scores} setScores={setScores} assessments={assessments} apiKey={apiKey} onSave={handleSave} onPrev={() => setCurrentStep(0)} profile={profile} compassResults={compassResults} savedBenchmark={project.benchmarkSnapshot || null} />
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

          {/* Draft restore banner */}
          {currentStep === 0 && draftRestoreOffer && (
            <div className="max-w-2xl mx-auto px-4 pt-6">
              <div className="flex items-start gap-4 bg-[#FFFBEB] border border-[#FCD34D] px-5 py-4 ">
                <span className="text-2xl leading-none mt-0.5">🔄</span>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-[#92400E] text-sm">Unsaved assessment found</p>
                  <p className="text-xs text-[#B45309] mt-0.5">
                    <strong>{draftRestoreOffer.project.brandName}</strong> — Step {draftRestoreOffer.currentStep} of 5 · Last saved {new Date(draftRestoreOffer.savedAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                  </p>
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={() => restoreDraft(draftRestoreOffer)}
                      className="px-4 py-1.5 text-xs font-semibold bg-[#0B0B0B] text-white hover:bg-[#333333] transition-colors"
                    >
                      Resume assessment
                    </button>
                    <button
                      onClick={clearDraft}
                      className="px-4 py-1.5 text-xs font-medium border border-[#DCDAD3] text-[#8A877D] hover:bg-[#E4E2DC] transition-colors"
                    >
                      Discard
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {currentStep === 0 && <WelcomePage onStart={() => setCurrentStep(1)} />}
          {currentStep === 1 && <SetupPage project={project} setProject={setProject} apiKey={apiKey} setApiKey={setApiKey} onNext={() => setCurrentStep(2)} onBack={() => setCurrentStep(0)} />}
          {currentStep === 2 && <WebsiteAssessment assessmentData={assessments.website} setAssessmentData={(d) => updateAssessment('website', d)} apiKey={apiKey} project={project} onPrev={() => setCurrentStep(1)} onNext={() => setCurrentStep(3)} onClearScores={() => setScores(null)} />}
          {currentStep === 3 && <SocialMediaAssessment assessmentData={assessments.social} setAssessmentData={(d) => updateAssessment('social', d)} apiKey={apiKey} project={project} onPrev={() => setCurrentStep(2)} onNext={() => setCurrentStep(4)} onClearScores={() => setScores(null)} />}
          {currentStep === 4 && <AIReputationPage assessmentData={assessments.aiReputation} setAssessmentData={(d) => updateAssessment('aiReputation', d)} apiKey={apiKey} project={project} onPrev={() => setCurrentStep(3)} onNext={() => setCurrentStep(5)} onClearScores={() => setScores(null)} />}
          {currentStep === 5 && <EarnedMediaAssessment assessmentData={assessments.earnedMedia} setAssessmentData={(d) => updateAssessment('earnedMedia', d)} apiKey={apiKey} project={project} onPrev={() => setCurrentStep(4)} onNext={() => setCurrentStep(6)} onClearScores={() => setScores(null)} />}
          {currentStep === 6 && <ReportPage project={project} setProject={setProject} scores={scores} setScores={setScores} assessments={assessments} apiKey={apiKey} onSave={handleSave} onPrev={() => setCurrentStep(5)} profile={profile} compassResults={compassResults} savedBenchmark={project.benchmarkSnapshot || null} />}
        </>
      )}
    </div>
  );
}


// App wrapped with ErrorBoundary for production error handling
export default function App() {
  // A client link short-circuits the entire application: no auth, no
  // navigation, no chrome. Checked here rather than inside AppContent so a
  // client can never reach the authenticated shell, even for a frame.
  const clientToken = new URLSearchParams(window.location.search).get('client');

  if (clientToken) {
    return (
      <ErrorBoundary>
        <ClientReportGate token={clientToken} />
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
}
