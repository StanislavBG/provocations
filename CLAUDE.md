# CLAUDE.md - Provocations Project Guide

## Project Overview

**Provocations** is an AI-augmented document workspace where users iteratively shape ideas into polished documents through voice, text, and thought-provoking AI interactions.

Think of it as a **smarter Google Docs** — the document is the output, and the AI helps you create and refine it through:
- **Multiple personas** (8 expert perspectives) that challenge your thinking
- **Provocations** that push you to address gaps, assumptions, and alternatives
- **Voice input** for natural ideation and feedback
- **Iterative shaping** where each interaction evolves the document
- **Screen capture** mode for requirement discovery through annotations

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
| **Frontend** | React 18, TypeScript 5.6, Vite 7, Tailwind CSS 3.4, shadcn/ui (47 components) |
| **Backend** | Express 5.0, OpenAI GPT-4o (default) / Google Gemini 2.0 Flash / Anthropic Claude (configurable via `LLM_PROVIDER`) |
| **Database** | PostgreSQL via Drizzle ORM, zero-knowledge AES-256-GCM encryption (all user text encrypted at rest) |
| **Auth** | Clerk (authentication & user ownership) |
| **Validation** | Zod schemas shared between frontend/backend |
| **State** | React Query (TanStack), React hooks |
| **Routing** | Wouter (lightweight client-side router) |
| **Voice** | Web Speech API + custom audio worklets |

## Directory Structure

```
provocations/
├── client/src/
│   ├── pages/
│   │   ├── Workspace.tsx           # Main app orchestrator
│   │   └── not-found.tsx           # 404 page
│   ├── components/
│   │   ├── ui/                     # 47 shadcn/ui primitives (Radix-based)
│   │   ├── TextInputForm.tsx       # Landing page input (template selection + URL)
│   │   ├── ProvocationsDisplay.tsx  # Challenge cards with voice response
│   │   ├── ProvocationToolbox.tsx   # Mode selector (challenge/advise/interview)
│   │   ├── ReadingPane.tsx          # Editable document canvas
│   │   ├── InterviewPanel.tsx       # Multi-turn interview Q&A flow
│   │   ├── StreamingWorkspace.tsx   # Requirement discovery workspace
│   │   ├── StreamingDialogue.tsx    # Agent dialogue for requirements
│   │   ├── StreamingWireframePanel.tsx # Wireframe analysis display
│   │   ├── BrowserExplorer.tsx      # Embedded iframe for website browsing
│   │   ├── ScreenCaptureButton.tsx  # Screenshot + annotation workflow
│   │   ├── VoiceRecorder.tsx        # Web Speech API recording
│   │   ├── TranscriptOverlay.tsx    # Live transcript during recording
│   │   ├── ProvokeText.tsx          # Smart text area with voice + processing
│   │   ├── ContextCapturePanel.tsx  # Capture text/images/links as context
│   │   ├── ContextStatusPanel.tsx   # Display captured context status
│   │   ├── DraftQuestionsPanel.tsx  # Guided questions for templates
│   │   ├── DiffView.tsx             # Side-by-side version comparison
│   │   ├── MarkdownRenderer.tsx     # Markdown → HTML rendering
│   │   ├── OutlineBuilder.tsx       # Document outline with sections
│   │   ├── LogStatsPanel.tsx        # Edit statistics and logs
│   │   └── AutoDictateToggle.tsx    # Continuous voice recording toggle
│   ├── hooks/
│   │   ├── use-auto-dictate.ts      # Voice recording preference
│   │   ├── use-mobile.tsx           # Mobile viewport detection
│   │   └── use-toast.ts            # Toast notification system
│   ├── lib/
│   │   ├── queryClient.ts          # React Query config + apiRequest helper
│   │   ├── prebuiltTemplates.ts    # Template definitions (8 prebuilt types)
│   │   └── utils.ts                # Tailwind merge utilities
│   ├── App.tsx                     # Router setup
│   └── main.tsx                    # Entry point
├── server/
│   ├── index.ts                    # Express app setup
│   ├── routes.ts                   # All API endpoints (21 routes)
│   ├── llm.ts                      # Configurable LLM provider (Gemini/Anthropic)
│   ├── storage.ts                  # Database operations (Drizzle ORM)
│   ├── crypto.ts                   # AES-256-GCM encryption/decryption (zero-knowledge)
│   └── db.ts                       # Database connection
├── shared/
│   ├── schema.ts                   # Zod schemas & TypeScript types
│   ├── personas.ts                 # 8 built-in persona definitions
│   └── models/chat.ts             # Drizzle ORM table definitions
└── script/build.ts                 # Production build configuration
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
2. **Analyze** — AI generates challenges from multiple persona perspectives
3. **Respond** — Use voice or text to address challenges
4. **Merge** — AI intelligently weaves your responses into the document
5. **Iterate** — Repeat until the document fully captures your thinking

## API Endpoints

All endpoints use Zod validation. Document endpoints require Clerk authentication.

### AI-Powered Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/generate-challenges` | POST | Generate challenges from selected personas |
| `/api/generate-advice` | POST | Generate advice for a specific challenge |
| `/api/write` | POST | Unified document editor (edit, expand, refine) |
| `/api/write/stream` | POST | Streaming write for large documents (SSE) |
| `/api/summarize-intent` | POST | Clean voice transcripts into clear intent |
| `/api/interview/question` | POST | Generate next interview question |
| `/api/interview/summary` | POST | Synthesize interview entries into instructions |
| `/api/discussion/ask` | POST | Multi-persona response to user questions |
| `/api/streaming/question` | POST | Requirement discovery dialogue |
| `/api/streaming/wireframe-analysis` | POST | Analyze website structure & content |
| `/api/streaming/refine` | POST | Refine requirements from dialogue |

