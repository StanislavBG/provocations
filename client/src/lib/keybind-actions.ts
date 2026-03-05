// ── Keybind Actions: central registry + matching utility ──
//
// Actions define all customizable keyboard shortcuts. User overrides are
// sparse (only changed bindings stored) and persisted via FtuxShellConfig.
//
// Combo format: "mod+shift+z", "w", "Delete", "+", "="
//   "mod" resolves to Cmd on Mac, Ctrl on Windows/Linux.
//   Multiple strings in defaultKeys = "any of these trigger it" (OR).

export type KeyBindActionId =
  | "canvas.zoomIn"
  | "canvas.zoomOut"
  | "canvas.glideUp"
  | "canvas.glideDown"
  | "canvas.glideLeft"
  | "canvas.glideRight"
  | "canvas.minimap"
  | "selection.selectAll"
  | "selection.deselectAll"
  | "edit.copy"
  | "edit.paste"
  | "edit.undo"
  | "edit.redo"
  | "edit.delete";

export interface KeyBindAction {
  id: KeyBindActionId;
  label: string;
  group: "Canvas" | "Selection" | "Edit";
  /** Default key combos. "mod" = Cmd/Ctrl. Multiple = any triggers the action. */
  defaultKeys: string[];
}

export const KEYBIND_ACTIONS: KeyBindAction[] = [
  // Canvas
  { id: "canvas.zoomIn",     label: "Zoom in (hold to accelerate)",  group: "Canvas",    defaultKeys: ["+", "="] },
  { id: "canvas.zoomOut",    label: "Zoom out (hold to accelerate)", group: "Canvas",    defaultKeys: ["-"] },
  { id: "canvas.glideUp",   label: "Glide camera up",               group: "Canvas",    defaultKeys: ["w"] },
  { id: "canvas.glideDown", label: "Glide camera down",             group: "Canvas",    defaultKeys: ["s"] },
  { id: "canvas.glideLeft", label: "Glide camera left",             group: "Canvas",    defaultKeys: ["a"] },
  { id: "canvas.glideRight",label: "Glide camera right",            group: "Canvas",    defaultKeys: ["d"] },
  { id: "canvas.minimap",   label: "Toggle minimap",                group: "Canvas",    defaultKeys: ["m"] },
  // Selection
  { id: "selection.selectAll",   label: "Select all nodes", group: "Selection", defaultKeys: ["mod+a"] },
  { id: "selection.deselectAll", label: "Deselect all",     group: "Selection", defaultKeys: ["Escape"] },
  // Edit
  { id: "edit.copy",   label: "Copy selected nodes", group: "Edit", defaultKeys: ["mod+c"] },
  { id: "edit.paste",  label: "Paste at cursor",     group: "Edit", defaultKeys: ["mod+v"] },
  { id: "edit.undo",   label: "Undo",                group: "Edit", defaultKeys: ["mod+z"] },
  { id: "edit.redo",   label: "Redo",                group: "Edit", defaultKeys: ["mod+shift+z", "mod+y"] },
  { id: "edit.delete", label: "Delete selected",     group: "Edit", defaultKeys: ["Delete", "Backspace"] },
];

/** User overrides: only changed bindings are stored. */
export type KeyBindOverrides = Partial<Record<KeyBindActionId, string[]>>;

// ── Lookup helpers ──

/** Get the effective keys for an action (override wins over default). */
export function getEffectiveKeys(actionId: KeyBindActionId, overrides?: KeyBindOverrides): string[] {
  if (overrides?.[actionId]) return overrides[actionId]!;
  const action = KEYBIND_ACTIONS.find((a) => a.id === actionId);
  return action?.defaultKeys ?? [];
}

/** Get default keys for an action (ignoring overrides). */
export function getDefaultKeys(actionId: KeyBindActionId): string[] {
  return KEYBIND_ACTIONS.find((a) => a.id === actionId)?.defaultKeys ?? [];
}

// ── Event matching ──

const isMac = typeof navigator !== "undefined" && /Mac/.test(navigator.platform);

/**
 * Check if a KeyboardEvent matches a specific action, considering user overrides.
 */
export function matchesAction(
  e: KeyboardEvent,
  actionId: KeyBindActionId,
  overrides?: KeyBindOverrides,
): boolean {
  const keys = getEffectiveKeys(actionId, overrides);
  return keys.some((combo) => matchesCombo(e, combo));
}

/**
 * Check if a KeyboardEvent matches a raw combo string like "mod+shift+z" or "w".
 */
export function matchesCombo(e: KeyboardEvent, combo: string): boolean {
  const parts = combo.toLowerCase().split("+");
  const needsMod = parts.includes("mod");
  const needsShift = parts.includes("shift");
  const needsAlt = parts.includes("alt");
  const key = parts.filter((p) => p !== "mod" && p !== "shift" && p !== "alt")[0];

  const modPressed = isMac ? e.metaKey : e.ctrlKey;

  // Modifier presence must match exactly
  if (needsMod !== modPressed) return false;
  if (needsShift !== e.shiftKey) return false;
  if (needsAlt !== e.altKey) return false;

  if (!key) return false;

  // Compare against e.key (case-insensitive)
  const eventKey = e.key.toLowerCase();
  if (eventKey === key) return true;

  // Fallback: e.key for special names (Delete, Backspace, Escape, etc.)
  if (e.key === key) return true;

  return false;
}

// ── Display formatting ──

const MOD_DISPLAY = typeof navigator !== "undefined" && /Mac/.test(navigator.platform) ? "\u2318" : "Ctrl";

/** Format "mod+shift+z" into display string like "⌘+Shift+Z" */
export function formatCombo(combo: string): string {
  return combo
    .split("+")
    .map((p) => {
      const pl = p.toLowerCase();
      if (pl === "mod") return MOD_DISPLAY;
      if (pl === "shift") return "Shift";
      if (pl === "alt") return "Alt";
      if (pl === "escape") return "Esc";
      if (pl === "delete") return "Del";
      if (pl === "backspace") return "Bksp";
      return p.length === 1 ? p.toUpperCase() : p;
    })
    .join("+");
}

/**
 * Convert a KeyboardEvent into a combo string for recording.
 * Returns null if the event is a bare modifier press.
 */
export function eventToCombo(e: KeyboardEvent): string | null {
  // Ignore bare modifier presses
  if (["Control", "Meta", "Shift", "Alt"].includes(e.key)) return null;

  const parts: string[] = [];
  if (e.ctrlKey || e.metaKey) parts.push("mod");
  if (e.shiftKey) parts.push("shift");
  if (e.altKey) parts.push("alt");

  // Normalize the key
  const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  parts.push(key);

  return parts.join("+");
}
