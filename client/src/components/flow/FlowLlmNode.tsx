import React, { useCallback, useState, useRef } from "react";
import { Brain, Trash2, Lock, Unlock, Monitor, Loader2, Play, Copy, StickyNote, Check, AlertCircle, Mic, MicOff } from "lucide-react";
import { InputModeToggle } from "./InputModeToggle";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { LLM_PRESETS, getPreset, type LlmPreset } from "./llm-presets";
import type { FlowNode, FlowEdge } from "./useFlowCanvas";
import { getEffectiveLockMode } from "./useFlowCanvas";
import { lifecycleLogStore } from "@/lib/lifecycleLog";
import { FlowPortDots } from "./FlowPortDots";

interface FlowLlmNodeProps {
  node: FlowNode;
  edges: FlowEdge[];
  isSelected: boolean;
  allNodes: FlowNode[];
  selectedNodeIds: Set<string>;
  onMouseDown: (e: React.MouseEvent, nodeId: string) => void;
  onDelete: (nodeId: string) => void;
  onUpdateNode: (nodeId: string, patch: Partial<FlowNode>) => void;
  onToggleLock?: (nodeId: string) => void;
  onCreateNote: (content: string, label: string, sourceNodeId?: string) => void;
  onPortMouseDown?: (e: React.MouseEvent, nodeId: string, portType: "input" | "output") => void;
  onDoubleClick?: (e: React.MouseEvent, nodeId: string) => void;
}

const PRESET_COLORS: Record<string, { chip: string; active: string }> = {
  purple: { chip: "border-purple-400/30 text-purple-500", active: "bg-purple-500/20 border-purple-500 text-purple-600 dark:text-purple-400" },
  cyan: { chip: "border-cyan-400/30 text-cyan-500", active: "bg-cyan-500/20 border-cyan-500 text-cyan-600 dark:text-cyan-400" },
  emerald: { chip: "border-emerald-400/30 text-emerald-500", active: "bg-emerald-500/20 border-emerald-500 text-emerald-600 dark:text-emerald-400" },
  rose: { chip: "border-rose-400/30 text-rose-500", active: "bg-rose-500/20 border-rose-500 text-rose-600 dark:text-rose-400" },
};

