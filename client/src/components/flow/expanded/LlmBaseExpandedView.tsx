/**
 * LlmBaseExpandedView — Full expanded view for LLM Base nodes.
 *
 * Document-style authoring experience for system prompts: left sidebar with
 * Tools / Provo / Config tabs, main writing surface with Objective + System
 * Prompt editor (with AI remix, voice/text feedback, selection popover),
 * User Prompt via PromptEditor with @ context refs, and streaming output.
 */

import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  Play, Loader2, Square, Copy, BrainCircuit, Search, Shield,
  Thermometer, Zap, ChevronDown, ChevronRight, FileText,
  PanelLeftClose, PanelLeft, Settings2, Wrench, Swords,
  PenLine, Type, Send, X, Crosshair,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { ProvokeText } from "@/components/ProvokeText";
import { VoiceRecorder } from "@/components/VoiceRecorder";
import { ProvoThread } from "@/components/notebook/ProvoThread";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import type { FlowNode, FlowEdge } from "../useFlowCanvas";
import { edgeHasRole } from "../useFlowCanvas";
import { PromptEditor, expandContextRefs, getReferencedLabels } from "../PromptEditor";
import { LLM_TOOLS } from "@/pages/flow-workspace/FlowToolHandlers";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { ProvocationType } from "@shared/schema";

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

  // ── LLM execution state ──
  const [isRunning, setIsRunning] = useState(false);
  const [streamingOutput, setStreamingOutput] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  // ── Sidebar state ──
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(280);
  const [leftTab, setLeftTab] = useState<"tools" | "provo" | "config">("tools");

  // ── Document-style editing state ──
  const [objective, setObjective] = useState(node.llmBaseObjective ?? "");
  const [systemPrompt, setSystemPrompt] = useState(node.llmBaseSystemPrompt ?? "");
  const [userPrompt, setUserPrompt] = useState(node.llmBaseUserPrompt ?? "");
  const [versions, setVersions] = useState<Array<{ content: string; label: string; timestamp: string }>>(
    node.llmBaseVersions ?? [],
  );
  const [toolRunning, setToolRunning] = useState<string | null>(null);

  // ── AI Remix / Direct edit state ──
  const [writerVoiceActive, setWriterVoiceActive] = useState(false);
  const [writerTextOpen, setWriterTextOpen] = useState(false);
  const [writerFeedbackText, setWriterFeedbackText] = useState("");
  const [directVoiceActive, setDirectVoiceActive] = useState(false);
  const [directTextOpen, setDirectTextOpen] = useState(false);
  const [directText, setDirectText] = useState("");

  // ── Selection popover state ──
  const [selectionPopover, setSelectionPopover] = useState<{ text: string; top: number; left: number } | null>(null);
  const [selEditMode, setSelEditMode] = useState<"text-remix" | "text-direct" | null>(null);
  const [selEditText, setSelEditText] = useState("");
  const [selVoiceActive, setSelVoiceActive] = useState(false);

  // ── ProvoThread state ──
  const [activePersonas, setActivePersonas] = useState<Set<ProvocationType>>(new Set());
  const [provoEvolving, setProvoEvolving] = useState(false);

  // ── Refs ──
  const editorContainerRef = useRef<HTMLDivElement>(null);
  const writerTextInputRef = useRef<HTMLInputElement>(null);
  const directTextInputRef = useRef<HTMLInputElement>(null);

  // ── Fetch available models ──
  const { data: rawModels } = useQuery<ChatModelDef[]>({
    queryKey: ["/api/chat/models"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/chat/models");
      const data = await res.json();
      return Array.isArray(data) ? data : (data.models ?? []);
    },
    staleTime: 60_000,
  });
  const models = Array.isArray(rawModels) ? rawModels : [];

  // ── Config values from node ──
  const model = node.llmBaseModel || "gemini-2.5-flash";
  const temperature = node.llmBaseTemperature ?? 1.0;
  const topP = node.llmBaseTopP ?? 1.0;
  const topK = node.llmBaseTopK ?? 0;
  const maxTokens = node.llmBaseMaxTokens ?? 8192;
  const safety = node.llmBaseSafety ?? "none";
  const enableSearch = node.llmBaseEnableSearch ?? false;
  const streaming = node.llmBaseStreaming ?? true;

  const patch = useCallback(
    (updates: Partial<FlowNode>) => onUpdateNode(node.id, updates),
    [node.id, onUpdateNode],
  );

  // ── Gather connected context and user-prompt edges ──
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

  // ── Persist local state back to node (debounced) ──
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      patch({
        llmBaseSystemPrompt: systemPrompt,
        llmBaseUserPrompt: userPrompt,
        llmBaseObjective: objective,
        llmBaseVersions: versions,
      });
    }, 400);
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, [systemPrompt, userPrompt, objective, versions, patch]);

  // ── Connected context as string (for tool calls) ──
  const getConnectedContext = useCallback(() => {
    const allInputs = [...contextInputs, ...userPromptInputs];
    return allInputs
      .map((c) => `[${c.label}]\n${c.content}`)
      .join("\n\n---\n\n");
  }, [contextInputs, userPromptInputs]);

  // ── Version snapshot ──
  const snapshotVersion = useCallback((label: string) => {
    if (!systemPrompt.trim()) return;
    setVersions((prev) => [
      ...prev,
      { content: systemPrompt, label, timestamp: new Date().toISOString() },
    ]);
  }, [systemPrompt]);

  // ── Tool handler (calls /api/write to transform the system prompt) ──
  const handleTool = useCallback(
    async (instruction: string, toolId: string) => {
      if (!systemPrompt.trim()) return;
      snapshotVersion(`Before ${toolId}`);
      setToolRunning(toolId);
      try {
        let connectedContext = getConnectedContext();
        if (connectedContext.length > 90_000) {
          connectedContext = connectedContext.slice(0, 90_000) + "\n\n[...context truncated]";
        }
        const res = await apiRequest("POST", "/api/write", {
          document: systemPrompt,
          instruction,
          appType: "write-a-prompt",
          outputFormat: "plain-text",
          ...(objective.trim() ? { objective: objective.trim() } : {}),
          ...(connectedContext ? { sessionNotes: connectedContext } : {}),
        });
        const data = (await res.json()) as { document: string };
        if (data.document) {
          setSystemPrompt(data.document);
        } else {
          toast({ title: "No changes produced", variant: "destructive" });
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        toast({ title: "Tool failed", description: msg.includes("400") ? "Request too large" : undefined, variant: "destructive" });
      } finally {
        setToolRunning(null);
      }
    },
    [systemPrompt, objective, toast, snapshotVersion, getConnectedContext],
  );

  // ── Writer feedback (AI remix) ──
  const handleWriterFeedback = useCallback(
    async (feedback: string) => {
      if (!feedback.trim() || !systemPrompt.trim()) return;
      snapshotVersion("Before writer feedback");
      setToolRunning("writer-feedback");
      try {
        const connectedContext = getConnectedContext();
        const res = await apiRequest("POST", "/api/write", {
          document: systemPrompt,
          instruction: `WRITER FEEDBACK:\nThe author has provided the following feedback to be remixed into the system prompt:\n\n${feedback}\n\nInterpret the author's intent and intelligently weave this feedback into the system prompt. This is not a literal transcription — it is editorial direction from the author.`,
          appType: "write-a-prompt",
          outputFormat: "plain-text",
          ...(objective.trim() ? { objective: objective.trim() } : {}),
          ...(connectedContext ? { sessionNotes: connectedContext } : {}),
        });
        const data = (await res.json()) as { document: string };
        if (data.document) {
          setSystemPrompt(data.document);
          toast({ title: "System prompt evolved", description: "Writer feedback integrated" });
        }
      } catch {
        toast({ title: "Writer feedback failed", variant: "destructive" });
      } finally {
        setToolRunning(null);
      }
    },
    [systemPrompt, objective, toast, snapshotVersion, getConnectedContext],
  );

  // ── Direct insert at end (no AI) ──
  const handleDirectInsert = useCallback(
    (text: string) => {
      if (!text.trim()) return;
      const spacer = systemPrompt.length > 0 && !systemPrompt.endsWith("\n") && !systemPrompt.endsWith(" ") ? " " : "";
      setSystemPrompt(systemPrompt + spacer + text.trim());
    },
    [systemPrompt],
  );

  // ── Selection remix (AI remixes only selected text) ──
  const handleSelectionRemix = useCallback(
    async (feedback: string, selectedText: string) => {
      if (!feedback.trim() || !systemPrompt.trim()) return;
      snapshotVersion("Before selection remix");
      setToolRunning("sel-remix");
      try {
        const connectedContext = getConnectedContext();
        const res = await apiRequest("POST", "/api/write", {
          document: systemPrompt,
          selectedText,
          instruction: `WRITER FEEDBACK ON SELECTION:\nThe author has highlighted the following text and provided feedback to remix it:\n\nSELECTED TEXT: "${selectedText}"\n\nAUTHOR FEEDBACK: ${feedback}\n\nApply the author's feedback to improve the selected area while keeping the rest of the system prompt intact.`,
          appType: "write-a-prompt",
          outputFormat: "plain-text",
          ...(objective.trim() ? { objective: objective.trim() } : {}),
          ...(connectedContext ? { sessionNotes: connectedContext } : {}),
        });
        const data = (await res.json()) as { document: string };
        if (data.document) {
          setSystemPrompt(data.document);
          toast({ title: "Selection remixed" });
        }
      } catch {
        toast({ title: "Selection remix failed", variant: "destructive" });
      } finally {
        setToolRunning(null);
        setSelectionPopover(null);
      }
    },
    [systemPrompt, objective, toast, snapshotVersion, getConnectedContext],
  );

  // ── Selection direct replace ──
  const handleSelectionDirectReplace = useCallback(
    (newText: string, selectedText: string) => {
      if (!newText.trim()) return;
      const idx = systemPrompt.indexOf(selectedText);
      if (idx === -1) return;
      const before = systemPrompt.slice(0, idx);
      const after = systemPrompt.slice(idx + selectedText.length);
      setSystemPrompt(before + newText.trim() + after);
      setSelectionPopover(null);
    },
    [systemPrompt],
  );

  // ── Text selection handler ──
  const handleTextSelect = useCallback(() => {
    const selection = window.getSelection();
    const selectedText = selection?.toString().trim();
    if (!selectedText || selectedText.length < 3) {
      setSelectionPopover(null);
      return;
    }
    const range = selection!.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    const container = editorContainerRef.current;
    if (!container) return;
    const containerRect = container.getBoundingClientRect();
    setSelectionPopover({
      text: selectedText,
      top: rect.top - containerRect.top - 40,
      left: rect.left - containerRect.left + rect.width / 2,
    });
    setSelEditMode(null);
    setSelEditText("");
  }, []);

  // ── Provo evolve handler ──
  const handleProvoEvolve = useCallback(
    async (instruction: string) => {
      if (!systemPrompt.trim()) return;
      snapshotVersion("Before provo evolve");
      setProvoEvolving(true);
      try {
        const connectedContext = getConnectedContext();
        const res = await apiRequest("POST", "/api/write", {
          document: systemPrompt,
          instruction,
          appType: "write-a-prompt",
          outputFormat: "plain-text",
          ...(objective.trim() ? { objective: objective.trim() } : {}),
          ...(connectedContext ? { sessionNotes: connectedContext } : {}),
        });
        const data = (await res.json()) as { document: string };
        if (data.document) {
          setSystemPrompt(data.document);
          toast({ title: "System prompt evolved", description: "Provocation insights merged" });
        }
      } catch {
        toast({ title: "Provo evolve failed", variant: "destructive" });
      } finally {
        setProvoEvolving(false);
      }
    },
    [systemPrompt, objective, toast, snapshotVersion, getConnectedContext],
  );

  // ── Auto-focus input bars ──
  useEffect(() => {
    if (writerTextOpen) setTimeout(() => writerTextInputRef.current?.focus(), 50);
  }, [writerTextOpen]);
  useEffect(() => {
    if (directTextOpen) setTimeout(() => directTextInputRef.current?.focus(), 50);
  }, [directTextOpen]);

  // ── Run handler ──
  const handleRun = useCallback(async () => {
    const allBlocks = [...contextInputs, ...userPromptInputs];
    const expandedSystem = expandContextRefs(systemPrompt, allBlocks);
    const expandedUser = expandContextRefs(userPrompt, allBlocks);

    const referencedLabels = new Set(
      Array.from(getReferencedLabels(systemPrompt)).concat(Array.from(getReferencedLabels(userPrompt))),
    );
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

  const modelLabel = models.find((m) => m.id === model)?.label || model;

  return (
  <>
    <div className="flex-1 flex overflow-hidden">
      {/* ── Collapsible resizable sidebar with 3 tabs ── */}
      {sidebarOpen && (
        <div
          className="border-r border-border/30 bg-card/30 flex flex-col min-h-0 overflow-hidden shrink-0 relative"
          style={{ width: sidebarWidth, minWidth: 220, maxWidth: 500 }}
        >
          {/* Tab bar */}
          <div className="flex border-b border-border/30">
            <button
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 px-2 py-2 text-xs font-medium transition-colors",
                leftTab === "tools"
                  ? "text-foreground border-b-2 border-fuchsia-500"
                  : "text-muted-foreground hover:text-foreground",
              )}
              onClick={() => setLeftTab("tools")}
            >
              <Wrench className="w-3.5 h-3.5" />
              Tools
            </button>
            <button
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 px-2 py-2 text-xs font-medium transition-colors",
                leftTab === "provo"
                  ? "text-foreground border-b-2 border-fuchsia-500"
                  : "text-muted-foreground hover:text-foreground",
              )}
              onClick={() => setLeftTab("provo")}
            >
              <Swords className="w-3.5 h-3.5" />
              Provo
            </button>
            <button
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 px-2 py-2 text-xs font-medium transition-colors",
                leftTab === "config"
                  ? "text-foreground border-b-2 border-fuchsia-500"
                  : "text-muted-foreground hover:text-foreground",
              )}
              onClick={() => setLeftTab("config")}
            >
              <Settings2 className="w-3.5 h-3.5" />
              Config
            </button>
          </div>

          {/* Tab content */}
          <div className="flex-1 min-h-0 overflow-auto">
            {leftTab === "tools" ? (
              <>
                <div className="p-3 border-b border-border/30">
                  <div className="grid grid-cols-2 gap-1.5">
                    {LLM_TOOLS.map((tool) => (
                      <button
                        key={tool.id}
                        className="flex items-center gap-1.5 px-2.5 py-2 rounded-md border border-border/30 hover:bg-muted/50 transition-colors text-left disabled:opacity-50"
                        disabled={toolRunning !== null}
                        onClick={() => handleTool(tool.instruction, tool.id)}
                      >
                        {toolRunning === tool.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-fuchsia-500 shrink-0" />
                        ) : (
                          <tool.icon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        )}
                        <span className="text-[11px] font-medium">{tool.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
                {/* Connected inputs summary */}
                {(contextInputs.length > 0 || userPromptInputs.length > 0) && (
                  <div className="p-3">
                    <ConnectedInputBlocks
                      inputs={[...contextInputs, ...userPromptInputs]}
                      sectionLabel="Context"
                      accent="amber"
                    />
                  </div>
                )}
              </>
            ) : leftTab === "provo" ? (
              <ProvoThread
                documentText={systemPrompt}
                objective={objective.trim() || node.label || ""}
                activePersonas={activePersonas}
                onTogglePersona={(id) =>
                  setActivePersonas((prev) => {
                    const next = new Set(prev);
                    if (next.has(id)) next.delete(id);
                    else next.add(id);
                    return next;
                  })
                }
                onCaptureToContext={() => {}}
                hasDocument={!!systemPrompt.trim()}
                mode="inline"
                onEvolveWithProvocations={handleProvoEvolve}
                isEvolving={provoEvolving}
              />
            ) : (
              /* Config tab — model, temperature, etc. */
              <div className="p-4 space-y-5">
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
            )}
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

      {/* ── Main writing surface ── */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-[hsl(var(--background))]">
        {/* Toolbar — sidebar toggle + AI Remix + Direct Edit */}
        <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border/20 shrink-0 bg-muted/5">
          <button
            className="p-1.5 rounded-md hover:bg-muted/50 transition-colors text-muted-foreground"
            onClick={() => setSidebarOpen((v) => !v)}
            title={sidebarOpen ? "Hide sidebar" : "Show sidebar"}
          >
            {sidebarOpen ? (
              <PanelLeftClose className="w-4 h-4" />
            ) : (
              <PanelLeft className="w-4 h-4" />
            )}
          </button>
          {versions.length > 0 && (
            <>
              <div className="w-px h-4 bg-border/30" />
              <span className="text-[9px] text-muted-foreground/60">
                {versions.length} version{versions.length !== 1 ? "s" : ""}
              </span>
            </>
          )}

          <div className="flex-1" />

          {/* AI Remix group */}
          <span className="text-[8px] uppercase tracking-wider text-fuchsia-500/50 font-semibold mr-1">AI Remix</span>

          {/* Writer Voice */}
          <div
            className={cn(
              "relative rounded-md transition-all",
              writerVoiceActive ? "ring-2 ring-fuchsia-500/50 bg-fuchsia-500/10" : "hover:bg-fuchsia-500/10",
            )}
            title="Writer Voice — dictate feedback to evolve the system prompt"
          >
            <VoiceRecorder
              onTranscript={(transcript: string) => {
                if (!transcript.trim()) return;
                handleWriterFeedback(transcript);
                setWriterVoiceActive(false);
                toast({ title: "Feedback sent", description: "Remixing into system prompt..." });
              }}
              onRecordingChange={setWriterVoiceActive}
              size="icon"
              variant="ghost"
              className={cn(
                "h-7 w-7",
                writerVoiceActive ? "text-fuchsia-500 animate-pulse" : "text-fuchsia-500/80 hover:text-fuchsia-500",
              )}
            />
            <span className={cn(
              "absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full border border-background",
              writerVoiceActive ? "bg-destructive animate-ping" : "bg-fuchsia-500",
            )} />
          </div>

          {/* Writer Text */}
          <Button
            size="icon"
            variant="ghost"
            className={cn(
              "h-7 w-7 relative",
              writerTextOpen
                ? "text-fuchsia-500 bg-fuchsia-500/10 ring-2 ring-fuchsia-500/50"
                : "text-fuchsia-500/80 hover:text-fuchsia-500 hover:bg-fuchsia-500/10",
            )}
            onClick={() => setWriterTextOpen(!writerTextOpen)}
            title="Writer Edit — type feedback to evolve the system prompt"
          >
            <PenLine className="w-3.5 h-3.5" />
            <span className={cn(
              "absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full border border-background bg-fuchsia-500",
            )} />
          </Button>

          <div className="w-px h-5 bg-border/40 mx-1" />

          {/* Direct Edit group */}
          <span className="text-[8px] uppercase tracking-wider text-emerald-500/50 font-semibold mr-1">Direct</span>

          {/* Direct Voice */}
          <div
            className={cn(
              "relative rounded-md transition-all",
              directVoiceActive ? "ring-2 ring-emerald-500/50 bg-emerald-500/10" : "hover:bg-emerald-500/10",
            )}
            title="Direct Voice — dictate text inserted at cursor (no AI)"
          >
            <VoiceRecorder
              onTranscript={(transcript: string) => {
                if (!transcript.trim()) return;
                handleDirectInsert(transcript);
                setDirectVoiceActive(false);
                toast({ title: "Inserted", description: "Voice text added" });
              }}
              onRecordingChange={setDirectVoiceActive}
              size="icon"
              variant="ghost"
              className={cn(
                "h-7 w-7",
                directVoiceActive ? "text-emerald-500 animate-pulse" : "text-emerald-500/80 hover:text-emerald-500",
              )}
            />
            <span className={cn(
              "absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full border border-background",
              directVoiceActive ? "bg-destructive animate-ping" : "bg-emerald-500",
            )} />
          </div>

          {/* Direct Text */}
          <Button
            size="icon"
            variant="ghost"
            className={cn(
              "h-7 w-7 relative",
              directTextOpen
                ? "text-emerald-500 bg-emerald-500/10 ring-2 ring-emerald-500/50"
                : "text-emerald-500/80 hover:text-emerald-500 hover:bg-emerald-500/10",
            )}
            onClick={() => setDirectTextOpen(!directTextOpen)}
            title="Direct Edit — type text inserted at cursor (no AI)"
          >
            <Type className="w-3.5 h-3.5" />
            <span className={cn(
              "absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full border border-background bg-emerald-500",
            )} />
          </Button>

          {/* Status indicators */}
          {(writerVoiceActive || directVoiceActive) && (
            <span className={cn(
              "text-[11px] font-medium animate-pulse",
              directVoiceActive ? "text-emerald-500" : "text-fuchsia-500",
            )}>
              Listening...
            </span>
          )}

          {(toolRunning === "writer-feedback" || toolRunning === "sel-remix") && (
            <span className="text-[11px] text-muted-foreground animate-pulse flex items-center gap-1">
              <Loader2 className="w-3 h-3 animate-spin" />
              Evolving...
            </span>
          )}
        </div>

        {/* Writer text input bar (AI remix) */}
        {writerTextOpen && (
          <div className="shrink-0 flex items-center gap-2 px-4 py-1.5 border-b bg-fuchsia-500/5">
            <PenLine className="w-3.5 h-3.5 text-fuchsia-500 shrink-0" />
            <input
              ref={writerTextInputRef}
              type="text"
              value={writerFeedbackText}
              onChange={(e) => setWriterFeedbackText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if (writerFeedbackText.trim()) {
                    handleWriterFeedback(writerFeedbackText.trim());
                    setWriterFeedbackText("");
                    setWriterTextOpen(false);
                  }
                }
                if (e.key === "Escape") {
                  setWriterTextOpen(false);
                  setWriterFeedbackText("");
                }
              }}
              placeholder="Type feedback for the AI to remix into the system prompt..."
              className="flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground/50"
              disabled={toolRunning !== null}
            />
            {writerFeedbackText.trim() && (
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6 shrink-0 text-fuchsia-500"
                onClick={() => {
                  handleWriterFeedback(writerFeedbackText.trim());
                  setWriterFeedbackText("");
                  setWriterTextOpen(false);
                }}
                disabled={toolRunning !== null}
              >
                <Send className="w-3 h-3" />
              </Button>
            )}
            <Button
              size="icon"
              variant="ghost"
              className="h-5 w-5 shrink-0 text-muted-foreground"
              onClick={() => { setWriterTextOpen(false); setWriterFeedbackText(""); }}
            >
              <X className="w-3 h-3" />
            </Button>
          </div>
        )}

        {/* Direct text input bar (no AI) */}
        {directTextOpen && (
          <div className="shrink-0 flex items-center gap-2 px-4 py-1.5 border-b bg-emerald-500/5">
            <Type className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
            <input
              ref={directTextInputRef}
              type="text"
              value={directText}
              onChange={(e) => setDirectText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if (directText.trim()) {
                    handleDirectInsert(directText.trim());
                    setDirectText("");
                    setDirectTextOpen(false);
                  }
                }
                if (e.key === "Escape") {
                  setDirectTextOpen(false);
                  setDirectText("");
                }
              }}
              placeholder="Type text to insert at cursor position (no AI)..."
              className="flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground/50"
            />
            {directText.trim() && (
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6 shrink-0 text-emerald-500"
                onClick={() => {
                  handleDirectInsert(directText.trim());
                  setDirectText("");
                  setDirectTextOpen(false);
                }}
              >
                <Send className="w-3 h-3" />
              </Button>
            )}
            <Button
              size="icon"
              variant="ghost"
              className="h-5 w-5 shrink-0 text-muted-foreground"
              onClick={() => { setDirectTextOpen(false); setDirectText(""); }}
            >
              <X className="w-3 h-3" />
            </Button>
          </div>
        )}

        {/* Scrollable page */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          <div className="max-w-5xl mx-auto px-6 sm:px-10 py-6 sm:py-10 space-y-6">

            {/* Objective */}
            <div className="rounded-lg border border-fuchsia-500/20 bg-fuchsia-500/5">
              <div className="flex items-center gap-2 px-3 py-1.5 border-b border-fuchsia-500/10">
                <Crosshair className="w-3.5 h-3.5 text-fuchsia-500/60" />
                <span className="text-[10px] font-semibold uppercase tracking-wider text-fuchsia-500/60">
                  Objective
                </span>
              </div>
              <ProvokeText
                value={objective}
                onChange={(v) => setObjective(v)}
                chrome="bare"
                variant="textarea"
                placeholder="What should this system prompt achieve? Define the goal to guide AI tools..."
                showCopy
                showClear
              />
            </div>

            {/* System Prompt — main writing surface */}
            <div ref={editorContainerRef} className="relative">
              <div className="flex items-center gap-2 mb-2">
                <BrainCircuit className="w-3.5 h-3.5 text-fuchsia-500/60" />
                <span className="text-[10px] font-semibold uppercase tracking-wider text-fuchsia-500/60">
                  System Prompt
                </span>
                {contextInputs.length > 0 && (
                  <span className="text-[10px] text-amber-500/50">
                    {contextInputs.length} context block{contextInputs.length > 1 ? "s" : ""} — type @ to insert
                  </span>
                )}
                {toolRunning && toolRunning !== "writer-feedback" && toolRunning !== "sel-remix" && (
                  <span className="text-[10px] text-fuchsia-500 animate-pulse flex items-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    {LLM_TOOLS.find((t) => t.id === toolRunning)?.label || "Processing"}...
                  </span>
                )}
              </div>

              {/* Selection quick actions popover */}
              {selectionPopover && (
                <div
                  data-llm-selection-popover
                  className="absolute z-50 bg-card border border-border/50 rounded-lg shadow-xl p-1.5 flex flex-col gap-1 min-w-[180px]"
                  style={{
                    top: selectionPopover.top,
                    left: Math.max(10, selectionPopover.left - 90),
                  }}
                >
                  {!selEditMode && (
                    <div className="flex items-center gap-1">
                      {/* Remix with Voice */}
                      <div
                        className={cn(
                          "relative rounded-md transition-all",
                          selVoiceActive ? "ring-2 ring-fuchsia-500/50 bg-fuchsia-500/10" : "hover:bg-fuchsia-500/10",
                        )}
                        title="Remix selection with voice"
                      >
                        <VoiceRecorder
                          onTranscript={(transcript: string) => {
                            if (!transcript.trim() || !selectionPopover) return;
                            handleSelectionRemix(transcript, selectionPopover.text);
                            setSelVoiceActive(false);
                            window.getSelection()?.removeAllRanges();
                            toast({ title: "Remixing selection..." });
                          }}
                          onRecordingChange={setSelVoiceActive}
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-fuchsia-500/80 hover:text-fuchsia-500"
                        />
                      </div>
                      {/* Remix with Text */}
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-fuchsia-500/80 hover:text-fuchsia-500 hover:bg-fuchsia-500/10"
                        onClick={() => { setSelEditMode("text-remix"); setSelEditText(""); }}
                        title="Remix selection with text"
                      >
                        <PenLine className="w-3.5 h-3.5" />
                      </Button>
                      <div className="w-px h-5 bg-border/40" />
                      {/* Direct Voice replace */}
                      <div
                        className="relative rounded-md transition-all hover:bg-emerald-500/10"
                        title="Replace selection with voice (no AI)"
                      >
                        <VoiceRecorder
                          onTranscript={(transcript: string) => {
                            if (!transcript.trim() || !selectionPopover) return;
                            handleSelectionDirectReplace(transcript, selectionPopover.text);
                            window.getSelection()?.removeAllRanges();
                            toast({ title: "Replaced" });
                          }}
                          onRecordingChange={(v) => { if (v) setSelEditMode("text-direct"); else setSelEditMode(null); }}
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-emerald-500/80 hover:text-emerald-500"
                        />
                      </div>
                      {/* Direct Text replace */}
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-emerald-500/80 hover:text-emerald-500 hover:bg-emerald-500/10"
                        onClick={() => { setSelEditMode("text-direct"); setSelEditText(""); }}
                        title="Replace selection with text (no AI)"
                      >
                        <Type className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  )}

                  {/* Inline text input for selection edit modes */}
                  {(selEditMode === "text-remix" || selEditMode === "text-direct") && (
                    <div className="flex items-center gap-1.5">
                      <input
                        autoFocus
                        type="text"
                        value={selEditText}
                        onChange={(e) => setSelEditText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            if (selEditText.trim() && selectionPopover) {
                              if (selEditMode === "text-remix") {
                                handleSelectionRemix(selEditText.trim(), selectionPopover.text);
                              } else {
                                handleSelectionDirectReplace(selEditText.trim(), selectionPopover.text);
                              }
                              window.getSelection()?.removeAllRanges();
                            }
                          }
                          if (e.key === "Escape") {
                            setSelEditMode(null);
                            setSelEditText("");
                          }
                        }}
                        placeholder={selEditMode === "text-remix" ? "AI feedback on selection..." : "Replace selection with..."}
                        className="flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground/50 min-w-[160px]"
                        disabled={toolRunning !== null}
                      />
                      {selEditText.trim() && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className={cn(
                            "h-6 w-6 shrink-0",
                            selEditMode === "text-remix" ? "text-fuchsia-500" : "text-emerald-500",
                          )}
                          onClick={() => {
                            if (!selEditText.trim() || !selectionPopover) return;
                            if (selEditMode === "text-remix") {
                              handleSelectionRemix(selEditText.trim(), selectionPopover.text);
                            } else {
                              handleSelectionDirectReplace(selEditText.trim(), selectionPopover.text);
                            }
                            window.getSelection()?.removeAllRanges();
                          }}
                          disabled={toolRunning !== null}
                        >
                          <Send className="w-3 h-3" />
                        </Button>
                      )}
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-5 w-5 shrink-0 text-muted-foreground"
                        onClick={() => { setSelEditMode(null); setSelEditText(""); }}
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  )}

                  {/* Status for voice modes */}
                  {selVoiceActive && (
                    <span className="text-[10px] font-medium animate-pulse px-1 text-fuchsia-500">
                      Listening...
                    </span>
                  )}
                </div>
              )}

              <PromptEditor
                value={systemPrompt}
                onChange={setSystemPrompt}
                contextBlocks={[...contextInputs, ...userPromptInputs]}
                onSelect={handleTextSelect}
                showCopy
                placeholder="Write your system prompt here — use @ to reference connected context blocks..."
                className="min-h-[200px]"
                readOnly={isRunning}
              />
            </div>

            {/* User Message */}
            <div className="relative">
              <div className="flex items-center gap-2 mb-2">
                <Send className="w-3.5 h-3.5 text-emerald-500/60" />
                <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-500/60">
                  User Message
                </span>
              </div>
              <PromptEditor
                value={userPrompt}
                onChange={(v) => setUserPrompt(v)}
                contextBlocks={[...contextInputs, ...userPromptInputs]}
                placeholder="What would you like to explore? Use @ to reference context blocks"
                readOnly={isRunning}
              />
            </div>

            {/* Output */}
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

        {/* Version history — compact bottom bar */}
        {versions.length > 0 && (
          <div className="px-4 py-1.5 border-t border-border/20 shrink-0 bg-muted/5">
            <div className="flex items-center gap-2 max-w-5xl mx-auto">
              <span className="text-[9px] font-medium text-muted-foreground/50 uppercase tracking-wider shrink-0">
                History
              </span>
              <div className="flex-1 flex gap-1 overflow-x-auto">
                {versions.map((v, i) => (
                  <button
                    key={i}
                    className="shrink-0 px-2 py-0.5 rounded text-[9px] border border-border/30 hover:bg-muted/30 transition-colors text-muted-foreground/60 hover:text-foreground"
                    title={`${v.label} — ${new Date(v.timestamp).toLocaleTimeString()}`}
                    onClick={() => {
                      snapshotVersion("Before revert");
                      setSystemPrompt(v.content);
                      toast({ title: "Reverted", description: `Restored: ${v.label}` });
                    }}
                  >
                    v{i + 1}: {v.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>

    <HeaderRunButton
      isRunning={isRunning}
      onRun={handleRun}
      onStop={handleStop}
      disabled={!userPrompt.trim() && !systemPrompt.trim() && contextInputs.length === 0 && userPromptInputs.length === 0}
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

// ── Visual blocks for connected inputs — each input as a separate card ──

function ConnectedInputBlocks({
  inputs,
  sectionLabel,
  accent = "amber",
}: {
  inputs: { label: string; content: string }[];
  sectionLabel: string;
  accent?: "amber" | "emerald";
}) {
  const [expandedBlocks, setExpandedBlocks] = useState<Set<number>>(new Set());

  const toggle = (i: number) =>
    setExpandedBlocks((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });

  const colors = accent === "emerald"
    ? { border: "border-emerald-500/30", bg: "bg-emerald-500/5", title: "text-emerald-400", icon: "text-emerald-500/60", hover: "hover:border-emerald-500/50" }
    : { border: "border-amber-500/30", bg: "bg-amber-500/5", title: "text-amber-400", icon: "text-amber-500/60", hover: "hover:border-amber-500/50" };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5">
        <FileText className={`w-3 h-3 ${colors.icon}`} />
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
          {sectionLabel}
        </span>
        <span className={`text-[9px] ${colors.title}`}>
          ({inputs.length})
        </span>
      </div>
      {inputs.map((input, i) => {
        const isExpanded = expandedBlocks.has(i);
        const preview = input.content.slice(0, 120).replace(/\n/g, " ");
        return (
          <button
            key={i}
            type="button"
            onClick={() => toggle(i)}
            className={cn(
              "w-full text-left rounded-lg border p-3 transition-all",
              colors.border, colors.bg, colors.hover,
              isExpanded && "ring-1 ring-inset ring-white/5",
            )}
          >
            <div className="flex items-center gap-2 mb-1">
              {isExpanded ? (
                <ChevronDown className={`w-3 h-3 ${colors.icon} shrink-0`} />
              ) : (
                <ChevronRight className={`w-3 h-3 ${colors.icon} shrink-0`} />
              )}
              <span className={`text-xs font-semibold ${colors.title} truncate`}>
                {input.label}
              </span>
            </div>
            {isExpanded ? (
              <div className="mt-2 pl-5 max-h-48 overflow-y-auto">
                <p className="text-xs text-foreground/70 whitespace-pre-wrap leading-relaxed">
                  {input.content}
                </p>
              </div>
            ) : (
              <p className="pl-5 text-[11px] text-muted-foreground/50 truncate">
                {preview}{input.content.length > 120 ? "…" : ""}
              </p>
            )}
          </button>
        );
      })}
    </div>
  );
}
