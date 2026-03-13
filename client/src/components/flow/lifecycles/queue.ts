/**
 * Queue node lifecycle handler.
 *
 * Accumulates items and controls their release downstream.
 * Modes:
 *   - flow_through: items pass immediately
 *   - hold_until_triggered: items accumulate, released on trigger
 */

import type { NodeLifecycleHandlers, NodeProcessContext } from "../useNodeLifecycle";
import { generateId } from "@/lib/utils";

export function createQueueHandlers(): NodeLifecycleHandlers {
  return {
    onPreProcess: async (ctx: NodeProcessContext) => {
      const mode = ctx.node.queueMode || "flow_through";
      const hasInput = ctx.combinedInputContent.trim().length > 0;

      if (mode === "flow_through") {
        // Need input to pass through
        return hasInput;
      }

      // hold_until_triggered:
      // Either we have input (enqueue) or no input (trigger/release via play)
      return true;
    },

    onProcess: async (ctx: NodeProcessContext) => {
      const mode = ctx.node.queueMode || "flow_through";
      const triggerMode = ctx.node.queueTriggerMode || "process_all";
      const hasInput = ctx.combinedInputContent.trim().length > 0;
      const items = [...(ctx.node.queueItems || [])];
      const stats = { ...(ctx.node.queueStats || { totalEnqueued: 0, totalReleased: 0, totalProcessed: 0 }) };

      if (mode === "flow_through") {
        // Pass through immediately
        stats.totalEnqueued += 1;
        stats.totalReleased += 1;
        const item = {
          id: generateId("qi"),
          content: ctx.combinedInputContent,
          enqueuedAt: new Date().toISOString(),
          status: "released" as const,
          releasedAt: new Date().toISOString(),
          sourceNodeId: ctx.inputNodes[0]?.id,
          sourceNodeLabel: ctx.inputNodes[0]?.label,
        };
        items.push(item);

        // Return a structured response for post-processing
        return JSON.stringify({
          action: "flow_through",
          released: [item],
          items,
          stats,
        });
      }

      // hold_until_triggered
      if (hasInput) {
        // Enqueue operation
        stats.totalEnqueued += 1;
        const item = {
          id: generateId("qi"),
          content: ctx.combinedInputContent,
          enqueuedAt: new Date().toISOString(),
          status: "queued" as const,
          sourceNodeId: ctx.inputNodes[0]?.id,
          sourceNodeLabel: ctx.inputNodes[0]?.label,
        };
        items.push(item);

        return JSON.stringify({
          action: "enqueue",
          message: `Enqueued (${items.filter((i) => i.status === "queued").length} items in queue)`,
          released: [],
          items,
          stats,
        });
      }

      // Trigger/release operation (play pressed with no input)
      const queued = items.filter((i) => i.status === "queued");
      if (queued.length === 0) {
        return JSON.stringify({
          action: "release",
          message: "Queue empty — nothing to release",
          released: [],
          items,
          stats,
        });
      }

      const now = new Date().toISOString();
      const released: typeof items = [];

      if (triggerMode === "one_per_trigger") {
        const first = queued[0];
        first.status = "released";
        first.releasedAt = now;
        released.push(first);
        stats.totalReleased += 1;
      } else {
        // process_all
        for (const item of queued) {
          item.status = "released";
          item.releasedAt = now;
          released.push(item);
        }
        stats.totalReleased += released.length;
      }

      return JSON.stringify({
        action: "release",
        released,
        items,
        stats,
      });
    },
  };
}
