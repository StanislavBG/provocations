/**
 * Coherence gate lifecycle handler.
 * Evaluates content quality via /api/flow/coherence-eval and routes pass/fail.
 */

import type { NodeLifecycleHandlers, NodeProcessContext } from "../useNodeLifecycle";

export function createCoherenceHandlers(): NodeLifecycleHandlers {
  return {
    onPreProcess: async (ctx: NodeProcessContext) => {
      return ctx.combinedInputContent.trim().length > 0;
    },

    onProcess: async (ctx: NodeProcessContext) => {
      const { node, combinedInputContent, signal } = ctx;
      const threshold = node.coherenceThreshold ?? 75;
      const checks = node.coherenceChecks ?? {
        topicMatch: true,
        toneConsistency: true,
        factDrift: false,
        styleMatch: false,
      };
      const maxRetries = node.coherenceRetryCount ?? 1;

      let lastScore = 0;
      let lastVerdict: "pass" | "fail" = "fail";
      let reasoning = "";

      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        if (signal.aborted) return "";

        const response = await fetch("/api/flow/coherence-eval", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content: combinedInputContent,
            originalContext: node.coherencePrompt || "",
            checks,
            customPrompt: node.coherencePrompt,
            threshold,
          }),
          signal,
        });

        if (!response.ok) {
          throw new Error(`Coherence eval failed: ${response.statusText}`);
        }

        const result = await response.json();
        lastScore = result.score;
        lastVerdict = result.verdict;
        reasoning = result.reasoning;

        if (lastVerdict === "pass") break;
      }

      return JSON.stringify({
        score: lastScore,
        verdict: lastVerdict,
        reasoning,
        content: lastVerdict === "pass" ? combinedInputContent : "",
      });
    },
  };
}
