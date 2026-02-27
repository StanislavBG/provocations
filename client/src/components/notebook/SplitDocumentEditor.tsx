import { useState, useCallback, useRef } from "react";
import { ProvokeText } from "@/components/ProvokeText";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { generateId } from "@/lib/utils";
import {
  Eye,
  Pencil,
  Download,
  Target,
  ChevronDown,
  ChevronRight,
  Plus,
  X,
  FileText,
} from "lucide-react";

interface DocTab {
  id: string;
  title: string;
}

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

  // ── Chrome-style document tabs ──
  const [tabs, setTabs] = useState<DocTab[]>(() => [
    { id: "main", title: "Document 1" },
  ]);
  const [activeTabId, setActiveTabId] = useState("main");
  // Stores content for inactive tabs (active tab uses `text` prop directly)
  const tabContentRef = useRef<Map<string, string>>(new Map());

  const handleSwitchTab = useCallback(
    (tabId: string) => {
      if (tabId === activeTabId) return;
      // Save current content
      tabContentRef.current.set(activeTabId, text);
      // Load new tab
      const newContent = tabContentRef.current.get(tabId) ?? "";
      onTextChange(newContent);
      setActiveTabId(tabId);
    },
    [activeTabId, text, onTextChange],
  );

  const handleAddTab = useCallback(() => {
    tabContentRef.current.set(activeTabId, text);
    const newId = generateId("tab");
    const newTitle = `Document ${tabs.length + 1}`;
    setTabs((prev) => [...prev, { id: newId, title: newTitle }]);
    onTextChange("");
    setActiveTabId(newId);
  }, [activeTabId, text, onTextChange, tabs.length]);

  const handleCloseTab = useCallback(
    (tabId: string) => {
      if (tabs.length <= 1) return;
      const idx = tabs.findIndex((t) => t.id === tabId);
      const newTabs = tabs.filter((t) => t.id !== tabId);
      tabContentRef.current.delete(tabId);
      setTabs(newTabs);
      if (tabId === activeTabId) {
        const nextIdx = Math.min(idx, newTabs.length - 1);
        const nextTab = newTabs[nextIdx];
        const nextContent = tabContentRef.current.get(nextTab.id) ?? "";
        onTextChange(nextContent);
        setActiveTabId(nextTab.id);
      }
    },
    [tabs, activeTabId, onTextChange],
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
      {/* ─── Chrome-style document tab bar ─── */}
      <div className="flex items-end bg-muted/30 shrink-0 overflow-x-auto pl-1 pt-1 gap-px border-b">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          return (
            <div
              key={tab.id}
              onClick={() => handleSwitchTab(tab.id)}
              className={`group flex items-center gap-1 pl-3 pr-1 py-1.5 text-xs cursor-pointer transition-colors rounded-t-lg shrink-0 ${
                isActive
                  ? "bg-card border-t border-x border-border text-foreground font-medium -mb-px"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
              }`}
            >
              <FileText className="w-3 h-3 shrink-0" />
              <span className="truncate max-w-[120px]">{tab.title}</span>
              {tabs.length > 1 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCloseTab(tab.id);
                  }}
                  className="ml-1 h-4 w-4 flex items-center justify-center rounded-sm opacity-0 group-hover:opacity-100 hover:bg-muted transition-opacity"
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              )}
            </div>
          );
        })}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={handleAddTab}
              className="flex items-center justify-center h-7 w-7 rounded-t-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors shrink-0 mb-px"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent>New document tab</TooltipContent>
        </Tooltip>
      </div>

      {/* ─── Objective bar (expandable) ─── */}
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
          containerClassName="flex-1 min-h-0"
          value={text}
          onChange={onTextChange}
          placeholder="Start writing your document here... (Markdown supported)"
          label="Document"
          headerActions={modeToggle}
          className="text-sm leading-relaxed font-serif"
        />
      )}

      {/* Preview mode: rendered markdown */}
      {viewMode === "preview" && (
        <div className="flex-1 flex flex-col min-h-0">
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
