import { forwardRef } from "react";
import {
  SplitDocumentEditor,
  type WriterConfig,
  type SplitDocumentEditorHandle,
  type ImageTabData,
} from "./SplitDocumentEditor";

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
        />
      </div>
    );
  },
);
