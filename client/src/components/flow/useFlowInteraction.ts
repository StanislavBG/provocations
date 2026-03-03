import { useState, useCallback, useRef } from "react";
import type { FlowNode, FlowViewport } from "./useFlowCanvas";

const ZOOM_MIN = 0.1;
const ZOOM_MAX = 4;
const ZOOM_STEP = 1.1;

interface PanDrag {
  type: "pan";
  startX: number;
  startY: number;
}

interface MoveNodeDrag {
  type: "move-node";
  startX: number;
  startY: number;
  nodeId: string;
  offsetX: number;
  offsetY: number;
  /** Extra node IDs dragged together (zone children) */
  groupIds?: string[];
  /** Last canvas position for computing delta in group drag */
  lastCanvasX?: number;
  lastCanvasY?: number;
}

interface DrawEdgeDrag {
  type: "draw-edge";
  sourceNodeId: string;
  sourcePortType: "input" | "output";
  /** Current cursor position in canvas coords */
  cursorX: number;
  cursorY: number;
}

type DragState = PanDrag | MoveNodeDrag | DrawEdgeDrag;

/** Preview edge data exposed to canvas for rendering */
export interface PreviewEdge {
  sourceNodeId: string;
  cursorX: number;
  cursorY: number;
}

interface UseFlowInteractionProps {
  viewport: FlowViewport;
  onViewportChange: (x: number, y: number, zoom: number) => void;
  onNodeMove: (nodeId: string, x: number, y: number) => void;
  onNodesMove?: (nodeIds: string[], dx: number, dy: number) => void;
  onSelectNode: (nodeId: string | null) => void;
  onToggleSelectNode: (nodeId: string) => void;
  onNodeDoubleClick: (nodeId: string) => void;
  onEdgeCreate?: (fromNodeId: string, toNodeId: string) => void;
  nodes: FlowNode[];
}

/** Check if a node's center is inside a zone's bounds */
function isNodeInsideZone(node: FlowNode, zone: FlowNode): boolean {
  const cx = node.x + node.width / 2;
  const cy = node.y + node.height / 2;
  return (
    cx >= zone.x &&
    cx <= zone.x + zone.width &&
    cy >= zone.y &&
    cy <= zone.y + zone.height
  );
}

