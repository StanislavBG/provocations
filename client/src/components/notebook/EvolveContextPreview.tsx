/**
 * EvolveContextPreview — adapter for the Evolve button's LLM call preview.
 *
 * Builds ContextBlock[] and SummaryItem[] from the Evolve-specific context
 * (document, objective, configurations, pinned docs, notes, edit history)
 * and delegates rendering to the generic LlmCallPreview widget.
 */

import { useMemo } from "react";
import { LlmCallPreview, type ContextBlock, type SummaryItem } from "@/components/LlmCallPreview";
import { Badge } from "@/components/ui/badge";
import type { ContextItem, EditHistoryEntry } from "@shared/schema";
import type { WriterConfig } from "./SplitDocumentEditor";
import {
  FileText,
  Target,
  Settings2,
  StickyNote,
  Pin,
  History,
  ScrollText,
  Braces,
} from "lucide-react";

export interface EvolveContextPreviewProps {
  text: string;
  objective?: string;
  configurations: WriterConfig[];
  capturedContext?: ContextItem[];
  pinnedDocContents?: Record<number, { title: string; content: string }>;
  sessionNotes?: string;
  editHistory?: EditHistoryEntry[];
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
  const pinnedDocs = Object.values(pinnedDocContents);

  const blocks: ContextBlock[] = useMemo(() => {
    const configText = configurations
      .map((c) => `${c.categoryLabel}: ${c.optionLabel}`)
      .join("; ");
    const systemPromptChars = appType ? 1200 : 800;

    return [
      { label: "System Prompt", chars: systemPromptChars, color: "text-purple-400" },
      { label: "Document", chars: text.length, color: "text-blue-400" },
      { label: "Objective", chars: objective?.length ?? 0, color: "text-amber-400" },
      { label: "Configurations", chars: configText.length, color: "text-emerald-400" },
      { label: "Pinned Docs", chars: pinnedDocs.reduce((s, d) => s + d.title.length + d.content.length, 0), color: "text-cyan-400" },
      { label: "Notes", chars: capturedContext.reduce((s, c) => s + c.content.length, 0), color: "text-orange-400" },
      { label: "Session Notes", chars: sessionNotes.length, color: "text-pink-400" },
      { label: "Edit History", chars: editHistory.reduce((s, e) => s + e.instruction.length + e.summary.length, 0), color: "text-violet-400" },
    ];
  }, [text, objective, configurations, capturedContext, pinnedDocs, sessionNotes, editHistory, appType]);

  const summaryItems: SummaryItem[] = useMemo(() => {
    const items: SummaryItem[] = [
      {
        icon: <Settings2 className="w-3 h-3 text-emerald-400" />,
        label: "Configurations",
        count: configurations.length,
        emptyLabel: "General improvement",
        children: configurations.length > 0 ? (
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
        ) : undefined,
      },
      {
        icon: <Pin className="w-3 h-3 text-cyan-400" />,
        label: "Active Context Docs",
        count: pinnedDocs.length,
        children: pinnedDocs.length > 0 ? (
          <div className="mt-1 space-y-0.5">
            {pinnedDocs.slice(0, 4).map((d, i) => (
              <div key={i} className="text-[10px] text-gray-500 truncate pl-4">{d.title}</div>
            ))}
            {pinnedDocs.length > 4 && (
              <div className="text-[10px] text-gray-600 pl-4">+{pinnedDocs.length - 4} more</div>
            )}
          </div>
        ) : undefined,
      },
      {
        icon: <StickyNote className="w-3 h-3 text-orange-400" />,
        label: "Captured Notes",
        count: capturedContext.length,
      },
      {
        icon: <ScrollText className="w-3 h-3 text-pink-400" />,
        label: "Session Notes",
        count: sessionNotes.length > 0 ? 1 : 0,
        detail: sessionNotes.length > 0 ? `${sessionNotes.length.toLocaleString()} chars` : undefined,
      },
      {
        icon: <History className="w-3 h-3 text-violet-400" />,
        label: "Edit History",
        count: editHistory.length,
        detail: editHistory.length > 0 ? `${editHistory.length} previous edit${editHistory.length > 1 ? "s" : ""}` : undefined,
      },
      {
        icon: <Target className="w-3 h-3 text-amber-400" />,
        label: "Objective",
        count: objective?.trim() ? 1 : 0,
        detail: objective?.trim() ? objective.slice(0, 60) + (objective.length > 60 ? "..." : "") : undefined,
      },
      {
        icon: <FileText className="w-3 h-3 text-blue-400" />,
        label: "Document",
        count: text.trim() ? 1 : 0,
        detail: text.trim() ? `${text.split(/\s+/).filter(Boolean).length} words` : undefined,
      },
    ];

    if (appType) {
      items.push({
        icon: <Braces className="w-3 h-3 text-purple-400" />,
        label: "App Context",
        count: 1,
        detail: appType,
      });
    }

    return items;
  }, [configurations, pinnedDocs, capturedContext, sessionNotes, editHistory, objective, text, appType]);

  return (
    <LlmCallPreview
      title="Evolve"
      blocks={blocks}
      summaryItems={summaryItems}
    />
  );
}
