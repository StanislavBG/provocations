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

interface FtuxStatusBarProps {
  templateName: string | null;
  templateId: string | null;
  /** Extra actions rendered before the right-side controls */
  headerActions?: React.ReactNode;
}

export function FtuxStatusBar({ templateName, templateId, headerActions }: FtuxStatusBarProps) {
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
        {templateName && (
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 font-normal">
            {templateName}
          </Badge>
        )}

        {/* Pinned items */}
        {statusBarPinnedItems.length > 0 && (
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
        )}
      </div>

      {/* Center: Breadcrumb stepper (only during active workflow) */}
      <div className="hidden md:flex items-center justify-center flex-1 mx-4">
        {activeWorkflow && <FtuxBreadcrumbStepper />}
      </div>

      {/* Right: Controls */}
      <div className="flex items-center gap-1.5 shrink-0">
        {headerActions}
        <ThemeToggle />
        <PaletteToggle />
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
