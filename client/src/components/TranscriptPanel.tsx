import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ProvokeText } from "@/components/ProvokeText";
import { ImagePreviewDialog } from "@/components/ImagePreviewDialog";
import { Eraser, Wand2, PenLine, Loader2, Mic, ImageIcon, Paintbrush } from "lucide-react";
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
  /** Called when user clicks Artify — opens the Artify panel with transcript text */
  onArtify?: () => void;
}

export function TranscriptPanel({
  transcript,
  onTranscriptChange,
  onWriteToDocument,
  isWriting,
  selectedText,
  onArtify,
}: TranscriptPanelProps) {
  const { toast } = useToast();
  const [isCleaning, setIsCleaning] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  // Text to Visual state
  const [isGeneratingVisual, setIsGeneratingVisual] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [previewPrompt, setPreviewPrompt] = useState("");
  const [showImagePreview, setShowImagePreview] = useState(false);

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

  const handleTextToVisual = useCallback(async () => {
    if (!transcript.trim()) return;
    setIsGeneratingVisual(true);
    try {
      const response = await apiRequest("POST", "/api/text-to-visual", { text: transcript });
      const data = (await response.json()) as { images?: string[]; imagePrompt?: string; error?: string };
      if (data.images && data.images.length > 0) {
        setPreviewImageUrl(data.images[0]);
        setPreviewPrompt(data.imagePrompt || "");
        setShowImagePreview(true);
        trackEvent("transcript_text_to_visual");
      } else {
        toast({
          title: "No image generated",
          description: data.error || "The image could not be generated.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("[text-to-visual] transcript error:", error);
      toast({ title: "Generation failed", description: "Could not generate visual.", variant: "destructive" });
    } finally {
      setIsGeneratingVisual(false);
    }
  }, [transcript, toast]);

  const wordCount = transcript.trim() ? transcript.trim().split(/\s+/).length : 0;
  const isProcessing = isCleaning || isSummarizing || isWriting || isGeneratingVisual;

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
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-muted-foreground hover:text-foreground"
              onClick={handleTextToVisual}
              disabled={!transcript.trim() || isProcessing}
            >
              {isGeneratingVisual ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <ImageIcon className="w-3 h-3" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>Generate a visual from this transcript</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-muted-foreground hover:text-purple-600 dark:hover:text-purple-400"
              onClick={onArtify}
              disabled={!transcript.trim()}
            >
              <Paintbrush className="w-3 h-3" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Artify — customize image generation style</TooltipContent>
        </Tooltip>
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

      {/* Image preview dialog for Text to Visual */}
      <ImagePreviewDialog
        open={showImagePreview}
        onOpenChange={setShowImagePreview}
        imageUrl={previewImageUrl}
        prompt={previewPrompt}
        title="Text to Visual"
      />
    </div>
  );
}
