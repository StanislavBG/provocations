/**
 * useLifecycleEngine — Central lifecycle manager for flow canvas nodes.
 *
 * Manages continuous node lifecycles (triggers) from FlowWorkspace,
 * replacing the scattered useEffects and refs that previously handled:
 * - Timed trigger intervals (was in FlowTimerEventNode component)
 * - Timed trigger output document creation (was a FlowWorkspace useEffect)
 * - Automated trigger upstream watcher (was another FlowWorkspace useEffect)
 *
 * Key improvement: intervals run in FlowWorkspace, not in render components,
 * so viewport culling (unmounting distant nodes) no longer kills active triggers.
 *
 * All lifecycle transitions are logged to lifecycleLogStore for observability.
 */

import { useEffect, useRef, useCallback, useMemo } from "react";
import type { FlowNode, FlowEdge, FlowNodeType } from "./useFlowCanvas";
import {
  canActivate,
  activate,
  deactivate,
  handleTick,
  updateOutputDocument,
  getNodeStatus,
  type TriggerContext,
  type TriggerInternalState,
} from "./lifecycles/timer";
import { lifecycleLogStore, type LifecyclePhase, type LifecycleStatus } from "@/lib/lifecycleLog";

/** Flag downstream audio nodes to auto-start recording when a trigger fires. */
function flagAudioNodes(
  triggerId: string,
  nodes: FlowNode[],
  edges: FlowEdge[],
  updateNode: (nodeId: string, patch: Partial<FlowNode>) => void,
) {
  const outputEdges = edges.filter((e) => e.fromNodeId === triggerId);
  for (const edge of outputEdges) {
    const target = nodes.find((n) => n.id === edge.toNodeId);
    if (!target) continue;
    if (target.type === "audio") {
      updateNode(target.id, { autoStartRecording: true });
    }
  }
}

// ── Types ──

interface LifecycleEngineOpts {
  nodes: FlowNode[];
  edges: FlowEdge[];
  updateNode: (nodeId: string, patch: Partial<FlowNode>) => void;
  addNode: (type: FlowNodeType, x: number, y: number, data: Partial<FlowNode> & { label: string }) => string;
  addEdge: (fromId: string, toId: string) => string;
  toast: (opts: { title: string; description?: string; variant?: "default" | "destructive" }) => void;
  /** Execute a downstream node (chain propagation). */
  executeNode: (nodeId: string) => void;
}

interface ActiveInterval {
  intervalId: number;
  internal: TriggerInternalState;
}

// ── Logging helper ──

function log(
  node: FlowNode,
  phase: LifecyclePhase,
  status: LifecycleStatus,
  message: string,
  extra?: { durationMs?: number; downstreamIds?: string[]; error?: string },
) {
  lifecycleLogStore.push({
    phase,
    status,
    nodeId: node.id,
    nodeType: node.type,
    nodeLabel: node.label || node.type,
    message,
    ...extra,
  });
}

// ── Hook ──

