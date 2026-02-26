import { PersonaAvatarRow } from "./PersonaAvatarRow";
import { ChatThread } from "./ChatThread";
import { Button } from "@/components/ui/button";
import { Flame, Lightbulb } from "lucide-react";
import type { ProvocationType, DiscussionMessage } from "@shared/schema";

interface NotebookRightPanelProps {
  activePersonas: Set<ProvocationType>;
  onTogglePersona: (id: ProvocationType) => void;

  // Chat (persona discussion) props
  discussionMessages: DiscussionMessage[];
  onSendMessage: (text: string) => void;
  onAcceptResponse: (messageId: string) => void;
  onDismissResponse: (messageId: string) => void;
  onRespondToMessage: (messageId: string, text: string) => void;
  isChatLoading: boolean;

  // Document context for action buttons
  hasDocument?: boolean;
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
}: NotebookRightPanelProps) {
  const canAct = hasDocument && !isChatLoading;

  return (
    <div className="h-full flex flex-col bg-card border-l">
      {/* Persona selector + action buttons */}
      <div className="px-3 py-2 border-b bg-muted/20 space-y-2 shrink-0">
        <PersonaAvatarRow
          activePersonas={activePersonas}
          onToggle={onTogglePersona}
          compact
        />

        {/* Action buttons */}
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
    </div>
  );
}
