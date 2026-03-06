/**
 * useChainExecutor — Chain propagation engine for flow canvas.
 *
 * When a node completes execution, the chain executor finds downstream
 * nodes that support chain execution and auto-triggers them.
 *
 * Replaces the scattered setTimeout chain propagation in handlePlayNode.
 */

import { useCallback, useRef } from "react";
import type { FlowNode, FlowEdge } from "./useFlowCanvas";
import { FLOW_NODE_REGISTRY } from "./FlowNodeRegistry";

// ── Types ──

export type ChainNodeStatus = "idle" | "running" | "done" | "error";

export interface ChainExecutorCallbacks {
  /** Get current nodes/edges (from stateRef) */
  getState: () => { nodes: FlowNode[]; edges: FlowEdge[] };
  /** Execute a single node. Returns the output text or null on failure. */
  executeNode: (nodeId: string) => Promise<string | null>;
  /** Called when a node status changes */
  onStatusChange?: (nodeId: string, status: ChainNodeStatus) => void;
}

export interface ChainExecutor {
  /** Execute a single node and trigger downstream chain */
  executeAndPropagate: (nodeId: string) => Promise<void>;
  /** Execute an entire chain starting from a node */
  executeChain: (startNodeId: string) => Promise<void>;
  /** Abort all running executions in a chain */
  abortChain: () => void;
  /** Check if any node in the chain is currently running */
  isRunning: boolean;
}

// ── Chain delay between consecutive executions ──
const CHAIN_DELAY_MS = 500;

// ── Hook ──

export function useChainExecutor(callbacks: ChainExecutorCallbacks): ChainExecutor {
  const runningRef = useRef(false);
  const abortedRef = useRef(false);
  const activeNodesRef = useRef<Set<string>>(new Set());

  const { getState, executeNode, onStatusChange } = callbacks;

  /**
   * Find downstream nodes that can be chain-triggered.
   * A downstream node is executable if:
   * 1. It has `supportsChainExecution === true` in the registry
   * 2. ALL of its input edges come from nodes that are "done"
   */
  const getExecutableDownstream = useCallback(
    (nodeId: string): string[] => {
      const { nodes, edges } = getState();
      const downstreamEdges = edges.filter((e) => e.fromNodeId === nodeId);
      const candidates: string[] = [];

      for (const edge of downstreamEdges) {
        const downstream = nodes.find((n) => n.id === edge.toNodeId);
        if (!downstream) continue;

        const def = FLOW_NODE_REGISTRY[downstream.type];
        if (!def?.supportsChainExecution) continue;

        const mode = downstream.inputMode ?? "wait-all";

        if (mode === "fire-each") {
          // Fire immediately — this upstream node just completed, that's enough
          candidates.push(downstream.id);
        } else {
          // Wait-all: check if ALL inputs to this downstream node are satisfied
          const allInputEdges = edges.filter((e) => e.toNodeId === downstream.id);
          const allInputsSatisfied = allInputEdges.every((ie) => {
            const inputNode = nodes.find((n) => n.id === ie.fromNodeId);
            return inputNode && (inputNode.llmStatus === "done" || !FLOW_NODE_REGISTRY[inputNode.type]?.playable);
          });

          if (allInputsSatisfied) {
            candidates.push(downstream.id);
          }
        }
      }

      return candidates;
    },
    [getState],
  );

  /** Execute a node and propagate to downstream */
  const executeAndPropagate = useCallback(
    async (nodeId: string) => {
      if (abortedRef.current) return;

      runningRef.current = true;
      activeNodesRef.current.add(nodeId);
      onStatusChange?.(nodeId, "running");

      const result = await executeNode(nodeId);

      activeNodesRef.current.delete(nodeId);

      if (abortedRef.current) {
        runningRef.current = activeNodesRef.current.size > 0;
        return;
      }

      if (result !== null) {
        onStatusChange?.(nodeId, "done");

        // Check if this node allows auto-propagation (default: true)
        const { nodes } = getState();
        const currentNode = nodes.find((n) => n.id === nodeId);
        const autoTrigger = currentNode?.autoTriggerNext !== false; // default true

        // Block chain propagation at approval nodes that are pending or rejected
        if (currentNode?.type === "approval" && currentNode.approvalStatus !== "approved") {
          runningRef.current = activeNodesRef.current.size > 0;
          return;
        }

        if (autoTrigger) {
          // Find and trigger downstream nodes after a delay
          const downstream = getExecutableDownstream(nodeId);
          if (downstream.length > 0) {
            await new Promise((resolve) => setTimeout(resolve, CHAIN_DELAY_MS));
            if (!abortedRef.current) {
              await Promise.all(downstream.map((id) => executeAndPropagate(id)));
            }
          }
        }
      } else {
        onStatusChange?.(nodeId, "error");
      }

      runningRef.current = activeNodesRef.current.size > 0;
    },
    [executeNode, getExecutableDownstream, onStatusChange],
  );

  /** Execute an entire chain starting from a node */
  const executeChain = useCallback(
    async (startNodeId: string) => {
      abortedRef.current = false;
      await executeAndPropagate(startNodeId);
    },
    [executeAndPropagate],
  );

  /** Abort all running chain executions */
  const abortChain = useCallback(() => {
    abortedRef.current = true;
    activeNodesRef.current.clear();
    runningRef.current = false;
  }, []);

  return {
    executeAndPropagate,
    executeChain,
    abortChain,
    get isRunning() {
      return runningRef.current;
    },
  };
}
