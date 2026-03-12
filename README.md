# Conscious Compass

**Brand Consciousness Assessment Framework v2.14** by Antenna Group

A React-based tool for evaluating brands across eight consciousness attributes using AI-powered analysis.

![Version](https://img.shields.io/badge/version-2.14-blue)
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

- **Compass Results** — Sortable, filterable dashboard of all assessments with CSV export
- **Compare** — Side-by-side brand comparison, industry benchmarks, and AI-powered portfolio insights
- **Stay Conscious** — Live AI intelligence feed with web search on brand, AI, and communications trends
- **Read-Only Access** — Share results with clients without edit permissions
- **Saved Assessments** — Resume in-progress work at any time
- **Signal Conflicts** — Automated diagnostic layer flagging attribute tensions (e.g. high AWAKE + low INTENTIONAL)

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

The Anthropic API key is stored server-side only via a Vercel serverless function — never exposed to the browser.

### Steps

1. Push to GitHub
2. Import in [Vercel](https://vercel.com)
3. Add environment variables:

| Name | Notes |
|------|-------|
| `ANTHROPIC_API_KEY` | Required — AI analysis |
| `VITE_SUPABASE_URL` | Required — auth and data |
| `VITE_SUPABASE_ANON_KEY` | Required — auth and data |

4. Deploy

```
Browser → /api/claude (Vercel serverless) → Anthropic API
                ↑
         API key lives here only
```

---

## Database (Supabase)

Schema is in `supabase-schema.sql`. Three tables: `profiles`, `saved_assessments`, `compass_results`. Enable RLS on all three.

---

## Project Structure

```
conscious-compass/
├── api/
│   ├── claude.js           # Anthropic API proxy (serverless)
│   ├── knowledge-graph.js  # Google Knowledge Graph lookup
│   ├── pagespeed.js        # PageSpeed Insights proxy
│   └── youtube.js          # YouTube Data API proxy
├── src/
│   ├── App.jsx             # Main application
│   ├── data/
│   │   ├── rubric.js       # Framework v2.8 — 8 attributes, signals, maturity stages
│   │   └── serviceMapping.js  # 31 service recommendations mapped to attributes
│   ├── lib/
│   │   ├── api.js          # API helper utilities
│   │   └── supabase.js     # Supabase client and auth functions
│   ├── index.css           # Global styles
│   └── main.jsx            # Entry point
├── public/
│   └── fully-conscious-badge.png
├── supabase-schema.sql
├── package.json
├── vercel.json
└── vite.config.js
```

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19, Vite |
| Styling | Tailwind CSS |
| Icons | Lucide React |
| Charts | Custom SVG spider chart |
| PDF Export | jsPDF |
| DOCX Export | docx, file-saver |
| Backend | Supabase (PostgreSQL, Auth, RLS) |
| AI | Anthropic Claude (claude-sonnet-4-6) via serverless proxy |
| Hosting | Vercel |

---

## Version History

| Version | Key Changes |
|---------|-------------|
| **2.14** | AI reputation expanded to 5 engines + reputation flags + Wikipedia/Reddit as AI training signals; report generation speed improvements; read-only user role |
| **2.13** | Mini spider charts in results; comparison spider chart; Stay Conscious intelligence feed; Signal Conflicts diagnostic layer |
| **2.12** | Compass Results search and filters; production cleanup; recommendation benefits |
| **2.11** | Weighted scoring; manual tech audit inputs |
| **2.10** | Evidence-based scoring with citations |
| **2.9** | Supabase backend; assessor tracking |

---

© 2025–2026 Antenna Group. All rights reserved.
