# Screen Capture — App Guide

> **Template ID**: `streaming` | **Category**: `analyze` | **Layout**: `standard`

## Purpose

Requirement discovery through **visual observation**. Users capture screenshots of existing applications, annotate them, and an AI agent guides a dialogue to extract structured requirements from what's observed. Transforms "I see this button here" into "The system shall support X workflow with Y constraints."

## User Workflow

1. **Select** the Screen Capture template from the landing page
2. **Browse** — Website/Capture tab opens first with embedded iframe
3. **Capture** — Take screenshots, annotate with highlights and notes
4. **Dialogue** — AI agent asks questions about what you captured, extracting requirements
5. **Wireframe analysis** — AI analyzes website structure, site map, media assets
6. **Refine** — Dialogue entries are refined into a structured requirements document
7. **Output** — A requirements document built from visual observations

## Three-Layer Definition

### Layer 1: PrebuiltTemplate (`client/src/lib/prebuiltTemplates.ts`)
- **Title**: Screen Capture
- **Short Label**: Capture
- **Subtitle**: Screenshots & annotations to requirements
- **Objective**: "Discover and refine requirements through captured screenshots, annotations, and iterative questioning"
- **Draft Questions**: None (dialogue-driven approach, not question-driven)
- **Steps**: `[{ id: "capture", label: "Capture & annotate" }]`
- **Provocation Sources**: UX Researcher, Product Manager, Developer, End User, Accessibility Expert
- **Template Content**: Empty (requirements built through dialogue)

### Layer 2: AppFlowConfig (`client/src/lib/appWorkspaceConfig.ts`)
- **Workspace Layout**: `standard`
- **Default Toolbox Tab**: `website` — starts on the Capture tab, not Provoke
- **Auto-Start Interview**: `false`
- **Auto-Start Personas**: none
- **Left Panel Tabs**: `[website, provoke, context]` — Website first
- **Right Panel Tabs**: `[discussion]`
- **Writer Config**:
  - Mode: `edit`
  - Output Format: `markdown`
  - Document Type: "requirements document"
  - Feedback Tone: "precise and detail-oriented"

### Layer 3: Context Builder (`server/context-builder.ts`)
- **Document Type**: "requirements document"
- **Feedback Tone**: "precise and detail-oriented"
- **Output Format**: `markdown`
- **System Guidance**: Translates visual observations into structured requirements. Pushes for user flow completeness, edge case identification from UI elements, and accessibility considerations from observed layouts.

## App-Specific Components

| Component | Path | Purpose |
|-----------|------|---------|
| `StreamingWorkspace.tsx` | `client/src/components/StreamingWorkspace.tsx` | Resizable 3-panel layout: BrowserExplorer + StreamingDialogue + ReadingPane |
| `StreamingDialogue.tsx` | `client/src/components/StreamingDialogue.tsx` | Agent-guided Q&A dialogue with requirement extraction |
| `StreamingWireframePanel.tsx` | `client/src/components/StreamingWireframePanel.tsx` | Wireframe analysis: site map, media discovery, structure |
| `BrowserExplorer.tsx` | `client/src/components/BrowserExplorer.tsx` | Embedded iframe for website browsing |
| `ScreenCaptureButton.tsx` | `client/src/components/ScreenCaptureButton.tsx` | Screenshot + annotation workflow |

## App-Specific API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/streaming/question` | POST | Generate next dialogue question for requirements discovery |
| `/api/streaming/wireframe-analysis` | POST | Analyze website structure, discover site map, videos, audio, RSS, images, primary content |
| `/api/streaming/refine` | POST | Refine dialogue entries into structured requirements document |
| `/api/screenshot` | POST | Server-side Playwright screenshot capture |

## Key Behaviors

- **Visual-first workflow**: Starts with browsing and capturing, not writing
- **No auto-interview**: Unlike most apps, does not start with an interview phase
- **No draft questions**: Uses agent-guided dialogue instead
- **Dialogue-driven**: Requirements emerge from Q&A about captured screenshots, not from templates
- **Wireframe analysis**: Can analyze entire website structure (site map, media assets, content hierarchy)
- **Empty starting document**: Requirements document is built entirely from dialogue extraction
