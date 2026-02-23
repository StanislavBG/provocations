import { FileText, RefreshCw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProvokeText } from "@/components/ProvokeText";
import { ScrollArea } from "@/components/ui/scroll-area";

interface DynamicSummaryPanelProps {
  summary: string;
  objective: string;
  isUpdating: boolean;
  messageCount: number;
  onRefresh: () => void;
}

export function DynamicSummaryPanel({
  summary,
  objective,
  isUpdating,
  messageCount,
  onRefresh,
}: DynamicSummaryPanelProps) {
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="shrink-0 px-4 py-3 border-b bg-card/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-semibold">Transaction Summary</h3>
          </div>
          <div className="flex items-center gap-2">
            {isUpdating && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin" />
                Updating...
              </span>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={onRefresh}
              disabled={isUpdating || messageCount === 0}
              title="Refresh summary"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isUpdating ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
          {objective}
        </p>
      </div>

      {/* Summary content */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="p-4">
          {!summary && messageCount === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3 text-muted-foreground/50">
              <FileText className="w-10 h-10" />
              <p className="text-sm text-center max-w-xs">
                The summary will appear here as your research session progresses. It evolves dynamically based on your conversation.
              </p>
            </div>
          ) : !summary && messageCount > 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3 text-muted-foreground/50">
              <Loader2 className="w-8 h-8 animate-spin" />
              <p className="text-sm text-center max-w-xs">
                Generating summary from your research session...
              </p>
            </div>
          ) : (
            <ProvokeText
              chrome="bare"
              variant="editor"
              readOnly
              showCopy
              showClear={false}
              value={summary}
              onChange={() => {}}
              className="text-sm leading-relaxed font-serif"
            />
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
