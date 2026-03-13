# CLAUDE.md — Provocations Project Guide

## Project Identity

**Provocations** is an AI-augmented document workspace where ideas are not written *by* AI, but forged *through* AI-driven intellectual friction.

It deploys a team of 14 expert AI personas — an Architect, a CEO, a QA Engineer, a Security Engineer, a Brand Strategist, and more — who read your draft and generate *provocations*: pointed challenges that expose gaps, untested assumptions, and blind spots. You respond via text or voice, and the AI weaves those responses back into the evolving document.

**Core Philosophy**: *"Would you rather have a tool that thinks for you, or a tool that makes you think?"*

The AI doesn't write for you — it provokes deeper thinking so *you* write better. When a language model writes a paragraph for you, you learn nothing. When it points out that your product requirement has no error handling strategy, no scalability plan, and no consideration of accessibility — and *you* have to address each gap — the resulting document isn't just better, *you* are better.

### What This Tool IS and IS NOT

- **IS**: A structured provocation-response loop that systematizes multi-perspective thinking
- **IS**: A voice-first ideation tool where you think out loud and the AI structures it
- **IS**: A privacy-first workspace (zero-knowledge encryption at rest)
- **IS NOT**: An AI ghostwriter that produces content for passive consumption
- **IS NOT**: A chat interface — the document is the output, not the conversation
- **IS NOT**: A single-perspective autocomplete tool

### Who It's For

Knowledge workers who create consequential documents — product managers writing PRDs, founders drafting app specs, researchers synthesizing findings, engineers writing architecture docs, marketers developing strategies, anyone whose written output shapes decisions.

## Core Workflow

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

## Persona System

### 14 Expert Perspectives Across 3 Domains

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

### Governance Rules

1. **Freshness**: Personas refresh every 7 days. Stale personas (older than 7 days or null `lastResearchedAt`) are flagged for re-research.
2. **Domain completeness**: Every domain must have sufficient coverage for its core knowledge worker roles.
3. **No orphans**: Every persona (except root) must have a valid `parentId` and `domain`.
4. **Challenge ≠ Advice**: Separate prompts, separate invocations, never combined. Challenges surface problems without offering solutions, forcing the user to think.
5. **Non-negotiable behaviors**: Each persona defines explicit behaviors it always does and never does.
6. **Computer-first filter**: Only knowledge worker roles where computer-based tasks are central qualify.
7. **No overlap**: Each persona challenges a distinct dimension. Overlapping personas must be merged or removed.
8. **Structured definition**: Every persona must include: id, label, icon, role, description, color, prompts (challenge + advice), summary, domain, parentId, lastResearchedAt.

### Instruction Types (7 Classifications)

The write endpoint classifies instructions before processing:
- `expand` — Add depth, examples, supporting details
- `condense` — Remove redundancy, tighten prose
- `restructure` — Reorganize content, modify headings, reorder sections
- `clarify` — Simplify language, improve accessibility
- `style` — Adjust voice and tone
- `correct` — Fix grammar, spelling, logic errors
- `general` — Fallback for mixed instructions

**Tone options**: `inspirational`, `practical`, `analytical`, `persuasive`, `cautious`

## Architectural Principles

These are the core design decisions that shape the codebase. Each is documented in full in `docs/adrs.md`.

1. **Universal text component**: All user-facing text surfaces use ProvokeText — ensuring consistent voice input, copy, smart processing, and styling across the entire product. No raw HTML text elements.

2. **Pre-call cost transparency**: Every LLM-triggering button shows estimated tokens, context breakdown, and cost *before* the user clicks. Users make informed AI usage decisions.

3. **Three-layer application definition**: Each app is defined across UI identity, workspace behavior, and LLM guidance — enforced by TypeScript's type system. Missing any layer is a build error.

4. **Dual-schema database management**: Schema is managed by both Drizzle ORM and startup SQL safety net. Both must stay in perfect sync to prevent deployment migration drift.

5. **Zero-knowledge encryption**: All user text is encrypted at rest (AES-256-GCM) with per-field salt+IV. The server has no right to read user content.

6. **Flow Canvas dual-view pattern**: Every canvas node type has both a compact on-canvas view and a full interactive overlay opened by double-click.

7. **Adversarial AI by design**: Challenge and advice generation use separate endpoints, separate invocations, and separate system prompts. You cannot accidentally get advice when you asked for a challenge.

