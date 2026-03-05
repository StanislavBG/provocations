/**
 * Interview node lifecycle handlers.
 * In chain execution, outputs accumulated interview content
 * or synthesizes entries via /api/interview/summary.
 */

import { apiRequest } from "@/lib/queryClient";
import type { NodeLifecycleHandlers, NodeProcessContext } from "../useNodeLifecycle";

export function createInterviewHandlers(): NodeLifecycleHandlers {
  return {
    onPreProcess: async (ctx: NodeProcessContext) => {
      return (
        ctx.combinedInputContent.trim().length > 0 ||
        (ctx.node.content?.trim()?.length ?? 0) > 0 ||
        (ctx.node.interviewEntries?.length ?? 0) > 0
      );
    },

    onProcess: async (ctx: NodeProcessContext) => {
      const entries = ctx.node.interviewEntries;
      if (entries && entries.length > 0) {
        const res = await apiRequest("POST", "/api/interview/summary", {
          entries: entries.map((e) => ({ question: e.question, answer: e.answer })),
        });
        const data = (await res.json()) as { summary?: string };
        return data.summary || ctx.node.content || ctx.combinedInputContent;
      }
      return ctx.node.content || ctx.combinedInputContent;
    },
  };
}
