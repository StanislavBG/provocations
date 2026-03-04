import React from "react";
import { FileText, Sparkles, Brain, BookOpen, Paintbrush, MessageCircleQuestion, Clock, FileEdit, SquareDashedBottom, Mic, Youtube, Timer, Filter, ToggleRight, GitBranch, Merge, Pause, Trash2, Lock, Unlock, Play, Loader2, Type, Monitor } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FlowNode, FlowNodeType } from "./useFlowCanvas";
import { getEffectiveLockMode } from "./useFlowCanvas";
import { FlowPortDots } from "./FlowPortDots";

/** Node types that support the "Play" (auto-execute) button */
const PLAYABLE_TYPES = new Set<FlowNodeType>(["research", "interview", "painter", "timeline"]);

export const NODE_STYLES: Record<
  FlowNodeType,
  { border: string; bg: string; headerBg: string; headerBorder: string; iconClass: string; badgeBg: string; badgeText: string; badge: string; accent: string }
> = {
  "context-doc": {
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
  research: {
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
  llm: {
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
  store: {
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
  painter: {
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
  interview: {
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
  timeline: {
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
  document: {
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
  zone: {
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
  audio: {
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
  youtube: {
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
  "timer-event": {
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
  filter: {
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
  gate: {
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
  router: {
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
  merge: {
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
  label: {
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
};

/** Accent color → Tailwind bg class (shared by overlays and chain nav bar) */
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

export const NODE_ICONS: Record<FlowNodeType, React.ElementType> = {
  "context-doc": FileText,
  research: Sparkles,
  llm: Brain,
  store: BookOpen,
  painter: Paintbrush,
  interview: MessageCircleQuestion,
  timeline: Clock,
  document: FileEdit,
  zone: SquareDashedBottom,
  audio: Mic,
  youtube: Youtube,
  "timer-event": Timer,
  filter: Filter,
  gate: ToggleRight,
  router: GitBranch,
  merge: Merge,
  label: Type,
};

interface FlowNodeRendererProps {
  node: FlowNode;
  isSelected: boolean;
  onMouseDown: (e: React.MouseEvent, nodeId: string) => void;
  onDoubleClick: (e: React.MouseEvent, nodeId: string) => void;
  onDelete: (nodeId: string) => void;
  onToggleLock?: (nodeId: string) => void;
  onPortMouseDown?: (e: React.MouseEvent, nodeId: string, portType: "input" | "output") => void;
  onPlayNode?: (nodeId: string) => void;
}

export const FlowNodeRenderer = React.memo(function FlowNodeRenderer({
  node,
  isSelected,
  onMouseDown,
  onDoubleClick,
  onDelete,
  onToggleLock,
  onPortMouseDown,
  onPlayNode,
}: FlowNodeRendererProps) {
  const style = NODE_STYLES[node.type];
  const Icon = NODE_ICONS[node.type];
  const isPlayable = PLAYABLE_TYPES.has(node.type);
  const isRunning = node.llmStatus === "running";

  // ── Label nodes: transparent text annotation ──
  if (node.type === "label") {
    return (
      <div
        className={cn(
          "absolute select-none cursor-grab group",
          isSelected && "ring-1 ring-primary/50 rounded",
        )}
        style={{
          left: node.x,
          top: node.y,
          width: node.width,
          minHeight: node.height,
          zIndex: node.zIndex,
        }}
        onMouseDown={(e) => onMouseDown(e, node.id)}
        onDoubleClick={(e) => onDoubleClick(e, node.id)}
      >
        <p
          style={{ fontSize: node.labelFontSize || 16 }}
          className={cn(
            "leading-snug px-2 py-1 whitespace-pre-wrap",
            node.labelBold && "font-bold",
            node.labelItalic && "italic",
            node.labelColor || "text-foreground",
          )}
        >
          {node.label || "Label"}
        </p>

        {/* Lock + Delete buttons on hover */}
        {(() => {
          const lm = getEffectiveLockMode(node);
          return (
            <div className="absolute -top-2.5 -right-2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
              {onToggleLock && (
                <button
                  className={cn(
                    "w-5 h-5 rounded-full flex items-center justify-center shadow-sm transition-colors",
                    lm === "canvas" ? "bg-yellow-500 text-white"
                      : lm === "screen" ? "bg-blue-500 text-white"
                      : "bg-muted text-muted-foreground hover:bg-muted-foreground/20",
                  )}
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => { e.stopPropagation(); onToggleLock(node.id); }}
                  title={lm === "none" ? "Lock to canvas" : lm === "canvas" ? "Lock to screen" : "Unlock"}
                >
                  {lm === "none" && <Unlock className="w-2.5 h-2.5" />}
                  {lm === "canvas" && <Lock className="w-2.5 h-2.5" />}
                  {lm === "screen" && <Monitor className="w-2.5 h-2.5" />}
                </button>
              )}
              {lm === "none" && (
                <button
                  className="w-5 h-5 rounded-full bg-destructive/90 text-destructive-foreground flex items-center justify-center shadow-sm hover:bg-destructive transition-colors"
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => { e.stopPropagation(); onDelete(node.id); }}
                  title="Delete label"
                >
                  <Trash2 className="w-2.5 h-2.5" />
                </button>
              )}
            </div>
          );
        })()}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "absolute select-none rounded-lg border-2 shadow-md transition-shadow cursor-grab group",
        "hover:shadow-lg",
        style.bg,
        style.border,
        isSelected && "ring-2 ring-primary shadow-lg",
      )}
      style={{
        left: node.x,
        top: node.y,
        width: node.width,
        height: node.height,
        zIndex: node.zIndex,
      }}
      onMouseDown={(e) => onMouseDown(e, node.id)}
      onDoubleClick={(e) => onDoubleClick(e, node.id)}
    >
      {/* Header */}
      <div
        className={cn(
          "flex items-center gap-1.5 px-2 py-1 border-b rounded-t-lg",
          style.headerBg,
          style.headerBorder,
        )}
      >
        <Icon className={cn("w-3.5 h-3.5 shrink-0", style.iconClass)} />
        <span className="text-[11px] font-medium truncate flex-1">{node.label}</span>

        {/* Play button for executable nodes */}
        {isPlayable && onPlayNode && (
          <button
            className={cn(
              "flex items-center gap-0.5 text-[9px] font-medium px-1.5 py-0.5 rounded transition-colors",
              style.badgeBg, style.badgeText,
              "hover:opacity-80",
              isRunning && "opacity-60 pointer-events-none",
            )}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onPlayNode(node.id);
            }}
            disabled={isRunning}
          >
            {isRunning ? (
              <Loader2 className="w-2.5 h-2.5 animate-spin" />
            ) : (
              <Play className="w-2.5 h-2.5" />
            )}
            {isRunning ? "Running" : "Play"}
          </button>
        )}

        {!isPlayable && (
          <span
            className={cn(
              "text-[9px] font-semibold uppercase tracking-wider px-1 py-0.5 rounded",
              style.badgeBg,
              style.badgeText,
            )}
          >
            {style.badge}
          </span>
        )}
      </div>

      {/* Content snippet */}
      <div className="px-2 py-1.5 overflow-hidden flex-1">
        <p className="text-[10px] text-muted-foreground/80 leading-relaxed line-clamp-4">
          {node.snippet || "No preview available"}
        </p>
      </div>

      {/* Port dots */}
      <FlowPortDots
        node={node}
        isSelected={isSelected}
        onPortMouseDown={onPortMouseDown}
        accentColor={style.accent}
      />

      {/* Pause indicator */}
      {node.paused && (
        <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-yellow-500/90 text-white text-[7px] font-bold uppercase tracking-wider shadow-sm">
          <Pause className="w-2 h-2" />
          Paused
        </div>
      )}

      {/* Lock + Delete buttons — visible on hover */}
      {(() => {
        const lockMode = getEffectiveLockMode(node);
        return (
          <div className="absolute -top-2.5 -right-2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            {onToggleLock && (
              <button
                className={cn(
                  "w-5 h-5 rounded-full flex items-center justify-center shadow-sm transition-colors",
                  lockMode === "canvas" ? "bg-yellow-500 text-white"
                    : lockMode === "screen" ? "bg-blue-500 text-white"
                    : "bg-muted text-muted-foreground hover:bg-muted-foreground/20",
                )}
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => { e.stopPropagation(); onToggleLock(node.id); }}
                title={lockMode === "none" ? "Lock to canvas" : lockMode === "canvas" ? "Lock to screen" : "Unlock"}
              >
                {lockMode === "none" && <Unlock className="w-2.5 h-2.5" />}
                {lockMode === "canvas" && <Lock className="w-2.5 h-2.5" />}
                {lockMode === "screen" && <Monitor className="w-2.5 h-2.5" />}
              </button>
            )}
            {lockMode === "none" && (
              <button
                className="w-5 h-5 rounded-full bg-destructive/90 text-destructive-foreground flex items-center justify-center shadow-sm hover:bg-destructive transition-colors"
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => { e.stopPropagation(); onDelete(node.id); }}
                title="Delete node"
              >
                <Trash2 className="w-2.5 h-2.5" />
              </button>
            )}
          </div>
        );
      })()}

      {/* Lock indicator */}
      {getEffectiveLockMode(node) === "canvas" && (
        <div className="absolute -top-2 -left-2 w-5 h-5 rounded-full bg-yellow-500/90 text-white flex items-center justify-center shadow-sm">
          <Lock className="w-2.5 h-2.5" />
        </div>
      )}
    </div>
  );
});
