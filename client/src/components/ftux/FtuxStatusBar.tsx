import { useState, useRef, useMemo } from "react";
import { UserButton } from "@clerk/clerk-react";
import { ProvoIcon } from "@/components/ProvoIcon";
import { FtuxBreadcrumbStepper } from "./FtuxBreadcrumbStepper";
import { FtuxSettingsDialog } from "./FtuxSettingsDialog";
import { useFtuxShell, type ToolId } from "@/lib/ftux-shell-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Sparkles,
  Loader2,
  Paintbrush,
  ChevronDown,
  FolderOpen,
  Settings,
  Check,
  Sun,
  Moon,
  Activity,
  Palette,
  Users,
  Wifi,
  BookOpen,
  CircuitBoard,
  AudioLines,
  Trash2,
  ScrollText,
  ChevronRight,
  HardDrive,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { FLOW_NODE_REGISTRY } from "@/components/flow/FlowNodeRegistry";
import type { FlowNodeType } from "@/components/flow/useFlowCanvas";
import { CANVAS_STYLES } from "@/lib/canvas-styles";

/**
 * Icons for virtual dock toolIds that don't map to a FlowNodeType in the registry.
 * These are "meta" items (context, logic, audio via AudioLines) whose toolId
 * doesn't match a registry key.
 */
const VIRTUAL_TOOL_ICONS: Record<string, LucideIcon> = {
  context: BookOpen,
  logic: CircuitBoard,
};

/** Look up a tool/node icon from the registry, with fallback for virtual dock items. */
function getToolIcon(toolId: string, dockIconName?: string): React.ElementType {
  // 1. Check registry (covers real node types like "research", "llm", etc.)
  const def = FLOW_NODE_REGISTRY[toolId as FlowNodeType];
  if (def) return def.icon;
  // 2. Check virtual tool map (covers "context", "logic", etc.)
  if (VIRTUAL_TOOL_ICONS[toolId]) return VIRTUAL_TOOL_ICONS[toolId];
  // 3. Fallback
  return Sparkles;
}

/** Look up a tool/node label from the registry. Falls back to the toolId itself. */
function getToolLabel(toolId: string): string {
  const def = FLOW_NODE_REGISTRY[toolId as FlowNodeType];
  return def?.style.badge ?? (toolId.charAt(0).toUpperCase() + toolId.slice(1));
}

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export interface SavedCanvas {
  id: number;
  title: string;
}

interface FtuxStatusBarProps {
  templateName: string | null;
  templateId: string | null;
  /** Extra actions rendered before the right-side controls */
  headerActions?: React.ReactNode;
  /** Number of AI / processing jobs currently running */
  jobCount?: number;
  /** Current canvas theme key */
  canvasTheme?: string;
  /** Callback to change canvas theme */
  onChangeCanvasTheme?: (theme: string) => void;
  /** Current canvas name */
  canvasName?: string;
  /** Callback to rename canvas */
  onRenameCanvas?: (name: string) => void;
  /** Saved canvases for the switcher dropdown */
  savedCanvases?: SavedCanvas[];
  /** Callback to open/switch to a saved canvas */
  onOpenCanvas?: (id: number, title: string) => void;
  /** Callback to delete a saved canvas */
  onDeleteCanvas?: (id: number, title: string) => void;
  /** Whether a canvas is currently loading */
  canvasLoading?: boolean;
  /** Callback to open the Activity Logs overlay */
  onOpenActivityLogs?: () => void;
  /** Callback to open the Connections dialog */
  onOpenConnections?: () => void;
  /** Callback to open the Platform Integrations dialog */
  onOpenIntegrations?: () => void;
  /** Current app version string (shown in gear menu) */
  appVersion?: string;
  /** Callback to open the Release Notes dialog */
  onOpenReleaseNotes?: () => void;
  /** Callback to open the Context Store Manager */
  onOpenContextStore?: () => void;
  /** Slot for the BlueprintsMenu component, rendered before the gear button */
  blueprintsSlot?: React.ReactNode;
}

