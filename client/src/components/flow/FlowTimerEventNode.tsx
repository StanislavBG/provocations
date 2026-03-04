import React, { useCallback, useRef, useEffect, useState } from "react";
import { Timer, Play, Square, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FlowNode } from "./useFlowCanvas";
import { FlowPortDots } from "./FlowPortDots";

interface FlowTimerEventNodeProps {
  node: FlowNode;
  isSelected: boolean;
  onMouseDown: (e: React.MouseEvent, nodeId: string) => void;
  onDelete: (nodeId: string) => void;
  onUpdateNode: (nodeId: string, patch: Partial<FlowNode>) => void;
  onPortMouseDown?: (e: React.MouseEvent, nodeId: string, portType: "input" | "output") => void;
}

export const FlowTimerEventNode = React.memo(function FlowTimerEventNode({
  node,
  isSelected,
  onMouseDown,
  onDelete,
  onUpdateNode,
  onPortMouseDown,
}: FlowTimerEventNodeProps) {
  const intervalRef = useRef<number | null>(null);
  const [isRunning, setIsRunning] = useState(node.timerRunning ?? false);
  const countRef = useRef(node.timerPulseCount || 0);
  const contentRef = useRef(node.content || "");

  useEffect(() => {
    setIsRunning(node.timerRunning ?? false);
  }, [node.timerRunning]);

  const startTimer = useCallback(() => {
    countRef.current = node.timerPulseCount || 0;
    contentRef.current = node.content || "";

    onUpdateNode(node.id, {
      timerRunning: true,
      snippet: "Timer running...",
      label: node.label === "Timer Event"
        ? `Timer — ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
        : node.label,
    });
    setIsRunning(true);

    intervalRef.current = window.setInterval(() => {
      countRef.current++;
      const now = new Date();
      const ts = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
      const entry = `[${ts}] Pulse #${countRef.current}`;
      contentRef.current += (contentRef.current ? "\n" : "") + entry;

      onUpdateNode(node.id, {
        timerPulseCount: countRef.current,
        timerLastPulse: now.toISOString(),
        content: contentRef.current,
        snippet: `Pulse #${countRef.current} — ${ts}`,
      });
    }, node.timerInterval || 5000);
  }, [node.id, node.label, node.timerInterval, node.timerPulseCount, node.content, onUpdateNode]);

  const stopTimer = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsRunning(false);
    onUpdateNode(node.id, {
      timerRunning: false,
      snippet: `Stopped — ${countRef.current} pulses`,
    });
  }, [node.id, onUpdateNode]);

  const toggleTimer = useCallback(() => {
    if (isRunning) stopTimer();
    else startTimer();
  }, [isRunning, startTimer, stopTimer]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, []);

  const interval = node.timerInterval || 5000;

  return (
    <div
      className={cn(
        "absolute select-none rounded-lg border-2 shadow-md transition-shadow group flex flex-col",
        "bg-card hover:shadow-lg",
        isRunning ? "border-emerald-500/80 ring-1 ring-emerald-500/40" : "border-emerald-500/60",
        isSelected && "ring-2 ring-primary shadow-lg",
      )}
      style={{ left: node.x, top: node.y, width: node.width, height: node.height, zIndex: node.zIndex }}
    >
      {/* Header */}
      <div
        className={cn(
          "flex items-center gap-1.5 px-2 py-1 border-b rounded-t-lg cursor-grab shrink-0",
          isRunning ? "bg-emerald-500/20 border-emerald-500/30" : "bg-emerald-500/10 border-emerald-500/20",
        )}
        onMouseDown={(e) => onMouseDown(e, node.id)}
      >
        <Timer className={cn("w-3 h-3 shrink-0", isRunning ? "text-emerald-500 animate-pulse" : "text-emerald-500")} />
        <span className="text-[10px] font-medium truncate flex-1">{node.label}</span>
        <span className={cn(
          "text-[8px] font-semibold uppercase tracking-wider px-1 py-0.5 rounded",
          isRunning ? "bg-emerald-500/30 text-emerald-600 dark:text-emerald-400" : "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400",
        )}>
          {isRunning ? "LIVE" : "Timer"}
        </span>
      </div>

      {/* Body */}
      <div
        className="flex-1 overflow-auto min-h-0 flex flex-col items-center justify-center px-2 py-1"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Start/Stop toggle */}
        <button
          className={cn(
            "w-10 h-10 rounded-full flex items-center justify-center transition-all",
            isRunning
              ? "bg-emerald-500 text-white hover:bg-emerald-600 shadow-md shadow-emerald-500/30"
              : "bg-emerald-500/15 text-emerald-500 hover:bg-emerald-500/25",
          )}
          onClick={toggleTimer}
        >
          {isRunning ? <Square className="w-4 h-4" /> : <Play className="w-5 h-5" />}
        </button>

        {/* Status */}
        <p className="text-[8px] text-muted-foreground mt-1 text-center leading-relaxed">
          {isRunning
            ? `Pulse #${node.timerPulseCount || 0}`
            : node.timerPulseCount
              ? `${node.timerPulseCount} pulses sent`
              : "Click to start"}
        </p>

        {/* Interval label */}
        <p className="text-[7px] text-muted-foreground/50 mt-0.5">
          Every {interval / 1000}s
        </p>
      </div>

      {/* Port dots */}
      <FlowPortDots node={node} isSelected={isSelected} onPortMouseDown={onPortMouseDown} accentColor="emerald" />

      {/* Delete button */}
      <button
        className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          if (isRunning) stopTimer();
          onDelete(node.id);
        }}
      >
        <X className="w-3 h-3" />
      </button>

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
