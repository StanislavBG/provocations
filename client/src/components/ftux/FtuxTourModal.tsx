import { useState, useEffect, useRef } from "react";
import { useFtuxShell } from "@/lib/ftux-shell-context";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, X, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface TourStep {
  title: string;
  content: string;
  highlight: "full" | "cards" | "dock" | "breadcrumb" | "settings";
}

const TOUR_STEPS: TourStep[] = [
  {
    title: "Welcome to Provocations",
    content:
      "This is your creative studio — a workspace where AI helps you think deeper, not just faster. Every creation follows a guided process.",
    highlight: "full",
  },
  {
    title: "Start with an Output",
    content:
      "Choose what you want to create — a blog post, infographic, product spec, timeline, or research paper. We'll guide you through each phase.",
    highlight: "cards",
  },
  {
    title: "The Dock",
    content:
      "Quick access to your tools. Drag to reorder, right-click to customize. Tools are grouped into Gather, Workshop, and Build categories.",
    highlight: "dock",
  },
  {
    title: "Gather → Workshop → Build",
    content:
      "Every creation follows three phases: gather raw materials and context, workshop your thinking with AI tools, then build the final output.",
    highlight: "breadcrumb",
  },
  {
    title: "Customize Everything",
    content:
      "Move the dock, change colors, adjust translucency — make the workspace yours. Click the gear icon or right-click the dock to open settings.",
    highlight: "settings",
  },
];

export function FtuxTourModal() {
  const { tourCompleted, setTourCompleted } = useFtuxShell();
  const [currentStep, setCurrentStep] = useState(0);
  const modalRef = useRef<HTMLDivElement>(null);

  const isFirst = currentStep === 0;
  const isLast = currentStep === TOUR_STEPS.length - 1;

  const handleNext = () => {
    if (isLast) {
      setTourCompleted(true);
    } else {
      setCurrentStep((s) => s + 1);
    }
  };

  const handleBack = () => {
    if (!isFirst) setCurrentStep((s) => s - 1);
  };

  const handleSkip = () => {
    setTourCompleted(true);
  };

  // Keyboard: Escape to skip, Left/Right to navigate
  useEffect(() => {
    if (tourCompleted) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleSkip();
      } else if (e.key === "ArrowRight" || e.key === "Enter") {
        handleNext();
      } else if (e.key === "ArrowLeft") {
        handleBack();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  // Auto-focus the modal for screen readers
  useEffect(() => {
    if (!tourCompleted) {
      modalRef.current?.focus();
    }
  }, [tourCompleted]);

  if (tourCompleted) return null;

  const step = TOUR_STEPS[currentStep];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-label={`Tour step ${currentStep + 1} of ${TOUR_STEPS.length}: ${step.title}`}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-background/80 backdrop-blur-md"
        onClick={handleSkip}
      />

      {/* Modal card */}
      <div
        ref={modalRef}
        tabIndex={-1}
        className="relative z-10 w-full max-w-md mx-4 animate-in zoom-in-95 fade-in duration-200 focus:outline-none"
      >
        <div
          className="rounded-2xl p-6 space-y-5"
          style={{
            background: "hsl(var(--card) / 0.95)",
            border: "1px solid hsl(var(--border) / 0.5)",
            boxShadow: "0 24px 64px rgba(0,0,0,0.2)",
          }}
        >
          {/* Close */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                Step {currentStep + 1} of {TOUR_STEPS.length}
              </span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="w-6 h-6 rounded text-muted-foreground/50 hover:text-muted-foreground"
              onClick={handleSkip}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>

          {/* Content */}
          <div className="space-y-2">
            <h2 className="text-lg font-serif font-bold text-foreground">
              {step.title}
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {step.content}
            </p>
          </div>

          {/* Visual indicator */}
          <div className="flex items-center justify-center py-2">
            <HighlightPreview highlight={step.highlight} />
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between pt-2">
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-muted-foreground"
              onClick={handleSkip}
            >
              Skip tour
            </Button>

            <div className="flex items-center gap-2">
              {/* Step dots */}
              <div className="flex items-center gap-1 mr-2">
                {TOUR_STEPS.map((_, i) => (
                  <div
                    key={i}
                    className={cn(
                      "w-1.5 h-1.5 rounded-full transition-colors",
                      i === currentStep ? "bg-primary" : "bg-muted-foreground/20",
                    )}
                  />
                ))}
              </div>

              {!isFirst && (
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs gap-1"
                  onClick={handleBack}
                >
                  <ArrowLeft className="w-3 h-3" />
                  Back
                </Button>
              )}

              <Button
                variant="default"
                size="sm"
                className="text-xs gap-1"
                onClick={handleNext}
              >
                {isLast ? "Get Started" : "Next"}
                {!isLast && <ArrowRight className="w-3 h-3" />}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function HighlightPreview({ highlight }: { highlight: TourStep["highlight"] }) {
  const baseClass = "rounded-lg border border-border/30 bg-muted/20 text-[9px] text-muted-foreground/60 font-mono";

  switch (highlight) {
    case "full":
      return (
        <div className={cn(baseClass, "w-48 h-28 flex items-center justify-center")}>
          <span className="text-primary/50">Your workspace</span>
        </div>
      );
    case "cards":
      return (
        <div className="flex gap-2">
          {["Blog", "Visual", "Spec"].map((label) => (
            <div key={label} className={cn(baseClass, "w-16 h-20 flex items-end justify-center pb-2")}>
              {label}
            </div>
          ))}
        </div>
      );
    case "dock":
      return (
        <div className={cn(baseClass, "flex items-center gap-1 px-3 py-2 rounded-full")}>
          {["G", "D", "|", "R", "I", "P"].map((ch, i) => (
            <div
              key={i}
              className={cn(
                "w-5 h-5 rounded-md flex items-center justify-center text-[8px]",
                ch === "|" ? "w-px bg-border/40 mx-0.5" : "bg-muted/40",
              )}
            >
              {ch !== "|" ? ch : ""}
            </div>
          ))}
        </div>
      );
    case "breadcrumb":
      return (
        <div className="flex items-center gap-1">
          {["Gather", "Workshop", "Build"].map((label, i) => (
            <div key={label} className="flex items-center gap-1">
              {i > 0 && <span className="text-muted-foreground/30 text-[10px]">→</span>}
              <div
                className={cn(
                  "px-2 py-0.5 rounded-full text-[9px]",
                  i === 0
                    ? "bg-primary/15 text-primary"
                    : "bg-muted/30 text-muted-foreground/50 border border-border/30",
                )}
              >
                {label}
              </div>
            </div>
          ))}
        </div>
      );
    case "settings":
      return (
        <div className={cn(baseClass, "w-32 h-16 flex items-center justify-center")}>
          <span className="text-primary/50">Settings</span>
        </div>
      );
    default:
      return null;
  }
}
