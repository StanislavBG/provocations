import { useState, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AutoExpandTextarea } from "@/components/ui/auto-expand-textarea";
import { VoiceRecorder } from "@/components/VoiceRecorder";
import {
  MessageCircleQuestion,
  Mic,
  PenLine,
  Send,
  Check,
} from "lucide-react";

interface DraftQuestionsPanelProps {
  questions: string[];
  onResponse: (question: string, response: string) => void;
}

type InputMode = "voice" | "text" | null;

interface QuestionState {
  expandedIndex: number | null;
  inputMode: InputMode;
  textValue: string;
  isRecording: boolean;
  interimTranscript: string;
  responded: Set<number>;
}

export function DraftQuestionsPanel({ questions, onResponse }: DraftQuestionsPanelProps) {
  const [state, setState] = useState<QuestionState>({
    expandedIndex: null,
    inputMode: null,
    textValue: "",
    isRecording: false,
    interimTranscript: "",
    responded: new Set(),
  });

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  if (questions.length === 0) return null;

  const handleExpand = (index: number) => {
    if (state.expandedIndex === index) {
      // Collapse
      setState((prev) => ({
        ...prev,
        expandedIndex: null,
        inputMode: null,
        textValue: "",
        isRecording: false,
        interimTranscript: "",
      }));
    } else {
      setState((prev) => ({
        ...prev,
        expandedIndex: index,
        inputMode: null,
        textValue: "",
        isRecording: false,
        interimTranscript: "",
      }));
    }
  };

  const handleStartText = (e: React.MouseEvent) => {
    e.stopPropagation();
    setState((prev) => ({ ...prev, inputMode: "text", textValue: "" }));
    setTimeout(() => textareaRef.current?.focus(), 50);
  };

  const handleStartVoice = (e: React.MouseEvent) => {
    e.stopPropagation();
    setState((prev) => ({ ...prev, inputMode: "voice", interimTranscript: "" }));
  };

  const handleVoiceTranscript = (transcript: string) => {
    if (state.expandedIndex === null || !transcript.trim()) return;
    const question = questions[state.expandedIndex];
    onResponse(question, transcript.trim());
    setState((prev) => ({
      ...prev,
      inputMode: null,
      isRecording: false,
      interimTranscript: "",
      responded: new Set(prev.responded).add(prev.expandedIndex!),
      expandedIndex: null,
    }));
  };

  const handleSubmitText = () => {
    if (state.expandedIndex === null || !state.textValue.trim()) return;
    const question = questions[state.expandedIndex];
    onResponse(question, state.textValue.trim());
    setState((prev) => ({
      ...prev,
      inputMode: null,
      textValue: "",
      responded: new Set(prev.responded).add(prev.expandedIndex!),
      expandedIndex: null,
    }));
  };

  const handleCancelInput = (e: React.MouseEvent) => {
    e.stopPropagation();
    setState((prev) => ({
      ...prev,
      inputMode: null,
      textValue: "",
      isRecording: false,
      interimTranscript: "",
    }));
  };

  const handleTextKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmitText();
    }
    if (e.key === "Escape") {
      setState((prev) => ({ ...prev, inputMode: null, textValue: "" }));
    }
  };

  return (
    <div className="w-72 shrink-0 flex flex-col gap-2">
      {/* Header */}
      <div className="flex items-center gap-2">
        <MessageCircleQuestion className="w-4 h-4 text-primary" />
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Think about
        </span>
        <Badge variant="outline" className="text-[10px] ml-auto">
          {questions.length}
        </Badge>
      </div>

      {/* All question bubbles */}
      <div className="flex flex-col gap-2">
        {questions.map((question, index) => {
          const isExpanded = state.expandedIndex === index;
          const isResponded = state.responded.has(index);

          return (
            <div key={index}>
              {isExpanded ? (
                /* Expanded: orange highlight box with input controls */
                <Card className="border-primary/30 bg-primary/5 shadow-sm transition-all duration-200">
                  <CardContent className="p-3 space-y-3">
                    <button
                      onClick={() => handleExpand(index)}
                      className="w-full text-left"
                    >
                      <p className="text-sm font-medium leading-relaxed">
                        {question}
                      </p>
                    </button>

                    {/* Input area based on mode */}
                    {state.inputMode === "text" ? (
                      <div className="space-y-2">
                        <AutoExpandTextarea
                          ref={textareaRef}
                          value={state.textValue}
                          onChange={(e) =>
                            setState((prev) => ({
                              ...prev,
                              textValue: e.target.value,
                            }))
                          }
                          placeholder="Type your response..."
                          minRows={2}
                          maxRows={6}
                          className="text-sm bg-background/80"
                          onKeyDown={handleTextKeyDown}
                        />
                        <div className="flex items-center gap-1.5 justify-end">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={handleCancelInput}
                          >
                            Cancel
                          </Button>
                          <Button
                            size="sm"
                            className="h-7 text-xs gap-1"
                            onClick={handleSubmitText}
                            disabled={!state.textValue.trim()}
                          >
                            <Send className="w-3 h-3" />
                            Add to draft
                          </Button>
                        </div>
                      </div>
                    ) : state.inputMode === "voice" ? (
                      <div className="space-y-2">
                        {state.interimTranscript && (
                          <p className="text-xs text-muted-foreground italic px-1 leading-relaxed">
                            {state.interimTranscript}
                          </p>
                        )}
                        <div className="flex items-center gap-2">
                          <VoiceRecorder
                            onTranscript={handleVoiceTranscript}
                            onInterimTranscript={(interim) =>
                              setState((prev) => ({
                                ...prev,
                                interimTranscript: interim,
                              }))
                            }
                            onRecordingChange={(recording) =>
                              setState((prev) => ({
                                ...prev,
                                isRecording: recording,
                              }))
                            }
                            size="sm"
                            variant={state.isRecording ? "destructive" : "default"}
                            className="gap-1.5"
                            label={state.isRecording ? "Stop" : "Record"}
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 text-xs"
                            onClick={handleCancelInput}
                          >
                            Cancel
                          </Button>
                        </div>
                        {state.isRecording && (
                          <p className="text-xs text-primary animate-pulse px-1">
                            Listening...
                          </p>
                        )}
                      </div>
                    ) : (
                      /* Action buttons: mic + pencil */
                      <div className="flex items-center gap-1.5">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 gap-1.5 text-xs flex-1 bg-background/60"
                          onClick={handleStartVoice}
                        >
                          <Mic className="w-3.5 h-3.5" />
                          Speak
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 gap-1.5 text-xs flex-1 bg-background/60"
                          onClick={handleStartText}
                        >
                          <PenLine className="w-3.5 h-3.5" />
                          Type
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ) : (
                /* Collapsed: compact clickable bubble */
                <button
                  onClick={() => handleExpand(index)}
                  className={`w-full text-left text-sm p-2.5 rounded-lg border transition-all leading-relaxed ${
                    isResponded
                      ? "border-primary/20 bg-primary/5 text-muted-foreground"
                      : "border-border hover:border-primary/30 hover:bg-primary/5"
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <span className="flex-1">{question}</span>
                    {isResponded && (
                      <Check className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                    )}
                  </div>
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
