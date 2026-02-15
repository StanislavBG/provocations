import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ProvokeText } from "./ProvokeText";
import {
  MessageCircleQuestion,
  Square,
  Send,
  Loader2,
  CheckCircle2,
  Mic,
} from "lucide-react";
import type { InterviewEntry, DirectionMode } from "@shared/schema";

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
}

export function InterviewPanel({
  isActive,
  entries,
  currentQuestion,
  currentTopic,
  isLoadingQuestion,
  isMerging,
  directionMode,
  onAnswer,
  onEnd,
}: InterviewPanelProps) {
  const [answerText, setAnswerText] = useState("");
  const [isRecordingAnswer, setIsRecordingAnswer] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(true);

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
      {/* Session controls bar */}
      <div className="flex items-center gap-2 px-4 py-2 border-b bg-muted/10 shrink-0">
        {directionMode && (
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
        )}
        <Badge variant="outline" className="ml-auto text-xs">
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
          {/* Onboarding hint — visible until user engages with the answer field */}
          {entries.length === 0 && showOnboarding && !answerText && (
            <div className="bg-primary/5 border border-primary/10 rounded-lg p-3 space-y-1.5">
              <p className="text-xs font-medium text-primary">How this works</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                The AI will ask you thought-provoking questions based on your selected personas.
                Answer each one using the text field below or record your response with the mic button.
                Each answer deepens your document. When you're ready, use <strong>Merge to Draft</strong> in the header to integrate your responses.
              </p>
            </div>
          )}

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