### Data Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/personas` | GET | List all 8 built-in personas |
| `/api/documents` | POST | Save new document (encrypted) |
| `/api/documents/:id` | PUT | Update document |
| `/api/documents` | GET | List user's documents |
| `/api/documents/:id` | GET | Load document (decrypted) |
| `/api/documents/:id` | PATCH | Rename document |
| `/api/documents/:id` | DELETE | Delete document |
| `/api/preferences` | GET/PUT | User preferences (auto-dictate) |
| `/api/screenshot` | POST | Server-side screenshot via Playwright |

## Domain Concepts

### Persona Hierarchy (14 Built-in Perspectives)

```
Master Researcher (root) — orchestrates all domains, refreshes every 7 days
│
├── Business Domain
│   ├── Think Bigger         ─  Scale impact: retention, reach, accessibility
│   ├── CEO                  ─  Mission-first: clarity, accountability, trust
│   └── Product Manager      ─  Business value: user stories, success metrics
│
├── Technology Domain
│   ├── Architect            ─  System design: boundaries, APIs, data flow
│   ├── Data Architect       ─  Fit-for-purpose data, Key Ring identifiers
│   ├── QA Engineer          ─  Testing: edge cases, error handling, reliability
│   ├── UX Designer          ─  User flows: discoverability, accessibility
│   ├── Tech Writer          ─  Documentation: clarity, naming, context
│   ├── Security Engineer    ─  Auth, data privacy, compliance
│   └── Cybersecurity        ─  Threat modeling, attack surface, incident response
│
└── Marketing Domain
    ├── Growth Strategist    ─  Acquisition, activation, retention, funnel economics
    ├── Brand Strategist     ─  Positioning, differentiation, voice consistency
    └── Content Strategist   ─  Audience-channel fit, distribution, SEO, measurement
```

Each persona has distinct challenge and advice prompts:

| ID | Domain | Label | Focus |
|----|--------|-------|-------|
| `thinking_bigger` | business | Think Bigger | Scale impact: retention, cost-to-serve, accessibility |
| `ceo` | business | CEO | Mission-first: clarity, accountability, trust |
| `product_manager` | business | Product Manager | Business value: user stories, success metrics |
| `architect` | technology | Architect | System design: boundaries, APIs, data flow |
| `data_architect` | technology | Data Architect | Fit-for-purpose data, Key Ring, governance |
| `quality_engineer` | technology | QA Engineer | Testing: edge cases, error handling, reliability |
| `ux_designer` | technology | UX Designer | User flows: discoverability, accessibility, error states |
| `tech_writer` | technology | Tech Writer | Documentation: clarity, naming, missing context |
| `security_engineer` | technology | Security Engineer | Auth, data privacy, compliance |
| `cybersecurity_engineer` | technology | Cybersecurity | Threat modeling, attack surface, defense-in-depth |
| `growth_strategist` | marketing | Growth Strategist | Acquisition, activation, retention, funnel economics |
| `brand_strategist` | marketing | Brand Strategist | Positioning, differentiation, voice consistency |
| `content_strategist` | marketing | Content Strategist | Audience-channel fit, distribution, measurement |

