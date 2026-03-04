import { useCallback, useMemo, useRef, useState, useEffect } from "react";
import { BookOpen, Sparkles } from "lucide-react";
import type { FlowCanvasState, FlowNode, FlowEdge, FlowViewport } from "./useFlowCanvas";
import { FlowNodeRenderer } from "./FlowNodeRenderer";
import { FlowStoreNode } from "./FlowStoreNode";
import { FlowLlmNode } from "./FlowLlmNode";
import { FlowDocumentNode } from "./FlowDocumentNode";
import { FlowZoneNode } from "./FlowZoneNode";
import { FlowAudioNode } from "./FlowAudioNode";
import { FlowEdgeLayer } from "./FlowEdgeLayer";
import { useFlowInteraction } from "./useFlowInteraction";

interface FlowCanvasProps {
  state: FlowCanvasState;
  frozen?: boolean;
  onMoveNode: (nodeId: string, x: number, y: number) => void;
  onMoveNodes?: (nodeIds: string[], dx: number, dy: number) => void;
  onDeleteNode: (nodeId: string) => void;
  onSelectNode: (nodeId: string | null) => void;
  onSelectNodes?: (nodeIds: string[]) => void;
  onToggleSelectNode: (nodeId: string) => void;
  onNodeDoubleClick: (nodeId: string) => void;
  onViewportChange: (x: number, y: number, zoom: number) => void;
  onPickDocument: (doc: { id: number; title: string; content: string }) => void;
  onUpdateNode: (nodeId: string, patch: Partial<FlowNode>) => void;
  onCreateNote: (content: string, label: string) => void;
  onCreateEdge?: (fromNodeId: string, toNodeId: string) => void;
  onDeleteEdge?: (edgeId: string) => void;
  onPlayNode?: (nodeId: string) => void;
  onDropTool?: (toolId: string, canvasX: number, canvasY: number) => void;
  onDragStart?: () => void;
}

const GRID_SIZE = 20;

/** Buffer around viewport — nodes within this margin are still rendered */
const VIEWPORT_BUFFER = 200;

/** Check if a node is within the visible viewport + buffer */
function isNodeVisible(
  node: FlowNode,
  viewport: FlowViewport,
  canvasWidth: number,
  canvasHeight: number,
): boolean {
  // Convert viewport coords to canvas coords
  const visLeft = (-viewport.x / viewport.zoom) - VIEWPORT_BUFFER;
  const visTop = (-viewport.y / viewport.zoom) - VIEWPORT_BUFFER;
  const visRight = visLeft + (canvasWidth / viewport.zoom) + VIEWPORT_BUFFER * 2;
  const visBottom = visTop + (canvasHeight / viewport.zoom) + VIEWPORT_BUFFER * 2;

  // Check overlap
  return (
    node.x + node.width >= visLeft &&
    node.x <= visRight &&
    node.y + node.height >= visTop &&
    node.y <= visBottom
  );
}

