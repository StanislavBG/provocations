import { useState } from "react";
import { builtInPersonas } from "@shared/personas";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { ProvocationType } from "@shared/schema";

interface PersonaAvatarRowProps {
  activePersonas: Set<ProvocationType>;
  onToggle: (id: ProvocationType) => void;
  /** Compact mode renders smaller chips (for inline use) */
  compact?: boolean;
}

/** Domain grouping for personas */
const DOMAIN_GROUPS = [
  { key: "business", label: "Business", description: "Strategy & leadership" },
  { key: "technology", label: "Technology", description: "Design & engineering" },
  { key: "marketing", label: "Marketing", description: "Growth & messaging" },
] as const;

/** All user-facing personas grouped by domain */
const PERSONAS_BY_DOMAIN = DOMAIN_GROUPS.map((group) => ({
  ...group,
  personas: Object.values(builtInPersonas).filter(
    (p) => p.domain === group.key && p.id !== "master_researcher",
  ),
}));

export function PersonaAvatarRow({
  activePersonas,
  onToggle,
  compact = false,
}: PersonaAvatarRowProps) {
  const [expanded, setExpanded] = useState(true);
  const totalActive = activePersonas.size;
  const totalPersonas = PERSONAS_BY_DOMAIN.reduce((sum, g) => sum + g.personas.length, 0);

  return (
    <div className="space-y-1">
      {/* Header with toggle */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between w-full text-left"
      >
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Your Advisors
        </span>
        <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
          {totalActive}/{totalPersonas} active
          {expanded ? (
            <ChevronUp className="w-3 h-3" />
          ) : (
            <ChevronDown className="w-3 h-3" />
          )}
        </span>
      </button>

      {expanded && (
        <div className="space-y-1.5">
          {PERSONAS_BY_DOMAIN.map((group) => {
            const activeInGroup = group.personas.filter((p) =>
              activePersonas.has(p.id as ProvocationType),
            ).length;

            return (
              <div key={group.key}>
                {/* Domain header */}
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className="text-[9px] font-medium text-muted-foreground/70 uppercase tracking-wider">
                    {group.label}
                  </span>
                  <span className="text-[9px] text-muted-foreground/40">
                    {activeInGroup}/{group.personas.length}
                  </span>
                </div>

                {/* Persona chips */}
                <div className={`flex flex-wrap ${compact ? "gap-1" : "gap-1"}`}>
                  {group.personas.map((persona) => {
                    const isActive = activePersonas.has(
                      persona.id as ProvocationType,
                    );

                    return (
                      <Tooltip key={persona.id}>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            onClick={() =>
                              onToggle(persona.id as ProvocationType)
                            }
                            className={`px-2 py-0.5 rounded-full text-[10px] font-medium transition-all whitespace-nowrap ${
                              isActive
                                ? "ring-1 shadow-sm"
                                : "bg-muted/30 text-muted-foreground/40 hover:bg-muted/60 hover:text-muted-foreground/70"
                            }`}
                            style={
                              isActive
                                ? {
                                    backgroundColor: `${persona.color.accent}18`,
                                    color: persona.color.accent,
                                    borderColor: `${persona.color.accent}40`,
                                    boxShadow: `0 0 6px ${persona.color.accent}20`,
                                  }
                                : undefined
                            }
                          >
                            {persona.label}
                          </button>
                        </TooltipTrigger>
                        <TooltipContent
                          side="bottom"
                          className="max-w-[220px]"
                        >
                          <p className="font-semibold text-xs">
                            {persona.label}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {persona.role}
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
