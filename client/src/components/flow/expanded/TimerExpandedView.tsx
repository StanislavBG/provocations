/**
 * TimerExpandedView — Full expanded view for Trigger nodes.
 *
 * Two modes:
 *   Timed   — interval config slider, pulse log with timestamps, start/stop controls
 *   Automated — listens for upstream node completion, shows connected inputs and fire log
 */

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { Play, Square, Timer, Zap, Radio, ArrowDownToLine, Hand } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { FlowNode, FlowEdge } from "../useFlowCanvas";

interface TimerExpandedViewProps {
  node: FlowNode;
  onUpdateNode: (nodeId: string, patch: Partial<FlowNode>) => void;
  onPlayNode?: (nodeId: string) => void;
  /** Lifecycle engine toggle — activates or deactivates the trigger */
  onToggleTrigger?: (nodeId: string) => void;
  /** All nodes on canvas — needed for automated mode to show upstream inputs */
  allNodes?: FlowNode[];
  /** All edges on canvas — needed for automated mode to find input connections */
  allEdges?: FlowEdge[];
}

export function TimerExpandedView({ node, onUpdateNode, onPlayNode, onToggleTrigger, allNodes, allEdges }: TimerExpandedViewProps) {
  const isRunning = node.timerRunning || false;
  const interval = node.timerInterval || 5000;
  const pulseCount = node.timerPulseCount || 0;
  const pulseLog = node.content || "";
  const mode = node.triggerMode || "timed";
  const logEndRef = useRef<HTMLDivElement>(null);

  // Upstream nodes connected to this trigger's input port
  const upstreamNodes = useMemo(() => {
    if (!allNodes || !allEdges) return [];
    const inputEdges = allEdges.filter((e) => e.toNodeId === node.id);
    return inputEdges
      .map((e) => allNodes.find((n) => n.id === e.fromNodeId))
      .filter(Boolean) as FlowNode[];
  }, [node.id, allNodes, allEdges]);

  // Auto-scroll pulse log
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [pulseCount]);

  const handleIntervalChange = useCallback((value: number) => {
    onUpdateNode(node.id, { timerInterval: value });
  }, [node.id, onUpdateNode]);

  const handleToggle = useCallback(() => {
    if (onToggleTrigger) {
      onToggleTrigger(node.id);
    } else {
      onUpdateNode(node.id, { timerRunning: !isRunning });
    }
  }, [node.id, isRunning, onUpdateNode, onToggleTrigger]);

  const handleClearLog = useCallback(() => {
    onUpdateNode(node.id, {
      content: "",
      timerPulseCount: 0,
      snippet: mode === "timed" ? "Timed trigger ready" : "Auto trigger ready",
    });
  }, [node.id, onUpdateNode, mode]);

  const handleSetMode = useCallback((newMode: "manual" | "timed" | "automated") => {
    if (isRunning) {
      if (onToggleTrigger) {
        onToggleTrigger(node.id);
      } else {
        onUpdateNode(node.id, { timerRunning: false });
      }
    }
    const snippets = { manual: "Manual trigger — click to fire", timed: "Timed trigger ready", automated: "Auto trigger ready" };
    onUpdateNode(node.id, {
      triggerMode: newMode,
      snippet: snippets[newMode],
    });
  }, [node.id, isRunning, onUpdateNode, onToggleTrigger]);

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left: Controls */}
      <div className="w-72 border-r flex flex-col shrink-0 bg-card/50">
        <div className="p-4 space-y-4">
          {/* Mode toggle */}
          <div className="flex gap-1 bg-muted/40 rounded-lg p-1">
            <button
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-[11px] font-medium transition-colors",
                mode === "manual"
                  ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
              onClick={() => handleSetMode("manual")}
            >
              <Hand className="w-3.5 h-3.5" />
              Manual
            </button>
            <button
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-[11px] font-medium transition-colors",
                mode === "timed"
                  ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
              onClick={() => handleSetMode("timed")}
            >
              <Timer className="w-3.5 h-3.5" />
              Timed
            </button>
            <button
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-[11px] font-medium transition-colors",
                mode === "automated"
                  ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
              onClick={() => handleSetMode("automated")}
            >
              <Radio className="w-3.5 h-3.5" />
              Auto
            </button>
          </div>

          {/* Visual indicator */}
          <div className="flex flex-col items-center gap-3 py-4">
            <div className={`relative w-20 h-20 rounded-full border-4 flex items-center justify-center ${
              isRunning ? "border-emerald-500 bg-emerald-500/10" : "border-border bg-muted/30"
            }`}>
              {isRunning && mode !== "manual" && (
                <div className="absolute inset-0 rounded-full border-4 border-emerald-500/30 animate-ping" />
              )}
              {mode === "manual" ? (
                <Hand className={`w-8 h-8 ${pulseCount > 0 ? "text-emerald-500" : "text-muted-foreground"}`} />
              ) : mode === "timed" ? (
                <Timer className={`w-8 h-8 ${isRunning ? "text-emerald-500" : "text-muted-foreground"}`} />
              ) : (
                <Radio className={`w-8 h-8 ${isRunning ? "text-emerald-500 animate-pulse" : "text-muted-foreground"}`} />
              )}
            </div>
            <Badge className={`text-xs ${isRunning ? "bg-emerald-500/20 text-emerald-600" : "bg-muted text-muted-foreground"}`}>
              {mode === "manual"
                ? pulseCount > 0
                  ? `${pulseCount} fires`
                  : "Click to fire"
                : isRunning
                  ? mode === "timed"
                    ? `Pulse #${pulseCount}`
                    : `Listening... (${pulseCount} fires)`
                  : pulseCount > 0
                    ? `${pulseCount} ${mode === "timed" ? "pulses" : "fires"} sent`
                    : "Ready"}
            </Badge>
          </div>

          {/* Timed mode: Interval slider */}
          {mode === "timed" && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Interval</p>
                <span className="text-xs font-mono text-foreground">{(interval / 1000).toFixed(1)}s</span>
              </div>
              <input
                type="range"
                min={1000}
                max={60000}
                step={1000}
                value={interval}
                onChange={(e) => handleIntervalChange(Number(e.target.value))}
                className="w-full accent-emerald-500"
                disabled={isRunning}
              />
              <div className="flex justify-between text-[9px] text-muted-foreground/60">
                <span>1s</span>
                <span>30s</span>
                <span>60s</span>
              </div>
            </div>
          )}

          {/* Automated mode: Upstream inputs */}
          {mode === "automated" && (
            <div className="space-y-2">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Listening to</p>
              {upstreamNodes.length > 0 ? (
                <div className="space-y-1.5">
                  {upstreamNodes.map((upstream) => {
                    const status = upstream.llmStatus || upstream.socialGenStatus || "idle";
                    return (
                      <div
                        key={upstream.id}
                        className="flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-muted/30 border text-xs"
                      >
                        <ArrowDownToLine className="w-3 h-3 text-emerald-500 shrink-0" />
                        <span className="truncate flex-1 font-medium">{upstream.label}</span>
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[9px] px-1.5",
                            status === "done" && "border-emerald-500/50 text-emerald-600",
                            status === "running" && "border-amber-500/50 text-amber-600",
                            status === "error" && "border-red-500/50 text-red-600",
                          )}
                        >
                          {status}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-[11px] text-muted-foreground/50 px-2 py-3 text-center border border-dashed rounded-md">
                  Connect an upstream node to listen for its completion
                </div>
              )}
            </div>
          )}

          {/* Start/Stop / Fire */}
          {mode === "manual" ? (
            <Button
              size="sm"
              className="w-full gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={() => onPlayNode?.(node.id)}
            >
              <Zap className="w-3.5 h-3.5" />
              Fire Chain
            </Button>
          ) : (
            <Button
              size="sm"
              className={`w-full gap-1.5 ${isRunning ? "" : "bg-emerald-600 hover:bg-emerald-700 text-white"}`}
              variant={isRunning ? "destructive" : "default"}
              onClick={handleToggle}
            >
              {isRunning ? (
                <>
                  <Square className="w-3.5 h-3.5" />
                  {mode === "timed" ? "Stop Timer" : "Stop Listening"}
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5" />
                  {mode === "timed" ? "Start Timer" : "Start Listening"}
                </>
              )}
            </Button>
          )}

          {/* Clear log */}
          {pulseCount > 0 && !isRunning && (
            <Button
              size="sm"
              variant="outline"
              className="w-full text-xs"
              onClick={handleClearLog}
            >
              Clear Log
            </Button>
          )}
        </div>
      </div>

      {/* Right: Event log */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="px-4 py-2 border-b bg-muted/20 flex items-center gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {mode === "timed" ? "Pulse Log" : "Fire Log"}
          </h3>
          <Badge variant="outline" className="text-[10px]">
            {pulseCount} {mode === "timed" ? "pulses" : "fires"}
          </Badge>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-4 font-mono text-xs space-y-0.5">
            {pulseLog ? (
              pulseLog.split("\n").filter(Boolean).map((line, i) => (
                <div key={i} className="flex items-center gap-2 py-0.5">
                  <Zap className="w-3 h-3 text-emerald-500 shrink-0" />
                  <span className="text-muted-foreground">{line}</span>
                </div>
              ))
            ) : (
              <div className="flex-1 flex items-center justify-center py-20">
                <div className="text-center space-y-2">
                  {mode === "manual" ? (
                    <Hand className="w-10 h-10 text-muted-foreground/30 mx-auto" />
                  ) : mode === "timed" ? (
                    <Timer className="w-10 h-10 text-muted-foreground/30 mx-auto" />
                  ) : (
                    <Radio className="w-10 h-10 text-muted-foreground/30 mx-auto" />
                  )}
                  <p className="text-sm text-muted-foreground/50 font-sans">
                    {mode === "manual" ? "No fires yet" : mode === "timed" ? "No pulses yet" : "No fires yet"}
                  </p>
                  <p className="text-[11px] text-muted-foreground/40 font-sans">
                    {mode === "manual"
                      ? "Click 'Fire Chain' to manually trigger the chain"
                      : mode === "timed"
                        ? "Start the timer to begin sending pulses"
                        : "Start listening to fire when upstream nodes complete"}
                  </p>
                </div>
              </div>
            )}
            <div ref={logEndRef} />
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
