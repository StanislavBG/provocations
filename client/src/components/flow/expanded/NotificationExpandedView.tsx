import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Bell, Users, Mail, Link2, Send, Clock } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { FlowNode } from "../useFlowCanvas";

interface NotificationExpandedViewProps {
  node: FlowNode;
  onUpdateNode: (nodeId: string, patch: Partial<FlowNode>) => void;
  onPlayNode?: (nodeId: string) => void;
}

export function NotificationExpandedView({
  node,
  onUpdateNode,
  onPlayNode,
}: NotificationExpandedViewProps) {
  const [message, setMessage] = useState(node.notifyMessage || "Chain completed: {label} at {time}");
  const [includeLink, setIncludeLink] = useState(node.notifyIncludeLink !== false);
  const [channels, setChannels] = useState<Set<string>>(
    new Set(node.notifyChannels || ["in-app"]),
  );
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(
    new Set(node.notifyUserIds || []),
  );

  // Fetch connected users
  const { data: connections } = useQuery({
    queryKey: ["/api/chat/connections"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/chat/connections");
      return (await res.json()) as Array<{
        id: number;
        peerId: string;
        peerName: string;
        peerAvatar?: string;
        status: string;
      }>;
    },
  });

  const acceptedConnections = connections?.filter((c) => c.status === "accepted") || [];

  // Sync state back to node on change
  useEffect(() => {
    onUpdateNode(node.id, {
      notifyMessage: message,
      notifyIncludeLink: includeLink,
      notifyChannels: Array.from(channels) as ("in-app" | "email")[],
      notifyUserIds: Array.from(selectedUserIds),
    });
  }, [message, includeLink, channels, selectedUserIds, node.id, onUpdateNode]);

  const toggleChannel = (ch: string) => {
    setChannels((prev) => {
      const next = new Set(prev);
      if (next.has(ch)) next.delete(ch);
      else next.add(ch);
      return next;
    });
  };

  const toggleUser = (userId: string) => {
    setSelectedUserIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const selectAll = useCallback(() => {
    setSelectedUserIds(new Set(acceptedConnections.map((c) => c.peerId)));
  }, [acceptedConnections]);

  const previewMessage = message
    .replace(/\{output\}/g, "(upstream output preview)")
    .replace(/\{label\}/g, node.label)
    .replace(/\{time\}/g, new Date().toLocaleString());

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left panel: Configuration */}
      <div className="w-80 border-r flex flex-col bg-card/50">
        <div className="p-4 border-b border-border/50">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Bell className="w-4 h-4 text-pink-500" />
            Notification Settings
          </h3>
        </div>

        <div className="flex-1 overflow-auto p-4 space-y-5">
          {/* Message template */}
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">
              Message Template
            </label>
            <textarea
              className="w-full min-h-[80px] text-sm bg-muted/30 border border-border/50 rounded-lg p-2.5 resize-y focus:outline-none focus:ring-1 focus:ring-primary/50"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Notification message..."
            />
            <p className="text-[10px] text-muted-foreground mt-1">
              Placeholders: <code className="text-pink-400">{"{output}"}</code>, <code className="text-pink-400">{"{label}"}</code>, <code className="text-pink-400">{"{time}"}</code>
            </p>
          </div>

          {/* Channels */}
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">
              Delivery Channels
            </label>
            <div className="flex gap-2">
              <button
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs transition-colors ${
                  channels.has("in-app")
                    ? "border-pink-500/50 bg-pink-500/10 text-pink-400"
                    : "border-border hover:bg-muted"
                }`}
                onClick={() => toggleChannel("in-app")}
              >
                <Bell className="w-3 h-3" />
                In-App
              </button>
              <button
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs transition-colors ${
                  channels.has("email")
                    ? "border-pink-500/50 bg-pink-500/10 text-pink-400"
                    : "border-border hover:bg-muted"
                }`}
                onClick={() => toggleChannel("email")}
              >
                <Mail className="w-3 h-3" />
                Email
              </button>
            </div>
          </div>

          {/* Include canvas link */}
          <div className="flex items-center gap-2">
            <button
              className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                includeLink ? "bg-pink-500 border-pink-500" : "border-border"
              }`}
              onClick={() => setIncludeLink(!includeLink)}
            >
              {includeLink && <Link2 className="w-2.5 h-2.5 text-white" />}
            </button>
            <span className="text-xs">Include link to canvas</span>
          </div>

          {/* Recipients */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Recipients
              </label>
              {acceptedConnections.length > 0 && (
                <button
                  className="text-[10px] text-pink-400 hover:underline"
                  onClick={selectAll}
                >
                  Select all
                </button>
              )}
            </div>
            {acceptedConnections.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">
                No connections yet. Connect with users to send notifications.
              </p>
            ) : (
              <div className="space-y-1 max-h-[200px] overflow-auto">
                {acceptedConnections.map((conn) => (
                  <button
                    key={conn.peerId}
                    className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-left text-xs transition-colors ${
                      selectedUserIds.has(conn.peerId)
                        ? "border-pink-500/50 bg-pink-500/10"
                        : "border-border hover:bg-muted"
                    }`}
                    onClick={() => toggleUser(conn.peerId)}
                  >
                    <Users className="w-3 h-3 text-muted-foreground shrink-0" />
                    <span className="truncate">{conn.peerName}</span>
                    {selectedUserIds.has(conn.peerId) && (
                      <div className="ml-auto w-2 h-2 rounded-full bg-pink-500 shrink-0" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Send / Test button */}
        <div className="p-4 border-t border-border/50">
          <Button
            size="sm"
            className="w-full bg-pink-600 hover:bg-pink-700"
            onClick={() => onPlayNode?.(node.id)}
            disabled={node.notifyStatus === "sending"}
          >
            <Send className="w-3.5 h-3.5 mr-1.5" />
            {node.notifyStatus === "sending" ? "Sending..." : "Send Test Notification"}
          </Button>
        </div>
      </div>

      {/* Right panel: Preview */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="p-4 border-b border-border/50">
          <h3 className="text-sm font-semibold">Message Preview</h3>
        </div>
        <div className="flex-1 overflow-auto p-6">
          <div className="max-w-md mx-auto">
            {/* Simulated notification card */}
            <div className="border border-border rounded-xl p-4 bg-card shadow-lg">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-pink-500/20 flex items-center justify-center shrink-0">
                  <Bell className="w-4 h-4 text-pink-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Just now
                  </div>
                  <p className="text-sm leading-relaxed">{previewMessage}</p>
                  {includeLink && (
                    <div className="mt-2 text-xs text-pink-400 hover:underline cursor-pointer flex items-center gap-1">
                      <Link2 className="w-3 h-3" />
                      Open Canvas
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Status info */}
            <div className="mt-6 text-center">
              <p className="text-xs text-muted-foreground">
                {selectedUserIds.size} recipient{selectedUserIds.size !== 1 ? "s" : ""} selected
                {" · "}
                {Array.from(channels).join(" + ") || "no channels"}
              </p>
              {node.notifyLastSent && (
                <p className="text-[10px] text-muted-foreground mt-1">
                  Last sent: {new Date(node.notifyLastSent).toLocaleString()}
                </p>
              )}
              {node.notifyStatus === "sent" && (
                <p className="text-xs text-emerald-500 mt-2">Notification sent successfully</p>
              )}
              {node.notifyStatus === "error" && (
                <p className="text-xs text-destructive mt-2">Failed to send notification</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
