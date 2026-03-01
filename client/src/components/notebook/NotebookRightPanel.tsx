import { useState, useMemo } from "react";
import { ProvoThread } from "./ProvoThread";
import { TranscriptPanel } from "./TranscriptPanel";
import { NotebookResearchChat } from "./NotebookResearchChat";
import { InterviewTab } from "./InterviewTab";
import { PainterPanel, type PainterConfig, type PainterMode } from "./PainterPanel";
import { WriterPanel, type WriterConfig } from "./WriterPanel";
import { Sparkles, Users, ClipboardList, Paintbrush, MessageCircleQuestion, Wand2, type LucideIcon } from "lucide-react";
import type { ProvocationType, DiscussionMessage, ContextItem, EditHistoryEntry } from "@shared/schema";

type RightPanelTab = "research" | "interview" | "provo" | "transcript" | "painter" | "writer";

const TAB_DEFS: { id: RightPanelTab; icon: LucideIcon; label: string }[] = [
  { id: "research", icon: Sparkles, label: "Research" },
  { id: "interview", icon: MessageCircleQuestion, label: "Interview" },
  { id: "transcript", icon: ClipboardList, label: "Notes" },
  { id: "provo", icon: Users, label: "Provo" },
  { id: "writer", icon: Wand2, label: "Writer" },
  { id: "painter", icon: Paintbrush, label: "Painter" },
];

/** Set of tab IDs this panel knows how to render */
const NATIVE_TAB_IDS = new Set<string>(TAB_DEFS.map((t) => t.id));

interface NotebookRightPanelProps {
  activePersonas: Set<ProvocationType>;
  onTogglePersona: (id: ProvocationType) => void;

  // Provo tab: persona discussion props
  discussionMessages: DiscussionMessage[];
  onSendMessage: (text: string) => void;
  onAcceptResponse: (messageId: string) => void;
  onDismissResponse: (messageId: string) => void;
  onRespondToMessage: (messageId: string, text: string) => void;
  isChatLoading: boolean;
  hasDocument?: boolean;

  // Research tab + Interview tab
  objective: string;
  onCaptureToContext: (text: string, label: string) => void;

  // Transcript tab
  capturedContext: ContextItem[];
  onRemoveCapturedItem?: (itemId: string) => void;

  // Evolve document (writer)
  onEvolveDocument?: (instruction: string, description: string) => void;
  isMerging?: boolean;

  // Writer tab
  onEvolve?: (configurations: WriterConfig[]) => void;
  isEvolving?: boolean;
  sessionNotes?: string;
  editHistory?: EditHistoryEntry[];

  // Painter tab + Interview tab
  documentText: string;
  onPaintImage: (config: {
    painterConfigs: PainterConfig[];
    painterObjective: string;
    negativePrompt?: string;
    painterMode: PainterMode;
  }) => void;
  isPainting?: boolean;
  pinnedDocContents?: Record<number, { title: string; content: string }>;

  // Interview tab
  appType?: string;

  /** Ordered list of tab IDs to show (from panel layout config). Only native tabs are rendered. */
  visibleTabs?: string[];
}

export function NotebookRightPanel({
  activePersonas,
  onTogglePersona,
  discussionMessages,
  onSendMessage,
  onAcceptResponse,
  onDismissResponse,
  onRespondToMessage,
  isChatLoading,
  hasDocument = false,
  objective,
  onCaptureToContext,
  capturedContext,
  onRemoveCapturedItem,
  onEvolveDocument,
  isMerging = false,
  onEvolve,
  isEvolving = false,
  sessionNotes,
  editHistory,
  documentText,
  onPaintImage,
  isPainting = false,
  pinnedDocContents,
  appType,
  visibleTabs,
}: NotebookRightPanelProps) {
  const [activeTab, setActiveTab] = useState<RightPanelTab>("research");
  const [researchMsgCount, setResearchMsgCount] = useState(0);

  // Filter and order tabs based on visibleTabs prop
  const tabs = useMemo(() => {
    if (!visibleTabs) return TAB_DEFS;
    const ordered = visibleTabs
      .filter((id) => NATIVE_TAB_IDS.has(id))
      .map((id) => TAB_DEFS.find((t) => t.id === id)!)
      .filter(Boolean);
    return ordered.length > 0 ? ordered : TAB_DEFS;
  }, [visibleTabs]);

  // Ensure active tab is in the visible set
  const effectiveActiveTab = tabs.some((t) => t.id === activeTab)
    ? activeTab
    : tabs[0]?.id || "research";

  // Badge counts per tab
  const getBadge = (tabId: string): React.ReactNode => {
    if (tabId === "research" && researchMsgCount > 0) {
      return (
        <span className="text-[9px] bg-primary/20 text-primary px-1.5 rounded-full">
          {researchMsgCount}
        </span>
      );
    }
    if (tabId === "transcript" && capturedContext.length > 0) {
      return (
        <span className="text-[9px] bg-primary/20 text-primary px-1.5 rounded-full">
          {capturedContext.length}
        </span>
      );
    }
    return null;
  };

  return (
    <div className="h-full flex flex-col bg-card border-l">
      {/* ─── Tab switcher ─── */}
      <div className="flex border-b shrink-0">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 flex items-center justify-center gap-1 py-2 text-xs font-semibold transition-colors ${
              effectiveActiveTab === tab.id
                ? "text-primary border-b-2 border-primary -mb-px"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <tab.icon className="w-3.5 h-3.5" />
            {tab.label}
            {getBadge(tab.id)}
          </button>
        ))}
      </div>

      {/* ─── Tab content (always mounted to preserve state) ─── */}

      {/* Research */}
      <div className={effectiveActiveTab === "research" ? "flex-1 overflow-hidden" : "hidden"}>
        <NotebookResearchChat
          objective={objective}
          onCaptureToContext={onCaptureToContext}
          onMessageCountChange={setResearchMsgCount}
        />
      </div>

      {/* Interview */}
      <div className={effectiveActiveTab === "interview" ? "flex-1 overflow-hidden" : "hidden"}>
        <InterviewTab
          objective={objective}
          documentText={documentText}
          appType={appType}
          onEvolveDocument={onEvolveDocument}
          isMerging={isMerging}
          onCaptureToContext={onCaptureToContext}
        />
      </div>

      {/* Transcript */}
      <div className={effectiveActiveTab === "transcript" ? "flex-1 overflow-hidden" : "hidden"}>
        <TranscriptPanel
          capturedContext={capturedContext}
          onCaptureToContext={onCaptureToContext}
          onRemoveCapturedItem={onRemoveCapturedItem}
          onEvolveDocument={onEvolveDocument}
          hasDocument={hasDocument}
          isMerging={isMerging}
        />
      </div>

      {/* Provo */}
      <div className={effectiveActiveTab === "provo" ? "flex-1 overflow-hidden" : "hidden"}>
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

      {/* Writer */}
      <div className={effectiveActiveTab === "writer" ? "flex-1 overflow-hidden" : "hidden"}>
        {onEvolve && (
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
        )}
      </div>

      {/* Painter */}
      <div className={effectiveActiveTab === "painter" ? "flex-1 overflow-hidden" : "hidden"}>
        <PainterPanel
          documentText={documentText}
          objective={objective}
          onPaintImage={onPaintImage}
          isPainting={isPainting}
          pinnedDocContents={pinnedDocContents}
        />
      </div>
    </div>
  );
}