export const FlowLlmNode = React.memo(function FlowLlmNode({
  node,
  edges,
  isSelected,
  allNodes,
  selectedNodeIds,
  onMouseDown,
  onDelete,
  onUpdateNode,
  onToggleLock,
  onCreateNote,
  onPortMouseDown,
  onDoubleClick,
}: FlowLlmNodeProps) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = useRef<any>(null);

  const currentPreset = getPreset(node.llmPresetId);
  const status = node.llmStatus ?? "idle";

  // ── Determine input nodes (from connected edges) ──
  const inputNodes = React.useMemo(() => {
    const incomingIds = new Set(
      edges.filter((e) => e.toNodeId === node.id).map((e) => e.fromNodeId),
    );
    if (incomingIds.size > 0) {
      return allNodes.filter((n) => incomingIds.has(n.id));
    }
    // Fallback: if nothing connected, use multi-selected nodes
    const otherSelected = allNodes.filter(
      (n) => selectedNodeIds.has(n.id) && n.id !== node.id && n.type !== "store" && n.type !== "llm",
    );
    return otherSelected;
  }, [allNodes, edges, selectedNodeIds, node.id]);

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

  // ── Voice input ──
  const toggleVoice = useCallback(() => {
    if (isRecording && recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
      setIsRecording(false);
      return;
    }
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      toast({ title: "Voice not supported", description: "Your browser doesn't support speech recognition" });
      return;
    }
    const recognition = new SR();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = "en-US";
    recognitionRef.current = recognition;
    setIsRecording(true);

    recognition.onresult = (event: any) => {
      let transcript = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          transcript += event.results[i][0].transcript;
        }
      }
      if (transcript.trim()) {
        const current = node.llmObjective || "";
        onUpdateNode(node.id, { llmObjective: current + (current ? " " : "") + transcript.trim() });
      }
    };
    recognition.onerror = () => {
      setIsRecording(false);
      recognitionRef.current = null;
    };
    recognition.onend = () => {
      setIsRecording(false);
      recognitionRef.current = null;
    };
    recognition.start();
  }, [isRecording, node.id, node.llmObjective, onUpdateNode, toast]);

  // ── Custom objective edit ──
  const handleObjectiveChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      onUpdateNode(node.id, { llmObjective: e.target.value });
    },
    [node.id, onUpdateNode],
  );

  // ── Lifecycle logging helper ──
  const lcLog = useCallback(
    (phase: "pre-process" | "process" | "post-process", status: "start" | "success" | "error" | "skipped", message: string, extra?: { durationMs?: number; error?: string }) => {
      lifecycleLogStore.push({
        phase,
        status,
        nodeId: node.id,
        nodeType: node.type,
        nodeLabel: node.label || "Text Mods",
        message,
        ...extra,
      });
    },
    [node.id, node.type, node.label],
  );

  // ── Run ──
  const handleRun = useCallback(async () => {
    const t0 = performance.now();
    lcLog("pre-process", "start", "Validating inputs");

    if (inputNodes.length === 0) {
      lcLog("pre-process", "error", "No inputs connected", { error: "No inputs" });
      toast({ title: "No inputs", description: "Add some notes or documents first" });
      return;
    }
    if (currentPreset.id === "custom" && !node.llmObjective?.trim()) {
      lcLog("pre-process", "error", "No objective for custom preset", { error: "No objective" });
      toast({ title: "No objective", description: "Type an objective for the custom LLM node" });
      return;
    }

    lcLog("pre-process", "success", `${inputNodes.length} input(s), preset: ${currentPreset.label}`);

    onUpdateNode(node.id, { llmStatus: "running", llmError: undefined });
    lcLog("process", "start", `Running ${currentPreset.label}`);

    try {
      const combined = inputNodes
        .map((n) => `## ${n.label}\n${n.content || n.snippet || ""}`)
        .join("\n\n---\n\n");

      const body = currentPreset.buildRequest(combined, node.llmObjective || "");
      const res = await apiRequest("POST", currentPreset.endpoint, body);
      const data = await res.json();
      const output = currentPreset.extractOutput(data as Record<string, unknown>);
      const elapsed = Math.round(performance.now() - t0);

      lcLog("process", "success", `${output.length} chars output`, { durationMs: elapsed });

      // Mark LLM node as done (keep output for display but primary result goes to new document node)
      onUpdateNode(node.id, {
        llmStatus: "done",
        llmOutput: output,
        label: `${currentPreset.label} (${inputNodes.length} sources)`,
      });

      // Create output document node downstream (positioned by FlowWorkspace)
      onCreateNote(output, `${currentPreset.label} output`, node.id);

      lcLog("post-process", "success", "Output document node created");
      toast({ title: `${currentPreset.label} complete`, description: `Output created as document node` });
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "LLM call failed";
      lcLog("process", "error", errMsg, { error: errMsg, durationMs: Math.round(performance.now() - t0) });
      onUpdateNode(node.id, {
        llmStatus: "error",
        llmError: "LLM call failed",
      });
      toast({ title: `${currentPreset.label} failed`, variant: "destructive" });
    }
  }, [inputNodes, currentPreset, node.id, node.llmObjective, onUpdateNode, toast, lcLog]);

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
    onCreateNote(node.llmOutput, `${currentPreset.label} output`, node.id);
    toast({ title: "Note created", description: "Output saved as document node" });
  }, [node.id, node.llmOutput, currentPreset.label, onCreateNote, toast]);

  const presetColors = PRESET_COLORS[currentPreset.color] ?? PRESET_COLORS.purple;

  return (
    <div
      className={cn(
        "absolute select-none rounded-lg border-2 shadow-md transition-shadow group flex flex-col",
        "bg-card border-violet-500/60 hover:shadow-lg",
        isSelected && "ring-2 ring-primary shadow-lg",
      )}
      style={{
        left: node.x,
        top: node.y,
        width: node.width,
        height: node.height,
        zIndex: node.zIndex,
      }}
      onDoubleClick={onDoubleClick ? (e) => onDoubleClick(e, node.id) : undefined}
    >
      {/* Draggable header */}
      <div
        className="flex items-center gap-1.5 px-2 py-1 border-b bg-violet-500/15 border-violet-500/40 rounded-t-lg cursor-grab shrink-0"
        onMouseDown={(e) => onMouseDown(e, node.id)}
      >
        <Brain className="w-3 h-3 text-violet-500 shrink-0" />
        <span className="text-[10px] font-medium truncate flex-1">{node.label || "Text Modifications"}</span>
        <InputModeToggle node={node} onUpdateNode={onUpdateNode} />
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
        onDoubleClick={(e) => e.stopPropagation()}
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
          <div className="flex items-center justify-between">
            <label className="text-[8px] uppercase tracking-wider text-muted-foreground font-semibold">Objective</label>
            <button
              className={cn(
                "w-4 h-4 rounded-full flex items-center justify-center transition-colors",
                isRecording
                  ? "bg-red-500 text-white animate-pulse"
                  : "text-muted-foreground/50 hover:text-muted-foreground",
              )}
              onClick={toggleVoice}
              title={isRecording ? "Stop recording" : "Voice input"}
            >
              {isRecording ? <MicOff className="w-2.5 h-2.5" /> : <Mic className="w-2.5 h-2.5" />}
            </button>
          </div>
          {currentPreset.id === "custom" ? (
            <textarea
              className="w-full mt-0.5 text-[9px] bg-transparent border border-border/50 rounded px-1 py-0.5 resize-none leading-relaxed focus:outline-none focus:ring-1 focus:ring-violet-500/50"
              rows={2}
              placeholder="Describe what the LLM should do (or use voice)..."
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
                onClick={(e) => { e.stopPropagation(); onDelete(node.id); }}
                title="Delete node"
              >
                <Trash2 className="w-2.5 h-2.5" />
              </button>
            )}
          </div>
        );
      })()}
    </div>
  );
});
