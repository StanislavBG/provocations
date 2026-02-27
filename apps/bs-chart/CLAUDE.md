# BS Chart — Infinite Canvas Diagramming Tool

## Identity

**Purpose**: An infinite canvas diagramming tool for creating data flow diagrams, architecture charts, ERD schemas, and process maps.

**Category**: build

**Philosophy**: Visual thinking should be as natural as whiteboarding — drag shapes, connect them, annotate with text. Voice commands let you design hands-free.

**User Workflow**: User drags shapes from the left toolbar onto the canvas, connects them with click-and-drag connectors, edits properties in the right panel, and can issue voice commands to manipulate the chart.

## Three-Layer Definition

### Layer 1: Template (`prebuiltTemplates.ts`)
- **id**: `bs-chart`
- **category**: `build`
- **icon**: `GitGraph`
- **statusLabel**: `alpha`

### Layer 2: Workspace Config (`appWorkspaceConfig.ts`)
- **workspaceLayout**: `bs-chart` (custom layout — toolbar | canvas | properties)
- **defaultToolboxTab**: `context`
- **autoStartInterview**: false
- **writer.mode**: `edit`
- **writer.outputFormat**: `markdown`

### Layer 3: Context Builder (`context-builder.ts`)
- **documentType**: `diagram / chart`
- **feedbackTone**: `precise and architecture-focused`
- Challenges focus on: completeness, labeled connectors, orphaned nodes, table schema validity

## App-Specific Components

| Component | File | Purpose |
|-----------|------|---------|
| `BSChartWorkspace` | `bschart/BSChartWorkspace.tsx` | Top-level workspace: toolbar, canvas, properties |
| `BSChartCanvas` | `bschart/BSChartCanvas.tsx` | Infinite canvas with grid, pan, zoom, node/connector rendering |
| `BSChartToolbar` | `bschart/BSChartToolbar.tsx` | Left panel: tools, shapes, actions |
| `BSChartProperties` | `bschart/BSChartProperties.tsx` | Right panel: edit selected node/connector |
| `BSNodeRenderer` | `bschart/nodes/BSNodeRenderer.tsx` | Renders all node types (table, diamond, rect, text, badge) |
| `BSConnectorLayer` | `bschart/BSConnectorLayer.tsx` | SVG overlay rendering connectors with markers |
| `useChartState` | `bschart/hooks/useChartState.ts` | Chart state management with undo/redo |
| `useCanvasInteraction` | `bschart/hooks/useCanvasInteraction.ts` | Pan, zoom, drag, marquee, connect interactions |
| `useVoiceChartCommands` | `bschart/hooks/useVoiceChartCommands.ts` | Voice command parser and executor |
| `types.ts` | `bschart/types.ts` | Data model: BSNode, BSConnector, BSChart |

## Key Behaviors

- **Infinite Canvas**: Pan (middle-click/hand tool), zoom (scroll wheel), grid snapping
- **Shape Types**: table, diamond, rectangle, rounded-rect, text, badge
- **Connectors**: Orthogonal bezier paths with configurable arrow markers (arrow, diamond, circle)
- **Undo/Redo**: Full history stack with Ctrl+Z/Ctrl+Y
- **Keyboard Shortcuts**: V=select, H=pan, C=connect, R=rect, D=diamond, T=table, etc.
- **Voice Commands**: "add table called Users", "connect Users to Orders", "move Orders right of Users"
- **Table Nodes**: Header row, dynamic columns/rows, per-cell editing, striped rows
- **Properties Panel**: Full style editing (fill, stroke, text color, font, opacity, border radius)
- **Export/Import**: JSON chart files, save to Context Store for sharing
