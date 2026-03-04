import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { generateId } from "@/lib/utils";
import { trackEvent } from "@/lib/tracking";
import { errorLogStore } from "@/lib/errorLog";
import { useToast } from "@/hooks/use-toast";
import { VoiceRecorder } from "@/components/VoiceRecorder";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Play,
  Square,
  Send,
  Mic,
  MessageCircleQuestion,
  SkipForward,
  FileText,
  Loader2,
  X,
  Search,
  Compass,
  Scale,
  Clock,
  Volume2,
  VolumeX,
  Radio,
  Download,
  type LucideIcon,
} from "lucide-react";
import type { FlowNode } from "./useFlowCanvas";
import type { InterviewEntry, InterviewQuestionResponse } from "@shared/schema";

// ── Interview stance ──

type InterviewStance = "investigative" | "exploratory" | "balanced" | "autobiography";

const INTERVIEW_STANCES: { id: InterviewStance; label: string; icon: LucideIcon; description: string }[] = [
  { id: "balanced", label: "Balanced", icon: Scale, description: "Mix of analytical and creative questioning" },
  { id: "investigative", label: "Investigative", icon: Search, description: "Rigorous — digs into claims, demands evidence" },
  { id: "exploratory", label: "Exploratory", icon: Compass, description: "Curious — opens new angles, draws connections" },
  { id: "autobiography", label: "Autobiography", icon: Clock, description: "Biographer capturing time-tagged life events" },
];

function buildGuidance(stance: InterviewStance, focus: string): string | undefined {
  const parts: string[] = [];
  if (stance === "investigative") {
    parts.push("STANCE: Investigative Journalist — be rigorous and analytical. Dig into claims, find logical gaps, demand specifics and evidence. Ask the hard 'how' and 'why' questions. Hold the interviewee accountable to their own stated goals.");
  } else if (stance === "exploratory") {
    parts.push("STANCE: Feature Journalist — be curious and exploratory. Ask 'what if', draw unexpected connections, explore the human story and motivations behind the document. Open new angles the interviewee hasn't considered.");
  } else if (stance === "autobiography") {
    parts.push(`STANCE: Autobiography Interviewer — you are a biographer capturing someone's life story for a chronological timeline. Your SOLE PURPOSE is to extract time-tagged events, turning points, and experiences.

CRITICAL RULES FOR AUTOBIOGRAPHY MODE:
1. ALWAYS ask about WHEN things happened — push for specific dates, years, seasons, or approximate periods
2. Ask about cause-and-effect chains: "What led to that decision?" "What happened as a result?"
3. Ask about KEY PEOPLE involved in each event — names, roles, relationships
4. Ask about PLACES — where did this happen?
5. Identify TURNING POINTS — the moments that changed the trajectory
6. Move chronologically when possible but follow interesting threads
7. Capture both FACTS and FEELINGS
8. Distinguish between phases/eras and specific milestone events
9. When the user mentions a time period vaguely, probe for specifics
10. Tag each question topic with the time period being discussed`);
  }
  if (focus.trim()) parts.push(focus.trim());
  return parts.length > 0 ? parts.join("\n\n") : undefined;
}

const AUTOBIOGRAPHY_DEFAULT_OBJECTIVE =
  "Capture the subject's life story — key events, turning points, people, places, and eras — through a warm, thorough biographical interview.";

// ── Props ──

interface FlowInterviewOverlayProps {
  node: FlowNode;
  onClose: () => void;
  onUpdateNode: (nodeId: string, patch: Partial<FlowNode>) => void;
  onExportTranscript: (text: string, label: string) => void;
  connectionContext: { inputContent: string; objectiveText: string } | null;
}

// ── Component ──

