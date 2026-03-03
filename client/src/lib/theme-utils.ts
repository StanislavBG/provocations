// Shared DOM utilities for theme and palette management.
// Used by both toggle components (uncontrolled) and the FTUX shell context (controlled).

export type ThemePreference = "dark" | "light" | "system";
export type PaletteId = "ember" | "ocean" | "forest" | "dusk" | "slate";

export const PALETTES = [
  { id: "ember" as const,  label: "Ember",  swatch: "#B35C1E", cls: "" },
  { id: "ocean" as const,  label: "Ocean",  swatch: "#2E7DA8", cls: "palette-ocean" },
  { id: "forest" as const, label: "Forest", swatch: "#2D8A56", cls: "palette-forest" },
  { id: "dusk" as const,   label: "Dusk",   swatch: "#7C4DCC", cls: "palette-dusk" },
  { id: "slate" as const,  label: "Slate",  swatch: "#4D5B6E", cls: "palette-slate" },
] as const;

const THEME_LS_KEY = "theme";
const PALETTE_LS_KEY = "provocations-palette";

/** Resolve "system" to actual dark/light using matchMedia. */
export function resolveTheme(pref: ThemePreference): "dark" | "light" {
  if (pref === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return pref;
}

/** Apply theme preference to the DOM and write to localStorage. */
export function applyThemeToDOM(pref: ThemePreference) {
  const resolved = resolveTheme(pref);
  const root = document.documentElement;
  if (resolved === "dark") {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }
  localStorage.setItem(THEME_LS_KEY, pref);
}

/** Apply palette to the DOM and write to localStorage. */
export function applyPaletteToDOM(id: PaletteId) {
  const root = document.documentElement;
  for (const p of PALETTES) {
    if (p.cls) root.classList.remove(p.cls);
  }
  const match = PALETTES.find((p) => p.id === id);
  if (match?.cls) root.classList.add(match.cls);
  localStorage.setItem(PALETTE_LS_KEY, id);
}

/** Read current theme preference from localStorage. */
export function readThemeFromLS(): ThemePreference {
  const saved = localStorage.getItem(THEME_LS_KEY);
  if (saved === "dark" || saved === "light" || saved === "system") return saved;
  return "system";
}

/** Read current palette from localStorage. */
export function readPaletteFromLS(): PaletteId {
  const saved = localStorage.getItem(PALETTE_LS_KEY);
  if (saved && PALETTES.some((p) => p.id === saved)) return saved as PaletteId;
  return "ember";
}
