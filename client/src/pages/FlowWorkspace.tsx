import { useCallback, useRef, useState, useEffect, useMemo, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { useUser } from "@clerk/clerk-react";
import { FtuxShellProvider, useFtuxShell } from "@/lib/ftux-shell-context";
import type { FtuxShellConfig, DockItem } from "@/lib/ftux-shell-context";
import { FtuxShell } from "@/components/ftux/FtuxShell";
import { FtuxStatusBar } from "@/components/ftux/FtuxStatusBar";
import { FtuxDock } from "@/components/ftux/FtuxDock";
import { FlowCanvas } from "@/components/flow/FlowCanvas";
import { useFlowCanvas } from "@/components/flow/useFlowCanvas";
import type { FlowNode, FlowEdge, FlowViewport } from "@/components/flow/useFlowCanvas";
import { useMinimapState } from "@/components/flow/useMinimapState";
import { NotebookResearchChat } from "@/components/notebook/NotebookResearchChat";
import { DEFAULT_SHELL_CONFIG } from "@/lib/ftux-shell-context";
import { useFtuxShellConfig } from "@/hooks/use-ftux-shell-config";
import { getPreset } from "@/components/flow/llm-presets";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useCanvasCollab } from "@/hooks/use-canvas-collab";
import { Button } from "@/components/ui/button";
import { ProvokeText } from "@/components/ProvokeText";
import { ShareDialog } from "@/components/ShareDialog";
import { ArtifyPanel } from "@/components/ArtifyPanel";
import { ConnectionsManager } from "@/components/ConnectionsManager";
import { FlowNodeFullscreen } from "@/components/flow/FlowNodeFullscreen";
import { FlowInterviewOverlay } from "@/components/flow/FlowInterviewOverlay";
import { FlowChainNavBar } from "@/components/flow/FlowChainNavBar";
import { FlowExpandedOverlay } from "@/components/flow/FlowExpandedOverlay";
import { FlowDetailsPanel } from "@/components/flow/FlowDetailsPanel";
import { FLOW_NODE_REGISTRY } from "@/components/flow/FlowNodeRegistry";
import { FlowLoadingBar } from "@/components/flow/FlowLoadingBar";
import { LlmExpandedView } from "@/components/flow/expanded/LlmExpandedView";
import { AudioExpandedView } from "@/components/flow/expanded/AudioExpandedView";
import { YoutubeExpandedView } from "@/components/flow/expanded/YoutubeExpandedView";
import { TimerExpandedView } from "@/components/flow/expanded/TimerExpandedView";
import { LogicExpandedView } from "@/components/flow/expanded/LogicExpandedView";
import { SocialPostExpandedView } from "@/components/flow/expanded/SocialPostExpandedView";
import { ApiConnectionExpandedView } from "@/components/flow/expanded/ApiConnectionExpandedView";
import { PlatformIntegrations } from "@/components/PlatformIntegrations";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  X, Loader2, Save, Maximize, FileText, Folder, FolderOpen, FolderInput,
  ZoomIn, ZoomOut, Lock, Unlock, ChevronDown, ChevronRight, ScanLine,
  FolderUp, FilePlus2, Share2, Expand, Shrink, AlignJustify,
  Lightbulb, Paintbrush2, PenLine, Users, Wifi, WifiOff,
  Filter, ToggleRight, GitBranch, Merge as MergeIcon, Pause, Play as PlayIcon,
  Plus, Type, Target, BookOpenCheck, LayoutTemplate,
} from "lucide-react";
import type { ChatMessageWithMeta } from "@shared/schema";

// ── Dock config ──

const FLOW_DOCK_ITEMS: DockItem[] = [
  { toolId: "context", label: "Context", icon: "BookOpen", group: "gather" },
  { toolId: "label", label: "Label", icon: "Type", group: "gather" },
  { toolId: "zone", label: "Zone", icon: "SquareDashedBottom", group: "gather" },
  { toolId: "audio", label: "Voice Capture", icon: "AudioLines", group: "gather" },
  { toolId: "youtube", label: "YouTube", icon: "Youtube", group: "gather" },
  { toolId: "research", label: "Research", icon: "Sparkles", group: "workshop" },
  { toolId: "interview", label: "Interview", icon: "MessageCircleQuestion", group: "workshop" },
  { toolId: "llm", label: "Text Mods", icon: "Brain", group: "build" },
  { toolId: "painter", label: "Painter", icon: "Paintbrush", group: "build" },
  { toolId: "timeline", label: "Timeline", icon: "Clock", group: "build" },
  { toolId: "timer-event", label: "Trigger", icon: "Timer", group: "build" },
  { toolId: "logic", label: "Logic", icon: "CircuitBoard", group: "build" },
  { toolId: "social-post", label: "Social Post", icon: "Share2", group: "build" },
  { toolId: "api-connection", label: "API Post", icon: "Wifi", group: "build" },
];

const FLOW_SHELL_CONFIG: FtuxShellConfig = {
  ...DEFAULT_SHELL_CONFIG,
  dockItems: FLOW_DOCK_ITEMS,
  dockShowLabels: true,
  dockSnapped: true,
  dockButtonSize: "large",
  dockPosition: "bottom",
  tourCompleted: true,
  tipsEnabled: false,
};

// ── Canvas themes ──

export interface CanvasThemeDef {
  key: string;
  label: string;
  description: string;
  background: string | null;  // CSS background value, null = theme default
  gridOpacity: number;        // 0-1
  gridColor: string;          // CSS color
  heroVisible: boolean;       // show BG Labs hero animation
  swatchColor: string;        // swatch preview color
}

export const CANVAS_THEMES: CanvasThemeDef[] = [
  {
    key: "aurora",
    label: "Aurora",
    description: "Animated particle field",
    background: null,
    gridOpacity: 0.2,
    gridColor: "currentColor",
    heroVisible: true,
    swatchColor: "#1a1040",
  },
  {
    key: "void",
    label: "Void",
    description: "Pure darkness, maximum contrast",
    background: "radial-gradient(ellipse at 50% 50%, #16161e 0%, #0a0a0f 70%, #050508 100%)",
    gridOpacity: 0,
    gridColor: "currentColor",
    heroVisible: false,
    swatchColor: "#0a0a0f",
  },
  {
    key: "cosmos",
    label: "Cosmos",
    description: "Sparse starfield, deep space",
    background: `radial-gradient(ellipse at 50% 50%, #0d0d18 0%, #06060c 100%), url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='400'%3E%3Ccircle cx='23' cy='67' r='0.5' fill='%23ffffff18'/%3E%3Ccircle cx='187' cy='23' r='0.4' fill='%23ffffff12'/%3E%3Ccircle cx='321' cy='89' r='0.6' fill='%23ffffff15'/%3E%3Ccircle cx='67' cy='234' r='0.3' fill='%23ffffff10'/%3E%3Ccircle cx='289' cy='178' r='0.5' fill='%23ffffff14'/%3E%3Ccircle cx='134' cy='312' r='0.4' fill='%23ffffff11'/%3E%3Ccircle cx='356' cy='267' r='0.5' fill='%23ffffff13'/%3E%3Ccircle cx='78' cy='378' r='0.3' fill='%23ffffff10'/%3E%3Ccircle cx='234' cy='345' r='0.6' fill='%23ffffff16'/%3E%3Ccircle cx='167' cy='145' r='0.4' fill='%23ffffff12'/%3E%3Ccircle cx='390' cy='390' r='0.3' fill='%23ffffff10'/%3E%3Ccircle cx='45' cy='156' r='0.5' fill='%23ffffff14'/%3E%3C/svg%3E")`,
    gridOpacity: 0,
    gridColor: "currentColor",
    heroVisible: false,
    swatchColor: "#0d0d18",
  },
  {
    key: "drafting",
    label: "Drafting",
    description: "Technical drafting board",
    background: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='80'%3E%3Crect width='80' height='80' fill='%230a1628'/%3E%3Cpath d='M80 0L0 0 0 80' fill='none' stroke='%23ffffff06' stroke-width='0.5'/%3E%3C/svg%3E")`,
    gridOpacity: 0.3,
    gridColor: "#4488cc",
    heroVisible: false,
    swatchColor: "#0a1628",
  },
  {
    key: "parchment",
    label: "Parchment",
    description: "Aged paper, warm tone",
    background: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='200' height='200' fill='%23140f0a'/%3E%3Crect width='200' height='200' filter='url(%23n)' opacity='0.03'/%3E%3C/svg%3E")`,
    gridOpacity: 0.15,
    gridColor: "#8b7355",
    heroVisible: false,
    swatchColor: "#140f0a",
  },
  {
    key: "mist",
    label: "Mist",
    description: "Atmospheric fog, soft depth",
    background: "radial-gradient(ellipse at 0% 0%, #0f1a2208 0%, transparent 50%), radial-gradient(ellipse at 100% 100%, #0f1a2208 0%, transparent 50%), radial-gradient(ellipse at 50% 50%, #0e1117 0%, #080a0f 100%)",
    gridOpacity: 0.12,
    gridColor: "#6688aa",
    heroVisible: false,
    swatchColor: "#0e1117",
  },
  {
    key: "graphite",
    label: "Graphite",
    description: "Industrial matte surface",
    background: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Cfilter id='g'%3E%3CfeTurbulence type='turbulence' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='100' height='100' fill='%23121215'/%3E%3Crect width='100' height='100' filter='url(%23g)' opacity='0.04'/%3E%3C/svg%3E")`,
    gridOpacity: 0.15,
    gridColor: "currentColor",
    heroVisible: false,
    swatchColor: "#121215",
  },
  {
    key: "none",
    label: "None",
    description: "Clean, no distraction",
    background: null,
    gridOpacity: 0.2,
    gridColor: "currentColor",
    heroVisible: false,
    swatchColor: "#1a1a1a",
  },
];

// ── Document list item type ──

interface DocumentListItem {
  id: number;
  title: string;
  docType?: string;
  folderId?: number | null;
}

interface FolderItem {
  id: number;
  name: string;
  parentFolderId: number | null;
}

function treeIndent(depth: number): number {
  if (depth === 0) return 0;
  let px = 0;
  for (let i = 1; i <= depth; i++) {
    if (i <= 4) px += 14;
    else if (i <= 7) px += 10;
    else px += 7;
  }
  return px;
}

// ── Document editor tool buttons ──

const DOC_TOOLS = [
  { id: "expand", label: "Expand", icon: Expand, instruction: "Expand this text with more depth, examples, and supporting details" },
  { id: "condense", label: "Condense", icon: Shrink, instruction: "Remove redundancy, tighten prose, make concise" },
  { id: "restructure", label: "Restructure", icon: AlignJustify, instruction: "Reorganize content, improve headings and section order" },
  { id: "clarify", label: "Clarify", icon: Lightbulb, instruction: "Simplify language, improve accessibility and clarity" },
  { id: "style", label: "Style", icon: Paintbrush2, instruction: "Adjust voice and tone for better reading experience" },
  { id: "correct", label: "Correct", icon: PenLine, instruction: "Fix grammar, spelling, logic errors, and inconsistencies" },
];

/** Split output text into N sections by markdown headings, falling back to equal chunks */
function splitOutputIntoSections(text: string, count: number): string[] {
  // Try splitting by markdown headings (## or #)
  const headingRegex = /^#{1,3}\s+/m;
  const parts = text.split(headingRegex).filter((s) => s.trim());

  if (parts.length >= count) {
    // Re-attach heading markers and distribute
    const sections: string[] = [];
    const step = Math.ceil(parts.length / count);
    for (let i = 0; i < count; i++) {
      sections.push(parts.slice(i * step, (i + 1) * step).join("\n\n## ").trim());
    }
    return sections;
  }

  // Try splitting by horizontal rules (---)
  const hrParts = text.split(/\n---+\n/).filter((s) => s.trim());
  if (hrParts.length >= count) {
    const sections: string[] = [];
    const step = Math.ceil(hrParts.length / count);
    for (let i = 0; i < count; i++) {
      sections.push(hrParts.slice(i * step, (i + 1) * step).join("\n\n---\n\n").trim());
    }
    return sections;
  }

  // Fallback: split by paragraphs (double newlines), distribute evenly
  const paragraphs = text.split(/\n\n+/).filter((s) => s.trim());
  if (paragraphs.length >= count) {
    const sections: string[] = [];
    const step = Math.ceil(paragraphs.length / count);
    for (let i = 0; i < count; i++) {
      sections.push(paragraphs.slice(i * step, (i + 1) * step).join("\n\n").trim());
    }
    return sections;
  }

  // Last resort: equal character chunks
  const chunkSize = Math.ceil(text.length / count);
  const sections: string[] = [];
  for (let i = 0; i < count; i++) {
    const chunk = text.slice(i * chunkSize, (i + 1) * chunkSize).trim();
    if (chunk) sections.push(chunk);
  }
  return sections;
}

// ── Inner workspace (needs shell context) ──

