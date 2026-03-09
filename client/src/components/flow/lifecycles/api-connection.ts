/**
 * API Connection node lifecycle handlers.
 * Posts content to connected social platforms via OAuth, or sends
 * outgoing webhook requests to external URLs via server proxy.
 */

import { apiRequest } from "@/lib/queryClient";
import type { NodeLifecycleHandlers, NodeProcessContext } from "../useNodeLifecycle";

export function createApiConnectionHandlers(): NodeLifecycleHandlers {
  return {
    onPreProcess: async (ctx: NodeProcessContext) => {
      const platform = ctx.node.apiService;
      if (!platform) return false;
      if (ctx.combinedInputContent.trim().length === 0) return false;

      if (platform === "webhook") {
        return !!ctx.node.apiWebhookUrl;
      }
      if (platform === "custom") {
        return false; // custom not yet implemented
      }
      return true;
    },

    onProcess: async (ctx: NodeProcessContext) => {
      const platform = ctx.node.apiService;

      // Outgoing webhook — route through server proxy to avoid CORS
      if (platform === "webhook") {
        const res = await apiRequest("POST", "/api/webhook/outbound", {
          url: ctx.node.apiWebhookUrl,
          payload: {
            nodeId: ctx.node.id,
            nodeType: ctx.node.type,
            label: ctx.node.label,
            content: ctx.combinedInputContent,
            timestamp: new Date().toISOString(),
          },
        });
        const data = (await res.json()) as {
          success: boolean;
          status: number;
          statusText?: string;
          error?: string;
        };
        return JSON.stringify(data);
      }

      // Social platform posting
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
