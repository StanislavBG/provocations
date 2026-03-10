import React, { useState, useRef, useCallback, useEffect } from "react";
import { NodeHoverActions } from "./NodeHoverActions";
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

      <NodeHoverActions nodeId={node.id} lockMode={lm} onToggleLock={onToggleLock} onDelete={onDelete} hidden={editing} />

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
