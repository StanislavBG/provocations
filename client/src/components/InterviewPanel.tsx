import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ProvokeText } from "./ProvokeText";
import {
  MessageCircleQuestion,
  Square,
  Send,
  Loader2,
  CheckCircle2,
  Mic,
  Lightbulb,
  SkipForward,
  Check,
  X,
  MessageSquare,
  Users,
  ChevronDown,
  ChevronUp,
  ArrowRightToLine,
  Reply,
} from "lucide-react";
import { builtInPersonas } from "@shared/personas";
import type {
  InterviewEntry,
  DirectionMode,
  DiscussionMessage,
  PersonaPerspective,
} from "@shared/schema";

interface InterviewPanelProps {
  isActive: boolean;
  entries: InterviewEntry[];
  currentQuestion: string | null;
  currentTopic: string | null;
  isLoadingQuestion: boolean;
  isMerging: boolean;
  directionMode?: DirectionMode;
  onAnswer: (answer: string) => void;
  onEnd: () => void;
  // New: advice and dismiss
  onViewAdvice?: (question: string, topic: string) => void;
  onDismissQuestion?: () => void;
  adviceText?: string | null;
  isLoadingAdvice?: boolean;
  // New: ask question
  onAskQuestion?: (question: string) => void;
  isLoadingAskResponse?: boolean;
  // New: discussion messages (combines interview + user questions)
  discussionMessages?: DiscussionMessage[];
  onAcceptResponse?: (messageId: string) => void;
  onDismissResponse?: (messageId: string) => void;
  onRespondToMessage?: (messageId: string, response: string) => void;
}

// Persona color lookup
function getPersonaColor(personaId: string): string {
  const persona = builtInPersonas[personaId as keyof typeof builtInPersonas];
  return persona?.color?.text || "text-muted-foreground";
}

function getPersonaBg(personaId: string): string {
  const persona = builtInPersonas[personaId as keyof typeof builtInPersonas];
  return persona?.color?.bg || "bg-muted/50";
}

function getPersonaLabel(personaId: string): string {
  const persona = builtInPersonas[personaId as keyof typeof builtInPersonas];
  return persona?.label || personaId;
}

