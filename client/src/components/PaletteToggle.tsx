import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Palette } from "lucide-react";

const PALETTES = [
  { id: "ember",  label: "Ember",  swatch: "#B35C1E", cls: "" },
  { id: "ocean",  label: "Ocean",  swatch: "#2E7DA8", cls: "palette-ocean" },
  { id: "forest", label: "Forest", swatch: "#2D8A56", cls: "palette-forest" },
  { id: "dusk",   label: "Dusk",   swatch: "#7C4DCC", cls: "palette-dusk" },
  { id: "slate",  label: "Slate",  swatch: "#4D5B6E", cls: "palette-slate" },
] as const;

type PaletteId = (typeof PALETTES)[number]["id"];

const STORAGE_KEY = "provocations-palette";

function applyPalette(id: PaletteId) {
  const root = document.documentElement;
  // Remove all palette classes
  for (const p of PALETTES) {
    if (p.cls) root.classList.remove(p.cls);
  }
  // Apply new one (ember has no class — it's the :root default)
  const match = PALETTES.find((p) => p.id === id);
  if (match?.cls) root.classList.add(match.cls);
  localStorage.setItem(STORAGE_KEY, id);
}

function loadPalette(): PaletteId {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved && PALETTES.some((p) => p.id === saved)) return saved as PaletteId;
  return "ember";
}

export function PaletteToggle() {
  const [active, setActive] = useState<PaletteId>(loadPalette);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Apply on mount + change
  useEffect(() => {
    applyPalette(active);
  }, [active]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  // Cycle to next palette on direct click
  function cycleNext() {
    const idx = PALETTES.findIndex((p) => p.id === active);
    const next = PALETTES[(idx + 1) % PALETTES.length];
    setActive(next.id);
  }

  return (
    <div ref={ref} className="relative">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 relative"
            onClick={cycleNext}
            onContextMenu={(e) => {
              e.preventDefault();
              setOpen(!open);
            }}
          >
            <Palette className="w-3.5 h-3.5" />
            <span
              className="absolute bottom-0.5 right-0.5 w-1.5 h-1.5 rounded-full ring-1 ring-card"
              style={{ backgroundColor: PALETTES.find((p) => p.id === active)?.swatch }}
            />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          Click to cycle palettes{"\u00A0"}&middot;{"\u00A0"}right-click to pick
        </TooltipContent>
      </Tooltip>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 z-50 bg-popover border border-popover-border rounded-lg shadow-lg p-1.5 min-w-[140px]">
          {PALETTES.map((p) => (
            <button
              key={p.id}
              onClick={() => {
                setActive(p.id);
                setOpen(false);
              }}
              className={`
                flex items-center gap-2.5 w-full px-2.5 py-1.5 rounded-md text-xs
                transition-colors hover:bg-muted
                ${active === p.id ? "bg-muted font-semibold" : ""}
              `}
            >
              <span
                className="w-3 h-3 rounded-full shrink-0 ring-1 ring-border"
                style={{ backgroundColor: p.swatch }}
              />
              <span className="text-foreground">{p.label}</span>
              {active === p.id && (
                <span className="ml-auto text-primary text-[10px]">&#10003;</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
