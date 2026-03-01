import { useState, useMemo } from "react";
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
  type LucideIcon,
} from "lucide-react";

type LeftPanelTab = "context" | "chat" | "video";

const TAB_DEFS: { id: LeftPanelTab; icon: LucideIcon; label: string }[] = [
  { id: "context", icon: BookOpen, label: "Context" },
  { id: "chat", icon: MessageSquare, label: "Chat" },
  { id: "video", icon: Video, label: "Video" },
];

/** Set of tab IDs this panel knows how to render */
const NATIVE_TAB_IDS = new Set<string>(TAB_DEFS.map((t) => t.id));

interface NotebookLeftPanelProps {
  // Context tab props
  pinnedDocIds: Set<number>;
  onPinDoc: (id: number) => void;
  onUnpinDoc: (id: number) => void;
  onPreviewDoc?: (id: number, title: string) => void;
  onOpenDoc?: (id: number, title: string) => void;

  // Chat tab props
  chatSessionContext: ChatSessionContext;
  activeChatConversationId: number | null;
  onActiveChatConversationChange: (id: number | null) => void;

  // Collapse
  isCollapsed: boolean;
  onToggleCollapse: () => void;

  /** Ordered list of tab IDs to show (from panel layout config). Only native tabs are rendered. */
  visibleTabs?: string[];
}

export function NotebookLeftPanel({
  pinnedDocIds,
  onPinDoc,
  onUnpinDoc,
  onPreviewDoc,
  onOpenDoc,
  chatSessionContext,
  activeChatConversationId,
  onActiveChatConversationChange,
  isCollapsed,
  onToggleCollapse,
  visibleTabs,
}: NotebookLeftPanelProps) {
  const [activeTab, setActiveTab] = useState<LeftPanelTab>("context");

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

        {effectiveActiveTab === "chat" && (
          <ChatDrawer
            open={true}
            onOpenChange={() => {}}
            sessionContext={chatSessionContext}
            activeConversationId={activeChatConversationId}
            onActiveConversationChange={onActiveChatConversationChange}
            embedded
          />
        )}

        {effectiveActiveTab === "video" && (
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
