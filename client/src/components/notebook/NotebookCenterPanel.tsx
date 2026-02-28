import { SplitDocumentEditor } from "./SplitDocumentEditor";

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
      />
    </div>
  );
}
