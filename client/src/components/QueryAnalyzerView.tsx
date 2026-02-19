import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Search, Loader2, AlertTriangle, CheckCircle, Info, AlertCircle } from "lucide-react";
import type { SubqueryAnalysis } from "./QueryDiscoveriesPanel";

interface QueryAnalyzerViewProps {
  sqlText: string;
  subqueries: SubqueryAnalysis[];
  isAnalyzing: boolean;
  selectedSubqueryId: string | null;
  hoveredSubqueryId: string | null;
  onSubqueryHover: (id: string | null) => void;
  onSubquerySelect: (id: string | null) => void;
  onAnalyze: () => void;
}

const severityColor: Record<string, string> = {
  good: "bg-emerald-500/15 border-emerald-500/30 hover:bg-emerald-500/25",
  info: "bg-blue-500/15 border-blue-500/30 hover:bg-blue-500/25",
  warning: "bg-amber-500/15 border-amber-500/30 hover:bg-amber-500/25",
  critical: "bg-red-500/15 border-red-500/30 hover:bg-red-500/25",
};

const severityUnderline: Record<string, string> = {
  good: "decoration-emerald-500/50",
  info: "decoration-blue-500/50",
  warning: "decoration-amber-500/50",
  critical: "decoration-red-500/50",
};

const SeverityIcon = ({ severity, className }: { severity: string; className?: string }) => {
  switch (severity) {
    case "good": return <CheckCircle className={className} />;
    case "warning": return <AlertTriangle className={className} />;
    case "critical": return <AlertCircle className={className} />;
    default: return <Info className={className} />;
  }
};

