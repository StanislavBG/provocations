/**
 * Event Bus — In-memory event queue with SSE support and DB persistence.
 *
 * Enables bidirectional communication between the Provocations canvas
 * and local Claude Code agents. Canvas nodes publish task events;
 * agents subscribe via SSE (or poll), process the work, and post
 * results back — which materialise as document nodes on the canvas.
 *
 * The in-memory Map is the hot path for low-latency SSE delivery.
 * Events are asynchronously written to the canvas_events DB table
 * for durability across server restarts. On startup, unconsumed
 * events are replayed from DB into memory.
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

// ── Write-behind persistence ──

/** Fire-and-forget DB insert. Errors are logged, never thrown. */
async function persistEvent(event: CanvasEvent): Promise<void> {
  try {
    const { storage } = await import("./storage");
    await storage.insertCanvasEvent({
      eventId: event.id,
      canvasId: event.canvasId,
      channel: event.channel,
      eventType: event.type,
      payload: JSON.stringify(event.payload),
      ttlMs: event.ttl,
    });
  } catch (err) {
    console.error("[event-bus] Failed to persist event:", event.id, err instanceof Error ? err.message : err);
  }
}

/** Fire-and-forget DB acknowledge. */
async function persistAcknowledge(eventIds: string[]): Promise<void> {
  try {
    const { storage } = await import("./storage");
    await storage.bulkAcknowledgeCanvasEvents(eventIds);
  } catch (err) {
    console.error("[event-bus] Failed to persist acknowledge:", err instanceof Error ? err.message : err);
  }
}

// ── Initialization (call after ensureTables) ──

export async function initEventBus(): Promise<void> {
  try {
    const { storage } = await import("./storage");
    const rows = await storage.loadUnconsumedCanvasEvents();
    let replayed = 0;
    for (const row of rows) {
      let payload: CanvasEvent["payload"];
      try {
        payload = JSON.parse(row.payload);
      } catch {
        continue; // skip rows with corrupt payload
      }
      const event: CanvasEvent = {
        id: row.eventId,
        canvasId: row.canvasId,
        channel: row.channel,
        type: row.eventType as CanvasEvent["type"],
        payload,
        createdAt: row.createdAt.toISOString(),
        ttl: row.ttlMs,
      };
      if (!eventQueues.has(row.canvasId)) {
        eventQueues.set(row.canvasId, []);
      }
      eventQueues.get(row.canvasId)!.push(event);
      replayed++;
    }
    if (replayed > 0) {
      console.log(`[event-bus] Replayed ${replayed} unconsumed events from DB.`);
    }
  } catch (err) {
    console.warn("[event-bus] Failed to replay events from DB (table may not exist yet):", err instanceof Error ? err.message : err);
  }
}

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

  // Write-behind: persist to DB asynchronously (don't await)
  void persistEvent(event);

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
  const acknowledged: string[] = [];
  const idSet = new Set(eventIds);
  for (const event of queue) {
    if (idSet.has(event.id) && !event.consumedAt) {
      event.consumedAt = new Date().toISOString();
      acknowledged.push(event.id);
      count++;
    }
  }

  // Write-behind: persist acknowledge to DB
  if (acknowledged.length > 0) {
    void persistAcknowledge(acknowledged);
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

// ── Periodic cleanup of expired events (in-memory) ──

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

// ── Periodic DB cleanup of expired events (every 5 minutes) ──

setInterval(async () => {
  try {
    const { storage } = await import("./storage");
    const purged = await storage.purgeExpiredCanvasEvents();
    if (purged > 0) {
      console.log(`[event-bus] Purged ${purged} expired events from DB.`);
    }
  } catch {
    // Non-fatal — DB may be unavailable
  }
}, 5 * 60_000);

// ── SSE keepalive (every 30s) ──

setInterval(() => {
  Array.from(sseSubscribers.values()).forEach((subs) => {
    Array.from(subs).forEach((sub) => {
      sub.res.write(":\n\n");
    });
  });
}, 30_000);
