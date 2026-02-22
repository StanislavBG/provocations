# Text to Infographic — App Guide

> **Template ID**: `text-to-infographic` | **Category**: `capture` | **Layout**: `infographic-studio` (unique)

## Purpose

Write a textual description and generate **visual infographics** via DALL-E image generation. Uses a unique 3-panel studio layout (raw text | summary + controls | image gallery). Personas challenge the text description before generation to improve visual output quality. Supports multi-image generation with enrichment options and slider controls.

## User Workflow

1. **Select** the Text to Infographic template from the landing page
2. **Write raw text** — Describe the infographic content in the left panel
3. **Summarize & expand** — Pipeline generates a structured summary with visual cues
4. **Configure** — Adjust enrichment options and slider controls (via Model Config tab)
5. **Generate images** — DALL-E generates infographic images from the specification
6. **Preview & iterate** — View generated images in the right panel gallery
7. **Provoke & refine** — Personas challenge clarity, visual hierarchy, data accuracy
8. **Output** — Infographic specification + generated images

## Three-Layer Definition

### Layer 1: PrebuiltTemplate (`client/src/lib/prebuiltTemplates.ts`)
- **Title**: Text to Infographic
- **Short Label**: Text -> Visual
- **Subtitle**: Text descriptions to visual infographics
- **Objective**: "Create a detailed infographic from a textual description by refining the layout, data points, and visual design..."
- **Draft Questions**:
  1. What is the main topic of the infographic?
  2. What are the key data points or facts to visualize?
  3. Who is the target audience?
  4. What visual style do you prefer?
- **Steps**: `[upload, transcript-summary, infographic]` (3 steps)
- **Provocation Sources**: Content Strategist, UX Designer, Clarity Editor, Visual Designer, Action Tracker
- **Template Content**: Infographic Description template:
  - Overview
  - Content Sections
  - Visual Design Preferences

### Layer 2: AppFlowConfig (`client/src/lib/appWorkspaceConfig.ts`)
- **Workspace Layout**: **`infographic-studio`** — unique 3-panel layout
- **Default Toolbox Tab**: `provoke`
- **Auto-Start Interview**: `false`
- **Auto-Start Personas**: none
- **Left Panel Tabs**: `[provoke, model-config, context]` — includes **Model Config** tab (unique)
- **Right Panel Tabs**: `[image-preview, discussion]` — includes **Image Preview** tab (unique)
- **Writer Config**:
  - Mode: `edit`
  - Output Format: `markdown`
  - Document Type: "infographic brief from text description"
  - Feedback Tone: "clarity-focused and visually structured"

### Layer 3: Context Builder (`server/context-builder.ts`)
- **Document Type**: "infographic specification from text description"
- **Feedback Tone**: "visual-design-focused and description-quality-driven"
- **Output Format**: `markdown`
- **System Guidance**: Helps write clear textual descriptions for infographic generation. Focuses on visual clarity (can this be drawn?), information hierarchy (what's most important?), audience fit (complexity level), data quality (are numbers accurate?), and layout specificity (grid, timeline, flowchart?).

## App-Specific Components

| Component | Path | Purpose |
|-----------|------|---------|
| `InfographicStudioWorkspace.tsx` | `client/src/components/InfographicStudioWorkspace.tsx` | 3-panel workspace: raw text panel, summary + controls panel, image gallery panel. Includes enrichment options, slider controls, multi-image generation |
| `InfographicPanel.tsx` | `client/src/components/InfographicPanel.tsx` | Visual display of generated infographic spec (shared with youtube-to-infographic) |
| `infographicPipeline.ts` | `client/src/lib/infographicPipeline.ts` | Client-side pipeline orchestrator (shared with youtube-to-infographic) |

## App-Specific API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/generate-image` | POST | DALL-E image generation from text description |
| `/api/pipeline/summarize` | POST | Generate summary from text (shared with youtube-to-infographic) |
| `/api/pipeline/infographic` | POST | Generate infographic spec from summary (shared with youtube-to-infographic) |

## Key Behaviors

- **Unique studio layout**: Only app using the `infographic-studio` layout — 3-panel workspace replaces standard layout
- **Model Config tab**: Unique panel for adjusting generation parameters (enrichment options, sliders)
- **Image Preview tab**: Unique right panel tab showing generated image gallery
- **DALL-E integration**: Actual image generation via OpenAI DALL-E API
- **No auto-interview**: Pipeline-driven workflow, not interview-driven
- **Description quality focus**: Personas challenge the text description quality before image generation — better descriptions produce better images
- **Multi-image generation**: Can generate multiple infographic variations in a single session
- **Shared pipeline**: Summarize and infographic endpoints shared with `youtube-to-infographic`
