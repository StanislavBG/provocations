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
  /** Combined text content gathered from immediately connected upstream nodes (+ their child outputs) */
  combinedInputContent: string;
  /** Full chain context: all content from all nodes in the execution chain up to this point */
  chainContext: string;
  /** AbortSignal for cancellation */
  signal: AbortSignal;
  /** Objective text from edges with role="objective" (or first plain input) */
  objectiveText: string;
  /** Context text from edges with role="context" */
  contextText: string;
  /** Output-format template from edges with role="output-format" */
  templateContent: string;
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

// ── Helper: extract text content from a node ──

function nodeContent(n: FlowNode): string {
  return n.documentContent || n.content || n.llmOutput || n.snippet || "";
}

// ── Helper: gather input content from connected upstream nodes (+ their child outputs) ──

export function gatherInputContent(
  nodeId: string,
  allNodes: FlowNode[],
  allEdges: FlowEdge[],
): { inputNodes: FlowNode[]; inputEdges: FlowEdge[]; combinedContent: string } {
  const inputEdges = allEdges.filter((e) => e.toNodeId === nodeId);
  const inputNodes = inputEdges
    .map((e) => allNodes.find((n) => n.id === e.fromNodeId))
    .filter(Boolean) as FlowNode[];

  // Collect content from each input node AND its child output nodes
  const parts: string[] = [];
  for (const inputNode of inputNodes) {
    const main = nodeContent(inputNode);
    if (main.trim()) parts.push(main);

    // Find child nodes connected FROM this input (output children)
    const childEdges = allEdges.filter((e) => e.fromNodeId === inputNode.id && e.toNodeId !== nodeId);
    for (const ce of childEdges) {
      const child = allNodes.find((n) => n.id === ce.toNodeId);
      if (child) {
        const childText = nodeContent(child);
        if (childText.trim()) parts.push(childText);
      }
    }
  }

  return { inputNodes, inputEdges, combinedContent: parts.join("\n\n---\n\n") };
}

// ── Helper: gather input content with role-based separation ──

export function gatherInputContentWithRoles(
  nodeId: string,
  allNodes: FlowNode[],
  allEdges: FlowEdge[],
): {
  inputNodes: FlowNode[];
  inputEdges: FlowEdge[];
  combinedContent: string;
  objectiveText: string;
  contextText: string;
  templateContent: string;
} {
  const inputEdges = allEdges.filter((e) => e.toNodeId === nodeId);
  const inputNodes = inputEdges
    .map((e) => allNodes.find((n) => n.id === e.fromNodeId))
    .filter(Boolean) as FlowNode[];

  const objectiveTexts: string[] = [];
  const contextTexts: string[] = [];
  const plainTexts: string[] = [];

  for (const edge of inputEdges) {
    const srcNode = allNodes.find((n) => n.id === edge.fromNodeId);
    if (!srcNode) continue;
    if (edge.role === "output-format") continue; // handled separately
    const txt = nodeContent(srcNode);
    if (!txt.trim()) continue;

    // Also gather child output nodes of this input
    const childEdges = allEdges.filter((e) => e.fromNodeId === srcNode.id && e.toNodeId !== nodeId);
    let fullTxt = txt;
    for (const ce of childEdges) {
      const child = allNodes.find((n) => n.id === ce.toNodeId);
      if (child) {
        const childText = nodeContent(child);
        if (childText.trim()) fullTxt += "\n\n" + childText;
      }
    }

    if (edge.role === "objective") objectiveTexts.push(fullTxt);
    else if (edge.role === "context") contextTexts.push(fullTxt);
    else plainTexts.push(fullTxt);
  }

  // Output-format template content
  const outputFormatEdges = inputEdges.filter((e) => e.role === "output-format");
  const templateContent = outputFormatEdges
    .map((e) => {
      const srcNode = allNodes.find((n) => n.id === e.fromNodeId);
      return srcNode ? nodeContent(srcNode) : "";
    })
    .filter((s) => s.trim())
    .join("\n\n");

  const combinedContent = [...objectiveTexts, ...plainTexts, ...contextTexts].join("\n\n---\n\n");
  const objectiveText = objectiveTexts.join("\n\n") || plainTexts[0] || combinedContent.slice(0, 500);
  const contextText = contextTexts.join("\n\n---\n\n");

  return { inputNodes, inputEdges, combinedContent, objectiveText, contextText, templateContent };
}

// ── Helper: gather full chain context walking backward from a node ──

export function gatherChainContext(
  nodeId: string,
  allNodes: FlowNode[],
  allEdges: FlowEdge[],
): string {
  const visited = new Set<string>();
  const parts: string[] = [];

  // BFS backward through edges
  const queue = [nodeId];
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (visited.has(current)) continue;
    visited.add(current);

    // Don't include the target node itself in chain context
    if (current !== nodeId) {
      const node = allNodes.find((n) => n.id === current);
      if (node) {
        const text = nodeContent(node);
        if (text.trim()) parts.push(text);
      }
    }

    // Walk upstream
    const upstreamEdges = allEdges.filter((e) => e.toNodeId === current);
    for (const edge of upstreamEdges) {
      if (!visited.has(edge.fromNodeId)) {
        queue.push(edge.fromNodeId);
      }
    }
  }

  return parts.join("\n\n---\n\n");
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
        // Gather inputs with role separation
        const { inputNodes, inputEdges, combinedContent, objectiveText, contextText, templateContent } =
          gatherInputContentWithRoles(node.id, allNodes, allEdges);

        const chainCtx = gatherChainContext(node.id, allNodes, allEdges);

        const ctx: NodeProcessContext = {
          node,
          inputNodes,
          inputEdges,
          combinedInputContent: combinedContent,
          chainContext: chainCtx,
          signal: controller.signal,
          objectiveText,
          contextText,
          templateContent,
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
