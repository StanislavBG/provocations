import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { prebuiltTemplates } from "@/lib/prebuiltTemplates";
import {
  X,
  RotateCcw,
  Trash2,
  Pencil,
  Loader2,
  Check,
  Clock,
  FileText,
  Search,
  ArrowUpDown,
  ToggleLeft,
} from "lucide-react";
import type { SessionListItem, WorkspaceSessionState } from "@shared/schema";

interface SessionStorePanelProps {
  isOpen: boolean;
  onClose: () => void;
  onLoadSession: (sessionId: number, state: WorkspaceSessionState, templateId: string) => void;
  currentSessionId?: number | null;
  /** Auto-save preference state */
  autoSaveEnabled: boolean;
  onToggleAutoSave: (enabled: boolean) => void;
}

export function SessionStorePanel({
  isOpen,
  onClose,
  onLoadSession,
  currentSessionId,
  autoSaveEnabled,
  onToggleAutoSave,
}: SessionStorePanelProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // State
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"name" | "date">("date");
  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [renameText, setRenameText] = useState("");
  const [loadingSessionId, setLoadingSessionId] = useState<number | null>(null);

  // Fetch all sessions
  const sessionsQuery = useQuery<{ sessions: SessionListItem[] }>({
    queryKey: ["/api/sessions"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/sessions");
      return res.json();
    },
    enabled: isOpen,
    staleTime: 15_000,
  });

  // Delete session
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/sessions/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sessions"] });
      toast({ title: "Session deleted" });
    },
    onError: () => {
      toast({ title: "Failed to delete session", variant: "destructive" });
    },
  });

  // Rename session
  const renameMutation = useMutation({
    mutationFn: async ({ id, title }: { id: number; title: string }) => {
      await apiRequest("PUT", `/api/sessions/${id}`, { title });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sessions"] });
      setRenamingId(null);
      setRenameText("");
    },
    onError: () => {
      toast({ title: "Failed to rename session", variant: "destructive" });
    },
  });

  // Load session handler
  const handleLoad = useCallback(async (sessionId: number) => {
    setLoadingSessionId(sessionId);
    try {
      const res = await apiRequest("GET", `/api/sessions/${sessionId}`);
      const data = await res.json();
      onLoadSession(sessionId, data.state, data.templateId);
      onClose();
      toast({ title: "Session restored", description: data.title });
    } catch {
      toast({ title: "Failed to load session", variant: "destructive" });
    } finally {
      setLoadingSessionId(null);
    }
  }, [onLoadSession, onClose, toast]);

  if (!isOpen) return null;

  const sessions = sessionsQuery.data?.sessions || [];
  const isLoading = sessionsQuery.isLoading;

  // Filter & sort
  const lowerQuery = searchQuery.toLowerCase().trim();
  const filtered = lowerQuery
    ? sessions.filter((s) => s.title.toLowerCase().includes(lowerQuery) || s.templateId.toLowerCase().includes(lowerQuery))
    : sessions;

  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === "name") return a.title.localeCompare(b.title);
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });

  // Group by template
  const grouped = new Map<string, SessionListItem[]>();
  for (const s of sorted) {
    const list = grouped.get(s.templateId) || [];
    list.push(s);
    grouped.set(s.templateId, list);
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-b bg-card shrink-0">
        <RotateCcw className="w-4 h-4 text-primary" />
        <h2 className="font-semibold text-sm flex-1">Session Store</h2>

        {/* Auto-save toggle */}
        <div className="flex items-center gap-2 mr-2">
          <ToggleLeft className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Auto-save</span>
          <Switch
            checked={autoSaveEnabled}
            onCheckedChange={onToggleAutoSave}
            className="scale-75"
          />
        </div>

        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Search & sort bar */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-b bg-card/60 shrink-0">
        <div className="relative flex-1">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/50" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter sessions..."
            className="h-7 text-xs pl-7"
          />
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1 text-[11px] px-2"
          onClick={() => setSortBy(sortBy === "date" ? "name" : "date")}
        >
          <ArrowUpDown className="w-3 h-3" />
          {sortBy === "date" ? "Date" : "Name"}
        </Button>
        <span className="text-[11px] text-muted-foreground/60">{sorted.length} session{sorted.length !== 1 ? "s" : ""}</span>
      </div>

      {/* Session list */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="p-3 space-y-4">
          {isLoading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          )}

          {!isLoading && sorted.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
              <RotateCcw className="w-10 h-10 text-muted-foreground/20" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">No saved sessions</p>
                <p className="text-xs text-muted-foreground/60 mt-1">
                  {autoSaveEnabled
                    ? "Sessions will be saved automatically as you work."
                    : "Enable auto-save or manually save your workspace to see sessions here."}
                </p>
              </div>
            </div>
          )}

          {!isLoading && Array.from(grouped.entries()).map(([templateId, items]) => {
            const template = prebuiltTemplates.find((t) => t.id === templateId);
            const Icon = template?.icon || FileText;

            return (
              <div key={templateId}>
                {/* Template group header */}
                <div className="flex items-center gap-2 mb-1.5">
                  <Icon className="w-3.5 h-3.5 text-primary/70" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {template?.title || templateId}
                  </span>
                  <Badge variant="secondary" className="text-[10px] h-4">
                    {items.length}
                  </Badge>
                </div>

                <div className="space-y-1">
                  {items.map((session) => {
                    const isCurrent = currentSessionId === session.id;
                    const isRenaming = renamingId === session.id;
                    const isSessionLoading = loadingSessionId === session.id;

                    return (
                      <div
                        key={session.id}
                        className={`group flex items-center gap-2 px-3 py-2 rounded-md transition-colors border ${
                          isCurrent
                            ? "bg-primary/10 border-primary/30"
                            : "hover:bg-muted/40 border-transparent"
                        }`}
                      >
                        <div className="flex-1 min-w-0">
                          {isRenaming ? (
                            <div className="flex items-center gap-1.5">
                              <Input
                                value={renameText}
                                onChange={(e) => setRenameText(e.target.value)}
                                className="h-7 text-sm flex-1"
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" && renameText.trim()) {
                                    renameMutation.mutate({ id: session.id, title: renameText.trim() });
                                  }
                                  if (e.key === "Escape") {
                                    setRenamingId(null);
                                    setRenameText("");
                                  }
                                }}
                              />
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-6 w-6"
                                disabled={!renameText.trim()}
                                onClick={() => renameText.trim() && renameMutation.mutate({ id: session.id, title: renameText.trim() })}
                              >
                                <Check className="w-3.5 h-3.5" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-6 w-6"
                                onClick={() => { setRenamingId(null); setRenameText(""); }}
                              >
                                <X className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          ) : (
                            <>
                              <p className="text-[13px] font-medium truncate">{session.title}</p>
                              <p className="text-[10px] text-muted-foreground flex items-center gap-1.5">
                                <Clock className="w-3 h-3" />
                                {new Date(session.updatedAt).toLocaleDateString(undefined, {
                                  month: "short",
                                  day: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </p>
                            </>
                          )}
                        </div>

                        {isCurrent && !isRenaming && (
                          <Badge variant="secondary" className="text-[10px] shrink-0">Current</Badge>
                        )}

                        {!isRenaming && (
                          <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                              size="sm"
                              variant="default"
                              className="h-6 gap-1 text-[11px] px-2"
                              onClick={() => handleLoad(session.id)}
                              disabled={isSessionLoading}
                            >
                              {isSessionLoading ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <RotateCcw className="w-3 h-3" />
                              )}
                              Resume
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6"
                              title="Rename"
                              onClick={() => { setRenamingId(session.id); setRenameText(session.title); }}
                            >
                              <Pencil className="w-3 h-3" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6 text-destructive/60 hover:text-destructive"
                              title="Delete session"
                              onClick={() => {
                                if (window.confirm(`Delete session "${session.title}"?`)) {
                                  deleteMutation.mutate(session.id);
                                }
                              }}
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-t shrink-0 bg-card/60">
        <p className="text-[10px] text-muted-foreground/50 flex-1">
          Sessions are encrypted at rest. Click Resume to restore a workspace session.
        </p>
      </div>
    </div>
  );
}
