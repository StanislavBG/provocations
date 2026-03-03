import { useState, useCallback, useRef } from "react";
import type { FlowNode, FlowViewport } from "./useFlowCanvas";

const ZOOM_MIN = 0.1;
const ZOOM_MAX = 4;
const ZOOM_STEP = 1.1;

interface DragState {
  type: "pan" | "move-node";
  startX: number;
  startY: number;
  nodeId?: string;
  offsetX?: number;
  offsetY?: number;
}

interface UseFlowInteractionProps {
  viewport: FlowViewport;
  onViewportChange: (x: number, y: number, zoom: number) => void;
  onNodeMove: (nodeId: string, x: number, y: number) => void;
  onSelectNode: (nodeId: string | null) => void;
  onToggleSelectNode: (nodeId: string) => void;
  onNodeDoubleClick: (nodeId: string) => void;
  nodes: FlowNode[];
}

export function useFlowInteraction({
  viewport,
  onViewportChange,
  onNodeMove,
  onSelectNode,
  onToggleSelectNode,
  onNodeDoubleClick,
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

      if (dragState.type === "move-node" && dragState.nodeId) {
        const pos = screenToCanvas(e.clientX, e.clientY);
        onNodeMove(
          dragState.nodeId,
          pos.x - (dragState.offsetX || 0),
          pos.y - (dragState.offsetY || 0),
        );
      }
    },
    [dragState, viewport.zoom, screenToCanvas, onViewportChange, onNodeMove],
  );

  const handleMouseUp = useCallback(() => {
    setDragState(null);
  }, []);

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
      setDragState({
        type: "move-node",
        startX: pos.x,
        startY: pos.y,
        nodeId,
        offsetX: pos.x - node.x,
        offsetY: pos.y - node.y,
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

  return {
    canvasRef,
    handleWheel,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleNodeMouseDown,
    handleNodeDoubleClick,
    screenToCanvas,
    isDragging: !!dragState,
  };
}
