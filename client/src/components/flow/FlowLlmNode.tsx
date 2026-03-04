import React, { useCallback, useState } from "react";
import { Brain, X, Loader2, Play, Copy, StickyNote, Check, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { LLM_PRESETS, getPreset, type LlmPreset } from "./llm-presets";
import type { FlowNode } from "./useFlowCanvas";
import { FlowPortDots } from "./FlowPortDots";

interface FlowLlmNodeProps {
  node: FlowNode;
  isSelected: boolean;
  allNodes: FlowNode[];
  selectedNodeIds: Set<string>;
  onMouseDown: (e: React.MouseEvent, nodeId: string) => void;
  onDelete: (nodeId: string) => void;
  onUpdateNode: (nodeId: string, patch: Partial<FlowNode>) => void;
  onCreateNote: (content: string, label: string) => void;
  onPortMouseDown?: (e: React.MouseEvent, nodeId: string, portType: "input" | "output") => void;
}

const PRESET_COLORS: Record<string, { chip: string; active: string }> = {
  purple: { chip: "border-purple-400/30 text-purple-500", active: "bg-purple-500/20 border-purple-500 text-purple-600 dark:text-purple-400" },
  cyan: { chip: "border-cyan-400/30 text-cyan-500", active: "bg-cyan-500/20 border-cyan-500 text-cyan-600 dark:text-cyan-400" },
  emerald: { chip: "border-emerald-400/30 text-emerald-500", active: "bg-emerald-500/20 border-emerald-500 text-emerald-600 dark:text-emerald-400" },
  rose: { chip: "border-rose-400/30 text-rose-500", active: "bg-rose-500/20 border-rose-500 text-rose-600 dark:text-rose-400" },
};

export const FlowLlmNode = React.memo(function FlowLlmNode({
  node,
  isSelected,
  allNodes,
  selectedNodeIds,
  onMouseDown,
  onDelete,
  onUpdateNode,
  onCreateNote,
  onPortMouseDown,
}: FlowLlmNodeProps) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const currentPreset = getPreset(node.llmPresetId);
  const status = node.llmStatus ?? "idle";

  // ── Determine input nodes ──
  const inputNodes = React.useMemo(() => {
    const otherSelected = allNodes.filter(
      (n) => selectedNodeIds.has(n.id) && n.id !== node.id && n.type !== "store" && n.type !== "llm",
    );
    if (otherSelected.length > 0) return otherSelected;
    return allNodes.filter((n) => n.type === "document" || n.type === "context-doc");
  }, [allNodes, selectedNodeIds, node.id]);

  // ── Preset change ──
  const handlePresetChange = useCallback(
    (preset: LlmPreset) => {
      onUpdateNode(node.id, {
        llmPresetId: preset.id,
        llmObjective: preset.defaultObjective,
        llmOutput: undefined,
        llmError: undefined,
        llmStatus: "idle",
      });
    },
    [node.id, onUpdateNode],
  );

  // ── Custom objective edit ──
  const handleObjectiveChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      onUpdateNode(node.id, { llmObjective: e.target.value });
    },
    [node.id, onUpdateNode],
  );

  // ── Run ──
  const handleRun = useCallback(async () => {
    if (inputNodes.length === 0) {
      toast({ title: "No inputs", description: "Add some notes or documents first" });
      return;
    }
    if (currentPreset.id === "custom" && !node.llmObjective?.trim()) {
      toast({ title: "No objective", description: "Type an objective for the custom LLM node" });
      return;
    }

    onUpdateNode(node.id, { llmStatus: "running", llmError: undefined });

    try {
      const combined = inputNodes
        .map((n) => `## ${n.label}\n${n.content || n.snippet || ""}`)
        .join("\n\n---\n\n");

      const body = currentPreset.buildRequest(combined, node.llmObjective || "");
      const res = await apiRequest("POST", currentPreset.endpoint, body);
      const data = await res.json();
      const output = currentPreset.extractOutput(data as Record<string, unknown>);

      onUpdateNode(node.id, {
        llmStatus: "done",
        llmOutput: output,
        content: output,
        snippet: output.slice(0, 200),
        label: `${currentPreset.label} (${inputNodes.length} sources)`,
      });

      toast({ title: `${currentPreset.label} complete`, description: `Processed ${inputNodes.length} inputs` });
    } catch {
      onUpdateNode(node.id, {
        llmStatus: "error",
        llmError: "LLM call failed",
      });
      toast({ title: `${currentPreset.label} failed`, variant: "destructive" });
    }
  }, [inputNodes, currentPreset, node.id, node.llmObjective, onUpdateNode, toast]);

  // ── Copy output ──
  const handleCopy = useCallback(async () => {
    if (!node.llmOutput) return;
    await navigator.clipboard.writeText(node.llmOutput);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [node.llmOutput]);

  // ── Save to note ──
  const handleSaveToNote = useCallback(() => {
    if (!node.llmOutput) return;
    onCreateNote(node.llmOutput, `${currentPreset.label} output`);
    toast({ title: "Note created", description: "Output saved as a note on canvas" });
  }, [node.llmOutput, currentPreset.label, onCreateNote, toast]);

  const presetColors = PRESET_COLORS[currentPreset.color] ?? PRESET_COLORS.purple;

  return (
    <div
      className={cn(
        "absolute select-none rounded-lg border shadow-sm transition-shadow group flex flex-col",
        "bg-card border-violet-500/30 hover:shadow-md",
        isSelected && "ring-2 ring-primary shadow-md",
      )}
      style={{
        left: node.x,
        top: node.y,
        width: node.width,
        height: node.height,
        zIndex: node.zIndex,
      }}
    >
      {/* Draggable header */}
      <div
        className="flex items-center gap-1.5 px-2 py-1 border-b bg-violet-500/10 border-violet-500/20 rounded-t-lg cursor-grab shrink-0"
        onMouseDown={(e) => onMouseDown(e, node.id)}
      >
        <Brain className="w-3 h-3 text-violet-500 shrink-0" />
        <span className="text-[10px] font-medium truncate flex-1">{node.label || "Text Modifications"}</span>
        <span className={cn(
          "text-[8px] font-semibold uppercase tracking-wider px-1 py-0.5 rounded",
          presetColors.active,
        )}>
          {currentPreset.label}
        </span>
      </div>

      {/* Interactive body — stops canvas drag */}
      <div
        className="flex-1 overflow-auto min-h-0 flex flex-col"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Preset chips */}
        <div className="flex items-center gap-0.5 px-2 py-1 border-b border-border/50 flex-wrap">
          {LLM_PRESETS.map((preset) => {
            const colors = PRESET_COLORS[preset.color] ?? PRESET_COLORS.purple;
            const isActive = currentPreset.id === preset.id;
            return (
              <button
                key={preset.id}
                className={cn(
                  "text-[8px] font-medium px-1.5 py-0.5 rounded-full border transition-colors",
                  isActive ? colors.active : colors.chip,
                  !isActive && "hover:bg-muted/50",
                )}
                onClick={() => handlePresetChange(preset)}
                title={preset.description}
              >
                {preset.label}
              </button>
            );
          })}
        </div>

        {/* Objective */}
        <div className="px-2 py-1 border-b border-border/50">
          <label className="text-[8px] uppercase tracking-wider text-muted-foreground font-semibold">Objective</label>
          {currentPreset.id === "custom" ? (
            <textarea
              className="w-full mt-0.5 text-[9px] bg-transparent border border-border/50 rounded px-1 py-0.5 resize-none leading-relaxed focus:outline-none focus:ring-1 focus:ring-violet-500/50"
              rows={2}
              placeholder="Describe what the LLM should do..."
              value={node.llmObjective || ""}
              onChange={handleObjectiveChange}
            />
          ) : (
            <p className="text-[9px] text-muted-foreground leading-relaxed mt-0.5 line-clamp-2">
              {node.llmObjective || currentPreset.defaultObjective}
            </p>
          )}
        </div>

        {/* Input count + Run */}
        <div className="flex items-center justify-between px-2 py-1 border-b border-border/50">
          <span className="text-[8px] text-muted-foreground">
            {inputNodes.length} input{inputNodes.length !== 1 ? "s" : ""}
          </span>
          <div className="flex items-center gap-1.5">
            {status === "done" && <Check className="w-3 h-3 text-emerald-500" />}
            {status === "error" && (
              <span title={node.llmError}>
                <AlertCircle className="w-3 h-3 text-destructive" />
              </span>
            )}
            <button
              className={cn(
                "flex items-center gap-0.5 text-[8px] font-medium px-1.5 py-0.5 rounded",
                "bg-violet-500/20 text-violet-600 dark:text-violet-400 hover:bg-violet-500/30 transition-colors",
                status === "running" && "opacity-60 pointer-events-none",
              )}
              onClick={handleRun}
              disabled={status === "running"}
            >
              {status === "running" ? (
                <Loader2 className="w-2.5 h-2.5 animate-spin" />
              ) : (
                <Play className="w-2.5 h-2.5" />
              )}
              {status === "running" ? "Running..." : "Run"}
            </button>
          </div>
        </div>

        {/* Output */}
        <div className="flex-1 overflow-auto min-h-0 px-2 py-1">
          {node.llmOutput ? (
            <>
              <p className="text-[9px] text-foreground leading-relaxed whitespace-pre-wrap">
                {node.llmOutput}
              </p>
              <div className="flex items-center gap-1 mt-1 pt-0.5 border-t border-border/30">
                <button
                  className="flex items-center gap-0.5 text-[8px] text-muted-foreground hover:text-foreground transition-colors"
                  onClick={handleCopy}
                >
                  {copied ? <Check className="w-2 h-2" /> : <Copy className="w-2 h-2" />}
                  {copied ? "Copied" : "Copy"}
                </button>
                <button
                  className="flex items-center gap-0.5 text-[8px] text-muted-foreground hover:text-foreground transition-colors"
                  onClick={handleSaveToNote}
                >
                  <StickyNote className="w-2 h-2" />
                  Note
                </button>
              </div>
            </>
          ) : status === "idle" ? (
            <p className="text-[8px] text-muted-foreground/60 italic">
              Click Run to process inputs
            </p>
          ) : null}
        </div>
      </div>

      {/* Port dots */}
      <FlowPortDots
        node={node}
        isSelected={isSelected}
        onPortMouseDown={onPortMouseDown}
        accentColor="violet"
      />

      {/* Delete button */}
      <button
        className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          onDelete(node.id);
        }}
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  );
});
