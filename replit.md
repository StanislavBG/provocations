# Provocations — AI-Augmented Document Workspace

## Overview

Provocations is an AI-augmented document workspace where users iteratively shape ideas into polished documents through voice, text, and thought-provoking AI interactions. The AI doesn't write for you — it provokes deeper thinking so *you* write better.

Core philosophy: "Would you rather have a tool that thinks for you, or a tool that makes you think?"

## Build & Deploy

```bash
npm run dev      # Development server (Express + Vite HMR on port 5000)
npm run build    # Production build (outputs to dist/)
npm run start    # Run production build
npm run check    # TypeScript type checking
npm run db:push  # Push Drizzle schema to database
```

**Deployment**: Autoscale target. Build runs `npm run build`, deploy runs `node ./dist/index.cjs`. Port 5000 internally, mapped to port 80 externally.

## Architecture

### Frontend (React 18 + Vite 7 + TypeScript 5.6)
- **Workspace.tsx**: Main orchestrator — manages phases, document state, versions, personas
- **TextInputForm**: Landing page with template selection and context input
- **ReadingPane**: Editable document canvas with markdown rendering, voice feedback, text selection editing
- **ProvocationToolbox**: Left panel — mode selector (challenge/advise/interview), analyzer, context
- **ProvocationsDisplay**: Challenge cards from expert personas with voice response
- **InterviewPanel**: Multi-turn interview Q&A flow
- **ProvokeText**: Universal text component (ADR: all text panels must use this)
- **QueryAnalyzerView / QueryDiscoveriesPanel**: SQL query analysis UI
- **StreamingWorkspace**: Requirement discovery through screenshots and dialogue
- **VoiceCaptureWorkspace**: Voice-first ideation workspace
- **AppSidebar**: Persistent left nav for switching between applications

### Backend (Express 5.0)
- **LLM**: Configurable provider — OpenAI GPT-4o (default) / Google Gemini 2.0 Flash / Anthropic Claude. Set via `LLM_PROVIDER` env var or auto-detected from available API keys.
- **Database**: PostgreSQL via Drizzle ORM with zero-knowledge AES-256-GCM encryption at rest
- **Auth**: Clerk (authentication & user ownership)

### Key API Endpoints
- `POST /api/generate-challenges` — Persona-driven challenges
- `POST /api/generate-advice` — Advice for a specific challenge
- `POST /api/write` — Unified document editor (edit, expand, refine)
- `POST /api/write/stream` — Streaming write (SSE)
- `POST /api/query-write` — SQL-specific editor
- `POST /api/analyze-query` — Deep SQL analysis with QA validation
- `POST /api/extract-metrics` — Business metric extraction from SQL
- `POST /api/interview/question` — Generate interview questions
- `POST /api/interview/summary` — Synthesize interview into instructions
- `POST /api/discussion/ask` — Multi-persona discussion
- `POST /api/summarize-intent` — Clean voice transcripts
- `POST /api/documents` — CRUD for encrypted documents
- `POST /api/screenshot` — Server-side screenshot via Playwright

### Applications (Templates)
Each application is defined across three layers (schema → UI → LLM guidance):
- **Write a Prompt** — AIM framework prompt writing
- **Query Editor** — SQL analysis and optimization
- **Product Requirement** — Incremental feature PRDs
- **New Application** — Full SaaS spec from scratch
- **Screen Capture** — Screenshots to requirements
- **Research Paper** — Academic/exploratory writing
- **Persona / Agent** — Character and AI agent profiles
- **Research / Context** — Context library building
- **Voice Capture** — Speak ideas, structure later
- **YouTube to Infographic** — Video content to visual specs
- **Text to Infographic** — Text descriptions to visuals
- **Email Composer** — Business professional emails

## Environment Variables

| Variable | Purpose |
|----------|---------|
| `AI_INTEGRATIONS_OPENAI_API_KEY` | OpenAI API key (auto-injected by Replit AI Integrations) |
| `AI_INTEGRATIONS_OPENAI_BASE_URL` | Replit proxy base URL (auto-injected) |
| `ANTHROPIC_API_KEY` | Anthropic API key (or `ANTHROPIC_KEY`) |
| `GEMINI_API_KEY` | Google Gemini API key |
| `LLM_PROVIDER` | Force provider: `openai`, `gemini`, or `anthropic` (auto-detects by default) |
| `DATABASE_URL` | PostgreSQL connection string |
| `ENCRYPTION_SECRET` | AES-GCM key for document encryption |
| `CLERK_PUBLISHABLE_KEY` | Clerk frontend auth |
| `CLERK_SECRET_KEY` | Clerk backend secret |
| `PLAYWRIGHT_CHROMIUM_PATH` | Path to Chromium for screenshots |

## Design System
- **Primary**: Warm amber (#B35C1E)
- **Accent**: Thoughtful blue
- **Fonts**: Source Serif 4 (body), Libre Baskerville (headings), JetBrains Mono (code)
- **Mode**: Dark mode supported

## Key Design Principles
1. **No Chat Box**: Interface avoids chat-centric design
2. **Productive Resistance**: Tool provokes thinking, not just answers
3. **Material Engagement**: User remains primary author

## Tech Stack
- Frontend: React 18, Vite 7, TypeScript 5.6, Tailwind CSS 3.4, shadcn/ui, TanStack Query
- Backend: Express 5.0, configurable LLM (OpenAI / Gemini / Anthropic)
- Database: PostgreSQL, Drizzle ORM, AES-256-GCM encryption
- Auth: Clerk
- Routing: Wouter
- Voice: Web Speech API + custom audio worklets

## Recent Changes
- February 21, 2026: Added Email Composer application — single-step business email composition with audience-adaptive tone and 'email' output format
- February 21, 2026: Added persistent app sidebar with global layout for switching between applications
- February 21, 2026: Enhanced query analyzer with dynamic categories, engine selector, and feedback iteration
- February 16, 2026: Switched LLM provider to Google Gemini (gemini-2.0-flash) with configurable provider abstraction
- February 15, 2026: Migrated all LLM calls to Anthropic Claude
- February 1, 2026: Added text-based editing via pencil icon — select text, type instruction to modify
- January 31, 2026: Added voice-driven document enhancement (transcript overlay, text selection voice merge, version history with diff view)
- January 30, 2026: Added editable document view with pencil/check toggle and download
- January 29, 2026: Initial MVP implementation
