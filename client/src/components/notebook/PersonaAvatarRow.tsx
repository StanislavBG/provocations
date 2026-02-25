import { builtInPersonas } from "@shared/personas";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { ProvocationType } from "@shared/schema";

interface PersonaAvatarRowProps {
  activePersonas: Set<ProvocationType>;
  onToggle: (id: ProvocationType) => void;
  /** Compact mode renders smaller avatars (for inline use above chat input) */
  compact?: boolean;
}

/** All user-facing personas (exclude master_researcher which is backend-only) */
const USER_PERSONAS = Object.values(builtInPersonas).filter(
  (p) => p.id !== "master_researcher",
);

export function PersonaAvatarRow({
  activePersonas,
  onToggle,
  compact = false,
}: PersonaAvatarRowProps) {
  const size = compact ? "w-7 h-7 text-[10px]" : "w-9 h-9 text-xs";
  const gap = compact ? "gap-1" : "gap-1.5";

  return (
    <div className={`flex items-center ${gap} flex-wrap`}>
      {USER_PERSONAS.map((persona) => {
        const isActive = activePersonas.has(persona.id as ProvocationType);
        const initials = persona.label
          .split(" ")
          .map((w) => w[0])
          .join("")
          .slice(0, 2);

        return (
          <Tooltip key={persona.id}>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => onToggle(persona.id as ProvocationType)}
                className={`${size} rounded-full flex items-center justify-center font-semibold transition-all
                  ${
                    isActive
                      ? `${persona.color.bg} ${persona.color.text} ring-2 ring-primary shadow-sm`
                      : "bg-muted/50 text-muted-foreground/40 hover:bg-muted hover:text-muted-foreground/70"
                  }`}
                style={
                  isActive
                    ? { boxShadow: `0 0 8px ${persona.color.accent}40` }
                    : undefined
                }
              >
                {initials}
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-[200px]">
              <p className="font-semibold text-xs">{persona.label}</p>
              <p className="text-xs text-muted-foreground">{persona.role}</p>
            </TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}
