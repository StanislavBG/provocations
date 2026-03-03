import React from "react";
import { FileText, Sparkles, StickyNote, Brain, BookOpen, Paintbrush, MessageCircleQuestion, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FlowNode, FlowNodeType } from "./useFlowCanvas";

const NODE_STYLES: Record<
  FlowNodeType,
  { border: string; bg: string; headerBg: string; headerBorder: string; iconClass: string; badgeBg: string; badgeText: string; badge: string }
> = {
  "context-doc": {
    border: "border-amber-500/30",
    bg: "bg-card",
    headerBg: "bg-amber-500/10",
    headerBorder: "border-amber-500/20",
    iconClass: "text-amber-500",
    badgeBg: "bg-amber-500/20",
    badgeText: "text-amber-600 dark:text-amber-400",
    badge: "Context",
  },
  research: {
    border: "border-blue-500/30",
    bg: "bg-card",
    headerBg: "bg-blue-500/10",
    headerBorder: "border-blue-500/20",
    iconClass: "text-blue-500",
    badgeBg: "bg-blue-500/20",
    badgeText: "text-blue-600 dark:text-blue-400",
    badge: "Research",
  },
  note: {
    border: "border-emerald-500/30",
    bg: "bg-card",
    headerBg: "bg-emerald-500/10",
    headerBorder: "border-emerald-500/20",
    iconClass: "text-emerald-500",
    badgeBg: "bg-emerald-500/20",
    badgeText: "text-emerald-600 dark:text-emerald-400",
    badge: "Note",
  },
  llm: {
    border: "border-violet-500/30",
    bg: "bg-card",
    headerBg: "bg-violet-500/10",
    headerBorder: "border-violet-500/20",
    iconClass: "text-violet-500",
    badgeBg: "bg-violet-500/20",
    badgeText: "text-violet-600 dark:text-violet-400",
    badge: "Text Mods",
  },
  store: {
    border: "border-primary/30",
    bg: "bg-card",
    headerBg: "bg-primary/10",
    headerBorder: "border-primary/20",
    iconClass: "text-primary",
    badgeBg: "bg-primary/20",
    badgeText: "text-primary",
    badge: "Store",
  },
  painter: {
    border: "border-rose-500/30",
    bg: "bg-card",
    headerBg: "bg-rose-500/10",
    headerBorder: "border-rose-500/20",
    iconClass: "text-rose-500",
    badgeBg: "bg-rose-500/20",
    badgeText: "text-rose-600 dark:text-rose-400",
    badge: "Painter",
  },
  interview: {
    border: "border-cyan-500/30",
    bg: "bg-card",
    headerBg: "bg-cyan-500/10",
    headerBorder: "border-cyan-500/20",
    iconClass: "text-cyan-500",
    badgeBg: "bg-cyan-500/20",
    badgeText: "text-cyan-600 dark:text-cyan-400",
    badge: "Interview",
  },
};

const NODE_ICONS: Record<FlowNodeType, React.ElementType> = {
  "context-doc": FileText,
  research: Sparkles,
  note: StickyNote,
  llm: Brain,
  store: BookOpen,
  painter: Paintbrush,
  interview: MessageCircleQuestion,
};

interface FlowNodeRendererProps {
  node: FlowNode;
  isSelected: boolean;
  onMouseDown: (e: React.MouseEvent, nodeId: string) => void;
  onDoubleClick: (e: React.MouseEvent, nodeId: string) => void;
  onDelete: (nodeId: string) => void;
}

export const FlowNodeRenderer = React.memo(function FlowNodeRenderer({
  node,
  isSelected,
  onMouseDown,
  onDoubleClick,
  onDelete,
}: FlowNodeRendererProps) {
  const style = NODE_STYLES[node.type];
  const Icon = NODE_ICONS[node.type];

  return (
    <div
      className={cn(
        "absolute select-none rounded-lg border shadow-sm transition-shadow cursor-grab group",
        "hover:shadow-md",
        style.bg,
        style.border,
        isSelected && "ring-2 ring-primary shadow-md",
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
        <Icon className={cn("w-3 h-3 shrink-0", style.iconClass)} />
        <span className="text-[10px] font-medium truncate flex-1">{node.label}</span>
        <span
          className={cn(
            "text-[8px] font-semibold uppercase tracking-wider px-1 py-0.5 rounded",
            style.badgeBg,
            style.badgeText,
          )}
        >
          {style.badge}
        </span>
      </div>

      {/* Content snippet */}
      <div className="px-2 py-1.5 overflow-hidden flex-1">
        <p className="text-[9px] text-muted-foreground leading-relaxed line-clamp-4">
          {node.snippet || "No preview available"}
        </p>
      </div>

      {/* Delete button — visible on hover */}
      <button
        className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          onDelete(node.id);
        }}
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  );
});
