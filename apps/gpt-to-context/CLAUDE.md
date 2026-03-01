# Researcher — App Guide

> **Template ID**: `gpt-to-context` | **Category**: `capture` | **Layout**: `research-chat` (unique)

## Purpose

A focused **research workspace** where you converse with an AI researcher to explore a topic, capture key findings into notes, and generate a structured summary aligned with your objective. The only app using the `research-chat` layout. Features **7 research focus modes** that shape the AI's behavior — from broad exploration to rigorous, cited deep research. Uses `aggregate` writer mode (document grows additively rather than being rewritten).

**Core idea**: Chat-driven research → selective capture → objective-aligned synthesis.

## User Workflow

1. **Select** the Researcher template from the landing page
2. **Define** your research topic and objective (what you want to learn + what it feeds into)
3. **Choose a focus mode** — defaults to **Explore** (breadth-first discovery)
4. **Chat** with the AI researcher in the middle panel — ask questions, follow threads
5. **Capture** useful findings to Notes (left panel) using the bookmark button on each response
6. **Switch focus modes** as your understanding grows (e.g., Explore → Analyze → Deep Research)
7. **Generate summary** — distill notes and conversation into a clean, objective-aligned output
8. **Save session** to Context Store for reuse in other apps

## Three-Layer Definition

### Layer 1: PrebuiltTemplate (`client/src/lib/prebuiltTemplates.ts`)
- **Title**: GPT to Context (displayed as "Researcher")
- **Short Label**: GPT Context
- **Subtitle**: Research with AI, build structured context
- **Objective**: "Research a topic through iterative conversation and build a clean, structured summary aligned with your objective"
- **Draft Questions**:
  1. What topic or question are you researching?
  2. What is the end goal — what will this research feed into?
- **Steps**: `[{ id: "research", label: "Research & capture" }]`
- **Provocation Sources**: Research Analyst, Synthesis Coach
- **Template Content**: Empty (freeform — conversation drives the output)
- **Status**: `under-dev`

### Layer 2: AppFlowConfig (`client/src/lib/appWorkspaceConfig.ts`)
- **Workspace Layout**: `research-chat` — unique layout with streaming research chat as the center panel
- **Default Toolbox Tab**: `provoke`
- **Auto-Start Interview**: `false`
- **Auto-Start Personas**: none
- **Left Panel Tabs**: `[provoke, chat]`
- **Right Panel Tabs**: `[discussion]`
- **Writer Config**:
  - Mode: `aggregate` — new content is appended, not rewritten
  - Output Format: `markdown`
  - Document Type: "research summary"
  - Feedback Tone: "analytical and synthesis-focused"

### Layer 3: Context Builder (`server/context-builder.ts`)
- **Document Type**: "research summary"
- **Feedback Tone**: "analytical and synthesis-focused"
- **Output Format**: `markdown`
- **System Guidance**: Defines the AI as a focused research assistant. Key rules:
  - Stay focused on the stated research topic and objective
  - Provide substantive, well-structured responses with concrete details
  - Answer questions thoroughly but also suggest follow-up angles
  - Reference the user's notes and prior conversation to avoid repeating ground
  - Identify gaps in the research — what hasn't been explored yet?
  - Keep responses focused and scannable (bullet points, headers)
  - Do NOT write summaries unprompted — the user controls when to summarize

## Research Focus Modes (Unique Feature)

The research chat (`NotebookResearchChat.tsx`) offers **7 focus modes** that inject a mode-specific section into the system prompt. The user switches modes via a toggle row above the chat input. Focus mode state is session-only (resets on page reload).

The full system prompt always includes:
1. **Base persona** — rigorous senior research analyst identity
2. **Source hierarchy** — 5-tier trust model (official docs → first-party → peer-reviewed → journalism → community)
3. **Trust rules** — non-negotiable accuracy requirements (say "I don't know", flag outdated info, cross-reference)
4. **Focus mode section** — one of the 7 modes below
5. **Formatting rules** — mandatory Markdown, headings, lists, tables
6. **Capabilities** — Google Search grounding for live data
7. **Response behavior** — lead with the answer, reference prior context, default concise

