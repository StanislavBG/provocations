import { useSyncExternalStore } from "react";
import type { FlowNodeType } from "@/components/flow/useFlowCanvas";

// ── Types ──

export type LifecyclePhase =
  | "pre-process"
  | "process"
  | "post-process"
  | "activate"
  | "deactivate"
  | "tick"
  | "chain";

export type LifecycleStatus = "start" | "success" | "error" | "skipped";

export interface LifecycleLogEntry {
  id: string;
  timestamp: number;
  /** Which lifecycle phase */
  phase: LifecyclePhase;
  /** Outcome */
  status: LifecycleStatus;
  /** Node that triggered this event */
  nodeId: string;
  nodeType: FlowNodeType;
  nodeLabel: string;
  /** Duration in ms (for completed phases) */
  durationMs?: number;
  /** Human-readable detail message */
  message: string;
  /** IDs of downstream nodes triggered (for chain/post-process) */
  downstreamIds?: string[];
  /** Error message on failure */
  error?: string;
}

// ── Filter ──

export interface LifecycleFilter {
  nodeId?: string;
  nodeType?: FlowNodeType;
  phase?: LifecyclePhase;
  status?: LifecycleStatus;
}

export function matchesFilter(entry: LifecycleLogEntry, filter: LifecycleFilter): boolean {
  if (filter.nodeId && entry.nodeId !== filter.nodeId) return false;
  if (filter.nodeType && entry.nodeType !== filter.nodeType) return false;
  if (filter.phase && entry.phase !== filter.phase) return false;
  if (filter.status && entry.status !== filter.status) return false;
  return true;
}

// ── Store ──

type Listener = () => void;

const MAX_ENTRIES = 500;

function createLifecycleLogStore() {
  let entries: LifecycleLogEntry[] = [];
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

    push(entry: Omit<LifecycleLogEntry, "id" | "timestamp">) {
      const full: LifecycleLogEntry = {
        ...entry,
        id: `lc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        timestamp: Date.now(),
      };
      entries = [...entries, full];
      if (entries.length > MAX_ENTRIES) entries = entries.slice(-MAX_ENTRIES);
      emit();
    },

    clear() {
      entries = [];
      emit();
    },

    /** Get unique node types present in the log */
    getNodeTypes(): FlowNodeType[] {
      const types = new Set<FlowNodeType>();
      for (const e of entries) types.add(e.nodeType);
      return Array.from(types);
    },

    /** Get unique node IDs present in the log */
    getNodeIds(): Array<{ id: string; label: string; type: FlowNodeType }> {
      const seen = new Map<string, { label: string; type: FlowNodeType }>();
      for (const e of entries) {
        if (!seen.has(e.nodeId)) {
          seen.set(e.nodeId, { label: e.nodeLabel, type: e.nodeType });
        }
      }
      return Array.from(seen.entries()).map(([id, v]) => ({ id, ...v }));
    },
  };
}

// Singleton
export const lifecycleLogStore = createLifecycleLogStore();

// ── React hook ──

export function useLifecycleLog() {
  const entries = useSyncExternalStore(
    lifecycleLogStore.subscribe,
    lifecycleLogStore.getSnapshot,
  );
  return {
    entries,
    push: lifecycleLogStore.push,
    clear: lifecycleLogStore.clear,
    getNodeTypes: lifecycleLogStore.getNodeTypes,
    getNodeIds: lifecycleLogStore.getNodeIds,
  };
}

// ── Formatting ──

const PHASE_LABELS: Record<LifecyclePhase, string> = {
  "pre-process": "Pre",
  process: "Process",
  "post-process": "Post",
  activate: "Activate",
  deactivate: "Deactivate",
  tick: "Tick",
  chain: "Chain",
};

export function getPhaseLabel(phase: LifecyclePhase): string {
  return PHASE_LABELS[phase] || phase;
}

export function formatLifecycleLog(entries: LifecycleLogEntry[]): string {
  if (!entries.length) return "(no lifecycle events)";
  return entries
    .map((e) => {
      const time = new Date(e.timestamp).toLocaleTimeString(undefined, {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        fractionalSecondDigits: 3,
      });
      let line = `[${time}] ${getPhaseLabel(e.phase).padEnd(10)} ${e.status.padEnd(7)} ${e.nodeType}:${e.nodeLabel}`;
      if (e.durationMs !== undefined) line += ` (${e.durationMs}ms)`;
      if (e.message) line += ` — ${e.message}`;
      if (e.error) line += ` ERROR: ${e.error}`;
      if (e.downstreamIds?.length) line += ` → [${e.downstreamIds.join(", ")}]`;
      return line;
    })
    .join("\n");
}
