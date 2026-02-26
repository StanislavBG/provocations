import { SplitDocumentEditor } from "./SplitDocumentEditor";

interface NotebookCenterPanelProps {
  documentText: string;
  onDocumentTextChange: (text: string) => void;
  isMerging: boolean;
  objective?: string;
  onObjectiveChange?: (objective: string) => void;
  templateName?: string;
}

export function NotebookCenterPanel({
  documentText,
  onDocumentTextChange,
  isMerging,
  objective,
  onObjectiveChange,
  templateName,
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
      />
    </div>
  );
}