export function InterviewPanel({
  isActive,
  entries,
  currentQuestion,
  currentTopic,
  isLoadingQuestion,
  isMerging,
  onAnswer,
  onEnd,
  onViewAdvice,
  onDismissQuestion,
  adviceText,
  isLoadingAdvice,
  onAskQuestion,
  isLoadingAskResponse,
  discussionMessages = [],
  onAcceptResponse,
  onDismissResponse,
  onRespondToMessage,
}: InterviewPanelProps) {
  const [answerText, setAnswerText] = useState("");
  const [isRecordingAnswer, setIsRecordingAnswer] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(true);
  const [showAdvice, setShowAdvice] = useState(false);
  const [editableAdvice, setEditableAdvice] = useState(adviceText || "");
  const [askQuestionText, setAskQuestionText] = useState("");
  const [respondingToId, setRespondingToId] = useState<string | null>(null);
  const [respondText, setRespondText] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  // Sync editable advice when new advice arrives from the API
  useEffect(() => {
    if (adviceText) setEditableAdvice(adviceText);
  }, [adviceText]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [discussionMessages.length, currentQuestion]);

  const handleSubmitAnswer = () => {
    if (answerText.trim()) {
      onAnswer(answerText.trim());
      setAnswerText("");
      setShowAdvice(false);
    }
  };

  const handleVoiceAnswer = (transcript: string) => {
    if (transcript.trim()) {
      onAnswer(transcript.trim());
      setAnswerText("");
      setShowAdvice(false);
    }
  };

  const handleViewAdvice = () => {
    if (currentQuestion && currentTopic && onViewAdvice) {
      setShowAdvice(true);
      onViewAdvice(currentQuestion, currentTopic);
    }
  };

  const handleDismiss = () => {
    setShowAdvice(false);
    onDismissQuestion?.();
  };

  const handleAskQuestion = () => {
    if (askQuestionText.trim() && onAskQuestion) {
      onAskQuestion(askQuestionText.trim());
      setAskQuestionText("");
    }
  };

  const handleRespondToMessage = (messageId: string) => {
    if (respondText.trim() && onRespondToMessage) {
      onRespondToMessage(messageId, respondText.trim());
      setRespondText("");
      setRespondingToId(null);
    }
  };

  // Not active — guide user through getting started
  if (!isActive) {
    return (
      <div className="h-full flex items-center justify-center p-8">
        <div className="text-center space-y-4 max-w-md">
          <MessageCircleQuestion className="w-12 h-12 text-primary/30 mx-auto" />
          <div className="space-y-2">
            <h3 className="text-base font-semibold">Your AI Interview</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              This panel hosts a structured conversation between you and expert AI personas.
              Each persona brings a unique professional lens — challenging your assumptions,
              spotting gaps, and pushing you to think deeper about your document.
            </p>
            <p className="text-xs text-muted-foreground/80 leading-relaxed">
              Select one or more personas in the <strong>Toolbox</strong> panel on the left,
              then click <strong>Start Interview</strong>. Answer each question using text or
              voice — your responses will be merged into the document when you're ready.
            </p>
          </div>
          {entries.length > 0 && (
            <p className="text-xs text-muted-foreground border-t pt-3">
              Previous session: {entries.length} questions answered
            </p>
          )}
        </div>
      </div>
    );
  }

  // Active interview session — Q&A conversation
  return (
    <div className="h-full flex flex-col">
      {/* Conversation thread */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-3" ref={scrollRef}>
          {/* Onboarding hint — visible until user engages */}
          {entries.length === 0 && discussionMessages.length === 0 && showOnboarding && !answerText && (
            <div className="bg-primary/5 border border-primary/10 rounded-lg p-3 space-y-1.5">
              <p className="text-xs font-medium text-primary">How this works</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                The AI will ask you thought-provoking questions based on your selected personas.
                Answer each one using the text field or mic. You can also <strong>view advice</strong> for
                guidance, <strong>skip</strong> questions, or <strong>ask your own questions</strong> to the team.
                Use <strong>Merge to Draft</strong> to integrate responses into your document.
              </p>
            </div>
          )}

          {/* Ask the team — above agent questions */}
          {onAskQuestion && (
            <div className="rounded-lg border bg-blue-50/30 dark:bg-blue-950/10 border-blue-200/50 dark:border-blue-800/30 p-3 space-y-2">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-3.5 h-3.5 text-blue-500" />
                <span className="text-xs font-medium text-blue-600 dark:text-blue-400">Ask the team</span>
              </div>
              <ProvokeText
                chrome="inline"
                variant="input"
                placeholder="Ask a question to the persona team..."
                value={askQuestionText}
                onChange={setAskQuestionText}
                className="text-sm"
                disabled={isLoadingAskResponse}
                showCopy={false}
                showClear={false}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleAskQuestion();
                  }
                }}
                voice={{ mode: "replace" }}
                onVoiceTranscript={(transcript) => {
                  setAskQuestionText(transcript);
                  if (transcript.trim() && onAskQuestion) {
                    onAskQuestion(transcript.trim());
                    setAskQuestionText("");
                  }
                }}
                onSubmit={handleAskQuestion}
                submitIcon={isLoadingAskResponse ? Loader2 : Send}
              />
              {isLoadingAskResponse && (
                <div className="flex items-center gap-2 text-xs text-blue-500 animate-pulse">
                  <Users className="w-3 h-3" />
                  Consulting the team...
                </div>
              )}
            </div>
          )}

          {/* Discussion messages history (chronological) */}
          {discussionMessages.map((msg) => (
            <DiscussionBubble
              key={msg.id}
              message={msg}
              onAccept={onAcceptResponse}
              onDismiss={onDismissResponse}
              respondingToId={respondingToId}
              onStartRespond={(id) => setRespondingToId(id)}
              onCancelRespond={() => { setRespondingToId(null); setRespondText(""); }}
              respondText={respondText}
              onRespondTextChange={setRespondText}
              onSubmitRespond={handleRespondToMessage}
            />
          ))}

          {/* Current question — always at bottom of thread */}
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
                  <div className="flex items-center gap-1 ml-auto">
                    {/* View Advice button */}
                    {onViewAdvice && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="gap-1 text-xs h-6 px-2"
                            onClick={handleViewAdvice}
                            disabled={isLoadingAdvice}
                          >
                            {isLoadingAdvice ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <Lightbulb className="w-3 h-3" />
                            )}
                            Advice
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">
                          <p className="text-xs">Get advice from this persona on how to address this</p>
                        </TooltipContent>
                      </Tooltip>
                    )}
                    {/* Skip/Dismiss button */}
                    {onDismissQuestion && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="gap-1 text-xs h-6 px-2 text-muted-foreground"
                            onClick={handleDismiss}
                          >
                            <SkipForward className="w-3 h-3" />
                            Skip
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">
                          <p className="text-xs">Skip this question and get the next one</p>
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 pt-0 space-y-3">
                <p className="text-sm font-medium leading-relaxed">{currentQuestion}</p>

                {/* Advice panel (expandable) */}
                {showAdvice && (
                  <div className="rounded-lg border border-amber-200 dark:border-amber-800/50 bg-amber-50/50 dark:bg-amber-950/20 p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <Lightbulb className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                      <span className="text-xs font-medium text-amber-700 dark:text-amber-300 uppercase tracking-wider">
                        Advice
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5 ml-auto text-muted-foreground"
                        onClick={() => setShowAdvice(false)}
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                    {isLoadingAdvice ? (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        Generating advice...
                      </div>
                    ) : adviceText ? (
                      <>
                        <ProvokeText
                          chrome="bare"
                          variant="editor"
                          value={editableAdvice}
                          onChange={setEditableAdvice}
                          className="text-sm text-amber-900 dark:text-amber-100 leading-relaxed bg-transparent"
                          minRows={2}
                          maxRows={10}
                          placeholder="Edit the advice or dictate changes..."
                          voice={{ mode: "replace" }}
                          onVoiceTranscript={(transcript) => setEditableAdvice(transcript)}
                          showCopy={false}
                          showClear={false}
                        />
                        {/* Accept advice as the answer and move to next question */}
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5 text-xs h-7 border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/30"
                          onClick={() => {
                            onAnswer(editableAdvice);
                            setAnswerText("");
                            setShowAdvice(false);
                          }}
                        >
                          <Check className="w-3 h-3" />
                          Use as my response
                        </Button>
                      </>
                    ) : null}
                  </div>
                )}

                {/* Answer input */}
                <div className="space-y-2" onFocus={() => setShowOnboarding(false)}>
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

          {/* Q&A History — newest first */}
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

// ── Discussion Bubble Component ──
// Renders a single message in the discussion thread with appropriate styling and actions.

interface DiscussionBubbleProps {
  message: DiscussionMessage;
  onAccept?: (messageId: string) => void;
  onDismiss?: (messageId: string) => void;
  respondingToId: string | null;
  onStartRespond: (messageId: string) => void;
  onCancelRespond: () => void;
  respondText: string;
  onRespondTextChange: (text: string) => void;
  onSubmitRespond: (messageId: string) => void;
}

function DiscussionBubble({
  message,
  onAccept,
  onDismiss,
  respondingToId,
  onStartRespond,
  onCancelRespond,
  respondText,
  onRespondTextChange,
  onSubmitRespond,
}: DiscussionBubbleProps) {
  const [expandedPerspectives, setExpandedPerspectives] = useState(false);
  const isResponding = respondingToId === message.id;

  // User messages (questions or answers)
  if (message.role === "user-question" || message.role === "user-answer") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] bg-primary/10 border border-primary/20 rounded-lg rounded-br-sm p-3">
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="outline" className="text-[10px] h-4">
              {message.role === "user-question" ? "Your question" : "Your answer"}
            </Badge>
            {message.topic && (
              <span className="text-[10px] text-muted-foreground">{message.topic}</span>
            )}
          </div>
          <p className="text-sm leading-relaxed">{message.content}</p>
        </div>
      </div>
    );
  }

  // System questions (from interview)
  if (message.role === "system-question") {
    return (
      <div className="flex justify-start">
        <div className="max-w-[85%] bg-card border rounded-lg rounded-bl-sm p-3">
          <div className="flex items-center gap-2 mb-1">
            <MessageCircleQuestion className="w-3 h-3 text-primary" />
            {message.topic && (
              <Badge variant="outline" className="text-[10px] h-4">{message.topic}</Badge>
            )}
          </div>
          <p className="text-sm font-medium leading-relaxed">{message.content}</p>
        </div>
      </div>
    );
  }

  // Persona response (multi-perspective)
  if (message.role === "persona-response") {
    const isDismissed = message.status === "dismissed";
    const isAccepted = message.status === "accepted";

    return (
      <div className="flex justify-start">
        <div className={`max-w-[90%] rounded-lg rounded-bl-sm p-3 space-y-2 border ${
          isDismissed
            ? "bg-muted/30 border-muted opacity-60"
            : isAccepted
            ? "bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/50"
            : "bg-blue-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800/50"
        }`}>
          {/* Header */}
          <div className="flex items-center gap-2">
            <Users className="w-3.5 h-3.5 text-blue-500" />
            <span className="text-xs font-medium text-blue-600 dark:text-blue-400">Team Response</span>
            {message.topic && (
              <Badge variant="outline" className="text-[10px] h-4">{message.topic}</Badge>
            )}
            {isAccepted && (
              <Badge className="text-[10px] h-4 bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-0">
                Merged
              </Badge>
            )}
            {isDismissed && (
              <Badge variant="outline" className="text-[10px] h-4 opacity-60">
                Dismissed
              </Badge>
            )}
          </div>

          {/* Synthesized answer */}
          <p className="text-sm leading-relaxed">{message.content}</p>

          {/* Individual perspectives (collapsible) */}
          {message.perspectives && message.perspectives.length > 0 && (
            <div>
              <button
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => setExpandedPerspectives(!expandedPerspectives)}
              >
                {expandedPerspectives ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                {expandedPerspectives ? "Hide" : "Show"} individual perspectives ({message.perspectives.length})
              </button>

              {expandedPerspectives && (
                <div className="mt-2 space-y-2">
                  {message.perspectives.map((p, idx) => (
                    <div
                      key={idx}
                      className={`rounded-md p-2 ${getPersonaBg(p.personaId)}`}
                    >
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className={`text-xs font-semibold ${getPersonaColor(p.personaId)}`}>
                          {p.personaLabel || getPersonaLabel(p.personaId)}
                        </span>
                      </div>
                      <p className="text-xs leading-relaxed">{p.content}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Action buttons (small, inline) */}
          {!isDismissed && !isAccepted && (
            <div className="flex items-center gap-1 pt-1">
              {onAccept && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-1 text-xs h-6 px-2 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10"
                      onClick={() => onAccept(message.id)}
                    >
                      <ArrowRightToLine className="w-3 h-3" />
                      Merge
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    <p className="text-xs">Accept this advice and merge it into the document</p>
                  </TooltipContent>
                </Tooltip>
              )}
              {onDismiss && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-1 text-xs h-6 px-2 text-muted-foreground hover:text-foreground"
                      onClick={() => onDismiss(message.id)}
                    >
                      <X className="w-3 h-3" />
                      Dismiss
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    <p className="text-xs">Dismiss this response</p>
                  </TooltipContent>
                </Tooltip>
              )}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1 text-xs h-6 px-2 text-blue-600 dark:text-blue-400 hover:bg-blue-500/10"
                    onClick={() => onStartRespond(message.id)}
                  >
                    <Reply className="w-3 h-3" />
                    Respond
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <p className="text-xs">Ask a follow-up about this response</p>
                </TooltipContent>
              </Tooltip>
            </div>
          )}

          {/* Inline respond input */}
          {isResponding && (
            <div className="pt-1 space-y-2">
              <ProvokeText
                chrome="inline"
                variant="input"
                placeholder="Ask a follow-up..."
                value={respondText}
                onChange={onRespondTextChange}
                className="text-sm"
                showCopy={false}
                showClear={false}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    onSubmitRespond(message.id);
                  }
                  if (e.key === "Escape") {
                    onCancelRespond();
                  }
                }}
                onSubmit={() => onSubmitRespond(message.id)}
                submitIcon={Send}
              />
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs h-5 px-1.5 text-muted-foreground"
                  onClick={onCancelRespond}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return null;
}
