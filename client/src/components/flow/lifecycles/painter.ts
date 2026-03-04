/**
 * Painter node lifecycle handlers.
 * Summarizes input for a visual prompt, then generates an image via Gemini Imagen.
 */

import { apiRequest } from "@/lib/queryClient";
import type { NodeLifecycleHandlers, NodeProcessContext } from "../useNodeLifecycle";

export function createPainterHandlers(): NodeLifecycleHandlers {
  return {
    onPreProcess: async (ctx: NodeProcessContext) => {
      return ctx.combinedInputContent.trim().length > 0;
    },

    onProcess: async (ctx: NodeProcessContext) => {
      // Step 1: Summarize input into a visual prompt
      const summaryRes = await apiRequest("POST", "/api/summarize-intent", {
        transcript: ctx.combinedInputContent.slice(0, 8000),
        context: "visual",
        mode: "clean",
      });
      const summaryData = (await summaryRes.json()) as { summary?: string };
      const imagePrompt = summaryData.summary || ctx.combinedInputContent.slice(0, 500);

      // Step 2: Generate image
      const imgRes = await apiRequest("POST", "/api/generate-imagen", {
        prompt: imagePrompt,
        style: "Illustration, Vibrant mood",
        aspectRatio: "16:9",
        numberOfImages: 1,
      });
      const imgData = (await imgRes.json()) as { images?: string[]; error?: string };

      if (imgData.images && imgData.images.length > 0) {
        // Return a structured result: prompt + image URL separated by a delimiter
        return `PROMPT:${imagePrompt}\nIMAGE:${imgData.images[0]}`;
      }

      throw new Error(imgData.error || "Image generation failed");
    },
  };
}

/** Parse the structured output from painter process */
export function parsePainterOutput(output: string): { prompt: string; imageUrl: string } {
  const promptMatch = output.match(/^PROMPT:(.+)/m);
  const imageMatch = output.match(/^IMAGE:(.+)/m);
  return {
    prompt: promptMatch?.[1] || "",
    imageUrl: imageMatch?.[1] || "",
  };
}
