/**
 * useCanvasCollab — WebSocket hook for real-time canvas collaboration.
 *
 * Connects to /ws/canvas?canvasId=X&userId=Y&displayName=Z
 * Sends local operations to the server, receives remote operations.
 * Handles reconnection and presence tracking.
 */

import { useEffect, useRef, useCallback, useState } from "react";
import type { FlowNode, FlowEdge, FlowViewport } from "@/components/flow/useFlowCanvas";

interface CanvasOperation {
  type: string;
  payload: Record<string, unknown>;
  senderId: string;
  timestamp: number;
}

interface CollabMember {
  userId: string;
  displayName: string;
}

interface UseCanvasCollabOptions {
  canvasId: number | null;
  userId: string | null;
  displayName: string;
  enabled: boolean;
  /** Called when a remote operation is received */
  onRemoteOperation: (op: CanvasOperation) => void;
  /** Called when full state sync is received (for late joiners) */
  onFullSync: (state: { nodes: FlowNode[]; edges: FlowEdge[]; viewport: FlowViewport }) => void;
}

export function useCanvasCollab({
  canvasId,
  userId,
  displayName,
  enabled,
  onRemoteOperation,
  onFullSync,
}: UseCanvasCollabOptions) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout>>();
  const [connected, setConnected] = useState(false);
  const [members, setMembers] = useState<CollabMember[]>([]);

  // Store callbacks in refs to avoid reconnection on callback change
  const onRemoteOpRef = useRef(onRemoteOperation);
  onRemoteOpRef.current = onRemoteOperation;
  const onFullSyncRef = useRef(onFullSync);
  onFullSyncRef.current = onFullSync;

  const connect = useCallback(() => {
    if (!canvasId || !userId || !enabled) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const url = `${protocol}//${window.location.host}/ws/canvas?canvasId=${canvasId}&userId=${encodeURIComponent(userId)}&displayName=${encodeURIComponent(displayName)}`;

    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);

        if (msg.type === "presence") {
          setMembers(msg.members || []);
          return;
        }

        if (msg.type === "full-sync" && msg.payload?.state) {
          try {
            const state = JSON.parse(msg.payload.state as string);
            onFullSyncRef.current(state);
          } catch {
            // Ignore malformed state
          }
          return;
        }

        // Regular operation — delegate to handler
        onRemoteOpRef.current(msg);
      } catch {
        // Ignore malformed messages
      }
    };

    ws.onclose = () => {
      setConnected(false);
      wsRef.current = null;
      // Reconnect after 3 seconds
      if (enabled && canvasId) {
        reconnectTimer.current = setTimeout(connect, 3000);
      }
    };

    ws.onerror = () => {
      ws.close();
    };
  }, [canvasId, userId, displayName, enabled]);

  // Connect/disconnect based on enabled + canvasId
  useEffect(() => {
    if (enabled && canvasId && userId) {
      connect();
    }
    return () => {
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      setConnected(false);
      setMembers([]);
    };
  }, [canvasId, userId, enabled, connect]);

  /** Send an operation to all collaborators */
  const sendOperation = useCallback(
    (type: string, payload: Record<string, unknown>) => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
      wsRef.current.send(
        JSON.stringify({
          type,
          payload,
          senderId: userId,
          timestamp: Date.now(),
        }),
      );
    },
    [userId],
  );

  /** Send full canvas state (used by host when joining or periodically) */
  const sendFullSync = useCallback(
    (state: { nodes: FlowNode[]; edges: FlowEdge[]; viewport: FlowViewport }) => {
      sendOperation("full-sync", { state: JSON.stringify(state) });
    },
    [sendOperation],
  );

  return {
    connected,
    members,
    sendOperation,
    sendFullSync,
  };
}
