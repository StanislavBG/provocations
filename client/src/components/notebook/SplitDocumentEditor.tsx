import { useState } from "react";
import { ProvokeText } from "@/components/ProvokeText";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Columns2,
  Maximize2,
  Eye,
  Pencil,
  Download,
} from "lucide-react";

interface SplitDocumentEditorProps {
  text: string;
  onTextChange: (text: string) => void;
  isMerging?: boolean;
  isGeneratingDraft?: boolean;
  objective?: string;
  templateName?: string;
}

export function SplitDocumentEditor({
  text,
  onTextChange,
  isMerging = false,
  isGeneratingDraft = false,
  objective,
  templateName,
}: SplitDocumentEditorProps) {
  const [viewMode, setViewMode] = useState<"split" | "edit" | "preview">("preview");

  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
  const readingTime = Math.max(1, Math.ceil(wordCount / 200));

  const handleDownload = () => {
    const blob = new Blob([text], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${templateName || "document"}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b shrink-0">
        <div className="flex items-center gap-1">
          <Button
            variant={viewMode === "split" ? "secondary" : "ghost"}
            size="sm"
            className="h-6 text-xs gap-1"
            onClick={() => setViewMode("split")}
          >
            <Columns2 className="w-3 h-3" />
            Split
          </Button>
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
        </div>

        <div className="flex items-center gap-2">
          {wordCount > 0 && (
            <>
              <Badge variant="outline" className="text-[10px] h-4">
                {wordCount.toLocaleString()} words
              </Badge>
              <Badge variant="outline" className="text-[10px] h-4">
                {readingTime} min read
              </Badge>
            </>
          )}
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
      </div>

      {/* Merging indicator */}
      {isMerging && (
        <div className="bg-primary/10 px-3 py-1.5 flex items-center gap-2 text-xs border-b">
          <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <span>Integrating feedback into document...</span>
        </div>
      )}

      {/* Generating draft indicator */}
      {isGeneratingDraft && !text.trim() && (
        <div className="flex-1 flex flex-col items-center justify-center gap-3">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-serif text-foreground/80">Generating your first draft...</p>
          <p className="text-xs text-muted-foreground/60">This may take a moment</p>
        </div>
      )}

      {/* Content area */}
      <div className={`flex-1 overflow-hidden flex ${isGeneratingDraft && !text.trim() ? "hidden" : ""}`}>
        {/* Editor pane */}
        {(viewMode === "split" || viewMode === "edit") && (
          <div
            className={`${
              viewMode === "split" ? "w-1/2 border-r" : "w-full"
            } h-full overflow-y-auto`}
          >
            <ProvokeText
              chrome="bare"
              variant="editor"
              value={text}
              onChange={onTextChange}
              placeholder="Start writing your document here..."
              className="text-sm leading-relaxed font-serif min-h-full p-4"
              showCopy
              showClear={false}
            />
          </div>
        )}

        {/* Preview pane */}
        {(viewMode === "split" || viewMode === "preview") && (
          <div
            className={`${
              viewMode === "split" ? "w-1/2" : "w-full"
            } h-full overflow-y-auto p-4`}
          >
            {text.trim() ? (
              <MarkdownRenderer content={text} />
            ) : (
              <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground/40">
                <Eye className="w-8 h-8" />
                <p className="text-sm">Preview will appear here</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
