# Conscious Compass

**Brand Consciousness Assessment Framework v2.9** by Antenna Group

A React-based tool for evaluating brands across eight consciousness attributes using AI-powered analysis.

![Version](https://img.shields.io/badge/version-3.110.1-blue)
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
├── api/                                     # Vercel serverless functions (all require a signed-in caller)
│   ├── _auth.js                             # Caller checks (not a route)
│   ├── claude.js                            # Anthropic API proxy
│   ├── knowledge-graph.js                   # Google Knowledge Graph lookup
│   ├── pagespeed.js                         # PageSpeed Insights proxy
│   ├── scrape.js                            # Jina Reader proxy for homepage text
│   ├── youtube.js                           # YouTube Data API proxy
│   ├── refresh-stay-conscious.js            # Cron: brand intelligence (feeds the newsletter)
│   ├── landscape-analysis.js                # GET landscape analysis cache
│   ├── refresh-landscape-analysis.js        # Cron: refresh landscape analysis
│   ├── insights-analysis.js                 # GET story opportunities cache
│   ├── refresh-insights-analysis.js         # Cron: refresh story opportunities
│   ├── stay-conscious-newsletter.js         # GET newsletter cache
│   ├── refresh-stay-conscious-newsletter.js # Cron: compose newsletter
│   ├── list-users.js                        # Admin: list all users
│   └── delete-user.js                       # Admin: delete user
├── src/
│   ├── App.jsx                # Main application (~16,100 lines)
│   ├── index.css              # Design tokens and every dc-* rule
│   ├── main.jsx               # Entry point
│   ├── data/
│   │   ├── rubric.js          # Framework 2.10: attributes, campaign ladder, footprint, trust lenses
│   │   ├── thesis.js          # Sustainability narrative thesis
│   │   ├── stages.js          # Company stage framework
│   │   ├── sectorProfiles.js  # Sector calibration
│   │   └── serviceMapping.js  # Service recommendations mapped to attributes
│   └── lib/
│       ├── supabase.js, apiAuth.js                          # Database client; session token on /api/ calls
│       ├── docxFonts.js                                     # Embeds the report fonts in Word exports
│       ├── eco.js                                           # Earned Creative Opportunity module (config + pure logic)
│       ├── benchmarkView.js                                 # Report section 08: rank, percentile, marks, radar
│       ├── scrollMotion.js                                  # Scroll motion for the three reports
│       ├── campaignCoherence.js, footprintChart.js, trustLensView.js  # Report section view models
│       ├── teaser.js, teaserReport.js, teaserExport.js      # Teaser assessment, report and Excel export
│       ├── scorecard.js, cardVector.js, slideVector.js      # Baseball card and proposal slide
│       └── lazyZip.js                                       # JSZip on demand
├── public/
│   ├── fully-conscious-badge.png  # Badge and favicon
│   ├── fonts/                     # woff2 for the browser
│   ├── report/                    # TTF embedded in PDF exports
│   ├── scorecard/                 # Card and slide assets
│   └── version.json
├── docs/
│   ├── SUPABASE_SETUP.sql         # Run this: complete idempotent setup
│   ├── SUPABASE_VERIFY.sql        # Run after: 49 checks, reads only
│   └── WHAT_IS_A_CONSCIOUS_BRAND.md
├── tests/                         # npm test; tests/sql runs separately against Postgres
│                                  # design packet screens: tests/fixtures/design-screens.json
├── scripts/
│   └── bump-version.cjs           # Auto-increments patch version on npm run build
├── package.json
├── vercel.json                    # Build config, function timeouts, cron schedules
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

## Teaser (v3.29, admin only)

Quick indicative Compass reads for new business prospects. Enter brand name, URL, business model, industry and optional context. In two to three minutes it returns an overall score, all eight attribute scores with evidence confidence, credibility, trust, reputation and authenticity lens scores, a topline summary, and the questions a full assessment would settle. No recommendations: those belong to the full assessment.

Evidence is gathered automatically and in parallel: website pages, a social scan, an AI perception read (one engine with web search), review and search signals, an earned media scan, and a Knowledge Graph lookup. The website is required, and at least three of the five main sources must return evidence before scoring runs. The model scores; code calculates overall, maturity stage, campaign modifier and lens scores, identically to the full assessment.

**Separate from full assessment results.** Teasers live only in `teaser_assessments`. They never write to `compass_results` or `saved_assessments`, so they never appear in Results, Saved, Compare, Landscape, Insights or any benchmark. Converting a teaser to a full assessment starts a clean assessment with brand details, context and the scraped homepage carried into Setup; no teaser score is carried. This is enforced three ways: database policies, source structure tests, and interaction tests.

**Sector baseline (v3.31).** Each teaser is compared with the average overall score of full assessments in its sector, from the same benchmark engine as full reports: current framework only, the brand's own full assessment excluded, and a labelled fall back to all assessed brands when a sector has fewer than 5. It is recalculated fresh at every export, so every row in a file uses the same day's figures, and live when a teaser is opened. It appears in the export (Sector, Sector baseline (full assessments), Vs baseline, Full assessments in baseline, Baseline basis) and in the internal report strip, not in the prospect view or PDF. Sector is required for new teasers; Other compares against all brands. The teaser reads full results for this and only this; it still never writes to them.

**Stage and sector calibration (v3.56, method 2.4).** Two rubric assumptions were breaking smaller and non-cleantech brands. Company stage is now a required field on the teaser, using Antenna's six-stage framework (`src/data/stages.js`): Startup, Scaleup, Market Leader, Multinational, Conglomerate, Global Brand. Each stage names what a company at it would not yet have (Glassdoor, employee advocacy, analyst recognition, Wikipedia, share of voice, impact reporting, candour about litigation), which then counts neither for nor against, and what to judge instead (founder visibility, named early customers, a findable entity, candour about what is unproven). Stage also steers which services are worth naming. Sector profiles (`src/data/sectorProfiles.js`) give Real Estate & Construction and Energy & Utilities their own audiences, proof, channels, weak indicators and tone; other sectors get guidance to read their own conventions rather than borrowing cleantech's. Both change interpretation only: attribute weights and the overall calculation are untouched, so baselines stay comparable. The export separates Maturity (the band the score falls into) from Stage (where the company is in its evolution).

**The old stylesheet removed (v3.77).** The app had been carrying its entire pre-restyle stylesheet underneath the design system: 653 lines defining 52 of the same classes, including every button, and setting properties the new rules never reset. That is where the stray button colours, the header underlines and the alignment came from. It is gone; eight rules the system does not cover were carried forward. Nineteen of my own earlier patches were also removed, since they predated the system and were overriding it. The header is rebuilt to the export: a 64px shell, the `.dc-wordmark`, a text nav marked with `aria-current` rather than a class, and a Menu button below 900px.

**Sustainability principles: counts and type (v3.110.1).** The six principles' top level is stored as "breaking" (Breaking through), but the section counted and styled "evident", which never occurs: the tally always read "0 evident", the strip drew no green segment and Breaking through labels had no chip. The tally now counts and names "breaking through", and the chip and strip style it. The principles were also set smaller than the rest of the report: names go from 15px to the lead size and reasons from 13.5px to body size, and the tally numbers are serif numerals like the rest of the report's figures.

**Earned creative: recommendations only, from observed evidence (v3.110.0).** The final report no longer carries the internal earned creative inputs panel. The section shows only the recommendation (the opportunity, the ladder, HOWL and the next step), built entirely from what the assessment observes. The scoring pass now records, from the readouts only and each with where it was seen: verified truths (named data sets, patents, live programs, named partnerships, measurable results), red flags (controversy, regulatory or legal action, a contradicting lobbying or conduct record) and any cause territory with how directly it links to the business. These feed G4, G2 and G3 and the raw material and ladder examples. G1 proof rests on REFLECTIVE and G5 readiness on INTENTIONAL, since a claims audit or readiness checklist can't be observed from outside. The evidence figures (E1 to E5) and context flags were internal knowledge and are no longer used, so the Need Rating rests on the visibility deficit and the substance-visibility gap. The earned creative activations the scoring pass finds still give the +3 SENTIENT and INTENTIONAL lift; they can no longer be removed by hand. A report scored before this has no recorded evidence: it shows "Rescore this report to generate its earned creative opportunity" and nothing reaches the client until it is rescored. Anything an older report stored in the inputs panel is ignored and never reaches the client payload.

**More air in the Teaser read (v3.109.2).** Its sections read as crowded: a faint hairline between them and 12 to 24px under each heading. Now 96px between sections (was 64), 48px from the rule to the heading (was 40), and 32px under each heading and between blocks (was 24), the full report's heading-to-content rhythm. On a phone, 64px between sections.

**Open a Results row by clicking it (v3.109.1).** Clicking a brand's name, or anywhere on its row, opens and closes its details and earlier saves, not only the Details button. Clicks on buttons, links and inside the open panel are left alone, and the Details button stays for keyboard users. The brand name underlines on hover.

**One results row per brand, history kept, comparisons on the latest (v3.109.0).** Every save of a full assessment adds a results row, so a brand saved five times appeared five times on the Results page and counted five times in benchmark averages, ranks and sector baselines. Every save is still stored, as the brand's history, but the Results page now shows one row per brand (its latest save, with "3 saves" in the meta line and "2 brands · 5 saves" in the header), and Details lists the earlier saves, newest first, with date, score, band, framework version, assessor and the change to the next save. Delete on a brand with history reads "Delete latest save", and the previous save then becomes the latest. Everything that compares brands uses only each brand's latest save: the report's live and saved benchmarks, Compare, the Teaser sector baselines and campaign export, and the landscape, insights and newsletter-average jobs (`latestPerBrand` in `src/lib/benchmarkView.js`, and the same rule inline in the three jobs). Brands match on the name, trimmed and ignoring case. Existing duplicates become history with no data change. Also fixed: an opened Details panel on the Results page sat in the right-hand column instead of spanning the row. The CSV export lists each brand's latest save.

**Saved page dates follow the last save (v3.108.2).** The Saved page showed "saved" with the date the assessment was started (`project.date`) and sorted by it too, so rescoring a report and saving it again changed neither the date nor its place in the list. The list now carries each row's `updated_at`, which every save stamps, and shows and sorts by that ("Newest first" means most recently saved), falling back to the creation time and then the project date for older rows.

**Saving from the full report (v3.108.1).** Save gave no sign it was working: it writes the assessment, adds a results row and reloads the lists before its alert, which can take several seconds with the button unchanged. The button now reads "Saving…" and is disabled while it runs, then "Saved" for a moment; errors still raise an alert. Only one save runs at a time: a second click (or Save and exit during a save) used to start another, and each save adds a results row. A failed results summary is no longer hidden: it used to be ignored while the alert said "Assessment saved!", leaving Results and benchmarks without the brand; now the analyst is told the assessment saved but the summary did not, and to save again. A hiccup refreshing the lists after a successful save no longer reports "Save failed". Still open: every save adds a results row by design (to track a brand over time), so a brand saved several times appears several times in Results and counts more than once in benchmark averages.

**Scroll motion in the three reports (v3.108.0).** The full report, the client report and the Teaser read now move as they are read. Each section fades up once as it scrolls into view; most sections also draw their data in, with bars, benchmark tracks, maturity and footprint segments growing from zero, benchmark markers settling after their bars, and radar polygons growing from the centre, lightly staggered. Campaign coherence and the trust lens only fade up, as their design packets asked for no motion in the data. Numbers never count up. One shared observer per report tags sections and CSS does the movement, so nothing re-renders frame by frame (`src/lib/scrollMotion.js`). Sections already on screen appear at once; motion is off when the device asks for reduced motion (which the report radar and the maturity strip now respect too); printing shows everything; and the Word export forces the finished state before it captures panels, so nothing is captured blank or half-drawn. Content is only faded, never hidden, so screen readers and search-in-page find everything. The results, compare and assessment pages are unchanged. Removed: the `animate-fade-in` class, used across the app but never defined, and an unused `Reveal` component.

**Header logo (v3.107.1).** The Antenna Group logo in the app header goes from 17px to 22px tall.

**Earned creative rests on evidence only (v3.107.0).** The analyst override of the earned creative outcome and ambition level is removed, with its form and logic: the verdict now rests on observed evidence (the scores and the activations the scoring pass finds) and submitted evidence (the analyst's claims audit, flags, verified truths and readiness checklist) only, so nothing a person asserts can move it. The business profile selector goes too: the Startup profile loosens the substance floor and the readiness bar, so it now follows the company stage entered at Setup and nothing else. Overrides and profile choices saved on reports from v3.104.0 and v3.105.0 are ignored, and never reach the client payload. The HOWL opener choice stays, since it changes wording, never the outcome. This supersedes the override described under v3.104.0.

**Benchmark comparison rebuilt, with rank and percentile fixed (v3.106.0).** Report section 08 is rebuilt to packet 14 and shared by the full report and the client view: an overall 0 to 100 scale (group range as a pale band, the group average as an ink tick, the brand as a rust diamond), three stats, then the attribute rows beside a radar with the average as a dashed outline. There are no cards and no red scores. The benchmark group leaves the brand out so it is never compared with itself; the rank now counts the brand within the set, so it runs 1 to n with n including the brand (the live build could show "27th of 26"), and the percentile is round((n - rank) / (n - 1) x 100), clamped to 0 to 100, so first place is the 100th (it had been taken over the other brands only). Both are worked out at display time from what is saved, so existing reports read correctly without rescoring; the plain-text copy and the summary bar use the same figures. The sentence reads "against 26 other Energy & Utilities brands" and the rank "17th of 27". New benchmark snapshots save the group's overall score range for the band; older saved reports show no band rather than an invented one. When a sector has too few brands and the group falls back to all assessed brands, the wording says so ("Avg", "Rank among all brands") instead of calling it a sector. The Word export captures the new panels on the paper background. The logic lives in `src/lib/benchmarkView.js`.

**Earned creative as an opportunity ladder (v3.105.0).** The section is renamed "Earned creative opportunity" and no longer opens with a verdict that could read as a no ("not a priority", "when the right moment arrives"). Every brand is told it has an earned creative opportunity, then shown how far it can go: the opportunity's size (Significant when earned creative would close a real gap, Targeted when the brand is already visible and the work is best tied to a moment), and a four-step ladder, Foundations, Evidence-led, Partnered and Bold, marking where it can start now and what is within reach, with what unlocks the next step (the gate's conditions, or a later maturity stage). Each step's example is drawn from the brand's own verified truths, uncovered assets and cause territory. HOWL appears for every brand, scaled to the step: the full introduction from Evidence-led up, and a short "once the foundations are in place" version at Foundations. The decision logic is unchanged, and the packet's fixtures still run against it; the internal outcome stays visible in the analyst panel. One guard is added: a failed G1 (proof) or G2 (conduct) keeps a brand at Foundations whatever the outcome or an override says, because on a ladder any higher step reads as an invitation to act. The Teaser read shows the opportunity size and the ladder, with the starting step left to the full assessment.

**Earned Creative Opportunity module, framework 2.11 (v3.104.0).** Earned creative joins the Compass as a recommendation layer, built from the ECO Module Build Packet v1.0. It runs after scoring, reads the eight attribute scores and the analyst's inputs, and decides four things: need (a Need Rating from the visibility deficit, the substance-visibility gap, five evidence indicators and five context flags, with a substance floor and a startup exception); appropriateness (a five-criterion gate, G1 proof and G2 conduct being hard criteria); the outcome (Recommend, Recommend with conditions, Build substance first, Moment-driven or Not a current priority) and an ambition level (A evidence-led, B partnered, C bold); and whether to introduce HOWL, with the right opener and length. It never changes the Compass score, with one exception agreed for 2.11: when the scoring pass finds the brand already running earned creative, SENTIENT and INTENTIONAL each gain 3 points, once however many activations, capped at 100, stacking on the campaign coherence modifier. The scoring pass lists the activations it finds in the earned media and social readouts; the analyst can remove any, which recomputes the lift. The lift applies at scoring and rescoring, so older assessments pick it up when rescored.

How it fits the app: all weights, thresholds, bands, routes and copy live in `ECO_CONFIG` in `src/lib/eco.js`, with pure functions (`computeScores`, `computeNeed`, `evaluateGate`, `decideOutcome`, `calibrateAmbition`, `routeBenefits`, `selectHowlIntro`, `buildReportSection`). The app's six maturity stages map onto the packet's five (Pre-Foundational and Foundational take stage 1). The Startup profile comes from the company stage, and the analyst can change it. Evidence and gate inputs are analyst-entered in an internal panel on the full report; blanks are excluded and the rest re-averaged. A gate criterion with no inputs is Pending, and nothing reaches the client until the gate has its inputs. Overrides are admin-only, need a reason, store who and when, and can never produce a Recommend while G1 or G2 fails. The client report and client link carry the text blocks only; inputs, overrides and review notes stay internal. The Teaser read carries the lite view: a verdict, what earned creative is, and HOWL with the standard opener, with the gate marked as requiring the full assessment. HOWL appears with its wordmark (`public/howl-logo.svg`) and "by Antenna".

To tune it, change `ECO_CONFIG` only: `need.weights` and `need.highAt` (the 50-point line), `need.floor`, `triggers`, the `gate` thresholds, `usageLift.points`, and the copy under `copy` and `benefits`. The packet's nine fixtures (T1 to T9, with the T7 contrast check) run in `tests/eco.test.mjs`; rerun them after any change.

**Draft notice, and Stay Conscious as a newspaper (v3.103.0).** The unsaved-assessment notice moves into the Welcome page, first on it, built to packet 13: a rust "Unsaved assessment" kicker, the brand name in Newsreader, and a sentence-case meta line ("Step 3 of 5 · Last saved Sep 29, 2026, 8:55 AM"); the red bar, white card and uppercase line are gone. The step is clamped, so a draft at the report stage reads 5 of 5, not 6 of 5. Discard now asks first ("Discard this draft?"), then moves focus to Start new assessment. The stray 30-second draft saver is removed: it wrote, screenshots included, to a key nothing read, while the per-user saver already runs on every change; any copy it left is cleared. (The v3.99.0 note that drafts rarely saved was wrong: the per-user saver was working throughout.) Stay Conscious is rebuilt as a newspaper issue (09b): a toolbar, a masthead with italic tagline, title and a ruled dateline, the lead story in two columns beside the Landscape rail, brand intelligence in rows, story opportunities with rust numerals, and rules instead of cards; categories are plain text. Brand intelligence goes one row of two for one or two stories, one row of three for three, two rows of two for four, and two then rows of three from five. Share link copies a link to the current issue and says "Link copied" for 2 seconds; the app keeps one issue, so there are no per-issue permalinks yet. Force refresh is admin-only and asks first. The lead image appears only when an issue carries one. The Landscape rail's numeral is the portfolio average out of 100, full assessments only: the landscape job already calculated it for its prompt and now stores it, and the newsletter job carries it, averaging `compass_results` directly if the landscape cache predates the change; with no average the numeral is left out. The landscape insights paragraph, stored but never shown, now appears. The issue date is written in US English. The newsletter's Word export follows the newspaper design in the report export's system: Hanken Grotesk and Newsreader embedded, ink, muted and rust, paper page colour, the ruled masthead, double-rule section heads, plain categories and rust numerals; the Inter type, category colours and the leftover lime numeral are gone.

**Word export restyled to the template, with its fonts embedded (v3.102.0).** The full report's Word download follows the restyled MKB template: warm paper page colour, Hanken Grotesk for text and Newsreader for the title, section headings and the score; section headings sit under an ink rule; the score is a large Newsreader numeral with the band in tracked rust capitals; tables use hairline #DEDAD2 rules with tracked uppercase headers in muted grey on white; band colours follow the template (muted below Establishing, rust at Establishing, green above); the Inter type and the old greys, reds and greens are gone. Page size, margins and footer already matched. Both fonts travel inside the file, so the report looks the same on machines that do not have them: Hanken Grotesk regular and bold, Newsreader regular and italic, added by `src/lib/docxFonts.js` after the library writes the file, because the library can embed only a regular face. Each is an obfuscated part per ECMA-376, related from the font table, with the settings that tell Word to use embedded fonts and show the page colour. A test proves a font round-trips byte for byte; the file passes the OOXML validator; and LibreOffice renders it in Hanken Grotesk and Newsreader with neither installed. The fonts add about 150 KB compressed. If a font fails to load, the export still downloads, without embedding.

**Page gutter restored (v3.101.1).** Below 1280px every page ran to the screen edge. The packet nests `.dc-wrap` (which sets the side gutter) and `.dc-page` (which sets the vertical padding) on separate elements; the app puts both on one element, and `.dc-page`'s padding shorthand zeroed the gutter. Sections whose content sits in bordered cards still looked inset, so the fault showed most in brand footprint, campaign coherence and trust, whose text and tables had nothing between them and the edge. `.dc-wrap.dc-page` now restores the gutter: 20px on a phone and 48px from tablet up, the same for every section. Tile rows also go two per row on a phone: an unlayered four-column rule had been overriding every layered phone rule for tiles, including the PageSpeed scores on the Website step, and pushed the report 4px wider than the screen.

**Cleanup and speed (v3.101.0).** The main script is about half its former size: 1,990 KB down to 1,035 KB (588 KB to 308 KB compressed), because the Word, PDF and screenshot libraries now load only when an export runs, as JSZip already did. Three dead modules are removed: `src/lib/api.js` (never imported; it called an older model and carried a leftover Gemini URL) and `src/lib/deckExport.js` with `deckCharts.js` (never imported, and dependent on `pptxgenjs`, which was never installed). Dead code in `App.jsx` is removed: the 388-line PDF generator nothing called, two unused text extractors, the Instagram screenshot handlers with no controls, the email-share handler, and about 30 unused variables, imports and parameters. The full report and the client view now share one module-level section heading; the client view's own was declared inside its render, so every heading remounted on each render, and it still used the old uppercase style. `callClaude` now passes its temperature through; every caller already asked for 0, so scoring is unchanged. The lint config treats `api/`, `scripts/` and `tests/` as Node code, which removes 39 false errors: lint across the codebase goes from 91 problems to 7. The 13 design packet screens used by the parity tests are merged into one file, `tests/fixtures/design-screens.json`, with their CSS stripped, since the tests compare structure only. The repo drops from 107 files to 92.

**Endpoints require a signed-in caller (v3.100.1).** None of the serverless endpoints checked who was calling. `/api/delete-user` deleted any account for anyone who posted an id, `/api/list-users` returned every user, and `/api/claude` relayed any prompt on the Anthropic key; the Google and Jina proxies and the cache readers were open too. Every endpoint now starts with `requireUser` (`api/_auth.js`, which Vercel does not serve as a route): the request must carry the caller's Supabase session token, verified with Supabase itself. The two user endpoints also require the admin flag, read with the service key, and an admin cannot delete their own account there. The four refresh jobs accept Vercel's scheduled run or a signed-in user. Set `CRON_SECRET` in Vercel: with it, only Vercel's scheduled calls get in; without it, the cron user agent is accepted so the weekly refreshes keep running, and that header can be forged. In the browser, `src/lib/apiAuth.js` wraps fetch once at startup so every `/api/` call carries the token, which covers all call sites. The browser-key paths are gone: the build-time `VITE_ANTHROPIC_API_KEY` fallback (which would write a key into the public bundle), the direct browser calls to Anthropic, the API key field on Setup and the rescore key prompt; any key an earlier version stored in the browser is cleared on load. The built bundle contains no Anthropic address.

**Compass Results in the Saved pattern (v3.100.0).** Results was a grid of divs with inline column widths, Tailwind colours, icons and `.card` empty states. It now follows the Saved page: one row per brand with the name, a meta line (band pill, sector label, model, framework version, assessed date, Manual and Challenged where they apply), the serif score in ink, and Details, which opens the attribute breakdown, the mini radar (now ink, not olive), the assessor and, for admins, Delete. A Sort select like Saved's replaces sortable columns. Results and Saved now share the packet's header (display title, count or standfirst, actions on the right) and the labelled filter bar; both Back buttons are gone, since the header navigation covers them. Saved's rows and actions are unchanged. Add manual entry moves onto the shared dialog. Empty and no-match states are plain alerts. Two faults fixed: the Model filter offered "Both", which no result carries, so it always matched nothing (it now lists the models the results actually have), and Saved dates read "31 Aug 2026", against the US English rule; they now read "Aug 31, 2026", as does the one other British date in the app. The grid-table CSS the old Results used is removed. Packet screens 07 and 08 ship as test fixtures.

**Save and exit reopens where you left (v3.99.1).** Save and exit now records the step it was pressed on, inside the project blob, so no migration is needed. Opening that save from Saved returns to that step. Before this, an unscored save always opened on the Welcome screen, with the brand loaded but out of sight. Older unscored saves, which have no recorded step, now open on Setup. Saving strips screenshots to keep the record small, and Website and Social required screenshots before Continue, so a reopened step whose analysis was already done was blocked until they were uploaded again. A completed analysis now satisfies the screenshot requirement, since it already ran on them, and the screenshot block says so. Before any analysis, screenshots are still required.

**Assessment steps, rebuilt to the packet (v3.99.0).** Website, Social, AI reputation and Earned media (packet screens 02 to 05) now share one frame: the page head, the form column beside a sticky progress rail, sentence-case blocks with Required and Optional tags, the analysis in a ruled output box, and a footer where a disabled Continue names the first unmet requirement. No icons, brand colours, hard-coded colours or `.card` remain on them. The rail's checklist comes from each page's own rules: Website screenshots stay required, because Continue checks them and the analysis runs on them, and items Continue does not check (the Social health check and campaign signals, Wikipedia and Reddit) are marked optional. Save and exit runs the existing cloud save, then opens Saved; on failure the step stays and the save explains. The step bar shows "Draft saved" with the time once the 30-second autosave has run; that draft lives in this browser. Website's PageSpeed scores are editable numerals with Good, Needs work or Poor written out. Social runs everything from its one dark panel and lists channels as one accordion, with neutral ad-library links. AI reputation gives each engine a Pasted or Not pasted status and one neutral button, counts them on the block, and adds Copy prompt. Three faults were fixed on the way: the draft autosave restarted its clock on every change, so it only saved after half a minute idle; correcting an auto-checked Social panel lost focus on every keystroke, because the panel was declared inside the render; and Website's property consistency panel was a second dark panel with ink text on it, so its heading was unreadable. It is now a normal block with a table. Packet screens 02 to 05 ship as test fixtures.

**Teaser screens and the scoring screen, rebuilt to the packet (v3.98.0).** The teaser list, the run in progress and the teaser report (packet screens 19 to 21) and the full-assessment scoring screen (18) now follow the design packet, with every icon, inline style and hard-coded colour gone from them. The list groups teasers under each campaign on an ink rule, with a CSO toggle, a secondary Download scores button, and Rename and Delete as text links; Delete is disabled, with its reason in the tooltip, while a campaign holds teasers. Each teaser is one ruled row again (score, band, name, the four lenses, status), which fixes the stacked, centred cards the shared block rule had been forcing. The form keeps Sector and Company stage, which the packet left out. Bands come from the rubric's maturity stages, not the packet's sample labels. The run shows the packet's numbered step list, but every status is real: each source reports its own result, failures are marked, and the sustainability row appears only for CSO campaigns. The report's internal panel is a dashed definition list with the evidence sources as chips, and it no longer says "Scored without a stage" before anything has been scored. The read uses the packet's cover, score block, lens row and attribute cards, with the headline shown once; the trust lens reuses the shared panel, keeps its self-sizing scale rather than the packet's fixed 35 to 55, and lists findings as Supports and Against. The radar chart is dropped. The opportunity, brand image, services, sustainability narrative, thin-evidence notice and negative triggers are kept, since the packet's sample record simply lacked them. The read now says "Sector average", because the figure is an average, and only when there is one. The scoring screen takes the packet's layout and heading but not its content: scoring is one model call, so it names no passes, shows real elapsed time beside a bar marked as an estimate, and says that closing the page stops the scoring. The packet's styles are added; the dialog field rules are scoped to dialogs, and `.dc-link-btn` and `.dc-scoring` take the packet's definitions. Packet screens 18 to 21 ship as test fixtures.

**Dialogs and the scoring screen, rebuilt (v3.97.2).** The Challenge, Language and Client link dialogs rendered with a see-through panel: they draw it with `.card`, a class whose rule was lost in an earlier restyle, so the report showed through the form. All four dialogs, including the admin client-links manager, now share one `Dialog` component on the dc system: paper panel, ink rule on top, serif heading, the explanation as a `dc-alert`, labelled fields and full-width actions. It behaves as a real modal: Escape and the backdrop close it unless it is busy, focus moves in on open, Tab stays inside, and focus returns to the opener on close. The panel scrolls with the backdrop, so a tall form no longer clips its heading. The Client link dialog now names every section the client view renders, from one list a test checks against the view itself; it had been leaving out brand footprint, trust and credibility, and the sustainability narrative. The scoring screen is rebuilt on the dc system and made honest: scoring is one model call with no progress signal, yet the screen showed a percentage and ticked off six steps timed to it. The percentage and the steps are gone, the stage labels are removed from the code, and a real elapsed timer sits beside a bar that is marked as an estimate. `.card` gets a stop-gap rule matching the dc block, inside the components layer, so the other 37 places still using it (Compare, Insights, Stay Conscious, Saved, Results, Admin, sign-in and the legacy shared report) have their ground back until each is rebuilt to its packet.

**Redundant files removed (v3.97.1).** Fourteen files that nothing loaded, ran or should run are gone: the Vite starter leftovers (`src/App.css`, `src/assets/react.svg`, `public/vite.svg`); `public/favicon.png`, a byte-identical copy of `fully-conscious-badge.png`, which `index.html` now points at directly; `api/search.js` and `api/stay-conscious.js`, which nothing called (the weekly `refresh-stay-conscious` cron stays, since the newsletter reads its cache); the always-skipped Welcome parity test and its `dom-diff` helper, which pointed at a path outside the repo; the superseded `supabase-schema.sql` and both client report migrations; and `ARCHITECTURE.html`, `ARCHITECTURE.mermaid` and `STYLE_GUIDE.md`, which described v2.x and the retired chartreuse and Inter design system. The `api/search.js` timeout entry is removed from `vercel.json`, since Vercel rejects a function config that matches no file. The project structure above is rewritten to match the repo. No app behaviour changes.

**Brand footprint and trust lens, rebuilt (v3.97).** Sections 04 and 06 are rebuilt to the design packet, replacing the last inline-styled markup on the report. Both sit in `section.dc-section` with the packet's ids (`#footprint`, `#trust-lens`) and are shared literally by the full report and the client report; the trust lens also renders in the teaser prospect view. The footprint chart is drawn from the packet's geometry in `src/lib/footprintChart.js`: fixed channel angles with market on the right and brand on the left, node radius 12 + score × 3.2, links bowed 45% toward the centre. A test checks every coordinate against the packet's own SVG. The table sorts highest first with ties alphabetical. The corroboration sentence names the linked pairs. Two things the packet drops are kept because they are the evidence behind the scores: what was observed on each channel, as a muted line under its name, and what the model found connecting each linked pair. Long brand names step the core label down a size. The trust lens is built from `button.dc-weight` columns, with heights for reach out of 4 and weights out of 40%. Clicking a column spotlights that attribute across all five rows through `data-spot` and `aria-pressed`, and clicking again clears it. The scale keeps its dynamic window, sized to the lens scores and the Compass overall, because a fixed 25 to 50 would pin any lens above 50 at the right edge; 25 to 50 is what the window produces for the packet's own sample. Findings sit in `.dc-behind`, with a "Findings not captured" alert when there are none, and stay off the client view and its payload. Presence bands keep the rubric's names (Present, not Incidental). Retired: the hover tooltip, the count-up and bar animations, the rust lead bar, the `FP_*` palette and the dead `.dc-fpmap`, `.dc-fp-line`, `.dc-lens-row` and `.dc-lens-bars` rules. Finding pills now sit left under their text rather than inheriting the recommendations' right alignment.

**Campaign coherence, rebuilt (v3.96).** Section 05 is rebuilt to the design packet as one shared component, `CampaignCoherencePanel`, used by the full report, the client report and the legacy shared view, so the three can no longer drift. It shows the level and verdict, a five-step scale (`.is-reached` below, `.is-current` at, with `aria-current`), notes for why this level, the next step and confidence, then the campaigns found. Level names and one-line definitions come from the rubric ladder, not the packet's placeholder text, so the report never defines a level differently from the ladder the brand was scored against. Level 0 reads "Below level 1" with no step marked; level 5 drops the next-step note. The confidence basis is counted in code from the campaigns returned ("Based on 3 campaigns found across 5 channels"); the model supplies only low, medium or high. The client view keeps its existing payload: level, verdict, rationale and next step, with no campaign list or confidence. The animated ladder is retired. Unscored reports show a "Not scored yet" alert with Regenerate. Attribute reach columns for one to three lenses move from #C9C4BA to `--cc-faint` (#8A8E95), which clears 3:1 against the paper. DOCX, PDF and plain-text exports are unchanged.

**Client report view, one surface (v3.95).** The client view already shared the rebuilt report components (glance, tiles, attribute cards, trust lens, thesis) and its cover was rebuilt in v3.74, but its own sections still sat on white cards against the page. Those are gone: sections take `.dc-read-sec` and the remaining panels take `.dc-block`, so the prospect-facing view reads on one surface like the printed read.

**Trust lens, rebuilt (v3.94).** The panel moves onto one surface with ruled rows, taking `.dc-lens` and `.dc-lens-intro` from the export, instead of stacked cards separated by 2px gaps on a second ground, which is what made it read as a grey slab. Weight columns are honest: a weight of zero draws a dashed baseline rather than a sliver of colour that looked like a small weight, and the spotlight tint uses the system's hover.

**Trust lens marks (v3.93).** The scale legend read "lime = compass overall" after the accent had changed to rust; it now names the mark ("tick = Compass overall 40") and the tick is drawn faint, with the lens score as the accent. Lens scores are no longer coloured by band. The report toolbar's six actions (Copy full report, Challenge, Language, Save, Client link, Export DOCX) are covered by a test that fails if any loses its handler.

**Section spacing and lens reach (v3.92).** Every report section carried its own 80px top margin on top of the page stack's gap, which is why the page read as loose; the margins are gone and sections now sit 48px apart on the stack alone. In the trust lens panel the attribute reach columns move to ink at full reach and a single muted tone otherwise, with the count written underneath, replacing a four-step colour scale that carried meaning no label explained.

**Footprint, against the design (v3.91).** Comparing the built section with the design: the chart's nodes now speak the same language, brand filled ink, market outlined on paper, absent a dashed ring, with rust kept for the corroboration lines rather than used as a channel colour. The table reads strongest first and its presence bar carries the conscious threshold at 7. The legend names every mark, including what node size and the tick mean.

**App header, to the brief (v3.90).** Rebuilt from `app-header.html`: three columns, with the brand left, the nav centred on the page and the session right. Admin is now a nav link shown to admins rather than a button; Sign out lives in an account menu behind the person's name, which closes on outside click, on Esc and on a route change; "New assessment" is the only filled button; and the "Draft saved" line has moved off the header, as the brief asks. Below 900px the nav and that button move into a drawer behind a Menu button. The header CSS comes from the brief, replacing the flex version. The wordmark keeps the Antenna logo at the brief's 17px rather than the text stand-in.

**Evidence panel (v3.89).** "What sits behind these scores" was a stack of white cards with hand-set type; it is now one block with the heading in the display serif, findings as a two-column list under hairlines, and each finding's lenses as pills. The legend takes the export's key style and states what each mark means in words.

**Brand footprint (v3.88).** Section 04 takes the export's structure: a head with "Where the brand shows up." in the display serif and the two counts beside it as serif numerals, then the chart and a channel table side by side. The table is new, and reads from the same data as the chart: each channel, whether the brand or the market drives it, presence as a ten-segment scale, the figure, and the level in words.

**Score adjustment, full width (v3.87).** The panel sat as one cell in the attribute grid and left most of a row blank. It now spans the grid, with its heading on the system's card style.

**Maturity and the attribute cards (v3.86).** Section 02 is rebuilt from the export: six bands on one track with the score marked above it, ranges under each label, and the summary as a band chip plus a meta line rather than a rust-edged block. Section 03's cards become `.dc-block.dc-attr-card` in the export's grid, each with a serif numeral, the attribute name in the display serif, its subtitle as meta, and a 3px bar; the numeral is no longer coloured by score.

**Tile alignment and the double rule (v3.85).** The eight attribute tiles wrap onto two rows of four, and the system divides them with an adjacent-sibling rule, which put a left border and its padding on the first tile of the second row so the rows did not line up. Position in the grid decides the divider now, and a wrapped row takes its own top rule. The masthead also carried a bottom border directly above the first section head's own rule, which read as an extra grey line and an empty band; it is removed.

**Section heads (v3.84).** Rebuilt to the export: a rust number, the title in the display serif, and a text "Hide"/"Show" carrying `aria-expanded`, in place of the uppercase tracked label and the chevron icon.

**Report masthead and toolbar (v3.83).** The toolbar was a stacked column of black boxes with icons; it is now the export's head row: five secondary buttons and one primary, text only, sharing a baseline with the title. Back becomes an arrow link. The "rescored after challenge" badge was ink on a rust fill, which fails contrast, and is now a neutral pill.

**Rebuilding the report from the export (v3.82).** Restyling in place had gone as far as it could, so the report page is being rebuilt section by section from `01-report.html` rather than nudged toward it. Section 01, Results at a glance, is done: the score is a serif numeral with its 6px bar and a band chip that writes the band and its range, followed by the stage description and the summary sentence, beside the radar. The black score box, the repeated headline quote, the rust marker under the strength words, the radar's alternating fills and its centre disc are all gone. Recommendations take neutral pills with "Benefit" as a label (the rust-filled tags failed contrast), and the attribute tiles are ink serif numerals with bars rather than numbers coloured by score. Sections still to rebuild: maturity, brand footprint, the attribute cards, the trust lens and the evidence panel.

**The header crash (v3.80).** The rebuilt header rendered `lastAutoSave` directly, and that value is a `Date` object, which React refuses to render as a child: every page with a draft in progress fell to the error boundary ("Something went wrong", React error #31). It is formatted as a time now, with a test that fails if a raw Date reaches the markup again.

**Layering (v3.79).** The design stylesheets are plain CSS and were beating Tailwind's utilities, which live in a layer: a button reading `bg-[#15171A] text-white` lost its white and rendered ink on ink, and inputs lost the left padding that kept their icon clear of the placeholder. The system now sits in `@layer components`, so the markup's own utilities win. The Antenna wordmark is back in the header; the export's text stand-in had replaced it.

**One stylesheet, not two (v3.78).** The app had been carrying its entire pre-restyle stylesheet underneath the design system: 653 lines defining 52 of the same classes, including every button, and setting properties (uppercase, tracking, a hover wipe, borders) that the new rules never reset. That is where the stray button colours, the header underlines and the alignment came from. `src/index.css` is now the four export stylesheets in their stated order, the self-hosted faces, the migration aliases, and one short block of app-specific rules for classes the system does not define. The header is rebuilt to the export: a 64px shell, `.dc-wordmark`, a text nav whose active item carries `aria-current` rather than a class, and a Menu button below 900px.

**Design parity, measured (v3.76).** The restyle kept drifting because the app's markup was being styled rather than rebuilt, and nothing checked the difference. `tests/support/dom-diff.mjs` renders a component to static HTML and compares its class usage and nesting against the matching file in the design export, reporting what the design uses that we never render. The first audit was blunt: Welcome 24%, Admin 12%, Stay Conscious 11%, the client report view 40%. The four stylesheets from the export are installed in their stated order (tokens, assessment, screens, report), and Welcome is rebuilt to the design's own markup, moving it to 100% of the page body (the six remaining classes belong to the header component). `tests/design-parity.test.mjs` fails if Welcome stops rendering a class the design uses.

**Sustainability narrative, to the handoff (v3.75).** All four stylesheets refreshed to the latest package, which adds the brand footprint and sustainability styles to `report.css`. The sustainability section is rebuilt: the read as a lead paragraph, the verdict on a dark panel with progress and voice as three-segment scales (each with its value written and an aria-label), then "Six principles" with a tally strip showing how many are evident, surfacing and buried before the six are listed. Status chips write their level out, so nothing rests on colour. The brand footprint section's styles are in place; its markup is still to be rebuilt.

**Client report view, to the handoff (v3.74).** The screen a prospect sees now opens like the printed read rather than like the app: a thin strip carrying the Antenna logo and a "Brand-facing report" kicker in place of app chrome, then a cover with the brand in the large serif, the thesis as a quote, the meta line, and the overall score with its 6px bar and a band chip that writes the band out. "About this report" sits in the handoff's label column. The assessor note becomes a signed quote in the serif rather than a rust-edged card, since it is a person speaking and should not read as another framework output. The footer carries the assessed-on line plus "Prepared by Antenna Group".

**Handoff v2, screens 06-12 wired in (v3.73).** The latest `compass-tokens.css` (six band chips, not four, with the band always written in the chip), the updated `assessment.css`, and the new `screens.css` and `report.css` are all in `src/index.css`. The header wordmark takes `.dc-wordmark` and the Results brand diamond is renamed `.dc-brand-mark`, resolving the clash the handoff flagged. Three corrections they called out are applied: the Results table no longer colours its diamond, number and bar by score, which had given rust a "bad" meaning and left the reading resting on colour alone (the band now travels in a Stage chip); sector shows its display label rather than its key; and on Saved Assessments the off-palette blue tip box is replaced by a meta line, with dates reading "31 Aug 2026". Still to build from this packet: the Compare dot plot (new markup), the Results table as a real sortable table, the Saved row with its More menu, Admin, Stay Conscious, Welcome, and the client report view.

**Handoff v2, first pass (v3.72).** The updated `compass-tokens.css` replaced the earlier one in `src/index.css` (tabs now carry an inset rule rather than a border, buttons declare their own cursor and family), and `assessment.css` was added for the four assessment steps. The page runs at the handoff's own 1280/48 geometry rather than the 1440/80 I had inferred from the screen canvases. The stepper is rebuilt to the handoff: six steps on a rule, each naming its state in words ("Done", "In progress", "Not started") so the reading never rests on colour alone, with a compact "Step 2 of 6 · Website" form below 720px and the tick icon dropped. The Website step opens with a rust kicker, a display-serif title and brand-and-site standfirst, and the duplicated score row at the top of that page is gone: those four numbers now appear once, in the technical audit, as the notes ask. A test also catches unicode escapes left in JSX text, where they print literally rather than as the character.

**Report, to screen B (v3.71).** The last of the four acceptance screens. The report masthead now leads with the verdict rather than the brand name: a rust eyebrow ("Compass report · Brand"), the headline set in the display serif at up to 900px, and a provenance line underneath (run date, sector, company stage, framework version), with the actions on the same baseline. Section rules, the tab row's active state and the two-column overview split (narrative beside the chart at 64px) follow the screen; the handoff's own tab rules were left to stand rather than restated.

**Compass Results, to screen C (v3.70).** The dense screen, built to the handoff's table: 40px rows on hairline separators under an ink header rule, each brand carrying a 7px diamond in its score colour, and the overall shown as a right-aligned tabular numeral beside a 3px bar. The table stays in the sans so columns align; the serif is kept for headings, as the screen has it. Dense-screen controls are 36px with hairline borders (`.dc-controls`, `.dc-seg`), and `.dc-summary4` gives the four-cell summary strip under an ink rule.

**Buttons, menus and the read's masthead (v3.69).** Buttons follow the handoff: sentence case at 40px, flat hover, the pre-restyle uppercase, heavy tracking and sliding wipe cleared, with the handoff's disabled and focus states. Row and toolbar icon buttons share the row hover, nav items hover to ink, the mobile menu drops on paper with hairline rows and a rust marker on the active item, and selects keep a drawn caret now that fields are reset. The teaser read's masthead is rebuilt to screen A: a two-column head with the brand in the hero serif and the headline as the lead, beside a score block with the 132px serif numeral, "/ 100", the 6px overall bar and chips for the maturity stage and sector median.

**Weighting and type, corrected to the handoff (v3.68).** Five of the designer's rules were being overridden by later blocks of mine, and the type ones mattered: `dc-standfirst` is their 19px lead paragraph, and I had turned it into an 11.5px uppercase label, so every page subtitle shouted. Their rules now stand for type and weight; later blocks may only re-state layout, and a test enforces that. Titles take their display rule, row titles sit at semibold rather than 700, score numerals are the serif at regular weight (22 headings dropped from 700 to 600, and large numerals moved to the serif via `.dc-numeral`), and the page runs to the screens' geometry: 1440 wide with 80px padding, content to 1280, with the 48px stack rhythm restored.

**Setup, rebuilt to screen D (v3.67).** The first of the four acceptance screens. Setup now uses the handoff's three-column layout: a 240px step rail, a 720px form column and open space to the right, collapsing to two columns at 1100px and one at 820px. The rail lists the five steps with their state (complete, in progress, not started), numbered under an ink rule, and replaces the horizontal progress bar on this screen only. The page opens with the screen's header pattern: a rust eyebrow ("Step 1 of 5"), a serif title and a standfirst, in place of the old "Brand Details" heading. Fields sit 10px under their labels with groups 40px apart.

**UI system, phase four (v3.66).** Built from the four screen examples in the handoff HTML, which set a shell the earlier phases had not followed: a 64px header on a hairline rule (not the old 2px ink bar) with the nav at 13.5px medium running full height and the active item carrying a rust underline; page padding of 80px at the sides, stepping to 40 and 20 as the viewport narrows; and fields at a uniform 44px with a hairline border, 2px radius and a rust focus ring, applied from the stylesheet so every screen picks them up without touching its markup.

**UI system, phase three (v3.65).** From QA on the built app: the radar chart moved off the old lime and olive onto the report's palette (rust polygon at 14% on paper, hairline rings, rust points), on screen and in the chart drawn for the exported report; the strength highlight became a low tint rather than a solid bar at half text height, which read as a strikethrough in rust; and the last default framework colours (amber, indigo, the neon lime) were replaced with tokens. Platform brand colours such as the LinkedIn blue are deliberately left alone.

**UI system, phase two (v3.63).** The classes still carrying pre-restyle geometry were brought onto the new scale: page heads and titles (serif, on the new type scale), standfirsts, list and results rows with hover, score numerals in the serif, ledger rows and tracks, attribute cards, recommendation rows and tabs. Layout-critical tokens now carry literal fallbacks (`var(--cc-page-max, 1280px)`), so a missing token degrades instead of collapsing the page. Eleven layout helpers remain on their original geometry; their colour comes from the aliases.

**UI kit and the token fix (v3.62).** v3.61 shipped with the token block silently dropped: a banner comment contained "dc-*/btn-*", whose "*/" closed the comment early, so every custom property after it was discarded and the app rendered with no max width, no gutters and none of the new palette. Fixed, with a test that fails if any CSS comment closes early or the layout tokens go missing. Added `#uikit`, an admin-only page rendering the whole system against the live stylesheet: colour swatches read from the tokens, the type scale, buttons, fields, surfaces, scores, chips, tabs, rows, alerts and skeletons. It is the QA surface for the rest of the restyle.

**UI system, phase one (v3.61).** The app moved onto the Compass UI system from the design handoff (direction 1b: rust on screen, lime kept for print). `src/index.css` carries the new tokens and the rewritten `dc-*`/`btn-*` rules, with the old `--antenna-*` names aliased to the new tokens so nothing renders in the retired palette mid-migration. Newsreader and Hanken Grotesk are self-hosted from `public/fonts` as woff2; the Google Fonts import is gone and no on-screen type uses Inter. 1,341 hard-coded colours in `src/App.jsx` were mapped to the new palette using the handoff's table, with `#E4E2DC` split by context (backgrounds to paper, borders to rule). Tests fail the build if any retired colour returns, if an old variable stops resolving to a new token, or if the print artefacts lose their own palette. Still to do: component-level typography (the serif display scale), the four acceptance screens, chart palettes in `rubric.js`, and the remaining one-off colours.

**One download (v3.60).** The card, slide and read are no longer three buttons. A single **Download pack** produces `{Brand} Teaser Pack.zip` holding `{Brand} Teaser ReadMe Internal.pdf`, `{Brand} Teaser Card 5x7 bleed.pdf` and `{Brand} Teaser Slide.pptx`. Without a brand image or a sector baseline the button reads **Download read** and the zip holds the read alone, rather than being disabled.

**Setting a stage on an existing teaser (v3.59).** Company stage can be set or changed from the teaser report's internal panel at any time, not only when a teaser is first run. Each result records the stage it was scored at, so the report says when the stage has changed since scoring and a rescore is needed; a rescore reuses the stored evidence.

**Company stage everywhere, and the five-page read (v3.58).** The six-stage framework in `src/data/stages.js` now applies to the full assessment as well as the teaser: Company Stage sits on Setup, its rules go into the scoring prompt, and converting a teaser carries its stage across. The teaser PDF is now the five-page "Compass Read" report (`src/lib/teaserReport.js`), drawn as vector on US Letter to the design handoff: page 1 summary with the eight-axis radar, pages 2 and 3 the attributes, page 4 evidence and the opportunity, page 5 the levers, open questions and method. Newsreader and Hanken Grotesk are embedded from `public/report/` at export time, with the PDF base fonts as a fallback if they cannot be fetched. The earlier single-page summary PDF is gone.

**Missing evidence versus evidence of a problem (v3.57, method 2.5).** The four lenses were reading a quiet public record as a bad one. Teaser scoring now separates the two: an observed problem (poor or falling reviews, repeated complaints, a contradiction between claim and conduct, greenwashing accusations, litigation or regulatory action, hostile coverage, employee sentiment against the external story, a security incident) carries full weight, while absence is at most mild and no attribute may be scored below 40 on absence alone; below 40 requires a named trigger, or the score is raised and confidence lowered instead. Findings are marked "evidence" or "gap", observed problems are listed separately in `negativeTriggers` with lens, source and severity, and `lensEvidence` records per lens how many issues and gaps sit behind it. A lens under 50 with nothing observed against it is flagged as scored down for what could not be verified, in the report and the PDF, so a number never implies trouble that was never found.

**Written for new business (v3.55, method 2.3).** Teasers now carry two things beyond the scores. "The opportunity" is a two or three sentence commercial read for whoever runs the brand's marketing: what the scores leave on the table and what closing the gap would unlock, grounded in the evidence and free of pitch language. "Where marketing would move this score" names two or three services that address the weakest attributes, led by the framework's own catalogue in `SERVICE_RECOMMENDATIONS`, named by exact title, with each catalogue service's impact line and attribute mapping taken from the catalogue rather than the model. Where the evidence argues for work the catalogue does not cover, one additional service is allowed: it is labelled "Beyond the catalogue" in the report, "(proposed)" in the export, carries no invented house copy, keeps only real attribute names, never comes first and never stands alone. Both appear in the report and the PDF, and the campaign export gains a "Services indicated" column. The teaser stays diagnostic: depth, sequencing and effort remain the full assessment's job, and the "what a full assessment would settle" questions still close the read. Teasers scored on earlier methods are flagged until rescored.

**Calibrated scoring (v3.32, method 2.0).** Teasers are scored on the evidence a quick read can reach. Before scoring each attribute, the model decides which of its rubric signals this pass could observe and answers the attribute's question against those only. Signals the pass could not reach count neither for nor against; things a scan searched for directly and did not find still count. Scores below 40 require observable evidence of weakness. Nothing is added to scores afterwards, and teasers apply no campaign modifier. What could not be observed is recorded per attribute and shown internally. Teasers scored with method 1.0 are flagged in the list, the report and the export until rescored; Rescore reuses stored evidence. The full assessment's scoring is unchanged.

**Out-of-date tabs (v3.33, extended v3.47).** A browser tab keeps running the build it loaded. Before any teaser is run, rescored or refreshed, the app checks `/version.json` against its own version; if a newer build is live, it refuses to score and asks for a reload, and a banner says so on the Teaser page (checked on open and when the tab regains focus). If the check cannot be made, scoring is not blocked. The same check guards the card, slide and campaign download, since their lazily loaded chunks are renamed by each deploy and a stale tab requests files the server no longer has; a failed chunk load also reports itself as an out-of-date page rather than a raw fetch error. `version.json` is written by the bump script and a test keeps it in step with `APP_VERSION` and `package.json`. Each teaser report shows when it was scored and with which method.

**Sustainability narrative thesis (v3.36, framework 2.10).** Antenna Group's thesis ("Sustainability is getting buried…") is tested as six tenets, each rated Buried, Surfacing or Breaking through, plus progress (limited, moderate, strong) against voice (quiet, audible, loud); the progress-vs-voice verdict (for example Whispering, Overclaiming) is decided in code. Single source: `src/data/thesis.js`. The full assessment returns the read for every brand and shows it as its own numbered section in the report, PDF, Word export, client link and shared view; older reports offer to regenerate. The read never changes the attribute scores. Separately, thesis signals were added to six attributes' strong and weak signals in the rubric (Attentive and Cogent unchanged), which is where they move scores; framework 2.10 stays on benchmark major version 2, so existing full assessments remain comparable. Teaser campaigns can be set to a CSO audience: their teasers add a sustainability scan, the thesis read in the report and PDF, CSO-focused summaries, and thesis columns in the export. Teaser method 2.1.

**Scorecards (v3.37, teasers only).** A scored teaser with a brand image produces two deliverables from the Antenna Group templates, markup and inline styles ported unchanged (`src/lib/scorecard.js`, templates kept as test fixtures): a two-page print card (5x7in trim, supplied at 5.25x7.25in with 0.125in bleed, no crop marks, rounded corner dropped because the card is bled and trimmed square) and a 1920x1080 pitch slide written directly as a .pptx that Google Slides opens. Fonts follow each template: Archivo, Archivo Expanded and Space Mono on the card, Inter on the slide, loaded from Google Fonts only when an export runs. The QR code is a fixed local asset rather than the template's live api.qrserver.com call, because a cross-origin image blocks the canvas the PDF is drawn from; it decodes to the same antennagroup.com/lets-chat. Compass Score, the four tiles and the industry average come from the teaser and its sector baseline. The brand image is uploaded per teaser, downscaled in the browser to 1800px and stored on the row. A test compares every generated inline style against the template files and fails on any deviation that is not declared.

**Scorecard rendering (v3.48).** Both deliverables are now built as real artwork rather than screenshots of HTML. The card front is drawn as vector art into the PDF (`src/lib/cardVector.js`) in Helvetica, which is what the reference PDF used and which PDF carries itself, with Space Mono embedded for the two plate labels and the call-to-action arrow drawn (Helvetica has no arrow glyph). The slide is built as native PowerPoint shapes and text (`src/lib/slideVector.js`), so it opens in Google Slides fully editable; 1920x1080 CSS px maps exactly onto the 13.333x7.5in slide at 6350 EMU per px, line spacing is set in exact points (percentage spacing adds the font's own leading), and the headline highlight is its own block so it cannot paint over the line above. html2canvas is no longer used by either. The image well carries no keyline on either deliverable (v3.49). The back page ships as fixed artwork at `public/scorecard/card-back.png`. Spacing that the browser resolved differently from the CSS is measured from the reference files and held by tests.

**Slide, matched to the cleaned-up deck (v3.52).** The generated slide now reproduces the hand-tidied reference exactly: headline 58px on a 63.85px step, body 23px carrying the teaser note as its last two paragraphs (the divider and separate note shape are gone), tile values 66px with 16px labels, plate label "YOUR COMPASS / TEASER SCORE" at 24px bold and pinned to two lines, chip label 16px, and the link, gradient and call-to-action text at the reference's positions. A generated slide was diffed shape by shape against the reference: all 37 shapes match in position, size and type.

**Teaser report layout (v3.51).** The two blocks under the nav were rebalanced. The internal panel is a labelled two-column grid (campaign, evidence, baseline, brand image, context) with the scored-at line in its header row, evidence as chips, and warnings and the not-observable list collected at the foot. The read opens with a 46px brand masthead, then the verdict and summary beside the brand image, then a single score band with the overall on ink and the four lenses across it. Everything below, the radar chart and the eight attributes, is unchanged, as is the app's palette and the generated copy.

**Roles (v3.50).** Four: read-only, full user, business user and admin. A business user is a full user plus the teaser, with no admin rights; admins grant it on the Admin page ("Grant Teaser Access"). Business and read-only are mutually exclusive, since the teaser creates records. Teaser access is one rule, `public.can_teaser()` in the database and `canTeaser()` in the app: admin or business, approved, not read-only; teaser tables gate every operation on it. A role-guard trigger pins is_admin, is_biz, is_approved and is_readonly on update unless an admin makes the change, closing a hole where any user could set is_admin on their own profile row.

**Admins and business users**, in the UI and at the database: every teaser policy checks `can_teaser`. `SUPABASE_VERIFY.sql` check 10 fails if any teaser policy stops doing so, and check 10b fails if the role-guard trigger is missing.

**Campaigns (v3.30).** Every new teaser belongs to an Antenna Group campaign, chosen or created inline on the teaser form. The Teaser page groups teasers by campaign with brand counts and average overall, and can be filtered to one campaign. Campaigns can be renamed; a teaser can be moved between campaigns from its report. Campaign names are unique ignoring case and spacing. A campaign can only be deleted when it is empty, which the database enforces. Teasers run before v3.30 appear under Unassigned until moved. Campaign names are internal: they never appear in the prospect view or PDF, and never carry into a full assessment.

**Download scores.** Each campaign exports a styled Excel file: one row per brand with overall, stage, the four lenses, the eight attributes, low-confidence count, thin-record flag, headline and scored date, in the app's green, orange and red bands. Scored brands are sorted highest first; unscored brands are listed as Not scored. A Notes sheet explains the method. Context, evidence and authorship are never included. Written directly as SpreadsheetML via JSZip, so no spreadsheet library is added.

**Deploying:** re-run `docs/SUPABASE_SETUP.sql` (idempotent), then `docs/SUPABASE_VERIFY.sql`. Every row should say PASS.

## Tests

```
npm test                                   # teaser logic, export, rendering, separation
PGHOST=... PGUSER=postgres tests/sql/run.sh  # setup idempotency, admin-only RLS, campaigns, table separation (needs Postgres)
```
