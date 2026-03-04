/**
 * PlatformIntegrations — Dialog for managing social media platform connections.
 *
 * Lists all supported platforms with connection status, connect/disconnect buttons.
 * Reusable from both expanded views and the top bar integrations button.
 */

import { useState, useEffect, useCallback } from "react";
import { Wifi, WifiOff, RefreshCw, Loader2, ExternalLink, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { SOCIAL_PLATFORMS } from "@/lib/social-platforms";

interface PlatformStatus {
  platform: string;
  name: string;
  configured: boolean;
  connected: boolean;
  status: string;
  accountName: string | null;
  expiresAt: string | null;
}

interface PlatformIntegrationsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PlatformIntegrations({ open, onOpenChange }: PlatformIntegrationsProps) {
  const { toast } = useToast();
  const [platforms, setPlatforms] = useState<PlatformStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [connectingPlatform, setConnectingPlatform] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/platform-credentials");
      const data = (await res.json()) as { platforms?: PlatformStatus[] };
      if (data.platforms) {
        setPlatforms(data.platforms);
      }
    } catch {
      // Silent fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      setLoading(true);
      fetchStatus();
    }
  }, [open, fetchStatus]);

  const handleConnect = useCallback((platformId: string) => {
    setConnectingPlatform(platformId);
    const popup = window.open(
      `/api/oauth/${platformId}/authorize`,
      `oauth-${platformId}`,
      "width=600,height=700,popup=yes",
    );

    const handler = (event: MessageEvent) => {
      if (event.data?.platform === platformId) {
        if (event.data.type === "oauth-success") {
          toast({ title: `Connected to ${SOCIAL_PLATFORMS[platformId]?.name || platformId}` });
          fetchStatus();
        } else if (event.data.type === "oauth-error") {
          toast({ title: "Connection failed", description: event.data.error, variant: "destructive" });
        }
        setConnectingPlatform(null);
        window.removeEventListener("message", handler);
      }
    };
    window.addEventListener("message", handler);

    // Fallback: clear connecting state if popup is closed manually
    const interval = setInterval(() => {
      if (popup?.closed) {
        clearInterval(interval);
        setConnectingPlatform(null);
        window.removeEventListener("message", handler);
        fetchStatus();
      }
    }, 1000);
  }, [toast, fetchStatus]);

  const handleDisconnect = useCallback(async (platformId: string) => {
    try {
      await apiRequest("DELETE", `/api/platform-credentials/${platformId}`);
      toast({ title: `Disconnected from ${SOCIAL_PLATFORMS[platformId]?.name || platformId}` });
      fetchStatus();
    } catch {
      toast({ title: "Disconnect failed", variant: "destructive" });
    }
  }, [toast, fetchStatus]);

  const handleRefresh = useCallback(async (platformId: string) => {
    try {
      const res = await apiRequest("POST", `/api/platform-credentials/${platformId}/refresh`);
      const data = (await res.json()) as { success: boolean };
      if (data.success) {
        toast({ title: "Token refreshed" });
        fetchStatus();
      } else {
        toast({ title: "Refresh failed — reconnect required", variant: "destructive" });
      }
    } catch {
      toast({ title: "Refresh failed", variant: "destructive" });
    }
  }, [toast, fetchStatus]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[70vh] flex flex-col p-0">
        <DialogTitle className="px-4 pt-4 pb-2 text-base font-semibold flex items-center gap-2">
          <Wifi className="w-4 h-4" />
          Platform Integrations
        </DialogTitle>

        <ScrollArea className="flex-1 px-4 pb-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-3">
              {platforms.map((p) => {
                const meta = SOCIAL_PLATFORMS[p.platform];
                if (!meta) return null;
                const isConnecting = connectingPlatform === p.platform;

                return (
                  <div
                    key={p.platform}
                    className="flex items-center gap-3 p-3 rounded-lg border border-border/50 hover:bg-muted/20 transition-colors"
                  >
                    {/* Brand icon dot */}
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                      style={{ backgroundColor: meta.brandColor + "20" }}
                    >
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: meta.brandColor }}
                      />
                    </div>

                    {/* Name + status */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{meta.name}</p>
                      {p.connected ? (
                        <p className="text-[10px] text-green-500 flex items-center gap-1">
                          <CheckCircle className="w-2.5 h-2.5" />
                          Connected{p.accountName ? ` as @${p.accountName}` : ""}
                        </p>
                      ) : p.status === "expired" ? (
                        <p className="text-[10px] text-yellow-500">Expired — reconnect required</p>
                      ) : !p.configured ? (
                        <p className="text-[10px] text-muted-foreground/60">Not configured (missing env vars)</p>
                      ) : (
                        <p className="text-[10px] text-muted-foreground/60">Not connected</p>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 shrink-0">
                      {p.connected ? (
                        <>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0"
                            title="Refresh token"
                            onClick={() => handleRefresh(p.platform)}
                          >
                            <RefreshCw className="w-3 h-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-[10px] text-red-400 hover:text-red-300"
                            onClick={() => handleDisconnect(p.platform)}
                          >
                            <WifiOff className="w-3 h-3 mr-1" />
                            Disconnect
                          </Button>
                        </>
                      ) : p.configured ? (
                        <Button
                          size="sm"
                          className="h-7 px-3 text-[10px] gap-1"
                          disabled={isConnecting}
                          onClick={() => handleConnect(p.platform)}
                        >
                          {isConnecting ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <ExternalLink className="w-3 h-3" />
                          )}
                          Connect
                        </Button>
                      ) : (
                        <Badge variant="outline" className="text-[9px]">
                          Setup Required
                        </Badge>
                      )}
                    </div>
                  </div>
                );
              })}

              {platforms.length === 0 && !loading && (
                <p className="text-sm text-muted-foreground/60 text-center py-8">
                  No platforms available
                </p>
              )}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
