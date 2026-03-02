/**
 * MailboxDrawer — Global notification mailbox.
 * Shows connection requests, share invitations, and other system events.
 * Accessible from the top bar (bell icon with unread badge).
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  Bell,
  UserPlus,
  UserCheck,
  Share2,
  CheckCircle,
  Check,
  X,
  FileText,
  FolderOpen,
  CheckCheck,
  Loader2,
} from "lucide-react";
import type { NotificationItem, SharedItemDisplay } from "@shared/schema";

interface MailboxDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const NOTIFICATION_CONFIG: Record<string, { icon: React.ElementType; label: string; color: string }> = {
  connection_request: { icon: UserPlus, label: "Connection Request", color: "text-blue-400" },
  connection_accepted: { icon: UserCheck, label: "Connection Accepted", color: "text-green-400" },
  item_shared: { icon: Share2, label: "Item Shared", color: "text-amber-400" },
  share_accepted: { icon: CheckCircle, label: "Share Accepted", color: "text-green-400" },
};

function getNotificationMessage(n: NotificationItem): string {
  const name = n.fromUserName || n.fromUserEmail || "Someone";
  switch (n.notificationType) {
    case "connection_request":
      return `${name} wants to connect with you`;
    case "connection_accepted":
      return `${name} accepted your connection request`;
    case "item_shared": {
      const itemType = n.metadata?.itemType === "folder" ? "folder" : "document";
      return `${name} shared a ${itemType} with you`;
    }
    case "share_accepted":
      return `${name} accepted your shared item`;
    default:
      return `Notification from ${name}`;
  }
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

export function MailboxDrawer({ open, onOpenChange }: MailboxDrawerProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: notifications = [], isLoading } = useQuery<NotificationItem[]>({
    queryKey: ["/api/mailbox"],
    refetchInterval: 15000,
  });

  const { data: pendingShares = [] } = useQuery<SharedItemDisplay[]>({
    queryKey: ["/api/shared-with-me"],
    refetchInterval: 30000,
  });

  const markReadMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("POST", `/api/mailbox/${id}/read`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/mailbox"] });
      queryClient.invalidateQueries({ queryKey: ["/api/mailbox/unread-count"] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/mailbox/read-all");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/mailbox"] });
      queryClient.invalidateQueries({ queryKey: ["/api/mailbox/unread-count"] });
      toast({ title: "All notifications marked as read" });
    },
  });

  // Accept/decline connection from notification
  const respondConnectionMutation = useMutation({
    mutationFn: async ({ connectionId, action }: { connectionId: number; action: string }) => {
      await apiRequest("POST", "/api/chat/connections/respond", { connectionId, action });
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["/api/chat/connections"] });
      queryClient.invalidateQueries({ queryKey: ["/api/chat/conversations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/mailbox"] });
      queryClient.invalidateQueries({ queryKey: ["/api/mailbox/unread-count"] });
      toast({ title: vars.action === "accept" ? "Connection accepted" : "Connection declined" });
    },
  });

  // Accept/decline share from notification
  const respondShareMutation = useMutation({
    mutationFn: async ({ shareId, action }: { shareId: number; action: "accept" | "decline" }) => {
      await apiRequest("POST", "/api/share/respond", { shareId, action });
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["/api/shared-with-me"] });
      queryClient.invalidateQueries({ queryKey: ["/api/mailbox"] });
      queryClient.invalidateQueries({ queryKey: ["/api/mailbox/unread-count"] });
      toast({ title: vars.action === "accept" ? "Share accepted — item now accessible" : "Share declined" });
    },
  });

  const unreadCount = notifications.filter(n => !n.readAt).length;
  const pendingShareIds = new Set(
    pendingShares.filter(s => s.status === "pending").map(s => s.id),
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[400px] sm:w-[440px] p-0 flex flex-col">
        <SheetHeader className="px-4 pt-4 pb-2 border-b border-border/50">
          <div className="flex items-center justify-between">
            <SheetTitle className="flex items-center gap-2 text-base font-serif">
              <Bell className="w-4 h-4 text-primary" />
              Mailbox
              {unreadCount > 0 && (
                <Badge variant="destructive" className="text-[10px] px-1.5 py-0 min-w-[18px] h-[18px]">
                  {unreadCount}
                </Badge>
              )}
            </SheetTitle>
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => markAllReadMutation.mutate()}
                disabled={markAllReadMutation.isPending}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                <CheckCheck className="w-3.5 h-3.5 mr-1" />
                Mark all read
              </Button>
            )}
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1 px-4 py-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Bell className="w-10 h-10 mb-3 opacity-30" />
              <p className="text-sm font-medium">No notifications yet</p>
              <p className="text-xs mt-1">Connection requests and shares will appear here</p>
            </div>
          ) : (
            <div className="space-y-1">
              {notifications.map((n) => {
                const config = NOTIFICATION_CONFIG[n.notificationType] || NOTIFICATION_CONFIG.connection_request;
                const Icon = config.icon;
                const isUnread = !n.readAt;
                const isConnectionRequest = n.notificationType === "connection_request";
                const isShareNotification = n.notificationType === "item_shared";
                const shareId = n.metadata?.shareId;
                const hasPendingShare = shareId && pendingShareIds.has(shareId);

                return (
                  <div
                    key={n.id}
                    className={`
                      flex gap-3 p-3 rounded-lg transition-colors cursor-pointer
                      ${isUnread ? "bg-primary/5 border border-primary/10" : "hover:bg-muted/50"}
                    `}
                    onClick={() => {
                      if (isUnread) markReadMutation.mutate(n.id);
                    }}
                  >
                    {/* Avatar */}
                    <Avatar className="w-9 h-9 shrink-0">
                      {n.fromUserAvatar && <AvatarImage src={n.fromUserAvatar} />}
                      <AvatarFallback className="text-xs bg-muted">
                        {(n.fromUserName || n.fromUserEmail || "?").charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start gap-1.5">
                        <Icon className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${config.color}`} />
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm leading-snug ${isUnread ? "font-medium" : ""}`}>
                            {getNotificationMessage(n)}
                          </p>
                          <p className="text-[11px] text-muted-foreground mt-0.5">{timeAgo(n.createdAt)}</p>
                        </div>
                        {isUnread && (
                          <div className="w-2 h-2 rounded-full bg-primary shrink-0 mt-1.5" />
                        )}
                      </div>

                      {/* Action buttons for actionable notifications */}
                      {isConnectionRequest && n.metadata?.connectionId && (
                        <div className="flex gap-2 mt-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs px-3 text-green-600 border-green-200 hover:bg-green-50"
                            onClick={(e) => {
                              e.stopPropagation();
                              respondConnectionMutation.mutate({
                                connectionId: n.metadata!.connectionId,
                                action: "accept",
                              });
                              if (isUnread) markReadMutation.mutate(n.id);
                            }}
                            disabled={respondConnectionMutation.isPending}
                          >
                            <Check className="w-3 h-3 mr-1" />
                            Accept
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs px-3 text-red-500 border-red-200 hover:bg-red-50"
                            onClick={(e) => {
                              e.stopPropagation();
                              respondConnectionMutation.mutate({
                                connectionId: n.metadata!.connectionId,
                                action: "decline",
                              });
                              if (isUnread) markReadMutation.mutate(n.id);
                            }}
                            disabled={respondConnectionMutation.isPending}
                          >
                            <X className="w-3 h-3 mr-1" />
                            Decline
                          </Button>
                        </div>
                      )}

                      {isShareNotification && hasPendingShare && (
                        <div className="flex gap-2 mt-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs px-3 text-green-600 border-green-200 hover:bg-green-50"
                            onClick={(e) => {
                              e.stopPropagation();
                              respondShareMutation.mutate({ shareId, action: "accept" });
                              if (isUnread) markReadMutation.mutate(n.id);
                            }}
                            disabled={respondShareMutation.isPending}
                          >
                            <Check className="w-3 h-3 mr-1" />
                            Accept
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs px-3 text-red-500 border-red-200 hover:bg-red-50"
                            onClick={(e) => {
                              e.stopPropagation();
                              respondShareMutation.mutate({ shareId, action: "decline" });
                              if (isUnread) markReadMutation.mutate(n.id);
                            }}
                            disabled={respondShareMutation.isPending}
                          >
                            <X className="w-3 h-3 mr-1" />
                            Decline
                          </Button>
                        </div>
                      )}

                      {/* Show share item info */}
                      {isShareNotification && n.metadata?.itemType && (
                        <div className="flex items-center gap-1.5 mt-1.5 text-[11px] text-muted-foreground">
                          {n.metadata.itemType === "folder" ? (
                            <FolderOpen className="w-3 h-3" />
                          ) : (
                            <FileText className="w-3 h-3" />
                          )}
                          <span>{n.metadata.itemType === "folder" ? "Shared folder" : "Shared document"}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
