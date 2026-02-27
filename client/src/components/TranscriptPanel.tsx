import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ProvokeText } from "@/components/ProvokeText";
import { Eraser, Wand2, PenLine, Loader2, Mic } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { trackEvent } from "@/lib/tracking";

interface TranscriptPanelProps {
  /** Current transcript text */
  transcript: string;
  /** Update the transcript text */
  onTranscriptChange: (text: string) => void;
  /** Called when user clicks Writer — merges transcript into main document */
  onWriteToDocument: (text: string) => void;
  /** Whether the Writer call is in progress */
  isWriting?: boolean;
  /** The selected text context from the document (for targeted writes) */
  selectedText?: string;
}

export function TranscriptPanel({
  transcript,
  onTranscriptChange,
  onWriteToDocument,
  isWriting,
  selectedText,
}: TranscriptPanelProps) {
  const { toast } = useToast();
  const [isCleaning, setIsCleaning] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);

  const handleClean = useCallback(async () => {
    if (!transcript.trim()) return;
    setIsCleaning(true);
    try {
      const response = await apiRequest("POST", "/api/summarize-intent", {
        transcript: transcript,
        context: "clean",
      });
      const data = (await response.json()) as { summary?: string };
      if (data.summary) {
        onTranscriptChange(data.summary);
        trackEvent("transcript_cleaned");
      }
    } catch (error) {
      toast({
        title: "Clean failed",
        description: "Could not clean the transcript.",
        variant: "destructive",
      });
    } finally {
      setIsCleaning(false);
    }
  }, [transcript, onTranscriptChange, toast]);

  const handleSummarize = useCallback(async () => {
    if (!transcript.trim()) return;
    setIsSummarizing(true);
    try {
      const response = await apiRequest("POST", "/api/summarize-intent", {
        transcript: transcript,
        context: "summarize",
        mode: "summarize",
      });
      const data = (await response.json()) as { summary?: string };
      if (data.summary) {
        onTranscriptChange(data.summary);
        trackEvent("transcript_summarized");
      }
    } catch (error) {
      toast({
        title: "Summarize failed",
        description: "Could not summarize the transcript.",
        variant: "destructive",
      });
    } finally {
      setIsSummarizing(false);
    }
  }, [transcript, onTranscriptChange, toast]);

  const handleWrite = useCallback(() => {
    if (!transcript.trim()) return;
    onWriteToDocument(transcript);
  }, [transcript, onWriteToDocument]);

  const wordCount = transcript.trim() ? transcript.trim().split(/\s+/).length : 0;
  const isProcessing = isCleaning || isSummarizing || isWriting;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b shrink-0">
        <Mic className="w-3.5 h-3.5 text-primary" />
        <span className="text-xs font-semibold">Transcript</span>
        {wordCount > 0 && (
          <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
            {wordCount} words
          </Badge>
        )}
        {selectedText && (
          <Badge variant="outline" className="text-[10px] h-4 px-1.5 border-amber-500/50 text-amber-700 dark:text-amber-400">
            Selection target
          </Badge>
        )}
        <div className="flex-1" />
      </div>

      {/* Transcript editor */}
      <div className="flex-1 overflow-hidden p-2">
        <ProvokeText
          variant="textarea"
          chrome="bare"
          value={transcript}
          onChange={onTranscriptChange}
          placeholder="Voice transcripts appear here. You can also type directly..."
          showCopy={true}
          showClear={true}
          readOnly={false}
          className="h-full text-sm"
        />
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-1.5 px-3 py-2 border-t bg-muted/20 shrink-0">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs h-7"
              onClick={handleClean}
              disabled={!transcript.trim() || isProcessing}
            >
              {isCleaning ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Eraser className="w-3 h-3" />
              )}
              Clean
            </Button>
          </TooltipTrigger>
          <TooltipContent>Fix grammar, remove filler words</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs h-7"
              onClick={handleSummarize}
              disabled={!transcript.trim() || isProcessing}
            >
              {isSummarizing ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Wand2 className="w-3 h-3" />
              )}
              Summarize
            </Button>
          </TooltipTrigger>
          <TooltipContent>Compress into key points</TooltipContent>
        </Tooltip>

        <div className="flex-1" />

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="sm"
              className="gap-1.5 text-xs h-7"
              onClick={handleWrite}
              disabled={!transcript.trim() || isProcessing}
            >
              {isWriting ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <PenLine className="w-3 h-3" />
              )}
              Writer
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {selectedText
              ? "Evolve selected portion with this transcript"
              : "Evolve the document with this transcript"}
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}
