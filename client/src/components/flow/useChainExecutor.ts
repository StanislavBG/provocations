/**
 * useChainExecutor — Chain propagation engine for flow canvas.
 *
 * When a node completes execution, the chain executor finds downstream
 * nodes that support chain execution and auto-triggers them.
 *
 * Features:
 * - Execution lock per node: prevents duplicate concurrent execution (I1)
 * - Error state propagation: failed nodes block downstream with error/blocked status (I2)
 * - Retry support: re-execute failed nodes and resume downstream chain (I3)
 * - Chain progress tracking: total/completed/current node for progress UI (I4)
 * - Per-node timeout: configurable timeouts by node type (I5)
 * - Chain cancel: abort running chain with AbortController (I6)
 */

import { useCallback, useRef, useState } from "react";
import type { FlowNode, FlowEdge } from "./useFlowCanvas";
import { FLOW_NODE_REGISTRY } from "./FlowNodeRegistry";

// ── Types ──

export type ChainNodeStatus = "idle" | "running" | "done" | "error";

export interface ChainExecutorCallbacks {
  /** Get current nodes/edges (from stateRef) */
  getState: () => { nodes: FlowNode[]; edges: FlowEdge[] };
  /** Execute a single node. Returns the output text or null on failure. */
  executeNode: (nodeId: string) => Promise<string | null | void>;
  /** Called when a node status changes */
  onStatusChange?: (nodeId: string, status: ChainNodeStatus) => void;
  /** Called when a node's chain metadata changes (chainStatus, chainErrorMessage) */
  onChainStatusChange?: (nodeId: string, chainStatus: FlowNode["chainStatus"], errorMessage?: string) => void;
}

/** Progress information for the currently running chain */
export interface ChainProgress {
  totalNodes: number;
  completedNodes: number;
  currentNodeId: string | null;
  currentNodeLabel: string;
  startTime: number;
  isRunning: boolean;
}

export interface ChainExecutor {
  /** Execute a single node and trigger downstream chain */
  executeAndPropagate: (nodeId: string) => Promise<void>;
  /** Execute an entire chain starting from a node */
  executeChain: (startNodeId: string) => Promise<void>;
  /** Abort all running executions in a chain */
  abortChain: () => void;
  /** Retry a failed node and resume downstream chain */
  retryNode: (nodeId: string) => Promise<void>;
  /** Check if any node in the chain is currently running */
  isRunning: boolean;
  /** Current chain progress (reactive via useState) */
  progress: ChainProgress;
}

// ── Per-node timeout configuration (I5) ──

export const NODE_TIMEOUTS: Record<string, number> = {
  research: 120_000, // 2 minutes (AI research can be slow)
  interview: 60_000, // 1 minute
  llm: 60_000, // 1 minute
  "llm-base": 120_000, // 2 minutes (custom prompts)
  painter: 120_000, // 2 minutes (image generation)
  youtube: 90_000, // 1.5 minutes
  "api-connection": 30_000, // 30 seconds
  "social-post": 60_000, // 1 minute
  "coherence-gate": 60_000, // 1 minute
  document: 60_000, // 1 minute
  notification: 15_000, // 15 seconds
  store: 15_000, // 15 seconds
  approval: 0, // no timeout (user interaction)
  default: 60_000, // 1 minute
};

// ── Chain delay between consecutive executions ──
const CHAIN_DELAY_MS = 500;

// ── Initial progress state ──
const INITIAL_PROGRESS: ChainProgress = {
  totalNodes: 0,
  completedNodes: 0,
  currentNodeId: null,
  currentNodeLabel: "",
  startTime: 0,
  isRunning: false,
};

// ── Hook ──

