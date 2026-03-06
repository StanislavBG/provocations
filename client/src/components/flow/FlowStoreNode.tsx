import React from "react";
import { FolderInput, Folder, FolderOpen, Trash2, Lock, Unlock, Monitor } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FlowNode } from "./useFlowCanvas";
import { getEffectiveLockMode } from "./useFlowCanvas";
import { FlowPortDots } from "./FlowPortDots";

interface FlowStoreNodeProps {
  node: FlowNode;
  isSelected: boolean;
  onMouseDown: (e: React.MouseEvent, nodeId: string) => void;
  onDoubleClick: (e: React.MouseEvent, nodeId: string) => void;
  onDelete: (nodeId: string) => void;
  onToggleLock?: (nodeId: string) => void;
  onPortMouseDown?: (e: React.MouseEvent, nodeId: string, portType: "input" | "output") => void;
}

export const FlowStoreNode = React.memo(function FlowStoreNode({
  node,
  isSelected,
  onMouseDown,
  onDoubleClick,
  onDelete,
  onToggleLock,
  onPortMouseDown,
}: FlowStoreNodeProps) {
  const hasFolder = !!node.storeFolderId || !!node.storeFolderName;

  return (
    <div
      className={cn(
        "absolute select-none rounded-lg border-2 shadow-md transition-shadow cursor-grab group flex flex-col",
        "bg-card hover:shadow-lg",
        hasFolder ? "border-primary/60" : "border-muted-foreground/30",
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
      <div className="flex items-center gap-1.5 px-2 py-1 border-b rounded-t-lg bg-primary/10 border-primary/20 shrink-0">
        <FolderInput className="w-3 h-3 text-primary shrink-0" />
        <span className="text-[10px] font-medium truncate flex-1">
          {node.label || "Save File"}
        </span>
        <span className="text-[8px] font-semibold uppercase tracking-wider px-1 py-0.5 rounded bg-primary/20 text-primary">
          Store
        </span>
      </div>

      {/* Content: folder path + doc name or empty state */}
      <div className="px-2 py-1.5 flex-1 flex flex-col gap-1 min-w-0 justify-center">
        {hasFolder ? (
          <>
            <div className="flex items-center gap-1.5 min-w-0">
              <FolderOpen className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              <span className="text-[10px] text-foreground/80 truncate">
                {node.storeFolderPath || node.storeFolderName}
              </span>
            </div>
            {node.storeName && (
              <div className="flex items-center gap-1.5 min-w-0 pl-0.5">
                <span className="text-[9px] text-muted-foreground truncate">
                  {node.storeName}
                </span>
              </div>
            )}
          </>
        ) : (
          <div className="flex items-center gap-1.5 min-w-0">
            <Folder className="w-3.5 h-3.5 text-muted-foreground/40 shrink-0" />
            <span className="text-[10px] text-muted-foreground/50 italic">
              Double-click to configure
            </span>
          </div>
        )}
      </div>

      {/* Port dots */}
      <FlowPortDots
        node={node}
        isSelected={isSelected}
        onPortMouseDown={onPortMouseDown}
        accentColor="primary"
      />

      {/* Lock + Delete hover buttons */}
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
                title="Delete node"
              >
                <Trash2 className="w-2.5 h-2.5" />
              </button>
            )}
          </div>
        );
      })()}
    </div>
  );
});
