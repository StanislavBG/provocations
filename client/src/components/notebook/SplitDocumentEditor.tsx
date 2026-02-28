import { useState, useCallback, useRef, useEffect, useImperativeHandle, forwardRef } from "react";
import { ProvokeText } from "@/components/ProvokeText";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";
import { BSChartWorkspace } from "@/components/bschart/BSChartWorkspace";
import { ImageCanvas } from "./ImageCanvas";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
  CheckCircle2,
  Sparkles,
  Save,
  Loader2,
  Wand2,
  Paintbrush,
  RotateCcw,
  type LucideIcon,
} from "lucide-react";

interface DocTab {
  id: string;
  title: string;
  type: "document" | "chart" | "image";
}

/** Stored state for inactive tabs */
interface TabSnapshot {
  text: string;
  objective: string;
}

/** Data for an image tab */
export interface ImageTabData {
  imageUrl: string | null;
  prompt: string;
  isGenerating: boolean;
}

interface PreviewDoc {
  title: string;
  content: string;
}

interface SmartOption {
  id: string;
  label: string;
  description: string;
}

interface SmartButtonDef {
  id: string;
  label: string;
  icon: LucideIcon;
  color: string;
  activeBg: string;
  options: SmartOption[];
}

/** A selected writer configuration passed to the evolve handler */
export interface WriterConfig {
  category: string;
  option: string;
  categoryLabel: string;
  optionLabel: string;
}

