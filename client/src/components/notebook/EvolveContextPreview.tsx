/**
 * EvolveContextPreview — rich hover widget for the Evolve button.
 *
 * Two-tab design:
 *   "Perf" (Performance)  — Token & cost estimation for the upcoming LLM call
 *   "Summary"             — Human-readable breakdown of what will be applied
 *
 * Rendered inside a HoverCard triggered by the Evolve button so users can
 * inspect exactly what context the LLM will receive before clicking.
 */

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { formatTokens, formatCost } from "@/lib/llm-verbose";
import type { ContextItem, EditHistoryEntry } from "@shared/schema";
import type { WriterConfig } from "./SplitDocumentEditor";
import {
  Cpu,
  DollarSign,
  FileText,
  Target,
  Settings2,
  StickyNote,
  Pin,
  History,
  ScrollText,
  Layers,
  Gauge,
  Braces,
} from "lucide-react";

// ── Client-side cost table (mirrors server/llm-gateway.ts) ──
// Per-million-token pricing in microdollars ($1 = 1,000,000)
const COST_TABLE: Record<string, { input: number; output: number }> = {
  "gpt-4o":             { input: 2_500_000, output: 10_000_000 },
  "gpt-4o-mini":        { input: 150_000,   output: 600_000 },
  "o4-mini":            { input: 1_100_000, output: 4_400_000 },
  "claude-sonnet-4-5-20250929": { input: 3_000_000, output: 15_000_000 },
  "claude-haiku-4-5":   { input: 1_000_000, output: 5_000_000 },
  "gemini-2.5-pro":     { input: 1_250_000, output: 10_000_000 },
  "gemini-2.5-flash":   { input: 150_000,   output: 625_000 },
  "gemini-2.5-flash-lite": { input: 75_000, output: 300_000 },
};

const CHARS_PER_TOKEN = 4;

function estimateTokens(chars: number): number {
  return Math.ceil(chars / CHARS_PER_TOKEN);
}

function estimateInputCost(model: string, inputTokens: number): number {
  const pricing = COST_TABLE[model];
  if (!pricing) return 0;
  return Math.round((inputTokens / 1_000_000) * pricing.input);
}

// ── Types ──

interface ContextBlock {
  label: string;
  chars: number;
  tokens: number;
  pct: number; // 0-100
  color: string;
}

export interface EvolveContextPreviewProps {
  /** Current document text */
  text: string;
  /** Current objective */
  objective?: string;
  /** Selected writer configurations (from smart buttons) */
  configurations: WriterConfig[];
  /** Captured context items (notes, etc.) */
  capturedContext?: ContextItem[];
  /** Pinned document contents */
  pinnedDocContents?: Record<number, { title: string; content: string }>;
  /** Session notes text */
  sessionNotes?: string;
  /** Edit history entries */
  editHistory?: EditHistoryEntry[];
  /** The selected app/template type */
  appType?: string;
}

