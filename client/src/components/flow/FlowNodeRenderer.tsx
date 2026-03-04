import React, { useState, useRef, useCallback, useEffect } from "react";
import { Pause, Trash2, Lock, Unlock, Play, Loader2, Monitor } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FlowNode, FlowNodeType } from "./useFlowCanvas";
import { getEffectiveLockMode } from "./useFlowCanvas";
import { FlowPortDots } from "./FlowPortDots";
import {
  NODE_STYLES,
  NODE_ICONS,
  ACCENT_BG,
  PLAYABLE_TYPES,
} from "./FlowNodeRegistry";

// Re-export from registry for backward compatibility with external consumers
export { NODE_STYLES, NODE_ICONS, ACCENT_BG };

interface FlowNodeRendererProps {
  node: FlowNode;
  isSelected: boolean;
  onMouseDown: (e: React.MouseEvent, nodeId: string) => void;
  onDoubleClick: (e: React.MouseEvent, nodeId: string) => void;
  onDelete: (nodeId: string) => void;
  onToggleLock?: (nodeId: string) => void;
  onPortMouseDown?: (e: React.MouseEvent, nodeId: string, portType: "input" | "output") => void;
  onPlayNode?: (nodeId: string) => void;
  onUpdateLabel?: (nodeId: string, label: string) => void;
}

