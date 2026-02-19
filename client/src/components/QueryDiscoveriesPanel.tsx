import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  CheckCircle,
  Info,
  AlertTriangle,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Zap,
  FileText,
  BarChart3,
  Lightbulb,
} from "lucide-react";
import type { ContextItem } from "@shared/schema";

export interface SubqueryAnalysis {
  id: string;
  name: string;
  sqlSnippet: string;
  startOffset: number;
  endOffset: number;
  summary: string;
  evaluation: string;
  severity: "good" | "info" | "warning" | "critical";
  recommendations: string[];
}

export interface OptimizationOpportunity {
  title: string;
  description: string;
  severity: "info" | "warning" | "critical";
  affectedSubquery?: string;
}

export interface ExtractedMetric {
  name: string;
  definition: string;
  formula?: string;
}

export interface QueryAnalysisResult {
  subqueries: SubqueryAnalysis[];
  metrics: ExtractedMetric[];
  overallEvaluation: string;
  optimizationOpportunities: OptimizationOpportunity[];
}

interface QueryDiscoveriesPanelProps {
  analysis: QueryAnalysisResult | null;
  isAnalyzing: boolean;
  selectedSubqueryId: string | null;
  hoveredSubqueryId: string | null;
  onSubqueryHover: (id: string | null) => void;
  onSubquerySelect: (id: string | null) => void;
  onCaptureMetrics: (items: ContextItem[]) => void;
}

const SeverityIcon = ({ severity, className }: { severity: string; className?: string }) => {
  switch (severity) {
    case "good": return <CheckCircle className={className} />;
    case "warning": return <AlertTriangle className={className} />;
    case "critical": return <AlertCircle className={className} />;
    default: return <Info className={className} />;
  }
};

const severityTextColor: Record<string, string> = {
  good: "text-emerald-600 dark:text-emerald-400",
  info: "text-blue-600 dark:text-blue-400",
  warning: "text-amber-600 dark:text-amber-400",
  critical: "text-red-600 dark:text-red-400",
};

const severityBgColor: Record<string, string> = {
  good: "bg-emerald-500/10 border-emerald-500/20",
  info: "bg-blue-500/10 border-blue-500/20",
  warning: "bg-amber-500/10 border-amber-500/20",
  critical: "bg-red-500/10 border-red-500/20",
};

