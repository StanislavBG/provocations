import React from "react";
import { FileEdit, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FlowNode } from "./useFlowCanvas";
import { NODE_PORTS } from "./useFlowCanvas";
import { FlowPortDots } from "./FlowPortDots";

interface FlowDocumentNodeProps {
  node: FlowNode;
  isSelected: boolean;
  onMouseDown: (e: React.MouseEvent, nodeId: string) => void;
  onDoubleClick: (e: React.MouseEvent, nodeId: string) => void;
  onDelete: (nodeId: string) => void;
  onPortMouseDown?: (e: React.MouseEvent, nodeId: string, portType: "input" | "output") => void;
}

export const FlowDocumentNode = React.memo(function FlowDocumentNode({
  node,
  isSelected,
  onMouseDown,
  onDoubleClick,
  onDelete,
  onPortMouseDown,
}: FlowDocumentNodeProps) {
  const preview = node.documentContent
    ? node.documentContent.slice(0, 200)
    : node.snippet || "Double-click to edit document";

  return (
    <div
      className={cn(
        "absolute select-none rounded-lg border shadow-sm transition-shadow cursor-grab group",
        "hover:shadow-md",
        "bg-card border-indigo-500/30",
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
      <div className="flex items-center gap-1.5 px-2 py-1 border-b rounded-t-lg bg-indigo-500/10 border-indigo-500/20">
        <FileEdit className="w-3 h-3 shrink-0 text-indigo-500" />
        <span className="text-[10px] font-medium truncate flex-1">
          {node.label}
        </span>
        <span className="text-[8px] font-semibold uppercase tracking-wider px-1 py-0.5 rounded bg-indigo-500/20 text-indigo-600 dark:text-indigo-400">
          Document
        </span>
      </div>

      {/* Content preview */}
      <div className="px-2 py-1.5 overflow-hidden flex-1">
        <p className="text-[9px] text-muted-foreground leading-relaxed line-clamp-4">
          {preview}
        </p>
      </div>

      {/* Port dots */}
      <FlowPortDots
        node={node}
        isSelected={isSelected}
        onPortMouseDown={onPortMouseDown}
        accentColor="indigo"
      />

      {/* Delete button */}
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
