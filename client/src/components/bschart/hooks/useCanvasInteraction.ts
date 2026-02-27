import { useState, useCallback, useRef, useEffect } from "react";
import type { BSToolMode, BSPortSide, BSNode } from "../types";

interface UseCanvasInteractionProps {
  viewport: { x: number; y: number; zoom: number };
  onViewportChange: (x: number, y: number, zoom: number) => void;
  onNodeMove: (nodeId: string, x: number, y: number) => void;
  onNodeMoveEnd?: () => void;
  onSelectNode: (nodeIds: string[], additive?: boolean) => void;
  onSelectConnector: (connectorIds: string[], additive?: boolean) => void;
  onClearSelection: () => void;
  onAddNode: (type: Exclude<BSToolMode, "select" | "pan" | "connect">, x: number, y: number) => void;
  onStartConnect: (nodeId: string, port: BSPortSide) => void;
  onEndConnect: (nodeId: string, port: BSPortSide) => void;
  nodes: BSNode[];
  toolMode: BSToolMode;
}

interface DragState {
  type: "pan" | "move-node" | "marquee" | "connect";
  startX: number;
  startY: number;
  nodeId?: string;
  offsetX?: number;
  offsetY?: number;
  fromNodeId?: string;
  fromPort?: BSPortSide;
}

