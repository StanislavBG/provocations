import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X, Mic, Loader2, Sparkles, Wand2, Send, RotateCcw, Crosshair } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { VoiceRecorder } from "./VoiceRecorder";
import { apiRequest } from "@/lib/queryClient";
import { personaIcons, personaColors, personaLabels } from "./ProvocationsDisplay";

interface ProvocationContextInfo {
  type: string;
  title: string;
  content: string;
}

interface TranscriptOverlayProps {
  isVisible: boolean;
  isRecording: boolean;
  rawTranscript: string;
  // What gets sent to the writer
  cleanedTranscript?: string;
  // Result from the writer (what was changed)
  resultSummary: string;
  isProcessing: boolean;
  // Callbacks
  onClose: () => void;
  onSend?: (transcript: string) => void;
  onCleanTranscript?: (cleaned: string) => void;
  // Embedded recording callbacks (for overlay-initiated recording)
  onTranscriptUpdate?: (transcript: string, isRecording: boolean) => void;
  onFinalTranscript?: (transcript: string) => void;
  // Provocation context display
  provocationContext?: ProvocationContextInfo;
  // Context for cleaning
  context?: "selection" | "provocation" | "document";
}

const provocationTypeIcons = personaIcons as Record<string, typeof import("lucide-react").Rocket>;
const provocationTypeColors = personaColors as Record<string, string>;

