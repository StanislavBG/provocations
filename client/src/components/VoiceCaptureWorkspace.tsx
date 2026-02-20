import { useState, useCallback, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { generateId } from "@/lib/utils";
import {
  Mic,
  MicOff,
  Square,
  Clock,
  FileText,
  Save,
  Loader2,
  Pause,
  Play,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SpeechRecognitionEvent {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent {
  error: string;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}

interface VoiceCaptureWorkspaceProps {
  objective: string;
  onDocumentUpdate: (text: string) => void;
  documentText: string;
  /** Saved document ID (for updates) */
  savedDocId: number | null;
  /** Callback to persist the document */
  onSave: (title: string, folderId: number | null) => Promise<void>;
  /** Callback when save creates a new doc */
  onSavedDocIdChange: (id: number) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${m}:${String(s).padStart(2, "0")}`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function VoiceCaptureWorkspace({
  objective,
  onDocumentUpdate,
  documentText,
  savedDocId,
  onSave,
  onSavedDocIdChange,
}: VoiceCaptureWorkspaceProps) {
  const { toast } = useToast();

  // ── Recording state ──
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isSupported, setIsSupported] = useState(true);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  // Accumulated transcript buffer (unflushed text since last auto-save)
  const transcriptBufferRef = useRef("");
  // Interim transcript for live display
  const [interimText, setInterimText] = useState("");
  // Total accumulated text (everything flushed + buffer)
  const [totalTranscript, setTotalTranscript] = useState("");

  // ── Timer ──
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Auto-save ──
  const autoSaveTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [lastSaveTime, setLastSaveTime] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // ── Intentional stop vs auto-restart ──
  const intentionalStopRef = useRef(false);
  const isRecordingRef = useRef(false);

  // Word count
  const wordCount = totalTranscript.trim() ? totalTranscript.trim().split(/\s+/).length : 0;

  // ── Initialize speech recognition ──
  useEffect(() => {
    const SpeechRecognitionCtor =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) {
      setIsSupported(false);
      return;
    }

    const recognition = new SpeechRecognitionCtor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let finalTranscript = "";
      let interim = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTranscript += result[0].transcript;
        } else {
          interim += result[0].transcript;
        }
      }

      if (finalTranscript) {
        transcriptBufferRef.current += finalTranscript + " ";
        setTotalTranscript(
          (prev) => prev + finalTranscript + " "
        );
      }

      setInterimText(interim);
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error("Voice capture recognition error:", event.error);
      if (event.error === "not-allowed") {
        toast({
          title: "Microphone Access Required",
          description:
            "Please allow microphone access in your browser to use voice capture.",
          variant: "destructive",
        });
        intentionalStopRef.current = true;
        stopRecording();
      } else if (event.error === "no-speech") {
        // Silence — do nothing, will auto-restart
      } else if (event.error !== "aborted") {
        // Non-fatal: let onend handle restart
      }
    };

    recognition.onend = () => {
      // Auto-restart unless intentionally stopped
      if (!intentionalStopRef.current && isRecordingRef.current) {
        try {
          recognition.start();
        } catch {
          // Already started or other issue — retry after delay
          setTimeout(() => {
            if (isRecordingRef.current && !intentionalStopRef.current) {
              try {
                recognition.start();
              } catch {
                // Give up on restart
              }
            }
          }, 500);
        }
      }
    };

    recognitionRef.current = recognition;

    return () => {
      recognition.abort();
    };
  }, [toast]);

  // ── Flush buffer to document ──
  const flushBuffer = useCallback(() => {
    const buffer = transcriptBufferRef.current.trim();
    if (!buffer) return;

    const timestamp = new Date().toLocaleTimeString();
    const newChunk = `\n\n**[${timestamp}]**\n${buffer}`;

    const updatedText = (documentText || "").trimEnd() + newChunk;
    onDocumentUpdate(updatedText);

    // Clear the buffer
    transcriptBufferRef.current = "";
  }, [documentText, onDocumentUpdate]);

  // ── Auto-save: flush buffer + persist every ~30s ──
  useEffect(() => {
    if (isRecording && !isPaused) {
      autoSaveTimerRef.current = setInterval(async () => {
        // Flush buffer to document state
        flushBuffer();

        // Persist to storage
        setIsSaving(true);
        try {
          const title = objective || `Voice Capture ${new Date().toLocaleDateString()}`;
          await onSave(title, null);
          setLastSaveTime(Date.now());
        } catch {
          // Silent failure — will retry next interval
        } finally {
          setIsSaving(false);
        }
      }, 30000);
    }

    return () => {
      if (autoSaveTimerRef.current) {
        clearInterval(autoSaveTimerRef.current);
        autoSaveTimerRef.current = null;
      }
    };
  }, [isRecording, isPaused, flushBuffer, onSave, objective]);

  // ── Timer tick ──
  useEffect(() => {
    if (isRecording && !isPaused) {
      timerRef.current = setInterval(() => {
        setElapsedSeconds((s) => s + 1);
      }, 1000);
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isRecording, isPaused]);

  // ── Start recording ──
  const startRecording = useCallback(() => {
    if (!recognitionRef.current) return;
    intentionalStopRef.current = false;
    isRecordingRef.current = true;
    transcriptBufferRef.current = "";

    try {
      recognitionRef.current.start();
      setIsRecording(true);
      setIsPaused(false);
    } catch {
      isRecordingRef.current = false;
    }
  }, []);

  // ── Stop recording ──
  const stopRecording = useCallback(() => {
    intentionalStopRef.current = true;
    isRecordingRef.current = false;

    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }

    setIsRecording(false);
    setIsPaused(false);
    setInterimText("");

    // Final flush
    flushBuffer();
  }, [flushBuffer]);

  // ── Pause / resume ──
  const togglePause = useCallback(() => {
    if (isPaused) {
      // Resume
      setIsPaused(false);
      intentionalStopRef.current = false;
      isRecordingRef.current = true;
      try {
        recognitionRef.current?.start();
      } catch {
        // Already started
      }
    } else {
      // Pause
      setIsPaused(true);
      intentionalStopRef.current = true;
      isRecordingRef.current = false;
      recognitionRef.current?.stop();
      flushBuffer();
    }
  }, [isPaused, flushBuffer]);

  // ── Manual save ──
  const handleManualSave = useCallback(async () => {
    flushBuffer();
    setIsSaving(true);
    try {
      const title = objective || `Voice Capture ${new Date().toLocaleDateString()}`;
      await onSave(title, null);
      setLastSaveTime(Date.now());
      toast({ title: "Saved", description: "Transcript saved to storage." });
    } catch {
      toast({
        title: "Save failed",
        description: "Could not save transcript. Will retry on next auto-save.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  }, [flushBuffer, onSave, objective, toast]);

  // ── Unsupported browser ──
  if (!isSupported) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center space-y-4">
          <div className="w-24 h-24 rounded-full bg-muted flex items-center justify-center mx-auto">
            <MicOff className="w-12 h-12 text-muted-foreground" />
          </div>
          <h2 className="text-xl font-semibold">Browser Not Supported</h2>
          <p className="text-muted-foreground max-w-md">
            Speech recognition is not supported in this browser.
            Please use Chrome or Edge for voice capture.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* ── Top status bar ── */}
      <div className="border-b bg-card/60 px-4 py-2 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Clock className="w-4 h-4" />
            <span className="font-mono tabular-nums">{formatElapsed(elapsedSeconds)}</span>
          </div>
          <div className="w-px h-4 bg-border" />
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <FileText className="w-4 h-4" />
            <span>{wordCount.toLocaleString()} words</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {lastSaveTime && (
            <span className="text-xs text-muted-foreground">
              Saved {new Date(lastSaveTime).toLocaleTimeString()}
            </span>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={handleManualSave}
            disabled={isSaving || !totalTranscript.trim()}
            className="gap-1.5"
          >
            {isSaving ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Save className="w-3.5 h-3.5" />
            )}
            Save
          </Button>
        </div>
      </div>

      {/* ── Main content area ── */}
      <div className="flex-1 flex flex-col items-center justify-center gap-8 p-8 overflow-y-auto">
        {/* Recording status */}
        {isRecording && (
          <div className="flex items-center gap-2">
            {isPaused ? (
              <span className="text-sm font-medium text-amber-600 dark:text-amber-400">
                Paused
              </span>
            ) : (
              <>
                <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
                <span className="text-sm font-medium text-red-600 dark:text-red-400">
                  Recording
                </span>
              </>
            )}
          </div>
        )}

        {/* Large mic button */}
        <button
          onClick={isRecording ? stopRecording : startRecording}
          className={`w-36 h-36 rounded-full flex items-center justify-center transition-all duration-300 ${
            isRecording
              ? "bg-destructive shadow-lg shadow-destructive/50 animate-pulse"
              : "bg-primary hover:scale-105 hover:shadow-lg"
          }`}
        >
          {isRecording ? (
            <Square className="w-14 h-14 text-destructive-foreground" />
          ) : (
            <Mic className="w-14 h-14 text-primary-foreground" />
          )}
        </button>

        {/* Action text */}
        <p className="text-muted-foreground text-center text-lg max-w-lg">
          {isRecording
            ? isPaused
              ? "Recording paused. Click resume or stop."
              : "Listening... Speak freely. Transcript auto-saves every 30 seconds."
            : "Click the microphone to start recording. Your transcript will be saved automatically."}
        </p>

        {/* Pause/Resume button (only when recording) */}
        {isRecording && (
          <Button
            variant="outline"
            size="lg"
            onClick={togglePause}
            className="gap-2"
          >
            {isPaused ? (
              <>
                <Play className="w-5 h-5" />
                Resume
              </>
            ) : (
              <>
                <Pause className="w-5 h-5" />
                Pause
              </>
            )}
          </Button>
        )}

        {/* Live interim transcript */}
        {interimText && (
          <div className="w-full max-w-2xl rounded-lg border bg-muted/30 p-4">
            <p className="text-xs font-medium text-muted-foreground mb-1">
              Hearing...
            </p>
            <p className="text-sm font-serif leading-relaxed text-foreground/70 italic">
              {interimText}
            </p>
          </div>
        )}
      </div>

      {/* ── Transcript preview (scrollable bottom section) ── */}
      {totalTranscript.trim() && (
        <div className="border-t bg-card/40 max-h-[35vh] overflow-y-auto">
          <div className="px-6 py-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              Transcript
            </h3>
            <div className="prose prose-sm dark:prose-invert max-w-none font-serif leading-relaxed text-foreground/80 whitespace-pre-wrap">
              {totalTranscript}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
