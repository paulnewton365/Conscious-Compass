// The newsletter lead (v4.20.4): chosen for substance, then written up in
// full from its own sources and fact-checked sentence by sentence.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as nl from '../api/refresh-stay-conscious-newsletter.js';

const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const src = readFileSync(new URL('../api/refresh-stay-conscious-newsletter.js', import.meta.url), 'utf8');

const SRC = 'https://adimpact.example.com/data-center-ads';
const FACTS = [
  'Corporate involvement in data center development appeared in 30 percent of all political ads analyzed.',
  'Energy costs appeared in 27 percent of the ads.',
  'Environmental effects appeared in 24 percent of the ads.',
  'The analysis covered more than 4,000 ads that aired between January and October.',
  'Candidates of both parties used the issue, most often in state and local races.',
];
const PAGE = `Political ad tracking report. ${FACTS.join(' ')} ${'Further methodology text about how ads were coded and counted. '.repeat(20)}`;
const thin = {
  headline: 'Data Centers Have Become the Most Toxic Asset in Political Paid Media',
  category: 'Paid Media',
  insight: FACTS[0],
  whyItMatters: '',
  sources: [{ title: 'Data center ads', outlet: 'AdImpact', url: SRC }],
  checked: true,
};

test('the lead is the first story with substance, not a one-line story with no "why it matters"', () => {
  const full = { headline: 'B', category: 'Trust & Reputation', insight: 'One. Two.', whyItMatters: 'Why.', sources: [{ url: 'https://x.com/a' }] };
  const httpOnly = { ...full, headline: 'C', sources: [{ url: 'http://x.com/a' }] };
  assert.equal(nl.hasSubstance(thin), false);
  assert.equal(nl.hasSubstance(full), true);
  assert.equal(nl.hasSubstance(httpOnly), false, 'the reader issue shows https sources only');
  assert.equal(nl.pickLead([thin, full], []).headline, 'B');
  // Topic rotation still applies among stories with substance.
  const full2 = { ...full, headline: 'D', category: 'AI & Search' };
  assert.equal(nl.pickLead([thin, full, full2], ['trust & reputation']).headline, 'D');
  // With no story of substance, the old order holds.
  assert.equal(nl.pickLead([thin, httpOnly], []).headline, thin.headline);
});

const mock = ({ writeUp, verdictsFor }) => {
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    if (String(url) === SRC) return { ok: true, text: async () => `<html><body><p>${PAGE}</p></body></html>` };
    const body = JSON.parse(init.body || '{}');
    const prompt = body.messages?.[0]?.content || '';
    calls.push(prompt.includes('too short to lead the issue') ? 'write' : 'check');
    if (prompt.includes('too short to lead the issue')) return { ok: true, json: async () => ({ content: [{ type: 'text', text: JSON.stringify(writeUp) }] }) };
    return { ok: true, json: async () => ({ content: [{ type: 'text', text: JSON.stringify({ verdicts: verdictsFor(prompt).map((v, i) => ({ n: i + 1, ...v })) }) }] }) };
  };
  return { fetchImpl, calls };
};

test('a short lead is written up from its source and fact-checked like every story', async () => {
  const writeUp = {
    insight: `${FACTS[0]} ${FACTS[1]} ${FACTS[2]}\n\n${FACTS[3]} ${FACTS[4]} Ads also claimed data centers raise water bills by 900 percent.`,
    whyItMatters: 'Data centers now carry political baggage. Brands building or buying compute should expect their projects to show up in campaign messaging.',
  };
  const { fetchImpl, calls } = mock({
    writeUp,
    verdictsFor: () => [
      { verdict: 'supported', quote: FACTS[0] },   // headline
      ...FACTS.map(f => ({ verdict: 'supported', quote: f })),
      { verdict: 'supported', quote: 'Ads also claimed data centers raise water bills by 900 percent' },   // not on the page
      { verdict: 'opinion' }, { verdict: 'opinion' },
    ],
  });
  const out = await nl.writeUpLead(thin, { anthropicKey: 'k', fetchImpl });
  assert.deepEqual(calls, ['write', 'check']);
  assert.equal(out.report.outcome, 'written up');
  assert.equal(out.report.sentences, 5);
  assert.equal(out.item.insight, `${FACTS.slice(0, 3).join(' ')}\n\n${FACTS.slice(3).join(' ')}`, 'the unconfirmed sentence is removed; paragraphs stay');
  assert.match(out.item.whyItMatters, /political baggage/);
  assert.equal(out.item.writtenUp, true);
  assert.deepEqual(out.item.sources, thin.sources, 'the citation is kept');
  assert.equal(out.report.removed.length, 1);
});

