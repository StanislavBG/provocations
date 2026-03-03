import { useState } from "react";
import { cn } from "@/lib/utils";
import { useFtuxShell, type ToolId, type DockItem } from "@/lib/ftux-shell-context";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Menu,
  Sparkles,
  FileText,
  Users,
  Wand2,
  Paintbrush,
  BookOpen,
  MessageCircleQuestion,
  BarChart3,
  Clock,
  Pin,
  PanelTop,
  Library,
  FlaskConical,
  Hammer,
  type LucideIcon,
} from "lucide-react";

const ICON_MAP: Record<string, LucideIcon> = {
  Sparkles,
  FileText,
  Users,
  Wand2,
  Paintbrush,
  BookOpen,
  MessageCircleQuestion,
  BarChart3,
  Clock,
  Library,
  FlaskConical,
  Hammer,
};

interface MenuCategory {
  label: string;
  icon: LucideIcon;
  items: { toolId: ToolId; label: string; icon: string; description: string }[];
}

const MENU_CATEGORIES: MenuCategory[] = [
  {
    label: "Gather",
    icon: Library,
    items: [
      { toolId: "context", label: "Context Store", icon: "BookOpen", description: "Browse, pin, and manage documents" },
      { toolId: "document", label: "Document Editor", icon: "FileText", description: "Write and edit with staged changes" },
    ],
  },
  {
    label: "Workshop",
    icon: FlaskConical,
    items: [
      { toolId: "research", label: "Research", icon: "Sparkles", description: "AI-powered research chat" },
      { toolId: "interview", label: "Interview", icon: "MessageCircleQuestion", description: "Guided interview questions" },
      { toolId: "provo", label: "Provocations", icon: "Users", description: "Persona discussion threads" },
    ],
  },
  {
    label: "Build",
    icon: Hammer,
    items: [
      { toolId: "writer", label: "Writer", icon: "Wand2", description: "Evolve and refine documents" },
      { toolId: "painter", label: "Painter", icon: "Paintbrush", description: "AI image generation" },
      { toolId: "chart", label: "Chart", icon: "BarChart3", description: "Visual diagram designer" },
      { toolId: "timeline", label: "Timeline", icon: "Clock", description: "Timeline visualization" },
    ],
  },
];

interface FtuxHamburgerMenuProps {
  currentTemplateId: string | null;
  onSelectTemplate: (id: string) => void;
}

export function FtuxHamburgerMenu({ currentTemplateId, onSelectTemplate }: FtuxHamburgerMenuProps) {
  const [open, setOpen] = useState(false);
  const shell = useFtuxShell();

  const handleToolClick = (toolId: ToolId) => {
    shell.setActiveTool(toolId);
    setOpen(false);
  };

  const handlePinToDock = (toolId: ToolId, label: string, icon: string, group?: string) => {
    const item: DockItem = { toolId, label, icon, group: group as DockItem["group"] };
    shell.addDockItem(item);
  };

  const handlePinToStatusBar = (toolId: string) => {
    shell.addStatusBarPinnedItem(toolId);
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Open workspace tools menu"
          className="fixed top-[calc(var(--ftux-status-bar-height,36px)+4px)] left-3 z-30 w-9 h-9 rounded-xl bg-card/75 backdrop-blur-md border border-border/30 shadow-sm hover:bg-card"
        >
          <Menu className="w-4 h-4" />
        </Button>
      </SheetTrigger>

      <SheetContent side="left" className="w-80 p-0 flex flex-col">
        <SheetHeader className="p-4 pb-2 border-b">
          <SheetTitle className="text-sm font-serif">Workspace Tools</SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-3 space-y-4">
          {MENU_CATEGORIES.map((category) => {
            const CategoryIcon = category.icon;
            return (
              <div key={category.label} className="space-y-1">
                <div className="flex items-center gap-2 px-2 py-1.5">
                  <CategoryIcon className="w-3.5 h-3.5 text-primary" />
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                    {category.label}
                  </p>
                </div>
                {category.items.map((item) => {
                  const Icon = ICON_MAP[item.icon] || Sparkles;
                  const isActive = shell.activeTool === item.toolId;
                  const isInDock = shell.dockItems.some((d) => d.toolId === item.toolId);
                  const groupKey = category.label.toLowerCase() as DockItem["group"];

                  return (
                    <div
                      key={item.toolId}
                      className={cn(
                        "group flex items-center gap-3 px-2 py-1.5 rounded-lg cursor-pointer transition-colors",
                        isActive
                          ? "bg-primary/10 text-primary"
                          : "hover:bg-muted/50 text-foreground",
                      )}
                      onClick={() => handleToolClick(item.toolId)}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{item.label}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{item.description}</p>
                      </div>

                      {/* Pin actions (visible on hover) */}
                      <div className="hidden group-hover:flex items-center gap-0.5 shrink-0">
                        {!isInDock && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="w-5 h-5 rounded"
                            onClick={(e) => {
                              e.stopPropagation();
                              handlePinToDock(item.toolId, item.label, item.icon, groupKey);
                            }}
                            title="Pin to Dock"
                          >
                            <Pin className="w-3 h-3" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="w-5 h-5 rounded"
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePinToStatusBar(item.toolId);
                          }}
                          title="Pin to Status Bar"
                        >
                          <PanelTop className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
}
