/**
 * ConnectionsManager — invite collaborators and manage connections.
 * Accessible from the chat drawer header.
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  UserPlus,
  Send,
  Check,
  X,
  Ban,
  Clock,
  ArrowUpRight,
  ArrowDownLeft,
  Trash2,
  Loader2,
} from "lucide-react";
import type { ConnectionItem } from "@shared/schema";

interface ConnectionsManagerProps {
  onBack: () => void;
}

export function ConnectionsManager({ onBack }: ConnectionsManagerProps) {
  const [email, setEmail] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: connectionsList = [], isLoading } = useQuery<ConnectionItem[]>({
    queryKey: ["/api/chat/connections"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/chat/connections");
      return res.json();
    },
  });

  const inviteMutation = useMutation({
    mutationFn: async (targetEmail: string) => {
      const res = await apiRequest("POST", "/api/chat/connections/invite", { email: targetEmail });
      return res.json();
    },
    onSuccess: () => {
      setEmail("");
      toast({ title: "Invitation sent" });
      queryClient.invalidateQueries({ queryKey: ["/api/chat/connections"] });
    },
    onError: (err: any) => {
      const msg = err?.message || "Failed to send invitation";
      toast({ title: msg, variant: "destructive" });
    },
  });

  const respondMutation = useMutation({
    mutationFn: async ({ connectionId, action }: { connectionId: number; action: string }) => {
      const res = await apiRequest("POST", "/api/chat/connections/respond", { connectionId, action });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/chat/connections"] });
      queryClient.invalidateQueries({ queryKey: ["/api/chat/conversations"] });
    },
    onError: () => {
      toast({ title: "Failed to respond", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/chat/connections/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/chat/connections"] });
      queryClient.invalidateQueries({ queryKey: ["/api/chat/conversations"] });
    },
    onError: () => {
      toast({ title: "Failed to remove connection", variant: "destructive" });
    },
  });

  const handleInvite = () => {
    const trimmed = email.trim();
    if (!trimmed) return;
    inviteMutation.mutate(trimmed);
  };

  const pendingIncoming = connectionsList.filter((c) => c.status === "pending" && c.direction === "incoming");
  const pendingOutgoing = connectionsList.filter((c) => c.status === "pending" && c.direction === "outgoing");
  const accepted = connectionsList.filter((c) => c.status === "accepted");
  const blocked = connectionsList.filter((c) => c.status === "blocked");

  return (
    <>
      <div className="flex items-center gap-2 px-3 py-3 border-b">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <h2 className="font-serif font-semibold">Connections</h2>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-6">
          {/* ── Invite by email ── */}
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
              <UserPlus className="w-3.5 h-3.5" />
              Invite a collaborator
            </h3>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleInvite();
              }}
              className="flex gap-2"
            >
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="colleague@example.com"
                className="flex-1 text-sm"
                disabled={inviteMutation.isPending}
              />
              <Button
                type="submit"
                size="sm"
                disabled={!email.trim() || inviteMutation.isPending}
              >
                {inviteMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </Button>
            </form>
            <p className="text-[11px] text-muted-foreground mt-1">
              They must have a Provocations account to connect
            </p>
          </section>

          {/* ── Pending incoming ── */}
          {pendingIncoming.length > 0 && (
            <>
              <Separator />
              <section>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                  <ArrowDownLeft className="w-3.5 h-3.5" />
                  Pending invitations ({pendingIncoming.length})
                </h3>
                <div className="space-y-2">
                  {pendingIncoming.map((conn) => (
                    <div key={conn.id} className="flex items-center gap-3 p-2 rounded-md bg-muted/40">
                      <Avatar className="w-8 h-8">
                        {conn.avatarUrl && <AvatarImage src={conn.avatarUrl} />}
                        <AvatarFallback className="text-xs">
                          {conn.displayName.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{conn.displayName}</p>
                        <p className="text-[11px] text-muted-foreground truncate">{conn.email}</p>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-green-600"
                          title="Accept"
                          onClick={() => respondMutation.mutate({ connectionId: conn.id, action: "accept" })}
                          disabled={respondMutation.isPending}
                        >
                          <Check className="w-4 h-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-destructive"
                          title="Decline"
                          onClick={() => respondMutation.mutate({ connectionId: conn.id, action: "decline" })}
                          disabled={respondMutation.isPending}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </>
          )}

          {/* ── Pending outgoing ── */}
          {pendingOutgoing.length > 0 && (
            <>
              <Separator />
              <section>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                  <ArrowUpRight className="w-3.5 h-3.5" />
                  Sent invitations ({pendingOutgoing.length})
                </h3>
                <div className="space-y-2">
                  {pendingOutgoing.map((conn) => (
                    <div key={conn.id} className="flex items-center gap-3 p-2 rounded-md">
                      <Avatar className="w-8 h-8">
                        {conn.avatarUrl && <AvatarImage src={conn.avatarUrl} />}
                        <AvatarFallback className="text-xs">
                          {conn.displayName.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{conn.displayName}</p>
                        <p className="text-[11px] text-muted-foreground truncate">{conn.email}</p>
                      </div>
                      <Badge variant="outline" className="text-[10px] gap-1">
                        <Clock className="w-3 h-3" />
                        Pending
                      </Badge>
                    </div>
                  ))}
                </div>
              </section>
            </>
          )}

          {/* ── Active connections ── */}
          <Separator />
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              Connected ({accepted.length})
            </h3>
            {accepted.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No active connections yet
              </p>
            ) : (
              <div className="space-y-1">
                {accepted.map((conn) => (
                  <div key={conn.id} className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/40">
                    <Avatar className="w-8 h-8">
                      {conn.avatarUrl && <AvatarImage src={conn.avatarUrl} />}
                      <AvatarFallback className="text-xs">
                        {conn.displayName.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{conn.displayName}</p>
                      <p className="text-[11px] text-muted-foreground truncate">{conn.email}</p>
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      title="Remove connection"
                      onClick={() => {
                        if (confirm(`Remove connection with ${conn.displayName}?`)) {
                          deleteMutation.mutate(conn.id);
                        }
                      }}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* ── Blocked ── */}
          {blocked.length > 0 && (
            <>
              <Separator />
              <section>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                  <Ban className="w-3.5 h-3.5" />
                  Blocked ({blocked.length})
                </h3>
                <div className="space-y-1">
                  {blocked.map((conn) => (
                    <div key={conn.id} className="flex items-center gap-3 p-2 rounded-md opacity-60">
                      <Avatar className="w-8 h-8">
                        <AvatarFallback className="text-xs">
                          {conn.displayName.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{conn.displayName}</p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => deleteMutation.mutate(conn.id)}
                      >
                        Unblock
                      </Button>
                    </div>
                  ))}
                </div>
              </section>
            </>
          )}
        </div>
      </ScrollArea>
    </>
  );
}
