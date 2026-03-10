#!/usr/bin/env node
/**
 * MCP Server for Provocations Canvas.
 *
 * Exposes canvas CRUD operations as MCP tools so Claude Code
 * can read from and write to the Provocations flow canvas.
 *
 * Configuration (via environment variables):
 *   PROVOCATIONS_URL     — Base URL of the Provocations server (default: http://localhost:5000)
 *   PROVOCATIONS_API_KEY — API key for webhook authentication
 *
 * The server also requires PROVOCATIONS_USER_ID on the Provocations server side,
 * which binds the API key to a Clerk user ID for ownership enforcement.
 *
 * Usage in .mcp.json:
 *   {
 *     "provocations": {
 *       "command": "npx",
 *       "args": ["tsx", "server/mcp-server.ts"],
 *       "env": {
 *         "PROVOCATIONS_URL": "http://localhost:5000",
 *         "PROVOCATIONS_API_KEY": "<your-key>"
 *       }
 *     }
 *   }
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const BASE_URL = process.env.PROVOCATIONS_URL || "http://localhost:5000";
const API_KEY = process.env.PROVOCATIONS_API_KEY || "";

// ── HTTP helpers ──

async function apiCall(method: string, path: string, body?: unknown): Promise<unknown> {
  const url = `${BASE_URL}${path}`;
  const headers: Record<string, string> = {
    "X-API-Key": API_KEY,
    "Content-Type": "application/json",
  };

  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`API ${method} ${path} failed (${res.status}): ${text}`);
  }

  return res.json();
}

// ── MCP Server ──

const server = new McpServer({
  name: "provocations-canvas",
  version: "1.0.0",
});

// Tool: get_canvas
server.tool(
  "get_canvas",
  "Get full canvas state including all nodes and edges",
  { canvasId: z.number().describe("Document ID of the canvas") },
  async ({ canvasId }) => {
    const data = await apiCall("GET", `/api/webhook/canvas/${canvasId}`);
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
  },
);

// Tool: list_nodes
server.tool(
  "list_nodes",
  "List all nodes on a canvas",
  { canvasId: z.number().describe("Document ID of the canvas") },
  async ({ canvasId }) => {
    const data = await apiCall("GET", `/api/webhook/canvas/${canvasId}/nodes`);
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
  },
);

// Tool: get_node
server.tool(
  "get_node",
  "Get a single node with full content",
  {
    canvasId: z.number().describe("Document ID of the canvas"),
    nodeId: z.string().describe("ID of the node"),
  },
  async ({ canvasId, nodeId }) => {
    const data = await apiCall("GET", `/api/webhook/canvas/${canvasId}/nodes/${nodeId}`);
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
  },
);

// Tool: create_node
server.tool(
  "create_node",
  "Create a new node on the canvas. Available types: context-doc, research, interview, llm, painter, timeline, social-post, api-connection, notification, approval, llm-base, document, timer, logic, store, coherence, youtube, media",
  {
    canvasId: z.number().describe("Document ID of the canvas"),
    type: z.string().describe("Node type (e.g., 'llm', 'document', 'research', 'context-doc')"),
    label: z.string().describe("Display label for the node"),
    content: z.string().optional().describe("Text content or snippet for the node"),
    documentContent: z.string().optional().describe("Full document content (for document-type nodes)"),
    x: z.number().optional().describe("X position on canvas (default: 200)"),
    y: z.number().optional().describe("Y position on canvas (default: 200)"),
  },
  async ({ canvasId, type, label, content, documentContent, x, y }) => {
    const data = await apiCall("POST", `/api/webhook/canvas/${canvasId}/nodes`, {
      type,
      label,
      content,
      documentContent,
      x,
      y,
    });
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
  },
);

// Tool: update_node
server.tool(
  "update_node",
  "Update a node's properties (content, label, documentContent, status, etc.)",
  {
    canvasId: z.number().describe("Document ID of the canvas"),
    nodeId: z.string().describe("ID of the node to update"),
    patch: z.record(z.unknown()).describe("Object with properties to update (e.g., { content: '...', label: '...' })"),
  },
  async ({ canvasId, nodeId, patch }) => {
    const data = await apiCall("PATCH", `/api/webhook/canvas/${canvasId}/nodes/${nodeId}`, { patch });
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
  },
);

// Tool: delete_node
server.tool(
  "delete_node",
  "Delete a node and its connected edges",
  {
    canvasId: z.number().describe("Document ID of the canvas"),
    nodeId: z.string().describe("ID of the node to delete"),
  },
  async ({ canvasId, nodeId }) => {
    const data = await apiCall("DELETE", `/api/webhook/canvas/${canvasId}/nodes/${nodeId}`);
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
  },
);

// Tool: create_edge
server.tool(
  "create_edge",
  "Connect two nodes with an edge. Optional role: 'context', 'objective', 'output-format', 'system-instruction'",
  {
    canvasId: z.number().describe("Document ID of the canvas"),
    fromNodeId: z.string().describe("Source node ID"),
    toNodeId: z.string().describe("Target node ID"),
    role: z.string().optional().describe("Edge role (context, objective, output-format, system-instruction)"),
  },
  async ({ canvasId, fromNodeId, toNodeId, role }) => {
    const data = await apiCall("POST", `/api/webhook/canvas/${canvasId}/edges`, {
      fromNodeId,
      toNodeId,
      role,
    });
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
  },
);

// Tool: delete_edge
server.tool(
  "delete_edge",
  "Remove a connection between two nodes",
  {
    canvasId: z.number().describe("Document ID of the canvas"),
    edgeId: z.string().describe("ID of the edge to delete"),
  },
  async ({ canvasId, edgeId }) => {
    const data = await apiCall("DELETE", `/api/webhook/canvas/${canvasId}/edges/${edgeId}`);
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
  },
);

// Tool: read_node_inputs
server.tool(
  "read_node_inputs",
  "Get the combined content flowing into a node via its input edges",
  {
    canvasId: z.number().describe("Document ID of the canvas"),
    nodeId: z.string().describe("ID of the target node"),
  },
  async ({ canvasId, nodeId }) => {
    // Fetch full canvas, find input edges, gather source content
    const canvas = (await apiCall("GET", `/api/webhook/canvas/${canvasId}`)) as {
      nodes: Array<Record<string, unknown>>;
      edges: Array<{ fromNodeId: string; toNodeId: string; role?: string }>;
    };

    const inputEdges = canvas.edges.filter((e) => e.toNodeId === nodeId);
    const inputs = inputEdges.map((edge) => {
      const sourceNode = canvas.nodes.find((n) => n.id === edge.fromNodeId);
      return {
        fromNodeId: edge.fromNodeId,
        role: edge.role || "default",
        label: sourceNode?.label || "Unknown",
        content: (sourceNode?.documentContent as string) || (sourceNode?.content as string) || "",
      };
    });

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({ nodeId, inputs }, null, 2),
        },
      ],
    };
  },
);

// ══════════════════════════════════════════════════════════════════
// Document Store tools
// ══════════════════════════════════════════════════════════════════

// Tool: list_documents
server.tool(
  "list_documents",
  "List all documents in the Context Store (scoped to the authenticated user)",
  {
    folderId: z.number().optional().describe("Filter by folder ID (omit for all documents)"),
  },
  async ({ folderId }) => {
    const params = new URLSearchParams();
    if (folderId !== undefined) params.set("folderId", String(folderId));
    const qs = params.toString();
    const data = await apiCall("GET", `/api/webhook/documents${qs ? `?${qs}` : ""}`);
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
  },
);

// Tool: get_document
server.tool(
  "get_document",
  "Get a document's full content from the Context Store",
  {
    docId: z.number().describe("Document ID"),
  },
  async ({ docId }) => {
    const data = await apiCall("GET", `/api/webhook/documents/${docId}`);
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
  },
);

// Tool: save_document
server.tool(
  "save_document",
  "Save a new document to the Context Store (owned by the authenticated user)",
  {
    title: z.string().describe("Document title"),
    content: z.string().describe("Document content (text or markdown)"),
    folderId: z.number().optional().describe("Destination folder ID (omit for root)"),
    docType: z.string().optional().describe("Document type: document, note, image, chart, etc."),
  },
  async ({ title, content, folderId, docType }) => {
    const data = await apiCall("POST", `/api/webhook/documents`, {
      title,
      content,
      folderId,
      docType,
    });
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
  },
);

// Tool: update_document
server.tool(
  "update_document",
  "Update an existing document's title and content",
  {
    docId: z.number().describe("Document ID to update"),
    title: z.string().describe("New document title"),
    content: z.string().describe("New document content"),
  },
  async ({ docId, title, content }) => {
    const data = await apiCall("PUT", `/api/webhook/documents/${docId}`, { title, content });
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
  },
);

// Tool: list_folders
server.tool(
  "list_folders",
  "List all folders in the Context Store (scoped to the authenticated user)",
  {},
  async () => {
    const data = await apiCall("GET", `/api/webhook/folders`);
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
  },
);

// ── Event Bus tools ──

// Tool: poll_events
server.tool(
  "poll_events",
  "Poll for pending task events from a canvas event bus channel. Returns unconsumed events that were published by canvas nodes for agents to process.",
  {
    canvasId: z.number().describe("Document ID of the canvas"),
    channel: z.string().optional().describe("Event channel name (default: 'default')"),
  },
  async ({ canvasId, channel }) => {
    const data = await apiCall("GET", `/api/webhook/events/${canvasId}?channel=${channel || "default"}`);
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
  },
);

// Tool: post_result
server.tool(
  "post_result",
  "Post a completed result back to the canvas event bus. Creates a document node on the canvas connected to the listen-mode event bus node as proof of work.",
  {
    canvasId: z.number().describe("Document ID of the canvas"),
    channel: z.string().optional().describe("Event channel name (default: 'default')"),
    label: z.string().describe("Title for the result document node"),
    content: z.string().describe("Full content/body of the result"),
    sourceEventId: z.string().optional().describe("ID of the original task event this result responds to"),
  },
  async ({ canvasId, channel, label, content, sourceEventId }) => {
    const data = await apiCall("POST", `/api/webhook/events/${canvasId}/result`, {
      channel: channel || "default",
      label,
      content,
      sourceEventId,
    });
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
  },
);

// Tool: ack_events
server.tool(
  "ack_events",
  "Acknowledge events that have been processed. Marks them as consumed so they won't appear in future polls.",
  {
    canvasId: z.number().describe("Document ID of the canvas"),
    eventIds: z.array(z.string()).describe("Array of event IDs to acknowledge"),
  },
  async ({ canvasId, eventIds }) => {
    const data = await apiCall("POST", `/api/webhook/events/${canvasId}/ack`, { eventIds });
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
  },
);

// ── Start ──

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("MCP server error:", err);
  process.exit(1);
});
