import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ProvokeText } from "./ProvokeText";
import {
  MessageCircleQuestion,
  Send,
  Check,
} from "lucide-react";

interface DraftQuestionsPanelProps {
  questions: string[];
  onResponse: (question: string, response: string) => void;
}

interface QuestionState {
  expandedIndex: number | null;
  textValue: string;
  responded: Set<number>;
}

export function DraftQuestionsPanel({ questions, onResponse }: DraftQuestionsPanelProps) {
  const [state, setState] = useState<QuestionState>({
    expandedIndex: null,
    textValue: "",
    responded: new Set(),
  });

  if (questions.length === 0) return null;

  const handleExpand = (index: number) => {
    if (state.expandedIndex === index) {
      // Collapse
      setState((prev) => ({
        ...prev,
        expandedIndex: null,
        textValue: "",
      }));
    } else {
      setState((prev) => ({
        ...prev,
        expandedIndex: index,
        textValue: "",
      }));
    }
  };

  const handleSubmitText = () => {
    if (state.expandedIndex === null || !state.textValue.trim()) return;
    const question = questions[state.expandedIndex];
    onResponse(question, state.textValue.trim());
    setState((prev) => ({
      ...prev,
      textValue: "",
      responded: new Set(prev.responded).add(prev.expandedIndex!),
      expandedIndex: null,
    }));
  };

  const handleVoiceTranscript = (transcript: string) => {
    if (state.expandedIndex === null || !transcript.trim()) return;
    const question = questions[state.expandedIndex];
    onResponse(question, transcript.trim());
    setState((prev) => ({
      ...prev,
      textValue: "",
      responded: new Set(prev.responded).add(prev.expandedIndex!),
      expandedIndex: null,
    }));
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
                /* Expanded: orange highlight box with ProvokeText input */
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

                    <ProvokeText
                      chrome="inline"
                      placeholder="Type your response or use the mic..."
                      value={state.textValue}
                      onChange={(val) =>
                        setState((prev) => ({ ...prev, textValue: val }))
                      }
                      className="text-sm bg-background/80"
                      minRows={2}
                      maxRows={6}
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleSubmitText();
                        }
                        if (e.key === "Escape") {
                          handleExpand(index);
                        }
                      }}
                      voice={{ mode: "replace" }}
                      onVoiceTranscript={handleVoiceTranscript}
                      showCopy={false}
                      onSubmit={handleSubmitText}
                      submitIcon={Send}
                    />
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
