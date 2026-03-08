/**
 * MCP Agency Server — bridges the Provocations event queue REST API
 * to the MCP protocol so local Claude Code agents can interact with it.
 *
 * This runs as a standalone process (stdio transport) and is configured
 * in the local agency's .mcp.json.
 *
 * Environment variables:
 *   AGENCY_API_URL  — Base URL of the Provocations instance (e.g. https://provo.replit.app)
 *   AGENCY_API_KEY  — API key for authentication (matches AGENCY_API_KEY on the server)
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const API_URL = process.env.AGENCY_API_URL || "http://localhost:5000";
const API_KEY = process.env.AGENCY_API_KEY || "";

async function apiCall(method: string, path: string, body?: unknown): Promise<unknown> {
  const url = `${API_URL}${path}`;
  const headers: Record<string, string> = {
    "X-Agency-Key": API_KEY,
    "Content-Type": "application/json",
  };

  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API error ${res.status}: ${text}`);
  }

  return res.json();
}

const server = new Server(
  { name: "provo-agency", version: "1.0.0" },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "agency_poll_events",
      description: "Poll for pending agency events. Returns events waiting to be claimed and processed.",
      inputSchema: {
        type: "object" as const,
        properties: {},
      },
    },
    {
      name: "agency_list_events",
      description: "List agency events with optional filters.",
      inputSchema: {
        type: "object" as const,
        properties: {
          status: { type: "string", description: "Filter by status: pending, claimed, processing, completed, failed, cancelled" },
          eventType: { type: "string", description: "Filter by event type" },
          platform: { type: "string", description: "Filter by platform: x, reddit, facebook" },
        },
      },
    },
    {
      name: "agency_claim_event",
      description: "Claim a pending event for processing. Returns the full event with payload.",
      inputSchema: {
        type: "object" as const,
        properties: {
          eventId: { type: "number", description: "The event ID to claim" },
          claimToken: { type: "string", description: "Unique token identifying this agent's claim" },
        },
        required: ["eventId", "claimToken"],
      },
    },
    {
      name: "agency_complete_event",
      description: "Mark an event as completed with results. Submit the drafted content back to Provocations.",
      inputSchema: {
        type: "object" as const,
        properties: {
          eventId: { type: "number", description: "The event ID to complete" },
          claimToken: { type: "string", description: "The claim token used when claiming" },
          result: { type: "string", description: "JSON string with the agency output (drafted posts, search findings, etc.)" },
        },
        required: ["eventId", "claimToken", "result"],
      },
    },
    {
      name: "agency_fail_event",
      description: "Mark an event as failed with an error message.",
      inputSchema: {
        type: "object" as const,
        properties: {
          eventId: { type: "number", description: "The event ID that failed" },
          claimToken: { type: "string", description: "The claim token used when claiming" },
          errorMessage: { type: "string", description: "Description of what went wrong" },
        },
        required: ["eventId", "claimToken", "errorMessage"],
      },
    },
    {
      name: "agency_create_event",
      description: "Create a new agency event in the queue.",
      inputSchema: {
        type: "object" as const,
        properties: {
          eventType: { type: "string", description: "Event type: search_x, search_reddit, search_facebook, craft_reply, craft_post, review_cycle, full_cycle" },
          platform: { type: "string", description: "Target platform: x, reddit, facebook" },
          payload: { type: "string", description: "JSON string with event-specific data" },
          priority: { type: "number", description: "Priority 0-10 (higher = more urgent)" },
        },
        required: ["eventType"],
      },
    },
    {
      name: "agency_list_campaigns",
      description: "List all active marketing campaigns.",
      inputSchema: {
        type: "object" as const,
        properties: {},
      },
    },
    {
      name: "agency_get_campaign",
      description: "Get a specific campaign's configuration including brand voice, target topics, and platforms.",
      inputSchema: {
        type: "object" as const,
        properties: {
          campaignId: { type: "string", description: "The campaign ID to retrieve" },
        },
        required: ["campaignId"],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "agency_poll_events": {
        const data = await apiCall("GET", "/api/agency/events/poll");
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      }

      case "agency_list_events": {
        const params = new URLSearchParams();
        if (args?.status) params.set("status", String(args.status));
        if (args?.eventType) params.set("eventType", String(args.eventType));
        if (args?.platform) params.set("platform", String(args.platform));
        const query = params.toString() ? `?${params.toString()}` : "";
        const data = await apiCall("GET", `/api/agency/events${query}`);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      }

      case "agency_claim_event": {
        const data = await apiCall("POST", `/api/agency/events/${args!.eventId}/claim`, {
          claimToken: args!.claimToken,
        });
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      }

      case "agency_complete_event": {
        const data = await apiCall("POST", `/api/agency/events/${args!.eventId}/complete`, {
          claimToken: args!.claimToken,
          result: args!.result,
        });
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      }

      case "agency_fail_event": {
        const data = await apiCall("POST", `/api/agency/events/${args!.eventId}/fail`, {
          claimToken: args!.claimToken,
          errorMessage: args!.errorMessage,
        });
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      }

      case "agency_create_event": {
        const data = await apiCall("POST", "/api/agency/events", {
          eventType: args!.eventType,
          platform: args?.platform,
          payload: args?.payload,
          priority: args?.priority,
        });
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      }

      case "agency_list_campaigns": {
        const data = await apiCall("GET", "/api/agency/campaigns");
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      }

      case "agency_get_campaign": {
        const data = await apiCall("GET", `/api/agency/campaigns/${args!.campaignId}`);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      }

      default:
        return { content: [{ type: "text", text: `Unknown tool: ${name}` }], isError: true };
    }
  } catch (err) {
    return {
      content: [{ type: "text", text: `Error: ${(err as Error).message}` }],
      isError: true,
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Provo Agency MCP server running on stdio");
}

main().catch(console.error);
