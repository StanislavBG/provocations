import { useState, useRef, useCallback, useMemo } from "react";
import { cn } from "@/lib/utils";
import { useFtuxShell, type DockItem } from "@/lib/ftux-shell-context";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Sparkles,
  FileText,
  Users,
  ClipboardList,
  Wand2,
  Paintbrush,
  BookOpen,
  MessageCircleQuestion,
  BarChart3,
  Clock,
  ListCollapse,
  Brain,
  Settings,
  FileEdit,
  SquareDashedBottom,
  Mic,
  AudioLines,
  Youtube,
  Timer,
  CircuitBoard,
  Type,
  Filter,
  ToggleRight,
  GitBranch,
  Merge as MergeIcon,
  Share2,
  Wifi,
  Bell,
  Upload,
  UserCheck,
  BrainCircuit,
  Layers,
  Pin,
  PinOff,
  type LucideIcon,
} from "lucide-react";
import { FtuxSettingsDialog } from "./FtuxSettingsDialog";
import { AleComponentGateway } from "./AleComponentGateway";

const ICON_MAP: Record<string, LucideIcon> = {
  Sparkles,
  FileText,
  Users,
  ClipboardList,
  Wand2,
  Paintbrush,
  BookOpen,
  MessageCircleQuestion,
  BarChart3,
  Clock,
  ListCollapse,
  Brain,
  FileEdit,
  SquareDashedBottom,
  Mic,
  AudioLines,
  Youtube,
  Timer,
  CircuitBoard,
  Type,
  Filter,
  ToggleRight,
  GitBranch,
  Merge: MergeIcon,
  Share2,
  Wifi,
  Bell,
  Upload,
  UserCheck,
  BrainCircuit,
};

/** Grid: 2 rows x COLS columns. Items fill slots, remaining are empty. */
const COLS = 10;
const ROWS = 2;
const TOTAL_SLOTS = COLS * ROWS;

