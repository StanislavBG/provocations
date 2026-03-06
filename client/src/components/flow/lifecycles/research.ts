/**
 * Research node lifecycle handlers.
 * Streams research via /api/chat/stream (SSE).
 * Handles outputConfig: split instructions, focus mode, response config, template content.
 */

import type { NodeLifecycleHandlers, NodeProcessContext } from "../useNodeLifecycle";

export function createResearchHandlers(): NodeLifecycleHandlers {
  return {
    onPreProcess: async (ctx: NodeProcessContext) => {
      return (
        ctx.combinedInputContent.trim().length > 0 ||
        ctx.objectiveText.trim().length > 0 ||
        ctx.contextText.trim().length > 0 ||
        ctx.templateContent.trim().length > 0
      );
    },

    onProcess: async (ctx: NodeProcessContext) => {
      const { node, objectiveText, contextText, templateContent, signal } = ctx;
      const oc = node.outputConfig;

      // Build split instructions
      const isInfiniteCount = oc?.outputMode === "split" && (oc?.outputCount === undefined || oc?.outputCount === null);
      const explicitCount = oc?.outputMode === "split" && oc?.outputCount !== undefined && oc?.outputCount !== null
        ? Math.min(oc.outputCount, 5) : undefined;

      let splitInstruction = "";
      if (oc?.outputMode === "split") {
        if (explicitCount && explicitCount > 0) {
          splitInstruction = `\n\nIMPORTANT: Structure your response as exactly ${explicitCount} distinct sections. Separate each section with a line containing only "---". Each section should be self-contained and complete.`;
        } else if (isInfiniteCount) {
          splitInstruction = `\n\nIMPORTANT: Structure your response as multiple distinct sections — one section per logical item/topic. Separate each section with a line containing only "---". Each section should be self-contained and complete. Use as many sections as the content naturally requires (up to 5 maximum).`;
        }
      }

      const customHint = oc?.customInstruction ? `\nAdditional instructions: ${oc.customInstruction}` : "";
      const templateHint = templateContent ? `\n\nOUTPUT FORMAT INSTRUCTIONS:\n${templateContent}` : "";
      const primaryQuery = ctx.combinedInputContent || objectiveText;
      const researchPrompt = `Research the following topic thoroughly and provide a comprehensive analysis:\n\n${primaryQuery}${splitInstruction}${customHint}${templateHint}`;

      const res = await fetch("/api/chat/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          message: researchPrompt,
          objective: objectiveText.slice(0, 500) || ctx.combinedInputContent.slice(0, 500),
          history: [],
          researchFocus: oc?.focusMode || undefined,
          additionalContext: contextText || undefined,
          responseConfig: (oc?.format || oc?.detail || oc?.audience || oc?.tone) ? {
            format: oc?.format,
            detail: oc?.detail,
            audience: oc?.audience,
            tone: oc?.tone,
          } : undefined,
        }),
        signal,
      });

      if (!res.ok) {
        let errMsg = `Research API failed (${res.status})`;
        try { const body = await res.json(); errMsg = body?.error || errMsg; } catch { /* ignore */ }
        throw new Error(errMsg);
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let outputText = "";
      let streamError = "";

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const evt = JSON.parse(line.slice(6));
                if (evt.type === "content" && evt.content) {
                  outputText += evt.content;
                } else if (evt.type === "error") {
                  streamError = evt.error || "Stream error";
                }
              } catch {
                // Ignore malformed SSE
              }
            }
          }
        }
      }

      if (!outputText.trim() && streamError) {
        throw new Error(streamError);
      }

      return outputText;
    },
  };
}
