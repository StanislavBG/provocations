import { forwardRef } from "react";
import {
  SplitDocumentEditor,
  type SplitDocumentEditorHandle,
  type ImageTabData,
} from "./SplitDocumentEditor";
import type { TimelineSummary } from "@/components/timeline/TimelineWorkspace";

interface NotebookCenterPanelProps {
  documentText: string;
  onDocumentTextChange: (text: string) => void;
  isMerging: boolean;
  objective?: string;
  onObjectiveChange?: (objective: string) => void;
  templateName?: string;
  previewDoc?: { title: string; content: string; docId?: number } | null;
  onClosePreview?: () => void;
  onOpenPreviewDoc?: (content: string, title: string, docId?: number) => void;
  onChartActiveChange?: (isActive: boolean) => void;
  onSaveToContext?: (tabTitle?: string) => void;
  onSaveImageToContext?: (imageUrl: string, prompt: string) => void;
  onOpenPainterStudio?: () => void;
  isSaving?: boolean;
  imageTabData?: Map<string, ImageTabData>;
  onAddImageTab?: (tabId: string) => void;
  onImageActiveChange?: (isActive: boolean, tabId: string | null) => void;
  onSaveTimelineToContext?: (json: string, label: string) => void;
  onTimelineSummaryChange?: (summary: TimelineSummary) => void;
  onWriterFeedback?: (instruction: string, selectedText?: string, description?: string) => void;
  activeDocumentTitle?: string | null;
}

export const NotebookCenterPanel = forwardRef<SplitDocumentEditorHandle, NotebookCenterPanelProps>(
  function NotebookCenterPanel(
    {
      documentText,
      onDocumentTextChange,
      isMerging,
      objective,
      onObjectiveChange,
      templateName,
      previewDoc,
      onClosePreview,
      onOpenPreviewDoc,
      onChartActiveChange,
      onSaveToContext,
      onSaveImageToContext,
      onOpenPainterStudio,
      isSaving,
      imageTabData,
      onAddImageTab,
      onImageActiveChange,
      onSaveTimelineToContext,
      onTimelineSummaryChange,
      onWriterFeedback,
      activeDocumentTitle,
    },
    ref,
  ) {
    return (
      <div className="h-full flex flex-col">
        <SplitDocumentEditor
          ref={ref}
          text={documentText}
          onTextChange={onDocumentTextChange}
          isMerging={isMerging}
          objective={objective}
          onObjectiveChange={onObjectiveChange}
          templateName={templateName}
          previewDoc={previewDoc}
          onClosePreview={onClosePreview}
          onOpenPreviewDoc={onOpenPreviewDoc}
          onChartActiveChange={onChartActiveChange}
          onSaveToContext={onSaveToContext}
          onSaveImageToContext={onSaveImageToContext}
          onOpenPainterStudio={onOpenPainterStudio}
          isSaving={isSaving}
          imageTabData={imageTabData}
          onAddImageTab={onAddImageTab}
          onImageActiveChange={onImageActiveChange}
          onSaveTimelineToContext={onSaveTimelineToContext}
          onTimelineSummaryChange={onTimelineSummaryChange}
          onWriterFeedback={onWriterFeedback}
          activeDocumentTitle={activeDocumentTitle}
        />
      </div>
    );
  },
);
