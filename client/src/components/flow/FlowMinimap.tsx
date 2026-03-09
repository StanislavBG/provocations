import { useCallback, useMemo, useRef, useEffect, useState } from "react";
import { GripHorizontal, Pin, ChevronDown, ChevronRight, X, Maximize2 } from "lucide-react";
import type { FlowNode, FlowEdge, FlowViewport } from "./useFlowCanvas";
import { getEffectiveLockMode } from "./useFlowCanvas";
import { useMinimapState } from "./useMinimapState";
import {
  MINIMAP_MIN_WIDTH,
  MINIMAP_MIN_HEIGHT,
  MINIMAP_MAX_WIDTH,
  MINIMAP_MAX_HEIGHT,
  MINIMAP_HEADER_HEIGHT,
} from "./minimap-types";

// ── Node type color map (exported for reuse) ──

/** Resolve a CSS variable `--name` to a hex string at runtime. Falls back to provided default. */
function cssVar(name: string, fallback: string): string {
  if (typeof document === "undefined") return fallback;
  const val = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  if (!val) return fallback;
  // val is an HSL triplet like "38 92% 50%" — convert to hsl() string
  return `hsl(${val})`;
}

/** Build the node-type color map from CSS variables for theme consistency. */
export function getNodeTypeColors(): Record<string, string> {
  return {
    "context-doc": cssVar("--node-context-doc", "#f59e0b"),
    research: cssVar("--node-research", "#3b82f6"),
    llm: cssVar("--node-llm", "#8b5cf6"),
    store: cssVar("--node-store", "#b35c1e"),
    painter: cssVar("--node-painter", "#f43f5e"),
    interview: cssVar("--node-interview", "#06b6d4"),
    timeline: cssVar("--node-timeline", "#f97316"),
    document: cssVar("--node-document", "#6366f1"),
    zone: cssVar("--node-zone", "#6b7280"),
    audio: cssVar("--node-audio", "#ef4444"),
    youtube: cssVar("--node-youtube", "#dc2626"),
    "timer-event": cssVar("--node-timer-event", "#10b981"),
    filter: cssVar("--node-filter", "#14b8a6"),
    gate: cssVar("--node-gate", "#eab308"),
    router: cssVar("--node-router", "#a855f7"),
    merge: cssVar("--node-merge", "#0ea5e9"),
    label: cssVar("--node-label", "#78716c"),
  };
}

/** @deprecated Use getNodeTypeColors() for theme-aware colors. Static fallback for non-DOM contexts. */
export const NODE_TYPE_COLORS: Record<string, string> = {
  "context-doc": "#f59e0b",
  research: "#3b82f6",
  llm: "#8b5cf6",
  store: "#b35c1e",
  painter: "#f43f5e",
  interview: "#06b6d4",
  timeline: "#f97316",
  document: "#6366f1",
  zone: "#6b7280",
  audio: "#ef4444",
  youtube: "#dc2626",
  "timer-event": "#10b981",
  filter: "#14b8a6",
  gate: "#eab308",
  router: "#a855f7",
  merge: "#0ea5e9",
  label: "#78716c",
};

// ── Edge role colors ──
function getEdgeRoleColors(): Record<string, string> {
  return {
    context: cssVar("--edge-context", "#f59e0b"),
    objective: cssVar("--edge-objective", "#3b82f6"),
  };
}
const EDGE_ROLE_COLORS: Record<string, string> = {
  context: "#f59e0b",
  objective: "#3b82f6",
};
const EDGE_DEFAULT_COLOR = "#666";

// ── Types ──

interface FlowMinimapProps {
  nodes: FlowNode[];
  edges: FlowEdge[];
  viewport: FlowViewport;
  selectedNodeIds: Set<string>;
  canvasWidth: number;
  canvasHeight: number;
  onViewportChange: (x: number, y: number, zoom: number) => void;
  onFitToView?: () => void;
  minimapState: ReturnType<typeof useMinimapState>;
}

interface WorldBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

// ── Constants ──

const PAD = 40;
const ZOOM_STEP = 1.15;
const MIN_MINIMAP_ZOOM = 0.5;
const MAX_MINIMAP_ZOOM = 4;

// ── Component ──

