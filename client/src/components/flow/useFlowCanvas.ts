import { useState, useCallback } from "react";
import { generateId } from "@/lib/utils";

// ── Types ──

export type FlowNodeType = "context-doc" | "research" | "note" | "llm" | "store";

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
}

export interface FlowViewport {
  x: number;
  y: number;
  zoom: number;
}

export interface FlowCanvasState {
  nodes: FlowNode[];
  viewport: FlowViewport;
  selectedNodeIds: Set<string>;
}

// ── Defaults ──

const DEFAULT_DIMENSIONS: Record<FlowNodeType, { width: number; height: number }> = {
  "context-doc": { width: 200, height: 120 },
  research: { width: 220, height: 140 },
  note: { width: 180, height: 100 },
  llm: { width: 260, height: 240 },
  store: { width: 260, height: 320 },
};

const INITIAL_VIEWPORT: FlowViewport = { x: 0, y: 0, zoom: 1 };

// ── Hook ──

export function useFlowCanvas() {
  const [state, setState] = useState<FlowCanvasState>({
    nodes: [],
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

  const deleteNode = useCallback((nodeId: string) => {
    setState((s) => {
      const next = new Set(s.selectedNodeIds);
      next.delete(nodeId);
      return {
        ...s,
        nodes: s.nodes.filter((n) => n.id !== nodeId),
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

  return {
    state,
    addNode,
    updateNode,
    moveNode,
    deleteNode,
    selectNode,
    toggleSelectNode,
    setViewport,
  };
}
