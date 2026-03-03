import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Moon, Sun, Monitor } from "lucide-react";
import {
  type ThemePreference,
  applyThemeToDOM,
  readThemeFromLS,
  resolveTheme,
} from "@/lib/theme-utils";

interface ThemeToggleProps {
  /** Controlled value. When provided, the component is controlled by the parent. */
  value?: ThemePreference;
  /** Called when the user cycles the theme. Only used in controlled mode. */
  onChange?: (theme: ThemePreference) => void;
}

const CYCLE: ThemePreference[] = ["light", "dark", "system"];

function nextTheme(current: ThemePreference): ThemePreference {
  const idx = CYCLE.indexOf(current);
  return CYCLE[(idx + 1) % CYCLE.length];
}

export function ThemeToggle({ value, onChange }: ThemeToggleProps) {
  const controlled = value !== undefined && onChange !== undefined;

  // Uncontrolled internal state (used outside FTUX)
  const [internal, setInternal] = useState<ThemePreference>(readThemeFromLS);

  const current = controlled ? value : internal;

  // Uncontrolled mode: apply to DOM when internal state changes
  useEffect(() => {
    if (!controlled) {
      applyThemeToDOM(internal);
    }
  }, [internal, controlled]);

  function handleClick() {
    const next = nextTheme(current);
    if (controlled) {
      onChange(next);
    } else {
      setInternal(next);
    }
  }

  const resolved = resolveTheme(current);
  const icon =
    current === "system" ? (
      <Monitor className="w-4 h-4" />
    ) : resolved === "dark" ? (
      <Sun className="w-4 h-4" />
    ) : (
      <Moon className="w-4 h-4" />
    );

  return (
    <Button
      data-testid="button-theme-toggle"
      size="icon"
      variant="ghost"
      onClick={handleClick}
      title={`Theme: ${current}`}
    >
      {icon}
    </Button>
  );
}
