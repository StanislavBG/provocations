/**
 * FlowNodeRegistry — Single Source of Truth
 *
 * Consolidates NODE_STYLES, NODE_ICONS, NODE_PORTS, DEFAULT_DIMENSIONS,
 * and behavior flags into one registry for all 17 flow node types.
 */

import {
  FileText,
  Sparkles,
  Brain,
  BookOpen,
  Paintbrush,
  MessageCircleQuestion,
  Clock,
  FileEdit,
  SquareDashedBottom,
  Mic,
  Youtube,
  Timer,
  Filter,
  ToggleRight,
  GitBranch,
  Merge,
  Type,
  Share2,
  Wifi,
  ShieldCheck,
  Bell,
  Upload,
  UserCheck,
  CircuitBoard,
  BrainCircuit,
} from "lucide-react";
import type { FlowNodeType, PortDef, EdgeRole } from "./useFlowCanvas";

// ── Style types ──

export interface FlowNodeStyle {
  border: string;
  bg: string;
  headerBg: string;
  headerBorder: string;
  iconClass: string;
  badgeBg: string;
  badgeText: string;
  badge: string;
  accent: string;
}

// ── Behavior types ──

export type ExpandMode = "overlay" | "dialog" | "none";
export type LifecyclePreset = "llm" | "stream" | "media" | "timer" | "passive" | "social" | "api" | "logic" | "interview" | "coherence" | "youtube" | "notification" | "approval" | "llm-base";

// ── Registry definition ──

export interface FlowNodeDefinition {
  type: FlowNodeType;

  /** Visual identity */
  style: FlowNodeStyle;
  icon: React.ElementType;

  /** Default dimensions when placed on canvas */
  defaultWidth: number;
  defaultHeight: number;

  /** Port configuration */
  ports: PortDef[];

  /** How the node expands on double-click */
  expandMode: ExpandMode;

  /** Whether the node shows a Play button on the compact card */
  playable: boolean;

  /** Whether chain execution can auto-trigger this node */
  supportsChainExecution: boolean;

  /** Lifecycle processing category */
  lifecyclePreset: LifecyclePreset;

  /** Minimum resize constraints */
  minWidth: number;
  minHeight: number;

  /** Edge roles this node actually processes. Empty = no role picker shown. */
  acceptedRoles: EdgeRole[];

  /** Verbose description of what this node accepts as input */
  inputDescription: string;
  /** Verbose description of what this node produces as output */
  outputDescription: string;
}

// ── The Registry ──

