import { useState, useCallback, useMemo } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { errorLogStore } from "@/lib/errorLog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";
import { ProvokeText } from "@/components/ProvokeText";
import { VoiceRecorder } from "@/components/VoiceRecorder";
import { LlmHoverButton, type ContextBlock, type SummaryItem } from "@/components/LlmHoverButton";
import {
  ClipboardList,
  FileText,
  Trash2,
  Zap,
  Loader2,
  Send,
  Sparkles,
  Save,
  Check,
  StickyNote,
} from "lucide-react";
import { trackEvent } from "@/lib/tracking";
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
  const [savingNoteId, setSavingNoteId] = useState<string | null>(null);
  const [savedNoteIds, setSavedNoteIds] = useState<Set<string>>(new Set());

  // ── Save individual note to Context Store ──
  const handleSaveToStore = useCallback(async (item: ContextItem) => {
    if (!item.content.trim()) return;
    setSavingNoteId(item.id);
    try {
      const title = `Note: ${item.content.trim().slice(0, 80).replace(/\n/g, " ")}`;
      await apiRequest("POST", "/api/documents", { title, content: item.content.trim() });
      setSavedNoteIds(prev => new Set(prev).add(item.id));
      trackEvent("note_saved_to_context");
      toast({ title: "Saved to Context Store", description: title });
    } catch {
      toast({ title: "Save failed", description: "Could not save note.", variant: "destructive" });
    } finally {
      setSavingNoteId(null);
    }
  }, [toast]);

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
        description: "Summary added to notes",
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
      <div className="shrink-0 px-3 pt-3 pb-2 border-b bg-muted/30">
        <div className="rounded-lg border border-border bg-background overflow-hidden">
          <div className="flex items-center justify-between px-3 py-1.5 border-b bg-muted/30">
            <span className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1.5">
              <ClipboardList className="w-3 h-3" />
              Add Notes
            </span>
            <div className="flex items-center gap-0.5">
              <VoiceRecorder
                onTranscript={(t) =>
                  setNoteText((prev) => (prev ? `${prev} ${t}` : t))
                }
                onInterimTranscript={(t) => setNoteText(t)}
                size="icon"
                variant="ghost"
                className="h-6 w-6 shrink-0 text-muted-foreground"
              />
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6 shrink-0"
                disabled={!noteText.trim()}
                onClick={handleAddNote}
                title="Add note (Enter)"
              >
                <Send className="w-3 h-3" />
              </Button>
            </div>
          </div>
          <div className="p-2">
            <ProvokeText
              chrome="bare"
              variant="textarea"
              value={noteText}
              onChange={setNoteText}
              placeholder="Type a note... (Enter to add)"
              className="text-xs"
              minRows={3}
              maxRows={5}
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
            Add notes above, or use "Send to Notes" from Research and Provo
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
                      <Button
                        variant="ghost"
                        size="icon"
                        className={`h-5 w-5 transition-opacity ${
                          savedNoteIds.has(item.id)
                            ? "text-green-600 dark:text-green-400 opacity-100"
                            : "opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-green-600 dark:hover:text-green-400"
                        }`}
                        onClick={() => handleSaveToStore(item)}
                        disabled={!item.content.trim() || savingNoteId === item.id}
                        title={savedNoteIds.has(item.id) ? "Saved to store" : "Save to Context Store"}
                      >
                        {savingNoteId === item.id ? (
                          <Loader2 className="w-2.5 h-2.5 animate-spin" />
                        ) : savedNoteIds.has(item.id) ? (
                          <Check className="w-2.5 h-2.5" />
                        ) : (
                          <Save className="w-2.5 h-2.5" />
                        )}
                      </Button>
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
          <TranscriptFooter
            capturedContext={capturedContext}
            summarizeMutation={summarizeMutation}
            handleEvolve={handleEvolve}
            hasDocument={hasDocument}
            isMerging={isMerging}
          />
        </>
      )}
    </div>
  );
}

// ── Footer with LLM hover buttons ──

function TranscriptFooter({
  capturedContext,
  summarizeMutation,
  handleEvolve,
  hasDocument,
  isMerging,
}: {
  capturedContext: ContextItem[];
  summarizeMutation: { mutate: () => void; isPending: boolean };
  handleEvolve: () => void;
  hasDocument: boolean;
  isMerging: boolean;
}) {
  const notesChars = useMemo(
    () => capturedContext.reduce((s, c) => s + c.content.length, 0),
    [capturedContext],
  );

  const summarizeBlocks: ContextBlock[] = useMemo(() => [
    { label: "System Prompt", chars: 600, color: "text-purple-400" },
    { label: "Notes Content", chars: notesChars, color: "text-orange-400" },
  ], [notesChars]);

  const summarizeSummary: SummaryItem[] = useMemo(() => [
    { icon: <StickyNote className="w-3 h-3 text-orange-400" />, label: "Notes to Summarize", count: capturedContext.length, detail: `${notesChars.toLocaleString()} chars` },
  ], [capturedContext.length, notesChars]);

  const evolveBlocks: ContextBlock[] = useMemo(() => [
    { label: "System Prompt", chars: 1200, color: "text-purple-400" },
    { label: "Document", chars: hasDocument ? 2000 : 0, color: "text-blue-400" },
    { label: "Notes / Findings", chars: notesChars, color: "text-orange-400" },
    { label: "Merge Instructions", chars: 400, color: "text-emerald-400" },
  ], [hasDocument, notesChars]);

  const evolveSummary: SummaryItem[] = useMemo(() => [
    { icon: <StickyNote className="w-3 h-3 text-orange-400" />, label: "Notes to Merge", count: capturedContext.length, detail: `${capturedContext.length} item${capturedContext.length !== 1 ? "s" : ""}` },
    { icon: <FileText className="w-3 h-3 text-blue-400" />, label: "Target Document", count: hasDocument ? 1 : 0 },
  ], [capturedContext.length, hasDocument]);

  return (
    <div className="shrink-0 border-t bg-card p-3 space-y-2">
      {/* Summarize */}
      <LlmHoverButton
        previewTitle="Summarize Notes"
        previewBlocks={summarizeBlocks}
        previewSummary={summarizeSummary}
        align="end"
      >
        <Button
          variant="outline"
          onClick={() => summarizeMutation.mutate()}
          disabled={summarizeMutation.isPending || capturedContext.length < 2}
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
      </LlmHoverButton>

      {/* Evolve Document */}
      <LlmHoverButton
        previewTitle="Evolve Document"
        previewBlocks={evolveBlocks}
        previewSummary={evolveSummary}
        align="end"
      >
        <Button
          onClick={handleEvolve}
          disabled={!hasDocument || isMerging || capturedContext.length === 0}
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
      </LlmHoverButton>
      <p className="text-[10px] text-muted-foreground/60 text-center">
        Merges all notes into your document
      </p>
    </div>
  );
}
