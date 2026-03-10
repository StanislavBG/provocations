/**
 * FlowExpandedOverlay — Animated FLIP expansion from compact card to full view.
 *
 * Replaces the 7 individual overlay states in FlowWorkspace with a single
 * unified overlay system. Provides consistent chrome (header, close button,
 * chain nav) and animated expand/collapse transitions.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { X, Save, FolderOpen, ChevronRight, Loader2, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useFtuxShell } from "@/lib/ftux-shell-context";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { FlowNode, FlowEdge } from "./useFlowCanvas";
import { FLOW_NODE_REGISTRY, ACCENT_BG } from "./FlowNodeRegistry";
import { FlowChainNavBar } from "./FlowChainNavBar";

// ── Types ──

type AnimationPhase = "expanding" | "open" | "collapsing" | "closed";

export interface FlowExpandedOverlayProps {
  nodeId: string;
  node: FlowNode;

  /** Source rect for FLIP animation. null = instant open (e.g., chain nav). */
  sourceRect: DOMRect | null;

  /** All canvas state for chain nav */
  nodes: FlowNode[];
  edges: FlowEdge[];

  /** Callbacks */
  onClose: () => void;
  onNavigate: (nodeId: string) => void;
  onUpdateNode: (nodeId: string, patch: Partial<FlowNode>) => void;

  /** The expanded view content */
  children: React.ReactNode;
}

// ── Animation config ──

const EXPAND_DURATION = 300;
const COLLAPSE_DURATION = 250;
const EXPAND_EASING = "cubic-bezier(0.16, 1, 0.3, 1)";
const COLLAPSE_EASING = "cubic-bezier(0.7, 0, 0.84, 0)";

// ── Component ──

