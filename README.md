# Conscious Compass

**Brand Consciousness Assessment Framework v2.9** by Antenna Group

A React-based tool for evaluating brands across eight consciousness attributes using AI-powered analysis.

![Version](https://img.shields.io/badge/version-3.20.0-blue)
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
- Technical audit (PageSpeed scores)
- Recognition & credentials

### 3. Social Media Assessment
A structured Health Check populates the channel fields automatically; auto-checked content and assessor notes are held in separate fields so a re-run never overwrites typed input. Channel coverage is gated by business model rather than a fixed platform list. Campaign and paid signals are captured in one block, which feeds Campaign Coherence. **Run Everything** chains the health check, trademark search and analysis in one pass.

### 4. AI Reputation
Query up to five engines and paste responses: **Claude, Gemini, ChatGPT, Perplexity, Microsoft Copilot**. Wikipedia presence and Reddit community perception are captured here as AI training signals. A synthesis is generated from all inputs.

### 5. Earned Media
Press coverage, podcast appearances, keynotes, awards — last 3 months.

### 6. Report Generation
Twelve numbered sections: results at a glance, brand maturity, attribute analysis, brand footprint, campaign coherence, trust and credibility, benchmark comparison, recommendations, conclusions, score justification, what we evaluated, and assessment readouts. Exports as DOCX or copied text.

The client-facing report carries the same treatment as the internal one but omits recommendations, services, score justification, readouts and the campaign score adjustment.

---

## Key Features

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

The client sees scores, maturity, attribute analysis, footprint, campaign coherence, the benchmark profile and the conclusion. They do not see recommendations, channel assessments or internal notes. Manage, reset and revoke links from the Client Links button on Saved Assessments. A reset rebuilds the report from the saved assessment and re-encrypts it, keeping the same URL.

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

4. Deploy

```
Browser → /api/claude (Vercel serverless) → Anthropic API
                ↑
         API key lives here only
```

### Function Timeouts

`vercel.json` sets `maxDuration: 300` on `api/claude.js` and the cron endpoints. The scoring prompt runs to roughly 6,000 tokens and asks for about 3,400 back; on Vercel's default timeout the function is killed mid-response and the report never returns. **300 seconds requires a Pro plan** — on Hobby the ceiling is 60, which is usually still enough.

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

Schema is in `supabase-schema.sql`. Run the full file in Supabase SQL Editor on first setup, then apply the migration blocks at the bottom for subsequent deploys.

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
| `client_reports` | Gated client links. Stores ciphertext only; see `docs/CLIENT_REPORTS_MIGRATION.sql` |

Benchmark snapshots and campaign levels are stored inside existing JSON blobs rather than new columns, so they needed no migration. `client_reports` is the one table added since v2.x — run both migration files in `docs/` in order.

All cache tables use RLS with a read-only policy for authenticated users. Serverless functions write using the service role key, which bypasses RLS.

---

## Project Structure

```
conscious-compass/
├── api/
│   ├── claude.js                            # Anthropic API proxy
│   ├── knowledge-graph.js                   # Google Knowledge Graph lookup
│   ├── pagespeed.js                         # PageSpeed Insights proxy
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
│   ├── App.jsx             # Main application (~13,000 lines)
│   ├── data/
│   │   ├── rubric.js       # Framework v2.9 — attributes, campaign ladder, footprint channels
│   │   └── serviceMapping.js  # Service recommendations mapped to attributes
│   ├── lib/
│   │   ├── api.js          # API helper utilities
│   │   └── supabase.js     # Supabase client and auth functions
│   ├── index.css           # Global styles and design tokens
│   └── main.jsx            # Entry point
├── docs/
│   ├── WHAT_IS_A_CONSCIOUS_BRAND.md
│   ├── CLIENT_REPORTS_MIGRATION.sql    # Run first: client_reports table and RLS
│   └── CLIENT_REPORTS_MIGRATION_2.sql  # Run second: issuer name and update policy
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
