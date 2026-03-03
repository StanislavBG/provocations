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
import { X, Loader2, Save, Maximize, FileText } from "lucide-react";

// ── Dock config ──

const FLOW_DOCK_ITEMS: DockItem[] = [
  { toolId: "context", label: "Context Store", icon: "BookOpen", group: "gather" },
  { toolId: "research", label: "Research", icon: "Sparkles", group: "workshop" },
  { toolId: "llm", label: "LLM", icon: "Brain", group: "build" },
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

function FlowWorkspaceInner({ showBetaBanner }: { showBetaBanner?: boolean }) {
  const { activeTool, setActiveTool } = useFtuxShell();
  const { state, addNode, updateNode, moveNode, deleteNode, selectNode, toggleSelectNode, setViewport } =
    useFlowCanvas();
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const [researchOverlayOpen, setResearchOverlayOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [pendingDocPick, setPendingDocPick] = useState<{ x: number; y: number } | null>(null);

  // ── Document list for picker ──

  const { data: docsData } = useQuery<{ documents: DocumentListItem[] }>({
    queryKey: ["/api/documents"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/documents");
      return res.json();
    },
    staleTime: 30_000,
    enabled: pendingDocPick !== null,
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
      setResearchOverlayOpen(true);
    }
    if (activeTool === "llm") {
      setActiveTool(null);
      const pos = getCenter();
      const defaultPreset = getPreset("summarize");
      addNode("llm", pos.x, pos.y, {
        label: "LLM",
        llmPresetId: defaultPreset.id,
        llmObjective: defaultPreset.defaultObjective,
        llmStatus: "idle",
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

  // ── Research overlay: "Send to Notes" → creates note nodes ──

  const handleResearchCapture = useCallback(
    (text: string, label: string) => {
      const pos = getPlacementCenter();
      addNode("note", pos.x, pos.y, {
        label: label || "Research finding",
        snippet: text.slice(0, 200),
        content: text,
      });
    },
    [addNode, getPlacementCenter],
  );

  // ── Double-click node ──

  const handleNodeDoubleClick = useCallback(
    (nodeId: string) => {
      const node = state.nodes.find((n) => n.id === nodeId);
      if (node?.type === "research") {
        setResearchOverlayOpen(true);
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
        // Open doc picker — store drop position
        setPendingDocPick({ x: canvasX, y: canvasY });
        return;
      }
      if (toolId === "research") {
        addNode("research", canvasX, canvasY, {
          label: "Research",
          snippet: "Double-click to start researching",
        });
        setResearchOverlayOpen(true);
        return;
      }
      if (toolId === "llm") {
        const defaultPreset = getPreset("summarize");
        addNode("llm", canvasX, canvasY, {
          label: "LLM",
          llmPresetId: defaultPreset.id,
          llmObjective: defaultPreset.defaultObjective,
          llmStatus: "idle",
        });
        return;
      }
    },
    [addNode],
  );

  // ── Pick document from dialog (after dock drag) ──

  const handleDocPickFromDialog = useCallback(
    async (docId: number, docTitle: string) => {
      if (!pendingDocPick) return;
      try {
        const res = await apiRequest("GET", `/api/documents/${docId}`);
        const data = (await res.json()) as { title: string; content: string };
        addNode("context-doc", pendingDocPick.x, pendingDocPick.y, {
          label: data.title || docTitle,
          documentId: docId,
          snippet: (data.content || "").slice(0, 200),
          content: data.content,
        });
      } catch {
        addNode("context-doc", pendingDocPick.x, pendingDocPick.y, {
          label: docTitle,
          documentId: docId,
          snippet: "",
          content: "",
        });
      }
      setPendingDocPick(null);
    },
    [pendingDocPick, addNode],
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
      const canvasData = { nodes: contentNodes, viewport: state.viewport };
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
  }, [state.nodes, state.viewport, toast]);

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

  return (
    <FtuxShell>
      {/* Beta banner with Save + Fit */}
      {showBetaBanner && (
        <div className="bg-primary/10 border-b border-primary/20 px-4 py-1.5 flex items-center gap-3 text-xs shrink-0 z-50 relative">
          <span className="bg-primary/20 text-primary font-bold px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wider">
            Beta
          </span>
          <span className="text-muted-foreground">
            You&apos;re using the new Flow Canvas.
          </span>
          <a href="/old" className="text-primary hover:underline font-medium">
            Switch to Classic
          </a>
          <div className="ml-auto flex items-center gap-1">
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
        </div>
      )}

      <FtuxStatusBar templateName="Flow" templateId={null} />

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

      {/* Document picker dialog (after dock Context Store drag) */}
      <Dialog open={pendingDocPick !== null} onOpenChange={(open) => !open && setPendingDocPick(null)}>
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

      {/* Full-screen Research overlay */}
      {researchOverlayOpen &&
        createPortal(
          <div className="fixed inset-0 z-50 flex flex-col bg-background animate-in fade-in duration-200">
            <div className="flex items-center justify-between px-4 py-2 border-b bg-card/80 backdrop-blur-sm shrink-0">
              <h2 className="text-sm font-semibold">Research</h2>
              <p className="text-xs text-muted-foreground">
                Use &quot;Send to Notes&quot; to add findings to your canvas
              </p>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setResearchOverlayOpen(false)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
            <div className="flex-1 overflow-hidden">
              <NotebookResearchChat
                objective=""
                onCaptureToContext={handleResearchCapture}
              />
            </div>
          </div>,
          document.body,
        )}
    </FtuxShell>
  );
}

export default function FlowWorkspace({ showBetaBanner }: { showBetaBanner?: boolean } = {}) {
  return (
    <FtuxShellProvider initialConfig={FLOW_SHELL_CONFIG} onConfigChange={() => {}}>
      <FlowWorkspaceInner showBetaBanner={showBetaBanner} />
    </FtuxShellProvider>
  );
}
