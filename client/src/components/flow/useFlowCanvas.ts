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
  | "merge"
  | "label"
  | "social-post"
  | "api-connection"
  | "coherence-gate";

// Import from registry for local use and re-export for backward compatibility
import { NODE_PORTS as _NODE_PORTS, DEFAULT_DIMENSIONS as _DEFAULT_DIMENSIONS } from "./FlowNodeRegistry";
export { _NODE_PORTS as NODE_PORTS, _DEFAULT_DIMENSIONS as DEFAULT_DIMENSIONS };

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
  /** Trigger node: sub-type — "timed" fires on interval, "automated" fires when upstream finishes */
  triggerMode?: "timed" | "automated";
  /** Trigger node: whether the trigger is currently active */
  timerRunning?: boolean;
  /** Trigger node (timed): interval in milliseconds (default 5000) */
  timerInterval?: number;
  /** Trigger node: count of pulses/fires so far */
  timerPulseCount?: number;
  /** Trigger node: timestamp of last pulse/fire */
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
  /** Lock flag: when true, node cannot be moved or deleted (legacy — use lockMode) */
  locked?: boolean;
  /** Lock mode: 'none' = movable, 'canvas' = fixed on canvas, 'screen' = HUD-style viewport-fixed */
  lockMode?: "none" | "canvas" | "screen";
  /** Screen-locked position: X offset in pixels relative to canvas container */
  screenX?: number;
  /** Screen-locked position: Y offset in pixels relative to canvas container */
  screenY?: number;
  /** Label node: font size in px */
  labelFontSize?: number;
  /** Label node: bold flag */
  labelBold?: boolean;
  /** Label node: italic flag */
  labelItalic?: boolean;
  /** Label node: text color (tailwind class or hex) */
  labelColor?: string;
  /** Output configuration: format, detail, count, etc. (abstract — any node can use this) */
  outputConfig?: {
    format?: "prose" | "structured" | "outline" | "academic";
    detail?: "brief" | "standard" | "detailed" | "exhaustive";
    audience?: "non-technical" | "general" | "technical" | "expert";
    tone?: "neutral" | "conversational" | "assertive" | "critical";
    focusMode?: "explore" | "verify" | "gather" | "analyze" | "synthesize" | "reason" | "deep-research";
    outputCount?: number;
    customInstruction?: string;
    outputMode?: "consolidated" | "split";
  };
  /** Output creation mode: "replace" deletes existing downstream document outputs before creating new; "new" keeps them */
  outputReplaceMode?: "replace" | "new";
  /** Pre-process hook: instruction text to transform input before execution */
  preProcess?: string;
  /** Post-process hook: instruction text to transform output after execution */
  postProcess?: string;
  /** Interview node: persisted Q&A entries */
  interviewEntries?: Array<{ id: string; question: string; answer: string; topic: string; timestamp: number }>;
  /** Interview node: objective text */
  interviewObjective?: string;
  /** Interview node: journalist config */
  interviewConfig?: {
    stance: "investigative" | "exploratory" | "balanced" | "autobiography";
    journalistDescription: string;
    voiceEnabled: boolean;
    ttsEnabled: boolean;
  };
  /** Social Post node: enabled platforms */
  socialPlatforms?: Record<string, boolean>;
  /** Social Post node: content intent */
  socialIntent?: "marketing" | "blog" | "announcement" | "thought-leadership" | "product-launch" | "event";
  /** Social Post node: tone */
  socialTone?: "professional" | "casual" | "witty" | "inspirational" | "informative";
  /** Social Post node: whether to generate images */
  socialGenerateImages?: boolean;
  /** Social Post node: generated posts per platform */
  socialGeneratedPosts?: Record<string, { text: string; imageUrl?: string; charCount: number; status: string }>;
  /** Social Post node: generation status */
  socialGenStatus?: "idle" | "generating" | "done" | "error";
  /** API Connection node: target service */
  apiService?: "x" | "linkedin" | "facebook" | "instagram" | "reddit" | "webhook" | "custom";
  /** API Connection node: auth status */
  apiAuthStatus?: "connected" | "expired" | "pending" | "error" | "none";
  /** API Connection node: last result */
  apiLastResult?: { status: string; message: string; timestamp: string; externalId?: string };
  /** API Connection node: post log */
  apiPostLog?: Array<{ platform: string; status: string; message: string; timestamp: string; externalId?: string }>;
  /** API Connection node: webhook URL for custom type */
  apiWebhookUrl?: string;
  /** API Connection node: custom headers JSON */
  apiCustomHeaders?: string;
  /** Coherence Gate: quality threshold 50-100 (default 75) */
  coherenceThreshold?: number;
  /** Coherence Gate: enabled evaluation checks */
  coherenceChecks?: {
    topicMatch?: boolean;
    toneConsistency?: boolean;
    factDrift?: boolean;
    styleMatch?: boolean;
  };
  /** Coherence Gate: custom evaluation prompt */
  coherencePrompt?: string;
  /** Coherence Gate: retry count 0-5 (default 1) */
  coherenceRetryCount?: number;
  /** Coherence Gate: strictness preset */
  coherenceStrictness?: "strict" | "medium" | "loose";
  /** Coherence Gate: last evaluation score */
  coherenceLastScore?: number;
  /** Coherence Gate: last evaluation verdict */
  coherenceLastVerdict?: "pass" | "fail";
  /** Coherence Gate: consecutive failure count */
  coherenceFailCount?: number;
  /** Coherence Gate: log on persistent fail toggle */
  coherenceLogOnPersistentFail?: boolean;
  /** Coherence Gate: persistent fail threshold (default 5) */
  coherencePersistentFailThreshold?: number;
  /** Visual config: pulse animation speed in seconds (0.5-5, default 2) */
  pulseSpeed?: number;
  /** Visual config: pulse opacity percentage (0-30, default 10) */
  pulseOpacity?: number;
  /** Visual config: running color hex (default #2196F3) */
  statusColorRunning?: string;
  /** Visual config: success color hex (default #4CAF50) */
  statusColorSuccess?: string;
  /** Visual config: failure color hex (default #F44336) */
  statusColorFailure?: string;
  /** Visual config: whether failure has been acknowledged */
  failureAcknowledged?: boolean;
}

