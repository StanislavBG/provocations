import React from "react";
import { FileText, Sparkles, StickyNote, FileStack, BookOpen, X } from "lucide-react";
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
  summary: {
    border: "border-purple-500/30",
    bg: "bg-card",
    headerBg: "bg-purple-500/10",
    headerBorder: "border-purple-500/20",
    iconClass: "text-purple-500",
    badgeBg: "bg-purple-500/20",
    badgeText: "text-purple-600 dark:text-purple-400",
    badge: "Summary",
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
};

const NODE_ICONS: Record<FlowNodeType, React.ElementType> = {
  "context-doc": FileText,
  research: Sparkles,
  note: StickyNote,
  summary: FileStack,
  store: BookOpen,
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
          "flex items-center gap-2 px-3 py-2 border-b rounded-t-lg",
          style.headerBg,
          style.headerBorder,
        )}
      >
        <Icon className={cn("w-3.5 h-3.5 shrink-0", style.iconClass)} />
        <span className="text-xs font-medium truncate flex-1">{node.label}</span>
        <span
          className={cn(
            "text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded",
            style.badgeBg,
            style.badgeText,
          )}
        >
          {style.badge}
        </span>
      </div>

      {/* Content snippet */}
      <div className="px-3 py-2 overflow-hidden flex-1">
        <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-5">
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
