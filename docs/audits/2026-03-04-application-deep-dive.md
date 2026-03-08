# Provocations: Application Deep Dive

*A comprehensive product and architectural analysis*

---

## 1. Application Overview and Core Functionality

**Provocations** is an AI-augmented document workspace where ideas are not written *by* AI, but forged *through* AI-driven intellectual friction. It is a web-based platform built on React, Express, and PostgreSQL that reimagines document creation as a dialogue between the author and a panel of 14 expert AI personas — each challenging the author's thinking from a distinct professional perspective.

At its simplest, Provocations is a document editor with a twist: instead of autocomplete or AI ghostwriting, it deploys a team of virtual critics (an Architect, a CEO, a QA Engineer, a Security Engineer, a Brand Strategist, and more) who read your draft and generate *provocations* — pointed challenges that expose gaps, untested assumptions, and blind spots. The user responds via text or voice, and the AI intelligently weaves those responses back into the evolving document.

The platform supports 12+ specialized application modes (prompt writing, product requirements, app specs, persona definitions, voice capture, screen capture analysis, email composition, visual diagramming, and more), each with tailored LLM system prompts, workspace layouts, and feedback tones. Despite this breadth, the core interaction loop is consistent: **Input → AI Analyzes → Provocations → User Responds → Document Evolves → Repeat**.

The primary user interaction is a resizable 3-panel workspace:
- **Left panel**: Context management (document tree, pinned references, user-to-user messaging)
- **Center panel**: The document editor with smart action buttons (Expand, Condense, Restructure, Clarify, Style, Correct)
- **Right panel**: Research chat, notes capture, persona discussion threads, and content generation

Users arrive with rough ideas — fragments, bullet points, spoken thoughts — and leave with polished, deeply considered documents. The AI never writes the final product; it makes the *author* write better by systematically surfacing what they haven't thought through.

---

## 2. Jobs to Be Done (JTBD)

### Job 1: The Knowledge Worker Who Needs to Think Rigorously

**Situation**: A product manager is drafting a PRD for a new feature. They have the basic idea clear but know from experience that the first draft always misses edge cases, security implications, scalability concerns, and UX pitfalls.

**Motivation**: They want a systematic way to stress-test their thinking without waiting for a formal review cycle or scheduling meetings with five different specialists.

**Desired outcome**: A document that has already been challenged from the perspectives of an architect, QA engineer, security engineer, UX designer, and CEO — so that by the time it reaches human reviewers, the obvious gaps are already addressed.

**How Provocations serves this job**: The user selects relevant personas (Architect, QA Engineer, Security Engineer, etc.), generates challenges, and addresses each one. The document evolves through multiple rounds until every persona's concerns are satisfied. The separation of *challenge* and *advice* (never combined in a single invocation) ensures the user does the intellectual work of responding rather than passively accepting AI suggestions.

### Job 2: The Creator Who Thinks Better by Talking

**Situation**: A founder has a vision for a new application but struggles to articulate it in writing. Their ideas flow naturally when speaking but collapse into vague notes when typed.

**Motivation**: They want to capture their spoken ideas in real-time and have them structured into a coherent document without losing their authentic voice.

**Desired outcome**: A well-organized app specification, business plan, or strategy document that faithfully represents what they said — cleaned of speech artifacts (um, uh, like, you know) and organized into logical sections.

**How Provocations serves this job**: The Voice Capture app uses browser-native Web Speech API for real-time transcription (no LLM cost for basic transcription), then uses the `/api/summarize-intent` endpoint to clean voice transcripts into clear intent. The "aggregate" writer mode appends new material and reorganizes under themes, preserving the speaker's voice while imposing structure. The ProvokeText component provides self-contained voice input across every text panel.

### Job 3: The Researcher Building Context for a Complex Decision

**Situation**: A strategist needs to compile research from multiple sources — documents, chat conversations, web content, YouTube videos — into a coherent understanding of a topic before making recommendations.

**Motivation**: They want a single workspace where research can be conducted, organized, annotated, and synthesized, rather than juggling browser tabs, note apps, and document editors.

**Desired outcome**: A curated context store of relevant materials, each annotated with why it matters, that feeds directly into document generation.

