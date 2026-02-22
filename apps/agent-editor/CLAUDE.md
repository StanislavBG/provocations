# Agent Editor — App Guide

> **Template ID**: `agent-editor` | **Category**: `build` | **Layout**: `standard`

## Purpose

Design **multi-step AI agent workflows** with structured steps (Input → Actor → Output). Each step is a prompt execution unit with defined inputs, processing logic, and outputs that chain together. Includes a built-in execution engine for testing workflows with real LLM calls, token monitoring, and SSE-based streaming results.

## User Workflow

1. **Select** the Agent Editor template from the landing page
2. **Define the agent** — What should this agent do? First step input? Final output? How many steps?
3. **Auto-interview starts** with `architect` persona (not `thinking_bigger`)
4. **Steps tab opens first** — Build step sequence with StepBuilder component
5. **Configure each step** — Define Input, Actor (prompt), Output for each step
6. **Test** — Execute the workflow via AgentRunner with real LLM calls
7. **Monitor** — Watch step-by-step progress via SSE streaming, track token usage
8. **Provoke & refine** — Personas challenge prompt quality, step compatibility, token budget
9. **Output** — A complete agent workflow definition stored in the database

## Three-Layer Definition

### Layer 1: PrebuiltTemplate (`client/src/lib/prebuiltTemplates.ts`)
- **Title**: Agent Editor
- **Short Label**: Agent
- **Subtitle**: Design multi-step AI workflows
- **Objective**: "Design a multi-step AI agent workflow with clear input, processing, and output for each step"
- **Draft Questions**:
  1. What should this agent accomplish end-to-end?
  2. What is the first step's input?
  3. What is the final output?
  4. How many steps do you envision?
- **Steps**: `[define, steps, test]` (3 steps)
- **Provocation Sources**: Workflow Architect, Prompt Quality Reviewer
- **Template Content**: Empty (workflows built through step builder)

### Layer 2: AppFlowConfig (`client/src/lib/appWorkspaceConfig.ts`)
- **Workspace Layout**: `standard`
- **Default Toolbox Tab**: **`steps`** — unique tab, opens first
- **Auto-Start Interview**: `true`
- **Auto-Start Personas**: **`["architect"]`** — uses Architect persona, not thinking_bigger
- **Left Panel Tabs**: `[steps, provoke, context]` — **Steps tab first** (unique)
- **Right Panel Tabs**: `[execution, discussion]` — **Execution tab** (unique)
- **Writer Config**:
  - Mode: `edit`
  - Output Format: `markdown`
  - Document Type: "agent workflow definition"
  - Feedback Tone: "precise and architecture-focused"

### Layer 3: Context Builder (`server/context-builder.ts`)
- **Document Type**: "agent workflow definition"
- **Feedback Tone**: "precise and architecture-focused"
- **Output Format**: `markdown`
- **System Guidance**: Multi-step agent design with Input → Actor → Output pattern. Challenges vague prompts (what exactly does "analyze" mean?), flags token budget issues (will this step exceed limits?), ensures step-to-step compatibility (does step 2's input match step 1's output?), and validates the entire chain end-to-end.

## App-Specific Components

| Component | Path | Purpose |
|-----------|------|---------|
| `StepBuilder.tsx` | `client/src/components/StepBuilder.tsx` | Left panel "Steps" tab — build, reorder, configure agent steps with token counter |
| `AgentRunner.tsx` | `client/src/components/AgentRunner.tsx` | Right panel "Execution" tab — input field, run button, SSE-based step-by-step progress, results display |
| `TokenCounter.tsx` | `client/src/components/TokenCounter.tsx` | Token estimation and usage display |

## App-Specific API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/agents` | POST | Create agent definition |
| `/api/agents` | GET | List user's agents |
| `/api/agents/:agentId` | GET | Get single agent |
| `/api/agents/:agentId` | PUT | Update agent |
| `/api/agents/:agentId` | DELETE | Delete agent |
| `/api/agents/:agentId/execute` | POST | Execute saved agent (non-streaming) |
| `/api/agents/:agentId/execute/stream` | POST | Execute saved agent (SSE streaming) |
| `/api/agents/execute-inline` | POST | Execute unsaved agent definition (for testing) |

**Server-side engine**: `server/agent-executor.ts` — Orchestrates step-by-step execution with LLM calls, handles streaming, token tracking, and error recovery.

## Data Model

Agents are stored as database entities (not just documents):
- **Agent definition**: Name, description, steps array, userId
- **Each step**: stepId, label, input template, actor prompt, output schema
- **Execution history**: Input, output, token usage, duration per step

## Key Behaviors

- **Architect persona**: Only app that auto-starts with `architect` instead of `thinking_bigger`
- **Steps tab first**: Only app with a "Steps" panel in the left toolbox
- **Execution tab**: Only app with an "Execution" panel in the right side
- **Database-backed**: Agent definitions are persisted in the database (CRUD), not just document content
- **Real execution**: Can actually run the designed workflow with real LLM calls
- **SSE streaming**: Execution results stream step-by-step via Server-Sent Events
- **Token monitoring**: Tracks and displays token usage per step and total
- **Chain validation**: System guidance specifically validates Input → Output compatibility between adjacent steps
- **Inline execution**: Can test unsaved agent definitions without persisting first
