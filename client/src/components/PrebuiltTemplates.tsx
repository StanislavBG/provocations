import { Button } from "@/components/ui/button";
import {
  PencilLine,
  ClipboardList,
  Rocket,
  Radio,
  GraduationCap,
  BarChart3,
  Clapperboard,
  MonitorPlay,
  Check,
  UserRoundCog,
  DatabaseZap,
  BookOpenCheck,
  Mic,
} from "lucide-react";
import { prebuiltTemplates, type PrebuiltTemplate } from "@/lib/prebuiltTemplates";

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  "pencil-line": PencilLine,
  "clipboard-list": ClipboardList,
  rocket: Rocket,
  radio: Radio,
  "graduation-cap": GraduationCap,
  "bar-chart-3": BarChart3,
  clapperboard: Clapperboard,
  "monitor-play": MonitorPlay,
  "user-round-cog": UserRoundCog,
  "database-zap": DatabaseZap,
  "book-open-check": BookOpenCheck,
  mic: Mic,
};

interface PrebuiltTemplatesProps {
  onSelect: (template: PrebuiltTemplate) => void;
  onDeselect?: () => void;
  activeId?: string | null;
}

export function PrebuiltTemplates({ onSelect, onDeselect, activeId }: PrebuiltTemplatesProps) {
  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        {activeId ? "Selected mode:" : "Quick-start with a preset:"}
      </p>
      <div className="flex flex-wrap gap-2">
        {prebuiltTemplates.map((template) => {
          const Icon = iconMap[template.icon] || PencilLine;
          const isActive = activeId === template.id;

          return (
            <Button
              key={template.id}
              variant={isActive ? "default" : "outline"}
              size="sm"
              className={`gap-1.5 text-xs h-8 ${isActive ? "ring-2 ring-primary/30" : ""}`}
              onClick={() => {
                if (isActive && onDeselect) {
                  onDeselect();
                } else {
                  onSelect(template);
                }
              }}
              title={isActive ? "Click to deselect" : template.description}
            >
              {isActive ? (
                <Check className="w-3.5 h-3.5 shrink-0" />
              ) : (
                <Icon className="w-3.5 h-3.5 text-primary shrink-0" />
              )}
              <span className="truncate">{template.shortLabel}</span>
            </Button>
          );
        })}
      </div>
    </div>
  );
}
