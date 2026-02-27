/**
 * ChatDrawer — slide-out messaging panel for user-to-user conversations.
 * Integrated with the workspace session: shows current objective, allows
 * sharing context/document excerpts, and persists its state across saves.
 *
 * Views:
 *   1. Conversation list (default)
 *   2. Active message thread — with session context banner
 *   3. Chat settings
 *   4. Connections manager
 */
import { useState, useCallback, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  MessageSquare,
  ArrowLeft,
  Send,
  Settings,
  UserPlus,
  Check,
  ChevronRight,
  Share2,
  Target,
  FileText,
  Paperclip,
  Lock,
  Clock,
} from "lucide-react";
import type {
  ConnectionItem,
  ConversationListItem,
  MessageItem,
} from "@shared/schema";
import { ChatSettings } from "./ChatSettings";
import { ConnectionsManager } from "./ConnectionsManager";

/** Session context passed from Workspace so chat knows what you're working on */
export interface ChatSessionContext {
  objective: string;
  templateName: string | null;
  /** First ~200 chars of the current document for sharing */
  documentExcerpt: string;
}

interface ChatDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Current workspace session context */
  sessionContext: ChatSessionContext;
  /** Controlled active conversation (persisted in session state) */
  activeConversationId: number | null;
  onActiveConversationChange: (id: number | null) => void;
  /** When true, render inline (no Sheet wrapper) — used in right panel */
  embedded?: boolean;
}

type DrawerView = "conversations" | "thread" | "settings" | "connections";

