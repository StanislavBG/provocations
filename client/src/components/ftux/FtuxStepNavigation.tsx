import { useFtuxShell } from "@/lib/ftux-shell-context";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";

const STEP_LABELS = ["Gather", "Workshop", "Build"];

export function FtuxStepNavigation() {
  const { activeWorkflow, nextStep, prevStep, exitWorkflow } = useFtuxShell();

  if (!activeWorkflow) return null;

  const { currentStep } = activeWorkflow;
  const isFirst = currentStep === 0;
  const isLast = currentStep === 2;

  return (
    <nav
      className="relative z-50 flex items-center justify-center gap-3 py-3 px-4 border-t border-border/30 bg-card/50 backdrop-blur-sm shrink-0"
      aria-label="Step navigation"
    >
      <Button
        variant="outline"
        size="sm"
        aria-label={`Back to ${STEP_LABELS[currentStep - 1] ?? "previous"} step`}
        className="text-xs gap-1.5"
        onClick={prevStep}
        disabled={isFirst}
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Back
      </Button>

      <div className="flex items-center gap-1.5" role="group" aria-label={`Step ${currentStep + 1} of ${STEP_LABELS.length}`}>
        {STEP_LABELS.map((label, i) => (
          <div
            key={label}
            role="img"
            aria-label={`${label}${i === currentStep ? " (current)" : i < currentStep ? " (completed)" : ""}`}
            className={`w-2 h-2 rounded-full transition-colors ${
              i === currentStep
                ? "bg-primary"
                : i < currentStep
                  ? "bg-primary/40"
                  : "bg-muted-foreground/20"
            }`}
          />
        ))}
      </div>

      {isLast ? (
        <Button
          variant="default"
          size="sm"
          aria-label="Finish workflow"
          className="text-xs gap-1.5"
          onClick={exitWorkflow}
        >
          <Check className="w-3.5 h-3.5" />
          Finish
        </Button>
      ) : (
        <Button
          variant="default"
          size="sm"
          aria-label={`Next: ${STEP_LABELS[currentStep + 1] ?? "next"} step`}
          className="text-xs gap-1.5"
          onClick={nextStep}
        >
          Next
          <ArrowRight className="w-3.5 h-3.5" />
        </Button>
      )}
    </nav>
  );
}
