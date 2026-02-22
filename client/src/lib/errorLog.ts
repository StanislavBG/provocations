import { createContext, useContext, useCallback, useRef, useSyncExternalStore } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ErrorLogEntry {
  id: string;
  timestamp: number;
  /** Human-readable step name, e.g. "Generate Summary", "Write Document" */
  step: string;
  /** The API endpoint that failed */
  endpoint?: string;
  /** Error message from the server or network layer */
  message: string;
  /** Full error details (response body, stack trace, etc.) */
  details?: string;
}

// ---------------------------------------------------------------------------
// Store (external, framework-agnostic)
// ---------------------------------------------------------------------------

type Listener = () => void;

function createErrorLogStore() {
  let entries: ErrorLogEntry[] = [];
  const listeners = new Set<Listener>();

  function emit() {
    listeners.forEach((l) => l());
  }

  return {
    getSnapshot: () => entries,
    subscribe: (listener: Listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    push(entry: Omit<ErrorLogEntry, "id" | "timestamp">) {
      const full: ErrorLogEntry = {
        ...entry,
        id: `err-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        timestamp: Date.now(),
      };
      entries = [...entries, full];
      emit();
    },
    clear() {
      entries = [];
      emit();
    },
  };
}

// Singleton store — shared across the app
export const errorLogStore = createErrorLogStore();

// ---------------------------------------------------------------------------
// React hook
// ---------------------------------------------------------------------------

/** Subscribe to the global error log. Returns [entries, push, clear]. */
export function useErrorLog() {
  const entries = useSyncExternalStore(errorLogStore.subscribe, errorLogStore.getSnapshot);
  return { entries, push: errorLogStore.push, clear: errorLogStore.clear };
}

/** Helper to format all entries as a copyable string */
export function formatErrorLog(entries: ErrorLogEntry[]): string {
  if (!entries.length) return "(no errors)";
  return entries
    .map((e) => {
      const time = new Date(e.timestamp).toLocaleTimeString();
      let line = `[${time}] ${e.step}`;
      if (e.endpoint) line += ` (${e.endpoint})`;
      line += `\n  ${e.message}`;
      if (e.details) line += `\n  Details: ${e.details}`;
      return line;
    })
    .join("\n\n");
}
