import { useState } from "react";
import { useErrorLog, formatErrorLog, type ErrorLogEntry } from "@/lib/errorLog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Copy,
  Trash2,
  X,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export function ErrorConsole() {
  const { entries, clear } = useErrorLog();
  const { toast } = useToast();
  const [expanded, setExpanded] = useState(false);

  if (entries.length === 0) return null;

  const handleCopyAll = () => {
    navigator.clipboard.writeText(formatErrorLog(entries));
    toast({ title: "Copied", description: "Error log copied to clipboard." });
  };

  const handleCopySingle = (entry: ErrorLogEntry) => {
    const text = formatErrorLog([entry]);
    navigator.clipboard.writeText(text);
    toast({ title: "Copied", description: "Error entry copied to clipboard." });
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background shadow-lg">
      {/* Collapsed bar */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-2 hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-destructive" />
          <span className="text-sm font-medium text-destructive">
            Error Console
          </span>
          <Badge variant="destructive" className="text-[10px] h-5">
            {entries.length}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          {expanded ? (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronUp className="w-4 h-4 text-muted-foreground" />
          )}
        </div>
      </button>

      {/* Expanded console */}
      {expanded && (
        <div className="border-t">
          {/* Actions bar */}
          <div className="flex items-center justify-between px-4 py-1.5 bg-muted/30 border-b">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
              LLM Error Log
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5 text-xs h-7"
                onClick={handleCopyAll}
              >
                <Copy className="w-3 h-3" />
                Copy All
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5 text-xs h-7 text-destructive hover:text-destructive"
                onClick={clear}
              >
                <Trash2 className="w-3 h-3" />
                Clear
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setExpanded(false)}
              >
                <X className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>

          {/* Error list */}
          <ScrollArea className="max-h-56">
            <div className="divide-y">
              {entries.map((entry) => (
                <div
                  key={entry.id}
                  className="px-4 py-2.5 text-xs group hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-semibold text-destructive">
                          {entry.step}
                        </span>
                        <span className="text-muted-foreground">
                          {new Date(entry.timestamp).toLocaleTimeString()}
                        </span>
                        {entry.endpoint && (
                          <span className="text-muted-foreground font-mono">
                            {entry.endpoint}
                          </span>
                        )}
                      </div>
                      <p className="text-foreground break-all whitespace-pre-wrap font-mono text-[11px]">
                        {entry.message}
                      </p>
                      {entry.details && (
                        <p className="text-muted-foreground break-all whitespace-pre-wrap font-mono text-[11px] mt-1">
                          {entry.details}
                        </p>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => handleCopySingle(entry)}
                      title="Copy this error"
                    >
                      <Copy className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}
    </div>
  );
}
