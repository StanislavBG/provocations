/**
 * LLM Base node lifecycle handlers.
 * Direct, unrestricted LLM access with full model configuration.
 * System-instruction edges → system prompt; user-prompt edges → user message;
 * context edges → user context; manual prompts append after edge content.
 */

import { apiRequest } from "@/lib/queryClient";
import type { NodeLifecycleHandlers, NodeProcessContext } from "../useNodeLifecycle";
import { edgeHasRole } from "../useFlowCanvas";

export function createLlmBaseHandlers(): NodeLifecycleHandlers {
  return {
    onPreProcess: async (ctx: NodeProcessContext) => {
      // Need either a user prompt or input content
      const hasUserPrompt = (ctx.node.llmBaseUserPrompt?.trim()?.length ?? 0) > 0;
      const hasInput = ctx.combinedInputContent.trim().length > 0;
      return hasUserPrompt || hasInput;
    },

    onProcess: async (ctx: NodeProcessContext) => {
      // Build system prompt from system-instruction edges + manual system prompt
      const systemParts: string[] = [];

      // Gather system instructions from edges with role="system-instruction"
      for (const edge of ctx.inputEdges) {
        if (edgeHasRole(edge, "system-instruction")) {
          const sourceNode = ctx.inputNodes.find((n) => n.id === edge.fromNodeId);
          if (sourceNode) {
            const text = sourceNode.documentContent || sourceNode.content || sourceNode.snippet || "";
            if (text.trim()) systemParts.push(text.trim());
          }
        }
      }

      // Add manual system prompt
      if (ctx.node.llmBaseSystemPrompt?.trim()) {
        systemParts.push(ctx.node.llmBaseSystemPrompt.trim());
      }

      const system = systemParts.join("\n\n---\n\n") || "You are a helpful assistant.";

      // Build user message from user-prompt edges + context edges + manual user prompt
      const userParts: string[] = [];

      // 1. User-prompt edges (primary user message from connections)
      for (const edge of ctx.inputEdges) {
        if (edgeHasRole(edge, "user-prompt")) {
          const sourceNode = ctx.inputNodes.find((n) => n.id === edge.fromNodeId);
          if (sourceNode) {
            const text = sourceNode.documentContent || sourceNode.content || sourceNode.snippet || "";
            if (text.trim()) userParts.push(text.trim());
          }
        }
      }

      // 2. Context edges (non-system-instruction, non-user-prompt)
      for (const edge of ctx.inputEdges) {
        if (!edgeHasRole(edge, "system-instruction") && !edgeHasRole(edge, "user-prompt")) {
          const sourceNode = ctx.inputNodes.find((n) => n.id === edge.fromNodeId);
          if (sourceNode) {
            const text = sourceNode.documentContent || sourceNode.content || sourceNode.snippet || "";
            if (text.trim()) userParts.push(text.trim());
          }
        }
      }

      // 3. Manual user prompt (appended after edge content)
      if (ctx.node.llmBaseUserPrompt?.trim()) {
        userParts.push(ctx.node.llmBaseUserPrompt.trim());
      }

      const userMessage = userParts.join("\n\n") || "Hello";

      const body = {
        model: ctx.node.llmBaseModel || "gemini-2.5-flash",
        system,
        userMessage,
        temperature: ctx.node.llmBaseTemperature ?? 1.0,
        topP: ctx.node.llmBaseTopP ?? 1.0,
        topK: ctx.node.llmBaseTopK ?? 0,
        maxTokens: ctx.node.llmBaseMaxTokens ?? 8192,
        safetyLevel: ctx.node.llmBaseSafety ?? "none",
        enableSearch: ctx.node.llmBaseEnableSearch ?? false,
      };

      const res = await apiRequest("POST", "/api/llm-base/generate", body);
      const data = (await res.json()) as { output: string };
      return data.output || "";
    },
  };
}