export function QueryAnalyzerView({
  sqlText,
  subqueries,
  isAnalyzing,
  selectedSubqueryId,
  hoveredSubqueryId,
  onSubqueryHover,
  onSubquerySelect,
  onAnalyze,
}: QueryAnalyzerViewProps) {
  const codeRef = useRef<HTMLPreElement>(null);
  const spanRefs = useRef<Map<string, HTMLSpanElement>>(new Map());

  // Scroll to selected subquery
  useEffect(() => {
    if (selectedSubqueryId) {
      const span = spanRefs.current.get(selectedSubqueryId);
      if (span) {
        span.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
  }, [selectedSubqueryId]);

  // Build annotated SQL with clickable/hoverable regions
  const renderAnnotatedSQL = useCallback(() => {
    if (subqueries.length === 0) {
      return (
        <code className="text-sm font-mono leading-relaxed whitespace-pre-wrap break-all text-foreground/90">
          {sqlText}
        </code>
      );
    }

    // Sort subqueries by startOffset to render in order
    const sorted = [...subqueries]
      .filter(sq => typeof sq.startOffset === "number" && typeof sq.endOffset === "number")
      .sort((a, b) => a.startOffset - b.startOffset);

    const elements: React.ReactNode[] = [];
    let lastEnd = 0;

    sorted.forEach((sq) => {
      // Add any text before this subquery
      if (sq.startOffset > lastEnd) {
        elements.push(
          <span key={`gap-${lastEnd}`} className="text-foreground/70">
            {sqlText.slice(lastEnd, sq.startOffset)}
          </span>
        );
      }

      const isHovered = hoveredSubqueryId === sq.id;
      const isSelected = selectedSubqueryId === sq.id;
      const highlight = isSelected || isHovered;

      elements.push(
        <Tooltip key={sq.id}>
          <TooltipTrigger asChild>
            <span
              ref={(el) => { if (el) spanRefs.current.set(sq.id, el); }}
              id={`sql-region-${sq.id}`}
              className={`relative cursor-pointer underline decoration-2 underline-offset-4 transition-all duration-150 rounded-sm ${severityUnderline[sq.severity] || severityUnderline.info} ${
                highlight
                  ? `${severityColor[sq.severity] || severityColor.info} px-0.5 -mx-0.5 ring-1 ring-inset ring-current/20`
                  : "hover:bg-muted/50"
              }`}
              onMouseEnter={() => onSubqueryHover(sq.id)}
              onMouseLeave={() => onSubqueryHover(null)}
              onClick={() => onSubquerySelect(sq.id === selectedSubqueryId ? null : sq.id)}
            >
              {sqlText.slice(sq.startOffset, sq.endOffset)}
            </span>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-sm">
            <div className="space-y-1">
              <div className="flex items-center gap-1.5">
                <SeverityIcon severity={sq.severity} className="w-3.5 h-3.5 shrink-0" />
                <span className="font-semibold text-xs">{sq.name}</span>
              </div>
              <p className="text-xs leading-relaxed">{sq.summary}</p>
            </div>
          </TooltipContent>
        </Tooltip>
      );

      lastEnd = sq.endOffset;
    });

    // Add any remaining text after the last subquery
    if (lastEnd < sqlText.length) {
      elements.push(
        <span key={`tail-${lastEnd}`} className="text-foreground/70">
          {sqlText.slice(lastEnd)}
        </span>
      );
    }

    return (
      <code className="text-sm font-mono leading-relaxed whitespace-pre-wrap break-all">
        {elements}
      </code>
    );
  }, [sqlText, subqueries, hoveredSubqueryId, selectedSubqueryId, onSubqueryHover, onSubquerySelect]);

  if (!sqlText.trim()) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground">
        <div className="text-center space-y-2">
          <Search className="w-8 h-8 mx-auto opacity-30" />
          <p className="text-sm">No query to analyze.</p>
          <p className="text-xs">Switch to Query Editor and write a query first.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col min-h-0">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b bg-muted/20 shrink-0">
        <Search className="w-4 h-4 text-primary" />
        <h3 className="font-semibold text-sm">Query Analysis</h3>
        <div className="flex-1" />
        {subqueries.length > 0 && (
          <span className="text-xs text-muted-foreground">
            {subqueries.length} subpart{subqueries.length !== 1 ? "s" : ""} identified
          </span>
        )}
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 text-xs h-7"
          onClick={onAnalyze}
          disabled={isAnalyzing || !sqlText.trim()}
        >
          {isAnalyzing ? (
            <>
              <Loader2 className="w-3 h-3 animate-spin" />
              Analyzing...
            </>
          ) : (
            <>
              <Search className="w-3 h-3" />
              {subqueries.length > 0 ? "Re-analyze" : "Analyze"}
            </>
          )}
        </Button>
      </div>

      {/* Annotated SQL view */}
      <div className="flex-1 overflow-auto p-4 min-h-0">
        {isAnalyzing && subqueries.length === 0 ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <div className="text-center space-y-3">
              <Loader2 className="w-8 h-8 mx-auto animate-spin opacity-50" />
              <p className="text-sm">Analyzing query structure...</p>
              <p className="text-xs">Decomposing subqueries, evaluating performance, discovering opportunities</p>
            </div>
          </div>
        ) : (
          <pre
            ref={codeRef}
            className="bg-card/50 border rounded-lg p-4 overflow-auto text-sm leading-relaxed"
          >
            {renderAnnotatedSQL()}
          </pre>
        )}

        {/* Legend */}
        {subqueries.length > 0 && (
          <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
            <span className="font-medium">Legend:</span>
            <span className="flex items-center gap-1"><CheckCircle className="w-3 h-3 text-emerald-500" /> Good</span>
            <span className="flex items-center gap-1"><Info className="w-3 h-3 text-blue-500" /> Info</span>
            <span className="flex items-center gap-1"><AlertTriangle className="w-3 h-3 text-amber-500" /> Warning</span>
            <span className="flex items-center gap-1"><AlertCircle className="w-3 h-3 text-red-500" /> Critical</span>
          </div>
        )}
      </div>
    </div>
  );
}