export function FlowInterviewOverlay({
  node,
  onClose,
  onUpdateNode,
  onExportTranscript,
  connectionContext,
}: FlowInterviewOverlayProps) {
  const { toast } = useToast();

  // ── Interview state (initialized from node) ──
  const [entries, setEntries] = useState<InterviewEntry[]>(node.interviewEntries ?? []);
  const [isActive, setIsActive] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState<string | null>(null);
  const [currentTopic, setCurrentTopic] = useState<string | null>(null);
  const [answerText, setAnswerText] = useState("");
  const [isRecordingAnswer, setIsRecordingAnswer] = useState(false);

  // ── Config state (initialized from node) ──
  const [objective, setObjective] = useState(
    node.interviewObjective ?? connectionContext?.objectiveText ?? "",
  );
  const [stance, setStance] = useState<InterviewStance>(
    node.interviewConfig?.stance ?? "investigative",
  );
  const [focusText, setFocusText] = useState(node.interviewConfig?.journalistDescription ?? "");
  const [ttsEnabled, setTtsEnabled] = useState(node.interviewConfig?.ttsEnabled ?? false);
  const [trueInterview, setTrueInterview] = useState(false);

  // ── TTS state ──
  const [isSpeaking, setIsSpeaking] = useState(false);
  const ttsAudioRef = useRef<HTMLAudioElement | null>(null);
  const mobileAudioRef = useRef<HTMLAudioElement | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll on new entries
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [entries.length, currentQuestion]);

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (ttsAudioRef.current) {
        ttsAudioRef.current.pause();
        const src = ttsAudioRef.current.src;
        if (src.startsWith("blob:")) URL.revokeObjectURL(src);
      }
    };
  }, []);

  // Auto-enable TTS in true interview mode
  useEffect(() => {
    if (trueInterview && !ttsEnabled) setTtsEnabled(true);
  }, [trueInterview, ttsEnabled]);

  // ── Persist state back to node ──
  const persistTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (persistTimeoutRef.current) clearTimeout(persistTimeoutRef.current);
    persistTimeoutRef.current = setTimeout(() => {
      onUpdateNode(node.id, {
        interviewEntries: entries,
        interviewObjective: objective,
        interviewConfig: {
          stance,
          journalistDescription: focusText,
          voiceEnabled: true,
          ttsEnabled,
        },
        label: entries.length > 0
          ? `Interview (${entries.length} Q&A)`
          : "Interview",
        snippet: entries.length > 0
          ? `${entries[entries.length - 1].topic}: ${entries[entries.length - 1].answer.slice(0, 80)}...`
          : objective.slice(0, 100) || "Double-click to start interview",
      });
    }, 300);
    return () => {
      if (persistTimeoutRef.current) clearTimeout(persistTimeoutRef.current);
    };
  }, [entries, objective, stance, focusText, ttsEnabled, node.id, onUpdateNode]);

  // ── Unlock mobile audio ──
  const unlockMobileAudio = useCallback(() => {
    if (mobileAudioRef.current) return;
    const audio = new Audio();
    audio.src = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQAAAAA=";
    audio.volume = 0;
    audio.play().then(() => {
      audio.pause();
      audio.volume = 1;
      mobileAudioRef.current = audio;
    }).catch(() => {});
  }, []);

  // ── TTS: speak question aloud ──
  const speakQuestion = useCallback(async (text: string) => {
    if (!ttsEnabled || !text.trim()) return;
    try {
      setIsSpeaking(true);
      const res = await apiRequest("POST", "/api/tts", { text, voice: "nova" });
      const data = (await res.json()) as { audio: string; mimeType: string };
      if (!data.audio) { setIsSpeaking(false); return; }
      const byteChars = atob(data.audio);
      const byteArray = new Uint8Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++) {
        byteArray[i] = byteChars.charCodeAt(i);
      }
      const blob = new Blob([byteArray], { type: data.mimeType || "audio/mp3" });
      const url = URL.createObjectURL(blob);
      const audio = mobileAudioRef.current ?? new Audio();
      if (ttsAudioRef.current && ttsAudioRef.current !== audio) {
        ttsAudioRef.current.pause();
        const oldSrc = ttsAudioRef.current.src;
        if (oldSrc.startsWith("blob:")) URL.revokeObjectURL(oldSrc);
      }
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

  // ── Input content from connected nodes ──
  const documentText = connectionContext?.inputContent ?? "";

  // ── Question mutation ──
  const questionMutation = useMutation({
    mutationFn: async (updatedEntries?: InterviewEntry[]) => {
      const allEntries = updatedEntries ?? entries;
      const effectiveObjective = objective.trim() || (stance === "autobiography" ? AUTOBIOGRAPHY_DEFAULT_OBJECTIVE : objective);
      const response = await apiRequest("POST", "/api/interview/question", {
        objective: effectiveObjective,
        document: documentText,
        previousEntries: allEntries.length > 0 ? allEntries : undefined,
        directionMode: stance === "investigative" ? "challenge" : stance === "exploratory" || stance === "autobiography" ? "advise" : undefined,
        directionGuidance: buildGuidance(stance, focusText),
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

  // ── Summary mutation ──
  const summaryMutation = useMutation({
    mutationFn: async () => {
      const effectiveObjective = objective.trim() || (stance === "autobiography" ? AUTOBIOGRAPHY_DEFAULT_OBJECTIVE : objective);
      const response = await apiRequest("POST", "/api/interview/summary", {
        objective: effectiveObjective,
        entries,
        document: documentText,
      });
      return (await response.json()) as { instruction: string };
    },
    onSuccess: (data) => {
      onExportTranscript(data.instruction, "Interview Summary");
      toast({ title: "Summary exported", description: "Interview summary created as document node" });
    },
    onError: (error) => {
      const msg = error instanceof Error ? error.message : "Failed to generate summary";
      errorLogStore.push({ step: "Interview Summary", endpoint: "/api/interview/summary", message: msg });
      toast({ title: "Summary failed", description: msg, variant: "destructive" });
    },
  });

  // ── Handlers ──

  const handleStart = useCallback(() => {
    if (!objective.trim() && stance !== "autobiography") {
      toast({ title: "Objective required", description: "Set an interview objective before starting.", variant: "destructive" });
      return;
    }
    if (ttsEnabled) unlockMobileAudio();
    setIsActive(true);
    questionMutation.mutate(undefined);
    trackEvent("interview_started");
  }, [objective, stance, questionMutation, toast, ttsEnabled, unlockMobileAudio]);

  const handleStop = useCallback(() => {
    setIsActive(false);
    setCurrentQuestion(null);
    setCurrentTopic(null);
    trackEvent("interview_ended", { metadata: { entryCount: String(entries.length) } });
  }, [entries.length]);

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
      const nextEntries = [...entries, entry];
      setEntries(nextEntries);
      setCurrentQuestion(null);
      setCurrentTopic(null);
      setAnswerText("");
      trackEvent("interview_answer");
      questionMutation.mutate(nextEntries);
    },
    [currentQuestion, currentTopic, questionMutation, entries],
  );

  const handleSubmitAnswer = useCallback(() => {
    handleAnswer(answerText);
  }, [answerText, handleAnswer]);

  const handleVoiceAnswer = useCallback(
    (transcript: string) => {
      if (!transcript.trim()) return;
      trackEvent("voice_recorded");
      const endKeyword = /provo\s+message/i;
      const cleaned = transcript.replace(endKeyword, "").trim();
      if (cleaned) {
        handleAnswer(cleaned);
      }
    },
    [handleAnswer],
  );

  // Watch answerText for "Provo Message" keyword mid-stream
  const endKeywordRef = useRef(false);
  useEffect(() => {
    if (!answerText || !isRecordingAnswer || endKeywordRef.current) return;
    const endKeyword = /provo\s+message/i;
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
    questionMutation.mutate(undefined);
  }, [questionMutation]);

  const handleExportTranscript = useCallback(() => {
    if (entries.length === 0) return;
    const text = entries
      .map((e) => `**${e.topic}**\nQ: ${e.question}\nA: ${e.answer}`)
      .join("\n\n---\n\n");
    onExportTranscript(text, "Interview Transcript");
    toast({ title: "Transcript exported", description: `${entries.length} Q&A pairs exported as document node` });
  }, [entries, onExportTranscript, toast]);

  const handleExportSummary = useCallback(() => {
    if (entries.length === 0) {
      toast({ title: "No entries", description: "Answer some questions before generating a summary.", variant: "destructive" });
      return;
    }
    summaryMutation.mutate();
  }, [entries.length, summaryMutation, toast]);

  // ── Effective objective display ──
  const effectiveObjective = objective.trim() || connectionContext?.objectiveText || "";

  // ── Render ──
  return createPortal(
    <div className="fixed inset-0 z-50 flex flex-col bg-background animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b bg-cyan-500/5 shrink-0">
        <div className="flex items-center gap-3">
          <MessageCircleQuestion className="w-5 h-5 text-cyan-500" />
          <h2 className="text-sm font-semibold">{node.label || "Interview"}</h2>
          {entries.length > 0 && (
            <Badge variant="outline" className="text-[10px] h-5">{entries.length} Q&A</Badge>
          )}
          {isActive && (
            <Badge className="text-[10px] h-5 bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/40">
              Live
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {/* TTS toggle */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={ttsEnabled ? "default" : "ghost"}
                size="sm"
                className={`h-7 w-7 p-0 ${ttsEnabled ? "text-primary-foreground" : "text-muted-foreground"}`}
                onClick={() => {
                  const next = !ttsEnabled;
                  setTtsEnabled(next);
                  if (next) unlockMobileAudio();
                  if (!next && ttsAudioRef.current) {
                    ttsAudioRef.current.pause();
                    setIsSpeaking(false);
                  }
                }}
              >
                {ttsEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{ttsEnabled ? "Disable voice" : "Enable voice (read questions aloud)"}</TooltipContent>
          </Tooltip>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Body: two-column layout */}
      <div className="flex-1 flex overflow-hidden pb-12">
        {/* Left panel: config */}
        <div className="w-80 border-r flex flex-col shrink-0">
          <ScrollArea className="flex-1">
            <div className="p-4 space-y-4">
              {/* Objective */}
              <div className="space-y-1.5">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Objective</p>
                <textarea
                  value={objective}
                  onChange={(e) => setObjective(e.target.value)}
                  placeholder="What is this interview about? What do you want to explore?"
                  className="w-full bg-muted/30 border rounded-lg text-sm text-foreground placeholder:text-muted-foreground/50 resize-none outline-none px-3 py-2 min-h-[80px] leading-relaxed focus:ring-1 focus:ring-cyan-500/50"
                  rows={3}
                />
              </div>

              {/* Stance selector */}
              <div className="space-y-1.5">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Interview Style</p>
                <div className="flex flex-wrap items-center gap-1 bg-muted/20 rounded-lg p-1.5 border">
                  {INTERVIEW_STANCES.map((s) => {
                    const Icon = s.icon;
                    const isSelected = stance === s.id;
                    return (
                      <Tooltip key={s.id}>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            onClick={() => setStance(s.id)}
                            className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors ${
                              isSelected
                                ? "bg-cyan-500 text-white"
                                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                            }`}
                          >
                            <Icon className="w-3 h-3" />
                            {s.label}
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="text-xs max-w-[200px]">{s.description}</TooltipContent>
                      </Tooltip>
                    );
                  })}
                </div>
              </div>

              {/* Journalist focus */}
              <div className="space-y-1.5">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Journalist Focus (optional)</p>
                <input
                  type="text"
                  value={focusText}
                  onChange={(e) => setFocusText(e.target.value)}
                  placeholder="e.g. Push me on pricing strategy"
                  className="w-full px-2.5 py-1.5 text-xs bg-muted/30 border rounded-md outline-none focus:ring-1 focus:ring-cyan-500/50 placeholder:text-muted-foreground/50"
                />
                <p className="text-[10px] text-muted-foreground/60">
                  Default: inquisitive, professional reporter probing based on objective
                </p>
              </div>

              {/* Mode toggles */}
              <div className="space-y-2">
                {/* True Interview — continuous dialog */}
                <button
                  onClick={() => {
                    const next = !trueInterview;
                    setTrueInterview(next);
                    if (next) { setTtsEnabled(true); unlockMobileAudio(); }
                  }}
                  className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-md border text-xs transition-colors ${
                    trueInterview
                      ? "border-emerald-500/60 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400"
                      : "border-border/60 text-muted-foreground hover:text-foreground hover:border-foreground/20"
                  }`}
                >
                  <Radio className="w-3.5 h-3.5 shrink-0" />
                  <div className="text-left flex-1">
                    <span className="font-medium">True Interview</span>
                    <span className="text-[10px] opacity-70 ml-1.5">continuous voice dialog</span>
                  </div>
                </button>

                {/* Voice Conversation toggle */}
                <button
                  onClick={() => {
                    const next = !ttsEnabled;
                    setTtsEnabled(next);
                    if (next) unlockMobileAudio();
                  }}
                  className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md border text-xs transition-colors ${
                    ttsEnabled
                      ? "border-violet-500/60 bg-violet-500/5 text-violet-600 dark:text-violet-400"
                      : "border-border/60 text-muted-foreground hover:text-foreground hover:border-foreground/20"
                  }`}
                >
                  {ttsEnabled ? <Volume2 className="w-3.5 h-3.5 shrink-0" /> : <VolumeX className="w-3.5 h-3.5 shrink-0" />}
                  <div className="text-left">
                    <span className="font-medium">Voice Conversation</span>
                    <span className="text-[10px] opacity-70 ml-1.5">questions read aloud</span>
                  </div>
                </button>
              </div>

              {/* Connected inputs info */}
              {connectionContext?.inputContent && (
                <div className="space-y-1.5">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Connected Context</p>
                  <div className="bg-muted/30 border rounded-lg p-2.5 text-xs text-muted-foreground leading-relaxed max-h-24 overflow-y-auto">
                    {connectionContext.inputContent.slice(0, 300)}
                    {connectionContext.inputContent.length > 300 && "..."}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="space-y-2 pt-2 border-t">
                {!isActive ? (
                  <Button
                    size="sm"
                    className="gap-1.5 w-full bg-cyan-600 hover:bg-cyan-700 text-white"
                    onClick={handleStart}
                    disabled={!objective.trim() && stance !== "autobiography"}
                  >
                    <Play className="w-3.5 h-3.5" />
                    {entries.length > 0 ? "Continue Interview" : trueInterview ? "Start True Interview" : "Start Interview"}
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="destructive"
                    className="gap-1.5 w-full"
                    onClick={handleStop}
                  >
                    <Square className="w-3.5 h-3.5" />
                    Stop Interview
                  </Button>
                )}

                {entries.length > 0 && (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5 w-full text-xs"
                      onClick={handleExportTranscript}
                    >
                      <Download className="w-3.5 h-3.5" />
                      Export Transcript
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5 w-full text-xs"
                      onClick={handleExportSummary}
                      disabled={summaryMutation.isPending}
                    >
                      {summaryMutation.isPending ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <FileText className="w-3.5 h-3.5" />
                      )}
                      Export Summary (AI)
                    </Button>
                  </>
                )}

                {!objective.trim() && stance !== "autobiography" && (
                  <p className="text-[10px] text-muted-foreground/60 text-center">
                    Set an objective to begin
                  </p>
                )}
                {!objective.trim() && stance === "autobiography" && (
                  <p className="text-[10px] text-amber-600/70 dark:text-amber-400/70 text-center">
                    Biography mode — ready to capture your story
                  </p>
                )}
              </div>
            </div>
          </ScrollArea>
        </div>

        {/* Right panel: Q&A thread */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Empty state */}
          {entries.length === 0 && !currentQuestion && !questionMutation.isPending && (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center space-y-3 max-w-sm">
                <MessageCircleQuestion className="w-12 h-12 text-cyan-500/30 mx-auto" />
                <h3 className="text-lg font-semibold text-muted-foreground/70">Ready to Interview</h3>
                <p className="text-sm text-muted-foreground/50 leading-relaxed">
                  Set your objective, choose an interview style, and click Start.
                  The journalist will ask probing questions — answer with voice or text.
                  Say &quot;Provo Message&quot; to submit your answer.
                </p>
              </div>
            </div>
          )}

          {/* Q&A thread */}
          {(entries.length > 0 || currentQuestion || questionMutation.isPending) && (
            <ScrollArea className="flex-1">
              <div className="p-4 space-y-4 max-w-3xl mx-auto" ref={scrollRef}>
                {/* Previous entries */}
                {entries.map((entry) => (
                  <div key={entry.id} className="space-y-2">
                    {/* Question */}
                    <div className="flex justify-start">
                      <div className="max-w-[85%] bg-card border rounded-xl rounded-bl-sm p-3">
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <MessageCircleQuestion className="w-3.5 h-3.5 text-cyan-500" />
                          <Badge variant="outline" className="text-[10px] h-4">{entry.topic}</Badge>
                        </div>
                        <p className="text-sm leading-relaxed">{entry.question}</p>
                      </div>
                    </div>
                    {/* Answer */}
                    <div className="flex justify-end">
                      <div className="max-w-[80%] bg-cyan-500/10 border border-cyan-500/20 rounded-xl rounded-br-sm p-3">
                        <p className="text-sm leading-relaxed">{entry.answer}</p>
                      </div>
                    </div>
                  </div>
                ))}

                {/* Loading next question */}
                {questionMutation.isPending && (
                  <div className="flex justify-start">
                    <div className="bg-card border rounded-xl rounded-bl-sm p-3 flex items-center gap-2">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-500" />
                      <span className="text-xs text-muted-foreground">Thinking of the next question...</span>
                    </div>
                  </div>
                )}

                {/* Current question + answer input */}
                {currentQuestion && !questionMutation.isPending && (
                  <div className="space-y-3">
                    <div className="flex justify-start">
                      <div className="max-w-[85%] bg-card border border-cyan-500/30 rounded-xl rounded-bl-sm p-3">
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <MessageCircleQuestion className="w-3.5 h-3.5 text-cyan-500" />
                          {currentTopic && <Badge className="text-[10px] h-4 bg-cyan-500/20 text-cyan-700 dark:text-cyan-300">{currentTopic}</Badge>}
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="sm" className="gap-1 text-xs h-5 px-1.5 ml-auto text-muted-foreground" onClick={handleSkip}>
                                <SkipForward className="w-3 h-3" />
                                Skip
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Skip this question</TooltipContent>
                          </Tooltip>
                        </div>
                        <p className="text-sm font-medium leading-relaxed">{currentQuestion}</p>
                      </div>
                    </div>

                    {/* Answer input area */}
                    <div className="pl-6 space-y-1.5">
                      <div className="flex items-end gap-2">
                        <VoiceRecorder
                          onTranscript={handleVoiceAnswer}
                          onInterimTranscript={(t) => setAnswerText(t)}
                          onRecordingChange={setIsRecordingAnswer}
                          size="sm"
                          variant={isRecordingAnswer ? "destructive" : "ghost"}
                          className={`h-9 w-9 shrink-0 rounded-full ${isRecordingAnswer ? "animate-pulse" : "text-muted-foreground"}`}
                        />
                        <div className="flex-1 min-w-0">
                          <textarea
                            value={answerText}
                            onChange={(e) => setAnswerText(e.target.value)}
                            placeholder={isRecordingAnswer ? "Listening..." : "Type your answer..."}
                            className="w-full bg-muted/30 border rounded-lg text-sm text-foreground placeholder:text-muted-foreground/50 resize-none outline-none px-3 py-2 min-h-[40px] max-h-[160px] leading-relaxed focus:ring-1 focus:ring-cyan-500/50"
                            rows={2}
                            onInput={(e) => {
                              const target = e.target as HTMLTextAreaElement;
                              target.style.height = "auto";
                              target.style.height = Math.min(target.scrollHeight, 160) + "px";
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && !e.shiftKey) {
                                e.preventDefault();
                                handleSubmitAnswer();
                              }
                            }}
                          />
                        </div>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={handleSubmitAnswer}
                          disabled={!answerText.trim()}
                          className="h-9 w-9 shrink-0"
                        >
                          <Send className="w-4 h-4" />
                        </Button>
                      </div>
                      {isRecordingAnswer && (
                        <div className="flex items-center gap-1.5 text-xs text-cyan-500 animate-pulse">
                          <Mic className="w-3 h-3" />
                          Listening... <span className="text-muted-foreground text-[10px] font-normal ml-1">Say &quot;Provo Message&quot; to submit</span>
                        </div>
                      )}
                      {isSpeaking && (
                        <div className="flex items-center gap-1.5 text-xs text-violet-500 animate-pulse">
                          <Volume2 className="w-3 h-3" />
                          Speaking question...
                        </div>
                      )}
                      {trueInterview && !isSpeaking && !isRecordingAnswer && currentQuestion && (
                        <div className="flex items-center gap-1.5 text-xs text-emerald-500">
                          <Mic className="w-3 h-3" />
                          Your turn — tap mic to answer
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Paused state */}
                {!isActive && entries.length > 0 && !currentQuestion && !questionMutation.isPending && (
                  <div className="flex justify-center pt-2">
                    <div className="text-center space-y-2 bg-muted/30 rounded-lg p-4">
                      <p className="text-xs text-muted-foreground">
                        Interview paused — {entries.length} questions answered
                      </p>
                      <Button size="sm" variant="outline" className="text-xs h-7 gap-1" onClick={handleStart}>
                        <Play className="w-3 h-3" />
                        Continue
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
