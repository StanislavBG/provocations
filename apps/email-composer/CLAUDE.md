# Email Composer — App Guide

> **Template ID**: `email-composer` | **Category**: `write` | **Layout**: `standard`

## Purpose

Compose **polished business emails** quickly. Tone adapts to the described recipient (C-suite, peers, clients, direct reports). Uses a unique `email` output format (not markdown) that includes Subject line, greeting, body, and sign-off. No template — starts freeform. Challenges focus on clarity, tone appropriateness, and actionability.

## User Workflow

1. **Select** the Email Composer template from the landing page
2. **Define the email** — Purpose? Recipient? Key message or ask?
3. **Write** — Compose directly in the freeform editor
4. **Provoke tab** generates challenges against tone, clarity, and actionability
5. **Iterate** — refine tone, tighten the ask, improve structure
6. **Output** — A professional email with Subject, greeting, body, sign-off

## Three-Layer Definition

### Layer 1: PrebuiltTemplate (`client/src/lib/prebuiltTemplates.ts`)
- **Title**: Email Composer
- **Short Label**: Email
- **Subtitle**: Business professional emails, fast
- **Objective**: "Compose a clear, professional business email that achieves the stated communication goal with appropriate tone for the audience"
- **Draft Questions**:
  1. What is the purpose of this email?
  2. Who is the recipient (role, relationship)?
  3. What is the key message or ask?
- **Steps**: `[{ id: "compose", label: "Compose your email" }]`
- **Provocation Sources**: Communications Director, Executive Assistant, Recipient's Perspective
- **Template Content**: Empty (freeform email)

### Layer 2: AppFlowConfig (`client/src/lib/appWorkspaceConfig.ts`)
- **Workspace Layout**: `standard`
- **Default Toolbox Tab**: `provoke`
- **Auto-Start Interview**: `false`
- **Auto-Start Personas**: none
- **Left Panel Tabs**: `[provoke, context]`
- **Right Panel Tabs**: `[discussion]`
- **Writer Config**:
  - Mode: `edit`
  - Output Format: **`email`** — unique format (not `markdown`)
  - Document Type: "business email"
  - Feedback Tone: "direct and professional — focus on clarity, tone, and actionability"

### Layer 3: Context Builder (`server/context-builder.ts`)
- **Document Type**: "business email"
- **Feedback Tone**: "direct and professional — focus on clarity, tone, and actionability"
- **Output Format**: **`email`**
- **System Guidance**: Formats output as email with Subject line, greeting, body, sign-off. Adapts tone based on recipient context:
  - C-suite: concise, data-driven, decision-focused
  - Peers: collaborative, direct
  - Clients: professional, service-oriented
  - Direct reports: clear, supportive, actionable
  - Front-loads purpose in the first sentence. Forbids generic fillers ("I hope this email finds you well").

## Components Used

All shared/standard components — no app-specific components.

## API Endpoints Used

All shared endpoints only.

## Key Behaviors

- **Unique output format**: Only app that uses `email` format instead of `markdown` — output includes Subject line structure
- **No auto-interview**: Emails are short — no interview warmup needed
- **No template**: Starts blank — user composes from scratch
- **Recipient-adaptive tone**: System guidance adjusts formality based on described recipient
- **Anti-filler enforcement**: System guidance explicitly forbids generic email openers
- **Action-focused**: Every email must have a clear ask or next step
- **Minimal provocation sources**: Only 3 (vs. 5 for most apps) — emails are focused documents
