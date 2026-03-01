import { useSyncExternalStore } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MessageLevel = "info" | "success" | "warning" | "error";

export interface MessageLogEntry {
  id: string;
  timestamp: number;
  /** Short title */
  title: string;
  /** Optional longer description */
  description?: string;
  /** Severity level */
  level: MessageLevel;
  /** Source component/action that created the message */
  source?: string;
}

// ---------------------------------------------------------------------------
// Store (external, framework-agnostic — mirrors errorLogStore pattern)
// ---------------------------------------------------------------------------

type Listener = () => void;

function createMessageLogStore() {
  let entries: MessageLogEntry[] = [];
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
    push(entry: Omit<MessageLogEntry, "id" | "timestamp">) {
      const full: MessageLogEntry = {
        ...entry,
        id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        timestamp: Date.now(),
      };
      entries = [...entries, full];
      // Keep max 200 entries in memory
      if (entries.length > 200) entries = entries.slice(-200);
      emit();
    },
    clear() {
      entries = [];
      emit();
    },
  };
}

// Singleton store — shared across the app
export const messageLogStore = createMessageLogStore();

// ---------------------------------------------------------------------------
// React hook
// ---------------------------------------------------------------------------

/** Subscribe to the global message log. Returns { entries, push, clear }. */
export function useMessageLog() {
  const entries = useSyncExternalStore(messageLogStore.subscribe, messageLogStore.getSnapshot);
  return { entries, push: messageLogStore.push, clear: messageLogStore.clear };
}