export function ChatDrawer({
  open,
  onOpenChange,
  sessionContext,
  activeConversationId,
  onActiveConversationChange,
  embedded,
}: ChatDrawerProps) {
  const [view, setView] = useState<DrawerView>(
    activeConversationId ? "thread" : "conversations",
  );
  const [activeOtherUser, setActiveOtherUser] = useState<ConversationListItem["otherUser"] | null>(null);
  const queryClient = useQueryClient();

  // When drawer opens, restore to thread view if there's an active conversation
  useEffect(() => {
    if (open && activeConversationId) {
      setView("thread");
    } else if (open && !activeConversationId) {
      setView("conversations");
    }
  }, [open, activeConversationId]);

  const openThread = useCallback((convoId: number, otherUser: ConversationListItem["otherUser"]) => {
    onActiveConversationChange(convoId);
    setActiveOtherUser(otherUser);
    setView("thread");
  }, [onActiveConversationChange]);

  const goBack = useCallback(() => {
    setView("conversations");
    onActiveConversationChange(null);
    queryClient.invalidateQueries({ queryKey: ["/api/chat/conversations"] });
  }, [queryClient, onActiveConversationChange]);

  const content = (
    <>
      {view === "conversations" && (
        <ConversationListView
          sessionContext={sessionContext}
          onOpenThread={openThread}
          onOpenSettings={() => setView("settings")}
          onOpenConnections={() => setView("connections")}
        />
      )}
      {view === "thread" && activeConversationId && (
        <ThreadView
          conversationId={activeConversationId}
          otherUser={activeOtherUser}
          sessionContext={sessionContext}
          onBack={goBack}
        />
      )}
      {view === "settings" && (
        <ChatSettings onBack={() => setView("conversations")} />
      )}
      {view === "connections" && (
        <ConnectionsManager onBack={() => setView("conversations")} />
      )}
    </>
  );

  // Embedded mode: render inline without Sheet wrapper
  if (embedded) {
    return (
      <div className="h-full flex flex-col">
        {content}
      </div>
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-[400px] sm:w-[440px] p-0 flex flex-col"
      >
        {content}
      </SheetContent>
    </Sheet>
  );
}

// ── Session Context Banner ──
// Shown at the top of the conversation list and inside threads to anchor
// what you're currently working on.

function SessionContextBanner({ ctx }: { ctx: ChatSessionContext }) {
  if (!ctx.objective && !ctx.templateName) return null;
  return (
    <div className="mx-3 mt-2 mb-1 p-2.5 rounded-lg bg-primary/5 border border-primary/10">
      {ctx.templateName && (
        <div className="flex items-center gap-1.5 mb-1">
          <FileText className="w-3 h-3 text-primary/60" />
          <span className="text-[10px] font-medium uppercase tracking-wider text-primary/60">
            {ctx.templateName}
          </span>
        </div>
      )}
      {ctx.objective && (
        <div className="flex items-start gap-1.5">
          <Target className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" />
          <p className="text-xs text-foreground/80 line-clamp-2 leading-relaxed">
            {ctx.objective}
          </p>
        </div>
      )}
    </div>
  );
}

// ── Conversation List ──

function ConversationListView({
  sessionContext,
  onOpenThread,
  onOpenSettings,
  onOpenConnections,
}: {
  sessionContext: ChatSessionContext;
  onOpenThread: (id: number, otherUser: ConversationListItem["otherUser"]) => void;
  onOpenSettings: () => void;
  onOpenConnections: () => void;
}) {
  const { data: conversations = [], isLoading } = useQuery<ConversationListItem[]>({
    queryKey: ["/api/chat/conversations"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/chat/conversations");
      return res.json();
    },
    refetchInterval: 10000,
  });

  const { data: connectionsList = [] } = useQuery<ConnectionItem[]>({
    queryKey: ["/api/chat/connections"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/chat/connections");
      return res.json();
    },
    refetchInterval: 30000,
  });
  const pendingIncoming = connectionsList.filter(
    (c) => c.status === "pending" && c.direction === "incoming",
  );

  const totalUnread = conversations.reduce((sum, c) => sum + c.unreadCount, 0);

  // Build active team members from accepted connections
  const activeTeamMembers = connectionsList
    .filter((c) => c.status === "accepted")
    .map((c) => ({
      userId: c.userId,
      displayName: c.displayName,
      email: c.email,
      avatarUrl: c.avatarUrl,
      conversationId: conversations.find(
        (cv) => cv.otherUser.userId === c.userId,
      )?.id ?? null,
    }));

  return (
    <>
      <div className="px-4 pt-3 pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-primary" />
            <span className="font-semibold text-sm">Chat</span>
            {totalUnread > 0 && (
              <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                {totalUnread}
              </Badge>
            )}
          </div>
          <div className="flex gap-0.5">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onOpenConnections} title="Connections">
                  <UserPlus className="w-3.5 h-3.5" />
                  {pendingIncoming.length > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-destructive rounded-full" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>Invite & manage connections</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onOpenSettings} title="Chat settings">
                  <Settings className="w-3.5 h-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Chat settings</TooltipContent>
            </Tooltip>
          </div>
        </div>
        {/* Encryption & retention notice */}
        <div className="flex items-center gap-1.5 mt-1.5 text-[9px] text-muted-foreground/60">
          <Lock className="w-2.5 h-2.5" />
          <span>End-to-end encrypted</span>
          <span className="mx-0.5">&middot;</span>
          <Clock className="w-2.5 h-2.5" />
          <span>Auto-deletes after 7 days</span>
        </div>
      </div>

      {/* ── Team members (accepted connections) ── */}
      {activeTeamMembers.length > 0 && (
        <div className="px-4 py-2 border-b">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 mb-2">Team</p>
          <div className="flex flex-wrap gap-1.5">
            {activeTeamMembers.map((member) => (
              <Tooltip key={member.userId}>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => {
                      if (member.conversationId) {
                        onOpenThread(member.conversationId, {
                          userId: member.userId,
                          displayName: member.displayName,
                          email: member.email,
                          avatarUrl: member.avatarUrl,
                        });
                      }
                    }}
                    disabled={!member.conversationId}
                    className="flex items-center gap-1.5 px-2 py-1 rounded-full border bg-background hover:bg-muted/60 transition-colors text-xs disabled:opacity-50 disabled:cursor-default"
                  >
                    <Avatar className="w-4 h-4">
                      {member.avatarUrl && <AvatarImage src={member.avatarUrl} />}
                      <AvatarFallback className="text-[8px]">
                        {member.displayName.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="truncate max-w-[80px]">
                      {member.displayName.split(" ")[0]}
                    </span>
                  </button>
                </TooltipTrigger>
                <TooltipContent>{member.displayName} &middot; {member.email}</TooltipContent>
              </Tooltip>
            ))}
          </div>
        </div>
      )}

      {/* Current session context — what you're working on right now */}
      <SessionContextBanner ctx={sessionContext} />

      <Separator className="mt-1" />

      {/* Pending invitations banner */}
      {pendingIncoming.length > 0 && (
        <button
          onClick={onOpenConnections}
          className="mx-4 mt-2 p-2 rounded-md bg-primary/10 text-sm flex items-center gap-2 hover:bg-primary/20 transition-colors"
        >
          <UserPlus className="w-4 h-4 text-primary" />
          <span>
            {pendingIncoming.length} pending invitation{pendingIncoming.length > 1 ? "s" : ""}
          </span>
          <ChevronRight className="w-4 h-4 ml-auto" />
        </button>
      )}

      <ScrollArea className="flex-1">
        {isLoading ? (
          <div className="p-4 text-center text-muted-foreground text-sm">Loading...</div>
        ) : conversations.length === 0 ? (
          <div className="p-8 text-center">
            <MessageSquare className="w-12 h-12 mx-auto mb-3 text-muted-foreground/30" />
            <p className="text-muted-foreground text-sm mb-2">No conversations yet</p>
            <p className="text-muted-foreground/70 text-xs mb-4">
              Connect with collaborators to start messaging
            </p>
            <Button variant="outline" size="sm" onClick={onOpenConnections}>
              <UserPlus className="w-4 h-4 mr-2" />
              Invite someone
            </Button>
          </div>
        ) : (
          <div className="py-1">
            {conversations.map((convo) => (
              <button
                key={convo.id}
                onClick={() => onOpenThread(convo.id, convo.otherUser)}
                className="w-full px-4 py-3 flex items-start gap-3 hover:bg-muted/50 transition-colors text-left"
              >
                <Avatar className="w-10 h-10 shrink-0">
                  {convo.otherUser.avatarUrl && (
                    <AvatarImage src={convo.otherUser.avatarUrl} />
                  )}
                  <AvatarFallback className="text-xs">
                    {convo.otherUser.displayName.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm truncate">
                      {convo.otherUser.displayName}
                    </span>
                    {convo.lastMessage && (
                      <span className="text-xs text-muted-foreground shrink-0">
                        {formatRelativeTime(convo.lastMessage.createdAt)}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between mt-0.5">
                    <p className="text-xs text-muted-foreground truncate">
                      {convo.lastMessage?.preview ?? "Start a conversation"}
                    </p>
                    {convo.unreadCount > 0 && (
                      <Badge variant="destructive" className="text-[10px] px-1.5 py-0 ml-2 shrink-0">
                        {convo.unreadCount}
                      </Badge>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </ScrollArea>
    </>
  );
}

// ── Thread View ──

function ThreadView({
  conversationId,
  otherUser,
  sessionContext,
  onBack,
}: {
  conversationId: number;
  otherUser: ConversationListItem["otherUser"] | null;
  sessionContext: ChatSessionContext;
  onBack: () => void;
}) {
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: messagesList = [], isLoading } = useQuery<MessageItem[]>({
    queryKey: ["/api/chat/messages", conversationId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/chat/messages/${conversationId}`);
      return res.json();
    },
    refetchInterval: 3000,
  });

  // Mark messages read when viewing
  useEffect(() => {
    if (messagesList.length > 0) {
      apiRequest("POST", `/api/chat/messages/${conversationId}/read`).catch(() => {});
    }
  }, [conversationId, messagesList.length]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messagesList.length]);

  // Focus input on mount
  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  const sendMutation = useMutation({
    mutationFn: async ({ content, messageType, contextRef }: {
      content: string;
      messageType?: string;
      contextRef?: string;
    }) => {
      const res = await apiRequest("POST", "/api/chat/messages", {
        conversationId,
        content,
        messageType: messageType ?? "text",
        contextRef,
      });
      return res.json();
    },
    onSuccess: () => {
      setInput("");
      queryClient.invalidateQueries({ queryKey: ["/api/chat/messages", conversationId] });
    },
    onError: () => {
      toast({ title: "Failed to send message", variant: "destructive" });
    },
  });

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed || sendMutation.isPending) return;
    sendMutation.mutate({ content: trimmed });
  };

  /** Share current objective + document excerpt as a context-share message */
  const handleShareContext = () => {
    const parts: string[] = [];
    if (sessionContext.templateName) {
      parts.push(`[${sessionContext.templateName}]`);
    }
    if (sessionContext.objective) {
      parts.push(`Objective: ${sessionContext.objective}`);
    }
    if (sessionContext.documentExcerpt) {
      parts.push(`---\n${sessionContext.documentExcerpt}`);
    }
    if (parts.length === 0) {
      toast({ title: "No session context to share", variant: "destructive" });
      return;
    }
    sendMutation.mutate({
      content: parts.join("\n\n"),
      messageType: "context-share",
      contextRef: JSON.stringify({
        templateName: sessionContext.templateName,
        objective: sessionContext.objective,
      }),
    });
  };

  const hasContext = !!(sessionContext.objective || sessionContext.documentExcerpt);

  return (
    <>
      {/* Thread header */}
      <div className="flex items-center gap-2 px-3 py-3 border-b">
        <Button variant="ghost" size="icon" onClick={onBack} className="shrink-0">
          <ArrowLeft className="w-4 h-4" />
        </Button>
        {otherUser && (
          <>
            <Avatar className="w-8 h-8">
              {otherUser.avatarUrl && <AvatarImage src={otherUser.avatarUrl} />}
              <AvatarFallback className="text-xs">
                {otherUser.displayName.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{otherUser.displayName}</p>
              <p className="text-[11px] text-muted-foreground truncate">{otherUser.email}</p>
            </div>
          </>
        )}
        {/* Share context button */}
        {hasContext && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="shrink-0"
                onClick={handleShareContext}
                disabled={sendMutation.isPending}
              >
                <Share2 className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              Share current objective &amp; document excerpt
            </TooltipContent>
          </Tooltip>
        )}
      </div>

      {/* Compact session context banner inside thread */}
      {sessionContext.objective && (
        <div className="px-3 py-1.5 bg-muted/30 border-b flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Target className="w-3 h-3 shrink-0" />
          <span className="truncate">{sessionContext.objective}</span>
        </div>
      )}

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {isLoading ? (
          <div className="text-center text-muted-foreground text-sm py-8">Loading messages...</div>
        ) : messagesList.length === 0 ? (
          <div className="text-center py-12">
            <MessageSquare className="w-10 h-10 mx-auto mb-2 text-muted-foreground/20" />
            <p className="text-muted-foreground text-sm mb-1">Send the first message</p>
            {hasContext && (
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-muted-foreground"
                onClick={handleShareContext}
              >
                <Share2 className="w-3 h-3 mr-1" />
                or share what you're working on
              </Button>
            )}
          </div>
        ) : (
          messagesList.map((msg) => (
            <MessageBubble key={msg.id} message={msg} otherUser={otherUser} />
          ))
        )}
      </div>

      {/* Message input */}
      <div className="border-t p-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex gap-2"
        >
          {hasContext && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="shrink-0"
                  onClick={handleShareContext}
                  disabled={sendMutation.isPending}
                >
                  <Paperclip className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Share context</TooltipContent>
            </Tooltip>
          )}
          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 text-sm"
            disabled={sendMutation.isPending}
          />
          <Button
            type="submit"
            size="icon"
            disabled={!input.trim() || sendMutation.isPending}
          >
            <Send className="w-4 h-4" />
          </Button>
        </form>
        <p className="text-[10px] text-muted-foreground/50 mt-1.5 text-center">
          Messages are encrypted and auto-delete after 7 days
        </p>
      </div>
    </>
  );
}

// ── Message Bubble ──

function MessageBubble({
  message,
  otherUser,
}: {
  message: MessageItem;
  otherUser: ConversationListItem["otherUser"] | null;
}) {
  const isMine = !otherUser || message.senderId !== otherUser.userId;

  return (
    <div className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[80%] rounded-2xl px-3 py-2 ${
          isMine
            ? "bg-primary text-primary-foreground rounded-br-md"
            : "bg-muted rounded-bl-md"
        }`}
      >
        {message.messageType === "context-share" && (
          <div className={`flex items-center gap-1.5 text-[11px] mb-1 ${
            isMine ? "text-primary-foreground/70" : "text-muted-foreground"
          }`}>
            <Share2 className="w-3 h-3" />
            Shared context
          </div>
        )}
        <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
        <div className={`flex items-center gap-1 mt-1 ${isMine ? "justify-end" : "justify-start"}`}>
          <span className="text-[10px] opacity-50">
            {formatTime(message.createdAt)}
          </span>
          {isMine && message.readAt && (
            <Check className="w-3 h-3 opacity-50" />
          )}
        </div>
      </div>
    </div>
  );
}

// ── Helpers ──

function formatRelativeTime(isoStr: string): string {
  const diff = Date.now() - new Date(isoStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(isoStr).toLocaleDateString();
}

function formatTime(isoStr: string): string {
  return new Date(isoStr).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
