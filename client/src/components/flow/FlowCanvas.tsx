import { useCallback, useMemo } from "react";
import { BookOpen, Sparkles } from "lucide-react";
import type { FlowCanvasState, FlowNode, FlowEdge } from "./useFlowCanvas";
import { FlowNodeRenderer } from "./FlowNodeRenderer";
import { FlowStoreNode } from "./FlowStoreNode";
import { FlowLlmNode } from "./FlowLlmNode";
import { FlowEdgeLayer } from "./FlowEdgeLayer";
import { useFlowInteraction } from "./useFlowInteraction";

interface FlowCanvasProps {
  state: FlowCanvasState;
  frozen?: boolean;
  onMoveNode: (nodeId: string, x: number, y: number) => void;
  onDeleteNode: (nodeId: string) => void;
  onSelectNode: (nodeId: string | null) => void;
  onToggleSelectNode: (nodeId: string) => void;
  onNodeDoubleClick: (nodeId: string) => void;
  onViewportChange: (x: number, y: number, zoom: number) => void;
  onPickDocument: (doc: { id: number; title: string; content: string }) => void;
  onUpdateNode: (nodeId: string, patch: Partial<FlowNode>) => void;
  onCreateNote: (content: string, label: string) => void;
  onDropTool?: (toolId: string, canvasX: number, canvasY: number) => void;
}

const GRID_SIZE = 20;

export function FlowCanvas({
  state,
  frozen,
  onMoveNode,
  onDeleteNode,
  onSelectNode,
  onToggleSelectNode,
  onNodeDoubleClick,
  onViewportChange,
  onPickDocument,
  onUpdateNode,
  onCreateNote,
  onDropTool,
}: FlowCanvasProps) {
  const {
    canvasRef,
    handleWheel,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleNodeMouseDown,
    handleNodeDoubleClick,
    screenToCanvas,
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

  return (
    <div
      ref={canvasRef}
      className={`absolute inset-0 overflow-hidden bg-background ${frozen ? "cursor-not-allowed" : isDragging ? "cursor-grabbing" : "cursor-default"}`}
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
        <FlowEdgeLayer nodes={state.nodes} edges={state.edges} />

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
              Drag items from the dock to the canvas, or click to add
            </p>
          </div>
        </div>
      )}

    </div>
  );
}
