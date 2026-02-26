import { useState } from "react";
import { ProvokeText } from "@/components/ProvokeText";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";
import { Button } from "@/components/ui/button";
import {
  Eye,
  Pencil,
  Download,
  Target,
  ChevronDown,
  ChevronRight,
} from "lucide-react";

interface SplitDocumentEditorProps {
  text: string;
  onTextChange: (text: string) => void;
  isMerging?: boolean;
  objective?: string;
  onObjectiveChange?: (objective: string) => void;
  templateName?: string;
}

export function SplitDocumentEditor({
  text,
  onTextChange,
  isMerging = false,
  objective,
  onObjectiveChange,
  templateName,
}: SplitDocumentEditorProps) {
  const [viewMode, setViewMode] = useState<"edit" | "preview">("edit");
  const [objectiveExpanded, setObjectiveExpanded] = useState(
    !!(objective && objective.trim()),
  );

  const handleDownload = () => {
    const blob = new Blob([text], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${templateName || "document"}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const modeToggle = (
    <div className="flex items-center gap-1">
      <Button
        variant={viewMode === "edit" ? "secondary" : "ghost"}
        size="sm"
        className="h-6 text-xs gap-1"
        onClick={() => setViewMode("edit")}
      >
        <Pencil className="w-3 h-3" />
        Edit
      </Button>
      <Button
        variant={viewMode === "preview" ? "secondary" : "ghost"}
        size="sm"
        className="h-6 text-xs gap-1"
        onClick={() => setViewMode("preview")}
      >
        <Eye className="w-3 h-3" />
        Preview
      </Button>
      <div className="w-px h-4 bg-border mx-1" />
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6"
        onClick={handleDownload}
        disabled={!text.trim()}
        title="Download as .md"
      >
        <Download className="w-3.5 h-3.5" />
      </Button>
    </div>
  );

  return (
    <div className="h-full flex flex-col">
      {/* ─── Objective bar (expandable, part of the document) ─── */}
      <div className="border-b shrink-0">
        <button
          type="button"
          onClick={() => setObjectiveExpanded(!objectiveExpanded)}
          className="w-full flex items-center gap-2 px-3 py-1.5 text-left hover:bg-muted/30 transition-colors"
        >
          <Target className="w-3.5 h-3.5 text-primary/70 shrink-0" />
          <span className="text-[10px] font-bold uppercase tracking-wider text-primary/70">
            Objective
          </span>
          {!objectiveExpanded && objective?.trim() && (
            <span className="text-xs text-muted-foreground truncate flex-1">
              {objective}
            </span>
          )}
          {objectiveExpanded ? (
            <ChevronDown className="w-3 h-3 text-muted-foreground ml-auto shrink-0" />
          ) : (
            <ChevronRight className="w-3 h-3 text-muted-foreground ml-auto shrink-0" />
          )}
        </button>
        {objectiveExpanded && (
          <div className="px-3 pb-2">
            <ProvokeText
              chrome="bare"
              variant="textarea"
              value={objective || ""}
              onChange={onObjectiveChange || (() => {})}
              placeholder="What are you trying to achieve with this document?"
              className="text-sm"
              minRows={2}
              maxRows={5}
              showCopy={false}
              showClear={false}
              readOnly={!onObjectiveChange}
            />
          </div>
        )}
      </div>

      {/* Merging indicator */}
      {isMerging && (
        <div className="bg-primary/10 px-3 py-1.5 flex items-center gap-2 text-xs border-b shrink-0">
          <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <span>Integrating feedback into document...</span>
        </div>
      )}

      {/* Edit mode: ProvokeText with full standard capabilities */}
      {viewMode === "edit" && (
        <ProvokeText
          chrome="container"
          variant="editor"
          value={text}
          onChange={onTextChange}
          placeholder="Start writing your document here... (Markdown supported)"
          label="Document"
          headerActions={modeToggle}
          className="text-sm leading-relaxed font-serif flex-1"
        />
      )}

      {/* Preview mode: rendered markdown */}
      {viewMode === "preview" && (
        <div className="flex-1 flex flex-col">
          <div className="flex items-center justify-between px-3 py-1.5 border-b shrink-0">
            <span className="text-xs font-semibold text-muted-foreground">
              Document
            </span>
            {modeToggle}
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            {text.trim() ? (
              <MarkdownRenderer content={text} />
            ) : (
              <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground/40">
                <Eye className="w-8 h-8" />
                <p className="text-sm">Preview will appear here</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
