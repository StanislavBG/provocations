import { useFtuxShell } from "@/lib/ftux-shell-context";
import type { WorkspaceState } from "@/hooks/use-workspace-state";
import { SplitDocumentEditor } from "@/components/notebook/SplitDocumentEditor";
import { ArtifyPanel } from "@/components/ArtifyPanel";
import { BSChartWorkspace } from "@/components/bschart/BSChartWorkspace";
import { TimelineWorkspace } from "@/components/timeline/TimelineWorkspace";

interface FtuxBuildStepProps {
  workspace: WorkspaceState;
}

const OUTPUT_TYPE_LABELS: Record<string, string> = {
  "blog-post": "Blog Post",
  "infographic": "Infographic",
  "prd": "Product Requirements",
  "timeline": "Timeline",
  "research-paper": "Research Paper",
};

export function FtuxBuildStep({ workspace }: FtuxBuildStepProps) {
  const { activeWorkflow } = useFtuxShell();
  if (!activeWorkflow) return null;

  const { buildTool, outputType } = activeWorkflow;
  const label = OUTPUT_TYPE_LABELS[outputType] ?? outputType;

  // Writer — full editor with smart toolbar
  if (buildTool === "writer") {
    return (
      <div className="h-full flex flex-col">
        <div className="px-4 py-2 border-b border-border/30 bg-card/30 backdrop-blur-sm shrink-0">
          <p className="text-xs text-muted-foreground">
            Building: <span className="font-medium text-foreground">{label}</span>
            <span className="ml-2 text-muted-foreground/60">— Use the smart buttons to expand, condense, restructure, clarify, style, or correct.</span>
          </p>
        </div>
        <div className="flex-1 overflow-hidden">
          <SplitDocumentEditor
            ref={workspace.centerPanelRef}
            text={workspace.document.rawText}
            onTextChange={(text) =>
              workspace.setDocument((prev) => ({ ...prev, rawText: text }))
            }
            objective={workspace.objective}
            onObjectiveChange={workspace.setObjective}
            templateName={workspace.selectedTemplateName}
            onSaveToContext={workspace.handleSaveToContext}
            isSaving={workspace.isSavingToContext}
            imageTabData={workspace.imageTabData}
            onWriterFeedback={workspace.handleWriterFeedback}
            activeDocumentTitle={workspace.activeDocumentTitle}
          />
        </div>
      </div>
    );
  }

  // Painter — image generation from document text
  if (buildTool === "painter") {
    return (
      <div className="h-full overflow-auto">
        <ArtifyPanel
          sourceText={workspace.document.rawText}
          sourceLabel="Document"
          onClose={() => {}}
          onImageGenerated={async (imageUrl, prompt) => {
            await workspace.handleSaveImageToContext(imageUrl, prompt);
          }}
        />
      </div>
    );
  }

  // Chart — BS Chart workspace
  if (buildTool === "chart") {
    return (
      <div className="h-full">
        <BSChartWorkspace
          onExportToDocument={(markdown) => {
            workspace.setDocument((prev) => ({
              ...prev,
              rawText: prev.rawText + "\n\n" + markdown,
            }));
          }}
          onSaveToContext={workspace.handleSaveTimelineToContextStore}
        />
      </div>
    );
  }

  // Timeline
  if (buildTool === "timeline") {
    return (
      <div className="h-full">
        <TimelineWorkspace
          onSaveToContext={workspace.handleSaveTimelineToContextStore}
          onTimelineSummaryChange={workspace.setTimelineSummary}
        />
      </div>
    );
  }

  return null;
}
