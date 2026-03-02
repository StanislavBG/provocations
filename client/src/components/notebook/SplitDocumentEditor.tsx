import { useState, useCallback, useRef, useEffect, useImperativeHandle, forwardRef } from "react";
import { ProvokeText } from "@/components/ProvokeText";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";
import { BSChartWorkspace } from "@/components/bschart/BSChartWorkspace";
import { TimelineWorkspace } from "@/components/timeline/TimelineWorkspace";
import { ImageCanvas } from "./ImageCanvas";
import { ImageLightbox, extractImageUrl } from "./ImageLightbox";
import { VoiceRecorder } from "@/components/VoiceRecorder";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { generateId } from "@/lib/utils";
import { cn } from "@/lib/utils";
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
  Save,
  Loader2,
  Paintbrush,
  Clock,
  Maximize2,
  PenLine,
  Mic,
  Pencil,
  Send,
} from "lucide-react";

interface DocTab {
  id: string;
  title: string;
  type: "document" | "chart" | "image" | "timeline";
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

export interface PreviewDoc {
  title: string;
  content: string;
  /** Document ID from the store — enables "Open Document" action */
  docId?: number;
}


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
  /** Opens the previewed document as the active workspace document */
  onOpenPreviewDoc?: (content: string, title: string, docId?: number) => void;
  /** Notifies parent when the active tab type changes (chart vs document) */
  onChartActiveChange?: (isActive: boolean) => void;
  /** Save the current document + objective to the Context Store */
  onSaveToContext?: () => void;
  /** Save an image to the Context Store */
  onSaveImageToContext?: (imageUrl: string, prompt: string) => void;
  isSaving?: boolean;
  /** Image tab data keyed by tab ID */
  imageTabData?: Map<string, ImageTabData>;
  /** Callback when an image tab is added externally (e.g. from Painter) */
  onAddImageTab?: (tabId: string) => void;
  /** Notifies parent when the active tab type changes to image */
  onImageActiveChange?: (isActive: boolean, tabId: string | null) => void;
  /** Save timeline JSON to the Context Store */
  onSaveTimelineToContext?: (json: string, label: string) => void;
  /**
   * Callback for writer voice/edit feedback. Sends user feedback through
   * the write mutation to be intelligently remixed into the document.
   * @param instruction - The feedback/instruction text
   * @param selectedText - Optional selected text the feedback targets
   * @param description - Optional description for the edit history
   */
  onWriterFeedback?: (instruction: string, selectedText?: string, description?: string) => void;
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
  onOpenPreviewDoc,
  onChartActiveChange,
  onSaveToContext,
  onSaveImageToContext,
  isSaving = false,
  imageTabData,
  onAddImageTab,
  onImageActiveChange,
  onSaveTimelineToContext,
  onWriterFeedback,
}: SplitDocumentEditorProps, ref: React.Ref<SplitDocumentEditorHandle>) {
  const { toast } = useToast();
  const [objectiveExpanded, setObjectiveExpanded] = useState(true);
  const [previewLightbox, setPreviewLightbox] = useState(false);

  // ── Writer voice feedback state ──
  const [writerVoiceActive, setWriterVoiceActive] = useState(false);
  const [writerFeedbackText, setWriterFeedbackText] = useState("");

  // ── Selection popover state ──
  const [selectionPopover, setSelectionPopover] = useState<{
    text: string;
    top: number;
    left: number;
  } | null>(null);
  const [selectionEditMode, setSelectionEditMode] = useState(false);
  const [selectionEditText, setSelectionEditText] = useState("");
  const [selectionVoiceActive, setSelectionVoiceActive] = useState(false);
  const editorContainerRef = useRef<HTMLDivElement>(null);

  // ── Chrome-style document tabs ──
  const [tabs, setTabs] = useState<DocTab[]>(() => [
    { id: "main", title: "Document 1", type: "document" },
  ]);
  const [activeTabId, setActiveTabId] = useState("main");
  const tabSnapshotRef = useRef<Map<string, TabSnapshot>>(new Map());
  const activeTab = tabs.find((t) => t.id === activeTabId);
  const isChartActive = activeTab?.type === "chart" || activeTab?.type === "timeline";
  const isImageActive = activeTab?.type === "image";
  const isDocumentActive = activeTab?.type === "document";
  const isTimelineActive = activeTab?.type === "timeline";

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

  const handleAddTimelineTab = useCallback(() => {
    const currentTab = tabs.find((t) => t.id === activeTabId);
    if (currentTab?.type === "document") {
      tabSnapshotRef.current.set(activeTabId, {
        text,
        objective: objective || "",
      });
    }
    const newId = generateId("tl");
    const tlCount = tabs.filter((t) => t.type === "timeline").length;
    const newTitle = `Timeline ${tlCount + 1}`;
    setTabs((prev) => [...prev, { id: newId, title: newTitle, type: "timeline" }]);
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

  // ── Writer voice feedback handler ──
  const handleWriterVoiceTranscript = useCallback(
    (transcript: string) => {
      if (!transcript.trim() || !onWriterFeedback) return;
      onWriterFeedback(
        transcript,
        undefined,
        "Writer voice feedback",
      );
      setWriterVoiceActive(false);
      toast({ title: "Feedback sent", description: "Remixing your feedback into the document..." });
    },
    [onWriterFeedback, toast],
  );

  // ── Writer text feedback handler (from input) ──
  const handleWriterTextSubmit = useCallback(() => {
    if (!writerFeedbackText.trim() || !onWriterFeedback) return;
    onWriterFeedback(
      writerFeedbackText.trim(),
      undefined,
      "Writer text feedback",
    );
    setWriterFeedbackText("");
    toast({ title: "Feedback sent", description: "Remixing your feedback into the document..." });
  }, [writerFeedbackText, onWriterFeedback, toast]);

  // ── Selection popover handlers ──
  const handleTextSelect = useCallback(() => {
    if (!onWriterFeedback) return;
    const selection = window.getSelection();
    const selectedText = selection?.toString().trim();
    if (!selectedText || selectedText.length < 3) {
      setSelectionPopover(null);
      return;
    }

    // Get position relative to the editor container
    const range = selection?.getRangeAt(0);
    if (!range || !editorContainerRef.current) return;
    const rect = range.getBoundingClientRect();
    const containerRect = editorContainerRef.current.getBoundingClientRect();

    setSelectionPopover({
      text: selectedText,
      top: rect.top - containerRect.top - 40,
      left: rect.left - containerRect.left + rect.width / 2,
    });
    setSelectionEditMode(false);
    setSelectionEditText("");
    setSelectionVoiceActive(false);
  }, [onWriterFeedback]);

  // Close selection popover on click outside
  useEffect(() => {
    if (!selectionPopover) return;
    const handleMouseDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest("[data-selection-popover]")) return;
      // Small delay to allow selection to happen
      setTimeout(() => {
        const sel = window.getSelection();
        if (!sel?.toString().trim()) {
          setSelectionPopover(null);
        }
      }, 100);
    };
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [selectionPopover]);

  const handleSelectionVoiceTranscript = useCallback(
    (transcript: string) => {
      if (!transcript.trim() || !onWriterFeedback || !selectionPopover) return;
      onWriterFeedback(
        transcript,
        selectionPopover.text,
        "Voice feedback on selection",
      );
      setSelectionPopover(null);
      setSelectionVoiceActive(false);
      window.getSelection()?.removeAllRanges();
      toast({ title: "Feedback sent", description: "Remixing your feedback into the selected area..." });
    },
    [onWriterFeedback, selectionPopover, toast],
  );

  const handleSelectionEditSubmit = useCallback(() => {
    if (!selectionEditText.trim() || !onWriterFeedback || !selectionPopover) return;
    onWriterFeedback(
      selectionEditText.trim(),
      selectionPopover.text,
      "Edit feedback on selection",
    );
    setSelectionPopover(null);
    setSelectionEditMode(false);
    setSelectionEditText("");
    window.getSelection()?.removeAllRanges();
    toast({ title: "Feedback sent", description: "Remixing your feedback into the selected area..." });
  }, [selectionEditText, onWriterFeedback, selectionPopover, toast]);

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
      {onSaveToContext && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={onSaveToContext}
              disabled={isSaving || !text.trim()}
              title="Save to Context Store"
            >
              {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            </Button>
          </TooltipTrigger>
          <TooltipContent>Save to Context Store</TooltipContent>
        </Tooltip>
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
  );

  // ── Writer feedback row (second row under toolbar) ──
  const writerFeedbackRow = onWriterFeedback ? (
    <div className="flex items-center gap-1.5 px-4 py-1.5 border-b bg-muted/20">
      <Tooltip>
        <TooltipTrigger asChild>
          <div>
            <VoiceRecorder
              onTranscript={handleWriterVoiceTranscript}
              onRecordingChange={setWriterVoiceActive}
              size="icon"
              variant={writerVoiceActive ? "destructive" : "ghost"}
              className="h-7 w-7"
            />
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p className="font-semibold">Writer Voice</p>
          <p className="text-xs text-muted-foreground">Dictate feedback for the AI to remix into your document</p>
        </TooltipContent>
      </Tooltip>
      {writerVoiceActive ? (
        <span className="text-xs text-primary animate-pulse flex-1">
          Listening for feedback... speak your changes, the AI will remix them into the document
        </span>
      ) : (
        <div className="flex items-center gap-1.5 flex-1">
          <PenLine className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          <input
            type="text"
            value={writerFeedbackText}
            onChange={(e) => setWriterFeedbackText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleWriterTextSubmit();
              }
            }}
            placeholder="Type feedback for the AI to remix into the document..."
            className="flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground/50"
            disabled={isMerging}
          />
          {writerFeedbackText.trim() && (
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6 shrink-0"
              onClick={handleWriterTextSubmit}
              disabled={isMerging}
            >
              <Send className="w-3 h-3" />
            </Button>
          )}
        </div>
      )}
    </div>
  ) : null;

  // ── Selection popover (Voice + Edit on highlighted text) ──
  const selectionPopoverEl = selectionPopover ? (
    <div
      data-selection-popover
      className="absolute z-50 flex flex-col items-center gap-1"
      style={{
        top: `${selectionPopover.top}px`,
        left: `${selectionPopover.left}px`,
        transform: "translateX(-50%)",
      }}
    >
      {selectionEditMode ? (
        <div className="flex items-center gap-1 bg-popover border rounded-lg shadow-lg px-2 py-1.5">
          <input
            type="text"
            value={selectionEditText}
            onChange={(e) => setSelectionEditText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSelectionEditSubmit();
              }
              if (e.key === "Escape") {
                setSelectionEditMode(false);
                setSelectionEditText("");
              }
            }}
            placeholder="Describe how to change this..."
            className="bg-transparent text-xs outline-none w-[200px] placeholder:text-muted-foreground/50"
            autoFocus
          />
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6 shrink-0"
            onClick={handleSelectionEditSubmit}
            disabled={!selectionEditText.trim() || isMerging}
          >
            <Send className="w-3 h-3" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-5 w-5 shrink-0"
            onClick={() => { setSelectionEditMode(false); setSelectionEditText(""); }}
          >
            <X className="w-3 h-3" />
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-0.5 bg-popover border rounded-lg shadow-lg px-1.5 py-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <div>
                <VoiceRecorder
                  onTranscript={handleSelectionVoiceTranscript}
                  onRecordingChange={setSelectionVoiceActive}
                  size="icon"
                  variant={selectionVoiceActive ? "destructive" : "ghost"}
                  className="h-7 w-7"
                />
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs">Dictate feedback for this selection</p>
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                onClick={() => setSelectionEditMode(true)}
              >
                <Pencil className="w-3.5 h-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs">Type feedback for this selection</p>
            </TooltipContent>
          </Tooltip>
        </div>
      )}
      {selectionVoiceActive && (
        <span className="text-[10px] text-primary animate-pulse bg-popover border rounded px-2 py-0.5 shadow">
          Listening... describe your changes
        </span>
      )}
    </div>
  ) : null;

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
              ) : tab.type === "timeline" ? (
                <Clock className="w-3 h-3 shrink-0 text-amber-500" />
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
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={handleAddTimelineTab}
              className="flex items-center justify-center h-7 w-7 rounded-t-lg text-muted-foreground hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-colors shrink-0 mb-px"
            >
              <Clock className="w-3.5 h-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent>New timeline tab</TooltipContent>
        </Tooltip>
      </div>

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
                onSaveToContext={onSaveImageToContext}
                isSaving={isSaving}
              />
            </div>
          );
        })}

      {/* ─── Timeline tab instances (always mounted to preserve state) ─── */}
      {tabs
        .filter((t) => t.type === "timeline")
        .map((tab) => (
          <div
            key={tab.id}
            className={
              tab.id === activeTabId ? "flex-1 min-h-0" : "hidden"
            }
          >
            <TimelineWorkspace onSaveToContext={onSaveTimelineToContext} />
          </div>
        ))}

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
            <div className="flex items-center gap-1 shrink-0">
              {extractImageUrl(previewDoc.content) && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-xs gap-1"
                      onClick={() => setPreviewLightbox(true)}
                    >
                      <Maximize2 className="w-3 h-3" />
                      Fullscreen
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>View image fullscreen</TooltipContent>
                </Tooltip>
              )}
              {onOpenPreviewDoc && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs gap-1"
                  onClick={() => {
                    onOpenPreviewDoc(previewDoc.content, previewDoc.title, previewDoc.docId);
                    onClosePreview?.();
                  }}
                >
                  <FileText className="w-3 h-3" />
                  Open Document
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-xs gap-1"
                onClick={onClosePreview}
              >
                <X className="w-3 h-3" />
                Close Preview
              </Button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            <MarkdownRenderer content={previewDoc.content} />
          </div>
          {previewLightbox && (() => {
            const imgUrl = extractImageUrl(previewDoc.content);
            return imgUrl ? (
              <ImageLightbox
                imageUrl={imgUrl}
                title={previewDoc.title}
                onClose={() => setPreviewLightbox(false)}
              />
            ) : null;
          })()}
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

          {/* ─── Writer feedback row (voice + text input for AI remixing) ─── */}
          {writerFeedbackRow}

          {/* ─── Document pane with selection popover ─── */}
          <div ref={editorContainerRef} className="relative flex-1 min-h-0">
            {selectionPopoverEl}
            <ProvokeText
              chrome="container"
              variant="editor"
              containerClassName="h-full"
              value={text}
              onChange={onTextChange}
              onSelect={handleTextSelect}
              placeholder="Start writing your document here... (Markdown supported)"
              headerActions={documentHeaderActions}
              className="text-sm leading-relaxed font-serif"
            />
          </div>
        </div>
      ) : null}
    </div>
  );
});
