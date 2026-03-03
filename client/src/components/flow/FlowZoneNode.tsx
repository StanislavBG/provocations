import React, { useState, useRef, useEffect } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FlowNode } from "./useFlowCanvas";

const ZONE_COLORS: Record<string, { border: string; bg: string; text: string }> = {
  blue: { border: "border-blue-400/40", bg: "bg-blue-400/5", text: "text-blue-400" },
  green: { border: "border-emerald-400/40", bg: "bg-emerald-400/5", text: "text-emerald-400" },
  amber: { border: "border-amber-400/40", bg: "bg-amber-400/5", text: "text-amber-400" },
  rose: { border: "border-rose-400/40", bg: "bg-rose-400/5", text: "text-rose-400" },
  violet: { border: "border-violet-400/40", bg: "bg-violet-400/5", text: "text-violet-400" },
  cyan: { border: "border-cyan-400/40", bg: "bg-cyan-400/5", text: "text-cyan-400" },
  gray: { border: "border-muted-foreground/30", bg: "bg-muted/5", text: "text-muted-foreground" },
};

const COLOR_KEYS = Object.keys(ZONE_COLORS);

interface FlowZoneNodeProps {
  node: FlowNode;
  isSelected: boolean;
  onMouseDown: (e: React.MouseEvent, nodeId: string) => void;
  onDelete: (nodeId: string) => void;
  onUpdateNode: (nodeId: string, patch: Partial<FlowNode>) => void;
}

export const FlowZoneNode = React.memo(function FlowZoneNode({
  node,
  isSelected,
  onMouseDown,
  onDelete,
  onUpdateNode,
}: FlowZoneNodeProps) {
  const [editing, setEditing] = useState(false);
  const [editLabel, setEditLabel] = useState(node.zoneLabel || "");
  const inputRef = useRef<HTMLInputElement>(null);
  const colorKey = node.zoneColor || "gray";
  const colors = ZONE_COLORS[colorKey] || ZONE_COLORS.gray;

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
          <div className="flex items-center gap-1.5" onMouseDown={(e) => e.stopPropagation()}>
            <input
              ref={inputRef}
              className="bg-transparent border border-muted-foreground/30 rounded px-1.5 py-0.5 text-xs font-medium outline-none focus:border-primary w-32"
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
                    "w-4 h-4 rounded-full border transition-transform",
                    ZONE_COLORS[ck].border,
                    ZONE_COLORS[ck].bg,
                    ck === colorKey && "ring-2 ring-primary scale-110",
                  )}
                  onClick={() => onUpdateNode(node.id, { zoneColor: ck })}
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
