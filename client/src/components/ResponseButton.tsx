import { useState, useCallback, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Mic, Pencil, Send, X, Square } from "lucide-react";
import { VoiceRecorder } from "@/components/VoiceRecorder";

type InputMode = "mic" | "pencil";

interface ResponseButtonProps {
  /** Called when user submits a text instruction */
  onSubmitText: (instruction: string) => void;
  /** Called when voice recording starts (to open transcript overlay) */
  onRecordingStart: () => void;
  /** Called with transcript updates */
  onTranscriptUpdate?: (transcript: string, isRecording: boolean) => void;
  /** Whether an operation is in progress */
  isProcessing?: boolean;
}

export function ResponseButton({
  onSubmitText,
  onRecordingStart,
  onTranscriptUpdate,
  isProcessing,
}: ResponseButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<InputMode>("pencil");
  const [textValue, setTextValue] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Focus input when switching to pencil mode while open
  useEffect(() => {
    if (isOpen && mode === "pencil") {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen, mode]);

  // Auto-start recording when opening in mic mode
  const justOpenedMicRef = useRef(false);
  useEffect(() => {
    if (isOpen && mode === "mic" && justOpenedMicRef.current) {
      justOpenedMicRef.current = false;
      onRecordingStart();
    }
  }, [isOpen, mode, onRecordingStart]);

  const handleOpen = useCallback(() => {
    if (mode === "mic") {
      justOpenedMicRef.current = true;
    }
    setIsOpen(true);
  }, [mode]);

  const handleClose = useCallback(() => {
    setIsOpen(false);
    setTextValue("");
    setIsRecording(false);
  }, []);

  const handleSubmitText = useCallback(() => {
    if (!textValue.trim()) return;
    onSubmitText(textValue.trim());
    setTextValue("");
    setIsOpen(false);
  }, [textValue, onSubmitText]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSubmitText();
      } else if (e.key === "Escape") {
        handleClose();
      }
    },
    [handleSubmitText, handleClose],
  );

  const handleMicClick = useCallback(() => {
    if (mode !== "mic") {
      setMode("mic");
      return;
    }
    // Already in mic mode — trigger recording via transcript overlay
    onRecordingStart();
  }, [mode, onRecordingStart]);

  const handlePencilClick = useCallback(() => {
    if (mode !== "pencil") {
      setMode("pencil");
      setTimeout(() => inputRef.current?.focus(), 50);
      return;
    }
  }, [mode]);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        handleClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isOpen, handleClose]);

  // Collapsed state — single FAB
  if (!isOpen) {
    return (
      <div className="absolute bottom-4 right-4 z-40">
        <Button
          data-testid="button-response-fab"
          size="lg"
          className="h-12 w-12 rounded-full shadow-lg hover-elevate gap-0 p-0"
          onClick={handleOpen}
          disabled={isProcessing}
          title="Respond to document"
        >
          {mode === "mic" ? (
            <Mic className="w-5 h-5" />
          ) : (
            <Pencil className="w-5 h-5" />
          )}
        </Button>
      </div>
    );
  }

  // Expanded state
  return (
    <div
      ref={containerRef}
      className="absolute bottom-4 right-4 z-40 animate-in fade-in slide-in-from-bottom-2 duration-200"
    >
      <div className="bg-card border rounded-xl shadow-xl p-2 flex flex-col gap-2 min-w-[280px] max-w-[340px]">
        {/* Mode toggle + close */}
        <div className="flex items-center gap-1">
          <div className="flex items-center bg-muted rounded-lg p-0.5">
            <Button
              data-testid="button-response-mode-mic"
              size="sm"
              variant={mode === "mic" ? "default" : "ghost"}
              className={`h-7 px-2.5 gap-1.5 text-xs rounded-md ${mode === "mic" ? "" : "text-muted-foreground"}`}
              onClick={handleMicClick}
            >
              <Mic className="w-3.5 h-3.5" />
              Voice
            </Button>
            <Button
              data-testid="button-response-mode-pencil"
              size="sm"
              variant={mode === "pencil" ? "default" : "ghost"}
              className={`h-7 px-2.5 gap-1.5 text-xs rounded-md ${mode === "pencil" ? "" : "text-muted-foreground"}`}
              onClick={handlePencilClick}
            >
              <Pencil className="w-3.5 h-3.5" />
              Type
            </Button>
          </div>
          <div className="flex-1" />
          <Button
            data-testid="button-response-close"
            size="icon"
            variant="ghost"
            className="h-7 w-7 text-muted-foreground"
            onClick={handleClose}
          >
            <X className="w-3.5 h-3.5" />
          </Button>
        </div>

        {/* Input area */}
        {mode === "pencil" ? (
          <div className="flex items-center gap-1.5">
            <input
              ref={inputRef}
              data-testid="input-response-text"
              type="text"
              value={textValue}
              onChange={(e) => setTextValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="What should change..."
              disabled={isProcessing}
              className="flex-1 bg-muted/50 border rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/60"
            />
            <Button
              data-testid="button-response-send"
              size="icon"
              className="h-9 w-9 shrink-0"
              onClick={handleSubmitText}
              disabled={!textValue.trim() || isProcessing}
              title="Send instruction"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        ) : (
          <div className="flex items-center justify-center py-1">
            <Button
              data-testid="button-response-record"
              size="default"
              variant={isRecording ? "destructive" : "default"}
              className={`gap-2 w-full ${isRecording ? "animate-pulse" : ""}`}
              onClick={() => onRecordingStart()}
              disabled={isProcessing}
            >
              {isRecording ? (
                <>
                  <Square className="w-4 h-4" />
                  Recording...
                </>
              ) : (
                <>
                  <Mic className="w-4 h-4" />
                  Tap to speak
                </>
              )}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
