/**
 * MessageLogButton — header dropdown showing session user messages/notifications.
 *
 * Follows the same pattern as LlmTraceButton and DebugButton:
 * - Small header button with badge count
 * - Popover dropdown with scrollable message list
 * - Messages are captured automatically from toast() calls
 */
import { useState, useEffect, useRef } from "react";
import { Bell, X, Trash2, CheckCircle2, AlertCircle, Info, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useMessageLog, type MessageLogEntry, type MessageLevel } from "@/lib/messageLog";

const LEVEL_CONFIG: Record<MessageLevel, { icon: typeof Info; color: string; badgeClass: string }> = {
  info: { icon: Info, color: "text-blue-400", badgeClass: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  success: { icon: CheckCircle2, color: "text-green-400", badgeClass: "bg-green-500/20 text-green-400 border-green-500/30" },
  warning: { icon: AlertTriangle, color: "text-yellow-400", badgeClass: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
  error: { icon: AlertCircle, color: "text-red-400", badgeClass: "bg-red-500/20 text-red-400 border-red-500/30" },
};

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function MessageRow({ entry }: { entry: MessageLogEntry }) {
  const config = LEVEL_CONFIG[entry.level];
  const Icon = config.icon;

  return (
    <div className="border-b border-border/50 last:border-b-0">
      <div className="flex items-start gap-2 px-3 py-2">
        <Icon className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${config.color}`} />
        <div className="flex-1 min-w-0 space-y-0.5">
          <div className="flex items-center gap-1.5 flex-wrap">
            <Badge variant="outline" className={`text-[9px] px-1 py-0 ${config.badgeClass}`}>
              {entry.level}
            </Badge>
            <span className="text-[10px] text-muted-foreground/60">{formatTime(entry.timestamp)}</span>
            {entry.source && (
              <span className="text-[9px] text-muted-foreground/40 font-mono">{entry.source}</span>
            )}
          </div>
          <p className="text-xs font-medium leading-snug">{entry.title}</p>
          {entry.description && (
            <p className="text-[10px] text-muted-foreground leading-snug">{entry.description}</p>
          )}
        </div>
      </div>
    </div>
  );
}

export function MessageLogButton() {
  const [isOpen, setIsOpen] = useState(false);
  const { entries, clear } = useMessageLog();
  const containerRef = useRef<HTMLDivElement>(null);
  const [lastSeenCount, setLastSeenCount] = useState(0);

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

  // Mark as seen when opening
  useEffect(() => {
    if (isOpen) setLastSeenCount(entries.length);
  }, [isOpen, entries.length]);

  const unseenCount = entries.length - lastSeenCount;

  return (
    <div ref={containerRef} className="relative">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        className={`h-7 w-7 p-0 relative ${entries.length > 0 ? "text-foreground" : "text-muted-foreground"}`}
        title={`${entries.length} message${entries.length !== 1 ? "s" : ""}`}
      >
        <Bell className="w-3.5 h-3.5" />
        {unseenCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 rounded-full bg-primary text-primary-foreground text-[9px] flex items-center justify-center font-bold px-0.5">
            {unseenCount > 99 ? "99+" : unseenCount}
          </span>
        )}
      </Button>

      {isOpen && (
        <div className="absolute top-full right-0 mt-1 z-50 w-[400px] max-h-[70vh] bg-card border rounded-xl shadow-2xl flex flex-col animate-in slide-in-from-top-2 duration-200">
          {/* Header */}
          <div className="flex items-center gap-2 px-4 py-2.5 border-b shrink-0">
            <Bell className="w-4 h-4 text-muted-foreground" />
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold">Messages</h3>
            </div>
            <Badge variant="outline" className="text-[10px] h-4 px-1.5">
              {entries.length}
            </Badge>
            {entries.length > 0 && (
              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive shrink-0" onClick={clear} title="Clear all">
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            )}
            <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => setIsOpen(false)}>
              <X className="w-4 h-4" />
            </Button>
          </div>

          {/* Message list */}
          <ScrollArea className="flex-1 min-h-0 max-h-[calc(70vh-60px)]">
            {entries.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground/50 gap-2">
                <Bell className="w-8 h-8" />
                <p className="text-sm">No messages yet</p>
                <p className="text-xs">System messages will appear here</p>
              </div>
            ) : (
              <div>
                {[...entries].reverse().map((entry) => (
                  <MessageRow key={entry.id} entry={entry} />
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      )}
    </div>
  );
}