export function QueryDiscoveriesPanel({
  analysis,
  isAnalyzing,
  selectedSubqueryId,
  hoveredSubqueryId,
  onSubqueryHover,
  onSubquerySelect,
  onCaptureMetrics,
}: QueryDiscoveriesPanelProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(["subqueries", "overall", "opportunities", "metrics"])
  );

  const toggleSection = (key: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  if (!analysis && !isAnalyzing) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground p-4">
        <div className="text-center space-y-2">
          <Zap className="w-8 h-8 mx-auto opacity-30" />
          <p className="text-sm">No analysis yet.</p>
          <p className="text-xs">Click "Analyze" in the Query Analyzer tab to get started.</p>
        </div>
      </div>
    );
  }

  if (isAnalyzing && !analysis) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground p-4">
        <div className="text-center space-y-3">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm">Analyzing query...</p>
        </div>
      </div>
    );
  }

  if (!analysis) return null;

  const SectionHeader = ({ id, icon: Icon, title, count, iconColor }: {
    id: string;
    icon: React.ElementType;
    title: string;
    count?: number;
    iconColor?: string;
  }) => (
    <button
      className="flex items-center gap-2 w-full px-3 py-2 text-left hover:bg-muted/50 transition-colors"
      onClick={() => toggleSection(id)}
    >
      {expandedSections.has(id) ? <ChevronDown className="w-3.5 h-3.5 shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 shrink-0" />}
      <Icon className={`w-3.5 h-3.5 shrink-0 ${iconColor || "text-primary"}`} />
      <span className="text-xs font-semibold uppercase tracking-wider flex-1">{title}</span>
      {count !== undefined && (
        <span className="text-xs text-muted-foreground">{count}</span>
      )}
    </button>
  );

  return (
    <div className="h-full flex flex-col overflow-y-auto">
      {/* Overall Evaluation */}
      {analysis.overallEvaluation && (
        <div className="border-b">
          <SectionHeader id="overall" icon={FileText} title="Overall Evaluation" iconColor="text-violet-500" />
          {expandedSections.has("overall") && (
            <div className="px-3 pb-3">
              <div className="rounded-lg border bg-card/50 p-3">
                <p className="text-sm leading-relaxed text-foreground/90">{analysis.overallEvaluation}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Subquery Analysis */}
      {analysis.subqueries.length > 0 && (
        <div className="border-b">
          <SectionHeader id="subqueries" icon={Zap} title="Subquery Analysis" count={analysis.subqueries.length} iconColor="text-blue-500" />
          {expandedSections.has("subqueries") && (
            <div className="px-3 pb-3 space-y-2">
              {analysis.subqueries.map((sq) => {
                const isSelected = selectedSubqueryId === sq.id;
                const isHovered = hoveredSubqueryId === sq.id;

                return (
                  <div
                    key={sq.id}
                    className={`rounded-lg border p-3 cursor-pointer transition-all duration-150 ${
                      isSelected
                        ? `${severityBgColor[sq.severity]} ring-1 ring-inset ring-current/10`
                        : isHovered
                        ? "bg-muted/60 border-border/80"
                        : "bg-card/50 border-border hover:bg-muted/40"
                    }`}
                    onMouseEnter={() => onSubqueryHover(sq.id)}
                    onMouseLeave={() => onSubqueryHover(null)}
                    onClick={() => onSubquerySelect(sq.id === selectedSubqueryId ? null : sq.id)}
                  >
                    <div className="flex items-start gap-2">
                      <SeverityIcon
                        severity={sq.severity}
                        className={`w-4 h-4 mt-0.5 shrink-0 ${severityTextColor[sq.severity]}`}
                      />
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-semibold leading-tight">{sq.name}</h4>
                        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{sq.summary}</p>

                        {/* Show evaluation and recommendations when selected */}
                        {isSelected && (
                          <div className="mt-2 space-y-2">
                            <div className="text-xs leading-relaxed text-foreground/80 bg-muted/30 rounded p-2">
                              <span className="font-medium">Evaluation:</span> {sq.evaluation}
                            </div>
                            {sq.recommendations.length > 0 && (
                              <div className="space-y-1">
                                <span className="text-xs font-medium text-foreground/70">Recommendations:</span>
                                <ul className="space-y-1">
                                  {sq.recommendations.map((rec, i) => (
                                    <li key={i} className="text-xs text-foreground/70 flex items-start gap-1.5">
                                      <Lightbulb className="w-3 h-3 text-amber-500 mt-0.5 shrink-0" />
                                      <span>{rec}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Optimization Opportunities */}
      {analysis.optimizationOpportunities.length > 0 && (
        <div className="border-b">
          <SectionHeader id="opportunities" icon={Lightbulb} title="Opportunities" count={analysis.optimizationOpportunities.length} iconColor="text-amber-500" />
          {expandedSections.has("opportunities") && (
            <div className="px-3 pb-3 space-y-2">
              {analysis.optimizationOpportunities.map((opp, i) => (
                <div
                  key={i}
                  className={`rounded-lg border p-3 ${severityBgColor[opp.severity] || severityBgColor.info}`}
                  onClick={() => {
                    if (opp.affectedSubquery) {
                      onSubquerySelect(opp.affectedSubquery);
                    }
                  }}
                  style={{ cursor: opp.affectedSubquery ? "pointer" : "default" }}
                >
                  <div className="flex items-start gap-2">
                    <SeverityIcon
                      severity={opp.severity}
                      className={`w-4 h-4 mt-0.5 shrink-0 ${severityTextColor[opp.severity]}`}
                    />
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-semibold leading-tight">{opp.title}</h4>
                      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{opp.description}</p>
                      {opp.affectedSubquery && (
                        <span className="inline-flex items-center gap-1 mt-1.5 text-xs text-primary/80">
                          <Zap className="w-3 h-3" />
                          Click to see affected subquery
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Metrics */}
      {analysis.metrics.length > 0 && (
        <div className="border-b">
          <SectionHeader id="metrics" icon={BarChart3} title="Metrics & KPIs" count={analysis.metrics.length} iconColor="text-emerald-500" />
          {expandedSections.has("metrics") && (
            <div className="px-3 pb-3 space-y-2">
              {analysis.metrics.map((metric, i) => (
                <div key={i} className="rounded-lg border bg-card/50 p-3">
                  <h4 className="text-sm font-semibold">{metric.name}</h4>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{metric.definition}</p>
                  {metric.formula && (
                    <code className="block mt-1.5 text-xs bg-muted rounded px-2 py-1 font-mono text-foreground/80">
                      {metric.formula}
                    </code>
                  )}
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                className="w-full gap-1.5 text-xs mt-1"
                onClick={() => {
                  const items: ContextItem[] = analysis.metrics.map((m, idx) => ({
                    id: `metric-${idx}-${Date.now()}`,
                    type: "text" as const,
                    content: `**${m.name}**: ${m.definition}${m.formula ? ` (Formula: ${m.formula})` : ""}`,
                    annotation: "Extracted metric from query analysis",
                    createdAt: Date.now(),
                  }));
                  onCaptureMetrics(items);
                }}
              >
                <BarChart3 className="w-3 h-3" />
                Capture all metrics as context
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
