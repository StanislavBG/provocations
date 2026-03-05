import { useState, useCallback, useRef, useEffect } from "react";
import type { FlowNode, FlowViewport } from "./useFlowCanvas";

const ZOOM_MIN = 0.1;
const ZOOM_MAX = 4;
const ZOOM_STEP = 1.1;

// ── WASD glide-camera constants (game-style smooth panning) ──
const WASD_ACCEL = 1.8;       // px/frame² acceleration while key held
const WASD_MAX_SPEED = 18;    // px/frame max velocity
const WASD_FRICTION = 0.88;   // velocity multiplier per frame when released
const WASD_STOP_THRESHOLD = 0.3; // velocity below this → snap to zero

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

interface MarqueeDrag {
  type: "marquee";
  /** Canvas-space start point */
  startCanvasX: number;
  startCanvasY: number;
  /** Canvas-space current point */
  currentCanvasX: number;
  currentCanvasY: number;
}

type DragState = PanDrag | MoveNodeDrag | DrawEdgeDrag | MarqueeDrag;

/** Preview edge data exposed to canvas for rendering */
export interface PreviewEdge {
  sourceNodeId: string;
  cursorX: number;
  cursorY: number;
}

/** Marquee rectangle in canvas coordinates */
export interface MarqueeRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface UseFlowInteractionProps {
  viewport: FlowViewport;
  onViewportChange: (x: number, y: number, zoom: number) => void;
  onNodeMove: (nodeId: string, x: number, y: number) => void;
  onNodesMove?: (nodeIds: string[], dx: number, dy: number) => void;
  onSelectNode: (nodeId: string | null) => void;
  onSelectNodes?: (nodeIds: string[]) => void;
  onToggleSelectNode: (nodeId: string) => void;
  onNodeDoubleClick: (nodeId: string) => void;
  onEdgeCreate?: (fromNodeId: string, toNodeId: string) => void;
  onDragStart?: () => void;
  nodes: FlowNode[];
  /** Customizable glide camera keys (default: WASD) */
  glideKeys?: { up: string; down: string; left: string; right: string };
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
  onSelectNodes,
  onToggleSelectNode,
  onNodeDoubleClick,
  onEdgeCreate,
  onDragStart,
  nodes,
  glideKeys,
}: UseFlowInteractionProps) {
  const [dragState, setDragState] = useState<DragState | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const spaceHeld = useRef(false);

  // Track Space key for pan-while-space-held
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code === "Space" && !(e.target as HTMLElement)?.closest("input, textarea, [contenteditable]")) {
        spaceHeld.current = true;
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === "Space") spaceHeld.current = false;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  // ── Glide-camera (game-style smooth panning, customizable keys) ──
  const glideKeysActive = useRef<Set<string>>(new Set());
  const glideVel = useRef({ x: 0, y: 0 });
  const glideRaf = useRef<number>(0);
  const viewportRef = useRef(viewport);
  viewportRef.current = viewport;
  const onViewportChangeRef = useRef(onViewportChange);
  onViewportChangeRef.current = onViewportChange;
  const glideKeysRef = useRef(glideKeys);
  glideKeysRef.current = glideKeys;

  useEffect(() => {
    const isInput = (e: KeyboardEvent) =>
      !!(e.target as HTMLElement)?.closest("input, textarea, [contenteditable]");

    const getGK = () => glideKeysRef.current ?? { up: "w", down: "s", left: "a", right: "d" };

    const down = (e: KeyboardEvent) => {
      if (isInput(e)) return;
      const k = e.key.toLowerCase();
      const gk = getGK();
      if (k === gk.up || k === gk.down || k === gk.left || k === gk.right) {
        e.preventDefault();
        glideKeysActive.current.add(k);
      }
    };
    const up = (e: KeyboardEvent) => {
      glideKeysActive.current.delete(e.key.toLowerCase());
    };
    const blur = () => glideKeysActive.current.clear();

    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);

    let lastTime = 0;
    const tick = (time: number) => {
      glideRaf.current = requestAnimationFrame(tick);

      const dt = lastTime ? Math.min((time - lastTime) / 16.67, 3) : 1;
      lastTime = time;

      const keys = glideKeysActive.current;
      const vel = glideVel.current;
      const gk = getGK();

      let ax = 0, ay = 0;
      if (keys.has(gk.left)) ax += 1;
      if (keys.has(gk.right)) ax -= 1;
      if (keys.has(gk.up)) ay += 1;
      if (keys.has(gk.down)) ay -= 1;

      if (ax !== 0 || ay !== 0) {
        const len = Math.sqrt(ax * ax + ay * ay);
        ax = (ax / len) * WASD_ACCEL * dt;
        ay = (ay / len) * WASD_ACCEL * dt;
        vel.x = Math.max(-WASD_MAX_SPEED, Math.min(WASD_MAX_SPEED, vel.x + ax));
        vel.y = Math.max(-WASD_MAX_SPEED, Math.min(WASD_MAX_SPEED, vel.y + ay));
      } else {
        vel.x *= Math.pow(WASD_FRICTION, dt);
        vel.y *= Math.pow(WASD_FRICTION, dt);
        if (Math.abs(vel.x) < WASD_STOP_THRESHOLD) vel.x = 0;
        if (Math.abs(vel.y) < WASD_STOP_THRESHOLD) vel.y = 0;
      }

      if (vel.x !== 0 || vel.y !== 0) {
        const vp = viewportRef.current;
        onViewportChangeRef.current(
          vp.x + vel.x * dt,
          vp.y + vel.y * dt,
          vp.zoom,
        );
      }
    };

    glideRaf.current = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(glideRaf.current);
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
  }, []); // stable — uses refs for all mutable state

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

  // Click on canvas background → pan (or marquee with Shift)
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      // Middle mouse, Space+left, or plain left on background → pan
      if (e.button === 1 || (e.button === 0 && (spaceHeld.current || !e.shiftKey))) {
        e.preventDefault();
        setDragState({
          type: "pan",
          startX: e.clientX - viewport.x,
          startY: e.clientY - viewport.y,
        });
        if (e.button === 0 && !e.shiftKey) {
          onSelectNode(null); // clear selection on plain click
        }
        return;
      }
      if (e.button !== 0) return;

      // Shift + left click on background → start marquee selection
      const pos = screenToCanvas(e.clientX, e.clientY);
      setDragState({
        type: "marquee",
        startCanvasX: pos.x,
        startCanvasY: pos.y,
        currentCanvasX: pos.x,
        currentCanvasY: pos.y,
      });
    },
    [viewport, screenToCanvas, onSelectNode],
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

      if (dragState.type === "marquee") {
        const pos = screenToCanvas(e.clientX, e.clientY);
        setDragState((prev) => {
          if (!prev || prev.type !== "marquee") return prev;
          return { ...prev, currentCanvasX: pos.x, currentCanvasY: pos.y };
        });
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
      if (dragState?.type === "marquee" && onSelectNodes) {
        // Select all nodes whose bounds overlap the marquee rectangle
        const { startCanvasX, startCanvasY, currentCanvasX, currentCanvasY } = dragState;
        const left = Math.min(startCanvasX, currentCanvasX);
        const top = Math.min(startCanvasY, currentCanvasY);
        const right = Math.max(startCanvasX, currentCanvasX);
        const bottom = Math.max(startCanvasY, currentCanvasY);
        // Only select if the marquee has some size (> 5px to avoid accidental clicks)
        const w = right - left;
        const h = bottom - top;
        if (w > 5 || h > 5) {
          const selected = nodes.filter((n) => {
            const nx = n.x;
            const ny = n.y;
            const nr = n.x + n.width;
            const nb = n.y + n.height;
            return nx < right && nr > left && ny < bottom && nb > top;
          });
          onSelectNodes(selected.map((n) => n.id));
        }
      }

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
    [dragState, nodes, screenToCanvas, onEdgeCreate, onSelectNodes],
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

      // Locked nodes cannot be dragged
      if (node.locked) return;

      // Push undo snapshot before starting drag
      onDragStart?.();

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

  // Build marquee rect for rendering
  const marqueeRect: MarqueeRect | null =
    dragState?.type === "marquee"
      ? {
          x: Math.min(dragState.startCanvasX, dragState.currentCanvasX),
          y: Math.min(dragState.startCanvasY, dragState.currentCanvasY),
          width: Math.abs(dragState.currentCanvasX - dragState.startCanvasX),
          height: Math.abs(dragState.currentCanvasY - dragState.startCanvasY),
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
    isPanning: dragState?.type === "pan",
    isDrawingEdge: dragState?.type === "draw-edge",
    isMarquee: dragState?.type === "marquee",
    previewEdge,
    marqueeRect,
  };
}
