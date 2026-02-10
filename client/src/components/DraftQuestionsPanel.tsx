import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  MessageCircleQuestion,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

interface DraftQuestionsPanelProps {
  questions: string[];
}

export function DraftQuestionsPanel({ questions }: DraftQuestionsPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  if (questions.length === 0) return null;

  return (
    <div className="w-64 shrink-0 flex flex-col gap-3">
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

      {/* Active question */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-3">
          <p className="text-sm font-medium leading-relaxed">
            {questions[activeIndex]}
          </p>
        </CardContent>
      </Card>

      {/* Expand/collapse toggle for remaining questions */}
      {questions.length > 1 && (
        <>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-1"
          >
            {isExpanded ? (
              <ChevronUp className="w-3 h-3" />
            ) : (
              <ChevronDown className="w-3 h-3" />
            )}
            {isExpanded
              ? "Collapse"
              : `${questions.length - 1} more question${questions.length - 1 > 1 ? "s" : ""}`}
          </button>

          {isExpanded && (
            <div className="space-y-1.5">
              {questions.map(
                (q, i) =>
                  i !== activeIndex && (
                    <button
                      key={i}
                      onClick={() => {
                        setActiveIndex(i);
                        setIsExpanded(false);
                      }}
                      className="w-full text-left text-xs text-muted-foreground hover:text-foreground p-2.5 rounded-md border border-transparent hover:border-border hover:bg-muted/50 transition-all leading-relaxed"
                    >
                      {q}
                    </button>
                  )
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