export function useLifecycleEngine(opts: LifecycleEngineOpts) {
  const { updateNode, addNode, addEdge, toast, executeNode } = opts;

  // Fresh state ref for interval callbacks (avoids stale closures)
  const stateRef = useRef({ nodes: opts.nodes, edges: opts.edges });
  stateRef.current = { nodes: opts.nodes, edges: opts.edges };

  // Stable mutations ref (these callbacks change identity on renders)
  const mutRef = useRef({ updateNode, addNode, addEdge, toast, executeNode });
  mutRef.current = { updateNode, addNode, addEdge, toast, executeNode };

  // Active timed intervals: nodeId → { intervalId, internal state }
  const intervalsRef = useRef<Map<string, ActiveInterval>>(new Map());

  // Timed output document tracking: triggerId → docNodeId
  const docMapRef = useRef<Map<string, string>>(new Map());

  // Automated mode: last-seen upstream status: "triggerId:inputId" → status
  const automatedLastSeenRef = useRef<Map<string, string>>(new Map());

  // ── Helper: build TriggerContext from current state ──
  const buildCtx = useCallback((nodeId: string): TriggerContext | null => {
    const { nodes, edges } = stateRef.current;
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return null;
    return {
      node,
      allNodes: nodes,
      allEdges: edges,
      updateNode: mutRef.current.updateNode,
      addNode: mutRef.current.addNode as TriggerContext["addNode"],
      addEdge: mutRef.current.addEdge,
    };
  }, []);

  // ── Derive a fingerprint of trigger-relevant config ──
  // Only changes when trigger nodes are added/removed, or their
  // timerRunning/triggerMode/timerInterval changes. NOT when pulse count changes.
  const triggerFingerprint = useMemo(() => {
    return opts.nodes
      .filter((n) => n.type === "timer-event")
      .map((n) => `${n.id}|${n.timerRunning}|${n.triggerMode}|${n.timerInterval}`)
      .join("~");
  }, [opts.nodes]);

  // ── Reconcile timed trigger intervals ──
  useEffect(() => {
    const { nodes } = stateRef.current;
    const triggerNodes = nodes.filter((n) => n.type === "timer-event");
    const active = intervalsRef.current;

    // Determine which nodes SHOULD have an active interval
    const shouldBeActive = new Set<string>();

    for (const node of triggerNodes) {
      const mode = node.triggerMode || "timed";
      if (mode === "timed" && node.timerRunning) {
        shouldBeActive.add(node.id);

        // Start interval if not already running
        if (!active.has(node.id)) {
          const internal: TriggerInternalState = {
            pulseCount: node.timerPulseCount || 0,
            content: node.content || "",
          };

          const intervalMs = node.timerInterval || 5000;
          const intervalId = window.setInterval(() => {
            const t0 = performance.now();
            const ctx = buildCtx(node.id);
            if (!ctx) return;

            // Pre-process: always succeeds for timed triggers
            log(ctx.node, "pre-process", "success", `Timed pulse ready (interval ${intervalMs}ms)`);

            // Process: handle the tick
            const downstream = handleTick(ctx, { kind: "timed" }, internal);
            const elapsed = Math.round(performance.now() - t0);
            log(ctx.node, "tick", "success", `Pulse #${internal.pulseCount}`, { durationMs: elapsed });

            // Post-process: update output document
            const freshCtx = buildCtx(node.id);
            if (freshCtx) {
              updateOutputDocument(freshCtx, docMapRef.current);
              log(freshCtx.node, "post-process", "success", "Output document updated");
            }

            // Flag downstream audio nodes for auto-start recording
            const { nodes: latestNodes, edges: latestEdges } = stateRef.current;
            flagAudioNodes(node.id, latestNodes, latestEdges, mutRef.current.updateNode);

            // Chain propagation
            if (downstream.length > 0) {
              log(ctx.node, "chain", "start", `Propagating to ${downstream.length} downstream node(s)`, { downstreamIds: downstream });
              for (const id of downstream) {
                setTimeout(() => mutRef.current.executeNode(id), 100);
              }
            }
          }, intervalMs);

          active.set(node.id, { intervalId, internal });
        }
      }
    }

    // Stop intervals that shouldn't be active (stopped, deleted, mode changed)
    Array.from(active.entries()).forEach(([nodeId, entry]) => {
      if (!shouldBeActive.has(nodeId)) {
        clearInterval(entry.intervalId);
        active.delete(nodeId);
      }
    });
  }, [triggerFingerprint, buildCtx]);

  // Cleanup all intervals on unmount
  useEffect(() => {
    return () => {
      Array.from(intervalsRef.current.values()).forEach((entry) => {
        clearInterval(entry.intervalId);
      });
      intervalsRef.current.clear();
    };
  }, []);

  // ── Automated trigger: watch for upstream node completion ──
  useEffect(() => {
    const { nodes, edges } = stateRef.current;

    for (const node of nodes) {
      if (node.type !== "timer-event") continue;
      if ((node.triggerMode || "timed") !== "automated") continue;
      if (!node.timerRunning) continue;

      const inputEdges = edges.filter((e) => e.toNodeId === node.id);
      for (const edge of inputEdges) {
        const inputNode = nodes.find((n) => n.id === edge.fromNodeId);
        if (!inputNode) continue;

        const status = getNodeStatus(inputNode);
        const key = `${node.id}:${inputNode.id}`;
        const lastSeen = automatedLastSeenRef.current.get(key);

        if (status === "done" && lastSeen !== "done") {
          // Upstream just completed — fire the trigger
          automatedLastSeenRef.current.set(key, "done");

          const ctx = buildCtx(node.id);
          if (!ctx) continue;

          log(ctx.node, "pre-process", "success", `Upstream "${inputNode.label}" completed`);

          // Use a per-fire internal state (automated doesn't accumulate like timed)
          const internal: TriggerInternalState = {
            pulseCount: node.timerPulseCount || 0,
            content: node.content || "",
          };

          const t0 = performance.now();
          const downstream = handleTick(
            ctx,
            { kind: "automated", triggerSource: inputNode },
            internal,
          );
          const elapsed = Math.round(performance.now() - t0);
          log(ctx.node, "tick", "success", `Fired by "${inputNode.label}"`, { durationMs: elapsed });

          // Flag downstream audio nodes for auto-start recording
          const { nodes: latestNodes2, edges: latestEdges2 } = stateRef.current;
          flagAudioNodes(node.id, latestNodes2, latestEdges2, mutRef.current.updateNode);

          // Chain propagation
          if (downstream.length > 0) {
            log(ctx.node, "chain", "start", `Propagating to ${downstream.length} downstream node(s)`, { downstreamIds: downstream });
            for (const id of downstream) {
              setTimeout(() => mutRef.current.executeNode(id), 300);
            }
          }
        } else if (status !== "done") {
          // Reset tracking when upstream goes back to non-done
          automatedLastSeenRef.current.set(key, status);
        }
      }
    }
  }, [opts.nodes, opts.edges, buildCtx]);

  // ── Public API ──

  const toggleTrigger = useCallback((nodeId: string) => {
    const ctx = buildCtx(nodeId);
    if (!ctx) return;

    if (ctx.node.timerRunning) {
      // Deactivate
      deactivate(ctx);
      log(ctx.node, "deactivate", "success", `Trigger stopped (${ctx.node.timerPulseCount || 0} total ${(ctx.node.triggerMode || "timed") === "timed" ? "pulses" : "fires"})`);

      // Stop interval if it exists
      const entry = intervalsRef.current.get(nodeId);
      if (entry) {
        clearInterval(entry.intervalId);
        intervalsRef.current.delete(nodeId);
      }
    } else {
      // Validate before activating
      const check = canActivate(ctx);
      if (!check.valid) {
        log(ctx.node, "activate", "error", check.reason || "Validation failed", { error: check.reason });
        mutRef.current.toast({
          title: "Cannot activate trigger",
          description: check.reason,
        });
        return;
      }
      activate(ctx);
      log(ctx.node, "activate", "success", `Trigger started in ${ctx.node.triggerMode || "timed"} mode`);
      // The interval will be started by the triggerFingerprint useEffect
      // on the next render when timerRunning becomes true.
    }
  }, [buildCtx]);

  return { toggleTrigger };
}
