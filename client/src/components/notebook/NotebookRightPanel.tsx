import { useState } from "react";
import { ProvoThread } from "./ProvoThread";
import { TranscriptPanel } from "./TranscriptPanel";
import { NotebookResearchChat } from "./NotebookResearchChat";
import { InterviewTab } from "./InterviewTab";
import { GeneratePanel, type GeneratedDocument } from "@/components/GeneratePanel";
import { Sparkles, Users, ClipboardList, Wand2, MessageCircleQuestion } from "lucide-react";
import type { ProvocationType, DiscussionMessage, ContextItem } from "@shared/schema";

type RightPanelTab = "research" | "interview" | "provo" | "transcript" | "generate";

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

  // Generate tab + Interview tab
  documentText: string;

  // Interview tab
  appType?: string;
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
  documentText,
  appType,
}: NotebookRightPanelProps) {
  const [activeTab, setActiveTab] = useState<RightPanelTab>("research");
  const [researchMsgCount, setResearchMsgCount] = useState(0);
  const [generatedDocs, setGeneratedDocs] = useState<GeneratedDocument[]>([]);

  return (
    <div className="h-full flex flex-col bg-card border-l">
      {/* ─── Tab switcher ─── */}
      <div className="flex border-b shrink-0">
        <button
          onClick={() => setActiveTab("research")}
          className={`flex-1 flex items-center justify-center gap-1 py-2 text-xs font-semibold transition-colors ${
            activeTab === "research"
              ? "text-primary border-b-2 border-primary -mb-px"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          Research
          {researchMsgCount > 0 && (
            <span className="text-[9px] bg-primary/20 text-primary px-1.5 rounded-full">
              {researchMsgCount}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab("interview")}
          className={`flex-1 flex items-center justify-center gap-1 py-2 text-xs font-semibold transition-colors ${
            activeTab === "interview"
              ? "text-primary border-b-2 border-primary -mb-px"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <MessageCircleQuestion className="w-3.5 h-3.5" />
          Interview
        </button>
        <button
          onClick={() => setActiveTab("transcript")}
          className={`flex-1 flex items-center justify-center gap-1 py-2 text-xs font-semibold transition-colors ${
            activeTab === "transcript"
              ? "text-primary border-b-2 border-primary -mb-px"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <ClipboardList className="w-3.5 h-3.5" />
          Notes
          {capturedContext.length > 0 && (
            <span className="text-[9px] bg-primary/20 text-primary px-1.5 rounded-full">
              {capturedContext.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab("provo")}
          className={`flex-1 flex items-center justify-center gap-1 py-2 text-xs font-semibold transition-colors ${
            activeTab === "provo"
              ? "text-primary border-b-2 border-primary -mb-px"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          Provo
        </button>
        <button
          onClick={() => setActiveTab("generate")}
          className={`flex-1 flex items-center justify-center gap-1 py-2 text-xs font-semibold transition-colors ${
            activeTab === "generate"
              ? "text-primary border-b-2 border-primary -mb-px"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Wand2 className="w-3.5 h-3.5" />
          Generate
          {generatedDocs.length > 0 && (
            <span className="text-[9px] bg-primary/20 text-primary px-1.5 rounded-full">
              {generatedDocs.length}
            </span>
          )}
        </button>
      </div>

      {/* ─── Tab content (always mounted to preserve state) ─── */}

      {/* Research */}
      <div className={activeTab === "research" ? "flex-1 overflow-hidden" : "hidden"}>
        <NotebookResearchChat
          objective={objective}
          onCaptureToContext={onCaptureToContext}
          onMessageCountChange={setResearchMsgCount}
        />
      </div>

      {/* Interview */}
      <div className={activeTab === "interview" ? "flex-1 overflow-hidden" : "hidden"}>
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
      <div className={activeTab === "transcript" ? "flex-1 overflow-hidden" : "hidden"}>
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
      <div className={activeTab === "provo" ? "flex-1 overflow-hidden" : "hidden"}>
        <ProvoThread
          documentText={documentText}
          objective={objective}
          activePersonas={activePersonas}
          onTogglePersona={onTogglePersona}
          onCaptureToContext={onCaptureToContext}
          hasDocument={hasDocument}
        />
      </div>

      {/* Generate */}
      <div className={activeTab === "generate" ? "flex-1 overflow-hidden" : "hidden"}>
        <GeneratePanel
          documentText={documentText}
          objective={objective}
          generatedDocs={generatedDocs}
          onDocGenerated={(doc) => setGeneratedDocs((prev) => [...prev, doc])}
          onDocRemove={(id) => setGeneratedDocs((prev) => prev.filter((d) => d.id !== id))}
        />
      </div>
    </div>
  );
}
