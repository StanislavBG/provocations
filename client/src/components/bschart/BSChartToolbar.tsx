import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import {
  MousePointer2,
  Hand,
  Cable,
  RectangleHorizontal,
  Diamond,
  Type,
  Table2,
  SquareIcon,
  BadgeCheck,
  Undo2,
  Redo2,
  Grid3X3,
  ZoomIn,
  ZoomOut,
  Maximize,
  Copy,
  Trash2,
} from "lucide-react";
import type { BSToolMode } from "./types";

interface BSChartToolbarProps {
  toolMode: BSToolMode;
  onToolModeChange: (mode: BSToolMode) => void;
  onUndo: () => void;
  onRedo: () => void;
  snapToGrid: boolean;
  onToggleSnapToGrid: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomFit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  hasSelection: boolean;
}

interface ToolEntry {
  mode: BSToolMode;
  label: string;
  icon: typeof MousePointer2;
  shortcut?: string;
}

const TOOLS: ToolEntry[] = [
  { mode: "select", label: "Select", icon: MousePointer2, shortcut: "V" },
  { mode: "pan", label: "Pan", icon: Hand, shortcut: "H" },
  { mode: "connect", label: "Connect", icon: Cable, shortcut: "C" },
];

const SHAPES: ToolEntry[] = [
  { mode: "rectangle", label: "Rectangle", icon: RectangleHorizontal, shortcut: "R" },
  { mode: "rounded-rect", label: "Rounded Rect", icon: SquareIcon, shortcut: "U" },
  { mode: "diamond", label: "Diamond", icon: Diamond, shortcut: "D" },
  { mode: "table", label: "Table", icon: Table2, shortcut: "T" },
  { mode: "text", label: "Text", icon: Type, shortcut: "X" },
  { mode: "badge", label: "Badge", icon: BadgeCheck, shortcut: "B" },
];

export function BSChartToolbar({
  toolMode,
  onToolModeChange,
  onUndo,
  onRedo,
  snapToGrid,
  onToggleSnapToGrid,
  onZoomIn,
  onZoomOut,
  onZoomFit,
  onDuplicate,
  onDelete,
  hasSelection,
}: BSChartToolbarProps) {
  return (
    <div className="h-full flex flex-col bg-card border-r overflow-y-auto">
      {/* Tools section */}
      <div className="px-1.5 py-2 space-y-0.5">
        <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground px-1.5">
          Tools
        </span>
        {TOOLS.map((tool) => (
          <Tooltip key={tool.mode}>
            <TooltipTrigger asChild>
              <Button
                variant={toolMode === tool.mode ? "default" : "ghost"}
                size="sm"
                className="w-full justify-start gap-2 h-7 text-xs"
                onClick={() => onToolModeChange(tool.mode)}
              >
                <tool.icon className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{tool.label}</span>
                {tool.shortcut && (
                  <kbd className="ml-auto text-[9px] text-muted-foreground bg-muted rounded px-1">
                    {tool.shortcut}
                  </kbd>
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">{tool.label}</TooltipContent>
          </Tooltip>
        ))}
      </div>

      <Separator />

      {/* Shapes section */}
      <div className="px-1.5 py-2 space-y-0.5">
        <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground px-1.5">
          Shapes
        </span>
        {SHAPES.map((shape) => (
          <Tooltip key={shape.mode}>
            <TooltipTrigger asChild>
              <Button
                variant={toolMode === shape.mode ? "default" : "ghost"}
                size="sm"
                className="w-full justify-start gap-2 h-7 text-xs"
                onClick={() => onToolModeChange(shape.mode)}
              >
                <shape.icon className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{shape.label}</span>
                {shape.shortcut && (
                  <kbd className="ml-auto text-[9px] text-muted-foreground bg-muted rounded px-1">
                    {shape.shortcut}
                  </kbd>
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">{shape.label}</TooltipContent>
          </Tooltip>
        ))}
      </div>

      <Separator />

      {/* Actions section */}
      <div className="px-1.5 py-2 space-y-0.5">
        <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground px-1.5">
          Actions
        </span>

        <div className="flex gap-0.5 px-0.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onUndo}>
                <Undo2 className="w-3.5 h-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">Undo (Ctrl+Z)</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onRedo}>
                <Redo2 className="w-3.5 h-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">Redo (Ctrl+Y)</TooltipContent>
          </Tooltip>
        </div>

        <div className="flex gap-0.5 px-0.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onZoomIn}>
                <ZoomIn className="w-3.5 h-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">Zoom In</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onZoomOut}>
                <ZoomOut className="w-3.5 h-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">Zoom Out</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onZoomFit}>
                <Maximize className="w-3.5 h-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">Zoom to Fit</TooltipContent>
          </Tooltip>
        </div>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={snapToGrid ? "default" : "ghost"}
              size="sm"
              className="w-full justify-start gap-2 h-7 text-xs"
              onClick={onToggleSnapToGrid}
            >
              <Grid3X3 className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">Snap to Grid</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">Toggle grid snapping</TooltipContent>
        </Tooltip>

        {hasSelection && (
          <>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start gap-2 h-7 text-xs"
                  onClick={onDuplicate}
                >
                  <Copy className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">Duplicate</span>
                  <kbd className="ml-auto text-[9px] text-muted-foreground bg-muted rounded px-1">
                    Ctrl+D
                  </kbd>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Duplicate selected</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start gap-2 h-7 text-xs text-destructive hover:text-destructive"
                  onClick={onDelete}
                >
                  <Trash2 className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">Delete</span>
                  <kbd className="ml-auto text-[9px] text-muted-foreground bg-muted rounded px-1">
                    Del
                  </kbd>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Delete selected</TooltipContent>
            </Tooltip>
          </>
        )}
      </div>

    </div>
  );
}