test('a write-up the source does not bear out leaves the story as it was', async () => {
  const { fetchImpl } = mock({
    writeUp: { insight: `${FACTS[0]} Made up one. Made up two. Made up three.`, whyItMatters: 'A view.' },
    verdictsFor: () => [{ verdict: 'supported', quote: FACTS[0] }, { verdict: 'supported', quote: FACTS[0] }, { verdict: 'unsupported' }, { verdict: 'unsupported' }, { verdict: 'unsupported' }, { verdict: 'opinion' }],
  });
  const out = await nl.writeUpLead(thin, { anthropicKey: 'k', fetchImpl });
  assert.equal(out.item, thin);
  assert.equal(out.report.outcome, 'unchanged');
  assert.match(out.report.reason, /only 1 sentences? of the write-up were confirmed/);
  // No source, no key, no time: unchanged, never unchecked.
  assert.equal((await nl.writeUpLead({ ...thin, sources: [] }, { anthropicKey: 'k' })).report.reason, 'it has no source to write from');
  assert.equal((await nl.writeUpLead(thin, {})).report.reason, 'no API key');
  assert.equal((await nl.writeUpLead(thin, { anthropicKey: 'k', deadline: Date.now() - 1 })).report.reason, 'there was no time left');
});

test('the prompt asks for a full write-up from the pages only, in the house voice', () => {
  const p = nl.leadWriteUpPrompt(thin, [{ label: 'AdImpact', text: PAGE }]);
  assert.match(p, /HEADLINE \(keep it as it is\): Data Centers Have Become/);
  assert.match(p, /two paragraphs, five to eight sentences in all/);
  assert.match(p, /Every fact and figure must be on the source pages above/);
  assert.match(p, /no new facts or figures/);
  assert.ok(!/—|–/.test(p));
  assert.equal(nl.parseLeadWriteUp('{"insight":"A — B.","whyItMatters":"C."}').insight.includes('—'), false);
});

test('wiring: written up after the pick, reported to the reviewer', () => {
  assert.ok(src.includes("const leadWriteUp = await writeUpLead(pickedLead, { anthropicKey, deadline: Date.now() + 90000 });"));
  assert.ok(src.includes('lead: { headline: leadItem.headline, ...leadWriteUp.report },'));
  assert.ok(app.includes('Written up in full from its sources: ${check.lead.sentences} sentences confirmed by the fact check.'));
});

test('stories must be stories with a point for conscious marketing, not restated announcements', async () => {
  const { STAY_CONSCIOUS_PROMPT } = await import('../api/refresh-stay-conscious.js');
  assert.match(STAY_CONSCIOUS_PROMPT, /Each item must be a story, not an observation/);
  assert.match(STAY_CONSCIOUS_PROMPT, /a named organization, person or body did something/);
  assert.match(STAY_CONSCIOUS_PROMPT, /Restating the announcement is not enough/);
  assert.match(STAY_CONSCIOUS_PROMPT, /the page you cite reports the event itself/);
  assert.match(STAY_CONSCIOUS_PROMPT, /Never a restatement of the news\./);
  assert.match(nl.leadWriteUpPrompt(thin, []), /one clear point for conscious marketing/);
});

test('admins can find new stories on demand and publish without posting to Teams; the schedule always posts', () => {
  assert.ok(src.includes("const post = caller.cron ? true : req.body?.post !== false;"));
  assert.ok(src.includes("const posted = post ? await postToChannel(process.env.NEWSLETTER_WEBHOOK_URL, publishedNote(published)) : 'skipped';"));
  assert.ok(app.includes("draftAction('publish', { post: postToTeams })"));
  assert.ok(app.includes('<span>Post to the team channel</span>'));
  assert.ok(app.includes("d.posted === 'skipped' ? ' It was not posted to the team channel.'"));
  assert.ok(app.includes('onClick={() => forceRefresh(newStories)}>Write the draft</button>'));
  assert.ok(app.includes('Find and fact-check new stories first'));
});
