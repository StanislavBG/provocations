/**
 * useNodeLifecycle — Per-node lifecycle hook.
 *
 * Abstracts the pre-process / process / post-process execution pattern
 * used by all executable flow nodes. Manages status transitions, abort
 * support, and error handling.
 */

import { useState, useRef, useCallback } from "react";
import type { FlowNode, FlowEdge, FlowNodeType, EdgeRole } from "./useFlowCanvas";
import { edgeHasRole, edgeRoles } from "./useFlowCanvas";

// ── Types ──

export type NodeStatus = "idle" | "pre-processing" | "processing" | "post-processing" | "done" | "error";

/** Structured context entry representing one node's contribution to the chain */
export interface ChainContextEntry {
  nodeId: string;
  nodeType: FlowNodeType;
  label: string;
  /** The node's output content */
  content: string;
  /** Execution status of the node */
  status: "done" | "running" | "error" | "idle";
  /** Topological distance from the current node (1 = direct parent, 2 = grandparent, ...) */
  depth: number;
  /** Edge role(s) connecting this node to its downstream neighbor toward the current node */
  edgeRole?: EdgeRole | EdgeRole[];
  /** For logic nodes (filter/gate/router/merge): whether content was passed or blocked */
  verdict?: "pass" | "fail";
  /** For coherence-gate nodes: the quality score */
  score?: number;
  /** For logic nodes: the rule that was applied */
  rule?: string;
}

export interface NodeProcessContext {
  node: FlowNode;
  inputNodes: FlowNode[];
  inputEdges: FlowEdge[];
  /** Combined text content gathered from immediately connected upstream nodes (+ their child outputs) */
  combinedInputContent: string;
  /** Full chain context: all content from all nodes in the execution chain up to this point (flat string, legacy) */
  chainContext: string;
  /** AbortSignal for cancellation */
  signal: AbortSignal;
  /** Objective text from edges with role="objective" (or first plain input) */
  objectiveText: string;
  /** Context text from edges with role="context" */
  contextText: string;
  /** Output-format template from edges with role="output-format" */
  templateContent: string;
  /** Structured immediate context: output from directly preceding node(s), depth=1 only.
   *  For logic nodes, includes the logic node AND its predecessor (depth 1 & 2) so the
   *  downstream node gets both the decision metadata and the substantive content. */
  immediateContext: ChainContextEntry[];
  /** Structured full chain context: every node from chain origin to this point, ordered by depth (nearest first).
   *  Grows as the chain progresses — later nodes see the full accumulated history. */
  fullChainContext: ChainContextEntry[];
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
    const roles = edgeRoles(edge);
    // If ONLY output-format (no other roles), skip in main loop — handled separately
    if (roles.length > 0 && roles.every((r) => r === "output-format")) continue;
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

    // Multi-role: a single edge can contribute to multiple buckets
    if (edgeHasRole(edge, "objective")) objectiveTexts.push(fullTxt);
    if (edgeHasRole(edge, "context")) contextTexts.push(fullTxt);
    if (roles.length === 0) plainTexts.push(fullTxt);
  }

  // Output-format template content
  const outputFormatEdges = inputEdges.filter((e) => edgeHasRole(e, "output-format"));
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

// ── Logic node types that are "operational" (pass-through) rather than content-producing ──
const LOGIC_NODE_TYPES = new Set<FlowNodeType>(["filter", "gate", "router", "merge", "coherence-gate"]);

/** Extract logic-specific metadata from a node */
function extractLogicMeta(n: FlowNode): Pick<ChainContextEntry, "verdict" | "score" | "rule"> {
  const meta: Pick<ChainContextEntry, "verdict" | "score" | "rule"> = {};
  if (n.type === "coherence-gate") {
    meta.verdict = n.coherenceLastVerdict ?? undefined;
    meta.score = n.coherenceLastScore ?? undefined;
    meta.rule = n.coherencePrompt ?? undefined;
  } else if (n.type === "gate") {
    meta.verdict = n.gateOpen !== false ? "pass" : "fail";
    meta.rule = n.logicRule ?? undefined;
  } else if (n.type === "filter" || n.type === "router" || n.type === "merge") {
    meta.verdict = n.llmStatus === "done" ? "pass" : undefined;
    meta.rule = n.logicRule ?? undefined;
  }
  return meta;
}

/** Build a ChainContextEntry from a node */
function toChainEntry(
  n: FlowNode,
  depth: number,
  edgeRole?: EdgeRole | EdgeRole[],
): ChainContextEntry {
  return {
    nodeId: n.id,
    nodeType: n.type,
    label: n.label,
    content: nodeContent(n),
    status: (n.llmStatus as ChainContextEntry["status"]) || "idle",
    depth,
    edgeRole,
    ...extractLogicMeta(n),
  };
}

/**
 * Gather structured chain context with depth tracking.
 *
 * Returns two arrays:
 * - `immediate`: depth-1 parents (and depth-2 when a logic node sits at depth-1,
 *   so the consuming node gets both the decision metadata AND the substantive content
 *   that the logic node was evaluating).
 * - `full`: every upstream node ordered nearest-first.
 */
export function gatherStructuredChainContext(
  nodeId: string,
  allNodes: FlowNode[],
  allEdges: FlowEdge[],
): { immediateContext: ChainContextEntry[]; fullChainContext: ChainContextEntry[] } {
  const full: ChainContextEntry[] = [];
  const visited = new Set<string>();

  // BFS backward with depth tracking
  const queue: Array<{ id: string; depth: number; edgeRole?: EdgeRole | EdgeRole[] }> = [];

  // Seed with direct parents at depth 1
  const directEdges = allEdges.filter((e) => e.toNodeId === nodeId);
  for (const edge of directEdges) {
    queue.push({ id: edge.fromNodeId, depth: 1, edgeRole: edge.role });
  }

  while (queue.length > 0) {
    const { id, depth, edgeRole } = queue.shift()!;
    if (visited.has(id)) continue;
    visited.add(id);

    const node = allNodes.find((n) => n.id === id);
    if (!node) continue;

    full.push(toChainEntry(node, depth, edgeRole));

    // Walk further upstream
    const upstreamEdges = allEdges.filter((e) => e.toNodeId === id);
    for (const ue of upstreamEdges) {
      if (!visited.has(ue.fromNodeId)) {
        queue.push({ id: ue.fromNodeId, depth: depth + 1, edgeRole: ue.role });
      }
    }
  }

  // Sort by depth (nearest first), then by label for stability
  full.sort((a, b) => a.depth - b.depth || a.label.localeCompare(b.label));

  // Immediate context: depth-1 entries, plus depth-2 entries when a logic node
  // sits at depth 1 (so the downstream node sees the content the logic node processed)
  const depth1 = full.filter((e) => e.depth === 1);
  const hasLogicAtDepth1 = depth1.some((e) => LOGIC_NODE_TYPES.has(e.nodeType));
  const immediate = hasLogicAtDepth1
    ? full.filter((e) => e.depth <= 2)
    : depth1;

  return { immediateContext: immediate, fullChainContext: full };
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
        const { immediateContext, fullChainContext } =
          gatherStructuredChainContext(node.id, allNodes, allEdges);

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
          immediateContext,
          fullChainContext,
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
