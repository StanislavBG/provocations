/**
 * LlmCallPreview — generic pre-call LLM transparency widget.
 *
 * ADR: Every user-facing button that triggers an LLM call MUST use this widget
 * (via LlmHoverButton) to show the user what context will be sent, estimated
 * tokens, and cost. See CLAUDE.md "ADR: LLM Button Widget" for the full rule.
 *
 * Two-tab design:
 *   "Perf"    — Token & cost estimation with stacked bar + block table
 *   "Summary" — Human-readable breakdown of what the call will include
 *
 * This is a GENERIC component — it receives pre-computed blocks and summary
 * items from the caller. Each LLM button builds its own blocks/items based
 * on the context it will send. See EvolveContextPreview for an example adapter.
 */

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { formatTokens, formatCost } from "@/lib/llm-verbose";
import {
  Cpu,
  DollarSign,
  FileText,
  Layers,
  Gauge,
} from "lucide-react";

// ── Client-side cost table (mirrors server/llm-gateway.ts) ──
// Per-million-token pricing in microdollars ($1 = 1,000,000)
// Keep in sync with server/llm-gateway.ts COST_TABLE.
export const LLM_COST_TABLE: Record<string, { input: number; output: number }> = {
  "gpt-4o":             { input: 2_500_000, output: 10_000_000 },
  "gpt-4o-mini":        { input: 150_000,   output: 600_000 },
  "o4-mini":            { input: 1_100_000, output: 4_400_000 },
  "claude-sonnet-4-5-20250929": { input: 3_000_000, output: 15_000_000 },
  "claude-haiku-4-5":   { input: 1_000_000, output: 5_000_000 },
  "gemini-2.5-pro":     { input: 1_250_000, output: 10_000_000 },
  "gemini-2.5-flash":   { input: 150_000,   output: 625_000 },
  "gemini-2.5-flash-lite": { input: 75_000, output: 300_000 },
};

export const CHARS_PER_TOKEN = 4;

export function estimateTokens(chars: number): number {
  return Math.ceil(chars / CHARS_PER_TOKEN);
}

export function estimateInputCost(model: string, inputTokens: number): number {
  const pricing = LLM_COST_TABLE[model];
  if (!pricing) return 0;
  return Math.round((inputTokens / 1_000_000) * pricing.input);
}

// ── Public types ──

/** A single context block for the Perf tab */
export interface ContextBlock {
  label: string;
  chars: number;
  color: string; // Tailwind text color class, e.g. "text-blue-400"
}

/** A single row for the Summary tab */
export interface SummaryItem {
  icon: React.ReactNode;
  label: string;
  count: number;
  /** Text shown when count is 0 */
  emptyLabel?: string;
  /** Extra detail text (truncated, shown right-aligned) */
  detail?: string;
  /** Optional child content (e.g., badge list, doc titles) */
  children?: React.ReactNode;
}

export interface LlmCallPreviewProps {
  /** Display title in the header (e.g., "Evolve", "Generate Provocations") */
  title: string;
  /** Context blocks for the Perf tab */
  blocks: ContextBlock[];
  /** Summary items for the Summary tab */
  summaryItems: SummaryItem[];
}

/** Hook to fetch the active LLM model ID */
export function useActiveModel(): string {
  const { data } = useQuery<{ defaultModel: string }>({
    queryKey: ["/api/chat/models"],
    staleTime: 60_000,
  });
  return data?.defaultModel ?? "gpt-4o";
}

