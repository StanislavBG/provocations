import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { useFtuxShell, type ToolId, type DockItem, type DockGroup } from "@/lib/ftux-shell-context";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import {
  Sparkles,
  FileText,
  Users,
  Paintbrush,
  BookOpen,
  MessageCircleQuestion,
  Clock,
  Brain,
  FileEdit,
  SquareDashedBottom,
  BarChart3,
  Wand2,
  ListCollapse,
  type LucideIcon,
} from "lucide-react";

const ICON_MAP: Record<string, LucideIcon> = {
  Sparkles, FileText, Users, Paintbrush, BookOpen,
  MessageCircleQuestion, Clock, Brain, FileEdit,
  SquareDashedBottom, BarChart3, Wand2, ListCollapse,
};

/** Full catalog of available workspace tools */
const ALL_TOOLS: {
  toolId: ToolId;
  label: string;
  icon: string;
  group: DockGroup;
  description: string;
}[] = [
  { toolId: "context", label: "Context Store", icon: "BookOpen", group: "gather", description: "Browse and load documents from your store" },
  { toolId: "zone", label: "Zone", icon: "SquareDashedBottom", group: "gather", description: "Group and organize elements on canvas" },
  { toolId: "research", label: "Research", icon: "Sparkles", group: "workshop", description: "AI-powered research assistant" },
  { toolId: "interview", label: "Interview", icon: "MessageCircleQuestion", group: "workshop", description: "Guided interview to gather requirements" },
  { toolId: "document", label: "Document", icon: "FileEdit", group: "build", description: "Create and groom markdown documents" },
  { toolId: "llm", label: "Text Modifications", icon: "Brain", group: "build", description: "Summarize, expand, refine text with AI" },
  { toolId: "painter", label: "Painter", icon: "Paintbrush", group: "build", description: "Generate images from text descriptions" },
  { toolId: "timeline", label: "Timeline", icon: "Clock", group: "build", description: "Build visual timelines from content" },
  { toolId: "chart", label: "BS Chart", icon: "BarChart3", group: "build", description: "Create flowcharts and diagrams" },
  { toolId: "provo", label: "Provocations", icon: "Users", group: "workshop", description: "Multi-persona challenge discussions" },
  { toolId: "notes", label: "Notes", icon: "ListCollapse", group: "gather", description: "Capture and manage notes" },
  { toolId: "writer", label: "Writer", icon: "Wand2", group: "build", description: "Smart document writing assistant" },
];

const GROUP_META: Record<DockGroup, { label: string; color: string }> = {
  gather: { label: "Gather", color: "text-amber-500" },
  workshop: { label: "Workshop", color: "text-blue-500" },
  build: { label: "Build", color: "text-emerald-500" },
};

interface AleComponentGatewayProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AleComponentGateway({ open, onOpenChange }: AleComponentGatewayProps) {
  const { dockItems, addDockItem, removeDockItem } = useFtuxShell();
  const [filter, setFilter] = useState<DockGroup | "all">("all");

  const dockToolIds = useMemo(
    () => new Set(dockItems.map((d) => d.toolId)),
    [dockItems],
  );

  const filtered = filter === "all"
    ? ALL_TOOLS
    : ALL_TOOLS.filter((t) => t.group === filter);

  const grouped = useMemo(() => {
    const groups: Record<string, typeof ALL_TOOLS> = {};
    for (const tool of filtered) {
      const g = tool.group;
      if (!groups[g]) groups[g] = [];
      groups[g].push(tool);
    }
    return groups;
  }, [filtered]);

  const handleToggle = (tool: typeof ALL_TOOLS[0], enabled: boolean) => {
    if (enabled) {
      addDockItem({ toolId: tool.toolId, label: tool.label, icon: tool.icon, group: tool.group });
    } else {
      removeDockItem(tool.toolId);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[70vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-sm">Workspace Tools</DialogTitle>
          <p className="text-xs text-muted-foreground">
            Toggle tools on/off to customize your dock
          </p>
        </DialogHeader>

        {/* Category filter */}
        <div className="flex gap-1 pb-2 border-b">
          {(["all", "gather", "workshop", "build"] as const).map((g) => (
            <button
              key={g}
              className={cn(
                "text-[10px] font-medium px-2 py-1 rounded-full border transition-colors",
                filter === g
                  ? "bg-primary/15 border-primary text-primary"
                  : "border-border/50 text-muted-foreground hover:bg-muted/50",
              )}
              onClick={() => setFilter(g)}
            >
              {g === "all" ? "All" : GROUP_META[g].label}
            </button>
          ))}
        </div>

        {/* Tool list */}
        <div className="flex-1 overflow-auto -mx-6 px-6 space-y-4 py-2">
          {Object.entries(grouped).map(([group, tools]) => (
            <div key={group}>
              <h3 className={cn("text-[10px] font-semibold uppercase tracking-wider mb-1.5", GROUP_META[group as DockGroup]?.color || "text-muted-foreground")}>
                {GROUP_META[group as DockGroup]?.label || group}
              </h3>
              <div className="space-y-1">
                {tools.map((tool) => {
                  const Icon = ICON_MAP[tool.icon] || Sparkles;
                  const isEnabled = dockToolIds.has(tool.toolId);
                  return (
                    <div
                      key={tool.toolId}
                      className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-muted/30 transition-colors"
                    >
                      <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium">{tool.label}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{tool.description}</p>
                      </div>
                      <Switch
                        checked={isEnabled}
                        onCheckedChange={(checked) => handleToggle(tool, checked)}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
