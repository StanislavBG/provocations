# BS Chart — App Guide

> **Template ID**: `bs-chart` | **Category**: `build` | **Layout**: `bs-chart` (custom)

## Purpose

An infinite canvas diagramming tool for creating data flow diagrams, architecture charts, ERD schemas, and process maps. Visual thinking should be as natural as whiteboarding — drag shapes, connect them, annotate with text. Voice commands let you design hands-free.

## Unique Behaviors

- **Custom workspace layout**: `bs-chart` — toolbar | canvas | properties (not standard 3-panel)
- **Infinite Canvas**: Pan (middle-click/hand tool), zoom (scroll wheel), grid snapping
- **Shape Types**: table, diamond, rectangle, rounded-rect, text, badge
- **Connectors**: Orthogonal bezier paths with configurable arrow markers
- **Voice Commands**: "add table called Users", "connect Users to Orders", "move Orders right of Users"
- **Table Nodes**: Header row, dynamic columns/rows, per-cell editing
- **Undo/Redo**: Full history stack with Ctrl+Z/Ctrl+Y
- **Export/Import**: JSON chart files, save to Context Store

## Key Files

| Component | Path | Purpose |
|-----------|------|---------|
| `BSChartWorkspace` | `bschart/BSChartWorkspace.tsx` | Top-level workspace with state management |
| `BSChartCanvas` | `bschart/BSChartCanvas.tsx` | Infinite canvas with grid, pan, zoom |
| `BSChartToolbar` | `bschart/BSChartToolbar.tsx` | Left panel: tools, shapes, actions |
| `BSChartProperties` | `bschart/BSChartProperties.tsx` | Right panel: edit selected node/connector |
| `useChartState` | `bschart/hooks/useChartState.ts` | Chart state management with undo/redo |
| `useVoiceChartCommands` | `bschart/hooks/useVoiceChartCommands.ts` | Voice command parser and executor |
| `types.ts` | `bschart/types.ts` | Data model: BSNode, BSConnector, BSChart |

See `docs/architecture.md` for the three-layer application pattern.
