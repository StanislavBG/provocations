/**
 * Canvas Collaboration — WebSocket-based real-time canvas sync.
 *
 * Architecture:
 *  - Each canvas document is a "room" (identified by document ID)
 *  - When a user opens a canvas, they join the room via WebSocket
 *  - Operations (add/move/delete node, add/delete edge, etc.) are broadcast to all room members
 *  - Canvas state is periodically auto-saved to the database
 *  - The room stays alive as long as any participant is connected
 *  - Presence tracking shows who's online
 */

import { WebSocketServer, WebSocket } from "ws";
import type { Server as HTTPServer } from "http";
import type { IncomingMessage } from "http";
import { log } from "./index";

// ── Types ──

interface CanvasOperation {
  type:
    | "add-node"
    | "update-node"
    | "move-node"
    | "move-nodes"
    | "delete-node"
    | "add-edge"
    | "delete-edge"
    | "viewport"
    | "full-sync"
    | "cursor";
  payload: Record<string, unknown>;
  senderId: string;
  timestamp: number;
}

interface RoomMember {
  ws: WebSocket;
  userId: string;
  displayName: string;
  cursorX?: number;
  cursorY?: number;
  joinedAt: number;
}

interface Room {
  canvasId: number;
  members: Map<string, RoomMember>; // keyed by odersIdconnectionId (unique per socket)
  /** Buffered operations for batch save */
  pendingOps: number;
  lastSaveAt: number;
  /** Latest full state (set by host on join or periodic sync) */
  latestState?: string;
}

// ── State ──

const rooms = new Map<number, Room>();

/** Auto-save interval: 30 seconds */
const AUTO_SAVE_INTERVAL = 30_000;

/** Save callback — set by the caller (routes.ts) */
let saveCanvasCallback: ((canvasId: number, content: string) => Promise<void>) | null = null;

export function setSaveCanvasCallback(cb: (canvasId: number, content: string) => Promise<void>) {
  saveCanvasCallback = cb;
}

// ── Room management ──

function getOrCreateRoom(canvasId: number): Room {
  let room = rooms.get(canvasId);
  if (!room) {
    room = {
      canvasId,
      members: new Map(),
      pendingOps: 0,
      lastSaveAt: Date.now(),
    };
    rooms.set(canvasId, room);
    log(`Canvas room ${canvasId} created`, "ws");
  }
  return room;
}

function broadcastToRoom(room: Room, message: object, excludeConnectionId?: string) {
  const data = JSON.stringify(message);
  const entries = Array.from(room.members.entries());
  for (const [connId, member] of entries) {
    if (connId === excludeConnectionId) continue;
    if (member.ws.readyState === WebSocket.OPEN) {
      member.ws.send(data);
    }
  }
}

function getPresenceList(room: Room): { userId: string; displayName: string }[] {
  const seen = new Set<string>();
  const list: { userId: string; displayName: string }[] = [];
  const members = Array.from(room.members.values());
  for (const member of members) {
    if (!seen.has(member.userId)) {
      seen.add(member.userId);
      list.push({ userId: member.userId, displayName: member.displayName });
    }
  }
  return list;
}

function removeMember(room: Room, connectionId: string) {
  const member = room.members.get(connectionId);
  if (!member) return;
  room.members.delete(connectionId);
  log(`User ${member.displayName} left canvas ${room.canvasId} (${room.members.size} remaining)`, "ws");

  // Broadcast updated presence
  broadcastToRoom(room, {
    type: "presence",
    members: getPresenceList(room),
  });

  // Clean up empty rooms
  if (room.members.size === 0) {
    // Save state before room is destroyed
    if (room.latestState && saveCanvasCallback) {
      saveCanvasCallback(room.canvasId, room.latestState).catch(() => {});
    }
    rooms.delete(room.canvasId);
    log(`Canvas room ${room.canvasId} destroyed (empty)`, "ws");
  }
}

// ── Auto-save ──

