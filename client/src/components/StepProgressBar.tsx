import { Check } from "lucide-react";
import type { TemplateStep } from "@/lib/prebuiltTemplates";

interface StepProgressBarProps {
  steps: TemplateStep[];
  currentStep: number; // 0-based index
  onStepClick?: (index: number) => void;
}

export function StepProgressBar({ steps, currentStep, onStepClick }: StepProgressBarProps) {
  return (
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-0">
        {steps.map((step, index) => {
          const isCompleted = index < currentStep;
          const isActive = index === currentStep;
          const isLast = index === steps.length - 1;

          return (
            <div key={step.id} className={`flex items-center ${isLast ? "" : "flex-1"}`}>
              {/* Step indicator */}
              <button
                type="button"
                onClick={() => onStepClick?.(index)}
                disabled={!onStepClick}
                className={`flex items-center gap-2 shrink-0 transition-colors ${
                  onStepClick ? "cursor-pointer" : "cursor-default"
                }`}
              >
                <div
                  className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold transition-all duration-200 ${
                    isCompleted
                      ? "bg-primary text-primary-foreground"
                      : isActive
                        ? "bg-primary text-primary-foreground ring-2 ring-primary/30 ring-offset-2 ring-offset-background"
                        : "bg-muted text-muted-foreground"
                  }`}
                >
                  {isCompleted ? <Check className="w-3.5 h-3.5" /> : index + 1}
                </div>
                <span
                  className={`text-sm whitespace-nowrap ${
                    isActive
                      ? "font-semibold text-foreground"
                      : isCompleted
                        ? "font-medium text-foreground/70"
                        : "text-muted-foreground"
                  }`}
                >
                  {step.label}
                </span>
              </button>

              {/* Connector line */}
              {!isLast && (
                <div className="flex-1 mx-3">
                  <div
                    className={`h-0.5 w-full rounded-full transition-colors duration-200 ${
                      isCompleted ? "bg-primary" : "bg-border"
                    }`}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
