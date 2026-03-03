import { useRoute } from "wouter";
import { useWorkspaceState } from "@/hooks/use-workspace-state";
import { useFtuxShellConfig } from "@/hooks/use-ftux-shell-config";
import { FtuxShellProvider } from "@/lib/ftux-shell-context";
import { FtuxShell } from "@/components/ftux/FtuxShell";
import { FtuxStatusBar } from "@/components/ftux/FtuxStatusBar";
import { FtuxDock } from "@/components/ftux/FtuxDock";
import { FtuxContentArea } from "@/components/ftux/FtuxContentArea";
import { FtuxHamburgerMenu } from "@/components/ftux/FtuxHamburgerMenu";
import { FtuxDidYouKnow } from "@/components/ftux/FtuxDidYouKnow";
import { FtuxTourModal } from "@/components/ftux/FtuxTourModal";

export default function FtuxWorkspace() {
  const [, routeParams] = useRoute("/ftux/:templateId");
  const templateId = routeParams?.templateId ?? null;

  const ws = useWorkspaceState(templateId);
  const { shellConfig, setShellConfig } = useFtuxShellConfig();

  return (
    <FtuxShellProvider initialConfig={shellConfig} onConfigChange={setShellConfig}>
      <FtuxShell>
        <FtuxStatusBar templateName={ws.selectedTemplateName ?? null} templateId={templateId} />

        <div className="flex-1 relative overflow-hidden">
          <FtuxHamburgerMenu
            currentTemplateId={templateId}
            onSelectTemplate={(id) => ws.setSelectedTemplateId(id)}
          />

          <FtuxContentArea workspace={ws} />

          <FtuxDock />
          <FtuxDidYouKnow />
        </div>
      </FtuxShell>

      <FtuxTourModal />
    </FtuxShellProvider>
  );
}
