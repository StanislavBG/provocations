import { useState, useCallback } from "react";
import { ProvoThread } from "./ProvoThread";
import { NotebookResearchChat } from "./NotebookResearchChat";
import { GeneratePanel, type GeneratedDocument } from "@/components/GeneratePanel";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";
import { Sparkles, Users, FileText, Trash2, ClipboardList, Wand2, Zap, Loader2 } from "lucide-react";
import type { ProvocationType, DiscussionMessage, ContextItem } from "@shared/schema";

type RightPanelTab = "research" | "provo" | "transcript" | "generate";

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

  // Research tab
  objective: string;
  onCaptureToContext: (text: string, label: string) => void;

  // Transcript tab
  capturedContext: ContextItem[];
  onRemoveCapturedItem?: (itemId: string) => void;

  // Evolve document (writer)
  onEvolveDocument?: (instruction: string, description: string) => void;
  isMerging?: boolean;

  // Generate tab
  documentText: string;
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
}: NotebookRightPanelProps) {
  const [activeTab, setActiveTab] = useState<RightPanelTab>("research");
  const [researchMsgCount, setResearchMsgCount] = useState(0);
  const [generatedDocs, setGeneratedDocs] = useState<GeneratedDocument[]>([]);

  const handleEvolve = useCallback(() => {
    if (!onEvolveDocument || capturedContext.length === 0) return;

    const findings = capturedContext
      .map((item, i) => {
        const label = item.annotation || `Finding ${i + 1}`;
        return `### ${label}\n${item.content}`;
      })
      .join("\n\n");

    const instruction = `Evolve the document by integrating the following ${capturedContext.length} research finding${capturedContext.length !== 1 ? "s" : ""} and user feedback:\n\n${findings}\n\nRules:\n- PRESERVE the document's existing structure, voice, and content\n- WEAVE new information naturally into relevant sections\n- EXPAND sections where the research provides supporting evidence or new detail\n- ADD new sections only if the research covers topics not yet in the document\n- REMOVE nothing unless the research explicitly contradicts existing content\n- Maintain consistent formatting and style throughout`;

    onEvolveDocument(instruction, `Evolved with ${capturedContext.length} transcript item${capturedContext.length !== 1 ? "s" : ""}`);
  }, [onEvolveDocument, capturedContext]);

  return (
    <div className="h-full flex flex-col bg-card border-l">
      {/* ─── Tab switcher ─── */}
      <div className="flex border-b shrink-0">
        <button
          onClick={() => setActiveTab("research")}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold transition-colors ${
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
          onClick={() => setActiveTab("transcript")}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold transition-colors ${
            activeTab === "transcript"
              ? "text-primary border-b-2 border-primary -mb-px"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <ClipboardList className="w-3.5 h-3.5" />
          Transcript
          {capturedContext.length > 0 && (
            <span className="text-[9px] bg-primary/20 text-primary px-1.5 rounded-full">
              {capturedContext.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab("provo")}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold transition-colors ${
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
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold transition-colors ${
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

      {/* Transcript */}
      <div className={activeTab === "transcript" ? "flex-1 overflow-hidden flex flex-col" : "hidden"}>
        {capturedContext.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-2 text-muted-foreground/40 p-6">
            <ClipboardList className="w-8 h-8" />
            <p className="text-sm text-center">
              Captured context items will appear here.
            </p>
            <p className="text-xs text-center">
              Use "Send to Transcript" on research responses to collect findings.
            </p>
          </div>
        ) : (
          <>
            <ScrollArea className="flex-1">
              <div className="p-3 space-y-3">
                {capturedContext.map((item) => (
                  <div
                    key={item.id}
                    className="group border rounded-lg bg-card overflow-hidden"
                  >
                    <div className="flex items-center justify-between gap-2 px-3 py-1.5 border-b bg-muted/30">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <FileText className="w-3 h-3 text-primary/70 shrink-0" />
                        <span className="text-[10px] font-semibold text-muted-foreground truncate">
                          {item.annotation || "Captured item"}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <span className="text-[9px] text-muted-foreground/50">
                          {new Date(item.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                        {onRemoveCapturedItem && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                            onClick={() => onRemoveCapturedItem(item.id)}
                          >
                            <Trash2 className="w-2.5 h-2.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                    <div className="px-3 py-2 text-xs max-h-[200px] overflow-y-auto">
                      <MarkdownRenderer content={item.content} />
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>

            {/* Evolve Document — sticky footer */}
            <div className="shrink-0 border-t bg-card p-3">
              <Button
                onClick={handleEvolve}
                disabled={!hasDocument || isMerging || capturedContext.length === 0}
                className="w-full gap-2 h-10 text-sm font-semibold bg-amber-600 hover:bg-amber-700 text-white"
              >
                {isMerging ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Evolving Document...
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4" />
                    Evolve Document
                    <span className="text-[10px] opacity-80 font-normal ml-1">
                      ({capturedContext.length} item{capturedContext.length !== 1 ? "s" : ""})
                    </span>
                  </>
                )}
              </Button>
              <p className="text-[10px] text-muted-foreground/60 text-center mt-1.5">
                Merges all transcript findings into your document
              </p>
            </div>
          </>
        )}
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
