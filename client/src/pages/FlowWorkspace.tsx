import { useCallback, useRef, useState, useEffect } from "react";
import { createPortal } from "react-dom";
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
import { X, Loader2, Save } from "lucide-react";

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

// ── Inner workspace (needs shell context) ──

function FlowWorkspaceInner() {
  const { activeTool, setActiveTool } = useFtuxShell();
  const { state, addNode, updateNode, moveNode, deleteNode, selectNode, toggleSelectNode, setViewport } =
    useFlowCanvas();
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const [researchOverlayOpen, setResearchOverlayOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // ── Intercept dock clicks ──
  // The dock sets activeTool directly; we watch for changes and act.

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
      // Only add one store node — reuse if already present
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

  // ── Placement helper (for operations that read current state via closure) ──

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

  // ── Save canvas to Context Store ──

  const handleSaveCanvas = useCallback(async () => {
    if (state.nodes.length === 0) {
      toast({ title: "Nothing to save", description: "Canvas is empty" });
      return;
    }
    setIsSaving(true);
    try {
      // Exclude store nodes from saved data (they're UI elements, not content)
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

  return (
    <FtuxShell>
      <FtuxStatusBar templateName="Flow" templateId={null} />

      {/* Save button in status bar area */}
      <div className="absolute top-1 right-14 z-30 flex items-center gap-1.5">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1.5 text-xs"
          onClick={handleSaveCanvas}
          disabled={isSaving || state.nodes.length === 0}
        >
          {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          Save
        </Button>
      </div>

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
        />

        <FtuxDock />
      </div>

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

export default function FlowWorkspace() {
  return (
    <FtuxShellProvider initialConfig={FLOW_SHELL_CONFIG} onConfigChange={() => {}}>
      <FlowWorkspaceInner />
    </FtuxShellProvider>
  );
}
