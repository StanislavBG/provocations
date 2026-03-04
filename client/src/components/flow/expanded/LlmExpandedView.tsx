/**
 * LlmExpandedView — Full expanded view for LLM (Text Mods) nodes.
 *
 * Provides: full-width preset selector, larger objective editor,
 * input preview panel, output panel with copy.
 */

import { useState, useCallback, useMemo } from "react";
import { Play, Loader2, Check, AlertCircle, Copy, Brain } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ProvokeText } from "@/components/ProvokeText";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { FlowNode, FlowEdge } from "../useFlowCanvas";
import { LLM_PRESETS, getPreset } from "../llm-presets";

interface LlmExpandedViewProps {
  node: FlowNode;
  nodes: FlowNode[];
  edges: FlowEdge[];
  onUpdateNode: (nodeId: string, patch: Partial<FlowNode>) => void;
}

export function LlmExpandedView({ node, nodes, edges, onUpdateNode }: LlmExpandedViewProps) {
  const { toast } = useToast();
  const [isRunning, setIsRunning] = useState(false);
  const preset = getPreset(node.llmPresetId);

  // Gather input content
  const inputContent = useMemo(() => {
    const inputEdges = edges.filter((e) => e.toNodeId === node.id);
    const inputNodes = inputEdges
      .map((e) => nodes.find((n) => n.id === e.fromNodeId))
      .filter(Boolean) as FlowNode[];
    return inputNodes
      .map((n) => n.documentContent || n.content || n.snippet || "")
      .filter((s) => s.trim())
      .join("\n\n---\n\n");
  }, [node.id, nodes, edges]);

  const handleRun = useCallback(async () => {
    if (!inputContent.trim()) {
      toast({ title: "No inputs", description: "Connect input nodes first", variant: "destructive" });
      return;
    }

    setIsRunning(true);
    onUpdateNode(node.id, { llmStatus: "running" });

    try {
      const objective = node.llmObjective || preset.defaultObjective;
      const res = await apiRequest("POST", preset.endpoint, preset.buildRequest(inputContent, objective));
      const data = await res.json();
      const output = preset.extractOutput(data as Record<string, unknown>);

      onUpdateNode(node.id, {
        llmStatus: "done",
        llmOutput: output,
        snippet: output.slice(0, 200),
      });
      toast({ title: "Complete" });
    } catch {
      onUpdateNode(node.id, { llmStatus: "error", llmError: "Execution failed" });
      toast({ title: "Failed", variant: "destructive" });
    } finally {
      setIsRunning(false);
    }
  }, [node.id, node.llmObjective, inputContent, preset, onUpdateNode, toast]);

  const status = node.llmStatus ?? "idle";

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left: Config panel */}
      <div className="w-80 border-r flex flex-col shrink-0 bg-card/50">
        <ScrollArea className="flex-1">
          <div className="p-4 space-y-4">
            {/* Preset selector */}
            <div className="space-y-1.5">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Preset</p>
              <div className="grid grid-cols-2 gap-1.5">
                {LLM_PRESETS.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => onUpdateNode(node.id, { llmPresetId: p.id })}
                    className={`px-2.5 py-2 rounded-md border text-xs font-medium text-left transition-colors ${
                      node.llmPresetId === p.id
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border/50 text-muted-foreground hover:bg-muted/50"
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Objective */}
            <div className="space-y-1.5">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Instruction</p>
              <textarea
                value={node.llmObjective || ""}
                onChange={(e) => onUpdateNode(node.id, { llmObjective: e.target.value })}
                placeholder={preset.defaultObjective}
                className="w-full bg-muted/30 border rounded-lg text-sm text-foreground placeholder:text-muted-foreground/50 resize-none outline-none px-3 py-2 min-h-[100px] leading-relaxed focus:ring-1 focus:ring-primary/50"
                rows={4}
              />
            </div>

            {/* Input count */}
            <div className="space-y-1.5">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Connected Inputs</p>
              <p className="text-xs text-muted-foreground">
                {inputContent ? `${inputContent.length.toLocaleString()} chars from connected nodes` : "No inputs connected"}
              </p>
            </div>

            {/* Run button */}
            <Button
              size="sm"
              className="w-full gap-1.5"
              onClick={handleRun}
              disabled={isRunning || !inputContent.trim()}
            >
              {isRunning ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : status === "done" ? (
                <Check className="w-3.5 h-3.5" />
              ) : status === "error" ? (
                <AlertCircle className="w-3.5 h-3.5" />
              ) : (
                <Play className="w-3.5 h-3.5" />
              )}
              {isRunning ? "Running..." : status === "done" ? "Run Again" : "Run"}
            </Button>
          </div>
        </ScrollArea>
      </div>

      {/* Right: Input + Output panels */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex-1 flex overflow-hidden">
          {/* Input preview */}
          <div className="flex-1 border-r flex flex-col min-w-0">
            <div className="px-4 py-2 border-b bg-muted/20">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Input</h3>
            </div>
            <ScrollArea className="flex-1">
              <div className="p-4">
                <pre className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed">
                  {inputContent || "No inputs connected"}
                </pre>
              </div>
            </ScrollArea>
          </div>

          {/* Output */}
          <div className="flex-1 flex flex-col min-w-0">
            <div className="px-4 py-2 border-b bg-muted/20 flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Output</h3>
              {node.llmOutput && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-[10px] gap-1"
                  onClick={() => {
                    navigator.clipboard.writeText(node.llmOutput || "");
                    toast({ title: "Copied" });
                  }}
                >
                  <Copy className="w-3 h-3" />
                  Copy
                </Button>
              )}
            </div>
            <ScrollArea className="flex-1">
              <div className="p-4">
                {node.llmOutput ? (
                  <ProvokeText
                    value={node.llmOutput}
                    onChange={() => {}}
                    readOnly
                    chrome="bare"
                    variant="textarea"
                    showCopy
                    showClear={false}
                  />
                ) : (
                  <p className="text-xs text-muted-foreground/60 italic">
                    {status === "error" ? (node.llmError || "Execution failed") : "Run to see output"}
                  </p>
                )}
              </div>
            </ScrollArea>
          </div>
        </div>
      </div>
    </div>
  );
}
