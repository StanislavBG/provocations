/**
 * LLM Base node lifecycle handlers.
 * Direct, unrestricted LLM access with full model configuration.
 * Context edges → system prompt; user-prompt edges → user message;
 * manual system prompt and user prompt append after edge content.
 */

import { apiRequest } from "@/lib/queryClient";
import type { NodeLifecycleHandlers, NodeProcessContext } from "../useNodeLifecycle";
import { edgeHasRole } from "../useFlowCanvas";
import { expandContextRefs, getReferencedLabels } from "../PromptEditor";

export function createLlmBaseHandlers(): NodeLifecycleHandlers {
  return {
    onPreProcess: async (ctx: NodeProcessContext) => {
      // Can run with any of: manual user prompt, manual system prompt, or connected inputs
      const hasUserPrompt = (ctx.node.llmBaseUserPrompt?.trim()?.length ?? 0) > 0;
      const hasSystemPrompt = (ctx.node.llmBaseSystemPrompt?.trim()?.length ?? 0) > 0;
      const hasInput = ctx.combinedInputContent.trim().length > 0;
      return hasUserPrompt || hasSystemPrompt || hasInput;
    },

    onProcess: async (ctx: NodeProcessContext) => {
      // Gather all available context blocks for ref expansion
      const allBlocks: Array<{ label: string; content: string }> = [];
      for (const edge of ctx.inputEdges) {
        const sourceNode = ctx.inputNodes.find((n) => n.id === edge.fromNodeId);
        if (sourceNode) {
          const text = sourceNode.documentContent || sourceNode.content || sourceNode.snippet || "";
          if (text.trim()) allBlocks.push({ label: sourceNode.label || "Input", content: text.trim() });
        }
      }

      const rawSystem = ctx.node.llmBaseSystemPrompt || "";
      const rawUser = ctx.node.llmBaseUserPrompt || "";

      // Expand @[label] references to actual block content
      const expandedSystem = expandContextRefs(rawSystem, allBlocks);
      const expandedUser = expandContextRefs(rawUser, allBlocks);

      // Find which blocks are explicitly referenced (skip them from auto-injection)
      const referencedLabels = new Set(
        Array.from(getReferencedLabels(rawSystem)).concat(Array.from(getReferencedLabels(rawUser))),
      );

      // Build system prompt from unreferenced context edges + expanded manual system prompt
      const systemParts: string[] = [];

      for (const edge of ctx.inputEdges) {
        if (!edgeHasRole(edge, "user-prompt")) {
          const sourceNode = ctx.inputNodes.find((n) => n.id === edge.fromNodeId);
          if (sourceNode) {
            const label = (sourceNode.label || "Input").trim().toLowerCase();
            if (referencedLabels.has(label)) continue; // Skip — explicitly referenced
            const text = sourceNode.documentContent || sourceNode.content || sourceNode.snippet || "";
            if (text.trim()) systemParts.push(text.trim());
          }
        }
      }

      if (expandedSystem.trim()) {
        systemParts.push(expandedSystem.trim());
      }

      const system = systemParts.join("\n\n---\n\n") || "You are a helpful assistant.";

      // Build user message from unreferenced user-prompt edges + expanded manual user prompt
      const userParts: string[] = [];

      for (const edge of ctx.inputEdges) {
        if (edgeHasRole(edge, "user-prompt")) {
          const sourceNode = ctx.inputNodes.find((n) => n.id === edge.fromNodeId);
          if (sourceNode) {
            const label = (sourceNode.label || "Prompt").trim().toLowerCase();
            if (referencedLabels.has(label)) continue; // Skip — explicitly referenced
            const text = sourceNode.documentContent || sourceNode.content || sourceNode.snippet || "";
            if (text.trim()) userParts.push(text.trim());
          }
        }
      }

      if (expandedUser.trim()) {
        userParts.push(expandedUser.trim());
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
