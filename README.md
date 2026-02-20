# Conscious Compass

**Brand Consciousness Assessment Framework v2.12** by Antenna Group

A comprehensive React-based tool for evaluating brands across eight consciousness attributes using AI-powered analysis.

![Version](https://img.shields.io/badge/version-2.12.7-blue)
![Rubric](https://img.shields.io/badge/rubric-v2.4-green)

---

## Features

### 🎯 8 Brand Consciousness Attributes

| Attribute | Focus Area |
|-----------|------------|
| **AWAKE** | Influence & Narrative Leadership |
| **AWARE** | Trust Building & Audience Understanding |
| **REFLECTIVE** | Authenticity & Reputation Management |
| **ATTENTIVE** | Experience Quality & Excellence |
| **COGENT** | Strategic Intelligence & Data-Driven Marketing |
| **SENTIENT** | Creative Differentiation & Emotional Connection |
| **VISIONARY** | Future Vision & Audience Benefit |
| **INTENTIONAL** | Credibility & Organizational Confidence |

### 📊 Assessment Workflow

1. **Brand Setup** — Name, website, business model, industry
2. **Website Assessment** — Screenshots, content analysis, technical audit, SEO visibility
3. **Social Media Assessment** — LinkedIn, X, Instagram, YouTube, Reddit, Wikipedia + reputation signals
4. **AI Reputation** — How Claude, Gemini, and ChatGPT perceive the brand
5. **Earned Media** — Press coverage analysis from past 3 months
6. **Report Generation** — Comprehensive scoring with recommendations

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

## Deployment to Vercel (Secure API Key)

The API key is stored **server-side only** using a Vercel serverless function. This is the secure approach - the key is never exposed to the browser.

### Step-by-Step:

1. **Push to GitHub** (the `/api/claude.js` serverless function is already included)

2. **Import project in [Vercel](https://vercel.com)**

3. **Add Environment Variable:**
   - Go to: **Settings** → **Environment Variables**
   - Add:
     | Name | Value |
     |------|-------|
     | `ANTHROPIC_API_KEY` | `sk-ant-api03-your-key-here` |
   
   ⚠️ **Important:** Use `ANTHROPIC_API_KEY` (without `VITE_` prefix) - this keeps it secure on the server

4. **Deploy** - Vercel will automatically detect the `/api/claude.js` serverless function

5. **Done!** Users won't need to enter an API key - it's handled securely on the server

### How It Works

```
Browser → /api/claude (Vercel serverless) → Anthropic API
                ↑
         API key stored here (server-side only)
```

The frontend calls `/api/claude` which proxies requests to Anthropic. The API key never reaches the browser.

---

## Local Development (Optional)

For local development, you have two options:

### Option A: Use the API Key Input (Default)
Just enter your API key in the app's setup page.

### Option B: Environment Variable
Create a `.env` file:
```
VITE_ANTHROPIC_API_KEY=sk-ant-api03-your-key-here
```
Note: `VITE_` prefix is OK for localhost but **never use it in production**.

---

## Assessment Details

### Website Assessment

- **Screenshots** — Upload up to 4 screenshots of key pages
- **Pages Reviewed** — List which pages were analyzed
- **Website Content** — Paste key messaging and content
- **Technical Audit** — Manual entry of PageSpeed scores (Performance, Accessibility, Best Practices, SEO)
- **SEO Visibility** — AI-powered assessment of search visibility

### Social Media Assessment

| Platform | Data Captured |
|----------|---------------|
| **LinkedIn** | Company profile, About section, recent posts with engagement |
| **X (Twitter)** | Bio, content, engagement patterns |
| **Instagram** | Bio, content themes, visual consistency |
| **YouTube** | Channel existence, content types, activity level |
| **Wikipedia** | Page existence, accuracy, sentiment, accomplishments |
| **Reddit** | Subreddit presence, sentiment, notable discussions |
| **Reddit Answers** | AI search visibility for brand reputation |
| **Glassdoor** | Employer ratings, culture themes (→ Reflective score) |
| **Nextdoor** | Community presence (→ Aware score) |
| **WIPO** | Trademark registrations (→ Intentional score) |

---

## Scoring Methodology

### Weighted Scoring (v2.11+)

**ATTENTIVE Score:**
- 70% qualitative assessment
- 30% technical metrics (PageSpeed)

**COGENT Score:**
- 80% qualitative assessment
- 20% technical SEO score

### Maturity Stages

| Score | Stage | Description |
|-------|-------|-------------|
| 0-39 | Dormant | Foundational development needed |
| 40-54 | Emerging | Building basic consciousness |
| 55-64 | Developing | Solid fundamentals established |
| 65-74 | Established | Strong market presence |
| 75-84 | Leading | Industry thought leader |
| 85-100 | Transcendent | Exceptional consciousness |

---

## Tech Stack

- **Frontend:** React 19, Vite
- **Styling:** Tailwind CSS
- **Icons:** Lucide React
- **Charts:** Custom SVG spider chart
- **Export:** jsPDF, docx
- **Backend:** Supabase (PostgreSQL, Auth)
- **AI:** Anthropic Claude API (via serverless proxy)

---

## Project Structure

```
conscious-compass/
├── api/
│   └── claude.js        # Vercel serverless function (secure API proxy)
├── src/
│   ├── App.jsx          # Main application
│   ├── lib/
│   │   ├── api.js       # AI API clients
│   │   └── supabase.js  # Database functions
│   ├── index.css        # Tailwind styles
│   └── main.jsx         # Entry point
├── .env.example         # Environment template
├── .gitignore
├── package.json
└── README.md
```

---

## Version History

| Version | Key Changes |
|---------|-------------|
| 2.12.7 | Secure serverless API proxy (no VITE_ prefix needed) |
| 2.12.x | Environment variable API key, improved verify links, Reddit Answers |
| 2.11.x | Weighted scoring, Phase 1-3 UI improvements, manual tech audit |
| 2.10.x | Evidence-based scoring with citations, technical audit integration |
| 2.9.x | Supabase backend, assessor tracking, insights view |

---

## License

© 2025-2026 Antenna Group. All rights reserved.