### 1. Explore (Default)

> **Icon**: Compass | **Goal**: Discovery & ideation — map the landscape

The default mode. Casts a wide net across multiple dimensions.

- Covers multiple dimensions (technical, business, user, regulatory)
- Suggests related topics, adjacent concepts, "have you considered..." angles
- Challenges assumptions — broadens narrow framing
- Surfaces non-obvious connections between ideas
- Provides a topic "map": key players, major approaches, open questions, emerging trends
- Keeps individual points concise but covers breadth
- **Ends with 2-3 follow-up questions** the user should consider next

**When to use**: Starting a new topic, brainstorming, mapping unknown territory.

### 2. Verify

> **Icon**: ShieldCheck | **Goal**: Fact-checking & source validation

Validates claims against authoritative sources.

- Cites specific sources (name, date, URL) for every significant claim
- Actively looks for counter-evidence and contradictions
- Rates confidence: **Confirmed**, **Likely accurate**, **Unverified**, or **Contradicted**
- Flags logical fallacies, circular citations, single-source claims
- Prioritizes official and first-party sources
- Explicitly says when a claim cannot be verified

**When to use**: Validating assumptions, checking numbers, verifying before publishing.

### 3. Gather

> **Icon**: Database | **Goal**: Structured data collection

Collects and organizes factual data in directly usable formats.

- Defaults to **tables, lists, and structured formats** over prose
- Exhaustive within the requested scope — completeness over brevity
- Includes field names, data types, enum values, schemas, specifications
- Labels each data point with source and last-verified date
- Indicates what's been covered and what remains if data is paginated
- Asks clarifying questions when scope is ambiguous

**When to use**: Building datasets, collecting specs, listing options exhaustively.

### 4. Analyze

> **Icon**: FlaskConical | **Goal**: Comparison & evaluation

Compares options and evaluates trade-offs to support decisions.

- Uses **comparison tables** as the primary output format
- Defines evaluation criteria explicitly before comparing
- Provides **weighted assessment** — asks user's priorities if unclear
- Includes pros AND cons for every option (never one-sided)
- Distinguishes hard facts (pricing, features) from subjective assessments
- Ends with a **clear recommendation or decision framework**
- Flags criteria where data is insufficient to compare fairly

**When to use**: Choosing between technologies, evaluating vendors, making strategic decisions.

### 5. Synthesize

> **Icon**: Layers | **Goal**: Cross-source narrative weaving

Weaves multiple sources into coherent, unified narrative.

- Identifies and names **recurring themes** across conversation history
- Resolves contradictions — explains why and which view has stronger support
- Outputs **polished prose** with clear topic sentences, not bullet lists
- Highlights **emergent insights** visible only when combining sources
- Preserves nuance — no oversimplification of complex positions
- Ends with a **"Gaps remaining"** section
- Says so when conversation is too thin to synthesize meaningfully

**When to use**: Building a narrative from scattered findings, preparing a brief, connecting dots.

### 6. Reason

> **Icon**: BrainCircuit | **Goal**: Step-by-step logical reasoning

Breaks down complex problems into explicit, validated reasoning steps.

- **Numbers each reasoning step** with logical connectors (therefore, however, this implies)
- Identifies and states **key assumptions** before answering
- Breaks complex questions into **sub-problems**, solves each before combining
- Validates each major step: "This holds because..." or "This is weak because..."
- Shows **multiple valid reasoning paths** and explains preference
- Flags **logical dependencies** — what changes if an assumption is wrong
- Distinguishes **deductive** (certain) from **inductive** (probabilistic) reasoning
- Ends with confidence assessment and strongest counterargument

**When to use**: Working through complex logic, building arguments, stress-testing reasoning.

