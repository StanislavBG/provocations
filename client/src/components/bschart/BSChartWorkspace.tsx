import { useState, useCallback, useEffect } from "react";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { BSChartCanvas } from "./BSChartCanvas";
import { BSChartToolbar } from "./BSChartToolbar";
import { BSChartProperties } from "./BSChartProperties";
import { useChartState } from "./hooks/useChartState";
import { useVoiceChartCommands } from "./hooks/useVoiceChartCommands";
import type { VoiceCommandEntry } from "./hooks/useVoiceChartCommands";
import { VoiceRecorder } from "@/components/VoiceRecorder";
import type { BSToolMode, BSNodeType, BSPortSide } from "./types";
import {
  Download, Upload, Save,
  HelpCircle, List, CheckCircle2, XCircle,
  ChevronDown, ChevronUp,
} from "lucide-react";

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
  const [voiceMode, setVoiceMode] = useState(false);
  const [voicePanelExpanded, setVoicePanelExpanded] = useState(false);
  const [voiceHelpOpen, setVoiceHelpOpen] = useState(false);

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

  const { executeCommand, lastResult, commandHistory, nodeInventory } =
    useVoiceChartCommands({
      nodes: chart.nodes,
      connectors: chart.connectors,
      onAddNode: addNode,
      onMoveNode: moveNode,
      onDeleteNodes: deleteNodes,
      onUpdateNode: updateNode,
      onUpdateNodeStyle: updateNodeStyle,
      onResizeNode: resizeNode,
      onAddConnector: addConnector,
      onUpdateConnector: updateConnector,
      onAddTableRow: addTableRow,
      onAddTableColumn: addTableColumn,
      onUpdateTableCell: updateTableCell,
      onSelectNodes: selectNodes,
      onClearSelection: clearSelection,
      onUndo: undo,
      onRedo: redo,
      onDuplicate: duplicateSelected,
    });

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

  const handleVoiceTranscript = useCallback(
    (transcript: string) => {
      const result = executeCommand(transcript);
      toast({ title: "Voice command", description: result });
    },
    [executeCommand, toast],
  );

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
          {/* Voice mode: node inventory chips */}
          {voiceMode && nodeInventory.length > 0 && (
            <div className="flex items-center gap-1 ml-2">
              <List className="w-3 h-3 text-muted-foreground/50" />
              {nodeInventory.slice(0, 8).map((ni) => (
                <span
                  key={ni.id}
                  className="text-[9px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground"
                  title={`Say "${ni.label}" to reference this ${ni.type}`}
                >
                  {ni.label}
                </span>
              ))}
              {nodeInventory.length > 8 && (
                <span className="text-[9px] text-muted-foreground/50">
                  +{nodeInventory.length - 8} more
                </span>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1">
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
              onToggleVoiceMode={() => setVoiceMode(!voiceMode)}
              isVoiceMode={voiceMode}
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

              {/* ── Voice Command Panel ── */}
              {voiceMode && (
                <div className="border-t bg-card shrink-0">
                  {/* Compact bar: recorder + last result + controls */}
                  <div className="px-3 py-2 flex items-center gap-3">
                    <VoiceRecorder
                      onTranscript={handleVoiceTranscript}
                      autoStart={false}
                      size="sm"
                      label="Speak"
                    />

                    <div className="flex-1 min-w-0">
                      {lastResult ? (
                        <span className="text-xs text-muted-foreground truncate block">
                          {lastResult}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground/50 truncate block">
                          Say: "add table called Users", "set Users color to blue", "connect Users to Orders"
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => setVoiceHelpOpen(!voiceHelpOpen)}
                        title="Voice command reference"
                      >
                        <HelpCircle className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => setVoicePanelExpanded(!voicePanelExpanded)}
                        title={voicePanelExpanded ? "Collapse history" : "Expand history"}
                      >
                        {voicePanelExpanded ? (
                          <ChevronDown className="w-3.5 h-3.5" />
                        ) : (
                          <ChevronUp className="w-3.5 h-3.5" />
                        )}
                      </Button>
                    </div>
                  </div>

                  {/* Expanded: command history + help */}
                  {(voicePanelExpanded || voiceHelpOpen) && (
                    <div className="border-t max-h-48 flex">
                      {/* Command history */}
                      {voicePanelExpanded && (
                        <ScrollArea className="flex-1 p-2">
                          {commandHistory.length === 0 ? (
                            <p className="text-[10px] text-muted-foreground/50 text-center py-4">
                              No commands yet. Press the mic and speak.
                            </p>
                          ) : (
                            <div className="space-y-1">
                              {commandHistory.slice().reverse().map((entry) => (
                                <div
                                  key={entry.id}
                                  className="flex items-start gap-1.5 text-[10px]"
                                >
                                  {entry.success ? (
                                    <CheckCircle2 className="w-3 h-3 text-green-500 mt-0.5 shrink-0" />
                                  ) : (
                                    <XCircle className="w-3 h-3 text-destructive mt-0.5 shrink-0" />
                                  )}
                                  <div className="min-w-0">
                                    <span className="text-muted-foreground/70 italic block truncate">
                                      "{entry.transcript}"
                                    </span>
                                    <span className={`block truncate ${entry.success ? "text-foreground" : "text-destructive"}`}>
                                      {entry.result}
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </ScrollArea>
                      )}

                      {/* Help reference */}
                      {voiceHelpOpen && (
                        <ScrollArea className={`p-2 ${voicePanelExpanded ? "w-64 border-l" : "flex-1"}`}>
                          <div className="space-y-2 text-[10px]">
                            <VoiceHelpSection title="Add shapes">
                              add table called Users{"\n"}
                              add diamond called Check{"\n"}
                              add rectangle called API{"\n"}
                              add badge called V2{"\n"}
                              add table called Orders right of Users
                            </VoiceHelpSection>
                            <VoiceHelpSection title="Connect & label">
                              connect Users to Orders{"\n"}
                              connect Users to Orders with has many{"\n"}
                              label Users to Orders with foreign key
                            </VoiceHelpSection>
                            <VoiceHelpSection title="Move">
                              move Orders right of Users{"\n"}
                              move Orders above Users{"\n"}
                              move Users up / down / left / right{"\n"}
                              move Users up 100
                            </VoiceHelpSection>
                            <VoiceHelpSection title="Style & properties">
                              set Users color to blue{"\n"}
                              set Users fill to red{"\n"}
                              set Users text color to white{"\n"}
                              set Users font size to 16{"\n"}
                              set Users bold{"\n"}
                              set Users width to 300{"\n"}
                              set Users opacity to 0.5
                            </VoiceHelpSection>
                            <VoiceHelpSection title="Resize">
                              resize Users to 300 by 200{"\n"}
                              make Users wider / taller / bigger{"\n"}
                              make Users smaller
                            </VoiceHelpSection>
                            <VoiceHelpSection title="Tables">
                              add row to Users{"\n"}
                              add column Email to Users{"\n"}
                              set Users row 1 column 1 to email{"\n"}
                              fill Users Email with varchar
                            </VoiceHelpSection>
                            <VoiceHelpSection title="Other">
                              rename Users to Accounts{"\n"}
                              delete Users / delete all{"\n"}
                              select Users / select all / deselect{"\n"}
                              duplicate Users{"\n"}
                              list nodes{"\n"}
                              undo / redo
                            </VoiceHelpSection>
                          </div>
                        </ScrollArea>
                      )}
                    </div>
                  )}
                </div>
              )}
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

// ── Voice help section component ──

function VoiceHelpSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <span className="font-bold text-foreground block mb-0.5">{title}</span>
      <div className="text-muted-foreground whitespace-pre-wrap font-mono leading-relaxed pl-2 border-l border-muted">
        {children}
      </div>
    </div>
  );
}
