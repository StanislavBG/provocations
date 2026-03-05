/**
 * FlowNodeContainer — Unified compact card wrapper for flow nodes.
 *
 * Provides the standard card chrome (header, lock/delete buttons, port dots,
 * pause/lock indicators) for ALL node types except zones.
 * The body content is rendered via the `children` prop.
 */

import React, { useCallback, useState, useRef, useEffect } from "react";
import { Pause, Trash2, Lock, Unlock, Play, Loader2, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FlowNode, FlowNodeType } from "./useFlowCanvas";
import { getEffectiveLockMode } from "./useFlowCanvas";
import { FlowPortDots } from "./FlowPortDots";
import { FLOW_NODE_REGISTRY, PLAYABLE_TYPES, type FlowNodeDefinition } from "./FlowNodeRegistry";
import { useNodeResize } from "./useNodeResize";
import { ResizeHandles } from "./ResizeHandles";

// ── Props ──

export interface FlowNodeContainerProps {
  node: FlowNode;
  isSelected: boolean;
  zoom?: number;

  // Canvas interaction
  onMouseDown: (e: React.MouseEvent, nodeId: string) => void;
  onDoubleClick?: (e: React.MouseEvent, nodeId: string) => void;
  onDelete: (nodeId: string) => void;
  onToggleLock?: (nodeId: string) => void;
  onPortMouseDown?: (e: React.MouseEvent, nodeId: string, portType: "input" | "output") => void;
  onPlayNode?: (nodeId: string) => void;
  onUpdateNode?: (nodeId: string, patch: Partial<FlowNode>) => void;

  /** Override the card border class (e.g., for recording state) */
  borderOverride?: string;

  /** Badge text override (e.g., "REC" when recording) */
  badgeOverride?: string;

  /** Extra indicator at top-left (e.g., recording pulse) */
  topLeftIndicator?: React.ReactNode;

  /** Whether header is the only draggable area (body stops propagation) */
  interactiveBody?: boolean;

  /** Body content slot */
  children?: React.ReactNode;
}

// ── Component ──

export const FlowNodeContainer = React.memo(function FlowNodeContainer({
  node,
  isSelected,
  zoom = 1,
  onMouseDown,
  onDoubleClick,
  onDelete,
  onToggleLock,
  onPortMouseDown,
  onPlayNode,
  onUpdateNode,
  borderOverride,
  badgeOverride,
  topLeftIndicator,
  interactiveBody,
  children,
}: FlowNodeContainerProps) {
  const def = FLOW_NODE_REGISTRY[node.type];
  const style = def.style;
  const Icon = def.icon;
  const isPlayable = PLAYABLE_TYPES.has(node.type);
  const isRunning = node.llmStatus === "running";
  const lockMode = getEffectiveLockMode(node);

  const { handleResizeMouseDown } = useNodeResize({
    nodeId: node.id,
    x: node.x,
    y: node.y,
    width: node.width,
    height: node.height,
    zoom,
    minWidth: def.minWidth,
    minHeight: def.minHeight,
    onUpdateNode: onUpdateNode || (() => {}),
  });

  // ── Label nodes: transparent text annotation with inline editing ──
  if (node.type === "label") {
    return (
      <LabelNode
        node={node}
        isSelected={isSelected}
        lockMode={lockMode}
        onMouseDown={onMouseDown}
        onDelete={onDelete}
        onToggleLock={onToggleLock}
        onUpdateNode={onUpdateNode}
        onOpenSettings={onDoubleClick ? (nodeId: string) => {
          // Dispatch a custom event to open the label formatting dialog
          window.dispatchEvent(new CustomEvent("flow:open-label-settings", { detail: { nodeId } }));
        } : undefined}
      />
    );
  }

  // ── Standard card rendering ──
  return (
    <div
      className={cn(
        "absolute select-none rounded-lg border-2 shadow-md transition-shadow group flex flex-col",
        "hover:shadow-lg",
        style.bg,
        borderOverride || style.border,
        isSelected && "ring-2 ring-primary shadow-lg",
      )}
      style={{
        left: node.x,
        top: node.y,
        width: node.width,
        height: node.height,
        zIndex: node.zIndex,
      }}
      onMouseDown={interactiveBody ? undefined : (e) => onMouseDown(e, node.id)}
      onDoubleClick={onDoubleClick ? (e) => onDoubleClick(e, node.id) : undefined}
    >
      {/* Header — always draggable */}
      <div
        className={cn(
          "flex items-center gap-1.5 px-2 py-1 border-b rounded-t-lg shrink-0",
          interactiveBody && "cursor-grab",
          style.headerBg,
          style.headerBorder,
        )}
        onMouseDown={interactiveBody ? (e) => onMouseDown(e, node.id) : undefined}
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

        {/* Badge for non-playable nodes */}
        {!isPlayable && (
          <span
            className={cn(
              "text-[9px] font-semibold uppercase tracking-wider px-1 py-0.5 rounded",
              style.badgeBg,
              style.badgeText,
            )}
          >
            {badgeOverride || style.badge}
          </span>
        )}
      </div>

      {/* Body — content slot */}
      {children ? (
        interactiveBody ? (
          <div className="flex-1 overflow-auto min-h-0 flex flex-col" onMouseDown={(e) => e.stopPropagation()}>
            {children}
          </div>
        ) : (
          children
        )
      ) : (
        /* Default body: snippet preview */
        <div className="px-2 py-1.5 overflow-hidden flex-1">
          <p className="text-[10px] text-muted-foreground/80 leading-relaxed line-clamp-4">
            {node.snippet || "No preview available"}
          </p>
        </div>
      )}

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
      <div className="absolute -top-2.5 -right-2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        {onToggleLock && (
          <LockButton lockMode={lockMode} nodeId={node.id} onToggleLock={onToggleLock} />
        )}
        {lockMode === "none" && (
          <DeleteButton nodeId={node.id} onDelete={onDelete} />
        )}
      </div>

      {/* Resize handles — hidden when locked */}
      {lockMode === "none" && onUpdateNode && (
        <ResizeHandles
          isSelected={isSelected}
          onResizeMouseDown={handleResizeMouseDown}
        />
      )}

      {/* Lock indicator */}
      {lockMode === "canvas" && (
        <div className="absolute -top-2 -left-2 w-5 h-5 rounded-full bg-yellow-500/90 text-white flex items-center justify-center shadow-sm">
          <Lock className="w-2.5 h-2.5" />
        </div>
      )}

      {/* Optional top-left indicator (e.g., recording/running pulse) */}
      {topLeftIndicator}
    </div>
  );
});

