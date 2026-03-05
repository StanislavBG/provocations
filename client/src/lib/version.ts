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

export const APP_VERSION = "0.9.1";

export interface ReleaseNote {
  version: string;
  date: string;
  changes: string[];
}

export const RELEASE_NOTES: ReleaseNote[] = [
  {
    version: "0.9.1",
    date: "2026-03-05",
    changes: [
      "Fix double-click to expand on Trigger, LLM, Audio, and YouTube nodes",
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
