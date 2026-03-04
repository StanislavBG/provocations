import React, { useState, useRef, useCallback, useEffect } from "react";
import { Trash2, Lock, Unlock, Monitor } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FlowNode } from "./useFlowCanvas";
import { getEffectiveLockMode } from "./useFlowCanvas";

const MIN_LABEL_W = 60;
const MIN_LABEL_H = 24;

type ResizeDir = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

const CURSOR_MAP: Record<ResizeDir, string> = {
  n: "cursor-ns-resize",
  s: "cursor-ns-resize",
  e: "cursor-ew-resize",
  w: "cursor-ew-resize",
  ne: "cursor-nesw-resize",
  nw: "cursor-nwse-resize",
  se: "cursor-nwse-resize",
  sw: "cursor-nesw-resize",
};

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

  const resizeRef = useRef<{
    dir: ResizeDir;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
    origW: number;
    origH: number;
  } | null>(null);

  // Focus the editable div when editing starts
  useEffect(() => {
    if (editing && editRef.current) {
      editRef.current.focus();
      // Select all text
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

  const handleResizeMouseDown = useCallback(
    (e: React.MouseEvent, dir: ResizeDir) => {
      e.stopPropagation();
      e.preventDefault();
      resizeRef.current = {
        dir,
        startX: e.clientX,
        startY: e.clientY,
        origX: node.x,
        origY: node.y,
        origW: node.width,
        origH: node.height,
      };

      const onMove = (ev: MouseEvent) => {
        const r = resizeRef.current;
        if (!r) return;
        const dx = (ev.clientX - r.startX) / zoom;
        const dy = (ev.clientY - r.startY) / zoom;

        let newX = r.origX;
        let newY = r.origY;
        let newW = r.origW;
        let newH = r.origH;

        if (r.dir.includes("e")) {
          newW = Math.max(MIN_LABEL_W, r.origW + dx);
        }
        if (r.dir.includes("w")) {
          const maxDx = r.origW - MIN_LABEL_W;
          const clampedDx = Math.min(dx, maxDx);
          newX = r.origX + clampedDx;
          newW = r.origW - clampedDx;
        }
        if (r.dir.includes("s")) {
          newH = Math.max(MIN_LABEL_H, r.origH + dy);
        }
        if (r.dir === "n" || r.dir === "ne" || r.dir === "nw") {
          const maxDy = r.origH - MIN_LABEL_H;
          const clampedDy = Math.min(dy, maxDy);
          newY = r.origY + clampedDy;
          newH = r.origH - clampedDy;
        }

        onUpdateNode(node.id, { x: newX, y: newY, width: newW, height: newH });
      };

      const onUp = () => {
        resizeRef.current = null;
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };

      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [node.id, node.x, node.y, node.width, node.height, zoom, onUpdateNode],
  );

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

      {/* Corner resize handles */}
      {!editing && (["nw", "ne", "sw", "se"] as ResizeDir[]).map((dir) => (
        <div
          key={dir}
          className={cn(
            "absolute w-2.5 h-2.5 rounded-full border-2 border-primary bg-background opacity-0 group-hover:opacity-100 transition-opacity z-10",
            isSelected && "opacity-100",
            CURSOR_MAP[dir],
            dir === "nw" && "-top-1 -left-1",
            dir === "ne" && "-top-1 -right-1",
            dir === "sw" && "-bottom-1 -left-1",
            dir === "se" && "-bottom-1 -right-1",
          )}
          onMouseDown={(e) => handleResizeMouseDown(e, dir)}
        />
      ))}
      {/* Edge resize handles */}
      {!editing && (["n", "s", "e", "w"] as ResizeDir[]).map((dir) => (
        <div
          key={dir}
          className={cn(
            "absolute opacity-0 group-hover:opacity-100 transition-opacity z-10",
            isSelected && "opacity-100",
            CURSOR_MAP[dir],
            dir === "n" && "top-0 left-2 right-2 h-1 -translate-y-1/2",
            dir === "s" && "bottom-0 left-2 right-2 h-1 translate-y-1/2",
            dir === "e" && "right-0 top-2 bottom-2 w-1 translate-x-1/2",
            dir === "w" && "left-0 top-2 bottom-2 w-1 -translate-x-1/2",
          )}
          onMouseDown={(e) => handleResizeMouseDown(e, dir)}
        />
      ))}
    </div>
  );
});
