import { useMemo } from "react";
import { BookOpen, Sparkles } from "lucide-react";
import type { FlowCanvasState } from "./useFlowCanvas";
import { FlowNodeRenderer } from "./FlowNodeRenderer";
import { FlowStoreNode } from "./FlowStoreNode";
import { useFlowInteraction } from "./useFlowInteraction";

interface FlowCanvasProps {
  state: FlowCanvasState;
  onMoveNode: (nodeId: string, x: number, y: number) => void;
  onDeleteNode: (nodeId: string) => void;
  onSelectNode: (nodeId: string | null) => void;
  onToggleSelectNode: (nodeId: string) => void;
  onNodeDoubleClick: (nodeId: string) => void;
  onViewportChange: (x: number, y: number, zoom: number) => void;
  onPickDocument: (doc: { id: number; title: string; content: string }) => void;
}

const GRID_SIZE = 20;

export function FlowCanvas({
  state,
  onMoveNode,
  onDeleteNode,
  onSelectNode,
  onToggleSelectNode,
  onNodeDoubleClick,
  onViewportChange,
  onPickDocument,
}: FlowCanvasProps) {
  const {
    canvasRef,
    handleWheel,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleNodeMouseDown,
    handleNodeDoubleClick,
    isDragging,
  } = useFlowInteraction({
    viewport: state.viewport,
    onViewportChange,
    onNodeMove: onMoveNode,
    onSelectNode,
    onToggleSelectNode,
    onNodeDoubleClick,
    nodes: state.nodes,
  });

  const sortedNodes = useMemo(
    () => [...state.nodes].sort((a, b) => a.zIndex - b.zIndex),
    [state.nodes],
  );

  const gridSize = GRID_SIZE * state.viewport.zoom;

  return (
    <div
      ref={canvasRef}
      className={`absolute inset-0 overflow-hidden bg-background ${isDragging ? "cursor-grabbing" : "cursor-default"}`}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
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
        {sortedNodes.map((node) =>
          node.type === "store" ? (
            <FlowStoreNode
              key={node.id}
              node={node}
              isSelected={state.selectedNodeIds.has(node.id)}
              onMouseDown={handleNodeMouseDown}
              onDelete={onDeleteNode}
              onPickDocument={onPickDocument}
            />
          ) : (
            <FlowNodeRenderer
              key={node.id}
              node={node}
              isSelected={state.selectedNodeIds.has(node.id)}
              onMouseDown={handleNodeMouseDown}
              onDoubleClick={handleNodeDoubleClick}
              onDelete={onDeleteNode}
            />
          ),
        )}
      </div>

      {/* Empty state hint */}
      {state.nodes.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center space-y-3 max-w-xs">
            <div className="flex items-center justify-center gap-3 text-muted-foreground/40">
              <BookOpen className="w-8 h-8" />
              <Sparkles className="w-8 h-8" />
            </div>
            <p className="text-sm text-muted-foreground/60 font-serif">
              Click <strong>Research</strong> to start researching, or pick documents from{" "}
              <strong>Context Store</strong>
            </p>
          </div>
        </div>
      )}

      {/* Zoom indicator */}
      <div className="absolute bottom-3 right-3 bg-card/80 border rounded px-2 py-0.5 text-[10px] text-muted-foreground backdrop-blur-sm">
        {Math.round(state.viewport.zoom * 100)}%
      </div>
    </div>
  );
}
