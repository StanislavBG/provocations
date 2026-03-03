import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Palette } from "lucide-react";
import {
  PALETTES,
  type PaletteId,
  applyPaletteToDOM,
  readPaletteFromLS,
} from "@/lib/theme-utils";

interface PaletteToggleProps {
  /** Controlled value. When provided, the component is controlled by the parent. */
  value?: PaletteId;
  /** Called when the user picks a palette. Only used in controlled mode. */
  onChange?: (palette: PaletteId) => void;
}

export function PaletteToggle({ value, onChange }: PaletteToggleProps) {
  const controlled = value !== undefined && onChange !== undefined;

  // Uncontrolled internal state (used outside FTUX)
  const [internal, setInternal] = useState<PaletteId>(readPaletteFromLS);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const active = controlled ? value : internal;

  // Uncontrolled mode: apply to DOM when internal state changes
  useEffect(() => {
    if (!controlled) {
      applyPaletteToDOM(internal);
    }
  }, [internal, controlled]);

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

  function setActive(id: PaletteId) {
    if (controlled) {
      onChange(id);
    } else {
      setInternal(id);
    }
  }

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
