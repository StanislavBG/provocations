/**
 * Approval node lifecycle handler.
 *
 * Sends a notification to assigned users requesting approval, then sets the
 * node status to "pending". Chain execution blocks at this node until the
 * user approves or rejects via the expanded view or notification action.
 */

import { apiRequest } from "@/lib/queryClient";
import type { NodeLifecycleHandlers, NodeProcessContext } from "../useNodeLifecycle";

export function createApprovalHandlers(): NodeLifecycleHandlers {
  return {
    onPreProcess: async (ctx: NodeProcessContext) => {
      // If already approved, pass through immediately
      if (ctx.node.approvalStatus === "approved") return true;
      // If pending, block (don't re-send notification)
      if (ctx.node.approvalStatus === "pending") return false;
      // Otherwise proceed to send notification
      return ctx.combinedInputContent.trim().length > 0;
    },

    onProcess: async (ctx: NodeProcessContext) => {
      const { node, combinedInputContent } = ctx;

      // If already approved, just pass content through
      if (node.approvalStatus === "approved") {
        return combinedInputContent;
      }

      const message = node.approvalMessage || "Approval required for: {label}";
      const userIds = node.approvalUserIds || [];

      // Resolve placeholders in message template
      const resolvedMessage = message
        .replace(/\{output\}/g, combinedInputContent.slice(0, 500))
        .replace(/\{label\}/g, node.label)
        .replace(/\{time\}/g, new Date().toLocaleString());

      // Send notification to assigned users
      if (userIds.length > 0) {
        try {
          await apiRequest("POST", "/api/notifications/send", {
            message: resolvedMessage,
            recipientIds: userIds,
            channels: ["in-app"],
            includeCanvasLink: true,
            sourceNodeId: node.id,
            sourceNodeLabel: node.label,
            contentPreview: combinedInputContent.slice(0, 200),
          });
        } catch {
          // Notification send failure shouldn't block approval flow
        }
      }

      // Return a special marker that tells the caller to set pending status
      // The actual blocking happens in the chain propagation logic
      return "__APPROVAL_PENDING__";
    },
  };
}