export const FLOW_NODE_REGISTRY: Record<FlowNodeType, FlowNodeDefinition> = {
  "context-doc": {
    type: "context-doc",
    style: {
      border: "border-amber-500/60",
      bg: "bg-card",
      headerBg: "bg-amber-500/15",
      headerBorder: "border-amber-500/40",
      iconClass: "text-amber-500",
      badgeBg: "bg-amber-500/25",
      badgeText: "text-amber-600 dark:text-amber-400",
      badge: "Context",
      accent: "amber",
    },
    icon: FileText,
    defaultWidth: 200,
    defaultHeight: 120,
    ports: [{ side: "right", type: "output" }],
    expandMode: "overlay",
    playable: false,
    supportsChainExecution: false,
    lifecyclePreset: "passive",
    minWidth: 140,
    minHeight: 80,
    acceptedRoles: [],
    inputDescription: "No input — loaded from Context Store. Contains the document title, content, and metadata.",
    outputDescription: "Full document text content. Connected downstream nodes receive the document body as context.",
  },
  research: {
    type: "research",
    style: {
      border: "border-blue-500/60",
      bg: "bg-card",
      headerBg: "bg-blue-500/15",
      headerBorder: "border-blue-500/40",
      iconClass: "text-blue-500",
      badgeBg: "bg-blue-500/25",
      badgeText: "text-blue-600 dark:text-blue-400",
      badge: "Research",
      accent: "blue",
    },
    icon: Sparkles,
    defaultWidth: 240,
    defaultHeight: 300,
    ports: [{ side: "left", type: "input" }, { side: "right", type: "output" }],
    expandMode: "overlay",
    playable: true,
    supportsChainExecution: true,
    lifecyclePreset: "stream",
    minWidth: 200,
    minHeight: 200,
    acceptedRoles: ["objective", "context", "output-format"],
    inputDescription: "Accepts three edge roles: Objective (what to research), Context (background documents), and Output Format (schema/template for structuring results).",
    outputDescription: "Produces a research document based on the objective, context, and output format. Can output 1 consolidated doc or N split docs depending on output mode.",
  },
  llm: {
    type: "llm",
    style: {
      border: "border-violet-500/60",
      bg: "bg-card",
      headerBg: "bg-violet-500/15",
      headerBorder: "border-violet-500/40",
      iconClass: "text-violet-500",
      badgeBg: "bg-violet-500/25",
      badgeText: "text-violet-600 dark:text-violet-400",
      badge: "Text Mods",
      accent: "violet",
    },
    icon: Brain,
    defaultWidth: 260,
    defaultHeight: 240,
    ports: [{ side: "left", type: "input" }, { side: "right", type: "output" }],
    expandMode: "overlay",
    playable: true,
    supportsChainExecution: true,
    lifecyclePreset: "llm",
    minWidth: 180,
    minHeight: 140,
    acceptedRoles: [],
    inputDescription: "Text content from connected source nodes. Applies a selected preset transformation (Summarize, Clean, Expand, or Custom instruction).",
    outputDescription: "Transformed text after applying the selected preset. The output replaces or appends to the node's content.",
  },
  store: {
    type: "store",
    style: {
      border: "border-primary/60",
      bg: "bg-card",
      headerBg: "bg-primary/15",
      headerBorder: "border-primary/40",
      iconClass: "text-primary",
      badgeBg: "bg-primary/25",
      badgeText: "text-primary",
      badge: "Store",
      accent: "primary",
    },
    icon: BookOpen,
    defaultWidth: 200,
    defaultHeight: 100,
    ports: [{ side: "left", type: "input" }],
    expandMode: "overlay",
    playable: false,
    supportsChainExecution: false,
    lifecyclePreset: "passive",
    minWidth: 140,
    minHeight: 70,
    acceptedRoles: [],
    inputDescription: "Receives content from upstream nodes to be saved. The destination folder and document name are configured on the node.",
    outputDescription: "No output — this is a terminal node. Content is persisted to the Context Store.",
  },
  painter: {
    type: "painter",
    style: {
      border: "border-rose-500/60",
      bg: "bg-card",
      headerBg: "bg-rose-500/15",
      headerBorder: "border-rose-500/40",
      iconClass: "text-rose-500",
      badgeBg: "bg-rose-500/25",
      badgeText: "text-rose-600 dark:text-rose-400",
      badge: "Painter",
      accent: "rose",
    },
    icon: Paintbrush,
    defaultWidth: 260,
    defaultHeight: 200,
    ports: [{ side: "left", type: "input" }, { side: "right", type: "output" }],
    expandMode: "overlay",
    playable: true,
    supportsChainExecution: true,
    lifecyclePreset: "media",
    minWidth: 180,
    minHeight: 140,
    acceptedRoles: [],
    inputDescription: "Text description or prompt that guides the image generation. Connected documents provide subject matter context.",
    outputDescription: "Generated image (PNG). The image URL is stored on the node and can be saved to Context Store.",
  },
  interview: {
    type: "interview",
    style: {
      border: "border-cyan-500/60",
      bg: "bg-card",
      headerBg: "bg-cyan-500/15",
      headerBorder: "border-cyan-500/40",
      iconClass: "text-cyan-500",
      badgeBg: "bg-cyan-500/25",
      badgeText: "text-cyan-600 dark:text-cyan-400",
      badge: "Interview",
      accent: "cyan",
    },
    icon: MessageCircleQuestion,
    defaultWidth: 220,
    defaultHeight: 140,
    ports: [{ side: "left", type: "input" }, { side: "right", type: "output" }],
    expandMode: "overlay",
    playable: true,
    supportsChainExecution: true,
    lifecyclePreset: "interview",
    minWidth: 180,
    minHeight: 100,
    acceptedRoles: ["objective", "context"],
    inputDescription: "Objective text and context documents that define the interview topic. Supports journalist stance configuration.",
    outputDescription: "Interview transcript (Q&A entries). Can be summarized into a structured document for downstream nodes.",
  },
  timeline: {
    type: "timeline",
    style: {
      border: "border-orange-500/60",
      bg: "bg-card",
      headerBg: "bg-orange-500/15",
      headerBorder: "border-orange-500/40",
      iconClass: "text-orange-500",
      badgeBg: "bg-orange-500/25",
      badgeText: "text-orange-600 dark:text-orange-400",
      badge: "Timeline",
      accent: "orange",
    },
    icon: Clock,
    defaultWidth: 260,
    defaultHeight: 160,
    ports: [{ side: "left", type: "input" }, { side: "right", type: "output" }],
    expandMode: "overlay",
    playable: true,
    supportsChainExecution: true,
    lifecyclePreset: "llm",
    minWidth: 180,
    minHeight: 100,
    acceptedRoles: [],
    inputDescription: "Text content describing events, milestones, or items to arrange chronologically.",
    outputDescription: "Structured timeline document with dated entries. Can feed into downstream document or store nodes.",
  },
  document: {
    type: "document",
    style: {
      border: "border-indigo-500/60",
      bg: "bg-card",
      headerBg: "bg-indigo-500/15",
      headerBorder: "border-indigo-500/40",
      iconClass: "text-indigo-500",
      badgeBg: "bg-indigo-500/25",
      badgeText: "text-indigo-600 dark:text-indigo-400",
      badge: "Document",
      accent: "indigo",
    },
    icon: FileEdit,
    defaultWidth: 200,
    defaultHeight: 130,
    ports: [{ side: "right", type: "output" }],
    expandMode: "overlay",
    playable: false,
    supportsChainExecution: false,
    lifecyclePreset: "passive",
    minWidth: 140,
    minHeight: 80,
    acceptedRoles: [],
    inputDescription: "No automatic input — content is edited directly or created by upstream nodes (e.g., research output).",
    outputDescription: "Markdown text content. Connected downstream nodes receive the full document text.",
  },
  zone: {
    type: "zone",
    style: {
      border: "border-muted-foreground/40",
      bg: "bg-muted/8",
      headerBg: "bg-muted/15",
      headerBorder: "border-muted-foreground/30",
      iconClass: "text-muted-foreground",
      badgeBg: "bg-muted/25",
      badgeText: "text-muted-foreground",
      badge: "Zone",
      accent: "primary",
    },
    icon: SquareDashedBottom,
    defaultWidth: 400,
    defaultHeight: 300,
    ports: [],
    expandMode: "none",
    playable: false,
    supportsChainExecution: false,
    lifecyclePreset: "passive",
    minWidth: 150,
    minHeight: 100,
    acceptedRoles: [],
    inputDescription: "No input — zones are visual grouping containers. They don't participate in data flow.",
    outputDescription: "No output — zones organize nodes visually but don't produce data.",
  },
  audio: {
    type: "audio",
    style: {
      border: "border-red-500/60",
      bg: "bg-card",
      headerBg: "bg-red-500/15",
      headerBorder: "border-red-500/40",
      iconClass: "text-red-500",
      badgeBg: "bg-red-500/25",
      badgeText: "text-red-600 dark:text-red-400",
      badge: "Audio",
      accent: "red",
    },
    icon: Mic,
    defaultWidth: 200,
    defaultHeight: 140,
    ports: [{ side: "right", type: "output" }],
    expandMode: "overlay",
    playable: false,
    supportsChainExecution: false,
    lifecyclePreset: "passive",
    minWidth: 140,
    minHeight: 100,
    acceptedRoles: [],
    inputDescription: "No input — records audio directly via microphone using Web Speech API for real-time transcription.",
    outputDescription: "Transcribed text from voice recording. Can be connected to LLM, Research, or Document nodes for processing.",
  },
  youtube: {
    type: "youtube",
    style: {
      border: "border-red-600/60",
      bg: "bg-card",
      headerBg: "bg-red-600/15",
      headerBorder: "border-red-600/40",
      iconClass: "text-red-600",
      badgeBg: "bg-red-600/25",
      badgeText: "text-red-700 dark:text-red-400",
      badge: "YouTube",
      accent: "red",
    },
    icon: Youtube,
    defaultWidth: 240,
    defaultHeight: 170,
    ports: [{ side: "left", type: "input" }, { side: "right", type: "output" }],
    expandMode: "overlay",
    playable: true,
    supportsChainExecution: true,
    lifecyclePreset: "youtube",
    minWidth: 180,
    minHeight: 120,
    acceptedRoles: [],
    inputDescription: "YouTube URL, search keywords, or playlist URL. Can receive keywords from upstream context nodes for automated search.",
    outputDescription: "Extracted video transcript(s) with chapters and metadata. Multi-video mode merges all transcripts. Available as context for downstream nodes.",
  },
  "timer-event": {
    type: "timer-event",
    style: {
      border: "border-emerald-500/60",
      bg: "bg-card",
      headerBg: "bg-emerald-500/15",
      headerBorder: "border-emerald-500/40",
      iconClass: "text-emerald-500",
      badgeBg: "bg-emerald-500/25",
      badgeText: "text-emerald-600 dark:text-emerald-400",
      badge: "Trigger",
      accent: "emerald",
    },
    icon: Timer,
    defaultWidth: 200,
    defaultHeight: 160,
    ports: [{ side: "left", type: "input" }, { side: "right", type: "output" }],
    expandMode: "overlay",
    playable: false,
    supportsChainExecution: true,
    lifecyclePreset: "timer",
    minWidth: 140,
    minHeight: 100,
    acceptedRoles: [],
    inputDescription: "Trigger signal from upstream nodes or timer configuration. Can be timed (interval) or automated (on upstream completion).",
    outputDescription: "Fires a pulse signal to connected downstream nodes, triggering their execution in sequence.",
  },
  filter: {
    type: "filter",
    style: {
      border: "border-teal-500/60",
      bg: "bg-card",
      headerBg: "bg-teal-500/15",
      headerBorder: "border-teal-500/40",
      iconClass: "text-teal-500",
      badgeBg: "bg-teal-500/25",
      badgeText: "text-teal-600 dark:text-teal-400",
      badge: "Filter",
      accent: "emerald",
    },
    icon: Filter,
    defaultWidth: 220,
    defaultHeight: 130,
    ports: [{ side: "left", type: "input" }, { side: "right", type: "output" }],
    expandMode: "overlay",
    playable: false,
    supportsChainExecution: true,
    lifecyclePreset: "logic",
    minWidth: 160,
    minHeight: 90,
    acceptedRoles: [],
    inputDescription: "Content from upstream nodes. The filter evaluates a condition rule to decide what passes through.",
    outputDescription: "Filtered content — only items matching the condition rule are forwarded to downstream nodes.",
  },
  gate: {
    type: "gate",
    style: {
      border: "border-yellow-500/60",
      bg: "bg-card",
      headerBg: "bg-yellow-500/15",
      headerBorder: "border-yellow-500/40",
      iconClass: "text-yellow-500",
      badgeBg: "bg-yellow-500/25",
      badgeText: "text-yellow-600 dark:text-yellow-400",
      badge: "Gate",
      accent: "amber",
    },
    icon: ToggleRight,
    defaultWidth: 180,
    defaultHeight: 120,
    ports: [{ side: "left", type: "input" }, { side: "right", type: "output" }],
    expandMode: "overlay",
    playable: false,
    supportsChainExecution: true,
    lifecyclePreset: "logic",
    minWidth: 130,
    minHeight: 80,
    acceptedRoles: [],
    inputDescription: "Content from upstream nodes. The gate blocks or allows content based on its open/closed state.",
    outputDescription: "When open, passes content through unchanged. When closed, blocks all downstream propagation.",
  },
  "coherence-gate": {
    type: "coherence-gate",
    style: {
      border: "border-emerald-500/60",
      bg: "bg-card",
      headerBg: "bg-emerald-500/15",
      headerBorder: "border-emerald-500/40",
      iconClass: "text-emerald-500",
      badgeBg: "bg-emerald-500/25",
      badgeText: "text-emerald-600 dark:text-emerald-400",
      badge: "Coherence",
      accent: "emerald",
    },
    icon: ShieldCheck,
    defaultWidth: 160,
    defaultHeight: 160,
    ports: [{ side: "left", type: "input" }, { side: "right", type: "output" }],
    expandMode: "overlay",
    playable: true,
    supportsChainExecution: true,
    lifecyclePreset: "coherence",
    minWidth: 120,
    minHeight: 120,
    acceptedRoles: [],
    inputDescription: "Content from upstream nodes to evaluate for quality. Scores against configured checks and threshold.",
    outputDescription: "Pass: content forwarded with confidence score. Fail: blocks propagation or routes to retry branch.",
  },
  router: {
    type: "router",
    style: {
      border: "border-purple-500/60",
      bg: "bg-card",
      headerBg: "bg-purple-500/15",
      headerBorder: "border-purple-500/40",
      iconClass: "text-purple-500",
      badgeBg: "bg-purple-500/25",
      badgeText: "text-purple-600 dark:text-purple-400",
      badge: "Router",
      accent: "violet",
    },
    icon: GitBranch,
    defaultWidth: 220,
    defaultHeight: 140,
    ports: [{ side: "left", type: "input" }, { side: "right", type: "output" }],
    expandMode: "overlay",
    playable: false,
    supportsChainExecution: true,
    lifecyclePreset: "logic",
    minWidth: 160,
    minHeight: 100,
    acceptedRoles: [],
    inputDescription: "Content from upstream nodes. Routes to different output branches based on configured rules or labels.",
    outputDescription: "Distributes content to specific downstream nodes based on matching output labels.",
  },
  merge: {
    type: "merge",
    style: {
      border: "border-sky-500/60",
      bg: "bg-card",
      headerBg: "bg-sky-500/15",
      headerBorder: "border-sky-500/40",
      iconClass: "text-sky-500",
      badgeBg: "bg-sky-500/25",
      badgeText: "text-sky-600 dark:text-sky-400",
      badge: "Merge",
      accent: "blue",
    },
    icon: Merge,
    defaultWidth: 200,
    defaultHeight: 120,
    ports: [{ side: "left", type: "input" }, { side: "right", type: "output" }],
    expandMode: "overlay",
    playable: false,
    supportsChainExecution: true,
    lifecyclePreset: "logic",
    minWidth: 140,
    minHeight: 80,
    acceptedRoles: [],
    inputDescription: "Multiple input connections from different branches. Combines all incoming content into a single output.",
    outputDescription: "Merged content from all input sources, concatenated or interleaved based on arrival order.",
  },
  "social-post": {
    type: "social-post",
    style: {
      border: "border-pink-500/60",
      bg: "bg-card",
      headerBg: "bg-pink-500/15",
      headerBorder: "border-pink-500/40",
      iconClass: "text-pink-500",
      badgeBg: "bg-pink-500/25",
      badgeText: "text-pink-600 dark:text-pink-400",
      badge: "Social",
      accent: "pink",
    },
    icon: Share2,
    defaultWidth: 240,
    defaultHeight: 160,
    ports: [{ side: "left", type: "input" }, { side: "right", type: "output" }],
    expandMode: "overlay",
    playable: true,
    supportsChainExecution: true,
    lifecyclePreset: "social",
    minWidth: 180,
    minHeight: 120,
    acceptedRoles: [],
    inputDescription: "Text content to adapt for social media. Accepts intent, tone, and platform selection to guide generation.",
    outputDescription: "Platform-specific social posts (text + optional images). Each platform gets tailored content respecting character limits.",
  },
  "api-connection": {
    type: "api-connection",
    style: {
      border: "border-green-500/60",
      bg: "bg-card",
      headerBg: "bg-green-500/15",
      headerBorder: "border-green-500/40",
      iconClass: "text-green-500",
      badgeBg: "bg-green-500/25",
      badgeText: "text-green-600 dark:text-green-400",
      badge: "API",
      accent: "green",
    },
    icon: Wifi,
    defaultWidth: 220,
    defaultHeight: 140,
    ports: [{ side: "left", type: "input" }],
    expandMode: "overlay",
    playable: true,
    supportsChainExecution: true,
    lifecyclePreset: "api",
    minWidth: 160,
    minHeight: 100,
    acceptedRoles: [],
    inputDescription: "Content from upstream social post nodes or documents. Publishes to configured external API (X, LinkedIn, etc.).",
    outputDescription: "Post result status (success/failure, external ID). Logs all publish attempts with timestamps.",
  },
  notification: {
    type: "notification",
    style: {
      border: "border-pink-500/60",
      bg: "bg-card",
      headerBg: "bg-pink-500/15",
      headerBorder: "border-pink-500/40",
      iconClass: "text-pink-500",
      badgeBg: "bg-pink-500/25",
      badgeText: "text-pink-600 dark:text-pink-400",
      badge: "Notify",
      accent: "pink",
    },
    icon: Bell,
    defaultWidth: 220,
    defaultHeight: 140,
    ports: [{ side: "left", type: "input" }],
    expandMode: "overlay",
    playable: true,
    supportsChainExecution: true,
    lifecyclePreset: "notification",
    minWidth: 160,
    minHeight: 100,
    acceptedRoles: [],
    inputDescription: "Content from upstream nodes. When triggered, sends a notification with a summary of the input to assigned users.",
    outputDescription: "Notification delivery status (sent/failed). Terminal node — no downstream output.",
  },
  upload: {
    type: "upload",
    style: {
      border: "border-emerald-500/60",
      bg: "bg-card",
      headerBg: "bg-emerald-500/15",
      headerBorder: "border-emerald-500/40",
      iconClass: "text-emerald-500",
      badgeBg: "bg-emerald-500/25",
      badgeText: "text-emerald-600 dark:text-emerald-400",
      badge: "Upload",
      accent: "emerald",
    },
    icon: Upload,
    defaultWidth: 220,
    defaultHeight: 160,
    ports: [{ side: "right", type: "output" }],
    expandMode: "overlay",
    playable: false,
    supportsChainExecution: false,
    lifecyclePreset: "passive",
    minWidth: 160,
    minHeight: 120,
    acceptedRoles: [],
    inputDescription: "No input — files are uploaded directly by the user via drag-and-drop or file browser.",
    outputDescription: "File content (text for documents, base64 data URL for media). Connected downstream nodes receive the uploaded content.",
  },
  approval: {
    type: "approval",
    style: {
      border: "border-amber-500/60",
      bg: "bg-card",
      headerBg: "bg-amber-500/15",
      headerBorder: "border-amber-500/40",
      iconClass: "text-amber-500",
      badgeBg: "bg-amber-500/25",
      badgeText: "text-amber-600 dark:text-amber-400",
      badge: "Approval",
      accent: "amber",
    },
    icon: UserCheck,
    defaultWidth: 220,
    defaultHeight: 140,
    ports: [{ side: "left", type: "input" }, { side: "right", type: "output" }],
    expandMode: "overlay",
    playable: true,
    supportsChainExecution: true,
    lifecyclePreset: "approval",
    minWidth: 160,
    minHeight: 100,
    acceptedRoles: [],
    inputDescription: "Content from upstream nodes. When triggered, sends an approval request to assigned users and blocks the chain until approved.",
    outputDescription: "When approved, passes upstream content through to downstream nodes. When rejected, blocks downstream propagation.",
  },
  label: {
    type: "label",
    style: {
      border: "border-stone-400/40",
      bg: "bg-transparent",
      headerBg: "bg-stone-500/10",
      headerBorder: "border-stone-400/30",
      iconClass: "text-stone-500",
      badgeBg: "bg-stone-500/20",
      badgeText: "text-stone-600 dark:text-stone-400",
      badge: "Label",
      accent: "stone",
    },
    icon: Type,
    defaultWidth: 200,
    defaultHeight: 60,
    ports: [],
    expandMode: "dialog",
    playable: false,
    supportsChainExecution: false,
    lifecyclePreset: "passive",
    minWidth: 60,
    minHeight: 24,
    acceptedRoles: [],
    inputDescription: "No input — labels are text annotations placed on the canvas for organizational purposes.",
    outputDescription: "No output — labels don't participate in data flow. They are visual-only elements.",
  },
  "llm-base": {
    type: "llm-base",
    style: {
      border: "border-fuchsia-500/60",
      bg: "bg-card",
      headerBg: "bg-fuchsia-500/15",
      headerBorder: "border-fuchsia-500/40",
      iconClass: "text-fuchsia-500",
      badgeBg: "bg-fuchsia-500/25",
      badgeText: "text-fuchsia-600 dark:text-fuchsia-400",
      badge: "LLM",
      accent: "fuchsia",
    },
    icon: BrainCircuit,
    defaultWidth: 260,
    defaultHeight: 200,
    ports: [{ side: "left", type: "input" }, { side: "right", type: "output" }],
    expandMode: "overlay",
    playable: true,
    supportsChainExecution: true,
    lifecyclePreset: "llm-base",
    minWidth: 180,
    minHeight: 140,
    acceptedRoles: ["context", "user-prompt"],
    inputDescription: "Accepts context edges (background material injected into system prompt) and user-prompt edges (become the user message). Full model configuration with temperature, top-p, top-k, safety, and search grounding.",
    outputDescription: "Raw LLM output text. Supports any model (Gemini, OpenAI, Anthropic) with unrestricted defaults for maximum flexibility.",
  },
};

