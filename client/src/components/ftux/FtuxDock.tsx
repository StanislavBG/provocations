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
};

/** Grid: 2 rows x COLS columns. Items fill slots, remaining are empty. */
const COLS = 6;
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
    activeTool,
    setActiveTool,
    setDockItems,
    statusBarPinnedItems,
    addStatusBarPinnedItem,
    removeStatusBarPinnedItem,
  } = shell;

  const [isVisible, setIsVisible] = useState(!dockAutoHide);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [gatewayOpen, setGatewayOpen] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; toolId: string; label: string } | null>(null);
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

  const positionClasses = {
    bottom: "fixed bottom-4 left-1/2 -translate-x-1/2 z-40",
    top: "fixed top-[calc(var(--ftux-status-bar-height,36px)+12px)] left-1/2 -translate-x-1/2 z-40",
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
            dockPosition === "top" && "top-[var(--ftux-status-bar-height,36px)] left-0 right-0 h-4",
            dockPosition === "left" && "left-0 top-0 bottom-0 w-4",
            dockPosition === "right" && "right-0 top-0 bottom-0 w-4",
          )}
          onMouseEnter={handleMouseEnter}
        />
      )}

      <div
        className={cn(
          positionClasses[dockPosition],
          "flex items-center gap-1.5 p-2 transition-all duration-300",
          !isVisible && dockPosition === "bottom" && "translate-y-full opacity-0",
          !isVisible && dockPosition === "top" && "-translate-y-full opacity-0",
          !isVisible && dockPosition === "left" && "-translate-x-full opacity-0",
          !isVisible && dockPosition === "right" && "translate-x-full opacity-0",
        )}
        style={{
          background: bgColor,
          backdropFilter: `blur(${blur}px)`,
          border: "1px solid hsl(var(--border) / 0.3)",
          borderRadius: "1rem",
          boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
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
          className="grid gap-0.5"
          style={{
            gridTemplateColumns: `repeat(${COLS}, 1fr)`,
            gridTemplateRows: `repeat(${ROWS}, 1fr)`,
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
                    "w-14 rounded-lg flex items-center justify-center transition-colors",
                    dockShowLabels ? "h-16" : "h-12",
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
                  "w-14",
                  dockShowLabels ? "h-16" : "h-12",
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
                        "w-10 h-10 rounded-lg transition-transform duration-150 hover:scale-110",
                        isActive && "bg-primary/15 text-primary",
                        !isActive && "text-muted-foreground hover:text-foreground",
                      )}
                      onClick={() => setActiveTool(item.toolId)}
                    >
                      <IconComponent className="w-5 h-5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side={isHorizontal ? "top" : "right"} className="text-xs">
                    <span className="font-mono text-muted-foreground/60 mr-1">{slotIndex + 1}</span>
                    {item.label}
                  </TooltipContent>
                </Tooltip>

                {/* Label */}
                {dockShowLabels && (
                  <span className="text-[8px] text-muted-foreground/70 leading-none max-w-[52px] truncate text-center mt-0.5">
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
          "flex gap-0.5 border-border/30 pl-1.5 ml-0.5",
          isHorizontal ? "flex-col border-l" : "flex-row border-t pt-1.5 mt-0.5",
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