async function autoSaveRoom(room: Room) {
  if (!room.latestState || !saveCanvasCallback) return;
  if (room.pendingOps === 0) return;

  try {
    await saveCanvasCallback(room.canvasId, room.latestState);
    room.pendingOps = 0;
    room.lastSaveAt = Date.now();
    log(`Canvas ${room.canvasId} auto-saved`, "ws");
  } catch (err) {
    log(`Canvas ${room.canvasId} auto-save failed: ${err}`, "ws");
  }
}

// Periodic auto-save for all rooms
setInterval(() => {
  const allRooms = Array.from(rooms.values());
  for (const room of allRooms) {
    autoSaveRoom(room);
  }
}, AUTO_SAVE_INTERVAL);

// ── WebSocket server setup ──

let connectionCounter = 0;

export function setupCanvasWebSocket(server: HTTPServer) {
  const wss = new WebSocketServer({ noServer: true });

  // Handle HTTP upgrade for /ws/canvas
  server.on("upgrade", (request: IncomingMessage, socket, head) => {
    const url = new URL(request.url || "", `http://${request.headers.host}`);

    if (url.pathname !== "/ws/canvas") {
      // Not our route — let other handlers (e.g., Vite HMR) handle it
      return;
    }

    const canvasId = parseInt(url.searchParams.get("canvasId") || "0", 10);
    const userId = url.searchParams.get("userId") || "";
    const displayName = url.searchParams.get("displayName") || "Anonymous";

    if (!canvasId || !userId) {
      socket.write("HTTP/1.1 400 Bad Request\r\n\r\n");
      socket.destroy();
      return;
    }

    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit("connection", ws, request, { canvasId, userId, displayName });
    });
  });

  wss.on("connection", (ws: WebSocket, _req: IncomingMessage, meta: { canvasId: number; userId: string; displayName: string }) => {
    const connectionId = `conn_${++connectionCounter}`;
    const room = getOrCreateRoom(meta.canvasId);

    const member: RoomMember = {
      ws,
      userId: meta.userId,
      displayName: meta.displayName,
      joinedAt: Date.now(),
    };

    room.members.set(connectionId, member);
    log(`User ${meta.displayName} joined canvas ${meta.canvasId} (${room.members.size} members)`, "ws");

    // Send current presence to the new member
    ws.send(JSON.stringify({
      type: "presence",
      members: getPresenceList(room),
    }));

    // If room has state, send it to the new member
    if (room.latestState) {
      ws.send(JSON.stringify({
        type: "full-sync",
        payload: { state: room.latestState },
        senderId: "server",
        timestamp: Date.now(),
      }));
    }

    // Broadcast presence update to existing members
    broadcastToRoom(room, {
      type: "presence",
      members: getPresenceList(room),
    }, connectionId);

    // Handle incoming messages
    ws.on("message", (data) => {
      try {
        const msg = JSON.parse(data.toString()) as CanvasOperation;

        // If it's a full-sync from the host, store it
        if (msg.type === "full-sync" && msg.payload.state) {
          room.latestState = msg.payload.state as string;
          room.pendingOps++;
        }

        // Store state snapshots from operations
        if (msg.type !== "cursor" && msg.type !== "viewport") {
          room.pendingOps++;
          // If the message includes a state snapshot, store it
          if (msg.payload.stateSnapshot) {
            room.latestState = msg.payload.stateSnapshot as string;
          }
        }

        // Broadcast to all other room members
        broadcastToRoom(room, {
          ...msg,
          senderId: meta.userId,
          timestamp: Date.now(),
        }, connectionId);
      } catch {
        // Ignore malformed messages
      }
    });

    ws.on("close", () => {
      removeMember(room, connectionId);
    });

    ws.on("error", () => {
      removeMember(room, connectionId);
    });
  });

  log("Canvas WebSocket server initialized on /ws/canvas", "ws");
  return wss;
}

// ── Stats ──

export function getCollabStats() {
  const roomStats: { canvasId: number; memberCount: number; pendingOps: number; lastSaveAt: number }[] = [];
  const entries = Array.from(rooms.entries());
  for (const [canvasId, room] of entries) {
    roomStats.push({
      canvasId,
      memberCount: room.members.size,
      pendingOps: room.pendingOps,
      lastSaveAt: room.lastSaveAt,
    });
  }
  return { activeRooms: rooms.size, rooms: roomStats };
}