export function FlowCanvas({
  state,
  frozen,
  onMoveNode,
  onMoveNodes,
  onDeleteNode,
  onSelectNode,
  onSelectNodes,
  onToggleSelectNode,
  onNodeDoubleClick,
  onViewportChange,
  onPickDocument,
  onUpdateNode,
  onCreateNote,
  onCreateEdge,
  onDeleteEdge,
  onPlayNode,
  onDropTool,
  onDragStart,
}: FlowCanvasProps) {
  const {
    canvasRef,
    handleWheel,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleNodeMouseDown,
    handleNodeDoubleClick,
    handlePortMouseDown,
    screenToCanvas,
    isDragging,
    isPanning,
    isDrawingEdge,
    isMarquee,
    previewEdge,
    marqueeRect,
  } = useFlowInteraction({
    viewport: state.viewport,
    onViewportChange,
    onNodeMove: onMoveNode,
    onNodesMove: onMoveNodes,
    onSelectNode,
    onSelectNodes,
    onToggleSelectNode,
    onNodeDoubleClick,
    onEdgeCreate: onCreateEdge,
    onDragStart,
    nodes: state.nodes,
  });

  // Track canvas dimensions for viewport culling
  const [canvasDims, setCanvasDims] = useState({ width: 800, height: 600 });

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setCanvasDims({ width: entry.contentRect.width, height: entry.contentRect.height });
      }
    });
    ro.observe(el);
    // Set initial size
    setCanvasDims({ width: el.clientWidth, height: el.clientHeight });
    return () => ro.disconnect();
  }, [canvasRef]);

  // Sort nodes: zones first (below), then regular nodes by zIndex
  const sortedNodes = useMemo(() => {
    const zones = state.nodes.filter((n) => n.type === "zone");
    const others = state.nodes.filter((n) => n.type !== "zone");
    return [
      ...zones.sort((a, b) => a.zIndex - b.zIndex),
      ...others.sort((a, b) => a.zIndex - b.zIndex),
    ];
  }, [state.nodes]);

  // Viewport virtualization: only render nodes within the visible area + buffer
  const visibleNodes = useMemo(() => {
    if (state.nodes.length < 50) return sortedNodes; // Skip culling for small canvases
    return sortedNodes.filter((node) =>
      isNodeVisible(node, state.viewport, canvasDims.width, canvasDims.height),
    );
  }, [sortedNodes, state.viewport, canvasDims, state.nodes.length]);

  // Also cull edges: only render edges where at least one endpoint is visible
  const visibleEdges = useMemo(() => {
    if (state.nodes.length < 50) return state.edges;
    const visibleNodeIds = new Set(visibleNodes.map((n) => n.id));
    return state.edges.filter(
      (e) => visibleNodeIds.has(e.fromNodeId) || visibleNodeIds.has(e.toNodeId),
    );
  }, [state.edges, visibleNodes, state.nodes.length]);

  const gridSize = GRID_SIZE * state.viewport.zoom;

  const handleDragOver = useCallback((e: React.DragEvent) => {
    if (e.dataTransfer.types.includes("application/x-flow-tool")) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      const toolId = e.dataTransfer.getData("application/x-flow-tool");
      if (toolId && onDropTool) {
        e.preventDefault();
        const pos = screenToCanvas(e.clientX, e.clientY);
        onDropTool(toolId, pos.x, pos.y);
      }
    },
    [screenToCanvas, onDropTool],
  );

  const cursorClass = frozen
    ? "cursor-not-allowed"
    : isDrawingEdge
      ? "cursor-crosshair"
      : isPanning
        ? "cursor-grabbing"
        : isMarquee
          ? "cursor-crosshair"
          : "cursor-default";

  return (
    <div
      ref={canvasRef}
      className={`absolute inset-0 overflow-hidden bg-background ${cursorClass}`}
      onWheel={frozen ? undefined : handleWheel}
      onMouseDown={frozen ? undefined : handleMouseDown}
      onMouseMove={frozen ? undefined : handleMouseMove}
      onMouseUp={frozen ? undefined : handleMouseUp}
      onMouseLeave={frozen ? undefined : handleMouseUp}
      onDragOver={frozen ? undefined : handleDragOver}
      onDrop={frozen ? undefined : handleDrop}
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Dot grid */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none">
        <defs>
          <pattern
            id="flow-grid"
            x={state.viewport.x % gridSize}
            y={state.viewport.y % gridSize}
            width={gridSize}
            height={gridSize}
            patternUnits="userSpaceOnUse"
          >
            <circle
              cx={gridSize / 2}
              cy={gridSize / 2}
              r={0.8}
              fill="currentColor"
              className="text-muted-foreground/20"
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#flow-grid)" />
      </svg>

      {/* Viewport transform layer */}
      <div
        className="absolute"
        style={{
          transform: `translate(${state.viewport.x}px, ${state.viewport.y}px) scale(${state.viewport.zoom})`,
          transformOrigin: "0 0",
        }}
      >
        {/* Edges behind nodes */}
        <FlowEdgeLayer
          nodes={state.nodes}
          edges={visibleEdges}
          previewEdge={previewEdge}
          onDeleteEdge={onDeleteEdge}
        />

        {visibleNodes.map((node) =>
          node.type === "zone" ? (
            <FlowZoneNode
              key={node.id}
              node={node}
              isSelected={state.selectedNodeIds.has(node.id)}
              zoom={state.viewport.zoom}
              onMouseDown={handleNodeMouseDown}
              onDelete={onDeleteNode}
              onUpdateNode={onUpdateNode}
            />
          ) : node.type === "store" ? (
            <FlowStoreNode
              key={node.id}
              node={node}
              isSelected={state.selectedNodeIds.has(node.id)}
              onMouseDown={handleNodeMouseDown}
              onDelete={onDeleteNode}
              onPickDocument={onPickDocument}
            />
          ) : node.type === "document" ? (
            <FlowDocumentNode
              key={node.id}
              node={node}
              isSelected={state.selectedNodeIds.has(node.id)}
              onMouseDown={handleNodeMouseDown}
              onDoubleClick={handleNodeDoubleClick}
              onDelete={onDeleteNode}
              onPortMouseDown={handlePortMouseDown}
            />
          ) : node.type === "audio" ? (
            <FlowAudioNode
              key={node.id}
              node={node}
              isSelected={state.selectedNodeIds.has(node.id)}
              onMouseDown={handleNodeMouseDown}
              onDelete={onDeleteNode}
              onUpdateNode={onUpdateNode}
              onPortMouseDown={handlePortMouseDown}
            />
          ) : node.type === "llm" ? (
            <FlowLlmNode
              key={node.id}
              node={node}
              isSelected={state.selectedNodeIds.has(node.id)}
              allNodes={state.nodes}
              selectedNodeIds={state.selectedNodeIds}
              onMouseDown={handleNodeMouseDown}
              onDelete={onDeleteNode}
              onUpdateNode={onUpdateNode}
              onCreateNote={onCreateNote}
              onPortMouseDown={handlePortMouseDown}
            />
          ) : (
            <FlowNodeRenderer
              key={node.id}
              node={node}
              isSelected={state.selectedNodeIds.has(node.id)}
              onMouseDown={handleNodeMouseDown}
              onDoubleClick={handleNodeDoubleClick}
              onDelete={onDeleteNode}
              onPortMouseDown={handlePortMouseDown}
              onPlayNode={onPlayNode}
            />
          ),
        )}

        {/* Marquee selection rectangle */}
        {marqueeRect && marqueeRect.width > 2 && marqueeRect.height > 2 && (
          <div
            className="absolute border-2 border-primary/60 bg-primary/10 rounded-sm pointer-events-none"
            style={{
              left: marqueeRect.x,
              top: marqueeRect.y,
              width: marqueeRect.width,
              height: marqueeRect.height,
            }}
          />
        )}
      </div>

      {/* Minimap — bottom-right corner */}
      {state.nodes.length > 3 && (
        <Minimap
          nodes={state.nodes}
          viewport={state.viewport}
          canvasWidth={canvasDims.width}
          canvasHeight={canvasDims.height}
          onNavigate={(x, y) => {
            // Center viewport on the clicked point
            onViewportChange(
              canvasDims.width / 2 - x * state.viewport.zoom,
              canvasDims.height / 2 - y * state.viewport.zoom,
              state.viewport.zoom,
            );
          }}
        />
      )}

      {/* Virtualization stats (dev only) */}
      {state.nodes.length >= 50 && (
        <div className="absolute bottom-2 left-2 text-[9px] text-muted-foreground/40 pointer-events-none">
          {visibleNodes.length}/{state.nodes.length} nodes rendered
        </div>
      )}

      {/* Empty state hint */}
      {state.nodes.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center space-y-3 max-w-xs">
            <div className="flex items-center justify-center gap-3 text-muted-foreground/40">
              <BookOpen className="w-8 h-8" />
              <Sparkles className="w-8 h-8" />
            </div>
            <p className="text-sm text-muted-foreground/60 font-serif">
              Drag items from the dock to the canvas, or click to add
            </p>
          </div>
        </div>
      )}

    </div>
  );
}

