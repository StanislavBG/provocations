/**
 * KeyboardShortcutsOverlay — Shows all keyboard shortcuts in a modal.
 *
 * Triggered by pressing `?` or `Ctrl+/`.
 * Reads actual configured bindings from FtuxShellConfig (respects user overrides).
 */

import { useState, useEffect, useCallback } from "react";
import { useFtuxShell } from "@/lib/ftux-shell-context";
import {
  KEYBIND_ACTIONS,
  getEffectiveKeys,
  formatCombo,
  type KeyBindAction,
} from "@/lib/keybind-actions";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Keyboard } from "lucide-react";

// Group actions by their group field
function groupActions(actions: KeyBindAction[]): Record<string, KeyBindAction[]> {
  const groups: Record<string, KeyBindAction[]> = {};
  for (const action of actions) {
    if (!groups[action.group]) groups[action.group] = [];
    groups[action.group].push(action);
  }
  return groups;
}

export function KeyboardShortcutsOverlay() {
  const [open, setOpen] = useState(false);
  const { keyBinds } = useFtuxShell();

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Don't trigger in inputs/textareas/contenteditable
    const target = e.target as HTMLElement;
    if (
      target.tagName === "INPUT" ||
      target.tagName === "TEXTAREA" ||
      target.isContentEditable
    ) {
      return;
    }

    // `?` key (Shift+/)
    if (e.key === "?" && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      setOpen((prev) => !prev);
      return;
    }

    // Ctrl+/ or Cmd+/
    if (e.key === "/" && (e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey) {
      e.preventDefault();
      setOpen((prev) => !prev);
      return;
    }
  }, []);

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const grouped = groupActions(KEYBIND_ACTIONS);
  const groupOrder = ["Canvas", "Selection", "Edit"];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto" aria-describedby="keyboard-shortcuts-description">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Keyboard className="w-4 h-4 text-primary" />
            Keyboard Shortcuts
          </DialogTitle>
          <DialogDescription id="keyboard-shortcuts-description" className="text-xs">
            Press <kbd className="px-1 py-0.5 rounded bg-muted text-[10px] font-mono">?</kbd> or{" "}
            <kbd className="px-1 py-0.5 rounded bg-muted text-[10px] font-mono">Ctrl+/</kbd> to toggle this overlay.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 pt-2">
          {groupOrder.map((groupName) => {
            const actions = grouped[groupName];
            if (!actions) return null;
            return (
              <div key={groupName}>
                <h3 className="text-[11px] uppercase tracking-wider text-muted-foreground/70 font-semibold mb-2">
                  {groupName}
                </h3>
                <div className="space-y-1">
                  {actions.map((action) => {
                    const keys = getEffectiveKeys(action.id, keyBinds);
                    return (
                      <div
                        key={action.id}
                        className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-muted/50 transition-colors"
                      >
                        <span className="text-sm text-foreground/80">
                          {action.label}
                        </span>
                        <div className="flex items-center gap-1.5 shrink-0 ml-4">
                          {keys.map((combo, i) => (
                            <span key={i}>
                              {i > 0 && (
                                <span className="text-[10px] text-muted-foreground/40 mr-1.5">or</span>
                              )}
                              <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border/50 text-[11px] font-mono text-foreground/70">
                                {formatCombo(combo)}
                              </kbd>
                            </span>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* Additional non-customizable shortcuts */}
          <div>
            <h3 className="text-[11px] uppercase tracking-wider text-muted-foreground/70 font-semibold mb-2">
              General
            </h3>
            <div className="space-y-1">
              {[
                { label: "Show keyboard shortcuts", keys: ["?", "Ctrl+/"] },
                { label: "Fit canvas to view", keys: ["F"] },
                { label: "Pan camera", keys: ["W A S D"] },
                { label: "Scroll to zoom", keys: ["Scroll"] },
              ].map((item) => (
                <div
                  key={item.label}
                  className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-muted/50 transition-colors"
                >
                  <span className="text-sm text-foreground/80">{item.label}</span>
                  <div className="flex items-center gap-1.5 shrink-0 ml-4">
                    {item.keys.map((k, i) => (
                      <span key={i}>
                        {i > 0 && (
                          <span className="text-[10px] text-muted-foreground/40 mr-1.5">or</span>
                        )}
                        <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border/50 text-[11px] font-mono text-foreground/70">
                          {k}
                        </kbd>
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
