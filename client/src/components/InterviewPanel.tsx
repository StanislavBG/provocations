import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ProvokeText } from "./ProvokeText";
import {
  MessageCircleQuestion,
  Play,
  Square,
  Send,
  Loader2,
  CheckCircle2,
  Mic,
  Crosshair,
  ShieldAlert,
  Lightbulb,
  Blocks,
  ShieldCheck,
  Palette,
  BookText,
  Briefcase,
  Lock,
  Rocket,
} from "lucide-react";
import type { InterviewEntry, ProvocationType, DirectionMode, ThinkBigVector } from "@shared/schema";

// ── Persona metadata (shared with ProvocationsDisplay) ──

const personaIcons: Record<ProvocationType, typeof Blocks> = {
  architect: Blocks,
  quality_engineer: ShieldCheck,
  ux_designer: Palette,
  tech_writer: BookText,
  product_manager: Briefcase,
  security_engineer: Lock,
  thinking_bigger: Rocket,
};

const personaColors: Record<ProvocationType, string> = {
  architect: "text-cyan-600 dark:text-cyan-400",
  quality_engineer: "text-rose-600 dark:text-rose-400",
  ux_designer: "text-fuchsia-600 dark:text-fuchsia-400",
  tech_writer: "text-amber-600 dark:text-amber-400",
  product_manager: "text-blue-600 dark:text-blue-400",
  security_engineer: "text-red-600 dark:text-red-400",
  thinking_bigger: "text-orange-600 dark:text-orange-400",
};

const personaLabels: Record<ProvocationType, string> = {
  architect: "Architect",
  quality_engineer: "QA Engineer",
  ux_designer: "UX Designer",
  tech_writer: "Tech Writer",
  product_manager: "Product Manager",
  security_engineer: "Security",
  thinking_bigger: "Think Big",
};

const personaDescriptions: Record<ProvocationType, string> = {
  architect: "System design, boundaries, API contracts, and data flow",
  quality_engineer: "Testing gaps, edge cases, error handling, and reliability",
  ux_designer: "User flows, discoverability, accessibility, and error states",
  tech_writer: "Documentation, naming, and UI copy clarity",
  product_manager: "Business value, user stories, and prioritization",
  security_engineer: "Data privacy, authentication, authorization, and compliance",
  thinking_bigger: "Scale impact and outcomes without changing the core idea",
};

// Think Big vector metadata
const thinkBigVectorMeta: { id: ThinkBigVector; label: string; shortLabel: string; description: string }[] = [
  {
    id: "tenancy_topology",
    label: "Tenancy Topology",
    shortLabel: "Tenancy",
    description: "Silo vs. Pool — How you isolate data across customers.",
  },
  {
    id: "api_surface",
    label: "API Surface",
    shortLabel: "API",
    description: "Utility vs. Platform — Tool or engine that other apps plug into?",
  },
  {
    id: "scaling_horizon",
    label: "Scaling Horizon",
    shortLabel: "Scale",
    description: "Vertical vs. Horizontal — 1K complex users or 1M simple users?",
  },
  {
    id: "data_residency",
    label: "Data Residency",
    shortLabel: "Residency",
    description: "Local vs. Sovereign — Where data lives matters more than what it does.",
  },
  {
    id: "integration_philosophy",
    label: "Integration Philosophy",
    shortLabel: "Integration",
    description: "Adapter vs. Native — Build integrations or provide hooks?",
  },
  {
    id: "identity_access",
    label: "Identity & Access",
    shortLabel: "Identity",
    description: "RBAC vs. ABAC — Simple roles break at scale.",
  },
  {
    id: "observability",
    label: "Observability",
    shortLabel: "Observability",
    description: "Logs vs. Traces — Debug big problems in seconds, not hours.",
  },
];