const SMART_BUTTONS: SmartButtonDef[] = [
  {
    id: "expand",
    label: "Expand",
    icon: Maximize2,
    color: "text-blue-500",
    activeBg: "bg-blue-500/10 border-blue-500/30 text-blue-700 dark:text-blue-400",
    options: [
      { id: "add-examples", label: "Add examples", description: "Concrete illustrations and use cases" },
      { id: "add-detail", label: "Add detail", description: "Deeper explanations and supporting info" },
      { id: "add-data", label: "Supporting data", description: "Statistics, evidence, and references" },
    ],
  },
  {
    id: "condense",
    label: "Condense",
    icon: Minimize2,
    color: "text-amber-500",
    activeBg: "bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-400",
    options: [
      { id: "tighten", label: "Tighten prose", description: "Remove filler words and weak phrasing" },
      { id: "dedup", label: "Remove redundancy", description: "Eliminate repeated ideas and content" },
      { id: "exec-summary", label: "Executive summary", description: "Create a concise overview" },
    ],
  },
  {
    id: "restructure",
    label: "Restructure",
    icon: ArrowUpDown,
    color: "text-purple-500",
    activeBg: "bg-purple-500/10 border-purple-500/30 text-purple-700 dark:text-purple-400",
    options: [
      { id: "reorder", label: "Reorder sections", description: "Improve logical flow and progression" },
      { id: "headings", label: "Add headings", description: "Create section hierarchy and navigation" },
      { id: "outline", label: "Outline view", description: "Convert to structured outline format" },
    ],
  },
  {
    id: "clarify",
    label: "Clarify",
    icon: Lightbulb,
    color: "text-green-500",
    activeBg: "bg-green-500/10 border-green-500/30 text-green-700 dark:text-green-400",
    options: [
      { id: "simplify", label: "Simplify language", description: "Make complex ideas accessible" },
      { id: "define", label: "Define terms", description: "Add definitions for jargon and acronyms" },
      { id: "context", label: "Add context", description: "Background info for new readers" },
    ],
  },
  {
    id: "style",
    label: "Style",
    icon: Palette,
    color: "text-pink-500",
    activeBg: "bg-pink-500/10 border-pink-500/30 text-pink-700 dark:text-pink-400",
    options: [
      { id: "professional", label: "Professional", description: "Formal business tone" },
      { id: "casual", label: "Casual", description: "Conversational and friendly" },
      { id: "academic", label: "Academic", description: "Scholarly and precise" },
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
  /** Save the current document + objective to the Context Store */
  onSaveToContext?: () => void;
  isSaving?: boolean;
  /** Evolve the document using the writer with selected configurations */
  onEvolve?: (configurations: WriterConfig[]) => void;
  isEvolving?: boolean;
  /** Image tab data keyed by tab ID */
  imageTabData?: Map<string, ImageTabData>;
  /** Callback when an image tab is added externally (e.g. from Painter) */
  onAddImageTab?: (tabId: string) => void;
  /** Notifies parent when the active tab type changes to image */
  onImageActiveChange?: (isActive: boolean, tabId: string | null) => void;
}

/** Imperative handle for parent to add image tabs */
export interface SplitDocumentEditorHandle {
  addImageTab: (tabId?: string) => void;
}

export const SplitDocumentEditor = forwardRef<SplitDocumentEditorHandle, SplitDocumentEditorProps>(function SplitDocumentEditor({
  text,
  onTextChange,
  isMerging = false,
  objective,
  onObjectiveChange,
  templateName,
  previewDoc,
  onClosePreview,
  onChartActiveChange,
  onSaveToContext,
  isSaving = false,
  onEvolve,
  isEvolving = false,
  imageTabData,
  onAddImageTab,
  onImageActiveChange,
}: SplitDocumentEditorProps, ref: React.Ref<SplitDocumentEditorHandle>) {
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
  const isImageActive = activeTab?.type === "image";
  const isDocumentActive = activeTab?.type === "document";

  // Notify parent when chart active state changes
  useEffect(() => {
    onChartActiveChange?.(isChartActive);
  }, [isChartActive, onChartActiveChange]);

  // Notify parent when image active state changes
  useEffect(() => {
    onImageActiveChange?.(isImageActive, isImageActive ? activeTabId : null);
  }, [isImageActive, activeTabId, onImageActiveChange]);

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

  // ── Multi-select writer controls ──
  // Which categories are expanded (showing sub-options)
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  // Map of categoryId → Set of selected optionIds
  const [selectedConfigs, setSelectedConfigs] = useState<Map<string, Set<string>>>(new Map());

  const totalSelected = Array.from(selectedConfigs.values()).reduce(
    (sum, s) => sum + s.size,
    0,
  );

  const toggleCategory = useCallback((catId: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(catId)) next.delete(catId);
      else next.add(catId);
      return next;
    });
  }, []);

  const toggleOption = useCallback((catId: string, optId: string) => {
    setSelectedConfigs((prev) => {
      const next = new Map(prev);
      const catSet = new Set(next.get(catId) || []);
      if (catSet.has(optId)) catSet.delete(optId);
      else catSet.add(optId);
      if (catSet.size === 0) next.delete(catId);
      else next.set(catId, catSet);
      return next;
    });
  }, []);

  const clearSelections = useCallback(() => {
    setSelectedConfigs(new Map());
  }, []);

  /** Build the array of WriterConfig from current selections */
  const buildConfigs = useCallback((): WriterConfig[] => {
    const configs: WriterConfig[] = [];
    SMART_BUTTONS.forEach((btn) => {
      const optIds = selectedConfigs.get(btn.id);
      if (!optIds || optIds.size === 0) return;
      btn.options.forEach((opt) => {
        if (optIds.has(opt.id)) {
          configs.push({
            category: btn.id,
            option: opt.id,
            categoryLabel: btn.label,
            optionLabel: opt.label,
          });
        }
      });
    });
    return configs;
  }, [selectedConfigs]);

  const handleEvolve = useCallback(() => {
    if (!onEvolve || !text.trim()) {
      if (!text.trim()) {
        toast({ title: "Nothing to write", description: "Write some content first." });
      }
      return;
    }
    const configs = buildConfigs();
    if (configs.length === 0) {
      // No specific options selected — general evolve
      onEvolve([{ category: "general", option: "general", categoryLabel: "General", optionLabel: "Improve" }]);
    } else {
      onEvolve(configs);
    }
    // Clear selections after evolving
    clearSelections();
  }, [onEvolve, text, buildConfigs, clearSelections, toast]);

  // Count selected options per category (for badges)
  const getCategorySelectedCount = (catId: string): number =>
    selectedConfigs.get(catId)?.size || 0;

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

  const handleAddImageTab = useCallback((externalTabId?: string) => {
    const currentTab = tabs.find((t) => t.id === activeTabId);
    if (currentTab?.type === "document") {
      tabSnapshotRef.current.set(activeTabId, {
        text,
        objective: objective || "",
      });
    }
    const newId = externalTabId || generateId("img");
    // Check if tab already exists (external add may target existing)
    const exists = tabs.find((t) => t.id === newId);
    if (exists) {
      setActiveTabId(newId);
      return;
    }
    const imgCount = tabs.filter((t) => t.type === "image").length;
    const newTitle = `Image ${imgCount + 1}`;
    setTabs((prev) => [...prev, { id: newId, title: newTitle, type: "image" }]);
    setActiveTabId(newId);
    onAddImageTab?.(newId);
  }, [activeTabId, text, objective, tabs, onAddImageTab]);

  // Expose addImageTab to parent via ref
  useImperativeHandle(ref, () => ({
    addImageTab: (tabId?: string) => handleAddImageTab(tabId),
  }), [handleAddImageTab]);

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
              ) : tab.type === "image" ? (
                <Paintbrush className="w-3 h-3 shrink-0 text-rose-500" />
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
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => handleAddImageTab()}
              className="flex items-center justify-center h-7 w-7 rounded-t-lg text-muted-foreground hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors shrink-0 mb-px"
            >
              <Paintbrush className="w-3.5 h-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent>New image tab</TooltipContent>
        </Tooltip>
      </div>

      {/* ─── Writer Controls toolbar (document tabs only) ─── */}
      {isDocumentActive && (
        <div className="shrink-0 border-b bg-card">
          {/* Category row: clickable pills that expand sub-options */}
          <div className="flex items-center gap-1 px-2 py-1.5 overflow-x-auto">
            <Sparkles className="w-3 h-3 text-primary/50 shrink-0 mr-0.5" />
            {SMART_BUTTONS.map((btn) => {
              const Icon = btn.icon;
              const isExpanded = expandedCategories.has(btn.id);
              const selectedCount = getCategorySelectedCount(btn.id);
              return (
                <button
                  key={btn.id}
                  onClick={() => toggleCategory(btn.id)}
                  className={`flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-medium transition-all shrink-0 ${
                    selectedCount > 0
                      ? `${btn.activeBg} border`
                      : isExpanded
                        ? "bg-primary/10 text-primary ring-1 ring-primary/20"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                  }`}
                >
                  <Icon className={`w-3 h-3 ${selectedCount > 0 ? "" : isExpanded ? "text-primary" : btn.color}`} />
                  {btn.label}
                  {selectedCount > 0 && (
                    <Badge className="h-3.5 min-w-[14px] px-1 text-[9px] bg-foreground/15 text-current">
                      {selectedCount}
                    </Badge>
                  )}
                </button>
              );
            })}

            {/* Separator + action buttons */}
            <div className="w-px h-4 bg-border/60 mx-1 shrink-0" />

            {onSaveToContext && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={onSaveToContext}
                    disabled={isSaving || !text.trim()}
                    className="flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-medium transition-colors shrink-0 text-muted-foreground hover:text-foreground hover:bg-muted/60 disabled:opacity-40"
                  >
                    {isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                    Save
                  </button>
                </TooltipTrigger>
                <TooltipContent>Save document to Context Store</TooltipContent>
              </Tooltip>
            )}

            {onEvolve && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={handleEvolve}
                    disabled={isEvolving || !text.trim()}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium transition-all shrink-0 disabled:opacity-40 ${
                      totalSelected > 0
                        ? "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90"
                        : "bg-primary/10 text-primary hover:bg-primary/20"
                    }`}
                  >
                    {isEvolving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
                    Writer{totalSelected > 0 ? ` (${totalSelected})` : ""}
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  {totalSelected > 0
                    ? `Apply ${totalSelected} configuration${totalSelected > 1 ? "s" : ""} to write document`
                    : "General document improvement"}
                </TooltipContent>
              </Tooltip>
            )}

            {totalSelected > 0 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={clearSelections}
                    className="flex items-center justify-center w-5 h-5 rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0"
                  >
                    <RotateCcw className="w-2.5 h-2.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>Clear all selections</TooltipContent>
              </Tooltip>
            )}
          </div>

          {/* Expanded sub-options — multi-select chips */}
          {expandedCategories.size > 0 && (
            <div className="px-3 pb-2 space-y-1 animate-in slide-in-from-top-1 duration-150">
              {SMART_BUTTONS.filter((b) => expandedCategories.has(b.id)).map(
                (btn) => {
                  const catSelected = selectedConfigs.get(btn.id);
                  return (
                    <div key={btn.id} className="flex items-center gap-1 flex-wrap">
                      <span className={`text-[10px] font-semibold uppercase tracking-wider mr-1 shrink-0 ${btn.color}`}>
                        {btn.label}
                      </span>
                      {btn.options.map((opt) => {
                        const isSelected = catSelected?.has(opt.id) || false;
                        return (
                          <Tooltip key={opt.id}>
                            <TooltipTrigger asChild>
                              <button
                                onClick={() => toggleOption(btn.id, opt.id)}
                                className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium transition-all shrink-0 border ${
                                  isSelected
                                    ? `${btn.activeBg}`
                                    : "bg-muted/40 border-transparent text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                                }`}
                              >
                                {isSelected && (
                                  <CheckCircle2 className="w-2.5 h-2.5 shrink-0" />
                                )}
                                {opt.label}
                              </button>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" className="text-[11px]">
                              {opt.description}
                            </TooltipContent>
                          </Tooltip>
                        );
                      })}
                    </div>
                  );
                },
              )}
            </div>
          )}
        </div>
      )}

      {/* Merging indicator */}
      {isMerging && isDocumentActive && (
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

      {/* ─── Image tab instances (always mounted to preserve state) ─── */}
      {tabs
        .filter((t) => t.type === "image")
        .map((tab) => {
          const data = imageTabData?.get(tab.id);
          return (
            <div
              key={tab.id}
              className={
                tab.id === activeTabId ? "flex-1 min-h-0" : "hidden"
              }
            >
              <ImageCanvas
                imageUrl={data?.imageUrl ?? null}
                prompt={data?.prompt ?? ""}
                isGenerating={data?.isGenerating ?? false}
              />
            </div>
          );
        })}

      {/* Context document preview */}
      {isDocumentActive && previewDoc ? (
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
      ) : isDocumentActive ? (
        <div className="flex-1 flex flex-col min-h-0">
          {/* ─── Objective pane (collapsible) ─── */}
          <div className="shrink-0 border-b overflow-hidden max-h-[180px]">
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
                  maxRows={3}
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
});
