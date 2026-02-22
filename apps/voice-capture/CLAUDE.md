# Voice Capture — App Guide

> **Template ID**: `voice-capture` | **Category**: `capture` | **Layout**: `voice-capture` (unique)

## Purpose

**Speak your ideas, structure them later.** Users start by talking — the AI captures, cleans, and structures spoken thoughts into organized documents. Uses a completely different workspace layout (single-page recording interface) and aggregate writer mode. Ideal for brainstorming, meeting notes, and stream-of-consciousness ideation.

## User Workflow

1. **Select** the Voice Capture template from the landing page
2. **Answer setup questions** — What are you going to talk about? Who is the audience? What format?
3. **Record** — Single-page recording interface with Web Speech API
4. **AI cleans** — Removes filler words, resolves contradictions, identifies action items
5. **Structure emerges** — AI imposes logical order while preserving the speaker's voice
6. **Iterate** — continue recording, document grows (aggregate mode)
7. **Output** — Structured voice capture: Session Context, Cleaned Notes, Structured Summary, Follow-Up Actions

## Three-Layer Definition

### Layer 1: PrebuiltTemplate (`client/src/lib/prebuiltTemplates.ts`)
- **Title**: Voice Capture
- **Short Label**: Voice
- **Subtitle**: Speak your ideas, structure them later
- **Objective**: "Capture spoken ideas and transform them into a structured, well-organized document that preserves the speaker's intent and key points"
- **Draft Questions**:
  1. What are you going to talk about?
  2. Who is the audience for the resulting document?
  3. What format should the output take?
- **Steps**: `[{ id: "capture", label: "Record your thoughts" }]`
- **Provocation Sources**: Clarity Editor, Intent Detector, Structure Coach, Devil's Advocate, Action Tracker
- **Template Content**: Voice Capture template:
  - Session Context
  - Raw Transcript
  - Cleaned Notes
  - Structured Summary
  - Follow-Up Actions

### Layer 2: AppFlowConfig (`client/src/lib/appWorkspaceConfig.ts`)
- **Workspace Layout**: **`voice-capture`** — completely different from standard 3-panel layout
- **Default Toolbox Tab**: `provoke`
- **Auto-Start Interview**: `false`
- **Auto-Start Personas**: none
- **Left Panel Tabs**: `[provoke, context]`
- **Right Panel Tabs**: `[discussion]`
- **Writer Config**:
  - Mode: **`aggregate`** — document grows additively, never deletes
  - Output Format: `markdown`
  - Document Type: "voice capture transcript"
  - Feedback Tone: "clarifying and structure-focused"

### Layer 3: Context Builder (`server/context-builder.ts`)
- **Document Type**: "voice capture document"
- **Feedback Tone**: "clarifying and structure-focused"
- **Output Format**: `markdown`
- **System Guidance**: Clarifying voice-to-text. Resolves spoken contradictions ("actually, I meant..."), identifies action items, imposes logical order on stream-of-consciousness input. Preserves the speaker's authentic voice — structures without sanitizing.

## App-Specific Components

| Component | Path | Purpose |
|-----------|------|---------|
| `VoiceCaptureWorkspace.tsx` | `client/src/components/VoiceCaptureWorkspace.tsx` | Single-page voice recording workspace with Web Speech API, auto-save, transcript display, session management |

This component replaces the entire standard workspace layout. It renders its own recording UI, transcript display, and document output — not the standard toolbox/document/discussion panels.

## App-Specific API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `GET /api/voice-capture-config` | GET | Fetch voice capture config (summary schedule, persist interval) |
| `GET /api/admin/voice-capture-config` | GET | Admin-only config read |
| `PUT /api/admin/voice-capture-config` | PUT | Admin-only config update |

## Key Behaviors

- **Unique workspace layout**: Only app that uses the `voice-capture` layout — completely replaces the standard 3-panel workspace
- **AGGREGATE writer mode**: Document only grows — each recording session appends, never overwrites
- **No auto-interview**: Users go straight to recording — no interview warmup
- **No draft questions in workspace**: Setup questions are answered before entering the workspace
- **Speaker voice preservation**: System guidance explicitly preserves the speaker's natural phrasing and tone
- **Action item extraction**: Automatically identifies and flags action items from spoken content
- **Configurable via admin**: Summary schedule and persist interval are admin-configurable
