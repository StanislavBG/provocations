import React from "react";
import { FileEdit, Image as ImageIcon, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FlowNode } from "./useFlowCanvas";
import { FlowPortDots } from "./FlowPortDots";
import { useNodeResize } from "./useNodeResize";
import { ResizeHandles } from "./ResizeHandles";

interface FlowDocumentNodeProps {
  node: FlowNode;
  isSelected: boolean;
  zoom: number;
  onMouseDown: (e: React.MouseEvent, nodeId: string) => void;
  onDoubleClick: (e: React.MouseEvent, nodeId: string) => void;
  onDelete: (nodeId: string) => void;
  onUpdateNode: (nodeId: string, patch: { x?: number; y?: number; width?: number; height?: number }) => void;
  onPortMouseDown?: (e: React.MouseEvent, nodeId: string, portType: "input" | "output") => void;
}

export const FlowDocumentNode = React.memo(function FlowDocumentNode({
  node,
  isSelected,
  zoom,
  onMouseDown,
  onDoubleClick,
  onDelete,
  onUpdateNode,
  onPortMouseDown,
}: FlowDocumentNodeProps) {
  const { handleResizeMouseDown } = useNodeResize({
    nodeId: node.id, x: node.x, y: node.y,
    width: node.width, height: node.height,
    zoom, minWidth: 140, minHeight: 100, onUpdateNode,
  });

  const isImage = !!node.imageUrl;
  const preview = node.documentContent
    ? node.documentContent.slice(0, 200)
    : node.snippet || "Type your content or connect an upstream node. Double-click to open the editor.";

  return (
    <div
      className={cn(
        "absolute select-none rounded-lg border-2 shadow-md transition-shadow cursor-grab group",
        "hover:shadow-lg",
        isImage ? "bg-card border-rose-500/60" : "bg-card border-indigo-500/60",
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
      <div className={cn(
        "flex items-center gap-1.5 px-2 py-1 border-b rounded-t-lg",
        isImage ? "bg-rose-500/15 border-rose-500/40" : "bg-indigo-500/15 border-indigo-500/40",
      )}>
        {isImage ? (
          <ImageIcon className="w-3 h-3 shrink-0 text-rose-500" />
        ) : (
          <FileEdit className="w-3 h-3 shrink-0 text-indigo-500" />
        )}
        <span className="text-[10px] font-medium truncate flex-1">
          {node.label}
        </span>
        <span className={cn(
          "text-[8px] font-semibold uppercase tracking-wider px-1 py-0.5 rounded",
          isImage
            ? "bg-rose-500/20 text-rose-600 dark:text-rose-400"
            : "bg-indigo-500/20 text-indigo-600 dark:text-indigo-400",
        )}>
          {isImage ? "Image" : "Document"}
        </span>
      </div>

      {/* Content preview */}
      <div className="px-2 py-1.5 overflow-hidden flex-1">
        {isImage ? (
          <img
            src={node.imageUrl}
            alt={node.label}
            className="w-full h-full object-cover rounded"
            draggable={false}
          />
        ) : (
          <p className="text-[9px] text-muted-foreground leading-relaxed line-clamp-4">
            {preview}
          </p>
        )}
      </div>

      {/* Port dots */}
      <FlowPortDots
        node={node}
        isSelected={isSelected}
        onPortMouseDown={onPortMouseDown}
        accentColor={isImage ? "rose" : "indigo"}
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

      {/* Resize handles */}
      <ResizeHandles isSelected={isSelected} onResizeMouseDown={handleResizeMouseDown} size="sm" />
    </div>
  );
});