**How Provocations serves this job**: The Context Store provides an encrypted document/folder tree with pin, search, and inline editing. The Research Chat panel offers streaming AI conversations (SSE via `/api/chat/stream`) with Google Search grounding capability (Gemini). Users save findings directly to their context, and all pinned documents are automatically included in LLM calls, creating a feedback loop between research and document evolution.

### Job 4: The Team That Needs Multi-Perspective Review Without the Meetings

**Situation**: A cross-functional team needs to review a document from business, technology, and marketing angles, but scheduling a meeting with representatives from each department takes weeks.

**Motivation**: They want the intellectual rigor of a cross-functional review without the calendar coordination overhead.

**Desired outcome**: A document that has been challenged from 14 distinct professional perspectives, with each challenge tracked, addressed, or deliberately dismissed.

**How Provocations serves this job**: The persona hierarchy spans three domains — Business (Think Bigger, CEO, Product Manager), Technology (Architect, Data Architect, QA Engineer, UX Designer, Tech Writer, Security Engineer, Cybersecurity), and Marketing (Growth Strategist, Brand Strategist, Content Strategist). Each persona generates challenges independently. The ProvoThread component tracks challenge status (pending, addressed, rejected, highlighted) and provides accept/dismiss/respond actions. The multi-persona discussion endpoint (`/api/discussion/ask`) enables conversational dialogue with the full panel.

### Job 5: The Builder Who Needs Visual + Textual Planning

**Situation**: A developer or architect needs to plan a system that involves both prose documentation and visual diagrams — entity relationships, flowcharts, architecture diagrams.

**Motivation**: They want to sketch and describe systems in the same workspace, with voice commands for rapid diagramming.

**Desired outcome**: A complete specification with both textual documentation and visual diagrams, created in a single integrated environment.

**How Provocations serves this job**: The BS Chart application provides an infinite canvas for visual diagrams with drag-and-drop node placement (ERD, flowcharts, architecture diagrams) and natural language voice commands for chart operations (`useVoiceChartCommands` hook). The Flow Canvas workspace adds a visual workflow builder where data flows between nodes (Research, Interview, LLM text mods, Painter, Timeline, Context).

---

## 3. Core Purpose

Provocations exists to solve a fundamental problem in AI-assisted writing: **AI that writes for you makes you a worse thinker; AI that challenges your thinking makes you a better writer.**

The application is built on the conviction that the most valuable role AI can play in document creation is not authorship but *intellectual provocation*. When a language model writes a paragraph for you, you learn nothing. When it points out that your product requirement has no error handling strategy, no scalability plan, and no consideration of accessibility — and then *you* have to address each of those gaps — the resulting document isn't just better, *you* are better.

The core purpose is to **systematize the kind of rigorous, multi-perspective thinking that usually only happens in the best review meetings** — and make it available to a solo author at any time, for any document, across any domain. It turns document creation from a solitary act of writing into a structured dialogue with expert perspectives.

This is captured in the project's guiding question: *"Would you rather have a tool that thinks for you, or a tool that makes you think?"*

---

## 4. Value Proposition

### For Whom

Knowledge workers who create consequential documents — product managers writing PRDs, founders drafting application specs, researchers synthesizing findings, engineers writing architecture docs, marketers developing strategies, anyone whose written output shapes decisions.

### What Problem It Solves

Traditional AI writing tools create a dependency trap: the more the AI writes, the less the author thinks. Meanwhile, thorough document review requires either expensive human expert time or waiting for feedback cycles. The gap between "I have an idea" and "I have a document that has been rigorously challenged from every relevant perspective" is where most documents lose quality.

### The Solution

Provocations bridges this gap with a structured provocation-response loop:
1. You write (or speak) your ideas
2. AI personas challenge your thinking from 14 expert perspectives
3. You respond to each challenge, deepening your document
4. The AI weaves your responses into the evolving document
5. You repeat until every angle is covered

### Key Benefits

- **Deeper thinking, not faster typing**: Documents that have survived multi-perspective scrutiny
- **Voice-first ideation**: Think out loud, let the AI structure it (browser-native, zero LLM cost for transcription)
- **Zero-knowledge privacy**: All user text encrypted at rest with AES-256-GCM; the server cannot read your content
- **Multi-provider flexibility**: Works across OpenAI, Anthropic, and Gemini; no vendor lock-in
- **Pre-call cost transparency**: Every AI button shows estimated tokens and cost *before* you click
- **12+ specialized modes**: Each application type (prompts, PRDs, app specs, personas, emails, etc.) has its own tailored AI guidance, not generic prompts