export interface FlowEdge {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  /** Role of the connection — how the source data is used by the target */
  role?: "context" | "objective" | "output-format";
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

/** Resolve effective lock mode, handling legacy `locked` boolean */
export function getEffectiveLockMode(node: FlowNode): "none" | "canvas" | "screen" {
  if (node.lockMode) return node.lockMode;
  return node.locked ? "canvas" : "none";
}

// ── Port Configuration ──

export interface PortDef {
  side: "left" | "right";
  type: "input" | "output";
}

// NODE_PORTS and DEFAULT_DIMENSIONS are now defined in FlowNodeRegistry.ts
// and re-exported at the top of this file for backward compatibility.

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
      const dims = _DEFAULT_DIMENSIONS[type];
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
    (fromNodeId: string, toNodeId: string, role?: "context" | "objective" | "output-format"): string => {
      pushHistory();
      const id = generateId("edge");
      const edge: FlowEdge = { id, fromNodeId, toNodeId };
      if (role) edge.role = role;
      setState((s) => ({
        ...s,
        edges: [...s.edges, edge],
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

  /** Delete multiple nodes in a single undo snapshot (for batch operations like replacing outputs) */
  const deleteNodes = useCallback((nodeIds: string[]) => {
    if (nodeIds.length === 0) return;
    pushHistory();
    const idSet = new Set(nodeIds);
    setState((s) => {
      const next = new Set(s.selectedNodeIds);
      for (const id of Array.from(idSet)) next.delete(id);
      return {
        ...s,
        nodes: s.nodes.filter((n) => !idSet.has(n.id)),
        edges: s.edges.filter((e) => !idSet.has(e.fromNodeId) && !idSet.has(e.toNodeId)),
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
      // Migrate old locked: true → lockMode: "canvas"
      const nodes = (data.nodes || []).map((n: FlowNode) => {
        let node = n;
        if (node.type === "store" && node.width === 260 && node.height === 320) {
          node = { ...node, width: 200, height: 100 };
        }
        if (node.locked && !node.lockMode) {
          node = { ...node, lockMode: "canvas" };
        }
        return node;
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
    deleteNodes,
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
