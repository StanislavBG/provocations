// ── BS Chart Data Model ──────────────────────────────────────────────

export type BSNodeType = "table" | "diamond" | "text" | "rectangle" | "rounded-rect" | "badge";
export type BSPortSide = "top" | "right" | "bottom" | "left";
export type BSLineStyle = "solid" | "dashed" | "dotted";
export type BSArrowHead = "none" | "arrow" | "diamond" | "circle";
export type BSToolMode = "select" | "pan" | "connect" | BSNodeType;

// ── Node Style ──

export interface BSNodeStyle {
  fillColor: string;
  strokeColor: string;
  strokeWidth: number;
  textColor: string;
  fontSize: number;
  fontWeight: "normal" | "bold";
  borderRadius: number;
  opacity: number;
}

export const DEFAULT_NODE_STYLE: BSNodeStyle = {
  fillColor: "#ffffff",
  strokeColor: "#334155",
  strokeWidth: 2,
  textColor: "#1e293b",
  fontSize: 12,
  fontWeight: "normal",
  borderRadius: 4,
  opacity: 1,
};

// ── Table Data ──

export interface BSTableColumn {
  id: string;
  label: string;
  width: number;
}

export interface BSTableRow {
  id: string;
  cells: Record<string, string>; // columnId → value
}

export interface BSTableData {
  columns: BSTableColumn[];
  rows: BSTableRow[];
  headerBgColor: string;
  stripedRows: boolean;
}

// ── Node ──

export interface BSNode {
  id: string;
  type: BSNodeType;
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  voiceLabel: string; // name for voice commands
  style: BSNodeStyle;
  locked: boolean;
  zIndex: number;
  // Type-specific data
  tableData?: BSTableData;
  textContent?: string;
  textAlign?: "left" | "center" | "right";
}

// ── Connector ──

export interface BSConnector {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  fromPort: BSPortSide;
  toPort: BSPortSide;
  label: string;
  lineStyle: BSLineStyle;
  color: string;
  strokeWidth: number;
  startArrow: BSArrowHead;
  endArrow: BSArrowHead;
}

// ── Viewport ──

export interface BSViewport {
  x: number;
  y: number;
  zoom: number;
}

// ── Full Chart State ──

export interface BSChart {
  nodes: BSNode[];
  connectors: BSConnector[];
  viewport: BSViewport;
  gridSize: number;
  snapToGrid: boolean;
  selectedNodeIds: string[];
  selectedConnectorIds: string[];
}

export const EMPTY_CHART: BSChart = {
  nodes: [],
  connectors: [],
  viewport: { x: 0, y: 0, zoom: 1 },
  gridSize: 20,
  snapToGrid: true,
  selectedNodeIds: [],
  selectedConnectorIds: [],
};

// ── Default dimensions by type ──

export const DEFAULT_DIMENSIONS: Record<BSNodeType, { width: number; height: number }> = {
  table: { width: 280, height: 200 },
  diamond: { width: 160, height: 100 },
  text: { width: 200, height: 40 },
  rectangle: { width: 180, height: 80 },
  "rounded-rect": { width: 180, height: 80 },
  badge: { width: 80, height: 32 },
};

// ── Default styles by type ──

export const DEFAULT_STYLES: Partial<Record<BSNodeType, Partial<BSNodeStyle>>> = {
  table: { fillColor: "#f8fafc", strokeColor: "#334155", borderRadius: 6 },
  diamond: { fillColor: "#fef3c7", strokeColor: "#d97706", borderRadius: 0 },
  text: { fillColor: "transparent", strokeColor: "transparent", strokeWidth: 0, fontSize: 14 },
  rectangle: { fillColor: "#dbeafe", strokeColor: "#3b82f6", borderRadius: 4 },
  "rounded-rect": { fillColor: "#dcfce7", strokeColor: "#22c55e", borderRadius: 20 },
  badge: { fillColor: "#7c3aed", strokeColor: "#7c3aed", textColor: "#ffffff", fontSize: 10, fontWeight: "bold", borderRadius: 12 },
};

// ── Port position helpers ──

export function getPortPosition(node: BSNode, side: BSPortSide): { x: number; y: number } {
  switch (side) {
    case "top": return { x: node.x + node.width / 2, y: node.y };
    case "bottom": return { x: node.x + node.width / 2, y: node.y + node.height };
    case "left": return { x: node.x, y: node.y + node.height / 2 };
    case "right": return { x: node.x + node.width, y: node.y + node.height / 2 };
  }
}

export function snapToGrid(val: number, gridSize: number): number {
  return Math.round(val / gridSize) * gridSize;
}
