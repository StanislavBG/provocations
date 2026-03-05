/**
 * useNodeResize — Shared resize logic for flow canvas nodes.
 *
 * Extracts the duplicated resize handler from FlowZoneNode / FlowLabelNode
 * into a single reusable hook.
 */

import { useRef, useCallback } from "react";

// ── Types ──

export type ResizeDir = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

export const CURSOR_MAP: Record<ResizeDir, string> = {
  n: "cursor-ns-resize",
  s: "cursor-ns-resize",
  e: "cursor-ew-resize",
  w: "cursor-ew-resize",
  ne: "cursor-nesw-resize",
  nw: "cursor-nwse-resize",
  se: "cursor-nwse-resize",
  sw: "cursor-nesw-resize",
};

// ── Hook ──

interface UseNodeResizeOpts {
  nodeId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  zoom: number;
  minWidth: number;
  minHeight: number;
  onUpdateNode: (nodeId: string, patch: { x?: number; y?: number; width?: number; height?: number }) => void;
}

export function useNodeResize({
  nodeId,
  x,
  y,
  width,
  height,
  zoom,
  minWidth,
  minHeight,
  onUpdateNode,
}: UseNodeResizeOpts) {
  const resizeRef = useRef<{
    dir: ResizeDir;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
    origW: number;
    origH: number;
  } | null>(null);

  const handleResizeMouseDown = useCallback(
    (e: React.MouseEvent, dir: ResizeDir) => {
      e.stopPropagation();
      e.preventDefault();
      resizeRef.current = {
        dir,
        startX: e.clientX,
        startY: e.clientY,
        origX: x,
        origY: y,
        origW: width,
        origH: height,
      };

      const onMove = (ev: MouseEvent) => {
        const r = resizeRef.current;
        if (!r) return;
        const dx = (ev.clientX - r.startX) / zoom;
        const dy = (ev.clientY - r.startY) / zoom;

        let newX = r.origX;
        let newY = r.origY;
        let newW = r.origW;
        let newH = r.origH;

        if (r.dir.includes("e")) {
          newW = Math.max(minWidth, r.origW + dx);
        }
        if (r.dir.includes("w")) {
          const maxDx = r.origW - minWidth;
          const clampedDx = Math.min(dx, maxDx);
          newX = r.origX + clampedDx;
          newW = r.origW - clampedDx;
        }
        if (r.dir.includes("s")) {
          newH = Math.max(minHeight, r.origH + dy);
        }
        if (r.dir === "n" || r.dir === "ne" || r.dir === "nw") {
          const maxDy = r.origH - minHeight;
          const clampedDy = Math.min(dy, maxDy);
          newY = r.origY + clampedDy;
          newH = r.origH - clampedDy;
        }

        onUpdateNode(nodeId, { x: newX, y: newY, width: newW, height: newH });
      };

      const onUp = () => {
        resizeRef.current = null;
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };

      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [nodeId, x, y, width, height, zoom, minWidth, minHeight, onUpdateNode],
  );

  return { handleResizeMouseDown };
}
