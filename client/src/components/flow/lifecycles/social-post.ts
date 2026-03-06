/**
 * Social Post node lifecycle handlers.
 * Generates platform-specific social posts from upstream content.
 * Handles image passthrough from upstream nodes and optional image generation.
 */

import { apiRequest } from "@/lib/queryClient";
import type { NodeLifecycleHandlers, NodeProcessContext } from "../useNodeLifecycle";

/** Extract an image URL from upstream nodes, checking both direct imageUrl fields
 *  and painter-format output text (IMAGE:url lines in combinedInputContent). */
function findUpstreamImage(ctx: NodeProcessContext): string | undefined {
  // 1. Check direct imageUrl on input nodes (works for painter nodes and image documents)
  const directImages = (ctx.inputNodes || [])
    .map((n) => n.imageUrl)
    .filter((url): url is string => !!url);
  if (directImages.length > 0) return directImages[0];

  // 2. Parse combinedInputContent for IMAGE: prefix (painter lifecycle output format)
  const imageMatch = ctx.combinedInputContent.match(/^IMAGE:(.+)/m);
  if (imageMatch?.[1]) return imageMatch[1].trim();

  return undefined;
}

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

      // Generate text posts
      const res = await apiRequest("POST", "/api/social/generate", {
        content: ctx.combinedInputContent,
        platforms: enabledPlatforms,
        intent: ctx.node.socialIntent || "marketing",
        tone: ctx.node.socialTone || "professional",
      });
      const data = (await res.json()) as {
        posts: Record<string, { text: string; hashtags?: string[]; characterCount: number }>;
      };

      // Resolve image: generate if toggled on, else use upstream image
      let imageUrl: string | undefined;
      if (ctx.node.socialGenerateImages) {
        try {
          const imgRes = await apiRequest("POST", "/api/generate-image", {
            prompt: `Social media image for: ${ctx.combinedInputContent.slice(0, 500)}`,
          });
          const imgData = (await imgRes.json()) as { imageUrl?: string };
          if (imgData.imageUrl) imageUrl = imgData.imageUrl;
        } catch {
          // Image generation is best-effort — fall through to upstream image
        }
      }
      // Always fall back to upstream image if no generated image
      if (!imageUrl) {
        imageUrl = findUpstreamImage(ctx);
      }

      // Return posts + imageUrl as enriched JSON
      return JSON.stringify({ posts: data.posts || {}, imageUrl });
    },
  };
}