function FlowWorkspaceInner() {
  const { activeTool, setActiveTool, dockItems, dockHidden, canvasFontSize, canvasFontColor, canvasBgColor, canvasTheme, setCanvasTheme } = useFtuxShell();
  const {
    state, addNode, addEdge, updateNode, pushUndoSnapshot, moveNode, moveNodes, deleteNode, deleteEdge,
    selectNode, selectNodes, selectAll, toggleSelectNode, setViewport, loadCanvas, resetCanvas,
    undo, redo,
  } = useFlowCanvas();
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const { user } = useUser();
  const minimapState = useMinimapState();

  // Fit all nodes into the viewport
  const fitToView = useCallback(() => {
    const nodes = state.nodes;
    if (nodes.length === 0) return;
    const el = canvasContainerRef.current;
    const W = el?.clientWidth ?? 800;
    const H = el?.clientHeight ?? 600;
    const PAD = 60;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const n of nodes) {
      minX = Math.min(minX, n.x);
      minY = Math.min(minY, n.y);
      maxX = Math.max(maxX, n.x + n.width);
      maxY = Math.max(maxY, n.y + n.height);
    }
    const worldW = maxX - minX + PAD * 2;
    const worldH = maxY - minY + PAD * 2;
    const zoom = Math.min(W / worldW, H / worldH, 2);
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    setViewport(W / 2 - centerX * zoom, H / 2 - centerY * zoom, zoom);
  }, [state.nodes, setViewport]);

  // Track mouse position over canvas for dock-shortcut placement
  const mousePosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      mousePosRef.current = { x: e.clientX, y: e.clientY };
    };
    window.addEventListener("mousemove", handler);
    return () => window.removeEventListener("mousemove", handler);
  }, []);

  // Listen for blueprint events from dock
  useEffect(() => {
    const onSave = () => handleSaveBlueprintRef.current();
    const onLoad = () => handleLoadBlueprintRef.current();
    window.addEventListener("flow:save-blueprint", onSave);
    window.addEventListener("flow:load-blueprint", onLoad);
    return () => {
      window.removeEventListener("flow:save-blueprint", onSave);
      window.removeEventListener("flow:load-blueprint", onLoad);
    };
  }, []);

  // Listen for label settings event (gear button on label nodes)
  useEffect(() => {
    const handler = (e: Event) => {
      const nodeId = (e as CustomEvent).detail?.nodeId;
      if (nodeId) setActiveLabelNodeId(nodeId);
    };
    window.addEventListener("flow:open-label-settings", handler);
    return () => window.removeEventListener("flow:open-label-settings", handler);
  }, []);

  /** Convert current mouse screen position to canvas coordinates */
  const getCanvasPosAtMouse = useCallback(() => {
    const el = canvasContainerRef.current;
    const rect = el?.getBoundingClientRect();
    const s = stateRef.current;
    if (!rect) {
      // Fallback to center
      const w = el?.clientWidth ?? 800;
      const h = el?.clientHeight ?? 600;
      return {
        x: (-s.viewport.x + w / 2) / s.viewport.zoom,
        y: (-s.viewport.y + h / 2) / s.viewport.zoom,
      };
    }
    return {
      x: (mousePosRef.current.x - rect.left - s.viewport.x) / s.viewport.zoom,
      y: (mousePosRef.current.y - rect.top - s.viewport.y) / s.viewport.zoom,
    };
  }, []);

  // ── Unified overlay state (replaces 7 individual overlay state variables) ──
  const [activeExpandedNodeId, setActiveExpandedNodeId] = useState<string | null>(null);
  const [expandSourceRect, setExpandSourceRect] = useState<DOMRect | null>(null);
  // Legacy overlay states kept for dialog-based overlays (not full-screen)
  const [activeLabelNodeId, setActiveLabelNodeId] = useState<string | null>(null);
  const [pendingLogicAction, setPendingLogicAction] = useState<{ x: number; y: number; screenX: number; screenY: number } | null>(null);
  const [pendingEdgeRole, setPendingEdgeRole] = useState<{ fromNodeId: string; toNodeId: string } | null>(null);
  const [detailsPanelOpen, setDetailsPanelOpen] = useState(false);
  const [docEditorContent, setDocEditorContent] = useState("");
  const [docToolRunning, setDocToolRunning] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [canvasLoading, setCanvasLoading] = useState(false);
  const [loadProgress, setLoadProgress] = useState<number | undefined>(undefined);
  const [frozen, setFrozen] = useState(false);
  // Resolve the active canvas theme
  const activeTheme = CANVAS_THEMES.find((t) => t.key === canvasTheme) ?? CANVAS_THEMES[0];
  const [storeFolderPickerNodeId, setStoreFolderPickerNodeId] = useState<string | null>(null);
  const [pickerExpandedFolders, setPickerExpandedFolders] = useState<Set<number>>(new Set());

  // Sync hero div visibility with canvas theme
  useEffect(() => {
    const hero = document.getElementById("hero");
    if (hero) {
      hero.style.display = activeTheme.heroVisible ? "" : "none";
    }
  }, [activeTheme.heroVisible]);
  const [canvasDocumentId, setCanvasDocumentId] = useState<number | null>(() => {
    try {
      const stored = localStorage.getItem("flow:lastCanvasId");
      return stored ? parseInt(stored, 10) : null;
    } catch { return null; }
  });
  const [canvasTitle, setCanvasTitle] = useState(() => {
    try { return localStorage.getItem("flow:lastCanvasTitle") || ""; } catch { return ""; }
  });
  const [openCanvasDialogOpen, setOpenCanvasDialogOpen] = useState(false);
  const [connectionsDialogOpen, setConnectionsDialogOpen] = useState(false);
  const [integrationsDialogOpen, setIntegrationsDialogOpen] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [collabEnabled, setCollabEnabled] = useState(false);
  const [pendingContextAction, setPendingContextAction] = useState<{ x: number; y: number; mode?: "load" | "save" } | null>(null);

  // ── Workspace tabs ──
  type WorkspaceTab = { id: string; label: string; snapshot: { nodes: FlowNode[]; edges: FlowEdge[]; viewport: FlowViewport } };
  const [workspaceTabs, setWorkspaceTabs] = useState<WorkspaceTab[]>([
    { id: "main", label: "Canvas 1", snapshot: { nodes: [], edges: [], viewport: { x: 0, y: 0, zoom: 1 } } },
  ]);
  const [activeTabId, setActiveTabId] = useState("main");
  const [editingTabId, setEditingTabId] = useState<string | null>(null);

  const switchTab = useCallback((targetTabId: string) => {
    if (targetTabId === activeTabId) return;
    // Save current state to the current tab's snapshot
    setWorkspaceTabs((tabs) =>
      tabs.map((t) =>
        t.id === activeTabId
          ? { ...t, snapshot: { nodes: state.nodes, edges: state.edges, viewport: state.viewport } }
          : t,
      ),
    );
    // Load target tab state
    const target = workspaceTabs.find((t) => t.id === targetTabId);
    if (target) {
      loadCanvas(target.snapshot);
    }
    setActiveTabId(targetTabId);
  }, [activeTabId, state, workspaceTabs, loadCanvas]);

  const addTab = useCallback(() => {
    const id = `tab-${Date.now()}`;
    const num = workspaceTabs.length + 1;
    // Save current state first
    setWorkspaceTabs((tabs) => [
      ...tabs.map((t) =>
        t.id === activeTabId
          ? { ...t, snapshot: { nodes: state.nodes, edges: state.edges, viewport: state.viewport } }
          : t,
      ),
      { id, label: `Canvas ${num}`, snapshot: { nodes: [], edges: [], viewport: { x: 0, y: 0, zoom: 1 } } },
    ]);
    resetCanvas();
    setActiveTabId(id);
  }, [workspaceTabs, activeTabId, state, resetCanvas]);

  const closeTab = useCallback((tabId: string) => {
    if (workspaceTabs.length <= 1) return; // Don't close the last tab
    setWorkspaceTabs((tabs) => {
      const remaining = tabs.filter((t) => t.id !== tabId);
      if (tabId === activeTabId) {
        // Switch to the first remaining tab
        const target = remaining[0];
        loadCanvas(target.snapshot);
        setActiveTabId(target.id);
      }
      return remaining;
    });
  }, [workspaceTabs, activeTabId, loadCanvas]);

  const renameTab = useCallback((tabId: string, newLabel: string) => {
    setWorkspaceTabs((tabs) =>
      tabs.map((t) => (t.id === tabId ? { ...t, label: newLabel || t.label } : t)),
    );
    setEditingTabId(null);
  }, []);

  // ── Refs for accessing latest state/callbacks in keyboard handlers ──

  const stateRef = useRef(state);
  stateRef.current = state;
  const minimapStateRef = useRef(minimapState);
  minimapStateRef.current = minimapState;

  // Ref to handleDropTool so keyboard shortcuts can call it (declared later)
  const handleDropToolRef = useRef<(toolId: string, cx: number, cy: number) => void>(() => {});
  const handleSaveBlueprintRef = useRef<() => void>(() => {});
  const handleLoadBlueprintRef = useRef<() => void>(() => {});

  // ── Real-time collaboration ──

  const collabStateRef = useRef(state);
  collabStateRef.current = state;

  const handleRemoteOperation = useCallback(
    (op: { type: string; payload: Record<string, unknown>; senderId: string }) => {
      if (op.senderId === user?.id) return; // ignore own echoes
      if (op.type === "add-node" && op.payload.node) {
        const node = op.payload.node as FlowNode;
        addNode(node.type, node.x, node.y, {
          label: node.label,
          snippet: node.snippet,
          content: node.content,
          documentContent: node.documentContent,
          zoneLabel: node.zoneLabel,
          zoneColor: node.zoneColor,
        });
      } else if (op.type === "move-node" && op.payload.nodeId) {
        moveNode(op.payload.nodeId as string, op.payload.x as number, op.payload.y as number);
      } else if (op.type === "delete-node" && op.payload.nodeId) {
        deleteNode(op.payload.nodeId as string);
      } else if (op.type === "add-edge" && op.payload.fromNodeId && op.payload.toNodeId) {
        addEdge(op.payload.fromNodeId as string, op.payload.toNodeId as string);
      } else if (op.type === "update-node" && op.payload.nodeId) {
        const { nodeId, ...updates } = op.payload;
        updateNode(nodeId as string, updates as Partial<FlowNode>);
      }
    },
    [user?.id, addNode, moveNode, deleteNode, addEdge, updateNode],
  );

  const handleFullSync = useCallback(
    (syncState: { nodes: FlowNode[]; edges: FlowEdge[]; viewport: FlowViewport }) => {
      loadCanvas(syncState);
    },
    [loadCanvas],
  );

  const { connected: collabConnected, members: collabMembers, sendOperation, sendFullSync } = useCanvasCollab({
    canvasId: collabEnabled ? canvasDocumentId : null,
    userId: user?.id ?? null,
    displayName: user?.fullName || user?.firstName || "Anonymous",
    enabled: collabEnabled && !!canvasDocumentId,
    onRemoteOperation: handleRemoteOperation,
    onFullSync: handleFullSync,
  });

  // Send full sync when we first connect as the canvas owner
  const sentInitialSync = useRef(false);
  useEffect(() => {
    if (collabConnected && !sentInitialSync.current && state.nodes.length > 0) {
      sendFullSync({ nodes: state.nodes, edges: state.edges, viewport: state.viewport });
      sentInitialSync.current = true;
    }
    if (!collabConnected) {
      sentInitialSync.current = false;
    }
  }, [collabConnected, state.nodes, state.edges, state.viewport, sendFullSync]);

  // ── Keyboard shortcuts: 1-9 → dock items (placed at mouse cursor) ──

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input/textarea/contenteditable
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement)?.isContentEditable) return;
      // Don't trigger with modifier keys
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      // If context action menu is open, 1/2/3 pick from it
      if (pendingContextAction && !pendingContextAction.mode) {
        if (e.key === "1") {
          const pos = pendingContextAction;
          addNode("document", pos.x, pos.y, {
            label: "New Document",
            snippet: "Double-click to edit",
            documentContent: "",
          });
          setPendingContextAction(null);
          e.preventDefault();
          return;
        }
        if (e.key === "2") {
          setPendingContextAction({ ...pendingContextAction, mode: "load" });
          e.preventDefault();
          return;
        }
        if (e.key === "3") {
          setPendingContextAction({ ...pendingContextAction, mode: "save" });
          e.preventDefault();
          return;
        }
      }

      // If logic picker is open, 1-4 picks the type
      if (pendingLogicAction) {
        const logicTypes: Array<{ type: "filter" | "gate" | "router" | "merge"; label: string; snippet: string }> = [
          { type: "filter", label: "Filter", snippet: "Pass through if condition met" },
          { type: "gate", label: "Gate", snippet: "Manual on/off switch" },
          { type: "router", label: "Router", snippet: "Route to outputs by condition" },
          { type: "merge", label: "Merge", snippet: "Combine multiple inputs" },
        ];
        const idx = parseInt(e.key, 10) - 1;
        if (idx >= 0 && idx < logicTypes.length) {
          const lt = logicTypes[idx];
          addNode(lt.type, pendingLogicAction.x, pendingLogicAction.y, {
            label: lt.label,
            snippet: lt.snippet,
            ...(lt.type === "gate" ? { gateOpen: true } : {}),
          });
          setPendingLogicAction(null);
          e.preventDefault();
          return;
        }
      }

      const num = parseInt(e.key, 10);
      if (num >= 1 && num <= 9) {
        const index = num - 1;
        if (index < dockItems.length) {
          // Place at mouse cursor position instead of center
          const pos = getCanvasPosAtMouse();
          const toolId = dockItems[index].toolId;
          handleDropToolRef.current(toolId, pos.x, pos.y);
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [dockItems, pendingContextAction, pendingLogicAction, addNode, getCanvasPosAtMouse]);

  // ── Copy-paste, undo/redo, select all, escape ──

  const clipboardRef = useRef<{ nodes: FlowNode[]; edges: FlowEdge[] } | null>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement)?.isContentEditable) return;

      // Ctrl+Z — undo
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        undo();
        e.preventDefault();
        return;
      }

      // Ctrl+Shift+Z or Ctrl+Y — redo
      if ((e.ctrlKey || e.metaKey) && ((e.key === "z" && e.shiftKey) || e.key === "y")) {
        redo();
        e.preventDefault();
        return;
      }

      // Ctrl+A — select all
      if ((e.ctrlKey || e.metaKey) && e.key === "a") {
        selectAll();
        e.preventDefault();
        return;
      }

      // M — toggle minimap
      if (e.key === "m" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        minimapStateRef.current.toggleVisible();
        e.preventDefault();
        return;
      }

      // Escape — deselect all
      if (e.key === "Escape") {
        selectNode(null);
        return;
      }

      // Ctrl+C — copy selected nodes
      if ((e.ctrlKey || e.metaKey) && e.key === "c") {
        const selected = stateRef.current.nodes.filter((n) => stateRef.current.selectedNodeIds.has(n.id));
        if (selected.length === 0) return;
        const selectedIds = new Set(selected.map((n) => n.id));
        const internalEdges = stateRef.current.edges.filter(
          (e) => selectedIds.has(e.fromNodeId) && selectedIds.has(e.toNodeId),
        );
        clipboardRef.current = { nodes: selected, edges: internalEdges };
        toast({ title: `Copied ${selected.length} node${selected.length > 1 ? "s" : ""}` });
        e.preventDefault();
      }

      // Ctrl+V — paste at mouse position
      if ((e.ctrlKey || e.metaKey) && e.key === "v" && clipboardRef.current) {
        const { nodes: srcNodes, edges: srcEdges } = clipboardRef.current;
        const idMap = new Map<string, string>();

        // Compute bounding box center of source nodes
        const minX = Math.min(...srcNodes.map((n) => n.x));
        const minY = Math.min(...srcNodes.map((n) => n.y));
        const maxX = Math.max(...srcNodes.map((n) => n.x + n.width));
        const maxY = Math.max(...srcNodes.map((n) => n.y + n.height));
        const srcCenterX = (minX + maxX) / 2;
        const srcCenterY = (minY + maxY) / 2;

        // Paste at mouse position (canvas coords)
        const target = getCanvasPosAtMouse();
        const offsetX = target.x - srcCenterX;
        const offsetY = target.y - srcCenterY;

        // Create new nodes offset to mouse position
        for (const src of srcNodes) {
          const newId = addNode(src.type, src.x + src.width / 2 + offsetX, src.y + src.height / 2 + offsetY, {
            label: src.label,
            snippet: src.snippet,
            content: src.content,
            documentContent: src.documentContent,
            documentObjective: src.documentObjective,
            zoneLabel: src.zoneLabel,
            zoneColor: src.zoneColor,
            llmPresetId: src.llmPresetId,
            llmObjective: src.llmObjective,
            llmStatus: "idle",
            audioTranscript: src.audioTranscript,
            imageUrl: src.imageUrl,
          });
          idMap.set(src.id, newId);
        }

        // Recreate internal edges
        for (const edge of srcEdges) {
          const newFrom = idMap.get(edge.fromNodeId);
          const newTo = idMap.get(edge.toNodeId);
          if (newFrom && newTo) {
            addEdge(newFrom, newTo);
          }
        }

        // Select the pasted nodes
        selectNodes(Array.from(idMap.values()));
        toast({ title: `Pasted ${srcNodes.length} node${srcNodes.length > 1 ? "s" : ""}` });
        e.preventDefault();
      }

      // Delete key — remove selected nodes
      if (e.key === "Delete" || e.key === "Backspace") {
        const selected = Array.from(stateRef.current.selectedNodeIds);
        for (const id of selected) {
          deleteNode(id);
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [addNode, addEdge, deleteNode, selectNode, selectNodes, selectAll, undo, redo, toast]);

  // ── Keyboard zoom: +/- with progressive acceleration when held ──

  useEffect(() => {
    const ZOOM_MIN = 0.1;
    const ZOOM_MAX = 4;
    // Progressive: starts at 1.08 (8%), accelerates to 1.35 (35%) over ~1.5s of holding
    const BASE_FACTOR = 1.08;
    const MAX_FACTOR = 1.35;
    const ACCEL_PER_TICK = 0.015;
    const INTERVAL_MS = 60;

    let activeKey: string | null = null;
    let intervalId: ReturnType<typeof setInterval> | null = null;
    let currentFactor = BASE_FACTOR;

    function applyZoom(direction: "in" | "out") {
      const s = stateRef.current;
      const el = canvasContainerRef.current;
      const w = el?.clientWidth ?? 800;
      const h = el?.clientHeight ?? 600;
      // Zoom centered on viewport center
      const centerX = w / 2;
      const centerY = h / 2;
      const factor = direction === "in" ? currentFactor : 1 / currentFactor;
      const newZoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, s.viewport.zoom * factor));
      const newX = centerX - (centerX - s.viewport.x) * (newZoom / s.viewport.zoom);
      const newY = centerY - (centerY - s.viewport.y) * (newZoom / s.viewport.zoom);
      setViewport(newX, newY, newZoom);
      // Accelerate for next tick
      currentFactor = Math.min(MAX_FACTOR, currentFactor + ACCEL_PER_TICK);
    }

    function startZoom(key: string) {
      if (activeKey) return;
      activeKey = key;
      currentFactor = BASE_FACTOR;
      const dir = key === "=" || key === "+" ? "in" : "out";
      applyZoom(dir);
      intervalId = setInterval(() => applyZoom(dir), INTERVAL_MS);
    }

    function stopZoom() {
      activeKey = null;
      currentFactor = BASE_FACTOR;
      if (intervalId) { clearInterval(intervalId); intervalId = null; }
    }

    const onDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement)?.isContentEditable) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if ((e.key === "=" || e.key === "+" || e.key === "-") && !e.repeat) {
        e.preventDefault();
        startZoom(e.key);
      }
    };

    const onUp = (e: KeyboardEvent) => {
      if (e.key === "=" || e.key === "+" || e.key === "-") {
        stopZoom();
      }
    };

    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
      stopZoom();
    };
  }, [setViewport]);

  // ── Helper: compute canvas center for placing new nodes ──

  const getCenter = useCallback(() => {
    const s = stateRef.current;
    const el = canvasContainerRef.current;
    const w = el?.clientWidth ?? 800;
    const h = el?.clientHeight ?? 600;
    const offset = s.nodes.length * 30;
    return {
      x: (-s.viewport.x + w / 2) / s.viewport.zoom + offset,
      y: (-s.viewport.y + h / 2) / s.viewport.zoom + offset,
    };
  }, []);

  // ── Blueprint save/load (localStorage) ──

  const handleSaveBlueprint = useCallback(() => {
    const selected = state.nodes.filter((n) => state.selectedNodeIds.has(n.id));
    if (selected.length === 0) {
      toast({ title: "Select nodes first", description: "Select nodes to save as a blueprint" });
      return;
    }
    const selectedIds = new Set(selected.map((n) => n.id));
    const internalEdges = state.edges.filter(
      (e) => selectedIds.has(e.fromNodeId) && selectedIds.has(e.toNodeId),
    );
    const name = prompt("Blueprint name:");
    if (!name) return;

    // Normalize positions relative to top-left of selection
    const minX = Math.min(...selected.map((n) => n.x));
    const minY = Math.min(...selected.map((n) => n.y));
    const normalizedNodes = selected.map((n) => ({ ...n, x: n.x - minX, y: n.y - minY }));

    const blueprints = JSON.parse(localStorage.getItem("flow-blueprints") || "{}");
    blueprints[name] = { nodes: normalizedNodes, edges: internalEdges };
    localStorage.setItem("flow-blueprints", JSON.stringify(blueprints));
    toast({ title: "Blueprint saved", description: `"${name}" — ${selected.length} nodes` });
  }, [state.nodes, state.edges, state.selectedNodeIds, toast]);

  const handleLoadBlueprint = useCallback(() => {
    const blueprints = JSON.parse(localStorage.getItem("flow-blueprints") || "{}");
    const names = Object.keys(blueprints);
    if (names.length === 0) {
      toast({ title: "No blueprints", description: "Save a selection as a blueprint first" });
      return;
    }
    const name = prompt(`Load blueprint:\n${names.map((n, i) => `${i + 1}. ${n}`).join("\n")}\n\nEnter name:`);
    if (!name || !blueprints[name]) return;

    const { nodes: srcNodes, edges: srcEdges } = blueprints[name];
    const pos = getCenter();
    const idMap = new Map<string, string>();

    for (const src of srcNodes as FlowNode[]) {
      const newId = addNode(src.type, pos.x + src.x, pos.y + src.y, {
        label: src.label,
        snippet: src.snippet,
        content: src.content,
        documentContent: src.documentContent,
        zoneLabel: src.zoneLabel,
        zoneColor: src.zoneColor,
        llmPresetId: src.llmPresetId,
        llmObjective: src.llmObjective,
        llmStatus: "idle",
      });
      idMap.set(src.id, newId);
    }

    for (const edge of srcEdges as FlowEdge[]) {
      const newFrom = idMap.get(edge.fromNodeId);
      const newTo = idMap.get(edge.toNodeId);
      if (newFrom && newTo) addEdge(newFrom, newTo);
    }

    toast({ title: "Blueprint loaded", description: `"${name}" placed on canvas` });
  }, [addNode, addEdge, getCenter, toast]);

  handleSaveBlueprintRef.current = handleSaveBlueprint;
  handleLoadBlueprintRef.current = handleLoadBlueprint;

  // ── Persist last-used canvas ID to localStorage ──
  useEffect(() => {
    try {
      if (canvasDocumentId) {
        localStorage.setItem("flow:lastCanvasId", String(canvasDocumentId));
        localStorage.setItem("flow:lastCanvasTitle", canvasTitle || "");
      } else {
        localStorage.removeItem("flow:lastCanvasId");
        localStorage.removeItem("flow:lastCanvasTitle");
      }
    } catch { /* localStorage unavailable */ }
  }, [canvasDocumentId, canvasTitle]);

  // ── Auto-load last canvas on mount ──
  const autoLoadedRef = useRef(false);
  useEffect(() => {
    if (autoLoadedRef.current) return;
    if (!canvasDocumentId) return;
    if (state.nodes.length > 0) return; // Already has content
    autoLoadedRef.current = true;
    (async () => {
      setCanvasLoading(true);
      setLoadProgress(20);
      try {
        const res = await apiRequest("GET", `/api/documents/${canvasDocumentId}`);
        setLoadProgress(60);
        const data = (await res.json()) as { title: string; content: string };
        setLoadProgress(80);
        const parsed = JSON.parse(data.content);
        setLoadProgress(90);
        loadCanvas(parsed);
        setLoadProgress(100);
        setCanvasTitle(data.title || canvasTitle);
      } catch {
        // Canvas no longer exists — clear the stored ID
        setCanvasDocumentId(null);
      } finally {
        setCanvasLoading(false);
        setLoadProgress(undefined);
      }
    })();
  }, [canvasDocumentId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Auto-save every 5 minutes ──
  // Saves canvas to a "Canvas Auto-saves" system folder in the Context Store.
  // Hourly saves are kept permanently; 5-min saves are purged after 1 hour.

  const autoSaveTimerRef = useRef<ReturnType<typeof setInterval>>();
  const lastHourlySaveRef = useRef(0);
  const autoSaveFolderIdRef = useRef<number | null>(null);
  const latest5MinDocIdRef = useRef<number | null>(null);

  useEffect(() => {
    // Ensure the system folder exists (create once, cache the ID)
    const ensureFolder = async () => {
      if (autoSaveFolderIdRef.current) return autoSaveFolderIdRef.current;
      try {
        const res = await apiRequest("GET", "/api/folders?parentFolderId=null");
        const folders = await res.json();
        const existing = folders.find((f: { name: string }) => f.name === "Canvas Auto-saves");
        if (existing) {
          autoSaveFolderIdRef.current = existing.id;
          return existing.id;
        }
        const createRes = await apiRequest("POST", "/api/folders", {
          name: "Canvas Auto-saves",
          parentFolderId: null,
        });
        const created = await createRes.json();
        autoSaveFolderIdRef.current = created.id;
        return created.id;
      } catch {
        return null;
      }
    };

    autoSaveTimerRef.current = setInterval(async () => {
      const s = stateRef.current;
      if (s.nodes.length === 0) return;

      const folderId = await ensureFolder();
      if (!folderId) return;

      const now = Date.now();
      const contentNodes = s.nodes.filter((n) => n.type !== "store");
      const canvasData = { nodes: contentNodes, edges: s.edges, viewport: s.viewport };
      const time = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      const date = new Date().toLocaleDateString();
      const isHourlySave = now - lastHourlySaveRef.current >= 3600_000;
      const label = canvasTitle || "Untitled Canvas";

      try {
        if (isHourlySave) {
          // Hourly save: always create a new document (kept permanently)
          await apiRequest("POST", "/api/documents", {
            title: `[Hourly] ${label} — ${date} ${time}`,
            content: JSON.stringify(canvasData),
            folderId,
            docType: "chart",
          });
          lastHourlySaveRef.current = now;

          // Purge 5-min saves older than 1 hour from the folder
          try {
            const docsRes = await apiRequest("GET", "/api/documents");
            const allDocs = await docsRes.json();
            const oneHourAgo = now - 3600_000;
            const old5Min = allDocs.filter(
              (d: { title: string; folderId: number | null; updatedAt: string }) =>
                d.folderId === folderId &&
                d.title?.startsWith("[5min]") &&
                new Date(d.updatedAt).getTime() < oneHourAgo,
            );
            for (const doc of old5Min) {
              await apiRequest("DELETE", `/api/documents/${doc.id}`).catch(() => {});
            }
          } catch {
            // Silent — purge failure is non-critical
          }

          // Reset the 5-min doc so next cycle creates a fresh one
          latest5MinDocIdRef.current = null;
        } else {
          // 5-min save: overwrite the current 5-min document, or create a new one
          if (latest5MinDocIdRef.current) {
            await apiRequest("PUT", `/api/documents/${latest5MinDocIdRef.current}`, {
              title: `[5min] ${label} — ${date} ${time}`,
              content: JSON.stringify(canvasData),
            });
          } else {
            const res = await apiRequest("POST", "/api/documents", {
              title: `[5min] ${label} — ${date} ${time}`,
              content: JSON.stringify(canvasData),
              folderId,
              docType: "chart",
            });
            const created = await res.json();
            latest5MinDocIdRef.current = created.id;
          }
        }

        // Also update the main canvas document if we have one
        if (canvasDocumentId) {
          await apiRequest("PUT", `/api/documents/${canvasDocumentId}`, {
            title: canvasTitle || "Flow Canvas",
            content: JSON.stringify(canvasData),
          }).catch(() => {});
        }
      } catch {
        // Silent fail — auto-save should never break the UI
      }
    }, 5 * 60 * 1000); // 5 minutes

    return () => {
      if (autoSaveTimerRef.current) clearInterval(autoSaveTimerRef.current);
    };
  }, [canvasDocumentId, canvasTitle]);

  // ── Document list for picker ──

  const { data: docsData } = useQuery<{ documents: DocumentListItem[] }>({
    queryKey: ["/api/documents"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/documents");
      return res.json();
    },
    staleTime: 30_000,
  });

  const { data: foldersData } = useQuery<FolderItem[]>({
    queryKey: ["/api/folders"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/folders");
      const data = await res.json();
      return data.folders ?? data;
    },
    staleTime: 30_000,
  });

  const docs = docsData?.documents ?? [];
  const allFolders = foldersData ?? [];
  const canvasDocs = docs.filter((d) => d.docType === "chart");

  // Tree helpers for document picker and folder picker dialogs
  const pickerRootFolders = allFolders.filter((f) => f.parentFolderId === null);
  const getPickerChildren = (parentId: number) => allFolders.filter((f) => f.parentFolderId === parentId);
  const getPickerDocsInFolder = (folderId: number | null) =>
    docs.filter((d) => (folderId === null ? !d.folderId : d.folderId === folderId));
  const pickerRootDocs = getPickerDocsInFolder(null);

  // ── Intercept dock clicks — place at mouse cursor ──

  useEffect(() => {
    if (!activeTool) return;
    setActiveTool(null);
    // If mouse is outside the canvas (e.g. clicked from status bar), place at center
    const rect = canvasContainerRef.current?.getBoundingClientRect();
    const mx = mousePosRef.current.x;
    const my = mousePosRef.current.y;
    const inCanvas = rect && mx >= rect.left && mx <= rect.right && my >= rect.top && my <= rect.bottom;
    const pos = inCanvas ? getCanvasPosAtMouse() : getPlacementCenter();
    handleDropToolRef.current(activeTool, pos.x, pos.y);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTool]);

  // ── Placement helper ──

  const getPlacementCenter = useCallback(() => {
    const el = canvasContainerRef.current;
    const w = el?.clientWidth ?? 800;
    const h = el?.clientHeight ?? 600;
    return {
      x: (-state.viewport.x + w / 2) / state.viewport.zoom,
      y: (-state.viewport.y + h / 2) / state.viewport.zoom,
    };
  }, [state.viewport]);

  // ── Helper: get the active research node ID (if the currently expanded node is research) ──
  const activeResearchNodeId = useMemo(() => {
    if (!activeExpandedNodeId) return null;
    const n = state.nodes.find((nd) => nd.id === activeExpandedNodeId);
    return n?.type === "research" ? activeExpandedNodeId : null;
  }, [activeExpandedNodeId, state.nodes]);

  // ── Research overlay: "Send to Notes" → creates document + edge ──

  const handleResearchCapture = useCallback(
    (text: string, label: string) => {
      let docX: number, docY: number;
      if (activeResearchNodeId) {
        const researchNode = stateRef.current.nodes.find((n) => n.id === activeResearchNodeId);
        if (researchNode) {
          docX = researchNode.x + researchNode.width / 2 + 40;
          docY = researchNode.y + researchNode.height + 60;
        } else {
          const pos = getPlacementCenter();
          docX = pos.x;
          docY = pos.y;
        }
      } else {
        const pos = getPlacementCenter();
        docX = pos.x;
        docY = pos.y;
      }

      const docId = addNode("document", docX, docY, {
        label: label || "Research finding",
        snippet: text.slice(0, 200),
        content: text,
        documentContent: text,
      });

      if (activeResearchNodeId) {
        addEdge(activeResearchNodeId, docId);
      }
    },
    [addNode, addEdge, getPlacementCenter, activeResearchNodeId],
  );

  // ── Persist research messages back to node ──

  const handleResearchMessagesChange = useCallback(
    (messages: ChatMessageWithMeta[]) => {
      if (!activeResearchNodeId) return;
      const firstUserMsg = messages.find((m) => m.role === "user");
      const lastAssistantMsg = [...messages].reverse().find((m) => m.role === "assistant");
      updateNode(activeResearchNodeId, {
        researchMessages: messages.map((m) => ({ role: m.role, content: m.content })),
        researchQuery: firstUserMsg?.content,
        label: firstUserMsg
          ? `Research: ${firstUserMsg.content.slice(0, 30)}${firstUserMsg.content.length > 30 ? "..." : ""}`
          : "Research",
        snippet: lastAssistantMsg
          ? lastAssistantMsg.content.slice(0, 200)
          : firstUserMsg
            ? `Query: ${firstUserMsg.content.slice(0, 150)}`
            : "Double-click to start researching",
      });
    },
    [activeResearchNodeId, updateNode],
  );

  // ── Research → YouTube: inject URL into downstream YouTube node ──

  const handleResearchOutput = useCallback(
    (data: { type: "youtube-url"; url: string; title?: string }) => {
      if (!activeResearchNodeId) return;
      const outputEdges = stateRef.current.edges.filter(
        (e) => e.fromNodeId === activeResearchNodeId,
      );
      const youtubeNodes = outputEdges
        .map((e) => stateRef.current.nodes.find((n) => n.id === e.toNodeId))
        .filter((n) => n && n.type === "youtube") as FlowNode[];

      if (youtubeNodes.length === 0) return;

      const target = youtubeNodes[0];
      updateNode(target.id, {
        youtubeUrl: data.url,
        youtubeTitle: data.title,
      });

      toast({
        title: "URL sent to YouTube node",
        description: `${data.url.slice(0, 60)}${data.url.length > 60 ? "..." : ""} — click "Get Transcript" to fetch.`,
      });
    },
    [activeResearchNodeId, updateNode, toast],
  );

  // ── Double-click node ──

  const handleNodeDoubleClick = useCallback(
    (nodeId: string) => {
      const node = state.nodes.find((n) => n.id === nodeId);
      if (!node) return;
      const def = FLOW_NODE_REGISTRY[node.type];

      // Dialog-based overlays (not full-screen)
      if (node.type === "store") {
        setStoreFolderPickerNodeId(nodeId);
        return;
      }
      // Labels use inline editing on double-click (handled by FlowNodeRenderer)
      if (node.type === "label") return;

      // Non-expandable types
      if (def.expandMode === "none") return;

      // Seed document editor content if opening a document node
      if (node.type === "document" && !node.imageUrl) {
        setDocEditorContent(node.documentContent || "");
      }

      // Open unified overlay (sourceRect = null for now — FLIP animation
      // requires DOM refs which will be wired in FlowNodeContainer)
      setExpandSourceRect(null);
      setActiveExpandedNodeId(nodeId);
    },
    [state.nodes],
  );

  // ── Chain navigation: navigate between connected nodes in overlay ──

  const activeOverlayNodeId = activeExpandedNodeId;

  const navigateToNode = useCallback(
    (nodeId: string) => {
      // Save document editor state if currently showing a document
      const currentNode = activeExpandedNodeId
        ? state.nodes.find((n) => n.id === activeExpandedNodeId)
        : null;
      if (currentNode?.type === "document" && !currentNode.imageUrl) {
        updateNode(activeExpandedNodeId!, {
          documentContent: docEditorContent,
          snippet: docEditorContent.slice(0, 200) || "Double-click to edit",
          label: docEditorContent
            ? docEditorContent.split("\n")[0]?.slice(0, 40) || "Document"
            : "New Document",
        });
      }

      // Navigate to the target node
      const targetNode = state.nodes.find((n) => n.id === nodeId);
      if (!targetNode) return;

      // Seed document editor content for document nodes
      if (targetNode.type === "document" && !targetNode.imageUrl) {
        setDocEditorContent(targetNode.documentContent || "");
      }

      // Switch overlay (no FLIP animation for chain nav)
      setExpandSourceRect(null);
      setActiveExpandedNodeId(nodeId);
    },
    [activeExpandedNodeId, docEditorContent, updateNode, state.nodes],
  );

  // ── Store node: select save folder ──

  const handleSelectStoreFolder = useCallback(
    (folderId: number | null, folderName: string, folderPath: string) => {
      if (!storeFolderPickerNodeId) return;
      updateNode(storeFolderPickerNodeId, {
        storeFolderId: folderId ?? undefined,
        storeFolderName: folderName,
        storeFolderPath: folderPath,
      });
      setStoreFolderPickerNodeId(null);
    },
    [storeFolderPickerNodeId, updateNode],
  );

  // ── Create document from LLM output ──

  const handleCreateNote = useCallback(
    (content: string, label: string, sourceNodeId?: string) => {
      // If source node provided, place to its right and create edge
      const sourceNode = sourceNodeId
        ? stateRef.current.nodes.find((n) => n.id === sourceNodeId)
        : undefined;

      const pos = sourceNode
        ? { x: sourceNode.x + sourceNode.width + 40, y: sourceNode.y }
        : getPlacementCenter();

      const newId = addNode("document", pos.x + 100, pos.y + 65, {
        label,
        snippet: content.slice(0, 200),
        content,
        documentContent: content,
      });

      // Create edge from source → output document
      if (sourceNodeId && newId) {
        addEdge(sourceNodeId, newId);
      }
    },
    [addNode, addEdge, getPlacementCenter],
  );

  // ── Create edge from port drag ──

  const handleCreateEdge = useCallback(
    (fromNodeId: string, toNodeId: string) => {
      // Prevent self-loops
      if (fromNodeId === toNodeId) return;
      // Prevent duplicate edges
      const exists = state.edges.some(
        (e) => e.fromNodeId === fromNodeId && e.toNodeId === toNodeId,
      );
      if (exists) return;

      // Check if this is a doc/context-doc → research connection that needs role assignment
      const fromNode = state.nodes.find((n) => n.id === fromNodeId);
      const toNode = state.nodes.find((n) => n.id === toNodeId);
      if (
        fromNode &&
        toNode &&
        (fromNode.type === "document" || fromNode.type === "context-doc") &&
        (toNode.type === "research" || toNode.type === "interview")
      ) {
        // Show role picker dialog
        setPendingEdgeRole({ fromNodeId, toNodeId });
        return;
      }

      addEdge(fromNodeId, toNodeId);
    },
    [addEdge, state.edges, state.nodes],
  );

  // ── Play node: auto-execute a node using its inputs ──

  const handlePlayNode = useCallback(
    async (nodeId: string) => {
      const node = stateRef.current.nodes.find((n) => n.id === nodeId);
      if (!node) return;

      // Gather connected input nodes (via edges pointing TO this node)
      const inputEdges = stateRef.current.edges.filter((e) => e.toNodeId === nodeId);
      const inputNodes = inputEdges
        .map((e) => stateRef.current.nodes.find((n) => n.id === e.fromNodeId))
        .filter(Boolean) as FlowNode[];

      // Document nodes: no-op (they're static sources)
      if (node.type === "document" || node.type === "context-doc") {
        toast({ title: "Already complete", description: "Document nodes are static sources" });
        return;
      }

      if (inputNodes.length === 0) {
        toast({ title: "No inputs connected", description: "Connect document nodes first" });
        return;
      }

      // Separate inputs by role
      const contextContent = inputEdges
        .map((e) => {
          const srcNode = stateRef.current.nodes.find((n) => n.id === e.fromNodeId);
          if (!srcNode) return "";
          if (e.role === "output-format") return ""; // handled separately
          return srcNode.documentContent || srcNode.content || srcNode.snippet || "";
        })
        .filter((s) => s.trim())
        .join("\n\n---\n\n");

      // Gather output-format template content
      const outputFormatEdges = inputEdges.filter((e) => e.role === "output-format");
      const templateContent = outputFormatEdges
        .map((e) => {
          const srcNode = stateRef.current.nodes.find((n) => n.id === e.fromNodeId);
          return srcNode?.documentContent || srcNode?.content || srcNode?.snippet || "";
        })
        .filter((s) => s.trim())
        .join("\n\n");

      // Combined content for non-format inputs
      const combinedContent = contextContent;

      if (!combinedContent.trim() && node.type !== "research") {
        toast({ title: "No content", description: "Input nodes have no content" });
        return;
      }

      // Mark node as running
      updateNode(nodeId, { llmStatus: "running", snippet: "Running..." });

      try {
        let outputText = "";

        if (node.type === "research") {
          // Build output-aware research prompt from outputConfig
          const oc = node.outputConfig;
          const countHint = oc?.outputCount ? `Provide exactly ${oc.outputCount} items/results.` : "";
          const customHint = oc?.customInstruction ? `\nAdditional instructions: ${oc.customInstruction}` : "";
          const templateHint = templateContent ? `\n\nFormat your output according to this template/schema:\n${templateContent}` : "";
          const researchPrompt = `Research the following topic thoroughly and provide a comprehensive analysis:\n\n${combinedContent}${countHint ? `\n\n${countHint}` : ""}${customHint}${templateHint}`;

          // Stream research using SSE
          const res = await fetch("/api/chat/stream", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              message: researchPrompt,
              objective: combinedContent.slice(0, 200),
              history: [],
              researchFocus: oc?.focusMode || undefined,
              responseConfig: (oc?.format || oc?.detail || oc?.audience || oc?.tone) ? {
                format: oc?.format,
                detail: oc?.detail,
                audience: oc?.audience,
                tone: oc?.tone,
              } : undefined,
            }),
          });

          if (!res.ok) throw new Error("Research API failed");

          const reader = res.body?.getReader();
          const decoder = new TextDecoder();
          let buffer = "";

          if (reader) {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              buffer += decoder.decode(value, { stream: true });

              // Parse SSE events
              const lines = buffer.split("\n");
              buffer = lines.pop() || "";

              for (const line of lines) {
                if (line.startsWith("data: ")) {
                  try {
                    const evt = JSON.parse(line.slice(6));
                    if (evt.type === "content" && evt.content) {
                      outputText += evt.content;
                    }
                  } catch {
                    // Ignore malformed SSE
                  }
                }
              }
            }
          }
        } else if (node.type === "painter") {
          // Create empty output image node immediately so the conveyor animation is visible
          const imgNodeId = addNode("document", node.x + node.width + 60, node.y, {
            label: "Painting...",
            snippet: "Generating image...",
            content: "",
            documentContent: "",
          });
          addEdge(nodeId, imgNodeId);

          // Painter: summarize for visual prompt, then generate image via Gemini
          const summaryRes = await apiRequest("POST", "/api/summarize-intent", {
            transcript: combinedContent.slice(0, 8000),
            context: "visual",
            mode: "clean",
          });
          const summaryData = (await summaryRes.json()) as { summary?: string };
          const imagePrompt = summaryData.summary || combinedContent.slice(0, 500);

          const imgRes = await apiRequest("POST", "/api/generate-imagen", {
            prompt: imagePrompt,
            style: "Illustration, Vibrant mood",
            aspectRatio: "16:9",
            numberOfImages: 1,
          });
          const imgData = (await imgRes.json()) as { images?: string[]; error?: string };

          if (imgData.images && imgData.images.length > 0) {
            updateNode(nodeId, {
              llmStatus: "done",
              snippet: `Generated: ${imagePrompt.slice(0, 80)}...`,
            });

            // Fill the output image node with the generated image
            updateNode(imgNodeId, {
              label: `Image: ${imagePrompt.slice(0, 30)}${imagePrompt.length > 30 ? "..." : ""}`,
              snippet: "Generated image",
              imageUrl: imgData.images[0],
              content: imagePrompt,
              documentContent: imagePrompt,
            });
            toast({ title: "Image generated" });
          } else {
            updateNode(nodeId, { llmStatus: "error", snippet: imgData.error || "Image generation failed" });
            updateNode(imgNodeId, {
              label: "Generation failed",
              snippet: imgData.error || "Image generation failed",
            });
            toast({ title: "Image generation failed", variant: "destructive" });
          }

          // Chain propagation for painter
          const downstreamEdges2 = stateRef.current.edges.filter((e) => e.fromNodeId === nodeId);
          for (const edge of downstreamEdges2) {
            const downstream = stateRef.current.nodes.find((n) => n.id === edge.toNodeId);
            if (downstream && ["research", "interview", "painter", "timeline", "llm", "social-post", "api-connection"].includes(downstream.type)) {
              setTimeout(() => handlePlayNode(edge.toNodeId), 500);
            }
          }
          return;
        } else if (node.type === "social-post") {
          // Social Post: call LLM to generate platform-specific posts from upstream content
          const platforms = node.socialPlatforms || {};
          const enabledPlatforms = Object.entries(platforms).filter(([, v]) => v).map(([k]) => k);
          if (enabledPlatforms.length === 0) {
            updateNode(nodeId, { llmStatus: "idle", snippet: node.snippet });
            toast({ title: "No platforms enabled", description: "Double-click to enable platforms" });
            return;
          }
          updateNode(nodeId, { socialGenStatus: "generating" });
          try {
            const res = await apiRequest("POST", "/api/social/generate", {
              content: combinedContent,
              platforms: enabledPlatforms,
              intent: node.socialIntent || "marketing",
              tone: node.socialTone || "professional",
            });
            const data = (await res.json()) as { posts: Record<string, { text: string; hashtags?: string[]; characterCount: number }> };
            const generatedPosts: Record<string, { text: string; imageUrl?: string; charCount: number; status: string }> = {};
            for (const [platform, post] of Object.entries(data.posts)) {
              generatedPosts[platform] = {
                text: post.text,
                charCount: post.characterCount,
                status: "draft",
              };
              // Create a child document node per platform
              const childId = addNode("document", node.x + node.width + 60, node.y + Object.keys(generatedPosts).length * 80, {
                label: `${platform} Post`,
                documentContent: post.text,
                snippet: post.text.slice(0, 120),
              });
              addEdge(nodeId, childId);
            }
            updateNode(nodeId, {
              socialGeneratedPosts: generatedPosts,
              socialGenStatus: "done",
              llmStatus: "done",
              snippet: `Generated ${enabledPlatforms.length} posts`,
            });
            toast({ title: "Posts generated", description: `Created ${enabledPlatforms.length} platform posts` });
          } catch {
            updateNode(nodeId, { socialGenStatus: "error", llmStatus: "error", snippet: "Generation failed" });
            toast({ title: "Social post generation failed", variant: "destructive" });
          }
          // Chain propagation
          const downstreamEdges3 = stateRef.current.edges.filter((e) => e.fromNodeId === nodeId);
          for (const edge of downstreamEdges3) {
            const downstream = stateRef.current.nodes.find((n) => n.id === edge.toNodeId);
            if (downstream && downstream.type === "api-connection") {
              setTimeout(() => handlePlayNode(edge.toNodeId), 500);
            }
          }
          return;
        } else if (node.type === "api-connection") {
          // API Connection: post content to connected platform
          const platform = node.apiService;
          if (!platform || platform === "webhook" || platform === "custom") {
            updateNode(nodeId, { llmStatus: "idle", snippet: node.snippet });
            toast({ title: "No platform configured", description: "Double-click to select a platform" });
            return;
          }
          updateNode(nodeId, { llmStatus: "running", snippet: "Posting..." });
          try {
            const res = await apiRequest("POST", "/api/social/post", {
              platform,
              content: combinedContent,
            });
            const data = (await res.json()) as { success: boolean; externalPostId?: string; externalPostUrl?: string; error?: string };
            const logEntry = {
              platform,
              status: data.success ? "success" : "failed",
              message: data.success ? `Posted (${data.externalPostId || "ok"})` : (data.error || "Failed"),
              timestamp: new Date().toISOString(),
              externalId: data.externalPostId,
            };
            updateNode(nodeId, {
              llmStatus: data.success ? "done" : "error",
              snippet: data.success ? `Posted to ${platform}` : (data.error || "Post failed"),
              apiLastResult: logEntry,
              apiPostLog: [...(node.apiPostLog || []), logEntry],
            });
            toast({ title: data.success ? "Posted successfully" : "Post failed", variant: data.success ? "default" : "destructive" });
          } catch {
            updateNode(nodeId, { llmStatus: "error", snippet: "Post failed" });
            toast({ title: "API post failed", variant: "destructive" });
          }
          return;
        } else if (node.type === "llm") {
          // LLM nodes already have their own Run button — delegate there
          toast({ title: "Use Run", description: "LLM nodes have their own Run button" });
          updateNode(nodeId, { llmStatus: "idle", snippet: node.snippet });
          return;
        } else {
          // Generic: use /api/write
          const res = await apiRequest("POST", "/api/write", {
            document: combinedContent,
            instruction: `Process this content for the purpose: ${node.label}`,
            appType: "write-a-prompt",
          });
          const data = (await res.json()) as { document: string };
          outputText = data.document || "";
        }

        if (!outputText.trim()) {
          updateNode(nodeId, { llmStatus: "error", snippet: "No output generated" });
          return;
        }

        // Update the source node
        updateNode(nodeId, {
          llmStatus: "done",
          content: outputText,
          snippet: outputText.slice(0, 200),
        });

        // ── Split mode: create N separate document nodes ──
        const oc2 = node.outputConfig;
        if (oc2?.outputMode === "split" && oc2?.outputCount && oc2.outputCount > 1) {
          const sections = splitOutputIntoSections(outputText, oc2.outputCount);
          for (let i = 0; i < sections.length; i++) {
            const docId = addNode("document", node.x + node.width + 60, node.y + i * 160, {
              label: `${node.label} [${i + 1}/${sections.length}]`,
              documentContent: sections[i],
              snippet: sections[i].slice(0, 200),
            });
            addEdge(nodeId, docId);
          }
          toast({ title: "Execution complete", description: `Created ${sections.length} output documents` });
        } else {
          // Consolidated mode: single output document
          const outputDocId = addNode("document", node.x + node.width + 60, node.y, {
            label: `${node.label} Output`,
            documentContent: outputText,
            snippet: outputText.slice(0, 200),
          });
          addEdge(nodeId, outputDocId);
          toast({ title: "Execution complete", description: `Output document created` });
        }

        // ── Chain propagation: auto-trigger downstream playable nodes ──
        // Find nodes that receive input from this node (edges from nodeId → downstream)
        const downstreamEdges = stateRef.current.edges.filter((e) => e.fromNodeId === nodeId);
        for (const edge of downstreamEdges) {
          const downstream = stateRef.current.nodes.find((n) => n.id === edge.toNodeId);
          if (downstream && ["research", "interview", "painter", "timeline", "llm", "social-post", "api-connection"].includes(downstream.type)) {
            // Delay slightly to let state update propagate
            setTimeout(() => handlePlayNode(edge.toNodeId), 500);
          }
        }
      } catch {
        updateNode(nodeId, { llmStatus: "error", snippet: "Execution failed" });
        toast({ title: "Execution failed", variant: "destructive" });
      }
    },
    [addNode, addEdge, updateNode, toast],
  );

  // ── Drop tool from dock onto canvas ──

  const handleDropTool = useCallback(
    (toolId: string, canvasX: number, canvasY: number) => {
      if (toolId === "context") {
        setPendingContextAction({ x: canvasX, y: canvasY });
        return;
      }
      if (toolId === "research") {
        addNode("research", canvasX, canvasY, {
          label: "Research",
          snippet: "Double-click to start researching",
          outputConfig: {
            format: "structured",
            detail: "standard",
            focusMode: "explore",
            audience: "general",
            tone: "neutral",
          },
        });
        return;
      }
      if (toolId === "llm") {
        const defaultPreset = getPreset("summarize");
        addNode("llm", canvasX, canvasY, {
          label: "Text Modifications",
          llmPresetId: defaultPreset.id,
          llmObjective: defaultPreset.defaultObjective,
          llmStatus: "idle",
        });
        return;
      }
      if (toolId === "painter") {
        addNode("painter", canvasX, canvasY, {
          label: "Painter",
          snippet: "Double-click to generate images",
        });
        return;
      }
      if (toolId === "interview") {
        addNode("interview", canvasX, canvasY, {
          label: "Interview",
          snippet: "Double-click to start interview",
        });
        return;
      }
      if (toolId === "timeline") {
        addNode("timeline", canvasX, canvasY, {
          label: "Timeline",
          snippet: "Double-click to build a timeline",
        });
        return;
      }
      if (toolId === "document") {
        addNode("document", canvasX, canvasY, {
          label: "New Document",
          snippet: "Double-click to edit",
          documentContent: "",
        });
        return;
      }
      if (toolId === "zone") {
        addNode("zone", canvasX, canvasY, {
          label: "Zone",
          zoneLabel: "Zone",
          zoneColor: "gray",
        });
        return;
      }
      if (toolId === "audio") {
        addNode("audio", canvasX, canvasY, {
          label: "Capture Audio",
          snippet: "Click mic to start recording",
          audioRecording: false,
          audioTranscript: "",
        });
        return;
      }
      if (toolId === "youtube") {
        addNode("youtube", canvasX, canvasY, {
          label: "YouTube",
          snippet: "Paste a YouTube URL to fetch transcript",
          youtubeUrl: "",
          youtubeFetchStatus: "idle",
        });
        return;
      }
      if (toolId === "label") {
        addNode("label", canvasX, canvasY, {
          label: "Label",
          labelFontSize: 16,
          labelBold: false,
          labelItalic: false,
          labelColor: "text-foreground",
        });
        return;
      }
      if (toolId === "timer-event") {
        addNode("timer-event", canvasX, canvasY, {
          label: "Trigger",
          snippet: "Click start to begin triggering",
          triggerMode: "timed",
          timerRunning: false,
          timerPulseCount: 0,
          timerInterval: 5000,
        });
        return;
      }
      if (toolId === "logic") {
        setPendingLogicAction({ x: canvasX, y: canvasY, screenX: mousePosRef.current.x, screenY: mousePosRef.current.y });
        return;
      }
      if (toolId === "social-post") {
        addNode("social-post", canvasX, canvasY, {
          label: "Social Post",
          snippet: "Double-click to compose posts",
          socialPlatforms: {},
          socialIntent: "marketing",
          socialTone: "professional",
          socialGenerateImages: false,
          socialGenStatus: "idle",
        });
        return;
      }
      if (toolId === "api-connection") {
        addNode("api-connection", canvasX, canvasY, {
          label: "API Post",
          snippet: "Double-click to configure",
          apiAuthStatus: "none",
          apiPostLog: [],
        });
        return;
      }
    },
    [addNode],
  );

  // Keep ref in sync for keyboard shortcuts
  handleDropToolRef.current = handleDropTool;

  // ── YouTube: auto-create document node when transcript is fetched ──

  const youtubeDocCreatedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    for (const node of state.nodes) {
      if (
        node.type === "youtube" &&
        node.youtubeFetchStatus === "done" &&
        node.content &&
        !youtubeDocCreatedRef.current.has(node.id)
      ) {
        youtubeDocCreatedRef.current.add(node.id);
        const docX = node.x + node.width + 60;
        const docY = node.y;
        const docId = addNode("document", docX, docY, {
          label: node.youtubeTitle
            ? `Transcript: ${node.youtubeTitle.slice(0, 25)}${node.youtubeTitle.length > 25 ? "..." : ""}`
            : "YouTube Transcript",
          snippet: node.content.slice(0, 200),
          content: node.content,
          documentContent: node.content,
        });
        addEdge(node.id, docId);
      }
    }
  }, [state.nodes, addNode, addEdge]);

  // ── Trigger: auto-create/append to document node on each timed pulse ──

  const timerDocMapRef = useRef<Map<string, string>>(new Map());
  const timerLastPulseRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    for (const node of state.nodes) {
      if (node.type !== "timer-event" || !node.timerRunning) continue;
      // Only apply auto-document for timed mode
      if (node.triggerMode === "automated") continue;
      const pulseCount = node.timerPulseCount || 0;
      const lastKnown = timerLastPulseRef.current.get(node.id) || 0;
      if (pulseCount <= lastKnown) continue;
      timerLastPulseRef.current.set(node.id, pulseCount);

      const existingDocId = timerDocMapRef.current.get(node.id);
      const existingDocNode = existingDocId ? state.nodes.find((n) => n.id === existingDocId) : null;

      if (existingDocNode) {
        const lastEntry = node.content?.split("\n").pop() || `Pulse #${pulseCount}`;
        const updatedContent = (existingDocNode.documentContent || "") + "\n" + lastEntry;
        updateNode(existingDocId!, {
          documentContent: updatedContent,
          content: updatedContent,
          snippet: updatedContent.slice(-200),
        });
      } else {
        const docX = node.x + node.width + 60;
        const docY = node.y;
        const docId = addNode("document", docX, docY, {
          label: `Trigger Log — ${new Date().toLocaleDateString()}`,
          snippet: node.content?.slice(-200) || "Trigger events",
          content: node.content || "",
          documentContent: node.content || "",
        });
        addEdge(node.id, docId);
        timerDocMapRef.current.set(node.id, docId);
      }
    }
  }, [state.nodes, addNode, addEdge, updateNode]);

  // ── Trigger (automated mode): watch for upstream node completion ──
  // When an input node's llmStatus transitions to "done", fire downstream chain.

  const automatedTriggerLastSeenRef = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    for (const node of state.nodes) {
      if (node.type !== "timer-event" || node.triggerMode !== "automated" || !node.timerRunning) continue;

      // Find input nodes connected to this trigger
      const inputEdges = state.edges.filter((e) => e.toNodeId === node.id);
      for (const edge of inputEdges) {
        const inputNode = state.nodes.find((n) => n.id === edge.fromNodeId);
        if (!inputNode) continue;

        const status = inputNode.llmStatus || inputNode.socialGenStatus || "idle";
        const key = `${node.id}:${inputNode.id}`;
        const lastSeen = automatedTriggerLastSeenRef.current.get(key);

        // Fire when status transitions to "done" and we haven't already fired for this completion
        if (status === "done" && lastSeen !== "done") {
          automatedTriggerLastSeenRef.current.set(key, "done");

          // Log the trigger fire
          const now = new Date();
          const ts = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
          const count = (node.timerPulseCount || 0) + 1;
          const entry = `[${ts}] Triggered by "${inputNode.label}" completion`;
          const newContent = (node.content || "") + (node.content ? "\n" : "") + entry;

          updateNode(node.id, {
            timerPulseCount: count,
            timerLastPulse: now.toISOString(),
            content: newContent,
            snippet: `Fired #${count} — ${inputNode.label}`,
          });

          // Propagate to downstream nodes
          const downstreamEdges = state.edges.filter((e) => e.fromNodeId === node.id);
          for (const de of downstreamEdges) {
            const downstream = state.nodes.find((n) => n.id === de.toNodeId);
            if (downstream && ["research", "interview", "painter", "timeline", "llm", "social-post", "api-connection"].includes(downstream.type)) {
              setTimeout(() => handlePlayNode(de.toNodeId), 300);
            }
          }
        } else if (status !== "done") {
          // Reset tracking when node goes back to non-done state
          automatedTriggerLastSeenRef.current.set(key, status);
        }
      }
    }
  }, [state.nodes, state.edges, updateNode, handlePlayNode]);

  // ── Context Store: Load File from dialog ──

  const handleDocPickFromDialog = useCallback(
    async (docId: number, docTitle: string) => {
      if (!pendingContextAction) return;
      try {
        const res = await apiRequest("GET", `/api/documents/${docId}`);
        const data = (await res.json()) as { title: string; content: string };
        addNode("context-doc", pendingContextAction.x, pendingContextAction.y, {
          label: data.title || docTitle,
          documentId: docId,
          snippet: (data.content || "").slice(0, 200),
          content: data.content,
        });
      } catch {
        addNode("context-doc", pendingContextAction.x, pendingContextAction.y, {
          label: docTitle,
          documentId: docId,
          snippet: "",
          content: "",
        });
      }
      setPendingContextAction(null);
    },
    [pendingContextAction, addNode],
  );

  // ── Save canvas ──

  const handleSaveCanvas = useCallback(async () => {
    if (state.nodes.length === 0) {
      toast({ title: "Nothing to save", description: "Canvas is empty" });
      return;
    }
    setIsSaving(true);
    try {
      const contentNodes = state.nodes.filter((n) => n.type !== "store");
      const canvasData = { nodes: contentNodes, edges: state.edges, viewport: state.viewport };
      const title = canvasTitle || `Flow Canvas — ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;

      if (canvasDocumentId) {
        // Update existing
        await apiRequest("PUT", `/api/documents/${canvasDocumentId}`, {
          title,
          content: JSON.stringify(canvasData),
        });
        toast({ title: "Canvas saved" });
      } else {
        // Create new
        const res = await apiRequest("POST", "/api/documents", {
          title,
          content: JSON.stringify(canvasData),
          docType: "chart",
        });
        const data = (await res.json()) as { id: number };
        setCanvasDocumentId(data.id);
        setCanvasTitle(title);
        toast({ title: "Canvas saved", description: "Saved to Context Store" });
      }
    } catch {
      toast({ title: "Save failed", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  }, [state.nodes, state.edges, state.viewport, canvasDocumentId, canvasTitle, toast]);

  // ── Open canvas from saved document ──

  const handleOpenCanvas = useCallback(
    async (docId: number, docTitle: string) => {
      setCanvasLoading(true);
      setLoadProgress(20);
      try {
        const res = await apiRequest("GET", `/api/documents/${docId}`);
        setLoadProgress(60);
        const data = (await res.json()) as { title: string; content: string };
        setLoadProgress(80);
        const parsed = JSON.parse(data.content);
        setLoadProgress(90);
        loadCanvas(parsed);
        setLoadProgress(100);
        setCanvasDocumentId(docId);
        setCanvasTitle(data.title || docTitle);
        setOpenCanvasDialogOpen(false);
        toast({ title: "Canvas loaded", description: data.title || docTitle });
      } catch {
        toast({ title: "Failed to load canvas", variant: "destructive" });
      } finally {
        setCanvasLoading(false);
        setLoadProgress(undefined);
      }
    },
    [loadCanvas, toast],
  );

  // ── Rename canvas ──

  const handleRenameCanvas = useCallback(async (newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    setCanvasTitle(trimmed);
    if (canvasDocumentId) {
      try {
        await apiRequest("PUT", `/api/documents/${canvasDocumentId}`, { title: trimmed });
      } catch {
        // silent — name is already set locally
      }
    }
  }, [canvasDocumentId]);

  // ── New canvas ──

  const handleNewCanvas = useCallback(() => {
    resetCanvas();
    setCanvasDocumentId(null);
    setCanvasTitle("");
    toast({ title: "New canvas created" });
  }, [resetCanvas, toast]);

  // ── Fit to screen ──

  const handleFitToScreen = useCallback(() => {
    const nodes = stateRef.current.nodes;
    if (nodes.length === 0) return;
    const el = canvasContainerRef.current;
    const W = el?.clientWidth ?? 800;
    const H = el?.clientHeight ?? 600;
    const pad = 40;
    const minX = Math.min(...nodes.map((n) => n.x));
    const minY = Math.min(...nodes.map((n) => n.y));
    const maxX = Math.max(...nodes.map((n) => n.x + n.width));
    const maxY = Math.max(...nodes.map((n) => n.y + n.height));
    const bw = maxX - minX || 1;
    const bh = maxY - minY || 1;
    const zoom = Math.min((W - pad * 2) / bw, (H - pad * 2) / bh, 1.5);
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    setViewport(W / 2 - cx * zoom, H / 2 - cy * zoom, zoom);
  }, [setViewport]);

  // ── Zoom controls ──

  const handleZoomIn = useCallback(() => {
    const s = stateRef.current;
    const el = canvasContainerRef.current;
    const W = el?.clientWidth ?? 800;
    const H = el?.clientHeight ?? 600;
    const newZoom = Math.min(s.viewport.zoom * 1.25, 4);
    const cx = W / 2;
    const cy = H / 2;
    setViewport(
      cx - (cx - s.viewport.x) * (newZoom / s.viewport.zoom),
      cy - (cy - s.viewport.y) * (newZoom / s.viewport.zoom),
      newZoom,
    );
  }, [setViewport]);

  const handleZoomOut = useCallback(() => {
    const s = stateRef.current;
    const el = canvasContainerRef.current;
    const W = el?.clientWidth ?? 800;
    const H = el?.clientHeight ?? 600;
    const newZoom = Math.max(s.viewport.zoom / 1.25, 0.1);
    const cx = W / 2;
    const cy = H / 2;
    setViewport(
      cx - (cx - s.viewport.x) * (newZoom / s.viewport.zoom),
      cy - (cy - s.viewport.y) * (newZoom / s.viewport.zoom),
      newZoom,
    );
  }, [setViewport]);

  const handleResetZoom = useCallback(() => {
    const s = stateRef.current;
    const el = canvasContainerRef.current;
    const W = el?.clientWidth ?? 800;
    const H = el?.clientHeight ?? 600;
    const newZoom = 1;
    const cx = W / 2;
    const cy = H / 2;
    setViewport(
      cx - (cx - s.viewport.x) * (newZoom / s.viewport.zoom),
      cy - (cy - s.viewport.y) * (newZoom / s.viewport.zoom),
      newZoom,
    );
  }, [setViewport]);

  // ── Document editor: run a tool ──

  const handleDocTool = useCallback(
    async (instruction: string, toolId: string) => {
      if (!docEditorContent.trim()) return;
      setDocToolRunning(toolId);
      try {
        const res = await apiRequest("POST", "/api/write", {
          document: docEditorContent,
          instruction,
          appType: "write-a-prompt",
        });
        const data = (await res.json()) as { document: string };
        if (data.document) {
          setDocEditorContent(data.document);
        }
      } catch {
        toast({ title: "Tool failed", variant: "destructive" });
      } finally {
        setDocToolRunning(null);
      }
    },
    [docEditorContent, toast],
  );

  // ── Close document editor overlay ──

  const handleCloseDocumentEditor = useCallback(() => {
    if (activeExpandedNodeId) {
      const n = stateRef.current.nodes.find((nd) => nd.id === activeExpandedNodeId);
      if (n?.type === "document" && !n.imageUrl) {
        updateNode(activeExpandedNodeId, {
          documentContent: docEditorContent,
          snippet: docEditorContent.slice(0, 200) || "Double-click to edit",
          label: docEditorContent
            ? docEditorContent.split("\n")[0]?.slice(0, 40) || "Document"
            : "New Document",
        });
      }
    }
    setDocEditorContent("");
  }, [activeExpandedNodeId, docEditorContent, updateNode]);

  // ── Header actions for status bar ──

  const zoomPercent = Math.round(state.viewport.zoom * 100);

  const headerActions = (
    <div className="flex items-center gap-0.5 mr-2 border-r border-border/30 pr-2">
      {canvasTitle && (
        <span className="text-[10px] text-muted-foreground mr-1 max-w-[120px] truncate">
          {canvasTitle}
        </span>
      )}

      {/* File dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-6 gap-1 text-[10px] px-2">
            <FileText className="w-3 h-3" />
            File
            <ChevronDown className="w-2.5 h-2.5 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-40">
          <DropdownMenuItem
            onClick={handleSaveCanvas}
            disabled={isSaving || state.nodes.length === 0}
            className="text-xs gap-2"
          >
            {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Save Canvas
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setOpenCanvasDialogOpen(true)} className="text-xs gap-2">
            <FolderUp className="w-3.5 h-3.5" />
            Open Canvas
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleNewCanvas} className="text-xs gap-2">
            <FilePlus2 className="w-3.5 h-3.5" />
            New Canvas
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={addTab} className="text-xs gap-2">
            <Plus className="w-3.5 h-3.5" />
            New Tab
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* View dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-6 gap-1 text-[10px] px-2">
            <ScanLine className="w-3 h-3" />
            {zoomPercent}%
            <ChevronDown className="w-2.5 h-2.5 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-40">
          <DropdownMenuItem onClick={handleZoomIn} className="text-xs gap-2">
            <ZoomIn className="w-3.5 h-3.5" />
            Zoom In
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleZoomOut} className="text-xs gap-2">
            <ZoomOut className="w-3.5 h-3.5" />
            Zoom Out
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleResetZoom} className="text-xs gap-2">
            <ScanLine className="w-3.5 h-3.5" />
            Reset to 100%
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={handleFitToScreen}
            disabled={state.nodes.length === 0}
            className="text-xs gap-2"
          >
            <Maximize className="w-3.5 h-3.5" />
            Fit to Screen
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => setFrozen((f) => !f)}
            className="text-xs gap-2"
          >
            {frozen ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
            {frozen ? "Unlock Canvas" : "Freeze Canvas"}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => window.location.href = "/old"}
            className="text-xs gap-2"
          >
            <Expand className="w-3.5 h-3.5" />
            Classic View
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Share dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-6 gap-1 text-[10px] px-2">
            <Share2 className="w-3 h-3" />
            Share
            <ChevronDown className="w-2.5 h-2.5 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-44">
          <DropdownMenuItem
            onClick={() => setShareDialogOpen(true)}
            disabled={!canvasDocumentId}
            className="text-xs gap-2"
          >
            <Share2 className="w-3.5 h-3.5" />
            Share Canvas
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => {
              if (!canvasDocumentId) {
                toast({ title: "Save canvas first", description: "Save the canvas before collaborating" });
                return;
              }
              setCollabEnabled((prev) => !prev);
            }}
            className="text-xs gap-2"
          >
            {collabEnabled ? <WifiOff className="w-3.5 h-3.5" /> : <Wifi className="w-3.5 h-3.5" />}
            {collabEnabled ? "Stop Collaborating" : "Go Live"}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => setConnectionsDialogOpen(true)}
            className="text-xs gap-2"
          >
            <Users className="w-3.5 h-3.5" />
            Connections
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => setIntegrationsDialogOpen(true)}
            className="text-xs gap-2"
          >
            <Wifi className="w-3.5 h-3.5" />
            Platform Integrations
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Collaboration presence indicator */}
      {collabEnabled && (
        <div className="flex items-center gap-1 ml-1">
          <div className={`w-1.5 h-1.5 rounded-full ${collabConnected ? "bg-green-500" : "bg-yellow-500 animate-pulse"}`} />
          {collabMembers.length > 0 && (
            <span className="text-[9px] text-muted-foreground">
              {collabMembers.length} online
            </span>
          )}
        </div>
      )}
    </div>
  );

  // ── Derive overlay node references from unified state ──

  const activeExpandedNode = activeExpandedNodeId
    ? state.nodes.find((n) => n.id === activeExpandedNodeId)
    : null;

  const activeResearchNode = activeResearchNodeId
    ? state.nodes.find((n) => n.id === activeResearchNodeId)
    : null;

  // Connection context for the active research node
  const researchConnectionCtx = useMemo(() => {
    if (!activeResearchNodeId) return null;
    const inputEdges = state.edges.filter((e) => e.toNodeId === activeResearchNodeId);
    const outputEdges = state.edges.filter((e) => e.fromNodeId === activeResearchNodeId);
    const inputNodes = inputEdges
      .map((e) => state.nodes.find((n) => n.id === e.fromNodeId))
      .filter(Boolean) as FlowNode[];
    const outputNodes = outputEdges
      .map((e) => state.nodes.find((n) => n.id === e.toNodeId))
      .filter(Boolean) as FlowNode[];
    const roleMap = new Map(inputEdges.map((e) => [e.fromNodeId, e.role]));
    return {
      inputNodes: inputNodes.map((n) => ({
        type: n.type,
        label: n.label,
        content: n.content,
        documentContent: n.documentContent,
        snippet: n.snippet,
        role: roleMap.get(n.id) as "context" | "objective" | undefined,
      })),
      outputNodes: outputNodes.map((n) => ({
        id: n.id,
        type: n.type,
        label: n.label,
      })),
    };
  }, [activeResearchNodeId, state.edges, state.nodes]);

  // Derive painter-specific context from unified state
  const activePainterNodeId = useMemo(() => {
    if (!activeExpandedNodeId) return null;
    const n = state.nodes.find((nd) => nd.id === activeExpandedNodeId);
    return n?.type === "painter" ? activeExpandedNodeId : null;
  }, [activeExpandedNodeId, state.nodes]);

  const painterSourceText = activePainterNodeId
    ? (() => {
        const inputEdges = state.edges.filter((e) => e.toNodeId === activePainterNodeId);
        const inputNodes = inputEdges
          .map((e) => state.nodes.find((n) => n.id === e.fromNodeId))
          .filter(Boolean);
        return inputNodes
          .map((n) => n?.documentContent || n?.content || n?.snippet || "")
          .filter(Boolean)
          .join("\n\n");
      })()
    : "";

  const handlePainterImageGenerated = useCallback(
    (imageUrl: string, prompt: string) => {
      if (!activePainterNodeId) return;
      const painterNode = stateRef.current.nodes.find((n) => n.id === activePainterNodeId);

      updateNode(activePainterNodeId, {
        llmStatus: "done",
        snippet: `Generated: ${prompt.slice(0, 80)}...`,
      });

      const imgX = (painterNode?.x ?? 0) + (painterNode?.width ?? 260) + 60;
      const imgY = painterNode?.y ?? 0;
      const imgNodeId = addNode("document", imgX, imgY, {
        label: `Image: ${prompt.slice(0, 30)}${prompt.length > 30 ? "..." : ""}`,
        snippet: "Generated image",
        imageUrl,
        content: prompt,
        documentContent: prompt,
      });

      addEdge(activePainterNodeId, imgNodeId);
    },
    [activePainterNodeId, addNode, addEdge, updateNode],
  );

  // ── Interview overlay: connection context + export handler ──

  const activeInterviewNodeId = useMemo(() => {
    if (!activeExpandedNodeId) return null;
    const n = state.nodes.find((nd) => nd.id === activeExpandedNodeId);
    return n?.type === "interview" ? activeExpandedNodeId : null;
  }, [activeExpandedNodeId, state.nodes]);

  const interviewConnectionCtx = useMemo(() => {
    if (!activeInterviewNodeId) return null;
    const inputEdges = state.edges.filter((e) => e.toNodeId === activeInterviewNodeId);
    const inputNodes = inputEdges
      .map((e) => state.nodes.find((n) => n.id === e.fromNodeId))
      .filter(Boolean) as FlowNode[];
    const roleMap = new Map(inputEdges.map((e) => [e.fromNodeId, e.role]));
    const inputContent = inputNodes
      .map((n) => n.documentContent || n.content || n.snippet || "")
      .filter(Boolean)
      .join("\n\n");
    const objectiveText = inputNodes
      .filter((n) => roleMap.get(n.id) === "objective")
      .map((n) => n.documentContent || n.content || n.snippet || "")
      .filter(Boolean)
      .join("\n\n");
    return { inputContent, objectiveText };
  }, [activeInterviewNodeId, state.edges, state.nodes]);

  const handleInterviewExport = useCallback(
    (text: string, label: string) => {
      if (!activeInterviewNodeId) return;
      const interviewNode = stateRef.current.nodes.find((n) => n.id === activeInterviewNodeId);
      const docX = (interviewNode?.x ?? 0) + (interviewNode?.width ?? 220) + 60;
      const docY = interviewNode?.y ?? 0;
      const docId = addNode("document", docX, docY, {
        label,
        snippet: text.slice(0, 200),
        content: text,
        documentContent: text,
      });
      addEdge(activeInterviewNodeId, docId);
    },
    [activeInterviewNodeId, addNode, addEdge],
  );

  // Count running AI jobs for status bar
  const jobCount = state.nodes.filter(
    (n) => n.llmStatus === "running" || n.youtubeFetchStatus === "fetching" || n.timerRunning,
  ).length;

  return (
    <FtuxShell>
      <FtuxStatusBar
        templateName={null}
        templateId={null}
        headerActions={headerActions}
        jobCount={jobCount}
        canvasTheme={canvasTheme}
        onChangeCanvasTheme={setCanvasTheme}
        canvasName={canvasTitle || "Untitled Canvas"}
        onRenameCanvas={handleRenameCanvas}
        savedCanvases={canvasDocs.map((d: DocumentListItem) => ({ id: d.id, title: d.title }))}
        onOpenCanvas={handleOpenCanvas}
        canvasLoading={canvasLoading}
        onToggleDetails={() => setDetailsPanelOpen((v) => !v)}
        detailsOpen={detailsPanelOpen}
      />

      {/* Workspace tabs */}
      {workspaceTabs.length > 1 && (
        <div className="flex items-center bg-muted/30 border-b border-border/30 px-1 shrink-0">
          {workspaceTabs.map((tab) => (
            <div
              key={tab.id}
              className={cn(
                "group flex items-center gap-1 px-3 py-1 text-[11px] cursor-pointer border-b-2 transition-colors",
                tab.id === activeTabId
                  ? "border-primary text-foreground font-medium bg-background/50"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50",
              )}
              onClick={() => switchTab(tab.id)}
              onDoubleClick={(e) => {
                e.stopPropagation();
                setEditingTabId(tab.id);
              }}
            >
              {editingTabId === tab.id ? (
                <input
                  className="text-[11px] bg-transparent border-b border-primary/50 outline-none w-20"
                  defaultValue={tab.label}
                  autoFocus
                  onBlur={(e) => renameTab(tab.id, e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") renameTab(tab.id, (e.target as HTMLInputElement).value);
                    if (e.key === "Escape") setEditingTabId(null);
                  }}
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <span>{tab.label}</span>
              )}
              {workspaceTabs.length > 1 && (
                <button
                  className="opacity-0 group-hover:opacity-100 hover:text-destructive transition-opacity ml-0.5"
                  onClick={(e) => {
                    e.stopPropagation();
                    closeTab(tab.id);
                  }}
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          ))}
          <button
            className="flex items-center px-2 py-1 text-muted-foreground/50 hover:text-muted-foreground transition-colors"
            onClick={addTab}
            title="New canvas"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <div
        ref={canvasContainerRef}
        className="flex-1 relative overflow-hidden"
        style={{
          ...(!activeTheme.heroVisible ? {
            background: activeTheme.background
              ?? (canvasTheme === "none" && canvasBgColor ? canvasBgColor : undefined),
          } : {}),
          ...(canvasFontSize && canvasFontSize !== 14 ? { fontSize: `${canvasFontSize}px` } : {}),
          ...(canvasFontColor ? { color: canvasFontColor } : {}),
        }}
      >
        <FlowCanvas
          state={state}
          frozen={frozen}
          transparentBg={activeTheme.heroVisible}
          gridOpacity={activeTheme.gridOpacity}
          gridColor={activeTheme.gridColor}
          onMoveNode={moveNode}
          onMoveNodes={moveNodes}
          onDeleteNode={deleteNode}
          onSelectNode={selectNode}
          onSelectNodes={selectNodes}
          onToggleSelectNode={toggleSelectNode}
          onNodeDoubleClick={handleNodeDoubleClick}
          onViewportChange={setViewport}
          onUpdateNode={updateNode}
          onCreateNote={handleCreateNote}
          onCreateEdge={handleCreateEdge}
          onDeleteEdge={deleteEdge}
          onPlayNode={handlePlayNode}
          onToggleLock={(nodeId) => {
            const node = state.nodes.find((n) => n.id === nodeId);
            if (!node) return;
            const current = node.lockMode || (node.locked ? "canvas" : "none");
            if (current === "none") {
              updateNode(nodeId, { lockMode: "canvas", locked: true });
            } else if (current === "canvas") {
              // Canvas → Screen: convert canvas position to screen position
              const vp = state.viewport;
              const screenX = node.x * vp.zoom + vp.x;
              const screenY = node.y * vp.zoom + vp.y;
              updateNode(nodeId, { lockMode: "screen", locked: true, screenX, screenY });
            } else {
              // Screen → Unlock: convert screen position back to canvas
              const vp = state.viewport;
              const canvasX = ((node.screenX ?? 100) - vp.x) / vp.zoom;
              const canvasY = ((node.screenY ?? 100) - vp.y) / vp.zoom;
              updateNode(nodeId, { lockMode: "none", locked: false, x: canvasX, y: canvasY });
            }
          }}
          onDropTool={handleDropTool}
          onDragStart={pushUndoSnapshot}
          minimapState={minimapState}
          onFitToView={fitToView}
        />

        {!dockHidden && <FtuxDock />}
        <FlowLoadingBar active={canvasLoading || isSaving} progress={canvasLoading ? loadProgress : undefined} />
      </div>

      {/* Context Store: Load/Save choice dialog */}
      <Dialog
        open={pendingContextAction !== null && !pendingContextAction.mode}
        onOpenChange={(open) => !open && setPendingContextAction(null)}
      >
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle className="text-sm">Context Store</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Button
              variant="outline"
              className="justify-start gap-2 h-12"
              onClick={() => {
                if (!pendingContextAction) return;
                addNode("document", pendingContextAction.x, pendingContextAction.y, {
                  label: "New Document",
                  snippet: "Double-click to edit",
                  documentContent: "",
                });
                setPendingContextAction(null);
              }}
            >
              <span className="text-[9px] font-mono text-muted-foreground/60 w-4 shrink-0">1</span>
              <FilePlus2 className="w-4 h-4 text-indigo-500" />
              <div className="text-left">
                <div className="text-xs font-medium">New Document</div>
                <div className="text-[10px] text-muted-foreground">Create a blank document node</div>
              </div>
            </Button>
            <Button
              variant="outline"
              className="justify-start gap-2 h-12"
              onClick={() => setPendingContextAction((prev) => prev ? { ...prev, mode: "load" } : null)}
            >
              <span className="text-[9px] font-mono text-muted-foreground/60 w-4 shrink-0">2</span>
              <FolderOpen className="w-4 h-4 text-primary" />
              <div className="text-left">
                <div className="text-xs font-medium">Load File</div>
                <div className="text-[10px] text-muted-foreground">Browse and pick a document</div>
              </div>
            </Button>
            <Button
              variant="outline"
              className="justify-start gap-2 h-12"
              onClick={() => {
                if (!pendingContextAction) return;
                addNode("store", pendingContextAction.x, pendingContextAction.y, {
                  label: "Context Store",
                });
                setPendingContextAction(null);
              }}
            >
              <span className="text-[9px] font-mono text-muted-foreground/60 w-4 shrink-0">3</span>
              <FolderInput className="w-4 h-4 text-primary" />
              <div className="text-left">
                <div className="text-xs font-medium">Save File</div>
                <div className="text-[10px] text-muted-foreground">Place a store node to save outputs</div>
              </div>
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Document picker dialog (after choosing Load File) — tree structure */}
      <Dialog
        open={pendingContextAction?.mode === "load"}
        onOpenChange={(open) => !open && setPendingContextAction(null)}
      >
        <DialogContent className="max-w-sm max-h-[60vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-sm">Pick a document</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-auto -mx-6 px-6">
            {docs.length === 0 && allFolders.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">No documents found</p>
            ) : (
              <div className="space-y-0.5">
                {pickerRootFolders.map((folder) => {
                  const renderPickerFolder = (f: FolderItem, depth: number): ReactNode => {
                    const isExpanded = pickerExpandedFolders.has(f.id);
                    const children = getPickerChildren(f.id);
                    const folderDocs = getPickerDocsInFolder(f.id);
                    const indent = treeIndent(depth);
                    return (
                      <div key={`f-${f.id}`}>
                        <button
                          className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded hover:bg-muted/50 text-left transition-colors"
                          style={{ paddingLeft: `${indent + 8}px` }}
                          onClick={() => setPickerExpandedFolders((prev) => {
                            const next = new Set(prev);
                            next.has(f.id) ? next.delete(f.id) : next.add(f.id);
                            return next;
                          })}
                        >
                          {isExpanded ? <ChevronDown className="w-3 h-3 shrink-0" /> : <ChevronRight className="w-3 h-3 shrink-0" />}
                          {isExpanded ? <FolderOpen className="w-3.5 h-3.5 text-amber-500 shrink-0" /> : <Folder className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
                          <span className="text-xs font-medium truncate">{f.name}</span>
                        </button>
                        {isExpanded && (
                          <>
                            {children.map((child) => renderPickerFolder(child, depth + 1))}
                            {folderDocs.map((doc) => (
                              <button
                                key={doc.id}
                                className="w-full flex items-center gap-2 py-1.5 rounded hover:bg-muted/50 text-left transition-colors"
                                style={{ paddingLeft: `${treeIndent(depth + 1) + 8}px` }}
                                onClick={() => handleDocPickFromDialog(doc.id, doc.title)}
                              >
                                <FileText className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                                <span className="text-xs truncate">{doc.title}</span>
                              </button>
                            ))}
                          </>
                        )}
                      </div>
                    );
                  };
                  return renderPickerFolder(folder, 0);
                })}
                {pickerRootDocs.map((doc) => (
                  <button
                    key={doc.id}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted/50 text-left transition-colors"
                    onClick={() => handleDocPickFromDialog(doc.id, doc.title)}
                  >
                    <FileText className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <span className="text-xs truncate">{doc.title}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Folder picker for Store node — folders only */}
      <Dialog
        open={!!storeFolderPickerNodeId}
        onOpenChange={(open) => !open && setStoreFolderPickerNodeId(null)}
      >
        <DialogContent className="max-w-xs max-h-[50vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-sm">Select save folder</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-auto -mx-6 px-6">
            <button
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted/50 text-left transition-colors"
              onClick={() => handleSelectStoreFolder(null, "Root", "/ (Root)")}
            >
              <FolderOpen className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              <span className="text-xs font-medium">/ (Root)</span>
            </button>
            {pickerRootFolders.map((folder) => {
              const renderStoreFolderPicker = (f: FolderItem, depth: number, parentPath: string): ReactNode => {
                const isExpanded = pickerExpandedFolders.has(f.id);
                const children = getPickerChildren(f.id);
                const path = parentPath ? `${parentPath} > ${f.name}` : f.name;
                const indent = treeIndent(depth);
                return (
                  <div key={`sf-${f.id}`}>
                    <div
                      className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded hover:bg-muted/50 transition-colors"
                      style={{ paddingLeft: `${indent + 8}px` }}
                    >
                      {children.length > 0 ? (
                        <button
                          className="shrink-0"
                          onClick={() => setPickerExpandedFolders((prev) => {
                            const next = new Set(prev);
                            next.has(f.id) ? next.delete(f.id) : next.add(f.id);
                            return next;
                          })}
                        >
                          {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                        </button>
                      ) : (
                        <span className="w-3 shrink-0" />
                      )}
                      <button
                        className="flex items-center gap-1.5 flex-1 text-left min-w-0"
                        onClick={() => handleSelectStoreFolder(f.id, f.name, path)}
                      >
                        <Folder className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                        <span className="text-xs font-medium truncate">{f.name}</span>
                      </button>
                    </div>
                    {isExpanded && children.map((child) => renderStoreFolderPicker(child, depth + 1, path))}
                  </div>
                );
              };
              return renderStoreFolderPicker(folder, 0, "");
            })}
            {allFolders.length === 0 && (
              <p className="text-[10px] text-muted-foreground/60 py-2 text-center">
                No folders yet. Create folders in the Context Store first.
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Open Canvas dialog */}
      <Dialog open={openCanvasDialogOpen} onOpenChange={setOpenCanvasDialogOpen}>
        <DialogContent className="max-w-sm max-h-[60vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-sm">Open Canvas</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-auto -mx-6 px-6">
            {canvasDocs.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">No saved canvases</p>
            ) : (
              <div className="space-y-0.5">
                {canvasDocs.map((doc) => (
                  <button
                    key={doc.id}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted/50 text-left transition-colors"
                    onClick={() => handleOpenCanvas(doc.id, doc.title)}
                  >
                    <ScanLine className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                    <span className="text-xs truncate">{doc.title}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Node Details Panel */}
      {detailsPanelOpen && (() => {
        const selectedIds = Array.from(state.selectedNodeIds);
        const selectedNode = selectedIds.length === 1 ? state.nodes.find((n) => n.id === selectedIds[0]) : null;
        if (!selectedNode) return (
          <div className="fixed right-0 top-0 bottom-0 w-80 z-[42] bg-card border-l border-border shadow-xl flex items-center justify-center animate-in slide-in-from-right duration-200">
            <p className="text-xs text-muted-foreground/50">Select a single node to view details</p>
          </div>
        );
        return (
          <FlowDetailsPanel
            node={selectedNode}
            nodes={state.nodes}
            edges={state.edges}
            onClose={() => setDetailsPanelOpen(false)}
            onUpdateNode={updateNode}
          />
        );
      })()}

      {/* Logic node type picker — lightweight popover, no overlay dimming */}
      {/* Edge role picker dialog: Context or Objective */}
      {pendingEdgeRole && (
        <Dialog open onOpenChange={() => setPendingEdgeRole(null)}>
          <DialogContent className="max-w-xs">
            <DialogHeader>
              <DialogTitle className="text-sm">Connection Role</DialogTitle>
            </DialogHeader>
            <p className="text-xs text-muted-foreground mb-3">
              How should the Research node use this document?
            </p>
            <div className="flex flex-col gap-2">
              <button
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-border hover:bg-muted transition-colors text-left"
                onClick={() => {
                  addEdge(pendingEdgeRole.fromNodeId, pendingEdgeRole.toNodeId, "context");
                  setPendingEdgeRole(null);
                }}
              >
                <BookOpenCheck className="w-4 h-4 text-amber-500 shrink-0" />
                <div>
                  <div className="text-xs font-medium">Context</div>
                  <div className="text-[10px] text-muted-foreground">Background information for the research</div>
                </div>
              </button>
              <button
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-border hover:bg-muted transition-colors text-left"
                onClick={() => {
                  addEdge(pendingEdgeRole.fromNodeId, pendingEdgeRole.toNodeId, "objective");
                  setPendingEdgeRole(null);
                }}
              >
                <Target className="w-4 h-4 text-blue-500 shrink-0" />
                <div>
                  <div className="text-xs font-medium">Objective / Starting Prompt</div>
                  <div className="text-[10px] text-muted-foreground">Sets the research topic and direction</div>
                </div>
              </button>
              <button
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-border hover:bg-muted transition-colors text-left"
                onClick={() => {
                  addEdge(pendingEdgeRole.fromNodeId, pendingEdgeRole.toNodeId, "output-format");
                  setPendingEdgeRole(null);
                }}
              >
                <LayoutTemplate className="w-4 h-4 text-violet-500 shrink-0" />
                <div>
                  <div className="text-xs font-medium">Output Format / Template</div>
                  <div className="text-[10px] text-muted-foreground">Schema or template the output must follow</div>
                </div>
              </button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {pendingLogicAction && (
        <>
          <div className="fixed inset-0 z-50" onClick={() => setPendingLogicAction(null)} />
          <div
            className="fixed z-50 bg-popover border border-border rounded-lg shadow-lg p-1 w-48 animate-in fade-in zoom-in-95 duration-100"
            style={{
              left: Math.min(pendingLogicAction.screenX + 20, window.innerWidth - 210),
              top: Math.min(pendingLogicAction.screenY - 60, window.innerHeight - 200),
            }}
          >
            <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Logic</div>
            {([
              { type: "filter" as const, icon: Filter, label: "Filter", color: "text-teal-500" },
              { type: "gate" as const, icon: ToggleRight, label: "Gate", color: "text-yellow-500" },
              { type: "router" as const, icon: GitBranch, label: "Router", color: "text-purple-500" },
              { type: "merge" as const, icon: MergeIcon, label: "Merge", color: "text-sky-500" },
            ]).map((item) => (
              <button
                key={item.type}
                className="flex items-center gap-2 w-full px-2 py-1.5 text-xs rounded hover:bg-muted transition-colors"
                onClick={() => {
                  addNode(item.type, pendingLogicAction.x, pendingLogicAction.y, {
                    label: item.label,
                    snippet: `${item.label} node`,
                    ...(item.type === "gate" ? { gateOpen: true } : {}),
                  });
                  setPendingLogicAction(null);
                }}
              >
                <item.icon className={`w-3.5 h-3.5 ${item.color}`} />
                {item.label}
              </button>
            ))}
          </div>
        </>
      )}

      {/* Label formatting dialog */}
      {activeLabelNodeId && (() => {
        const labelNode = state.nodes.find((n) => n.id === activeLabelNodeId);
        if (!labelNode) return null;
        const FONT_SIZES = [12, 14, 16, 20, 24, 32, 48];
        const COLOR_PRESETS = [
          { label: "Default", value: "text-foreground" },
          { label: "Amber", value: "text-amber-500" },
          { label: "Blue", value: "text-blue-500" },
          { label: "Red", value: "text-red-500" },
          { label: "Green", value: "text-emerald-500" },
          { label: "Stone", value: "text-stone-400" },
          { label: "White", value: "text-white" },
        ];
        return (
          <Dialog open onOpenChange={(open) => !open && setActiveLabelNodeId(null)}>
            <DialogContent className="max-w-sm">
              <DialogHeader>
                <DialogTitle className="text-sm flex items-center gap-2">
                  <Type className="w-4 h-4" /> Edit Label
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                {/* Text input */}
                <textarea
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-primary"
                  rows={3}
                  value={labelNode.label}
                  onChange={(e) => updateNode(activeLabelNodeId, { label: e.target.value })}
                  placeholder="Enter label text..."
                  autoFocus
                />

                {/* Font size */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-12">Size</span>
                  <div className="flex gap-1 flex-wrap">
                    {FONT_SIZES.map((size) => (
                      <button
                        key={size}
                        className={cn(
                          "px-2 py-0.5 text-xs rounded border transition-colors",
                          (labelNode.labelFontSize || 16) === size
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-muted/50 border-border hover:bg-muted",
                        )}
                        onClick={() => updateNode(activeLabelNodeId, { labelFontSize: size })}
                      >
                        {size}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Bold / Italic toggles */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-12">Style</span>
                  <button
                    className={cn(
                      "px-3 py-1 text-sm font-bold rounded border transition-colors",
                      labelNode.labelBold
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-muted/50 border-border hover:bg-muted",
                    )}
                    onClick={() => updateNode(activeLabelNodeId, { labelBold: !labelNode.labelBold })}
                  >
                    B
                  </button>
                  <button
                    className={cn(
                      "px-3 py-1 text-sm italic rounded border transition-colors",
                      labelNode.labelItalic
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-muted/50 border-border hover:bg-muted",
                    )}
                    onClick={() => updateNode(activeLabelNodeId, { labelItalic: !labelNode.labelItalic })}
                  >
                    I
                  </button>
                </div>

                {/* Color presets */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-12">Color</span>
                  <div className="flex gap-1 flex-wrap">
                    {COLOR_PRESETS.map((c) => (
                      <button
                        key={c.value}
                        className={cn(
                          "px-2 py-0.5 text-xs rounded border transition-colors",
                          c.value,
                          (labelNode.labelColor || "text-foreground") === c.value
                            ? "ring-2 ring-primary border-primary"
                            : "border-border hover:bg-muted/50",
                        )}
                        onClick={() => updateNode(activeLabelNodeId, { labelColor: c.value })}
                      >
                        {c.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Preview */}
                <div className="border rounded-md p-3 bg-muted/20">
                  <span className="text-[10px] text-muted-foreground block mb-1">Preview</span>
                  <p
                    style={{ fontSize: labelNode.labelFontSize || 16 }}
                    className={cn(
                      labelNode.labelBold && "font-bold",
                      labelNode.labelItalic && "italic",
                      labelNode.labelColor || "text-foreground",
                    )}
                  >
                    {labelNode.label || "Label"}
                  </p>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        );
      })()}

      {/* ── Unified expanded overlay (replaces 6 individual overlay blocks + chain nav) ── */}
      {activeExpandedNodeId && activeExpandedNode && (() => {
        const handleOverlayClose = () => {
          // Save document editor content before closing if needed
          if (activeExpandedNode.type === "document" && !activeExpandedNode.imageUrl) {
            handleCloseDocumentEditor();
          }
          setActiveExpandedNodeId(null);
        };

        // Render type-specific expanded content
        const renderExpandedContent = () => {
          switch (activeExpandedNode.type) {
            case "research":
              return (
                <NotebookResearchChat
                  key={activeExpandedNodeId}
                  objective=""
                  onCaptureToContext={handleResearchCapture}
                  initialMessages={activeExpandedNode.researchMessages as ChatMessageWithMeta[] | undefined}
                  onMessagesChange={handleResearchMessagesChange}
                  connectionContext={researchConnectionCtx}
                  onEmitOutput={handleResearchOutput}
                />
              );

            case "document":
              if (activeExpandedNode.imageUrl) {
                // Image viewer
                return (
                  <div className="flex-1 flex items-center justify-center p-4 overflow-auto">
                    <img
                      src={activeExpandedNode.imageUrl}
                      alt={activeExpandedNode.label || "Image"}
                      className="max-w-full max-h-full object-contain rounded-lg shadow-xl"
                      draggable={false}
                    />
                  </div>
                );
              }
              // Document editor with tools panel
              return (
                <div className="flex-1 flex overflow-hidden">
                  <div className="w-1/3 max-w-[320px] border-r bg-card/50 flex flex-col overflow-auto">
                    <div className="p-3 border-b">
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                        Tools
                      </h3>
                      <div className="grid grid-cols-2 gap-1.5">
                        {DOC_TOOLS.map((tool) => (
                          <button
                            key={tool.id}
                            className="flex items-center gap-1.5 px-2.5 py-2 rounded-md border border-border/50 hover:bg-muted/50 transition-colors text-left disabled:opacity-50"
                            disabled={docToolRunning !== null}
                            onClick={() => handleDocTool(tool.instruction, tool.id)}
                          >
                            {docToolRunning === tool.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin text-primary shrink-0" />
                            ) : (
                              <tool.icon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                            )}
                            <span className="text-[11px] font-medium">{tool.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="p-3 flex-1">
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                        Connected Inputs
                      </h3>
                      {(() => {
                        const inputEdges = state.edges.filter((e) => e.toNodeId === activeExpandedNodeId);
                        const inputNodes = inputEdges
                          .map((e) => state.nodes.find((n) => n.id === e.fromNodeId))
                          .filter(Boolean);
                        if (inputNodes.length === 0) {
                          return (
                            <p className="text-[10px] text-muted-foreground/60 italic">
                              No connected inputs. Drag edges from other nodes to this document.
                            </p>
                          );
                        }
                        return (
                          <div className="space-y-1.5">
                            {inputNodes.map((n) => n && (
                              <div key={n.id} className="px-2 py-1.5 rounded border border-border/50 bg-muted/30">
                                <p className="text-[10px] font-medium">{n.label}</p>
                                <p className="text-[9px] text-muted-foreground line-clamp-2 mt-0.5">
                                  {n.content || n.snippet || "No content"}
                                </p>
                              </div>
                            ))}
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                  <div className="flex-1 flex flex-col overflow-hidden">
                    <div className="flex-1 overflow-auto p-4">
                      <ProvokeText
                        value={docEditorContent}
                        onChange={setDocEditorContent}
                        chrome="container"
                        variant="editor"
                        label="Document"
                        showCopy
                        showClear
                        placeholder="Start writing your document..."
                      />
                    </div>
                  </div>
                </div>
              );

            case "painter":
              return (
                <ArtifyPanel
                  sourceText={painterSourceText}
                  sourceLabel={painterSourceText ? "Connected nodes" : "No inputs"}
                  onClose={handleOverlayClose}
                  onImageGenerated={handlePainterImageGenerated}
                />
              );

            case "interview":
              return (
                <FlowInterviewOverlay
                  node={activeExpandedNode}
                  onClose={handleOverlayClose}
                  onUpdateNode={updateNode}
                  onExportTranscript={handleInterviewExport}
                  connectionContext={interviewConnectionCtx}
                  embedded
                />
              );

            case "llm":
              return (
                <LlmExpandedView
                  node={activeExpandedNode}
                  nodes={state.nodes}
                  edges={state.edges}
                  onUpdateNode={updateNode}
                />
              );

            case "audio":
              return (
                <AudioExpandedView
                  node={activeExpandedNode}
                  onUpdateNode={updateNode}
                />
              );

            case "youtube":
              return (
                <YoutubeExpandedView
                  node={activeExpandedNode}
                  onUpdateNode={updateNode}
                />
              );

            case "timer-event":
              return (
                <TimerExpandedView
                  node={activeExpandedNode}
                  onUpdateNode={updateNode}
                  onPlayNode={handlePlayNode}
                  allNodes={state.nodes}
                  allEdges={state.edges}
                />
              );

            case "social-post":
              return (
                <SocialPostExpandedView
                  node={activeExpandedNode}
                  nodes={state.nodes}
                  edges={state.edges}
                  onUpdateNode={updateNode}
                  onPlayNode={handlePlayNode}
                />
              );

            case "api-connection":
              return (
                <ApiConnectionExpandedView
                  node={activeExpandedNode}
                  nodes={state.nodes}
                  edges={state.edges}
                  onUpdateNode={updateNode}
                  onPlayNode={handlePlayNode}
                />
              );

            case "filter":
            case "gate":
            case "router":
            case "merge":
              return (
                <LogicExpandedView
                  node={activeExpandedNode}
                  nodes={state.nodes}
                  edges={state.edges}
                  onUpdateNode={updateNode}
                />
              );

            default:
              // Generic fullscreen: editable label + content
              return (
                <div className="flex-1 overflow-auto p-6">
                  <div className="mb-4">
                    <label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold block mb-1">
                      Label
                    </label>
                    <input
                      className="w-full text-lg font-semibold bg-transparent border-b border-border/50 pb-1 focus:outline-none focus:border-primary"
                      value={activeExpandedNode.label || ""}
                      onChange={(e) => updateNode(activeExpandedNode.id, { label: e.target.value })}
                    />
                  </div>
                  <div className="mb-4">
                    <label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold block mb-1">
                      Content
                    </label>
                    <textarea
                      className="w-full min-h-[300px] text-sm bg-muted/30 border border-border/50 rounded-lg p-3 resize-y focus:outline-none focus:ring-1 focus:ring-primary/50 leading-relaxed"
                      value={activeExpandedNode.content || activeExpandedNode.documentContent || ""}
                      onChange={(e) => updateNode(activeExpandedNode.id, {
                        content: e.target.value,
                        documentContent: e.target.value,
                        snippet: e.target.value.slice(0, 200),
                      })}
                      placeholder="No content yet..."
                    />
                  </div>
                  {activeExpandedNode.imageUrl && (
                    <div className="mb-4">
                      <label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold block mb-1">
                        Image
                      </label>
                      <img
                        src={activeExpandedNode.imageUrl}
                        alt={activeExpandedNode.label || "Image"}
                        className="max-w-full max-h-[400px] object-contain rounded-lg border border-border/30"
                      />
                    </div>
                  )}
                </div>
              );
          }
        };

        return (
          <FlowExpandedOverlay
            nodeId={activeExpandedNodeId}
            node={activeExpandedNode}
            sourceRect={expandSourceRect}
            nodes={state.nodes}
            edges={state.edges}
            onClose={handleOverlayClose}
            onNavigate={navigateToNode}
            onUpdateNode={updateNode}
          >
            {renderExpandedContent()}
          </FlowExpandedOverlay>
        );
      })()}

      {/* Connections dialog */}
      <Dialog open={connectionsDialogOpen} onOpenChange={setConnectionsDialogOpen}>
        <DialogContent className="max-w-md max-h-[70vh] flex flex-col p-0">
          <DialogTitle className="sr-only">Connections</DialogTitle>
          <ConnectionsManager onBack={() => setConnectionsDialogOpen(false)} />
        </DialogContent>
      </Dialog>

      {/* Platform Integrations dialog */}
      <PlatformIntegrations open={integrationsDialogOpen} onOpenChange={setIntegrationsDialogOpen} />

      {/* Share Canvas dialog */}
      {canvasDocumentId && (
        <ShareDialog
          open={shareDialogOpen}
          onOpenChange={setShareDialogOpen}
          itemType="document"
          itemId={canvasDocumentId}
          itemTitle={canvasTitle || "Flow Canvas"}
        />
      )}
    </FtuxShell>
  );
}

export default function FlowWorkspace() {
  const { shellConfig, setShellConfig } = useFtuxShellConfig();

  // Merge user's persisted config with FlowWorkspace defaults:
  // Always use FLOW_DOCK_ITEMS (not the FtuxWorkspace defaults) and force tourCompleted
  const mergedConfig = useMemo<FtuxShellConfig>(() => ({
    ...shellConfig,
    dockItems: FLOW_DOCK_ITEMS,
    dockShowLabels: shellConfig.dockShowLabels ?? FLOW_SHELL_CONFIG.dockShowLabels,
    dockSnapped: shellConfig.dockSnapped ?? FLOW_SHELL_CONFIG.dockSnapped,
    dockButtonSize: shellConfig.dockButtonSize ?? FLOW_SHELL_CONFIG.dockButtonSize,
    tourCompleted: true,
    tipsEnabled: false,
  }), [shellConfig]);

  return (
    <FtuxShellProvider initialConfig={mergedConfig} onConfigChange={setShellConfig}>
      <FlowWorkspaceInner />
    </FtuxShellProvider>
  );
}
