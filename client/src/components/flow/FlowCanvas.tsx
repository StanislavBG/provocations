import { useCallback, useMemo, useRef, useState, useEffect } from "react";
import { BookOpen, Sparkles, AlignStartVertical, AlignEndVertical, AlignCenterVertical, AlignStartHorizontal, AlignEndHorizontal, AlignCenterHorizontal, GripHorizontal, GripVertical, Monitor } from "lucide-react";
import type { FlowCanvasState, FlowNode, FlowEdge, FlowViewport } from "./useFlowCanvas";
import { getEffectiveLockMode } from "./useFlowCanvas";
import { FlowNodeContainer } from "./FlowNodeContainer";
import { FlowNodeRenderer } from "./FlowNodeRenderer";
import { FlowStoreNode } from "./FlowStoreNode";
import { FlowLlmNode } from "./FlowLlmNode";
import { FlowDocumentNode } from "./FlowDocumentNode";
import { FlowZoneNode } from "./FlowZoneNode";
import { FlowLabelNode } from "./FlowLabelNode";
import { FlowResearchNode } from "./FlowResearchNode";
import { FlowAudioNode } from "./FlowAudioNode";
import { FlowYoutubeNode } from "./FlowYoutubeNode";
import { FlowTimerEventNode } from "./FlowTimerEventNode";
import { FlowEdgeLayer } from "./FlowEdgeLayer";
import { useFlowInteraction } from "./useFlowInteraction";
import { FlowMinimap } from "./FlowMinimap";
import type { useMinimapState } from "./useMinimapState";

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
  onUpdateNode: (nodeId: string, patch: Partial<FlowNode>) => void;
  onCreateNote: (content: string, label: string, sourceNodeId?: string) => void;
  onCreateEdge?: (fromNodeId: string, toNodeId: string) => void;
  onDeleteEdge?: (edgeId: string) => void;
  onPlayNode?: (nodeId: string) => void;
  onToggleLock?: (nodeId: string) => void;
  onDropTool?: (toolId: string, canvasX: number, canvasY: number) => void;
  onDragStart?: () => void;
  transparentBg?: boolean;
  minimapState?: ReturnType<typeof useMinimapState>;
  onFitToView?: () => void;
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
  onUpdateNode,
  onCreateNote,
  onCreateEdge,
  onDeleteEdge,
  onPlayNode,
  onToggleLock,
  onDropTool,
  onDragStart,
  transparentBg,
  minimapState,
  onFitToView,
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
  // Screen-locked nodes are never culled
  const visibleNodes = useMemo(() => {
    if (state.nodes.length < 30) return sortedNodes;
    return sortedNodes.filter((node) =>
      getEffectiveLockMode(node) === "screen" ||
      isNodeVisible(node, state.viewport, canvasDims.width, canvasDims.height),
    );
  }, [sortedNodes, state.viewport, canvasDims, state.nodes.length]);

  // Partition nodes into canvas-space and screen-space groups
  const { canvasNodes, screenNodes } = useMemo(() => {
    const canvas: FlowNode[] = [];
    const screen: FlowNode[] = [];
    for (const node of visibleNodes) {
      if (getEffectiveLockMode(node) === "screen") {
        screen.push(node);
      } else {
        canvas.push(node);
      }
    }
    return { canvasNodes: canvas, screenNodes: screen };
  }, [visibleNodes]);

  // Also cull edges: only render edges where at least one endpoint is visible
  const visibleEdges = useMemo(() => {
    if (state.nodes.length < 30) return state.edges;
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

  // ── Render a single node by type ──
  // Zone = special renderer, specialized nodes = dedicated components,
  // generic types (context-doc, research, painter, interview, timeline,
  // filter, gate, router, merge, label) = FlowNodeContainer with default snippet body.
  const renderNode = useCallback((node: FlowNode) => {
    const sel = state.selectedNodeIds.has(node.id);

    // Zone: background group — no card chrome
    if (node.type === "zone") return (
      <FlowZoneNode key={node.id} node={node} isSelected={sel} zoom={state.viewport.zoom} onMouseDown={handleNodeMouseDown} onDelete={onDeleteNode} onUpdateNode={onUpdateNode} />
    );

    // Specialized nodes with complex interactive bodies (keep dedicated components)
    if (node.type === "llm") return (
      <FlowLlmNode key={node.id} node={node} isSelected={sel} allNodes={state.nodes} selectedNodeIds={state.selectedNodeIds} onMouseDown={handleNodeMouseDown} onDelete={onDeleteNode} onUpdateNode={onUpdateNode} onToggleLock={onToggleLock} onCreateNote={onCreateNote} onPortMouseDown={handlePortMouseDown} />
    );
    if (node.type === "research") return (
      <FlowResearchNode key={node.id} node={node} edges={state.edges} isSelected={sel} onMouseDown={handleNodeMouseDown} onDoubleClick={handleNodeDoubleClick} onDelete={onDeleteNode} onUpdateNode={onUpdateNode} onToggleLock={onToggleLock} onPortMouseDown={handlePortMouseDown} onPlayNode={onPlayNode} />
    );
    if (node.type === "audio") return (
      <FlowAudioNode key={node.id} node={node} isSelected={sel} onMouseDown={handleNodeMouseDown} onDelete={onDeleteNode} onUpdateNode={onUpdateNode} onToggleLock={onToggleLock} onPortMouseDown={handlePortMouseDown} />
    );
    if (node.type === "youtube") return (
      <FlowYoutubeNode key={node.id} node={node} isSelected={sel} onMouseDown={handleNodeMouseDown} onDelete={onDeleteNode} onUpdateNode={onUpdateNode} onToggleLock={onToggleLock} onPortMouseDown={handlePortMouseDown} />
    );
    if (node.type === "timer-event") return (
      <FlowTimerEventNode key={node.id} node={node} isSelected={sel} onMouseDown={handleNodeMouseDown} onDelete={onDeleteNode} onUpdateNode={onUpdateNode} onToggleLock={onToggleLock} onPortMouseDown={handlePortMouseDown} />
    );
    if (node.type === "store") return (
      <FlowStoreNode key={node.id} node={node} isSelected={sel} onMouseDown={handleNodeMouseDown} onDoubleClick={handleNodeDoubleClick} onDelete={onDeleteNode} onToggleLock={onToggleLock} onPortMouseDown={handlePortMouseDown} />
    );
    if (node.type === "document") return (
      <FlowDocumentNode key={node.id} node={node} isSelected={sel} onMouseDown={handleNodeMouseDown} onDoubleClick={handleNodeDoubleClick} onDelete={onDeleteNode} onPortMouseDown={handlePortMouseDown} />
    );
    if (node.type === "label") return (
      <FlowLabelNode key={node.id} node={node} isSelected={sel} zoom={state.viewport.zoom} onMouseDown={handleNodeMouseDown} onDoubleClick={handleNodeDoubleClick} onDelete={onDeleteNode} onUpdateNode={onUpdateNode} onToggleLock={onToggleLock} />
    );

    // All other types: unified FlowNodeContainer with default snippet body
    return (
      <FlowNodeContainer
        key={node.id}
        node={node}
        isSelected={sel}
        onMouseDown={handleNodeMouseDown}
        onDoubleClick={handleNodeDoubleClick}
        onDelete={onDeleteNode}
        onToggleLock={onToggleLock}
        onPortMouseDown={handlePortMouseDown}
        onPlayNode={onPlayNode}
      />
    );
  }, [state.selectedNodeIds, state.viewport.zoom, state.nodes, state.edges, handleNodeMouseDown, handleNodeDoubleClick, handlePortMouseDown, onDeleteNode, onUpdateNode, onToggleLock, onPlayNode, onCreateNote]);

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
      className={`absolute inset-0 overflow-hidden ${transparentBg ? "bg-transparent" : "bg-background"} ${cursorClass}`}
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

        {canvasNodes.map((node) => renderNode(node))}

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

      {/* Screen-locked HUD layer — outside viewport transform */}
      {screenNodes.length > 0 && (
        <div className="absolute inset-0 pointer-events-none z-20">
          {screenNodes.map((node) => (
            <div
              key={`screen-${node.id}`}
              className="pointer-events-auto absolute"
              style={{
                left: node.screenX ?? 100,
                top: node.screenY ?? 100,
                zIndex: node.zIndex + 1000,
                filter: "drop-shadow(0 0 6px rgba(59, 130, 246, 0.25))",
              }}
            >
              {/* HUD badge */}
              <div className="absolute -top-2 -left-2 w-5 h-5 rounded-full bg-blue-500/90 text-white flex items-center justify-center shadow-sm z-50">
                <Monitor className="w-2.5 h-2.5" />
              </div>
              {renderNode({ ...node, x: 0, y: 0 })}
            </div>
          ))}
        </div>
      )}

      {/* Align/Distribute toolbar for multi-selection */}
      {state.selectedNodeIds.size >= 2 && (() => {
        const sel = state.nodes.filter((n) => state.selectedNodeIds.has(n.id));
        if (sel.length < 2) return null;
        // Compute bounding box center in screen coords
        const minX = Math.min(...sel.map((n) => n.x));
        const minY = Math.min(...sel.map((n) => n.y));
        const maxX = Math.max(...sel.map((n) => n.x + n.width));
        const screenCX = (minX + maxX) / 2 * state.viewport.zoom + state.viewport.x;
        const screenTop = minY * state.viewport.zoom + state.viewport.y - 44;

        const alignLeft = () => { sel.forEach((n) => onMoveNode(n.id, minX, n.y)); };
        const alignRight = () => { sel.forEach((n) => onMoveNode(n.id, maxX - n.width, n.y)); };
        const alignCenterH = () => { const cx = (minX + maxX) / 2; sel.forEach((n) => onMoveNode(n.id, cx - n.width / 2, n.y)); };
        const alignTop = () => { sel.forEach((n) => onMoveNode(n.id, n.x, minY)); };
        const alignBottom = () => { const maxY = Math.max(...sel.map((n) => n.y + n.height)); sel.forEach((n) => onMoveNode(n.id, n.x, maxY - n.height)); };
        const alignCenterV = () => { const maxY = Math.max(...sel.map((n) => n.y + n.height)); const cy = (minY + maxY) / 2; sel.forEach((n) => onMoveNode(n.id, n.x, cy - n.height / 2)); };
        const distributeH = () => {
          if (sel.length < 3) return;
          const sorted = [...sel].sort((a, b) => a.x - b.x);
          const totalW = sorted.reduce((s, n) => s + n.width, 0);
          const gap = (maxX - minX - totalW) / (sorted.length - 1);
          let cx = minX;
          sorted.forEach((n) => { onMoveNode(n.id, cx, n.y); cx += n.width + gap; });
        };
        const distributeV = () => {
          if (sel.length < 3) return;
          const maxY = Math.max(...sel.map((n) => n.y + n.height));
          const sorted = [...sel].sort((a, b) => a.y - b.y);
          const totalH = sorted.reduce((s, n) => s + n.height, 0);
          const gap = (maxY - minY - totalH) / (sorted.length - 1);
          let cy = minY;
          sorted.forEach((n) => { onMoveNode(n.id, n.x, cy); cy += n.height + gap; });
        };

        const btnCls = "w-7 h-7 flex items-center justify-center rounded hover:bg-primary/15 text-muted-foreground hover:text-foreground transition-colors";
        return (
          <div
            className="absolute z-30 flex items-center gap-0.5 px-1.5 py-0.5 rounded-lg bg-card/95 backdrop-blur-sm border border-border/50 shadow-lg"
            style={{ left: screenCX, top: Math.max(4, screenTop), transform: "translateX(-50%)" }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <button className={btnCls} onClick={alignLeft} title="Align left"><AlignStartVertical className="w-3.5 h-3.5" /></button>
            <button className={btnCls} onClick={alignCenterH} title="Align center H"><AlignCenterVertical className="w-3.5 h-3.5" /></button>
            <button className={btnCls} onClick={alignRight} title="Align right"><AlignEndVertical className="w-3.5 h-3.5" /></button>
            <div className="w-px h-4 bg-border/50 mx-0.5" />
            <button className={btnCls} onClick={alignTop} title="Align top"><AlignStartHorizontal className="w-3.5 h-3.5" /></button>
            <button className={btnCls} onClick={alignCenterV} title="Align center V"><AlignCenterHorizontal className="w-3.5 h-3.5" /></button>
            <button className={btnCls} onClick={alignBottom} title="Align bottom"><AlignEndHorizontal className="w-3.5 h-3.5" /></button>
            {sel.length >= 3 && (
              <>
                <div className="w-px h-4 bg-border/50 mx-0.5" />
                <button className={btnCls} onClick={distributeH} title="Distribute H"><GripHorizontal className="w-3.5 h-3.5" /></button>
                <button className={btnCls} onClick={distributeV} title="Distribute V"><GripVertical className="w-3.5 h-3.5" /></button>
              </>
            )}
          </div>
        );
      })()}

      {/* Factorio-inspired minimap */}
      {minimapState && (
        <FlowMinimap
          nodes={state.nodes}
          edges={state.edges}
          viewport={state.viewport}
          selectedNodeIds={state.selectedNodeIds}
          canvasWidth={canvasDims.width}
          canvasHeight={canvasDims.height}
          onViewportChange={onViewportChange}
          onFitToView={onFitToView}
          minimapState={minimapState}
        />
      )}

      {/* Virtualization stats (dev only) */}
      {state.nodes.length >= 30 && (
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

