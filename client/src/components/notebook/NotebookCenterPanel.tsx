import { forwardRef } from "react";
import {
  SplitDocumentEditor,
  type WriterConfig,
  type SplitDocumentEditorHandle,
  type ImageTabData,
} from "./SplitDocumentEditor";
import type { ContextItem, EditHistoryEntry } from "@shared/schema";

interface NotebookCenterPanelProps {
  documentText: string;
  onDocumentTextChange: (text: string) => void;
  isMerging: boolean;
  objective?: string;
  onObjectiveChange?: (objective: string) => void;
  templateName?: string;
  previewDoc?: { title: string; content: string } | null;
  onClosePreview?: () => void;
  onChartActiveChange?: (isActive: boolean) => void;
  onSaveToContext?: () => void;
  isSaving?: boolean;
  onEvolve?: (configurations: WriterConfig[]) => void;
  isEvolving?: boolean;
  imageTabData?: Map<string, ImageTabData>;
  onAddImageTab?: (tabId: string) => void;
  onImageActiveChange?: (isActive: boolean, tabId: string | null) => void;
  /** Context data for the Evolve hover preview */
  capturedContext?: ContextItem[];
  pinnedDocContents?: Record<number, { title: string; content: string }>;
  sessionNotes?: string;
  editHistory?: EditHistoryEntry[];
  appType?: string;
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
      onChartActiveChange,
      onSaveToContext,
      isSaving,
      onEvolve,
      isEvolving,
      imageTabData,
      onAddImageTab,
      onImageActiveChange,
      capturedContext,
      pinnedDocContents,
      sessionNotes,
      editHistory,
      appType,
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
          onChartActiveChange={onChartActiveChange}
          onSaveToContext={onSaveToContext}
          isSaving={isSaving}
          onEvolve={onEvolve}
          isEvolving={isEvolving}
          imageTabData={imageTabData}
          onAddImageTab={onAddImageTab}
          onImageActiveChange={onImageActiveChange}
          capturedContext={capturedContext}
          pinnedDocContents={pinnedDocContents}
          sessionNotes={sessionNotes}
          editHistory={editHistory}
          appType={appType}
        />
      </div>
    );
  },
);
