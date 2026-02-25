import { Target, RefreshCw, Loader2, Sparkles, Save, Check, Copy } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";

interface DynamicSummaryPanelProps {
  summary: string;
  objective: string;
  isUpdating: boolean;
  messageCount: number;
  notesLength: number;
  onRefresh: () => void;
  onSaveToContext?: () => void;
  isSaving?: boolean;
  isSaved?: boolean;
}

export function DynamicSummaryPanel({
  summary,
  objective,
  isUpdating,
  messageCount,
  notesLength,
  onRefresh,
  onSaveToContext,
  isSaving,
  isSaved,
}: DynamicSummaryPanelProps) {
  const hasContent = messageCount > 0 || notesLength > 0;
  const { toast } = useToast();

  const handleCopy = () => {
    navigator.clipboard.writeText(summary).then(() => {
      toast({ title: "Copied", description: "Summary copied to clipboard" });
    });
  };

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
            {onSaveToContext && (
              <Button
                variant={isSaved ? "outline" : "default"}
                size="sm"
                className="gap-1.5 h-7 text-xs"
                onClick={onSaveToContext}
                disabled={isSaving || (!summary && !hasContent)}
              >
                {isSaving ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : isSaved ? (
                  <Check className="w-3 h-3 text-primary" />
                ) : (
                  <Save className="w-3 h-3" />
                )}
                {isSaved ? "Saved" : "Save to Context"}
              </Button>
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
              <div className="relative group">
                <div className="prose prose-sm prose-stone dark:prose-invert max-w-none break-words leading-relaxed font-serif [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&_ul]:my-1 [&_ol]:my-1 [&_li]:my-0.5 [&_p]:my-1.5 [&_h1]:text-base [&_h2]:text-sm [&_h3]:text-sm [&_h1]:font-bold [&_h2]:font-semibold [&_h3]:font-medium [&_code]:text-xs [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_pre]:text-xs [&_pre]:bg-muted [&_pre]:p-2 [&_pre]:rounded-md [&_blockquote]:border-l-2 [&_blockquote]:border-primary/30 [&_blockquote]:pl-3 [&_blockquote]:italic [&_table]:text-xs [&_th]:px-2 [&_th]:py-1 [&_td]:px-2 [&_td]:py-1">
                  <ReactMarkdown>{summary}</ReactMarkdown>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-0 right-0 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={handleCopy}
                  title="Copy summary"
                >
                  <Copy className="w-3.5 h-3.5" />
                </Button>
              </div>
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
