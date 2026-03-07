/**
 * FlowExpandedOverlay — Animated FLIP expansion from compact card to full view.
 *
 * Replaces the 7 individual overlay states in FlowWorkspace with a single
 * unified overlay system. Provides consistent chrome (header, close button,
 * chain nav) and animated expand/collapse transitions.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useFtuxShell } from "@/lib/ftux-shell-context";
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

  const overlayRef = useRef<HTMLDivElement>(null);
  const renameLabelRef = useRef<HTMLInputElement>(null);
  const [renamingLabel, setRenamingLabel] = useState(false);
  const [phase, setPhase] = useState<AnimationPhase>(
    sourceRect ? "expanding" : "open",
  );
  const [contentVisible, setContentVisible] = useState(!sourceRect);

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
              defaultValue={node.label || style.badge}
              autoFocus
              onBlur={(e) => {
                const val = e.target.value.trim();
                if (val && val !== node.label) {
                  onUpdateNode(node.id, { label: val });
                }
                setRenamingLabel(false);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  const val = (e.target as HTMLInputElement).value.trim();
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
              onDoubleClick={() => setRenamingLabel(true)}
              title="Double-click to rename"
            >
              {node.label || style.badge}
            </h2>
          )}
          <span className="text-[10px] uppercase tracking-wider opacity-75 font-semibold">
            {style.badge}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-white/80 hover:text-white hover:bg-white/20"
            onClick={handleClose}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Content area — overflow-hidden so ResizablePanelGroup children
            get a bounded height and their internal ScrollAreas work correctly */}
        <div
          className={cn(
            "flex-1 overflow-hidden transition-opacity",
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
    </>
  );
}