export const FlowNodeRenderer = React.memo(function FlowNodeRenderer({
  node,
  isSelected,
  onMouseDown,
  onDoubleClick,
  onDelete,
  onToggleLock,
  onPortMouseDown,
  onPlayNode,
  onUpdateLabel,
}: FlowNodeRendererProps) {
  const style = NODE_STYLES[node.type];
  const Icon = NODE_ICONS[node.type];
  const isPlayable = PLAYABLE_TYPES.has(node.type);
  const isRunning = node.llmStatus === "running";

  // ── Inline label editing state ──
  const [editing, setEditing] = useState(false);
  const labelRef = useRef<HTMLDivElement>(null);

  const commitLabel = useCallback(() => {
    if (!labelRef.current || !onUpdateLabel) return;
    const text = labelRef.current.innerText.trim() || "Label";
    onUpdateLabel(node.id, text);
    setEditing(false);
  }, [node.id, onUpdateLabel]);

  // Focus the contentEditable when editing starts
  useEffect(() => {
    if (editing && labelRef.current) {
      labelRef.current.focus();
      // Move cursor to end
      const sel = window.getSelection();
      if (sel) {
        sel.selectAllChildren(labelRef.current);
        sel.collapseToEnd();
      }
    }
  }, [editing]);

  // ── Label nodes: transparent text annotation ──
  if (node.type === "label") {
    return (
      <div
        className={cn(
          "absolute select-none group z-10",
          editing ? "cursor-text" : "cursor-grab",
          isSelected && "ring-1 ring-primary/50 rounded",
        )}
        style={{
          left: node.x,
          top: node.y,
          width: node.width,
          minHeight: node.height,
          zIndex: node.zIndex,
        }}
        onMouseDown={(e) => {
          if (editing) { e.stopPropagation(); return; }
          onMouseDown(e, node.id);
        }}
        onDoubleClick={(e) => {
          e.stopPropagation();
          if (!editing) setEditing(true);
        }}
      >
        <div
          ref={labelRef}
          contentEditable={editing}
          suppressContentEditableWarning
          style={{ fontSize: node.labelFontSize || 16 }}
          className={cn(
            "leading-snug px-2 py-1 whitespace-pre-wrap outline-none",
            node.labelBold && "font-bold",
            node.labelItalic && "italic",
            node.labelColor || "text-foreground",
            editing && "ring-1 ring-primary/60 rounded bg-background/50",
          )}
          onBlur={commitLabel}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              commitLabel();
            }
            if (e.key === "Escape") {
              // Revert to original text
              if (labelRef.current) labelRef.current.innerText = node.label || "Label";
              setEditing(false);
            }
            // Stop propagation during editing to prevent canvas shortcuts
            e.stopPropagation();
          }}
          onMouseDown={(e) => { if (editing) e.stopPropagation(); }}
        >
          {node.label || "Label"}
        </div>

        {/* Lock + Delete buttons on hover */}
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
                  title="Delete label"
                >
                  <Trash2 className="w-2.5 h-2.5" />
                </button>
              )}
            </div>
          );
        })()}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "absolute select-none rounded-lg border-2 shadow-md transition-shadow cursor-grab group",
        "hover:shadow-lg",
        style.bg,
        style.border,
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
      <div
        className={cn(
          "flex items-center gap-1.5 px-2 py-1 border-b rounded-t-lg",
          style.headerBg,
          style.headerBorder,
        )}
      >
        <Icon className={cn("w-3.5 h-3.5 shrink-0", style.iconClass)} />
        <span className="text-[11px] font-medium truncate flex-1">{node.label}</span>

        {/* Play button for executable nodes */}
        {isPlayable && onPlayNode && (
          <button
            className={cn(
              "flex items-center gap-0.5 text-[9px] font-medium px-1.5 py-0.5 rounded transition-colors",
              style.badgeBg, style.badgeText,
              "hover:opacity-80",
              isRunning && "opacity-60 pointer-events-none",
            )}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onPlayNode(node.id);
            }}
            disabled={isRunning}
          >
            {isRunning ? (
              <Loader2 className="w-2.5 h-2.5 animate-spin" />
            ) : (
              <Play className="w-2.5 h-2.5" />
            )}
            {isRunning ? "Running" : "Play"}
          </button>
        )}

        {!isPlayable && (
          <span
            className={cn(
              "text-[9px] font-semibold uppercase tracking-wider px-1 py-0.5 rounded",
              style.badgeBg,
              style.badgeText,
            )}
          >
            {style.badge}
          </span>
        )}
      </div>

      {/* Content snippet */}
      <div className="px-2 py-1.5 overflow-hidden flex-1">
        <p className="text-[10px] text-muted-foreground/80 leading-relaxed line-clamp-4">
          {node.snippet || "No preview available"}
        </p>
      </div>

      {/* Port dots */}
      <FlowPortDots
        node={node}
        isSelected={isSelected}
        onPortMouseDown={onPortMouseDown}
        accentColor={style.accent}
      />

      {/* Pause indicator */}
      {node.paused && (
        <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-yellow-500/90 text-white text-[7px] font-bold uppercase tracking-wider shadow-sm">
          <Pause className="w-2 h-2" />
          Paused
        </div>
      )}

      {/* Lock + Delete buttons — visible on hover */}
      {(() => {
        const lockMode = getEffectiveLockMode(node);
        return (
          <div className="absolute -top-2.5 -right-2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            {onToggleLock && (
              <button
                className={cn(
                  "w-5 h-5 rounded-full flex items-center justify-center shadow-sm transition-colors",
                  lockMode === "canvas" ? "bg-yellow-500 text-white"
                    : lockMode === "screen" ? "bg-blue-500 text-white"
                    : "bg-muted text-muted-foreground hover:bg-muted-foreground/20",
                )}
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => { e.stopPropagation(); onToggleLock(node.id); }}
                title={lockMode === "none" ? "Lock to canvas" : lockMode === "canvas" ? "Lock to screen" : "Unlock"}
              >
                {lockMode === "none" && <Unlock className="w-2.5 h-2.5" />}
                {lockMode === "canvas" && <Lock className="w-2.5 h-2.5" />}
                {lockMode === "screen" && <Monitor className="w-2.5 h-2.5" />}
              </button>
            )}
            {lockMode === "none" && (
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

      {/* Lock indicator */}
      {getEffectiveLockMode(node) === "canvas" && (
        <div className="absolute -top-2 -left-2 w-5 h-5 rounded-full bg-yellow-500/90 text-white flex items-center justify-center shadow-sm">
          <Lock className="w-2.5 h-2.5" />
        </div>
      )}
    </div>
  );
});
