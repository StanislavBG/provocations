/**
 * CoherenceGateExpandedView — Full expanded panel for the Coherence Gate node.
 *
 * Shows configuration (threshold, checks, custom prompt, retry settings)
 * on the left, and a visual score display + evaluation history on the right.
 */

import { useCallback, useMemo, useState } from "react";
import { ShieldCheck, AlertTriangle, CheckCircle, XCircle, Play, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { FlowNode, FlowEdge } from "../useFlowCanvas";
import { ExpandedViewLayout } from "./ExpandedViewLayout";

interface CoherenceGateExpandedViewProps {
  node: FlowNode;
  nodes: FlowNode[];
  edges: FlowEdge[];
  onUpdateNode: (nodeId: string, patch: Partial<FlowNode>) => void;
  onPlayNode?: (nodeId: string) => void;
}

const STRICTNESS_PRESETS = [
  { id: "loose" as const, label: "Loose", threshold: 50, color: "text-yellow-500 border-yellow-500 bg-yellow-500/10" },
  { id: "medium" as const, label: "Medium", threshold: 75, color: "text-amber-500 border-amber-500 bg-amber-500/10" },
  { id: "strict" as const, label: "Strict", threshold: 90, color: "text-red-500 border-red-500 bg-red-500/10" },
];

const CHECK_OPTIONS = [
  { key: "topicMatch" as const, label: "Topic Match", desc: "Does the output stay on topic?" },
  { key: "toneConsistency" as const, label: "Tone Consistency", desc: "Is the tone consistent throughout?" },
  { key: "factDrift" as const, label: "Fact Drift", desc: "Has the content drifted from source facts?" },
  { key: "styleMatch" as const, label: "Style Match", desc: "Does the style match the expected format?" },
];

export function CoherenceGateExpandedView({
  node,
  nodes,
  edges,
  onUpdateNode,
  onPlayNode,
}: CoherenceGateExpandedViewProps) {
  const [testRunning, setTestRunning] = useState(false);
  const [testResult, setTestResult] = useState<{
    score: number;
    verdict: string;
    reasoning: string;
    breakdown?: Record<string, number>;
  } | null>(null);

  const threshold = node.coherenceThreshold ?? 75;
  const checks = node.coherenceChecks ?? {
    topicMatch: true,
    toneConsistency: true,
    factDrift: false,
    styleMatch: false,
  };
  const strictness = node.coherenceStrictness ?? "medium";
  const retryCount = node.coherenceRetryCount ?? 1;
  const lastScore = node.coherenceLastScore;
  const lastVerdict = node.coherenceLastVerdict;
  const failCount = node.coherenceFailCount ?? 0;

  // Connected inputs
  const inputNodes = useMemo(() => {
    const inputEdges = edges.filter((e) => e.toNodeId === node.id);
    return inputEdges
      .map((e) => nodes.find((n) => n.id === e.fromNodeId))
      .filter(Boolean) as FlowNode[];
  }, [node.id, nodes, edges]);

  const outputNodes = useMemo(() => {
    const outputEdges = edges.filter((e) => e.fromNodeId === node.id);
    return outputEdges
      .map((e) => nodes.find((n) => n.id === e.toNodeId))
      .filter(Boolean) as FlowNode[];
  }, [node.id, nodes, edges]);

  const updateCheck = useCallback(
    (key: keyof typeof checks, value: boolean) => {
      onUpdateNode(node.id, {
        coherenceChecks: { ...checks, [key]: value },
      });
    },
    [node.id, checks, onUpdateNode],
  );

  const handleStrictnessPreset = useCallback(
    (preset: (typeof STRICTNESS_PRESETS)[number]) => {
      onUpdateNode(node.id, {
        coherenceStrictness: preset.id,
        coherenceThreshold: preset.threshold,
      });
    },
    [node.id, onUpdateNode],
  );

  // Test eval against current input content
  const handleTestEval = useCallback(async () => {
    const inputContent = inputNodes
      .map((n) => n.documentContent || n.content || n.llmOutput || n.snippet || "")
      .filter((s) => s.trim())
      .join("\n\n---\n\n");

    if (!inputContent.trim()) {
      setTestResult({ score: 0, verdict: "fail", reasoning: "No input content available for evaluation" });
      return;
    }

    setTestRunning(true);
    try {
      const res = await fetch("/api/flow/coherence-eval", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: inputContent,
          originalContext: node.coherencePrompt || "",
          checks,
          customPrompt: node.coherencePrompt,
          threshold,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const result = await res.json();
      setTestResult(result);
      onUpdateNode(node.id, {
        coherenceLastScore: result.score,
        coherenceLastVerdict: result.verdict,
      });
    } catch (err) {
      setTestResult({ score: 0, verdict: "error", reasoning: String(err) });
    } finally {
      setTestRunning(false);
    }
  }, [inputNodes, node.id, node.coherencePrompt, checks, threshold, onUpdateNode]);

  const scoreColor =
    lastScore == null
      ? "text-muted-foreground"
      : lastScore >= threshold
        ? "text-emerald-500"
        : lastScore >= threshold * 0.8
          ? "text-amber-500"
          : "text-red-500";

  const scoreBg =
    lastScore == null
      ? "bg-muted/30"
      : lastScore >= threshold
        ? "bg-emerald-500/10"
        : lastScore >= threshold * 0.8
          ? "bg-amber-500/10"
          : "bg-red-500/10";

  return (
    <ExpandedViewLayout
      defaultLeftSize={35}
      left={
        <div className="flex flex-col h-full">
        <ScrollArea className="flex-1">
          <div className="p-4 space-y-4">
            {/* Label */}
            <div className="space-y-1.5">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Label</p>
              <input
                type="text"
                value={node.label || ""}
                onChange={(e) => onUpdateNode(node.id, { label: e.target.value })}
                className="w-full px-3 py-2 text-sm bg-muted/30 border rounded-lg outline-none focus:ring-1 focus:ring-emerald-500/50"
              />
            </div>

            {/* Strictness presets */}
            <div className="space-y-1.5">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Strictness</p>
              <div className="flex gap-1.5">
                {STRICTNESS_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    onClick={() => handleStrictnessPreset(preset)}
                    className={`flex-1 px-2 py-1.5 rounded-md border text-[11px] font-medium transition-colors ${
                      strictness === preset.id
                        ? preset.color
                        : "border-border/50 text-muted-foreground hover:bg-muted/50"
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Threshold slider */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Threshold</p>
                <span className="text-xs font-mono font-semibold">{threshold}%</span>
              </div>
              <input
                type="range"
                min={50}
                max={100}
                value={threshold}
                onChange={(e) =>
                  onUpdateNode(node.id, { coherenceThreshold: Number(e.target.value) })
                }
                className="w-full accent-emerald-500"
              />
              <div className="flex justify-between text-[9px] text-muted-foreground/60">
                <span>50%</span>
                <span>100%</span>
              </div>
            </div>

            {/* Evaluation checks */}
            <div className="space-y-1.5">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Checks</p>
              <div className="space-y-1">
                {CHECK_OPTIONS.map((opt) => (
                  <label
                    key={opt.key}
                    className="flex items-start gap-2 px-2 py-1.5 rounded hover:bg-muted/30 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={checks[opt.key] ?? false}
                      onChange={(e) => updateCheck(opt.key, e.target.checked)}
                      className="mt-0.5 accent-emerald-500"
                    />
                    <div>
                      <span className="text-xs font-medium">{opt.label}</span>
                      <p className="text-[10px] text-muted-foreground/60">{opt.desc}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Custom prompt */}
            <div className="space-y-1.5">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                Custom Eval Prompt
              </p>
              <textarea
                value={node.coherencePrompt || ""}
                onChange={(e) => onUpdateNode(node.id, { coherencePrompt: e.target.value })}
                placeholder="e.g., Does this paragraph align with the original query on climate models?"
                className="w-full bg-muted/30 border rounded-lg text-xs text-foreground placeholder:text-muted-foreground/50 resize-none outline-none px-3 py-2 min-h-[60px] leading-relaxed focus:ring-1 focus:ring-emerald-500/50"
                rows={3}
              />
            </div>

            {/* Retry count */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Retries</p>
                <span className="text-xs font-mono">{retryCount}</span>
              </div>
              <input
                type="range"
                min={0}
                max={5}
                value={retryCount}
                onChange={(e) =>
                  onUpdateNode(node.id, { coherenceRetryCount: Number(e.target.value) })
                }
                className="w-full accent-emerald-500"
              />
            </div>

            {/* Persistent fail logging */}
            <div className="space-y-1.5 border-t pt-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={node.coherenceLogOnPersistentFail ?? true}
                  onChange={(e) =>
                    onUpdateNode(node.id, { coherenceLogOnPersistentFail: e.target.checked })
                  }
                  className="accent-emerald-500"
                />
                <div>
                  <span className="text-xs font-medium">Log persistent failures</span>
                  <p className="text-[10px] text-muted-foreground/60">
                    After {node.coherencePersistentFailThreshold ?? 5} consecutive fails, emit drift warning
                  </p>
                </div>
              </label>
            </div>

            {/* Connections */}
            <div className="space-y-1.5 border-t pt-3">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Connections</p>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="outline" className="text-[10px]">
                  {inputNodes.length} inputs
                </Badge>
                <span>→</span>
                <Badge variant="outline" className="text-[10px]">
                  {outputNodes.length} outputs
                </Badge>
              </div>
            </div>
          </div>
        </ScrollArea>
        </div>
      }
      right={
        <div className="flex-1 flex flex-col min-w-0">
        <div className="px-4 py-2 border-b bg-muted/20 flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Coherence Score
          </h3>
          <div className="flex items-center gap-2">
            {onPlayNode && (
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs gap-1.5"
                onClick={() => onPlayNode(node.id)}
                disabled={testRunning}
              >
                {testRunning ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                Run Chain
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs gap-1.5 border-emerald-500/50 text-emerald-600 hover:bg-emerald-500/10"
              onClick={handleTestEval}
              disabled={testRunning || inputNodes.length === 0}
            >
              {testRunning ? <Loader2 className="w-3 h-3 animate-spin" /> : <ShieldCheck className="w-3 h-3" />}
              Test Eval
            </Button>
          </div>
        </div>

        <div className="flex-1 flex items-center justify-center p-6">
          <div className="text-center space-y-6">
            {/* Big score circle */}
            <div
              className={`w-32 h-32 rounded-full border-4 flex items-center justify-center mx-auto ${scoreBg} ${
                lastScore != null && lastScore >= threshold
                  ? "border-emerald-500"
                  : lastScore != null
                    ? "border-red-500"
                    : "border-muted-foreground/30"
              }`}
            >
              <div className="text-center">
                <span className={`text-3xl font-bold ${scoreColor}`}>
                  {lastScore != null ? `${lastScore}%` : "—"}
                </span>
                {lastVerdict && (
                  <div className="flex items-center justify-center gap-1 mt-1">
                    {lastVerdict === "pass" ? (
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                    ) : (
                      <XCircle className="w-3.5 h-3.5 text-red-500" />
                    )}
                    <span
                      className={`text-[10px] font-semibold uppercase ${
                        lastVerdict === "pass" ? "text-emerald-500" : "text-red-500"
                      }`}
                    >
                      {lastVerdict}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Strictness badge */}
            <Badge
              variant="outline"
              className={`text-[10px] ${
                strictness === "strict"
                  ? "border-red-500 text-red-500"
                  : strictness === "medium"
                    ? "border-amber-500 text-amber-500"
                    : "border-yellow-500 text-yellow-500"
              }`}
            >
              {strictness.toUpperCase()} — {threshold}% threshold
            </Badge>

            {/* Fail count warning */}
            {failCount > 0 && (
              <div className="flex items-center justify-center gap-1.5 text-xs text-amber-500">
                <AlertTriangle className="w-3.5 h-3.5" />
                {failCount} consecutive failure{failCount !== 1 ? "s" : ""}
                {failCount >= (node.coherencePersistentFailThreshold ?? 5) &&
                  " — Upstream drift likely"}
              </div>
            )}

            {/* Test result details */}
            {testResult && (
              <div className="max-w-md mx-auto text-left space-y-2 border rounded-lg p-3 bg-muted/20">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Evaluation Result
                </p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {testResult.reasoning}
                </p>
                {testResult.breakdown && (
                  <div className="space-y-1 pt-1 border-t">
                    {Object.entries(testResult.breakdown).map(([key, score]) => (
                      <div key={key} className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">{key}</span>
                        <span
                          className={`font-mono font-semibold ${
                            score >= threshold ? "text-emerald-500" : "text-red-500"
                          }`}
                        >
                          {score}%
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Input/output flow */}
            <div className="flex items-center justify-center gap-6 pt-4">
              <div className="space-y-1">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider text-center">
                  Inputs
                </p>
                {inputNodes.map((n) => (
                  <div
                    key={n.id}
                    className="px-2 py-1 rounded border bg-card text-[10px] max-w-[140px] truncate"
                  >
                    {n.label}
                  </div>
                ))}
                {inputNodes.length === 0 && (
                  <p className="text-[10px] text-muted-foreground/50 italic">None</p>
                )}
              </div>
              <ShieldCheck className="w-8 h-8 text-emerald-500" />
              <div className="space-y-1">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider text-center">
                  Outputs
                </p>
                {outputNodes.map((n) => (
                  <div
                    key={n.id}
                    className="px-2 py-1 rounded border bg-card text-[10px] max-w-[140px] truncate"
                  >
                    {n.label}
                  </div>
                ))}
                {outputNodes.length === 0 && (
                  <p className="text-[10px] text-muted-foreground/50 italic">None</p>
                )}
              </div>
            </div>
          </div>
        </div>
        </div>
      }
    />
  );
}
