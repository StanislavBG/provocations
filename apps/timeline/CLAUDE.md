# Timeline — App-Specific Guide

## Identity

| Field | Value |
|-------|-------|
| **Template ID** | `timeline` |
| **Title** | Timeline |
| **Category** | `build` |
| **Layout** | `timeline` (custom workspace) |
| **Writer Mode** | `edit` |
| **Status** | Alpha |

## Philosophy

The Timeline app enables users to map events in strict chronological order, transforming unstructured notes and interview responses into a structured, interactive timeline. The core principle is that **chronological accuracy is paramount** — every event must be placed in time, tagged for discoverability, and connected to people, places, and themes.

The AI doesn't build the timeline for you — it extracts structure from your words and challenges you to fill gaps, resolve ambiguities, and discover patterns across time.

## User Workflow

1. **Set the subject** — Describe what the timeline is about (a person's life, a project, an era)
2. **Capture events** — Through interviews, notes, or manual entry
3. **AI transforms** — Notes are converted to structured timeline events via a single LLM call
4. **Organize & tag** — Apply people, place, and theme tags to events
5. **Explore** — Zoom in/out, filter by tags, and discover patterns

## Three-Layer Definition

### Layer 1: UI Identity (`prebuiltTemplates.ts`)

```typescript
{
  id: "timeline",
  category: "build",
  statusLabel: "alpha",
  title: "Timeline",
  shortLabel: "Timeline",
  icon: Clock,
  objective: "Build a clear, chronologically accurate timeline...",
  draftQuestions: [
    "What is the subject or scope of this timeline?",
    "What is the earliest event or starting point?",
    "What are the major milestones or turning points?",
    "Who are the key people involved?",
    "What categories or themes should events be grouped into?",
  ],
}
```

### Layer 2: Workspace Config (`appWorkspaceConfig.ts`)

```typescript
timeline: {
  workspaceLayout: "timeline",      // Custom workspace layout
  defaultToolboxTab: "context",
  autoStartInterview: false,
  flowSteps: [
    { id: "capture", label: "Capture Events" },
    { id: "organize", label: "Organize & Tag" },
    { id: "explore", label: "Explore Timeline" },
  ],
  leftPanelTabs: [TAB_CONTEXT, TAB_PROVOKE, TAB_CHAT],
  rightPanelTabs: [RIGHT_DISCUSSION, RIGHT_TRANSCRIPT],
  objectiveConfig: {
    primaryLabel: "Timeline Subject",
    secondaryLabel: "Focus Area",
  },
  writer: {
    mode: "edit",
    outputFormat: "markdown",
    documentType: "timeline document",
    feedbackTone: "chronologically precise and analytically curious",
  },
}
```

### Layer 3: LLM Guidance (`context-builder.ts`)

The system guidance focuses on:
- Chronological accuracy as the paramount concern
- Extracting structured events from notes/interviews
- Challenging gaps in the timeline
- Pushing for specific dates and tagged events
- Distinguishing facts from inferences

## App-Specific Components

| Component | Location | Purpose |
|-----------|----------|---------|
| `TimelineWorkspace` | `client/src/components/timeline/TimelineWorkspace.tsx` | Main workspace orchestrator with toolbar, canvas, and properties |
| `TimelineCanvas` | `client/src/components/timeline/TimelineCanvas.tsx` | Vertical timeline visualization with period grouping |
| `TimelineToolbar` | `client/src/components/timeline/TimelineToolbar.tsx` | Add events/tags, zoom, filter, search, undo/redo, export/import |
| `TimelineProperties` | `client/src/components/timeline/TimelineProperties.tsx` | Selected event property editor (title, date, type, tags, description) |
| `types.ts` | `client/src/components/timeline/types.ts` | All timeline type definitions and helpers |
| `useTimelineState` | `client/src/components/timeline/hooks/useTimelineState.ts` | Full state management with undo/redo history |

## App-Specific API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/timeline/transform` | POST | Transform free-form notes into structured timeline events via LLM |

### Transform API

**Request:**
```json
{
  "notes": "Free-form text with events, dates, people...",
  "existingTags": [
    { "id": "tag1", "label": "John", "category": "person" }
  ]
}
```

**Response:**
```json
{
  "events": [
    {
      "title": "Moved to New York",
      "description": "Relocated for a new job at...",
      "date": "2015-06",
      "dateLabel": "June 2015",
      "dateConfidence": "approximate",
      "type": "milestone",
      "tags": ["John", "New York"],
      "source": "note"
    }
  ],
  "suggestedTags": [
    { "label": "New York", "category": "place" }
  ]
}
```

## Key Behaviors

### Timeline Data Model

- **Events**: Core data unit with title, date, description, type, tags, and confidence
- **Tags**: Categorized as person, place, or theme with custom colors
- **Viewport**: Zoom levels from decades → years → months → days
- **Filters**: By tags, event types, date range, and search text

### Event Types

| Type | Color | Use Case |
|------|-------|----------|
| `milestone` | Amber | Major turning points |
| `phase` | Blue | Periods/eras with start and end dates |
| `decision` | Purple | Key choices made |
| `delivery` | Green | Completions and outputs |
| `event` | Slate | General occurrences |

### Tag Categories

| Category | Color | Examples |
|----------|-------|----------|
| `person` | Pink | People involved in events |
| `place` | Cyan | Locations tied to events |
| `theme` | Orange | Recurring themes or categories |

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Ctrl+Z` | Undo |
| `Ctrl+Y` / `Ctrl+Shift+Z` | Redo |
| `Delete` / `Backspace` | Delete selected events |
| `Escape` | Clear selection |

### Overlay System (Future)

The architecture supports overlay views as read-only filters on tagged data:
- Input: Timeline ID + filter criteria (tags, date ranges)
- Output: Dynamic visual representation of filtered events
- Overlays are distinct views, not separate data stores
