import { useState, useCallback } from "react";
import { generateId } from "@/lib/utils";

// ── Types ──

export type FlowNodeType = "context-doc" | "research" | "note" | "summary" | "store";

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
  "context-doc": { width: 280, height: 160 },
  research: { width: 320, height: 200 },
  note: { width: 260, height: 140 },
  summary: { width: 300, height: 180 },
  store: { width: 340, height: 420 },
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
      data: { label: string; documentId?: number; snippet?: string; content?: string },
    ) => {
      const dims = DEFAULT_DIMENSIONS[type];
      const node: FlowNode = {
        id: generateId("flow"),
        type,
        x: x - dims.width / 2,
        y: y - dims.height / 2,
        width: dims.width,
        height: dims.height,
        label: data.label,
        zIndex: 0,
        documentId: data.documentId,
        snippet: data.snippet,
        content: data.content,
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
    moveNode,
    deleteNode,
    selectNode,
    toggleSelectNode,
    setViewport,
  };
}
