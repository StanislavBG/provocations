import React, { useState, useRef, useEffect, useCallback } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FlowNode } from "./useFlowCanvas";

const ZONE_COLORS: Record<string, { border: string; bg: string; text: string; swatch: string }> = {
  blue: { border: "border-blue-400/50", bg: "bg-blue-400/8", text: "text-blue-400", swatch: "bg-blue-400" },
  green: { border: "border-emerald-400/50", bg: "bg-emerald-400/8", text: "text-emerald-400", swatch: "bg-emerald-400" },
  amber: { border: "border-amber-400/50", bg: "bg-amber-400/8", text: "text-amber-400", swatch: "bg-amber-400" },
  rose: { border: "border-rose-400/50", bg: "bg-rose-400/8", text: "text-rose-400", swatch: "bg-rose-400" },
  violet: { border: "border-violet-400/50", bg: "bg-violet-400/8", text: "text-violet-400", swatch: "bg-violet-400" },
  cyan: { border: "border-cyan-400/50", bg: "bg-cyan-400/8", text: "text-cyan-400", swatch: "bg-cyan-400" },
  gray: { border: "border-muted-foreground/40", bg: "bg-muted/8", text: "text-muted-foreground", swatch: "bg-muted-foreground" },
};

const COLOR_KEYS = Object.keys(ZONE_COLORS);

const MIN_ZONE_W = 150;
const MIN_ZONE_H = 100;

type ResizeDir = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

interface FlowZoneNodeProps {
  node: FlowNode;
  isSelected: boolean;
  zoom: number;
  onMouseDown: (e: React.MouseEvent, nodeId: string) => void;
  onDelete: (nodeId: string) => void;
  onUpdateNode: (nodeId: string, patch: Partial<FlowNode>) => void;
}

export const FlowZoneNode = React.memo(function FlowZoneNode({
  node,
  isSelected,
  zoom,
  onMouseDown,
  onDelete,
  onUpdateNode,
}: FlowZoneNodeProps) {
  const [editing, setEditing] = useState(false);
  const [editLabel, setEditLabel] = useState(node.zoneLabel || "");
  const inputRef = useRef<HTMLInputElement>(null);
  const colorKey = node.zoneColor || "gray";
  const colors = ZONE_COLORS[colorKey] || ZONE_COLORS.gray;

  // Resize state
  const resizeRef = useRef<{
    dir: ResizeDir;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
    origW: number;
    origH: number;
  } | null>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const commitLabel = () => {
    setEditing(false);
    if (editLabel.trim() !== (node.zoneLabel || "")) {
      onUpdateNode(node.id, { zoneLabel: editLabel.trim() || undefined });
    }
  };

  // ── Resize handlers ──

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

        // Horizontal
        if (r.dir.includes("e")) {
          newW = Math.max(MIN_ZONE_W, r.origW + dx);
        }
        if (r.dir.includes("w")) {
          const maxDx = r.origW - MIN_ZONE_W;
          const clampedDx = Math.min(dx, maxDx);
          newX = r.origX + clampedDx;
          newW = r.origW - clampedDx;
        }

        // Vertical
        if (r.dir.includes("s")) {
          newH = Math.max(MIN_ZONE_H, r.origH + dy);
        }
        if (r.dir === "n" || r.dir === "ne" || r.dir === "nw") {
          const maxDy = r.origH - MIN_ZONE_H;
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

  const handleColorClick = useCallback(
    (e: React.MouseEvent, ck: string) => {
      e.stopPropagation();
      e.preventDefault();
      onUpdateNode(node.id, { zoneColor: ck });
    },
    [node.id, onUpdateNode],
  );

  // Cursor map for resize handles
  const cursorMap: Record<ResizeDir, string> = {
    n: "cursor-ns-resize",
    s: "cursor-ns-resize",
    e: "cursor-ew-resize",
    w: "cursor-ew-resize",
    ne: "cursor-nesw-resize",
    nw: "cursor-nwse-resize",
    se: "cursor-nwse-resize",
    sw: "cursor-nesw-resize",
  };

  return (
    <div
      className={cn(
        "absolute select-none rounded-xl border-2 border-dashed transition-shadow cursor-grab group",
        colors.border,
        colors.bg,
        isSelected && "ring-2 ring-primary/50 shadow-lg",
      )}
      style={{
        left: node.x,
        top: node.y,
        width: node.width,
        height: node.height,
        zIndex: node.zIndex,
      }}
      onMouseDown={(e) => onMouseDown(e, node.id)}
      onDoubleClick={(e) => {
        e.stopPropagation();
        setEditLabel(node.zoneLabel || "");
        setEditing(true);
      }}
    >
      {/* Zone label + color picker */}
      <div className="absolute top-2 left-3 flex items-center gap-2">
        {editing ? (
          <div
            className="flex items-center gap-2 bg-card/90 backdrop-blur-sm rounded-lg px-2 py-1.5 border border-border/50 shadow-sm"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <input
              ref={inputRef}
              className="bg-transparent border border-muted-foreground/30 rounded px-1.5 py-0.5 text-xs font-medium outline-none focus:border-primary w-28"
              value={editLabel}
              onChange={(e) => setEditLabel(e.target.value)}
              onBlur={commitLabel}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitLabel();
                if (e.key === "Escape") setEditing(false);
              }}
              placeholder="Zone label..."
            />
            <div className="flex gap-1">
              {COLOR_KEYS.map((ck) => (
                <button
                  key={ck}
                  className={cn(
                    "w-5 h-5 rounded-full border-2 transition-transform hover:scale-125",
                    ck === colorKey
                      ? "border-foreground scale-110"
                      : "border-transparent",
                    ZONE_COLORS[ck].swatch,
                  )}
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => handleColorClick(e, ck)}
                  title={ck}
                />
              ))}
            </div>
          </div>
        ) : (
          <span className={cn("text-xs font-medium opacity-60", colors.text)}>
            {node.zoneLabel || "Zone"}
          </span>
        )}
      </div>

      {/* Resize handles — visible on hover or when selected */}
      {/* Corner handles */}
      {(["nw", "ne", "sw", "se"] as ResizeDir[]).map((dir) => (
        <div
          key={dir}
          className={cn(
            "absolute w-3 h-3 rounded-full border-2 border-primary bg-background opacity-0 group-hover:opacity-100 transition-opacity z-10",
            isSelected && "opacity-100",
            cursorMap[dir],
            dir === "nw" && "-top-1.5 -left-1.5",
            dir === "ne" && "-top-1.5 -right-1.5",
            dir === "sw" && "-bottom-1.5 -left-1.5",
            dir === "se" && "-bottom-1.5 -right-1.5",
          )}
          onMouseDown={(e) => handleResizeMouseDown(e, dir)}
        />
      ))}
      {/* Edge handles */}
      {(["n", "s", "e", "w"] as ResizeDir[]).map((dir) => (
        <div
          key={dir}
          className={cn(
            "absolute opacity-0 group-hover:opacity-100 transition-opacity z-10",
            isSelected && "opacity-100",
            cursorMap[dir],
            dir === "n" && "top-0 left-3 right-3 h-1.5 -translate-y-1/2",
            dir === "s" && "bottom-0 left-3 right-3 h-1.5 translate-y-1/2",
            dir === "e" && "right-0 top-3 bottom-3 w-1.5 translate-x-1/2",
            dir === "w" && "left-0 top-3 bottom-3 w-1.5 -translate-x-1/2",
          )}
          onMouseDown={(e) => handleResizeMouseDown(e, dir)}
        />
      ))}

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
