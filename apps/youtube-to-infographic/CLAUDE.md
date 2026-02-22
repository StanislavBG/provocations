# YouTube to Infographic — App Guide

> **Template ID**: `youtube-to-infographic` | **Category**: `capture` | **Layout**: `standard` | **Status**: Coming Soon

## Purpose

Fetches videos from a YouTube channel, extracts transcripts, summarizes content, and generates **infographic specifications**. Transforms video content into visual narrative layouts. Uses a multi-step pipeline: Channel → Video Selection → Transcript → Summary → Infographic Spec.

## User Workflow

1. **Select** the YouTube to Infographic template from the landing page
2. **Enter YouTube channel** — provide channel URL or handle
3. **Select videos** — browse video list, select which to process
4. **Transcript extraction** — AI generates/fetches video transcripts
5. **Summarize** — Pipeline summarizes transcript into key points
6. **Generate infographic** — Pipeline produces visual layout specification
7. **Provoke & refine** — Personas challenge information density, narrative arc, visual hierarchy
8. **Output** — Infographic specification with layout, sections, colors, data points

## Three-Layer Definition

### Layer 1: PrebuiltTemplate (`client/src/lib/prebuiltTemplates.ts`)
- **Title**: YouTube to Infographic
- **Short Label**: YouTube
- **Subtitle**: Channel videos to visual summaries
- **Objective**: "Transform YouTube video content into structured infographic specifications..."
- **Draft Questions**:
  1. What YouTube channel are you interested in?
  2. Are these tips, tutorials, or thought-leadership videos?
  3. Who is the target audience for the infographic?
  4. Single video or a multi-video series summary?
- **Steps**: `[channel, transcript-summary, infographic]` (3 steps)
- **Provocation Sources**: Content Strategist, UX Designer, Data Journalist, Visual Designer, Accessibility Expert
- **Template Content**: Infographic Brief template:
  - Source Information
  - Transcript Summary
  - Infographic Layout Specification
  - Generated Artifacts

### Layer 2: AppFlowConfig (`client/src/lib/appWorkspaceConfig.ts`)
- **Workspace Layout**: `standard`
- **Default Toolbox Tab**: `context` — starts on Context tab
- **Auto-Start Interview**: `false`
- **Auto-Start Personas**: none
- **Left Panel Tabs**: `[provoke, context]`
- **Right Panel Tabs**: `[discussion]`
- **Writer Config**:
  - Mode: `edit`
  - Output Format: `markdown`
  - Document Type: "infographic brief from YouTube content"
  - Feedback Tone: "visual-design-focused and data-driven"

### Layer 3: Context Builder (`server/context-builder.ts`)
- **Document Type**: "infographic spec from YouTube content"
- **Feedback Tone**: "visual-design-focused and narrative-driven"
- **Output Format**: `markdown`
- **System Guidance**: Visual narrative extraction from video content. Challenges information density (too much for one infographic?), narrative arc (does the visual tell a story?), visual hierarchy (what's the hero data point?), source fidelity (does the infographic accurately represent the video?), and audience fit.

## App-Specific Components

| Component | Path | Purpose |
|-----------|------|---------|
| `YouTubeChannelInput.tsx` | `client/src/components/YouTubeChannelInput.tsx` | Channel URL input, video list fetching, video selection, processing trigger |
| `InfographicPanel.tsx` | `client/src/components/InfographicPanel.tsx` | Visual display of generated infographic spec (shared with text-to-infographic) |
| `infographicPipeline.ts` | `client/src/lib/infographicPipeline.ts` | Client-side pipeline orchestrator: transcript → summary → infographic (shared with text-to-infographic) |

## App-Specific API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/youtube/channel` | POST | Fetch videos from a YouTube channel (currently LLM-simulated, not real YouTube API) |
| `/api/youtube/process-video` | POST | Extract/generate video transcript |
| `/api/pipeline/summarize` | POST | Generate summary from transcript (shared with text-to-infographic) |
| `/api/pipeline/infographic` | POST | Generate infographic spec from summary (shared with text-to-infographic) |

## Key Behaviors

- **Multi-step pipeline**: 3 distinct phases (Channel → Transcript/Summary → Infographic) tracked by step indicators
- **YouTube API is simulated**: Currently uses LLM to simulate channel/video data — not connected to real YouTube API
- **No auto-interview**: Pipeline-driven, not interview-driven
- **Shared pipeline**: `summarize` and `infographic` endpoints are shared with `text-to-infographic`
- **Shared InfographicPanel**: Visual display component is shared with `text-to-infographic`
- **Coming Soon**: Currently shows "Coming Soon" badge and cannot be selected
