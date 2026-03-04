import { useState, useRef } from "react";
import { UserButton } from "@clerk/clerk-react";
import { ProvoIcon } from "@/components/ProvoIcon";
import { ThemeToggle } from "@/components/ThemeToggle";
import { PaletteToggle } from "@/components/PaletteToggle";
import { FtuxBreadcrumbStepper } from "./FtuxBreadcrumbStepper";
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
  FileText,
  Users,
  ClipboardList,
  Wand2,
  Paintbrush,
  BookOpen,
  MessageCircleQuestion,
  BarChart3,
  Clock,
  Loader2,
  Wallpaper,
  ChevronDown,
  FolderOpen,
  type LucideIcon,
} from "lucide-react";

const ICON_MAP: Record<string, LucideIcon> = {
  Sparkles, FileText, Users, ClipboardList, Wand2,
  Paintbrush, BookOpen, MessageCircleQuestion, BarChart3, Clock,
};

const TOOL_LABELS: Record<string, string> = {
  research: "Research",
  document: "Document",
  provo: "Provocations",
  notes: "Notes",
  writer: "Writer",
  painter: "Painter",
  context: "Context Store",
  interview: "Interview",
  chart: "Chart",
  timeline: "Timeline",
};

const TOOL_ICONS: Record<string, string> = {
  research: "Sparkles",
  document: "FileText",
  provo: "Users",
  notes: "ClipboardList",
  writer: "Wand2",
  painter: "Paintbrush",
  context: "BookOpen",
  interview: "MessageCircleQuestion",
  chart: "BarChart3",
  timeline: "Clock",
};

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
  /** Whether background animation is active */
  bgAnimationOn?: boolean;
  /** Toggle background animation */
  onToggleBgAnimation?: () => void;
  /** Current canvas name */
  canvasName?: string;
  /** Callback to rename canvas */
  onRenameCanvas?: (name: string) => void;
  /** Saved canvases for the switcher dropdown */
  savedCanvases?: SavedCanvas[];
  /** Callback to open/switch to a saved canvas */
  onOpenCanvas?: (id: number, title: string) => void;
  /** Whether a canvas is currently loading */
  canvasLoading?: boolean;
}

export function FtuxStatusBar({ templateName, templateId, headerActions, jobCount = 0, bgAnimationOn, onToggleBgAnimation, canvasName, onRenameCanvas, savedCanvases, onOpenCanvas, canvasLoading }: FtuxStatusBarProps) {
  const [canvasDropdownOpen, setCanvasDropdownOpen] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const renameInputRef = useRef<HTMLInputElement>(null);

  const shell = useFtuxShell();
  const {
    statusBarPinnedItems,
    statusBarTranslucency,
    statusBarColor,
    activeWorkflow,
    setActiveTool,
    removeStatusBarPinnedItem,
  } = shell;

  const opacity = (statusBarTranslucency ?? 85) / 100;
  const blur = Math.round(opacity * 24);
  const bgColor = statusBarColor
    ? hexToRgba(statusBarColor, opacity)
    : `hsl(var(--card) / ${opacity})`;

  return (
    <div
      className="flex items-center justify-between px-4 shrink-0 border-b border-border/50"
      style={{
        height: "var(--ftux-status-bar-height, 36px)",
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
                      <button
                        key={c.id}
                        className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-left hover:bg-muted transition-colors"
                        onClick={() => {
                          onOpenCanvas(c.id, c.title);
                          setCanvasDropdownOpen(false);
                        }}
                      >
                        <FolderOpen className="w-3 h-3 text-muted-foreground shrink-0" />
                        <span className="truncate">{c.title}</span>
                      </button>
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
            <TooltipContent side="bottom" className="text-xs">
              {jobCount} AI {jobCount === 1 ? "job" : "jobs"} in progress
            </TooltipContent>
          </Tooltip>
        )}

        {/* Pinned items */}
        {statusBarPinnedItems.length > 0 && (
          <>
            {/* Mobile: compact count badge */}
            <Badge variant="secondary" className="md:hidden text-[9px] px-1.5 py-0 h-4 font-normal ml-1">
              {statusBarPinnedItems.length} pinned
            </Badge>
            {/* Desktop: full pinned item buttons */}
            <div className="hidden md:flex items-center gap-0.5 ml-2 border-l border-border/30 pl-2">
              {statusBarPinnedItems.map((toolId) => {
                const iconName = TOOL_ICONS[toolId];
                const Icon = iconName ? ICON_MAP[iconName] : Sparkles;
                const label = TOOL_LABELS[toolId] ?? toolId;

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
                    <TooltipContent side="bottom" className="text-xs">
                      {label}
                      <span className="text-muted-foreground ml-1">(right-click to unpin)</span>
                    </TooltipContent>
                  </Tooltip>
                );
              })}
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
        {onToggleBgAnimation && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={`w-7 h-7 rounded ${bgAnimationOn ? "text-primary" : "text-muted-foreground/50"}`}
                onClick={onToggleBgAnimation}
              >
                <Wallpaper className="w-3.5 h-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              {bgAnimationOn ? "Turn off background" : "Turn on background"}
            </TooltipContent>
          </Tooltip>
        )}
        <ThemeToggle value={shell.theme} onChange={shell.setTheme} />
        <PaletteToggle value={shell.palette} onChange={shell.setPalette} />
        <UserButton
          appearance={{
            elements: {
              avatarBox: "w-6 h-6",
            },
          }}
        />
      </div>
    </div>
  );
}
