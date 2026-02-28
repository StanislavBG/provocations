# CLAUDE.md - Provocations Project Guide

## Project Overview

**Provocations** is an AI-augmented document workspace where users iteratively shape ideas into polished documents through voice, text, and thought-provoking AI interactions.

Think of it as a **smarter Google Docs** — the document is the output, and the AI helps you create and refine it through:
- **Multiple personas** (14 expert perspectives) that challenge your thinking
- **Provocations** that push you to address gaps, assumptions, and alternatives
- **Voice input** for natural ideation and feedback
- **Iterative shaping** where each interaction evolves the document
- **Screen capture** mode for requirement discovery through annotations

**Core Philosophy**: "Would you rather have a tool that thinks for you, or a tool that makes you think?"

The AI doesn't write for you — it provokes deeper thinking so *you* write better.

## AIQA — QA Bug Tracking

The AIQA QA overlay is embedded in `client/index.html`. Environment variables are in `.env` (`AIQA_URL`, `AIQA_API_KEY`, `AIQA_PROJECT_ID`). MCP integration is in `.mcp.json` (uses `aiqastudio-mcp` package).

### Fetch bugs and feature requests

```bash
curl -H "X-API-Key: 3b03bd31-93b9-4efe-9c3d-4d6a54db97f0" \
  "https://aiqastudio.com/api/bugs?project_id=0681dd20-4cec-4a1a-8280-7c7b33fdaee7"
```

Filter options: `&submission_type=bug_report`, `&submission_type=feature_request`, `&status=open`, `&urgency=high`.

### Other AIQA API endpoints

```bash
# Check test results
GET https://aiqastudio.com/api/projects/0681dd20-4cec-4a1a-8280-7c7b33fdaee7/results

# List test cases
GET https://aiqastudio.com/api/test-cases?project_id=0681dd20-4cec-4a1a-8280-7c7b33fdaee7

# Stats overview
GET https://aiqastudio.com/api/stats/overview?project_id=0681dd20-4cec-4a1a-8280-7c7b33fdaee7
```

All endpoints require `X-API-Key: {AIQA_API_KEY}` header.

## Quick Commands

```bash
npm install      # Install dependencies (REQUIRED before any other command)
npm run dev      # Start development server (Express + Vite HMR on port 5000)
npm run build    # Build for production (outputs to dist/)
npm run start    # Run production build
npm run check    # TypeScript type checking
npm run db:push  # Push Drizzle schema to database
```

