import { prebuiltTemplates } from "@/lib/prebuiltTemplates";
import { PersonaAvatarRow } from "./PersonaAvatarRow";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ScrollArea } from "@/components/ui/scroll-area";
import { STATUS_LABEL_CONFIG } from "@/lib/prebuiltTemplates";
import type { ProvocationType } from "@shared/schema";

interface NotebookRightPanelProps {
  activeTemplateId: string | null;
  onSelectTemplate: (id: string) => void;
  activePersonas: Set<ProvocationType>;
  onTogglePersona: (id: ProvocationType) => void;
  /** Whether the workspace has content (for applicability hints) */
  hasDocument: boolean;
  hasObjective: boolean;
}

export function NotebookRightPanel({
  activeTemplateId,
  onSelectTemplate,
  activePersonas,
  onTogglePersona,
  hasDocument,
  hasObjective,
}: NotebookRightPanelProps) {
  // Filter out external/comingSoon apps for the grid
  const availableApps = prebuiltTemplates.filter(
    (t) => !t.comingSoon && !t.externalUrl,
  );

  return (
    <div className="h-full flex flex-col bg-card border-l">
      <ScrollArea className="flex-1">
        {/* App Grid */}
        <div className="p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Applications
            </span>
            <Badge variant="secondary" className="text-[10px] h-4">
              {availableApps.length}
            </Badge>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {availableApps.map((template) => {
              const Icon = template.icon;
              const isActive = activeTemplateId === template.id;
              const isApplicable = hasObjective || hasDocument;

              return (
                <Tooltip key={template.id}>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => onSelectTemplate(template.id)}
                      className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-all text-center
                        ${
                          isActive
                            ? "bg-primary/10 ring-2 ring-primary shadow-sm"
                            : isApplicable
                              ? "hover:bg-muted/50"
                              : "opacity-40 cursor-default"
                        }`}
                      disabled={!isApplicable && !isActive}
                    >
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                          isActive
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                      </div>
                      <span className="text-[10px] leading-tight truncate w-full">
                        {template.shortLabel}
                      </span>
                      {template.statusLabel && (
                        <span
                          className={`text-[8px] ${
                            STATUS_LABEL_CONFIG[template.statusLabel].className
                          }`}
                        >
                          {STATUS_LABEL_CONFIG[template.statusLabel].text}
                        </span>
                      )}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="left" className="max-w-[200px]">
                    <p className="font-semibold text-xs">{template.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {template.subtitle}
                    </p>
                    {!isApplicable && !isActive && (
                      <p className="text-xs text-amber-500 mt-1">
                        Set an objective to enable
                      </p>
                    )}
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        </div>

        {/* Divider */}
        <div className="border-t mx-3" />

        {/* Persona Toggles */}
        <div className="p-3">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-2">
            Active Personas
          </span>
          <PersonaAvatarRow
            activePersonas={activePersonas}
            onToggle={onTogglePersona}
          />
          <p className="text-[10px] text-muted-foreground mt-2">
            {activePersonas.size} of 13 active. Toggle to include/exclude from
            feedback.
          </p>
        </div>
      </ScrollArea>
    </div>
  );
}
