import { useIsMobile } from "@/hooks/use-mobile";
import { useRole } from "@/hooks/use-role";
import { usePanelLayout } from "@/hooks/use-panel-layout";
import { useRoute } from "wouter";
import { generateId } from "@/lib/utils";
import { useWorkspaceState } from "@/hooks/use-workspace-state";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { NotebookTopBar } from "@/components/notebook/NotebookTopBar";
import { NotebookLeftPanel } from "@/components/notebook/NotebookLeftPanel";
import { NotebookCenterPanel } from "@/components/notebook/NotebookCenterPanel";
import { NotebookRightPanel } from "@/components/notebook/NotebookRightPanel";
import { PainterStudio } from "@/components/notebook/PainterStudio";
import { BSChartWorkspace } from "@/components/bschart/BSChartWorkspace";
import { TimelineWorkspace } from "@/components/timeline/TimelineWorkspace";
import { MobileCapture } from "@/components/notebook/MobileCapture";

export default function NotebookWorkspace() {
  const isMobile = useIsMobile();
  const { isAdmin } = useRole();
  const { panelLayout, setPanelLayout } = usePanelLayout();
  const [routeMatch, routeParams] = useRoute("/app/:templateId");

  const ws = useWorkspaceState(routeMatch ? routeParams?.templateId ?? null : null);

  // Mobile: completely separate note-capture experience
  if (isMobile) {
    return <MobileCapture />;
  }

  return (
    <div className="h-screen flex flex-col">
      {/* Top bar */}
      <NotebookTopBar
        isAdmin={isAdmin}
        versionCount={ws.versions.length}
        panelLayout={panelLayout}
        onPanelLayoutChange={setPanelLayout}
        chatSessionContext={{
          objective: ws.objective,
          templateName: ws.selectedTemplateName ?? null,
          documentExcerpt: ws.document.rawText.slice(0, 200),
        }}
        activeChatConversationId={ws.activeChatConversationId}
        onActiveChatConversationChange={ws.setActiveChatConversationId}
      />

      {/* Main layout */}
      <div className="flex-1 overflow-hidden">
        {/* Desktop: 3-column resizable layout */}
        <ResizablePanelGroup
          key={ws.appFlowConfig.workspaceLayout === "bs-chart" ? "bs-chart-layout" : "doc-layout"}
          direction="horizontal"
        >
            {/* Left panel (hidden when chart tab is active or custom workspace app) */}
            {!ws.isChartActive && ws.appFlowConfig.workspaceLayout !== "bs-chart" && (
              <>
                <ResizablePanel
                  order={1}
                  defaultSize={20}
                  minSize={4}
                  collapsible
                  collapsedSize={4}
                  onCollapse={() => ws.setSidebarCollapsed(true)}
                  onExpand={() => ws.setSidebarCollapsed(false)}
                >
                  <NotebookLeftPanel
                    pinnedDocIds={ws.pinnedDocIds}
                    onPinDoc={ws.handlePinDoc}
                    onUnpinDoc={ws.handleUnpinDoc}
                    onPreviewDoc={ws.handlePreviewDoc}
                    onOpenDoc={ws.handleOpenDoc}
                    isCollapsed={ws.sidebarCollapsed}
                    onToggleCollapse={() => ws.setSidebarCollapsed(!ws.sidebarCollapsed)}
                    visibleTabs={panelLayout.leftTabs}
                    activePersonas={ws.activePersonas}
                    onTogglePersona={ws.handleTogglePersona}
                    hasDocument={!!ws.document.rawText.trim() || Object.keys(ws.pinnedDocContents).length > 0}
                    objective={ws.objective}
                    onCaptureToContext={ws.handleCaptureToContext}
                    capturedContext={ws.capturedContext}
                    onRemoveCapturedItem={ws.handleRemoveCapturedItem}
                    onMoveToDocument={ws.handleMoveToDocument}
                    onEvolveDocument={(instruction, description) => ws.writeMutation.mutate({ instruction, description })}
                    isMerging={ws.writeMutation.isPending}
                    onMapNotesToTimeline={ws.handleMapNotesToTimeline}
                    isMapPending={ws.isMapPending}
                    onEvolve={ws.handleEvolve}
                    isEvolving={ws.writeMutation.isPending}
                    sessionNotes={ws.sessionNotes}
                    editHistory={ws.editHistory}
                    documentText={ws.document.rawText}
                    onPaintImage={ws.handlePaintImage}
                    isPainting={ws.isPainting}
                    pinnedDocContents={ws.pinnedDocContents}
                    appType={ws.validAppType}
                    timelineContext={ws.timelineSummary}
                  />
                </ResizablePanel>
                <ResizableHandle withHandle />
              </>
            )}

            {/* Center: Document editor, BS Chart, or Timeline app */}
            <ResizablePanel order={2} defaultSize={ws.appFlowConfig.workspaceLayout === "bs-chart" ? 100 : 55} minSize={30}>
              {ws.appFlowConfig.workspaceLayout === "bs-chart" ? (
                <BSChartWorkspace
                  onSaveToContext={(json, label) => ws.handleCaptureToContext(json, label)}
                />
              ) : ws.appFlowConfig.workspaceLayout === "timeline" ? (
                <TimelineWorkspace
                  onSaveToContext={ws.handleSaveTimelineToContextStore}
                />
              ) : (
                <NotebookCenterPanel
                  ref={ws.centerPanelRef}
                  documentText={ws.document.rawText}
                  onDocumentTextChange={(text) => ws.setDocument({ ...ws.document, rawText: text })}
                  isMerging={ws.writeMutation.isPending}
                  objective={ws.objective}
                  onObjectiveChange={ws.setObjective}
                  templateName={ws.selectedTemplateName}
                  previewDoc={ws.previewDoc}
                  onClosePreview={() => ws.setPreviewDoc(null)}
                  onOpenPreviewDoc={(content, title, docId) => {
                    ws.setDocument({ id: generateId("doc"), rawText: content });
                    ws.setObjective(title);
                    ws.setActiveDocumentId(docId ?? null);
                    ws.setActiveDocumentTitle(title);
                    ws.setPreviewDoc(null);
                  }}
                  onChartActiveChange={ws.setIsChartActive}
                  onSaveToContext={ws.handleSaveToContext}
                  onSaveImageToContext={ws.handleSaveImageToContext}
                  onOpenPainterStudio={() => ws.setShowPainterStudio(true)}
                  isSaving={ws.isSavingToContext}
                  imageTabData={ws.imageTabData}
                  onImageActiveChange={ws.handleImageActiveChange}
                  onSaveTimelineToContext={ws.handleSaveTimelineToContextStore}
                  onTimelineSummaryChange={ws.setTimelineSummary}
                  onWriterFeedback={ws.handleWriterFeedback}
                  activeDocumentTitle={ws.activeDocumentTitle}
                />
              )}
            </ResizablePanel>

            {/* Right panel (hidden when chart tab is active or custom workspace app) */}
            {!ws.isChartActive && ws.appFlowConfig.workspaceLayout !== "bs-chart" && (
              <>
                <ResizableHandle withHandle />
                <ResizablePanel order={3} defaultSize={25} minSize={15}>
                  <NotebookRightPanel
                    activePersonas={ws.activePersonas}
                    onTogglePersona={ws.handleTogglePersona}
                    discussionMessages={ws.discussionMessages}
                    onSendMessage={ws.handleSendMessage}
                    onAcceptResponse={ws.handleAcceptResponse}
                    onDismissResponse={ws.handleDismissResponse}
                    onRespondToMessage={ws.handleRespondToMessage}
                    isChatLoading={ws.askQuestionMutation.isPending}
                    hasDocument={!!ws.document.rawText.trim() || Object.keys(ws.pinnedDocContents).length > 0}
                    objective={ws.objective}
                    onCaptureToContext={ws.handleCaptureToContext}
                    capturedContext={ws.capturedContext}
                    onRemoveCapturedItem={ws.handleRemoveCapturedItem}
                    onMoveToDocument={ws.handleMoveToDocument}
                    onEvolveDocument={(instruction, description) => ws.writeMutation.mutate({ instruction, description })}
                    isMerging={ws.writeMutation.isPending}
                    onMapNotesToTimeline={ws.handleMapNotesToTimeline}
                    isMapPending={ws.isMapPending}
                    onEvolve={ws.handleEvolve}
                    isEvolving={ws.writeMutation.isPending}
                    sessionNotes={ws.sessionNotes}
                    editHistory={ws.editHistory}
                    documentText={ws.document.rawText}
                    onPaintImage={ws.handlePaintImage}
                    isPainting={ws.isPainting}
                    pinnedDocContents={ws.pinnedDocContents}
                    onOpenPainterStudio={() => ws.setShowPainterStudio(true)}
                    appType={ws.validAppType}
                    visibleTabs={panelLayout.rightTabs}
                    pinnedDocIds={ws.pinnedDocIds}
                    onPinDoc={ws.handlePinDoc}
                    onUnpinDoc={ws.handleUnpinDoc}
                    onPreviewDoc={ws.handlePreviewDoc}
                    onOpenDoc={ws.handleOpenDoc}
                    onToggleCollapse={() => ws.setSidebarCollapsed(!ws.sidebarCollapsed)}
                  />
                </ResizablePanel>
              </>
            )}
        </ResizablePanelGroup>
      </div>

      {/* Painter Studio fullscreen overlay */}
      {ws.showPainterStudio && (
        <PainterStudio
          documentText={ws.document.rawText}
          objective={ws.objective}
          onPaintImage={ws.handlePaintImage}
          isPainting={ws.isPainting}
          pinnedDocContents={ws.pinnedDocContents}
          generatedImages={ws.imageTabData}
          onClose={() => ws.setShowPainterStudio(false)}
        />
      )}
    </div>
  );
}
