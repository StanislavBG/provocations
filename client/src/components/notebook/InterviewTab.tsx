import { useState, useRef, useEffect, useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { generateId } from "@/lib/utils";
import { trackEvent } from "@/lib/tracking";
import { errorLogStore } from "@/lib/errorLog";
import { useToast } from "@/hooks/use-toast";
import { ProvokeText } from "@/components/ProvokeText";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Play,
  Pause,
  Loader2,
  Send,
  Mic,
  MessageCircleQuestion,
  SkipForward,
  Lightbulb,
  FileText,
  Podcast,
  Square,
  X,
  CheckCircle2,
  Search,
  Compass,
  Scale,
  Target,
} from "lucide-react";
import type {
  InterviewEntry,
  InterviewQuestionResponse,
  PodcastResponse,
  PodcastSegment,
} from "@shared/schema";

// ── Interview stance (Journalist approach styles) ──

type InterviewStance = "investigative" | "exploratory" | "balanced";

function buildGuidance(stance: InterviewStance, focus: string): string | undefined {
  const parts: string[] = [];
  if (stance === "investigative") {
    parts.push("STANCE: Investigative Journalist — be rigorous and analytical. Dig into claims, find logical gaps, demand specifics and evidence. Ask the hard 'how' and 'why' questions. Hold the interviewee accountable to their own stated goals.");
  } else if (stance === "exploratory") {
    parts.push("STANCE: Feature Journalist — be curious and exploratory. Ask 'what if', draw unexpected connections, explore the human story and motivations behind the document. Open new angles the interviewee hasn't considered.");
  }
  if (focus.trim()) parts.push(focus.trim());
  return parts.length > 0 ? parts.join("\n\n") : undefined;
}

// ── Props ──

interface InterviewTabProps {
  objective: string;
  documentText: string;
  appType?: string;
  onEvolveDocument?: (instruction: string, description: string) => void;
  isMerging?: boolean;
  onCaptureToContext?: (text: string, label: string) => void;
}

// ── Component ──

