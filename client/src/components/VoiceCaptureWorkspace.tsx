import { useState, useCallback, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { ProvokeText } from "@/components/ProvokeText";
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
  Sparkles,
  HelpCircle,
  RefreshCw,
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

interface GeneratedQuestion {
  question: string;
  category: "clarify" | "deepen" | "gaps" | "action";
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

const CATEGORY_STYLES: Record<string, { label: string; color: string }> = {
  clarify: { label: "Clarify", color: "text-blue-600 dark:text-blue-400" },
  deepen: { label: "Deepen", color: "text-purple-600 dark:text-purple-400" },
  gaps: { label: "Gaps", color: "text-amber-600 dark:text-amber-400" },
  action: { label: "Action", color: "text-green-600 dark:text-green-400" },
};

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
  // Ref mirror so interval callbacks always read the latest transcript
  const totalTranscriptRef = useRef("");

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

  // ── AI Summary + Questions ──
  const [summary, setSummary] = useState("");
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [questions, setQuestions] = useState<GeneratedQuestion[]>([]);
  const [isGeneratingQuestions, setIsGeneratingQuestions] = useState(false);
  const lastSummarizedLengthRef = useRef(0);

  // Word count
  const wordCount = totalTranscript.trim() ? totalTranscript.trim().split(/\s+/).length : 0;

  // Display transcript with interim text appended
  const displayTranscript = interimText
    ? totalTranscript + interimText
    : totalTranscript;

  // Format questions as copyable text for ProvokeText
  const questionsText = questions.length > 0
    ? questions.map((q) => {
        const style = CATEGORY_STYLES[q.category] || CATEGORY_STYLES.clarify;
        return `[${style.label}] ${q.question}`;
      }).join("\n\n")
    : "";

  // Ref for transcript auto-scroll
  const transcriptEndRef = useRef<HTMLDivElement>(null);

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
        setTotalTranscript((prev) => {
          const next = prev + finalTranscript + " ";
          totalTranscriptRef.current = next;
          return next;
        });
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

  // ── Generate AI summary from transcript ──
  const generateSummary = useCallback(async (text: string) => {
    const words = text.trim().split(/\s+/).length;
    if (!text.trim() || words < 30) return null;
    // Only re-summarize if significant new content since last summary
    const newChars = text.length - lastSummarizedLengthRef.current;
    if (lastSummarizedLengthRef.current > 0 && newChars < 100) return null;

    setIsSummarizing(true);
    try {
      const res = await apiRequest("POST", "/api/summarize-intent", {
        transcript: text,
        context: "source",
        mode: "summarize",
      });
      const data = await res.json();
      if (data.summary) {
        setSummary(data.summary);
        lastSummarizedLengthRef.current = text.length;
        return data.summary;
      }
    } catch {
      // Silent — summary is optional
    } finally {
      setIsSummarizing(false);
    }
    return null;
  }, []);

  // ── Generate AI questions from summary ──
  const generateQuestions = useCallback(async (summaryText: string) => {
    if (!summaryText.trim()) return;

    setIsGeneratingQuestions(true);
    try {
      const res = await apiRequest("POST", "/api/generate-questions", {
        summary: summaryText,
        objective,
      });
      const data = await res.json();
      if (data.questions?.length) {
        setQuestions(data.questions);
      }
    } catch {
      // Silent — questions are optional
    } finally {
      setIsGeneratingQuestions(false);
    }
  }, [objective]);

  // Keep stable refs for callbacks used inside the interval
  const flushBufferRef = useRef(flushBuffer);
  flushBufferRef.current = flushBuffer;
  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;
  const objectiveRef = useRef(objective);
  objectiveRef.current = objective;
  const generateSummaryRef = useRef(generateSummary);
  generateSummaryRef.current = generateSummary;
  const generateQuestionsRef = useRef(generateQuestions);
  generateQuestionsRef.current = generateQuestions;

  // ── Auto-save: flush buffer + persist + summarize every ~30s ──
  // Only depends on isRecording/isPaused so the interval is stable and
  // doesn't restart on every transcript word.
  useEffect(() => {
    if (isRecording && !isPaused) {
      autoSaveTimerRef.current = setInterval(async () => {
        // Flush buffer to document state
        flushBufferRef.current();

        // Persist to storage
        setIsSaving(true);
        try {
          const title = objectiveRef.current || `Voice Capture ${new Date().toLocaleDateString()}`;
          await onSaveRef.current(title, null);
          setLastSaveTime(Date.now());
        } catch {
          // Silent failure — will retry next interval
        } finally {
          setIsSaving(false);
        }

        // Generate summary + questions using the latest transcript via ref
        const currentText = totalTranscriptRef.current;
        generateSummaryRef.current(currentText).then((newSummary) => {
          if (newSummary) {
            generateQuestionsRef.current(newSummary);
          }
        });
      }, 30000);
    }

    return () => {
      if (autoSaveTimerRef.current) {
        clearInterval(autoSaveTimerRef.current);
        autoSaveTimerRef.current = null;
      }
    };
  }, [isRecording, isPaused]);

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

  // ── First-summary trigger: fire once the transcript crosses 30 words ──
  const initialSummaryFiredRef = useRef(false);
  useEffect(() => {
    if (initialSummaryFiredRef.current) return;
    const words = totalTranscript.trim().split(/\s+/).length;
    if (words >= 30) {
      initialSummaryFiredRef.current = true;
      generateSummary(totalTranscript).then((s) => {
        if (s) generateQuestions(s);
      });
    }
  }, [totalTranscript, generateSummary, generateQuestions]);

  // ── Auto-scroll transcript ──
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [totalTranscript, interimText]);

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

  // ── Manual refresh summary + questions ──
  const handleRefreshInsights = useCallback(async () => {
    const newSummary = await generateSummary(totalTranscript);
    if (newSummary) {
      await generateQuestions(newSummary);
    }
  }, [totalTranscript, generateSummary, generateQuestions]);

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

      {/* ── 3-pane layout ── */}
      <div className="flex-1 flex overflow-hidden">

        {/* ── LEFT PANE: Streaming transcript ── */}
        <div className="w-1/3 min-w-[250px] border-r flex flex-col overflow-hidden">
          <ProvokeText
            chrome="container"
            variant="editor"
            label="Transcript"
            labelIcon={FileText}
            value={displayTranscript}
            onChange={() => {}}
            readOnly
            showCopy
            showClear={false}
            placeholder={
              isRecording
                ? "Listening... transcript will appear here"
                : "Start recording to see transcript"
            }
            className="text-sm leading-relaxed font-serif"
            containerClassName="flex-1 min-h-0"
          />
          <div ref={transcriptEndRef} />
        </div>

        {/* ── CENTER PANE: Recording controls ── */}
        <div className="flex-1 min-w-[200px] flex flex-col items-center justify-center gap-6 p-6">
          {/* Recording status */}
          {isRecording && (
            <div className="flex items-center gap-2">
              {isPaused ? (
                <span className="text-sm font-medium text-amber-600 dark:text-amber-400">
                  Paused
                </span>
              ) : (
                <>
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  <span className="text-sm font-medium text-muted-foreground">
                    Recording
                  </span>
                </>
              )}
            </div>
          )}

          {/* Large mic button */}
          <button
            onClick={isRecording ? stopRecording : startRecording}
            className={`w-28 h-28 rounded-full flex items-center justify-center transition-all duration-300 ${
              isRecording
                ? "bg-destructive shadow-md shadow-destructive/30"
                : "bg-primary hover:scale-105 hover:shadow-lg"
            }`}
          >
            {isRecording ? (
              <Square className="w-10 h-10 text-destructive-foreground" />
            ) : (
              <Mic className="w-10 h-10 text-primary-foreground" />
            )}
          </button>

          {/* Action text */}
          <p className="text-muted-foreground text-center text-sm max-w-xs">
            {isRecording
              ? isPaused
                ? "Paused. Resume or stop recording."
                : "Listening... Auto-saves every 30s."
              : "Click to start recording."}
          </p>

          {/* Pause/Resume button */}
          {isRecording && (
            <Button
              variant="outline"
              size="sm"
              onClick={togglePause}
              className="gap-1.5"
            >
              {isPaused ? (
                <>
                  <Play className="w-4 h-4" />
                  Resume
                </>
              ) : (
                <>
                  <Pause className="w-4 h-4" />
                  Pause
                </>
              )}
            </Button>
          )}

          {/* Live interim (shown only when no transcript yet in left pane) */}
          {interimText && !totalTranscript.trim() && (
            <div className="w-full max-w-xs rounded-lg border bg-muted/30 p-3">
              <p className="text-xs font-medium text-muted-foreground mb-1">
                Hearing...
              </p>
              <p className="text-xs font-serif leading-relaxed text-foreground/70 italic">
                {interimText}
              </p>
            </div>
          )}
        </div>

        {/* ── RIGHT PANE: Summary + Questions ── */}
        <div className="w-1/3 min-w-[250px] border-l flex flex-col overflow-hidden">
          {/* Summary sub-panel */}
          <div className="flex-1 flex flex-col overflow-hidden border-b">
            <ProvokeText
              chrome="container"
              variant="editor"
              label="Summary"
              labelIcon={Sparkles}
              value={summary}
              onChange={() => {}}
              readOnly
              showCopy
              showClear={false}
              placeholder={
                wordCount >= 30
                  ? "Click refresh to generate a summary"
                  : "Summary generates after ~30 words"
              }
              className="text-sm leading-relaxed"
              containerClassName="flex-1 min-h-0"
              headerActions={
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  onClick={handleRefreshInsights}
                  disabled={isSummarizing || !totalTranscript.trim() || wordCount < 30}
                  title="Refresh summary & questions"
                >
                  {isSummarizing ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="w-3.5 h-3.5" />
                  )}
                </Button>
              }
            />
          </div>

          {/* Questions sub-panel */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <ProvokeText
              chrome="container"
              variant="editor"
              label="Questions"
              labelIcon={HelpCircle}
              value={questionsText}
              onChange={() => {}}
              readOnly
              showCopy
              showClear={false}
              placeholder={
                summary
                  ? "Questions generate with each summary refresh"
                  : "Questions appear after the first summary"
              }
              className="text-sm leading-relaxed"
              containerClassName="flex-1 min-h-0"
              headerActions={
                isGeneratingQuestions ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
                ) : undefined
              }
            />
          </div>
        </div>
      </div>
    </div>
  );
}
