import { useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import type { WorkspaceState } from "@/hooks/use-workspace-state";
import { NotebookResearchChat } from "@/components/notebook/NotebookResearchChat";
import { InterviewTab } from "@/components/notebook/InterviewTab";
import { ProvoThread } from "@/components/notebook/ProvoThread";
import { Button } from "@/components/ui/button";
import { Sparkles, MessageCircleQuestion, Users, ChevronDown, ChevronUp } from "lucide-react";

type WorkshopTab = "research" | "interview" | "provo";

interface FtuxWorkshopDrawerProps {
  workspace: WorkspaceState;
}

const TABS: { id: WorkshopTab; label: string; icon: typeof Sparkles }[] = [
  { id: "research", label: "Research", icon: Sparkles },
  { id: "interview", label: "Interview", icon: MessageCircleQuestion },
  { id: "provo", label: "Provocations", icon: Users },
];

export function FtuxWorkshopDrawer({ workspace }: FtuxWorkshopDrawerProps) {
  const [activeTab, setActiveTab] = useState<WorkshopTab>("research");
  const [isCollapsed, setIsCollapsed] = useState(false);

  const handleEvolveDocument = useCallback(
    (instruction: string, description: string) => {
      workspace.handleWriterFeedback(instruction, undefined, description);
    },
    [workspace.handleWriterFeedback],
  );

  return (
    <div
      className={cn(
        "border-b border-border/30 bg-card/30 backdrop-blur-sm transition-all duration-200 flex flex-col",
        isCollapsed ? "h-9" : "h-[40%]",
      )}
    >
      {/* Tab strip */}
      <div className="flex items-center gap-0.5 px-2 shrink-0 h-9 border-b border-border/20">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
                activeTab === tab.id && !isCollapsed
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/30",
              )}
              onClick={() => {
                setActiveTab(tab.id);
                if (isCollapsed) setIsCollapsed(false);
              }}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          );
        })}

        <div className="flex-1" />

        <Button
          variant="ghost"
          size="icon"
          className="w-6 h-6 rounded text-muted-foreground/50"
          onClick={() => setIsCollapsed((v) => !v)}
        >
          {isCollapsed ? (
            <ChevronDown className="w-3.5 h-3.5" />
          ) : (
            <ChevronUp className="w-3.5 h-3.5" />
          )}
        </Button>
      </div>

      {/* Content */}
      {!isCollapsed && (
        <div className="flex-1 overflow-hidden">
          {activeTab === "research" && (
            <NotebookResearchChat
              objective={workspace.objective}
              onCaptureToContext={workspace.handleCaptureToContext}
            />
          )}
          {activeTab === "interview" && (
            <InterviewTab
              objective={workspace.objective}
              documentText={workspace.document.rawText}
              appType={workspace.validAppType}
              onEvolveDocument={handleEvolveDocument}
              isMerging={workspace.writeMutation.isPending}
              onCaptureToContext={workspace.handleCaptureToContext}
            />
          )}
          {activeTab === "provo" && (
            <ProvoThread
              documentText={workspace.document.rawText}
              objective={workspace.objective}
              activePersonas={workspace.activePersonas}
              onTogglePersona={workspace.handleTogglePersona}
              onCaptureToContext={workspace.handleCaptureToContext}
              hasDocument={workspace.document.rawText.length > 0}
              pinnedDocContents={workspace.pinnedDocContents}
            />
          )}
        </div>
      )}
    </div>
  );
}
