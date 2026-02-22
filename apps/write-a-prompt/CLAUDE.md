# Write a Prompt — App Guide

> **Template ID**: `write-a-prompt` | **Category**: `write` | **Layout**: `standard`

## Purpose

Guides users through writing clear, structured AI prompts using the **AIM framework** (Actor, Input, Mission). The AI doesn't write the prompt for you — it challenges vague instructions, missing context, and ambiguous expectations until the prompt is precise enough for any AI to execute.

## User Workflow

1. **Select** the Write a Prompt template from the landing page
2. **Answer draft questions** — Who should I pretend to be? What's the story? What are we making?
3. **Auto-interview starts** with `thinking_bigger` persona to push scope
4. **Provoke tab** generates challenges against clarity, specificity, and completeness
5. **Iterate** — respond to challenges via voice or text, document evolves
6. **Output** — A polished AIM-structured prompt ready for use

## Three-Layer Definition

### Layer 1: PrebuiltTemplate (`client/src/lib/prebuiltTemplates.ts`)
- **Title**: Write a Prompt
- **Short Label**: Prompt
- **Subtitle**: AIM framework, any format
- **Objective**: "Write a clear, structured prompt using the AIM framework (Actor, Input, Mission) that an AI can execute with precision"
- **Draft Questions**:
  1. "Who should I pretend to be? Think about who would be best at this task..."
  2. "Tell me the story. Share the details..."
  3. "What are we making? Be specific about the final product..."
- **Steps**: `[{ id: "write", label: "Write your prompt" }]`
- **Provocation Sources**: Clarity Coach, Intent Detector
- **Template Content**: Empty (freeform)

### Layer 2: AppFlowConfig (`client/src/lib/appWorkspaceConfig.ts`)
- **Workspace Layout**: `standard` (3-panel: toolbox | document | discussion)
- **Default Toolbox Tab**: `provoke`
- **Auto-Start Interview**: `true`
- **Auto-Start Personas**: `["thinking_bigger"]`
- **Left Panel Tabs**: `[provoke, context]`
- **Right Panel Tabs**: `[discussion]`
- **Writer Config**:
  - Mode: `edit` (rewrites/evolves the document)
  - Output Format: `markdown`
  - Document Type: "AI prompt"
  - Feedback Tone: "direct and clarity-focused"

### Layer 3: Context Builder (`server/context-builder.ts`)
- **Document Type**: "AI prompt"
- **Feedback Tone**: "direct and clarity-focused"
- **Output Format**: `markdown`
- **System Guidance**: Focuses on AIM framework clarity — pushes for specificity in Actor definition (who, expertise level), Input completeness (all context the AI needs), and Mission precision (exact output format, constraints, success criteria). Challenges vague instructions and generic phrasing.

## Components Used

All shared/standard components — no app-specific components:
- `ProvocationsDisplay.tsx` — Challenge cards
- `ReadingPane.tsx` — Document canvas
- `ProvokeText.tsx` — Text input with voice
- `DraftQuestionsPanel.tsx` — Guided questions
- `InterviewPanel.tsx` — Auto-started interview

## API Endpoints Used

All shared endpoints only:
- `POST /api/generate-challenges` — Generate AIM-focused challenges
- `POST /api/generate-advice` — Get advice on specific challenge
- `POST /api/write` — Edit/evolve the prompt document
- `POST /api/interview/question` — Next interview question
- `POST /api/interview/summary` — Synthesize interview into instructions
- `POST /api/discussion/ask` — Multi-persona discussion

## Key Behaviors

- **AIM enforcement**: Every challenge should push toward clearer Actor, Input, or Mission
- **No template content**: Starts blank — the user builds the prompt from scratch through iteration
- **Freeform output**: The final prompt can be any format the user needs
- **Single step flow**: No multi-step progression — just "Write your prompt"
