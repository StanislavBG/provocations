import { useSyncExternalStore } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ErrorLogEntry {
  id: string;
  timestamp: number;
  /** Human-readable step name, e.g. "Generate Summary", "Write Document" */
  step: string;
  /** Tag/category: "api", "client", "voice", "llm", "promise", "network" */
  tag?: string;
  /** The API endpoint that failed */
  endpoint?: string;
  /** Error message from the server or network layer */
  message: string;
  /** Full error details (response body, stack trace, etc.) */
  details?: string;
}

// ---------------------------------------------------------------------------
// Server persistence (fire-and-forget)
// ---------------------------------------------------------------------------

/** Send error to server for persistence and admin visibility */
function persistToServer(entry: ErrorLogEntry) {
  try {
    fetch("/api/errors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tag: entry.tag || (entry.endpoint ? "api" : "client"),
        message: entry.message,
        stack: entry.details || null,
        url: entry.endpoint || null,
        metadata: { step: entry.step },
      }),
      credentials: "include",
    }).catch(() => {
      // Can't log an error about logging errors
    });
  } catch {
    // Silently fail — this is a best-effort log
  }
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
      // Keep max 200 entries in memory
      if (entries.length > 200) entries = entries.slice(-200);
      emit();
      // Persist to server (async, fire-and-forget)
      persistToServer(full);
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
// Global error handlers — captures unhandled errors and promise rejections
// ---------------------------------------------------------------------------

let globalHandlersInstalled = false;

export function installGlobalErrorHandlers() {
  if (globalHandlersInstalled) return;
  globalHandlersInstalled = true;

  window.addEventListener("error", (event) => {
    errorLogStore.push({
      step: "Unhandled Error",
      tag: "client",
      message: event.message || "Unknown error",
      details: event.error?.stack,
      endpoint: event.filename ? `${event.filename}:${event.lineno}:${event.colno}` : undefined,
    });
  });

  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;
    const msg = reason instanceof Error ? reason.message : String(reason);
    errorLogStore.push({
      step: "Unhandled Promise",
      tag: "promise",
      message: msg,
      details: reason instanceof Error ? reason.stack : undefined,
    });
  });
}

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
