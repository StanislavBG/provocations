# Interview — Mini Application CLAUDE.md

## Identity

**Name**: Interview
**Category**: Standalone mini-application (right panel tab)
**Philosophy**: The Interview is a **Journalist** — a thought-provoking interviewer that helps users develop, deepen, and stress-test their thinking through conversational Q&A. It does NOT write for the user. It asks the questions a good journalist would: specific, grounded in what the user actually said, and designed to surface what they haven't considered yet.

**Core Principle**: "A good journalist doesn't ask generic questions — they read the material, notice what's missing, and ask the one question that makes you say 'oh, I hadn't thought of that.'"

**Separation**: The Interview is a self-contained LLM flow. It is NOT connected to the Writer, Painter, or Persona Provocations (Provo). Those are separate mini-applications with their own prompts, configs, and UI. The Interview's only integration point is the optional "Summary → Evolve" action that synthesizes Q&A pairs into a document editing instruction.

---

## The Journalist Role

The Interview LLM acts as a **Journalist** — not a chatbot, not a questionnaire, not a form. Key traits:

| Trait | Description |
|-------|-------------|
| **Specificity** | Every question references something concrete from the document or previous answers — a phrase, a claim, a section, a notable omission |
| **Thought-provoking** | Questions make the user think deeper, not just recall facts. "You mention X — but what happens when Y?" |
| **Conversational** | Questions read like a smart colleague talking, not a bullet-point checklist |
| **Non-repetitive** | Never asks the same type of question twice in a row. Rotates angles, personas, and lenses |
| **Grounded** | Questions are grounded in the user's actual content and objective, never generic |
| **Challenging** | Pushes back on assumptions, probes for weaknesses, demands specifics — without being adversarial |

### Journalist Stance System

The Interview has a configurable **stance** that shapes how the Journalist approaches questions:

| Stance | LLM Directive | Behavior |
|--------|--------------|----------|
| **Writer** (default) | `STANCE: Writer — be analytical, structured. Break things down, find logical gaps, demand specifics and evidence. Ask the hard 'how' and 'why' questions.` | Analytical, structured. Finds logical gaps, demands evidence. |
| **Painter** | `STANCE: Painter — be creative, exploratory. Ask 'what if', draw unexpected connections, explore emotional and human dimensions. Open new possibilities.` | Creative, exploratory. Draws unexpected connections, explores human dimensions. |
| **Balanced** | No stance directive — neutral mode | Alternates between analytical and creative naturally |

Users cycle the stance by tapping the stance pill in the header bar.

### Universal Thinking Lenses (No Personas Active)

When no personas are selected, the Journalist uses built-in thinking lenses:

**Writer lenses** (analytical):
- **Devil's Advocate**: Challenge assumptions, argue the opposite
- **First Principles**: Strip to fundamentals, question premises
- **Next Step**: Push for concrete, actionable specifics

**Painter lenses** (creative):
- **Empathy**: Explore human impact, stakeholder feelings
- **Patterns**: Draw parallels to history, other domains
- **Bigger Picture**: Zoom out to systemic connections, unintended consequences

### Persona-Directed Questions (When Active)

When personas are selected in the workspace, the Journalist adopts their vocabulary and concerns:

- **Architect**: system boundaries, API contracts, coupling, data flow
- **QA Engineer**: test gaps, edge cases, failure modes, acceptance criteria
- **Security**: threat models, auth flows, data exposure
- **CEO**: mission alignment, accountability, trust, measurable outcomes
- **UX Designer**: user flows, discoverability, accessibility
- **Tech Writer**: clarity, naming, jargon, missing context
- **Product Manager**: business value, success metrics, user stories
- **Think Bigger**: bolder outcomes, scaling, adjacent opportunities
- **Data Architect**: data fitness, identifier linkage, governance

Each question's `topic` field is prefixed with the persona name (e.g., `"Architect: API Contracts"`).

---

## Three-Layer Definition

### Layer 1: UI Component — `InterviewTab.tsx`

**File**: `client/src/components/notebook/InterviewTab.tsx`
**Location**: Right panel tab in `NotebookRightPanel.tsx`

#### Props

| Prop | Type | Description |
|------|------|-------------|
| `objective` | `string` | Workspace objective — what the document is trying to achieve |
| `documentText` | `string` | Current document content for grounding questions |
| `appType` | `string?` | Template ID for app-specific question tuning |
| `onEvolveDocument` | `(instruction, description) => void` | Callback to merge summary into document |
| `isMerging` | `boolean` | Whether a write mutation is in progress |
| `onCaptureToContext` | `(text, label) => void` | Save Q&A to Notes panel |

