// Perplexity audits on the website and social steps (v4.21.0).
//
// The same background research run as the earned media audit
// (api/media-audit.js, kind 'website' or 'social'), with Antenna's own
// website and social audit prompts. Each returns an executive summary, a
// nine-dimension scorecard and a full report. The report is shown as an
// editable field the step's analysis reads; the scorecard reaches the final
// scoring as evidence, each dimension routed to the attributes whose rubric
// it measures, and counted once with the step's own analysis.
//
// The prompts' placeholders come from Setup: the brand, the site, labelled
// lines in the context field ("Primary audiences:", "Conversion goal:",
// "Competitors:" and so on), and the social links the social step found.
// Anything not given is left for Perplexity to infer from the site, and it
// says what it inferred.

import { peersFromContext } from './mediaAudit.js';

export const PERPLEXITY_AUDIT_PREFIX = '[Perplexity audit:';
export const SOCIAL_PERIOD_DAYS = 90;

// The nine dimensions of each prompt and the attributes each one measures,
// by the rubric's own signals. Competitive benchmark is context for
// calibration, not evidence for any one attribute.
export const AUDIT_KINDS = {
  website: {
    label: 'Website audit',
    dimensions: [
      ['User Configuration & Journey', ['ATTENTIVE', 'AWARE']],
      ['Conversion Architecture', ['COGENT', 'ATTENTIVE']],
      ['Trust & Credibility Signals', ['INTENTIONAL', 'AWARE']],
      ['Authenticity', ['REFLECTIVE']],
      ['Reputation Management', ['AWAKE', 'REFLECTIVE']],
      ['Message Consistency', ['REFLECTIVE', 'INTENTIONAL']],
      ['Storytelling Quality', ['SENTIENT', 'VISIONARY']],
      ['Engagement Potential', ['SENTIENT', 'AWARE']],
      ['Competitive Benchmark', []],
    ],
  },
  social: {
    label: 'Social audit',
    dimensions: [
      ['Channel Strategy & Configuration', ['COGENT']],
      ['Conversion Pathways', ['COGENT']],
      ['Trust & Credibility', ['INTENTIONAL', 'AWARE']],
      ['Authenticity', ['REFLECTIVE']],
      ['Reputation Signals', ['AWARE', 'REFLECTIVE']],
      ['Message Consistency', ['REFLECTIVE', 'INTENTIONAL']],
      ['Storytelling Quality', ['SENTIENT']],
      ['Engagement Quality', ['AWARE']],
      ['Competitive Benchmark', []],
    ],
  },
};

const clip = (s, n) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, n);

// Labelled lines in Setup's context field.
const lineFor = (text, re) => {
  const m = re.exec(String(text || ''));
  return m ? clip(m[1].replace(/\[.*?\]/g, ''), 300) : '';
};
export function contextFields(context = '') {
  return {
    audiences: lineFor(context, /(?:primary\s+)?audiences?\s*(?::|\s-\s)\s*([^\n]+)/i),
    conversionGoal: lineFor(context, /(?:primary\s+)?conversion\s+goals?\s*(?::|\s-\s)\s*([^\n]+)/i),
    secondaryGoals: lineFor(context, /secondary\s+(?:conversion\s+)?goals?\s*(?::|\s-\s)\s*([^\n]+)/i),
    socialGoal: lineFor(context, /social\s+(?:conversion\s+)?goals?\s*(?::|\s-\s)\s*([^\n]+)/i),
    markets: lineFor(context, /(?:priority\s+)?(?:markets?|regions?)\s*(?::|\s-\s)\s*([^\n]+)/i),
    competitors: peersFromContext(context),
  };
}

