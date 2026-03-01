# Provo (Provocations) — Mini Application CLAUDE.md

## Identity

**Name**: Provo (Provocations)
**Category**: Standalone mini-application (right panel tab)
**Philosophy**: Provocations are **challenges from expert personas** that identify gaps, weaknesses, and assumptions in the user's document. Each persona reads the document through the lens of their expertise and generates pointed, grounded challenges. The user responds, accepts advice, or dismisses — and the cycle drives document improvement.

**Core Principle**: "Would you rather have a tool that thinks for you, or a tool that makes you think?"

**Separation**: Provo is a self-contained LLM flow. It is NOT connected to the Interview (conversational Q&A), Writer (document editing), or Painter (image generation). Those are separate mini-applications with their own prompts, configs, and UI. Provo's only integration point is sending accepted advice or responses to the Notes panel via `onCaptureToContext`.

---

## How Provocations Work

```
┌─────────────────────────────────────────────────────┐
│  SELECT PERSONAS  →  GENERATE PROVOCATIONS          │
│        ▲                         │                  │
│        │                         ▼                  │
│  ITERATE ◄── USER: Accept / Respond / Dismiss       │
│                                  │                  │
│                                  ▼                  │
│              ADVICE (per challenge, on demand)       │
│                                  │                  │
│                                  ▼                  │
│              SEND TO NOTES → EVOLVE DOCUMENT        │
└─────────────────────────────────────────────────────┘
```

1. **Select personas** — Toggle 1-14 expert personas via PersonaAvatarRow
2. **Generate** — Each persona reads the document + objective and generates grounded challenges
3. **Review** — Challenges appear as cards with persona badge, title, content, and source excerpt
4. **Per-challenge actions**:
   - **Request Advice**: Ask the same persona for concrete, actionable advice on this challenge
   - **Respond**: Write your own response to the challenge (text or voice)
   - **Dismiss**: Remove the challenge from view
   - **Accept Advice → Notes**: Send the advice to the Notes panel for later use
   - **Send Response → Notes**: Send your response to Notes

---

## Three-Layer Definition

### Layer 1: UI Component — `ProvoThread.tsx`

**File**: `client/src/components/notebook/ProvoThread.tsx`
**Location**: Right panel "Provo" tab in `NotebookRightPanel.tsx`

#### Props

| Prop | Type | Description |
|------|------|-------------|
| `documentText` | `string` | Current document content for grounding challenges |
| `objective` | `string` | Workspace objective (optional — LLM infers if missing) |
| `activePersonas` | `Set<ProvocationType>` | Which personas are selected for challenge generation |
| `onTogglePersona` | `(id) => void` | Toggle a persona on/off |
| `onCaptureToContext` | `(text, label) => void` | Send accepted advice or responses to Notes |
| `hasDocument` | `boolean` | Whether document text OR pinned context exists |
| `pinnedDocContents` | `Record<number, {title, content}>?` | Active Context documents (included in challenges when main doc is sparse) |

#### Internal State

| State | Type | Purpose |
|-------|------|---------|
| `challenges` | `Challenge[]` | Generated challenges from personas |
| `adviceStates` | `Record<string, AdviceState>` | Per-challenge advice (loading, content, accepted) |
| `respondingTo` | `string \| null` | Which challenge the user is responding to |
| `responseText` | `string` | User's response being typed |
| `responses` | `Record<string, string>` | Submitted responses keyed by challenge ID |
| `dismissedIds` | `Set<string>` | Challenges the user has dismissed |

#### UI Structure

- **PersonaAvatarRow**: Toggle row of 14 persona avatars (compact mode)
- **Generate Provocations button**: Wrapped with `LlmHoverButton` for pre-call transparency
  - Shows context blocks (system prompt, document, objective, persona IDs)
  - Shows summary items (active persona count, document word count, objective)
- **Challenge cards** (per challenge):
  - Persona badge with label
  - Title (punchy headline)
  - Content (2-3 sentence challenge)
  - Source excerpt quote
  - Scale indicator (1-5 impact)
  - Action buttons: Advise, Respond, Dismiss
- **Advice panel** (shown when requested):
  - Loading indicator
  - Advice content
  - Accept → Notes button
- **Response input** (shown when responding):
  - ProvokeText with voice support
  - Submit / Cancel
  - Send to Notes button (after submitted)

### Layer 2: API Endpoints

#### `POST /api/generate-challenges`

Generates grounded challenges from selected personas.

**Request** (`generateChallengeRequestSchema`):
```typescript
{
  document: string,                    // required — min 1 char
  objective?: string,                  // optional — LLM infers if missing
  personaIds?: string[],               // filter to specific personas; empty = all
  guidance?: string,                   // user focus area
  referenceDocuments?: ReferenceDoc[], // style/template docs for comparison
  appType?: TemplateId,                // app-specific context
}
```

