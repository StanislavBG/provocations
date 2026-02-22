# Product Requirement — App Guide

> **Template ID**: `product-requirement` | **Category**: `build` | **Layout**: `standard`

## Purpose

Produces enterprise-grade product requirement documents for **incremental features** — not greenfield apps. Uses a semi-structured format covering who the user is, their current workflow, what's broken or missing, the proposed change, scope boundaries, and acceptance criteria. Personas rigorously challenge every assumption about user needs, edge cases, and testability.

## User Workflow

1. **Select** the Product Requirement template from the landing page
2. **Provide context** — two objective fields:
   - **Primary**: "Overall Application Description" (with "Load from Context Store" enabled)
   - **Secondary**: "Describe the Next Project"
3. **Answer draft questions** — Who is the user? What are they trying to do? What's broken? What should the new experience look like?
4. **Auto-interview starts** with `thinking_bigger` persona
5. **Provoke tab** generates challenges against scope, testability, edge cases
6. **Iterate** — respond to challenges, document evolves into a complete PRD
7. **Output** — A structured PRD with Problem, User, Workflow, Proposed Change, Scope, Acceptance Criteria, Edge Cases

## Three-Layer Definition

### Layer 1: PrebuiltTemplate (`client/src/lib/prebuiltTemplates.ts`)
- **Title**: Product Requirement
- **Short Label**: Feature PRD
- **Subtitle**: Incremental feature, enterprise-grade
- **Objective**: "Write a clear product requirements document for an incremental feature with defined user, workflow, scope, and acceptance criteria"
- **Draft Questions**:
  1. Who is the user persona that will benefit from this feature?
  2. What are they trying to do today, and how?
  3. What's broken, missing, or frustrating about their current workflow?
  4. What should the new experience look like?
- **Steps**: `[{ id: "context", label: "Share your context" }]`
- **Provocation Sources**: The Architect, VP of Engineering, UX Designer, Support Lead, Confused Customer
- **Template Content**: Full PRD markdown template with sections:
  - Problem Statement
  - Target User
  - Current Workflow
  - Proposed Change
  - Scope (In/Out)
  - Acceptance Criteria
  - Edge Cases & Error Handling

### Layer 2: AppFlowConfig (`client/src/lib/appWorkspaceConfig.ts`)
- **Workspace Layout**: `standard`
- **Default Toolbox Tab**: `provoke`
- **Auto-Start Interview**: `true`
- **Auto-Start Personas**: `["thinking_bigger"]`
- **Left Panel Tabs**: `[provoke, context]`
- **Right Panel Tabs**: `[discussion]`
- **Objective Config**: Custom dual-objective:
  - Primary: "Overall Application Description" (with `loadFromContextStore: true`)
  - Secondary: "Describe the Next Project"
- **Writer Config**:
  - Mode: `edit`
  - Output Format: `markdown`
  - Document Type: "product requirement document"
  - Feedback Tone: "rigorous but constructive"

### Layer 3: Context Builder (`server/context-builder.ts`)
- **Document Type**: "product requirement document"
- **Feedback Tone**: "rigorous but constructive"
- **Output Format**: `markdown`
- **System Guidance**: Focuses on user clarity, scope precision, testability (Given/When/Then format for acceptance criteria), edge case coverage, rollback plans, and migration paths. Challenges vague requirements, untestable criteria, and missing error handling.

## Components Used

All shared/standard components — no app-specific components:
- `ProvocationsDisplay.tsx` — Challenge cards
- `ReadingPane.tsx` — Document canvas (pre-populated with PRD template)
- `ProvokeText.tsx` — Text input with voice
- `DraftQuestionsPanel.tsx` — Guided questions
- `InterviewPanel.tsx` — Auto-started interview
- `ContextCapturePanel.tsx` — Context capture for loading app description

## API Endpoints Used

All shared endpoints only:
- `POST /api/generate-challenges` — Generate PRD-focused challenges
- `POST /api/generate-advice` — Get advice on specific challenge
- `POST /api/write` — Edit/evolve the PRD document
- `POST /api/write/stream` — Streaming write for large documents
- `POST /api/interview/question` — Next interview question
- `POST /api/interview/summary` — Synthesize interview into instructions
- `POST /api/discussion/ask` — Multi-persona discussion

## Key Behaviors

- **Dual objective input**: Users provide both an app-level description AND a feature-specific description
- **Context Store integration**: Primary objective can be loaded from saved context (previous app descriptions)
- **Template pre-populated**: Document starts with the full PRD structure — not blank
- **Incremental features only**: System guidance is tuned for adding to existing products, not building from scratch
- **Testability focus**: Acceptance criteria must be Given/When/Then format
- **Edge case pressure**: Personas specifically challenge for missing error states and boundary conditions
