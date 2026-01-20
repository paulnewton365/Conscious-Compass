# Conscious Compass

**Brand Consciousness Assessment Framework v2.3** by Antenna Group

A comprehensive webapp that automates the generation of brand assessments across four dimensions (Website, Social Media, AI Reputation, Earned Media), scores them against the 8-attribute rubric, and generates a professional DOCX report.

## Features

- **Guided Assessment Generation**: Step-by-step prompts generate comprehensive assessments
- **Multi-Engine AI Queries**: Query Claude, Gemini, and ChatGPT for reputation analysis
- **Automated Scoring**: AI analyzes assessments against 46 weighted questions across 8 attributes
- **DOCX Report Generation**: Download professional reports with scores and recommendations
- **Persistent State**: Progress saved in browser storage

## Quick Start

```bash
npm install
npm run dev
```

## Deployment to Vercel

```bash
npm i -g vercel
vercel
```

## API Keys Required

- **Anthropic API Key** (required) - Powers all assessments and scoring
- **OpenAI API Key** (optional) - For automated ChatGPT reputation queries
- **Google Gemini API Key** (optional) - For automated Gemini reputation queries

## Tech Stack

React 19 + Vite, Tailwind CSS, Zustand, Lucide React, docx