// ── Minimap component ──

const NODE_TYPE_COLORS: Record<string, string> = {
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
};

function Minimap({
  nodes,
  viewport,
  canvasWidth,
  canvasHeight,
  onNavigate,
}: {
  nodes: FlowNode[];
  viewport: FlowViewport;
  canvasWidth: number;
  canvasHeight: number;
  onNavigate: (canvasX: number, canvasY: number) => void;
}) {
  const MINIMAP_W = 160;
  const MINIMAP_H = 100;
  const PAD = 20;

  // Compute bounds of all nodes
  const bounds = useMemo(() => {
    if (nodes.length === 0) return { minX: 0, minY: 0, maxX: 100, maxY: 100 };
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const n of nodes) {
      minX = Math.min(minX, n.x);
      minY = Math.min(minY, n.y);
      maxX = Math.max(maxX, n.x + n.width);
      maxY = Math.max(maxY, n.y + n.height);
    }
    // Add padding
    return { minX: minX - PAD, minY: minY - PAD, maxX: maxX + PAD, maxY: maxY + PAD };
  }, [nodes]);

  const worldW = bounds.maxX - bounds.minX || 1;
  const worldH = bounds.maxY - bounds.minY || 1;
  const scale = Math.min(MINIMAP_W / worldW, MINIMAP_H / worldH);

  // Visible viewport rect in minimap coords
  const visLeft = (-viewport.x / viewport.zoom - bounds.minX) * scale;
  const visTop = (-viewport.y / viewport.zoom - bounds.minY) * scale;
  const visW = (canvasWidth / viewport.zoom) * scale;
  const visH = (canvasHeight / viewport.zoom) * scale;

  const handleClick = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const canvasX = mx / scale + bounds.minX;
      const canvasY = my / scale + bounds.minY;
      onNavigate(canvasX, canvasY);
    },
    [scale, bounds, onNavigate],
  );

  return (
    <div
      className="absolute bottom-14 right-4 rounded-lg border border-border/40 bg-card/80 backdrop-blur-sm shadow-sm overflow-hidden"
      style={{ width: MINIMAP_W, height: MINIMAP_H }}
    >
      <svg
        width={MINIMAP_W}
        height={MINIMAP_H}
        className="cursor-pointer"
        onClick={handleClick}
      >
        {/* Node dots */}
        {nodes.map((n) => {
          const x = (n.x - bounds.minX) * scale;
          const y = (n.y - bounds.minY) * scale;
          const w = Math.max(n.width * scale, 2);
          const h = Math.max(n.height * scale, 2);
          const color = NODE_TYPE_COLORS[n.type] || "#888";
          return (
            <rect
              key={n.id}
              x={x}
              y={y}
              width={w}
              height={h}
              rx={1}
              fill={color}
              opacity={0.7}
            />
          );
        })}

        {/* Viewport indicator */}
        <rect
          x={Math.max(0, visLeft)}
          y={Math.max(0, visTop)}
          width={Math.min(visW, MINIMAP_W)}
          height={Math.min(visH, MINIMAP_H)}
          fill="none"
          stroke="hsl(var(--primary))"
          strokeWidth={1.5}
          rx={2}
          opacity={0.6}
        />
      </svg>
    </div>
  );
}
