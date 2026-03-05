/**
 * API Connection node lifecycle handlers.
 * Posts content to connected social platforms via OAuth.
 */

import { apiRequest } from "@/lib/queryClient";
import type { NodeLifecycleHandlers, NodeProcessContext } from "../useNodeLifecycle";

export function createApiConnectionHandlers(): NodeLifecycleHandlers {
  return {
    onPreProcess: async (ctx: NodeProcessContext) => {
      const platform = ctx.node.apiService;
      return (
        !!platform &&
        platform !== "webhook" &&
        platform !== "custom" &&
        ctx.combinedInputContent.trim().length > 0
      );
    },

    onProcess: async (ctx: NodeProcessContext) => {
      const platform = ctx.node.apiService;
      const res = await apiRequest("POST", "/api/social/post", {
        platform,
        content: ctx.combinedInputContent,
      });
      const data = (await res.json()) as {
        success: boolean;
        externalPostId?: string;
        externalPostUrl?: string;
        error?: string;
      };
      return JSON.stringify(data);
    },
  };
}
