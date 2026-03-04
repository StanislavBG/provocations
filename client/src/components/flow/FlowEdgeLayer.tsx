import { memo, useMemo, useState } from "react";
import type { FlowEdge, FlowNode } from "./useFlowCanvas";
import type { PreviewEdge } from "./useFlowInteraction";

interface FlowEdgeLayerProps {
  nodes: FlowNode[];
  edges: FlowEdge[];
  previewEdge?: PreviewEdge | null;
  onDeleteEdge?: (edgeId: string) => void;
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

/** Check if this edge should show conveyor animation (painter running) */
function isPainterConveyor(from: FlowNode): boolean {
  return from.type === "painter" && from.llmStatus === "running";
}

export const FlowEdgeLayer = memo(function FlowEdgeLayer({
  nodes,
  edges,
  previewEdge,
  onDeleteEdge,
}: FlowEdgeLayerProps) {
  const nodeMap = useMemo(
    () => new Map(nodes.map((n) => [n.id, n])),
    [nodes],
  );

  const [hoveredEdge, setHoveredEdge] = useState<string | null>(null);

  const hasContent = edges.length > 0 || previewEdge;
  if (!hasContent) return null;

  return (
    <svg
      className="absolute overflow-visible"
      style={{ left: 0, top: 0, width: 1, height: 1, pointerEvents: "none" }}
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
        {/* Painter conveyor arrow — rose colored */}
        <marker
          id="flow-arrow-painter"
          markerWidth="8"
          markerHeight="6"
          refX="7"
          refY="3"
          orient="auto"
        >
          <polygon
            points="0,0 8,3 0,6"
            fill="#f43f5e"
            opacity={0.7}
          />
        </marker>
      </defs>

      {/* Painter conveyor animation keyframes */}
      <style>{`
        @keyframes conveyor-flow {
          0% { stroke-dashoffset: 24; }
          100% { stroke-dashoffset: 0; }
        }
        @keyframes conveyor-glow {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 0.6; }
        }
        .conveyor-edge {
          animation: conveyor-flow 0.8s linear infinite;
        }
        .conveyor-glow {
          animation: conveyor-glow 1.5s ease-in-out infinite;
        }
      `}</style>

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
        const isHovered = hoveredEdge === edge.id;
        const isConveyor = isPainterConveyor(from);

        return (
          <g key={edge.id}>
            {isConveyor ? (
              <>
                {/* Glow trail behind the conveyor */}
                <path
                  d={path}
                  fill="none"
                  stroke="#f43f5e"
                  strokeWidth={6}
                  opacity={0.12}
                  className="conveyor-glow"
                />
                {/* Animated dashed conveyor line */}
                <path
                  d={path}
                  fill="none"
                  stroke="#f43f5e"
                  strokeWidth={2.5}
                  strokeDasharray="8 4 2 4"
                  strokeLinecap="round"
                  opacity={0.7}
                  markerEnd="url(#flow-arrow-painter)"
                  className="conveyor-edge"
                />
                {/* Paint blob dots traveling along the edge */}
                <circle r={3} fill="#f43f5e" opacity={0.8}>
                  <animateMotion dur="1.2s" repeatCount="indefinite" path={path} />
                </circle>
                <circle r={2} fill="#fb7185" opacity={0.6}>
                  <animateMotion dur="1.2s" repeatCount="indefinite" path={path} begin="0.4s" />
                </circle>
                <circle r={2.5} fill="#e11d48" opacity={0.5}>
                  <animateMotion dur="1.2s" repeatCount="indefinite" path={path} begin="0.8s" />
                </circle>
              </>
            ) : (
              <>
                {/* Normal visible edge line */}
                <path
                  d={path}
                  fill="none"
                  className={isHovered ? "stroke-destructive/60" : "stroke-muted-foreground/35"}
                  strokeWidth={isHovered ? 2.5 : 1.5}
                  markerEnd="url(#flow-arrow)"
                />
              </>
            )}

            {/* Invisible wide hit area for hover/click */}
            <path
              d={path}
              fill="none"
              stroke="transparent"
              strokeWidth={14}
              style={{ pointerEvents: "stroke", cursor: "pointer" }}
              onMouseEnter={() => setHoveredEdge(edge.id)}
              onMouseLeave={() => setHoveredEdge(null)}
              onClick={(e) => {
                e.stopPropagation();
                onDeleteEdge?.(edge.id);
              }}
            />

            {/* Delete X button at midpoint on hover */}
            {isHovered && onDeleteEdge && (
              <g
                style={{ pointerEvents: "auto", cursor: "pointer" }}
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteEdge(edge.id);
                }}
              >
                <circle
                  cx={mx}
                  cy={my}
                  r={8}
                  className="fill-destructive"
                />
                <line
                  x1={mx - 3} y1={my - 3}
                  x2={mx + 3} y2={my + 3}
                  stroke="white" strokeWidth={1.5} strokeLinecap="round"
                />
                <line
                  x1={mx + 3} y1={my - 3}
                  x2={mx - 3} y2={my + 3}
                  stroke="white" strokeWidth={1.5} strokeLinecap="round"
                />
              </g>
            )}
          </g>
        );
      })}

      {/* Preview edge while drawing a connection */}
      {previewEdge && (() => {
        const sourceNode = nodeMap.get(previewEdge.sourceNodeId);
        if (!sourceNode) return null;

        // Start from the right side of the source node (output port)
        const x1 = sourceNode.x + sourceNode.width;
        const y1 = sourceNode.y + sourceNode.height / 2;
        const x2 = previewEdge.cursorX;
        const y2 = previewEdge.cursorY;
        const mx = (x1 + x2) / 2;

        const path = `M ${x1},${y1} Q ${mx},${y1} ${x2},${y2}`;

        return (
          <path
            d={path}
            fill="none"
            className="stroke-muted-foreground/50"
            strokeWidth={1.5}
            strokeDasharray="6 3"
          />
        );
      })()}
    </svg>
  );
});
