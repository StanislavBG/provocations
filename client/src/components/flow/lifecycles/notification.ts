/**
 * Notification node lifecycle handler.
 *
 * Sends notifications to assigned users when triggered by chain completion.
 * Supports in-app notifications with links back to the canvas.
 */

import { apiRequest } from "@/lib/queryClient";
import type { NodeLifecycleHandlers, NodeProcessContext } from "../useNodeLifecycle";

export function createNotificationHandlers(): NodeLifecycleHandlers {
  return {
    onPreProcess: async (ctx: NodeProcessContext) => {
      // Must have some input content to notify about
      return ctx.combinedInputContent.trim().length > 0;
    },

    onProcess: async (ctx: NodeProcessContext) => {
      const { node, combinedInputContent } = ctx;

      const message = node.notifyMessage || "Chain completed with output available.";
      const userIds = node.notifyUserIds || [];
      const channels = node.notifyChannels || ["in-app"];
      const includeLink = node.notifyIncludeLink !== false;

      // Resolve placeholders in message template
      const resolvedMessage = message
        .replace(/\{output\}/g, combinedInputContent.slice(0, 500))
        .replace(/\{label\}/g, node.label)
        .replace(/\{time\}/g, new Date().toLocaleString());

      try {
        const res = await apiRequest("POST", "/api/notifications/send", {
          message: resolvedMessage,
          recipientIds: userIds,
          channels,
          includeCanvasLink: includeLink,
          sourceNodeId: node.id,
          sourceNodeLabel: node.label,
          contentPreview: combinedInputContent.slice(0, 200),
        });

        const data = (await res.json()) as { sent: number; failed: number };
        return `Notification sent to ${data.sent} user(s)${data.failed > 0 ? ` (${data.failed} failed)` : ""}`;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        return `Notification failed: ${msg}`;
      }
    },
  };
}
