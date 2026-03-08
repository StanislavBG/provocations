/**
 * ChainProgressBar — Shows chain execution progress during active runs.
 *
 * Displays: "Processing node 3/8 — Research"
 * Progress bar with percentage.
 * Cancel button to abort the chain (I6).
 * Appears fixed at the bottom of the canvas area.
 */

import { X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import type { ChainProgress } from "./useChainExecutor";
import { useFtuxShell } from "@/lib/ftux-shell-context";

interface ChainProgressBarProps {
  progress: ChainProgress;
  onCancel: () => void;
}

export function ChainProgressBar({ progress, onCancel }: ChainProgressBarProps) {
  const { statusBarPosition } = useFtuxShell();

  if (!progress.isRunning) return null;

  const percentage =
    progress.totalNodes > 0
      ? Math.round((progress.completedNodes / progress.totalNodes) * 100)
      : 0;

  const elapsed = Math.round((Date.now() - progress.startTime) / 1000);

  return (
    <div
      className={cn(
        "fixed left-0 right-0 z-[47] px-4 py-2",
        "bg-card/95 backdrop-blur-sm border-border/50",
        statusBarPosition === "bottom" ? "border-t" : "border-b",
      )}
      style={{
        bottom: statusBarPosition === "bottom" ? "var(--ftux-status-bar-height, 44px)" : undefined,
        top: statusBarPosition === "top" ? "var(--ftux-status-bar-height, 44px)" : undefined,
      }}
    >
      <div className="flex items-center gap-3">
        {/* Spinner */}
        <Loader2 className="w-4 h-4 text-primary animate-spin shrink-0" />

        {/* Status text */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-medium text-foreground truncate">
              Processing node {progress.completedNodes + 1}/{progress.totalNodes}
              {progress.currentNodeLabel ? ` \u2014 ${progress.currentNodeLabel}` : ""}
            </span>
            <span className="text-[10px] text-muted-foreground shrink-0">
              {percentage}% &middot; {elapsed}s
            </span>
          </div>

          {/* Progress bar */}
          <Progress value={percentage} className="h-1.5" />
        </div>

        {/* Cancel button (I6) */}
        <button
          className={cn(
            "flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium",
            "bg-destructive/10 text-destructive hover:bg-destructive/20",
            "border border-destructive/20 transition-colors shrink-0",
          )}
          onClick={onCancel}
          title="Cancel chain execution"
        >
          <X className="w-3 h-3" />
          Cancel
        </button>
      </div>
    </div>
  );
}
