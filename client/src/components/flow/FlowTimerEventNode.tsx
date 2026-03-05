/**
 * FlowTimerEventNode — Compact card for trigger nodes (presentational).
 *
 * All business logic (intervals, activation, deactivation, chain propagation)
 * is handled by useLifecycleEngine. This component only renders state and
 * delegates user actions via onToggleTrigger / onUpdateNode.
 */

import React, { useCallback } from "react";
import { Timer, Play, Square, Trash2, Lock, Unlock, Monitor, Radio, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FlowNode } from "./useFlowCanvas";
import { getEffectiveLockMode } from "./useFlowCanvas";
import { FlowPortDots } from "./FlowPortDots";

interface FlowTimerEventNodeProps {
  node: FlowNode;
  isSelected: boolean;
  onMouseDown: (e: React.MouseEvent, nodeId: string) => void;
  onDelete: (nodeId: string) => void;
  onUpdateNode: (nodeId: string, patch: Partial<FlowNode>) => void;
  onToggleLock?: (nodeId: string) => void;
  onPortMouseDown?: (e: React.MouseEvent, nodeId: string, portType: "input" | "output") => void;
  onDoubleClick?: (e: React.MouseEvent, nodeId: string) => void;
  /** Lifecycle engine toggle — activates or deactivates the trigger */
  onToggleTrigger: (nodeId: string) => void;
  /** Fire chain manually (for manual mode) */
  onPlayNode?: (nodeId: string) => void;
}

