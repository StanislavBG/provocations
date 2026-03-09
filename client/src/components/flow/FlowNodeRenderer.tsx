import React, { useState, useRef, useCallback, useEffect } from "react";
import { Pause, Trash2, Lock, Unlock, Play, Loader2, Monitor, RotateCcw, AlertTriangle, Ban, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FlowNode, FlowNodeType } from "./useFlowCanvas";
import { getEffectiveLockMode } from "./useFlowCanvas";
import { FlowPortDots } from "./FlowPortDots";
import {
  NODE_STYLES,
  NODE_ICONS,
  ACCENT_BG,
  PLAYABLE_TYPES,
  FLOW_NODE_REGISTRY,
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
  /** I3: Retry callback for failed nodes in chain execution */
  onRetryNode?: (nodeId: string) => void;
}

/**
 * Custom comparator for FlowNodeRenderer memo boundary (E2 optimization).
 * Only re-renders when data-bearing props change — callback identity changes are ignored
 * since they are stable useCallback references from the parent.
 */
function flowNodePropsAreEqual(
  prev: FlowNodeRendererProps,
  next: FlowNodeRendererProps,
): boolean {
  return (
    prev.node.id === next.node.id &&
    prev.node.x === next.node.x &&
    prev.node.y === next.node.y &&
    prev.node.width === next.node.width &&
    prev.node.height === next.node.height &&
    prev.node.label === next.node.label &&
    prev.node.snippet === next.node.snippet &&
    prev.node.content === next.node.content &&
    prev.node.llmStatus === next.node.llmStatus &&
    prev.node.paused === next.node.paused &&
    prev.node.zIndex === next.node.zIndex &&
    prev.node.type === next.node.type &&
    prev.node.locked === next.node.locked &&
    prev.node.lockMode === next.node.lockMode &&
    prev.node.labelFontSize === next.node.labelFontSize &&
    prev.node.labelBold === next.node.labelBold &&
    prev.node.labelItalic === next.node.labelItalic &&
    prev.node.labelColor === next.node.labelColor &&
    prev.isSelected === next.isSelected
  );
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
  onRetryNode,
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

  const lockMode = getEffectiveLockMode(node);

  // I2/I3: Chain error/blocked state
  const chainError = node.chainStatus === "error";
  const chainBlocked = node.chainStatus === "blocked";
  const chainCancelled = node.chainStatus === "cancelled";
  const hasChainIssue = chainError || chainBlocked || chainCancelled;

  // ── Shared inline Lock button ──
  const lockButton = onToggleLock && (
    <button
      className={cn(
        "w-4 h-4 rounded flex items-center justify-center transition-colors",
        lockMode === "canvas" ? "text-yellow-500"
          : lockMode === "screen" ? "text-blue-500"
          : "text-muted-foreground/50 hover:text-muted-foreground opacity-0 group-hover:opacity-100",
      )}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => { e.stopPropagation(); onToggleLock(node.id); }}
      title={lockMode === "none" ? "Lock to canvas" : lockMode === "canvas" ? "Lock to screen" : "Unlock"}
    >
      {lockMode === "none" && <Unlock className="w-2.5 h-2.5" />}
      {lockMode === "canvas" && <Lock className="w-2.5 h-2.5" />}
      {lockMode === "screen" && <Monitor className="w-2.5 h-2.5" />}
    </button>
  );

  // ── Shared inline Delete button ──
  const deleteButton = lockMode === "none" && (
    <button
      className="w-4 h-4 rounded flex items-center justify-center text-muted-foreground/50 hover:text-destructive transition-colors opacity-0 group-hover:opacity-100"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => { e.stopPropagation(); onDelete(node.id); }}
      title="Delete"
    >
      <Trash2 className="w-2.5 h-2.5" />
    </button>
  );

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

        {/* Action bar on hover — inline below the label */}
        <div className="flex items-center justify-end gap-0.5 px-1 py-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          {lockButton}
          {deleteButton}
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "absolute select-none rounded-lg border-2 shadow-md transition-shadow cursor-grab group",
        "hover:shadow-lg",
        style.bg,
        chainError ? "border-red-500" : chainBlocked ? "border-orange-400/60" : chainCancelled ? "border-muted-foreground/40" : style.border,
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
      {/* Header with Lock, Play/Badge, Delete all inline */}
      <div
        className={cn(
          "flex items-center gap-1 px-2 py-1 border-b rounded-t-lg",
          style.headerBg,
          style.headerBorder,
        )}
      >
        <Icon className={cn("w-3.5 h-3.5 shrink-0", style.iconClass)} />
        <span className="text-[11px] font-medium truncate flex-1">{node.label}</span>

        {/* Lock button */}
        {lockButton}

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

        {/* Delete button */}
        {deleteButton}
      </div>

      {/* Content snippet — shows node output, or detailed usage instructions when empty */}
      <div className="px-2 py-1.5 overflow-hidden flex-1">
        {node.snippet ? (
          <p className="text-[10px] text-muted-foreground/80 leading-relaxed line-clamp-4">
            {node.snippet}
          </p>
        ) : (
          <p className="text-[10px] text-muted-foreground/50 leading-relaxed line-clamp-6 italic">
            {FLOW_NODE_REGISTRY[node.type]?.inputDescription || "Double-click to configure"}
          </p>
        )}
      </div>

      {/* Port dots */}
      <FlowPortDots
        node={node}
        isSelected={isSelected}
        onPortMouseDown={onPortMouseDown}
        accentColor={style.accent}
      />

      {/* Pause indicator */}
      {node.paused && !hasChainIssue && (
        <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-yellow-500/90 text-white text-[7px] font-bold uppercase tracking-wider shadow-sm">
          <Pause className="w-2 h-2" />
          Paused
        </div>
      )}

      {/* I2: Chain error indicator with retry button (I3) */}
      {chainError && (
        <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500/90 text-white text-[7px] font-bold uppercase tracking-wider shadow-sm whitespace-nowrap">
          <AlertTriangle className="w-2.5 h-2.5" />
          Error
          {onRetryNode && (
            <button
              className="ml-1 flex items-center gap-0.5 px-1 py-0.5 rounded bg-white/20 hover:bg-white/30 transition-colors text-[7px]"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                onRetryNode(node.id);
              }}
              title={node.chainErrorMessage ?? "Retry this node"}
            >
              <RotateCcw className="w-2 h-2" />
              Retry
            </button>
          )}
        </div>
      )}

      {/* I2: Chain blocked indicator */}
      {chainBlocked && (
        <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-orange-400/90 text-white text-[7px] font-bold uppercase tracking-wider shadow-sm whitespace-nowrap">
          <Ban className="w-2 h-2" />
          Blocked
        </div>
      )}

      {/* I6: Chain cancelled indicator */}
      {chainCancelled && (
        <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-muted-foreground/70 text-white text-[7px] font-bold uppercase tracking-wider shadow-sm whitespace-nowrap">
          <X className="w-2 h-2" />
          Cancelled
        </div>
      )}
    </div>
  );
}, flowNodePropsAreEqual);