export function EvolveContextPreview({
  text,
  objective,
  configurations,
  capturedContext = [],
  pinnedDocContents = {},
  sessionNotes = "",
  editHistory = [],
  appType,
}: EvolveContextPreviewProps) {
  // Fetch current model info
  const { data: modelData } = useQuery<{ defaultModel: string }>({
    queryKey: ["/api/chat/models"],
    staleTime: 60_000,
  });
  const model = modelData?.defaultModel ?? "gpt-4o";

  // ── Compute context blocks ──
  const { blocks, totalChars, totalTokens, estimatedCost } = useMemo(() => {
    const pinnedDocs = Object.values(pinnedDocContents);
    const configText = configurations
      .map((c) => `${c.categoryLabel}: ${c.optionLabel}`)
      .join("; ");

    // Rough estimate for system prompt (~800 chars base + app guidance)
    const systemPromptChars = appType ? 1200 : 800;

    const raw: Omit<ContextBlock, "pct">[] = [
      { label: "System Prompt", chars: systemPromptChars, tokens: estimateTokens(systemPromptChars), color: "text-purple-400" },
      { label: "Document", chars: text.length, tokens: estimateTokens(text.length), color: "text-blue-400" },
      { label: "Objective", chars: objective?.length ?? 0, tokens: estimateTokens(objective?.length ?? 0), color: "text-amber-400" },
      { label: "Configurations", chars: configText.length, tokens: estimateTokens(configText.length), color: "text-emerald-400" },
      {
        label: "Pinned Docs",
        chars: pinnedDocs.reduce((s, d) => s + d.title.length + d.content.length, 0),
        tokens: estimateTokens(pinnedDocs.reduce((s, d) => s + d.title.length + d.content.length, 0)),
        color: "text-cyan-400",
      },
      {
        label: "Notes",
        chars: capturedContext.reduce((s, c) => s + c.content.length, 0),
        tokens: estimateTokens(capturedContext.reduce((s, c) => s + c.content.length, 0)),
        color: "text-orange-400",
      },
      { label: "Session Notes", chars: sessionNotes.length, tokens: estimateTokens(sessionNotes.length), color: "text-pink-400" },
      {
        label: "Edit History",
        chars: editHistory.reduce((s, e) => s + e.instruction.length + e.summary.length, 0),
        tokens: estimateTokens(editHistory.reduce((s, e) => s + e.instruction.length + e.summary.length, 0)),
        color: "text-violet-400",
      },
    ];

    const total = raw.reduce((s, b) => s + b.chars, 0);
    const blocks: ContextBlock[] = raw
      .filter((b) => b.chars > 0)
      .map((b) => ({
        ...b,
        pct: total > 0 ? Math.round((b.chars / total) * 100) : 0,
      }));

    const totalTok = estimateTokens(total);
    const cost = estimateInputCost(model, totalTok);
    return { blocks, totalChars: total, totalTokens: totalTok, estimatedCost: cost };
  }, [text, objective, configurations, capturedContext, pinnedDocContents, sessionNotes, editHistory, appType, model]);

  const pinnedDocs = Object.values(pinnedDocContents);

  return (
    <div className="w-[420px] border border-amber-500/30 bg-[#1a1412] rounded-lg text-xs font-mono shadow-2xl overflow-hidden">
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-amber-500/20 bg-amber-950/30">
        <div className="flex items-center gap-2">
          <Cpu className="w-3.5 h-3.5 text-amber-500" />
          <span className="text-amber-400 font-semibold text-[11px]">Evolve — Context Preview</span>
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
            {blocks.map((b) => (
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
            {blocks.map((b) => (
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
            <span>Input pricing: {COST_TABLE[model] ? `$${(COST_TABLE[model].input / 1_000_000).toFixed(2)}/1M tok` : "unknown"}</span>
            <span>~{CHARS_PER_TOKEN} chars/token</span>
          </div>
        </TabsContent>

        {/* ── Tab 2: Summary ── */}
        <TabsContent value="summary" className="mt-0 p-3 space-y-1">
          {/* Configurations */}
          <SummaryRow
            icon={<Settings2 className="w-3 h-3 text-emerald-400" />}
            label="Configurations"
            count={configurations.length}
            emptyLabel="General improvement"
          >
            {configurations.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {configurations.map((c) => (
                  <Badge
                    key={`${c.category}-${c.option}`}
                    variant="outline"
                    className="text-[9px] py-0 px-1.5 border-emerald-500/30 text-emerald-300"
                  >
                    {c.categoryLabel}: {c.optionLabel}
                  </Badge>
                ))}
              </div>
            )}
          </SummaryRow>

          {/* Pinned context docs */}
          <SummaryRow
            icon={<Pin className="w-3 h-3 text-cyan-400" />}
            label="Active Context Docs"
            count={pinnedDocs.length}
          >
            {pinnedDocs.length > 0 && (
              <div className="mt-1 space-y-0.5">
                {pinnedDocs.slice(0, 4).map((d, i) => (
                  <div key={i} className="text-[10px] text-gray-500 truncate pl-4">
                    {d.title}
                  </div>
                ))}
                {pinnedDocs.length > 4 && (
                  <div className="text-[10px] text-gray-600 pl-4">
                    +{pinnedDocs.length - 4} more
                  </div>
                )}
              </div>
            )}
          </SummaryRow>

          {/* Captured notes */}
          <SummaryRow
            icon={<StickyNote className="w-3 h-3 text-orange-400" />}
            label="Captured Notes"
            count={capturedContext.length}
          />

          {/* Session notes */}
          <SummaryRow
            icon={<ScrollText className="w-3 h-3 text-pink-400" />}
            label="Session Notes"
            count={sessionNotes.length > 0 ? 1 : 0}
            detail={sessionNotes.length > 0 ? `${sessionNotes.length.toLocaleString()} chars` : undefined}
          />

          {/* Edit history */}
          <SummaryRow
            icon={<History className="w-3 h-3 text-violet-400" />}
            label="Edit History"
            count={editHistory.length}
            detail={editHistory.length > 0 ? `${editHistory.length} previous edit${editHistory.length > 1 ? "s" : ""}` : undefined}
          />

          {/* Objective */}
          <SummaryRow
            icon={<Target className="w-3 h-3 text-amber-400" />}
            label="Objective"
            count={objective?.trim() ? 1 : 0}
            detail={objective?.trim() ? objective.slice(0, 60) + (objective.length > 60 ? "..." : "") : undefined}
          />

          {/* Document */}
          <SummaryRow
            icon={<FileText className="w-3 h-3 text-blue-400" />}
            label="Document"
            count={text.trim() ? 1 : 0}
            detail={text.trim() ? `${text.split(/\s+/).filter(Boolean).length} words` : undefined}
          />

          {/* App type */}
          {appType && (
            <SummaryRow
              icon={<Braces className="w-3 h-3 text-purple-400" />}
              label="App Context"
              count={1}
              detail={appType}
            />
          )}
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
}: {
  icon: React.ReactNode;
  label: string;
  count: number;
  emptyLabel?: string;
  detail?: string;
  children?: React.ReactNode;
}) {
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
