import { SplitDocumentEditor, type WriterConfig } from "./SplitDocumentEditor";

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
}

export function NotebookCenterPanel({
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
}: NotebookCenterPanelProps) {
  return (
    <div className="h-full flex flex-col">
      <SplitDocumentEditor
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
      />
    </div>
  );
}