export function FlowMinimap({
  nodes,
  edges,
  viewport,
  selectedNodeIds,
  canvasWidth,
  canvasHeight,
  onViewportChange,
  onFitToView,
  minimapState,
}: FlowMinimapProps) {
  const { state: ms, setPosition, setSize, setMinimapZoom, togglePinned, toggleCollapsed, setVisible } = minimapState;

  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<{ type: "header" | "viewport" | "resize"; startX: number; startY: number; startMmX: number; startMmY: number; startW: number; startH: number; vpOffsetX: number; vpOffsetY: number } | null>(null);

  // Filter out screen-locked nodes — they're HUD, not canvas content
  const canvasNodes = useMemo(
    () => nodes.filter((n) => getEffectiveLockMode(n) !== "screen"),
    [nodes],
  );

  // ── World bounds ──
  const bounds: WorldBounds = useMemo(() => {
    if (canvasNodes.length === 0) return { minX: 0, minY: 0, maxX: 100, maxY: 100 };
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const n of canvasNodes) {
      minX = Math.min(minX, n.x);
      minY = Math.min(minY, n.y);
      maxX = Math.max(maxX, n.x + n.width);
      maxY = Math.max(maxY, n.y + n.height);
    }
    return { minX: minX - PAD, minY: minY - PAD, maxX: maxX + PAD, maxY: maxY + PAD };
  }, [canvasNodes]);

  // ── Effective render dimensions ──
  const svgW = ms.width;
  const svgH = ms.height - MINIMAP_HEADER_HEIGHT;

  // ── Scale & offset (incorporates minimap zoom) ──
  const { scale, offsetX, offsetY } = useMemo(() => {
    const worldW = bounds.maxX - bounds.minX || 1;
    const worldH = bounds.maxY - bounds.minY || 1;
    const baseScale = Math.min(svgW / worldW, svgH / worldH);
    const s = baseScale * ms.minimapZoom;

    // When zoomed in, center on the current viewport center
    if (ms.minimapZoom > 1) {
      const vpCenterX = -viewport.x / viewport.zoom + canvasWidth / viewport.zoom / 2;
      const vpCenterY = -viewport.y / viewport.zoom + canvasHeight / viewport.zoom / 2;
      const ox = vpCenterX - svgW / s / 2;
      const oy = vpCenterY - svgH / s / 2;
      return { scale: s, offsetX: ox, offsetY: oy };
    }
    return { scale: s, offsetX: bounds.minX, offsetY: bounds.minY };
  }, [bounds, svgW, svgH, ms.minimapZoom, viewport, canvasWidth, canvasHeight]);

  // ── Mapped node rectangles ──
  const mappedNodes = useMemo(
    () =>
      canvasNodes.map((n) => ({
        id: n.id,
        x: (n.x - offsetX) * scale,
        y: (n.y - offsetY) * scale,
        w: Math.max(n.width * scale, 2),
        h: Math.max(n.height * scale, 1.5),
        color: getNodeTypeColors()[n.type] || "#888",
        label: n.label,
        isSelected: selectedNodeIds.has(n.id),
        isZone: n.type === "zone",
      })),
    [canvasNodes, scale, offsetX, offsetY, selectedNodeIds],
  );

  // ── Mapped edge lines ──
  const mappedEdges = useMemo(() => {
    const nodeMap = new Map(canvasNodes.map((n) => [n.id, n]));
    return edges
      .map((e) => {
        const from = nodeMap.get(e.fromNodeId);
        const to = nodeMap.get(e.toNodeId);
        if (!from || !to) return null;
        return {
          id: e.id,
          x1: (from.x + from.width / 2 - offsetX) * scale,
          y1: (from.y + from.height / 2 - offsetY) * scale,
          x2: (to.x + to.width / 2 - offsetX) * scale,
          y2: (to.y + to.height / 2 - offsetY) * scale,
          color: (() => {
            const r = e.role;
            const edgeColors = getEdgeRoleColors();
            const edgeDefault = cssVar("--edge-default", "#666");
            if (!r) return edgeDefault;
            const primary = Array.isArray(r) ? r[0] : r;
            return edgeColors[primary] || edgeDefault;
          })(),
        };
      })
      .filter(Boolean) as Array<{ id: string; x1: number; y1: number; x2: number; y2: number; color: string }>;
  }, [edges, canvasNodes, scale, offsetX, offsetY]);

  // ── Viewport rectangle ──
  const viewRect = useMemo(() => {
    const vx = (-viewport.x / viewport.zoom - offsetX) * scale;
    const vy = (-viewport.y / viewport.zoom - offsetY) * scale;
    const vw = (canvasWidth / viewport.zoom) * scale;
    const vh = (canvasHeight / viewport.zoom) * scale;
    return { x: vx, y: vy, w: vw, h: vh };
  }, [viewport, canvasWidth, canvasHeight, scale, offsetX, offsetY]);

  // ── Detail level based on size ──
  const showEdges = svgW >= 150;
  const showLabels = svgW >= 250;

  // ── Default position (bottom-right) ──
  const posX = ms.x === -1 ? canvasWidth - ms.width - 16 : ms.x;
  const posY = ms.y === -1 ? canvasHeight - ms.height - 56 : ms.y;

  // ── Coordinate conversion: minimap SVG pixel → canvas world ──
  const minimapToCanvas = useCallback(
    (mx: number, my: number) => ({
      x: mx / scale + offsetX,
      y: my / scale + offsetY,
    }),
    [scale, offsetX, offsetY],
  );

  // ── Navigate: center viewport on a canvas point ──
  const navigateTo = useCallback(
    (canvasX: number, canvasY: number) => {
      onViewportChange(
        canvasWidth / 2 - canvasX * viewport.zoom,
        canvasHeight / 2 - canvasY * viewport.zoom,
        viewport.zoom,
      );
    },
    [onViewportChange, canvasWidth, canvasHeight, viewport.zoom],
  );

  // ── Check if a point is inside the viewport rectangle ──
  const isInsideViewRect = useCallback(
    (mx: number, my: number) =>
      mx >= viewRect.x && mx <= viewRect.x + viewRect.w && my >= viewRect.y && my <= viewRect.y + viewRect.h,
    [viewRect],
  );

  // ── Global mouse move/up for drag operations ──
  useEffect(() => {
    const handleMove = (e: MouseEvent) => {
      const d = dragRef.current;
      if (!d) return;
      e.preventDefault();
      e.stopPropagation();

      const dx = e.clientX - d.startX;
      const dy = e.clientY - d.startY;

      if (d.type === "header") {
        setPosition(d.startMmX + dx, d.startMmY + dy);
      } else if (d.type === "resize") {
        setSize(d.startW + dx, d.startH + dy);
      } else if (d.type === "viewport") {
        // Drag viewport rect within minimap to pan the canvas
        const svg = svgRef.current;
        if (!svg) return;
        const rect = svg.getBoundingClientRect();
        const mx = e.clientX - rect.left - d.vpOffsetX;
        const my = e.clientY - rect.top - d.vpOffsetY;
        const canvasPos = minimapToCanvas(mx, my);
        onViewportChange(
          canvasWidth / 2 - canvasPos.x * viewport.zoom,
          canvasHeight / 2 - canvasPos.y * viewport.zoom,
          viewport.zoom,
        );
      }
    };

    const handleUp = () => {
      dragRef.current = null;
    };

    window.addEventListener("mousemove", handleMove, true);
    window.addEventListener("mouseup", handleUp, true);
    return () => {
      window.removeEventListener("mousemove", handleMove, true);
      window.removeEventListener("mouseup", handleUp, true);
    };
  }, [setPosition, setSize, minimapToCanvas, onViewportChange, canvasWidth, canvasHeight, viewport.zoom]);

  // ── Header drag start ──
  const handleHeaderMouseDown = useCallback(
    (e: React.MouseEvent) => {
      // Don't start drag from buttons
      if ((e.target as HTMLElement).closest("button")) return;
      e.stopPropagation();
      e.preventDefault();
      dragRef.current = {
        type: "header",
        startX: e.clientX,
        startY: e.clientY,
        startMmX: posX,
        startMmY: posY,
        startW: ms.width,
        startH: ms.height,
        vpOffsetX: 0,
        vpOffsetY: 0,
      };
    },
    [posX, posY, ms.width, ms.height],
  );

  // ── SVG mouse down: viewport drag or click-to-navigate ──
  const handleSvgMouseDown = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      e.stopPropagation();
      e.preventDefault();
      const rect = e.currentTarget.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      if (isInsideViewRect(mx, my)) {
        // Start dragging the viewport rectangle
        dragRef.current = {
          type: "viewport",
          startX: e.clientX,
          startY: e.clientY,
          startMmX: posX,
          startMmY: posY,
          startW: ms.width,
          startH: ms.height,
          vpOffsetX: mx - viewRect.x - viewRect.w / 2,
          vpOffsetY: my - viewRect.y - viewRect.h / 2,
        };
      } else {
        // Click-to-navigate
        const canvasPos = minimapToCanvas(mx, my);
        navigateTo(canvasPos.x, canvasPos.y);
      }
    },
    [isInsideViewRect, posX, posY, ms.width, ms.height, viewRect, minimapToCanvas, navigateTo],
  );

  // ── Resize handle ──
  const handleResizeMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      dragRef.current = {
        type: "resize",
        startX: e.clientX,
        startY: e.clientY,
        startMmX: posX,
        startMmY: posY,
        startW: ms.width,
        startH: ms.height,
        vpOffsetX: 0,
        vpOffsetY: 0,
      };
    },
    [posX, posY, ms.width, ms.height],
  );

  // ── Minimap zoom (Shift+scroll) ──
  const handleMinimapWheel = useCallback(
    (e: WheelEvent) => {
      e.stopPropagation();
      e.preventDefault();
      if (e.shiftKey) {
        const factor = e.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP;
        const newZoom = Math.max(MIN_MINIMAP_ZOOM, Math.min(MAX_MINIMAP_ZOOM, ms.minimapZoom * factor));
        setMinimapZoom(newZoom);
      }
    },
    [ms.minimapZoom, setMinimapZoom],
  );

  // Non-passive wheel listener to avoid Chrome passive violations
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    el.addEventListener("wheel", handleMinimapWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleMinimapWheel);
  }, [handleMinimapWheel]);

  // ── Double-click: fit all nodes ──
  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      if (onFitToView) onFitToView();
    },
    [onFitToView],
  );

  // ── Visibility fade ──
  const [mounted, setMounted] = useState(ms.visible);
  const [animClass, setAnimClass] = useState(ms.visible ? "opacity-100" : "opacity-0");

  useEffect(() => {
    if (ms.visible) {
      setMounted(true);
      requestAnimationFrame(() => setAnimClass("opacity-100"));
    } else {
      setAnimClass("opacity-0");
      const t = setTimeout(() => setMounted(false), 200);
      return () => clearTimeout(t);
    }
  }, [ms.visible]);

  if (!mounted || canvasNodes.length === 0) return null;

  const zoomPct = Math.round(ms.minimapZoom * 100);

  return (
    <div
      ref={containerRef}
      className={`absolute z-25 select-none transition-opacity duration-200 ${animClass}`}
      style={{
        left: posX,
        top: posY,
        width: ms.width,
        height: ms.collapsed ? MINIMAP_HEADER_HEIGHT : ms.height,
        overflow: "hidden",
        transition: ms.collapsed ? "height 150ms ease-out, opacity 200ms" : "height 150ms ease-out, opacity 200ms",
      }}
      onMouseDown={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Card background */}
      <div className="absolute inset-0 rounded-lg border border-border/50 bg-card/85 backdrop-blur-md shadow-lg" />

      {/* ── Header bar ── */}
      <div
        className="relative flex items-center gap-1 px-1.5 h-[22px] cursor-grab active:cursor-grabbing select-none rounded-t-lg"
        onMouseDown={handleHeaderMouseDown}
      >
        <GripHorizontal className="w-3 h-3 text-muted-foreground/50 shrink-0" />
        <span className="text-[9px] font-medium text-muted-foreground/70 tracking-wider uppercase shrink-0">Map</span>
        {ms.collapsed && (
          <span className="text-[8px] text-muted-foreground/40 ml-0.5">({canvasNodes.length})</span>
        )}
        <span className="text-[8px] text-muted-foreground/40 ml-auto mr-0.5">{zoomPct}%</span>

        {/* Pin */}
        <button
          className="w-4 h-4 flex items-center justify-center rounded hover:bg-muted/50 transition-colors"
          onClick={(e) => { e.stopPropagation(); togglePinned(); }}
          title={ms.pinned ? "Unpin" : "Pin position"}
        >
          <Pin className={`w-2.5 h-2.5 ${ms.pinned ? "text-primary fill-primary" : "text-muted-foreground/50"}`} />
        </button>

        {/* Fit to view */}
        {onFitToView && (
          <button
            className="w-4 h-4 flex items-center justify-center rounded hover:bg-muted/50 transition-colors"
            onClick={(e) => { e.stopPropagation(); onFitToView(); }}
            title="Fit all nodes in view"
          >
            <Maximize2 className="w-2.5 h-2.5 text-muted-foreground/50" />
          </button>
        )}

        {/* Collapse */}
        <button
          className="w-4 h-4 flex items-center justify-center rounded hover:bg-muted/50 transition-colors"
          onClick={(e) => { e.stopPropagation(); toggleCollapsed(); }}
          title={ms.collapsed ? "Expand" : "Collapse"}
        >
          {ms.collapsed
            ? <ChevronRight className="w-2.5 h-2.5 text-muted-foreground/50" />
            : <ChevronDown className="w-2.5 h-2.5 text-muted-foreground/50" />}
        </button>

        {/* Close */}
        <button
          className="w-4 h-4 flex items-center justify-center rounded hover:bg-muted/50 transition-colors"
          onClick={(e) => { e.stopPropagation(); setVisible(false); }}
          title="Hide minimap (M to show)"
        >
          <X className="w-2.5 h-2.5 text-muted-foreground/50" />
        </button>
      </div>

      {/* ── SVG body ── */}
      {!ms.collapsed && (
        <svg
          ref={svgRef}
          width={svgW}
          height={Math.max(svgH, 0)}
          className="relative cursor-pointer"
          onMouseDown={handleSvgMouseDown}
          onDoubleClick={handleDoubleClick}
          /* wheel handled via non-passive native listener */
        >
          {/* Layer 1: Edges */}
          {showEdges &&
            mappedEdges.map((e) => (
              <line
                key={e.id}
                x1={e.x1}
                y1={e.y1}
                x2={e.x2}
                y2={e.y2}
                stroke={e.color}
                strokeWidth={0.6}
                opacity={0.3}
              />
            ))}

          {/* Layer 2: Zone backgrounds */}
          {mappedNodes
            .filter((n) => n.isZone)
            .map((n) => (
              <rect
                key={`zone-${n.id}`}
                x={n.x}
                y={n.y}
                width={n.w}
                height={n.h}
                rx={1}
                fill={n.color}
                opacity={0.15}
              />
            ))}

          {/* Layer 3: Node rectangles */}
          {mappedNodes
            .filter((n) => !n.isZone)
            .map((n) => (
              <rect
                key={n.id}
                x={n.x}
                y={n.y}
                width={n.w}
                height={n.h}
                rx={0.8}
                fill={n.color}
                opacity={n.isSelected ? 1 : 0.7}
              />
            ))}

          {/* Layer 4: Selected highlight rings */}
          {mappedNodes
            .filter((n) => n.isSelected)
            .map((n) => (
              <rect
                key={`sel-${n.id}`}
                x={n.x - 1.5}
                y={n.y - 1.5}
                width={n.w + 3}
                height={n.h + 3}
                rx={2}
                fill="none"
                stroke="hsl(var(--primary))"
                strokeWidth={1.2}
                className="minimap-pulse"
              />
            ))}

          {/* Layer 5: Node labels (large minimap only) */}
          {showLabels &&
            mappedNodes
              .filter((n) => !n.isZone && n.w > 12)
              .map((n) => {
                const fontSize = Math.max(3, Math.min(6, n.h * 0.5));
                return (
                  <text
                    key={`lbl-${n.id}`}
                    x={n.x + n.w / 2}
                    y={n.y + n.h / 2 + fontSize * 0.35}
                    textAnchor="middle"
                    fontSize={fontSize}
                    fill="white"
                    opacity={0.85}
                    style={{ pointerEvents: "none" }}
                  >
                    {n.label.length > 12 ? n.label.slice(0, 11) + "\u2026" : n.label}
                  </text>
                );
              })}

          {/* Layer 6: Viewport indicator */}
          <rect
            x={viewRect.x}
            y={viewRect.y}
            width={viewRect.w}
            height={viewRect.h}
            fill="hsl(var(--primary))"
            fillOpacity={0.06}
            stroke="hsl(var(--primary))"
            strokeWidth={1.5}
            rx={1.5}
            opacity={0.7}
            className={isInsideViewRect(viewRect.x + viewRect.w / 2, viewRect.y + viewRect.h / 2) ? "cursor-grab" : ""}
          />
        </svg>
      )}

      {/* ── Resize handle (bottom-right corner) ── */}
      {!ms.collapsed && (
        <div
          className="absolute bottom-0 right-0 w-3 h-3 cursor-nwse-resize z-10"
          onMouseDown={handleResizeMouseDown}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" className="text-muted-foreground/30">
            <line x1="11" y1="3" x2="3" y2="11" stroke="currentColor" strokeWidth="1" />
            <line x1="11" y1="7" x2="7" y2="11" stroke="currentColor" strokeWidth="1" />
            <line x1="11" y1="11" x2="11" y2="11" stroke="currentColor" strokeWidth="1" />
          </svg>
        </div>
      )}
    </div>
  );
}
