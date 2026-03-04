/**
 * Research node lifecycle handlers.
 * Streams research via /api/chat/stream (SSE).
 */

import type { NodeLifecycleHandlers, NodeProcessContext } from "../useNodeLifecycle";

export function createResearchHandlers(): NodeLifecycleHandlers {
  return {
    onPreProcess: async (ctx: NodeProcessContext) => {
      return ctx.combinedInputContent.trim().length > 0;
    },

    onProcess: async (ctx: NodeProcessContext) => {
      const res = await fetch("/api/chat/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: `Research the following topic thoroughly and provide a comprehensive analysis:\n\n${ctx.combinedInputContent}`,
          objective: ctx.combinedInputContent.slice(0, 200),
          history: [],
        }),
        signal: ctx.signal,
      });

      if (!res.ok) throw new Error("Research API failed");

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let outputText = "";

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
                }
              } catch {
                // Ignore malformed SSE
              }
            }
          }
        }
      }

      return outputText;
    },
  };
}
