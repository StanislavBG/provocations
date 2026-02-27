import { useState } from "react";
import { PersonaAvatarRow } from "./PersonaAvatarRow";
import { ChatThread } from "./ChatThread";
import { NotebookResearchChat } from "./NotebookResearchChat";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";
import { Flame, Lightbulb, Sparkles, Users, FileText, Trash2, ClipboardList } from "lucide-react";
import type { ProvocationType, DiscussionMessage, ContextItem } from "@shared/schema";

type RightPanelTab = "research" | "provo" | "transcript";

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
}

const PROVOKE_PROMPT =
  "Challenge my current document. What gaps, weaknesses, or blind spots do you see? What assumptions am I making that I haven't validated? Be specific and reference parts of my document.";

const ADVICE_PROMPT =
  "Based on my current document and objective, what specific improvements would you recommend? Give me actionable, concrete advice to make this stronger.";

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
}: NotebookRightPanelProps) {
  const [activeTab, setActiveTab] = useState<RightPanelTab>("research");
  const canAct = hasDocument && !isChatLoading;

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
      </div>

      {/* ─── Tab content ─── */}
      {activeTab === "research" && (
        <div className="flex-1 overflow-hidden">
          <NotebookResearchChat
            objective={objective}
            onCaptureToContext={onCaptureToContext}
          />
        </div>
      )}

      {activeTab === "transcript" && (
        <div className="flex-1 overflow-hidden flex flex-col">
          {capturedContext.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-2 text-muted-foreground/40 p-6">
              <ClipboardList className="w-8 h-8" />
              <p className="text-sm text-center">
                Captured context items will appear here.
              </p>
              <p className="text-xs text-center">
                Use "Capture to context" on research responses to collect findings.
              </p>
            </div>
          ) : (
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
          )}
        </div>
      )}

      {activeTab === "provo" && (
        <>
          {/* Persona selector + action buttons */}
          <div className="px-3 py-2 border-b bg-muted/20 space-y-2 shrink-0">
            <PersonaAvatarRow
              activePersonas={activePersonas}
              onToggle={onTogglePersona}
              compact
            />
            <div className="flex gap-2">
              <Button
                variant="default"
                size="sm"
                className="flex-1 gap-1.5 h-8 text-xs font-semibold"
                disabled={!canAct}
                onClick={() => onSendMessage(PROVOKE_PROMPT)}
              >
                <Flame className="w-3.5 h-3.5" />
                Provoke Me
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex-1 gap-1.5 h-8 text-xs font-semibold"
                disabled={!canAct}
                onClick={() => onSendMessage(ADVICE_PROMPT)}
              >
                <Lightbulb className="w-3.5 h-3.5" />
                Ask Advice
              </Button>
            </div>
          </div>

          {/* Persona chat thread */}
          <div className="flex-1 overflow-hidden">
            <ChatThread
              messages={discussionMessages}
              onSendMessage={onSendMessage}
              onAcceptResponse={onAcceptResponse}
              onDismissResponse={onDismissResponse}
              onRespondToMessage={onRespondToMessage}
              isLoading={isChatLoading}
            />
          </div>
        </>
      )}
    </div>
  );
}
