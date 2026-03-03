import { useState } from "react";
import type { WorkspaceState } from "@/hooks/use-workspace-state";
import { ContextSidebar } from "@/components/notebook/ContextSidebar";
import { SplitDocumentEditor } from "@/components/notebook/SplitDocumentEditor";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";

interface FtuxGatherStepProps {
  workspace: WorkspaceState;
}

export function FtuxGatherStep({ workspace }: FtuxGatherStepProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <ResizablePanelGroup direction="horizontal" className="h-full">
      {/* Left: Context Sidebar */}
      <ResizablePanel
        defaultSize={28}
        minSize={15}
        maxSize={40}
        collapsible
        collapsedSize={0}
        onCollapse={() => setSidebarCollapsed(true)}
        onExpand={() => setSidebarCollapsed(false)}
      >
        <div className="h-full border-r border-border/30">
          <ContextSidebar
            pinnedDocIds={workspace.pinnedDocIds}
            onPinDoc={workspace.handlePinDoc}
            onUnpinDoc={workspace.handleUnpinDoc}
            onPreviewDoc={workspace.handlePreviewDoc}
            onOpenDoc={workspace.handleOpenDoc}
            isCollapsed={sidebarCollapsed}
            onToggleCollapse={() => setSidebarCollapsed((v) => !v)}
            embedded
          />
        </div>
      </ResizablePanel>

      <ResizableHandle withHandle />

      {/* Right: Document Editor */}
      <ResizablePanel defaultSize={72} minSize={40}>
        <div className="h-full overflow-hidden">
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
            activeDocumentTitle={workspace.activeDocumentTitle}
          />
        </div>
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
