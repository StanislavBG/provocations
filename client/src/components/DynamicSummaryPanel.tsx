import { Target, RefreshCw, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProvokeText } from "@/components/ProvokeText";
import { ScrollArea } from "@/components/ui/scroll-area";

interface DynamicSummaryPanelProps {
  summary: string;
  objective: string;
  isUpdating: boolean;
  messageCount: number;
  notesLength: number;
  onRefresh: () => void;
}

export function DynamicSummaryPanel({
  summary,
  objective,
  isUpdating,
  messageCount,
  notesLength,
  onRefresh,
}: DynamicSummaryPanelProps) {
  const hasContent = messageCount > 0 || notesLength > 0;

  return (
    <div className="flex flex-col h-full">
      {/* Header — shows the objective prominently */}
      <div className="shrink-0 px-4 py-3 border-b bg-card/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-semibold">Objective</h3>
          </div>
          <div className="flex items-center gap-2">
            {isUpdating && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin" />
                Generating...
              </span>
            )}
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
          {objective || "No objective set"}
        </p>
      </div>

      {/* Summary content */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="p-4">
          {!summary && !hasContent ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3 text-muted-foreground/50">
              <Sparkles className="w-10 h-10" />
              <p className="text-sm text-center max-w-xs">
                Chat with the researcher and build your notes. When you're ready, generate a summary that distills everything into a clean output aligned with your objective.
              </p>
            </div>
          ) : !summary && hasContent ? (
            <div className="flex flex-col items-center justify-center py-12 gap-4 text-muted-foreground/50">
              <Sparkles className="w-10 h-10" />
              <p className="text-sm text-center max-w-xs">
                You have {messageCount > 0 ? `${messageCount} messages` : ""}{messageCount > 0 && notesLength > 0 ? " and " : ""}{notesLength > 0 ? "notes" : ""} ready. Click below to generate a summary aligned with your objective.
              </p>
              <Button
                onClick={onRefresh}
                disabled={isUpdating}
                className="gap-2"
              >
                {isUpdating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Generate Summary
                  </>
                )}
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
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
              <div className="flex justify-center pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={onRefresh}
                  disabled={isUpdating}
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isUpdating ? "animate-spin" : ""}`} />
                  Regenerate
                </Button>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
