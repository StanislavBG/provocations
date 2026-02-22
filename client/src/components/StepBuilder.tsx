/**
 * StepBuilder — left panel for agent editor.
 *
 * Shows ordered list of agent steps with add/remove/reorder,
 * agent persona summary, and token counter summary.
 */

import { useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  ArrowRight,
  CircleDot,
} from "lucide-react";
import type { AgentStep } from "@shared/schema";
import { estimateTokens, TokenSummary } from "./TokenCounter";

interface StepBuilderProps {
  steps: AgentStep[];
  onStepsChange: (steps: AgentStep[]) => void;
  selectedStepId: string | null;
  onSelectStep: (stepId: string | null) => void;
  persona: string;
  agentName: string;
}

const SOURCE_LABELS: Record<string, string> = {
  user: "User Input",
  "previous-step": "Prev Step",
  context: "Context",
};

const DATA_TYPE_COLORS: Record<string, string> = {
  text: "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400",
  json: "bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400",
  table: "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400",
  markdown: "bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400",
};

function makeDefaultStep(order: number): AgentStep {
  return {
    id: `step-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name: `Step ${order}`,
    order,
    input: {
      source: order === 1 ? "user" : "previous-step",
      description: "",
      dataType: "text",
    },
    actor: {
      systemPrompt: "",
      maxTokens: 2000,
      temperature: 0.7,
    },
    output: {
      label: "",
      description: "",
      dataType: "text",
    },
  };
}

export default function StepBuilder({
  steps,
  onStepsChange,
  selectedStepId,
  onSelectStep,
  persona,
  agentName,
}: StepBuilderProps) {
  const addStep = useCallback(() => {
    const newStep = makeDefaultStep(steps.length + 1);
    onStepsChange([...steps, newStep]);
    onSelectStep(newStep.id);
  }, [steps, onStepsChange, onSelectStep]);

  const removeStep = useCallback(
    (stepId: string) => {
      const filtered = steps.filter((s) => s.id !== stepId);
      // Re-order remaining steps
      const reordered = filtered.map((s, i) => ({ ...s, order: i + 1 }));
      onStepsChange(reordered);
      if (selectedStepId === stepId) {
        onSelectStep(reordered.length > 0 ? reordered[0].id : null);
      }
    },
    [steps, onStepsChange, selectedStepId, onSelectStep],
  );

  const moveStep = useCallback(
    (stepId: string, direction: "up" | "down") => {
      const idx = steps.findIndex((s) => s.id === stepId);
      if (idx < 0) return;
      if (direction === "up" && idx === 0) return;
      if (direction === "down" && idx === steps.length - 1) return;

      const newSteps = [...steps];
      const swapIdx = direction === "up" ? idx - 1 : idx + 1;
      [newSteps[idx], newSteps[swapIdx]] = [newSteps[swapIdx], newSteps[idx]];
      // Re-order
      const reordered = newSteps.map((s, i) => ({ ...s, order: i + 1 }));
      onStepsChange(reordered);
    },
    [steps, onStepsChange],
  );

  // Compute token estimates for each step
  const stepTokens = steps.map((s) => ({
    name: s.name || `Step ${s.order}`,
    tokens: estimateTokens(s.actor.systemPrompt) + estimateTokens(persona),
  }));

  return (
    <div className="flex flex-col h-full">
      {/* Agent summary header */}
      <div className="p-3 border-b border-border">
        <button
          onClick={() => onSelectStep(null)}
          className={`w-full text-left p-2 rounded-md transition-colors ${
            selectedStepId === null
              ? "bg-primary/10 ring-1 ring-primary/30"
              : "hover:bg-muted/60"
          }`}
        >
          <div className="text-sm font-semibold truncate">
            {agentName || "Untitled Agent"}
          </div>
          <div className="text-[11px] text-muted-foreground truncate mt-0.5">
            {persona ? `${persona.slice(0, 60)}...` : "No persona defined — click to configure"}
          </div>
        </button>
      </div>

      {/* Step list */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {steps.map((step, idx) => {
          const isSelected = selectedStepId === step.id;
          return (
            <div
              key={step.id}
              className={`group rounded-md border transition-all ${
                isSelected
                  ? "border-primary/40 bg-primary/5 ring-1 ring-primary/20"
                  : "border-transparent hover:border-border hover:bg-muted/40"
              }`}
            >
              <button
                onClick={() => onSelectStep(step.id)}
                className="w-full text-left p-2.5"
              >
                <div className="flex items-center gap-2">
                  <CircleDot className="w-3.5 h-3.5 text-primary shrink-0" />
                  <span className="text-sm font-medium truncate flex-1">
                    {step.name || `Step ${step.order}`}
                  </span>
                  <span className="text-[10px] text-muted-foreground font-mono">
                    #{step.order}
                  </span>
                </div>

                {/* Input → Output badges */}
                <div className="flex items-center gap-1 mt-1.5 ml-5">
                  <Badge variant="outline" className="text-[9px] h-4">
                    {SOURCE_LABELS[step.input.source] ?? step.input.source}
                  </Badge>
                  <ArrowRight className="w-3 h-3 text-muted-foreground shrink-0" />
                  {step.output.label ? (
                    <Badge
                      variant="outline"
                      className={`text-[9px] h-4 ${DATA_TYPE_COLORS[step.output.dataType] ?? ""}`}
                    >
                      {step.output.label} ({step.output.dataType})
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[9px] h-4 text-muted-foreground">
                      output ({step.output.dataType})
                    </Badge>
                  )}
                </div>
              </button>

              {/* Action buttons — visible on hover or when selected */}
              <div
                className={`flex items-center gap-1 px-2 pb-2 ${
                  isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                } transition-opacity`}
              >
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 w-6 p-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    moveStep(step.id, "up");
                  }}
                  disabled={idx === 0}
                >
                  <ChevronUp className="w-3 h-3" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 w-6 p-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    moveStep(step.id, "down");
                  }}
                  disabled={idx === steps.length - 1}
                >
                  <ChevronDown className="w-3 h-3" />
                </Button>
                <div className="flex-1" />
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeStep(step.id);
                  }}
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            </div>
          );
        })}

        {/* Add step button */}
        <Button
          variant="outline"
          size="sm"
          className="w-full gap-1.5 mt-2 border-dashed"
          onClick={addStep}
        >
          <Plus className="w-3.5 h-3.5" />
          Add Step
        </Button>
      </div>

      {/* Token summary footer */}
      <div className="border-t border-border p-2">
        <TokenSummary stepTokens={stepTokens} />
      </div>
    </div>
  );
}
