/**
 * LLM node lifecycle handlers.
 * Uses the preset system (Summarize, Clean Up, Expand, Custom) to process input.
 */

import { apiRequest } from "@/lib/queryClient";
import type { NodeLifecycleHandlers, NodeProcessContext } from "../useNodeLifecycle";
import { getPreset } from "../llm-presets";

export function createLlmHandlers(): NodeLifecycleHandlers {
  return {
    onPreProcess: async (ctx: NodeProcessContext) => {
      const preset = getPreset(ctx.node.llmPresetId);
      // Custom preset requires an objective
      if (preset.id === "custom" && !(ctx.node.llmObjective?.trim())) {
        return false;
      }
      return (
        ctx.combinedInputContent.trim().length > 0 ||
        (ctx.node.llmObjective?.trim()?.length ?? 0) > 0
      );
    },

    onProcess: async (ctx: NodeProcessContext) => {
      const preset = getPreset(ctx.node.llmPresetId);
      const objective = ctx.objectiveText || ctx.node.llmObjective || preset.defaultObjective || "Process this content";
      const inputText = ctx.contextText || ctx.combinedInputContent || ctx.node.content || "";

      const body = preset.buildRequest(inputText, objective);
      const res = await apiRequest("POST", preset.endpoint, body);
      const data = await res.json();
      return preset.extractOutput(data as Record<string, unknown>) || "";
    },
  };
}