export function InterviewTab({
  objective,
  documentText,
  appType,
  onEvolveDocument,
  isMerging = false,
  onCaptureToContext,
}: InterviewTabProps) {
  const { toast } = useToast();

  // ── Interview state ──
  const [entries, setEntries] = useState<InterviewEntry[]>([]);
  const [isActive, setIsActive] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState<string | null>(null);
  const [currentTopic, setCurrentTopic] = useState<string | null>(null);
  const [answerText, setAnswerText] = useState("");
  const [isRecordingAnswer, setIsRecordingAnswer] = useState(false);

  // ── Stance & focus state ──
  const [stance, setStance] = useState<InterviewStance>("investigative");
  const [focusText, setFocusText] = useState("");

  // ── Podcast state ──
  const [podcastAudioUrl, setPodcastAudioUrl] = useState<string | null>(null);
  const [podcastScript, setPodcastScript] = useState<PodcastSegment[] | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showScript, setShowScript] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll when new entries arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [entries.length, currentQuestion]);

  // Cleanup audio URL on unmount
  useEffect(() => {
    return () => {
      if (podcastAudioUrl) URL.revokeObjectURL(podcastAudioUrl);
    };
  }, [podcastAudioUrl]);

  // ── Fetch next question mutation ──
  // Accept optional updatedEntries to avoid stale closure when called
  // immediately after setEntries (React state updates are async).
  const questionMutation = useMutation({
    mutationFn: async (updatedEntries?: InterviewEntry[]) => {
      const allEntries = updatedEntries ?? entries;
      const response = await apiRequest("POST", "/api/interview/question", {
        objective,
        document: documentText,
        appType,
        previousEntries: allEntries.length > 0 ? allEntries : undefined,
        directionMode: stance === "investigative" ? "challenge" : stance === "exploratory" ? "advise" : undefined,
        directionGuidance: buildGuidance(stance, focusText),
      });
      return (await response.json()) as InterviewQuestionResponse;
    },
    onSuccess: (data) => {
      setCurrentQuestion(data.question);
      setCurrentTopic(data.topic);
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
      const response = await apiRequest("POST", "/api/interview/summary", {
        objective,
        entries,
        document: documentText,
        appType,
      });
      return (await response.json()) as { instruction: string };
    },
    onSuccess: (data) => {
      if (onEvolveDocument) {
        onEvolveDocument(data.instruction, "Interview summary merged");
      }
      toast({ title: "Summary merged", description: "Interview findings integrated into the document" });
    },
    onError: (error) => {
      const msg = error instanceof Error ? error.message : "Failed to generate summary";
      errorLogStore.push({ step: "Interview Summary", endpoint: "/api/interview/summary", message: msg });
      toast({ title: "Summary failed", description: msg, variant: "destructive" });
    },
  });

  // ── Podcast mutation ──
  const podcastMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/interview/podcast", {
        objective,
        entries,
        document: documentText,
        appType,
      });
      return (await response.json()) as PodcastResponse;
    },
    onSuccess: (data) => {
      // Convert base64 audio to blob URL
      const byteChars = atob(data.audio);
      const byteArray = new Uint8Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++) {
        byteArray[i] = byteChars.charCodeAt(i);
      }
      const blob = new Blob([byteArray], { type: data.mimeType });
      const url = URL.createObjectURL(blob);

      // Revoke old URL if any
      if (podcastAudioUrl) URL.revokeObjectURL(podcastAudioUrl);

      setPodcastAudioUrl(url);
      setPodcastScript(data.script);
      toast({ title: "Podcast ready", description: "Your podcast episode has been generated" });
      trackEvent("podcast_generated");
    },
    onError: (error) => {
      const msg = error instanceof Error ? error.message : "Failed to generate podcast";
      errorLogStore.push({ step: "Podcast", endpoint: "/api/interview/podcast", message: msg });
      toast({ title: "Podcast failed", description: msg, variant: "destructive" });
    },
  });

  // ── Handlers ──

  const handleStart = useCallback(() => {
    if (!objective.trim()) {
      toast({ title: "Objective required", description: "Set a document objective before starting the interview.", variant: "destructive" });
      return;
    }
    setIsActive(true);
    questionMutation.mutate(undefined);
    trackEvent("interview_started");
  }, [objective, questionMutation, toast]);

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

      // Build the full entries array including this new answer so the
      // mutation sees it immediately (setEntries is async).
      const nextEntries = [...entries, entry];
      setEntries(nextEntries);
      setCurrentQuestion(null);
      setCurrentTopic(null);
      setAnswerText("");
      trackEvent("interview_answer", { metadata: { inputMethod: "text" } });

      // Pass the up-to-date entries so the LLM sees ALL previous Q&A
      questionMutation.mutate(nextEntries);
    },
    [currentQuestion, currentTopic, questionMutation, entries],
  );

  const handleSubmitAnswer = useCallback(() => {
    handleAnswer(answerText);
  }, [answerText, handleAnswer]);

  const handleVoiceAnswer = useCallback(
    (transcript: string) => {
      if (transcript.trim()) {
        trackEvent("voice_recorded");
        handleAnswer(transcript);
      }
    },
    [handleAnswer],
  );

  const handleSkip = useCallback(() => {
    trackEvent("interview_skip");
    setCurrentQuestion(null);
    setCurrentTopic(null);
    questionMutation.mutate(undefined);
  }, [questionMutation]);

  const handleGenerateSummary = useCallback(() => {
    if (entries.length === 0) {
      toast({ title: "No entries", description: "Answer some questions before generating a summary.", variant: "destructive" });
      return;
    }
    summaryMutation.mutate();
  }, [entries.length, summaryMutation, toast]);

  const handleGeneratePodcast = useCallback(() => {
    if (entries.length === 0) {
      toast({ title: "No entries", description: "Answer some questions before generating a podcast.", variant: "destructive" });
      return;
    }
    podcastMutation.mutate();
  }, [entries.length, podcastMutation, toast]);

  const handlePlayPause = useCallback(() => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  }, [isPlaying]);

  const handleSaveToContext = useCallback(() => {
    if (!onCaptureToContext || entries.length === 0) return;
    const text = entries
      .map((e) => `**${e.topic}**\nQ: ${e.question}\nA: ${e.answer}`)
      .join("\n\n---\n\n");
    onCaptureToContext(text, "Interview Q&A");
    toast({ title: "Saved to notes", description: `${entries.length} Q&A pairs captured` });
  }, [entries, onCaptureToContext, toast]);

  // ── Stance cycle helper ──
  const cycleStance = useCallback(() => {
    setStance((prev) =>
      prev === "balanced" ? "investigative" : prev === "investigative" ? "exploratory" : "balanced"
    );
  }, []);

  // ── Render: Not started ──
  if (!isActive && entries.length === 0) {
    return (
      <div className="h-full flex flex-col">
        {/* Header bar */}
        <div className="flex items-center justify-between px-3 py-2 border-b shrink-0">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Interview</span>
        </div>

        <div className="flex-1 flex items-center justify-center p-6">
          <div className="space-y-4 max-w-sm w-full">
            {/* Investigative stance — primary choice */}
            <div className="space-y-1">
              <button
                onClick={() => setStance("investigative")}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg border text-left text-xs font-medium transition-colors ${
                  stance === "investigative"
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-card text-muted-foreground hover:text-foreground hover:border-foreground/30"
                }`}
              >
                <Search className="w-4 h-4 shrink-0" />
                <div>
                  <div className="font-semibold">Investigative</div>
                  <div className="text-[10px] opacity-70">Rigorous, analytical — digs into claims, finds gaps, demands evidence</div>
                </div>
              </button>
            </div>

            {/* Config options */}
            <div className="space-y-2.5 pl-1">
              {/* Exploratory toggle */}
              <button
                onClick={() => setStance(stance === "exploratory" ? "investigative" : "exploratory")}
                className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md border text-xs transition-colors ${
                  stance === "exploratory"
                    ? "border-primary/60 bg-primary/5 text-primary"
                    : "border-border/60 text-muted-foreground hover:text-foreground hover:border-foreground/20"
                }`}
              >
                <Compass className="w-3.5 h-3.5 shrink-0" />
                <div className="text-left">
                  <span className="font-medium">Exploratory</span>
                  <span className="text-[10px] opacity-70 ml-1.5">curious, opens new angles</span>
                </div>
              </button>

              {/* Focus input */}
              <div className="space-y-1">
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Focus (optional)</p>
                <input
                  type="text"
                  value={focusText}
                  onChange={(e) => setFocusText(e.target.value)}
                  placeholder="e.g. Push me on pricing strategy"
                  className="w-full px-2.5 py-1.5 text-xs bg-muted/30 border rounded-md outline-none focus:ring-1 focus:ring-primary/50 placeholder:text-muted-foreground/50"
                />
              </div>
            </div>

            <Button
              size="sm"
              className="gap-1.5 w-full"
              onClick={handleStart}
              disabled={!objective.trim()}
            >
              <Mic className="w-3.5 h-3.5" />
              Start Interview
            </Button>
            {!objective.trim() && (
              <p className="text-[10px] text-muted-foreground/60 text-center">
                Set a document objective first
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── Render: Active interview / completed ──
  return (
    <div className="h-full flex flex-col">
      {/* ── Header bar with Podcast button ── */}
      <div className="flex items-center justify-between px-3 py-2 border-b shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Interview</span>
          {entries.length > 0 && (
            <Badge variant="outline" className="text-[10px] h-4">
              {entries.length} Q&A
            </Badge>
          )}
          {/* Stance pill — tap to cycle */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={cycleStance}
                className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border transition-colors hover:bg-muted/50"
              >
                {stance === "investigative" ? (
                  <><Search className="w-3 h-3" /> Investigative</>
                ) : stance === "exploratory" ? (
                  <><Compass className="w-3 h-3" /> Exploratory</>
                ) : (
                  <><Scale className="w-3 h-3" /> Balanced</>
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent>Tap to cycle: Balanced → Investigative → Exploratory</TooltipContent>
          </Tooltip>
        </div>
        <div className="flex items-center gap-1">
          {/* Podcast button */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="gap-1 text-xs h-7 px-2"
                onClick={handleGeneratePodcast}
                disabled={entries.length === 0 || podcastMutation.isPending}
              >
                {podcastMutation.isPending ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Podcast className="w-3.5 h-3.5" />
                )}
                Podcast
              </Button>
            </TooltipTrigger>
            <TooltipContent>Generate a two-host podcast episode from the interview</TooltipContent>
          </Tooltip>

          {/* Summary → merge to doc */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="gap-1 text-xs h-7 px-2"
                onClick={handleGenerateSummary}
                disabled={entries.length === 0 || summaryMutation.isPending || isMerging}
              >
                {summaryMutation.isPending ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <FileText className="w-3.5 h-3.5" />
                )}
                Summary
              </Button>
            </TooltipTrigger>
            <TooltipContent>Synthesize Q&A into document edits</TooltipContent>
          </Tooltip>

          {/* Stop / Restart */}
          {isActive ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-destructive"
                  onClick={handleStop}
                >
                  <Square className="w-3.5 h-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>End interview</TooltipContent>
            </Tooltip>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-primary"
                  onClick={handleStart}
                >
                  <Play className="w-3.5 h-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Resume interview</TooltipContent>
            </Tooltip>
          )}

          {/* Save to context — far right */}
          {onCaptureToContext && entries.length > 0 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 ml-1"
                  onClick={handleSaveToContext}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Save Q&A to Notes</TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>

      {/* ── Podcast player (shown when audio is available) ── */}
      {podcastAudioUrl && (
        <div className="px-3 py-2 border-b bg-gradient-to-r from-violet-50/50 to-fuchsia-50/50 dark:from-violet-950/20 dark:to-fuchsia-950/20 space-y-2 shrink-0">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-full bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={handlePlayPause}
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </Button>
            <div className="flex-1">
              <p className="text-xs font-medium">Interview Podcast</p>
              <p className="text-[10px] text-muted-foreground">
                {podcastScript ? `${podcastScript.length} segments` : "Ready to play"}
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="text-[10px] h-6 px-2"
              onClick={() => setShowScript(!showScript)}
            >
              {showScript ? "Hide" : "Script"}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => {
                if (audioRef.current) {
                  audioRef.current.pause();
                  setIsPlaying(false);
                }
                if (podcastAudioUrl) URL.revokeObjectURL(podcastAudioUrl);
                setPodcastAudioUrl(null);
                setPodcastScript(null);
                setShowScript(false);
              }}
            >
              <X className="w-3 h-3" />
            </Button>
          </div>
          <audio
            ref={audioRef}
            src={podcastAudioUrl}
            onEnded={() => setIsPlaying(false)}
            onPause={() => setIsPlaying(false)}
            onPlay={() => setIsPlaying(true)}
            controls
            className="w-full h-8"
          />
          {/* Script display */}
          {showScript && podcastScript && (
            <div className="max-h-40 overflow-y-auto space-y-1.5 pt-1">
              {podcastScript.map((seg, i) => (
                <div key={i} className="text-xs leading-relaxed">
                  <span className={`font-semibold ${seg.speaker === "alex" ? "text-violet-600 dark:text-violet-400" : "text-amber-600 dark:text-amber-400"}`}>
                    {seg.speaker === "alex" ? "Alex" : "Jordan"}:
                  </span>{" "}
                  <span className="text-muted-foreground">{seg.text}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Podcast generating indicator ── */}
      {podcastMutation.isPending && (
        <div className="px-3 py-3 border-b bg-gradient-to-r from-violet-50/50 to-fuchsia-50/50 dark:from-violet-950/20 dark:to-fuchsia-950/20 shrink-0">
          <div className="flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-violet-500" />
            <div>
              <p className="text-xs font-medium text-violet-600 dark:text-violet-400">Generating podcast...</p>
              <p className="text-[10px] text-muted-foreground">Writing script and producing audio — this may take a minute</p>
            </div>
          </div>
        </div>
      )}

      {/* ── Q&A Thread ── */}
      <ScrollArea className="flex-1">
        <div className="p-3 space-y-3" ref={scrollRef}>
          {/* Previous entries */}
          {entries.map((entry) => (
            <div key={entry.id} className="space-y-1.5">
              {/* Question */}
              <div className="flex justify-start">
                <div className="max-w-[90%] bg-card border rounded-lg rounded-bl-sm p-2.5">
                  <div className="flex items-center gap-1.5 mb-1">
                    <MessageCircleQuestion className="w-3 h-3 text-primary" />
                    <Badge variant="outline" className="text-[10px] h-4">{entry.topic}</Badge>
                  </div>
                  <p className="text-sm leading-relaxed">{entry.question}</p>
                </div>
              </div>
              {/* Answer */}
              <div className="flex justify-end">
                <div className="max-w-[85%] bg-primary/10 border border-primary/20 rounded-lg rounded-br-sm p-2.5">
                  <p className="text-sm leading-relaxed">{entry.answer}</p>
                </div>
              </div>
            </div>
          ))}

          {/* Loading indicator for next question */}
          {questionMutation.isPending && (
            <div className="flex justify-start">
              <div className="bg-card border rounded-lg rounded-bl-sm p-3 flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                <span className="text-xs text-muted-foreground">Thinking of the next question...</span>
              </div>
            </div>
          )}

          {/* Current question with answer input */}
          {currentQuestion && !questionMutation.isPending && (
            <div className="space-y-2">
              {/* Question bubble */}
              <div className="flex justify-start">
                <div className="max-w-[90%] bg-card border border-primary/30 rounded-lg rounded-bl-sm p-2.5">
                  <div className="flex items-center gap-1.5 mb-1">
                    <MessageCircleQuestion className="w-3 h-3 text-primary" />
                    {currentTopic && (
                      <Badge className="text-[10px] h-4">{currentTopic}</Badge>
                    )}
                    <div className="flex items-center gap-0.5 ml-auto">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="gap-1 text-xs h-5 px-1.5 text-muted-foreground"
                            onClick={handleSkip}
                          >
                            <SkipForward className="w-3 h-3" />
                            Skip
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Skip this question</TooltipContent>
                      </Tooltip>
                    </div>
                  </div>
                  <p className="text-sm font-medium leading-relaxed">{currentQuestion}</p>
                </div>
              </div>

              {/* Answer input */}
              <div className="pl-4">
                <ProvokeText
                  chrome="inline"
                  placeholder="Type your answer or use the mic..."
                  value={answerText}
                  onChange={setAnswerText}
                  className="text-sm"
                  minRows={2}
                  maxRows={6}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSubmitAnswer();
                    }
                  }}
                  voice={{ mode: "replace" }}
                  onVoiceTranscript={handleVoiceAnswer}
                  onRecordingChange={setIsRecordingAnswer}
                  onSubmit={handleSubmitAnswer}
                  submitIcon={Send}
                />
                {isRecordingAnswer && (
                  <div className="flex items-center gap-1.5 text-xs text-primary animate-pulse mt-1">
                    <Mic className="w-3 h-3" />
                    Listening...
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Interview ended state */}
          {!isActive && entries.length > 0 && !currentQuestion && !questionMutation.isPending && (
            <div className="flex justify-center pt-2">
              <div className="text-center space-y-2 bg-muted/30 rounded-lg p-3">
                <p className="text-xs text-muted-foreground">
                  Interview paused — {entries.length} questions answered
                </p>
                <div className="flex items-center gap-2 justify-center">
                  <Button size="sm" variant="outline" className="text-xs h-7 gap-1" onClick={handleStart}>
                    <Play className="w-3 h-3" />
                    Continue
                  </Button>
                  {entries.length >= 3 && (
                    <Button size="sm" variant="outline" className="text-xs h-7 gap-1" onClick={handleGeneratePodcast} disabled={podcastMutation.isPending}>
                      <Podcast className="w-3 h-3" />
                      Podcast
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
