/**
 * ApprovalExpandedView -- Full expanded view for Approval nodes.
 *
 * Shows recipient picker, message template, approval status,
 * and approve/reject buttons.
 */

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { UserCheck, Users, Send, Clock, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { ProvokeText } from "@/components/ProvokeText";
import type { FlowNode } from "../useFlowCanvas";

interface ApprovalExpandedViewProps {
  node: FlowNode;
  onUpdateNode: (nodeId: string, patch: Partial<FlowNode>) => void;
  onPlayNode?: (nodeId: string) => void;
}

export function ApprovalExpandedView({
  node,
  onUpdateNode,
  onPlayNode,
}: ApprovalExpandedViewProps) {
  const [message, setMessage] = useState(node.approvalMessage || "Approval required for: {label}");
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(
    new Set(node.approvalUserIds || []),
  );

  // Fetch connected users
  const { data: connections } = useQuery({
    queryKey: ["/api/chat/connections"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/chat/connections");
      return (await res.json()) as Array<{
        id: number;
        peerId: string;
        peerName: string;
        peerAvatar?: string;
        status: string;
      }>;
    },
  });

  const acceptedConnections = connections?.filter((c) => c.status === "accepted") || [];

  // Sync state back to node on change
  useEffect(() => {
    onUpdateNode(node.id, {
      approvalMessage: message,
      approvalUserIds: Array.from(selectedUserIds),
    });
  }, [message, selectedUserIds, node.id, onUpdateNode]);

  const toggleUser = (userId: string) => {
    setSelectedUserIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const selectAll = useCallback(() => {
    setSelectedUserIds(new Set(acceptedConnections.map((c) => c.peerId)));
  }, [acceptedConnections]);

  const handleApprove = () => {
    onUpdateNode(node.id, {
      approvalStatus: "approved",
      approvalRespondedAt: new Date().toISOString(),
      approvalResponderName: "You",
      llmStatus: "done",
      snippet: "Approved",
    });
  };

  const handleReject = () => {
    onUpdateNode(node.id, {
      approvalStatus: "rejected",
      approvalRespondedAt: new Date().toISOString(),
      approvalResponderName: "You",
      llmStatus: "error",
      llmError: "Approval rejected",
      snippet: "Rejected",
    });
  };

  const handleReset = () => {
    onUpdateNode(node.id, {
      approvalStatus: "idle",
      approvalResponderId: undefined,
      approvalResponderName: undefined,
      approvalRespondedAt: undefined,
      llmStatus: "idle",
      llmError: undefined,
      snippet: undefined,
    });
  };

  const status = node.approvalStatus || "idle";

  const previewMessage = message
    .replace(/\{output\}/g, "(upstream output preview)")
    .replace(/\{label\}/g, node.label)
    .replace(/\{time\}/g, new Date().toLocaleString());

  return (
    <div className="flex flex-col h-full gap-4 p-4 max-w-xl mx-auto">
      {/* Status Banner */}
      <div className="flex items-center gap-3 px-4 py-3 rounded-lg border bg-muted/30">
        {status === "idle" && (
          <>
            <AlertCircle className="w-5 h-5 text-muted-foreground" />
            <div>
              <div className="text-sm font-medium">Not Yet Submitted</div>
              <div className="text-xs text-muted-foreground">Configure recipients and message, then trigger the node.</div>
            </div>
          </>
        )}
        {status === "pending" && (
          <>
            <Clock className="w-5 h-5 text-amber-500 animate-pulse" />
            <div>
              <div className="text-sm font-medium text-amber-500">Awaiting Approval</div>
              <div className="text-xs text-muted-foreground">
                Chain is paused. Approve or reject to continue.
              </div>
            </div>
          </>
        )}
        {status === "approved" && (
          <>
            <CheckCircle className="w-5 h-5 text-emerald-500" />
            <div>
              <div className="text-sm font-medium text-emerald-500">Approved</div>
              <div className="text-xs text-muted-foreground">
                {node.approvalResponderName && `By ${node.approvalResponderName} `}
                {node.approvalRespondedAt && `at ${new Date(node.approvalRespondedAt).toLocaleString()}`}
              </div>
            </div>
          </>
        )}
        {status === "rejected" && (
          <>
            <XCircle className="w-5 h-5 text-red-500" />
            <div>
              <div className="text-sm font-medium text-red-500">Rejected</div>
              <div className="text-xs text-muted-foreground">
                {node.approvalResponderName && `By ${node.approvalResponderName} `}
                {node.approvalRespondedAt && `at ${new Date(node.approvalRespondedAt).toLocaleString()}`}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Action Buttons */}
      {status === "pending" && (
        <div className="flex gap-2">
          <Button onClick={handleApprove} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white">
            <CheckCircle className="w-4 h-4 mr-1.5" />
            Approve
          </Button>
          <Button onClick={handleReject} variant="destructive" className="flex-1">
            <XCircle className="w-4 h-4 mr-1.5" />
            Reject
          </Button>
        </div>
      )}

      {(status === "approved" || status === "rejected") && (
        <Button onClick={handleReset} variant="outline" size="sm">
          Reset to Idle
        </Button>
      )}

      {/* Recipients */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5" />
            Approvers
          </label>
          {acceptedConnections.length > 0 && (
            <button
              className="text-[10px] text-primary hover:underline"
              onClick={selectAll}
            >
              Select all
            </button>
          )}
        </div>
        <div className="flex flex-col gap-1 max-h-[160px] overflow-auto">
          {acceptedConnections.length === 0 && (
            <div className="text-xs text-muted-foreground/60 py-2 text-center">
              No connections found. Invite users first.
            </div>
          )}
          {acceptedConnections.map((conn) => (
            <label
              key={conn.peerId}
              className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted/50 cursor-pointer"
            >
              <input
                type="checkbox"
                checked={selectedUserIds.has(conn.peerId)}
                onChange={() => toggleUser(conn.peerId)}
                className="rounded border-border"
              />
              <div className="flex items-center gap-2 flex-1 min-w-0">
                {conn.peerAvatar ? (
                  <img src={conn.peerAvatar} className="w-5 h-5 rounded-full" alt="" />
                ) : (
                  <div className="w-5 h-5 rounded-full bg-muted flex items-center justify-center text-[9px] font-bold">
                    {conn.peerName?.charAt(0) || "?"}
                  </div>
                )}
                <span className="text-xs truncate">{conn.peerName}</span>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Message Template */}
      <div className="flex-1 min-h-0 flex flex-col">
        <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5 mb-1.5">
          <Send className="w-3.5 h-3.5" />
          Message Template
        </label>
        <ProvokeText
          value={message}
          onChange={setMessage}
          chrome="container"
          variant="textarea"
          showCopy
          label="Template"
          placeholder="Approval required for: {label}"
        />
        <div className="mt-2 text-[10px] text-muted-foreground">
          Placeholders: <code>{"{label}"}</code>, <code>{"{output}"}</code>, <code>{"{time}"}</code>
        </div>
      </div>

      {/* Preview */}
      <div className="rounded-lg border border-border bg-muted/20 p-3">
        <div className="text-[10px] font-medium text-muted-foreground mb-1">Message Preview</div>
        <div className="text-xs">{previewMessage}</div>
      </div>

      {/* Send / Trigger */}
      {status === "idle" && onPlayNode && (
        <Button
          onClick={() => onPlayNode(node.id)}
          disabled={selectedUserIds.size === 0}
          className="w-full"
        >
          <UserCheck className="w-4 h-4 mr-1.5" />
          Send Approval Request
        </Button>
      )}
    </div>
  );
}
