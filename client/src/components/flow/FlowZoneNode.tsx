import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FlowNode } from "./useFlowCanvas";
import { useNodeResize } from "./useNodeResize";
import { ResizeHandles } from "./ResizeHandles";

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

  const { handleResizeMouseDown } = useNodeResize({
    nodeId: node.id,
    x: node.x,
    y: node.y,
    width: node.width,
    height: node.height,
    zoom,
    minWidth: 150,
    minHeight: 100,
    onUpdateNode,
  });

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

  const handleColorClick = useCallback(
    (e: React.MouseEvent, ck: string) => {
      e.stopPropagation();
      e.preventDefault();
      onUpdateNode(node.id, { zoneColor: ck });
    },
    [node.id, onUpdateNode],
  );

  // ── Zoom-aware level of detail ──
  const lod = useMemo(() => {
    const baseFontSize = Math.max(10, Math.min(32, Math.min(node.width, node.height) * 0.06));
    const effectiveSize = baseFontSize * zoom;
    const labelOpacity = Math.max(0, Math.min(1, (effectiveSize - 4) / 6));
    const controlsOpacity = Math.max(0, Math.min(1, (zoom - 0.25) / 0.25));
    return { baseFontSize, labelOpacity, controlsOpacity };
  }, [node.width, node.height, zoom]);

  const showLabel = lod.labelOpacity > 0.01;
  const showControls = lod.controlsOpacity > 0.05;

  return (
    <div
      className={cn(
        "absolute select-none rounded-xl border-2 border-dashed cursor-grab group",
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
        transition: "box-shadow 0.2s",
      }}
      onMouseDown={(e) => onMouseDown(e, node.id)}
      onDoubleClick={(e) => {
        if (!showControls) return;
        e.stopPropagation();
        setEditLabel(node.zoneLabel || "");
        setEditing(true);
      }}
    >
      {/* Zone label + color picker */}
      {showLabel && (
        <div
          className="absolute top-2 left-3 flex items-center gap-2"
          style={{
            opacity: lod.labelOpacity,
            transition: "opacity 0.3s ease",
          }}
        >
          {editing && showControls ? (
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
            <span
              className={cn("font-medium", colors.text)}
              style={{
                fontSize: lod.baseFontSize,
                opacity: 0.6,
                transition: "font-size 0.2s ease, opacity 0.3s ease",
              }}
            >
              {node.zoneLabel || "Zone"}
            </span>
          )}
        </div>
      )}

      {/* Resize handles + delete — via shared component */}
      {showControls && (
        <>
          <ResizeHandles
            isSelected={isSelected}
            onResizeMouseDown={handleResizeMouseDown}
            size="md"
          />
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
        </>
      )}
    </div>
  );
});
