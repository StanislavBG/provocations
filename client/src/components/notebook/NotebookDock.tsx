import { useState, useRef, useCallback, useMemo } from "react";
import { useLocation } from "wouter";
import { prebuiltTemplates } from "@/lib/prebuiltTemplates";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Settings, FolderOpen } from "lucide-react";
import type { DockPrefs } from "@/hooks/use-dock-prefs";
import { cn } from "@/lib/utils";

interface NotebookDockProps {
  dockPrefs: DockPrefs;
  onOpenSettings?: () => void;
}

interface DockItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  path: string;
  isExternal?: boolean;
  comingSoon?: boolean;
}

export function NotebookDock({ dockPrefs, onOpenSettings }: NotebookDockProps) {
  const [location, navigate] = useLocation();

  const items = useMemo<DockItem[]>(() => {
    const templateItems: DockItem[] = prebuiltTemplates
      .filter((t) => !t.comingSoon && !t.externalUrl)
      .map((t) => ({
        id: t.id,
        label: t.shortLabel || t.title,
        icon: t.icon,
        path: `/app/${t.id}`,
      }));
    // Add Context Store utility
    templateItems.push({
      id: "store",
      label: "Store",
      icon: FolderOpen,
      path: "/store",
    });
    return templateItems;
  }, []);

  const activeId = useMemo(() => {
    const match = location.match(/^\/app\/([^/]+)/);
    if (match) return match[1];
    if (location === "/store") return "store";
    return null;
  }, [location]);

  if (dockPrefs.dockMode === "hidden") return null;

  const isVertical = dockPrefs.dockPosition === "left" || dockPrefs.dockPosition === "right";

  if (dockPrefs.dockMode === "carousel") {
    return (
      <CarouselDock
        items={items}
        activeId={activeId}
        visibleCount={dockPrefs.dockCarouselWidth}
        isVertical={isVertical}
        position={dockPrefs.dockPosition}
        onNavigate={navigate}
        onOpenSettings={onOpenSettings}
      />
    );
  }

  // Compact mode (default)
  return (
    <CompactDock
      items={items}
      activeId={activeId}
      isVertical={isVertical}
      position={dockPrefs.dockPosition}
      onNavigate={navigate}
      onOpenSettings={onOpenSettings}
    />
  );
}

// ── Compact Dock ──

function CompactDock({
  items,
  activeId,
  isVertical,
  position,
  onNavigate,
  onOpenSettings,
}: {
  items: DockItem[];
  activeId: string | null;
  isVertical: boolean;
  position: string;
  onNavigate: (path: string) => void;
  onOpenSettings?: () => void;
}) {
  const borderClass = position === "top" ? "border-b" : position === "bottom" ? "border-t" : position === "left" ? "border-r" : "border-l";

  return (
    <div
      className={cn(
        "bg-card/80 backdrop-blur-md shrink-0 flex items-center gap-0.5 px-1",
        borderClass,
        isVertical ? "flex-col w-10 py-1" : "h-10",
      )}
    >
      {items.map((item) => (
        <DockIconButton
          key={item.id}
          item={item}
          isActive={item.id === activeId}
          onClick={() => onNavigate(item.path)}
        />
      ))}
      {onOpenSettings && (
        <>
          <div className={cn("flex-1", isVertical ? "min-h-1" : "min-w-1")} />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                onClick={onOpenSettings}
              >
                <Settings className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side={isVertical ? "right" : "top"}>Dock Settings</TooltipContent>
          </Tooltip>
        </>
      )}
    </div>
  );
}

// ── Carousel Dock ──

