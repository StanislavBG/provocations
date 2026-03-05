/**
 * ApiConnectionExpandedView — Full expanded view for API Connection nodes.
 *
 * Left panel: platform service picker, auth status, webhook config.
 * Right panel: post preview, status indicator, post log.
 */

import { useState, useCallback, useMemo, useEffect } from "react";
import { Play, Loader2, CheckCircle, XCircle, Wifi, RefreshCw, Unplug } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ProvokeText } from "@/components/ProvokeText";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { FlowNode, FlowEdge } from "../useFlowCanvas";
import { SOCIAL_PLATFORMS } from "@/lib/social-platforms";
import { lifecycleLogStore } from "@/lib/lifecycleLog";

interface ApiConnectionExpandedViewProps {
  node: FlowNode;
  nodes: FlowNode[];
  edges: FlowEdge[];
  onUpdateNode: (nodeId: string, patch: Partial<FlowNode>) => void;
  onPlayNode?: (nodeId: string) => void;
}

export function ApiConnectionExpandedView({ node, nodes, edges, onUpdateNode, onPlayNode }: ApiConnectionExpandedViewProps) {
  const { toast } = useToast();
  const [isPosting, setIsPosting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<Record<string, { connected: boolean; status: string; accountName: string | null }>>({});

  const service = node.apiService;
  const postLog = node.apiPostLog || [];

  // Gather input content
  const inputContent = useMemo(() => {
    const inputEdges = edges.filter((e) => e.toNodeId === node.id);
    const inputNodes = inputEdges
      .map((e) => nodes.find((n) => n.id === e.fromNodeId))
      .filter(Boolean) as FlowNode[];
    return inputNodes
      .map((n) => n.documentContent || n.content || n.snippet || "")
      .filter((s) => s.trim())
      .join("\n\n---\n\n");
  }, [node.id, nodes, edges]);

  // Auto-detect platform from upstream node label
  const detectedPlatform = useMemo(() => {
    const inputEdges = edges.filter((e) => e.toNodeId === node.id);
    const inputNodes = inputEdges
      .map((e) => nodes.find((n) => n.id === e.fromNodeId))
      .filter(Boolean) as FlowNode[];
    for (const n of inputNodes) {
      const label = (n.label || "").toLowerCase();
      for (const pid of Object.keys(SOCIAL_PLATFORMS)) {
        if (label.includes(pid)) return pid;
      }
    }
    return null;
  }, [node.id, nodes, edges]);

  // Fetch connection status
  useEffect(() => {
    fetch("/api/platform-credentials")
      .then((r) => r.json())
      .then((data: { platforms?: Array<{ platform: string; connected: boolean; status: string; accountName: string | null }> }) => {
        if (data.platforms) {
          const status: Record<string, { connected: boolean; status: string; accountName: string | null }> = {};
          for (const p of data.platforms) {
            status[p.platform] = { connected: p.connected, status: p.status, accountName: p.accountName };
          }
          setConnectionStatus(status);
        }
      })
      .catch(() => {});
  }, []);

  const handleSelectService = useCallback((platformId: string) => {
    const conn = connectionStatus[platformId];
    onUpdateNode(node.id, {
      apiService: platformId as any,
      apiAuthStatus: conn?.connected ? "connected" : conn?.status === "expired" ? "expired" : "none",
      snippet: `API: ${SOCIAL_PLATFORMS[platformId]?.name || platformId}`,
    });
  }, [node.id, onUpdateNode, connectionStatus]);

  const handleConnect = useCallback((platformId: string) => {
    const popup = window.open(
      `/api/oauth/${platformId}/authorize`,
      `oauth-${platformId}`,
      "width=600,height=700,popup=yes",
    );
    const handler = (event: MessageEvent) => {
      if (event.data?.type === "oauth-success" && event.data.platform === platformId) {
        setConnectionStatus((prev) => ({
          ...prev,
          [platformId]: { connected: true, status: "active", accountName: null },
        }));
        onUpdateNode(node.id, { apiAuthStatus: "connected" });
        toast({ title: `Connected to ${SOCIAL_PLATFORMS[platformId]?.name || platformId}` });
        window.removeEventListener("message", handler);
      } else if (event.data?.type === "oauth-error" && event.data.platform === platformId) {
        toast({ title: "Connection failed", description: event.data.error, variant: "destructive" });
        window.removeEventListener("message", handler);
      }
    };
    window.addEventListener("message", handler);
  }, [node.id, onUpdateNode, toast]);

  const handleDisconnect = useCallback(async (platformId: string) => {
    try {
      await apiRequest("DELETE", `/api/platform-credentials/${platformId}`);
      setConnectionStatus((prev) => ({
        ...prev,
        [platformId]: { connected: false, status: "none", accountName: null },
      }));
      onUpdateNode(node.id, { apiAuthStatus: "none" });
      toast({ title: `Disconnected from ${SOCIAL_PLATFORMS[platformId]?.name || platformId}` });
    } catch {
      toast({ title: "Disconnect failed", variant: "destructive" });
    }
  }, [node.id, onUpdateNode, toast]);

  const lcLog = useCallback(
    (phase: "pre-process" | "process" | "post-process", status: "start" | "success" | "error", message: string, extra?: { durationMs?: number; error?: string }) => {
      lifecycleLogStore.push({ phase, status, nodeId: node.id, nodeType: node.type, nodeLabel: node.label || "API Connection", message, ...extra });
    },
    [node.id, node.type, node.label],
  );

  const handlePost = useCallback(async () => {
    const t0 = performance.now();
    if (!service || !inputContent.trim()) {
      lcLog("pre-process", "error", "No platform or content", { error: "Missing platform or content" });
      toast({ title: "Nothing to post", description: "Select a platform and connect content" });
      return;
    }

    lcLog("pre-process", "success", `Platform: ${SOCIAL_PLATFORMS[service]?.name || service}, ${inputContent.length} chars`);
    setIsPosting(true);
    onUpdateNode(node.id, { llmStatus: "running" });
    lcLog("process", "start", `Posting to ${SOCIAL_PLATFORMS[service]?.name || service}`);

    try {
      const res = await apiRequest("POST", "/api/social/post", {
        platform: service,
        content: inputContent,
      });
      const data = (await res.json()) as { success: boolean; externalPostId?: string; externalPostUrl?: string; error?: string };

      const logEntry = {
        platform: service,
        status: data.success ? "success" : "failed",
        message: data.success ? `Posted (${data.externalPostId || "ok"})` : (data.error || "Failed"),
        timestamp: new Date().toISOString(),
        externalId: data.externalPostId,
      };

      const elapsed = Math.round(performance.now() - t0);

      onUpdateNode(node.id, {
        llmStatus: data.success ? "done" : "error",
        snippet: data.success ? `Posted to ${SOCIAL_PLATFORMS[service]?.name || service}` : (data.error || "Failed"),
        apiLastResult: logEntry,
        apiPostLog: [...postLog, logEntry],
      });

      if (data.success) {
        lcLog("process", "success", `Posted (${data.externalPostId || "ok"})`, { durationMs: elapsed });
        lcLog("post-process", "success", `Post log updated (${postLog.length + 1} entries)`);
      } else {
        lcLog("process", "error", data.error || "Post failed", { error: data.error, durationMs: elapsed });
      }

      toast({
        title: data.success ? "Posted successfully" : "Post failed",
        description: data.success ? data.externalPostUrl : data.error,
        variant: data.success ? "default" : "destructive",
      });
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Network error";
      lcLog("process", "error", errMsg, { error: errMsg, durationMs: Math.round(performance.now() - t0) });
      const logEntry = {
        platform: service,
        status: "failed",
        message: "Network error",
        timestamp: new Date().toISOString(),
      };
      onUpdateNode(node.id, {
        llmStatus: "error",
        snippet: "Post failed",
        apiPostLog: [...postLog, logEntry],
      });
      toast({ title: "Post failed", variant: "destructive" });
    } finally {
      setIsPosting(false);
    }
  }, [service, inputContent, node.id, onUpdateNode, postLog, toast, lcLog]);

  const serviceConn = service ? connectionStatus[service] : null;

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left panel: Config */}
      <div className="w-80 border-r flex flex-col shrink-0 bg-card/50">
        <ScrollArea className="flex-1">
          <div className="p-4 space-y-5">
            {/* Auto-detected hint */}
            {detectedPlatform && !service && (
              <div className="px-3 py-2 rounded-lg border border-green-500/30 bg-green-500/10 text-xs text-green-400">
                Detected upstream: {SOCIAL_PLATFORMS[detectedPlatform]?.name || detectedPlatform}
                <Button
                  size="sm"
                  variant="ghost"
                  className="ml-2 h-6 px-2 text-[10px]"
                  onClick={() => handleSelectService(detectedPlatform)}
                >
                  Use
                </Button>
              </div>
            )}

            {/* Service picker */}
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                Platform
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(SOCIAL_PLATFORMS).map(([id, meta]) => {
                  const conn = connectionStatus[id];
                  const isSelected = service === id;
                  return (
                    <button
                      key={id}
                      className={`p-2.5 rounded-lg border text-left transition-colors ${
                        isSelected
                          ? "border-green-500/50 bg-green-500/10"
                          : "border-border/50 hover:bg-muted/30"
                      }`}
                      onClick={() => handleSelectService(id)}
                    >
                      <div className="flex items-center gap-1.5 mb-1">
                        <div
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: conn?.connected ? "#22c55e" : "#666" }}
                        />
                        <span className="text-[11px] font-medium">{meta.name}</span>
                      </div>
                      {conn?.accountName && (
                        <p className="text-[9px] text-muted-foreground truncate">@{conn.accountName}</p>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Auth section */}
            {service && (
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  Connection
                </h3>
                {serviceConn?.connected ? (
                  <div className="flex items-center gap-2">
                    <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                      <CheckCircle className="w-3 h-3 mr-1" />
                      Connected
                    </Badge>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-[10px] text-red-400 hover:text-red-300"
                      onClick={() => handleDisconnect(service)}
                    >
                      <Unplug className="w-3 h-3 mr-1" />
                      Disconnect
                    </Button>
                  </div>
                ) : (
                  <Button
                    size="sm"
                    className="gap-1.5"
                    onClick={() => handleConnect(service)}
                  >
                    <Wifi className="w-3.5 h-3.5" />
                    Connect to {SOCIAL_PLATFORMS[service]?.name || service}
                  </Button>
                )}
              </div>
            )}

            {/* Webhook config (for custom type) */}
            {service === "webhook" && (
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  Webhook URL
                </h3>
                <input
                  className="w-full px-2.5 py-1.5 rounded border border-border/50 bg-muted/30 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50"
                  placeholder="https://..."
                  value={node.apiWebhookUrl || ""}
                  onChange={(e) => onUpdateNode(node.id, { apiWebhookUrl: e.target.value })}
                />
              </div>
            )}

            {/* Post button */}
            <Button
              className="w-full gap-2"
              disabled={isPosting || !service || !inputContent.trim() || !serviceConn?.connected}
              onClick={handlePost}
            >
              {isPosting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Posting...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  Post Now
                </>
              )}
            </Button>
          </div>
        </ScrollArea>
      </div>

      {/* Right panel: Preview + Log */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Status banner */}
        {node.apiLastResult && (
          <div className={`px-4 py-2 border-b flex items-center gap-2 text-sm ${
            node.apiLastResult.status === "success"
              ? "bg-green-500/10 text-green-400"
              : "bg-red-500/10 text-red-400"
          }`}>
            {node.apiLastResult.status === "success" ? (
              <CheckCircle className="w-4 h-4" />
            ) : (
              <XCircle className="w-4 h-4" />
            )}
            {node.apiLastResult.message}
          </div>
        )}

        {/* Post preview */}
        <div className="flex-1 overflow-auto p-4 space-y-4">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              Post Preview
            </h3>
            {inputContent ? (
              <ProvokeText
                value={inputContent}
                onChange={() => {}}
                readOnly
                chrome="container"
                variant="textarea"
                label="Content to post"
                showCopy
                showClear={false}
              />
            ) : (
              <p className="text-sm text-muted-foreground/60 italic">
                No content — connect upstream nodes
              </p>
            )}
          </div>

          {/* Post log */}
          {postLog.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Post History
              </h3>
              <div className="space-y-1.5">
                {[...postLog].reverse().map((entry, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 px-3 py-2 rounded border border-border/50 bg-muted/20"
                  >
                    {entry.status === "success" ? (
                      <CheckCircle className="w-3.5 h-3.5 text-green-500 shrink-0" />
                    ) : (
                      <XCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-medium truncate">{entry.message}</p>
                      <p className="text-[9px] text-muted-foreground">
                        {new Date(entry.timestamp).toLocaleString()}
                        {entry.platform && ` · ${SOCIAL_PLATFORMS[entry.platform]?.name || entry.platform}`}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
