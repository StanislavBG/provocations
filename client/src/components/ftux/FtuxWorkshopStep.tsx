import type { WorkspaceState } from "@/hooks/use-workspace-state";
import { FtuxWorkshopDrawer } from "./FtuxWorkshopDrawer";
import { SplitDocumentEditor } from "@/components/notebook/SplitDocumentEditor";

interface FtuxWorkshopStepProps {
  workspace: WorkspaceState;
}

export function FtuxWorkshopStep({ workspace }: FtuxWorkshopStepProps) {
  return (
    <div className="h-full flex flex-col">
      {/* Top: Workshop drawer (collapsible, 40% default) */}
      <FtuxWorkshopDrawer workspace={workspace} />

      {/* Bottom: Document editor */}
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
          previewDoc={workspace.previewDoc}
          onClosePreview={() => workspace.setPreviewDoc(null)}
          onOpenPreviewDoc={(content, title, docId) => {
            workspace.setDocument((prev) => ({ ...prev, rawText: content }));
            if (docId) workspace.setActiveDocumentId(docId);
            workspace.setActiveDocumentTitle(title);
            workspace.setPreviewDoc(null);
          }}
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
