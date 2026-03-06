/**
 * InputModeToggle — Shared compact toggle for node multi-input mode.
 *
 * "All" = wait for every upstream input to complete before running.
 * "Each" = fire independently for each input as it arrives.
 *
 * Designed to fit inside node header bars alongside other small toggles.
 */

import React from "react";
import { Layers, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FlowNode } from "./useFlowCanvas";

interface InputModeToggleProps {
  node: FlowNode;
  onUpdateNode: (nodeId: string, patch: Partial<FlowNode>) => void;
}

export const InputModeToggle = React.memo(function InputModeToggle({
  node,
  onUpdateNode,
}: InputModeToggleProps) {
  const mode = node.inputMode ?? "wait-all";

  return (
    <div className="flex items-center gap-0.5" onMouseDown={(e) => e.stopPropagation()}>
      <button
        className={cn(
          "text-[7px] px-1 py-0.5 rounded transition-colors flex items-center gap-0.5",
          mode === "wait-all"
            ? "bg-blue-500/30 text-blue-300 font-semibold"
            : "bg-muted/30 text-muted-foreground/50 hover:bg-muted/50",
        )}
        onClick={(e) => { e.stopPropagation(); onUpdateNode(node.id, { inputMode: "wait-all" }); }}
        title="Wait for all inputs to complete before running"
      >
        <Layers className="w-2 h-2" />
        All
      </button>
      <button
        className={cn(
          "text-[7px] px-1 py-0.5 rounded transition-colors flex items-center gap-0.5",
          mode === "fire-each"
            ? "bg-blue-500/30 text-blue-300 font-semibold"
            : "bg-muted/30 text-muted-foreground/50 hover:bg-muted/50",
        )}
        onClick={(e) => { e.stopPropagation(); onUpdateNode(node.id, { inputMode: "fire-each" }); }}
        title="Run independently for each input as it arrives"
      >
        <Zap className="w-2 h-2" />
        Each
      </button>
    </div>
  );
});
