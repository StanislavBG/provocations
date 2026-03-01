/**
 * LLM Trace Button — header button showing session LLM call trace.
 *
 * Replaces the floating yellow VerboseProvider panel. Shows a dropdown
 * with all LLM calls from the current session, including per-call details
 * and session aggregates (total cost, tokens, calls).
 *
 * Also listens to real-time verbose events so new calls appear immediately
 * without waiting for a server refetch.
 */

import { useState, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest, onVerboseData } from "@/lib/queryClient";
import {
  type LlmVerboseEntry,
  extractVerbose,
  formatTokens,
  formatCost,
  formatDuration,
  getProviderColor,
} from "@/lib/llm-verbose";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Cpu,
  DollarSign,
  Clock,
  FileText,
  Zap,
  ChevronDown,
  ChevronUp,
  Activity,
  Hash,
  AlertCircle,
} from "lucide-react";

interface SessionLog {
  callId: string;
  provider: string;
  model: string;
  taskType: string;
  endpoint: string;
  appType: string | null;
  contextTokensEstimate: number | null;
  contextCharacters: number | null;
  responseCharacters: number | null;
  responseTokensEstimate: number | null;
  maxTokens: number | null;
  temperature: number | null;
  estimatedCostMicrodollars: number | null;
  durationMs: number | null;
  status: string;
  errorMessage: string | null;
  streaming: boolean;
  createdAt: string;
}

interface SessionAggregates {
  totalCalls: number;
  totalCostMicrodollars: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalDurationMs: number;
  errorCount: number;
  byModel: { model: string; provider: string; calls: number; costMicrodollars: number; inputTokens: number; outputTokens: number }[];
  byTaskType: { taskType: string; calls: number; costMicrodollars: number; avgDurationMs: number }[];
  byAppType: { appType: string; calls: number; costMicrodollars: number }[];
}

interface SessionUsageResponse {
  logs: SessionLog[];
  aggregates: SessionAggregates;
}

