import { Check, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useFtuxShell } from "@/lib/ftux-shell-context";
import type { FlowStepConfig } from "@/lib/appWorkspaceConfig";

interface FtuxBreadcrumbStepperProps {
  steps: FlowStepConfig[];
}

export function FtuxBreadcrumbStepper({ steps }: FtuxBreadcrumbStepperProps) {
  const { activeStep, setActiveStep } = useFtuxShell();

  if (steps.length === 0) return null;

  return (
    <div className="flex items-center gap-1">
      {steps.map((step, index) => {
        const isCompleted = index < activeStep;
        const isCurrent = index === activeStep;
        const isFuture = index > activeStep;

        return (
          <div key={step.id} className="flex items-center gap-1">
            {index > 0 && (
              <ChevronRight className="w-3 h-3 text-muted-foreground/50 shrink-0" />
            )}
            <button
              onClick={() => setActiveStep(index)}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all",
                "hover:opacity-80 focus:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                isCurrent && "bg-primary text-primary-foreground shadow-sm",
                isCompleted && "bg-primary/15 text-primary",
                isFuture && "bg-muted/50 text-muted-foreground border border-border/50",
              )}
              title={step.description}
            >
              {isCompleted && <Check className="w-3 h-3" />}
              <span className="whitespace-nowrap">{step.label}</span>
            </button>
          </div>
        );
      })}
    </div>
  );
}
