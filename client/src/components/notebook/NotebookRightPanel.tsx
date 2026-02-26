import { PersonaAvatarRow } from "./PersonaAvatarRow";
import { ChatThread } from "./ChatThread";
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
}: NotebookRightPanelProps) {
  return (
    <div className="h-full flex flex-col bg-card border-l">
      {/* Persona toggle row */}
      <div className="px-3 py-2 border-b bg-muted/20">
        <PersonaAvatarRow
          activePersonas={activePersonas}
          onToggle={onTogglePersona}
          compact
        />
        <p className="text-[10px] text-muted-foreground mt-1">
          {activePersonas.size} of 13 active. Toggle to include/exclude from feedback.
        </p>
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
