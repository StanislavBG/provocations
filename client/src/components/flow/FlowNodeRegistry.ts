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
} from "lucide-react";
import type { FlowNodeType, PortDef } from "./useFlowCanvas";

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
export type LifecyclePreset = "llm" | "stream" | "media" | "timer" | "passive";

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
    defaultWidth: 220,
    defaultHeight: 140,
    ports: [{ side: "left", type: "input" }, { side: "right", type: "output" }],
    expandMode: "overlay",
    playable: true,
    supportsChainExecution: true,
    lifecyclePreset: "stream",
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
    playable: false,
    supportsChainExecution: true,
    lifecyclePreset: "llm",
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
    expandMode: "dialog",
    playable: false,
    supportsChainExecution: false,
    lifecyclePreset: "passive",
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
    lifecyclePreset: "stream",
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
    playable: false,
    supportsChainExecution: true,
    lifecyclePreset: "stream",
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
      badge: "Timer",
      accent: "emerald",
    },
    icon: Timer,
    defaultWidth: 200,
    defaultHeight: 160,
    ports: [{ side: "right", type: "output" }],
    expandMode: "overlay",
    playable: false,
    supportsChainExecution: true,
    lifecyclePreset: "timer",
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
    lifecyclePreset: "passive",
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
    lifecyclePreset: "passive",
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
    lifecyclePreset: "passive",
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
    lifecyclePreset: "passive",
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
};

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
