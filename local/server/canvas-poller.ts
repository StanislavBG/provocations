/**
 * Canvas Event Bus Poller
 *
 * Polls the Provocations canvas event bus for tasks dispatched to Bilko.
 * When events arrive, dispatches the agent and posts results back to the canvas.
 */
import { dispatch, isAgentRunning } from "./scheduler.js";
import { insertCanvasEvent } from "./store.js";
import { bus } from "./events.js";

interface CanvasEvent {
  id: string;
  channel: string;
  type: string;
  payload: {
    sourceNodeId?: string;
    sourceNodeLabel?: string;
    content?: string;
    [key: string]: unknown;
  };
  publishedAt: string;
}

const POLL_INTERVAL_MS = 2000; // 2 seconds — near-instant detection
let timer: ReturnType<typeof setInterval> | null = null;
let polling = false;
const seenEventIds = new Set<string>(); // Prevent duplicate DB inserts for unacked retries

function getConfig() {
  const url = process.env.PROVOCATIONS_URL || "https://provocations.app";
  const apiKey = process.env.PROVOCATIONS_API_KEY || "";
  const canvasIds = (process.env.CANVAS_IDS || "222").split(",").map((s) => s.trim()).filter(Boolean);
  return { url, apiKey, canvasIds };
}

async function pollCanvas(canvasId: string, channel: string): Promise<CanvasEvent[]> {
  const { url, apiKey } = getConfig();
  const endpoint = `${url}/api/webhook/events/${canvasId}?channel=${encodeURIComponent(channel)}`;

  const res = await fetch(endpoint, {
    headers: { "x-api-key": apiKey },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Poll failed (${res.status}): ${text}`);
  }

  const data = await res.json() as { events?: CanvasEvent[] };
  return data.events || [];
}

async function ackEvents(canvasId: string, eventIds: string[]): Promise<void> {
  const { url, apiKey } = getConfig();
  const endpoint = `${url}/api/webhook/events/${canvasId}/ack`;

  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "x-api-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({ eventIds }),
  });

  if (!res.ok) {
    console.warn(`[canvas-poller] Ack failed (${res.status})`);
  }
}

async function postResult(canvasId: string, channel: string, label: string, content: string, sourceEventId?: string): Promise<void> {
  const { url, apiKey } = getConfig();
  const endpoint = `${url}/api/webhook/events/${canvasId}/result`;

  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "x-api-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({ channel, label, content, sourceEventId }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.warn(`[canvas-poller] Post result failed (${res.status}): ${text}`);
  }
}

async function tick(): Promise<void> {
  if (polling) return; // Skip if previous tick still running
  polling = true;

  try {
    const { canvasIds } = getConfig();

    for (const canvasId of canvasIds) {
      const allEvents = await pollCanvas(canvasId, "bilko");

      // Only process task events — ignore result/status events to prevent feedback loops
      const events = allEvents.filter((e) => e.type === "task");

      // Ack non-task events immediately so they don't accumulate
      const nonTaskIds = allEvents.filter((e) => e.type !== "task").map((e) => e.id);
      if (nonTaskIds.length > 0) {
        await ackEvents(canvasId, nonTaskIds);
      }

      if (events.length === 0) continue;

      // Only log truly new events (not retries of unacked events)
      const newEvents = events.filter((e) => !seenEventIds.has(e.id));
      if (newEvents.length > 0) {
        console.log(`[canvas-poller] ${newEvents.length} new task event(s) on canvas ${canvasId} channel "bilko"`);
        for (const evt of newEvents) {
          seenEventIds.add(evt.id);
          insertCanvasEvent({
            canvas_id: parseInt(canvasId, 10),
            event_type: "task_received",
            agent_id: "bilko",
            run_id: null,
            node_id: evt.payload.sourceNodeId || null,
            payload: JSON.stringify(evt),
          });
        }
        bus.broadcast("agent:status", { agentId: "bilko", status: "task_received", eventCount: newEvents.length });
      }

      // If Bilko is already running, skip dispatch but don't ack (retry next tick)
      if (isAgentRunning("bilko")) {
        if (newEvents.length > 0) {
          console.log("[canvas-poller] Bilko already running, will retry next tick");
        }
        continue;
      }

      // Dispatch Bilko
      try {
        console.log("[canvas-poller] Dispatching Bilko for canvas task...");
        const runId = await dispatch("bilko", "canvas_task");
        console.log(`[canvas-poller] Bilko dispatched, run #${runId}`);

        // Ack events immediately so they don't re-fire
        const eventIds = events.map((e) => e.id);
        await ackEvents(canvasId, eventIds);
        console.log(`[canvas-poller] Acknowledged ${eventIds.length} events`);

        // Post a quick acknowledgment result back to canvas
        const taskContent = events.map((e) => e.payload.content || "task").join("; ");
        await postResult(
          canvasId,
          "bilko",
          `Bilko — Run #${runId}`,
          `Bilko received task and is processing.\n\nTrigger: ${taskContent}\nRun ID: ${runId}\nStarted: ${new Date().toISOString()}`,
          events[0].id,
        );
        console.log("[canvas-poller] Posted acknowledgment to canvas");

      } catch (err) {
        console.error("[canvas-poller] Dispatch error:", (err as Error).message);
        // Don't ack — let events retry next tick
      }
    }
  } catch (err) {
    // Silence network errors during polling (server might be temporarily unavailable)
    const msg = (err as Error).message;
    if (!msg.includes("fetch failed") && !msg.includes("ECONNREFUSED")) {
      console.error("[canvas-poller] Poll error:", msg);
    }
  } finally {
    polling = false;
  }
}

export function startCanvasPoller(): void {
  const { apiKey, canvasIds } = getConfig();

  if (!apiKey) {
    console.log("  Canvas poller: SKIPPED (no PROVOCATIONS_API_KEY)");
    return;
  }

  if (canvasIds.length === 0) {
    console.log("  Canvas poller: SKIPPED (no CANVAS_IDS)");
    return;
  }

  timer = setInterval(tick, POLL_INTERVAL_MS);
  // Fire first tick immediately
  tick();

  console.log(`  Canvas poller: monitoring canvas ${canvasIds.join(", ")} channel "bilko" every ${POLL_INTERVAL_MS / 1000}s`);
}

export function stopCanvasPoller(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  console.log("[canvas-poller] Stopped");
}
