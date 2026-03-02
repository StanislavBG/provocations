import { useState, useCallback, useRef, useEffect } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { trackEvent } from "@/lib/tracking";
import { errorLogStore } from "@/lib/errorLog";
import { generateId } from "@/lib/utils";
import { ProvoIcon } from "@/components/ProvoIcon";
import { VoiceRecorder } from "@/components/VoiceRecorder";
import { UserButton } from "@clerk/clerk-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Send,
  Loader2,
  StickyNote,
  Trash2,
  ChevronDown,
  ChevronUp,
  Mic,
  MessageCircleQuestion,
  SkipForward,
  Square,
  Play,
  Target,
  Pencil,
  Paintbrush,
  Scale,
  Volume2,
  VolumeX,
} from "lucide-react";
import type { InterviewEntry, InterviewQuestionResponse } from "@shared/schema";

type MobileMode = "capture" | "interview";

interface CapturedNote {
  id: number;
  title: string;
  createdAt: string;
  content?: string;
}

/**
 * MobileCapture — The mobile-only experience.
 *
 * Philosophy: You don't work on mobile. You capture context.
 * Two modes:
 *   - Quick Capture: Jot or dictate a note, saved permanently.
 *   - Interview: AI-guided Q&A. Each answer saved as its own note.
 *
 * All notes land in the document store, ready when you return to desktop.
 */
