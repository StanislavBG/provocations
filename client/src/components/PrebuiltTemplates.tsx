import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  PencilLine,
  ClipboardList,
  Rocket,
  ChevronRight,
  ChevronDown,
  MessageCircle,
  Users,
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
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-3">
      {prebuiltTemplates.map((template) => {
        const Icon = iconMap[template.icon] || PencilLine;
        const isExpanded = expandedId === template.id;

        return (
          <div
            key={template.id}
            className={`rounded-lg border transition-all ${
              isExpanded
                ? "border-primary/40 bg-primary/5 shadow-sm"
                : "hover:border-primary/30 hover:bg-primary/5"
            }`}
          >
            {/* Card header — always visible */}
            <button
              className="w-full text-left p-4"
              onClick={() => setExpandedId(isExpanded ? null : template.id)}
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5 p-2 rounded-md bg-primary/10 shrink-0">
                  <Icon className="w-4 h-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm leading-snug">
                      {template.title}
                    </span>
                    {isExpanded ? (
                      <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {template.subtitle}
                  </p>
                </div>
              </div>
            </button>

            {/* Expanded details */}
            {isExpanded && (
              <div className="px-4 pb-4 space-y-3">
                {/* Description */}
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {template.description}
                </p>

                {/* Provocation sources */}
                {template.provocationSources.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                      <Users className="w-3 h-3" />
                      Provocations from
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {template.provocationSources.map((source) => (
                        <Badge
                          key={source}
                          variant="outline"
                          className="text-[10px] font-normal"
                        >
                          {source}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Example provocations */}
                {template.provocationExamples.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                      <MessageCircle className="w-3 h-3" />
                      Example provocations
                    </div>
                    <div className="space-y-1">
                      {template.provocationExamples.slice(0, 2).map((example, i) => (
                        <p
                          key={i}
                          className="text-xs text-muted-foreground/80 italic pl-3 border-l-2 border-primary/20"
                        >
                          "{example}"
                        </p>
                      ))}
                    </div>
                  </div>
                )}

                {/* Use button */}
                <Button
                  size="sm"
                  className="gap-1.5 w-full mt-2"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelect(template);
                  }}
                >
                  Use this mode
                  <ChevronRight className="w-3 h-3" />
                </Button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
