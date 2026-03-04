import React from "react";
import { cn } from "@/lib/utils";
import type { FlowNode } from "./useFlowCanvas";
import { NODE_PORTS } from "./useFlowCanvas";

interface FlowPortDotsProps {
  node: FlowNode;
  isSelected: boolean;
  onPortMouseDown?: (e: React.MouseEvent, nodeId: string, portType: "input" | "output") => void;
  accentColor?: string;
}

const ACCENT_COLORS: Record<string, { fill: string; border: string }> = {
  amber: { fill: "bg-amber-500", border: "border-amber-500" },
  blue: { fill: "bg-blue-500", border: "border-blue-500" },
  emerald: { fill: "bg-emerald-500", border: "border-emerald-500" },
  violet: { fill: "bg-violet-500", border: "border-violet-500" },
  primary: { fill: "bg-primary", border: "border-primary" },
  rose: { fill: "bg-rose-500", border: "border-rose-500" },
  cyan: { fill: "bg-cyan-500", border: "border-cyan-500" },
  orange: { fill: "bg-orange-500", border: "border-orange-500" },
  indigo: { fill: "bg-indigo-500", border: "border-indigo-500" },
  red: { fill: "bg-red-500", border: "border-red-500" },
};

export const FlowPortDots = React.memo(function FlowPortDots({
  node,
  isSelected,
  onPortMouseDown,
  accentColor = "primary",
}: FlowPortDotsProps) {
  const ports = NODE_PORTS[node.type];
  if (!ports || ports.length === 0) return null;

  const colors = ACCENT_COLORS[accentColor] || ACCENT_COLORS.primary;

  return (
    <>
      {ports.map((port) => {
        const isOutput = port.type === "output";
        const style: React.CSSProperties = {
          top: "50%",
          transform: "translateY(-50%)",
          ...(port.side === "left" ? { left: -5 } : { right: -5 }),
        };

        return (
          <div
            key={`${port.side}-${port.type}`}
            className={cn(
              "absolute w-[10px] h-[10px] rounded-full border-2 transition-all cursor-crosshair z-10",
              isOutput ? colors.fill : "bg-background",
              colors.border,
              isSelected
                ? "opacity-100 scale-100"
                : "opacity-0 scale-75 group-hover:opacity-100 group-hover:scale-100",
            )}
            style={style}
            onMouseDown={(e) => {
              e.stopPropagation();
              onPortMouseDown?.(e, node.id, port.type);
            }}
          />
        );
      })}
    </>
  );
});
