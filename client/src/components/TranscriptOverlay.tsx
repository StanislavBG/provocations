import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { X, Mic, Loader2, Sparkles } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface TranscriptOverlayProps {
  isVisible: boolean;
  isRecording: boolean;
  rawTranscript: string;
  summary: string;
  isSummarizing: boolean;
  onClose: () => void;
}

export function TranscriptOverlay({
  isVisible,
  isRecording,
  rawTranscript,
  summary,
  isSummarizing,
  onClose,
}: TranscriptOverlayProps) {
  if (!isVisible) return null;

  return (
    <div className="absolute inset-0 z-10 bg-background/80 backdrop-blur-sm flex flex-col gap-4 p-4">
      <div className="flex justify-end">
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          data-testid="button-close-transcript-overlay"
        >
          <X className="w-5 h-5" />
        </Button>
      </div>
      
      <div className="flex-1 flex flex-col gap-4 overflow-hidden">
        <Card className="flex-1 flex flex-col overflow-hidden">
          <CardHeader className="pb-2 flex flex-row items-center gap-2">
            <Mic className={`w-4 h-4 ${isRecording ? "text-destructive animate-pulse" : "text-muted-foreground"}`} />
            <CardTitle className="text-base font-medium">
              Raw Transcript
              {isRecording && <span className="ml-2 text-sm text-muted-foreground">(Recording...)</span>}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 overflow-hidden">
            <ScrollArea className="h-full">
              <p className="text-sm text-muted-foreground whitespace-pre-wrap" data-testid="text-raw-transcript">
                {rawTranscript || (isRecording ? "Listening..." : "No transcript yet")}
              </p>
            </ScrollArea>
          </CardContent>
        </Card>

        <Card className="flex-1 flex flex-col overflow-hidden">
          <CardHeader className="pb-2 flex flex-row items-center gap-2">
            {isSummarizing ? (
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
            ) : (
              <Sparkles className="w-4 h-4 text-primary" />
            )}
            <CardTitle className="text-base font-medium">
              Summary
              {isSummarizing && <span className="ml-2 text-sm text-muted-foreground">(Processing...)</span>}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 overflow-hidden">
            <ScrollArea className="h-full">
              <p className="text-sm text-muted-foreground whitespace-pre-wrap" data-testid="text-summary">
                {summary || (isSummarizing ? "Generating summary..." : "Summary will appear after you finish speaking")}
              </p>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