export function LlmCallPreview({ title, blocks, summaryItems }: LlmCallPreviewProps) {
  const model = useActiveModel();

  // ── Compute derived values ──
  const { enrichedBlocks, totalChars, totalTokens, estimatedCost } = useMemo(() => {
    const filtered = blocks.filter((b) => b.chars > 0);
    const total = filtered.reduce((s, b) => s + b.chars, 0);
    const enriched = filtered.map((b) => ({
      ...b,
      tokens: estimateTokens(b.chars),
      pct: total > 0 ? Math.round((b.chars / total) * 100) : 0,
    }));
    const totalTok = estimateTokens(total);
    const cost = estimateInputCost(model, totalTok);
    return { enrichedBlocks: enriched, totalChars: total, totalTokens: totalTok, estimatedCost: cost };
  }, [blocks, model]);

  return (
    <div className="w-[420px] border border-amber-500/30 bg-[#1a1412] rounded-lg text-xs font-mono shadow-2xl overflow-hidden">
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-amber-500/20 bg-amber-950/30">
        <div className="flex items-center gap-2">
          <Cpu className="w-3.5 h-3.5 text-amber-500" />
          <span className="text-amber-400 font-semibold text-[11px]">{title} — Context Preview</span>
        </div>
        <Badge variant="outline" className="text-[9px] py-0 px-1.5 border-amber-500/40 text-amber-300 font-mono">
          {model}
        </Badge>
      </div>

      {/* ── Tabs ── */}
      <Tabs defaultValue="perf" className="w-full">
        <TabsList className="w-full h-7 rounded-none bg-amber-950/20 border-b border-amber-500/15 p-0 gap-0">
          <TabsTrigger
            value="perf"
            className="flex-1 h-7 rounded-none text-[10px] font-semibold uppercase tracking-wider data-[state=active]:bg-amber-950/40 data-[state=active]:text-amber-400 data-[state=active]:shadow-none text-gray-500 hover:text-gray-300 transition-colors gap-1"
          >
            <Gauge className="w-3 h-3" />
            Perf
          </TabsTrigger>
          <TabsTrigger
            value="summary"
            className="flex-1 h-7 rounded-none text-[10px] font-semibold uppercase tracking-wider data-[state=active]:bg-amber-950/40 data-[state=active]:text-amber-400 data-[state=active]:shadow-none text-gray-500 hover:text-gray-300 transition-colors gap-1"
          >
            <Layers className="w-3 h-3" />
            Summary
          </TabsTrigger>
        </TabsList>

        {/* ── Tab 1: Perf ── */}
        <TabsContent value="perf" className="mt-0 p-3 space-y-2.5">
          {/* Context stacked bar visualization */}
          <div className="h-2 rounded-full overflow-hidden flex bg-black/30">
            {enrichedBlocks.map((b) => (
              <div
                key={b.label}
                className={`h-full ${b.color.replace("text-", "bg-")} opacity-70`}
                style={{ width: `${Math.max(b.pct, 1)}%` }}
                title={`${b.label}: ${b.pct}%`}
              />
            ))}
          </div>

          {/* Context block table */}
          <div className="space-y-0.5">
            <div className="flex items-center justify-between text-[9px] text-gray-600 uppercase tracking-wider px-1 pb-0.5">
              <span>Block</span>
              <div className="flex items-center gap-4">
                <span className="w-14 text-right">Chars</span>
                <span className="w-12 text-right">Tokens</span>
                <span className="w-8 text-right">%</span>
              </div>
            </div>
            {enrichedBlocks.map((b) => (
              <div
                key={b.label}
                className="flex items-center justify-between px-1 py-0.5 rounded hover:bg-amber-950/20 transition-colors"
              >
                <div className="flex items-center gap-1.5">
                  <div className={`w-1.5 h-1.5 rounded-full ${b.color.replace("text-", "bg-")}`} />
                  <span className="text-gray-400">{b.label}</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="w-14 text-right text-gray-500">{b.chars.toLocaleString()}</span>
                  <span className="w-12 text-right text-gray-300">{formatTokens(b.tokens)}</span>
                  <span className="w-8 text-right text-gray-500">{b.pct}%</span>
                </div>
              </div>
            ))}
          </div>

          {/* Totals bar */}
          <div className="border-t border-amber-500/15 pt-2 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1 text-amber-300">
                <FileText className="w-3 h-3" />
                <span className="font-semibold">{formatTokens(totalTokens)}</span>
                <span className="text-gray-600">tokens</span>
              </span>
              <span className="text-gray-600">|</span>
              <span className="text-gray-500">{totalChars.toLocaleString()} chars</span>
            </div>
            <span className="flex items-center gap-1 text-green-400 font-semibold">
              <DollarSign className="w-3 h-3" />
              {estimatedCost > 0 ? formatCost(estimatedCost) : "—"}
              <span className="text-gray-600 font-normal text-[9px] ml-0.5">est.</span>
            </span>
          </div>

          {/* Model & pricing info */}
          <div className="text-[9px] text-gray-600 flex items-center justify-between">
            <span>Input pricing: {LLM_COST_TABLE[model] ? `$${(LLM_COST_TABLE[model].input / 1_000_000).toFixed(2)}/1M tok` : "unknown"}</span>
            <span>~{CHARS_PER_TOKEN} chars/token</span>
          </div>
        </TabsContent>

        {/* ── Tab 2: Summary ── */}
        <TabsContent value="summary" className="mt-0 p-3 space-y-1">
          {summaryItems.map((item, idx) => (
            <SummaryRow key={idx} {...item} />
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ── Summary row helper ──

function SummaryRow({
  icon,
  label,
  count,
  emptyLabel,
  detail,
  children,
}: SummaryItem) {
  const active = count > 0;
  return (
    <div className={`px-1 py-1 rounded transition-colors ${active ? "bg-amber-950/15" : ""}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {icon}
          <span className={active ? "text-gray-300" : "text-gray-600"}>{label}</span>
        </div>
        <div className="flex items-center gap-2">
          {detail && (
            <span className="text-[10px] text-gray-500 max-w-[180px] truncate">{detail}</span>
          )}
          {active ? (
            <Badge variant="outline" className="text-[9px] py-0 px-1.5 min-w-[20px] text-center border-amber-500/30 text-amber-300">
              {count}
            </Badge>
          ) : (
            <span className="text-[10px] text-gray-600">{emptyLabel ?? "none"}</span>
          )}
        </div>
      </div>
      {children}
    </div>
  );
}
