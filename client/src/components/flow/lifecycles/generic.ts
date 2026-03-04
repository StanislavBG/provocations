/**
 * Generic node lifecycle handlers.
 * Used for timeline, filter, gate, router, merge, and any other
 * node type that processes via /api/write.
 */

import { apiRequest } from "@/lib/queryClient";
import type { NodeLifecycleHandlers, NodeProcessContext } from "../useNodeLifecycle";

export function createGenericHandlers(): NodeLifecycleHandlers {
  return {
    onPreProcess: async (ctx: NodeProcessContext) => {
      return ctx.combinedInputContent.trim().length > 0;
    },

    onProcess: async (ctx: NodeProcessContext) => {
      const res = await apiRequest("POST", "/api/write", {
        document: ctx.combinedInputContent,
        instruction: `Process this content for the purpose: ${ctx.node.label}`,
        appType: "write-a-prompt",
      });
      const data = (await res.json()) as { document: string };
      return data.document || "";
    },
  };
}