export const FlowTimerEventNode = React.memo(function FlowTimerEventNode({
  node,
  isSelected,
  onMouseDown,
  onDelete,
  onUpdateNode,
  onToggleLock,
  onDoubleClick,
  onPortMouseDown,
  onToggleTrigger,
  onPlayNode,
}: FlowTimerEventNodeProps) {
  const isRunning = node.timerRunning ?? false;
  const mode = node.triggerMode || "timed";
  const interval = node.timerInterval || 5000;

  const handleModeChange = useCallback(
    (newMode: "manual" | "timed" | "automated") => {
      if (isRunning) onToggleTrigger(node.id);
      const snippets = { manual: "Manual trigger — click to fire", timed: "Timed trigger ready", automated: "Auto trigger ready" };
      onUpdateNode(node.id, {
        triggerMode: newMode,
        snippet: snippets[newMode],
      });
    },
    [node.id, isRunning, onUpdateNode, onToggleTrigger],
  );

  return (
    <div
      className={cn(
        "absolute select-none rounded-lg border-2 shadow-md transition-shadow group flex flex-col",
        "bg-card hover:shadow-lg",
        isRunning ? "border-emerald-500/80 ring-1 ring-emerald-500/40" : "border-emerald-500/60",
        isSelected && "ring-2 ring-primary shadow-lg",
      )}
      style={{ left: node.x, top: node.y, width: node.width, height: node.height, zIndex: node.zIndex }}
      onDoubleClick={onDoubleClick ? (e) => onDoubleClick(e, node.id) : undefined}
    >
      {/* Header */}
      <div
        className={cn(
          "flex items-center gap-1.5 px-2 py-1 border-b rounded-t-lg cursor-grab shrink-0",
          isRunning ? "bg-emerald-500/20 border-emerald-500/30" : "bg-emerald-500/10 border-emerald-500/20",
        )}
        onMouseDown={(e) => onMouseDown(e, node.id)}
      >
        {mode === "manual" ? (
          <Zap className="w-3 h-3 shrink-0 text-emerald-500" />
        ) : mode === "timed" ? (
          <Timer className={cn("w-3 h-3 shrink-0", isRunning ? "text-emerald-500 animate-pulse" : "text-emerald-500")} />
        ) : (
          <Radio className={cn("w-3 h-3 shrink-0", isRunning ? "text-emerald-500 animate-pulse" : "text-emerald-500")} />
        )}
        <span className="text-[10px] font-medium truncate flex-1">{node.label}</span>
        <span className={cn(
          "text-[8px] font-semibold uppercase tracking-wider px-1 py-0.5 rounded",
          isRunning ? "bg-emerald-500/30 text-emerald-600 dark:text-emerald-400" : "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400",
        )}>
          {isRunning ? "LIVE" : mode === "manual" ? "Manual" : mode === "timed" ? "Timed" : "Auto"}
        </span>
      </div>

      {/* Body */}
      <div
        className="flex-1 overflow-auto min-h-0 flex flex-col items-center justify-center px-2 py-1 gap-1"
        onMouseDown={(e) => e.stopPropagation()}
        onDoubleClick={(e) => e.stopPropagation()}
      >
        {/* Mode toggle pills */}
        <div className="flex gap-0.5 bg-muted/40 rounded-full p-0.5">
          <button
            className={cn(
              "px-2 py-0.5 rounded-full text-[8px] font-medium transition-colors",
              mode === "timed"
                ? "bg-emerald-500/20 text-emerald-500"
                : "text-muted-foreground hover:text-foreground",
            )}
            onClick={() => handleModeChange("timed")}
          >
            Timed
          </button>
          <button
            className={cn(
              "px-2 py-0.5 rounded-full text-[8px] font-medium transition-colors",
              mode === "automated"
                ? "bg-emerald-500/20 text-emerald-500"
                : "text-muted-foreground hover:text-foreground",
            )}
            onClick={() => handleModeChange("automated")}
          >
            Auto
          </button>
        </div>

        {/* Start/Stop / Fire button */}
        <button
          className={cn(
            "w-10 h-10 rounded-full flex items-center justify-center transition-all",
            mode === "manual"
              ? "bg-emerald-500/15 text-emerald-500 hover:bg-emerald-500/25"
              : isRunning
                ? "bg-emerald-500 text-white hover:bg-emerald-600 shadow-md shadow-emerald-500/30"
                : "bg-emerald-500/15 text-emerald-500 hover:bg-emerald-500/25",
          )}
          onClick={() => mode === "manual" ? onPlayNode?.(node.id) : onToggleTrigger(node.id)}
        >
          {mode === "manual" ? (
            <Zap className="w-5 h-5" />
          ) : isRunning ? (
            <Square className="w-4 h-4" />
          ) : (
            <Play className="w-5 h-5" />
          )}
        </button>

        {/* Status */}
        <p className="text-[8px] text-muted-foreground text-center leading-relaxed">
          {mode === "manual"
            ? node.timerPulseCount
              ? `${node.timerPulseCount} fires`
              : "Click to fire"
            : isRunning
              ? mode === "timed"
                ? `Pulse #${node.timerPulseCount || 0}`
                : `Listening... (${node.timerPulseCount || 0} fires)`
              : node.timerPulseCount
                ? `${node.timerPulseCount} ${mode === "timed" ? "pulses" : "fires"}`
                : mode === "timed" ? "Click to start" : "Click to listen"}
        </p>

        {/* Interval label (timed only) */}
        {mode === "timed" && (
          <p className="text-[7px] text-muted-foreground/50">
            Every {interval / 1000}s
          </p>
        )}
      </div>

      {/* Port dots */}
      <FlowPortDots node={node} isSelected={isSelected} onPortMouseDown={onPortMouseDown} accentColor="emerald" />

      {/* Lock + Delete buttons */}
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
                onClick={(e) => {
                  e.stopPropagation();
                  if (isRunning) onToggleTrigger(node.id);
                  onDelete(node.id);
                }}
                title="Delete node"
              >
                <Trash2 className="w-2.5 h-2.5" />
              </button>
            )}
          </div>
        );
      })()}

      {/* Running pulse indicator */}
      {isRunning && (
        <div className="absolute -top-1 -left-1 w-3 h-3">
          <div className="absolute inset-0 bg-emerald-500 rounded-full animate-ping opacity-50" />
          <div className="absolute inset-0.5 bg-emerald-500 rounded-full" />
        </div>
      )}
    </div>
  );
});
