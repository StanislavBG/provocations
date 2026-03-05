import React, { useState, useRef, useCallback, useEffect } from "react";
import { Trash2, Lock, Unlock, Monitor } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FlowNode } from "./useFlowCanvas";
import { getEffectiveLockMode } from "./useFlowCanvas";
import { useNodeResize } from "./useNodeResize";
import { ResizeHandles } from "./ResizeHandles";

interface FlowLabelNodeProps {
  node: FlowNode;
  isSelected: boolean;
  zoom: number;
  onMouseDown: (e: React.MouseEvent, nodeId: string) => void;
  onDoubleClick: (e: React.MouseEvent, nodeId: string) => void;
  onDelete: (nodeId: string) => void;
  onUpdateNode: (nodeId: string, patch: Partial<FlowNode>) => void;
  onToggleLock?: (nodeId: string) => void;
}

export const FlowLabelNode = React.memo(function FlowLabelNode({
  node,
  isSelected,
  zoom,
  onMouseDown,
  onDoubleClick,
  onDelete,
  onUpdateNode,
  onToggleLock,
}: FlowLabelNodeProps) {
  const [editing, setEditing] = useState(false);
  const editRef = useRef<HTMLDivElement>(null);

  const { handleResizeMouseDown } = useNodeResize({
    nodeId: node.id,
    x: node.x,
    y: node.y,
    width: node.width,
    height: node.height,
    zoom,
    minWidth: 60,
    minHeight: 24,
    onUpdateNode,
  });

  // Focus the editable div when editing starts
  useEffect(() => {
    if (editing && editRef.current) {
      editRef.current.focus();
      const sel = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(editRef.current);
      sel?.removeAllRanges();
      sel?.addRange(range);
    }
  }, [editing]);

  const commitEdit = useCallback(() => {
    setEditing(false);
    const text = editRef.current?.textContent?.trim() || "";
    if (text !== (node.label || "")) {
      onUpdateNode(node.id, { label: text || "Label" });
    }
  }, [node.id, node.label, onUpdateNode]);

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setEditing(true);
  }, []);

  const lm = getEffectiveLockMode(node);

  return (
    <div
      className={cn(
        "absolute select-none cursor-grab group",
        isSelected && "ring-1 ring-primary/50 rounded",
        editing && "ring-2 ring-primary rounded cursor-text",
      )}
      style={{
        left: node.x,
        top: node.y,
        width: node.width,
        height: node.height,
        zIndex: node.zIndex,
      }}
      onMouseDown={editing ? (e) => e.stopPropagation() : (e) => onMouseDown(e, node.id)}
      onDoubleClick={editing ? undefined : handleDoubleClick}
    >
      {/* Label text — inline editable on double-click */}
      {editing ? (
        <div
          ref={editRef}
          contentEditable
          suppressContentEditableWarning
          style={{ fontSize: node.labelFontSize || 16 }}
          className={cn(
            "leading-snug px-2 py-1 whitespace-pre-wrap w-full h-full outline-none",
            node.labelBold && "font-bold",
            node.labelItalic && "italic",
            node.labelColor || "text-foreground",
          )}
          onBlur={commitEdit}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); commitEdit(); }
            if (e.key === "Escape") { setEditing(false); }
          }}
        >
          {node.label || "Label"}
        </div>
      ) : (
        <p
          style={{ fontSize: node.labelFontSize || 16 }}
          className={cn(
            "leading-snug px-2 py-1 whitespace-pre-wrap overflow-hidden w-full h-full",
            node.labelBold && "font-bold",
            node.labelItalic && "italic",
            node.labelColor || "text-foreground",
          )}
        >
          {node.label || "Label"}
        </p>
      )}

      {/* Lock + Delete buttons on hover */}
      {!editing && (
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
      )}

      {/* Resize handles — shared component */}
      {!editing && (
        <ResizeHandles
          isSelected={isSelected}
          onResizeMouseDown={handleResizeMouseDown}
          size="sm"
        />
      )}
    </div>
  );
});
