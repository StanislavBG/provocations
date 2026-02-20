import { useState, useCallback, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
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
// Progressive summary schedule
// ---------------------------------------------------------------------------

/**
 * Returns the summary interval (in seconds) based on elapsed recording time.
 *
 * Default progressive scale:
 *   0–30s   → every 5s  (rapid feedback while ideas form)
 *   30–60s  → every 15s (settling in)
 *   1–5min  → every 30s (steady flow)
 *   5–20min → every 60s (deep work)
 *   20min+  → every 300s (long sessions, less interruption)
 *
 * The schedule can be overridden via admin config.
 */
interface SummaryScheduleStep {
  /** Elapsed seconds threshold (start of this band) */
  after: number;
  /** Summary interval in seconds for this band */
  interval: number;
}

const DEFAULT_SUMMARY_SCHEDULE: SummaryScheduleStep[] = [
  { after: 0,    interval: 5 },
  { after: 30,   interval: 15 },
  { after: 60,   interval: 30 },
  { after: 300,  interval: 60 },
  { after: 1200, interval: 300 },
];

/** DB persistence interval — always 15 seconds (separate from summary) */
const DB_PERSIST_INTERVAL_MS = 15_000;

function getSummaryInterval(elapsedSeconds: number, schedule: SummaryScheduleStep[]): number {
  let interval = schedule[0]?.interval ?? 15;
  for (const step of schedule) {
    if (elapsedSeconds >= step.after) {
      interval = step.interval;
    }
  }
  return interval;
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
  const elapsedSecondsRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Auto-save (DB persistence — fixed 15s) ──
  const persistTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [lastSaveTime, setLastSaveTime] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // ── Progressive summary timer ──
  const summaryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSummaryTimeRef = useRef(0);

  // ── Admin-configurable schedule (loaded from server) ──
  const { data: serverConfig } = useQuery<{
    summarySchedule: SummaryScheduleStep[];
    persistIntervalMs: number;
  }>({
    queryKey: ["/api/voice-capture-config"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/voice-capture-config");
      return res.json();
    },
    staleTime: 60_000,
  });
  const summarySchedule = serverConfig?.summarySchedule ?? DEFAULT_SUMMARY_SCHEDULE;

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

  // Current summary interval label for status display
  const currentSummaryInterval = getSummaryInterval(elapsedSeconds, summarySchedule);

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
        context: "voice-capture",
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

  // Keep stable refs for callbacks used inside timers
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

  // ── DB persistence: flush buffer + save at configured interval (default 15s) ──
  const persistInterval = serverConfig?.persistIntervalMs ?? DB_PERSIST_INTERVAL_MS;
  useEffect(() => {
    if (isRecording && !isPaused) {
      persistTimerRef.current = setInterval(async () => {
        flushBufferRef.current();

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
      }, persistInterval);
    }

    return () => {
      if (persistTimerRef.current) {
        clearInterval(persistTimerRef.current);
        persistTimerRef.current = null;
      }
    };
  }, [isRecording, isPaused, persistInterval]);

  // ── Progressive summary: schedule next summary based on elapsed time ──
  const scheduleSummary = useCallback(() => {
    if (summaryTimerRef.current) {
      clearTimeout(summaryTimerRef.current);
      summaryTimerRef.current = null;
    }

    const elapsed = elapsedSecondsRef.current;
    const intervalSec = getSummaryInterval(elapsed, summarySchedule);
    const timeSinceLastSummary = elapsed - lastSummaryTimeRef.current;

    // How many seconds until next summary fires
    const delayMs = Math.max(0, (intervalSec - timeSinceLastSummary)) * 1000;

    summaryTimerRef.current = setTimeout(async () => {
      lastSummaryTimeRef.current = elapsedSecondsRef.current;

      const currentText = totalTranscriptRef.current;
      const newSummary = await generateSummaryRef.current(currentText);
      if (newSummary) {
        generateQuestionsRef.current(newSummary);
      }

      // Schedule the next one (recursive)
      if (isRecordingRef.current) {
        scheduleSummary();
      }
    }, delayMs);
  }, [summarySchedule]);

  const scheduleSummaryRef = useRef(scheduleSummary);
  scheduleSummaryRef.current = scheduleSummary;

  // Start/stop the progressive summary schedule when recording state changes
  useEffect(() => {
    if (isRecording && !isPaused) {
      scheduleSummaryRef.current();
    }

    return () => {
      if (summaryTimerRef.current) {
        clearTimeout(summaryTimerRef.current);
        summaryTimerRef.current = null;
      }
    };
  }, [isRecording, isPaused]);

  // ── Timer tick ──
  useEffect(() => {
    if (isRecording && !isPaused) {
      timerRef.current = setInterval(() => {
        setElapsedSeconds((s) => {
          const next = s + 1;
          elapsedSecondsRef.current = next;
          return next;
        });
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
    lastSummaryTimeRef.current = elapsedSecondsRef.current;

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
      lastSummaryTimeRef.current = elapsedSecondsRef.current;
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
        {/* Left: elapsed time + word count + summary schedule indicator */}
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
          {isRecording && !isPaused && (
            <>
              <div className="w-px h-4 bg-border" />
              <span className="text-xs text-muted-foreground/70">
                Summary every {currentSummaryInterval}s
              </span>
            </>
          )}
        </div>

        {/* Right: save button + stop button (red, beside save) */}
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
          {isRecording && (
            <Button
              variant="destructive"
              size="sm"
              onClick={stopRecording}
              className="gap-1.5"
            >
              <Square className="w-3.5 h-3.5" />
              Stop
            </Button>
          )}
        </div>
      </div>

      {/* ── 2-pane layout: Transcript (left) | Summary (center/right) ── */}
      <div className="flex-1 flex overflow-hidden">

        {/* ── LEFT PANE: Streaming transcript ── */}
        <div className="w-2/5 min-w-[250px] border-r flex flex-col overflow-hidden">
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
            headerActions={
              !isRecording ? (
                <Button
                  size="sm"
                  onClick={startRecording}
                  className="gap-1.5"
                >
                  <Mic className="w-3.5 h-3.5" />
                  Start Recording
                </Button>
              ) : isPaused ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={togglePause}
                  className="gap-1.5"
                >
                  <Play className="w-3.5 h-3.5" />
                  Resume
                </Button>
              ) : (
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  <span className="text-xs text-muted-foreground">Recording</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={togglePause}
                    className="gap-1.5 ml-1 h-6"
                  >
                    <Pause className="w-3 h-3" />
                    Pause
                  </Button>
                </div>
              )
            }
          />
          <div ref={transcriptEndRef} />
        </div>

        {/* ── RIGHT PANE: Summary (top) + Questions (bottom) — claims center space ── */}
        <div className="flex-1 min-w-[300px] flex flex-col overflow-hidden">
          {/* Summary sub-panel (takes ~60% of height) */}
          <div className="flex-[3] flex flex-col overflow-hidden border-b">
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
                  ? "Summary will generate automatically..."
                  : "Summary generates after ~30 words of recording"
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

          {/* Questions sub-panel (takes ~40% of height) */}
          <div className="flex-[2] flex flex-col overflow-hidden">
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