export function useFlowInteraction({
  viewport,
  onViewportChange,
  onNodeMove,
  onNodesMove,
  onSelectNode,
  onToggleSelectNode,
  onNodeDoubleClick,
  onEdgeCreate,
  nodes,
}: UseFlowInteractionProps) {
  const [dragState, setDragState] = useState<DragState | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  const screenToCanvas = useCallback(
    (screenX: number, screenY: number) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return { x: 0, y: 0 };
      return {
        x: (screenX - rect.left - viewport.x) / viewport.zoom,
        y: (screenY - rect.top - viewport.y) / viewport.zoom,
      };
    },
    [viewport],
  );

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;

      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const zoomFactor = e.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP;
      const newZoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, viewport.zoom * zoomFactor));

      const newX = mouseX - (mouseX - viewport.x) * (newZoom / viewport.zoom);
      const newY = mouseY - (mouseY - viewport.y) * (newZoom / viewport.zoom);

      onViewportChange(newX, newY, newZoom);
    },
    [viewport, onViewportChange],
  );

  // Click on canvas background → start pan
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return;
      onSelectNode(null);
      setDragState({
        type: "pan",
        startX: e.clientX - viewport.x,
        startY: e.clientY - viewport.y,
      });
    },
    [viewport, onSelectNode],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!dragState) return;

      if (dragState.type === "pan") {
        onViewportChange(
          e.clientX - dragState.startX,
          e.clientY - dragState.startY,
          viewport.zoom,
        );
        return;
      }

      if (dragState.type === "move-node") {
        const pos = screenToCanvas(e.clientX, e.clientY);
        const newX = pos.x - dragState.offsetX;
        const newY = pos.y - dragState.offsetY;
        onNodeMove(dragState.nodeId, newX, newY);

        // Move group children (zone drag)
        if (dragState.groupIds && dragState.groupIds.length > 0 && onNodesMove) {
          const dx = pos.x - (dragState.lastCanvasX ?? dragState.startX);
          const dy = pos.y - (dragState.lastCanvasY ?? dragState.startY);
          if (dx !== 0 || dy !== 0) {
            onNodesMove(dragState.groupIds, dx, dy);
          }
        }

        // Update last position for next delta
        setDragState((prev) => {
          if (!prev || prev.type !== "move-node") return prev;
          return { ...prev, lastCanvasX: pos.x, lastCanvasY: pos.y };
        });
        return;
      }

      if (dragState.type === "draw-edge") {
        const pos = screenToCanvas(e.clientX, e.clientY);
        setDragState((prev) => {
          if (!prev || prev.type !== "draw-edge") return prev;
          return { ...prev, cursorX: pos.x, cursorY: pos.y };
        });
      }
    },
    [dragState, viewport.zoom, screenToCanvas, onViewportChange, onNodeMove, onNodesMove],
  );

  const handleMouseUp = useCallback(
    (e: React.MouseEvent) => {
      if (dragState?.type === "draw-edge" && onEdgeCreate) {
        // Find target node under cursor
        const pos = screenToCanvas(e.clientX, e.clientY);
        const target = nodes.find((n) => {
          if (n.id === dragState.sourceNodeId) return false;
          return (
            pos.x >= n.x &&
            pos.x <= n.x + n.width &&
            pos.y >= n.y &&
            pos.y <= n.y + n.height
          );
        });
        if (target) {
          onEdgeCreate(dragState.sourceNodeId, target.id);
        }
      }
      setDragState(null);
    },
    [dragState, nodes, screenToCanvas, onEdgeCreate],
  );

  // Called from node components
  const handleNodeMouseDown = useCallback(
    (e: React.MouseEvent, nodeId: string) => {
      e.stopPropagation();

      if (e.shiftKey) {
        onToggleSelectNode(nodeId);
      } else {
        onSelectNode(nodeId);
      }

      const node = nodes.find((n) => n.id === nodeId);
      if (!node) return;

      const pos = screenToCanvas(e.clientX, e.clientY);

      // If dragging a zone, find contained nodes to move together
      let groupIds: string[] | undefined;
      if (node.type === "zone") {
        groupIds = nodes
          .filter((n) => n.id !== nodeId && n.type !== "zone" && isNodeInsideZone(n, node))
          .map((n) => n.id);
      }

      setDragState({
        type: "move-node",
        startX: pos.x,
        startY: pos.y,
        nodeId,
        offsetX: pos.x - node.x,
        offsetY: pos.y - node.y,
        groupIds: groupIds && groupIds.length > 0 ? groupIds : undefined,
        lastCanvasX: pos.x,
        lastCanvasY: pos.y,
      });
    },
    [nodes, screenToCanvas, onSelectNode, onToggleSelectNode],
  );

  const handleNodeDoubleClick = useCallback(
    (e: React.MouseEvent, nodeId: string) => {
      e.stopPropagation();
      onNodeDoubleClick(nodeId);
    },
    [onNodeDoubleClick],
  );

  /** Start drawing an edge from a port */
  const handlePortMouseDown = useCallback(
    (e: React.MouseEvent, nodeId: string, portType: "input" | "output") => {
      e.stopPropagation();
      const pos = screenToCanvas(e.clientX, e.clientY);
      setDragState({
        type: "draw-edge",
        sourceNodeId: nodeId,
        sourcePortType: portType,
        cursorX: pos.x,
        cursorY: pos.y,
      });
    },
    [screenToCanvas],
  );

  // Build preview edge for rendering
  const previewEdge: PreviewEdge | null =
    dragState?.type === "draw-edge"
      ? {
          sourceNodeId: dragState.sourceNodeId,
          cursorX: dragState.cursorX,
          cursorY: dragState.cursorY,
        }
      : null;

  return {
    canvasRef,
    handleWheel,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleNodeMouseDown,
    handleNodeDoubleClick,
    handlePortMouseDown,
    screenToCanvas,
    isDragging: !!dragState,
    isDrawingEdge: dragState?.type === "draw-edge",
    previewEdge,
  };
}
