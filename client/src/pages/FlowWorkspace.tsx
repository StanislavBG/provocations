import { useCallback, useRef, useState, useEffect } from "react";
import { createPortal } from "react-dom";
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
import { NotebookResearchChat } from "@/components/notebook/NotebookResearchChat";
import { DEFAULT_SHELL_CONFIG } from "@/lib/ftux-shell-context";
import { getPreset } from "@/components/flow/llm-presets";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useCanvasCollab } from "@/hooks/use-canvas-collab";
import { Button } from "@/components/ui/button";
import { ProvokeText } from "@/components/ProvokeText";
import { ShareDialog } from "@/components/ShareDialog";
import { ArtifyPanel } from "@/components/ArtifyPanel";
import { ConnectionsManager } from "@/components/ConnectionsManager";
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
  X, Loader2, Save, Maximize, FileText, FolderOpen, FolderInput,
  ZoomIn, ZoomOut, Lock, Unlock, ChevronDown, ScanLine,
  FolderUp, FilePlus2, Share2, Expand, Shrink, AlignJustify,
  Lightbulb, Paintbrush2, PenLine, Users, Wifi, WifiOff,
  Filter, ToggleRight, GitBranch, Merge as MergeIcon, Pause, Play as PlayIcon,
} from "lucide-react";
import type { ChatMessageWithMeta } from "@shared/schema";

// ── Dock config ──

const FLOW_DOCK_ITEMS: DockItem[] = [
  { toolId: "context", label: "Context", icon: "BookOpen", group: "gather" },
  { toolId: "zone", label: "Zone", icon: "SquareDashedBottom", group: "gather" },
  { toolId: "audio", label: "Capture Audio", icon: "Mic", group: "gather" },
  { toolId: "youtube", label: "YouTube", icon: "Youtube", group: "gather" },
  { toolId: "research", label: "Research", icon: "Sparkles", group: "workshop" },
  { toolId: "interview", label: "Interview", icon: "MessageCircleQuestion", group: "workshop" },
  { toolId: "document", label: "Document", icon: "FileEdit", group: "build" },
  { toolId: "llm", label: "Text Mods", icon: "Brain", group: "build" },
  { toolId: "painter", label: "Painter", icon: "Paintbrush", group: "build" },
  { toolId: "timeline", label: "Timeline", icon: "Clock", group: "build" },
  { toolId: "timer-event", label: "Timer Event", icon: "Timer", group: "build" },
  { toolId: "logic", label: "Logic", icon: "CircuitBoard", group: "build" },
];

const FLOW_SHELL_CONFIG: FtuxShellConfig = {
  ...DEFAULT_SHELL_CONFIG,
  dockItems: FLOW_DOCK_ITEMS,
  dockShowLabels: true,
  tourCompleted: true,
  tipsEnabled: false,
};

// ── Document list item type ──

interface DocumentListItem {
  id: number;
  title: string;
  docType?: string;
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

// ── Inner workspace (needs shell context) ──

function FlowWorkspaceInner() {
  const { activeTool, setActiveTool, dockItems } = useFtuxShell();
  const {
    state, addNode, addEdge, updateNode, pushUndoSnapshot, moveNode, moveNodes, deleteNode, deleteEdge,
    selectNode, selectNodes, selectAll, toggleSelectNode, setViewport, loadCanvas, resetCanvas,
    undo, redo,
  } = useFlowCanvas();
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const { user } = useUser();

  // Track mouse position over canvas for dock-shortcut placement
  const mousePosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      mousePosRef.current = { x: e.clientX, y: e.clientY };
    };
    window.addEventListener("mousemove", handler);
    return () => window.removeEventListener("mousemove", handler);
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

