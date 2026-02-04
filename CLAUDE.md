# CLAUDE.md - Provocations Project Guide

## Project Overview

**Provocations** is an AI-augmented document workspace where users iteratively shape ideas into polished documents through voice, text, and thought-provoking AI interactions.

Think of it as a **smarter Google Docs** — the document is the output, and the AI helps you create and refine it through:
- **Multiple perspectives** (lenses) that challenge your thinking
- **Provocations** that push you to address gaps, fallacies, and alternatives
- **Voice input** for natural ideation and feedback
- **Iterative shaping** where each interaction evolves the document

**Core Philosophy**: "Would you rather have a tool that thinks for you, or a tool that makes you think?"

The AI doesn't write for you — it provokes deeper thinking so *you* write better.

## Quick Commands

```bash
npm run dev      # Start development server (Express + Vite HMR on port 5000)
npm run build    # Build for production (outputs to dist/)
npm run start    # Run production build
npm run check    # TypeScript type checking
npm run db:push  # Push Drizzle schema to database
```

## Tech Stack

| Layer | Technologies |
|-------|-------------|
| **Frontend** | React 18, TypeScript, Vite 7, Tailwind CSS 3.4, shadcn/ui |
| **Backend** | Express 5.0, OpenAI GPT-5.2 |
| **Database** | PostgreSQL via Drizzle ORM (documents are in-memory only) |
| **Validation** | Zod schemas shared between frontend/backend |
| **State** | React Query (TanStack), React hooks |
| **Routing** | Wouter (lightweight) |

## Directory Structure

```
provocations/
├── client/src/              # React frontend
│   ├── pages/
│   │   └── Workspace.tsx    # Main app interface (primary orchestrator)
│   ├── components/
│   │   ├── ui/              # 47 shadcn/ui components
│   │   ├── TextInputForm.tsx
│   │   ├── LensesPanel.tsx
│   │   ├── ProvocationsDisplay.tsx
│   │   ├── OutlineBuilder.tsx
│   │   ├── ReadingPane.tsx
│   │   ├── DimensionsToolbar.tsx
│   │   ├── DiffView.tsx
│   │   ├── VoiceRecorder.tsx
│   │   └── TranscriptOverlay.tsx
│   ├── hooks/               # Custom React hooks
│   ├── lib/
│   │   ├── queryClient.ts   # React Query config
│   │   └── utils.ts         # Tailwind merge utilities
│   ├── App.tsx              # Router setup
│   └── main.tsx             # Entry point
├── server/
│   ├── index.ts             # Express app setup
│   ├── routes.ts            # Core API endpoints
│   └── storage.ts           # In-memory document storage
├── shared/
│   ├── schema.ts            # Zod schemas & types
│   └── models/chat.ts       # Drizzle ORM models
└── script/build.ts          # Build configuration
```

## Path Aliases

Configured in `tsconfig.json`:
- `@/*` → `./client/src/*`
- `@shared/*` → `./shared/*`

## Core Workflow

### The Iterative Loop

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│   START WITH IDEAS ──► AI ANALYZES ──► PROVOCATIONS        │
│         ▲                                    │              │
│         │                                    ▼              │
│    DOCUMENT EVOLVES ◄── USER RESPONDS (voice/text)         │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

1. **Input** — Start with rough ideas, notes, or existing material
2. **Analyze** — AI generates lenses (perspectives) and provocations (challenges)
3. **Respond** — Use voice or text to address provocations
4. **Merge** — AI intelligently weaves your responses into the document
5. **Iterate** — Repeat until the document fully captures your thinking

### Key Insight

The document is not static input to be critiqued — it's a **living artifact** that grows through dialogue between you and the AI. Each provocation is an invitation to think deeper; each response shapes the final output.