function CarouselDock({
  items,
  activeId,
  visibleCount,
  isVertical,
  position,
  onNavigate,
  onOpenSettings,
}: {
  items: DockItem[];
  activeId: string | null;
  visibleCount: number;
  isVertical: boolean;
  position: string;
  onNavigate: (path: string) => void;
  onOpenSettings?: () => void;
}) {
  const [scrollIndex, setScrollIndex] = useState(0);
  const maxIndex = Math.max(0, items.length - visibleCount);
  const pageCount = Math.ceil(items.length / visibleCount);
  const currentPage = Math.floor(scrollIndex / visibleCount);

  const canScrollBack = scrollIndex > 0;
  const canScrollForward = scrollIndex < maxIndex;

  const visibleItems = items.slice(scrollIndex, scrollIndex + visibleCount);

  const borderClass = position === "top" ? "border-b" : position === "bottom" ? "border-t" : position === "left" ? "border-r" : "border-l";

  const containerStyle = isVertical
    ? { maxHeight: `${visibleCount * 34 + 56}px` }
    : { maxWidth: `${visibleCount * 34 + 56}px` };

  return (
    <div
      className={cn(
        "bg-card/80 backdrop-blur-md shrink-0 flex items-center justify-center",
        borderClass,
        isVertical ? "w-10" : "h-10",
      )}
    >
      <div
        className={cn("flex items-center gap-0.5", isVertical ? "flex-col py-1" : "px-1")}
        style={containerStyle}
      >
        {/* Back chevron */}
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5 p-0 shrink-0"
          disabled={!canScrollBack}
          onClick={() => setScrollIndex(Math.max(0, scrollIndex - visibleCount))}
        >
          {isVertical ? (
            <ChevronLeft className="w-3 h-3 rotate-90" />
          ) : (
            <ChevronLeft className="w-3 h-3" />
          )}
        </Button>

        {/* Visible items */}
        <div className={cn("flex items-center gap-0.5 transition-all duration-200", isVertical ? "flex-col" : "")}>
          {visibleItems.map((item) => (
            <DockIconButton
              key={item.id}
              item={item}
              isActive={item.id === activeId}
              onClick={() => onNavigate(item.path)}
            />
          ))}
        </div>

        {/* Forward chevron */}
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5 p-0 shrink-0"
          disabled={!canScrollForward}
          onClick={() => setScrollIndex(Math.min(maxIndex, scrollIndex + visibleCount))}
        >
          {isVertical ? (
            <ChevronRight className="w-3 h-3 rotate-90" />
          ) : (
            <ChevronRight className="w-3 h-3" />
          )}
        </Button>

        {onOpenSettings && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5 p-0 text-muted-foreground hover:text-foreground shrink-0"
                onClick={onOpenSettings}
              >
                <Settings className="w-3 h-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side={isVertical ? "right" : "top"}>Dock Settings</TooltipContent>
          </Tooltip>
        )}
      </div>

      {/* Page dots */}
      {pageCount > 1 && (
        <div className={cn("flex gap-1 items-center", isVertical ? "flex-col ml-0.5" : "mt-0.5 absolute bottom-0.5")}>
          {Array.from({ length: pageCount }, (_, i) => (
            <div
              key={i}
              className={cn(
                "rounded-full transition-colors",
                i === currentPage ? "bg-primary w-1.5 h-1.5" : "bg-muted-foreground/30 w-1 h-1",
              )}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Shared Icon Button ──

function DockIconButton({
  item,
  isActive,
  onClick,
}: {
  item: DockItem;
  isActive: boolean;
  onClick: () => void;
}) {
  const Icon = item.icon;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={onClick}
          className={cn(
            "h-7 w-7 flex items-center justify-center rounded-md transition-all duration-150 hover:scale-110 shrink-0",
            isActive
              ? "bg-primary/20 ring-1 ring-primary text-primary"
              : "text-muted-foreground hover:text-foreground hover:bg-accent/50",
          )}
        >
          <Icon className="w-4 h-4" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-xs">
        {item.label}
      </TooltipContent>
    </Tooltip>
  );
}

// ── Absorbed dock items for top bar (hidden mode) ──

export function AbsorbedDockItems({
  onOpenSettings,
}: {
  onOpenSettings?: () => void;
}) {
  const [location, navigate] = useLocation();
  const [showOverflow, setShowOverflow] = useState(false);

  const items = useMemo<DockItem[]>(() => {
    return prebuiltTemplates
      .filter((t) => !t.comingSoon && !t.externalUrl)
      .map((t) => ({
        id: t.id,
        label: t.shortLabel || t.title,
        icon: t.icon,
        path: `/app/${t.id}`,
      }));
  }, []);

  const activeId = useMemo(() => {
    const match = location.match(/^\/app\/([^/]+)/);
    return match ? match[1] : null;
  }, [location]);

  // Show first 8 items, overflow the rest
  const maxVisible = 8;
  const visibleItems = items.slice(0, maxVisible);
  const overflowItems = items.slice(maxVisible);

  return (
    <div className="flex items-center gap-0.5">
      {visibleItems.map((item) => {
        const Icon = item.icon;
        return (
          <Tooltip key={item.id}>
            <TooltipTrigger asChild>
              <button
                onClick={() => navigate(item.path)}
                className={cn(
                  "h-6 w-6 flex items-center justify-center rounded transition-colors",
                  item.id === activeId
                    ? "bg-primary/20 text-primary border-b-2 border-primary"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="w-3.5 h-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent className="text-xs">{item.label}</TooltipContent>
          </Tooltip>
        );
      })}
      {overflowItems.length > 0 && (
        <div className="relative">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => setShowOverflow(!showOverflow)}
                className="h-6 w-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground text-xs font-medium"
              >
                ...
              </button>
            </TooltipTrigger>
            <TooltipContent className="text-xs">More apps</TooltipContent>
          </Tooltip>
          {showOverflow && (
            <div className="absolute top-full left-0 mt-1 bg-popover border rounded-md shadow-lg p-1 z-50 flex flex-col gap-0.5 min-w-[140px]">
              {overflowItems.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      navigate(item.path);
                      setShowOverflow(false);
                    }}
                    className={cn(
                      "flex items-center gap-2 px-2 py-1 rounded text-sm hover:bg-accent",
                      item.id === activeId ? "text-primary" : "text-foreground",
                    )}
                  >
                    <Icon className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
