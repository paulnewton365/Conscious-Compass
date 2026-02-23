# Conscious Compass

**Brand Consciousness Assessment Framework v2.12.43** by Antenna Group

A comprehensive React-based tool for evaluating brands across eight consciousness attributes using AI-powered analysis of publicly available information.

![Version](https://img.shields.io/badge/version-2.12.43-blue)
![Rubric](https://img.shields.io/badge/rubric-v2.6-green)
![Status](https://img.shields.io/badge/status-beta-orange)

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

Each attribute is scored 0-100 based on observable evidence, with specific signals for strong (70-100), moderate (40-69), and weak (0-39) performance.

---

## Features

### 📊 6-Step Assessment Workflow

1. **Brand Setup** — Name, website, business model, industry
2. **Website Assessment** — Screenshots, auto-assess, SEO visibility, technical audit, recognition & credentials
3. **Social Media Assessment** — 7 platform sections including influencer partnerships and paid media presence
4. **AI Reputation** — How Claude, Gemini, and ChatGPT perceive the brand
5. **Earned Media** — Press coverage, podcasts, keynotes, awards from past 3 months
6. **Report Generation** — Scoring, spider chart, recommendations with benefits

### 🔍 Compass Results Dashboard

- **Search** — Filter by brand name
- **Quick Filters** — Industry, maturity level, business model
- **CSV Export** — Download all results
- **Manual Entry** — Add scores for brands assessed outside the tool

### 📤 Export Options

- **PDF** — Professional report with spider chart
- **DOCX** — Editable Word document
- **Copy Text** — Clipboard-friendly format

### 👥 User Management

- **Authentication** — Supabase-powered signup/login
- **Approval Workflow** — Admin approves new users
- **Admin Panel** — Manage users, view pending approvals
- **Assessor Attribution** — Track who assessed each brand

---

## Assessment Inputs

### Website Assessment

| Input | Purpose | Attribute Impact |
|-------|---------|------------------|
| Auto-Assess | AI analysis of website screenshots | All |
| SEO Visibility | Search discoverability analysis | COGENT |
| Technical Audit | PageSpeed scores (manual entry) | ATTENTIVE, COGENT |
| Recognition & Credentials | Awards, certifications, speaking | AWAKE, INTENTIONAL |
| Screenshots | Up to 4 key pages | All |

### Social Media Assessment

| Section | Data Captured | Attribute Impact |
|---------|---------------|------------------|
| **LinkedIn** | Profile, posts, engagement, employee advocacy, awards | AWAKE, AWARE, REFLECTIVE |
| **X (Twitter)** | Bio, content, voice, engagement | AWARE, SENTIENT |
| **Instagram** | Visual brand, content themes | SENTIENT, ATTENTIVE |
| **Other Platforms** | YouTube, Reddit, Wikipedia | AWAKE, COGENT |
| **Influencer Partnerships** | #ad content, ambassadors, creator collabs | AWARE, SENTIENT |
| **Paid Media** | Meta/Google/LinkedIn/TikTok ad libraries | COGENT, INTENTIONAL |
| **Reputation Signals** | Glassdoor, Nextdoor, WIPO trademark | REFLECTIVE, AWARE, INTENTIONAL |

### AI Reputation Assessment

| AI Platform | How to Test |
|-------------|-------------|
| Claude | "What do you know about [Brand]?" |
| Gemini | "What do you know about [Brand]?" |
| ChatGPT | "What do you know about [Brand]?" |

### Earned Media Assessment

Include coverage from the last 3 months:
- News articles and press mentions
- Podcast appearances
- Conference keynotes
- Industry awards and rankings
- Analyst reports

---

## Scoring Methodology

### Framework v2.6

Each attribute score directly answers its fundamental question using observable signals:

- **Strong signals (70-100)**: Third-party validation, industry leadership evidence
- **Moderate signals (40-69)**: Active participation, emerging presence
- **Weak signals (0-39)**: Minimal evidence, participation without validation

### Weighted Scoring

| Attribute | Qualitative | Technical |
|-----------|-------------|-----------|
| ATTENTIVE | 70% | 30% (PageSpeed) |
| COGENT | 80% | 20% (Technical SEO) |
| Others | 100% | — |

### Maturity Stages

| Score | Stage | Description |
|-------|-------|-------------|
| 0-39 | Unconscious | Foundational development needed |
| 40-54 | Emerging | Building basic consciousness |
| 55-69 | Developing | Solid fundamentals established |
| 70-84 | Conscious | Strong market presence |
| 85-100 | Transcendent | Exceptional consciousness |

---

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Run Development Server

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

---

## Deployment to Vercel

The API key is stored **server-side only** using a Vercel serverless function.

### Steps:

1. **Push to GitHub**

2. **Import project in [Vercel](https://vercel.com)**

3. **Add Environment Variables:**

   | Name | Value | Notes |
   |------|-------|-------|
   | `ANTHROPIC_API_KEY` | `sk-ant-api03-...` | Required for AI analysis |
   | `VITE_SUPABASE_URL` | Your Supabase URL | Required for auth/data |
   | `VITE_SUPABASE_ANON_KEY` | Your Supabase anon key | Required for auth/data |

4. **Deploy**

### How It Works

```
Browser → /api/claude (Vercel serverless) → Anthropic API
                ↑
         API key stored here (never exposed to browser)
```

---

## Database Setup (Supabase)

### Required Tables

```sql
-- Profiles (extends Supabase auth.users)
CREATE TABLE profiles (
  id UUID REFERENCES auth.users PRIMARY KEY,
  email TEXT,
  full_name TEXT,
  is_approved BOOLEAN DEFAULT false,
  is_admin BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Saved Assessments
CREATE TABLE saved_assessments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users,
  brand_name TEXT,
  data JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Compass Results
CREATE TABLE compass_results (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  brand_name TEXT,
  business_model TEXT,
  industry TEXT,
  total_score INTEGER,
  maturity_level TEXT,
  scores JSONB,
  assessor_name TEXT,
  rubric_version TEXT,
  is_manual BOOLEAN DEFAULT false,
  saved_at TIMESTAMPTZ DEFAULT now()
);
```

### Row Level Security

Enable RLS on all tables and create appropriate policies for user access.

---

## Project Structure

```
conscious-compass/
├── api/
│   └── claude.js           # Vercel serverless API proxy
├── src/
│   ├── App.jsx             # Main application (7000+ lines)
│   ├── data/
│   │   ├── rubric.js       # Framework v2.6 definitions
│   │   └── serviceMapping.js
│   ├── lib/
│   │   └── supabase.js     # Database functions
│   ├── index.css           # Tailwind styles
│   └── main.jsx            # Entry point
├── BETA_TESTER_GUIDE.md    # Guide for beta testers
├── BETA_LAUNCH_CHECKLIST.md
├── package.json
└── README.md
```

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19, Vite |
| Styling | Tailwind CSS |
| Icons | Lucide React |
| Charts | Custom SVG spider chart |
| PDF Export | jsPDF, html2canvas |
| DOCX Export | docx, file-saver |
| Backend | Supabase (PostgreSQL, Auth, RLS) |
| AI | Anthropic Claude API (via serverless proxy) |
| Hosting | Vercel |

---

## Version History

| Version | Key Changes |
|---------|-------------|
| **2.12.43** | Compass Results search and filters |
| **2.12.42** | Production cleanup, error boundary, removed debug logs |
| **2.12.41** | Recommendation benefits displayed prominently |
| **2.12.40** | Influencer & Paid Media recommendations added to rubric |
| **2.12.39** | Influencer partnerships & paid media presence tracking |
| **2.12.38** | Recognition & credentials, employee advocacy, awards inputs |
| **2.12.37** | Framework v2.5→v2.6: Signal-based scoring, fundamental questions |
| **2.12.35** | Spider chart animation timing (3s sync with score counter) |
| **2.12.34** | Home page entrance animation |
| **2.12.32** | Evidence-based output enforcement, no em-dashes |
| **2.12.31** | Copy Report Text feature |
| **2.12.30** | Assessment Readouts section in report |
| **2.12.28** | React hooks ordering fix (blank screen bug) |
| **2.12.22** | Auto-Assess for Website and Earned Media |
| **2.12.20** | Maturity continuum animation |
| **2.12.0** | Phase 2-3 UI (accordions, compact layout) |
| **2.11.x** | Weighted scoring, manual tech audit |
| **2.10.x** | Evidence-based scoring with citations |
| **2.9.x** | Supabase backend, assessor tracking |

---

## Beta Testing

See `BETA_TESTER_GUIDE.md` for instructions on running assessments.

See `BETA_LAUNCH_CHECKLIST.md` for admin setup and user approval workflow.

---

## Support

For issues or feedback:
- Use the thumbs down button on any Claude conversation
- Email directly to the project maintainer

---

## License

© 2025-2026 Antenna Group. All rights reserved.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              USER (Browser)                                  │
│                         React SPA • Assessment UI                            │
└─────────────────────────────────────────────────────────────────────────────┘
                                      ↕
┌─────────────────────────────────────────────────────────────────────────────┐
│                            VERCEL PLATFORM                                   │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  FRONTEND (React + Vite)                                             │   │
│  │  • App.jsx (7000+ lines)     • rubric.js (Framework v2.6)           │   │
│  │  • Tailwind CSS              • serviceMapping.js (31 services)       │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  SERVERLESS FUNCTION                                                 │   │
│  │  /api/claude.js → Proxies to Anthropic (API key server-side only)   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
                                      ↕
┌─────────────────────────────────────────────────────────────────────────────┐
│                          EXTERNAL SERVICES                                   │
│  ┌───────────────────┐  ┌───────────────────┐  ┌───────────────────┐       │
│  │  Anthropic Claude │  │  Supabase Auth    │  │  Supabase DB      │       │
│  │  claude-sonnet-4  │  │  Login/Signup     │  │  PostgreSQL + RLS │       │
│  │  AI Analysis      │  │  Sessions         │  │  Assessments      │       │
│  └───────────────────┘  └───────────────────┘  └───────────────────┘       │
└─────────────────────────────────────────────────────────────────────────────┘
                                      ⋮
┌─────────────────────────────────────────────────────────────────────────────┐
│                      MANUAL DATA SOURCES (User visits & pastes)              │
│  Ad Libraries: Meta, Google, LinkedIn, TikTok                                │
│  AI Platforms: Claude, Gemini, ChatGPT                                       │
│  Reputation: Glassdoor, WIPO, Wikipedia, Reddit                              │
│  Technical: Google PageSpeed Insights                                        │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Data Flow

```
1. INPUT        → User enters brand data, uploads screenshots
2. AUTO-ASSESS  → AI analyzes website content and earned media
3. SCORE        → Claude evaluates 8 attributes using signal-based framework
4. RECOMMEND    → Low scores map to service recommendations
5. REPORT       → Generate PDF/DOCX/text exports
6. SAVE         → Store assessment and results in Supabase
```

### Security Model

```
Browser ──→ /api/claude ──→ Anthropic API
                ↑
         ANTHROPIC_API_KEY
         (server-side only,
          never exposed to browser)
```

For a visual diagram, see `ARCHITECTURE.html` in the project root.
