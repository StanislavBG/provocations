/**
 * ConnectedAppsDialog — Manage external app API keys.
 *
 * Provo users add apps (e.g. The Office), choose a permission preset and
 * canvas access level, and receive a scoped API key shown once.
 */

import { useState, useEffect, useCallback } from "react";
import { Plug, Plus, Copy, Check, Trash2, Loader2, Key, ShieldCheck, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";

// ── Types ──

interface ApiKeyItem {
  id: number;
  keyPrefix: string;
  label: string;
  scopes: string[] | null;
  canvasIds: number[] | null;
  canvasAccessMode: string | null;
  lastUsedAt: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

type PermissionPreset = "read" | "readwrite" | "full";
type CanvasAccess = "all" | "shared" | "specific";
type View = "list" | "add" | "reveal";

const PRESET_SCOPES: Record<PermissionPreset, string[] | null> = {
  read: ["canvas:read", "documents:read", "events:read"],
  readwrite: ["canvas:read", "canvas:write", "documents:read", "documents:write", "events:read", "events:write"],
  full: null,
};

const PRESET_LABELS: Record<PermissionPreset, string> = {
  read: "Read Only",
  readwrite: "Read & Write",
  full: "Full Access",
};

const PRESET_DESCRIPTIONS: Record<PermissionPreset, string> = {
  read: "View canvases, documents, and events",
  readwrite: "View and modify canvases, documents, and events",
  full: "Unrestricted access including webhooks and key management",
};

interface ConnectedAppsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  savedCanvases?: Array<{ id: number; title: string }>;
}

export function ConnectedAppsDialog({ open, onOpenChange, savedCanvases = [] }: ConnectedAppsDialogProps) {
  const { toast } = useToast();
  const [view, setView] = useState<View>("list");
  const [keys, setKeys] = useState<ApiKeyItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Add form state
  const [appName, setAppName] = useState("");
  const [preset, setPreset] = useState<PermissionPreset>("readwrite");
  const [canvasAccess, setCanvasAccess] = useState<CanvasAccess>("all");
  const [selectedCanvasIds, setSelectedCanvasIds] = useState<number[]>([]);
  const [canCreate, setCanCreate] = useState(true);
  const [creating, setCreating] = useState(false);

  // Reveal state
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showKey, setShowKey] = useState(false);

  const fetchKeys = useCallback(async () => {
    try {
      const res = await fetch("/api/settings/api-keys");
      const data = (await res.json()) as { keys?: ApiKeyItem[] };
      if (data.keys) setKeys(data.keys);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      setLoading(true);
      setView("list");
      fetchKeys();
    }
  }, [open, fetchKeys]);

  const handleCreate = useCallback(async () => {
    if (!appName.trim()) return;
    setCreating(true);
    try {
      let scopes = PRESET_SCOPES[preset];
      // If "Can create new canvases" is on and not full access, ensure canvas:write
      if (canCreate && scopes !== null && !scopes.includes("canvas:write")) {
        scopes = [...scopes, "canvas:write"];
      }

      const body: Record<string, unknown> = {
        label: appName.trim(),
        scopes,
        canvasAccessMode: canvasAccess,
      };

      if (canvasAccess === "specific") {
        body.canvasIds = selectedCanvasIds;
      } else {
        body.canvasIds = null;
      }

      const res = await fetch("/api/settings/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create key");
      }

      const data = (await res.json()) as { key: string };
      setRevealedKey(data.key);
      setView("reveal");
      fetchKeys();
    } catch (err) {
      toast({ title: "Failed to create app key", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
    } finally {
      setCreating(false);
    }
  }, [appName, preset, canvasAccess, selectedCanvasIds, canCreate, fetchKeys, toast]);

  const handleRevoke = useCallback(async (id: number, label: string) => {
    try {
      const res = await fetch(`/api/settings/api-keys/${id}`, { method: "DELETE" });
      if (res.ok) {
        toast({ title: `Revoked "${label}"` });
        fetchKeys();
      }
    } catch {
      toast({ title: "Failed to revoke key", variant: "destructive" });
    }
  }, [fetchKeys, toast]);

  const handleCopy = useCallback(() => {
    if (revealedKey) {
      navigator.clipboard.writeText(revealedKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [revealedKey]);

  const resetForm = () => {
    setAppName("");
    setPreset("readwrite");
    setCanvasAccess("all");
    setSelectedCanvasIds([]);
    setCanCreate(true);
    setRevealedKey(null);
    setCopied(false);
    setShowKey(false);
  };

  const derivePreset = (scopes: string[] | null): PermissionPreset => {
    if (scopes === null) return "full";
    if (scopes.includes("canvas:write") || scopes.includes("documents:write")) return "readwrite";
    return "read";
  };

  const deriveStatus = (key: ApiKeyItem): { label: string; color: string } => {
    if (key.revokedAt) return { label: "Revoked", color: "text-red-500" };
    if (key.expiresAt && new Date(key.expiresAt) < new Date()) return { label: "Expired", color: "text-yellow-500" };
    if (!key.lastUsedAt) return { label: "Never used", color: "text-muted-foreground" };
    return { label: "Active", color: "text-emerald-500" };
  };

  const formatRelativeTime = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  };

  const toggleCanvasId = (id: number) => {
    setSelectedCanvasIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] p-0 gap-0 overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-3.5 border-b border-border/50">
          <Plug className="w-4 h-4 text-cyan-500" />
          <DialogTitle className="text-sm font-semibold">Connected Apps</DialogTitle>
        </div>

        <ScrollArea className="flex-1 max-h-[65vh]">
          {/* ── LIST VIEW ── */}
          {view === "list" && (
            <div className="p-4 space-y-3">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              ) : keys.length === 0 ? (
                <div className="text-center py-10 space-y-2">
                  <Plug className="w-8 h-8 mx-auto text-muted-foreground/30" />
                  <p className="text-sm text-muted-foreground">No connected apps yet</p>
                  <p className="text-[11px] text-muted-foreground/70">Add an app to give it API access to your canvases</p>
                </div>
              ) : (
                keys.map((key) => {
                  const status = deriveStatus(key);
                  const presetLabel = PRESET_LABELS[derivePreset(key.scopes)];
                  const accessLabel = key.canvasAccessMode === "shared" ? "Shared only" : key.canvasAccessMode === "specific" ? `${key.canvasIds?.length ?? 0} canvases` : "All canvases";

                  return (
                    <div key={key.id} className={`rounded-lg border border-border/60 p-3 space-y-2 ${key.revokedAt ? "opacity-50" : ""}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 min-w-0">
                          <Key className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                          <span className="text-sm font-medium truncate">{key.label}</span>
                          <Badge variant="outline" className="text-[10px] font-mono shrink-0">{key.keyPrefix}...</Badge>
                        </div>
                        {!key.revokedAt && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-red-500"
                            onClick={() => handleRevoke(key.id, key.label)}
                            title="Revoke"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-[11px]">
                        <span className={status.color}>{status.label}</span>
                        <span className="text-muted-foreground/40">|</span>
                        <span className="text-muted-foreground">{presetLabel}</span>
                        <span className="text-muted-foreground/40">|</span>
                        <span className="text-muted-foreground">{accessLabel}</span>
                        {key.lastUsedAt && (
                          <>
                            <span className="text-muted-foreground/40">|</span>
                            <span className="text-muted-foreground">{formatRelativeTime(key.lastUsedAt)}</span>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })
              )}

              <Button
                variant="outline"
                size="sm"
                className="w-full mt-2 gap-1.5"
                onClick={() => { resetForm(); setView("add"); }}
              >
                <Plus className="w-3.5 h-3.5" />
                Add App
              </Button>
            </div>
          )}

          {/* ── ADD VIEW ── */}
          {view === "add" && (
            <div className="p-4 space-y-5">
              {/* App name */}
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">
                  App Name
                </label>
                <input
                  type="text"
                  value={appName}
                  onChange={(e) => setAppName(e.target.value)}
                  placeholder='e.g. "The Office", "Research Agent"'
                  className="w-full h-9 px-3 text-sm rounded-md border border-border bg-background focus:outline-none focus:ring-1 focus:ring-cyan-500"
                  autoFocus
                />
              </div>

              {/* Permission preset */}
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">
                  Permissions
                </label>
                <div className="space-y-1.5">
                  {(["read", "readwrite", "full"] as PermissionPreset[]).map((p) => (
                    <button
                      key={p}
                      className={`w-full text-left px-3 py-2 rounded-md border transition-colors ${
                        preset === p
                          ? "border-cyan-500/60 bg-cyan-500/10"
                          : "border-border/60 hover:border-border"
                      }`}
                      onClick={() => setPreset(p)}
                    >
                      <div className="flex items-center gap-2">
                        <ShieldCheck className={`w-3.5 h-3.5 ${preset === p ? "text-cyan-500" : "text-muted-foreground"}`} />
                        <span className="text-xs font-medium">{PRESET_LABELS[p]}</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-0.5 ml-5.5">{PRESET_DESCRIPTIONS[p]}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Canvas access */}
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">
                  Canvas Access
                </label>
                <div className="space-y-1.5">
                  {([
                    { value: "all" as CanvasAccess, label: "All canvases", desc: "Access every canvas you own" },
                    { value: "shared" as CanvasAccess, label: "Shared canvases only", desc: "Only canvases explicitly shared with this app" },
                    { value: "specific" as CanvasAccess, label: "Specific canvases", desc: "Pick which canvases this app can access" },
                  ]).map((opt) => (
                    <button
                      key={opt.value}
                      className={`w-full text-left px-3 py-2 rounded-md border transition-colors ${
                        canvasAccess === opt.value
                          ? "border-cyan-500/60 bg-cyan-500/10"
                          : "border-border/60 hover:border-border"
                      }`}
                      onClick={() => setCanvasAccess(opt.value)}
                    >
                      <span className="text-xs font-medium">{opt.label}</span>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{opt.desc}</p>
                    </button>
                  ))}
                </div>

                {/* Canvas picker for "specific" */}
                {canvasAccess === "specific" && savedCanvases.length > 0 && (
                  <div className="mt-2 rounded-md border border-border/60 max-h-32 overflow-auto">
                    {savedCanvases.map((c) => (
                      <button
                        key={c.id}
                        className={`flex items-center gap-2 w-full px-3 py-1.5 text-left text-xs hover:bg-muted/50 transition-colors ${
                          selectedCanvasIds.includes(c.id) ? "bg-cyan-500/10" : ""
                        }`}
                        onClick={() => toggleCanvasId(c.id)}
                      >
                        <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${
                          selectedCanvasIds.includes(c.id) ? "bg-cyan-500 border-cyan-500" : "border-border"
                        }`}>
                          {selectedCanvasIds.includes(c.id) && <Check className="w-2.5 h-2.5 text-white" />}
                        </div>
                        <span className="truncate">{c.title}</span>
                      </button>
                    ))}
                  </div>
                )}
                {canvasAccess === "specific" && savedCanvases.length === 0 && (
                  <p className="text-[10px] text-muted-foreground mt-1.5">No saved canvases found. Save a canvas first.</p>
                )}
              </div>

              {/* Can create new canvases toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-medium">Can create new canvases</span>
                  <p className="text-[10px] text-muted-foreground">Allow this app to create canvases on your behalf</p>
                </div>
                <Switch checked={canCreate} onCheckedChange={setCanCreate} />
              </div>

              {/* Action buttons */}
              <div className="flex gap-2 pt-1">
                <Button variant="outline" size="sm" className="flex-1" onClick={() => setView("list")}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  className="flex-1 bg-cyan-600 hover:bg-cyan-700 gap-1.5"
                  disabled={!appName.trim() || creating}
                  onClick={handleCreate}
                >
                  {creating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Key className="w-3.5 h-3.5" />}
                  Generate Key
                </Button>
              </div>
            </div>
          )}

          {/* ── REVEAL VIEW ── */}
          {view === "reveal" && revealedKey && (
            <div className="p-5 space-y-4">
              <div className="text-center space-y-1">
                <Check className="w-8 h-8 mx-auto text-emerald-500" />
                <p className="text-sm font-medium">App key created</p>
                <p className="text-[11px] text-muted-foreground">Copy this key now — it will not be shown again.</p>
              </div>

              <div className="relative">
                <div className="flex items-center gap-2 p-3 rounded-md bg-muted/50 border border-border font-mono text-xs break-all">
                  <span className="flex-1">{showKey ? revealedKey : revealedKey.slice(0, 9) + "\u2022".repeat(24)}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 shrink-0"
                    onClick={() => setShowKey(!showKey)}
                    title={showKey ? "Hide" : "Show"}
                  >
                    {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 shrink-0"
                    onClick={handleCopy}
                    title="Copy"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  </Button>
                </div>
              </div>

              <div className="bg-muted/30 rounded-md p-3 text-[11px] text-muted-foreground space-y-1.5">
                <p className="font-medium text-foreground text-xs">Use this key in your app:</p>
                <code className="block bg-background/50 rounded p-2 font-mono text-[10px]">
                  X-API-Key: {showKey ? revealedKey : revealedKey.slice(0, 9) + "..."}
                </code>
                <p>Set it as the <code>X-API-Key</code> header on all requests to the Provocations API.</p>
                <p>See <code>docs/event-bus.md</code> for the full integration reference.</p>
              </div>

              <Button
                size="sm"
                className="w-full"
                onClick={() => { resetForm(); setView("list"); }}
              >
                Done
              </Button>
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
