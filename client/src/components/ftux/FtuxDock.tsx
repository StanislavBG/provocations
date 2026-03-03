import { useState, useRef, useCallback, useMemo } from "react";
import { cn } from "@/lib/utils";
import { useFtuxShell, type ToolId, type DockItem, type DockGroup } from "@/lib/ftux-shell-context";
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
  type LucideIcon,
} from "lucide-react";
import { FtuxSettingsDialog } from "./FtuxSettingsDialog";

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
};

const GROUP_LABELS: Record<DockGroup, string> = {
  gather: "Gather",
  workshop: "Workshop",
  build: "Build",
};

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function FtuxDock() {
  const shell = useFtuxShell();
  const {
    dockPosition,
    dockItems,
    dockTranslucency,
    dockAutoHide,
    dockColor,
    dockShowLabels,
    dockShowGroupLabels,
    activeTool,
    setActiveTool,
    reorderDockItems,
  } = shell;

  const [isVisible, setIsVisible] = useState(!dockAutoHide);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const hideTimeout = useRef<ReturnType<typeof setTimeout>>();
  const dragSourceIndex = useRef<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const isHorizontal = dockPosition === "top" || dockPosition === "bottom";

  // Group dock items by their group, preserving order
  const groupedItems = useMemo(() => {
    const groups: { group: DockGroup | null; items: { item: DockItem; originalIndex: number }[] }[] = [];
    let currentGroup: DockGroup | null | undefined = undefined;

    dockItems.forEach((item, index) => {
      const itemGroup = item.group ?? null;
      if (itemGroup !== currentGroup) {
        groups.push({ group: itemGroup, items: [] });
        currentGroup = itemGroup;
      }
      groups[groups.length - 1].items.push({ item, originalIndex: index });
    });

    return groups;
  }, [dockItems]);

  // Auto-hide behavior
  const handleMouseEnter = useCallback(() => {
    if (hideTimeout.current) clearTimeout(hideTimeout.current);
    setIsVisible(true);
  }, []);

  const handleMouseLeave = useCallback(() => {
    if (!dockAutoHide) return;
    hideTimeout.current = setTimeout(() => setIsVisible(false), 2000);
  }, [dockAutoHide]);

  // Drag and drop
  const handleDragStart = useCallback((index: number) => {
    dragSourceIndex.current = index;
  }, []);

  const handleDragOver = useCallback(
    (e: React.DragEvent, index: number) => {
      e.preventDefault();
      setDragOverIndex(index);
    },
    [],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent, toIndex: number) => {
      e.preventDefault();
      if (dragSourceIndex.current !== null && dragSourceIndex.current !== toIndex) {
        reorderDockItems(dragSourceIndex.current, toIndex);
      }
      dragSourceIndex.current = null;
      setDragOverIndex(null);
    },
    [reorderDockItems],
  );

  const handleDragEnd = useCallback(() => {
    dragSourceIndex.current = null;
    setDragOverIndex(null);
  }, []);

  // Position classes
  const positionClasses = {
    bottom: "fixed bottom-4 left-1/2 -translate-x-1/2 z-40",
    top: "fixed top-[calc(var(--ftux-status-bar-height,36px)+12px)] left-1/2 -translate-x-1/2 z-40",
    left: "fixed left-4 top-1/2 -translate-y-1/2 z-40",
    right: "fixed right-4 top-1/2 -translate-y-1/2 z-40",
  };

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
          "flex items-center gap-0.5 p-1.5 transition-all duration-300",
          isHorizontal ? "flex-row" : "flex-col",
          !isVisible && dockPosition === "bottom" && "translate-y-full opacity-0",
          !isVisible && dockPosition === "top" && "-translate-y-full opacity-0",
          !isVisible && dockPosition === "left" && "-translate-x-full opacity-0",
          !isVisible && dockPosition === "right" && "translate-x-full opacity-0",
        )}
        style={{
          background: bgColor,
          backdropFilter: `blur(${blur}px)`,
          border: "1px solid hsl(var(--border) / 0.3)",
          borderRadius: "1.5rem",
          boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
        }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onContextMenu={(e) => {
          e.preventDefault();
          setSettingsOpen(true);
        }}
      >
        {groupedItems.map((group, groupIndex) => (
          <div
            key={`group-${groupIndex}`}
            className={cn(
              "flex items-center",
              isHorizontal ? "flex-row gap-0.5" : "flex-col gap-0.5",
            )}
          >
            {/* Group separator */}
            {groupIndex > 0 && (
              <div
                className={cn(
                  "shrink-0",
                  isHorizontal
                    ? "w-px h-6 mx-1 bg-border/40"
                    : "h-px w-6 my-1 bg-border/40",
                )}
              />
            )}

            {/* Group label */}
            {dockShowGroupLabels && group.group && (
              <span className={cn(
                "text-[8px] uppercase tracking-wider text-muted-foreground/50 font-medium px-1",
                !isHorizontal && "writing-vertical-rl rotate-180",
              )}>
                {GROUP_LABELS[group.group]}
              </span>
            )}

            {/* Items */}
            {group.items.map(({ item, originalIndex }) => {
              const IconComponent = ICON_MAP[item.icon] || Sparkles;
              const isActive = activeTool === item.toolId;
              const showDropIndicator = dragOverIndex === originalIndex && dragSourceIndex.current !== originalIndex;

              return (
                <div
                  key={item.toolId}
                  className={cn(
                    "relative flex items-center",
                    isHorizontal ? "flex-col" : "flex-row",
                    showDropIndicator && isHorizontal && "border-l-2 border-primary pl-0.5",
                    showDropIndicator && !isHorizontal && "border-t-2 border-primary pt-0.5",
                  )}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData("application/x-flow-tool", item.toolId);
                    e.dataTransfer.effectAllowed = "copyMove";
                    handleDragStart(originalIndex);
                  }}
                  onDragOver={(e) => handleDragOver(e, originalIndex)}
                  onDrop={(e) => handleDrop(e, originalIndex)}
                  onDragEnd={handleDragEnd}
                >
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className={cn(
                          "w-12 h-12 rounded-lg transition-transform duration-150 hover:scale-110",
                          isActive && "bg-primary/15 text-primary",
                          !isActive && "text-muted-foreground hover:text-foreground",
                        )}
                        onClick={() => setActiveTool(item.toolId)}
                      >
                        <IconComponent className="w-6 h-6" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side={isHorizontal ? "top" : "right"} className="text-xs">
                      {item.label}
                    </TooltipContent>
                  </Tooltip>

                  {/* Label below icon */}
                  {dockShowLabels && (
                    <span className={cn(
                      "text-[9px] text-muted-foreground/70 leading-none max-w-[56px] truncate text-center",
                      isHorizontal ? "mt-0.5" : "ml-1",
                    )}>
                      {item.label}
                    </span>
                  )}

                  {/* Active indicator dot */}
                  {isActive && (
                    <div
                      className={cn(
                        "absolute rounded-full bg-primary",
                        isHorizontal
                          ? "bottom-0 left-1/2 -translate-x-1/2 w-1 h-1"
                          : "right-0 top-1/2 -translate-y-1/2 w-1 h-1",
                      )}
                    />
                  )}
                </div>
              );
            })}
          </div>
        ))}

        {/* Settings gear at dock edge */}
        <div className={cn(isHorizontal ? "ml-1 border-l border-border/30 pl-1" : "mt-1 border-t border-border/30 pt-1")}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
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

      <FtuxSettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </>
  );
}
