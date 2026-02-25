import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChatThread } from "./ChatThread";
import { SplitDocumentEditor } from "./SplitDocumentEditor";
import { PersonaAvatarRow } from "./PersonaAvatarRow";
import { MessageCircle, FileText } from "lucide-react";
import type { ProvocationType, DiscussionMessage } from "@shared/schema";

interface NotebookCenterPanelProps {
  /** Current center tab */
  activeTab: "chat" | "document";
  onTabChange: (tab: "chat" | "document") => void;

  // Chat props
  discussionMessages: DiscussionMessage[];
  onSendMessage: (text: string) => void;
  onAcceptResponse: (messageId: string) => void;
  onDismissResponse: (messageId: string) => void;
  onRespondToMessage: (messageId: string, text: string) => void;
  isChatLoading: boolean;

  // Persona props
  activePersonas: Set<ProvocationType>;
  onTogglePersona: (id: ProvocationType) => void;

  // Document props
  documentText: string;
  onDocumentTextChange: (text: string) => void;
  isMerging: boolean;
  objective?: string;
  templateName?: string;
}

export function NotebookCenterPanel({
  activeTab,
  onTabChange,
  discussionMessages,
  onSendMessage,
  onAcceptResponse,
  onDismissResponse,
  onRespondToMessage,
  isChatLoading,
  activePersonas,
  onTogglePersona,
  documentText,
  onDocumentTextChange,
  isMerging,
  objective,
  templateName,
}: NotebookCenterPanelProps) {
  return (
    <div className="h-full flex flex-col">
      <Tabs
        value={activeTab}
        onValueChange={(v) => onTabChange(v as "chat" | "document")}
        className="h-full flex flex-col"
      >
        <div className="border-b shrink-0 px-2 pt-1">
          <TabsList className="h-8">
            <TabsTrigger value="chat" className="text-xs gap-1.5 h-7">
              <MessageCircle className="w-3.5 h-3.5" />
              Chat
            </TabsTrigger>
            <TabsTrigger value="document" className="text-xs gap-1.5 h-7">
              <FileText className="w-3.5 h-3.5" />
              Document
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="chat" className="flex-1 mt-0 overflow-hidden flex flex-col">
          {/* Persona toggle row */}
          <div className="px-3 py-2 border-b bg-muted/20">
            <PersonaAvatarRow
              activePersonas={activePersonas}
              onToggle={onTogglePersona}
              compact
            />
          </div>

          {/* Chat thread */}
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
        </TabsContent>

        <TabsContent value="document" className="flex-1 mt-0 overflow-hidden">
          <SplitDocumentEditor
            text={documentText}
            onTextChange={onDocumentTextChange}
            isMerging={isMerging}
            objective={objective}
            templateName={templateName}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
