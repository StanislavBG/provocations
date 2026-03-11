# Provocations Event Bus — Integration Reference

> For external projects integrating with the Provocations Flow Canvas event system.

## Overview

The event bus enables **bidirectional communication** between the Provocations Flow Canvas and external systems (local AI agents, The Office, other projects). Canvas nodes publish task events; external consumers subscribe via SSE or poll, process the work, and post results back — which materialize as document nodes on the canvas.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Flow Canvas (Browser)                                      │
│                                                             │
│  [Publish Node] ──► POST /api/events/publish (Clerk auth)  │
│  [Listen Node]  ◄── results appear as doc nodes             │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│  Provocations Server                                        │
│                                                             │
│  In-memory queue (Map<canvasId, CanvasEvent[]>)             │
│  + async write-behind to canvas_events DB table             │
│  + SSE push to subscribers                                  │
│  + 30s SSE keepalive                                        │
│  + startup replay from DB                                   │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│  External Consumer (your project)                           │
│                                                             │
│  Option A: SSE subscribe (real-time)                        │
│  Option B: Poll endpoint (fallback)                         │
│  Option C: MCP tools (Claude Code agents)                   │
│                                                             │
│  All require X-API-Key header                               │
└─────────────────────────────────────────────────────────────┘
```

## Authentication

### API Key Auth (for external systems)

All `/api/webhook/*` endpoints require the `X-API-Key` header.

| Header | Value |
|--------|-------|
| `X-API-Key` | Your API key (issued via Settings > API Keys in the Provo UI, or via `PROVOCATIONS_API_KEY` env var) |

Each key is bound to a Clerk user ID — requests through the key have the same ownership constraints as that user's browser session.

**Key management endpoints** (Clerk session auth, not API key):

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `POST /api/settings/api-keys` | POST | Create a new key. Returns plaintext **once**. |
| `GET /api/settings/api-keys` | GET | List your keys (prefix, label, scopes, status) |
| `PATCH /api/settings/api-keys/:id` | PATCH | Update label, scopes, canvasIds, expiry |
| `DELETE /api/settings/api-keys/:id` | DELETE | Revoke a key (soft delete) |

**Key format**: `prov_` + 32 hex chars. Store securely — it cannot be retrieved after creation.

**Scopes** (optional — `null` = full access):
- `canvas:read` — GET canvas/nodes/edges
- `canvas:write` — POST/PATCH/DELETE canvas nodes/edges
- `events:read` — poll/subscribe events
- `events:write` — publish events, post results
- `documents:read` — list/get documents
- `documents:write` — create/update documents
- `webhooks:outbound` — trigger outbound webhooks

**Canvas scoping** (optional): Restrict a key to specific canvas IDs.

### Agency Key Auth (for notification-only access)

Separate from the event bus. Uses `X-Agency-Key` header for `POST /api/notifications/send` and `/api/agency/*` endpoints. Configured via `AGENCY_API_KEY` + `AGENCY_USER_ID` env vars.

## Event Types

```typescript
interface CanvasEvent {
  id: string;                    // "evt_<timestamp>_<random>"
  canvasId: number;
  channel: string;               // e.g. "default", "research", "writing"
  type: "task" | "result" | "status";
  payload: {
    sourceNodeId: string;
    sourceNodeLabel: string;
    content: string;
    metadata?: Record<string, unknown>;
  };
  createdAt: string;             // ISO 8601
  consumedAt?: string;           // set when acknowledged
  ttl: number;                   // milliseconds (default: 300000 = 5 min)
}
```

| Type | Published By | Purpose |
|------|-------------|---------|
| `task` | Canvas (publish node) | Work for agents to pick up |
| `result` | Agent (via `/result` endpoint) | Completed work — creates doc node on canvas |
| `status` | Agent (via `/publish` endpoint) | Progress update — no doc node created |

## Event Bus Endpoints

All require `X-API-Key` header unless noted.

### Subscribe via SSE (real-time)

```
GET /api/webhook/events/:canvasId/subscribe?channel=default
```

Returns `text/event-stream`. Events are pushed as `data: {json}\n\n`. A keepalive comment (`: \n\n`) is sent every 30 seconds.

**Initial message** on connect:
```json
{"type": "connected", "canvasId": 42, "channel": "default"}
```

### Poll for Events

```
GET /api/webhook/events/:canvasId?channel=default&since=evt_xxx
```

Returns unconsumed, non-expired events. Use `since` parameter to paginate (pass the last event ID you processed).

```json
{
  "events": [
    {
      "id": "evt_1710000000000_a1b2c3d4",
      "canvasId": 42,
      "channel": "default",
      "type": "task",
      "payload": {
        "sourceNodeId": "node_abc",
        "sourceNodeLabel": "Research Brief",
        "content": "Research the competitive landscape for..."
      },
      "createdAt": "2026-03-11T10:00:00.000Z",
      "ttl": 300000
    }
  ]
}
```

### Acknowledge Events

```
POST /api/webhook/events/:canvasId/ack
Content-Type: application/json

{ "eventIds": ["evt_xxx", "evt_yyy"] }
```

Marks events as consumed so they don't appear in subsequent polls. Returns `{ "acknowledged": 2 }`.

### Publish Events (from agent)

```
POST /api/webhook/events/:canvasId/publish
Content-Type: application/json

{
  "channel": "default",
  "type": "status",
  "sourceNodeId": "agent-1",
  "sourceNodeLabel": "Research Agent",
  "content": "Found 12 competitor products, analyzing...",
  "metadata": { "progress": 0.5 }
}
```

### Post Result (creates doc node on canvas)

```
POST /api/webhook/events/:canvasId/result
Content-Type: application/json

{
  "channel": "default",
  "label": "Competitive Analysis",
  "content": "# Competitive Landscape\n\n...",
  "sourceEventId": "evt_xxx"
}
```

This is the key endpoint for closing the loop:
1. Creates a document node on the canvas adjacent to the listen node
2. Publishes a `result` event on the channel (so SSE subscribers see it)
3. Appends to the listen node's event log
4. Saves the updated canvas state

## Canvas CRUD Endpoints

Full programmatic access to canvas state. All require `X-API-Key`.

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `GET /api/webhook/canvas/:canvasId` | GET | Full canvas state (nodes + edges) |
| `GET /api/webhook/canvas/:canvasId/nodes` | GET | List all nodes |
| `GET /api/webhook/canvas/:canvasId/nodes/:nodeId` | GET | Get single node |
| `POST /api/webhook/canvas/:canvasId/nodes` | POST | Create node |
| `PATCH /api/webhook/canvas/:canvasId/nodes/:nodeId` | PATCH | Update node (partial patch) |
| `DELETE /api/webhook/canvas/:canvasId/nodes/:nodeId` | DELETE | Delete node + cascade edges |
| `GET /api/webhook/canvas/:canvasId/edges` | GET | List edges |
| `POST /api/webhook/canvas/:canvasId/edges` | POST | Create edge |
| `DELETE /api/webhook/canvas/:canvasId/edges/:edgeId` | DELETE | Delete edge |

### Document Store

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `GET /api/webhook/documents` | GET | List documents (optional `?folderId=`) |
| `GET /api/webhook/documents/:docId` | GET | Get document content |
| `POST /api/webhook/documents` | POST | Create document |
| `PUT /api/webhook/documents/:docId` | PUT | Update document |
| `GET /api/webhook/folders` | GET | List folders |

## Flow Canvas Node Behavior

### Publish Mode
- **Trigger**: Chain execution reaches the node, or manual "Publish Event" button
- **Input**: Upstream content from connected nodes
- **Action**: POSTs content as a `task` event on the configured channel
- **Output**: Event publication confirmation string
- **Requirement**: Canvas must be saved (has a canvasId) before publishing

### Listen Mode
- **Trigger**: External — never auto-processes
- **Behavior**: Passive listener. When an agent posts to `/result`, the server finds the listen node on that channel, creates a document node adjacent to it, and appends to the event log
- **Output**: Document nodes appear connected to the listen node
- **Log**: Last 20 events stored in `node.eventBusLog`

### Channel Pairing
Publish and listen nodes on the **same channel name** are paired. You can have multiple publish nodes feeding one channel, or one publish node with multiple listen nodes watching.

## MCP Integration

For Claude Code agents, use the MCP server instead of raw HTTP.

**.mcp.json configuration:**
```json
{
  "provocations": {
    "command": "npx",
    "args": ["tsx", "server/mcp-server.ts"],
    "env": {
      "PROVOCATIONS_URL": "http://localhost:5000",
      "PROVOCATIONS_API_KEY": "<your-key>"
    }
  }
}
```

**Available MCP tools:**
- `get_canvas(canvasId)` — Read full canvas state
- `list_nodes(canvasId)` / `get_node(canvasId, nodeId)`
- `create_node(canvasId, type, label, ...)` / `update_node(canvasId, nodeId, patch)`
- `delete_node(canvasId, nodeId)`
- `create_edge(canvasId, from, to, role?)` / `delete_edge(canvasId, edgeId)`
- `poll_events(canvasId, channel)` — Check for pending tasks
- `acknowledge_events(canvasId, eventIds)` — Mark consumed
- `post_result(canvasId, channel, label, content)` — Send results back

## Integration Checklist

1. **Get your API key**: Create one in Provo Settings > API Keys (or set `PROVOCATIONS_API_KEY` env var on server)
2. **Know your canvas ID**: Visible in the browser URL or via the canvas list endpoint
3. **Set up a publish node**: Add an Event Bus node to your canvas, set to Publish mode, name your channel
4. **Set up a listen node**: Add another Event Bus node, set to Listen mode, same channel name
5. **Connect your agent**: Subscribe via SSE or poll the channel for `task` events
6. **Process and respond**: When you get a task, do your work, then POST to `/result`
7. **Verify**: The result should appear as a document node on the canvas next to the listen node

## Environment Variables (Server-Side)

| Variable | Purpose |
|----------|---------|
| `PROVOCATIONS_API_KEY` | Legacy single API key (fallback if no DB key matches) |
| `PROVOCATIONS_USER_ID` | Clerk user ID bound to the legacy API key |
| `AGENCY_API_KEY` | Separate key for notification/agency endpoints |
| `AGENCY_USER_ID` | Clerk user ID for agency operations |