  const [activeResearchNodeId, setActiveResearchNodeId] = useState<string | null>(null);
  const [activeDocumentNodeId, setActiveDocumentNodeId] = useState<string | null>(null);
  const [activePainterNodeId, setActivePainterNodeId] = useState<string | null>(null);
  const [activeImageNodeId, setActiveImageNodeId] = useState<string | null>(null);
  const [pendingLogicAction, setPendingLogicAction] = useState<{ x: number; y: number } | null>(null);
  const [docEditorContent, setDocEditorContent] = useState("");
  const [docToolRunning, setDocToolRunning] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [frozen, setFrozen] = useState(false);
  const [canvasDocumentId, setCanvasDocumentId] = useState<number | null>(null);
  const [canvasTitle, setCanvasTitle] = useState("");
  const [openCanvasDialogOpen, setOpenCanvasDialogOpen] = useState(false);
  const [connectionsDialogOpen, setConnectionsDialogOpen] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [collabEnabled, setCollabEnabled] = useState(false);
  const [pendingContextAction, setPendingContextAction] = useState<{ x: number; y: number; mode?: "load" | "save" } | null>(null);

  // ── Refs for accessing latest state/callbacks in keyboard handlers ──

  const stateRef = useRef(state);
  stateRef.current = state;

  // Ref to handleDropTool so keyboard shortcuts can call it (declared later)
  const handleDropToolRef = useRef<(toolId: string, cx: number, cy: number) => void>(() => {});

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
          setPendingContextAction({ ...pendingContextAction, mode: "load" });
          e.preventDefault();
          return;
        }
        if (e.key === "2") {
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
    enabled: pendingContextAction?.mode === "load" || openCanvasDialogOpen,
  });

  const docs = docsData?.documents ?? [];
  const canvasDocs = docs.filter((d) => d.docType === "chart");

  // ── Intercept dock clicks — place at mouse cursor ──

  useEffect(() => {
    if (!activeTool) return;
    setActiveTool(null);
    const pos = getCanvasPosAtMouse();
    handleDropToolRef.current(activeTool, pos.x, pos.y);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTool]);

  // ── Placement helper ──

  const getPlacementCenter = useCallback(() => {
    const el = canvasContainerRef.current;
    const w = el?.clientWidth ?? 800;
    const h = el?.clientHeight ?? 600;
    const offset = state.nodes.length * 30;
    return {
      x: (-state.viewport.x + w / 2) / state.viewport.zoom + offset,
      y: (-state.viewport.y + h / 2) / state.viewport.zoom + offset,
    };
  }, [state.viewport, state.nodes.length]);

  // ── Pick document from on-canvas Context Store ──

  const handlePickDocument = useCallback(
    (doc: { id: number; title: string; content: string }) => {
      const pos = getPlacementCenter();
      addNode("context-doc", pos.x, pos.y, {
        label: doc.title,
        documentId: doc.id,
        snippet: doc.content.slice(0, 200),
        content: doc.content,
      });
    },
    [addNode, getPlacementCenter],
  );

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

  // ── Double-click node ──

  const handleNodeDoubleClick = useCallback(
    (nodeId: string) => {
      const node = state.nodes.find((n) => n.id === nodeId);
      if (node?.type === "research") {
        setActiveResearchNodeId(nodeId);
      }
      if (node?.type === "document" && !node.imageUrl) {
        setActiveDocumentNodeId(nodeId);
        setDocEditorContent(node.documentContent || "");
      }
      if (node?.type === "document" && node.imageUrl) {
        setActiveImageNodeId(nodeId);
      }
      if (node?.type === "painter") {
        setActivePainterNodeId(nodeId);
      }
    },
    [state.nodes],
  );

  // ── Create document from LLM output ──

  const handleCreateNote = useCallback(
    (content: string, label: string) => {
      const pos = getPlacementCenter();
      addNode("document", pos.x, pos.y, {
        label,
        snippet: content.slice(0, 200),
        content,
        documentContent: content,
      });
    },
    [addNode, getPlacementCenter],
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
      addEdge(fromNodeId, toNodeId);
    },
    [addEdge, state.edges],
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

      // Combine input content
      const combinedContent = inputNodes
        .map((n) => n.documentContent || n.content || n.snippet || "")
        .filter((s) => s.trim())
        .join("\n\n---\n\n");

      if (!combinedContent.trim()) {
        toast({ title: "No content", description: "Input nodes have no content" });
        return;
      }

      // Mark node as running
      updateNode(nodeId, { llmStatus: "running", snippet: "Running..." });

      try {
        let outputText = "";

        if (node.type === "research") {
          // Stream research using SSE
          const res = await fetch("/api/chat/stream", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              message: `Research the following topic thoroughly and provide a comprehensive analysis:\n\n${combinedContent}`,
              objective: combinedContent.slice(0, 200),
              history: [],
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
            if (downstream && ["research", "interview", "painter", "timeline", "llm"].includes(downstream.type)) {
              setTimeout(() => handlePlayNode(edge.toNodeId), 500);
            }
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

        // Create an output Document node to the right of the played node
        const outputDocId = addNode("document", node.x + node.width + 60, node.y, {
          label: `${node.label} Output`,
          documentContent: outputText,
          snippet: outputText.slice(0, 200),
        });

        // Create edge from the played node to the output document
        addEdge(nodeId, outputDocId);

        toast({ title: "Execution complete", description: `Output document created` });

        // ── Chain propagation: auto-trigger downstream playable nodes ──
        // Find nodes that receive input from this node (edges from nodeId → downstream)
        const downstreamEdges = stateRef.current.edges.filter((e) => e.fromNodeId === nodeId);
        for (const edge of downstreamEdges) {
          const downstream = stateRef.current.nodes.find((n) => n.id === edge.toNodeId);
          if (downstream && ["research", "interview", "painter", "timeline", "llm"].includes(downstream.type)) {
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
      if (toolId === "timer-event") {
        addNode("timer-event", canvasX, canvasY, {
          label: "Timer Event",
          snippet: "Click start to begin pulsing",
          timerRunning: false,
          timerPulseCount: 0,
          timerInterval: 5000,
        });
        return;
      }
      if (toolId === "logic") {
        setPendingLogicAction({ x: canvasX, y: canvasY });
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

  // ── Timer-Event: auto-create/append to document node on each pulse ──

  const timerDocMapRef = useRef<Map<string, string>>(new Map());
  const timerLastPulseRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    for (const node of state.nodes) {
      if (node.type !== "timer-event" || !node.timerRunning) continue;
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
          label: `Timer Log — ${new Date().toLocaleDateString()}`,
          snippet: node.content?.slice(-200) || "Timer events",
          content: node.content || "",
          documentContent: node.content || "",
        });
        addEdge(node.id, docId);
        timerDocMapRef.current.set(node.id, docId);
      }
    }
  }, [state.nodes, addNode, addEdge, updateNode]);

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
      try {
        const res = await apiRequest("GET", `/api/documents/${docId}`);
        const data = (await res.json()) as { title: string; content: string };
        const parsed = JSON.parse(data.content);
        loadCanvas(parsed);
        setCanvasDocumentId(docId);
        setCanvasTitle(data.title || docTitle);
        setOpenCanvasDialogOpen(false);
        toast({ title: "Canvas loaded", description: data.title || docTitle });
      } catch {
        toast({ title: "Failed to load canvas", variant: "destructive" });
      }
    },
    [loadCanvas, toast],
  );

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
    if (activeDocumentNodeId) {
      updateNode(activeDocumentNodeId, {
        documentContent: docEditorContent,
        snippet: docEditorContent.slice(0, 200) || "Double-click to edit",
        label: docEditorContent
          ? docEditorContent.split("\n")[0]?.slice(0, 40) || "Document"
          : "New Document",
      });
    }
    setActiveDocumentNodeId(null);
    setDocEditorContent("");
  }, [activeDocumentNodeId, docEditorContent, updateNode]);

  // ── Header actions for status bar ──

  const zoomPercent = Math.round(state.viewport.zoom * 100);

  const headerActions = (
    <div className="flex items-center gap-1 mr-2 border-r border-border/30 pr-2">
      {canvasTitle && (
        <span className="text-[10px] text-muted-foreground mr-1 max-w-[120px] truncate">
          {canvasTitle}
        </span>
      )}
      <Button
        variant="ghost"
        size="sm"
        className="h-6 gap-1 text-[10px] px-2"
        onClick={handleSaveCanvas}
        disabled={isSaving || state.nodes.length === 0}
      >
        {isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
        Save
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-6 gap-1 text-[10px] px-2">
            <ScanLine className="w-3 h-3" />
            {zoomPercent}%
            <ChevronDown className="w-2.5 h-2.5 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem onClick={() => setOpenCanvasDialogOpen(true)} className="text-xs gap-2">
            <FolderUp className="w-3.5 h-3.5" />
            Open Canvas
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleNewCanvas} className="text-xs gap-2">
            <FilePlus2 className="w-3.5 h-3.5" />
            New Canvas
          </DropdownMenuItem>
          <DropdownMenuSeparator />
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
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => window.location.href = "/old"}
            className="text-xs gap-2"
          >
            Classic View
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={handleSaveBlueprint}
            disabled={state.selectedNodeIds.size === 0}
            className="text-xs gap-2"
          >
            <Save className="w-3.5 h-3.5" />
            Save Blueprint
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={handleLoadBlueprint}
            className="text-xs gap-2"
          >
            <FolderOpen className="w-3.5 h-3.5" />
            Load Blueprint
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

  // ── Get active research node for overlay ──

  const activeResearchNode = activeResearchNodeId
    ? state.nodes.find((n) => n.id === activeResearchNodeId)
    : null;

  const activeDocumentNode = activeDocumentNodeId
    ? state.nodes.find((n) => n.id === activeDocumentNodeId)
    : null;

  const activePainterNode = activePainterNodeId
    ? state.nodes.find((n) => n.id === activePainterNodeId)
    : null;

  // Gather input text for the painter from connected nodes
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

      // Update the painter node to show it produced output
      updateNode(activePainterNodeId, {
        llmStatus: "done",
        snippet: `Generated: ${prompt.slice(0, 80)}...`,
      });

      // Create an image document node positioned to the right of the painter
      const imgX = (painterNode?.x ?? 0) + (painterNode?.width ?? 260) + 60;
      const imgY = painterNode?.y ?? 0;
      const imgNodeId = addNode("document", imgX, imgY, {
        label: `Image: ${prompt.slice(0, 30)}${prompt.length > 30 ? "..." : ""}`,
        snippet: "Generated image",
        imageUrl,
        content: prompt,
        documentContent: prompt,
      });

      // Connect painter → image document
      addEdge(activePainterNodeId, imgNodeId);
    },
    [activePainterNodeId, addNode, addEdge, updateNode],
  );

  return (
    <FtuxShell>
      <FtuxStatusBar templateName="Flow" templateId={null} headerActions={headerActions} />

      <div ref={canvasContainerRef} className="flex-1 relative overflow-hidden">
        <FlowCanvas
          state={state}
          frozen={frozen}
          onMoveNode={moveNode}
          onMoveNodes={moveNodes}
          onDeleteNode={deleteNode}
          onSelectNode={selectNode}
          onSelectNodes={selectNodes}
          onToggleSelectNode={toggleSelectNode}
          onNodeDoubleClick={handleNodeDoubleClick}
          onViewportChange={setViewport}
          onPickDocument={handlePickDocument}
          onUpdateNode={updateNode}
          onCreateNote={handleCreateNote}
          onCreateEdge={handleCreateEdge}
          onDeleteEdge={deleteEdge}
          onPlayNode={handlePlayNode}
          onToggleLock={(nodeId) => updateNode(nodeId, { locked: !state.nodes.find((n) => n.id === nodeId)?.locked })}
          onDropTool={handleDropTool}
          onDragStart={pushUndoSnapshot}
        />

        <FtuxDock />
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
              onClick={() => setPendingContextAction((prev) => prev ? { ...prev, mode: "load" } : null)}
            >
              <span className="text-[9px] font-mono text-muted-foreground/60 w-4 shrink-0">1</span>
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
                addNode("document", pendingContextAction.x, pendingContextAction.y, {
                  label: "New Document",
                  snippet: "Double-click to edit",
                  documentContent: "",
                });
                setPendingContextAction(null);
              }}
            >
              <span className="text-[9px] font-mono text-muted-foreground/60 w-4 shrink-0">2</span>
              <FilePlus2 className="w-4 h-4 text-indigo-500" />
              <div className="text-left">
                <div className="text-xs font-medium">New Document</div>
                <div className="text-[10px] text-muted-foreground">Create a blank document node</div>
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

      {/* Document picker dialog (after choosing Load File) */}
      <Dialog
        open={pendingContextAction?.mode === "load"}
        onOpenChange={(open) => !open && setPendingContextAction(null)}
      >
        <DialogContent className="max-w-sm max-h-[60vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-sm">Pick a document</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-auto -mx-6 px-6">
            {docs.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">No documents found</p>
            ) : (
              <div className="space-y-0.5">
                {docs.map((doc) => (
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

      {/* Logic node type picker dialog */}
      <Dialog
        open={pendingLogicAction !== null}
        onOpenChange={(open) => !open && setPendingLogicAction(null)}
      >
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle className="text-sm">Logic Node</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            {([
              { type: "filter" as const, icon: Filter, label: "Filter", desc: "Pass data through only if condition is met", color: "text-teal-500" },
              { type: "gate" as const, icon: ToggleRight, label: "Gate", desc: "Manual on/off switch to allow or block flow", color: "text-yellow-500" },
              { type: "router" as const, icon: GitBranch, label: "Router", desc: "Route data to different outputs by condition", color: "text-purple-500" },
              { type: "merge" as const, icon: MergeIcon, label: "Merge", desc: "Combine multiple inputs into a single output", color: "text-sky-500" },
            ]).map((item, i) => (
              <Button
                key={item.type}
                variant="outline"
                className="justify-start gap-2 h-12"
                onClick={() => {
                  if (!pendingLogicAction) return;
                  addNode(item.type, pendingLogicAction.x, pendingLogicAction.y, {
                    label: item.label,
                    snippet: item.desc,
                    ...(item.type === "gate" ? { gateOpen: true } : {}),
                  });
                  setPendingLogicAction(null);
                }}
              >
                <span className="text-[9px] font-mono text-muted-foreground/60 w-4 shrink-0">{i + 1}</span>
                <item.icon className={`w-4 h-4 ${item.color}`} />
                <div className="text-left">
                  <div className="text-xs font-medium">{item.label}</div>
                  <div className="text-[10px] text-muted-foreground">{item.desc}</div>
                </div>
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Full-screen Research overlay (tied to specific node) */}
      {activeResearchNodeId &&
        createPortal(
          <div className="fixed inset-0 z-50 flex flex-col bg-background animate-in fade-in duration-200">
            <div className="flex items-center justify-between px-4 py-2 border-b bg-card/80 backdrop-blur-sm shrink-0">
              <h2 className="text-sm font-semibold">
                {activeResearchNode?.researchQuery
                  ? `Research: ${activeResearchNode.researchQuery.slice(0, 50)}${activeResearchNode.researchQuery.length > 50 ? "..." : ""}`
                  : "Research"}
              </h2>
              <p className="text-xs text-muted-foreground">
                Use &quot;Send to Notes&quot; to add findings to your canvas
              </p>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setActiveResearchNodeId(null)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
            <div className="flex-1 overflow-hidden">
              <NotebookResearchChat
                key={activeResearchNodeId}
                objective=""
                onCaptureToContext={handleResearchCapture}
                initialMessages={activeResearchNode?.researchMessages as ChatMessageWithMeta[] | undefined}
                onMessagesChange={handleResearchMessagesChange}
              />
            </div>
          </div>,
          document.body,
        )}

      {/* Full-screen Document editor overlay */}
      {activeDocumentNodeId &&
        createPortal(
          <div className="fixed inset-0 z-50 flex flex-col bg-background animate-in fade-in duration-200">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-2 border-b bg-card/80 backdrop-blur-sm shrink-0">
              <h2 className="text-sm font-semibold">
                {activeDocumentNode?.label || "Document"}
              </h2>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={handleCloseDocumentEditor}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            {/* Body: 1/3 tools + 2/3 editor */}
            <div className="flex-1 flex overflow-hidden">
              {/* Left panel — tools */}
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

                {/* Connected inputs */}
                <div className="p-3 flex-1">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                    Connected Inputs
                  </h3>
                  {(() => {
                    const inputEdges = state.edges.filter((e) => e.toNodeId === activeDocumentNodeId);
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

              {/* Right panel — editor */}
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
          </div>,
          document.body,
        )}

      {/* Full-screen Painter overlay */}
      {activePainterNodeId &&
        createPortal(
          <div className="fixed inset-0 z-50 flex flex-col bg-background animate-in fade-in duration-200">
            <div className="flex items-center justify-between px-4 py-2 border-b bg-card/80 backdrop-blur-sm shrink-0">
              <h2 className="text-sm font-semibold">
                {activePainterNode?.label || "Painter"}
              </h2>
              <p className="text-xs text-muted-foreground">
                Generate images from connected document content or a custom prompt
              </p>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setActivePainterNodeId(null)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
            <div className="flex-1 overflow-hidden">
              <ArtifyPanel
                sourceText={painterSourceText}
                sourceLabel={painterSourceText ? "Connected nodes" : "No inputs"}
                onClose={() => setActivePainterNodeId(null)}
                onImageGenerated={handlePainterImageGenerated}
              />
            </div>
          </div>,
          document.body,
        )}

      {/* Full-screen Image viewer overlay */}
      {activeImageNodeId &&
        (() => {
          const imgNode = state.nodes.find((n) => n.id === activeImageNodeId);
          if (!imgNode?.imageUrl) return null;
          return createPortal(
            <div
              className="fixed inset-0 z-50 flex flex-col bg-background/95 backdrop-blur-sm animate-in fade-in duration-200"
              onClick={() => setActiveImageNodeId(null)}
            >
              <div className="flex items-center justify-between px-4 py-2 border-b bg-card/80 backdrop-blur-sm shrink-0">
                <h2 className="text-sm font-semibold truncate">{imgNode.label || "Image"}</h2>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setActiveImageNodeId(null)}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
              <div className="flex-1 flex items-center justify-center p-4 overflow-auto" onClick={(e) => e.stopPropagation()}>
                <img
                  src={imgNode.imageUrl}
                  alt={imgNode.label || "Image"}
                  className="max-w-full max-h-full object-contain rounded-lg shadow-xl"
                  draggable={false}
                />
              </div>
            </div>,
            document.body,
          );
        })()}

      {/* Connections dialog */}
      <Dialog open={connectionsDialogOpen} onOpenChange={setConnectionsDialogOpen}>
        <DialogContent className="max-w-md max-h-[70vh] flex flex-col p-0">
          <DialogTitle className="sr-only">Connections</DialogTitle>
          <ConnectionsManager onBack={() => setConnectionsDialogOpen(false)} />
        </DialogContent>
      </Dialog>

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
  return (
    <FtuxShellProvider initialConfig={FLOW_SHELL_CONFIG} onConfigChange={() => {}}>
      <FlowWorkspaceInner />
    </FtuxShellProvider>
  );
}
