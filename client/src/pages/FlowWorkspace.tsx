import { useCallback, useRef, useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import { FtuxShellProvider, useFtuxShell } from "@/lib/ftux-shell-context";
import type { FtuxShellConfig, DockItem } from "@/lib/ftux-shell-context";
import { FtuxShell } from "@/components/ftux/FtuxShell";
import { FtuxStatusBar } from "@/components/ftux/FtuxStatusBar";
import { FtuxDock } from "@/components/ftux/FtuxDock";
import { FlowCanvas } from "@/components/flow/FlowCanvas";
import { useFlowCanvas } from "@/components/flow/useFlowCanvas";
import { NotebookResearchChat } from "@/components/notebook/NotebookResearchChat";
import { DEFAULT_SHELL_CONFIG } from "@/lib/ftux-shell-context";
import { getPreset } from "@/components/flow/llm-presets";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { X, Loader2, Save, Maximize, FileText, FolderOpen, FolderInput } from "lucide-react";
import type { ChatMessageWithMeta } from "@shared/schema";

// ── Dock config ──

const FLOW_DOCK_ITEMS: DockItem[] = [
  { toolId: "context", label: "Context", icon: "BookOpen", group: "gather" },
  { toolId: "research", label: "Research", icon: "Sparkles", group: "workshop" },
  { toolId: "interview", label: "Interview", icon: "MessageCircleQuestion", group: "workshop" },
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

// ── Inner workspace (needs shell context) ──

function FlowWorkspaceInner() {
  const { activeTool, setActiveTool } = useFtuxShell();
  const { state, addNode, addEdge, updateNode, moveNode, deleteNode, selectNode, toggleSelectNode, setViewport } =
    useFlowCanvas();
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const [activeResearchNodeId, setActiveResearchNodeId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [pendingContextAction, setPendingContextAction] = useState<{ x: number; y: number; mode?: "load" | "save" } | null>(null);

  // ── Document list for picker ──

  const { data: docsData } = useQuery<{ documents: DocumentListItem[] }>({
    queryKey: ["/api/documents"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/documents");
      return res.json();
    },
    staleTime: 30_000,
    enabled: pendingContextAction?.mode === "load",
  });

  const docs = docsData?.documents ?? [];

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
      // Place note near the research node if possible
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

      // Create edge from research → note
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

  // ── Drop tool from dock onto canvas ──

  const handleDropTool = useCallback(
    (toolId: string, canvasX: number, canvasY: number) => {
      if (toolId === "context") {
        // Show Load/Save choice
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

  // ── Save canvas to Context Store ──

  const handleSaveCanvas = useCallback(async () => {
    if (state.nodes.length === 0) {
      toast({ title: "Nothing to save", description: "Canvas is empty" });
      return;
    }
    setIsSaving(true);
    try {
      const contentNodes = state.nodes.filter((n) => n.type !== "store");
      const canvasData = { nodes: contentNodes, edges: state.edges, viewport: state.viewport };
      const title = `Flow Canvas — ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
      await apiRequest("POST", "/api/documents", {
        title,
        content: JSON.stringify(canvasData),
        docType: "chart",
      });
      toast({ title: "Canvas saved", description: "Saved to Context Store" });
    } catch {
      toast({ title: "Save failed", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  }, [state.nodes, state.edges, state.viewport, toast]);

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

  // ── Header actions for status bar ──

  const headerActions = (
    <div className="flex items-center gap-1 mr-2 border-r border-border/30 pr-2">
      <Button
        variant="ghost"
        size="sm"
        className="h-6 gap-1 text-[10px] px-2"
        onClick={() => window.location.href = "/old"}
      >
        Classic
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="h-6 gap-1 text-[10px] px-2"
        onClick={handleFitToScreen}
        disabled={state.nodes.length === 0}
      >
        <Maximize className="w-3 h-3" />
        Fit
      </Button>
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
    </div>
  );

  // ── Get active research node for overlay ──

  const activeResearchNode = activeResearchNodeId
    ? state.nodes.find((n) => n.id === activeResearchNodeId)
    : null;

  return (
    <FtuxShell>
      <FtuxStatusBar templateName="Flow" templateId={null} headerActions={headerActions} />

      <div ref={canvasContainerRef} className="flex-1 relative overflow-hidden">
        <FlowCanvas
          state={state}
          onMoveNode={moveNode}
          onDeleteNode={deleteNode}
          onSelectNode={selectNode}
          onToggleSelectNode={toggleSelectNode}
          onNodeDoubleClick={handleNodeDoubleClick}
          onViewportChange={setViewport}
          onPickDocument={handlePickDocument}
          onUpdateNode={updateNode}
          onCreateNote={handleCreateNote}
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
