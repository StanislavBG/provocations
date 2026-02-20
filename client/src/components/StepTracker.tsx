import { useMemo } from "react";
import {
  CheckCircle2,
  Circle,
  Loader2,
  MessageCircleQuestion,
  Globe,
  Layers,
  Search,
} from "lucide-react";
import type { FlowStepConfig, LeftPanelTabConfig } from "@/lib/appWorkspaceConfig";

// ---------------------------------------------------------------------------
// Step definitions
// ---------------------------------------------------------------------------

export interface WorkflowStep {
  id: string;
  label: string;
  description: string;
  status: "completed" | "active" | "upcoming";
}

export type WorkflowPhase = "select" | "draft" | "edit";

interface StepTrackerProps {
  /** Current workflow phase */
  currentPhase: WorkflowPhase;
  /** Selected template label (shown in step 1 when completed) */
  selectedTemplate?: string;
  /** Active toolbox app in the workspace */
  activeToolboxApp?: string;
  /** Application-specific flow steps from AppFlowConfig.
   *  When provided, these replace the default 3-step flow. */
  appFlowSteps?: FlowStepConfig[];
  /** Application-specific left panel tabs from AppFlowConfig.
   *  When provided, these replace the hardcoded canvas tools. */
  appLeftPanelTabs?: LeftPanelTabConfig[];
}

/** Icon lookup for canvas tool IDs */
const TOOL_ICONS: Record<string, typeof Circle> = {
  provoke: MessageCircleQuestion,
  website: Globe,
  context: Layers,
  analyzer: Search,
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function StepTracker({
  currentPhase,
  selectedTemplate,
  activeToolboxApp,
  appFlowSteps,
  appLeftPanelTabs,
}: StepTrackerProps) {
  const steps: WorkflowStep[] = useMemo(() => {
    // Use app-specific steps when provided
    if (appFlowSteps && appFlowSteps.length > 0) {
      return appFlowSteps.map((step, i) => {
        // First step completed once a template is selected (past "select" phase)
        // Last step(s) active during edit phase
        // Middle steps completed once in edit phase
        let status: WorkflowStep["status"];
        if (currentPhase === "select") {
          status = i === 0 ? "active" : "upcoming";
        } else if (currentPhase === "draft") {
          status = i === 0 ? "completed" : i === 1 ? "active" : "upcoming";
        } else {
          // edit phase — all but last step completed, last step active
          status = i < appFlowSteps.length - 1 ? "completed" : "active";
        }

        return {
          id: step.id,
          label: step.label,
          description:
            i === 0 && status === "completed" && selectedTemplate
              ? `Template: ${selectedTemplate}`
              : step.description,
          status,
        };
      });
    }

    // Legacy fallback: 3-step default
    const phaseOrder: WorkflowPhase[] = ["select", "draft", "edit"];
    const currentIndex = phaseOrder.indexOf(currentPhase);

    return [
      {
        id: "select",
        label: "Select Application",
        description: selectedTemplate
          ? `Template: ${selectedTemplate}`
          : "Choose your document type",
        status:
          currentIndex > 0
            ? "completed"
            : currentIndex === 0
              ? "active"
              : "upcoming",
      },
      {
        id: "draft",
        label: "Build Draft",
        description: "Provide context and generate your first draft",
        status:
          currentIndex > 1
            ? "completed"
            : currentIndex === 1
              ? "active"
              : "upcoming",
      },
      {
        id: "edit",
        label: "Edit & Refine",
        description: "Use canvas tools to evolve your document",
        status: currentIndex === 2 ? "active" : "upcoming",
      },
    ];
  }, [currentPhase, selectedTemplate, appFlowSteps]);

  // Canvas tools — use app-specific tabs when provided
  const canvasTools = useMemo(() => {
    if (appLeftPanelTabs) {
      return appLeftPanelTabs.map((tab) => ({
        id: tab.id,
        label: tab.label,
        icon: TOOL_ICONS[tab.id] || Circle,
        description: tab.description,
      }));
    }
    // Legacy fallback
    return [
      {
        id: "provoke",
        label: "Provoke",
        icon: MessageCircleQuestion,
        description: "AI-driven interview with expert personas that challenge your thinking",
      },
      {
        id: "website",
        label: "Capture",
        icon: Globe,
        description: "Browse websites, take screenshots, and annotate for requirements",
      },
      {
        id: "context",
        label: "Context",
        icon: Layers,
        description: "View collected reference materials, templates, and supporting context",
      },
      {
        id: "analyzer",
        label: "Analyzer",
        icon: Search,
        description: "SQL query decomposition, optimization, and metrics extraction",
      },
    ];
  }, [appLeftPanelTabs]);

  const showTools = currentPhase === "edit";

  return (
    <div className="border-t bg-card/60 px-4 py-2">
      {/* Step indicators */}
      <div className="flex items-center justify-center gap-1 sm:gap-3">
        {steps.map((step, i) => (
          <div key={step.id} className="flex items-center gap-1 sm:gap-3">
            {/* Step pill */}
            <div
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs transition-colors ${
                step.status === "active"
                  ? "bg-primary/10 text-primary font-semibold border border-primary/20"
                  : step.status === "completed"
                    ? "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/30"
                    : "bg-muted/50 text-muted-foreground border border-transparent"
              }`}
            >
              {step.status === "completed" ? (
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              ) : step.status === "active" ? (
                <Loader2 className="w-3.5 h-3.5 shrink-0 animate-spin" />
              ) : (
                <Circle className="w-3.5 h-3.5 shrink-0" />
              )}
              <span className="hidden sm:inline">{step.label}</span>
              <span className="sm:hidden">{i + 1}</span>
            </div>

            {/* Connector line */}
            {i < steps.length - 1 && (
              <div
                className={`w-6 sm:w-10 h-px ${
                  steps[i + 1].status !== "upcoming"
                    ? "bg-emerald-300 dark:bg-emerald-700"
                    : "bg-border"
                }`}
              />
            )}
          </div>
        ))}
      </div>

      {/* Step description */}
      <div className="text-center mt-1">
        {steps
          .filter((s) => s.status === "active")
          .map((s) => (
            <p key={s.id} className="text-[11px] text-muted-foreground">
              {s.description}
            </p>
          ))}
      </div>

      {/* Canvas tool descriptions (edit phase only) */}
      {showTools && (
        <div className="flex items-center justify-center gap-3 mt-1.5 flex-wrap">
          {canvasTools.map((tool) => {
            const Icon = tool.icon;
            const isActive = activeToolboxApp === tool.id;
            return (
              <div
                key={tool.id}
                className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] transition-colors ${
                  isActive
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground"
                }`}
                title={tool.description}
              >
                <Icon className="w-3 h-3 shrink-0" />
                <span>{tool.label}</span>
                {isActive && (
                  <span className="hidden md:inline ml-0.5 opacity-70">
                    — {tool.description}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
