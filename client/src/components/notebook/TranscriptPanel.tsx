import { useState, useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { errorLogStore } from "@/lib/errorLog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";
import { ProvokeText } from "@/components/ProvokeText";
import { VoiceRecorder } from "@/components/VoiceRecorder";
import {
  ClipboardList,
  FileText,
  Trash2,
  Zap,
  Loader2,
  Send,
  Sparkles,
} from "lucide-react";
import type { ContextItem } from "@shared/schema";

interface TranscriptPanelProps {
  capturedContext: ContextItem[];
  onCaptureToContext: (text: string, label: string) => void;
  onRemoveCapturedItem?: (itemId: string) => void;
  onEvolveDocument?: (instruction: string, description: string) => void;
  hasDocument: boolean;
  isMerging: boolean;
}

export function TranscriptPanel({
  capturedContext,
  onCaptureToContext,
  onRemoveCapturedItem,
  onEvolveDocument,
  hasDocument,
  isMerging,
}: TranscriptPanelProps) {
  const { toast } = useToast();
  const [noteText, setNoteText] = useState("");

  // ── Add note ──
  const handleAddNote = useCallback(() => {
    const text = noteText.trim();
    if (!text) return;
    onCaptureToContext(text, "Note");
    setNoteText("");
  }, [noteText, onCaptureToContext]);

  // ── Summarize all notes ──
  const summarizeMutation = useMutation({
    mutationFn: async () => {
      const allText = capturedContext
        .map((item) => {
          const label = item.annotation || "Note";
          return `## ${label}\n${item.content}`;
        })
        .join("\n\n");

      const res = await apiRequest("POST", "/api/summarize-intent", {
        transcript: allText,
        mode: "summarize",
      });
      return res.json() as Promise<{ summary: string }>;
    },
    onSuccess: (data) => {
      onCaptureToContext(data.summary, "Summary");
      toast({
        title: "Notes summarized",
        description: "Summary added to transcript",
      });
    },
    onError: (error) => {
      const msg =
        error instanceof Error ? error.message : "Failed to summarize";
      errorLogStore.push({
        step: "Summarize Notes",
        endpoint: "/api/summarize-intent",
        message: msg,
      });
      toast({
        title: "Summarize failed",
        description: msg,
        variant: "destructive",
      });
    },
  });

  // ── Evolve document with transcript ──
  const handleEvolve = useCallback(() => {
    if (!onEvolveDocument || capturedContext.length === 0) return;

    const findings = capturedContext
      .map((item, i) => {
        const label = item.annotation || `Finding ${i + 1}`;
        return `### ${label}\n${item.content}`;
      })
      .join("\n\n");

    const instruction = `Evolve the document by integrating the following ${capturedContext.length} research finding${capturedContext.length !== 1 ? "s" : ""} and user feedback:\n\n${findings}\n\nRules:\n- PRESERVE the document's existing structure, voice, and content\n- WEAVE new information naturally into relevant sections\n- EXPAND sections where the research provides supporting evidence or new detail\n- ADD new sections only if the research covers topics not yet in the document\n- REMOVE nothing unless the research explicitly contradicts existing content\n- Maintain consistent formatting and style throughout`;

    onEvolveDocument(
      instruction,
      `Evolved with ${capturedContext.length} transcript item${capturedContext.length !== 1 ? "s" : ""}`,
    );
  }, [onEvolveDocument, capturedContext]);

  return (
    <div className="h-full flex flex-col">
      {/* ─── Add Note input ─── */}
      <div className="px-3 py-2 border-b bg-muted/20 shrink-0">
        <div className="flex items-end gap-1.5">
          <div className="flex-1">
            <ProvokeText
              chrome="bare"
              variant="textarea"
              value={noteText}
              onChange={setNoteText}
              placeholder="Add a note..."
              className="text-xs"
              minRows={1}
              maxRows={3}
              showCopy={false}
              showClear={false}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleAddNote();
                }
              }}
            />
          </div>
          <VoiceRecorder
            onTranscript={(t) =>
              setNoteText((prev) => (prev ? `${prev} ${t}` : t))
            }
            size="icon"
            variant="ghost"
            className="h-7 w-7 shrink-0 text-muted-foreground"
          />
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 shrink-0"
            disabled={!noteText.trim()}
            onClick={handleAddNote}
          >
            <Send className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* ─── Notes list or empty state ─── */}
      {capturedContext.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-2 text-muted-foreground/40 p-6">
          <ClipboardList className="w-8 h-8" />
          <p className="text-sm text-center">
            Your operational notes will appear here.
          </p>
          <p className="text-xs text-center">
            Add notes above, or use "Send to Transcript" from Research and Provo
            tabs.
          </p>
        </div>
      ) : (
        <>
          <ScrollArea className="flex-1">
            <div className="p-3 space-y-3">
              {capturedContext.map((item) => (
                <div
                  key={item.id}
                  className="group border rounded-lg bg-card overflow-hidden"
                >
                  <div className="flex items-center justify-between gap-2 px-3 py-1.5 border-b bg-muted/30">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <FileText className="w-3 h-3 text-primary/70 shrink-0" />
                      <span className="text-[10px] font-semibold text-muted-foreground truncate">
                        {item.annotation || "Note"}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <span className="text-[9px] text-muted-foreground/50">
                        {new Date(item.createdAt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                      {onRemoveCapturedItem && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                          onClick={() => onRemoveCapturedItem(item.id)}
                        >
                          <Trash2 className="w-2.5 h-2.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                  <div className="px-3 py-2 text-xs max-h-[200px] overflow-y-auto">
                    <MarkdownRenderer content={item.content} />
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>

          {/* ─── Footer actions ─── */}
          <div className="shrink-0 border-t bg-card p-3 space-y-2">
            {/* Summarize */}
            <Button
              variant="outline"
              onClick={() => summarizeMutation.mutate()}
              disabled={
                summarizeMutation.isPending || capturedContext.length < 2
              }
              className="w-full gap-2 h-8 text-xs font-semibold"
            >
              {summarizeMutation.isPending ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Summarizing...
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  Summarize Notes
                  <span className="text-[10px] opacity-70 font-normal ml-1">
                    ({capturedContext.length} item
                    {capturedContext.length !== 1 ? "s" : ""})
                  </span>
                </>
              )}
            </Button>

            {/* Evolve Document */}
            <Button
              onClick={handleEvolve}
              disabled={
                !hasDocument || isMerging || capturedContext.length === 0
              }
              className="w-full gap-2 h-10 text-sm font-semibold bg-amber-600 hover:bg-amber-700 text-white"
            >
              {isMerging ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Evolving Document...
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4" />
                  Evolve Document
                  <span className="text-[10px] opacity-80 font-normal ml-1">
                    ({capturedContext.length} item
                    {capturedContext.length !== 1 ? "s" : ""})
                  </span>
                </>
              )}
            </Button>
            <p className="text-[10px] text-muted-foreground/60 text-center">
              Merges all transcript findings into your document
            </p>
          </div>
        </>
      )}
    </div>
  );
}
