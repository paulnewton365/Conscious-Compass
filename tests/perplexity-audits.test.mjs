// Perplexity website and social audits, and the website and social system
// check (v4.21.0).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as pa from '../src/lib/perplexityAudits.js';
import * as api from '../api/media-audit.js';
import * as q from '../src/lib/assessmentQuality.js';

const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const CONTEXT = 'Goals: lead the category.\nPrimary audiences: utility buyers, investors\nConversion goal: demo request\nSecondary goals: newsletter signup\nMarkets: US and Canada\nKey competitors: Fervo Energy, Zanskar';

const RAW = {
  assumptions: '',
  executiveSummary: ['The hero says nothing about who it is for — a buyer leaves.'],
  scorecard: [
    { dimension: 'User Configuration & Journey', score: 4, justification: 'Hero is vague.', example: 'https://x.com/' },
    { dimension: 'Conversion Architecture', score: 3, justification: 'Demo form has 12 fields.', example: '/demo' },
    { dimension: 'Trust & Credibility Signals', score: 6, justification: 'Logos, no case studies.', example: '' },
    { dimension: 'Authenticity', score: 7, justification: 'Founder story is real.', example: '' },
    { dimension: 'Reputation Management', score: 5, justification: 'Newsroom stale.', example: '' },
    { dimension: 'Message Consistency', score: 6, justification: 'Drifts on product pages.', example: '' },
    { dimension: 'Storytelling Quality', score: 5, justification: 'Brand is the hero.', example: '' },
    { dimension: 'Engagement Potential', score: 4, justification: 'No reason to return.', example: '' },
    { dimension: 'Competitive Benchmark', score: 5, justification: 'Behind Fervo on clarity.', example: '' },
  ],
  report: '## Top 5 conversion killers\n1. The form.',
};

test('the prompts are Antenna\'s, filled from Setup, with nothing left as a placeholder', () => {
  const c = pa.contextFields(CONTEXT);
  assert.deepEqual(c, { audiences: 'utility buyers, investors', conversionGoal: 'demo request', secondaryGoals: 'newsletter signup', socialGoal: '', markets: 'US and Canada', competitors: ['Fervo Energy', 'Zanskar'] });
  const w = pa.websiteAuditPrompt({ brand: 'Quaise', url: 'https://quaise.com', businessModel: 'b2b', context: CONTEXT });
  assert.match(w, /You are a senior brand strategist and conversion specialist/);
  assert.match(w, /- Primary audiences: utility buyers, investors/);
  assert.match(w, /- Competitors to benchmark: Fervo Energy, Zanskar/);
  assert.match(w, /Example rewrites of the homepage hero headline, subhead and primary CTA/);
  assert.match(w, /never report an address you guessed, such as \/about, as a broken link/);
  const s = pa.socialAuditPrompt({ brand: 'Quaise', url: 'https://quaise.com', context: '', social: { linkedinUrl: 'https://linkedin.com/company/quaise', socialHealthCheckStructured: { x: { url: 'https://x.com/quaise' } } } });
  assert.match(s, /You are a senior social strategist and brand reputation analyst/);
  assert.match(s, /Known handles: LinkedIn https:\/\/linkedin.com\/company\/quaise, X https:\/\/x.com\/quaise/);
  assert.match(s, /Primary audiences: Not specified: infer from the site, and say what you inferred/);
  assert.match(s, /Review period: last 90 days/);
  for (const p of [w, s]) {
    assert.ok(!/\{\{[A-Z_]+\}\}/.test(p), 'no unfilled placeholders');
    assert.ok(!/—|–/.test(p), 'no em or en dashes');
  }
});

