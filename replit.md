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

### Applications (12 Templates)
Each application is defined across three code layers (schema → UI → LLM guidance) plus a documentation layer (`apps/<templateId>/CLAUDE.md`):

| App | Category | Layout |
|-----|----------|--------|
| Write a Prompt | write | standard |
| Product Requirement | build | standard |
| New Application | build | standard |
| Screen Capture | analyze | standard |
| Research Paper | write | standard |
| Persona / Agent | write | standard |
| Research / Context | capture | standard |
| Voice Capture | capture | voice-capture (unique) |
| YouTube to Infographic | capture | standard |
| Text to Infographic | capture | infographic-studio (unique) |
| Email Composer | write | standard |
| Agent Editor | build | standard |

Per-app documentation lives in `apps/<templateId>/CLAUDE.md` — synced to the document store via `POST /api/admin/sync-app-docs`.

## Database Schema Management

The database schema is managed by **two systems that must stay in sync**:

1. **Drizzle schema** (`shared/models/chat.ts`) — The authoritative schema. Replit auto-runs `drizzle-kit push` during Deploy, which compares this schema to the database and generates DDL to sync them.
2. **`ensureTables()`** (`server/db.ts`) — Safety-net raw SQL that runs on app startup. Creates tables/columns/indexes so the app works even without `drizzle-kit push`.

**Deploy flow on Replit:**
1. Build (`npm run build`)
2. Replit runs `drizzle-kit push` (compares Drizzle schema ↔ database) ← migration dialog shows here
3. App starts (`node ./dist/index.cjs`) → `ensureTables()` runs

**If migration items appear in the deploy dialog**, it means the database doesn't match the Drizzle schema. To resolve:
- Run `npm run dev` briefly before deploying — this triggers `ensureTables()` which syncs the database
- Then Deploy — `drizzle-kit push` should find zero differences

**Common causes of recurring migration items:**
- `ensureTables()` creates an index with `DESC` but Drizzle schema uses default `ASC`
- `ensureTables()` inline `UNIQUE` creates constraints named `{table}_{column}_key`, but Drizzle expects `{table}_{column}_unique`
- `ensureTables()` has `REFERENCES` (FK constraints) that the Drizzle schema doesn't define
- A new table/column was added to the Drizzle schema but not to `ensureTables()`, or vice versa

See `CLAUDE.md` → "ADR: Dual Schema Management" for the full rules.

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
| `STRIPE_SECRET_KEY_PROD` | Stripe secret key for payment processing |
| `STRIPE_PUBLISHABLE_KEY_PROD` | Stripe publishable key (not currently used client-side) |
| `STRIPE_BUY_COFFEE_PRICE_ID` | Stripe Price ID for the "Buy a Coffee" product |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret (starts with `whsec_`) |

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
- March 1, 2026: Fixed recurring Drizzle migration items on deploy — aligned ensureTables() with Drizzle schema (DESC mismatch, FK refs, constraint naming). Added ADR for dual schema management.
- February 24, 2026: GPT-to-Context chat endpoints now always use Gemini 2.5 Flash via GEMINI_API_KEY, independent of global LLM_PROVIDER
- February 24, 2026: Added Stripe payment integration — webhook endpoint (`/api/stripe/webhook`), checkout session creation, pricing page (`/pricing`), payments DB table
- February 22, 2026: Added per-app CLAUDE.md documentation graph — 12 isolated app guides in `apps/<templateId>/CLAUDE.md` with admin sync endpoint to document store
- February 21, 2026: Added Email Composer application — single-step business email composition with audience-adaptive tone and 'email' output format
- February 21, 2026: Added persistent app sidebar with global layout for switching between applications
- February 21, 2026: Enhanced query analyzer with dynamic categories, engine selector, and feedback iteration
- February 16, 2026: Switched LLM provider to Google Gemini (gemini-2.0-flash) with configurable provider abstraction
- February 15, 2026: Migrated all LLM calls to Anthropic Claude
- February 1, 2026: Added text-based editing via pencil icon — select text, type instruction to modify
- January 31, 2026: Added voice-driven document enhancement (transcript overlay, text selection voice merge, version history with diff view)
- January 30, 2026: Added editable document view with pencil/check toggle and download
- January 29, 2026: Initial MVP implementation
