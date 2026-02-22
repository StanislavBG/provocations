import { useState, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  prebuiltTemplates,
  TEMPLATE_CATEGORIES,
  type PrebuiltTemplate,
  type TemplateCategory,
} from "@/lib/prebuiltTemplates";
import {
  Sparkles,
  ChevronLeft,
  ChevronRight,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";

interface AppSidebarProps {
  selectedAppId: string | null;
  onSelectApp: (template: PrebuiltTemplate) => void;
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
}

export function AppSidebar({
  selectedAppId,
  onSelectApp,
  collapsed = false,
  onCollapsedChange,
}: AppSidebarProps) {
  const [activeCategory, setActiveCategory] = useState<TemplateCategory>("build");

  const templatesByCategory = useMemo(() => {
    const map = new Map<TemplateCategory, PrebuiltTemplate[]>();
    for (const cat of TEMPLATE_CATEGORIES) {
      map.set(cat.id, prebuiltTemplates.filter((t) => t.category === cat.id));
    }
    return map;
  }, []);

  const handleSelect = useCallback(
    (template: PrebuiltTemplate) => {
      onSelectApp(template);
    },
    [onSelectApp],
  );

  // Collapsed sidebar — just icons
  if (collapsed) {
    return (
      <div className="h-full flex flex-col bg-card border-r w-12 shrink-0">
        {/* Logo */}
        <div className="flex items-center justify-center py-3 border-b">
          <Sparkles className="w-5 h-5 text-primary" />
        </div>

        {/* Category icons as vertical tabs */}
        <div className="flex flex-col items-center gap-1 py-2">
          {TEMPLATE_CATEGORIES.map((cat) => {
            const catTemplates = templatesByCategory.get(cat.id) ?? [];
            const hasSelected = catTemplates.some((t) => t.id === selectedAppId);
            return (
              <Tooltip key={cat.id}>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => {
                      setActiveCategory(cat.id);
                      onCollapsedChange?.(false);
                    }}
                    className={`w-8 h-8 rounded-md flex items-center justify-center text-xs font-bold transition-colors ${
                      hasSelected
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    {cat.label[0]}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">
                  <p className="text-xs font-medium">{cat.label}</p>
                  <p className="text-xs text-muted-foreground">{cat.description}</p>
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>

        {/* Expand button */}
        <div className="mt-auto flex items-center justify-center py-2 border-t">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => onCollapsedChange?.(false)}
          >
            <PanelLeftOpen className="w-4 h-4" />
          </Button>
        </div>
      </div>
    );
  }

  // Expanded sidebar
  return (
    <div className="h-full flex flex-col bg-card border-r w-56 shrink-0">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-3 border-b">
        <Sparkles className="w-5 h-5 text-primary shrink-0" />
        <span className="font-semibold text-sm flex-1">Provocations</span>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0"
          onClick={() => onCollapsedChange?.(true)}
        >
          <PanelLeftClose className="w-3.5 h-3.5" />
        </Button>
      </div>

      {/* Category tabs */}
      <div className="flex items-center border-b px-1 shrink-0">
        {TEMPLATE_CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id)}
            className={`flex-1 py-2 text-[11px] font-medium text-center transition-colors border-b-2 ${
              activeCategory === cat.id
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* App list */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-0.5">
          {(templatesByCategory.get(activeCategory) ?? []).map((template) => {
            const Icon = template.icon;
            const isActive = template.id === selectedAppId;
            return (
              <button
                key={template.id}
                onClick={() => handleSelect(template)}
                className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-md text-left transition-colors ${
                  isActive
                    ? "bg-primary/10 text-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? "text-primary" : ""}`} />
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-medium truncate ${isActive ? "text-foreground" : ""}`}>
                    {template.shortLabel}
                  </p>
                </div>
                {isActive && (
                  <div className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                )}
              </button>
            );
          })}
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="border-t px-3 py-2">
        <p className="text-[10px] text-muted-foreground text-center">
          {prebuiltTemplates.length} applications
        </p>
      </div>
    </div>
  );
}
