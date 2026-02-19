import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { generateId } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { BarChart3, Loader2, Plus, Trash2, RefreshCw } from "lucide-react";
import type { ContextItem } from "@shared/schema";

export interface ExtractedMetric {
  id: string;
  name: string;
  definition: string;
  formula?: string;
  approved: boolean;
}

interface MetricExtractorPanelProps {
  documentText: string;
  onCaptureAsContext: (items: ContextItem[]) => void;
}

export function MetricExtractorPanel({
  documentText,
  onCaptureAsContext,
}: MetricExtractorPanelProps) {
  const { toast } = useToast();
  const [metrics, setMetrics] = useState<ExtractedMetric[]>([]);

  const extractMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/extract-metrics", {
        query: documentText,
      });
      return (await response.json()) as {
        metrics: Array<{ name: string; definition: string; formula?: string }>;
      };
    },
    onSuccess: (data) => {
      setMetrics(
        data.metrics.map((m, i) => ({
          id: `metric-${i}-${Date.now()}`,
          ...m,
          approved: false,
        })),
      );
    },
    onError: (error) => {
      toast({
        title: "Extraction Failed",
        description:
          error instanceof Error ? error.message : "Could not extract metrics",
        variant: "destructive",
      });
    },
  });

  const toggleMetric = (id: string) => {
    setMetrics((prev) =>
      prev.map((m) => (m.id === id ? { ...m, approved: !m.approved } : m)),
    );
  };

  const toggleAll = () => {
    const allApproved = metrics.every((m) => m.approved);
    setMetrics((prev) => prev.map((m) => ({ ...m, approved: !allApproved })));
  };

  const removeMetric = (id: string) => {
    setMetrics((prev) => prev.filter((m) => m.id !== id));
  };

  const approvedMetrics = metrics.filter((m) => m.approved);

  const handleCapture = () => {
    const contextItems: ContextItem[] = approvedMetrics.map((m) => ({
      id: generateId("ctx"),
      type: "text" as const,
      content: `**${m.name}**: ${m.definition}${m.formula ? ` (Formula: ${m.formula})` : ""}`,
      annotation: "Extracted metric definition",
      createdAt: Date.now(),
    }));
    onCaptureAsContext(contextItems);
    // Mark captured metrics as no longer approved (visual feedback)
    setMetrics((prev) =>
      prev.map((m) => (m.approved ? { ...m, approved: false } : m)),
    );
    toast({
      title: "Metrics Captured",
      description: `${contextItems.length} metric${contextItems.length !== 1 ? "s" : ""} added as context.`,
    });
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b bg-muted/20 shrink-0">
        <BarChart3 className="w-4 h-4 text-primary" />
        <h3 className="font-semibold text-sm">Metrics</h3>
        <div className="flex-1" />
        {metrics.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="gap-1 text-xs h-7"
            onClick={() => extractMutation.mutate()}
            disabled={extractMutation.isPending || !documentText.trim()}
            title="Re-extract metrics"
          >
            <RefreshCw className="w-3 h-3" />
          </Button>
        )}
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 text-xs h-7"
          onClick={() => extractMutation.mutate()}
          disabled={extractMutation.isPending || !documentText.trim()}
        >
          {extractMutation.isPending ? (
            <>
              <Loader2 className="w-3 h-3 animate-spin" />
              Extracting...
            </>
          ) : (
            <>
              <BarChart3 className="w-3 h-3" />
              Extract
            </>
          )}
        </Button>
      </div>

      {/* Metric list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {metrics.length === 0 && !extractMutation.isPending && (
          <div className="text-center py-8 text-muted-foreground text-sm">
            <BarChart3 className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p>No metrics extracted yet.</p>
            <p className="text-xs mt-1">
              Click &quot;Extract&quot; to analyze your query for metrics and
              KPIs.
            </p>
          </div>
        )}

        {extractMutation.isPending && (
          <div className="text-center py-8 text-muted-foreground text-sm">
            <Loader2 className="w-6 h-6 mx-auto mb-2 animate-spin opacity-50" />
            <p>Analyzing your query for metrics...</p>
          </div>
        )}

        {metrics.length > 0 && (
          <div className="flex items-center gap-2 pb-1">
            <button
              className="text-xs text-primary hover:underline"
              onClick={toggleAll}
            >
              {metrics.every((m) => m.approved) ? "Deselect all" : "Select all"}
            </button>
            <span className="text-xs text-muted-foreground">
              {metrics.length} metric{metrics.length !== 1 ? "s" : ""} found
            </span>
          </div>
        )}

        {metrics.map((metric) => (
          <div
            key={metric.id}
            className={`rounded-lg border p-3 transition-colors cursor-pointer ${
              metric.approved
                ? "border-primary/40 bg-primary/5"
                : "border-border bg-card/50 hover:border-border/80"
            }`}
            onClick={() => toggleMetric(metric.id)}
          >
            <div className="flex items-start gap-2.5">
              <Checkbox
                checked={metric.approved}
                onCheckedChange={() => toggleMetric(metric.id)}
                className="mt-0.5"
                onClick={(e) => e.stopPropagation()}
              />
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm leading-tight">
                  {metric.name}
                </div>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  {metric.definition}
                </p>
                {metric.formula && (
                  <code className="block mt-1.5 text-xs bg-muted rounded px-2 py-1 font-mono text-foreground/80">
                    {metric.formula}
                  </code>
                )}
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  removeMetric(metric.id);
                }}
                className="text-muted-foreground/50 hover:text-destructive transition-colors p-1 shrink-0"
                title="Remove metric"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Capture footer */}
      {approvedMetrics.length > 0 && (
        <div className="shrink-0 border-t p-3 bg-muted/20">
          <Button
            size="sm"
            className="w-full gap-1.5"
            onClick={handleCapture}
          >
            <Plus className="w-3.5 h-3.5" />
            Capture {approvedMetrics.length} metric
            {approvedMetrics.length !== 1 ? "s" : ""} as context
          </Button>
        </div>
      )}
    </div>
  );
}
