import { useState, useCallback, useRef } from "react";
import { generateId } from "@/lib/utils";
import type {
  BSChart,
  BSNode,
  BSConnector,
  BSNodeType,
  BSNodeStyle,
  BSPortSide,
} from "../types";
import {
  EMPTY_CHART,
  DEFAULT_NODE_STYLE,
  DEFAULT_DIMENSIONS,
  DEFAULT_STYLES,
  snapToGrid,
} from "../types";

// ── Undo / Redo ──

interface HistoryEntry {
  nodes: BSNode[];
  connectors: BSConnector[];
}

const MAX_HISTORY = 50;

export function useChartState() {
  const [chart, setChart] = useState<BSChart>({ ...EMPTY_CHART });

  // undo / redo stacks
  const undoStack = useRef<HistoryEntry[]>([]);
  const redoStack = useRef<HistoryEntry[]>([]);

  const pushHistory = useCallback(() => {
    undoStack.current.push({
      nodes: JSON.parse(JSON.stringify(chart.nodes)),
      connectors: JSON.parse(JSON.stringify(chart.connectors)),
    });
    if (undoStack.current.length > MAX_HISTORY) undoStack.current.shift();
    redoStack.current = [];
  }, [chart.nodes, chart.connectors]);

  const undo = useCallback(() => {
    const entry = undoStack.current.pop();
    if (!entry) return;
    redoStack.current.push({
      nodes: JSON.parse(JSON.stringify(chart.nodes)),
      connectors: JSON.parse(JSON.stringify(chart.connectors)),
    });
    setChart((prev) => ({ ...prev, nodes: entry.nodes, connectors: entry.connectors, selectedNodeIds: [], selectedConnectorIds: [] }));
  }, [chart.nodes, chart.connectors]);

  const redo = useCallback(() => {
    const entry = redoStack.current.pop();
    if (!entry) return;
    undoStack.current.push({
      nodes: JSON.parse(JSON.stringify(chart.nodes)),
      connectors: JSON.parse(JSON.stringify(chart.connectors)),
    });
    setChart((prev) => ({ ...prev, nodes: entry.nodes, connectors: entry.connectors, selectedNodeIds: [], selectedConnectorIds: [] }));
  }, [chart.nodes, chart.connectors]);

  // ── Node operations ──

  const addNode = useCallback(
    (type: BSNodeType, x: number, y: number, label?: string) => {
      pushHistory();
      const dim = DEFAULT_DIMENSIONS[type];
      const typeStyle = DEFAULT_STYLES[type] ?? {};
      const snappedX = chart.snapToGrid ? snapToGrid(x, chart.gridSize) : x;
      const snappedY = chart.snapToGrid ? snapToGrid(y, chart.gridSize) : y;

      const newNode: BSNode = {
        id: generateId("node"),
        type,
        x: snappedX,
        y: snappedY,
        width: dim.width,
        height: dim.height,
        label: label || getDefaultLabel(type),
        voiceLabel: label || getDefaultLabel(type),
        style: { ...DEFAULT_NODE_STYLE, ...typeStyle },
        locked: false,
        zIndex: chart.nodes.length,
        ...(type === "table"
          ? {
              tableData: {
                columns: [
                  { id: generateId("col"), label: "Column", width: 120 },
                  { id: generateId("col"), label: "Type", width: 80 },
                ],
                rows: [
                  {
                    id: generateId("row"),
                    cells: {},
                  },
                ],
                headerBgColor: "#334155",
                stripedRows: true,
              },
            }
          : {}),
        ...(type === "text" ? { textContent: "Annotation", textAlign: "left" as const } : {}),
      };

      // Fill cells for table rows
      if (newNode.tableData) {
        const cols = newNode.tableData.columns;
        newNode.tableData.rows[0].cells = {
          [cols[0].id]: "id",
          [cols[1].id]: "int",
        };
      }

      setChart((prev) => ({
        ...prev,
        nodes: [...prev.nodes, newNode],
        selectedNodeIds: [newNode.id],
        selectedConnectorIds: [],
      }));
      return newNode.id;
    },
    [pushHistory, chart.snapToGrid, chart.gridSize, chart.nodes.length],
  );

  const updateNode = useCallback(
    (nodeId: string, updates: Partial<BSNode>) => {
      pushHistory();
      setChart((prev) => ({
        ...prev,
        nodes: prev.nodes.map((n) =>
          n.id === nodeId ? { ...n, ...updates } : n,
        ),
      }));
    },
    [pushHistory],
  );

  const moveNode = useCallback(
    (nodeId: string, x: number, y: number) => {
      setChart((prev) => ({
        ...prev,
        nodes: prev.nodes.map((n) => {
          if (n.id !== nodeId || n.locked) return n;
          const nx = prev.snapToGrid ? snapToGrid(x, prev.gridSize) : x;
          const ny = prev.snapToGrid ? snapToGrid(y, prev.gridSize) : y;
          return { ...n, x: nx, y: ny };
        }),
      }));
    },
    [],
  );

  const resizeNode = useCallback(
    (nodeId: string, width: number, height: number) => {
      pushHistory();
      setChart((prev) => ({
        ...prev,
        nodes: prev.nodes.map((n) =>
          n.id === nodeId ? { ...n, width: Math.max(40, width), height: Math.max(24, height) } : n,
        ),
      }));
    },
    [pushHistory],
  );

  const deleteNodes = useCallback(
    (nodeIds: string[]) => {
      pushHistory();
      const idSet = new Set(nodeIds);
      setChart((prev) => ({
        ...prev,
        nodes: prev.nodes.filter((n) => !idSet.has(n.id)),
        connectors: prev.connectors.filter(
          (c) => !idSet.has(c.fromNodeId) && !idSet.has(c.toNodeId),
        ),
        selectedNodeIds: prev.selectedNodeIds.filter((id) => !idSet.has(id)),
      }));
    },
    [pushHistory],
  );

  const updateNodeStyle = useCallback(
    (nodeId: string, style: Partial<BSNodeStyle>) => {
      pushHistory();
      setChart((prev) => ({
        ...prev,
        nodes: prev.nodes.map((n) =>
          n.id === nodeId ? { ...n, style: { ...n.style, ...style } } : n,
        ),
      }));
    },
    [pushHistory],
  );

  // ── Connector operations ──

  const addConnector = useCallback(
    (fromNodeId: string, fromPort: BSPortSide, toNodeId: string, toPort: BSPortSide, label?: string) => {
      pushHistory();
      const newConnector: BSConnector = {
        id: generateId("conn"),
        fromNodeId,
        toNodeId,
        fromPort,
        toPort,
        label: label || "",
        lineStyle: "solid",
        color: "#64748b",
        strokeWidth: 2,
        startArrow: "none",
        endArrow: "arrow",
      };
      setChart((prev) => ({
        ...prev,
        connectors: [...prev.connectors, newConnector],
        selectedConnectorIds: [newConnector.id],
        selectedNodeIds: [],
      }));
      return newConnector.id;
    },
    [pushHistory],
  );

  const updateConnector = useCallback(
    (connectorId: string, updates: Partial<BSConnector>) => {
      pushHistory();
      setChart((prev) => ({
        ...prev,
        connectors: prev.connectors.map((c) =>
          c.id === connectorId ? { ...c, ...updates } : c,
        ),
      }));
    },
    [pushHistory],
  );

  const deleteConnectors = useCallback(
    (connectorIds: string[]) => {
      pushHistory();
      const idSet = new Set(connectorIds);
      setChart((prev) => ({
        ...prev,
        connectors: prev.connectors.filter((c) => !idSet.has(c.id)),
        selectedConnectorIds: prev.selectedConnectorIds.filter((id) => !idSet.has(id)),
      }));
    },
    [pushHistory],
  );

  // ── Selection ──

  const selectNodes = useCallback((nodeIds: string[], additive = false) => {
    setChart((prev) => ({
      ...prev,
      selectedNodeIds: additive
        ? Array.from(new Set([...prev.selectedNodeIds, ...nodeIds]))
        : nodeIds,
      selectedConnectorIds: additive ? prev.selectedConnectorIds : [],
    }));
  }, []);

  const selectConnectors = useCallback((connectorIds: string[], additive = false) => {
    setChart((prev) => ({
      ...prev,
      selectedConnectorIds: additive
        ? Array.from(new Set([...prev.selectedConnectorIds, ...connectorIds]))
        : connectorIds,
      selectedNodeIds: additive ? prev.selectedNodeIds : [],
    }));
  }, []);

  const clearSelection = useCallback(() => {
    setChart((prev) => ({
      ...prev,
      selectedNodeIds: [],
      selectedConnectorIds: [],
    }));
  }, []);

  // ── Viewport ──

  const setViewport = useCallback(
    (x: number, y: number, zoom: number) => {
      setChart((prev) => ({
        ...prev,
        viewport: { x, y, zoom: Math.max(0.1, Math.min(4, zoom)) },
      }));
    },
    [],
  );

  // ── Grid ──

  const toggleSnapToGrid = useCallback(() => {
    setChart((prev) => ({ ...prev, snapToGrid: !prev.snapToGrid }));
  }, []);

  // ── Serialization ──

  const exportChart = useCallback(() => {
    return JSON.stringify(
      { nodes: chart.nodes, connectors: chart.connectors, gridSize: chart.gridSize },
      null,
      2,
    );
  }, [chart.nodes, chart.connectors, chart.gridSize]);

  const importChart = useCallback((json: string) => {
    try {
      const data = JSON.parse(json);
      if (data.nodes && data.connectors) {
        pushHistory();
        setChart((prev) => ({
          ...prev,
          nodes: data.nodes,
          connectors: data.connectors,
          gridSize: data.gridSize ?? prev.gridSize,
          selectedNodeIds: [],
          selectedConnectorIds: [],
        }));
        return true;
      }
    } catch {
      // invalid JSON
    }
    return false;
  }, [pushHistory]);

  // ── Duplicate selected ──

  const duplicateSelected = useCallback(() => {
    if (chart.selectedNodeIds.length === 0) return;
    pushHistory();

    const idMap = new Map<string, string>();
    const newNodes: BSNode[] = [];

    for (const id of chart.selectedNodeIds) {
      const node = chart.nodes.find((n) => n.id === id);
      if (!node) continue;
      const newId = generateId("node");
      idMap.set(id, newId);
      newNodes.push({
        ...JSON.parse(JSON.stringify(node)),
        id: newId,
        x: node.x + 20,
        y: node.y + 20,
      });
    }

    // Duplicate connectors between selected nodes
    const newConnectors: BSConnector[] = [];
    for (const c of chart.connectors) {
      if (idMap.has(c.fromNodeId) && idMap.has(c.toNodeId)) {
        newConnectors.push({
          ...c,
          id: generateId("conn"),
          fromNodeId: idMap.get(c.fromNodeId)!,
          toNodeId: idMap.get(c.toNodeId)!,
        });
      }
    }

    setChart((prev) => ({
      ...prev,
      nodes: [...prev.nodes, ...newNodes],
      connectors: [...prev.connectors, ...newConnectors],
      selectedNodeIds: newNodes.map((n) => n.id),
      selectedConnectorIds: newConnectors.map((c) => c.id),
    }));
  }, [chart.selectedNodeIds, chart.nodes, chart.connectors, pushHistory]);

  // ── Table-specific operations ──

  const addTableRow = useCallback(
    (nodeId: string) => {
      pushHistory();
      setChart((prev) => ({
        ...prev,
        nodes: prev.nodes.map((n) => {
          if (n.id !== nodeId || !n.tableData) return n;
          const cells: Record<string, string> = {};
          for (const col of n.tableData.columns) {
            cells[col.id] = "";
          }
          return {
            ...n,
            height: n.height + 28,
            tableData: {
              ...n.tableData,
              rows: [...n.tableData.rows, { id: generateId("row"), cells }],
            },
          };
        }),
      }));
    },
    [pushHistory],
  );

  const addTableColumn = useCallback(
    (nodeId: string, label: string) => {
      pushHistory();
      setChart((prev) => ({
        ...prev,
        nodes: prev.nodes.map((n) => {
          if (n.id !== nodeId || !n.tableData) return n;
          const newColId = generateId("col");
          return {
            ...n,
            width: n.width + 80,
            tableData: {
              ...n.tableData,
              columns: [...n.tableData.columns, { id: newColId, label, width: 80 }],
              rows: n.tableData.rows.map((r) => ({
                ...r,
                cells: { ...r.cells, [newColId]: "" },
              })),
            },
          };
        }),
      }));
    },
    [pushHistory],
  );

  const updateTableCell = useCallback(
    (nodeId: string, rowId: string, colId: string, value: string) => {
      setChart((prev) => ({
        ...prev,
        nodes: prev.nodes.map((n) => {
          if (n.id !== nodeId || !n.tableData) return n;
          return {
            ...n,
            tableData: {
              ...n.tableData,
              rows: n.tableData.rows.map((r) =>
                r.id === rowId
                  ? { ...r, cells: { ...r.cells, [colId]: value } }
                  : r,
              ),
            },
          };
        }),
      }));
    },
    [],
  );

  return {
    chart,
    setChart,

    // Node ops
    addNode,
    updateNode,
    moveNode,
    resizeNode,
    deleteNodes,
    updateNodeStyle,

    // Connector ops
    addConnector,
    updateConnector,
    deleteConnectors,

    // Selection
    selectNodes,
    selectConnectors,
    clearSelection,

    // Viewport
    setViewport,

    // Grid
    toggleSnapToGrid,

    // History
    undo,
    redo,
    pushHistory,

    // Serialization
    exportChart,
    importChart,

    // Duplicate
    duplicateSelected,

    // Table ops
    addTableRow,
    addTableColumn,
    updateTableCell,
  };
}

function getDefaultLabel(type: BSNodeType): string {
  switch (type) {
    case "table": return "Table";
    case "diamond": return "Decision";
    case "text": return "Text";
    case "rectangle": return "Process";
    case "rounded-rect": return "Service";
    case "badge": return "Label";
  }
}