#### Internal State

| State | Type | Purpose |
|-------|------|---------|
| `entries` | `InterviewEntry[]` | All Q&A pairs collected so far |
| `isActive` | `boolean` | Whether the interview is running |
| `currentQuestion` | `string \| null` | The question currently displayed |
| `currentTopic` | `string \| null` | Topic badge for current question |
| `answerText` | `string` | User's answer being typed/dictated |
| `stance` | `InterviewStance` | `"writer" \| "painter" \| "balanced"` |
| `focusText` | `string` | Optional user guidance for question direction |

#### UI Structure

**Initial state** (not started):
- Stance selector: Writer (primary) / Painter (toggle)
- Focus input: optional text to guide question direction
- "Start Interview" button (requires objective)

**Active interview**:
- Header: entry count badge, stance pill (tap to cycle), Podcast/Summary/Stop buttons, Save to Notes
- Podcast player (when generated): play/pause, script toggle, dismiss
- Q&A thread in ScrollArea: alternating question/answer bubbles with topic badges
- Answer input: ProvokeText with voice support (replace mode), send button, skip button
- "Interview ended" state with Resume/Podcast buttons

### Layer 2: API Endpoints

#### `POST /api/interview/question`

Generates the next interview question.

**Request** (`interviewQuestionRequestSchema`):
```typescript
{
  objective: string,           // required — min 1 char
  document?: string,           // current document text
  appType?: TemplateId,        // for app-specific tuning
  template?: string,           // document template sections to cover
  previousEntries?: InterviewEntry[],
  provocations?: Provocation[],  // pending challenges to weave in
  directionMode?: "challenge" | "advise",
  directionPersonas?: ProvocationType[],
  directionGuidance?: string,  // user focus text + stance instruction
  thinkBigVectors?: ThinkBigVector[],
}
```

**Response** (`InterviewQuestionResponse`):
```typescript
{
  question: string,  // max 200-300 chars, conversational
  topic: string,     // max 40 chars, "PersonaName: Specific Topic"
  reasoning: string, // max 100 chars, internal explanation
}
```

**LLM Configuration**:
- Temperature: `0.9` (high creativity for diverse questions)
- Max tokens: `1024`
- Response format: Raw JSON (no markdown fences)

#### `POST /api/interview/summary`

Synthesizes all Q&A pairs into a single document editing instruction.

**Request** (`interviewSummaryRequestSchema`):
```typescript
{
  objective: string,
  entries: InterviewEntry[],  // min 1
  document?: string,
  appType?: TemplateId,
}
```

**Response**: `{ instruction: string }` — passed to `onEvolveDocument()` which triggers the Writer.

**System prompt**: Groups answers by theme, specifies where modifications/additions should be made, includes all key points as clear directives.

#### `POST /api/interview/podcast`

Generates a two-host podcast episode from the interview.

**Request** (`podcastRequestSchema`): Same shape as summary request.

**Response**:
```typescript
{
  audio: string,             // base64-encoded MP3
  mimeType: "audio/mp3",
  script: PodcastSegment[],  // { speaker: "alex"|"jordan", text: string }[]
}
```

**Two-step process**:
1. LLM generates conversational script (10-18 exchanges) with two hosts:
   - **Alex** (Lead Host): Warm, empathetic, journalist-trained. Funnel technique: big-picture → specifics.
   - **Jordan** (Expert Analyst): Sharp, pattern-obsessed, contrarian. Notices gaps and consequences.
2. TTS converts each segment: Alex → "nova" voice, Jordan → "onyx" voice.

**Podcast structure**: Cold Open → Context Frame → Deep Dive → The Blind Spot → Actionable Close

### Layer 3: Schema Definitions

**File**: `shared/schema.ts`

```typescript
// Interview entry — single Q&A pair
interviewEntrySchema = z.object({
  id: z.string(),
  question: z.string(),
  answer: z.string(),
  topic: z.string(),
  timestamp: z.number(),
});

// Direction modes
directionModes = ["challenge", "advise"] as const;

// CEO vectors (7 scaling dimensions)
thinkBigVectors = [
  "tenancy_topology", "api_surface", "scaling_horizon",
  "data_residency", "integration_philosophy", "identity_access", "observability"
] as const;
```