test('the API runs them as background research with a strict scorecard schema', () => {
  const r = api.buildRequest({ kind: 'website', brand: 'Quaise', url: 'https://quaise.com', context: CONTEXT });
  assert.equal(r.background, true);
  assert.equal(r.effort, 'high');
  assert.equal(r.response_format.json_schema.name, 'website_audit');
  assert.equal(r.response_format.json_schema.strict, true);
  assert.match(r.input, /senior brand strategist and conversion specialist/);
  assert.equal(api.buildRequest({ kind: 'social', brand: 'Quaise' }).response_format.json_schema.name, 'social_audit');
  assert.equal(api.buildRequest({ brand: 'Quaise' }).response_format.json_schema.name, 'media_audit', 'no kind is the media audit, as before');
  const walk = (s) => {
    if (s.type === 'object') { assert.equal(s.additionalProperties, false); assert.deepEqual([...s.required].sort(), Object.keys(s.properties).sort()); Object.values(s.properties).forEach(walk); }
    if (s.type === 'array') walk(s.items);
  };
  walk(pa.WEB_AUDIT_SCHEMA);
});

test('the audit becomes an editable text with its scorecard, marked as automated', () => {
  const a = pa.normalizeWebAudit(RAW, 'website');
  assert.equal(a.scorecard.length, 9);
  assert.equal(a.scorecard[1].score, 3);
  assert.ok(!/—/.test(a.executiveSummary[0]));
  assert.equal(pa.averageScore(a), 5, 'eight dimensions; the benchmark is context');
  const t = pa.webAuditText(RAW, 'website', { ranAt: '2026-11-09T14:00:00Z' });
  assert.ok(t.startsWith(pa.PERPLEXITY_AUDIT_PREFIX));
  assert.ok(q.isAutoText(t), 'the quality record counts it as auto-filled');
  assert.match(t, /- Conversion Architecture: 3\/10\. Demo form has 12 fields\. \(\/demo\)/);
  assert.match(t, /## Top 5 conversion killers/);
  assert.equal(pa.normalizeWebAudit(null, 'website'), null);
});

test('scoring reads each dimension as evidence for the attributes it measures, counted once', () => {
  const b = pa.webAuditPromptBlock(RAW, 'website');
  assert.match(b, /Conversion Architecture 3\/10 \(evidence for COGENT, ATTENTIVE\)/);
  assert.match(b, /Authenticity 7\/10 \(evidence for REFLECTIVE\)/);
  assert.match(b, /Message Consistency 6\/10 \(evidence for REFLECTIVE, INTENTIONAL\)/);
  assert.match(b, /Competitive Benchmark 5\/10 \(context for calibration only\)/);
  assert.match(b, /count each finding once/);
  assert.match(b, /not as a score to copy/);
  // Visual identity is Intentional's alone (framework 2.15): consistency splits that way.
  // Both blocks sit inside the scoring prompt itself, with the assessor's edited report.
  const start = app.indexOf('const prompt = `You are scoring ${project.brandName} against the Conscious Compass Framework');
  const scoring = app.slice(start, app.indexOf('\nASSESSMENT DATA:', start) + 12000);
  assert.ok(scoring.includes("webAuditPromptBlock(scoringInputs.website.perplexityAudit.audit, 'website', scoringInputs.website.perplexityContent)"));
  assert.ok(scoring.includes("webAuditPromptBlock(scoringInputs.social.perplexityAudit.audit, 'social', scoringInputs.social.perplexityContent)"));
  assert.ok(scoring.includes('systemPromptBlock(scoringInputs.social.socialHealthCheckStructured)'));
  assert.ok(scoring.includes('mediaAuditPromptBlock(scoringInputs.earnedMedia.mediaAudit.audit)'));
});

test('the website and social system check: in the website auto-assess and the social health check, read by the analysis and scoring', () => {
  const four = ['Is the brand story consistent from the first social impression to website conversion?', 'Where does the handoff from social to the website break down?', 'Are the trust signals on one platform missing from the other?', 'Provide a unified brand health score (1 to 10) and the 3 highest-leverage integrated fixes.'];
  four.forEach(line => assert.equal(app.split(line).length - 1, 2, `${line} in both checks`));
  assert.ok(app.includes('"websiteAndSocial": {'));
  assert.ok(app.includes('What the website step found (use it; do not re-assess the site from scratch):'));
  assert.ok(app.includes("{currentStep === 3 && <SocialMediaAssessment websiteData={assessments.website}"));
  // The website auto-assess now reads the live site and social with web search.
  assert.ok(app.includes("callClaude(prompt, apiKey, null, [], 0, false, 8000, { webSearch: true, searchUses: 8 })"));
  assert.ok(app.includes("...(meta?.webSearch ? { useWebSearch: true, searchUses: meta.searchUses || 5 } : {})"));
  const block = pa.systemPromptBlock({ websiteAndSocial: { storyConsistency: 'LinkedIn promises a platform; the site sells a service.', handoffBreaks: 'Bio links to the homepage.', trustOnSiteNotSocial: 'Client logos', trustOnSocialNotSite: 'Founder videos', unifiedScore: 5.4, fixes: ['Link bios to the demo page', 'Bring founder video to the site', 'One positioning line everywhere'] } });
  assert.match(block, /Unified brand health score: 5\/10/);
  assert.match(block, /\(REFLECTIVE: consistent messaging across channels\)/);
  assert.match(block, /\(ATTENTIVE: the journey; COGENT: conversion pathways\)/);
  assert.match(block, /count it once/);
  assert.equal(pa.systemPromptBlock({}), '');
  assert.ok(app.includes("systemPromptBlock(scoringInputs.social.socialHealthCheckStructured)"));
  assert.ok(app.includes('${systemPromptBlock(healthStructRef.current)}'));
});

test('the steps: one automated panel each, the audit optional, feeding the analysis and the report', () => {
  assert.ok(app.includes('<PerplexityAuditBlock kind="website" pa={pa} analysisAt={assessmentData.analyzedAt || null} />'));
  assert.ok(app.includes('<PerplexityAuditBlock kind="social" pa={pa} analysisAt={assessmentData.analyzedAt || null} />'));
  assert.equal(app.split("{ label: 'Perplexity audit', done: !!pa.text.trim(), optional: true },").length - 1, 2);
  assert.ok(app.includes('PERPLEXITY WEBSITE AUDIT (web research by Perplexity, checked and possibly corrected by the assessor'));
  assert.ok(app.includes('=== PERPLEXITY SOCIAL AUDIT ==='));
  assert.ok(app.includes('Website Audit (Perplexity)') && app.includes('Social Audit (Perplexity)'));
  assert.ok(app.includes('The analysis was written before this audit. Run the analysis again to include it.'));
  assert.deepEqual(q.stepSources('website').map(([n]) => n).slice(-1), ['Perplexity website audit']);
  assert.deepEqual(q.stepSources('social').map(([n]) => n).slice(-1), ['Perplexity social audit']);
});

test('corrections the assessor makes in the report are what scoring reads', () => {
  let t = pa.webAuditText(RAW, 'website');
  t = t.replace('- Conversion Architecture: 3/10. Demo form has 12 fields.', '- Conversion Architecture: 6/10. The form has 4 fields; Perplexity misread it.')
    .replace(/- The hero says nothing[^\n]*/, '- The hero is clear for buyers.');
  const b = pa.webAuditPromptBlock(RAW, 'website', t);
  assert.match(b, /Conversion Architecture 6\/10 \(evidence for COGENT, ATTENTIVE\): The form has 4 fields; Perplexity misread it\./);
  assert.match(b, /Key findings:\n- The hero is clear for buyers\./);
  assert.match(b, /Authenticity 7\/10/, 'untouched rows keep Perplexity\'s score');
  assert.match(pa.webAuditPromptBlock(RAW, 'website'), /Conversion Architecture 3\/10/, 'without an edited text, the original');
});