### Hierarchy Governance Rules

The Master Researcher is the root agent that governs the entire persona hierarchy:

1. **Freshness**: The Master Researcher must refresh all persona definitions every **7 days**. Personas with `lastResearchedAt` older than 7 days (or `null`) are considered stale and flagged for re-research.
2. **Domain completeness**: Every domain (business, technology, marketing) must have sufficient coverage for its core knowledge worker roles. The Master Researcher evaluates gaps and proposes new personas when a domain is under-represented.
3. **No orphans**: Every persona (except the root) must have a valid `parentId` and `domain`. Personas without hierarchy placement are invalid.
4. **Challenge ≠ Advice**: Each persona has separate `challenge` and `advice` prompts. Challenges identify gaps and weaknesses without offering solutions. Advice is a separate invocation that provides concrete, actionable recommendations. These are never combined.
5. **Non-negotiable behaviors**: Each persona defines explicit non-negotiable behaviors (what it always does) and forbidden behaviors (what it never does). These constraints ensure consistency across research refreshes.
6. **Computer-first filter**: Only knowledge worker roles where computer-based tasks are central qualify as personas. Roles with significant non-digital, in-person work are excluded.
7. **No overlap**: Each persona must challenge a distinct dimension. If two personas overlap significantly, they should be merged or one should be removed.
8. **Structured definition**: Every persona must include: id, label, icon, role, description, color, prompts (challenge + advice), summary, domain, parentId, and lastResearchedAt.

### Instruction Types (7 Classifications)

The `/api/write` endpoint classifies instructions before processing:
- `expand` — Add depth, examples, supporting details
- `condense` — Remove redundancy, tighten prose
- `restructure` — Reorganize content, modify headings, reorder sections
- `clarify` — Simplify language, improve accessibility
- `style` — Adjust voice and tone
- `correct` — Fix grammar, spelling, logic errors
- `general` — Fallback for mixed instructions

### Tone Options
- `inspirational`, `practical`, `analytical`, `persuasive`, `cautious`

## Key Components

### Workspace.tsx (Orchestrator)
Central hub managing:
- **Phases**: `input` → `workspace` (with streaming/capture variant)
- **State**: document, personas, challenges, interview entries, versions
- **Versioning**: Full history with diff comparison
- **Toolbox apps**: interview, website/capture, discussion

### ReadingPane.tsx
The document canvas:
- Editable mode (pencil toggle)
- Text selection → voice/edit actions
- Markdown rendering and download

### ProvocationsDisplay.tsx
Challenge cards that drive iteration:
- Voice recording on each card
- Status: pending, addressed, rejected, highlighted
- Context passed to write endpoint for intelligent integration

### StreamingWorkspace.tsx
Requirement discovery through:
- Agent-guided dialogue
- Website wireframe analysis
- Screenshot annotations
- Requirement extraction and refinement

## Design System

