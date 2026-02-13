import { useState, useCallback, useRef, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ProvokeText } from "./ProvokeText";
import {
  MessageCircleQuestion,
  Send,
  Loader2,
  ListChecks,
  Check,
  Pencil,
  Mic,
  Globe,
} from "lucide-react";
import type {
  StreamingDialogueEntry,
  StreamingRequirement,
} from "@shared/schema";

interface StreamingDialogueProps {
  entries: StreamingDialogueEntry[];
  requirements: StreamingRequirement[];
  currentQuestion: string | null;
  currentTopic: string | null;
  isLoadingQuestion: boolean;
  isRefining: boolean;
  onAnswer: (answer: string) => void;
  onStart: () => void;
  onRefineRequirements: () => void;
  onUpdateRequirement: (id: string, text: string) => void;
  onConfirmRequirement: (id: string) => void;
  isActive: boolean;
  hasAnalysis?: boolean;
}

export function StreamingDialogue({
  entries,
  requirements,
  currentQuestion,
  currentTopic,
  isLoadingQuestion,
  isRefining,
  onAnswer,
  onStart,
  onRefineRequirements,
  onUpdateRequirement,
  onConfirmRequirement,
  isActive,
  hasAnalysis,
}: StreamingDialogueProps) {
  const [answerText, setAnswerText] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [showRequirements, setShowRequirements] = useState(false);
  const [editingReqId, setEditingReqId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new entries arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [entries.length, currentQuestion]);

  const handleSubmitAnswer = useCallback(() => {
    if (answerText.trim()) {
      onAnswer(answerText.trim());
      setAnswerText("");
    }
  }, [answerText, onAnswer]);

  const handleVoiceAnswer = useCallback((transcript: string) => {
    if (transcript.trim()) {
      onAnswer(transcript.trim());
      setAnswerText("");
    }
  }, [onAnswer]);

  const handleStartEditReq = useCallback((req: StreamingRequirement) => {
    setEditingReqId(req.id);
    setEditingText(req.text);
  }, []);

  const handleSaveEditReq = useCallback(() => {
    if (editingReqId && editingText.trim()) {
      onUpdateRequirement(editingReqId, editingText.trim());
      setEditingReqId(null);
      setEditingText("");
    }
  }, [editingReqId, editingText, onUpdateRequirement]);

  // Not started yet — show guidance
  if (!isActive) {
    return (
      <div className="h-full flex flex-col">
        <div className="flex items-center gap-2 px-4 py-3 border-b bg-muted/20">
          <MessageCircleQuestion className="w-4 h-4 text-violet-600 dark:text-violet-400" />
          <h3 className="font-semibold text-sm">Requirement Dialogue</h3>
        </div>
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center space-y-4 max-w-sm">
            <MessageCircleQuestion className="w-12 h-12 text-muted-foreground/50 mx-auto" />
            <h3 className="font-medium text-muted-foreground">Waiting for Website Analysis</h3>
            <p className="text-sm text-muted-foreground">
              Use the Website Analysis panel on the left to enter a URL, describe the website,
              and click <strong>Analyze Website</strong>. The agent will review the site and
              start asking you questions here.
            </p>
            <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground pt-2">
              <Globe className="w-3.5 h-3.5" />
              <span>Analyze the website first, then respond here</span>
            </div>
            <div className="pt-2 border-t">
              <p className="text-xs text-muted-foreground mb-2">
                Or start a dialogue without a website:
              </p>
              <Button variant="outline" size="sm" onClick={onStart} className="gap-2">
                <MessageCircleQuestion className="w-3.5 h-3.5" />
                Start Dialogue Manually
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b bg-muted/20">
        <MessageCircleQuestion className="w-4 h-4 text-violet-600 dark:text-violet-400" />
        <h3 className="font-semibold text-sm">Requirement Dialogue</h3>
        {entries.length > 0 && (
          <Badge variant="outline" className="ml-auto text-xs">
            {entries.filter(e => e.role === "user").length} responses
          </Badge>
        )}
        <Button
          variant={showRequirements ? "default" : "outline"}
          size="sm"
          className="gap-1.5 text-xs h-7"
          onClick={() => setShowRequirements(!showRequirements)}
        >
          <ListChecks className="w-3 h-3" />
          Requirements ({requirements.length})
        </Button>
      </div>

      {/* Requirements panel (toggled) */}
      {showRequirements && (
        <div className="border-b bg-muted/10 max-h-[40%] overflow-auto">
          <div className="p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Extracted Requirements
              </span>
              <Button
                size="sm"
                variant="outline"
                className="gap-1 text-xs h-6"
                onClick={onRefineRequirements}
                disabled={isRefining || entries.length === 0}
              >
                {isRefining ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <ListChecks className="w-3 h-3" />
                )}
                {isRefining ? "Refining..." : "Refine All"}
              </Button>
            </div>

            {requirements.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-2">
                No requirements extracted yet. Continue the dialogue and click "Refine All".
              </p>
            ) : (
              <div className="space-y-1.5">
                {requirements.map((req, idx) => (
                  <div
                    key={req.id}
                    className={`flex items-start gap-2 p-2 rounded-md border text-sm ${
                      req.status === "confirmed"
                        ? "border-emerald-300 dark:border-emerald-700 bg-emerald-50/50 dark:bg-emerald-950/20"
                        : "border-border"
                    }`}
                  >
                    <span className="text-xs font-mono text-muted-foreground shrink-0 mt-0.5">
                      {idx + 1}.
                    </span>
                    {editingReqId === req.id ? (
                      <div className="flex-1 space-y-1">
                        <textarea
                          value={editingText}
                          onChange={(e) => setEditingText(e.target.value)}
                          className="w-full text-sm p-1.5 border rounded bg-background resize-none"
                          rows={2}
                        />
                        <div className="flex gap-1">
                          <Button size="sm" className="h-6 text-xs gap-1" onClick={handleSaveEditReq}>
                            <Check className="w-3 h-3" /> Save
                          </Button>
                          <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => setEditingReqId(null)}>
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <p className="flex-1 leading-relaxed">{req.text}</p>
                        <div className="flex items-center gap-1 shrink-0">
                          <Badge
                            variant={req.status === "confirmed" ? "default" : "outline"}
                            className="text-[10px] h-5"
                          >
                            {req.status}
                          </Badge>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6"
                            onClick={() => handleStartEditReq(req)}
                          >
                            <Pencil className="w-3 h-3" />
                          </Button>
                          {req.status !== "confirmed" && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6 text-emerald-600"
                              onClick={() => onConfirmRequirement(req.id)}
                            >
                              <Check className="w-3 h-3" />
                            </Button>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Dialogue messages */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-3">
          {entries.map((entry) => (
            <div
              key={entry.id}
              className={`text-sm ${
                entry.role === "agent" ? "" : "pl-4"
              }`}
            >
              {entry.role === "agent" ? (
                <Card className="border-violet-200 dark:border-violet-800">
                  <CardContent className="p-3">
                    <div className="flex items-center gap-1.5 mb-1">
                      <MessageCircleQuestion className="w-3 h-3 text-violet-600 dark:text-violet-400" />
                      <span className="text-xs font-medium text-violet-600 dark:text-violet-400">Agent</span>
                    </div>
                    <p className="leading-relaxed whitespace-pre-line">{entry.content}</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="bg-primary/5 rounded-md p-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-xs font-medium text-muted-foreground">You</span>
                  </div>
                  <p className="leading-relaxed">{entry.content}</p>
                </div>
              )}
            </div>
          ))}

          {/* Loading indicator */}
          {isLoadingQuestion && (
            <Card className="border-violet-200 dark:border-violet-800">
              <CardContent className="p-3 flex items-center gap-3">
                <Loader2 className="w-4 h-4 animate-spin text-violet-600 dark:text-violet-400" />
                <span className="text-sm text-muted-foreground">Thinking of the next question...</span>
              </CardContent>
            </Card>
          )}

          {/* Current question highlight (only show if it differs from the last entry to avoid duplication) */}
          {currentQuestion && !isLoadingQuestion && entries.length > 0 && entries[entries.length - 1]?.content !== currentQuestion && (
            <Card className="border-violet-200 dark:border-violet-800 ring-1 ring-violet-200 dark:ring-violet-800">
              <CardContent className="p-3 space-y-3">
                <div className="flex items-center gap-1.5">
                  <MessageCircleQuestion className="w-3 h-3 text-violet-600 dark:text-violet-400" />
                  <span className="text-xs font-medium text-violet-600 dark:text-violet-400">Agent</span>
                  {currentTopic && (
                    <Badge variant="outline" className="text-[10px] ml-auto">{currentTopic}</Badge>
                  )}
                </div>
                <p className="text-sm font-medium leading-relaxed whitespace-pre-line">{currentQuestion}</p>
              </CardContent>
            </Card>
          )}

          <div ref={scrollRef} />
        </div>
      </ScrollArea>

      {/* Answer input */}
      {isActive && (
        <div className="p-3 border-t">
          <div className="space-y-2">
            <ProvokeText
              chrome="inline"
              placeholder={currentQuestion ? "Type your response..." : "Waiting for agent..."}
              value={answerText}
              onChange={setAnswerText}
              className="text-sm"
              minRows={2}
              maxRows={6}
              disabled={!currentQuestion || isLoadingQuestion}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmitAnswer();
                }
              }}
              voice={{ mode: "replace" }}
              onVoiceTranscript={handleVoiceAnswer}
              onRecordingChange={setIsRecording}
              onSubmit={handleSubmitAnswer}
              submitIcon={Send}
            />
            {isRecording && (
              <div className="flex items-center gap-2 text-xs text-primary animate-pulse">
                <Mic className="w-3 h-3" />
                Listening... speak your answer
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
