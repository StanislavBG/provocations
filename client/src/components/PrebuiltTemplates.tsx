import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Brain,
  ClipboardList,
  Rocket,
  FileCode,
  MessageSquarePlus,
  Search,
  Code,
  Megaphone,
  Briefcase,
  ChevronRight,
  X,
} from "lucide-react";
import { prebuiltTemplates, templateCategories, type PrebuiltTemplate } from "@/lib/prebuiltTemplates";

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  brain: Brain,
  "clipboard-list": ClipboardList,
  rocket: Rocket,
  "file-code": FileCode,
  "message-square-plus": MessageSquarePlus,
  search: Search,
  code: Code,
  megaphone: Megaphone,
  briefcase: Briefcase,
};

interface PrebuiltTemplatesProps {
  onSelect: (template: PrebuiltTemplate) => void;
}

export function PrebuiltTemplates({ onSelect }: PrebuiltTemplatesProps) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered = selectedCategory
    ? prebuiltTemplates.filter((t) => t.category === selectedCategory)
    : prebuiltTemplates;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm font-medium text-muted-foreground">Quick start:</span>
        <Button
          variant={selectedCategory === null ? "secondary" : "ghost"}
          size="sm"
          className="h-7 text-xs"
          onClick={() => setSelectedCategory(null)}
        >
          All
        </Button>
        {templateCategories.map((cat) => (
          <Button
            key={cat.id}
            variant={selectedCategory === cat.id ? "secondary" : "ghost"}
            size="sm"
            className="h-7 text-xs"
            onClick={() => setSelectedCategory(selectedCategory === cat.id ? null : cat.id)}
          >
            {cat.label}
          </Button>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {filtered.map((template) => {
          const Icon = iconMap[template.icon] || FileCode;
          const isExpanded = expandedId === template.id;

          return (
            <button
              key={template.id}
              className={`group text-left p-4 rounded-lg border transition-all hover:border-primary/50 hover:bg-primary/5 ${
                isExpanded ? "border-primary/50 bg-primary/5 col-span-1 sm:col-span-2" : ""
              }`}
              onClick={() => {
                if (isExpanded) {
                  onSelect(template);
                } else {
                  setExpandedId(template.id);
                }
              }}
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5 p-2 rounded-md bg-primary/10 shrink-0">
                  <Icon className="w-4 h-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="font-medium text-sm leading-snug block">{template.title}</span>
                  <Badge variant="outline" className="text-[10px] capitalize mt-1 inline-flex">
                    {template.category}
                  </Badge>
                  {!isExpanded && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                      {template.description}
                    </p>
                  )}
                  {isExpanded && (
                    <div className="mt-2 space-y-2">
                      <p className="text-sm text-muted-foreground">{template.description}</p>
                      <div className="text-xs text-muted-foreground/80 bg-muted/50 rounded-md p-2 border">
                        <span className="font-medium text-foreground/70">Objective:</span>{" "}
                        {template.objective}
                      </div>
                      <div className="flex items-center gap-2 pt-1">
                        <Button
                          size="sm"
                          className="gap-1.5 h-8 text-xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelect(template);
                          }}
                        >
                          Use this template
                          <ChevronRight className="w-3 h-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 text-xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            setExpandedId(null);
                          }}
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
                {!isExpanded && (
                  <ChevronRight className="w-4 h-4 text-muted-foreground/50 group-hover:text-primary shrink-0 mt-1" />
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
