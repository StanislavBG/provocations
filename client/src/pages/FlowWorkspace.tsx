import { Suspense, useCallback, useRef, useState, useEffect, useMemo, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useRoute, useLocation } from "wouter";
import { cn, generateId } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { useUser } from "@clerk/clerk-react";
import { FtuxShellProvider, useFtuxShell } from "@/lib/ftux-shell-context";
import type { FtuxShellConfig, DockItem, ToolId } from "@/lib/ftux-shell-context";
import { matchesAction } from "@/lib/keybind-actions";
import { FtuxShell } from "@/components/ftux/FtuxShell";
import { FtuxStatusBar } from "@/components/ftux/FtuxStatusBar";
import { FtuxDock } from "@/components/ftux/FtuxDock";
import { FlowCanvas } from "@/components/flow/FlowCanvas";
import { useFlowCanvas } from "@/components/flow/useFlowCanvas";
import type { FlowNode, FlowEdge, FlowViewport, EdgeRole, FlowNodeType } from "@/components/flow/useFlowCanvas";
import { DEFAULT_DIMENSIONS } from "@/components/flow/useFlowCanvas";
import { ROLE_AWARE_TARGETS } from "@/components/flow/FlowNodeRegistry";
import { useMinimapState } from "@/components/flow/useMinimapState";
import { NotebookResearchChat } from "@/components/notebook/NotebookResearchChat";
// DEFAULT_SHELL_CONFIG moved to flow-workspace/FlowDockConfig.ts
import { useFtuxShellConfig } from "@/hooks/use-ftux-shell-config";
import { getPreset } from "@/components/flow/llm-presets";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useCanvasCollab } from "@/hooks/use-canvas-collab";
import { Button } from "@/components/ui/button";
import { ProvokeText } from "@/components/ProvokeText";
import { VoiceRecorder } from "@/components/VoiceRecorder";
import { ShareDialog } from "@/components/ShareDialog";
import { ArtifyPanel } from "@/components/ArtifyPanel";
import { ConnectionsManager } from "@/components/ConnectionsManager";
import { MailboxDrawer } from "@/components/MailboxDrawer";
import { FlowNodeFullscreen } from "@/components/flow/FlowNodeFullscreen";
import { FlowInterviewOverlay } from "@/components/flow/FlowInterviewOverlay";
import { FlowChainNavBar } from "@/components/flow/FlowChainNavBar";
import { ChainProgressBar } from "@/components/flow/ChainProgressBar";
import { useChainExecutor } from "@/components/flow/useChainExecutor";
import type { ChainProgress } from "@/components/flow/useChainExecutor";
import { FlowExpandedOverlay } from "@/components/flow/FlowExpandedOverlay";
import { FlowOverlayErrorBoundary } from "@/components/flow/FlowOverlayErrorBoundary";
import { FlowDetailsPanel } from "@/components/flow/FlowDetailsPanel";
import { FLOW_NODE_REGISTRY } from "@/components/flow/FlowNodeRegistry";
import type { LifecyclePreset } from "@/components/flow/FlowNodeRegistry";
// DOCK_TOOL_CATALOG moved to flow-workspace/FlowDockConfig.ts
import { useLifecycleEngine } from "@/components/flow/useLifecycleEngine";
import { getLifecycleHandlers } from "@/components/flow/lifecycles/index";
import { gatherInputContentWithRoles, gatherChainContext, gatherStructuredChainContext } from "@/components/flow/useNodeLifecycle";
import type { NodeProcessContext } from "@/components/flow/useNodeLifecycle";
import { parsePainterOutput } from "@/components/flow/lifecycles/painter";
import { ActivityLogsOverlay } from "@/components/flow/ActivityLogsOverlay";
import { lifecycleLogStore } from "@/lib/lifecycleLog";
import type { LifecyclePhase, LifecycleStatus } from "@/lib/lifecycleLog";
import { FlowLoadingBar } from "@/components/flow/FlowLoadingBar";
// ── Expanded views are lazy-loaded (E5 optimization) ──
// See client/src/components/flow/expanded/lazyExpandedViews.ts
import { lazyExpandedViews } from "@/components/flow/expanded/lazyExpandedViews";
const LlmExpandedView = lazyExpandedViews["llm"];
const LlmBaseExpandedView = lazyExpandedViews["llm-base"];
const AudioExpandedView = lazyExpandedViews["audio"];
const YoutubeExpandedView = lazyExpandedViews["youtube"];
const TimerExpandedView = lazyExpandedViews["timer-event"];
const LogicExpandedView = lazyExpandedViews["filter"]; // filter/gate/router/merge all use LogicExpandedView
const SocialPostExpandedView = lazyExpandedViews["social-post"];
const ApiConnectionExpandedView = lazyExpandedViews["api-connection"];
const CoherenceGateExpandedView = lazyExpandedViews["coherence-gate"];
const NotificationExpandedView = lazyExpandedViews["notification"];
const ApprovalExpandedView = lazyExpandedViews["approval"];
const StoreExpandedView = lazyExpandedViews["store"];
const UploadExpandedView = lazyExpandedViews["upload"];
const WebpageExpandedView = lazyExpandedViews["webpage"];
const EventBusExpandedView = lazyExpandedViews["event-bus"];
import { EdgeRolePickerDialog } from "@/components/flow/EdgeRolePickerDialog";
import { BlueprintsMenu } from "@/components/flow/BlueprintsMenu";
import { serializeCanvas, serializeNodeForSave } from "@/components/flow/serializeCanvas";
import { PlatformIntegrations } from "@/components/PlatformIntegrations";
import { ConnectedAppsDialog } from "@/components/ConnectedAppsDialog";
import { ContextStoreManager } from "@/components/ContextStoreManager";
import { WelcomeOverlay } from "@/components/WelcomeOverlay";
import { KeyboardShortcutsOverlay } from "@/components/KeyboardShortcutsOverlay";
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
  Lightbulb, Paintbrush2, PenLine, Users, Wifi,
  Filter, ToggleRight, GitBranch, Merge as MergeIcon, Pause, Play as PlayIcon, ShieldCheck,
  Plus, Type, Target, BookOpenCheck, LayoutTemplate, Map as MapIcon,
  Search, Zap, Settings, ScrollText, Trash2, Swords, Wrench, Info, Crosshair,
  PanelLeft, PanelLeftClose, Send, Mic, Clock,
} from "lucide-react";
import type { ChatMessageWithMeta, ProvocationType } from "@shared/schema";
import { ProvoThread } from "@/components/notebook/ProvoThread";
import { APP_VERSION, RELEASE_NOTES } from "@/lib/version";
import { WhatsNew } from "@/components/WhatsNew";
import { HelpButton } from "@/components/HelpButton";

// ── Extracted modules (E7 decomposition) ──
import { FLOW_DOCK_ITEMS, FLOW_SHELL_CONFIG } from "./flow-workspace/FlowDockConfig";
import { DOC_TOOLS, splitOutputByDelimiters, splitOutputIntoSections, quickHash } from "./flow-workspace/FlowToolHandlers";

// ── Canvas styles — re-exported from shared module to avoid circular deps ──
export { CANVAS_STYLES, type CanvasStyleDef } from "@/lib/canvas-styles";
import { CANVAS_STYLES } from "@/lib/canvas-styles";

/** @deprecated Use CANVAS_STYLES instead */
export const CANVAS_THEMES = CANVAS_STYLES;

// ── Document list item type ──