### What Makes It Unique

1. **Challenge-Advice Separation**: Challenges and advice are generated through separate LLM invocations. Challenges surface problems *without* offering solutions, forcing the user to think before asking for help. This is an architectural decision, not a UI choice — the system prompt explicitly instructs: "Do NOT provide advice or solutions."

2. **The Persona Hierarchy**: 14 personas organized under a Master Researcher root, spanning business, technology, and marketing domains. Each persona has distinct challenge and advice prompts, non-negotiable behaviors, and a 7-day freshness governance cycle.

3. **ProvokeText Everywhere**: An architectural decision record (ADR) mandates that every text surface in the application uses the `ProvokeText` component — ensuring consistent voice input, copy, smart processing, and styling across the entire product. No raw `<div>`, `<p>`, or `<textarea>` for user-facing text.

4. **The Document Doesn't Write Itself**: Unlike competitors where AI generates content, Provocations' AI generates *friction*. The document evolves through the user's responses to that friction.

---

## 5. Key Components and Architecture (High-Level)

### Frontend Architecture

| Component | Technology | Purpose |
|-----------|-----------|---------|
| **UI Framework** | React 18 + TypeScript 5.6 | Component-based SPA with strict type safety |
| **Build Tool** | Vite 7 | Hot Module Replacement for development |
| **Styling** | Tailwind CSS 3.4 + shadcn/ui (47 components) | Consistent design system with Radix-based primitives |
| **State** | React Query (TanStack) + React hooks | Server state caching + local state; no Redux/Zustand |
| **Routing** | Wouter | Lightweight client-side routing |
| **Auth** | Clerk | Authentication, user ownership, admin role detection |
| **Voice** | Web Speech API + custom audio worklets | Browser-native transcription (no LLM cost) |

### Backend Architecture

| Component | Technology | Purpose |
|-----------|-----------|---------|
| **API Server** | Express 5.0 | RESTful endpoints with Zod validation on all inputs |
| **LLM Layer** | Configurable: OpenAI / Anthropic / Gemini | Multi-provider abstraction via `server/llm.ts` |
| **LLM Gateway** | `server/llm-gateway.ts` | Call logging, cost estimation, timing, verbose metadata (no user text stored) |
| **Context Builder** | `server/context-builder.ts` | Unified prompt assembly: instruction classification, speech artifact detection, per-app system guidance |
| **Database** | PostgreSQL via Drizzle ORM | Persistent storage with schema managed by dual systems (Drizzle + ensureTables) |
| **Encryption** | AES-256-GCM via `server/crypto.ts` | Zero-knowledge encryption with PBKDF2 key derivation (100K iterations), LRU key cache |
| **Validation** | Zod schemas (`shared/schema.ts`) | Shared between frontend and backend; `templateIds` as const enforces type safety across all three app definition layers |

### Core Interaction Components

| Component | File | Role |
|-----------|------|------|
| **NotebookWorkspace** | `pages/NotebookWorkspace.tsx` | Primary 3-panel orchestrator: state management for document, objective, personas, context, versions, edit history |
| **SplitDocumentEditor** | `notebook/SplitDocumentEditor.tsx` | Multi-tab document editor with 7 smart action buttons (Expand, Condense, Restructure, Clarify, Style, Correct, General) |
| **ProvoThread** | `notebook/ProvoThread.tsx` | Multi-persona discussion thread: challenge display, accept/dismiss/respond, advice generation |
| **NotebookResearchChat** | `notebook/NotebookResearchChat.tsx` | Streaming research chat via SSE (`/api/chat/stream`) |
| **TranscriptPanel** | `notebook/TranscriptPanel.tsx` | Notes management: text/voice capture, save to Context Store, evolve document |
| **ContextSidebar** | `notebook/ContextSidebar.tsx` | Encrypted document/folder tree with pin, search, inline rename/delete |
| **ProvokeText** | `components/ProvokeText.tsx` | ADR-mandated universal text component: copy, voice, smart processing, consistent styling |
| **LlmHoverButton** | `components/LlmHoverButton.tsx` | Pre-call transparency: hover any AI button to see estimated tokens, cost, and context breakdown |

