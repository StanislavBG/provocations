import { useState, useEffect } from "react";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { RotateCcw, X, Clock } from "lucide-react";
import type { SessionListItem, WorkspaceSessionState } from "@shared/schema";

interface SessionResumePromptProps {
  templateId: string | null;
  /** Only show when in workspace phase (not input) */
  isActive: boolean;
  /** Callback when user chooses to resume */
  onResume: (sessionId: number, state: WorkspaceSessionState) => void;
  /** Callback when user dismisses (start fresh) */
  onDismiss: () => void;
}

export function SessionResumePrompt({
  templateId,
  isActive,
  onResume,
  onDismiss,
}: SessionResumePromptProps) {
  const [latestSession, setLatestSession] = useState<SessionListItem | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  // Fetch latest session for this template on mount
  useEffect(() => {
    if (!templateId || !isActive || dismissed) {
      setLatestSession(null);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const res = await apiRequest("GET", `/api/sessions/latest/${templateId}`);
        const data = await res.json();
        if (!cancelled && data.session) {
          setLatestSession(data.session);
        }
      } catch {
        // Non-fatal — just don't show prompt
      }
    })();

    return () => { cancelled = true; };
  }, [templateId, isActive, dismissed]);

  // Reset dismissed state when template changes
  useEffect(() => {
    setDismissed(false);
    setLatestSession(null);
  }, [templateId]);

  const handleResume = async () => {
    if (!latestSession) return;
    setIsLoading(true);
    try {
      const res = await apiRequest("GET", `/api/sessions/${latestSession.id}`);
      const data = await res.json();
      onResume(latestSession.id, data.state);
      setLatestSession(null);
    } catch {
      // Failed to load — dismiss
      setLatestSession(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
    setLatestSession(null);
    onDismiss();
  };

  if (!latestSession || dismissed) return null;

  const timeAgo = getTimeAgo(latestSession.updatedAt);

  return (
    <div className="animate-in slide-in-from-top-2 fade-in duration-300 mx-auto max-w-lg">
      <div className="flex items-center gap-3 px-4 py-3 rounded-lg border bg-card/80 backdrop-blur-sm shadow-sm">
        <RotateCcw className="w-4 h-4 text-primary shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">
            Resume "{latestSession.title}"?
          </p>
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <Clock className="w-3 h-3" />
            Last saved {timeAgo}
          </p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <Button
            size="sm"
            variant="default"
            className="gap-1.5 h-7 text-xs"
            onClick={handleResume}
            disabled={isLoading}
          >
            <RotateCcw className="w-3 h-3" />
            Resume
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            onClick={handleDismiss}
            title="Start fresh"
          >
            <X className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function getTimeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60_000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return "yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