// The social links the social step has: typed URLs and the health check's.
export function socialHandles(social = {}) {
  const out = [];
  const add = (label, url) => { const u = String(url || '').trim(); if (/^https?:\/\//i.test(u) && !out.some(x => x.url === u)) out.push({ label, url: u }); };
  add('LinkedIn', social.linkedinUrl);
  add('X', social.xUrl);
  const s = social.socialHealthCheckStructured || {};
  [['LinkedIn', s.linkedin], ['X', s.x], ['Instagram', s.instagram], ['YouTube', s.youtube]].forEach(([l, p]) => add(l, p?.url));
  return out;
}

const INFER = 'Not specified: infer from the site, and say what you inferred';
const BIZ = { b2b: 'business to business', b2c: 'consumer', both: 'business and consumer' };

export function websiteAuditPrompt({ brand, url, businessModel, context = '' }) {
  const c = contextFields(context);
  return `ROLE
You are a senior brand strategist and conversion specialist. Conduct a critical, evidence-based assessment of ${brand}'s website at ${url}. Be direct and candid; do not flatter. Every judgment must be tied to a specific page, element, or quote from the site.

CONTEXT
- Brand: ${brand}
- URL: ${url}
- Business model: ${BIZ[businessModel] || 'not specified'}
- Primary audiences: ${c.audiences || INFER} (e.g., buyers, investors, talent, partners, policymakers)
- Primary conversion goal: ${c.conversionGoal || INFER} (e.g., demo request, contact form, purchase, newsletter signup)
- Secondary conversion goals: ${c.secondaryGoals || INFER}
- Competitors to benchmark: ${c.competitors.length ? c.competitors.join(', ') : 'Not specified: choose the three closest competitors and name them'}
- Priority markets/regions: ${c.markets || INFER}

METHOD
Browse the homepage, all primary navigation pages, at least one product/service page, the About/Team page (whatever the site calls it), any newsroom/blog, and the main conversion page. Walk through the site as each primary audience would, from landing to conversion. Judge pages by what the site links to: never report an address you guessed, such as /about, as a broken link.

ASSESS THE FOLLOWING

1. User Configuration & Journey
- Within 5 seconds of landing, is it clear who the brand is, what it does, and who it's for?
- Does the navigation reflect how each audience thinks, or how the company is organized internally?
- Is there a distinct, logical path for each priority audience?
- Friction points: dead ends, jargon, cognitive overload, buried information, broken links, slow load, poor mobile experience.

2. Conversion Architecture
- Is the primary conversion point obvious, compelling, and reachable within 1 to 2 clicks from any page?
- Quality of CTAs: specificity, placement, frequency, and value exchange (what does the user get?).
- Form design: number of fields, friction, reassurance copy, and what happens after submission.
- Are there appropriate micro-conversions for users who are not ready to act (content offers, newsletter, case studies)?
- Do conversion points match where each audience is in its decision journey?

3. Trust & Credibility Signals
- Proof points: client logos, case studies, testimonials, data, certifications, awards, partnerships, media coverage.
- Are the claims specific and verifiable, or vague and superlative?
- Leadership/team visibility: real people, credentials, faces.
- Transparency: pricing, process, contact details, physical presence, privacy/security info.
- Third-party validation versus self-assertion: what is the ratio?

4. Authenticity
- Does the brand sound like a real organization with a point of view, or generic category language?
- Is the imagery original or stock?
- Are there honest acknowledgments of challenges, limits, or progress to date?
- Do human stories (founders, employees, customers) feel genuine or staged?

5. Reputation Management
- How is the brand positioned against known industry perceptions, criticisms, or skepticism?
- Is there an active newsroom with recent, credible coverage?
- Are thought-leadership assets positioning the brand as an authority?
- Is there anything a journalist, investor, or skeptic would find missing or concerning?

6. Message Consistency
- Is the core value proposition stated consistently across the homepage, About page, product pages, and metadata?
- Are tone, terminology, and claims uniform, or do they drift between sections?
- Does the visual identity reinforce the message consistently?

7. Storytelling Quality
- Is there a clear narrative arc (problem, stakes, solution, proof, vision)?
- Is the brand the hero, or is the customer/user the hero?
- Emotional versus rational balance: is it appropriate for the audience?
- Are complex ideas made accessible without being dumbed down?

8. Engagement Potential
- Does the content invite exploration, return visits, or sharing?
- Interactive elements, multimedia, depth of content.
- Is there a reason to come back?

9. Competitive Benchmark
- Compare against the competitors above on clarity, conversion, and trust. Where does ${brand} lead, and where does it lag?

OUTPUT FORMAT
Return JSON with these fields:
- assumptions: anything in the context you had to infer (audiences, goals, competitors, markets), in one or two sentences; empty if nothing was inferred.
- executiveSummary: the most important findings, stated bluntly, five at most.
- scorecard: the 9 dimensions above, in order, each with a score from 1 to 10, a one-line justification and a cited example (page URL or quote).
- report: everything else, in markdown, with these headed sections: Detailed findings by dimension (what works, what doesn't, and why it matters to the audience); Top 5 conversion killers, ranked by impact; Top 5 trust gaps, ranked by impact; Prioritized recommendations, split into Quick wins (under 30 days), Medium-term (1 to 3 months) and Strategic (3+ months), each with expected impact; Example rewrites of the homepage hero headline, subhead and primary CTA.

Write in US English. Do not use em dashes or en dashes.`;
}

export function socialAuditPrompt({ brand, url, businessModel, context = '', social = {} }) {
  const c = contextFields(context);
  const handles = socialHandles(social);
  return `ROLE
You are a senior social strategist and brand reputation analyst. Conduct a critical, evidence-based assessment of ${brand}'s social media presence. Be candid; do not flatter. Support each judgment with specific posts, dates, and metrics where visible.

CONTEXT
- Brand: ${brand}
- Website: ${url} (use it to identify linked social accounts and to check consistency with the site)
- Business model: ${BIZ[businessModel] || 'not specified'}
- Known handles: ${handles.length ? handles.map(h => `${h.label} ${h.url}`).join(', ') : 'None given: find them from the website footer and search'}
- Primary audiences: ${c.audiences || INFER}
- Primary conversion goal from social: ${c.socialGoal || c.conversionGoal || INFER} (e.g., site traffic, lead gen, follower growth, event registration)
- Competitors to benchmark: ${c.competitors.length ? c.competitors.join(', ') : 'Not specified: choose the three closest competitors and name them'}
- Review period: last ${SOCIAL_PERIOD_DAYS} days

METHOD
Identify every active channel (LinkedIn, X, Instagram, YouTube, TikTok, Facebook, Threads, and others). For each, review profile setup and a representative sample of recent posts (minimum 15 to 20 per primary channel). Also review executive and founder accounts if they function as brand channels. If a platform has no official account, say so plainly; never invent an account, a follower count or a post.

ASSESS THE FOLLOWING

1. Channel Strategy & Configuration
- Is the brand on the right platforms for its audiences, and absent from the wrong ones?
- Profile completeness: bio clarity, visuals, links, pinned content, and CTA in bio.
- Is each channel's role distinct, or is the same content cross-posted everywhere?
- Dormant, abandoned, or unofficial accounts that create reputation risk.

2. Conversion Pathways
- Do posts and profiles drive users to a clear next step?
- Do links lead to relevant landing pages, or just the homepage?
- Is there continuity between the social message and the destination page?

3. Trust & Credibility
- Use of proof: data, customer stories, third-party coverage, partner endorsements.
- Are leadership and experts visible and credible?
- How does the brand handle criticism, questions, or negative comments?
- Ratio of substantive content to promotional noise.

4. Authenticity
- Is there a recognizable human voice, or corporate boilerplate?
- Original content (behind the scenes, real people, real work) versus stock or templated assets.
- Is the brand participating in conversations or only broadcasting?
- Do employee and executive voices amplify the brand authentically?

5. Reputation Signals
- Sentiment in comments and mentions: positive, neutral, negative, skeptical.
- Recurring criticisms or questions the brand fails to address.
- Media and influencer mentions, and whether the brand amplifies them.
- Any visible reputational vulnerabilities.

6. Message Consistency
- Is the core positioning consistent across channels and with the website?
- Are tone, visual identity, terminology, and claims aligned?
- Do the key messages repeat often enough to build recognition?

7. Storytelling Quality
- Is there an ongoing narrative or campaign arc, or isolated one-off posts?
- Hooks: do the first lines and frames earn attention?
- Use of format (video, carousels, threads, long-form) to tell stories effectively.
- Is the audience or customer positioned as the hero?

8. Engagement Quality
- Engagement rate relative to follower count (estimate where metrics are visible).
- Quality of engagement: substantive comments versus emoji or bot-like replies.
- Brand responsiveness: speed and quality of replies.
- Which content types and themes outperform, and which underperform?
- Posting cadence and consistency.

9. Competitive Benchmark
- Compare ${brand} to the competitors above on follower base, cadence, engagement, content quality, and share of voice. Where does the brand win, and where does it lose?

OUTPUT FORMAT
Return JSON with these fields:
- assumptions: anything in the context you had to infer (audiences, goals, competitors, handles), in one or two sentences; empty if nothing was inferred.
- executiveSummary: the blunt headline findings, five at most.
- scorecard: the 9 dimensions above, in order, each with a score from 1 to 10, a justification and a linked example post.
- report: everything else, in markdown, with these headed sections: Channel inventory (a table: platform, handle, followers, posting frequency, estimated engagement rate, assessed role, and a health rating of Strong, Adequate, Weak or Inactive); Content analysis (top 3 and bottom 3 performing posts, and why each worked or didn't); Top 5 trust and reputation risks; Top 5 missed engagement opportunities; Prioritized recommendations, split into Quick wins (under 30 days), Medium-term (1 to 3 months) and Strategic (3+ months); Sample content (3 example posts that show the recommended voice, storytelling approach and CTA).

Write in US English. Do not use em dashes or en dashes.`;
}

// The structured output both audits return (strict: every field required).
const str = { type: 'string' };
const obj = (properties) => ({ type: 'object', additionalProperties: false, required: Object.keys(properties), properties });
export const WEB_AUDIT_SCHEMA = obj({
  assumptions: str,
  executiveSummary: { type: 'array', items: str },
  scorecard: { type: 'array', items: obj({ dimension: str, score: { type: 'number' }, justification: str, example: str }) },
  report: str,
});

const tidy = (v, n) => String(v ?? '').replace(/[—–]/g, '-').replace(/[ \t]+/g, ' ').trim().slice(0, n);
export function normalizeWebAudit(raw, kind) {
  if (!raw || typeof raw !== 'object' || !AUDIT_KINDS[kind]) return null;
  const dims = AUDIT_KINDS[kind].dimensions;
  const rows = Array.isArray(raw.scorecard) ? raw.scorecard : [];
  const scorecard = dims.map(([name], i) => {
    const r = rows.find(x => String(x?.dimension || '').toLowerCase().includes(name.toLowerCase().split(' ')[0].replace('&', ''))) || rows[i] || {};
    const sc = Number(r.score);
    return { dimension: name, score: Number.isFinite(sc) ? Math.max(1, Math.min(10, Math.round(sc))) : null, justification: tidy(r.justification, 400), example: tidy(r.example, 300) };
  });
  const report = tidy(String(raw.report || '').replace(/\r/g, ''), 40000).replace(/\n{3,}/g, '\n\n');
  const out = {
    assumptions: tidy(raw.assumptions, 600),
    executiveSummary: (Array.isArray(raw.executiveSummary) ? raw.executiveSummary : []).map(x => tidy(x, 400)).filter(Boolean).slice(0, 5),
    scorecard,
    report,
  };
  return out.scorecard.some(s => s.score != null) || out.report ? out : null;
}

export const averageScore = (audit) => {
  const s = (audit?.scorecard || []).filter(r => r.score != null && r.dimension !== 'Competitive Benchmark');
  return s.length ? Math.round((s.reduce((a, r) => a + r.score, 0) / s.length) * 10) / 10 : null;
};

// The editable text on the step. Starts with the marker the quality record
// reads as automated.
export function webAuditText(audit, kind, { ranAt = null } = {}) {
  const a = normalizeWebAudit(audit, kind);
  if (!a) return '';
  const lines = [`${PERPLEXITY_AUDIT_PREFIX} ${AUDIT_KINDS[kind].label.toLowerCase()} through Perplexity web research${ranAt ? `, run ${String(ranAt).slice(0, 10)}` : ''}. Check it and correct anything that is wrong.]`, ''];
  if (a.assumptions) lines.push(`Assumed: ${a.assumptions}`, '');
  if (a.executiveSummary.length) { lines.push('EXECUTIVE SUMMARY'); a.executiveSummary.forEach(x => lines.push(`- ${x}`)); lines.push(''); }
  lines.push('SCORECARD');
  a.scorecard.forEach(r => lines.push(`- ${r.dimension}: ${r.score ?? 'n/a'}/10. ${r.justification}${r.example ? ` (${r.example})` : ''}`));
  if (a.report) lines.push('', a.report);
  return lines.join('\n');
}

// What scoring reads: the scorecard, each dimension routed to the attributes
// it measures, counted once with the step's analysis.
export function webAuditPromptBlock(audit, kind) {
  const a = normalizeWebAudit(audit, kind);
  if (!a) return '';
  const routes = Object.fromEntries(AUDIT_KINDS[kind].dimensions);
  const rows = a.scorecard.filter(r => r.score != null).map(r => `- ${r.dimension} ${r.score}/10${routes[r.dimension]?.length ? ` (evidence for ${routes[r.dimension].join(', ')})` : ' (context for calibration only)'}: ${clip(r.justification, 220)}`);
  return `${kind === 'website' ? 'WEBSITE' : 'SOCIAL'} AUDIT (Perplexity web research, scored by Perplexity on its own 1 to 10 scale):
${rows.join('\n')}
This audit is one more view of the same ${kind === 'website' ? 'website' : 'social presence'} the step's analysis above already covers: count each finding once, and weigh it as evidence for the attributes named, not as a score to copy. Where it and the analysis disagree, prefer the one that cites a specific page or post.`;
}

// The website and social system, from the social health check (v4.21.0).
export function systemPromptBlock(structured) {
  const w = structured?.websiteAndSocial;
  if (!w || typeof w !== 'object') return '';
  const sc = Number(w.unifiedScore);
  const fixes = (Array.isArray(w.fixes) ? w.fixes : []).map(x => clip(x, 200)).filter(Boolean).slice(0, 3);
  return `WEBSITE AND SOCIAL AS ONE SYSTEM (social health check, with the website findings in view):
- Unified brand health score: ${Number.isFinite(sc) ? `${Math.round(sc)}/10` : 'not given'}.
- Story from first social impression to website conversion: ${clip(w.storyConsistency, 300) || 'not assessed'} (REFLECTIVE: consistent messaging across channels)
- Where the handoff from social to the website breaks: ${clip(w.handoffBreaks, 300) || 'not assessed'} (ATTENTIVE: the journey; COGENT: conversion pathways)
- Trust signals on the site but not on social: ${clip(w.trustOnSiteNotSocial, 250) || 'none named'}; on social but not on the site: ${clip(w.trustOnSocialNotSite, 250) || 'none named'} (INTENTIONAL: proof shown everywhere; AWARE: transparency)
${fixes.length ? `- Highest-leverage integrated fixes: ${fixes.join('; ')}` : ''}
This draws on the same evidence as the website and social sections: count it once.`;
}