interface InterviewPanelProps {
  isActive: boolean;
  entries: InterviewEntry[];
  currentQuestion: string | null;
  currentTopic: string | null;
  isLoadingQuestion: boolean;
  isMerging: boolean;
  onStart: (direction: { mode: DirectionMode; personas: ProvocationType[]; guidance?: string; thinkBigVectors?: ThinkBigVector[] }) => void;
  onAnswer: (answer: string) => void;
  onEnd: () => void;
}

const allPersonaTypes: ProvocationType[] = [
  "thinking_bigger",
  "architect",
  "quality_engineer",
  "ux_designer",
  "tech_writer",
  "product_manager",
  "security_engineer",
];

export function InterviewPanel({
  isActive,
  entries,
  currentQuestion,
  currentTopic,
  isLoadingQuestion,
  isMerging,
  onStart,
  onAnswer,
  onEnd,
}: InterviewPanelProps) {
  const [answerText, setAnswerText] = useState("");
  const [isRecordingAnswer, setIsRecordingAnswer] = useState(false);

  // Direction state
  const [directionMode, setDirectionMode] = useState<DirectionMode>("challenge");
  const [selectedPersonas, setSelectedPersonas] = useState<Set<ProvocationType>>(
    () => new Set<ProvocationType>()
  );
  const [selectedVectors, setSelectedVectors] = useState<Set<ThinkBigVector>>(
    () => new Set<ThinkBigVector>()
  );
  const [guidance, setGuidance] = useState("");
  const [isRecordingGuidance, setIsRecordingGuidance] = useState(false);

  const handleSubmitAnswer = () => {
    if (answerText.trim()) {
      onAnswer(answerText.trim());
      setAnswerText("");
    }
  };

  const handleVoiceAnswer = (transcript: string) => {
    if (transcript.trim()) {
      onAnswer(transcript.trim());
      setAnswerText("");
    }
  };

  const togglePersona = useCallback((type: ProvocationType) => {
    setSelectedPersonas(prev => {
      const next = new Set<ProvocationType>(prev);
      if (next.has(type)) {
        next.delete(type);
        // If deselecting Think Big, clear vectors
        if (type === "thinking_bigger") {
          setSelectedVectors(new Set<ThinkBigVector>());
        }
      } else {
        next.add(type);
      }
      return next;
    });
  }, []);

  const toggleVector = useCallback((vector: ThinkBigVector) => {
    setSelectedVectors(prev => {
      const next = new Set<ThinkBigVector>(prev);
      if (next.has(vector)) {
        next.delete(vector);
      } else {
        next.add(vector);
      }
      return next;
    });
  }, []);

  const handleStartInterview = useCallback(() => {
    onStart({
      mode: directionMode,
      personas: Array.from(selectedPersonas),
      guidance: guidance.trim() || undefined,
      thinkBigVectors: selectedVectors.size > 0 ? Array.from(selectedVectors) : undefined,
    });
  }, [directionMode, selectedPersonas, selectedVectors, guidance, onStart]);

  // Not active - show direction setup and start button
  if (!isActive) {
    return (
      <div className="h-full flex flex-col">
        {/* Direction setup */}
        <div className="border-b bg-muted/20 p-4 space-y-4">
          {/* Direction mode: Challenge / Advise */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Direction
            </label>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant={directionMode === "challenge" ? "default" : "outline"}
                className={`gap-1.5 flex-1 ${
                  directionMode === "challenge"
                    ? "bg-violet-600 hover:bg-violet-700 text-white"
                    : "hover:bg-violet-50 dark:hover:bg-violet-950/20 hover:text-violet-700 dark:hover:text-violet-400 hover:border-violet-300 dark:hover:border-violet-700"
                }`}
                onClick={() => setDirectionMode("challenge")}
              >
                <ShieldAlert className="w-4 h-4" />
                Challenge
              </Button>
              <Button
                size="sm"
                variant={directionMode === "advise" ? "default" : "outline"}
                className={`gap-1.5 flex-1 ${
                  directionMode === "advise"
                    ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                    : "hover:bg-emerald-50 dark:hover:bg-emerald-950/20 hover:text-emerald-700 dark:hover:text-emerald-400 hover:border-emerald-300 dark:hover:border-emerald-700"
                }`}
                onClick={() => setDirectionMode("advise")}
              >
                <Lightbulb className="w-4 h-4" />
                Advise
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {directionMode === "challenge"
                ? "Push back on assumptions, probe weaknesses, demand better answers."
                : "Suggest improvements, recommend approaches, offer constructive guidance."}
            </p>
          </div>

          {/* Persona toggles */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Personas
            </label>
            <div className="flex items-center gap-1 flex-wrap">
              {allPersonaTypes.map((type) => {
                const Icon = personaIcons[type];
                const isSelected = selectedPersonas.has(type);
                const isThinkBig = type === "thinking_bigger";
                return (
                  <Tooltip key={type}>
                    <TooltipTrigger asChild>
                      <Button
                        size="sm"
                        variant={isSelected ? "default" : "outline"}
                        className={`gap-1 text-xs h-7 px-2 ${
                          isSelected
                            ? isThinkBig
                              ? "bg-orange-600 hover:bg-orange-700 text-white"
                              : ""
                            : "opacity-50"
                        } ${isThinkBig && !isSelected ? "border-orange-300 dark:border-orange-700" : ""}`}
                        onClick={() => togglePersona(type)}
                      >
                        <Icon className="w-3 h-3" />
                        {personaLabels[type]}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="max-w-xs">
                      <p className="text-xs">{personaDescriptions[type]}</p>
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>

            {/* Think Big vectors — show when Think Big persona is selected */}
            {selectedPersonas.has("thinking_bigger") && (
              <div className="mt-2 p-3 rounded-lg border border-orange-200 dark:border-orange-800/50 bg-orange-50/50 dark:bg-orange-950/20 space-y-2">
                <label className="text-xs font-medium text-orange-700 dark:text-orange-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Rocket className="w-3 h-3" />
                  Think Big Vectors
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  {thinkBigVectorMeta.map((vec) => {
                    const isVecSelected = selectedVectors.has(vec.id);
                    return (
                      <Tooltip key={vec.id}>
                        <TooltipTrigger asChild>
                          <Button
                            size="sm"
                            variant={isVecSelected ? "default" : "outline"}
                            className={`gap-1 text-xs h-auto py-1.5 px-2 justify-start ${
                              isVecSelected
                                ? "bg-orange-600 hover:bg-orange-700 text-white"
                                : "opacity-60 hover:opacity-100 border-orange-200 dark:border-orange-800/50"
                            }`}
                            onClick={() => toggleVector(vec.id)}
                          >
                            {vec.shortLabel}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="max-w-xs">
                          <p className="text-xs font-medium">{vec.label}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{vec.description}</p>
                        </TooltipContent>
                      </Tooltip>
                    );
                  })}
                </div>
                <p className="text-xs text-orange-600/70 dark:text-orange-400/60">
                  {selectedVectors.size === 0
                    ? "Select vectors to focus Think Big questions, or leave empty for general scaling."
                    : `${selectedVectors.size} vector${selectedVectors.size > 1 ? "s" : ""} selected`}
                </p>
              </div>
            )}

            <p className="text-xs text-muted-foreground">
              {selectedPersonas.size === 0
                ? "Select personas to focus the interview, or leave empty for general questions."
                : `${selectedPersonas.size} persona${selectedPersonas.size > 1 ? "s" : ""} selected`}
            </p>
          </div>

          {/* Optional guidance text */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Crosshair className="w-4 h-4 text-muted-foreground" />
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Focus (optional)
              </label>
            </div>
            <ProvokeText
              chrome="inline"
              placeholder={
                directionMode === "challenge"
                  ? "e.g. 'Push me on pricing strategy'"
                  : "e.g. 'Help me strengthen my competitive analysis'"
              }
              value={guidance}
              onChange={setGuidance}
              className="text-sm"
              minRows={2}
              maxRows={4}
              voice={{ mode: "replace" }}
              onVoiceTranscript={(transcript) => setGuidance(transcript)}
              onRecordingChange={setIsRecordingGuidance}
            />
            {isRecordingGuidance && (
              <p className="text-xs text-primary animate-pulse">Listening... describe the direction for your interview</p>
            )}
          </div>
        </div>

        {/* Start button */}
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center space-y-4 max-w-sm">
            <MessageCircleQuestion className="w-12 h-12 text-muted-foreground/50 mx-auto" />
            <h3 className="font-medium text-muted-foreground">Interview Style Provocation</h3>
            <p className="text-sm text-muted-foreground">
              {directionMode === "challenge"
                ? "Start an AI interview that challenges your document from selected persona perspectives."
                : "Start an AI interview that advises improvements from selected persona perspectives."}
              {" "}Your answers will be merged into the document when you end the session.
            </p>
            {entries.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Previous session: {entries.length} questions answered
              </p>
            )}
            <Button onClick={handleStartInterview} className="gap-2" disabled={isMerging}>
              {isMerging ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Merging into document...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  {entries.length > 0 ? "Resume Interview" : "Start Interview"}
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Active interview session
  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 p-4 border-b">
        <MessageCircleQuestion className="w-5 h-5 text-primary" />
        <h3 className="font-semibold">Provoke</h3>
        <Badge
          variant="outline"
          className={`text-xs ${
            directionMode === "challenge"
              ? "border-violet-300 dark:border-violet-700 text-violet-700 dark:text-violet-400"
              : "border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-400"
          }`}
        >
          {directionMode === "challenge" ? "Challenge" : "Advise"}
        </Badge>
        <Badge variant="outline" className="ml-auto">
          {entries.length} answered
        </Badge>
        <Button
          variant="destructive"
          size="sm"
          onClick={onEnd}
          disabled={entries.length === 0 || isMerging}
          className="gap-1.5"
        >
          {isMerging ? (
            <>
              <Loader2 className="w-3 h-3 animate-spin" />
              Merging...
            </>
          ) : (
            <>
              <Square className="w-3 h-3" />
              End & Merge
            </>
          )}
        </Button>
      </div>

      {/* Current question on top, answered history below */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-3">
          {/* Current question — always at top */}
          {isLoadingQuestion && (
            <Card className="border-primary/30">
              <CardContent className="p-4 flex items-center gap-3">
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                <span className="text-sm text-muted-foreground">Thinking of the next question...</span>
              </CardContent>
            </Card>
          )}

          {currentQuestion && !isLoadingQuestion && (
            <Card className="border-primary/30">
              <CardHeader className="p-3 pb-1">
                <CardTitle className="text-sm flex items-center gap-2">
                  {currentTopic && <Badge className="text-xs">{currentTopic}</Badge>}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 pt-0 space-y-3">
                <p className="text-sm font-medium leading-relaxed">{currentQuestion}</p>

                {/* Answer input */}
                <div className="space-y-2">
                  <ProvokeText
                    chrome="inline"
                    placeholder="Type your answer or use the mic..."
                    value={answerText}
                    onChange={setAnswerText}
                    className="text-sm"
                    minRows={2}
                    maxRows={8}
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
                    <div className="flex items-center gap-2 text-xs text-primary animate-pulse">
                      <Mic className="w-3 h-3" />
                      Listening... speak your answer
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Q&A History — newest first, pushed to bottom */}
          {[...entries].reverse().map((entry) => (
            <Card key={entry.id} className="opacity-80">
              <CardHeader className="p-3 pb-1">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">{entry.topic}</Badge>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 ml-auto" />
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 pt-0 space-y-2">
                <p className="text-sm font-medium">{entry.question}</p>
                <p className="text-sm text-muted-foreground bg-muted/50 rounded p-2">
                  {entry.answer}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
