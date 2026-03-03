import { memo, useMemo } from "react";
import type { FlowEdge, FlowNode } from "./useFlowCanvas";

interface FlowEdgeLayerProps {
  nodes: FlowNode[];
  edges: FlowEdge[];
}

function computeEndpoints(from: FlowNode, to: FlowNode) {
  const fromCx = from.x + from.width / 2;
  const fromCy = from.y + from.height / 2;
  const toCx = to.x + to.width / 2;
  const toCy = to.y + to.height / 2;
  const dx = toCx - fromCx;
  const dy = toCy - fromCy;

  if (Math.abs(dx) > Math.abs(dy)) {
    // Horizontal dominant — right→left or left→right
    return dx > 0
      ? { x1: from.x + from.width, y1: fromCy, x2: to.x, y2: toCy }
      : { x1: from.x, y1: fromCy, x2: to.x + to.width, y2: toCy };
  }
  // Vertical dominant — bottom→top or top→bottom
  return dy > 0
    ? { x1: fromCx, y1: from.y + from.height, x2: toCx, y2: to.y }
    : { x1: fromCx, y1: from.y, x2: toCx, y2: to.y + to.height };
}

export const FlowEdgeLayer = memo(function FlowEdgeLayer({
  nodes,
  edges,
}: FlowEdgeLayerProps) {
  const nodeMap = useMemo(
    () => new Map(nodes.map((n) => [n.id, n])),
    [nodes],
  );

  if (edges.length === 0) return null;

  return (
    <svg
      className="absolute pointer-events-none overflow-visible"
      style={{ left: 0, top: 0, width: 1, height: 1 }}
    >
      <defs>
        <marker
          id="flow-arrow"
          markerWidth="8"
          markerHeight="6"
          refX="7"
          refY="3"
          orient="auto"
        >
          <polygon
            points="0,0 8,3 0,6"
            className="fill-muted-foreground/40"
          />
        </marker>
      </defs>
      {edges.map((edge) => {
        const from = nodeMap.get(edge.fromNodeId);
        const to = nodeMap.get(edge.toNodeId);
        if (!from || !to) return null;

        const { x1, y1, x2, y2 } = computeEndpoints(from, to);
        const mx = (x1 + x2) / 2;
        const my = (y1 + y2) / 2;

        // Offset the control point perpendicular to the line for a gentle curve
        const dx = Math.abs(x2 - x1);
        const dy = Math.abs(y2 - y1);
        const offset = Math.min(30, Math.max(dx, dy) * 0.2);

        // For vertical edges, offset horizontally; for horizontal, offset vertically
        const isVertical = dy > dx;
        const cx = isVertical ? mx + offset : mx;
        const cy = isVertical ? my : my - offset;

        const path = `M ${x1},${y1} Q ${cx},${cy} ${x2},${y2}`;

        return (
          <path
            key={edge.id}
            d={path}
            fill="none"
            className="stroke-muted-foreground/35"
            strokeWidth={1.5}
            markerEnd="url(#flow-arrow)"
          />
        );
      })}
    </svg>
  );
});
