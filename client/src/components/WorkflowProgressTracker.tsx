import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Check,
  Circle,
  Loader2,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
} from "lucide-react";
import type { Workflow, WorkflowStep } from "@/lib/workflows";

interface WorkflowProgressTrackerProps {
  workflow: Workflow;
  currentStepIndex: number;
  completedSteps: Set<string>;
  onStepClick: (index: number) => void;
  onNext: () => void;
  onPrevious: () => void;
  onReset: () => void;
  isStepProcessing?: boolean;
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
}: WorkflowProgressTrackerProps) {
  const totalSteps = workflow.steps.length;
  const completedCount = completedSteps.size;
  const progressPercent = totalSteps > 0 ? Math.round((completedCount / totalSteps) * 100) : 0;

  return (
    <div className="border-b bg-card px-4 py-3">
      {/* Top row: workflow name + navigation */}
      <div className="flex items-center gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold truncate">{workflow.title}</h2>
            <Badge variant="outline" className="text-[10px] h-4 px-1.5 shrink-0">
              {completedCount}/{totalSteps}
            </Badge>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={onPrevious}
                disabled={currentStepIndex === 0}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Previous step</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={onNext}
                disabled={currentStepIndex >= totalSteps - 1}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Next step</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground"
                onClick={onReset}
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Start over</TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* Progress bar */}
      <div className="relative mb-3">
        <div className="h-1 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-primary transition-all duration-500 ease-out"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Step indicators */}
      <div className="flex items-center gap-1">
        {workflow.steps.map((step, index) => {
          const isCompleted = completedSteps.has(step.id);
          const isCurrent = index === currentStepIndex;
          const isAccessible = index <= currentStepIndex || isCompleted;

          return (
            <Tooltip key={step.id}>
              <TooltipTrigger asChild>
                <button
                  className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-xs transition-all
                    ${isCurrent
                      ? "bg-primary/10 text-primary font-medium"
                      : isCompleted
                        ? "text-primary/70 hover:bg-primary/5"
                        : isAccessible
                          ? "text-muted-foreground hover:bg-muted/60"
                          : "text-muted-foreground/40 cursor-not-allowed"
                    }`}
                  onClick={() => isAccessible && onStepClick(index)}
                  disabled={!isAccessible}
                >
                  <StepIndicator
                    isCompleted={isCompleted}
                    isCurrent={isCurrent}
                    isProcessing={isCurrent && isStepProcessing}
                    stepNumber={index + 1}
                  />
                  <span className="hidden sm:inline truncate max-w-[100px]">
                    {step.title}
                  </span>
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-[220px]">
                <p className="text-xs font-medium">{step.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{step.description}</p>
                {step.optional && (
                  <p className="text-[10px] text-muted-foreground/60 mt-1 italic">Optional step</p>
                )}
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </div>
  );
}

// ── Step Indicator ──

function StepIndicator({
  isCompleted,
  isCurrent,
  isProcessing,
  stepNumber,
}: {
  isCompleted: boolean;
  isCurrent: boolean;
  isProcessing?: boolean;
  stepNumber: number;
}) {
  if (isProcessing) {
    return <Loader2 className="w-4 h-4 animate-spin text-primary" />;
  }
  if (isCompleted) {
    return (
      <div className="w-4 h-4 rounded-full bg-primary flex items-center justify-center">
        <Check className="w-2.5 h-2.5 text-primary-foreground" />
      </div>
    );
  }
  if (isCurrent) {
    return (
      <div className="w-4 h-4 rounded-full border-2 border-primary flex items-center justify-center">
        <div className="w-1.5 h-1.5 rounded-full bg-primary" />
      </div>
    );
  }
  return (
    <div className="w-4 h-4 rounded-full border border-muted-foreground/30 flex items-center justify-center">
      <span className="text-[9px] text-muted-foreground/50">{stepNumber}</span>
    </div>
  );
}
