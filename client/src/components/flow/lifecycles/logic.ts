/**
 * Logic node lifecycle handlers.
 * Used for filter, gate, router, and merge nodes.
 * These nodes transform or route content without LLM calls.
 */

import type { NodeLifecycleHandlers, NodeProcessContext } from "../useNodeLifecycle";

export function createLogicHandlers(): NodeLifecycleHandlers {
  return {
    onPreProcess: async (ctx: NodeProcessContext) => {
      if (ctx.node.type === "gate") {
        return ctx.node.gateOpen !== false && ctx.combinedInputContent.trim().length > 0;
      }
      return ctx.combinedInputContent.trim().length > 0;
    },

    onProcess: async (ctx: NodeProcessContext) => {
      if (ctx.node.type === "filter") {
        const rule = ctx.node.logicRule;
        if (rule) {
          const lines = ctx.combinedInputContent.split("\n");
          const filtered = lines.filter((l) =>
            l.toLowerCase().includes(rule.toLowerCase()),
          );
          return filtered.length > 0 ? filtered.join("\n") : ctx.combinedInputContent;
        }
      }
      // Gate, router, merge: pass content through
      return ctx.combinedInputContent;
    },
  };
}