**Response**:
```typescript
{
  challenges: Challenge[]
  // Each: { id, title, content, sourceExcerpt, scale, persona: { id, label, icon, color } }
}
```

**LLM System Prompt Structure**:
```
[App-specific context]

You are a critical thinking partner. Your job is to CHALLENGE the user's
document — identify gaps, weaknesses, and assumptions.

DOCUMENT OBJECTIVE: {objective or "infer from content"}

Generate challenges from these personas:
{persona ID + label + challenge prompt for each}

{Reference documents if any}
{User guidance if any}
{Master Researcher lock guardrail if applicable}

JSON format: "challenges" array with per-challenge fields:
- personaId, title (max 60 chars), content (2-3 sentences),
  sourceExcerpt (verbatim quote), scale (1-5)

GROUNDING RULES:
- Every challenge MUST reference a specific part of the document
- Generic questions are NOT acceptable
- sourceExcerpt must be a real quote from the document
```

**Key behaviors**:
- Generates `ceil(6 / personaCount)` challenges per persona (minimum 2)
- Every challenge must cite a verbatim `sourceExcerpt` from the document
- Challenges identify problems without offering solutions (advice is separate)
- When pinned context docs exist, they're appended as "ACTIVE CONTEXT" sections

#### `POST /api/generate-advice`

Generates advice for a specific challenge from the same persona.

**Request** (`generateAdviceRequestSchema`):
```typescript
{
  document: string,
  objective?: string,
  appType?: TemplateId,
  challengeId: string,
  challengeTitle: string,
  challengeContent: string,
  personaId: string,
  discussionHistory?: DiscussionMessage[],
}
```

**Response**: `{ advice: { id, content, personaId } }`

**System prompt rules**:
1. Start from the PROVOCATION — directly address the specific gap
2. Reference the CURRENT DOCUMENT — point to specific sections
3. Serve the OBJECTIVE — explain how resolving this advances the goal
4. Build on DISCUSSION HISTORY — don't repeat what's already covered
5. Be concrete and actionable
6. Be different from the provocation — provide the solution, not restate the problem
7. Speak from the persona's expertise

### Layer 3: Schema Definitions

**File**: `shared/schema.ts`

```typescript
// Challenge — a single provocation from a persona
challengeSchema = z.object({
  id: z.string(),
  title: z.string(),
  content: z.string(),
  sourceExcerpt: z.string(),
  scale: z.number(),
  persona: z.object({
    id: z.string(),
    label: z.string(),
    icon: z.string(),
    color: personaColorSchema,
  }),
});

// Advice — actionable guidance for a specific challenge
adviceSchema = z.object({
  id: z.string(),
  content: z.string(),
  personaId: z.string(),
});
```

---

## Persona Hierarchy (14 Built-in)

| ID | Domain | Label | Challenge Focus |
|----|--------|-------|----------------|
| `thinking_bigger` | business | Think Bigger | Scale impact, retention, cost-to-serve |
| `ceo` | business | CEO | Mission alignment, accountability, trust |
| `product_manager` | business | Product Manager | Business value, user stories, success metrics |
| `architect` | technology | Architect | System boundaries, APIs, data flow |
| `data_architect` | technology | Data Architect | Data fitness, Key Ring identifiers, governance |
| `quality_engineer` | technology | QA Engineer | Edge cases, error handling, reliability |
| `ux_designer` | technology | UX Designer | User flows, discoverability, accessibility |
| `tech_writer` | technology | Tech Writer | Clarity, naming, missing context |
| `security_engineer` | technology | Security Engineer | Auth, data privacy, compliance |
| `cybersecurity_engineer` | technology | Cybersecurity | Threat modeling, attack surface |
| `growth_strategist` | marketing | Growth Strategist | Acquisition, activation, retention |
| `brand_strategist` | marketing | Brand Strategist | Positioning, differentiation, voice |
| `content_strategist` | marketing | Content Strategist | Audience-channel fit, distribution |

Each persona has separate `challenge` and `advice` prompts. Challenges identify gaps without solutions. Advice is requested separately and provides concrete, actionable guidance.

---

## Key Behaviors

1. **Challenge ≠ Advice**: These are always separate LLM calls. Challenges never include solutions.
2. **Grounded challenges**: Every challenge must reference a specific document section or omission — no generic critiques.
3. **Verbatim source excerpts**: Each challenge includes an exact quote from the document for traceability.
4. **Persona rotation**: Multiple challenges distribute across selected personas.
5. **Active Context inclusion**: When main document is empty but pinned context docs exist, those docs are sent as the challenge material.
6. **Objective optional**: When no objective is set, the LLM infers the document's purpose from its content.
7. **LLM pre-call transparency**: Generate button shows context blocks, token estimates, and cost via `LlmHoverButton`.
8. **Notes integration**: Accepted advice and user responses are sent to the Notes panel, not directly into the document.
9. **Master Researcher guardrail**: When the master_researcher persona is active, human-curated personas are protected from redefinition.