export function useChainExecutor(callbacks: ChainExecutorCallbacks): ChainExecutor {
  const runningRef = useRef(false);
  const abortedRef = useRef(false);
  const activeNodesRef = useRef<Set<string>>(new Set());

  // I1: Execution lock per node — prevents duplicate concurrent execution
  const executionLocks = useRef(new Map<string, Promise<void>>());

  // I6: AbortController for cancellable chain execution
  const chainAbortController = useRef<AbortController | null>(null);

  // I4: Chain progress tracking (reactive)
  const [progress, setProgress] = useState<ChainProgress>(INITIAL_PROGRESS);
  const progressRef = useRef<ChainProgress>(INITIAL_PROGRESS);

  const { getState, executeNode, onStatusChange, onChainStatusChange } = callbacks;

  /**
   * Collect all nodes in the chain from startNodeId downstream (BFS).
   * Used for progress tracking and error propagation.
   */
  const collectDownstreamChain = useCallback(
    (startNodeId: string): string[] => {
      const { nodes, edges } = getState();
      const visited = new Set<string>([startNodeId]);
      const queue = [startNodeId];
      const result: string[] = [startNodeId];

      while (queue.length > 0) {
        const current = queue.shift()!;
        const downstream = edges.filter((e) => e.fromNodeId === current);
        for (const edge of downstream) {
          if (!visited.has(edge.toNodeId) && nodes.find((n) => n.id === edge.toNodeId)) {
            visited.add(edge.toNodeId);
            queue.push(edge.toNodeId);
            result.push(edge.toNodeId);
          }
        }
      }

      return result;
    },
    [getState],
  );

  /**
   * I2: Propagate error/blocked status to all downstream nodes.
   * When a node fails, all its downstream dependents are marked as 'blocked'.
   */
  const propagateErrorDownstream = useCallback(
    (failedNodeId: string, errorMessage: string) => {
      const { nodes, edges } = getState();
      const visited = new Set<string>([failedNodeId]);
      const queue: string[] = [];

      // Find direct downstream
      const downEdges = edges.filter((e) => e.fromNodeId === failedNodeId);
      for (const e of downEdges) {
        if (!visited.has(e.toNodeId)) {
          visited.add(e.toNodeId);
          queue.push(e.toNodeId);
        }
      }

      // BFS to mark all downstream as blocked
      while (queue.length > 0) {
        const current = queue.shift()!;
        const node = nodes.find((n) => n.id === current);
        if (!node) continue;

        onChainStatusChange?.(current, "blocked", `Blocked: upstream node failed — ${errorMessage}`);

        const nextEdges = edges.filter((e) => e.fromNodeId === current);
        for (const e of nextEdges) {
          if (!visited.has(e.toNodeId)) {
            visited.add(e.toNodeId);
            queue.push(e.toNodeId);
          }
        }
      }
    },
    [getState, onChainStatusChange],
  );

  /**
   * Clear error/blocked status from a node and all its downstream nodes.
   * Used when retrying a failed node.
   */
  const clearErrorDownstream = useCallback(
    (nodeId: string) => {
      const chainNodes = collectDownstreamChain(nodeId);
      for (const id of chainNodes) {
        onChainStatusChange?.(id, "idle", undefined);
      }
    },
    [collectDownstreamChain, onChainStatusChange],
  );

  /** Update progress state (both ref and reactive state) */
  const updateProgress = useCallback((update: Partial<ChainProgress>) => {
    const next = { ...progressRef.current, ...update };
    progressRef.current = next;
    setProgress(next);
  }, []);

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

  /** I5: Execute a node with per-type timeout */
  const executeWithTimeout = useCallback(
    async (nodeId: string): Promise<string | null> => {
      const { nodes } = getState();
      const node = nodes.find((n) => n.id === nodeId);
      const nodeType = node?.type ?? "default";
      const timeout = NODE_TIMEOUTS[nodeType] ?? NODE_TIMEOUTS.default;

      // No timeout for approval nodes (user interaction required)
      if (timeout === 0) {
        return executeNode(nodeId).then((r) => r ?? null);
      }

      // Race execution against timeout
      return Promise.race([
        executeNode(nodeId).then((r) => r ?? null),
        new Promise<null>((_, reject) =>
          setTimeout(
            () => reject(new Error(`Node execution timed out after ${Math.round(timeout / 1000)}s`)),
            timeout,
          ),
        ),
      ]);
    },
    [getState, executeNode],
  );

  /** Execute a node and propagate to downstream */
  const executeAndPropagate = useCallback(
    async (nodeId: string) => {
      if (abortedRef.current) return;

      // I1: Execution lock — if already executing, wait for existing execution
      if (executionLocks.current.has(nodeId)) {
        await executionLocks.current.get(nodeId);
        return; // Don't re-execute
      }

      const doExecute = async () => {
        runningRef.current = true;
        activeNodesRef.current.add(nodeId);
        onStatusChange?.(nodeId, "running");
        onChainStatusChange?.(nodeId, "running");

        // Update progress: set current node
        const { nodes } = getState();
        const currentNode = nodes.find((n) => n.id === nodeId);
        updateProgress({
          currentNodeId: nodeId,
          currentNodeLabel: currentNode?.label ?? nodeId,
        });

        let result: string | null = null;
        let errorMessage: string | undefined;

        try {
          // I5: Execute with per-node timeout
          result = await executeWithTimeout(nodeId);
        } catch (err) {
          errorMessage = err instanceof Error ? err.message : "Unknown execution error";
          result = null;
        }

        activeNodesRef.current.delete(nodeId);

        if (abortedRef.current) {
          runningRef.current = activeNodesRef.current.size > 0;
          return;
        }

        if (result !== null) {
          onStatusChange?.(nodeId, "done");
          onChainStatusChange?.(nodeId, "completed");

          // Update progress: increment completed
          updateProgress({
            completedNodes: progressRef.current.completedNodes + 1,
          });

          // Check if this node allows auto-propagation (default: true)
          const latestState = getState();
          const latestNode = latestState.nodes.find((n) => n.id === nodeId);
          const autoTrigger = latestNode?.autoTriggerNext !== false; // default true

          // Block chain propagation at approval nodes that are pending or rejected
          if (latestNode?.type === "approval" && latestNode.approvalStatus !== "approved") {
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
          // I2: Error state — mark this node as error and propagate blocked status downstream
          const errMsg = errorMessage ?? "Execution failed";
          onStatusChange?.(nodeId, "error");
          onChainStatusChange?.(nodeId, "error", errMsg);
          propagateErrorDownstream(nodeId, errMsg);
        }

        runningRef.current = activeNodesRef.current.size > 0;

        // If no more active nodes, chain is done
        if (activeNodesRef.current.size === 0) {
          updateProgress({ isRunning: false, currentNodeId: null, currentNodeLabel: "" });
        }
      };

      const executionPromise = doExecute();
      executionLocks.current.set(nodeId, executionPromise);

      try {
        await executionPromise;
      } finally {
        executionLocks.current.delete(nodeId);
      }
    },
    [
      executeWithTimeout,
      getExecutableDownstream,
      getState,
      onStatusChange,
      onChainStatusChange,
      propagateErrorDownstream,
      updateProgress,
    ],
  );

  /** Execute an entire chain starting from a node */
  const executeChain = useCallback(
    async (startNodeId: string) => {
      abortedRef.current = false;

      // I6: Create new AbortController for this chain run
      chainAbortController.current = new AbortController();

      // I4: Initialize progress tracking
      const chainNodes = collectDownstreamChain(startNodeId);
      updateProgress({
        totalNodes: chainNodes.length,
        completedNodes: 0,
        currentNodeId: null,
        currentNodeLabel: "",
        startTime: Date.now(),
        isRunning: true,
      });

      await executeAndPropagate(startNodeId);

      // Ensure progress reflects completion
      if (!abortedRef.current) {
        updateProgress({ isRunning: false, currentNodeId: null, currentNodeLabel: "" });
      }
    },
    [executeAndPropagate, collectDownstreamChain, updateProgress],
  );

  /** I3: Retry a failed node and resume downstream chain execution */
  const retryNode = useCallback(
    async (nodeId: string) => {
      // Clear error from this node and all downstream blocked nodes
      clearErrorDownstream(nodeId);

      // Re-execute the node and propagate
      abortedRef.current = false;

      // Re-initialize progress for the retry sub-chain
      const chainNodes = collectDownstreamChain(nodeId);
      updateProgress({
        totalNodes: chainNodes.length,
        completedNodes: 0,
        currentNodeId: null,
        currentNodeLabel: "",
        startTime: Date.now(),
        isRunning: true,
      });

      await executeAndPropagate(nodeId);
    },
    [clearErrorDownstream, collectDownstreamChain, executeAndPropagate, updateProgress],
  );

  /** I6: Abort all running chain executions */
  const abortChain = useCallback(() => {
    abortedRef.current = true;
    chainAbortController.current?.abort();
    chainAbortController.current = null;

    // Mark all active nodes as cancelled
    const { nodes } = getState();
    for (const nodeId of Array.from(activeNodesRef.current)) {
      onChainStatusChange?.(nodeId, "cancelled");
    }

    // Mark any remaining pending nodes as cancelled
    for (const node of nodes) {
      if (node.chainStatus === "running") {
        onChainStatusChange?.(node.id, "cancelled");
      }
    }

    activeNodesRef.current.clear();
    runningRef.current = false;
    updateProgress({ ...INITIAL_PROGRESS });
  }, [getState, onChainStatusChange, updateProgress]);

  return {
    executeAndPropagate,
    executeChain,
    abortChain,
    retryNode,
    get isRunning() {
      return runningRef.current;
    },
    progress,
  };
}
