import { useCallback } from "react";
import type { BSNode, BSConnector, BSPortSide } from "./types";
import { getPortPosition } from "./types";

interface BSConnectorLayerProps {
  nodes: BSNode[];
  connectors: BSConnector[];
  selectedConnectorIds: string[];
  onSelectConnector: (connectorIds: string[], additive?: boolean) => void;
  onDoubleClickConnector?: (connectorId: string) => void;
  /** Preview line while connecting */
  connectPreview?: {
    fromX: number;
    fromY: number;
    toX: number;
    toY: number;
  } | null;
}

export function BSConnectorLayer({
  nodes,
  connectors,
  selectedConnectorIds,
  onSelectConnector,
  onDoubleClickConnector,
  connectPreview,
}: BSConnectorLayerProps) {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  const renderConnector = useCallback(
    (connector: BSConnector) => {
      const fromNode = nodeMap.get(connector.fromNodeId);
      const toNode = nodeMap.get(connector.toNodeId);
      if (!fromNode || !toNode) return null;

      const from = getPortPosition(fromNode, connector.fromPort);
      const to = getPortPosition(toNode, connector.toPort);
      const isSelected = selectedConnectorIds.includes(connector.id);

      const path = buildOrthogonalPath(from, to, connector.fromPort, connector.toPort);

      // Arrow marker
      const markerId = `arrow-${connector.id}`;
      const endMarkerId = connector.endArrow !== "none" ? `url(#${markerId})` : undefined;

      return (
        <g key={connector.id}>
          {/* Arrow marker definition */}
          {connector.endArrow === "arrow" && (
            <defs>
              <marker
                id={markerId}
                markerWidth="10"
                markerHeight="8"
                refX="9"
                refY="4"
                orient="auto"
              >
                <polygon
                  points="0,0 10,4 0,8"
                  fill={isSelected ? "hsl(var(--primary))" : connector.color}
                />
              </marker>
            </defs>
          )}
          {connector.endArrow === "diamond" && (
            <defs>
              <marker
                id={markerId}
                markerWidth="12"
                markerHeight="8"
                refX="12"
                refY="4"
                orient="auto"
              >
                <polygon
                  points="0,4 6,0 12,4 6,8"
                  fill={isSelected ? "hsl(var(--primary))" : connector.color}
                />
              </marker>
            </defs>
          )}
          {connector.endArrow === "circle" && (
            <defs>
              <marker
                id={markerId}
                markerWidth="8"
                markerHeight="8"
                refX="8"
                refY="4"
                orient="auto"
              >
                <circle
                  cx="4"
                  cy="4"
                  r="3"
                  fill={isSelected ? "hsl(var(--primary))" : connector.color}
                />
              </marker>
            </defs>
          )}

          {/* Invisible wider hit area */}
          <path
            d={path}
            fill="none"
            stroke="transparent"
            strokeWidth={Math.max(12, connector.strokeWidth + 8)}
            className="cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              onSelectConnector([connector.id], e.shiftKey);
            }}
            onDoubleClick={(e) => {
              e.stopPropagation();
              onDoubleClickConnector?.(connector.id);
            }}
          />

          {/* Visible line */}
          <path
            d={path}
            fill="none"
            stroke={isSelected ? "hsl(var(--primary))" : connector.color}
            strokeWidth={connector.strokeWidth}
            strokeDasharray={
              connector.lineStyle === "dashed"
                ? "8,4"
                : connector.lineStyle === "dotted"
                  ? "2,4"
                  : undefined
            }
            markerEnd={endMarkerId}
            className="pointer-events-none"
          />

          {/* Label */}
          {connector.label && (
            <text
              x={(from.x + to.x) / 2}
              y={(from.y + to.y) / 2 - 6}
              textAnchor="middle"
              className="text-[10px] fill-muted-foreground select-none pointer-events-none"
            >
              {connector.label}
            </text>
          )}
        </g>
      );
    },
    [nodeMap, selectedConnectorIds, onSelectConnector, onDoubleClickConnector],
  );

  return (
    <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible">
      <g className="pointer-events-auto">
        {connectors.map(renderConnector)}
      </g>

      {/* Connect preview line */}
      {connectPreview && (
        <line
          x1={connectPreview.fromX}
          y1={connectPreview.fromY}
          x2={connectPreview.toX}
          y2={connectPreview.toY}
          stroke="hsl(var(--primary))"
          strokeWidth={2}
          strokeDasharray="6,3"
          className="pointer-events-none"
        />
      )}
    </svg>
  );
}

// ── Orthogonal path builder ──

function buildOrthogonalPath(
  from: { x: number; y: number },
  to: { x: number; y: number },
  fromPort: BSPortSide,
  toPort: BSPortSide,
): string {
  const offset = 30;

  // Get control points based on port directions
  let fx = from.x;
  let fy = from.y;
  let tx = to.x;
  let ty = to.y;

  // Extend from port direction
  let fx2 = fx;
  let fy2 = fy;
  switch (fromPort) {
    case "top": fy2 -= offset; break;
    case "bottom": fy2 += offset; break;
    case "left": fx2 -= offset; break;
    case "right": fx2 += offset; break;
  }

  // Extend to port direction
  let tx2 = tx;
  let ty2 = ty;
  switch (toPort) {
    case "top": ty2 -= offset; break;
    case "bottom": ty2 += offset; break;
    case "left": tx2 -= offset; break;
    case "right": tx2 += offset; break;
  }

  // Simple cubic bezier through control points
  return `M ${fx},${fy} C ${fx2},${fy2} ${tx2},${ty2} ${tx},${ty}`;
}
