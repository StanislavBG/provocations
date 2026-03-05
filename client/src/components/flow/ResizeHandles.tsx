/**
 * ResizeHandles — Shared 8-direction resize handles for flow canvas nodes.
 *
 * Renders 4 corner dots + 4 invisible edge hit areas.
 * Shows on hover (via group-hover) and when selected.
 */

import React from "react";
import { cn } from "@/lib/utils";
import type { ResizeDir } from "./useNodeResize";
import { CURSOR_MAP } from "./useNodeResize";

interface ResizeHandlesProps {
  isSelected: boolean;
  onResizeMouseDown: (e: React.MouseEvent, dir: ResizeDir) => void;
  /** "sm" = small handles (labels, compact cards), "md" = larger handles (zones) */
  size?: "sm" | "md";
}

const CORNER_DIRS: ResizeDir[] = ["nw", "ne", "sw", "se"];
const EDGE_DIRS: ResizeDir[] = ["n", "s", "e", "w"];

// Pre-defined position classes to avoid dynamic Tailwind issues

const SM_CORNER: Record<string, string> = {
  nw: "-top-1 -left-1",
  ne: "-top-1 -right-1",
  sw: "-bottom-1 -left-1",
  se: "-bottom-1 -right-1",
};

const MD_CORNER: Record<string, string> = {
  nw: "-top-1.5 -left-1.5",
  ne: "-top-1.5 -right-1.5",
  sw: "-bottom-1.5 -left-1.5",
  se: "-bottom-1.5 -right-1.5",
};

const SM_EDGE: Record<string, string> = {
  n: "top-0 left-2 right-2 h-1 -translate-y-1/2",
  s: "bottom-0 left-2 right-2 h-1 translate-y-1/2",
  e: "right-0 top-2 bottom-2 w-1 translate-x-1/2",
  w: "left-0 top-2 bottom-2 w-1 -translate-x-1/2",
};

const MD_EDGE: Record<string, string> = {
  n: "top-0 left-3 right-3 h-1.5 -translate-y-1/2",
  s: "bottom-0 left-3 right-3 h-1.5 translate-y-1/2",
  e: "right-0 top-3 bottom-3 w-1.5 translate-x-1/2",
  w: "left-0 top-3 bottom-3 w-1.5 -translate-x-1/2",
};

export const ResizeHandles = React.memo(function ResizeHandles({
  isSelected,
  onResizeMouseDown,
  size = "sm",
}: ResizeHandlesProps) {
  const dotSize = size === "md" ? "w-3 h-3" : "w-2.5 h-2.5";
  const cornerPos = size === "md" ? MD_CORNER : SM_CORNER;
  const edgePos = size === "md" ? MD_EDGE : SM_EDGE;

  return (
    <>
      {/* Corner handles */}
      {CORNER_DIRS.map((dir) => (
        <div
          key={dir}
          className={cn(
            "absolute rounded-full border-2 border-primary bg-background opacity-0 group-hover:opacity-100 transition-opacity z-10",
            dotSize,
            isSelected && "opacity-100",
            CURSOR_MAP[dir],
            cornerPos[dir],
          )}
          onMouseDown={(e) => onResizeMouseDown(e, dir)}
        />
      ))}
      {/* Edge handles */}
      {EDGE_DIRS.map((dir) => (
        <div
          key={dir}
          className={cn(
            "absolute opacity-0 group-hover:opacity-100 transition-opacity z-10",
            isSelected && "opacity-100",
            CURSOR_MAP[dir],
            edgePos[dir],
          )}
          onMouseDown={(e) => onResizeMouseDown(e, dir)}
        />
      ))}
    </>
  );
});
