# Architecture Reference

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

## Path Aliases

Configured in `tsconfig.json`:
- `@/*` → `./client/src/*`
- `@shared/*` → `./shared/*`

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
│   ├── agent-editor/CLAUDE.md
│   ├── gpt-to-context/CLAUDE.md
│   ├── bs-chart/CLAUDE.md
│   ├── interview/CLAUDE.md
│   ├── provo/CLAUDE.md
│   └── timeline/CLAUDE.md
├── client/src/
│   ├── pages/
│   │   ├── NotebookWorkspace.tsx   # Primary 3-panel workspace
│   │   ├── FlowWorkspace.tsx       # Flow Canvas workspace
│   │   ├── ContextStore.tsx        # Standalone /store page for context management
│   │   ├── Admin.tsx               # Admin analytics dashboard
│   │   ├── Pricing.tsx             # Pricing page
│   │   └── not-found.tsx           # 404 page
│   ├── components/
│   │   ├── ui/                     # 47 shadcn/ui primitives (Radix-based)
│   │   ├── notebook/               # Notebook layout components
│   │   │   ├── NotebookTopBar.tsx
│   │   │   ├── NotebookLeftPanel.tsx
│   │   │   ├── NotebookCenterPanel.tsx
│   │   │   ├── NotebookRightPanel.tsx
│   │   │   ├── ContextSidebar.tsx
│   │   │   ├── NotebookResearchChat.tsx
│   │   │   ├── ProvoThread.tsx
│   │   │   ├── TranscriptPanel.tsx
│   │   │   ├── SplitDocumentEditor.tsx
│   │   │   ├── PersonaAvatarRow.tsx
│   │   │   └── ChatThread.tsx
│   │   ├── flow/                   # Flow Canvas components
│   │   │   ├── FlowCanvas.tsx
│   │   │   ├── FlowEdgeLayer.tsx
│   │   │   ├── FlowNodeRenderer.tsx
│   │   │   ├── FlowLlmNode.tsx
│   │   │   ├── FlowStoreNode.tsx
│   │   │   ├── useFlowCanvas.ts
│   │   │   ├── useFlowInteraction.ts
│   │   │   └── llm-presets.ts
│   │   ├── bschart/                # BS Chart visual diagramming tool
│   │   │   ├── BSChartWorkspace.tsx
│   │   │   ├── BSChartCanvas.tsx
│   │   │   ├── BSChartToolbar.tsx
│   │   │   ├── BSChartProperties.tsx
│   │   │   ├── BSConnectorLayer.tsx
│   │   │   ├── types.ts
│   │   │   ├── nodes/BSNodeRenderer.tsx
│   │   │   └── hooks/
│   │   ├── ProvokeText.tsx          # ADR: all text must use this
│   │   ├── LlmHoverButton.tsx       # ADR: all LLM buttons must use this
│   │   ├── StoragePanel.tsx
│   │   ├── ChatDrawer.tsx
│   │   ├── GeneratePanel.tsx
│   │   ├── ArtifyPanel.tsx
│   │   └── ...
│   ├── hooks/
│   │   ├── use-whisper.ts
│   │   ├── use-role.ts
│   │   ├── use-app-favorites.ts
│   │   └── ...
│   ├── lib/
│   │   ├── queryClient.ts          # React Query config + apiRequest helper
│   │   ├── prebuiltTemplates.ts    # Template definitions (15 app types)
│   │   ├── appWorkspaceConfig.ts   # App workspace behavior configs
│   │   ├── workspace-context.tsx   # Shared workspace context provider
│   │   ├── componentRegistry.ts   # Component Wiki metadata
│   │   ├── version.ts             # App version + release notes
│   │   ├── tracking.ts
│   │   ├── errorLog.ts
│   │   ├── featureFlags.ts
│   │   └── utils.ts
│   ├── App.tsx                     # Router setup
│   └── main.tsx                    # Entry point
├── server/
│   ├── index.ts                    # Express app setup
│   ├── routes.ts                   # All API endpoints
│   ├── llm.ts                      # Configurable LLM provider (OpenAI/Gemini/Anthropic)
│   ├── llm-gateway.ts              # LLM call logging and cost tracking
│   ├── context-builder.ts          # Per-app LLM system prompts & output config
│   ├── storage.ts                  # Database operations (Drizzle ORM)
│   ├── crypto.ts                   # AES-256-GCM encryption/decryption
│   ├── agent-executor.ts           # Agent workflow execution engine
│   ├── invoke.ts                   # Task type routing for LLM calls
│   ├── static.ts                   # Static file serving
│   └── db.ts                       # Database connection + ensureTables()
├── shared/
│   ├── schema.ts                   # Zod schemas & TypeScript types (templateIds source of truth)
│   ├── personas.ts                 # 14 built-in persona definitions
│   └── models/chat.ts             # Drizzle ORM table definitions
└── script/build.ts                 # Production build configuration
```

## Three-Layer Application Definition

Every application template is defined across three files that must stay in sync. The `TemplateId` type in `shared/schema.ts` enforces this at build time — if you add a new ID, TypeScript will error until all three layers have a matching entry.

| # | File | What it defines | Type |
|---|------|----------------|------|
| 1 | `client/src/lib/prebuiltTemplates.ts` | UI identity — title, icon, description, starter text, draft questions, category | `PrebuiltTemplate` |
| 2 | `client/src/lib/appWorkspaceConfig.ts` | Workspace behavior — layout, panel tabs, writer mode, auto-start interview | `AppFlowConfig` |
| 3 | `server/context-builder.ts` | LLM guidance — system prompt, output format, feedback tone, document type | `AppTypeConfig` |

**Type enforcement:**
- `templateIds` in `shared/schema.ts` is the single source of truth (`as const` array)
- `TemplateId` type is derived from it
- `APP_CONFIGS` is `Record<TemplateId, AppFlowConfig>` — missing entry = build error
- `APP_TYPE_CONFIGS` is `Record<TemplateId, AppTypeConfig>` — missing entry = build error
- All `appType` fields in Zod request schemas use `z.enum(templateIds)` — invalid IDs are rejected at API validation
- Template IDs must be lowercase kebab-case (e.g. `"my-new-app"`)

## Key Shared Components

### NotebookWorkspace.tsx (Primary Orchestrator)
The main interface. Unified 3-panel resizable layout:
- **Left panel**: ContextSidebar (document/folder tree, pin, search) + ChatDrawer (user-to-user messaging)
- **Center panel**: SplitDocumentEditor (multi-tab document + chart editing) + objective input
- **Right panel**: Research (streaming AI chat) | Notes (captured context + voice transcripts) | Provo (persona discussion) | Generate (document generation)
- **State**: document, objective, personas, capturedContext, pinnedDocIds, discussionMessages, versions, editHistory
- **Mobile**: Falls back to tabbed single-panel layout

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

## Routing (`App.tsx`)

| Route | Component | Purpose |
|-------|-----------|---------|
| `/` | `NotebookWorkspace` | Default home — notebook 3-panel layout |
| `/app/:templateId` | `NotebookWorkspace` | Template-specific workspace |
| `/flow` | `FlowWorkspace` | Flow Canvas workspace |
| `/store` | `ContextStore` | Standalone Context Store page |
| `/admin` | `Admin` | Admin analytics dashboard |
| `/pricing` | `Pricing` | Pricing page |

## State Management

- Local state in NotebookWorkspace.tsx for app-wide concerns
- React Query for server state caching
- Context pinning: `pinnedDocIds` (Set) + `pinnedDocContents` (cache) in NotebookWorkspace
- Captured context: `capturedContext` (ContextItem[]) passed to all LLM calls
- No Redux/Zustand — keep it simple

## Database Tables (`shared/models/chat.ts`)

| Table | Purpose |
|-------|---------|
| `connections` | User-to-user connections (pending/accepted/blocked) |
| `conversations` | Chat conversations between users |
| `messages` | Individual chat messages |
| `chatPreferences` | User chat settings |
| `payments` | Stripe payment records |

## Data Flow

```
User Input (text/voice)
    ↓
ProvokeText (browser-native voice → transcript)
    ↓
Context Builder (instruction classification, speech cleanup, app-specific system prompt)
    ↓
LLM Gateway (logging, cost estimation, timing)
    ↓
LLM Provider (OpenAI / Anthropic / Gemini)
    ↓
Response → Document Evolution / Challenge Generation / Research Results
    ↓
Encrypted Storage (AES-256-GCM, per-field salt+IV)
```
