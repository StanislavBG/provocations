/**
 * useNodeLifecycle — Per-node lifecycle hook.
 *
 * Abstracts the pre-process / process / post-process execution pattern
 * used by all executable flow nodes. Manages status transitions, abort
 * support, and error handling.
 */

import { useState, useRef, useCallback } from "react";
import type { FlowNode, FlowEdge } from "./useFlowCanvas";

// ── Types ──

export type NodeStatus = "idle" | "pre-processing" | "processing" | "post-processing" | "done" | "error";

export interface NodeProcessContext {
  node: FlowNode;
  inputNodes: FlowNode[];
  inputEdges: FlowEdge[];
  /** Combined text content gathered from upstream connected nodes */
  combinedInputContent: string;
  /** AbortSignal for cancellation */
  signal: AbortSignal;
}

export interface NodeLifecycleHandlers {
  /** Validate inputs and set up state before processing. Return false to abort. */
  onPreProcess?: (ctx: NodeProcessContext) => Promise<boolean>;
  /** The main work (API call, computation). Returns output text. */
  onProcess: (ctx: NodeProcessContext) => Promise<string>;
  /** Post-processing: create output nodes, emit results, etc. */
  onPostProcess?: (output: string, ctx: NodeProcessContext) => Promise<void>;
}

export interface NodeLifecycleReturn {
  status: NodeStatus;
  output: string | null;
  error: string | null;
  run: (node: FlowNode, allNodes: FlowNode[], allEdges: FlowEdge[]) => Promise<string | null>;
  abort: () => void;
  reset: () => void;
}

// ── Helper: gather input content from connected upstream nodes ──

export function gatherInputContent(
  nodeId: string,
  allNodes: FlowNode[],
  allEdges: FlowEdge[],
): { inputNodes: FlowNode[]; inputEdges: FlowEdge[]; combinedContent: string } {
  const inputEdges = allEdges.filter((e) => e.toNodeId === nodeId);
  const inputNodes = inputEdges
    .map((e) => allNodes.find((n) => n.id === e.fromNodeId))
    .filter(Boolean) as FlowNode[];

  const combinedContent = inputNodes
    .map((n) => n.documentContent || n.content || n.llmOutput || n.snippet || "")
    .filter((s) => s.trim())
    .join("\n\n---\n\n");

  return { inputNodes, inputEdges, combinedContent };
}

// ── Hook ──

export function useNodeLifecycle(handlers: NodeLifecycleHandlers): NodeLifecycleReturn {
  const [status, setStatus] = useState<NodeStatus>("idle");
  const [output, setOutput] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const run = useCallback(
    async (node: FlowNode, allNodes: FlowNode[], allEdges: FlowEdge[]): Promise<string | null> => {
      // Abort any previous run
      if (abortRef.current) abortRef.current.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setError(null);
      setOutput(null);

      try {
        // Gather inputs
        const { inputNodes, inputEdges, combinedContent } = gatherInputContent(
          node.id,
          allNodes,
          allEdges,
        );

        const ctx: NodeProcessContext = {
          node,
          inputNodes,
          inputEdges,
          combinedInputContent: combinedContent,
          signal: controller.signal,
        };

        // Pre-process
        if (handlers.onPreProcess) {
          setStatus("pre-processing");
          const ok = await handlers.onPreProcess(ctx);
          if (!ok || controller.signal.aborted) {
            setStatus("idle");
            return null;
          }
        }

        // Process
        setStatus("processing");
        const result = await handlers.onProcess(ctx);

        if (controller.signal.aborted) {
          setStatus("idle");
          return null;
        }

        setOutput(result);

        // Post-process
        if (handlers.onPostProcess) {
          setStatus("post-processing");
          await handlers.onPostProcess(result, ctx);
        }

        setStatus("done");
        return result;
      } catch (err) {
        if (controller.signal.aborted) {
          setStatus("idle");
          return null;
        }
        const msg = err instanceof Error ? err.message : "Execution failed";
        setError(msg);
        setStatus("error");
        return null;
      }
    },
    [handlers],
  );

  const abort = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    setStatus("idle");
  }, []);

  const reset = useCallback(() => {
    abort();
    setOutput(null);
    setError(null);
  }, [abort]);

  return { status, output, error, run, abort, reset };
}
