import { useState } from "react";
import { ContextSidebar } from "./ContextSidebar";
import { ChatDrawer, type ChatSessionContext } from "@/components/ChatDrawer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  BookOpen,
  MessageSquare,
  Video,
  PanelLeftOpen,
  Maximize2,
} from "lucide-react";

type LeftPanelTab = "context" | "chat" | "video";

interface NotebookLeftPanelProps {
  // Context tab props
  pinnedDocIds: Set<number>;
  onPinDoc: (id: number) => void;
  onUnpinDoc: (id: number) => void;

  // Chat tab props
  chatSessionContext: ChatSessionContext;
  activeChatConversationId: number | null;
  onActiveChatConversationChange: (id: number | null) => void;

  // Session Store
  onOpenSessionStore: () => void;

  // Collapse
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

export function NotebookLeftPanel({
  pinnedDocIds,
  onPinDoc,
  onUnpinDoc,
  chatSessionContext,
  activeChatConversationId,
  onActiveChatConversationChange,
  onOpenSessionStore,
  isCollapsed,
  onToggleCollapse,
}: NotebookLeftPanelProps) {
  const [activeTab, setActiveTab] = useState<LeftPanelTab>("context");

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
              session context
            </TooltipContent>
          </Tooltip>
        )}

        <div className="mt-auto flex flex-col gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => {
                  onToggleCollapse();
                  setActiveTab("context");
                }}
              >
                <BookOpen className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">Context</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => {
                  onToggleCollapse();
                  setActiveTab("chat");
                }}
              >
                <MessageSquare className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">Chat</TooltipContent>
          </Tooltip>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-card border-r">
      {/* ─── Tab switcher ─── */}
      <div className="flex border-b shrink-0">
        {(
          [
            { id: "context" as const, icon: BookOpen, label: "Context" },
            { id: "chat" as const, icon: MessageSquare, label: "Chat" },
            { id: "video" as const, icon: Video, label: "Video" },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold transition-colors ${
              activeTab === tab.id
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
        {activeTab === "context" && (
          <div className="h-full flex flex-col">
            <ContextSidebar
              pinnedDocIds={pinnedDocIds}
              onPinDoc={onPinDoc}
              onUnpinDoc={onUnpinDoc}
              isCollapsed={false}
              onToggleCollapse={onToggleCollapse}
              embedded
            />
            {/* Session Store access */}
            <div className="border-t px-2 py-1.5 shrink-0">
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start gap-2 h-7 text-xs text-muted-foreground hover:text-foreground"
                onClick={onOpenSessionStore}
              >
                <Maximize2 className="w-3 h-3" />
                Open Session Store
              </Button>
            </div>
          </div>
        )}

        {activeTab === "chat" && (
          <ChatDrawer
            open={true}
            onOpenChange={() => {}}
            sessionContext={chatSessionContext}
            activeConversationId={activeChatConversationId}
            onActiveConversationChange={onActiveChatConversationChange}
            embedded
          />
        )}

        {activeTab === "video" && (
          <div className="h-full flex flex-col items-center justify-center gap-3 text-muted-foreground/40 p-6">
            <Video className="w-10 h-10" />
            <div className="text-center space-y-1">
              <p className="text-sm font-medium text-foreground/50">
                Video Collaboration
              </p>
              <p className="text-xs leading-relaxed">
                Video calls with collaborators will be available here in a future
                update.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
