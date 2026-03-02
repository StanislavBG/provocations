import { useState, useCallback, useEffect } from "react";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { BSChartCanvas } from "./BSChartCanvas";
import { BSChartToolbar } from "./BSChartToolbar";
import { BSChartProperties } from "./BSChartProperties";
import { useChartState } from "./hooks/useChartState";
import type { BSToolMode, BSNodeType, BSPortSide } from "./types";
import {
  Download, Upload, Save,
  Undo2, Redo2, ZoomIn, ZoomOut, Maximize, Grid3X3,
} from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface BSChartWorkspaceProps {
  /** Callback to export chart as markdown for document integration */
  onExportToDocument?: (markdown: string) => void;
  /** Callback to save chart JSON to context store */
  onSaveToContext?: (json: string, label: string) => void;
}

export function BSChartWorkspace({
  onExportToDocument,
  onSaveToContext,
}: BSChartWorkspaceProps) {
  const { toast } = useToast();
  const [toolMode, setToolMode] = useState<BSToolMode>("select");

  const {
    chart,
    addNode,
    updateNode,
    moveNode,
    resizeNode,
    deleteNodes,
    updateNodeStyle,
    addConnector,
    updateConnector,
    deleteConnectors,
    selectNodes,
    selectConnectors,
    clearSelection,
    setViewport,
    toggleSnapToGrid,
    undo,
    redo,
    pushHistory,
    exportChart,
    importChart,
    duplicateSelected,
    addTableRow,
    addTableColumn,
    updateTableCell,
  } = useChartState();

  // ── Keyboard shortcuts ──
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) {
        return;
      }

      if (!e.ctrlKey && !e.metaKey) {
        switch (e.key.toLowerCase()) {
          case "v": setToolMode("select"); return;
          case "h": setToolMode("pan"); return;
          case "c": setToolMode("connect"); return;
          case "r": setToolMode("rectangle"); return;
          case "u": setToolMode("rounded-rect"); return;
          case "d": setToolMode("diamond"); return;
          case "t": setToolMode("table"); return;
          case "x": setToolMode("text"); return;
          case "b": setToolMode("badge"); return;
          case "delete":
          case "backspace":
            if (chart.selectedNodeIds.length > 0) deleteNodes(chart.selectedNodeIds);
            if (chart.selectedConnectorIds.length > 0) deleteConnectors(chart.selectedConnectorIds);
            return;
          case "escape":
            clearSelection();
            setToolMode("select");
            return;
        }
      }

      if (e.ctrlKey || e.metaKey) {
        switch (e.key.toLowerCase()) {
          case "z":
            e.preventDefault();
            if (e.shiftKey) redo();
            else undo();
            return;
          case "y":
            e.preventDefault();
            redo();
            return;
          case "d":
            e.preventDefault();
            duplicateSelected();
            return;
          case "a":
            e.preventDefault();
            selectNodes(chart.nodes.map((n) => n.id));
            return;
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [
    chart.selectedNodeIds,
    chart.selectedConnectorIds,
    chart.nodes,
    deleteNodes,
    deleteConnectors,
    clearSelection,
    undo,
    redo,
    duplicateSelected,
    selectNodes,
  ]);

  // ── Handlers ──

  const handleAddNode = useCallback(
    (type: BSNodeType, x: number, y: number) => {
      addNode(type, x, y);
      setToolMode("select");
    },
    [addNode],
  );

  const handleAddConnector = useCallback(
    (fromNodeId: string, fromPort: BSPortSide, toNodeId: string, toPort: BSPortSide) => {
      addConnector(fromNodeId, fromPort, toNodeId, toPort);
    },
    [addConnector],
  );

  const handleZoomIn = useCallback(() => {
    setViewport(chart.viewport.x, chart.viewport.y, chart.viewport.zoom * 1.2);
  }, [chart.viewport, setViewport]);

  const handleZoomOut = useCallback(() => {
    setViewport(chart.viewport.x, chart.viewport.y, chart.viewport.zoom / 1.2);
  }, [chart.viewport, setViewport]);

  const handleZoomFit = useCallback(() => {
    if (chart.nodes.length === 0) {
      setViewport(0, 0, 1);
      return;
    }
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const n of chart.nodes) {
      minX = Math.min(minX, n.x);
      minY = Math.min(minY, n.y);
      maxX = Math.max(maxX, n.x + n.width);
      maxY = Math.max(maxY, n.y + n.height);
    }
    const padding = 60;
    minX -= padding; minY -= padding; maxX += padding; maxY += padding;
    const contentW = maxX - minX;
    const contentH = maxY - minY;
    const canvasW = 800;
    const canvasH = 600;
    const zoom = Math.min(canvasW / contentW, canvasH / contentH, 2);
    const x = (canvasW - contentW * zoom) / 2 - minX * zoom;
    const y = (canvasH - contentH * zoom) / 2 - minY * zoom;
    setViewport(x, y, zoom);
  }, [chart.nodes, setViewport]);

  const handleDelete = useCallback(() => {
    if (chart.selectedNodeIds.length > 0) deleteNodes(chart.selectedNodeIds);
    if (chart.selectedConnectorIds.length > 0) deleteConnectors(chart.selectedConnectorIds);
  }, [chart.selectedNodeIds, chart.selectedConnectorIds, deleteNodes, deleteConnectors]);

  const handleExport = useCallback(() => {
    const json = exportChart();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "bs-chart.json";
    a.click();
    URL.revokeObjectURL(url);
  }, [exportChart]);

  const handleImport = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const text = await file.text();
      if (importChart(text)) {
        toast({ title: "Chart imported" });
      } else {
        toast({ title: "Invalid chart file", variant: "destructive" });
      }
    };
    input.click();
  }, [importChart, toast]);

  const handleSaveToContext = useCallback(() => {
    const json = exportChart();
    onSaveToContext?.(json, `Chart (${chart.nodes.length} nodes)`);
    toast({ title: "Chart saved to context" });
  }, [exportChart, chart.nodes.length, onSaveToContext, toast]);

  // Selected items for properties panel
  const selectedNodes = chart.nodes.filter((n) => chart.selectedNodeIds.includes(n.id));
  const selectedConnectors = chart.connectors.filter((c) =>
    chart.selectedConnectorIds.includes(c.id),
  );

  return (
    <div className="h-full flex flex-col">
      {/* Top action bar */}
      <div className="flex items-center justify-between px-3 py-1 border-b bg-card shrink-0">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-semibold text-muted-foreground">
            {chart.nodes.length} nodes, {chart.connectors.length} connectors
          </span>
        </div>
        <div className="flex items-center gap-1">
          {/* Undo / Redo */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={undo}>
                <Undo2 className="w-3.5 h-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Undo (Ctrl+Z)</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={redo}>
                <Redo2 className="w-3.5 h-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Redo (Ctrl+Y)</TooltipContent>
          </Tooltip>

          <Separator orientation="vertical" className="h-4 mx-0.5" />

          {/* Zoom */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleZoomIn}>
                <ZoomIn className="w-3.5 h-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Zoom In</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleZoomOut}>
                <ZoomOut className="w-3.5 h-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Zoom Out</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleZoomFit}>
                <Maximize className="w-3.5 h-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Zoom to Fit</TooltipContent>
          </Tooltip>

          <Separator orientation="vertical" className="h-4 mx-0.5" />

          {/* Snap to Grid */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={chart.snapToGrid ? "default" : "ghost"}
                size="sm"
                className="h-6 text-xs gap-1"
                onClick={toggleSnapToGrid}
              >
                <Grid3X3 className="w-3 h-3" /> Snap to Grid
              </Button>
            </TooltipTrigger>
            <TooltipContent>Toggle grid snapping</TooltipContent>
          </Tooltip>

          <Separator orientation="vertical" className="h-4 mx-0.5" />

          {/* Import / Export */}
          {onSaveToContext && (
            <Button variant="ghost" size="sm" className="h-6 text-xs gap-1" onClick={handleSaveToContext}>
              <Save className="w-3 h-3" /> Save to Context
            </Button>
          )}
          <Button variant="ghost" size="sm" className="h-6 text-xs gap-1" onClick={handleImport}>
            <Upload className="w-3 h-3" /> Import
          </Button>
          <Button variant="ghost" size="sm" className="h-6 text-xs gap-1" onClick={handleExport}>
            <Download className="w-3 h-3" /> Export
          </Button>
        </div>
      </div>

      {/* Main workspace: toolbar | canvas | properties */}
      <div className="flex-1 overflow-hidden">
        <ResizablePanelGroup direction="horizontal">
          {/* Left: Toolbar */}
          <ResizablePanel defaultSize={12} minSize={8} maxSize={18}>
            <BSChartToolbar
              toolMode={toolMode}
              onToolModeChange={setToolMode}
              onUndo={undo}
              onRedo={redo}
              snapToGrid={chart.snapToGrid}
              onToggleSnapToGrid={toggleSnapToGrid}
              onZoomIn={handleZoomIn}
              onZoomOut={handleZoomOut}
              onZoomFit={handleZoomFit}
              onDuplicate={duplicateSelected}
              onDelete={handleDelete}
              hasSelection={chart.selectedNodeIds.length > 0 || chart.selectedConnectorIds.length > 0}
            />
          </ResizablePanel>

          <ResizableHandle />

          {/* Center: Canvas */}
          <ResizablePanel defaultSize={68} minSize={40}>
            <div className="h-full flex flex-col">
              <BSChartCanvas
                chart={chart}
                toolMode={toolMode}
                onAddNode={handleAddNode}
                onMoveNode={moveNode}
                onMoveNodeEnd={pushHistory}
                onUpdateNode={updateNode}
                onSelectNodes={selectNodes}
                onSelectConnectors={selectConnectors}
                onClearSelection={clearSelection}
                onAddConnector={handleAddConnector}
                onViewportChange={setViewport}
                onTableCellChange={updateTableCell}
                onUpdateConnector={updateConnector}
              />

            </div>
          </ResizablePanel>

          <ResizableHandle />

          {/* Right: Properties */}
          <ResizablePanel defaultSize={20} minSize={14} maxSize={30}>
            <BSChartProperties
              selectedNodes={selectedNodes}
              selectedConnectors={selectedConnectors}
              onUpdateNode={updateNode}
              onUpdateNodeStyle={updateNodeStyle}
              onUpdateConnector={updateConnector}
              onAddTableRow={addTableRow}
              onAddTableColumn={addTableColumn}
            />
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
  );
}