### Flow Canvas Architecture

| Component | File | Role |
|-----------|------|------|
| **FlowWorkspace** | `pages/FlowWorkspace.tsx` | Orchestrator: dock config, tool handlers, overlays, state wiring |
| **FlowCanvas** | `flow/FlowCanvas.tsx` | Infinite canvas: viewport transform, node rendering, edge layer, drag-drop |
| **useFlowCanvas** | `flow/useFlowCanvas.ts` | State hook: FlowNode, FlowEdge, FlowNodeType, dimensions, CRUD operations |
| **FlowEdgeLayer** | `flow/FlowEdgeLayer.tsx` | SVG edge rendering with smart endpoint selection for data flow visualization |

The Flow Canvas provides 6 node types (Context, Research, Interview, Text Mods/LLM, Painter, Timeline), each with compact (on-canvas) and full (overlay) views — a mandatory dual-view pattern.

### Data Flow

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

### Three-Layer Application Definition (Type-Enforced)

Every application template is defined across three files that must stay in sync, enforced by TypeScript's type system:

1. **`prebuiltTemplates.ts`** — UI identity: title, icon, description, starter text, draft questions, category
2. **`appWorkspaceConfig.ts`** — Workspace behavior: layout type, panel tabs, writer mode (edit/analyze/aggregate), auto-start interview
3. **`context-builder.ts`** — LLM guidance: system prompt, document type, feedback tone, output format

The `TemplateId` type (derived from `templateIds as const` in `shared/schema.ts`) enforces that all three layers have matching entries. Adding a new template ID without updating all three files produces a TypeScript build error — making "forgot to update one layer" impossible.

---

## 6. What Makes This App Special? (Unique Selling Points)

### 1. Adversarial AI by Design

Most AI writing tools are sycophantic — they agree with you, extend your thoughts, and generate more of what you've already said. Provocations is deliberately *adversarial*. The 14 personas are designed to find fault, expose gaps, and challenge assumptions. The system prompt for challenges explicitly prohibits offering solutions: the AI must provoke, not placate.

This is not a philosophical preference — it's an architectural constraint. Challenge and advice generation use separate API endpoints (`/api/generate-challenges` vs `/api/generate-advice`), separate LLM invocations, and separate system prompts. You cannot accidentally get advice when you asked for a challenge.

### 2. Hierarchical Persona Governance

The persona system isn't a flat list of AI characters. It's a governed hierarchy:
- **Master Researcher** (root) orchestrates all other personas
- **7-day freshness cycle**: Personas with `lastResearchedAt` older than 7 days are flagged stale
- **Domain completeness**: Every domain (business, technology, marketing) must have sufficient coverage
- **No overlap rule**: Each persona must challenge a distinct dimension
- **Human curation lock**: Personas can be locked by a human curator, preventing auto-modification
- **Computer-first filter**: Only knowledge worker roles where computer-based tasks are central qualify

This governance model means the persona system is self-improving — it systematically identifies gaps and proposes new perspectives.

### 3. Zero-Knowledge Document Encryption

Every user-provided text field — document content, document titles, folder names — is encrypted at rest with AES-256-GCM using PBKDF2 key derivation (100,000 iterations). Each encrypted field gets its own random salt and IV (independent key derivation per field). The server has "no right to read user content" — encryption and decryption happen at the route boundary, and the storage layer only handles opaque ciphertext.

The encryption implementation includes an LRU key cache (2,000 entries, ~112KB) to avoid re-deriving keys for repeated operations, and async PBKDF2 variants to prevent blocking the Node.js event loop.

### 4. Pre-Call Cost Transparency (LlmHoverButton)

Every AI-triggering button in the application is wrapped with `LlmHoverButton`, which shows a two-tab preview on hover:
- **Perf tab**: Context blocks (characters, tokens, percentage), stacked bar visualization, estimated cost, model info
- **Summary tab**: Human-readable breakdown of what the call will include

This means users know exactly what context, how many tokens, and what estimated cost each AI action involves *before* they click. This is the pre-call mirror of the post-call verbose metadata — one shows what *will* happen, the other shows what *did* happen.

