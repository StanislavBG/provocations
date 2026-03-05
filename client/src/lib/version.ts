/**
 * Application version — single source of truth.
 *
 * Versioning follows semver (major.minor.patch):
 * - major: breaking changes or major architectural shifts (we're pre-1.0)
 * - minor: new features, new node types, new capabilities
 * - patch: bug fixes, UI tweaks, small improvements
 *
 * Update this file with every code change / git commit.
 */

export const APP_VERSION = "0.11.1";

export interface ReleaseNote {
  version: string;
  date: string;
  changes: string[];
}

export const RELEASE_NOTES: ReleaseNote[] = [
  {
    version: "0.11.1",
    date: "2026-03-05",
    changes: [
      "Social node: upstream images from painter nodes auto-attached to posts; generate images toggle now calls /api/generate-image",
      "Connection handles: port dots enlarged (14px), always partially visible, larger hit area for easier grabbing, hover scale effect",
      "YouTube node: search results now show thumbnails with click-to-preview video player on right side",
      "YouTube node: dedicated lifecycle handler — auto-detects URL vs search keywords from upstream audio/text nodes in chain execution",
      "Audio node: now sets llmStatus=done and documentContent on recording stop for proper chain propagation to downstream nodes",
      "Interview: mode selector changed to mutually exclusive 'Conversation' vs 'One at a Time' toggle (no longer two independent switches)",
      "Interview: trueInterview mode now defaults to ON and persists to node config (survives overlay close/reopen)",
      "Interview: fixed conversation continuation — re-entrant handleAnswer guard + conversation turn state machine fix (transition to PROCESSING before callback)",
    ],
  },
  {
    version: "0.11.0",
    date: "2026-03-05",
    changes: [
      "YouTube node: 3-mode input (URL, Search, Playlist) with multi-video transcript fetching",
      "YouTube node: auto chapter detection, thumbnail preview, embedded player, search within transcript",
      "YouTube node: search by keywords with Top N / manual selection of results to process",
      "YouTube node: chain propagation fix (sets llmStatus=done so downstream nodes auto-trigger)",
      "YouTube node: playable=true, thumbnail on compact card, removed fake LLM transcript fallback",
      "YouTube API: new /api/youtube/search and /api/youtube/playlist endpoints",
      "Interview: no longer requires objective to start — opens with 'What would you like to discuss?' and infers objective from first answer",
      "Interview: ElevenLabs now preferred TTS provider (when available) with voice selection UI",
      "Interview: voice picker shows ElevenLabs voices and OpenAI voice options when TTS enabled",
      "TTS endpoint: auto-selects ElevenLabs when available, falls back to OpenAI",
      "Status bar: fixed icons for Context Library, Logic, and Research pinned items",
      "Status bar: Logic submenu no longer positions off-screen when status bar is at top",
    ],
  },
  {
    version: "0.10.0",
    date: "2026-03-05",
    changes: [
      "Lifecycle-driven execution: handlePlayNode now delegates to lifecycle handlers for all node types",
      "Extended NodeProcessContext with role-based inputs (objectiveText, contextText, templateContent)",
      "Added gatherInputContentWithRoles for edge-role-aware input collection",
      "Upgraded research handler with full outputConfig support (split, focus, responseConfig, templates)",
      "Upgraded LLM handler to use preset system (Summarize, Clean Up, Expand, Custom)",
      "System-level chain propagation: reactive watcher auto-propagates when any node reaches done",
      "Post-processing routed by lifecyclePreset: media→image, social→multi-doc, api→status, coherence→pass/fail, text→split/consolidated",
      "Manual mode on compact trigger node with Zap fire button",
      "Fix canvas rename persistence: use PATCH instead of PUT for title-only updates",
      "Restructure menus: File→Canvas Manager with Save, Open, Share, New Canvas",
      "Remove Share dropdown; move Connections and Platform Integrations to Settings gear",
      "Unify New Canvas and New Tab into single New Canvas action",
      "Show timestamps next to canvas names in Open Canvas dialog",
    ],
  },
  {
    version: "0.9.2",
    date: "2026-03-05",
    changes: [
      "Fix double-click expand: move handler to root div, stopPropagation on interactive body areas",
      "Matches pattern used by Research and Document nodes for reliable expand on all node types",
    ],
  },
  {
    version: "0.9.1",
    date: "2026-03-05",
    changes: [
      "Add onDoubleClick prop to Trigger, LLM, Audio, and YouTube nodes",
    ],
  },
  {
    version: "0.9.0",
    date: "2026-03-05",
    changes: [
      "Add version watermark on canvas and release notes in settings",
      "Enforce versioning conventions in CLAUDE.md",
    ],
  },
  {
    version: "0.8.0",
    date: "2026-03-04",
    changes: [
      "Canvas save/share/load fixes",
      "Blueprint rebrand (demo templates → blueprints)",
      "Auto-trigger chain execution with autoTriggerNext flag",
      "Activity log grouped-by-node view with expand/collapse",
      "Chain context enrichment (chainContext on NodeProcessContext)",
    ],
  },
  {
    version: "0.7.0",
    date: "2026-03-01",
    changes: [
      "Coherence gate node for quality checks",
      "Node pulsing animations during chain execution",
      "Demo chain templates via /api/blueprints",
    ],
  },
  {
    version: "0.6.0",
    date: "2026-02-28",
    changes: [
      "Export pipeline: Markdown + PDF download from document editor",
      "Version diffing for document nodes",
      "Provocation chains",
    ],
  },
  {
    version: "0.5.0",
    date: "2026-02-26",
    changes: [
      "Activity logs overlay with node logs tab",
      "Gear dropdown menu on nodes",
      "Replace/+New output mode toggle",
      "Minimap in View menu",
      "LLM node edge-based input",
    ],
  },
  {
    version: "0.4.0",
    date: "2026-02-24",
    changes: [
      "Multi-select group drag",
      "Social post platform filtering",
      "Consolidated canvas styling menu",
      "Vertical dock layout for left/right positions",
    ],
  },
  {
    version: "0.3.0",
    date: "2026-02-22",
    changes: [
      "Unique shareable URLs per canvas (/canvas/:id)",
      "Research split mode respects LLM output structure",
    ],
  },
  {
    version: "0.2.0",
    date: "2026-02-20",
    changes: [
      "Flow canvas workspace with dock-based node placement",
      "Node types: context-doc, research, llm, store, painter, interview, timeline, document",
      "Edge/connection system with data flow",
      "Logic nodes: filter, gate, router, merge",
      "Social post and API connection nodes",
    ],
  },
  {
    version: "0.1.0",
    date: "2026-02-15",
    changes: [
      "Initial notebook workspace with 3-panel layout",
      "14 built-in personas with challenge/advice loop",
      "Voice capture via Web Speech API",
      "Zero-knowledge AES-256-GCM encryption",
      "Context Store with document/folder tree",
    ],
  },
];
