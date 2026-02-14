import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Target,
  FileText,
  MessageCircleQuestion,
  ChevronDown,
  ChevronUp,
  Hash,
} from "lucide-react";
import type { InterviewEntry } from "@shared/schema";

interface DocumentSection {
  id: string;
  heading: string;
  level: number;
  content: string;
  wordCount: number;
}

interface MapLayoutProps {
  documentText: string;
  objective: string;
  interviewEntries: InterviewEntry[];
  isInterviewActive: boolean;
}

/** Parse markdown text into sections split by headings */
function parseDocumentSections(text: string): DocumentSection[] {
  const lines = text.split("\n");
  const sections: DocumentSection[] = [];
  let currentHeading = "";
  let currentLevel = 0;
  let currentLines: string[] = [];
  let sectionIndex = 0;

  const pushSection = () => {
    const content = currentLines.join("\n").trim();
    if (currentHeading || content) {
      sections.push({
        id: `section-${sectionIndex++}`,
        heading: currentHeading || "Introduction",
        level: currentLevel || 1,
        content,
        wordCount: content.split(/\s+/).filter(Boolean).length,
      });
    }
  };

  for (const line of lines) {
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      pushSection();
      currentHeading = headingMatch[2];
      currentLevel = headingMatch[1].length;
      currentLines = [];
    } else {
      currentLines.push(line);
    }
  }
  pushSection();

  return sections;
}

export function MapLayout({
  documentText,
  objective,
  interviewEntries,
  isInterviewActive,
}: MapLayoutProps) {
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());

  const sections = useMemo(() => parseDocumentSections(documentText), [documentText]);

  const totalWords = documentText.split(/\s+/).filter(Boolean).length;

  const toggleCard = (id: string) => {
    setExpandedCards((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const levelColors: Record<number, string> = {
    1: "border-amber-500/40 bg-amber-500/5",
    2: "border-amber-400/30 bg-amber-400/5",
    3: "border-amber-300/20 bg-amber-300/5",
    4: "border-amber-200/20 bg-amber-200/5",
  };

  return (
    <ScrollArea className="h-full">
      <div className="p-6 space-y-6 max-w-6xl mx-auto">
        {/* Objective card — top center */}
        {objective && (
          <Card className="border-primary/40 bg-primary/5">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Target className="w-4 h-4 text-primary" />
                Objective
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <p className="text-sm leading-relaxed">{objective}</p>
            </CardContent>
          </Card>
        )}

        {/* Stats row */}
        <div className="flex items-center gap-3 flex-wrap">
          <Badge variant="outline" className="gap-1.5">
            <FileText className="w-3 h-3" />
            {sections.length} sections
          </Badge>
          <Badge variant="outline" className="gap-1.5">
            <Hash className="w-3 h-3" />
            {totalWords.toLocaleString()} words
          </Badge>
          {interviewEntries.length > 0 && (
            <Badge variant="outline" className="gap-1.5">
              <MessageCircleQuestion className="w-3 h-3" />
              {interviewEntries.length} Q&A
            </Badge>
          )}
          {isInterviewActive && (
            <Badge className="bg-primary/10 text-primary border-primary/30 gap-1.5">
              <span className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse" />
              Interview active
            </Badge>
          )}
        </div>

        {/* Document sections grid */}
        {sections.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Document Structure
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {sections.map((section) => {
                const isExpanded = expandedCards.has(section.id);
                const colorClass = levelColors[Math.min(section.level, 4)] || levelColors[4];
                const previewText = section.content.slice(0, 150);
                const hasMore = section.content.length > 150;

                return (
                  <Card
                    key={section.id}
                    className={`cursor-pointer transition-all hover:shadow-md ${colorClass} ${
                      isExpanded ? "md:col-span-2 lg:col-span-2" : ""
                    }`}
                    onClick={() => toggleCard(section.id)}
                  >
                    <CardHeader className="p-3 pb-1">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <span
                          className="text-xs text-muted-foreground font-mono shrink-0"
                          title={`Heading level ${section.level}`}
                        >
                          {"#".repeat(section.level)}
                        </span>
                        <span className="truncate">{section.heading}</span>
                        <div className="flex items-center gap-1 ml-auto shrink-0">
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                            {section.wordCount}w
                          </Badge>
                          {hasMore &&
                            (isExpanded ? (
                              <ChevronUp className="w-3 h-3 text-muted-foreground" />
                            ) : (
                              <ChevronDown className="w-3 h-3 text-muted-foreground" />
                            ))}
                        </div>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-3 pt-0">
                      <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-line">
                        {isExpanded ? section.content : previewText}
                        {!isExpanded && hasMore && "..."}
                      </p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* Interview Q&A grid */}
        {interviewEntries.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
              <MessageCircleQuestion className="w-4 h-4" />
              Interview Responses
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {interviewEntries.map((entry) => {
                const isExpanded = expandedCards.has(entry.id);
                const previewAnswer = entry.answer.slice(0, 120);
                const hasMore = entry.answer.length > 120;

                return (
                  <Card
                    key={entry.id}
                    className={`cursor-pointer transition-all hover:shadow-md border-violet-400/30 bg-violet-500/5 ${
                      isExpanded ? "md:col-span-2" : ""
                    }`}
                    onClick={() => toggleCard(entry.id)}
                  >
                    <CardHeader className="p-3 pb-1">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Badge className="text-[10px] bg-violet-500/20 text-violet-700 dark:text-violet-300 border-violet-400/30">
                          {entry.topic}
                        </Badge>
                        {hasMore &&
                          (isExpanded ? (
                            <ChevronUp className="w-3 h-3 text-muted-foreground ml-auto" />
                          ) : (
                            <ChevronDown className="w-3 h-3 text-muted-foreground ml-auto" />
                          ))}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-3 pt-0 space-y-2">
                      <p className="text-xs font-medium leading-relaxed">{entry.question}</p>
                      <p className="text-xs text-muted-foreground bg-muted/50 rounded p-2 leading-relaxed whitespace-pre-line">
                        {isExpanded ? entry.answer : previewAnswer}
                        {!isExpanded && hasMore && "..."}
                      </p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* Empty state */}
        {sections.length === 0 && interviewEntries.length === 0 && (
          <div className="flex items-center justify-center py-20">
            <div className="text-center space-y-3">
              <FileText className="w-10 h-10 text-muted-foreground/30 mx-auto" />
              <p className="text-sm text-muted-foreground">
                Start writing or begin an interview to see your content mapped here.
              </p>
            </div>
          </div>
        )}
      </div>
    </ScrollArea>
  );
}
