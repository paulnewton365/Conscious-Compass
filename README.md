# Conscious Compass

**Brand Consciousness Assessment Framework v2.8** by Antenna Group

A React-based tool for evaluating brands across eight consciousness attributes using AI-powered analysis.

![Version](https://img.shields.io/badge/version-2.20.0-blue)
![Rubric](https://img.shields.io/badge/rubric-v2.8-green)
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
LinkedIn, X, Instagram, YouTube — plus influencer partnerships, paid media, Glassdoor, and WIPO trademark.

### 4. AI Reputation
Query up to five engines and paste responses: **Claude, Gemini, ChatGPT, Perplexity, Microsoft Copilot**. Wikipedia presence and Reddit community perception are captured here as AI training signals. A synthesis is generated from all inputs.

### 5. Earned Media
Press coverage, podcast appearances, keynotes, awards — last 3 months.

### 6. Report Generation
Scores across 8 attributes, spider chart, maturity stage, signal conflicts, recommendations, and export options (PDF, DOCX, copy text).

---

## Key Features

### Assessment & Results
- **Compass Results** — Sortable, filterable dashboard of all assessments with CSV export
- **Saved Assessments** — Resume in-progress work at any time; draft auto-save to localStorage
- **Signal Conflicts** — Automated diagnostic layer flagging attribute tensions (e.g. high AWAKE + low INTENTIONAL)
- **Read-Only Access** — Share results with clients without edit permissions
- **Shared Reports** — Share a read-only report via URL (base64-encoded, no login required)

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
│   ├── App.jsx             # Main application (~10,000 lines)
│   ├── data/
│   │   ├── rubric.js       # Framework v2.8 — 8 attributes, signals, maturity stages
│   │   └── serviceMapping.js  # Service recommendations mapped to attributes
│   ├── lib/
│   │   ├── api.js          # API helper utilities
│   │   └── supabase.js     # Supabase client and auth functions
│   ├── index.css           # Global styles and design tokens
│   └── main.jsx            # Entry point
├── docs/
│   └── WHAT_IS_A_CONSCIOUS_BRAND.md
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
| **2.20** | House voice applied across all AI outputs (short, sharp, no AI tells, no em dashes); AI Reputation gains auto-fetched third-party and search signals (Google News, Trustpilot, Search Snapshot) kept separate from the five AI engines; name confusion and owned-vs-third-party analysis added to reputation synthesis; guaranteed per-screenshot Visual Assessment in website and social analysis; Social Health Check extended to Bluesky and Substack with an owned/third-party read across consistency, creative, engagement, and trust |
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
