import { useMemo } from "react";
import { FlowProgress } from "bilko-flow/react";
import "bilko-flow/styles.css";
import type { FlowProgressStep } from "bilko-flow/react";
import type { Workflow } from "@/lib/workflows";

interface WorkflowProgressTrackerProps {
  workflow: Workflow;
  currentStepIndex: number;
  completedSteps: Set<string>;
  onStepClick: (index: number) => void;
  onNext: () => void;
  onPrevious: () => void;
  onReset: () => void;
  isStepProcessing?: boolean;
  /** Optional: pre-generated FlowProgressStep[] from the planner (overrides local step mapping) */
  plannerSteps?: FlowProgressStep[];
}

/**
 * Convert local workflow steps + runtime state into FlowProgressStep[] for bilko-flow's FlowProgress.
 */
function toFlowProgressSteps(
  workflow: Workflow,
  currentStepIndex: number,
  completedSteps: Set<string>,
  isStepProcessing?: boolean,
): FlowProgressStep[] {
  return workflow.steps.map((step, index) => {
    let status: FlowProgressStep["status"] = "pending";
    if (completedSteps.has(step.id)) {
      status = "complete";
    } else if (index === currentStepIndex) {
      status = isStepProcessing ? "active" : "active";
    }

    return {
      id: step.id,
      label: step.title,
      status,
      type: step.component,
      meta: {
        message: step.description,
      },
    };
  });
}

export function WorkflowProgressTracker({
  workflow,
  currentStepIndex,
  completedSteps,
  onStepClick,
  onNext,
  onPrevious,
  onReset,
  isStepProcessing,
  plannerSteps,
}: WorkflowProgressTrackerProps) {
  // Derive FlowProgressStep[] — prefer planner-generated steps if available
  const flowSteps = useMemo(() => {
    if (plannerSteps && plannerSteps.length > 0) {
      // Merge planner step definitions with runtime status
      return plannerSteps.map((step, index) => {
        let status = step.status;
        if (completedSteps.has(step.id)) {
          status = "complete";
        } else if (index === currentStepIndex) {
          status = "active";
        } else if (index > currentStepIndex && !completedSteps.has(step.id)) {
          status = "pending";
        }
        return { ...step, status };
      });
    }
    return toFlowProgressSteps(workflow, currentStepIndex, completedSteps, isStepProcessing);
  }, [workflow, currentStepIndex, completedSteps, isStepProcessing, plannerSteps]);

  const overallStatus = useMemo(() => {
    const allComplete = flowSteps.every((s) => s.status === "complete");
    const hasError = flowSteps.some((s) => s.status === "error");
    if (hasError) return "error" as const;
    if (allComplete) return "complete" as const;
    if (flowSteps.some((s) => s.status === "active")) return "running" as const;
    return "idle" as const;
  }, [flowSteps]);

  // Map step click from FlowProgress (uses step id) to index-based callback
  const handleStepClick = (stepId: string) => {
    const index = flowSteps.findIndex((s) => s.id === stepId);
    if (index >= 0) onStepClick(index);
  };

  return (
    <div className="border-b bg-card px-4 py-3">
      <FlowProgress
        mode="auto"
        steps={flowSteps}
        label={workflow.title}
        status={overallStatus}
        onStepClick={handleStepClick}
        onReset={onReset}
        activity={isStepProcessing ? "Processing..." : undefined}
        theme={{
          stepColors: {
            "text-input": "bg-blue-500",
            "persona-select": "bg-violet-500",
            interview: "bg-amber-500",
            "document-review": "bg-emerald-500",
            capture: "bg-cyan-500",
            export: "bg-slate-500",
            llm: "bg-purple-500",
            "user-input": "bg-blue-500",
            transform: "bg-orange-500",
            validate: "bg-teal-500",
            display: "bg-indigo-500",
            "external-input": "bg-pink-500",
          },
          activeColor: "bg-primary",
          completedColor: "bg-primary",
          errorColor: "bg-destructive",
          pendingColor: "bg-muted",
          skippedColor: "bg-gray-500",
          activeTextColor: "text-primary",
          completedTextColor: "text-primary/70",
          errorTextColor: "text-destructive",
          pendingTextColor: "text-muted-foreground",
          skippedTextColor: "text-gray-400",
        }}
      />
    </div>
  );
}
