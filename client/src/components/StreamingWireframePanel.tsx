import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { ProvokeText } from "./ProvokeText";
import {
  Globe,
  Layers,
  Send,
  Loader2,
  Component,
  Lightbulb,
  Layout,
} from "lucide-react";
import type {
  WireframeAnalysisResponse,
} from "@shared/schema";

interface WireframeDialogueEntry {
  id: string;
  role: "user" | "agent";
  content: string;
  timestamp: number;
}

interface StreamingWireframePanelProps {
  websiteUrl: string;
  onWebsiteUrlChange: (url: string) => void;
  wireframeNotes: string;
  onWireframeNotesChange: (notes: string) => void;
  analysis: WireframeAnalysisResponse | null;
  isAnalyzing: boolean;
  onAnalyze: () => void;
  wireframeDialogue: WireframeDialogueEntry[];
  onWireframeDialogueSubmit: (message: string) => void;
  isWireframeDialogueLoading: boolean;
}

export function StreamingWireframePanel({
  websiteUrl,
  onWebsiteUrlChange,
  wireframeNotes,
  onWireframeNotesChange,
  analysis,
  isAnalyzing,
  onAnalyze,
  wireframeDialogue,
  onWireframeDialogueSubmit,
  isWireframeDialogueLoading,
}: StreamingWireframePanelProps) {
  const [dialogueInput, setDialogueInput] = useState("");

  const handleDialogueSubmit = useCallback(() => {
    if (dialogueInput.trim()) {
      onWireframeDialogueSubmit(dialogueInput.trim());
      setDialogueInput("");
    }
  }, [dialogueInput, onWireframeDialogueSubmit]);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b bg-muted/20">
        <Layout className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
        <h3 className="font-semibold text-sm">Website Wireframe</h3>
      </div>

      {/* Split into two halves: wireframe view + analysis dialogue */}
      <div className="flex-1 flex flex-col min-h-0">
        {/* C1: Wireframe View (top half) */}
        <div className="flex-1 min-h-0 border-b flex flex-col">
          <div className="flex items-center gap-2 px-3 py-2 border-b bg-muted/10">
            <Globe className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Wireframe View
            </span>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-3 space-y-3">
              {/* Website URL input */}
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">Target Website URL</label>
                <input
                  type="url"
                  value={websiteUrl}
                  onChange={(e) => onWebsiteUrlChange(e.target.value)}
                  placeholder="https://example.com"
                  className="w-full text-sm px-3 py-1.5 border rounded-md bg-background"
                />
              </div>

              {/* Wireframe notes */}
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">
                  Wireframe Description
                </label>
                <ProvokeText
                  chrome="inline"
                  placeholder="Describe the website layout, components, navigation, key sections... Paste wireframe notes or describe what you see."
                  value={wireframeNotes}
                  onChange={onWireframeNotesChange}
                  className="text-sm"
                  minRows={4}
                  maxRows={10}
                  voice={{ mode: "append" }}
                  onVoiceTranscript={(t) => onWireframeNotesChange(wireframeNotes + " " + t)}
                />
              </div>

              <Button
                size="sm"
                className="w-full gap-1.5"
                onClick={onAnalyze}
                disabled={isAnalyzing || !wireframeNotes.trim()}
              >
                {isAnalyzing ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Layers className="w-3.5 h-3.5" />
                )}
                {isAnalyzing ? "Analyzing..." : "Analyze Wireframe"}
              </Button>

              {/* Analysis results */}
              {analysis && (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {analysis.analysis}
                  </p>

                  {analysis.components.length > 0 && (
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5">
                        <Component className="w-3 h-3 text-cyan-600 dark:text-cyan-400" />
                        <span className="text-xs font-medium text-muted-foreground">Components</span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {analysis.components.map((comp, idx) => (
                          <Badge key={idx} variant="outline" className="text-xs">
                            {comp}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {analysis.suggestions.length > 0 && (
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5">
                        <Lightbulb className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                        <span className="text-xs font-medium text-muted-foreground">Needs Clarification</span>
                      </div>
                      <ul className="text-xs text-muted-foreground space-y-0.5">
                        {analysis.suggestions.map((sug, idx) => (
                          <li key={idx} className="pl-2 border-l-2 border-amber-300 dark:border-amber-700">
                            {sug}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          </ScrollArea>
        </div>

        {/* C2: Website Analysis Dialogue (bottom half) */}
        <div className="flex-1 min-h-0 flex flex-col">
          <div className="flex items-center gap-2 px-3 py-2 border-b bg-muted/10">
            <Layers className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Website Analysis
            </span>
          </div>

          <ScrollArea className="flex-1">
            <div className="p-3 space-y-2">
              {wireframeDialogue.length === 0 && (
                <div className="text-center py-4">
                  <p className="text-xs text-muted-foreground">
                    Analyze the wireframe above, then discuss components here.
                  </p>
                </div>
              )}
              {wireframeDialogue.map((entry) => (
                <div
                  key={entry.id}
                  className={`text-sm p-2 rounded-md ${
                    entry.role === "agent"
                      ? "bg-muted/50 text-muted-foreground"
                      : "bg-primary/10 ml-4"
                  }`}
                >
                  <span className="text-xs font-medium opacity-70">
                    {entry.role === "agent" ? "Agent" : "You"}
                  </span>
                  <p className="leading-relaxed">{entry.content}</p>
                </div>
              ))}
              {isWireframeDialogueLoading && (
                <div className="flex items-center gap-2 p-2">
                  <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Analyzing...</span>
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Dialogue input */}
          <div className="p-2 border-t">
            <div className="flex gap-1.5">
              <ProvokeText
                chrome="inline"
                placeholder="Ask about a component..."
                value={dialogueInput}
                onChange={setDialogueInput}
                className="text-sm flex-1"
                minRows={1}
                maxRows={3}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleDialogueSubmit();
                  }
                }}
                voice={{ mode: "replace" }}
                onVoiceTranscript={(t) => {
                  setDialogueInput(t);
                }}
              />
              <Button
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={handleDialogueSubmit}
                disabled={!dialogueInput.trim() || isWireframeDialogueLoading}
              >
                <Send className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
