# Research into Context — App Guide

> **Template ID**: `research-context` | **Category**: `capture` | **Layout**: `standard` | **Status**: Coming Soon

## Purpose

Conversational research capture — users dynamically explore a topic through AI dialogue, capturing structured nuggets into a research library. Unlike other apps that produce a single document, this one **aggregates** — the document grows additively and never deletes previous content. Think of it as building a personal knowledge base through guided exploration.

## User Workflow

1. **Select** the Research into Context template from the landing page
2. **Define research scope** — What topic? What do you already know? Key gaps? How will research be used?
3. **Context tab opens first** — capture sources, links, notes, images
4. **Auto-interview starts** with `thinking_bigger` persona
5. **Browse websites** — Website tab available for inline research
6. **Provoke tab** generates challenges focused on gaps, contradictions, missing perspectives
7. **Iterate** — each response APPENDS to the document (never overwrites)
8. **Output** — A research context library: Objective, Key Questions, Sources, Captured Notes, Themes, Gaps, Synthesis

## Three-Layer Definition

### Layer 1: PrebuiltTemplate (`client/src/lib/prebuiltTemplates.ts`)
- **Title**: Research into Context
- **Short Label**: Research
- **Subtitle**: Conversational research captured as structured context
- **Objective**: "Build a structured research context by capturing, organizing, and cross-referencing sources, notes, and references..."
- **Draft Questions**:
  1. What topic are you researching?
  2. What do you already know?
  3. What are the key gaps in your understanding?
  4. How will this research be used?
- **Steps**: `[{ id: "context", label: "Capture your sources" }]`
- **Provocation Sources**: Research Librarian, Skeptical Reviewer, Domain Expert, Synthesis Coach, Gap Finder
- **Template Content**: Research Context template:
  - Research Objective
  - Key Questions
  - Sources & References
  - Captured Notes
  - Emerging Themes
  - Gaps & Contradictions
  - Synthesis
  - Context Library

### Layer 2: AppFlowConfig (`client/src/lib/appWorkspaceConfig.ts`)
- **Workspace Layout**: `standard`
- **Default Toolbox Tab**: `context` — starts on Context tab, not Provoke
- **Auto-Start Interview**: `true`
- **Auto-Start Personas**: `["thinking_bigger"]`
- **Left Panel Tabs**: `[context, provoke, website]` — Context first, Website available
- **Right Panel Tabs**: `[discussion]`
- **Writer Config**:
  - Mode: **`aggregate`** — document grows additively, never deletes content
  - Output Format: `markdown`
  - Document Type: "research context library"
  - Feedback Tone: "analytical and gap-finding"

### Layer 3: Context Builder (`server/context-builder.ts`)
- **Document Type**: "research context library"
- **Feedback Tone**: "analytical and gap-finding"
- **Output Format**: `markdown`
- **System Guidance**: AGGREGATE MODE — never deletes existing content, only appends. Maintains Sources, Key Findings, Patterns & Connections, Gaps & Questions sections. Notes contradictions rather than resolving them. Each iteration adds new material without modifying what's already captured.

## Components Used

Shared components plus:
- `BrowserExplorer.tsx` — Inline website browsing for research (via Website tab)
- `ContextCapturePanel.tsx` — Primary panel for capturing sources, links, notes, images

## API Endpoints Used

All shared endpoints only.

## Key Behaviors

- **AGGREGATE writer mode**: This is critical — the document only grows. The `/api/write` endpoint in aggregate mode appends new content without modifying or deleting existing sections. This preserves the research trail.
- **Context tab first**: Unlike most apps, starts on the Context capture panel — research begins by gathering sources
- **Website browsing available**: Users can browse and capture from websites inline
- **Contradiction preservation**: System guidance explicitly notes contradictions between sources rather than resolving them — the user decides what to trust
- **Gap-finding focus**: Challenges specifically identify what's missing from the research, not what's wrong with it
- **Coming Soon**: Currently shows "Coming Soon" badge and cannot be selected from the landing page