### 5. Browser-First Voice Architecture

Voice capture uses browser-native Web Speech API for real-time transcription — zero LLM cost for basic transcription. The LLM is only invoked for post-processing (summarization, intent cleaning) after a transcript already exists. The `ProvokeText` component auto-enables self-contained voice mode on editable panels, providing microphone input across every text surface in the application.

Speech artifact detection (`isLikelyVoiceTranscript`) identifies transcripts by detecting patterns like "um", "uh", "like", "you know", "gonna", "wanna", word repetitions, and sentence-starting fillers — then routes them through cleanup before document integration.

### 6. Instruction Classification Engine

The `/api/write` endpoint doesn't just blindly apply user instructions. It first classifies the instruction into one of 7 types (expand, condense, restructure, clarify, style, correct, general) using regex pattern matching, then applies a type-specific strategy. This means "make it shorter" and "add more detail" are processed with fundamentally different LLM prompts, not a generic "edit this" instruction.

The classification feeds into the edit history (`EditHistoryEntry[]`), which is included in subsequent LLM calls as `RECENT EDIT HISTORY` — giving the AI context about the document's evolution trajectory and maintaining consistency across edits.

### 7. The ProvokeText ADR

The architectural decision to mandate `ProvokeText` for all text display is unusual and powerful. It means every text panel in the application — read-only summaries, editable textareas, document editors — automatically gets: copy functionality, voice input, smart processing (Clean/Summarize), word count, reading time, and consistent styling. This isn't a UI convention; it's an enforced architectural rule that prevents capability drift as the application grows.

### 8. Multi-Provider LLM Abstraction

The LLM layer supports OpenAI, Anthropic, and Gemini through a unified interface (`llm.generate()`, `llm.stream()`), with auto-detection based on available API keys. The chat model catalog is discovered from live APIs at startup, supporting model selection per request (`llm.generateWithModel()`, `llm.streamWithModel()`). Gemini-specific features like Google Search grounding are supported through the `enableSearch` flag. The cost table in `llm-gateway.ts` tracks per-model pricing for real-time cost estimation.

### 9. Dual-Schema Database Management

The database schema is managed by two independent systems that must stay in perfect sync: `ensureTables()` (raw SQL safety net at app startup) and Drizzle ORM (`drizzle-kit push` during deployment). This dual system ensures the app works even if `drizzle-kit push` was never run, while maintaining an authoritative schema definition. The project has extensive ADR documentation on the exact rules for keeping them synchronized (matching index names, constraint names, no FK references in ensureTables unless Drizzle defines them).

### 10. The Flow Canvas as Visual Thinking

The Flow Canvas (`/flow`) is not just a diagramming tool — it's a visual workflow builder where data flows between processing nodes. Each node type (Research, Interview, LLM, Painter, Timeline, Context) has both a compact canvas view and a full interactive overlay. Double-clicking a Research node opens a full research chat session; the findings flow downstream to connected nodes. This creates a spatial, visual metaphor for knowledge work that goes beyond linear document editing.

---

## Conclusion

Provocations represents a deliberate philosophical stance in the AI writing tools landscape: **the best AI assistant is one that makes you uncomfortable.** By systematically deploying 14 expert personas to challenge your thinking — rather than offering to write your document — it produces authors who are more rigorous, documents that are more thorough, and ideas that have been stress-tested from business, technology, and marketing perspectives.

The technical architecture supports this philosophy at every layer: separate endpoints for challenges and advice (preventing sycophantic shortcutting), a governed persona hierarchy with freshness cycles (ensuring perspectives stay relevant), zero-knowledge encryption (respecting user privacy), browser-native voice capture (making verbal ideation frictionless), pre-call cost transparency (empowering informed AI usage), and a type-enforced three-layer application definition (ensuring new application modes are complete and consistent).

The result is a platform that embodies a paradox: **the more the AI challenges you, the more the document becomes yours.** Every provocation you address, every gap you fill, every assumption you defend or abandon — that's your thinking, made visible and permanent. The AI provided the friction; you provided the insight.

---

*Analysis prepared: 2026-03-04*
*Codebase state: 12 application templates, 14 AI personas, 3 LLM providers, AES-256-GCM encryption, React 18 + Express 5 + PostgreSQL*
