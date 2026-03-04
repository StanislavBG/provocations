import { useState, useCallback, useRef } from "react";
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
  | "audio"
  | "youtube"
  | "timer-event"
  | "filter"
  | "gate"
  | "router"
  | "merge";

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
  /** YouTube node: the URL pasted by the user */
  youtubeUrl?: string;
  /** YouTube node: extracted video title */
  youtubeTitle?: string;
  /** YouTube node: fetch status */
  youtubeFetchStatus?: "idle" | "fetching" | "done" | "error";
  /** YouTube node: error message */
  youtubeError?: string;
  /** Timer-Event node: whether the timer is currently running */
  timerRunning?: boolean;
  /** Timer-Event node: interval in milliseconds (default 5000) */
  timerInterval?: number;
  /** Timer-Event node: count of pulses fired so far */
  timerPulseCount?: number;
  /** Timer-Event node: timestamp of last pulse */
  timerLastPulse?: string;
  /** Logic node: condition rule (human-readable expression) */
  logicRule?: string;
  /** Logic node: whether the gate is open (gate type only) */
  gateOpen?: boolean;
  /** Logic node: router output labels */
  routerOutputs?: string[];
  /** Store node: selected destination folder ID */
  storeFolderId?: number;
  /** Store node: display name of the selected folder */
  storeFolderName?: string;
  /** Store node: full path string like "Projects > Subfolder" */
  storeFolderPath?: string;
  /** Pause flag: when true, automation stops at this node and waits */
  paused?: boolean;
  /** Lock flag: when true, node cannot be moved or deleted */
  locked?: boolean;
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
  youtube: [{ side: "right", type: "output" }],
  "timer-event": [{ side: "right", type: "output" }],
  filter: [{ side: "left", type: "input" }, { side: "right", type: "output" }],
  gate: [{ side: "left", type: "input" }, { side: "right", type: "output" }],
  router: [{ side: "left", type: "input" }, { side: "right", type: "output" }],
  merge: [{ side: "left", type: "input" }, { side: "right", type: "output" }],
  store: [{ side: "left", type: "input" }],
  // research, interview, zone — no ports
};

// ── Defaults ──

const DEFAULT_DIMENSIONS: Record<FlowNodeType, { width: number; height: number }> = {
  "context-doc": { width: 200, height: 120 },
  research: { width: 220, height: 140 },
  llm: { width: 260, height: 240 },
  store: { width: 200, height: 100 },
  painter: { width: 260, height: 200 },
  interview: { width: 220, height: 140 },
  timeline: { width: 260, height: 160 },
  document: { width: 200, height: 130 },
  zone: { width: 400, height: 300 },
  audio: { width: 200, height: 140 },
  youtube: { width: 240, height: 170 },
  "timer-event": { width: 200, height: 160 },
  filter: { width: 220, height: 130 },
  gate: { width: 180, height: 120 },
  router: { width: 220, height: 140 },
  merge: { width: 200, height: 120 },
};

const INITIAL_VIEWPORT: FlowViewport = { x: 0, y: 0, zoom: 1 };

// ── Hook ──

const MAX_HISTORY = 50;

interface HistorySnapshot {
  nodes: FlowNode[];
  edges: FlowEdge[];
}

