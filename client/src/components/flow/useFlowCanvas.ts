import { useState, useCallback } from "react";
import { generateId } from "@/lib/utils";

// ── Types ──

export type FlowNodeType =
  | "context-doc"
  | "research"
  | "llm"
  | "store"
  | "painter"
  | "interview"
  | "timeline"
  | "document"
  | "zone"
  | "audio";

export interface FlowNode {
  id: string;
  type: FlowNodeType;
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  zIndex: number;
  /** Context Store document ID (context-doc only) */
  documentId?: number;
  /** Content snippet for preview */
  snippet?: string;
  /** Full text content (used as input for operations like Summarize) */
  content?: string;
  /** LLM node: which preset is selected */
  llmPresetId?: string;
  /** LLM node: the objective/instruction text */
  llmObjective?: string;
  /** LLM node: execution status */
  llmStatus?: "idle" | "running" | "done" | "error";
  /** LLM node: output content after execution */
  llmOutput?: string;
  /** LLM node: error message if execution failed */
  llmError?: string;
  /** Research node: persisted conversation messages */
  researchMessages?: Array<{ role: string; content: string }>;
  /** Research node: the initial query for display on the card */
  researchQuery?: string;
  /** Document node: markdown text content */
  documentContent?: string;
  /** Document node: objective/purpose */
  documentObjective?: string;
  /** Zone node: ambient background color key */
  zoneColor?: string;
  /** Zone node: user-assigned label */
  zoneLabel?: string;
  /** Audio node: whether currently recording */
  audioRecording?: boolean;
  /** Audio node: transcript text */
  audioTranscript?: string;
  /** Image data URL (base64 PNG) — used by painter output and image documents */
  imageUrl?: string;
}

export interface FlowEdge {
  id: string;
  fromNodeId: string;
  toNodeId: string;
}

export interface FlowViewport {
  x: number;
  y: number;
  zoom: number;
}

export interface FlowCanvasState {
  nodes: FlowNode[];
  edges: FlowEdge[];
  viewport: FlowViewport;
  selectedNodeIds: Set<string>;
}

// ── Port Configuration ──

export interface PortDef {
  side: "left" | "right";
  type: "input" | "output";
}

/** Which ports each node type exposes */
export const NODE_PORTS: Partial<Record<FlowNodeType, PortDef[]>> = {
  document: [{ side: "right", type: "output" }],
  "context-doc": [{ side: "right", type: "output" }],
  llm: [{ side: "left", type: "input" }, { side: "right", type: "output" }],
  painter: [{ side: "left", type: "input" }, { side: "right", type: "output" }],
  timeline: [{ side: "left", type: "input" }, { side: "right", type: "output" }],
  audio: [{ side: "right", type: "output" }],
  // research, interview, store, zone — no ports
};

// ── Defaults ──

const DEFAULT_DIMENSIONS: Record<FlowNodeType, { width: number; height: number }> = {
  "context-doc": { width: 200, height: 120 },
  research: { width: 220, height: 140 },
  llm: { width: 260, height: 240 },
  store: { width: 260, height: 320 },
  painter: { width: 260, height: 200 },
  interview: { width: 220, height: 140 },
  timeline: { width: 260, height: 160 },
  document: { width: 200, height: 130 },
  zone: { width: 400, height: 300 },
  audio: { width: 200, height: 140 },
};

const INITIAL_VIEWPORT: FlowViewport = { x: 0, y: 0, zoom: 1 };

// ── Hook ──

