# Conscious Compass

**Brand Consciousness Assessment Framework v2.9** by Antenna Group

A React-based tool for evaluating brands across eight consciousness attributes using AI-powered analysis.

![Version](https://img.shields.io/badge/version-3.28.0-blue)
![Rubric](https://img.shields.io/badge/rubric-v2.9-green)
![Status](https://img.shields.io/badge/status-live-brightgreen)

---

## What It Does

Conscious Compass evaluates brands by answering eight fundamental questions:

| Attribute | Fundamental Question |
|-----------|---------------------|
| **AWAKE** | How well does the brand shape narratives and lead industry discourse? |
| **AWARE** | Does the brand understand its audiences and build trust? |
| **REFLECTIVE** | Does the brand have authentic alignment between claims and reality? |
| **ATTENTIVE** | Does the brand deliver exceptional, consistent experiences? |
| **COGENT** | Is marketing driven by strategic insights and data? |
| **SENTIENT** | Does the brand create emotional connections that inspire action? |
| **VISIONARY** | Does the brand point toward something meaningful? |
| **INTENTIONAL** | Does the brand show up with substance, confidence, and leadership? |

Each attribute is scored 0–100 based on observable evidence, with signals anchored at strong (70–100), moderate (40–69), and weak (0–39).

---

## Assessment Workflow

### 1. Brand Setup
Name, website URL, business model (B2B / B2C / B2B2C), industry.

### 2. Website Assessment
- Auto-Assess via AI analysis of screenshots
- SEO visibility analysis
- Technical audit (PageSpeed scores, auto-fetched or entered by hand)
- Recognition & credentials
- Website content, required before proceeding. **Scrape with Jina** opens `https://r.jina.ai/{url}` for the primary site homepage only, which returns clean text to paste back. The same prefix works on any URL, so subpages can be pulled by hand.

### 3. Social Media Assessment
A structured Health Check populates the channel fields automatically; auto-checked content and assessor notes are held in separate fields so a re-run never overwrites typed input. Channel coverage is gated by business model rather than a fixed platform list. Campaign and paid signals are captured in one block, which feeds Campaign Coherence. **Run Everything** chains the health check, trademark search and analysis in one pass.

Auto-checked findings can be wrong, so each panel has a **Correct** toggle that edits the finding in place. A corrected field is badged as such, and a re-run of the health check asks before overwriting it.

**No social presence** is a declared finding, not a skipped step. Ticking it requires a note recording which platforms were searched and what was found, and it releases the screenshot, channel-coverage and campaign gates. WIPO and the analysis are still required. The declaration flows into the health check (verify, do not invent), the analysis prompt (treat as confirmed, assess the consequences) and the scoring prompt, where absence is scored as a gap in AWARE, SENTIENT and COGENT rather than left as missing data. Where absence is a defensible strategic choice for the business model, that is reflected in INTENTIONAL instead.

### 4. AI Reputation
Query up to five engines and paste responses: **Claude, Gemini, ChatGPT, Perplexity, Microsoft Copilot**. Wikipedia presence and Reddit community perception are captured here as AI training signals. A synthesis is generated from all inputs. **Copy prompt & open Reddit** copies the Reddit Answers prompt and opens the tab in one action.

### 5. Earned Media
Press coverage, podcast appearances, keynotes, awards — last 3 months.

**Auto-Assess** is a web-searched analysis across ten dimensions: outlet calibre and tiering (mainstream, business, trade, specialist, aggregator, pay-to-play), announcement-driven versus third-party earned, reach, sentiment, share of voice, audience relevance, thought leadership and executive visibility, narrative influence, contradictions in message or purpose, and credibility built through earned. It runs through `/api/claude` with `useWebSearch` enabled, because share of voice and outlet analysis are worthless on model knowledge alone. Coverage that cannot be found is reported as a finding rather than filled in.

Two of these carry the most diagnostic weight. The **announcement-driven versus third-party** split separates coverage the brand caused from coverage it earned; a brand whose coverage collapses between announcements has media relations, not media standing. **Credibility built** is judged separately from visibility, because a brand can be highly visible and hold no credibility at all.

### 6. Report Generation
Twelve numbered sections: results at a glance, brand maturity, attribute analysis, brand footprint, campaign coherence, trust and credibility, benchmark comparison, recommendations, conclusions, score justification, what we evaluated, and assessment readouts. A thirteenth, **challenge history**, appears at position 11 only when the report has been challenged. Exports as DOCX or copied text.

The client-facing report carries the same treatment as the internal one but omits recommendations, services, score justification, readouts and the campaign score adjustment.

---

## Key Features

### Challenge
Additional context an assessor can put to a scored report, from the **Challenge** button. Five fields: Business Context, Website, Social Media, AI Reputation, Earned Media.

Only the sections actually filled in are revised. Filling Website alone revises that one readout and then rescores; filling all five runs five revision passes plus scoring. The revision is a revision, not a regeneration, so everything in the existing readout that still holds is kept. Scoring then runs against the revised readouts, which keeps the Assessment Readouts section and the scores consistent with each other.

**Context is weighed as evidence, never followed as instruction.** The prompts state that scores may go up, down, or not move at all, and that leaving a score unchanged is the correct outcome when the evidence picture has not changed. A bare assertion moves nothing. Any instruction to reach a target score is ignored.

Every field except Business Context asks for a publicly checkable source: a URL, a publication, a date, a named source. Claims without one are discounted and flagged as unverified in the findings. This is deliberate — the framework scores publicly observable evidence, and a challenge field is otherwise an open door to private client information that would quietly change what the score means. Business Context is treated as background informing interpretation, not as evidence of performance in its own right.

Challenges persist on the assessment and are carried into every subsequent rescore, including the Rescore button on Saved Assessments.

**Where the record lives.** A challenged report is marked in four places, so the trail cannot be missed:

| Where | What it shows |
|-------|---------------|
| Report masthead | A lime **Rescored after challenge** marker with the count. Clicking it jumps to the history |
| Report section 11 | **Challenge history** — who, when, the full submitted text, readouts revised, overall before and after, per-attribute deltas |
| DOCX and Copy Full Report | The same history, internal exports only |
| Saved Assessments and Compass Results | A **Challenged** badge per row, with net delta on the results ledger |

Portfolio-level, `compass_results` stores a summary inside the `scores` blob: `{ count, netDelta, lastAt }`, plus the same for `campaignLevel` and `footprintLevels`. The submitted text is deliberately excluded — it is often client-confidential and has no place in a results table. Challenge count and net delta are also columns in the CSV export, which is where a calibration question ("do challenges systematically raise scores?") would start once enough assessments carry the data.

The client payload excludes challenge history entirely.

Because a challenge revises rather than regenerates, it cannot recover something never captured at assessment time. If a whole channel was missed, re-run that assessment step instead.

### Language
Wording and tone, from the **Language** button. Three inputs: word substitutions, a free-text terminology and phrasing field, and three tone dials (directness, warmth, technicality) at five notches each, centred on the current voice.

**It is structurally incapable of changing a result.** Only narrative text is sent to the model, and the response is merged back through an allowlist of text keys applied in code: `findings`, `impact`, `actions`, `opportunity`, `gaps`, the headline, conclusion, justification, campaign verdict and rationale, and the footprint verdict. Scores, confidence values, campaign level and every other number are never read from the response. A model that tried to raise a score could not. `gaps` cannot grow beyond its original length.

The house voice in `VOICE_GUIDANCE` is passed as a floor rather than a starting point, so the dials move within it. Two steps softer still produces no hedging, filler or motivational closers.

The pre-language original is preserved for **Revert language**, and running the pass twice does not overwrite the true original with an already-rewritten version. A stored directive is reapplied automatically after any rescore, including a challenge rescore, since it is a standing preference rather than a one-off.

### Campaign Coherence
Judges whether marketing is held together by a strategy and a creative idea, or is isolated tactical activity. Six levels, 0 (Ad hoc) to 5 (Consequential), where level 0 is the absence of a campaign rather than a rung on the ladder.

The model scores the eight attributes on their merits and reports campaign coherence separately; the modifier is then applied **in code**, so the adjustment is deterministic and auditable. COGENT and SENTIENT take the primary adjustment, AWAKE, AWARE, REFLECTIVE and INTENTIONAL a smaller one. The report shows base score, adjustment and final score openly.

### Brand Footprint
Where the brand shows up, across eight fixed channels: earned, social, third-party discussion, owned, AI/LLM answers, paid, podcasts/video and analyst coverage. Descriptive only — it never adjusts attribute scores.

Each channel is scored 0 to 10 on **how consciously the brand shows up there**, anchored in four bands: 0 absent, 1–3 present but incidental, 4–6 deliberate and maintained, 7–10 conscious and shaping the conversation. This judges the quality of the presence, not how much evidence an assessor gathered. An earlier version counted evidence items, which measured assessment thoroughness rather than the brand, and was replaced for that reason.

Rendered as a **presence map**: the brand at the centre, channels as nodes sized by level, and lime curves where one channel demonstrably carries something from another — AI answers citing the owned research, earned coverage quoting the brand's data. Presence in two channels is not connection, and the prompt says so. An unconnected footprint is a real finding, and the map states it.

Channel levels persist to `compass_results` as `footprintLevels`, which are comparable between brands and assessors in a way counts never were. The section is hidden entirely on assessments scored before presence levels existed, rather than rendering an empty ring that would read as genuine absence.

### Trust & Credibility Lens
A different read on scores already given, never a new measurement. Four lenses — credibility, trust, reputation and authenticity — are weighted blends of the same eight attributes, computed **in code** from fixed weights that sum to 100 per lens and are shown openly on the panel. The same attribute scores always produce the same lens scores, so two assessors cannot disagree.

Authenticity is held apart at the base: the model treats it as the foundation the other three rest on, not a peer to compare against them.

Beneath the lenses sit publicly observable findings, tagged to the lenses they bear on and marked as supporting or working against. These **explain** the scores; they never change them. The findings list is the only part the scoring pass generates, which keeps the added cost to roughly 160 tokens.

### Benchmarking
Every saved report freezes a benchmark snapshot at save time, so a report sent to a client still shows the same numbers months later. Sector benchmarks require a minimum of five assessed brands; below that it falls back to all brands and says so. The subject brand is always excluded from its own cohort, and the pool is filtered to 2.x rubric versions. Sample size, date range and framework mix print under every chart.

### Client Links
Share a cleansed, password-protected report with a client who has no account. The payload is encrypted **in the browser** (PBKDF2, 250k iterations, AES-GCM 256) before it is stored, so Supabase only ever holds ciphertext and the password is not recoverable by anyone.

The client sees scores, maturity, attribute analysis, footprint, campaign coherence, the benchmark profile and the conclusion. They do not see recommendations, channel assessments, internal notes, challenge history or trust findings. Manage, reset and revoke links from the Client Links button on Saved Assessments. A reset rebuilds the report from the saved assessment and re-encrypts it, keeping the same URL.

An optional **note to the client** can be written when the link is created, with a live preview of how it will render. It appears under Results at a glance, above the score tiles, attributed by name and date and set apart from the analysis so it reads as commentary from a person rather than framework output. The note is fixed when the link is created; changing it means issuing a new link. It is carried through a password reset so a reissue does not silently drop it.

### Assessment & Results
- **Compass Results** — Sortable, filterable dashboard of all assessments with CSV export
- **Saved Assessments** — Resume in-progress work at any time; draft auto-save to localStorage
- **Signal Conflicts** — Automated diagnostic layer flagging attribute tensions (e.g. high AWAKE + low INTENTIONAL)
- **Read-Only Access** — Share results with clients without edit permissions
- **Shared Reports** — Share a read-only report via URL (base64-encoded, no login required). Note this embeds the payload in the link; use **Client Links** when the report should be gated.

### Compare
The Compare page has three views:

- **Compare Brands** — Side-by-side radar chart and attribute table for up to 6 brands
- **Landscape** — Macro cross-portfolio view showing all sectors plotted on a single octagon radar. Includes:
  - Consciousness Landscape octagon (selectable/pinnable sectors, All Sectors Avg mode)
  - Attribute Landscape (dot range chart per attribute, cross-sector spread)
  - Sector Attribute Spread (per-sector attribute profile on a single track)
  - Sector Profile cards
  - AI Landscape Analysis (weekly cached, admin force-refresh)
- **✨ Insights** — Story Opportunities: AI-generated thought leadership angles from the portfolio data (weekly cached, admin force-refresh)

### Stay Conscious Newsletter
A weekly auto-composed newsletter combining all three AI outputs into a single shareable edition:
- **Lead Story** — most prominent brand intelligence item
- **Brand Intelligence** — remaining AI-generated intelligence items across 6 categories (AI Visibility, Digital Experience, Brand Strategy, Earned Media, Social Signals, Assessment Practice)
- **Landscape Insights** — AI summary of cross-sector patterns with a generated headline, capped at 250 words
- **Story Opportunities** — thought leadership angles with headline and one-sentence summary

Exports as **DOCX** (Antenna-branded, matching report styling) or **Copy** (plain text). Refreshes every Sunday night automatically. Admins can force-refresh at any time. Each edition is numbered sequentially from Issue #1.

---

## Scoring

### Maturity Stages

| Score | Stage |
|-------|-------|
| 0–25 | Pre-Foundational |
| 26–39 | Foundational |
| 40–55 | Establishing |
| 56–69 | Differentiating |
| 70–84 | Leading |
| 85–100 | Transforming |

### Weighted Scoring

| Attribute | Qualitative | Technical |
|-----------|-------------|-----------|
| ATTENTIVE | 70% | 30% (PageSpeed) |
| COGENT | 80% | 20% (Technical SEO) |
| Others | 100% | — |

### Campaign Coherence Modifier

Applied in code after scoring, never by the model. Values are deliberately hedged to absorb the residual overlap between craft and campaign quality.

| Level | COGENT, SENTIENT | AWAKE, AWARE, REFLECTIVE, INTENTIONAL |
|-------|------------------|----------------------------------------|
| 0 Ad hoc | −4 | −2 |
| 1 Themed | −3 | −1 |
| 2 Packaged | −1 | 0 |
| 3 Integrated | +2 | +1 |
| 4 Platform | +3 | +2 |
| 5 Consequential | +5 | +3 |

`applyCampaignModifiers` preserves `baseScore` and always recalculates from it, so rescoring never compounds.

### Footprint Presence Scale

| Range | Band | Test |
|-------|------|------|
| 0 | Absent | Nothing observable |
| 1–3 | Present | Appears, no intent. Dormant accounts, incidental mentions |
| 4–6 | Deliberate | Maintained, on-message, consistent with the rest |
| 7–10 | Conscious | Cited, quoted, imitated, or the conversation uses its framing |

A brand talking well about itself tops out at 6 however polished. Level 7 and above requires evidence the presence does something.

### Trust Lens Weights

Fixed in code, summing to 100 per lens.

| Lens | Weights |
|------|---------|
| Credibility | Intentional 35, Awake 20, Cogent 15, Aware 15, Sentient 10, Attentive 5 |
| Trust | Aware 35, Intentional 20, Cogent 15, Attentive 15, Reflective 10, Awake 5 |
| Reputation | Awake 35, Intentional 20, Attentive 15, Aware 15, Cogent 5, Sentient 5, Reflective 5 |
| Authenticity | Reflective 40, Aware 20, Sentient 10, Visionary 10, Intentional 10, Cogent 10 |

Aware, Cogent and Intentional feed all four lenses, so a brand weak in any of them reads weak across every lens. Visionary feeds only Authenticity; every other attribute feeds three or four. The reach note on the panel is generated from these weights rather than written, so it stays true if they change.

The client-facing report shows the lenses but not the findings beneath them; `trustFindings` is excluded from the cleansed payload rather than merely hidden.

### Score Bands

Attribute figures are coloured by performance rather than attribute identity.

| Band | Range | Colour |
|------|-------|--------|
| Green | 70–100 | `#0F7A4F` |
| Orange | 45–69 | `#C2680C` |
| Red | 0–44 | `#D42528` |

The octagon keeps attribute colours, since colour there distinguishes axes rather than reporting performance.

---

## Integrity Rules

Four places where the model is deliberately not trusted with the result. Each is enforced in code, not asked for in a prompt. Read this before refactoring any of them, because each looks like redundant plumbing and none of it is.

**1. Campaign modifiers are arithmetic, not judgement.** The model scores the eight attributes and reports campaign coherence separately. `applyCampaignModifiers` does the adjustment from a fixed table and always recalculates from `baseScore`, so rescoring never compounds. Never let the model do the maths.

**2. Trust lens scores are computed from fixed weights.** Four weighted blends of the same eight attributes, summing to 100 per lens, shown openly on the panel. The same attribute scores always produce the same lens scores, so two assessors cannot disagree. The weights are not user-adjustable by design.

**3. The language pass merges through an allowlist.** `mergeLanguageText` spreads the original object first, then overwrites only known text keys. Scores, confidence, campaign level and channel figures are never read from the model response. The guarantee comes from the merge, not from the prompt asking nicely — so a "simplification" that spreads the response over the original would silently remove it.

**4. Challenges are evidence, not instruction.** Scores may go up, down, or not move. Unsourced claims are discounted and flagged. Any instruction to reach a target score is ignored. Every challenge is recorded with before and after scores so a rescore is never invisible.

The client payload is a fifth, related case: `makeClientPayload` is an allowlist that names each field it copies. Anything internal is absent because it is never added, not because it is hidden. Adding a field to `scores` does not leak it; adding a line to that function would.

---

## Quick Start

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

---

## Deployment (Vercel)

The Anthropic API key is stored server-side only via Vercel serverless functions — never exposed to the browser.

### Steps

1. Push to GitHub
2. Import in [Vercel](https://vercel.com)
3. Add environment variables:

| Name | Notes |
|------|-------|
| `ANTHROPIC_API_KEY` | Required — AI analysis and weekly automation |
| `VITE_SUPABASE_URL` | Required — auth and data |
| `VITE_SUPABASE_ANON_KEY` | Required — client-side auth |
| `SUPABASE_SERVICE_ROLE_KEY` | Required — serverless functions write to cache tables |
| `SUPABASE_URL` | Required — server-side equivalent used by the cron endpoints |
| `GOOGLE_PAGESPEED_API_KEY` | Optional — without it PageSpeed is IP rate-limited and will 429 |
| `JINA_API_KEY` | Optional — raises the rate limit on homepage scraping for property consistency |
| `GOOGLE_YOUTUBE_API_KEY` | Optional — verified YouTube channel metrics in the social health check |
| `GOOGLE_KNOWLEDGE_GRAPH_API_KEY` | Optional — Knowledge Graph presence lookup |
| `GOOGLE_SEARCH_API_KEY` | Optional — search snapshot in AI Reputation |
| `GOOGLE_SEARCH_ENGINE_ID` | Optional — paired with the search key |

Features backed by an optional key degrade rather than fail: the section still renders and the assessor can fill it by hand.

4. Deploy

```
Browser → /api/claude (Vercel serverless) → Anthropic API
                ↑
         API key lives here only
```

### Function Timeouts

`vercel.json` sets `maxDuration` per function:

| Function | Seconds | Why |
|----------|---------|-----|
| `api/claude.js` | 300 | The scoring prompt runs to roughly 6,000 tokens and asks for about 3,400 back |
| `api/pagespeed.js` | 300 | A four-category desktop Lighthouse run regularly takes 30 to 90 seconds |
| `api/scrape.js` | 60 | Jina Reader fetch for property homepage text |
| `api/search.js` | 120 | Web search round trip |
| All four cron endpoints | 300 | Weekly AI composition |

**300 seconds requires a Pro plan** — on Hobby the ceiling is 60, which is usually still enough.

**Any long-running route must be listed here.** A function left on the default timeout is killed mid-response and Vercel returns an HTML error page, which then fails `response.json()` on the client and surfaces as a misleading network error. This is exactly how PageSpeed auto-fetch broke: the route existed and worked, but was missing from `vercel.json`. Both `api/pagespeed.js` and its caller now read the body as text and parse defensively so the real status is never hidden behind a parse error.

`GOOGLE_PAGESPEED_API_KEY` is optional but strongly recommended; without it the PageSpeed API is IP rate-limited and will start returning 429.

### Cron Jobs (Vercel — every Sunday)

| Time (UTC) | Endpoint | Purpose |
|------------|----------|---------|
| 22:00 | `/api/refresh-stay-conscious` | Brand intelligence items |
| 22:30 | `/api/refresh-landscape-analysis` | Cross-sector AI analysis |
| 23:00 | `/api/refresh-insights-analysis` | Story opportunity generation |
| 23:30 | `/api/refresh-stay-conscious-newsletter` | Compose and cache newsletter |

All cron endpoints also accept POST for admin-triggered force refresh. Schedules are defined in `vercel.json`.

---

## Database (Supabase)

Run **`docs/SUPABASE_SETUP.sql`** in the Supabase SQL Editor. One file, everything: tables, columns, indexes, RLS policies, the signup trigger and a profile backfill.

It is idempotent and safe on a live database. Every statement uses `IF NOT EXISTS` or drops and recreates, so running it twice changes nothing the second time. It creates no data and drops none. It also upgrades an older database in place, adding the cache tables, `client_reports`, and the `assessor_name`, `rubric_version` and `last_login` columns.

Then run **`docs/SUPABASE_VERIFY.sql`** to confirm. It reads only and reports PASS or the specific problem for 49 checks: tables, columns, RLS enabled, policies present, the signup trigger, cascade delete, at least one admin, orphaned auth users, and duplicate brand names that would break saving.

`supabase-schema.sql` and the two files in `docs/CLIENT_REPORTS_MIGRATION*.sql` are superseded and kept for reference. Do not run them: the original left the cache tables and several columns as commented-out instructions, so a fresh deploy from it produced a database the app could not use.

### Tables

| Table | Purpose |
|-------|---------|
| `profiles` | User accounts, approval status, admin and read-only flags |
| `saved_assessments` | Full in-progress and completed assessments |
| `compass_results` | Summary results used in Results dashboard and Compare pages |
| `stay_conscious_cache` | Weekly brand intelligence items (single row, id=1) |
| `landscape_analysis_cache` | Weekly AI landscape analysis with generated headline (single row, id=1) |
| `insights_analysis_cache` | Weekly story opportunities (single row, id=1) |
| `stay_conscious_newsletter` | Composed weekly newsletter (single row, id=1) |
| `client_reports` | Gated client links. Stores ciphertext only |

Benchmark snapshots, campaign levels, footprint levels and the challenge summary are all stored inside existing JSON blobs rather than new columns, so they need no migration as the framework grows.

All cache tables use RLS with a read-only policy for authenticated users. Serverless functions write using the service role key, which bypasses RLS.

---

## Project Structure

```
conscious-compass/
├── api/
│   ├── claude.js                            # Anthropic API proxy
│   ├── knowledge-graph.js                   # Google Knowledge Graph lookup
│   ├── pagespeed.js                         # PageSpeed Insights proxy
│   ├── scrape.js                            # Jina Reader proxy for homepage text
│   ├── youtube.js                           # YouTube Data API proxy
│   ├── search.js                            # Web search proxy
│   ├── stay-conscious.js                    # GET brand intelligence cache
│   ├── refresh-stay-conscious.js            # Cron: refresh brand intelligence
│   ├── landscape-analysis.js               # GET landscape analysis cache
│   ├── refresh-landscape-analysis.js       # Cron: refresh landscape analysis
│   ├── insights-analysis.js                # GET story opportunities cache
│   ├── refresh-insights-analysis.js        # Cron: refresh story opportunities
│   ├── stay-conscious-newsletter.js        # GET newsletter cache
│   ├── refresh-stay-conscious-newsletter.js # Cron: compose newsletter
│   ├── list-users.js                       # Admin: list all users
│   └── delete-user.js                      # Admin: delete user
├── src/
│   ├── App.jsx             # Main application (~14,700 lines)
│   ├── data/
│   │   ├── rubric.js       # Framework v2.9 — attributes, campaign ladder, footprint channels
│   │   └── serviceMapping.js  # Service recommendations mapped to attributes
│   ├── lib/
│   │   ├── api.js          # API helper utilities
│   │   └── supabase.js     # Supabase client and auth functions
│   ├── index.css           # Global styles and design tokens
│   └── main.jsx            # Entry point
├── docs/
│   ├── SUPABASE_SETUP.sql              # Run this: complete idempotent setup
│   ├── SUPABASE_VERIFY.sql             # Run after: 49 checks, reads only
│   ├── WHAT_IS_A_CONSCIOUS_BRAND.md
│   ├── CLIENT_REPORTS_MIGRATION.sql    # Superseded, reference only
│   └── CLIENT_REPORTS_MIGRATION_2.sql  # Superseded, reference only
├── public/
│   └── fully-conscious-badge.png
├── scripts/
│   └── bump-version.cjs    # Auto-increments patch version on build
├── supabase-schema.sql
├── package.json
├── vercel.json             # Build config + cron schedules
└── vite.config.js
```

---

## Design System

The app was rebuilt in v3.0 against the Antenna redesign. Tokens live at the top of `src/index.css`.

| Token | Value | Use |
|-------|-------|-----|
| `--antenna-paper` | `#F2F0EA` | Page panels |
| `--antenna-rule-light` | `#E4E2DC` | App ground behind pages |
| `--antenna-white` | `#FFFFFF` | Blocks and cards |
| `--antenna-ink` | `#0B0B0B` | Headings, primary text |
| `--antenna-body` | `#4A4840` | Body copy |
| `--antenna-muted` | `#8A877D` | Labels, captions |
| `--antenna-rule` | `#DCDAD3` | Borders and rules |
| `--antenna-lime` | `#DEE42F` | Accent: fills, markers, underlines |

Three rules worth knowing before editing:

- **No border radius anywhere.** Blocks are separated by 2px of ground, not by outlines.
- **Lime is a marker colour, not a text colour.** It fails contrast as text on paper. Use it for fills, chips and underlines.
- **Base element styles must stay inside `@layer base`.** Unlayered CSS beats Tailwind utilities regardless of specificity, so an unlayered `h2 { color }` will silently override `text-white`. `:where()` does not fix this: it lowers specificity, but layer order still wins.
- **Lime backgrounds always take ink text.** White on lime is 1.2:1. The one place a filled chip needs white is on green or red, where `onScoreColor` handles it.
- **Report sections space from the top**, 80px above every section head, 32px between a head and its content. A section using only a bottom margin will collapse against its neighbour.

### Mobile

Three breakpoints, defined against semantic classes in `index.css` rather than inline at each grid:

| Width | Behaviour |
|-------|-----------|
| 900px | Two-column splits stack (`dc-split`) |
| 640px | Ledger rows restructure so the track spans full width (`dc-ledger-row`); results ledger drops secondary columns; maturity labels become a two-column legend |
| 520px | Score tiles hold at two across |

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19, Vite 7 |
| Styling | Tailwind CSS 4 |
| Icons | Lucide React |
| Charts | Custom SVG octagon radar chart |
| PDF Export | jsPDF + html2canvas |
| DOCX Export | docx, file-saver |
| Backend | Supabase (PostgreSQL, Auth, RLS) |
| AI | Anthropic Claude (claude-sonnet-4-6) via serverless proxy |
| Hosting | Vercel (with cron jobs) |

---

## Version History

| Version | Key Changes |
|---------|-------------|
| **3.28** | Website assessment refined: the headline stat row now mirrors the technical audit exactly (it previously showed a different subset and could disagree with it), and property consistency analysis now scrapes and translates each property's homepage to compare real proposition, claims and tone instead of listing generic risks. Fixed the underlying cause: every `setAssessmentData` call spread a stale snapshot, so whichever handler finished last silently reverted the others. US English enforced across both reports: spellings corrected in all report copy, rubric text and prompts, a US English rule injected into every model call path, and all date formatting moved from en-GB to en-US. Challenge audit trail surfaced: own numbered report section, masthead marker, DOCX and copy-text export, badges on Saved Assessments and Compass Results, and a summary persisted to `compass_results` for portfolio calibration. Fixed a pre-existing bug silently dropping `campaignLevel` and `footprintLevels` before they reached Supabase. Challenge loop: additional context weighed as evidence, revising only the sections filled in, then rescoring, with full challenge history. Language pass: substitutions, phrasing and bounded tone dials, merged back through a code allowlist so results cannot move. Assessor note on client links, attributed and previewed. No-social-presence declaration scored as an absence. Auto-checked social findings correctable in place. Website content now a hard gate, with a Jina scrape helper. Earned media auto-assess rebuilt to ten web-searched dimensions. Fixed: PageSpeed auto-fetch (missing `vercel.json` entry) and three-digit score clipping; saved-assessment delete passing an array index instead of the assessment; client links modal wrapping |
| **3.21–3.27** | Not recorded here |
| **3.20** | Recommended services removed from report and all exports; recommendation rows reveal on scroll |
| **3.19** | Trust & Credibility lens: four weighted reads on the same eight scores, computed in code, with tagged observable findings |
| **3.17–3.18** | Footprint switched from evidence counts to a 0–10 presence scale; hub shows the brand; mobile breakpoints across both reports |
| **3.15–3.16** | Brand footprint rebuilt as a presence map with corroboration links between channels |
| **3.13–3.14** | Client report brought onto the report treatment; score bands by performance; assessment page palettes and contrast swept to zero failures |
| **3.12** | Compare rebuilt from the design: score tiles with delta against the selection average, brand selection as checkbox ledger rows, panel headings at 15px |
| **3.11** | Score adjustment panel moved into the attribute grid; conclusions, justification and what we evaluated unified on one treatment; client report brought onto the current report styling |
| **3.10** | Score bands by performance (green / orange / red) with WCAG-checked values; scroll animations restored to the benchmark charts; section-level fade-in across both reports |
| **3.7–3.9** | Report body rebuilt section by section from the design file: attribute cards, recommendations ledger, benchmark comparison, services, conclusions; assessment page palettes normalised |
| **3.4–3.6** | Report masthead, results at a glance, brand maturity and the twelve numbered sections built from the design; Results ledger and Saved list rows rebuilt |
| **3.0–3.3** | Antenna redesign: square edges throughout, warm paper ground, lime accent, Inter, tile grids at 2px separation, tracked section heads; favicon updated |
| **2.28** | Design tokens and primitives applied app-wide |
| **2.24–2.26** | Client links: browser-encrypted, password-gated client reports with management, reset and revoke; PowerPoint export removed |
| **2.27** | Brand Footprint: eight-channel mosaic and ledger, signals rather than reach, voice split, shares stored for benchmarking |
| **2.21–2.23** | Framework v2.9: campaign coherence ladder and deterministic modifier; benchmark snapshots frozen at save with minimum sample size; social page simplified with structured health check and Run Everything |
| **2.20** | House voice applied across all AI outputs (short, sharp, no AI tells, no em dashes); AI Reputation gains auto-fetched third-party and search signals (Google News, Trustpilot, Search Snapshot) kept separate from the five AI engines; name confusion and owned-vs-third-party analysis added to reputation synthesis; guaranteed per-screenshot Visual Assessment in website and social analysis; Social Health Check extended to Bluesky and Substack with an owned/third-party read across consistency, creative, engagement, and trust; report attributes now show what is driving the score and brand-specific actions to improve it; Reputation Triggers panel removed; Assessor Context reframed as a readiness lens that shapes the report without being quoted in it |
| **2.17** | Stay Conscious rebuilt as weekly auto-composed newsletter with DOCX and copy export; sequential issue numbering; Landscape Insights headline generation; Brand Intelligence redesigned as single-column stack |
| **2.16** | Landscape Analysis and Story Opportunities migrated to weekly server-side Supabase cache; admin force-refresh; auto-loads on mount for all users |
| **2.15** | Consciousness Landscape view on Compare page: octagon with selectable/pinnable sectors, Attribute Landscape dot range chart, Sector Attribute Spread, Sector Profile cards, AI Landscape Analysis; Story Opportunities enriched with full sector attribute matrix and cross-sector spread; Industry Benchmarks tab removed |
| **2.14** | AI reputation expanded to 5 engines; reputation flags; Wikipedia/Reddit as AI training signals; read-only user role |
| **2.13** | Mini spider charts in results; comparison spider chart; Stay Conscious intelligence feed; Signal Conflicts diagnostic layer |
| **2.12** | Compass Results search and filters; production cleanup; recommendation benefits |
| **2.11** | Weighted scoring; manual tech audit inputs |
| **2.10** | Evidence-based scoring with citations |
| **2.9** | Supabase backend; assessor tracking |

---

© 2025–2026 Antenna Group. All rights reserved.
