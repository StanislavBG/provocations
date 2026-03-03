import { useFtuxShell } from "@/lib/ftux-shell-context";
import type { WorkspaceState } from "@/hooks/use-workspace-state";
import { FtuxLandingCards } from "./FtuxLandingCards";
import { FtuxGatherStep } from "./FtuxGatherStep";
import { FtuxWorkshopStep } from "./FtuxWorkshopStep";
import { FtuxBuildStep } from "./FtuxBuildStep";
import { FtuxStepNavigation } from "./FtuxStepNavigation";

interface FtuxContentAreaProps {
  workspace: WorkspaceState;
}

/**
 * Routes between landing cards (no workflow) and step-specific layouts (active workflow).
 */
export function FtuxContentArea({ workspace }: FtuxContentAreaProps) {
  const { activeWorkflow } = useFtuxShell();

  if (!activeWorkflow) {
    return (
      <div className="h-full w-full overflow-hidden animate-in fade-in duration-200">
        <FtuxLandingCards />
      </div>
    );
  }

  return (
    <div className="h-full w-full overflow-hidden animate-in fade-in duration-200 flex flex-col">
      <div className="flex-1 overflow-hidden">
        {activeWorkflow.currentStep === 0 && (
          <FtuxGatherStep workspace={workspace} />
        )}
        {activeWorkflow.currentStep === 1 && (
          <FtuxWorkshopStep workspace={workspace} />
        )}
        {activeWorkflow.currentStep === 2 && (
          <FtuxBuildStep workspace={workspace} />
        )}
      </div>
      <FtuxStepNavigation />
    </div>
  );
}
