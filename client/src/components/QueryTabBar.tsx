import { useState, useRef, useEffect } from "react";
import { Plus, X, Search, FileCode } from "lucide-react";

export interface QueryTab {
  id: string;
  title: string;
}

export const ANALYZER_TAB_ID = "__query_analyzer__";

interface QueryTabBarProps {
  tabs: QueryTab[];
  activeTabId: string;
  onTabSelect: (id: string) => void;
  onTabClose: (id: string) => void;
  onTabRename: (id: string, newTitle: string) => void;
  onNewTab: () => void;
}

export function QueryTabBar({
  tabs,
  activeTabId,
  onTabSelect,
  onTabClose,
  onTabRename,
  onNewTab,
}: QueryTabBarProps) {
  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (editingTabId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingTabId]);

  const handleDoubleClick = (tab: QueryTab) => {
    // Don't allow renaming the analyzer tab
    if (tab.id === ANALYZER_TAB_ID) return;
    setEditingTabId(tab.id);
    setEditValue(tab.title);
  };

  const commitRename = () => {
    if (editingTabId && editValue.trim()) {
      onTabRename(editingTabId, editValue.trim());
    }
    setEditingTabId(null);
  };

  const isAnalyzerActive = activeTabId === ANALYZER_TAB_ID;

  // Separate document tabs from the analyzer tab
  const docTabs = tabs.filter(t => t.id !== ANALYZER_TAB_ID);

  return (
    <div
      ref={scrollRef}
      className="flex items-end gap-0.5 px-2 pt-1.5 bg-muted/30 border-b overflow-x-auto scrollbar-none shrink-0"
    >
      {/* Document tabs */}
      {docTabs.map((tab) => {
        const isActive = tab.id === activeTabId;
        const isEditing = tab.id === editingTabId;

        return (
          <div
            key={tab.id}
            className={`group flex items-center gap-1.5 pl-3 pr-1.5 py-1.5 text-sm rounded-t-lg cursor-pointer transition-colors select-none min-w-0 ${
              isActive
                ? "bg-background border border-b-background border-border font-medium -mb-px z-10"
                : "bg-muted/50 border border-transparent hover:bg-muted text-muted-foreground"
            }`}
            onClick={() => !isEditing && onTabSelect(tab.id)}
            onDoubleClick={() => handleDoubleClick(tab)}
          >
            <FileCode className="w-3.5 h-3.5 shrink-0 opacity-50" />
            {isEditing ? (
              <input
                ref={inputRef}
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onBlur={commitRename}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitRename();
                  if (e.key === "Escape") setEditingTabId(null);
                }}
                className="bg-transparent border-none outline-none text-sm w-full min-w-[60px] max-w-[160px]"
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <span className="truncate max-w-[160px]">{tab.title}</span>
            )}
            {docTabs.length > 1 && !isEditing && (
              <button
                className={`rounded p-0.5 transition-opacity shrink-0 ${
                  isActive
                    ? "opacity-60 hover:opacity-100 hover:bg-foreground/10"
                    : "opacity-0 group-hover:opacity-100 hover:bg-foreground/10"
                }`}
                onClick={(e) => {
                  e.stopPropagation();
                  onTabClose(tab.id);
                }}
                title="Close tab"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        );
      })}

      {/* New tab button */}
      <button
        className="flex items-center justify-center w-7 h-7 rounded-t-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground mb-0.5 shrink-0"
        onClick={onNewTab}
        title="New query tab"
      >
        <Plus className="w-3.5 h-3.5" />
      </button>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Fixed Query Analyzer tab (always present, right-aligned) */}
      <div
        className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-t-lg cursor-pointer transition-colors select-none shrink-0 ${
          isAnalyzerActive
            ? "bg-background border border-b-background border-border font-medium -mb-px z-10"
            : "bg-muted/50 border border-transparent hover:bg-muted text-muted-foreground"
        }`}
        onClick={() => onTabSelect(ANALYZER_TAB_ID)}
      >
        <Search className={`w-3.5 h-3.5 shrink-0 ${isAnalyzerActive ? "text-primary" : "opacity-50"}`} />
        <span className="truncate">Query Analyzer</span>
      </div>
    </div>
  );
}
