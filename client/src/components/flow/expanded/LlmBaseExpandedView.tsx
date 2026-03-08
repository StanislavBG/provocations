/**
 * LlmBaseExpandedView — Full expanded view for LLM Base nodes.
 *
 * Provides: model selector, temperature/topP/topK/maxTokens sliders,
 * safety level, search grounding, streaming toggle, system instruction
 * preview (from connected docs), editable system + user prompts, run button,
 * and streaming output display.
 */

import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import {
  Play, Loader2, Square, Copy, BrainCircuit, Search, Shield,
  Thermometer, SlidersHorizontal, Zap, ChevronDown, ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { ProvokeText } from "@/components/ProvokeText";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import type { FlowNode, FlowEdge } from "../useFlowCanvas";
import { edgeHasRole } from "../useFlowCanvas";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { ExpandedViewLayout } from "./ExpandedViewLayout";

interface LlmBaseExpandedViewProps {
  node: FlowNode;
  nodes: FlowNode[];
  edges: FlowEdge[];
  onUpdateNode: (nodeId: string, patch: Partial<FlowNode>) => void;
}

interface ChatModelDef {
  id: string;
  label: string;
  provider: string;
  tier: string;
}

export function LlmBaseExpandedView({ node, nodes, edges, onUpdateNode }: LlmBaseExpandedViewProps) {
  const { toast } = useToast();
  const [isRunning, setIsRunning] = useState(false);
  const [streamingOutput, setStreamingOutput] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  // Fetch available models
  const { data: models } = useQuery<ChatModelDef[]>({
    queryKey: ["/api/chat/models"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/chat/models");
      const data = await res.json();
      // Endpoint returns { models: [...], defaultModel: "..." }
      return Array.isArray(data) ? data : (data.models ?? []);
    },
    staleTime: 60_000,
  });

  // Current config values
  const model = node.llmBaseModel || "gemini-2.5-flash";
  const temperature = node.llmBaseTemperature ?? 1.0;
  const topP = node.llmBaseTopP ?? 1.0;
  const topK = node.llmBaseTopK ?? 0;
  const maxTokens = node.llmBaseMaxTokens ?? 8192;
  const safety = node.llmBaseSafety ?? "none";
  const enableSearch = node.llmBaseEnableSearch ?? false;
  const streaming = node.llmBaseStreaming ?? true;
  const systemPrompt = node.llmBaseSystemPrompt ?? "";
  const userPrompt = node.llmBaseUserPrompt ?? "";

  // Gather context from all non-user-prompt edges (background material → system prompt)
  const contextInputs = useMemo(() => {
    const parts: { label: string; content: string }[] = [];
    for (const edge of edges) {
      if (edge.toNodeId !== node.id) continue;
      if (edgeHasRole(edge, "user-prompt")) continue;
      const src = nodes.find((n) => n.id === edge.fromNodeId);
      if (!src) continue;
      const text = src.documentContent || src.content || src.snippet || "";
      if (text.trim()) {
        parts.push({ label: src.label || "Input", content: text.trim() });
      }
    }
    return parts;
  }, [node.id, nodes, edges]);

  // Gather user-prompt from user-prompt edges (the task/message)
  const userPromptInputs = useMemo(() => {
    const parts: { label: string; content: string }[] = [];
    for (const edge of edges) {
      if (edge.toNodeId !== node.id) continue;
      if (!edgeHasRole(edge, "user-prompt")) continue;
      const src = nodes.find((n) => n.id === edge.fromNodeId);
      if (!src) continue;
      const text = src.documentContent || src.content || src.snippet || "";
      if (text.trim()) {
        parts.push({ label: src.label || "Prompt", content: text.trim() });
      }
    }
    return parts;
  }, [node.id, nodes, edges]);

  const patch = useCallback(
    (updates: Partial<FlowNode>) => onUpdateNode(node.id, updates),
    [node.id, onUpdateNode],
  );

  const handleRun = useCallback(async () => {
    // Build system prompt: context connections + manual system prompt
    const systemParts = [
      ...contextInputs.map((c) => c.content),
      ...(systemPrompt.trim() ? [systemPrompt.trim()] : []),
    ];
    const system = systemParts.join("\n\n---\n\n") || "You are a helpful assistant.";

    // Build user message: user-prompt connections + manual user prompt
    const userParts = [
      ...userPromptInputs.map((u) => u.content),
      ...(userPrompt.trim() ? [userPrompt.trim()] : []),
    ];
    const userMessage = userParts.join("\n\n") || "Hello";

    setIsRunning(true);
    setStreamingOutput("");
    patch({ llmBaseStatus: "running", llmBaseError: undefined });

    const body = {
      model, system, userMessage,
      temperature, topP, topK, maxTokens,
      safetyLevel: safety,
      enableSearch,
    };

    try {
      if (streaming) {
        // SSE streaming
        const ctrl = new AbortController();
        abortRef.current = ctrl;

        const res = await fetch("/api/llm-base/stream", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: ctrl.signal,
        });

        if (!res.ok) {
          const err = await res.text();
          throw new Error(err);
        }

        const reader = res.body?.getReader();
        if (!reader) throw new Error("No response body");

        const decoder = new TextDecoder();
        let buffer = "";
        let accumulated = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data: ")) continue;
            const payload = trimmed.slice(6);
            if (payload === "[DONE]") break;
            try {
              const chunk = JSON.parse(payload);
              if (chunk.text) {
                accumulated += chunk.text;
                setStreamingOutput(accumulated);
              }
              if (chunk.error) throw new Error(chunk.error);
            } catch (e) {
              if (e instanceof SyntaxError) continue;
              throw e;
            }
          }
        }

        patch({
          llmBaseOutput: accumulated,
          llmBaseStatus: "done",
          snippet: accumulated.slice(0, 200),
          content: accumulated,
        });
        toast({ title: "Complete" });
      } else {
        // Non-streaming
        const res = await apiRequest("POST", "/api/llm-base/generate", body);
        const data = (await res.json()) as { output: string };
        const output = data.output || "";

        patch({
          llmBaseOutput: output,
          llmBaseStatus: "done",
          snippet: output.slice(0, 200),
          content: output,
        });
        toast({ title: "Complete" });
      }
    } catch (err: any) {
      if (err?.name === "AbortError") {
        patch({ llmBaseStatus: "idle" });
        toast({ title: "Cancelled" });
      } else {
        const msg = err?.message || "LLM call failed";
        patch({ llmBaseStatus: "error", llmBaseError: msg });
        toast({ title: "Error", description: msg, variant: "destructive" });
      }
    } finally {
      setIsRunning(false);
      abortRef.current = null;
    }
  }, [model, systemPrompt, contextInputs, userPromptInputs, userPrompt, temperature, topP, topK, maxTokens, safety, enableSearch, streaming, patch, toast]);

  const handleStop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const handleCopy = useCallback(() => {
    const text = streamingOutput || node.llmBaseOutput || "";
    if (text) {
      navigator.clipboard.writeText(text);
      toast({ title: "Copied" });
    }
  }, [streamingOutput, node.llmBaseOutput, toast]);

  const displayOutput = isRunning ? streamingOutput : (node.llmBaseOutput || "");

  // Auto-scroll output
  const outputRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (isRunning && outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [streamingOutput, isRunning]);

  return (
    <ExpandedViewLayout
      defaultLeftSize={25}
      left={
        <div className="flex flex-col overflow-y-auto h-full">
        <div className="p-4 space-y-5">
          <div className="flex items-center gap-2 mb-1">
            <BrainCircuit className="w-4 h-4 text-fuchsia-500" />
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Configuration
            </span>
          </div>

          {/* Model */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Model</label>
            <Select value={model} onValueChange={(v) => patch({ llmBaseModel: v })}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(models || []).map((m) => (
                  <SelectItem key={m.id} value={m.id} className="text-xs">
                    <span className="flex items-center gap-2">
                      {m.label}
                      <Badge variant="outline" className="text-[9px] px-1 py-0">
                        {m.provider}
                      </Badge>
                    </span>
                  </SelectItem>
                ))}
                {/* Fallback if models not loaded */}
                {(!models || models.length === 0) && (
                  <SelectItem value="gemini-2.5-flash" className="text-xs">
                    Gemini 2.5 Flash
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Temperature */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <Thermometer className="w-3 h-3" /> Temperature
              </label>
              <span className="text-[10px] tabular-nums text-muted-foreground">{temperature.toFixed(2)}</span>
            </div>
            <Slider
              value={[temperature]}
              min={0}
              max={2}
              step={0.05}
              onValueChange={([v]) => patch({ llmBaseTemperature: v })}
              className="w-full"
            />
            <div className="flex justify-between text-[9px] text-muted-foreground/50">
              <span>Deterministic</span>
              <span>Creative</span>
            </div>
          </div>

          {/* Top P */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-muted-foreground">Top P</label>
              <span className="text-[10px] tabular-nums text-muted-foreground">{topP.toFixed(2)}</span>
            </div>
            <Slider
              value={[topP]}
              min={0}
              max={1}
              step={0.05}
              onValueChange={([v]) => patch({ llmBaseTopP: v })}
              className="w-full"
            />
          </div>

          {/* Top K */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-muted-foreground">Top K</label>
              <span className="text-[10px] tabular-nums text-muted-foreground">{topK === 0 ? "off" : topK}</span>
            </div>
            <Slider
              value={[topK]}
              min={0}
              max={100}
              step={1}
              onValueChange={([v]) => patch({ llmBaseTopK: v })}
              className="w-full"
            />
          </div>

          {/* Max Tokens */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-muted-foreground">Max Tokens</label>
              <span className="text-[10px] tabular-nums text-muted-foreground">{maxTokens.toLocaleString()}</span>
            </div>
            <Slider
              value={[maxTokens]}
              min={256}
              max={65536}
              step={256}
              onValueChange={([v]) => patch({ llmBaseMaxTokens: v })}
              className="w-full"
            />
          </div>

          {/* Safety Level */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <Shield className="w-3 h-3" /> Safety
            </label>
            <Select value={safety} onValueChange={(v) => patch({ llmBaseSafety: v as any })}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none" className="text-xs">None (unrestricted)</SelectItem>
                <SelectItem value="low" className="text-xs">Low</SelectItem>
                <SelectItem value="medium" className="text-xs">Medium</SelectItem>
                <SelectItem value="high" className="text-xs">High</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Toggles */}
          <div className="space-y-3 pt-1">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <Search className="w-3 h-3" /> Search Grounding
              </label>
              <Switch
                checked={enableSearch}
                onCheckedChange={(v) => patch({ llmBaseEnableSearch: v })}
              />
            </div>
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <Zap className="w-3 h-3" /> Streaming
              </label>
              <Switch
                checked={streaming}
                onCheckedChange={(v) => patch({ llmBaseStreaming: v })}
              />
            </div>
          </div>

          {/* Input summary */}
          <div className="pt-2 border-t space-y-1">
            <p className="text-[10px] text-muted-foreground">
              {contextInputs.length} context input{contextInputs.length !== 1 ? "s" : ""} connected
            </p>
            <p className="text-[10px] text-muted-foreground">
              {userPromptInputs.length} user prompt{userPromptInputs.length !== 1 ? "s" : ""} connected
            </p>
          </div>
        </div>
        </div>
      }
      right={
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <ScrollArea className="flex-1">
          <div className="p-4 space-y-4">

            {/* Context — connections as collapsible tabs, manual appends */}
            <div className="space-y-1.5">
              {contextInputs.length > 0 ? (
                <ConnectedInputTabs inputs={contextInputs} sectionLabel="Context" accent="amber" />
              ) : (
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Context
                </label>
              )}
              <ProvokeText
                value={systemPrompt}
                onChange={(v) => patch({ llmBaseSystemPrompt: v })}
                chrome="container"
                variant="textarea"
                placeholder={contextInputs.length > 0
                  ? "Additional context or instructions (appended after connected content)..."
                  : "Background context, instructions, or persona — injected as system prompt..."}
                showCopy
                showClear
                readOnly={isRunning}
              />
            </div>

            {/* User Prompt — connections as collapsible tabs, manual appends */}
            <div className="space-y-1.5">
              {userPromptInputs.length > 0 ? (
                <ConnectedInputTabs inputs={userPromptInputs} sectionLabel="User Prompt" accent="emerald" />
              ) : (
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  User Prompt
                </label>
              )}
              <ProvokeText
                value={userPrompt}
                onChange={(v) => patch({ llmBaseUserPrompt: v })}
                chrome="container"
                variant="textarea"
                placeholder={userPromptInputs.length > 0
                  ? "Additional instructions (appended after connected content)..."
                  : "Enter your prompt here..."}
                showCopy
                showClear
                readOnly={isRunning}
              />
            </div>

            {/* Run / Stop button */}
            <div className="flex items-center gap-2">
              {isRunning ? (
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={handleStop}
                  className="gap-1.5"
                >
                  <Square className="w-3.5 h-3.5" />
                  Stop
                </Button>
              ) : (
                <Button
                  size="sm"
                  onClick={handleRun}
                  className="gap-1.5 bg-fuchsia-600 hover:bg-fuchsia-700 text-white"
                  disabled={!userPrompt.trim() && contextInputs.length === 0 && userPromptInputs.length === 0}
                >
                  <Play className="w-3.5 h-3.5" />
                  Run
                </Button>
              )}
              <span className="text-[10px] text-muted-foreground">
                {model} · {streaming ? "streaming" : "batch"} · {maxTokens.toLocaleString()} max tokens
              </span>
            </div>

            {/* Output */}
            {(displayOutput || isRunning) && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Output
                  </label>
                  {displayOutput && (
                    <Button variant="ghost" size="sm" onClick={handleCopy} className="h-6 px-2 text-xs gap-1">
                      <Copy className="w-3 h-3" /> Copy
                    </Button>
                  )}
                </div>
                <div
                  ref={outputRef}
                  className={cn(
                    "rounded-md border bg-muted/20 p-3 min-h-[120px] max-h-[400px] overflow-y-auto",
                    isRunning && "border-fuchsia-500/30",
                  )}
                >
                  {isRunning && !streamingOutput && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Generating...
                    </div>
                  )}
                  <div className="text-sm whitespace-pre-wrap break-words">
                    {displayOutput}
                    {isRunning && streamingOutput && (
                      <span className="inline-block w-1.5 h-4 bg-fuchsia-500 animate-pulse ml-0.5 align-middle" />
                    )}
                  </div>
                </div>
                {!isRunning && displayOutput && (
                  <p className="text-[10px] text-muted-foreground">
                    {displayOutput.length.toLocaleString()} characters · ~{Math.ceil(displayOutput.length / 4).toLocaleString()} tokens
                  </p>
                )}
              </div>
            )}

            {/* Error display */}
            {node.llmBaseStatus === "error" && node.llmBaseError && (
              <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3">
                <p className="text-xs text-destructive">{node.llmBaseError}</p>
              </div>
            )}
          </div>
        </ScrollArea>
        </div>
      }
    />
  );
}

// ── Collapsible tabbed connected inputs (reusable for Context + User Prompt) ──

function ConnectedInputTabs({
  inputs,
  sectionLabel,
  accent = "amber",
}: {
  inputs: { label: string; content: string }[];
  sectionLabel: string;
  accent?: "amber" | "emerald";
}) {
  const [expanded, setExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState(0);

  const colors = accent === "emerald"
    ? { border: "border-emerald-500/30", bg: "bg-emerald-500/5", hover: "hover:bg-emerald-500/10", text: "text-emerald-500", borderActive: "border-emerald-500", borderInner: "border-emerald-500/20" }
    : { border: "border-amber-500/30", bg: "bg-amber-500/5", hover: "hover:bg-amber-500/10", text: "text-amber-500", borderActive: "border-amber-500", borderInner: "border-amber-500/20" };

  return (
    <div className={`rounded-md border ${colors.border} ${colors.bg} overflow-hidden`}>
      {/* Header — click to toggle */}
      <button
        className={`w-full flex items-center gap-1.5 px-3 py-1.5 text-left ${colors.hover} transition-colors`}
        onClick={() => setExpanded((v) => !v)}
      >
        {expanded ? (
          <ChevronDown className={`w-3 h-3 ${colors.text} shrink-0`} />
        ) : (
          <ChevronRight className={`w-3 h-3 ${colors.text} shrink-0`} />
        )}
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          {sectionLabel}
        </span>
        <span className={`text-[9px] font-normal ${colors.text}`}>
          ({inputs.length} connected)
        </span>
      </button>

      {/* Tabs + content — only when expanded */}
      {expanded && (
        <div className={`border-t ${colors.borderInner}`}>
          {/* Tab row */}
          <div className={`flex border-b ${colors.borderInner} overflow-x-auto`}>
            {inputs.map((input, i) => (
              <button
                key={i}
                className={`shrink-0 px-3 py-1.5 text-[10px] font-medium transition-colors border-b-2 ${
                  activeTab === i
                    ? `${colors.borderActive} ${colors.text}`
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => setActiveTab(i)}
              >
                {input.label.length > 20 ? input.label.slice(0, 20) + "…" : input.label}
              </button>
            ))}
          </div>
          {/* Active tab content */}
          <div className="p-3 max-h-32 overflow-y-auto">
            <p className="text-xs text-foreground/80 whitespace-pre-wrap">
              {inputs[activeTab]?.content || ""}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
