import { UserButton } from "@clerk/clerk-react";
import { ProvoIcon } from "@/components/ProvoIcon";
import { ThemeToggle } from "@/components/ThemeToggle";
import { PaletteToggle } from "@/components/PaletteToggle";
import { FtuxBreadcrumbStepper } from "./FtuxBreadcrumbStepper";
import { getAppFlowConfig } from "@/lib/appWorkspaceConfig";
import { Badge } from "@/components/ui/badge";

interface FtuxStatusBarProps {
  templateName: string | null;
  templateId: string | null;
}

export function FtuxStatusBar({ templateName, templateId }: FtuxStatusBarProps) {
  const flowConfig = getAppFlowConfig(templateId);
  const steps = flowConfig.flowSteps ?? [];

  return (
    <div
      className="flex items-center justify-between px-4 shrink-0 bg-card/85 backdrop-blur-xl border-b border-border/50"
      style={{ height: "var(--ftux-status-bar-height, 36px)" }}
    >
      {/* Left: Brand */}
      <div className="flex items-center gap-2 min-w-0">
        <ProvoIcon className="w-4 h-4 text-primary shrink-0" />
        <span className="text-xs font-serif font-bold tracking-tight text-foreground">Provocations</span>
        {templateName && (
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 font-normal">
            {templateName}
          </Badge>
        )}
      </div>

      {/* Center: Breadcrumb stepper */}
      <div className="hidden md:flex items-center justify-center flex-1 mx-4">
        <FtuxBreadcrumbStepper steps={steps} />
      </div>

      {/* Right: Controls */}
      <div className="flex items-center gap-1.5 shrink-0">
        <ThemeToggle />
        <PaletteToggle />
        <UserButton
          appearance={{
            elements: {
              avatarBox: "w-6 h-6",
            },
          }}
        />
      </div>
    </div>
  );
}
