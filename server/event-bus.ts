/**
 * Event Bus — In-memory event queue with SSE support.
 *
 * Enables bidirectional communication between the Provocations canvas
 * and local Claude Code agents. Canvas nodes publish task events;
 * agents subscribe via SSE (or poll), process the work, and post
 * results back — which materialise as document nodes on the canvas.
 */

import type { Response } from "express";
import crypto from "crypto";

// ── Types ──

export interface CanvasEvent {
  id: string;
  canvasId: number;
  channel: string;
  type: "task" | "result" | "status";
  payload: {
    sourceNodeId: string;
    sourceNodeLabel: string;
    content: string;
    metadata?: Record<string, unknown>;
  };
  createdAt: string;
  consumedAt?: string;
  ttl: number; // ms
}

// ── In-memory stores ──

/** canvasId → events[] */
const eventQueues = new Map<number, CanvasEvent[]>();

/** canvasId → SSE subscribers */
const sseSubscribers = new Map<number, Set<{ channel: string; res: Response }>>();

const DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes

// ── Public API ──

export function publishEvent(
  canvasId: number,
  channel: string,
  type: CanvasEvent["type"],
  payload: CanvasEvent["payload"],
  ttl = DEFAULT_TTL,
): CanvasEvent {
  const event: CanvasEvent = {
    id: `evt_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`,
    canvasId,
    channel,
    type,
    payload,
    createdAt: new Date().toISOString(),
    ttl,
  };

  if (!eventQueues.has(canvasId)) {
    eventQueues.set(canvasId, []);
  }
  eventQueues.get(canvasId)!.push(event);

  // Notify SSE subscribers on matching channel
  const subs = sseSubscribers.get(canvasId);
  if (subs) {
    Array.from(subs).forEach((sub) => {
      if (sub.channel === channel || sub.channel === "*") {
        sub.res.write(`data: ${JSON.stringify(event)}\n\n`);
      }
    });
  }

  return event;
}

export function consumeEvents(
  canvasId: number,
  channel: string,
  since?: string,
): CanvasEvent[] {
  const queue = eventQueues.get(canvasId);
  if (!queue) return [];

  const now = Date.now();
  const matching = queue.filter((e) => {
    if (e.channel !== channel && channel !== "*") return false;
    if (e.consumedAt) return false;
    if (now - new Date(e.createdAt).getTime() > e.ttl) return false;
    if (since && e.id <= since) return false;
    return true;
  });

  return matching;
}

export function acknowledgeEvents(canvasId: number, eventIds: string[]): number {
  const queue = eventQueues.get(canvasId);
  if (!queue) return 0;

  let count = 0;
  const idSet = new Set(eventIds);
  for (const event of queue) {
    if (idSet.has(event.id) && !event.consumedAt) {
      event.consumedAt = new Date().toISOString();
      count++;
    }
  }
  return count;
}

export function getEvents(canvasId: number): CanvasEvent[] {
  return eventQueues.get(canvasId) || [];
}

export function addSSESubscriber(canvasId: number, channel: string, res: Response) {
  if (!sseSubscribers.has(canvasId)) {
    sseSubscribers.set(canvasId, new Set());
  }
  const sub = { channel, res };
  sseSubscribers.get(canvasId)!.add(sub);

  // Send initial connection confirmation
  res.write(`data: ${JSON.stringify({ type: "connected", canvasId, channel })}\n\n`);

  // Cleanup on close
  res.on("close", () => {
    sseSubscribers.get(canvasId)?.delete(sub);
    if (sseSubscribers.get(canvasId)?.size === 0) {
      sseSubscribers.delete(canvasId);
    }
  });
}

// ── Periodic cleanup of expired events ──

setInterval(() => {
  const now = Date.now();
  Array.from(eventQueues.entries()).forEach(([canvasId, queue]) => {
    const kept = queue.filter(
      (e: CanvasEvent) => now - new Date(e.createdAt).getTime() < e.ttl,
    );
    if (kept.length === 0) {
      eventQueues.delete(canvasId);
    } else {
      eventQueues.set(canvasId, kept);
    }
  });
}, 60_000);

// ── SSE keepalive (every 30s) ──

setInterval(() => {
  Array.from(sseSubscribers.values()).forEach((subs) => {
    Array.from(subs).forEach((sub) => {
      sub.res.write(":\n\n");
    });
  });
}, 30_000);
