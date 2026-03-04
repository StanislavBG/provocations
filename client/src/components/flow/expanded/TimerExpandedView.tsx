/**
 * TimerExpandedView — Full expanded view for Timer Event nodes.
 *
 * Provides: interval config slider, pulse log with timestamps,
 * start/stop controls.
 */

import { useState, useCallback, useEffect, useRef } from "react";
import { Play, Square, Timer, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { FlowNode } from "../useFlowCanvas";

interface TimerExpandedViewProps {
  node: FlowNode;
  onUpdateNode: (nodeId: string, patch: Partial<FlowNode>) => void;
  onPlayNode?: (nodeId: string) => void;
}

export function TimerExpandedView({ node, onUpdateNode, onPlayNode }: TimerExpandedViewProps) {
  const isRunning = node.timerRunning || false;
  const interval = node.timerInterval || 5000;
  const pulseCount = node.timerPulseCount || 0;
  const pulseLog = node.content || "";
  const logEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll pulse log
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [pulseCount]);

  const handleIntervalChange = useCallback((value: number) => {
    onUpdateNode(node.id, { timerInterval: value });
  }, [node.id, onUpdateNode]);

  const handleToggle = useCallback(() => {
    onUpdateNode(node.id, { timerRunning: !isRunning });
  }, [node.id, isRunning, onUpdateNode]);

  const handleClearLog = useCallback(() => {
    onUpdateNode(node.id, {
      content: "",
      timerPulseCount: 0,
      snippet: "Timer ready",
    });
  }, [node.id, onUpdateNode]);

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left: Controls */}
      <div className="w-72 border-r flex flex-col shrink-0 bg-card/50">
        <div className="p-4 space-y-4">
          {/* Timer visual */}
          <div className="flex flex-col items-center gap-3 py-4">
            <div className={`relative w-20 h-20 rounded-full border-4 flex items-center justify-center ${
              isRunning ? "border-emerald-500 bg-emerald-500/10" : "border-border bg-muted/30"
            }`}>
              {isRunning && (
                <div className="absolute inset-0 rounded-full border-4 border-emerald-500/30 animate-ping" />
              )}
              <Timer className={`w-8 h-8 ${isRunning ? "text-emerald-500" : "text-muted-foreground"}`} />
            </div>
            <Badge className={`text-xs ${isRunning ? "bg-emerald-500/20 text-emerald-600" : "bg-muted text-muted-foreground"}`}>
              {isRunning ? `Pulse #${pulseCount}` : pulseCount > 0 ? `${pulseCount} pulses sent` : "Ready"}
            </Badge>
          </div>

          {/* Interval slider */}
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

          {/* Start/Stop */}
          <Button
            size="sm"
            className={`w-full gap-1.5 ${isRunning ? "" : "bg-emerald-600 hover:bg-emerald-700 text-white"}`}
            variant={isRunning ? "destructive" : "default"}
            onClick={handleToggle}
          >
            {isRunning ? (
              <>
                <Square className="w-3.5 h-3.5" />
                Stop Timer
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5" />
                Start Timer
              </>
            )}
          </Button>

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

      {/* Right: Pulse log */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="px-4 py-2 border-b bg-muted/20 flex items-center gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Pulse Log</h3>
          <Badge variant="outline" className="text-[10px]">{pulseCount} pulses</Badge>
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
                  <Timer className="w-10 h-10 text-muted-foreground/30 mx-auto" />
                  <p className="text-sm text-muted-foreground/50 font-sans">No pulses yet</p>
                  <p className="text-[11px] text-muted-foreground/40 font-sans">Start the timer to begin sending pulses</p>
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