---

## Prompt Engineering — The Journalist System Prompt

The system prompt is built dynamically from context. Here is the full structure:

```
[App-specific context if appType is set]

You are a thought-provoking interviewer [who reads the user's ACTUAL document
and objectives carefully, then asks deeply personal, specific questions that
only make sense for THIS document]. You are NOT a generic questionnaire.

[Persona direction block — when personas are active]
[Universal thinking lenses — when no personas are active]

OBJECTIVE: {objective}
[Template context — sections to cover]
[Document context — full current text]
[Pending provocations — unaddressed challenges]
[User guidance — focus text + stance directive]

PREVIOUS Q&A:
{formatted previous entries or "No previous questions yet"}

## CRITICAL RULES — read carefully

1. Be specific to THIS document. Reference concrete details — names, numbers,
   claims, sections, phrases the user actually wrote. NEVER ask a generic question.

2. Be a thought partner, not a checklist. Your question should feel like a smart
   colleague who read their draft and noticed something interesting, contradictory,
   or unexplored.

3-5. [Persona-specific or lens-specific rotation rules]

6. Keep it conversational and direct. Write like a human, not a form.

Response format: Raw JSON only
{"question": "...", "topic": "PersonaName: Specific Topic", "reasoning": "..."}
```

### Key Prompt Patterns

| Pattern | Implementation |
|---------|---------------|
| **Specificity enforcement** | Rule 1 requires referencing concrete details from document or answers |
| **Thought-partner framing** | Rule 2 sets the tone — colleague, not questionnaire |
| **Persona rotation** | Rules 3-5 ensure different angles on each question |
| **Conversational tone** | Rule 6 demands human-like phrasing |
| **High temperature** | `0.9` ensures diverse, creative questions |
| **Adaptive opening** | System prompt adapts based on whether document exists |
| **Topic prefixing** | Mandatory `"PersonaName: Specific Topic"` format for traceability |

### Configurable Options

| Option | Where Set | Effect |
|--------|-----------|--------|
| **Stance** | InterviewTab UI pill | Injects Writer/Painter/Balanced directive into guidance |
| **Focus text** | InterviewTab input field | Appended to `directionGuidance` — steers question direction |
| **Active personas** | PersonaAvatarRow (workspace) | Determines which persona vocabularies to use |
| **Direction mode** | Derived from stance | `"challenge"` (Writer) or `"advise"` (Painter) |
| **CEO vectors** | Workspace state | When CEO persona is active, focuses on specific scaling dimensions |
| **App type** | Workspace template | Injects app-specific context (e.g., SQL query vs. document) |

---

## Data Flow

```
User clicks "Start Interview"
  → InterviewTab.handleStart()
  → POST /api/interview/question
    ├─ objective, documentText, appType
    ├─ stance → directionMode + directionGuidance
    ├─ active personas → directionPersonas
    └─ previous entries for continuity
  → LLM generates { question, topic, reasoning }
  → Display question in Q&A thread

User answers (text or voice)
  → InterviewTab.handleAnswer()
  → Create InterviewEntry { id, question, answer, topic, timestamp }
  → Add to entries[]
  → Auto-fetch next question (loop back to POST)

User clicks "Summary"
  → POST /api/interview/summary
  → LLM synthesizes all Q&A into editing instruction
  → onEvolveDocument(instruction) → triggers Writer mutation

User clicks "Podcast"
  → POST /api/interview/podcast
  → LLM writes two-host script → TTS generates audio
  → Podcast player appears in header

User clicks "Save to Notes"
  → Formats all Q&A as markdown
  → onCaptureToContext(text, "Interview Q&A")
```

---

## Key Behaviors

1. **Auto-advance**: After each answer, the next question is automatically fetched — no manual "next" button needed
2. **Skip**: Users can skip questions they don't want to answer
3. **Voice input**: Full voice recording support via ProvokeText with replace mode
4. **Stance cycling**: Tap the header pill to rotate Writer → Painter → Balanced
5. **Podcast generation**: Two-host conversational episode from Q&A pairs with real TTS audio
6. **Save to Notes**: Captures all Q&A as formatted markdown in the Notes panel
7. **Summary merge**: Synthesizes interview into document edits via the Writer
8. **Pause/Resume**: Interview can be stopped and restarted, preserving all entries
