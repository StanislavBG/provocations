/**
 * DebugButton — inline debug/error button for the global header bar.
 *
 * - Shows a small bug icon button (styled to match header buttons)
 * - Badge shows error count (red when > 0)
 * - Click opens an error log panel as a dropdown
 * - Normal users see their own local errors + server history
 * - Admin users see ALL errors from all users (server-persisted)
 * - Each error is tagged (api, client, voice, llm, promise, etc.)
 * - Errors include timestamp, message, and expandable stack trace
 */
import { useState, useEffect, useRef } from "react";
import { Bug, X, ChevronDown, ChevronRight, Copy, Trash2, RefreshCw, Loader2, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useErrorLog, formatErrorLog, type ErrorLogEntry, installGlobalErrorHandlers } from "@/lib/errorLog";
import { useRole } from "@/hooks/use-role";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

// ── Server error entry shape ──
interface ServerErrorEntry {
  id: number;
  userId: string;
  sessionId: string | null;
  tag: string;
  message: string;
  stack: string | null;
  url: string | null;
  metadata: string | null;
  createdAt: string;
}

const TAG_COLORS: Record<string, string> = {
  client: "bg-red-500/20 text-red-400 border-red-500/30",
  promise: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  api: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  voice: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  llm: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  network: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
};

function getTagClass(tag: string): string {
  return TAG_COLORS[tag] || "bg-muted text-muted-foreground border-muted";
}

function formatTime(ts: number | string): string {
  const d = typeof ts === "number" ? new Date(ts) : new Date(ts);
  return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

// ── Local error row (from in-memory store) ──
function LocalErrorRow({ entry }: { entry: ErrorLogEntry }) {
  const [expanded, setExpanded] = useState(false);
  const tag = entry.tag || (entry.endpoint ? "api" : "client");

  return (
    <div className="border-b border-border/50 last:border-b-0">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-start gap-2 px-3 py-2 text-left hover:bg-muted/30 transition-colors"
      >
        {entry.details ? (
          expanded ? <ChevronDown className="w-3 h-3 mt-1 shrink-0 text-muted-foreground" /> : <ChevronRight className="w-3 h-3 mt-1 shrink-0 text-muted-foreground" />
        ) : (
          <span className="w-3 shrink-0" />
        )}
        <div className="flex-1 min-w-0 space-y-0.5">
          <div className="flex items-center gap-1.5 flex-wrap">
            <Badge variant="outline" className={`text-[9px] px-1 py-0 ${getTagClass(tag)}`}>
              {tag}
            </Badge>
            <span className="text-[10px] text-muted-foreground font-medium">{entry.step}</span>
            <span className="text-[10px] text-muted-foreground/60">{formatTime(entry.timestamp)}</span>
          </div>
          <p className="text-xs break-words leading-snug font-mono">{entry.message}</p>
          {entry.endpoint && (
            <p className="text-[10px] text-muted-foreground/60 font-mono">{entry.endpoint}</p>
          )}
        </div>
      </button>
      {expanded && entry.details && (
        <pre className="px-3 pb-2 text-[10px] font-mono text-muted-foreground bg-muted/20 overflow-x-auto whitespace-pre-wrap break-all leading-relaxed max-h-40">
          {entry.details}
        </pre>
      )}
    </div>
  );
}

// ── Server error row (persisted errors — admin sees all users) ──
function ServerErrorRow({ entry }: { entry: ServerErrorEntry }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border-b border-border/50 last:border-b-0">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-start gap-2 px-3 py-2 text-left hover:bg-muted/30 transition-colors"
      >
        {entry.stack ? (
          expanded ? <ChevronDown className="w-3 h-3 mt-1 shrink-0 text-muted-foreground" /> : <ChevronRight className="w-3 h-3 mt-1 shrink-0 text-muted-foreground" />
        ) : (
          <span className="w-3 shrink-0" />
        )}
        <div className="flex-1 min-w-0 space-y-0.5">
          <div className="flex items-center gap-1.5 flex-wrap">
            <Badge variant="outline" className={`text-[9px] px-1 py-0 ${getTagClass(entry.tag)}`}>
              {entry.tag}
            </Badge>
            <span className="text-[10px] text-muted-foreground">{formatTime(entry.createdAt)}</span>
            <span className="text-[9px] text-muted-foreground/50 font-mono">{entry.userId.slice(0, 12)}</span>
          </div>
          <p className="text-xs break-words leading-snug font-mono">{entry.message}</p>
          {entry.url && (
            <p className="text-[10px] text-muted-foreground/60 font-mono">{entry.url}</p>
          )}
        </div>
      </button>
      {expanded && entry.stack && (
        <pre className="px-3 pb-2 text-[10px] font-mono text-muted-foreground bg-muted/20 overflow-x-auto whitespace-pre-wrap break-all leading-relaxed max-h-40">
          {entry.stack}
        </pre>
      )}
    </div>
  );
}