### Theme
- **Primary**: Warm amber (#B35C1E)
- **Accent**: Thoughtful blue (200, 60%, 45%)
- **Aesthetic**: Aged paper/ink, intellectual warmth
- **Mode**: Dark mode supported

### Fonts
- **Body**: Source Serif 4
- **Headings**: Libre Baskerville
- **Code**: JetBrains Mono

## Environment Variables

| Variable | Description |
|----------|-------------|
| `AI_INTEGRATIONS_OPENAI_API_KEY` | OpenAI API key (auto-injected by Replit AI Integrations) |
| `AI_INTEGRATIONS_OPENAI_BASE_URL` | Replit proxy base URL for OpenAI requests (auto-injected) |
| `ANTHROPIC_API_KEY` | Anthropic API key (or `ANTHROPIC_KEY`) |
| `GEMINI_API_KEY` | Google Gemini API key (via OpenAI-compatible endpoint) |
| `LLM_PROVIDER` | Force provider: `openai`, `gemini`, or `anthropic` (auto-detects by default) |
| `DATABASE_URL` | PostgreSQL connection string |
| `ENCRYPTION_SECRET` | AES-GCM key for document encryption |
| `CLERK_PUBLISHABLE_KEY` | Clerk frontend authentication |
| `CLERK_SECRET_KEY` | Clerk backend secret key |
| `PLAYWRIGHT_CHROMIUM_PATH` | Path to Chromium for screenshots |

### Replit AI Integrations

OpenAI credentials are managed automatically via **Tools > AI Integrations** in Replit. When you enable OpenAI in that panel, Replit injects `AI_INTEGRATIONS_OPENAI_API_KEY` and `AI_INTEGRATIONS_OPENAI_BASE_URL` into the server process environment. Requests are proxied through Replit and billed to your Replit credits.

The LLM adapter in `server/llm.ts` auto-detects these variables. You can verify the active provider at runtime via `GET /api/llm-status`.

## Development Notes

### Adding API Routes
1. Define Zod schema in `shared/schema.ts`
2. Add endpoint in `server/routes.ts`
3. Use `safeParse()` for validation
4. All LLM calls go through `llm.generate()` / `llm.stream()` from `server/llm.ts`

### State Management
- Local state in Workspace.tsx for app-wide concerns
- React Query for server state caching
- No Redux/Zustand — keep it simple

### Error Handling
- Zod validation on all API inputs
- Defensive null-checks in components
- Toast notifications for user feedback

### ADR: Always Use ProvokeText for Text Display

**All text panels in the application MUST use `ProvokeText`** — never raw `<div>`, `<p>`, `<textarea>`, or `<pre>` for displaying or editing user-facing text content. This is an architectural decision record (ADR) that applies to every component.

**Why:** ProvokeText provides a unified text experience with built-in copy, voice, smart processing, and consistent styling. Using raw elements creates inconsistency and loses capabilities.

**Rules:**
1. **Read-only text panels** (transcripts, summaries, previews): Use `<ProvokeText readOnly showCopy showClear={false} />` with `chrome="container"` or `chrome="bare"`.
2. **Editable text areas**: Use `<ProvokeText chrome="container" variant="textarea" />` with appropriate voice/processor props.
3. **Document editors**: Use `<ProvokeText chrome="container" variant="editor" />`.
4. **Minimum visible action**: `showCopy` must always be `true` — users must always be able to copy text. Other actions (clear, voice, smart modes) can be hidden via props.
5. **Streaming content**: Set `readOnly` and update the `value` prop as data arrives — ProvokeText handles re-rendering without interrupting the display.
6. **Configuration extension**: If ProvokeText lacks a needed capability, extend its props interface rather than bypassing it with a raw element.

**Props quick reference:**
- `chrome`: `"container"` (bordered card with header) | `"inline"` (floating toolbar) | `"bare"` (no chrome)
- `variant`: `"input"` | `"textarea"` | `"editor"`
- `showCopy` / `showClear`: Control toolbar button visibility
- `readOnly`: Disable editing while keeping copy functional
- `headerActions`: Slot for extra buttons in the container header
- `label` / `labelIcon`: Container header label

### Document Storage — Zero-Knowledge Encryption
- **All user-provided text is encrypted at rest** with AES-256-GCM (server-side)
  - Document content: encrypted (ciphertext + salt + iv)
  - Document titles: encrypted (titleCiphertext + titleSalt + titleIv)
  - Folder names: encrypted (nameCiphertext + nameSalt + nameIv)
- Legacy plaintext titles/names are supported for backward compatibility: if encrypted columns are null, the legacy plaintext column is used as fallback
- New documents/folders store `"[encrypted]"` in the legacy title/name column
- The server has **no right to read user content** — encryption/decryption happens at the route boundary, storage layer only handles opaque ciphertext
- Ownership verified via Clerk userId
- Each encrypted field gets its own random salt + IV (independent key derivation per field)

## Not Yet Implemented

- Testing framework (Jest/Vitest)
- CI/CD pipeline
- Structured logging
