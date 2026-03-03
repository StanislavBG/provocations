import { useRef } from "react";
import { useFtuxShell } from "@/lib/ftux-shell-context";
import type { WorkspaceState } from "@/hooks/use-workspace-state";
import { FtuxLandingCards } from "./FtuxLandingCards";
import { FtuxGatherStep } from "./FtuxGatherStep";
import { FtuxWorkshopStep } from "./FtuxWorkshopStep";
import { FtuxBuildStep } from "./FtuxBuildStep";
import { FtuxStepNavigation } from "./FtuxStepNavigation";
import { cn } from "@/lib/utils";

interface FtuxContentAreaProps {
  workspace: WorkspaceState;
}

/**
 * Routes between landing cards (no workflow) and step-specific layouts (active workflow).
 * Tracks step direction for slide-in animations on transitions.
 */
export function FtuxContentArea({ workspace }: FtuxContentAreaProps) {
  const { activeWorkflow } = useFtuxShell();
  const prevStepRef = useRef<number>(0);

  if (!activeWorkflow) {
    return (
      <div className="h-full w-full overflow-y-auto animate-in fade-in duration-200">
        <FtuxLandingCards />
      </div>
    );
  }

  const { currentStep } = activeWorkflow;
  const direction = currentStep > prevStepRef.current ? "right" : currentStep < prevStepRef.current ? "left" : null;
  prevStepRef.current = currentStep;

  const stepAnim =
    direction === "right"
      ? "animate-in slide-in-from-right-4 fade-in duration-300"
      : direction === "left"
        ? "animate-in slide-in-from-left-4 fade-in duration-300"
        : "animate-in fade-in duration-200";

  return (
    <div className="h-full w-full overflow-hidden animate-in fade-in duration-200 flex flex-col pb-20">
      <div key={currentStep} className={cn("flex-1 overflow-hidden", stepAnim)}>
        {currentStep === 0 && (
          <FtuxGatherStep workspace={workspace} />
        )}
        {currentStep === 1 && (
          <FtuxWorkshopStep workspace={workspace} />
        )}
        {currentStep === 2 && (
          <FtuxBuildStep workspace={workspace} />
        )}
      </div>
      <FtuxStepNavigation />
    </div>
  );
}