## API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/analyze` | POST | Generate lenses & provocations from current document |
| `/api/expand` | POST | AI-expand outline headings into paragraphs |
| `/api/refine` | POST | Adjust tone & length of text |
| `/api/merge` | POST | Integrate voice/text feedback into document |
| `/api/edit-text` | POST | Edit selected text with instructions |

### Request Schemas

All schemas defined in `shared/schema.ts` with Zod validation.

```typescript
// Analyze - generate perspectives and challenges
{ text: string, selectedLenses?: LensType[] }

// Expand - develop outline into content
{ heading: string, context?: string, tone?: ToneOption }

// Refine - adjust style
{ text: string, tone: ToneOption, targetLength: "shorter" | "same" | "longer" }

// Merge - integrate feedback (supports voice context)
{ originalText: string, userFeedback: string, provocationContext?: string, selectedText?: string, activeLens?: LensType }

// Edit - modify selection
{ instruction: string, selectedText: string, fullDocument: string }
```

## Domain Concepts

### Lenses (6 Perspectives)
Different viewpoints to examine your document:
- `consumer` — End-user/customer viewpoint
- `executive` — Strategic leadership view
- `technical` — Implementation constraints
- `financial` — Cost/ROI analysis
- `strategic` — Competitive positioning
- `skeptic` — Critical assumptions challenge

### Provocations (3 Categories)
Challenges that push your thinking:
- `opportunity` — Growth/innovation gaps you might be missing
- `fallacy` — Logical errors, weak arguments, unsupported claims
- `alternative` — Different approaches or perspectives to consider

### Tone Options
Voice for the final document:
- `inspirational`, `practical`, `analytical`, `persuasive`, `cautious`

## Key Components

### Workspace.tsx (Orchestrator)
Central hub managing:
- **Phases**: `input` → `blank-document` → `workspace`
- **State**: document, lenses, provocations, outline, versions
- **Versioning**: Full history with diff comparison

### ReadingPane.tsx
The document canvas:
- Editable mode (pencil toggle)
- Text selection → voice/edit actions
- Download functionality

### ProvocationsDisplay.tsx
Challenge cards that drive iteration:
- Voice recording on each card
- Status: pending, addressed, rejected, highlighted
- Context passed to merge for intelligent integration

### VoiceRecorder.tsx
Natural input via speech:
- Web Speech API transcription
- Auto-merge into document
- Works on provocations and text selections

## Design Principles

1. **Document-Centric** — The document is the product, not a chat log
2. **Productive Resistance** — AI challenges, doesn't just assist
3. **User as Author** — You write; AI provokes better writing
4. **Voice-First Feedback** — Speaking is faster than typing for ideation
5. **Iterative Shaping** — Documents evolve through multiple passes

## Design System

### Theme
- **Primary**: Warm amber (#B35C1E)
- **Accent**: Thoughtful blue (200°, 60%, 45%)
- **Aesthetic**: Aged paper/ink, intellectual warmth
- **Mode**: Dark mode supported

### Fonts
- **Body**: Source Serif 4
- **Headings**: Libre Baskerville
- **Code**: JetBrains Mono

## Environment Variables

| Variable | Description |
|----------|-------------|
| `AI_INTEGRATIONS_OPENAI_API_KEY` | OpenAI API key |
| `AI_INTEGRATIONS_OPENAI_BASE_URL` | OpenAI API base URL |
| `DATABASE_URL` | PostgreSQL connection string |

## Development Notes

### Adding API Routes
1. Define Zod schema in `shared/schema.ts`
2. Add endpoint in `server/routes.ts`
3. Use `safeParse()` for validation

### State Management
- Local state in Workspace.tsx for app-wide concerns
- React Query for server state caching
- No Redux/Zustand — keep it simple

### Error Handling
- Zod validation on all API inputs
- Defensive null-checks in components
- Toast notifications for user feedback

## Not Yet Implemented

- Testing framework (Jest/Vitest)
- CI/CD pipeline
- Structured logging
- Document persistence to database
- Starting from blank (currently requires input text)