export function FtuxStatusBar({ templateName, templateId, headerActions, jobCount = 0, canvasTheme, onChangeCanvasTheme, canvasName, onRenameCanvas, savedCanvases, onOpenCanvas, onDeleteCanvas, canvasLoading, onOpenActivityLogs, onOpenConnections, onOpenIntegrations, appVersion, onOpenReleaseNotes, onOpenContextStore, blueprintsSlot }: FtuxStatusBarProps) {
  const [canvasDropdownOpen, setCanvasDropdownOpen] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [gearDropdownOpen, setGearDropdownOpen] = useState(false);
  const [themeExpanded, setThemeExpanded] = useState(false);
  const renameInputRef = useRef<HTMLInputElement>(null);

  const shell = useFtuxShell();
  const {
    statusBarPinnedItems,
    statusBarTranslucency,
    statusBarColor,
    activeWorkflow,
    setActiveTool,
    removeStatusBarPinnedItem,
    dockItems,
  } = shell;

  const GROUP_LABELS: Record<string, string> = {
    gather: "Gather",
    workshop: "Workshop",
    build: "Build",
    other: "Other",
  };

  const pinnedByGroup = useMemo(() => {
    const groups: Record<string, string[]> = {};
    for (const toolId of statusBarPinnedItems ?? []) {
      const dockItem = dockItems.find((d) => d.toolId === toolId);
      const group = dockItem?.group || "other";
      if (!groups[group]) groups[group] = [];
      groups[group].push(toolId);
    }
    return groups;
  }, [statusBarPinnedItems, dockItems]);

  const opacity = (statusBarTranslucency ?? 85) / 100;
  const blur = Math.round(opacity * 24);
  const bgColor = statusBarColor
    ? hexToRgba(statusBarColor, opacity)
    : `hsl(var(--card) / ${opacity})`;

  return (
    <div
      className="relative z-50 flex items-center justify-between px-4 shrink-0 border-b border-border/50"
      style={{
        height: "var(--ftux-status-bar-height, 44px)",
        background: bgColor,
        backdropFilter: `blur(${blur}px)`,
      }}
    >
      {/* Left: Brand + Pinned Items */}
      <div className="flex items-center gap-2 min-w-0">
        <ProvoIcon className="w-4 h-4 text-primary shrink-0" />
        <span className="text-xs font-serif font-bold tracking-tight text-foreground">Provocations</span>
        {/* Canvas name — dropdown to switch, double-click to rename */}
        {onOpenCanvas ? (
          <div className="relative">
            {isRenaming ? (
              <input
                ref={renameInputRef}
                className="text-[10px] bg-muted/50 border border-primary/40 rounded px-1.5 py-0 h-5 font-normal outline-none w-40"
                defaultValue={canvasName || "Untitled Canvas"}
                autoFocus
                onBlur={(e) => {
                  onRenameCanvas?.(e.target.value);
                  setIsRenaming(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    onRenameCanvas?.((e.target as HTMLInputElement).value);
                    setIsRenaming(false);
                  }
                  if (e.key === "Escape") setIsRenaming(false);
                }}
              />
            ) : (
              <button
                className="flex items-center gap-1 text-[10px] px-1.5 py-0 h-5 rounded bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors font-normal"
                onClick={() => setCanvasDropdownOpen((v) => !v)}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  setCanvasDropdownOpen(false);
                  setIsRenaming(true);
                }}
              >
                {canvasLoading ? (
                  <Loader2 className="w-2.5 h-2.5 animate-spin" />
                ) : null}
                <span className="max-w-[160px] truncate">{canvasName || "Untitled Canvas"}</span>
                <ChevronDown className="w-2.5 h-2.5 opacity-50 shrink-0" />
              </button>
            )}

            {/* Canvas switcher dropdown */}
            {canvasDropdownOpen && !isRenaming && (
              <>
                <div className="fixed inset-0 z-50" onClick={() => setCanvasDropdownOpen(false)} />
                <div className="absolute top-full left-0 mt-1 z-50 bg-popover border border-border rounded-lg shadow-lg py-1 min-w-[200px] max-h-[300px] overflow-y-auto animate-in fade-in zoom-in-95 duration-100">
                  {(!savedCanvases || savedCanvases.length === 0) ? (
                    <div className="px-3 py-2 text-[10px] text-muted-foreground">No saved canvases</div>
                  ) : (
                    savedCanvases.map((c) => (
                      <div
                        key={c.id}
                        className="group flex items-center gap-2 w-full px-3 py-1.5 text-xs text-left hover:bg-muted transition-colors"
                      >
                        <button
                          className="flex items-center gap-2 min-w-0 flex-1"
                          onClick={() => {
                            onOpenCanvas(c.id, c.title);
                            setCanvasDropdownOpen(false);
                          }}
                        >
                          <FolderOpen className="w-3 h-3 text-muted-foreground shrink-0" />
                          <span className="truncate">{c.title}</span>
                        </button>
                        {onDeleteCanvas && (
                          <button
                            className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-destructive/20 hover:text-destructive transition-all shrink-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteCanvas(c.id, c.title);
                              setCanvasDropdownOpen(false);
                            }}
                            title="Delete canvas"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </>
            )}
          </div>
        ) : templateName ? (
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 font-normal">
            {templateName}
          </Badge>
        ) : null}

        {/* Job queue counter */}
        {jobCount > 0 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 font-normal gap-1 ml-1 border-primary/40 text-primary">
                <Loader2 className="w-2.5 h-2.5 animate-spin" />
                {jobCount} running
              </Badge>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs z-[60]">
              {jobCount} AI {jobCount === 1 ? "job" : "jobs"} in progress
            </TooltipContent>
          </Tooltip>
        )}

        {/* Pinned items — grouped by dock group */}
        {statusBarPinnedItems.length > 0 && (
          <>
            {/* Mobile: compact count badge */}
            <Badge variant="secondary" className="md:hidden text-[9px] px-1.5 py-0 h-4 font-normal ml-1">
              {statusBarPinnedItems.length} pinned
            </Badge>
            {/* Desktop: grouped pinned item buttons */}
            <div className="hidden md:flex items-center gap-0 ml-2 border-l border-border/30 pl-2">
              {Object.entries(pinnedByGroup).map(([group, toolIds], idx) => (
                <div key={group} className={cn("flex flex-col items-center gap-0", idx > 0 && "ml-1.5 pl-1.5 border-l border-border/30")}>
                  <span className="text-[8px] uppercase tracking-wider text-muted-foreground/50 font-semibold leading-none">
                    {GROUP_LABELS[group] || group}
                  </span>
                  <div className="flex items-center gap-0.5">
                    {toolIds.map((toolId) => {
                      const Icon = getToolIcon(toolId);
                      const label = getToolLabel(toolId);
                      return (
                        <Tooltip key={toolId}>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={`${label} (right-click to unpin)`}
                              className="w-6 h-6 rounded text-muted-foreground hover:text-foreground"
                              onClick={() => setActiveTool(toolId as ToolId)}
                              onContextMenu={(e) => {
                                e.preventDefault();
                                removeStatusBarPinnedItem(toolId);
                              }}
                            >
                              <Icon className="w-3.5 h-3.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="bottom" className="text-xs z-[60]">
                            {label}
                            <span className="text-muted-foreground ml-1">(right-click to unpin)</span>
                          </TooltipContent>
                        </Tooltip>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Center: Breadcrumb stepper (only during active workflow) */}
      <div className="hidden md:flex items-center justify-center flex-1 mx-4">
        {activeWorkflow && <FtuxBreadcrumbStepper />}
      </div>

      {/* Right: Controls */}
      <div className="flex items-center gap-1.5 shrink-0">
        {headerActions}
        {blueprintsSlot}
        <div className="relative">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={cn("w-7 h-7 rounded", gearDropdownOpen ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground")}
                onClick={() => setGearDropdownOpen((v) => !v)}
              >
                <Settings className="w-3.5 h-3.5" />
              </Button>
            </TooltipTrigger>
            {!gearDropdownOpen && (
              <TooltipContent side="bottom" className="text-xs z-[60]">Settings</TooltipContent>
            )}
          </Tooltip>

          {gearDropdownOpen && (
            <>
              <div className="fixed inset-0 z-50" onClick={() => setGearDropdownOpen(false)} />
              <div className="absolute top-full right-0 mt-1 z-50 bg-popover border border-border rounded-lg shadow-lg py-1 min-w-[220px] animate-in fade-in zoom-in-95 duration-100">
                {/* Context Store */}
                {onOpenContextStore && (
                  <button
                    className="flex items-center gap-2.5 w-full px-3 py-1.5 text-left hover:bg-muted transition-colors"
                    onClick={() => {
                      setGearDropdownOpen(false);
                      onOpenContextStore();
                    }}
                  >
                    <HardDrive className="w-3.5 h-3.5 text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium">Context Store</div>
                      <div className="text-[10px] text-muted-foreground">Files, folders, uploads</div>
                    </div>
                  </button>
                )}
                {/* Canvas Style — collapsible theme picker */}
                {onChangeCanvasTheme && (
                  <>
                    <button
                      className="flex items-center gap-2.5 w-full px-3 py-1.5 text-left hover:bg-muted transition-colors"
                      onClick={() => setThemeExpanded((v) => !v)}
                    >
                      <Paintbrush className="w-3.5 h-3.5 text-muted-foreground" />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium">Canvas Style</div>
                        <div className="text-[10px] text-muted-foreground">{CANVAS_STYLES.find((s) => s.key === canvasTheme)?.label ?? "Aurora"}</div>
                      </div>
                      <span
                        className="w-3 h-3 rounded-full border border-border/60 shrink-0"
                        style={{ backgroundColor: CANVAS_STYLES.find((s) => s.key === canvasTheme)?.swatchColor ?? "#1a1040" }}
                      />
                      <ChevronRight className={cn("w-3 h-3 text-muted-foreground/50 transition-transform", themeExpanded && "rotate-90")} />
                    </button>
                    {themeExpanded && (
                      <div className="pl-4 border-l-2 border-primary/20 ml-4 space-y-0.5 py-1">
                        <div className="px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground/60">Dark</div>
                        {CANVAS_STYLES.filter((s) => s.isDark).map((style) => (
                          <button
                            key={style.key}
                            className="flex items-center gap-2 w-full px-2 py-1 text-left hover:bg-muted transition-colors rounded"
                            onClick={() => {
                              onChangeCanvasTheme(style.key);
                            }}
                          >
                            <div
                              className="w-3.5 h-3.5 rounded-full border border-border/60 shrink-0"
                              style={{ background: style.swatchColor }}
                            />
                            <div className="flex-1 min-w-0">
                              <div className="text-[11px] font-medium flex items-center gap-1">
                                {style.label}
                                <Moon className="w-2.5 h-2.5 text-muted-foreground/50" />
                              </div>
                            </div>
                            {canvasTheme === style.key && (
                              <Check className="w-3 h-3 text-primary shrink-0" />
                            )}
                          </button>
                        ))}
                        <div className="px-2 py-0.5 mt-0.5 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground/60 border-t border-border/30">Light</div>
                        {CANVAS_STYLES.filter((s) => !s.isDark).map((style) => (
                          <button
                            key={style.key}
                            className="flex items-center gap-2 w-full px-2 py-1 text-left hover:bg-muted transition-colors rounded"
                            onClick={() => {
                              onChangeCanvasTheme(style.key);
                            }}
                          >
                            <div
                              className="w-3.5 h-3.5 rounded-full border border-border/60 shrink-0"
                              style={{ background: style.swatchColor }}
                            />
                            <div className="flex-1 min-w-0">
                              <div className="text-[11px] font-medium flex items-center gap-1">
                                {style.label}
                                <Sun className="w-2.5 h-2.5 text-muted-foreground/50" />
                              </div>
                            </div>
                            {canvasTheme === style.key && (
                              <Check className="w-3 h-3 text-primary shrink-0" />
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}
                <button
                  className="flex items-center gap-2.5 w-full px-3 py-1.5 text-left hover:bg-muted transition-colors"
                  onClick={() => {
                    setGearDropdownOpen(false);
                    setSettingsOpen(true);
                  }}
                >
                  <Palette className="w-3.5 h-3.5 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium">UX Configuration</div>
                    <div className="text-[10px] text-muted-foreground">Dock, theme, keybinds</div>
                  </div>
                </button>
                <button
                  className="flex items-center gap-2.5 w-full px-3 py-1.5 text-left hover:bg-muted transition-colors"
                  onClick={() => {
                    setGearDropdownOpen(false);
                    onOpenActivityLogs?.();
                  }}
                >
                  <Activity className="w-3.5 h-3.5 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium">Activity Logs</div>
                    <div className="text-[10px] text-muted-foreground">Lifecycle events, debug</div>
                  </div>
                </button>
                {onOpenConnections && (
                  <button
                    className="flex items-center gap-2.5 w-full px-3 py-1.5 text-left hover:bg-muted transition-colors"
                    onClick={() => {
                      setGearDropdownOpen(false);
                      onOpenConnections();
                    }}
                  >
                    <Users className="w-3.5 h-3.5 text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium">Connections</div>
                      <div className="text-[10px] text-muted-foreground">Manage user connections</div>
                    </div>
                  </button>
                )}
                {onOpenIntegrations && (
                  <button
                    className="flex items-center gap-2.5 w-full px-3 py-1.5 text-left hover:bg-muted transition-colors"
                    onClick={() => {
                      setGearDropdownOpen(false);
                      onOpenIntegrations();
                    }}
                  >
                    <Wifi className="w-3.5 h-3.5 text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium">Platform Integrations</div>
                      <div className="text-[10px] text-muted-foreground">External services, APIs</div>
                    </div>
                  </button>
                )}
                {/* Release Notes */}
                {onOpenReleaseNotes && (
                  <button
                    className="flex items-center gap-2.5 w-full px-3 py-1.5 text-left hover:bg-muted transition-colors"
                    onClick={() => {
                      setGearDropdownOpen(false);
                      onOpenReleaseNotes();
                    }}
                  >
                    <ScrollText className="w-3.5 h-3.5 text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium">Release Notes</div>
                      <div className="text-[10px] text-muted-foreground">{appVersion ? `v${appVersion}` : "View changelog"}</div>
                    </div>
                  </button>
                )}
              </div>
            </>
          )}
        </div>
        <UserButton
          appearance={{
            elements: {
              avatarBox: "w-6 h-6",
            },
          }}
        />
      </div>

      <FtuxSettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </div>
  );
}
