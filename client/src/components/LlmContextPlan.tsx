/**
 * LLM Context Plan — verbose mode overlay for LLM call transparency.
 *
 * Shows exactly what went into each LLM call:
 * - Model, provider, parameters
 * - Context size (characters, estimated tokens)
 * - Response size and cost
 * - System prompt preview
 * - Timing
 *
 * Renders as a collapsible panel at the bottom of any component that
 * triggers LLM calls, or as a floating toast-style summary.
 */

import { useState } from "react";
import { ChevronDown, ChevronUp, Cpu, DollarSign, Clock, FileText, Zap, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  type LlmVerboseEntry,
  formatTokens,
  formatCost,
  formatDuration,
  getProviderColor,
  totalCost,
  totalDuration,
} from "@/lib/llm-verbose";

interface LlmContextPlanProps {
  entries: LlmVerboseEntry[];
  /** Compact mode — shows just a summary bar, expandable to full details */
  compact?: boolean;
  /** Called when the user dismisses the panel */
  onDismiss?: () => void;
}

export function LlmContextPlan({ entries, compact = true, onDismiss }: LlmContextPlanProps) {
  const [expanded, setExpanded] = useState(!compact);
  const [expandedEntries, setExpandedEntries] = useState<Set<string>>(new Set());

  if (entries.length === 0) return null;

  const cost = totalCost(entries);
  const duration = totalDuration(entries);

  const toggleEntry = (callId: string) => {
    setExpandedEntries((prev) => {
      const next = new Set(prev);
      if (next.has(callId)) next.delete(callId);
      else next.add(callId);
      return next;
    });
  };

  return (
    <div className="border border-amber-500/30 bg-amber-950/20 rounded-lg text-xs font-mono">
      {/* Summary bar */}
      <button
        className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-amber-950/30 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          <Cpu className="w-3.5 h-3.5 text-amber-500" />
          <span className="text-amber-400 font-semibold">
            {entries.length} LLM call{entries.length !== 1 ? "s" : ""}
          </span>
          <Badge variant="outline" className="text-[10px] py-0 px-1.5 border-amber-500/40 text-amber-300">
            {entries[0].model}
          </Badge>
        </div>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1 text-amber-300/70">
            <FileText className="w-3 h-3" />
            {formatTokens(entries.reduce((s, e) => s + e.contextTokensEstimate, 0))} in
          </span>
          <span className="flex items-center gap-1 text-amber-300/70">
            <Zap className="w-3 h-3" />
            {formatTokens(entries.reduce((s, e) => s + e.responseTokensEstimate, 0))} out
          </span>
          <span className="flex items-center gap-1 text-green-400/70">
            <DollarSign className="w-3 h-3" />
            {formatCost(cost)}
          </span>
          <span className="flex items-center gap-1 text-blue-400/70">
            <Clock className="w-3 h-3" />
            {formatDuration(duration)}
          </span>
          {onDismiss && (
            <button
              className="ml-1 text-gray-500 hover:text-gray-300"
              onClick={(e) => { e.stopPropagation(); onDismiss(); }}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          {expanded ? <ChevronUp className="w-3.5 h-3.5 text-amber-500" /> : <ChevronDown className="w-3.5 h-3.5 text-amber-500" />}
        </div>
      </button>

      {/* Expanded details */}
      {expanded && (
        <div className="border-t border-amber-500/20 px-3 py-2 space-y-2">
          {entries.map((entry, idx) => (
            <div key={entry.callId} className="border border-amber-500/15 rounded bg-amber-950/10">
              {/* Entry header */}
              <button
                className="w-full flex items-center justify-between px-2 py-1 hover:bg-amber-950/20"
                onClick={() => toggleEntry(entry.callId)}
              >
                <div className="flex items-center gap-2">
                  <span className="text-amber-500/60">#{idx + 1}</span>
                  <span className={`font-semibold ${getProviderColor(entry.provider)}`}>
                    {entry.model}
                  </span>
                  <Badge variant="outline" className="text-[9px] py-0 px-1 border-gray-600 text-gray-400">
                    {entry.taskType}
                  </Badge>
                </div>
                <div className="flex items-center gap-2 text-gray-400">
                  <span>{formatTokens(entry.contextTokensEstimate)} → {formatTokens(entry.responseTokensEstimate)}</span>
                  <span className="text-green-400">{formatCost(entry.estimatedCostMicrodollars)}</span>
                  <span className="text-blue-400">{formatDuration(entry.durationMs)}</span>
                  {expandedEntries.has(entry.callId) ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </div>
              </button>

              {/* Entry details */}
              {expandedEntries.has(entry.callId) && (
                <div className="border-t border-amber-500/10 px-2 py-2 space-y-1.5 text-[10px]">
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                    <Detail label="Provider" value={entry.provider} />
                    <Detail label="Model" value={entry.model} />
                    <Detail label="Endpoint" value={entry.endpoint} />
                    <Detail label="Task Type" value={entry.taskType} />
                    {entry.appType && <Detail label="App Type" value={entry.appType} />}
                    <Detail label="Max Tokens" value={String(entry.maxTokens)} />
                    <Detail label="Temperature" value={String(entry.temperature)} />
                    <Detail label="Messages" value={String(entry.messageCount)} />
                    <Detail label="Streaming" value={entry.streaming ? "Yes" : "No"} />
                  </div>

                  <div className="border-t border-amber-500/10 pt-1.5 mt-1.5">
                    <div className="text-amber-400/60 mb-0.5">Context Metrics</div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                      <Detail label="System Prompt" value={`${entry.systemPromptCharacters.toLocaleString()} chars`} />
                      <Detail label="User Messages" value={`${entry.userMessageCharacters.toLocaleString()} chars`} />
                      <Detail label="Total Context" value={`${entry.totalContextCharacters.toLocaleString()} chars`} />
                      <Detail label="Est. Input Tokens" value={formatTokens(entry.contextTokensEstimate)} />
                      <Detail label="Response" value={`${entry.responseCharacters.toLocaleString()} chars`} />
                      <Detail label="Est. Output Tokens" value={formatTokens(entry.responseTokensEstimate)} />
                    </div>
                  </div>

                  {entry.systemPromptPreview && (
                    <div className="border-t border-amber-500/10 pt-1.5 mt-1.5">
                      <div className="text-amber-400/60 mb-0.5">System Prompt Preview</div>
                      <div className="bg-black/30 rounded p-1.5 text-gray-400 whitespace-pre-wrap break-words max-h-24 overflow-y-auto">
                        {entry.systemPromptPreview}
                        {entry.systemPromptCharacters > 300 && (
                          <span className="text-amber-500/50"> ...({entry.systemPromptCharacters - 300} more chars)</span>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="border-t border-amber-500/10 pt-1.5 mt-1.5">
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                      <Detail label="Duration" value={formatDuration(entry.durationMs)} />
                      <Detail label="Est. Cost" value={formatCost(entry.estimatedCostMicrodollars)} highlight />
                    </div>
                  </div>

                  <div className="text-gray-600 text-[9px] mt-1">
                    Call ID: {entry.callId}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Detail({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className="text-gray-500">{label}</span>
      <span className={highlight ? "text-green-400 font-semibold" : "text-gray-300"}>{value}</span>
    </div>
  );
}

/**
 * Floating verbose summary — shows as a small toast-like element.
 * Used to show LLM call metadata without interrupting the workflow.
 */
export function VerboseToast({ entries, onDismiss }: { entries: LlmVerboseEntry[]; onDismiss: () => void }) {
  if (entries.length === 0) return null;

  const cost = totalCost(entries);
  const duration = totalDuration(entries);

  return (
    <div className="fixed bottom-4 right-4 z-50 animate-in slide-in-from-bottom-2 fade-in duration-300">
      <div className="bg-amber-950/90 border border-amber-500/30 rounded-lg shadow-lg px-3 py-2 text-xs font-mono max-w-sm">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Cpu className="w-3.5 h-3.5 text-amber-500" />
            <span className="text-amber-400">
              {entries.length} LLM call{entries.length !== 1 ? "s" : ""}
            </span>
          </div>
          <div className="flex items-center gap-2 text-gray-400">
            <span className="text-green-400">{formatCost(cost)}</span>
            <span className="text-blue-400">{formatDuration(duration)}</span>
            <button onClick={onDismiss} className="text-gray-500 hover:text-gray-300">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
        {entries.map((e, i) => (
          <div key={e.callId} className="flex items-center gap-2 mt-1 text-[10px] text-gray-400">
            <span className={getProviderColor(e.provider)}>{e.model}</span>
            <span>{formatTokens(e.contextTokensEstimate)}→{formatTokens(e.responseTokensEstimate)}</span>
            <span className="text-green-400/60">{formatCost(e.estimatedCostMicrodollars)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
