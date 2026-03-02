import { useState, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";
import { useFtuxShell, type ToolId, type DockItem } from "@/lib/ftux-shell-context";
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
};

export function FtuxDock() {
  const shell = useFtuxShell();
  const {
    dockPosition,
    dockItems,
    dockTranslucency,
    dockAutoHide,
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
          "flex items-center gap-1 p-1.5 transition-all duration-300",
          isHorizontal ? "flex-row" : "flex-col",
          !isVisible && dockPosition === "bottom" && "translate-y-full opacity-0",
          !isVisible && dockPosition === "top" && "-translate-y-full opacity-0",
          !isVisible && dockPosition === "left" && "-translate-x-full opacity-0",
          !isVisible && dockPosition === "right" && "translate-x-full opacity-0",
        )}
        style={{
          background: `hsl(var(--card) / ${opacity})`,
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
        {dockItems.map((item, index) => {
          const IconComponent = ICON_MAP[item.icon] || Sparkles;
          const isActive = activeTool === item.toolId;
          const showDropIndicator = dragOverIndex === index && dragSourceIndex.current !== index;

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
              onDragStart={() => handleDragStart(index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDrop={(e) => handleDrop(e, index)}
              onDragEnd={handleDragEnd}
            >
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn(
                      "w-10 h-10 rounded-xl transition-transform duration-150 hover:scale-110",
                      isActive && "bg-primary/15 text-primary",
                      !isActive && "text-muted-foreground hover:text-foreground",
                    )}
                    onClick={() => setActiveTool(item.toolId)}
                  >
                    <IconComponent className="w-5 h-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side={isHorizontal ? "top" : "right"} className="text-xs">
                  {item.label}
                </TooltipContent>
              </Tooltip>

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