### 7. Deep Research

> **Icon**: Microscope | **Goal**: Comprehensive multi-step investigation

Conducts thorough, multi-layered investigation with full citations.

- Begins with a **research plan** — states key questions and approach upfront
- Covers systematically: history/background, current state, key players, competing approaches, emerging trends, open questions
- **Cites everything** — every factual claim references a specific source (name, organization, date, URL)
- Goes **beyond surface-level** — seeks primary sources, distinguishes first-hand data from secondary reporting
- Includes a **"Conflicting views"** section when experts disagree
- Uses structured formatting: clear headings, numbered findings, summary tables
- Assesses **source quality** — authoritative vs. speculative, peer-reviewed vs. blog posts
- Ends with **Executive Summary** (3-5 key findings) and **Further Investigation** (unanswered questions)
- Prioritizes **depth and rigor over speed**

**When to use**: Going deep on a scoped question, producing a citable report, due diligence.

### Explore vs Deep Research — Key Differences

| Dimension | Explore | Deep Research |
|-----------|---------|---------------|
| **Strategy** | Breadth-first — map the landscape | Depth-first — systematic investigation |
| **Citations** | Not required | Mandatory for every claim |
| **Opening move** | Jumps straight in | Starts with a research plan |
| **Output style** | Concise points, topic map | Structured report with headings and tables |
| **Source quality** | Not explicitly assessed | Flagged (authoritative vs. speculative) |
| **Conflicting views** | Mentions angles to consider | Dedicated section presenting both sides |
| **Closing** | 2-3 follow-up questions | Executive Summary + Further Investigation |
| **Speed vs. rigor** | Optimized for quick coverage | Optimized for thoroughness |
| **Best for** | "What's out there?" | "Give me a cited report" |

**Recommended progression**: Start with **Explore** to map the landscape, then switch to **Deep Research** once you've identified a specific thread worth investigating in depth. Use **Verify** to validate specific claims that emerged from either mode.

## Components Used

| Component | Purpose |
|-----------|---------|
| `NotebookResearchChat.tsx` | Primary chat interface with focus mode toggle, message streaming, capture-to-context, model selector. **Unique to this app's layout.** |
| `NotebookWorkspace.tsx` | Parent orchestrator (shared, but uses `research-chat` layout branch) |

All other shared components (TopBar, LeftPanel, RightPanel, TranscriptPanel, etc.) are used as normal.

## API Endpoints Used

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/chat/stream` | POST | Streaming research chat (SSE). Accepts `researchFocus` parameter to select focus mode. Uses `buildResearchAssistantPrompt()` with `getFocusModePrompt()` on the server. |
| `/api/chat/summarize` | POST | Summarize a research chat session into a clean document |
| `/api/chat/save-session` | POST | Save the full research session to the Context Store |
| `/api/chat/models` | GET | List available chat models (user can switch models during session) |

## Key Behaviors

- **Only `research-chat` layout app** — no other app uses this workspace layout
- **7 focus modes** — unique feature among all apps; each injects a different system prompt section
- **Session-only focus state** — `focusMode` is `useState("explore")`, resets on page reload
- **Aggregate writer mode** — document grows additively (notes are captured and appended)
- **SSE streaming** — responses stream token-by-token via Server-Sent Events
- **History windowing** — only the last 30 messages are sent as conversation context to stay within token limits
- **Google Search grounding** — system prompt declares live internet access capability
- **Default model** — uses `gemini-2.5-flash` (configurable via model selector in the chat header)
- **Capture-to-notes** — each AI response has a bookmark button to capture it into the Notes panel
- **No auto-interview** — research starts immediately with the chat, no warmup questionnaire
- **Status: under-dev** — template is marked `under-dev` (visible in UI as a development badge)
- **Source hierarchy** — 5-tier trust model baked into every prompt (official docs > first-party > peer-reviewed > journalism > community)