> **Important:** You must run `npm install` before `npm run check` or `npm run build`. Without full dependencies installed, TypeScript will report false errors like `Cannot find type definition file for 'node'` and `Cannot find type definition file for 'vite/client'`. These are **not real code errors** — they indicate missing `node_modules` (specifically `@types/node` and `vite`). Always ensure dependencies are installed first.

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
├── apps/                            # Per-app CLAUDE.md documentation
│   ├── write-a-prompt/CLAUDE.md
│   ├── product-requirement/CLAUDE.md
│   ├── new-application/CLAUDE.md
│   ├── streaming/CLAUDE.md          # Screen Capture app
│   ├── research-paper/CLAUDE.md
│   ├── persona-definition/CLAUDE.md
│   ├── research-context/CLAUDE.md
│   ├── voice-capture/CLAUDE.md
│   ├── youtube-to-infographic/CLAUDE.md
│   ├── text-to-infographic/CLAUDE.md
│   ├── email-composer/CLAUDE.md
│   └── agent-editor/CLAUDE.md
├── client/src/
│   ├── pages/
│   │   ├── NotebookWorkspace.tsx   # Primary 3-panel workspace (replaced old Workspace.tsx)
│   │   ├── Workspace.tsx           # Legacy workspace (still used for some layouts)
│   │   ├── ContextStore.tsx        # Standalone /store page for context management
│   │   ├── Admin.tsx               # Admin analytics dashboard
│   │   ├── Pricing.tsx             # Pricing page
│   │   └── not-found.tsx           # 404 page
│   ├── components/
│   │   ├── ui/                     # 47 shadcn/ui primitives (Radix-based)
│   │   ├── notebook/               # Notebook layout components (see below)
│   │   │   ├── NotebookTopBar.tsx      # Session header with name, version count, admin controls
│   │   │   ├── NotebookLeftPanel.tsx   # Left panel: Context | Chat | Video tabs
│   │   │   ├── NotebookCenterPanel.tsx # Center: document editor + objective
│   │   │   ├── NotebookRightPanel.tsx  # Right panel: Research | Notes | Provo | Generate tabs
│   │   │   ├── ContextSidebar.tsx      # Document/folder tree with pin, search, inline edit
│   │   │   ├── NotebookResearchChat.tsx # Streaming research chat (SSE via /api/chat/stream)
│   │   │   ├── ProvoThread.tsx         # Persona discussion thread with accept/respond
│   │   │   ├── TranscriptPanel.tsx     # Notes panel: add/remove notes, save to context, evolve doc
│   │   │   ├── SplitDocumentEditor.tsx # Multi-tab editor with smart buttons (Expand/Condense/...)
│   │   │   ├── PersonaAvatarRow.tsx    # Persona toggle row with avatars
│   │   │   ├── ChatThread.tsx          # User-to-user chat thread rendering
│   │   │   └── OnboardingSplash.tsx    # Welcome screen when no document loaded
│   │   ├── bschart/                # BS Chart visual diagramming tool
│   │   │   ├── BSChartWorkspace.tsx    # Main chart workspace with canvas, toolbar, properties
│   │   │   ├── BSChartCanvas.tsx       # Canvas rendering layer
│   │   │   ├── BSChartToolbar.tsx      # Node creation and format controls
│   │   │   ├── BSChartProperties.tsx   # Property editor for nodes/connectors
│   │   │   ├── BSConnectorLayer.tsx    # Edge/connector rendering
│   │   │   ├── types.ts               # Chart type definitions
│   │   │   ├── nodes/BSNodeRenderer.tsx # Renders node types (table, diamond, rect, text, badge)
│   │   │   └── hooks/                  # useChartState, useCanvasInteraction, useVoiceChartCommands
│   │   ├── ProvokeText.tsx          # Smart text area with voice + processing (ADR: all text must use this)
│   │   ├── ReadingPane.tsx          # Editable document canvas with save-to-context
│   │   ├── StoragePanel.tsx         # Context Store browser (embeddable or standalone)
│   │   ├── ChatDrawer.tsx           # User-to-user messaging drawer
│   │   ├── GeneratePanel.tsx        # Document generation panel
│   │   ├── ArtifyPanel.tsx          # Image generation from text
│   │   └── ...                     # See apps/*/CLAUDE.md for app-specific components
│   ├── hooks/
│   │   ├── use-whisper.ts          # Whisper-based voice recording
│   │   ├── use-role.ts             # Admin role detection
│   │   ├── use-app-favorites.ts    # App favorites persistence
│   │   └── ...
│   ├── lib/
│   │   ├── queryClient.ts          # React Query config + apiRequest helper
│   │   ├── prebuiltTemplates.ts    # Template definitions (15 app types)
│   │   ├── appWorkspaceConfig.ts   # App workspace behavior configs
│   │   ├── workspace-context.tsx   # Shared workspace context provider
│   │   ├── tracking.ts             # Client-side usage tracking
│   │   ├── errorLog.ts             # Error log store
│   │   ├── featureFlags.ts         # Feature flag management
│   │   └── utils.ts                # Tailwind merge utilities, generateId
│   ├── App.tsx                     # Router setup (NotebookWorkspace is default)
│   └── main.tsx                    # Entry point
├── server/
│   ├── index.ts                    # Express app setup
│   ├── routes.ts                   # All API endpoints
│   ├── llm.ts                      # Configurable LLM provider (OpenAI/Gemini/Anthropic)
│   ├── llm-gateway.ts              # LLM call logging and cost tracking
│   ├── context-builder.ts          # Per-app LLM system prompts & output config
│   ├── storage.ts                  # Database operations (Drizzle ORM)
│   ├── crypto.ts                   # AES-256-GCM encryption/decryption (zero-knowledge)
│   ├── agent-executor.ts           # Agent workflow execution engine
│   ├── invoke.ts                   # Task type routing for LLM calls
│   ├── static.ts                   # Static file serving
│   └── db.ts                       # Database connection
├── shared/
│   ├── schema.ts                   # Zod schemas & TypeScript types (templateIds source of truth)
│   ├── personas.ts                 # 14 built-in persona definitions
│   └── models/chat.ts             # Drizzle ORM table definitions (connections, conversations, messages)
└── script/build.ts                 # Production build configuration
```

## Per-App Documentation

Each of the 12 applications has its own `apps/<templateId>/CLAUDE.md` containing:
- **Identity**: Purpose, category, philosophy, user workflow
- **Three-layer definition**: Exact config from prebuiltTemplates, appWorkspaceConfig, context-builder
- **App-specific components**: Components unique to that app
- **App-specific API endpoints**: Endpoints only that app uses
- **Key behaviors**: What makes this app different from others

**See `apps/<templateId>/CLAUDE.md` for app-specific guidance.**

| Template ID | Title | Category | Layout | Writer Mode |
|-------------|-------|----------|--------|-------------|
| `write-a-prompt` | Write a Prompt | write | standard | edit |
| `product-requirement` | Product Requirement | build | standard | edit |
| `new-application` | New Application | build | standard | edit |
| `streaming` | Screen Capture | analyze | standard | edit |
| `research-paper` | Research Paper | write | standard | edit |
| `persona-definition` | Persona / Agent | write | standard | edit |
| `research-context` | Research into Context | capture | standard | aggregate |
| `voice-capture` | Voice Capture | capture | voice-capture | aggregate |
| `youtube-to-infographic` | YouTube to Infographic | capture | standard | edit |
| `text-to-infographic` | Text to Infographic | capture | infographic-studio | edit |
| `email-composer` | Email Composer | write | standard | edit |
| `agent-editor` | Agent Editor | build | standard | edit |
| `gpt-to-context` | GPT to Context | capture | research-chat | aggregate |
| `bs-chart` | BS Chart | build | bs-chart | edit |
| `query-editor` | Query Editor | analyze | external | — |

### Context Store Sync

Admin users can sync all per-app CLAUDE.md files into the document store:
- `POST /api/admin/sync-app-docs` — Reads `apps/*/CLAUDE.md` from disk, creates/updates encrypted documents in the admin's `Applications/Provocations/` folder hierarchy
- Auto-syncs on server startup for the admin user
- Each app's documentation becomes available as context when using any app via the Context Manager

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

All endpoints use Zod validation. Document endpoints require Clerk authentication. App-specific endpoints are documented in each app's `apps/<templateId>/CLAUDE.md`.

### Shared AI Endpoints (used by all apps)

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

### Research Chat Endpoints (NotebookWorkspace)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/chat/stream` | POST | Streaming research chat (SSE) |
| `/api/chat/summarize` | POST | Summarize a research chat session |
| `/api/chat/save-session` | POST | Save research chat session to context |
| `/api/chat/models` | GET | List available chat models |

### User-to-User Messaging Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/chat/connections/invite` | POST | Send connection invitation |
| `/api/chat/connections` | GET | List user's connections |
| `/api/chat/connections/respond` | POST | Accept/reject connection |
| `/api/chat/conversations` | GET | List conversations with users |
| `/api/chat/messages` | POST | Send message in conversation |
| `/api/chat/messages/:id` | GET | Fetch conversation history |
| `/api/chat/messages/:id/read` | POST | Mark messages as read |

### Shared Data Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/personas` | GET | List all 14 built-in personas |
| `/api/documents` | POST/GET | Save new document (encrypted) / List user's documents |
| `/api/documents/:id` | GET/PUT/PATCH/DELETE | Load, update, rename, delete document |
| `/api/folders` | POST/GET | Create folder / List user's folders |
| `/api/preferences` | GET/PUT | User preferences (auto-dictate) |
| `/api/tracking/event` | POST | Record usage tracking event |
| `/api/metrics` | POST | Record productivity metrics |

### Admin Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/auth/role` | GET | Check if current user is admin |
| `/api/admin/dashboard` | GET | Analytics dashboard data |
| `/api/admin/user-metrics` | GET | User metrics matrix |
| `/api/admin/sync-app-docs` | POST | Sync per-app CLAUDE.md files to document store |
| `/api/admin/persona-overrides` | GET | List persona DB overrides |
| `/api/admin/agent-prompts` | GET | List LLM task prompt overrides |

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

## Key Shared Components

### NotebookWorkspace.tsx (Primary Orchestrator)
The main interface since the notebook refactor. Unified 3-panel resizable layout:
- **Left panel**: ContextSidebar (document/folder tree, pin, search) + ChatDrawer (user-to-user messaging)
- **Center panel**: SplitDocumentEditor (multi-tab document + chart editing) + objective input
- **Right panel**: Research (streaming AI chat) | Notes (captured context + voice transcripts) | Provo (persona discussion) | Generate (document generation)
- **State**: document, objective, personas, capturedContext, pinnedDocIds, discussionMessages, versions, editHistory
- **Mobile**: Falls back to tabbed single-panel layout (context | document | chat tabs)

### Workspace.tsx (Legacy Orchestrator)
Still exists for some layout types (voice-capture, infographic-studio). Uses the older tab-based left/right panel system with `AppFlowConfig`.

### notebook/ Components
| Component | Purpose |
|-----------|---------|
| `NotebookTopBar.tsx` | Session header: name, version count, New Session, admin controls |
| `NotebookLeftPanel.tsx` | Collapsible left panel with Context / Chat / Video tabs |
| `ContextSidebar.tsx` | Full document/folder tree browser with pin/unpin, search, inline rename/delete |
| `NotebookCenterPanel.tsx` | Document editor + objective, preview overlay for context docs |
| `NotebookRightPanel.tsx` | 4-tab right panel: Research, Notes, Provo, Generate |
| `NotebookResearchChat.tsx` | Streaming research chat via `/api/chat/stream` (SSE) |
| `ProvoThread.tsx` | Multi-persona discussion thread: challenges, accept/dismiss, respond |
| `TranscriptPanel.tsx` | Notes management: add notes (text/voice), save to Context Store, evolve document |
| `SplitDocumentEditor.tsx` | Multi-tab editor with smart buttons (Expand/Condense/Restructure/Clarify/Style/Correct) |
| `PersonaAvatarRow.tsx` | Persona selector row with toggle avatars |

### bschart/ Components
Visual diagram/flowchart designer on infinite canvas:
- `BSChartWorkspace.tsx` — Main container with state management and voice command integration
- `hooks/useVoiceChartCommands.ts` — Natural language voice commands → chart operations
- `hooks/useChartState.ts` — Node/connector state management
- Supports: ERD, flowcharts, architecture diagrams with drag/drop and voice creation

### ReadingPane.tsx
The document canvas (used by legacy workspace standard-layout apps):
- Editable mode (pencil toggle)
- Text selection → voice/edit actions
- Markdown rendering and download
- **Save to Context Store** button in toolbar

### ProvokeText.tsx (ADR-mandated)
Universal text component — see ADR below. All text display/editing must use this.

App-specific components are documented in each app's `apps/<templateId>/CLAUDE.md`.

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

### Code Quality — Fix Pre-existing Errors

When running `npm run check` or `npm run build`, **always fix all TypeScript errors** — including pre-existing ones in files you didn't change. Do not ignore or skip errors just because they existed before your changes. Every check run should leave the codebase in a better state. If a pre-existing error would take significant effort to fix, flag it to the user rather than silently ignoring it.

### Adding API Routes
1. Define Zod schema in `shared/schema.ts`
2. Add endpoint in `server/routes.ts`
3. Use `safeParse()` for validation
4. All LLM calls go through `llm.generate()` / `llm.stream()` from `server/llm.ts`

### Routing (`App.tsx`)

| Route | Component | Purpose |
|-------|-----------|---------|
| `/` | `NotebookWorkspace` | Default home — notebook 3-panel layout |
| `/app/:templateId` | `NotebookWorkspace` | Template-specific workspace |
| `/store` | `ContextStore` | Standalone Context Store page |
| `/admin` | `Admin` | Admin analytics dashboard |
| `/pricing` | `Pricing` | Pricing page |

### State Management
- Local state in NotebookWorkspace.tsx (primary) and Workspace.tsx (legacy) for app-wide concerns
- React Query for server state caching
- Context pinning: `pinnedDocIds` (Set) + `pinnedDocContents` (cache) in NotebookWorkspace
- Captured context: `capturedContext` (ContextItem[]) passed to all LLM calls
- No Redux/Zustand — keep it simple

### Database Tables (`shared/models/chat.ts`)

| Table | Purpose |
|-------|---------|
| `connections` | User-to-user connections (pending/accepted/blocked) |
| `conversations` | Chat conversations between users |
| `messages` | Individual chat messages |
| `chatPreferences` | User chat settings |

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

### ADR: ProvokeText Button Consistency

All ProvokeText panels must provide a **consistent set of capabilities** based on their chrome level. ProvokeText enforces sensible defaults so panels get the right buttons automatically — explicit overrides are only needed for intentional deviations.

**Automatic defaults by chrome level:**

| Feature | Container + textarea/editor | Inline + textarea/editor | Bare / input |
|---------|----------------------------|--------------------------|--------------|
| **Top right**: Copy | yes (default) | yes (default) | yes (default) |
| **Top right**: Clear | yes (default) | yes (default) | yes (default) |
| **Top right**: Microphone | auto (self-contained voice) | auto (self-contained voice) | manual only |
| **Bottom left**: Clean / Summarize | auto (built-in textProcessor) | manual only | manual only |
| **Bottom left**: Save / Load | via `onSave` / `onLoad` props | via `onSave` / `onLoad` props | — |
| **Bottom right**: Word count | yes (default) | yes (default) | no |
| **Bottom right**: Reading time | yes (default) | no | no |

**Self-contained voice**: When no explicit `voice` or `onVoiceTranscript` props are provided and the panel is editable (not `readOnly`) and substantial (`chrome !== "bare"`, `variant !== "input"`), ProvokeText auto-enables an "append" voice mode that appends transcripts directly into the value via `onChange`. The mic button always appears.

**Built-in text processor**: When no explicit `textProcessor` is provided and the panel is a container chrome, editable, and not an input variant, ProvokeText provides a default processor that calls `/api/summarize-intent` for Clean and Summarize actions.

**Built-in Save / Load**: Pass `onSave` (and optionally `isSaving`) or `onLoad` callbacks to show Save and Load action buttons in the bottom-left actions row. The parent owns the handler logic (e.g., saving to Context Store); ProvokeText owns the button rendering.

**Rules:**
1. Never set `showCopy={false}` on container panels — users must always be able to copy.
2. Never set `showClear={false}` on editable container panels unless there's a specific reason (e.g., read-only summaries).
3. Container panels get self-contained voice, default textProcessor, word count, and reading time automatically — do not duplicate this logic in parents.
4. Pass `onSave` and `onLoad` props to container panels that hold user content worth persisting.
5. Small inline inputs (chat inputs, heading editors) may set `showCopy={false}` and `showClear={false}` — they are intentionally minimal.
6. To override any default, explicitly pass the prop (e.g., `showWordCount={false}` to suppress word count on a specific panel).

### ADR: Adding a New Application (Three-Layer Contract)

Every application (template) in Provocations is defined across **three files** that must stay in sync. The `TemplateId` type in `shared/schema.ts` enforces this at build time — if you add a new ID, TypeScript will error until all three layers have a matching entry.

**The three layers:**

| # | File | What it defines | Type |
|---|------|----------------|------|
| 1 | `client/src/lib/prebuiltTemplates.ts` | UI identity — title, icon, description, starter text, draft questions, category | `PrebuiltTemplate` |
| 2 | `client/src/lib/appWorkspaceConfig.ts` | Workspace behavior — layout, panel tabs, writer mode, auto-start interview | `AppFlowConfig` |
| 3 | `server/context-builder.ts` | LLM guidance — system prompt, output format, feedback tone, document type | `AppTypeConfig` |

**Mandatory checklist when adding a new application:**

1. **Add the template ID** to the `templateIds` array in `shared/schema.ts`
2. **Add the `PrebuiltTemplate`** object in `prebuiltTemplates.ts` with:
   - `id` matching the new `templateIds` entry exactly
   - `title`, `shortLabel`, `subtitle`, `description`, `howTo`
   - `icon` (lucide React component)
   - `objective` (pre-populated objective text)
   - `draftQuestions` (3-5 probing questions for the draft phase)
   - `templateContent` (markdown template or empty for freeform)
   - `provocationSources` and `provocationExamples`
   - `steps` (workflow progress steps)
   - `category` (`"build"` | `"write"` | `"analyze"` | `"capture"`)
3. **Add the `AppFlowConfig`** entry in `appWorkspaceConfig.ts` with:
   - `workspaceLayout` (`"standard"`, `"voice-capture"`, `"research-chat"`, `"bs-chart"`)
   - `defaultToolboxTab` (which left panel tab opens first)
   - `autoStartInterview` + `autoStartPersonas`
   - `leftPanelTabs` and `rightPanelTabs` (ordered tab configs)
   - `writer` config: `mode` (`"edit"` | `"analyze"` | `"aggregate"`), `outputFormat`, `documentType`
4. **Add the `AppTypeConfig`** entry in `context-builder.ts` with:
   - `documentType` (human-readable label for the output)
   - `systemGuidance` (full system prompt injected into every LLM call for this app)
   - `feedbackTone` (how challenges/advice should sound)
   - `outputFormat` (`"markdown"` or `"sql"`)
5. **Create `apps/<templateId>/CLAUDE.md`** with app-specific documentation (identity, three-layer definition, components, endpoints, key behaviors)
6. **Run `npm run check`** — TypeScript will verify all three layers have the new ID

**Type enforcement:**
- `templateIds` in `shared/schema.ts` is the single source of truth (`as const` array)
- `TemplateId` type is derived from it
- `APP_CONFIGS` is `Record<TemplateId, AppFlowConfig>` — missing entry = build error
- `APP_TYPE_CONFIGS` is `Record<TemplateId, AppTypeConfig>` — missing entry = build error
- All `appType` fields in Zod request schemas use `z.enum(templateIds)` — invalid IDs are rejected at API validation

**Rules:**
- Template IDs must be lowercase kebab-case (e.g. `"my-new-app"`)
- The `writer.mode` determines how the document evolves: `"edit"` rewrites, `"analyze"` is read-only, `"aggregate"` appends
- The `systemGuidance` in the backend config is the most important field — it shapes every LLM interaction for that app
- Every app must work with the challenge/advice loop (personas generate challenges, user responds, document evolves)

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

## Build & Deployment Environment — Replit

Replit is the **sole build and deployment environment** for this project. The developer workflow is:

1. Develop locally or in Claude Code
2. Push to GitHub (`git push`)
3. On Replit: click **Git Sync** to pull latest changes
4. On Replit: click **Deploy** to ship to production

**Claude's responsibility**: Keep `replit.md` accurate and up to date so that the Replit environment works immediately after a Git Sync — no manual configuration, no extra steps. The user should never need to edit Replit settings by hand.

### What `replit.md` must reflect

| Section | What to maintain |
|---------|-----------------|
| **Overview** | Current project description, core philosophy |
| **Architecture** | Current frontend/backend stack, key components, API surface |
| **Environment variables** | All required secrets and env vars (names only, never values) |
| **Build & run** | Current `npm run dev` / `npm run build` / `npm run start` commands |
| **Database** | PostgreSQL setup, Drizzle ORM, migration commands (`npm run db:push`) |
| **LLM provider** | Current default provider, how to switch via `LLM_PROVIDER` env var |
| **Recent changes** | Append a dated entry whenever a significant feature, dependency, or config change is made |

### Rules for maintaining `replit.md`

- **Update `replit.md` whenever you change**: dependencies, environment variables, build commands, database schema, API endpoints, or deployment configuration
- **Never put secrets or API key values** in `replit.md` — only variable names
- **Keep the "Recent Changes" section** chronological (newest first) and concise (one line per change)
- **Match `.replit` config**: if you change ports, build commands, or deployment targets, update both `.replit` and `replit.md`
- The goal: after Git Sync + Deploy on Replit, the app works. Zero manual steps.

## Not Yet Implemented

- Testing framework (Jest/Vitest)
- CI/CD pipeline
- Structured logging
