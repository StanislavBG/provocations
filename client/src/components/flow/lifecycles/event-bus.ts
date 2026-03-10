/**
 * Event Bus node lifecycle handler.
 *
 * Publish mode: sends upstream content as a task event for local agents.
 * Listen mode: passive — agents post results via the API, which creates
 * document nodes on the canvas.
 */

import { apiRequest } from "@/lib/queryClient";
import type { NodeLifecycleHandlers, NodeProcessContext } from "../useNodeLifecycle";

export function createEventBusHandlers(): NodeLifecycleHandlers {
  return {
    onPreProcess: async (ctx: NodeProcessContext) => {
      const mode = ctx.node.eventBusMode || "publish";

      if (mode === "listen") {
        // Listen nodes are externally driven — never auto-process
        return false;
      }

      // Publish mode: need content to send
      return ctx.combinedInputContent.trim().length > 0;
    },

    onProcess: async (ctx: NodeProcessContext) => {
      const channel = ctx.node.eventBusChannel || "default";

      // Get canvasId from localStorage (set by FlowWorkspace on canvas load/save)
      const canvasId = localStorage.getItem("flow:lastCanvasId");
      if (!canvasId) {
        throw new Error("Canvas must be saved before publishing events. Save the canvas first.");
      }

      const res = await apiRequest("POST", "/api/events/publish", {
        canvasId: parseInt(canvasId, 10),
        channel,
        sourceNodeId: ctx.node.id,
        sourceNodeLabel: ctx.node.label,
        content: ctx.combinedInputContent,
      });

      const data = (await res.json()) as { event: { id: string } };
      return `Event published: ${data.event?.id || "unknown"}`;
    },
  };
}
