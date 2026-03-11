import { memo, useMemo, useRef, useState } from "react";
import type { FlowEdge, FlowNode, EdgeRole } from "./useFlowCanvas";
import { edgeRoles } from "./useFlowCanvas";
import type { PreviewEdge } from "./useFlowInteraction";

interface FlowEdgeLayerProps {
  nodes: FlowNode[];
  edges: FlowEdge[];
  previewEdge?: PreviewEdge | null;
  onDeleteEdge?: (edgeId: string) => void;
}

/**
 * Research node zone offsets (fraction of node height from top).
 * objective → top 25%, context → middle 50%, output → bottom 75%
 */
const RESEARCH_ZONE_Y: Record<string, number> = {
  objective: 0.2,
  context: 0.45,
  "output-format": 0.65,
};

function computeEndpoints(from: FlowNode, to: FlowNode, role?: EdgeRole | EdgeRole[]) {
  const fromCx = from.x + from.width / 2;
  const fromCy = from.y + from.height / 2;

  // For research nodes with a known role, target a specific vertical zone (use first role)
  // Legacy roleless edges target the context zone
  const primaryRole = Array.isArray(role) ? role[0] : role;
  const effectiveRole = primaryRole || "context";
  let toCy = to.y + to.height / 2;
  if (to.type === "research" && RESEARCH_ZONE_Y[effectiveRole] !== undefined) {
    toCy = to.y + to.height * RESEARCH_ZONE_Y[effectiveRole];
  }
  const toCx = to.x + to.width / 2;

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

/** Edge animation descriptor */
interface EdgeAnimation {
  color: string;
  markerSuffix: string;
  dashArray: string;
  animClass: string;
  speed: string;
  blobShape: "circle" | "rect";
  blobCount: number;
  glow: boolean;
}

/** Determine edge animation style based on the source node's state.
 *  For "one-at-a-time" producers (painter, youtube) only the latest edge
 *  from that node is animated — previous outputs stay static. */
function getEdgeAnimation(
  from: FlowNode,
  edgeId: string,
  latestEdgeFromNode: Map<string, string>,
): EdgeAnimation | null {
  // Painter and YouTube produce one output at a time — only animate the newest edge
  if (from.type === "painter" && from.llmStatus === "running") {
    if (latestEdgeFromNode.get(from.id) !== edgeId) return null;
    return { color: "hsl(var(--node-painter))", markerSuffix: "painter", dashArray: "8 4 2 4", animClass: "conveyor-edge", speed: "1.2", blobShape: "circle", blobCount: 3, glow: true };
  }
  if (from.type === "youtube" && from.youtubeFetchStatus === "fetching") {
    if (latestEdgeFromNode.get(from.id) !== edgeId) return null;
    return { color: "hsl(var(--node-youtube))", markerSuffix: "youtube", dashArray: "8 4 2 4", animClass: "conveyor-edge", speed: "1.0", blobShape: "rect", blobCount: 3, glow: true };
  }
  // Timer-Event is a continuous broadcaster — all edges animate
  if (from.type === "timer-event" && from.timerRunning) {
    return { color: "hsl(var(--node-timer-event))", markerSuffix: "timer", dashArray: "4 4", animClass: "kafka-edge", speed: "0.6", blobShape: "rect", blobCount: 4, glow: false };
  }
  return null;
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

  // ── Edge path cache (E3 optimization) ──
  // Caches computed SVG path strings keyed by edge ID + endpoint positions.
  // Only recalculates paths for edges connected to nodes that moved.
  const edgePathCacheRef = useRef(new Map<string, { key: string; path: string; x1: number; y1: number; x2: number; y2: number; mx: number; my: number }>());

  // For one-at-a-time producers, track the latest (last) edge from each node.
  // Edges are appended in order, so the last edge in the array is the newest.
  const latestEdgeFromNode = useMemo(() => {
    const map = new Map<string, string>();
    for (const edge of edges) {
      map.set(edge.fromNodeId, edge.id);
    }
    return map;
  }, [edges]);

  // Prune stale cache entries for removed edges
  useMemo(() => {
    const cache = edgePathCacheRef.current;
    const activeIds = new Set(edges.map((e) => e.id));
    for (const key of Array.from(cache.keys())) {
      if (!activeIds.has(key)) cache.delete(key);
    }
  }, [edges]);

  // ── Auto-detect event-bus channel pairs (publish → listen on same channel) ──
  const channelPairs = useMemo(() => {
    const publishers = nodes.filter((n) => n.type === "event-bus" && n.eventBusMode === "publish" && n.eventBusChannel);
    const listeners = nodes.filter((n) => n.type === "event-bus" && n.eventBusMode === "listen" && n.eventBusChannel);
    const pairs: Array<{ pub: FlowNode; sub: FlowNode; channel: string }> = [];
    for (const pub of publishers) {
      for (const sub of listeners) {
        if (pub.eventBusChannel === sub.eventBusChannel) {
          pairs.push({ pub, sub, channel: pub.eventBusChannel! });
        }
      }
    }
    return pairs;
  }, [nodes]);

  const hasContent = edges.length > 0 || previewEdge || channelPairs.length > 0;
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
            className="fill-muted-foreground/60"
          />
        </marker>
        {/* Painter conveyor arrow — rose colored */}
        <marker id="flow-arrow-painter" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
          <polygon points="0,0 8,3 0,6" fill="hsl(var(--node-painter))" opacity={0.7} />
        </marker>
        {/* YouTube conveyor arrow — red */}
        <marker id="flow-arrow-youtube" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
          <polygon points="0,0 8,3 0,6" fill="hsl(var(--node-youtube))" opacity={0.7} />
        </marker>
        {/* Timer/Kafka stream arrow — emerald */}
        <marker id="flow-arrow-timer" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
          <polygon points="0,0 8,3 0,6" fill="hsl(var(--node-timer-event))" opacity={0.7} />
        </marker>
        {/* Event-bus channel arrow — amber */}
        <marker id="flow-arrow-eventbus" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
          <polygon points="0,0 8,3 0,6" fill="rgba(217,119,6,0.7)" />
        </marker>
      </defs>

      {/* Edge animation keyframes */}
      <style>{`
        @keyframes conveyor-flow {
          0% { stroke-dashoffset: 24; }
          100% { stroke-dashoffset: 0; }
        }
        @keyframes kafka-flow {
          0% { stroke-dashoffset: 16; }
          100% { stroke-dashoffset: 0; }
        }
        @keyframes conveyor-glow {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 0.6; }
        }
        .conveyor-edge {
          animation: conveyor-flow 0.8s linear infinite;
        }
        .kafka-edge {
          animation: kafka-flow 0.4s linear infinite;
        }
        .conveyor-glow {
          animation: conveyor-glow 1.5s ease-in-out infinite;
        }
        @keyframes eventbus-flow {
          0% { stroke-dashoffset: 20; }
          100% { stroke-dashoffset: 0; }
        }
        @keyframes eventbus-pulse {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 0.8; }
        }
        .eventbus-edge {
          animation: eventbus-flow 1.0s linear infinite;
        }
        .eventbus-badge {
          animation: eventbus-pulse 2s ease-in-out infinite;
        }
      `}</style>

      {edges.map((edge) => {
        const from = nodeMap.get(edge.fromNodeId);
        const to = nodeMap.get(edge.toNodeId);
        if (!from || !to) return null;

        // Build a cache key from endpoint node positions + role
        const roleKey = Array.isArray(edge.role) ? edge.role.join(",") : (edge.role ?? "");
        const cacheKey = `${from.x},${from.y},${from.width},${from.height},${to.x},${to.y},${to.width},${to.height},${to.type},${roleKey}`;
        const cache = edgePathCacheRef.current;
        let cached = cache.get(edge.id);

        let x1: number, y1: number, x2: number, y2: number, mx: number, my: number, path: string;

        if (cached && cached.key === cacheKey) {
          // Reuse cached path — no recomputation needed
          ({ x1, y1, x2, y2, mx, my, path } = cached);
        } else {
          // Compute endpoints and path
          const ep = computeEndpoints(from, to, edge.role);
          x1 = ep.x1; y1 = ep.y1; x2 = ep.x2; y2 = ep.y2;
          mx = (x1 + x2) / 2;
          my = (y1 + y2) / 2;

          // Offset the control point perpendicular to the line for a gentle curve
          const ddx = Math.abs(x2 - x1);
          const ddy = Math.abs(y2 - y1);
          const offset = Math.min(30, Math.max(ddx, ddy) * 0.2);

          // For vertical edges, offset horizontally; for horizontal, offset vertically
          const isVertical = ddy > ddx;
          const cx = isVertical ? mx + offset : mx;
          const cy = isVertical ? my : my - offset;

          path = `M ${x1},${y1} Q ${cx},${cy} ${x2},${y2}`;
          cache.set(edge.id, { key: cacheKey, path, x1, y1, x2, y2, mx, my });
        }

        const isHovered = hoveredEdge === edge.id;
        const animation = getEdgeAnimation(from, edge.id, latestEdgeFromNode);

        return (
          <g key={edge.id}>
            {animation ? (
              <>
                {/* Glow trail */}
                <path
                  d={path}
                  fill="none"
                  stroke={animation.color}
                  strokeWidth={6}
                  opacity={0.12}
                  className={animation.glow ? "conveyor-glow" : ""}
                />
                {/* Animated dashed line */}
                <path
                  d={path}
                  fill="none"
                  stroke={animation.color}
                  strokeWidth={2.5}
                  strokeDasharray={animation.dashArray}
                  strokeLinecap="round"
                  opacity={0.7}
                  markerEnd={`url(#flow-arrow-${animation.markerSuffix})`}
                  className={animation.animClass}
                />
                {/* Traveling blobs */}
                {Array.from({ length: animation.blobCount }).map((_, i) => {
                  const beginDelay = `${(i * parseFloat(animation.speed)) / animation.blobCount}s`;
                  const opacity = 0.8 - i * 0.12;
                  return animation.blobShape === "circle" ? (
                    <circle key={i} r={3 - i * 0.3} fill={animation.color} opacity={opacity}>
                      <animateMotion dur={`${animation.speed}s`} repeatCount="indefinite" path={path} begin={beginDelay} />
                    </circle>
                  ) : (
                    <rect key={i} width={6} height={3} rx={1} fill={animation.color} opacity={opacity}>
                      <animateMotion dur={`${animation.speed}s`} repeatCount="indefinite" path={path} begin={beginDelay} />
                    </rect>
                  );
                })}
              </>
            ) : (
              <>
                {/* Normal visible edge line */}
                <path
                  d={path}
                  fill="none"
                  className={isHovered ? "stroke-destructive/70" : "stroke-muted-foreground/50"}
                  strokeWidth={isHovered ? 3 : 2}
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

            {/* Role label(s) on edge — legacy roleless edges show as context */}
            {!isHovered && (() => {
              const roles = edgeRoles(edge);
              // Legacy roleless edges are treated as context
              const displayRoles = roles.length > 0 ? roles : (["context"] as EdgeRole[]);
              const ROLE_COLORS: Record<string, string> = {
                objective: "rgba(59,130,246,1)",
                "output-format": "rgba(139,92,246,1)",
                context: "rgba(217,119,6,1)",
              };
              const ROLE_SHORT: Record<string, string> = {
                objective: "OBJ",
                context: "CTX",
                "output-format": "FMT",
              };
              const pillW = 32;
              const gap = 3;
              const totalW = displayRoles.length * pillW + (displayRoles.length - 1) * gap;
              const startX = mx - totalW / 2;
              return (
                <g>
                  {displayRoles.map((r, i) => (
                    <g key={r}>
                      <rect
                        x={startX + i * (pillW + gap)}
                        y={my - 8}
                        width={pillW}
                        height={16}
                        rx={4}
                        fill={ROLE_COLORS[r] || "rgba(100,100,100,1)"}
                      />
                      <text
                        x={startX + i * (pillW + gap) + pillW / 2}
                        y={my + 3}
                        textAnchor="middle"
                        fill="white"
                        fontSize="7"
                        fontWeight="600"
                        style={{ textTransform: "uppercase", letterSpacing: "0.05em", userSelect: "none" }}
                      >
                        {ROLE_SHORT[r] || r}
                      </text>
                    </g>
                  ))}
                </g>
              );
            })()}

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

      {/* ── Event-bus channel connections (virtual — not stored as edges) ── */}
      {channelPairs.map(({ pub, sub, channel }) => {
        // Compute endpoints: right side of publisher → left side of listener
        const x1 = pub.x + pub.width;
        const y1 = pub.y + pub.height / 2;
        const x2 = sub.x;
        const y2 = sub.y + sub.height / 2;
        const mx = (x1 + x2) / 2;
        const my = (y1 + y2) / 2;

        // Two-segment path with gap in the middle for the channel badge
        const gapHalf = 40;
        // Left segment: publisher → gap start (submerge into tunnel)
        const lx2 = mx - gapHalf;
        const ly2 = my;
        const lmx = (x1 + lx2) / 2;
        const pathLeft = `M ${x1},${y1} Q ${lmx},${y1} ${lx2},${ly2}`;

        // Right segment: gap end → listener (emerge from tunnel)
        const rx1 = mx + gapHalf;
        const ry1 = my;
        const rmx = (rx1 + x2) / 2;
        const pathRight = `M ${rx1},${ry1} Q ${rmx},${y2} ${x2},${y2}`;

        const pairKey = `eventbus-${pub.id}-${sub.id}`;
        const blobDur = "1.6s";

        return (
          <g key={pairKey}>
            {/* Left segment — publisher side (submerge) */}
            <path
              d={pathLeft}
              fill="none"
              stroke="rgba(217,119,6,0.3)"
              strokeWidth={2}
              strokeDasharray="6 4"
              className="eventbus-edge"
              markerEnd="url(#flow-arrow-eventbus)"
            />

            {/* Right segment — listener side (emerge) */}
            <path
              d={pathRight}
              fill="none"
              stroke="rgba(217,119,6,0.3)"
              strokeWidth={2}
              strokeDasharray="6 4"
              className="eventbus-edge"
              markerEnd="url(#flow-arrow-eventbus)"
            />

            {/* Submerge funnel — converging lines into badge */}
            <path
              d={`M ${lx2},${ly2 - 6} L ${mx - gapHalf + 12},${my} L ${lx2},${ly2 + 6}`}
              fill="none"
              stroke="rgba(217,119,6,0.2)"
              strokeWidth={1}
            />

            {/* Emerge funnel — diverging lines from badge */}
            <path
              d={`M ${rx1},${ry1 - 6} L ${mx + gapHalf - 12},${my} L ${rx1},${ry1 + 6}`}
              fill="none"
              stroke="rgba(217,119,6,0.2)"
              strokeWidth={1}
            />

            {/* Submerging blobs — travel left path, shrink + fade as they enter */}
            {[0, 1].map((i) => (
              <circle key={`sub-${i}`} fill="rgba(217,119,6,0.8)" opacity={0.8}>
                <animateMotion dur={blobDur} repeatCount="indefinite" path={pathLeft} begin={`${i * 0.8}s`} />
                <animate attributeName="r" values="3;3;1;0" keyTimes="0;0.5;0.85;1" dur={blobDur} repeatCount="indefinite" begin={`${i * 0.8}s`} />
                <animate attributeName="opacity" values="0.8;0.8;0.4;0" keyTimes="0;0.5;0.85;1" dur={blobDur} repeatCount="indefinite" begin={`${i * 0.8}s`} />
              </circle>
            ))}

            {/* Emerging blobs — travel right path, grow + brighten as they exit */}
            {[0, 1].map((i) => (
              <circle key={`emr-${i}`} fill="rgba(217,119,6,0.8)" opacity={0}>
                <animateMotion dur={blobDur} repeatCount="indefinite" path={pathRight} begin={`${i * 0.8}s`} />
                <animate attributeName="r" values="0;1;3;3" keyTimes="0;0.15;0.5;1" dur={blobDur} repeatCount="indefinite" begin={`${i * 0.8}s`} />
                <animate attributeName="opacity" values="0;0.4;0.8;0.8" keyTimes="0;0.15;0.5;1" dur={blobDur} repeatCount="indefinite" begin={`${i * 0.8}s`} />
              </circle>
            ))}

            {/* Center badge — ⚡ CHANNEL ⚡ */}
            <g className="eventbus-badge">
              <rect
                x={mx - 32}
                y={my - 10}
                width={64}
                height={20}
                rx={10}
                fill="rgba(217,119,6,0.15)"
                stroke="rgba(217,119,6,0.4)"
                strokeWidth={1}
              />
              <text
                x={mx}
                y={my + 4}
                textAnchor="middle"
                fontSize="8"
                fontWeight="bold"
                fontFamily="monospace"
                fill="rgba(217,119,6,0.8)"
                style={{ pointerEvents: "none" }}
              >
                ⚡ {channel.toUpperCase()} ⚡
              </text>
            </g>
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
