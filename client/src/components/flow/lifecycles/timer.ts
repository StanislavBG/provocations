/**
 * Trigger node lifecycle — Full lifecycle for timer-event nodes.
 *
 * Consolidates all trigger behavior that was previously scattered across:
 * - FlowTimerEventNode (setInterval for timed mode)
 * - FlowWorkspace useEffect #1 (timed pulse → output doc creation)
 * - FlowWorkspace useEffect #2 (automated upstream watcher → chain propagation)
 *
 * Two modes:
 *   Timed     — interval fires pulses, creates/appends to a log document
 *   Automated — watches upstream node completion, fires downstream chain
 */

import type { FlowNode, FlowEdge } from "../useFlowCanvas";
import { FLOW_NODE_REGISTRY } from "../FlowNodeRegistry";
import type { NodeLifecycleHandlers, NodeProcessContext } from "../useNodeLifecycle";

// ── Types ──

export interface TriggerContext {
  node: FlowNode;
  allNodes: FlowNode[];
  allEdges: FlowEdge[];
  updateNode: (nodeId: string, patch: Partial<FlowNode>) => void;
  addNode: (type: string, x: number, y: number, data: Partial<FlowNode> & { label: string }) => string;
  addEdge: (fromId: string, toId: string) => string;
}

export interface TriggerTickEvent {
  kind: "timed" | "automated";
  /** For automated: the upstream node that completed */
  triggerSource?: FlowNode;
}

// ── Internal state tracked by the engine (not on the FlowNode) ──

export interface TriggerInternalState {
  pulseCount: number;
  content: string;
}

// ── Activation ──

/** Validate whether a trigger can be activated. */
export function canActivate(ctx: TriggerContext): { valid: boolean; reason?: string } {
  const mode = ctx.node.triggerMode || "timed";
  if (mode === "automated") {
    const inputEdges = ctx.allEdges.filter((e) => e.toNodeId === ctx.node.id);
    if (inputEdges.length === 0) {
      return { valid: false, reason: "Connect upstream nodes to listen for their completion" };
    }
  }
  return { valid: true };
}

/** Activate a trigger node — sets running state and label. */
export function activate(ctx: TriggerContext): void {
  const mode = ctx.node.triggerMode || "timed";
  ctx.updateNode(ctx.node.id, {
    timerRunning: true,
    snippet: mode === "timed" ? "Timed trigger running..." : "Listening for input...",
    label:
      ctx.node.label === "Trigger" || ctx.node.label === "Timer Event"
        ? `Trigger — ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
        : ctx.node.label,
  });
}

/** Deactivate a trigger node — clears running state. */
export function deactivate(ctx: TriggerContext): void {
  const mode = ctx.node.triggerMode || "timed";
  const count = ctx.node.timerPulseCount || 0;
  ctx.updateNode(ctx.node.id, {
    timerRunning: false,
    snippet:
      mode === "timed"
        ? `Stopped — ${count} pulses`
        : `Stopped — ${count} fires`,
  });
}

// ── Per-tick / per-fire ──

/**
 * Handle a single trigger tick (timed pulse or automated fire).
 * Updates the node's pulse count, log content, and snippet.
 * Returns IDs of downstream nodes eligible for chain execution.
 */
export function handleTick(
  ctx: TriggerContext,
  event: TriggerTickEvent,
  internal: TriggerInternalState,
): string[] {
  internal.pulseCount++;
  const now = new Date();
  const ts = now.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const entry =
    event.kind === "timed"
      ? `[${ts}] Pulse #${internal.pulseCount}`
      : `[${ts}] Triggered by "${event.triggerSource?.label || "unknown"}" completion`;

  internal.content += (internal.content ? "\n" : "") + entry;

  ctx.updateNode(ctx.node.id, {
    timerPulseCount: internal.pulseCount,
    timerLastPulse: now.toISOString(),
    content: internal.content,
    snippet:
      event.kind === "timed"
        ? `Pulse #${internal.pulseCount} — ${ts}`
        : `Fired #${internal.pulseCount} — ${event.triggerSource?.label || ""}`,
  });

  return getDownstreamExecutable(ctx);
}

// ── Output document management (timed mode only) ──

/**
 * Create or append to the trigger's output log document.
 * Called after each timed pulse.
 */
export function updateOutputDocument(
  ctx: TriggerContext,
  docMap: Map<string, string>,
): void {
  const existingDocId = docMap.get(ctx.node.id);
  const existingDocNode = existingDocId
    ? ctx.allNodes.find((n) => n.id === existingDocId)
    : null;

  if (existingDocNode) {
    const lastEntry =
      ctx.node.content?.split("\n").pop() || `Pulse #${ctx.node.timerPulseCount}`;
    const updatedContent =
      (existingDocNode.documentContent || "") + "\n" + lastEntry;
    ctx.updateNode(existingDocId!, {
      documentContent: updatedContent,
      content: updatedContent,
      snippet: updatedContent.slice(-200),
    });
  } else {
    const docId = ctx.addNode(
      "document",
      ctx.node.x + ctx.node.width + 60,
      ctx.node.y,
      {
        label: `Trigger Log — ${new Date().toLocaleDateString()}`,
        snippet: ctx.node.content?.slice(-200) || "Trigger events",
        content: ctx.node.content || "",
        documentContent: ctx.node.content || "",
      },
    );
    ctx.addEdge(ctx.node.id, docId);
    docMap.set(ctx.node.id, docId);
  }
}

// ── Upstream status detection (automated mode) ──

/** Get the effective execution status of a node. */
export function getNodeStatus(node: FlowNode): string {
  return node.llmStatus || node.socialGenStatus || "idle";
}

// ── Downstream resolution ──

/** Find downstream nodes that support chain execution via the registry. */
function getDownstreamExecutable(ctx: TriggerContext): string[] {
  const outputEdges = ctx.allEdges.filter((e) => e.fromNodeId === ctx.node.id);
  const downstream: string[] = [];

  for (const edge of outputEdges) {
    const target = ctx.allNodes.find((n) => n.id === edge.toNodeId);
    if (!target) continue;
    const def = FLOW_NODE_REGISTRY[target.type];
    if (def?.supportsChainExecution) {
      downstream.push(target.id);
    }
  }

  return downstream;
}

// ── Backward-compatible one-shot handler (used by lifecycles/index.ts) ──

export function createTimerHandlers(): NodeLifecycleHandlers {
  return {
    onPreProcess: async (_ctx: NodeProcessContext) => true,
    onProcess: async (ctx: NodeProcessContext) => {
      return ctx.combinedInputContent || ctx.node.content || "";
    },
  };
}
