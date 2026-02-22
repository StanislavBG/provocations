/**
 * Token Counter — estimates and displays token counts for agent steps.
 *
 * Uses a simple char/4 heuristic (roughly matches GPT tokenizer for English).
 * Color-coded: green (< 50% of limit), amber (50-80%), red (> 80%).
 */

import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";

interface TokenCounterProps {
  /** The text to estimate tokens for */
  text: string;
  /** Maximum token budget for this field (default 128000) */
  limit?: number;
  /** Compact mode — badge only, no label */
  compact?: boolean;
  /** Optional label prefix */
  label?: string;
}

/** Estimate token count from text using char/4 heuristic */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

export default function TokenCounter({
  text,
  limit = 128000,
  compact = false,
  label,
}: TokenCounterProps) {
  const tokens = useMemo(() => estimateTokens(text), [text]);
  const ratio = tokens / limit;

  const colorClass =
    ratio > 0.8
      ? "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400 border-red-300 dark:border-red-700"
      : ratio > 0.5
        ? "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border-amber-300 dark:border-amber-700"
        : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border-emerald-300 dark:border-emerald-700";

  if (compact) {
    return (
      <Badge variant="outline" className={`text-[10px] font-mono ${colorClass}`}>
        {tokens.toLocaleString()} tok
      </Badge>
    );
  }

  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      {label && <span className="font-medium">{label}</span>}
      <Badge variant="outline" className={`text-[10px] font-mono ${colorClass}`}>
        {tokens.toLocaleString()} / {limit.toLocaleString()} tokens
      </Badge>
      <span className="text-[10px]">({Math.round(ratio * 100)}%)</span>
    </div>
  );
}

/** Summary token counter for multiple steps */
export function TokenSummary({
  stepTokens,
  limit = 128000,
}: {
  stepTokens: { name: string; tokens: number }[];
  limit?: number;
}) {
  const total = stepTokens.reduce((sum, s) => sum + s.tokens, 0);
  const ratio = total / limit;

  const colorClass =
    ratio > 0.8
      ? "text-red-600 dark:text-red-400"
      : ratio > 0.5
        ? "text-amber-600 dark:text-amber-400"
        : "text-emerald-600 dark:text-emerald-400";

  return (
    <div className="space-y-1 p-3 rounded-md border border-border bg-muted/30">
      <div className="flex items-center justify-between text-xs font-medium">
        <span>Total Token Estimate</span>
        <span className={`font-mono ${colorClass}`}>
          {total.toLocaleString()} / {limit.toLocaleString()}
        </span>
      </div>
      <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${
            ratio > 0.8
              ? "bg-red-500"
              : ratio > 0.5
                ? "bg-amber-500"
                : "bg-emerald-500"
          }`}
          style={{ width: `${Math.min(ratio * 100, 100)}%` }}
        />
      </div>
      {stepTokens.length > 0 && (
        <div className="space-y-0.5 mt-2">
          {stepTokens.map((s) => (
            <div key={s.name} className="flex items-center justify-between text-[10px] text-muted-foreground">
              <span className="truncate max-w-[60%]">{s.name}</span>
              <span className="font-mono">{s.tokens.toLocaleString()}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
