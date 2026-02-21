import { useState, useMemo } from "react";
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
  Check,
  ArrowRight,
  Code2,
  X,
  ThumbsUp,
  ThumbsDown,
  Filter,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";
import type { ContextItem } from "@shared/schema";

export interface ChangeRecommendation {
  title: string;
  rationale: string;
  beforeCode: string;
  afterCode: string;
  impact: string;
}

export interface FeedbackCategory {
  id: string;
  label: string;
  description: string;
  severity: "good" | "info" | "warning" | "critical";
  count: number;
}

export interface SubqueryAnalysis {
  id: string;
  name: string;
  sqlSnippet: string;
  startOffset: number;
  endOffset: number;
  summary: string;
  evaluation: string;
  severity: "good" | "info" | "warning" | "critical";
  category?: string;
  recommendations: string[];
  changeRecommendations?: ChangeRecommendation[];
}

export interface OptimizationOpportunity {
  title: string;
  description: string;
  severity: "info" | "warning" | "critical";
  category?: string;
  affectedSubquery?: string;
  beforeCode?: string;
  afterCode?: string;
  impact?: string;
}

export interface ExtractedMetric {
  name: string;
  definition: string;
  formula?: string;
}

export type FindingFeedback = "accepted" | "rejected" | null;

export interface QueryAnalysisResult {
  feedbackCategories?: FeedbackCategory[];
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
  onAcceptChange?: (beforeCode: string, afterCode: string) => void;
  findingFeedback?: Record<string, FindingFeedback>;
  onFindingFeedback?: (findingId: string, feedback: FindingFeedback) => void;
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
  onAcceptChange,
  findingFeedback,
  onFindingFeedback,
}: QueryDiscoveriesPanelProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(["subqueries", "overall", "opportunities", "metrics", "categories"])
  );
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<string | null>(null);
  const [beforeAfterMode, setBeforeAfterMode] = useState<Record<string, "side-by-side" | "unified">>({});

  const toggleSection = (key: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // Filter subqueries and opportunities by active category
  const filteredSubqueries = useMemo(() => {
    if (!analysis) return [];
    if (!activeCategoryFilter) return analysis.subqueries;
    return analysis.subqueries.filter(sq => sq.category === activeCategoryFilter);
  }, [analysis, activeCategoryFilter]);

  const filteredOpportunities = useMemo(() => {
    if (!analysis) return [];
    if (!activeCategoryFilter) return analysis.optimizationOpportunities;
    return analysis.optimizationOpportunities.filter(opp => opp.category === activeCategoryFilter);
  }, [analysis, activeCategoryFilter]);

  const getViewMode = (key: string): "side-by-side" | "unified" => beforeAfterMode[key] || "side-by-side";

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

      {/* Dynamic Feedback Categories */}
      {analysis.feedbackCategories && analysis.feedbackCategories.length > 0 && (
        <div className="border-b">
          <SectionHeader id="categories" icon={Filter} title="Categories" count={analysis.feedbackCategories.length} iconColor="text-indigo-500" />
          {expandedSections.has("categories") && (
            <div className="px-3 pb-3">
              <div className="flex flex-wrap gap-1.5">
                <button
                  className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-medium transition-colors border ${
                    !activeCategoryFilter
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-muted/50 text-muted-foreground border-border hover:bg-muted hover:text-foreground"
                  }`}
                  onClick={() => setActiveCategoryFilter(null)}
                >
                  All
                </button>
                {analysis.feedbackCategories.map((cat) => (
                  <button
                    key={cat.id}
                    className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-medium transition-colors border ${
                      activeCategoryFilter === cat.id
                        ? `${severityBgColor[cat.severity]} border-current/20`
                        : "bg-muted/50 text-muted-foreground border-border hover:bg-muted hover:text-foreground"
                    }`}
                    onClick={() => setActiveCategoryFilter(activeCategoryFilter === cat.id ? null : cat.id)}
                    title={cat.description}
                  >
                    <SeverityIcon severity={cat.severity} className="w-3 h-3" />
                    {cat.label}
                    <span className="text-[10px] opacity-70">({cat.count})</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Subquery Analysis */}
      {filteredSubqueries.length > 0 && (
        <div className="border-b">
          <SectionHeader id="subqueries" icon={Zap} title="Subquery Analysis" count={filteredSubqueries.length} iconColor="text-blue-500" />
          {expandedSections.has("subqueries") && (
            <div className="px-3 pb-3 space-y-2">
              {filteredSubqueries.map((sq) => {
                const isSelected = selectedSubqueryId === sq.id;
                const isHovered = hoveredSubqueryId === sq.id;
                const fb = findingFeedback?.[sq.id] ?? null;

                return (
                  <div
                    key={sq.id}
                    className={`rounded-lg border p-3 cursor-pointer transition-all duration-150 ${
                      fb === "rejected" ? "opacity-50" : ""
                    } ${
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
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-semibold leading-tight flex-1">{sq.name}</h4>
                          {/* Accept/Reject feedback buttons */}
                          {onFindingFeedback && (
                            <div className="flex items-center gap-0.5 shrink-0" onClick={e => e.stopPropagation()}>
                              <button
                                className={`p-1 rounded transition-colors ${fb === "accepted" ? "text-emerald-500 bg-emerald-500/10" : "text-muted-foreground hover:text-emerald-500 hover:bg-emerald-500/10"}`}
                                onClick={() => onFindingFeedback(sq.id, fb === "accepted" ? null : "accepted")}
                                title="This finding is useful"
                              >
                                <ThumbsUp className="w-3 h-3" />
                              </button>
                              <button
                                className={`p-1 rounded transition-colors ${fb === "rejected" ? "text-red-500 bg-red-500/10" : "text-muted-foreground hover:text-red-500 hover:bg-red-500/10"}`}
                                onClick={() => onFindingFeedback(sq.id, fb === "rejected" ? null : "rejected")}
                                title="This finding is not relevant"
                              >
                                <ThumbsDown className="w-3 h-3" />
                              </button>
                            </div>
                          )}
                        </div>
                        {sq.category && (
                          <span className="inline-block text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground mt-1">{sq.category}</span>
                        )}
                        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{sq.summary}</p>

                        {/* Show evaluation, recommendations, and code changes when selected */}
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
                            {/* Change recommendations with before/after code */}
                            {sq.changeRecommendations && sq.changeRecommendations.length > 0 && (
                              <div className="space-y-2 mt-2">
                                <span className="text-xs font-semibold text-foreground/80 flex items-center gap-1">
                                  <Code2 className="w-3 h-3" />
                                  Suggested Changes:
                                </span>
                                {sq.changeRecommendations.map((cr, ci) => {
                                  const viewKey = `${sq.id}-${ci}`;
                                  const mode = getViewMode(viewKey);
                                  return (
                                    <div key={ci} className="rounded border bg-background/80 overflow-hidden">
                                      <div className="px-2.5 py-1.5 border-b bg-muted/30 flex items-start gap-2">
                                        <div className="flex-1 min-w-0">
                                          <div className="text-xs font-medium text-foreground/90">{cr.title}</div>
                                          <div className="text-xs text-muted-foreground mt-0.5">{cr.rationale}</div>
                                        </div>
                                        <button
                                          className="text-muted-foreground hover:text-foreground p-0.5 shrink-0"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setBeforeAfterMode(prev => ({ ...prev, [viewKey]: mode === "side-by-side" ? "unified" : "side-by-side" }));
                                          }}
                                          title={mode === "side-by-side" ? "Switch to unified view" : "Switch to side-by-side view"}
                                        >
                                          {mode === "side-by-side" ? <ToggleLeft className="w-3.5 h-3.5" /> : <ToggleRight className="w-3.5 h-3.5" />}
                                        </button>
                                      </div>
                                      {mode === "side-by-side" ? (
                                        <div className="grid grid-cols-2 divide-x text-xs font-mono">
                                          <div className="p-2">
                                            <div className="text-[10px] uppercase tracking-wider text-red-500/70 font-sans font-medium mb-1">Before</div>
                                            <pre className="whitespace-pre-wrap text-[11px] text-foreground/70 bg-red-500/5 rounded p-1.5 overflow-x-auto">{cr.beforeCode}</pre>
                                          </div>
                                          <div className="p-2">
                                            <div className="text-[10px] uppercase tracking-wider text-emerald-500/70 font-sans font-medium mb-1">After</div>
                                            <pre className="whitespace-pre-wrap text-[11px] text-foreground/70 bg-emerald-500/5 rounded p-1.5 overflow-x-auto">{cr.afterCode}</pre>
                                          </div>
                                        </div>
                                      ) : (
                                        <div className="p-2 text-xs font-mono space-y-1">
                                          <div>
                                            <pre className="whitespace-pre-wrap text-[11px] text-red-600/80 bg-red-500/5 rounded p-1.5 overflow-x-auto line-through decoration-red-400/50">{cr.beforeCode}</pre>
                                          </div>
                                          <ArrowRight className="w-3 h-3 text-muted-foreground mx-auto" />
                                          <div>
                                            <pre className="whitespace-pre-wrap text-[11px] text-emerald-600/80 bg-emerald-500/5 rounded p-1.5 overflow-x-auto">{cr.afterCode}</pre>
                                          </div>
                                        </div>
                                      )}
                                      {cr.impact && (
                                        <div className="px-2.5 py-1 text-[10px] text-muted-foreground border-t bg-muted/20">
                                          Impact: {cr.impact}
                                        </div>
                                      )}
                                      {onAcceptChange && (
                                        <div className="px-2.5 py-1.5 border-t bg-muted/10 flex justify-end">
                                          <Button
                                            variant="outline"
                                            size="sm"
                                            className="h-6 text-xs gap-1 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10 border-emerald-500/30"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              onAcceptChange(cr.beforeCode, cr.afterCode);
                                            }}
                                          >
                                            <Check className="w-3 h-3" />
                                            Accept Change
                                          </Button>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
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
      {filteredOpportunities.length > 0 && (
        <div className="border-b">
          <SectionHeader id="opportunities" icon={Lightbulb} title="Opportunities" count={filteredOpportunities.length} iconColor="text-amber-500" />
          {expandedSections.has("opportunities") && (
            <div className="px-3 pb-3 space-y-2">
              {filteredOpportunities.map((opp, i) => {
                const oppId = `opp-${i}`;
                const fb = findingFeedback?.[oppId] ?? null;
                const viewKey = `opp-${i}`;
                const mode = getViewMode(viewKey);
                return (
                  <div
                    key={i}
                    className={`rounded-lg border p-3 ${fb === "rejected" ? "opacity-50" : ""} ${severityBgColor[opp.severity] || severityBgColor.info}`}
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
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-semibold leading-tight flex-1">{opp.title}</h4>
                          {onFindingFeedback && (
                            <div className="flex items-center gap-0.5 shrink-0" onClick={e => e.stopPropagation()}>
                              <button
                                className={`p-1 rounded transition-colors ${fb === "accepted" ? "text-emerald-500 bg-emerald-500/10" : "text-muted-foreground hover:text-emerald-500 hover:bg-emerald-500/10"}`}
                                onClick={() => onFindingFeedback(oppId, fb === "accepted" ? null : "accepted")}
                                title="This finding is useful"
                              >
                                <ThumbsUp className="w-3 h-3" />
                              </button>
                              <button
                                className={`p-1 rounded transition-colors ${fb === "rejected" ? "text-red-500 bg-red-500/10" : "text-muted-foreground hover:text-red-500 hover:bg-red-500/10"}`}
                                onClick={() => onFindingFeedback(oppId, fb === "rejected" ? null : "rejected")}
                                title="This finding is not relevant"
                              >
                                <ThumbsDown className="w-3 h-3" />
                              </button>
                            </div>
                          )}
                        </div>
                        {opp.category && (
                          <span className="inline-block text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground mt-1">{opp.category}</span>
                        )}
                        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{opp.description}</p>
                        {/* Before/After code for optimization opportunities */}
                        {opp.beforeCode && opp.afterCode && (
                          <div className="mt-2 rounded border bg-background/80 overflow-hidden">
                            <div className="flex justify-end px-2 pt-1">
                              <button
                                className="text-muted-foreground hover:text-foreground p-0.5"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setBeforeAfterMode(prev => ({ ...prev, [viewKey]: mode === "side-by-side" ? "unified" : "side-by-side" }));
                                }}
                                title={mode === "side-by-side" ? "Switch to unified view" : "Switch to side-by-side view"}
                              >
                                {mode === "side-by-side" ? <ToggleLeft className="w-3.5 h-3.5" /> : <ToggleRight className="w-3.5 h-3.5" />}
                              </button>
                            </div>
                            {mode === "side-by-side" ? (
                              <div className="grid grid-cols-2 divide-x text-xs font-mono">
                                <div className="p-2">
                                  <div className="text-[10px] uppercase tracking-wider text-red-500/70 font-sans font-medium mb-1">Before</div>
                                  <pre className="whitespace-pre-wrap text-[11px] text-foreground/70 bg-red-500/5 rounded p-1.5 overflow-x-auto">{opp.beforeCode}</pre>
                                </div>
                                <div className="p-2">
                                  <div className="text-[10px] uppercase tracking-wider text-emerald-500/70 font-sans font-medium mb-1">After</div>
                                  <pre className="whitespace-pre-wrap text-[11px] text-foreground/70 bg-emerald-500/5 rounded p-1.5 overflow-x-auto">{opp.afterCode}</pre>
                                </div>
                              </div>
                            ) : (
                              <div className="p-2 text-xs font-mono space-y-1">
                                <pre className="whitespace-pre-wrap text-[11px] text-red-600/80 bg-red-500/5 rounded p-1.5 overflow-x-auto line-through decoration-red-400/50">{opp.beforeCode}</pre>
                                <ArrowRight className="w-3 h-3 text-muted-foreground mx-auto" />
                                <pre className="whitespace-pre-wrap text-[11px] text-emerald-600/80 bg-emerald-500/5 rounded p-1.5 overflow-x-auto">{opp.afterCode}</pre>
                              </div>
                            )}
                            {opp.impact && (
                              <div className="px-2.5 py-1 text-[10px] text-muted-foreground border-t bg-muted/20">
                                Impact: {opp.impact}
                              </div>
                            )}
                            {onAcceptChange && (
                              <div className="px-2.5 py-1.5 border-t bg-muted/10 flex justify-end">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-6 text-xs gap-1 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10 border-emerald-500/30"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onAcceptChange(opp.beforeCode!, opp.afterCode!);
                                  }}
                                >
                                  <Check className="w-3 h-3" />
                                  Accept Change
                                </Button>
                              </div>
                            )}
                          </div>
                        )}
                        {opp.affectedSubquery && (
                          <span className="inline-flex items-center gap-1 mt-1.5 text-xs text-primary/80">
                            <Zap className="w-3 h-3" />
                            Click to see affected subquery
                          </span>
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