// ── Derived convenience accessors (backward-compatible) ──

/** Accent color → Tailwind bg class (used by overlays and chain nav bar) */
export const ACCENT_BG: Record<string, string> = {
  amber: "bg-amber-500",
  blue: "bg-blue-500",
  violet: "bg-violet-500",
  primary: "bg-primary",
  rose: "bg-rose-500",
  cyan: "bg-cyan-500",
  orange: "bg-orange-500",
  indigo: "bg-indigo-500",
  red: "bg-red-500",
  emerald: "bg-emerald-500",
  teal: "bg-teal-500",
  yellow: "bg-yellow-500",
  purple: "bg-purple-500",
  sky: "bg-sky-500",
  stone: "bg-stone-500",
  pink: "bg-pink-500",
  green: "bg-green-500",
  fuchsia: "bg-fuchsia-500",
};

/** Node types that benefit from role-typed input edges (derived from acceptedRoles) */
export const ROLE_AWARE_TARGETS = new Set<FlowNodeType>(
  Object.values(FLOW_NODE_REGISTRY)
    .filter((def) => def.acceptedRoles.length > 0)
    .map((def) => def.type),
);

/** Node types that show the Play button on their compact card */
export const PLAYABLE_TYPES = new Set<FlowNodeType>(
  Object.values(FLOW_NODE_REGISTRY)
    .filter((def) => def.playable)
    .map((def) => def.type),
);

