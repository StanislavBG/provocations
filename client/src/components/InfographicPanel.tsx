import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Lightbulb,
  Target,
  TrendingUp,
  Users,
  Zap,
  Star,
  BarChart,
  CheckCircle,
  BookOpen,
  Award,
  type LucideIcon,
} from "lucide-react";
import type { InfographicSpec, InfographicSection } from "@shared/schema";

// Map icon name strings to Lucide components
const ICON_MAP: Record<string, LucideIcon> = {
  Lightbulb,
  Target,
  TrendingUp,
  Users,
  Zap,
  Star,
  BarChart,
  CheckCircle,
  BookOpen,
  Award,
};

function getIcon(name: string): LucideIcon {
  return ICON_MAP[name] || Lightbulb;
}

interface InfographicPanelProps {
  spec: InfographicSpec | null;
  className?: string;
}

export function InfographicPanel({ spec, className }: InfographicPanelProps) {
  if (!spec) {
    return (
      <div className={`flex items-center justify-center h-full text-muted-foreground ${className || ""}`}>
        <p className="text-sm">No infographic generated yet. Process a video or transcript first.</p>
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className || ""}`}>
      {/* Header */}
      <div className="text-center space-y-1">
        <h2 className="text-xl font-bold">{spec.title}</h2>
        <p className="text-sm text-muted-foreground">{spec.subtitle}</p>
        <Badge variant="outline" className="text-[10px]">
          {spec.sourceLabel}
        </Badge>
      </div>

      {/* Color palette preview */}
      <div className="flex gap-1 justify-center">
        {spec.colorPalette.map((color, i) => (
          <div
            key={i}
            className="w-8 h-4 rounded-sm border"
            style={{ backgroundColor: color }}
            title={color}
          />
        ))}
      </div>

      {/* Sections */}
      <div className="space-y-3">
        {spec.sections.map((section, i) => {
          const IconComponent = getIcon(section.icon);
          return (
            <Card
              key={section.id}
              className="overflow-hidden"
              style={{ borderLeftColor: section.color, borderLeftWidth: "4px" }}
            >
              <CardHeader className="py-3 px-4 pb-1">
                <CardTitle className="text-sm flex items-center gap-2">
                  <IconComponent
                    className="w-4 h-4 shrink-0"
                    style={{ color: section.color }}
                  />
                  {section.heading}
                  {i === 0 && (
                    <Badge variant="secondary" className="text-[9px] ml-auto">
                      Hero
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-3 pt-1">
                <p className="text-xs text-muted-foreground">{section.content}</p>
                {section.dataPoints && section.dataPoints.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {section.dataPoints.map((dp, j) => (
                      <div
                        key={j}
                        className="text-xs flex items-start gap-1.5"
                      >
                        <span
                          className="inline-block w-1.5 h-1.5 rounded-full mt-1.5 shrink-0"
                          style={{ backgroundColor: section.color }}
                        />
                        {dp}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