// ── Shared button sub-components ──

function LockButton({
  lockMode,
  nodeId,
  onToggleLock,
}: {
  lockMode: "none" | "canvas" | "screen";
  nodeId: string;
  onToggleLock: (nodeId: string) => void;
}) {
  return (
    <button
      className={cn(
        "w-5 h-5 rounded-full flex items-center justify-center shadow-sm transition-colors",
        lockMode !== "none"
          ? "bg-yellow-500 text-white"
          : "bg-muted text-muted-foreground hover:bg-muted-foreground/20",
      )}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation();
        onToggleLock(nodeId);
      }}
      title={lockMode === "none" ? "Lock position" : "Unlock"}
    >
      {lockMode === "none" ? <Unlock className="w-2.5 h-2.5" /> : <Lock className="w-2.5 h-2.5" />}
    </button>
  );
}

function DeleteButton({
  nodeId,
  onDelete,
  title = "Delete node",
}: {
  nodeId: string;
  onDelete: (nodeId: string) => void;
  title?: string;
}) {
  return (
    <button
      className="w-5 h-5 rounded-full bg-destructive/90 text-destructive-foreground flex items-center justify-center shadow-sm hover:bg-destructive transition-colors"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation();
        onDelete(nodeId);
      }}
      title={title}
    >
      <Trash2 className="w-2.5 h-2.5" />
    </button>
  );
}

// ── Label node with inline editing ──

function LabelNode({
  node,
  isSelected,
  lockMode,
  onMouseDown,
  onDelete,
  onToggleLock,
  onUpdateNode,
  onOpenSettings,
}: {
  node: FlowNode;
  isSelected: boolean;
  lockMode: "none" | "canvas" | "screen";
  onMouseDown: (e: React.MouseEvent, nodeId: string) => void;
  onDelete: (nodeId: string) => void;
  onToggleLock?: (nodeId: string) => void;
  onUpdateNode?: (nodeId: string, patch: Partial<FlowNode>) => void;
  onOpenSettings?: (nodeId: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const labelRef = useRef<HTMLDivElement>(null);

  const commitLabel = useCallback(() => {
    if (!labelRef.current || !onUpdateNode) return;
    const text = labelRef.current.innerText.trim() || "Label";
    onUpdateNode(node.id, { label: text });
    setEditing(false);
  }, [node.id, onUpdateNode]);

  useEffect(() => {
    if (editing && labelRef.current) {
      labelRef.current.focus();
      const sel = window.getSelection();
      if (sel) {
        sel.selectAllChildren(labelRef.current);
        sel.collapseToEnd();
      }
    }
  }, [editing]);

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
            if (labelRef.current) labelRef.current.innerText = node.label || "Label";
            setEditing(false);
          }
          e.stopPropagation();
        }}
        onMouseDown={(e) => { if (editing) e.stopPropagation(); }}
      >
        {node.label || "Label"}
      </div>

      {/* Settings + Lock + Delete buttons on hover */}
      <div className="absolute -top-2.5 -right-2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        {onOpenSettings && (
          <button
            className="w-5 h-5 rounded-full bg-muted text-muted-foreground hover:bg-muted-foreground/20 flex items-center justify-center shadow-sm transition-colors"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); onOpenSettings(node.id); }}
            title="Label formatting"
          >
            <Settings className="w-2.5 h-2.5" />
          </button>
        )}
        {onToggleLock && (
          <LockButton lockMode={lockMode} nodeId={node.id} onToggleLock={onToggleLock} />
        )}
        {lockMode === "none" && (
          <DeleteButton nodeId={node.id} onDelete={onDelete} />
        )}
      </div>
    </div>
  );
}
