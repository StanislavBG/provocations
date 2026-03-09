/**
 * LlmBaseExpandedView — Full expanded view for LLM Base nodes.
 *
 * Premium chat-like experience: centered conversation surface with
 * collapsible config sidebar. Designed as an unrestricted LLM session.
 */

import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  Play, Loader2, Square, Copy, BrainCircuit, Search, Shield,
  Thermometer, Zap, ChevronDown, ChevronRight,
  PanelLeftClose, Settings2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { ProvokeText } from "@/components/ProvokeText";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import type { FlowNode, FlowEdge } from "../useFlowCanvas";
import { edgeHasRole } from "../useFlowCanvas";
import { PromptEditor, expandContextRefs, getReferencedLabels } from "../PromptEditor";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

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
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(280);
  const abortRef = useRef<AbortController | null>(null);

  // Fetch available models
  const { data: rawModels } = useQuery<ChatModelDef[]>({
    queryKey: ["/api/chat/models"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/chat/models");
      const data = await res.json();
      return Array.isArray(data) ? data : (data.models ?? []);
    },
    staleTime: 60_000,
  });
  // Defensive: ensure models is always an array (cache may hold unexpected shape)
  const models = Array.isArray(rawModels) ? rawModels : [];

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

  // Gather context from all non-user-prompt edges
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

  // Gather user-prompt edges
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
    // Expand @[label] references to actual block content
    const allBlocks = [...contextInputs, ...userPromptInputs];
    const expandedSystem = expandContextRefs(systemPrompt, allBlocks);
    const expandedUser = expandContextRefs(userPrompt, allBlocks);

    // Only auto-inject blocks NOT explicitly referenced via @[label]
    const referencedLabels = new Set([
      ...getReferencedLabels(systemPrompt),
      ...getReferencedLabels(userPrompt),
    ]);
    const unreferencedContext = contextInputs.filter(
      (c) => !referencedLabels.has(c.label.trim().toLowerCase()),
    );
    const unreferencedUserPrompts = userPromptInputs.filter(
      (u) => !referencedLabels.has(u.label.trim().toLowerCase()),
    );

    const systemParts = [
      ...unreferencedContext.map((c) => c.content),
      ...(expandedSystem.trim() ? [expandedSystem.trim()] : []),
    ];
    const system = systemParts.join("\n\n---\n\n") || "You are a helpful assistant.";

    const userParts = [
      ...unreferencedUserPrompts.map((u) => u.content),
      ...(expandedUser.trim() ? [expandedUser.trim()] : []),
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

  // Model label for display
  const modelLabel = models.find((m) => m.id === model)?.label || model;

  return (
  <>
    <div className="flex-1 flex overflow-hidden">
      {/* ── Collapsible resizable config sidebar ── */}
      {sidebarOpen && (
        <div
          className="border-r border-border/30 bg-card/30 flex flex-col min-h-0 overflow-hidden shrink-0 relative"
          style={{ width: sidebarWidth, minWidth: 220, maxWidth: 500 }}
        >
          <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border/30">
            <BrainCircuit className="w-3.5 h-3.5 text-fuchsia-500" />
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Configuration
            </span>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-5">
            {/* Model */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Model</label>
              <Select value={model} onValueChange={(v) => patch({ llmBaseModel: v })}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {models.map((m) => (
                    <SelectItem key={m.id} value={m.id} className="text-xs">
                      <span className="flex items-center gap-2">
                        {m.label}
                        <Badge variant="outline" className="text-[9px] px-1 py-0">
                          {m.provider}
                        </Badge>
                      </span>
                    </SelectItem>
                  ))}
                  {models.length === 0 && (
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
                min={0} max={2} step={0.05}
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
                min={0} max={1} step={0.05}
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
                min={0} max={100} step={1}
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
                min={256} max={65536} step={256}
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
            <div className="pt-2 border-t border-border/30 space-y-1">
              <p className="text-[10px] text-muted-foreground">
                {contextInputs.length} context input{contextInputs.length !== 1 ? "s" : ""} connected
              </p>
              <p className="text-[10px] text-muted-foreground">
                {userPromptInputs.length} user prompt{userPromptInputs.length !== 1 ? "s" : ""} connected
              </p>
            </div>
          </div>
          {/* Resize handle */}
          <div
            className="absolute top-0 right-0 w-1.5 h-full cursor-col-resize hover:bg-primary/20 active:bg-primary/30 transition-colors z-10"
            onMouseDown={(e) => {
              e.preventDefault();
              const startX = e.clientX;
              const startW = sidebarWidth;
              const onMove = (ev: MouseEvent) => {
                const delta = ev.clientX - startX;
                setSidebarWidth(Math.max(220, Math.min(500, startW + delta)));
              };
              const onUp = () => {
                window.removeEventListener("mousemove", onMove);
                window.removeEventListener("mouseup", onUp);
              };
              window.addEventListener("mousemove", onMove);
              window.addEventListener("mouseup", onUp);
            }}
          />
        </div>
      )}

      {/* ── Main conversation surface ── */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-[hsl(var(--background))]">
        {/* Minimal toolbar — sidebar toggle only */}
        <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border/20 shrink-0 bg-muted/5">
          <button
            className="p-1.5 rounded-md hover:bg-muted/50 transition-colors text-muted-foreground"
            onClick={() => setSidebarOpen((v) => !v)}
            title={sidebarOpen ? "Hide settings" : "Show settings"}
          >
            {sidebarOpen ? (
              <PanelLeftClose className="w-4 h-4" />
            ) : (
              <Settings2 className="w-4 h-4" />
            )}
          </button>
        </div>

        {/* Scrollable conversation */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          <div className="max-w-5xl mx-auto px-6 sm:px-10 py-6 sm:py-10 space-y-6">

            {/* Connected context — collapsible summary */}
            {contextInputs.length > 0 && (
              <ConnectedInputTabs inputs={contextInputs} sectionLabel="Context" accent="amber" />
            )}

            {/* System prompt — discoverable container with smart buttons */}
            <div className="rounded-lg border border-fuchsia-500/20 bg-fuchsia-500/5">
              <div className="flex items-center gap-2 px-3 py-1.5 border-b border-fuchsia-500/10">
                <BrainCircuit className="w-3.5 h-3.5 text-fuchsia-500/60" />
                <span className="text-[10px] font-semibold uppercase tracking-wider text-fuchsia-500/60">
                  System Prompt
                </span>
              </div>
              <PromptEditor
                value={systemPrompt}
                onChange={(v) => patch({ llmBaseSystemPrompt: v })}
                contextBlocks={[...contextInputs, ...userPromptInputs]}
                placeholder="Persona, instructions, or constraints — shapes every response... Use @ to reference context blocks"
                readOnly={isRunning}
              />
            </div>

            {/* Connected user prompts — collapsible */}
            {userPromptInputs.length > 0 && (
              <ConnectedInputTabs inputs={userPromptInputs} sectionLabel="User Prompt" accent="emerald" />
            )}

            {/* User prompt — the main input */}
            <div className="relative">
              <PromptEditor
                value={userPrompt}
                onChange={(v) => patch({ llmBaseUserPrompt: v })}
                contextBlocks={[...contextInputs, ...userPromptInputs]}
                placeholder={userPromptInputs.length > 0
                  ? "Additional instructions... Use @ to reference context blocks"
                  : "What would you like to explore? Use @ to reference context blocks"}
                readOnly={isRunning}
              />
            </div>

            {/* Output — the response */}
            {(displayOutput || isRunning) && (
              <div className="pt-6 border-t border-border/20">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full bg-fuchsia-500/20 flex items-center justify-center">
                      <BrainCircuit className="w-3 h-3 text-fuchsia-500" />
                    </div>
                    <span className="text-xs font-medium text-muted-foreground">Response</span>
                  </div>
                  {displayOutput && !isRunning && (
                    <Button variant="ghost" size="sm" onClick={handleCopy} className="h-6 px-2 text-[10px] gap-1 text-muted-foreground">
                      <Copy className="w-3 h-3" /> Copy
                    </Button>
                  )}
                </div>
                <div ref={outputRef} className="min-h-[60px]">
                  {isRunning && !streamingOutput && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground/60">
                      <Loader2 className="w-4 h-4 animate-spin text-fuchsia-500" />
                      Thinking...
                    </div>
                  )}
                  <div className="text-sm leading-relaxed whitespace-pre-wrap break-words">
                    {displayOutput}
                    {isRunning && streamingOutput && (
                      <span className="inline-block w-1.5 h-4 bg-fuchsia-500 animate-pulse ml-0.5 align-middle" />
                    )}
                  </div>
                </div>
                {!isRunning && displayOutput && (
                  <p className="text-[10px] text-muted-foreground/40 mt-3">
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
        </div>
      </div>
    </div>

    <HeaderRunButton
      isRunning={isRunning}
      onRun={handleRun}
      onStop={handleStop}
      disabled={!userPrompt.trim() && contextInputs.length === 0 && userPromptInputs.length === 0}
      model={modelLabel}
      streaming={streaming}
      maxTokens={maxTokens}
    />
  </>
  );
}

// ── Run/Stop button portaled into the overlay header bar ──

function HeaderRunButton({
  isRunning,
  onRun,
  onStop,
  disabled,
  model,
  streaming,
  maxTokens,
}: {
  isRunning: boolean;
  onRun: () => void;
  onStop: () => void;
  disabled: boolean;
  model: string;
  streaming: boolean;
  maxTokens: number;
}) {
  const [target, setTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const el = document.getElementById("expanded-header-actions");
    setTarget(el);
  }, []);

  if (!target) return null;

  return createPortal(
    <div className="flex items-center gap-2">
      {isRunning ? (
        <Button
          size="sm"
          variant="ghost"
          onClick={onStop}
          className="h-7 gap-1.5 text-white bg-white/20 hover:bg-white/30 hover:text-white text-xs"
        >
          <Square className="w-3 h-3" />
          Stop
        </Button>
      ) : (
        <Button
          size="sm"
          variant="ghost"
          onClick={onRun}
          disabled={disabled}
          className="h-7 gap-1.5 text-white bg-white/20 hover:bg-white/30 hover:text-white text-xs disabled:opacity-40"
        >
          <Play className="w-3 h-3" />
          Run
        </Button>
      )}
      <span className="text-[10px] text-white/60 hidden sm:inline">
        {model} · {streaming ? "stream" : "batch"} · {maxTokens.toLocaleString()}
      </span>
    </div>,
    target,
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

      {expanded && (
        <div className={`border-t ${colors.borderInner}`}>
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
