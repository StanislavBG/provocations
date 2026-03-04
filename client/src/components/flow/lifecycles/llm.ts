/**
 * LLM node lifecycle handlers.
 * LLM nodes have their own Run button in the FlowLlmNode component,
 * so chain execution delegates to the existing preset-based processing.
 */

import { apiRequest } from "@/lib/queryClient";
import type { NodeLifecycleHandlers, NodeProcessContext } from "../useNodeLifecycle";
import { getPreset } from "../llm-presets";

export function createLlmHandlers(): NodeLifecycleHandlers {
  return {
    onPreProcess: async (ctx: NodeProcessContext) => {
      // LLM nodes need either input content or their own objective
      return (
        ctx.combinedInputContent.trim().length > 0 ||
        (ctx.node.llmObjective?.trim()?.length ?? 0) > 0
      );
    },

    onProcess: async (ctx: NodeProcessContext) => {
      const preset = getPreset(ctx.node.llmPresetId || "custom");
      const objective = ctx.node.llmObjective || preset.defaultObjective || "Process this content";
      const inputText = ctx.combinedInputContent || ctx.node.content || "";

      const res = await apiRequest("POST", "/api/write", {
        document: inputText,
        instruction: objective,
        appType: "write-a-prompt",
      });
      const data = (await res.json()) as { document: string };
      return data.document || "";
    },
  };
}
