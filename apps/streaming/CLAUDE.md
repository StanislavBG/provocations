# Screen Capture — App Guide

> **Template ID**: `streaming` | **Category**: `analyze` | **Layout**: `standard`

## Purpose

Requirement discovery through visual observation. Users capture screenshots of existing applications, annotate them, and an AI agent guides a dialogue to extract structured requirements from what's observed. Transforms "I see this button here" into "The system shall support X workflow with Y constraints."

## Unique Behaviors

- **Visual-first workflow**: Starts with browsing and capturing, not writing
- **No auto-interview**: Uses agent-guided dialogue instead of interview phase
- **No draft questions**: Dialogue-driven approach replaces question-driven approach
- **Dialogue-driven requirements**: Requirements emerge from Q&A about captured screenshots, not templates
- **Wireframe analysis**: Can analyze entire website structure (site map, media assets, content hierarchy)
- **Empty starting document**: Requirements document is built entirely from dialogue extraction
- **Website/Capture tab opens first**: `defaultToolboxTab: website`

## Key Files

| Component | Path | Purpose |
|-----------|------|---------|
| `StreamingWorkspace` | `StreamingWorkspace.tsx` | 3-panel layout: browser + dialogue + document |
| `StreamingDialogue` | `StreamingDialogue.tsx` | Agent-guided Q&A with requirement extraction |
| `StreamingWireframePanel` | `StreamingWireframePanel.tsx` | Wireframe analysis: site map, media discovery |
| `BrowserExplorer` | `BrowserExplorer.tsx` | Embedded iframe for website browsing |
| `ScreenCaptureButton` | `ScreenCaptureButton.tsx` | Screenshot + annotation workflow |

## App-Specific Endpoints

- `POST /api/streaming/question` — Generate next dialogue question
- `POST /api/streaming/wireframe-analysis` — Analyze website structure
- `POST /api/streaming/refine` — Refine dialogue into structured requirements
- `POST /api/screenshot` — Server-side Playwright screenshot

See `docs/architecture.md` for the three-layer application pattern.
