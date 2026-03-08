# Agent Editor — App Guide

> **Template ID**: `agent-editor` | **Category**: `build` | **Layout**: `standard`

## Purpose

Design multi-step AI agent workflows with structured steps (Input -> Actor -> Output). Each step is a prompt execution unit with defined inputs, processing logic, and outputs that chain together. Includes a built-in execution engine for testing workflows with real LLM calls and SSE-based streaming results.

## Unique Behaviors

- **Architect persona**: Only app that auto-starts with `architect` instead of `thinking_bigger`
- **Steps tab first**: Only app with a "Steps" panel in the left toolbox (`defaultToolboxTab: steps`)
- **Execution tab**: Only app with an "Execution" panel in the right side
- **Database-backed**: Agent definitions are persisted in the database (CRUD), not just document content
- **Real execution**: Can actually run the designed workflow with real LLM calls
- **SSE streaming**: Execution results stream step-by-step via Server-Sent Events
- **Token monitoring**: Tracks and displays token usage per step and total
- **Chain validation**: System guidance validates Input -> Output compatibility between adjacent steps
- **Inline execution**: Can test unsaved agent definitions without persisting first

## Key Files

| Component | Path | Purpose |
|-----------|------|---------|
| `StepBuilder` | `StepBuilder.tsx` | Left panel "Steps" tab — build, reorder, configure steps |
| `AgentRunner` | `AgentRunner.tsx` | Right panel "Execution" tab — run, monitor, results |
| `TokenCounter` | `TokenCounter.tsx` | Token estimation and usage display |
| `agent-executor` | `server/agent-executor.ts` | Server-side step-by-step execution engine |

## App-Specific Endpoints

- `POST/GET /api/agents` — Create / list agents
- `GET/PUT/DELETE /api/agents/:agentId` — Agent CRUD
- `POST /api/agents/:agentId/execute/stream` — Execute saved agent (SSE)
- `POST /api/agents/execute-inline` — Execute unsaved definition (testing)

See `docs/architecture.md` for the three-layer application pattern.