8. **Browser-first voice**: Voice capture uses browser-native Web Speech API — zero LLM cost for transcription. LLM calls are only for post-processing after a transcript exists.

## Critical Rules

1. **No OPENAI_API_KEY**: This project uses `GEMINI_API_KEY`. Never write code that depends on `OPENAI_API_KEY` being present.

2. **Browser-first for voice/media**: Use Web Speech API, MediaRecorder, Canvas before reaching for server-side APIs. Both desktop and mobile.

3. **Maintain the Component Wiki**: When creating or significantly changing a component, update `componentRegistry.ts`. See `docs/component-patterns.md`.

4. **Version bump on every commit**: Bump `APP_VERSION` in `version.ts`, add release note, include version in commit message. See `docs/development-guide.md`.

5. **Fix pre-existing TypeScript errors**: Every `npm run check` should leave the codebase cleaner. Don't ignore errors in files you didn't touch.

6. **AIQA workflow**: Claim items (`in_progress`) before coding. Batch-claim for parallel work. Resolve when done. Release if abandoned. Only pick up `open` items.

## Document Storage — Zero-Knowledge Encryption

- All user-provided text is encrypted at rest with AES-256-GCM (server-side)
- Document content, titles, and folder names: each encrypted with independent salt + IV
- Legacy plaintext fallback for backward compatibility
- Ownership verified via Clerk userId
- The server has no right to read user content

## Documentation Map

| Document | When to read |
|----------|-------------|
| `docs/architecture.md` | Understanding the codebase, directory structure, tech stack, data flow |
| `docs/adrs.md` | Making architectural decisions, full ADR implementation details |
| `docs/api-reference.md` | Adding or modifying API endpoints |
| `docs/development-guide.md` | Day-to-day development, env setup, commands, versioning, AIQA |
| `docs/flow-canvas.md` | Working on the Flow Canvas subsystem |
| `docs/component-patterns.md` | Building UI components, design system, ProvokeText/LlmHoverButton usage |
| `replit.md` | Deploying to Replit |
| `apps/<templateId>/CLAUDE.md` | Working on a specific application template |

## Application Map

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
| `product-owner` | Product Owner Agent | build | standard | edit |
| `query-editor` | Query Editor | analyze | external | — |

Per-app documentation: `apps/<templateId>/CLAUDE.md`. See `docs/architecture.md` for the three-layer pattern.

<!-- BSOffice Integration -->
## BSOffice Integration

This project is registered as room `stan-provo` in the BSOffice management platform.

### Requesting Tool Permissions

If you need a tool permission you don't have (e.g., `WebFetch`, `Bash(curl:*)`, MCP tools), you can request it from Sam (SVP of Engineering) via the BSOffice API. **Do NOT ask the user to approve permissions manually.**

```
POST http://localhost:3000/api/security/permission-requests
Content-Type: application/json

{
  "roomId": "stan-provo",
  "projectPath": "/home/derrickellis/stan-provo",
  "tools": ["ToolName1", "ToolName2"],
  "reason": "Brief explanation of why you need these tools",
  "requestedBy": "stan-provo"
}
```

### SME Consult — Request Expert Analysis

You can request expert analysis from BSOffice's SME (Subject Matter Expert) system. SME sessions are independent Claude instances with domain-specific prompts that analyze your question and deliver a structured report to `tasks/stan-provo/`.

```
POST http://localhost:3000/api/rooms/stan-provo/sme
Content-Type: application/json

{
  "domain": "ux-research",
  "prompt": "Evaluate the Flow Canvas dual-view interaction pattern for usability",
  "context": "Optional additional context"
}
```

**Available domains:** `security-audit`, `performance-analysis`, `architecture-review`, `code-review`, `documentation`, `cost-analysis`, `ux-research`, `market-research`

**Check result status:**
```
GET http://localhost:3000/api/sme/requests/{request-id}
```

**List available domains:**
```
GET http://localhost:3000/api/sme/domains
```

Results are delivered as markdown files in `tasks/stan-provo/` and can also be retrieved via the status endpoint.

### Other BSOffice APIs

- **Room status:** `GET http://localhost:3000/api/rooms/stan-provo`
- **Chat history:** `GET http://localhost:3000/api/chat/history/stan-provo`
- **Voice status:** `GET http://localhost:3000/api/voice/status`
<!-- BSOffice Integration -->
