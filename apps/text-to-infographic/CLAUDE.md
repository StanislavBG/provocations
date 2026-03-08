# Text to Infographic — App Guide

> **Template ID**: `text-to-infographic` | **Category**: `capture` | **Layout**: `infographic-studio` (unique)

## Purpose

Write a textual description and generate visual infographics via image generation. Uses a unique 3-panel studio layout (raw text | summary + controls | image gallery). Personas challenge the text description before generation to improve visual output quality.

## Unique Behaviors

- **Unique studio layout**: Only app using `infographic-studio` — 3-panel workspace replaces standard layout
- **Model Config tab**: Unique panel for adjusting generation parameters (enrichment options, sliders)
- **Image Preview tab**: Unique right panel tab showing generated image gallery
- **Image generation**: Actual image generation via DALL-E API
- **Description quality focus**: Personas challenge the text description quality before image generation
- **Multi-image generation**: Can generate multiple infographic variations in a single session
- **Shared pipeline**: Summarize and infographic endpoints shared with `youtube-to-infographic`
- **No auto-interview**: Pipeline-driven workflow, not interview-driven

## Key Files

| Component | Path | Purpose |
|-----------|------|---------|
| `InfographicStudioWorkspace` | `InfographicStudioWorkspace.tsx` | 3-panel workspace: text, controls, gallery |
| `InfographicPanel` | `InfographicPanel.tsx` | Infographic spec display (shared) |
| `infographicPipeline` | `lib/infographicPipeline.ts` | Client-side pipeline orchestrator (shared) |

## App-Specific Endpoints

- `POST /api/generate-image` — Image generation from text
- `POST /api/pipeline/summarize` — Generate summary (shared)
- `POST /api/pipeline/infographic` — Generate infographic spec (shared)

See `docs/architecture.md` for the three-layer application pattern.
