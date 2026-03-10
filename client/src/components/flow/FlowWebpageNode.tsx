import React from "react";
import { Globe, Play } from "lucide-react";
import { cn } from "@/lib/utils";
import { NodeHoverActions } from "./NodeHoverActions";
import type { FlowNode } from "./useFlowCanvas";
import { getEffectiveLockMode } from "./useFlowCanvas";
import { FlowPortDots } from "./FlowPortDots";
import { useNodeResize } from "./useNodeResize";
import { ResizeHandles } from "./ResizeHandles";

interface FlowWebpageNodeProps {
  node: FlowNode;
  isSelected: boolean;
  zoom: number;
  onMouseDown: (e: React.MouseEvent, nodeId: string) => void;
  onDoubleClick: (e: React.MouseEvent, nodeId: string) => void;
  onDelete: (nodeId: string) => void;
  onUpdateNode: (nodeId: string, patch: { x?: number; y?: number; width?: number; height?: number }) => void;
  onToggleLock?: (nodeId: string) => void;
  onPortMouseDown?: (e: React.MouseEvent, nodeId: string, portType: "input" | "output") => void;
  onPlayNode?: (nodeId: string) => void;
}

export const FlowWebpageNode = React.memo(function FlowWebpageNode({
  node,
  isSelected,
  zoom,
  onMouseDown,
  onDoubleClick,
  onDelete,
  onUpdateNode,
  onToggleLock,
  onPortMouseDown,
  onPlayNode,
}: FlowWebpageNodeProps) {
  const lockMode = getEffectiveLockMode(node);
  const { handleResizeMouseDown } = useNodeResize({
    nodeId: node.id, x: node.x, y: node.y,
    width: node.width, height: node.height,
    zoom, minWidth: 160, minHeight: 120, onUpdateNode,
  });

  const status = node.webpageStatus ?? "idle";
  const hasOutput = !!node.htmlOutput;

  return (
    <div
      className={cn(
        "absolute select-none rounded-lg border-2 shadow-md transition-shadow cursor-grab group flex flex-col",
        "bg-card hover:shadow-lg",
        "border-blue-500/60",
        isSelected && "ring-2 ring-blue-500 shadow-lg",
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
      <div className="flex items-center gap-1.5 px-2 py-1 border-b rounded-t-lg bg-blue-500/15 border-blue-500/40 shrink-0">
        <Globe className="w-3 h-3 text-blue-500 shrink-0" />
        <span className="text-[10px] font-medium truncate flex-1">
          {node.label || "Webpage"}
        </span>
        <span className={cn(
          "text-[8px] font-semibold uppercase tracking-wider px-1 py-0.5 rounded",
          status === "running" ? "bg-blue-500/30 text-blue-300 animate-pulse"
            : status === "done" ? "bg-emerald-500/25 text-emerald-400"
            : status === "error" ? "bg-red-500/25 text-red-400"
            : "bg-blue-500/20 text-blue-400",
        )}>
          {status === "running" ? "Generating…" : status === "done" ? "Ready" : status === "error" ? "Error" : "Webpage"}
        </span>
      </div>

      {/* Content */}
      <div className="px-2 py-1.5 flex-1 flex flex-col gap-1 min-w-0 justify-center overflow-hidden">
        {hasOutput ? (
          <div className="relative w-full flex-1 rounded overflow-hidden border border-blue-500/20 bg-white/5 min-h-[40px]">
            <iframe
              srcDoc={node.htmlOutput}
              sandbox=""
              className="w-full h-full pointer-events-none"
              style={{ transform: "scale(0.25)", transformOrigin: "top left", width: "400%", height: "400%" }}
              title="Preview"
            />
            <div className="absolute inset-0" />
          </div>
        ) : (
          <div className="flex items-center gap-1.5 min-w-0">
            <Globe className="w-3.5 h-3.5 text-muted-foreground/40 shrink-0" />
            <span className="text-[10px] text-muted-foreground/50 italic">
              Connect content → Run to generate a styled webpage
            </span>
          </div>
        )}
      </div>

      {/* Play button */}
      {onPlayNode && status !== "running" && (
        <button
          className="absolute bottom-1.5 right-1.5 w-5 h-5 rounded-full bg-blue-500/80 text-white flex items-center justify-center shadow-sm hover:bg-blue-500 transition-colors opacity-0 group-hover:opacity-100"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); onPlayNode(node.id); }}
          title="Generate webpage"
        >
          <Play className="w-2.5 h-2.5" />
        </button>
      )}

      {/* Port dots */}
      <FlowPortDots
        node={node}
        isSelected={isSelected}
        onPortMouseDown={onPortMouseDown}
        accentColor="blue"
      />

      <NodeHoverActions nodeId={node.id} lockMode={lockMode} onToggleLock={onToggleLock} onDelete={onDelete} />

      {/* Resize handles */}
      {lockMode === "none" && (
        <ResizeHandles isSelected={isSelected} onResizeMouseDown={handleResizeMouseDown} size="sm" />
      )}
    </div>
  );
});