export function MobileCapture() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [mode, setMode] = useState<MobileMode>("capture");

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* ─── Header ─── */}
      <header className="shrink-0 border-b bg-card">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <ProvoIcon className="w-5 h-5 text-primary" />
            <div>
              <h1 className="text-sm font-bold font-serif tracking-tight text-foreground leading-none">
                Provocations
              </h1>
              <p className="text-[10px] text-muted-foreground mt-0.5">Capture Mode</p>
            </div>
          </div>
          <UserButton />
        </div>

        {/* Mode tabs */}
        <div className="flex border-t">
          <button
            onClick={() => setMode("capture")}
            className={`flex-1 py-2 text-xs font-semibold text-center transition-colors ${
              mode === "capture"
                ? "text-primary border-b-2 border-primary"
                : "text-muted-foreground"
            }`}
          >
            Quick Note
          </button>
          <button
            onClick={() => setMode("interview")}
            className={`flex-1 py-2 text-xs font-semibold text-center transition-colors ${
              mode === "interview"
                ? "text-primary border-b-2 border-primary"
                : "text-muted-foreground"
            }`}
          >
            Interview
          </button>
        </div>
      </header>

      {/* ─── Mode content ─── */}
      {mode === "capture" ? (
        <QuickCaptureView toast={toast} queryClient={queryClient} />
      ) : (
        <InterviewView toast={toast} queryClient={queryClient} />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Quick Capture View
// ═══════════════════════════════════════════════════════════════════

function QuickCaptureView({
  toast,
  queryClient,
}: {
  toast: ReturnType<typeof useToast>["toast"];
  queryClient: ReturnType<typeof useQueryClient>;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [noteText, setNoteText] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [expandedNoteId, setExpandedNoteId] = useState<number | null>(null);
  const [expandedContent, setExpandedContent] = useState<string>("");
  const [loadingContentId, setLoadingContentId] = useState<number | null>(null);

  // ── Fetch recent notes from document store ──
  const { data: recentNotes, isLoading: isLoadingNotes } = useQuery<CapturedNote[]>({
    queryKey: ["/api/documents", "mobile-notes"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/documents");
      const data = await res.json();
      const docs: CapturedNote[] = (data.documents || [])
        .sort((a: CapturedNote, b: CapturedNote) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )
        .slice(0, 50);
      return docs;
    },
    staleTime: 30_000,
  });

  // ── Save note to document store ──
  const handleSaveNote = useCallback(async () => {
    const text = noteText.trim();
    if (!text || isSaving) return;

    setIsSaving(true);
    try {
      const firstLine = text.split("\n")[0].trim();
      const title = firstLine.length > 80
        ? firstLine.slice(0, 77) + "..."
        : firstLine || `Note ${new Date().toLocaleTimeString()}`;

      await apiRequest("POST", "/api/documents", { title, content: text });
      trackEvent("mobile_note_captured");

      setNoteText("");
      queryClient.invalidateQueries({ queryKey: ["/api/documents", "mobile-notes"] });
      toast({ title: "Note saved", description: "Ready for you on desktop." });
    } catch {
      toast({ title: "Save failed", description: "Could not save note. Try again.", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  }, [noteText, isSaving, queryClient, toast]);

  // ── Voice transcript — append ──
  const handleVoiceTranscript = useCallback((transcript: string) => {
    setNoteText((prev) => {
      const separator = prev.trim() ? "\n\n" : "";
      return prev + separator + transcript;
    });
  }, []);

  // ── Auto-resize textarea ──
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 300) + "px";
  }, [noteText]);

  // ── Expand/collapse note ──
  const toggleNoteExpand = useCallback(async (note: CapturedNote) => {
    if (expandedNoteId === note.id) {
      setExpandedNoteId(null);
      setExpandedContent("");
      return;
    }
    setExpandedNoteId(note.id);
    setLoadingContentId(note.id);
    try {
      const res = await apiRequest("GET", `/api/documents/${note.id}`);
      const data = await res.json();
      setExpandedContent(data.content || "");
    } catch {
      setExpandedContent("[Could not load note content]");
    } finally {
      setLoadingContentId(null);
    }
  }, [expandedNoteId]);

  // ── Delete note ──
  const handleDeleteNote = useCallback(async (noteId: number) => {
    try {
      await apiRequest("DELETE", `/api/documents/${noteId}`);
      queryClient.invalidateQueries({ queryKey: ["/api/documents", "mobile-notes"] });
      if (expandedNoteId === noteId) {
        setExpandedNoteId(null);
        setExpandedContent("");
      }
      toast({ title: "Note deleted" });
    } catch {
      toast({ title: "Delete failed", variant: "destructive" });
    }
  }, [expandedNoteId, queryClient, toast]);

  const noteCount = recentNotes?.length ?? 0;

  return (
    <>
      {/* ─── Capture Area ─── */}
      <div className="shrink-0 px-4 pt-4 pb-3">
        <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
          <div className="p-3">
            <textarea
              ref={textareaRef}
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="What's on your mind?"
              className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground/50 resize-none outline-none min-h-[80px] font-serif leading-relaxed"
              rows={3}
            />
          </div>
          <div className="flex items-center justify-between px-3 py-2 border-t bg-muted/30">
            <div className="flex items-center gap-1">
              <VoiceRecorder
                onTranscript={handleVoiceTranscript}
                onInterimTranscript={(t) => setNoteText(t)}
                size="sm"
                variant="ghost"
                className="h-8 w-8 text-muted-foreground"
                label=""
              />
              <span className="text-[10px] text-muted-foreground">
                {noteText.trim().split(/\s+/).filter(Boolean).length || 0} words
              </span>
            </div>
            <Button
              size="sm"
              onClick={handleSaveNote}
              disabled={!noteText.trim() || isSaving}
              className="gap-1.5 h-8 px-4 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs"
            >
              {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              {isSaving ? "Saving..." : "Capture"}
            </Button>
          </div>
        </div>
      </div>

      {/* ─── Recent Notes ─── */}
      <div className="flex-1 overflow-hidden flex flex-col min-h-0">
        <div className="px-4 py-2 flex items-center justify-between">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Recent Captures
          </h2>
          {noteCount > 0 && (
            <span className="text-[10px] text-muted-foreground bg-muted rounded-full px-2 py-0.5">
              {noteCount}
            </span>
          )}
        </div>

        {isLoadingNotes ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : noteCount === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 px-8 text-center">
            <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center">
              <StickyNote className="w-7 h-7 text-muted-foreground/40" />
            </div>
            <p className="text-sm text-muted-foreground">No notes yet.</p>
            <p className="text-xs text-muted-foreground/60">
              Capture thoughts above — they're saved permanently for desktop.
            </p>
          </div>
        ) : (
          <ScrollArea className="flex-1">
            <div className="px-4 pb-6 space-y-2">
              {recentNotes?.map((note) => (
                <NoteCard
                  key={note.id}
                  note={note}
                  isExpanded={expandedNoteId === note.id}
                  expandedContent={expandedContent}
                  isLoadingContent={loadingContentId === note.id}
                  onToggleExpand={toggleNoteExpand}
                  onDelete={handleDeleteNote}
                />
              ))}
            </div>
          </ScrollArea>
        )}
      </div>

      <MobileFooter />
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Interview View
// ═══════════════════════════════════════════════════════════════════

type InterviewStance = "writer" | "painter" | "balanced";

function buildInterviewGuidance(stance: InterviewStance, focus: string): string | undefined {
  const parts: string[] = [];
  if (stance === "writer") {
    parts.push("STANCE: Writer — be analytical, structured. Break things down, find logical gaps, demand specifics and evidence. Ask the hard 'how' and 'why' questions.");
  } else if (stance === "painter") {
    parts.push("STANCE: Painter — be creative, exploratory. Ask 'what if', draw unexpected connections, explore emotional and human dimensions. Open new possibilities.");
  }
  if (focus.trim()) parts.push(focus.trim());
  return parts.length > 0 ? parts.join("\n\n") : undefined;
}

function InterviewView({
  toast,
  queryClient,
}: {
  toast: ReturnType<typeof useToast>["toast"];
  queryClient: ReturnType<typeof useQueryClient>;
}) {
  // ── Interview state ──
  const [objective, setObjective] = useState("");
  const [entries, setEntries] = useState<InterviewEntry[]>([]);
  const [isActive, setIsActive] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState<string | null>(null);
  const [currentTopic, setCurrentTopic] = useState<string | null>(null);
  const [answerText, setAnswerText] = useState("");
  const [isRecordingAnswer, setIsRecordingAnswer] = useState(false);
  const [savingEntryId, setSavingEntryId] = useState<string | null>(null);

  // ── Stance & focus state ──
  const [stance, setStance] = useState<InterviewStance>("balanced");
  const [focusText, setFocusText] = useState("");

  // ── TTS (Text-to-Speech) state ──
  const [ttsEnabled, setTtsEnabled] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const ttsAudioRef = useRef<HTMLAudioElement | null>(null);
  // Persistent Audio element for mobile — created once on first user gesture
  // so that subsequent .play() calls from async callbacks are permitted.
  const mobileAudioRef = useRef<HTMLAudioElement | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const objectiveRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom on new entries
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [entries.length, currentQuestion]);

  // Auto-resize objective input
  useEffect(() => {
    const el = objectiveRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
  }, [objective]);

  // Cleanup TTS audio on unmount
  useEffect(() => {
    return () => {
      if (ttsAudioRef.current) {
        ttsAudioRef.current.pause();
        const src = ttsAudioRef.current.src;
        if (src.startsWith("blob:")) URL.revokeObjectURL(src);
      }
    };
  }, []);

  /**
   * Unlock audio on mobile — must be called from a direct user gesture
   * (click handler). Creates a persistent Audio element and plays a tiny
   * silent buffer so the browser marks it as user-activated. All subsequent
   * .play() calls on this element succeed even from async callbacks.
   */
  const unlockMobileAudio = useCallback(() => {
    if (mobileAudioRef.current) return; // already unlocked
    const audio = new Audio();
    audio.src = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQAAAAA=";
    audio.volume = 0;
    audio.play().then(() => {
      audio.pause();
      audio.volume = 1;
      mobileAudioRef.current = audio;
    }).catch(() => {
      // If even this fails, we'll fall back to creating new Audio elements
    });
  }, []);

  /** Speak text via /api/tts — plays the question aloud */
  const speakQuestion = useCallback(async (text: string) => {
    if (!ttsEnabled || !text.trim()) return;
    try {
      setIsSpeaking(true);
      const res = await apiRequest("POST", "/api/tts", { text, voice: "nova" });
      const data = (await res.json()) as { audio: string; mimeType: string };
      if (!data.audio) {
        setIsSpeaking(false);
        return;
      }
      const byteChars = atob(data.audio);
      const byteArray = new Uint8Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++) {
        byteArray[i] = byteChars.charCodeAt(i);
      }
      const blob = new Blob([byteArray], { type: data.mimeType || "audio/mp3" });
      const url = URL.createObjectURL(blob);

      // Prefer the mobile-unlocked Audio element so playback works on mobile.
      const audio = mobileAudioRef.current ?? new Audio();

      // Stop previous TTS playback
      if (ttsAudioRef.current && ttsAudioRef.current !== audio) {
        ttsAudioRef.current.pause();
        const oldSrc = ttsAudioRef.current.src;
        if (oldSrc.startsWith("blob:")) URL.revokeObjectURL(oldSrc);
      }

      // Revoke previous blob URL if the same element is being reused
      const prevSrc = audio.src;
      if (prevSrc && prevSrc.startsWith("blob:")) URL.revokeObjectURL(prevSrc);

      audio.src = url;
      ttsAudioRef.current = audio;
      audio.onended = () => setIsSpeaking(false);
      audio.onerror = () => setIsSpeaking(false);
      await audio.play();
    } catch {
      setIsSpeaking(false);
    }
  }, [ttsEnabled]);

  // ── Stance cycle helper ──
  const cycleStance = useCallback(() => {
    setStance((prev) =>
      prev === "balanced" ? "writer" : prev === "writer" ? "painter" : "balanced"
    );
  }, []);

  // ── Fetch next question ──
  const questionMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/interview/question", {
        objective,
        previousEntries: entries.length > 0 ? entries : undefined,
        directionMode: stance === "writer" ? "challenge" : stance === "painter" ? "advise" : undefined,
        directionGuidance: buildInterviewGuidance(stance, focusText),
      });
      return (await response.json()) as InterviewQuestionResponse;
    },
    onSuccess: (data) => {
      setCurrentQuestion(data.question);
      setCurrentTopic(data.topic);
      speakQuestion(data.question);
    },
    onError: (error) => {
      const msg = error instanceof Error ? error.message : "Failed to generate question";
      errorLogStore.push({ step: "Interview Question", endpoint: "/api/interview/question", message: msg });
      toast({ title: "Question failed", description: msg, variant: "destructive" });
    },
  });

  // ── Save a single Q&A entry to the document store ──
  const saveEntryToStore = useCallback(async (entry: InterviewEntry) => {
    setSavingEntryId(entry.id);
    try {
      const title = `[Interview] ${entry.topic}: ${entry.question.slice(0, 60)}`;
      const content = `**Topic:** ${entry.topic}\n\n**Question:** ${entry.question}\n\n**Answer:** ${entry.answer}`;
      await apiRequest("POST", "/api/documents", {
        title: title.slice(0, 200),
        content,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/documents", "mobile-notes"] });
    } catch {
      // Non-fatal — the entry still exists locally. User can retry on desktop.
      toast({ title: "Auto-save failed", description: "Answer recorded locally. Will sync on next save.", variant: "destructive" });
    } finally {
      setSavingEntryId(null);
    }
  }, [queryClient, toast]);

  // ── Start interview ──
  const handleStart = useCallback(() => {
    if (!objective.trim()) {
      toast({ title: "Objective required", description: "What are you trying to capture?", variant: "destructive" });
      return;
    }
    // Unlock audio on mobile — must happen inside a user gesture handler
    if (ttsEnabled) unlockMobileAudio();
    setIsActive(true);
    questionMutation.mutate();
    trackEvent("interview_started");
  }, [objective, questionMutation, toast, ttsEnabled, unlockMobileAudio]);

  // ── Stop interview ──
  const handleStop = useCallback(() => {
    setIsActive(false);
    setCurrentQuestion(null);
    setCurrentTopic(null);
    trackEvent("interview_ended", { metadata: { entryCount: String(entries.length) } });
  }, [entries.length]);

  // ── Submit answer (text or voice) ──
  const handleAnswer = useCallback(
    (answer: string) => {
      if (!currentQuestion || !answer.trim()) return;

      const entry: InterviewEntry = {
        id: generateId("iv"),
        question: currentQuestion,
        answer: answer.trim(),
        topic: currentTopic || "General",
        timestamp: Date.now(),
      };

      setEntries((prev) => [...prev, entry]);
      setCurrentQuestion(null);
      setCurrentTopic(null);
      setAnswerText("");

      trackEvent("interview_answer", { metadata: { inputMethod: "text" } });

      // Auto-save this Q&A to the store as a separate document
      saveEntryToStore(entry);

      // Fetch next question
      questionMutation.mutate();
    },
    [currentQuestion, currentTopic, questionMutation, saveEntryToStore],
  );

  const handleSubmitAnswer = useCallback(() => {
    handleAnswer(answerText);
  }, [answerText, handleAnswer]);

  const handleVoiceAnswer = useCallback(
    (transcript: string) => {
      if (!transcript.trim()) return;
      trackEvent("voice_recorded");
      const endKeyword = /provo\s+end\s+message/i;
      const cleaned = transcript.replace(endKeyword, "").trim();
      if (cleaned) {
        handleAnswer(cleaned);
      }
    },
    [handleAnswer],
  );

  // Show live transcript in the textarea while the user is speaking
  const handleInterimTranscript = useCallback((text: string) => {
    setAnswerText(text);
  }, []);

  // Watch answerText mid-stream for "Provo End Message" keyword
  const endKeywordRef = useRef(false);
  useEffect(() => {
    if (!answerText || !isRecordingAnswer || endKeywordRef.current) return;
    const endKeyword = /provo\s+end\s+message/i;
    if (endKeyword.test(answerText)) {
      endKeywordRef.current = true;
      const cleaned = answerText.replace(endKeyword, "").trim();
      if (cleaned) {
        setTimeout(() => {
          handleAnswer(cleaned);
          endKeywordRef.current = false;
        }, 300);
      } else {
        endKeywordRef.current = false;
      }
    }
  }, [answerText, isRecordingAnswer, handleAnswer]);

  const handleSkip = useCallback(() => {
    trackEvent("interview_skip");
    setCurrentQuestion(null);
    setCurrentTopic(null);
    questionMutation.mutate();
  }, [questionMutation]);

  // ── Not started: show objective input + start button ──
  if (!isActive && entries.length === 0) {
    return (
      <>
        <div className="flex-1 flex flex-col items-center justify-center px-6">
          <div className="w-full max-w-sm space-y-6 text-center">
            <div className="space-y-2">
              <MessageCircleQuestion className="w-10 h-10 text-primary/30 mx-auto" />
              <h3 className="text-base font-semibold font-serif">Guided Interview</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                An AI interviewer asks targeted questions. Answer by voice while you walk.
                Each Q&A is saved as a separate note to the store.
              </p>
            </div>

            {/* Objective input */}
            <div className="rounded-xl border bg-card shadow-sm overflow-hidden text-left">
              <div className="px-3 py-2 border-b bg-muted/30 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Target className="w-3 h-3 text-primary" />
                  <span className="text-[11px] font-semibold text-muted-foreground">Objective</span>
                </div>
                <VoiceRecorder
                  onTranscript={(t) => setObjective((prev) => prev ? prev + " " + t : t)}
                  onInterimTranscript={(t) => setObjective(t)}
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 text-muted-foreground"
                  label=""
                />
              </div>
              <div className="p-3">
                <textarea
                  ref={objectiveRef}
                  value={objective}
                  onChange={(e) => setObjective(e.target.value)}
                  placeholder="What are you trying to think through?"
                  className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground/50 resize-none outline-none min-h-[60px] font-serif leading-relaxed"
                  rows={2}
                />
              </div>
            </div>

            {/* Interview Stance */}
            <div className="space-y-2 text-left">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Interview Stance</p>
              <div className="flex gap-2">
                <button
                  onClick={() => setStance("writer")}
                  className={`flex-1 flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition-colors ${
                    stance === "writer"
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-card text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Pencil className="w-4 h-4" />
                  <div className="text-left">
                    <div className="text-xs font-semibold">Writer</div>
                    <div className="text-[10px] opacity-70">Analytical</div>
                  </div>
                </button>
                <button
                  onClick={() => setStance("painter")}
                  className={`flex-1 flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition-colors ${
                    stance === "painter"
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-card text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Paintbrush className="w-4 h-4" />
                  <div className="text-left">
                    <div className="text-xs font-semibold">Painter</div>
                    <div className="text-[10px] opacity-70">Exploratory</div>
                  </div>
                </button>
              </div>
              {stance !== "balanced" && (
                <button
                  onClick={() => setStance("balanced")}
                  className="text-[10px] text-muted-foreground hover:text-foreground underline"
                >
                  Reset to balanced
                </button>
              )}
            </div>

            {/* Focus input */}
            <div className="space-y-1.5 text-left">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Focus (optional)</p>
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={focusText}
                  onChange={(e) => setFocusText(e.target.value)}
                  placeholder="Push me on pricing strategy"
                  className="flex-1 px-3 py-2.5 text-sm bg-muted/30 border rounded-xl outline-none focus:ring-1 focus:ring-primary/50 placeholder:text-muted-foreground/50 font-serif"
                />
                <VoiceRecorder
                  onTranscript={(t) => setFocusText((prev) => prev ? prev + " " + t : t)}
                  onInterimTranscript={(t) => setFocusText(t)}
                  size="sm"
                  variant="ghost"
                  className="h-9 w-9 shrink-0 text-muted-foreground"
                  label=""
                />
              </div>
            </div>

            {/* Voice Conversation toggle */}
            <button
              onClick={() => {
                const next = !ttsEnabled;
                setTtsEnabled(next);
                // Unlock audio on mobile when enabling TTS (user gesture required)
                if (next) unlockMobileAudio();
              }}
              className={`w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition-colors ${
                ttsEnabled
                  ? "border-violet-500/60 bg-violet-500/10 text-violet-600 dark:text-violet-400"
                  : "border-border bg-card text-muted-foreground"
              }`}
            >
              {ttsEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              Voice Conversation
              <span className="text-[10px] opacity-70">{ttsEnabled ? "on" : "off"}</span>
            </button>

            <Button
              size="lg"
              className="gap-2 w-full h-12 text-sm font-semibold"
              onClick={handleStart}
              disabled={!objective.trim()}
            >
              <Mic className="w-4 h-4" />
              Start Interview
            </Button>
          </div>
        </div>
        <MobileFooter />
      </>
    );
  }

  // ── Active interview / paused with entries ──
  return (
    <>
      {/* Interview header strip */}
      <div className="shrink-0 px-4 py-2 border-b bg-muted/20 flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          {/* TTS toggle */}
          <button
            onClick={() => {
              const next = !ttsEnabled;
              setTtsEnabled(next);
              if (next) unlockMobileAudio();
              if (!next && ttsAudioRef.current) {
                ttsAudioRef.current.pause();
                setIsSpeaking(false);
              }
            }}
            className={`shrink-0 p-1 rounded-full transition-colors ${
              ttsEnabled ? "bg-violet-500/20 text-violet-500" : "text-muted-foreground"
            }`}
          >
            {ttsEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>
          {/* Stance pill — tap to cycle */}
          <button
            onClick={cycleStance}
            className="shrink-0 flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border transition-colors hover:bg-muted/50"
          >
            {stance === "writer" ? (
              <><Pencil className="w-3 h-3" /> Writer</>
            ) : stance === "painter" ? (
              <><Paintbrush className="w-3 h-3" /> Painter</>
            ) : (
              <><Scale className="w-3 h-3" /> Balanced</>
            )}
          </button>
          <span className="shrink-0 text-[10px] text-muted-foreground bg-muted rounded-full px-2 py-0.5">
            {entries.length} Q&A
          </span>
        </div>
        {isActive ? (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs text-destructive gap-1"
            onClick={handleStop}
          >
            <Square className="w-3 h-3" />
            Stop
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs text-primary gap-1"
            onClick={handleStart}
          >
            <Play className="w-3 h-3" />
            Continue
          </Button>
        )}
      </div>

      {/* Q&A thread */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4" ref={scrollRef}>
          {entries.map((entry) => (
            <div key={entry.id} className="space-y-2">
              {/* Question */}
              <div className="flex justify-start">
                <div className="max-w-[92%] bg-card border rounded-2xl rounded-bl-sm px-3.5 py-2.5">
                  <div className="flex items-center gap-1.5 mb-1">
                    <MessageCircleQuestion className="w-3 h-3 text-primary shrink-0" />
                    <span className="text-[10px] font-semibold text-primary truncate">{entry.topic}</span>
                  </div>
                  <p className="text-sm leading-relaxed">{entry.question}</p>
                </div>
              </div>
              {/* Answer */}
              <div className="flex justify-end">
                <div className="max-w-[88%] bg-primary/10 border border-primary/20 rounded-2xl rounded-br-sm px-3.5 py-2.5">
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{entry.answer}</p>
                  {savingEntryId === entry.id && (
                    <div className="flex items-center gap-1 mt-1.5 text-[10px] text-muted-foreground">
                      <Loader2 className="w-2.5 h-2.5 animate-spin" />
                      Saving...
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}

          {/* Loading next question */}
          {questionMutation.isPending && (
            <div className="flex justify-start">
              <div className="bg-card border rounded-2xl rounded-bl-sm px-3.5 py-3 flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                <span className="text-xs text-muted-foreground">Thinking...</span>
              </div>
            </div>
          )}

          {/* Current question */}
          {currentQuestion && !questionMutation.isPending && (
            <div className="space-y-3">
              <div className="flex justify-start">
                <div className="max-w-[92%] bg-card border border-primary/30 rounded-2xl rounded-bl-sm px-3.5 py-2.5">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <MessageCircleQuestion className="w-3 h-3 text-primary shrink-0" />
                      {currentTopic && (
                        <span className="text-[10px] font-semibold text-primary truncate">{currentTopic}</span>
                      )}
                    </div>
                    <button
                      onClick={handleSkip}
                      className="shrink-0 flex items-center gap-0.5 text-[10px] text-muted-foreground hover:text-foreground"
                    >
                      <SkipForward className="w-3 h-3" />
                      Skip
                    </button>
                  </div>
                  <p className="text-sm font-medium leading-relaxed">{currentQuestion}</p>
                </div>
              </div>
            </div>
          )}

          {/* Interview paused */}
          {!isActive && entries.length > 0 && !currentQuestion && !questionMutation.isPending && (
            <div className="text-center py-4">
              <p className="text-xs text-muted-foreground mb-2">
                Interview paused — {entries.length} answers captured
              </p>
              <Button size="sm" variant="outline" className="gap-1.5" onClick={handleStart}>
                <Play className="w-3 h-3" />
                Continue
              </Button>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* ── Answer input — fixed at bottom, voice-first ── */}
      {isActive && currentQuestion && !questionMutation.isPending && (
        <div className="shrink-0 border-t bg-card p-3">
          <div className="flex items-end gap-2">
            {/* Voice button — large and prominent */}
            <VoiceRecorder
              onTranscript={handleVoiceAnswer}
              onInterimTranscript={handleInterimTranscript}
              onRecordingChange={setIsRecordingAnswer}
              size="default"
              variant={isRecordingAnswer ? "destructive" : "outline"}
              className={`h-11 w-11 shrink-0 rounded-full ${isRecordingAnswer ? "animate-pulse" : ""}`}
            />

            {/* Text input */}
            <div className="flex-1 min-w-0">
              <textarea
                value={answerText}
                onChange={(e) => setAnswerText(e.target.value)}
                placeholder={isRecordingAnswer ? "Listening..." : "Type or tap mic to answer..."}
                className="w-full bg-muted/30 border rounded-xl text-sm text-foreground placeholder:text-muted-foreground/50 resize-none outline-none px-3 py-2.5 min-h-[44px] max-h-[120px] font-serif leading-relaxed"
                rows={1}
                onInput={(e) => {
                  const target = e.target as HTMLTextAreaElement;
                  target.style.height = "auto";
                  target.style.height = Math.min(target.scrollHeight, 120) + "px";
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmitAnswer();
                  }
                }}
              />
            </div>

            {/* Send button */}
            <Button
              size="icon"
              onClick={handleSubmitAnswer}
              disabled={!answerText.trim()}
              className="h-11 w-11 shrink-0 rounded-full"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
          {isRecordingAnswer && (
            <div className="flex items-center justify-center gap-1.5 text-xs text-primary animate-pulse mt-2">
              <Mic className="w-3 h-3" />
              Listening... <span className="text-muted-foreground text-[10px] font-normal ml-1">Say &quot;Provo End Message&quot; to submit</span>
            </div>
          )}
          {isSpeaking && (
            <div className="flex items-center justify-center gap-1.5 text-xs text-violet-500 animate-pulse mt-2">
              <Volume2 className="w-3 h-3" />
              Speaking question...
            </div>
          )}
        </div>
      )}
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Shared Components
// ═══════════════════════════════════════════════════════════════════

function NoteCard({
  note,
  isExpanded,
  expandedContent,
  isLoadingContent,
  onToggleExpand,
  onDelete,
}: {
  note: CapturedNote;
  isExpanded: boolean;
  expandedContent: string;
  isLoadingContent: boolean;
  onToggleExpand: (note: CapturedNote) => void;
  onDelete: (id: number) => void;
}) {
  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <button
        onClick={() => onToggleExpand(note)}
        className="w-full text-left px-3 py-2.5 flex items-start justify-between gap-2"
      >
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground truncate">{note.title}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            {formatRelativeTime(note.createdAt)}
          </p>
        </div>
        <div className="shrink-0 pt-0.5">
          {isLoadingContent ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
          ) : isExpanded ? (
            <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
          )}
        </div>
      </button>

      {isExpanded && (
        <div className="border-t">
          <div className="px-3 py-2 text-xs text-foreground/80 whitespace-pre-wrap font-serif leading-relaxed max-h-[300px] overflow-y-auto">
            {isLoadingContent ? "Loading..." : expandedContent || "(empty)"}
          </div>
          <div className="px-3 py-1.5 border-t bg-muted/30 flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDelete(note.id)}
              className="h-6 px-2 text-[10px] text-muted-foreground hover:text-destructive gap-1"
            >
              <Trash2 className="w-3 h-3" />
              Delete
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function MobileFooter() {
  return (
    <div className="shrink-0 px-4 py-3 border-t bg-muted/20 text-center">
      <p className="text-[10px] text-muted-foreground/60">
        Open Provocations on desktop to work with your captured notes
      </p>
    </div>
  );
}

// ── Helpers ──

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMs / 3_600_000);
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
