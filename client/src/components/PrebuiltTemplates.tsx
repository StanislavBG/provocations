import { Button } from "@/components/ui/button";
import {
  PencilLine,
  ClipboardList,
  Rocket,
  Blocks,
  Check,
} from "lucide-react";
import { prebuiltTemplates, type PrebuiltTemplate } from "@/lib/prebuiltTemplates";

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  "pencil-line": PencilLine,
  "clipboard-list": ClipboardList,
  rocket: Rocket,
  blocks: Blocks,
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