export function FlowExpandedOverlay({
  nodeId,
  node,
  sourceRect,
  nodes,
  edges,
  onClose,
  onNavigate,
  onUpdateNode,
  children,
}: FlowExpandedOverlayProps) {
  const def = FLOW_NODE_REGISTRY[node.type];
  const style = def.style;
  const Icon = def.icon;
  const accentBg = ACCENT_BG[style.accent] || "bg-primary";
  const { statusBarPosition } = useFtuxShell();
  const sbHeight = "var(--ftux-status-bar-height, 44px)";

  const { toast } = useToast();
  const overlayRef = useRef<HTMLDivElement>(null);
  const renameLabelRef = useRef<HTMLInputElement>(null);
  const [renamingLabel, setRenamingLabel] = useState(false);
  const [editLabel, setEditLabel] = useState("");
  const [phase, setPhase] = useState<AnimationPhase>(
    sourceRect ? "expanding" : "open",
  );
  const [contentVisible, setContentVisible] = useState(!sourceRect);

  // ── Save to Context Store ──
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [saveFolderId, setSaveFolderId] = useState<number | null>(null);
  const [saveTitle, setSaveTitle] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [expandedFolders, setExpandedFolders] = useState<Set<number>>(new Set());

  const { data: foldersRaw } = useQuery({
    queryKey: ["/api/folders"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/folders");
      const data = await res.json();
      return (Array.isArray(data) ? data : data?.folders ?? data?.data ?? []) as Array<{
        id: number;
        name: string;
        parentId?: number | null;
      }>;
    },
    enabled: saveDialogOpen,
  });
  const folders = foldersRaw ?? [];

  const getNodeSaveContent = useCallback((): string => {
    return node.documentContent || node.content || node.snippet || node.llmOutput || "";
  }, [node]);

  const handleOpenSaveDialog = useCallback(() => {
    const content = getNodeSaveContent();
    if (!content.trim()) {
      toast({ title: "Nothing to save", description: "This node has no content." });
      return;
    }
    setSaveTitle(node.label || style.badge || "Untitled");
    setSaveFolderId(null);
    setSaveDialogOpen(true);
  }, [getNodeSaveContent, node.label, style.badge, toast]);

  const handleSaveToStore = useCallback(async () => {
    const content = getNodeSaveContent();
    if (!content.trim()) return;

    setIsSaving(true);
    try {
      await apiRequest("POST", "/api/documents", {
        title: saveTitle || node.label || "Untitled",
        content,
        folderId: saveFolderId,
        docType: "document",
      });
      toast({ title: "Saved to Context Store", description: saveTitle });
      setSaveDialogOpen(false);
    } catch {
      toast({ title: "Save failed", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  }, [getNodeSaveContent, saveTitle, saveFolderId, node.label, toast]);

  // ── Expand animation ──
  useEffect(() => {
    if (phase !== "expanding" || !sourceRect) return;

    const el = overlayRef.current;
    if (!el) {
      setPhase("open");
      setContentVisible(true);
      return;
    }

    // Start from source rect position
    el.style.left = `${sourceRect.left}px`;
    el.style.top = `${sourceRect.top}px`;
    el.style.width = `${sourceRect.width}px`;
    el.style.height = `${sourceRect.height}px`;
    el.style.borderRadius = "8px";
    el.style.opacity = "0.9";

    // Force layout
    el.getBoundingClientRect();

    // Animate to full viewport (respecting status bar)
    el.style.transition = `left ${EXPAND_DURATION}ms ${EXPAND_EASING}, top ${EXPAND_DURATION}ms ${EXPAND_EASING}, width ${EXPAND_DURATION}ms ${EXPAND_EASING}, height ${EXPAND_DURATION}ms ${EXPAND_EASING}, bottom ${EXPAND_DURATION}ms ${EXPAND_EASING}, border-radius ${EXPAND_DURATION}ms ${EXPAND_EASING}, opacity ${EXPAND_DURATION * 0.5}ms ease-out`;
    el.style.left = "0px";
    el.style.width = "100%";
    el.style.borderRadius = "0px";
    el.style.opacity = "1";
    // Let CSS handle top/bottom via the style prop (status bar aware)

    const timer = setTimeout(() => {
      // Clear inline animation styles, let CSS classes take over
      el.style.transition = "";
      el.style.left = "";
      el.style.width = "";
      el.style.borderRadius = "";
      el.style.opacity = "";
      setPhase("open");
      setContentVisible(true);
    }, EXPAND_DURATION);

    return () => clearTimeout(timer);
  }, [phase, sourceRect]);

  // ── Collapse animation ──
  const handleClose = useCallback(() => {
    if (phase === "collapsing" || phase === "closed") return;

    if (!sourceRect) {
      // No source rect → instant close
      setPhase("closed");
      onClose();
      return;
    }

    const el = overlayRef.current;
    if (!el) {
      setPhase("closed");
      onClose();
      return;
    }

    setPhase("collapsing");
    setContentVisible(false);

    // Animate back to source rect
    el.style.transition = `left ${COLLAPSE_DURATION}ms ${COLLAPSE_EASING}, top ${COLLAPSE_DURATION}ms ${COLLAPSE_EASING}, width ${COLLAPSE_DURATION}ms ${COLLAPSE_EASING}, height ${COLLAPSE_DURATION}ms ${COLLAPSE_EASING}, border-radius ${COLLAPSE_DURATION}ms ${COLLAPSE_EASING}, opacity ${COLLAPSE_DURATION}ms ${COLLAPSE_EASING}`;
    el.style.left = `${sourceRect.left}px`;
    el.style.top = `${sourceRect.top}px`;
    el.style.width = `${sourceRect.width}px`;
    el.style.height = `${sourceRect.height}px`;
    el.style.borderRadius = "8px";
    el.style.opacity = "0";

    setTimeout(() => {
      setPhase("closed");
      onClose();
    }, COLLAPSE_DURATION);
  }, [phase, sourceRect, onClose]);

  // ── Escape key to close ──
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        handleClose();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleClose]);

  if (phase === "closed") return null;

  return (
    <>
      {/* Full-screen overlay */}
      <div
        ref={overlayRef}
        role="dialog"
        aria-label={`${node.type} expanded view: ${node.label}`}
        className={cn(
          "fixed inset-0 z-[45] flex flex-col bg-background overflow-hidden",
          phase === "expanding" && "will-change-[left,top,width,height,opacity]",
        )}
        style={{
          ...(phase === "expanding" ? { position: "fixed" as const } : {}),
          top: statusBarPosition === "top" ? sbHeight : "0px",
          bottom: statusBarPosition === "bottom" ? sbHeight : "0px",
        }}
        onWheel={(e) => e.stopPropagation()}
      >
        {/* Accent header bar */}
        <div
          className={cn(
            "flex items-center gap-2 px-4 py-2 text-white shrink-0 transition-opacity",
            accentBg,
            contentVisible ? "opacity-100" : "opacity-0",
          )}
        >
          <Icon className="w-4 h-4" />
          {renamingLabel ? (
            <input
              ref={renameLabelRef}
              className="text-sm font-semibold flex-1 bg-white/20 border border-white/40 rounded px-1.5 py-0 h-6 text-white outline-none placeholder:text-white/50"
              value={editLabel}
              onChange={(e) => setEditLabel(e.target.value)}
              autoFocus
              onBlur={() => {
                const val = editLabel.trim();
                if (val && val !== node.label) {
                  onUpdateNode(node.id, { label: val });
                }
                setRenamingLabel(false);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  const val = editLabel.trim();
                  if (val && val !== node.label) {
                    onUpdateNode(node.id, { label: val });
                  }
                  setRenamingLabel(false);
                  e.stopPropagation();
                }
                if (e.key === "Escape") {
                  setRenamingLabel(false);
                  e.stopPropagation();
                  e.preventDefault();
                }
              }}
            />
          ) : (
            <h2
              className="text-sm font-semibold truncate flex-1 cursor-pointer hover:underline decoration-white/40"
              onDoubleClick={() => {
                setEditLabel(node.label || style.badge);
                setRenamingLabel(true);
              }}
              title="Double-click to rename"
            >
              {node.label || style.badge}
            </h2>
          )}
          {/* Portal target for expanded view header actions (e.g. Run button) */}
          <div id="expanded-header-actions" className="flex items-center gap-2" />
          <span className="text-[10px] uppercase tracking-wider opacity-75 font-semibold">
            {style.badge}
          </span>
          <button
            className="text-[10px] font-mono opacity-50 hover:opacity-90 transition-opacity cursor-pointer bg-transparent border-none text-white px-1 py-0.5 rounded hover:bg-white/10"
            onClick={() => {
              navigator.clipboard.writeText(nodeId);
              toast({ title: "Node ID copied", description: nodeId });
            }}
            title={`Node ID: ${nodeId} — click to copy`}
          >
            {nodeId.length > 8 ? `${nodeId.slice(0, 8)}…` : nodeId}
          </button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-white/80 hover:text-white hover:bg-white/20"
            onClick={handleOpenSaveDialog}
            title="Save to Context Store"
          >
            <Save className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-white/80 hover:text-white hover:bg-white/20"
            onClick={handleClose}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Content area — flex-col + overflow-hidden so children with flex-1
            get a bounded height and their internal ScrollAreas work correctly */}
        <div
          className={cn(
            "flex-1 flex flex-col overflow-hidden transition-opacity",
            contentVisible ? "opacity-100" : "opacity-0",
          )}
        >
          {contentVisible && children}
        </div>
      </div>

      {/* Chain nav bar — rendered above the overlay */}
      {contentVisible && (
        <FlowChainNavBar
          activeNodeId={nodeId}
          nodes={nodes}
          edges={edges}
          onNavigate={onNavigate}
        />
      )}

      {/* Save to Context Store dialog */}
      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Save className="w-4 h-4" />
              Save to Context Store
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            {/* Document title */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Title</label>
              <input
                className="w-full px-3 py-2 rounded-md border border-border bg-muted/30 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50"
                value={saveTitle}
                onChange={(e) => setSaveTitle(e.target.value)}
                autoFocus
              />
            </div>

            {/* Folder picker */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1.5">
                <FolderOpen className="w-3 h-3" />
                Destination Folder
              </label>
              <div className="max-h-[200px] overflow-auto rounded-md border border-border bg-card p-1.5">
                <button
                  className={cn(
                    "w-full text-left text-xs px-2 py-1.5 rounded hover:bg-muted/50 flex items-center gap-1.5",
                    saveFolderId === null && "bg-primary/10 text-primary font-medium",
                  )}
                  onClick={() => setSaveFolderId(null)}
                >
                  <FolderOpen className="w-3 h-3" />
                  Root (no folder)
                </button>
                {folders
                  .filter((f) => !f.parentId)
                  .map((f) => renderFolderItem(f, 0))}
              </div>
            </div>

            {/* Save button */}
            <Button
              className="w-full"
              onClick={handleSaveToStore}
              disabled={isSaving || !saveTitle.trim()}
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  Save
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );

  function renderFolderItem(folder: { id: number; name: string; parentId?: number | null }, depth: number): React.ReactNode {
    const children = folders.filter((f) => f.parentId === folder.id);
    const isExpanded = expandedFolders.has(folder.id);
    const isSelected = saveFolderId === folder.id;

    return (
      <div key={folder.id}>
        <button
          className={cn(
            "w-full text-left text-xs px-2 py-1.5 rounded hover:bg-muted/50 flex items-center gap-1",
            isSelected && "bg-primary/10 text-primary font-medium",
          )}
          style={{ paddingLeft: `${8 + depth * 14}px` }}
          onClick={() => setSaveFolderId(folder.id)}
        >
          {children.length > 0 && (
            <ChevronRight
              className={cn("w-3 h-3 transition-transform shrink-0", isExpanded && "rotate-90")}
              onClick={(e) => {
                e.stopPropagation();
                setExpandedFolders((prev) => {
                  const next = new Set(prev);
                  if (next.has(folder.id)) next.delete(folder.id);
                  else next.add(folder.id);
                  return next;
                });
              }}
            />
          )}
          {children.length === 0 && <span className="w-3" />}
          <FolderOpen className="w-3 h-3 shrink-0" />
          <span className="truncate">{folder.name}</span>
        </button>
        {isExpanded && children.map((child) => renderFolderItem(child, depth + 1))}
      </div>
    );
  }
}