export function useFlowCanvas() {
  const [state, setState] = useState<FlowCanvasState>({
    nodes: [],
    edges: [],
    viewport: INITIAL_VIEWPORT,
    selectedNodeIds: new Set(),
  });

  // ── Undo / Redo history ──
  const undoStack = useRef<HistorySnapshot[]>([]);
  const redoStack = useRef<HistorySnapshot[]>([]);
  const stateForHistory = useRef(state);
  stateForHistory.current = state;

  /** Capture a snapshot before a mutation. Call this BEFORE setState. */
  const pushHistory = useCallback(() => {
    const s = stateForHistory.current;
    undoStack.current.push({ nodes: s.nodes, edges: s.edges });
    if (undoStack.current.length > MAX_HISTORY) undoStack.current.shift();
    redoStack.current = []; // new mutation clears redo
  }, []);

  const undo = useCallback(() => {
    const snapshot = undoStack.current.pop();
    if (!snapshot) return;
    // Save current state to redo before restoring
    const s = stateForHistory.current;
    redoStack.current.push({ nodes: s.nodes, edges: s.edges });
    setState((prev) => ({ ...prev, nodes: snapshot.nodes, edges: snapshot.edges }));
  }, []);

  const redo = useCallback(() => {
    const snapshot = redoStack.current.pop();
    if (!snapshot) return;
    const s = stateForHistory.current;
    undoStack.current.push({ nodes: s.nodes, edges: s.edges });
    setState((prev) => ({ ...prev, nodes: snapshot.nodes, edges: snapshot.edges }));
  }, []);

  const addNode = useCallback(
    (
      type: FlowNodeType,
      x: number,
      y: number,
      data: Partial<Omit<FlowNode, "id" | "type" | "x" | "y" | "width" | "height" | "zIndex">> & { label: string },
    ) => {
      pushHistory();
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
    [pushHistory],
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

  /** Push an undo snapshot explicitly (e.g. before a drag operation starts) */
  const pushUndoSnapshot = useCallback(() => {
    pushHistory();
  }, [pushHistory]);

  const moveNode = useCallback((nodeId: string, x: number, y: number) => {
    setState((s) => ({
      ...s,
      nodes: s.nodes.map((n) => (n.id === nodeId ? { ...n, x, y } : n)),
    }));
  }, []);

  const addEdge = useCallback(
    (fromNodeId: string, toNodeId: string): string => {
      pushHistory();
      const id = generateId("edge");
      setState((s) => ({
        ...s,
        edges: [...s.edges, { id, fromNodeId, toNodeId }],
      }));
      return id;
    },
    [pushHistory],
  );

  const deleteNode = useCallback((nodeId: string) => {
    pushHistory();
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
  }, [pushHistory]);

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

  /** Set multiple nodes as selected (used by marquee selection) */
  const selectNodes = useCallback((nodeIds: string[]) => {
    setState((s) => ({ ...s, selectedNodeIds: new Set(nodeIds) }));
  }, []);

  /** Select all nodes */
  const selectAll = useCallback(() => {
    setState((s) => ({ ...s, selectedNodeIds: new Set(s.nodes.map((n) => n.id)) }));
  }, []);

  const setViewport = useCallback((x: number, y: number, zoom: number) => {
    setState((s) => ({ ...s, viewport: { x, y, zoom } }));
  }, []);

  /** Move multiple nodes by a delta (used for zone group drag) */
  const moveNodes = useCallback((nodeIds: string[], dx: number, dy: number) => {
    const idSet = new Set(nodeIds);
    setState((s) => ({
      ...s,
      nodes: s.nodes.map((n) =>
        idSet.has(n.id) ? { ...n, x: n.x + dx, y: n.y + dy } : n,
      ),
    }));
  }, []);

  /** Delete an edge by id */
  const deleteEdge = useCallback((edgeId: string) => {
    pushHistory();
    setState((s) => ({
      ...s,
      edges: s.edges.filter((e) => e.id !== edgeId),
    }));
  }, [pushHistory]);

  /** Load a full canvas state from saved JSON */
  const loadCanvas = useCallback(
    (data: { nodes: FlowNode[]; edges: FlowEdge[]; viewport: FlowViewport }) => {
      // Migrate old store nodes from large embedded sidebar to compact card
      const nodes = (data.nodes || []).map((n: FlowNode) => {
        if (n.type === "store" && n.width === 260 && n.height === 320) {
          return { ...n, width: 200, height: 100 };
        }
        return n;
      });
      setState({
        nodes,
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
    pushUndoSnapshot,
    moveNode,
    moveNodes,
    deleteNode,
    deleteEdge,
    selectNode,
    selectNodes,
    selectAll,
    toggleSelectNode,
    setViewport,
    loadCanvas,
    resetCanvas,
    undo,
    redo,
  };
}
