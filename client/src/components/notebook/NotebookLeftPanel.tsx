import { useState, useMemo } from "react";
import { ContextSidebar } from "./ContextSidebar";
import { NotebookResearchChat } from "./NotebookResearchChat";
import { InterviewTab } from "./InterviewTab";
import { TranscriptPanel } from "./TranscriptPanel";
import { ProvoThread } from "./ProvoThread";
import { WriterPanel, type WriterConfig } from "./WriterPanel";
import { PainterPanel, type PainterConfig, type PainterMode } from "./PainterPanel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { PanelLeftOpen } from "lucide-react";
import { resolveVisibleTabs } from "./panelTabs";
import type { ProvocationType, DiscussionMessage, ContextItem, EditHistoryEntry } from "@shared/schema";

const DEFAULT_LEFT_IDS = ["context"];

interface NotebookLeftPanelProps {
  // Context tab props
  pinnedDocIds: Set<number>;
  onPinDoc: (id: number) => void;
  onUnpinDoc: (id: number) => void;
  onPreviewDoc?: (id: number, title: string) => void;
  onOpenDoc?: (id: number, title: string) => void;

  // Collapse
  isCollapsed: boolean;
  onToggleCollapse: () => void;

  /** Ordered list of tab IDs to show (from panel layout config) */
  visibleTabs?: string[];

  // ── Props for right-panel tabs that may be moved here ──
  activePersonas?: Set<ProvocationType>;
  onTogglePersona?: (id: ProvocationType) => void;
  discussionMessages?: DiscussionMessage[];
  onSendMessage?: (text: string) => void;
  onAcceptResponse?: (messageId: string) => void;
  onDismissResponse?: (messageId: string) => void;
  onRespondToMessage?: (messageId: string, text: string) => void;
  isChatLoading?: boolean;
  hasDocument?: boolean;
  objective?: string;
  onCaptureToContext?: (text: string, label: string) => void;
  capturedContext?: ContextItem[];
  onRemoveCapturedItem?: (itemId: string) => void;
  onEvolveDocument?: (instruction: string, description: string) => void;
  isMerging?: boolean;
  onMapNotesToTimeline?: () => void;
  isMapPending?: boolean;
  onEvolve?: (configurations: WriterConfig[]) => void;
  isEvolving?: boolean;
  sessionNotes?: string;
  editHistory?: EditHistoryEntry[];
  documentText?: string;
  onPaintImage?: (config: {
    painterConfigs: PainterConfig[];
    painterObjective: string;
    negativePrompt?: string;
    painterMode: PainterMode;
  }) => void;
  isPainting?: boolean;
  pinnedDocContents?: Record<number, { title: string; content: string }>;
  appType?: string;
}