/** Derived NODE_STYLES map — backward-compatible with FlowNodeRenderer consumers */
export const NODE_STYLES: Record<FlowNodeType, FlowNodeStyle> =
  Object.fromEntries(
    Object.entries(FLOW_NODE_REGISTRY).map(([k, v]) => [k, v.style]),
  ) as Record<FlowNodeType, FlowNodeStyle>;

/** Derived NODE_ICONS map — backward-compatible with FlowNodeRenderer consumers */
export const NODE_ICONS: Record<FlowNodeType, React.ElementType> =
  Object.fromEntries(
    Object.entries(FLOW_NODE_REGISTRY).map(([k, v]) => [k, v.icon]),
  ) as Record<FlowNodeType, React.ElementType>;

/** Derived NODE_PORTS map — backward-compatible with useFlowCanvas consumers */
export const NODE_PORTS: Partial<Record<FlowNodeType, PortDef[]>> =
  Object.fromEntries(
    Object.entries(FLOW_NODE_REGISTRY)
      .filter(([, v]) => v.ports.length > 0)
      .map(([k, v]) => [k, v.ports]),
  ) as Partial<Record<FlowNodeType, PortDef[]>>;

/** Derived DEFAULT_DIMENSIONS map — backward-compatible with useFlowCanvas consumers */
export const DEFAULT_DIMENSIONS: Record<FlowNodeType, { width: number; height: number }> =
  Object.fromEntries(
    Object.entries(FLOW_NODE_REGISTRY).map(([k, v]) => [
      k,
      { width: v.defaultWidth, height: v.defaultHeight },
    ]),
  ) as Record<FlowNodeType, { width: number; height: number }>;