export function FtuxDock() {
  const shell = useFtuxShell();
  const {
    dockPosition,
    dockItems,
    dockTranslucency,
    dockAutoHide,
    dockColor,
    dockShowLabels,
    dockButtonSize,
    dockSnapped,
    activeTool,
    setActiveTool,
    setDockItems,
    statusBarPinnedItems,
    addStatusBarPinnedItem,
    removeStatusBarPinnedItem,
  } = shell;

  // Button size dimensions — "large" expands when snapped
  const isLargeSnapped = dockButtonSize === "large" && dockSnapped;
  const sizeMap = {
    small: { slot: "w-11", slotH: dockShowLabels ? "h-13" : "h-10", btn: "w-8 h-8", icon: "w-4 h-4", label: "text-[7px]", labelMax: "max-w-[52px]" },
    medium: { slot: "w-14", slotH: dockShowLabels ? "h-16" : "h-12", btn: "w-10 h-10", icon: "w-5 h-5", label: "text-[8px]", labelMax: "max-w-[52px]" },
    large: { slot: isLargeSnapped ? "min-w-[72px]" : "w-18", slotH: dockShowLabels ? "h-20" : "h-16", btn: isLargeSnapped ? "w-14 h-14" : "w-14 h-14", icon: isLargeSnapped ? "w-8 h-8" : "w-6 h-6", label: isLargeSnapped ? "text-[11px] font-medium" : "text-[9px]", labelMax: isLargeSnapped ? "max-w-[80px]" : "max-w-[52px]" },
  };
  const sz = sizeMap[dockButtonSize ?? "medium"];

  const [isVisible, setIsVisible] = useState(!dockAutoHide);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [gatewayOpen, setGatewayOpen] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; toolId: string; label: string } | null>(null);
  // (blueprintMenuOpen state removed — blueprints now in top menu bar)
  const hideTimeout = useRef<ReturnType<typeof setTimeout>>();

  // Grid slots: each slot is a DockItem or null
  // Items fill in order; remaining slots are empty
  const [slots, setSlots] = useState<(DockItem | null)[]>(() => {
    const s: (DockItem | null)[] = new Array(TOTAL_SLOTS).fill(null);
    dockItems.forEach((item, i) => {
      if (i < TOTAL_SLOTS) s[i] = item;
    });
    return s;
  });

  // Sync if dockItems change externally
  useMemo(() => {
    setSlots((prev) => {
      // Check if items have changed
      const prevItems = prev.filter(Boolean).map((i) => i!.toolId).join(",");
      const nextItems = dockItems.map((i) => i.toolId).join(",");
      if (prevItems === nextItems) return prev;
      const s: (DockItem | null)[] = new Array(TOTAL_SLOTS).fill(null);
      dockItems.forEach((item, i) => {
        if (i < TOTAL_SLOTS) s[i] = item;
      });
      return s;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dockItems]);

  // Drag state
  const dragSourceSlot = useRef<number | null>(null);
  const [dragOverSlot, setDragOverSlot] = useState<number | null>(null);

  const handleSlotDragStart = useCallback((slotIndex: number, e: React.DragEvent) => {
    const item = slots[slotIndex];
    if (!item) return;
    dragSourceSlot.current = slotIndex;
    e.dataTransfer.setData("application/x-flow-tool", item.toolId);
    e.dataTransfer.effectAllowed = "copyMove";
    // Show only the icon button as the drag ghost, not the entire slot wrapper
    const button = e.currentTarget.querySelector("button");
    if (button) {
      e.dataTransfer.setDragImage(button, button.offsetWidth / 2, button.offsetHeight / 2);
    }
  }, [slots]);

  const handleSlotDragOver = useCallback((slotIndex: number, e: React.DragEvent) => {
    e.preventDefault();
    setDragOverSlot(slotIndex);
  }, []);

  const handleSlotDrop = useCallback((toSlot: number, e: React.DragEvent) => {
    e.preventDefault();
    const fromSlot = dragSourceSlot.current;
    if (fromSlot === null || fromSlot === toSlot) {
      dragSourceSlot.current = null;
      setDragOverSlot(null);
      return;
    }

    // If dropping on canvas (not on dock), don't rearrange
    // Only rearrange within dock
    setSlots((prev) => {
      const next = [...prev];
      const item = next[fromSlot];
      if (!item) return prev;
      // Move item to target slot, leave source empty
      // If target has an item, swap them
      next[fromSlot] = next[toSlot];
      next[toSlot] = item;
      // Sync back to context (only non-null items in order)
      const ordered = next.filter(Boolean) as DockItem[];
      setDockItems(ordered);
      return next;
    });

    dragSourceSlot.current = null;
    setDragOverSlot(null);
  }, [setDockItems]);

  const handleDragEnd = useCallback(() => {
    dragSourceSlot.current = null;
    setDragOverSlot(null);
  }, []);

  // Auto-hide
  const handleMouseEnter = useCallback(() => {
    if (hideTimeout.current) clearTimeout(hideTimeout.current);
    setIsVisible(true);
  }, []);

  const handleMouseLeave = useCallback(() => {
    if (!dockAutoHide) return;
    hideTimeout.current = setTimeout(() => setIsVisible(false), 800);
  }, [dockAutoHide]);

  const isHorizontal = dockPosition === "top" || dockPosition === "bottom";
  // When vertical (left/right), swap grid axes so items stack in a column
  const gridCols = isHorizontal ? COLS : ROWS;
  const gridRows = isHorizontal ? ROWS : COLS;

  const positionClasses = dockSnapped
    ? {
        bottom: "fixed bottom-0 left-0 right-0 z-40",
        top: "fixed top-[var(--ftux-status-bar-height,44px)] left-0 right-0 z-40",
        left: "fixed left-0 top-0 bottom-0 z-40",
        right: "fixed right-0 top-0 bottom-0 z-40",
      }
    : {
        bottom: "fixed bottom-4 left-1/2 -translate-x-1/2 z-40",
        top: "fixed top-[calc(var(--ftux-status-bar-height,44px)+12px)] left-1/2 -translate-x-1/2 z-40",
        left: "fixed left-4 top-1/2 -translate-y-1/2 z-40",
        right: "fixed right-4 top-1/2 -translate-y-1/2 z-40",
      };

  function hexToRgba(hex: string, alpha: number): string {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  const opacity = dockTranslucency / 100;
  const blur = Math.round((dockTranslucency / 100) * 24);
  const bgColor = dockColor
    ? hexToRgba(dockColor, opacity)
    : `hsl(var(--card) / ${opacity})`;

  return (
    <>
      {/* Hover zone for auto-hide */}
      {dockAutoHide && !isVisible && (
        <div
          className={cn(
            "fixed z-39",
            dockPosition === "bottom" && "bottom-0 left-0 right-0 h-4",
            dockPosition === "top" && "top-[var(--ftux-status-bar-height,44px)] left-0 right-0 h-4",
            dockPosition === "left" && "left-0 top-0 bottom-0 w-4",
            dockPosition === "right" && "right-0 top-0 bottom-0 w-4",
          )}
          onMouseEnter={handleMouseEnter}
        />
      )}

      <div
        className={cn(
          positionClasses[dockPosition],
          "flex gap-1.5 p-2 transition-all duration-300",
          isHorizontal ? "items-center flex-row" : "items-center flex-col",
          dockSnapped && !isLargeSnapped && "justify-center",
          isLargeSnapped && isHorizontal && "px-4",
          isLargeSnapped && !isHorizontal && "py-4",
          !isVisible && dockPosition === "bottom" && "translate-y-full opacity-0",
          !isVisible && dockPosition === "top" && "-translate-y-full opacity-0",
          !isVisible && dockPosition === "left" && "-translate-x-full opacity-0",
          !isVisible && dockPosition === "right" && "translate-x-full opacity-0",
        )}
        style={{
          background: bgColor,
          backdropFilter: `blur(${blur}px)`,
          border: dockSnapped ? "none" : "1px solid hsl(var(--border) / 0.3)",
          borderRadius: dockSnapped ? "0" : "1rem",
          borderTop: dockSnapped && dockPosition === "bottom" ? "1px solid hsl(var(--border) / 0.3)" : undefined,
          borderBottom: dockSnapped && dockPosition === "top" ? "1px solid hsl(var(--border) / 0.3)" : undefined,
          borderRight: dockSnapped && dockPosition === "left" ? "1px solid hsl(var(--border) / 0.3)" : undefined,
          borderLeft: dockSnapped && dockPosition === "right" ? "1px solid hsl(var(--border) / 0.3)" : undefined,
          boxShadow: dockSnapped ? "none" : "0 8px 32px rgba(0,0,0,0.12)",
        }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onContextMenu={(e) => {
          e.preventDefault();
          setSettingsOpen(true);
        }}
      >
        {/* 2-row grid of tool slots */}
        <div
          className={cn("grid", isLargeSnapped ? "gap-1 flex-1" : "gap-0.5")}
          style={{
            gridTemplateColumns: isLargeSnapped ? `repeat(${gridCols}, 1fr)` : `repeat(${gridCols}, auto)`,
            gridTemplateRows: `repeat(${gridRows}, 1fr)`,
          }}
        >
          {slots.map((item, slotIndex) => {
            const isDropTarget = dragOverSlot === slotIndex && dragSourceSlot.current !== slotIndex;

            if (!item) {
              // Empty slot — can receive drops
              return (
                <div
                  key={`empty-${slotIndex}`}
                  className={cn(
                    !isLargeSnapped && sz.slot, "rounded-lg flex items-center justify-center transition-colors",
                    sz.slotH,
                    isDropTarget
                      ? "bg-primary/15 border border-dashed border-primary/40"
                      : "bg-transparent border border-dashed border-border/20",
                  )}
                  onDragOver={(e) => handleSlotDragOver(slotIndex, e)}
                  onDrop={(e) => handleSlotDrop(slotIndex, e)}
                />
              );
            }

            const IconComponent = ICON_MAP[item.icon] || Sparkles;
            const isActive = activeTool === item.toolId;

            return (
              <div
                key={item.toolId}
                className={cn(
                  "relative flex flex-col items-center justify-center rounded-lg transition-all",
                  sz.slot,
                  sz.slotH,
                  isDropTarget && "ring-2 ring-primary/40",
                )}
                draggable
                onDragStart={(e) => handleSlotDragStart(slotIndex, e)}
                onDragOver={(e) => handleSlotDragOver(slotIndex, e)}
                onDrop={(e) => handleSlotDrop(slotIndex, e)}
                onDragEnd={handleDragEnd}
                onContextMenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setContextMenu({ x: e.clientX, y: e.clientY, toolId: item.toolId, label: item.label });
                }}
              >
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={item.label}
                      className={cn(
                        sz.btn, "rounded-lg transition-transform duration-150 hover:scale-110",
                        isActive && "bg-primary/15 text-primary",
                        !isActive && "text-muted-foreground hover:text-foreground",
                      )}
                      onClick={() => setActiveTool(item.toolId)}
                    >
                      <IconComponent className={sz.icon} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side={isHorizontal ? "top" : "right"} className="text-xs max-w-[220px]">
                    <div className="font-medium">
                      <span className="font-mono text-muted-foreground/60 mr-1">{slotIndex + 1}</span>
                      {item.label}
                    </div>
                    {item.description && (
                      <p className="text-muted-foreground mt-0.5 font-normal">{item.description}</p>
                    )}
                  </TooltipContent>
                </Tooltip>

                {/* Label */}
                {dockShowLabels && (
                  <span className={cn(sz.label, "text-muted-foreground/70 leading-none truncate text-center mt-0.5", sz.labelMax)}>
                    {item.label}
                  </span>
                )}

                {/* Shortcut number */}
                <span className="absolute top-0.5 right-1 text-[7px] font-mono text-muted-foreground/30">
                  {slotIndex < 9 ? slotIndex + 1 : ""}
                </span>

                {/* Active indicator */}
                {isActive && (
                  <div className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary" />
                )}
              </div>
            );
          })}
        </div>

        {/* System buttons */}
        <div className={cn(
          "flex gap-0.5 border-border/30",
          isHorizontal ? "flex-col border-l pl-1.5 ml-0.5" : "flex-row border-t pt-1.5 mt-0.5 justify-center",
        )}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Workspace Tools"
                className="w-8 h-8 rounded-lg text-muted-foreground/50 hover:text-muted-foreground"
                onClick={() => setGatewayOpen(true)}
              >
                <Layers className="w-3.5 h-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side={isHorizontal ? "top" : "right"} className="text-xs">
              Workspace Tools
            </TooltipContent>
          </Tooltip>
          {/* Blueprints button removed — now in top menu bar */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Shell settings"
                className="w-8 h-8 rounded-lg text-muted-foreground/50 hover:text-muted-foreground"
                onClick={() => setSettingsOpen(true)}
              >
                <Settings className="w-3.5 h-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side={isHorizontal ? "top" : "right"} className="text-xs">
              Settings
            </TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* Blueprint menu removed — blueprints are now in the top Blueprints menu */}

      {/* Dock item context menu */}
      {contextMenu && (
        <>
          <div className="fixed inset-0 z-50" onClick={() => setContextMenu(null)} />
          <div
            className="fixed z-50 bg-popover border border-border rounded-lg shadow-lg py-1 min-w-[160px] animate-in fade-in zoom-in-95 duration-100"
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            {statusBarPinnedItems.includes(contextMenu.toolId) ? (
              <button
                className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-left hover:bg-muted transition-colors"
                onClick={() => {
                  removeStatusBarPinnedItem(contextMenu.toolId);
                  setContextMenu(null);
                }}
              >
                <PinOff className="w-3.5 h-3.5 text-muted-foreground" />
                Unpin from Status Bar
              </button>
            ) : (
              <button
                className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-left hover:bg-muted transition-colors"
                onClick={() => {
                  addStatusBarPinnedItem(contextMenu.toolId);
                  setContextMenu(null);
                }}
              >
                <Pin className="w-3.5 h-3.5 text-muted-foreground" />
                Pin to Status Bar
              </button>
            )}
          </div>
        </>
      )}

      <AleComponentGateway open={gatewayOpen} onOpenChange={setGatewayOpen} />
      <FtuxSettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </>
  );
}
