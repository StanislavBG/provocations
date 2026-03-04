import { useMemo } from "react";
import type { FlowNode, FlowEdge, FlowNodeType } from "./useFlowCanvas";

export interface ConnectionContext {
  /** Nodes connected as inputs (edges pointing TO this node) */
  inputNodes: FlowNode[];
  /** Nodes connected as outputs (edges FROM this node) */
  outputNodes: FlowNode[];
  /** Types of downstream nodes */
  downstreamTypes: FlowNodeType[];
  /** Types of upstream nodes */
  upstreamTypes: FlowNodeType[];
  /** Whether a specific node type exists downstream */
  hasDownstream: (type: FlowNodeType) => boolean;
  /** Whether a specific node type exists upstream */
  hasUpstream: (type: FlowNodeType) => boolean;
  /** Combined text content from all input nodes */
  inputContent: string;
  /** Text specifically from document/context-doc inputs (any role) */
  topicText: string;
  /** Text from inputs with role="context" — background information */
  contextText: string;
  /** Text from inputs with role="objective" — starting prompt / research objective */
  objectiveText: string;
  /** The input edges with their roles */
  inputEdges: FlowEdge[];
}

export function useConnectionContext(
  nodeId: string | null,
  nodes: FlowNode[],
  edges: FlowEdge[],
): ConnectionContext | null {
  return useMemo(() => {
    if (!nodeId) return null;

    const inputEdges = edges.filter((e) => e.toNodeId === nodeId);
    const outputEdges = edges.filter((e) => e.fromNodeId === nodeId);

    const inputNodes = inputEdges
      .map((e) => nodes.find((n) => n.id === e.fromNodeId))
      .filter(Boolean) as FlowNode[];

    const outputNodes = outputEdges
      .map((e) => nodes.find((n) => n.id === e.toNodeId))
      .filter(Boolean) as FlowNode[];

    const downstreamTypes = outputNodes.map((n) => n.type);
    const upstreamTypes = inputNodes.map((n) => n.type);

    const inputContent = inputNodes
      .map((n) => n.documentContent || n.content || n.snippet || "")
      .filter(Boolean)
      .join("\n\n");

    // All doc inputs regardless of role
    const topicText = inputNodes
      .filter((n) => n.type === "document" || n.type === "context-doc")
      .map((n) => n.documentContent || n.content || n.snippet || "")
      .filter(Boolean)
      .join("\n\n");

    // Role-specific: nodes connected with role="context"
    const contextEdgeNodeIds = new Set(
      inputEdges.filter((e) => e.role === "context").map((e) => e.fromNodeId),
    );
    const contextText = inputNodes
      .filter((n) => contextEdgeNodeIds.has(n.id))
      .map((n) => n.documentContent || n.content || n.snippet || "")
      .filter(Boolean)
      .join("\n\n");

    // Role-specific: nodes connected with role="objective"
    const objectiveEdgeNodeIds = new Set(
      inputEdges.filter((e) => e.role === "objective").map((e) => e.fromNodeId),
    );
    const objectiveText = inputNodes
      .filter((n) => objectiveEdgeNodeIds.has(n.id))
      .map((n) => n.documentContent || n.content || n.snippet || "")
      .filter(Boolean)
      .join("\n\n");

    return {
      inputNodes,
      outputNodes,
      downstreamTypes,
      upstreamTypes,
      hasDownstream: (type: FlowNodeType) => downstreamTypes.includes(type),
      hasUpstream: (type: FlowNodeType) => upstreamTypes.includes(type),
      inputContent,
      topicText,
      contextText,
      objectiveText,
      inputEdges,
    };
  }, [nodeId, nodes, edges]);
}
