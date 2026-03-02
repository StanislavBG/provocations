/**
 * ShareDialog — Share a document or folder with a connected user.
 * Shows list of accepted connections as potential recipients.
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Share2,
  FileText,
  FolderOpen,
  Send,
  Loader2,
  Check,
  Users,
} from "lucide-react";
import type { ConnectionItem, ShareItemType, SharePermission } from "@shared/schema";

interface ShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemType: ShareItemType;
  itemId: number;
  itemTitle: string;
}

export function ShareDialog({ open, onOpenChange, itemType, itemId, itemTitle }: ShareDialogProps) {
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [permission, setPermission] = useState<SharePermission>("read");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: connectionsList = [], isLoading } = useQuery<ConnectionItem[]>({
    queryKey: ["/api/chat/connections"],
    enabled: open,
  });

  const acceptedConnections = connectionsList.filter(c => c.status === "accepted");

  const shareMutation = useMutation({
    mutationFn: async () => {
      if (!selectedUserId) throw new Error("Select a recipient");
      await apiRequest("POST", "/api/share", {
        recipientId: selectedUserId,
        itemType,
        itemId,
        permission,
        note: note.trim() || undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shared-by-me"] });
      toast({ title: "Shared successfully", description: `${itemType === "folder" ? "Folder" : "Document"} shared with your connection` });
      onOpenChange(false);
      setSelectedUserId(null);
      setNote("");
      setPermission("read");
    },
    onError: (err: any) => {
      const message = err?.message || "Failed to share";
      toast({ title: "Share failed", description: message, variant: "destructive" });
    },
  });

  const ItemIcon = itemType === "folder" ? FolderOpen : FileText;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-serif">
            <Share2 className="w-4 h-4 text-primary" />
            Share {itemType === "folder" ? "Folder" : "Document"}
          </DialogTitle>
          <DialogDescription className="flex items-center gap-2 text-sm">
            <ItemIcon className="w-3.5 h-3.5" />
            {itemTitle}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* Recipient selection */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-2 block">
              Share with connection
            </label>
            {isLoading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              </div>
            ) : acceptedConnections.length === 0 ? (
              <div className="flex flex-col items-center py-6 text-muted-foreground">
                <Users className="w-8 h-8 mb-2 opacity-30" />
                <p className="text-xs">No connections yet. Invite someone first.</p>
              </div>
            ) : (
              <ScrollArea className="max-h-[200px]">
                <div className="space-y-1">
                  {acceptedConnections.map((conn) => {
                    const isSelected = selectedUserId === conn.userId;
                    return (
                      <button
                        key={conn.id}
                        className={`
                          w-full flex items-center gap-3 p-2.5 rounded-lg text-left transition-colors
                          ${isSelected ? "bg-primary/10 border border-primary/20" : "hover:bg-muted/50 border border-transparent"}
                        `}
                        onClick={() => setSelectedUserId(isSelected ? null : conn.userId)}
                      >
                        <Avatar className="w-8 h-8">
                          {conn.avatarUrl && <AvatarImage src={conn.avatarUrl} />}
                          <AvatarFallback className="text-xs">
                            {(conn.displayName || conn.email).charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{conn.displayName}</p>
                          <p className="text-[11px] text-muted-foreground truncate">{conn.email}</p>
                        </div>
                        {isSelected && (
                          <Check className="w-4 h-4 text-primary shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </ScrollArea>
            )}
          </div>

          {/* Permission */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-2 block">
              Permission
            </label>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant={permission === "read" ? "default" : "outline"}
                className="h-7 text-xs"
                onClick={() => setPermission("read")}
              >
                Read only
              </Button>
              <Button
                size="sm"
                variant={permission === "write" ? "default" : "outline"}
                className="h-7 text-xs"
                onClick={() => setPermission("write")}
              >
                Can edit
              </Button>
            </div>
          </div>

          {/* Optional note */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-2 block">
              Note (optional)
            </label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add a note about what you're sharing..."
              className="h-[60px] text-sm resize-none"
              maxLength={500}
            />
          </div>

          {/* Share button */}
          <Button
            className="w-full"
            onClick={() => shareMutation.mutate()}
            disabled={!selectedUserId || shareMutation.isPending}
          >
            {shareMutation.isPending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Send className="w-4 h-4 mr-2" />
            )}
            Share
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
