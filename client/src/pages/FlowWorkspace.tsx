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
} from "lucide-react";
import type { ChatMessageWithMeta } from "@shared/schema";

// ── Dock config ──

const FLOW_DOCK_ITEMS: DockItem[] = [
  { toolId: "context", label: "Context", icon: "BookOpen", group: "gather" },
  { toolId: "zone", label: "Zone", icon: "SquareDashedBottom", group: "gather" },
  { toolId: "audio", label: "Capture Audio", icon: "Mic", group: "gather" },
  { toolId: "research", label: "Research", icon: "Sparkles", group: "workshop" },
  { toolId: "interview", label: "Interview", icon: "MessageCircleQuestion", group: "workshop" },
  { toolId: "document", label: "Document", icon: "FileEdit", group: "build" },
  { toolId: "llm", label: "Text Mods", icon: "Brain", group: "build" },
  { toolId: "painter", label: "Painter", icon: "Paintbrush", group: "build" },
  { toolId: "timeline", label: "Timeline", icon: "Clock", group: "build" },
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
    state, addNode, addEdge, updateNode, moveNode, moveNodes, deleteNode, deleteEdge,
    selectNode, toggleSelectNode, setViewport, loadCanvas, resetCanvas,
  } = useFlowCanvas();
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const { user } = useUser();

  const [activeResearchNodeId, setActiveResearchNodeId] = useState<string | null>(null);
  const [activeDocumentNodeId, setActiveDocumentNodeId] = useState<string | null>(null);
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

  // ── Keyboard shortcuts: 1-6 → dock items ──

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input/textarea/contenteditable
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement)?.isContentEditable) return;
      // Don't trigger with modifier keys (except shift for future use)
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      const num = parseInt(e.key, 10);
      if (num >= 1 && num <= 9) {
        const index = num - 1;
        if (index < dockItems.length) {
          setActiveTool(dockItems[index].toolId);
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [dockItems, setActiveTool]);

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

  // ── Intercept dock clicks ──

  const stateRef = useRef(state);
  stateRef.current = state;

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

  useEffect(() => {
    if (activeTool === "context") {
      setActiveTool(null);
      const hasStore = stateRef.current.nodes.some((n) => n.type === "store");
      if (!hasStore) {
        const pos = getCenter();
        addNode("store", pos.x, pos.y, { label: "Context Store" });
      }
    }
    if (activeTool === "research") {
      setActiveTool(null);
      const pos = getCenter();
      addNode("research", pos.x, pos.y, {
        label: "Research",
        snippet: "Double-click to start researching",
      });
    }
    if (activeTool === "llm") {
      setActiveTool(null);
      const pos = getCenter();
      const defaultPreset = getPreset("summarize");
      addNode("llm", pos.x, pos.y, {
        label: "Text Modifications",
        llmPresetId: defaultPreset.id,
        llmObjective: defaultPreset.defaultObjective,
        llmStatus: "idle",
      });
    }
    if (activeTool === "painter") {
      setActiveTool(null);
      const pos = getCenter();
      addNode("painter", pos.x, pos.y, {
        label: "Painter",
        snippet: "Double-click to generate images",
      });
    }
    if (activeTool === "interview") {
      setActiveTool(null);
      const pos = getCenter();
      addNode("interview", pos.x, pos.y, {
        label: "Interview",
        snippet: "Double-click to start interview",
      });
    }
    if (activeTool === "timeline") {
      setActiveTool(null);
      const pos = getCenter();
      addNode("timeline", pos.x, pos.y, {
        label: "Timeline",
        snippet: "Double-click to build a timeline",
      });
    }
    if (activeTool === "document") {
      setActiveTool(null);
      const pos = getCenter();
      addNode("document", pos.x, pos.y, {
        label: "New Document",
        snippet: "Double-click to edit",
        documentContent: "",
      });
    }
    if (activeTool === "zone") {
      setActiveTool(null);
      const pos = getCenter();
      addNode("zone", pos.x, pos.y, {
        label: "Zone",
        zoneLabel: "Zone",
        zoneColor: "gray",
      });
    }
    if (activeTool === "audio") {
      setActiveTool(null);
      const pos = getCenter();
      addNode("audio", pos.x, pos.y, {
        label: "Capture Audio",
        snippet: "Click mic to start recording",
        audioRecording: false,
        audioTranscript: "",
      });
    }
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

  // ── Research overlay: "Send to Notes" → creates note + edge ──

  const handleResearchCapture = useCallback(
    (text: string, label: string) => {
      let noteX: number, noteY: number;
      if (activeResearchNodeId) {
        const researchNode = stateRef.current.nodes.find((n) => n.id === activeResearchNodeId);
        if (researchNode) {
          noteX = researchNode.x + researchNode.width / 2 + 40;
          noteY = researchNode.y + researchNode.height + 60;
        } else {
          const pos = getPlacementCenter();
          noteX = pos.x;
          noteY = pos.y;
        }
      } else {
        const pos = getPlacementCenter();
        noteX = pos.x;
        noteY = pos.y;
      }

      const noteId = addNode("note", noteX, noteY, {
        label: label || "Research finding",
        snippet: text.slice(0, 200),
        content: text,
      });

      if (activeResearchNodeId) {
        addEdge(activeResearchNodeId, noteId);
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
      if (node?.type === "document") {
        setActiveDocumentNodeId(nodeId);
        setDocEditorContent(node.documentContent || "");
      }
    },
    [state.nodes],
  );

  // ── Create note from LLM output ──

  const handleCreateNote = useCallback(
    (content: string, label: string) => {
      const pos = getPlacementCenter();
      addNode("note", pos.x, pos.y, {
        label,
        snippet: content.slice(0, 200),
        content,
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
      if (node.type === "document" || node.type === "context-doc" || node.type === "note") {
        toast({ title: "Already complete", description: "Document nodes are static sources" });
        return;
      }

      if (inputNodes.length === 0) {
        toast({ title: "No inputs connected", description: "Connect document or note nodes first" });
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
    },
    [addNode],
  );

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
          onToggleSelectNode={toggleSelectNode}
          onNodeDoubleClick={handleNodeDoubleClick}
          onViewportChange={setViewport}
          onPickDocument={handlePickDocument}
          onUpdateNode={updateNode}
          onCreateNote={handleCreateNote}
          onCreateEdge={handleCreateEdge}
          onDeleteEdge={deleteEdge}
          onPlayNode={handlePlayNode}
          onDropTool={handleDropTool}
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

      {/* Connections dialog */}
      <Dialog open={connectionsDialogOpen} onOpenChange={setConnectionsDialogOpen}>
        <DialogContent className="max-w-md max-h-[70vh] flex flex-col p-0">
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
