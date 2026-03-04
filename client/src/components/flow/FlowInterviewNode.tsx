import React, { useCallback, useMemo } from "react";
import { MessageCircleQuestion, Play, X, Copy, Check, StickyNote } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FlowNode, FlowEdge } from "./useFlowCanvas";

interface FlowInterviewNodeProps {
  node: FlowNode;
  isSelected: boolean;
  allNodes: FlowNode[];
  edges: FlowEdge[];
  selectedNodeIds: Set<string>;
  onMouseDown: (e: React.MouseEvent, nodeId: string) => void;
  onDelete: (nodeId: string) => void;
  onUpdateNode: (nodeId: string, patch: Partial<FlowNode>) => void;
  onCreateNote: (content: string, label: string) => void;
  /** Called to start an interview with chain context from upstream nodes */
  onStartInterview?: (chainContext: string) => void;
}

/**
 * Traverse edges to collect content from all upstream nodes
 * connected to the given node via incoming edges.
 */
export function getUpstreamContext(
  nodeId: string,
  edges: FlowEdge[],
  nodes: FlowNode[],
  visited = new Set<string>(),
): string {
  if (visited.has(nodeId)) return "";
  visited.add(nodeId);

  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const parts: string[] = [];

  // Find all edges pointing TO this node
  const incomingEdges = edges.filter((e) => e.toNodeId === nodeId);

  for (const edge of incomingEdges) {
    const sourceNode = nodeMap.get(edge.fromNodeId);
    if (!sourceNode) continue;

    // Collect content from the source node
    const content = sourceNode.content || sourceNode.snippet || sourceNode.llmOutput;
    if (content) {
      parts.push(`[${sourceNode.label}]\n${content}`);
    }

    // Recursively collect from upstream of the source
    const upstream = getUpstreamContext(sourceNode.id, edges, nodes, visited);
    if (upstream) parts.push(upstream);
  }

  return parts.join("\n\n---\n\n");
}

export const FlowInterviewNode = React.memo(function FlowInterviewNode({
  node,
  isSelected,
  allNodes,
  edges,
  selectedNodeIds,
  onMouseDown,
  onDelete,
  onUpdateNode,
  onCreateNote,
  onStartInterview,
}: FlowInterviewNodeProps) {
  const [copied, setCopied] = React.useState(false);

  // Collect upstream context from connected nodes
  const chainContext = useMemo(
    () => getUpstreamContext(node.id, edges, allNodes),
    [node.id, edges, allNodes],
  );

  const upstreamCount = useMemo(() => {
    return edges.filter((e) => e.toNodeId === node.id).length;
  }, [edges, node.id]);

  const handleStart = useCallback(() => {
    if (onStartInterview) {
      onStartInterview(chainContext);
    }
  }, [onStartInterview, chainContext]);

  const handleCopyOutput = useCallback(() => {
    const output = node.llmOutput || node.content || "";
    if (!output) return;
    navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [node.llmOutput, node.content]);

  const handleSaveToNote = useCallback(() => {
    const output = node.llmOutput || node.content || "";
    if (!output) return;
    onCreateNote(output, `Interview: ${node.label}`);
  }, [node.llmOutput, node.content, node.label, onCreateNote]);

  return (
    <div
      className={cn(
        "absolute select-none rounded-lg border shadow-sm transition-shadow cursor-grab group",
        "hover:shadow-md bg-card border-cyan-500/30",
        isSelected && "ring-2 ring-primary shadow-md",
      )}
      style={{
        left: node.x,
        top: node.y,
        width: node.width,
        height: node.height,
        zIndex: node.zIndex,
      }}
      onMouseDown={(e) => onMouseDown(e, node.id)}
    >
      {/* Header */}
      <div className="flex items-center gap-1.5 px-2 py-1 border-b rounded-t-lg bg-cyan-500/10 border-cyan-500/20">
        <MessageCircleQuestion className="w-3 h-3 shrink-0 text-cyan-500" />
        <span className="text-[10px] font-medium truncate flex-1">{node.label}</span>
        <span className="text-[8px] font-semibold uppercase tracking-wider px-1 py-0.5 rounded bg-cyan-500/20 text-cyan-600 dark:text-cyan-400">
          Interview
        </span>
      </div>

      {/* Content */}
      <div className="px-2 py-1.5 overflow-hidden flex-1 space-y-1">
        {upstreamCount > 0 && (
          <p className="text-[9px] text-cyan-600 dark:text-cyan-400">
            {upstreamCount} upstream node{upstreamCount !== 1 ? "s" : ""} connected
          </p>
        )}
        <p className="text-[9px] text-muted-foreground leading-relaxed line-clamp-3">
          {node.snippet || (chainContext ? `Context from ${upstreamCount} source${upstreamCount !== 1 ? "s" : ""}` : "Connect upstream nodes to provide context")}
        </p>

        {/* Action buttons */}
        <div className="flex items-center gap-1 pt-0.5">
          {onStartInterview && (
            <button
              className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-medium bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 hover:bg-cyan-500/20 transition-colors"
              onClick={(e) => { e.stopPropagation(); handleStart(); }}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <Play className="w-2.5 h-2.5" />
              Interview
            </button>
          )}
          {(node.llmOutput || node.content) && (
            <>
              <button
                className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] text-muted-foreground hover:bg-muted/50 transition-colors"
                onClick={(e) => { e.stopPropagation(); handleCopyOutput(); }}
                onMouseDown={(e) => e.stopPropagation()}
              >
                {copied ? <Check className="w-2.5 h-2.5" /> : <Copy className="w-2.5 h-2.5" />}
              </button>
              <button
                className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] text-muted-foreground hover:bg-muted/50 transition-colors"
                onClick={(e) => { e.stopPropagation(); handleSaveToNote(); }}
                onMouseDown={(e) => e.stopPropagation()}
              >
                <StickyNote className="w-2.5 h-2.5" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Delete button */}
      <button
        className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          onDelete(node.id);
        }}
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  );
});
