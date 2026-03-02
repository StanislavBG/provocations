import { useState } from "react";
import { cn } from "@/lib/utils";
import { useFtuxShell, type ToolId, type DockItem } from "@/lib/ftux-shell-context";
import { prebuiltTemplates } from "@/lib/prebuiltTemplates";
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
  ClipboardList,
  Wand2,
  Paintbrush,
  BookOpen,
  MessageCircleQuestion,
  BarChart3,
  Clock,
  Pin,
  PanelTop,
  type LucideIcon,
} from "lucide-react";
import { useLocation } from "wouter";

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

interface ToolGroup {
  label: string;
  items: { toolId: ToolId; label: string; icon: string; description: string }[];
}

const TOOL_GROUPS: ToolGroup[] = [
  {
    label: "Research",
    items: [
      { toolId: "research", label: "Research", icon: "Sparkles", description: "AI-powered research chat" },
      { toolId: "interview", label: "Interview", icon: "MessageCircleQuestion", description: "Guided interview questions" },
    ],
  },
  {
    label: "Document",
    items: [
      { toolId: "document", label: "Document Editor", icon: "FileText", description: "Multi-tab document editor" },
      { toolId: "writer", label: "Writer", icon: "Wand2", description: "Evolve and refine documents" },
      { toolId: "notes", label: "Notes", icon: "ClipboardList", description: "Capture and manage notes" },
    ],
  },
  {
    label: "Creative",
    items: [
      { toolId: "painter", label: "Painter", icon: "Paintbrush", description: "AI image generation" },
      { toolId: "chart", label: "Chart", icon: "BarChart3", description: "Visual diagram designer" },
      { toolId: "timeline", label: "Timeline", icon: "Clock", description: "Timeline visualization" },
    ],
  },
  {
    label: "Context",
    items: [
      { toolId: "context", label: "Context Store", icon: "BookOpen", description: "Document library and pinning" },
      { toolId: "provo", label: "Provocations", icon: "Users", description: "Persona discussion threads" },
    ],
  },
];

interface FtuxHamburgerMenuProps {
  currentTemplateId: string | null;
  onSelectTemplate: (id: string) => void;
}

export function FtuxHamburgerMenu({ currentTemplateId, onSelectTemplate }: FtuxHamburgerMenuProps) {
  const [open, setOpen] = useState(false);
  const [, navigate] = useLocation();
  const shell = useFtuxShell();

  const handleToolClick = (toolId: ToolId) => {
    shell.setActiveTool(toolId);
    setOpen(false);
  };

  const handleTemplateSelect = (templateId: string) => {
    onSelectTemplate(templateId);
    navigate(`/ftux/${templateId}`);
    setOpen(false);
  };

  const handlePinToDock = (toolId: ToolId, label: string, icon: string) => {
    const item: DockItem = { toolId, label, icon };
    shell.addDockItem(item);
  };

  const handlePinToStatusBar = (toolId: string) => {
    shell.addStatusBarPinnedItem(toolId);
  };

  // Group templates by category
  const categories = ["build", "write", "analyze", "capture"] as const;
  const templatesByCategory = categories.reduce(
    (acc, cat) => {
      acc[cat] = prebuiltTemplates.filter((t) => t.category === cat);
      return acc;
    },
    {} as Record<string, typeof prebuiltTemplates>,
  );

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="fixed top-[calc(var(--ftux-status-bar-height,36px)+12px)] left-4 z-30 w-9 h-9 rounded-xl bg-card/75 backdrop-blur-md border border-border/30 shadow-sm hover:bg-card"
        >
          <Menu className="w-4 h-4" />
        </Button>
      </SheetTrigger>

      <SheetContent side="left" className="w-80 p-0 flex flex-col">
        <SheetHeader className="p-4 pb-2 border-b">
          <SheetTitle className="text-sm font-serif">Tools & Applications</SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-3 space-y-4">
          {/* Tools section */}
          <div className="space-y-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium px-1">Tools</p>
            {TOOL_GROUPS.map((group) => (
              <div key={group.label} className="space-y-0.5">
                <p className="text-xs text-muted-foreground/70 px-2 py-1">{group.label}</p>
                {group.items.map((item) => {
                  const Icon = ICON_MAP[item.icon] || Sparkles;
                  const isActive = shell.activeTool === item.toolId;
                  const isInDock = shell.dockItems.some((d) => d.toolId === item.toolId);

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
                              handlePinToDock(item.toolId, item.label, item.icon);
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
            ))}
          </div>

          {/* Applications section */}
          <div className="space-y-3 pt-2 border-t">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium px-1">Applications</p>
            {categories.map((cat) => {
              const templates = templatesByCategory[cat];
              if (!templates || templates.length === 0) return null;
              return (
                <div key={cat} className="space-y-0.5">
                  <p className="text-xs text-muted-foreground/70 px-2 py-1 capitalize">{cat}</p>
                  {templates.map((template) => {
                    const isCurrent = currentTemplateId === template.id;
                    return (
                      <div
                        key={template.id}
                        className={cn(
                          "flex items-center gap-3 px-2 py-1.5 rounded-lg cursor-pointer transition-colors",
                          isCurrent
                            ? "bg-primary/10 text-primary"
                            : "hover:bg-muted/50 text-foreground",
                        )}
                        onClick={() => handleTemplateSelect(template.id)}
                      >
                        <template.icon className="w-4 h-4 shrink-0" />
                        <span className="text-xs font-medium truncate">{template.title}</span>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
