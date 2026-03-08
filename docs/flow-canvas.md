# Flow Canvas Architecture

The **Flow Canvas** (`/flow`) is an infinite canvas where users build processing flows by placing and connecting nodes from the dock. This is NOT just a diagramming tool; it's a **visual workflow builder** where data flows between nodes.

## Dual-View Pattern (MANDATORY)

Every node type MUST have two views:

| View | Where | Purpose |
|------|-------|---------|
| **Compact** | On canvas | Small card showing type badge, label, and content snippet. Draggable, deletable, connectable. |
| **Full** | Double-click overlay | Full interactive experience (research chat, image generation, interview session, etc.). Changes persist back to the node. |

**Rules:**
- Adding a node from the dock places it in **compact view only** — NEVER auto-open the full view.
- Double-click on a compact node opens its full view.
- Full view state (conversations, generated content, settings) persists on the `FlowNode` object so users can return to it.
- Closing the full view returns to the canvas with the compact node updated to reflect any changes.

## Edge / Connection System

Nodes connect via `FlowEdge` objects rendered as gray curved arrows (`FlowEdgeLayer.tsx`). Edges represent data flow:

- **Output of one node → Input of the next.** When a node produces output (research finding, LLM result, generated image), it can be linked to downstream nodes.
- Edges are created programmatically (e.g., "Send to Notes" from Research creates a note + edge). Future: interactive edge creation by dragging between node ports.
- Deleting a node cascade-deletes all its edges.

## Dock Items and Node Types

| Dock Item | ToolId | FlowNodeType | Group | Icon | Purpose |
|-----------|--------|--------------|-------|------|---------|
| Context | `context` | `context-doc` / `store` | gather | BookOpen | Load a file or place a store node (Save File) |
| Research | `research` | `research` | workshop | Sparkles | AI research chat with per-node persistent conversations |
| Interview | `interview` | `interview` | workshop | MessageCircleQuestion | Guided interview sessions |
| Text Mods | `llm` | `llm` | build | Brain | Text modifications with presets (Summarize, Clean, Expand, Custom) |
| Painter | `painter` | `painter` | build | Paintbrush | Image generation via Gemini Imagen |
| Timeline | `timeline` | `timeline` | build | Clock | Visual timeline creation |

## Adding a New Node Type

1. Add to `FlowNodeType` union in `useFlowCanvas.ts`
2. Add default dimensions in `DEFAULT_DIMENSIONS`
3. Add styling (colors, icon, badge) in `FlowNodeRenderer.tsx` (`NODE_STYLES` + `NODE_ICONS`)
4. Add dock item in `FLOW_DOCK_ITEMS` in `FlowWorkspace.tsx`
5. Add dock click handler in the `useEffect([activeTool])` block
6. Add drop handler in `handleDropTool`
7. If the node needs a specialized interactive component (like `FlowLlmNode`), create a dedicated component and add a rendering branch in `FlowCanvas.tsx`
8. Implement the full-view overlay in `FlowWorkspace.tsx` (opened on double-click)

## Key Files

| File | Purpose |
|------|---------|
| `client/src/components/flow/useFlowCanvas.ts` | State hook: FlowNode, FlowEdge, FlowNodeType, dimensions, addNode/addEdge/updateNode/deleteNode |
| `client/src/components/flow/FlowCanvas.tsx` | Canvas renderer: viewport transform, node rendering, edge layer, drag-drop |
| `client/src/components/flow/FlowEdgeLayer.tsx` | SVG edge rendering with smart endpoint selection |
| `client/src/components/flow/FlowNodeRenderer.tsx` | Generic compact node renderer (styles, icons, badges for all types) |
| `client/src/components/flow/FlowLlmNode.tsx` | Specialized LLM node with preset chips, run button, output |
| `client/src/components/flow/FlowStoreNode.tsx` | Specialized Context Store node with embedded ContextSidebar |
| `client/src/components/flow/useFlowInteraction.ts` | Pan, zoom, drag, selection, screenToCanvas conversion |
| `client/src/pages/FlowWorkspace.tsx` | Orchestrator: dock config, tool handlers, overlays, state wiring |
| `client/src/components/flow/llm-presets.ts` | LLM preset definitions (Summarize, Clean, Expand, Custom) |