// ── Dock Tool Catalog — single source of truth for all dock-able tools ──

export interface DockToolCatalogEntry {
  toolId: string;
  label: string;
  icon: React.ElementType;
  iconName: string;
  group: "gather" | "workshop" | "build";
  description: string;
}

/**
 * Canonical list of all tools available in the dock and Workspace Tools gateway.
 * AleComponentGateway, FtuxDock, and FlowWorkspace all derive from this catalog.
 */
export const DOCK_TOOL_CATALOG: DockToolCatalogEntry[] = [
  // ── Gather ──
  { toolId: "context", label: "Context", icon: BookOpen, iconName: "BookOpen", group: "gather", description: "Load saved documents, notes, or files from your library to use as input on the canvas" },
  { toolId: "label", label: "Label", icon: Type, iconName: "Type", group: "gather", description: "Place a text label on the canvas to name sections or add notes for yourself" },
  { toolId: "zone", label: "Zone", icon: SquareDashedBottom, iconName: "SquareDashedBottom", group: "gather", description: "Draw a colored box around related nodes to visually group them together" },
  { toolId: "audio", label: "Audio Capture", icon: Mic, iconName: "Mic", group: "gather", description: "Record your voice and get an automatic text transcript you can feed into other tools" },
  { toolId: "youtube", label: "YouTube", icon: Youtube, iconName: "Youtube", group: "gather", description: "Paste a YouTube link to pull its transcript, or search for videos and playlists" },
  { toolId: "upload", label: "Upload", icon: Upload, iconName: "Upload", group: "gather", description: "Drag-and-drop images, PDFs, or text files onto the canvas to use as input" },
  // ── Workshop ──
  { toolId: "research", label: "Research", icon: Sparkles, iconName: "Sparkles", group: "workshop", description: "Chat with AI to explore a topic — ask questions, get insights, and save findings to the canvas" },
  { toolId: "interview", label: "Interview", icon: MessageCircleQuestion, iconName: "MessageCircleQuestion", group: "workshop", description: "AI asks you structured questions to draw out your ideas and capture them as organized notes" },
  // ── Build ──
  { toolId: "llm", label: "Text Mods", icon: Brain, iconName: "Brain", group: "build", description: "Transform connected text: summarize it, expand it, clean it up, or apply a custom instruction" },
  { toolId: "painter", label: "Painter", icon: Paintbrush, iconName: "Paintbrush", group: "build", description: "Describe what you want and AI generates an image — great for illustrations and concepts" },
  { toolId: "timeline", label: "Timeline", icon: Clock, iconName: "Clock", group: "build", description: "Turn dates and events from connected nodes into a visual timeline" },
  { toolId: "timer-event", label: "Trigger", icon: Timer, iconName: "Timer", group: "build", description: "Set a timer or schedule to automatically run connected nodes after a delay" },
  { toolId: "logic", label: "Logic", icon: CircuitBoard, iconName: "CircuitBoard", group: "build", description: "Control how data flows between nodes — filter, split, merge, or check quality before passing on" },
  { toolId: "social-post", label: "Social Post", icon: Share2, iconName: "Share2", group: "build", description: "Turn your content into ready-to-post social media updates for Twitter, LinkedIn, etc." },
  { toolId: "api-connection", label: "API Post", icon: Wifi, iconName: "Wifi", group: "build", description: "Send your finished content to an external service or webhook via API" },
  { toolId: "notification", label: "Notify", icon: Bell, iconName: "Bell", group: "build", description: "Get notified when a chain of tools finishes processing your content" },
  { toolId: "approval", label: "Approval", icon: UserCheck, iconName: "UserCheck", group: "build", description: "Add a checkpoint that pauses the chain until you review and approve the output" },
  { toolId: "llm-base", label: "LLM", icon: BrainCircuit, iconName: "BrainCircuit", group: "build", description: "Direct AI prompt — write your own instructions with full control over model and settings" },
];
