import { Check, ChevronRight, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useFtuxShell } from "@/lib/ftux-shell-context";
import { Button } from "@/components/ui/button";

const OUTPUT_TYPE_LABELS: Record<string, string> = {
  "blog-post": "Blog Post",
  "infographic": "Infographic",
  "prd": "Product Requirements",
  "timeline": "Timeline",
  "research-paper": "Research Paper",
};

const WORKFLOW_STEPS = [
  { id: "gather", label: "Gather" },
  { id: "workshop", label: "Workshop" },
  { id: "build", label: "Build" },
];

export function FtuxBreadcrumbStepper() {
  const { activeWorkflow, exitWorkflow } = useFtuxShell();

  if (!activeWorkflow) return null;

  const outputLabel = OUTPUT_TYPE_LABELS[activeWorkflow.outputType] ?? activeWorkflow.outputType;

  return (
    <div className="flex items-center gap-1">
      {WORKFLOW_STEPS.map((step, index) => {
        const isCompleted = index < activeWorkflow.currentStep;
        const isCurrent = index === activeWorkflow.currentStep;
        const isFuture = index > activeWorkflow.currentStep;
        const label = index === 2 ? `${step.label}: ${outputLabel}` : step.label;

        return (
          <div key={step.id} className="flex items-center gap-1">
            {index > 0 && (
              <ChevronRight className="w-3 h-3 text-muted-foreground/50 shrink-0" />
            )}
            <button
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all",
                "hover:opacity-80 focus:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                isCurrent && "bg-primary text-primary-foreground shadow-sm",
                isCompleted && "bg-primary/15 text-primary",
                isFuture && "bg-muted/50 text-muted-foreground border border-border/50",
              )}
              disabled
            >
              {isCompleted && <Check className="w-3 h-3" />}
              <span className="whitespace-nowrap">{label}</span>
            </button>
          </div>
        );
      })}

      {/* Exit workflow button */}
      <Button
        variant="ghost"
        size="icon"
        className="w-5 h-5 rounded-full ml-1 text-muted-foreground/50 hover:text-muted-foreground"
        onClick={exitWorkflow}
        title="Exit workflow"
      >
        <X className="w-3 h-3" />
      </Button>
    </div>
  );
}
