/**
 * WebpageExpandedView — Full expanded view for Webpage nodes.
 *
 * Two-panel layout: settings (left) + live iframe preview (right).
 * Generates a self-contained HTML page from connected content using LLM.
 */

import { useState, useCallback, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import {
  Play, Loader2, Square, Download, Save, Code, Eye,
  Globe, ChevronDown, ChevronRight, Copy,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { ProvokeText } from "@/components/ProvokeText";
import { LlmHoverButton, type ContextBlock, type SummaryItem } from "@/components/LlmHoverButton";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import type { FlowNode, FlowEdge } from "../useFlowCanvas";
import { edgeHasRole } from "../useFlowCanvas";
import { apiRequest } from "@/lib/queryClient";
import { FileText, Layers, Settings2 } from "lucide-react";

interface WebpageExpandedViewProps {
  node: FlowNode;
  nodes: FlowNode[];
  edges: FlowEdge[];
  onUpdateNode: (nodeId: string, patch: Partial<FlowNode>) => void;
}

const STYLE_OPTIONS = [
  { value: "modern-minimal", label: "Modern Minimal" },
  { value: "corporate", label: "Corporate" },
  { value: "creative", label: "Creative" },
  { value: "technical-docs", label: "Technical Docs" },
] as const;

const STYLE_PROMPTS: Record<string, string> = {
  "modern-minimal": "Use a modern, minimal design with generous whitespace, clean sans-serif typography, and a muted color palette.",
  "corporate": "Use a professional corporate design with structured sections, a header bar, clear hierarchy, and a navy/blue color scheme.",
  "creative": "Use a bold, creative design with vibrant gradients, interesting layouts, decorative elements, and expressive typography.",
  "technical-docs": "Use a technical documentation style with a table of contents sidebar, code-friendly monospace sections, and a light neutral theme.",
};

const SYSTEM_PROMPT = `You are a web page generator. Given content, generate a complete, self-contained HTML page.

Rules:
- Output ONLY valid HTML (<!DOCTYPE html> to </html>). No markdown, no explanation.
- All CSS must be inline in a <style> tag in <head>. No external stylesheets or CDN links.
- No external scripts, fonts, or resources. Everything self-contained.
- Use modern, semantic HTML5 elements.
- Make the page responsive (use media queries for mobile).
- Include proper meta viewport tag.
- Ensure accessibility: good contrast, alt texts, heading hierarchy.
- The design should be polished and production-ready.`;

export function WebpageExpandedView({ node, nodes, edges, onUpdateNode }: WebpageExpandedViewProps) {
  const { toast } = useToast();
  const [isRunning, setIsRunning] = useState(false);
  const [showSource, setShowSource] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const stylePreference = node.webpageStylePreference || "modern-minimal";
  const customInstructions = node.webpageInstructions || "";
  const htmlOutput = node.htmlOutput || "";

  const patch = useCallback(
    (updates: Partial<FlowNode>) => onUpdateNode(node.id, updates),
    [node.id, onUpdateNode],
  );

  // Gather context inputs
  const contextInputs = useMemo(() => {
    const parts: { label: string; content: string }[] = [];
    for (const edge of edges) {
      if (edge.toNodeId !== node.id) continue;
      const src = nodes.find((n) => n.id === edge.fromNodeId);
      if (!src) continue;
      const text = src.documentContent || src.content || src.snippet || "";
      if (text.trim()) {
        const role = edgeHasRole(edge, "user-prompt") ? "Layout" : "Content";
        parts.push({ label: src.label || "Input", content: text.trim(), role } as { label: string; content: string });
      }
    }
    return parts;
  }, [node.id, nodes, edges]);

  // ── Run: generate HTML ──
  const handleRun = useCallback(async () => {
    setIsRunning(true);
    patch({ webpageStatus: "running", webpageError: undefined });

    try {
      const controller = new AbortController();
      abortRef.current = controller;

      // Build content
      const contentParts: string[] = [];
      for (const edge of edges) {
        if (edge.toNodeId !== node.id) continue;
        const src = nodes.find((n) => n.id === edge.fromNodeId);
        if (!src) continue;
        const text = src.documentContent || src.content || src.snippet || "";
        if (text.trim()) {
          const roleLabel = edgeHasRole(edge, "user-prompt") ? "Layout instructions" : "Content";
          contentParts.push(`--- ${roleLabel}: ${src.label || "Input"} ---\n${text.trim()}`);
        }
      }

      const stylePrompt = STYLE_PROMPTS[stylePreference] || STYLE_PROMPTS["modern-minimal"];
      const system = [
        SYSTEM_PROMPT,
        stylePrompt,
        customInstructions ? `Additional instructions: ${customInstructions}` : "",
      ].filter(Boolean).join("\n\n");

      const userMessage = contentParts.join("\n\n") || "Generate a sample webpage with placeholder content.";

      const body = {
        model: "gemini-2.5-flash",
        system,
        userMessage,
        temperature: 0.7,
        topP: 0.95,
        topK: 0,
        maxTokens: 16384,
        safetyLevel: "none",
        enableSearch: false,
      };

      const res = await apiRequest("POST", "/api/llm-base/generate", body);
      const data = (await res.json()) as { output: string };
      let html = data.output || "";

      // Strip markdown code fences if the model wrapped output
      html = html.replace(/^```html?\s*\n?/i, "").replace(/\n?```\s*$/i, "");

      patch({ htmlOutput: html, webpageStatus: "done", webpageError: undefined });
      toast({ title: "Webpage generated", description: "HTML page ready for preview." });
    } catch (err: unknown) {
      if ((err as Error).name === "AbortError") return;
      const msg = err instanceof Error ? err.message : "Generation failed";
      patch({ webpageStatus: "error", webpageError: msg });
      toast({ title: "Generation failed", description: msg, variant: "destructive" });
    } finally {
      setIsRunning(false);
      abortRef.current = null;
    }
  }, [node, nodes, edges, stylePreference, customInstructions, patch, toast]);

  const handleStop = useCallback(() => {
    abortRef.current?.abort();
    setIsRunning(false);
    patch({ webpageStatus: "idle" });
  }, [patch]);

  // ── Download as .html ──
  const handleDownload = useCallback(() => {
    if (!htmlOutput) return;
    const blob = new Blob([htmlOutput], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${node.label || "webpage"}.html`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Downloaded", description: `${a.download} saved.` });
  }, [htmlOutput, node.label, toast]);

  // ── Copy HTML to clipboard ──
  const handleCopy = useCallback(() => {
    if (!htmlOutput) return;
    navigator.clipboard.writeText(htmlOutput);
    toast({ title: "Copied", description: "HTML copied to clipboard." });
  }, [htmlOutput, toast]);

  // ── LlmHoverButton preview data ──
  const contextChars = contextInputs.reduce((s, c) => s + c.content.length, 0);
  const webpagePreviewBlocks = useMemo<ContextBlock[]>(() => [
    { label: "System Prompt", chars: SYSTEM_PROMPT.length + (STYLE_PROMPTS[stylePreference]?.length ?? 0), color: "text-blue-400" },
    { label: "Context Inputs", chars: contextChars, color: "text-amber-400" },
    { label: "Custom Instructions", chars: customInstructions.length, color: "text-emerald-400" },
  ], [stylePreference, contextChars, customInstructions.length]);

  const webpagePreviewSummary = useMemo<SummaryItem[]>(() => [
    { icon: <Layers className="w-3 h-3 text-amber-400" />, label: "Context Inputs", count: contextInputs.length, detail: `${contextChars.toLocaleString()} chars` },
    { icon: <Settings2 className="w-3 h-3 text-blue-400" />, label: "Style", count: 1, detail: stylePreference },
    { icon: <FileText className="w-3 h-3 text-emerald-400" />, label: "Custom Instructions", count: customInstructions.trim() ? 1 : 0, detail: customInstructions.slice(0, 60) || "none" },
  ], [contextInputs.length, contextChars, stylePreference, customInstructions]);

  // ── Header actions portal ──
  const headerActions = document.getElementById("expanded-header-actions");

  return (
    <div className="flex h-full">
      {/* Left panel: settings */}
      <div className="w-80 shrink-0 border-r border-border/50 flex flex-col overflow-y-auto p-4 gap-4">
        {/* Context inputs */}
        {contextInputs.length > 0 && (
          <ConnectedInputTabs inputs={contextInputs} sectionLabel="Context" />
        )}

        {/* Style preference */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Style
          </label>
          <Select
            value={stylePreference}
            onValueChange={(v) => patch({ webpageStylePreference: v as FlowNode["webpageStylePreference"] })}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STYLE_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value} className="text-xs">
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Custom instructions */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Custom Instructions
          </label>
          <ProvokeText
            variant="textarea"
            chrome="container"
            value={customInstructions}
            onChange={(val) => patch({ webpageInstructions: val })}
            placeholder="Additional styling or layout guidance..."
            className="text-xs"
            minRows={3}
          />
        </div>

        {/* Input summary */}
        <div className="text-[10px] text-muted-foreground/60 mt-auto pt-4 border-t border-border/30">
          {contextInputs.length} input{contextInputs.length !== 1 ? "s" : ""} connected
          {htmlOutput && ` · ${(htmlOutput.length / 1024).toFixed(1)}KB HTML`}
        </div>
      </div>

      {/* Right panel: preview */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Toolbar */}
        <div className="flex items-center gap-2 px-4 py-2 border-b border-border/30 shrink-0">
          <Button
            variant={showSource ? "outline" : "default"}
            size="sm"
            className="h-7 text-xs gap-1"
            onClick={() => setShowSource(false)}
            disabled={!htmlOutput}
          >
            <Eye className="w-3 h-3" />
            Preview
          </Button>
          <Button
            variant={showSource ? "default" : "outline"}
            size="sm"
            className="h-7 text-xs gap-1"
            onClick={() => setShowSource(true)}
            disabled={!htmlOutput}
          >
            <Code className="w-3 h-3" />
            Source
          </Button>
          <div className="flex-1" />
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs gap-1"
            onClick={handleCopy}
            disabled={!htmlOutput}
          >
            <Copy className="w-3 h-3" />
            Copy
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs gap-1"
            onClick={handleDownload}
            disabled={!htmlOutput}
          >
            <Download className="w-3 h-3" />
            Download
          </Button>
        </div>

        {/* Preview / source area */}
        <div className="flex-1 relative overflow-hidden">
          {htmlOutput ? (
            showSource ? (
              <pre className="absolute inset-0 p-4 overflow-auto text-xs text-foreground/80 font-mono whitespace-pre-wrap bg-muted/20">
                {htmlOutput}
              </pre>
            ) : (
              <iframe
                srcDoc={htmlOutput}
                sandbox="allow-scripts"
                className="absolute inset-0 w-full h-full border-0 bg-white"
                title="Webpage preview"
              />
            )
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center space-y-3">
                <Globe className="w-12 h-12 text-blue-500/30 mx-auto" />
                <p className="text-sm text-muted-foreground/60">
                  {isRunning ? "Generating webpage…" : "Connect content and click Run to generate a styled webpage"}
                </p>
              </div>
            </div>
          )}

          {/* Running overlay */}
          {isRunning && (
            <div className="absolute inset-0 bg-background/60 flex items-center justify-center backdrop-blur-sm">
              <div className="flex items-center gap-3 text-blue-400">
                <Loader2 className="w-6 h-6 animate-spin" />
                <span className="text-sm font-medium">Generating HTML…</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Header actions portal: Run/Stop button — wrapped with LlmHoverButton for ADR #2 */}
      {headerActions && createPortal(
        isRunning ? (
          <Button variant="destructive" size="sm" className="h-7 text-xs gap-1" onClick={handleStop}>
            <Square className="w-3 h-3" /> Stop
          </Button>
        ) : (
          <LlmHoverButton
            previewTitle="Generate Webpage"
            previewBlocks={webpagePreviewBlocks}
            previewSummary={webpagePreviewSummary}
            side="bottom"
            align="end"
          >
            <Button
              size="sm"
              className="h-7 text-xs gap-1 bg-blue-600 hover:bg-blue-700"
              onClick={handleRun}
              disabled={contextInputs.length === 0}
            >
              <Play className="w-3 h-3" /> Run
            </Button>
          </LlmHoverButton>
        ),
        headerActions,
      )}
    </div>
  );
}

// ── Reusable collapsible input tabs (copied from LlmBaseExpandedView) ──

function ConnectedInputTabs({
  inputs,
  sectionLabel,
}: {
  inputs: { label: string; content: string }[];
  sectionLabel: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState(0);

  return (
    <div className="rounded-md border border-amber-500/30 bg-amber-500/5 overflow-hidden">
      <button
        className="w-full flex items-center gap-1.5 px-3 py-1.5 text-left hover:bg-amber-500/10 transition-colors"
        onClick={() => setExpanded((v) => !v)}
      >
        {expanded ? (
          <ChevronDown className="w-3 h-3 text-amber-500 shrink-0" />
        ) : (
          <ChevronRight className="w-3 h-3 text-amber-500 shrink-0" />
        )}
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          {sectionLabel}
        </span>
        <span className="text-[9px] font-normal text-amber-500">
          ({inputs.length} connected)
        </span>
      </button>

      {expanded && (
        <div className="border-t border-amber-500/20">
          <div className="flex border-b border-amber-500/20 overflow-x-auto">
            {inputs.map((input, i) => (
              <button
                key={i}
                className={cn(
                  "shrink-0 px-3 py-1.5 text-[10px] font-medium transition-colors border-b-2",
                  activeTab === i
                    ? "border-amber-500 text-amber-500"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
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