export function TranscriptOverlay({
  isVisible,
  isRecording,
  rawTranscript,
  cleanedTranscript,
  resultSummary,
  isProcessing,
  onClose,
  onSend,
  onCleanTranscript,
  onTranscriptUpdate,
  onFinalTranscript,
  provocationContext,
  context = "document",
}: TranscriptOverlayProps) {
  const [isCleaning, setIsCleaning] = useState(false);
  const [showRaw, setShowRaw] = useState(true);

  if (!isVisible) return null;

  const displayTranscript = cleanedTranscript || rawTranscript;
  const hasCleanedVersion = cleanedTranscript && cleanedTranscript !== rawTranscript;

  // Whether to show the embedded VoiceRecorder (when overlay opened without external recording)
  const showEmbeddedRecorder = !isRecording && !rawTranscript.trim() && !resultSummary;

  const handleCleanTranscript = async () => {
    if (!rawTranscript.trim()) return;
    setIsCleaning(true);
    try {
      const response = await apiRequest("POST", "/api/summarize-intent", {
        transcript: rawTranscript,
        context: context === "selection" ? "instruction" : "instruction",
      });
      const data = await response.json();
      if (data.summary && onCleanTranscript) {
        onCleanTranscript(data.summary);
        setShowRaw(false);
      }
    } catch (error) {
      console.error("Failed to clean transcript:", error);
    } finally {
      setIsCleaning(false);
    }
  };

  const handleSend = () => {
    if (onSend && displayTranscript.trim()) {
      onSend(displayTranscript);
    }
  };

  const handleRevertToRaw = () => {
    if (onCleanTranscript) {
      onCleanTranscript(rawTranscript);
    }
    setShowRaw(true);
  };

  return (
    <div className="absolute inset-0 z-10 bg-background/80 flex flex-col p-4 overflow-hidden">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-sm flex items-center gap-2">
          <Mic className={`w-4 h-4 ${isRecording ? "text-destructive animate-pulse" : "text-primary"}`} />
          Voice Input
          {isRecording && <span className="text-xs text-destructive">(Recording...)</span>}
        </h3>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="h-7 w-7"
          data-testid="button-close-transcript-overlay"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>

      <div className="flex-1 flex flex-col gap-3 overflow-hidden">
        {/* Provocation context card - shows what the user is responding to */}
        {provocationContext && !resultSummary && (
          <Card className="shrink-0 border-muted">
            <CardContent className="p-3 flex items-start gap-2">
              {(() => {
                const Icon = provocationTypeIcons[provocationContext.type] || Crosshair;
                const colorClass = provocationTypeColors[provocationContext.type] || "text-muted-foreground";
                return <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${colorClass}`} />;
              })()}
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground mb-0.5">Responding to provocation:</p>
                <p className="text-sm font-medium leading-snug">{provocationContext.title}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Embedded VoiceRecorder - shown when overlay opened without active recording */}
        {showEmbeddedRecorder && onTranscriptUpdate && (
          <div className="flex flex-col items-center gap-3 py-6">
            <p className="text-sm text-muted-foreground">
              {provocationContext ? "Record your response to this provocation" : "Record your voice input"}
            </p>
            <VoiceRecorder
              onTranscript={(transcript) => {
                onFinalTranscript?.(transcript);
              }}
              onInterimTranscript={(interim) => {
                onTranscriptUpdate(interim, true);
              }}
              onRecordingChange={(recording) => {
                onTranscriptUpdate("", recording);
              }}
              size="lg"
              variant="outline"
              className="h-14 w-14 rounded-full"
            />
            <p className="text-xs text-muted-foreground">Click to start recording</p>
          </div>
        )}

        {/* Action buttons at top - before transcript content */}
        {!isRecording && rawTranscript.trim() && !resultSummary && (
          <div className="flex items-center gap-2 flex-wrap">
            {onSend && (
              <Button
                size="sm"
                onClick={handleSend}
                disabled={isProcessing || isCleaning}
                className="gap-1.5"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="w-3 h-3" />
                    Send to writer
                  </>
                )}
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={handleCleanTranscript}
              disabled={isCleaning || isProcessing}
              className="gap-1.5"
            >
              {isCleaning ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Cleaning...
                </>
              ) : (
                <>
                  <Wand2 className="w-3 h-3" />
                  Clean up
                </>
              )}
            </Button>
            {hasCleanedVersion && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRevertToRaw}
                className="gap-1.5"
              >
                <RotateCcw className="w-3 h-3" />
                Use raw instead
              </Button>
            )}
          </div>
        )}

        {/* Processing indicator */}
        {isProcessing && !resultSummary && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            Updating document...
          </div>
        )}

        {/* Result Summary Card - shows after writer responds */}
        {resultSummary && (
          <Card className="flex flex-col overflow-hidden border-primary/30">
            <CardHeader className="pb-2 py-2 flex flex-row items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              <CardTitle className="text-sm font-medium">
                What Changed
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-hidden pb-2">
              <ScrollArea className="h-full">
                <p className="text-sm whitespace-pre-wrap" data-testid="text-result-summary">
                  {resultSummary}
                </p>
              </ScrollArea>
            </CardContent>
          </Card>
        )}

        {/* Raw/Cleaned Transcript Card - hidden when waiting for user to start recording */}
        {!showEmbeddedRecorder && (
          <>
            <Card className="flex-1 flex flex-col overflow-hidden">
              <CardHeader className="pb-2 py-2 flex flex-row items-center justify-between">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-sm font-medium">
                    {hasCleanedVersion ? (showRaw ? "Raw Transcript" : "Cleaned Transcript") : "Your Voice Input"}
                  </CardTitle>
                  {hasCleanedVersion && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowRaw(!showRaw)}
                      className="h-6 text-xs"
                    >
                      {showRaw ? "Show cleaned" : "Show raw"}
                    </Button>
                  )}
                </div>
                {rawTranscript.length > 0 && (
                  <span className="text-xs text-muted-foreground">
                    {(showRaw ? rawTranscript : displayTranscript).length.toLocaleString()} chars
                  </span>
                )}
              </CardHeader>
              <CardContent className="flex-1 overflow-hidden pb-2">
                <ScrollArea className="h-full">
                  <p className="text-sm whitespace-pre-wrap" data-testid="text-transcript">
                    {(showRaw ? rawTranscript : displayTranscript) || (isRecording ? "Listening..." : "No transcript yet")}
                  </p>
                </ScrollArea>
              </CardContent>
            </Card>

            {/* What gets sent explanation */}
            {!isRecording && rawTranscript.trim() && !resultSummary && (
              <p className="text-xs text-muted-foreground">
                {hasCleanedVersion && !showRaw
                  ? "The cleaned version will be sent as your instruction to the AI writer."
                  : "Your raw transcript will be sent as-is to the AI writer. Use 'Clean up' to remove speech artifacts first."}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
