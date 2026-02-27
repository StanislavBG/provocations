import { useCallback, useMemo } from "react";
import type { BSChart, BSToolMode, BSPortSide, BSNodeType } from "./types";
import { BSNodeRenderer } from "./nodes/BSNodeRenderer";
import { BSConnectorLayer } from "./BSConnectorLayer";
import { useCanvasInteraction } from "./hooks/useCanvasInteraction";

interface BSChartCanvasProps {
  chart: BSChart;
  toolMode: BSToolMode;
  onAddNode: (type: BSNodeType, x: number, y: number) => void;
  onMoveNode: (nodeId: string, x: number, y: number) => void;
  onMoveNodeEnd: () => void;
  onUpdateNode: (nodeId: string, updates: { label?: string }) => void;
  onSelectNodes: (nodeIds: string[], additive?: boolean) => void;
  onSelectConnectors: (connectorIds: string[], additive?: boolean) => void;
  onClearSelection: () => void;
  onAddConnector: (fromNodeId: string, fromPort: BSPortSide, toNodeId: string, toPort: BSPortSide) => void;
  onViewportChange: (x: number, y: number, zoom: number) => void;
  onTableCellChange?: (nodeId: string, rowId: string, colId: string, value: string) => void;
  onUpdateConnector?: (connectorId: string, updates: { label?: string }) => void;
}

export function BSChartCanvas({
  chart,
  toolMode,
  onAddNode,
  onMoveNode,
  onMoveNodeEnd,
  onUpdateNode,
  onSelectNodes,
  onSelectConnectors,
  onClearSelection,
  onAddConnector,
  onViewportChange,
  onTableCellChange,
  onUpdateConnector,
}: BSChartCanvasProps) {
  // Connection state tracking
  const connectRef = { nodeId: "", port: "top" as BSPortSide };

  const handleStartConnect = useCallback(
    (nodeId: string, port: BSPortSide) => {
      connectRef.nodeId = nodeId;
      connectRef.port = port;
    },
    [],
  );

  const handleEndConnect = useCallback(
    (nodeId: string, port: BSPortSide) => {
      if (connectRef.nodeId && connectRef.nodeId !== nodeId) {
        onAddConnector(connectRef.nodeId, connectRef.port, nodeId, port);
      }
      connectRef.nodeId = "";
    },
    [onAddConnector],
  );

  const {
    canvasRef,
    handleWheel,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleNodeMouseDown,
    handleNodeMouseUp,
    connectPreview,
    marquee,
    isDragging,
  } = useCanvasInteraction({
    viewport: chart.viewport,
    onViewportChange,
    onNodeMove: onMoveNode,
    onNodeMoveEnd: onMoveNodeEnd,
    onSelectNode: onSelectNodes,
    onSelectConnector: onSelectConnectors,
    onClearSelection,
    onAddNode: (type, x, y) => onAddNode(type as BSNodeType, x, y),
    onStartConnect: handleStartConnect,
    onEndConnect: handleEndConnect,
    nodes: chart.nodes,
    toolMode,
  });

  const handleNodeDoubleClick = useCallback((_nodeId: string) => {
    // editing is handled inside BSNodeRenderer
  }, []);

  const handleLabelChange = useCallback(
    (nodeId: string, label: string) => {
      onUpdateNode(nodeId, { label });
    },
    [onUpdateNode],
  );

  // ── Cursor style based on tool ──
  const cursorClass = useMemo(() => {
    switch (toolMode) {
      case "pan": return "cursor-grab";
      case "connect": return "cursor-crosshair";
      case "select": return isDragging ? "cursor-grabbing" : "cursor-default";
      default: return "cursor-crosshair";
    }
  }, [toolMode, isDragging]);

  // Grid pattern
  const gridSize = chart.gridSize * chart.viewport.zoom;

  return (
    <div
      ref={canvasRef}
      className={`relative w-full h-full overflow-hidden bg-background ${cursorClass}`}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Grid */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none">
        <defs>
          <pattern
            id="grid-pattern"
            x={chart.viewport.x % gridSize}
            y={chart.viewport.y % gridSize}
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
        <rect width="100%" height="100%" fill="url(#grid-pattern)" />
      </svg>

      {/* Canvas transform layer */}
      <div
        className="absolute"
        style={{
          transform: `translate(${chart.viewport.x}px, ${chart.viewport.y}px) scale(${chart.viewport.zoom})`,
          transformOrigin: "0 0",
        }}
      >
        {/* Connectors (SVG layer) */}
        <BSConnectorLayer
          nodes={chart.nodes}
          connectors={chart.connectors}
          selectedConnectorIds={chart.selectedConnectorIds}
          onSelectConnector={onSelectConnectors}
          onDoubleClickConnector={(id) => {
            const label = prompt("Connector label:");
            if (label !== null) onUpdateConnector?.(id, { label });
          }}
          connectPreview={connectPreview}
        />

        {/* Nodes */}
        {chart.nodes
          .slice()
          .sort((a, b) => a.zIndex - b.zIndex)
          .map((node) => (
            <BSNodeRenderer
              key={node.id}
              node={node}
              isSelected={chart.selectedNodeIds.includes(node.id)}
              onMouseDown={handleNodeMouseDown}
              onMouseUp={handleNodeMouseUp}
              onDoubleClick={handleNodeDoubleClick}
              onLabelChange={handleLabelChange}
              onTableCellChange={onTableCellChange}
              showPorts={toolMode === "connect" || toolMode === "select"}
            />
          ))}
      </div>

      {/* Marquee selection rectangle */}
      {marquee && (
        <div
          className="absolute border border-primary/50 bg-primary/10 pointer-events-none"
          style={{
            left: marquee.x * chart.viewport.zoom + chart.viewport.x,
            top: marquee.y * chart.viewport.zoom + chart.viewport.y,
            width: marquee.width * chart.viewport.zoom,
            height: marquee.height * chart.viewport.zoom,
          }}
        />
      )}

      {/* Zoom indicator */}
      <div className="absolute bottom-3 right-3 bg-card/80 border rounded px-2 py-0.5 text-[10px] text-muted-foreground backdrop-blur-sm">
        {Math.round(chart.viewport.zoom * 100)}%
      </div>
    </div>
  );
}
