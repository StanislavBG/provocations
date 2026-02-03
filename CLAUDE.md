# CLAUDE.md - Provocations Project Guide

## Project Overview

**Provocations** is an AI-powered cognitive enhancement tool designed to challenge users and strengthen critical thinking. Rather than acting as a traditional AI assistant, it serves as "cognitive musculature" that generates multiple perspectives (lenses) and thought-provoking challenges (provocations) on input text.

**Core Philosophy**: "Would you rather have a tool that thinks for you, or a tool that makes you think?"

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
│   ├── storage.ts           # In-memory document storage
│   └── replit_integrations/ # Chat, audio, image APIs
├── shared/
│   ├── schema.ts            # Zod schemas & types
│   └── models/chat.ts       # Drizzle ORM models
└── script/build.ts          # Build configuration
```

## Path Aliases

Configured in `tsconfig.json`:
- `@/*` → `./client/src/*`
- `@shared/*` → `./shared/*`

## API Endpoints

### Core Analysis
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/analyze` | POST | Generate lenses & provocations from text |
| `/api/expand` | POST | AI-expand outline headings |
| `/api/refine` | POST | Adjust tone & length of text |
| `/api/merge` | POST | Merge voice feedback into document |
| `/api/edit-text` | POST | Edit selected text with instructions |

### Request/Response Schemas

All API schemas are defined in `shared/schema.ts` and validated with Zod on both frontend and backend.

**Analyze Request**:
```typescript
{ text: string, selectedLenses?: LensType[] }
```

**Expand Request**:
```typescript
{ heading: string, context?: string, tone?: ToneOption }
```

**Refine Request**:
```typescript
{ text: string, tone: ToneOption, targetLength: "shorter" | "same" | "longer" }
```

**Merge Request**:
```typescript
{ originalText: string, userFeedback: string, provocationContext?: string }
```

**Edit Text Request**:
```typescript
{ instruction: string, selectedText: string, fullDocument: string }
```

## Domain Concepts

### Lens Types (6 perspectives)
- `consumer` - End-user/customer viewpoint
- `executive` - Strategic leadership view
- `technical` - Implementation constraints
- `financial` - Cost/ROI analysis
- `strategic` - Competitive positioning
- `skeptic` - Critical assumptions challenge

### Provocation Types (3 categories)
- `opportunity` - Growth/innovation gaps
- `fallacy` - Logical errors & weak arguments
- `alternative` - Different perspectives

### Tone Options
- `inspirational`, `practical`, `analytical`, `persuasive`, `cautious`

## Key Components

### Workspace.tsx (Main Orchestrator)
Central component managing all app state and phases:
- **Phases**: `input` → `blank-document` → `workspace`
- **State**: documents, lenses, provocations, outline, versions
- **Versioning**: Full document history with diff comparison

### ReadingPane.tsx
Displays document with:
- Editable mode (pencil toggle)
- Text selection for voice/edit actions
- Download functionality

### ProvocationsDisplay.tsx
Shows AI-generated challenges with:
- Voice recording on cards
- Status tracking (pending, addressed, rejected, highlighted)

### VoiceRecorder.tsx
Web Speech API integration for:
- Voice feedback recording
- Auto-transcription
- Document merge functionality

## Design System

### Theme
- **Primary**: Warm amber (#B35C1E)
- **Accent**: Thoughtful blue (200°, 60%, 45%)
- **Aesthetic**: Aged paper/ink, intellectual warmth
- **Mode**: Dark mode supported (class-based)

### Fonts
- **Body**: Source Serif 4
- **Headings**: Libre Baskerville
- **Code**: JetBrains Mono

### Components
47 shadcn/ui components available in `client/src/components/ui/`

## Environment Variables

| Variable | Description |
|----------|-------------|
| `AI_INTEGRATIONS_OPENAI_API_KEY` | OpenAI API key |
| `AI_INTEGRATIONS_OPENAI_BASE_URL` | OpenAI API base URL |
| `DATABASE_URL` | PostgreSQL connection string |

## Key Design Principles

1. **No Chat Box**: Interface avoids chat-centric design
2. **Productive Resistance**: Tool challenges rather than assists blindly
3. **Material Engagement**: User remains primary author
4. **Session-based**: No persistent document storage (in-memory only)

## User Flow

1. **Input Phase** - Paste source material (transcripts, reports, notes)
2. **Analysis Phase** - View generated lenses and provocations
3. **Reading Phase** - Deep reading with lens-filtered perspective
4. **Outline Phase** - Build argument structure manually
5. **Refinement Phase** - Adjust tone and length of content

## Development Notes

### Adding New Components
Use shadcn/ui CLI or manually add to `client/src/components/ui/`

### Adding New API Routes
1. Define Zod schema in `shared/schema.ts`
2. Add endpoint in `server/routes.ts`
3. Use schema validation with `safeParse()`

### State Management
- Local state in Workspace.tsx for app-wide concerns
- React Query for server state caching
- No Redux/Zustand - keep it simple

### Error Handling
- Zod validation on all API inputs
- Defensive null-checks in components
- Toast notifications for user feedback

## Not Yet Implemented

- Testing framework (Jest/Vitest)
- CI/CD pipeline
- Structured logging
- Authentication integration (Passport configured but unused)
- Document persistence to database