export function DebugButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"local" | "server">("local");
  const { entries, clear } = useErrorLog();
  const { isAdmin } = useRole();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const containerRef = useRef<HTMLDivElement>(null);

  // Install global error handlers on mount
  useEffect(() => {
    installGlobalErrorHandlers();
  }, []);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [isOpen]);

  // Fetch server errors (admin: all users; normal: own history)
  const { data: serverData, isLoading: isLoadingServer } = useQuery<{ errors: ServerErrorEntry[] }>({
    queryKey: [isAdmin ? "/api/admin/errors" : "/api/errors"],
    queryFn: async () => {
      const url = isAdmin ? "/api/admin/errors" : "/api/errors";
      const res = await apiRequest("GET", url);
      return res.json();
    },
    enabled: isOpen && viewMode === "server",
    staleTime: 30_000,
    refetchInterval: isOpen && viewMode === "server" ? 60_000 : false,
  });

  const serverErrors = serverData?.errors || [];

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/errors"] });
    queryClient.invalidateQueries({ queryKey: ["/api/admin/errors"] });
  };

  const handleCopyAll = () => {
    if (viewMode === "local") {
      navigator.clipboard.writeText(formatErrorLog(entries));
    } else {
      const text = serverErrors.map((e) => `[${e.createdAt}] [${e.tag}] ${e.message}${e.stack ? `\n${e.stack}` : ""}`).join("\n\n");
      navigator.clipboard.writeText(text || "(no errors)");
    }
    toast({ title: "Copied", description: "Error log copied to clipboard." });
  };

  const badgeCount = entries.length;

  return (
    <div ref={containerRef} className="relative">
      {/* Header button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        className={`gap-1.5 relative ${badgeCount > 0 ? "text-destructive" : ""}`}
        title={`${badgeCount} error${badgeCount !== 1 ? "s" : ""} logged`}
      >
        <Bug className="w-4 h-4" />
        {badgeCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 rounded-full bg-destructive text-destructive-foreground text-[9px] flex items-center justify-center font-bold px-0.5">
            {badgeCount > 99 ? "99+" : badgeCount}
          </span>
        )}
      </Button>

      {/* Error log dropdown panel */}
      {isOpen && (
        <div className="absolute top-full right-0 mt-1 z-50 w-[460px] max-h-[70vh] bg-card border rounded-xl shadow-2xl flex flex-col animate-in slide-in-from-top-2 duration-200">
          {/* Header */}
          <div className="flex items-center gap-2 px-4 py-2.5 border-b shrink-0">
            <Bug className="w-4 h-4 text-muted-foreground" />
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold">Error Log</h3>
            </div>

            {/* View toggle */}
            <div className="flex items-center rounded-md border bg-muted/30 text-[10px] shrink-0">
              <button
                type="button"
                onClick={() => setViewMode("local")}
                className={`px-2 py-1 rounded-l-md transition-colors ${viewMode === "local" ? "bg-primary/20 text-primary font-medium" : "text-muted-foreground hover:text-foreground"}`}
              >
                Session ({entries.length})
              </button>
              <button
                type="button"
                onClick={() => setViewMode("server")}
                className={`px-2 py-1 rounded-r-md transition-colors flex items-center gap-1 ${viewMode === "server" ? "bg-primary/20 text-primary font-medium" : "text-muted-foreground hover:text-foreground"}`}
              >
                {isAdmin && <Shield className="w-2.5 h-2.5" />}
                {isAdmin ? "All Users" : "History"}
              </button>
            </div>

            <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={handleCopyAll} title="Copy all">
              <Copy className="w-3.5 h-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={handleRefresh} title="Refresh">
              <RefreshCw className="w-3.5 h-3.5" />
            </Button>
            {viewMode === "local" && entries.length > 0 && (
              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive shrink-0" onClick={clear} title="Clear session">
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            )}
            <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => setIsOpen(false)}>
              <X className="w-4 h-4" />
            </Button>
          </div>

          {/* Error list */}
          <ScrollArea className="flex-1 min-h-0 max-h-[calc(70vh-60px)]">
            {viewMode === "local" ? (
              entries.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground/50 gap-2">
                  <Bug className="w-8 h-8" />
                  <p className="text-sm">No errors in this session</p>
                  <p className="text-xs">Errors will appear here when they occur</p>
                </div>
              ) : (
                <div>
                  {[...entries].reverse().map((entry) => (
                    <LocalErrorRow key={entry.id} entry={entry} />
                  ))}
                </div>
              )
            ) : isLoadingServer ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : serverErrors.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground/50 gap-2">
                <Bug className="w-8 h-8" />
                <p className="text-sm">No errors logged</p>
              </div>
            ) : (
              <div>
                {serverErrors.map((entry) => (
                  <ServerErrorRow key={entry.id} entry={entry} />
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      )}
    </div>
  );
}
