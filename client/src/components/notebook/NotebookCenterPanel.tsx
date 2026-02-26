import { SplitDocumentEditor } from "./SplitDocumentEditor";

interface NotebookCenterPanelProps {
  documentText: string;
  onDocumentTextChange: (text: string) => void;
  isMerging: boolean;
  isGeneratingDraft?: boolean;
  objective?: string;
  templateName?: string;
}

export function NotebookCenterPanel({
  documentText,
  onDocumentTextChange,
  isMerging,
  isGeneratingDraft,
  objective,
  templateName,
}: NotebookCenterPanelProps) {
  return (
    <div className="h-full flex flex-col">
      <SplitDocumentEditor
        text={documentText}
        onTextChange={onDocumentTextChange}
        isMerging={isMerging}
        isGeneratingDraft={isGeneratingDraft}
        objective={objective}
        templateName={templateName}
      />
    </div>
  );
}
