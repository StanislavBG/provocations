import { useState, useCallback, useRef, useEffect } from "react";
import { ProvokeText } from "@/components/ProvokeText";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";
import { BSChartWorkspace } from "@/components/bschart/BSChartWorkspace";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { generateId } from "@/lib/utils";
import {
  Eye,
  Download,
  Target,
  ChevronDown,
  ChevronRight,
  Plus,
  X,
  FileText,
  GitGraph,
  Maximize2,
  Minimize2,
  ArrowUpDown,
  Lightbulb,
  Palette,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

interface DocTab {
  id: string;
  title: string;
  type: "document" | "chart";
}

/** Stored state for inactive tabs */
interface TabSnapshot {
  text: string;
  objective: string;
}

interface PreviewDoc {
  title: string;
  content: string;
}

interface SmartButtonDef {
  id: string;
  label: string;
  icon: LucideIcon;
  color: string;
  options: { id: string; label: string }[];
}

const SMART_BUTTONS: SmartButtonDef[] = [
  {
    id: "expand",
    label: "Expand",
    icon: Maximize2,
    color: "text-blue-500",
    options: [
      { id: "add-examples", label: "Add examples" },
      { id: "add-detail", label: "Add detail" },
      { id: "add-data", label: "Supporting data" },
    ],
  },
  {
    id: "condense",
    label: "Condense",
    icon: Minimize2,
    color: "text-amber-500",
    options: [
      { id: "tighten", label: "Tighten prose" },
      { id: "dedup", label: "Remove redundancy" },
      { id: "exec-summary", label: "Executive summary" },
    ],
  },
  {
    id: "restructure",
    label: "Restructure",
    icon: ArrowUpDown,
    color: "text-purple-500",
    options: [
      { id: "reorder", label: "Reorder sections" },
      { id: "headings", label: "Add headings" },
      { id: "outline", label: "Outline view" },
    ],
  },
  {
    id: "clarify",
    label: "Clarify",
    icon: Lightbulb,
    color: "text-green-500",
    options: [
      { id: "simplify", label: "Simplify language" },
      { id: "define", label: "Define terms" },
      { id: "context", label: "Add context" },
    ],
  },
  {
    id: "style",
    label: "Style",
    icon: Palette,
    color: "text-pink-500",
    options: [
      { id: "professional", label: "Professional" },
      { id: "casual", label: "Casual" },
      { id: "academic", label: "Academic" },
    ],
  },
];

interface SplitDocumentEditorProps {
  text: string;
  onTextChange: (text: string) => void;
  isMerging?: boolean;
  objective?: string;
  onObjectiveChange?: (objective: string) => void;
  templateName?: string;
  /** When set, shows a read-only preview of a context document */
  previewDoc?: PreviewDoc | null;
  onClosePreview?: () => void;
  /** Notifies parent when the active tab type changes (chart vs document) */
  onChartActiveChange?: (isActive: boolean) => void;
}

export function SplitDocumentEditor({
  text,
  onTextChange,
  isMerging = false,
  objective,
  onObjectiveChange,
  templateName,
  previewDoc,
  onClosePreview,
  onChartActiveChange,
}: SplitDocumentEditorProps) {
  const { toast } = useToast();
  const [objectiveExpanded, setObjectiveExpanded] = useState(true);

  // ── Chrome-style document tabs ──
  const [tabs, setTabs] = useState<DocTab[]>(() => [
    { id: "main", title: "Document 1", type: "document" },
  ]);
  const [activeTabId, setActiveTabId] = useState("main");
  const tabSnapshotRef = useRef<Map<string, TabSnapshot>>(new Map());
  const activeTab = tabs.find((t) => t.id === activeTabId);
  const isChartActive = activeTab?.type === "chart";

  // Notify parent when chart active state changes
  useEffect(() => {
    onChartActiveChange?.(isChartActive);
  }, [isChartActive, onChartActiveChange]);

  // ── Tab rename state ──
  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [editingTabValue, setEditingTabValue] = useState("");
  const tabEditRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingTabId) {
      tabEditRef.current?.focus();
      tabEditRef.current?.select();
    }
  }, [editingTabId]);

  // ── Smart buttons state ──
  const [expandedSmartBtn, setExpandedSmartBtn] = useState<string | null>(null);

  const handleSwitchTab = useCallback(
    (tabId: string) => {
      if (tabId === activeTabId) return;
      // Only save snapshot for document tabs
      const currentTab = tabs.find((t) => t.id === activeTabId);
      if (currentTab?.type === "document") {
        tabSnapshotRef.current.set(activeTabId, {
          text,
          objective: objective || "",
        });
      }
      // Only restore snapshot for document tabs
      const targetTab = tabs.find((t) => t.id === tabId);
      if (targetTab?.type === "document") {
        const snapshot = tabSnapshotRef.current.get(tabId);
        onTextChange(snapshot?.text ?? "");
        onObjectiveChange?.(snapshot?.objective ?? "");
      }
      setActiveTabId(tabId);
    },
    [activeTabId, text, objective, onTextChange, onObjectiveChange, tabs],
  );

  const handleAddTab = useCallback(() => {
    const currentTab = tabs.find((t) => t.id === activeTabId);
    if (currentTab?.type === "document") {
      tabSnapshotRef.current.set(activeTabId, {
        text,
        objective: objective || "",
      });
    }
    const newId = generateId("tab");
    const docCount = tabs.filter((t) => t.type === "document").length;
    const newTitle = `Document ${docCount + 1}`;
    setTabs((prev) => [...prev, { id: newId, title: newTitle, type: "document" }]);
    onTextChange("");
    onObjectiveChange?.("");
    setActiveTabId(newId);
  }, [activeTabId, text, objective, onTextChange, onObjectiveChange, tabs]);

  const handleAddChartTab = useCallback(() => {
    const currentTab = tabs.find((t) => t.id === activeTabId);
    if (currentTab?.type === "document") {
      tabSnapshotRef.current.set(activeTabId, {
        text,
        objective: objective || "",
      });
    }
    const newId = generateId("chart");
    const chartCount = tabs.filter((t) => t.type === "chart").length;
    const newTitle = `Chart ${chartCount + 1}`;
    setTabs((prev) => [...prev, { id: newId, title: newTitle, type: "chart" }]);
    setActiveTabId(newId);
  }, [activeTabId, text, objective, tabs]);

  const handleCloseTab = useCallback(
    (tabId: string) => {
      if (tabs.length <= 1) return;
      const idx = tabs.findIndex((t) => t.id === tabId);
      const newTabs = tabs.filter((t) => t.id !== tabId);
      tabSnapshotRef.current.delete(tabId);
      setTabs(newTabs);
      if (tabId === activeTabId) {
        const nextIdx = Math.min(idx, newTabs.length - 1);
        const nextTab = newTabs[nextIdx];
        if (nextTab.type === "document") {
          const snapshot = tabSnapshotRef.current.get(nextTab.id);
          onTextChange(snapshot?.text ?? "");
          onObjectiveChange?.(snapshot?.objective ?? "");
        }
        setActiveTabId(nextTab.id);
      }
    },
    [tabs, activeTabId, onTextChange, onObjectiveChange],
  );

  const handleStartRename = useCallback((tabId: string) => {
    const tab = tabs.find((t) => t.id === tabId);
    if (!tab) return;
    setEditingTabId(tabId);
    setEditingTabValue(tab.title);
  }, [tabs]);

  const handleCommitRename = useCallback(() => {
    if (!editingTabId) return;
    const trimmed = editingTabValue.trim();
    if (trimmed) {
      setTabs((prev) =>
        prev.map((t) => (t.id === editingTabId ? { ...t, title: trimmed } : t)),
      );
    }
    setEditingTabId(null);
  }, [editingTabId, editingTabValue]);

  const handleCancelRename = useCallback(() => {
    setEditingTabId(null);
  }, []);

  const handleSmartAction = useCallback(
    (btnId: string, optionId: string, optionLabel: string) => {
      toast({
        title: `${optionLabel}`,
        description: "Smart actions coming soon — this will use AI to transform your document.",
      });
      setExpandedSmartBtn(null);
    },
    [toast],
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

  const documentHeaderActions = (
    <div className="flex items-center gap-1">
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
          const isEditing = tab.id === editingTabId;
          return (
            <div
              key={tab.id}
              onClick={() => !isEditing && handleSwitchTab(tab.id)}
              onDoubleClick={() => handleStartRename(tab.id)}
              className={`group flex items-center gap-1 pl-3 pr-1 py-1.5 text-xs cursor-pointer transition-colors rounded-t-lg shrink-0 ${
                isActive
                  ? "bg-card border-t border-x border-border text-foreground font-medium -mb-px"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
              }`}
            >
              {tab.type === "chart" ? (
                <GitGraph className="w-3 h-3 shrink-0 text-cyan-500" />
              ) : (
                <FileText className="w-3 h-3 shrink-0" />
              )}
              {isEditing ? (
                <Input
                  ref={tabEditRef}
                  value={editingTabValue}
                  onChange={(e) => setEditingTabValue(e.target.value)}
                  className="h-5 text-xs px-1 py-0 w-[100px] bg-background"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleCommitRename();
                    if (e.key === "Escape") handleCancelRename();
                    e.stopPropagation();
                  }}
                  onClick={(e) => e.stopPropagation()}
                  onDoubleClick={(e) => e.stopPropagation()}
                  onBlur={handleCommitRename}
                />
              ) : (
                <span className="truncate max-w-[120px]">{tab.title}</span>
              )}
              {tabs.length > 1 && !isEditing && (
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
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={handleAddChartTab}
              className="flex items-center justify-center h-7 w-7 rounded-t-lg text-muted-foreground hover:text-cyan-500 hover:bg-cyan-50 dark:hover:bg-cyan-950/30 transition-colors shrink-0 mb-px"
            >
              <GitGraph className="w-3.5 h-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent>New chart tab</TooltipContent>
        </Tooltip>
      </div>

      {/* ─── Smart Buttons toolbar (document tabs only) ─── */}
      {!isChartActive && (
        <div className="shrink-0 border-b bg-card">
          <div className="flex items-center gap-1 px-2 py-1.5 overflow-x-auto">
            <Sparkles className="w-3 h-3 text-primary/50 shrink-0 mr-0.5" />
            {SMART_BUTTONS.map((btn) => {
              const Icon = btn.icon;
              const isExpanded = expandedSmartBtn === btn.id;
              return (
                <button
                  key={btn.id}
                  onClick={() =>
                    setExpandedSmartBtn(isExpanded ? null : btn.id)
                  }
                  className={`flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-medium transition-all shrink-0 ${
                    isExpanded
                      ? "bg-primary/10 text-primary ring-1 ring-primary/20"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                  }`}
                >
                  <Icon className={`w-3 h-3 ${isExpanded ? "text-primary" : btn.color}`} />
                  {btn.label}
                </button>
              );
            })}
          </div>

          {/* Expanded sub-options */}
          {expandedSmartBtn && (
            <div className="flex items-center gap-1 px-3 pb-1.5 overflow-x-auto animate-in slide-in-from-top-1 duration-150">
              <span className="text-[10px] text-muted-foreground/60 mr-1 shrink-0">Options:</span>
              {SMART_BUTTONS.find((b) => b.id === expandedSmartBtn)?.options.map(
                (opt) => (
                  <button
                    key={opt.id}
                    onClick={() =>
                      handleSmartAction(expandedSmartBtn, opt.id, opt.label)
                    }
                    className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-muted/60 text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors shrink-0"
                  >
                    {opt.label}
                  </button>
                ),
              )}
            </div>
          )}
        </div>
      )}

      {/* Merging indicator */}
      {isMerging && !isChartActive && (
        <div className="bg-primary/10 px-3 py-1.5 flex items-center gap-2 text-xs border-b shrink-0">
          <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <span>Integrating feedback into document...</span>
        </div>
      )}

      {/* ─── Chart tab instances (always mounted to preserve state) ─── */}
      {tabs
        .filter((t) => t.type === "chart")
        .map((tab) => (
          <div
            key={tab.id}
            className={
              tab.id === activeTabId ? "flex-1 min-h-0" : "hidden"
            }
          >
            <BSChartWorkspace />
          </div>
        ))}

      {/* Context document preview */}
      {!isChartActive && previewDoc ? (
        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex items-center justify-between px-3 py-1.5 border-b shrink-0 bg-muted/30">
            <div className="flex items-center gap-1.5 min-w-0">
              <Eye className="w-3.5 h-3.5 text-primary/70 shrink-0" />
              <span className="text-xs font-semibold truncate">
                {previewDoc.title}
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-xs gap-1 shrink-0"
              onClick={onClosePreview}
            >
              <X className="w-3 h-3" />
              Close Preview
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            <MarkdownRenderer content={previewDoc.content} />
          </div>
        </div>
      ) : !isChartActive ? (
        <div className="flex-1 flex flex-col min-h-0">
          {/* ─── Objective pane (collapsible) ─── */}
          <div className="shrink-0 border-b">
            <button
              type="button"
              onClick={() => setObjectiveExpanded(!objectiveExpanded)}
              className="w-full flex items-center gap-1.5 px-3 py-1 text-left hover:bg-muted/30 transition-colors"
            >
              <Target className="w-3 h-3 text-primary/70 shrink-0" />
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
                  chrome="inline"
                  variant="textarea"
                  value={objective || ""}
                  onChange={onObjectiveChange || (() => {})}
                  placeholder="What are you trying to achieve with this document?"
                  className="text-sm"
                  readOnly={!onObjectiveChange}
                  showWordCount={false}
                  showReadingTime={false}
                  minRows={2}
                  maxRows={4}
                />
              </div>
            )}
          </div>

          {/* ─── Document pane (remaining ~80%) ─── */}
          <ProvokeText
            chrome="container"
            variant="editor"
            containerClassName="flex-1 min-h-0"
            value={text}
            onChange={onTextChange}
            placeholder="Start writing your document here... (Markdown supported)"
            headerActions={documentHeaderActions}
            className="text-sm leading-relaxed font-serif"
          />
        </div>
      ) : null}
    </div>
  );
}
