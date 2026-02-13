import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ProvokeText } from "./ProvokeText";
import {
  Globe,
  Layers,
  Loader2,
  Component,
  Lightbulb,
  Layout,
  Target,
  ChevronDown,
  ChevronUp,
  ExternalLink,
} from "lucide-react";
import type {
  WireframeAnalysisResponse,
} from "@shared/schema";

interface StreamingWireframePanelProps {
  websiteUrl: string;
  onWebsiteUrlChange: (url: string) => void;
  wireframeNotes: string;
  onWireframeNotesChange: (notes: string) => void;
  analysis: WireframeAnalysisResponse | null;
  isAnalyzing: boolean;
  onAnalyze: () => void;
  objective: string;
}

export function StreamingWireframePanel({
  websiteUrl,
  onWebsiteUrlChange,
  wireframeNotes,
  onWireframeNotesChange,
  analysis,
  isAnalyzing,
  onAnalyze,
  objective,
}: StreamingWireframePanelProps) {
  const [isContextCollapsed, setIsContextCollapsed] = useState(false);

  // Auto-collapse URL/objective after both are filled and analysis exists
  const canCollapse = websiteUrl.trim() && objective.trim() && analysis;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b bg-muted/20">
        <Globe className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
        <h3 className="font-semibold text-sm">Website Analysis</h3>
        {websiteUrl && (
          <Badge variant="outline" className="ml-auto text-[10px] max-w-[140px] truncate">
            {websiteUrl.replace(/^https?:\/\//, "")}
          </Badge>
        )}
      </div>

      <ScrollArea className="flex-1">
        <div className="p-3 space-y-3">
          {/* URL + Objective section (collapsible after analysis) */}
          <div className="space-y-3">
            {canCollapse && isContextCollapsed ? (
              /* Collapsed view */
              <button
                onClick={() => setIsContextCollapsed(false)}
                className="w-full flex items-center gap-2 p-2.5 rounded-lg border border-indigo-200 dark:border-indigo-800 bg-indigo-50/50 dark:bg-indigo-950/20 text-left hover:bg-indigo-100/50 dark:hover:bg-indigo-950/30 transition-colors"
              >
                <Target className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-indigo-700 dark:text-indigo-300 truncate">
                    {objective}
                  </p>
                  <p className="text-[10px] text-muted-foreground truncate">
                    {websiteUrl}
                  </p>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              </button>
            ) : (
              /* Expanded view */
              <>
                {/* Objective display */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Target className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
                      <label className="text-xs font-medium text-muted-foreground">Objective</label>
                    </div>
                    {canCollapse && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-5 px-1.5 text-[10px]"
                        onClick={() => setIsContextCollapsed(true)}
                      >
                        <ChevronUp className="w-3 h-3" />
                        Minimize
                      </Button>
                    )}
                  </div>
                  <div className="text-sm p-2.5 rounded-md border bg-muted/30 leading-relaxed">
                    {objective || <span className="text-muted-foreground italic">No objective set</span>}
                  </div>
                </div>

                {/* Website URL input */}
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <Globe className="w-3 h-3 text-muted-foreground" />
                    <label className="text-xs font-medium text-muted-foreground">Target Website URL</label>
                  </div>
                  <div className="flex gap-1.5">
                    <input
                      type="url"
                      value={websiteUrl}
                      onChange={(e) => onWebsiteUrlChange(e.target.value)}
                      placeholder="https://example.com"
                      className="flex-1 text-sm px-3 py-1.5 border rounded-md bg-background"
                    />
                    {websiteUrl && (
                      <a
                        href={websiteUrl.startsWith("http") ? websiteUrl : `https://${websiteUrl}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center h-8 w-8 rounded-md border bg-background hover:bg-muted transition-colors shrink-0"
                        title="Open website in new tab"
                      >
                        <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
                      </a>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Wireframe description input */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5">
              <Layout className="w-3 h-3 text-muted-foreground" />
              <label className="text-xs font-medium text-muted-foreground">
                Wireframe / Site Description
              </label>
            </div>
            <ProvokeText
              chrome="inline"
              placeholder="Describe the website layout, pages, navigation, components... Paste wireframe notes or describe what you see on the site."
              value={wireframeNotes}
              onChange={onWireframeNotesChange}
              className="text-sm"
              minRows={4}
              maxRows={12}
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
            {isAnalyzing ? "Analyzing Website..." : "Analyze Website"}
          </Button>

          {/* Analysis results — website map & components */}
          {analysis && (
            <div className="space-y-3 pt-1">
              <div className="flex items-center gap-1.5 pb-1 border-b">
                <Layers className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
                <span className="text-xs font-medium text-indigo-700 dark:text-indigo-400 uppercase tracking-wider">
                  Website Structure
                </span>
              </div>

              <p className="text-sm text-muted-foreground leading-relaxed">
                {analysis.analysis}
              </p>

              {analysis.components.length > 0 && (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <Component className="w-3 h-3 text-cyan-600 dark:text-cyan-400" />
                    <span className="text-xs font-medium text-muted-foreground">Components & Sections</span>
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
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <Lightbulb className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                    <span className="text-xs font-medium text-muted-foreground">Needs Clarification</span>
                  </div>
                  <ul className="text-xs text-muted-foreground space-y-1">
                    {analysis.suggestions.map((sug, idx) => (
                      <li key={idx} className="pl-2.5 border-l-2 border-amber-300 dark:border-amber-700 leading-relaxed">
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
  );
}