export function useCanvasInteraction({
  viewport,
  onViewportChange,
  onNodeMove,
  onNodeMoveEnd,
  onSelectNode,
  onSelectConnector,
  onClearSelection,
  onAddNode,
  onStartConnect,
  onEndConnect,
  nodes,
  toolMode,
}: UseCanvasInteractionProps) {
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [connectPreview, setConnectPreview] = useState<{
    fromX: number;
    fromY: number;
    toX: number;
    toY: number;
  } | null>(null);
  const [marquee, setMarquee] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);

  const canvasRef = useRef<HTMLDivElement>(null);

  // Convert screen coordinates to canvas coordinates
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

  // ── Mouse wheel → zoom ──
  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;

      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
      const newZoom = Math.max(0.1, Math.min(4, viewport.zoom * zoomFactor));

      // Zoom toward mouse position
      const newX = mouseX - (mouseX - viewport.x) * (newZoom / viewport.zoom);
      const newY = mouseY - (mouseY - viewport.y) * (newZoom / viewport.zoom);

      onViewportChange(newX, newY, newZoom);
    },
    [viewport, onViewportChange],
  );

  // ── Mouse down ──
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button === 1 || (e.button === 0 && toolMode === "pan")) {
        // Middle button or pan tool → pan
        setDragState({
          type: "pan",
          startX: e.clientX - viewport.x,
          startY: e.clientY - viewport.y,
        });
        return;
      }

      if (e.button === 0 && toolMode === "select") {
        // Left click on canvas background → marquee selection or deselect
        const canvas = screenToCanvas(e.clientX, e.clientY);
        setDragState({
          type: "marquee",
          startX: canvas.x,
          startY: canvas.y,
        });
        if (!e.shiftKey) {
          onClearSelection();
        }
        return;
      }

      if (e.button === 0 && toolMode !== "select" && toolMode !== "pan" && toolMode !== "connect") {
        // Shape tool → place node
        const pos = screenToCanvas(e.clientX, e.clientY);
        onAddNode(toolMode, pos.x, pos.y);
      }
    },
    [toolMode, viewport, screenToCanvas, onClearSelection, onAddNode],
  );

  // ── Mouse move ──
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
        return;
      }

      if (dragState.type === "marquee") {
        const pos = screenToCanvas(e.clientX, e.clientY);
        const x = Math.min(dragState.startX, pos.x);
        const y = Math.min(dragState.startY, pos.y);
        const width = Math.abs(pos.x - dragState.startX);
        const height = Math.abs(pos.y - dragState.startY);
        setMarquee({ x, y, width, height });
        return;
      }

      if (dragState.type === "connect") {
        const pos = screenToCanvas(e.clientX, e.clientY);
        setConnectPreview((prev) =>
          prev ? { ...prev, toX: pos.x, toY: pos.y } : null,
        );
      }
    },
    [dragState, viewport.zoom, screenToCanvas, onViewportChange, onNodeMove],
  );

  // ── Mouse up ──
  const handleMouseUp = useCallback(
    (e: React.MouseEvent) => {
      if (dragState?.type === "move-node") {
        onNodeMoveEnd?.();
      }

      if (dragState?.type === "marquee" && marquee) {
        // Select all nodes inside marquee
        const selected = nodes.filter(
          (n) =>
            n.x + n.width > marquee.x &&
            n.x < marquee.x + marquee.width &&
            n.y + n.height > marquee.y &&
            n.y < marquee.y + marquee.height,
        );
        if (selected.length > 0) {
          onSelectNode(
            selected.map((n) => n.id),
            e.shiftKey,
          );
        }
        setMarquee(null);
      }

      if (dragState?.type === "connect") {
        setConnectPreview(null);
      }

      setDragState(null);
    },
    [dragState, marquee, nodes, onSelectNode, onNodeMoveEnd],
  );

  // ── Node-specific handlers (called from node components) ──

  const handleNodeMouseDown = useCallback(
    (e: React.MouseEvent, nodeId: string) => {
      e.stopPropagation();

      if (toolMode === "connect") {
        // Start connecting
        const node = nodes.find((n) => n.id === nodeId);
        if (!node) return;
        const pos = screenToCanvas(e.clientX, e.clientY);
        const port = getNearestPort(node, pos.x, pos.y);
        onStartConnect(nodeId, port);
        const portPos = getPortScreenPos(node, port);
        setConnectPreview({
          fromX: portPos.x,
          fromY: portPos.y,
          toX: pos.x,
          toY: pos.y,
        });
        setDragState({
          type: "connect",
          startX: portPos.x,
          startY: portPos.y,
          fromNodeId: nodeId,
          fromPort: port,
        });
        return;
      }

      // Select + start drag
      if (!e.shiftKey) {
        onSelectNode([nodeId]);
      } else {
        onSelectNode([nodeId], true);
      }

      const node = nodes.find((n) => n.id === nodeId);
      if (!node || node.locked) return;

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
    [toolMode, nodes, screenToCanvas, onSelectNode, onStartConnect],
  );

  const handleNodeMouseUp = useCallback(
    (e: React.MouseEvent, nodeId: string) => {
      if (dragState?.type === "connect" && dragState.fromNodeId && dragState.fromPort) {
        const node = nodes.find((n) => n.id === nodeId);
        if (node && nodeId !== dragState.fromNodeId) {
          const pos = screenToCanvas(e.clientX, e.clientY);
          const port = getNearestPort(node, pos.x, pos.y);
          onEndConnect(nodeId, port);
        }
        setConnectPreview(null);
        setDragState(null);
      }
    },
    [dragState, nodes, screenToCanvas, onEndConnect],
  );

  return {
    canvasRef,
    handleWheel,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleNodeMouseDown,
    handleNodeMouseUp,
    connectPreview,
    marquee,
    screenToCanvas,
    isDragging: !!dragState,
    dragType: dragState?.type ?? null,
  };
}

// ── Helpers ──

function getNearestPort(node: BSNode, x: number, y: number): BSPortSide {
  const cx = node.x + node.width / 2;
  const cy = node.y + node.height / 2;
  const dx = x - cx;
  const dy = y - cy;

  // Use angle to determine closest side
  const angle = Math.atan2(dy, dx);
  const deg = (angle * 180) / Math.PI;

  if (deg > -45 && deg <= 45) return "right";
  if (deg > 45 && deg <= 135) return "bottom";
  if (deg > -135 && deg <= -45) return "top";
  return "left";
}

function getPortScreenPos(node: BSNode, port: BSPortSide): { x: number; y: number } {
  switch (port) {
    case "top": return { x: node.x + node.width / 2, y: node.y };
    case "bottom": return { x: node.x + node.width / 2, y: node.y + node.height };
    case "left": return { x: node.x, y: node.y + node.height / 2 };
    case "right": return { x: node.x + node.width, y: node.y + node.height / 2 };
  }
}