export function useFlowCanvas() {
  const [state, setState] = useState<FlowCanvasState>({
    nodes: [],
    edges: [],
    viewport: INITIAL_VIEWPORT,
    selectedNodeIds: new Set(),
  });

  const addNode = useCallback(
    (
      type: FlowNodeType,
      x: number,
      y: number,
      data: Partial<Omit<FlowNode, "id" | "type" | "x" | "y" | "width" | "height" | "zIndex">> & { label: string },
    ) => {
      const dims = DEFAULT_DIMENSIONS[type];
      const node: FlowNode = {
        id: generateId("flow"),
        type,
        x: x - dims.width / 2,
        y: y - dims.height / 2,
        width: dims.width,
        height: dims.height,
        zIndex: 0,
        ...data,
      };
      setState((s) => ({
        ...s,
        nodes: [...s.nodes, { ...node, zIndex: s.nodes.length }],
        selectedNodeIds: new Set([node.id]),
      }));
      return node.id;
    },
    [],
  );

  const updateNode = useCallback(
    (nodeId: string, patch: Partial<FlowNode>) => {
      setState((s) => ({
        ...s,
        nodes: s.nodes.map((n) => (n.id === nodeId ? { ...n, ...patch } : n)),
      }));
    },
    [],
  );

  const moveNode = useCallback((nodeId: string, x: number, y: number) => {
    setState((s) => ({
      ...s,
      nodes: s.nodes.map((n) => (n.id === nodeId ? { ...n, x, y } : n)),
    }));
  }, []);

  const addEdge = useCallback(
    (fromNodeId: string, toNodeId: string): string => {
      const id = generateId("edge");
      setState((s) => ({
        ...s,
        edges: [...s.edges, { id, fromNodeId, toNodeId }],
      }));
      return id;
    },
    [],
  );

  const deleteNode = useCallback((nodeId: string) => {
    setState((s) => {
      const next = new Set(s.selectedNodeIds);
      next.delete(nodeId);
      return {
        ...s,
        nodes: s.nodes.filter((n) => n.id !== nodeId),
        edges: s.edges.filter((e) => e.fromNodeId !== nodeId && e.toNodeId !== nodeId),
        selectedNodeIds: next,
      };
    });
  }, []);

  const selectNode = useCallback((nodeId: string | null) => {
    setState((s) => ({
      ...s,
      selectedNodeIds: nodeId ? new Set([nodeId]) : new Set(),
    }));
  }, []);

  const toggleSelectNode = useCallback((nodeId: string) => {
    setState((s) => {
      const next = new Set(s.selectedNodeIds);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return { ...s, selectedNodeIds: next };
    });
  }, []);

  const setViewport = useCallback((x: number, y: number, zoom: number) => {
    setState((s) => ({ ...s, viewport: { x, y, zoom } }));
  }, []);

  /** Move multiple nodes by a delta (used for zone group drag) */
  const moveNodes = useCallback((nodeIds: string[], dx: number, dy: number) => {
    setState((s) => ({
      ...s,
      nodes: s.nodes.map((n) =>
        nodeIds.includes(n.id) ? { ...n, x: n.x + dx, y: n.y + dy } : n,
      ),
    }));
  }, []);

  /** Delete an edge by id */
  const deleteEdge = useCallback((edgeId: string) => {
    setState((s) => ({
      ...s,
      edges: s.edges.filter((e) => e.id !== edgeId),
    }));
  }, []);

  /** Load a full canvas state from saved JSON */
  const loadCanvas = useCallback(
    (data: { nodes: FlowNode[]; edges: FlowEdge[]; viewport: FlowViewport }) => {
      setState({
        nodes: data.nodes || [],
        edges: data.edges || [],
        viewport: data.viewport || INITIAL_VIEWPORT,
        selectedNodeIds: new Set(),
      });
    },
    [],
  );

  /** Reset canvas to empty state */
  const resetCanvas = useCallback(() => {
    setState({
      nodes: [],
      edges: [],
      viewport: INITIAL_VIEWPORT,
      selectedNodeIds: new Set(),
    });
  }, []);

  return {
    state,
    addNode,
    addEdge,
    updateNode,
    moveNode,
    moveNodes,
    deleteNode,
    deleteEdge,
    selectNode,
    toggleSelectNode,
    setViewport,
    loadCanvas,
    resetCanvas,
  };
}