export function NotebookLeftPanel({
  pinnedDocIds,
  onPinDoc,
  onUnpinDoc,
  onPreviewDoc,
  onOpenDoc,
  isCollapsed,
  onToggleCollapse,
  visibleTabs,
  // Right-panel tab props (optional — only used when those tabs are moved here)
  activePersonas,
  onTogglePersona,
  onCaptureToContext,
  capturedContext,
  onRemoveCapturedItem,
  onEvolveDocument,
  isMerging = false,
  onMapNotesToTimeline,
  isMapPending = false,
  onEvolve,
  isEvolving = false,
  sessionNotes,
  editHistory,
  documentText = "",
  onPaintImage,
  isPainting = false,
  pinnedDocContents,
  appType,
  hasDocument = false,
  objective = "",
}: NotebookLeftPanelProps) {
  const [activeTab, setActiveTab] = useState("context");

  const tabs = useMemo(
    () => resolveVisibleTabs(visibleTabs, DEFAULT_LEFT_IDS),
    [visibleTabs],
  );

  // Ensure active tab is in the visible set
  const effectiveActiveTab = tabs.some((t) => t.id === activeTab)
    ? activeTab
    : tabs[0]?.id || "context";

  // ── Collapsed view: narrow icon strip ──
  if (isCollapsed) {
    return (
      <div className="h-full flex flex-col items-center py-2 gap-2 bg-card border-r w-12">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={onToggleCollapse}
            >
              <PanelLeftOpen className="w-4 h-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">Expand panel</TooltipContent>
        </Tooltip>

        {pinnedDocIds.size > 0 && (
          <Tooltip>
            <TooltipTrigger>
              <Badge className="text-[10px] h-5 min-w-[20px] justify-center bg-green-600">
                {pinnedDocIds.size}
              </Badge>
            </TooltipTrigger>
            <TooltipContent side="right">
              {pinnedDocIds.size} document{pinnedDocIds.size > 1 ? "s" : ""} in
              active context
            </TooltipContent>
          </Tooltip>
        )}

        <div className="mt-auto flex flex-col gap-1">
          {tabs.slice(0, 2).map((tab) => (
            <Tooltip key={tab.id}>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => {
                    onToggleCollapse();
                    setActiveTab(tab.id);
                  }}
                >
                  <tab.icon className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">{tab.label}</TooltipContent>
            </Tooltip>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-card border-r">
      {/* ─── Tab switcher ─── */}
      <div className="flex border-b shrink-0">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold transition-colors ${
              effectiveActiveTab === tab.id
                ? "text-primary border-b-2 border-primary -mb-px"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <tab.icon className="w-3.5 h-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* ─── Tab content ─── */}
      <div className="flex-1 overflow-hidden">
        {effectiveActiveTab === "context" && (
          <div className="h-full flex flex-col">
            <ContextSidebar
              pinnedDocIds={pinnedDocIds}
              onPinDoc={onPinDoc}
              onUnpinDoc={onUnpinDoc}
              onPreviewDoc={onPreviewDoc}
              onOpenDoc={onOpenDoc}
              isCollapsed={false}
              onToggleCollapse={onToggleCollapse}
              embedded
            />
          </div>
        )}

        {/* ── Right-panel tabs that may be moved here ── */}

        {effectiveActiveTab === "research" && onCaptureToContext && (
          <div className="h-full overflow-hidden">
            <NotebookResearchChat
              objective={objective}
              onCaptureToContext={onCaptureToContext}
            />
          </div>
        )}

        {effectiveActiveTab === "interview" && onCaptureToContext && (
          <div className="h-full overflow-hidden">
            <InterviewTab
              objective={objective}
              documentText={documentText}
              appType={appType}
              onEvolveDocument={onEvolveDocument}
              isMerging={isMerging}
              onCaptureToContext={onCaptureToContext}
            />
          </div>
        )}

        {effectiveActiveTab === "transcript" && onCaptureToContext && (
          <div className="h-full overflow-hidden">
            <TranscriptPanel
              capturedContext={capturedContext || []}
              onCaptureToContext={onCaptureToContext}
              onRemoveCapturedItem={onRemoveCapturedItem}
              onEvolveDocument={onEvolveDocument}
              onMapNotesToTimeline={onMapNotesToTimeline}
              isMapPending={isMapPending}
              hasDocument={hasDocument}
              isMerging={isMerging}
            />
          </div>
        )}

        {effectiveActiveTab === "provo" && activePersonas && onTogglePersona && onCaptureToContext && (
          <div className="h-full overflow-hidden">
            <ProvoThread
              documentText={documentText}
              objective={objective}
              activePersonas={activePersonas}
              onTogglePersona={onTogglePersona}
              onCaptureToContext={onCaptureToContext}
              hasDocument={hasDocument}
              pinnedDocContents={pinnedDocContents}
            />
          </div>
        )}

        {effectiveActiveTab === "writer" && onEvolve && (
          <div className="h-full overflow-hidden">
            <WriterPanel
              documentText={documentText}
              objective={objective}
              onEvolve={onEvolve}
              isEvolving={isEvolving}
              capturedContext={capturedContext}
              pinnedDocContents={pinnedDocContents}
              sessionNotes={sessionNotes}
              editHistory={editHistory}
              appType={appType}
            />
          </div>
        )}

        {effectiveActiveTab === "painter" && onPaintImage && (
          <div className="h-full overflow-hidden">
            <PainterPanel
              documentText={documentText}
              objective={objective}
              onPaintImage={onPaintImage}
              isPainting={isPainting}
              pinnedDocContents={pinnedDocContents}
            />
          </div>
        )}
      </div>
    </div>
  );
}
