/**
 * FlowNodeContainer — Unified compact card wrapper for flow nodes.
 *
 * Provides the standard card chrome (header, lock/delete buttons, port dots,
 * pause/lock indicators) for ALL node types except zones.
 * The body content is rendered via the `children` prop.
 */

import React, { useCallback, useState, useRef, useEffect } from "react";
import { Pause, Trash2, Lock, Unlock, Play, Loader2, Settings, AlertTriangle, Ban, X, RotateCcw } from "lucide-react";
import { InputModeToggle } from "./InputModeToggle";
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

  /** I3: Retry callback for failed nodes in chain execution */
  onRetryNode?: (nodeId: string) => void;

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
  onRetryNode,
  children,
}: FlowNodeContainerProps) {
  const def = FLOW_NODE_REGISTRY[node.type];
  const style = def.style;
  const Icon = def.icon;
  const isPlayable = PLAYABLE_TYPES.has(node.type);
  const isRunning = node.llmStatus === "running";
  const lockMode = getEffectiveLockMode(node);

  // I2/I3: Chain error/blocked state
  const chainError = node.chainStatus === "error";
  const chainBlocked = node.chainStatus === "blocked";
  const chainCancelled = node.chainStatus === "cancelled";
  const hasChainIssue = chainError || chainBlocked || chainCancelled;

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

  // ── Coherence Gate: circular node with score display ──
  if (node.type === "coherence-gate") {
    const score = node.coherenceLastScore;
    const verdict = node.coherenceLastVerdict;
    const threshold = node.coherenceThreshold ?? 75;
    const strictness = node.coherenceStrictness ?? "medium";
    const isGateRunning = node.llmStatus === "running";

    const ringColor =
      score == null
        ? "border-emerald-500/40"
        : score >= threshold
          ? "border-emerald-500"
          : score >= threshold * 0.8
            ? "border-amber-500"
            : "border-red-500";

    const scoreColor =
      score == null
        ? "text-muted-foreground"
        : score >= threshold
          ? "text-emerald-400"
          : score >= threshold * 0.8
            ? "text-amber-400"
            : "text-red-400";

    const bgGlow =
      score == null
        ? ""
        : score >= threshold
          ? "shadow-emerald-500/20"
          : score >= threshold * 0.8
            ? "shadow-amber-500/20"
            : "shadow-red-500/20";

    const strictnessColor =
      strictness === "strict" ? "bg-red-500/20 text-red-400"
        : strictness === "medium" ? "bg-amber-500/20 text-amber-400"
          : "bg-yellow-500/20 text-yellow-400";

    return (
      <div
        className="absolute select-none group"
        style={{
          left: node.x,
          top: node.y,
          width: node.width,
          height: node.height,
          zIndex: node.zIndex,
        }}
        onMouseDown={(e) => onMouseDown(e, node.id)}
        onDoubleClick={onDoubleClick ? (e) => onDoubleClick(e, node.id) : undefined}
      >
        {/* Circular body */}
        <div
          className={cn(
            "w-full h-full rounded-full border-[3px] flex flex-col items-center justify-center",
            "bg-card shadow-lg transition-all cursor-grab",
            ringColor,
            bgGlow,
            isSelected && "ring-2 ring-primary",
            isGateRunning && "animate-pulse",
          )}
        >
          {/* Score display */}
          <span className={cn("text-2xl font-bold", scoreColor)}>
            {isGateRunning ? "..." : score != null ? `${score}%` : "—"}
          </span>

          {/* Verdict */}
          {verdict && !isGateRunning && (
            <span className={cn(
              "text-[9px] font-semibold uppercase mt-0.5",
              verdict === "pass" ? "text-emerald-400" : "text-red-400",
            )}>
              {verdict}
            </span>
          )}

          {/* Strictness badge */}
          <span className={cn(
            "text-[7px] font-semibold uppercase px-1.5 py-0.5 rounded-full mt-1",
            strictnessColor,
          )}>
            {strictness}
          </span>
        </div>

        {/* Label below circle */}
        <div className="text-center mt-1">
          <span className="text-[10px] font-medium text-muted-foreground truncate block">
            {node.label}
          </span>
        </div>

        {/* Port dots */}
        <FlowPortDots
          node={node}
          isSelected={isSelected}
          onPortMouseDown={onPortMouseDown}
          accentColor={style.accent}
        />

        {/* Delete button on hover */}
        {lockMode === "none" && (
          <button
            className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-destructive/80 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); onDelete(node.id); }}
            title="Delete"
          >
            <Trash2 className="w-2.5 h-2.5" />
          </button>
        )}

        {/* Play button on hover */}
        {onPlayNode && (
          <button
            className={cn(
              "absolute -bottom-1 left-1/2 -translate-x-1/2 flex items-center gap-0.5 text-[8px] font-medium px-2 py-0.5 rounded-full transition-all",
              "bg-emerald-500/80 text-white opacity-0 group-hover:opacity-100",
              isGateRunning && "opacity-100 pointer-events-none",
            )}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); onPlayNode(node.id); }}
            disabled={isGateRunning}
          >
            {isGateRunning ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <Play className="w-2.5 h-2.5" />}
            {isGateRunning ? "Eval" : "Eval"}
          </button>
        )}
      </div>
    );
  }

  // ── Standard card rendering ──
  return (
    <div
      role="article"
      aria-label={`${node.type} node: ${node.label}`}
      tabIndex={0}
      className={cn(
        "absolute select-none rounded-lg border-2 shadow-md transition-shadow group flex flex-col",
        "hover:shadow-lg",
        style.bg,
        chainError ? "border-red-500" : chainBlocked ? "border-orange-400/60" : chainCancelled ? "border-muted-foreground/40" : (borderOverride || style.border),
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
      title={
        node.llmStatus === "running" ? "Running..."
          : node.llmStatus === "done" ? "Completed successfully"
          : node.llmStatus === "error" ? `Failed: ${node.llmError || "Unknown error"}`
          : undefined
      }
    >
      {/* Status pulse overlay */}
      {node.llmStatus && node.llmStatus !== "idle" && (() => {
        const speed = node.pulseSpeed ?? 2;
        const opacity = (node.pulseOpacity ?? 10) / 100;
        const colorMap: Record<string, string> = {
          running: node.statusColorRunning ?? "#2196F3",
          done: node.statusColorSuccess ?? "#4CAF50",
          error: node.statusColorFailure ?? "#F44336",
        };
        const color = colorMap[node.llmStatus!] ?? "transparent";
        const shouldPulse = node.llmStatus === "running" || (node.llmStatus === "error" && !node.failureAcknowledged);
        const pulseSpeed = node.llmStatus === "error" ? Math.min(speed, 0.8) : speed;

        return (
          <div
            className="absolute inset-0 rounded-lg pointer-events-none z-0"
            style={{
              backgroundColor: color,
              opacity: shouldPulse ? undefined : opacity,
              animation: shouldPulse
                ? `flowNodePulse ${pulseSpeed}s ease-in-out infinite`
                : undefined,
              ['--pulse-opacity' as string]: opacity,
            } as React.CSSProperties}
          />
        );
      })()}

      {/* Header — always draggable */}
      <div
        className={cn(
          "flex items-center gap-1.5 px-2 py-1 border-b rounded-t-lg shrink-0 relative z-10",
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

        {/* Replace / +New output mode toggle for playable nodes */}
        {isPlayable && onUpdateNode && (
          <div className="flex items-center gap-0.5" onMouseDown={(e) => e.stopPropagation()}>
            <button
              className={cn(
                "text-[7px] px-1 py-0.5 rounded transition-colors",
                (node.outputReplaceMode ?? "replace") === "replace"
                  ? "bg-amber-500/30 text-amber-300 font-semibold"
                  : "bg-muted/30 text-muted-foreground/50 hover:bg-muted/50",
              )}
              onClick={(e) => { e.stopPropagation(); onUpdateNode(node.id, { outputReplaceMode: "replace" }); }}
              title="Replace existing outputs on re-run"
            >
              Replace
            </button>
            <button
              className={cn(
                "text-[7px] px-1 py-0.5 rounded transition-colors",
                node.outputReplaceMode === "new"
                  ? "bg-amber-500/30 text-amber-300 font-semibold"
                  : "bg-muted/30 text-muted-foreground/50 hover:bg-muted/50",
              )}
              onClick={(e) => { e.stopPropagation(); onUpdateNode(node.id, { outputReplaceMode: "new" }); }}
              title="Keep existing outputs and add new ones"
            >
              +New
            </button>
          </div>
        )}

        {/* Input mode toggle: Wait All vs Fire Each (playable nodes only) */}
        {isPlayable && onUpdateNode && (
          <InputModeToggle node={node} onUpdateNode={onUpdateNode} />
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
          <div className="flex-1 overflow-auto min-h-0 flex flex-col relative z-10" onMouseDown={(e) => e.stopPropagation()}>
            {children}
          </div>
        ) : (
          <div className="relative z-10 flex-1 flex flex-col">{children}</div>
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
