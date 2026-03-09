# Marketing Agency — Claude Code Workflow

## Overview

The Marketing Agency is a **Claude Code workflow** that runs locally and connects to the Provocations flow canvas via MCP tools. It orchestrates a 5-stage marketing pipeline, creating and connecting nodes on the canvas as it progresses.

This is NOT a Provocations app template — it runs in your local Claude Code environment and uses the `provocations` MCP server to interact with the canvas remotely.

## Prerequisites

1. **Provocations server running** at `http://localhost:5000` (or your configured URL)
2. **PROVOCATIONS_API_KEY** set in both the server `.env` and the MCP config (`.mcp.json`)
3. **A canvas document** already created in Provocations (you need the document ID)

## Setup

1. Set `PROVOCATIONS_API_KEY` in your server's `.env`:
   ```
   PROVOCATIONS_API_KEY=your-secret-key-here
   ```

2. Update `.mcp.json` with the same key:
   ```json
   {
     "provocations": {
       "command": "npx",
       "args": ["tsx", "server/mcp-server.ts"],
       "env": {
         "PROVOCATIONS_API_KEY": "your-secret-key-here",
         "PROVOCATIONS_URL": "http://localhost:5000"
       }
     }
   }
   ```

3. Restart Claude Code to pick up the MCP server.

## MCP Tools Available

| Tool | Purpose |
|------|---------|
| `get_canvas` | Get full canvas state (nodes + edges) |
| `list_nodes` | List all nodes on a canvas |
| `get_node` | Get single node with content |
| `create_node` | Add a node (type, label, content, position) |
| `update_node` | Update node content/label/status |
| `delete_node` | Remove a node and its edges |
| `create_edge` | Connect two nodes (with optional role) |
| `read_node_inputs` | Get combined content flowing into a node |

## The 5-Stage Marketing Pipeline

### Stage 1: RESEARCH

**Goal:** Analyze the product/project context and produce market research.

**Process:**
1. Use `get_canvas` to read existing context-doc nodes (product briefs, audience data)
2. Apply the **Growth Strategist** persona perspective:
   - What is the customer acquisition cost model?
   - What activation events matter?
   - Where are the funnel leaks?
   - What does the retention curve look like?
3. Use `create_node` to add a `document` node with research findings
4. Use `create_edge` to connect input context nodes → research node

**Persona prompt (Growth Strategist):**
> You are a data-driven growth practitioner. Every feature, every launch, every campaign must connect to a measurable growth lever. Refuse vanity metrics. Demand activation events, retention curves, and funnel economics. If the user can't articulate their CAC model, that's the first problem to solve.

### Stage 2: STRATEGY

**Goal:** Build brand positioning and marketing strategy from research.

**Process:**
1. Use `get_node` to read the research node from Stage 1
2. Apply the **Brand Strategist** persona perspective:
   - What is the one-sentence positioning statement?
   - How does this differentiate from competitors?
   - Who is this for, specifically?
   - What is the brand voice and tone?
3. Use `create_node` to add a `document` node with the strategy
4. Use `create_edge` to connect research → strategy

**Persona prompt (Brand Strategist):**
> You are a positioning specialist. Move the conversation from "we're unique" to "unique how, for whom, compared to what?" Demand a one-sentence positioning statement. Challenge every claim of differentiation with "prove it." Voice and tone aren't afterthoughts — they're strategic assets.

### Stage 3: CONTENT CREATION

**Goal:** Produce marketing content aligned to the strategy.

**Process:**
1. Use `read_node_inputs` on the strategy node to get full context chain
2. Apply the **Content Strategist** persona perspective:
   - Which channels reach this audience?
   - What content formats match those channels?
   - What is the distribution plan?
   - How will results be measured?
3. Create multiple `document` nodes — one per content piece:
   - Blog post / article
   - Social media posts (per platform)
   - Email campaign copy
   - Landing page copy
4. Use `create_edge` to connect strategy → each content node

**Persona prompt (Content Strategist):**
> You are a distribution-first content practitioner. Refuse "create great content" as a strategy. Every piece needs: target audience, channel, format rationale, distribution plan, and measurable outcome. Match content intent to audience stage (awareness, consideration, decision).

### Stage 4: REVIEW

**Goal:** Present content for human review and approval.

**Process:**
1. Use `create_node` to add an `approval` node
2. Use `create_edge` to connect each content node → approval node
3. Use `update_node` to set the approval node's content to a summary of all pending content
4. Notify the user to review in the Provocations UI
5. Periodically use `get_node` to check if the approval node's status has changed

### Stage 5: PUBLISH

**Goal:** Distribute approved content to platforms.

**Process:**
1. Once approved, use `create_node` to add `api-connection` nodes for each target platform
2. Use `create_edge` to connect content nodes → their respective platform nodes
3. Set `apiService` and `apiWebhookUrl` on each api-connection node via `update_node`

## Node Layout Convention

When creating the pipeline visually on the canvas, use this layout:

```
x=100              x=500              x=900              x=1300             x=1700
y=100  [Context]──►[Research]──────►[Strategy]──────►[Blog Post]──────►[Approval]
y=300                                               [Social Posts]────►
y=500                                               [Email Copy]──────►
```

- Horizontal flow left-to-right
- Each stage offset by ~400px on x-axis
- Content variants stacked vertically at ~200px spacing

## Example Usage

In Claude Code, after setup:

```
> Read the canvas at ID 42 and run the marketing agency pipeline

Claude Code will:
1. Call get_canvas(42) to see existing nodes
2. Read context-doc nodes for product information
3. Create research node with growth analysis
4. Create strategy node with brand positioning
5. Create content nodes for blog, social, email
6. Create approval node for human review
7. Report back with a summary of what was created
```
