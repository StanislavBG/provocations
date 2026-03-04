/**
 * Timer-event node lifecycle handlers.
 * Timer nodes don't call an API — they fire pulses on an interval
 * and pass-through their input content to downstream nodes.
 */

import type { NodeLifecycleHandlers, NodeProcessContext } from "../useNodeLifecycle";

export function createTimerHandlers(): NodeLifecycleHandlers {
  return {
    onPreProcess: async (_ctx: NodeProcessContext) => {
      // Timers are always ready — they pass through whatever input they have
      return true;
    },

    onProcess: async (ctx: NodeProcessContext) => {
      // Timer nodes simply pass their input content through as output
      // The actual timer/interval logic lives in the FlowTimerEventNode component
      return ctx.combinedInputContent || ctx.node.content || "";
    },
  };
}
