/**
 * AgentRunner — right panel "Execution" tab for agent editor.
 *
 * Provides:
 * - Initial input textarea
 * - "Run Agent" button
 * - Step-by-step execution progress via SSE
 * - Collapsible results per step
 * - Final output display
 */

import { useState, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Play,
  Loader2,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronRight,
  Clock,
} from "lucide-react";
import { ProvokeText } from "./ProvokeText";
import type { AgentStep } from "@shared/schema";

interface StepResult {
  stepId: string;
  stepName: string;
  output: string;
  durationMs: number;
  validationPassed: boolean;
  error?: string;
}

type StepStatus = "pending" | "running" | "complete" | "error";

interface AgentRunnerProps {
  steps: AgentStep[];
  agentId?: string;
  persona: string;
}

export default function AgentRunner({
  steps,
  agentId,
  persona,
}: AgentRunnerProps) {
  const [input, setInput] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [stepStatuses, setStepStatuses] = useState<Record<string, StepStatus>>({});
  const [stepResults, setStepResults] = useState<Record<string, StepResult>>({});
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set());
  const [finalOutput, setFinalOutput] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const toggleExpand = useCallback((stepId: string) => {
    setExpandedSteps((prev) => {
      const next = new Set(prev);
      if (next.has(stepId)) next.delete(stepId);
      else next.add(stepId);
      return next;
    });
  }, []);

  const runAgent = useCallback(async () => {
    if (!input.trim() || steps.length === 0) return;

    setIsRunning(true);
    setError(null);
    setFinalOutput(null);
    setStepResults({});
    setExpandedSteps(new Set());

    // Initialize all steps as pending
    const initialStatuses: Record<string, StepStatus> = {};
    for (const step of steps) {
      initialStatuses[step.id] = "pending";
    }
    setStepStatuses(initialStatuses);

    // If we have a saved agentId, use the streaming endpoint
    if (agentId) {
      try {
        abortRef.current = new AbortController();
        const res = await fetch(`/api/agents/${agentId}/execute/stream`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ input: input.trim() }),
          signal: abortRef.current.signal,
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({ error: "Execution failed" }));
          throw new Error(errData.error || "Execution failed");
        }

        const reader = res.body?.getReader();
        if (!reader) throw new Error("No response body");

        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const data = line.slice(6).trim();
            if (data === "[DONE]") continue;

            try {
              const event = JSON.parse(data);
              if (event.type === "step-start") {
                setStepStatuses((prev) => ({ ...prev, [event.stepId]: "running" }));
              } else if (event.type === "step-complete") {
                setStepStatuses((prev) => ({ ...prev, [event.stepId]: "complete" }));
                setStepResults((prev) => ({
                  ...prev,
                  [event.stepId]: event.result,
                }));
                setExpandedSteps((prev) => new Set([...Array.from(prev), event.stepId]));
              } else if (event.type === "step-error") {
                setStepStatuses((prev) => ({ ...prev, [event.stepId]: "error" }));
                setStepResults((prev) => ({
                  ...prev,
                  [event.stepId]: { ...event.result, error: event.error },
                }));
              } else if (event.type === "execution-complete") {
                setFinalOutput(event.finalOutput);
              }
            } catch {
              // skip malformed SSE events
            }
          }
        }
      } catch (err: any) {
        if (err.name !== "AbortError") {
          setError(err.message || "Execution failed");
        }
      }
    } else {
      // No saved agentId — run inline via non-streaming endpoint
      try {
        const res = await fetch("/api/agents/execute-inline", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            persona,
            steps: steps.map((s) => ({
              id: s.id,
              name: s.name,
              order: s.order,
              input: s.input,
              actor: s.actor,
              output: s.output,
            })),
            input: input.trim(),
          }),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({ error: "Execution failed" }));
          throw new Error(errData.error || "Execution failed");
        }

        const result = await res.json();

        // Process results
        for (const sr of result.steps) {
          setStepStatuses((prev) => ({
            ...prev,
            [sr.stepId]: sr.validationPassed ? "complete" : "error",
          }));
          setStepResults((prev) => ({
            ...prev,
            [sr.stepId]: sr,
          }));
          setExpandedSteps((prev) => new Set([...Array.from(prev), sr.stepId]));
        }
        setFinalOutput(result.finalOutput);
      } catch (err: any) {
        setError(err.message || "Execution failed");
      }
    }

    setIsRunning(false);
  }, [input, steps, agentId, persona]);

  const statusIcon = (status: StepStatus) => {
    switch (status) {
      case "pending":
        return <Clock className="w-3.5 h-3.5 text-muted-foreground" />;
      case "running":
        return <Loader2 className="w-3.5 h-3.5 text-blue-500 animate-spin" />;
      case "complete":
        return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />;
      case "error":
        return <XCircle className="w-3.5 h-3.5 text-red-500" />;
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Input area */}
      <div className="p-3 border-b border-border">
        <ProvokeText
          value={input}
          onChange={setInput}
          placeholder="Enter the initial input for this agent..."
          chrome="container"
          variant="textarea"
          label="Initial Input"
          showCopy
          showClear
          minRows={3}
          maxRows={8}
          readOnly={isRunning}
        />
        <Button
          onClick={runAgent}
          disabled={isRunning || !input.trim() || steps.length === 0}
          className="w-full mt-2 gap-2"
          size="sm"
        >
          {isRunning ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Running...
            </>
          ) : (
            <>
              <Play className="w-4 h-4" />
              Run Agent
            </>
          )}
        </Button>
      </div>

      {/* Error display */}
      {error && (
        <div className="mx-3 mt-3 p-2 rounded-md bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-xs text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Step results */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {steps.map((step) => {
          const status = stepStatuses[step.id] ?? "pending";
          const result = stepResults[step.id];
          const isExpanded = expandedSteps.has(step.id);

          return (
            <div
              key={step.id}
              className="rounded-md border border-border overflow-hidden"
            >
              <button
                onClick={() => result && toggleExpand(step.id)}
                className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-muted/40 transition-colors"
                disabled={!result}
              >
                {statusIcon(status)}
                <span className="text-sm font-medium flex-1 truncate">
                  {step.name || `Step ${step.order}`}
                </span>
                {result && (
                  <Badge variant="outline" className="text-[9px]">
                    {result.durationMs}ms
                  </Badge>
                )}
                {result &&
                  (isExpanded ? (
                    <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                  ))}
              </button>

              {isExpanded && result && (
                <div className="px-3 pb-3 border-t border-border">
                  {result.error && (
                    <div className="text-xs text-red-600 dark:text-red-400 mb-2 mt-2">
                      {result.error}
                    </div>
                  )}
                  <ProvokeText
                    value={result.output}
                    onChange={() => {}}
                    readOnly
                    chrome="bare"
                    variant="textarea"
                    showCopy
                    showClear={false}
                    minRows={2}
                    maxRows={10}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Final output */}
      {finalOutput && (
        <div className="border-t border-border p-3">
          <div className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 mb-1">
            Final Output
          </div>
          <ProvokeText
            value={finalOutput}
            onChange={() => {}}
            readOnly
            chrome="container"
            variant="textarea"
            label="Result"
            showCopy
            showClear={false}
            minRows={3}
            maxRows={15}
          />
        </div>
      )}
    </div>
  );
}