export function LlmTraceButton() {
  const [open, setOpen] = useState(false);
  const [realtimeCount, setRealtimeCount] = useState(0);
  const [expandedCalls, setExpandedCalls] = useState<Set<string>>(new Set());

  const { data, refetch } = useQuery<SessionUsageResponse>({
    queryKey: ["/api/llm-session-usage"],
    queryFn: () => apiRequest("GET", "/api/llm-session-usage").then(r => r.json()),
    refetchInterval: open ? 10_000 : 60_000,
    staleTime: 5_000,
  });

  // Listen for real-time verbose events so the badge count updates immediately
  useEffect(() => {
    const unsub = onVerboseData((raw: unknown) => {
      const entries = extractVerbose(raw);
      if (entries && entries.length > 0) {
        setRealtimeCount(c => c + entries.length);
        // Refetch if panel is open
        if (open) refetch();
      }
    });
    return unsub;
  }, [open, refetch]);

  // Reset realtime counter when data refreshes
  useEffect(() => {
    if (data) setRealtimeCount(0);
  }, [data]);

  const toggleCall = useCallback((callId: string) => {
    setExpandedCalls(prev => {
      const next = new Set(prev);
      if (next.has(callId)) next.delete(callId);
      else next.add(callId);
      return next;
    });
  }, []);

  const logs = data?.logs ?? [];
  const agg = data?.aggregates;
  const displayCount = (agg?.totalCalls ?? 0) + realtimeCount;
  const displayCost = agg?.totalCostMicrodollars ?? 0;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={`h-7 px-2 gap-1.5 text-xs font-mono relative ${
            displayCount > 0
              ? "text-amber-400 hover:text-amber-300"
              : "text-gray-500 hover:text-gray-300"
          }`}
        >
          <Cpu className="w-3.5 h-3.5" />
          {displayCount > 0 && (
            <>
              <span className="text-[10px]">{formatCost(displayCost)}</span>
              <Badge
                variant="outline"
                className="h-4 px-1 text-[9px] border-amber-500/40 text-amber-300 ml-0.5"
              >
                {displayCount}
              </Badge>
            </>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent
        side="bottom"
        align="end"
        className="w-[520px] p-0 border-border"
      >
        {/* Header with aggregates */}
        <div className="px-3 py-2 border-b border-border bg-muted/30">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Activity className="w-3.5 h-3.5 text-amber-500" />
              <span className="text-xs font-semibold text-foreground">LLM Trace</span>
            </div>
            {agg && agg.errorCount > 0 && (
              <Badge variant="destructive" className="text-[9px] h-4 px-1.5">
                {agg.errorCount} error{agg.errorCount !== 1 ? "s" : ""}
              </Badge>
            )}
          </div>

          {agg && agg.totalCalls > 0 ? (
            <div className="grid grid-cols-4 gap-2 text-[10px] font-mono">
              <AggStat icon={<Hash className="w-3 h-3" />} label="Calls" value={String(agg.totalCalls)} />
              <AggStat icon={<FileText className="w-3 h-3" />} label="Input" value={formatTokens(agg.totalInputTokens)} />
              <AggStat icon={<Zap className="w-3 h-3" />} label="Output" value={formatTokens(agg.totalOutputTokens)} />
              <AggStat icon={<DollarSign className="w-3 h-3" />} label="Cost" value={formatCost(agg.totalCostMicrodollars)} highlight />
            </div>
          ) : (
            <div className="text-[10px] text-muted-foreground">No LLM calls yet in this session.</div>
          )}

          {/* Model breakdown */}
          {agg && agg.byModel.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {agg.byModel.map(m => (
                <Badge key={m.model} variant="outline" className="text-[9px] py-0 px-1.5 gap-1 border-border">
                  <span className={getProviderColor(m.provider)}>{m.model}</span>
                  <span className="text-muted-foreground">{m.calls}x</span>
                  <span className="text-green-400">{formatCost(m.costMicrodollars)}</span>
                </Badge>
              ))}
            </div>
          )}
        </div>

        {/* Call list */}
        <ScrollArea className="max-h-[400px]">
          <div className="p-1.5 space-y-1">
            {logs.length === 0 && (
              <div className="text-center text-xs text-muted-foreground py-6">
                No LLM calls recorded yet.
              </div>
            )}
            {logs.map((log, idx) => (
              <div
                key={log.callId}
                className="border border-border rounded text-xs font-mono"
              >
                {/* Call summary row */}
                <button
                  className="w-full flex items-center justify-between px-2 py-1 hover:bg-muted/30 transition-colors"
                  onClick={() => toggleCall(log.callId)}
                >
                  <div className="flex items-center gap-1.5">
                    <span className="text-muted-foreground text-[9px]">#{logs.length - idx}</span>
                    {log.status === "error" && <AlertCircle className="w-3 h-3 text-destructive" />}
                    <span className={`font-medium ${getProviderColor(log.provider)}`}>
                      {log.model}
                    </span>
                    <Badge variant="outline" className="text-[8px] py-0 px-1 border-border text-muted-foreground">
                      {log.taskType}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <span>{formatTokens(log.contextTokensEstimate ?? 0)}{" "}
                      <span className="text-muted-foreground/50">&rarr;</span>{" "}
                      {formatTokens(log.responseTokensEstimate ?? 0)}
                    </span>
                    <span className="text-green-400">{formatCost(log.estimatedCostMicrodollars ?? 0)}</span>
                    <span className="text-blue-400">{formatDuration(log.durationMs ?? 0)}</span>
                    {expandedCalls.has(log.callId) ? (
                      <ChevronUp className="w-3 h-3" />
                    ) : (
                      <ChevronDown className="w-3 h-3" />
                    )}
                  </div>
                </button>

                {/* Expanded details */}
                {expandedCalls.has(log.callId) && (
                  <div className="border-t border-border px-2 py-1.5 space-y-1 text-[10px]">
                    <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                      <DetailRow label="Provider" value={log.provider} />
                      <DetailRow label="Model" value={log.model} />
                      <DetailRow label="Endpoint" value={log.endpoint} />
                      <DetailRow label="Task Type" value={log.taskType} />
                      {log.appType && <DetailRow label="App Type" value={log.appType} />}
                      <DetailRow label="Max Tokens" value={String(log.maxTokens ?? "—")} />
                      <DetailRow label="Temperature" value={log.temperature != null ? (log.temperature / 100).toFixed(2) : "—"} />
                      <DetailRow label="Streaming" value={log.streaming ? "Yes" : "No"} />
                      <DetailRow label="Status" value={log.status} />
                    </div>
                    <div className="border-t border-border pt-1 mt-1">
                      <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                        <DetailRow label="Context Chars" value={`${(log.contextCharacters ?? 0).toLocaleString()}`} />
                        <DetailRow label="Est. Input Tokens" value={formatTokens(log.contextTokensEstimate ?? 0)} />
                        <DetailRow label="Response Chars" value={`${(log.responseCharacters ?? 0).toLocaleString()}`} />
                        <DetailRow label="Est. Output Tokens" value={formatTokens(log.responseTokensEstimate ?? 0)} />
                      </div>
                    </div>
                    <div className="border-t border-border pt-1 mt-1">
                      <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                        <DetailRow label="Duration" value={formatDuration(log.durationMs ?? 0)} />
                        <DetailRow label="Est. Cost" value={formatCost(log.estimatedCostMicrodollars ?? 0)} highlight />
                      </div>
                    </div>
                    {log.errorMessage && (
                      <div className="border-t border-border pt-1 mt-1 text-destructive">
                        {log.errorMessage}
                      </div>
                    )}
                    <div className="text-muted-foreground/50 text-[8px] mt-0.5">
                      {new Date(log.createdAt).toLocaleString()} &middot; {log.callId}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>

        {/* Footer with task type breakdown */}
        {agg && agg.byTaskType.length > 0 && (
          <div className="px-3 py-2 border-t border-border bg-muted/20 text-[9px] font-mono">
            <div className="text-muted-foreground mb-1">By task type:</div>
            <div className="flex flex-wrap gap-x-3 gap-y-0.5">
              {agg.byTaskType.map(t => (
                <span key={t.taskType} className="text-muted-foreground">
                  {t.taskType}{" "}
                  <span className="text-foreground">{t.calls}x</span>{" "}
                  <span className="text-green-400">{formatCost(t.costMicrodollars)}</span>{" "}
                  <span className="text-blue-400">~{formatDuration(t.avgDurationMs)}</span>
                </span>
              ))}
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

function AggStat({ icon, label, value, highlight }: { icon: React.ReactNode; label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex flex-col items-center gap-0.5 p-1 rounded bg-background/50 border border-border">
      <div className="flex items-center gap-1 text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
      <span className={`text-xs font-semibold ${highlight ? "text-green-400" : "text-foreground"}`}>{value}</span>
    </div>
  );
}

function DetailRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={highlight ? "text-green-400 font-semibold" : "text-foreground"}>{value}</span>
    </div>
  );
}
