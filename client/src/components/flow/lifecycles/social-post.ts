/**
 * Social Post node lifecycle handlers.
 * Generates platform-specific social posts from upstream content.
 */

import { apiRequest } from "@/lib/queryClient";
import type { NodeLifecycleHandlers, NodeProcessContext } from "../useNodeLifecycle";

export function createSocialPostHandlers(): NodeLifecycleHandlers {
  return {
    onPreProcess: async (ctx: NodeProcessContext) => {
      const platforms = ctx.node.socialPlatforms || {};
      const enabled = Object.entries(platforms).filter(([, v]) => v);
      return enabled.length > 0 && ctx.combinedInputContent.trim().length > 0;
    },

    onProcess: async (ctx: NodeProcessContext) => {
      const platforms = ctx.node.socialPlatforms || {};
      const enabledPlatforms = Object.entries(platforms)
        .filter(([, v]) => v)
        .map(([k]) => k);

      const res = await apiRequest("POST", "/api/social/generate", {
        content: ctx.combinedInputContent,
        platforms: enabledPlatforms,
        intent: ctx.node.socialIntent || "marketing",
        tone: ctx.node.socialTone || "professional",
      });
      const data = (await res.json()) as {
        posts: Record<string, { text: string; hashtags?: string[]; characterCount: number }>;
      };
      return JSON.stringify(data.posts || {});
    },
  };
}
