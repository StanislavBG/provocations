import { Fragment, useMemo, useEffect, useCallback } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useFtuxShell } from "@/lib/ftux-shell-context";
import type { FlowNode, FlowEdge } from "./useFlowCanvas";
import { NODE_STYLES, NODE_ICONS, ACCENT_BG } from "./FlowNodeRenderer";

/**
 * Compute the ordered chain of connected nodes starting from a given node.
 * BFS to find connected component, then topological sort for left-to-right order.
 */
function computeChain(
  activeNodeId: string,
  nodes: FlowNode[],
  edges: FlowEdge[],
): FlowNode[] {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  if (!nodeMap.has(activeNodeId)) return [];

  // Build adjacency (both directions for finding connected component)
  const forward = new Map<string, string[]>();
  const backward = new Map<string, string[]>();
  for (const e of edges) {
    if (!nodeMap.has(e.fromNodeId) || !nodeMap.has(e.toNodeId)) continue;
    if (!forward.has(e.fromNodeId)) forward.set(e.fromNodeId, []);
    forward.get(e.fromNodeId)!.push(e.toNodeId);
    if (!backward.has(e.toNodeId)) backward.set(e.toNodeId, []);
    backward.get(e.toNodeId)!.push(e.fromNodeId);
  }

  // BFS to find connected component (undirected traversal)
  const visited = new Set<string>();
  const queue = [activeNodeId];
  visited.add(activeNodeId);
  while (queue.length > 0) {
    const cur = queue.shift()!;
    for (const next of forward.get(cur) || []) {
      if (!visited.has(next)) {
        visited.add(next);
        queue.push(next);
      }
    }
    for (const prev of backward.get(cur) || []) {
      if (!visited.has(prev)) {
        visited.add(prev);
        queue.push(prev);
      }
    }
  }

  // Topological sort (Kahn's algorithm) within the connected component
  const componentIds = Array.from(visited);
  const inDegree = new Map<string, number>();
  for (const id of componentIds) inDegree.set(id, 0);
  for (const e of edges) {
    if (visited.has(e.fromNodeId) && visited.has(e.toNodeId)) {
      inDegree.set(e.toNodeId, (inDegree.get(e.toNodeId) || 0) + 1);
    }
  }

  const sorted: string[] = [];
  const sources = componentIds.filter((id) => inDegree.get(id) === 0);
  const q = [...sources];
  while (q.length > 0) {
    const cur = q.shift()!;
    sorted.push(cur);
    for (const next of forward.get(cur) || []) {
      if (!visited.has(next)) continue;
      const deg = (inDegree.get(next) || 1) - 1;
      inDegree.set(next, deg);
      if (deg === 0) q.push(next);
    }
  }

  // Append any remaining nodes (cycles) in original order
  for (const id of componentIds) {
    if (!sorted.includes(id)) sorted.push(id);
  }

  return sorted.map((id) => nodeMap.get(id)!).filter(Boolean);
}

interface FlowChainNavBarProps {
  activeNodeId: string;
  nodes: FlowNode[];
  edges: FlowEdge[];
  onNavigate: (nodeId: string) => void;
}

export function FlowChainNavBar({
  activeNodeId,
  nodes,
  edges,
  onNavigate,
}: FlowChainNavBarProps) {
  const { statusBarPosition } = useFtuxShell();
  const chain = useMemo(
    () => computeChain(activeNodeId, nodes, edges),
    [activeNodeId, nodes, edges],
  );

  const activeIndex = chain.findIndex((n) => n.id === activeNodeId);

  // Keyboard navigation: ArrowLeft / ArrowRight
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        (e.target as HTMLElement)?.isContentEditable
      )
        return;

      if (e.key === "ArrowLeft" && activeIndex > 0) {
        e.preventDefault();
        onNavigate(chain[activeIndex - 1].id);
      } else if (e.key === "ArrowRight" && activeIndex < chain.length - 1) {
        e.preventDefault();
        onNavigate(chain[activeIndex + 1].id);
      }
    },
    [chain, activeIndex, onNavigate],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  if (chain.length === 0) return null;

  return (
    <div
      className="fixed left-0 right-0 z-[46] flex items-center gap-1 px-4 py-2
                 bg-card/90 backdrop-blur-sm border-t border-border/50 overflow-x-auto"
      style={{ bottom: statusBarPosition === "bottom" ? "var(--ftux-status-bar-height, 36px)" : 0 }}
    >
      <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold mr-2 shrink-0">
        Chain
      </span>

      {chain.map((node, i) => {
        const style = NODE_STYLES[node.type];
        const Icon = NODE_ICONS[node.type];
        const isActive = node.id === activeNodeId;

        return (
          <Fragment key={node.id}>
            {i > 0 && (
              <ChevronRight className="w-3 h-3 text-muted-foreground/40 shrink-0" />
            )}
            <button
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium",
                "border transition-all shrink-0 max-w-[160px]",
                isActive
                  ? cn(
                      ACCENT_BG[style.accent] || "bg-primary",
                      "text-white border-transparent shadow-sm",
                    )
                  : "bg-card border-border/50 hover:bg-muted/50 text-foreground",
              )}
              onClick={() => !isActive && onNavigate(node.id)}
              title={node.label || style.badge}
            >
              <Icon
                className={cn(
                  "w-3.5 h-3.5 shrink-0",
                  isActive ? "text-white" : style.iconClass,
                )}
              />
              <span className="truncate">
                {node.label || style.badge}
              </span>
            </button>
          </Fragment>
        );
      })}

      {chain.length > 1 && (
        <span className="text-[9px] text-muted-foreground/50 ml-auto shrink-0">
          <kbd className="px-1 py-0.5 rounded bg-muted/50 text-[8px]">&larr;</kbd>{" "}
          <kbd className="px-1 py-0.5 rounded bg-muted/50 text-[8px]">&rarr;</kbd>{" "}
          navigate
        </span>
      )}
    </div>
  );
}
