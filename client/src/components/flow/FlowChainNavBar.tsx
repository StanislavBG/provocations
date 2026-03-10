import { Fragment, useMemo, useEffect, useCallback } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useFtuxConfig } from "@/lib/ftux-shell-context";
import type { FlowNode, FlowEdge } from "./useFlowCanvas";
import { NODE_STYLES, NODE_ICONS, ACCENT_BG, ACCENT_TEXT } from "./FlowNodeRegistry";

/**
 * Compute the direct workflow chain through a given node.
 * Walks backward (upstream ancestors) and forward (downstream descendants)
 * following directed edges only. Unconnected nodes produce a chain of 1.
 */
function computeChain(
  activeNodeId: string,
  nodes: FlowNode[],
  edges: FlowEdge[],
): FlowNode[] {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  if (!nodeMap.has(activeNodeId)) return [];

  // Build directed adjacency
  const forward = new Map<string, string[]>();
  const backward = new Map<string, string[]>();
  for (const e of edges) {
    if (!nodeMap.has(e.fromNodeId) || !nodeMap.has(e.toNodeId)) continue;
    if (!forward.has(e.fromNodeId)) forward.set(e.fromNodeId, []);
    forward.get(e.fromNodeId)!.push(e.toNodeId);
    if (!backward.has(e.toNodeId)) backward.set(e.toNodeId, []);
    backward.get(e.toNodeId)!.push(e.fromNodeId);
  }

  // BFS upstream (follow backward edges only)
  const upstream: string[] = [];
  const upVisited = new Set<string>([activeNodeId]);
  const upQueue = [...(backward.get(activeNodeId) || [])];
  for (const id of upQueue) upVisited.add(id);
  while (upQueue.length > 0) {
    const cur = upQueue.shift()!;
    upstream.push(cur);
    for (const prev of backward.get(cur) || []) {
      if (!upVisited.has(prev)) {
        upVisited.add(prev);
        upQueue.push(prev);
      }
    }
  }

  // BFS downstream (follow forward edges only)
  const downstream: string[] = [];
  const downVisited = new Set<string>([activeNodeId]);
  const downQueue = [...(forward.get(activeNodeId) || [])];
  for (const id of downQueue) downVisited.add(id);
  while (downQueue.length > 0) {
    const cur = downQueue.shift()!;
    downstream.push(cur);
    for (const next of forward.get(cur) || []) {
      if (!downVisited.has(next)) {
        downVisited.add(next);
        downQueue.push(next);
      }
    }
  }

  // Build chain: upstream (reversed for source-first) → active → downstream
  const chain = [...upstream.reverse(), activeNodeId, ...downstream];
  return chain.map((id) => nodeMap.get(id)!).filter(Boolean);
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
  const { statusBarPosition } = useFtuxConfig();
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
      style={{ bottom: statusBarPosition === "bottom" ? "var(--ftux-status-bar-height, 44px)" : 0 }}
      role="navigation"
      aria-label="Node chain navigation"
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
                      ACCENT_TEXT[style.accent] || "text-white",
                      "border-transparent shadow-sm",
                    )
                  : "bg-card border-border/50 hover:bg-muted/50 text-foreground",
              )}
              onClick={() => !isActive && onNavigate(node.id)}
              title={node.label || style.badge}
              aria-label={`Navigate to ${node.label || style.badge}${isActive ? " (current)" : ""}`}
              aria-current={isActive ? "step" : undefined}
            >
              <Icon
                className={cn(
                  "w-3.5 h-3.5 shrink-0",
                  isActive ? (ACCENT_TEXT[style.accent] || "text-white") : style.iconClass,
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
