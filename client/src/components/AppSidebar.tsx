import { useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  prebuiltTemplates,
  sortTemplatesByUsage,
  STATUS_LABEL_CONFIG,
  type PrebuiltTemplate,
} from "@/lib/prebuiltTemplates";
import {
  Sparkles,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";

interface AppSidebarProps {
  selectedAppId: string | null;
  onSelectApp: (template: PrebuiltTemplate) => void;
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
  usage?: Record<string, number>;
}

export function AppSidebar({
  selectedAppId,
  onSelectApp,
  collapsed = false,
  onCollapsedChange,
  usage = {},
}: AppSidebarProps) {
  const sortedTemplates = useMemo(
    () => sortTemplatesByUsage(prebuiltTemplates, usage),
    [usage],
  );

  const handleSelect = useCallback(
    (template: PrebuiltTemplate) => {
      onSelectApp(template);
    },
    [onSelectApp],
  );

  // Collapsed sidebar — app icons
  if (collapsed) {
    return (
      <div className="h-full flex flex-col bg-card border-r w-12 shrink-0">
        {/* Logo */}
        <div className="flex items-center justify-center py-3 border-b">
          <Sparkles className="w-5 h-5 text-primary" />
        </div>

        {/* Top app icons */}
        <div className="flex flex-col items-center gap-1 py-2">
          {sortedTemplates
            .filter((t) => !t.comingSoon && !t.externalUrl)
            .slice(0, 6)
            .map((template) => {
              const Icon = template.icon;
              const isActive = template.id === selectedAppId;
              return (
                <Tooltip key={template.id}>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => handleSelect(template)}
                      className={`w-8 h-8 rounded-md flex items-center justify-center transition-colors ${
                        isActive
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    <p className="text-xs font-medium">{template.shortLabel}</p>
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

      {/* App list — sorted by usage, comingSoon/external at bottom */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-0.5">
          {sortedTemplates.map((template) => {
            const Icon = template.icon;
            const isActive = template.id === selectedAppId;
            const isComingSoon = !!template.comingSoon;
            const isExternal = !!template.externalUrl;
            return (
              <button
                key={template.id}
                onClick={() => {
                  if (isComingSoon) return;
                  if (isExternal) {
                    window.open(template.externalUrl, "_blank", "noopener,noreferrer");
                    return;
                  }
                  handleSelect(template);
                }}
                disabled={isComingSoon}
                className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-md text-left transition-colors ${
                  isComingSoon
                    ? "opacity-40 cursor-default"
                    : isActive
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
                {isComingSoon && (
                  <span className="text-[9px] uppercase tracking-wider text-primary/70 font-semibold shrink-0">Soon</span>
                )}
                {isExternal && !isComingSoon && (
                  <span className="text-[9px] uppercase tracking-wider text-blue-600 dark:text-blue-400 font-semibold shrink-0">External</span>
                )}
                {!isComingSoon && !isExternal && template.statusLabel && (
                  <span className={`text-[9px] uppercase tracking-wider font-semibold shrink-0 ${STATUS_LABEL_CONFIG[template.statusLabel].className}`}>
                    {STATUS_LABEL_CONFIG[template.statusLabel].text}
                  </span>
                )}
                {isActive && !isComingSoon && !isExternal && !template.statusLabel && (
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