interface DocumentListItem {
  id: number;
  title: string;
  docType?: string;
  folderId?: number | null;
  updatedAt?: string;
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

/** Collapsible tabbed connected inputs for Document fullscreen */
function DocConnectedInputs({ nodeId, edges, nodes }: { nodeId: string; edges: FlowEdge[]; nodes: FlowNode[] }) {
  const [expanded, setExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState(0);

  const inputNodes = useMemo(() => {
    const inputEdges = edges.filter((e) => e.toNodeId === nodeId);
    return inputEdges
      .map((e) => nodes.find((n) => n.id === e.fromNodeId))
      .filter(Boolean) as FlowNode[];
  }, [nodeId, edges, nodes]);

  if (inputNodes.length === 0) {
    return (
      <div className="p-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
          Connected Inputs
        </h3>
        <p className="text-[10px] text-muted-foreground/60 italic">
          No connected inputs. Drag edges from other nodes to this document.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-3 my-2 rounded-md border border-border/50 overflow-hidden">
      <button
        className="w-full flex items-center gap-1.5 px-3 py-1.5 text-left hover:bg-muted/30 transition-colors"
        onClick={() => setExpanded((v) => !v)}
      >
        {expanded ? (
          <ChevronDown className="w-3 h-3 text-muted-foreground shrink-0" />
        ) : (
          <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0" />
        )}
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
          Connected Inputs
        </span>
        <span className="text-[9px] text-muted-foreground/70">
          ({inputNodes.length})
        </span>
      </button>
      {expanded && (
        <div className="border-t border-border/50">
          <div className="flex border-b border-border/30 overflow-x-auto">
            {inputNodes.map((n, i) => (
              <button
                key={n.id}
                className={`shrink-0 px-2.5 py-1 text-[9px] font-medium transition-colors border-b-2 ${
                  activeTab === i
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => setActiveTab(i)}
              >
                {(n.label || "Input").length > 18 ? (n.label || "Input").slice(0, 18) + "…" : (n.label || "Input")}
              </button>
            ))}
          </div>
          <div className="p-2.5 max-h-28 overflow-y-auto">
            <p className="text-[10px] text-muted-foreground whitespace-pre-wrap">
              {inputNodes[activeTab]?.documentContent || inputNodes[activeTab]?.content || inputNodes[activeTab]?.snippet || "No content"}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// DOC_TOOLS, splitOutputByDelimiters, splitOutputIntoSections, and quickHash
// are now imported from ./flow-workspace/FlowToolHandlers.ts (E7 decomposition)

// ── Inner workspace (needs shell context) ──

function FlowWorkspaceInner() {
  const { activeTool, setActiveTool, dockItems, dockHidden, canvasFontSize, canvasTheme, setCanvasTheme, keyBinds } = useFtuxShell();
  const {
    state, addNode, addEdge, updateNode, pushUndoSnapshot, moveNode, moveNodes, bringToFront, deleteNode, deleteNodes, deleteEdge,
    selectNode, selectNodes, selectAll, toggleSelectNode, setViewport, loadCanvas: loadCanvasRaw, resetCanvas,
    undo, redo,
  } = useFlowCanvas();
  const canvasGenerationRef = useRef(0);
  const loadCanvas = useCallback(
    (snapshot: Parameters<typeof loadCanvasRaw>[0]) => {
      canvasGenerationRef.current++;
      loadCanvasRaw(snapshot);
    },
    [loadCanvasRaw],
  );
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const { user } = useUser();
  const minimapState = useMinimapState();
  const [routeMatch, routeParams] = useRoute("/canvas/:canvasId");
  const [nodeRouteMatch, nodeRouteParams] = useRoute("/canvas/:canvasId/node/:nodeId");
  const [, setLocation] = useLocation();
  const urlCanvasId = (nodeRouteMatch && nodeRouteParams?.canvasId)
    ? parseInt(nodeRouteParams.canvasId, 10)
    : (routeMatch && routeParams?.canvasId ? parseInt(routeParams.canvasId, 10) : null);
  const urlNodeId = nodeRouteMatch && nodeRouteParams?.nodeId ? nodeRouteParams.nodeId : null;

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

  // (Blueprint events removed — blueprints are now loaded via the Blueprints menu)

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
  const activeExpandedNodeIdRef = useRef(activeExpandedNodeId);
  activeExpandedNodeIdRef.current = activeExpandedNodeId;
  const [expandSourceRect, setExpandSourceRect] = useState<DOMRect | null>(null);

  // ── URL sync helpers for node overlay deep-linking ──
  // Extract canvas ID from current URL path to avoid dependency ordering issues
  const getCanvasIdFromUrl = useCallback(() => {
    const match = window.location.pathname.match(/^\/canvas\/(\d+)/);
    return match ? match[1] : null;
  }, []);

  const openExpandedNode = useCallback((nodeId: string) => {
    setExpandSourceRect(null);
    setActiveExpandedNodeId(nodeId);
    const cid = getCanvasIdFromUrl();
    if (cid) {
      window.history.replaceState(null, "", `/canvas/${cid}/node/${nodeId}`);
    }
  }, [getCanvasIdFromUrl]);

  const closeExpandedNode = useCallback(() => {
    setActiveExpandedNodeId(null);
    const cid = getCanvasIdFromUrl();
    if (cid) {
      window.history.replaceState(null, "", `/canvas/${cid}`);
    }
  }, [getCanvasIdFromUrl]);

  // Legacy overlay states kept for dialog-based overlays (not full-screen)
  const [activeLabelNodeId, setActiveLabelNodeId] = useState<string | null>(null);
  const [pendingLogicAction, setPendingLogicAction] = useState<{ x: number; y: number; screenX: number; screenY: number } | null>(null);
  const [pendingEdgeRole, setPendingEdgeRole] = useState<{ fromNodeId: string; toNodeId: string } | null>(null);
  const [detailsPanelOpen, setDetailsPanelOpen] = useState(false);
  const [docEditorContent, setDocEditorContent] = useState("");
  const [docObjective, setDocObjective] = useState("");
  const [docVersions, setDocVersions] = useState<Array<{ content: string; label: string; timestamp: string }>>([]);
  const [docLeftTab, setDocLeftTab] = useState<"tools" | "provo">("provo");
  const [docSidebarOpen, setDocSidebarOpen] = useState(true);
  const [docSidebarWidth, setDocSidebarWidth] = useState(300);
  const [docActivePersonas, setDocActivePersonas] = useState<Set<ProvocationType>>(() => {
    const pool: ProvocationType[] = ["ceo", "product_manager", "quality_engineer", "ux_designer", "tech_writer", "growth_strategist", "brand_strategist", "content_strategist"];
    const random = pool[Math.floor(Math.random() * pool.length)];
    return new Set<ProvocationType>(["thinking_bigger", "architect", random]);
  });
  const [docToolRunning, setDocToolRunning] = useState<string | null>(null);
  const [docProvoEvolving, setDocProvoEvolving] = useState(false);
  const [docWriterTextOpen, setDocWriterTextOpen] = useState(false);
  const [docWriterFeedbackText, setDocWriterFeedbackText] = useState("");
  const [docWriterVoiceActive, setDocWriterVoiceActive] = useState(false);
  const [docDirectVoiceActive, setDocDirectVoiceActive] = useState(false);
  const [docDirectTextOpen, setDocDirectTextOpen] = useState(false);
  const [docDirectText, setDocDirectText] = useState("");
  const docWriterTextInputRef = useRef<HTMLInputElement>(null);
  const docDirectTextInputRef = useRef<HTMLInputElement>(null);
  const docEditorRef = useRef<HTMLTextAreaElement | null>(null);
  // Selection popover for quick actions on highlighted text
  const [docSelectionPopover, setDocSelectionPopover] = useState<{
    text: string;
    top: number;
    left: number;
  } | null>(null);
  const [docSelEditMode, setDocSelEditMode] = useState<"voice-remix" | "text-remix" | "voice-direct" | "text-direct" | null>(null);
  const [docSelEditText, setDocSelEditText] = useState("");
  const [docSelVoiceActive, setDocSelVoiceActive] = useState(false);
  const docEditorContainerRef = useRef<HTMLDivElement>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [canvasLoading, setCanvasLoading] = useState(false);
  const [loadProgress, setLoadProgress] = useState<number | undefined>(undefined);
  const [canvasLoadError, setCanvasLoadError] = useState<string | null>(null);
  const [frozen, setFrozen] = useState(false);
  const [blueprintsExternalOpen, setBlueprintsExternalOpen] = useState(false);
  // Resolve the active canvas theme
  const activeTheme = CANVAS_STYLES.find((t) => t.key === canvasTheme) ?? CANVAS_STYLES[0];
  const [storeFolderPickerNodeId, setStoreFolderPickerNodeId] = useState<string | null>(null);
  const [pickerExpandedFolders, setPickerExpandedFolders] = useState<Set<number>>(new Set());

  // Sync hero div visibility with canvas theme
  useEffect(() => {
    const hero = document.getElementById("hero");
    if (hero) {
      hero.style.display = activeTheme.heroVisible ? "" : "none";
    }
  }, [activeTheme.heroVisible]);
  const [canvasDocumentId, setCanvasDocumentIdRaw] = useState<number | null>(() => {
    // URL param takes priority over localStorage
    if (urlCanvasId && !isNaN(urlCanvasId)) return urlCanvasId;
    try {
      const stored = localStorage.getItem("flow:lastCanvasId");
      return stored ? parseInt(stored, 10) : null;
    } catch { return null; }
  });
  // Wrap setter to also sync the URL
  const setCanvasDocumentId = useCallback((id: number | null) => {
    setCanvasDocumentIdRaw(id);
    if (id) {
      setLocation(`/canvas/${id}`, { replace: true });
    } else {
      setLocation("/", { replace: true });
    }
  }, [setLocation]);
  const [canvasTitle, setCanvasTitle] = useState(() => {
    try { return localStorage.getItem("flow:lastCanvasTitle") || ""; } catch { return ""; }
  });
  const [openCanvasDialogOpen, setOpenCanvasDialogOpen] = useState(false);
  const [connectionsDialogOpen, setConnectionsDialogOpen] = useState(false);
  const [integrationsDialogOpen, setIntegrationsDialogOpen] = useState(false);
  const [connectedAppsOpen, setConnectedAppsOpen] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [mailboxOpen, setMailboxOpen] = useState(false);
  // Track whether the currently open canvas is shared (not owned by us)
  const [isSharedCanvas, setIsSharedCanvas] = useState(false);
  const [sharedPermission, setSharedPermission] = useState<"read" | "write">("read");

  // Mailbox unread count for status bar badge
  const { data: mailboxUnreadCount = 0 } = useQuery<number>({
    queryKey: ["/api/mailbox/unread-count"],
    refetchInterval: 30000,
  });
  // Canvas is always live — collab is on whenever a canvas ID exists
  const collabEnabled = true;
  const [lifecycleConsoleOpen, setLifecycleConsoleOpen] = useState(false);
  const [releaseNotesOpen, setReleaseNotesOpen] = useState(false);
  const [contextStoreOpen, setContextStoreOpen] = useState(false);
  const [pendingContextAction, setPendingContextAction] = useState<{ x: number; y: number; mode?: "load" | "save" } | null>(null);

  // ── Workspace tabs ──
  type WorkspaceTab = { id: string; label: string; snapshot: { nodes: FlowNode[]; edges: FlowEdge[]; viewport: FlowViewport } };
  const [workspaceTabs, setWorkspaceTabs] = useState<WorkspaceTab[]>([
    { id: "main", label: "Canvas 1", snapshot: { nodes: [], edges: [], viewport: { x: 0, y: 0, zoom: 1 } } },
  ]);
  const [activeTabId, setActiveTabId] = useState("main");
  const activeTabIdRef = useRef(activeTabId);
  activeTabIdRef.current = activeTabId;
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
  // (Blueprint refs removed — blueprints use the API menu now)

  // ── Real-time collaboration ──

  const collabStateRef = useRef(state);
  collabStateRef.current = state;

  const handleRemoteOperation = useCallback(
    (op: { type: string; payload: Record<string, unknown>; senderId: string }) => {
      if (op.senderId === user?.id) return; // ignore own echoes
      if (op.type === "add-node" && op.payload.node) {
        const node = op.payload.node as FlowNode;
        // Spread all node properties to preserve ID, event-bus config, etc.
        const { type: _t, x: _x, y: _y, width: _w, height: _h, zIndex: _z, ...rest } = node;
        addNode(node.type, node.x, node.y, {
          ...rest,
          label: node.label || "Node",
        });
      } else if (op.type === "move-node" && op.payload.nodeId) {
        moveNode(op.payload.nodeId as string, op.payload.x as number, op.payload.y as number);
      } else if (op.type === "delete-node" && op.payload.nodeId) {
        deleteNode(op.payload.nodeId as string);
      } else if (op.type === "add-edge" && op.payload.fromNodeId && op.payload.toNodeId) {
        addEdge(op.payload.fromNodeId as string, op.payload.toNodeId as string, op.payload.role as EdgeRole | EdgeRole[] | undefined);
      } else if (op.type === "delete-edge" && op.payload.edgeId) {
        deleteEdge(op.payload.edgeId as string);
      } else if (op.type === "update-node" && op.payload.nodeId) {
        const { nodeId, ...updates } = op.payload;
        updateNode(nodeId as string, updates as Partial<FlowNode>);
      }
    },
    [user?.id, addNode, moveNode, deleteNode, addEdge, deleteEdge, updateNode],
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
      if (activeExpandedNodeIdRef.current) return;
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
        const logicTypes: Array<{ type: "filter" | "gate" | "coherence-gate" | "router" | "merge"; label: string; snippet: string }> = [
          { type: "filter", label: "Filter", snippet: "Pass through if condition met" },
          { type: "gate", label: "Gate", snippet: "Manual on/off switch" },
          { type: "coherence-gate", label: "Coherence Gate", snippet: "Quality checkpoint with scoring" },
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
            ...(lt.type === "coherence-gate" ? {
              coherenceThreshold: 75,
              coherenceChecks: { topicMatch: true, toneConsistency: true, factDrift: false, styleMatch: false },
              coherenceStrictness: "medium" as const,
              coherenceRetryCount: 1,
            } : {}),
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
      if (activeExpandedNodeIdRef.current) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement)?.isContentEditable) return;

      // Undo
      if (matchesAction(e, "edit.undo", keyBinds)) {
        undo();
        e.preventDefault();
        return;
      }

      // Redo
      if (matchesAction(e, "edit.redo", keyBinds)) {
        redo();
        e.preventDefault();
        return;
      }

      // Select all
      if (matchesAction(e, "selection.selectAll", keyBinds)) {
        selectAll();
        e.preventDefault();
        return;
      }

      // Toggle minimap
      if (matchesAction(e, "canvas.minimap", keyBinds)) {
        minimapStateRef.current.toggleVisible();
        e.preventDefault();
        return;
      }

      // Deselect all
      if (matchesAction(e, "selection.deselectAll", keyBinds)) {
        selectNode(null);
        return;
      }

      // Copy selected nodes
      if (matchesAction(e, "edit.copy", keyBinds)) {
        const selected = stateRef.current.nodes.filter((n) => stateRef.current.selectedNodeIds.has(n.id));
        if (selected.length === 0) return;
        const selectedIds = new Set(selected.map((n) => n.id));
        const internalEdges = stateRef.current.edges.filter(
          (edge) => selectedIds.has(edge.fromNodeId) && selectedIds.has(edge.toNodeId),
        );
        clipboardRef.current = { nodes: selected, edges: internalEdges };
        toast({ title: `Copied ${selected.length} node${selected.length > 1 ? "s" : ""}` });
        e.preventDefault();
      }

      // Paste at mouse position
      if (matchesAction(e, "edit.paste", keyBinds) && clipboardRef.current) {
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

      // Delete selected nodes
      if (matchesAction(e, "edit.delete", keyBinds)) {
        const selected = Array.from(stateRef.current.selectedNodeIds);
        for (const id of selected) {
          deleteNode(id);
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [addNode, addEdge, deleteNode, selectNode, selectNodes, selectAll, undo, redo, toast, keyBinds]);

  // ── Keyboard zoom: +/- with progressive acceleration when held ──

  useEffect(() => {
    const ZOOM_MIN = 0.1;
    const ZOOM_MAX = 4;
    // Progressive: starts at 1.08 (8%), accelerates to 1.35 (35%) over ~1.5s of holding
    const BASE_FACTOR = 1.08;
    const MAX_FACTOR = 1.35;
    const ACCEL_PER_TICK = 0.015;
    const INTERVAL_MS = 60;

    let activeDir: "in" | "out" | null = null;
    let intervalId: ReturnType<typeof setInterval> | null = null;
    let currentFactor = BASE_FACTOR;

    function applyZoom(direction: "in" | "out") {
      const s = stateRef.current;
      const el = canvasContainerRef.current;
      const w = el?.clientWidth ?? 800;
      const h = el?.clientHeight ?? 600;
      const centerX = w / 2;
      const centerY = h / 2;
      const factor = direction === "in" ? currentFactor : 1 / currentFactor;
      const newZoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, s.viewport.zoom * factor));
      const newX = centerX - (centerX - s.viewport.x) * (newZoom / s.viewport.zoom);
      const newY = centerY - (centerY - s.viewport.y) * (newZoom / s.viewport.zoom);
      setViewport(newX, newY, newZoom);
      currentFactor = Math.min(MAX_FACTOR, currentFactor + ACCEL_PER_TICK);
    }

    function startZoom(dir: "in" | "out") {
      if (activeDir) return;
      activeDir = dir;
      currentFactor = BASE_FACTOR;
      applyZoom(dir);
      intervalId = setInterval(() => applyZoom(dir), INTERVAL_MS);
    }

    function stopZoom() {
      activeDir = null;
      currentFactor = BASE_FACTOR;
      if (intervalId) { clearInterval(intervalId); intervalId = null; }
    }

    const onDown = (e: KeyboardEvent) => {
      if (activeExpandedNodeIdRef.current) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement)?.isContentEditable) return;
      if (e.repeat) return;
      if (matchesAction(e, "canvas.zoomIn", keyBinds)) {
        e.preventDefault();
        startZoom("in");
      } else if (matchesAction(e, "canvas.zoomOut", keyBinds)) {
        e.preventDefault();
        startZoom("out");
      }
    };

    const onUp = (_e: KeyboardEvent) => {
      // Stop zoom on any key-up when zooming (simplest reliable approach)
      if (activeDir) stopZoom();
    };

    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
      stopZoom();
    };
  }, [setViewport, keyBinds]);

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

  // ── Load blueprint from API ──
  const handleLoadBlueprint = useCallback(async (blueprintId: string) => {
    try {
      const res = await fetch(`/api/blueprints/${blueprintId}`);
      if (!res.ok) {
        toast({ title: "Failed to load blueprint", variant: "destructive" });
        return;
      }
      const blueprint = await res.json();
      const pos = getCenter();
      const idMap = new Map<string, string>();

      // Create nodes with remapped IDs
      for (const src of blueprint.nodes) {
        const newId = addNode(src.type, pos.x + src.x, pos.y + src.y, {
          label: src.label,
          snippet: src.snippet,
          content: src.content,
          documentContent: src.documentContent,
          llmPresetId: src.llmPresetId,
          llmObjective: src.llmObjective,
          llmStatus: "idle",
          researchQuery: src.researchQuery,
          outputConfig: src.outputConfig,
          triggerMode: src.triggerMode,
          timerRunning: false,
          timerPulseCount: 0,
          timerInterval: src.timerInterval,
          coherenceThreshold: src.coherenceThreshold,
          coherenceChecks: src.coherenceChecks,
          coherenceStrictness: src.coherenceStrictness,
          coherenceRetryCount: src.coherenceRetryCount,
          coherencePrompt: src.coherencePrompt,
          socialPlatforms: src.socialPlatforms,
          socialIntent: src.socialIntent,
          socialTone: src.socialTone,
          socialGenerateImages: src.socialGenerateImages,
        });
        idMap.set(src.id, newId);
      }

      // Create edges with remapped IDs
      for (const edge of blueprint.edges) {
        const newFrom = idMap.get(edge.fromNodeId);
        const newTo = idMap.get(edge.toNodeId);
        if (newFrom && newTo) addEdge(newFrom, newTo, edge.role);
      }

      toast({ title: "Blueprint loaded", description: `"${blueprint.label}" placed on canvas` });
    } catch (err) {
      toast({ title: "Error loading blueprint", description: String(err), variant: "destructive" });
    }
  }, [addNode, addEdge, getCenter, toast]);

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

  // ── Auto-load canvas on mount (from URL or localStorage) ──
  const autoLoadedRef = useRef(false);
  useEffect(() => {
    if (autoLoadedRef.current) return;
    if (!canvasDocumentId) return;
    // If the ID came from the URL, always load it (even if canvas has content from a prior tab)
    // If from localStorage, skip if canvas already has content
    if (!urlCanvasId && state.nodes.length > 0) return;
    autoLoadedRef.current = true;
    (async () => {
      setCanvasLoading(true);
      setLoadProgress(20);
      try {
        // Try owned document first, fall back to shared endpoint
        let data: { title: string; content: string; permission?: string };
        let loadedAsShared = false;
        try {
          const res = await apiRequest("GET", `/api/documents/${canvasDocumentId}`);
          setLoadProgress(60);
          data = (await res.json()) as { title: string; content: string };
        } catch {
          // May be a shared canvas — try shared endpoint
          const res = await apiRequest("GET", `/api/shared/document/${canvasDocumentId}`);
          setLoadProgress(60);
          data = (await res.json()) as { title: string; content: string; permission?: string };
          loadedAsShared = true;
        }
        setIsSharedCanvas(loadedAsShared);
        setSharedPermission((data.permission as "read" | "write") || "read");
        setLoadProgress(80);
        const parsed = JSON.parse(data.content);
        setLoadProgress(90);
        loadCanvas(parsed);
        setLoadProgress(100);
        setCanvasTitle(data.title || canvasTitle);
        setCanvasLoadError(null);
        // Sync URL if loaded from localStorage (not already on /canvas/:id)
        if (!urlCanvasId) {
          setLocation(`/canvas/${canvasDocumentId}`, { replace: true });
        }
      } catch {
        // Canvas not found, inactive, or not authorized — stay on page with status bar visible.
        // Clear localStorage immediately so a refresh doesn't retry the same broken canvas.
        try {
          localStorage.removeItem("flow:lastCanvasId");
          localStorage.removeItem("flow:lastCanvasTitle");
        } catch { /* ignore */ }
        setCanvasLoadError(`Canvas #${canvasDocumentId} could not be loaded. It may have been deleted or you don't have access.`);
        setCanvasDocumentIdRaw(null);
        setCanvasTitle("");
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
        const rawFolders = await res.json();
        const folders = Array.isArray(rawFolders) ? rawFolders : (rawFolders.folders ?? []);
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
      const canvasPayload = serializeCanvas(s.nodes, s.edges, s.viewport);
      const time = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      const date = new Date().toLocaleDateString();
      const isHourlySave = now - lastHourlySaveRef.current >= 3600_000;
      const label = canvasTitle || "Untitled Canvas";

      try {
        if (isHourlySave) {
          // Hourly save: always create a new document (kept permanently)
          await apiRequest("POST", "/api/documents", {
            title: `[Hourly] ${label} — ${date} ${time}`,
            content: canvasPayload,
            folderId,
            docType: "chart",
          });
          lastHourlySaveRef.current = now;

          // Purge 5-min saves older than 1 hour from the folder
          try {
            const docsRes = await apiRequest("GET", "/api/documents");
            const raw = await docsRes.json();
            const allDocs = Array.isArray(raw) ? raw : (raw.documents ?? []);
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
              content: canvasPayload,
            });
          } else {
            const res = await apiRequest("POST", "/api/documents", {
              title: `[5min] ${label} — ${date} ${time}`,
              content: canvasPayload,
              folderId,
              docType: "chart",
            });
            const created = await res.json();
            latest5MinDocIdRef.current = created.id;
          }
        }

        // Also update the main canvas document if we have one
        if (canvasDocumentId) {
          const endpoint = isSharedCanvas && sharedPermission === "write"
            ? `/api/shared/document/${canvasDocumentId}`
            : `/api/documents/${canvasDocumentId}`;
          // Skip auto-save for shared read-only canvases
          if (!(isSharedCanvas && sharedPermission !== "write")) {
            await apiRequest("PUT", endpoint, {
              title: canvasTitle || "Untitled Canvas",
              content: canvasPayload,
            }).catch(() => {});
          }
        }
      } catch {
        // Silent fail — auto-save should never break the UI
      }
    }, 5 * 60 * 1000); // 5 minutes

    return () => {
      if (autoSaveTimerRef.current) clearInterval(autoSaveTimerRef.current);
    };
  }, [canvasDocumentId, canvasTitle, isSharedCanvas, sharedPermission]);

  // ── Debounced auto-save on every state change ──
  // Saves the canvas 2 seconds after the last node/edge change so work is never lost.
  // Skips the save cycle immediately after a canvas load (generation check).
  // Uses a quick hash comparison (E6 optimization) to skip saves when content hasn't changed.

  const debounceSaveRef = useRef<ReturnType<typeof setTimeout>>();
  const lastSavedGenerationRef = useRef(canvasGenerationRef.current);
  const isSavingRef = useRef(false);
  const lastSaveHashRef = useRef("");
  // Refs so the debounce callback always reads fresh values without re-registering the effect.
  const canvasDocIdRef = useRef(canvasDocumentId);
  canvasDocIdRef.current = canvasDocumentId;
  const canvasTitleRef = useRef(canvasTitle);
  canvasTitleRef.current = canvasTitle;
  const isSharedCanvasRef = useRef(isSharedCanvas);
  isSharedCanvasRef.current = isSharedCanvas;
  const sharedPermissionRef = useRef(sharedPermission);
  sharedPermissionRef.current = sharedPermission;

  useEffect(() => {
    // Don't save if canvas is currently being loaded
    if (canvasLoading) return;
    // Don't save empty canvases
    if (state.nodes.length === 0) return;
    // If generation changed since last save, this is a load — skip but mark as saved
    if (canvasGenerationRef.current !== lastSavedGenerationRef.current) {
      lastSavedGenerationRef.current = canvasGenerationRef.current;
      return;
    }

    clearTimeout(debounceSaveRef.current);
    debounceSaveRef.current = setTimeout(async () => {
      if (isSavingRef.current) return;
      isSavingRef.current = true;
      try {
        const canvasPayload = serializeCanvas(stateRef.current.nodes, stateRef.current.edges, stateRef.current.viewport);

        // E6: Skip save if content hasn't changed since last save
        const currentHash = quickHash(canvasPayload);
        if (currentHash === lastSaveHashRef.current) {
          isSavingRef.current = false;
          return;
        }

        const title = canvasTitleRef.current || `Canvas — ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;

        if (canvasDocIdRef.current) {
          // Use shared endpoint for shared canvases with write access
          if (isSharedCanvasRef.current) {
            if (sharedPermissionRef.current !== "write") return; // read-only — skip
            await apiRequest("PUT", `/api/shared/document/${canvasDocIdRef.current}`, {
              title,
              content: canvasPayload,
            });
          } else {
            await apiRequest("PUT", `/api/documents/${canvasDocIdRef.current}`, {
              title,
              content: canvasPayload,
            });
          }
        } else {
          // Auto-create canvas document on first change
          const res = await apiRequest("POST", "/api/documents", {
            title,
            content: canvasPayload,
            docType: "chart",
          });
          const data = (await res.json()) as { id: number };
          setCanvasDocumentId(data.id);
          // Persist the generated title so subsequent saves and auto-saves use it
          if (!canvasTitleRef.current) {
            setCanvasTitle(title);
          }
          queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
        }
        // Update hash on successful save
        lastSaveHashRef.current = currentHash;
      } catch {
        // Silent — debounce save should never break the UI
      } finally {
        isSavingRef.current = false;
      }
    }, 2000);

    return () => clearTimeout(debounceSaveRef.current);
  }, [state.nodes, state.edges, canvasLoading, setCanvasDocumentId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Broadcast state to collaborators on changes ──
  // Debounces full-sync by 500ms so rapid changes batch together.

  const debounceSyncRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (!collabConnected || state.nodes.length === 0) return;

    clearTimeout(debounceSyncRef.current);
    debounceSyncRef.current = setTimeout(() => {
      sendFullSync({ nodes: state.nodes, edges: state.edges, viewport: state.viewport });
    }, 500);

    return () => clearTimeout(debounceSyncRef.current);
  }, [state.nodes, state.edges, collabConnected, sendFullSync, state.viewport]);

  // ── Flush save before tab close ──

  useEffect(() => {
    const flush = () => {
      const s = stateRef.current;
      if (s.nodes.length === 0) return;
      const docId = canvasDocIdRef.current;
      if (!docId) return;
      const canvasPayload = serializeCanvas(s.nodes, s.edges, s.viewport);
      const title = canvasTitleRef.current || "Untitled Canvas";
      // Use sendBeacon for reliability — it fires even as the page unloads
      const blob = new Blob(
        [JSON.stringify({ title, content: canvasPayload })],
        { type: "application/json" },
      );
      navigator.sendBeacon(`/api/documents/${docId}/beacon`, blob);
    };
    const onVisChange = () => {
      if (document.visibilityState === "hidden") flush();
    };
    window.addEventListener("beforeunload", flush);
    document.addEventListener("visibilitychange", onVisChange);
    return () => {
      window.removeEventListener("beforeunload", flush);
      document.removeEventListener("visibilitychange", onVisChange);
    };
  }, []);

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
  const canvasDocs = docs.filter((d) => d.docType === "chart" && !d.title?.startsWith("[5min]") && !d.title?.startsWith("[Hourly]"));
  const autoSaveCanvases = docs.filter((d) => d.docType === "chart" && (d.title?.startsWith("[5min]") || d.title?.startsWith("[Hourly]")));

  // Shared canvases (from other users)
  interface SharedCanvasItem { shareId: number; docId: number; title: string; ownerName?: string; permission: string }
  const { data: sharedCanvases = [] } = useQuery<SharedCanvasItem[]>({
    queryKey: ["/api/shared-with-me/canvases"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/shared-with-me");
      const items = await res.json();
      return (items as Array<{ id: number; itemType: string; itemId: number; itemTitle?: string; ownerName?: string; permission: string; status: string }>)
        .filter((s) => s.status === "accepted" && s.itemType === "document")
        .map((s) => ({ shareId: s.id, docId: s.itemId, title: s.itemTitle || "Shared Canvas", ownerName: s.ownerName, permission: s.permission }));
    },
    staleTime: 30_000,
  });

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

      // Labels use inline editing on double-click (handled by FlowNodeRenderer)
      if (node.type === "label") return;

      // Non-expandable types
      if (def.expandMode === "none") return;

      // Seed document editor content + objective + versions if opening a document node
      if (node.type === "document" && !node.imageUrl) {
        setDocEditorContent(node.documentContent || "");
        setDocObjective(node.documentObjective || "");
        setDocVersions(node.documentVersions || []);
      }

      // Populate upstream input for YouTube nodes (for auto-mode detection)
      if (node.type === "youtube" && !node.youtubeUpstreamInput) {
        const inputEdges = state.edges.filter((e) => e.toNodeId === nodeId);
        const inputNodes = inputEdges
          .map((e) => state.nodes.find((n) => n.id === e.fromNodeId))
          .filter(Boolean) as FlowNode[];
        const upstreamText = inputNodes
          .map((n) => n.documentContent || n.content || n.snippet || "")
          .filter((s) => s.trim())
          .join("\n");
        if (upstreamText.trim()) {
          updateNode(nodeId, { youtubeUpstreamInput: upstreamText.trim() });
        }
      }

      // Open unified overlay (sourceRect = null for now — FLIP animation
      // requires DOM refs which will be wired in FlowNodeContainer)
      openExpandedNode(nodeId);
    },
    [state.nodes, openExpandedNode],
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

      // Seed document editor content + objective + versions for document nodes
      if (targetNode.type === "document" && !targetNode.imageUrl) {
        setDocEditorContent(targetNode.documentContent || "");
        setDocObjective(targetNode.documentObjective || "");
        setDocVersions(targetNode.documentVersions || []);
      }

      // Switch overlay (no FLIP animation for chain nav)
      openExpandedNode(nodeId);
    },
    [activeExpandedNodeId, docEditorContent, updateNode, state.nodes, openExpandedNode],
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

      // Show role picker for connections TO role-aware node types
      const fromNode = state.nodes.find((n) => n.id === fromNodeId);
      const toNode = state.nodes.find((n) => n.id === toNodeId);
      if (fromNode && toNode && ROLE_AWARE_TARGETS.has(toNode.type)) {
        const def = FLOW_NODE_REGISTRY[toNode.type];
        // If the target only accepts a single role, auto-assign it — no dialog needed
        if (def && def.acceptedRoles.length === 1) {
          addEdge(fromNodeId, toNodeId, def.acceptedRoles[0]);
          return;
        }
        setPendingEdgeRole({ fromNodeId, toNodeId });
        return;
      }

      addEdge(fromNodeId, toNodeId);
    },
    [addEdge, state.edges, state.nodes],
  );

  // ── Lifecycle logging helper ──

  const lcLog = useCallback(
    (node: FlowNode, phase: LifecyclePhase, status: LifecycleStatus, message: string, extra?: { durationMs?: number; downstreamIds?: string[]; error?: string }) => {
      lifecycleLogStore.push({
        phase,
        status,
        nodeId: node.id,
        nodeType: node.type,
        nodeLabel: node.label || node.type,
        message,
        ...extra,
      });
    },
    [],
  );

  // ── Chain propagation helper (uses handlePlayNodeRef to avoid circular dep) ──

  const handlePlayNodeRef = useRef<(nodeId: string) => Promise<void>>(async () => {});

  const propagateDownstream = useCallback(
    (nodeId: string, node: FlowNode) => {
      const { nodes, edges } = stateRef.current;
      // Block chain propagation past approval nodes that are pending or rejected
      const sourceNode = nodes.find((n) => n.id === nodeId);
      if (sourceNode?.type === "approval" && sourceNode.approvalStatus !== "approved") {
        return;
      }

      const downstreamEdges = edges.filter((e) => e.fromNodeId === nodeId);
      const downstreamIds: string[] = [];
      for (const edge of downstreamEdges) {
        const downstream = nodes.find((n) => n.id === edge.toNodeId);
        if (!downstream) continue;

        // Audio nodes: flag for auto-start recording instead of chain execution
        if (downstream.type === "audio") {
          updateNode(downstream.id, { autoStartRecording: true });
          continue;
        }

        const def = FLOW_NODE_REGISTRY[downstream.type];
        if (!def?.supportsChainExecution) continue;

        const mode = downstream.inputMode ?? "wait-all";

        if (mode === "fire-each") {
          // Fire immediately for this single input — no waiting for others
          downstreamIds.push(edge.toNodeId);
          const toId = edge.toNodeId;
          setTimeout(() => handlePlayNodeRef.current(toId), 500);
        } else {
          // Wait-all: only fire if ALL inputs to this downstream node are done
          const allInputEdges = edges.filter((e) => e.toNodeId === downstream.id);
          const allInputsSatisfied = allInputEdges.every((ie) => {
            const inputNode = nodes.find((n) => n.id === ie.fromNodeId);
            return inputNode && (inputNode.llmStatus === "done" || !FLOW_NODE_REGISTRY[inputNode.type]?.playable);
          });
          if (allInputsSatisfied) {
            downstreamIds.push(edge.toNodeId);
            const toId = edge.toNodeId;
            setTimeout(() => handlePlayNodeRef.current(toId), 500);
          }
        }
      }
      if (downstreamIds.length > 0) {
        lcLog(node, "chain", "start", `Propagating to ${downstreamIds.length} downstream node(s)`, { downstreamIds });
      }
    },
    [lcLog],
  );

  // ── Replace downstream outputs helper ──
  const replaceDownstreamOutputs = useCallback(
    (nodeId: string) => {
      const node = stateRef.current.nodes.find((n) => n.id === nodeId);
      if (!node || (node.outputReplaceMode ?? "replace") !== "replace") return;
      const outEdges = stateRef.current.edges.filter((e) => e.fromNodeId === nodeId);
      const docIds = outEdges
        .map((e) => stateRef.current.nodes.find((n) => n.id === e.toNodeId))
        .filter((n): n is FlowNode => !!n && n.type === "document")
        .map((n) => n.id);
      if (docIds.length > 0) deleteNodes(docIds);
    },
    [deleteNodes],
  );

  // ── Helper: find a non-overlapping position for a new output node ──

  const findOpenSlot = useCallback(
    (targetX: number, targetY: number, nodeWidth: number, nodeHeight: number, gap: number = 40): { x: number; y: number } => {
      const existing = stateRef.current.nodes;
      let y = targetY;
      for (let attempt = 0; attempt < 50; attempt++) {
        const overlaps = existing.some((n) => {
          const ax1 = targetX, ay1 = y, ax2 = targetX + nodeWidth, ay2 = y + nodeHeight;
          const bx1 = n.x - gap, by1 = n.y - gap, bx2 = n.x + n.width + gap, by2 = n.y + n.height + gap;
          return ax1 < bx2 && ax2 > bx1 && ay1 < by2 && ay2 > by1;
        });
        if (!overlaps) return { x: targetX, y };
        y += nodeHeight + gap;
      }
      return { x: targetX, y };
    },
    [],
  );

  // ── Play node: auto-execute a node using its inputs ──

  const handlePlayNode = useCallback(
    async (nodeId: string) => {
      // Re-entrance guard: prevent concurrent execution of the same node
      if (executingNodesRef.current.has(nodeId)) return;
      executingNodesRef.current.add(nodeId);

      const node = stateRef.current.nodes.find((n) => n.id === nodeId);
      if (!node) { executingNodesRef.current.delete(nodeId); return; }

      // Capture which tab this execution belongs to — mutations must target this tab
      const execTabId = activeTabIdRef.current;
      const onExecTab = () => activeTabIdRef.current === execTabId;

      // Tab-scoped mutations: if user switched tabs, route changes to the correct tab's snapshot
      const scopedUpdate = (id: string, patch: Partial<FlowNode>) => {
        if (onExecTab()) { updateNode(id, patch); return; }
        setWorkspaceTabs(tabs => tabs.map(t =>
          t.id !== execTabId ? t : {
            ...t, snapshot: { ...t.snapshot, nodes: t.snapshot.nodes.map(n => n.id === id ? { ...n, ...patch } : n) },
          }
        ));
      };
      const scopedAddNode = (type: FlowNodeType, x: number, y: number, data: Partial<FlowNode> & { label: string }): string => {
        if (onExecTab()) return addNode(type, x, y, data);
        const dims = DEFAULT_DIMENSIONS[type] || { width: 200, height: 100 };
        const id = generateId("flow");
        const newNode = { id, type, x: x - dims.width / 2, y: y - dims.height / 2, width: dims.width, height: dims.height, zIndex: 0, ...data } as FlowNode;
        setWorkspaceTabs(tabs => tabs.map(t =>
          t.id !== execTabId ? t : {
            ...t, snapshot: { ...t.snapshot, nodes: [...t.snapshot.nodes, { ...newNode, zIndex: t.snapshot.nodes.length }] },
          }
        ));
        return id;
      };
      const scopedAddEdge = (fromId: string, toId: string): string => {
        if (onExecTab()) return addEdge(fromId, toId);
        const id = generateId("edge");
        setWorkspaceTabs(tabs => tabs.map(t =>
          t.id !== execTabId ? t : {
            ...t, snapshot: { ...t.snapshot, edges: [...t.snapshot.edges, { id, fromNodeId: fromId, toNodeId: toId } as FlowEdge] },
          }
        ));
        return id;
      };

      try {
      const t0 = performance.now();
      const def = FLOW_NODE_REGISTRY[node.type];
      const preset: LifecyclePreset = def?.lifecyclePreset || "passive";

      // ── Passive nodes: no-op ──
      if (preset === "passive") {
        lcLog(node, "pre-process", "skipped", "Passive node — no execution needed");
        toast({ title: "Already complete", description: "This node is a static source" });
        return;
      }

      // ── Timer/Trigger: source node — mark done (watcher propagates) ──
      if (preset === "timer") {
        const now = new Date();
        const ts = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
        const count = (node.timerPulseCount || 0) + 1;
        const entry = `[${ts}] Manual fire #${count}`;
        const content = (node.content || "") + (node.content ? "\n" : "") + entry;
        scopedUpdate(nodeId, {
          timerPulseCount: count,
          timerLastPulse: now.toISOString(),
          content,
          snippet: `Fired #${count} — ${ts}`,
          llmStatus: "done",
        });
        lcLog(node, "process", "success", `Manual fire #${count}`);
        return;
      }

      // ── Build context using shared lifecycle helpers ──
      const { inputNodes, inputEdges, combinedContent, objectiveText, contextText, templateContent } =
        gatherInputContentWithRoles(nodeId, stateRef.current.nodes, stateRef.current.edges);
      const chainCtx = gatherChainContext(nodeId, stateRef.current.nodes, stateRef.current.edges);
      const { immediateContext, fullChainContext } =
        gatherStructuredChainContext(nodeId, stateRef.current.nodes, stateRef.current.edges);

      // ── Get lifecycle handlers from registry ──
      const handlers = getLifecycleHandlers(preset);

      // If the node type has its own onPreProcess validator, let it decide
      // whether it can run without input edges (e.g. LLM Base with manual prompts).
      // Only block for node types that rely purely on the generic pipeline.
      if (inputNodes.length === 0 && !handlers.onPreProcess) {
        lcLog(node, "pre-process", "error", "No inputs connected", { error: "No upstream nodes" });
        toast({ title: "No inputs connected", description: "Connect document nodes first" });
        return;
      }
      const abortController = new AbortController();

      const ctx: NodeProcessContext = {
        node, inputNodes, inputEdges,
        combinedInputContent: combinedContent,
        chainContext: chainCtx,
        signal: abortController.signal,
        objectiveText, contextText, templateContent,
        immediateContext, fullChainContext,
      };

      // ── PRE-PROCESS: handler validation ──
      lcLog(node, "pre-process", "start", "Validating inputs");
      if (handlers.onPreProcess) {
        const ok = await handlers.onPreProcess(ctx);
        if (!ok) {
          lcLog(node, "pre-process", "error", "Validation failed", { error: "Handler rejected" });
          scopedUpdate(nodeId, { llmStatus: "idle", snippet: node.snippet });
          toast({ title: "Cannot execute", description: "Check node configuration" });
          return;
        }
      }

      // Generic empty-input guard — only applies when the handler has no onPreProcess
      // (all current handlers have one, but this is a safety net for future ones).
      // If onPreProcess exists and returned true, it already confirmed the node has
      // enough input (from edges, manual entry, or both) — don't override that decision.
      if (!handlers.onPreProcess && !combinedContent.trim() && preset !== "stream") {
        lcLog(node, "pre-process", "error", "Input nodes have no content", { error: "Empty input" });
        toast({ title: "No content", description: "Input nodes have no content" });
        return;
      }

      lcLog(node, "pre-process", "success", `${inputNodes.length} input(s), ${combinedContent.length} chars`);

      // Mark node as running
      scopedUpdate(nodeId, { llmStatus: "running", snippet: "Running..." });
      replaceDownstreamOutputs(nodeId);

      // ── Generic pre-process hook (node.preProcess) ──
      let processedInput = combinedContent;
      if (node.preProcess?.trim()) {
        scopedUpdate(nodeId, { snippet: "Pre-processing..." });
        try {
          const preRes = await apiRequest("POST", "/api/write", {
            document: processedInput,
            instruction: node.preProcess,
            appType: "write-a-prompt",
          });
          const preData = (await preRes.json()) as { document: string };
          if (preData.document?.trim()) processedInput = preData.document;
        } catch { /* continue with original */ }
        scopedUpdate(nodeId, { snippet: "Running..." });
      }

      // ── PROCESS: delegate to lifecycle handler ──
      lcLog(node, "process", "start", `Processing as ${node.type} (${preset})`);

      try {
        const outputText = await handlers.onProcess({
          ...ctx,
          combinedInputContent: processedInput,
        });

        const elapsed = Math.round(performance.now() - t0);

        // ── POST-PROCESS: type-specific output creation ──
        lcLog(node, "post-process", "start", "Creating output");

        // -- Painter: structured image output --
        if (preset === "media") {
          const { prompt, imageUrl } = parsePainterOutput(outputText);
          scopedUpdate(nodeId, { llmStatus: "done", snippet: `Generated: ${prompt.slice(0, 80)}...`, imageUrl });
          const imgNodeId = scopedAddNode("document", node.x + node.width + 60, node.y, {
            label: `Image: ${prompt.slice(0, 30)}${prompt.length > 30 ? "..." : ""}`,
            snippet: "Generated image",
            imageUrl,
            content: prompt,
            documentContent: prompt,
          });
          scopedAddEdge(nodeId, imgNodeId);
          lcLog(node, "process", "success", `Image generated`, { durationMs: elapsed });
          lcLog(node, "post-process", "success", "Output image node created");
          toast({ title: "Image generated" });
          return;
        }

        // -- Social post: per-platform document nodes --
        if (preset === "social") {
          // Parse enriched output: { posts: {...}, imageUrl?: string }
          let parsedOutput: { posts: Record<string, { text: string; characterCount?: number }>; imageUrl?: string };
          try {
            const raw = JSON.parse(outputText);
            // Support both old format (flat posts) and new format ({ posts, imageUrl })
            parsedOutput = raw.posts ? raw : { posts: raw };
          } catch {
            parsedOutput = { posts: {} };
          }
          const { posts, imageUrl: socialImageUrl } = parsedOutput;
          const generatedPosts: Record<string, { text: string; imageUrl?: string; charCount: number; status: string }> = {};
          let idx = 0;
          for (const [platform, post] of Object.entries(posts)) {
            generatedPosts[platform] = { text: post.text, imageUrl: socialImageUrl, charCount: post.characterCount || post.text.length, status: "draft" };
            idx++;
            const childId = scopedAddNode("document", node.x + node.width + 60, node.y + idx * 80, {
              label: `${platform} Post`,
              documentContent: post.text,
              imageUrl: socialImageUrl,
              snippet: post.text.slice(0, 120),
            });
            scopedAddEdge(nodeId, childId);
          }
          scopedUpdate(nodeId, {
            socialGeneratedPosts: generatedPosts,
            socialGenStatus: "done",
            llmStatus: "done",
            snippet: `Generated ${idx} posts`,
          });
          lcLog(node, "process", "success", `Generated ${idx} posts`, { durationMs: elapsed });
          lcLog(node, "post-process", "success", `Created ${idx} platform document nodes`);
          toast({ title: "Posts generated", description: `Created ${idx} platform posts` });
          return;
        }

        // -- API connection: status update only (no output docs) --
        if (preset === "api") {
          const data = JSON.parse(outputText) as { success: boolean; externalPostId?: string; error?: string };
          const logEntry = {
            platform: node.apiService || "unknown",
            status: data.success ? "success" : "failed",
            message: data.success ? `Posted (${data.externalPostId || "ok"})` : (data.error || "Failed"),
            timestamp: new Date().toISOString(),
            externalId: data.externalPostId,
          };
          scopedUpdate(nodeId, {
            llmStatus: data.success ? "done" : "error",
            snippet: data.success ? `Posted to ${node.apiService}` : (data.error || "Post failed"),
            apiLastResult: logEntry,
            apiPostLog: [...(node.apiPostLog || []), logEntry],
          });
          if (data.success) {
            lcLog(node, "process", "success", `Posted to ${node.apiService}`, { durationMs: elapsed });
          } else {
            lcLog(node, "process", "error", data.error || "Post failed", { error: data.error, durationMs: elapsed });
          }
          toast({ title: data.success ? "Posted successfully" : "Post failed", variant: data.success ? "default" : "destructive" });
          return;
        }

        // -- Coherence: conditional pass/fail --
        if (preset === "coherence") {
          const result = JSON.parse(outputText) as { score: number; verdict: string; reasoning: string; content: string };
          scopedUpdate(nodeId, {
            coherenceLastScore: result.score,
            coherenceLastVerdict: result.verdict as "pass" | "fail",
            coherenceFailCount: result.verdict === "fail" ? (node.coherenceFailCount ?? 0) + 1 : 0,
          });
          if (result.verdict === "pass") {
            scopedUpdate(nodeId, {
              llmStatus: "done",
              content: result.content,
              snippet: `Pass: ${result.score}% — ${result.reasoning.slice(0, 80)}`,
            });
            const docDims = DEFAULT_DIMENSIONS["document"] || { width: 200, height: 100 };
            const slot = findOpenSlot(node.x + node.width + 60, node.y, docDims.width, docDims.height);
            const outputDocId = scopedAddNode("document", slot.x, slot.y, {
              label: `${node.label} Output`,
              documentContent: result.content,
              snippet: result.content.slice(0, 200),
            });
            scopedAddEdge(nodeId, outputDocId);
            lcLog(node, "process", "success", `Pass: ${result.score}%`, { durationMs: elapsed });
            lcLog(node, "post-process", "success", "Output document created");
            toast({ title: "Quality check passed" });
          } else {
            const fc = (node.coherenceFailCount ?? 0) + 1;
            const pfThreshold = node.coherencePersistentFailThreshold ?? 5;
            const driftWarning = fc >= pfThreshold ? " — Upstream drift likely" : "";
            scopedUpdate(nodeId, {
              llmStatus: "error",
              snippet: `Failed: ${result.score}%${driftWarning}`,
              coherenceFailCount: fc,
            });
            lcLog(node, "process", "error", `Failed: ${result.score}%${driftWarning}`, { error: result.reasoning, durationMs: elapsed });
            toast({ title: "Quality check failed", variant: "destructive" });
          }
          return;
        }

        // -- Approval: set pending status, block chain --
        if (preset === "approval") {
          if (outputText === "__APPROVAL_PENDING__") {
            scopedUpdate(nodeId, {
              approvalStatus: "pending",
              llmStatus: "done",
              snippet: "Awaiting approval",
            });
            lcLog(node, "process", "success", "Approval request sent, chain paused", { durationMs: elapsed });
            toast({ title: "Approval requested", description: "Chain will resume when approved" });
          } else {
            // Already approved — pass content through
            scopedUpdate(nodeId, { llmStatus: "done", content: outputText, snippet: "Approved" });
            const docId = scopedAddNode("document", node.x + node.width + 60, node.y, {
              label: `${node.label} Output`,
              documentContent: outputText,
              snippet: outputText.slice(0, 200),
            });
            scopedAddEdge(nodeId, docId);
            lcLog(node, "process", "success", "Approved — content passed through", { durationMs: elapsed });
          }
          return;
        }

        // -- YouTube: multi-video output documents --
        if (preset === "youtube") {
          let parsed: { videos?: { videoId: string; title: string; transcript: string }[]; mode?: string } | null = null;
          try { parsed = JSON.parse(outputText); } catch { /* not JSON = single transcript */ }

          if (parsed?.videos && parsed.videos.length > 1) {
            let idx = 0;
            for (const video of parsed.videos) {
              idx++;
              const childId = scopedAddNode("document", node.x + node.width + 60, node.y + idx * 80, {
                label: `Transcript: ${video.title.slice(0, 30)}${video.title.length > 30 ? "..." : ""}`,
                documentContent: video.transcript,
                snippet: video.transcript.slice(0, 200),
              });
              scopedAddEdge(nodeId, childId);
            }
            const merged = parsed.videos.map(v => `## ${v.title}\n\n${v.transcript}`).join("\n\n---\n\n");
            scopedUpdate(nodeId, {
              content: merged,
              documentContent: merged,
              llmStatus: "done",
              snippet: `${idx} video transcripts`,
              youtubeTitle: parsed.videos[0]?.title,
              youtubeFetchStatus: "done",
            });
            lcLog(node, "process", "success", `Fetched ${idx} video transcripts`, { durationMs: elapsed });
            toast({ title: "YouTube complete", description: `Created ${idx} transcript documents` });
            return;
          }

          // Single video: set youtube-specific fields, then fall through to generic handler
          scopedUpdate(nodeId, {
            youtubeFetchStatus: "done",
            youtubeTitle: node.youtubeTitle || "YouTube Video",
          });
        }

        // -- Webpage: HTML output stays in the node (preview in overlay) --
        if (preset === "webpage") {
          let html = outputText;
          html = html.replace(/^```html?\s*\n?/i, "").replace(/\n?```\s*$/i, "");
          scopedUpdate(nodeId, {
            htmlOutput: html,
            webpageStatus: "done",
            llmStatus: "done",
            content: html,
            snippet: `HTML page (${(html.length / 1024).toFixed(1)}KB)`,
          });
          lcLog(node, "process", "success", `Webpage generated (${html.length} chars)`, { durationMs: elapsed });
          lcLog(node, "post-process", "success", "HTML output stored in node");
          toast({ title: "Webpage generated", description: `${(html.length / 1024).toFixed(1)}KB HTML page` });
          return;
        }

        // -- All other presets (stream, llm, logic, interview, generic): text output --
        if (!outputText?.trim()) {
          lcLog(node, "process", "error", "No output generated", { error: "Empty output", durationMs: elapsed });
          scopedUpdate(nodeId, { llmStatus: "error", snippet: "No output generated" });
          return;
        }

        lcLog(node, "process", "success", `${outputText.length} chars output`, { durationMs: elapsed });

        // Generic post-process hook (node.postProcess)
        let finalOutput = outputText;
        if (node.postProcess?.trim()) {
          scopedUpdate(nodeId, { snippet: "Post-processing..." });
          try {
            const postRes = await apiRequest("POST", "/api/write", {
              document: finalOutput,
              instruction: node.postProcess,
              appType: "write-a-prompt",
            });
            const postData = (await postRes.json()) as { document: string };
            if (postData.document?.trim()) finalOutput = postData.document;
          } catch { /* use original */ }
        }

        // Update the source node
        const nodeUpdate: Partial<FlowNode> = {
          llmStatus: "done",
          content: finalOutput,
          snippet: finalOutput.slice(0, 200),
        };
        // LLM nodes also store output for their compact UI
        if (preset === "llm") {
          nodeUpdate.llmOutput = finalOutput;
        }
        scopedUpdate(nodeId, nodeUpdate);

        // Create output document(s) — split or consolidated
        const oc = node.outputConfig;
        const isAnySplit = oc?.outputMode === "split" && (oc?.outputCount === undefined || oc?.outputCount === null);
        const fixedSplitCount = oc?.outputMode === "split" && oc?.outputCount !== undefined && oc?.outputCount !== null
          ? Math.min(oc.outputCount, 5) : 0;

        if (oc?.outputMode === "split" && (isAnySplit || fixedSplitCount > 0)) {
          const sections = isAnySplit
            ? splitOutputByDelimiters(finalOutput, 5)
            : splitOutputIntoSections(finalOutput, fixedSplitCount);
          const splitDocDims = DEFAULT_DIMENSIONS["document"] || { width: 200, height: 100 };
          for (let i = 0; i < sections.length; i++) {
            const headingMatch = sections[i].match(/^#{1,3}\s+(.+)$/m);
            const sectionLabel = headingMatch
              ? headingMatch[1].slice(0, 50)
              : `${node.label} [${i + 1}/${sections.length}]`;
            const splitSlot = findOpenSlot(node.x + node.width + 60, node.y + i * (splitDocDims.height + 40), splitDocDims.width, splitDocDims.height);
            const docId = scopedAddNode("document", splitSlot.x, splitSlot.y, {
              label: sectionLabel,
              documentContent: sections[i],
              snippet: sections[i].slice(0, 200),
            });
            scopedAddEdge(nodeId, docId);
          }
          lcLog(node, "post-process", "success", `Created ${sections.length} split output documents`);
          toast({ title: "Execution complete", description: `Created ${sections.length} output documents` });
        } else {
          const singleDocDims = DEFAULT_DIMENSIONS["document"] || { width: 200, height: 100 };
          const singleSlot = findOpenSlot(node.x + node.width + 60, node.y, singleDocDims.width, singleDocDims.height);
          const outputDocId = scopedAddNode("document", singleSlot.x, singleSlot.y, {
            label: `${node.label} Output`,
            documentContent: finalOutput,
            snippet: finalOutput.slice(0, 200),
          });
          scopedAddEdge(nodeId, outputDocId);
          lcLog(node, "post-process", "success", "Output document created");
          toast({ title: "Execution complete", description: `Output document created` });
        }

        // Chain propagation handled by the reactive watcher
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : "Execution failed";
        lcLog(node, "process", "error", errMsg, { error: errMsg, durationMs: Math.round(performance.now() - t0) });
        scopedUpdate(nodeId, { llmStatus: "error", snippet: "Execution failed" });
        toast({ title: "Execution failed", variant: "destructive" });
      }
      } finally {
        executingNodesRef.current.delete(nodeId);
      }
    },
    [addNode, addEdge, updateNode, toast, lcLog, replaceDownstreamOutputs, setWorkspaceTabs],
  );

  // Keep ref in sync for chain propagation
  handlePlayNodeRef.current = handlePlayNode;

  // ── System-level chain propagation watcher ──
  // When ANY node transitions to llmStatus "done", auto-propagate to downstream
  // chain-executable nodes. This replaces all manual propagateDownstream() calls
  // and ensures uniform chain behavior regardless of how a node was executed
  // (via handlePlayNode, internal Run button, or lifecycle engine).
  const chainPropagatedRef = useRef<Map<string, number>>(new Map());
  const chainWatcherInitRef = useRef(false);
  const lastSeededGenerationRef = useRef(0);
  const executingNodesRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    // First render OR canvas load: seed tracking for already-done nodes
    // so loaded "done" nodes don't trigger downstream execution
    if (!chainWatcherInitRef.current || lastSeededGenerationRef.current !== canvasGenerationRef.current) {
      chainPropagatedRef.current.clear();
      for (const node of state.nodes) {
        if (node.llmStatus === "done") {
          const version = node.type === "timer-event" ? (node.timerPulseCount || 0) : 0;
          chainPropagatedRef.current.set(node.id, version);
        }
      }
      chainWatcherInitRef.current = true;
      lastSeededGenerationRef.current = canvasGenerationRef.current;
      return;
    }

    const tracked = chainPropagatedRef.current;

    for (const node of state.nodes) {
      if (node.llmStatus !== "done") {
        // Node is not done — clear tracking so next completion re-propagates
        tracked.delete(node.id);
        continue;
      }

      // Use pulse count as version for trigger nodes (supports repeated fires)
      const version = node.type === "timer-event" ? (node.timerPulseCount || 0) : 0;
      const lastVersion = tracked.get(node.id);

      if (lastVersion === version) continue; // Already propagated this completion

      // Mark as propagated
      tracked.set(node.id, version);

      // Check autoTriggerNext (default: true)
      if (node.autoTriggerNext === false) continue;

      // Find and execute downstream chain-executable nodes
      propagateDownstream(node.id, node);
    }

    // Clean up deleted nodes
    const trackedIds = Array.from(tracked.keys());
    for (const id of trackedIds) {
      if (!state.nodes.find((n) => n.id === id)) {
        tracked.delete(id);
      }
    }
  }, [state.nodes, propagateDownstream]);

  // ── Lifecycle engine: manages trigger intervals + automation watchers ──

  const { toggleTrigger } = useLifecycleEngine({
    nodes: state.nodes,
    edges: state.edges,
    updateNode,
    addNode,
    addEdge,
    toast,
    executeNode: handlePlayNode,
  });

  // ── Chain executor with reliability features (I1-I6) ──

  const chainExecutor = useChainExecutor({
    getState: () => ({ nodes: stateRef.current.nodes, edges: stateRef.current.edges }),
    executeNode: handlePlayNode,
    onStatusChange: (nodeId, status) => {
      // Update the llmStatus for backward compatibility with existing status pulse system
      if (status === "running") {
        updateNode(nodeId, { llmStatus: "running" });
      }
      // done/error are handled by handlePlayNode already
    },
    onChainStatusChange: (nodeId, chainStatus, errorMessage) => {
      updateNode(nodeId, {
        chainStatus: chainStatus ?? "idle",
        chainErrorMessage: errorMessage,
      });
    },
  });

  const handleRetryNode = useCallback(
    (nodeId: string) => {
      chainExecutor.retryNode(nodeId);
    },
    [chainExecutor],
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
      if (toolId === "notification") {
        addNode("notification", canvasX, canvasY, {
          label: "Notify",
          snippet: "Sends notification when chain completes",
          notifyMessage: "Chain completed: {label} at {time}",
          notifyUserIds: [],
          notifyChannels: ["in-app"],
          notifyIncludeLink: true,
          notifyStatus: "idle",
        });
        return;
      }
      if (toolId === "upload") {
        addNode("upload", canvasX, canvasY, {
          label: "Upload",
          snippet: "Double-click to upload files",
          uploadFiles: [],
          uploadStatus: "idle",
        });
        return;
      }
      if (toolId === "approval") {
        addNode("approval", canvasX, canvasY, {
          label: "Approval",
          snippet: "Double-click to configure",
          approvalStatus: "idle",
          approvalMessage: "Approval required for: {label}",
          approvalUserIds: [],
        });
        return;
      }
      if (toolId === "webpage") {
        addNode("webpage", canvasX, canvasY, {
          label: "Webpage",
          snippet: "Connect content → Run to generate a styled webpage",
          webpageStylePreference: "modern-minimal",
          webpageStatus: "idle",
        });
        return;
      }
      if (toolId === "llm-base") {
        addNode("llm-base", canvasX, canvasY, {
          label: "LLM",
          snippet: "Double-click to configure and run",
          llmBaseModel: "gemini-2.5-flash",
          llmBaseTemperature: 1.0,
          llmBaseTopP: 1.0,
          llmBaseTopK: 0,
          llmBaseMaxTokens: 8192,
          llmBaseSafety: "none",
          llmBaseEnableSearch: false,
          llmBaseStreaming: true,
          llmBaseStatus: "idle",
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
        node.llmStatus !== "done" &&
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

  // Trigger lifecycle is now managed by useLifecycleEngine above.

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
    // Shared canvas with read-only access — block save
    if (isSharedCanvas && sharedPermission !== "write") {
      toast({ title: "Read-only canvas", description: "You don't have write access to this shared canvas", variant: "destructive" });
      return;
    }
    setIsSaving(true);
    try {
      const canvasPayload = serializeCanvas(state.nodes, state.edges, state.viewport);
      const title = canvasTitle || `Canvas — ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;

      if (canvasDocumentId) {
        // Shared canvas — save to owner's store via shared endpoint
        const endpoint = isSharedCanvas
          ? `/api/shared/document/${canvasDocumentId}`
          : `/api/documents/${canvasDocumentId}`;
        await apiRequest("PUT", endpoint, {
          title,
          content: canvasPayload,
        });
        toast({ title: isSharedCanvas ? "Shared canvas saved" : "Canvas saved" });
      } else {
        // Create new (only for own canvases)
        const res = await apiRequest("POST", "/api/documents", {
          title,
          content: canvasPayload,
          docType: "chart",
        });
        const data = (await res.json()) as { id: number };
        setCanvasDocumentId(data.id);
        setCanvasTitle(title);
        toast({ title: "Canvas saved", description: "Saved to Context Store" });
      }
      if (canvasDocumentId) {
        queryClient.setQueryData(["/api/documents"], (old: unknown) =>
          Array.isArray(old) ? old.map((d: { id: number }) => d.id === canvasDocumentId ? { ...d, title } : d) : old,
        );
      } else {
        queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
      }
    } catch {
      toast({ title: "Save failed", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  }, [state.nodes, state.edges, state.viewport, canvasDocumentId, canvasTitle, toast, setCanvasDocumentId, isSharedCanvas, sharedPermission]);

  // ── Open canvas from saved document ──

  const handleOpenCanvas = useCallback(
    async (docId: number, docTitle: string, isShared?: boolean) => {
      setCanvasLoading(true);
      setLoadProgress(20);
      try {
        let data: { title: string; content: string; permission?: string };
        if (isShared) {
          const res = await apiRequest("GET", `/api/shared/document/${docId}`);
          setLoadProgress(60);
          data = (await res.json()) as { title: string; content: string; permission?: string };
        } else {
          const res = await apiRequest("GET", `/api/documents/${docId}`);
          setLoadProgress(60);
          data = (await res.json()) as { title: string; content: string };
        }
        setLoadProgress(80);
        const parsed = JSON.parse(data.content);
        setLoadProgress(90);
        loadCanvas(parsed);
        setLoadProgress(100);
        setCanvasDocumentId(docId);
        setCanvasTitle(data.title || docTitle);
        setIsSharedCanvas(!!isShared);
        setSharedPermission((data.permission as "read" | "write") || "read");
        setOpenCanvasDialogOpen(false);
        toast({ title: isShared ? "Shared canvas loaded" : "Canvas loaded", description: data.title || docTitle });
      } catch {
        toast({ title: "Failed to load canvas", variant: "destructive" });
      } finally {
        setCanvasLoading(false);
        setLoadProgress(undefined);
      }
    },
    [loadCanvas, toast, setCanvasDocumentId],
  );

  // ── Rename canvas ──

  const handleRenameCanvas = useCallback(async (newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    // Update ref synchronously so the debounce auto-save reads the new title
    // (setCanvasTitle is async and the ref update happens during render)
    canvasTitleRef.current = trimmed;
    setCanvasTitle(trimmed);
    if (canvasDocumentId) {
      // Canvas already saved — update the title on the server
      try {
        await apiRequest("PATCH", `/api/documents/${canvasDocumentId}`, { title: trimmed });
        queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
      } catch {
        // silent — name is already set locally
      }
    } else if (state.nodes.length > 0) {
      // Canvas has content but was never saved — naming it triggers first save
      // We need to call save after the title state update takes effect,
      // so we do the POST inline here with the new name
      try {
        const contentNodes = state.nodes.filter((n) => n.type !== "store");
        const canvasData = { nodes: contentNodes, edges: state.edges, viewport: state.viewport };
        const res = await apiRequest("POST", "/api/documents", {
          title: trimmed,
          content: JSON.stringify(canvasData),
          docType: "chart",
        });
        const data = (await res.json()) as { id: number };
        // Update ref synchronously so debounce auto-save doesn't create a duplicate
        canvasDocIdRef.current = data.id;
        setCanvasDocumentId(data.id);
        queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
        toast({ title: "Canvas saved", description: trimmed });
      } catch {
        // silent — rename still took effect locally
      }
    }
  }, [canvasDocumentId, state.nodes, state.edges, state.viewport, setCanvasDocumentId, toast]);

  // ── New canvas ──

  const handleNewCanvas = useCallback(() => {
    resetCanvas();
    setCanvasDocumentId(null);
    setCanvasTitle("");
    toast({ title: "New canvas created" });
  }, [resetCanvas, toast, setCanvasDocumentId]);

  // ── Delete canvas ──

  const [deleteConfirm, setDeleteConfirm] = useState<{ id: number; title: string } | null>(null);

  const handleDeleteCanvas = useCallback(async (docId: number) => {
    try {
      await apiRequest("DELETE", `/api/documents/${docId}`);
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
      // If the deleted canvas is the one currently open, reset to a blank canvas
      if (canvasDocumentId === docId) {
        resetCanvas();
        setCanvasDocumentIdRaw(null);
        setCanvasTitle("");
        try {
          localStorage.removeItem("flow:lastCanvasId");
          localStorage.removeItem("flow:lastCanvasTitle");
        } catch { /* ignore */ }
        setLocation("/", { replace: true });
      }
      toast({ title: "Canvas deleted" });
    } catch {
      toast({ title: "Failed to delete canvas", variant: "destructive" });
    }
    setDeleteConfirm(null);
  }, [canvasDocumentId, resetCanvas, toast, setLocation]);

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

  // ── Helper: gather connected input text for document node ──
  const getDocConnectedContext = useCallback(() => {
    if (!activeExpandedNodeId) return "";
    const inputEdges = stateRef.current.edges.filter((e) => e.toNodeId === activeExpandedNodeId);
    const inputNodes = inputEdges
      .map((e) => stateRef.current.nodes.find((n) => n.id === e.fromNodeId))
      .filter(Boolean) as FlowNode[];
    return inputNodes
      .map((n) => {
        const text = n.documentContent || n.content || n.snippet || "";
        return text.trim() ? `[${n.label || "Input"}]\n${text.trim()}` : "";
      })
      .filter(Boolean)
      .join("\n\n---\n\n");
  }, [activeExpandedNodeId]);

  // ── Helper: snapshot current document as a version ──
  const snapshotDocVersion = useCallback((label: string) => {
    if (!docEditorContent.trim()) return;
    setDocVersions((prev) => [
      ...prev,
      { content: docEditorContent, label, timestamp: new Date().toISOString() },
    ]);
  }, [docEditorContent]);

  // ── Document editor: run a tool ──

  const handleDocTool = useCallback(
    async (instruction: string, toolId: string) => {
      if (!docEditorContent.trim()) return;
      snapshotDocVersion(`Before ${toolId}`);
      setDocToolRunning(toolId);
      try {
        let connectedContext = getDocConnectedContext();
        // Truncate to 90K to stay within sessionNotes schema limit (100K) with margin
        if (connectedContext.length > 90_000) {
          connectedContext = connectedContext.slice(0, 90_000) + "\n\n[...context truncated]";
        }
        const res = await apiRequest("POST", "/api/write", {
          document: docEditorContent,
          instruction,
          appType: "write-a-prompt",
          ...(docObjective.trim() ? { objective: docObjective.trim() } : {}),
          ...(connectedContext ? { sessionNotes: connectedContext } : {}),
        });
        const data = (await res.json()) as { document: string };
        if (data.document) {
          setDocEditorContent(data.document);
        } else {
          toast({ title: "No changes produced", description: "The AI returned an empty result. Try a more specific instruction.", variant: "destructive" });
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        toast({ title: "Tool failed", description: msg.includes("400") ? "Request too large — try disconnecting some inputs" : undefined, variant: "destructive" });
      } finally {
        setDocToolRunning(null);
      }
    },
    [docEditorContent, docObjective, toast, snapshotDocVersion, getDocConnectedContext],
  );

  // ── Document editor: writer feedback (Smart Text / Voice) ──
  const handleDocWriterFeedback = useCallback(
    async (feedback: string) => {
      if (!feedback.trim() || !docEditorContent.trim()) return;
      snapshotDocVersion("Before writer feedback");
      setDocToolRunning("writer-feedback");
      try {
        const connectedContext = getDocConnectedContext();
        const res = await apiRequest("POST", "/api/write", {
          document: docEditorContent,
          instruction: `WRITER FEEDBACK:\nThe author has provided the following feedback to be remixed into the document:\n\n${feedback}\n\nInterpret the author's intent and intelligently weave this feedback into the document. This is not a literal transcription to append — it is editorial direction from the author.`,
          appType: "write-a-prompt",
          ...(docObjective.trim() ? { objective: docObjective.trim() } : {}),
          ...(connectedContext ? { sessionNotes: connectedContext } : {}),
        });
        const data = (await res.json()) as { document: string };
        if (data.document) {
          setDocEditorContent(data.document);
          toast({ title: "Document evolved", description: "Writer feedback integrated" });
        }
      } catch {
        toast({ title: "Writer feedback failed", variant: "destructive" });
      } finally {
        setDocToolRunning(null);
      }
    },
    [docEditorContent, docObjective, toast, snapshotDocVersion, getDocConnectedContext],
  );

  // Auto-focus writer text input when opened
  useEffect(() => {
    if (docWriterTextOpen) {
      setTimeout(() => docWriterTextInputRef.current?.focus(), 50);
    }
  }, [docWriterTextOpen]);

  // Auto-focus direct text input when opened
  useEffect(() => {
    if (docDirectTextOpen) {
      setTimeout(() => docDirectTextInputRef.current?.focus(), 50);
    }
  }, [docDirectTextOpen]);

  // ── Direct insert at cursor (no AI remix) ──
  const handleDocDirectInsert = useCallback(
    (text: string) => {
      if (!text.trim()) return;
      const el = docEditorRef.current;
      const cursor = el?.selectionStart ?? docEditorContent.length;
      const before = docEditorContent.slice(0, cursor);
      const after = docEditorContent.slice(cursor);
      // Insert with spacing
      const spacer = before.length > 0 && !before.endsWith("\n") && !before.endsWith(" ") ? " " : "";
      setDocEditorContent(before + spacer + text.trim() + after);
    },
    [docEditorContent],
  );

  // ── Selection remix (AI remixes only the selected text) ──
  const handleDocSelectionRemix = useCallback(
    async (feedback: string, selectedText: string) => {
      if (!feedback.trim() || !docEditorContent.trim()) return;
      snapshotDocVersion("Before selection remix");
      setDocToolRunning("sel-remix");
      try {
        const connectedContext = getDocConnectedContext();
        const res = await apiRequest("POST", "/api/write", {
          document: docEditorContent,
          selectedText,
          instruction: `WRITER FEEDBACK ON SELECTION:\nThe author has highlighted the following text and provided feedback to remix it:\n\nSELECTED TEXT: "${selectedText}"\n\nAUTHOR FEEDBACK: ${feedback}\n\nApply the author's feedback to improve the selected area while keeping the rest of the document intact.`,
          appType: "write-a-prompt",
          ...(docObjective.trim() ? { objective: docObjective.trim() } : {}),
          ...(connectedContext ? { sessionNotes: connectedContext } : {}),
        });
        const data = (await res.json()) as { document: string };
        if (data.document) {
          setDocEditorContent(data.document);
          toast({ title: "Selection remixed", description: "Feedback applied to highlighted text" });
        }
      } catch {
        toast({ title: "Selection remix failed", variant: "destructive" });
      } finally {
        setDocToolRunning(null);
        setDocSelectionPopover(null);
      }
    },
    [docEditorContent, docObjective, toast, snapshotDocVersion, getDocConnectedContext],
  );

  // ── Selection direct replace (insert text replacing selected portion) ──
  const handleDocSelectionDirectReplace = useCallback(
    (newText: string, selectedText: string) => {
      if (!newText.trim()) return;
      const idx = docEditorContent.indexOf(selectedText);
      if (idx === -1) return;
      const before = docEditorContent.slice(0, idx);
      const after = docEditorContent.slice(idx + selectedText.length);
      setDocEditorContent(before + newText.trim() + after);
      setDocSelectionPopover(null);
    },
    [docEditorContent],
  );

  // ── Handle text selection in the document editor ──
  const handleDocTextSelect = useCallback(() => {
    const selection = window.getSelection();
    const selectedText = selection?.toString().trim();
    if (!selectedText || selectedText.length < 3) {
      setDocSelectionPopover(null);
      return;
    }
    const range = selection?.getRangeAt(0);
    if (!range || !docEditorContainerRef.current) return;
    const rect = range.getBoundingClientRect();
    const containerRect = docEditorContainerRef.current.getBoundingClientRect();
    setDocSelectionPopover({
      text: selectedText,
      top: rect.top - containerRect.top - 44,
      left: rect.left - containerRect.left + rect.width / 2,
    });
    setDocSelEditMode(null);
    setDocSelEditText("");
    setDocSelVoiceActive(false);
  }, []);

  // Close selection popover on outside click
  useEffect(() => {
    if (!docSelectionPopover) return;
    const handleMouseDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest("[data-doc-selection-popover]")) return;
      setTimeout(() => {
        const sel = window.getSelection();
        if (!sel?.toString().trim()) {
          setDocSelectionPopover(null);
        }
      }, 100);
    };
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [docSelectionPopover]);

  // ── Evolve document from provo thread (inline mode) ──
  const handleDocProvoEvolve = useCallback(
    async (instruction: string) => {
      if (!docEditorContent.trim()) return;
      snapshotDocVersion("Before evolve");
      setDocProvoEvolving(true);
      try {
        const connectedContext = getDocConnectedContext();
        const res = await apiRequest("POST", "/api/write", {
          document: docEditorContent,
          instruction,
          appType: "write-a-prompt",
          ...(docObjective.trim() ? { objective: docObjective.trim() } : {}),
          ...(connectedContext ? { sessionNotes: connectedContext } : {}),
        });
        const data = (await res.json()) as { document: string };
        if (data.document) {
          setDocEditorContent(data.document);
          toast({ title: "Document evolved", description: "Provocation insights merged into your document" });
        }
      } catch {
        toast({ title: "Evolve failed", variant: "destructive" });
      } finally {
        setDocProvoEvolving(false);
      }
    },
    [docEditorContent, docObjective, toast, snapshotDocVersion, getDocConnectedContext],
  );

  // ── Close document editor overlay ──

  const handleCloseDocumentEditor = useCallback(() => {
    if (activeExpandedNodeId) {
      const n = stateRef.current.nodes.find((nd) => nd.id === activeExpandedNodeId);
      if (n?.type === "document" && !n.imageUrl) {
        // Auto-derive label from content, but only if the user hasn't manually renamed
        const autoLabel = docEditorContent
          ? docEditorContent.split("\n")[0]?.slice(0, 40) || "Document"
          : "New Document";
        // Check if current label looks auto-derived (matches previous auto-derive pattern)
        // or is missing — if so, update it. If user manually renamed, preserve their label.
        const prevAutoLabel = n.documentContent
          ? n.documentContent.split("\n")[0]?.slice(0, 40) || "Document"
          : "New Document";
        const wasManuallyRenamed = n.label && n.label !== prevAutoLabel;

        updateNode(activeExpandedNodeId, {
          documentContent: docEditorContent,
          documentObjective: docObjective.trim() || undefined,
          documentVersions: docVersions.length > 0 ? docVersions : undefined,
          snippet: docEditorContent.slice(0, 200) || "Double-click to edit",
          ...(wasManuallyRenamed ? {} : { label: autoLabel }),
        });
      }
    }
    setDocEditorContent("");
    setDocObjective("");
    setDocVersions([]);
    setDocLeftTab("tools");
  }, [activeExpandedNodeId, docEditorContent, docObjective, docVersions, updateNode]);

  // ── Header actions for status bar ──

  const zoomPercent = Math.round(state.viewport.zoom * 100);

  const headerActions = (
    <div className="flex items-center gap-0.5 mr-2 border-r border-border/30 pr-2">
      {/* Canvas Manager dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-6 gap-1 text-[10px] px-2">
            <FileText className="w-3 h-3" />
            Canvas
            <ChevronDown className="w-2.5 h-2.5 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-44">
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
          <DropdownMenuItem
            onClick={() => setShareDialogOpen(true)}
            disabled={!canvasDocumentId}
            className="text-xs gap-2"
          >
            <Share2 className="w-3.5 h-3.5" />
            Share Canvas
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => canvasDocumentId && setDeleteConfirm({ id: canvasDocumentId, title: canvasTitle || "Untitled Canvas" })}
            disabled={!canvasDocumentId}
            className="text-xs gap-2 text-destructive focus:text-destructive"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Delete Canvas
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={addTab} className="text-xs gap-2">
            <FilePlus2 className="w-3.5 h-3.5" />
            New Canvas
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
        <DropdownMenuContent align="start" className="w-44">
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
            onClick={() => setDetailsPanelOpen((v) => !v)}
            className="text-xs gap-2"
          >
            <Info className={`w-3.5 h-3.5 ${detailsPanelOpen ? "text-primary" : ""}`} />
            {detailsPanelOpen ? "Hide Node Details" : "Show Node Details"}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => setFrozen((f) => !f)}
            className="text-xs gap-2"
          >
            {frozen ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
            {frozen ? "Unlock Canvas" : "Freeze Canvas"}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => minimapState.toggleVisible()}
            className="text-xs gap-2"
          >
            <MapIcon className="w-3.5 h-3.5" />
            {minimapState.state.visible ? "Hide Minimap" : "Show Minimap"}
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

  // ── Auto-open node from URL deep-link ──
  const urlNodeOpenedRef = useRef(false);
  useEffect(() => {
    if (urlNodeId && state.nodes.length > 0 && !urlNodeOpenedRef.current) {
      const target = state.nodes.find((n) => n.id === urlNodeId);
      if (target) {
        urlNodeOpenedRef.current = true;
        openExpandedNode(urlNodeId);
      }
    }
  }, [urlNodeId, state.nodes, openExpandedNode]);

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
        role: roleMap.get(n.id) as "context" | "objective" | "output-format" | undefined,
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
        imageUrl,
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
        onDeleteCanvas={(id, title) => setDeleteConfirm({ id, title })}
        canvasLoading={canvasLoading}
        onOpenActivityLogs={() => setLifecycleConsoleOpen(true)}
        onOpenConnections={() => setConnectionsDialogOpen(true)}
        onOpenIntegrations={() => setIntegrationsDialogOpen(true)}
        onOpenConnectedApps={() => setConnectedAppsOpen(true)}
        onOpenContextStore={() => setContextStoreOpen(true)}
        appVersion={APP_VERSION}
        onOpenReleaseNotes={() => setReleaseNotesOpen(true)}
        mailboxUnreadCount={mailboxUnreadCount}
        onOpenMailbox={() => setMailboxOpen(true)}
        isSharedCanvas={isSharedCanvas}
        sharedPermission={sharedPermission}
        blueprintsSlot={
          <BlueprintsMenu
            onLoadBlueprint={handleLoadBlueprint}
            externalOpen={blueprintsExternalOpen}
            onExternalOpenChange={setBlueprintsExternalOpen}
            onSaveBlueprint={async (label: string, description: string) => {
              const originX = state.nodes[0]?.x ?? 0;
              const originY = state.nodes[0]?.y ?? 0;
              const nodes = state.nodes
                .filter((n) => n.type !== "zone" && n.type !== "label")
                .map((n) => {
                  const s = serializeNodeForSave(n);
                  // Normalize positions to 0,0 origin for blueprint portability
                  s.x = (s.x ?? 0) - originX;
                  s.y = (s.y ?? 0) - originY;
                  return s;
                });
              const edges = state.edges.map((e) => ({
                fromNodeId: e.fromNodeId,
                toNodeId: e.toNodeId,
                role: e.role,
              }));
              try {
                const res = await apiRequest("POST", "/api/blueprints", {
                  label,
                  description,
                  nodes,
                  edges,
                });
                const data = await res.json();
                toast({ title: "Blueprint saved", description: `"${label}" saved successfully` });
                return data;
              } catch (err) {
                toast({ title: "Failed to save blueprint", variant: "destructive" });
              }
            }}
          />
        }
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
          ...(!activeTheme.heroVisible && activeTheme.background ? {
            background: activeTheme.background,
          } : {}),
          ...(canvasFontSize && canvasFontSize !== 14 ? { fontSize: `${canvasFontSize}px` } : {}),
        }}
      >
        {/* Error banner when a canvas fails to load — non-blocking toast-style */}
        {canvasLoadError && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-40 pointer-events-auto">
            <div className="bg-card/95 backdrop-blur-sm border border-border rounded-lg px-4 py-3 max-w-md text-center shadow-lg flex items-center gap-3">
              <p className="text-sm text-muted-foreground flex-1">{canvasLoadError}</p>
              <div className="flex gap-2 shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setOpenCanvasDialogOpen(true)}
                >
                  <FolderOpen className="w-3.5 h-3.5 mr-1" />
                  Open
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={() => setCanvasLoadError(null)}
                >
                  <X className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          </div>
        )}
        <FlowCanvas
          state={state}
          frozen={frozen}
          disableKeys={!!activeExpandedNodeId}
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
          onRetryNode={handleRetryNode}
          onBringToFront={bringToFront}
          onToggleTrigger={toggleTrigger}
          onToggleLock={(nodeId) => {
            const node = state.nodes.find((n) => n.id === nodeId);
            if (!node) return;
            const isLocked = node.locked || node.lockMode === "canvas" || node.lockMode === "screen";
            if (isLocked) {
              // Unlock: if screen-locked, convert position back to canvas coords
              if (node.lockMode === "screen") {
                const vp = state.viewport;
                const canvasX = ((node.screenX ?? 100) - vp.x) / vp.zoom;
                const canvasY = ((node.screenY ?? 100) - vp.y) / vp.zoom;
                updateNode(nodeId, { lockMode: "none", locked: false, x: canvasX, y: canvasY });
              } else {
                updateNode(nodeId, { lockMode: "none", locked: false });
              }
            } else {
              updateNode(nodeId, { lockMode: "canvas", locked: true });
            }
          }}
          onDropTool={handleDropTool}
          onDragStart={pushUndoSnapshot}
          minimapState={minimapState}
          onFitToView={fitToView}
        />

        {!dockHidden && <FtuxDock />}
        <FlowLoadingBar active={canvasLoading || isSaving} progress={canvasLoading ? loadProgress : undefined} />

        {/* Chain progress bar (I4 + I6) */}
        <ChainProgressBar
          progress={chainExecutor.progress}
          onCancel={chainExecutor.abortChain}
        />

        {/* Version watermark — bottom-left corner */}
        <button
          onClick={() => setReleaseNotesOpen(true)}
          className="absolute bottom-2 left-2 z-10 text-[9px] text-muted-foreground/40 hover:text-muted-foreground/70 transition-colors font-mono cursor-pointer select-none"
          title={`Provocations v${APP_VERSION} — Click for release notes`}
        >
          v{APP_VERSION}
        </button>
        <WhatsNew />
        <HelpButton topic="canvas-basics" className="absolute bottom-1 left-24 z-10" />

        {/* Activity Logs overlay (full screen) */}
        {lifecycleConsoleOpen && (
          <ActivityLogsOverlay
            onClose={() => setLifecycleConsoleOpen(false)}
            onNavigateToNode={(nodeId) => {
              // Find node, select it, and pan viewport to center on it
              const node = stateRef.current.nodes.find((n) => n.id === nodeId);
              if (!node) return;
              selectNode(nodeId);
              const el = canvasContainerRef.current;
              const W = el?.clientWidth ?? 800;
              const H = el?.clientHeight ?? 600;
              const zoom = stateRef.current.viewport.zoom;
              setViewport(
                W / 2 - (node.x + node.width / 2) * zoom,
                H / 2 - (node.y + node.height / 2) * zoom,
                zoom,
              );
              setLifecycleConsoleOpen(false);
            }}
          />
        )}
      </div>

      {/* Release Notes dialog */}
      <Dialog open={releaseNotesOpen} onOpenChange={setReleaseNotesOpen}>
        <DialogContent className="max-w-lg max-h-[70vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-sm flex items-center gap-2">
              <ScrollText className="w-4 h-4" />
              Release Notes — v{APP_VERSION}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-auto space-y-4 pr-2">
            {RELEASE_NOTES.map((release) => (
              <div key={release.version} className="space-y-1">
                <div className="flex items-baseline gap-2">
                  <span className="text-xs font-semibold font-mono text-primary">
                    v{release.version}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {release.date}
                  </span>
                </div>
                <ul className="space-y-0.5 ml-3">
                  {release.changes.map((change, i) => (
                    <li key={i} className="text-[11px] text-muted-foreground flex items-start gap-1.5">
                      <span className="text-primary/60 mt-0.5">•</span>
                      {change}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

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
            {/* My canvases */}
            {canvasDocs.length === 0 && sharedCanvases.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">No saved canvases</p>
            ) : (
              <div className="space-y-2">
                {canvasDocs.length > 0 && (
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-2 py-1">My Canvases</p>
                    <div className="space-y-0.5">
                      {canvasDocs.map((doc) => {
                        const isActive = doc.id === canvasDocumentId;
                        return (
                        <div
                          key={doc.id}
                          className={`group w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted/50 transition-colors ${isActive ? "ring-1 ring-blue-500/50 bg-muted/30" : ""}`}
                        >
                          <button
                            className="flex items-center gap-2 min-w-0 flex-1 text-left"
                            onClick={() => handleOpenCanvas(doc.id, doc.title)}
                          >
                            <ScanLine className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                            <div className="min-w-0 flex-1">
                              <span className="text-xs truncate block">{doc.title === "[encrypted]" ? `Canvas #${doc.id}` : doc.title}</span>
                              <span className="text-[10px] text-muted-foreground">
                                #{doc.id}
                                {doc.updatedAt && (<> &middot; {new Date(doc.updatedAt).toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</>)}
                              </span>
                            </div>
                          </button>
                          <button
                            className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-destructive/20 hover:text-destructive transition-all shrink-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteConfirm({ id: doc.id, title: doc.title });
                            }}
                            title="Delete canvas"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                {sharedCanvases.length > 0 && (
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-2 py-1">Shared with Me</p>
                    <div className="space-y-0.5">
                      {sharedCanvases.map((sc) => (
                        <button
                          key={`shared-${sc.shareId}`}
                          className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted/50 text-left transition-colors"
                          onClick={() => handleOpenCanvas(sc.docId, sc.title, true)}
                        >
                          <Users className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                          <div className="min-w-0 flex-1">
                            <span className="text-xs truncate block">{sc.title}</span>
                            {sc.ownerName && <span className="text-[10px] text-muted-foreground">from {sc.ownerName}</span>}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {autoSaveCanvases.length > 0 && (
                  <details className="group">
                    <summary className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-2 py-1 cursor-pointer select-none list-none flex items-center gap-1 hover:text-foreground transition-colors">
                      <ChevronRight className="w-3 h-3 transition-transform group-open:rotate-90" />
                      Auto-Saves ({autoSaveCanvases.length})
                    </summary>
                    <div className="space-y-0.5">
                      {autoSaveCanvases.map((doc) => {
                        const isActive = doc.id === canvasDocumentId;
                        return (
                          <div
                            key={doc.id}
                            className={`group/item w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted/50 transition-colors ${isActive ? "ring-1 ring-blue-500/50 bg-muted/30" : ""}`}
                          >
                            <button
                              className="flex items-center gap-2 min-w-0 flex-1 text-left"
                              onClick={() => handleOpenCanvas(doc.id, doc.title)}
                            >
                              <Clock className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                              <div className="min-w-0 flex-1">
                                <span className="text-xs truncate block">{doc.title}</span>
                                <span className="text-[10px] text-muted-foreground">
                                  #{doc.id}
                                  {doc.updatedAt && (<> &middot; {new Date(doc.updatedAt).toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</>)}
                                </span>
                              </div>
                            </button>
                            <button
                              className="opacity-0 group-hover/item:opacity-100 p-1 rounded hover:bg-destructive/20 hover:text-destructive transition-all shrink-0"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteConfirm({ id: doc.id, title: doc.title });
                              }}
                              title="Delete auto-save"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </details>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete canvas confirmation */}
      <Dialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle className="text-sm">Delete Canvas</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">
            Are you sure you want to delete <strong className="text-foreground">{deleteConfirm?.title}</strong>? This cannot be undone.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setDeleteConfirm(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => deleteConfirm && handleDeleteCanvas(deleteConfirm.id)}
            >
              <Trash2 className="w-3.5 h-3.5 mr-1" />
              Delete
            </Button>
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
      {/* Edge role picker dialog: multi-select roles */}
      {pendingEdgeRole && (
        <EdgeRolePickerDialog
          pendingEdge={pendingEdgeRole}
          targetNode={state.nodes.find((n) => n.id === pendingEdgeRole.toNodeId)}
          onConfirm={(roles) => {
            addEdge(pendingEdgeRole.fromNodeId, pendingEdgeRole.toNodeId, roles);
            setPendingEdgeRole(null);
          }}
          onCancel={() => setPendingEdgeRole(null)}
        />
      )}

      {pendingLogicAction && (
        <>
          <div className="fixed inset-0 z-50" onClick={() => setPendingLogicAction(null)} />
          <div
            className="fixed z-50 bg-popover border border-border rounded-lg shadow-lg p-1 w-48 animate-in fade-in zoom-in-95 duration-100"
            style={{
              left: Math.max(8, Math.min(pendingLogicAction.screenX + 20, window.innerWidth - 210)),
              top: Math.max(8, Math.min(
                // If near the top of screen (e.g. clicked from status bar), show below the click point
                pendingLogicAction.screenY < 100
                  ? pendingLogicAction.screenY + 8
                  : pendingLogicAction.screenY - 60,
                window.innerHeight - 260,
              )),
            }}
          >
            <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Logic</div>
            {([
              { type: "filter" as const, icon: Filter, label: "Filter", color: "text-teal-500" },
              { type: "gate" as const, icon: ToggleRight, label: "Gate", color: "text-yellow-500" },
              { type: "coherence-gate" as const, icon: ShieldCheck, label: "Coherence Gate", color: "text-emerald-500" },
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
                    ...(item.type === "coherence-gate" ? {
                      coherenceThreshold: 75,
                      coherenceChecks: { topicMatch: true, toneConsistency: true, factDrift: false, styleMatch: false },
                      coherenceStrictness: "medium" as const,
                      coherenceRetryCount: 1,
                    } : {}),
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
          closeExpandedNode();
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
              // Document editor — premium notebook experience
              return (
                <div className="flex-1 flex overflow-hidden">
                  {/* ── Collapsible resizable sidebar ── */}
                  {docSidebarOpen && (
                    <div
                      className="border-r border-border/30 bg-card/30 flex flex-col min-h-0 overflow-hidden shrink-0 relative"
                      style={{ width: docSidebarWidth, minWidth: 220, maxWidth: 500 }}
                    >
                      {/* Tab bar */}
                      <div className="flex border-b border-border/30">
                        <button
                          className={cn(
                            "flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors",
                            docLeftTab === "tools"
                              ? "text-foreground border-b-2 border-primary"
                              : "text-muted-foreground hover:text-foreground",
                          )}
                          onClick={() => setDocLeftTab("tools")}
                        >
                          <Wrench className="w-3.5 h-3.5" />
                          Tools
                        </button>
                        <button
                          className={cn(
                            "flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors",
                            docLeftTab === "provo"
                              ? "text-foreground border-b-2 border-primary"
                              : "text-muted-foreground hover:text-foreground",
                          )}
                          onClick={() => setDocLeftTab("provo")}
                        >
                          <Swords className="w-3.5 h-3.5" />
                          Provo
                        </button>
                      </div>

                      {/* Tab content */}
                      <div className="flex-1 min-h-0 overflow-auto">
                        {docLeftTab === "tools" ? (
                          <>
                            <div className="p-3 border-b border-border/30">
                              <div className="grid grid-cols-2 gap-1.5">
                                {DOC_TOOLS.map((tool) => (
                                  <button
                                    key={tool.id}
                                    className="flex items-center gap-1.5 px-2.5 py-2 rounded-md border border-border/30 hover:bg-muted/50 transition-colors text-left disabled:opacity-50"
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
                            <DocConnectedInputs
                              nodeId={activeExpandedNodeId!}
                              edges={state.edges}
                              nodes={state.nodes}
                            />
                          </>
                        ) : (
                          <ProvoThread
                            documentText={docEditorContent}
                            objective={docObjective.trim() || activeExpandedNode?.label || ""}
                            activePersonas={docActivePersonas}
                            onTogglePersona={(id) =>
                              setDocActivePersonas((prev) => {
                                const next = new Set(prev);
                                if (next.has(id)) next.delete(id);
                                else next.add(id);
                                return next;
                              })
                            }
                            onCaptureToContext={() => {}}
                            hasDocument={!!docEditorContent.trim()}
                            mode="inline"
                            onEvolveWithProvocations={handleDocProvoEvolve}
                            isEvolving={docProvoEvolving}
                          />
                        )}
                      </div>
                      {/* Resize handle */}
                      <div
                        className="absolute top-0 right-0 w-1.5 h-full cursor-col-resize hover:bg-primary/20 active:bg-primary/30 transition-colors z-10"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          const startX = e.clientX;
                          const startW = docSidebarWidth;
                          const onMove = (ev: MouseEvent) => {
                            const delta = ev.clientX - startX;
                            setDocSidebarWidth(Math.max(220, Math.min(500, startW + delta)));
                          };
                          const onUp = () => {
                            window.removeEventListener("mousemove", onMove);
                            window.removeEventListener("mouseup", onUp);
                          };
                          window.addEventListener("mousemove", onMove);
                          window.addEventListener("mouseup", onUp);
                        }}
                      />
                    </div>
                  )}

                  {/* ── Main writing area ── */}
                  <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-[hsl(var(--background))]">
                    {/* Toolbar — sidebar toggle + writer voice/text */}
                    <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border/20 shrink-0 bg-muted/5">
                      <button
                        className="p-1.5 rounded-md hover:bg-muted/50 transition-colors text-muted-foreground"
                        onClick={() => setDocSidebarOpen((v) => !v)}
                        title={docSidebarOpen ? "Hide sidebar" : "Show sidebar"}
                      >
                        {docSidebarOpen ? (
                          <PanelLeftClose className="w-4 h-4" />
                        ) : (
                          <PanelLeft className="w-4 h-4" />
                        )}
                      </button>
                      {docVersions.length > 0 && (
                        <>
                          <div className="w-px h-4 bg-border/30" />
                          <span className="text-[9px] text-muted-foreground/60">
                            {docVersions.length} version{docVersions.length !== 1 ? "s" : ""}
                          </span>
                        </>
                      )}

                      {/* Spacer */}
                      <div className="flex-1" />

                      {/* ── AI Remix group label ── */}
                      <span className="text-[8px] uppercase tracking-wider text-primary/50 font-semibold mr-1">AI Remix</span>

                      {/* Writer Voice — dictate feedback to evolve the document */}
                      <div
                        className={cn(
                          "relative rounded-md transition-all",
                          docWriterVoiceActive ? "ring-2 ring-primary/50 bg-primary/10" : "hover:bg-primary/10",
                        )}
                        title="Writer Voice — dictate feedback to evolve the document"
                      >
                        <VoiceRecorder
                          onTranscript={(transcript: string) => {
                            if (!transcript.trim()) return;
                            handleDocWriterFeedback(transcript);
                            setDocWriterVoiceActive(false);
                            toast({ title: "Feedback sent", description: "Remixing your voice feedback into the document..." });
                          }}
                          onRecordingChange={setDocWriterVoiceActive}
                          size="icon"
                          variant="ghost"
                          className={cn(
                            "h-7 w-7",
                            docWriterVoiceActive ? "text-primary animate-pulse" : "text-primary/80 hover:text-primary",
                          )}
                        />
                        <span className={cn(
                          "absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full border border-background",
                          docWriterVoiceActive ? "bg-destructive animate-ping" : "bg-primary",
                        )} />
                      </div>

                      {/* Writer Text — toggle inline text input */}
                      <Button
                        size="icon"
                        variant="ghost"
                        className={cn(
                          "h-7 w-7 relative",
                          docWriterTextOpen
                            ? "text-primary bg-primary/10 ring-2 ring-primary/50"
                            : "text-primary/80 hover:text-primary hover:bg-primary/10",
                        )}
                        onClick={() => setDocWriterTextOpen(!docWriterTextOpen)}
                        title="Writer Edit — type feedback to evolve the document"
                      >
                        <PenLine className="w-3.5 h-3.5" />
                        <span className={cn(
                          "absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full border border-background bg-primary",
                        )} />
                      </Button>

                      {/* Separator between remix and direct groups */}
                      <div className="w-px h-5 bg-border/40 mx-1" />

                      {/* ── Direct Edit group label ── */}
                      <span className="text-[8px] uppercase tracking-wider text-emerald-500/50 font-semibold mr-1">Direct</span>

                      {/* Direct Voice — dictate text that gets inserted at cursor, no AI */}
                      <div
                        className={cn(
                          "relative rounded-md transition-all",
                          docDirectVoiceActive ? "ring-2 ring-emerald-500/50 bg-emerald-500/10" : "hover:bg-emerald-500/10",
                        )}
                        title="Direct Voice — dictate text inserted at cursor (no AI)"
                      >
                        <VoiceRecorder
                          onTranscript={(transcript: string) => {
                            if (!transcript.trim()) return;
                            handleDocDirectInsert(transcript);
                            setDocDirectVoiceActive(false);
                            toast({ title: "Inserted", description: "Voice text added at cursor position" });
                          }}
                          onRecordingChange={setDocDirectVoiceActive}
                          size="icon"
                          variant="ghost"
                          className={cn(
                            "h-7 w-7",
                            docDirectVoiceActive ? "text-emerald-500 animate-pulse" : "text-emerald-500/80 hover:text-emerald-500",
                          )}
                        />
                        <span className={cn(
                          "absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full border border-background",
                          docDirectVoiceActive ? "bg-destructive animate-ping" : "bg-emerald-500",
                        )} />
                      </div>

                      {/* Direct Text — toggle inline text input that appends at cursor, no AI */}
                      <Button
                        size="icon"
                        variant="ghost"
                        className={cn(
                          "h-7 w-7 relative",
                          docDirectTextOpen
                            ? "text-emerald-500 bg-emerald-500/10 ring-2 ring-emerald-500/50"
                            : "text-emerald-500/80 hover:text-emerald-500 hover:bg-emerald-500/10",
                        )}
                        onClick={() => setDocDirectTextOpen(!docDirectTextOpen)}
                        title="Direct Edit — type text inserted at cursor (no AI)"
                      >
                        <Type className="w-3.5 h-3.5" />
                        <span className={cn(
                          "absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full border border-background bg-emerald-500",
                        )} />
                      </Button>

                      {/* Status indicators */}
                      {(docWriterVoiceActive || docDirectVoiceActive) && (
                        <span className={cn(
                          "text-[11px] font-medium animate-pulse",
                          docDirectVoiceActive ? "text-emerald-500" : "text-primary",
                        )}>
                          Listening...
                        </span>
                      )}

                      {(docToolRunning === "writer-feedback" || docToolRunning === "sel-remix") && (
                        <span className="text-[11px] text-muted-foreground animate-pulse flex items-center gap-1">
                          <Loader2 className="w-3 h-3 animate-spin" />
                          Evolving...
                        </span>
                      )}
                    </div>

                    {/* Writer text input bar (AI remix) */}
                    {docWriterTextOpen && (
                      <div className="shrink-0 flex items-center gap-2 px-4 py-1.5 border-b bg-primary/5">
                        <PenLine className="w-3.5 h-3.5 text-primary shrink-0" />
                        <input
                          ref={docWriterTextInputRef}
                          type="text"
                          value={docWriterFeedbackText}
                          onChange={(e) => setDocWriterFeedbackText(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                              e.preventDefault();
                              if (docWriterFeedbackText.trim()) {
                                handleDocWriterFeedback(docWriterFeedbackText.trim());
                                setDocWriterFeedbackText("");
                                setDocWriterTextOpen(false);
                              }
                            }
                            if (e.key === "Escape") {
                              setDocWriterTextOpen(false);
                              setDocWriterFeedbackText("");
                            }
                          }}
                          placeholder="Type feedback for the AI to remix into the document..."
                          className="flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground/50"
                          disabled={docToolRunning !== null}
                        />
                        {docWriterFeedbackText.trim() && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6 shrink-0 text-primary"
                            onClick={() => {
                              handleDocWriterFeedback(docWriterFeedbackText.trim());
                              setDocWriterFeedbackText("");
                              setDocWriterTextOpen(false);
                            }}
                            disabled={docToolRunning !== null}
                          >
                            <Send className="w-3 h-3" />
                          </Button>
                        )}
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-5 w-5 shrink-0 text-muted-foreground"
                          onClick={() => { setDocWriterTextOpen(false); setDocWriterFeedbackText(""); }}
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    )}

                    {/* Direct text input bar (no AI, inserts at cursor) */}
                    {docDirectTextOpen && (
                      <div className="shrink-0 flex items-center gap-2 px-4 py-1.5 border-b bg-emerald-500/5">
                        <Type className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                        <input
                          ref={docDirectTextInputRef}
                          type="text"
                          value={docDirectText}
                          onChange={(e) => setDocDirectText(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                              e.preventDefault();
                              if (docDirectText.trim()) {
                                handleDocDirectInsert(docDirectText.trim());
                                setDocDirectText("");
                                setDocDirectTextOpen(false);
                              }
                            }
                            if (e.key === "Escape") {
                              setDocDirectTextOpen(false);
                              setDocDirectText("");
                            }
                          }}
                          placeholder="Type text to insert at cursor position (no AI)..."
                          className="flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground/50"
                        />
                        {docDirectText.trim() && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6 shrink-0 text-emerald-500"
                            onClick={() => {
                              handleDocDirectInsert(docDirectText.trim());
                              setDocDirectText("");
                              setDocDirectTextOpen(false);
                            }}
                          >
                            <Send className="w-3 h-3" />
                          </Button>
                        )}
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-5 w-5 shrink-0 text-muted-foreground"
                          onClick={() => { setDocDirectTextOpen(false); setDocDirectText(""); }}
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    )}

                    {/* Scrollable page */}
                    <div className="flex-1 min-h-0 overflow-y-auto">
                      <div className="max-w-5xl mx-auto px-6 sm:px-10 py-6 sm:py-10">
                        {/* Objective — ProvokeText with smart buttons, visually distinct */}
                        <div className="mb-6 rounded-lg border border-primary/20 bg-primary/5">
                          <div className="flex items-center gap-2 px-3 py-1.5 border-b border-primary/10">
                            <Crosshair className="w-3.5 h-3.5 text-primary/60" />
                            <span className="text-[10px] font-semibold uppercase tracking-wider text-primary/60">
                              Objective
                            </span>
                          </div>
                          <ProvokeText
                            value={docObjective}
                            onChange={(v) => setDocObjective(v)}
                            chrome="bare"
                            variant="textarea"
                            placeholder="What is the purpose of this document? Define the goal to guide AI tools..."
                            showCopy
                            showClear
                          />
                        </div>

                        {/* Main document writing surface with selection popover */}
                        <div ref={docEditorContainerRef} className="relative">
                          {/* Selection quick actions popover */}
                          {docSelectionPopover && (
                            <div
                              data-doc-selection-popover
                              className="absolute z-50 bg-card border border-border/50 rounded-lg shadow-xl p-1.5 flex flex-col gap-1 min-w-[180px]"
                              style={{
                                top: docSelectionPopover.top,
                                left: Math.max(10, docSelectionPopover.left - 90),
                              }}
                            >
                              {/* Quick action row: 4 buttons */}
                              {!docSelEditMode && (
                                <div className="flex items-center gap-1">
                                  {/* Remix with Voice */}
                                  <div
                                    className={cn(
                                      "relative rounded-md transition-all",
                                      docSelVoiceActive ? "ring-2 ring-primary/50 bg-primary/10" : "hover:bg-primary/10",
                                    )}
                                    title="Remix selection with voice"
                                  >
                                    <VoiceRecorder
                                      onTranscript={(transcript: string) => {
                                        if (!transcript.trim() || !docSelectionPopover) return;
                                        handleDocSelectionRemix(transcript, docSelectionPopover.text);
                                        setDocSelVoiceActive(false);
                                        window.getSelection()?.removeAllRanges();
                                        toast({ title: "Remixing selection...", description: "AI is applying your voice feedback" });
                                      }}
                                      onRecordingChange={setDocSelVoiceActive}
                                      size="icon"
                                      variant="ghost"
                                      className={cn(
                                        "h-7 w-7",
                                        docSelVoiceActive ? "text-primary animate-pulse" : "text-primary/80 hover:text-primary",
                                      )}
                                    />
                                  </div>
                                  {/* Remix with Text */}
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-7 w-7 text-primary/80 hover:text-primary hover:bg-primary/10"
                                    onClick={() => { setDocSelEditMode("text-remix"); setDocSelEditText(""); }}
                                    title="Remix selection with text"
                                  >
                                    <PenLine className="w-3.5 h-3.5" />
                                  </Button>
                                  <div className="w-px h-5 bg-border/40" />
                                  {/* Direct Voice replace */}
                                  <div
                                    className="relative rounded-md transition-all hover:bg-emerald-500/10"
                                    title="Replace selection with voice (no AI)"
                                  >
                                    <VoiceRecorder
                                      onTranscript={(transcript: string) => {
                                        if (!transcript.trim() || !docSelectionPopover) return;
                                        handleDocSelectionDirectReplace(transcript, docSelectionPopover.text);
                                        window.getSelection()?.removeAllRanges();
                                        toast({ title: "Replaced", description: "Selection replaced with voice text" });
                                      }}
                                      onRecordingChange={(v) => { if (v) setDocSelEditMode("voice-direct"); else setDocSelEditMode(null); }}
                                      size="icon"
                                      variant="ghost"
                                      className="h-7 w-7 text-emerald-500/80 hover:text-emerald-500"
                                    />
                                  </div>
                                  {/* Direct Text replace */}
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-7 w-7 text-emerald-500/80 hover:text-emerald-500 hover:bg-emerald-500/10"
                                    onClick={() => { setDocSelEditMode("text-direct"); setDocSelEditText(""); }}
                                    title="Replace selection with text (no AI)"
                                  >
                                    <Type className="w-3.5 h-3.5" />
                                  </Button>
                                </div>
                              )}

                              {/* Inline text input for selection edit modes */}
                              {(docSelEditMode === "text-remix" || docSelEditMode === "text-direct") && (
                                <div className="flex items-center gap-1.5">
                                  <input
                                    autoFocus
                                    type="text"
                                    value={docSelEditText}
                                    onChange={(e) => setDocSelEditText(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter" && !e.shiftKey && docSelEditText.trim() && docSelectionPopover) {
                                        e.preventDefault();
                                        if (docSelEditMode === "text-remix") {
                                          handleDocSelectionRemix(docSelEditText.trim(), docSelectionPopover.text);
                                        } else {
                                          handleDocSelectionDirectReplace(docSelEditText.trim(), docSelectionPopover.text);
                                        }
                                        window.getSelection()?.removeAllRanges();
                                      }
                                      if (e.key === "Escape") {
                                        setDocSelEditMode(null);
                                        setDocSelEditText("");
                                      }
                                    }}
                                    placeholder={docSelEditMode === "text-remix" ? "AI feedback on selection..." : "Replace selection with..."}
                                    className="flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground/50 min-w-[160px]"
                                    disabled={docToolRunning !== null}
                                  />
                                  {docSelEditText.trim() && (
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className={cn(
                                        "h-6 w-6 shrink-0",
                                        docSelEditMode === "text-remix" ? "text-primary" : "text-emerald-500",
                                      )}
                                      onClick={() => {
                                        if (!docSelEditText.trim() || !docSelectionPopover) return;
                                        if (docSelEditMode === "text-remix") {
                                          handleDocSelectionRemix(docSelEditText.trim(), docSelectionPopover.text);
                                        } else {
                                          handleDocSelectionDirectReplace(docSelEditText.trim(), docSelectionPopover.text);
                                        }
                                        window.getSelection()?.removeAllRanges();
                                      }}
                                      disabled={docToolRunning !== null}
                                    >
                                      <Send className="w-3 h-3" />
                                    </Button>
                                  )}
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-5 w-5 shrink-0 text-muted-foreground"
                                    onClick={() => { setDocSelEditMode(null); setDocSelEditText(""); }}
                                  >
                                    <X className="w-3 h-3" />
                                  </Button>
                                </div>
                              )}

                              {/* Status for voice modes */}
                              {(docSelEditMode === "voice-direct" || docSelVoiceActive) && (
                                <span className={cn(
                                  "text-[10px] font-medium animate-pulse px-1",
                                  docSelVoiceActive ? "text-primary" : "text-emerald-500",
                                )}>
                                  Listening...
                                </span>
                              )}
                            </div>
                          )}

                          <ProvokeText
                            ref={docEditorRef}
                            value={docEditorContent}
                            onChange={setDocEditorContent}
                            onSelect={handleDocTextSelect}
                            chrome="bare"
                            variant="editor"
                            showCopy
                            showClear={false}
                            placeholder="Start writing..."
                          />
                        </div>
                      </div>
                    </div>

                    {/* Version history — compact bottom bar, only if versions exist */}
                    {docVersions.length > 0 && (
                      <div className="px-4 py-1.5 border-t border-border/20 shrink-0 bg-muted/5">
                        <div className="flex items-center gap-2 max-w-5xl mx-auto">
                          <span className="text-[9px] font-medium text-muted-foreground/50 uppercase tracking-wider shrink-0">
                            History
                          </span>
                          <div className="flex-1 flex gap-1 overflow-x-auto">
                            {docVersions.map((v, i) => (
                              <button
                                key={i}
                                className="shrink-0 px-2 py-0.5 rounded text-[9px] border border-border/30 hover:bg-muted/30 transition-colors text-muted-foreground/60 hover:text-foreground"
                                title={`${v.label} — ${new Date(v.timestamp).toLocaleTimeString()}`}
                                onClick={() => {
                                  snapshotDocVersion("Before revert");
                                  setDocEditorContent(v.content);
                                  toast({ title: "Reverted", description: `Restored: ${v.label}` });
                                }}
                              >
                                v{i + 1}: {v.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
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

            case "llm-base":
              return (
                <LlmBaseExpandedView
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
                  onToggleTrigger={toggleTrigger}
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

            case "coherence-gate":
              return (
                <CoherenceGateExpandedView
                  node={activeExpandedNode}
                  nodes={state.nodes}
                  edges={state.edges}
                  onUpdateNode={updateNode}
                  onPlayNode={handlePlayNode}
                />
              );

            case "store":
              return (
                <StoreExpandedView
                  node={activeExpandedNode}
                  onUpdateNode={updateNode}
                />
              );

            case "webpage":
              return (
                <WebpageExpandedView
                  node={activeExpandedNode}
                  nodes={state.nodes}
                  edges={state.edges}
                  onUpdateNode={updateNode}
                />
              );

            case "upload":
              return (
                <UploadExpandedView
                  node={activeExpandedNode}
                  onUpdateNode={updateNode}
                />
              );

            case "notification":
              return (
                <NotificationExpandedView
                  node={activeExpandedNode}
                  onUpdateNode={updateNode}
                  onPlayNode={handlePlayNode}
                />
              );

            case "approval":
              return (
                <ApprovalExpandedView
                  node={activeExpandedNode}
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

            case "event-bus":
              return (
                <EventBusExpandedView
                  node={activeExpandedNode}
                  onUpdateNode={updateNode}
                  onPlayNode={handlePlayNode}
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
          <FlowOverlayErrorBoundary onClose={handleOverlayClose}>
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
              <Suspense fallback={
                <div className="flex-1 flex items-center justify-center">
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                    <p className="text-sm text-muted-foreground">Loading view...</p>
                  </div>
                </div>
              }>
                {renderExpandedContent()}
              </Suspense>
            </FlowExpandedOverlay>
          </FlowOverlayErrorBoundary>
        );
      })()}

      {/* Mailbox drawer */}
      <MailboxDrawer open={mailboxOpen} onOpenChange={setMailboxOpen} />

      {/* Connections dialog */}
      <Dialog open={connectionsDialogOpen} onOpenChange={setConnectionsDialogOpen}>
        <DialogContent className="max-w-md max-h-[70vh] flex flex-col p-0">
          <DialogTitle className="sr-only">Connections</DialogTitle>
          <ConnectionsManager onBack={() => setConnectionsDialogOpen(false)} />
        </DialogContent>
      </Dialog>

      {/* Platform Integrations dialog */}
      <PlatformIntegrations open={integrationsDialogOpen} onOpenChange={setIntegrationsDialogOpen} />
      <ConnectedAppsDialog open={connectedAppsOpen} onOpenChange={setConnectedAppsOpen} savedCanvases={canvasDocs.map((d: DocumentListItem) => ({ id: d.id, title: d.title }))} />
      <ContextStoreManager open={contextStoreOpen} onOpenChange={setContextStoreOpen} />

      {/* Share Canvas dialog */}
      {canvasDocumentId && (
        <ShareDialog
          open={shareDialogOpen}
          onOpenChange={setShareDialogOpen}
          itemType="document"
          itemId={canvasDocumentId}
          itemTitle={canvasTitle || "Untitled Canvas"}
        />
      )}

      {/* Welcome overlay for first-time users */}
      <WelcomeOverlay
        onStartTour={() => {
          // The FlowWorkspace forces tourCompleted=true, so we reset tips instead
          toast({ title: "Tip: Drag tools from the dock below to get started!" });
        }}
        onLoadBlueprint={() => setBlueprintsExternalOpen(true)}
      />

      {/* Keyboard shortcuts overlay (triggered by ? or Ctrl+/) */}
      <KeyboardShortcutsOverlay />
    </FtuxShell>
  );
}

export default function FlowWorkspace() {
  const { shellConfig, setShellConfig } = useFtuxShellConfig();

  // Merge user's persisted config with FlowWorkspace defaults:
  // Preserve user's dock item ordering but ensure all catalog tools are present.
  // New tools from FLOW_DOCK_ITEMS are appended; removed tools are dropped.
  // Hotkeys 1-9 are tied to POSITIONS, not icons — reordering changes which tool a number activates.

  // Stabilize dock items with ref — only recompute when the actual toolId order changes.
  // This prevents the FtuxShellProvider sync effect from re-applying merged order
  // when unrelated config properties (like dockLocked) change.
  const prevDockRef = useRef<DockItem[]>();
  const mergedDockItems = useMemo(() => {
    const userItems = shellConfig.dockItems ?? [];
    const userKey = userItems.map((i) => i.toolId).join(",");
    const prevKey = prevDockRef.current?.map((i) => i.toolId).join(",");
    if (userKey === prevKey && prevDockRef.current) return prevDockRef.current;

    const catalogSet = new Set(FLOW_DOCK_ITEMS.map((d) => d.toolId));
    const ordered = userItems.filter((item) => catalogSet.has(item.toolId));
    const existingIds = new Set(ordered.map((d) => d.toolId));
    for (const item of FLOW_DOCK_ITEMS) {
      if (!existingIds.has(item.toolId)) ordered.push(item);
    }
    const result = ordered.length > 0 ? ordered : FLOW_DOCK_ITEMS;
    prevDockRef.current = result;
    return result;
  }, [shellConfig.dockItems]);

  const mergedConfig = useMemo<FtuxShellConfig>(() => {
    return {
      ...shellConfig,
      dockItems: mergedDockItems,
      dockShowLabels: shellConfig.dockShowLabels ?? FLOW_SHELL_CONFIG.dockShowLabels,
      dockSnapped: shellConfig.dockSnapped ?? FLOW_SHELL_CONFIG.dockSnapped,
      dockButtonSize: shellConfig.dockButtonSize ?? FLOW_SHELL_CONFIG.dockButtonSize,
      tourCompleted: true,
      tipsEnabled: false,
    };
  }, [shellConfig, mergedDockItems]);

  return (
    <FtuxShellProvider initialConfig={mergedConfig} onConfigChange={setShellConfig}>
      <FlowWorkspaceInner />
    </FtuxShellProvider>
  );
}
