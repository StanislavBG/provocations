/**
 * ChatDrawer — slide-out messaging panel for user-to-user conversations.
 * Opens from the right side of the workspace. Contains three views:
 *   1. Conversation list (default)
 *   2. Active message thread
 *   3. Chat settings
 */
import { useState, useCallback, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  MessageSquare,
  ArrowLeft,
  Send,
  Settings,
  UserPlus,
  Check,
  X,
  Clock,
  ChevronRight,
  Share2,
} from "lucide-react";
import type {
  ConnectionItem,
  ConversationListItem,
  MessageItem,
} from "@shared/schema";
import { ChatSettings } from "./ChatSettings";
import { ConnectionsManager } from "./ConnectionsManager";

interface ChatDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type DrawerView = "conversations" | "thread" | "settings" | "connections";

export function ChatDrawer({ open, onOpenChange }: ChatDrawerProps) {
  const [view, setView] = useState<DrawerView>("conversations");
  const [activeConversationId, setActiveConversationId] = useState<number | null>(null);
  const [activeOtherUser, setActiveOtherUser] = useState<ConversationListItem["otherUser"] | null>(null);
  const queryClient = useQueryClient();

  // Reset to conversation list when drawer closes
  useEffect(() => {
    if (!open) {
      setView("conversations");
      setActiveConversationId(null);
    }
  }, [open]);

  const openThread = useCallback((convoId: number, otherUser: ConversationListItem["otherUser"]) => {
    setActiveConversationId(convoId);
    setActiveOtherUser(otherUser);
    setView("thread");
  }, []);

  const goBack = useCallback(() => {
    setView("conversations");
    setActiveConversationId(null);
    // Refresh conversation list when leaving a thread
    queryClient.invalidateQueries({ queryKey: ["/api/chat/conversations"] });
  }, [queryClient]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-[400px] sm:w-[440px] p-0 flex flex-col"
      >
        {view === "conversations" && (
          <ConversationListView
            onOpenThread={openThread}
            onOpenSettings={() => setView("settings")}
            onOpenConnections={() => setView("connections")}
          />
        )}
        {view === "thread" && activeConversationId && (
          <ThreadView
            conversationId={activeConversationId}
            otherUser={activeOtherUser}
            onBack={goBack}
          />
        )}
        {view === "settings" && (
          <ChatSettings onBack={() => setView("conversations")} />
        )}
        {view === "connections" && (
          <ConnectionsManager onBack={() => setView("conversations")} />
        )}
      </SheetContent>
    </Sheet>
  );
}

// ── Conversation List ──

function ConversationListView({
  onOpenThread,
  onOpenSettings,
  onOpenConnections,
}: {
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
    refetchInterval: 10000, // Poll every 10s for new messages
  });

  // Check for pending invitations
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

  return (
    <>
      <SheetHeader className="px-4 pt-4 pb-2">
        <div className="flex items-center justify-between">
          <SheetTitle className="flex items-center gap-2 font-serif">
            <MessageSquare className="w-5 h-5" />
            Messages
            {totalUnread > 0 && (
              <Badge variant="destructive" className="text-xs px-1.5 py-0">
                {totalUnread}
              </Badge>
            )}
          </SheetTitle>
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" onClick={onOpenConnections} title="Connections">
              <UserPlus className="w-4 h-4" />
              {pendingIncoming.length > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-destructive rounded-full" />
              )}
            </Button>
            <Button variant="ghost" size="icon" onClick={onOpenSettings} title="Chat settings">
              <Settings className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </SheetHeader>

      <Separator />

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
  onBack,
}: {
  conversationId: number;
  otherUser: ConversationListItem["otherUser"] | null;
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
    refetchInterval: 3000, // Poll every 3s for near-real-time
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
    mutationFn: async (content: string) => {
      const res = await apiRequest("POST", "/api/chat/messages", {
        conversationId,
        content,
        messageType: "text",
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
    sendMutation.mutate(trimmed);
  };

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
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{otherUser.displayName}</p>
              <p className="text-[11px] text-muted-foreground truncate">{otherUser.email}</p>
            </div>
          </>
        )}
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {isLoading ? (
          <div className="text-center text-muted-foreground text-sm py-8">Loading messages...</div>
        ) : messagesList.length === 0 ? (
          <div className="text-center py-12">
            <MessageSquare className="w-10 h-10 mx-auto mb-2 text-muted-foreground/20" />
            <p className="text-muted-foreground text-sm">Send the first message</p>
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
          <div className="flex items-center gap-1.5 text-[11px] opacity-70 mb-1">
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
