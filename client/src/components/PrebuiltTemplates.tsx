import { Button } from "@/components/ui/button";
import {
  PencilLine,
  ClipboardList,
  Rocket,
} from "lucide-react";
import { prebuiltTemplates, type PrebuiltTemplate } from "@/lib/prebuiltTemplates";

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  "pencil-line": PencilLine,
  "clipboard-list": ClipboardList,
  rocket: Rocket,
};

interface PrebuiltTemplatesProps {
  onSelect: (template: PrebuiltTemplate) => void;
}

export function PrebuiltTemplates({ onSelect }: PrebuiltTemplatesProps) {
  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">Quick-start with a preset:</p>
      <div className="flex flex-wrap gap-2">
        {prebuiltTemplates.map((template) => {
          const Icon = iconMap[template.icon] || PencilLine;

          return (
            <Button
              key={template.id}
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs h-8"
              onClick={() => onSelect(template)}
              title={template.description}
            >
              <Icon className="w-3.5 h-3.5 text-primary shrink-0" />
              <span className="truncate">{template.shortLabel}</span>
            </Button>
          );
        })}
      </div>
    </div>
  );
}
